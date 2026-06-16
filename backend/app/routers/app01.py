"""app01 监考分配 API"""
import io
import re
import copy
from typing import Any
from urllib.parse import quote

import openpyxl
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.app01 import (
    TeacherInfo,
    ExamRow,
    UploadResponse,
    AllocateRequest,
    AllocateResponse,
    SwapRequest,
    SwapResponse,
    ValidateResponse,
    ValidationError,
)
from app.services.invigilator import allocate, validate

router = APIRouter(prefix="/api/app01", tags=["app01"])

# 当前会话状态（内存中保存已上传解析的数据和分配结果）
_session_exam_rows: list[ExamRow] | None = None
_session_teachers: list[TeacherInfo] | None = None
_original_exam_bytes: bytes | None = None  # 原始考试安排文件字节，导出时重新加载


def _extract_name(teacher_str: str) -> str:
    """从 '2022000012/李莉' 提取 '李莉'"""
    if "/" in teacher_str:
        return teacher_str.split("/", 1)[1].strip()
    return teacher_str.strip()


def _parse_exam_schedule(file_content: bytes) -> list[ExamRow]:
    """解析考试安排表"""
    wb = openpyxl.load_workbook(io.BytesIO(file_content))
    ws = wb[wb.sheetnames[0]]
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:  # 跳过标题行
            continue
        if row[9] is None:  # 无考试时间，跳过空行
            continue

        raw_teachers = str(row[8]) if row[8] else ""
        teacher_names = [
            _extract_name(t.strip())
            for t in raw_teachers.split(",")
            if t.strip()
        ]

        rows.append(ExamRow(
            index=i,
            场次=str(row[1]) if row[1] else "",
            班级名称=str(row[6]) if row[6] else "",
            课程名称=str(row[7]) if row[7] else "",
            任课教师=teacher_names,
            考试时间=str(row[9]).strip() if row[9] else "",
            考试地点=str(row[10]).strip() if row[10] else "",
            人数=str(row[11]) if row[11] else "",
        ))
    return rows


def _parse_contact_list(file_content: bytes) -> list[TeacherInfo]:
    """解析通讯录"""
    wb = openpyxl.load_workbook(io.BytesIO(file_content))
    ws = wb[wb.sheetnames[0]]
    teachers = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:  # 跳过标题行
            continue

        name = str(row[1]).replace(" ", "").strip() if row[1] else ""
        if not name:
            continue

        tag = str(row[7]).strip() if row[7] else ""
        tags = [tag] if tag else []

        teachers.append(TeacherInfo(
            name=name,
            department=str(row[0]).strip() if row[0] else "",
            tags=tags,
            excluded_dates=[],
        ))
    return teachers


@router.get("/status")
def get_status():
    return {"status": "ok", "message": "app01 监考分配模块就绪"}


@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    exam_file: UploadFile = File(...),
    contact_file: UploadFile = File(...),
):
    """上传考试安排表和通讯录，返回解析后的预览数据"""
    global _session_exam_rows, _session_teachers, _original_exam_bytes

    if not exam_file.filename or not exam_file.filename.endswith(".xlsx"):
        raise HTTPException(400, "考试安排表必须是 .xlsx 文件")
    if not contact_file.filename or not contact_file.filename.endswith(".xlsx"):
        raise HTTPException(400, "通讯录必须是 .xlsx 文件")

    exam_content = await exam_file.read()
    contact_content = await contact_file.read()

    _original_exam_bytes = exam_content

    _session_exam_rows = _parse_exam_schedule(exam_content)
    _session_teachers = _parse_contact_list(contact_content)

    return UploadResponse(
        exam_rows=_session_exam_rows,
        teachers=_session_teachers,
    )


@router.post("/allocate", response_model=AllocateResponse)
def run_allocation(body: AllocateRequest):
    """执行监考分配算法"""
    global _session_exam_rows, _session_teachers

    if not body.exam_rows:
        raise HTTPException(400, "考试安排数据为空")

    rows = copy.deepcopy(body.exam_rows)
    teachers = body.teachers if body.teachers else (_session_teachers or [])

    result_rows, warnings = allocate(rows, teachers)
    _session_exam_rows = result_rows
    _session_teachers = teachers

    return AllocateResponse(exam_rows=result_rows, warnings=warnings)


@router.post("/swap", response_model=SwapResponse)
def swap_teacher(body: SwapRequest):
    """手动替换监考老师"""
    global _session_exam_rows

    if not _session_exam_rows:
        raise HTTPException(400, "请先上传文件并执行分配")

    rows = copy.deepcopy(_session_exam_rows)
    for row in rows:
        if row.index == body.row_index:
            setattr(row, body.position, body.new_teacher if body.new_teacher else None)
            break

    _session_exam_rows = rows
    return SwapResponse(exam_rows=rows)


@router.post("/validate", response_model=ValidateResponse)
def run_validation(body: AllocateRequest | None = None):
    """校验当前分配结果，返回违规项列表"""
    rows = _session_exam_rows
    if not rows:
        raise HTTPException(400, "请先上传文件并执行分配")

    teachers = _session_teachers or []
    if body and body.teachers:
        teachers = body.teachers
    if body and body.exam_rows:
        rows = body.exam_rows

    error_dicts = validate(rows, teachers)
    errors = [ValidationError(**e) for e in error_dicts]
    return ValidateResponse(errors=errors)


@router.get("/export")
def export_excel():
    """导出填充后的 Excel"""
    global _session_exam_rows, _original_exam_bytes

    if not _session_exam_rows or not _original_exam_bytes:
        raise HTTPException(400, "请先上传文件并执行分配")

    wb = openpyxl.load_workbook(io.BytesIO(_original_exam_bytes))
    ws = wb[wb.sheetnames[0]]

    index_map: dict[int, ExamRow] = {r.index: r for r in _session_exam_rows}

    for row_idx in range(3, ws.max_row + 1):
        r = index_map.get(row_idx - 1)
        if r is None:
            continue
        ws.cell(row=row_idx, column=13).value = r.监考1
        ws.cell(row=row_idx, column=15).value = r.监考2

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    encoded_filename = quote("监考安排结果.xlsx")
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )
