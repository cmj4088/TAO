"""数据库连接和建表"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./data/tao.db"
SYNC_DATABASE_URL = "sqlite:///./data/tao.db"

engine = create_engine(SYNC_DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def init_db():
    """创建所有表和默认数据"""
    import os
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # 写入默认 LLM 配置（如果不存在）
    from app.models.settings import Setting
    with SessionLocal() as db:
        if not db.query(Setting).filter(Setting.key == "llm_key").first():
            db.add(Setting(key="llm_key", value="ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"))
        if not db.query(Setting).filter(Setting.key == "llm_url").first():
            db.add(Setting(key="llm_url", value="https://ark.cn-beijing.volces.com/api/v3/chat/completions"))
        if not db.query(Setting).filter(Setting.key == "app02_ai_concurrency").first():
            db.add(Setting(key="app02_ai_concurrency", value="1"))
        db.commit()
