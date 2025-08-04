"""
Email Notifications API Endpoints

This module provides endpoints for managing email notifications.
"""

import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

from ...core.config import settings
from ...security.auth import require_permission
from ...security.models import Permission
from ...modules.email_notifications import email_notification_module

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])

class EmailNotificationRequest(BaseModel):
    """Request model for sending email notifications"""
    to_email: EmailStr = Field(..., description="Recipient email address")
    notification_type: str = Field(..., description="Type of notification")
    template_name: Optional[str] = Field(None, description="Email template to use")
    context: Dict[str, Any] = Field(default_factory=dict, description="Template context data")
    priority: str = Field(default="normal", description="Notification priority")

class SecurityAlertRequest(BaseModel):
    """Request model for security alerts"""
    user_email: EmailStr = Field(..., description="User email address")
    user_name: str = Field(..., description="User name")
    event_type: str = Field(..., description="Type of security event")
    ip_address: str = Field(..., description="IP address of the event")
    admin_email: Optional[EmailStr] = Field(None, description="Admin email for notification")

class SystemMaintenanceRequest(BaseModel):
    """Request model for system maintenance notifications"""
    admin_emails: List[EmailStr] = Field(..., description="List of admin email addresses")
    maintenance_type: str = Field(..., description="Type of maintenance")
    scheduled_time: str = Field(..., description="Scheduled maintenance time")
    duration: str = Field(..., description="Expected duration")
    description: str = Field(..., description="Maintenance description")

class ErrorNotificationRequest(BaseModel):
    """Request model for error notifications"""
    admin_emails: List[EmailStr] = Field(..., description="List of admin email addresses")
    error_type: str = Field(..., description="Type of error")
    error_message: str = Field(..., description="Error message")
    error_context: Dict[str, Any] = Field(default_factory=dict, description="Error context")

class NotificationResponse(BaseModel):
    """Response model for notification operations"""
    success: bool
    message: str
    notification_type: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class EmailStatusResponse(BaseModel):
    """Response model for email service status"""
    email_service_active: bool
    providers_configured: List[str]
    enabled_notifications: List[str]
    queue_size: int

@router.post("/send", response_model=NotificationResponse)
async def send_email_notification(
    request: EmailNotificationRequest,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Send a custom email notification"""
    try:
        result = await email_notification_module.send_notification(
            notification_type=request.notification_type,
            to_email=request.to_email,
            context=request.context,
            template_name=request.template_name,
            priority=request.priority
        )
        
        return NotificationResponse(
            success=result["success"],
            message=result.get("message", "Notification sent"),
            notification_type=request.notification_type,
            details=result
        )
        
    except Exception as e:
        logger.error(f"Failed to send email notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")

@router.post("/security-alert", response_model=NotificationResponse)
async def send_security_alert(
    request: SecurityAlertRequest,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Send security alert notification"""
    try:
        result = await email_notification_module.send_security_alert(
            user_email=request.user_email,
            user_name=request.user_name,
            event_type=request.event_type,
            ip_address=request.ip_address,
            admin_email=request.admin_email
        )
        
        return NotificationResponse(
            success=result["success"],
            message="Security alert notification sent",
            notification_type="security_alerts",
            details=result
        )
        
    except Exception as e:
        logger.error(f"Failed to send security alert: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send security alert: {str(e)}")

@router.post("/system-maintenance", response_model=NotificationResponse)
async def send_system_maintenance_notification(
    request: SystemMaintenanceRequest,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Send system maintenance notification"""
    try:
        result = await email_notification_module.send_system_maintenance_notification(
            admin_emails=request.admin_emails,
            maintenance_type=request.maintenance_type,
            scheduled_time=request.scheduled_time,
            duration=request.duration,
            description=request.description
        )
        
        return NotificationResponse(
            success=result["success"],
            message="System maintenance notification sent",
            notification_type="system_maintenance",
            details=result
        )
        
    except Exception as e:
        logger.error(f"Failed to send system maintenance notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send maintenance notification: {str(e)}")

@router.post("/error-notification", response_model=NotificationResponse)
async def send_error_notification(
    request: ErrorNotificationRequest,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Send error notification to administrators"""
    try:
        result = await email_notification_module.send_error_notification(
            admin_emails=request.admin_emails,
            error_type=request.error_type,
            error_message=request.error_message,
            error_context=request.error_context
        )
        
        return NotificationResponse(
            success=result["success"],
            message="Error notification sent",
            notification_type="error_notifications",
            details=result
        )
        
    except Exception as e:
        logger.error(f"Failed to send error notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send error notification: {str(e)}")

@router.post("/test", response_model=NotificationResponse)
async def test_email_notification(
    to_email: EmailStr,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Test email notification functionality"""
    try:
        result = await email_notification_module.send_notification(
            notification_type="system_maintenance",
            to_email=to_email,
            context={
                "title": "Email Test",
                "message": "This is a test email to verify email notification functionality.",
                "details": f"Test sent at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
            },
            template_name="system_notification"
        )
        
        return NotificationResponse(
            success=result["success"],
            message="Test email notification sent",
            notification_type="test",
            details=result
        )
        
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")

@router.get("/status", response_model=EmailStatusResponse)
async def get_email_status(
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Get email notification service status"""
    try:
        from ...services.email_service import email_service
        
        return EmailStatusResponse(
            email_service_active=email_notification_module._email_service_active,
            providers_configured=list(email_service.providers.keys()),
            enabled_notifications=email_notification_module._enabled_notifications,
            queue_size=email_notification_module._notification_queue.qsize()
        )
        
    except Exception as e:
        logger.error(f"Failed to get email status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get email status: {str(e)}")

@router.get("/templates")
async def get_email_templates(
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Get available email templates"""
    try:
        from ...services.email_service import email_service
        
        templates = list(email_service.template_manager.templates.keys())
        
        return {
            "templates": templates,
            "count": len(templates)
        }
        
    except Exception as e:
        logger.error(f"Failed to get email templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get email templates: {str(e)}")

@router.get("/health")
async def notifications_health():
    """Health check for notifications service"""
    try:
        return {
            "status": "healthy",
            "service": "notifications",
            "email_service_active": email_notification_module._email_service_active,
            "message": "Notifications service is operational"
        }
    except Exception as e:
        logger.error(f"Notifications health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "notifications",
            "error": str(e)
        } 