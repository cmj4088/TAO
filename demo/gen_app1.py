# -*- coding: utf-8 -*-
"""基于真实数据生成3组APP1示范文件"""
import os
import shutil
import openpyxl
from openpyxl.utils import get_column_letter
from copy import copy

DEMO = r"C:\Users\32277\Desktop\TAO\demo\APP1-示范"
SRC_EXAM = r"C:\Users\32277\Desktop\TAO\docs\app01.file\附件1-1：25-26（1）考试课程期末考试安排表（原始）.xlsx"

# ============================================================
# Step 1: 从原始xlsx提取AI学院38场考试
# ============================================================
wb = openpyxl.load_workbook(SRC_EXAM)
ws = wb.active

# 收集AI学院的考试行
ai_rows = []
for row in ws.iter_rows(min_row=3, max_row=ws.max_row):
    college = str(row[4].value or '').strip()
    if '人工智能' in college:
        ai_rows.append(row)

print(f"提取到 {len(ai_rows)} 场AI学院考试")

# ============================================================
# Step 2: 复制考试安排表到3个组目录（只保留AI学院部分）
# ============================================================
def copy_exam_schedule(dest_dir, folder_name):
    """复制考试安排表，只保留AI学院部分"""
    os.makedirs(dest_dir, exist_ok=True)

    wb_new = openpyxl.Workbook()
    ws_new = wb_new.active
    ws_new.title = "考试安排"

    # Row 1: title
    ws_new.merge_cells('A1:K1')
    c = ws_new.cell(1, 1, f"25-26（1）期末考试安排表 — {folder_name}")
    c.font = copy(ws.cell(1, 1).font) if ws.cell(1, 1).font else openpyxl.styles.Font(bold=True, size=14)
    c.alignment = openpyxl.styles.Alignment(horizontal='center')

    # Row 2: headers (simplified to match what app01 parser expects)
    headers = ['序号', '场次', '', '', '', '班级名称', '教学班级名称', '任课教师', '考试时间', '考试地点', '人数', '', '监考1', '', '监考2']
    for i, h in enumerate(headers, 1):
        c = ws_new.cell(2, i, h)
        c.font = openpyxl.styles.Font(bold=True, size=11)
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center', wrap_text=True)

    # Data rows
    for idx, src_row in enumerate(ai_rows):
        row_num = idx + 3
        # Col A: 序号
        ws_new.cell(row_num, 1, idx + 1)
        # Col B: 场次 (session from Col3 of source)
        ws_new.cell(row_num, 2, src_row[2].value)
        # Col F: 班级名称 (Col7 of source)
        ws_new.cell(row_num, 6, src_row[6].value)
        # Col G: 教学班级名称 (Col7 of source)
        ws_new.cell(row_num, 7, src_row[6].value)
        # Col H: 任课教师 (Col9 of source)
        ws_new.cell(row_num, 8, src_row[8].value)
        # Col I: 考试时间 (Col10 of source)
        ws_new.cell(row_num, 9, src_row[9].value)
        # Col J: 考试地点 (Col11 of source)
        ws_new.cell(row_num, 10, src_row[10].value)
        # Col K: 人数 (Col12 of source)
        ws_new.cell(row_num, 11, src_row[11].value)
        # Col M: 监考1 (empty)
        # Col O: 监考2 (empty)

    # Column widths
    widths = [6, 10, 5, 5, 5, 28, 24, 20, 26, 22, 8, 5, 8, 5, 8]
    for i, w in enumerate(widths, 1):
        ws_new.column_dimensions[get_column_letter(i)].width = w

    path = os.path.join(dest_dir, "考试安排表.xlsx")
    wb_new.save(path)
    print(f"  考试安排表已创建: {path}")


