// ═══════════════════════════════════════════════════════════════════════
// trackRecords.ts — Personal-Best records per track per category
// ═══════════════════════════════════════════════════════════════════════
//
// For each saved track, we compute and persist the team's Personal Best
// in 4 categories from the PassLog data:
//
//   • bestET          — lowest 1/8-mile ET (or 1/4-mile if no 1/8 available)
//   • bestMPH         — highest top-end MPH
//   • bestReaction    — lowest reaction time (closest to 0.000 — perfect light)
//   • bestSixtyFoot   — lowest 60-foot
//
// Records are KEYED BY:  track_id (FK → saved_tracks.id)  +  category (TEXT)
//
// PERSISTENCE STRATEGY:
//   1. Compute live PRs from current pass logs (fast, always available)
//   2. Persist the snapshot to `track_records` table (for history / audit)
//   3. If the table doesn't exist in PostgREST schema cache (PGRST205) or
//      hasn't been created yet, fall back gracefully to the live-computed
//      values so the UI continues to work.
//
// "BEAT THIS" indicator:
//   • checkBeatsRecord(pass, record) returns which categories the pass
//     matches or beats so the UI can show a NEW-PR badge.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import { PassLogEntry } from '@/data/proModData';

export type TrackRecordCategory = 'et' | 'mph' | 'reaction' | 'sixtyFoot';

