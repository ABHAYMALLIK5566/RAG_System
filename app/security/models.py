from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, field_validator
import uuid
import logging

class UserRole(str, Enum):
    """User roles with hierarchical permissions"""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    DEVELOPER = "developer"
    ANALYST = "analyst"
    USER = "user"
    READONLY = "readonly"

class Permission(str, Enum):
    """System permissions"""
    # Document permissions
    READ_DOCUMENTS = "read_documents"
    WRITE_DOCUMENTS = "write_documents"
    DELETE_DOCUMENTS = "delete_documents"
    BULK_IMPORT_DOCUMENTS = "bulk_import_documents"
    
    # Query permissions
    EXECUTE_QUERIES = "execute_queries"
    USE_AGENT = "use_agent"
    STREAM_RESPONSES = "stream_responses"
    
    # System permissions
    READ_STATS = "read_stats"
    READ_HEALTH = "read_health"
    CLEAR_CACHE = "clear_cache"
    VIEW_PERFORMANCE = "view_performance"
    
    # Admin permissions
    MANAGE_USERS = "manage_users"
    ADMIN_USERS = "admin_users"
    MANAGE_API_KEYS = "manage_api_keys"
    VIEW_LOGS = "view_logs"
    SYSTEM_CONFIG = "system_config"
    
    # WebSocket permissions
    WEBSOCKET_CONNECT = "websocket_connect"
    WEBSOCKET_BROADCAST = "websocket_broadcast"

# Role-based permissions mapping
ROLE_PERMISSIONS = {
    UserRole.SUPER_ADMIN: list(Permission),  # All permissions
    UserRole.ADMIN: [
        Permission.READ_DOCUMENTS,
        Permission.WRITE_DOCUMENTS,
        Permission.DELETE_DOCUMENTS,
        Permission.BULK_IMPORT_DOCUMENTS,
        Permission.EXECUTE_QUERIES,
        Permission.USE_AGENT,
        Permission.STREAM_RESPONSES,
        Permission.READ_STATS,
        Permission.READ_HEALTH,
        Permission.CLEAR_CACHE,
        Permission.VIEW_PERFORMANCE,
        Permission.MANAGE_USERS,
        Permission.ADMIN_USERS,
        Permission.MANAGE_API_KEYS,
        Permission.VIEW_LOGS,
        Permission.SYSTEM_CONFIG,
        Permission.WEBSOCKET_CONNECT,
        Permission.WEBSOCKET_BROADCAST,
    ],
    UserRole.DEVELOPER: [
        Permission.READ_DOCUMENTS,
        Permission.WRITE_DOCUMENTS,
        Permission.BULK_IMPORT_DOCUMENTS,
        Permission.EXECUTE_QUERIES,
        Permission.USE_AGENT,
        Permission.STREAM_RESPONSES,
        Permission.READ_STATS,
        Permission.READ_HEALTH,
        Permission.VIEW_PERFORMANCE,
        Permission.WEBSOCKET_CONNECT,
    ],
    UserRole.ANALYST: [
        Permission.READ_DOCUMENTS,
        Permission.WRITE_DOCUMENTS,
        Permission.EXECUTE_QUERIES,
        Permission.USE_AGENT,
        Permission.STREAM_RESPONSES,
        Permission.READ_STATS,
        Permission.READ_HEALTH,
        Permission.WEBSOCKET_CONNECT,
    ],
    UserRole.USER: [
        Permission.READ_DOCUMENTS,
        Permission.EXECUTE_QUERIES,
        Permission.USE_AGENT,
        Permission.READ_HEALTH,
        Permission.WEBSOCKET_CONNECT,
    ],
    UserRole.READONLY: [
        Permission.READ_DOCUMENTS,
        Permission.EXECUTE_QUERIES,
        Permission.READ_HEALTH,
    ]
}

