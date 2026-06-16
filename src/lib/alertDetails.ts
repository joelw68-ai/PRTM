// ──────────────────────────────────────────────────────────────────────────
// CANONICAL ALERT ENGINE — single source of truth for ALL alert displays.
//
// Every place in the app that shows alerts derives them from buildAlertDetails:
//   • Top navigation bell badge        (AppContext.getAlertCount → getAlertTotalCount)
//   • Sidebar bell badge               (same)
//   • Alert Center modal (bell click)  (Navigation.tsx / Sidebar.tsx)
//   • Login "Attention Needed" popup   (LoginAlertPopup.tsx)
//   • Dashboard action-items / banners (Dashboard.tsx)
//
// Because they ALL consume the same function, they can never drift apart again.
//
// The logic here mirrors what getAlertCount historically used so the badge
// number always equals the number of alerts shown everywhere else:
//   • SFI certs:    expired (days ≤ 0) + configurable threshold alerts
//   • Maintenance:  status recomputed from current passes; threshold-aware
//   • Parts:        Low Stock / Out of Stock
//   • Snoozed alerts (Team Dashboard) are excluded everywhere.
// ──────────────────────────────────────────────────────────────────────────
import { checkMaintenanceAlerts, loadAlertSettings } from '@/lib/maintenanceAlerts';
import { checkSFIAlerts, loadSFIAlertSettings } from '@/lib/sfiAlerts';
import { calculateMaintenanceStatus } from '@/data/proModData';
import {
  loadAlertSnoozes,
  getTodayStr,
  isAlertSnoozed,
  alertKey,
} from '@/lib/alertSnooze';
import type { AlertDetail } from '@/components/race/AlertCenterModal';

// Loosely typed inputs so this works regardless of the exact data shapes the
// contexts hand us (they already carry the fields we read below).
export function buildAlertDetails(
  sfiCertifications: any[],
  maintenanceItems: any[],
  partsInventory: any[],
): AlertDetail[] {
  const details: AlertDetail[] = [];

  // Snooze map — shared with the Team Dashboard. Snoozed alerts are excluded
  // EVERYWHERE so the bell, popup, dashboard and modal stay in lock-step.
  const snoozes = loadAlertSnoozes();
  const today = getTodayStr();
  const notSnoozed = (key: string) => !isAlertSnoozed(key, snoozes, today);

  // ── Expired SFI Certifications ──
  const expiredCerts = (sfiCertifications || []).filter(
    (c) => c.daysUntilExpiration <= 0 && notSnoozed(alertKey.cert(c.id)),
  );
  if (expiredCerts.length > 0) {
    details.push({
      category: 'Expired SFI Certifications',
      count: expiredCerts.length,
      items: expiredCerts.slice(0, 3).map((c) => `${c.item} (${c.sfiSpec})`),
      severity: 'critical',
      navTarget: 'maintenance',
    });
  }

  // ── SFI Threshold Alerts (configurable; excludes already-counted expired) ──
  try {
    const sfiSettings = loadSFIAlertSettings();
    if (sfiSettings.enabled && sfiSettings.showBellAlerts) {
      const sfiThresholdAlerts = checkSFIAlerts(sfiCertifications || [], sfiSettings);
      const additional = sfiThresholdAlerts.filter(
        (a) => a.daysUntilExpiration > 0 && notSnoozed(alertKey.cert(a.certId)),
      );

      const critical = additional.filter((a) => a.threshold.severity === 'critical');
      const warning = additional.filter((a) => a.threshold.severity !== 'critical');

      if (critical.length > 0) {
        details.push({
          category: 'SFI Certs — Critical',
          count: critical.length,
          items: critical.slice(0, 3).map((a) => `${a.item} — ${a.daysUntilExpiration}d left`),
          severity: 'critical',
          navTarget: 'maintenance',
        });
      }
      if (warning.length > 0) {
        details.push({
          category: 'SFI Certs — Expiring Soon',
          count: warning.length,
          items: warning.slice(0, 3).map((a) => `${a.item} — ${a.daysUntilExpiration}d left`),
          severity: 'warning',
          navTarget: 'maintenance',
        });
      }
    }
  } catch (err) {
    console.warn('[alertDetails] Error loading SFI threshold alerts:', err);
  }

  // ── Maintenance Due / Overdue ──
  // Recompute status from current pass counts and honor each item's threshold,
  // EXACTLY like getAlertCount: items WITH a threshold alert as soon as they
  // leave "Good"; items WITHOUT a threshold use the legacy Due/Overdue rule.
  const dueMaintenance = (maintenanceItems || []).filter((m) => {
    if (!notSnoozed(alertKey.maintenance(m.id))) return false;
    const status = calculateMaintenanceStatus(m);
    const hasThreshold = m.threshold != null && m.threshold >= 0;
    return hasThreshold ? status !== 'Good' : status === 'Due' || status === 'Overdue';
  });

  if (dueMaintenance.length > 0) {
    const overdue = dueMaintenance.filter((m) => calculateMaintenanceStatus(m) === 'Overdue');
    const upcoming = dueMaintenance.filter((m) => calculateMaintenanceStatus(m) !== 'Overdue');

    if (overdue.length > 0) {
      details.push({
        category: 'Maintenance Overdue',
        count: overdue.length,
        items: overdue.slice(0, 3).map((m) => `${m.component}`),
        severity: 'critical',
        navTarget: 'maintenance',
      });
    }
    if (upcoming.length > 0) {
      details.push({
        category: 'Maintenance Due',
        count: upcoming.length,
        items: upcoming.slice(0, 3).map((m) => `${m.component} (${calculateMaintenanceStatus(m)})`),
        severity: 'warning',
        navTarget: 'maintenance',
      });
    }
  }

  // ── Low / Out of Stock Parts ──
  const lowStockParts = (partsInventory || []).filter(
    (p) =>
      (p.status === 'Low Stock' || p.status === 'Out of Stock') &&
      notSnoozed(alertKey.part(p.id)),
  );
  if (lowStockParts.length > 0) {
    details.push({
      category: 'Low / Out of Stock Parts',
      count: lowStockParts.length,
      items: lowStockParts.slice(0, 3).map((p) => `${p.name || p.description} (${p.onHand}/${p.minQuantity})`),
      severity: lowStockParts.some((p) => p.status === 'Out of Stock') ? 'critical' : 'warning',
      navTarget: 'parts',
    });
  }

  return details;
}

/**
 * Canonical TOTAL alert count — the sum of every alert produced by
 * buildAlertDetails. The nav/sidebar bell badge use this so the badge number
 * always equals the number of alerts shown in the Alert Center, login popup
 * and dashboard.
 */
export function getAlertTotalCount(
  sfiCertifications: any[],
  maintenanceItems: any[],
  partsInventory: any[],
): number {
  return buildAlertDetails(sfiCertifications, maintenanceItems, partsInventory).reduce(
    (sum, a) => sum + a.count,
    0,
  );
}
