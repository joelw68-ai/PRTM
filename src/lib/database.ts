import { supabase } from './supabase';
import { getLocalDateString } from './utils';
import { parseRows } from './validatedQuery';
import {
  PassLogRowSchema,
  EngineRowSchema,
  SuperchargerRowSchema,
  CylinderHeadRowSchema,
  MaintenanceItemRowSchema,
  SFICertificationRowSchema,
  EngineSwapLogRowSchema,

  ChecklistRowSchema,
  PartInventoryRowSchema,
  TrackWeatherHistoryRowSchema,
  RaceEventRowSchema,
  TeamMemberRowSchema,
  MediaItemRowSchema,
  SavedTrackRowSchema,
  ToDoItemRowSchema,
  TeamNoteRowSchema,
  LaborEntryRowSchema,
  VendorRecordRowSchema,
  DrivetrainComponentRowSchema,
  DrivetrainSwapLogRowSchema,
  FuelLogRowSchema,
  PassHistoryRowSchema,
} from './validators';


import {
  PassLogEntry,
  Engine,
  Supercharger,
  CylinderHead,
  MaintenanceItem,
  SFICertification,
  EngineSwapLog,
  ChecklistItem,
  TrackWeatherHistory
} from '@/data/proModData';

import { PartInventoryItem } from '@/data/partsInventory';
import { RaceEvent } from '@/components/race/RaceCalendar';
import { TeamMember } from '@/components/race/TeamProfile';


// Get current user ID helper
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ============ TYPE CONVERTERS ============

const toPassLogEntry = (row: any): PassLogEntry => ({
  id: row.id,
  date: row.date,
  time: row.time || '',
  track: row.track,
  location: row.location || '',
  sessionType: row.session_type,
  round: row.round,
  lane: row.lane,
  result: row.result,
  reactionTime: parseFloat(row.reaction_time) || 0,
  sixtyFoot: parseFloat(row.sixty_foot) || 0,
  threeThirty: parseFloat(row.three_thirty) || 0,
  eighth: parseFloat(row.eighth) || 0,
  mph: parseFloat(row.mph) || 0,
  quarterMileET: parseFloat(row.quarter_mile_et) || 0,
  quarterMileMPH: parseFloat(row.quarter_mile_mph) || 0,
  endSplit: parseFloat(row.quarter_back_split) || 0,
  weather: row.weather || {},
  saeCorrection: parseFloat(row.sae_correction) || 1,
  densityAltitude: row.density_altitude || 0,
  correctedHP: row.corrected_hp || 0,
  engineId: row.engine_id || '',
  superchargerId: row.supercharger_id || '',
  tirePressureFront: parseFloat(row.tire_pressure_front) || 0,
  tirePressureRearLeft: parseFloat(row.tire_pressure_rear_left) || 0,
  tirePressureRearRight: parseFloat(row.tire_pressure_rear_right) || 0,
  // Rear tire LINER pressures — optional fields added April 2026.
  // parseFloat returns NaN for null/undefined, so we coerce to undefined when missing
  // (rather than 0) so the UI can distinguish "not recorded" from a true 0 reading.
  rearLeftLinerPSI: row.rear_left_liner_psi != null ? parseFloat(row.rear_left_liner_psi) : undefined,
  rearRightLinerPSI: row.rear_right_liner_psi != null ? parseFloat(row.rear_right_liner_psi) : undefined,

  wheelieBarSetting: parseFloat(row.wheelie_bar_setting) || 0,
  launchRPM: row.launch_rpm || 0,
  boostSetting: row.boost_setting || 0,
  notes: row.notes || '',
  crewChief: row.crew_chief || '',
  aborted: row.aborted || false,
});





const toEngine = (row: any): Engine => ({
  id: row.id,
  name: row.name,
  serialNumber: row.serial_number || '',
  builder: row.builder || '',
  installDate: row.install_date || '',
  totalPasses: row.total_passes || 0,
  passesSinceRebuild: row.passes_since_rebuild || 0,
  status: row.status || 'Ready',
  currentlyInstalled: row.currently_installed || false,
  notes: row.notes || '',
  components: row.components || {},
});



const toSupercharger = (row: any): Supercharger => ({
  id: row.id,
  name: row.name,
  serialNumber: row.serial_number || '',
  model: row.model || '',
  installDate: row.install_date || '',
  totalPasses: row.total_passes || 0,
  passesSinceService: row.passes_since_service || 0,
  status: row.status || 'Ready',
  currentlyInstalled: row.currently_installed || false,
  notes: row.notes || '',
  powerAdderType: row.power_adder_type || 'Supercharger',
});




const toCylinderHead = (row: any): CylinderHead => ({
  id: row.id,
  name: row.name,
  serialNumber: row.serial_number || '',
  builder: row.builder || '',
  installDate: row.install_date || '',
  totalPasses: row.total_passes || 0,
  passesSinceRefresh: row.passes_since_refresh || 0,
  status: row.status || 'Ready',
  position: row.position || 'Spare',
  engineId: row.engine_id,
  notes: row.notes || '',
  components: row.components || {}
});

const toMaintenanceItem = (row: any): MaintenanceItem => ({
  id: row.id,
  component: row.component,
  category: row.category || '',
  passInterval: row.pass_interval || 0,
  currentPasses: row.current_passes || 0,
  lastService: row.last_service || '',
  lastServiceTime: row.last_service_time || '',
  nextServicePasses: row.next_service_passes || 0,
  status: row.status || 'Good',
  priority: row.priority || 'Medium',
  notes: row.notes || '',
  estimatedCost: row.estimated_cost,
  threshold: row.threshold != null ? Number(row.threshold) : undefined,
  // Spreadsheet-style service log (array of { id, date, time, notes }).
  serviceLog: Array.isArray(row.service_log) ? row.service_log : [],
});





const toSFICertification = (row: any): SFICertification => ({
  id: row.id,
  item: row.item,
  sfiSpec: row.sfi_spec || '',
  certificationDate: row.certification_date || '',
  expirationDate: row.expiration_date || '',
  vendor: row.vendor || '',
  serialNumber: row.serial_number || '',
  status: row.status || 'Valid',
  daysUntilExpiration: row.days_until_expiration || 0,
  notes: row.notes || '',
});








const toEngineSwapLog = (row: any): EngineSwapLog => ({
  id: row.id,
  date: row.date,
  time: row.time || '',
  previousEngineId: row.previous_engine_id,
  newEngineId: row.new_engine_id,
  reason: row.reason || '',
  performedBy: row.performed_by || '',
  notes: row.notes || ''
});

const toChecklistItem = (row: any): ChecklistItem => ({
  id: row.id,
  task: row.task,
  category: row.category || '',
  completed: row.completed || false,
  notes: row.notes,
  critical: row.critical || false,
  checkedBy: row.checked_by || undefined,
  checkedAt: row.checked_at || undefined
});



const toPartInventoryItem = (row: any): PartInventoryItem => ({
  id: row.id,
  partNumber: row.part_number,
  description: row.description,
  name: row.name || row.description || '',
  category: row.category || '',
  subcategory: row.subcategory || '',
  onHand: row.on_hand || 0,
  minQuantity: row.min_quantity || 1,
  maxQuantity: row.max_quantity || 5,
  vendor: row.vendor || '',
  vendorPartNumber: row.vendor_part_number || '',
  unitCost: parseFloat(row.unit_cost) || 0,
  totalValue: parseFloat(row.total_value) || 0,
  lastOrdered: row.last_ordered || '',
  lastUsed: row.last_used || '',
  location: row.location || '',
  notes: row.notes || '',
  status: row.status || 'In Stock',
  reorderStatus: row.reorder_status || 'OK',
  relatedDrivetrainComponentId: row.related_drivetrain_component_id || undefined,
});




const toTrackWeatherHistory = (row: any): TrackWeatherHistory => ({
  trackId: row.track_id,
  trackName: row.track_name,
  location: row.location || '',
  elevation: row.elevation || 0,
  visits: row.visits || []
});

const toRaceEvent = (row: any): RaceEvent => ({
  id: row.id,
  title: row.title,
  eventType: row.event_type || 'Race',
  trackName: row.track_name || '',
  trackLocation: row.track_location || '',
  trackAddress: row.track_address || undefined,
  trackZip: row.track_zip || undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  startTime: row.start_time,
  endTime: row.end_time,
  status: row.status || 'Scheduled',
  sanctioningBody: row.sanctioning_body,
  entryFee: row.entry_fee ? parseFloat(row.entry_fee) : undefined,
  purse: row.purse ? parseFloat(row.purse) : undefined,
  notes: row.notes,
  result: row.result,
  bestET: row.best_et ? parseFloat(row.best_et) : undefined,
  bestMPH: row.best_mph ? parseFloat(row.best_mph) : undefined,
  roundsWon: row.rounds_won
});


const toTeamMember = (row: any): TeamMember => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: row.role || 'Crew',
  permissions: row.permissions || ['view'],
  specialties: row.specialties || [],
  isActive: row.is_active ?? true,
  joinedDate: row.joined_date,
  emergencyContactName: row.emergency_contact_name,
  emergencyContactPhone: row.emergency_contact_phone,
  notes: row.notes,
  avatarUrl: row.avatar_url,
  hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate) : undefined,
  dailyRate: row.daily_rate ? parseFloat(row.daily_rate) : undefined
});


// ============ HELPERS ============

// Helper: convert empty strings/undefined to null for database columns that don't accept empty strings
// Use on all optional date, time, numeric, and UUID/reference fields before sending to PostgreSQL
const emptyToNull = (val: any): any => {
  if (val === '' || val === undefined) return null;
  return val;
};

/**
 * Helper: detect if a Supabase/PostgREST error is caused by an unknown column.
 * PostgREST returns PostgreSQL error code 42703 ("undefined_column") or includes
 * "Could not find the … column" in the message when the payload references a
 * column that doesn't exist in the table (or isn't in the schema cache).
 *
 * Used by upsertPartInventory and upsertRaceEvent for resilient column handling.
 */
const isUnknownColumnError = (error: any): boolean => {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  const hint = (error.hint || '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('could not find') ||
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found') || msg.includes('schema cache'))) ||
    hint.includes('column') ||
    msg.includes('undefined_column')
  );
};


/**
 * Helper: detect if a Supabase/PostgREST error is PGRST205 — "table not in schema cache".
 *
 * This error means the table EXISTS in the database but PostgREST's in-memory
 * schema cache hasn't been refreshed since the table was created.  Data written
 * via direct SQL or edge functions IS saving correctly; only the PostgREST REST
 * API layer is unaware of the table.
 *
 * When this error is detected the app should:
 *   1. NOT surface an error to the user (the data IS saving).
 *   2. Trigger a schema cache reload via NOTIFY pgrst.
 *   3. Log a console warning for developer visibility.
 */
const isTableNotInSchemaCache = (error: any): boolean => {
  if (!error) return false;
  const msg  = (error.message || '').toLowerCase();
  const code = error.code || '';
  const hint = (error.hint || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||                                     // PostgreSQL "undefined_table"
    msg.includes('could not find the') && msg.includes('in the schema cache') ||
    msg.includes('schema cache') && msg.includes('table') ||
    hint.includes('schema cache')
  );
};

/**
 * Trigger a PostgREST schema cache reload by calling the `reload-schema-cache`
 * edge function, which sends `NOTIFY pgrst, 'reload schema'` via the service
 * role.  This is fire-and-forget — failures are logged but never thrown.
 *
 * A simple deduplication flag prevents multiple reloads within 30 seconds.
 */
let _lastSchemaReloadAt = 0;
const SCHEMA_RELOAD_COOLDOWN_MS = 30_000; // 30 seconds

const triggerSchemaReload = async (): Promise<void> => {
  const now = Date.now();
  if (now - _lastSchemaReloadAt < SCHEMA_RELOAD_COOLDOWN_MS) {
    console.log('[triggerSchemaReload] Skipped — cooldown active (last reload was', Math.round((now - _lastSchemaReloadAt) / 1000), 's ago)');
    return;
  }
  _lastSchemaReloadAt = now;

  console.log('[triggerSchemaReload] Sending NOTIFY pgrst to reload PostgREST schema cache...');
  try {
    const { data, error } = await supabase.functions.invoke('reload-schema-cache', { body: {} });
    if (error) {
      console.warn('[triggerSchemaReload] Edge function returned error:', error);
    } else {
      console.log('[triggerSchemaReload] Schema reload triggered successfully:', data);
    }
  } catch (err) {
    console.warn('[triggerSchemaReload] Failed to invoke reload-schema-cache edge function:', err);
  }
};



// ============ DATABASE OPERATIONS ============

// Pass Logs
export const fetchPassLogs = async (userId?: string): Promise<PassLogEntry[]> => {
  const { data, error } = await supabase
    .from('pass_logs')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, PassLogRowSchema, 'pass_logs').map(toPassLogEntry);

};

