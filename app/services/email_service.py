"""
Email Notification Service

Handles email notifications with support for:
- Multiple email providers (SMTP, SendGrid, etc.)
- HTML and text templates
- Async delivery with retry logic
- Email templates for different notification types
"""

import asyncio
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import httpx
from jinja2 import Template
import structlog

from ..core.config import settings

logger = structlog.get_logger(__name__)

class EmailProvider:
    """Base class for email providers"""
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send email using the provider"""
        raise NotImplementedError

class SMTPProvider(EmailProvider):
    """SMTP email provider"""
    
    def __init__(self, config: Dict[str, Any]):
        self.host = config.get("smtp_host", "localhost")
        self.port = config.get("smtp_port", 587)
        self.username = config.get("smtp_username")
        self.password = config.get("smtp_password")
        self.use_tls = config.get("smtp_use_tls", True)
        self.use_ssl = config.get("smtp_use_ssl", False)
        self.from_email = config.get("from_email", "noreply@example.com")
        self.from_name = config.get("from_name", "RAG System")
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send email via SMTP"""
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{from_email or self.from_email}>"
            msg['To'] = to_email
            
            if reply_to:
                msg['Reply-To'] = reply_to
            
            # Add text content
            if text_content:
                text_part = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Add attachments
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {attachment["filename"]}'
                    )
                    msg.attach(part)
            
            # Send email
            await self._send_smtp(msg)
            
            return {
                "success": True,
                "provider": "smtp",
                "message_id": f"smpt_{datetime.utcnow().isoformat()}",
                "to": to_email
            }
            
        except Exception as e:
            logger.error(f"SMTP email failed: {e}")
            return {
                "success": False,
                "provider": "smtp",
                "error": str(e),
                "to": to_email
            }
    
    async def _send_smtp(self, msg: MIMEMultipart):
        """Send email via SMTP with proper connection handling"""
        
        if self.use_ssl:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(self.host, self.port, context=context)
        else:
            server = smtplib.SMTP(self.host, self.port)
        
        try:
            if self.use_tls and not self.use_ssl:
                server.starttls(context=ssl.create_default_context())
            
            if self.username and self.password:
                server.login(self.username, self.password)
            
            server.send_message(msg)
            
        finally:
            server.quit()

