# 教务办·智能体 — Agent 编程规范

> **用途**：新 Claude Agent 接手本项目时，必须严格按此文件编程。不得自行发明端口、变量、目录结构。

---

## 1. 项目概述

"教务办·智能体"是高校教务办公室的轻量级桌面应用（约 10 用户），Electron 壳 + React 前端 + FastAPI 后端 + SQLite。

当前版本 `0.1.3`，app01（监考分配）/ app02（文件审查）已完整实现。

---

## 2. 目录结构（不可修改）

```
TAO/
├── docs/                         # 需求文档 + 本规范
├── docx/                         # 项目设计与需求（最新）
├── basic_code_information_archive/ # 代码中文说明档案
├── MVPtext/                      # 任务分工文档
├── modification_log/             # 修改记录
├── skill/                        # 项目Skills
├── demo/                         # 演示程序
├── frontend/                     # Electron + React 前端（所有前端代码在这里）
│   ├── electron-main/            # Electron 主进程（纯 CJS，不经过 Vite 编译）
│   │   ├── main.cjs              # 窗口创建、生命周期、update检测
│   │   └── preload.cjs           # contextBridge 暴露安全 API
│   ├── src/                      # React 渲染进程（TypeScript，Vite 编译）
│   │   ├── main.tsx              # ReactDOM.createRoot 入口
│   │   ├── App.tsx               # 根组件：BrowserRouter + ConfigProvider
│   │   ├── api/
│   │   │   └── client.ts         # axios 实例，baseURL=http://localhost:8002
│   │   ├── apps/                 # 子应用页面
│   │   │   ├── app01/index.tsx   # 监考分配（完整实现）
│   │   │   └── app02/            # 文件审查（完整实现）
│   │   │       ├── index.tsx
│   │   │       ├── components/
│   │   │       │   ├── StickerIndicator.tsx
│   │   │       │   └── StreamingText.tsx
│   │   │       ├── hooks/
│   │   │       │   └── useAiReviewStream.ts
│   │   │       └── utils/
│   │   │           └── stickers.ts
│   │   ├── components/
│   │   │   ├── Layout/ConsoleLayout.tsx  # 左侧导航 + 顶栏 + 内容区
│   │   │   ├── UpdateNotification.tsx    # Electron更新弹窗
│   │   │   └── VersionBadge.tsx          # 版本更新提示 Tag
│   │   ├── pages/
│   │   │   ├── SettingsPage.tsx  # 主题 + AI并发 + LLM配置
│   │   │   └── AdminPage.tsx     # 大模型配置（独立页面）
│   │   ├── stores/
│   │   │   ├── appStore.ts       # 子应用注册 + 当前激活
│   │   │   └── settingsStore.ts  # 主题 + LLM + App02设置
│   │   └── types/
│   │       └── index.ts          # 全部类型定义
│   ├── index.html                # Vite 入口 HTML
│   ├── package.json              # 依赖 + 脚本 + electron-builder配置
│   ├── vite.config.ts            # Vite 配置（仅 @vitejs/plugin-react）
│   └── tsconfig.json             # TypeScript 配置
├── backend/                      # FastAPI 后端（所有后端代码在这里）
│   ├── app/
│   │   ├── main.py               # FastAPI 入口：CORS、路由注册、VERSION=0.1.3
│   │   ├── config.py             # ConfigManager：三级回退+加密
│   │   ├── crypto_utils.py       # AES-256-CBC 加密/解密/脱敏
│   │   ├── database.py           # SQLite 连接 + init_db() + 4个默认配置
│   │   ├── models/
│   │   │   └── settings.py       # Setting ORM（key/value/updated_at 表）
│   │   ├── routers/
│   │   │   ├── settings.py       # /api/settings、/api/admin/llm、/api/app02/settings
│   │   │   ├── app01.py          # /api/app01/*（10个端点 + SSE）
│   │   │   └── app02.py          # /api/app02/*（11个端点 + SSE）
│   │   ├── schemas/
│   │   │   ├── settings.py       # SettingItem, LLMConfig, App02Settings
│   │   │   ├── app01.py          # ExamRow, TeacherInfo, AllocateRequest/Response 等
│   │   │   └── app02.py          # ReviewIssue, FileReviewResult, SSE事件模型
│   │   └── services/
│   │       ├── invigilator.py          # 监考分配算法（贪心+AI兜底）
│   │       ├── ai_reviewer_app01.py    # App01 AI审查（SSE流式）
│   │       ├── ai_reviewer_app02.py    # App02 AI审查+后处理补丁
│   │       ├── doc_converter.py        # .doc→.docx（Word COM/LibreOffice）
│   │       └── doc_reviewer.py         # 模板分类+格式审查
│   ├── data/                     # SQLite 数据库文件（自动创建）
│   ├── requirements.txt          # Python 依赖
│   ├── Dockerfile                # Docker镜像（gunicorn + uvicorn workers）
│   ├── docker-compose.yml        # 容器编排（8002端口，ENCRYPTION_KEY）
│   └── update.sh                 # 手动更新脚本
├── 前端/                         # Electron打包产物（.exe安装包）
├── 后端/                         # 后端部署文件
└── 部署教程/                     # 部署操作指南
```

