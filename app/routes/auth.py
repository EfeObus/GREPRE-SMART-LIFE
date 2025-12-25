"""
GrePre Smart Life - Authentication Routes
With user bootstrap, account lockout, password validation, and refresh tokens
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token, decode_token,
    create_refresh_token, create_token_pair, decode_refresh_token, REFRESH_TOKEN_EXPIRE_DAYS
)
from app.core.config import settings
from app.core.exceptions import ErrorCode
from app.core.security_utils import PasswordValidator, lockout_manager
from app.models import User
from app.schemas import UserCreate, UserResponse, UserLogin, Token
from app.schemas.schemas import RefreshTokenRequest
from app.services.bootstrap import bootstrap_new_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    create_samples: bool = Query(True, description="Create sample bills and documents for new user"),
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with optional bootstrap of sample data"""
    # Validate password strength
    is_valid, errors = PasswordValidator.validate(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.AUTH_WEAK_PASSWORD, "message": errors[0], "errors": errors}
        )
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.USER_ALREADY_EXISTS, "message": "Email already registered"}
        )
    
    try:
        # Create user
        user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            is_bootstrapped=False
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Bootstrap new user with sample data
        if create_samples:
            await bootstrap_new_user(user.id, db)
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": ErrorCode.TRANSACTION_FAILED, "message": f"Failed to create user: {str(e)}"}
        )


@router.post("/login", response_model=Token)
async def login(
    user_data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Login with account lockout protection"""
    email = user_data.email.lower()
    client_ip = get_client_ip(request)
    
    # Check if account is locked
    is_locked, seconds_remaining = await lockout_manager.is_locked(email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": ErrorCode.AUTH_ACCOUNT_LOCKED,
                "message": f"Account temporarily locked. Try again in {seconds_remaining // 60 + 1} minutes.",
                "retry_after": seconds_remaining
            }
        )
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        # Record failed attempt
        is_now_locked, lockout_seconds = await lockout_manager.record_failed_attempt(email, client_ip)
        
        if is_now_locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": ErrorCode.AUTH_ACCOUNT_LOCKED,
                    "message": f"Too many failed attempts. Account locked for {lockout_seconds // 60} minutes.",
                    "retry_after": lockout_seconds
                }
            )
        
        # Get remaining attempts
        attempts = await lockout_manager.get_attempt_count(email)
        remaining = lockout_manager.max_attempts - attempts
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.AUTH_INVALID_CREDENTIALS,
                "message": f"Incorrect email or password. {remaining} attempts remaining."
            }
        )
    
    # Clear failed attempts on successful login
    await lockout_manager.clear_failed_attempts(email)
    
    # Create token pair (access + refresh)
    access_token, refresh_token = create_token_pair(user.id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_expiration_hours * 3600
    )


@router.post("/token", response_model=Token)
async def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token, refresh_token = create_token_pair(user.id)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_expiration_hours * 3600
    )


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    request_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Exchange a valid refresh token for a new access token.
    
    This endpoint allows clients to obtain a new access token without
    requiring the user to log in again, as long as the refresh token
    is still valid.
    """
    # Decode and validate the refresh token
    payload = decode_refresh_token(request_data.refresh_token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.AUTH_INVALID_TOKEN,
                "message": "Invalid or expired refresh token"
            }
        )
    
    # Get user from token
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.AUTH_INVALID_TOKEN,
                "message": "Invalid token payload"
            }
        )
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.AUTH_INVALID_TOKEN,
                "message": "Invalid token payload"
            }
        )
    
    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.AUTH_INVALID_TOKEN,
                "message": "User not found"
            }
        )
    
    # Create new access token (refresh token stays the same)
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=request_data.refresh_token,  # Return same refresh token
        expires_in=settings.jwt_expiration_hours * 3600
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile")
async def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if "full_name" in profile_data:
        current_user.full_name = profile_data["full_name"]
    await db.commit()
    await db.refresh(current_user)
    return {"message": "Profile updated successfully"}


@router.put("/preferences")
async def update_preferences(
    prefs_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if "currency" in prefs_data:
        current_user.currency = prefs_data["currency"]
    if "theme" in prefs_data:
        current_user.theme = prefs_data["theme"]
    if "notifications_enabled" in prefs_data:
        current_user.notifications_enabled = prefs_data["notifications_enabled"]
    await db.commit()
    await db.refresh(current_user)
    return {"message": "Preferences updated successfully"}


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.delete(current_user)
    await db.commit()
    return {"message": "Account deleted successfully"}
