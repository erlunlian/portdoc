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
- **OpenAI / Azure OpenAI** - LLM and embeddings (configurable)
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

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- Docker and Docker Compose
- **Azure OpenAI** API key and endpoint, OR **OpenAI** API key

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
   # Root .env
   cp .env.example .env
   
   # Frontend
   cp apps/web/.env.local.example apps/web/.env.local
   
   # Backend
   cp apps/api/.env.example apps/api/.env
   
   # Docker infrastructure
   cp infra/.env.example infra/.env
   ```

   Fill in the required values (especially JWT secrets and API keys).

   **For Azure OpenAI users**: The default configuration is set for Azure OpenAI. Update these values:
   - `LLM_API_KEY` - Your Azure OpenAI API key
   - `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com/`)
   - `AZURE_OPENAI_DEPLOYMENT_NAME` - Your GPT-4 deployment name
   - `AZURE_EMBEDDING_DEPLOYMENT_NAME` - Your embedding model deployment name
   
   **For standard OpenAI users**: Change `LLM_PROVIDER=openai` and set:
   - `LLM_API_KEY` - Your OpenAI API key (starts with `sk-`)
   - `LLM_MODEL` - Model name (e.g., `gpt-4-turbo-preview`)
   - `EMBEDDING_MODEL` - Embedding model (e.g., `text-embedding-3-small`)

4. **Start local Supabase stack**
   ```bash
   cd infra
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL with pgvector (port 54322)
   - Supabase Studio (port 54323)
   - Supabase Auth, Storage, Realtime
   - Kong API Gateway (port 54321)

5. **Run database migrations**
   ```bash
   cd apps/api
   alembic upgrade head
   ```

   Then run the RLS setup SQL:
   ```bash
   psql postgresql://postgres:postgres@localhost:54322/postgres < ../../infra/supabase/setup_rls.sql
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

## Configuration

### Environment Variables

#### Frontend (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL

#### Backend (`apps/api/.env`)
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_JWT_SECRET` - JWT secret for token verification
- `LLM_PROVIDER` - Set to `azure` or `openai`
- **Azure OpenAI**:
  - `LLM_API_KEY` - Azure OpenAI API key
  - `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
  - `AZURE_OPENAI_DEPLOYMENT_NAME` - Your GPT deployment name
  - `AZURE_EMBEDDING_DEPLOYMENT_NAME` - Your embedding deployment name
- **Standard OpenAI** (if `LLM_PROVIDER=openai`):
  - `LLM_API_KEY` - OpenAI API key
  - `LLM_MODEL` - Model name (e.g., gpt-4-turbo-preview)
  - `EMBEDDING_MODEL` - Embedding model (e.g., text-embedding-3-small)
- `STORAGE_BUCKET` - Supabase storage bucket name (default: pdfs)

### Azure OpenAI Setup

The app is configured by default to use Azure OpenAI. To set it up:

1. **Create Azure OpenAI Resource** in Azure Portal
2. **Deploy Models**:
   - Deploy a chat model (e.g., GPT-4, GPT-3.5-turbo) 
   - Deploy an embedding model (text-embedding-ada-002)
   - Note your deployment names
3. **Get Credentials** from Azure Portal:
   - API Key (Keys and Endpoint section)
   - Endpoint URL (e.g., `https://your-resource.openai.azure.com/`)
4. **Update `.env` files** with your Azure values

**To switch to standard OpenAI instead:**
1. Set `LLM_PROVIDER=openai` in your `.env` files
2. Update with OpenAI API key and models
3. Comment out Azure-specific variables

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
- Verify DATABASE_URL in .env

**Authentication failing**:
- Check JWT_SECRET matches between Supabase and API
- Verify Supabase URL and keys are correct

**PDF upload fails**:
- Check storage bucket exists and RLS policies are set
- Verify SUPABASE_SERVICE_ROLE_KEY is set in backend

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

- **Azure OpenAI Setup**: See `docs/AZURE_OPENAI.md` for detailed Azure OpenAI configuration
- **Local Development**: See `SETUP.md` for step-by-step local setup guide
- **API Documentation**: Available at `http://localhost:8000/docs` when running locally

