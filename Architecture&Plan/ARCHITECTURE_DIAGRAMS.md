# 🏗️ RAG Microservice - Architecture & Dataflow Diagrams

## 📊 System Architecture Overview

```mermaid
graph TB
    %% External Clients
    Client[Client Applications]
    WebClient[Web Browser]
    MobileApp[Mobile App]
    APIClient[API Client]
    
    %% Load Balancer & Gateway
    Nginx[Nginx Load Balancer<br/>Port 80/443]
    
    %% Main Application
    FastAPI[FastAPI Application<br/>Port 8000]
    
    %% API Endpoints
    subgraph "API Layer"
        AuthAPI[Authentication API]
        RAGAPI[RAG API]
        FileAPI[File Upload API]
        HealthAPI[Health API]
        WebSocketAPI[WebSocket API]
    end
    
    %% Business Logic
    subgraph "Business Logic Layer"
        AgentOrchestrator[Agent Orchestrator]
        RAGEngine[Advanced RAG Engine]
        StreamingService[Streaming Service]
        CacheService[Cache Service]
    end
    
    %% Services
    subgraph "Service Layer"
        SimilarityEngine[Similarity Engine]
        AIGenerator[AI Generator]
        BulkImporter[Bulk Importer]
        PerformanceMonitor[Performance Monitor]
        WebhookService[Webhook Service]
    end
    
    %% Data Layer
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>+ pgvector<br/>Port 5432)]
        Redis[(Redis<br/>Port 6379)]
        FileStorage[File Storage]
    end
    
    %% Monitoring Stack
    subgraph "Monitoring Stack"
        Prometheus[Prometheus<br/>Port 9090]
        Grafana[Grafana<br/>Port 3000]
        RedisExporter[Redis Exporter<br/>Port 9121]
        PostgresExporter[Postgres Exporter<br/>Port 9187]
    end
    
    %% External Services
    OpenAI[OpenAI API]
    
    %% Connections
    Client --> Nginx
    WebClient --> Nginx
    MobileApp --> Nginx
    APIClient --> Nginx
    
    Nginx --> FastAPI
    
    FastAPI --> AuthAPI
    FastAPI --> RAGAPI
    FastAPI --> FileAPI
    FastAPI --> HealthAPI
    FastAPI --> WebSocketAPI
    
    AuthAPI --> AgentOrchestrator
    RAGAPI --> AgentOrchestrator
    FileAPI --> RAGEngine
    WebSocketAPI --> StreamingService
    
    AgentOrchestrator --> RAGEngine
    RAGEngine --> SimilarityEngine
    RAGEngine --> AIGenerator
    StreamingService --> AIGenerator
    
    SimilarityEngine --> PostgreSQL
    AIGenerator --> OpenAI
    CacheService --> Redis
    BulkImporter --> PostgreSQL
    PerformanceMonitor --> Prometheus
    
    PostgreSQL --> PostgresExporter
    Redis --> RedisExporter
    PostgresExporter --> Prometheus
    RedisExporter --> Prometheus
    Prometheus --> Grafana
    
    FileAPI --> FileStorage
    RAGEngine --> FileStorage
    
    %% Styling
    classDef client fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef service fill:#fff3e0
    classDef data fill:#fce4ec
    classDef monitoring fill:#f1f8e9
    classDef external fill:#ffebee
    
    class Client,WebClient,MobileApp,APIClient client
    class AuthAPI,RAGAPI,FileAPI,HealthAPI,WebSocketAPI api
    class AgentOrchestrator,RAGEngine,StreamingService,CacheService business
    class SimilarityEngine,AIGenerator,BulkImporter,PerformanceMonitor,WebhookService service
    class PostgreSQL,Redis,FileStorage data
    class Prometheus,Grafana,RedisExporter,PostgresExporter monitoring
    class OpenAI external
```

## 🔄 Detailed Data Flow Diagram

### 1. Document Ingestion Flow