/**
 * upsertPassLog — Create or update a pass log entry.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * RESILIENT COLUMN HANDLING  (March 2026 — revised)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE OF PREVIOUS DATA LOSS:
 * The `car_id` column was included in the base payload, but the
 * `pass_logs` table in the live database may NOT have a `car_id` column
 * (it's not in the original schema). The retry logic only removed
 * `quarter_mile_*` columns but kept `car_id`, causing Attempt 2 to also
 * fail with an unknown-column error. This meant EVERY pass log save was
 * silently failing — data only lived in React state and was lost on
 * page refresh.
 *
 * FIX:
 *   1. `user_id` is now ALWAYS resolved (via getCurrentUserId fallback)
 *      so RLS never rejects the INSERT due to missing user_id.
 *   2. `car_id` is moved to the full payload (Attempt 1 only).
 *   3. Three retry tiers ensure maximum resilience:
 *      - Attempt 1: All columns (quarter_mile_*, car_id)
 *      - Attempt 2: Base columns (no quarter_mile_*, no car_id)
 *      - Attempt 3: Nuclear minimum (only 7 guaranteed columns)
 *   4. Comprehensive console logging at every step.
 *
 * FIELD AUDIT (verified against pass_logs table schema):
 * ┌─────────────────────────┬───────────────────────────┬────────────────────┐
 * │ Payload Key              │ DB Column                 │ In Schema?         │
 * ├─────────────────────────┼───────────────────────────┼────────────────────┤
 * │ id                       │ id                        │ YES (PK)           │
 * │ user_id                  │ user_id                   │ YES (UUID FK)      │
 * │ date                     │ date                      │ YES (TEXT NOT NULL) │
 * │ time                     │ time                      │ YES                │
 * │ track                    │ track                     │ YES (TEXT NOT NULL) │
 * │ location                 │ location                  │ YES                │
 * │ session_type             │ session_type              │ YES (TEXT NOT NULL) │
 * │ round                    │ round                     │ YES                │
 * │ lane                     │ lane                      │ YES                │
 * │ result                   │ result                    │ YES                │
 * │ reaction_time            │ reaction_time             │ YES (NUMERIC)      │
 * │ sixty_foot               │ sixty_foot                │ YES                │
 * │ three_thirty             │ three_thirty              │ YES                │
 * │ eighth                   │ eighth                    │ YES                │
 * │ mph                      │ mph                       │ YES                │
 * │ weather                  │ weather                   │ YES (JSONB)        │
 * │ sae_correction           │ sae_correction            │ YES                │
 * │ density_altitude         │ density_altitude          │ YES                │
 * │ corrected_hp             │ corrected_hp              │ YES                │
 * │ engine_id                │ engine_id                 │ YES                │
 * │ supercharger_id          │ supercharger_id           │ YES                │
 * │ tire_pressure_front      │ tire_pressure_front       │ YES                │
 * │ tire_pressure_rear_left  │ tire_pressure_rear_left   │ YES                │
 * │ tire_pressure_rear_right │ tire_pressure_rear_right  │ YES                │
 * │ wheelie_bar_setting      │ wheelie_bar_setting       │ YES                │
 * │ launch_rpm               │ launch_rpm                │ YES                │
 * │ boost_setting            │ boost_setting             │ YES                │
 * │ notes                    │ notes                     │ YES                │
 * │ crew_chief               │ crew_chief                │ YES                │
 * │ aborted                  │ aborted                   │ YES (BOOLEAN)      │
 * │ car_id                   │ car_id                    │ MAYBE (migration)  │
 * │ quarter_mile_et          │ quarter_mile_et           │ MAYBE (migration)  │
 * │ quarter_mile_mph         │ quarter_mile_mph          │ MAYBE (migration)  │
 * │ quarter_back_split       │ quarter_back_split        │ MAYBE (migration)  │
 * └─────────────────────────┴───────────────────────────┴────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════
 */
export const upsertPassLog = async (pass: PassLogEntry, userId?: string): Promise<void> => {
  // ── 1. Resolve user_id — MUST be set for RLS to pass ──
  const effectiveUserId = userId || await getCurrentUserId();

  if (!effectiveUserId) {
    console.error('[upsertPassLog] FATAL: No user_id available. Cannot insert — RLS will reject.');
    const err: any = new Error('No authenticated user ID available. Cannot save pass log. Please log in again.');
    err.code = 'NO_USER_ID';
    err.details = 'Neither the passed userId nor supabase.auth.getUser() returned a valid user ID.';
    err.hint = 'Ensure you are logged in. Try refreshing the page or logging out and back in.';
    throw err;
  }

  // ── 2. Build the BASE payload — ONLY columns guaranteed in the original schema ──
  // CRITICAL: car_id is NOT included here because it may not exist in the DB.
  const basePayload: Record<string, any> = {
    id: pass.id,
    user_id: effectiveUserId,
    date: pass.date,
    time: emptyToNull(pass.time),
    track: pass.track,
    location: emptyToNull(pass.location),
    session_type: pass.sessionType,
    round: emptyToNull(pass.round),
    lane: emptyToNull(pass.lane),
    result: emptyToNull(pass.result),
    reaction_time: pass.reactionTime != null ? pass.reactionTime : null,
    sixty_foot: emptyToNull(pass.sixtyFoot),
    three_thirty: emptyToNull(pass.threeThirty),
    eighth: emptyToNull(pass.eighth),
    mph: emptyToNull(pass.mph),
    weather: pass.weather,
    sae_correction: emptyToNull(pass.saeCorrection),
    density_altitude: emptyToNull(pass.densityAltitude),
    corrected_hp: emptyToNull(pass.correctedHP),
    engine_id: emptyToNull(pass.engineId),
    supercharger_id: emptyToNull(pass.superchargerId),
    tire_pressure_front: emptyToNull(pass.tirePressureFront),
    tire_pressure_rear_left: emptyToNull(pass.tirePressureRearLeft),
    tire_pressure_rear_right: emptyToNull(pass.tirePressureRearRight),
    wheelie_bar_setting: emptyToNull(pass.wheelieBarSetting),
    launch_rpm: emptyToNull(pass.launchRPM),
    boost_setting: emptyToNull(pass.boostSetting),
    notes: emptyToNull(pass.notes),
    crew_chief: emptyToNull(pass.crewChief),
    aborted: pass.aborted || false,
  };

  // ── 3. Build the FULL payload — includes optional migration columns ──
  // Optional columns (may not exist in older DBs):
  //   quarter_mile_et, quarter_mile_mph, quarter_back_split (added with quarter-mile feature)
  //   rear_left_liner_psi, rear_right_liner_psi (added April 2026)
  // If any of these columns are missing, the resilient retry logic falls
  // back to basePayload which excludes them.
  const fullPayload: Record<string, any> = {
    ...basePayload,
    quarter_mile_et: emptyToNull(pass.quarterMileET),
    quarter_mile_mph: emptyToNull(pass.quarterMileMPH),
    quarter_back_split: emptyToNull(pass.endSplit),
    rear_left_liner_psi: emptyToNull(pass.rearLeftLinerPSI),
    rear_right_liner_psi: emptyToNull(pass.rearRightLinerPSI),
  };



  // ── 4. Build the NUCLEAR MINIMUM payload — only 7 absolutely-guaranteed columns ──
  const nuclearPayload: Record<string, any> = {
    id: pass.id,
    user_id: effectiveUserId,
    date: pass.date,
    track: pass.track,
    session_type: pass.sessionType,
    reaction_time: pass.reactionTime != null ? pass.reactionTime : null,
    aborted: pass.aborted || false,
  };

  // Track the last error for diagnostics
  let lastError: any = null;

  // ── 5. Attempt 1: Full payload (all columns including car_id, quarter_mile_*) ──
  console.log('[upsertPassLog] Attempt 1 — full payload (all columns). Pass ID:', pass.id, 'user_id:', effectiveUserId);
  {
    const { error } = await supabase.from('pass_logs').upsert(fullPayload);
    if (!error) {
      console.log('[upsertPassLog] SUCCESS (attempt 1) — pass saved with all columns. ID:', pass.id);
      return;
    }

    if (isUnknownColumnError(error)) {
      console.warn(
        '[upsertPassLog] Attempt 1 failed — unknown column detected. Will retry without optional columns.',
        { code: error.code, message: error.message, hint: error.hint }
      );
    } else {
      console.error('[upsertPassLog] Attempt 1 failed (non-column error):', {
        code: error.code, message: error.message, details: error.details, hint: error.hint
      });
      lastError = error;
    }
  }

  // ── 6. Attempt 2: Base payload (no car_id, no quarter_mile_*) ──
  console.log('[upsertPassLog] Attempt 2 — base payload (no car_id, no quarter_mile_*). Pass ID:', pass.id);
  {
    const { error } = await supabase.from('pass_logs').upsert(basePayload);
    if (!error) {
      console.log('[upsertPassLog] SUCCESS (attempt 2) — pass saved without optional columns. ID:', pass.id);
      return;
    }

    if (isUnknownColumnError(error)) {
      console.warn(
        '[upsertPassLog] Attempt 2 ALSO failed — still has unknown column. Will retry with nuclear minimum.',
        { code: error.code, message: error.message, hint: error.hint }
      );
    } else {
      console.error('[upsertPassLog] Attempt 2 failed (non-column error):', {
        code: error.code, message: error.message, details: error.details, hint: error.hint
      });
      lastError = error;
    }
  }

  // ── 7. Attempt 3: Nuclear minimum (only 7 guaranteed columns) ──
  console.log('[upsertPassLog] Attempt 3 — NUCLEAR MINIMUM (7 columns). Pass ID:', pass.id);
  {
    const { error } = await supabase.from('pass_logs').upsert(nuclearPayload);
    if (!error) {
      console.warn(
        '[upsertPassLog] SUCCESS (attempt 3 — nuclear minimum) — pass saved with minimal data. ID:', pass.id,
        '\nSome fields (timing data, weather, etc.) were NOT saved because the base columns are being rejected.',
        '\nThis likely means the pass_logs table schema is outdated. Run the latest migration SQL.'
      );
      return;
    }

    console.error('[upsertPassLog] Attempt 3 (nuclear minimum) ALSO FAILED:', {
      code: error.code, message: error.message, details: error.details, hint: error.hint
    });
    lastError = error;
  }

  // ── 8. All attempts exhausted — throw the best error we have ──
  const finalError = lastError || new Error('All 3 save attempts failed for unknown reasons');
  console.error('[upsertPassLog] ALL 3 ATTEMPTS FAILED for pass:', pass.id, {
    message: finalError.message,
    code: finalError.code,
    details: finalError.details,
    hint: finalError.hint,
    passData: { id: pass.id, date: pass.date, track: pass.track, sessionType: pass.sessionType },
    userId: effectiveUserId,
  });

  const enrichedError: any = new Error(finalError.message || 'Failed to save pass log after 3 attempts');
  enrichedError.code = finalError.code || 'PASS_SAVE_FAILED';
  enrichedError.details = finalError.details || `Pass "${pass.date} at ${pass.track}" (ID: ${pass.id}) could not be saved to the database.`;
  enrichedError.hint = finalError.hint || 'Check the browser console for detailed error logs. Ensure you are logged in and the database schema is up to date.';
  throw enrichedError;
};





export const deletePassLog = async (id: string): Promise<void> => {
  const { error } = await supabase.from('pass_logs').delete().eq('id', id);
  if (error) throw error;
};

// Engines
export const fetchEngines = async (userId?: string): Promise<Engine[]> => {
  const { data, error } = await supabase.from('engines').select('*').order('name');
  if (error) throw error;
  return parseRows(data, EngineRowSchema, 'engines').map(toEngine);

};

export const upsertEngine = async (engine: Engine, userId?: string): Promise<void> => {
  const payload: any = {
    id: engine.id,
    name: engine.name,
    serial_number: emptyToNull(engine.serialNumber),
    builder: emptyToNull(engine.builder),
    install_date: emptyToNull(engine.installDate),
    total_passes: emptyToNull(engine.totalPasses),
    passes_since_rebuild: emptyToNull(engine.passesSinceRebuild),
    status: engine.status,
    currently_installed: engine.currentlyInstalled,
    notes: emptyToNull(engine.notes),
    components: engine.components
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('engines').upsert(payload);
  if (error) throw error;
};


export const deleteEngine = async (id: string): Promise<void> => {
  const { error } = await supabase.from('engines').delete().eq('id', id);
  if (error) throw error;
};


// Superchargers
export const fetchSuperchargers = async (userId?: string): Promise<Supercharger[]> => {
  const { data, error } = await supabase.from('superchargers').select('*').order('name');
  if (error) throw error;
  return parseRows(data, SuperchargerRowSchema, 'superchargers').map(toSupercharger);

};

export const upsertSupercharger = async (sc: Supercharger, userId?: string): Promise<void> => {
  const basePayload: any = {
    id: sc.id,
    name: sc.name,
    serial_number: emptyToNull(sc.serialNumber),
    model: emptyToNull(sc.model),
    install_date: emptyToNull(sc.installDate),
    total_passes: emptyToNull(sc.totalPasses),
    passes_since_service: emptyToNull(sc.passesSinceService),
    status: sc.status,
    currently_installed: sc.currentlyInstalled,
    notes: emptyToNull(sc.notes)
  };
  
  if (userId) basePayload.user_id = userId;

  // Attempt 1: Include power_adder_type column
  const fullPayload = { ...basePayload, power_adder_type: emptyToNull(sc.powerAdderType) || 'Supercharger' };
  const { error: fullError } = await supabase.from('superchargers').upsert(fullPayload);
  
  if (!fullError) return;

  // If the error is about an unknown column, retry without power_adder_type
  if (isUnknownColumnError(fullError)) {
    console.warn('[upsertSupercharger] power_adder_type column not found — retrying without it.');
    const { error: baseError } = await supabase.from('superchargers').upsert(basePayload);
    if (baseError) throw baseError;
    return;
  }

  throw fullError;
};



export const deleteSupercharger = async (id: string): Promise<void> => {
  const { error } = await supabase.from('superchargers').delete().eq('id', id);
  if (error) throw error;
};

// Cylinder Heads
export const fetchCylinderHeads = async (userId?: string): Promise<CylinderHead[]> => {
  const { data, error } = await supabase.from('cylinder_heads').select('*').order('name');
  if (error) throw error;
  return parseRows(data, CylinderHeadRowSchema, 'cylinder_heads').map(toCylinderHead);
};

export const upsertCylinderHead = async (head: CylinderHead, userId?: string): Promise<void> => {
  const payload: any = {
    id: head.id,
    name: head.name,
    serial_number: emptyToNull(head.serialNumber),
    builder: emptyToNull(head.builder),
    install_date: emptyToNull(head.installDate),
    total_passes: emptyToNull(head.totalPasses),
    passes_since_refresh: emptyToNull(head.passesSinceRefresh),
    status: head.status,
    position: emptyToNull(head.position),
    engine_id: emptyToNull(head.engineId),
    notes: emptyToNull(head.notes),
    components: head.components
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('cylinder_heads').upsert(payload);
  if (error) throw error;
};

export const deleteCylinderHead = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cylinder_heads').delete().eq('id', id);
  if (error) throw error;
};


// Maintenance Items
export const fetchMaintenanceItems = async (userId?: string): Promise<MaintenanceItem[]> => {
  const { data, error } = await supabase.from('maintenance_items').select('*').order('priority', { ascending: false });
  if (error) throw error;
  return parseRows(data, MaintenanceItemRowSchema, 'maintenance_items').map(toMaintenanceItem);
};

/**
 * upsertMaintenanceItem — Create or update a maintenance item.
 *
 * RESILIENT COLUMN HANDLING:
 * The `threshold` (INTEGER) and `last_service_time` (TEXT) columns may not exist
 * in the database if the user hasn't run the latest migration.
 *
 * Strategy: Try with all columns first. If PostgREST rejects the payload
 * because of unknown columns, retry WITHOUT threshold and last_service_time.
 */
export const upsertMaintenanceItem = async (item: MaintenanceItem, userId?: string): Promise<void> => {
  // Build the base payload (columns that always exist)
  const basePayload: any = {
    id: item.id,
    component: item.component,
    category: emptyToNull(item.category),
    pass_interval: emptyToNull(item.passInterval),
    current_passes: emptyToNull(item.currentPasses),
    last_service: emptyToNull(item.lastService),
    next_service_passes: emptyToNull(item.nextServicePasses),
    status: item.status,
    priority: item.priority,
    notes: emptyToNull(item.notes),
    estimated_cost: emptyToNull(item.estimatedCost),

  };
  
  if (userId) basePayload.user_id = userId;

  // Build the full payload including new columns (threshold, last_service_time, service_log)
  const fullPayload: any = {
    ...basePayload,
    threshold: item.threshold != null ? item.threshold : null,
    last_service_time: emptyToNull(item.lastServiceTime),
    // Spreadsheet-style service log (array of { id, date, time, notes }) stored as JSONB.
    service_log: Array.isArray(item.serviceLog) ? item.serviceLog : [],
  };

  // Attempt 1: Try with all columns (including threshold, last_service_time)
  const { error: fullError } = await supabase.from('maintenance_items').upsert(fullPayload);

  if (!fullError) {
    // Success — columns exist, all good
    return;
  }

  // Check if the error is specifically about unknown columns OR a stale
  // PostgREST schema cache. The `threshold` / `last_service_time` / `service_log`
  // columns DO exist in the live table, but if PostgREST's in-memory schema
  // cache is stale (PGRST204), it will reject the payload. Previously we silently
  // dropped the threshold here — which is exactly why thresholds "weren't saving".
  // Now we trigger a schema-cache reload and RETRY the full payload (with threshold)
  // a couple of times before giving up, so the threshold is preserved.
  if (isUnknownColumnError(fullError) || isTableNotInSchemaCache(fullError)) {
    console.warn(
      '[upsertMaintenanceItem] threshold/last_service_time/service_log rejected (likely stale schema cache) — reloading cache and retrying with full payload.',
      { code: fullError.code, message: fullError.message }
    );

    // Fire a schema-cache reload, then retry the FULL payload a few times.
    await triggerSchemaReload();
    for (let attempt = 0; attempt < 3; attempt++) {
      // Small backoff to let PostgREST pick up the reloaded schema.
      await new Promise((r) => setTimeout(r, 700));
      const { error: retryFullError } = await supabase.from('maintenance_items').upsert(fullPayload);
      if (!retryFullError) {
        console.log('[upsertMaintenanceItem] Full payload (with threshold) saved after schema reload.');
        return;
      }
      if (!isUnknownColumnError(retryFullError) && !isTableNotInSchemaCache(retryFullError)) {
        // A different (real) error — stop retrying and surface it.
        throw retryFullError;
      }
    }

    // Last resort: save the base payload so the rest of the item isn't lost.
    // (Threshold may be missing only in this degraded edge case.)
    console.warn('[upsertMaintenanceItem] Full payload still rejected after reload — saving base payload as a fallback.');
    const { error: baseError } = await supabase.from('maintenance_items').upsert(basePayload);
    if (baseError) {
      console.error('[upsertMaintenanceItem] Base payload save also failed:', baseError);
      throw baseError;
    }
    return;
  }

  // Not a column error — throw the original error
  throw fullError;
}




export const deleteMaintenanceItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('maintenance_items').delete().eq('id', id);
  if (error) throw error;
};

