# database.py — 数据库连接和建表

**文件路径**：`backend/app/database.py`

**作用**：管理 SQLite 数据库连接，创建表结构，初始化默认数据，迁移旧数据。

**核心内容**：
- `DATABASE_URL`：`sqlite+aiosqlite:///./data/tao.db`（异步）
- `SYNC_DATABASE_URL`：`sqlite:///./data/tao.db`（同步，实际使用）
- `engine`：SQLAlchemy 同步引擎
- `SessionLocal`：数据库会话工厂
- `Base`：ORM 声明基类

**`init_db()` 函数**：
1. 创建 `data/` 目录（如果不存在）
2. 创建所有 ORM 表（`Base.metadata.create_all`）
3. **迁移旧明文数据**：扫描 `llm_key` 是否为明文，若是则加密
4. 插入默认配置（如果不存在）：
   - `llm_key`：`ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c`（加密存储）
   - `llm_url`：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
   - `llm_model`：`deepseek-v4-pro-260425`
   - `app02_ai_concurrency`：`1`

**注意**：项目使用同步 SQLAlchemy Session（`SessionLocal`），非异步。