"""LLM 用量记录服务 — 每次流式调用结束后写入 llm_usage 表

统计失败只打日志，绝不影响审查主流程。
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def record_usage(
    user_id: str | None,
    app: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    """记录一次 LLM 调用用量

    user_id 为 None 表示系统级调用（APP01 无鉴权无法归属用户）
    """
    from app.database import SessionLocal
    from app.models.usage import LlmUsage

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    try:
        with SessionLocal() as db:
            db.add(LlmUsage(
                id=f"usage_{uuid.uuid4().hex[:12]}",
                user_id=user_id,
                app=app,
                model=model or "",
                prompt_tokens=int(prompt_tokens or 0),
                completion_tokens=int(completion_tokens or 0),
                total_tokens=int(prompt_tokens or 0) + int(completion_tokens or 0),
                created_at=now,
            ))
            db.commit()
    except Exception as e:
        logger.warning("记录 LLM 用量失败（不影响主流程）: %s", e)


def estimate_tokens(text: str) -> int:
    """无 usage 字段时的粗略估算：中文约 1.5~2 字符/token，取 len//2"""
    return max(1, len(text or "") // 2)