export interface TrackRecord {
  id: string;                       // `${trackId}_${category}` or random uuid
  trackId: string;                  // FK → saved_tracks.id
  trackName: string;                // denormalised for easy display
  category: TrackRecordCategory;
  value: number;                    // the PR value
  passId?: string;                  // FK → pass_logs.id (the pass that set it)
  passDate?: string;                // YYYY-MM-DD
  driverName?: string;              // optional — who set the PR
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackRecordSet {
  trackId: string;
  trackName: string;
  bestET?: TrackRecord;
  bestMPH?: TrackRecord;
  bestReaction?: TrackRecord;
  bestSixtyFoot?: TrackRecord;
  totalPasses: number;
}

// ═════════════════════════════════════════════════════════════
// 1. Compute PRs from current pass-log data (synchronous, fast)
// ═════════════════════════════════════════════════════════════

const matchesTrack = (passTrackName: string | undefined, trackName: string): boolean => {
  if (!passTrackName) return false;
  return passTrackName.toLowerCase().trim() === trackName.toLowerCase().trim();
};

/**
 * Compute the four PR values for one track from the supplied pass logs.
 * Filters out aborted passes, and only considers numeric (>0) readings.
 */
export const computeTrackRecordSet = (
  trackId: string,
  trackName: string,
  passLogs: PassLogEntry[]
): TrackRecordSet => {
  const tracksPasses = passLogs.filter(
    p => !p.aborted && matchesTrack(p.track, trackName)
  );

  if (tracksPasses.length === 0) {
    return { trackId, trackName, totalPasses: 0 };
  }

  // Best ET — prefer 1/8-mile (`eighth`), fall back to quarterMileET
  let bestET: TrackRecord | undefined;
  for (const p of tracksPasses) {
    const et = (p.eighth && p.eighth > 0) ? p.eighth
             : (p.quarterMileET && p.quarterMileET > 0) ? p.quarterMileET
             : 0;
    if (et > 0 && (!bestET || et < bestET.value)) {
      bestET = {
        id: `${trackId}_et`,
        trackId,
        trackName,
        category: 'et',
        value: et,
        passId: p.id,
        passDate: p.date,
        driverName: p.crewChief,
      };
    }
  }

  // Best MPH — prefer 1/8-mile mph, fall back to quarterMileMPH
  let bestMPH: TrackRecord | undefined;
  for (const p of tracksPasses) {
    const mph = (p.mph && p.mph > 0) ? p.mph
             : (p.quarterMileMPH && p.quarterMileMPH > 0) ? p.quarterMileMPH
             : 0;
    if (mph > 0 && (!bestMPH || mph > bestMPH.value)) {
      bestMPH = {
        id: `${trackId}_mph`,
        trackId,
        trackName,
        category: 'mph',
        value: mph,
        passId: p.id,
        passDate: p.date,
      };
    }
  }

  // Best Reaction — lowest positive reaction time (red lights / 0 = invalid)
  let bestReaction: TrackRecord | undefined;
  for (const p of tracksPasses) {
    const rt = p.reactionTime;
    if (rt && rt > 0 && rt < 1.0 && (!bestReaction || rt < bestReaction.value)) {
      bestReaction = {
        id: `${trackId}_reaction`,
        trackId,
        trackName,
        category: 'reaction',
        value: rt,
        passId: p.id,
        passDate: p.date,
      };
    }
  }

  // Best 60-Foot — lowest positive 60 ft time
  let bestSixtyFoot: TrackRecord | undefined;
  for (const p of tracksPasses) {
    const sf = p.sixtyFoot;
    if (sf && sf > 0 && (!bestSixtyFoot || sf < bestSixtyFoot.value)) {
      bestSixtyFoot = {
        id: `${trackId}_sixtyFoot`,
        trackId,
        trackName,
        category: 'sixtyFoot',
        value: sf,
        passId: p.id,
        passDate: p.date,
      };
    }
  }

  return {
    trackId,
    trackName,
    bestET,
    bestMPH,
    bestReaction,
    bestSixtyFoot,
    totalPasses: tracksPasses.length,
  };
};

// ═════════════════════════════════════════════════════════════
// 2. "Beat This" detection — does a pass match / beat any PR?
// ═════════════════════════════════════════════════════════════

export interface BeatResult {
  beatET: boolean;
  matchedET: boolean;
  beatMPH: boolean;
  matchedMPH: boolean;
  beatReaction: boolean;
  matchedReaction: boolean;
  beatSixtyFoot: boolean;
  matchedSixtyFoot: boolean;
  anyImproved: boolean;
}

/** Floating-point tolerance for "matched" detection */
const EPSILON = 0.0005;

/**
 * Compare a pass against the existing record set and return which
 * categories it matched or beat.  Used by the UI to surface a "NEW PR!"
 * indicator when the latest pass at a track equals or improves a record.
 */
export const checkBeatsRecord = (
  pass: PassLogEntry,
  recordSet: TrackRecordSet | undefined | null
): BeatResult => {
  const result: BeatResult = {
    beatET: false, matchedET: false,
    beatMPH: false, matchedMPH: false,
    beatReaction: false, matchedReaction: false,
    beatSixtyFoot: false, matchedSixtyFoot: false,
    anyImproved: false,
  };

  if (!recordSet) return result;

  const passET = (pass.eighth && pass.eighth > 0) ? pass.eighth
              : (pass.quarterMileET && pass.quarterMileET > 0) ? pass.quarterMileET
              : 0;
  if (passET > 0 && recordSet.bestET) {
    if (passET < recordSet.bestET.value - EPSILON) {
      result.beatET = true;
      result.anyImproved = true;
    } else if (Math.abs(passET - recordSet.bestET.value) < EPSILON) {
      result.matchedET = true;
    }
  }

  const passMPH = (pass.mph && pass.mph > 0) ? pass.mph
               : (pass.quarterMileMPH && pass.quarterMileMPH > 0) ? pass.quarterMileMPH
               : 0;
  if (passMPH > 0 && recordSet.bestMPH) {
    if (passMPH > recordSet.bestMPH.value + EPSILON) {
      result.beatMPH = true;
      result.anyImproved = true;
    } else if (Math.abs(passMPH - recordSet.bestMPH.value) < EPSILON) {
      result.matchedMPH = true;
    }
  }

  const passRT = pass.reactionTime;
  if (passRT && passRT > 0 && passRT < 1.0 && recordSet.bestReaction) {
    if (passRT < recordSet.bestReaction.value - EPSILON) {
      result.beatReaction = true;
      result.anyImproved = true;
    } else if (Math.abs(passRT - recordSet.bestReaction.value) < EPSILON) {
      result.matchedReaction = true;
    }
  }

  const passSF = pass.sixtyFoot;
  if (passSF && passSF > 0 && recordSet.bestSixtyFoot) {
    if (passSF < recordSet.bestSixtyFoot.value - EPSILON) {
      result.beatSixtyFoot = true;
      result.anyImproved = true;
    } else if (Math.abs(passSF - recordSet.bestSixtyFoot.value) < EPSILON) {
      result.matchedSixtyFoot = true;
    }
  }

  return result;
};

// ═════════════════════════════════════════════════════════════
// 3. Database persistence  (track_records table)
// ═════════════════════════════════════════════════════════════
//
// Expected schema (run this SQL once in Supabase):
//
//   CREATE TABLE IF NOT EXISTS track_records (
//     id           TEXT PRIMARY KEY,
//     user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//     track_id     TEXT NOT NULL,
//     track_name   TEXT NOT NULL,
//     category     TEXT NOT NULL,        -- 'et' | 'mph' | 'reaction' | 'sixtyFoot'
//     value        NUMERIC NOT NULL,
//     pass_id      TEXT,
//     pass_date    TEXT,
//     driver_name  TEXT,
//     created_at   TIMESTAMPTZ DEFAULT NOW(),
//     updated_at   TIMESTAMPTZ DEFAULT NOW(),
//     UNIQUE(user_id, track_id, category)
//   );
//
//   ALTER TABLE track_records ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Users can manage their own track records"
//     ON track_records FOR ALL
//     USING (auth.uid() = user_id)
//     WITH CHECK (auth.uid() = user_id);
//
// If the table doesn't exist yet, fetch returns [] and upsert silently
// no-ops — the UI continues to work using live-computed values.

const isSchemaCacheError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
};

