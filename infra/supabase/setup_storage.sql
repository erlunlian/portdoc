-- This script sets up Supabase Storage for PDF files
-- Run this via Supabase Dashboard or SQL editor

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pdfs',
    'pdfs',
    false,
    104857600,  -- 100MB limit
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotency)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own PDFs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own PDFs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own PDFs" ON storage.objects;
    DROP POLICY IF EXISTS "Service role can manage all PDFs" ON storage.objects;
END $$;

-- Storage policies for PDFs bucket
-- Note: Supabase storage.objects uses RLS, so policies need to be properly scoped

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'pdfs' AND
    auth.uid() IS NOT NULL AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Allow users to view their own PDFs
CREATE POLICY "Users can view their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'pdfs' AND
    auth.uid() IS NOT NULL AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Allow users to delete their own PDFs
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'pdfs' AND
    auth.uid() IS NOT NULL AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Allow users to update their own PDFs (for upsert operations)
-- Note: SELECT FOR UPDATE requires UPDATE permission even when row doesn't exist
CREATE POLICY "Users can update their own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'pdfs' AND
    auth.uid() IS NOT NULL AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'pdfs' AND
    auth.uid() IS NOT NULL AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Service role can manage all PDFs
CREATE POLICY "Service role can manage all PDFs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'pdfs')
WITH CHECK (bucket_id = 'pdfs');

-- Storage buckets table policies
-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role can manage buckets" ON storage.buckets;
    DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
END $$;

-- Service role can do everything with buckets
CREATE POLICY "Service role can manage buckets"
ON storage.buckets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users can view buckets (needed for storage operations)
CREATE POLICY "Authenticated users can view buckets"
ON storage.buckets FOR SELECT
TO authenticated
USING (true);

-- Grant table-level permissions (RLS policies require these)
-- Note: Even with BYPASSRLS, service_role still needs GRANT permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
-- Grant ALL privileges to service_role (needed for PostgREST operations)
GRANT ALL PRIVILEGES ON storage.objects TO service_role;
GRANT ALL PRIVILEGES ON storage.buckets TO service_role;

-- Storage admin policies (for direct database access, bypasses PostgREST)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Storage admin can query objects for upsert" ON storage.objects;
    DROP POLICY IF EXISTS "Storage admin can update objects for upsert" ON storage.objects;
END $$;

CREATE POLICY "Storage admin can query objects for upsert"
ON storage.objects FOR SELECT
TO supabase_storage_admin
USING (true);

CREATE POLICY "Storage admin can update objects for upsert"  
ON storage.objects FOR UPDATE
TO supabase_storage_admin
USING (true)
WITH CHECK (true);

GRANT SELECT, UPDATE ON storage.objects TO supabase_storage_admin;

