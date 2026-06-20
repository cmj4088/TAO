"""app02 文件审查 Pydantic 模型"""
from pydantic import BaseModel


class ReviewIssue(BaseModel):
    type: str       # "字体偏离" | "字号偏离" | "字体过多" | "课时计算错误" | "课时不一致"
    detail: str     # 人类可读的问题描述
    location: str   # 位置，如 "表格1 第3行第2列"
    snippet: str    # 问题文本片段
    severity: str = "error"  # "error" = 关键错误（不通过）, "warning" = 提醒建议


class FileReviewResult(BaseModel):
    file_id: str
    filename: str
    file_type: str     # "课程标准" | "授课计划" | "教案" | "未知"
    teacher: str
    passed: bool
    fonts_used: list[str]
    issues: list[ReviewIssue]


class UploadedFileInfo(BaseModel):
    file_id: str
    filename: str
    file_type: str
    is_doc: bool       # 是否需要 .doc→.docx 转换
    converted: bool


class UploadResponse(BaseModel):
    files: list[UploadedFileInfo]


class ReviewResponse(BaseModel):
    mode: str           # "single" | "batch"
    results: list[FileReviewResult]
    summary: str
    ai_task_id: str = ""  # AI审查任务ID，空字符串表示未启动


class AiReviewFindingApp02(BaseModel):
    rule: str           # "school_name_error" | "teacher_mismatch" | "typo" | "hour_calculation_error" | "hour_inconsistency"
    severity: str = "error"  # "error" | "warning"
    description: str
    location: str
    suggestion: str
    file_id: str = ""
    filename: str = ""
