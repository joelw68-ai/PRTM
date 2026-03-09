/**
 * validators.ts — Zod schemas for every Supabase table row.
 *
 * Each schema validates the RAW database row shape (snake_case columns)
 * as returned by PostgREST.  The existing `toXxx()` converters in
 * database.ts continue to handle the snake→camelCase mapping; these
 * schemas sit *before* that step to catch column renames, missing
 * fields, or type mismatches at runtime.
 *
 * Design decisions:
 *   • `.passthrough()` on every object schema so extra columns
 *     (e.g. future migrations) don't cause false negatives.
 *   • Nullable / optional columns use `.nullable().optional()`.
 *   • Numeric columns that PostgREST may return as strings use
 *     `z.union([z.number(), z.string()])` with a coerce helper.
 *   • JSONB columns use `z.any()` since their internal shape varies.
 */

import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────

/** Accepts number OR numeric string (PostgREST sometimes returns text for numeric columns). */
const numericField = z.union([z.number(), z.string().transform(Number)]);

/** Nullable version of numericField. */
const nullableNumeric = z.union([z.number(), z.string().transform(Number), z.null()]).nullable().optional();

/** Nullable string — most optional text columns. */
const ns = z.string().nullable().optional();

/** Nullable boolean. */
const nb = z.boolean().nullable().optional();

/** Nullable JSONB — stored as any. */
const nj = z.any().nullable().optional();

// ─── Pass Logs ────────────────────────────────────────────────

export const PassLogRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  time: ns,
  track: z.string(),
  location: ns,
  session_type: z.string(),
  round: ns,
  lane: ns,
  result: ns,
  reaction_time: nullableNumeric,
  sixty_foot: nullableNumeric,
  three_thirty: nullableNumeric,
  eighth: nullableNumeric,
  mph: nullableNumeric,
  weather: nj,
  sae_correction: nullableNumeric,
  density_altitude: nullableNumeric,
  corrected_hp: nullableNumeric,
  engine_id: ns,
  supercharger_id: ns,
  tire_pressure_front: nullableNumeric,
  tire_pressure_rear_left: nullableNumeric,
  tire_pressure_rear_right: nullableNumeric,
  wheelie_bar_setting: nullableNumeric,
  launch_rpm: nullableNumeric,
  boost_setting: nullableNumeric,
  notes: ns,
  crew_chief: ns,
  aborted: nb,
  car_id: ns,
}).passthrough();

// ─── Engines ──────────────────────────────────────────────────

export const EngineRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  serial_number: ns,
  builder: ns,
  install_date: ns,
  total_passes: nullableNumeric,
  passes_since_rebuild: nullableNumeric,
  status: ns,
  currently_installed: nb,
  notes: ns,
  components: nj,
  car_id: ns,
}).passthrough();

// ─── Superchargers ────────────────────────────────────────────

export const SuperchargerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  serial_number: ns,
  model: ns,
  install_date: ns,
  total_passes: nullableNumeric,
  passes_since_service: nullableNumeric,
  status: ns,
  currently_installed: nb,
  notes: ns,
  car_id: ns,
}).passthrough();

// ─── Cylinder Heads ───────────────────────────────────────────

export const CylinderHeadRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  serial_number: ns,
  builder: ns,
  install_date: ns,
  total_passes: nullableNumeric,
  passes_since_refresh: nullableNumeric,
  status: ns,
  position: ns,
  engine_id: ns,
  notes: ns,
  components: nj,
}).passthrough();

// ─── Maintenance Items ────────────────────────────────────────

export const MaintenanceItemRowSchema = z.object({
  id: z.string(),
  component: z.string(),
  category: ns,
  pass_interval: nullableNumeric,
  current_passes: nullableNumeric,
  last_service: ns,
  next_service_passes: nullableNumeric,
  status: ns,
  priority: ns,
  notes: ns,
  estimated_cost: nullableNumeric,
  car_id: ns,
}).passthrough();

// ─── SFI Certifications ──────────────────────────────────────