---

## 3. 端口分配（不可修改）

| 端口 | 用途 | 说明 |
|------|------|------|
| **5173** | Vite 开发服务器 | `vite.config.ts` 中 `server.port` 固定 |
| **8002** | FastAPI 后端 | Docker 容器内端口，`docker-compose.yml` 映射 |
| **8002** | FastAPI 后端（开发） | `frontend/src/api/client.ts` 中 `API_BASE` |

**规则**：
- 前端 `api/client.ts` 中 `API_BASE = "http://localhost:8002"`，硬编码，不可变。
- 后端 CORS 已配置 `allow_origins=["*"]`。
- 新增功能不得引入新端口。

---

## 4. 环境变量

**Docker 部署时**需要设置：
- `ENCRYPTION_KEY`：AES-256 加密密钥（32字节随机字符串），用于保护 `llm_key` 等敏感配置

**开发时**无需设置环境变量。Electron 通过 `app.isPackaged` 自动判断开发/生产模式：
- 开发模式（`npm run dev`）：加载 `http://localhost:5173`
- 生产模式（打包后）：加载 `dist/index.html`

**规则**：
- 前端不读取任何 `.env` 文件。
- 后端开发模式不读取环境变量（加密密钥会自动生成随机值并警告）。
- 新增功能不得引入环境变量，如有必要必须先更新本文档。

---

## 5. 前端路由表

所有路由包裹在 `ConsoleLayout` 内，**所有 App 始终挂载**，通过 `display: none/block` 切换可见性——切换不卸载组件，不中断 SSE 连接和后台任务。

| 路径 | 组件 | 说明 |
|------|------|------|
| `*` | `ConsoleLayout` | 控制台布局，通配路由 |
| `/app/app01` | `App01` (lazy) | 监考分配页面 |
| `/app/app02` | `App02` (lazy) | 文件审查页面 |
| `/settings` | `SettingsPage` (lazy) | 设置页面（主题+AI+LLM） |

> 注意：不再有独立的 `/admin` 路由，管理员功能已整合到 SettingsPage。

---

## 6. 后端 API 端点

### 通用接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/version` | 返回 `{"version": "0.1.3"}` |
| `GET` | `/api/apps` | 返回子应用列表 |
| `GET` | `/api/settings` | 获取所有设置（敏感字段脱敏） |
| `PUT` | `/api/settings` | 批量更新设置 `{"settings":[{"key":"x","value":"y"}]}` |
| `GET` | `/api/admin/llm` | 获取LLM配置 `{"url":"","key":"***","model":"","has_key":true}` |
| `PUT` | `/api/admin/llm` | 更新LLM配置（key含`****`时不更新key） |
| `GET` | `/api/app02/settings` | 获取App02设置 `{"ai_concurrency":1}` |
| `PUT` | `/api/app02/settings` | 更新App02设置 `{"ai_concurrency":3}` |

