"""M1 安全工具 — bcrypt 密码哈希、JWT 签发/验证、随机 ID 生成"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.m0_infrastructure.config import (
    get_jwt_secret,
    JWT_ALGORITHM,
    SESSION_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


def hash_password(password: str) -> str:
    """使用 bcrypt 对密码进行哈希"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码是否匹配 bcrypt 哈希"""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_user_id() -> str:
    """生成用户唯一 ID"""
    return f"user_{uuid.uuid4().hex[:12]}"


def generate_session_id() -> str:
    """生成会话唯一 ID"""
    return f"sess_{uuid.uuid4().hex[:12]}"


def generate_config_id() -> str:
    """生成 LLM 配置 ID"""
    return f"llmcfg_{uuid.uuid4().hex[:12]}"


def generate_verify_code_id() -> str:
    """生成验证码记录 ID"""
    return f"vc_{uuid.uuid4().hex[:12]}"


def create_access_token(user_id: str) -> str:
    """创建短期 Session Token"""
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=SESSION_TOKEN_EXPIRE_MINUTES),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """创建长期 Refresh Token"""
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """解码并验证 JWT Token"""
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


def hash_token(token: str) -> str:
    """对 token 进行 SHA256 哈希（用于存储到 sessions 表）"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()