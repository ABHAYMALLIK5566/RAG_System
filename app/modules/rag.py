"""
RAG Module

Handles all RAG (Retrieval-Augmented Generation) operations including:
- Core RAG engine
- Advanced RAG engine
- Agent orchestrator
- Similarity engine
"""

import asyncio
from typing import Dict, Any, Optional, List
from ..core.modules import BaseModule, ModuleConfig, ModuleStatus
from ..services import (
    rag_engine, 
    advanced_rag_engine, 
    agent_orchestrator,
    similarity_engine
)
import structlog

logger = structlog.get_logger(__name__)


class RAGModule(BaseModule):
    """RAG management module"""
    
    def __init__(self, config: ModuleConfig):
        super().__init__(config)
        self._core_rag_ready = False
        self._advanced_rag_ready = False
        self._agents_ready = False
        self._similarity_ready = False
    
    async def initialize(self) -> None:
        """Initialize RAG components"""
        self._set_status(ModuleStatus.INITIALIZING)
        errors = []
        try:
            # Initialize core RAG engine
            try:
                await self._initialize_core_rag()
            except Exception as e:
                errors.append(f"core_rag: {e}")
            # Initialize advanced RAG engine
            try:
                await self._initialize_advanced_rag()
            except Exception as e:
                errors.append(f"advanced_rag: {e}")
            # Initialize agent orchestrator
            try:
                await self._initialize_agents()
            except Exception as e:
                errors.append(f"agents: {e}")
            # Initialize similarity engine
            try:
                await self._initialize_similarity()
            except Exception as e:
                errors.append(f"similarity: {e}")
            if errors:
                self._set_status(ModuleStatus.DEGRADED, "; ".join(errors))
                logger.warning(f"RAG module initialized with errors: {errors}")
            else:
                self._set_status(ModuleStatus.ACTIVE)
                logger.info("RAG module initialized successfully")
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Failed to initialize RAG module: {e}")
            raise
    
    async def shutdown(self) -> None:
        """Shutdown RAG components"""
        self._set_status(ModuleStatus.SHUTTING_DOWN)
        try:
            # Shutdown components in reverse order
            if self._similarity_ready:
                await self._shutdown_similarity()
            if self._agents_ready:
                await self._shutdown_agents()
            if self._advanced_rag_ready:
                await self._shutdown_advanced_rag()
            if self._core_rag_ready:
                await self._shutdown_core_rag()
            self._set_status(ModuleStatus.SHUTDOWN)
            logger.info("RAG module shut down successfully")
        except Exception as e:
            self._set_status(ModuleStatus.ERROR, str(e))
            logger.error(f"Error shutting down RAG module: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check RAG components health"""
        try:
            components = {
                "core_rag": self._core_rag_ready,
                "advanced_rag": self._advanced_rag_ready,
                "agents": self._agents_ready,
                "similarity": self._similarity_ready
            }
            healthy_components = sum(components.values())
            total_components = len(components)
            status = "healthy" if healthy_components == total_components else ("degraded" if healthy_components > 0 else "unhealthy")
            return {
                "status": status,
                "name": self.name,
                "components": components,
                "healthy_components": healthy_components,
                "total_components": total_components
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "name": self.name,
                "error": str(e)
            }
    
    async def _initialize_core_rag(self) -> None:
        """Initialize core RAG engine"""
        try:
            # Test if rag_engine is properly imported and initialized
            logger.info(f"Testing rag_engine import: {rag_engine is not None}")
            logger.info(f"rag_engine type: {type(rag_engine)}")
            logger.info(f"rag_engine openai_client: {rag_engine.openai_client is not None}")
            
            # Test a simple operation to ensure it's working
            stats = await rag_engine.get_stats()
            logger.info(f"RAG engine stats: {stats}")
            
            self._core_rag_ready = True
            logger.info("Core RAG engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize core RAG engine: {e}")
            raise
    
    async def _initialize_advanced_rag(self) -> None:
        """Initialize advanced RAG engine"""
        try:
            self._advanced_rag_ready = True
        except Exception as e:
            logger.error(f"Failed to initialize advanced RAG engine: {e}")
            raise
    
    async def _initialize_agents(self) -> None:
        """Initialize agent orchestrator"""
        try:
            self._agents_ready = True
        except Exception as e:
            logger.error(f"Failed to initialize agent orchestrator: {e}")
            raise
    
    async def _initialize_similarity(self) -> None:
        """Initialize similarity engine"""
        try:
            self._similarity_ready = True
        except Exception as e:
            logger.error(f"Failed to initialize similarity engine: {e}")
            raise
    
    async def _shutdown_core_rag(self) -> None:
        self._core_rag_ready = False
    
    async def _shutdown_advanced_rag(self) -> None:
        self._advanced_rag_ready = False
    
    async def _shutdown_agents(self) -> None:
        self._agents_ready = False
    
    async def _shutdown_similarity(self) -> None:
        self._similarity_ready = False
    
    # RAG interface methods
    async def query(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute RAG query"""
        # Example: fallback logic if one engine is down
        if self._advanced_rag_ready:
            try:
                return await advanced_rag_engine.query(query, **kwargs)
            except Exception as e:
                logger.warning(f"Advanced RAG engine failed, falling back: {e}")
        if self._core_rag_ready:
            return await rag_engine.query(query, **kwargs)
        raise RuntimeError("No RAG engine available")
    
    async def advanced_query(self, query: str, **kwargs) -> Dict[str, Any]:
        if self._advanced_rag_ready:
            return await advanced_rag_engine.query(query, **kwargs)
        raise RuntimeError("Advanced RAG engine not available")
    
    async def multi_agent_query(self, query: str, **kwargs) -> Dict[str, Any]:
        if self._agents_ready:
            return await agent_orchestrator.execute_multi_agent_query(query, **kwargs)
        raise RuntimeError("Agent orchestrator not available")
    
    async def search(self, query: str, algorithm: str = "semantic", **kwargs) -> List[Dict[str, Any]]:
        if self._similarity_ready:
            return await similarity_engine.search(query, algorithm=algorithm, **kwargs)
        raise RuntimeError("Similarity engine not available")
    
    async def generate_embedding(self, text: str) -> List[float]:
        if self._similarity_ready:
            return await similarity_engine.generate_embedding(text)
        raise RuntimeError("Similarity engine not available")
    
    async def find_similar(self, embedding: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if self._similarity_ready:
            return await similarity_engine.find_similar(embedding, limit=limit)
        raise RuntimeError("Similarity engine not available")
    
    async def generate_response(self, prompt: str, **kwargs) -> str:
        # Use agent orchestrator if available, else fallback
        if self._agents_ready:
            return await agent_orchestrator.generate_response(prompt, **kwargs)
        if self._core_rag_ready:
            return await rag_engine.generate_response(prompt, **kwargs)
        raise RuntimeError("No response generator available") 