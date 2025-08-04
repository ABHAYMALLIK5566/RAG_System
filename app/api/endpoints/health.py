import asyncio
import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import psutil
import os

from ...services import cache, rag_engine, agent_executor
from ...core.database import db_manager
from ...core.config import settings
from ...security.security import security_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["Health"])

@router.get("/")
async def health_check():
    """Basic health check endpoint"""
    
    try:
        checks = {
            "status": "healthy",
            "service": "healthy",
            "timestamp": time.time(),
            "version": settings.app_version
        }
        
        return JSONResponse(status_code=200, content=checks)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
        )

@router.get("/detailed")
async def detailed_health_check():
    """Detailed health check with all service dependencies"""
    
    start_time = time.time()
    
    health_status = {
        "service": "healthy",
        "timestamp": start_time,
        "version": settings.app_version,
        "checks": {},
        "response_time_ms": 0
    }
    
    overall_healthy = True
    
    # Database health check
    try:
        db_healthy = await db_manager.health_check()
        health_status["checks"]["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "connection_pool": "active" if db_healthy else "inactive"
        }
        if not db_healthy:
            overall_healthy = False
    except Exception as e:
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_healthy = False
    
    # Cache health check
    try:
        cache_healthy = await cache.health_check()
        cache_stats = await cache.get_stats()
        health_status["checks"]["cache"] = {
            "status": "healthy" if cache_healthy else "degraded",
            "stats": cache_stats,
            "fallback_mode": not cache_healthy
        }
        # Don't mark overall system as unhealthy if only Redis is unavailable
        # The system can still function with memory cache fallback
    except Exception as e:
        health_status["checks"]["cache"] = {
            "status": "degraded",
            "error": str(e),
            "fallback_mode": True
        }
    
    # Agent health check
    try:
        agent_healthy = await agent_executor.health_check()
        health_status["checks"]["agent"] = {
            "status": "healthy" if agent_healthy else "degraded",
            "openai_integration": "active" if agent_healthy else "disabled",
            "fallback_mode": not agent_healthy
        }
        # Don't mark overall system as unhealthy if only OpenAI is unavailable
        # The system can still function in fallback mode
    except Exception as e:
        health_status["checks"]["agent"] = {
            "status": "degraded",
            "error": str(e),
            "fallback_mode": True
        }
    
    health_status["service"] = "healthy" if overall_healthy else "degraded"
    health_status["response_time_ms"] = int((time.time() - start_time) * 1000)
    
    status_code = 200 if overall_healthy else 503
    
    return JSONResponse(status_code=status_code, content=health_status)

@router.get("/metrics")
async def system_metrics():
    """System performance metrics and statistics"""
    
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        process = psutil.Process(os.getpid())
        process_memory = process.memory_info()
        
        app_metrics = {
            "system": {
                "cpu_percent": cpu_percent,
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "percent": memory.percent,
                    "used": memory.used
                },
                "disk": {
                    "total": disk.total,
                    "free": disk.free,
                    "used": disk.used,
                    "percent": (disk.used / disk.total) * 100
                }
            },
            "process": {
                "pid": os.getpid(),
                "memory_rss": process_memory.rss,
                "memory_vms": process_memory.vms,
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "create_time": process.create_time()
            }
        }
        
        try:
            doc_count_result = await db_manager.execute_one("SELECT COUNT(*) as count FROM documents")
            app_metrics["database"] = {
                "documents_count": doc_count_result["count"] if doc_count_result else 0
            }
        except:
            app_metrics["database"] = {"status": "unavailable"}
        
        try:
            cache_stats = await cache.get_stats()
            app_metrics["cache"] = cache_stats
        except:
            app_metrics["cache"] = {"status": "unavailable"}
        
        return app_metrics
        
    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Metrics collection failed: {str(e)}")

@router.get("/readiness")
async def readiness_check():
    """Kubernetes readiness probe endpoint"""
    
    try:
        checks = []
        
        db_ready = await db_manager.health_check()
        checks.append(("database", db_ready))
        
        cache_ready = await cache.health_check()
        checks.append(("cache", cache_ready))
        
        all_ready = all(ready for _, ready in checks)
        
        if all_ready:
            return {
                "status": "ready",
                "checks": dict(checks),
                "timestamp": time.time()
            }
        else:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "checks": dict(checks),
                    "timestamp": time.time()
                }
            )
            
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": str(e),
                "timestamp": time.time()
            }
        )

@router.post("/clear-rate-limits")
async def clear_rate_limits():
    """Clear rate limiting cache (development only)"""
    
    # Only allow in debug mode
    if not settings.debug:
        raise HTTPException(
            status_code=403,
            detail="Rate limit clearing only available in debug mode"
        )
    
    try:
        # Clear in-memory rate limits
        security_manager.rate_limits.clear()
        security_manager.failed_attempts.clear()
        security_manager.blocked_ips.clear()
        
        # Clear Redis cache if available
        try:
            await cache.clear_pattern("*rate_limit*")
            await cache.clear_pattern("*failed_attempts*")
            await cache.clear_pattern("*blocked_ips*")
            cache_cleared = True
        except:
            cache_cleared = False
        
        return {
            "status": "success",
            "message": "Rate limits cleared",
            "cache_cleared": cache_cleared,
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error(f"Failed to clear rate limits: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear rate limits: {str(e)}"
        )

 