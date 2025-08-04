"""
Module Registry System for Dynamic Module Management

This system provides a centralized way to register, configure, and manage
all application modules dynamically. It supports:
- Lazy loading of modules
- Dependency injection
- Module lifecycle management
- Configuration management per module
- Health checks per module
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Type, Callable
from dataclasses import dataclass, field
from enum import Enum
import structlog

logger = structlog.get_logger(__name__)


class ModuleStatus(Enum):
    """Module lifecycle status"""
    UNINITIALIZED = "uninitialized"
    INITIALIZING = "initializing"
    ACTIVE = "active"
    ERROR = "error"
    SHUTTING_DOWN = "shutting_down"
    SHUTDOWN = "shutdown"


@dataclass
class ModuleConfig:
    """Configuration for a module"""
    name: str
    enabled: bool = True
    dependencies: List[str] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    startup_timeout: float = 30.0
    shutdown_timeout: float = 10.0


@dataclass
class ModuleInfo:
    """Information about a registered module"""
    name: str
    module_class: Type['BaseModule']
    config: ModuleConfig
    instance: Optional['BaseModule'] = None
    status: ModuleStatus = ModuleStatus.UNINITIALIZED
    error: Optional[str] = None
    startup_time: Optional[float] = None
    health_check: Optional[Callable] = None


class BaseModule(ABC):
    """Base class for all application modules"""
    
    def __init__(self, config: ModuleConfig):
        self.config = config
        self.name = config.name
        self.logger = structlog.get_logger(f"module.{self.name}")
        self._status = ModuleStatus.UNINITIALIZED
        self._error: Optional[str] = None
    
    @property
    def status(self) -> ModuleStatus:
        return self._status
    
    @property
    def error(self) -> Optional[str]:
        return self._error
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the module"""
        pass
    
    @abstractmethod
    async def shutdown(self) -> None:
        """Shutdown the module"""
        pass
    
    async def health_check(self) -> Dict[str, Any]:
        """Default health check implementation"""
        return {
            "status": self._status.value,
            "error": self._error,
            "name": self.name
        }
    
    def _set_status(self, status: ModuleStatus, error: Optional[str] = None) -> None:
        """Update module status"""
        self._status = status
        self._error = error
        self.logger.info(f"Module status changed to {status.value}", error=error)


