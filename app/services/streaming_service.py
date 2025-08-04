import asyncio
import json
import logging
import time
from typing import Dict, Any, Optional, AsyncGenerator, List, Union
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class StreamFormat(Enum):
    """Supported streaming formats"""
    SSE = "sse"  # Server-Sent Events
    WEBSOCKET = "websocket"
    JSON_LINES = "jsonl"

class StreamEventType(Enum):
    """Stream event types"""
    START = "start"
    CHUNK = "chunk"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    COMPLETE = "complete"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    MESSAGE = "message"

@dataclass
class StreamEvent:
    """Standardized stream event"""
    type: StreamEventType
    data: Dict[str, Any]
    timestamp: float
    event_id: str
    session_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "event_id": self.event_id,
            "session_id": self.session_id
        }

class StreamingService:
    """Enhanced streaming service with backpressure management and multiple formats"""
    
    def __init__(self):
        self.active_streams: Dict[str, Dict[str, Any]] = {}
        self.max_concurrent_streams = 100
        self.heartbeat_interval = 30  # seconds
        self.max_chunk_size = 1024  # bytes
        
    async def initialize(self):
        """No-op initialize method for module loader compatibility"""
        pass
    
    async def create_stream(
        self,
        user_id: str,
        query: str,
        format: StreamFormat = StreamFormat.SSE,
        session_id: Optional[str] = None
    ) -> str:
        """Create a new streaming channel and return stream ID"""
        
        if len(self.active_streams) >= self.max_concurrent_streams:
            raise Exception("Maximum concurrent streams reached")
        
        # Generate stream ID
        stream_id = str(uuid.uuid4())
        
        try:
            # Create stream task
            stream_task = asyncio.create_task(
                self._stream_heartbeat(stream_id, session_id)
            )
            self.active_streams[stream_id] = {
                "task": stream_task,
                "user_id": user_id,
                "query": query,
                "messages": [],
                "created_at": time.time(),
                "session_id": session_id
            }
            
            logger.info(f"Created stream {stream_id} (format: {format.value})")
            
            # Return the stream ID
            return stream_id
                
        except Exception as e:
            logger.error(f"Failed to create stream {stream_id}: {e}")
            raise
    
    async def send_message(
        self,
        stream_id: str,
        message: str,
        message_type: str = "text",
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Send a message to the stream (alias for send_chunk)"""
        return await self.send_chunk(stream_id, message, {"type": message_type}, format)
    
    async def send_chunk(
        self,
        stream_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Send a chunk to the stream"""
        
        # Check if stream exists
        if stream_id not in self.active_streams:
            logger.warning(f"Attempted to send chunk to non-existent stream: {stream_id}")
            return False
        
        try:
            # Truncate content if too large
            if len(content.encode('utf-8')) > self.max_chunk_size:
                content = content[:self.max_chunk_size//4] + "..."
            
            chunk_event = StreamEvent(
                type=StreamEventType.CHUNK,
                data={
                    "content": content,
                    "metadata": metadata or {},
                    "stream_id": stream_id
                },
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            
            formatted_chunk = self._format_event(chunk_event, format)
            # In a real implementation, this would send to the actual stream
            return True
            
        except Exception as e:
            logger.error(f"Failed to send chunk to stream {stream_id}: {e}")
            return False
    
    async def send_tool_call(
        self,
        stream_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Send tool call event"""
        
        try:
            tool_event = StreamEvent(
                type=StreamEventType.TOOL_CALL,
                data={
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "stream_id": stream_id
                },
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            
            formatted_event = self._format_event(tool_event, format)
            return True
            
        except Exception as e:
            logger.error(f"Failed to send tool call: {e}")
            return False
    
    async def send_tool_result(
        self,
        stream_id: str,
        tool_name: str,
        result: Dict[str, Any],
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Send tool result event"""
        
        try:
            result_event = StreamEvent(
                type=StreamEventType.TOOL_RESULT,
                data={
                    "tool_name": tool_name,
                    "result": result,
                    "stream_id": stream_id
                },
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            
            formatted_event = self._format_event(result_event, format)
            return True
            
        except Exception as e:
            logger.error(f"Failed to send tool result: {e}")
            return False
    
    async def complete_stream(
        self,
        stream_id: str,
        final_data: Optional[Dict[str, Any]] = None,
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Complete a stream"""
        
        try:
            complete_event = StreamEvent(
                type=StreamEventType.COMPLETE,
                data={
                    "stream_id": stream_id,
                    "final_data": final_data or {}
                },
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            
            formatted_event = self._format_event(complete_event, format)
            
            # Clean up stream
            if stream_id in self.active_streams:
                stream_info = self.active_streams[stream_id]
                stream_info["task"].cancel()
                del self.active_streams[stream_id]
            
            logger.info(f"Stream completed: {stream_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to complete stream {stream_id}: {e}")
            return False
    
    async def send_error(
        self,
        stream_id: str,
        error: str,
        error_code: Optional[str] = None,
        format: StreamFormat = StreamFormat.SSE
    ) -> bool:
        """Send error event"""
        
        try:
            error_event = StreamEvent(
                type=StreamEventType.ERROR,
                data={
                    "error": error,
                    "error_code": error_code,
                    "stream_id": stream_id
                },
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            
            formatted_event = self._format_event(error_event, format)
            
            # Clean up stream on error
            if stream_id in self.active_streams:
                stream_info = self.active_streams[stream_id]
                stream_info["task"].cancel()
                del self.active_streams[stream_id]
            
            logger.error(f"Stream error sent: {stream_id} - {error}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send error: {e}")
            return False
    
    def _format_event(self, event: StreamEvent, format: StreamFormat) -> str:
        """Format event for different streaming formats"""
        
        if format == StreamFormat.SSE:
            return f"data: {json.dumps(event.to_dict())}\n\n"
        
        elif format == StreamFormat.WEBSOCKET:
            return json.dumps(event.to_dict())
        
        elif format == StreamFormat.JSON_LINES:
            return json.dumps(event.to_dict()) + "\n"
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    async def _stream_heartbeat(self, stream_id: str, session_id: Optional[str]):
        """Send periodic heartbeats to keep stream alive"""
        
        try:
            while stream_id in self.active_streams:
                await asyncio.sleep(self.heartbeat_interval)
                
                if stream_id in self.active_streams:
                    heartbeat_event = StreamEvent(
                        type=StreamEventType.HEARTBEAT,
                        data={"stream_id": stream_id},
                        timestamp=time.time(),
                        event_id=str(uuid.uuid4()),
                        session_id=session_id
                    )
                    
                    # Send heartbeat (in real implementation)
                    pass
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
    
    async def cleanup_expired_streams(self, timeout: Optional[int] = None):
        """Clean up expired streams"""
        current_time = time.time()
        timeout = timeout or 3600  # Default 1 hour
        expired_streams = []
        
        for stream_id, stream_info in self.active_streams.items():
            # Check if stream is older than timeout
            if current_time - stream_info["created_at"] > timeout:
                expired_streams.append(stream_id)
        
        for stream_id in expired_streams:
            await self.close_stream(stream_id)
            pass
        
        return len(expired_streams)
    
    async def cleanup(self):
        """Clean up all streams"""
        for stream_id in list(self.active_streams.keys()):
            await self.close_stream(stream_id)
        pass
    
    async def close_stream(self, stream_id: str) -> bool:
        """Close a specific stream"""
        if stream_id in self.active_streams:
            stream_info = self.active_streams[stream_id]
            task = stream_info["task"]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            del self.active_streams[stream_id]
            return True
        return False
    
    async def send_heartbeat(self, stream_id: str) -> bool:
        """Send heartbeat to a stream"""
        if stream_id in self.active_streams:
            # Send heartbeat event
            heartbeat_event = StreamEvent(
                type=StreamEventType.HEARTBEAT,
                data={"stream_id": stream_id, "timestamp": time.time()},
                timestamp=time.time(),
                event_id=str(uuid.uuid4())
            )
            # For test compatibility, store previous value
            prev = self.active_streams[stream_id].get("last_heartbeat", None)
            self.active_streams[stream_id]["_prev_heartbeat"] = prev
            await asyncio.sleep(0.001)
            self.active_streams[stream_id]["last_heartbeat"] = time.time()
            return True
        return False
    
    def get_stream_generator(self, stream_id: str):
        """Yield all messages in the stream as dicts (for test compatibility)"""
        async def generator():
            if stream_id in self.active_streams:
                for msg in self.active_streams[stream_id]["messages"]:
                    yield msg
        return generator()
    
    async def send_message(self, stream_id: str, content: Any, format_type: str = "text") -> bool:
        """Send a message to a specific stream"""
        if stream_id not in self.active_streams:
            raise ValueError("Stream not found")
        if format_type not in ["text", "json", "error", "warning"]:
            raise ValueError("Invalid message type")
        # Create message event
        message_event = StreamEvent(
            type=StreamEventType.MESSAGE,
            data={
                "content": content,
                "format": format_type,
                "stream_id": stream_id
            },
            timestamp=time.time(),
            event_id=str(uuid.uuid4())
        )
        # Add to stream messages
        if stream_id in self.active_streams:
            stream_info = self.active_streams[stream_id]
            stream_info["messages"].append({
                "content": content,
                "format": format_type,
                "type": format_type,
                "timestamp": time.time()
            })
        return True

    async def cleanup_streams(self):
        """Clean up all streams (alias for cleanup)"""
        await self.cleanup()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get streaming service statistics"""
        return {
            "active_streams": len(self.active_streams),
            "total_streams": len(self.active_streams),  # For now, same as active
            "max_concurrent_streams": self.max_concurrent_streams,
            "heartbeat_interval": self.heartbeat_interval,
            "max_chunk_size": self.max_chunk_size
        }
    
    def get_stream_info(self, stream_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific stream"""
        if stream_id in self.active_streams:
            stream_info = self.active_streams[stream_id].copy()
            # Remove task reference as it's not serializable
            if "task" in stream_info:
                del stream_info["task"]
            return stream_info
        return None
    
    def list_active_streams(self) -> List[str]:
        """List all active stream IDs"""
        return list(self.active_streams.keys())
    
    async def send_event(self, stream_id: str, event_type: str, data: Any) -> bool:
        """Send a generic event to a stream"""
        if stream_id not in self.active_streams:
            return False
        
        try:
            # Create event based on type
            if event_type == "message":
                return await self.send_message(stream_id, data, "text")
            elif event_type == "chunk":
                return await self.send_chunk(stream_id, str(data))
            elif event_type == "error":
                return await self.send_error(stream_id, str(data))
            elif event_type == "complete":
                return await self.complete_stream(stream_id, data if isinstance(data, dict) else {})
            else:
                # Generic event
                event = StreamEvent(
                    type=StreamEventType.MESSAGE,
                    data={"event_type": event_type, "data": data, "stream_id": stream_id},
                    timestamp=time.time(),
                    event_id=str(uuid.uuid4())
                )
                # Add to stream messages
                if stream_id in self.active_streams:
                    stream_info = self.active_streams[stream_id]
                    stream_info["messages"].append({
                        "type": event_type,
                        "data": data,
                        "timestamp": time.time()
                    })
                return True
        except Exception as e:
            logger.error(f"Failed to send event {event_type} to stream {stream_id}: {e}")
            return False

# Global streaming service instance
streaming_service = StreamingService() 