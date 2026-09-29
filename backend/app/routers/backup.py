"""管理员备份/恢复路由 — 数据库导出下载与上传恢复

用途：
- 版本更新/换机部署前，管理员一键导出全库备份（标准 .db 文件）
- 恢复时上传备份文件，校验完整性后原子替换当前库，
  替换前自动备份当前库，替换后自动补跑迁移
"""
import shutil
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.database import (
    DB_FILE,
    _backup_database,
    _run_migrations,
)
from app.m1_auth.middleware import require_permission

router = APIRouter(prefix="/api/admin/backup", tags=["备份恢复"])

# 恢复校验：备份文件必须包含的核心业务表
_REQUIRED_TABLES = {"users", "roles", "sessions", "settings"}


@router.get("/export")
def export_backup(user: dict = Depends(require_permission("settings:write"))):
    """导出全库备份（标准 SQLite .db 文件下载）

    使用 VACUUM INTO 保证导出时刻的数据一致性（含未落盘页）。
    """
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"tao_backup_{stamp}.db"

    from app.database import BACKUP_DIR
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = BACKUP_DIR / f"export_tmp_{stamp}.db"

    conn = sqlite3.connect(str(DB_FILE))
    try:
        # VACUUM INTO 不能在事务内执行，sqlite3 默认 isolation_level 即可
        conn.execute("VACUUM INTO ?", (str(tmp_path),))
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="数据库导出失败，请查看后端日志")
    finally:
        conn.close()

    return FileResponse(
        path=str(tmp_path),
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        # 下载完成后删除服务器上的导出临时文件
        background=BackgroundTask(tmp_path.unlink, missing_ok=True),
    )


@router.post("/restore")
def restore_backup(
    file: UploadFile = File(...),
    user: dict = Depends(require_permission("settings:write")),
):
    """上传备份文件恢复全库

    流程：落盘临时文件 → 完整性与核心表校验 → 自动备份当前库
    → 原子替换数据库文件 → 重建连接池 → 补跑迁移（兼容旧版本备份）。
    恢复成功后所有已有会话失效，需重新登录。
    """
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="请上传 .db 备份文件")

    # 1. 落盘到临时文件（与数据库同目录，保证 os.replace 原子性）
    tmp_path = DB_FILE.parent / "restore_upload.tmp"
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="上传文件写入失败")

    # 2. 完整性 + 核心表校验
    conn = sqlite3.connect(str(tmp_path))
    try:
        try:
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            tables = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
        except sqlite3.DatabaseError:
            raise HTTPException(status_code=400, detail="文件不是有效的 SQLite 数据库")
        if integrity != "ok":
            raise HTTPException(status_code=400, detail=f"备份文件已损坏（integrity_check: {integrity}）")
    finally:
        conn.close()
    missing = _REQUIRED_TABLES - tables
    if missing:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"不是有效的 TAO 备份文件，缺少表: {', '.join(missing)}")

    # 3. 恢复前自动备份当前库（恢复错了还能再换回来）
    _backup_database("pre-restore")

    # 4. 用 SQLite backup API 把备份内容整库覆盖进当前连接池持有的库。
    #    不替换文件、不断开连接池——请求处理期间认证依赖还握着 tao.db 连接，
    #    Windows 下 os.replace 会因文件占用失败，backup API 天然规避此问题。
    from app.database import engine
    dest_raw = engine.raw_connection()
    try:
        src_conn = sqlite3.connect(str(tmp_path))
        try:
            src_conn.backup(dest_raw.connection)
            dest_raw.commit()
        finally:
            src_conn.close()
    finally:
        dest_raw.close()
    tmp_path.unlink(missing_ok=True)

    # 5. 兼容旧版本备份：补跑增量迁移（已是最新则为空操作）
    try:
        _run_migrations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"备份已恢复，但迁移执行失败: {e}")

    return {"data": {"message": "数据库已恢复，所有用户需重新登录"}, "error": None}
