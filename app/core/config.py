import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # App Settings
    app_name: str = "RAG Microservice"
    app_version: str = "1.0.0"
    debug: bool = Field(default=True)
    
    # Server Settings
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    
    # Database Settings - PostgreSQL only
    database_url: str = Field(
        default="postgresql://postgres:password@localhost:5432/rag_db"
    )
    db_pool_min_size: int = Field(default=5)
    db_pool_max_size: int = Field(default=20)
    db_command_timeout: int = Field(default=60)
    
    # Redis Settings - optional
    redis_url: Optional[str] = Field(default=None)
    redis_max_connections: int = Field(default=10)
    
    # OpenAI Settings - optional
    openai_api_key: Optional[str] = Field(default=None)
    openai_model: str = Field(default="gpt-4-turbo-preview")
    openai_embedding_model: str = Field(default="text-embedding-3-small")
    openai_assistant_id: Optional[str] = Field(default=None)
    
    # Query Classification
    complex_query_keywords: List[str] = Field(
        default=[
            "analyze", "compare", "evaluate", "explain why", "logic", 
            "step by step", "calculate", "prove", "solve", "optimize", "strategy",
            "complex", "detailed analysis", "comprehensive", "elaborate", "justify"
        ]
    )
    
    # RAG Settings
    rag_top_k: int = Field(default=5)
    rag_similarity_threshold: float = Field(default=0.7)
    rag_max_tokens: int = Field(default=4000)
    
    # Cache Settings
    cache_ttl_seconds: int = Field(default=300)
    cache_max_query_length: int = Field(default=1000)
    
    # Security Settings - with proper defaults
    secret_key: str = Field(
        default="development-secret-key-change-in-production-jwt-minimum-32-chars"
    )
    webhook_secret: str = Field(
        default="webhook-secret-change-in-production"
    )
    
    # CORS Settings - PRODUCTION SECURITY: Restrict CORS origins
    cors_origins: str = Field(default="http://localhost:3001,http://localhost:3002,http://localhost:80,http://localhost")  # Allow frontend origins
    
    # Rate Limiting
    rate_limit_requests: int = Field(default=10)
    rate_limit_window: str = Field(default="1/minute")
    
    # WebSocket Settings
    websocket_max_connections: int = Field(default=1000)
    websocket_ping_interval: int = Field(default=30)
    
    # Monitoring
    enable_metrics: bool = Field(default=True)
    log_level: str = Field(default="DEBUG")
    
    # Security Settings
    enable_authentication: bool = Field(default=True)
    enable_rate_limiting: bool = Field(default=True)
    enable_ip_blocking: bool = Field(default=True)
    
    # Development Security Settings (relaxed in debug mode)
    relaxed_security_in_debug: bool = Field(default=True)
    jwt_access_token_expire_minutes: int = Field(default=30)
    jwt_refresh_token_expire_days: int = Field(default=30)
    max_login_attempts: int = Field(default=5)
    account_lockout_duration_hours: int = Field(default=1)
    session_timeout_seconds: int = Field(default=3600)
    
    # API Security
    require_api_key: bool = Field(default=False)
    api_key_header_name: str = Field(default="X-API-Key")
    
    # HTTPS Settings (for production)
    force_https: bool = Field(default=False)
    secure_cookies: bool = Field(default=False)
    
    # Content Security
    max_request_size_mb: int = Field(default=100)
    allowed_file_types: str = Field(default="pdf,txt,docx,md")
    
    # Testing Settings
    test_mode: bool = Field(default=False)
    disable_database_init: bool = Field(default=False)
    disable_cache_init: bool = Field(default=False)
    disable_webhook_service: bool = Field(default=False)
    
    # CSP Settings
    disable_csp: bool = Field(default=False)
    
    # Email Settings
    smtp_host: Optional[str] = Field(default=None, description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_username: Optional[str] = Field(default=None, description="SMTP username")
    smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    smtp_use_tls: bool = Field(default=True, description="Use TLS for SMTP")
    smtp_use_ssl: bool = Field(default=False, description="Use SSL for SMTP")
    sendgrid_api_key: Optional[str] = Field(default=None, description="SendGrid API key")
    email_from_address: str = Field(default="noreply@example.com", description="Default from email address")
    email_from_name: str = Field(default="RAG System", description="Default from name")
    email_notifications_enabled: bool = Field(default=True, description="Enable email notifications")
    
    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v):
        if not v:
            return "postgresql://postgres:password@localhost:5432/rag_db"
        # Allow SQLite for testing, PostgreSQL for production
        if v.startswith("sqlite://"):
            return v
        if not v.startswith("postgresql://") and not v.startswith("postgres://"):
            raise ValueError("Only PostgreSQL and SQLite databases are supported")
        return v
    
    @field_validator('redis_url')
    @classmethod
    def validate_redis_url(cls, v):
        # Allow None for Redis URL (optional)
        if v and v.strip() == "":
            return None
        return v
    
    @field_validator('openai_api_key')
    @classmethod
    def validate_openai_key(cls, v):
        # Allow None for OpenAI key (optional)
        if v and v.strip() == "":
            return None
        return v
    
    model_config = ConfigDict(
        env_file = ".env",
        env_file_encoding = "utf-8",
        case_sensitive = False
    )

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

# Global settings instance
settings = get_settings() 