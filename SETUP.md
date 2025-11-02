# Local Development Setup Guide

This guide will help you set up the PortDoc for local development.

## Quick Start (TL;DR)

For local development, you need **3 terminals**:

```bash
# Terminal 1: Infrastructure (Supabase, PostgreSQL, etc.)
cd infra
docker-compose up -d

# Terminal 2: Backend API (with hot reload)
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 3: Frontend (with hot reload)
cd apps/web
pnpm dev
```

**Important**: The API and Webapp are run **manually** (not in Docker) for hot reload during development. Only infrastructure runs in Docker.

## Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Python** 3.11+
- **Docker** and **Docker Compose**
- **Azure OpenAI** API key and endpoint (OR **OpenAI** API key)

## Step-by-Step Setup

### 1. Install Dependencies

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

### 2. Configure Environment Variables

The `.env` files have been created with sensible defaults for local development. You **MUST** configure your LLM provider.

#### Option A: Using Azure OpenAI (Default)

The app is pre-configured for Azure OpenAI. Update both `infra/.env` and `apps/api/.env`:

```bash
# Azure OpenAI Configuration
LLM_PROVIDER=azure
LLM_API_KEY=your-azure-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4  # Your deployment name
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-ada-002  # Your deployment name

# Also update embedding keys
EMBEDDING_API_KEY=your-azure-api-key-here
AZURE_EMBEDDING_ENDPOINT=https://your-resource-name.openai.azure.com/
```

**Where to find these values:**
- **API Key**: Azure Portal → Your OpenAI Resource → Keys and Endpoint → KEY 1
- **Endpoint**: Azure Portal → Your OpenAI Resource → Keys and Endpoint → Endpoint
- **Deployment Names**: Azure OpenAI Studio → Deployments → (your deployment names)

#### Option B: Using Standard OpenAI

To use standard OpenAI instead, update both `infra/.env` and `apps/api/.env`:

```bash
# Change provider to openai
LLM_PROVIDER=openai

# Standard OpenAI Configuration
LLM_API_KEY=sk-your-openai-api-key-here
LLM_MODEL=gpt-4-turbo-preview

EMBEDDING_API_KEY=sk-your-openai-api-key-here
EMBEDDING_MODEL=text-embedding-3-small
```

Get your OpenAI API key from: https://platform.openai.com/api-keys

#### Frontend Configuration

The file `apps/web/.env.local` is already configured for local development and doesn't need changes.

### 3. Start Supabase and Infrastructure

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

### 4. Run Database Migrations

```bash
cd apps/api
source venv/bin/activate  # If not already activated
alembic upgrade head
```

### 5. Setup Row Level Security (RLS) Policies

```bash
# From the project root
psql postgresql://postgres:postgres@localhost:54322/postgres < infra/supabase/setup_rls.sql
```

If you don't have `psql` installed, you can run the SQL via Supabase Studio:
1. Open http://localhost:54323
2. Go to SQL Editor
3. Paste the contents of `infra/supabase/setup_rls.sql`
4. Run the query

### 6. Setup Storage Bucket

The storage bucket needs to be created. Run this SQL via Supabase Studio or psql:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres < infra/supabase/setup_storage.sql
```

### 7. Start the Backend API

```bash
# In one terminal
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 8. Start the Frontend

```bash
# In another terminal
cd apps/web
pnpm dev
```

The frontend will be available at: http://localhost:3000

## Verify Setup

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

## Common Issues

### Port Already in Use

If you get "port already in use" errors:
```bash
# Check what's using the port
lsof -i :54322  # or :54321, :8000, :3000
# Kill the process or stop Docker containers
docker-compose down
```

### Database Connection Error

If the API can't connect to the database:
```bash
# Check if PostgreSQL is running
docker-compose ps
# Restart if needed
docker-compose restart db
```

### JWT Verification Fails

Make sure the `SUPABASE_JWT_SECRET` is the same in:
- `infra/.env`
- `apps/api/.env`

### LLM API Errors

**Azure OpenAI:**
- Verify your endpoint URL is correct
- Check deployment names match exactly (case-sensitive)
- Ensure deployments are in "Succeeded" state in Azure Portal
- Verify your API key is valid

**Standard OpenAI:**
- Make sure you've set valid API keys
- Check your OpenAI account has sufficient credits
- Verify the model name is correct

### Storage Upload Fails

Make sure the storage bucket exists:
```sql
-- Run in Supabase Studio SQL Editor
SELECT * FROM storage.buckets WHERE id = 'pdfs';
```

If it doesn't exist, run the `setup_storage.sql` script again.

## Development Workflow

### Running Everything

```bash
# Terminal 1: Infrastructure
cd infra && docker-compose up

# Terminal 2: Backend
cd apps/api && source venv/bin/activate && uvicorn main:app --reload

# Terminal 3: Frontend
cd apps/web && pnpm dev
```

### Viewing Logs

```bash
# Supabase logs
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f auth
```

### Accessing Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Supabase Studio**: http://localhost:54323
- **PostgreSQL**: localhost:54322

### Stopping Services

```bash
# Stop Docker services
cd infra && docker-compose down

# To also remove volumes (clears database)
docker-compose down -v
```

## Next Steps

1. Upload a PDF through the web interface
2. Wait for it to process (status will change from "processing" to "ready")
3. Click on the document to open the viewer
4. Try chatting with the PDF

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) (to be created).

