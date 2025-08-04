# RAG_System

A modular Retrieval-Augmented Generation (RAG) system with a Python backend, user/admin React frontends, and detailed architecture documentation. Features pluggable modules, secure APIs, Dockerized infrastructure, and comprehensive tests.

## Features
- Modular architecture for easy extensibility
- Real-time RAG operations with sub-200ms response times
- OpenAI GPT-4 integration
- Intelligent document retrieval and context generation
- PostgreSQL + pgvector for vector storage and similarity search
- Redis caching for high performance
- WebSocket support for real-time communication
- Secure webhook system with HMAC signatures
- Production-ready: Docker, health checks, monitoring
- Scalable, stateless API design

## Architecture
See [`Architecture&Plan/ARCHITECTURE_SUMMARY.md`](Architecture&Plan/ARCHITECTURE_SUMMARY.md) for a complete overview and diagrams.

## Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- OpenAI API Key

### 1. Clone and Setup
```bash
git clone git@github.com:ABHAYMALLIK5566/RAG_System.git
cd RAG_System
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env and set your OPENAI_API_KEY and other required values
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
```

### 4. Check Service Health
```bash
curl http://localhost:8000/health
```
Or open [http://localhost:8000/health](http://localhost:8000/health) in your browser.

### 5. Access API Documentation
Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

## Frontend
- `frontend-user/`: User-facing React app
- `frontend-admin/`: Admin-facing React app

## Documentation
- See the `Architecture&Plan/` directory for detailed docs, diagrams, and API endpoint references.

## License
MIT 