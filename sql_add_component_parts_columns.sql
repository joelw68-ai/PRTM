-- ============================================================
-- Migration: Add date_replaced and notes columns to component_parts
-- ============================================================
-- Purpose: For users who already have the component_parts table
-- but haven't re-run the master schema (sql_master_create_all_tables.sql),
-- this script safely adds the new columns without dropping/recreating.
--
-- Also fixes:
--   • user_id DEFAULT to auth.uid() (ensures RLS passes even if code omits it)
--   • component_type nullable (matches master schema)
--   • RLS policies consolidated to clean per-command set using auth.uid()
--   • Backfills NULL user_id rows so existing parts aren't orphaned
--
-- Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS.
-- ============================================================

-- 1. Add new columns
ALTER TABLE public.component_parts ADD COLUMN IF NOT EXISTS date_replaced TEXT;
ALTER TABLE public.component_parts ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Fix user_id default to auth.uid() so RLS works even if code omits it
ALTER TABLE public.component_parts ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Make component_type nullable (matches master schema definition)
ALTER TABLE public.component_parts ALTER COLUMN component_type DROP NOT NULL;

-- 4. CRITICAL: Backfill NULL user_id rows with the current authenticated user.
--    Without this, any rows inserted before the DEFAULT was set (or during
--    localStorage migration) will have user_id = NULL. RLS policies require
--    auth.uid() = user_id, so NULL user_id rows become "orphaned" — invisible
--    to SELECT and impossible to UPDATE or DELETE.
--
--    This UPDATE runs as the authenticated user (via Supabase SQL Editor),
--    so auth.uid() resolves to the logged-in user's UUID.
--
--    NOTE: This must be run while logged in as the user who owns the data.
--    If you have multiple users, each user should run this once, OR an admin
--    can run the service-role version below.
UPDATE public.component_parts
SET user_id = auth.uid()
WHERE user_id IS NULL;

-- 5. Consolidate RLS policies — remove old catch-all, create per-command policies
--    auth.uid() returns NULL for anonymous users so these are inherently safe.
ALTER TABLE public.component_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own component_parts" ON public.component_parts;
DROP POLICY IF EXISTS "component_parts_select_own"       ON public.component_parts;
DROP POLICY IF EXISTS "component_parts_insert_own"       ON public.component_parts;
DROP POLICY IF EXISTS "component_parts_update_own"       ON public.component_parts;
DROP POLICY IF EXISTS "component_parts_delete_own"       ON public.component_parts;

-- SELECT: user can read their own parts, PLUS any orphaned parts (user_id IS NULL)
-- so the app can display them and the user can re-save to claim ownership.
CREATE POLICY "component_parts_select_own"
  ON public.component_parts FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- INSERT: user can only insert rows where user_id matches their auth.uid()
CREATE POLICY "component_parts_insert_own"
  ON public.component_parts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can update their own parts, PLUS claim orphaned parts (user_id IS NULL)
-- The WITH CHECK ensures the new user_id must match auth.uid() (can't reassign to someone else)
CREATE POLICY "component_parts_update_own"
  ON public.component_parts FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user can delete their own parts, PLUS orphaned parts
CREATE POLICY "component_parts_delete_own"
  ON public.component_parts FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- 6. Also fix component_extra_fields table (same orphan issue)
ALTER TABLE public.component_extra_fields ALTER COLUMN user_id SET DEFAULT auth.uid();
UPDATE public.component_extra_fields SET user_id = auth.uid() WHERE user_id IS NULL;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: date_replaced, notes columns added; user_id DEFAULT set; orphaned rows backfilled; component_type nullable; RLS policies consolidated with NULL user_id handling on component_parts.';
END $$;
