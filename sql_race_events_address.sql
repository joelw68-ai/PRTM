-- ============================================================
-- PRO MOD LOGBOOK — ADD track_address & track_zip TO race_events
-- ============================================================
-- Run this in the Supabase SQL Editor to add the track_address
-- and track_zip columns to the race_events table.
--
-- Safe to run multiple times: uses IF NOT EXISTS.
--
-- These columns store the full street address and ZIP code for
-- each race event, syncing with the saved_tracks table in
-- Initial Setup. The frontend code is resilient and will work
-- without these columns (it retries without them if they don't
-- exist), but adding them enables full address/ZIP persistence.
-- ============================================================

-- Add track_address column (full street address)
ALTER TABLE public.race_events
  ADD COLUMN IF NOT EXISTS track_address TEXT;

-- Add track_zip column (ZIP code, stored as text for 5+4 format)
ALTER TABLE public.race_events
  ADD COLUMN IF NOT EXISTS track_zip TEXT;

-- Optional: Add an index on track_zip for potential future filtering
CREATE INDEX IF NOT EXISTS idx_race_events_track_zip
  ON public.race_events(track_zip);

-- ============================================================
-- DONE!
-- ============================================================
-- Summary:
--   1. race_events: Added track_address TEXT column
--   2. race_events: Added track_zip TEXT column
--   3. race_events: Added index on track_zip
--
-- After running this migration, the Calendar event form will
-- persist track addresses and ZIP codes to the database.
-- The frontend already handles the case where these columns
-- don't exist (graceful fallback with retry).
-- ============================================================
