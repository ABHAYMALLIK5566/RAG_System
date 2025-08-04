"""
RAG Microservice - Main Application

A modular, production-ready RAG (Retrieval-Augmented Generation) microservice
with advanced features including multi-agent orchestration, real-time streaming,
and comprehensive monitoring.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator
import structlog

from .core.config import settings
from .core.module_registry_setup import (
    register_all_modules,
    initialize_modules,
    shutdown_modules,
    get_module_health
)
from .api import api_router, ws_router
from .security.middleware import SecurityMiddleware, AuthenticationMiddleware, authentication_middleware
from .security.csp_fix import CSPMiddleware

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Configure standard logging to reduce noise
log_level = getattr(logging, settings.log_level.upper(), logging.WARNING)
logging.basicConfig(
    level=log_level,  # Use configurable log level
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Set specific loggers to show important info
logging.getLogger("app").setLevel(logging.INFO)  # Show INFO for main app
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # Reduce access logs
logging.getLogger("uvicorn.error").setLevel(logging.WARNING)  # Reduce uvicorn errors
logging.getLogger("gunicorn.access").setLevel(logging.WARNING)  # Reduce gunicorn access logs
logging.getLogger("gunicorn.error").setLevel(logging.WARNING)  # Reduce gunicorn errors

# Disable noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("aiohttp").setLevel(logging.WARNING)
logging.getLogger("aioredis").setLevel(logging.WARNING)
logging.getLogger("asyncpg").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

logger = structlog.get_logger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    
    # Startup
    logger.info("🚀 Starting RAG Microservice...")
    
    try:
        # Register and initialize modules
        register_all_modules()
        await initialize_modules()
        logger.info("✅ RAG Microservice started successfully!")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Failed to start service: {e}")
        # Continue in degraded mode for testing
        logger.info("Continuing in degraded mode...")
        yield
    
    finally:
        # Shutdown
        try:
            await shutdown_modules()
            logger.info("✅ RAG Microservice shut down successfully!")
        except Exception as e:
            logger.error(f"❌ Error during shutdown: {e}")

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    Advanced RAG Microservice with modular architecture:
    
    ## Core Features
    - **Modular Design**: Clean separation of concerns with independent modules
    - **Advanced RAG**: Multi-algorithm search and intelligent response generation
    - **Multi-Agent Orchestration**: Specialized agents for different query types
    - **Real-time Streaming**: Server-sent events and WebSocket support
    - **Comprehensive Monitoring**: Health checks, metrics, and performance tracking
    
    ## API Endpoints
    - `/api/v1/rag/query`: Core RAG operations with streaming support
    - `/api/v1/rag/search`: Advanced search with multiple algorithms
    - `/api/v1/rag/documents`: Document management and bulk operations
    - `/ws`: WebSocket endpoint for real-time communication
    - `/health`: System health and module status
    
    ## Authentication & Security
    - JWT-based authentication
    - API key support
    - Role-based permissions
    - Rate limiting and IP blocking
    
    ## Architecture
    - Database Module: PostgreSQL with pgvector
    - Cache Module: Redis and memory caching
    - RAG Module: Core RAG functionality
    - Auth Module: Authentication and authorization
    - Streaming Module: Real-time communication
    - Webhook Module: Event notifications
    - Monitoring Module: Performance tracking
    """,
    docs_url="/docs" if not settings.debug else "/docs",
    redoc_url="/redoc" if not settings.debug else "/redoc",
    openapi_url="/openapi.json" if not settings.debug else "/openapi.json",
    lifespan=lifespan
)

# Test endpoint at the very beginning
@app.get("/early-test")
async def early_test():
    return {"message": "Early test endpoint works!"}

@app.get("/cors-test")
async def cors_test():
    """Test endpoint to verify CORS is working"""
    return {"message": "CORS test endpoint works!", "timestamp": time.time()}

@app.options("/cors-test")
async def cors_test_options():
    """Handle CORS preflight for test endpoint"""
    return {"message": "CORS preflight OK"}

# Direct debug endpoints (before middleware and routers)
@app.get("/direct-debug")
async def direct_debug():
    return {"message": "Direct debug endpoint is working!"}

@app.get("/debug/simple")
async def debug_simple():
    """Simple debug endpoint"""
    return {"message": "Simple debug endpoint works"}

@app.get("/debug/auth-test")
async def debug_auth_test(request: Request):
    """Test endpoint to check if authentication middleware is working"""
    print(f"[DEBUG] /debug/auth-test endpoint called")
    auth_header = request.headers.get("authorization")
    print(f"[DEBUG] Auth header: {auth_header}")
    return {"message": "Auth test endpoint", "auth_header": auth_header}

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3002", 
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-API-Key",
        "X-Callback-URL",
        "X-Webhook-Secret",
        "Cache-Control",
        "Pragma"
    ],
    expose_headers=["Content-Length", "Content-Type"],
    max_age=86400,  # Cache preflight response for 24 hours
)

