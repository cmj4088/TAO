# 教务办·智能体 — Agent 编程规范

> **用途**：新 Agent 接手本项目时，必须严格按此文件编程。不得自行发明端口、变量、目录结构。
> **最后校准**：2026-10-14，对照代码版本 **2.0.2**（commit `10efb041` 之后）。
> 若本文与代码不一致，**以代码为准**，并立即回来修正本文。
>
> 历史文档 `docx/项目设计与需求.md` 已同步重写；`basic_code_information_archive/` 是逐文件中文说明档案。

---

## 1. 项目概述

"教务办·智能体"是高校教务办公室的轻量级桌面控制台应用（约 10 用户）。

- **形态**：Electron 桌面壳 + React 渲染进程 + FastAPI 后端 + SQLite
- **入口**：左侧导航切换子应用，右侧工作区；子应用始终挂载（`display` 切换），切换不中断 SSE
- **当前版本**：`2.0.2`
- **已实现子应用**：app01（监考分配）、app02（文件审查）
- **账号体系**：邮箱 + 密码登录（邮箱验证码注册）、JWT access/refresh、角色权限（admin / teacher）
- **部署形态**：桌面安装包（Electron，写死后端 IP）+ 网页版（同源 `/api`，nginx 反代）

---

## 2. 目录结构（不可随意修改）

