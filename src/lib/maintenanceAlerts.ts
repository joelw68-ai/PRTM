/**
 * Maintenance Alert Threshold System
 * 
 * Manages configurable alert thresholds for pass-count-based maintenance items.
 * Thresholds determine when alerts fire as components approach their service intervals.
 * 
 * PERSISTENCE STRATEGY (March 2026):
 *   • localStorage: Fast, synchronous reads for immediate UI rendering.
 *   • Database (maintenance_alert_settings table): Durable, cross-device sync.
 *   • On load: Read from localStorage first (instant), then async-fetch from DB.
 *   • On save: Write to both localStorage AND the database.
 *   • If DB write fails (offline, table doesn't exist), localStorage is the fallback.
 */

import { MaintenanceItem, calculateMaintenanceStatus } from '@/data/proModData';
import { supabase } from '@/lib/supabase';

// A maintenance item "has a per-item threshold" when threshold is an explicit
// number >= 0. Such items are governed SOLELY by that threshold (remaining
// passes) — the global percentage thresholds never apply to them, so no alert
// can ever appear anywhere in the app until the configured threshold is reached.
function hasPerItemThreshold(item: MaintenanceItem): boolean {
  return item.threshold != null && item.threshold >= 0;
}


export interface AlertThreshold {
  percentage: number;  // e.g., 80, 90, 100
  label: string;       // e.g., "Approaching", "Imminent", "Due"
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export interface MaintenanceAlertSettings {
  enabled: boolean;
  thresholds: AlertThreshold[];
  showToastNotifications: boolean;
  showBellAlerts: boolean;
}

export interface TriggeredAlert {
  maintenanceItemId: string;
  component: string;
  category: string;
  threshold: AlertThreshold;
  currentPasses: number;
  nextServicePasses: number;
  passInterval: number;
  percentUsed: number;
  remainingPasses: number;
}

const STORAGE_KEY = 'maintenance_alert_settings';

const DEFAULT_SETTINGS: MaintenanceAlertSettings = {
  enabled: true,
  thresholds: [
    { percentage: 80, label: 'Approaching Service', severity: 'info', enabled: true },
    { percentage: 90, label: 'Service Imminent', severity: 'warning', enabled: true },
    { percentage: 100, label: 'Service Due', severity: 'critical', enabled: true },
  ],
  showToastNotifications: true,
  showBellAlerts: true,
};

/**
 * Load alert settings from localStorage (synchronous, fast)
 */
export function loadAlertSettings(): MaintenanceAlertSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any missing fields from older versions
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        thresholds: parsed.thresholds || DEFAULT_SETTINGS.thresholds,
      };
    }
  } catch (e) {
    console.warn('Failed to load maintenance alert settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save alert settings to localStorage (synchronous)
 */
export function saveAlertSettings(settings: MaintenanceAlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save maintenance alert settings:', e);
  }
}

// ============ DATABASE PERSISTENCE ============

/**
 * Load alert settings from the database (async).
 * Returns null if the table doesn't exist or no settings are found.
 * The caller should fall back to localStorage/defaults if null.
 */
export async function loadAlertSettingsFromDB(userId?: string): Promise<MaintenanceAlertSettings | null> {
  try {
    const { data, error } = await supabase
      .from('maintenance_alert_settings')
      .select('*')
      .eq('alert_type', 'global')
      .maybeSingle();

    if (error) {
      // Table may not exist yet — silently return null
      console.warn('[maintenanceAlerts] DB load failed (table may not exist):', error.message);
      return null;
    }

    if (!data) return null;

    // Reconstruct MaintenanceAlertSettings from the DB row
    const settings: MaintenanceAlertSettings = {
      enabled: data.is_enabled ?? true,
      showToastNotifications: data.notify_toast ?? true,
      showBellAlerts: data.notify_bell ?? true,
      thresholds: DEFAULT_SETTINGS.thresholds.map(t => ({ ...t })), // Use defaults
    };

    // Also sync to localStorage so next load is instant
    saveAlertSettings(settings);

    return settings;
  } catch (e) {
    console.warn('[maintenanceAlerts] Unexpected error loading from DB:', e);
    return null;
  }
}

/**
 * Save alert settings to the database (async, fire-and-forget safe).
 * Also saves to localStorage for instant reads.
 * Silently fails if the table doesn't exist.
 */
export async function saveAlertSettingsToDB(
  settings: MaintenanceAlertSettings,
  userId?: string
): Promise<void> {
  // Always save to localStorage first (synchronous, guaranteed)
  saveAlertSettings(settings);

  try {
    const payload: Record<string, any> = {
      id: 'global_settings',
      alert_type: 'global',
      is_enabled: settings.enabled,
      notify_toast: settings.showToastNotifications,
      notify_bell: settings.showBellAlerts,
      threshold_pct: settings.thresholds.find(t => t.severity === 'info')?.percentage ?? 80,
      updated_at: new Date().toISOString(),
    };

    if (userId) payload.user_id = userId;

    const { error } = await supabase
      .from('maintenance_alert_settings')
      .upsert(payload);

    if (error) {
      console.warn('[maintenanceAlerts] DB save failed (table may not exist):', error.message);
    }
  } catch (e) {
    console.warn('[maintenanceAlerts] Unexpected error saving to DB:', e);
  }
}


/**
 * Get the default settings (for reset)
 */
export function getDefaultSettings(): MaintenanceAlertSettings {
  return { ...DEFAULT_SETTINGS, thresholds: DEFAULT_SETTINGS.thresholds.map(t => ({ ...t })) };
}

/**
 * Check maintenance items against configured thresholds.
 * Returns triggered alerts sorted by severity (most critical first).
 */
export function checkMaintenanceAlerts(
  maintenanceItems: MaintenanceItem[],
  settings?: MaintenanceAlertSettings
): TriggeredAlert[] {
  const alertSettings = settings || loadAlertSettings();
  
  if (!alertSettings.enabled) return [];

  const enabledThresholds = alertSettings.thresholds
    .filter(t => t.enabled)
    .sort((a, b) => b.percentage - a.percentage); // highest first

  if (enabledThresholds.length === 0) return [];

  const alerts: TriggeredAlert[] = [];

  for (const item of maintenanceItems) {
    if (item.passInterval <= 0) continue;

    const percentUsed = (item.currentPasses / item.nextServicePasses) * 100;
    const remaining = item.nextServicePasses - item.currentPasses;

    // ── Per-item threshold items: threshold is the SINGLE source of truth ──
    // These items must NOT use the global percentage thresholds. They only
    // alert once their computed status leaves "Good" (i.e. remaining passes
    // have reached the configured threshold). Until then: no alert anywhere.
    if (hasPerItemThreshold(item)) {
      const status = calculateMaintenanceStatus(item);
      if (status === 'Good') continue; // not yet at threshold → skip entirely
      const severity: AlertThreshold['severity'] =
        status === 'Due Soon' ? 'warning' : 'critical';
      const label = status === 'Due Soon' ? 'Service Imminent' : 'Service Due';
      alerts.push({
        maintenanceItemId: item.id,
        component: item.component,
        category: item.category,
        threshold: { percentage: severity === 'critical' ? 100 : 90, label, severity, enabled: true },
        currentPasses: item.currentPasses,
        nextServicePasses: item.nextServicePasses,
        passInterval: item.passInterval,
        percentUsed: Math.round(percentUsed),
        remainingPasses: Math.max(0, remaining),
      });
      continue;
    }

    // ── Items WITHOUT a per-item threshold: legacy global percentage rule ──
    // Find the highest threshold that has been reached
    for (const threshold of enabledThresholds) {
      if (percentUsed >= threshold.percentage) {
        alerts.push({
          maintenanceItemId: item.id,
          component: item.component,
          category: item.category,
          threshold,
          currentPasses: item.currentPasses,
          nextServicePasses: item.nextServicePasses,
          passInterval: item.passInterval,
          percentUsed: Math.round(percentUsed),
          remainingPasses: Math.max(0, remaining),
        });
        break; // Only trigger the highest threshold per item
      }
    }
  }


  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.threshold.severity] - severityOrder[b.threshold.severity]);

  return alerts;
}

