"""
APP1 监考分配算法 — 全方位压力测试 v2
变化参数：考试数、时段数、老师数、分组模式、场次分布、任课关系
支持多轮随机种子测试
"""
import sys, os, random, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.schemas.app01 import ExamRow, TeacherInfo
from app.services.invigilator import allocate


def make_exam_rows(exam_count: int, time_slots: list[str],
                   teachers: list[str]) -> list[ExamRow]:
    rows = []
    for i in range(exam_count):
        ts = time_slots[i % len(time_slots)]
        n_t = random.randint(1, 2)
        exam_teachers = random.sample(teachers, min(n_t, len(teachers)))
        rows.append(ExamRow(
            index=i,
            场次=str(i + 1),
            班级名称=f"班级{i % 10 + 1}",
            教学班级名称=f"课程{chr(65 + i % 8)}",
            任课教师=exam_teachers,
            考试时间=ts,
            考试地点=f"教室{100 + i}",
            人数=str(random.randint(20, 60)),
        ))
    return rows


def is_config_possible(exam_count: int, time_slot_count: int,
                       teacher_count: int, slot_counts: list[int]) -> bool:
    """检查配置是否数学上可能"""
    # 单时段最大需要老师数 <= 总老师数
    max_exams_per_slot = max(1, (exam_count + time_slot_count - 1) // time_slot_count)
    if max_exams_per_slot * 2 > teacher_count:
        return False
    # 每人场次不超过时段数
    if any(s > time_slot_count for s in slot_counts):
        return False
    # 总场次匹配
    if sum(slot_counts) != exam_count * 2:
        return False
    return True


def test_one_config(name: str, exam_count: int, time_slot_count: int,
                    teacher_count: int, group_config: str = "none",
                    seed_override: int | None = None) -> dict:
    if seed_override is not None:
        random.seed(seed_override)

    time_slots = [f"Day{d+1}-Slot{s}" for d in range(min(time_slot_count, 7))
                  for s in range(1, 3)][:time_slot_count]
    # 考试数可能小于时段数时截断
    if exam_count < len(time_slots):
        time_slots = time_slots[:exam_count]
        time_slot_count = len(time_slots)

    teacher_names = [f"教师{i+1:03d}" for i in range(teacher_count)]
    total_needed = exam_count * 2

    # 分配场次
    base = total_needed // teacher_count
    remainder = total_needed % teacher_count
    slot_counts = [base] * teacher_count
    extra_indices = random.sample(range(teacher_count), remainder)
    for idx in extra_indices:
        slot_counts[idx] += 1

    # 随机微调
    for _ in range(max(1, teacher_count // 5)):
        i = random.randint(0, teacher_count - 1)
        j = random.randint(0, teacher_count - 1)
        if i != j and slot_counts[i] >= 2:
            slot_counts[i] -= 1
            slot_counts[j] += 1

    # 修复：确保没人超过时段数
    for i, sc in enumerate(slot_counts):
        if sc > time_slot_count:
            excess = sc - time_slot_count
            slot_counts[i] = time_slot_count
            for j in range(teacher_count):
                if excess <= 0:
                    break
                if j != i and slot_counts[j] < time_slot_count:
                    take = min(excess, time_slot_count - slot_counts[j])
                    slot_counts[j] += take
                    excess -= take

    # 分组
    groups = {}
    if group_config == "pairs":
        for i in range(0, teacher_count - 1, 2):
            gname = f"组{chr(65 + i // 2)}"
            groups[teacher_names[i]] = gname
            groups[teacher_names[i + 1]] = gname
    elif group_config == "triplets":
        for i in range(0, teacher_count - 2, 3):
            gname = f"组{chr(65 + i // 3)}"
            groups[teacher_names[i]] = gname
            groups[teacher_names[i + 1]] = gname
            groups[teacher_names[i + 2]] = gname
    elif group_config == "mixed":
        idx = 0
        gid = 0
        while idx < teacher_count:
            size = random.choice([2, 2, 3, 1])
            if size == 1:
                idx += 1
                continue
            if idx + size > teacher_count:
                break
            gname = f"组{chr(65 + gid)}"
            for k in range(size):
                groups[teacher_names[idx + k]] = gname
            idx += size
            gid += 1

    # 合法性检查
    if not is_config_possible(exam_count, time_slot_count, teacher_count, slot_counts):
        return {
            "name": name, "exam_count": exam_count,
            "time_slot_count": time_slot_count, "teacher_count": teacher_count,
            "total_needed": total_needed,
            "group_config": group_config, "group_count": len(set(groups.values())),
            "status": "SKIP", "error": "数学上不可能的配置",
            "P1_errors": 0, "P2_errors": 0, "P3_warnings": 0,
            "empty_slots": 0, "duplicates": 0, "slot_mismatch": 0,
            "warnings": 0, "elapsed": 0,
        }

    # 生成考试
    exam_rows = make_exam_rows(exam_count, time_slots, teacher_names)
    teachers = [TeacherInfo(
        name=n, department=f"部门{chr(65 + i % 4)}",
        slots=slot_counts[i], group=groups.get(n, "")
    ) for i, n in enumerate(teacher_names)]

    # 运行分配
    start = time.time()
    try:
        result_rows, warnings, loads = allocate(exam_rows, teachers, skip_ai=True)
        elapsed = time.time() - start
    except Exception as e:
        return {
            "name": name, "exam_count": exam_count,
            "time_slot_count": time_slot_count, "teacher_count": teacher_count,
            "total_needed": total_needed,
            "group_config": group_config, "group_count": len(set(groups.values())),
            "status": "EXCEPTION", "error": str(e), "elapsed": 0,
        }

    # 审查
    from app.services.invigilator import validate
    errors = validate(result_rows, teachers)

    p1 = [e for e in errors if e["priority"] == 1]
    p2 = [e for e in errors if e["priority"] == 2]
    p3 = [e for e in errors if e["priority"] == 3]
    empty = sum(1 for r in result_rows if r.监考1 is None or r.监考2 is None)

    # 重复检查
    dup_count = 0
    slot_rows = {}
    for r in result_rows:
        slot_rows.setdefault(r.考试时间, []).append(r)
    for ts, srows in slot_rows.items():
        seen = {}
        for r in srows:
            for f in ["监考1", "监考2"]:
                t = getattr(r, f)
                if t:
                    seen[t] = seen.get(t, 0) + 1
        dup_count += sum(1 for v in seen.values() if v > 1)

    # 场次统计
    load_map = {}
    for r in result_rows:
        if r.监考1:
            load_map[r.监考1] = load_map.get(r.监考1, 0) + 1
        if r.监考2:
            load_map[r.监考2] = load_map.get(r.监考2, 0) + 1
    slot_mismatch = sum(1 for t in teachers if load_map.get(t.name, 0) != t.slots)

    ok = len(p1) == 0 and len(p2) == 0 and empty == 0 and slot_mismatch == 0
    return {
        "name": name, "exam_count": exam_count,
        "time_slot_count": time_slot_count, "teacher_count": teacher_count,
        "total_needed": total_needed,
        "group_config": group_config, "group_count": len(set(groups.values())),
        "status": "OK" if ok else "FAIL",
        "P1_errors": len(p1), "P2_errors": len(p2), "P3_warnings": len(p3),
        "empty_slots": empty, "duplicates": dup_count,
        "slot_mismatch": slot_mismatch,
        "warnings": len(warnings),
        "elapsed": round(elapsed, 3),
    }


def run_multi_round(configs: list[dict], rounds: int = 5) -> dict:
    """多轮测试，每轮不同随机种子"""
    all_results = []
    total_pass = 0
    total_fail = 0
    total_skip = 0
    total_excp = 0

    for rnd in range(rounds):
        seed = 42 + rnd * 137
        random.seed(seed)

        round_pass = 0
        round_fail = 0
        round_skip = 0
        round_excp = 0

        for cfg in configs:
            cfg_copy = dict(cfg)
            name = cfg_copy.pop("name")
            result = test_one_config(f"[R{rnd+1}] {name}", seed_override=seed, **cfg_copy)
            all_results.append(result)

            if result["status"] == "OK":
                round_pass += 1
            elif result["status"] == "FAIL":
                round_fail += 1
            elif result["status"] == "SKIP":
                round_skip += 1
            else:
                round_excp += 1

        total_pass += round_pass
        total_fail += round_fail
        total_skip += round_skip
        total_excp += round_excp

        print(f"  Round {rnd+1}: pass={round_pass} fail={round_fail} "
              f"skip={round_skip} excp={round_excp}")

    return {
        "all_results": all_results,
        "total_pass": total_pass, "total_fail": total_fail,
        "total_skip": total_skip, "total_excp": total_excp,
        "total_configs": len(configs) * rounds,
    }


def build_configs() -> list[dict]:
    """构建测试配置 — 只包含合法的"""
    return [
        # === 小型 ===
        {"name": "微型-8考3时段6师", "exam_count": 8, "time_slot_count": 3, "teacher_count": 6},
        {"name": "微型-10考4时段8师", "exam_count": 10, "time_slot_count": 4, "teacher_count": 8},
        {"name": "微型-10考4时段8师-2人组", "exam_count": 10, "time_slot_count": 4, "teacher_count": 8, "group_config": "pairs"},
        {"name": "微型-12考4时段10师-混合分组", "exam_count": 12, "time_slot_count": 4, "teacher_count": 10, "group_config": "mixed"},

        # === 中型 ===
        {"name": "中型-50考10时段30师", "exam_count": 50, "time_slot_count": 10, "teacher_count": 30},
        {"name": "中型-50考10时段30师-2人组", "exam_count": 50, "time_slot_count": 10, "teacher_count": 30, "group_config": "pairs"},
        {"name": "中型-60考12时段40师", "exam_count": 60, "time_slot_count": 12, "teacher_count": 40},
        {"name": "中型-60考12时段40师-3人组", "exam_count": 60, "time_slot_count": 12, "teacher_count": 40, "group_config": "triplets"},
        {"name": "中型-80考15时段50师-混合分组", "exam_count": 80, "time_slot_count": 15, "teacher_count": 50, "group_config": "mixed"},

        # === 大型 ===
        {"name": "大型-120考20时段60师", "exam_count": 120, "time_slot_count": 20, "teacher_count": 60},
        {"name": "大型-120考20时段60师-2人组", "exam_count": 120, "time_slot_count": 20, "teacher_count": 60, "group_config": "pairs"},
        {"name": "大型-150考25时段80师-混合分组", "exam_count": 150, "time_slot_count": 25, "teacher_count": 80, "group_config": "mixed"},

        # === 极端 ===
        {"name": "极端-每时段1考-10时段10考5师", "exam_count": 10, "time_slot_count": 10, "teacher_count": 5},
        {"name": "极端-每时段1考-10时段10考5师-2人组", "exam_count": 10, "time_slot_count": 10, "teacher_count": 5, "group_config": "pairs"},
        {"name": "极端-多时段少考-3考5时段3师", "exam_count": 3, "time_slot_count": 5, "teacher_count": 3},
        {"name": "极端-超多考-200考30时段100师", "exam_count": 200, "time_slot_count": 30, "teacher_count": 100},
        {"name": "极端-超多考-200考30时段100师-混合分组", "exam_count": 200, "time_slot_count": 30, "teacher_count": 100, "group_config": "mixed"},

        # === 不均匀 ===
        {"name": "不均-时段考试数差异大-30考8时段20师", "exam_count": 30, "time_slot_count": 8, "teacher_count": 20},
        {"name": "不均-教师场次差异大-40考8时段25师", "exam_count": 40, "time_slot_count": 8, "teacher_count": 25},

        # === 分组压力 ===
        {"name": "分组-全2人组-40考10时段30师", "exam_count": 40, "time_slot_count": 10, "teacher_count": 30, "group_config": "pairs"},
        {"name": "分组-全3人组-45考12时段30师", "exam_count": 45, "time_slot_count": 12, "teacher_count": 30, "group_config": "triplets"},
        {"name": "分组-大混合-60考15时段45师", "exam_count": 60, "time_slot_count": 15, "teacher_count": 45, "group_config": "mixed"},

        # === 紧凑 ===
        {"name": "紧凑-教师刚好-20考5时段10师", "exam_count": 20, "time_slot_count": 5, "teacher_count": 10},
        {"name": "紧凑-教师刚好-30考8时段15师-2人组", "exam_count": 30, "time_slot_count": 8, "teacher_count": 15, "group_config": "pairs"},

        # === 真实模拟 ===
        {"name": "真实模拟-67考13时段42师", "exam_count": 67, "time_slot_count": 13, "teacher_count": 42},
        {"name": "真实模拟-67考13时段42师-混合分组", "exam_count": 67, "time_slot_count": 13, "teacher_count": 42, "group_config": "mixed"},

        # === 新增：变化考次分布 ===
        {"name": "分布-均匀-36考6时段18师", "exam_count": 36, "time_slot_count": 6, "teacher_count": 18},
        {"name": "分布-偏斜-25考5时段20师-2人组", "exam_count": 25, "time_slot_count": 5, "teacher_count": 20, "group_config": "pairs"},
        {"name": "分布-多考少师-100考20时段55师", "exam_count": 100, "time_slot_count": 20, "teacher_count": 55},

        # === 新增：奇数配置 ===
        {"name": "奇数-7考3时段5师", "exam_count": 7, "time_slot_count": 3, "teacher_count": 5},
        {"name": "奇数-13考5时段9师-2人组", "exam_count": 13, "time_slot_count": 5, "teacher_count": 9, "group_config": "pairs"},
        {"name": "奇数-17考6时段11师-3人组", "exam_count": 17, "time_slot_count": 6, "teacher_count": 11, "group_config": "triplets"},
    ]


def main():
    configs = build_configs()
    rounds = 3  # 3轮不同随机种子

    print("=" * 70)
    print("  APP1 监考分配算法 — 全方位压力测试 v2")
    print("=" * 70)
    print(f"  配置数: {len(configs)}")
    print(f"  轮数: {rounds}")
    print(f"  总测试数: {len(configs) * rounds}")
    print()

    summary = run_multi_round(configs, rounds)

    # 汇总
    total = summary["total_configs"]
    effective = total - summary["total_skip"]
    print()
    print("=" * 70)
    print(f"  总结果: 通过 {summary['total_pass']}/{effective}, "
          f"失败 {summary['total_fail']}/{effective}, "
          f"跳过 {summary['total_skip']}/{total}, "
          f"异常 {summary['total_excp']}/{total}")
    if effective > 0:
        print(f"  通过率: {summary['total_pass'] / effective * 100:.1f}%")
    print("=" * 70)

    # 失败详情
    failures = [r for r in summary["all_results"] if r["status"] == "FAIL"]
    excps = [r for r in summary["all_results"] if r["status"] == "EXCEPTION"]

    if failures:
        print(f"\n失败 ({len(failures)}):")
        for r in failures:
            print(f"  - {r['name']}: P1={r['P1_errors']} P2={r['P2_errors']} "
                  f"空位={r['empty_slots']} 场次不匹配={r['slot_mismatch']}")

    if excps:
        print(f"\n异常 ({len(excps)}):")
        for r in excps:
            print(f"  - {r['name']}: {r['error']}")

    return summary


if __name__ == "__main__":
    main()