# Add Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if settings.debug else ["localhost", "127.0.0.1"]
)

# Temporarily comment out all middleware to test endpoints
# app.add_middleware(SecurityMiddleware)
# app.add_middleware(
#     AuthenticationMiddleware,
#     protected_paths=[
#         "/api/v1/rag/documents",
#         "/api/v1/rag/query",
#         "/api/v1/rag/search",
#         "/api/v1/admin",
#         "/api/v1/auth/me"
#     ]
# )

# Add CSP middleware
app.add_middleware(CSPMiddleware)

# Test endpoint before router inclusion
@app.get("/test-auth-before")
async def test_auth_endpoint_before(request: Request):
    """Test endpoint that should trigger authentication middleware"""
    print(f"[DEBUG] /test-auth-before endpoint called")
    auth_header = request.headers.get("authorization")
    print(f"[DEBUG] Auth header: {auth_header}")
    user = getattr(request.state, 'user', None)
    print(f"[DEBUG] User in request state: {user}")
    return {
        "message": "Auth test endpoint before routers", 
        "auth_header": auth_header,
        "user": str(user) if user else None
    }

@app.get("/test-simple")
async def test_simple_endpoint():
    """Simple test endpoint without Request parameter"""
    print(f"[DEBUG] /test-simple endpoint called")
    return {"message": "Simple test endpoint works"}

@app.get("/api/test-simple")
async def test_simple_api_endpoint():
    """Simple test endpoint with /api prefix"""
    print(f"[DEBUG] /api/test-simple endpoint called")
    return {"message": "API test endpoint works"}

# Include API routers
app.include_router(api_router)
app.include_router(ws_router)

# Debug endpoint (after routers to avoid conflicts)
@app.get("/debug/middleware")
async def debug_middleware(request: Request):
    """Debug endpoint to test middleware execution"""
    return {
        "message": "Middleware debug endpoint",
        "headers": dict(request.headers),
        "user": getattr(request.state, 'user', None),
        "token": getattr(request.state, 'token', None)
    }

@app.get("/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {"message": "Test endpoint works"}

@app.get("/test-auth")
async def test_auth_endpoint(request: Request):
    """Test endpoint that should trigger authentication middleware"""
    print(f"[DEBUG] /test-auth endpoint called")
    auth_header = request.headers.get("authorization")
    print(f"[DEBUG] Auth header: {auth_header}")
    user = getattr(request.state, 'user', None)
    print(f"[DEBUG] User in request state: {user}")
    return {
        "message": "Auth test endpoint", 
        "auth_header": auth_header,
        "user": str(user) if user else None
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "architecture": "modular",
        "timestamp": time.time(),
        "docs": "/docs",
        "health": "/health",
        "modules": "/health/modules"
    }

# Add Prometheus metrics instrumentation
Instrumentator().instrument(app).expose(app, endpoint="/health/metrics")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    try:
        # Get module health
        module_health = await get_module_health()
        
        # Calculate overall health
        healthy_modules = sum(1 for h in module_health.values() if h.get("status") == "healthy")
        total_modules = len(module_health)
        
        overall_status = "healthy" if healthy_modules == total_modules else "degraded"
        
        return {
            "status": overall_status,
            "timestamp": time.time(),
            "version": settings.app_version,
            "modules": module_health,
            "summary": {
                "total_modules": total_modules,
                "healthy_modules": healthy_modules,
                "unhealthy_modules": total_modules - healthy_modules
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }

# Module health endpoint
@app.get("/health/modules")
async def module_health_check():
    """Detailed module health status"""
    try:
        health = await get_module_health()
        return {
            "modules": health,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Module health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Features endpoint
@app.get("/features")
async def get_features():
    """Get available features and capabilities"""
    return {
        "core_features": [
            "Modular Architecture",
            "Advanced RAG Operations",
            "Multi-Agent Orchestration",
            "Real-time Streaming",
            "Document Management",
            "Advanced Search Algorithms"
        ],
        "search_algorithms": [
            "semantic",
            "keyword",
            "hybrid",
            "fuzzy",
            "contextual"
        ],
        "agent_types": [
            "general",
            "analytical",
            "creative",
            "technical",
            "research"
        ],
        "streaming_formats": [
            "server-sent-events",
            "websocket",
            "chunked"
        ],
        "security_features": [
            "JWT Authentication",
            "API Key Support",
            "Role-based Permissions",
            "Rate Limiting",
            "Input Validation",
            "IP Blocking"
        ]
    }

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.warning(
        f"HTTP {exc.status_code}: {exc.detail}",
        path=request.url.path,
        method=request.method,
        status_code=exc.status_code
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": request.url.path
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(
        f"Unhandled exception: {exc}",
        path=request.url.path,
        method=request.method,
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=True
    ) 