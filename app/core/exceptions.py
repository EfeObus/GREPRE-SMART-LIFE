"""
GrePre Smart Life - Custom Exceptions and Error Handling
Consistent error model with domain-specific error codes
"""
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ErrorCode:
    """Domain-specific error codes"""

    # Authentication errors (1xxx)
    AUTH_INVALID_CREDENTIALS = "AUTH_1001"
    AUTH_TOKEN_EXPIRED = "AUTH_1002"
    AUTH_TOKEN_INVALID = "AUTH_1003"
    AUTH_USER_NOT_FOUND = "AUTH_1004"
    AUTH_EMAIL_EXISTS = "AUTH_1005"
    AUTH_ACCOUNT_DISABLED = "AUTH_1006"
    AUTH_ACCOUNT_LOCKED = "AUTH_1007"
    AUTH_WEAK_PASSWORD = "AUTH_1008"

    # Bill errors (2xxx)
    BILL_NOT_FOUND = "BILL_2001"
    BILL_ACCESS_DENIED = "BILL_2002"
    BILL_ALREADY_PAID = "BILL_2003"
    BILL_INVALID_AMOUNT = "BILL_2004"
    BILL_INVALID_DATE = "BILL_2005"
    BILL_DELETED = "BILL_2006"

    # Document errors (3xxx)
    DOC_NOT_FOUND = "DOC_3001"
    DOC_ACCESS_DENIED = "DOC_3002"
    DOC_FILE_TOO_LARGE = "DOC_3003"
    DOC_INVALID_TYPE = "DOC_3004"
    DOC_UPLOAD_FAILED = "DOC_3005"
    DOC_DELETED = "DOC_3006"

    # Payment errors (4xxx)
    PAYMENT_NOT_FOUND = "PAY_4001"
    PAYMENT_INVALID_AMOUNT = "PAY_4002"
    PAYMENT_FAILED = "PAY_4003"

    # User errors (5xxx)
    USER_NOT_FOUND = "USER_5001"
    USER_UPDATE_FAILED = "USER_5002"
    USER_DELETE_FAILED = "USER_5003"
    USER_ALREADY_EXISTS = "USER_5004"

    # Subscription/Tier errors (7xxx)
    TIER_BILL_LIMIT_REACHED = "TIER_7001"
    TIER_DOCUMENT_LIMIT_REACHED = "TIER_7002"
    TIER_UPGRADE_REQUIRED = "TIER_7003"
    TIER_SUBSCRIPTION_EXPIRED = "TIER_7004"
    TIER_INVALID_OPERATION = "TIER_7005"

    # Data errors (6xxx)
    DATA_VALIDATION_ERROR = "DATA_6001"
    DATA_EXPORT_FAILED = "DATA_6002"
    DATA_IMPORT_FAILED = "DATA_6003"

    # Server errors (9xxx)
    SERVER_ERROR = "SRV_9001"
    DATABASE_ERROR = "SRV_9002"
    TRANSACTION_FAILED = "SRV_9003"


class AppError(Exception):
    """Base application error with consistent structure"""

    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to response dictionary"""
        return {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.message,
                "details": self.details,
            },
        }


class AuthenticationError(AppError):
    """Authentication related errors"""

    def __init__(
        self,
        message: str,
        error_code: str = ErrorCode.AUTH_INVALID_CREDENTIALS,
        details: Optional[Dict] = None,
    ):
        super().__init__(message, error_code, 401, details)


class NotFoundError(AppError):
    """Resource not found errors"""

    def __init__(self, message: str, error_code: str, details: Optional[Dict] = None):
        super().__init__(message, error_code, 404, details)


class AccessDeniedError(AppError):
    """Access denied errors"""

    def __init__(self, message: str, error_code: str, details: Optional[Dict] = None):
        super().__init__(message, error_code, 403, details)


class ValidationError(AppError):
    """Data validation errors"""

    def __init__(
        self,
        message: str,
        error_code: str = ErrorCode.DATA_VALIDATION_ERROR,
        details: Optional[Dict] = None,
    ):
        super().__init__(message, error_code, 422, details)


class TransactionError(AppError):
    """Database transaction errors"""

    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(message, ErrorCode.TRANSACTION_FAILED, 500, details)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Global error handler for AppError exceptions"""
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


def create_error_response(
    message: str, error_code: str, details: Optional[Dict] = None
) -> Dict[str, Any]:
    """Create a consistent error response dictionary"""
    return {
        "success": False,
        "error": {"code": error_code, "message": message, "details": details or {}},
    }


def create_success_response(
    data: Any = None, message: str = "Success"
) -> Dict[str, Any]:
    """Create a consistent success response dictionary"""
    return {"success": True, "message": message, "data": data}
