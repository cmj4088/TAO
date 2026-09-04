# publish.sh — 一键发版脚本

**文件路径**：`publish.sh`

**作用**：自动完成版本号更新、前端构建、安装包打包、部署到本地更新服务器的完整发版流程。

**用法**：`bash publish.sh <版本号>`（如 `bash publish.sh 0.2.1`）

**流程**：
1. 更新 `frontend/package.json` 和 `backend/app/main.py` 中的版本号
2. 提交版本号变更到 Git
3. 构建前端（Vite）
4. 构建 NSIS 安装包（electron-builder）
5. 推送代码到 GitHub + 打 tag
6. 创建 GitHub Release 并上传安装包（供 electron-updater 检测更新）
7. 打包后端代码到 `jiaowuban-backend/`

**命名规范**：`v{版本号}-jiaowuban-agent-setup.exe`

**更新方式**：electron-updater 通过 GitHub Release 检查更新（需科学上网）

**最后修改**：2026-07-14
**修改原因**：从 GitHub Release 改为本地 HTTP 服务器分发更新
