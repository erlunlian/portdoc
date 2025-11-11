# PortDoc

A production-ready PDF reading and study application with AI-powered chat, highlights, and intelligent document management.

## Features

- 📚 **PDF Library Management**: Upload, organize, and manage your PDF documents
- 📖 **In-Browser PDF Reader**: Read PDFs with text selection and page navigation
- 💬 **AI Chat**: Chat with an LLM about your documents using RAG (Retrieval-Augmented Generation)
- ✨ **Highlights**: Create, manage, and annotate highlights within PDFs
- 🧵 **Multi-Thread Conversations**: Maintain multiple chat threads per document
- 📊 **Read State Tracking**: Auto-save reading progress and last viewed page
- 🔐 **Authentication**: Secure user auth with Supabase
- 🗄️ **Vector Search**: Semantic search powered by pgvector embeddings

## Tech Stack

### Frontend
- **Next.js 14+** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **react-pdf** - PDF rendering
- **TanStack Query** - Data fetching and caching
- **Supabase Auth** - Authentication

### Backend
- **FastAPI** (Python 3.11+) - API framework
- **SQLAlchemy 2.0** (async) - ORM
- **Alembic** - Database migrations
- **PostgreSQL + pgvector** - Database with vector search
- **PyMuPDF** - PDF text extraction
- **Ollama** - Local LLM and embeddings
- **Supabase** - Auth, Storage, and Database

## Project Structure

```
/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/         # App Router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities
│   │   └── package.json
│   └── api/                 # FastAPI backend
│       ├── main.py          # FastAPI app
│       ├── config.py        # Settings
│       ├── db/              # Database models
│       ├── routers/         # API endpoints
│       ├── services/        # Business logic
│       ├── schemas/         # Pydantic schemas
│       ├── migrations/      # Alembic migrations
│       └── tests/           # Tests
├── packages/
│   ├── ui/                  # Shared UI components
│   └── types/               # Shared TypeScript types
├── infra/
│   ├── docker-compose.yml   # Local development stack
│   ├── supabase/            # Supabase config and migrations
│   └── Dockerfile.api       # API Dockerfile
└── scripts/                 # Development scripts
```

## How to Run

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- Docker and Docker Compose
- Ollama (local LLM/embeddings provider)

