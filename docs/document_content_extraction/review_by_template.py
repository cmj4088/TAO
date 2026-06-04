#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基于模板提取格式规则，审查提交文件：格式偏离 + 课时校验。
用法：python review_by_template.py
"""

import os
import json
import re
from collections import defaultdict
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH


def get_alignment_name(p):
    m = {
        WD_ALIGN_PARAGRAPH.LEFT: "左对齐",
        WD_ALIGN_PARAGRAPH.CENTER: "居中",
        WD_ALIGN_PARAGRAPH.RIGHT: "右对齐",
        WD_ALIGN_PARAGRAPH.JUSTIFY: "两端对齐",
    }
    return m.get(p.alignment, "默认")


def extract_template_profile(template_path):
    doc = Document(template_path)
    allowed_fonts = set()
    allowed_sizes = set()
    allowed_alignments = set()
    per_table_fonts = {}

    for t_idx, table in enumerate(doc.tables):
        table_fonts = set()
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    allowed_alignments.add(get_alignment_name(para))
                    for run in para.runs:
                        if run.font.name:
                            allowed_fonts.add(run.font.name)
                            table_fonts.add(run.font.name)
                        if run.font.size:
                            allowed_sizes.add(f"{run.font.size.pt:.0f}pt")
        per_table_fonts[f"表格{t_idx + 1}"] = table_fonts

    return {
        "允许的字体": allowed_fonts,
        "允许的字号": allowed_sizes,
        "允许的对齐": allowed_alignments,
        "各表格字体": per_table_fonts,
    }


def review_file(filepath, template_profile):
    doc = Document(filepath)
    allowed_fonts = template_profile["允许的字体"]
    allowed_sizes = template_profile["允许的字号"]

    issues = []
    all_fonts_used = set()
    font_locations = defaultdict(list)

    for t_idx, table in enumerate(doc.tables):
        t_key = f"表格{t_idx + 1}"

        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                text = cell.text.strip()
                if not text:
                    continue

                for para in cell.paragraphs:
                    for run in para.runs:
                        if not run.text.strip():
                            continue

                        fn = run.font.name or "默认字体"
                        fs = f"{run.font.size.pt:.0f}pt" if run.font.size else "默认字号"
                        all_fonts_used.add(fn)

                        if fn not in allowed_fonts and fn != "默认字体":
                            font_locations[fn].append({
                                "表格": t_key,
                                "位置": f"第{r_idx + 1}行第{c_idx + 1}列",
                                "内容": text[:30],
                            })

                        if fs != "默认字号" and fs not in allowed_sizes:
                            issues.append({
                                "类型": "字号偏离",
                                "表格": t_key,
                                "位置": f"第{r_idx + 1}行第{c_idx + 1}列",
                                "内容": text[:30],
                                "详情": f"字号 {fs} 不在模板允许范围 {allowed_sizes}",
                            })

    if font_locations:
        for font, locs in font_locations.items():
            unique_locs = []
            seen = set()
            for loc in locs:
                key = (loc["表格"], loc["位置"])
                if key not in seen:
                    unique_locs.append(loc)
                    seen.add(key)
                    if len(unique_locs) >= 3:
                        break
            examples = "、".join(f"{l['表格']}{l['位置']}" for l in unique_locs)
            issues.append({
                "类型": "字体偏离",
                "详情": f"使用了模板不允许的字体「{font}」，共{len(locs)}处",
                "示例位置": examples,
            })

    if len(all_fonts_used) > 5:
        issues.append({
            "类型": "字体过多",
            "详情": f"全文使用了{len(all_fonts_used)}种字体（上限5种）: {', '.join(sorted(all_fonts_used))}",
        })

    return issues, all_fonts_used, doc


def extract_numbers_from_text(text):
    numbers = re.findall(r'\d+\.?\d*', text)
    return [float(n) for n in numbers]


def find_summary_info(doc):
    """
    从授课计划汇总表（表格1）中提取所有班级的关键数字。
    返回 [{"班级": "xx班", "周数": x, "周学时": y, "总学时": z}, ...]
    """
    if len(doc.tables) < 1:
        return []

    table = doc.tables[0]
    label_map = {}  # col -> label_name

    # 找标签行
    label_row_idx = None
    for r_idx, row in enumerate(table.rows):
        for c_idx, cell in enumerate(row.cells):
            text = cell.text.replace('\n', '').replace(' ', '').strip()
            if '教学周数' in text:
                label_map[c_idx] = '周数'
            if '周学时' in text:
                label_map[c_idx] = '周学时'
            if '计划教学时数' in text or '计划学时' in text or '总学时' in text:
                label_map[c_idx] = '总学时'
        if label_map:
            label_row_idx = r_idx
            break

    if not label_map:
        return []

    # 在标签行之后找所有包含数值的数据行（可能有多个班级）
    results = []
    for r_idx in range(label_row_idx + 1, len(table.rows)):
        row = table.rows[r_idx]
        info = {}
        # 第2列通常是班级名称
        if len(row.cells) > 1:
            class_name = row.cells[1].text.strip()
            if class_name:
                info['班级'] = class_name

        for c_idx, label in label_map.items():
            if c_idx < len(row.cells):
                nums = re.findall(r'\d+', row.cells[c_idx].text.strip())
                if nums:
                    info[label] = int(nums[0])

        if '周数' in info or '总学时' in info:
            results.append(info)

    return results


def extract_progress_tables(doc):
    """
    从文档中提取所有进度表（跳过表格1汇总表）。
    返回 [{"rows": [...], "total_hours": int, "week_count": int}, ...]
    """
    results = []

    for t_idx in range(1, len(doc.tables)):
        table = doc.tables[t_idx]
        rows_data = []
        week_numbers = []

        # 找表头行
        header_row = None
        for r_idx, row in enumerate(table.rows):
            first_cell = row.cells[0].text.strip()
            if "周" in first_cell and "次" in first_cell:
                header_row = r_idx
                break
        if header_row is None:
            continue  # 不像进度表，跳过

        week_col = 0
        hour_col = 4

        if header_row < len(table.rows):
            for c_idx, cell in enumerate(table.rows[header_row].cells):
                text = cell.text.strip()
                if "周" in text and "次" in text:
                    week_col = c_idx
                if "时" in text and ("数" in text or "间" in text):
                    hour_col = c_idx

        for r_idx in range(header_row + 1, len(table.rows)):
            row = table.rows[r_idx]
            if week_col >= len(row.cells) or hour_col >= len(row.cells):
                continue

            week_text = row.cells[week_col].text.strip()
            hour_text = row.cells[hour_col].text.strip()

            week_nums = extract_numbers_from_text(week_text)
            hour_nums = extract_numbers_from_text(hour_text)

            if week_nums and hour_nums:
                w = int(week_nums[0])
                h = int(hour_nums[0])
                if 1 <= w <= 30:
                    rows_data.append({"周次": w, "学时": h})
                    week_numbers.append(w)

        total = sum(r["学时"] for r in rows_data)
        results.append({
            "表格编号": f"表格{t_idx + 1}",
            "rows": rows_data,
            "total_hours": total,
            "week_count": len(week_numbers),
        })

    return results


def validate_time_calculation(doc):
    issues = []
    summaries = find_summary_info(doc)
    progress_tables = extract_progress_tables(doc)

    if summaries:
        for s in summaries:
            print(f"  [课时校验] 汇总信息: {s}")
    else:
        print(f"  [课时校验] 未提取到汇总信息")

    if progress_tables:
        for pt in progress_tables:
            print(f"  [课时校验] {pt['表格编号']}: {pt['week_count']}周, 合计{pt['total_hours']}学时")

    # 对每个班级/进度表配对校验
    for i, summary in enumerate(summaries):
        claimed = summary.get("总学时")
        if claimed is None:
            continue

        class_name = summary.get("班级", f"班级{i + 1}")

        # 周数 x 周学时 = 总学时
        if summary.get("周数") and summary.get("周学时"):
            expected = summary["周数"] * summary["周学时"]
            if expected != claimed:
                issues.append({
                    "类型": "课时计算错误",
                    "详情": f"[{class_name}] 周数({summary['周数']}) x 周学时({summary['周学时']}) = {expected}，但汇总表声称总学时为{claimed}，相差{abs(expected - claimed)}学时",
                })
            else:
                print(f"  [课时校验] [{class_name}] 周数x周学时={expected}=总学时，计算正确")

        # 进度表累加 vs 汇总表总学时
        if i < len(progress_tables):
            pt = progress_tables[i]
            if pt["total_hours"] != claimed:
                issues.append({
                    "类型": "课时不一致",
                    "详情": f"[{class_name}] {pt['表格编号']}进度表累加合计{pt['total_hours']}学时，但汇总表声称{claimed}学时，相差{abs(pt['total_hours'] - claimed)}学时",
                })

    return issues


def classify_template(filename):
    if "课程标准" in filename:
        return "课程标准"
    if "授课计划" in filename:
        return "授课计划"
    if "教案" in filename:
        return "教案"
    return "未知"


def main():
    base = r"c:\Users\32277\Desktop\TAO\docs\app02.file"
    template_dir = os.path.join(base, "附件4：教学文件（课程标准、计划、教案）", "附件4：教学文件（课程标准、计划、教案）模板")

    templates = {
        "课程标准": os.path.join(template_dir, "附件1：课程标准（体例）.docx"),
        "授课计划": os.path.join(template_dir, "附件2：学期授课计划表（体例）.docx"),
        "教案": os.path.join(template_dir, "附件3：教案（体例）.docx"),
    }

    print("=" * 60)
    print("Step 1: 提取模板格式画像")
    print("=" * 60)
    all_profiles = {}
    for ttype, tpath in templates.items():
        profile = extract_template_profile(tpath)
        all_profiles[ttype] = profile
        print(f"\n[{ttype}] {os.path.basename(tpath)}")
        print(f"  允许的字体: {', '.join(sorted(profile['允许的字体']))}")
        print(f"  允许的字号: {', '.join(sorted(profile['允许的字号']))}")
        print(f"  允许的对齐: {', '.join(sorted(profile['允许的对齐']))}")

    files_to_check = []
    for subdir in ["字体有错误", "课时上的事实性错误"]:
        d = os.path.join(base, subdir)
        for f in os.listdir(d):
            if f.endswith(".docx"):
                files_to_check.append((os.path.join(d, f), subdir))

    print(f"\n{'=' * 60}")
    print("Step 2: 审查文件（格式 + 课时校验）")
    print("=" * 60)

    for filepath, category in files_to_check:
        fname = os.path.basename(filepath)
        ttype = classify_template(fname)

        print(f"\n--- {fname}")
        print(f"  来源: {category} | 模板: {ttype}")

        if ttype not in all_profiles:
            print(f"  [SKIP] 无法匹配模板")
            continue

        format_issues, fonts_used, doc = review_file(filepath, all_profiles[ttype])

        time_issues = []
        if ttype == "授课计划":
            time_issues = validate_time_calculation(doc)

        all_issues = format_issues + time_issues

        if not all_issues:
            print(f"  结果: [PASS] 格式符合模板要求，课时校验通过")
            print(f"  使用字体: {', '.join(sorted(fonts_used))}")
        else:
            print(f"  结果: [FAIL] 共{len(all_issues)}类问题")
            print(f"  使用字体: {', '.join(sorted(fonts_used))}")
            for issue in all_issues:
                marker = "[格式]" if issue["类型"] in ("字体偏离", "字号偏离", "字体过多") else "[课时]"
                print(f"  [!] {marker} [{issue['类型']}] {issue['详情']}")
                if "示例位置" in issue:
                    print(f"      示例: {issue['示例位置']}")

    print(f"\n{'=' * 60}")
    print("Done")
    print("=" * 60)


if __name__ == "__main__":
    main()
