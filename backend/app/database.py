"""数据库连接和建表"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

SYNC_DATABASE_URL = "sqlite:///./data/tao.db"

engine = create_engine(SYNC_DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def init_db():
    """创建所有表和默认数据，并迁移旧明文数据为加密存储"""
    import os
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)

    from app.models.settings import Setting
    from app.crypto_utils import encrypt, is_encrypted

    with SessionLocal() as db:
        # 迁移已有的明文 llm_key 为加密存储
        existing_key = db.query(Setting).filter(Setting.key == "llm_key").first()
        if existing_key and existing_key.value and not is_encrypted(existing_key.value):
            existing_key.value = encrypt(existing_key.value)
            db.commit()  # 迁移立即提交，避免后续操作失败导致迁移数据丢失

        # 复用 existing_key 变量，避免冗余查询
        if not existing_key:
            # 默认 API Key 加密存储
            default_key = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
            db.add(Setting(key="llm_key", value=encrypt(default_key)))
        if not db.query(Setting).filter(Setting.key == "llm_url").first():
            db.add(Setting(key="llm_url", value="https://ark.cn-beijing.volces.com/api/v3/chat/completions"))
        if not db.query(Setting).filter(Setting.key == "llm_model").first():
            db.add(Setting(key="llm_model", value="deepseek-v4-pro-260425"))
        if not db.query(Setting).filter(Setting.key == "app02_ai_concurrency").first():
            db.add(Setting(key="app02_ai_concurrency", value="1"))
        db.commit()
