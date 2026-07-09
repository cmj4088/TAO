# ConnectionBanner.tsx — 后端连接状态检查

**文件路径**：`frontend/src/components/ConnectionBanner.tsx`

**作用**：应用启动时自动检测与后端的连接状态，连接失败时在页面顶部显示醒目的红色警告横幅。

**功能**：
- 启动时 ping 后端 `/api/version` 接口（5 秒超时）
- 首次检测失败后，每 30 秒自动轮询重试
- 连接恢复后横幅自动消失
- 用户可手动点击"重试"按钮立即检测
- 使用 `mountedRef` 防止组件卸载后的状态更新

**UI 表现**：
- `position: fixed` 固定在页面顶部居中，`z-index: 9999` 确保在最上层
- 红色 Alert 横幅，显示"未连接到服务器（http://localhost:8002）"
- 左侧 Wifi 图标 + 右侧重试按钮（检测中时图标旋转）

**三种状态**：
- `null` — 检测中，不显示任何内容
- `true` — 已连接，横幅隐藏
- `false` — 连接失败，显示警告横幅并开启轮询