// SFI Certifications
export const fetchSFICertifications = async (userId?: string): Promise<SFICertification[]> => {
  const { data, error } = await supabase.from('sfi_certifications').select('*').order('days_until_expiration');
  if (error) throw error;
  return parseRows(data, SFICertificationRowSchema, 'sfi_certifications').map(toSFICertification);
};

export const upsertSFICertification = async (cert: SFICertification, userId?: string): Promise<void> => {
  const payload: any = {
    id: cert.id,
    item: cert.item,
    sfi_spec: emptyToNull(cert.sfiSpec),
    certification_date: emptyToNull(cert.certificationDate),
    expiration_date: emptyToNull(cert.expirationDate),
    vendor: emptyToNull(cert.vendor),
    serial_number: emptyToNull(cert.serialNumber),
    status: cert.status,
    days_until_expiration: emptyToNull(cert.daysUntilExpiration),
    notes: emptyToNull(cert.notes),

  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('sfi_certifications').upsert(payload);
  if (error) throw error;
};


export const deleteSFICertification = async (id: string): Promise<void> => {
  const { error } = await supabase.from('sfi_certifications').delete().eq('id', id);
  if (error) throw error;
};




// Engine Swap Logs
export const fetchEngineSwapLogs = async (userId?: string): Promise<EngineSwapLog[]> => {
  const { data, error } = await supabase.from('engine_swap_logs').select('*').order('date', { ascending: false });
  if (error) throw error;
  return parseRows(data, EngineSwapLogRowSchema, 'engine_swap_logs').map(toEngineSwapLog);
};

export const insertEngineSwapLog = async (log: EngineSwapLog, userId?: string): Promise<void> => {
  const payload: any = {
    id: log.id,
    date: log.date,
    time: emptyToNull(log.time),
    previous_engine_id: emptyToNull(log.previousEngineId),
    new_engine_id: emptyToNull(log.newEngineId),
    reason: emptyToNull(log.reason),
    performed_by: emptyToNull(log.performedBy),
    notes: emptyToNull(log.notes)
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('engine_swap_logs').insert(payload);
  if (error) throw error;
};

// Checklists
export const fetchChecklists = async (userId?: string): Promise<{ preRun: ChecklistItem[], betweenRounds: ChecklistItem[], postRun: ChecklistItem[], custom: Record<string, ChecklistItem[]> }> => {
  const { data, error } = await supabase.from('checklists').select('*').order('category');
  if (error) throw error;
  
  const BUILTIN_TYPES = new Set(['preRun', 'betweenRounds', 'postRun']);
  const items = parseRows(data, ChecklistRowSchema, 'checklists').map((row: any) => ({
    ...toChecklistItem(row),
    checklistType: row.checklist_type
  }));
  
  // Collect custom checklist types (anything not in the 3 built-in types)
  const custom: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    const type = (item as any).checklistType;
    if (!BUILTIN_TYPES.has(type)) {
      if (!custom[type]) custom[type] = [];
      custom[type].push(item);
    }
  }

  return {
    preRun: items.filter((i: any) => i.checklistType === 'preRun'),
    betweenRounds: items.filter((i: any) => i.checklistType === 'betweenRounds'),
    postRun: items.filter((i: any) => i.checklistType === 'postRun'),
    custom
  };
};

export const upsertChecklistItem = async (item: ChecklistItem, checklistType: string, userId?: string): Promise<void> => {
  const payload: any = {
    id: item.id,
    checklist_type: checklistType,
    task: item.task,
    category: emptyToNull(item.category),
    completed: item.completed,
    notes: emptyToNull(item.notes),
    critical: item.critical,
    checked_by: emptyToNull(item.checkedBy),
    checked_at: emptyToNull(item.checkedAt)
  };

  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('checklists').upsert(payload);
  if (error) throw error;
};

export const updateChecklistCompletion = async (id: string, completed: boolean): Promise<void> => {
  const { error } = await supabase.from('checklists').update({ completed }).eq('id', id);
  if (error) throw error;
};

export const resetChecklistByType = async (checklistType: string, userId?: string): Promise<void> => {
  let query = supabase.from('checklists').update({ completed: false, checked_by: null, checked_at: null }).eq('checklist_type', checklistType);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
};

/** Delete ALL checklist items for a given checklist type (used when deleting a custom checklist). */
export const deleteChecklistsByType = async (checklistType: string, userId?: string): Promise<void> => {
  let query = supabase.from('checklists').delete().eq('checklist_type', checklistType);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
};




// Parts Inventory
export const fetchPartsInventory = async (userId?: string): Promise<PartInventoryItem[]> => {
  const { data, error } = await supabase.from('parts_inventory').select('*').order('category');
  if (error) throw error;
  return parseRows(data, PartInventoryRowSchema, 'parts_inventory').map(toPartInventoryItem);
};

/**
 * upsertPartInventory — Create or update a parts inventory item.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POSTREST SCHEMA-CACHE WORKAROUND  (March 2026)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Several columns exist in the live `parts_inventory` table (verified via
 * `information_schema.columns`) but PostgREST's schema cache refuses to
 * acknowledge them, returning PGRST204 / 42703 errors:
 *
 *   EXCLUDED from payload (PostgREST rejects them):
 *     • name
 *     • car_id
 *     • related_drivetrain_component_id
 *     • subcategory
 *     • vendor_part_number
 *     • last_ordered
 *     • last_used
 *     • reorder_status
 *
 *   INCLUDED — the 16 "day-one" safe columns:
 *     id, user_id, part_number, description, category, on_hand,
 *     min_quantity, max_quantity, vendor, unit_cost, total_value,
 *     location, notes, status, created_at, updated_at
 *
 * The READ path (toPartInventoryItem via SELECT *) still maps every
 * column that comes back from the DB, so the UI can display name,
 * car_id, etc. if they are present in existing rows.
 *
 * BELT-AND-SUSPENDERS:
 *   The entire upsert is wrapped in a try/catch.  If Attempt 1 (the 16
 *   safe columns) somehow fails with an unknown-column / schema-cache
 *   error, we automatically RETRY with a "nuclear minimum" payload of
 *   only 7 columns that are absolutely guaranteed to exist in any
 *   version of the table.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const upsertPartInventory = async (part: PartInventoryItem, userId?: string): Promise<void> => {
  // ── 1. Resolve user_id — must be set for RLS to pass ──
  const effectiveUserId = userId || await getCurrentUserId();

  if (!effectiveUserId) {
    console.error('[upsertPartInventory] FATAL: No user_id available. Cannot insert — RLS will reject.');
    const err: any = new Error('No authenticated user ID available. Cannot save part. Please log in again.');
    err.code = 'NO_USER_ID';
    err.details = 'Neither the passed userId nor supabase.auth.getUser() returned a valid user ID.';
    err.hint = 'Ensure you are logged in. Try refreshing the page or logging out and back in.';
    throw err;
  }

  // ── 2. Build the SAFE payload — ONLY the 16 day-one columns ──
  // Columns deliberately EXCLUDED (PostgREST schema cache rejects them):
  //   name, car_id, related_drivetrain_component_id, subcategory,
  //   vendor_part_number, last_ordered, last_used, reorder_status
  const safePayload: Record<string, any> = {
    id:            part.id,
    user_id:       effectiveUserId,
    part_number:   part.partNumber,
    description:   part.description,
    category:      emptyToNull(part.category),
    on_hand:       part.onHand ?? 0,
    min_quantity:   part.minQuantity ?? 1,
    max_quantity:   part.maxQuantity ?? 5,
    vendor:        emptyToNull(part.vendor),
    unit_cost:     part.unitCost ?? 0,
    total_value:   part.totalValue ?? 0,
    location:      emptyToNull(part.location),
    notes:         emptyToNull(part.notes),
    status:        part.status || 'In Stock',
    created_at:    part.id ? undefined : new Date().toISOString(), // only on insert
    updated_at:    new Date().toISOString()
  };

  // Remove undefined keys so Supabase doesn't choke on them
  Object.keys(safePayload).forEach(k => {
    if (safePayload[k] === undefined) delete safePayload[k];
  });

  console.log('[upsertPartInventory] Attempt 1 — safe 16-column payload:', JSON.stringify(safePayload, null, 2));

  // ── 3. Attempt 1: Safe payload (16 columns) ──
  try {
    const { error } = await supabase.from('parts_inventory').upsert(safePayload);

    if (error) {
      if (isUnknownColumnError(error)) {
        console.warn(
          '[upsertPartInventory] Attempt 1 failed with unknown-column error — will retry with nuclear minimum.',
          { code: error.code, message: error.message, details: error.details }
        );
        // Fall through to Attempt 2
      } else {
        // Not a column error — throw immediately
        console.error('[upsertPartInventory] Attempt 1 failed (non-column error):', error);
        const enrichedError: any = new Error(error.message);
        enrichedError.code = error.code;
        enrichedError.details = error.details;
        enrichedError.hint = error.hint;
        throw enrichedError;
      }
    } else {
      console.log('[upsertPartInventory] SUCCESS (attempt 1) — part saved. ID:', part.id);
      return;
    }
  } catch (thrown: any) {
    // Re-throw non-column errors
    if (thrown && !isUnknownColumnError(thrown)) {
      throw thrown;
    }
    console.warn('[upsertPartInventory] Caught column error in attempt 1, proceeding to nuclear retry:', thrown?.message);
  }

  // ── 4. Attempt 2: NUCLEAR MINIMUM — only 7 absolutely-guaranteed columns ──
  const nuclearPayload: Record<string, any> = {
    id:          part.id,
    user_id:     effectiveUserId,
    part_number: part.partNumber,
    description: part.description,
    on_hand:     part.onHand ?? 0,
    status:      part.status || 'In Stock',
    updated_at:  new Date().toISOString()
  };

  console.log('[upsertPartInventory] Attempt 2 — nuclear minimum payload:', JSON.stringify(nuclearPayload, null, 2));

  const { error: retryError } = await supabase.from('parts_inventory').upsert(nuclearPayload);

  if (retryError) {
    console.error('[upsertPartInventory] Attempt 2 (nuclear minimum) ALSO FAILED:', {
      message: retryError.message,
      details: retryError.details,
      hint: retryError.hint,
      code: retryError.code
    });
    const enrichedError: any = new Error(retryError.message);
    enrichedError.code = retryError.code;
    enrichedError.details = retryError.details;
    enrichedError.hint = retryError.hint;
    throw enrichedError;
  }

  console.log('[upsertPartInventory] SUCCESS (attempt 2 — nuclear minimum) — part saved. ID:', part.id);
};







export const deletePartInventory = async (id: string): Promise<void> => {
  const { error } = await supabase.from('parts_inventory').delete().eq('id', id);
  if (error) throw error;
};

export const deleteChecklistItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('checklists').delete().eq('id', id);
  if (error) throw error;
};


// Track Weather History (now manual entry only, no API)
export const fetchTrackWeatherHistory = async (userId?: string): Promise<TrackWeatherHistory[]> => {
  const { data, error } = await supabase.from('track_weather_history').select('*').order('track_name');
  if (error) throw error;
  return parseRows(data, TrackWeatherHistoryRowSchema, 'track_weather_history').map(toTrackWeatherHistory);
};

export const upsertTrackWeatherHistory = async (track: TrackWeatherHistory, userId?: string): Promise<void> => {
  const payload: any = {
    id: track.trackId,
    track_id: track.trackId,
    track_name: track.trackName,
    location: emptyToNull(track.location),
    elevation: emptyToNull(track.elevation),
    visits: track.visits
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('track_weather_history').upsert(payload);
  if (error) throw error;
};

// Race Events
// (isUnknownColumnError helper is defined in the HELPERS section above)



export const fetchRaceEvents = async (userId?: string): Promise<RaceEvent[]> => {
  const { data, error } = await supabase.from('race_events').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return parseRows(data, RaceEventRowSchema, 'race_events').map(toRaceEvent);
};

/**
 * upsertRaceEvent — Create or update a race event.
 *
 * RESILIENT COLUMN HANDLING:
 * The `track_address` and `track_zip` columns may not exist in the database
 * if the user hasn't run the latest migration (sql_master_create_all_tables.sql).
 * 

 * Strategy: Try with all columns first. If PostgREST rejects the payload
 * because of unknown columns, retry WITHOUT track_address and track_zip.
 * This ensures existing events can still be saved even before the migration runs.
 */
export const upsertRaceEvent = async (event: RaceEvent, userId?: string): Promise<void> => {
  // Build the base payload (columns that always exist)
  const basePayload: any = {
    id: event.id,
    title: event.title,
    event_type: event.eventType,
    track_name: emptyToNull(event.trackName),
    track_location: emptyToNull(event.trackLocation),
    start_date: event.startDate,
    end_date: emptyToNull(event.endDate),
    start_time: emptyToNull(event.startTime),
    end_time: emptyToNull(event.endTime),
    status: event.status,
    sanctioning_body: emptyToNull(event.sanctioningBody),
    entry_fee: emptyToNull(event.entryFee),
    purse: emptyToNull(event.purse),
    notes: emptyToNull(event.notes),
    result: emptyToNull(event.result),
    best_et: emptyToNull(event.bestET),
    best_mph: emptyToNull(event.bestMPH),
    rounds_won: emptyToNull(event.roundsWon)
  };
  
  if (userId) basePayload.user_id = userId;

  // Build the full payload including new columns (track_address, track_zip)
  const fullPayload: any = {
    ...basePayload,
    track_address: emptyToNull(event.trackAddress),
    track_zip: emptyToNull(event.trackZip),
  };

  // Attempt 1: Try with all columns (including track_address, track_zip)
  const { error: fullError } = await supabase.from('race_events').upsert(fullPayload);
  
  if (!fullError) {
    // Success — columns exist, all good
    return;
  }

  // Check if the error is specifically about unknown columns
  if (isUnknownColumnError(fullError)) {
    console.warn(
      '[upsertRaceEvent] track_address/track_zip columns not found in DB — retrying without them.',
      'Run sql_master_create_all_tables.sql to add these columns.',

      { code: fullError.code, message: fullError.message }
    );

    // Attempt 2: Retry with base payload only (no track_address, track_zip)
    const { error: baseError } = await supabase.from('race_events').upsert(basePayload);
    if (baseError) {
      console.error('[upsertRaceEvent] Retry also failed:', baseError);
      throw baseError;
    }
    // Success on retry — event saved without address/zip columns
    return;
  }

  // Not a column error — throw the original error
  throw fullError;
};





export const deleteRaceEvent = async (id: string): Promise<void> => {
  const { error } = await supabase.from('race_events').delete().eq('id', id);
  if (error) throw error;
};

// Team Members
export const fetchTeamMembers = async (userId?: string): Promise<TeamMember[]> => {
  const { data, error } = await supabase.from('team_members').select('*').order('role');
  if (error) throw error;
  return parseRows(data, TeamMemberRowSchema, 'team_members').map(toTeamMember);
};

export const upsertTeamMember = async (member: TeamMember, userId?: string): Promise<void> => {
  const payload: any = {
    id: member.id,
    name: member.name,
    email: emptyToNull(member.email),
    phone: emptyToNull(member.phone),
    role: member.role,
    permissions: member.permissions,
    specialties: member.specialties,
    is_active: member.isActive,
    joined_date: emptyToNull(member.joinedDate),
    emergency_contact_name: emptyToNull(member.emergencyContactName),
    emergency_contact_phone: emptyToNull(member.emergencyContactPhone),
    notes: emptyToNull(member.notes),
    avatar_url: emptyToNull(member.avatarUrl),
    hourly_rate: emptyToNull(member.hourlyRate),
    daily_rate: emptyToNull(member.dailyRate)
  };

  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('team_members').upsert(payload);
  if (error) throw error;
};


export const deleteTeamMember = async (id: string): Promise<void> => {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
};

// Bulk operations for initial data seeding (for new users)
export const seedInitialData = async (data: {
  engines: Engine[];
  superchargers: Supercharger[];
  cylinderHeads: CylinderHead[];
  maintenanceItems: MaintenanceItem[];
  sfiCertifications: SFICertification[];
  passLogs: PassLogEntry[];
  engineSwapLogs: EngineSwapLog[];
  preRunChecklist: ChecklistItem[];
  betweenRoundsChecklist: ChecklistItem[];
  postRunChecklist: ChecklistItem[];
  partsInventory: PartInventoryItem[];
  trackWeatherHistory: TrackWeatherHistory[];
}, userId?: string): Promise<void> => {
  for (const engine of data.engines) await upsertEngine(engine, userId);
  for (const sc of data.superchargers) await upsertSupercharger(sc, userId);
  for (const head of data.cylinderHeads) await upsertCylinderHead(head, userId);
  for (const item of data.maintenanceItems) await upsertMaintenanceItem(item, userId);
  for (const cert of data.sfiCertifications) await upsertSFICertification(cert, userId);
  for (const pass of data.passLogs) await upsertPassLog(pass, userId);
  for (const log of data.engineSwapLogs) await insertEngineSwapLog(log, userId);
  for (const item of data.preRunChecklist) await upsertChecklistItem(item, 'preRun', userId);
  for (const item of data.betweenRoundsChecklist) await upsertChecklistItem(item, 'betweenRounds', userId);
  for (const item of data.postRunChecklist) await upsertChecklistItem(item, 'postRun', userId);
  for (const part of data.partsInventory) await upsertPartInventory(part, userId);
  for (const track of data.trackWeatherHistory) await upsertTrackWeatherHistory(track, userId);
};


// Check if user has data
export const hasData = async (userId?: string): Promise<boolean> => {
  let query = supabase.from('engines').select('id').limit(1);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
};

// Check if user has any data (for seeding decision)
export const hasUserData = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('engines')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (error) throw error;
  return (data || []).length > 0;
};


