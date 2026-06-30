/** 子应用注册接口 */
export interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** 设置项 */
export interface SettingItem {
  key: string;
  value: string;
}

/** 大模型配置 */
export interface LLMConfig {
  url: string;
  key: string;
}

/** 版本信息 */
export interface VersionInfo {
  version: string;
}

// ===== app01 监考分配类型 =====

export interface TeacherInfo {
  name: string;
  department: string;
  slots: number;
  group: string;
}

export interface ExamRow {
  index: number;
  场次: string;
  班级名称: string;
  课程名称: string;
  任课教师: string[];
  考试时间: string;
  考试地点: string;
  人数: string;
  监考1: string | null;
  监考2: string | null;
}

export interface AllocateResponse {
  exam_rows: ExamRow[];
  warnings: string[];
  teacher_loads: Record<string, number>;
}

export interface ValidationError {
  row_index: number;
  field: string;
  teacher: string;
  reason: string;
  priority: number;
}

export interface ValidateResponse {
  errors: ValidationError[];
}

// ===== app02 文件审查类型 =====

export interface ReviewIssue {
  type: string;
  detail: string;
  location: string;
  snippet: string;
  severity: "error" | "warning";
}

export interface FileReviewResult {
  file_id: string;
  filename: string;
  file_type: string;
  teacher: string;
  passed: boolean;
  fonts_used: string[];
  issues: ReviewIssue[];
}

export interface ReviewResponse {
  mode: "single" | "batch";
  results: FileReviewResult[];
  summary: string;
  ai_task_id?: string;
}

export interface UploadedFileInfo {
  file_id: string;
  filename: string;
  file_type: string;
  is_doc: boolean;
  converted: boolean;
}

export interface UploadResponse {
  files: UploadedFileInfo[];
}

// ===== app02 AI审查类型 =====

export interface AiReviewFindingApp02 {
  rule: string;
  severity: "error" | "warning";
  description: string;
  location: string;
  suggestion: string;
  file_id: string;
  filename: string;
}

export interface AiFileProgress {
  file_id: string;
  filename: string;
  status: "waiting" | "reviewing" | "done";
  findings: AiReviewFindingApp02[];
  extracted_info?: {
    teacher?: string | null;
    course?: string | null;
    class_name?: string | null;
  };
}

export interface AiReviewProgressApp02 {
  status: "running" | "done" | "error";
  total: number;
  completed: number;
  current_file_id: string | null;
  files: AiFileProgress[];
  findings: AiReviewFindingApp02[];
  error: string | null;
}

// ===== app02 SSE 流式事件 =====

export interface SseTokenEvent {
  file_id: string;
  content: string;
}

export interface SseReasoningEvent {
  file_id: string;
  content: string;
}

export interface SseFileDoneEvent {
  file_id: string;
  findings: AiReviewFindingApp02[];
  extracted_info: {
    teacher?: string | null;
    course?: string | null;
    class_name?: string | null;
  };
}

export interface SseFileErrorEvent {
  file_id: string;
  error: string;
}

// ===== app02 贴纸分级 =====

export type StickerType = "pass" | "fail" | "ambiguous";