class SendGridProvider(EmailProvider):
    """SendGrid email provider"""
    
    def __init__(self, config: Dict[str, Any]):
        self.api_key = config.get("sendgrid_api_key")
        self.from_email = config.get("from_email", "noreply@example.com")
        self.from_name = config.get("from_name", "RAG System")
        self.base_url = "https://api.sendgrid.com/v3"
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send email via SendGrid API"""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "personalizations": [{
                    "to": [{"email": to_email}]
                }],
                "from": {
                    "email": from_email or self.from_email,
                    "name": self.from_name
                },
                "subject": subject,
                "content": []
            }
            
            # Add text content
            if text_content:
                data["content"].append({
                    "type": "text/plain",
                    "value": text_content
                })
            
            # Add HTML content
            data["content"].append({
                "type": "text/html",
                "value": html_content
            })
            
            # Add reply-to
            if reply_to:
                data["reply_to"] = {"email": reply_to}
            
            # Add attachments
            if attachments:
                data["attachments"] = []
                for attachment in attachments:
                    data["attachments"].append({
                        "content": attachment['content'].decode('base64') if isinstance(attachment['content'], bytes) else attachment['content'],
                        "filename": attachment['filename'],
                        "type": attachment.get('type', 'application/octet-stream')
                    })
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/mail/send",
                    headers=headers,
                    json=data
                )
                
                if response.status_code == 202:
                    return {
                        "success": True,
                        "provider": "sendgrid",
                        "message_id": response.headers.get("X-Message-Id", ""),
                        "to": to_email
                    }
                else:
                    return {
                        "success": False,
                        "provider": "sendgrid",
                        "error": f"SendGrid API error: {response.status_code} - {response.text}",
                        "to": to_email
                    }
                    
        except Exception as e:
            logger.error(f"SendGrid email failed: {e}")
            return {
                "success": False,
                "provider": "sendgrid",
                "error": str(e),
                "to": to_email
            }

class EmailTemplate:
    """Email template manager"""
    
    def __init__(self):
        self.templates = {
            "welcome": {
                "subject": "Welcome to RAG System",
                "html": """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Welcome to RAG System</title>
                </head>
                <body>
                    <h1>Welcome to RAG System!</h1>
                    <p>Hello {{ user_name }},</p>
                    <p>Welcome to the RAG System. Your account has been successfully created.</p>
                    <p>You can now start using our advanced document querying capabilities.</p>
                    <p>Best regards,<br>The RAG System Team</p>
                </body>
                </html>
                """,
                "text": """
                Welcome to RAG System!
                
                Hello {{ user_name }},
                
                Welcome to the RAG System. Your account has been successfully created.
                You can now start using our advanced document querying capabilities.
                
                Best regards,
                The RAG System Team
                """
            },
            "password_reset": {
                "subject": "Password Reset Request",
                "html": """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Password Reset</title>
                </head>
                <body>
                    <h1>Password Reset Request</h1>
                    <p>Hello {{ user_name }},</p>
                    <p>You have requested a password reset for your RAG System account.</p>
                    <p>Click the link below to reset your password:</p>
                    <p><a href="{{ reset_url }}">Reset Password</a></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>The RAG System Team</p>
                </body>
                </html>
                """,
                "text": """
                Password Reset Request
                
                Hello {{ user_name }},
                
                You have requested a password reset for your RAG System account.
                Click the link below to reset your password:
                
                {{ reset_url }}
                
                If you didn't request this, please ignore this email.
                
                Best regards,
                The RAG System Team
                """
            },
            "security_alert": {
                "subject": "Security Alert - RAG System",
                "html": """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Security Alert</title>
                </head>
                <body>
                    <h1>Security Alert</h1>
                    <p>Hello {{ user_name }},</p>
                    <p>A security event has been detected on your account:</p>
                    <ul>
                        <li><strong>Event:</strong> {{ event_type }}</li>
                        <li><strong>Time:</strong> {{ event_time }}</li>
                        <li><strong>IP Address:</strong> {{ ip_address }}</li>
                    </ul>
                    <p>If this was not you, please contact support immediately.</p>
                    <p>Best regards,<br>The RAG System Team</p>
                </body>
                </html>
                """,
                "text": """
                Security Alert
                
                Hello {{ user_name }},
                
                A security event has been detected on your account:
                
                Event: {{ event_type }}
                Time: {{ event_time }}
                IP Address: {{ ip_address }}
                
                If this was not you, please contact support immediately.
                
                Best regards,
                The RAG System Team
                """
            },
            "system_notification": {
                "subject": "System Notification - {{ title }}",
                "html": """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>{{ title }}</title>
                </head>
                <body>
                    <h1>{{ title }}</h1>
                    <p>{{ message }}</p>
                    {% if details %}
                    <h2>Details:</h2>
                    <pre>{{ details }}</pre>
                    {% endif %}
                    <p>Best regards,<br>The RAG System Team</p>
                </body>
                </html>
                """,
                "text": """
                {{ title }}
                
                {{ message }}
                
                {% if details %}
                Details:
                {{ details }}
                {% endif %}
                
                Best regards,
                The RAG System Team
                """
            }
        }
    
    def get_template(self, template_name: str) -> Optional[Dict[str, str]]:
        """Get email template by name"""
        return self.templates.get(template_name)
    
    def render_template(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """Render email template with context"""
        
        template = self.get_template(template_name)
        if not template:
            return None
        
        try:
            subject_template = Template(template["subject"])
            html_template = Template(template["html"])
            text_template = Template(template["text"])
            
            return {
                "subject": subject_template.render(**context),
                "html": html_template.render(**context),
                "text": text_template.render(**context)
            }
            
        except Exception as e:
            logger.error(f"Failed to render email template {template_name}: {e}")
            return None

class EmailService:
    """Main email service for handling notifications"""
    
    def __init__(self):
        self.providers: Dict[str, EmailProvider] = {}
        self.template_manager = EmailTemplate()
        self.default_provider = None
        self.max_retries = 3
        self.retry_delays = [1, 5, 15]  # seconds
    
    def add_provider(self, name: str, provider: EmailProvider):
        """Add email provider"""
        self.providers[name] = provider
        if not self.default_provider:
            self.default_provider = name
    
    def set_default_provider(self, name: str):
        """Set default email provider"""
        if name in self.providers:
            self.default_provider = name
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        provider_name: Optional[str] = None,
        retry: bool = True
    ) -> Dict[str, Any]:
        """Send email using specified or default provider"""
        
        if not self.providers:
            return {
                "success": False,
                "error": "No email providers configured",
                "to": to_email
            }
        
        provider_name = provider_name or self.default_provider
        if not provider_name or provider_name not in self.providers:
            return {
                "success": False,
                "error": f"Email provider '{provider_name}' not found",
                "to": to_email
            }
        
        provider = self.providers[provider_name]
        
        if retry:
            return await self._send_with_retry(provider, to_email, subject, html_content, text_content, from_email, reply_to, attachments)
        else:
            return await provider.send_email(to_email, subject, html_content, text_content, from_email, reply_to, attachments)
    
    async def send_template_email(
        self,
        to_email: str,
        template_name: str,
        context: Dict[str, Any],
        provider_name: Optional[str] = None,
        retry: bool = True
    ) -> Dict[str, Any]:
        """Send email using template"""
        
        rendered = self.template_manager.render_template(template_name, context)
        if not rendered:
            return {
                "success": False,
                "error": f"Failed to render template '{template_name}'",
                "to": to_email
            }
        
        return await self.send_email(
            to_email=to_email,
            subject=rendered["subject"],
            html_content=rendered["html"],
            text_content=rendered["text"],
            provider_name=provider_name,
            retry=retry
        )
    
    async def _send_with_retry(
        self,
        provider: EmailProvider,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send email with retry logic"""
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                result = await provider.send_email(
                    to_email, subject, html_content, text_content, from_email, reply_to, attachments
                )
                
                if result["success"]:
                    if attempt > 0:
                        logger.info(f"Email delivered on attempt {attempt + 1}")
                    return result
                else:
                    last_error = result["error"]
                    
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Email attempt {attempt + 1} failed: {e}")
            
            # Wait before retry (except for last attempt)
            if attempt < self.max_retries - 1:
                await asyncio.sleep(self.retry_delays[attempt])
        
        # All retries failed
        logger.error(f"Email failed after {self.max_retries} attempts: {last_error}")
        
        return {
            "success": False,
            "error": last_error,
            "to": to_email
        }