export const SFICertificationRowSchema = z.object({
  id: z.string(),
  item: z.string(),
  sfi_spec: ns,
  certification_date: ns,
  expiration_date: ns,
  vendor: ns,
  serial_number: ns,
  status: ns,
  days_until_expiration: nullableNumeric,
  notes: ns,
  car_id: ns,
}).passthrough();

// ─── Work Orders ──────────────────────────────────────────────

export const WorkOrderRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: ns,
  category: ns,
  priority: ns,
  status: ns,
  created_date: ns,
  due_date: ns,
  completed_date: ns,
  assigned_to: ns,
  estimated_hours: nullableNumeric,
  actual_hours: nullableNumeric,
  parts: nj,
  related_component: ns,
  notes: ns,
  car_id: ns,
}).passthrough();

// ─── Engine Swap Logs ─────────────────────────────────────────

export const EngineSwapLogRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  time: ns,
  previous_engine_id: ns,
  new_engine_id: ns,
  reason: ns,
  performed_by: ns,
  notes: ns,
}).passthrough();

// ─── Checklists ───────────────────────────────────────────────

export const ChecklistRowSchema = z.object({
  id: z.string(),
  task: z.string(),
  checklist_type: ns,
  category: ns,
  completed: nb,
  notes: ns,
  critical: nb,
  checked_by: ns,
  checked_at: ns,
}).passthrough();

// ─── Parts Inventory ──────────────────────────────────────────

export const PartInventoryRowSchema = z.object({
  id: z.string(),
  part_number: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  name: ns,
  category: ns,
  subcategory: ns,
  on_hand: nullableNumeric,
  min_quantity: nullableNumeric,
  max_quantity: nullableNumeric,
  vendor: ns,
  vendor_part_number: ns,
  unit_cost: nullableNumeric,
  total_value: nullableNumeric,
  last_ordered: ns,
  last_used: ns,
  location: ns,
  notes: ns,
  status: ns,
  reorder_status: ns,
  related_drivetrain_component_id: ns,
  car_id: ns,
}).passthrough();

// ─── Track Weather History ────────────────────────────────────

export const TrackWeatherHistoryRowSchema = z.object({
  track_id: z.string().nullable().optional(),
  track_name: z.string().nullable().optional(),
  location: ns,
  elevation: nullableNumeric,
  visits: nj,
}).passthrough();

// ─── Race Events ──────────────────────────────────────────────

export const RaceEventRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  event_type: ns,
  track_name: ns,
  track_location: ns,
  start_date: z.string(),
  end_date: ns,
  start_time: ns,
  end_time: ns,
  status: ns,
  sanctioning_body: ns,
  entry_fee: nullableNumeric,
  purse: nullableNumeric,
  notes: ns,
  result: ns,
  best_et: nullableNumeric,
  best_mph: nullableNumeric,
  rounds_won: nullableNumeric,
}).passthrough();

// ─── Team Members ─────────────────────────────────────────────

export const TeamMemberRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: ns,
  phone: ns,
  role: ns,
  permissions: nj,
  specialties: nj,
  is_active: nb,
  joined_date: ns,
  emergency_contact_name: ns,
  emergency_contact_phone: ns,
  notes: ns,
  avatar_url: ns,
  hourly_rate: nullableNumeric,
  daily_rate: nullableNumeric,
}).passthrough();

// ─── Media Gallery ────────────────────────────────────────────

export const MediaItemRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: ns,
  media_type: z.string(),
  url: z.string(),
  thumbnail_url: ns,
  category: ns,
  tags: nj,
  event_name: ns,
  event_date: ns,
  uploaded_by: ns,
  file_size: nullableNumeric,
  duration: nullableNumeric,
  width: nullableNumeric,
  height: nullableNumeric,
  is_featured: nb,
  is_public: nb,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Saved Tracks ─────────────────────────────────────────────

export const SavedTrackRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  elevation: nullableNumeric,
  track_length: ns,
  surface_type: ns,
  notes: ns,
  is_favorite: nb,
  last_visited: ns,
  visit_count: nullableNumeric,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── To-Do Items ──────────────────────────────────────────────

