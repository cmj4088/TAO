"""配置管理：从 SQLite 读写配置，敏感字段自动 AES 加密"""
from app.database import SessionLocal
from app.models.settings import Setting
from app.crypto_utils import encrypt, decrypt, mask_key, is_encrypted

# 需要加密存储的 key 列表
_SENSITIVE_KEYS = {"llm_key"}


class ConfigManager:
    """键值配置的读写封装，敏感字段自动加解密"""

    @staticmethod
    def get(key: str, default: str = "") -> str:
        """读取配置（自动解密敏感字段）"""
        with SessionLocal() as db:
            row = db.query(Setting).filter(Setting.key == key).first()
            if not row:
                return default
            value = row.value
            if key in _SENSITIVE_KEYS:
                # 兼容旧数据：如果发现明文，自动迁移为加密存储
                if value and not is_encrypted(value):
                    encrypted = encrypt(value)
                    row.value = encrypted
                    db.commit()
                    return value
                return decrypt(value)
            return value

    @staticmethod
    def get_masked(key: str) -> str:
        """读取配置的脱敏版本（仅对敏感字段有效）"""
        plain = ConfigManager.get(key)
        if key in _SENSITIVE_KEYS:
            return mask_key(plain)
        return plain

    @staticmethod
    def has_key(key: str) -> bool:
        """判断某个配置是否有值"""
        return bool(ConfigManager.get(key))

    @staticmethod
    def set(key: str, value: str):
        """写入配置（自动加密敏感字段）"""
        if key in _SENSITIVE_KEYS and value:
            value = encrypt(value)
        with SessionLocal() as db:
            row = db.query(Setting).filter(Setting.key == key).first()
            if row:
                row.value = value
            else:
                db.add(Setting(key=key, value=value))
            db.commit()

    @staticmethod
    def get_all() -> dict[str, str]:
        """获取所有配置（敏感字段返回脱敏版本）"""
        with SessionLocal() as db:
            result = {}
            for s in db.query(Setting).all():
                if s.key in _SENSITIVE_KEYS:
                    # 使用 get() 而非直接 decrypt()，确保旧明文数据走迁移逻辑
                    result[s.key] = mask_key(ConfigManager.get(s.key))
                else:
                    result[s.key] = s.value
            return result

    @staticmethod
    def set_batch(settings: dict[str, str]):
        """批量写入配置（自动加密敏感字段）"""
        with SessionLocal() as db:
            for key, value in settings.items():
                store_value = value
                if key in _SENSITIVE_KEYS and value:
                    store_value = encrypt(value)
                row = db.query(Setting).filter(Setting.key == key).first()
                if row:
                    row.value = store_value
                else:
                    db.add(Setting(key=key, value=store_value))
            db.commit()