```
TAO/
├── docs/                              # 需求文档 + 本规范
│   ├── requirement.md                 # 总体需求（原始）
│   ├── renew_requirement.md           # 总体架构需求
│   ├── app01.md / app2.md             # 子应用需求
│   ├── agent-guide.md                 # 本文件（开发规范）
│   └── app01.file/ app02.file/        # 需求配套样例文件
├── docx/项目设计与需求.md              # 项目设计与需求（与本文同步维护）
├── basic_code_information_archive/     # 代码逐文件中文说明档案
├── MVPtext/README.md                   # 模块分工说明
├── modification_log/                   # 修改记录（每次改动必须追加一条）
├── skill/                              # 项目专用 Skills（当前为空）
├── demo/                               # 演示脚本
├── publish.sh                          # 一键发版脚本（改版本号→构建→打 tag→发 Release）
├── frontend/                           # 前端全部代码（Electron + React）
│   ├── electron-main/                  # Electron 主进程（纯 CJS，不经 Vite 编译）
│   │   ├── main.cjs                    # 窗口创建、app:// 协议、自动更新
│   │   └── preload.cjs                 # contextBridge 暴露 electronAPI（版本号从 package.json 动态读取）
│   ├── src/                            # React 渲染进程（TypeScript，Vite 编译）
│   │   ├── main.tsx                    # ReactDOM.createRoot 入口
│   │   ├── App.tsx                     # 根组件：ThemeProvider + BrowserRouter + 路由表
│   │   ├── index.css                   # Tailwind 入口 + 主题 CSS 变量
│   │   ├── api/
│   │   │   ├── client.ts               # axios 实例 + 401 自动刷新 token
│   │   │   └── tokenStore.ts           # token 统一存取层（"记住我"决定是否落 localStorage）
│   │   ├── apps/
│   │   │   ├── app01/index.tsx         # 监考分配（单文件，约 1200 行）
│   │   │   └── app02/                  # 文件审查
│   │   │       ├── index.tsx
│   │   │       ├── components/         # StickerIndicator / StreamingText
│   │   │       ├── hooks/useAiReviewStream.ts   # fetch 流式解析 SSE（非 EventSource）
│   │   │       └── utils/stickers.ts
│   │   ├── components/
│   │   │   ├── Layout/ConsoleLayout.tsx # 左侧导航 + 顶栏 + 内容区（app01/app02 display 切换）
│   │   │   ├── AuthGuard.tsx           # 路由守卫（登录态 + 权限）
│   │   │   ├── ConnectionBanner.tsx    # 后端连接失败红色横幅
│   │   │   ├── UpdateNotification.tsx  # Electron 更新弹窗
│   │   │   ├── ProviderQuickSelect.tsx # LLM 服务商快捷预设
│   │   │   ├── ThemeProvider.tsx       # 明暗主题
│   │   │   ├── VersionBadge.tsx        # 版本更新提示（当前未被任何页面引用，见 §15）
│   │   │   └── ui/                     # shadcn/ui 组件（Radix 封装，勿手改风格）
│   │   ├── lib/utils.ts                # cn() 等工具
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx           # 登录
│   │   │   ├── RegisterPage.tsx        # 注册（邮箱验证码）
│   │   │   ├── HomePage.tsx            # 快捷入口首页（模型名 + AI 用量卡）
│   │   │   ├── SettingsPage.tsx        # 设置（主题 / LLM / AI 并发 / 用量统计 / 改密）
│   │   │   └── AdminPage.tsx           # 管理后台（用户管理 / 系统设置 / 备份恢复）
│   │   ├── stores/
│   │   │   ├── appStore.ts             # 子应用注册 + 当前激活
│   │   │   ├── authStore.ts            # 登录态、用户信息、权限判定
│   │   │   ├── settingsStore.ts        # APP02 AI 并发数
│   │   │   └── themeStore.ts           # 明暗主题
│   │   └── types/index.ts              # 全部 TypeScript 类型定义
│   ├── index.html
│   ├── package.json                    # 依赖 + 脚本 + electron-builder 配置
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── .env.development                # VITE_API_BASE=开发后端
│   ├── .env.production                 # VITE_API_BASE=老师服务器
│   └── .env.web                        # VITE_API_BASE=（空 → 同源 /api）
├── backend/                            # 后端全部代码（FastAPI）
│   ├── app/
│   │   ├── main.py                     # 入口：VERSION / REGISTERED_APPS / 路由注册 / CORS
│   │   ├── config.py                   # ConfigManager（三级回退 + 加密）
│   │   ├── crypto_utils.py             # AES-256-CBC 加密/解密/脱敏
│   │   ├── database.py                 # 引擎、启动锁、Alembic 迁移、自动备份与回滚、种子数据
│   │   ├── m0_infrastructure/config.py # 路径常量（ADMIN_INIT_FILE 等）
│   │   ├── m1_auth/                    # 认证与权限模块
│   │   │   ├── models.py               # Role/Permission/RolePermission/User/Session/UserLLMConfig/VerifyCode
│   │   │   ├── schemas.py              # 认证请求/响应模型
│   │   │   ├── security.py             # 密码哈希(bcrypt)、JWT 编解码、token 哈希
│   │   │   ├── auth_service.py         # 注册/登录/刷新/登出/改密/用户管理/LLM 配置/验证码
│   │   │   ├── middleware.py           # get_db / get_current_user / require_permission
│   │   │   └── router.py               # /api/auth/*
│   │   ├── models/
│   │   │   ├── settings.py             # Setting 键值表
│   │   │   └── usage.py                # LlmUsage 用量表
│   │   ├── routers/
│   │   │   ├── settings.py             # /api/settings、/api/admin/llm、/api/app02/settings
│   │   │   ├── app01.py                # /api/app01/*（10 个端点 + SSE，**当前无鉴权**）
│   │   │   ├── app02.py                # /api/app02/*（10 个端点 + SSE，大部分需登录）
│   │   │   ├── backup.py               # /api/admin/backup/export|restore
│   │   │   └── stats.py                # /api/stats/ai-usage
│   │   ├── schemas/                    # settings / app01 / app02 的 Pydantic 模型
│   │   └── services/
│   │       ├── invigilator.py          # 监考分配算法（贪心 + 随机重试 + AI 兜底）
│   │       ├── ai_reviewer_app01.py    # APP01 AI 审查（SSE 流式）
│   │       ├── ai_reviewer_app02.py    # APP02 AI 审查 + Python 后处理补丁
│   │       ├── doc_converter.py        # .doc→.docx（Word COM / LibreOffice）
│   │       ├── doc_reviewer.py         # 模板分类 + 格式审查
│   │       └── llm_usage.py            # LLM 用量写入
│   ├── alembic/                        # 迁移脚本（versions/0001_initial.py、0002_llm_usage.py）
│   ├── data/                           # 运行时数据（**已 gitignore，勿提交**）
│   │   ├── tao.db                      # SQLite 数据库
│   │   ├── backups/                    # 迁移/恢复前自动备份（滚动保留 10 份）
│   │   ├── admin_init.txt              # 首次生成的 admin 初始密码
│   │   ├── .jwt_secret                 # JWT 密钥（自动生成）
│   │   └── init.lock                   # 多 worker 启动锁
│   ├── Dockerfile / Dockerfile.offline # 镜像构建（含 LibreOffice）
│   ├── docker-compose.yml              # 端口 8002，数据卷 ./data，ENCRYPTION_KEY
│   ├── requirements.txt
│   └── update.sh
├── 前端/                               # Electron 打包产物（已 gitignore，仅留最新 2.0.2 与 latest.yml）
├── 部署教程/                           # 部署与更新操作指南
└── .github/workflows/                  # backend-docker.yml / frontend-release.yml
```

