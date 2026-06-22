/**
 * SFI Certification Alert Threshold System
 * 
 * Manages configurable alert thresholds for SFI certification expiration dates.
 * Thresholds determine when alerts fire as certifications approach their expiration.
 * 
 * PERSISTENCE STRATEGY:
 *   • localStorage: Fast, synchronous reads for immediate UI rendering.
 *   • Database (sfi_alert_settings table): Durable, cross-device sync.
 *   • On load: Read from localStorage first (instant), then async-fetch from DB.
 *   • On save: Write to both localStorage AND the database.
 *   • If DB write fails (offline, table doesn't exist), localStorage is the fallback.
 */

import { SFICertification } from '@/data/proModData';
import { supabase } from '@/lib/supabase';

export interface SFIAlertThreshold {
  days: number;         // e.g., 90, 60, 30, 0
  label: string;        // e.g., "Expiring in 90 days", "Expired"
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export interface SFIAlertSettings {
  enabled: boolean;
  thresholds: SFIAlertThreshold[];
  showToastNotifications: boolean;
  showBellAlerts: boolean;
}

export interface TriggeredSFIAlert {
  certId: string;
  item: string;
  sfiSpec: string;
  threshold: SFIAlertThreshold;
  daysUntilExpiration: number;
  expirationDate: string;
  status: string;
}

const STORAGE_KEY = 'sfi_alert_settings';

const DEFAULT_SETTINGS: SFIAlertSettings = {
  enabled: true,
  thresholds: [
    { days: 90, label: 'Expiring in 90 Days', severity: 'info', enabled: true },
    { days: 60, label: 'Expiring in 60 Days', severity: 'warning', enabled: true },
    { days: 30, label: 'Expiring in 30 Days', severity: 'critical', enabled: true },
    { days: 0, label: 'Expired', severity: 'critical', enabled: true },
  ],
  showToastNotifications: true,
  showBellAlerts: true,
};

/**
 * Load SFI alert settings from localStorage (synchronous, fast)
 */
export function loadSFIAlertSettings(): SFIAlertSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        thresholds: parsed.thresholds || DEFAULT_SETTINGS.thresholds,
      };
    }
  } catch (e) {
    console.warn('Failed to load SFI alert settings:', e);
  }
  return { ...DEFAULT_SETTINGS, thresholds: DEFAULT_SETTINGS.thresholds.map(t => ({ ...t })) };
}

/**
 * Save SFI alert settings to localStorage (synchronous)
 */
export function saveSFIAlertSettings(settings: SFIAlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save SFI alert settings:', e);
  }
}

// ============ DATABASE PERSISTENCE ============

/**
 * Resolve the current user's id. Prefer an explicitly passed id, otherwise
 * fall back to the active Supabase auth session. Returns undefined if there is
 * no authenticated user.
 */
async function resolveUserId(userId?: string): Promise<string | undefined> {
  if (userId) return userId;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load SFI alert settings from the database (async).
 * Returns null if the table doesn't exist or no settings are found.
 * Settings are stored PER USER (one row per user_id), full thresholds as JSON.
 */
export async function loadSFIAlertSettingsFromDB(userId?: string): Promise<SFIAlertSettings | null> {
  try {
    const uid = await resolveUserId(userId);
    let query = supabase.from('sfi_alert_settings').select('*');
    query = uid ? query.eq('user_id', uid) : query;

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn('[sfiAlerts] DB load failed (table may not exist):', error.message);
      return null;
    }

    if (!data) return null;

    let thresholds: SFIAlertThreshold[] = DEFAULT_SETTINGS.thresholds.map(t => ({ ...t }));
    try {
      const raw = data.thresholds_json;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        thresholds = parsed as SFIAlertThreshold[];
      }
    } catch {
      /* keep defaults */
    }

    const settings: SFIAlertSettings = {
      enabled: data.is_enabled ?? true,
      showToastNotifications: data.notify_toast ?? true,
      showBellAlerts: data.notify_bell ?? true,
      thresholds,
    };

    // Sync to localStorage for instant reads
    saveSFIAlertSettings(settings);

    return settings;
  } catch (e) {
    console.warn('[sfiAlerts] Unexpected error loading from DB:', e);
    return null;
  }
}

/**
 * Save SFI alert settings to the database (async).
 * Also saves to localStorage for instant reads. Keyed per user_id.
 *
 * @returns true if the DB write succeeded, false otherwise.
 */
