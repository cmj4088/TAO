"""Pydantic 请求/响应模型"""
from pydantic import BaseModel


class SettingItem(BaseModel):
    key: str
    value: str


class SettingsBatch(BaseModel):
    settings: list[SettingItem]


class LLMConfig(BaseModel):
    url: str = ""
    key: str = ""              # 前端返回脱敏版本，如 ark-00ec****b92c
    model: str = ""
    has_key: bool = False      # 是否已配置 API Key（用于前端判断显示状态）
    key_changed: bool = False  # 前端标记：用户是否输入了新 key（替代 "****" 字符串判断）


class AppInfo(BaseModel):
    id: str
    name: str
    description: str


class VersionInfo(BaseModel):
    version: str


class App02Settings(BaseModel):
    ai_concurrency: int = 1