---

## 3. 端口与环境变量

| 端口 | 用途 |
|------|------|
| **5173** | Vite 开发服务器 |
| **8002** | FastAPI 后端（容器内 / 本地开发一致） |

**规则**：
- `vite.config.ts` 的 `server.port` 固定 5173；新增功能不得引入新端口。
- 后端 CORS 为 `allow_origins=["*"]`（配合 Bearer token，不用 Cookie）。
- 后端监听 8002（Dockerfile `EXPOSE 8002`、gunicorn `--bind 0.0.0.0:8002`、compose `8002:8002`）。

**前端 API 地址（`.env.*` + `client.ts`）**

```ts
// client.ts 第 5 行：用 ?? 而非 ||，空字符串表示"同源请求"
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8002";
```

| 文件 | 值 | 用途 |
|------|----|------|
| `.env.development` | `http://192.168.137.195:8002` | `npm run dev`（开发后端） |
| `.env.production` | `http://10.50.150.176:8006` | `npm run package`（桌面安装包写死绝对 IP） |
| `.env.web` | 空 | `vite build --mode web`（网页版走同源 `/api`，由 nginx 反代） |

> **关键区别**：Electron 用 `app://` 协议，**无法同源**，必须写绝对 IP；网页版必须留空走同源，换网络无需重打包。

**后端环境变量**

| 变量 | 说明 |
|------|------|
| `ENCRYPTION_KEY` | AES-256 加密密钥，保护 `llm_key` 等敏感配置。**生产必须改为随机值**，否则重启后旧密文无法解密 |

生成密钥：`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`

---

## 4. 前端路由表

| 路径 | 组件 | 守卫 | 说明 |
|------|------|------|------|
| `/` | `RootRedirect` | 无 | 已登录→`/home`，未登录→`/login` |
| `/login` | `LoginPage` (lazy) | 无 | 登录（含"记住我"） |
| `/register` | `RegisterPage` (lazy) | 无 | 注册（邮箱验证码） |
| `/home` | `ConsoleLayout` + `HomePage` | `AuthGuard` | 快捷入口首页 |
| `/app/*` | `ConsoleLayout` + `App01`/`App02` | `AuthGuard` | 子应用workspace |
| `/settings` | `SettingsPage` (lazy) | `AuthGuard` | 设置页（**独立全屏页，不在 ConsoleLayout 内**） |
| `/admin` | `AdminPage` (lazy) | `AuthGuard requiredPermission="user:read"` | 管理后台 |
| `*` | — | — | 重定向 `/login` |

**子应用挂载规则（重要）**：`/app/*` 下 `App01` 与 `App02` **同时挂载**，用 `className={active ? "block" : "hidden"}` 切换可见性——切换不卸载组件，不中断 SSE 与后台任务。新增子应用必须沿用此模式。

---

## 5. 后端 API 端点

