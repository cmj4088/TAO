"""M1 认证服务 — 注册、登录、Token 刷新、登出、用户管理等业务逻辑"""
import random
import smtplib
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.m0_infrastructure.config import ADMIN_INIT_FILE
from app.crypto_utils import encrypt, decrypt, mask_key
from app.m1_auth.models import (
    User, Session as SessionModel, UserLLMConfig, VerifyCode,
    Role, Permission, RolePermission,
)
from app.m1_auth.security import (
    hash_password, verify_password,
    generate_user_id, generate_session_id, generate_config_id, generate_verify_code_id,
    create_access_token, create_refresh_token,
    decode_token, hash_token,
)

# QQ邮箱 SMTP 配置
SMTP_HOST = "smtp.qq.com"
SMTP_PORT = 465
SMTP_USER = "3227738872@qq.com"
SMTP_PASSWORD = "vlibsgumqyehciad"
SMTP_FROM_NAME = "教务办·智能体"


class AuthService:
    """认证服务"""

    def __init__(self, db: Session):
        self.db = db

    def register(self, email: str, password: str, display_name: str = "", code: str = "") -> dict:
        """用户注册（需邮箱验证码）"""
        # 校验验证码
        if not code:
            raise ValueError("请输入邮箱验证码")
        self._verify_code(email, code)

        # 检查邮箱是否已注册
        existing = self.db.query(User).filter(User.email == email).first()
        if existing is not None:
            raise ValueError("该邮箱已被注册")

        user_id = generate_user_id()
        password_hash = hash_password(password)
        now = _now_str()

        user = User(
            id=user_id,
            email=email,
            password_hash=password_hash,
            display_name=display_name or email.split("@")[0],
            role_id="teacher",
            created_at=now,
            updated_at=now,
        )
        self.db.add(user)
        self.db.commit()

        return self._generate_tokens(user_id)

    def login(self, email: str, password: str) -> dict:
        """用户登录"""
        user = self.db.query(User).filter(User.email == email).first()
        if user is None:
            raise ValueError("邮箱或密码错误")

        if not verify_password(password, user.password_hash):
            raise ValueError("邮箱或密码错误")

        return self._generate_tokens(user.id)

    def refresh_token(self, refresh_token: str) -> dict:
        """刷新 Session Token"""
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError("无效的 Refresh Token")
        except Exception:
            raise ValueError("无效或过期的 Refresh Token")

        user_id = payload["sub"]
        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise ValueError("用户不存在")

        return self._generate_tokens(user_id)

    def logout(self, access_token: str) -> None:
        """用户登出，撤销当前 Token"""
        token_hash = hash_token(access_token)
        now = _now_str()

        self.db.execute(
            text("UPDATE sessions SET revoked_at = :revoked_at "
                 "WHERE token_hash = :token_hash AND revoked_at IS NULL"),
            {"token_hash": token_hash, "revoked_at": now},
        )
        self.db.commit()

    def get_current_user(self, user_id: str) -> dict | None:
        """获取当前用户信息（含角色和权限）"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            return None

        role = self.db.query(Role).filter(Role.id == user.role_id).first()
        permissions = self._get_user_permissions(user.role_id)

        return {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "role": role.name if role else "",
            "permissions": permissions,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

    def change_password(self, user_id: str, old_password: str, new_password: str) -> None:
        """修改密码"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise ValueError("用户不存在")

        if not verify_password(old_password, user.password_hash):
            raise ValueError("旧密码不正确")

        if len(new_password) < 8:
            raise ValueError("新密码至少 8 位")

        # 更新密码
        user.password_hash = hash_password(new_password)
        user.updated_at = _now_str()

        # 清空该用户所有会话，强制所有设备重新登录
        self.db.execute(
            text("UPDATE sessions SET revoked_at = :now WHERE user_id = :uid AND revoked_at IS NULL"),
            {"uid": user_id, "now": _now_str()},
        )

        # 撤销 admin 初始密码文件
        if user.email == "admin@tao.local" and ADMIN_INIT_FILE.exists():
            try:
                ADMIN_INIT_FILE.unlink()
            except Exception:
                pass

        self.db.commit()

    def get_llm_config(self, user_id: str) -> dict:
        """获取用户 LLM 配置（Key 脱敏）"""
        config = self.db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).first()
        if config is None:
            return {"url": "", "key": "", "model": "", "has_key": False}

        plain_key = decrypt(config.llm_key_encrypted)
        return {
            "url": config.llm_url,
            "key": mask_key(plain_key) if plain_key else "",
            "model": config.llm_model,
            "has_key": bool(plain_key),
        }

    def update_llm_config(self, user_id: str, url: str, key: str, model: str, key_changed: bool = False) -> None:
        """更新用户 LLM 配置"""
        config = self.db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).first()
        now = _now_str()

        if config is None:
            config = UserLLMConfig(
                id=generate_config_id(),
                user_id=user_id,
                llm_url=url,
                llm_key_encrypted=encrypt(key) if key else "",
                llm_model=model,
                created_at=now,
                updated_at=now,
            )
            self.db.add(config)
        else:
            config.llm_url = url
            config.llm_model = model
            config.updated_at = now
            if key_changed and key:
                config.llm_key_encrypted = encrypt(key)

        self.db.commit()

    def get_llm_api_key(self, user_id: str) -> str:
        """获取用户 LLM API Key（明文，用于调用 AI）"""
        config = self.db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).first()
        if config is None:
            return ""
        return decrypt(config.llm_key_encrypted)

    def get_llm_config_full(self, user_id: str) -> tuple[str, str, str]:
        """获取用户完整 LLM 配置（url, key, model），用于 AI 调用"""
        config = self.db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).first()
        if config is None:
            return ("", "", "")
        url = config.llm_url
        key = decrypt(config.llm_key_encrypted)
        model = config.llm_model
        return (url, key, model)

    def list_users(self) -> list[dict]:
        """Admin 查看所有用户列表"""
        users = self.db.query(User).order_by(User.created_at.desc()).all()
        roles = {r.id: r.name for r in self.db.query(Role).all()}
        return [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "role": roles.get(u.role_id, ""),
                "created_at": u.created_at,
            }
            for u in users
        ]

    def create_user(self, email: str, password: str, display_name: str = "", role: str = "teacher") -> dict:
        """Admin 创建用户"""
        existing = self.db.query(User).filter(User.email == email).first()
        if existing is not None:
            raise ValueError("该邮箱已被注册")

        # 验证角色存在
        role_obj = self.db.query(Role).filter(Role.id == role).first()
        if role_obj is None:
            raise ValueError(f"角色 '{role}' 不存在")

        user_id = generate_user_id()
        now = _now_str()

        user = User(
            id=user_id,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name or email.split("@")[0],
            role_id=role,
            created_at=now,
            updated_at=now,
        )
        self.db.add(user)
        self.db.commit()

        return {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "role": role,
            "created_at": now,
        }

    def delete_user(self, user_id: str, current_user_id: str = "") -> None:
        """Admin 删除用户（不能删除自己）"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise ValueError("用户不存在")
        if user_id == current_user_id:
            raise ValueError("不能删除自己的账号")

        # 删除 LLM 配置
        self.db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).delete()
        # 删除会话
        self.db.query(SessionModel).filter(SessionModel.user_id == user_id).delete()
        # 删除用户
        self.db.delete(user)
        self.db.commit()

    def reset_user_password(self, user_id: str, new_password: str) -> None:
        """Admin 重置用户密码"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise ValueError("用户不存在")

        if len(new_password) < 8:
            raise ValueError("新密码至少 8 位")

        # 更新密码
        user.password_hash = hash_password(new_password)
        user.updated_at = _now_str()

        # 清空该用户所有会话，强制重新登录
        self.db.execute(
            text("UPDATE sessions SET revoked_at = :now WHERE user_id = :uid AND revoked_at IS NULL"),
            {"uid": user_id, "now": _now_str()},
        )

        self.db.commit()

    def send_verify_code(self, email: str) -> None:
        """发送邮箱验证码（60 秒防刷 + 每日上限 5 次）"""
        now = _now_str()
        now_dt = datetime.now(timezone.utc)

        # 检查 60 秒内是否已发送
        recent = self.db.query(VerifyCode).filter(
            VerifyCode.email == email,
            VerifyCode.created_at >= (now_dt - timedelta(seconds=60)).strftime("%Y-%m-%d %H:%M:%S"),
        ).first()
        if recent is not None:
            raise ValueError("验证码已发送，请 60 秒后再试")

        # 检查当日发送次数上限
        today_start = now_dt.strftime("%Y-%m-%d 00:00:00")
        today_count = self.db.query(VerifyCode).filter(
            VerifyCode.email == email,
            VerifyCode.created_at >= today_start,
        ).count()
        if today_count >= 5:
            raise ValueError("今日验证码发送次数已达上限（5 次），请明天再试")

        # 生成 6 位数字验证码
        code = "".join(random.choices("0123456789", k=6))
        expires_at = (now_dt + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")

        # 先发邮件，成功后再存数据库
        self._send_email(email, code)

        vc = VerifyCode(
            id=generate_verify_code_id(),
            email=email,
            code=code,
            expires_at=expires_at,
            used="0",
            created_at=now,
        )
        self.db.add(vc)
        self.db.commit()

    def _verify_code(self, email: str, code: str) -> None:
        """校验验证码"""
        now = _now_str()

        # 查找该邮箱最新一条未使用、未过期的验证码
        vc = self.db.query(VerifyCode).filter(
            VerifyCode.email == email,
            VerifyCode.code == code,
            VerifyCode.used == "0",
            VerifyCode.expires_at > now,
        ).order_by(VerifyCode.created_at.desc()).first()

        if vc is None:
            raise ValueError("验证码错误或已过期")

        # 标记为已使用
        vc.used = "1"
        self.db.commit()

    def _send_email(self, to_email: str, code: str) -> None:
        """通过 QQ邮箱 SMTP 发送验证码邮件"""
        subject = "教务办·智能体 — 邮箱验证码"
        body = f"""您好！

您正在注册教务办·智能体系统，验证码为：

    {code}

验证码 5 分钟内有效，请勿泄露给他人。

如果这不是您本人的操作，请忽略此邮件。

---
教务办·智能体系统
{_now_str()[:10]}
"""

        msg = EmailMessage()
        msg.set_content(body, subtype="plain", charset="utf-8")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email

        try:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
        except smtplib.SMTPAuthenticationError:
            raise ValueError("邮件发送失败：SMTP 认证失败，请检查邮箱配置")
        except smtplib.SMTPException as e:
            raise ValueError(f"邮件发送失败：{str(e)}")
        except Exception as e:
            raise ValueError(f"邮件发送异常：{str(e)}")

    def _generate_tokens(self, user_id: str) -> dict:
        """生成 Token 对并存储 session"""
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)

        session_id = generate_session_id()
        token_hash = hash_token(access_token)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=60)).strftime("%Y-%m-%d %H:%M:%S")
        now = _now_str()

        session = SessionModel(
            id=session_id,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=now,
        )
        self.db.add(session)
        self.db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 7200,
        }

    def _get_user_permissions(self, role_id: str) -> list[str]:
        """获取角色对应的权限列表"""
        rps = self.db.query(RolePermission).filter(RolePermission.role_id == role_id).all()
        perm_ids = [rp.permission_id for rp in rps]
        if not perm_ids:
            return []
        perms = self.db.query(Permission).filter(Permission.id.in_(perm_ids)).all()
        return [f"{p.resource}:{p.action}" for p in perms]


def _now_str() -> str:
    """返回当前 UTC 时间字符串"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")