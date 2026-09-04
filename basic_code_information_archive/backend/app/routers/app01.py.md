# routers/app01.py — 监考分配接口

**文件路径**：`backend/app/routers/app01.py`

**作用**：提供监考分配（App01）的全部 API 接口。

**全局会话状态**（内存中）：
- `_session_exam_rows`：当前考试安排数据
- `_session_teachers`：当前教师数据
- `_original_exam_bytes`：原始Excel文件字节（用于导出时保留格式）
- `_ai_tasks`：AI审查任务状态字典
- `_stream_queues`：SSE消息队列

**接口列表**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/app01/status` | 模块状态检查 |
| POST | `/api/app01/upload` | 上传考试安排表+通讯录（2个.xlsx文件） |
| POST | `/api/app01/allocate` | 执行监考分配算法 |
| POST | `/api/app01/swap` | 交换两个格子的监考老师 |
| POST | `/api/app01/replace` | 替换指定格子的监考老师 |
| POST | `/api/app01/set-rows` | 批量替换所有行（撤销用） |
| POST | `/api/app01/validate` | 校验当前分配结果，返回违规项列表 |
| GET | `/api/app01/export` | 导出填充后的Excel（StreamingResponse） |
| POST | `/api/app01/ai-review` | 启动AI审查，返回task_id |
| GET | `/api/app01/ai-review/stream/{task_id}` | SSE流式获取AI审查结果 |

**关键逻辑**：
- **上传**：接收2个文件（exam_file + contact_file），解析为 ExamRow 和 TeacherInfo
- **解析**：`_parse_exam_schedule()` 跳过前2行标题，第10列考试时间为空则跳过，第9列解析教师姓名
- **导出**：用原始Excel文件字节作为模板，第13列写监考1，第15列写监考2
- **AI审查**：通过 threading.Thread 启动后台任务，SSE流式推送结果
- **SSE事件类型**：`reasoning`、`token`、`done`、`review_error`、`task_done`
- **任务清理**：TASK_TTL=600秒后自动清理

**通讯录格式**（新版4列）：
- A列：岗位，B列：姓名，C列：安排场次，D列：分组