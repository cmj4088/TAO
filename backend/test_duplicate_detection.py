"""
复现：多轮替换后同时段重复检测遗漏
模拟前端 swap/replace → validate 的完整数据流
"""
import sys, os, copy, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.schemas.app01 import ExamRow, TeacherInfo
from app.services.invigilator import allocate, validate


def make_test_data():
    """创建简单测试数据：2个时段，4场考试，6位老师"""
    exam_rows = [
        ExamRow(index=3, 场次="1", 班级名称="班级A", 教学班级名称="语文", 任课教师=["教师A", "教师B"],
                考试时间="2026-01-20(09:00-10:30)", 考试地点="教室101", 人数="30"),
        ExamRow(index=4, 场次="2", 班级名称="班级B", 教学班级名称="数学", 任课教师=["教师C", "教师D"],
                考试时间="2026-01-20(09:00-10:30)", 考试地点="教室102", 人数="30"),
        ExamRow(index=5, 场次="3", 班级名称="班级C", 教学班级名称="英语", 任课教师=["教师E", "教师F"],
                考试时间="2026-01-20(14:00-15:30)", 考试地点="教室103", 人数="30"),
        ExamRow(index=6, 场次="4", 班级名称="班级D", 教学班级名称="物理", 任课教师=["教师A", "教师C"],
                考试时间="2026-01-20(14:00-15:30)", 考试地点="教室104", 人数="30"),
    ]
    teachers = [
        TeacherInfo(name="教师A", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师B", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师C", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师D", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师E", department="部门C", slots=2, group=""),
        TeacherInfo(name="教师F", department="部门C", slots=2, group=""),
    ]
    return exam_rows, teachers


def simulate_frontend_replace(session_rows, row_index, field, new_teacher):
    """模拟前端 doReplace → 后端 replace → 后端 validate 的完整流程"""
    # 前端：浅拷贝数组，修改目标行
    new_rows = list(session_rows)  # 模拟 [...examRows]
    tgt_row = next((r for r in new_rows if r.index == row_index), None)
    if not tgt_row:
        return session_rows, []
    setattr(tgt_row, field, new_teacher if new_teacher else None)

    # 后端：deepcopy session，修改，保存
    backend_rows = copy.deepcopy(session_rows)
    for r in backend_rows:
        if r.index == row_index:
            setattr(r, field, new_teacher if new_teacher else None)
            break

    # 前端发 validate（用 new_rows）
    teachers = [
        TeacherInfo(name="教师A", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师B", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师C", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师D", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师E", department="部门C", slots=2, group=""),
        TeacherInfo(name="教师F", department="部门C", slots=2, group=""),
    ]
    errors = validate(new_rows, teachers)

    return backend_rows, errors


