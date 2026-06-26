/**
 * database-extra.ts — Upsert / fetch / delete functions for database tables
 * that were previously missing centralized data-access functions.
 *
 * These tables had UI components talking directly to Supabase instead of
 * going through a shared data-access layer. This file provides the same
 * pattern used in database.ts (type converter → fetch → upsert → delete)
 * so that all database access is centralized and consistent.
 *
 * Tables covered:
 *   1. misc_expenses
 *   2. user_profiles
 *   3. chassis_setups
 *   4. vendor_invoices
 *   5. invoice_line_items
 *   6. cost_reports
 *   7. parts_usage_log
 *   8. borrowed_loaned_parts
 *   9. race_cars
 *  10. chassis_setup_user_presets
 *  11. transmissions
 *  12. audit_logs
 */

import { supabase } from './supabase';
import { parseRows } from './validatedQuery';
import {
  MiscExpenseRowSchema,
  UserProfileRowSchema,
  ChassisSetupRowSchema,
  VendorInvoiceRowSchema,
  InvoiceLineItemRowSchema,
  CostReportRowSchema,
  PartsUsageLogRowSchema,
  BorrowedLoanedPartRowSchema,
  AuditLogRowSchema,
  UserPresetRowSchema,
  TransmissionRowSchema,
} from './validators';

// Get current user ID helper (duplicated from database.ts to avoid circular imports)
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};


// ─── Helpers (duplicated from database.ts to avoid circular imports) ──
const emptyToNull = (val: any): any => {
  if (val === '' || val === undefined) return null;
  return val;
};

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


// ════════════════════════════════════════════════════════════════════════
// 1. MISC EXPENSES
// ════════════════════════════════════════════════════════════════════════