export async function saveSFIAlertSettingsToDB(
  settings: SFIAlertSettings,
  userId?: string
): Promise<boolean> {
  // Always save to localStorage first
  saveSFIAlertSettings(settings);

  try {
    const uid = await resolveUserId(userId);
    if (!uid) {
      console.warn('[sfiAlerts] No authenticated user; saved to localStorage only.');
      return false;
    }

    const payload: Record<string, any> = {
      user_id: uid,
      is_enabled: settings.enabled,
      notify_toast: settings.showToastNotifications,
      notify_bell: settings.showBellAlerts,
      thresholds_json: settings.thresholds,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('sfi_alert_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('[sfiAlerts] DB save failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[sfiAlerts] Unexpected error saving to DB:', e);
    return false;
  }
}



/**
 * Get the default settings (for reset)
 */
export function getDefaultSFISettings(): SFIAlertSettings {
  return { ...DEFAULT_SETTINGS, thresholds: DEFAULT_SETTINGS.thresholds.map(t => ({ ...t })) };
}

/**
 * Derive a sensible severity for a custom per-cert day threshold based on how
 * close to expiration it is. Tighter day windows are more urgent.
 */
function deriveSeverityForDays(days: number): SFIAlertThreshold['severity'] {
  if (days <= 0) return 'critical';
  if (days <= 30) return 'critical';
  if (days <= 60) return 'warning';
  return 'info';
}

/**
 * Resolve the EFFECTIVE alert thresholds for a single certification.
 *
 * Precedence (mirrors how MaintenanceItem uses its single `threshold` field):
 *   1. The cert's single `threshold` field (DAYS before expiration). This is the
 *      primary, required field on new certs and takes precedence over everything.
 *   2. Legacy `alertThresholdDays[]` overrides (older saved data).
 *   3. The global enabled thresholds.
 *
 * Returned thresholds are sorted lowest-days-first (most critical first) to
 * match the matching logic in checkSFIAlerts.
 */
export function getEffectiveThresholdsForCert(
  cert: SFICertification,
  globalEnabledThresholds: SFIAlertThreshold[]
): SFIAlertThreshold[] {
  // 1. Single per-cert threshold (days before expiration) — the canonical field.
  if (cert.threshold != null && Number.isFinite(cert.threshold) && cert.threshold >= 0) {
    const d = cert.threshold;
    return [{
      days: d,
      label: d <= 0 ? 'Expired' : `${d} days before expiration`,
      severity: deriveSeverityForDays(d),
      enabled: true,
    }];
  }

  // 2. Legacy multi-value overrides (backward compatibility).
  const overrides = cert.alertThresholdDays;
  if (overrides && overrides.length > 0) {
    const custom = overrides
      .filter(d => Number.isFinite(d) && d >= 0)
      // de-duplicate
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .map(d => ({
        days: d,
        label: d <= 0 ? 'Expired (custom)' : `Custom: ${d} days`,
        severity: deriveSeverityForDays(d),
        enabled: true,
      } as SFIAlertThreshold));
    return custom.sort((a, b) => a.days - b.days);
  }

  // 3. Global fallback.
  return globalEnabledThresholds;
}

/**
 * Check SFI certifications against configured day thresholds.
 * Per-certification overrides (cert.alertThresholdDays) take precedence over
 * the global thresholds when present.
 * Returns triggered alerts sorted by severity (most critical first).
 */
export function checkSFIAlerts(
  sfiCertifications: SFICertification[],
  settings?: SFIAlertSettings
): TriggeredSFIAlert[] {
  const alertSettings = settings || loadSFIAlertSettings();

  if (!alertSettings.enabled) return [];

  const globalEnabled = alertSettings.thresholds
    .filter(t => t.enabled)
    .sort((a, b) => a.days - b.days); // lowest days first (most critical)

  const alerts: TriggeredSFIAlert[] = [];

  for (const cert of sfiCertifications) {
    const daysLeft = cert.daysUntilExpiration;

    // Resolve effective thresholds for this specific cert (custom overrides win)
    const effectiveThresholds = getEffectiveThresholdsForCert(cert, globalEnabled);
    if (effectiveThresholds.length === 0) continue;

    // Find the most critical threshold that has been reached
    // (lowest days threshold that the cert has crossed)
    for (const threshold of effectiveThresholds) {
      if (daysLeft <= threshold.days) {
        alerts.push({
          certId: cert.id,
          item: cert.item,
          sfiSpec: cert.sfiSpec,
          threshold,
          daysUntilExpiration: daysLeft,
          expirationDate: cert.expirationDate,
          status: cert.status,
        });
        break; // Only trigger the most critical threshold per cert
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.threshold.severity] - severityOrder[b.threshold.severity]);

  return alerts;
}

/**
 * Check which SFI certifications just crossed a threshold after an update.
 * Compares old days-until-expiration to new to find newly triggered alerts.
 * 
 * @param previousCerts - SFI certs BEFORE the update
 * @param currentCerts - SFI certs AFTER the update
 * @param settings - alert settings
 * @returns newly triggered alerts
 */
export function checkNewlyTriggeredSFIAlerts(
  previousCerts: SFICertification[],
  currentCerts: SFICertification[],
  settings?: SFIAlertSettings
): TriggeredSFIAlert[] {
  const alertSettings = settings || loadSFIAlertSettings();

  if (!alertSettings.enabled || !alertSettings.showToastNotifications) return [];

  const enabledThresholds = alertSettings.thresholds
    .filter(t => t.enabled)
    .sort((a, b) => b.days - a.days); // highest days first for crossing detection

  if (enabledThresholds.length === 0) return [];

  const newAlerts: TriggeredSFIAlert[] = [];

  for (const currentCert of currentCerts) {
    const previousCert = previousCerts.find(p => p.id === currentCert.id);
    if (!previousCert) {
      // New cert — check if it already triggers any threshold
      for (const threshold of enabledThresholds) {
        if (currentCert.daysUntilExpiration <= threshold.days) {
          newAlerts.push({
            certId: currentCert.id,
            item: currentCert.item,
            sfiSpec: currentCert.sfiSpec,
            threshold,
            daysUntilExpiration: currentCert.daysUntilExpiration,
            expirationDate: currentCert.expirationDate,
            status: currentCert.status,
          });
          break;
        }
      }
      continue;
    }

    const prevDays = previousCert.daysUntilExpiration;
    const currDays = currentCert.daysUntilExpiration;

    // Check each threshold to see if we just crossed it
    for (const threshold of enabledThresholds) {
      if (prevDays > threshold.days && currDays <= threshold.days) {
        newAlerts.push({
          certId: currentCert.id,
          item: currentCert.item,
          sfiSpec: currentCert.sfiSpec,
          threshold,
          daysUntilExpiration: currDays,
          expirationDate: currentCert.expirationDate,
          status: currentCert.status,
        });
        break;
      }
    }
  }

  // Sort: critical first
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  newAlerts.sort((a, b) => severityOrder[a.threshold.severity] - severityOrder[b.threshold.severity]);

  return newAlerts;
}

/**
 * Get a summary of all active SFI threshold alerts for the bell tooltip
 */
export function getSFIAlertSummary(
  sfiCertifications: SFICertification[],
  settings?: SFIAlertSettings
): {
  expired: { count: number; items: string[] };
  critical: { count: number; items: string[] };
  warning: { count: number; items: string[] };
  approaching: { count: number; items: string[] };
} {
  const alerts = checkSFIAlerts(sfiCertifications, settings);

  const expired = alerts.filter(a => a.daysUntilExpiration <= 0);
  const critical = alerts.filter(a => a.threshold.severity === 'critical' && a.daysUntilExpiration > 0);
  const warning = alerts.filter(a => a.threshold.severity === 'warning');
  const approaching = alerts.filter(a => a.threshold.severity === 'info');

  return {
    expired: {
      count: expired.length,
      items: expired.slice(0, 3).map(a => `${a.item} (${a.sfiSpec}) — EXPIRED`),
    },
    critical: {
      count: critical.length,
      items: critical.slice(0, 3).map(a => `${a.item} — ${a.daysUntilExpiration}d left`),
    },
    warning: {
      count: warning.length,
      items: warning.slice(0, 3).map(a => `${a.item} — ${a.daysUntilExpiration}d left`),
    },
    approaching: {
      count: approaching.length,
      items: approaching.slice(0, 3).map(a => `${a.item} — ${a.daysUntilExpiration}d left`),
    },
  };
}
