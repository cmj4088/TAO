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