# routers/stats.py — 统计数据路由

## 文件: stats.py
- **路径**: `backend/app/routers/stats.py`
- **作用**: 提供 AI 用量统计 API，按"当前用户"与"系统级"两个维度聚合 `llm_usage` 表
- **关键函数/类**:
  - `GET /api/stats/ai-usage`（需登录）: 返回 `{"data": {"me": {...}, "system": {...}}}`，每个统计块含：`calls`/`total_tokens`/`prompt_tokens`/`completion_tokens` 累计、`today`（按中国时区 UTC+8 的"今天"）、`by_model`（按模型分布）、`by_day`（近 7 天趋势，Python 侧按时区归组）
  - `_aggregate(q)`: SQL 聚合总量
  - `_usage_block(base_q)`: 组装一个归属范围的完整统计块
  - `_today_query(base_q, today_str)`: 中国时区"今天 0 点"换算为 UTC 起始串后过滤
- **依赖关系**:
  - 引入: `app.m1_auth.middleware`（get_db/get_current_user）、`app.models.usage.LlmUsage`
  - 被引用: `app/main.py`（`app.include_router(stats.router)`）
- **最后修改**: 2026-09-08
- **修改原因**: 新增 AI 用量统计功能（v2.0.2）
