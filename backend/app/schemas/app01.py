"""app01 监考分配 — 请求/响应模型"""
from pydantic import BaseModel


class TeacherInfo(BaseModel):
    name: str
    department: str
    tags: list[str] = []
    excluded_dates: list[str] = []


class ExamRow(BaseModel):
    index: int
    场次: str
    班级名称: str
    课程名称: str
    任课教师: list[str]
    考试时间: str
    考试地点: str
    人数: str
    监考1: str | None = None
    监考2: str | None = None


class UploadResponse(BaseModel):
    exam_rows: list[ExamRow]
    teachers: list[TeacherInfo]


class AllocateRequest(BaseModel):
    exam_rows: list[ExamRow]
    teachers: list[TeacherInfo]


class AllocateResponse(BaseModel):
    exam_rows: list[ExamRow]
    warnings: list[str]


class SwapRequest(BaseModel):
    row_index: int
    position: str  # "监考1" | "监考2"
    new_teacher: str


class SwapResponse(BaseModel):
    exam_rows: list[ExamRow]


class ValidationError(BaseModel):
    row_index: int
    field: str
    teacher: str
    reason: str


class ValidateResponse(BaseModel):
    errors: list[ValidationError]


class AiAffectedCell(BaseModel):
    row_index: int
    field: str  # "监考1" | "监考2"


class AiReviewFinding(BaseModel):
    rule: str  # "time_overlap" | "must_invigilate_own_class"
    teacher: str
    description: str
    affected_cells: list[AiAffectedCell] = []


class AiReviewResponse(BaseModel):
    configured: bool
    findings: list[AiReviewFinding] = []
