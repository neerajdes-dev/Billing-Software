import base64
import hashlib
import hmac
import os
import time
import warnings

import jwt

_ITERATIONS = 390_000
_PREFIX = "pbkdf2_sha256"

_DEFAULT_SECRET_KEY = "insecure-dev-secret-change-me"
_SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY)
_JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

if _SECRET_KEY == _DEFAULT_SECRET_KEY and os.getenv("APP_ENV", "development") != "development":
    warnings.warn(
        "SECRET_KEY is not set. Using an insecure default outside development is unsafe "
        "-- set a long random SECRET_KEY environment variable.",
        RuntimeWarning,
    )


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


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    """Issue a signed JWT identifying the logged-in user (``sub`` = user_id)."""
    minutes = _ACCESS_TOKEN_EXPIRE_MINUTES if expires_minutes is None else expires_minutes
    now = int(time.time())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + minutes * 60,
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Verify and decode a JWT. Raises jwt.PyJWTError (or subclasses) if invalid/expired."""
    return jwt.decode(token, _SECRET_KEY, algorithms=[_JWT_ALGORITHM])
