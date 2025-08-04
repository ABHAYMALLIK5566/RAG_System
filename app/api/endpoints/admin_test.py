"""
Test Admin API Endpoints
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse

from ...security.auth import get_current_user, require_permission
from ...security.models import User, UserRole, Permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin-test", tags=["Admin Test"])

@router.get("/permissions")
async def get_permissions_test():
    """Get all available permissions (test version)"""
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

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {"message": "Admin test endpoint works!"} 