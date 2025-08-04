"""
Streaming Module

Handles all streaming operations including:
- WebSocket connections
- Server-Sent Events
- Real-time streaming
- Stream management and cleanup
"""

import asyncio
from typing import Dict, Any, Optional, List
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..services.streaming_service import streaming_service
import structlog

logger = structlog.get_logger(__name__)


class StreamingModule(BaseModule):
    """Streaming management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._streams_active = False
        self._cleanup_task = None
        self._max_streams = config.config.get("max_streams", 100)
        self._stream_timeout = config.config.get("stream_timeout", 3600)  # 1 hour
    
    async def initialize(self) -> None:
        """Initialize streaming components"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Initialize streaming service
            await streaming_service.initialize()
            self._streams_active = True
            
            # Start background cleanup task
            self._cleanup_task = asyncio.create_task(self._background_cleanup())
            
            self._set_status(ModuleStatus.ACTIVE)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize streaming module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown streaming components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            # Stop background cleanup task
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass
            
            # Cleanup all streams
            if self._streams_active:
                await streaming_service.cleanup_streams()
            
            self._set_status(ModuleStatus.SHUTDOWN)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down streaming module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check streaming health"""
        try:
            stats = streaming_service.get_stats()
            
            return {
                "status": "healthy" if self._streams_active else "degraded",
                "name": self.name,
                "streams_active": self._streams_active,
                "active_streams": stats.get("active_streams", 0),
                "total_streams": stats.get("total_streams", 0),
                "max_streams": self._max_streams,
                "cleanup_task_active": not self._cleanup_task.done() if self._cleanup_task else False
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    async def _background_cleanup(self) -> None:
        """Background stream cleanup task"""
        while True:
            try:
                await asyncio.sleep(60)  # Run every minute
                await streaming_service.cleanup_expired_streams(self._stream_timeout)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background stream cleanup: {e}")
    
    # Streaming interface methods
    async def create_stream(self, stream_id: str, format_type: str = "json") -> bool:
        """Create a new stream"""
        return await streaming_service.create_stream(stream_id, format_type)
    
    async def send_event(self, stream_id: str, event_type: str, data: Any) -> bool:
        """Send event to stream"""
        return await streaming_service.send_event(stream_id, event_type, data)
    
    async def close_stream(self, stream_id: str) -> bool:
        """Close a stream"""
        return await streaming_service.close_stream(stream_id)
    
    async def get_stream_info(self, stream_id: str) -> Optional[Dict[str, Any]]:
        """Get stream information"""
        return streaming_service.get_stream_info(stream_id)
    
    async def list_active_streams(self) -> List[str]:
        """List all active stream IDs"""
        return streaming_service.list_active_streams()
    
    async def cleanup_expired_streams(self, timeout: Optional[int] = None) -> int:
        """Cleanup expired streams"""
        return await streaming_service.cleanup_expired_streams(timeout or self._stream_timeout) 