export interface MiscExpense {
  id: string;
  userId?: string | null;
  category: string;
  customDescription?: string;
  amount: number;
  expenseDate: string;
  paidBy?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  receiptFileName?: string;
  receiptFileType?: string;
  receiptFileSize?: number;
  notes?: string;
  raceEventId?: string;
  linkedEventName?: string;
  addToCostReport?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const toMiscExpense = (row: any): MiscExpense => ({
  id: row.id,
  userId: row.user_id,
  category: row.category || '',
  customDescription: row.custom_description || '',
  amount: parseFloat(row.amount) || 0,
  expenseDate: row.expense_date || '',
  paidBy: row.paid_by || '',
  paymentMethod: row.payment_method || '',
  receiptUrl: row.receipt_url || '',
  receiptFileName: row.receipt_file_name || '',
  receiptFileType: row.receipt_file_type || '',
  receiptFileSize: row.receipt_file_size ? parseFloat(row.receipt_file_size) : undefined,
  notes: row.notes || '',
  raceEventId: row.race_event_id || undefined,
  linkedEventName: row.linked_event_name || undefined,
  addToCostReport: row.add_to_cost_report || false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchMiscExpenses = async (userId?: string): Promise<MiscExpense[]> => {
  const { data, error } = await supabase
    .from('misc_expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return parseRows(data, MiscExpenseRowSchema, 'misc_expenses').map(toMiscExpense);
};

export const upsertMiscExpense = async (expense: MiscExpense, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: expense.id,
    category: expense.category,
    custom_description: emptyToNull(expense.customDescription),
    amount: expense.amount,
    expense_date: expense.expenseDate,
    paid_by: emptyToNull(expense.paidBy),
    payment_method: emptyToNull(expense.paymentMethod),
    receipt_url: emptyToNull(expense.receiptUrl),
    receipt_file_name: emptyToNull(expense.receiptFileName),
    receipt_file_type: emptyToNull(expense.receiptFileType),
    receipt_file_size: emptyToNull(expense.receiptFileSize),
    notes: emptyToNull(expense.notes),
    race_event_id: emptyToNull(expense.raceEventId),
    linked_event_name: emptyToNull(expense.linkedEventName),
    add_to_cost_report: expense.addToCostReport || false,
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('misc_expenses').upsert(payload);
  if (error) throw error;
};

export const deleteMiscExpense = async (id: string): Promise<void> => {
  const { error } = await supabase.from('misc_expenses').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 2. USER PROFILES
// ════════════════════════════════════════════════════════════════════════

export interface UserProfile {
  id: string;
  userId?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  teamName?: string;
  role?: string;
  driverName?: string;
  carName?: string;
  carClass?: string;
  homeTrack?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toUserProfile = (row: any): UserProfile => ({
  id: row.id,
  userId: row.user_id || row.id,
  displayName: row.display_name || '',
  email: row.email || '',
  avatarUrl: row.avatar_url || '',
  teamName: row.team_name || '',
  role: row.role || 'owner',
  driverName: row.driver_name || '',
  carName: row.car_name || '',
  carClass: row.car_class || '',
  homeTrack: row.home_track || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  // Try user_id first (migration-created rows)
  const { data: data1, error: err1 } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!err1 && data1) return toUserProfile(data1);

  // Fallback: try id column (trigger-created rows)
  const { data: data2, error: err2 } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!err2 && data2) return toUserProfile(data2);
  if (err1) throw err1;
  if (err2) throw err2;
  return null;
};

export const upsertUserProfile = async (profile: UserProfile, userId?: string): Promise<void> => {
  const effectiveUserId = userId || profile.userId || profile.id;
  const payload: any = {
    id: profile.id,
    user_id: effectiveUserId,
    display_name: emptyToNull(profile.displayName),
    email: emptyToNull(profile.email),
    avatar_url: emptyToNull(profile.avatarUrl),
    team_name: emptyToNull(profile.teamName),
    role: emptyToNull(profile.role),
    updated_at: new Date().toISOString(),
  };

  // Try with extra columns first, fall back without them
  const fullPayload = {
    ...payload,
    driver_name: emptyToNull(profile.driverName),
    car_name: emptyToNull(profile.carName),
    car_class: emptyToNull(profile.carClass),
    home_track: emptyToNull(profile.homeTrack),
  };

  const { error: fullError } = await supabase.from('user_profiles').upsert(fullPayload, { onConflict: 'user_id' });
  if (!fullError) return;

  if (isUnknownColumnError(fullError)) {
    console.warn('[upsertUserProfile] Extra columns not found — retrying with base payload.');
    const { error: baseError } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
    if (baseError) throw baseError;
    return;
  }

  throw fullError;
};

export const deleteUserProfile = async (id: string): Promise<void> => {
  const { error } = await supabase.from('user_profiles').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 3. CHASSIS SETUPS
// ════════════════════════════════════════════════════════════════════════

export interface ChassisSetup {
  id: string;
  name: string;
  description?: string;
  raceEvent?: string;
  raceDate?: string;
  trackName?: string;
  trackConditions?: string;
  weatherConditions?: string;
  // 4-link geometry
  upperBarChassisX: number;
  upperBarChassisY: number;
  upperBarRearX: number;
  upperBarRearY: number;
  lowerBarChassisX: number;
  lowerBarChassisY: number;
  lowerBarRearX: number;
  lowerBarRearY: number;
  rearEndCenterHeight: number;
  instantCenterLength?: number;
  instantCenterHeight?: number;
  antiSquatPercentage?: number;
  // Weight / balance
  cornerWeights?: any;
  ballastItems?: any;
  totalWeight?: number;
  crossWeightPercentage?: number;
  wheelbase?: number;
  frontTrackWidth?: number;
  rearTrackWidth?: number;
  rideHeightFront?: number;
  rideHeightRear?: number;
  pinionAngle?: number;
  // Suspension
  shockSettings?: any;
  springRates?: any;
  tirePressures?: any;
  wheelieBarLength?: number;
  wheelieBarHeight?: number;
  notes?: string;
  isFavorite?: boolean;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toChassisSetup = (row: any): ChassisSetup => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  raceEvent: row.race_event || '',
  raceDate: row.race_date || '',
  trackName: row.track_name || '',
  trackConditions: row.track_conditions || '',
  weatherConditions: row.weather_conditions || '',
  upperBarChassisX: parseFloat(row.upper_bar_chassis_x) || 0,
  upperBarChassisY: parseFloat(row.upper_bar_chassis_y) || 0,
  upperBarRearX: parseFloat(row.upper_bar_rear_x) || 0,
  upperBarRearY: parseFloat(row.upper_bar_rear_y) || 0,
  lowerBarChassisX: parseFloat(row.lower_bar_chassis_x) || 0,
  lowerBarChassisY: parseFloat(row.lower_bar_chassis_y) || 0,
  lowerBarRearX: parseFloat(row.lower_bar_rear_x) || 0,
  lowerBarRearY: parseFloat(row.lower_bar_rear_y) || 0,
  rearEndCenterHeight: parseFloat(row.rear_end_center_height) || 0,
  instantCenterLength: row.instant_center_length != null ? parseFloat(row.instant_center_length) : undefined,
  instantCenterHeight: row.instant_center_height != null ? parseFloat(row.instant_center_height) : undefined,
  antiSquatPercentage: row.anti_squat_percentage != null ? parseFloat(row.anti_squat_percentage) : undefined,
  cornerWeights: row.corner_weights || {},
  ballastItems: row.ballast_items || [],
  totalWeight: row.total_weight != null ? parseFloat(row.total_weight) : undefined,
  crossWeightPercentage: row.cross_weight_percentage != null ? parseFloat(row.cross_weight_percentage) : undefined,
  wheelbase: row.wheelbase != null ? parseFloat(row.wheelbase) : undefined,
  frontTrackWidth: row.front_track_width != null ? parseFloat(row.front_track_width) : undefined,
  rearTrackWidth: row.rear_track_width != null ? parseFloat(row.rear_track_width) : undefined,
  rideHeightFront: row.ride_height_front != null ? parseFloat(row.ride_height_front) : undefined,
  rideHeightRear: row.ride_height_rear != null ? parseFloat(row.ride_height_rear) : undefined,
  pinionAngle: row.pinion_angle != null ? parseFloat(row.pinion_angle) : undefined,
  shockSettings: row.shock_settings || {},
  springRates: row.spring_rates || {},
  tirePressures: row.tire_pressures || {},
  wheelieBarLength: row.wheelie_bar_length != null ? parseFloat(row.wheelie_bar_length) : undefined,
  wheelieBarHeight: row.wheelie_bar_height != null ? parseFloat(row.wheelie_bar_height) : undefined,
  notes: row.notes || '',
  isFavorite: row.is_favorite || false,
  userId: row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchChassisSetups = async (userId?: string): Promise<ChassisSetup[]> => {
  const { data, error } = await supabase
    .from('chassis_setups')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return parseRows(data, ChassisSetupRowSchema, 'chassis_setups').map(toChassisSetup);
};

export const upsertChassisSetup = async (setup: ChassisSetup, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: setup.id,
    name: setup.name,
    description: emptyToNull(setup.description),
    race_event: emptyToNull(setup.raceEvent),
    race_date: emptyToNull(setup.raceDate),
    track_name: emptyToNull(setup.trackName),
    track_conditions: emptyToNull(setup.trackConditions),
    weather_conditions: emptyToNull(setup.weatherConditions),
    upper_bar_chassis_x: setup.upperBarChassisX,
    upper_bar_chassis_y: setup.upperBarChassisY,
    upper_bar_rear_x: setup.upperBarRearX,
    upper_bar_rear_y: setup.upperBarRearY,
    lower_bar_chassis_x: setup.lowerBarChassisX,
    lower_bar_chassis_y: setup.lowerBarChassisY,
    lower_bar_rear_x: setup.lowerBarRearX,
    lower_bar_rear_y: setup.lowerBarRearY,
    rear_end_center_height: setup.rearEndCenterHeight,
    instant_center_length: emptyToNull(setup.instantCenterLength),
    instant_center_height: emptyToNull(setup.instantCenterHeight),
    anti_squat_percentage: emptyToNull(setup.antiSquatPercentage),
    corner_weights: setup.cornerWeights || {},
    ballast_items: setup.ballastItems || [],
    total_weight: emptyToNull(setup.totalWeight),
    cross_weight_percentage: emptyToNull(setup.crossWeightPercentage),
    wheelbase: emptyToNull(setup.wheelbase),
    front_track_width: emptyToNull(setup.frontTrackWidth),
    rear_track_width: emptyToNull(setup.rearTrackWidth),
    ride_height_front: emptyToNull(setup.rideHeightFront),
    ride_height_rear: emptyToNull(setup.rideHeightRear),
    pinion_angle: emptyToNull(setup.pinionAngle),
    shock_settings: setup.shockSettings || {},
    spring_rates: setup.springRates || {},
    tire_pressures: setup.tirePressures || {},
    wheelie_bar_length: emptyToNull(setup.wheelieBarLength),
    wheelie_bar_height: emptyToNull(setup.wheelieBarHeight),
    notes: emptyToNull(setup.notes),
    is_favorite: setup.isFavorite || false,
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('chassis_setups').upsert(payload);
  if (error) throw error;
};

export const deleteChassisSetup = async (id: string): Promise<void> => {
  const { error } = await supabase.from('chassis_setups').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 4. VENDOR INVOICES
// ════════════════════════════════════════════════════════════════════════

export interface VendorInvoice {
  id: string;
  vendorId?: string;
  vendorName: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  amount?: number;
  tax?: number;
  total: number;
  status: string;
  poNumber?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  notes?: string;
  category?: string;
  paymentMethod?: string;
  paymentDate?: string;
  paidDate?: string;
  receiptUrl?: string;
  linkedEventId?: string;
  carId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toVendorInvoice = (row: any): VendorInvoice => ({
  id: row.id,
  vendorId: row.vendor_id || '',
  vendorName: row.vendor_name || '',
  invoiceNumber: row.invoice_number || '',
  invoiceDate: row.invoice_date || '',
  dueDate: row.due_date || '',
  amount: row.amount != null ? parseFloat(row.amount) : undefined,
  tax: row.tax != null ? parseFloat(row.tax) : undefined,
  total: parseFloat(row.total) || 0,
  status: row.status || 'Pending',
  poNumber: row.po_number || '',
  fileUrl: row.file_url || '',
  fileName: row.file_name || '',
  fileType: row.file_type || '',
  fileSize: row.file_size != null ? parseFloat(row.file_size) : undefined,
  notes: row.notes || '',
  category: row.category || '',
  paymentMethod: row.payment_method || '',
  paymentDate: row.payment_date || '',
  paidDate: row.paid_date || '',
  receiptUrl: row.receipt_url || '',
  linkedEventId: row.linked_event_id || '',
  carId: row.car_id || '',
  userId: row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchVendorInvoices = async (userId?: string): Promise<VendorInvoice[]> => {
  const { data, error } = await supabase
    .from('vendor_invoices')
    .select('*')
    .order('invoice_date', { ascending: false });
  if (error) throw error;
  return parseRows(data, VendorInvoiceRowSchema, 'vendor_invoices').map(toVendorInvoice);
};

export const upsertVendorInvoice = async (invoice: VendorInvoice, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: invoice.id,
    vendor_id: emptyToNull(invoice.vendorId),
    vendor_name: invoice.vendorName,
    invoice_number: emptyToNull(invoice.invoiceNumber),
    invoice_date: invoice.invoiceDate,
    due_date: emptyToNull(invoice.dueDate),
    amount: emptyToNull(invoice.amount),
    tax: emptyToNull(invoice.tax),
    total: invoice.total,
    status: invoice.status,
    po_number: emptyToNull(invoice.poNumber),
    file_url: emptyToNull(invoice.fileUrl),
    file_name: emptyToNull(invoice.fileName),
    file_type: emptyToNull(invoice.fileType),
    file_size: emptyToNull(invoice.fileSize),
    notes: emptyToNull(invoice.notes),
    category: emptyToNull(invoice.category),
    payment_method: emptyToNull(invoice.paymentMethod),
    payment_date: emptyToNull(invoice.paymentDate),
    paid_date: emptyToNull(invoice.paidDate),
    receipt_url: emptyToNull(invoice.receiptUrl),
    linked_event_id: emptyToNull(invoice.linkedEventId),
    car_id: emptyToNull(invoice.carId),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('vendor_invoices').upsert(payload);
  if (error) throw error;
};

export const deleteVendorInvoice = async (id: string): Promise<void> => {
  // Also delete associated line items
  await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
  const { error } = await supabase.from('vendor_invoices').delete().eq('id', id);
  if (error) throw error;
};

export const updateVendorInvoiceStatus = async (id: string, status: string, paymentDate?: string): Promise<void> => {
  const updates: any = { status, updated_at: new Date().toISOString() };
  if (status === 'Paid' && paymentDate) updates.payment_date = paymentDate;
  const { error } = await supabase.from('vendor_invoices').update(updates).eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 5. INVOICE LINE ITEMS
// ════════════════════════════════════════════════════════════════════════

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description?: string;
  partNumber?: string;
  category?: string;
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  total?: number;
  vendorPartNumber?: string;
  notes?: string;
  autoCreatedInventoryId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toInvoiceLineItem = (row: any): InvoiceLineItem => ({
  id: row.id,
  invoiceId: row.invoice_id,
  description: row.description || '',
  partNumber: row.part_number || '',
  category: row.category || '',
  quantity: row.quantity != null ? parseFloat(row.quantity) : undefined,
  unitCost: row.unit_cost != null ? parseFloat(row.unit_cost) : undefined,
  unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : undefined,
  total: row.total != null ? parseFloat(row.total) : undefined,
  vendorPartNumber: row.vendor_part_number || '',
  notes: row.notes || '',
  autoCreatedInventoryId: row.auto_created_inventory_id || '',
  userId: row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchInvoiceLineItems = async (invoiceId: string): Promise<InvoiceLineItem[]> => {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  if (error) throw error;
  return parseRows(data, InvoiceLineItemRowSchema, 'invoice_line_items').map(toInvoiceLineItem);
};

export const upsertInvoiceLineItem = async (item: InvoiceLineItem, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: item.id,
    invoice_id: item.invoiceId,
    description: emptyToNull(item.description),
    part_number: emptyToNull(item.partNumber),
    category: emptyToNull(item.category),
    quantity: emptyToNull(item.quantity),
    unit_cost: emptyToNull(item.unitCost),
    unit_price: emptyToNull(item.unitPrice),
    total: emptyToNull(item.total),
    vendor_part_number: emptyToNull(item.vendorPartNumber),
    notes: emptyToNull(item.notes),
    auto_created_inventory_id: emptyToNull(item.autoCreatedInventoryId),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('invoice_line_items').upsert(payload);
  if (error) throw error;
};

export const deleteInvoiceLineItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('invoice_line_items').delete().eq('id', id);
  if (error) throw error;
};

export const deleteInvoiceLineItemsByInvoice = async (invoiceId: string): Promise<void> => {
  const { error } = await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 6. COST REPORTS
// ════════════════════════════════════════════════════════════════════════

export interface CostReport {
  id: string;
  userId?: string;
  invoiceId?: string;
  vendorName: string;
  amount: number;
  category?: string;
  date: string;
  description?: string;
  source?: string;
  createdAt: string;
  updatedAt?: string;
}

const toCostReport = (row: any): CostReport => ({
  id: row.id,
  userId: row.user_id,
  invoiceId: row.invoice_id || '',
  vendorName: row.vendor_name || '',
  amount: parseFloat(row.amount) || 0,
  category: row.category || '',
  date: row.date || '',
  description: row.description || '',
  source: row.source || '',
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at,
});

export const fetchCostReports = async (userId?: string): Promise<CostReport[]> => {
  const { data, error } = await supabase
    .from('cost_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return parseRows(data, CostReportRowSchema, 'cost_reports').map(toCostReport);
};

export const insertCostReport = async (report: CostReport, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: report.id,
    invoice_id: emptyToNull(report.invoiceId),
    vendor_name: report.vendorName,
    amount: report.amount,
    category: emptyToNull(report.category),
    date: report.date,
    description: emptyToNull(report.description),
    source: emptyToNull(report.source),
    created_at: report.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('cost_reports').insert(payload);
  if (error) throw error;
};

export const deleteCostReport = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cost_reports').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 7. PARTS USAGE LOG
// ════════════════════════════════════════════════════════════════════════

export interface PartsUsageLogEntry {
  id: string;
  partId: string;
  partNumber: string;
  partDescription?: string;
  quantityUsed: number;
  unitCost?: number;
  totalCost?: number;
  usageDate: string;
  usageType: string;
  relatedId?: string;
  relatedTitle?: string;
  notes?: string;
  recordedBy?: string;
  previousOnHand?: number;
  newOnHand?: number;
  userId?: string;
  createdAt?: string;
}

const toPartsUsageLogEntry = (row: any): PartsUsageLogEntry => ({
  id: row.id,
  partId: row.part_id,
  partNumber: row.part_number || '',
  partDescription: row.part_description || '',
  quantityUsed: parseFloat(row.quantity_used) || 0,
  unitCost: row.unit_cost != null ? parseFloat(row.unit_cost) : undefined,
  totalCost: row.total_cost != null ? parseFloat(row.total_cost) : undefined,
  usageDate: row.usage_date || '',
  usageType: row.usage_type || '',
  relatedId: row.related_id || undefined,
  relatedTitle: row.related_title || undefined,
  notes: row.notes || '',
  recordedBy: row.recorded_by || '',
  previousOnHand: row.previous_on_hand != null ? parseInt(row.previous_on_hand) : undefined,
  newOnHand: row.new_on_hand != null ? parseInt(row.new_on_hand) : undefined,
  userId: row.user_id,
  createdAt: row.created_at,
});

export const fetchPartsUsageLog = async (userId?: string): Promise<PartsUsageLogEntry[]> => {
  const { data, error } = await supabase
    .from('parts_usage_log')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return parseRows(data, PartsUsageLogRowSchema, 'parts_usage_log').map(toPartsUsageLogEntry);
};

export const insertPartsUsageLog = async (entry: PartsUsageLogEntry, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: entry.id,
    part_id: entry.partId,
    part_number: entry.partNumber,
    part_description: emptyToNull(entry.partDescription),
    quantity_used: entry.quantityUsed,
    unit_cost: emptyToNull(entry.unitCost),
    total_cost: emptyToNull(entry.totalCost),
    usage_date: entry.usageDate,
    usage_type: entry.usageType,
    related_id: emptyToNull(entry.relatedId),
    related_title: emptyToNull(entry.relatedTitle),
    notes: emptyToNull(entry.notes),
    recorded_by: emptyToNull(entry.recordedBy),
    previous_on_hand: emptyToNull(entry.previousOnHand),
    new_on_hand: emptyToNull(entry.newOnHand),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('parts_usage_log').insert(payload);
  if (error) throw error;
};

export const deletePartsUsageLogEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('parts_usage_log').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 8. BORROWED / LOANED PARTS
// ════════════════════════════════════════════════════════════════════════

export interface BorrowedLoanedPart {
  id: string;
  userId?: string;
  transactionType: 'borrowed' | 'loaned';
  partName: string;
  partNumber?: string;
  description?: string;
  quantity?: number;
  personName?: string;
  contact?: string;
  dateTransaction?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  conditionOut?: string;
  conditionReturned?: string;
  notes?: string;
  status?: string;
  linkedInventoryId?: string;
  inventoryAdjusted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const toBorrowedLoanedPart = (row: any): BorrowedLoanedPart => ({
  id: row.id,
  userId: row.user_id,
  transactionType: row.transaction_type || 'borrowed',
  partName: row.part_name || '',
  partNumber: row.part_number || '',
  description: row.description || '',
  quantity: row.quantity != null ? parseInt(row.quantity) : 1,
  personName: row.person_name || '',
  contact: row.contact || '',
  dateTransaction: row.date_transaction || '',
  expectedReturnDate: row.expected_return_date || '',
  actualReturnDate: row.actual_return_date || '',
  conditionOut: row.condition_out || '',
  conditionReturned: row.condition_returned || '',
  notes: row.notes || '',
  status: row.status || 'active',
  linkedInventoryId: row.linked_inventory_id || undefined,
  inventoryAdjusted: row.inventory_adjusted || false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchBorrowedLoanedParts = async (userId?: string): Promise<BorrowedLoanedPart[]> => {
  let query = supabase
    .from('borrowed_loaned_parts')
    .select('*')
    .order('date_transaction', { ascending: false });
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return parseRows(data, BorrowedLoanedPartRowSchema, 'borrowed_loaned_parts').map(toBorrowedLoanedPart);
};

export const upsertBorrowedLoanedPart = async (part: BorrowedLoanedPart, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();

  const basePayload: any = {
    id: part.id,
    transaction_type: part.transactionType,
    part_name: part.partName,
    part_number: emptyToNull(part.partNumber),
    description: emptyToNull(part.description),
    quantity: part.quantity || 1,
    person_name: emptyToNull(part.personName),
    contact: emptyToNull(part.contact),
    date_transaction: emptyToNull(part.dateTransaction),
    expected_return_date: emptyToNull(part.expectedReturnDate),
    actual_return_date: emptyToNull(part.actualReturnDate),
    condition_out: emptyToNull(part.conditionOut),
    condition_returned: emptyToNull(part.conditionReturned),
    notes: emptyToNull(part.notes),
    status: part.status || 'active',
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) basePayload.user_id = effectiveUserId;

  // Try with optional columns first
  const fullPayload = {
    ...basePayload,
    linked_inventory_id: emptyToNull(part.linkedInventoryId),
    inventory_adjusted: part.inventoryAdjusted || false,
  };

  const { error: fullError } = await supabase.from('borrowed_loaned_parts').upsert(fullPayload);
  if (!fullError) return;

  if (isUnknownColumnError(fullError)) {
    console.warn('[upsertBorrowedLoanedPart] Optional columns not found — retrying with base payload.');
    const { error: baseError } = await supabase.from('borrowed_loaned_parts').upsert(basePayload);
    if (baseError) throw baseError;
    return;
  }

  throw fullError;
};

export const deleteBorrowedLoanedPart = async (id: string): Promise<void> => {
  const { error } = await supabase.from('borrowed_loaned_parts').delete().eq('id', id);
  if (error) throw error;
};

export const returnBorrowedLoanedPart = async (
  id: string,
  actualReturnDate: string,
  conditionReturned: string,
  notes?: string
): Promise<void> => {
  const updates: any = {
    status: 'returned',
    actual_return_date: actualReturnDate,
    condition_returned: emptyToNull(conditionReturned),
    updated_at: new Date().toISOString(),
  };
  if (notes) updates.notes = notes;

  const { error } = await supabase.from('borrowed_loaned_parts').update(updates).eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 9. RACE CARS
// ════════════════════════════════════════════════════════════════════════

export interface RaceCar {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  chassisBuilder?: string;
  chassisNumber?: string;
  raceClass?: string;
  weight?: number;
  color?: string;
  imageUrl?: string;
  isActive: boolean;
  notes?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toRaceCar = (row: any): RaceCar => ({
  id: row.id,
  name: row.name || '',
  make: row.make || '',
  model: row.model || '',
  year: row.year != null ? parseInt(row.year) : undefined,
  chassisBuilder: row.chassis_builder || '',
  chassisNumber: row.chassis_number || '',
  raceClass: row.race_class || '',
  weight: row.weight != null ? parseFloat(row.weight) : undefined,
  color: row.color || '',
  imageUrl: row.image_url || '',
  isActive: row.is_active ?? true,
  notes: row.notes || '',
  userId: row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchRaceCars = async (userId?: string): Promise<RaceCar[]> => {
  const { data, error } = await supabase
    .from('race_cars')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []).map(toRaceCar);
};

export const upsertRaceCar = async (car: RaceCar, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: car.id,
    name: car.name,
    make: emptyToNull(car.make),
    model: emptyToNull(car.model),
    year: emptyToNull(car.year),
    chassis_builder: emptyToNull(car.chassisBuilder),
    chassis_number: emptyToNull(car.chassisNumber),
    race_class: emptyToNull(car.raceClass),
    weight: emptyToNull(car.weight),
    color: emptyToNull(car.color),
    image_url: emptyToNull(car.imageUrl),
    is_active: car.isActive ?? true,
    notes: emptyToNull(car.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('race_cars').upsert(payload);
  if (error) throw error;
};

export const deleteRaceCar = async (id: string): Promise<void> => {
  const { error } = await supabase.from('race_cars').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 10. CHASSIS SETUP USER PRESETS
// ════════════════════════════════════════════════════════════════════════

export interface ChassisSetupPreset {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  category: string;
  settings?: any;
  recommendedPinionAngle?: number;
  targetAntiSquatMin?: number;
  targetAntiSquatMax?: number;
  characteristics?: any;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toChassisSetupPreset = (row: any): ChassisSetupPreset => ({
  id: row.id,
  userId: row.user_id,
  name: row.name || '',
  description: row.description || '',
  category: row.category || 'Custom',
  settings: row.settings || {},
  recommendedPinionAngle: row.recommended_pinion_angle != null ? parseFloat(row.recommended_pinion_angle) : undefined,
  targetAntiSquatMin: row.target_anti_squat_min != null ? parseFloat(row.target_anti_squat_min) : undefined,
  targetAntiSquatMax: row.target_anti_squat_max != null ? parseFloat(row.target_anti_squat_max) : undefined,
  characteristics: row.characteristics || [],
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchChassisSetupPresets = async (userId?: string): Promise<ChassisSetupPreset[]> => {
  const { data, error } = await supabase
    .from('chassis_setup_user_presets')
    .select('*')
    .order('name');
  if (error) throw error;
  return parseRows(data, UserPresetRowSchema, 'chassis_setup_user_presets').map(toChassisSetupPreset);
};

export const upsertChassisSetupPreset = async (preset: ChassisSetupPreset, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: preset.id,
    name: preset.name,
    description: emptyToNull(preset.description),
    category: preset.category,
    settings: preset.settings || {},
    recommended_pinion_angle: emptyToNull(preset.recommendedPinionAngle),
    target_anti_squat_min: emptyToNull(preset.targetAntiSquatMin),
    target_anti_squat_max: emptyToNull(preset.targetAntiSquatMax),
    characteristics: preset.characteristics || [],
    notes: emptyToNull(preset.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('chassis_setup_user_presets').upsert(payload);
  if (error) throw error;
};

export const deleteChassisSetupPreset = async (id: string): Promise<void> => {
  const { error } = await supabase.from('chassis_setup_user_presets').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 11. TRANSMISSIONS
// ════════════════════════════════════════════════════════════════════════

export interface Transmission {
  id: string;
  name: string;
  serialNumber?: string;
  type?: string;
  model?: string;
  builder?: string;
  gearCount?: number;
  installDate?: string;
  totalPasses?: number;
  status?: string;
  currentlyInstalled?: boolean;
  notes?: string;
  userId?: string;
  updatedAt?: string;
}

const toTransmission = (row: any): Transmission => ({
  id: row.id,
  name: row.name || '',
  serialNumber: row.serial_number || '',
  type: row.type || '',
  model: row.model || '',
  builder: row.builder || '',
  gearCount: row.gear_count != null ? parseInt(row.gear_count) : undefined,
  installDate: row.install_date || '',
  totalPasses: row.total_passes != null ? parseInt(row.total_passes) : 0,
  status: row.status || 'Ready',
  currentlyInstalled: row.currently_installed || false,
  notes: row.notes || '',
  userId: row.user_id,
  updatedAt: row.updated_at,
});

export const fetchTransmissions = async (userId?: string): Promise<Transmission[]> => {
  const { data, error } = await supabase
    .from('transmissions')
    .select('*')
    .order('name');
  if (error) throw error;
  return parseRows(data, TransmissionRowSchema, 'transmissions').map(toTransmission);
};

export const upsertTransmission = async (trans: Transmission, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    id: trans.id,
    name: trans.name,
    serial_number: emptyToNull(trans.serialNumber),
    type: emptyToNull(trans.type),
    model: emptyToNull(trans.model),
    builder: emptyToNull(trans.builder),
    gear_count: emptyToNull(trans.gearCount),
    install_date: emptyToNull(trans.installDate),
    total_passes: trans.totalPasses || 0,
    status: trans.status || 'Ready',
    currently_installed: trans.currentlyInstalled || false,
    notes: emptyToNull(trans.notes),
    updated_at: new Date().toISOString(),
  };
  if (effectiveUserId) payload.user_id = effectiveUserId;

  const { error } = await supabase.from('transmissions').upsert(payload);
  if (error) throw error;
};

export const deleteTransmission = async (id: string): Promise<void> => {
  const { error } = await supabase.from('transmissions').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 12. AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  id?: string;
  timestamp?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  actionType?: string;
  category?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  beforeValue?: any;
  afterValue?: any;
  metadata?: any;
  // Legacy fields
  action?: string;
  tableName?: string;
  recordId?: string;
  oldData?: any;
  newData?: any;
  details?: string;
}

const toAuditLogEntry = (row: any): AuditLogEntry => ({
  id: row.id,
  timestamp: row.timestamp || row.created_at,
  userId: row.user_id,
  userName: row.user_name || '',
  userRole: row.user_role || '',
  actionType: row.action_type || row.action || '',
  category: row.category || '',
  entityType: row.entity_type || row.table_name || '',
  entityId: row.entity_id || row.record_id || '',
  entityName: row.entity_name || '',
  description: row.description || row.details || '',
  beforeValue: row.before_value || row.old_data,
  afterValue: row.after_value || row.new_data,
  metadata: row.metadata,
  // Legacy
  action: row.action,
  tableName: row.table_name,
  recordId: row.record_id,
  oldData: row.old_data,
  newData: row.new_data,
  details: row.details,
});

export const fetchAuditLogs = async (userId?: string, limit: number = 100): Promise<AuditLogEntry[]> => {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return parseRows(data, AuditLogRowSchema, 'audit_logs').map(toAuditLogEntry);
};

export const insertAuditLog = async (entry: AuditLogEntry, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  const payload: any = {
    timestamp: entry.timestamp || new Date().toISOString(),
    user_id: effectiveUserId || emptyToNull(entry.userId),
    user_name: emptyToNull(entry.userName),
    user_role: emptyToNull(entry.userRole),
    action_type: emptyToNull(entry.actionType),
    category: emptyToNull(entry.category),
    entity_type: emptyToNull(entry.entityType),
    entity_id: emptyToNull(entry.entityId),
    entity_name: emptyToNull(entry.entityName),
    description: emptyToNull(entry.description),
    before_value: entry.beforeValue || null,
    after_value: entry.afterValue || null,
    metadata: entry.metadata || null,
  };

  const { error } = await supabase.from('audit_logs').insert(payload);
  if (error) throw error;
};

export const deleteAuditLog = async (id: string): Promise<void> => {
  const { error } = await supabase.from('audit_logs').delete().eq('id', id);
  if (error) throw error;
};


// ════════════════════════════════════════════════════════════════════════
// 13. INVENTORY ADJUSTMENTS (on-hand change history)
// ════════════════════════════════════════════════════════════════════════
// Records EVERY on-hand quantity change for a part: deductions from
// maintenance completions, manual +/- edits, restocks from invoices/POs,
// part creation and deletion. Each row captures the previous value, the new
// value, the delta, who made the change, a reason, and a timestamp.

export type InventoryChangeType =
  | 'deduction'
  | 'manual_edit'
  | 'restock'
  | 'add'
  | 'delete';

export interface InventoryAdjustment {
  id: string;
  userId?: string | null;
  partId: string;
  partNumber?: string;
  description?: string;
  changeType: InventoryChangeType;
  source?: string;
  previousOnHand: number;
  newOnHand: number;
  delta: number;
  reason?: string;
  performedBy?: string;
  relatedId?: string;
  relatedTitle?: string;
  createdAt?: string;
}

const toInventoryAdjustment = (row: any): InventoryAdjustment => ({
  id: row.id,
  userId: row.user_id,
  partId: row.part_id || '',
  partNumber: row.part_number || '',
  description: row.description || '',
  changeType: (row.change_type || 'manual_edit') as InventoryChangeType,
  source: row.source || '',
  previousOnHand: row.previous_on_hand != null ? parseInt(row.previous_on_hand) : 0,
  newOnHand: row.new_on_hand != null ? parseInt(row.new_on_hand) : 0,
  delta: row.delta != null ? parseInt(row.delta) : 0,
  reason: row.reason || '',
  performedBy: row.performed_by || '',
  relatedId: row.related_id || '',
  relatedTitle: row.related_title || '',
  createdAt: row.created_at,
});

export const fetchInventoryAdjustments = async (userId?: string): Promise<InventoryAdjustment[]> => {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map(toInventoryAdjustment);
};

export const insertInventoryAdjustment = async (entry: InventoryAdjustment, userId?: string): Promise<void> => {
  const effectiveUserId = userId || await getCurrentUserId();
  // Inventory history is only persisted for authenticated users (RLS requires user_id).
  if (!effectiveUserId) return;
  const payload: any = {
    id: entry.id,
    user_id: effectiveUserId,
    part_id: entry.partId,
    part_number: emptyToNull(entry.partNumber),
    description: emptyToNull(entry.description),
    change_type: entry.changeType,
    source: emptyToNull(entry.source),
    previous_on_hand: entry.previousOnHand ?? 0,
    new_on_hand: entry.newOnHand ?? 0,
    delta: entry.delta ?? 0,
    reason: emptyToNull(entry.reason),
    performed_by: emptyToNull(entry.performedBy),
    related_id: emptyToNull(entry.relatedId),
    related_title: emptyToNull(entry.relatedTitle),
    created_at: entry.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('inventory_adjustments').insert(payload);
  if (error) throw error;
};

export const deleteInventoryAdjustment = async (id: string): Promise<void> => {
  const { error } = await supabase.from('inventory_adjustments').delete().eq('id', id);
  if (error) throw error;
};