### 通用（`routers/settings.py`，`prefix="/api"`，**均无鉴权**）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/version` | `{"version":"2.0.2"}` |
| GET | `/api/apps` | 已注册子应用列表 |
| GET | `/api/settings` | 所有设置（敏感字段脱敏） |
| PUT | `/api/settings` | 批量更新 `{"settings":[{"key":"x","value":"y"}]}` |
| GET | `/api/admin/llm` | 全局 LLM 配置（key 脱敏 + `has_key`） |
| PUT | `/api/admin/llm` | 更新全局 LLM 配置，用 **`key_changed` 布尔字段**判断是否改 key |
| GET | `/api/app02/settings` | `{"ai_concurrency":1}` |
| PUT | `/api/app02/settings` | 更新并发数（后端 clamp 到 1–10） |

### 认证（`m1_auth/router.py`，`prefix="/api/auth"`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 邮箱 + 密码 + 验证码注册，默认 `teacher` |
| POST | `/api/auth/send-verify-code` | 公开 | 发送邮箱验证码 |
| POST | `/api/auth/login` | 公开 | 返回 `{access_token, refresh_token}` |
| POST | `/api/auth/refresh` | 公开 | 刷新 token |
| POST | `/api/auth/logout` | 登录 | 撤销当前 token |
| GET | `/api/auth/me` | 登录 | 当前用户（含 role、permissions） |
| PUT | `/api/auth/change-password` | 登录 | 改密（改后全部设备登出） |
| GET/PUT | `/api/auth/llm-config` | 登录 | 当前用户级 LLM 配置（key 脱敏） |
| POST | `/api/auth/llm-test` | 登录 | 测试 LLM 连通性（15s 超时） |
| GET | `/api/auth/users` | `user:read` | 用户列表 |
| POST | `/api/auth/users` | `user:write` | 创建用户 |
| DELETE | `/api/auth/users/{id}` | `user:write` | 删除用户 |
| PUT | `/api/auth/users/{id}/reset-password` | `user:write` | 重置密码 |
| GET | `/api/auth/users/{id}/llm-config` | `user:read` | 查看指定用户 LLM 配置 |
| PUT | `/api/auth/users/{id}/llm-config` | `user:write` | 修改指定用户 LLM 配置 |

> 统一响应包：`{"data": ..., "error": null}`。

### APP01 监考分配（`prefix="/api/app01"`，**当前全部无鉴权**）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/app01/status` | 模块状态 |
| POST | `/api/app01/upload` | 上传考试安排表 + 通讯录（multipart: `exam_file`, `contact_file`） |
| POST | `/api/app01/allocate` | 执行分配 `{exam_rows, teachers, mode}` |
| POST | `/api/app01/swap` | 交换两个格子的老师 |
| POST | `/api/app01/replace` | 替换单个格子 |
| POST | `/api/app01/set-rows` | 批量替换所有行（撤销用） |
| POST | `/api/app01/validate` | 校验，返回违规列表（P1/P2/P3） |
| GET | `/api/app01/export` | 导出 Excel（blob） |
| POST | `/api/app01/ai-review` | 启动 AI 审查，返回 `task_id` |
| GET | `/api/app01/ai-review/stream/{task_id}` | SSE 流式结果（前端用 **EventSource**） |

### APP02 文件审查（`prefix="/api/app02"`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/app02/status` | 公开 | 模块状态 |
| POST | `/api/app02/upload` | 登录 | 上传文件（multipart: `files`，支持多文件） |
| POST | `/api/app02/reset` | 登录 | 清空当前用户的文件与结果 |
| POST | `/api/app02/review` | 登录 | 执行格式审查 + 启动 AI 审查 |
| GET | `/api/app02/preview/{file_id}` | 登录 | 文件预览（PDF inline） |
| GET | `/api/app02/export` | 登录 | 导出审查结果 Excel |
| GET | `/api/app02/ai-review/status` | 登录 | 是否已配置 API Key |
| POST | `/api/app02/ai-review/start` | 登录 | 手动启动 AI 审查 |
| GET | `/api/app02/ai-review/stream/{task_id}` | 登录 | SSE 流式结果（前端用 **fetch 流**） |
| GET | `/api/app02/ai-review/progress/{task_id}` | **公开（待修）** | 任务进度 |

