# MVPtext — 子Agent任务分工

## 模块划分（基于实际代码 2026-07-09）

### 模块1：后端 — API路由层（routers/）
**文件**：`routers/settings.py`、`routers/app01.py`、`routers/app02.py`
**职责**：
- 接口定义（20+个端点，全部以 `/api/` 为前缀）
- 请求校验（文件类型、参数合法性）
- 响应格式化（Pydantic模型序列化）
- 会话状态管理（内存中维护上传数据、审查结果）
- SSE流式推送（AI审查结果实时推送）

### 模块2：后端 — 业务逻辑层（services/）
**文件**：`services/invigilator.py`、`services/ai_reviewer_app01.py`、`services/ai_reviewer_app02.py`、`services/doc_converter.py`、`services/doc_reviewer.py`
**职责**：
- 监考分配核心算法（贪心+随机重试+AI兜底）
- AI审查提示词构建（500+行详细prompt）
- 流式AI调用（SSE解析）
- 文档格式转换（.doc→.docx，Word COM/LibreOffice）
- 文档格式审查（模板特征提取+对比）
- Python后处理补丁（课时验算、教师名检查、错别字匹配）

### 模块3：后端 — 数据与配置层
**文件**：`database.py`、`config.py`、`crypto_utils.py`、`models/settings.py`
**职责**：
- SQLite数据库连接和建表
- 配置管理（三级回退：参数→DB→默认值）
- AES-256-CBC加密存储（敏感字段保护）
- 旧数据自动迁移（明文→加密）
- 脱敏显示（API Key部分隐藏）

### 模块4：前端 — 控制台框架
**文件**：`App.tsx`、`ConsoleLayout.tsx`、`UpdateNotification.tsx`、`VersionBadge.tsx`
**职责**：
- 主布局（左侧导航+顶栏+内容区）
- 所有App始终挂载，display切换（不中断SSE）
- Electron版本更新通知
- 后端版本检测

### 模块5：前端 — App01 监考分配
**文件**：`apps/app01/index.tsx`
**职责**：
- 文件上传区域（拖拽+选择）
- 监考分配预览表格（按日期/老师查看）
- 拖拽调整（单元格交换+贴纸拖入）
- 撤销栈（最多50步）
- 校验错误面板（分级显示+一键跳转）
- AI审查弹窗（SSE流式文本）
- 导出Excel

### 模块6：前端 — App02 文件审查
**文件**：`apps/app02/index.tsx`、`components/StickerIndicator.tsx`、`components/StreamingText.tsx`、`hooks/useAiReviewStream.ts`、`utils/stickers.ts`
**职责**：
- 文件上传（拖拽文件/文件夹，支持递归遍历）
- 审查进度展示（蓝色脉冲/空心圈/红叉/绿勾）
- 流式文本显示（打字机效果，30ms/字符）
- AI审查状态管理（SSE事件处理）
- 审查结果展示（Segmented过滤、展开详情）
- 忽略误报、复制错误、导出Excel
- 文件预览（PDF iframe）

### 模块7：前端 — 设置与状态管理
**文件**：`pages/AdminPage.tsx`、`pages/SettingsPage.tsx`、`stores/appStore.ts`、`stores/settingsStore.ts`
**职责**：
- 主题切换
- AI审查并发数配置
- LLM配置（URL/Key/Model）管理
- API Key脱敏显示+修改
- 应用注册与切换
- 与后端配置同步

### 模块8：部署与运维
**文件**：`Dockerfile`、`docker-compose.yml`、`update.sh`、`.github/workflows/`
**职责**：
- Docker镜像构建（python:3.12-slim + gunicorn）
- 容器编排（端口8002，数据持久化，加密密钥）
- 手动更新脚本（docker compose pull + up）
- CI/CD：backend自动构建推送GHCR，frontend自动构建Electron安装包