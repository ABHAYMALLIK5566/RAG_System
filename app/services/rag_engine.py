import asyncio
import logging
import json
import re
import time
import uuid
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import random

try:
    from openai import AsyncOpenAI
    import tiktoken
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    AsyncOpenAI = None
    tiktoken = None

from ..core.config import settings
from ..core.database import db_manager
from .cache import rag_cache, cache
from ..services.similarity_engine import similarity_engine

logger = logging.getLogger(__name__)

class TokenManager:
    """Manages token counting and text chunking"""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo"):
        self.encoder = None
        if tiktoken:
            try:
                self.encoder = tiktoken.encoding_for_model(model_name)
            except Exception:
                try:
                    # Fallback to a default encoding
                    self.encoder = tiktoken.get_encoding("cl100k_base")
                except Exception:
                    self.encoder = None
        
        self.max_tokens = 8000  # Conservative limit for GPT-3.5-turbo
        self.reserved_tokens = 1000  # Reserve for response
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        if self.encoder:
            try:
                return len(self.encoder.encode(text))
            except Exception:
                pass
        
        # Fallback to word-based estimation
        return int(len(text.split()) * 1.3)
    
    def chunk_text(self, text: str, max_chunk_tokens: int = 3000) -> List[str]:
        """Split text into chunks that fit within token limits"""
        if self.count_tokens(text) <= max_chunk_tokens:
            return [text]
        
        # Split by paragraphs first
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            paragraph_tokens = self.count_tokens(paragraph)
            
            # If single paragraph is too long, split by sentences
            if paragraph_tokens > max_chunk_tokens:
                sentences = self._split_into_sentences(paragraph)
                for sentence in sentences:
                    if self.count_tokens(current_chunk + sentence) <= max_chunk_tokens:
                        current_chunk += sentence + " "
                    else:
                        if current_chunk.strip():
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence + " "
            else:
                # Check if adding this paragraph exceeds limit
                if self.count_tokens(current_chunk + paragraph) <= max_chunk_tokens:
                    current_chunk += paragraph + "\n\n"
                else:
                    if current_chunk.strip():
                        chunks.append(current_chunk.strip())
                    current_chunk = paragraph + "\n\n"
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting - could be improved with NLTK
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() + '.' for s in sentences if s.strip()]
    
    def truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token limit"""
        if self.count_tokens(text) <= max_tokens:
            return text
        
        # Binary search for the right length
        words = text.split()
        left, right = 0, len(words)
        
        while left < right:
            mid = (left + right + 1) // 2
            truncated = ' '.join(words[:mid])
            
            if self.count_tokens(truncated) <= max_tokens:
                left = mid
            else:
                right = mid - 1
        
        return ' '.join(words[:left]) + "..."

class RAGEngine:
    """Enhanced RAG Engine with token management and optimization"""
    
    def __init__(self):
        # Initialize OpenAI client only if API key is available
        self.openai_client = None
        
        # Debug logging for initialization
        logger.info(f"[RAGEngine] Initializing RAG engine...")
        logger.info(f"[RAGEngine] HAS_OPENAI: {HAS_OPENAI}")
        logger.info(f"[RAGEngine] AsyncOpenAI available: {AsyncOpenAI is not None}")
        logger.info(f"[RAGEngine] OpenAI API key set: {bool(settings.openai_api_key)}")
        logger.info(f"[RAGEngine] OpenAI API key length: {len(settings.openai_api_key) if settings.openai_api_key else 0}")
        print(f"[RAGEngine] __init__ called. HAS_OPENAI={HAS_OPENAI}, AsyncOpenAI={AsyncOpenAI is not None}, OpenAI API key set={bool(settings.openai_api_key)}")
        
        if HAS_OPENAI and AsyncOpenAI and settings.openai_api_key and settings.openai_api_key.strip():
            try:
                self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
                logger.info("[RAGEngine] OpenAI client initialized successfully")
                print("[RAGEngine] OpenAI client initialized successfully")
            except Exception as e:
                logger.error(f"[RAGEngine] OpenAI client initialization failed: {e}")
                print(f"[RAGEngine] OpenAI client initialization failed: {e}")
        else:
            if not HAS_OPENAI:
                logger.warning("[RAGEngine] OpenAI package not installed, using text-based similarity only")
                print("[RAGEngine] OpenAI package not installed, using text-based similarity only")
            elif not settings.openai_api_key:
                logger.warning("[RAGEngine] OpenAI API key not provided, using text-based similarity only")
                print("[RAGEngine] OpenAI API key not provided, using text-based similarity only")
            else:
                logger.warning("[RAGEngine] OpenAI API key is empty or whitespace only")
                print("[RAGEngine] OpenAI API key is empty or whitespace only")
        
        self.tokenizer = tiktoken.get_encoding("cl100k_base") if HAS_OPENAI and tiktoken else None
        self.embedding_model = getattr(settings, 'openai_embedding_model', 'text-embedding-ada-002')
        self.max_tokens = getattr(settings, 'rag_max_tokens', 8000)  # Increased from 4000
        self.similarity_threshold = 0.05  # Lower threshold for better matching
        self.max_context_length = 8000  # Increased from 4000
        self.top_k = getattr(settings, 'rag_top_k', 5)
        self.default_top_k = 5
        self.token_manager = TokenManager()
        
        # Query optimization settings
        self.max_query_length = 1000  # Increased from 500
        self.max_context_tokens = 6000  # Increased from 3000
        self.chunk_overlap = 100  # Overlap between chunks in characters
        
        # Agent executor (will be set by dependency injection)
        self.agent_executor = None
    
    def _clean_text(self, text: str) -> str:
        """Clean and preprocess text for embedding generation"""
        
        if not text:
            return ""
        
        # Basic text cleaning
        text = str(text)
        text = text.strip()
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Truncate if too long (OpenAI has token limits)
        if len(text) > 8000:  # Conservative limit
            text = text[:8000] + "..."
        
        return text
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for text with caching"""
        # Check cache first
        cached_embedding = await rag_cache.get_embedding(text)
        if cached_embedding:
            return cached_embedding
        
        # If OpenAI client is not available, return a dummy embedding for development
        if not self.openai_client:
            # Return a dummy embedding of appropriate size (silently)
            logger.warning("OpenAI client not available; using dummy embedding")
            return [random.uniform(-0.01, 0.01) for _ in range(1536)]  # Standard OpenAI embedding size
        
        try:
            # Clean and prepare text
            cleaned_text = self._clean_text(text)
            
            # Get embedding from OpenAI using the configured model
            response = await self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=cleaned_text
            )
            
            embedding = response.data[0].embedding
            
            # Cache the embedding
            await rag_cache.cache_embedding(text, embedding)
            
            return embedding
            
        except Exception as e:
            logger.info(f"OpenAI embedding failed, using dummy embedding")
            # Return dummy embedding instead of raising error
            return [0.0] * 1536
    
    async def similarity_search(
        self, 
        query: str, 
        top_k: int = 5,
        similarity_threshold: Optional[float] = None,
        algorithm: str = "hybrid"
    ) -> List[Dict[str, Any]]:
        """Enhanced similarity search with multiple algorithms"""
        
        try:
            # Use default threshold if not provided
            if similarity_threshold is None:
                similarity_threshold = self.similarity_threshold
            
            # Check cache first
            cache_key = f"similarity_search:{hash(query)}:{top_k}:{algorithm}"
            cached_result = await cache.get(cache_key)
            if cached_result:
                logger.info("Returning cached similarity search result")
                return cached_result
            
            # Get all documents from database
            documents = await self._get_all_documents()
            
            if not documents:
                logger.warning("No documents found in database")
                return []
            
            logger.info(f"Retrieved {len(documents)} documents from database")
            logger.info(f"Query: '{query}', Algorithm: {algorithm}, Threshold: {similarity_threshold}")
            
            # Choose similarity algorithm
            if algorithm == "tfidf":
                similarities = similarity_engine.calculate_tf_idf_similarity(query, documents)
            elif algorithm == "jaccard":
                similarities = similarity_engine.calculate_jaccard_similarity(query, documents)
            elif algorithm == "semantic":
                similarities = similarity_engine.calculate_semantic_similarity(query, documents)
            else:  # hybrid (default)
                similarities = similarity_engine.calculate_hybrid_similarity(query, documents)
            
            # Debug: Log similarity scores
            for i, (doc, score) in enumerate(similarities[:3]):  # Log top 3
                logger.info(f"Document {i+1}: '{doc.get('title', 'No title')}' - Score: {score:.4f}")
            
            # Rank and filter results
            results = similarity_engine.rank_documents(
                similarities, 
                top_k=top_k, 
                similarity_threshold=similarity_threshold
            )
            
            # Cache results
            await cache.set(cache_key, results, ttl=300)  # 5 minutes
            
            logger.info(f"Found {len(results)} similar documents using {algorithm} algorithm")
            return results
            
        except Exception as e:
            logger.error(f"Error in similarity search: {str(e)}")
            return []
    
    async def _get_all_documents(self) -> List[Dict[str, Any]]:
        """Get all documents from the database"""
        
        try:
            # PostgreSQL version - handle null embeddings
            query = "SELECT id, title, content, metadata, embedding FROM documents WHERE content IS NOT NULL AND content != ''"
            rows = await db_manager.execute_query(query)
            
            documents = []
            for row in rows:
                # Skip documents with null content
                if not row['content'] or row['content'].strip() == '':
                    continue
                    
                documents.append({
                    'id': row['id'],
                    'title': row['title'] or 'Untitled',
                    'content': row['content'],
                    'metadata': row['metadata'] or {},
                    'embedding': row['embedding']  # Can be null for text-based similarity
                })
            
            logger.info(f"Retrieved {len(documents)} valid documents from database")
            return documents
        
        except Exception as e:
            logger.error(f"Error retrieving documents: {str(e)}")
            return []
    
    async def add_document(
        self, 
        title: str, 
        content: str, 
        metadata: Optional[Dict[str, Any]] = None,
        doc_type: str = "document"
    ) -> str:
        """Add a single document to the knowledge base"""
        
        try:
            # Input validation
            if not title or not title.strip():
                raise ValueError("Document title cannot be empty")
            
            if not content or not content.strip():
                raise ValueError("Document content cannot be empty")
            
            # Clean inputs
            title = title.strip()[:500]  # Limit title length
            content = self._clean_text(content)
            
            # Token validation for content
            content_tokens = self.token_manager.count_tokens(content)
            
            # If content is too long, split into chunks
            if content_tokens > 6000:  # Conservative limit for embedding models
                logger.info(f"Document content ({content_tokens} tokens) is large, will chunk if needed")
                
                # For now, truncate to manageable size
                if content_tokens > 10000:
                    content = self.token_manager.truncate_to_tokens(content, 6000)
                    logger.warning("Document content truncated due to token limit")
            
            # Proceed with existing document addition logic
            if metadata is None:
                metadata = {}
            
            # Add token count to metadata
            metadata['token_count'] = self.token_manager.count_tokens(content)
            metadata['char_count'] = len(content)
            
            metadata.update({
                "doc_type": doc_type,
                "created_at": datetime.utcnow().isoformat(),
                "word_count": len(content.split()),
                "title_length": len(title)
            })
            
            # Convert metadata to JSON string for PostgreSQL
            metadata_json = json.dumps(metadata)
            
            # Try to generate embeddings
            embeddings = await self._generate_embeddings(content + " " + title)
            
            # Convert embeddings to JSON string for PostgreSQL
            embeddings_json = json.dumps(embeddings) if embeddings else json.dumps([])
            
            # Get database connection
            async with db_manager.get_connection() as conn:
                # PostgreSQL version
                query = """
                INSERT INTO documents (title, content, status, metadata, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                """
                result = await conn.fetchrow(query, 
                    title, content, "processed", metadata_json, embeddings_json, datetime.utcnow()
                )
                doc_id = str(result['id'])
            
            logger.info(f"Successfully added document: {doc_id}")
            return doc_id
            
        except Exception as e:
            logger.error(f"Error adding document: {str(e)}")
            raise

    async def add_documents_bulk(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Add multiple documents to the knowledge base efficiently"""
        
        try:
            doc_ids = []
            
            async with db_manager.get_connection() as conn:
                for doc_data in documents:
                    title = doc_data.get('title', '')
                    content = doc_data.get('content', '')
                    metadata = doc_data.get('metadata', {})
                    doc_type = doc_data.get('type', 'document')
                    
                    # Update metadata
                    metadata.update({
                        "doc_type": doc_type,
                        "created_at": datetime.utcnow().isoformat(),
                        "word_count": len(content.split()),
                        "title_length": len(title)
                    })
                    
                    # Convert metadata to JSON string for PostgreSQL
                    metadata_json = json.dumps(metadata)
                    
                    # Generate embeddings
                    embeddings = await self._generate_embeddings(content + " " + title)
                    
                    # Convert embeddings to JSON string for PostgreSQL
                    embeddings_json = json.dumps(embeddings) if embeddings else json.dumps([])
                    
                    # Insert document - PostgreSQL version
                    query = """
                    INSERT INTO documents (title, content, status, metadata, embedding, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                    """
                    result = await conn.fetchrow(query, 
                        title, content, "processed", metadata_json, embeddings_json, datetime.utcnow()
                    )
                    doc_id = str(result['id'])
                    doc_ids.append(doc_id)
            
            logger.info(f"Successfully added {len(doc_ids)} documents in bulk")
            return doc_ids
            
        except Exception as e:
            logger.error(f"Error in bulk document addition: {str(e)}")
            raise

    async def query(
        self, 
        query: str, 
        top_k: int = 5, 
        use_agent: bool = False, 
        algorithm: str = "hybrid",
        similarity_threshold: float = 0.3
    ) -> Dict[str, Any]:
        """Enhanced query with input validation and optimization"""
        
        start_time = time.time()
        
        # Query result caching
        cached_result = await rag_cache.get_rag_query(query, algorithm)
        if cached_result is not None:
            logger.info(f"Cache hit for query: {query} with algorithm: {algorithm}")
            return cached_result
        
        try:
            # Input validation and optimization
            validated_query = self._validate_and_optimize_query(query)
            validated_top_k = self._validate_top_k(top_k)
            
            # Optimized search with reduced top_k for speed
            optimized_top_k = min(validated_top_k, 3)  # Reduce for speed
            
            # Search for relevant documents
            if algorithm == "hybrid":
                search_results = await self.hybrid_search(validated_query, optimized_top_k, similarity_threshold)
            elif algorithm == "semantic":
                search_results = await self.semantic_search(validated_query, optimized_top_k, similarity_threshold)
            elif algorithm == "tfidf":
                search_results = await self.tfidf_search(validated_query, optimized_top_k)
            else:
                search_results = await self.jaccard_search(validated_query, optimized_top_k)
            
            # Prepare context with token management
            context = self._prepare_optimized_context(search_results)
            
            # Generate response using the proper generate_response method
            if use_agent and self.agent_executor and hasattr(self.agent_executor, 'process_query'):
                try:
                    # Agent executor functionality temporarily disabled
                    logger.info("Agent executor functionality temporarily disabled")
                    response_obj = await self.generate_response(validated_query, context)
                    response = response_obj.get('response', 'No response generated')
                except Exception as e:
                    logger.warning(f"Agent execution failed, using fallback: {e}")
                    response_obj = await self.generate_response(validated_query, context)
                    response = response_obj.get('response', 'No response generated')
            else:
                response_obj = await self.generate_response(validated_query, context)
                response = response_obj.get('response', 'No response generated')
            
            processing_time = time.time() - start_time
            
            result = {
                "query": validated_query,
                "response": response,
                "context": context,
                "sources": search_results,
                "algorithm": algorithm,
                "processing_time": processing_time,
                "optimization": "speed",
                "token_usage": {
                    "query_tokens": self.token_manager.count_tokens(validated_query),
                    "context_tokens": self.token_manager.count_tokens(context),
                    "total_input_tokens": self.token_manager.count_tokens(validated_query + context)
                }
            }
            # Cache the result
            await rag_cache.cache_rag_query(query, result, algorithm, ttl=3600)
            return result
            
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            return {
                "query": query,
                "response": f"I apologize, but I encountered an error processing your query. Please try a shorter or simpler question.",
                "context": "",
                "sources": [],
                "algorithm": algorithm,
                "processing_time": time.time() - start_time,
                "error": str(e)
            }
    
    def _validate_and_optimize_query(self, query: str) -> str:
        """Validate and optimize query input"""
        
        # Handle None or empty queries gracefully
        if not query:
            logger.warning("Query is None or empty, using default")
            return "search"
        
        if not query.strip():
            logger.warning("Query is empty after stripping, using default")
            return "search"
        
        # Clean and normalize query
        cleaned_query = query.strip()
        
        # Remove excessive whitespace
        cleaned_query = re.sub(r'\s+', ' ', cleaned_query)
        
        # Extract key terms from questions BEFORE removing punctuation
        # Common question patterns
        question_patterns = [
            r'what is (.+?)(?:\?|$)',
            r'what are (.+?)(?:\?|$)',
            r'what does (.+?) mean(?:\?|$)',
            r'what do you mean by (.+?)(?:\?|$)',
            r'can you explain (.+?)(?:\?|$)',
            r'how does (.+?) work(?:\?|$)',
            r'define (.+?)(?:\?|$)',
            r'tell me about (.+?)(?:\?|$)'
        ]
        
        # Try to extract key terms from questions
        question_matched = False
        for pattern in question_patterns:
            match = re.search(pattern, cleaned_query, re.IGNORECASE)
            if match:
                extracted_term = match.group(1).strip()
                logger.info(f"Extracted key term from question: '{extracted_term}' from '{cleaned_query}'")
                cleaned_query = extracted_term
                question_matched = True
                break
        
        # Remove question marks and other punctuation only if no question pattern was matched
        if not question_matched:
            cleaned_query = re.sub(r'[?.,!;:]', '', cleaned_query)
        
        # Handle very short queries by expanding them
        if len(cleaned_query) <= 2:
            logger.info(f"Very short query: '{cleaned_query}', expanding...")
            # For very short queries, try to find partial matches in document titles
            if cleaned_query.upper() in ["AI", "ML", "NLP"]:
                if cleaned_query.upper() == "AI":
                    cleaned_query = "Artificial Intelligence"
                elif cleaned_query.upper() == "ML":
                    cleaned_query = "Machine Learning"
                elif cleaned_query.upper() == "NLP":
                    cleaned_query = "Natural Language Processing"
                logger.info(f"Expanded short query to: '{cleaned_query}'")
        
        # Truncate if too long
        if len(cleaned_query) > self.max_query_length:
            logger.warning(f"Query truncated from {len(cleaned_query)} to {self.max_query_length} characters")
            cleaned_query = cleaned_query[:self.max_query_length] + "..."
        
        # Check token count
        query_tokens = self.token_manager.count_tokens(cleaned_query)
        if query_tokens > 500:  # More generous token limit
            logger.warning(f"Query has {query_tokens} tokens, truncating")
            cleaned_query = self.token_manager.truncate_to_tokens(cleaned_query, 500)
        
        logger.info(f"Optimized query: '{query}' -> '{cleaned_query}'")
        return cleaned_query
    
    def _validate_top_k(self, top_k: int) -> int:
        """Validate and optimize top_k parameter"""
        
        if top_k < 0:
            logger.warning("top_k cannot be negative, setting to 1")
            return 1
        
        if top_k == 0:
            logger.info("top_k is 0, returning minimal result")
            return 1  # Return at least one result for processing
        
        if top_k > 50:
            logger.warning("top_k too high, limiting to 50")
            return 50
        
        return top_k
    
    def _prepare_optimized_context(self, search_results: List[Dict]) -> str:
        """Prepare context with token optimization"""
        
        if not search_results:
            return "No relevant context found."
        
        context_parts = []
        total_tokens = 0
        
        for i, result in enumerate(search_results):
            # Format context entry
            title = result.get('title', f'Document {i+1}')
            content = result.get('content', result.get('text', ''))
            
            # Create context entry
            entry = f"**{title}**\n{content}\n"
            entry_tokens = self.token_manager.count_tokens(entry)
            
            # Check if adding this entry would exceed token limit
            if total_tokens + entry_tokens > self.max_context_tokens:
                # Try to fit a truncated version
                remaining_tokens = self.max_context_tokens - total_tokens - 50  # Buffer
                if remaining_tokens > 100:  # Only if we have reasonable space
                    truncated_content = self.token_manager.truncate_to_tokens(content, remaining_tokens)
                    truncated_entry = f"**{title}**\n{truncated_content}\n"
                    context_parts.append(truncated_entry)
                break
            else:
                context_parts.append(entry)
                total_tokens += entry_tokens
        
        context = '\n'.join(context_parts)
        
        # Final token check
        final_tokens = self.token_manager.count_tokens(context)
        if final_tokens > self.max_context_tokens:
            context = self.token_manager.truncate_to_tokens(context, self.max_context_tokens)
        
        return context
    
    async def _generate_basic_response(self, query: str, context: str) -> str:
        """Generate basic response without agent"""
        if not context or context == "No relevant context found.":
            return f"I don't have enough information to answer '{query}'. Please add relevant documents to the knowledge base."
        
        # Simple context-based response - return full context without truncation
        return f"Based on the available information:\n\n{context}"
    
    async def _generate_fallback_response(self, query: str, context: str) -> str:
        """Generate fallback response when agent fails"""
        return await self._generate_basic_response(query, context)

    async def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.3
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search combining semantic and lexical similarity"""
        
        try:
            # Use the similarity engine's hybrid approach
            search_results = await self.similarity_search(
                query=query,
                top_k=top_k,
                similarity_threshold=similarity_threshold,
                algorithm="hybrid"
            )
            
            # Add combined_score for compatibility
            for result in search_results:
                result['combined_score'] = result.get('similarity_score', 0)
                result['source'] = f"Document {result.get('id', 'Unknown')}"
            
            return search_results
            
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            return []

    async def semantic_search(self, query: str, top_k: int = 5, similarity_threshold: float = 0.3) -> List[Dict[str, Any]]:
        """Semantic search using embeddings"""
        return await self.similarity_search(query, top_k, similarity_threshold, "semantic")
    
    async def tfidf_search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """TF-IDF based search"""
        return await self.similarity_search(query, top_k, algorithm="tfidf")
    
    async def jaccard_search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Jaccard similarity search"""
        return await self.similarity_search(query, top_k, algorithm="jaccard")

    async def get_context(
        self, 
        query: str, 
        max_tokens: Optional[int] = None,
        include_metadata: bool = True
    ) -> str:
        """Get relevant context for a query with improved relevance"""
        
        try:
            if max_tokens is None:
                max_tokens = self.max_context_length
            
            # Get similar documents
            similar_docs = await self.similarity_search(query, top_k=8)  # Get more for better context
            
            if not similar_docs:
                return "No relevant context found."
            
            # Build context with smart truncation
            context_parts = []
            current_length = 0
            
            for doc in similar_docs:
                # Format document with metadata
                doc_text = f"**{doc.get('title', 'Untitled')}**\n"
                
                if include_metadata and doc.get('similarity_score'):
                    doc_text += f"*Relevance: {doc['similarity_score']:.2f}*\n"
                
                doc_content = doc.get('content', '')
                
                # Smart content truncation
                if current_length + len(doc_text) + len(doc_content) > max_tokens:
                    remaining_tokens = max_tokens - current_length - len(doc_text)
                    if remaining_tokens > 100:  # Only include if we have meaningful space
                        doc_content = doc_content[:remaining_tokens] + "..."
                    else:
                        break
                
                doc_text += doc_content + "\n\n"
                context_parts.append(doc_text)
                current_length += len(doc_text)
                
                if current_length >= max_tokens:
                    break
            
            context = "".join(context_parts).strip()
            
            if not context:
                return "No relevant context found."
            
            # Add context header
            header = f"**Relevant Information** (from {len(context_parts)} sources):\n\n"
            return header + context
            
        except Exception as e:
            logger.error(f"Error getting context: {str(e)}")
            return "Error retrieving context."

    async def generate_response(
        self, 
        query: str, 
        context: Optional[str] = None,
        include_sources: bool = True,
        response_style: str = "comprehensive"
    ) -> Dict[str, Any]:
        """Generate AI response with enhanced context awareness"""
        
        try:
            # Get context if not provided
            if context is None:
                context = await self.get_context(query)

            # STRICT ENFORCEMENT: If no context, do NOT call LLM
            if not context or context.strip() == "" or context.strip() == "No relevant context found.":
                response = f"I don't have enough information to answer your question about '{query}'. Please upload relevant documents to the knowledge base."
                return {
                    "response": response,
                    "context_used": context,
                    "sources": [],
                    "query": query,
                    "response_style": response_style,
                    "timestamp": datetime.utcnow().isoformat(),
                    "note": "No LLM call: insufficient context"
                }

            # Check if we have OpenAI available
            if not self.openai_client:
                logger.warning("OpenAI client not available, generating rule-based response")
                return await self._generate_rule_based_response(query, context, include_sources)
            
            # Prepare system prompt based on response style
            system_prompts = {
                "comprehensive": """You are a knowledgeable assistant that provides detailed, comprehensive responses based on the given context. \
                Analyze the context thoroughly and provide a well-structured answer that addresses all aspects of the question.\
                Include relevant details, examples, and explanations where appropriate.""",
                
                "concise": """You are a precise assistant that provides clear, concise responses based on the given context.\
                Focus on directly answering the question with the most relevant information. Be brief but complete.""",
                
                "educational": """You are an educational assistant that provides informative responses with explanations.\
                Break down complex topics, provide context, and explain concepts in an easy-to-understand manner.\
                Include examples and practical applications where relevant."""
            }
            
            system_prompt = system_prompts.get(response_style, system_prompts["comprehensive"])
            
            # Create the full prompt
            full_prompt = f"""Context Information:\n{context}\n\nQuestion: {query}\n\nPlease provide a response based on the context information above. If the context doesn't contain enough information to fully answer the question, indicate what information is available and what might be missing."""
            
            # Generate response using OpenAI
            response_obj = await self.openai_client.chat.completions.create(
                model='gpt-3.5-turbo',
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                max_tokens=2000,  # Increased from 1000
                temperature=0.7
            )
            response = response_obj.choices[0].message.content
            
            # Extract sources if requested
            sources = []
            if include_sources and context != "No relevant context found.":
                sources = await self._extract_sources_from_context(context)
            
            return {
                "response": response,
                "context_used": context,
                "sources": sources,
                "query": query,
                "response_style": response_style,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return await self._generate_rule_based_response(query, context or "", include_sources)

    async def _generate_rule_based_response(
        self, 
        query: str, 
        context: str,
        include_sources: bool = True
    ) -> Dict[str, Any]:
        """Generate a rule-based response when AI is not available"""
        
        try:
            if context == "No relevant context found." or not context:
                response = f"I don't have enough information to answer your question about '{query}'. Please try rephrasing your question or adding more documents to the knowledge base."
            else:
                # Extract key information from context
                response = f"Based on the available information, here's what I found regarding '{query}':\n\n"
                
                # Add context summary - include more content and format it better
                context_lines = context.split('\n')
                relevant_lines = [line for line in context_lines if line.strip() and not line.startswith('*')]
                
                if relevant_lines:
                    # Include more lines and format them better
                    response += "\n".join(relevant_lines[:15])  # Increased from 5 to 15 lines
                    if len(relevant_lines) > 15:
                        response += "\n\n[Additional information is available in the knowledge base.]"
            
            # Extract sources
            sources = []
            if include_sources and context != "No relevant context found.":
                sources = await self._extract_sources_from_context(context)
            
            return {
                "response": response,
                "context_used": context,
                "sources": sources,
                "query": query,
                "response_style": "fallback",
                "timestamp": datetime.utcnow().isoformat(),
                "note": "Response generated without AI assistance"
            }
            
        except Exception as e:
            logger.error(f"Error in fallback response generation: {str(e)}")
            return {
                "response": "I apologize, but I'm unable to process your request at the moment.",
                "context_used": "",
                "sources": [],
                "query": query,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def _extract_sources_from_context(self, context: str) -> List[Dict[str, str]]:
        """Extract source information from context"""
        
        sources = []
        try:
            lines = context.split('\n')
            current_title = None
            
            for line in lines:
                line = line.strip()
                if line.startswith('**') and line.endswith('**'):
                    # This is a title
                    current_title = line.strip('*')
                elif line.startswith('*Relevance:') and current_title:
                    # Extract relevance score
                    relevance = line.split(':')[1].strip().rstrip('*')
                    sources.append({
                        "title": current_title,
                        "relevance": relevance
                    })
                    current_title = None
        
        except Exception as e:
            logger.error(f"Error extracting sources: {str(e)}")
        
        return sources

    async def _generate_embeddings(self, text: str) -> Optional[List[float]]:
        """Generate embeddings with token validation"""
        
        # Use the get_embedding method which has proper fallback logic
        return await self.get_embedding(text)

    async def get_stats(self) -> Dict[str, Any]:
        """Get RAG engine statistics"""
        
        try:
            async with db_manager.get_connection() as conn:
                # Get document count
                count_query = "SELECT COUNT(*) FROM documents"
                result = await conn.fetchval(count_query)
                document_count = result if result else 0
                
                # Get document types - PostgreSQL version
                types_query = """
                SELECT metadata->>'doc_type' as doc_type, COUNT(*) as count
                FROM documents 
                WHERE metadata->>'doc_type' IS NOT NULL
                GROUP BY metadata->>'doc_type'
                """
                
                type_rows = await conn.fetch(types_query)
                
                doc_types = {}
                for row in type_rows:
                    doc_types[row['doc_type']] = row['count']
                
                return {
                    "total_documents": document_count,
                    "document_types": doc_types,
                    "similarity_threshold": self.similarity_threshold,
                    "max_context_length": self.max_context_length,
                    "available_algorithms": ["hybrid", "tfidf", "jaccard", "semantic"],
                    "openai_available": bool(self.openai_client),
                    "cache_available": bool(cache.redis_client)
                }
                
        except Exception as e:
            logger.error(f"Error getting stats: {str(e)}")
            return {
                "error": str(e),
                "total_documents": 0,
                "document_types": {}
            }

    async def search(self, query: str, top_k: int = 5, **kwargs) -> List[Dict[str, Any]]:
        """Search method for backward compatibility (alias for similarity_search)"""
        return await self.similarity_search(query, top_k, **kwargs)

# Global RAG engine instance
rag_engine = RAGEngine()