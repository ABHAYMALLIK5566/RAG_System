import asyncio
import json
import logging
import time
import traceback
from typing import Dict, Any, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.websockets import WebSocketState
import uuid
import inspect

from ...services import rag_agent, background_webhook_service
from ...core.config import settings
from ...security.auth import auth_manager
from ...security.security import log_security_event

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    """Manages WebSocket connections with session tracking"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_connections: Dict[str, Set[str]] = {}  # session_id -> connection_ids
        self.connection_sessions: Dict[str, str] = {}  # connection_id -> session_id
        self.max_connections = settings.websocket_max_connections
        self.ping_interval = settings.websocket_ping_interval
    
    async def connect(self, websocket: WebSocket, session_id: Optional[str] = None) -> str:
        """Accept new WebSocket connection"""
        
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Connection limit exceeded")
            raise HTTPException(status_code=429, detail="Too many connections")
        
        await websocket.accept()
        
        # Generate unique connection ID
        connection_id = str(uuid.uuid4())
        
        # Store connection
        self.active_connections[connection_id] = websocket
        
        # Associate with session if provided
        if session_id:
            self.connection_sessions[connection_id] = session_id
            if session_id not in self.session_connections:
                self.session_connections[session_id] = set()
            self.session_connections[session_id].add(connection_id)
        
        logger.info(f"WebSocket connected: {connection_id} (session: {session_id})")
        return connection_id
    
    def disconnect(self, connection_id: str):
        """Remove WebSocket connection"""
        
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            
            # Remove from session tracking
            if connection_id in self.connection_sessions:
                session_id = self.connection_sessions[connection_id]
                del self.connection_sessions[connection_id]
                
                if session_id in self.session_connections:
                    self.session_connections[session_id].discard(connection_id)
                    if not self.session_connections[session_id]:
                        del self.session_connections[session_id]
            
            logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def send_personal_message(self, message: Dict[str, Any], connection_id: str):
        """Send message to specific connection"""
        
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps(message))
                    return True
            except Exception as e:
                logger.warning(f"Failed to send message to {connection_id}: {e}")
                self.disconnect(connection_id)
        
        return False
    
    async def send_session_message(self, message: Dict[str, Any], session_id: str):
        """Send message to all connections in a session"""
        
        if session_id in self.session_connections:
            connection_ids = list(self.session_connections[session_id])
            
            for connection_id in connection_ids:
                await self.send_personal_message(message, connection_id)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connections"""
        
        connection_ids = list(self.active_connections.keys())
        
        for connection_id in connection_ids:
            await self.send_personal_message(message, connection_id)
    
    def get_connection_count(self) -> int:
        """Get current connection count"""
        return len(self.active_connections)
    
    def get_session_count(self) -> int:
        """Get current session count"""
        return len(self.session_connections)

# Global connection manager
manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: Optional[str] = Query(default=None),
    token: Optional[str] = Query(default=None)  # JWT token for authentication
):
    """
    SECURED WebSocket endpoint for real-time RAG communication
    
    Authentication:
    - Requires JWT token in query parameter: ?token=<jwt_token>
    - Or API key in query parameter: ?api_key=<api_key>
    
    Protocol:
    - Client sends: {"type": "query", "data": {"query": "...", "options": {...}}}
    - Server sends: {"type": "chunk", "data": {"content": "...", "timestamp": ...}}
    - Server sends: {"type": "complete", "data": {"response": "...", "metadata": {...}}}
    - Server sends: {"type": "error", "data": {"error": "...", "timestamp": ...}}
    """
    
    connection_id = None
    client_ip = None
    
    try:
        # Get client IP for security logging
        client_ip = websocket.client.host if websocket.client else "unknown"
        
        # SECURITY: Authentication Check
        if settings.enable_authentication and token:
            token_data = auth_manager.verify_token(token)
            if not token_data:
                log_security_event(
                    "websocket_auth_failed",
                    "WebSocket authentication failed with invalid token",
                    "medium",
                    ip_address=client_ip,
                    endpoint="/ws"
                )
                await websocket.close(code=1008, reason="Authentication failed")
                return
            
            # Log successful authentication
            log_security_event(
                "websocket_auth_success",
                f"WebSocket authenticated for user: {token_data.username}",
                "low",
                ip_address=client_ip,
                endpoint="/ws",
                user_id=token_data.user_id
            )
        elif settings.enable_authentication and not token:
            log_security_event(
                "websocket_auth_missing",
                "WebSocket connection attempt without authentication",
                "medium",
                ip_address=client_ip,
                endpoint="/ws"
            )
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        # Connect to the WebSocket
        connection_id = await manager.connect(websocket, session_id)
        
        # Send welcome message
        await manager.send_personal_message({
            "type": "connected",
            "data": {
                "connection_id": connection_id,
                "session_id": session_id,
                "timestamp": time.time()
            }
        }, connection_id)
        
        # Initialize RAG agent
        await rag_agent.initialize()
        
        # Start ping task
        ping_task = asyncio.create_task(_ping_connection(websocket, connection_id))
        
        # Main message loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                logger.info(f"[WS] Received message from {connection_id}: {message.get('type', 'unknown')}")
                
                # Process message
                await _process_websocket_message(
                    message, connection_id, session_id, websocket
                )
                
            except WebSocketDisconnect:
                logger.info(f"[WS] WebSocket disconnected: {connection_id}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"[WS] Invalid JSON from {connection_id}: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": "Invalid JSON format",
                        "timestamp": time.time()
                    }
                }, connection_id)
            except Exception as e:
                logger.error(f"[WS] WebSocket message processing error: {e}\n{traceback.format_exc()}")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": str(e),
                        "timestamp": time.time()
                    }
                }, connection_id)
    
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    
    finally:
        # Cleanup
        if connection_id:
            manager.disconnect(connection_id)
        
        # Cancel ping task
        if 'ping_task' in locals():
            ping_task.cancel()

