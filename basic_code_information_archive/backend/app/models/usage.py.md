# models/usage.py — LLM 用量表模型

## 文件: usage.py
- **路径**: `backend/app/models/usage.py`
- **作用**: 定义 `llm_usage` 表（SQLAlchemy 模型 `LlmUsage`），记录每次 AI 调用的 token 消耗，支撑 AI 用量统计功能
- **关键函数/类**:
  - `LlmUsage`: 用量记录行；`user_id` 可空（NULL = 系统级调用，如 APP01 无鉴权无法归属用户）、`app`（"app01"/"app02"）、`model`、`prompt_tokens`/`completion_tokens`/`total_tokens`、`created_at`（UTC 字符串，带索引）
- **依赖关系**:
  - 引入: `app.database.Base`
  - 被引用: `app/services/llm_usage.py`、`app/routers/stats.py`
- **对应迁移**: `alembic/versions/0002_llm_usage.py`
- **最后修改**: 2026-09-08
- **修改原因**: 新增 AI 用量统计功能（v2.0.2）