# Global email service instance
email_service = EmailService()

def initialize_email_service():
    """Initialize email service with configured providers"""
    
    # Initialize SMTP provider if configured
    if hasattr(settings, 'smtp_host') and settings.smtp_host:
        smtp_config = {
            "smtp_host": settings.smtp_host,
            "smtp_port": getattr(settings, 'smtp_port', 587),
            "smtp_username": getattr(settings, 'smtp_username', None),
            "smtp_password": getattr(settings, 'smtp_password', None),
            "smtp_use_tls": getattr(settings, 'smtp_use_tls', True),
            "smtp_use_ssl": getattr(settings, 'smtp_use_ssl', False),
            "from_email": getattr(settings, 'email_from_address', "noreply@example.com"),
            "from_name": getattr(settings, 'email_from_name', "RAG System")
        }
        
        smtp_provider = SMTPProvider(smtp_config)
        email_service.add_provider("smtp", smtp_provider)
        email_service.set_default_provider("smtp")
        logger.info("SMTP email provider configured")
    
    # Initialize SendGrid provider if configured
    if hasattr(settings, 'sendgrid_api_key') and settings.sendgrid_api_key:
        sendgrid_config = {
            "sendgrid_api_key": settings.sendgrid_api_key,
            "from_email": getattr(settings, 'email_from_address', "noreply@example.com"),
            "from_name": getattr(settings, 'email_from_name', "RAG System")
        }
        
        sendgrid_provider = SendGridProvider(sendgrid_config)
        email_service.add_provider("sendgrid", sendgrid_provider)
        email_service.set_default_provider("sendgrid")
        logger.info("SendGrid email provider configured")
    
    if not email_service.providers:
        logger.warning("No email providers configured - email notifications will be disabled")
    else:
        logger.info(f"Email service initialized with {len(email_service.providers)} providers") 