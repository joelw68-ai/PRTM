/**
 * Sync History Log
 * 
 * Records every offline queue replay attempt — both successes and failures.
 * Stores the last 50 sync events in localStorage.
 * Provides exponential backoff retry for permanently failed items.
 */

import type { QueueOperationType } from '@/lib/offlineQueue';

// ============ TYPES ============

export type SyncEventStatus = 'success' | 'failed';

export interface SyncEvent {
  /** Unique ID for this sync event */
  id: string;
  /** ISO timestamp of when the sync attempt occurred */
  timestamp: string;
  /** The queue operation type (e.g., 'upsertPassLog', 'deleteFuelLog') */
  operationType: QueueOperationType;
  /** Human-readable module label (e.g., 'Pass Log', 'Fuel Log') */
  moduleLabel: string;
  /** Whether the sync succeeded or failed */
  status: SyncEventStatus;
  /** Error message if the sync failed */
  errorMessage?: string;
  /** How many times this particular operation has been retried */
  retryCount: number;
  /** The queue item ID that was being processed */
  queueItemId?: string;
  /** Human-readable label from the queue item */
  itemLabel?: string;
}

/** Configuration for the exponential backoff retry system */
export interface RetryQueueItem {
  /** Original queue item ID */
  originalQueueItemId: string;
  /** The operation type to retry */
  operationType: QueueOperationType;
  /** The data payload (serialized) */
  data: unknown;
  /** User ID associated with the operation */
  userId?: string;
  /** Human-readable label */
  label: string;
  /** Number of retry attempts so far (for the backoff system, separate from queue retryCount) */
  backoffRetryCount: number;
  /** Maximum backoff retries allowed */
  maxBackoffRetries: number;
  /** Timestamp (ms) of when the next retry should be attempted */
  nextRetryAfter: number;
  /** The last error message */
  lastError: string;
}

// ============ CONSTANTS ============

const SYNC_HISTORY_KEY = 'promod_sync_history';
const RETRY_QUEUE_KEY = 'promod_backoff_retry_queue';
const MAX_HISTORY_ITEMS = 50;
const MAX_BACKOFF_RETRIES = 3;
const BASE_BACKOFF_MS = 5000; // 5 seconds base

// ============ MODULE LABEL MAPPING ============

/**
 * Maps queue operation types to human-readable module labels.
 * Used for display in the sync history table.
 */
const MODULE_LABELS: Record<string, string> = {
  // Pass Logs
  upsertPassLog: 'Pass Log',
  deletePassLog: 'Pass Log',
  // Work Orders
  upsertWorkOrder: 'Work Order',
  deleteWorkOrder: 'Work Order',
  // Engines
  upsertEngine: 'Engine',
  deleteEngine: 'Engine',
  // Superchargers
  upsertSupercharger: 'Supercharger',
  deleteSupercharger: 'Supercharger',
  // Cylinder Heads
  upsertCylinderHead: 'Cylinder Head',
  deleteCylinderHead: 'Cylinder Head',
  // Maintenance
  upsertMaintenanceItem: 'Maintenance',
  deleteMaintenanceItem: 'Maintenance',
  // SFI Certifications
  upsertSFICertification: 'SFI Certification',
  deleteSFICertification: 'SFI Certification',
  // Parts Inventory
  upsertPartInventory: 'Parts Inventory',
  deletePartInventory: 'Parts Inventory',
  // Track Weather
  upsertTrackWeatherHistory: 'Track Weather',
  // Checklists
  upsertChecklistItem: 'Checklist',
  deleteChecklistItem: 'Checklist',
  updateChecklistCompletion: 'Checklist',
  resetChecklistByType: 'Checklist',
  // Engine Swap
  insertEngineSwapLog: 'Engine Swap',
  // Race Events
  upsertRaceEvent: 'Race Calendar',
  deleteRaceEvent: 'Race Calendar',
  // Team Members
  upsertTeamMember: 'Team Member',
  deleteTeamMember: 'Team Member',
  // Saved Tracks
  upsertSavedTrack: 'Saved Track',
  deleteSavedTrack: 'Saved Track',
  incrementTrackVisit: 'Saved Track',
  // To-Do Items
  upsertToDoItem: 'To-Do',
  deleteToDoItem: 'To-Do',
  // Team Notes
  upsertTeamNote: 'Team Note',
  deleteTeamNote: 'Team Note',
  // Labor Entries
  upsertLaborEntry: 'Labor Entry',
  deleteLaborEntry: 'Labor Entry',
  // Fuel Log
  upsertFuelLog: 'Fuel Log',
  deleteFuelLog: 'Fuel Log',
};