def simulate_frontend_swap(session_rows, src_idx, src_field, tgt_idx, tgt_field):
    """模拟前端 handleDrop swap → 后端 swap → 后端 validate 的完整流程"""
    # 前端：浅拷贝，交换
    new_rows = list(session_rows)  # 模拟 [...examRows]
    src_row = next((r for r in new_rows if r.index == src_idx), None)
    tgt_row = next((r for r in new_rows if r.index == tgt_idx), None)
    if not src_row or not tgt_row:
        return session_rows, []

    src_val = getattr(src_row, src_field)
    tgt_val = getattr(tgt_row, tgt_field)
    setattr(src_row, src_field, tgt_val)
    setattr(tgt_row, tgt_field, src_val)

    # 后端：deepcopy，交换，保存
    backend_rows = copy.deepcopy(session_rows)
    for r in backend_rows:
        if r.index == src_idx:
            setattr(r, src_field, tgt_val)
        if r.index == tgt_idx:
            setattr(r, tgt_field, src_val)

    teachers = [
        TeacherInfo(name="教师A", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师B", department="部门A", slots=1, group="组A"),
        TeacherInfo(name="教师C", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师D", department="部门B", slots=1, group="组B"),
        TeacherInfo(name="教师E", department="部门C", slots=2, group=""),
        TeacherInfo(name="教师F", department="部门C", slots=2, group=""),
    ]
    errors = validate(new_rows, teachers)

    return backend_rows, errors


def check_duplicates(rows):
    """手动检查同时段重复"""
    slot_map = {}
    for r in rows:
        slot_map.setdefault(r.考试时间, []).append(r)

    dupes = []
    for ts, srows in slot_map.items():
        seen = {}
        for r in srows:
            for f in ["监考1", "监考2"]:
                t = getattr(r, f)
                if t:
                    seen.setdefault(t, []).append((r.index, f))
        for teacher, occurrences in seen.items():
            if len(occurrences) > 1:
                dupes.append((ts, teacher, occurrences))
    return dupes


def main():
    print("=" * 60)
    print("  多轮替换重复检测测试")
    print("=" * 60)

    exam_rows, teachers = make_test_data()

    # Step 1: 分配
    result_rows, warnings, loads = allocate(exam_rows, teachers)
    print("\n[初始分配]")
    for r in result_rows:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")

    dupes = check_duplicates(result_rows)
    print(f"  重复检查: {len(dupes)} 个重复" + (f" ❌ {dupes}" if dupes else " ✓"))

    session = result_rows
    all_passed = True

    # Step 2: 制造一个同时段重复 — 把 Row 4 的监考1 替换成 Row 3 的监考1
    row3_teacher1 = next(r.监考1 for r in session if r.index == 3)
    print(f"\n[操作1] 把 Row 4 监考1 替换为 {row3_teacher1}（与 Row 3 监考1 相同，同时段）")
    session, errors = simulate_frontend_replace(session, 4, "监考1", row3_teacher1)

    p1_dupes = [e for e in errors if e["priority"] == 1 and "重复" in e["reason"]]
    print(f"  P1重复错误数: {len(p1_dupes)}")
    for e in p1_dupes:
        print(f"    - Row {e['row_index']} {e['field']}: {e['reason']}")

    dupes = check_duplicates(session)
    if len(dupes) > 0 and len(p1_dupes) == 0:
        print(f"  ❌ 遗漏！实际有重复但 validate 未检测到: {dupes}")
        all_passed = False
    elif len(dupes) == 0 and len(p1_dupes) > 0:
        print(f"  ❌ 误报！无重复但 validate 报告了错误")
        all_passed = False
    elif len(dupes) > 0 and len(p1_dupes) > 0:
        print(f"  ✓ 正确检测到重复")
    else:
        print(f"  ✓ 无重复")

    # Step 3: 再做一次 swap，把 Row 3 监考2 拖到 Row 6 监考1
    print(f"\n[操作2] Swap: Row 3 监考2 ↔ Row 6 监考1")
    session, errors = simulate_frontend_swap(session, 3, "监考2", 6, "监考1")

    dupes = check_duplicates(session)
    p1_dupes = [e for e in errors if e["priority"] == 1 and "重复" in e["reason"]]
    print(f"  重复检查: 实际={len(dupes)}, validate检测到={len(p1_dupes)}")
    if len(dupes) != len(p1_dupes):
        print(f"  ❌ 不匹配！实际={dupes}, 检测到={p1_dupes}")
        all_passed = False
    else:
        print(f"  ✓ 匹配")

    # Step 4: 多次随机 replace，每次都检查
    print(f"\n[操作3-12] 10轮随机replace压力测试")
    import random
    random.seed(42)

    for i in range(10):
        row_idx = random.choice([r.index for r in session])
        field = random.choice(["监考1", "监考2"])
        old_val = next(getattr(r, field) for r in session if r.index == row_idx)
        available = [t.name for t in teachers]
        new_val = random.choice(available)

        session, errors = simulate_frontend_replace(session, row_idx, field, new_val)
        dupes = check_duplicates(session)
        p1_dupes = [e for e in errors if e["priority"] == 1 and "重复" in e["reason"]]

        if len(dupes) != len(p1_dupes):
            print(f"  ❌ 第{i+1}轮不匹配！Row {row_idx} {field}: {old_val}→{new_val}")
            print(f"     实际重复={dupes}, 检测到={p1_dupes}")
            all_passed = False
        else:
            print(f"  ✓ 第{i+1}轮 OK (重复={len(dupes)})")

    # Step 5: 模拟快速连续操作（前端 closure 可能 stale）
    print(f"\n[操作13] 模拟快速连续替换（同一时段制造重复）")
    # 重置
    exam_rows, teachers = make_test_data()
    session, _, _ = allocate(exam_rows, teachers)

    # 模拟前端：两次 replace 使用同一个 "stale" examRows
    stale_rows = list(session)  # 模拟 closure 中的 examRows

    # 第一次修改：Row 3 监考1 → 教师E
    tgt = next(r for r in stale_rows if r.index == 3)
    tgt.监考1 = "教师E"

    # 第二次修改：Row 4 监考1 → 教师E（同时段！）—— 但基于 stale_rows
    tgt2 = next(r for r in stale_rows if r.index == 4)
    tgt2.监考1 = "教师E"

    # stale_rows 现在包含两次修改（因为对象是共享引用）
    errors = validate(stale_rows, teachers)
    dupes = check_duplicates(stale_rows)
    p1_dupes = [e for e in errors if e["priority"] == 1 and "重复" in e["reason"]]

    print(f"  stale_rows 状态:")
    for r in stale_rows:
        print(f"    Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    print(f"  实际重复={dupes}, validate检测到={p1_dupes}")
    if len(dupes) != len(p1_dupes):
        print(f"  ❌ 遗漏！")
        all_passed = False
    else:
        print(f"  ✓ 正确")

    # Step 6: 模拟前端用旧数组引用但对象已突变
    print(f"\n[操作14] 模拟 React 批量更新：多个 setExamRows 合并后验证")
    exam_rows, teachers = make_test_data()
    session, _, _ = allocate(exam_rows, teachers)

    # 模拟：操作1修改后，操作2在 re-render 前开始，使用旧的数组引用
    old_array_ref = list(session)  # 旧引用

    # 操作1：修改 session
    session2, _ = simulate_frontend_replace(session, 3, "监考1", "教师E")

    # 操作2：基于 old_array_ref（但对象已被操作1的浅拷贝修改！）
    # 在 React 中，[...oldExamRows] 用的是旧数组，但对象已被前一次操作修改
    new_rows_from_old = list(old_array_ref)
    # 再修改 Row 4
    tgt = next(r for r in new_rows_from_old if r.index == 4)
    tgt.监考1 = "教师E"

    print(f"  old_array_ref 状态（被操作1间接修改+操作2修改）:")
    for r in old_array_ref:
        print(f"    Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")

    errors = validate(new_rows_from_old, teachers)
    dupes = check_duplicates(new_rows_from_old)
    p1_dupes = [e for e in errors if e["priority"] == 1 and "重复" in e["reason"]]

    if len(dupes) != len(p1_dupes):
        print(f"  ❌ 遗漏！实际重复={dupes}, 检测到={p1_dupes}")
        all_passed = False
    else:
        print(f"  ✓ 正确 (重复={len(dupes)})")

    # 总结
    print("\n" + "=" * 60)
    if all_passed:
        print("  全部通过 ✓")
    else:
        print("  存在遗漏 ❌")
    print("=" * 60)
    return all_passed


if __name__ == "__main__":
    main()
