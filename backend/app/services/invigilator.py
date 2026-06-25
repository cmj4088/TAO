"""监考分配核心算法 — 固定上限 + 二级机构偏差

规则：
- "不排监考" → 永远排除
- "理论上不排监考" → 严格模式排除，宽松模式正常参与
- "二级机构（少排一场）" → 上限 = 普通老师上限 - 1
- 普通老师之间场次差 ≤ 1
"""

from app.schemas.app01 import ExamRow, TeacherInfo


def _build_teacher_info(teachers: list[TeacherInfo], mode: str):
    """分析教师标记"""
    available: set[str] = set()
    is_dept: set[str] = set()
    excluded: set[str] = set()

    for t in teachers:
        name = t.name
        tags_joined = " ".join(t.tags)

        if "理论上不排监考" in tags_joined:
            if mode == "strict":
                excluded.add(name)
                continue
            available.add(name)
            continue

        if "不排监考" in tags_joined:
            excluded.add(name)
            continue

        if "二级机构" in tags_joined and "少排一场" in tags_joined:
            available.add(name)
            is_dept.add(name)
            continue

        available.add(name)

    return available, is_dept, excluded


def allocate(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
    mode: str = "strict",
) -> tuple[list[ExamRow], list[str], dict[str, int]]:
    """执行监考分配

    固定上限策略：
    1. 预计算普通老师目标上限 = ceil(总场次 / 总人数)
    2. 二级机构上限 = 普通上限 - 1
    3. 阶段1/2/4 严格不超过上限
    4. 阶段3/5 优先未达上限的，满了才超限兜底
    """

    available, is_dept, excluded = _build_teacher_info(teachers, mode)
    teacher_load: dict[str, int] = {name: 0 for name in available}

    if not available:
        return exam_rows, ["没有可参与分配的教师"], teacher_load

    total_slots = len(exam_rows) * 2
    normal_target = -(-total_slots // len(available))  # ceil

    def get_cap(name: str) -> int:
        if name in is_dept:
            return max(1, normal_target - 1)
        return normal_target

    def under_cap(t: str) -> bool:
        return teacher_load.get(t, 0) < get_cap(t)

    def sort_key(t: str) -> int:
        return teacher_load.get(t, 0)

    # 按时间段分组
    slots: dict[str, list[ExamRow]] = {}
    for row in exam_rows:
        row.监考1 = None
        row.监考2 = None
        slots.setdefault(row.考试时间, []).append(row)

    warnings: list[str] = []

    for time_slot, rows in slots.items():
        used: set[str] = set()

        # 建立教师→所教行映射
        teacher_rows: dict[str, list[ExamRow]] = {}
        for row in rows:
            for t in row.任课教师:
                if t in available:
                    teacher_rows.setdefault(t, []).append(row)

        # 阶段1：一师多班 → 监考1到自己班（仅限未达上限）
        multi = sorted(
            [t for t, trs in teacher_rows.items() if len(trs) > 1 and under_cap(t)],
            key=sort_key,
        )
        for teacher in multi:
            for row in teacher_rows[teacher]:
                if row.监考1 is None and teacher not in used:
                    row.监考1 = teacher
                    used.add(teacher)
                    teacher_load[teacher] += 1
                    break

        # 阶段2：监考1优先自己班（仅限未达上限）
        for row in rows:
            if row.监考1 is not None:
                continue
            candidates = sorted(
                [t for t in row.任课教师 if t in available and t not in used and under_cap(t)],
                key=sort_key,
            )
            if candidates:
                row.监考1 = candidates[0]
                used.add(candidates[0])
                teacher_load[candidates[0]] += 1

        # 阶段3：剩余监考1从池子补充（优先未达上限）
        pool = sorted(
            [t for t in available if t not in used],
            key=lambda t: (0 if under_cap(t) else 1, sort_key(t)),
        )
        pi = 0
        for row in rows:
            if row.监考1 is not None:
                continue
            if pi < len(pool):
                row.监考1 = pool[pi]
                used.add(pool[pi])
                teacher_load[pool[pi]] += 1
                pi += 1
            else:
                warnings.append(f"时段{time_slot}第{row.index}行无法分配监考1：可用教师不足")

        # 阶段4：监考2优先自己班（仅限未达上限）
        for row in rows:
            if row.监考2 is not None:
                continue
            candidates = sorted(
                [t for t in row.任课教师 if t in available and t not in used and under_cap(t)],
                key=sort_key,
            )
            if candidates:
                row.监考2 = candidates[0]
                used.add(candidates[0])
                teacher_load[candidates[0]] += 1

        # 阶段5：剩余监考2从池子补充（优先未达上限）
        pool2 = sorted(
            [t for t in available if t not in used],
            key=lambda t: (0 if under_cap(t) else 1, sort_key(t)),
        )
        pi = 0
        for row in rows:
            if row.监考2 is not None:
                continue
            if pi < len(pool2):
                row.监考2 = pool2[pi]
                used.add(pool2[pi])
                teacher_load[pool2[pi]] += 1
                pi += 1
            else:
                warnings.append(f"时段{time_slot}第{row.index}行无法分配监考2：可用教师不足")

    return exam_rows, warnings, teacher_load


def validate(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
    mode: str = "strict",
) -> list[dict]:
    """校验分配结果"""
    errors: list[dict] = []

    _, _, excluded = _build_teacher_info(teachers, mode)

    slots: dict[str, list[ExamRow]] = {}
    for row in exam_rows:
        slots.setdefault(row.考试时间, []).append(row)

    for time_slot, rows in slots.items():
        teachers_in_slot: dict[str, list[int]] = {}

        for row in rows:
            for field in ["监考1", "监考2"]:
                teacher = getattr(row, field)
                if not teacher:
                    continue

                if teacher in excluded:
                    errors.append({
                        "row_index": row.index,
                        "field": field,
                        "teacher": teacher,
                        "reason": f"{teacher}被标记为不参加监考",
                    })

                teachers_in_slot.setdefault(teacher, []).append(row.index)

        for teacher, indices in teachers_in_slot.items():
            if len(indices) > 1:
                for idx in indices:
                    row_for_idx = next((r for r in rows if r.index == idx), None)
                    field = "监考1" if row_for_idx and getattr(row_for_idx, "监考1") == teacher else "监考2"
                    errors.append({
                        "row_index": idx,
                        "field": field,
                        "teacher": teacher,
                        "reason": f"同一时段({time_slot})重复出现",
                    })

    return errors
