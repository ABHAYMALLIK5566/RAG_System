"""
System Settings API Endpoints

This module provides endpoints for managing system configuration settings.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from pydantic import field_validator

from ...core.config import settings
from ...security.auth import require_permission, get_current_user
from ...security.models import Permission, User
from ...core.database import db_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["Settings"])

# User Settings Models
class UserSettings(BaseModel):
    """User-specific settings and preferences"""
    
    # Appearance Settings
    dark_mode: bool = Field(default=False, description="Enable dark mode")
    font_size: int = Field(default=14, ge=12, le=20, description="Font size in pixels")
    theme: str = Field(default="light", description="Theme preference")
    compact_mode: bool = Field(default=False, description="Enable compact mode")
    
    # Notification Settings
    email_notifications: bool = Field(default=True, description="Enable email notifications")
    push_notifications: bool = Field(default=True, description="Enable push notifications")
    sound_enabled: bool = Field(default=True, description="Enable sound notifications")
    notification_frequency: str = Field(default="immediate", description="Notification frequency")
    
    # Privacy & Security Settings
    auto_save: bool = Field(default=True, description="Auto-save conversations")
    data_collection: bool = Field(default=False, description="Allow data collection")
    analytics: bool = Field(default=True, description="Allow analytics")
    session_timeout: int = Field(default=30, ge=5, le=120, description="Session timeout in minutes")
    
    # Performance Settings
    cache_enabled: bool = Field(default=True, description="Enable caching")
    auto_refresh: bool = Field(default=False, description="Auto-refresh data")
    low_bandwidth_mode: bool = Field(default=False, description="Low bandwidth mode")
    
    # Chat Settings
    message_history: int = Field(default=100, ge=10, le=1000, description="Message history limit")
    typing_indicators: bool = Field(default=True, description="Show typing indicators")
    read_receipts: bool = Field(default=True, description="Show read receipts")
    auto_scroll: bool = Field(default=True, description="Auto-scroll to new messages")
    
    @field_validator('theme')
    @classmethod
    def validate_theme(cls, v):
        valid_themes = ['light', 'dark', 'auto']
        if v not in valid_themes:
            raise ValueError(f'Theme must be one of: {valid_themes}')
        return v
    
    @field_validator('notification_frequency')
    @classmethod
    def validate_notification_frequency(cls, v):
        valid_frequencies = ['immediate', 'hourly', 'daily', 'weekly']
        if v not in valid_frequencies:
            raise ValueError(f'Notification frequency must be one of: {valid_frequencies}')
        return v

class UserSettingsResponse(BaseModel):
    """Response model for user settings"""
    settings: UserSettings
    message: str
    status: str

# System Settings Models (existing)
class SystemSettings(BaseModel):
    """System configuration settings"""
    
    # System Settings
    maintenance_mode: bool = Field(default=False, description="Enable maintenance mode")
    debug_mode: bool = Field(default=False, description="Enable debug mode")
    log_level: str = Field(default="INFO", description="Logging level")
    
    # Security Settings
    enable_rate_limiting: bool = Field(default=True, description="Enable rate limiting")
    enable_ip_blocking: bool = Field(default=True, description="Enable IP blocking")
    session_timeout: int = Field(default=30, ge=5, le=120, description="Session timeout in minutes")
    max_login_attempts: int = Field(default=5, ge=1, le=10, description="Maximum login attempts")
    
    # Notification Settings
    email_notifications: bool = Field(default=True, description="Enable email notifications")
    email_smtp_host: Optional[str] = Field(default=None, description="SMTP server host")
    email_smtp_port: int = Field(default=587, description="SMTP server port")
    email_smtp_username: Optional[str] = Field(default=None, description="SMTP username")
    email_smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    email_smtp_use_tls: bool = Field(default=True, description="Use TLS for SMTP")
    email_smtp_use_ssl: bool = Field(default=False, description="Use SSL for SMTP")
    email_sendgrid_api_key: Optional[str] = Field(default=None, description="SendGrid API key")
    email_from_address: str = Field(default="noreply@example.com", description="Default from email address")
    email_from_name: str = Field(default="RAG System", description="Default from name")
    slack_notifications: bool = Field(default=False, description="Enable Slack notifications")
    webhook_notifications: bool = Field(default=False, description="Enable webhook notifications")
    
    # Storage Settings
    max_file_size: int = Field(default=50, ge=1, le=100, description="Maximum file size in MB")
    allowed_file_types: list = Field(default=["pdf", "docx", "txt", "md"], description="Allowed file types")
    enable_compression: bool = Field(default=True, description="Enable file compression")
    
    # RAG Settings
    rag_top_k: int = Field(default=5, ge=1, le=50, description="Number of top documents to retrieve")
    rag_similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Similarity threshold")
    rag_max_tokens: int = Field(default=4000, ge=1000, le=8000, description="Maximum tokens for response")
    
    # Cache Settings
    cache_ttl_seconds: int = Field(default=300, ge=60, le=3600, description="Cache TTL in seconds")
    cache_max_query_length: int = Field(default=1000, ge=100, le=5000, description="Maximum query length for caching")
    
    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v):
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR']
        if v not in valid_levels:
            raise ValueError(f'Log level must be one of: {valid_levels}')
        return v

class SettingsResponse(BaseModel):
    """Response model for settings"""
    settings: SystemSettings
    message: str
    status: str

# User Settings Endpoints
@router.get("/user", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user)
):
    """Get current user settings"""
    try:
        # Create user_settings table if it doesn't exist
        await db_manager.execute_command("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL UNIQUE,
                settings_data JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Try to get user settings from database
        row = await db_manager.execute_one(
            "SELECT settings_data FROM user_settings WHERE user_id = $1",
            current_user.id
        )
        
        if row and row.get("settings_data"):
            import json
            data = row["settings_data"]
            if isinstance(data, str):
                data = json.loads(data)
            user_settings = UserSettings(**data)
        else:
            # Return default settings if none exist
            user_settings = UserSettings()
        
        return UserSettingsResponse(
            settings=user_settings,
            message="User settings retrieved successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to get user settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user settings: {str(e)}")

@router.put("/user", response_model=UserSettingsResponse)
async def update_user_settings(
    new_settings: UserSettings,
    current_user: User = Depends(get_current_user)
):
    """Update user settings"""
    try:
        # Create user_settings table if it doesn't exist
        await db_manager.execute_command("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL UNIQUE,
                settings_data JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Save settings to database
        await db_manager.execute_command("""
            INSERT INTO user_settings (user_id, settings_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                settings_data = EXCLUDED.settings_data,
                updated_at = NOW()
        """, current_user.id, new_settings.model_dump_json())
        
        logger.info(f"User settings updated for user: {current_user.username}")
        return UserSettingsResponse(
            settings=new_settings,
            message="User settings updated successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to update user settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update user settings: {str(e)}")

@router.post("/user/reset", response_model=UserSettingsResponse)
async def reset_user_settings(
    current_user: User = Depends(get_current_user)
):
    """Reset user settings to defaults"""
    try:
        default_settings = UserSettings()
        
        # Create user_settings table if it doesn't exist
        await db_manager.execute_command("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL UNIQUE,
                settings_data JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Save default settings to database
        await db_manager.execute_command("""
            INSERT INTO user_settings (user_id, settings_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                settings_data = EXCLUDED.settings_data,
                updated_at = NOW()
        """, current_user.id, default_settings.model_dump_json())
        
        logger.info(f"User settings reset to defaults for user: {current_user.username}")
        return UserSettingsResponse(
            settings=default_settings,
            message="User settings reset to defaults successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to reset user settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset user settings: {str(e)}")

async def _load_settings_from_db() -> Optional[SystemSettings]:
    """Load settings from database if available"""
    try:
        await db_manager.execute_command("""
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                settings_data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_by VARCHAR(255)
            )
        """)
        row = await db_manager.execute_one("SELECT settings_data FROM system_settings ORDER BY updated_at DESC LIMIT 1")
        if row and row.get("settings_data"):
            import json
            data = row["settings_data"]
            if isinstance(data, str):
                data = json.loads(data)
            # Remove sensitive fields
            data["email_smtp_password"] = None
            data["email_sendgrid_api_key"] = None
            return SystemSettings(**data)
    except Exception as e:
        logger.error(f"Failed to load settings from database: {e}")
    return None

@router.get("/", response_model=SettingsResponse)
async def get_settings(
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Get current system settings"""
    try:
        db_settings = await _load_settings_from_db()
        if db_settings:
            current_settings = db_settings
        else:
            current_settings = SystemSettings(
                maintenance_mode=False,  # TODO: Implement maintenance mode
                debug_mode=settings.debug,
                log_level=settings.log_level,
                enable_rate_limiting=settings.enable_rate_limiting,
                enable_ip_blocking=settings.enable_ip_blocking,
                session_timeout=settings.session_timeout_seconds // 60,
                max_login_attempts=settings.max_login_attempts,
                email_notifications=settings.email_notifications_enabled,
                email_smtp_host=settings.smtp_host,
                email_smtp_port=settings.smtp_port,
                email_smtp_username=settings.smtp_username,
                email_smtp_password=None,  # Don't expose password in response
                email_smtp_use_tls=settings.smtp_use_tls,
                email_smtp_use_ssl=settings.smtp_use_ssl,
                email_sendgrid_api_key=None,  # Don't expose API key in response
                email_from_address=settings.email_from_address,
                email_from_name=settings.email_from_name,
                slack_notifications=False,
                webhook_notifications=False,
                max_file_size=settings.max_request_size_mb,
                allowed_file_types=settings.allowed_file_types.split(','),
                enable_compression=True,
                rag_top_k=settings.rag_top_k,
                rag_similarity_threshold=settings.rag_similarity_threshold,
                rag_max_tokens=settings.rag_max_tokens,
                cache_ttl_seconds=settings.cache_ttl_seconds,
                cache_max_query_length=settings.cache_max_query_length,
            )
        return SettingsResponse(
            settings=current_settings,
            message="Settings retrieved successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")

@router.put("/", response_model=SettingsResponse)
async def update_settings(
    new_settings: SystemSettings,
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Update system settings"""
    try:
        # Validate settings
        if new_settings.maintenance_mode:
            logger.warning("Maintenance mode enabled - this may affect system availability")
        if new_settings.debug_mode:
            logger.info("Debug mode enabled")
        # Update settings in database (for persistence)
        await _save_settings_to_db(new_settings)
        # Always reload from DB after update
        db_settings = await _load_settings_from_db()
        if db_settings:
            # Update runtime settings
            settings.debug = db_settings.debug_mode
            settings.log_level = db_settings.log_level
            settings.enable_rate_limiting = db_settings.enable_rate_limiting
            settings.enable_ip_blocking = db_settings.enable_ip_blocking
            settings.max_login_attempts = db_settings.max_login_attempts
            settings.session_timeout_seconds = db_settings.session_timeout * 60
            settings.rag_top_k = db_settings.rag_top_k
            settings.rag_similarity_threshold = db_settings.rag_similarity_threshold
            settings.rag_max_tokens = db_settings.rag_max_tokens
            settings.cache_ttl_seconds = db_settings.cache_ttl_seconds
            settings.cache_max_query_length = db_settings.cache_max_query_length
            settings.max_request_size_mb = db_settings.max_file_size
            settings.allowed_file_types = ','.join(db_settings.allowed_file_types)
            settings.email_notifications_enabled = db_settings.email_notifications
            if db_settings.email_smtp_host:
                settings.smtp_host = db_settings.email_smtp_host
            if db_settings.email_smtp_port:
                settings.smtp_port = db_settings.email_smtp_port
            if db_settings.email_smtp_username:
                settings.smtp_username = db_settings.email_smtp_username
            if db_settings.email_smtp_password:
                settings.smtp_password = db_settings.email_smtp_password
            settings.smtp_use_tls = db_settings.email_smtp_use_tls
            settings.smtp_use_ssl = db_settings.email_smtp_use_ssl
            if db_settings.email_sendgrid_api_key:
                settings.sendgrid_api_key = db_settings.email_sendgrid_api_key
            settings.email_from_address = db_settings.email_from_address
            settings.email_from_name = db_settings.email_from_name
        logger.info("System settings updated successfully")
        return SettingsResponse(
            settings=db_settings or new_settings,
            message="Settings updated successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@router.post("/reset", response_model=SettingsResponse)
async def reset_settings(
    _: bool = Depends(require_permission(Permission.SYSTEM_CONFIG))
):
    """Reset settings to defaults"""
    try:
        default_settings = SystemSettings()
        # Save to database
        await _save_settings_to_db(default_settings)
        # Always reload from DB after reset
        db_settings = await _load_settings_from_db()
        if db_settings:
            # Update runtime settings
            settings.debug = db_settings.debug_mode
            settings.log_level = db_settings.log_level
            settings.enable_rate_limiting = db_settings.enable_rate_limiting
            settings.enable_ip_blocking = db_settings.enable_ip_blocking
            settings.max_login_attempts = db_settings.max_login_attempts
            settings.session_timeout_seconds = db_settings.session_timeout * 60
            settings.rag_top_k = db_settings.rag_top_k
            settings.rag_similarity_threshold = db_settings.rag_similarity_threshold
            settings.rag_max_tokens = db_settings.rag_max_tokens
            settings.cache_ttl_seconds = db_settings.cache_ttl_seconds
            settings.cache_max_query_length = db_settings.cache_max_query_length
            settings.max_request_size_mb = db_settings.max_file_size
            settings.allowed_file_types = ','.join(db_settings.allowed_file_types)
            settings.email_notifications_enabled = db_settings.email_notifications
            if db_settings.email_smtp_host:
                settings.smtp_host = db_settings.email_smtp_host
            if db_settings.email_smtp_port:
                settings.smtp_port = db_settings.email_smtp_port
            if db_settings.email_smtp_username:
                settings.smtp_username = db_settings.email_smtp_username
            if db_settings.email_smtp_password:
                settings.smtp_password = db_settings.email_smtp_password
            settings.smtp_use_tls = db_settings.email_smtp_use_tls
            settings.smtp_use_ssl = db_settings.email_smtp_use_ssl
            if db_settings.email_sendgrid_api_key:
                settings.sendgrid_api_key = db_settings.email_sendgrid_api_key
            settings.email_from_address = db_settings.email_from_address
            settings.email_from_name = db_settings.email_from_name
        logger.info("Settings reset to defaults")
        return SettingsResponse(
            settings=db_settings or default_settings,
            message="Settings reset to defaults successfully",
            status="success"
        )
    except Exception as e:
        logger.error(f"Failed to reset settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")

@router.get("/health")
async def settings_health():
    """Health check for settings service"""
    try:
        return {
            "status": "healthy",
            "service": "settings",
            "message": "Settings service is operational"
        }
    except Exception as e:
        logger.error(f"Settings health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "settings",
            "error": str(e)
        }

async def _save_settings_to_db(settings_data: SystemSettings):
    """Save settings to database for persistence"""
    try:
        # Create settings table if it doesn't exist
        await db_manager.execute_command("""
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                settings_data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_by VARCHAR(255)
            )
        """)
        
        # Insert or update settings
        await db_manager.execute_command("""
            INSERT INTO system_settings (settings_data, updated_by)
            VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET
                settings_data = EXCLUDED.settings_data,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
        """, settings_data.model_dump_json(), "admin")
        
    except Exception as e:
        logger.error(f"Failed to save settings to database: {e}")
        # Don't raise here as settings can still work without persistence
        pass 