### App01 — 监考分配

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/app01/status` | 模块状态检查 |
| `POST` | `/api/app01/upload` | 上传考试安排表+通讯录（multipart: exam_file, contact_file） |
| `POST` | `/api/app01/allocate` | 执行监考分配 `{"exam_rows":[], "teachers":[], "mode":"strict"}` |
| `POST` | `/api/app01/swap` | 交换两个格子 `{"source_row_index":0,...}` |
| `POST` | `/api/app01/replace` | 替换单个格子 `{"row_index":0,"position":"监考1","new_teacher":"张三"}` |
| `POST` | `/api/app01/set-rows` | 批量替换所有行（撤销用） `{"exam_rows":[]}` |
| `POST` | `/api/app01/validate` | 校验分配结果，返回违规列表 |
| `GET` | `/api/app01/export` | 导出Excel（blob响应） |
| `POST` | `/api/app01/ai-review` | 启动AI审查，返回 `{"task_id":"...","status":"running"}` |
| `GET` | `/api/app01/ai-review/stream/{task_id}` | SSE流式获取AI审查结果 |

### App02 — 文件审查

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/app02/status` | 模块状态检查 |
| `POST` | `/api/app02/upload` | 上传文件（multipart: files，支持多文件） |
| `POST` | `/api/app02/reset` | 清空所有文件和结果 |
| `POST` | `/api/app02/review` | 执行审查（格式检查+AI审查后台任务） |
| `GET` | `/api/app02/preview/{file_id}` | 文件预览（PDF inline） |
| `GET` | `/api/app02/export` | 导出审查结果Excel（blob响应） |
| `GET` | `/api/app02/ai-review/status` | 检查API Key是否已配置 |
| `POST` | `/api/app02/ai-review/start` | 手动启动AI审查 |
| `GET` | `/api/app02/ai-review/stream/{task_id}` | SSE流式获取AI审查结果 |
| `GET` | `/api/app02/ai-review/progress/{task_id}` | 获取AI审查进度 |

**规则**：
- 所有 API 前缀 `/api/`。
- 新增子应用路由：`/api/{appId}/*`，在 `backend/app/routers/` 新建文件，在 `main.py` 中注册。
- SQLite 数据库文件路径：`backend/data/tao.db`（相对于 `backend/` 运行目录）。

---

## 7. Zustand Store 规范

### appStore（`frontend/src/stores/appStore.ts`）

```ts
interface AppState {
  apps: AppModule[];       // 已注册子应用列表
  activeAppId: string;     // 当前激活的子应用 ID
  setActiveApp: (id: string) => void;
  registerApp: (app: AppModule) => void;
}
```

默认注册了 `app01`（监考分配）和 `app02`（文件审查）。

### settingsStore（`frontend/src/stores/settingsStore.ts`）

```ts
interface SettingsState {
  theme: "light" | "dark";
  apiBase: string;         // 固定 "http://localhost:8002"
  llmUrl: string;          // 大模型API地址
  llmKey: string;          // 脱敏版本，如 ark-00ec****b92c
  llmModel: string;        // 模型名称
  hasKey: boolean;         // 是否已配置 API Key
  loading: boolean;
  app02AiConcurrency: number; // App02 AI并发数(1-10)
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string, model: string) => void;
  saveLlmConfig: (newKey?: string) => Promise<void>;
  loadFromServer: () => Promise<void>;
  setApp02AiConcurrency: (n: number) => void;
  saveApp02Settings: () => Promise<void>;
  loadApp02Settings: () => Promise<void>;
}
```

**规则**：
- 新增子应用如需自己的 store，在 `frontend/src/stores/` 下新建，命名 `{appId}Store.ts`。
- Store 统一用 Zustand `create()`。

---

## 8. TypeScript 类型（`frontend/src/types/index.ts`）

完整类型定义包括：
- `AppModule`、`SettingItem`、`LLMConfig`、`VersionInfo`
- App01：`TeacherInfo`、`ExamRow`、`AllocateResponse`、`ValidationError`、`ValidateResponse`
- App02：`ReviewIssue`、`FileReviewResult`、`ReviewResponse`、`UploadedFileInfo`、`UploadResponse`
- AI审查：`AiReviewFindingApp02`、`AiFileProgress`、`AiReviewProgressApp02`
- SSE事件：`SseTokenEvent`、`SseReasoningEvent`、`SseFileDoneEvent`、`SseFileErrorEvent`
- 贴纸：`StickerType = "pass" | "fail" | "ambiguous"`

---

## 9. 新增子应用步骤（严格按顺序）

1. **后端路由**：`backend/app/routers/app03.py`，`APIRouter(prefix="/api/app03")`，在 `main.py` 注册。
2. **后端注册**：在 `main.py` 的 `REGISTERED_APPS` 列表添加一项。
3. **前端页面**：`frontend/src/apps/app03/index.tsx`，默认导出 `React.FC`。
4. **前端路由**：在 `ConsoleLayout.tsx` 添加 `lazy(() => import("@/apps/app03"))` 和 display 切换 div。
5. **前端注册**：在 `appStore.ts` 的 `DEFAULT_APPS` 添加一项。
6. **左侧导航图标**：在 `ConsoleLayout.tsx` 的 `ICON_MAP` 添加图标映射。

---

## 10. 启动命令