> APP02 的会话状态按 `user_id` 隔离（内存字典 `_session_files`），APP01 为单会话全局状态。

### 备份恢复（`routers/backup.py`，`prefix="/api/admin/backup"`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/admin/backup/export` | `settings:write` | `VACUUM INTO` 导出标准 `.db` 下载 |
| POST | `/api/admin/backup/restore` | `settings:write` | 上传 `.db`，校验完整性 → 自动备份 → SQLite backup API 整库覆盖 → 补跑迁移 |

### 统计（`routers/stats.py`，`prefix="/api/stats"`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/stats/ai-usage` | 登录 | 返回 `{me, system}` 两块：累计 / 今日 / 按模型 / 近 7 天趋势（按 UTC+8 分组） |

**新增端点规则**：
- 所有接口前缀 `/api/`。
- 新子应用：`backend/app/routers/{appId}.py`，`APIRouter(prefix="/api/{appId}")`，并在 `main.py` 注册 + 加进 `REGISTERED_APPS`。
- 需要登录的端点加 `Depends(get_current_user)`，需要权限的加 `Depends(require_permission("x:y"))`。

---

## 6. 认证与权限模型

**角色与权限**（`database.py::_preseed_data`）

| 角色 | 权限 |
|------|------|
| `admin` | 全部：`user:read`、`user:write`、`settings:read`、`settings:write`、`stats:read`、`review:use` |
| `teacher` | 仅 `review:use` |

- 权限表以 `resource:action` 形式暴露给前端（`user.permissions` 数组）。
- 后端校验用 `require_permission("user:read")` 依赖工厂（失败 403）。
- 前端校验用 `authStore.hasPermission()` / `<AuthGuard requiredPermission="user:read">`。
- 密码：`bcrypt`；JWT：`PyJWT`，secret 存 `backend/data/.jwt_secret`（首次自动生成）。
- 会话：`sessions` 表存 token 哈希，支持撤销（登出、改密、重置密码后全部失效）。
- 默认管理员：`admin@tao.local`，首次启动随机生成 12 位密码写入 `backend/data/admin_init.txt`（**登录后立即修改**）。

**<a id="auth-known-gaps"></a>已知鉴权缺口（改动前必读）**

1. **APP01 全部端点无鉴权**。其 SSE 流前端用原生 `EventSource`，而 `EventSource` 无法携带 `Authorization` 头——这正是当初给 APP02 加鉴权后 APP02"一直转圈"（401）的根因。若要给 APP01 加鉴权，必须**同时**把前端改成 `fetch` 流式读取（参考 `app02/hooks/useAiReviewStream.ts`）。
2. **`GET /api/app02/ai-review/progress/{task_id}` 无鉴权**，且 task 字典为全局，理论上可被枚举读取任务状态。
3. **APP01 的 AI 审查只读管理员全局 LLM 配置**（`routers/app01.py` 不传用户配置），用户级 LLM 配置目前**仅 APP02 生效**——属已知设计现状。

---

## 7. 前端状态管理（Zustand）

| Store | 关键字段 | 说明 |
|-------|----------|------|
| `appStore` | `apps` / `activeAppId` / `setActiveApp` / `registerApp` | 子应用注册表，`icon` 字段必须是 `ConsoleLayout.tsx` `ICON_MAP` 的键（lucide 名，如 `Calendar`、`FileSearch`） |
| `authStore` | `user` / `isAuthenticated` / `login` / `register` / `logout` / `loadUser` / `hasPermission` | 登录态与权限 |
| `settingsStore` | `app02AiConcurrency` / `loadApp02Settings` / `saveApp02Settings` | APP02 并发数（1–10） |
| `themeStore` | 明暗主题 | 配合 `ThemeProvider` |

**token 存取规则（勿绕过）**：所有 token 读写必须走 `api/tokenStore.ts`。是否写入 `localStorage` 严格由"记住我"选择（`setRememberMe`）决定；未勾选时纯内存会话，关闭应用即失效。

