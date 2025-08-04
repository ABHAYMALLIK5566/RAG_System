"""
Authentication Module

Handles all authentication and authorization operations including:
- JWT token management
- User authentication
- Role-based access control
- API key management
"""

import asyncio
from typing import Dict, Any, Optional
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..security.auth import create_access_token, verify_token, get_current_user
import structlog

logger = structlog.get_logger(__name__)


class AuthModule(BaseModule):
    """Authentication management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._jwt_secret = config.config.get("jwt_secret", "default_secret")
        self._jwt_algorithm = config.config.get("jwt_algorithm", "HS256")
        self._access_token_expire_minutes = config.config.get("access_token_expire_minutes", 30)
    
    async def initialize(self) -> None:
        """Initialize authentication components"""
        self._set_status(ModuleStatus.INITIALIZING)
        
        try:
            # Validate JWT configuration
            if not self._jwt_secret or self._jwt_secret == "default_secret":
                logger.warning("Using default JWT secret - not recommended for production")
            
            # Test JWT token creation
            test_token = create_access_token(
                data={"sub": "test"},
                secret_key=self._jwt_secret,
                algorithm=self._jwt_algorithm,
                expires_delta=self._access_token_expire_minutes
            )
            
            # Verify test token
            verify_token(test_token, self._jwt_secret, self._jwt_algorithm)
            
            self._set_status(ModuleStatus.ACTIVE)
            logger.info("Authentication module initialized successfully")
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize authentication module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown authentication components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        
        try:
            # No specific shutdown needed for auth
            self._set_status(ModuleStatus.SHUTDOWN)
            logger.info("Authentication module shut down successfully")
            
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down authentication module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check authentication health"""
        try:
            # Test JWT functionality
            test_token = create_access_token(
                data={"sub": "health_check"},
                secret_key=self._jwt_secret,
                algorithm=self._jwt_algorithm,
                expires_delta=1  # 1 minute for health check
            )
            
            payload = verify_token(test_token, self._jwt_secret, self._jwt_algorithm)
            
            return {
                "status": "healthy",
                "name": self.name,
                "jwt_algorithm": self._jwt_algorithm,
                "token_expire_minutes": self._access_token_expire_minutes,
                "test_token_valid": payload is not None
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    # Authentication interface methods
    def create_token(self, data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
        """Create JWT access token"""
        return create_access_token(
            data=data,
            secret_key=self._jwt_secret,
            algorithm=self._jwt_algorithm,
            expires_delta=expires_delta or self._access_token_expire_minutes
        )
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token"""
        try:
            return verify_token(token, self._jwt_secret, self._jwt_algorithm)
        except Exception:
            return None
    
    async def get_current_user(self, token: str):
        """Get current user from token"""
        return await get_current_user(token)
    
    def is_authenticated(self, token: str) -> bool:
        """Check if token is valid"""
        return self.verify_token(token) is not None 