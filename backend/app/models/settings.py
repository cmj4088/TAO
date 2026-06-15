"""配置表 ORM 模型"""
from sqlalchemy import Column, String
from app.database import Base


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, default="")
