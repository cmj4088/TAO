"""app02 文件审查 API"""
import io
import os
import re
import uuid
import threading
import tempfile
import traceback
from urllib.parse import quote

import openpyxl
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.app02 import (
    ReviewIssue,
    FileReviewResult,
    UploadedFileInfo,
    UploadResponse,
    ReviewResponse,
)
from app.services.doc_reviewer import review_single, classify_template
from app.services.doc_converter import convert_doc_to_docx, convert_docx_to_pdf
from app.services.ai_reviewer_app02 import review as ai_review
from app.config import ConfigManager

router = APIRouter(prefix="/api/app02", tags=["app02"])

TEMP_DIR = os.path.join(tempfile.gettempdir(), "tao_app02")
os.makedirs(TEMP_DIR, exist_ok=True)

_session_files: dict[str, dict] = {}
_session_results: list[FileReviewResult] = []
_reviewed_file_ids: set[str] = set()

# AI审查后台任务存储
_ai_tasks: dict[str, dict] = {}


@router.get("/status")
def get_status():
    return {"status": "ok", "message": "app02 文件审查模块就绪"}


@router.post("/upload", response_model=UploadResponse)
async def upload_files(files: list[UploadFile] = File(...)):
    """上传文件（累加模式，不清空已有文件）"""
    global _session_files

    infos: list[UploadedFileInfo] = []

    for f in files:
        if not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in (".doc", ".docx"):
            continue

        file_id = str(uuid.uuid4())
        safe_name = f"{file_id}{ext}"
        filepath = os.path.join(TEMP_DIR, safe_name)

        content = await f.read()
        with open(filepath, "wb") as fh:
            fh.write(content)

        is_doc = ext == ".doc"
        file_type = classify_template(f.filename)

        _session_files[file_id] = {
            "filename": f.filename,
            "filepath": filepath,
            "file_type": file_type,
            "is_doc": is_doc,
            "converted_path": None,
        }

        infos.append(UploadedFileInfo(
            file_id=file_id,
            filename=f.filename,
            file_type=file_type,
            is_doc=is_doc,
            converted=False,
        ))

    return UploadResponse(files=infos)


@router.post("/reset")
def reset_session():
    """清空所有上传文件和审查结果"""
    global _session_files, _session_results, _reviewed_file_ids, _ai_tasks
    _session_files.clear()
    _session_results.clear()
    _reviewed_file_ids.clear()
    _ai_tasks.clear()
    return {"status": "ok"}


@router.post("/review", response_model=ReviewResponse)
def run_review():
    """执行审查（仅审查未审过的文件，审完后自动启动AI审查）"""
    global _session_files, _session_results, _reviewed_file_ids

    if not _session_files:
        raise HTTPException(400, "请先上传文件")

    # 找出未审查过的文件
    new_file_ids = [fid for fid in _session_files if fid not in _reviewed_file_ids]
    if not new_file_ids:
        raise HTTPException(400, "所有文件已审查完毕，没有新增文件需要审查")

    new_results: list[FileReviewResult] = []

    for file_id in new_file_ids:
        info = _session_files[file_id]
        filepath = info["filepath"]

        if info["is_doc"]:
            converted = convert_doc_to_docx(filepath)
            if converted:
                info["converted_path"] = converted
                filepath = converted
            else:
                result = FileReviewResult(
                    file_id=file_id,
                    filename=info["filename"],
                    file_type=info["file_type"],
                    teacher="未知",
                    passed=False,
                    fonts_used=[],
                    issues=[ReviewIssue(
                        type="转换失败",
                        detail="无法将 .doc 文件转换为 .docx，请确保安装了 LibreOffice 或 Microsoft Word",
                        location="",
                        snippet="",
                        severity="error",
                    )],
                )
                new_results.append(result)
                _reviewed_file_ids.add(file_id)
                continue

        result = review_single(filepath, info["filename"])
        result.file_id = file_id
        new_results.append(result)
        _reviewed_file_ids.add(file_id)

    # 合并到总结果
    _session_results.extend(new_results)

    mode = "single" if len(_session_results) == 1 else "batch"
    passed_count = sum(1 for r in _session_results if r.passed)
    summary = f"共审查 {len(_session_results)} 个文件，通过 {passed_count} 个，不通过 {len(_session_results) - passed_count} 个"

    # 自动启动 AI 审查（仅审查新增文件）
    ai_task_id = str(uuid.uuid4())
    t = threading.Thread(
        target=_run_ai_review_task,
        args=(ai_task_id, new_file_ids),
        daemon=True,
    )
    t.start()

    return ReviewResponse(mode=mode, results=_session_results, summary=summary, ai_task_id=ai_task_id)


@router.get("/preview/{file_id}")
def preview_file(file_id: str):
    """返回 PDF 预览"""
    global _session_files

    if file_id not in _session_files:
        raise HTTPException(404, "文件不存在")

    info = _session_files[file_id]
    src_path = info.get("converted_path") or info["filepath"]

    pdf_path = convert_docx_to_pdf(src_path)
    if not pdf_path:
        raise HTTPException(500, "无法转换为 PDF，请确保安装了 LibreOffice 或 Microsoft Word")

    def iterfile():
        with open(pdf_path, "rb") as f:
            yield from f
        try:
            os.remove(pdf_path)
        except Exception:
            pass

    encoded_filename = quote(f"{info['filename']}.pdf")
    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"},
    )


