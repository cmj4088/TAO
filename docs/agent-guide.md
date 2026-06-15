# 教务办·智能体 — Agent 编程规范

> **用途**：新 Claude Agent 接手本项目时，必须严格按此文件编程。不得自行发明端口、变量、目录结构。

---

## 1. 项目概述

"教务办·智能体"是高校教务办公室的轻量级桌面应用（约 10 用户），Electron 壳 + React 前端 + FastAPI 后端 + SQLite。

当前版本 `0.1.0`，框架已搭建完成，app01/app02 功能待开发。

---

## 2. 目录结构（不可修改）

```
TAO/
├── docs/                         # 需求文档
├── frontend/                     # Electron + React 前端（所有前端代码在这里）
│   ├── electron-main/            # Electron 主进程（纯 CJS，不经过 Vite 编译）
│   │   ├── main.cjs              # 窗口创建、生命周期
│   │   └── preload.cjs           # contextBridge 暴露安全 API
│   ├── src/                      # React 渲染进程（TypeScript，Vite 编译）
│   │   ├── main.tsx              # ReactDOM.createRoot 入口
│   │   ├── App.tsx               # 根路由：BrowserRouter + ConfigProvider
│   │   ├── api/
│   │   │   └── client.ts         # axios 实例，baseURL=http://localhost:8000
│   │   ├── apps/                 # 子应用页面
│   │   │   ├── app01/index.tsx   # 监考分配
│   │   │   └── app02/index.tsx   # 文件审查
│   │   ├── components/
│   │   │   ├── Layout/ConsoleLayout.tsx  # 左侧导航 + 顶栏 + 内容区
│   │   │   └── VersionBadge.tsx          # 版本更新提示 Tag
│   │   ├── pages/
│   │   │   ├── SettingsPage.tsx  # 主题设置
│   │   │   └── AdminPage.tsx     # 大模型 URL/Key 配置
│   │   ├── stores/
│   │   │   ├── appStore.ts       # 子应用注册 + 当前激活
│   │   │   └── settingsStore.ts  # 主题 + LLM 配置
│   │   └── types/
│   │       └── index.ts          # AppModule, SettingItem, LLMConfig, VersionInfo
│   ├── index.html                # Vite 入口 HTML
│   ├── package.json              # 依赖 + 脚本
│   ├── vite.config.ts            # Vite 配置（仅 @vitejs/plugin-react，无 electron 插件）
│   └── tsconfig.json             # TypeScript 配置
├── backend/                      # FastAPI 后端（所有后端代码在这里）
│   ├── app/
│   │   ├── main.py               # FastAPI 入口：CORS、路由注册、VERSION、REGISTERED_APPS
│   │   ├── config.py             # ConfigManager：键值配置读写
│   │   ├── database.py           # SQLite 连接 + init_db()
│   │   ├── models/
│   │   │   └── settings.py       # Setting ORM（key/value 表）
│   │   ├── routers/
│   │   │   ├── settings.py       # /api/settings、/api/admin/llm
│   │   │   ├── app01.py          # /api/app01/*
│   │   │   └── app02.py          # /api/app02/*
│   │   └── schemas/
│   │       └── settings.py       # Pydantic 模型
│   ├── data/                     # SQLite 数据库文件（自动创建）
│   ├── requirements.txt          # Python 依赖
│   ├── Dockerfile
│   └── docker-compose.yml
```

---

## 3. 端口分配（不可修改）

| 端口 | 用途 | 说明 |
|------|------|------|
| **5173** | Vite 开发服务器 | `vite.config.ts` 中 `server.port` 固定 |
| **8000** | FastAPI 后端 | `uvicorn --port 8000`，`Dockerfile` 暴露 8000 |

**规则**：
- 前端 `api/client.ts` 中 `API_BASE = "http://localhost:8000"`，硬编码，不可变。
- 后端 CORS 已配置 `allow_origins=["*"]`。
- 新增功能不得引入新端口。

---

## 4. 环境变量（仅此一个）