**HTTP 规则**：统一用 `api/client.ts` 的 axios 实例。401 由响应拦截器自动刷新并重放，并发 401 会排队等待同一次刷新。

---

## 8. 技术栈（以代码为准）

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面壳 | Electron | ^31.7.7 |
| 前端框架 | React | ^18.3.1 |
| 构建 | Vite | ^5.4.3 |
| 样式 | Tailwind CSS + tailwindcss-animate | ^3.4.19 |
| UI 组件 | **shadcn/ui（Radix UI 封装）** | 见 `components/ui/` |
| 图标 | **lucide-react** | ^1.28.0 |
| 状态 | Zustand | ^4.5.5 |
| 路由 | react-router-dom | ^6.26.0 |
| HTTP | axios | ^1.7.7 |
| 拖拽 | @dnd-kit | ^6.3.1 |
| 图表 | recharts | ^3.10.1 |
| 自动更新 | electron-updater | ^6.8.9 |
| 打包 | electron-builder | ^26.15.3 |
| 后端 | FastAPI | 0.115.0 |
| 服务器 | uvicorn / gunicorn | 0.30.0 / 23.0.0 |
| ORM / 迁移 | SQLAlchemy 2.0.35 / Alembic 1.13.3 | |
| 数据库 | SQLite（**同步** Session） | |
| 校验 | Pydantic 2.9.0 | |
| 认证 | PyJWT 2.9.0 + bcrypt 4.2.0 | |
| Excel / Word | openpyxl 3.1.5 / python-docx 1.2.0 | |
| 加密 | cryptography 44.0.0 | |
| 异步 HTTP | httpx 0.27.2 | |

> ⚠️ **Ant Design 已不在依赖中**（旧文档说 Ant Design 是错误的）。不要再 `import { Table } from "antd"`。
> 旧 `AppModule.icon` 曾用 `ScheduleOutlined` 等 AntD 名，已于 2026-10-14 修正为 lucide 名。

---

## 9. 数据库与迁移

**路径锚定**：`database.py` 用 `Path(__file__).resolve().parent.parent / "data" / "tao.db"`，不受进程工作目录影响，本地与 Docker 行为一致。

**表清单**（Alembic 管理）

| 表 | 说明 |
|----|------|
| `settings` | 键值配置（key/value/updated_at），敏感字段 AES 加密 |
| `roles` / `permissions` / `role_permissions` | 角色权限 |
| `users` | 用户（email/password_hash/role_id） |
| `sessions` | 会话（token_hash/expires_at/revoked_at） |
| `user_llm_configs` | 用户级 LLM 配置（key 加密） |
| `verify_codes` | 邮箱验证码 |
| `llm_usage` | AI 用量（user_id 为 NULL 表示系统级/APP01） |
| `alembic_version` | 迁移版本 |

**启动流程**（`init_db`，受跨进程 `_boot_lock` 保护）

1. `VACUUM INTO` 自动备份现有库（`data/backups/`，滚动保留 10 份）
2. Alembic `upgrade head`；**存量库接管**：有业务表但无 `alembic_version` 时先 `stamp 0001_initial` 再升级
3. 迁移失败 → 回滚到备份并抛错拒绝启动
4. 明文 `llm_key` 自动迁移为加密存储；写入系统级默认配置
5. 预设角色/权限/admin 账号；把全局 LLM 配置迁移到 admin 的 `user_llm_configs`

**改表流程（必须遵守）**

```bash
cd backend
alembic revision --autogenerate -m "描述"
# 检查生成的脚本 → 随代码部署，启动时自动升级，老师无需手动操作
```

**多 worker 注意**：gunicorn 4 worker 并发启动会竞争 SQLite 迁移，`_boot_lock()`（POSIX `fcntl` / Windows `msvcrt`）串行化 `init_db`——新增启动期写操作必须在这个锁内。

---

## 10. 配置管理与加密

