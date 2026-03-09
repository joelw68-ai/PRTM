-- ============================================================
-- PRO MOD LOGBOOK — COMPLETE SUPABASE DATABASE SCHEMA
-- Run this entire script in the Supabase SQL Editor (one shot).
-- It is idempotent: every CREATE uses IF NOT EXISTS.
-- ============================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name     TEXT NOT NULL DEFAULT 'My Race Team',
  driver_name   TEXT,
  driver_license_number TEXT,
  driver_license_class  TEXT,
  car_name      TEXT,
  car_number    TEXT,
  car_class     TEXT DEFAULT 'Pro Mod',
  car_make      TEXT,
  car_model     TEXT,
  car_year      INTEGER,
  car_weight    NUMERIC,
  engine_type   TEXT DEFAULT 'Supercharged Hemi',
  fuel_type     TEXT DEFAULT 'Methanol',
  home_track    TEXT,
  team_logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can view own profile"   ON public.user_profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can insert own profile"  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can update own profile"  ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- ============================================================
-- 2. ENGINES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.engines (
  id                   TEXT PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  serial_number        TEXT,
  builder              TEXT,
  install_date         TEXT,
  total_passes         INTEGER DEFAULT 0,
  passes_since_rebuild INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'Ready',
  currently_installed  BOOLEAN DEFAULT FALSE,
  notes                TEXT,
  components           JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.engines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own engines' AND tablename = 'engines') THEN
    CREATE POLICY "Users manage own engines" ON public.engines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 3. SUPERCHARGERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.superchargers (
  id                    TEXT PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  serial_number         TEXT,
  model                 TEXT,
  install_date          TEXT,
  total_passes          INTEGER DEFAULT 0,
  passes_since_service  INTEGER DEFAULT 0,
  status                TEXT DEFAULT 'Ready',
  currently_installed   BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.superchargers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own superchargers' AND tablename = 'superchargers') THEN
    CREATE POLICY "Users manage own superchargers" ON public.superchargers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. CYLINDER HEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cylinder_heads (
  id                    TEXT PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  serial_number         TEXT,
  builder               TEXT,
  install_date          TEXT,
  total_passes          INTEGER DEFAULT 0,
  passes_since_refresh  INTEGER DEFAULT 0,
  status                TEXT DEFAULT 'Ready',
  position              TEXT DEFAULT 'Spare',
  engine_id             TEXT,
  notes                 TEXT,
  components            JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cylinder_heads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own cylinder_heads' AND tablename = 'cylinder_heads') THEN
    CREATE POLICY "Users manage own cylinder_heads" ON public.cylinder_heads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 5. PASS LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pass_logs (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date                    TEXT NOT NULL,
  time                    TEXT,
  track                   TEXT NOT NULL,
  location                TEXT,
  session_type            TEXT NOT NULL,
  round                   TEXT,
  lane                    TEXT,
  result                  TEXT,
  reaction_time           NUMERIC,
  sixty_foot              NUMERIC,
  three_thirty            NUMERIC,
  eighth                  NUMERIC,
  mph                     NUMERIC,
  weather                 JSONB DEFAULT '{}'::jsonb,
  sae_correction          NUMERIC DEFAULT 1,
  density_altitude        NUMERIC DEFAULT 0,
  corrected_hp            NUMERIC DEFAULT 0,
  engine_id               TEXT,
  supercharger_id         TEXT,
  tire_pressure_front     NUMERIC,
  tire_pressure_rear_left NUMERIC,
  tire_pressure_rear_right NUMERIC,
  wheelie_bar_setting     NUMERIC,
  launch_rpm              NUMERIC,
  boost_setting           NUMERIC,
  notes                   TEXT,
  crew_chief              TEXT,
  aborted                 BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pass_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own pass_logs' AND tablename = 'pass_logs') THEN
    CREATE POLICY "Users manage own pass_logs" ON public.pass_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 6. MAINTENANCE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_items (
  id                  TEXT PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component           TEXT NOT NULL,
  category            TEXT,
  pass_interval       INTEGER DEFAULT 0,
  current_passes      INTEGER DEFAULT 0,
  last_service        TEXT,
  next_service_passes INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'Good',
  priority            TEXT DEFAULT 'Medium',
  notes               TEXT,
  estimated_cost      NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own maintenance_items' AND tablename = 'maintenance_items') THEN
    CREATE POLICY "Users manage own maintenance_items" ON public.maintenance_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 7. SFI CERTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sfi_certifications (
  id                     TEXT PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item                   TEXT NOT NULL,
  sfi_spec               TEXT,
  certification_date     TEXT,
  expiration_date        TEXT,
  vendor                 TEXT,
  serial_number          TEXT,
  status                 TEXT DEFAULT 'Valid',
  days_until_expiration  INTEGER DEFAULT 0,
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sfi_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own sfi_certifications' AND tablename = 'sfi_certifications') THEN
    CREATE POLICY "Users manage own sfi_certifications" ON public.sfi_certifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 8. WORK ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_orders (
  id                 TEXT PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  category           TEXT,
  priority           TEXT DEFAULT 'Medium',
  status             TEXT DEFAULT 'Open',
  created_date       TEXT,
  due_date           TEXT,
  completed_date     TEXT,
  assigned_to        TEXT,
  estimated_hours    NUMERIC,
  actual_hours       NUMERIC,
  parts              JSONB DEFAULT '[]'::jsonb,
  related_component  TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own work_orders' AND tablename = 'work_orders') THEN
    CREATE POLICY "Users manage own work_orders" ON public.work_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 9. ENGINE SWAP LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.engine_swap_logs (
  id                 TEXT PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date               TEXT NOT NULL,
  time               TEXT,
  previous_engine_id TEXT,
  new_engine_id      TEXT,
  reason             TEXT,
  performed_by       TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.engine_swap_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own engine_swap_logs' AND tablename = 'engine_swap_logs') THEN
    CREATE POLICY "Users manage own engine_swap_logs" ON public.engine_swap_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 10. CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklists (
  id              TEXT PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_type  TEXT NOT NULL,  -- 'preRun', 'betweenRounds', 'postRun'
  task            TEXT NOT NULL,
  category        TEXT,
  completed       BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  critical        BOOLEAN DEFAULT FALSE,
  checked_by      TEXT,            -- Name of crew member who checked the item
  checked_at      TEXT,            -- Timestamp when the item was checked
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own checklists' AND tablename = 'checklists') THEN
    CREATE POLICY "Users manage own checklists" ON public.checklists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 11. PARTS INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parts_inventory (
  id                 TEXT PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  part_number        TEXT NOT NULL,
  description        TEXT NOT NULL,
  category           TEXT,
  subcategory        TEXT,
  on_hand            INTEGER DEFAULT 0,
  min_quantity       INTEGER DEFAULT 1,
  max_quantity       INTEGER DEFAULT 5,
  vendor             TEXT,
  vendor_part_number TEXT,
  unit_cost          NUMERIC DEFAULT 0,
  total_value        NUMERIC DEFAULT 0,
  last_ordered       TEXT,
  last_used          TEXT,
  location           TEXT,
  notes              TEXT,
  status             TEXT DEFAULT 'In Stock',
  reorder_status     TEXT DEFAULT 'OK',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own parts_inventory' AND tablename = 'parts_inventory') THEN
    CREATE POLICY "Users manage own parts_inventory" ON public.parts_inventory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 12. TRACK WEATHER HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.track_weather_history (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,
  track_name  TEXT NOT NULL,
  location    TEXT,
  elevation   NUMERIC DEFAULT 0,
  visits      JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.track_weather_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own track_weather_history' AND tablename = 'track_weather_history') THEN
    CREATE POLICY "Users manage own track_weather_history" ON public.track_weather_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 13. RACE EVENTS (Calendar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.race_events (
  id                TEXT PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  event_type        TEXT DEFAULT 'Race',
  track_name        TEXT,
  track_location    TEXT,
  start_date        TEXT NOT NULL,
  end_date          TEXT,
  start_time        TEXT,
  end_time          TEXT,
  status            TEXT DEFAULT 'Scheduled',
  sanctioning_body  TEXT,
  entry_fee         NUMERIC,
  purse             NUMERIC,
  notes             TEXT,
  result            TEXT,
  best_et           NUMERIC,
  best_mph          NUMERIC,
  rounds_won        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.race_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own race_events' AND tablename = 'race_events') THEN
    CREATE POLICY "Users manage own race_events" ON public.race_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 14. TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  role                    TEXT DEFAULT 'Crew',
  permissions             JSONB DEFAULT '["view"]'::jsonb,
  specialties             JSONB DEFAULT '[]'::jsonb,
  is_active               BOOLEAN DEFAULT TRUE,
  joined_date             TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  notes                   TEXT,
  avatar_url              TEXT,
  hourly_rate             NUMERIC,
  daily_rate              NUMERIC,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own team_members' AND tablename = 'team_members') THEN
    CREATE POLICY "Users manage own team_members" ON public.team_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 15. MEDIA GALLERY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_gallery (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  media_type     TEXT NOT NULL,  -- 'photo' or 'video'
  url            TEXT NOT NULL,
  thumbnail_url  TEXT,
  category       TEXT DEFAULT 'General',
  tags           JSONB DEFAULT '[]'::jsonb,
  event_name     TEXT,
  event_date     TEXT,
  uploaded_by    TEXT,
  file_size      BIGINT,
  duration       NUMERIC,
  width          INTEGER,
  height         INTEGER,
  is_featured    BOOLEAN DEFAULT FALSE,
  is_public      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_gallery ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own media_gallery' AND tablename = 'media_gallery') THEN
    CREATE POLICY "Users manage own media_gallery" ON public.media_gallery FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 16. SAVED TRACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_tracks (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  elevation     NUMERIC DEFAULT 0,
  track_length  TEXT DEFAULT '1/8 mile',
  surface_type  TEXT DEFAULT 'Concrete',
  notes         TEXT,
  is_favorite   BOOLEAN DEFAULT FALSE,
  last_visited  TEXT,
  visit_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_tracks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own saved_tracks' AND tablename = 'saved_tracks') THEN
    CREATE POLICY "Users manage own saved_tracks" ON public.saved_tracks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 17. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp     TIMESTAMPTZ DEFAULT NOW(),
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  category      TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  entity_name   TEXT,
  description   TEXT NOT NULL,
  before_value  JSONB,
  after_value   JSONB,
  metadata      JSONB
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own audit_logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Users manage own audit_logs" ON public.audit_logs FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- ============================================================
-- 18. BETA FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT DEFAULT 'new',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert feedback' AND tablename = 'beta_feedback') THEN
    CREATE POLICY "Users can insert feedback" ON public.beta_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own feedback' AND tablename = 'beta_feedback') THEN
    CREATE POLICY "Users can view own feedback" ON public.beta_feedback FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 19. CHASSIS SETUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chassis_setups (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name                     TEXT NOT NULL DEFAULT 'New Setup',
  description              TEXT,
  race_event               TEXT,
  race_date                TEXT,
  track_name               TEXT,
  track_conditions         TEXT,
  weather_conditions       TEXT,
  -- 4-Link geometry
  upper_bar_chassis_x      NUMERIC DEFAULT 32,
  upper_bar_chassis_y      NUMERIC DEFAULT 18.5,
  upper_bar_rear_x         NUMERIC DEFAULT 6,
  upper_bar_rear_y         NUMERIC DEFAULT 14,
  lower_bar_chassis_x      NUMERIC DEFAULT 38,
  lower_bar_chassis_y      NUMERIC DEFAULT 8.5,
  lower_bar_rear_x         NUMERIC DEFAULT 2,
  lower_bar_rear_y         NUMERIC DEFAULT 10,
  rear_end_center_height   NUMERIC DEFAULT 11,
  -- Calculated values
  instant_center_length    NUMERIC,
  instant_center_height    NUMERIC,
  anti_squat_percentage    NUMERIC,
  -- Weight
  corner_weights           JSONB DEFAULT '{"lf":850,"rf":850,"lr":1100,"rr":1100}'::jsonb,
  ballast_items            JSONB DEFAULT '[]'::jsonb,
  total_weight             NUMERIC,
  cross_weight_percentage  NUMERIC,
  -- Shocks
  shock_settings           JSONB DEFAULT '{"lf":{"compression":6,"rebound":8,"gasCharge":150,"model":""},"rf":{"compression":6,"rebound":8,"gasCharge":150,"model":""},"lr":{"compression":4,"rebound":6,"gasCharge":200,"model":""},"rr":{"compression":4,"rebound":6,"gasCharge":200,"model":""}}'::jsonb,
  -- Ride heights
  ride_heights             JSONB DEFAULT '{"frontLeft":4.5,"frontRight":4.5,"rearLeft":5.0,"rearRight":5.0,"pinionAngle":-2.5}'::jsonb,
  -- Springs
  spring_data              JSONB DEFAULT '{"lf":{"rate":250,"preload":1.5,"freeLength":10},"rf":{"rate":250,"preload":1.5,"freeLength":10},"lr":{"rate":175,"preload":2.0,"freeLength":12},"rr":{"rate":175,"preload":2.0,"freeLength":12}}'::jsonb,
  -- CG data
  cg_data                  JSONB,
  -- Pinion data
  pinion_data              JSONB,
  -- Performance
  performance_notes        TEXT,
  sixty_foot_time          NUMERIC,
  eighth_mile_et           NUMERIC,
  eighth_mile_mph          NUMERIC,
  quarter_mile_et          NUMERIC,
  quarter_mile_mph         NUMERIC,
  -- Meta
  is_favorite              BOOLEAN DEFAULT FALSE,
  tags                     JSONB DEFAULT '[]'::jsonb,
  created_by               TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chassis_setups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own chassis_setups' AND tablename = 'chassis_setups') THEN
    CREATE POLICY "Users manage own chassis_setups" ON public.chassis_setups FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 20. TRANSMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transmissions (
  id                  TEXT PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  serial_number       TEXT,
  type                TEXT,
  model               TEXT,
  builder             TEXT,
  gear_count          INTEGER DEFAULT 2,
  install_date        TEXT,
  total_passes        INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'Ready',
  currently_installed BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transmissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own transmissions' AND tablename = 'transmissions') THEN
    CREATE POLICY "Users manage own transmissions" ON public.transmissions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 21. SETUP VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.setup_vendors (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  website       TEXT,
  category      TEXT,
  payment_terms TEXT,
  notes         TEXT,
  rating        INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.setup_vendors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own setup_vendors' AND tablename = 'setup_vendors') THEN
    CREATE POLICY "Users manage own setup_vendors" ON public.setup_vendors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 22. VENDOR INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  vendor_id       TEXT,
  vendor_name     TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  invoice_date    TEXT NOT NULL,
  due_date        TEXT,
  amount          NUMERIC DEFAULT 0,
  tax             NUMERIC DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'Pending',
  po_number       TEXT,
  file_url        TEXT,
  file_name       TEXT,
  file_type       TEXT,
  file_size       BIGINT,
  notes           TEXT,
  category        TEXT,
  payment_method  TEXT,
  payment_date    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own vendor_invoices' AND tablename = 'vendor_invoices') THEN
    CREATE POLICY "Users manage own vendor_invoices" ON public.vendor_invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 22b. TODO ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.todo_items (
  id               TEXT PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  priority         TEXT DEFAULT 'Medium',
  status           TEXT DEFAULT 'Pending',
  category         TEXT DEFAULT 'General',
  assigned_to      TEXT,
  created_by       TEXT,
  created_by_role  TEXT,
  due_date         TEXT,
  completed_date   TEXT,
  completed_by     TEXT,
  tags             JSONB DEFAULT '[]'::jsonb,
  is_archived      BOOLEAN DEFAULT FALSE,
  archived_at      TEXT,
  archived_by      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own todo_items' AND tablename = 'todo_items') THEN
    CREATE POLICY "Users manage own todo_items" ON public.todo_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 23. USER SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,             -- e.g. 'dashboard', 'passLog', 'inventory'
  settings    JSONB DEFAULT '{}'::jsonb, -- arbitrary key/value settings per feature
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, feature)              -- one settings row per user per feature
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own user_settings' AND tablename = 'user_settings') THEN
    CREATE POLICY "Users manage own user_settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 24. TEAM NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_notes (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT,
  category    TEXT DEFAULT 'General',
  created_by  TEXT,
  is_pinned   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own team_notes' AND tablename = 'team_notes') THEN
    CREATE POLICY "Users manage own team_notes" ON public.team_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 25. LABOR ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.labor_entries (
  id                TEXT PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id    TEXT,
  team_member_name  TEXT NOT NULL,
  date              TEXT NOT NULL,
  hours             NUMERIC DEFAULT 0,
  hourly_rate       NUMERIC DEFAULT 125,
  daily_rate        NUMERIC,
  rate_type         TEXT DEFAULT 'hourly',   -- 'hourly' or 'daily'
  total_cost        NUMERIC DEFAULT 0,
  description       TEXT,
  category          TEXT DEFAULT 'Shop Work',
  notes             TEXT,
  event_id          TEXT,
  event_name        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.labor_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own labor_entries' AND tablename = 'labor_entries') THEN
    CREATE POLICY "Users manage own labor_entries" ON public.labor_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 26. RPC: INCREMENT TRACK VISIT COUNT
-- ============================================================
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

-- ============================================================
-- 27. STORAGE BUCKET FOR MEDIA
-- ============================================================
-- Create the 'media' storage bucket and its RLS policies.
-- This enables file uploads for: Dashboard photo, Media Gallery, Invoice uploads.

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

-- Storage RLS policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read access to media" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update own media files" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can delete own media files" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Public read access to media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'media');

CREATE POLICY "Users can update own media files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media');

CREATE POLICY "Users can delete own media files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media');


-- ============================================================
-- 28. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pass_logs_user_id      ON public.pass_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pass_logs_date         ON public.pass_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_engines_user_id        ON public.engines(user_id);
CREATE INDEX IF NOT EXISTS idx_superchargers_user_id  ON public.superchargers(user_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_heads_user_id ON public.cylinder_heads(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_user_id    ON public.maintenance_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sfi_certs_user_id      ON public.sfi_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id    ON public.work_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id     ON public.checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_type        ON public.checklists(checklist_type);
CREATE INDEX IF NOT EXISTS idx_parts_inv_user_id      ON public.parts_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_inv_category     ON public.parts_inventory(category);
CREATE INDEX IF NOT EXISTS idx_race_events_user_id    ON public.race_events(user_id);
CREATE INDEX IF NOT EXISTS idx_race_events_date       ON public.race_events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id   ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_user_id  ON public.media_gallery(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_tracks_user_id   ON public.saved_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp   ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chassis_setups_user_id ON public.chassis_setups(user_id);
CREATE INDEX IF NOT EXISTS idx_transmissions_user_id  ON public.transmissions(user_id);
CREATE INDEX IF NOT EXISTS idx_setup_vendors_user_id  ON public.setup_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_user_id ON public.vendor_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_logs_user_id      ON public.engine_swap_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_weather_hist_user_id   ON public.track_weather_history(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id     ON public.todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id  ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_user_id     ON public.team_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_user_id  ON public.labor_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_date     ON public.labor_entries(date DESC);

-- ============================================================
-- 29. AUTO-CREATE PROFILE ON SIGNUP (TRIGGER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, team_name, contact_email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'team_name', 'My Race Team'),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure it's current
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DONE! All 25 tables, RLS policies, indexes, RPC function,
-- and auto-profile trigger have been created.
-- ============================================================

