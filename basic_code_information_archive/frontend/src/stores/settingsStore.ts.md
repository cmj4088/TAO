# stores/settingsStore.ts — 设置状态

**文件路径**：`frontend/src/stores/settingsStore.ts`

**状态字段**：
- `theme`：`"light" | "dark"`，默认 `"light"`
- `apiBase`：后端地址，默认 `"http://10.50.150.176:8006"`（远程部署后端）
- `llmUrl`：大模型API地址
- `llmKey`：脱敏后的API Key（如 `ark-00ec****b92c`）
- `llmModel`：模型名称
- `hasKey`：是否已配置API Key
- `loading`：加载状态
- `app02AiConcurrency`：App02 AI审查并发数（1-10）

**方法**：
- `setTheme(t)` / `setLlmConfig(url, key, model)`：本地更新
- `saveLlmConfig(newKey?)`：保存到后端，key为空或脱敏时不更新key
- `loadFromServer()`：从后端加载（GET /api/admin/llm）
- `setApp02AiConcurrency(n)` / `saveApp02Settings()` / `loadApp02Settings()`

**API调用**：
- `GET /api/admin/llm` → 加载LLM配置
- `PUT /api/admin/llm` → 保存LLM配置
- `GET /api/app02/settings` → 加载App02设置
- `PUT /api/app02/settings` → 保存App02设置