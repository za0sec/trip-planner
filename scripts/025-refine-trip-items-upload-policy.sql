-- Drop the previous, simpler insert policy for "trip-items" bucket, if it exists.
-- It's important to remove or alter the old one to avoid conflicts or unintended behavior.
DROP POLICY IF EXISTS "Authenticated Users Can Upload Trip Items" ON storage.objects;

-- Create a new, more specific insert policy for the "trip-items" bucket.
-- This policy allows an authenticated user to insert an object (upload a file)
-- if the bucket is "trip-items" AND the file path (name) starts with their own user ID.
CREATE POLICY "Users Can Upload To Own Path In Trip Items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-items' AND
  auth.uid()::text = split_part(name, '/', 1) -- Ensures the first part of the path matches the uploader's UID
);

-- Note: The SELECT, UPDATE, and DELETE policies from script 024 should remain.
-- This script specifically targets and refines the INSERT (upload) permission.