const toTrackRecord = (row: any): TrackRecord => ({
  id: row.id,
  trackId: row.track_id,
  trackName: row.track_name,
  category: row.category,
  value: typeof row.value === 'number' ? row.value : parseFloat(row.value),
  passId: row.pass_id || undefined,
  passDate: row.pass_date || undefined,
  driverName: row.driver_name || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchTrackRecords = async (userId?: string): Promise<TrackRecord[]> => {
  try {
    let query = supabase.from('track_records').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) {
      if (isSchemaCacheError(error)) {
        console.warn('[fetchTrackRecords] track_records table not available yet — returning []');
        return [];
      }
      console.warn('[fetchTrackRecords] error:', error.message);
      return [];
    }
    return (data || []).map(toTrackRecord);
  } catch (err: any) {
    console.warn('[fetchTrackRecords] unexpected error:', err?.message);
    return [];
  }
};

export const upsertTrackRecord = async (
  record: TrackRecord,
  userId?: string
): Promise<void> => {
  try {
    const payload: any = {
      id: record.id,
      track_id: record.trackId,
      track_name: record.trackName,
      category: record.category,
      value: record.value,
      pass_id: record.passId || null,
      pass_date: record.passDate || null,
      driver_name: record.driverName || null,
      updated_at: new Date().toISOString(),
    };
    if (userId) payload.user_id = userId;

    const { error } = await supabase.from('track_records').upsert(payload);
    if (error) {
      if (isSchemaCacheError(error)) {
        console.warn('[upsertTrackRecord] track_records table not available — skipping persist');
        return;
      }
      console.warn('[upsertTrackRecord] error:', error.message);
    }
  } catch (err: any) {
    console.warn('[upsertTrackRecord] unexpected error:', err?.message);
  }
};

export const deleteTrackRecord = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from('track_records').delete().eq('id', id);
    if (error && !isSchemaCacheError(error)) {
      console.warn('[deleteTrackRecord] error:', error.message);
    }
  } catch (err: any) {
    console.warn('[deleteTrackRecord] unexpected error:', err?.message);
  }
};

/**
 * Persist the four PRs of a TrackRecordSet to the `track_records` table.
 * Fire-and-forget — failures are logged but never throw.
 */
export const persistTrackRecordSet = async (
  set: TrackRecordSet,
  userId?: string
): Promise<void> => {
  const records: TrackRecord[] = [];
  if (set.bestET) records.push(set.bestET);
  if (set.bestMPH) records.push(set.bestMPH);
  if (set.bestReaction) records.push(set.bestReaction);
  if (set.bestSixtyFoot) records.push(set.bestSixtyFoot);

  for (const r of records) {
    await upsertTrackRecord(r, userId);
  }
};
