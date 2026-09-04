# models/settings.py — 配置表 ORM 模型

**文件路径**：`backend/app/models/settings.py`

**作用**：定义 `settings` 表的 ORM 模型，用于存储键值对配置。

**表结构**：
- `id`：主键，自增整数
- `key`：配置键名（唯一），如 `llm_key`、`llm_url`、`llm_model`、`app02_ai_concurrency`
- `value`：配置值（文本），敏感字段加密存储
- `updated_at`：最后更新时间戳

**使用方式**：通过 `ConfigManager` 类间接操作，不直接操作此模型。