async def _process_websocket_message(
    message: Dict[str, Any],
    connection_id: str,
    session_id: Optional[str],
    websocket: WebSocket
):
    """Process incoming WebSocket message"""
    
    message_type = message.get("type")
    data = message.get("data", {})
    
    logger.info(f"[WS] Processing message type: {message_type} from {connection_id}")
    
    if message_type == "query":
        # Handle RAG query
        logger.info(f"[WS] Handling RAG query from {connection_id}")
        await _handle_rag_query(data, connection_id, session_id)
    
    elif message_type == "ping":
        # Handle ping/pong
        await manager.send_personal_message({
            "type": "pong",
            "data": {"timestamp": time.time()}
        }, connection_id)
    
    elif message_type == "subscribe_webhook":
        # Handle webhook subscription
        await _handle_webhook_subscription(data, connection_id, session_id)
    
    elif message_type == "clear_conversation":
        # Clear conversation history
        if session_id:
            success = await rag_agent.agent_executor.clear_conversation(session_id)
            await manager.send_personal_message({
                "type": "conversation_cleared",
                "data": {"success": success, "session_id": session_id}
            }, connection_id)
    
    elif message_type == "get_history":
        # Get conversation history
        if session_id:
            try:
                history = await asyncio.wait_for(
                    rag_agent.agent_executor.get_conversation_history(session_id),
                    timeout=5.0  # 5 second timeout
                )
                await manager.send_personal_message({
                    "type": "conversation_history",
                    "data": {"history": history, "session_id": session_id}
                }, connection_id)
            except asyncio.TimeoutError:
                logger.warning("[WS] Conversation history timed out")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": "Failed to retrieve conversation history",
                        "timestamp": time.time()
                    }
                }, connection_id)
            except Exception as e:
                logger.error(f"[WS] Conversation history error: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": str(e),
                        "timestamp": time.time()
                    }
                }, connection_id)
    
    else:
        await manager.send_personal_message({
            "type": "error",
            "data": {
                "error": f"Unknown message type: {message_type}",
                "timestamp": time.time()
            }
        }, connection_id)

