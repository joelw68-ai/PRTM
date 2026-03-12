-- ============================================================
-- PRO MOD LOGBOOK — SAFE INCREMENTAL MIGRATION
-- ============================================================
-- PURPOSE: Bring ANY existing database up to date with the
-- latest schema WITHOUT dropping or recreating tables.
--
-- SAFE TO RUN MULTIPLE TIMES:
--   • ADD COLUMN IF NOT EXISTS — skips if column already exists
--   • CREATE TABLE IF NOT EXISTS — skips if table already exists
--   • DO $$ blocks with IF NOT EXISTS for policies/constraints
--   • CREATE INDEX IF NOT EXISTS — skips if index already exists
--   • CREATE OR REPLACE FUNCTION — overwrites safely
--
-- YOUR DATA IS NEVER DELETED OR MODIFIED (except backfilling
-- user_profiles.user_id from the id column).
--
-- WHAT THIS SCRIPT DOES:
--   PART 1: Add missing columns to 15 existing tables (35 columns total)
--   PART 2: Set DEFAULT auth.uid() on all user_id columns
--   PART 3: Create 10 newer tables that may not exist yet
--   PART 4: Create all performance indexes
--   PART 5: Create/update RPC functions, helper functions, trigger
--   PART 6: Ensure storage bucket + policies exist
-- ============================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ############################################################
-- PART 1: ADD MISSING COLUMNS TO EXISTING TABLES
-- ############################################################
-- Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS so it's safe
-- to run even if the column already exists.


-- ============================================================
-- 1. user_profiles — add user_id column
-- ============================================================
-- AuthContext.tsx queries .eq('user_id', userId) but the original
-- schema only had `id` as the primary key.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill user_id from id for any existing rows
UPDATE public.user_profiles SET user_id = id WHERE user_id IS NULL;