export const ToDoItemRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: ns,
  priority: ns,
  status: ns,
  category: ns,
  assigned_to: ns,
  created_by: ns,
  created_by_role: ns,
  due_date: ns,
  completed_date: ns,
  completed_by: ns,
  tags: nj,
  created_at: ns,
  updated_at: ns,
  is_archived: nb,
  archived_at: ns,
  archived_by: ns,
}).passthrough();

// ─── Team Notes ───────────────────────────────────────────────

export const TeamNoteRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: ns,
  category: ns,
  created_by: ns,
  is_pinned: nb,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Labor Entries ────────────────────────────────────────────

export const LaborEntryRowSchema = z.object({
  id: z.string(),
  team_member_id: ns,
  team_member_name: ns,
  date: z.string(),
  hours: numericField,
  hourly_rate: nullableNumeric,
  daily_rate: nullableNumeric,
  rate_type: ns,
  total_cost: nullableNumeric,
  description: ns,
  category: ns,
  notes: ns,
  event_id: ns,
  event_name: ns,
}).passthrough();

// ─── Vendor Records (setup_vendors) ──────────────────────────

export const VendorRecordRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: ns,
  contact_name: ns,
  email: ns,
  phone: ns,
  address: ns,
  city: ns,
  state: ns,
  zip: ns,
  website: ns,
  category: ns,
  payment_terms: ns,
  discount_percent: nullableNumeric,
  lead_time_days: nullableNumeric,
  minimum_order: nullableNumeric,
  shipping_method: ns,
  notes: ns,
  rating: nullableNumeric,
  is_active: nb,
  created_date: ns,
}).passthrough();

// ─── Drivetrain Components ────────────────────────────────────

export const DrivetrainComponentRowSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: ns,
  make: ns,
  model: ns,
  serial_number: ns,
  builder: ns,
  install_date: ns,
  date_removed: ns,
  total_passes: nullableNumeric,
  passes_since_service: nullableNumeric,
  hours: nullableNumeric,
  status: ns,
  currently_installed: nb,
  notes: ns,
  components: nj,
}).passthrough();

// ─── Drivetrain Swap Logs ─────────────────────────────────────

export const DrivetrainSwapLogRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  time: ns,
  component_type: z.string(),
  previous_component_id: ns,
  new_component_id: ns,
  previous_component_name: ns,
  new_component_name: ns,
  reason: ns,
  performed_by: ns,
  notes: ns,
}).passthrough();

// ─── Vendor Invoices ──────────────────────────────────────────

export const VendorInvoiceRowSchema = z.object({
  id: z.string(),
  vendor_id: ns,
  vendor_name: z.string(),
  invoice_number: ns,
  invoice_date: z.string(),
  due_date: ns,
  amount: nullableNumeric,
  tax: nullableNumeric,
  total: numericField,
  status: z.string(),
  po_number: ns,
  file_url: ns,
  file_name: ns,
  file_type: ns,
  file_size: nullableNumeric,
  notes: ns,
  category: ns,
  payment_method: ns,
  payment_date: ns,
  paid_date: ns,
  receipt_url: ns,
  linked_event_id: ns,
  linked_event_name: ns,
  linked_work_order_id: ns,
  linked_work_order_title: ns,
  car_id: ns,
  user_id: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Cost Reports ─────────────────────────────────────────────

export const CostReportRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  invoice_id: ns,
  vendor_name: z.string(),
  amount: numericField,
  category: ns,
  date: z.string(),
  description: ns,
  source: ns,
  created_at: z.string(),
  updated_at: ns,
}).passthrough();

// ─── Invoice Line Items ───────────────────────────────────────