def create_contact_list(dest_dir, title, teachers):
    """teachers: list of (岗位, 姓名, 安排场次, 分组)"""
    os.makedirs(dest_dir, exist_ok=True)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "通讯录"

    # Row 1: title
    ws.merge_cells('A1:D1')
    c = ws.cell(1, 1, title)
    c.font = openpyxl.styles.Font(bold=True, size=14)
    c.alignment = openpyxl.styles.Alignment(horizontal='center')

    # Row 2: headers
    headers = ['岗位', '姓名', '安排场次', '分组']
    for i, h in enumerate(headers, 1):
        c = ws.cell(2, i, h)
        c.font = openpyxl.styles.Font(bold=True, size=11)
        c.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

    # Data rows
    for idx, (dept, name, slots, group) in enumerate(teachers):
        row = idx + 3
        ws.cell(row, 1, dept)
        ws.cell(row, 2, name)
        ws.cell(row, 3, slots)
        ws.cell(row, 4, group)

    # Column widths
    for i, w in enumerate([24, 8, 8, 8], 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    path = os.path.join(dest_dir, "通讯录.xlsx")
    wb.save(path)
    print(f"  通讯录已创建: {path}")

    # Verify
    total = sum(t[2] for t in teachers)
    print(f"  总场次: {total} (需76)")
    return total


# ============================================================
# 组1: 标准场景 — 无分组，均匀分配
# ============================================================
print("\n=== 组1: 标准场景 ===")
d1 = os.path.join(DEMO, "组1-标准场景")
copy_exam_schedule(d1, "标准场景")

# 76个监考位 / 28人 → 20人×3场 + 8人×2场 = 60+16=76
teachers1 = [
    # 大数据技术专业教研室
    ("大数据技术专业教研室", "蒋丰泽", 3, ""),
    ("大数据技术专业教研室", "刘含波", 3, ""),
    ("大数据技术专业教研室", "冯敢", 3, ""),
    ("大数据技术专业教研室", "梁月仙", 3, ""),
    ("大数据技术专业教研室", "黄国伟", 2, ""),
    ("大数据技术专业教研室", "高维春", 3, ""),
    ("大数据技术专业教研室", "白雪峰", 3, ""),
    ("大数据技术专业教研室", "耿煜", 2, ""),
    ("大数据技术专业教研室", "张俊鹏", 3, ""),
    ("大数据技术专业教研室", "谢天明", 3, ""),
    # 云计算技术应用专业教研室
    ("云计算技术应用专业教研室", "孔令晶", 3, ""),
    ("云计算技术应用专业教研室", "周莹", 2, ""),
    ("云计算技术应用专业教研室", "魏莲", 3, ""),
    ("云计算技术应用专业教研室", "黄瑾瑜", 3, ""),
    ("云计算技术应用专业教研室", "彭刚", 2, ""),
    ("云计算技术应用专业教研室", "郭明雪", 2, ""),
    ("云计算技术应用专业教研室", "夏飞", 2, ""),
    # 人工智能技术应用专业教研室
    ("人工智能技术应用专业教研室", "曹维", 3, ""),
    ("人工智能技术应用专业教研室", "盛建强", 3, ""),
    ("人工智能技术应用专业教研室", "陈康", 3, ""),
    ("人工智能技术应用专业教研室", "刘振", 3, ""),
    ("人工智能技术应用专业教研室", "冯昊港", 2, ""),
    ("人工智能技术应用专业教研室", "刘泳", 3, ""),
    # 教务/学生/实训/产教融合
    ("教务办公室", "景弘泽", 3, ""),
    ("学生办", "武艳艳", 3, ""),
    ("学生办", "聂子凡", 3, ""),
    ("产教融合办公室", "洪莹莹", 2, ""),
    ("大数据与智能系统研究所", "钟建奇", 3, ""),
]
create_contact_list(d1, "人工智能学院通讯录 — 标准场景", teachers1)

# ============================================================
# 组2: 分组场景 — A/B/C/D/E五组搭档
# ============================================================
print("\n=== 组2: 分组场景 ===")
d2 = os.path.join(DEMO, "组2-分组场景")
copy_exam_schedule(d2, "分组场景")

# 10人在5组(每组2人)，其余无分组
# A组: 2人×3场, B组: 2人×3场, C组: 2人×3场, D组: 2人×2场, E组: 2人×2场
# 分组小计: 6×3 + 4×2 = 26
# 剩余50场 / 18人 ≈ 2.8 → 14人×3 + 4人×2 = 42+8=50
teachers2 = [
    # === 分组老师 ===
    ("大数据技术专业教研室", "蒋丰泽", 3, "A"),
    ("大数据技术专业教研室", "刘含波", 3, "A"),
    ("云计算技术应用专业教研室", "孔令晶", 3, "B"),
    ("云计算技术应用专业教研室", "黄瑾瑜", 3, "B"),
    ("人工智能技术应用专业教研室", "曹维", 3, "C"),
    ("人工智能技术应用专业教研室", "盛建强", 3, "C"),
    ("大数据技术专业教研室", "高维春", 2, "D"),
    ("大数据技术专业教研室", "白雪峰", 2, "D"),
    ("学生办", "武艳艳", 2, "E"),
    ("学生办", "聂子凡", 2, "E"),
    # === 无分组老师 ===
    ("大数据技术专业教研室", "冯敢", 3, ""),
    ("大数据技术专业教研室", "梁月仙", 3, ""),
    ("大数据技术专业教研室", "黄国伟", 2, ""),
    ("大数据技术专业教研室", "耿煜", 3, ""),
    ("大数据技术专业教研室", "张俊鹏", 3, ""),
    ("大数据技术专业教研室", "谢天明", 3, ""),
    ("云计算技术应用专业教研室", "周莹", 2, ""),
    ("云计算技术应用专业教研室", "魏莲", 3, ""),
    ("云计算技术应用专业教研室", "彭刚", 3, ""),
    ("云计算技术应用专业教研室", "郭明雪", 2, ""),
    ("云计算技术应用专业教研室", "夏飞", 2, ""),
    ("人工智能技术应用专业教研室", "陈康", 3, ""),
    ("人工智能技术应用专业教研室", "刘振", 3, ""),
    ("人工智能技术应用专业教研室", "冯昊港", 3, ""),
    ("人工智能技术应用专业教研室", "刘泳", 3, ""),
    ("教务办公室", "景弘泽", 3, ""),
    ("产教融合办公室", "洪莹莹", 3, ""),
    ("大数据与智能系统研究所", "钟建奇", 3, ""),
]
create_contact_list(d2, "人工智能学院通讯录 — 分组场景", teachers2)

# ============================================================
# 组3: 复杂场景 — 混合分组+不均衡场次+边界情况
# ============================================================
print("\n=== 组3: 复杂场景 ===")
d3 = os.path.join(DEMO, "组3-复杂场景")
copy_exam_schedule(d3, "复杂场景")

# 设计要点:
# - A组(2人×4场): 场次偏多，测试高负载分组
# - B组(3人×3场): 奇数人组，测试非2人组
# - C组(2人×2场): 场次偏少
# - 无分组老师: 场次2-5不等，测试不均衡
# 分组小计: 8+9+4=21, 剩余55/18人 → 分布2-5场
teachers3 = [
    # === A组: 高负载 ===
    ("大数据技术专业教研室", "刘含波", 4, "A"),
    ("大数据技术专业教研室", "蒋丰泽", 4, "A"),
    # === B组: 三人组 ===
    ("人工智能技术应用专业教研室", "曹维", 3, "B"),
    ("人工智能技术应用专业教研室", "盛建强", 3, "B"),
    ("人工智能技术应用专业教研室", "陈康", 3, "B"),
    # === C组: 低负载 ===
    ("学生办", "武艳艳", 2, "C"),
    ("学生办", "聂子凡", 2, "C"),
    # === 无分组: 场次不均 ===
    ("大数据技术专业教研室", "高维春", 4, ""),
    ("大数据技术专业教研室", "白雪峰", 3, ""),
    ("大数据技术专业教研室", "冯敢", 3, ""),
    ("大数据技术专业教研室", "梁月仙", 3, ""),
    ("大数据技术专业教研室", "黄国伟", 2, ""),
    ("大数据技术专业教研室", "耿煜", 3, ""),
    ("大数据技术专业教研室", "张俊鹏", 3, ""),
    ("大数据技术专业教研室", "谢天明", 3, ""),
    ("云计算技术应用专业教研室", "孔令晶", 3, ""),
    ("云计算技术应用专业教研室", "黄瑾瑜", 3, ""),
    ("云计算技术应用专业教研室", "周莹", 2, ""),
    ("云计算技术应用专业教研室", "魏莲", 3, ""),
    ("云计算技术应用专业教研室", "彭刚", 2, ""),
    ("云计算技术应用专业教研室", "郭明雪", 2, ""),
    ("云计算技术应用专业教研室", "夏飞", 2, ""),
    ("人工智能技术应用专业教研室", "刘振", 3, ""),
    ("人工智能技术应用专业教研室", "冯昊港", 2, ""),
    ("人工智能技术应用专业教研室", "刘泳", 3, ""),
    ("教务办公室", "景弘泽", 2, ""),
    ("产教融合办公室", "洪莹莹", 2, ""),
    ("大数据与智能系统研究所", "钟建奇", 2, ""),
]
create_contact_list(d3, "人工智能学院通讯录 — 复杂场景", teachers3)

print("\n=== APP1 示范文件全部完成! ===")