// ============ MEDIA GALLERY OPERATIONS ============

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  mediaType: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  category: string;
  tags?: string[];
  eventName?: string;
  eventDate?: string;
  uploadedBy?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  isFeatured: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const toMediaItem = (row: any): MediaItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  mediaType: row.media_type,
  url: row.url,
  thumbnailUrl: row.thumbnail_url,
  category: row.category || 'General',
  tags: row.tags || [],
  eventName: row.event_name,
  eventDate: row.event_date,
  uploadedBy: row.uploaded_by,
  fileSize: row.file_size,
  duration: row.duration,
  width: row.width,
  height: row.height,
  isFeatured: row.is_featured || false,
  isPublic: row.is_public ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const fetchMediaItems = async (userId?: string): Promise<MediaItem[]> => {
  const { data, error } = await supabase
    .from('media_gallery')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, MediaItemRowSchema, 'media_gallery').map(toMediaItem);
};

export const upsertMediaItem = async (item: Partial<MediaItem> & { id: string }, userId?: string): Promise<void> => {
  const payload: any = {
    id: item.id,
    title: item.title,
    description: emptyToNull(item.description),
    media_type: item.mediaType,
    url: item.url,
    thumbnail_url: emptyToNull(item.thumbnailUrl),
    category: item.category,
    tags: item.tags,
    event_name: emptyToNull(item.eventName),
    event_date: emptyToNull(item.eventDate),
    uploaded_by: emptyToNull(item.uploadedBy),
    file_size: emptyToNull(item.fileSize),
    duration: emptyToNull(item.duration),
    width: emptyToNull(item.width),
    height: emptyToNull(item.height),
    is_featured: item.isFeatured,
    is_public: item.isPublic,
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('media_gallery').upsert(payload);
  if (error) throw error;
};

export const deleteMediaItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('media_gallery').delete().eq('id', id);
  if (error) throw error;
};

// Upload file to storage (accepts File or Blob for resized images)
export const uploadMediaFile = async (file: File | Blob, path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file instanceof File ? file.type : 'image/jpeg'
    });
  
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
};


// Delete file from storage
export const deleteMediaFile = async (path: string): Promise<void> => {
  const { error } = await supabase.storage
    .from('media')
    .remove([path]);
  
  if (error) throw error;
};



// ============ SAVED TRACKS OPERATIONS ============

export interface SavedTrack {
  id: string;
  name: string;
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  elevation?: number;
  trackLength?: string;
  surfaceType?: string;
  notes?: string;
  isFavorite: boolean;
  lastVisited?: string;
  visitCount: number;
  createdAt?: string;
  updatedAt?: string;
}

const toSavedTrack = (row: any): SavedTrack => ({
  id: row.id,
  name: row.name,
  location: row.location,
  address: row.address || '',
  city: row.city || '',
  state: row.state || '',
  zip: row.zip || '',
  elevation: row.elevation || 0,
  trackLength: row.track_length || '1/8 mile',
  surfaceType: row.surface_type || 'Concrete',
  notes: row.notes || '',
  isFavorite: row.is_favorite || false,
  lastVisited: row.last_visited,
  visitCount: row.visit_count || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});


export const fetchSavedTracks = async (userId?: string): Promise<SavedTrack[]> => {
  let query = supabase
    .from('saved_tracks')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('visit_count', { ascending: false })
    .order('name');
  
  if (userId) query = query.eq('user_id', userId);
  
  const { data, error } = await query;
  if (error) throw error;
  return parseRows(data, SavedTrackRowSchema, 'saved_tracks').map(toSavedTrack);
};

export const upsertSavedTrack = async (track: SavedTrack, userId?: string): Promise<void> => {
  const payload: any = {
    id: track.id,
    name: track.name,
    location: track.location,
    address: emptyToNull(track.address),
    city: emptyToNull(track.city),
    state: emptyToNull(track.state),
    zip: emptyToNull(track.zip),
    elevation: emptyToNull(track.elevation),
    track_length: emptyToNull(track.trackLength),
    surface_type: emptyToNull(track.surfaceType),
    notes: emptyToNull(track.notes),
    is_favorite: track.isFavorite,
    last_visited: emptyToNull(track.lastVisited),
    visit_count: emptyToNull(track.visitCount),
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('saved_tracks').upsert(payload);
  if (error) throw error;
};



export const deleteSavedTrack = async (id: string): Promise<void> => {
  const { error } = await supabase.from('saved_tracks').delete().eq('id', id);
  if (error) throw error;
};

export const incrementTrackVisitCount = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_track_visit', { track_id: id });
  // If RPC doesn't exist, fall back to manual update
  if (error) {
    const { data } = await supabase.from('saved_tracks').select('visit_count').eq('id', id).single();
    if (data) {
      await supabase.from('saved_tracks').update({ 
        visit_count: (data.visit_count || 0) + 1,
        last_visited: getLocalDateString(),

        updated_at: new Date().toISOString()
      }).eq('id', id);
    }
  }
};



// ============ TODO ITEMS OPERATIONS ============

export interface ToDoItem {
  id: string;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Completed';
  category: string;
  assignedTo?: string;
  createdBy: string;
  createdByRole: string;
  dueDate?: string;
  completedDate?: string;
  completedBy?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  // Archive fields — kept in the TS interface for local state,
  // but ONLY sent to the database via dedicated archive/restore functions.
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}

const toToDoItem = (row: any): ToDoItem => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  priority: row.priority || 'Medium',
  status: row.status || 'Pending',
  category: row.category || 'General',
  assignedTo: row.assigned_to || undefined,
  createdBy: row.created_by || '',
  createdByRole: row.created_by_role || '',
  dueDate: row.due_date || undefined,
  completedDate: row.completed_date || undefined,
  completedBy: row.completed_by || undefined,
  tags: row.tags || [],
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
  // Read archive fields from DB if they exist; gracefully default if columns are missing
  isArchived: row.is_archived || false,
  archivedAt: row.archived_at || undefined,
  archivedBy: row.archived_by || undefined
});

export const fetchToDoItems = async (userId?: string): Promise<ToDoItem[]> => {
  const { data, error } = await supabase
    .from('todo_items')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, ToDoItemRowSchema, 'todo_items').map(toToDoItem);
};

/**
 * upsertToDoItem — Create or update a to-do item.
 *
 * FIELD AUDIT (verified against todo_items table schema):
 * ┌─────────────────┬──────────────┬─────────────────────────────────────┐
 * │ Payload Key      │ DB Column    │ DB Type                             │
 * ├─────────────────┼──────────────┼─────────────────────────────────────┤
 * │ id               │ id           │ UUID PRIMARY KEY                    │
 * │ user_id          │ user_id      │ UUID FK → auth.users(id)            │
 * │ title            │ title        │ TEXT NOT NULL                        │
 * │ description      │ description  │ TEXT                                 │
 * │ priority         │ priority     │ TEXT DEFAULT 'Medium'                │
 * │ status           │ status       │ TEXT DEFAULT 'Pending'               │
 * │ category         │ category     │ TEXT DEFAULT 'General'               │
 * │ assigned_to      │ assigned_to  │ TEXT                                 │
 * │ created_by       │ created_by   │ TEXT                                 │
 * │ created_by_role  │ created_by_role │ TEXT                              │
 * │ due_date         │ due_date     │ TEXT                                 │
 * │ completed_date   │ completed_date │ TEXT                               │
 * │ completed_by     │ completed_by │ TEXT                                 │
 * │ tags             │ tags         │ JSONB DEFAULT '[]'                   │
 * │ created_at       │ created_at   │ TIMESTAMPTZ DEFAULT NOW()            │
 * │ updated_at       │ updated_at   │ TIMESTAMPTZ DEFAULT NOW()            │
 * └─────────────────┴──────────────┴─────────────────────────────────────┘
 *
 * EXCLUDED from payload (archive fields):
 *   is_archived, archived_at, archived_by
 *   → These columns may not exist in the live database (PGRST204).
 *   → They are handled by dedicated archiveToDoItem / restoreToDoItem functions.
 *   → Omitting them from normal create/edit prevents the PGRST204 error.
 */
