from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Float
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from datetime import datetime
from typing import Dict, Any, List, Optional

Base = declarative_base()

class Document(Base):
    """Document model for storing text content with vector embeddings"""
    
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False, index=True)
    title = Column(String(500), nullable=True, index=True)
    source = Column(String(255), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="processed", index=True)  # pending, processing, processed, error
    doc_metadata = Column("metadata", JSON, nullable=True)
    embedding = Column(Vector(1536), nullable=True)  # OpenAI embedding dimension
    similarity_score = Column(Float, nullable=True)  # For search results
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', source='{self.source}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "content": self.content,
            "title": self.title,
            "source": self.source,
            "status": self.status,
            "metadata": self.doc_metadata,
            "similarity_score": self.similarity_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class ConversationHistory(Base):
    """Store conversation history for agent context"""
    
    __tablename__ = "conversation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    user_query = Column(Text, nullable=False)
    assistant_response = Column(Text, nullable=False)
    rag_context = Column(JSON, nullable=True)  # Store RAG results used
    agent_tools_used = Column(JSON, nullable=True)  # Track tool usage
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<ConversationHistory(id={self.id}, session_id='{self.session_id}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_query": self.user_query,
            "assistant_response": self.assistant_response,
            "rag_context": self.rag_context,
            "agent_tools_used": self.agent_tools_used,
            "response_time_ms": self.response_time_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None
        } 