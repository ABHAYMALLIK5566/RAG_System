# �� RAG Microservice - Operation Manual

**Version:** 1.0.0  
**Platform:** Windows (PowerShell), Linux, macOS, Docker

---

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Docker Usage](#docker-usage)
4. [API Usage](#api-usage)
5. [Monitoring & Health](#monitoring--health)
6. [Troubleshooting & FAQ](#troubleshooting--faq)
7. [Best Practices](#best-practices)
8. [Further Reading](#further-reading)

---

## 1. Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- OpenAI API Key

### Setup Steps
```powershell
# Clone the repository
cd <your-workspace>
git clone <your-repo-url> Task_Supernomics
cd Task_Supernomics

# Create and activate virtual environment (for development)
python -m venv venv
.\venv\Scripts\Activate.ps1  # On Windows
# source venv/bin/activate    # On Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Copy environment template and edit
Copy-Item env.example .env
notepad .env  # Set your OPENAI_API_KEY and other secrets
```

### Start All Services (Docker)
```powershell
docker-compose up -d
```

---

## 2. Environment Setup

- All configuration is managed via `.env` (see `env.example` for options).
- Required: `OPENAI_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`
- Edit `.env` with your credentials and settings.

---

## 3. Docker Usage

### Start/Stop Services
```powershell
docker-compose up -d         # Start all services
docker-compose down          # Stop all services
docker-compose logs -f       # View logs
```

### Health Checks
```powershell
curl http://localhost:8000/health
curl http://localhost:8000/health/modules
```

### Monitoring (Prometheus & Grafana)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Grafana: [http://localhost:3000](http://localhost:3000)

---

## 4. API Usage

### Interactive Docs
- [http://localhost:8000/docs](http://localhost:8000/docs)

### Example: RAG Query
```http
POST /api/v1/rag/query
{
  "query": "What is FastAPI?",
  "use_agent": true
}
```

### Example: WebSocket Streaming
```javascript
const ws = new WebSocket('ws://localhost:8000/ws?session_id=your-session');
ws.send(JSON.stringify({ type: "query", data: { query: "What is machine learning?" } }));
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "chunk") {
    console.log(data.data.content);
  }
};
```

---

## 5. Monitoring & Health
- Health: `/health`, `/health/modules`, `/health/metrics`
- Prometheus metrics: `/health/metrics`
- Logs: `docker-compose logs -f rag-api`

---

## 6. Troubleshooting & FAQ

**Q: Service won't start?**
- Check `.env` for missing/incorrect values.
- Run `docker-compose logs` for error details.

**Q: OpenAI API errors?**
- Ensure your API key is valid and not rate-limited.
- Check network/firewall settings.

**Q: Database or Redis connection issues?**
- Make sure Docker containers for `postgres` and `redis` are running.
- Check connection strings in `.env`.

**Q: Health check fails?**
- Use `/health/modules` to identify the failing module.
- Check logs for detailed error messages.

**Q: How do I update dependencies?**
- Activate your venv and run `pip freeze > requirements.txt` after installing new packages.

---

## 7. Best Practices
- Use Docker for consistent, production-like environments.
- Keep your `.env` file secure and never commit secrets.
- Regularly check `/health` and `/health/modules` for system status.
- Use Prometheus and Grafana for monitoring and alerting.
- Test API endpoints using the interactive docs or tools like Postman.
- For development, use a virtual environment and keep dependencies up to date.

---

## 8. Further Reading
- [README.md](README.md): Project overview and quick start
- [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md): Full architecture details
- [MODULAR_ARCHITECTURE.md](MODULAR_ARCHITECTURE.md): Modular system and best practices

---

**For any issues not covered here, check the logs and consult the full documentation.** 