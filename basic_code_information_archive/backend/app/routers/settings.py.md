# routers/settings.py — 设置接口

**文件路径**：`backend/app/routers/settings.py`

**作用**：提供配置管理的 API 接口，包括通用设置和LLM配置。

**接口列表**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取所有设置项（敏感字段已脱敏） |
| PUT | `/api/settings` | 批量更新设置 `{"settings":[{"key":"x","value":"y"}]}` |
| GET | `/api/admin/llm` | 获取LLM配置（key脱敏，含`has_key`字段） |
| PUT | `/api/admin/llm` | 更新LLM配置（key含"****"时不更新key） |
| GET | `/api/app02/settings` | 获取App02专属设置（AI并发数） |
| PUT | `/api/app02/settings` | 更新App02设置 `{"ai_concurrency": 3}` |

**关键设计**：
- LLM Key 更新逻辑：只有传入非空且不含 `****` 的 key 时才更新（防止脱敏值覆盖）
- App02 并发数范围：1-10（`max(1, min(10, val))`）
- 所有敏感字段通过 ConfigManager 自动加解密