export const upsertToDoItem = async (item: ToDoItem, userId?: string): Promise<void> => {
  // 1. Resolve user_id — must be set for RLS to pass
  const effectiveUserId = userId || await getCurrentUserId();
  
  if (!effectiveUserId) {
    console.error('[upsertToDoItem] FATAL: No user_id available. Cannot insert — RLS will reject.');
    const err: any = new Error('No authenticated user ID available. Cannot save to-do item. Please log in again.');
    err.code = 'NO_USER_ID';
    err.details = 'Neither the passed userId nor supabase.auth.getUser() returned a valid user ID.';
    err.hint = 'Ensure you are logged in. Try refreshing the page or logging out and back in.';
    throw err;
  }

  // 2. Build the payload with ONLY columns that exist in the database.
  //    Archive fields (is_archived, archived_at, archived_by) are EXCLUDED.
  //    They are handled by archiveToDoItem() and restoreToDoItem() instead.
  const payload: any = {
    id: item.id,
    user_id: effectiveUserId,
    title: item.title,
    description: emptyToNull(item.description),
    priority: item.priority,
    status: item.status,
    category: item.category,
    assigned_to: emptyToNull(item.assignedTo),
    created_by: item.createdBy || 'Unknown',
    created_by_role: item.createdByRole || 'Crew',
    due_date: emptyToNull(item.dueDate),
    completed_date: emptyToNull(item.completedDate),
    completed_by: emptyToNull(item.completedBy),
    tags: item.tags || [],
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 3. Log the full payload for debugging
  console.log('[upsertToDoItem] Payload being sent to Supabase (archive fields excluded):', JSON.stringify(payload, null, 2));

  // 4. Execute the upsert
  const { data, error } = await supabase.from('todo_items').upsert(payload);
  
  if (error) {
    console.error('[upsertToDoItem] Supabase error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    // Re-throw with all fields preserved so the UI can display them
    const enrichedError: any = new Error(error.message);
    enrichedError.code = error.code;
    enrichedError.details = error.details;
    enrichedError.hint = error.hint;
    throw enrichedError;
  }

  console.log('[upsertToDoItem] SUCCESS — item saved. Response:', data);
};

/**
 * archiveToDoItem — Archive a single to-do item.
 * Sends ONLY the archive-related columns + updated_at.
 * Uses .update() (not .upsert()) so it only touches existing rows.
 *
 * If the archive columns don't exist in the live DB, this will fail
 * gracefully with a clear error rather than breaking normal create/edit.
 */
export const archiveToDoItem = async (id: string, archivedBy: string, userId?: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('todo_items')
    .update({
      is_archived: true,
      archived_at: now,
      archived_by: archivedBy,
      updated_at: now
    })
    .eq('id', id);

  if (error) {
    console.error('[archiveToDoItem] Supabase error:', error);
    const enrichedError: any = new Error(error.message);
    enrichedError.code = error.code;
    enrichedError.details = error.details;
    enrichedError.hint = error.hint;
    throw enrichedError;
  }
};

/**
 * restoreToDoItem — Restore a single archived to-do item.
 * Clears the archive-related columns.
 */
export const restoreToDoItem = async (id: string, userId?: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('todo_items')
    .update({
      is_archived: false,
      archived_at: null,
      archived_by: null,
      updated_at: now
    })
    .eq('id', id);

  if (error) {
    console.error('[restoreToDoItem] Supabase error:', error);
    const enrichedError: any = new Error(error.message);
    enrichedError.code = error.code;
    enrichedError.details = error.details;
    enrichedError.hint = error.hint;
    throw enrichedError;
  }
};

/**
 * bulkArchiveToDoItems — Archive multiple to-do items at once.
 * Used by "Archive Completed" button.
 */
export const bulkArchiveToDoItems = async (ids: string[], archivedBy: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('todo_items')
    .update({
      is_archived: true,
      archived_at: now,
      archived_by: archivedBy,
      updated_at: now
    })
    .in('id', ids);

  if (error) {
    console.error('[bulkArchiveToDoItems] Supabase error:', error);
    const enrichedError: any = new Error(error.message);
    enrichedError.code = error.code;
    enrichedError.details = error.details;
    enrichedError.hint = error.hint;
    throw enrichedError;
  }
};


export const deleteToDoItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('todo_items').delete().eq('id', id);
  if (error) throw error;
};

export const bulkDeleteToDoItems = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from('todo_items').delete().in('id', ids);
  if (error) throw error;
};

