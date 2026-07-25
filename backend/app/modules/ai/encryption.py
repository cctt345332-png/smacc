"""
Encryption helpers for API keys.
Uses Fernet symmetric encryption — key derived from SECRET_KEY.
"""
import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    """اشتق مفتاح Fernet من SECRET_KEY"""
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_key(plain_text: str) -> str:
    """تشفير مفتاح API"""
    if not plain_text:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()


def decrypt_key(encrypted_text: str) -> str:
    """فك تشفير مفتاح API"""
    if not encrypted_text:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_text.encode()).decode()
    except Exception:
        return ""


def mask_key(plain_text: str) -> str:
    """إخفاء المفتاح للعرض — sk-...xxxx"""
    if not plain_text or len(plain_text) < 8:
        return "****"
    return plain_text[:6] + "..." + plain_text[-4:]