/**
 * Get the human-readable module label for a queue operation type.
 */
export const getModuleLabelForOperation = (operationType: string): string => {
  return MODULE_LABELS[operationType] || operationType;
};

/**
 * Get all unique module labels for use in filter dropdowns.
 */
export const getAllModuleLabels = (): string[] => {
  const labels = new Set(Object.values(MODULE_LABELS));
  return Array.from(labels).sort();
};

// ============ SYNC HISTORY MANAGEMENT ============

/** Generate a unique ID for sync events */
const generateEventId = (): string => {
  return `se_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
};

/**
 * Read the sync history from localStorage.
 */
export const getSyncHistory = (): SyncEvent[] => {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Save the sync history to localStorage.
 */
const saveSyncHistory = (events: SyncEvent[]): void => {
  try {
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('[SyncHistory] Failed to save sync history:', e);
  }
};

/**
 * Add a sync event to the history log.
 * Keeps only the last MAX_HISTORY_ITEMS events.
 */
export const addSyncEvent = (event: Omit<SyncEvent, 'id' | 'timestamp'>): SyncEvent => {
  const fullEvent: SyncEvent = {
    ...event,
    id: generateEventId(),
    timestamp: new Date().toISOString(),
  };

  const history = getSyncHistory();
  history.unshift(fullEvent); // Add to front (newest first)

  // Trim to max size
  if (history.length > MAX_HISTORY_ITEMS) {
    history.length = MAX_HISTORY_ITEMS;
  }

  saveSyncHistory(history);
  console.log(`[SyncHistory] Recorded: ${event.status} — ${event.moduleLabel} (${event.operationType})`);
  return fullEvent;
};

/**
 * Clear all sync history.
 */
export const clearSyncHistory = (): void => {
  saveSyncHistory([]);
  console.log('[SyncHistory] History cleared');
};

/**
 * Get sync history filtered by module and/or status.
 */
export const getFilteredSyncHistory = (
  moduleFilter?: string,
  statusFilter?: SyncEventStatus
): SyncEvent[] => {
  let events = getSyncHistory();

  if (moduleFilter) {
    events = events.filter(e => e.moduleLabel === moduleFilter);
  }
  if (statusFilter) {
    events = events.filter(e => e.status === statusFilter);
  }

  return events;
};

/**
 * Get summary statistics for the sync history.
 */
export const getSyncHistoryStats = (): {
  total: number;
  successes: number;
  failures: number;
  byModule: Record<string, { success: number; failed: number }>;
  lastSyncTime: string | null;
} => {
  const events = getSyncHistory();
  const stats = {
    total: events.length,
    successes: 0,
    failures: 0,
    byModule: {} as Record<string, { success: number; failed: number }>,
    lastSyncTime: events.length > 0 ? events[0].timestamp : null,
  };

  for (const event of events) {
    if (event.status === 'success') {
      stats.successes++;
    } else {
      stats.failures++;
    }

    if (!stats.byModule[event.moduleLabel]) {
      stats.byModule[event.moduleLabel] = { success: 0, failed: 0 };
    }
    stats.byModule[event.moduleLabel][event.status]++;
  }

  return stats;
};

// ============ EXPONENTIAL BACKOFF RETRY QUEUE ============

/**
 * Read the backoff retry queue from localStorage.
 */
export const getRetryQueue = (): RetryQueueItem[] => {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Save the backoff retry queue to localStorage.
 */
const saveRetryQueue = (queue: RetryQueueItem[]): void => {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[SyncHistory] Failed to save retry queue:', e);
  }
};

/**
 * Calculate the exponential backoff delay for a given retry count.
 * Uses: base * 2^retryCount with jitter.
 * Retry 0: ~5s, Retry 1: ~10s, Retry 2: ~20s
 */
export const calculateBackoffDelay = (retryCount: number): number => {
  const exponentialDelay = BASE_BACKOFF_MS * Math.pow(2, retryCount);
  // Add ±20% jitter to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
};

/**
 * Add a permanently failed item to the backoff retry queue.
 * This is called when an item exceeds its max retries in processQueue
 * and we want to give it additional chances with exponential backoff.
 */
export const addToRetryQueue = (
  queueItemId: string,
  operationType: QueueOperationType,
  data: unknown,
  userId: string | undefined,
  label: string,
  errorMessage: string
): RetryQueueItem | null => {
  const queue = getRetryQueue();

  // Check if this item is already in the retry queue
  const existing = queue.find(item => item.originalQueueItemId === queueItemId);
  if (existing) {
    // Increment its backoff retry count
    if (existing.backoffRetryCount >= MAX_BACKOFF_RETRIES) {
      // Truly permanently failed — remove from retry queue
      const filtered = queue.filter(item => item.originalQueueItemId !== queueItemId);
      saveRetryQueue(filtered);

      addSyncEvent({
        operationType: operationType,
        moduleLabel: getModuleLabelForOperation(operationType),
        status: 'failed',
        errorMessage: `Permanently failed after ${MAX_BACKOFF_RETRIES} backoff retries: ${errorMessage}`,
        retryCount: existing.backoffRetryCount,
        queueItemId,
        itemLabel: label,
      });

      console.error(`[SyncHistory] Permanently failed (${MAX_BACKOFF_RETRIES} backoff retries exhausted): ${label}`);
      return null;
    }

    existing.backoffRetryCount++;
    existing.nextRetryAfter = Date.now() + calculateBackoffDelay(existing.backoffRetryCount);
    existing.lastError = errorMessage;
    saveRetryQueue(queue);
    return existing;
  }

  // New item in the retry queue
  const retryItem: RetryQueueItem = {
    originalQueueItemId: queueItemId,
    operationType: operationType as QueueOperationType,
    data,
    userId,
    label,
    backoffRetryCount: 0,
    maxBackoffRetries: MAX_BACKOFF_RETRIES,
    nextRetryAfter: Date.now() + calculateBackoffDelay(0),
    lastError: errorMessage,
  };

  queue.push(retryItem);
  saveRetryQueue(queue);

  console.log(`[SyncHistory] Added to backoff retry queue: ${label} (next retry in ${BASE_BACKOFF_MS}ms)`);
  return retryItem;
};

/**
 * Get items from the retry queue that are ready to be retried
 * (their backoff delay has elapsed).
 */
export const getRetryableItems = (): RetryQueueItem[] => {
  const now = Date.now();
  return getRetryQueue().filter(item => item.nextRetryAfter <= now);
};

/**
 * Remove an item from the backoff retry queue (after successful retry or permanent failure).
 */
export const removeFromRetryQueue = (originalQueueItemId: string): void => {
  const queue = getRetryQueue().filter(item => item.originalQueueItemId !== originalQueueItemId);
  saveRetryQueue(queue);
};

/**
 * Clear the entire backoff retry queue.
 */
export const clearRetryQueue = (): void => {
  saveRetryQueue([]);
  console.log('[SyncHistory] Retry queue cleared');
};

/**
 * Get the count of items in the backoff retry queue.
 */
export const getRetryQueueCount = (): number => {
  return getRetryQueue().length;
};
