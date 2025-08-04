"""
Webhook Module

Handles all webhook operations including:
- Webhook service management
- Event notifications
- Retry logic
- HMAC signatures
"""

import asyncio
from typing import Dict, Any, Optional, List
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..services.webhook import background_webhook_service
import structlog

logger = structlog.get_logger(__name__)


class WebhookModule(BaseModule):
    """Webhook management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._webhook_service_active = False
        self._max_retries = config.config.get("max_retries", 3)
        self._retry_delay = config.config.get("retry_delay", 5)
        self._webhook_timeout = config.config.get("webhook_timeout", 30)
    
    async def initialize(self) -> None:
        """Initialize webhook components"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Start webhook service
            await background_webhook_service.start()
            self._webhook_service_active = True
            
            self._set_status(ModuleStatus.ACTIVE)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize webhook module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown webhook components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            # Stop webhook service
            if self._webhook_service_active:
                await background_webhook_service.stop()
            
            self._set_status(ModuleStatus.SHUTDOWN)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down webhook module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check webhook health"""
        try:
            stats = await background_webhook_service.get_stats()
            
            return {
                "status": "healthy" if self._webhook_service_active else "degraded",
                "name": self.name,
                "webhook_service_active": self._webhook_service_active,
                "pending_webhooks": stats.get("pending_webhooks", 0),
                "failed_webhooks": stats.get("failed_webhooks", 0),
                "successful_webhooks": stats.get("successful_webhooks", 0),
                "max_retries": self._max_retries,
                "retry_delay": self._retry_delay
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    # Webhook interface methods
    async def send_webhook(self, url: str, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> bool:
        """Send a webhook"""
        return await background_webhook_service.send_webhook(url, payload, headers)
    
    async def register_webhook(self, event_type: str, url: str, secret: Optional[str] = None) -> str:
        """Register a webhook endpoint"""
        return await background_webhook_service.register_webhook(event_type, url, secret)
    
    async def unregister_webhook(self, webhook_id: str) -> bool:
        """Unregister a webhook endpoint"""
        return await background_webhook_service.unregister_webhook(webhook_id)
    
    async def list_webhooks(self, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """List registered webhooks"""
        return await background_webhook_service.list_webhooks(event_type)
    
    async def trigger_event(self, event_type: str, data: Dict[str, Any]) -> int:
        """Trigger an event for all registered webhooks"""
        return await background_webhook_service.trigger_event(event_type, data)
    
    async def get_webhook_stats(self) -> Dict[str, Any]:
        """Get webhook statistics"""
        return await background_webhook_service.get_stats() 