/**
 * Check which maintenance items just crossed a threshold after a pass was added.
 * Compares old pass counts to new pass counts to find newly triggered alerts.
 * 
 * @param previousItems - maintenance items BEFORE the pass was added
 * @param currentItems - maintenance items AFTER the pass was added
 * @param settings - alert settings
 * @returns newly triggered alerts (items that just crossed a threshold)
 */
export function checkNewlyTriggeredAlerts(
  previousItems: MaintenanceItem[],
  currentItems: MaintenanceItem[],
  settings?: MaintenanceAlertSettings
): TriggeredAlert[] {
  const alertSettings = settings || loadAlertSettings();
  
  if (!alertSettings.enabled || !alertSettings.showToastNotifications) return [];

  const enabledThresholds = alertSettings.thresholds
    .filter(t => t.enabled)
    .sort((a, b) => a.percentage - b.percentage); // lowest first for crossing detection

  if (enabledThresholds.length === 0) return [];

  const newAlerts: TriggeredAlert[] = [];

  for (const currentItem of currentItems) {
    if (currentItem.passInterval <= 0) continue;

    const previousItem = previousItems.find(p => p.id === currentItem.id);
    if (!previousItem) continue;

    // ── Per-item threshold items: threshold is the SINGLE source of truth ──
    // Fire a toast ONLY when the item just crossed its configured threshold,
    // i.e. its status went from "Good" to a non-Good status. No percentage
    // crossings are considered for these items.
    if (hasPerItemThreshold(currentItem)) {
      const prevStatus = calculateMaintenanceStatus(previousItem);
      const currStatus = calculateMaintenanceStatus(currentItem);
      if (prevStatus === 'Good' && currStatus !== 'Good') {
        const severity: AlertThreshold['severity'] =
          currStatus === 'Due Soon' ? 'warning' : 'critical';
        const label = currStatus === 'Due Soon' ? 'Service Imminent' : 'Service Due';
        newAlerts.push({
          maintenanceItemId: currentItem.id,
          component: currentItem.component,
          category: currentItem.category,
          threshold: { percentage: severity === 'critical' ? 100 : 90, label, severity, enabled: true },
          currentPasses: currentItem.currentPasses,
          nextServicePasses: currentItem.nextServicePasses,
          passInterval: currentItem.passInterval,
          percentUsed: Math.round((currentItem.currentPasses / currentItem.nextServicePasses) * 100),
          remainingPasses: Math.max(0, currentItem.nextServicePasses - currentItem.currentPasses),
        });
      }
      continue;
    }

    const prevPercent = previousItem.nextServicePasses > 0
      ? (previousItem.currentPasses / previousItem.nextServicePasses) * 100
      : 0;
    const currPercent = currentItem.nextServicePasses > 0
      ? (currentItem.currentPasses / currentItem.nextServicePasses) * 100
      : 0;

    // Check each threshold to see if we just crossed it
    for (const threshold of enabledThresholds) {
      if (prevPercent < threshold.percentage && currPercent >= threshold.percentage) {
        newAlerts.push({
          maintenanceItemId: currentItem.id,
          component: currentItem.component,
          category: currentItem.category,
          threshold,
          currentPasses: currentItem.currentPasses,
          nextServicePasses: currentItem.nextServicePasses,
          passInterval: currentItem.passInterval,
          percentUsed: Math.round(currPercent),
          remainingPasses: Math.max(0, currentItem.nextServicePasses - currentItem.currentPasses),
        });
      }
    }
  }


  // Sort: critical first
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  newAlerts.sort((a, b) => severityOrder[a.threshold.severity] - severityOrder[b.threshold.severity]);

  return newAlerts;
}

/**
 * Get a summary of all active threshold alerts for the bell tooltip
 */
export function getThresholdAlertSummary(
  maintenanceItems: MaintenanceItem[],
  settings?: MaintenanceAlertSettings
): {
  approaching: { count: number; items: string[] };
  imminent: { count: number; items: string[] };
  due: { count: number; items: string[] };
} {
  const alerts = checkMaintenanceAlerts(maintenanceItems, settings);
  
  const approaching = alerts.filter(a => a.threshold.severity === 'info');
  const imminent = alerts.filter(a => a.threshold.severity === 'warning');
  const due = alerts.filter(a => a.threshold.severity === 'critical');

  return {
    approaching: {
      count: approaching.length,
      items: approaching.slice(0, 3).map(a => `${a.component} (${a.remainingPasses} passes left)`),
    },
    imminent: {
      count: imminent.length,
      items: imminent.slice(0, 3).map(a => `${a.component} (${a.remainingPasses} passes left)`),
    },
    due: {
      count: due.length,
      items: due.slice(0, 3).map(a => `${a.component} (${a.percentUsed}% used)`),
    },
  };
}