| 变量名 | 取值 | 作用 | 设置位置 |
|--------|------|------|----------|
| `VITE_DEV_SERVER_URL` | `http://localhost:5173` | Electron 开发模式下加载 Vite dev server | `package.json` dev 脚本通过 `cross-env` 设置 |

**规则**：
- 前端不读取任何其他环境变量（没有 `.env` 文件）。
- 后端不读取任何环境变量。
- 新增功能不得引入新环境变量，如有必要必须先更新本文档。

---

## 5. 前端路由表

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `ConsoleLayout` | 控制台布局，默认重定向到 `/app/app01` |
| `/app/app01` | `App01` | 监考分配页面 |
| `/app/app02` | `App02` | 文件审查页面 |
| `/settings` | `SettingsPage` | 主题设置 |
| `/admin` | `AdminPage` | 大模型配置 |

所有路由包裹在 `ConsoleLayout` 内，通过 `<Outlet />` 渲染子路由。

---

## 6. 后端 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/version` | 返回 `{"version": "0.1.0"}` |
| `GET` | `/api/apps` | 返回子应用列表 |
| `GET` | `/api/settings` | 获取所有设置项（key-value dict） |
| `PUT` | `/api/settings` | 批量更新设置 `{"settings":[{"key":"x","value":"y"}]}` |
| `GET` | `/api/admin/llm` | 获取大模型配置 `{"url":"","key":""}` |
| `PUT` | `/api/admin/llm` | 更新大模型配置 `{"url":"...","key":"..."}` |
| `GET` | `/api/app01/status` | app01 状态检查（占位） |
| `GET` | `/api/app02/status` | app02 状态检查（占位） |

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
  apiBase: string;         // 固定 "http://localhost:8000"
  llmUrl: string;
  llmKey: string;
  loading: boolean;
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string) => void;
  saveLlmConfig: () => Promise<void>;
  loadFromServer: () => Promise<void>;
}
```

**规则**：
- 新增子应用如需自己的 store，在 `frontend/src/stores/` 下新建，命名 `{appId}Store.ts`。
- Store 统一用 Zustand `create()`。

---

## 8. TypeScript 类型（`frontend/src/types/index.ts`）

```ts
interface AppModule {
  id: string;        // "app01"
  name: string;      // "监考分配"
  description: string;
  icon: string;      // Ant Design 图标名，如 "ScheduleOutlined"
}

interface SettingItem { key: string; value: string; }
interface LLMConfig { url: string; key: string; }
interface VersionInfo { version: string; }
```

---

## 9. 新增子应用步骤（严格按顺序）

1. **后端路由**：`backend/app/routers/app03.py`，`APIRouter(prefix="/api/app03")`，在 `main.py` 注册。
2. **后端注册**：在 `main.py` 的 `REGISTERED_APPS` 列表添加一项。
3. **前端页面**：`frontend/src/apps/app03/index.tsx`，默认导出 `React.FC`。
4. **前端路由**：在 `App.tsx` 添加 `lazy(() => import("@/apps/app03"))` 和对应 `<Route>`。
5. **前端注册**：在 `appStore.ts` 的 `DEFAULT_APPS` 添加一项。
6. **左侧导航图标**：在 `ConsoleLayout.tsx` 的 `ICON_MAP` 添加图标映射。

---

## 10. 启动命令

```bash
# 后端（在 backend/ 目录下运行）
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 前端开发（在 frontend/ 目录下运行）
npm install
npm run dev          # 同时启动 Vite + Electron

# 前端仅浏览器预览
npm run dev:vite     # 只启动 Vite，浏览器访问 http://localhost:5173

