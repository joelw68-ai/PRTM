-- ═══════════════════════════════════════════════════════════════════════════
-- sql_sync_database_with_app.sql
-- ───────────────────────────────────────────────────────────────────────────
-- ONE complete, idempotent script that brings your Supabase database fully in
-- sync with the current app code. It is SAFE to run multiple times because it
-- uses:
--    • CREATE TABLE IF NOT EXISTS        (never drops / overwrites your data)
--    • ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--    • CREATE INDEX IF NOT EXISTS
--    • DROP POLICY IF EXISTS + CREATE POLICY  (re-creatable RLS policies)
--
-- After it finishes it runs  NOTIFY pgrst, 'reload schema'  so PostgREST picks
-- up the new tables/columns immediately (clears PGRST205 / PGRST204 errors).
--
-- HOW TO RUN:
--   1. Open Supabase → SQL Editor → New query
--   2. Paste this entire file
--   3. Click "Run"
-- ═══════════════════════════════════════════════════════════════════════════

-- Required for uuid_generate_v4() and gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — TIRE TRACKING TABLES  (the four reported-missing tables)
--   tire_sets, tire_tread_depth, tire_pressure_history, tire_change_log
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tire_sets (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand         TEXT,
  model         TEXT,
  size          TEXT,
  compound      TEXT,
  position      TEXT,
  status        TEXT DEFAULT 'Active',
  install_date  TEXT,
  total_passes  INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS brand        TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS model        TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS size         TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS compound     TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS position     TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'Active';
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS install_date TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS total_passes INTEGER DEFAULT 0;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tire_sets ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tire_tread_depth (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tire_set_id TEXT,
  date        TEXT,
  depth       NUMERIC,
  pass_count  INTEGER DEFAULT 0,
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS tire_set_id TEXT;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS date        TEXT;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS depth       NUMERIC;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS pass_count  INTEGER DEFAULT 0;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS location    TEXT;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tire_tread_depth ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tire_pressure_history (
  id              TEXT PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tire_set_id     TEXT,
  date            TEXT,
  pass_number     INTEGER DEFAULT 0,
  pressure_before NUMERIC,
  pressure_after  NUMERIC,
  hot_pressure    NUMERIC,
  track_temp      NUMERIC,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS tire_set_id     TEXT;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS date            TEXT;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS pass_number     INTEGER DEFAULT 0;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS pressure_before NUMERIC;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS pressure_after  NUMERIC;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS hot_pressure    NUMERIC;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS track_temp      NUMERIC;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tire_pressure_history ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tire_change_log (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tire_set_id   TEXT,
  tire_set_name TEXT,
  date          TEXT,
  pass_count    INTEGER DEFAULT 0,
  action        TEXT,
  reason        TEXT,
  performed_by  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS tire_set_id   TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS tire_set_name TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS date          TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS pass_count    INTEGER DEFAULT 0;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS action        TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS reason        TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS performed_by  TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS notes         TEXT;
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tire_change_log ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — MAINTENANCE_ITEMS  (add the reported-missing columns)
--   service_log (jsonb), last_service_time, threshold, + full column set
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS maintenance_items (
  id                  TEXT PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component           TEXT NOT NULL,
  category            TEXT,
  pass_interval       INTEGER DEFAULT 0,
  current_passes      INTEGER DEFAULT 0,
  last_service        TEXT,
  last_service_time   TEXT,
  next_service_passes INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'Good',
  priority            TEXT DEFAULT 'Medium',
  notes               TEXT,
  estimated_cost      NUMERIC,
  threshold           INTEGER,
  service_log         JSONB DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS category            TEXT;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS pass_interval       INTEGER DEFAULT 0;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS current_passes      INTEGER DEFAULT 0;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS last_service        TEXT;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS last_service_time   TEXT;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS next_service_passes INTEGER DEFAULT 0;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'Good';
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS priority            TEXT DEFAULT 'Medium';
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS estimated_cost      NUMERIC;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS threshold           INTEGER;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS service_log         JSONB DEFAULT '[]'::jsonb;
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE maintenance_items ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — PASS_LOGS  (ensure optional / migration columns exist)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pass_logs (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  track        TEXT NOT NULL,
  session_type TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS time                    TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS location                TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS round                   TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS lane                    TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS result                  TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS reaction_time           NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS sixty_foot              NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS three_thirty            NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS eighth                  NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS mph                     NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS quarter_mile_et         NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS quarter_mile_mph        NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS quarter_back_split      NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS weather                 JSONB DEFAULT '{}'::jsonb;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS sae_correction          NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS density_altitude        NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS corrected_hp            NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS engine_id               TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS supercharger_id         TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS tire_pressure_front     NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS tire_pressure_rear_left NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS tire_pressure_rear_right NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS rear_left_liner_psi     NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS rear_right_liner_psi    NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS wheelie_bar_setting     NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS launch_rpm              NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS boost_setting           NUMERIC;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS notes                   TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS crew_chief              TEXT;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS aborted                 BOOLEAN DEFAULT FALSE;
ALTER TABLE pass_logs ADD COLUMN IF NOT EXISTS car_id                  TEXT;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — CORE COMPONENT TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serial_number TEXT, builder TEXT, install_date TEXT,
  total_passes INTEGER DEFAULT 0, passes_since_rebuild INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Ready', currently_installed BOOLEAN DEFAULT FALSE,
  notes TEXT, components JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE engines ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS superchargers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serial_number TEXT, model TEXT, install_date TEXT,
  total_passes INTEGER DEFAULT 0, passes_since_service INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Ready', currently_installed BOOLEAN DEFAULT FALSE,
  notes TEXT, power_adder_type TEXT DEFAULT 'Supercharger',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE superchargers ADD COLUMN IF NOT EXISTS power_adder_type TEXT DEFAULT 'Supercharger';

CREATE TABLE IF NOT EXISTS cylinder_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serial_number TEXT, builder TEXT, install_date TEXT,
  total_passes INTEGER DEFAULT 0, passes_since_refresh INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Ready', position TEXT DEFAULT 'Spare',
  engine_id TEXT, notes TEXT, components JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivetrain_components (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT, name TEXT, make TEXT, model TEXT,
  serial_number TEXT, builder TEXT, install_date TEXT, date_removed TEXT,
  total_passes INTEGER DEFAULT 0, passes_since_service INTEGER DEFAULT 0,
  hours NUMERIC DEFAULT 0, status TEXT DEFAULT 'Ready',
  currently_installed BOOLEAN DEFAULT FALSE, notes TEXT,
  components JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivetrain_swap_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT, time TEXT, component_type TEXT,
  previous_component_id TEXT, new_component_id TEXT,
  previous_component_name TEXT, new_component_name TEXT,
  reason TEXT, performed_by TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engine_swap_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT, time TEXT, previous_engine_id TEXT, new_engine_id TEXT,
  reason TEXT, performed_by TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS component_parts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component_id TEXT, component_type TEXT, part_name TEXT,
  passes_on_part INTEGER DEFAULT 0, date_replaced TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE component_parts ADD COLUMN IF NOT EXISTS date_replaced TEXT;
ALTER TABLE component_parts ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS component_extra_fields (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component_id TEXT, component_type TEXT, fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — INVENTORY / PARTS / VENDORS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS parts_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  part_number TEXT, description TEXT, name TEXT,
  category TEXT, subcategory TEXT,
  on_hand INTEGER DEFAULT 0, min_quantity INTEGER DEFAULT 1, max_quantity INTEGER DEFAULT 5,
  vendor TEXT, vendor_part_number TEXT,
  unit_cost NUMERIC DEFAULT 0, total_value NUMERIC DEFAULT 0,
  last_ordered TEXT, last_used TEXT, location TEXT, notes TEXT,
  status TEXT DEFAULT 'In Stock', reorder_status TEXT,
  related_drivetrain_component_id TEXT, car_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS vendor_part_number TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS last_ordered TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS last_used TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS reorder_status TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS related_drivetrain_component_id TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS car_id TEXT;

CREATE TABLE IF NOT EXISTS parts_usage_log (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  part_id TEXT, part_name TEXT, quantity INTEGER, reason TEXT,
  date TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_vendors (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, code TEXT, contact_name TEXT, email TEXT, phone TEXT,
  address TEXT, city TEXT, state TEXT, zip TEXT, website TEXT,
  category TEXT, payment_terms TEXT, discount_percent NUMERIC,
  lead_time_days INTEGER, minimum_order NUMERIC, shipping_method TEXT,
  notes TEXT, rating INTEGER DEFAULT 5, is_active BOOLEAN DEFAULT TRUE,
  created_date TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS borrowed_loaned_parts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT, part_name TEXT, person_name TEXT,
  quantity INTEGER, date_transaction TEXT, expected_return_date TEXT,
  actual_return_date TEXT, status TEXT, notes TEXT,
  linked_inventory_id TEXT, inventory_adjusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE borrowed_loaned_parts ADD COLUMN IF NOT EXISTS linked_inventory_id TEXT;
ALTER TABLE borrowed_loaned_parts ADD COLUMN IF NOT EXISTS inventory_adjusted BOOLEAN DEFAULT FALSE;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — EXPENSES / INVOICES / COSTS / FUEL / LABOR
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS misc_expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT, amount NUMERIC, category TEXT,
  expense_date TEXT, vendor TEXT, payment_method TEXT,
  receipt_url TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_invoices (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT, invoice_number TEXT, invoice_date TEXT,
  due_date TEXT, payment_date TEXT, subtotal NUMERIC, tax NUMERIC,
  total NUMERIC, status TEXT DEFAULT 'Unpaid', file_url TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT, description TEXT, part_number TEXT,
  quantity NUMERIC, unit_price NUMERIC, line_total NUMERIC,
  category TEXT, auto_created_inventory_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS auto_created_inventory_id TEXT;

CREATE TABLE IF NOT EXISTS cost_reports (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT, amount NUMERIC, description TEXT,
  date TEXT, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_log_entries (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,
  date TEXT, fuel_type TEXT,
  quantity_gallons NUMERIC, price_per_gallon NUMERIC, total_cost NUMERIC,
  vendor TEXT, notes TEXT, race_event_id TEXT, linked_event_name TEXT,
  gallons_used NUMERIC, passes_at_event INTEGER, receipt_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fuel_log_entries ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE fuel_log_entries ADD COLUMN IF NOT EXISTS linked_event_name TEXT;
ALTER TABLE fuel_log_entries ADD COLUMN IF NOT EXISTS gallons_used NUMERIC;
ALTER TABLE fuel_log_entries ADD COLUMN IF NOT EXISTS passes_at_event INTEGER;
ALTER TABLE fuel_log_entries ADD COLUMN IF NOT EXISTS receipt_number TEXT;

CREATE TABLE IF NOT EXISTS labor_entries (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id TEXT, team_member_name TEXT, date TEXT,
  hours NUMERIC, hourly_rate NUMERIC, daily_rate NUMERIC, rate_type TEXT,
  total_cost NUMERIC, description TEXT, category TEXT, notes TEXT,
  event_id TEXT, event_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 7 — TRACKS / EVENTS / CARS / CHASSIS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS saved_tracks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, location TEXT, address TEXT, city TEXT, state TEXT, zip TEXT,
  elevation NUMERIC, track_length TEXT, surface_type TEXT, notes TEXT,
  is_favorite BOOLEAN DEFAULT FALSE, last_visited TEXT, visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_weather_history (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id TEXT, track_name TEXT, location TEXT, elevation NUMERIC,
  visits JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_events (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, event_type TEXT, track_name TEXT, track_location TEXT,
  track_address TEXT, track_zip TEXT,
  start_date TEXT, end_date TEXT, start_time TEXT, end_time TEXT,
  status TEXT, sanctioning_body TEXT, entry_fee NUMERIC, purse NUMERIC,
  notes TEXT, result TEXT, best_et NUMERIC, best_mph NUMERIC, rounds_won INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE race_events ADD COLUMN IF NOT EXISTS track_address TEXT;
ALTER TABLE race_events ADD COLUMN IF NOT EXISTS track_zip TEXT;

CREATE TABLE IF NOT EXISTS race_cars (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, make TEXT, model TEXT, year INTEGER, class TEXT,
  notes TEXT, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chassis_setups (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chassis_setup_user_presets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 8 — TEAM / PROFILES / CHECKLISTS / NOTES / TODO / MISC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID,
  driver_name TEXT, team_name TEXT, email TEXT, phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS team_name TEXT;

CREATE TABLE IF NOT EXISTS team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id UUID, team_owner_id UUID, role TEXT,
  status TEXT DEFAULT 'active', invited_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, email TEXT, phone TEXT, role TEXT DEFAULT 'Crew',
  permissions JSONB DEFAULT '["view"]'::jsonb, specialties JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE, joined_date TEXT,
  emergency_contact_name TEXT, emergency_contact_phone TEXT, notes TEXT,
  avatar_url TEXT, hourly_rate NUMERIC, daily_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, action_type TEXT, description TEXT,
  member_name TEXT, metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, content TEXT, category TEXT, created_by TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_type TEXT, task TEXT, category TEXT,
  completed BOOLEAN DEFAULT FALSE, notes TEXT, critical BOOLEAN DEFAULT FALSE,
  checked_by TEXT, checked_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  priority TEXT DEFAULT 'Medium', status TEXT DEFAULT 'Pending', category TEXT DEFAULT 'General',
  assigned_to TEXT, created_by TEXT, created_by_role TEXT,
  due_date TEXT, completed_date TEXT, completed_by TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_archived BOOLEAN DEFAULT FALSE, archived_at TIMESTAMPTZ, archived_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE TABLE IF NOT EXISTS sfi_certifications (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT, sfi_spec TEXT, certification_date TEXT, expiration_date TEXT,
  vendor TEXT, serial_number TEXT, status TEXT DEFAULT 'Valid',
  days_until_expiration INTEGER, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_gallery (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, description TEXT, media_type TEXT, url TEXT, thumbnail_url TEXT,
  category TEXT, tags JSONB DEFAULT '[]'::jsonb,
  event_name TEXT, event_date TEXT, uploaded_by TEXT,
  file_size BIGINT, duration NUMERIC, width INTEGER, height INTEGER,
  is_featured BOOLEAN DEFAULT FALSE, is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, feature)
);

CREATE TABLE IF NOT EXISTS maintenance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS maintenance_category_overrides (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, action TEXT, entity_type TEXT, entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb, timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL, title TEXT, description TEXT NOT NULL,
  status TEXT DEFAULT 'new', priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pass_history (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_count INTEGER DEFAULT 1, components_updated INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0, flagged_details JSONB DEFAULT '[]'::jsonb,
  engines_updated JSONB DEFAULT '[]'::jsonb, heads_updated JSONB DEFAULT '[]'::jsonb,
  power_adders_updated JSONB DEFAULT '[]'::jsonb, drivetrain_updated JSONB DEFAULT '[]'::jsonb,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 9 — ENABLE RLS + PERMISSIVE OWNER POLICIES ON EVERY TABLE
-- Policies allow a user to access their own rows (user_id = auth.uid()) and any
-- legacy rows where user_id IS NULL. This is applied dynamically so it covers
-- every table created above without writing 40 policy blocks by hand.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  has_user_id BOOLEAN;
  tbls TEXT[] := ARRAY[
    'tire_sets','tire_tread_depth','tire_pressure_history','tire_change_log',
    'maintenance_items','pass_logs','engines','superchargers','cylinder_heads',
    'transmissions','drivetrain_components','drivetrain_swap_logs','engine_swap_logs',
    'component_parts','component_extra_fields','parts_inventory','parts_usage_log',
    'setup_vendors','borrowed_loaned_parts','misc_expenses','vendor_invoices',
    'invoice_line_items','cost_reports','fuel_log_entries','labor_entries',
    'saved_tracks','track_weather_history','race_events','race_cars','chassis_setups',
    'chassis_setup_user_presets','user_profiles','team_memberships','team_members',
    'team_activity_feed','team_notes','checklists','todo_items','sfi_certifications',
    'media_gallery','user_settings','maintenance_categories','maintenance_category_overrides',
    'audit_logs','beta_feedback','pass_history'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- skip if the table somehow doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='user_id'
    ) INTO has_user_id;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_owner_all', t);

    IF has_user_id THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (user_id = auth.uid() OR user_id IS NULL)
           WITH CHECK (user_id = auth.uid() OR user_id IS NULL);',
        t||'_owner_all', t);
    ELSE
      -- tables without a user_id column (e.g. team-shared) — allow authenticated access
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (true) WITH CHECK (true);',
        t||'_owner_all', t);
    END IF;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 10 — HELPFUL INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tire_tread_depth_set      ON tire_tread_depth(tire_set_id);
CREATE INDEX IF NOT EXISTS idx_tire_pressure_set         ON tire_pressure_history(tire_set_id);
CREATE INDEX IF NOT EXISTS idx_tire_change_log_set       ON tire_change_log(tire_set_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_inv    ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_component_parts_comp      ON component_parts(component_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_team            ON fuel_log_entries(team_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 11 — RELOAD POSTGREST SCHEMA CACHE  (clears PGRST205 / PGRST204)
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- Done. All reported-missing tables/columns now exist, RLS is enabled with
-- owner policies, and the PostgREST schema cache has been told to reload.
