"""app02 文件审查 API"""
import io
import os
import re
import uuid
import tempfile
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

router = APIRouter(prefix="/api/app02", tags=["app02"])

TEMP_DIR = os.path.join(tempfile.gettempdir(), "tao_app02")
os.makedirs(TEMP_DIR, exist_ok=True)

_session_files: dict[str, dict] = {}
_session_results: list[FileReviewResult] = []


@router.get("/status")
def get_status():
    return {"status": "ok", "message": "app02 文件审查模块就绪"}


@router.post("/upload", response_model=UploadResponse)
async def upload_files(files: list[UploadFile] = File(...)):
    """上传文件，转换 .doc，分类"""
    global _session_files, _session_results
    _session_files.clear()
    _session_results.clear()

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


@router.post("/review", response_model=ReviewResponse)
def run_review():
    """执行审查"""
    global _session_files, _session_results

    if not _session_files:
        raise HTTPException(400, "请先上传文件")

    results: list[FileReviewResult] = []

    for file_id, info in _session_files.items():
        filepath = info["filepath"]

        if info["is_doc"]:
            converted = convert_doc_to_docx(filepath)
            if converted:
                info["converted_path"] = converted
                filepath = converted
            else:
                results.append(FileReviewResult(
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
                    )],
                ))
                continue

        result = review_single(filepath, info["filename"])
        result.file_id = file_id
        results.append(result)

    _session_results = results

    mode = "single" if len(results) == 1 else "batch"
    passed_count = sum(1 for r in results if r.passed)
    summary = f"共审查 {len(results)} 个文件，通过 {passed_count} 个，不通过 {len(results) - passed_count} 个"

    return ReviewResponse(mode=mode, results=results, summary=summary)


@router.get("/preview/{file_id}")
def preview_file(file_id: str):
    """返回 PDF 预览（使用审查时生成的高亮文档）"""
    global _session_files, _session_results

    if file_id not in _session_files:
        raise HTTPException(404, "文件不存在")

    info = _session_files[file_id]

    # 优先用审查时生成的高亮文档
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
