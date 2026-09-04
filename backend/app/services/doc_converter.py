""".doc→.docx 转换 + docx→PDF 转换
使用 LibreOffice headless 模式
"""
import os
import uuid
import shutil
import subprocess
import tempfile
from pathlib import Path

TEMP_DIR = os.path.join(tempfile.gettempdir(), "tao_app02")
os.makedirs(TEMP_DIR, exist_ok=True)


def _find_libreoffice() -> str | None:
    """在 PATH 中查找 LibreOffice soffice 可执行文件"""
    return shutil.which("soffice") or shutil.which("libreoffice")


def convert_with_libreoffice(filepath: str, fmt: str) -> str | None:
    """使用 LibreOffice headless 模式转换文档格式"""
    soffice = _find_libreoffice()
    if not soffice:
        return None

    out_dir = os.path.join(TEMP_DIR, str(uuid.uuid4()))
    os.makedirs(out_dir, exist_ok=True)
    shutil.copy2(filepath, os.path.join(out_dir, os.path.basename(filepath)))

    try:
        result = subprocess.run(
            [soffice, "--headless", "--convert-to", fmt, "--outdir", out_dir, filepath],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            return None

        base = os.path.splitext(os.path.basename(filepath))[0]
        converted = os.path.join(out_dir, f"{base}.{fmt}")
        if os.path.exists(converted):
            return converted

        for f in os.listdir(out_dir):
            if f.lower().endswith(f".{fmt}"):
                return os.path.join(out_dir, f)
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def convert_doc_to_docx(filepath: str) -> str | None:
    """将 .doc 文件转换为 .docx（需安装 LibreOffice）"""
    return convert_with_libreoffice(filepath, "docx")


def convert_docx_to_pdf(filepath: str) -> str | None:
    """将 .docx 文件转换为 PDF（需安装 LibreOffice）"""
    return convert_with_libreoffice(filepath, "pdf")


def convert_docx_to_html(filepath: str) -> str | None:
    """纯 Python 将 docx 转为 HTML，不依赖 LibreOffice/Word，浏览器原生渲染中文"""
    try:
        from docx import Document
        from docx.oxml.ns import qn
    except ImportError:
        return None

    try:
        doc = Document(filepath)
    except Exception:
        return None

    try:
        parts: list[str] = []

        # 基础样式
        parts.append("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: "SimSun", "宋体", "NSimSun", "Microsoft YaHei", "微软雅黑", serif;
    font-size: 14px;
    line-height: 1.8;
    padding: 20px 30px;
    color: #333;
    background: #fff;
  }
  p { margin: 6px 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
  }
  table td, table th {
    border: 1px solid #333;
    padding: 4px 8px;
    vertical-align: top;
    font-size: 13px;
  }
  .align-left { text-align: left; }
  .align-center { text-align: center; }
  .align-right { text-align: right; }
</style>
</head>
<body>
""")

        # 遍历文档 body 中的元素（段落和表格交替）
        body = doc.element.body
        para_idx = 0
        table_idx = 0

        for child in body:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

            if tag == "p":
                if para_idx < len(doc.paragraphs):
                    para = doc.paragraphs[para_idx]
                    para_idx += 1
                    html = _paragraph_to_html(para)
                    parts.append(html)

            elif tag == "tbl":
                if table_idx < len(doc.tables):
                    table = doc.tables[table_idx]
                    table_idx += 1
                    html = _table_to_html(table)
                    parts.append(html)

        # 兜底：如果 body 遍历没有覆盖所有段落/表格
        while para_idx < len(doc.paragraphs):
            para = doc.paragraphs[para_idx]
            para_idx += 1
            parts.append(_paragraph_to_html(para))

        while table_idx < len(doc.tables):
            table = doc.tables[table_idx]
            table_idx += 1
            parts.append(_table_to_html(table))

        parts.append("</body>\n</html>")
        return "\n".join(parts)
    except Exception:
        return None


def _paragraph_to_html(para) -> str:
    """将 python-docx 段落转为 HTML，保留加粗、斜体、对齐等格式"""
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn

    align_map = {
        WD_ALIGN_PARAGRAPH.LEFT: "align-left",
        WD_ALIGN_PARAGRAPH.CENTER: "align-center",
        WD_ALIGN_PARAGRAPH.RIGHT: "align-right",
    }
    align_class = align_map.get(para.alignment, "")

    # 检查段落样式中的字体大小
    style_font_size = ""
    try:
        if para.style and para.style.font and para.style.font.size:
            size_pt = para.style.font.size.pt
            style_font_size = f"font-size:{size_pt}pt;"
    except Exception:
        pass

    # 构建 run 级别的 HTML
    runs_html: list[str] = []
    for run in para.runs:
        text = run.text
        if not text:
            continue

        # 转义 HTML 特殊字符
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        styles: list[str] = []
        if run.bold:
            styles.append("font-weight:bold;")
        if run.italic:
            styles.append("font-style:italic;")
        if run.underline:
            styles.append("text-decoration:underline;")

        # run 级别字体大小
        run_font_size = ""
        try:
            rPr = run._element.find(qn("w:rPr"))
            if rPr is not None:
                sz = rPr.find(qn("w:sz"))
                if sz is not None:
                    val = sz.get(qn("w:val"))
                    if val:
                        run_font_size = f"font-size:{int(val) / 2}pt;"
        except Exception:
            pass

        all_styles = run_font_size + "".join(styles) if run_font_size else "".join(styles)
        if all_styles:
            runs_html.append(f'<span style="{all_styles}">{text}</span>')
        else:
            runs_html.append(text)

    content = "".join(runs_html) if runs_html else "&nbsp;"

    style_attr = ""
    if style_font_size:
        style_attr = f' style="{style_font_size}"'

    if align_class:
        return f'<p class="{align_class}"{style_attr}>{content}</p>'
    return f"<p{style_attr}>{content}</p>"


def _table_to_html(table) -> str:
    """将 python-docx 表格转为 HTML 表格"""
    html = '<table border="1">\n'
    for row in table.rows:
        html += "<tr>\n"
        for cell in row.cells:
            # 合并单元格信息
            colspan = ""
            rowspan = ""
            try:
                tc = cell._tc
                tcPr = tc.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcPr")
                if tcPr is not None:
                    gridspan = tcPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}gridSpan")
                    if gridspan is not None:
                        val = gridspan.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")
                        if val and int(val) > 1:
                            colspan = f' colspan="{val}"'
                    vmerge = tcPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vMerge")
                    if vmerge is not None:
                        val = vmerge.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")
                        if val == "restart":
                            rowspan = ""  # 合并起始格正常显示
                        else:
                            continue  # 被合并的格子跳过
            except Exception:
                pass

            # 提取单元格文本（保留段落换行）
            cell_texts: list[str] = []
            for para in cell.paragraphs:
                p_text = "".join(run.text for run in para.runs)
                if p_text:
                    cell_texts.append(p_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            cell_content = "<br>".join(cell_texts) if cell_texts else "&nbsp;"
            html += f"<td{colspan}{rowspan}>{cell_content}</td>\n"
        html += "</tr>\n"
    html += "</table>"
    return html


def cleanup_temp(subdir: str):
    path = os.path.join(TEMP_DIR, subdir)
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)
