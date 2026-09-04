"""M1 认证中间件 — FastAPI 依赖注入，提供 get_current_user 和 require_permission"""
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.m1_auth.security import decode_token, hash_token
from app.m1_auth.auth_service import AuthService
from app.m1_auth.models import Session as SessionModel

security_scheme = HTTPBearer(auto_error=False)


def get_db() -> Session:
    """获取数据库会话（同步版依赖注入）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """从请求中提取并验证当前用户

    用作 FastAPI 依赖注入：
        @router.get("/api/protected")
        def protected(user: dict = Depends(get_current_user)):
            ...
    """
    if credentials is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="未提供认证凭据")

    token = credentials.credentials

    # 解码 JWT
    try:
        payload = decode_token(token)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="无效或过期的 Token")

    if payload.get("type") != "access":
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="无效的 Token 类型")

    # 检查 Token 是否已被撤销
    token_hash_val = hash_token(token)
    revoked = db.query(SessionModel).filter(
        SessionModel.token_hash == token_hash_val,
        SessionModel.revoked_at.isnot(None),
    ).first()
    if revoked is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Token 已被撤销")

    user_id = payload["sub"]

    # 查询用户
    service = AuthService(db)
    user = service.get_current_user(user_id)
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="用户不存在")

    return user


def require_permission(permission: str):
    """权限检查依赖工厂

    用法：
        @router.get("/api/admin/users")
        def list_users(user: dict = Depends(require_permission("user:read"))):
            ...
    """
    def checker(user: dict = Depends(get_current_user)) -> dict:
        perms = user.get("permissions", [])
        if permission not in perms:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="权限不足")
        return user
    return checker