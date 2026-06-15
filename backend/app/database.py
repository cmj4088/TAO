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
