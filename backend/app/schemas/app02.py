"""app02 文件审查 Pydantic 模型"""
from pydantic import BaseModel


class ReviewIssue(BaseModel):
    type: str
    detail: str
    location: str
    snippet: str
    severity: str = "error"


class FileReviewResult(BaseModel):
    file_id: str
    filename: str
    file_type: str
    teacher: str
    passed: bool
    fonts_used: list[str]
    issues: list[ReviewIssue]


class UploadedFileInfo(BaseModel):
    file_id: str
    filename: str
    file_type: str
    is_doc: bool
    converted: bool


class UploadResponse(BaseModel):
    files: list[UploadedFileInfo]


class ReviewResponse(BaseModel):
    mode: str
    results: list[FileReviewResult]
    summary: str
    ai_task_id: str = ""


class AiReviewFindingApp02(BaseModel):
    rule: str
    severity: str = "error"
    description: str
    location: str
    suggestion: str
    file_id: str = ""
    filename: str = ""


class SseTokenEvent(BaseModel):
    file_id: str
    content: str


class SseFileDoneEvent(BaseModel):
    file_id: str
    findings: list[dict] = []
    extracted_info: dict = {}


class SseFileErrorEvent(BaseModel):
    file_id: str
    error: str


class SseTaskDoneEvent(BaseModel):
    status: str
