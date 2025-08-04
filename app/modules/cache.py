"""
Cache Module

Handles all caching operations including:
- Redis cache management
- Memory cache management
- Cache cleanup and TTL management
- Cache health monitoring
"""

import asyncio
from typing import Dict, Any, Optional
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..services import cache, enhanced_cache
import structlog

logger = structlog.get_logger(__name__)


class CacheModule(BaseModule):
    """Cache management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._redis_connected = False
        self._memory_cache_active = False
        self._cleanup_task = None
    
    async def initialize(self) -> None:
        """Initialize cache connections and start cleanup tasks"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Initialize Redis cache
            await cache.initialize()
            self._redis_connected = True
            
            # Start memory cache cleanup
            await enhanced_cache.start_cleanup()
            self._memory_cache_active = True
            
            # Start background cleanup task
            self._cleanup_task = asyncio.create_task(self._background_cleanup())
            
            self._set_status(ModuleStatus.ACTIVE)
            logger.info("Cache module initialized successfully")
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize cache module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown cache connections and cleanup tasks"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            # Stop background cleanup task
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass
            
            # Stop memory cache cleanup
            if self._memory_cache_active:
                await enhanced_cache.stop_cleanup()
            
            # Close Redis connections
            if self._redis_connected:
                await cache.close()
            
            self._set_status(ModuleStatus.SHUTDOWN)
            logger.info("Cache module shut down successfully")
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down cache module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache health"""
        try:
            redis_health = await self._check_redis_health()
            memory_health = await self._check_memory_health()
            
            return {
                "status": "healthy" if redis_health and memory_health else "degraded",
                "name": self.name,
                "redis": redis_health,
                "memory_cache": memory_health,
                "cleanup_task_active": not self._cleanup_task.done() if self._cleanup_task else False
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    async def _check_redis_health(self) -> Dict[str, Any]:
        """Check Redis cache health"""
        try:
            # Test Redis connection using the health_check method
            redis_healthy = await cache.health_check()
            return {
                "status": "healthy" if redis_healthy else "unhealthy",
                "connected": redis_healthy
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e)
            }
    
    async def _check_memory_health(self) -> Dict[str, Any]:
        """Check memory cache health"""
        try:
            # Get memory cache stats
            stats = await enhanced_cache.get_stats()
            return {
                "status": "healthy",
                "active": self._memory_cache_active,
                "items": stats.get("items", 0),
                "size": stats.get("size", 0)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "active": False,
                "error": str(e)
            }
    
    async def _background_cleanup(self) -> None:
        """Background cache cleanup task"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                await enhanced_cache.cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background cache cleanup: {e}")
    
    # Cache interface methods
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        return await cache.get(key)
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache"""
        await cache.set(key, value, ttl)
    
    async def delete(self, key: str) -> None:
        """Delete value from cache"""
        await cache.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        return await cache.exists(key)
    
    async def clear(self) -> None:
        """Clear all cache"""
        await cache.clear() 