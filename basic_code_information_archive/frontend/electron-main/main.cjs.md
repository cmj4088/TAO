# electron-main/main.cjs — Electron 主进程

**文件路径**：`frontend/electron-main/main.cjs`

**作用**：Electron 应用的主进程入口，负责：
1. 创建浏览器窗口（BrowserWindow）
2. 设置窗口大小、标题、菜单
3. 版本更新检测（检查 GitHub Release）
4. 应用生命周期管理