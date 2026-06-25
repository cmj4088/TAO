"""配置相关 API"""
from fastapi import APIRouter
from app.config import ConfigManager
from app.schemas.settings import SettingItem, SettingsBatch, LLMConfig, App02Settings

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


@router.get("/app02/settings", response_model=App02Settings)
def get_app02_settings():
    """获取 APP02 专属设置"""
    return App02Settings(
        ai_concurrency=int(ConfigManager.get("app02_ai_concurrency", "1")),
    )


@router.put("/app02/settings")
def update_app02_settings(data: App02Settings):
    """更新 APP02 专属设置"""
    val = max(1, min(10, data.ai_concurrency))
    ConfigManager.set("app02_ai_concurrency", str(val))
    return {"ok": True}