@router.get("/export")
def export_excel():
    """导出汇总 Excel"""
    global _session_results

    if not _session_results:
        raise HTTPException(400, "请先执行审查")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "审查结果汇总"

    headers = ["文件名", "老师", "文件类型", "是否通过", "错误类型", "位置", "问题描述"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=1, column=c, value=h)

    row_idx = 2
    for result in _session_results:
        if result.issues:
            for issue in result.issues:
                ws.cell(row=row_idx, column=1, value=result.filename)
                ws.cell(row=row_idx, column=2, value=result.teacher)
                ws.cell(row=row_idx, column=3, value=result.file_type)
                ws.cell(row=row_idx, column=4, value="通过" if result.passed else "不通过")
                ws.cell(row=row_idx, column=5, value=issue.type)
                ws.cell(row=row_idx, column=6, value=issue.location)
                ws.cell(row=row_idx, column=7, value=issue.detail)
                row_idx += 1
        else:
            ws.cell(row=row_idx, column=1, value=result.filename)
            ws.cell(row=row_idx, column=2, value=result.teacher)
            ws.cell(row=row_idx, column=3, value=result.file_type)
            ws.cell(row=row_idx, column=4, value="通过")
            ws.cell(row=row_idx, column=5, value="无")
            row_idx += 1

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    encoded_filename = quote("文件审查结果.xlsx")
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )


# ===== AI 审查 =====

def _run_ai_review_task(task_id: str, file_ids: list[str]):
    """后台线程执行 AI审查，实时更新进度"""
    import asyncio

    # 初始化进度结构：包含所有文件的进度（已审过的标记为done，新增的标记为waiting）
    all_files = []
    for fid, info in _session_files.items():
        if fid in file_ids:
            all_files.append({
                "file_id": fid,
                "filename": info["filename"],
                "status": "waiting",
                "findings": [],
            })
        else:
            # 之前已审过的文件，尝试复用已有AI结果
            existing_findings = []
            existing_info = {}
            for old_task in _ai_tasks.values():
                for old_file in old_task.get("files", []):
                    if old_file["file_id"] == fid and old_file.get("findings"):
                        existing_findings = old_file["findings"]
                        existing_info = old_file.get("extracted_info", {})
                        break
                if existing_findings:
                    break
            all_files.append({
                "file_id": fid,
                "filename": info["filename"],
                "status": "done" if existing_findings else "waiting",
                "findings": existing_findings,
                "extracted_info": existing_info,
            })

    # 收集已有 findings
    all_findings: list[dict] = []
    for fe in all_files:
        for f in fe.get("findings", []):
            f.setdefault("file_id", fe["file_id"])
            f.setdefault("filename", fe["filename"])
        all_findings.extend(fe.get("findings", []))

    _ai_tasks[task_id] = {
        "status": "running",
        "total": len(all_files),
        "completed": sum(1 for fe in all_files if fe["status"] == "done"),
        "current_file_id": None,
        "files": all_files,
        "findings": all_findings,
        "error": None,
    }

    for fe in all_files:
        if fe["status"] == "done":
            continue

        fid = fe["file_id"]
        info = _session_files.get(fid)
        if not info:
            fe["status"] = "done"
            _ai_tasks[task_id]["completed"] += 1
            continue

        filepath = info.get("converted_path") or info["filepath"]
        if not os.path.exists(filepath):
            fe["status"] = "done"
            _ai_tasks[task_id]["completed"] += 1
            continue

        fe["status"] = "reviewing"
        _ai_tasks[task_id]["current_file_id"] = fid

        try:
            findings, extracted_info, raw_text = asyncio.run(ai_review(filepath, info["filename"]))
            for f in findings:
                f["file_id"] = fid
                f["filename"] = info["filename"]
            fe["findings"] = findings
            fe["extracted_info"] = extracted_info
            all_findings.extend(findings)
            print(f"[AI审查] {info['filename']}: 发现 {len(findings)} 个问题, 提取信息: {extracted_info}")
        except Exception as e:
            print(f"[AI审查] {info['filename']} 失败: {type(e).__name__}: {e}")
            traceback.print_exc()
            fe["findings"] = []
            fe["extracted_info"] = {}

        fe["status"] = "done"
        _ai_tasks[task_id]["completed"] += 1

    _ai_tasks[task_id]["status"] = "done"
    _ai_tasks[task_id]["current_file_id"] = None
    _ai_tasks[task_id]["findings"] = all_findings


@router.get("/ai-review/status")
def ai_review_status():
    api_key = ConfigManager.get("llm_key", "")
    return {"configured": bool(api_key)}


@router.post("/ai-review/start")
def start_ai_review():
    global _session_files
    if not _session_files:
        raise HTTPException(400, "请先上传文件并执行审查")

    task_id = str(uuid.uuid4())
    all_file_ids = list(_session_files.keys())
    t = threading.Thread(target=_run_ai_review_task, args=(task_id, all_file_ids), daemon=True)
    t.start()

    return {"task_id": task_id, "status": "running"}


@router.get("/ai-review/progress/{task_id}")
def ai_review_progress(task_id: str):
    task = _ai_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "任务不存在或已过期")
    return task
