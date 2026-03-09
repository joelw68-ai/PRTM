-- ============================================================
-- PRO MOD LOGBOOK — CREATE race_events TABLE (FROM SCRATCH)
-- ============================================================
-- Run this in the Supabase SQL Editor if the race_events table
-- does not exist yet.
--
-- This creates the COMPLETE table with all columns, including
-- the newer track_address and track_zip fields.
--
-- Safe to run multiple times: uses IF NOT EXISTS throughout.
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.race_events (
  id                TEXT PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  event_type        TEXT DEFAULT 'Race',
  track_name        TEXT,
  track_location    TEXT,
  track_address     TEXT,
  track_zip         TEXT,
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

-- 2. Enable Row Level Security
ALTER TABLE public.race_events ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy (allows users to manage their own rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users manage own race_events'
      AND tablename = 'race_events'
  ) THEN
    CREATE POLICY "Users manage own race_events"
      ON public.race_events
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Set default for user_id so new rows auto-fill the current user
DO $$ BEGIN
  ALTER TABLE public.race_events
    ALTER COLUMN user_id SET DEFAULT auth.uid();
EXCEPTION WHEN others THEN NULL;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_race_events_user_id
  ON public.race_events(user_id);

CREATE INDEX IF NOT EXISTS idx_race_events_date
  ON public.race_events(start_date DESC);

CREATE INDEX IF NOT EXISTS idx_race_events_track_zip
  ON public.race_events(track_zip);

-- ============================================================
-- DONE!
-- ============================================================
-- Summary:
--   1. Created race_events table with 22 columns:
--        id, user_id, title, event_type, track_name,
--        track_location, track_address (NEW), track_zip (NEW),
--        start_date, end_date, start_time, end_time, status,
--        sanctioning_body, entry_fee, purse, notes, result,
--        best_et, best_mph, rounds_won, created_at, updated_at
--   2. Enabled RLS with "Users manage own race_events" policy
--   3. Set user_id default to auth.uid()
--   4. Created indexes on user_id, start_date, and track_zip
--
-- After running this, race events (including address and ZIP)
-- will save on the first attempt without needing the fallback.
-- ============================================================
