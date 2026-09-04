# frontend/ 目录说明

前端使用 **Electron + React + TypeScript + Vite** 构建桌面应用。

## 目录结构

```
frontend/
├── index.html                  # HTML 入口
├── package.json                # 依赖和脚本
├── vite.config.ts              # Vite 构建配置
├── tsconfig.json               # TypeScript 配置
├── electron-main/              # Electron 主进程
│   ├── main.cjs                # 主进程入口（窗口创建、更新检测）
│   └── preload.cjs             # 预加载脚本（安全暴露 API）
├── src/                        # 渲染进程（React 应用）
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件（路由和布局）
│   ├── api/                    # API 请求封装
│   │   └── client.ts           # Axios 客户端（统一请求配置）
│   ├── apps/                   # 子应用模块
│   │   ├── app01/              # 监考分配前端
│   │   │   └── index.tsx       # App01 主界面
│   │   └── app02/              # 文件审查前端
│   │       ├── index.tsx       # App02 主界面
│   │       ├── components/     # App02 组件
│   │       │   ├── StickerIndicator.tsx  # 贴纸指示器
│   │       │   └── StreamingText.tsx     # 流式文本显示
│   │       ├── hooks/          # App02 自定义 Hooks
│   │       │   └── useAiReviewStream.ts  # AI审查流式数据 Hook
│   │       └── utils/          # App02 工具函数
│   │           └── stickers.ts  # 贴纸相关工具
│   ├── components/             # 通用组件
│   │   ├── Layout/ConsoleLayout.tsx  # 控制台布局（左侧导航+右侧内容）
│   │   ├── UpdateNotification.tsx    # 版本更新通知组件
│   │   └── VersionBadge.tsx          # 版本号显示
│   ├── pages/                  # 页面组件
│   │   ├── AdminPage.tsx       # 管理员配置页面
│   │   └── SettingsPage.tsx    # 设置页面
│   ├── stores/                 # 状态管理
│   │   ├── appStore.ts         # 应用全局状态
│   │   └── settingsStore.ts    # 设置状态
│   └── types/                  # TypeScript 类型定义
│       └── index.ts            # 通用类型
└── dist/                       # 构建产物
```

## 关键设计
- **控制台布局**：左侧导航栏 + 右侧工作区
- **子应用模块化**：每个 app 独立开发，独立路由
- **版本更新**：Electron 主进程检测，前端组件通知
- **状态管理**：使用 Zustand 或 Context 管理状态