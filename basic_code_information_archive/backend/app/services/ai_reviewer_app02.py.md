# services/ai_reviewer_app02.py — App02 AI审查服务

**文件路径**：`backend/app/services/ai_reviewer_app02.py`

**作用**：App02 文件审查的 AI 核心服务，包含 AI 流式审查 + Python 确定性后处理。

**AI模型**：`deepseek-v4-pro-260425`（火山引擎Ark API）

**核心函数**：

- `extract_doc_text(filepath)`：提取 docx 全部文本（段落+表格）
- `build_prompt(doc_text, filename)`：构建超过500行的详细审查提示词
  - 包含5条规则：学校名、教师、错别字、课时校验、格式
  - 要求AI逐行数学验算课时
  - 文本截断到15000字符
- `parse_ai_response(raw_text)`：解析AI返回的JSON
- `review_stream(filepath, filename, api_key)`：异步流式审查（httpx.AsyncClient）
  - 提取文本 → 构建提示词 → 流式调用AI → 解析 → 后处理补丁 → yield结果
- `review(filepath, filename, api_key)`：非流式同步审查

**Python 后处理补丁**（`post_process_findings`）：
- `_check_hours()`：课时验算
  - TP模式：表0=封面，表1=进度表，公式=周数×周学时
  - CS/EM模式：表0=内容分配表，总计行 vs 逐行累加
  - 段落声明 vs 表格累加兜底
- `_check_teacher_names()`：教师姓名一致性检查（5个正则模式）
- `_check_school_name()`：搜索旧校名"深圳信息职业技术学院"
- `_check_known_typos()`：29组已知错别字模式匹配

**SSE事件类型**：`reasoning`(思维链)、`token`(输出文本)、`done`(审查完成)、`error`(错误)