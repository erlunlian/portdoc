-- This script sets up Row Level Security (RLS) policies
-- Run this after the tables are created via Alembic migrations

-- Function to automatically create a user in public.users when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure function is owned by postgres (which has BYPASSRLS) so it can bypass RLS
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Trigger to call the function when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_read_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON users;
    DROP POLICY IF EXISTS "Users can create their own profile" ON users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON users;
    DROP POLICY IF EXISTS "Service role can insert users" ON users;
    DROP POLICY IF EXISTS "Service role can select users" ON users;
END $$;

-- Users table policies
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Service role can manage users (needed for Supabase Auth during signup)
CREATE POLICY "Service role can insert users"
    ON users FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can select users"
    ON users FOR SELECT
    TO service_role
    USING (true);

-- Documents table policies
CREATE POLICY "Users can view their own documents"
    ON documents FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own documents"
    ON documents FOR DELETE
    USING (auth.uid() = owner_id);

-- Document read states policies
CREATE POLICY "Users can view their own read states"
    ON document_read_states FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own read states"
    ON document_read_states FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read states"
    ON document_read_states FOR UPDATE
    USING (auth.uid() = user_id);

-- Highlights policies
CREATE POLICY "Users can view their own highlights"
    ON highlights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own highlights"
    ON highlights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
    ON highlights FOR DELETE
    USING (auth.uid() = user_id);

-- Threads policies
CREATE POLICY "Users can view their own threads"
    ON threads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own threads"
    ON threads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
    ON threads FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads"
    ON threads FOR DELETE
    USING (auth.uid() = user_id);

-- Messages policies (via thread ownership)
CREATE POLICY "Users can view messages in their threads"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM threads
            WHERE threads.id = messages.thread_id
            AND threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their threads"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM threads
            WHERE threads.id = messages.thread_id
            AND threads.user_id = auth.uid()
        )
    );

-- Chunks policies (read-only for document owners)
CREATE POLICY "Users can view chunks from their documents"
    ON chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = chunks.document_id
            AND documents.owner_id = auth.uid()
        )
    );

-- Service role can do everything (for ingestion)
CREATE POLICY "Service role can manage chunks"
    ON chunks FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Chat runs policies (via thread ownership)
CREATE POLICY "Users can view chat runs in their threads"
    ON chat_runs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM threads
            WHERE threads.id = chat_runs.thread_id
            AND threads.user_id = auth.uid()
        )
    );

-- Grant permissions to authenticated users
GRANT ALL ON users TO authenticated;
GRANT ALL ON documents TO authenticated;
GRANT ALL ON document_read_states TO authenticated;
GRANT ALL ON highlights TO authenticated;
GRANT ALL ON threads TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT SELECT ON chunks TO authenticated;
GRANT SELECT ON chat_runs TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant necessary permissions to supabase_auth_admin for trigger function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.users TO supabase_auth_admin;

