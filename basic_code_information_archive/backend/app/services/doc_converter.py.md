# services/doc_converter.py — 文档格式转换

**文件路径**：`backend/app/services/doc_converter.py`

**作用**：将旧版 .doc 格式文件转换为 .docx 格式，以及将 .docx 转换为 HTML 用于预览。

**关键函数**：
- `_find_libreoffice()`: 查找 LibreOffice 安装路径
- `convert_with_libreoffice(filepath, fmt)`: 使用 LibreOffice 转换格式（doc→docx, docx→pdf）
- `convert_with_word_com(filepath, fmt)`: 降级方案，使用 Word COM 接口转换
- `convert_doc_to_docx(filepath)`: .doc→.docx 转换主入口
- `convert_docx_to_pdf(filepath)`: .docx→PDF 转换（依赖 LibreOffice/Word）
- `convert_docx_to_html(filepath)`: **纯 Python** .docx→HTML 转换，用于文件预览，不依赖任何外部程序，浏览器原生渲染中文
- `_paragraph_to_html(para)`: 段落转 HTML，保留加粗/斜体/下划线/对齐/字号
- `_table_to_html(table)`: 表格转 HTML，支持合并单元格（colspan/rowspan）
- `cleanup_temp(subdir)`: 清理临时文件

**依赖关系**：
- 引入: `python-docx`, `subprocess`, `win32com.client`（Word COM 降级）
- 被引用: `backend/app/routers/app02.py`（预览接口）

**最后修改**: 2026-07-30
**修改原因**: 新增纯 Python docx→HTML 预览功能，解决 PDF 中文方块问题