```mermaid
sequenceDiagram
    participant Client
    participant Nginx
    participant FastAPI
    participant FileAPI
    participant RAGEngine
    participant BulkImporter
    participant PostgreSQL
    participant Redis
    participant OpenAI
    
    Client->>Nginx: Upload Document
    Nginx->>FastAPI: Forward Request
    FastAPI->>FileAPI: Process Upload
    
    FileAPI->>RAGEngine: Extract Text
    RAGEngine->>BulkImporter: Process Document
    
    BulkImporter->>OpenAI: Generate Embeddings
    OpenAI-->>BulkImporter: Return Embeddings
    
    BulkImporter->>PostgreSQL: Store Document + Embeddings
    BulkImporter->>Redis: Cache Metadata
    
    PostgreSQL-->>BulkImporter: Confirm Storage
    BulkImporter-->>RAGEngine: Processing Complete
    RAGEngine-->>FileAPI: Document Processed
    FileAPI-->>FastAPI: Success Response
    FastAPI-->>Nginx: HTTP 200
    Nginx-->>Client: Document Uploaded
```

### 2. Query Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Nginx
    participant FastAPI
    participant AuthAPI
    participant AgentOrchestrator
    participant RAGEngine
    participant SimilarityEngine
    participant PostgreSQL
    participant Redis
    participant AIGenerator
    participant OpenAI
    participant StreamingService
    
    Client->>Nginx: Send Query
    Nginx->>FastAPI: Forward Request
    FastAPI->>AuthAPI: Authenticate User
    AuthAPI-->>FastAPI: Authentication Result
    
    FastAPI->>AgentOrchestrator: Route Query
    AgentOrchestrator->>RAGEngine: Process Query
    
    RAGEngine->>Redis: Check Cache
    alt Cache Hit
        Redis-->>RAGEngine: Cached Result
    else Cache Miss
        RAGEngine->>SimilarityEngine: Search Documents
        SimilarityEngine->>PostgreSQL: Vector Search
        PostgreSQL-->>SimilarityEngine: Relevant Documents
        SimilarityEngine-->>RAGEngine: Search Results
        
        RAGEngine->>AIGenerator: Generate Response
        AIGenerator->>OpenAI: API Call
        OpenAI-->>AIGenerator: AI Response
        AIGenerator-->>RAGEngine: Generated Response
        
        RAGEngine->>Redis: Cache Result
    end
    
    RAGEngine-->>AgentOrchestrator: Query Result
    AgentOrchestrator-->>FastAPI: Final Response
    FastAPI-->>Nginx: HTTP 200
    Nginx-->>Client: Query Response
```

### 3. Real-time Streaming Flow

```mermaid
sequenceDiagram
    participant Client
    participant Nginx
    participant WebSocketAPI
    participant StreamingService
    participant AgentOrchestrator
    participant RAGEngine
    participant AIGenerator
    participant OpenAI
    
    Client->>Nginx: WebSocket Connection
    Nginx->>WebSocketAPI: Upgrade Connection
    WebSocketAPI->>StreamingService: Initialize Stream
    
    Client->>WebSocketAPI: Send Query
    WebSocketAPI->>StreamingService: Process Query
    StreamingService->>AgentOrchestrator: Route Query
    
    AgentOrchestrator->>RAGEngine: Process Query
    RAGEngine->>AIGenerator: Generate Streaming Response
    AIGenerator->>OpenAI: Streaming API Call
    
    loop Response Chunks
        OpenAI-->>AIGenerator: Response Chunk
        AIGenerator-->>RAGEngine: Process Chunk
        RAGEngine-->>AgentOrchestrator: Forward Chunk
        AgentOrchestrator-->>StreamingService: Stream Chunk
        StreamingService-->>WebSocketAPI: Send Chunk
        WebSocketAPI-->>Client: WebSocket Message
    end
    
    OpenAI-->>AIGenerator: Stream Complete
    AIGenerator-->>RAGEngine: Generation Complete
    RAGEngine-->>AgentOrchestrator: Processing Complete
    AgentOrchestrator-->>StreamingService: Stream End
    StreamingService-->>WebSocketAPI: Close Stream
    WebSocketAPI-->>Client: Stream Complete
