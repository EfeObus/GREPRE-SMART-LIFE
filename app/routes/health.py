"""
GrePre Smart Life - Health Check Routes
For load balancers, monitoring, and deployment checks
"""
import os
import time
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings

router = APIRouter(tags=["Health"])

# Track app start time
APP_START_TIME = time.time()


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 if the application is running.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe for Kubernetes/load balancers.
    Checks if the app can serve traffic (database connected, etc.)
    """
    checks = {
        "database": False,
        "filesystem": False
    }
    
    # Check database connection
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        checks["database"] = str(e)
    
    # Check filesystem (upload directory)
    try:
        upload_dir = settings.upload_dir
        if os.path.exists(upload_dir) and os.access(upload_dir, os.W_OK):
            checks["filesystem"] = True
        else:
            checks["filesystem"] = "Upload directory not writable"
    except Exception as e:
        checks["filesystem"] = str(e)
    
    # Overall status
    all_healthy = all(v is True for v in checks.values())
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/live")
async def liveness_check():
    """
    Liveness probe for Kubernetes.
    Returns 200 if the application process is alive.
    """
    uptime_seconds = time.time() - APP_START_TIME
    
    return {
        "status": "alive",
        "uptime_seconds": int(uptime_seconds),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/detailed")
async def detailed_health(db: AsyncSession = Depends(get_db)):
    """
    Detailed health information for monitoring dashboards.
    """
    import platform
    import sys
    
    uptime_seconds = time.time() - APP_START_TIME
    
    # Database stats
    db_status = "connected"
    try:
        result = await db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM bills"))
        bill_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM documents"))
        doc_count = result.scalar()
    except Exception as e:
        db_status = f"error: {str(e)}"
        user_count = bill_count = doc_count = 0
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "environment": settings.app_env,
        "uptime_seconds": int(uptime_seconds),
        "system": {
            "python_version": sys.version,
            "platform": platform.platform(),
            "processor": platform.processor()
        },
        "database": {
            "status": db_status,
            "users": user_count,
            "bills": bill_count,
            "documents": doc_count
        },
        "features": {
            "ocr_enabled": settings.ocr_enabled,
            "max_file_size_mb": settings.max_file_size // (1024 * 1024)
        }
    }
