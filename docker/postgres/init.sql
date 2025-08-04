-- PostgreSQL initialization script for RAG microservice
-- This script sets up the database with pgvector extension and optimizations

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with vector support
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    title VARCHAR(500),
    source VARCHAR(255),
    metadata JSONB,
    embedding vector(1536),  -- OpenAI embedding dimension
    similarity_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,  -- Add user_id for isolation
    user_query TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    rag_context JSONB,
    agent_tools_used JSONB,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal performance
-- Text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_content_idx ON documents USING gin(to_tsvector('english', content));
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_title_idx ON documents(title) WHERE title IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_source_idx ON documents(source) WHERE source IS NOT NULL;

-- Metadata indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_metadata_idx ON documents USING gin(metadata) WHERE metadata IS NOT NULL;

-- Timestamp indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_created_at_idx ON documents(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_updated_at_idx ON documents(updated_at);

-- Conversation history indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_session_idx ON conversation_history(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_user_idx ON conversation_history(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_created_at_idx ON conversation_history(created_at);

-- Note: HNSW index for embeddings will be created after data insertion
-- This is because HNSW indexes work better with existing data
-- The application will create this index:
-- CREATE INDEX CONCURRENTLY documents_embedding_hnsw_idx 
-- ON documents USING hnsw (embedding vector_cosine_ops) 
-- WITH (m = 16, ef_construction = 64);

-- Create update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO documents (content, title, source, metadata) VALUES
(
    'Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think and learn like humans. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.',
    'Introduction to Artificial Intelligence',
    'AI_Handbook_2024',
    '{"category": "technology", "difficulty": "beginner", "tags": ["AI", "machine learning", "introduction"]}'
),
(
    'Machine Learning is a subset of artificial intelligence that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. Machine learning focuses on the development of computer programs that can access data and use it to learn for themselves.',
    'Machine Learning Fundamentals',
    'ML_Guide_2024',
    '{"category": "technology", "difficulty": "intermediate", "tags": ["machine learning", "algorithms", "data science"]}'
),
(
    'Natural Language Processing (NLP) is a branch of artificial intelligence that helps computers understand, interpret and manipulate human language. NLP draws from many disciplines, including computer science and computational linguistics, in its pursuit to fill the gap between human communication and computer understanding.',
    'Natural Language Processing Overview',
    'NLP_Textbook_2024',
    '{"category": "technology", "difficulty": "advanced", "tags": ["NLP", "language processing", "computational linguistics"]}'
);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Optimize PostgreSQL settings for vector operations
-- These settings are also configured in postgresql.conf
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Create a function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
    total_documents INTEGER,
    documents_with_embeddings INTEGER,
    avg_content_length NUMERIC,
    database_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM documents) as total_documents,
        (SELECT COUNT(*)::INTEGER FROM documents WHERE embedding IS NOT NULL) as documents_with_embeddings,
        (SELECT ROUND(AVG(LENGTH(content)), 2) FROM documents) as avg_content_length,
        pg_size_pretty(pg_database_size(current_database())) as database_size;
END;
$$ LANGUAGE plpgsql;

-- Print initialization completion
DO $$
BEGIN
    RAISE NOTICE 'RAG microservice database initialized successfully!';
    RAISE NOTICE 'Vector extension enabled: %', (SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector'));
    RAISE NOTICE 'Sample documents inserted: %', (SELECT COUNT(*) FROM documents);
END $$; 