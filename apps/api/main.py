import logging
import sys
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from db.base import engine, init_db

# Configure structured logging

# Set up standard logging as fallback to ensure logs are visible
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    stream=sys.stderr,
    force=True,  # Override any existing config
)

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        # In development, use readable console output; otherwise JSON
        (
            structlog.dev.ConsoleRenderer()
            if settings.environment == "development"
            else structlog.processors.JSONRenderer()
        ),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    cache_logger_on_first_use=False,
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting application", environment=settings.environment)
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down application")
    await engine.dispose()


app = FastAPI(
    title="PDF Reader API",
    description="API for PDF reading, annotation, and AI-powered chat",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/healthz", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "environment": settings.environment}


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "message": "PortDoc API",
        "version": "0.1.0",
        "docs": "/docs",
    }


# Import routers
from routers import documents, highlights, search, threads

app.include_router(documents.router, prefix="/v1", tags=["documents"])
app.include_router(threads.router, prefix="/v1", tags=["threads"])
app.include_router(highlights.router, prefix="/v1", tags=["highlights"])
app.include_router(search.router, prefix="/v1", tags=["search"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Unhandled exception", exc_info=exc, path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
