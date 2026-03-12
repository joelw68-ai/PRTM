-- ============================================================
-- CREATE TABLE: parts_inventory (from scratch)
-- ============================================================
-- Run this in your Supabase SQL Editor.
--
-- This creates the parts_inventory table that was missing from
-- your database, causing the error:
--   "relation public.parts_inventory does not exist"
--
-- Includes ALL columns used by the app:
--   - Core inventory columns (part_number, description, category, etc.)
--   - related_drivetrain_component_id (links parts to drivetrain components)
--   - car_id (multi-car support)
--   - name (optional alias for description)
--   - RLS policies (row-level security so each user sees only their own parts)
--   - Performance indexes
--
-- This script is idempotent — safe to run multiple times.
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.parts_inventory (
  id                              TEXT PRIMARY KEY,
  user_id                         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  part_number                     TEXT NOT NULL,
  description                     TEXT NOT NULL,
  name                            TEXT,
  category                        TEXT,
  subcategory                     TEXT,
  on_hand                         INTEGER DEFAULT 0,
  min_quantity                    INTEGER DEFAULT 1,
  max_quantity                    INTEGER DEFAULT 5,
  vendor                          TEXT,
  vendor_part_number              TEXT,
  unit_cost                       NUMERIC DEFAULT 0,
  total_value                     NUMERIC DEFAULT 0,
  last_ordered                    TEXT,
  last_used                       TEXT,
  location                        TEXT,
  notes                           TEXT,
  status                          TEXT DEFAULT 'In Stock',
  reorder_status                  TEXT DEFAULT 'OK',
  related_drivetrain_component_id TEXT,
  car_id                          TEXT,
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy (users can only see/edit their own parts)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users manage own parts_inventory'
      AND tablename  = 'parts_inventory'
  ) THEN
    CREATE POLICY "Users manage own parts_inventory"
      ON public.parts_inventory
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_parts_inv_user_id
  ON public.parts_inventory(user_id);

CREATE INDEX IF NOT EXISTS idx_parts_inv_category
  ON public.parts_inventory(category);

CREATE INDEX IF NOT EXISTS idx_parts_inv_drivetrain_comp
  ON public.parts_inventory(related_drivetrain_component_id);

CREATE INDEX IF NOT EXISTS idx_parts_inv_car_id
  ON public.parts_inventory(car_id);

-- 5. Add a comment for documentation
COMMENT ON TABLE public.parts_inventory
  IS 'Stores spare parts inventory for each race team. Supports multi-car assignment and drivetrain component linking.';

COMMENT ON COLUMN public.parts_inventory.related_drivetrain_component_id
  IS 'Links this part to a drivetrain_components row (transmission, torque converter, 3rd member, etc.)';

COMMENT ON COLUMN public.parts_inventory.car_id
  IS 'Links this part to a specific car for multi-car teams. NULL = shared across all cars.';

-- ============================================================
-- DONE! The parts_inventory table has been created with all
-- columns, RLS policies, and indexes.
--
-- You can verify it worked by running:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'parts_inventory'
--   ORDER BY ordinal_position;
-- ============================================================
