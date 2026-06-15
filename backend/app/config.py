"""配置管理：从 SQLite 读写配置"""
from app.database import SessionLocal
from app.models.settings import Setting


class ConfigManager:
    """键值配置的读写封装"""

    @staticmethod
    def get(key: str, default: str = "") -> str:
        with SessionLocal() as db:
            row = db.query(Setting).filter(Setting.key == key).first()
            return row.value if row else default

    @staticmethod
    def set(key: str, value: str):
        with SessionLocal() as db:
            row = db.query(Setting).filter(Setting.key == key).first()
            if row:
                row.value = value
            else:
                db.add(Setting(key=key, value=value))
            db.commit()

    @staticmethod
    def get_all() -> dict[str, str]:
        with SessionLocal() as db:
            return {s.key: s.value for s in db.query(Setting).all()}

    @staticmethod
    def set_batch(settings: dict[str, str]):
        with SessionLocal() as db:
            for key, value in settings.items():
                row = db.query(Setting).filter(Setting.key == key).first()
                if row:
                    row.value = value
                else:
                    db.add(Setting(key=key, value=value))
            db.commit()