class ModuleRegistry:
    """Central registry for all application modules"""
    
    def __init__(self):
        self._modules: Dict[str, ModuleInfo] = {}
        self._initialized = False
        self.logger = structlog.get_logger("module_registry")
    
    def register_module(
        self,
        name: str,
        module_class: Type[BaseModule],
        config: Optional[ModuleConfig] = None,
        health_check: Optional[Callable] = None
    ) -> None:
        """Register a module with the registry"""
        if name in self._modules:
            raise ValueError(f"Module '{name}' is already registered")
        
        if config is None:
            config = ModuleConfig(name=name)
        
        module_info = ModuleInfo(
            name=name,
            module_class=module_class,
            config=config,
            health_check=health_check
        )
        
        self._modules[name] = module_info
        self.logger.info(f"Registered module: {name}")
    
    def get_module(self, name: str) -> Optional[BaseModule]:
        """Get a module instance by name"""
        module_info = self._modules.get(name)
        return module_info.instance if module_info else None
    
    def get_module_info(self, name: str) -> Optional[ModuleInfo]:
        """Get module information by name"""
        return self._modules.get(name)
    
    def list_modules(self) -> List[str]:
        """List all registered module names"""
        return list(self._modules.keys())
    
    def list_active_modules(self) -> List[str]:
        """List all active module names"""
        return [
            name for name, info in self._modules.items()
            if info.status == ModuleStatus.ACTIVE
        ]
    
    async def initialize_all(self) -> None:
        """Initialize all modules in dependency order"""
        if self._initialized:
            return
        
        self.logger.info("Initializing all modules...")
        
        # Sort modules by dependencies
        sorted_modules = self._sort_by_dependencies()
        
        for module_name in sorted_modules:
            await self._initialize_module(module_name)
        
        self._initialized = True
        self.logger.info("All modules initialized")
    
    async def shutdown_all(self) -> None:
        """Shutdown all modules in reverse dependency order"""
        self.logger.info("Shutting down all modules...")
        
        # Shutdown in reverse order
        sorted_modules = list(reversed(self._sort_by_dependencies()))
        
        for module_name in sorted_modules:
            await self._shutdown_module(module_name)
        
        self._initialized = False
        self.logger.info("All modules shut down")
    
    async def health_check_all(self) -> Dict[str, Any]:
        """Perform health check on all modules"""
        health_status = {}
        
        for name, module_info in self._modules.items():
            try:
                if module_info.instance:
                    health_status[name] = await module_info.instance.health_check()
                else:
                    health_status[name] = {
                        "status": "not_initialized",
                        "error": "Module not initialized"
                    }
            except Exception as e:
                health_status[name] = {
                    "status": "error",
                    "error": str(e)
                }
        
        return health_status
    
    def _sort_by_dependencies(self) -> List[str]:
        """Sort modules by their dependencies using topological sort"""
        # Build dependency graph
        graph = {name: set(info.config.dependencies) for name, info in self._modules.items()}
        
        # Topological sort
        result = []
        visited = set()
        temp_visited = set()
        
        def visit(node: str) -> None:
            if node in temp_visited:
                raise ValueError(f"Circular dependency detected involving {node}")
            if node in visited:
                return
            
            temp_visited.add(node)
            
            for dependency in graph.get(node, set()):
                if dependency not in self._modules:
                    raise ValueError(f"Module '{node}' depends on unregistered module '{dependency}'")
                visit(dependency)
            
            temp_visited.remove(node)
            visited.add(node)
            result.append(node)
        
        for node in self._modules:
            if node not in visited:
                visit(node)
        
        return result
    
    async def _initialize_module(self, name: str) -> None:
        """Initialize a single module"""
        module_info = self._modules[name]
        
        if not module_info.config.enabled:
            self.logger.info(f"Module '{name}' is disabled, skipping initialization")
            return
        
        if module_info.status == ModuleStatus.ACTIVE:
            return
        
        self.logger.info(f"Initializing module: {name}")
        module_info.status = ModuleStatus.INITIALIZING
        
        try:
            # Create module instance
            module_info.instance = module_info.module_class(module_info.config)
            
            # Initialize with timeout
            await asyncio.wait_for(
                module_info.instance.initialize(),
                timeout=module_info.config.startup_timeout
            )
            
            module_info.status = ModuleStatus.ACTIVE
            module_info.startup_time = asyncio.get_event_loop().time()
            self.logger.info(f"Module '{name}' initialized successfully")
            
        except Exception as e:
            module_info.status = ModuleStatus.ERROR
            module_info.error = str(e)
            self.logger.error(f"Failed to initialize module '{name}': {e}")
            raise
    
    async def _shutdown_module(self, name: str) -> None:
        """Shutdown a single module"""
        module_info = self._modules[name]
        
        if module_info.status in [ModuleStatus.SHUTDOWN, ModuleStatus.UNINITIALIZED]:
            return
        
        self.logger.info(f"Shutting down module: {name}")
        module_info.status = ModuleStatus.SHUTTING_DOWN
        
        try:
            if module_info.instance:
                await asyncio.wait_for(
                    module_info.instance.shutdown(),
                    timeout=module_info.config.shutdown_timeout
                )
            
            module_info.status = ModuleStatus.SHUTDOWN
            self.logger.info(f"Module '{name}' shut down successfully")
            
        except Exception as e:
            module_info.status = ModuleStatus.ERROR
            module_info.error = str(e)
            self.logger.error(f"Failed to shutdown module '{name}': {e}")


# Global module registry instance
module_registry = ModuleRegistry()


def register_module(
    name: str,
    module_class: Type[BaseModule],
    config: Optional[ModuleConfig] = None,
    health_check: Optional[Callable] = None
) -> Callable:
    """Decorator to register a module"""
    def decorator(cls: Type[BaseModule]) -> Type[BaseModule]:
        module_registry.register_module(name, cls, config, health_check)
        return cls
    return decorator


__all__ = [
    "BaseModule",
    "ModuleConfig", 
    "ModuleInfo",
    "ModuleStatus",
    "ModuleRegistry",
    "module_registry",
    "register_module"
] 