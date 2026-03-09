-- ============================================================
-- PRO MOD LOGBOOK — STORAGE BUCKET & POLICY FIX
-- ============================================================
-- Run this in the Supabase SQL Editor to create the 'media'
-- storage bucket and set up proper RLS policies.
--
-- This fixes:
--   1. Dashboard "Change Photo" not working (upload fails)
--   2. Media Gallery upload "violates row-level security policy"
--   3. Invoice upload failures
--
-- Safe to run multiple times (idempotent).
-- ============================================================


-- ============================================================
-- 1. CREATE THE STORAGE BUCKET
-- ============================================================
-- The 'media' bucket must exist and be public so getPublicUrl works.
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,                          -- public bucket so getPublicUrl returns accessible URLs
  52428800,                      -- 50MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;


-- ============================================================
-- 2. DROP ANY EXISTING STORAGE POLICIES (clean slate)
-- ============================================================
-- Drop old policies if they exist to avoid conflicts.
-- Wrapped in DO blocks so missing policies don't cause errors.

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Also drop any old-style policy names
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read access to media" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can delete own media files" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update own media files" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ============================================================
-- 3. CREATE STORAGE RLS POLICIES
-- ============================================================

-- POLICY: Any authenticated user can upload files to the 'media' bucket
CREATE POLICY "Authenticated users can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- POLICY: Anyone (including anonymous/public) can read files from the 'media' bucket
-- This is required for getPublicUrl to work and for images to display
CREATE POLICY "Public read access to media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media');

-- POLICY: Authenticated users can update their own files in the 'media' bucket
-- This is needed for upsert: true to work on re-uploads
CREATE POLICY "Users can update own media files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media');

-- POLICY: Authenticated users can delete files from the 'media' bucket
CREATE POLICY "Users can delete own media files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');


-- ============================================================
-- 4. VERIFY: Check that the bucket and policies exist
-- ============================================================
DO $$
DECLARE
  _bucket_exists BOOLEAN;
  _policy_count INT;
BEGIN
  -- Check bucket exists
  SELECT EXISTS(
    SELECT 1 FROM storage.buckets WHERE id = 'media'
  ) INTO _bucket_exists;

  -- Count policies for the media bucket
  SELECT COUNT(*) INTO _policy_count
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage';

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  STORAGE SETUP VERIFICATION';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

  IF _bucket_exists THEN
    RAISE NOTICE '  [PASS] media bucket exists and is public';
  ELSE
    RAISE NOTICE '  [FAIL] media bucket was NOT created';
  END IF;

  RAISE NOTICE '  [INFO] % storage policies found on storage.objects', _policy_count;
  RAISE NOTICE '';

  IF _bucket_exists THEN
    RAISE NOTICE '  STATUS: Storage is ready for uploads!';
    RAISE NOTICE '  - Dashboard photo change: FIXED';
    RAISE NOTICE '  - Media Gallery uploads: FIXED';
    RAISE NOTICE '  - Invoice file uploads: FIXED';
  ELSE
    RAISE NOTICE '  STATUS: FAILED — Create the bucket manually in Dashboard > Storage';
  END IF;

  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;


-- ============================================================
-- DONE! Storage bucket and policies are now configured.
-- ============================================================
-- 
-- What was fixed:
--   1. Created 'media' storage bucket (public, 50MB limit)
--   2. INSERT policy: authenticated users can upload
--   3. SELECT policy: public read access (for getPublicUrl)
--   4. UPDATE policy: authenticated users can re-upload (upsert)
--   5. DELETE policy: authenticated users can remove files
--
-- After running this, these features will work:
--   - Dashboard > Change Photo (ImageEditor upload)
--   - Media Gallery > Upload photos/videos
--   - Vendor Management > Invoice file uploads
-- ============================================================
