"""M1 认证模块 — SQLAlchemy ORM 模型"""
from sqlalchemy import Column, String, ForeignKey
from app.database import Base


class Role(Base):
    """角色表"""
    __tablename__ = "roles"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, default="")


class Permission(Base):
    """权限表"""
    __tablename__ = "permissions"

    id = Column(String, primary_key=True)
    resource = Column(String, nullable=False)
    action = Column(String, nullable=False)
    description = Column(String, default="")


class RolePermission(Base):
    """角色-权限关联表"""
    __tablename__ = "role_permissions"

    role_id = Column(String, ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(String, ForeignKey("permissions.id"), primary_key=True)


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, default="")
    role_id = Column(String, ForeignKey("roles.id"), default="teacher")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class Session(Base):
    """会话表"""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, nullable=False)
    expires_at = Column(String, nullable=False)
    revoked_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)


class UserLLMConfig(Base):
    """用户 LLM 配置表"""
    __tablename__ = "user_llm_configs"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    llm_url = Column(String, default="")
    llm_key_encrypted = Column(String, default="")
    llm_model = Column(String, default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class VerifyCode(Base):
    """邮箱验证码表"""
    __tablename__ = "verify_codes"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(String, nullable=False)
    used = Column(String, default="0")  # "0"=未使用, "1"=已使用
    created_at = Column(String, nullable=False)