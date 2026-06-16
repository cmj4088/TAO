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
  tags: string[];
  excluded_dates: string[];
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
}

export interface ValidationError {
  row_index: number;
  field: string;
  teacher: string;
  reason: string;
}

export interface ValidateResponse {
  errors: ValidationError[];
}
