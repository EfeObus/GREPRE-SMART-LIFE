"""
GrePre Smart Life - Main Application
Production-ready with security middleware, rate limiting, and logging
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.config import settings
from app.core.database import init_db
from app.core.middleware import (
    CompressionMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from app.routes import (
    auth_router,
    bills_router,
    dashboard_router,
    documents_router,
    health_router,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("grepre")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.app_name}...")
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs("static", exist_ok=True)
    logger.info(f"Application started on port {settings.web_port}")
    yield
    # Shutdown
    logger.info("Shutting down application...")


app = FastAPI(
    title=settings.app_name,
    description="Track your bills, store your documents, never miss a deadline",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

# Add middleware (order matters - last added is first executed)
# 1. Compression (innermost - compresses final response)
app.add_middleware(CompressionMiddleware, minimum_size=500)

# 2. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 3. Rate limiting
app.add_middleware(
    RateLimitMiddleware,
    default_limit=100,  # 100 requests per minute for API
    default_window=60,
    auth_limit=5,  # 5 login attempts per minute
    auth_window=60,
)

# 4. Request logging (outermost - logs all requests)
app.add_middleware(RequestLoggingMiddleware)

# 5. CORS
allowed_origins = (
    ["*"]
    if settings.debug
    else [
        f"http://localhost:{settings.web_port}",
        f"https://localhost:{settings.web_port}",
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Health check routes (no /api prefix for load balancers)
app.include_router(health_router)

# API Routes (v1)
app.include_router(auth_router, prefix="/api")
app.include_router(bills_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")

# API v1 alias for future versioning
app.include_router(auth_router, prefix="/api/v1", include_in_schema=False)
app.include_router(bills_router, prefix="/api/v1", include_in_schema=False)
app.include_router(documents_router, prefix="/api/v1", include_in_schema=False)
app.include_router(dashboard_router, prefix="/api/v1", include_in_schema=False)


# Frontend Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/bills", response_class=HTMLResponse)
async def bills_page(request: Request):
    return templates.TemplateResponse("bills.html", {"request": request})


@app.get("/documents", response_class=HTMLResponse)
async def documents_page(request: Request):
    return templates.TemplateResponse("documents.html", {"request": request})


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    return templates.TemplateResponse("settings.html", {"request": request})
