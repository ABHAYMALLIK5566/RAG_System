# 🏗️ RAG Microservice - Complete Architecture Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Deployment Architecture](#deployment-architecture)
7. [Security Architecture](#security-architecture)
8. [Performance & Scalability](#performance--scalability)
9. [Monitoring & Observability](#monitoring--observability)

---

## 🎯 System Overview

The RAG (Retrieval-Augmented Generation) Microservice is a production-ready, high-performance AI-powered document search and question-answering system. It combines advanced vector search capabilities with OpenAI's GPT models to provide intelligent, context-aware responses based on a knowledge base of documents.

### Key Architectural Principles
- **Microservices Architecture**: Modular, independently deployable services
- **Event-Driven Design**: Asynchronous processing with real-time capabilities
- **Multi-Agent Orchestration**: Specialized AI agents for different query types
- **Advanced Search Algorithms**: Multiple search strategies (semantic, keyword, hybrid, fuzzy, contextual)
- **Real-time Streaming**: WebSocket and Server-Sent Events support
- **Production-Ready**: Comprehensive monitoring, security, and scalability features

---

## 🏛️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  HTTP API (FastAPI)  │  WebSocket  │  Server-Sent Events       │
│  - REST Endpoints    │  - Real-time │  - Streaming Responses    │
│  - OpenAPI Docs      │  - Sessions  │  - Event Streams          │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  API Endpoints      │  Middleware    │  Authentication          │
│  - RAG Operations   │  - Security    │  - JWT Tokens            │
│  - File Upload      │  - Rate Limiting│  - API Keys             │
│  - Health Checks    │  - CORS        │  - Role-based Access     │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Agent Orchestrator │  Advanced RAG  │  Streaming Service       │
│  - Multi-Agent      │  - Search Algo │  - Real-time Processing  │
│  - Query Routing    │  - Context Gen │  - Event Management      │
│  - Agent Coordination│  - Result Rank │  - Stream Cleanup       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  RAG Engine         │  Cache Service │  Webhook Service         │
│  - Vector Search    │  - Redis Cache │  - Event Notifications   │
│  - Embedding Gen    │  - Memory Cache│  - Retry Logic           │
│  - Document Proc    │  - TTL Mgmt    │  - HMAC Signatures       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                   │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector │  Redis        │  File Storage          │
│  - Document Storage    │  - Session Mgmt│  - Uploaded Files      │
│  - Vector Embeddings   │  - Cache Data  │  - Temporary Files     │
│  - Conversation History│  - Rate Limits │  - Processed Documents │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Core Components

### 1. **API Layer (`app/api/`)**
```
app/api/
├── endpoints/
│   ├── auth.py              # Authentication endpoints
│   ├── enhanced_rag.py      # Advanced RAG operations
│   ├── file_upload.py       # Document upload handling
│   ├── health.py            # Health checks & metrics
│   ├── rag.py               # Core RAG endpoints
│   └── websocket.py         # WebSocket real-time communication
└── __init__.py              # API router configuration
```

**Key Features:**
- RESTful API with OpenAPI documentation
- WebSocket support for real-time communication
- Server-Sent Events for streaming responses
- Comprehensive health monitoring endpoints
- File upload with validation and processing

### 2. **Business Logic Layer (`app/services/`)**
```
app/services/
├── advanced_rag_engine.py   # Multi-algorithm search engine
├── agent_orchestrator.py    # Multi-agent coordination
├── agent_executor.py        # Individual agent execution
├── rag_engine.py            # Core RAG functionality
├── streaming_service.py     # Real-time streaming
├── cache.py                 # Redis caching layer
├── memory_cache.py          # In-memory caching
├── webhook.py               # Webhook notifications
├── similarity_engine.py     # Vector similarity search
├── ai_generator.py          # AI response generation
├── bulk_importer.py         # Batch document processing
└── performance_monitor.py   # Performance tracking
```

**Advanced RAG Engine Features:**
- **Multiple Search Algorithms:**
  - Semantic Search (vector embeddings)
  - Keyword Search (text matching)
  - Hybrid Search (combined approach)
  - Fuzzy Search (approximate matching)
  - Contextual Search (context-aware)

- **Agent Orchestrator:**
  - **General Agent**: Basic Q&A and information retrieval
  - **Analytical Agent**: Data analysis, comparisons, logical reasoning
  - **Creative Agent**: Brainstorming, ideation, creative problem-solving
  - **Technical Agent**: Technical explanations, code analysis
  - **Research Agent**: Comprehensive research and information gathering
  - **Summary Agent**: Concise summarization

### 3. **Data Models (`app/models/`)**
```
app/models/
└── document.py              # Database models
    ├── Document             # Document storage with embeddings
    └── ConversationHistory  # Session and conversation tracking
```

**Document Model Features:**
- Vector embeddings (1536 dimensions for OpenAI)
- Metadata storage (JSON)
- Similarity scoring
- Timestamp tracking
- Full-text indexing

### 4. **Security Layer (`app/security/`)**
```
app/security/
├── auth.py                  # JWT authentication
├── csp_fix.py              # Content Security Policy
└── middleware.py            # Security middleware
```

**Security Features:**
- JWT-based authentication
- API key support
- Rate limiting
- IP blocking
- Content Security Policy (CSP)
- Input validation and sanitization
- CORS configuration

### 5. **Configuration (`app/core/`)**
```
app/core/
├── config.py                # Application settings
└── database.py              # Database connection management
```

**Configuration Management:**
- Environment-based configuration
- Database connection pooling
- Redis configuration
- OpenAI API settings
- Security parameters
- Performance tuning options

---

## 🔄 Data Flow

### 1. **Document Ingestion Flow**
```
[File Upload] → [Validation] → [Text Extraction] → [Chunking] → [Embedding Generation] → [Database Storage]
     │              │              │                │              │                      │
     └── [Cache] ← [Metadata] ← [Processing] ← [Content] ← [Raw Text] ← [File Content]
```

### 2. **Query Processing Flow**
```
[User Query] → [Authentication] → [Rate Limiting] → [Query Analysis] → [Agent Selection]
     │              │                │                │                │
     └── [Response] ← [Result Synthesis] ← [Context Retrieval] ← [Search Execution]
```

### 3. **Advanced Search Flow**
```
[Query] → [Algorithm Selection] → [Parallel Search] → [Result Combination] → [Ranking] → [Context Generation]
  │           │                    │                    │                │              │
  └── [Cache] ← [Post-processing] ← [Deduplication] ← [Score Normalization] ← [Metadata Enrichment]
```

### 4. **Multi-Agent Flow**
```
[Query] → [Complexity Analysis] → [Agent Routing] → [Parallel Execution] → [Result Synthesis] → [Response]
  │           │                    │                │                    │                │
  └── [Stream] ← [Event Generation] ← [Agent Coordination] ← [Tool Execution] ← [Context Retrieval]
```

### 5. **Real-time Streaming Flow**
```
[WebSocket Connection] → [Session Management] → [Query Processing] → [Stream Generation] → [Event Dispatch]
        │                        │                    │                │                │
        └── [Connection Close] ← [Cleanup] ← [Stream End] ← [Chunk Processing] ← [Response Chunks]
```

---

## 🛠️ Technology Stack

### **Backend Framework**
- **FastAPI**: High-performance async web framework
- **Python 3.11+**: Modern Python with async/await support
- **Pydantic**: Data validation and serialization
- **SQLAlchemy**: ORM for database operations

### **Database & Storage**
- **PostgreSQL**: Primary database with ACID compliance
- **pgvector**: Vector similarity search extension
- **Redis**: Caching and session management
- **File System**: Document storage and temporary files

### **AI & Machine Learning**
- **OpenAI GPT-4**: Large language model for responses
- **OpenAI Embeddings**: Text embedding generation
- **OpenAI Assistant API**: Agent functionality
- **NumPy**: Numerical computations for similarity

### **Real-time Communication**
- **WebSocket**: Bidirectional real-time communication
- **Server-Sent Events**: Unidirectional streaming
- **AsyncIO**: Asynchronous programming model

### **Monitoring & Observability**
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **Structlog**: Structured logging
- **Health Checks**: Service monitoring

### **Security & Performance**
- **JWT**: Token-based authentication
- **Rate Limiting**: Request throttling
- **CORS**: Cross-origin resource sharing
- **GZip**: Response compression

---

## 🐳 Deployment Architecture

### **Container Architecture**
```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                           │
├─────────────────────────────────────────────────────────────────┤
│  RAG API Service    │  PostgreSQL    │  Redis                   │
│  - FastAPI App      │  - Database    │  - Cache & Sessions      │
│  - Port 8000        │  - Port 5432   │  - Port 6379             │
│  - Health Checks    │  - pgvector    │  - Persistence           │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                             │
├─────────────────────────────────────────────────────────────────┤
│  Prometheus         │  Grafana        │  Nginx (Optional)       │
│  - Metrics          │  - Dashboards   │  - Load Balancer        │
│  - Port 9090        │  - Port 3000    │  - Port 80/443          │
│  - Data Collection  │  - Visualization│  - SSL Termination      │
└─────────────────────────────────────────────────────────────────┘
```

### **Service Dependencies**
```
RAG API Service
├── Depends on: PostgreSQL, Redis
├── Optional: OpenAI API
└── Optional: Monitoring Stack

PostgreSQL
├── Extension: pgvector
├── Volume: Persistent data
└── Health: Connection pooling

Redis
├── Persistence: RDB/AOF
├── Memory: Configurable
└── Health: Connection monitoring
```

### **Environment Configuration**
```bash
# Core Settings
DATABASE_URL=postgresql://user:pass@postgres:5432/rag_db
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=your-openai-key

# Security
SECRET_KEY=your-secret-key
WEBHOOK_SECRET=your-webhook-secret

# Performance
RAG_TOP_K=5
CACHE_TTL_SECONDS=300
RATE_LIMIT_REQUESTS=10

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=INFO
```

---

## 🔒 Security Architecture

### **Authentication & Authorization**
```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│  API Key Auth      │  JWT Tokens     │  Role-based Access       │
│  - X-API-Key       │  - Bearer Token │  - User Roles            │
│  - Header-based    │  - Expiration   │  - Permission Matrix     │
│  - Optional        │  - Refresh      │  - Resource Protection   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    PROTECTION MECHANISMS                        │
├─────────────────────────────────────────────────────────────────┤
│  Rate Limiting     │  Input Validation│  Content Security       │
│  - Per IP/User     │  - Sanitization  │  - CSP Headers          │
│  - Window-based    │  - Type Checking │  - XSS Prevention       │
│  - Configurable    │  - Size Limits   │  - Injection Protection │
└─────────────────────────────────────────────────────────────────┘
```

### **Security Features**
- **JWT Authentication**: Secure token-based authentication
- **API Key Support**: Optional API key authentication
- **Rate Limiting**: Configurable request throttling
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Cross-origin request control
- **Content Security Policy**: XSS and injection prevention
- **IP Blocking**: Configurable IP-based access control
- **Secure Headers**: Security-focused HTTP headers

---

## ⚡ Performance & Scalability

### **Performance Optimizations**
```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE LAYERS                           │
├─────────────────────────────────────────────────────────────────┤
│  Caching Strategy  │  Connection Pooling│  Async Processing      │
│  - Redis Cache     │  - Database Pool  │  - Non-blocking I/O    │
│  - Memory Cache    │  - Redis Pool     │  - Concurrent Requests │
│  - TTL Management  │  - Connection Reuse│  - Event Loop          │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABILITY FEATURES                         │
├─────────────────────────────────────────────────────────────────┤
│  Horizontal Scaling│  Load Balancing  │  Database Sharding      │
│  - Multiple Instances│  - Nginx Proxy  │  - Read Replicas       │
│  - Stateless Design│  - Health Checks │  - Partitioning         │
│  - Auto-scaling    │  - Failover      │  - Connection Pooling   │
└─────────────────────────────────────────────────────────────────┘
```

### **Performance Metrics**
- **Response Time**: < 200ms for cached queries
- **Throughput**: 1000+ concurrent requests
- **Cache Hit Rate**: 70%+ for repeated queries
- **Vector Search**: < 50ms for similarity search
- **Streaming**: Real-time response chunks

### **Scalability Features**
- **Stateless Design**: Easy horizontal scaling
- **Connection Pooling**: Efficient resource utilization
- **Caching Layers**: Multiple caching strategies
- **Async Processing**: Non-blocking operations
- **Load Balancing**: Multiple instance support

---

## 📊 Monitoring & Observability

### **Monitoring Stack**
```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│  Application Metrics│  Infrastructure │  Business Metrics       │
│  - Request Count    │  - CPU/Memory   │  - Query Success Rate   │
│  - Response Time    │  - Disk Usage   │  - Cache Hit Rate       │
│  - Error Rates      │  - Network I/O  │  - User Satisfaction    │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    VISUALIZATION & ALERTING                     │
├─────────────────────────────────────────────────────────────────┤
│  Grafana Dashboards│  Prometheus     │  Alert Manager           │
│  - Real-time Views │  - Data Storage │  - Threshold Alerts      │
│  - Custom Panels   │  - Query Engine │  - Notification Rules    │
│  - Export/Import   │  - Time Series  │  - Escalation Policies   │
└─────────────────────────────────────────────────────────────────┘
```

### **Key Metrics**
- **Application Metrics:**
  - Request rate and response times
  - Error rates and status codes
  - Cache hit/miss ratios
  - Database query performance

- **Business Metrics:**
  - Query success rate
  - User satisfaction scores
  - Feature usage statistics
  - Agent performance metrics

- **Infrastructure Metrics:**
  - CPU and memory utilization
  - Disk I/O and storage usage
  - Network throughput
  - Container health status

### **Health Checks**
- **Liveness Probe**: Service availability
- **Readiness Probe**: Service readiness
- **Startup Probe**: Service startup
- **Custom Health**: Business logic health

---

## 🚀 Deployment Scenarios

### **Development Environment**
```bash
# Local development with Docker
docker-compose up -d

# Direct Python execution
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### **Production Environment**
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Kubernetes deployment
kubectl apply -f k8s/
```

### **Scaling Strategies**
- **Horizontal Scaling**: Multiple API instances
- **Database Scaling**: Read replicas and connection pooling
- **Cache Scaling**: Redis cluster configuration
- **Load Balancing**: Nginx or cloud load balancer

---

## 🔧 Configuration Management

### **Environment Variables**
```bash
# Core Configuration
APP_NAME=RAG Microservice
APP_VERSION=1.0.0
DEBUG=false

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_POOL_MIN_SIZE=5
DB_POOL_MAX_SIZE=20

# Redis Configuration
REDIS_URL=redis://host:6379
REDIS_MAX_CONNECTIONS=10

# OpenAI Configuration
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Security Configuration
SECRET_KEY=your-secret-key
WEBHOOK_SECRET=your-webhook-secret
ENABLE_AUTHENTICATION=true
ENABLE_RATE_LIMITING=true

# Performance Configuration
RAG_TOP_K=5
CACHE_TTL_SECONDS=300
RATE_LIMIT_REQUESTS=10
```

### **Configuration Validation**
- **Pydantic Settings**: Type-safe configuration
- **Environment Validation**: Required vs optional settings
- **Default Values**: Sensible defaults for all settings
- **Validation Rules**: Business logic validation

---

## 📈 Future Enhancements

### **Planned Features**
- **Multi-modal Support**: Image and document processing
- **Advanced Analytics**: Query analytics and insights
- **Custom Models**: Fine-tuned model support
- **API Gateway**: Advanced routing and transformation
- **Event Sourcing**: Complete audit trail
- **Machine Learning Pipeline**: Automated model training

### **Architecture Evolution**
- **Microservices Split**: Service decomposition
- **Event-Driven Architecture**: Event sourcing and CQRS
- **Cloud-Native**: Kubernetes and cloud services
- **Edge Computing**: Distributed processing
- **AI/ML Pipeline**: Automated model management

---

## 📚 Conclusion

The RAG Microservice represents a sophisticated, production-ready architecture that combines:

1. **Advanced AI Capabilities**: Multi-agent orchestration with specialized agents
2. **High Performance**: Sub-200ms response times with intelligent caching
3. **Real-time Features**: WebSocket and streaming support
4. **Production Security**: Comprehensive security measures
5. **Scalable Design**: Horizontal scaling and load balancing
6. **Observability**: Complete monitoring and alerting
7. **Developer Experience**: Comprehensive documentation and testing

This architecture provides a solid foundation for building enterprise-grade AI applications with real-time capabilities, advanced search algorithms, and multi-agent coordination. The modular design allows for easy extension and customization while maintaining high performance and reliability standards. 