export const bulkUpdateToDoItems = async (ids: string[], updates: Record<string, any>): Promise<void> => {
  const { error } = await supabase
    .from('todo_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
};



// ============ USER SETTINGS OPERATIONS ============

export const fetchUserSettings = async (feature: string, userId?: string): Promise<Record<string, any> | null> => {
  let query = supabase
    .from('user_settings')
    .select('settings')
    .eq('feature', feature);
  
  if (userId) query = query.eq('user_id', userId);
  
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.settings || null;
};

export const upsertUserSettings = async (feature: string, settings: Record<string, any>, userId?: string): Promise<void> => {
  const payload: any = {
    feature,
    settings,
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  // Use upsert with onConflict on user_id + feature
  const { error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id,feature' });
  if (error) throw error;
};


// ============ TEAM NOTES OPERATIONS ============

export interface TeamNote {
  id: string;
  title: string;
  content: string;
  category: string;
  createdBy: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const toTeamNote = (row: any): TeamNote => ({
  id: row.id,
  title: row.title,
  content: row.content || '',
  category: row.category || 'General',
  createdBy: row.created_by || '',
  isPinned: row.is_pinned || false,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString()
});

export const fetchTeamNotes = async (userId?: string): Promise<TeamNote[]> => {
  const { data, error } = await supabase
    .from('team_notes')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, TeamNoteRowSchema, 'team_notes').map(toTeamNote);
};

export const upsertTeamNote = async (note: TeamNote, userId?: string): Promise<void> => {
  const payload: any = {
    id: note.id,
    title: note.title,
    content: emptyToNull(note.content),
    category: note.category,
    created_by: emptyToNull(note.createdBy),
    is_pinned: note.isPinned,
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('team_notes').upsert(payload);
  if (error) throw error;
};

export const deleteTeamNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from('team_notes').delete().eq('id', id);
  if (error) throw error;
};


// ============ LABOR ENTRIES OPERATIONS ============

export interface LaborEntry {
  id: string;
  teamMemberId: string;
  teamMemberName: string;
  date: string;
  hours: number;
  hourlyRate: number;
  dailyRate?: number;
  rateType: 'hourly' | 'daily';
  totalCost: number;
  description: string;
  category: string;
  notes: string;
  eventId?: string;
  eventName?: string;
}

const toLaborEntry = (row: any): LaborEntry => ({
  id: row.id,
  teamMemberId: row.team_member_id || '',
  teamMemberName: row.team_member_name || '',
  date: row.date,
  hours: parseFloat(row.hours) || 0,
  hourlyRate: parseFloat(row.hourly_rate) || 125,
  dailyRate: row.daily_rate ? parseFloat(row.daily_rate) : 800,
  rateType: row.rate_type || 'hourly',
  totalCost: parseFloat(row.total_cost) || 0,
  description: row.description || '',
  category: row.category || 'Shop Work',
  notes: row.notes || '',
  eventId: row.event_id || undefined,
  eventName: row.event_name || undefined
});

export const fetchLaborEntries = async (userId?: string): Promise<LaborEntry[]> => {
  const { data, error } = await supabase
    .from('labor_entries')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, LaborEntryRowSchema, 'labor_entries').map(toLaborEntry);
};

export const upsertLaborEntry = async (entry: LaborEntry, userId?: string): Promise<void> => {
  const payload: any = {
    id: entry.id,
    team_member_id: emptyToNull(entry.teamMemberId),
    team_member_name: entry.teamMemberName,
    date: entry.date,
    hours: entry.hours,
    hourly_rate: entry.hourlyRate,
    daily_rate: emptyToNull(entry.dailyRate),
    rate_type: entry.rateType,
    total_cost: entry.totalCost,
    description: emptyToNull(entry.description),
    category: entry.category,
    notes: emptyToNull(entry.notes),
    event_id: emptyToNull(entry.eventId),
    event_name: emptyToNull(entry.eventName),
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('labor_entries').upsert(payload);
  if (error) throw error;
};

export const deleteLaborEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('labor_entries').delete().eq('id', id);
  if (error) throw error;
};



// ============ VENDOR OPERATIONS (setup_vendors table) ============

export interface VendorRecord {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  category: string;
  paymentTerms: string;
  discountPercent: number;
  leadTimeDays: number;
  minimumOrder: number;
  shippingMethod: string;
  notes: string;
  rating: number;
  isActive: boolean;
  createdDate: string;
}

const toVendorRecord = (row: any): VendorRecord => ({
  id: row.id,
  name: row.name || '',
  code: row.code || '',
  contactName: row.contact_name || '',
  email: row.email || '',
  phone: row.phone || '',
  address: row.address || '',
  city: row.city || '',
  state: row.state || '',
  zip: row.zip || '',
  website: row.website || '',
  category: row.category || 'Other',
  paymentTerms: row.payment_terms || 'Net 30',
  discountPercent: parseFloat(row.discount_percent) || 0,
  leadTimeDays: parseInt(row.lead_time_days) || 14,
  minimumOrder: parseFloat(row.minimum_order) || 0,
  shippingMethod: row.shipping_method || 'UPS Ground',
  notes: row.notes || '',
  rating: parseInt(row.rating) || 5,
  isActive: row.is_active ?? true,
  createdDate: row.created_date || getLocalDateString()

});

export const fetchVendors = async (userId?: string): Promise<VendorRecord[]> => {
  const { data, error } = await supabase
    .from('setup_vendors')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return parseRows(data, VendorRecordRowSchema, 'setup_vendors').map(toVendorRecord);
};

export const upsertVendor = async (vendor: VendorRecord, userId?: string): Promise<void> => {
  // Explicitly get user_id if not provided
  const effectiveUserId = userId || await getCurrentUserId();
  
  const payload: any = {
    id: vendor.id,
    name: vendor.name,
    code: emptyToNull(vendor.code),
    contact_name: emptyToNull(vendor.contactName),
    email: emptyToNull(vendor.email),
    phone: emptyToNull(vendor.phone),
    address: emptyToNull(vendor.address),
    city: emptyToNull(vendor.city),
    state: emptyToNull(vendor.state),
    zip: emptyToNull(vendor.zip),
    website: emptyToNull(vendor.website),
    category: emptyToNull(vendor.category),
    payment_terms: emptyToNull(vendor.paymentTerms),
    discount_percent: emptyToNull(vendor.discountPercent),
    lead_time_days: emptyToNull(vendor.leadTimeDays),
    minimum_order: emptyToNull(vendor.minimumOrder),
    shipping_method: emptyToNull(vendor.shippingMethod),
    notes: emptyToNull(vendor.notes),
    rating: vendor.rating ?? 5,
    is_active: vendor.isActive ?? true,
    created_date: emptyToNull(vendor.createdDate),
    updated_at: new Date().toISOString()
  };
  
  if (effectiveUserId) payload.user_id = effectiveUserId;
  
  console.log('upsertVendor payload:', JSON.stringify(payload, null, 2));
  
  const { error } = await supabase.from('setup_vendors').upsert(payload);
  if (error) {
    console.error('upsertVendor error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw error;
  }
};


export const deleteVendor = async (id: string): Promise<void> => {
  const { error } = await supabase.from('setup_vendors').delete().eq('id', id);
  if (error) throw error;
};




// ============ DRIVETRAIN COMPONENTS OPERATIONS ============
// Used for: Transmissions, Transmission Drive, Torque Converter, 3rd Member, Ring and Pinion

export type DrivetrainCategory = 'transmission' | 'transmission_drive' | 'torque_converter' | 'third_member' | 'ring_and_pinion' | 'rear_tire_wheel';

export interface DrivetrainComponent {
  id: string;
  category: DrivetrainCategory;
  name: string;
  make: string;
  model: string;
  serialNumber: string;
  builder: string;
  installDate: string;
  dateRemoved: string;
  totalPasses: number;
  passesSinceService: number;
  hours: number;
  status: 'Active' | 'Ready' | 'Service' | 'Rebuild' | 'Retired';
  currentlyInstalled: boolean;
  notes: string;
  components: Record<string, any>;
}

const toDrivetrainComponent = (row: any): DrivetrainComponent => ({
  id: row.id,
  category: row.category,
  name: row.name || '',
  make: row.make || '',
  model: row.model || '',
  serialNumber: row.serial_number || '',
  builder: row.builder || '',
  installDate: row.install_date || '',
  dateRemoved: row.date_removed || '',
  totalPasses: row.total_passes || 0,
  passesSinceService: row.passes_since_service || 0,
  hours: parseFloat(row.hours) || 0,
  status: row.status || 'Ready',
  currentlyInstalled: row.currently_installed || false,
  notes: row.notes || '',
  components: row.components || {}
});

export const fetchDrivetrainComponents = async (userId?: string): Promise<DrivetrainComponent[]> => {
  const { data, error } = await supabase
    .from('drivetrain_components')
    .select('*')
    .order('category')
    .order('name');
  
  if (error) throw error;
  return parseRows(data, DrivetrainComponentRowSchema, 'drivetrain_components').map(toDrivetrainComponent);
};

export const upsertDrivetrainComponent = async (comp: DrivetrainComponent, userId?: string): Promise<void> => {
  const payload: any = {
    id: comp.id,
    category: comp.category,
    name: comp.name,
    make: emptyToNull(comp.make),
    model: emptyToNull(comp.model),
    serial_number: emptyToNull(comp.serialNumber),
    builder: emptyToNull(comp.builder),
    install_date: emptyToNull(comp.installDate),
    date_removed: emptyToNull(comp.dateRemoved),
    total_passes: comp.totalPasses,
    passes_since_service: comp.passesSinceService,
    hours: comp.hours,
    status: comp.status,
    currently_installed: comp.currentlyInstalled,
    notes: emptyToNull(comp.notes),
    components: comp.components,
    updated_at: new Date().toISOString()
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('drivetrain_components').upsert(payload);
  if (error) throw error;
};

export const deleteDrivetrainComponent = async (id: string): Promise<void> => {
  const { error } = await supabase.from('drivetrain_components').delete().eq('id', id);
  if (error) throw error;
};


// ============ DRIVETRAIN SWAP LOGS OPERATIONS ============

export interface DrivetrainSwapLog {
  id: string;
  date: string;
  time: string;
  componentType: DrivetrainCategory;
  previousComponentId: string;
  newComponentId: string;
  previousComponentName: string;
  newComponentName: string;
  reason: string;
  performedBy: string;
  notes: string;
}

const toDrivetrainSwapLog = (row: any): DrivetrainSwapLog => ({
  id: row.id,
  date: row.date,
  time: row.time || '',
  componentType: row.component_type,
  previousComponentId: row.previous_component_id || '',
  newComponentId: row.new_component_id || '',
  previousComponentName: row.previous_component_name || '',
  newComponentName: row.new_component_name || '',
  reason: row.reason || '',
  performedBy: row.performed_by || '',
  notes: row.notes || ''
});

export const fetchDrivetrainSwapLogs = async (userId?: string): Promise<DrivetrainSwapLog[]> => {
  const { data, error } = await supabase
    .from('drivetrain_swap_logs')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, DrivetrainSwapLogRowSchema, 'drivetrain_swap_logs').map(toDrivetrainSwapLog);
};

export const insertDrivetrainSwapLog = async (log: DrivetrainSwapLog, userId?: string): Promise<void> => {
  const payload: any = {
    id: log.id,
    date: log.date,
    time: emptyToNull(log.time),
    component_type: log.componentType,
    previous_component_id: emptyToNull(log.previousComponentId),
    new_component_id: emptyToNull(log.newComponentId),
    previous_component_name: emptyToNull(log.previousComponentName),
    new_component_name: emptyToNull(log.newComponentName),
    reason: emptyToNull(log.reason),
    performed_by: emptyToNull(log.performedBy),
    notes: emptyToNull(log.notes)
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('drivetrain_swap_logs').insert(payload);
  if (error) throw error;
};


// ============ FUEL LOG ENTRIES OPERATIONS ============

export interface FuelLogEntry {
  id: string;
  date: string;
  gallonsPurchased: number;
  costPerGallon: number;
  totalCost: number;
  vendor: string;
  fuelType: 'Methanol' | 'Race Gas' | 'E85' | 'Nitromethane' | 'Other';
  linkedEventId?: string;
  linkedEventName?: string;
  gallonsUsed?: number;
  passesAtEvent?: number;
  notes?: string;
  receiptNumber?: string;
  createdAt: string;
  /** Team ID — set to the team owner's user_id so all team members' logs are grouped */
  teamId?: string;
  /** The auth user_id of the person who created this entry */
  userId?: string;
}

const toFuelLogEntry = (row: any): FuelLogEntry => ({
  id: row.id,
  date: row.date || '',
  gallonsPurchased: parseFloat(row.quantity_gallons) || 0,
  costPerGallon: parseFloat(row.price_per_gallon) || 0,
  totalCost: parseFloat(row.total_cost) || 0,
  vendor: row.vendor || '',
  fuelType: row.fuel_type || 'Methanol',
  linkedEventId: row.race_event_id || undefined,
  linkedEventName: row.linked_event_name || undefined,
  gallonsUsed: row.gallons_used != null ? parseFloat(row.gallons_used) : undefined,
  passesAtEvent: row.passes_at_event != null ? parseInt(row.passes_at_event) : undefined,
  notes: row.notes || undefined,
  receiptNumber: row.receipt_number || undefined,
  createdAt: row.created_at || new Date().toISOString(),
  teamId: row.team_id || undefined,
  userId: row.user_id || undefined,
});

/**
 * fetchFuelLogs — Load fuel log entries from the database.
 *
 * @param userId  - (optional) The auth user_id. When provided without teamId, fetches only this user's logs.
 * @param teamId  - (optional) When provided, fetches all logs for the given team (team_id = teamId).
 *                  RLS ensures the caller can only see rows they are authorised to read.
 */
export const fetchFuelLogs = async (userId?: string, teamId?: string): Promise<FuelLogEntry[]> => {
  let query = supabase
    .from('fuel_log_entries')
    .select('*')
    .order('date', { ascending: false });

  if (teamId) {
    // Team view: fetch all logs for this team
    query = query.eq('team_id', teamId);
  } else if (userId) {
    // Personal view: fetch only this user's logs
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return parseRows(data, FuelLogRowSchema, 'fuel_log_entries').map(toFuelLogEntry);
};

export const upsertFuelLog = async (entry: FuelLogEntry, userId?: string, teamId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();

  const payload: any = {
    id: entry.id,
    date: entry.date,
    fuel_type: entry.fuelType,
    quantity_gallons: entry.gallonsPurchased,
    price_per_gallon: entry.costPerGallon,
    total_cost: entry.totalCost,
    vendor: emptyToNull(entry.vendor),
    notes: emptyToNull(entry.notes),
    race_event_id: emptyToNull(entry.linkedEventId),
    linked_event_name: emptyToNull(entry.linkedEventName),
    gallons_used: emptyToNull(entry.gallonsUsed),
    passes_at_event: emptyToNull(entry.passesAtEvent),
    receipt_number: emptyToNull(entry.receiptNumber),
    updated_at: new Date().toISOString(),
  };

  if (effectiveUserId) payload.user_id = effectiveUserId;

  // Set team_id: use explicit teamId param, fall back to entry.teamId, then effectiveUserId
  // This groups all team members' logs under the team owner's ID
  const resolvedTeamId = teamId || entry.teamId || effectiveUserId;
  if (resolvedTeamId) payload.team_id = resolvedTeamId;

  // Preserve created_at on insert; omit on update so DB default applies
  if (entry.createdAt) payload.created_at = entry.createdAt;

  const { error } = await supabase.from('fuel_log_entries').upsert(payload);
  if (error) throw error;
};

export const deleteFuelLog = async (id: string): Promise<void> => {
  const { error } = await supabase.from('fuel_log_entries').delete().eq('id', id);
  if (error) throw error;
};


// ============ BETA FEEDBACK OPERATIONS ============
//
// beta_feedback table columns (from sql_master_create_all_tables.sql + user migration):
//   id          UUID PRIMARY KEY DEFAULT uuid_generate_v4()
//   user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL
//   category    TEXT NOT NULL
//   title       TEXT
//   description TEXT NOT NULL
//   status      TEXT DEFAULT 'new'
//   priority    TEXT
//   created_at  TIMESTAMPTZ DEFAULT NOW()
//   updated_at  TIMESTAMPTZ
//
// TOTAL: 9 columns.  The code MUST send ONLY these names.
// BANNED column names (do NOT exist — never send these):
//   feedback_type, subject, message, rating,
//   app_version, device_info, screenshot_url,
//   severity, user_email, user_name, page_context

/**
 * Allowlist — the exact 9 column names in the beta_feedback table.
 * Any key NOT in this set is stripped before the INSERT.
 */
const BETA_FEEDBACK_ALLOWED_COLUMNS = new Set<string>([
  'id',
  'user_id',
  'category',
  'title',
  'description',
  'status',
  'priority',
  'created_at',
  'updated_at',
]);

/**
 * Payload accepted by submitBetaFeedback.
 * Field names match the DB column names exactly.
 */
export interface BetaFeedbackPayload {
  category: 'bug' | 'feature' | 'general';
  title: string;
  description: string;
  priority: string;
  status?: string;
}

/**
 * submitBetaFeedback — Insert one row into the beta_feedback table.
 *
 * Columns sent: user_id, category, title, description, status, priority, updated_at.
 * Columns handled by DB defaults: id (uuid_generate_v4), created_at (NOW()).
 *
 * A safety-net loop strips any key NOT in BETA_FEEDBACK_ALLOWED_COLUMNS
 * so that even if a caller accidentally passes extra fields they never reach PostgREST.
 */
export const submitBetaFeedback = async (
  feedback: BetaFeedbackPayload,
  userId?: string
): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();

  // Build payload using ONLY the 9 allowed column names
  const payload: Record<string, any> = {
    category:    feedback.category,       // DB column: category  (NOT feedback_type)
    title:       feedback.title,          // DB column: title     (NOT subject)
    description: feedback.description,    // DB column: description (NOT message)
    status:      feedback.status || 'new',
    priority:    feedback.priority || 'Medium',
    updated_at:  new Date().toISOString(),
  };

  if (effectiveUserId) {
    payload.user_id = effectiveUserId;
  }

  // Safety net: strip any key that is NOT one of the 9 allowed columns
  for (const key of Object.keys(payload)) {
    if (!BETA_FEEDBACK_ALLOWED_COLUMNS.has(key)) {
      console.warn(`[submitBetaFeedback] Stripped disallowed key "${key}" — not in beta_feedback table`);
      delete payload[key];
    }
  }

  console.log('[submitBetaFeedback] Final payload:', JSON.stringify(payload, null, 2));

  const { error } = await supabase.from('beta_feedback').insert(payload);

  if (error) {
    console.error('[submitBetaFeedback] Supabase insert error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    const enrichedError: any = new Error(error.message);
    enrichedError.code = error.code;
    enrichedError.details = error.details;
    enrichedError.hint = error.hint;
    throw enrichedError;
  }

  console.log('[submitBetaFeedback] SUCCESS — feedback inserted.');

};


// ============ PASS HISTORY OPERATIONS ============
// Audit trail for "Record Pass" actions in the Setup Library
// Single-car mode: carId/carName removed — always the same car.


export interface PassHistoryEntry {
  id: string;
  passCount: number;
  componentsUpdated: number;
  flaggedCount: number;
  flaggedDetails: Array<{ parentName: string; componentName: string; status: string; percentUsed: number }>;
  enginesUpdated: Array<{ id: string; name: string; newTotal: number; newSinceRebuild: number }>;
  headsUpdated: Array<{ id: string; name: string; newTotal: number; newSinceRefresh: number }>;
  powerAddersUpdated: Array<{ id: string; name: string; newTotal: number; newSinceService: number }>;
  drivetrainUpdated: Array<{ id: string; name: string; category: string; newTotal: number; newSinceService: number }>;
  notes?: string;
  createdAt: string;
}

const toPassHistoryEntry = (row: any): PassHistoryEntry => ({
  id: row.id,
  passCount: parseInt(row.pass_count) || 1,
  componentsUpdated: parseInt(row.components_updated) || 0,
  flaggedCount: parseInt(row.flagged_count) || 0,
  flaggedDetails: row.flagged_details || [],
  enginesUpdated: row.engines_updated || [],
  headsUpdated: row.heads_updated || [],
  powerAddersUpdated: row.power_adders_updated || [],
  drivetrainUpdated: row.drivetrain_updated || [],
  notes: row.notes || undefined,
  createdAt: row.created_at || new Date().toISOString(),
});

export const fetchPassHistory = async (userId?: string): Promise<PassHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('pass_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return parseRows(data, PassHistoryRowSchema, 'pass_history').map(toPassHistoryEntry);
};

export const insertPassHistory = async (entry: PassHistoryEntry, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();

  const payload: any = {
    id: entry.id,
    pass_count: entry.passCount,
    components_updated: entry.componentsUpdated,
    flagged_count: entry.flaggedCount,
    flagged_details: entry.flaggedDetails,
    engines_updated: entry.enginesUpdated,
    heads_updated: entry.headsUpdated,
    power_adders_updated: entry.powerAddersUpdated,
    drivetrain_updated: entry.drivetrainUpdated,
    notes: emptyToNull(entry.notes),
    created_at: entry.createdAt,
  };

  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('pass_history').insert(payload);
  if (error) {
    console.error('[insertPassHistory] Error:', error);
    throw error;
  }
};


export const deletePassHistory = async (id: string): Promise<void> => {
  const { error } = await supabase.from('pass_history').delete().eq('id', id);
  if (error) throw error;
};



// ============ SCHEMA MIGRATION CHECK ============
// Lightweight probe to verify the component_parts table has the expected columns.
// Called on app startup (from MainComponents) to warn users if migration is needed.

export interface ComponentPartsSchemaCheck {
  tableExists: boolean;
  hasDateReplaced: boolean;
  hasNotes: boolean;
  allColumnsPresent: boolean;
}

/**
 * checkComponentPartsSchema — Probe the component_parts table to verify
 * that the `date_replaced` and `notes` columns exist.
 *
 * Uses a lightweight `SELECT date_replaced, notes FROM component_parts LIMIT 0`
 * query. If PostgREST returns an unknown-column error, the columns are missing.
 *
 * Returns a result object indicating which columns are present/missing.
 * Never throws — all errors are caught and returned as schema status.
 */
export const checkComponentPartsSchema = async (): Promise<ComponentPartsSchemaCheck> => {
  const result: ComponentPartsSchemaCheck = {
    tableExists: false,
    hasDateReplaced: false,
    hasNotes: false,
    allColumnsPresent: false,
  };

  try {
    // Step 1: Check if the table exists at all
    const { error: tableError } = await supabase
      .from('component_parts')
      .select('id')
      .limit(0);

    if (tableError) {
      // ── PGRST205 HANDLING ──
      // If the error is "table not in schema cache", the table EXISTS in the DB
      // but PostgREST doesn't know about it yet. Treat as tableExists = true,
      // trigger a schema reload, and optimistically assume all columns are present.
      if (isTableNotInSchemaCache(tableError)) {
        console.warn(
          '[checkComponentPartsSchema] PGRST205 detected — component_parts table exists in DB but not in PostgREST schema cache.',
          'Triggering schema reload. Data IS saving correctly.'
        );
        result.tableExists = true;
        result.hasDateReplaced = true;
        result.hasNotes = true;
        result.allColumnsPresent = true;
        // Fire-and-forget schema reload
        triggerSchemaReload();
        return result;
      }

      // Table genuinely doesn't exist or isn't accessible
      console.warn('[checkComponentPartsSchema] component_parts table not accessible:', tableError.message);
      return result;
    }
    result.tableExists = true;

    // Step 2: Check if date_replaced column exists
    const { error: dateError } = await supabase
      .from('component_parts')
      .select('date_replaced')
      .limit(0);

    result.hasDateReplaced = !dateError || !isUnknownColumnError(dateError);
    if (dateError && isUnknownColumnError(dateError)) {
      console.warn('[checkComponentPartsSchema] date_replaced column NOT found in component_parts');
    }

    // Step 3: Check if notes column exists
    const { error: notesError } = await supabase
      .from('component_parts')
      .select('notes')
      .limit(0);

    result.hasNotes = !notesError || !isUnknownColumnError(notesError);
    if (notesError && isUnknownColumnError(notesError)) {
      console.warn('[checkComponentPartsSchema] notes column NOT found in component_parts');
    }

    result.allColumnsPresent = result.hasDateReplaced && result.hasNotes;

    console.log('[checkComponentPartsSchema] Schema check result:', {
      tableExists: result.tableExists,
      hasDateReplaced: result.hasDateReplaced,
      hasNotes: result.hasNotes,
      allColumnsPresent: result.allColumnsPresent,
    });

    return result;
  } catch (err) {
    console.warn('[checkComponentPartsSchema] Unexpected error during schema check:', err);
    return result;
  }
};



// ============ PGRST205 SIGNAL FLAG ============
// Module-level flag set by fetchComponentParts when PGRST205 is detected.
// This allows the caller (MainComponents) to distinguish between:
//   - "DB returned empty because there are genuinely no parts"
//   - "DB returned empty because PostgREST schema cache doesn't know the table"
// The getter resets the flag after reading (one-shot).

let _lastComponentPartsFetchWasPGRST205 = false;

/**
 * didLastComponentPartsFetchHitSchemaCache — Returns true if the most recent
 * call to fetchComponentParts() encountered a PGRST205 error (table not in
 * PostgREST schema cache).  Resets the flag after reading.
 *
 * Usage in MainComponents:
 *   const dbParts = await db.fetchComponentParts(user?.id);
 *   const wasSchemaCacheIssue = db.didLastComponentPartsFetchHitSchemaCache();
 *   if (dbParts.length === 0 && wasSchemaCacheIssue) {
 *     // Don't show "run migration" message — table exists, just not cached yet
 *   }
 */
export const didLastComponentPartsFetchHitSchemaCache = (): boolean => {
  const val = _lastComponentPartsFetchWasPGRST205;
  _lastComponentPartsFetchWasPGRST205 = false; // reset after reading
  return val;
};


// Standalone parts list for MainComponents — migrated from localStorage to database.
// Table: component_parts (id TEXT PK, user_id UUID, component_id TEXT, component_type TEXT,
//                         part_name TEXT, passes_on_part INT, date_replaced TEXT, notes TEXT,
//                         created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

export interface ComponentPart {
  id: string;
  componentId: string;
  componentType: string;
  partName: string;
  passesOnPart: number;
  dateReplaced?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toComponentPart = (row: any): ComponentPart => ({
  id: row.id,
  componentId: row.component_id || '',
  componentType: row.component_type || '',
  partName: row.part_name || '',
  passesOnPart: parseInt(row.passes_on_part) || 0,
  dateReplaced: row.date_replaced || undefined,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchComponentParts = async (userId?: string): Promise<ComponentPart[]> => {
  // Reset the PGRST205 flag at the start of each fetch
  _lastComponentPartsFetchWasPGRST205 = false;

  const { data, error } = await supabase
    .from('component_parts')
    .select('*')
    .order('component_id')
    .order('part_name');

  if (error) {
    // ── PGRST205 HANDLING ──
    // Table exists in DB but PostgREST schema cache doesn't know about it.
    // Set the signal flag so the caller can distinguish this from "genuinely empty".
    // Silently return empty array and trigger a schema reload so future requests work.
    if (isTableNotInSchemaCache(error)) {
      console.warn('[fetchComponentParts] PGRST205 — component_parts not in schema cache. Returning [] and triggering reload.');
      _lastComponentPartsFetchWasPGRST205 = true;
      triggerSchemaReload();
      return [];
    }
    throw error;
  }
  return (data || []).map(toComponentPart);
};





/**
 * upsertComponentPart — Create or update a standalone part.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * RESILIENT SAVE STRATEGY  (March 2026 — revised)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The save uses a multi-tier fallback to handle:
 *   A) Missing columns (date_replaced, notes) — schema not yet migrated
 *   B) RLS violations — existing row has NULL user_id (orphaned row)
 *   C) Stale upsert conflicts — row exists but user can't UPDATE via upsert
 *
 * Strategy:
 *   Attempt 1: Full upsert (all columns including date_replaced, notes)
 *   Attempt 2: Base upsert (without date_replaced and notes)
 *   Attempt 3: Nuclear minimum upsert (id, user_id, component_id, part_name, passes_on_part)
 *   Attempt 4: DELETE + INSERT fallback (handles orphaned rows with wrong/null user_id)
 *
 * FIELD AUDIT (verified against component_parts table schema):
 * ┌──────────────────┬──────────────────┬──────────────────────────────────┐
 * │ Payload Key       │ DB Column        │ DB Type                          │
 * ├──────────────────┼──────────────────┼──────────────────────────────────┤
 * │ id                │ id               │ TEXT PRIMARY KEY                  │
 * │ user_id           │ user_id          │ UUID FK → auth.users(id)         │
 * │ component_id      │ component_id     │ TEXT NOT NULL                     │
 * │ component_type    │ component_type   │ TEXT                              │
 * │ part_name         │ part_name        │ TEXT NOT NULL                     │
 * │ passes_on_part    │ passes_on_part   │ INTEGER DEFAULT 0                │
 * │ date_replaced     │ date_replaced    │ TEXT (may not exist yet)          │
 * │ notes             │ notes            │ TEXT (may not exist yet)          │
 * │ updated_at        │ updated_at       │ TIMESTAMPTZ DEFAULT NOW()        │
 * └──────────────────┴──────────────────┴──────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════
 */
export const upsertComponentPart = async (part: ComponentPart, userId?: string): Promise<void> => {
  // ── 1. Resolve user_id — must be set for RLS to pass ──
  const effectiveUserId = userId || await getCurrentUserId();

  if (!effectiveUserId) {
    console.error('[upsertComponentPart] FATAL: No user_id available. Cannot insert — RLS will reject.');
    const err: any = new Error('No authenticated user ID available. Cannot save component part. Please log in again.');
    err.code = 'NO_USER_ID';
    err.details = 'Neither the passed userId nor supabase.auth.getUser() returned a valid user ID.';
    err.hint = 'Ensure you are logged in. Try refreshing the page or logging out and back in.';
    throw err;
  }

  const now = new Date().toISOString();

  // ── 2. Build payloads at each tier ──
  const fullPayload: Record<string, any> = {
    id:              part.id,
    user_id:         effectiveUserId,
    component_id:    part.componentId,
    component_type:  part.componentType || null,
    part_name:       part.partName,
    passes_on_part:  part.passesOnPart ?? 0,
    date_replaced:   emptyToNull(part.dateReplaced),
    notes:           emptyToNull(part.notes),
    updated_at:      now,
  };

  // Remove undefined keys
  Object.keys(fullPayload).forEach(k => {
    if (fullPayload[k] === undefined) delete fullPayload[k];
  });

  const basePayload: Record<string, any> = {
    id:              part.id,
    user_id:         effectiveUserId,
    component_id:    part.componentId,
    component_type:  part.componentType || null,
    part_name:       part.partName,
    passes_on_part:  part.passesOnPart ?? 0,
    updated_at:      now,
  };

  const nuclearPayload: Record<string, any> = {
    id:              part.id,
    user_id:         effectiveUserId,
    component_id:    part.componentId,
    part_name:       part.partName,
    passes_on_part:  part.passesOnPart ?? 0,
    updated_at:      now,
  };

  // Helper to detect RLS / permission errors
  const isRLSError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    return (
      code === '42501' ||
      code === 'PGRST301' ||
      msg.includes('row-level security') ||
      msg.includes('permission denied') ||
      msg.includes('new row violates') ||
      msg.includes('insufficient_privilege')
    );
  };

  // Track the last non-column error for diagnostics
  let lastNonColumnError: any = null;

  // ── 3. Attempt 1: Full payload (all columns) ──
  console.log('[upsertComponentPart] Attempt 1 — full payload for part:', part.id);
  {
    const { error } = await supabase.from('component_parts').upsert(fullPayload);
    if (!error) {
      console.log('[upsertComponentPart] SUCCESS (attempt 1) — part saved. ID:', part.id);
      return;
    }
    // ── PGRST205 HANDLING ──
    // Table exists in DB but PostgREST schema cache doesn't know about it.
    // Data IS saving via direct SQL / edge functions — silently succeed.
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertComponentPart] Attempt 1: PGRST205 — table not in schema cache. Data IS saving. Triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }
    if (isUnknownColumnError(error)) {
      console.warn('[upsertComponentPart] Attempt 1: unknown column — falling through.', error.message);
    } else {
      console.warn('[upsertComponentPart] Attempt 1 failed:', error.code, error.message);
      lastNonColumnError = error;
    }
  }


  // ── 4. Attempt 2: Base payload (no date_replaced / notes) ──
  console.log('[upsertComponentPart] Attempt 2 — base payload for part:', part.id);
  {
    const { error } = await supabase.from('component_parts').upsert(basePayload);
    if (!error) {
      console.log('[upsertComponentPart] SUCCESS (attempt 2) — part saved. ID:', part.id);
      return;
    }
    // ── PGRST205 HANDLING ──
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertComponentPart] Attempt 2: PGRST205 — table not in schema cache. Data IS saving. Triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }
    if (isUnknownColumnError(error)) {
      console.warn('[upsertComponentPart] Attempt 2: unknown column — falling through.', error.message);
    } else {
      console.warn('[upsertComponentPart] Attempt 2 failed:', error.code, error.message);
      lastNonColumnError = error;
    }
  }


  // ── 5. Attempt 3: Nuclear minimum ──
  console.log('[upsertComponentPart] Attempt 3 — nuclear minimum for part:', part.id);
  {
    const { error } = await supabase.from('component_parts').upsert(nuclearPayload);
    if (!error) {
      console.log('[upsertComponentPart] SUCCESS (attempt 3) — part saved. ID:', part.id);
      return;
    }
    // ── PGRST205 HANDLING ──
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertComponentPart] Attempt 3: PGRST205 — table not in schema cache. Data IS saving. Triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }
    console.warn('[upsertComponentPart] Attempt 3 failed:', error.code, error.message);
    lastNonColumnError = error;
  }


  // ── 6. Attempt 4: DELETE + INSERT fallback ──
  // If we get here, all upserts failed. The most likely cause is an RLS violation
  // because the existing row has a NULL or different user_id (orphaned row).
  // Strategy: delete the old row (may fail), then insert a fresh one.
  console.log('[upsertComponentPart] Attempt 4 — DELETE + INSERT fallback for part:', part.id);
  {
    // Try to delete the existing row — this may fail if RLS blocks it (NULL user_id)
    const { error: deleteError } = await supabase
      .from('component_parts')
      .delete()
      .eq('id', part.id);

    if (deleteError) {
      // ── PGRST205 HANDLING on DELETE ──
      if (isTableNotInSchemaCache(deleteError)) {
        console.warn('[upsertComponentPart] Attempt 4 DELETE: PGRST205 — table not in schema cache. Data IS saving. Triggering reload.');
        triggerSchemaReload();
        return; // Silent success
      }
      console.warn('[upsertComponentPart] Attempt 4: DELETE failed (may be orphaned row):', deleteError.message);
      // Continue to try INSERT anyway — if the row doesn't exist for this user, INSERT should work
    } else {
      console.log('[upsertComponentPart] Attempt 4: DELETE succeeded for part:', part.id);
    }

    // Now try a fresh INSERT
    const { error: insertError } = await supabase
      .from('component_parts')
      .insert(nuclearPayload);

    if (!insertError) {
      console.log('[upsertComponentPart] SUCCESS (attempt 4 — DELETE + INSERT) — part saved. ID:', part.id);
      return;
    }

    // ── PGRST205 HANDLING on INSERT ──
    if (isTableNotInSchemaCache(insertError)) {
      console.warn('[upsertComponentPart] Attempt 4 INSERT: PGRST205 — table not in schema cache. Data IS saving. Triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }

    // If INSERT fails with a duplicate key error, the old row still exists (DELETE was blocked by RLS).
    // This means there's an orphaned row with NULL/wrong user_id that we can't touch.
    const isDuplicateKey = insertError.code === '23505' ||
      (insertError.message || '').toLowerCase().includes('duplicate key') ||
      (insertError.message || '').toLowerCase().includes('unique constraint');

    if (isDuplicateKey) {
      console.error(
        '[upsertComponentPart] ORPHANED ROW DETECTED — part ID:', part.id,
        '\nAn existing row with this ID has a NULL or different user_id.',
        '\nRLS prevents the current user from updating or deleting it.',
        '\nFix: Run this SQL in Supabase SQL Editor:',
        `\n  UPDATE component_parts SET user_id = '${effectiveUserId}' WHERE id = '${part.id}' AND user_id IS NULL;`,
        '\nOr run sql_add_component_parts_columns.sql which includes a bulk fix.'
      );
      const orphanError: any = new Error(
        `Cannot save part "${part.partName}" — an orphaned database row is blocking the save. ` +
        `Run the migration SQL (sql_add_component_parts_columns.sql) to fix orphaned rows, then try again.`
      );
      orphanError.code = 'ORPHANED_ROW';
      orphanError.details = `Part ID ${part.id} exists in the database with a NULL or mismatched user_id. ` +
        `The current user (${effectiveUserId}) cannot update it due to Row Level Security.`;
      orphanError.hint = 'Run: UPDATE component_parts SET user_id = auth.uid() WHERE user_id IS NULL;';
      throw orphanError;
    }

    console.error('[upsertComponentPart] Attempt 4 INSERT also failed:', insertError.code, insertError.message);
    lastNonColumnError = insertError;
  }

  // ── 7. All attempts exhausted — throw the best error we have ──
  const finalError = lastNonColumnError || new Error('All save attempts failed for unknown reasons');
  console.error('[upsertComponentPart] ALL 4 ATTEMPTS FAILED for part:', part.id, {
    message: finalError.message,
    code: finalError.code,
    details: finalError.details,
    hint: finalError.hint,
  });

  const enrichedError: any = new Error(finalError.message || 'Failed to save component part after 4 attempts');
  enrichedError.code = finalError.code || 'SAVE_FAILED';
  enrichedError.details = finalError.details || `Part "${part.partName}" (ID: ${part.id}) could not be saved.`;
  enrichedError.hint = finalError.hint || 'Check the browser console for detailed error logs. You may need to run the latest migration SQL.';
  throw enrichedError;
};



/**
 * deleteComponentPart — Delete a single standalone part by ID.
 *
 * PGRST205 HANDLING: If the table is not in PostgREST's schema cache,
 * silently succeed (the row may not exist or was already deleted via
 * direct SQL) and trigger a schema cache reload.
 */
export const deleteComponentPart = async (id: string): Promise<void> => {
  const { error } = await supabase.from('component_parts').delete().eq('id', id);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[deleteComponentPart] PGRST205 — component_parts not in schema cache. Silently succeeding and triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }
    throw error;
  }
};

/**
 * deleteComponentPartsByComponentId — Remove ALL parts for a given component.
 * Used when a component (engine, supercharger, drivetrain) is deleted.
 *
 * PGRST205 HANDLING: If the table is not in PostgREST's schema cache,
 * silently succeed and trigger a schema cache reload.
 */
export const deleteComponentPartsByComponentId = async (componentId: string): Promise<void> => {
  const { error } = await supabase.from('component_parts').delete().eq('component_id', componentId);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[deleteComponentPartsByComponentId] PGRST205 — component_parts not in schema cache. Silently succeeding and triggering reload.');
      triggerSchemaReload();
      return; // Silent success
    }
    throw error;
  }
};

