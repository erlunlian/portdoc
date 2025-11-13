# PortDoc

A PDF reading and study application with AI-powered chat, highlights, and document management.

## Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- Docker and Docker Compose
- Ollama (for local LLM and embeddings)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd e-reader
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   pnpm install

   # Backend
   cd apps/api
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ../..
   ```

3. **Install and configure Ollama**
   
   Install Ollama from https://ollama.ai or use Homebrew:
   ```bash
   brew install ollama
   ```

   Pull the required models:
   ```bash
   ollama pull gpt-oss:20b
   ollama pull mxbai-embed-large
   ```

   Start Ollama (usually runs automatically):
   ```bash
   ollama serve
   ```

4. **Start infrastructure services**
   ```bash
   cd infra
   docker-compose up -d
   cd ..
   ```

   Wait about 30 seconds for services to initialize.

5. **Run database migrations**
   ```bash
   cd apps/api
   source venv/bin/activate
   alembic upgrade head
   ```

## Running the Application

Start the backend and frontend in separate terminals:

**Terminal 1 - Backend:**
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
pnpm dev
```

## Access

- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs

## Troubleshooting

**Port already in use:**
```bash
docker-compose down
```

**Database connection errors:**
```bash
docker-compose restart db
```

**Ollama not working:**
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check models are pulled
ollama list
```

## License

MIT