async def _handle_rag_query(
    data: Dict[str, Any],
    connection_id: str,
    session_id: Optional[str]
):
    """Handle RAG query through WebSocket"""
    
    try:
        query = data.get("query")
        if not query:
            await manager.send_personal_message({
                "type": "error",
                "data": {
                    "error": "Query is required",
                    "timestamp": time.time()
                }
            }, connection_id)
            return
        
        options = data.get("options", {})
        use_agent = options.get("use_agent", True)
        
        logger.info(f"[WS] RAG query received: query='{query}', use_agent={use_agent}, session_id={session_id}")
        logger.info(f"[WS] DEBUG: options={options}, use_agent={use_agent}, type(use_agent)={type(use_agent)}")
        
        # Send processing started event
        await manager.send_personal_message({
            "type": "processing_started",
            "data": {
                "query": query,
                "timestamp": time.time()
            }
        }, connection_id)
        
        if use_agent:
            logger.info("[WS] Starting agent streaming...")
            # Stream agent response
            chunk_count = 0
            try:
                logger.info("[WS] DEBUG: About to call unified_query_stream")
                async for chunk in rag_agent.unified_query_stream(
                    query=query,
                    session_id=session_id,
                    use_agent=True
                ):
                    chunk_count += 1
                    logger.info(f"[WS] Streaming chunk {chunk_count}: {chunk.get('type', 'unknown')}")
                    # Forward chunk to client
                    await manager.send_personal_message({
                        "type": "chunk",
                        "data": chunk
                    }, connection_id)
                
                logger.info(f"[WS] Agent streaming completed, sent {chunk_count} chunks")
            except asyncio.TimeoutError:
                logger.warning("[WS] Streaming query timed out")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": "Streaming query timed out. Please try again.",
                        "timestamp": time.time()
                    }
                }, connection_id)
            except Exception as e:
                logger.error(f"[WS] Exception during streaming: {e}\n{traceback.format_exc()}")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": f"Streaming exception: {str(e)}",
                        "timestamp": time.time()
                    }
                }, connection_id)
        else:
            logger.info("[WS] Starting direct RAG query (non-streaming)...")
            # Direct RAG query (non-streaming) with timeout
            try:
                logger.info("[WS] DEBUG: About to call unified_query")
                result = await asyncio.wait_for(
                    rag_agent.unified_query(
                        query=query,
                        session_id=session_id,
                        use_agent=False
                    ),
                    timeout=10.0  # 10 second timeout
                )
                
                logger.info("[WS] Direct RAG query completed")
                # Send complete response
                await manager.send_personal_message({
                    "type": "complete",
                    "data": result
                }, connection_id)
            except asyncio.TimeoutError:
                logger.warning("[WS] RAG query timed out")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": "Query timed out. Please try again.",
                        "timestamp": time.time()
                    }
                }, connection_id)
            except Exception as e:
                logger.error(f"[WS] RAG query error: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "data": {
                        "error": f"Query failed: {str(e)}",
                        "timestamp": time.time()
                    }
                }, connection_id)
    
    except Exception as e:
        logger.error(f"[WS] RAG query error: {e}\n{traceback.format_exc()}")
        await manager.send_personal_message({
            "type": "error",
            "data": {
                "error": str(e),
                "timestamp": time.time()
            }
        }, connection_id)

async def _handle_webhook_subscription(
    data: Dict[str, Any],
    connection_id: str,
    session_id: Optional[str]
):
    """Handle webhook subscription request"""
    
    if not session_id:
        await manager.send_personal_message({
            "type": "error",
            "data": {
                "error": "Session ID required for webhook subscription",
                "timestamp": time.time()
            }
        }, connection_id)
        return
    
    try:
        webhook_url = data.get("url")
        events = data.get("events", ["rag.response", "agent.response"])
        secret = data.get("secret")
        
        if not webhook_url:
            await manager.send_personal_message({
                "type": "error",
                "data": {
                    "error": "Webhook URL is required",
                    "timestamp": time.time()
                }
            }, connection_id)
            return
        
        # Register webhook
        from ...services import webhook_registry
        success = await webhook_registry.register_webhook(
            session_id=session_id,
            url=webhook_url,
            events=events,
            secret=secret
        )
        
        await manager.send_personal_message({
            "type": "webhook_subscribed",
            "data": {
                "success": success,
                "url": webhook_url,
                "events": events,
                "session_id": session_id
            }
        }, connection_id)
    
    except Exception as e:
        logger.error(f"Webhook subscription error: {e}")
        await manager.send_personal_message({
            "type": "error",
            "data": {
                "error": str(e),
                "timestamp": time.time()
            }
        }, connection_id)

async def _ping_connection(websocket: WebSocket, connection_id: str):
    """Send periodic ping to keep connection alive"""
    
    try:
        while True:
            await asyncio.sleep(settings.websocket_ping_interval)
            
            if connection_id in manager.active_connections:
                try:
                    await manager.send_personal_message({
                        "type": "ping",
                        "data": {"timestamp": time.time()}
                    }, connection_id)
                except:
                    # Connection lost
                    break
            else:
                break
    
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Ping task error: {e}")

@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics"""
    
    return {
        "active_connections": manager.get_connection_count(),
        "active_sessions": manager.get_session_count(),
        "max_connections": settings.websocket_max_connections,
        "ping_interval": settings.websocket_ping_interval
    }

@router.post("/ws/broadcast")
async def broadcast_message(message: Dict[str, Any]):
    """Broadcast message to all WebSocket connections (admin only)"""
    
    # In production, add authentication here
    await manager.broadcast({
        "type": "broadcast",
        "data": message
    })
    
    return {
        "message": "Broadcast sent",
        "connections": manager.get_connection_count()
    }

@router.post("/ws/session/{session_id}/message")
async def send_session_message(session_id: str, message: Dict[str, Any]):
    """Send message to all connections in a session (admin only)"""
    
    # In production, add authentication here
    await manager.send_session_message({
        "type": "session_message",
        "data": message
    }, session_id)
    
    return {
        "message": f"Message sent to session {session_id}",
        "session_id": session_id
    } 