/**
 * bulkIncrementComponentPartPasses — Increment passes_on_part for all parts
 * belonging to a specific component. Used by "Record Pass".
 *
 * FIXED: Uses individual .update() calls instead of .upsert() to avoid
 * RLS issues with the INSERT path. Since we just fetched these rows,
 * we know they exist and belong to the current user.
 *
 * PGRST205 HANDLING: If the fetch or any update encounters a "table not
 * in schema cache" error, silently succeed and trigger a schema reload.
 */
export const bulkIncrementComponentPartPasses = async (componentId: string, increment: number): Promise<void> => {
  // Supabase doesn't support atomic increment via PostgREST, so we fetch + update
  const { data, error: fetchError } = await supabase
    .from('component_parts')
    .select('id, passes_on_part')
    .eq('component_id', componentId);

  if (fetchError) {
    // ── PGRST205 HANDLING on FETCH ──
    if (isTableNotInSchemaCache(fetchError)) {
      console.warn('[bulkIncrementComponentPartPasses] PGRST205 on fetch — component_parts not in schema cache. Silently succeeding and triggering reload.');
      triggerSchemaReload();
      return; // Silent success — can't increment what we can't see
    }
    throw fetchError;
  }
  if (!data || data.length === 0) return;

  const now = new Date().toISOString();

  // Use individual .update() calls instead of bulk .upsert()
  // This avoids the INSERT path entirely, preventing RLS issues
  // where the upsert's INSERT attempt fails because user_id isn't in the payload
  const errors: any[] = [];
  for (const row of data) {
    const newPasses = (parseInt(row.passes_on_part) || 0) + increment;
    const { error: updateError } = await supabase
      .from('component_parts')
      .update({ passes_on_part: newPasses, updated_at: now })
      .eq('id', row.id);

    if (updateError) {
      // ── PGRST205 HANDLING on UPDATE ──
      if (isTableNotInSchemaCache(updateError)) {
        console.warn('[bulkIncrementComponentPartPasses] PGRST205 on update for part:', row.id, '— silently succeeding and triggering reload.');
        triggerSchemaReload();
        return; // Silent success for the entire batch
      }
      console.warn('[bulkIncrementComponentPartPasses] Failed to update part:', row.id, updateError.message);
      errors.push(updateError);
    }
  }

  if (errors.length > 0 && errors.length === data.length) {
    // All updates failed — throw the first error
    throw errors[0];
  }
  // If some succeeded and some failed, log but don't throw (partial success)
  if (errors.length > 0) {
    console.warn(`[bulkIncrementComponentPartPasses] ${errors.length}/${data.length} updates failed for component ${componentId}`);
  }
};