- **三级回退**：函数参数 → `ConfigManager.get()`（DB） → 代码默认值。
- **系统级默认**：`llm_url=https://ark.cn-beijing.volces.com/api/v3/chat/completions`、`llm_model=deepseek-v4-pro-260425`、`app02_ai_concurrency=1`、`llm_key`（内置默认值，加密存储）。
- **加密**：AES-256-CBC，密钥由 `ENCRYPTION_KEY` 派生（开发时随机生成并告警）；存储格式 `AES::<base64>`；敏感字段集合见 `crypto_utils._SENSITIVE_KEYS`。
- **脱敏**：`mask_key()` 保留前 14 后 5 字符（如 `ark-00ec****b92c`）。
- **LLM 配置两级**：全局（`settings` 表，管理员在管理后台改）+ 用户级（`user_llm_configs`，每个用户在设置页配自己的）。**APP02 用用户级，APP01 用全局**。

---

## 11. 新增子应用步骤（严格按顺序）

1. **后端路由**：`backend/app/routers/app03.py`，`APIRouter(prefix="/api/app03")`；需要登录就加 `Depends(get_current_user)`。
2. **后端注册**：`main.py` 的 `REGISTERED_APPS` 加条目 + `app.include_router(app03.router)`。
3. **前端页面**：`frontend/src/apps/app03/index.tsx`，默认导出 `React.FC`。
4. **前端路由**：`ConsoleLayout.tsx` 加 `lazy(() => import("@/apps/app03"))`，并在内容区加 `<div className={activeAppId === "app03" ? "block" : "hidden"}>`（**始终挂载**）。
5. **前端注册**：`appStore.ts` 的 `DEFAULT_APPS` 加一项，`icon` 用 lucide 名。
6. **左侧导航图标**：`ConsoleLayout.tsx` 的 `ICON_MAP` 加同名键。
7. **改状态/权限**：若需要新权限，改 `database.py::_preseed_data` 并写 Alembic 迁移。
8. **调 LLM**：用 `services/llm_usage.py` 记用量，否则统计页看不到数据。
9. **收尾**：更新本文件 §2/§5 表格，`docx/项目设计与需求.md`，并写一条 `modification_log/`。

---

## 12. 启动、构建、发版

```bash
# 后端（backend/ 目录下）
pip install -r requirements.txt
uvicorn app.main:app --port 8002          # 开发（启动时自动迁移+种子）
# Docker
docker compose up -d                       # 8002，数据卷 ./data

# 前端（frontend/ 目录下）
npm install
npm run dev            # Vite(5173) + Electron
npm run dev:vite       # 只起 Vite，浏览器预览
npm run build          # tsc + vite build → dist/
npm run package        # build + electron-builder → ../前端/*.exe

# 网页版（同源，不写死 IP）
npx vite build --mode web

# 一键发版（改版本号 → 提交 → 构建 → 打 tag → GitHub Release）
bash publish.sh 2.0.3
```

**CI/CD**（`.github/workflows/`）
- `backend-docker.yml`：`backend/**` 变更 → 构建推送 `ghcr.io/cmj4088/tao-backend`（分支 main / combined-test）
- `frontend-release.yml`：`frontend/**` 变更 → windows-latest 构建 Electron 安装包并上传 artifact

**更新分发**：Electron 用 `electron-updater` 走 **GitHub Release**（`package.json > build.publish`）；后端用 `bash update.sh` 手动拉镜像。

---

## 13. 版本号规则

当前版本 **2.0.2**，只需同步 **2 处**：

| 位置 | 说明 |
|------|------|
| `backend/app/main.py` → `VERSION` | `/api/version` 返回它 |
| `frontend/package.json` → `version` | electron-builder 用它生成包名；`preload.cjs` 从它动态读取 |

- `preload.cjs` 不再硬编码版本（旧文档说要改 4 处，已过时）。
- `VersionBadge.tsx` 内仍有 `"0.1.3"` 兜底常量，但该组件当前未被引用（见 §15）。
- `publish.sh <version>` 会自动改这两处。

---

## 14. 禁止事项（违反即错误）

