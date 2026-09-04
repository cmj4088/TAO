# schemas/settings.py — 设置数据模型

**文件路径**：`backend/app/schemas/settings.py`

**作用**：定义设置相关接口的请求/响应 Pydantic 模型，用于数据校验和序列化。

**主要模型**：
- `LLMConfigRequest`：更新 LLM 配置的请求体
- `LLMConfigResponse`：读取 LLM 配置的响应体