class User(BaseModel):
    """User model with security attributes"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    full_name: Optional[str] = Field(None, max_length=200)
    hashed_password: str
    role: UserRole = UserRole.USER
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    login_attempts: int = 0
    locked_until: Optional[datetime] = None
    
    # Security settings
    require_password_change: bool = False
    session_timeout: int = 3600  # 1 hour in seconds
    allowed_ips: Optional[List[str]] = None
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    @field_validator('metadata', mode='before')
    @classmethod
    def validate_metadata(cls, v):
        """Handle metadata that might be stored as JSON string in database"""
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        elif v is None:
            return {}
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if not v.isalnum() and '_' not in v and '-' not in v:
            raise ValueError('Username must be alphanumeric with optional underscore or hyphen')
        return v.lower()
    
    @field_validator('role', mode='before')
    @classmethod
    def validate_role(cls, v):
        """Convert role string to UserRole enum"""
        if isinstance(v, str):
            try:
                return UserRole(v)
            except ValueError:
                return UserRole.USER
        elif isinstance(v, UserRole):
            return v
        else:
            return UserRole.USER
    
    def has_permission(self, permission: Permission) -> bool:
        # Ensure role is always an enum
        role = self.role
        if isinstance(role, str):
            try:
                role = UserRole(role)
            except ValueError:
                role = UserRole.USER
        
        # First check role-based permissions
        if permission in ROLE_PERMISSIONS.get(role, []):
            return True
        
        # Then check token permissions (for permissions not in role hierarchy)
        token_permissions = self.metadata.get("token_permissions", [])
        permission_str = permission.value if hasattr(permission, 'value') else str(permission)
        return permission_str in token_permissions
    
    def is_locked(self) -> bool:
        """Check if user account is locked"""
        return bool(self.locked_until and self.locked_until > datetime.utcnow())

class APIKey(BaseModel):
    """API Key model for service-to-service authentication"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key_id: str = Field(..., min_length=8, max_length=32)
    hashed_key: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    # Permissions and access
    role: UserRole = UserRole.USER
    permissions: List[Permission] = Field(default_factory=list)
    allowed_ips: Optional[List[str]] = None
    
    @field_validator('permissions', mode='before')
    @classmethod
    def validate_permissions(cls, v):
        """Handle permissions that might be stored as JSON string in database"""
        if isinstance(v, str):
            try:
                import json
                permission_strings = json.loads(v)
                # Convert permission strings to Permission enum objects
                permissions = []
                for perm_str in permission_strings:
                    try:
                        permissions.append(Permission(perm_str))
                    except ValueError:
                        # Skip invalid permissions
                        continue
                return permissions
            except (json.JSONDecodeError, TypeError):
                return []
        elif isinstance(v, list):
            # Handle case where database returns a list of strings
            permissions = []
            for item in v:
                if isinstance(item, str):
                    try:
                        permissions.append(Permission(item))
                    except ValueError:
                        continue
                elif isinstance(item, Permission):
                    permissions.append(item)
            return permissions
        elif v is None:
            return []
        else:
            return []
    
    @field_validator('allowed_ips', mode='before')
    @classmethod
    def validate_allowed_ips(cls, v):
        """Handle allowed_ips that might be stored as JSON string in database"""
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        elif v is None:
            return []
        return v
    
    @field_validator('metadata', mode='before')
    @classmethod
    def validate_metadata(cls, v):
        """Handle metadata that might be stored as JSON string in database"""
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        elif v is None:
            return {}
        return v
    
    # Lifecycle management
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    usage_count: int = 0
    
    # Rate limiting
    rate_limit_per_hour: Optional[int] = Field(None, ge=1, le=10000)
    rate_limit_per_day: Optional[int] = Field(None, ge=1, le=100000)
    
    # Metadata
    created_by: Optional[str] = None  # User ID who created this key
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    def is_expired(self) -> bool:
        """Check if API key is expired"""
        return bool(self.expires_at and self.expires_at < datetime.utcnow())
    
    def has_permission(self, permission: Permission) -> bool:
        """Check if API key has specific permission"""
        if permission in self.permissions:
            return True
        
        # Fall back to role-based permissions
        role_permissions = ROLE_PERMISSIONS.get(self.role, [])
        
        if permission in role_permissions:
            return True
        
        return False

class SecurityEvent(BaseModel):
    """Security event logging model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str = Field(..., min_length=1, max_length=50)
    severity: str = Field(..., pattern=r'^(low|medium|high|critical)$')
    
    # Event details
    user_id: Optional[str] = None
    api_key_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    # Request details
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    
    # Event data
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    
    # Timing
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Resolution
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

class TokenData(BaseModel):
    """JWT token data model"""
    user_id: Optional[str] = None
    username: Optional[str] = None
    role: Optional[UserRole] = None
    permissions: List[Permission] = Field(default_factory=list)
    session_id: Optional[str] = None

class UserCreate(BaseModel):
    """User creation model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    full_name: Optional[str] = Field(None, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.USER
    metadata: Dict[str, Any] = Field(default_factory=dict)

class UserUpdate(BaseModel):
    """User update model"""
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    full_name: Optional[str] = Field(None, max_length=200)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class APIKeyCreate(BaseModel):
    """API key creation model"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    role: UserRole = UserRole.USER
    permissions: List[Permission] = Field(default_factory=list)
    allowed_ips: Optional[List[str]] = None
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)
    rate_limit_per_hour: Optional[int] = Field(None, ge=1, le=10000)
    rate_limit_per_day: Optional[int] = Field(None, ge=1, le=100000)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LoginRequest(BaseModel):
    """Login request model"""
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False

class LoginResponse(BaseModel):
    """Login response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User

class RefreshTokenRequest(BaseModel):
    """Refresh token request model"""
    refresh_token: str

class PasswordChangeRequest(BaseModel):
    """Password change request model"""
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

class PasswordResetRequest(BaseModel):
    """Password reset request model"""
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=128) 