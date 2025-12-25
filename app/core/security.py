"""
GrePre Smart Life - Security Utilities
With refresh token support for production use.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Refresh token expiration (7 days by default)
REFRESH_TOKEN_EXPIRE_DAYS = 7


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token (short-lived)."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    to_encode.update(
        {"exp": expire, "type": TOKEN_TYPE_ACCESS, "iat": datetime.utcnow()}
    )
    encoded_jwt = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT refresh token (long-lived)."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Add unique token identifier for revocation support
    token_id = secrets.token_urlsafe(16)

    to_encode.update(
        {
            "exp": expire,
            "type": TOKEN_TYPE_REFRESH,
            "iat": datetime.utcnow(),
            "jti": token_id,  # JWT ID for token revocation
        }
    )
    encoded_jwt = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def create_token_pair(user_id: int) -> Tuple[str, str]:
    """Create both access and refresh tokens for a user."""
    data = {"sub": str(user_id)}
    access_token = create_access_token(data)
    refresh_token = create_refresh_token(data)
    return access_token, refresh_token


def decode_token(token: str, expected_type: Optional[str] = None) -> Optional[dict]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode
        expected_type: Optional token type to validate (access/refresh)

    Returns:
        The decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )

        # Validate token type if specified
        if expected_type:
            token_type = payload.get("type", TOKEN_TYPE_ACCESS)
            if token_type != expected_type:
                return None

        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a refresh token specifically."""
    return decode_token(token, expected_type=TOKEN_TYPE_REFRESH)


def get_token_id(token: str) -> Optional[str]:
    """Extract the JTI (token ID) from a token for revocation purposes."""
    payload = decode_token(token)
    if payload:
        return payload.get("jti")
    return None