# 前端生产构建
npm run build        # tsc + vite build，输出到 dist/
```

`npm run dev` 内部执行流程：
1. `concurrently` 并行启动两个进程
2. 进程 A：`vite` → 启动 Vite dev server 在 5173 端口
3. 进程 B：`wait-on http://localhost:5173` → 等 Vite 就绪后 → `cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .`

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
| 后端框架 | FastAPI | 0.115.0 |
| 服务器 | uvicorn | 0.30.0 |
| ORM | SQLAlchemy | 2.0.35 |
| 数据库 | SQLite (aiosqlite) | 0.20.0 |
| 数据校验 | Pydantic | 2.9.0 |
| 语言 | TypeScript 5.5 + Python 3.12 |

---

## 12. 禁止事项（违反即错误）

### 前端
- ❌ **禁止**使用 `electron/` 作为目录名（会与 `require("electron")` 冲突），必须用 `electron-main/`。
- ❌ **禁止**引入 `vite-plugin-electron`、`vite-plugin-electron-renderer`、`electron-builder`（已废弃）。
- ❌ **禁止**将 Electron 主进程写成 TypeScript（`.ts`），必须是纯 CJS（`.cjs`）。
- ❌ **禁止**在 `vite.config.ts` 中配置 electron 相关插件。
- ❌ **禁止**在 `main.cjs` 中使用 `import` 语法（CJS 只能用 `require`）。
- ❌ **禁止**修改 5173 端口或 api/client.ts 中的 `API_BASE`。
- ❌ **禁止**新增 `.env` 文件或新增环境变量。
- ❌ **禁止**使用 `BrowserRouter` 之外的路由器。
- ❌ **禁止**修改 `index.html` 中的 `<div id="root">`。

### 后端
- ❌ **禁止**修改 8000 端口。
- ❌ **禁止**将 SQLAlchemy 改为异步（项目使用同步 Session）。
- ❌ **禁止**修改 `DATABASE_URL` 路径 `./data/tao.db`。
- ❌ **禁止**新增数据库（只使用 SQLite）。
- ❌ **禁止**修改 CORS 配置。

### 通用
- ❌ **禁止**在未更新本文档的情况下新增端口、环境变量、路由前缀。
- ❌ **禁止**使用 emoji（除非用户明确要求）。
- ❌ **禁止**主动 git commit。

---

## 13. Electron 主进程详细规范

### `electron-main/main.cjs`（不可改名、不可改后缀）

```js
const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
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

  // 开发模式：读取环境变量 VITE_DEV_SERVER_URL
  // 生产模式：加载 dist/index.html
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { app.quit(); });
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

### `electron-main/preload.cjs`

```js
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  version: "0.1.0",
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

单表 `settings`（键值存储）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | String, PK | 配置键 |
| `value` | String | 配置值 |

预定义键：
- `llm_url` — 大模型 API 地址
- `llm_key` — 大模型 API Key

---

## 16. 版本号更新规则

当前版本 `0.1.0`。版本号分布在两处，必须同步更新：
- `backend/app/main.py` 第 10 行：`VERSION = "0.1.0"`
- `frontend/electron-main/preload.cjs` 第 4 行：`version: "0.1.0"`
- `frontend/package.json`：`"version": "0.1.0"`
- `frontend/src/components/VersionBadge.tsx` 第 14 行：硬编码 `"0.1.0"`（版本比较用）

---

## 17. 已知陷阱

1. **ELECTRON_RUN_AS_NODE=1**：Claude Code 的 bash 环境设置了这个变量，会导致 `require("electron")` 返回 undefined。在 Claude Code 中测试 Electron 时，命令前必须加 `unset ELECTRON_RUN_AS_NODE &&`。用户自己的终端不受影响。

2. **npm 镜像二进制不完整**：npmmirror.com 下载的 Electron 可能缺少 `electron.exe`。如果 `npm install electron` 后 `node_modules/electron/dist/` 没有 exe，需从 GitHub Releases 手动下载。

3. **`concurrently` + `cross-env`**：Windows 上 `cross-env` 设置环境变量兼容 Electron 的 `process.env` 读取。

4. **`tsconfig.json` include**：当前 `include: ["src", "electron"]`，实际上 `electron-main/` 不在编译范围内（因为它本身就是 CJS，不需要 TypeScript 编译）。