```

### 4. Multi-Agent Orchestration Flow

```mermaid
flowchart TD
    Query[User Query] --> ComplexityAnalysis{Complexity Analysis}
    
    ComplexityAnalysis -->|Simple| GeneralAgent[General Agent]
    ComplexityAnalysis -->|Analytical| AnalyticalAgent[Analytical Agent]
    ComplexityAnalysis -->|Creative| CreativeAgent[Creative Agent]
    ComplexityAnalysis -->|Technical| TechnicalAgent[Technical Agent]
    ComplexityAnalysis -->|Research| ResearchAgent[Research Agent]
    ComplexityAnalysis -->|Summary| SummaryAgent[Summary Agent]
    
    GeneralAgent --> ContextRetrieval[Context Retrieval]
    AnalyticalAgent --> ContextRetrieval
    CreativeAgent --> ContextRetrieval
    TechnicalAgent --> ContextRetrieval
    ResearchAgent --> ContextRetrieval
    SummaryAgent --> ContextRetrieval
    
    ContextRetrieval --> SearchAlgorithms[Search Algorithms]
    
    SearchAlgorithms --> SemanticSearch[Semantic Search]
    SearchAlgorithms --> KeywordSearch[Keyword Search]
    SearchAlgorithms --> HybridSearch[Hybrid Search]
    SearchAlgorithms --> FuzzySearch[Fuzzy Search]
    SearchAlgorithms --> ContextualSearch[Contextual Search]
    
    SemanticSearch --> ResultCombination[Result Combination]
    KeywordSearch --> ResultCombination
    HybridSearch --> ResultCombination
    FuzzySearch --> ResultCombination
    ContextualSearch --> ResultCombination
    
    ResultCombination --> Ranking[Result Ranking]
    Ranking --> ContextGeneration[Context Generation]
    ContextGeneration --> AgentExecution[Agent Execution]
    AgentExecution --> ResponseGeneration[Response Generation]
    ResponseGeneration --> FinalResponse[Final Response]
    
    %% Styling
    classDef input fill:#e3f2fd
    classDef agent fill:#f3e5f5
    classDef process fill:#e8f5e8
    classDef output fill:#fff3e0
    
    class Query input
    class GeneralAgent,AnalyticalAgent,CreativeAgent,TechnicalAgent,ResearchAgent,SummaryAgent agent
    class ContextRetrieval,SearchAlgorithms,ResultCombination,Ranking,ContextGeneration,AgentExecution,ResponseGeneration process
    class FinalResponse output
```

## 🏛️ Component Architecture Details

### 1. API Layer Components

```mermaid
graph LR
    subgraph "API Endpoints"
        Auth[Authentication<br/>- JWT Tokens<br/>- API Keys<br/>- Role-based Access]
        RAG[RAG Operations<br/>- Query Processing<br/>- Document Search<br/>- Response Generation]
        File[File Management<br/>- Upload/Download<br/>- Processing<br/>- Validation]
        Health[Health Monitoring<br/>- System Status<br/>- Module Health<br/>- Metrics]
        WS[WebSocket<br/>- Real-time Communication<br/>- Streaming<br/>- Session Management]
    end
    
    subgraph "Middleware Stack"
        CORS[CORS Middleware]
        GZip[GZip Compression]
        Security[Security Middleware]
        AuthMiddleware[Auth Middleware]
        CSP[CSP Middleware]
        RateLimit[Rate Limiting]
    end
    
    subgraph "Request Flow"
        Request[HTTP Request] --> CORS
        CORS --> GZip
        GZip --> Security
        Security --> AuthMiddleware
        AuthMiddleware --> CSP
        CSP --> RateLimit
        RateLimit --> Endpoint[API Endpoint]
    end
```

### 2. Business Logic Layer

```mermaid
graph TB
    subgraph "Agent Orchestrator"
        QueryAnalyzer[Query Analyzer<br/>- Complexity Assessment<br/>- Intent Detection<br/>- Agent Selection]
        AgentCoordinator[Agent Coordinator<br/>- Parallel Execution<br/>- Result Synthesis<br/>- Error Handling]
        AgentRegistry[Agent Registry<br/>- Agent Discovery<br/>- Capability Mapping<br/>- Load Balancing]
    end
    
    subgraph "RAG Engine"
        SearchOrchestrator[Search Orchestrator<br/>- Algorithm Selection<br/>- Parallel Search<br/>- Result Combination]
        ContextBuilder[Context Builder<br/>- Document Assembly<br/>- Relevance Scoring<br/>- Context Optimization]
        ResponseGenerator[Response Generator<br/>- Template Selection<br/>- Content Assembly<br/>- Quality Assurance]
    end
    
    subgraph "Streaming Service"
        StreamManager[Stream Manager<br/>- Connection Management<br/>- Event Routing<br/>- Resource Cleanup]
        ChunkProcessor[Chunk Processor<br/>- Content Chunking<br/>- Format Conversion<br/>- Delivery Optimization]
        SessionHandler[Session Handler<br/>- Session State<br/>- User Context<br/>- History Management]
    end
    
    QueryAnalyzer --> AgentCoordinator
    AgentCoordinator --> AgentRegistry
    SearchOrchestrator --> ContextBuilder
    ContextBuilder --> ResponseGenerator
    StreamManager --> ChunkProcessor
    ChunkProcessor --> SessionHandler