### 前端
- ❌ 禁止用 `electron/` 作目录名（与 `require("electron")` 冲突），必须用 `electron-main/`。
- ❌ 禁止把 Electron 主进程写成 TypeScript，必须是纯 CJS（`.cjs`），且只能用 `require`。
- ❌ 禁止在 `vite.config.ts` 引入 electron 相关插件。
- ❌ 禁止改动 5173 端口。
- ❌ 禁止修改 `index.html` 的 `<div id="root">`。
- ❌ 禁止卸载 App 组件（必须 `display`/`hidden` 切换，始终挂载）。
- ❌ 禁止新增 UI 框架（Ant Design 已移除，统一 shadcn/ui + Tailwind + lucide）。
- ❌ 禁止绕开 `api/client.ts` 直接 `axios.create`（备份导出/上传等 multipart 场景除外，需自带超时与裸 axios 说明）。
- ❌ 禁止绕开 `api/tokenStore.ts` 直接读写 token / localStorage。

### 后端
- ❌ 禁止修改 8002 端口。
- ❌ 禁止把 SQLAlchemy 改成异步（项目使用同步 Session）。
- ❌ 禁止改动数据库路径锚定逻辑（`_BACKEND_DIR/data/tao.db`）。
- ❌ 禁止改用 SQLite 以外的数据库。
- ❌ 禁止用 `Base.metadata.create_all` 建表——**一律走 Alembic 迁移**。
- ❌ 禁止在 `_boot_lock()` 之外做启动期写库操作。
- ❌ 禁止硬编码 API Key 到前端或提交到仓库；敏感值一律走加密配置。

### 通用
- ❌ 禁止在未更新本文档的情况下新增端口、环境变量、路由前缀。
- ❌ 禁止提交 `backend/data/`（含数据库与 admin 初始密码）、`前端/`、`node_modules/`、`dist/`。
- ❌ 禁止使用 emoji（除非用户明确要求）。
- ❌ 禁止在没有用户明确指示的情况下 `git commit` / `git push`。

---

## 15. 已知陷阱与遗留问题

1. **`ELECTRON_RUN_AS_NODE=1`**：某些终端环境会设置它，导致 `require("electron")` 返回 undefined。测试 Electron 前需 `unset ELECTRON_RUN_AS_NODE`。
2. **electron-builder 下载工具超时**：需设镜像 `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。
3. **`npmmirror` 的 Electron 二进制可能缺 `electron.exe`**：若 `node_modules/electron/dist/` 无 exe，从 GitHub Releases 手动下载。
4. **Electron 版必须写死绝对 IP**；后端 IP 变化（校园网 DHCP）需重新 `npm run package`。网页版留空同源，不受影响。
5. **Windows 下不要用 `os.replace` 替换正在使用的 `tao.db`**（认证依赖握着连接，会 WinError 5）——恢复备份用 SQLite backup API（见 `backup.py`）。
6. **`alembic.ini` 必须保持纯 ASCII**：Windows GBK locale 下 configparser 解码中文注释会崩。
7. **APP01 SSE 用 EventSource、APP02 SSE 用 fetch 流**：给 APP01 加鉴权时必须同步改前端（见 §6）。
8. **`APP01` 审查不读用户级 LLM 配置**：用户配了自己的 key 后，APP01 仍走管理员全局配置。
9. **`VersionBadge.tsx` 是死代码**（`ConsoleLayout` 顶栏只留了注释占位），内含 `"0.1.3"` 兜底常量；如需启用请先改为从 `electronAPI.version` 取。
10. **`app02/ai-review/progress` 无鉴权**，且 task 字典全局共享。
11. **`backend/data/admin_init.txt` 明文保存初始管理员密码**，仅首次生成时写入；请登录后立即改密并妥善处理该文件。
12. **`.git` 曾因一次被 reset 的提交残留 22 份安装包对象（1.88GB 不可达对象）**，已于 2026-10-14 用 `reflog expire + gc --prune=now` 回收。**不要把安装包/zip 提交进 git**。
