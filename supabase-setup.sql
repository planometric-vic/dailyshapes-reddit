-- Supabase Setup for Daily Shapes v4.0
-- Run these queries in the Supabase SQL Editor

-- 1. Enable Row Level Security on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Create policy to allow public read access to the shapes bucket
-- This allows anonymous users to download shapes
CREATE POLICY "Public read access for shapes bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'shapes');

-- 3. Optional: Create policy to allow authenticated users to upload shapes
-- (Only needed if you plan to upload shapes via the app)
CREATE POLICY "Authenticated users can upload to shapes bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shapes');

-- 4. Optional: Create policy to allow authenticated users to update shapes
-- (Only needed if you plan to update shapes via the app)
CREATE POLICY "Authenticated users can update shapes bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'shapes');

-- 5. Optional: Create policy to allow authenticated users to delete shapes
-- (Only needed if you plan to delete shapes via the app)
CREATE POLICY "Authenticated users can delete from shapes bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'shapes');

-- 6. Verify the bucket exists and check permissions
-- Run this to see your bucket and current policies
SELECT
    bucket_id,
    name,
    owner,
    created_at,
    updated_at
FROM storage.objects
WHERE bucket_id = 'shapes'
LIMIT 5;

-- 7. Check current RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';