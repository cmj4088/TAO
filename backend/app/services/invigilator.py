"""监考分配核心算法 — 确定性贪心 + 7次重试 + AI兜底

规则优先级（从高到低）：
1. 老师优先监考自己的班级（最高）
2. 每人实际场次 == slots（严格匹配）
3. 同组老师共享时间段集合（最低）
4. 同一时间段一位老师只能出现一次（通用约束）
"""
import copy
import json
import random
import urllib.request
import urllib.error
import socket

from app.schemas.app01 import ExamRow, TeacherInfo

ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
ARK_KEY = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
AI_MODEL = "deepseek-v4-pro-260425"

MAX_RETRIES = 20
AI_TIMEOUT = 120

_proxy_handler = urllib.request.ProxyHandler({})
_opener = urllib.request.build_opener(_proxy_handler)


def _check_totals(exam_rows: list[ExamRow], teachers: list[TeacherInfo]) -> None:
    total_needed = len(exam_rows) * 2
    total_slots = sum(t.slots for t in teachers)
    if total_needed != total_slots:
        from fastapi import HTTPException
        raise HTTPException(
            400,
            f"总安排场次({total_slots})与需要监考位({total_needed})不匹配，请调整通讯录中的场次数字",
        )
    time_slot_count = len(set(r.考试时间 for r in exam_rows))
    for t in teachers:
        if t.slots > time_slot_count:
            from fastapi import HTTPException
            raise HTTPException(
                400,
                f"{t.name}的场次({t.slots})超过可用时间段数({time_slot_count})，无法分配",
            )
    slot_exam_count: dict[str, int] = {}
    for r in exam_rows:
        slot_exam_count[r.考试时间] = slot_exam_count.get(r.考试时间, 0) + 1
    max_needed_per_slot = max(slot_exam_count.values()) * 2
    if max_needed_per_slot > len(teachers):
        from fastapi import HTTPException
        raise HTTPException(
            400,
            f"单个时段最多需要{max_needed_per_slot}位监考，但只有{len(teachers)}位老师，无法分配",
        )


def _calc_loads(rows: list[ExamRow]) -> dict[str, int]:
    loads: dict[str, int] = {}
    for r in rows:
        if r.监考1:
            loads[r.监考1] = loads.get(r.监考1, 0) + 1
        if r.监考2:
            loads[r.监考2] = loads.get(r.监考2, 0) + 1
    return loads


def _build_own_slots(
    exam_rows: list[ExamRow], teacher_set: set[str]
) -> dict[str, set[str]]:
    own: dict[str, set[str]] = {}
    for r in exam_rows:
        for t in r.任课教师:
            if t in teacher_set:
                own.setdefault(t, set()).add(r.考试时间)
    return own


