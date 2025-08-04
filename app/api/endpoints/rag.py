"""
Comprehensive RAG API Endpoints

This module provides all RAG-related endpoints including:
- Core RAG operations with streaming support
- Advanced search with multiple algorithms
- Multi-agent orchestration
- Document management
- Performance monitoring
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from functools import wraps
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Header, Depends, Body, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uuid


from ...services import rag_agent, background_webhook_service, rag_engine
from ...services.streaming_service import streaming_service, StreamFormat, StreamEventType
from ...services.agent_orchestrator import agent_orchestrator, AgentType
from ...services.advanced_rag_engine import advanced_rag_engine, SearchAlgorithm
from ...core.config import settings
from ...security.auth import get_current_user, verify_api_key, require_permission
from ...security.models import User, APIKey, Permission
from ...security.security import sanitize_input, validate_input, log_security_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG"])


@router.get("/test-simple")
async def test_simple():
    """Simple test endpoint"""
    return {"message": "Simple test endpoint works!"}

# Performance tracking decorator
def track_performance(category: str, operation: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                elapsed = time.time() - start_time
                logger.info(f"Performance: {category}.{operation} took {elapsed:.3f}s")
                return result
            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(f"Performance: {category}.{operation} failed after {elapsed:.3f}s: {e}")
                raise
        return wrapper
    return decorator

# Request Models
class RAGQueryRequest(BaseModel):
    query: str = Field(default="", min_length=0, max_length=10000, description="Search query")
    top_k: Optional[int] = Field(default=5, ge=1, le=50, description="Number of results to return")
    include_metadata: bool = Field(default=True, description="Include search metadata")
    metadata_filter: Optional[Dict[str, Any]] = Field(default=None, description="Metadata filters")
    use_agent: bool = Field(default=True, description="Use AI agent for response generation")
    session_id: Optional[str] = Field(default=None, description="Session ID for conversation tracking")
    stream: bool = Field(default=False, description="Stream the response")
    algorithm: str = Field(default="hybrid", description="Search algorithm to use")
    agent_type: Optional[str] = Field(default=None, description="Force specific agent type")
    similarity_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Similarity threshold")

class MultiAgentQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    agent_types: List[str] = Field(default=["general"], description="Agent types to use")
    session_id: Optional[str] = Field(default=None, description="Session ID")
    stream: bool = Field(default=False, description="Stream the response")

class AdvancedSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    algorithm: str = Field(default="hybrid", description="Search algorithm")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of results")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Search filters")
    similarity_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Similarity threshold")

class AddDocumentRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Document content")
    title: Optional[str] = Field(default=None, max_length=2000, description="Document title")
    source: Optional[str] = Field(default=None, max_length=500, description="Document source")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

class BulkAddDocumentsRequest(BaseModel):
    documents: List[AddDocumentRequest] = Field(..., min_length=1, max_length=100)

# Response Models
class RAGResponse(BaseModel):
    response: str
    query: str
    context: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    source: str
    response_time_ms: int
    session_id: Optional[str] = None
    performance: Optional[Dict[str, Any]] = None
    orchestration: Optional[Dict[str, Any]] = None

class MultiAgentResponse(BaseModel):
    response: str
    query: str
    agent_results: Dict[str, Any]
    synthesis_method: str
    response_time_ms: int
    session_id: Optional[str]

class AdvancedSearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    query: str
    algorithm: str
    total_results: int
    response_time_ms: int
    metadata: Dict[str, Any]

def error_response(status_code: int, error: str, details: str = None):
    content = {"error": error}
    if details:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content)

@router.get("/test")
async def test_rag_system():
    """Test endpoint to verify RAG system is working"""
    try:
        # Test document retrieval
        documents = await rag_engine._get_all_documents()
        
        # Test similarity search with a simple query
        test_query = "test"
        search_results = await rag_engine.similarity_search(
            query=test_query,
            top_k=3,
            similarity_threshold=0.01,  # Very low threshold for testing
            algorithm="hybrid"
        )
        
        return {
            "status": "success",
            "total_documents": len(documents),
            "test_query": test_query,
            "search_results_count": len(search_results),
            "search_results": [
                {
                    "title": doc.get("title", "No title"),
                    "similarity_score": doc.get("similarity_score", 0.0)
                }
                for doc in search_results
            ]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/test-public")
async def test_rag_system_public():
    """Public test endpoint to verify RAG system is working (no auth required)"""
    try:
        # Test document retrieval
        documents = await rag_engine._get_all_documents()
        
        # Test similarity search with Krsna Consciousness query
        test_query = "Krsna Consciousness"
        search_results = await rag_engine.similarity_search(
            query=test_query,
            top_k=5,
            similarity_threshold=0.01,  # Very low threshold for testing
            algorithm="hybrid"
        )
        
        return {
            "status": "success",
            "total_documents": len(documents),
            "test_query": test_query,
            "search_results_count": len(search_results),
            "search_results": [
                {
                    "title": doc.get("title", "No title"),
                    "similarity_score": doc.get("similarity_score", 0.0),
                    "content_preview": doc.get("content", "")[:100] + "..." if doc.get("content") else ""
                }
                for doc in search_results
            ]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.post("/query", response_model=RAGResponse)
@track_performance("rag_query", "query_processing")
async def rag_query(
    request: RAGQueryRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    x_callback_url: Optional[str] = Header(default=None, alias="X-Callback-URL"),
    x_webhook_secret: Optional[str] = Header(default=None, alias="X-Webhook-Secret"),
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Execute RAG query with advanced features:
    - Multi-agent orchestration
    - Advanced search algorithms
    - Intelligent query routing
    - Performance optimization
    """
    start_time = time.time()
    
    try:
        # Input validation and sanitization
        query_text = sanitize_input(request.query)
        validation_result = validate_input(query_text)
        if not validation_result["is_safe"]:
            return error_response(400, "Invalid query input", validation_result.get("reason", "Query failed validation."))
        if not query_text or len(query_text) > 10000:
            return error_response(422, "Query must be between 1 and 10000 characters.")
        
        # Determine agent type
        agent_type = None
        if request.agent_type:
            try:
                agent_type = AgentType(request.agent_type)
            except ValueError:
                return error_response(400, f"Invalid agent type: {request.agent_type}")
        
        # Determine search algorithm
        search_algorithm = None
        if request.algorithm:
            try:
                search_algorithm = SearchAlgorithm(request.algorithm)
            except ValueError:
                return error_response(400, f"Invalid search algorithm: {request.algorithm}")
        
        # Execute query with optimizations
        if request.use_agent:
            # Use optimized agent query
            result = await rag_agent.unified_query(
                query=query_text,
                session_id=request.session_id,
                use_agent=True
            )
        else:
            # Use optimized rag_engine directly
            search_results = await rag_engine.similarity_search(
                query=query_text,
                top_k=request.top_k or 3,  # Reduced for speed
                similarity_threshold=request.similarity_threshold or 0.25,  # Lower threshold
                algorithm=request.algorithm or "hybrid"  # Fastest algorithm
            )
            # Prepare context
            context = rag_engine._prepare_optimized_context(search_results)
            # Generate response
            response_obj = await rag_engine.generate_response(query_text, context)
            result = {
                "response": response_obj["response"],
                "query": query_text,
                "context": search_results,
                "source": "rag_engine",
                "response_time_ms": int((time.time() - start_time) * 1000),
                "metadata": {},
            }
        
        processing_time = time.time() - start_time
        
        # Prepare response
        response_metadata = result.get("metadata", {})
        response_metadata.update(result.get("processing_info", {}))
        
        response_data = RAGResponse(
            response=result["response"],
            query=result["query"],
            context=result.get("context", []),
            metadata=response_metadata,
            source=result["source"],
            response_time_ms=result.get("response_time_ms", int((time.time() - start_time) * 1000)),
            session_id=request.session_id,
            performance={
                'processing_time': round(processing_time, 3),
                'algorithm_used': result.get('algorithm', request.algorithm or 'hybrid'),
                'sources_found': len(result.get('context', [])),
                'cached': False
            },
            orchestration=result.get("orchestration")
        )
        
        # Queue webhook notification if callback URL provided
        if x_callback_url:
            background_tasks.add_task(
                _send_rag_webhook,
                x_callback_url,
                result,
                request.session_id,
                x_webhook_secret
            )
        
        return response_data
        
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        return error_response(500, "Internal server error", str(e))

