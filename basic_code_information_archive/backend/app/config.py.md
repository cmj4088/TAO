# config.py — 配置管理器

**文件路径**：`backend/app/config.py`

**作用**：封装对 SQLite 数据库的键值配置读写操作，提供 `ConfigManager` 静态类，实现**三级回退**机制。

**核心功能**：
1. **读写配置**：`get(key, default)` / `set(key, value)` 从 SQLite 的 `settings` 表读写
2. **敏感字段加密**：`llm_key` 等敏感字段自动 AES-256-CBC 加密存储，读取时自动解密
3. **旧数据兼容**：如果发现旧的明文数据，自动迁移为加密存储（`is_encrypted()` 检测前缀 `AES::`）
4. **脱敏显示**：`get_masked(key)` 返回脱敏后的值（保留前14后5字符，如 `ark-00ec****b92c`）
5. **批量操作**：`set_batch(dict)` 批量写入配置，`get_all()` 获取所有配置
6. **存在检查**：`has_key(key)` 判断某配置是否有值

**敏感字段列表**（`_SENSITIVE_KEYS`）：
- `llm_key`：大模型 API Key

**三级回退机制**（在各 service 中实现）：
1. 请求参数传入的值（优先级最高）
2. ConfigManager 从数据库读取（`ConfigManager.get("llm_key", "")`）
3. 代码中硬编码的默认值（如 `ARK_URL`、`AI_MODEL`）

**加密存储格式**：`AES::<base64编码的密文>`
**脱敏格式**：`ark-00ec****b92c`（保留前14后5字符）