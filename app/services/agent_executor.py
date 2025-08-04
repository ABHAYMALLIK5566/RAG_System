import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from openai import AsyncOpenAI
from openai.types.beta.threads import Run
from openai.types.beta import Thread
import time

from ..core.config import settings
from .rag_engine import rag_engine
from .cache import cache


logger = logging.getLogger(__name__)

class AgentExecutor:
    """OpenAI Assistant-based agent executor with tool integration"""
    
    def __init__(self):
        # Initialize OpenAI client only if API key is available
        self.client = None
        if settings.openai_api_key:
            try:
                self.client = AsyncOpenAI(
                    api_key=settings.openai_api_key,
                    default_headers={"OpenAI-Beta": "assistants=v2"}
                )
                logger.info("OpenAI Assistant client initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI Assistant client: {e}")
        else:
            logger.warning("OpenAI API key not provided, Assistant features disabled")
            
        self.model = settings.openai_model
        self.assistant_id = settings.openai_assistant_id
        self.tools = self._get_tools()
        self._assistant = None
    
    async def initialize(self):
        """Initialize the assistant"""
        # Skip initialization if client is not available
        if self.client is None:
            logger.info("OpenAI Assistant not configured, running in RAG-only mode")
            self._assistant = None
            return
            
        # Skip if no API key is provided
        if not settings.openai_api_key:
            logger.info("OpenAI API key not provided, running in RAG-only mode")
            self._assistant = None
            return
            
        # Debug logging
        logger.info(f"Assistant ID from settings: '{self.assistant_id}'")
        
        try:
            if self.assistant_id and self.assistant_id.strip():
                # Use existing assistant only if ID is actually provided and not empty
                logger.info(f"Attempting to retrieve existing assistant: {self.assistant_id}")
                self._assistant = await self.client.beta.assistants.retrieve(self.assistant_id)
                logger.info(f"Using existing assistant: {self.assistant_id}")
            else:
                # Skip assistant creation for now - run in RAG-only mode
                logger.info("No valid assistant ID provided, running in RAG-only mode with OpenAI chat completion")
                self._assistant = None
                return
                
        except Exception as e:
            logger.error(f"Assistant initialization failed: {e}")
            self._assistant = None  # Mark as unavailable for graceful degradation
    
    def _get_system_instructions(self) -> str:
        """Get system instructions for the assistant"""
        return """
        You are a helpful AI assistant with access to a knowledge base through RAG (Retrieval-Augmented Generation).
        
        Your capabilities:
        1. Search the knowledge base for relevant information
        2. Provide accurate, contextual responses based on retrieved information
        3. Admit when you don't have sufficient information
        4. Combine information from multiple sources when relevant
        
        Guidelines:
        - Always search the knowledge base first before providing answers
        - Cite sources when using retrieved information
        - Be concise but comprehensive
        - If the retrieved information is insufficient, say so clearly
        - Maintain a helpful and professional tone
        """
    
    def _get_tools(self) -> List[Dict[str, Any]]:
        """Define available tools for the assistant - Compatible with OpenAI v1.13.3 and Assistants API v2"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_knowledge_base",
                    "description": "Search the knowledge base for relevant information",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to find relevant information"
                            },
                            "top_k": {
                                "type": "integer",
                                "description": "Number of results to return (default: 5)"
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": False
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "hybrid_search",
                    "description": "Perform hybrid search combining semantic and keyword search",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query"
                            },
                            "semantic_weight": {
                                "type": "number",
                                "description": "Weight for semantic search (0.0 to 1.0, default: 0.7)"
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": False
                    }
                }
            }
        ]
    
    async def execute_query(
        self, 
        query: str, 
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a query using the assistant (non-streaming)"""
        if self._assistant is None:
            await self.initialize()
        # If assistant is still unavailable after initialization, return error response
        if self._assistant is None:
            return {
                "response": "OpenAI Assistant is not available. Please check your API key and connection.",
                "error": "OpenAI Assistant is not available. Please check your API key and connection.",
                "query": query,
                "tools_used": [],
                "response_time_ms": 0,
                "source": "agent",
                "status": "error"
            }
        start_time = time.time()
        try:
            # Create or get thread
            thread = await self._get_or_create_thread(session_id)
            # Add user message
            await self.client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=query
            )
            # Create and run the assistant
            return await self._execute_run(thread.id, query, start_time)
        except Exception as e:
            logger.error(f"Failed to execute query: {e}")
            return {
                "response": f"Error executing query: {str(e)}",
                "error": str(e),
                "query": query,
                "tools_used": [],
                "response_time_ms": int((time.time() - start_time) * 1000),
                "source": "agent",
                "status": "error"
            }

    async def execute_query_stream(
        self, 
        query: str, 
        session_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a query using the assistant (streaming)"""
        async def error_gen(error_msg: str):
            yield {
                "type": "error",
                "error": error_msg,
                "query": query,
                "tools_used": [],
                "response_time_ms": 0,
                "source": "agent",
                "status": "error"
            }
        
        if self._assistant is None:
            await self.initialize()
        # If assistant is still unavailable after initialization, return error response
        if self._assistant is None:
            async for item in error_gen("OpenAI Assistant is not available. Please check your API key and connection."):
                yield item
            return
        
        start_time = time.time()
        try:
            # Create or get thread
            thread = await self._get_or_create_thread(session_id)
            # Add user message
            await self.client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=query
            )
            # Create and run the assistant
            async for chunk in self._stream_run(thread.id, query, start_time):
                yield chunk
        except Exception as e:
            logger.error(f"Failed to execute query: {e}")
            async for item in error_gen(f"Error executing query: {str(e)}"):
                yield item
    
    async def _execute_run(self, thread_id: str, query: str, start_time: float) -> Dict[str, Any]:
        """Execute a non-streaming run"""
        
        # Create run
        run = await self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=self._assistant.id
        )
        
        # Wait for completion
        tools_used = []
        while run.status in ["queued", "in_progress", "requires_action"]:
            if run.status == "requires_action":
                # Handle tool calls
                tool_outputs = []
                for tool_call in run.required_action.submit_tool_outputs.tool_calls:
                    tool_output = await self._handle_tool_call(tool_call)
                    tool_outputs.append(tool_output)
                    tools_used.append({
                        "tool": tool_call.function.name,
                        "arguments": tool_call.function.arguments
                    })
                
                # Submit tool outputs
                run = await self.client.beta.threads.runs.submit_tool_outputs(
                    thread_id=thread_id,
                    run_id=run.id,
                    tool_outputs=tool_outputs
                )
            else:
                await asyncio.sleep(1)
                run = await self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run.id
                )
        
        if run.status == "completed":
            # Get the response
            messages = await self.client.beta.threads.messages.list(
                thread_id=thread_id,
                order="desc",
                limit=1
            )
            
            response = messages.data[0].content[0].text.value
            
            return {
                "response": response,
                "query": query,
                "tools_used": tools_used,
                "response_time_ms": int((time.time() - start_time) * 1000),
                "source": "agent"
            }
        else:
            raise Exception(f"Run failed with status: {run.status}")
    
    async def _stream_run(self, thread_id: str, query: str, start_time: float) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a streaming run"""
        
        # Create streaming run
        stream_coro = self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=self._assistant.id,
            stream=True
        )
        stream = await stream_coro
        
        tools_used = []
        response_parts = []
        
        async for event in stream:
            if event.event == "thread.run.requires_action":
                # Handle tool calls
                tool_outputs = []
                for tool_call in event.data.required_action.submit_tool_outputs.tool_calls:
                    tool_output = await self._handle_tool_call(tool_call)
                    tool_outputs.append(tool_output)
                    tools_used.append({
                        "tool": tool_call.function.name,
                        "arguments": tool_call.function.arguments
                    })
                
                # Submit tool outputs
                await self.client.beta.threads.runs.submit_tool_outputs(
                    thread_id=thread_id,
                    run_id=event.data.id,
                    tool_outputs=tool_outputs
                )
            
            elif event.event == "thread.message.delta":
                # Stream response content
                if event.data.delta.content:
                    for content in event.data.delta.content:
                        if content.type == "text":
                            chunk = content.text.value
                            response_parts.append(chunk)
                            yield {
                                "type": "chunk",
                                "content": chunk,
                                "timestamp": time.time()
                            }
            
            elif event.event == "thread.run.completed":
                # Send completion event
                yield {
                    "type": "complete",
                    "response": "".join(response_parts),
                    "query": query,
                    "tools_used": tools_used,
                    "response_time_ms": int((time.time() - start_time) * 1000),
                    "source": "agent"
                }
                break
            
            elif event.event == "thread.run.failed":
                yield {
                    "type": "error",
                    "error": f"Run failed: {event.data.last_error}",
                    "timestamp": time.time()
                }
                break
    
    async def _handle_tool_call(self, tool_call) -> Dict[str, Any]:
        """Handle tool function calls"""
        
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        
        try:
            if function_name == "search_knowledge_base":
                # Perform RAG search
                query = arguments["query"]
                top_k = arguments.get("top_k", 5)
                metadata_filter = arguments.get("metadata_filter")
                
                results = await rag_engine.similarity_search(
                    query=query,
                    top_k=top_k,
                    metadata_filter=metadata_filter
                )
                
                # Format results for the assistant
                formatted_results = []
                for result in results:
                    formatted_results.append({
                        "content": result["content"],
                        "title": result.get("title", "Untitled"),
                        "source": result.get("source", "Unknown"),
                        "similarity_score": result["similarity_score"]
                    })
                
                return {
                    "tool_call_id": tool_call.id,
                    "output": json.dumps({
                        "results": formatted_results,
                        "query": query,
                        "num_results": len(formatted_results)
                    })
                }
            
            elif function_name == "hybrid_search":
                # Perform hybrid search
                query = arguments["query"]
                semantic_weight = arguments.get("semantic_weight", 0.7)
                
                results = await rag_engine.hybrid_search(
                    query=query,
                    semantic_weight=semantic_weight
                )
                
                # Format results
                formatted_results = []
                for result in results:
                    formatted_results.append({
                        "content": result["content"],
                        "title": result.get("title", "Untitled"),
                        "source": result.get("source", "Unknown"),
                        "combined_score": result.get("combined_score", 0)
                    })
                
                return {
                    "tool_call_id": tool_call.id,
                    "output": json.dumps({
                        "results": formatted_results,
                        "query": query,
                        "num_results": len(formatted_results),
                        "search_type": "hybrid"
                    })
                }
            
            else:
                return {
                    "tool_call_id": tool_call.id,
                    "output": json.dumps({"error": f"Unknown function: {function_name}"})
                }
        
        except Exception as e:
            logger.error(f"Tool call failed: {e}")
            return {
                "tool_call_id": tool_call.id,
                "output": json.dumps({"error": str(e)})
            }
    
    async def _get_or_create_thread(self, session_id: Optional[str]) -> Thread:
        """Get existing thread or create new one"""
        
        if session_id:
            # Try to get cached thread ID
            thread_id = await cache.get(f"thread:{session_id}")
            if thread_id:
                try:
                    return await self.client.beta.threads.retrieve(thread_id)
                except:
                    # Thread doesn't exist, create new one
                    pass
        
        # Create new thread
        thread = await self.client.beta.threads.create()
        
        if session_id:
            # Cache thread ID
            await cache.set(f"thread:{session_id}", thread.id, ttl=3600)  # 1 hour
        
        return thread
    
    async def get_conversation_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a session"""
        
        thread_id = await cache.get(f"thread:{session_id}")
        if not thread_id:
            return []
        
        try:
            messages = await self.client.beta.threads.messages.list(
                thread_id=thread_id,
                order="asc"
            )
            
            history = []
            for message in messages.data:
                history.append({
                    "role": message.role,
                    "content": message.content[0].text.value,
                    "timestamp": message.created_at
                })
            
            return history
            
        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []
    
    async def clear_conversation(self, session_id: str) -> bool:
        """Clear conversation history for a session"""
        
        try:
            # Remove cached thread
            await cache.delete(f"thread:{session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to clear conversation: {e}")
            return False
    
    async def health_check(self) -> bool:
        """Check if the assistant is healthy"""
        
        try:
            # Check if client is available
            if self.client is None:
                return False
                
            if self._assistant is None:
                await self.initialize()
            
            # If no assistant ID is configured, the system runs in RAG-only mode
            # This is a valid configuration, so return True if client is available
            if self._assistant is None:
                logger.info("No assistant ID configured - running in RAG-only mode (healthy)")
                return True
            
            # Try to retrieve the assistant
            await self.client.beta.assistants.retrieve(self._assistant.id)
            return True
            
        except Exception as e:
            logger.error(f"Assistant health check failed: {e}")
            return False

# Combined RAG + Agent service
class RAGAgent:
    """Enhanced RAG Agent with OpenAI integration"""
    
    def __init__(self):
        self.agent_executor = AgentExecutor()
    
    async def initialize(self):
        """Initialize OpenAI components"""
        await self.agent_executor.initialize()
    
    async def unified_query(
        self, 
        query: str,
        session_id: Optional[str] = None,
        use_agent: bool = True
    ) -> Dict[str, Any]:
        """
        Unified query processing with OpenAI integration (non-streaming)
        Returns a dict with the result.
        """
        start_time = time.time()
        try:
            rag_context = await self._get_rag_context(query)
            if use_agent and self.agent_executor.client:
                result = await self._process_with_openai_agent(
                    query, rag_context, False, session_id
                )
            else:
                result = await self._process_with_simple_rag(
                    query, rag_context
                )
            result["processing_info"] = {
                "processing_mode": "fast",
                "total_time_ms": int((time.time() - start_time) * 1000),
                "agent_available": self.agent_executor._assistant is not None
            }
            return result
        except Exception as e:
            fallback_result = await self._process_with_simple_rag(query, {})
            fallback_result["error"] = str(e)
            fallback_result["processing_info"] = {
                "processing_mode": "fallback",
                "error": str(e),
                "total_time_ms": int((time.time() - start_time) * 1000)
            }
            return fallback_result

    async def unified_query_stream(
        self,
        query: str,
        session_id: Optional[str] = None,
        use_agent: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Unified query processing with OpenAI integration (streaming)
        Yields streaming chunks.
        """
        if False:
            yield  # This ensures this function is always an async generator
        try:
            rag_context = await self._get_rag_context(query)
            if use_agent and self.agent_executor.client:
                agent_stream = self.agent_executor.execute_query_stream(
                    query=query,
                    session_id=session_id
                )
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"[RAG_AGENT] DEBUG: type(agent_stream) = {type(agent_stream)}")
                logger.info(f"[RAG_AGENT] DEBUG: hasattr(agent_stream, '__aiter__') = {hasattr(agent_stream, '__aiter__')}")
                assert hasattr(agent_stream, '__aiter__'), f"agent_stream is not an async generator, got {type(agent_stream)}"
                async for chunk in agent_stream:
                    yield chunk
            else:
                result = await self._process_with_simple_rag(query, rag_context)
                yield {"type": "complete", **result}
        except Exception as e:
            yield {"type": "error", "error": str(e)}
    
    async def _process_with_openai_agent(
        self,
        query: str,
        rag_context: Dict[str, Any],
        stream: bool,
        session_id: Optional[str]
    ) -> Dict[str, Any]:
        """Process query using OpenAI direct API (fast mode without Assistant)"""
        
        try:
            # Check if Assistant API is available and configured
            if self.agent_executor._assistant is not None:
                # Use Assistant API if available
                if stream:
                    # For streaming, return the async generator directly
                    return self.agent_executor.execute_query_stream(
                        query=query,
                        session_id=session_id
                    )
                else:
                    # For non-streaming, await the result
                    agent_result = await self.agent_executor.execute_query(
                        query=query,
                        session_id=session_id
                    )
                    
                    # Enhance with RAG context if not already present
                    if "rag_context" not in agent_result:
                        agent_result["rag_context"] = rag_context
                    
                    agent_result["source"] = "openai_agent"
                    return agent_result
            else:
                # Use direct OpenAI chat completions (preferred for non-Assistant usage)
                return await self._process_with_openai_chat(
                    query, rag_context, stream, session_id
                )
                
        except Exception as e:
            logger.error(f"OpenAI agent processing failed: {e}")
            # Try direct chat as fallback
            try:
                return await self._process_with_openai_chat(
                    query, rag_context, stream, session_id
                )
            except Exception as chat_e:
                logger.error(f"OpenAI chat fallback also failed: {chat_e}")
                return await self._process_with_simple_rag(query, rag_context)
    
    async def _process_with_openai_chat(
        self,
        query: str,
        rag_context: Dict[str, Any],
        stream: bool,
        session_id: Optional[str]
    ) -> Dict[str, Any]:
        """Process query using OpenAI chat completions directly"""
        
        start_time = time.time()
        
        # Prepare context from RAG results
        context_text = ""
        if rag_context.get("context"):
            context_text = "\n".join([
                f"Source: {item.get('source', 'Unknown')}\nContent: {item.get('content', '')}"
                for item in rag_context["context"][:5]  # Top 5 results
            ])
        
        # Create system message with instructions
        system_message = """You are a helpful AI assistant with access to a knowledge base. 
        Use the provided context to answer questions accurately and comprehensively.
        
        Guidelines:
        - Base your answers primarily on the provided context
        - If the context doesn't contain sufficient information, say so clearly
        - Cite sources when using specific information
        - Be concise but thorough
        - Maintain a helpful and professional tone"""
        
        # Create user message with context
        user_message = f"""Context from knowledge base:
{context_text}

Question: {query}

Please provide a comprehensive answer based on the context above."""
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
        
        try:
            # Use OpenAI client for chat completion
            if self.agent_executor.client:
                if stream:
                    # Streaming response
                    response_stream = await self.agent_executor.client.chat.completions.create(
                        model=self.agent_executor.model,
                        messages=messages,
                        stream=True,
                        max_tokens=2000,
                        temperature=0.7
                    )
                    
                    # Note: For streaming, we'd need to implement a generator
                    # For now, fall back to non-streaming
                    stream = False
                
                if not stream:
                    # Non-streaming response
                    response = await self.agent_executor.client.chat.completions.create(
                        model=self.agent_executor.model,
                        messages=messages,
                        max_tokens=2000,
                        temperature=0.7
                    )
                    
                    response_time_ms = int((time.time() - start_time) * 1000)
                    
                    return {
                        "response": response.choices[0].message.content,
                        "query": query,
                        "context": rag_context.get("context", []),
                        "metadata": {
                            **rag_context.get("metadata", {}),
                            "processing_mode": "openai_chat",
                            "model_used": self.agent_executor.model,
                            "tokens_used": response.usage.total_tokens if response.usage else 0,

                        },
                        "source": "openai_chat",
                        "response_time_ms": response_time_ms,
                        "session_id": session_id,
                        "rag_context": rag_context
                    }
            else:
                raise Exception("OpenAI client not available")
                
        except Exception as e:
            logger.error(f"OpenAI chat completion failed: {e}")
            raise
    
    async def _process_with_simple_rag(
        self,
        query: str,
        rag_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process query using simple RAG (fallback mode)"""
        
        if not rag_context:
            rag_context = await self._get_rag_context(query)
        
        # Generate simple response based on RAG context
        response = self._generate_simple_response(query, rag_context)
        
        return {
            "response": response,
            "query": query,
            "context": rag_context.get("context", []),
            "metadata": rag_context.get("metadata", {}),
            "source": "simple_rag",
            "response_time_ms": int(time.time() * 1000) % 1000,  # Approximate
            "rag_context": rag_context
        }
    
    async def _get_rag_context(self, query: str) -> Dict[str, Any]:
        """Get RAG context for the query"""
        try:
            # Use similarity_search instead of get_context for structured results
            # Add timeout to prevent hanging on database issues
            search_results = await asyncio.wait_for(
                rag_engine.similarity_search(query, top_k=5),
                timeout=5.0  # 5 second timeout
            )
            return {
                "context": search_results,
                "metadata": {
                    "search_type": "similarity",
                    "query": query,
                    "results_count": len(search_results)
                }
            }
        except asyncio.TimeoutError:
            logger.warning(f"RAG search timed out for query: {query}")
            return {
                "context": [],
                "metadata": {
                    "search_type": "timeout",
                    "query": query,
                    "results_count": 0,
                    "error": "Database search timed out"
                }
            }
        except Exception as e:
            logger.error(f"Failed to get RAG context: {e}")
            return {
                "context": [], 
                "metadata": {
                    "search_type": "error",
                    "query": query,
                    "results_count": 0,
                    "error": str(e)
                }
            }
    

    
    def _generate_simple_response(self, query: str, rag_result: Dict[str, Any]) -> str:
        """Generate a simple response from RAG results (fallback)"""
        
        # Get context - can be a list of documents or a string
        context = rag_result.get("context", [])
        sources = rag_result.get("metadata", {}).get("sources", [])
        
        # Build response from context
        if isinstance(context, list) and context:
            # Context is a list of documents
            response = f"Based on the available information regarding '{query}':\n\n"
            
            for i, doc in enumerate(context[:3], 1):  # Use top 3 results
                title = doc.get('title', 'Untitled')
                content = doc.get('content', '')
                score = doc.get('similarity_score', 0)
                
                response += f"{i}. **{title}** (relevance: {score:.2f})\n"
                response += f"   {content[:200]}{'...' if len(content) > 200 else ''}\n\n"
        
        elif isinstance(context, str) and context:
            # Context is already formatted text
            response = f"Based on the available information:\n\n{context}\n\n"
        
        else:
            response = f"I found some information about '{query}', but it may not be directly relevant to your question."
        
        # Add sources if available
        if sources:
            source_names = [s.get('title', 'Unknown') if isinstance(s, dict) else str(s) for s in sources]
            response += f"\nSources: {', '.join(source_names[:3])}"
        
        return response

# Global instances
agent_executor = AgentExecutor()
rag_agent = RAGAgent() 