"""AES-256-GCM 加密工具 — 用于保护 API Key 等敏感配置

加密密钥从环境变量 ENCRYPTION_KEY 读取，首次加解密时延迟初始化。
生产环境必须设置 ENCRYPTION_KEY 环境变量。

加密格式: "AES::" + base64(nonce + ciphertext)
前缀 "AES::" 用于 is_encrypted() 的 O(1) 判断，避免启发式误判。
"""
import os
import base64
import secrets
import warnings

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag

# 加密格式前缀
_PREFIX = "AES::"

# 延迟初始化：首次调用 _get_aesgcm() 时才读取环境变量并初始化
_KEY: bytes | None = None
_aesgcm: AESGCM | None = None


def _get_aesgcm() -> AESGCM:
    """延迟初始化 AESGCM 实例，确保环境变量在调用时已加载"""
    global _KEY, _aesgcm
    if _aesgcm is not None:
        return _aesgcm

    env_key = os.getenv("ENCRYPTION_KEY", "")
    if env_key:
        # 使用 SHA-256 派生 32 字节密钥，支持任意长度输入
        digest = hashes.Hash(hashes.SHA256())
        digest.update(env_key.encode("utf-8"))
        _KEY = digest.finalize()
    else:
        # 开发环境：生成随机密钥（重启后之前加密的数据将无法解密！）
        _KEY = secrets.token_bytes(32)
        warnings.warn(
            "ENCRYPTION_KEY 环境变量未设置！使用随机密钥，重启后已加密数据将无法解密。"
            "生产环境请务必设置 ENCRYPTION_KEY。",
            RuntimeWarning,
        )

    _aesgcm = AESGCM(_KEY)
    return _aesgcm


def encrypt(plain_text: str) -> str:
    """加密明文，返回带前缀的 Base64 密文

    格式: "AES::" + base64(nonce + ciphertext)
    每次加密使用随机 nonce，相同明文产生不同密文
    """
    nonce = secrets.token_bytes(12)  # GCM 推荐 12 字节 nonce
    ciphertext = _get_aesgcm().encrypt(nonce, plain_text.encode("utf-8"), None)
    return _PREFIX + base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt(encrypted_text: str) -> str:
    """解密密文，返回明文

    - encrypted_text 为空字符串时返回空字符串（兼容未配置场景）
    - 兼容旧格式（无前缀的 base64），便于迁移
    - 仅捕获预期的解密异常（InvalidTag/ValueError/UnicodeDecodeError），
      其他异常（如编程错误）正常传播
    """
    if not encrypted_text:
        return ""
    try:
        # 新格式：带 "AES::" 前缀
        if encrypted_text.startswith(_PREFIX):
            raw = base64.urlsafe_b64decode(encrypted_text[len(_PREFIX):].encode("ascii"))
        else:
            # 兼容旧格式（无前缀），用于迁移
            raw = base64.urlsafe_b64decode(encrypted_text.encode("ascii"))
        nonce, ciphertext = raw[:12], raw[12:]
        return _get_aesgcm().decrypt(nonce, ciphertext, None).decode("utf-8")
    except (InvalidTag, ValueError, UnicodeDecodeError):
        # 解密失败（密钥不匹配、数据损坏、或旧明文数据），返回空字符串
        return ""


def mask_key(key: str) -> str:
    """脱敏显示：保留前 8 位和后 4 位，中间替换为 ****

    - 长度 ≤ 8：全部替换为 ****
    - 长度 > 8：如 ark-00ec7229-...-fb92c → ark-00ec****b92c
    """
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return key[:8] + "****" + key[-4:]


def is_encrypted(value: str) -> bool:
    """判断值是否为加密格式（O(1) 前缀检查，零误判）"""
    if not value:
        return False
    return value.startswith(_PREFIX)