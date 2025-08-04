"""
Monitoring Module

Handles all monitoring and performance tracking including:
- Metrics collection
- Health checks
- System statistics
"""

import asyncio
import time
from typing import Dict, Any, Optional
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..api.endpoints.health import system_metrics
import structlog

logger = structlog.get_logger(__name__)

class MonitoringModule(BaseModule):
    """Monitoring management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._monitoring_active = False
        self._metrics_collection_active = False
        self._start_time = time.time()
        self._metrics_interval = config.config.get("metrics_interval", 60)  # 1 minute
        self._metrics_task = None
        self._last_metrics = None
    
    async def initialize(self) -> None:
        """Initialize monitoring components"""
        self._set_status(ModuleStatus.INITIALIZING)
        try:
            # Start metrics collection
            self._metrics_task = asyncio.create_task(self._collect_metrics())
            self._metrics_collection_active = True
            self._monitoring_active = True
            self._set_status(ModuleStatus.ACTIVE)
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize monitoring module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown monitoring components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        try:
            # Stop metrics collection
            if self._metrics_task:
                self._metrics_task.cancel()
                try:
                    await self._metrics_task
                except asyncio.CancelledError:
                    pass
            self._metrics_collection_active = False
            self._monitoring_active = False
            self._set_status(ModuleStatus.SHUTDOWN)
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down monitoring module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check monitoring health"""
        try:
            uptime = time.time() - self._start_time
            return {
                "status": "healthy" if self._monitoring_active else "degraded",
                "name": self.name,
                "monitoring_active": self._monitoring_active,
                "metrics_collection_active": self._metrics_collection_active,
                "uptime_seconds": uptime,
                "metrics_interval": self._metrics_interval,
                "metrics_task_active": not self._metrics_task.done() if self._metrics_task else False
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    async def _collect_metrics(self) -> None:
        """Background metrics collection task"""
        while True:
            try:
                await asyncio.sleep(self._metrics_interval)
                # Collect system metrics
                try:
                    metrics = await system_metrics()
                    self._last_metrics = metrics
                except Exception as e:
                    logger.error(f"Error collecting system metrics: {e}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metrics collection loop: {e}")
    
    # Monitoring interface methods
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics"""
        if self._last_metrics:
            return self._last_metrics
        return await system_metrics()
    
    async def get_uptime(self) -> float:
        """Get application uptime in seconds"""
        return time.time() - self._start_time
    
    async def get_module_health(self) -> Dict[str, Any]:
        """Get health status of all modules"""
        from ..core.modules import module_registry
        return await module_registry.health_check_all()
    
    async def get_comprehensive_health(self) -> Dict[str, Any]:
        """Get comprehensive health status"""
        return {
            "timestamp": time.time(),
            "uptime": await self.get_uptime(),
            "system_metrics": await self.get_system_metrics(),
            "module_health": await self.get_module_health(),
            "monitoring_status": await self.health_check()
        } 