```

### 3. Data Layer Architecture

```mermaid
graph TB
    subgraph "PostgreSQL Database"
        Documents[(Documents Table<br/>- Document ID<br/>- Content<br/>- Metadata<br/>- Embeddings)]
        Conversations[(Conversations Table<br/>- Session ID<br/>- User ID<br/>- Query History<br/>- Timestamps)]
        Users[(Users Table<br/>- User ID<br/>- Credentials<br/>- Permissions<br/>- Settings)]
        Embeddings[(Embeddings Table<br/>- Vector Data<br/>- Dimensions<br/>- Indexes<br/>- Similarity Scores)]
    end
    
    subgraph "Redis Cache"
        QueryCache[Query Cache<br/>- Query Hash<br/>- Response Data<br/>- TTL Management]
        SessionCache[Session Cache<br/>- Session State<br/>- User Context<br/>- Temporary Data]
        RateLimitCache[Rate Limit Cache<br/>- IP Addresses<br/>- Request Counts<br/>- Time Windows]
    end
    
    subgraph "File Storage"
        UploadedFiles[Uploaded Files<br/>- Original Documents<br/>- Processed Files<br/>- Temporary Files]
        ProcessedDocs[Processed Documents<br/>- Extracted Text<br/>- Chunked Content<br/>- Metadata Files]
    end
    
    Documents --> Embeddings
    Conversations --> SessionCache
    Users --> SessionCache
    QueryCache --> RateLimitCache
    UploadedFiles --> ProcessedDocs
```

### 4. Monitoring & Observability

```mermaid
graph TB
    subgraph "Application Metrics"
        RequestMetrics[Request Metrics<br/>- Count<br/>- Duration<br/>- Status Codes<br/>- Error Rates]
        PerformanceMetrics[Performance Metrics<br/>- Response Time<br/>- Throughput<br/>- Resource Usage<br/>- Cache Hit Rate]
        BusinessMetrics[Business Metrics<br/>- Query Success Rate<br/>- User Satisfaction<br/>- Feature Usage<br/>- Agent Performance]
    end
    
    subgraph "Infrastructure Metrics"
        SystemMetrics[System Metrics<br/>- CPU Usage<br/>- Memory Usage<br/>- Disk I/O<br/>- Network I/O]
        ContainerMetrics[Container Metrics<br/>- Health Status<br/>- Resource Limits<br/>- Restart Count<br/>- Log Volume]
        DatabaseMetrics[Database Metrics<br/>- Connection Pool<br/>- Query Performance<br/>- Index Usage<br/>- Lock Contention]
    end
    
    subgraph "Monitoring Stack"
        Prometheus[Prometheus<br/>- Metrics Collection<br/>- Time Series DB<br/>- Alert Rules<br/>- Data Retention]
        Grafana[Grafana<br/>- Dashboards<br/>- Visualizations<br/>- Alert Notifications<br/>- Report Generation]
        AlertManager[Alert Manager<br/>- Threshold Monitoring<br/>- Notification Routing<br/>- Escalation Policies<br/>- Incident Management]
    end
    
    RequestMetrics --> Prometheus
    PerformanceMetrics --> Prometheus
    BusinessMetrics --> Prometheus
    SystemMetrics --> Prometheus
    ContainerMetrics --> Prometheus
    DatabaseMetrics --> Prometheus
    
    Prometheus --> Grafana
    Prometheus --> AlertManager
    Grafana --> AlertManager