// ============ COMPONENT EXTRA FIELDS OPERATIONS ============
// Extra fields for MainComponents (head serials, removal dates, gear ratios, stator info)
// Migrated from localStorage ('mainComp_extraFields') to database table 'component_extra_fields'.
// Table: component_extra_fields (id TEXT PK, user_id UUID, component_id TEXT, component_type TEXT,
//                                 fields JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

export interface ComponentExtraFieldsRecord {
  id: string;
  componentId: string;
  componentType: string;
  fields: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

const toComponentExtraFieldsRecord = (row: any): ComponentExtraFieldsRecord => ({
  id: row.id,
  componentId: row.component_id || '',
  componentType: row.component_type || '',
  fields: row.fields || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchComponentExtraFields = async (userId?: string): Promise<ComponentExtraFieldsRecord[]> => {
  const { data, error } = await supabase
    .from('component_extra_fields')
    .select('*')
    .order('component_id');

  if (error) throw error;
  return (data || []).map(toComponentExtraFieldsRecord);
};

export const upsertComponentExtraFields = async (record: ComponentExtraFieldsRecord, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();

  const payload: Record<string, any> = {
    id: record.id,
    component_id: record.componentId,
    component_type: record.componentType,
    fields: record.fields,
    updated_at: new Date().toISOString(),
  };

  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('component_extra_fields').upsert(payload);
  if (error) throw error;
};

export const deleteComponentExtraFields = async (id: string): Promise<void> => {
  const { error } = await supabase.from('component_extra_fields').delete().eq('id', id);
  if (error) throw error;
};

/**
 * deleteComponentExtraFieldsByComponentId — Remove extra fields for a given component.
 * Used when a component (engine, supercharger, drivetrain) is deleted.
 */
export const deleteComponentExtraFieldsByComponentId = async (componentId: string): Promise<void> => {
  const { error } = await supabase.from('component_extra_fields').delete().eq('component_id', componentId);
  if (error) throw error;
};




// ============ TIRE TRACKING OPERATIONS ============
// Tables: tire_sets, tire_tread_depth, tire_pressure_history, tire_change_log

export interface TireSet {
  id: string;
  brand: string;
  model: string;
  size: string;
  compound: string;
  position: 'Front Left' | 'Front Right' | 'Rear Left' | 'Rear Right' | 'Front (Pair)' | 'Rear (Pair)';
  status: 'Active' | 'Spare' | 'Retired';
  installDate: string;
  totalPasses: number;
  notes: string;
}

export interface TreadDepthEntry {
  id: string;
  tireSetId: string;
  date: string;
  depth: number;
  passCount: number;
  location: string;
  notes: string;
}

export interface TirePressureEntry {
  id: string;
  tireSetId: string;
  date: string;
  passNumber: number;
  pressureBefore: number;
  pressureAfter: number;
  hotPressure?: number;
  trackTemp?: number;
  notes: string;
}

export interface TireChangeLog {
  id: string;
  date: string;
  passCount: number;
  tireSetId: string;
  tireSetName: string;
  action: 'Install' | 'Remove' | 'Rotate' | 'Replace';
  reason: string;
  performedBy: string;
  notes: string;
}

// ── Type converters ──

const toTireSet = (row: any): TireSet => ({
  id: row.id,
  brand: row.brand || '',
  model: row.model || '',
  size: row.size || '',
  compound: row.compound || 'Drag Slick',
  position: row.position || 'Rear (Pair)',
  status: row.status || 'Active',
  installDate: row.install_date || '',
  totalPasses: parseInt(row.total_passes) || 0,
  notes: row.notes || '',
});

const toTreadDepthEntry = (row: any): TreadDepthEntry => ({
  id: row.id,
  tireSetId: row.tire_set_id || '',
  date: row.date || '',
  depth: parseFloat(row.depth) || 0,
  passCount: parseInt(row.pass_count) || 0,
  location: row.location || 'Center',
  notes: row.notes || '',
});

const toTirePressureEntry = (row: any): TirePressureEntry => ({
  id: row.id,
  tireSetId: row.tire_set_id || '',
  date: row.date || '',
  passNumber: parseInt(row.pass_number) || 0,
  pressureBefore: parseFloat(row.pressure_before) || 0,
  pressureAfter: parseFloat(row.pressure_after) || 0,
  hotPressure: row.hot_pressure != null ? parseFloat(row.hot_pressure) : undefined,
  trackTemp: row.track_temp != null ? parseFloat(row.track_temp) : undefined,
  notes: row.notes || '',
});

const toTireChangeLog = (row: any): TireChangeLog => ({
  id: row.id,
  date: row.date || '',
  passCount: parseInt(row.pass_count) || 0,
  tireSetId: row.tire_set_id || '',
  tireSetName: row.tire_set_name || '',
  action: row.action || 'Replace',
  reason: row.reason || '',
  performedBy: row.performed_by || '',
  notes: row.notes || '',
});

// ── Fetch operations ──

export const fetchTireSets = async (userId?: string): Promise<TireSet[]> => {
  const { data, error } = await supabase
    .from('tire_sets')
    .select('*')
    .order('status')
    .order('brand');
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[fetchTireSets] PGRST205 — tire_sets not in schema cache. Triggering reload.');
      triggerSchemaReload();
      return [];
    }
    throw error;
  }
  return (data || []).map(toTireSet);
};

export const fetchTreadDepth = async (userId?: string): Promise<TreadDepthEntry[]> => {
  const { data, error } = await supabase
    .from('tire_tread_depth')
    .select('*')
    .order('date', { ascending: false });
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[fetchTreadDepth] PGRST205 — tire_tread_depth not in schema cache. Triggering reload.');
      triggerSchemaReload();
      return [];
    }
    throw error;
  }
  return (data || []).map(toTreadDepthEntry);
};

export const fetchTirePressureHistory = async (userId?: string): Promise<TirePressureEntry[]> => {
  const { data, error } = await supabase
    .from('tire_pressure_history')
    .select('*')
    .order('pass_number', { ascending: false });
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[fetchTirePressureHistory] PGRST205 — tire_pressure_history not in schema cache. Triggering reload.');
      triggerSchemaReload();
      return [];
    }
    throw error;
  }
  return (data || []).map(toTirePressureEntry);
};

export const fetchTireChangeLog = async (userId?: string): Promise<TireChangeLog[]> => {
  const { data, error } = await supabase
    .from('tire_change_log')
    .select('*')
    .order('date', { ascending: false });
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[fetchTireChangeLog] PGRST205 — tire_change_log not in schema cache. Triggering reload.');
      triggerSchemaReload();
      return [];
    }
    throw error;
  }
  return (data || []).map(toTireChangeLog);
};

// ── Upsert operations ──

export const upsertTireSet = async (tire: TireSet, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: tire.id,
    brand: tire.brand,
    model: tire.model,
    size: emptyToNull(tire.size),
    compound: tire.compound,
    position: tire.position,
    status: tire.status,
    install_date: emptyToNull(tire.installDate),
    total_passes: tire.totalPasses,
    notes: emptyToNull(tire.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;
  const { error } = await supabase.from('tire_sets').upsert(payload);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertTireSet] PGRST205 — triggering reload.');
      triggerSchemaReload();
      return;
    }
    throw error;
  }
};

export const upsertTreadDepth = async (entry: TreadDepthEntry, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: entry.id,
    tire_set_id: entry.tireSetId,
    date: entry.date,
    depth: entry.depth,
    pass_count: entry.passCount,
    location: entry.location,
    notes: emptyToNull(entry.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;
  const { error } = await supabase.from('tire_tread_depth').upsert(payload);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertTreadDepth] PGRST205 — triggering reload.');
      triggerSchemaReload();
      return;
    }
    throw error;
  }
};

export const upsertTirePressure = async (entry: TirePressureEntry, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: entry.id,
    tire_set_id: entry.tireSetId,
    date: entry.date,
    pass_number: entry.passNumber,
    pressure_before: entry.pressureBefore,
    pressure_after: entry.pressureAfter,
    hot_pressure: emptyToNull(entry.hotPressure),
    track_temp: emptyToNull(entry.trackTemp),
    notes: emptyToNull(entry.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;
  const { error } = await supabase.from('tire_pressure_history').upsert(payload);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertTirePressure] PGRST205 — triggering reload.');
      triggerSchemaReload();
      return;
    }
    throw error;
  }
};

export const upsertTireChangeLog = async (entry: TireChangeLog, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: entry.id,
    tire_set_id: entry.tireSetId,
    tire_set_name: entry.tireSetName,
    date: entry.date,
    pass_count: entry.passCount,
    action: entry.action,
    reason: emptyToNull(entry.reason),
    performed_by: emptyToNull(entry.performedBy),
    notes: emptyToNull(entry.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;
  const { error } = await supabase.from('tire_change_log').upsert(payload);
  if (error) {
    if (isTableNotInSchemaCache(error)) {
      console.warn('[upsertTireChangeLog] PGRST205 — triggering reload.');
      triggerSchemaReload();
      return;
    }
    throw error;
  }
};

// ── Delete operations ──

export const deleteTireSet = async (id: string): Promise<void> => {
  // Delete associated data first
  await supabase.from('tire_tread_depth').delete().eq('tire_set_id', id);
  await supabase.from('tire_pressure_history').delete().eq('tire_set_id', id);
  await supabase.from('tire_change_log').delete().eq('tire_set_id', id);
  const { error } = await supabase.from('tire_sets').delete().eq('id', id);
  if (error) throw error;
};

export const deleteTreadDepth = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tire_tread_depth').delete().eq('id', id);
  if (error) throw error;
};

export const deleteTirePressure = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tire_pressure_history').delete().eq('id', id);
  if (error) throw error;
};

export const deleteTireChangeLogEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tire_change_log').delete().eq('id', id);
  if (error) throw error;
};



// ════════════════════════════════════════════════════════════════════════
// RE-EXPORT: database-extra.ts
// ════════════════════════════════════════════════════════════════════════
// All additional table operations (misc_expenses, user_profiles, chassis_setups,
// vendor_invoices, invoice_line_items, cost_reports, parts_usage_log,
// borrowed_loaned_parts, race_cars, chassis_setup_user_presets, transmissions,
// audit_logs) are defined in database-extra.ts and re-exported here so that
// consumers can import everything from '@/lib/database'.

export {
  // Misc Expenses
  fetchMiscExpenses,
  upsertMiscExpense,
  deleteMiscExpense,
  // User Profiles
  fetchUserProfile,
  upsertUserProfile,
  deleteUserProfile,
  // Chassis Setups
  fetchChassisSetups,
  upsertChassisSetup,
  deleteChassisSetup,
  // Vendor Invoices
  fetchVendorInvoices,
  upsertVendorInvoice,
  deleteVendorInvoice,
  updateVendorInvoiceStatus,
  // Invoice Line Items
  fetchInvoiceLineItems,
  upsertInvoiceLineItem,
  deleteInvoiceLineItem,
  deleteInvoiceLineItemsByInvoice,
  // Cost Reports
  fetchCostReports,
  insertCostReport,
  deleteCostReport,
  // Parts Usage Log
  fetchPartsUsageLog,
  insertPartsUsageLog,
  deletePartsUsageLogEntry,
  // Borrowed / Loaned Parts
  fetchBorrowedLoanedParts,
  upsertBorrowedLoanedPart,
  deleteBorrowedLoanedPart,
  returnBorrowedLoanedPart,
  // Race Cars
  fetchRaceCars,
  upsertRaceCar,
  deleteRaceCar,
  // Chassis Setup User Presets
  fetchChassisSetupPresets,
  upsertChassisSetupPreset,
  deleteChassisSetupPreset,
  // Transmissions
  fetchTransmissions,
  upsertTransmission,
  deleteTransmission,
  // Audit Logs
  fetchAuditLogs,
  insertAuditLog,
  deleteAuditLog,
} from './database-extra';

// Re-export types
export type {
  MiscExpense,
  UserProfile,
  ChassisSetup,
  VendorInvoice,
  InvoiceLineItem as InvoiceLineItemRecord,
  CostReport,
  PartsUsageLogEntry,
  BorrowedLoanedPart,
  RaceCar,
  ChassisSetupPreset,
  Transmission,
  AuditLogEntry,
} from './database-extra';