def _build_groups(teachers: list[TeacherInfo]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for t in teachers:
        if t.group:
            groups.setdefault(t.group, []).append(t.name)
    return groups


# ===== 核心分配入口 =====

def allocate(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
    skip_ai: bool = False,
) -> tuple[list[ExamRow], list[str], dict[str, int]]:
    _check_totals(exam_rows, teachers)

    teacher_slots = {t.name: t.slots for t in teachers}
    own_slots = _build_own_slots(exam_rows, {t.name for t in teachers})
    groups = _build_groups(teachers)

    time_slots = sorted(set(r.考试时间 for r in exam_rows))
    slot_to_rows: dict[str, list[ExamRow]] = {}
    for r in exam_rows:
        slot_to_rows.setdefault(r.考试时间, []).append(r)

    best_result: list[ExamRow] | None = None
    best_errors: list[dict] = []
    best_warnings: list[str] = []

    for attempt in range(MAX_RETRIES):
        rng = random.Random()  # 真随机，每次运行结果不同
        result, warnings = _assign_all(
            exam_rows, time_slots, slot_to_rows, teachers,
            own_slots, groups, teacher_slots, rng
        )
        errors = _review(result, teachers, groups, own_slots, teacher_slots)

        critical = [e for e in errors if e["priority"] <= 2]
        if not critical:
            return result, warnings, _calc_loads(result)

        if best_result is None or len(critical) < len(
            [e for e in best_errors if e["priority"] <= 2]
        ):
            best_result = result
            best_errors = errors
            best_warnings = warnings

    # 7次贪心全部失败 → AI 兜底
    if skip_ai:
        best_warnings.append("跳过AI兜底，返回最优贪心结果")
        return best_result, best_warnings, _calc_loads(best_result)
    try:
        ai_result, ai_warnings = _ai_allocate(
            exam_rows, teachers, time_slots, slot_to_rows, own_slots, groups, teacher_slots
        )
        if ai_result is not None:
            ai_errors = _review(ai_result, teachers, groups, own_slots, teacher_slots)
            ai_critical = [e for e in ai_errors if e["priority"] <= 2]
            all_warnings = ai_warnings
            if ai_critical:
                all_warnings = ai_warnings + [
                    f"AI 辅助分配仍有 {len(ai_critical)} 个问题："
                ] + [e["reason"] for e in ai_critical[:10]]
            return ai_result, all_warnings, _calc_loads(ai_result)
    except Exception as e:
        best_warnings.append(f"AI 兜底调用失败：{e}")

    return best_result, best_warnings, _calc_loads(best_result)


# ===== 合并分配（时段+考场一步完成）=====

def _assign_all(
    exam_rows: list[ExamRow],
    time_slots: list[str],
    slot_to_rows: dict[str, list[ExamRow]],
    teachers: list[TeacherInfo],
    own_slots: dict[str, set[str]],
    groups: dict[str, list[str]],
    teacher_slots: dict[str, int],
    rng: random.Random,
) -> tuple[list[ExamRow], list[str]]:
    """一步完成分配：逐时段处理，动态选择该时段的老师并安排具体考场"""

    rows = [copy.deepcopy(r) for r in exam_rows]
    for r in rows:
        r.监考1 = None
        r.监考2 = None
    row_map: dict[int, ExamRow] = {r.index: r for r in rows}

    # 剩余需求
    remaining = {t.name: t.slots for t in teachers}
    # 教师分组信息
    teacher_group: dict[str, str] = {}
    group_members: dict[str, list[str]] = {}
    for g, members in groups.items():
        for m in members:
            teacher_group[m] = g
        group_members[g] = list(members)

    warnings: list[str] = []

    # 根据随机种子选择不同时段排序策略
    strat = rng.randint(0, 2)
    if strat == 0:
        ordered_slots = sorted(time_slots, key=lambda ts: (-len(slot_to_rows.get(ts, [])), rng.random()))
    elif strat == 1:
        ordered_slots = sorted(time_slots, key=lambda ts: (len(slot_to_rows.get(ts, [])), rng.random()))
    else:
        ordered_slots = list(time_slots)
        rng.shuffle(ordered_slots)

    for ts in ordered_slots:
        slot_rows = slot_to_rows.get(ts, [])
        n_positions = len(slot_rows) * 2  # 这个时段需要多少老师

        # 最后时段或剩余总量刚好时，把所有有剩余的老师都纳入池子
        total_remaining = sum(remaining.get(t.name, 0) for t in teachers)
        if total_remaining <= n_positions:
            pool = {t.name for t in teachers if remaining.get(t.name, 0) > 0}
        else:
            pool = _select_pool(
                ts, teachers, remaining, own_slots, teacher_group, group_members,
                n_positions, rng
            )

        used: set[str] = set()

        # 阶段1：自己班优先
        sorted_exams = sorted(
            slot_rows,
            key=lambda r: len([
                t for t in r.任课教师
                if t in pool and t not in used
            ]),
        )
        for exam in sorted_exams:
            row = row_map[exam.index]
            candidates = [
                t for t in exam.任课教师
                if t in pool and t not in used and remaining.get(t, 0) > 0
            ]
            if not candidates:
                continue
            candidates.sort(key=lambda t: remaining.get(t, 0))

            if row.监考1 is None:
                row.监考1 = candidates[0]
                used.add(candidates[0])
                remaining[candidates[0]] -= 1
                candidates.pop(0)
            if row.监考2 is None and candidates:
                row.监考2 = candidates[0]
                used.add(candidates[0])
                remaining[candidates[0]] -= 1

        # 阶段2：分组搭档
        for group, members in group_members.items():
            placed = [m for m in members if m in used]
            unplaced = [m for m in members if m in pool and m not in used and remaining.get(m, 0) > 0]

            for member in unplaced:
                found = False
                # 优先坐同组已安排老师的考场
                for exam in slot_rows:
                    row = row_map[exam.index]
                    if row.监考1 in placed or row.监考2 in placed:
                        if row.监考1 is None:
                            row.监考1 = member
                            used.add(member)
                            remaining[member] -= 1
                            placed.append(member)
                            found = True
                            break
                        elif row.监考2 is None:
                            row.监考2 = member
                            used.add(member)
                            remaining[member] -= 1
                            placed.append(member)
                            found = True
                            break
                if not found:
                    for exam in slot_rows:
                        row = row_map[exam.index]
                        if row.监考1 is None:
                            row.监考1 = member
                            used.add(member)
                            remaining[member] -= 1
                            placed.append(member)
                            found = True
                            break
                        elif row.监考2 is None:
                            row.监考2 = member
                            used.add(member)
                            remaining[member] -= 1
                            placed.append(member)
                            found = True
                            break

        # 阶段3：填坑（剩余多的优先）
        fillers = [t for t in pool if t not in used and remaining.get(t, 0) > 0]
        fillers.sort(key=lambda t: -remaining.get(t, 0))
        fi = 0
        for exam in slot_rows:
            row = row_map[exam.index]
            if row.监考1 is None and fi < len(fillers):
                row.监考1 = fillers[fi]
                used.add(fillers[fi])
                remaining[fillers[fi]] -= 1
                fi += 1
            if row.监考2 is None and fi < len(fillers):
                row.监考2 = fillers[fi]
                used.add(fillers[fi])
                remaining[fillers[fi]] -= 1
                fi += 1

        # 最终兜底：如果还有空位，从池子外补充
        if any(r.监考1 is None or r.监考2 is None for exam in slot_rows for r in [row_map[exam.index]]):
            leftovers = [
                t for t in teachers
                if t.name not in used
                and remaining.get(t.name, 0) > 0
            ]
            leftovers.sort(key=lambda t: remaining.get(t.name, 0))
            li = 0
            for exam in slot_rows:
                row = row_map[exam.index]
                if row.监考1 is None and li < len(leftovers):
                    row.监考1 = leftovers[li].name
                    used.add(leftovers[li].name)
                    remaining[leftovers[li].name] -= 1
                    li += 1
                if row.监考2 is None and li < len(leftovers):
                    row.监考2 = leftovers[li].name
                    used.add(leftovers[li].name)
                    remaining[leftovers[li].name] -= 1
                    li += 1

        for exam in slot_rows:
            row = row_map[exam.index]
            if row.监考1 is None:
                warnings.append(f"时间段{ts}第{exam.index}行监考1未能分配")
            if row.监考2 is None:
                warnings.append(f"时间段{ts}第{exam.index}行监考2未能分配")

    return rows, warnings


def _select_pool(
    ts: str,
    teachers: list[TeacherInfo],
    remaining: dict[str, int],
    own_slots: dict[str, set[str]],
    teacher_group: dict[str, str],
    group_members: dict[str, list[str]],
    n_needed: int,
    rng: random.Random,
) -> set[str]:
    """选择当前时段可用的老师池子，精确返回 n_needed 人"""

    pool: set[str] = set()

    # 1. 任教老师（在这个时段有班的）
    own_teachers = [
        t for t in teachers
        if ts in own_slots.get(t.name, set())
        and remaining.get(t.name, 0) > 0
    ]
    for t in own_teachers:
        if len(pool) < n_needed:
            pool.add(t.name)

    # 2. 分组老师：如果组内有人在这个时段，全组加入
    for group, members in group_members.items():
        if any(m in pool for m in members):
            for m in members:
                if len(pool) >= n_needed:
                    break
                if remaining.get(m, 0) > 0 and m not in pool:
                    pool.add(m)

    # 3. 补充到 n_needed（剩余多的优先）
    if len(pool) < n_needed:
        candidates = [
            t for t in teachers
            if t.name not in pool
            and remaining.get(t.name, 0) > 0
        ]
        rng.shuffle(candidates)
        candidates.sort(key=lambda t: -remaining.get(t.name, 0))
        for t in candidates:
            if len(pool) >= n_needed:
                break
            pool.add(t.name)

    # 4. 如果池子过大，移除非任教、非分组成员（剩余多的先移除）
    if len(pool) > n_needed:
        priority: set[str] = {o.name for o in own_teachers}
        for group, members in group_members.items():
            if any(m in pool for m in members):
                priority.update(members)
        non_priority = [t for t in pool if t not in priority]
        rng.shuffle(non_priority)
        non_priority.sort(key=lambda t: -remaining.get(t, 0))
        remove_count = len(pool) - n_needed
        for t in non_priority[:remove_count]:
            pool.discard(t)

    return pool


# ===== 审查 =====

def _review(
    rows: list[ExamRow],
    teachers: list[TeacherInfo],
    groups: dict[str, list[str]],
    own_slots: dict[str, set[str]],
    teacher_slots: dict[str, int],
) -> list[dict]:
    """审查分配结果"""
    errors: list[dict] = []

    slot_rows: dict[str, dict[int, ExamRow]] = {}
    for r in rows:
        slot_rows.setdefault(r.考试时间, {})[r.index] = r

    # 同时段重复
    for ts, exam_map in slot_rows.items():
        seen: dict[str, list[int]] = {}
        for r in exam_map.values():
            for field in ["监考1", "监考2"]:
                t = getattr(r, field)
                if not t:
                    continue
                seen.setdefault(t, []).append(r.index)
        for teacher, indices in seen.items():
            if len(indices) > 1:
                for idx in indices:
                    errors.append({
                        "priority": 1, "row_index": idx, "field": "监考1",
                        "teacher": teacher, "reason": f"同一时段({ts})重复出现",
                    })

    # P1: 自己班优先
    for ts, exam_map in slot_rows.items():
        own_exams: dict[str, list[int]] = {}
        for r in exam_map.values():
            for t in r.任课教师:
                own_exams.setdefault(t, []).append(r.index)

        for r in exam_map.values():
            for field in ["监考1", "监考2"]:
                t = getattr(r, field)
                if not t:
                    continue
                if t in own_exams and r.index not in own_exams[t]:
                    own_empty = any(
                        exam_map[oi].监考1 is None or exam_map[oi].监考2 is None
                        for oi in own_exams[t] if oi in exam_map
                    )
                    if own_empty:
                        errors.append({
                            "priority": 1, "row_index": r.index, "field": field,
                            "teacher": t,
                            "reason": f"{t}在时段{ts}有任教班级但未监考自己的班（自己的班还有空位）",
                        })

    # P2: 场次匹配
    loads = _calc_loads(rows)
    for t in teachers:
        actual = loads.get(t.name, 0)
        if actual != t.slots:
            errors.append({
                "priority": 2, "row_index": 0, "field": "",
                "teacher": t.name,
                "reason": f"{t.name}安排了{actual}场，目标{t.slots}场",
            })

    # P3: 同组时段一致
    for group, members in groups.items():
        member_slots: dict[str, set[str]] = {}
        for m in members:
            slots = set()
            for r in rows:
                if r.监考1 == m or r.监考2 == m:
                    slots.add(r.考试时间)
            member_slots[m] = slots

        if len(member_slots) >= 2:
            reference = list(member_slots.values())[0]
            for m, slots in member_slots.items():
                if slots != reference:
                    diff = reference.symmetric_difference(slots)
                    errors.append({
                        "priority": 3, "row_index": 0, "field": "",
                        "teacher": m,
                        "reason": f"分组{group}：{m}的时间段与组内其他成员不一致（差异：{diff}）",
                    })

    return errors


# ===== AI 兜底 =====

def _call_ai(api_key: str, prompt: str) -> str:
    body = json.dumps({
        "model": AI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
    }).encode("utf-8")

    req = urllib.request.Request(
        ARK_URL, data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )

    try:
        with _opener.open(req, timeout=AI_TIMEOUT) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"AI API 返回错误 {e.code}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接 AI 服务: {e.reason}")
    except socket.timeout:
        raise RuntimeError(f"AI 调用超时（{AI_TIMEOUT}秒）")

    return result["choices"][0]["message"]["content"]


