"""
Module Configuration System

Defines configurations for all application modules including:
- Module dependencies
- Configuration parameters
- Startup/shutdown timeouts
- Feature flags
"""

from typing import Dict, Any
from .modules import ModuleConfig


def get_database_config() -> ModuleConfig:
    """Get database module configuration"""
    return ModuleConfig(
        name="database",
        enabled=True,
        dependencies=[],
        config={
            "pool_size": 20,
            "max_overflow": 30,
            "pool_timeout": 30,
            "pool_recycle": 3600,
        },
        startup_timeout=60.0,
        shutdown_timeout=30.0
    )


def get_cache_config() -> ModuleConfig:
    """Get cache module configuration"""
    return ModuleConfig(
        name="cache",
        enabled=True,
        dependencies=["database"],
        config={
            "redis_url": "redis://localhost:6379",
            "memory_cache_size": 1000,
            "memory_cache_ttl": 3600,
            "cleanup_interval": 300,
        },
        startup_timeout=30.0,
        shutdown_timeout=15.0
    )


def get_rag_config() -> ModuleConfig:
    """Get RAG module configuration"""
    return ModuleConfig(
        name="rag",
        enabled=True,
        dependencies=["database", "cache"],
        config={
            "openai_api_key": None,  # Will be loaded from environment
            "embedding_model": "text-embedding-ada-002",
            "completion_model": "gpt-3.5-turbo",
            "max_tokens": 2000,
            "temperature": 0.7,
            "chunk_size": 1000,
            "chunk_overlap": 200,
        },
        startup_timeout=45.0,
        shutdown_timeout=20.0
    )


def get_auth_config() -> ModuleConfig:
    """Get authentication module configuration"""
    return ModuleConfig(
        name="auth",
        enabled=True,
        dependencies=[],
        config={
            "jwt_secret": None,  # Will be loaded from environment
            "jwt_algorithm": "HS256",
            "access_token_expire_minutes": 30,
            "refresh_token_expire_days": 7,
            "password_min_length": 8,
        },
        startup_timeout=10.0,
        shutdown_timeout=5.0
    )


def get_streaming_config() -> ModuleConfig:
    """Get streaming module configuration"""
    return ModuleConfig(
        name="streaming",
        enabled=True,
        dependencies=["cache"],
        config={
            "max_streams": 100,
            "stream_timeout": 3600,  # 1 hour
            "cleanup_interval": 60,  # 1 minute
            "max_message_size": 1024 * 1024,  # 1MB
        },
        startup_timeout=20.0,
        shutdown_timeout=15.0
    )


def get_webhook_config() -> ModuleConfig:
    """Get webhook module configuration"""
    return ModuleConfig(
        name="webhook",
        enabled=True,
        dependencies=["cache"],
        config={
            "max_retries": 3,
            "retry_delay": 5,
            "webhook_timeout": 30,
            "max_concurrent_webhooks": 10,
            "webhook_queue_size": 1000,
        },
        startup_timeout=15.0,
        shutdown_timeout=10.0
    )


def get_monitoring_config() -> ModuleConfig:
    """Get monitoring module configuration"""
    return ModuleConfig(
        name="monitoring",
        enabled=True,
        dependencies=["database", "cache"],
        config={
            "metrics_interval": 60,  # 1 minute
            "health_check_interval": 30,  # 30 seconds
            "max_metrics_history": 1000,
            "enable_detailed_metrics": True,
            "enable_performance_tracking": True,
        },
        startup_timeout=20.0,
        shutdown_timeout=10.0
    )


def get_all_module_configs() -> Dict[str, ModuleConfig]:
    """Get all module configurations"""
    return {
        "database": get_database_config(),
        "cache": get_cache_config(),
        "rag": get_rag_config(),
        "auth": get_auth_config(),
        "streaming": get_streaming_config(),
        "webhook": get_webhook_config(),
        "monitoring": get_monitoring_config(),
    }


def get_module_config(name: str) -> ModuleConfig:
    """Get configuration for a specific module"""
    configs = get_all_module_configs()
    return configs.get(name)


def update_module_config(name: str, updates: Dict[str, Any]) -> ModuleConfig:
    """Update configuration for a specific module"""
    config = get_module_config(name)
    if config:
        # Update config parameters
        config.config.update(updates.get("config", {}))
        
        # Update other attributes
        if "enabled" in updates:
            config.enabled = updates["enabled"]
        if "dependencies" in updates:
            config.dependencies = updates["dependencies"]
        if "startup_timeout" in updates:
            config.startup_timeout = updates["startup_timeout"]
        if "shutdown_timeout" in updates:
            config.shutdown_timeout = updates["shutdown_timeout"]
    
    return config


__all__ = [
    "get_database_config",
    "get_cache_config", 
    "get_rag_config",
    "get_auth_config",
    "get_streaming_config",
    "get_webhook_config",
    "get_monitoring_config",
    "get_all_module_configs",
    "get_module_config",
    "update_module_config"
] 