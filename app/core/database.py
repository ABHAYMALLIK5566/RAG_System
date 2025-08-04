import asyncpg
import asyncio
from typing import Optional, List, Dict, Any
from functools import lru_cache
import logging
from contextlib import asynccontextmanager

from .config import settings
from ..models import Base

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages PostgreSQL database connections"""
    
    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._lock = asyncio.Lock()
        self._initialized = False
    
    async def initialize(self):
        """Initialize the database connection"""
        if self._initialized:
            return
            
        async with self._lock:
            if self._initialized:
                return
                
            await self._initialize_postgres()
            self._initialized = True
    
    async def _initialize_postgres(self):
        """Initialize PostgreSQL for production"""
        if self._pool is None:
            try:
                # Parse connection URL to check if database exists
                import urllib.parse
                parsed = urllib.parse.urlparse(settings.database_url)
                
                self._pool = await asyncpg.create_pool(
                    settings.database_url,
                    min_size=settings.db_pool_min_size,
                    max_size=settings.db_pool_max_size,
                    command_timeout=settings.db_command_timeout,
                    server_settings={
                        'jit': 'off'  # Disable JIT for better performance with pgvector
                    }
                )
                
                # Test connection and enable vector extension
                async with self._pool.acquire() as conn:
                    try:
                        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                    except Exception as e:
                        logger.warning(f"Could not create vector extension: {e}")
                    
                pass
                    
            except Exception as e:
                logger.error(f"Failed to initialize database pool: {e}")
                raise
    
    async def close(self):
        """Close the database connection"""
        if self._pool:
            await self._pool.close()
            self._pool = None
        pass
    
    @asynccontextmanager
    async def get_connection(self):
        """Get a database connection"""
        if self._pool is None:
            await self.initialize()
        async with self._pool.acquire() as connection:
            yield connection
    
    async def execute_query(self, query: str, *args) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dictionaries"""
        async with self.get_connection() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    
    async def execute_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Execute a query and return one result as dictionary"""
        async with self.get_connection() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    
    async def execute_command(self, query: str, *args) -> str:
        """Execute a command (INSERT, UPDATE, DELETE) and return status"""
        async with self.get_connection() as conn:
            return await conn.execute(query, *args)
    
    async def health_check(self) -> bool:
        """Check if database is healthy"""
        try:
            async with self.get_connection() as conn:
                await conn.fetchval("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

# Global database manager instance
db_manager = DatabaseManager()

@lru_cache()
def get_database_manager() -> DatabaseManager:
    """Get the global database manager instance"""
    return db_manager

async def init_database():
    """Initialize database tables and indexes"""
    try:
        await _init_postgres_database()
        pass
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

async def _init_postgres_database():
    """Initialize PostgreSQL database schema"""
    async with db_manager.get_connection() as conn:
        # Create vector extension
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        
        # Create documents table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                title VARCHAR(500),
                source VARCHAR(255),
                status VARCHAR(50) NOT NULL DEFAULT 'processed',
                metadata JSONB,
                embedding vector(1536),
                similarity_score FLOAT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Add status column to existing documents table if it doesn't exist
        try:
            await conn.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'processed'")
        except Exception as e:
            logger.warning(f"Could not add status column: {e}")
        
        # Create conversation_history table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS conversation_history (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                user_query TEXT NOT NULL,
                assistant_response TEXT NOT NULL,
                rag_context JSONB,
                agent_tools_used JSONB,
                response_time_ms INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Add user_id column to existing conversation_history table if it doesn't exist
        try:
            await conn.execute("ALTER TABLE conversation_history ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)")
        except Exception as e:
            logger.warning(f"Could not add user_id column: {e}")
        
        # Create users table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(200),
                hashed_password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                is_active BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login TIMESTAMP WITH TIME ZONE,
                login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP WITH TIME ZONE,
                require_password_change BOOLEAN DEFAULT FALSE,
                session_timeout INTEGER DEFAULT 3600,
                allowed_ips JSONB,
                metadata JSONB DEFAULT '{}'
            )
        """)
        
        # Create api_keys table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id VARCHAR(255) PRIMARY KEY,
                key_id VARCHAR(32) UNIQUE NOT NULL,
                hashed_key VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(500),
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                permissions JSONB DEFAULT '[]',
                allowed_ips JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE,
                last_used TIMESTAMP WITH TIME ZONE,
                usage_count INTEGER DEFAULT 0,
                rate_limit_per_hour INTEGER,
                rate_limit_per_day INTEGER,
                created_by VARCHAR(255),
                metadata JSONB DEFAULT '{}'
            )
        """)
        
        # Create security_events table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS security_events (
                id VARCHAR(255) PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                user_id VARCHAR(255),
                api_key_id VARCHAR(255),
                session_id VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                endpoint VARCHAR(255),
                method VARCHAR(10),
                status_code INTEGER,
                message TEXT NOT NULL,
                details JSONB DEFAULT '{}',
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                resolved BOOLEAN DEFAULT FALSE,
                resolved_by VARCHAR(255),
                resolved_at TIMESTAMP WITH TIME ZONE
            )
        """)
        
        # Create indexes for optimal performance
        indexes = [
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_content_idx ON documents USING gin(to_tsvector('english', content))",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_title_idx ON documents(title)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_source_idx ON documents(source)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_metadata_idx ON documents USING gin(metadata)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_created_at_idx ON documents(created_at)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_session_idx ON conversation_history(session_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_user_idx ON conversation_history(user_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_created_at_idx ON conversation_history(created_at)"
        ]
        
        for index_query in indexes:
            try:
                await conn.execute(index_query)
            except Exception as e:
                if "already exists" not in str(e):
                    logger.warning(f"Failed to create index: {e}")
        
        # Create HNSW index for vector similarity search (after data is inserted)
        try:
            await conn.execute("""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_embedding_hnsw_idx 
                ON documents USING hnsw (embedding vector_cosine_ops) 
                WITH (m = 16, ef_construction = 64)
            """)
        except Exception as e:
            logger.info(f"HNSW index creation skipped (will be created after data insertion): {e}")
        
        # Create demo users if they don't exist
        await _create_demo_users(conn)

