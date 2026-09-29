# database.py — 数据库连接、Alembic 版本迁移、自动备份与回滚

**文件路径**：`backend/app/database.py`

**作用**：管理 SQLite 数据库连接，通过 Alembic 在启动时自动执行 schema 版本迁移，迁移前自动备份、失败自动回滚，并初始化种子数据。

**核心内容**：
- `_BACKEND_DIR`：backend 目录绝对路径（锚定 `database.py` 文件位置，不受进程工作目录影响）
- `DATA_DIR` / `DB_FILE`：`backend/data/tao.db`
- `SYNC_DATABASE_URL`：`sqlite:///{DB_FILE 绝对路径}`（同步，实际使用）
- `BACKUP_DIR`：`backend/data/backups/`（自动备份目录）
- `BACKUP_KEEP`：备份滚动保留份数（10）
- `engine`：SQLAlchemy 同步引擎
- `SessionLocal`：数据库会话工厂
- `Base`：ORM 声明基类

**schema 迁移机制（2026-09-04 引入）**：
- 表结构由 **Alembic** 管理（`backend/alembic/` 目录 + `alembic.ini`），不再使用 `Base.metadata.create_all`
- 版本脚本在 `backend/alembic/versions/`，基线版本 `0001_initial`（对应 v2.0.1 全部 8 张表）
- **新增表结构变更的正确流程**：开发时 `cd backend && alembic revision --autogenerate -m "xxx"`（或手写），检查脚本后随代码一起提交；部署时后端启动自动 `upgrade head`，老师无需任何手动操作

**关键函数**：
- `_boot_lock()`：跨进程启动锁（POSIX fcntl / Windows msvcrt），gunicorn 4 worker 并发启动时串行化 init_db，避免并发跑 Alembic 迁移在 SQLite 上竞争导致 worker 启动失败（exit 3）
- `_backup_database(reason)`：用 SQLite 原生 `VACUUM INTO` 生成一致性快照备份到 `BACKUP_DIR`，文件名含时间戳 + 6 位随机 hex（避免多 worker 同秒撞名报 "output file already exists"），滚动删除超出 `BACKUP_KEEP` 的旧备份；库文件不存在（首次启动）返回 None
- `_run_migrations()`：编程方式调用 Alembic `upgrade head`；存量库接管——已有业务表但无 `alembic_version` 表时，先 `stamp 0001_initial` 再升级
- `reload_engine()`：dispose 旧引擎并重建，用 `SessionLocal.configure(bind=...)` 保持会话工厂对象身份不变
- `init_db()`：启动入口，加 `_boot_lock` 后调 `_init_db_locked()`；流程为——迁移前自动备份 → `_run_migrations()`（失败则回滚备份文件并抛 RuntimeError，拒绝以坏 schema 启动）→ 明文 llm_key 加密迁移 → 插入默认配置 → `_preseed_data`（角色/权限/admin 账号）→ `_migrate_llm_config`

**离线构建**：`backend/Dockerfile.offline` 用本地 `wheels/` 目录离线安装依赖（`pip install --no-index`），适用于无外网/DNS 受限的部署环境；wheels 由主机 `pip download -r requirements.txt --only-binary=:all: --platform manylinux2014_x86_64 ... --python-version 312` 准备，需额外补 Linux 专属包（如 `uvloop`，Windows 主机按 marker 会跳过）

**依赖关系**：
- 引入：SQLAlchemy、alembic（command/Config）、sqlite3；`_preseed_data`/`_migrate_llm_config` 内部引入 m1_auth 模型与 crypto_utils
- 被引用：`app/main.py`（lifespan 调用 init_db）、`app/m1_auth/middleware.py`（SessionLocal）、`app/routers/backup.py`（DB_FILE/BACKUP_DIR/_backup_database/_run_migrations/reload_engine）

**注意**：项目使用同步 SQLAlchemy Session（`SessionLocal`），非异步。
