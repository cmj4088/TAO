"""M0 系统级配置 — JWT/加密/应用配置，环境变量优先，自动生成敏感密钥"""
import os
import secrets
from pathlib import Path

# 数据目录
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# JWT 密钥文件路径
_JWT_SECRET_FILE = DATA_DIR / ".jwt_secret"


def _load_or_generate_jwt_secret() -> str:
    """加载或生成 JWT 密钥

    优先级：环境变量 JWT_SECRET > 持久化文件 data/.jwt_secret > 随机生成
    """
    # 1. 环境变量优先
    env_secret = os.getenv("JWT_SECRET", "")
    if env_secret:
        return env_secret

    # 2. 从持久化文件读取
    if _JWT_SECRET_FILE.exists():
        try:
            return _JWT_SECRET_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    # 3. 随机生成并持久化
    secret = secrets.token_urlsafe(32)
    try:
        _JWT_SECRET_FILE.write_text(secret, encoding="utf-8")
    except Exception:
        pass
    return secret


# 延迟初始化，确保首次调用时文件系统已就绪
_jwt_secret: str | None = None


def get_jwt_secret() -> str:
    """获取 JWT 密钥（延迟加载）"""
    global _jwt_secret
    if _jwt_secret is None:
        _jwt_secret = _load_or_generate_jwt_secret()
    return _jwt_secret


# JWT 配置
JWT_ALGORITHM = "HS256"
SESSION_TOKEN_EXPIRE_MINUTES = int(os.getenv("SESSION_TOKEN_EXPIRE_MINUTES", "120"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "90"))

# 应用配置
APP_NAME = os.getenv("APP_NAME", "教务办·智能体")
APP_VERSION = "0.2.1"
DEBUG = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")

# 管理员密码文件路径
ADMIN_INIT_FILE = DATA_DIR / "admin_init.txt"