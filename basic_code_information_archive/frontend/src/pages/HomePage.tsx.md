# pages/HomePage.tsx — 首页

## 文件: HomePage.tsx
- **路径**: `frontend/src/pages/HomePage.tsx`
- **作用**: 应用首页：欢迎区、两个功能模块入口卡片（监考分配/文件审查）、三张快捷信息卡、使用提示
- **关键函数/类**:
  - `apps`: 模块入口配置数组，点击卡片 `handleEnter` → `navigate(/app/{id})`
  - 首页加载时并行请求 `/api/version`、`/api/auth/llm-config`、`/api/stats/ai-usage`（失败静默保持占位文案）
  - **AI 驱动卡片**: 实时显示用户配置的模型名（`llm-config.model`），未配置时显示"未配置，请前往设置"
  - **数据统计卡片**: 显示当前用户累计 AI 用量（调用次数 + tokens），点击 `navigate("/settings")` 跳转设置页
- **依赖关系**:
  - 引入: react-router-dom、lucide-react、ui 组件、`@/stores/appStore`、`@/stores/authStore`、`@/api/client`
  - 被引用: `App.tsx` 路由（`/home`）
- **最后修改**: 2026-09-08
- **修改原因**: AI 驱动卡模型名从写死"DeepSeek V4"改为实时显示配置的模型；数据统计卡新增本人用量展示与跳转设置页（原为不可点击的纯静态卡）

**2026-09-08 补充**：数据统计卡跳转目标为 `/settings#stats`，配合设置页锚点自动滚动到数据统计区块
