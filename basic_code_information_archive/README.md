# 项目根目录说明 — 教务办·智能体 (TAO)

## 项目定位
轻量级桌面控制台应用，为高校教务办老师（约10人）提升工作效率。即点即用，无需登录。

## 当前版本
**0.1.1**（注意：`main.py`中VERSION仍是0.1.0，需更新）

## 技术栈
- **前端**：Electron 31 + React 18 + TypeScript 5.5 + Vite 5 + Ant Design 5 + Zustand 4
- **后端**：Python 3.12 + FastAPI 0.115 + SQLAlchemy 2 + SQLite + Gunicorn
- **AI**：火山引擎 Ark API（DeepSeek V4 Pro）
- **部署**：Docker + docker-compose + GitHub Actions + GHCR

## 核心功能
- **App01 — 监考分配**：上传考试安排+通讯录，自动分配监考员，支持拖拽调整、AI审查
- **App02 — 文件审查**：上传教学文件，AI审查格式/内容/课时/错别字，支持批量+流式
- **设置面板**：主题、AI并发数、LLM配置（URL/Key/Model）
- **版本更新**：Electron自动检测+后端手动update.sh

## 目录结构
```
TAO/
├── backend/                        # 后端 FastAPI 代码
│   ├── app/
│   │   ├── main.py                 # 入口（VERSION, REGISTERED_APPS, 路由注册）
│   │   ├── config.py               # ConfigManager（三级回退+加密）
│   │   ├── crypto_utils.py         # AES-256-CBC加密工具
│   │   ├── database.py             # SQLite连接+建表+默认数据
│   │   ├── models/settings.py      # Setting ORM模型
│   │   ├── routers/                # API路由（settings/app01/app02）
│   │   ├── schemas/                # Pydantic数据校验
│   │   └── services/               # 业务逻辑（算法+AI+文档处理）
│   ├── Dockerfile                  # Docker镜像
│   ├── docker-compose.yml          # 容器编排（8002端口）
│   ├── requirements.txt            # Python依赖
│   └── update.sh                   # 手动更新脚本
├── frontend/                       # 前端 Electron + React
│   ├── electron-main/              # Electron主进程
│   │   ├── main.cjs                # 窗口创建+更新检测
│   │   └── preload.cjs             # 安全API暴露
│   ├── src/
│   │   ├── App.tsx                 # 根组件（单通配路由+display切换）
│   │   ├── api/client.ts           # axios实例（API_BASE=localhost:8002）
│   │   ├── apps/app01/             # 监考分配界面
│   │   ├── apps/app02/             # 文件审查界面（含SSE流式hook）
│   │   ├── components/             # 通用组件（Layout/UpdateNotification/VersionBadge）
│   │   ├── pages/                  # 页面（AdminPage/SettingsPage）
│   │   ├── stores/                 # Zustand（appStore/settingsStore）
│   │   └── types/                  # TypeScript类型定义
│   └── package.json                # 依赖+脚本+electron-builder配置
├── docs/                           # 原始需求文档
├── docx/                           # 🆕 项目设计与需求（最新版）
├── basic_code_information_archive/ # 🆕 代码中文说明档案
├── MVPtext/                        # 🆕 子Agent任务分工
├── modification_log/               # 🆕 修改记录
├── skill/                          # 🆕 项目Skills
├── demo/                           # 演示程序
├── 前端/                           # Electron打包产物
├── 后端/                           # 后端部署文件
└── 部署教程/                       # 部署操作指南
```

## 关键设计决策
1. **所有App始终挂载**：通过CSS display切换，不卸载组件，确保SSE连接和任务不中断
2. **三级配置回退**：参数 → 数据库 → 默认值
3. **AES加密存储**：API Key加密存储，旧明文自动迁移
4. **SSE流式AI审查**：支持双端（App01单文件+App02多文件并发）
5. **Python后处理补丁**：AI审查后确定性规则检查（29组错别字、课时验算、教师名一致）
6. **手动更新**：移除Watchtower，改为 `bash update.sh`