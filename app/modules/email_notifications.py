"""
Email Notifications Module

Handles email notifications for various system events:
- User registration and account events
- Security alerts and suspicious activities
- System maintenance and updates
- Document processing notifications
- Error notifications for administrators
"""

import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
import structlog

from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..services.email_service import email_service, initialize_email_service
from ..core.config import settings

logger = structlog.get_logger(__name__)

class EmailNotificationModule(BaseModule):
    """Email notification management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._email_service_active = False
        self._notification_queue = asyncio.Queue()
        self._worker_task = None
        self._enabled_notifications = config.config.get("enabled_notifications", [
            "user_registration",
            "security_alerts", 
            "system_maintenance",
            "error_notifications"
        ])
    
    async def initialize(self) -> None:
        """Initialize email notification components"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Initialize email service
            initialize_email_service()
            
            if email_service.providers:
                self._email_service_active = True
                # Start notification worker
                self._worker_task = asyncio.create_task(self._notification_worker())
                
                self._set_status(ModuleStatus.ACTIVE)
                logger.info("Email notification module initialized successfully")
            else:
                self._set_status(ModuleStatus.INACTIVE)
                logger.warning("Email notification module initialized but no email providers configured")
                
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize email notification module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown email notification components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            # Stop notification worker
            if self._worker_task:
                self._worker_task.cancel()
                try:
                    await self._worker_task
                except asyncio.CancelledError:
                    pass
            
            self._set_status(ModuleStatus.SHUTDOWN)
            logger.info("Email notification module shutdown complete")
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down email notification module: {e}")
    
    async def send_notification(
        self,
        notification_type: str,
        to_email: str,
        context: Dict[str, Any],
        template_name: Optional[str] = None,
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """Send email notification"""
        
        if not self._email_service_active:
            return {
                "success": False,
                "error": "Email service not available",
                "notification_type": notification_type
            }
        
        if notification_type not in self._enabled_notifications:
            return {
                "success": False,
                "error": f"Notification type '{notification_type}' not enabled",
                "notification_type": notification_type
            }
        
        # Add notification to queue for background processing
        notification_task = {
            "type": notification_type,
            "to_email": to_email,
            "context": context,
            "template_name": template_name,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self._notification_queue.put(notification_task)
        
        return {
            "success": True,
            "message": "Notification queued for delivery",
            "notification_type": notification_type
        }
    
    async def send_user_registration_notification(
        self,
        user_email: str,
        user_name: str,
        admin_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send user registration notification"""
        
        # Send welcome email to user
        user_result = await self.send_notification(
            notification_type="user_registration",
            to_email=user_email,
            context={
                "user_name": user_name,
                "registration_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            },
            template_name="welcome"
        )
        
        # Send admin notification if admin email provided
        admin_result = None
        if admin_email:
            admin_result = await self.send_notification(
                notification_type="user_registration",
                to_email=admin_email,
                context={
                    "user_email": user_email,
                    "user_name": user_name,
                    "registration_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                },
                template_name="system_notification"
            )
        
        return {
            "success": user_result["success"],
            "user_notification": user_result,
            "admin_notification": admin_result
        }
    
    async def send_security_alert(
        self,
        user_email: str,
        user_name: str,
        event_type: str,
        ip_address: str,
        admin_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send security alert notification"""
        
        context = {
            "user_name": user_name,
            "event_type": event_type,
            "event_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "ip_address": ip_address
        }
        
        # Send alert to user
        user_result = await self.send_notification(
            notification_type="security_alerts",
            to_email=user_email,
            context=context,
            template_name="security_alert",
            priority="high"
        )
        
        # Send alert to admin if provided
        admin_result = None
        if admin_email:
            admin_result = await self.send_notification(
                notification_type="security_alerts",
                to_email=admin_email,
                context={
                    **context,
                    "title": f"Security Alert: {event_type}",
                    "message": f"Security event detected for user {user_name} ({user_email})",
                    "details": f"Event: {event_type}\nIP: {ip_address}\nTime: {context['event_time']}"
                },
                template_name="system_notification",
                priority="high"
            )
        
        return {
            "success": user_result["success"],
            "user_notification": user_result,
            "admin_notification": admin_result
        }
    
    async def send_password_reset_notification(
        self,
        user_email: str,
        user_name: str,
        reset_url: str
    ) -> Dict[str, Any]:
        """Send password reset notification"""
        
        return await self.send_notification(
            notification_type="user_registration",  # Reuse user registration type
            to_email=user_email,
            context={
                "user_name": user_name,
                "reset_url": reset_url,
                "reset_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            },
            template_name="password_reset",
            priority="high"
        )
    
    async def send_system_maintenance_notification(
        self,
        admin_emails: List[str],
        maintenance_type: str,
        scheduled_time: str,
        duration: str,
        description: str
    ) -> Dict[str, Any]:
        """Send system maintenance notification to admins"""
        
        results = []
        for admin_email in admin_emails:
            result = await self.send_notification(
                notification_type="system_maintenance",
                to_email=admin_email,
                context={
                    "title": f"System Maintenance: {maintenance_type}",
                    "message": f"Scheduled maintenance on {scheduled_time}",
                    "details": f"Type: {maintenance_type}\nDuration: {duration}\nDescription: {description}"
                },
                template_name="system_notification",
                priority="normal"
            )
            results.append(result)
        
        return {
            "success": all(r["success"] for r in results),
            "results": results
        }
    
    async def send_error_notification(
        self,
        admin_emails: List[str],
        error_type: str,
        error_message: str,
        error_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Send error notification to administrators"""
        
        results = []
        for admin_email in admin_emails:
            result = await self.send_notification(
                notification_type="error_notifications",
                to_email=admin_email,
                context={
                    "title": f"System Error: {error_type}",
                    "message": error_message,
                    "details": f"Error Type: {error_type}\nContext: {error_context}\nTime: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                },
                template_name="system_notification",
                priority="high"
            )
            results.append(result)
        
        return {
            "success": all(r["success"] for r in results),
            "results": results
        }
    
    async def _notification_worker(self):
        """Background worker for processing email notifications"""
        
        logger.info("Email notification worker started")
        
        while self._running:
            try:
                # Wait for notification task
                notification_task = await asyncio.wait_for(
                    self._notification_queue.get(),
                    timeout=1.0
                )
                
                # Process notification
                await self._process_notification(notification_task)
                
                # Mark task as done
                self._notification_queue.task_done()
                
            except asyncio.TimeoutError:
                # No tasks in queue, continue
                continue
            except Exception as e:
                logger.error(f"Email notification worker error: {e}")
        
        logger.info("Email notification worker stopped")
    
    async def _process_notification(self, notification_task: Dict[str, Any]):
        """Process a single notification task"""
        
        try:
            notification_type = notification_task["type"]
            to_email = notification_task["to_email"]
            context = notification_task["context"]
            template_name = notification_task.get("template_name")
            priority = notification_task.get("priority", "normal")
            
            # Send email
            if template_name:
                result = await email_service.send_template_email(
                    to_email=to_email,
                    template_name=template_name,
                    context=context
                )
            else:
                # Send custom email
                result = await email_service.send_email(
                    to_email=to_email,
                    subject=context.get("subject", f"Notification: {notification_type}"),
                    html_content=context.get("html_content", ""),
                    text_content=context.get("text_content")
                )
            
            if result["success"]:
                logger.info(f"Email notification sent successfully: {notification_type} to {to_email}")
            else:
                logger.error(f"Failed to send email notification: {notification_type} to {to_email} - {result.get('error')}")
                
        except Exception as e:
            logger.error(f"Failed to process notification task: {e}")

# Global email notification module instance
email_notification_module = EmailNotificationModule(
    ModuleConfig(
        name="email_notifications",
        enabled=True,
        config={
            "enabled_notifications": [
                "user_registration",
                "security_alerts",
                "system_maintenance", 
                "error_notifications"
            ]
        }
    )
) 