"""LLM 用量统计模型 — 记录每次 AI 调用的 token 消耗"""
from sqlalchemy import Column, String, Integer

from app.database import Base


class LlmUsage(Base):
    """LLM 用量表

    user_id 为空表示系统级调用（如 APP01 监考分配审查，接口无鉴权无法归属用户）
    """
    __tablename__ = "llm_usage"

    id = Column(String, primary_key=True)
    user_id = Column(String, index=True, nullable=True)
    app = Column(String, nullable=False)  # "app01" / "app02"
    model = Column(String, default="")
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(String, index=True, nullable=False)  # UTC "YYYY-MM-DD HH:MM:SS"
