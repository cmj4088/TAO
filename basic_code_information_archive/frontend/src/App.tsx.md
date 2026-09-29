# App.tsx — React 根组件

**文件路径**：`frontend/src/App.tsx`

**路由结构**：单一通配路由 `path="*"` → `ConsoleLayout`，所有子路由由 ConsoleLayout 内部通过 `display` 切换管理。

**关键设计**：
- 所有 App 始终挂载，仅通过 CSS `display: none/block` 切换可见性
- 切换不卸载组件，确保 SSE 连接和后台任务不中断
- `ConfigProvider` 使用中文 locale (`zhCN`)，主色 `#1677ff`
- `UpdateNotification` 组件始终渲染
- 主题从 `useSettingsStore` 读取（目前浅色/深色主题切换未实现暗色算法）
- 所有子应用通过 `React.lazy` 动态导入

**2026-09-08 修改（修复记住我）**：新增根路径路由 `/` → `RootRedirect` 组件——已登录（含记住我恢复的会话）直接进 `/home`，否则去 `/login`。修复此前启动永远命中 `*` 兜底跳登录页、导致"记住我"看似失效的问题
