// ============ SHARED ALERT SNOOZE HELPERS ============
// Snoozed alerts are persisted in localStorage under a single key as a map of
//   alertKey -> ISO date string (yyyy-mm-dd) the alert is snoozed until.
//
// Alert keys use a stable, predictable format so BOTH the Team Dashboard
// (which sets snoozes) AND the global nav bell count (AppContext.getAlertCount)
// can agree on which alerts are currently snoozed:
//   maintenance item -> `maint-${id}`
//   SFI certification -> `cert-${id}`
//   parts inventory   -> `part-${id}`
//
// A snooze is "active" when its date is today or in the future. Snoozed alerts
// are hidden from the dashboard alert lists/counts AND excluded from the nav
// bell badge count.

export const ALERT_SNOOZE_LS_KEY = 'teamAlertSnoozes';

/** Today's date as yyyy-mm-dd (local time). */
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Read the raw snooze map from localStorage (safe, never throws). */
export function loadAlertSnoozes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALERT_SNOOZE_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Persist the snooze map back to localStorage (safe, never throws). */
export function saveAlertSnoozes(snoozes: Record<string, string>): void {
  try {
    localStorage.setItem(ALERT_SNOOZE_LS_KEY, JSON.stringify(snoozes));
  } catch {
    /* ignore */
  }
}

/** Stable alert-key builders (shared by dashboard + bell count). */
export const alertKey = {
  maintenance: (id: string) => `maint-${id}`,
  cert: (id: string) => `cert-${id}`,
  part: (id: string) => `part-${id}`,
};

/**
 * Returns true if the given alert key is currently snoozed (snooze date is
 * today or later). Accepts an already-loaded snooze map + today string so
 * callers iterating many alerts don't re-read localStorage repeatedly.
 */
export function isAlertSnoozed(
  key: string,
  snoozes: Record<string, string> = loadAlertSnoozes(),
  today: string = getTodayStr()
): boolean {
  const until = snoozes[key];
  return !!until && until >= today;
}
