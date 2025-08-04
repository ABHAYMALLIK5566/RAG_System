# 🚀 RAG Microservice

A production-ready **Retrieval-Augmented Generation (RAG)** microservice with real-time capabilities, built using a **modular architecture** and advanced AI integration.

## 🌟 Key Features

- **Modular Architecture**: Clean separation of concerns with independent modules
- **Real-time RAG Operations**: Sub-200ms response times
- **OpenAI Integration**: Advanced AI-powered responses with GPT-4
- **Intelligent RAG**: Smart document retrieval and context generation
- **PostgreSQL + pgvector**: Optimized vector storage and similarity search
- **Redis Caching**: Intelligent cache management (70%+ hit rate)
- **WebSocket Support**: Real-time communication
- **Webhook System**: Secure HMAC signatures and retry logic
- **Production-Ready**: Docker, health checks, and monitoring
- **Scalable Design**: Horizontal scaling, stateless API

## 🏗️ Architecture Overview

See [`ARCHITECTURE_SUMMARY.md`](ARCHITECTURE_SUMMARY.md) for a complete, up-to-date architecture reference.

### System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  HTTP API (FastAPI)  │  WebSocket  │  Server-Sent Events       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  API Endpoints      │  Middleware    │  Authentication          │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Agent Orchestrator │  Advanced RAG  │  Streaming Service       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  RAG Engine         │  Cache Service │  Webhook Service         │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                   │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector │  Redis        │  File Storage          │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- OpenAI API Key

### 1. Clone and Setup
```bash
git clone <your-repo>
cd Task_Supernomics

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration
```bash
cp env.example .env
# Edit .env with your configuration (REQUIRED: Set your OPENAI_API_KEY)
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
# Check service health
curl http://localhost:8000/health
```

## 📚 API Documentation

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Core Endpoints
- `POST /api/v1/rag/query` — Core RAG query
- `POST /api/v1/rag/query/stream` — Streaming query (SSE)
- `POST /api/v1/rag/documents` — Add document
- `POST /api/v1/rag/documents/bulk` — Bulk add documents
- `GET /api/v1/rag/context/{query}` — Get RAG context
- `GET /health` — Health check
- `GET /health/modules` — Module health
- `GET /health/metrics` — Prometheus metrics
- `GET /ws` — WebSocket endpoint

### WebSocket Example
```javascript
const ws = new WebSocket('ws://localhost:8000/ws?session_id=your-session');
ws.send(JSON.stringify({ type: "query", data: { query: "What is machine learning?", options: { use_agent: true } } }));
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "chunk") {
    console.log(data.data.content);
  }
};
```

## 🔧 Configuration

See `env.example` for all environment variables. Key variables:
- `OPENAI_API_KEY` (required)
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `RAG_TOP_K`
- `CACHE_TTL_SECONDS`
- `RATE_LIMIT_REQUESTS`

## 🐳 Deployment

### Docker Compose
```bash
docker-compose up -d
```

### Kubernetes (example)
```bash
kubectl apply -f k8s/
```

## 🔒 Security
- JWT authentication, API keys, and role-based access
- Rate limiting, CORS, and CSP
- Webhook HMAC signatures

## 📊 Monitoring & Observability
- Prometheus metrics and Grafana dashboards
- Health checks: `/health`, `/health/modules`, `/health/metrics`

## 🧪 Testing
```bash
pytest tests/
```

## 🛠️ Troubleshooting
- See logs with `docker-compose logs -f rag-api`
- Check health endpoints for diagnostics

## 📄 License
MIT License

---

**For full architecture details, see [`ARCHITECTURE_SUMMARY.md`](ARCHITECTURE_SUMMARY.md).** 