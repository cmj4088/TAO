# backup.py — 管理员备份/恢复路由

**文件路径**：`backend/app/routers/backup.py`

**作用**：提供全库备份导出下载与上传恢复的 API，用于版本更新前备份、换机迁移、故障恢复。

**关键函数/端点**：
- `GET /api/admin/backup/export`（权限 `settings:write`）：用 SQLite `VACUUM INTO` 生成一致性快照到 `BACKUP_DIR/export_tmp_*.db`，以 `FileResponse` 返回标准 .db 文件下载（文件名 `tao_backup_YYYYMMDD_HHMMSS.db`），下载完成后由 `BackgroundTask` 删除服务端临时文件
- `POST /api/admin/backup/restore`（权限 `settings:write`，multipart 上传 .db）：
  1. 落盘到 `data/restore_upload.tmp`（与库同目录）
  2. 校验：`PRAGMA integrity_check` 必须为 ok + 必须包含核心表（users/roles/sessions/settings），否则 400
  3. `_backup_database("pre-restore")` 自动备份当前库（恢复错了还能换回来）
  4. 用 **SQLite backup API**（`src_conn.backup(dest_raw.connection)`）把备份内容整库覆盖进当前连接池持有的库——不替换文件、不断开连接池（Windows 下认证依赖还握着 tao.db 连接，`os.replace` 会因占用失败）
  5. `_run_migrations()` 补跑增量迁移（兼容旧版本备份），失败返回 500
  6. 返回提示"所有用户需重新登录"（导出之后创建的会话全部失效）
- 响应格式遵循项目惯例 `{"data": ..., "error": None}`；错误经 `HTTPException` 返回 `{"detail": ...}`

**依赖关系**：
- 引入：`app/database.py`（DB_FILE/_backup_database/_run_migrations）、`app/m1_auth/middleware.py`（require_permission）
- 被引用：`app/main.py`（include_router）
- 前端对应：`frontend/src/pages/AdminPage.tsx` 的"数据备份与迁移"卡片（导出/导入按钮，裸 axios 带 Bearer，长超时 120s）

**最后修改**: 2026-09-04
**修改原因**: 新增账户/全库迁移功能（grill-me 共识：Alembic + SQLite 原生备份）