def _ai_allocate(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
    time_slots: list[str],
    slot_to_rows: dict[str, list[ExamRow]],
    own_slots: dict[str, set[str]],
    groups: dict[str, list[str]],
    teacher_slots: dict[str, int],
) -> tuple[list[ExamRow] | None, list[str]]:
    exam_desc = []
    for ts in time_slots:
        exams = slot_to_rows.get(ts, [])
        exam_desc.append(f"\n时间段 {ts}（需{len(exams)*2}位监考）：")
        for r in exams:
            exam_desc.append(
                f"  row_{r.index}: 班级={r.班级名称}, 课程={r.课程名称}, "
                f"任课教师=[{'、'.join(r.任课教师)}], 地点={r.考试地点}"
            )

    teacher_desc = []
    for t in teachers:
        own = own_slots.get(t.name, set())
        own_str = "、".join(sorted(own)) if own else "无"
        g = f", 分组={t.group}" if t.group else ""
        teacher_desc.append(f"  {t.name}: 部门={t.department}, 目标场次={t.slots}, 任教时间段=[{own_str}]{g}")

    group_desc = []
    for g, members in groups.items():
        group_desc.append(f"  分组{g}: {'、'.join(members)}")

    prompt = f"""你是一个监考分配助手。请为每场考试分配监考1和监考2。

约束条件（按优先级）：
1. 老师必须优先监考自己任教的班级
2. 每位老师实际场次严格等于目标场次
3. 同组老师必须在相同时间段集合中
4. 同一时间段一位老师只能出现一次

## 考试安排
{"".join(exam_desc)}

## 教师信息
{"".join(teacher_desc)}

## 分组信息
{"".join(group_desc)}

返回纯JSON：
```json
{{"assignments": [{{"row_index": 0, "监考1": "张三", "监考2": "李四"}},...]}}
```"""

    try:
        response = _call_ai(ARK_KEY, prompt)
    except Exception as e:
        return None, [f"AI 分配失败：{e}"]

    try:
        jm = response.strip()
        if "```json" in jm: jm = jm.split("```json")[1].split("```")[0]
        elif "```" in jm: jm = jm.split("```")[1].split("```")[0]
        assignments = json.loads(jm).get("assignments", [])
    except Exception as e:
        return None, [f"AI 返回格式解析失败：{e}"]

    rows = [copy.deepcopy(r) for r in exam_rows]
    for r in rows:
        r.监考1 = None; r.监考2 = None
    rm = {r.index: r for r in rows}
    for a in assignments:
        idx = a.get("row_index")
        if idx is not None and idx in rm:
            rm[idx].监考1 = a.get("监考1") or None
            rm[idx].监考2 = a.get("监考2") or None
    return rows, ["AI 辅助分配完成，请检查结果"]


def validate(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
) -> list[dict]:
    own_slots = _build_own_slots(exam_rows, {t.name for t in teachers})
    groups = _build_groups(teachers)
    teacher_slots = {t.name: t.slots for t in teachers}
    return _review(exam_rows, teachers, groups, own_slots, teacher_slots)
