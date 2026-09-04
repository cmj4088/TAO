# routers/app02.py — 文件审查接口

**文件路径**：`backend/app/routers/app02.py`

**作用**：提供文件审查（App02）的全部 API 接口。

**全局会话状态**：
- `TEMP_DIR`：临时目录 `os.path.join(tempfile.gettempdir(), "tao_app02")`
- `_session_files`：文件信息字典（file_id → 文件元数据）
- `_session_results`：审查结果列表
- `_reviewed_file_ids`：已审查文件ID集合
- `_ai_tasks`：AI审查任务状态
- `_stream_queues`：SSE消息队列

**接口列表**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/app02/status` | 模块状态检查 |
| POST | `/api/app02/upload` | 上传文件（支持多文件，自动识别模板类型） |
| POST | `/api/app02/reset` | 重置会话（清空所有文件和结果） |
| POST | `/api/app02/review` | 执行审查（格式检查+AI审查后台任务） |
| GET | `/api/app02/preview/{file_id}` | 文件预览（纯Python转HTML流式返回，浏览器原生渲染中文） |
| GET | `/api/app02/export` | 导出审查结果汇总Excel |
| GET | `/api/app02/ai-review/status` | 检查API Key是否已配置 |
| POST | `/api/app02/ai-review/start` | 手动启动AI审查 |
| GET | `/api/app02/ai-review/stream/{task_id}` | SSE流式获取AI审查结果 |
| GET | `/api/app02/ai-review/progress/{task_id}` | 获取AI审查进度 |

**关键逻辑**：
- 上传时根据文件名分类模板类型（课程标准/授课计划/教案/未知）
- 审查时 `.doc` 先转 `.docx`（优先 LibreOffice，降级 Word COM）
- AI审查支持并发控制（`asyncio.Semaphore`，从 `app02_ai_concurrency` 读取）
- 多文件并发审查：`asyncio.gather` 并发处理，每个文件独立消息队列
- SSE事件：`reasoning`、`token`、`file_done`、`file_error`、`task_done`
- 导出Excel：7列汇总（文件名/老师/文件类型/是否通过/错误类型/位置/问题描述）