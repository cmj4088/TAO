"""Alembic 迁移环境 — 连接串优先取 TAO_DATABASE_URL 环境变量"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Alembic Config 对象，提供 alembic.ini 的访问
config = context.config

# alembic.ini 的日志配置（编程方式调用时可能未配置日志，忽略失败）
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except KeyError:
        pass

# 连接串：环境变量 > alembic.ini
# 默认值与 app/database.py 的 SYNC_DATABASE_URL 保持一致
database_url = os.environ.get(
    "TAO_DATABASE_URL",
    config.get_main_option("sqlalchemy.url", "sqlite:///./data/tao.db"),
)
config.set_main_option("sqlalchemy.url", database_url)

# 本项目迁移脚本只使用 op.* 指令，无需绑定 ORM 元数据；
# target_metadata 留空，autogenerate 时不做 diff（避免误删手工管理对象）
target_metadata = None


def run_migrations_offline() -> None:
    """离线模式：只生成 SQL 脚本，不连接数据库"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite 改列/删列必须走 batch 模式
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：直接连接数据库执行迁移"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite 改列/删列必须走 batch 模式
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
