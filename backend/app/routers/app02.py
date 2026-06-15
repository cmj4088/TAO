"""app02 文件审查 API（占位）"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/app02", tags=["app02"])


@router.get("/status")
def get_status():
    return {"status": "ok", "message": "app02 文件审查模块就绪"}
