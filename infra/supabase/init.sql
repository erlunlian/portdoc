-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom schemas
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS auth;

-- Set schema ownership
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

-- Create auth roles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'postgres';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'postgres';
    END IF;
    -- Grant BYPASSRLS to storage admin so it can manage storage tables
    ALTER ROLE supabase_storage_admin BYPASSRLS;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin LOGIN PASSWORD 'postgres';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
    END IF;
END$$;

-- Grant necessary permissions
GRANT anon, authenticated, service_role TO authenticator;
-- Storage admin needs to be able to SET ROLE to these roles
GRANT service_role TO supabase_storage_admin WITH ADMIN OPTION;
GRANT authenticated TO supabase_storage_admin WITH ADMIN OPTION;
GRANT anon TO supabase_storage_admin WITH ADMIN OPTION;
GRANT CREATE ON DATABASE postgres TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO postgres, supabase_admin, supabase_storage_admin;

-- Grant permissions for auth schema
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

-- Grant permissions for auth admin in public schema
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

-- Grant permissions for storage schema
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_storage_admin;
-- Ensure storage admin has full permissions on storage objects
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;

-- Set search_path for auth admin to include auth schema first
ALTER ROLE supabase_auth_admin SET search_path = auth, public;

-- Storage tables and policies will be managed by Supabase Storage service

-- Enable RLS by default
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO 'your-super-secret-jwt-token-with-at-least-32-characters-long';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';

