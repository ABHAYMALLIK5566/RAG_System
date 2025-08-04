"""
Chat Sessions API Endpoints

This module provides chat session management endpoints including:
- Session creation and management
- Session history retrieval
- Session cleanup
"""

import logging
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field

from ...security.auth import require_permission
from ...security.models import Permission
from ...services import rag_agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Session title")
    description: Optional[str] = Field(default=None, description="Session description")

class ChatSessionResponse(BaseModel):
    session_id: str
    title: str
    description: Optional[str]
    created_at: str
    last_activity: str
    message_count: int
    status: str

@router.get("/sessions")
async def get_chat_sessions(
    current_user = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Get all chat sessions for the current user
    """
    try:
        from ...core.database import db_manager
        
        # Query for unique sessions with message counts and latest activity - FILTERED BY USER
        query = """
            SELECT 
                session_id,
                COUNT(*) as message_count,
                MAX(created_at) as last_activity,
                MIN(created_at) as created_at,
                MAX(user_query) as last_message_preview
            FROM conversation_history 
            WHERE user_id = $1
            GROUP BY session_id 
            ORDER BY MAX(created_at) DESC
        """
        
        results = await db_manager.execute_query(query, current_user.id)
        
        # Convert to session format
        sessions = []
        for row in results:
            sessions.append({
                "id": row['session_id'],
                "title": f"Chat Session {row['session_id'][:8]}",
                "description": f"Session with {row['message_count']} messages",
                "created_at": row['created_at'].isoformat() if row['created_at'] else datetime.now().isoformat(),
                "last_activity": row['last_activity'].isoformat() if row['last_activity'] else datetime.now().isoformat(),
                "updated_at": row['last_activity'].isoformat() if row['last_activity'] else datetime.now().isoformat(),
                "message_count": row['message_count'],
                "status": "active",
                "last_message_preview": row['last_message_preview'][:50] + "..." if row['last_message_preview'] and len(row['last_message_preview']) > 50 else row['last_message_preview']
            })
        
        logger.info(f"Retrieved {len(sessions)} chat sessions for user {current_user.id}")
        return sessions
        
    except Exception as e:
        logger.error(f"Failed to get chat sessions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat sessions: {str(e)}"
        )

@router.post("/sessions")
async def create_chat_session(
    request: ChatSessionRequest,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Create a new chat session
    """
    try:
        import uuid
        from datetime import datetime
        
        session_id = str(uuid.uuid4())
        current_time = datetime.now().isoformat()
        
        # In a real implementation, this would store the session in a database
        session_data = {
            "id": session_id,
            "title": request.title,
            "description": request.description,
            "created_at": current_time,
            "updated_at": current_time,
            "last_activity": current_time,
            "message_count": 0,
            "status": "active",
            "is_active": True,
            "messages": []
        }
        
        return session_data
        
    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create chat session: {str(e)}"
        )

