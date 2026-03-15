/**
 * partsCleanup.ts
 * 
 * Centralized utility for purging all cached/localStorage references to a deleted part.
 * Called whenever a part is deleted from parts_inventory to ensure ghost records
 * never appear in Recently Depleted, Usage History, or any other cached widget.
 */

const MAINTENANCE_HISTORY_KEY = 'raceLogbook_maintenanceHistory';
const PARTS_USAGE_HISTORY_KEY = 'raceLogbook_partsUsageHistory';
const PARTS_BACKUP_KEY = 'promod_parts_backup';
const PARTS_BACKUP_TIMESTAMP_KEY = 'promod_parts_backup_timestamp';

interface MaintenanceHistoryEntry {
  id: string;
  maintenanceItemId: string;
  component: string;
  category: string;
  dateCompleted: string;
  passNumberCompletedAt: number | null;
  partsUsed: { partId: string; partNumber: string; description: string; quantity: number; unitCost: number }[];
  notes: string;
  timestamp: string;
}

interface PartsBackup {
  parts: any[];
  timestamp: number;
  count: number;
}

/**
 * Purge ALL cached/localStorage references to a deleted part.
 * 
 * This function cleans up:
 * 1. raceLogbook_maintenanceHistory — removes the deleted partId from all partsUsed arrays
 *    (entries with no remaining parts used are left intact for historical record,
 *     but the deleted part reference is stripped out)
 * 2. raceLogbook_partsUsageHistory — removes all usage records referencing the deleted partId
 * 3. promod_parts_backup — removes the deleted part from the local backup
 * 
 * @param deletedPartId - The ID of the part that was deleted from parts_inventory
 */
export function purgeDeletedPartFromCaches(deletedPartId: string): void {
  if (!deletedPartId) return;

  console.log(`[partsCleanup] Purging all cached references to deleted part: ${deletedPartId}`);

  // ─── 1. Clean maintenance history ───────────────────────────────────
  try {
    const rawHistory = localStorage.getItem(MAINTENANCE_HISTORY_KEY);
    if (rawHistory) {
      const history: MaintenanceHistoryEntry[] = JSON.parse(rawHistory);
      let modified = false;

      const cleanedHistory = history.map(entry => {
        const originalLength = entry.partsUsed.length;
        const filteredParts = entry.partsUsed.filter(pu => pu.partId !== deletedPartId);
        if (filteredParts.length !== originalLength) {
          modified = true;
          return { ...entry, partsUsed: filteredParts };
        }
        return entry;
      });

      if (modified) {
        localStorage.setItem(MAINTENANCE_HISTORY_KEY, JSON.stringify(cleanedHistory));
        console.log(`[partsCleanup] Cleaned maintenance history — removed part ${deletedPartId} from partsUsed arrays`);
      }
    }
  } catch (e) {
    console.warn('[partsCleanup] Failed to clean maintenance history:', e);
  }

  // ─── 2. Clean parts usage history ──────────────────────────────────
  try {
    const rawUsage = localStorage.getItem(PARTS_USAGE_HISTORY_KEY);
    if (rawUsage) {
      const usageRecords: any[] = JSON.parse(rawUsage);
      const originalLength = usageRecords.length;
      const filteredRecords = usageRecords.filter(
        (record: any) => record.partId !== deletedPartId
      );

      if (filteredRecords.length !== originalLength) {
        localStorage.setItem(PARTS_USAGE_HISTORY_KEY, JSON.stringify(filteredRecords));
        console.log(
          `[partsCleanup] Cleaned parts usage history — removed ${originalLength - filteredRecords.length} records for part ${deletedPartId}`
        );
      }
    }
  } catch (e) {
    console.warn('[partsCleanup] Failed to clean parts usage history:', e);
  }

  // ─── 3. Clean parts backup ─────────────────────────────────────────
  try {
    const rawBackup = localStorage.getItem(PARTS_BACKUP_KEY);
    if (rawBackup) {
      const backup: PartsBackup = JSON.parse(rawBackup);
      const originalCount = backup.parts.length;
      backup.parts = backup.parts.filter((p: any) => p.id !== deletedPartId);

      if (backup.parts.length !== originalCount) {
        backup.count = backup.parts.length;
        backup.timestamp = Date.now();
        localStorage.setItem(PARTS_BACKUP_KEY, JSON.stringify(backup));
        localStorage.setItem(PARTS_BACKUP_TIMESTAMP_KEY, String(Date.now()));
        console.log(
          `[partsCleanup] Cleaned parts backup — removed part ${deletedPartId}`
        );
      }
    }
  } catch (e) {
    console.warn('[partsCleanup] Failed to clean parts backup:', e);
  }
}
