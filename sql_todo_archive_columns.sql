-- ============================================================
-- TODO ITEMS — ADD MISSING ARCHIVE COLUMNS
-- ============================================================
-- Run this in the Supabase SQL Editor to add the archive columns
-- that were missing from the live database (causing PGRST204).
--
-- Safe to run multiple times: uses IF NOT EXISTS.
--
-- After running this, the archive/restore functionality in the
-- To Do List will work. The core add/edit/delete/complete flows
-- already work WITHOUT these columns (they were removed from
-- the upsertToDoItem payload).
-- ============================================================

-- 1. Add is_archived column
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 2. Add archived_at column
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS archived_at TEXT;

-- 3. Add archived_by column
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

-- 4. Add index for filtering archived items
CREATE INDEX IF NOT EXISTS idx_todo_items_archived
  ON public.todo_items(is_archived);

-- 5. Add composite index for user + archived queries
CREATE INDEX IF NOT EXISTS idx_todo_items_user_archived
  ON public.todo_items(user_id, is_archived);

-- 6. Verify the columns were added
DO $$
DECLARE
  _col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'todo_items'
    AND column_name IN ('is_archived', 'archived_at', 'archived_by');

  IF _col_count = 3 THEN
    RAISE NOTICE '[OK] All 3 archive columns exist: is_archived, archived_at, archived_by';
  ELSE
    RAISE NOTICE '[WARN] Only % of 3 archive columns found. Check for errors above.', _col_count;
  END IF;
END $$;

-- ============================================================
-- IMPORTANT: After running this migration, you may need to
-- reload the PostgREST schema cache. In Supabase Dashboard:
--   Settings → API → Click "Reload schema cache"
-- Or wait a few minutes for the automatic cache refresh.
-- ============================================================