@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Get a specific chat session
    """
    try:
        # In a real implementation, this would query the database
        # For now, return a mock response
        return {
            "session_id": session_id,
            "title": "Sample Session",
            "description": "A sample chat session",
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat(),
            "message_count": 0,
            "status": "active"
        }
        
    except Exception as e:
        logger.error(f"Failed to get chat session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat session: {str(e)}"
        )

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Delete a chat session - USER ISOLATED
    """
    try:
        from ...core.database import db_manager
        
        # Delete all conversation history for this session and user
        delete_query = """
            DELETE FROM conversation_history 
            WHERE session_id = $1 AND user_id = $2
        """
        
        result = await db_manager.execute_command(delete_query, session_id, current_user.id)
        
        logger.info(f"Deleted chat session {session_id} for user {current_user.id}")
        return {
            "message": f"Session {session_id} deleted successfully",
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to delete chat session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete chat session: {str(e)}"
        )

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Get messages for a specific chat session - USER ISOLATED
    """
    try:
        from ...core.database import db_manager
        
        # Query conversation_history table for messages in this session - FILTERED BY USER
        query = """
            SELECT id, session_id, user_query, assistant_response, 
                   rag_context, response_time_ms, created_at
            FROM conversation_history 
            WHERE session_id = $1 AND user_id = $2
            ORDER BY created_at ASC
        """
        
        results = await db_manager.execute_query(query, session_id, current_user.id)
        
        # Convert database results to message format
        messages = []
        for row in results:
            # Add user message
            messages.append({
                "id": f"user-{row['id']}",
                "content": row['user_query'],
                "role": "user",
                "timestamp": row['created_at'].isoformat() if row['created_at'] else datetime.now().isoformat(),
                "session_id": session_id
            })
            
            # Add assistant message
            messages.append({
                "id": f"assistant-{row['id']}",
                "content": row['assistant_response'],
                "role": "assistant",
                "timestamp": row['created_at'].isoformat() if row['created_at'] else datetime.now().isoformat(),
                "session_id": session_id
            })
        
        logger.info(f"Retrieved {len(messages)} messages for session {session_id} (user: {current_user.id})")
        return messages
        
    except Exception as e:
        logger.error(f"Failed to get messages for session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get messages: {str(e)}"
        )

@router.post("/sessions/{session_id}/messages")
async def add_session_message(
    session_id: str,
    message: Dict[str, Any],
    current_user = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Add a message to a chat session and generate AI response - USER ISOLATED
    """
    try:
        content = message.get("content", "")
        stream = message.get("stream", False)
        
        if not content:
            raise HTTPException(status_code=400, detail="Message content is required")
        
        logger.info(f"Processing message for user {current_user.id}: {content}")
        
        start_time = time.time()
        
        try:
            # Import RAG engine
            from ...services.rag_engine import rag_engine
            
            # Optimized query with performance settings
            logger.info("Processing optimized RAG query...")
            query_result = await rag_engine.query(
                query=content,
                top_k=3,  # Reduced for speed
                use_agent=True,
                algorithm="hybrid",  # Fastest algorithm
                similarity_threshold=0.25  # Lower threshold for more results
            )
            
            # Extract the response text
            ai_response = query_result.get('response', 'No response generated')
            search_results = query_result.get('context', [])
            
            logger.info(f"Generated response in {query_result.get('processing_time', 0):.2f}s")
            
        except Exception as rag_error:
            logger.error(f"RAG engine error: {rag_error}")
            # Fallback response
            ai_response = f"I received your message: '{content}'. This is a test response while the RAG system is being configured."
            search_results = []
        
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Save conversation to database with USER ID
        try:
            from ...core.database import db_manager
            import json
            
            # Save to conversation_history table with user_id
            insert_query = """
                INSERT INTO conversation_history 
                (session_id, user_id, user_query, assistant_response, rag_context, response_time_ms)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            """
            
            # Prepare RAG context data
            rag_context = {
                "search_results": search_results if 'search_results' in locals() else [],
                "query_result": query_result if 'query_result' in locals() else {},
                "algorithm": "hybrid",
                "processing_time_ms": response_time_ms
            }
            
            result = await db_manager.execute_query(
                insert_query,
                session_id,
                current_user.id,  # Add user ID for isolation
                content,
                ai_response,
                json.dumps(rag_context),
                response_time_ms
            )
            
            logger.info(f"Saved conversation to database with ID: {result[0]['id'] if result else 'unknown'} (user: {current_user.id})")
            
        except Exception as db_error:
            logger.error(f"Failed to save conversation to database: {db_error}")
            # Continue without saving to database - don't fail the request
        
        # Create response message
        response_message = {
            "id": f"ai-{int(time.time())}",
            "content": ai_response,
            "role": "assistant",
            "timestamp": time.time(),
            "session_id": session_id
        }
        
        logger.info("Returning response to frontend")
        return {
            "message": "Message processed successfully",
            "session_id": session_id,
            "status": "success",
            "response": response_message
        }
        
    except Exception as e:
        logger.error(f"Failed to process message in session {session_id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process message: {str(e)}"
        )

@router.post("/sessions/{session_id}/share")
async def share_session(
    session_id: str,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Share a chat session
    """
    try:
        # In a real implementation, this would generate a shareable link
        # For now, just return a mock share URL
        return {
            "share_url": f"http://localhost:3001/chat/shared/{session_id}",
            "session_id": session_id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to share session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to share session: {str(e)}"
        ) 