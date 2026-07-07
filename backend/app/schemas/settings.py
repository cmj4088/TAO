"""Pydantic 请求/响应模型"""
from pydantic import BaseModel


class SettingItem(BaseModel):
    key: str
    value: str


class SettingsBatch(BaseModel):
    settings: list[SettingItem]


class LLMConfig(BaseModel):
    url: str = ""
    key: str = ""
    model: str = ""


class AppInfo(BaseModel):
    id: str
    name: str
    description: str


class VersionInfo(BaseModel):
    version: str


class App02Settings(BaseModel):
    ai_concurrency: int = 1
