"""
Admin API Endpoints

This module provides admin-specific endpoints for user management
and system administration.
"""

import logging
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ...security.auth import get_current_user, require_permission, verify_api_key
from ...security.models import User, UserRole, Permission, APIKey
from ...security.security import generate_api_key, hash_api_key
from ...core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

# Request/Response Models
class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    full_name: Optional[str] = Field(None, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="user")
    metadata: Optional[dict] = Field(default_factory=dict)
    is_active: bool = Field(default=True)

class UpdateUserRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    role: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None)

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int

class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    role: str = Field(default="user")
    permissions: Optional[List[str]] = Field(default_factory=list)
    allowed_ips: Optional[List[str]] = Field(default_factory=list)
    expires_at: Optional[str] = Field(None)  # ISO datetime string
    rate_limit_per_hour: Optional[int] = Field(None, ge=1)
    rate_limit_per_day: Optional[int] = Field(None, ge=1)

class ApiKeyResponse(BaseModel):
    id: str
    key_id: str
    key: str  # Full API key (key_id.secret)
    name: str
    description: Optional[str]
    role: str
    permissions: List[str]
    allowed_ips: Optional[List[str]]
    is_active: bool
    created_at: str
    expires_at: Optional[str]
    last_used: Optional[str]
    usage_count: int
    rate_limit_per_hour: Optional[int]
    rate_limit_per_day: Optional[int]
    created_by: Optional[str]

