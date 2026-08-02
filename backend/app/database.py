"""数据库连接和建表"""
import os
import secrets
import string

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

SYNC_DATABASE_URL = "sqlite:///./data/tao.db"

engine = create_engine(SYNC_DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def _generate_admin_password() -> str:
    """生成随机管理员密码：12 位混合字符"""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(12))


def _preseed_data(db):
    """预设角色、权限、角色-权限关联、admin 账号"""
    from datetime import datetime, timezone

    from app.m1_auth.models import Role, Permission, RolePermission, User
    from app.m1_auth.security import hash_password
    from app.crypto_utils import encrypt

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # === 角色 ===
    roles_data = [
        ("admin", "系统管理员，拥有全部权限"),
        ("teacher", "教师，可使用文件审查和管理自己的 LLM 配置"),
    ]
    for rid, desc in roles_data:
        if not db.query(Role).filter(Role.id == rid).first():
            db.add(Role(id=rid, name=rid, description=desc))

    # === 权限 ===
    perms_data = [
        ("perm_user_read", "user", "read", "查看用户列表"),
        ("perm_user_write", "user", "write", "创建/删除用户"),
        ("perm_settings_read", "settings", "read", "查看系统设置"),
        ("perm_settings_write", "settings", "write", "修改系统设置"),
        ("perm_stats_read", "stats", "read", "查看统计数据"),
        ("perm_review_use", "review", "use", "使用文件审查功能"),
    ]
    for pid, resource, action, desc in perms_data:
        if not db.query(Permission).filter(Permission.id == pid).first():
            db.add(Permission(id=pid, resource=resource, action=action, description=desc))

    db.flush()  # 确保角色和权限 ID 已写入

    # === 角色-权限关联 ===
    # admin 拥有全部权限
    all_perm_ids = [p[0] for p in perms_data]
    for pid in all_perm_ids:
        existing = db.query(RolePermission).filter(
            RolePermission.role_id == "admin",
            RolePermission.permission_id == pid,
        ).first()
        if not existing:
            db.add(RolePermission(role_id="admin", permission_id=pid))

    # teacher 仅有 review:use
    teacher_perms = ["perm_review_use"]
    for pid in teacher_perms:
        existing = db.query(RolePermission).filter(
            RolePermission.role_id == "teacher",
            RolePermission.permission_id == pid,
        ).first()
        if not existing:
            db.add(RolePermission(role_id="teacher", permission_id=pid))

    # === 默认 admin 账号 ===
    admin_email = "admin@tao.local"
    admin = db.query(User).filter(User.email == admin_email).first()
    admin_password = None

    if admin is None:
        admin_password = _generate_admin_password()
        admin = User(
            id="user_admin",
            email=admin_email,
            password_hash=hash_password(admin_password),
            display_name="管理员",
            role_id="admin",
            created_at=now,
            updated_at=now,
        )
        db.add(admin)
        db.flush()

    db.commit()

    # 将 admin 密码写入文件（仅在首次创建时）
    if admin_password:
        from app.m0_infrastructure.config import ADMIN_INIT_FILE
        try:
            ADMIN_INIT_FILE.write_text(
                f"管理员账号: {admin_email}\n初始密码: {admin_password}\n"
                f"请登录后立即修改密码！\n",
                encoding="utf-8",
            )
            # 设置文件权限为仅当前用户可读写（Windows 下尽力而为）
            try:
                os.chmod(ADMIN_INIT_FILE, 0o600)
            except Exception:
                pass
        except Exception:
            pass


def _migrate_llm_config(db):
    """将全局 settings 表中的 LLM 配置迁移到 admin 的 user_llm_configs"""
    from app.models.settings import Setting
    from app.m1_auth.models import UserLLMConfig
    from app.crypto_utils import encrypt, decrypt, is_encrypted

    admin_id = "user_admin"
    existing_config = db.query(UserLLMConfig).filter(UserLLMConfig.user_id == admin_id).first()
    if existing_config:
        return  # 已迁移过

    # 从全局 settings 读取 LLM 配置
    llm_url = db.query(Setting).filter(Setting.key == "llm_url").first()
    llm_key = db.query(Setting).filter(Setting.key == "llm_key").first()
    llm_model = db.query(Setting).filter(Setting.key == "llm_model").first()

    url = llm_url.value if llm_url else ""
    model = llm_model.value if llm_model else ""

    # 解密现有 key（或使用默认值）
    key_plain = ""
    if llm_key and llm_key.value:
        if is_encrypted(llm_key.value):
            key_plain = decrypt(llm_key.value)
        else:
            key_plain = llm_key.value

    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    config = UserLLMConfig(
        id="llmcfg_admin",
        user_id=admin_id,
        llm_url=url,
        llm_key_encrypted=encrypt(key_plain) if key_plain else "",
        llm_model=model,
        created_at=now,
        updated_at=now,
    )
    db.add(config)
    db.commit()


def init_db():
    """创建所有表和默认数据"""
    os.makedirs("data", exist_ok=True)

    # 导入所有模型，确保 Base.metadata 知道它们
    import app.models.settings  # noqa: F401
    import app.m1_auth.models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    from app.models.settings import Setting
    from app.crypto_utils import encrypt, is_encrypted

    with SessionLocal() as db:
        # 迁移已有的明文 llm_key 为加密存储
        existing_key = db.query(Setting).filter(Setting.key == "llm_key").first()
        if existing_key and existing_key.value and not is_encrypted(existing_key.value):
            existing_key.value = encrypt(existing_key.value)
            db.commit()

        # 系统级默认配置
        if not existing_key:
            default_key = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
            db.add(Setting(key="llm_key", value=encrypt(default_key)))
        if not db.query(Setting).filter(Setting.key == "llm_url").first():
            db.add(Setting(key="llm_url", value="https://ark.cn-beijing.volces.com/api/v3/chat/completions"))
        if not db.query(Setting).filter(Setting.key == "llm_model").first():
            db.add(Setting(key="llm_model", value="deepseek-v4-pro-260425"))
        if not db.query(Setting).filter(Setting.key == "app02_ai_concurrency").first():
            db.add(Setting(key="app02_ai_concurrency", value="1"))
        db.commit()

        # 预设认证数据
        _preseed_data(db)

        # 迁移 LLM 配置到 admin 用户
        _migrate_llm_config(db)