"""
Module Registry Setup

Registers all application modules with the module registry.
This is the central place where all modules are configured and registered.
"""

from .modules import module_registry
from .module_config import (
    get_database_config,
    get_cache_config,
    get_rag_config,
    get_auth_config,
    get_streaming_config,
    get_webhook_config,
    get_monitoring_config
)
from ..modules import (
    DatabaseModule,
    CacheModule,
    RAGModule,
    AuthModule,
    StreamingModule,
    WebhookModule,
    MonitoringModule
)


def register_all_modules():
    """Register all application modules"""
    
    # Register Database Module
    module_registry.register_module(
        name="database",
        module_class=DatabaseModule,
        config=get_database_config()
    )
    
    # Register Cache Module
    module_registry.register_module(
        name="cache",
        module_class=CacheModule,
        config=get_cache_config()
    )
    
    # Register RAG Module
    module_registry.register_module(
        name="rag",
        module_class=RAGModule,
        config=get_rag_config()
    )
    
    # Register Auth Module
    module_registry.register_module(
        name="auth",
        module_class=AuthModule,
        config=get_auth_config()
    )
    
    # Register Streaming Module
    module_registry.register_module(
        name="streaming",
        module_class=StreamingModule,
        config=get_streaming_config()
    )
    
    # Register Webhook Module
    module_registry.register_module(
        name="webhook",
        module_class=WebhookModule,
        config=get_webhook_config()
    )
    
    # Register Monitoring Module
    module_registry.register_module(
        name="monitoring",
        module_class=MonitoringModule,
        config=get_monitoring_config()
    )


def get_module_registry():
    """Get the module registry instance"""
    return module_registry


def initialize_modules():
    """Initialize all registered modules"""
    return module_registry.initialize_all()


def shutdown_modules():
    """Shutdown all registered modules"""
    return module_registry.shutdown_all()


def get_module_health():
    """Get health status of all modules"""
    return module_registry.health_check_all()


__all__ = [
    "register_all_modules",
    "get_module_registry",
    "initialize_modules",
    "shutdown_modules",
    "get_module_health"
] 