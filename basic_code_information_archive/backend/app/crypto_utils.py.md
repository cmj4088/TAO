# crypto_utils.py — AES 加密工具

**文件路径**：`backend/app/crypto_utils.py`

**作用**：提供 AES 加密/解密功能，用于保护数据库中的敏感配置字段（如 API Key）。

**核心函数**：
- `encrypt(plain_text: str) -> str`：将明文加密为 Base64 编码的密文，格式为 `AES::<base64>` 
- `decrypt(cipher_text: str) -> str`：将密文解密为明文
- `mask_key(key: str) -> str`：对 Key 进行脱敏处理（如 `ark-00ec***-fb92c`），保留前14后5字符
- `is_encrypted(value: str) -> bool`：判断字符串是否已经加密（检查前缀 `AES::`）

**加密算法**：AES-256-CBC，密钥由固定因子派生。