```

## 🔧 Deployment Architecture

### 1. Docker Container Architecture

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        subgraph "Application Layer"
            RAGAPI[RAG API Container<br/>- FastAPI Application<br/>- Port 8000<br/>- Health Checks]
        end
        
        subgraph "Data Layer"
            PostgreSQL[PostgreSQL Container<br/>- Database Server<br/>- Port 5432<br/>- pgvector Extension]
            Redis[Redis Container<br/>- Cache Server<br/>- Port 6379<br/>- Persistence]
        end
        
        subgraph "Proxy Layer"
            Nginx[Nginx Container<br/>- Load Balancer<br/>- Port 80/443<br/>- SSL Termination]
        end
        
        subgraph "Monitoring Layer"
            Prometheus[Prometheus Container<br/>- Metrics Server<br/>- Port 9090<br/>- Data Collection]
            Grafana[Grafana Container<br/>- Dashboard Server<br/>- Port 3000<br/>- Visualization]
            RedisExporter[Redis Exporter<br/>- Port 9121<br/>- Redis Metrics]
            PostgresExporter[Postgres Exporter<br/>- Port 9187<br/>- DB Metrics]
        end
    end
    
    subgraph "External Services"
        OpenAI[OpenAI API<br/>- GPT Models<br/>- Embeddings<br/>- Assistant API]
    end
    
    Nginx --> RAGAPI
    RAGAPI --> PostgreSQL
    RAGAPI --> Redis
    RAGAPI --> OpenAI
    
    Prometheus --> RedisExporter
    Prometheus --> PostgresExporter
    RedisExporter --> Redis
    PostgresExporter --> PostgreSQL
    Prometheus --> Grafana
```

### 2. Network Architecture

```mermaid
graph TB
    subgraph "External Network"
        Internet[Internet<br/>- Client Requests<br/>- API Calls<br/>- WebSocket Connections]
    end
    
    subgraph "Load Balancer"
        Nginx[Nginx<br/>- SSL Termination<br/>- Load Balancing<br/>- Health Checks<br/>- Rate Limiting]
    end
    
    subgraph "Application Network (rag-network)"
        RAGAPI[RAG API<br/>- FastAPI Server<br/>- Async Workers<br/>- Connection Pooling]
        PostgreSQL[PostgreSQL<br/>- Database Server<br/>- Connection Pool<br/>- Replication]
        Redis[Redis<br/>- Cache Server<br/>- Session Store<br/>- Pub/Sub]
    end
    
    subgraph "Monitoring Network"
        Prometheus[Prometheus<br/>- Metrics Collection<br/>- Service Discovery<br/>- Alerting]
        Grafana[Grafana<br/>- Dashboards<br/>- User Interface<br/>- Reporting]
    end
    
    Internet --> Nginx
    Nginx --> RAGAPI
    RAGAPI --> PostgreSQL
    RAGAPI --> Redis
    RAGAPI --> Prometheus
    Prometheus --> Grafana
```

## 🔒 Security Architecture

### 1. Security Layers

```mermaid
graph TB
    subgraph "Network Security"
        Firewall[Firewall<br/>- Port Filtering<br/>- IP Whitelisting<br/>- DDoS Protection]
        SSL[SSL/TLS<br/>- Certificate Management<br/>- Encryption<br/>- Perfect Forward Secrecy]
    end
    
    subgraph "Application Security"
        Auth[Authentication<br/>- JWT Tokens<br/>- API Keys<br/>- OAuth Integration]
        Authorization[Authorization<br/>- Role-based Access<br/>- Permission Matrix<br/>- Resource Protection]
        InputValidation[Input Validation<br/>- Sanitization<br/>- Type Checking<br/>- Size Limits]
    end
    
    subgraph "Data Security"
        Encryption[Encryption<br/>- Data at Rest<br/>- Data in Transit<br/>- Key Management]
        Audit[Audit Logging<br/>- Access Logs<br/>- Change Tracking<br/>- Compliance]
    end
    
    subgraph "Runtime Security"
        RateLimit[Rate Limiting<br/>- Request Throttling<br/>- IP Blocking<br/>- Abuse Prevention]
        CSP[Content Security Policy<br/>- XSS Prevention<br/>- Injection Protection<br/>- Resource Control]
    end
    
    Firewall --> SSL
    SSL --> Auth
    Auth --> Authorization
    Authorization --> InputValidation
    InputValidation --> Encryption
    Encryption --> Audit
    Audit --> RateLimit
    RateLimit --> CSP
```

## 📈 Performance Architecture

### 1. Caching Strategy