# Users Management
@router.get("/users", response_model=PaginatedResponse)
async def get_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Get paginated list of users"""
    try:
        from ...core.database import db_manager
        
        # Build query with optional filters
        query = "SELECT id, username, email, role, is_active, created_at, updated_at FROM users"
        params = []
        where_conditions = []
        
        if search:
            where_conditions.append("(username ILIKE $1 OR email ILIKE $1)")
            params.append(f"%{search}%")
        
        if role:
            where_conditions.append("role = $%d" % (len(params) + 1))
            params.append(role)
        
        if is_active is not None:
            where_conditions.append("is_active = $%d" % (len(params) + 1))
            params.append(is_active)
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) as total FROM users"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        count_result = await db_manager.execute_one(count_query, *params)
        total = count_result["total"] if count_result else 0
        
        # Add pagination
        query += " ORDER BY created_at DESC LIMIT $%d OFFSET $%d" % (len(params) + 1, len(params) + 2)
        params.extend([size, (page - 1) * size])
        
        # Execute query
        users = await db_manager.execute_query(query, *params)
        
        # Process users
        processed_users = []
        for user in users:
            processed_user = {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
                "is_active": user["is_active"],
                "created_at": user["created_at"].isoformat() if user["created_at"] else None,
                "updated_at": user["updated_at"].isoformat() if user["updated_at"] else None,
            }
            processed_users.append(processed_user)
        
        return PaginatedResponse(
            items=processed_users,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size
        )
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Get specific user by ID"""
    try:
        from ...core.database import db_manager
        
        query = "SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = $1"
        user = await db_manager.execute_one(query, user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user["is_active"],
            "created_at": user["created_at"].isoformat() if user["created_at"] else None,
            "updated_at": user["updated_at"].isoformat() if user["updated_at"] else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users")
async def create_user(
    user_data: CreateUserRequest,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Create a new user"""
    try:
        from ...core.database import db_manager
        from ...security.security import hash_password
        from datetime import datetime
        
        # Check if user already exists
        existing_user = await db_manager.execute_one(
            "SELECT id FROM users WHERE username = $1 OR email = $2",
            user_data.username, user_data.email
        )
        
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this username or email already exists")
        
        # Hash password
        hashed_password = hash_password(user_data.password)
        
        # Generate a unique user ID
        import uuid
        user_id = f"user-{uuid.uuid4().hex[:8]}"
        
        # Insert new user
        query = """
        INSERT INTO users (id, username, email, full_name, hashed_password, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, username, email, role, is_active, created_at
        """
        
        now = datetime.utcnow()
        new_user = await db_manager.execute_one(
            query,
            user_id,
            user_data.username,
            user_data.email,
            user_data.full_name,
            hashed_password,
            user_data.role,
            user_data.is_active,
            now,
            now
        )
        
        return {
            "id": new_user["id"],
            "username": new_user["username"],
            "email": new_user["email"],
            "role": new_user["role"],
            "is_active": new_user["is_active"],
            "created_at": new_user["created_at"].isoformat() if new_user["created_at"] else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: UpdateUserRequest,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Update a user"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        
        # Check if user exists
        existing_user = await db_manager.execute_one(
            "SELECT id FROM users WHERE id = $1",
            user_id
        )
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Build update query dynamically
        update_fields = []
        params = []
        param_count = 1
        
        if user_data.username is not None:
            update_fields.append(f"username = ${param_count}")
            params.append(user_data.username)
            param_count += 1
        
        if user_data.email is not None:
            update_fields.append(f"email = ${param_count}")
            params.append(user_data.email)
            param_count += 1
        
        if user_data.role is not None:
            update_fields.append(f"role = ${param_count}")
            params.append(user_data.role)
            param_count += 1
        
        if user_data.is_active is not None:
            update_fields.append(f"is_active = ${param_count}")
            params.append(user_data.is_active)
            param_count += 1
        
        # Always update the updated_at timestamp
        update_fields.append(f"updated_at = ${param_count}")
        params.append(datetime.utcnow())
        param_count += 1
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Build and execute update query
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ${param_count} RETURNING id, username, email, role, is_active, created_at, updated_at"
        params.append(user_id)
        
        updated_user = await db_manager.execute_one(query, *params)
        
        return {
            "id": updated_user["id"],
            "username": updated_user["username"],
            "email": updated_user["email"],
            "role": updated_user["role"],
            "is_active": updated_user["is_active"],
            "created_at": updated_user["created_at"].isoformat() if updated_user["created_at"] else None,
            "updated_at": updated_user["updated_at"].isoformat() if updated_user["updated_at"] else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Delete a user"""
    try:
        from ...core.database import db_manager
        
        # Check if user exists
        existing_user = await db_manager.execute_one(
            "SELECT id, username FROM users WHERE id = $1",
            user_id
        )
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete the user
        await db_manager.execute_command(
            "DELETE FROM users WHERE id = $1",
            user_id
        )
        
        return {"message": f"User {existing_user['username']} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Activate a user"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        
        # Check if user exists
        existing_user = await db_manager.execute_one(
            "SELECT id, username FROM users WHERE id = $1",
            user_id
        )
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Activate the user
        await db_manager.execute_command(
            "UPDATE users SET is_active = true, updated_at = $2 WHERE id = $1",
            user_id, datetime.utcnow()
        )
        
        return {"message": f"User {existing_user['username']} activated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    _: bool = Depends(require_permission(Permission.ADMIN_USERS))
):
    """Deactivate a user"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        
        # Check if user exists
        existing_user = await db_manager.execute_one(
            "SELECT id, username FROM users WHERE id = $1",
            user_id
        )
        
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Deactivate the user
        await db_manager.execute_command(
            "UPDATE users SET is_active = false, updated_at = $2 WHERE id = $1",
            user_id, datetime.utcnow()
        )
        
        return {"message": f"User {existing_user['username']} deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# API Keys Management
@router.get("/api-keys", response_model=PaginatedResponse)
async def get_api_keys(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Get paginated list of API keys"""
    try:
        from ...core.database import db_manager
        
        # Build query with optional filters
        query = "SELECT id, key_id, name, description, role, permissions, allowed_ips, is_active, created_at, expires_at, last_used, usage_count, rate_limit_per_hour, rate_limit_per_day, created_by FROM api_keys"
        params = []
        where_conditions = []
        
        if search:
            where_conditions.append("(name ILIKE $1 OR description ILIKE $1)")
            params.append(f"%{search}%")
        
        if role:
            where_conditions.append("role = $%d" % (len(params) + 1))
            params.append(role)
        
        if is_active is not None:
            where_conditions.append("is_active = $%d" % (len(params) + 1))
            params.append(is_active)
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) as total FROM api_keys"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        count_result = await db_manager.execute_one(count_query, *params)
        total = count_result["total"] if count_result else 0
        
        # Add pagination
        query += " ORDER BY created_at DESC LIMIT $%d OFFSET $%d" % (len(params) + 1, len(params) + 2)
        params.extend([size, (page - 1) * size])
        
        # Execute query
        api_keys = await db_manager.execute_query(query, *params)
        
        # Process API keys (don't include the actual secret)
        processed_keys = []
        for key in api_keys:
            # Parse JSON strings back to lists
            permissions_list = json.loads(key.get("permissions", "[]")) if key.get("permissions") else []
            allowed_ips_list = json.loads(key.get("allowed_ips", "[]")) if key.get("allowed_ips") else []
            
            processed_key = {
                "id": key["id"],
                "key_id": key["key_id"],
                "key": f"{key['key_id']}...",  # Don't show full key
                "name": key["name"],
                "description": key.get("description"),
                "role": key["role"],
                "permissions": permissions_list,
                "allowed_ips": allowed_ips_list,
                "is_active": key["is_active"],
                "created_at": key["created_at"].isoformat() if key["created_at"] else None,
                "expires_at": key["expires_at"].isoformat() if key["expires_at"] else None,
                "last_used": key["last_used"].isoformat() if key["last_used"] else None,
                "usage_count": key.get("usage_count", 0),
                "rate_limit_per_hour": key.get("rate_limit_per_hour"),
                "rate_limit_per_day": key.get("rate_limit_per_day"),
                "created_by": key.get("created_by")
            }
            processed_keys.append(processed_key)
        
        return PaginatedResponse(
            items=processed_keys,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size
        )
    except Exception as e:
        logger.error(f"Error getting API keys: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    api_key_data: CreateApiKeyRequest,
    current_user: Optional[User] = Depends(get_current_user),
    api_key: Optional[APIKey] = Depends(verify_api_key),
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Create a new API key"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        import uuid
        from ...security.models import ROLE_PERMISSIONS, UserRole, Permission

        # Generate API key
        key_id, secret = generate_api_key()
        full_key = f"{key_id}.{secret}"
        hashed_secret = hash_api_key(secret)
        api_key_id = f"key-{uuid.uuid4().hex[:8]}"

        # Parse expiration date if provided
        expires_at = None
        if api_key_data.expires_at:
            try:
                expires_at = datetime.fromisoformat(api_key_data.expires_at.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid expiration date format")

        # Determine permissions
        role_enum = UserRole(api_key_data.role)
        role_permissions = ROLE_PERMISSIONS.get(role_enum, [])
        all_permission_values = set(p.value for p in Permission)
        # If custom permissions provided, validate and use them
        if api_key_data.permissions:
            # Validate permissions
            for perm in api_key_data.permissions:
                if perm not in all_permission_values:
                    raise HTTPException(status_code=400, detail=f"Invalid permission: {perm}")
            permission_strings = api_key_data.permissions
        else:
            permission_strings = [p.value for p in role_permissions]

        # Determine creator
        if current_user is not None:
            created_by = current_user.id
        elif api_key is not None:
            created_by = api_key.key_id
        else:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Insert new API key
        query = """
        INSERT INTO api_keys (
            id, key_id, hashed_key, name, description, role, permissions, 
            allowed_ips, is_active, created_at, expires_at, rate_limit_per_hour, 
            rate_limit_per_day, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, key_id, name, description, role, permissions, allowed_ips, 
                  is_active, created_at, expires_at, last_used, usage_count, 
                  rate_limit_per_hour, rate_limit_per_day, created_by
        """
        now = datetime.utcnow()
        permissions_json = json.dumps(permission_strings) if permission_strings else json.dumps([])
        allowed_ips_json = json.dumps(api_key_data.allowed_ips) if api_key_data.allowed_ips else json.dumps([])
        new_key = await db_manager.execute_one(
            query,
            api_key_id,
            key_id,
            hashed_secret,
            api_key_data.name,
            api_key_data.description,
            api_key_data.role,
            permissions_json,
            allowed_ips_json,
            True,  # is_active
            now,
            expires_at,
            api_key_data.rate_limit_per_hour,
            api_key_data.rate_limit_per_day,
            created_by
        )
        permissions_list = json.loads(new_key.get("permissions", "[]")) if new_key.get("permissions") else []
        allowed_ips_list = json.loads(new_key.get("allowed_ips", "[]")) if new_key.get("allowed_ips") else []
        return ApiKeyResponse(
            id=new_key["id"],
            key_id=new_key["key_id"],
            key=full_key,  # Return the full key only on creation
            name=new_key["name"],
            description=new_key.get("description"),
            role=new_key["role"],
            permissions=permissions_list,
            allowed_ips=allowed_ips_list,
            is_active=new_key["is_active"],
            created_at=new_key["created_at"].isoformat() if new_key["created_at"] else None,
            expires_at=new_key["expires_at"].isoformat() if new_key["expires_at"] else None,
            last_used=new_key["last_used"].isoformat() if new_key["last_used"] else None,
            usage_count=new_key.get("usage_count", 0),
            rate_limit_per_hour=new_key.get("rate_limit_per_hour"),
            rate_limit_per_day=new_key.get("rate_limit_per_day"),
            created_by=new_key.get("created_by")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Delete an API key"""
    try:
        from ...core.database import db_manager
        
        # Check if API key exists
        existing_key = await db_manager.execute_one(
            "SELECT id, name FROM api_keys WHERE id = $1",
            key_id
        )
        
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Delete the API key
        await db_manager.execute_command(
            "DELETE FROM api_keys WHERE id = $1",
            key_id
        )
        
        return {"message": f"API key {existing_key['name']} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key {key_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api-keys/{key_id}/deactivate")
async def deactivate_api_key(
    key_id: str,
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Deactivate an API key"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        
        # Check if API key exists
        existing_key = await db_manager.execute_one(
            "SELECT id, name FROM api_keys WHERE id = $1",
            key_id
        )
        
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Deactivate the API key
        await db_manager.execute_command(
            "UPDATE api_keys SET is_active = false, updated_at = $2 WHERE id = $1",
            key_id, datetime.utcnow()
        )
        
        return {"message": f"API key {existing_key['name']} deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating API key {key_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: str,
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Regenerate an API key"""
    try:
        from ...core.database import db_manager
        from datetime import datetime
        import uuid
        
        # Check if API key exists
        existing_key = await db_manager.execute_one(
            "SELECT id, name, description, role, permissions, allowed_ips, rate_limit_per_hour, rate_limit_per_day, created_by FROM api_keys WHERE id = $1",
            key_id
        )
        
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Generate new API key
        new_key_id, new_secret = generate_api_key()
        full_key = f"{new_key_id}.{new_secret}"
        hashed_secret = hash_api_key(new_secret)
        
        # Update the API key with new key_id and hashed_secret
        await db_manager.execute_command(
            "UPDATE api_keys SET key_id = $2, hashed_key = $3, updated_at = $4 WHERE id = $1",
            key_id, new_key_id, hashed_secret, datetime.utcnow()
        )
        
        # Get the updated API key
        updated_key = await db_manager.execute_one(
            "SELECT id, key_id, name, description, role, permissions, allowed_ips, is_active, created_at, expires_at, last_used, usage_count, rate_limit_per_hour, rate_limit_per_day, created_by FROM api_keys WHERE id = $1",
            key_id
        )
        
        # Parse JSON strings back to lists for the response
        permissions_list = json.loads(updated_key.get("permissions", "[]")) if updated_key.get("permissions") else []
        allowed_ips_list = json.loads(updated_key.get("allowed_ips", "[]")) if updated_key.get("allowed_ips") else []
        
        return ApiKeyResponse(
            id=updated_key["id"],
            key_id=updated_key["key_id"],
            key=full_key,  # Return the full new key
            name=updated_key["name"],
            description=updated_key.get("description"),
            role=updated_key["role"],
            permissions=permissions_list,
            allowed_ips=allowed_ips_list,
            is_active=updated_key["is_active"],
            created_at=updated_key["created_at"].isoformat() if updated_key["created_at"] else None,
            expires_at=updated_key["expires_at"].isoformat() if updated_key["expires_at"] else None,
            last_used=updated_key["last_used"].isoformat() if updated_key["last_used"] else None,
            usage_count=updated_key.get("usage_count", 0),
            rate_limit_per_hour=updated_key.get("rate_limit_per_hour"),
            rate_limit_per_day=updated_key.get("rate_limit_per_day"),
            created_by=updated_key.get("created_by")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating API key {key_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/simple-test")
async def simple_test_endpoint():
    """Simple test endpoint without any dependencies"""
    return {"message": "Simple admin test endpoint works!"}

@router.get("/test")
async def test_admin_endpoint():
    """Test endpoint to verify admin router is working"""
    return {"message": "Admin router is working!"}

@router.get("/permissions-simple")
async def get_permissions_simple():
    """Get all available permissions (simple version without dependencies)"""
    try:
        # Hardcoded permissions for testing
        all_permissions = [
            "read_documents",
            "write_documents", 
            "delete_documents",
            "bulk_import_documents",
            "execute_queries",
            "use_agent",
            "stream_responses",
            "read_stats",
            "read_health",
            "clear_cache",
            "view_performance",
            "manage_users",
            "admin_users",
            "manage_api_keys",
            "view_logs",
            "system_config",
            "websocket_connect",
            "websocket_broadcast"
        ]
        
        # Group permissions by category for better organization
        permission_categories = {
            "Document Management": [
                "read_documents",
                "write_documents", 
                "delete_documents",
                "bulk_import_documents"
            ],
            "Query Operations": [
                "execute_queries",
                "use_agent",
                "stream_responses"
            ],
            "System Monitoring": [
                "read_stats",
                "read_health",
                "clear_cache",
                "view_performance"
            ],
            "Administration": [
                "manage_users",
                "admin_users",
                "manage_api_keys",
                "view_logs",
                "system_config"
            ],
            "WebSocket": [
                "websocket_connect",
                "websocket_broadcast"
            ]
        }
        
        return {
            "permissions": all_permissions,
            "categories": permission_categories,
            "total_count": len(all_permissions)
        }
    except Exception as e:
        logger.error(f"Error getting permissions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/permissions")
async def get_permissions(
    _: bool = Depends(require_permission(Permission.MANAGE_API_KEYS))
):
    """Get all available permissions"""
    try:
        # Get all permissions from the Permission enum
        all_permissions = [permission.value for permission in Permission]
        
        # Group permissions by category for better organization
        permission_categories = {
            "Document Management": [
                "read_documents",
                "write_documents", 
                "delete_documents",
                "bulk_import_documents"
            ],
            "Query Operations": [
                "execute_queries",
                "use_agent",
                "stream_responses"
            ],
            "System Monitoring": [
                "read_stats",
                "read_health",
                "clear_cache",
                "view_performance"
            ],
            "Administration": [
                "manage_users",
                "admin_users",
                "manage_api_keys",
                "view_logs",
                "system_config"
            ],
            "WebSocket": [
                "websocket_connect",
                "websocket_broadcast"
            ]
        }
        
        return {
            "permissions": all_permissions,
            "categories": permission_categories,
            "total_count": len(all_permissions)
        }
    except Exception as e:
        logger.error(f"Error getting permissions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 