```bash
# 后端（在 backend/ 目录下运行）
pip install -r requirements.txt
uvicorn app.main:app --port 8002

# 前端开发（在 frontend/ 目录下运行）
npm install
npm run dev          # 同时启动 Vite + Electron

# 前端仅浏览器预览
npm run dev:vite     # 只启动 Vite，浏览器访问 http://localhost:5173

# 前端生产构建
npm run build        # tsc + vite build，输出到 dist/
npm run package      # build + electron-builder 打包
```

`npm run dev` 内部执行流程：
1. `concurrently` 并行启动两个进程
2. 进程 A：`vite` → 启动 Vite dev server 在 5173 端口
3. 进程 B：`wait-on http://localhost:5173` → 等 Vite 就绪后 → `electron .`
4. Electron 主进程通过 `app.isPackaged` 判断为开发模式，自动加载 `http://localhost:5173`

---

## 11. 技术栈（不可更换）

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面壳 | Electron | ^31.7.7 |
| 前端框架 | React | ^18.3.1 |
| 构建工具 | Vite | ^5.4.3 |
| UI 库 | Ant Design | ^5.21.0 |
| 图标 | @ant-design/icons | ^5.4.0 |
| 状态管理 | Zustand | ^4.5.5 |
| 路由 | react-router-dom | ^6.26.0 |
| HTTP | axios | ^1.7.7 |
| 自动更新 | electron-updater | ^6.8.9 |
| 后端框架 | FastAPI | 0.115.0 |
| 服务器 | uvicorn / gunicorn | 0.30.0 / 23.0.0 |
| ORM | SQLAlchemy | 2.0.35 |
| 数据库 | SQLite (aiosqlite) | 0.20.0 |
| 数据校验 | Pydantic | 2.9.0 |
| Excel处理 | openpyxl | 3.1.5 |
| Word处理 | python-docx | 1.2.0 |
| 文档转换 | pywin32 | 308 |
| 异步HTTP | httpx | 0.27.2 |
| 加密 | cryptography | 44.0.0 |
| 语言 | TypeScript 5.5 + Python 3.12 |

---

## 12. 禁止事项（违反即错误）

### 前端
- ❌ **禁止**使用 `electron/` 作为目录名（会与 `require("electron")` 冲突），必须用 `electron-main/`。
- ❌ **禁止**引入 `vite-plugin-electron`、`vite-plugin-electron-renderer`、`electron-builder`（已废弃）。
- ❌ **禁止**将 Electron 主进程写成 TypeScript（`.ts`），必须是纯 CJS（`.cjs`）。
- ❌ **禁止**在 `vite.config.ts` 中配置 electron 相关插件。
- ❌ **禁止**在 `main.cjs` 中使用 `import` 语法（CJS 只能用 `require`）。
- ❌ **禁止**修改 5173 端口或 api/client.ts 中的 `API_BASE`（`http://localhost:8002`）。
- ❌ **禁止**新增 `.env` 文件或新增环境变量。
- ❌ **禁止**使用 `BrowserRouter` 之外的路由器。
- ❌ **禁止**修改 `index.html` 中的 `<div id="root">`。
- ❌ **禁止**卸载 App 组件（必须用 display 切换，始终挂载）。

### 后端
- ❌ **禁止**修改 8002 端口。
- ❌ **禁止**将 SQLAlchemy 改为异步（项目使用同步 Session）。
- ❌ **禁止**修改 `DATABASE_URL` 路径 `./data/tao.db`。
- ❌ **禁止**新增数据库（只使用 SQLite）。
- ❌ **禁止**修改 CORS 配置。
- ❌ **禁止**在 `settings` 表外新增表（如需扩展，必须先更新本文档）。

### 通用
- ❌ **禁止**在未更新本文档的情况下新增端口、环境变量、路由前缀。
- ❌ **禁止**使用 emoji（除非用户明确要求）。
- ❌ **禁止**主动 git commit。

---

## 13. Electron 主进程详细规范

### `electron-main/main.cjs`（不可改名、不可改后缀）

