"""app01 监考分配 API（占位）"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/app01", tags=["app01"])


@router.get("/status")
def get_status():
    return {"status": "ok", "message": "app01 监考分配模块就绪"}
