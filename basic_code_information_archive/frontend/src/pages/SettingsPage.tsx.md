# pages/SettingsPage.tsx — 设置页面

**文件路径**：`frontend/src/pages/SettingsPage.tsx`

**三个设置区**：
1. **主题模式**：Select下拉框（light/dark）
2. **AI 审查并发数**：InputNumber（1-10），保存按钮触发 `saveApp02Settings()`
3. **大模型配置**：API URL、API Key（脱敏显示+修改按钮）、模型名称

**关键设计**：
- API Key 编辑状态：`editingKey` 控制是否显示输入框
- 脱敏显示：已配置时显示 `ark-00ec****b92c` 格式
- 保存逻辑：新Key不为空时传明文，否则只更新URL和Model
- 页面加载时自动调用 `loadApp02Settings()` 和 `loadFromServer()`

**2026-09-08 修改（v2.0.2）**：
- AI 用量 tab 改为渲染 `/api/stats/ai-usage` 真实数据（本人 + 系统级：统计卡/按模型分布/近 7 天条形，组件 `AiUsagePanel`）
- 关于系统：版本号从 `/api/version` 动态获取、AI 模型名显示当前配置（原写死 v0.2.1 / DeepSeek V4）

**2026-09-08 补充**：支持 `/settings#stats` 锚点——数据统计 Card 外有 `statsSectionRef` div，hash 命中时延时 300ms 平滑 `scrollIntoView`（首页数据统计卡跳转用）
