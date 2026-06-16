"""监考分配核心算法"""

from app.schemas.app01 import ExamRow, TeacherInfo


def allocate(exam_rows: list[ExamRow], teachers: list[TeacherInfo]) -> tuple[list[ExamRow], list[str]]:
    """执行监考分配，返回 (分配后的考试行列表, 警告列表)"""

    # 收集可用教师（排除所有标记含"不参加监考"的）
    available: set[str] = set()
    for t in teachers:
        excluded = any("不参加监考" in tag for tag in t.tags)
        if not excluded:
            available.add(t.name)

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

        # 阶段1：一师多班 → 优先安排监考1到自己其中一个班
        for teacher, t_rows in teacher_rows.items():
            if len(t_rows) <= 1:
                continue
            for row in t_rows:
                if row.监考1 is None and teacher not in used:
                    row.监考1 = teacher
                    used.add(teacher)
                    break

        # 阶段2：填充监考1（优先自己班的老师）
        for row in rows:
            if row.监考1 is not None:
                continue
            for t in row.任课教师:
                if t in available and t not in used:
                    row.监考1 = t
                    used.add(t)
                    break

        # 阶段3：剩余监考1从教师池补充
        pool = sorted(t for t in available if t not in used)
        pi = 0
        for row in rows:
            if row.监考1 is not None:
                continue
            if pi < len(pool):
                row.监考1 = pool[pi]
                used.add(pool[pi])
                pi += 1
            else:
                warnings.append(f"时段{time_slot}第{row.index}行无法分配监考1：可用教师不足")

        # 阶段4：填充监考2（优先自己班的老师）
        for row in rows:
            if row.监考2 is not None:
                continue
            for t in row.任课教师:
                if t in available and t not in used:
                    row.监考2 = t
                    used.add(t)
                    break

        # 阶段5：剩余监考2从教师池补充
        pool2 = sorted(t for t in available if t not in used)
        pi = 0
        for row in rows:
            if row.监考2 is not None:
                continue
            if pi < len(pool2):
                row.监考2 = pool2[pi]
                used.add(pool2[pi])
                pi += 1
            else:
                warnings.append(f"时段{time_slot}第{row.index}行无法分配监考2：可用教师不足")

    return exam_rows, warnings


def validate(exam_rows: list[ExamRow], teachers: list[TeacherInfo]) -> list[dict]:
    """校验分配结果，返回违规项列表"""
    errors: list[dict] = []

    # 教师排除规则
    excluded_all = set()
    excluded_dates: dict[str, set[str]] = {}
    for t in teachers:
        if "领导不参加监考" in t.tags or "行政人员不参加监考" in t.tags:
            excluded_all.add(t.name)
        if "当天不参加监考" in t.tags:
            excluded_all.add(t.name)

    # 按时间段分组检查重复
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

                # 检查是否被排除
                if teacher in excluded_all:
                    errors.append({
                        "row_index": row.index,
                        "field": field,
                        "teacher": teacher,
                        "reason": f"{teacher}被标记为不参加监考",
                    })

                # 检查同一时段重复
                teachers_in_slot.setdefault(teacher, []).append(row.index)

        for teacher, indices in teachers_in_slot.items():
            if len(indices) > 1:
                for idx in indices:
                    errors.append({
                        "row_index": idx,
                        "field": "监考1" if any(
                            getattr(r, "监考1") == teacher
                            for r in rows
                            if r.index == idx
                        ) else "监考2",
                        "teacher": teacher,
                        "reason": f"同一时段({time_slot})重复出现",
                    })

        # 检查教师是否监考了自己的班级（提醒级别）
        for row in rows:
            for field in ["监考1", "监考2"]:
                teacher = getattr(row, field)
                if teacher and teacher in row.任课教师:
                    pass  # 正确：监考了自己的班
                elif teacher and teacher not in excluded_all:
                    # 检查该教师是否在本时段有任教班级但没被安排监考
                    pass  # 这在分配阶段已经尽力了，不报错

    return errors
