-- ============================================================
-- MIGRATION: Add related_drivetrain_component_id to parts_inventory
-- ============================================================
-- Run this in your Supabase SQL Editor to fix the error:
--   "Could not find the 'related_drivetrain_component_id' column
--    of 'parts_inventory' in the schema cache"
--
-- This column links a part in the inventory to a specific
-- drivetrain component (transmission, torque converter, 3rd member, etc.)
-- so teams can track which parts belong to which drivetrain component.
-- ============================================================

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS related_drivetrain_component_id TEXT;

-- Optional: Add a comment for documentation
COMMENT ON COLUMN public.parts_inventory.related_drivetrain_component_id
  IS 'Links this part to a drivetrain_components row (transmission, torque converter, 3rd member, etc.)';

-- Optional: Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_parts_inv_drivetrain_comp
  ON public.parts_inventory(related_drivetrain_component_id);

-- ============================================================
-- DONE! The column has been added. Reload your app and the
-- "Save Failed" error should be resolved.
-- ============================================================
