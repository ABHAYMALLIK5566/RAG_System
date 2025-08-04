"""
Database Module

Handles all database operations including:
- Connection management
- Migration handling
- Health checks
- Connection pooling
"""

import asyncio
from typing import Dict, Any, Optional
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..core.database import db_manager, init_database
import structlog

logger = structlog.get_logger(__name__)


class DatabaseModule(BaseModule):
    """Database management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._connection_pool = None
        self._migration_status = "unknown"
    
    async def initialize(self) -> None:
        """Initialize database connections and run migrations"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Initialize database manager
            await db_manager.initialize()
            
            # Run database initialization/migrations
            await init_database()
            
            # Test connection
            await self._test_connection()
            
            self._set_status(ModuleStatus.ACTIVE)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize database module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Close database connections"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            await db_manager.close()
            self._set_status(ModuleStatus.SHUTDOWN)
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down database module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            # Test connection
            await self._test_connection()
            
            return {
                "status": "healthy",
                "name": self.name,
                "connection_pool_size": await self._get_pool_size(),
                "migration_status": self._migration_status
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    async def _test_connection(self) -> None:
        """Test database connection"""
        # Simple connection test
        async with db_manager.get_connection() as conn:
            await conn.execute("SELECT 1")
    
    async def _get_pool_size(self) -> Optional[int]:
        """Get connection pool size"""
        try:
            # This would depend on your database manager implementation
            return getattr(db_manager, 'pool_size', None)
        except:
            return None
    
    async def get_connection(self):
        """Get a database connection"""
        return db_manager.get_connection()
    
    async def execute_query(self, query: str, params: Optional[Dict] = None) -> Any:
        """Execute a database query"""
        async with db_manager.get_connection() as conn:
            if params:
                result = await conn.execute(query, params)
            else:
                result = await conn.execute(query)
            return result 