```mermaid
graph TB
    subgraph "Multi-Level Caching"
        subgraph "Application Cache"
            MemoryCache[Memory Cache<br/>- In-process Storage<br/>- Fast Access<br/>- Limited Size]
        end
        
        subgraph "Distributed Cache"
            RedisCache[Redis Cache<br/>- Shared Storage<br/>- Persistence<br/>- TTL Management]
        end
        
        subgraph "Database Cache"
            QueryCache[Query Cache<br/>- Result Caching<br/>- Index Optimization<br/>- Connection Pooling]
        end
    end
    
    subgraph "Cache Invalidation"
        TTL[TTL-based Expiration<br/>- Time-based Cleanup<br/>- Memory Management<br/>- Performance Optimization]
        LRU[LRU Eviction<br/>- Least Recently Used<br/>- Memory Pressure<br/>- Cache Efficiency]
        Manual[Manual Invalidation<br/>- Event-driven<br/>- Data Consistency<br/>- User Control]
    end
    
    MemoryCache --> RedisCache
    RedisCache --> QueryCache
    TTL --> MemoryCache
    LRU --> RedisCache
    Manual --> QueryCache
```

### 2. Scalability Patterns

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        LoadBalancer[Load Balancer<br/>- Request Distribution<br/>- Health Checks<br/>- Failover]
        MultipleInstances[Multiple API Instances<br/>- Stateless Design<br/>- Session Management<br/>- Resource Sharing]
    end
    
    subgraph "Database Scaling"
        ReadReplicas[Read Replicas<br/>- Query Distribution<br/>- Load Balancing<br/>- High Availability]
        ConnectionPooling[Connection Pooling<br/>- Resource Management<br/>- Performance Optimization<br/>- Connection Reuse]
    end
    
    subgraph "Cache Scaling"
        RedisCluster[Redis Cluster<br/>- Data Partitioning<br/>- High Availability<br/>- Fault Tolerance]
        CacheSharding[Cache Sharding<br/>- Key Distribution<br/>- Load Balancing<br/>- Performance Scaling]
    end
    
    LoadBalancer --> MultipleInstances
    MultipleInstances --> ReadReplicas
    ReadReplicas --> ConnectionPooling
    ConnectionPooling --> RedisCluster
    RedisCluster --> CacheSharding
```

## 🚀 Future Architecture Evolution

### 1. Microservices Split

```mermaid
graph TB
    subgraph "Current Monolithic Architecture"
        Monolith[RAG Microservice<br/>- All Components<br/>- Single Deployment<br/>- Shared Resources]
    end
    
    subgraph "Future Microservices Architecture"
        AuthService[Authentication Service<br/>- User Management<br/>- JWT Handling<br/>- Permission Control]
        RAGService[RAG Service<br/>- Core RAG Logic<br/>- Document Processing<br/>- Query Handling]
        SearchService[Search Service<br/>- Vector Search<br/>- Similarity Engine<br/>- Index Management]
        AIService[AI Service<br/>- Model Management<br/>- Response Generation<br/>- Agent Orchestration]
        FileService[File Service<br/>- Document Storage<br/>- Processing Pipeline<br/>- Metadata Management]
        NotificationService[Notification Service<br/>- Webhooks<br/>- Event Publishing<br/>- Message Queuing]
    end
    
    subgraph "Service Communication"
        API[API Gateway<br/>- Request Routing<br/>- Load Balancing<br/>- Service Discovery]
        MessageQueue[Message Queue<br/>- Event Streaming<br/>- Service Communication<br/>- Reliability]
    end
    
    Monolith --> AuthService
    Monolith --> RAGService
    Monolith --> SearchService
    Monolith --> AIService
    Monolith --> FileService
    Monolith --> NotificationService
    
    API --> AuthService
    API --> RAGService
    API --> SearchService
    API --> AIService
    API --> FileService
    API --> NotificationService
    
    MessageQueue --> AuthService
    MessageQueue --> RAGService
    MessageQueue --> SearchService
    MessageQueue --> AIService
    MessageQueue --> FileService
    MessageQueue --> NotificationService
```

This comprehensive architecture and dataflow documentation provides a complete view of the RAG Microservice system, including:

1. **System Architecture Overview**: High-level component relationships
2. **Detailed Data Flow Diagrams**: Step-by-step process flows
3. **Component Architecture**: Detailed breakdown of each layer
4. **Deployment Architecture**: Container and network setup
5. **Security Architecture**: Multi-layered security approach
6. **Performance Architecture**: Caching and scaling strategies
7. **Future Evolution**: Planned architectural improvements

The diagrams use Mermaid syntax and can be rendered in any Markdown viewer that supports Mermaid diagrams, providing a visual understanding of the complete system architecture and data flows. 