@router.post("/query/stream")
async def rag_query_stream(
    request: RAGQueryRequest,
    http_request: Request
):
    """
    Execute streaming RAG query with real-time response
    
    Returns server-sent events with streaming response chunks
    """
    if not request.use_agent:
        raise HTTPException(status_code=400, detail="Streaming is only available with agent mode")
    
    async def generate_stream():
        try:
            # Input validation
            query_text = sanitize_input(request.query)
            validation_result = validate_input(query_text)
            if not validation_result["is_safe"]:
                yield f"data: {json.dumps({'error': 'Invalid query input'})}\n\n"
                return
            
            # Execute streaming query
            async for chunk in rag_agent.unified_query_stream(
                query=query_text,
                session_id=request.session_id,
                use_agent=True
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
                
        except Exception as e:
            logger.error(f"Streaming query failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

@router.post("/multi-agent", response_model=MultiAgentResponse)
@track_performance("multi_agent_query", "multi_agent_processing")
async def multi_agent_query(
    request: MultiAgentQueryRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Execute query using multiple agents and synthesize results
    """
    start_time = time.time()
    try:
        # Input validation
        query_text = sanitize_input(request.query)
        validation_result = validate_input(query_text)
        if not validation_result["is_safe"]:
            return error_response(400, "Invalid query input", validation_result.get("reason", "Query failed validation."))

        # Convert agent_types from strings to AgentType enums, skip invalids
        agent_types = []
        for atype in request.agent_types:
            try:
                agent_types.append(AgentType(atype))
            except ValueError:
                logger.warning(f"Invalid agent type: {atype}, skipping.")
        if not agent_types:
            agent_types = [AgentType.GENERAL]

        # Execute multi-agent query using coordinate_agents method
        result = await agent_orchestrator.coordinate_agents(
            query=query_text,
            session_id=request.session_id,
            agent_types=agent_types
        )

        processing_time = time.time() - start_time

        response_data = MultiAgentResponse(
            response=result.get("response", "No response generated."),
            query=result.get("query", query_text),
            agent_results=result.get("agent_results", {}),
            synthesis_method=result.get("synthesis_method", "consensus"),
            response_time_ms=int(processing_time * 1000),
            session_id=request.session_id
        )

        return response_data

    except Exception as e:
        logger.error(f"Multi-agent query failed: {e}")
        return error_response(500, "Multi-agent processing failed", str(e))

@router.post("/search", response_model=AdvancedSearchResponse)
@track_performance("advanced_search", "search_processing")
async def advanced_search(
    request: AdvancedSearchRequest,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    Advanced search with multiple algorithms and filtering
    """
    start_time = time.time()
    
    try:
        # Input validation
        query_text = sanitize_input(request.query)
        validation_result = validate_input(query_text)
        if not validation_result["is_safe"]:
            return error_response(400, "Invalid query input", validation_result.get("reason", "Query failed validation."))
        
        # Determine search algorithm
        try:
            search_algorithm = SearchAlgorithm(request.algorithm)
        except ValueError:
            return error_response(400, f"Invalid search algorithm: {request.algorithm}")
        
        # Execute advanced search
        search_results = await advanced_rag_engine.advanced_search(
            query=query_text,
            algorithm=search_algorithm,
            top_k=request.top_k,
            filters=request.filters,
            similarity_threshold=request.similarity_threshold
        )
        
        processing_time = time.time() - start_time
        
        # Convert SearchResult objects to dictionaries
        results_list = []
        for result in search_results:
            results_list.append({
                "content": result.content,
                "title": result.title,
                "source": result.source,
                "similarity_score": result.similarity_score,
                "metadata": result.metadata,
                "chunk_id": result.chunk_id,
                "document_id": result.document_id,
                "position": result.position,
                "search_algorithm": result.search_algorithm,
                "confidence": result.confidence
            })
        
        response_data = AdvancedSearchResponse(
            results=results_list,
            query=query_text,
            algorithm=request.algorithm,
            total_results=len(results_list),
            response_time_ms=int(processing_time * 1000),
            metadata={"algorithm": request.algorithm, "total_found": len(results_list)}
        )
        
        return response_data
        
    except Exception as e:
        logger.error(f"Advanced search failed: {e}")
        return error_response(500, "Search failed", str(e))

@router.post("/documents")
@track_performance("add_document", "document_management")
async def add_document(
    request: AddDocumentRequest,
    _: bool = Depends(require_permission(Permission.WRITE_DOCUMENTS))
):
    """
    Add a single document to the knowledge base
    """
    try:
        content = sanitize_input(request.content)
        validation_result = validate_input(content)
        if not validation_result["is_safe"]:
            return error_response(400, "Invalid document content", validation_result.get("reason", "Content failed validation."))
        
        doc_id = await rag_engine.add_document(
            title=request.title or "Untitled",
            content=content,
            metadata=request.metadata or {}
        )
        return {
            "message": "Document added successfully",
            "document_id": doc_id,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Add document failed: {e}")
        return error_response(500, "Failed to add document", str(e))

@router.post("/documents/bulk")
async def bulk_import_documents(
    request: BulkAddDocumentsRequest,
    _: bool = Depends(require_permission(Permission.BULK_IMPORT_DOCUMENTS))
):
    """
    Bulk import multiple documents
    """
    try:
        results = []
        for doc in request.documents:
            try:
                content = sanitize_input(doc.content)
                validation_result = validate_input(content)
                if validation_result["is_safe"]:
                    result = await advanced_rag_engine.add_document(
                        content=content,
                        title=doc.title,
                        source=doc.source,
                        metadata=doc.metadata
                    )
                    results.append({
                        "status": "success",
                        "document_id": result.get("document_id")
                    })
                else:
                    results.append({
                        "status": "error",
                        "error": "Invalid document content"
                    })
            except Exception as e:
                results.append({
                    "status": "error",
                    "error": str(e)
                })
        
        return {
            "message": f"Bulk import completed: {len(results)} documents processed",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Bulk import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk import failed: {str(e)}")

@router.get("/documents")
@track_performance("list_documents", "document_management")
async def list_documents(
    limit: Optional[int] = Query(default=50, ge=1, le=100, description="Maximum number of documents to return"),
    offset: Optional[int] = Query(default=0, ge=0, description="Number of documents to skip"),
    include_content: bool = Query(default=False, description="Include document content in response"),
    source_filter: Optional[str] = Query(default=None, description="Filter documents by source"),
    _: bool = Depends(require_permission(Permission.READ_DOCUMENTS))
):
    """
    List all documents in the knowledge base
    """
    try:
        from ...core.database import db_manager
        
        # Build query with optional filters
        query = "SELECT id, title, source, status, metadata, created_at, updated_at"
        if include_content:
            query += ", content"
        query += " FROM documents"
        
        params = []
        where_conditions = []
        
        if source_filter:
            where_conditions.append("source = $1")
            params.append(source_filter)
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        query += " ORDER BY created_at DESC LIMIT $%d OFFSET $%d" % (len(params) + 1, len(params) + 2)
        params.extend([limit, offset])
        
        # Execute query
        documents = await db_manager.execute_query(query, *params)
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) as total FROM documents"
        if source_filter:
            count_query += " WHERE source = $1"
            count_params = [source_filter] if source_filter else []
        else:
            count_params = []
        
        count_result = await db_manager.execute_one(count_query, *count_params)
        total_count = count_result["total"] if count_result else 0
        
        # Process documents
        processed_documents = []
        for doc in documents:
            processed_doc = {
                "id": doc["id"],
                "title": doc["title"],
                "source": doc["source"],
                "status": doc.get("status", "processed"),
                "metadata": doc.get("metadata", {}),
                "created_at": doc["created_at"].isoformat() if doc["created_at"] else None,
                "updated_at": doc["updated_at"].isoformat() if doc["updated_at"] else None,
            }
            
            if include_content:
                processed_doc["content"] = doc.get("content", "")
                processed_doc["content_length"] = len(doc.get("content", ""))
            
            processed_documents.append(processed_doc)
        
        return {
            "documents": processed_documents,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total_count,
            "filters": {
                "source": source_filter,
                "include_content": include_content
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        return error_response(500, "Failed to list documents", str(e))

@router.get("/documents/{document_id}")
@track_performance("get_document", "document_management")
async def get_document(
    document_id: int,
    include_content: bool = Query(default=True, description="Include document content in response"),
    _: bool = Depends(require_permission(Permission.READ_DOCUMENTS))
):
    """
    Get a specific document by ID
    """
    try:
        from ...core.database import db_manager
        
        # Build query
        query = "SELECT id, title, source, status, metadata, created_at, updated_at"
        if include_content:
            query += ", content"
        query += " FROM documents WHERE id = $1"
        
        # Execute query
        document = await db_manager.execute_one(query, document_id)
        
        if not document:
            return error_response(404, "Document not found")
        
        # Process document
        processed_doc = {
            "id": document["id"],
            "title": document["title"],
            "source": document["source"],
            "status": document.get("status", "processed"),
            "metadata": document.get("metadata", {}),
            "created_at": document["created_at"].isoformat() if document["created_at"] else None,
            "updated_at": document["updated_at"].isoformat() if document["updated_at"] else None,
        }
        
        if include_content:
            processed_doc["content"] = document.get("content", "")
            processed_doc["content_length"] = len(document.get("content", ""))
        
        return processed_doc
        
    except Exception as e:
        logger.error(f"Failed to get document {document_id}: {e}")
        return error_response(500, "Failed to get document", str(e))

@router.delete("/documents")
@track_performance("delete_all_documents", "document_management")
async def delete_all_documents(
    _: bool = Depends(require_permission(Permission.DELETE_DOCUMENTS))
):
    """
    Delete all documents (use with caution!)
    """
    try:
        from ...core.database import db_manager
        
        # Get count before deletion
        count_query = "SELECT COUNT(*) as total FROM documents"
        count_result = await db_manager.execute_one(count_query)
        total_documents = count_result["total"] if count_result else 0
        
        if total_documents == 0:
            return {
                "message": "No documents to delete",
                "deleted_count": 0,
                "status": "success"
            }
        
        # Delete all documents
        delete_query = "DELETE FROM documents"
        await db_manager.execute_query(delete_query)
        
        return {
            "message": f"Successfully deleted {total_documents} documents",
            "deleted_count": total_documents,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to delete all documents: {e}")
        return error_response(500, "Failed to delete all documents", str(e))

@router.delete("/documents/{document_id}")
@track_performance("delete_document", "document_management")
async def delete_document(
    document_id: int,
    _: bool = Depends(require_permission(Permission.DELETE_DOCUMENTS))
):
    """
    Delete a specific document by ID
    """
    try:
        from ...core.database import db_manager
        
        # First check if document exists
        check_query = "SELECT id, title FROM documents WHERE id = $1"
        document = await db_manager.execute_one(check_query, document_id)
        
        if not document:
            return error_response(404, "Document not found")
        
        # Delete the document
        delete_query = "DELETE FROM documents WHERE id = $1"
        await db_manager.execute_query(delete_query, document_id)
        
        return {
            "message": "Document deleted successfully",
            "deleted_document_id": document_id,
            "deleted_document_title": document["title"],
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to delete document {document_id}: {e}")
        return error_response(500, "Failed to delete document", str(e))

@router.get("/algorithms")
async def get_available_algorithms():
    """
    Get available search algorithms
    """
    algorithms = {}
    for algorithm in SearchAlgorithm:
        algorithms[algorithm.value] = _get_algorithm_description(algorithm)
    
    return {
        "algorithms": algorithms,
        "default": "hybrid"
    }

@router.get("/agent-types")
async def get_available_agent_types():
    """
    Get available agent types
    """
    agent_types = {}
    for agent_type in AgentType:
        agent_types[agent_type.value] = _get_agent_type_description(agent_type)
    
    return {
        "agent_types": agent_types,
        "default": "general"
    }

@router.get("/styles")
async def get_available_styles():
    """Get available response styles"""
    return {
        "styles": [
            {
                "name": "professional",
                "description": "Formal, business-like responses",
                "tone": "formal",
                "format": "structured"
            },
            {
                "name": "casual",
                "description": "Informal, conversational responses",
                "tone": "casual",
                "format": "conversational"
            },
            {
                "name": "technical",
                "description": "Technical, detailed responses",
                "tone": "technical",
                "format": "detailed"
            },
            {
                "name": "creative",
                "description": "Creative, imaginative responses",
                "tone": "creative",
                "format": "narrative"
            }
        ]
    }

@router.post("/cache/clear")
@track_performance("clear_cache", "cache_management")
async def clear_cache(
    _: bool = Depends(require_permission(Permission.CLEAR_CACHE))
):
    """
    Clear all cache entries
    """
    try:
        from ...services import cache
        
        # Clear cache using the correct method
        deleted = await cache.delete_pattern("*")
        
        return {
            "message": "Cache cleared successfully",
            "deleted": deleted,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return error_response(500, "Failed to clear cache", str(e))

@router.get("/health")
async def rag_health():
    """
    RAG system health check
    """
    try:
        health_status = {
            "status": "healthy",
            "components": {}
        }
        
        # Check RAG agent
        try:
            agent_health = await rag_agent.health_check()
            health_status["components"]["rag_agent"] = agent_health
        except Exception as e:
            health_status["components"]["rag_agent"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        # Check agent orchestrator
        try:
            orchestrator_health = await agent_orchestrator.health_check()
            health_status["components"]["agent_orchestrator"] = orchestrator_health
        except Exception as e:
            health_status["components"]["agent_orchestrator"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        # Check advanced RAG engine
        try:
            rag_engine_health = await advanced_rag_engine.health_check()
            health_status["components"]["advanced_rag_engine"] = rag_engine_health
        except Exception as e:
            health_status["components"]["advanced_rag_engine"] = {"status": "unhealthy", "error": str(e)}
            health_status["status"] = "degraded"
        
        return health_status
        
    except Exception as e:
        logger.error(f"RAG health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@router.post("/generate")
@track_performance("ai_generation", "generation_processing")
async def ai_generation(
    request: RAGQueryRequest,
    _: bool = Depends(require_permission(Permission.EXECUTE_QUERIES))
):
    """
    AI text generation endpoint
    """
    try:
        # Input validation
        query_text = sanitize_input(request.query)
        validation_result = validate_input(query_text)
        if not validation_result["is_safe"]:
            return error_response(400, "Invalid input", validation_result.get("reason", "Input failed validation."))
        
        # Use the RAG engine to generate a response
        result = await rag_engine.query(
            query=query_text,
            top_k=request.top_k or 5,
            use_agent=request.use_agent,
            algorithm=request.algorithm or "hybrid",
            similarity_threshold=request.similarity_threshold or 0.3
        )
        
        return {
            "generated_text": result["response"],
            "query": query_text,
            "metadata": result.get("metadata", {}),
            "processing_time": result.get("processing_time", 0)
        }
        
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        return error_response(500, "Generation failed", str(e))

# Helper functions
async def _generate_response_from_search_results(
    query: str,
    search_results: List[Any],
    session_id: Optional[str]
) -> Dict[str, Any]:
    """Generate response from search results"""
    try:
        # Extract context from search results (search_results is a list of documents)
        context = []
        for result in search_results:
            if isinstance(result, dict):
                context.append({
                    "content": result.get("content", ""),
                    "metadata": result.get("metadata", {}),
                    "score": result.get("score", 0.0)
                })
            else:
                # Handle case where result might be a Document object
                context.append({
                    "content": getattr(result, "content", ""),
                    "metadata": getattr(result, "metadata", {}),
                    "score": getattr(result, "score", 0.0)
                })
        
        # Generate response using AI
        response = await rag_agent.generate_response(
            query=query,
            context=context,
            session_id=session_id
        )
        
        return {
            "response": response,
            "query": query,
            "context": context,
            "source": "advanced_search",
            "response_time_ms": 0,
            "metadata": {}
        }
        
    except Exception as e:
        logger.error(f"Failed to generate response from search results: {e}")
        raise

async def _send_rag_webhook(
    callback_url: str,
    result: Dict[str, Any],
    session_id: Optional[str],
    webhook_secret: Optional[str]
):
    """Send webhook notification for RAG query completion"""
    try:
        await background_webhook_service.send_webhook(
            url=callback_url,
            data=result,
            secret=webhook_secret
        )
    except Exception as e:
        logger.error(f"Failed to send RAG webhook: {e}")

def _get_algorithm_description(algorithm: SearchAlgorithm) -> str:
    """Get description for search algorithm"""
    descriptions = {
        SearchAlgorithm.SEMANTIC: "Semantic similarity search using embeddings",
        SearchAlgorithm.KEYWORD: "Keyword-based search using TF-IDF",
        SearchAlgorithm.HYBRID: "Combined semantic and keyword search",
        SearchAlgorithm.FUZZY: "Fuzzy string matching search",
        SearchAlgorithm.CONTEXTUAL: "Context-aware search with query expansion"
    }
    return descriptions.get(algorithm, "Unknown algorithm")

def _get_agent_type_description(agent_type: AgentType) -> str:
    """Get description for agent type"""
    descriptions = {
        AgentType.GENERAL: "General-purpose agent for common queries",
        AgentType.ANALYTICAL: "Analytical agent for data analysis queries",
        AgentType.CREATIVE: "Creative agent for creative writing tasks",
        AgentType.TECHNICAL: "Technical agent for technical documentation",
        AgentType.RESEARCH: "Research agent for research and investigation"
    }
    return descriptions.get(agent_type, "Unknown agent type") 