"""统计数据路由 — AI 用量（按用户 + 系统级）"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.m1_auth.middleware import get_db, get_current_user
from app.models.usage import LlmUsage

router = APIRouter(prefix="/api/stats", tags=["stats"])

# 服务器存的是 UTC 时间字符串，展示按中国时区（UTC+8）计算"今天"
_CN_TZ = timezone(timedelta(hours=8))


def _aggregate(q):
    """对一个已过滤的查询做总量聚合，返回 (调用次数, 总token, prompt, completion)"""
    row = q.with_entities(
        func.count(LlmUsage.id),
        func.coalesce(func.sum(LlmUsage.total_tokens), 0),
        func.coalesce(func.sum(LlmUsage.prompt_tokens), 0),
        func.coalesce(func.sum(LlmUsage.completion_tokens), 0),
    ).first()
    return {
        "calls": int(row[0] or 0),
        "total_tokens": int(row[1] or 0),
        "prompt_tokens": int(row[2] or 0),
        "completion_tokens": int(row[3] or 0),
    }


def _usage_block(base_q) -> dict:
    """组装一个归属范围（本人/系统级）的完整统计块"""
    now_cn = datetime.now(_CN_TZ)
    today_str = now_cn.strftime("%Y-%m-%d")
    # 近 7 天（含今天）的 UTC 起始字符串，用于粗筛后再按中国日期精确分组
    cutoff_utc = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    # 今日
    today = _aggregate(_today_query(base_q, today_str))

    # 按模型分布
    by_model_rows = (
        base_q.with_entities(
            LlmUsage.model,
            func.count(LlmUsage.id),
            func.coalesce(func.sum(LlmUsage.total_tokens), 0),
        )
        .group_by(LlmUsage.model)
        .order_by(func.sum(LlmUsage.total_tokens).desc())
        .all()
    )
    by_model = [
        {"model": r[0] or "未知", "calls": int(r[1] or 0), "total_tokens": int(r[2] or 0)}
        for r in by_model_rows
    ]

    # 近 7 天趋势：粗筛出原始行，在 Python 里按中国时区日期归组
    rows = (
        base_q.with_entities(LlmUsage.created_at, LlmUsage.total_tokens)
        .filter(LlmUsage.created_at >= cutoff_utc)
        .all()
    )
    by_day_map: dict[str, dict] = {}
    for created_at, tokens in rows:
        dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        day = dt.astimezone(_CN_TZ).strftime("%Y-%m-%d")
        bucket = by_day_map.setdefault(day, {"calls": 0, "total_tokens": 0})
        bucket["calls"] += 1
        bucket["total_tokens"] += int(tokens or 0)

    by_day = []
    for i in range(6, -1, -1):
        day = (now_cn - timedelta(days=i)).strftime("%Y-%m-%d")
        b = by_day_map.get(day, {"calls": 0, "total_tokens": 0})
        by_day.append({"date": day, **b})

    return {
        **_aggregate(base_q),
        "today": today,
        "by_model": by_model,
        "by_day": by_day,
    }


def _today_query(base_q, today_str: str):
    """按中国时区"今天"过滤：created_at 为 UTC 字符串，今天 CN 0 点 = UTC 前一天 16 点"""
    utc_start = (datetime.strptime(today_str, "%Y-%m-%d").replace(tzinfo=_CN_TZ)
                 .astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    return base_q.filter(LlmUsage.created_at >= utc_start)


@router.get("/ai-usage")
def ai_usage(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """当前用户的 AI 用量统计 + 系统级（APP01 监考分配）用量汇总"""
    uid = user["id"]

    me_q = db.query(LlmUsage).filter(LlmUsage.user_id == uid)
    system_q = db.query(LlmUsage).filter(LlmUsage.user_id.is_(None))

    return {
        "data": {
            "me": _usage_block(me_q),
            "system": _usage_block(system_q),
        },
        "error": None,
    }
