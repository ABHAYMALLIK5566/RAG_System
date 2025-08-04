import asyncio
import logging
import json
import time
from typing import Any, Optional, Dict, Set
from collections import OrderedDict
from dataclasses import dataclass
from threading import RLock

logger = logging.getLogger(__name__)

@dataclass
class CacheItem:
    """Cache item with TTL support"""
    value: Any
    expire_time: Optional[float] = None
    access_count: int = 0
    last_access: float = 0
    
    def is_expired(self) -> bool:
        """Check if item is expired"""
        if self.expire_time is None:
            return False
        return time.time() > self.expire_time
    
    def touch(self):
        """Update access information"""
        self.access_count += 1
        self.last_access = time.time()

class MemoryCache:
    """High-performance in-memory cache with TTL and LRU eviction"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheItem] = OrderedDict()
        self._lock = RLock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'expirations': 0
        }
        self._cleanup_task = None  # Do not start task here
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        with self._lock:
            if key not in self._cache:
                self._stats['misses'] += 1
                return None
            
            item = self._cache[key]
            
            # Check if expired
            if item.is_expired():
                del self._cache[key]
                self._stats['expirations'] += 1
                self._stats['misses'] += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            item.touch()
            
            self._stats['hits'] += 1
            return item.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache"""
        try:
            with self._lock:
                # Calculate expiry time
                expire_time = None
                if ttl is not None:
                    expire_time = time.time() + ttl
                elif self.default_ttl > 0:
                    expire_time = time.time() + self.default_ttl
                
                # Create cache item
                item = CacheItem(
                    value=value,
                    expire_time=expire_time,
                    last_access=time.time()
                )
                
                # Add to cache
                self._cache[key] = item
                self._cache.move_to_end(key)
                
                # Evict if over size limit
                while len(self._cache) > self.max_size:
                    oldest_key = next(iter(self._cache))
                    del self._cache[oldest_key]
                    self._stats['evictions'] += 1
                
                self._stats['sets'] += 1
                return True
                
        except Exception as e:
            logger.error(f"Error setting cache key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats['deletes'] += 1
                return True
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists and is not expired"""
        with self._lock:
            if key not in self._cache:
                return False
            
            item = self._cache[key]
            if item.is_expired():
                del self._cache[key]
                self._stats['expirations'] += 1
                return False
            
            return True
    
    async def clear(self) -> bool:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            return True
    
    async def keys(self, pattern: str = "*") -> Set[str]:
        """Get all non-expired keys"""
        with self._lock:
            # Clean expired items first
            expired_keys = []
            for key, item in self._cache.items():
                if item.is_expired():
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
                self._stats['expirations'] += 1
            
            # Return keys (simple pattern matching)
            if pattern == "*":
                return set(self._cache.keys())
            
            # Simple wildcard matching
            import fnmatch
            return {key for key in self._cache.keys() if fnmatch.fnmatch(key, pattern)}
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self._stats['hits'] + self._stats['misses']
            hit_rate = (self._stats['hits'] / total_requests) if total_requests > 0 else 0
            
            return {
                **self._stats,
                'size': len(self._cache),
                'max_size': self.max_size,
                'hit_rate': hit_rate,
                'memory_usage_mb': self._estimate_memory_usage()
            }
    
    def _estimate_memory_usage(self) -> float:
        """Estimate memory usage in MB"""
        import sys
        total_size = 0
        
        for key, item in self._cache.items():
            total_size += sys.getsizeof(key)
            total_size += sys.getsizeof(item.value)
            total_size += sys.getsizeof(item)
        
        return total_size / (1024 * 1024)  # Convert to MB
    
    async def _periodic_cleanup(self):
        """Periodic cleanup of expired items"""
        while True:
            try:
                await asyncio.sleep(60)  # Clean every minute
                
                with self._lock:
                    expired_keys = []
                    for key, item in self._cache.items():
                        if item.is_expired():
                            expired_keys.append(key)
                    
                    for key in expired_keys:
                        del self._cache[key]
                        self._stats['expirations'] += 1
                    
                    if expired_keys:
                        # Cleanup completed silently to avoid log noise
                        pass
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup: {e}")
    
    def __del__(self):
        """Cleanup on destruction"""
        if hasattr(self, '_cleanup_task') and self._cleanup_task is not None:
            self._cleanup_task.cancel()

    async def start_cleanup(self):
        """Start the periodic cleanup task. Must be called from an async context."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

class EnhancedCacheService:
    """Enhanced cache service with Redis primary and memory fallback"""
    
    def __init__(self):
        from .cache import cache
        self.redis_cache = cache
        self.memory_cache = MemoryCache(max_size=2000, default_ttl=300)
        self.use_memory_fallback = True
        
    async def get(self, key: str) -> Optional[Any]:
        """Get value with fallback strategy"""
        try:
            # Try Redis first
            if self.redis_cache.redis_client:
                value = await self.redis_cache.get(key)
                if value is not None:
                    return value
            
            # Fallback to memory cache
            if self.use_memory_fallback:
                return await self.memory_cache.get(key)
                
        except Exception as e:
            logger.error(f"Error getting cache key {key}: {e}")
            
            # Fallback to memory cache
            if self.use_memory_fallback:
                return await self.memory_cache.get(key)
        
        return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value with dual storage"""
        success = False
        
        try:
            # Try Redis first
            if self.redis_cache.redis_client:
                success = await self.redis_cache.set(key, value, ttl)
            
            # Also store in memory cache as backup
            if self.use_memory_fallback:
                memory_success = await self.memory_cache.set(key, value, ttl)
                success = success or memory_success
                
        except Exception as e:
            logger.error(f"Error setting cache key {key}: {e}")
            
            # Fallback to memory cache only
            if self.use_memory_fallback:
                success = await self.memory_cache.set(key, value, ttl)
        
        return success
    
    async def delete(self, key: str) -> bool:
        """Delete from both caches"""
        redis_success = False
        memory_success = False
        
        try:
            if self.redis_cache.redis_client:
                redis_success = await self.redis_cache.delete(key)
        except Exception as e:
            logger.error(f"Error deleting from Redis: {e}")
        
        try:
            if self.use_memory_fallback:
                memory_success = await self.memory_cache.delete(key)
        except Exception as e:
            logger.error(f"Error deleting from memory cache: {e}")
        
        return redis_success or memory_success
    
    async def exists(self, key: str) -> bool:
        """Check existence in either cache"""
        try:
            if self.redis_cache.redis_client:
                if await self.redis_cache.exists(key):
                    return True
        except Exception as e:
            logger.error(f"Error checking Redis existence: {e}")
        
        try:
            if self.use_memory_fallback:
                return await self.memory_cache.exists(key)
        except Exception as e:
            logger.error(f"Error checking memory cache existence: {e}")
        
        return False
    
    async def clear(self) -> bool:
        """Clear both caches"""
        redis_success = False
        memory_success = False
        
        try:
            if self.redis_cache.redis_client:
                redis_success = await self.redis_cache.clear()
        except Exception as e:
            logger.error(f"Error clearing Redis: {e}")
        
        try:
            if self.use_memory_fallback:
                memory_success = await self.memory_cache.clear()
        except Exception as e:
            logger.error(f"Error clearing memory cache: {e}")
        
        return redis_success or memory_success
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        stats = {
            'redis': {'available': False, 'stats': {}},
            'memory': {'available': False, 'stats': {}}
        }
        
        try:
            if self.redis_cache.redis_client:
                stats['redis']['available'] = True
                # Add Redis stats if available
                # This would depend on your Redis cache implementation
        except Exception as e:
            logger.error(f"Error getting Redis stats: {e}")
        
        try:
            if self.use_memory_fallback:
                stats['memory']['available'] = True
                stats['memory']['stats'] = await self.memory_cache.get_stats()
        except Exception as e:
            logger.error(f"Error getting memory cache stats: {e}")
        
        return stats

    async def start_cleanup(self):
        """Start the memory cache cleanup task. Must be called from an async context."""
        await self.memory_cache.start_cleanup()

# Global enhanced cache instance
enhanced_cache = EnhancedCacheService() 