```js
const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow = null;

function setupAutoUpdater() {
  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-status", { type: "available", version: info.version });
  });
  autoUpdater.on("download-progress", (p) => {
    mainWindow?.webContents.send("update-status", { type: "progress", percent: Math.floor(p.percent) });
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update-status", { type: "downloaded" });
  });
}

ipcMain.handle("check-for-updates", () => autoUpdater.checkForUpdates());
ipcMain.handle("download-update", () => autoUpdater.downloadUpdate());
ipcMain.handle("quit-and-install", () => autoUpdater.quitAndInstall());

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 960, minHeight: 600,
    title: "教务办·智能体",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL("http://localhost:5173");
    if (process.env.NODE_ENV !== "test") setupAutoUpdater();
  } else {
    // 自定义 app:// 协议加载 dist/index.html
    protocol.registerFileProtocol("app", (req, cb) => {
      let fp = req.url.replace("app://", "");
      if (fp.endsWith("/")) fp += "index.html";
      cb(path.join(getDistPath(), fp));
    });
    await mainWindow.loadURL("app://index.html");
    setupAutoUpdater();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { app.quit(); });
```

### `electron-main/preload.cjs`

```js
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  version: "0.1.3",
  onUpdateStatus: (cb) => ipcRenderer.on("update-status", (_, data) => cb(data)),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
});
```

---

## 14. Vite 配置（`vite.config.ts`）

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],       // 仅此一个插件，不引入 electron 插件
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  base: "./",
  server: { port: 5173 },
  build: { outDir: "dist" },
});
```

---

## 15. 数据库模型

### settings 表（键值存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer, PK | 自增主键 |
| `key` | String, Unique | 配置键 |
| `value` | String | 配置值（敏感字段 AES-256-CBC 加密） |
| `updated_at` | DateTime | 最后更新时间 |

### 预置配置项

| key | 默认值 | 加密 | 说明 |
|-----|--------|------|------|
| `llm_key` | ark-00ec7229-...-fb92c | ✅ AES加密 | 大模型 API Key |
| `llm_url` | https://ark.cn-beijing.volces.com/api/v3/chat/completions | ❌ | API 地址 |
| `llm_model` | deepseek-v4-pro-260425 | ❌ | 模型名称 |
| `app02_ai_concurrency` | 1 | ❌ | App02 AI并发数 |

### 加密机制

- 算法：AES-256-CBC（`cryptography` 库）
- 密钥：从 `ENCRYPTION_KEY` 环境变量派生，开发时自动生成随机密钥
- 格式：`AES::<base64>` 前缀标记
- 敏感字段：`llm_key`（`_SENSITIVE_KEYS = {"llm_key"}`）
- 自动迁移：`init_db()` 检测旧明文数据自动加密
- 脱敏显示：`get_masked()` 返回 `前14字符****后5字符`

### 配置三级回退

1. 函数参数传入的值（优先级最高）
2. `ConfigManager.get()` 从数据库读取
3. 代码中硬编码的默认值

---

## 16. 版本号更新规则

当前版本 `0.1.3`。版本号分布在 4 处，必须同步更新：
- `backend/app/main.py` 第 10 行：`VERSION = "0.1.3"`
- `frontend/electron-main/preload.cjs`：`version: "0.1.3"`
- `frontend/package.json`：`"version": "0.1.3"`
- `frontend/src/components/VersionBadge.tsx`：版本比较硬编码 `"0.1.3"`

---

## 17. 已知陷阱

1. **ELECTRON_RUN_AS_NODE=1**：Claude Code 的 bash 环境设置了这个变量，会导致 `require("electron")` 返回 undefined。测试 Electron 时，命令前必须加 `unset ELECTRON_RUN_AS_NODE &&`。

2. **npm 镜像二进制不完整**：npmmirror.com 下载的 Electron 可能缺少 `electron.exe`。如果 `npm install electron` 后 `node_modules/electron/dist/` 没有 exe，需从 GitHub Releases 手动下载。

3. **`concurrently` + `cross-env`**：Windows 上 `cross-env` 设置环境变量兼容 Electron 的 `process.env` 读取。

4. **所有 App 始终挂载**：切换 App 时通过 `display: none/block` 而非卸载组件，确保 SSE 连接和后台任务不中断。

5. **API Key 脱敏保护**：前端存储的 `llmKey` 始终是脱敏版本（如 `ark-00ec****b92c`），修改时需点击"修改"按钮输入新 Key。`saveLlmConfig` 中 key 含 `****` 时不更新后端。

6. **Docker 加密密钥**：生产环境必须修改 `docker-compose.yml` 中的 `ENCRYPTION_KEY`，否则重启后加密数据无法解密。生成命令：`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`。

7. **后端端口**：`Dockerfile` EXPOSE 8002，`docker-compose.yml` 端口映射 8002:8002，前端 `api/client.ts` 也是 8002——三处必须一致。