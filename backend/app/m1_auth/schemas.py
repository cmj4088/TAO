"""M1 认证模块 — Pydantic 请求/响应模型"""
import re
from typing import Annotated

from pydantic import BaseModel, Field, AfterValidator

# 邮箱正则：允许内部域名（.local/.test 等），仅校验基本格式
_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


def _validate_email_format(v: str) -> str:
    """基本邮箱格式校验，允许内部域名"""
    if not _EMAIL_RE.match(v):
        raise ValueError("不是有效的邮箱地址")
    return v


EmailStrLoose = Annotated[str, AfterValidator(_validate_email_format)]


class RegisterRequest(BaseModel):
    """注册请求（需邮箱验证码）"""
    email: EmailStrLoose = Field(..., max_length=255, description="用户邮箱")
    password: str = Field(..., min_length=8, max_length=128, description="密码（至少 8 位）")
    display_name: str = Field(default="", max_length=50, description="显示名称")
    code: str = Field(..., min_length=6, max_length=6, description="6 位邮箱验证码")


class SendVerifyCodeRequest(BaseModel):
    """发送邮箱验证码请求"""
    email: EmailStrLoose = Field(..., max_length=255, description="接收验证码的邮箱")


class LoginRequest(BaseModel):
    """登录请求"""
    email: EmailStrLoose = Field(..., max_length=255, description="用户邮箱")
    password: str = Field(..., min_length=1, max_length=128, description="密码")


class TokenResponse(BaseModel):
    """Token 响应"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Token 刷新请求"""
    refresh_token: str = Field(..., min_length=1, description="Refresh Token")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: str
    email: str
    display_name: str
    role: str = ""
    permissions: list[str] = []
    created_at: str = ""
    updated_at: str = ""


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str = Field(..., min_length=1, description="旧密码")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码（至少 8 位）")


class LLMConfigRequest(BaseModel):
    """用户 LLM 配置请求"""
    url: str = Field(default="", max_length=2048)
    key: str = Field(default="", max_length=512)  # 新 API Key（空字符串表示不更新 key）
    model: str = Field(default="", max_length=256)
    key_changed: bool = False


class LLMConfigResponse(BaseModel):
    """用户 LLM 配置响应（Key 脱敏）"""
    url: str = ""
    key: str = ""           # 脱敏版本
    model: str = ""
    has_key: bool = False


class UserListItem(BaseModel):
    """用户列表项（admin 查看所有用户）"""
    id: str
    email: str
    display_name: str
    role: str
    created_at: str


class CreateUserRequest(BaseModel):
    """Admin 创建用户"""
    email: EmailStrLoose = Field(..., max_length=255, description="用户邮箱")
    password: str = Field(..., min_length=8, max_length=128, description="密码（至少 8 位）")
    display_name: str = Field(default="", max_length=50, description="显示名称")
    role: str = Field(default="teacher", max_length=50, description="角色")


class ResetPasswordRequest(BaseModel):
    """Admin 重置用户密码"""
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码（至少 8 位）")


class LLMTestRequest(BaseModel):
    """测试 LLM 连接请求"""
    url: str = Field(default="", max_length=2048)
    key: str = Field(default="", max_length=512)
    model: str = Field(default="", max_length=256)