### Quick Start

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
   ```

3. **Setup environment variables**
   ```bash
   # Root .env (used by both Docker Compose and API)
   cp .env.example .env
   
   # Frontend
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   Fill in the required values (especially JWT secrets and API keys). See the [Configuration](#configuration) section for details.

4. **Start infrastructure**
   ```bash
   cd infra
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   cd apps/api
   source venv/bin/activate
   alembic upgrade head
   psql postgresql://postgres:postgres@localhost:54322/postgres < ../../infra/supabase/setup_rls.sql
   psql postgresql://postgres:postgres@localhost:54322/postgres < ../../infra/supabase/setup_storage.sql
   ```

6. **Start development servers**

   Terminal 1 - Backend:
   ```bash
   cd apps/api
   source venv/bin/activate
   uvicorn main:app --reload --port 8000
   ```

   Terminal 2 - Frontend:
   ```bash
   cd apps/web
   pnpm dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs
   - Supabase Studio: http://localhost:54323

## How to Set Up Local Dev Environment

This section provides detailed instructions for setting up the development environment from scratch.

### Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Python** 3.11+
- **Docker** and **Docker Compose**
- **Ollama** installed locally (models are downloaded on first run)

### Step 1: Install Dependencies

```bash
# Install frontend dependencies
pnpm install

# Install backend dependencies
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### Step 2: Configure Environment Variables

The root `.env` file has been created with sensible defaults for local development and is now **Ollama-only**. There is a single `.env` file at the root of the project used by both Docker Compose and the FastAPI backend.

#### Configure Ollama (required)

Install and start Ollama locally:

1. **Install Ollama**:
   - Visit https://ollama.ai and download for your OS
   - Or use Homebrew on macOS: `brew install ollama`
   - Or use the install script: `curl -fsSL https://ollama.ai/install.sh | sh`

2. **Start Ollama service**:
   ```bash
   # Ollama usually starts automatically, but you can start it manually:
   ollama serve
   ```
   The service runs on `http://localhost:11434` by default.

3. **Pull the models**:
   ```bash
   # Pull the chat model (this downloads it locally)
   ollama pull gemma3:12b
   
   # Pull the embedding model
   ollama pull mxbai-embed-large
   ```

4. **Verify Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```
   You should see a list of available models.

5. **Verify `.env` configuration** (already set by default):

   ```bash
   OLLAMA_BASE_URL=http://localhost:11434/v1
   OLLAMA_MODEL=gemma3:12b
   OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
   ```

**Note**: Ollama models need to be downloaded locally, which can take several GB of disk space. Make sure you have enough space and a good internet connection for the initial download.

#### Frontend Configuration

The file `apps/web/.env.local` is already configured for local development and doesn't need changes.

### Step 3: Start Supabase and Infrastructure

```bash
cd infra
docker-compose up -d
```

This starts:
- PostgreSQL with pgvector (port 54322)
- Supabase Auth, Storage, and Realtime
- Supabase Studio (port 54323)
- Kong API Gateway (port 54321)

**Wait about 30 seconds** for all services to be ready.

### Step 4: Run Database Migrations

```bash
cd apps/api
source venv/bin/activate  # If not already activated
alembic upgrade head
```

### Step 5: Setup Row Level Security (RLS) Policies

```bash
# From the project root
psql postgresql://postgres:postgres@localhost:54322/postgres < infra/supabase/setup_rls.sql
```

If you don't have `psql` installed, you can run the SQL via Supabase Studio:
1. Open http://localhost:54323
2. Go to SQL Editor
3. Paste the contents of `infra/supabase/setup_rls.sql`
4. Run the query

### Step 6: Setup Storage Bucket

The storage bucket needs to be created. Run this SQL via Supabase Studio or psql:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres < infra/supabase/setup_storage.sql
```

### Step 7: Start the Backend API

```bash
# In one terminal
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Step 8: Start the Frontend

```bash
# In another terminal
cd apps/web
pnpm dev
```

The frontend will be available at: http://localhost:3000

### Verify Setup

1. **Check Supabase Studio**: http://localhost:54323
   - You should see all the tables (users, documents, chunks, etc.)

2. **Check API Docs**: http://localhost:8000/docs
   - You should see all the endpoints

3. **Open the App**: http://localhost:3000
   - You should be redirected to the login page

4. **Create an Account**:
   - Click "Sign up"
   - Enter an email and password
   - You should be logged in and see the dashboard

### Troubleshooting

#### Port Already in Use

If you get "port already in use" errors:
```bash
# Check what's using the port
lsof -i :54322  # or :54321, :8000, :3000
# Kill the process or stop Docker containers
docker-compose down
```

#### Database Connection Error

If the API can't connect to the database:
```bash
# Check if PostgreSQL is running
docker-compose ps
# Restart if needed
docker-compose restart db
```

#### JWT Verification Fails

Make sure the `SUPABASE_JWT_SECRET` and `JWT_SECRET` are set correctly in the root `.env` file.

#### LLM Issues (Ollama)

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check that the model is pulled: `ollama list`
- If a model is missing, pull it: `ollama pull <model-name>`
- Ensure the service is accessible: `curl http://localhost:11434/api/version`
- Inspect logs if issues persist: `ollama logs`
- Confirm the model names in `.env` match the pulled models (case-sensitive)

#### Storage Upload Fails

Make sure the storage bucket exists:
```sql
-- Run in Supabase Studio SQL Editor
SELECT * FROM storage.buckets WHERE id = 'pdfs';
```

If it doesn't exist, run the `setup_storage.sql` script again.

### Development Workflow

#### Running Everything

```bash
# Terminal 1: Infrastructure
cd infra && docker-compose up

# Terminal 2: Backend
cd apps/api && source venv/bin/activate && uvicorn main:app --reload

# Terminal 3: Frontend
cd apps/web && pnpm dev
```

#### Viewing Logs

```bash
# Supabase logs
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f auth
```

#### Accessing Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Supabase Studio**: http://localhost:54323
- **PostgreSQL**: localhost:54322

#### Stopping Services

```bash
# Stop Docker services
cd infra && docker-compose down

# To also remove volumes (clears database)
docker-compose down -v
```

## Configuration

### Environment Variables

#### Frontend (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL

#### Backend & Infrastructure (Root `.env`)
This single `.env` file at the root is used by both Docker Compose and the FastAPI backend.

**Database & Supabase:**
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_PASSWORD` - PostgreSQL password for Docker services
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_PUBLIC_URL` - Supabase public URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_JWT_SECRET` - JWT secret for token verification
- `ANON_KEY` - Supabase anonymous key (for Docker services)
- `SERVICE_ROLE_KEY` - Supabase service role key (for Docker services)
- `JWT_SECRET` - JWT secret (for Docker services)
- `STORAGE_BUCKET` - Supabase storage bucket name (default: pdfs)

**LLM Configuration (Ollama only):**
- `OLLAMA_BASE_URL` - Ollama API URL (default: http://localhost:11434/v1)
- `OLLAMA_MODEL` - Chat model name (default: gemma3:12b)
- `OLLAMA_EMBEDDING_MODEL` - Embedding model name (default: mxbai-embed-large)

**Application Configuration:**
- `ENVIRONMENT` - Environment name (default: development)
- `LOG_LEVEL` - Logging level (default: INFO)
- `CORS_ORIGINS` - CORS allowed origins (JSON array string)

**Docker Compose / Supabase Auth:**
- `SITE_URL` - Site URL for auth redirects
- `API_EXTERNAL_URL` - External API URL
- `DISABLE_SIGNUP` - Disable user signup
- `ENABLE_EMAIL_SIGNUP` - Enable email signup
- `ENABLE_EMAIL_AUTOCONFIRM` - Auto-confirm email signups
- `PGRST_DB_SCHEMAS` - PostgREST database schemas

### Ollama Setup Checklist

1. Install Ollama from https://ollama.ai
2. Pull the required models: 
   ```bash
   ollama pull gemma3:12b
   ollama pull mxbai-embed-large
   ```
3. Start the Ollama service (runs automatically on most systems)
4. Verify Ollama is running: `curl http://localhost:11434/api/tags`

### Supabase Setup (Hosted)

If using hosted Supabase instead of local:

1. Create a new Supabase project
2. Enable pgvector extension in SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run migrations using the provided SQL files in `infra/supabase/`
4. Create storage bucket "pdfs" with appropriate policies
5. Update environment variables with your project credentials

## Development

### Running Tests

Backend:
```bash
cd apps/api
pytest
```

Frontend:
```bash
cd apps/web
pnpm test
pnpm test:e2e  # Playwright tests
```

### Linting and Formatting

```bash
# Frontend
pnpm lint
pnpm format

# Backend
cd apps/api
ruff check .
black .
mypy .
```

### Database Migrations

Create a new migration:
```bash
cd apps/api
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback:
```bash
alembic downgrade -1
```

## API Documentation

The API is fully documented with OpenAPI/Swagger:
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

### Main Endpoints

- `POST /v1/documents/upload` - Get signed URL for PDF upload
- `POST /v1/documents/{id}/ingest` - Trigger PDF processing
- `GET /v1/documents` - List user's documents
- `GET /v1/documents/{id}/highlights` - Get highlights for document
- `POST /v1/documents/{id}/highlights` - Create highlight
- `POST /v1/threads` - Create chat thread
- `GET /v1/threads/{id}/stream` - Stream LLM responses (SSE)
- `POST /v1/search` - Semantic search over document

## Architecture

### Data Flow

1. **Upload**: User uploads PDF → Supabase Storage → Document record created
2. **Ingestion**: Background job extracts text → Creates chunks → Generates embeddings → Stores in DB
3. **Chat**: User sends message → Retrieves relevant chunks via vector search → Sends to LLM with context → Streams response
4. **Highlights**: User selects text → Captures coordinates → Stores in DB → Renders overlay

### Database Schema

- **users** - User profiles
- **documents** - PDF metadata and status
- **document_read_states** - Reading progress per user
- **highlights** - Text highlights with coordinates
- **chunks** - Document text chunks with embeddings
- **threads** - Chat conversations
- **messages** - Chat messages
- **chat_runs** - Observability metrics

### Security

- Row Level Security (RLS) policies on all user data
- JWT authentication via Supabase
- Scoped storage access (users can only access their PDFs)
- Rate limiting on chat endpoints
- Input validation and sanitization

## Deployment

### Frontend (Vercel)

```bash
cd apps/web
vercel
```

Environment variables to set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

### Backend (Fly.io / Render)

1. Build Docker image:
   ```bash
   docker build -f infra/Dockerfile.api -t pdf-study-api apps/api
   ```

2. Deploy to your platform of choice with environment variables

### Database (Supabase Hosted)

Use hosted Supabase for production:
1. Create project on supabase.com
2. Run migrations
3. Configure RLS policies
4. Update connection strings

## Performance Optimization

- **Lazy loading**: PDF pages and components loaded on demand
- **Caching**: TanStack Query caches API responses
- **Pagination**: Documents and messages paginated
- **Batch processing**: Embeddings generated in batches
- **Vector index**: IVFFlat index on embeddings for fast retrieval
- **Connection pooling**: SQLAlchemy async connection pool

## Troubleshooting

### Common Issues

**PostgreSQL connection error**:
- Check Docker containers are running: `docker-compose ps`
- Verify DATABASE_URL in the root `.env` file

**Authentication failing**:
- Check JWT_SECRET matches between Supabase and API
- Verify Supabase URL and keys are correct

**PDF upload fails**:
- Check storage bucket exists and RLS policies are set
- Verify SUPABASE_SERVICE_ROLE_KEY is set in the root `.env` file

**Embeddings/Chat not working**:
- Verify LLM_API_KEY is valid
- Check LLM_BASE_URL is accessible
- Ensure document status is "ready"

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Additional Documentation

- **API Documentation**: Available at `http://localhost:8000/docs` when running locally