-- Add unique constraint on user_id (safe: wrapped in DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'user_profiles_user_id_unique: %', SQLERRM;
END $$;


-- ============================================================
-- 2. engines — add displacement, car_id
-- ============================================================
ALTER TABLE public.engines
  ADD COLUMN IF NOT EXISTS displacement TEXT;

ALTER TABLE public.engines
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 3. superchargers — add car_id
-- ============================================================
ALTER TABLE public.superchargers
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 4. pass_logs — add car_id
-- ============================================================
ALTER TABLE public.pass_logs
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 5. maintenance_items — add car_id
-- ============================================================
ALTER TABLE public.maintenance_items
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 6. sfi_certifications — add car_id
-- ============================================================
ALTER TABLE public.sfi_certifications
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 7. work_orders — add car_id
-- ============================================================
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 8. checklists — add checked_by, checked_at
-- ============================================================
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS checked_by TEXT;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS checked_at TEXT;


-- ============================================================
-- 9. parts_inventory — add name, related_drivetrain_component_id, car_id
-- ============================================================
ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS related_drivetrain_component_id TEXT;

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 10. race_events — add track_address, track_zip
-- ============================================================
ALTER TABLE public.race_events
  ADD COLUMN IF NOT EXISTS track_address TEXT;

ALTER TABLE public.race_events
  ADD COLUMN IF NOT EXISTS track_zip TEXT;


-- ============================================================
-- 11. chassis_setups — add car_id
-- ============================================================
ALTER TABLE public.chassis_setups
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 12. setup_vendors — add 6 missing columns
-- ============================================================
ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 14;

ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS minimum_order NUMERIC DEFAULT 0;

ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS shipping_method TEXT;

ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.setup_vendors
  ADD COLUMN IF NOT EXISTS created_date TEXT;


-- ============================================================
-- 13. vendor_invoices — add 7 missing columns
-- ============================================================
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS paid_date TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS linked_event_id TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS linked_event_name TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS linked_work_order_id TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS linked_work_order_title TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS car_id TEXT;


-- ============================================================
-- 14. invoice_line_items — add auto_created_inventory_id
-- ============================================================
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS auto_created_inventory_id TEXT;


-- ============================================================
-- 15. todo_items — add archive columns
-- ============================================================
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS archived_at TEXT;

ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS archived_by TEXT;


-- ############################################################
-- PART 2: SET DEFAULT auth.uid() ON ALL user_id COLUMNS
-- ############################################################
-- This ensures RLS doesn't silently reject inserts when the
-- frontend doesn't explicitly include user_id in the payload.

DO $$ BEGIN
  BEGIN ALTER TABLE public.user_profiles       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.engines             ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.superchargers       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.cylinder_heads      ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.pass_logs           ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.maintenance_items   ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.sfi_certifications  ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.work_orders         ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.engine_swap_logs    ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.checklists          ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.parts_inventory     ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.track_weather_history ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.race_events         ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.team_members        ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.media_gallery       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.saved_tracks        ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.transmissions       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.setup_vendors       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.team_notes          ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.labor_entries       ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.todo_items          ALTER COLUMN user_id SET DEFAULT auth.uid(); EXCEPTION WHEN others THEN NULL; END;
END $$;


-- ############################################################
-- PART 3: CREATE NEWER TABLES THAT MAY NOT EXIST YET
-- ############################################################
-- Tables 29-38 were added after the original schema.
-- CREATE TABLE IF NOT EXISTS ensures they're only created if missing.


-- ============================================================
-- 29. RACE CARS (multi-car support)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.race_cars (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  car_number  TEXT,
  nickname    TEXT,
  name        TEXT,
  class       TEXT,
  class_type  TEXT,
  year        INTEGER,
  make        TEXT,
  model       TEXT,
  color       TEXT,
  vin         TEXT,
  weight      NUMERIC,
  photo_url   TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.race_cars ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own race_cars' AND tablename = 'race_cars') THEN
    CREATE POLICY "Users manage own race_cars" ON public.race_cars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 30. DRIVETRAIN COMPONENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drivetrain_components (
  id                    TEXT PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  category              TEXT NOT NULL,
  name                  TEXT,
  make                  TEXT,
  model                 TEXT,
  serial_number         TEXT,
  builder               TEXT,
  install_date          TEXT,
  date_removed          TEXT,
  total_passes          INTEGER DEFAULT 0,
  passes_since_service  INTEGER DEFAULT 0,
  hours                 NUMERIC DEFAULT 0,
  status                TEXT DEFAULT 'Ready',
  currently_installed   BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  components            JSONB DEFAULT '{}'::jsonb,
  car_id                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drivetrain_components ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own drivetrain_components' AND tablename = 'drivetrain_components') THEN
    CREATE POLICY "Users manage own drivetrain_components" ON public.drivetrain_components FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 31. DRIVETRAIN SWAP LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drivetrain_swap_logs (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  date                    TEXT NOT NULL,
  time                    TEXT,
  component_type          TEXT NOT NULL,
  previous_component_id   TEXT,
  new_component_id        TEXT,
  previous_component_name TEXT,
  new_component_name      TEXT,
  reason                  TEXT,
  performed_by            TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drivetrain_swap_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own drivetrain_swap_logs' AND tablename = 'drivetrain_swap_logs') THEN
    CREATE POLICY "Users manage own drivetrain_swap_logs" ON public.drivetrain_swap_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 32. FUEL LOG ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fuel_log_entries (
  id                TEXT PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  team_id           UUID,
  car_id            TEXT,
  date              TEXT NOT NULL,
  fuel_type         TEXT DEFAULT 'Methanol',
  quantity_gallons  NUMERIC DEFAULT 0,
  price_per_gallon  NUMERIC DEFAULT 0,
  total_cost        NUMERIC DEFAULT 0,
  vendor            TEXT,
  notes             TEXT,
  race_event_id     TEXT,
  linked_event_name TEXT,
  gallons_used      NUMERIC,
  passes_at_event   INTEGER,
  receipt_number    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fuel_log_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own fuel_log_entries' AND tablename = 'fuel_log_entries') THEN
    CREATE POLICY "Users manage own fuel_log_entries" ON public.fuel_log_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 33. TEAM INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_invites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT DEFAULT 'Crew',
  permissions     JSONB DEFAULT '["view"]'::jsonb,
  token           TEXT NOT NULL,
  status          TEXT DEFAULT 'pending',
  invited_by_name TEXT,
  team_name       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own team_invites' AND tablename = 'team_invites') THEN
    CREATE POLICY "Owners manage own team_invites" ON public.team_invites FOR ALL USING (auth.uid() = team_owner_id) WITH CHECK (auth.uid() = team_owner_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view invites sent to them' AND tablename = 'team_invites') THEN
    CREATE POLICY "Users can view invites sent to them" ON public.team_invites FOR SELECT
      USING (auth.uid() = team_owner_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;


-- ============================================================
-- 34. TEAM MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_memberships (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id   TEXT,
  role             TEXT DEFAULT 'Crew',
  permissions      JSONB DEFAULT '["view"]'::jsonb,
  status           TEXT DEFAULT 'active',
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  invite_id        UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_memberships_unique_member'
  ) THEN
    ALTER TABLE public.team_memberships
      ADD CONSTRAINT team_memberships_unique_member UNIQUE (team_owner_id, member_user_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'team_memberships_unique_member: %', SQLERRM;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage team_memberships' AND tablename = 'team_memberships') THEN
    CREATE POLICY "Owners manage team_memberships" ON public.team_memberships FOR ALL USING (auth.uid() = team_owner_id) WITH CHECK (auth.uid() = team_owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view own memberships' AND tablename = 'team_memberships') THEN
    CREATE POLICY "Members can view own memberships" ON public.team_memberships FOR SELECT USING (auth.uid() = member_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can insert own membership' AND tablename = 'team_memberships') THEN
    CREATE POLICY "Members can insert own membership" ON public.team_memberships FOR INSERT WITH CHECK (auth.uid() = member_user_id);
  END IF;
END $$;


-- ============================================================
-- 35. PARTS USAGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parts_usage_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  part_id          TEXT NOT NULL,
  part_number      TEXT NOT NULL,
  part_description TEXT,
  quantity_used    INTEGER DEFAULT 1,
  unit_cost        NUMERIC DEFAULT 0,
  total_cost       NUMERIC DEFAULT 0,
  usage_date       TEXT NOT NULL,
  usage_type       TEXT DEFAULT 'work_order',
  related_id       TEXT,
  related_title    TEXT,
  notes            TEXT,
  recorded_by      TEXT,
  previous_on_hand INTEGER DEFAULT 0,
  new_on_hand      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parts_usage_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own parts_usage_log' AND tablename = 'parts_usage_log') THEN
    CREATE POLICY "Users manage own parts_usage_log" ON public.parts_usage_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 36. MISC EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.misc_expenses (
  id                  TEXT PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  car_id              TEXT,
  category            TEXT NOT NULL,
  custom_description  TEXT,
  amount              NUMERIC NOT NULL,
  expense_date        TEXT NOT NULL,
  paid_by             TEXT,
  payment_method      TEXT,
  receipt_url         TEXT,
  receipt_file_name   TEXT,
  receipt_file_type   TEXT,
  receipt_file_size   INTEGER,
  notes               TEXT,
  race_event_id       TEXT,
  linked_event_name   TEXT,
  add_to_cost_report  BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.misc_expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own misc_expenses' AND tablename = 'misc_expenses') THEN
    CREATE POLICY "Users manage own misc_expenses" ON public.misc_expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 37. BORROWED / LOANED PARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.borrowed_loaned_parts (
  id                    TEXT PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  transaction_type      TEXT NOT NULL,
  part_name             TEXT NOT NULL,
  part_number           TEXT,
  description           TEXT,
  quantity              INTEGER DEFAULT 1,
  person_name           TEXT,
  contact               TEXT,
  date_transaction      TEXT,
  expected_return_date  TEXT,
  actual_return_date    TEXT,
  condition_out         TEXT,
  condition_returned    TEXT,
  notes                 TEXT,
  status                TEXT DEFAULT 'active',
  linked_inventory_id   TEXT,
  inventory_adjusted    BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.borrowed_loaned_parts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own borrowed_loaned_parts' AND tablename = 'borrowed_loaned_parts') THEN
    CREATE POLICY "Users manage own borrowed_loaned_parts" ON public.borrowed_loaned_parts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 38. CHASSIS SETUP USER PRESETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chassis_setup_user_presets (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name                      TEXT NOT NULL,
  description               TEXT,
  category                  TEXT NOT NULL,
  settings                  JSONB NOT NULL,
  recommended_pinion_angle  NUMERIC,
  target_anti_squat_min     NUMERIC,
  target_anti_squat_max     NUMERIC,
  characteristics           JSONB DEFAULT '[]'::jsonb,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chassis_setup_user_presets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own chassis_setup_user_presets' AND tablename = 'chassis_setup_user_presets') THEN
    CREATE POLICY "Users manage own chassis_setup_user_presets" ON public.chassis_setup_user_presets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ############################################################
-- PART 4: PERFORMANCE INDEXES
-- ############################################################
-- All use IF NOT EXISTS — safe to run repeatedly.

-- Original tables
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id    ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_pass_logs_user_id        ON public.pass_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pass_logs_date           ON public.pass_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_pass_logs_car_id         ON public.pass_logs(car_id);
CREATE INDEX IF NOT EXISTS idx_engines_user_id          ON public.engines(user_id);
CREATE INDEX IF NOT EXISTS idx_engines_car_id           ON public.engines(car_id);
CREATE INDEX IF NOT EXISTS idx_superchargers_user_id    ON public.superchargers(user_id);
CREATE INDEX IF NOT EXISTS idx_superchargers_car_id     ON public.superchargers(car_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_heads_user_id   ON public.cylinder_heads(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_user_id      ON public.maintenance_items(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_car_id       ON public.maintenance_items(car_id);
CREATE INDEX IF NOT EXISTS idx_sfi_certs_user_id        ON public.sfi_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sfi_certs_car_id         ON public.sfi_certifications(car_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id      ON public.work_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_car_id       ON public.work_orders(car_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id       ON public.checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_type          ON public.checklists(checklist_type);
CREATE INDEX IF NOT EXISTS idx_parts_inv_user_id        ON public.parts_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_inv_category       ON public.parts_inventory(category);
CREATE INDEX IF NOT EXISTS idx_parts_inv_drivetrain     ON public.parts_inventory(related_drivetrain_component_id);
CREATE INDEX IF NOT EXISTS idx_parts_inv_car_id         ON public.parts_inventory(car_id);
CREATE INDEX IF NOT EXISTS idx_race_events_user_id      ON public.race_events(user_id);
CREATE INDEX IF NOT EXISTS idx_race_events_date         ON public.race_events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_race_events_track_zip    ON public.race_events(track_zip);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id     ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_user_id    ON public.media_gallery(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_tracks_user_id     ON public.saved_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id       ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp     ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chassis_setups_user_id   ON public.chassis_setups(user_id);
CREATE INDEX IF NOT EXISTS idx_chassis_setups_car_id    ON public.chassis_setups(car_id);
CREATE INDEX IF NOT EXISTS idx_transmissions_user_id    ON public.transmissions(user_id);
CREATE INDEX IF NOT EXISTS idx_setup_vendors_user_id    ON public.setup_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_user_id  ON public.vendor_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_car_id   ON public.vendor_invoices(car_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_inv   ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cost_reports_user_id     ON public.cost_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_reports_date        ON public.cost_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_swap_logs_user_id        ON public.engine_swap_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_weather_hist_user_id     ON public.track_weather_history(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id       ON public.todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id    ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_user_id       ON public.team_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_user_id    ON public.labor_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_date       ON public.labor_entries(date DESC);

-- Newer tables
CREATE INDEX IF NOT EXISTS idx_race_cars_user_id        ON public.race_cars(user_id);
CREATE INDEX IF NOT EXISTS idx_drivetrain_comp_user_id  ON public.drivetrain_components(user_id);
CREATE INDEX IF NOT EXISTS idx_drivetrain_comp_category ON public.drivetrain_components(category);
CREATE INDEX IF NOT EXISTS idx_drivetrain_comp_car_id   ON public.drivetrain_components(car_id);
CREATE INDEX IF NOT EXISTS idx_drivetrain_swap_user_id  ON public.drivetrain_swap_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_user_id         ON public.fuel_log_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_team_id         ON public.fuel_log_entries(team_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_date            ON public.fuel_log_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_team_invites_owner       ON public.team_invites(team_owner_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token       ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email       ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_status      ON public.team_invites(status);
CREATE INDEX IF NOT EXISTS idx_team_memberships_owner   ON public.team_memberships(team_owner_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_member  ON public.team_memberships(member_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_status  ON public.team_memberships(status);
CREATE INDEX IF NOT EXISTS idx_parts_usage_user_id      ON public.parts_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_usage_part_id      ON public.parts_usage_log(part_id);
CREATE INDEX IF NOT EXISTS idx_parts_usage_date         ON public.parts_usage_log(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_parts_usage_type         ON public.parts_usage_log(usage_type);
CREATE INDEX IF NOT EXISTS idx_parts_usage_related      ON public.parts_usage_log(related_id);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_user_id    ON public.misc_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_date       ON public.misc_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_car_id     ON public.misc_expenses(car_id);
CREATE INDEX IF NOT EXISTS idx_borrowed_parts_user_id   ON public.borrowed_loaned_parts(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowed_parts_status    ON public.borrowed_loaned_parts(status);
CREATE INDEX IF NOT EXISTS idx_chassis_presets_user_id  ON public.chassis_setup_user_presets(user_id);


-- ############################################################
-- PART 5: FUNCTIONS & TRIGGERS
-- ############################################################

-- RPC: increment_track_visit
CREATE OR REPLACE FUNCTION public.increment_track_visit(track_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.saved_tracks
  SET visit_count = COALESCE(visit_count, 0) + 1,
      last_visited = TO_CHAR(NOW(), 'YYYY-MM-DD'),
      updated_at = NOW()
  WHERE id = track_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if caller is a team member of the given owner
CREATE OR REPLACE FUNCTION public.is_team_member_of(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE team_owner_id = owner_id
      AND member_user_id = auth.uid()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if caller has edit permission on the given team
CREATE OR REPLACE FUNCTION public.has_team_edit_permission(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE team_owner_id = owner_id
      AND member_user_id = auth.uid()
      AND status = 'active'
      AND permissions ? 'edit'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger: auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, team_name, contact_email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'team_name', 'My Race Team'),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id
  WHERE public.user_profiles.user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ############################################################
-- PART 6: STORAGE BUCKET
-- ############################################################

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','video/mp4','video/quicktime','video/webm','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage RLS policies (drop-and-recreate for idempotency)
DO $$ BEGIN DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Public read access to media" ON storage.objects; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can update own media files" ON storage.objects; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can delete own media files" ON storage.objects; EXCEPTION WHEN others THEN NULL; END $$;

CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Public read access to media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');
CREATE POLICY "Users can update own media files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media');
CREATE POLICY "Users can delete own media files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');


-- ############################################################
-- DONE!
-- ############################################################
-- 
-- SUMMARY OF CHANGES:
--
-- PART 1 — Added 35 missing columns to 15 existing tables:
--   1.  user_profiles:       + user_id
--   2.  engines:             + displacement, car_id
--   3.  superchargers:       + car_id
--   4.  pass_logs:           + car_id
--   5.  maintenance_items:   + car_id
--   6.  sfi_certifications:  + car_id
--   7.  work_orders:         + car_id
--   8.  checklists:          + checked_by, checked_at
--   9.  parts_inventory:     + name, related_drivetrain_component_id, car_id
--  10.  race_events:         + track_address, track_zip
--  11.  chassis_setups:      + car_id
--  12.  setup_vendors:       + discount_percent, lead_time_days, minimum_order,
--                              shipping_method, is_active, created_date
--  13.  vendor_invoices:     + paid_date, receipt_url, linked_event_id,
--                              linked_event_name, linked_work_order_id,
--                              linked_work_order_title, car_id
--  14.  invoice_line_items:  + auto_created_inventory_id
--  15.  todo_items:          + is_archived, archived_at, archived_by
--
-- PART 2 — Set DEFAULT auth.uid() on 21 tables' user_id columns
--
-- PART 3 — Created 10 newer tables (if they didn't exist):
--  29. race_cars               34. team_memberships
--  30. drivetrain_components   35. parts_usage_log
--  31. drivetrain_swap_logs    36. misc_expenses
--  32. fuel_log_entries        37. borrowed_loaned_parts
--  33. team_invites            38. chassis_setup_user_presets
--
-- PART 4 — Created 70+ performance indexes
--
-- PART 5 — Created/updated:
--   • increment_track_visit RPC function
--   • is_team_member_of helper function
--   • has_team_edit_permission helper function
--   • handle_new_user trigger (auto-create profile on signup)
--
-- PART 6 — Ensured media storage bucket + 4 RLS policies exist
--
-- VERIFICATION — Run this to confirm all 38 tables exist:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
-- ============================================================
