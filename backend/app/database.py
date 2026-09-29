"""数据库连接、Alembic 版本迁移、自动备份与回滚"""
import os
import secrets
import shutil
import sqlite3
import string
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# 数据库文件固定锚定在 backend 目录下（app/ 的上一级），
# 不受进程工作目录影响，Docker 与本地行为一致
_BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = _BACKEND_DIR / "data"
DB_FILE = DATA_DIR / "tao.db"
SYNC_DATABASE_URL = f"sqlite:///{DB_FILE.as_posix()}"

# 自动备份目录与保留份数（迁移/恢复前各备份一次，超出滚动删除）
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_KEEP = 10

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


def _backup_database(reason: str = "migrate"):
    """用 SQLite 原生 VACUUM INTO 生成一致性快照备份

    返回备份文件路径；数据库文件尚不存在（首次启动）时返回 None。
    备份超出 BACKUP_KEEP 份时滚动删除最旧的。
    """
    if not DB_FILE.exists():
        return None

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # 追加随机后缀：多 worker 同秒启动时避免 VACUUM INTO 撞名（目标文件已存在会报错）
    dest = BACKUP_DIR / f"tao_{stamp}_{secrets.token_hex(3)}_{reason}.db"

    conn = sqlite3.connect(str(DB_FILE))
    try:
        conn.execute("VACUUM INTO ?", (str(dest),))
    finally:
        conn.close()

    # 滚动清理：仅保留最近 BACKUP_KEEP 份
    backups = sorted(BACKUP_DIR.glob("tao_*.db"))
    for old in backups[:-BACKUP_KEEP]:
        try:
            old.unlink()
        except OSError:
            pass
    return dest


def _run_migrations():
    """以编程方式执行 Alembic 迁移到最新版本

    存量库接管：v2.0.1 之前部署的库有业务表但没有 alembic_version，
    结构恰好等于基线版本 0001_initial，先 stamp 到该版本再升级，
    避免重复建表报错。
    """
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", SYNC_DATABASE_URL)

    if DB_FILE.exists():
        conn = sqlite3.connect(str(DB_FILE))
        try:
            tables = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
        finally:
            conn.close()

        if "users" in tables and "alembic_version" not in tables:
            # 存量库：标记为基线版本，后续 upgrade 只执行增量迁移
            command.stamp(cfg, "0001_initial")

    command.upgrade(cfg, "head")


def reload_engine():
    """恢复备份后重建连接池

    只对既有 SessionLocal 做 configure，保持对象身份不变，
    避免其他模块 `from app.database import SessionLocal` 拿到旧引用。
    """
    global engine
    engine.dispose()
    engine = create_engine(SYNC_DATABASE_URL, echo=False)
    SessionLocal.configure(bind=engine)


@contextmanager
def _boot_lock():
    """跨进程启动锁：gunicorn 多 worker 并发启动时串行化 init_db

    否则 4 个 worker 同时跑 Alembic 迁移会在 SQLite 上竞争，
    导致 worker 启动失败（exit code 3）。POSIX 用 fcntl，Windows 用 msvcrt。
    """
    lock_file = open(DATA_DIR / "init.lock", "w")
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        lock_file.close()


def init_db():
    """初始化数据库：自动备份 → Alembic 迁移（失败回滚）→ 种子数据"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with _boot_lock():
        _init_db_locked()


def _init_db_locked():
    """init_db 的实际逻辑（持有 _boot_lock 时调用）"""

    # 迁移前自动备份现有库（首次启动无库则跳过）
    backup = _backup_database("pre-migrate")

    try:
        _run_migrations()
    except Exception as e:
        # 迁移失败：回滚到迁移前备份，保证旧版本后端仍能启动
        if backup:
            shutil.copy2(backup, DB_FILE)
        rolled_back = "，已回滚到迁移前备份" if backup else ""
        raise RuntimeError(f"数据库迁移失败{rolled_back}: {e}") from e

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