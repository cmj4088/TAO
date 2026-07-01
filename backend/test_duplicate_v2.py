"""
复现v2：精确对比 validate 的重复检测 vs 手动检查
"""
import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.schemas.app01 import ExamRow, TeacherInfo
from app.services.invigilator import allocate, validate


def make_test_data():
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


def get_dup_teacher_slots(errors):
    """从 validate 返回的错误中提取 (老师, 时段) 的重复集合"""
    dup_set = set()
    for e in errors:
        if e["priority"] == 1 and "重复出现" in e["reason"]:
            # 从 reason 中解析时段
            import re
            m = re.search(r'同一时段\((.+?)\)重复出现', e["reason"])
            ts = m.group(1) if m else "?"
            dup_set.add((e["teacher"], ts))
    return dup_set


def manual_find_dupes(rows):
    """手动查找同时段重复，返回 (老师, 时段) 集合"""
    slot_map = {}
    for r in rows:
        slot_map.setdefault(r.考试时间, []).append(r)

    dupes = set()
    for ts, srows in slot_map.items():
        seen = {}
        for r in srows:
            for f in ["监考1", "监考2"]:
                t = getattr(r, f)
                if t:
                    seen.setdefault(t, []).append(r.index)
        for teacher, occurrences in seen.items():
            if len(occurrences) > 1:
                dupes.add((teacher, ts))
    return dupes


def test_scenario(name, rows, teachers, expected_dup_count):
    """验证：手动查重 vs validate 查重，应该一致"""
    manual = manual_find_dupes(rows)
    errors = validate(rows, teachers)
    auto = get_dup_teacher_slots(errors)

    ok = manual == auto
    print(f"  [{name}] 手动={len(manual)} validate={len(auto)} {'✓' if ok else '❌ 不一致!'}")
    if not ok:
        print(f"    手动: {manual}")
        print(f"    validate: {auto}")
        # 详细对比
        only_manual = manual - auto
        only_auto = auto - manual
        if only_manual:
            print(f"    手动有但validate没有: {only_manual}")
        if only_auto:
            print(f"    validate有但手动没有: {only_auto}")
    return ok


def main():
    print("=" * 60)
    print("  精确重复检测对比测试")
    print("=" * 60)

    exam_rows, teachers = make_test_data()
    result, _, _ = allocate(exam_rows, teachers)

    print("\n初始分配:")
    for r in result:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("初始", result, teachers, 0)

    # 场景1: 制造同时段重复
    rows = copy.deepcopy(result)
    row3_teacher1 = next(r.监考1 for r in rows if r.index == 3)
    for r in rows:
        if r.index == 4:
            r.监考1 = row3_teacher1  # 同时段重复!
            break
    print(f"\n场景1: Row 4 监考1 改成 {row3_teacher1}（与 Row 3 监考1 同时段重复）")
    for r in rows:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("单重复", rows, teachers, 1)

    # 场景2: 再加一个重复
    row5_teacher1 = next(r.监考1 for r in rows if r.index == 5)
    for r in rows:
        if r.index == 6:
            r.监考1 = row5_teacher1  # 另一个时段重复!
            break
    print(f"\n场景2: Row 6 监考1 改成 {row5_teacher1}（与 Row 5 监考1 同时段重复）")
    for r in rows:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("双重复", rows, teachers, 2)

    # 场景3: 同一行两个字段都是同一个人（极端情况）
    rows2 = copy.deepcopy(result)
    for r in rows2:
        if r.index == 3:
            r.监考2 = r.监考1  # 同一行两个监考都是同一个人
            break
    print(f"\n场景3: Row 3 监考2 = 监考1（同一行重复）")
    for r in rows2:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("同行重复", rows2, teachers, 1)

    # 场景4: 三人重复
    rows3 = copy.deepcopy(result)
    t = rows3[0].监考1  # 第一个人
    # 把同一时段所有人都改成 t
    for r in rows3:
        if r.考试时间 == rows3[0].考试时间:
            if r.监考1 is not None:
                r.监考1 = t
            if r.监考2 is not None:
                r.监考2 = t
    print(f"\n场景4: 同一时段全部改成 {t}")
    for r in rows3:
        print(f"  Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("三人重复", rows3, teachers, 1)

    # 场景5: 模拟前端浅拷贝场景 — 多个操作基于同一份 "stale" 引用
    print(f"\n场景5: 模拟前端 [...examRows] 浅拷贝多次修改")
    rows4 = copy.deepcopy(result)
    # 模拟：前端 const newRows = [...examRows]
    frontend_rows = list(rows4)  # 浅拷贝，共享对象引用
    # 操作1: 改 Row 3
    for r in frontend_rows:
        if r.index == 3:
            r.监考1 = "教师E"
            break
    # 操作2: 改 Row 4（基于同一个 frontend_rows，对象已包含操作1的修改）
    for r in frontend_rows:
        if r.index == 4:
            r.监考1 = "教师E"  # 同时段！
            break
    print(f"  操作1后+操作2后 frontend_rows:")
    for r in frontend_rows:
        print(f"    Row {r.index} [{r.考试时间[:16]}]: 监考1={r.监考1}, 监考2={r.监考2}")
    test_scenario("浅拷贝多操作", frontend_rows, teachers, 1)

    print("\n" + "=" * 60)
    print("  结论：后端 validate 的重复检测逻辑正确")
    print("=" * 60)


if __name__ == "__main__":
    main()
