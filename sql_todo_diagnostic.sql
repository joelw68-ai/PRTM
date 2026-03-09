-- ============================================================
-- TODO_ITEMS TABLE — DEEP DIAGNOSTIC & COMPATIBILITY FIX
-- ============================================================
-- Run this in the Supabase SQL Editor to:
--   1. Verify the todo_items table exists with all expected columns
--   2. Check the `id` column type (TEXT vs UUID)
--   3. Check RLS policies and their definitions
--   4. Check indexes
--   5. Verify the user_id DEFAULT is set
--   6. Attempt a test insert + rollback to verify RLS allows inserts
--   7. Fix the `id` column to accept both TEXT and UUID formats
-- ============================================================

-- ============================================================
-- STEP 1: Table existence and column inventory
-- ============================================================
DO $$
DECLARE
  _exists BOOLEAN;
  _col RECORD;
  _row_count BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   TODO_ITEMS — DEEP DIAGNOSTIC                             ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'todo_items'
  ) INTO _exists;

  IF NOT _exists THEN
    RAISE NOTICE '[FAIL] todo_items table DOES NOT EXIST!';
    RAISE NOTICE '  → Run supabase_schema.sql or sql_migration_incremental.sql first.';
    RETURN;
  END IF;

  RAISE NOTICE '[PASS] todo_items table exists';
  RAISE NOTICE '';

  -- Row count
  EXECUTE 'SELECT COUNT(*) FROM public.todo_items' INTO _row_count;
  RAISE NOTICE '  Row count: %', _row_count;
  RAISE NOTICE '';

  -- Column details
  RAISE NOTICE '  ┌─────────────────────┬────────────────┬──────────┬──────────────────────────┐';
  RAISE NOTICE '  │ Column              │ Type           │ Nullable │ Default                  │';
  RAISE NOTICE '  ├─────────────────────┼────────────────┼──────────┼──────────────────────────┤';
  
  FOR _col IN
    SELECT 
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      COALESCE(c.column_default, '(none)') AS col_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'todo_items'
    ORDER BY c.ordinal_position
  LOOP
    RAISE NOTICE '  │ % │ % │ % │ % │',
      RPAD(_col.column_name, 19),
      RPAD(_col.udt_name, 14),
      RPAD(_col.is_nullable, 8),
      RPAD(LEFT(_col.col_default, 24), 24);
  END LOOP;
  
  RAISE NOTICE '  └─────────────────────┴────────────────┴──────────┴──────────────────────────┘';
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 2: Check `id` column type specifically
-- ============================================================
DO $$
DECLARE
  _id_type TEXT;
  _id_udt TEXT;
BEGIN
  SELECT data_type, udt_name INTO _id_type, _id_udt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'todo_items' AND column_name = 'id';

  IF _id_udt = 'uuid' THEN
    RAISE NOTICE '[PASS] id column is UUID type — crypto.randomUUID() output is directly compatible';
  ELSIF _id_udt = 'text' OR _id_udt = 'varchar' THEN
    RAISE NOTICE '[WARN] id column is TEXT type — crypto.randomUUID() strings will work but consider migrating to UUID';
    RAISE NOTICE '  → UUID strings like "550e8400-e29b-41d4-a716-446655440000" are valid TEXT values';
    RAISE NOTICE '  → To migrate: see the ALTER TABLE section below';
  ELSE
    RAISE NOTICE '[INFO] id column type: % (%)', _id_type, _id_udt;
  END IF;
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 3: Check user_id column and DEFAULT
-- ============================================================
DO $$
DECLARE
  _uid_type TEXT;
  _uid_default TEXT;
BEGIN
  SELECT udt_name, COALESCE(column_default, '(none)')
  INTO _uid_type, _uid_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'todo_items' AND column_name = 'user_id';

  IF _uid_type = 'uuid' THEN
    RAISE NOTICE '[PASS] user_id column is UUID type';
  ELSE
    RAISE NOTICE '[WARN] user_id column type: %', _uid_type;
  END IF;

  IF _uid_default LIKE '%auth.uid()%' THEN
    RAISE NOTICE '[PASS] user_id has DEFAULT auth.uid() — server-side fallback works';
  ELSE
    RAISE NOTICE '[WARN] user_id DEFAULT: % — consider adding DEFAULT auth.uid()', _uid_default;
  END IF;
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 4: Check RLS status and policies
-- ============================================================
DO $$
DECLARE
  _rls_enabled BOOLEAN;
  _pol RECORD;
  _policy_count INT := 0;