async def _create_demo_users(conn):
    """Create demo users for testing"""
    try:
        from ..security.security import hash_password
        from ..security.models import UserRole
        
        # Check if demo users already exist
        existing_users = await conn.fetch("SELECT username FROM users WHERE username IN ('admin', 'user')")
        if existing_users:
            pass
            return
        
        # Create admin user
        admin_password_hash = hash_password("admin123")
        await conn.execute("""
            INSERT INTO users (id, username, email, full_name, hashed_password, role, is_active, is_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (username) DO NOTHING
        """, 
        "admin-user-id", "admin", "admin@example.com", "Admin User", 
        admin_password_hash, UserRole.ADMIN.value, True, True)
        
        # Create regular user
        user_password_hash = hash_password("user123")
        await conn.execute("""
            INSERT INTO users (id, username, email, full_name, hashed_password, role, is_active, is_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (username) DO NOTHING
        """, 
        "regular-user-id", "user", "user@example.com", "Regular User", 
        user_password_hash, UserRole.USER.value, True, True)
        
        pass
        
    except Exception as e:
        logger.warning(f"Failed to create demo users: {e}")

async def create_hnsw_index():
    """Create HNSW index for vector similarity search (call after inserting data)"""
    try:
        async with db_manager.get_connection() as conn:
            await conn.execute("""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_embedding_hnsw_idx 
                ON documents USING hnsw (embedding vector_cosine_ops) 
                WITH (m = 16, ef_construction = 64)
            """)
            pass
    except Exception as e:
        logger.error(f"Failed to create HNSW index: {e}")
        raise 