# frontend/ 目录说明

前端使用 **Electron + React + TypeScript + Vite** 构建桌面应用。

> 最后校准：2026-10-14（对应代码 v2.0.2）。编程规范见 `docs/agent-guide.md`。

## 目录结构

```
frontend/
├── index.html                  # HTML 入口
├── package.json                # 依赖、脚本与 electron-builder 配置
├── vite.config.ts              # Vite 配置（仅 @vitejs/plugin-react，端口 5173）
├── tailwind.config.ts          # Tailwind 配置
├── .env.development            # VITE_API_BASE=开发后端
├── .env.production             # VITE_API_BASE=老师服务器（桌面版写死绝对 IP）
├── .env.web                    # VITE_API_BASE=（空 → 同源 /api，供网页版构建）
├── electron-main/              # Electron 主进程（纯 CJS，不经 Vite 编译）
│   ├── main.cjs                # 窗口创建、app:// 协议、自动更新（electron-updater）
│   └── preload.cjs             # contextBridge 暴露 electronAPI（版本号从 package.json 动态读取）
├── src/                        # 渲染进程（React 应用）
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件：ThemeProvider + BrowserRouter + 路由表
│   ├── index.css               # Tailwind 入口 + 主题 CSS 变量
│   ├── api/                    # API 请求封装
│   │   ├── client.ts           # Axios 实例 + 401 自动刷新 token
│   │   └── tokenStore.ts       # token 统一存取层（"记住我"决定是否落 localStorage）
│   ├── apps/                   # 子应用模块
│   │   ├── app01/              # 监考分配前端
│   │   │   └── index.tsx       # App01 主界面（上传/分配/拖拽/校验/导出/AI 审查）
│   │   └── app02/              # 文件审查前端
│   │       ├── index.tsx       # App02 主界面
│   │       ├── components/     # StickerIndicator / StreamingText
│   │       ├── hooks/          # useAiReviewStream（fetch 流式解析 SSE）
│   │       └── utils/          # stickers.ts
│   ├── components/             # 通用组件
│   │   ├── Layout/ConsoleLayout.tsx  # 控制台布局（可折叠侧栏 + 顶栏 + 内容区）
│   │   ├── AuthGuard.tsx             # 路由守卫（登录态 + 权限）
│   │   ├── ConnectionBanner.tsx      # 后端连接失败横幅
│   │   ├── UpdateNotification.tsx    # 自动更新弹窗
│   │   ├── ProviderQuickSelect.tsx   # LLM 服务商快捷预设
│   │   ├── ThemeProvider.tsx         # 明暗主题
│   │   ├── VersionBadge.tsx          # 版本更新提示（当前未被引用，属死代码）
│   │   └── ui/                       # shadcn/ui 组件（Radix 封装）
│   ├── lib/utils.ts            # cn() 等工具函数
│   ├── pages/                  # 页面组件
│   │   ├── LoginPage.tsx       # 登录（含"记住我"）
│   │   ├── RegisterPage.tsx    # 注册（邮箱验证码）
│   │   ├── HomePage.tsx        # 快捷入口首页（应用卡片 + 模型名 + AI 用量）
│   │   ├── SettingsPage.tsx    # 设置（主题 / LLM / AI 并发 / 用量统计 / 改密）
│   │   └── AdminPage.tsx       # 管理后台（用户管理 / 系统设置 / 备份恢复）
│   ├── stores/                 # 状态管理（Zustand）
│   │   ├── appStore.ts         # 子应用注册表 + 当前激活
│   │   ├── authStore.ts        # 登录态、用户信息、hasPermission
│   │   ├── settingsStore.ts    # APP02 AI 并发数
│   │   └── themeStore.ts       # 明暗主题
│   └── types/                  # TypeScript 类型定义
│       └── index.ts            # 全部通用类型
└── dist/                       # 构建产物（已 gitignore）
```

## 关键设计
- **子应用始终挂载**：`display: none/block`（`hidden` class）切换，切换不卸载组件，SSE 与后台任务不中断
- **UI 体系**：Tailwind CSS + shadcn/ui（Radix）+ lucide 图标（Ant Design 已移除）
- **状态管理**：Zustand（app / auth / settings / theme）
- **认证**：Bearer token 由 `client.ts` 请求拦截器附加；401 由响应拦截器自动刷新并重放
- **token 持久化**：仅当勾选"记住我"时写 `localStorage`，否则纯内存会话
- **SSE 两种实现**：APP02 用 `fetch` + `ReadableStream`（可带 Authorization 头）；APP01 用 `EventSource`
- **API 地址**：`VITE_API_BASE ?? "http://localhost:8002"`，空串 = 同源请求（网页版）
