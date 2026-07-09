"""配置相关 API — 敏感字段自动脱敏返回"""
from fastapi import APIRouter
from app.config import ConfigManager
from app.crypto_utils import mask_key
from app.schemas.settings import SettingItem, SettingsBatch, LLMConfig, App02Settings

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    """获取所有设置项（敏感字段已脱敏）"""
    return ConfigManager.get_all()


@router.put("/settings")
def update_settings(batch: SettingsBatch):
    """批量更新设置（敏感字段自动加密存储）"""
    ConfigManager.set_batch({s.key: s.value for s in batch.settings})
    return {"ok": True}


@router.get("/admin/llm", response_model=LLMConfig)
def get_llm_config():
    """获取大模型配置（API Key 脱敏返回）"""
    # 一次查询获取明文 key，避免重复解密
    plain_key = ConfigManager.get("llm_key", "")
    return LLMConfig(
        url=ConfigManager.get("llm_url", ""),
        key=mask_key(plain_key) if plain_key else "",
        model=ConfigManager.get("llm_model", ""),
        has_key=bool(plain_key),
    )


@router.put("/admin/llm")
def update_llm_config(config: LLMConfig):
    """更新大模型配置

    - key_changed=False 时不更新 key（保持原值）
    - key_changed=True 时用 config.key 更新
    """
    ConfigManager.set("llm_url", config.url)
    ConfigManager.set("llm_model", config.model)
    # 使用明确的协议字段 key_changed 判断，不再依赖 "****" 字符串匹配
    if config.key_changed and config.key:
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