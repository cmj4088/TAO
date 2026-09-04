# electron-main/preload.cjs — 预加载脚本

**文件路径**：`frontend/electron-main/preload.cjs`

**作用**：Electron 预加载脚本，通过 contextBridge 安全地向渲染进程暴露 Node.js API，如版本信息、更新检测等。