# services/ai_reviewer_app01.py — App01 AI审查服务

**文件路径**：`backend/app/services/ai_reviewer_app01.py`

**作用**：为监考分配（App01）提供 AI 审查功能，SSE 流式输出。

**核心函数**：
- `review_stream(exam_rows, teachers, teacher_loads)`：异步生成器
  - 构建考试安排描述和教师信息描述
  - 构造提示词，要求AI审查5个方面：
    1. 同时段冲突（最严重）
    2. 场次匹配
    3. 自己班优先
    4. 分组一致性
    5. 其他不合理之处
  - 返回JSON格式：`{"findings": [...], "summary": "..."}`
- `_call_ai_stream(prompt, api_key)`：使用 urllib.request 发起流式调用
  - 逐行读取SSE响应，解析 `data: ` 前缀的JSON
  - 提取 `choices[0].delta.content` 字段
- `_get_llm_config(api_key, model, url)`：三级回退获取LLM配置

**AI配置**：默认使用火山引擎Ark API，模型 `deepseek-v4-pro-260425`，temperature=0.1