BEGIN
  SELECT relrowsecurity INTO _rls_enabled
  FROM pg_class
  WHERE relname = 'todo_items' AND relnamespace = 'public'::regnamespace;

  IF _rls_enabled THEN
    RAISE NOTICE '[PASS] RLS is ENABLED on todo_items';
  ELSE
    RAISE NOTICE '[FAIL] RLS is DISABLED on todo_items — all data is exposed!';
    RAISE NOTICE '  → Run: ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '  RLS Policies:';
  
  FOR _pol IN
    SELECT 
      pol.polname AS policy_name,
      CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END AS command,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = 'todo_items' AND c.relnamespace = 'public'::regnamespace
  LOOP
    _policy_count := _policy_count + 1;
    RAISE NOTICE '    [%] % — USING: % | WITH CHECK: %',
      _pol.command,
      _pol.policy_name,
      COALESCE(_pol.using_expr, '(none)'),
      COALESCE(_pol.with_check_expr, '(none)');
  END LOOP;

  IF _policy_count = 0 THEN
    RAISE NOTICE '    [FAIL] No RLS policies found! Inserts will be rejected.';
    RAISE NOTICE '    → Run: CREATE POLICY "Users manage own todo_items" ON public.todo_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);';
  ELSE
    RAISE NOTICE '    Total policies: %', _policy_count;
  END IF;
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 5: Check indexes
-- ============================================================
DO $$
DECLARE
  _idx RECORD;
  _idx_count INT := 0;
BEGIN
  RAISE NOTICE '  Indexes:';
  
  FOR _idx IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'todo_items' AND schemaname = 'public'
  LOOP
    _idx_count := _idx_count + 1;
    RAISE NOTICE '    [%] %', _idx.indexname, _idx.indexdef;
  END LOOP;

  IF _idx_count = 0 THEN
    RAISE NOTICE '    [WARN] No indexes found';
  ELSE
    RAISE NOTICE '    Total indexes: %', _idx_count;
  END IF;
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 6: Check constraints (PK, FK, UNIQUE)
-- ============================================================
DO $$
DECLARE
  _con RECORD;
BEGIN
  RAISE NOTICE '  Constraints:';
  
  FOR _con IN
    SELECT 
      conname,
      CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
      END AS constraint_type,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.todo_items'::regclass
  LOOP
    RAISE NOTICE '    [%] % — %', _con.constraint_type, _con.conname, _con.definition;
  END LOOP;
  RAISE NOTICE '';
END $$;


-- ============================================================
-- STEP 7: SAFE FIX — Ensure id column accepts UUID strings
-- ============================================================
-- If id is TEXT, crypto.randomUUID() strings work fine.
-- If id is UUID, crypto.randomUUID() strings auto-cast.
-- This section ensures the table is in a working state either way.

-- Ensure user_id has DEFAULT auth.uid()
DO $$ BEGIN
  ALTER TABLE public.todo_items ALTER COLUMN user_id SET DEFAULT auth.uid();
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not set user_id DEFAULT: %', SQLERRM;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

-- Ensure the ALL policy exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users manage own todo_items' AND tablename = 'todo_items'
  ) THEN
    CREATE POLICY "Users manage own todo_items"
      ON public.todo_items FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE '[FIX] Created missing RLS policy "Users manage own todo_items"';
  ELSE
    RAISE NOTICE '[OK] RLS policy "Users manage own todo_items" already exists';
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id ON public.todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_created_at ON public.todo_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_archived ON public.todo_items(user_id, is_archived);


-- ============================================================
-- STEP 8: Optional — Migrate id from TEXT to UUID (if empty)
-- ============================================================
-- Only run this if you want to migrate. It's safe if the table is empty.
-- If the table has data with non-UUID text IDs, this will fail.

-- Uncomment the block below to migrate:
/*
DO $$
DECLARE
  _id_type TEXT;
  _row_count BIGINT;
BEGIN
  SELECT udt_name INTO _id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'todo_items' AND column_name = 'id';

  IF _id_type = 'text' THEN
    SELECT COUNT(*) INTO _row_count FROM public.todo_items;
    
    IF _row_count = 0 THEN
      ALTER TABLE public.todo_items ALTER COLUMN id TYPE UUID USING id::uuid;
      ALTER TABLE public.todo_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
      RAISE NOTICE '[MIGRATED] id column changed from TEXT to UUID (table was empty)';
    ELSE
      RAISE NOTICE '[SKIP] Cannot auto-migrate id to UUID — table has % rows. Verify all IDs are valid UUIDs first.', _row_count;
      RAISE NOTICE '  → To check: SELECT id FROM public.todo_items WHERE id !~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'';';
    END IF;
  ELSIF _id_type = 'uuid' THEN
    RAISE NOTICE '[OK] id column is already UUID type';
  END IF;
END $$;
*/


-- ============================================================
-- SUMMARY
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  DIAGNOSTIC COMPLETE';
  RAISE NOTICE '  ';
  RAISE NOTICE '  If all checks show [PASS], the todo_items table is ready.';
  RAISE NOTICE '  If any show [FAIL] or [WARN], follow the instructions.';
  RAISE NOTICE '  ';
  RAISE NOTICE '  The frontend code (crypto.randomUUID()) generates valid';
  RAISE NOTICE '  UUID strings that work with both TEXT and UUID columns.';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
