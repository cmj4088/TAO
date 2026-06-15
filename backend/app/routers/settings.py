"""配置相关 API"""
from fastapi import APIRouter
from app.config import ConfigManager
from app.schemas.settings import SettingItem, SettingsBatch, LLMConfig

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    """获取所有设置项"""
    return ConfigManager.get_all()


@router.put("/settings")
def update_settings(batch: SettingsBatch):
    """批量更新设置"""
    ConfigManager.set_batch({s.key: s.value for s in batch.settings})
    return {"ok": True}


@router.get("/admin/llm", response_model=LLMConfig)
def get_llm_config():
    """获取大模型配置"""
    return LLMConfig(
        url=ConfigManager.get("llm_url", ""),
        key=ConfigManager.get("llm_key", ""),
    )


@router.put("/admin/llm")
def update_llm_config(config: LLMConfig):
    """更新大模型配置"""
    ConfigManager.set("llm_url", config.url)
    ConfigManager.set("llm_key", config.key)
    return {"ok": True}
