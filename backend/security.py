import base64
import hashlib
import hmac
import os

_ITERATIONS = 390_000
_PREFIX = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    if not password or len(password) < 6:
        raise ValueError("Password must contain at least 6 characters")
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{_PREFIX}${_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    if not stored.startswith(f"{_PREFIX}$"):
        # Backward compatibility for existing plaintext accounts. The caller
        # should migrate the value to a hash after a successful login.
        return hmac.compare_digest(password, stored)
    try:
        _, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False
