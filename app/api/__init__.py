from fastapi import APIRouter
from .endpoints import rag, websocket, health, auth, file_upload, admin, chat, admin_test, settings, notifications, analytics

# Create main API router
api_router = APIRouter(prefix="/api/v1")

# Include endpoint routers
api_router.include_router(auth.router)  # Authentication endpoints
api_router.include_router(rag.router)
api_router.include_router(health.router)
api_router.include_router(file_upload.router)  # File upload endpoints
api_router.include_router(admin.router)  # Admin endpoints
api_router.include_router(admin_test.router)  # Admin test endpoints
api_router.include_router(chat.router)  # Chat endpoints
api_router.include_router(settings.router)  # Settings endpoints
api_router.include_router(notifications.router)  # Notifications endpoints
api_router.include_router(analytics.router)  # Analytics endpoints

# WebSocket router (no prefix for WebSocket)
ws_router = APIRouter()
ws_router.include_router(websocket.router)

__all__ = ["api_router", "ws_router"] 