# services/llm_usage.py — LLM 用量记录服务

## 文件: llm_usage.py
- **路径**: `backend/app/services/llm_usage.py`
- **作用**: 在每次 LLM 流式调用结束后向 `llm_usage` 表写入一条用量记录；统计失败仅打 warning 日志，绝不影响审查主流程
- **关键函数/类**:
  - `record_usage(user_id, app, model, prompt_tokens, completion_tokens)`: 独立开 `SessionLocal` 写入一条记录，`user_id=None` 表示系统级
  - `estimate_tokens(text)`: 流末尾无 `usage` 统计块时按字符数粗略估算 token（`len//2`）
- **依赖关系**:
  - 引入: `app.database.SessionLocal`、`app.models.usage.LlmUsage`（函数内延迟导入）
  - 被引用: `app/services/ai_reviewer_app01.py`、`app/services/ai_reviewer_app02.py`
- **最后修改**: 2026-09-08
- **修改原因**: 新增 AI 用量统计功能（v2.0.2）
