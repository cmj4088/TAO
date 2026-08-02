"""M1 认证路由 — 注册、登录、刷新、登出、用户管理、LLM 配置"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.m1_auth.schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse,
    ChangePasswordRequest,
    LLMConfigRequest, LLMConfigResponse,
    UserListItem, CreateUserRequest, ResetPasswordRequest,
    LLMTestRequest, SendVerifyCodeRequest,
)
from app.m1_auth.auth_service import AuthService
from app.m1_auth.middleware import get_current_user, require_permission, get_db

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册（需邮箱验证码，默认 teacher 角色）"""
    service = AuthService(db)
    try:
        tokens = service.register(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
            code=request.code,
        )
        return {"data": tokens, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/send-verify-code")
def send_verify_code(request: SendVerifyCodeRequest, db: Session = Depends(get_db)):
    """发送邮箱验证码（用于注册）"""
    service = AuthService(db)
    try:
        service.send_verify_code(request.email)
        return {"data": {"message": "验证码已发送，请查收邮件"}, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    service = AuthService(db)
    try:
        tokens = service.login(email=request.email, password=request.password)
        return {"data": tokens, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    """刷新 Token"""
    service = AuthService(db)
    try:
        tokens = service.refresh_token(request.refresh_token)
        return {"data": tokens, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
def logout(
    req: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户登出"""
    service = AuthService(db)
    auth_header = req.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        service.logout(token)
    return {"data": {"message": "已登出"}, "error": None}


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return {"data": user, "error": None}


@router.put("/change-password")
def change_password(
    request: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改密码"""
    service = AuthService(db)
    try:
        service.change_password(
            user["id"],
            old_password=request.old_password,
            new_password=request.new_password,
        )
        return {"data": {"message": "密码修改成功，所有设备已登出"}, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/llm-config")
def get_llm_config(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户的 LLM 配置（Key 脱敏）"""
    service = AuthService(db)
    config = service.get_llm_config(user["id"])
    return {"data": config, "error": None}


@router.put("/llm-config")
def update_llm_config(
    request: LLMConfigRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新当前用户的 LLM 配置"""
    service = AuthService(db)
    service.update_llm_config(
        user_id=user["id"],
        url=request.url,
        key=request.key,
        model=request.model,
        key_changed=request.key_changed,
    )
    return {"data": {"message": "LLM 配置已保存"}, "error": None}


@router.post("/llm-test")
def test_llm_connection(
    request: LLMTestRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """测试 LLM API 连接是否正常"""
    import json, urllib.request, urllib.error

    service = AuthService(db)

    # 获取 API Key：优先使用请求中的 key，否则从用户配置读取
    api_url = request.url
    api_key = request.key
    api_model = request.model

    if not api_key:
        # 从用户配置读取
        user_url, user_key, user_model = service.get_llm_config_full(user["id"])
        api_url = api_url or user_url
        api_key = user_key
        api_model = api_model or user_model

    if not api_url or not api_key:
        raise HTTPException(status_code=400, detail="请先配置 API 地址和密钥")

    # 发送测试请求
    test_data = json.dumps({
        "model": api_model or "deepseek-chat",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5,
    }).encode("utf-8")

    req = urllib.request.Request(
        api_url,
        data=test_data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read().decode("utf-8"))
        return {"data": {"status": "ok", "model": result.get("model", ""), "message": "连接成功"}, "error": None}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        raise HTTPException(status_code=400, detail=f"API 返回错误 ({e.code}): {err_body}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"连接失败: {str(e)}")


# ===== Admin 专属端点 =====

@router.get("/users")
def list_users(
    user: dict = Depends(require_permission("user:read")),
    db: Session = Depends(get_db),
):
    """Admin 查看所有用户列表"""
    service = AuthService(db)
    users = service.list_users()
    return {"data": users, "error": None}


@router.post("/users")
def create_user(
    request: CreateUserRequest,
    user: dict = Depends(require_permission("user:write")),
    db: Session = Depends(get_db),
):
    """Admin 创建用户"""
    service = AuthService(db)
    try:
        new_user = service.create_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
            role=request.role,
        )
        return {"data": new_user, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    user: dict = Depends(require_permission("user:write")),
    db: Session = Depends(get_db),
):
    """Admin 删除用户"""
    service = AuthService(db)
    try:
        service.delete_user(user_id, current_user_id=user["id"])
        return {"data": {"message": "用户已删除"}, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    request: ResetPasswordRequest,
    user: dict = Depends(require_permission("user:write")),
    db: Session = Depends(get_db),
):
    """Admin 重置用户密码"""
    service = AuthService(db)
    try:
        service.reset_user_password(user_id, request.new_password)
        return {"data": {"message": "密码已重置，用户需重新登录"}, "error": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))