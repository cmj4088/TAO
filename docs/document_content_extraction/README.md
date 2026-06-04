# document_content_extraction

Word 文档内容提取与审查工具集，供 app02 文件审查模块调用。

## 文件说明

| 文件 | 作用 |
|------|------|
| `convert_doc_to_docx.py` | 将 .doc 老格式转为 .docx（需要 Windows + Word） |
| `extract_docx.py` | 提取 .docx 中所有表格的文本和格式信息，输出 JSON |
| `review_by_template.py` | 核心审查脚本：格式检查 + 课时校验 |

## 用法

```bash
# 转换 .doc 为 .docx
python convert_doc_to_docx.py <目录路径>

# 提取单个 .docx 的表格和格式
python extract_docx.py <文件路径>

# 批量审查（格式 + 课时）
python review_by_template.py
```

## 依赖

- python-docx
- pywin32（仅 convert_doc_to_docx.py 需要）