export const InvoiceLineItemRowSchema = z.object({
  id: z.string(),
  invoice_id: z.string(),
  description: ns,
  part_number: ns,
  category: ns,
  quantity: nullableNumeric,
  unit_cost: nullableNumeric,
  unit_price: nullableNumeric,
  total: nullableNumeric,
  vendor_part_number: ns,
  notes: ns,
  auto_created_inventory_id: ns,
  user_id: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();


// ─── Misc Expenses ────────────────────────────────────────────

export const MiscExpenseRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  car_id: ns,
  category: z.string(),
  custom_description: ns,
  amount: numericField,
  expense_date: z.string(),
  paid_by: ns,
  payment_method: ns,
  receipt_url: ns,
  receipt_file_name: ns,
  receipt_file_type: ns,
  receipt_file_size: nullableNumeric,
  notes: ns,
  race_event_id: ns,
  linked_event_name: ns,
  add_to_cost_report: nb,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Borrowed / Loaned Parts ──────────────────────────────────

export const BorrowedLoanedPartRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  transaction_type: z.string(),
  part_name: z.string(),
  part_number: ns,
  description: ns,
  quantity: nullableNumeric,
  person_name: ns,
  contact: ns,
  date_transaction: ns,
  expected_return_date: ns,
  actual_return_date: ns,
  condition_out: ns,
  condition_returned: ns,
  notes: ns,
  status: ns,
  linked_inventory_id: ns,
  inventory_adjusted: nb,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Chassis Setups ───────────────────────────────────────────

export const ChassisSetupRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: ns,
  race_event: ns,
  race_date: ns,
  track_name: ns,
  track_conditions: ns,
  weather_conditions: ns,
  upper_bar_chassis_x: numericField,
  upper_bar_chassis_y: numericField,
  upper_bar_rear_x: numericField,
  upper_bar_rear_y: numericField,
  lower_bar_chassis_x: numericField,
  lower_bar_chassis_y: numericField,
  lower_bar_rear_x: numericField,
  lower_bar_rear_y: numericField,
  rear_end_center_height: numericField,
  instant_center_length: nullableNumeric,
  instant_center_height: nullableNumeric,
  anti_squat_percentage: nullableNumeric,
  corner_weights: nj,
  ballast_items: nj,
  total_weight: nullableNumeric,
  cross_weight_percentage: nullableNumeric,
  wheelbase: nullableNumeric,
  front_track_width: nullableNumeric,
  rear_track_width: nullableNumeric,
  ride_height_front: nullableNumeric,
  ride_height_rear: nullableNumeric,
  pinion_angle: nullableNumeric,
  shock_settings: nj,
  spring_rates: nj,
  tire_pressures: nj,
  wheelie_bar_length: nullableNumeric,
  wheelie_bar_height: nullableNumeric,
  notes: ns,
  is_favorite: nb,
  user_id: ns,
  car_id: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── User Profiles ────────────────────────────────────────────

export const UserProfileRowSchema = z.object({
  id: z.string(),
  display_name: ns,
  email: ns,
  avatar_url: ns,
  team_name: ns,
  role: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Race Cars ────────────────────────────────────────────────
//
// Actual DB columns (from CarContext insert): id, user_id, car_number,
// nickname, class, year, make, model, color, is_active, notes,
// created_at, updated_at.  We also accept name / class_type for
// forward-compat if the schema ever adds them.

export const RaceCarRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  car_number: ns,
  nickname: ns,
  name: ns,            // alias — some views may use "name" instead of "nickname"
  class: ns,
  class_type: ns,      // alias — kept for forward-compat
  year: nullableNumeric,
  make: ns,
  model: ns,
  color: ns,
  vin: ns,
  weight: nullableNumeric,
  photo_url: ns,
  is_active: nb,
  notes: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Audit Logs ───────────────────────────────────────────────
//
// Actual DB columns (from AuditLogService.log insert): id, timestamp,
// user_id, user_name, user_role, action_type, category, entity_type,
// entity_id, entity_name, description, before_value, after_value,
// metadata.  We also accept the legacy column names (action,
// table_name, record_id, old_data, new_data, details) so the schema
// validates rows written by either the old or new insert path.

export const AuditLogRowSchema = z.object({
  id: z.string().nullable().optional(),
  timestamp: ns,
  // New-style columns
  user_id: ns,
  user_name: ns,
  user_role: ns,
  action_type: ns,
  category: ns,
  entity_type: ns,
  entity_id: ns,
  entity_name: ns,
  description: ns,
  before_value: nj,
  after_value: nj,
  metadata: nj,
  // Legacy column aliases (kept so old rows still validate)
  action: ns,
  table_name: ns,
  record_id: ns,
  old_data: nj,
  new_data: nj,
  details: ns,
}).passthrough();


// ─── User Settings ────────────────────────────────────────────

export const UserSettingsRowSchema = z.object({
  id: z.string().nullable().optional(),
  user_id: ns,
  feature: z.string(),
  settings: nj,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Fuel Log Entries ─────────────────────────────────────────

export const FuelLogRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  car_id: ns,
  team_id: ns,
  date: ns,
  fuel_type: ns,
  quantity_gallons: nullableNumeric,
  price_per_gallon: nullableNumeric,
  total_cost: nullableNumeric,
  vendor: ns,
  notes: ns,
  race_event_id: ns,
  linked_event_name: ns,
  gallons_used: nullableNumeric,
  passes_at_event: nullableNumeric,
  receipt_number: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();



// ─── Team Memberships ─────────────────────────────────────────

export const TeamMembershipRowSchema = z.object({
  id: z.string(),
  team_owner_id: z.string(),
  member_user_id: z.string(),
  team_member_id: ns,
  role: ns,
  permissions: nj,
  status: ns,
  joined_at: ns,
  invite_id: ns,
}).passthrough();

// ─── Team Invites ─────────────────────────────────────────────

export const TeamInviteRowSchema = z.object({
  id: z.string(),
  team_owner_id: z.string(),
  email: z.string(),
  role: ns,
  permissions: nj,
  token: z.string(),
  status: ns,
  invited_by_name: ns,
  team_name: ns,
  created_at: z.string(),
  expires_at: z.string(),
  accepted_at: ns,
}).passthrough();

// ─── Parts Usage Log ──────────────────────────────────────────

export const PartsUsageLogRowSchema = z.object({
  id: z.string(),
  part_id: z.string(),
  part_number: z.string(),
  part_description: ns,
  quantity_used: nullableNumeric,
  unit_cost: nullableNumeric,
  total_cost: nullableNumeric,
  usage_date: z.string(),
  usage_type: z.string(),
  related_id: ns,
  related_title: ns,
  notes: ns,
  recorded_by: ns,
  previous_on_hand: nullableNumeric,
  new_on_hand: nullableNumeric,
  user_id: ns,
  created_at: ns,
}).passthrough();

// ─── User Presets (Chassis Setup) ─────────────────────────────

export const UserPresetRowSchema = z.object({
  id: z.string(),
  user_id: ns,
  name: z.string(),
  description: ns,
  category: z.string(),
  settings: nj,
  recommended_pinion_angle: nullableNumeric,
  target_anti_squat_min: nullableNumeric,
  target_anti_squat_max: nullableNumeric,
  characteristics: nj,
  notes: ns,
  created_at: ns,
  updated_at: ns,
}).passthrough();

// ─── Transmissions ────────────────────────────────────────────

export const TransmissionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  serial_number: ns,
  type: ns,
  model: ns,
  builder: ns,
  gear_count: nullableNumeric,
  install_date: ns,
  total_passes: nullableNumeric,
  status: ns,
  currently_installed: nb,
  notes: ns,
  updated_at: ns,
}).passthrough();

// ─── Convenience Aliases ──────────────────────────────────────
// Some components reference the table name rather than the entity
// name.  These aliases keep imports consistent without duplicating
// schema definitions.

/** Alias for PartInventoryRowSchema — matches the `parts_inventory` table name. */
export const PartsInventoryRowSchema = PartInventoryRowSchema;

/** Alias for VendorRecordRowSchema — matches the `setup_vendors` table name. */
export const SetupVendorRowSchema = VendorRecordRowSchema;
