/**
 * Offline Queue System
 * 
 * Queues database write operations to localStorage when the app is offline.
 * When connectivity is restored, processes the queue in order (FIFO).
 * Designed for race-day reliability at tracks with poor cell coverage.
 * 
 * Integrates with syncHistory.ts to record every replay attempt and
 * provide exponential backoff retry for permanently failed items.
 */

import * as db from '@/lib/database';
import {
  addSyncEvent,
  getModuleLabelForOperation,
  addToRetryQueue,
  getRetryableItems,
  removeFromRetryQueue,
} from '@/lib/syncHistory';

import type { PassLogEntry, Engine, Supercharger, CylinderHead, MaintenanceItem, SFICertification, WorkOrder, ChecklistItem, EngineSwapLog, TrackWeatherHistory } from '@/data/proModData';
import type { PartInventoryItem } from '@/data/partsInventory';
import type { RaceEvent } from '@/components/race/RaceCalendar';
import type { TeamMember } from '@/components/race/TeamProfile';
import type { SavedTrack, ToDoItem, TeamNote, LaborEntry, FuelLogEntry } from '@/lib/database';


// ============ TYPES ============

export type QueueOperationType =
  | 'upsertPassLog' | 'deletePassLog'
  | 'upsertWorkOrder' | 'deleteWorkOrder'
  | 'upsertEngine' | 'deleteEngine'
  | 'upsertSupercharger' | 'deleteSupercharger'
  | 'upsertCylinderHead' | 'deleteCylinderHead'
  | 'upsertMaintenanceItem' | 'deleteMaintenanceItem'
  | 'upsertSFICertification' | 'deleteSFICertification'
  | 'upsertPartInventory' | 'deletePartInventory'
  | 'upsertTrackWeatherHistory'
  | 'upsertChecklistItem' | 'deleteChecklistItem' | 'updateChecklistCompletion' | 'resetChecklistByType'
  | 'insertEngineSwapLog'
  | 'upsertRaceEvent' | 'deleteRaceEvent'
  | 'upsertTeamMember' | 'deleteTeamMember'
  | 'upsertSavedTrack' | 'deleteSavedTrack' | 'incrementTrackVisit'
  | 'upsertToDoItem' | 'deleteToDoItem'
  | 'upsertTeamNote' | 'deleteTeamNote'
  | 'upsertLaborEntry' | 'deleteLaborEntry'
  | 'upsertFuelLog' | 'deleteFuelLog';


/**
 * Maps each queue operation to the type of data it carries.
 * This is the single source of truth for the operation→data relationship.
 * 
 * - "upsert" / "insert" operations carry the full entity object.
 * - "delete" / "increment" operations carry a string id.
 * - Checklist operations carry structured payloads.
 */
export interface QueueDataMap {
  upsertPassLog: PassLogEntry;
  deletePassLog: string;
  upsertWorkOrder: WorkOrder;
  deleteWorkOrder: string;
  upsertEngine: Engine;
  deleteEngine: string;
  upsertSupercharger: Supercharger;
  deleteSupercharger: string;
  upsertCylinderHead: CylinderHead;
  deleteCylinderHead: string;
  upsertMaintenanceItem: MaintenanceItem;
  deleteMaintenanceItem: string;
  upsertSFICertification: SFICertification;
  deleteSFICertification: string;
  upsertPartInventory: PartInventoryItem;
  deletePartInventory: string;
  upsertTrackWeatherHistory: TrackWeatherHistory;
  upsertChecklistItem: { item: ChecklistItem; checklistType: string };
  deleteChecklistItem: string;
  updateChecklistCompletion: { id: string; completed: boolean };
  resetChecklistByType: { checklistType: string };
  insertEngineSwapLog: EngineSwapLog;
  upsertRaceEvent: RaceEvent;
  deleteRaceEvent: string;
  upsertTeamMember: TeamMember;
  deleteTeamMember: string;
  upsertSavedTrack: SavedTrack;
  deleteSavedTrack: string;
  incrementTrackVisit: string;
  upsertToDoItem: ToDoItem;
  deleteToDoItem: string;
  upsertLaborEntry: LaborEntry;
  deleteLaborEntry: string;
  upsertFuelLog: FuelLogEntry;
  deleteFuelLog: string;
}


/**
 * A queue item whose `data` field is typed according to its `operation`.
 * At rest (in localStorage), `data` is `unknown` because JSON.parse
 * cannot guarantee the shape. The type parameter is used at enqueue time
 * to ensure callers pass the correct data for each operation.
 */
export interface QueueItem<K extends QueueOperationType = QueueOperationType> {
  id: string;
  operation: K;
  /** Typed at enqueue time via the generic; `unknown` after deserialization. */
  data: QueueDataMap[K];
  userId?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  label: string; // human-readable description
}

/**
 * Serialized form of a queue item as stored in localStorage.
 * `data` is `unknown` because JSON round-tripping erases type information.
 */
interface SerializedQueueItem {
  id: string;
  operation: string;
  data: unknown;
  userId?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  label: string;
}

export interface QueueSyncResult {
  processed: number;
  failed: number;
  errors: Array<{ id: string; label: string; error: string }>;
}

// ============ CONSTANTS ============

const QUEUE_STORAGE_KEY = 'promod_offline_queue';
const MAX_RETRIES = 5;
const CONNECTIVITY_CHECK_URL = 'https://httpbin.org/get'; // lightweight endpoint

// ============ RUNTIME TYPE GUARDS ============

/** Checks that a value is a non-null object (not an array). */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks that a value is a non-null object with an `id` string field. */
const isEntityWithId = (v: unknown): v is { id: string } =>
  isRecord(v) && typeof v.id === 'string';

/** Validates that `data` is a string (used for delete / increment operations). */
const assertString = (data: unknown, label: string): string => {
  if (typeof data === 'string') return data;
  throw new Error(`[OfflineQueue] Expected string for ${label}, got ${typeof data}`);
};

/** Validates that `data` is an entity object with an `id` field. */
const assertEntity = <T extends { id: string }>(data: unknown, label: string): T => {
  if (isEntityWithId(data)) return data as T;
  throw new Error(`[OfflineQueue] Expected entity with id for ${label}, got ${typeof data}`);
};

/** Validates checklist upsert payload. */
const assertChecklistUpsert = (data: unknown): { item: ChecklistItem; checklistType: string } => {
  if (isRecord(data) && isEntityWithId(data.item) && typeof data.checklistType === 'string') {
    return data as { item: ChecklistItem; checklistType: string };
  }
  throw new Error('[OfflineQueue] Invalid checklist upsert payload');
};

/** Validates checklist completion payload. */
const assertChecklistCompletion = (data: unknown): { id: string; completed: boolean } => {
  if (isRecord(data) && typeof data.id === 'string' && typeof data.completed === 'boolean') {
    return data as { id: string; completed: boolean };
  }
  throw new Error('[OfflineQueue] Invalid checklist completion payload');
};

/** Validates checklist reset payload. */
const assertChecklistReset = (data: unknown): { checklistType: string } => {
  if (isRecord(data) && typeof data.checklistType === 'string') {
    return data as { checklistType: string };
  }
  throw new Error('[OfflineQueue] Invalid checklist reset payload');
};

// ============ QUEUE MANAGEMENT ============

/** Generate a unique ID for queue items */
const generateQueueId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/** Read the queue from localStorage (returns loosely-typed serialized items). */
const getSerializedQueue = (): SerializedQueueItem[] => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as SerializedQueueItem[] : [];
  } catch {
    return [];
  }
};

/** Read the queue from localStorage */
export const getQueue = (): QueueItem[] => {
  // The serialized items have `data: unknown`. We trust the data was
  // correctly enqueued (validated at enqueue time) and cast here.
  // Runtime validation happens again in executeOperation before use.
  return getSerializedQueue() as unknown as QueueItem[];
};

/** Write the queue to localStorage */
const saveQueue = (queue: QueueItem[] | SerializedQueueItem[]): void => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Failed to save queue to localStorage:', e);
  }
};

/** Get the count of pending items */
export const getPendingCount = (): number => {
  return getSerializedQueue().length;
};

/**
 * Add an operation to the offline queue.
 * Generic parameter ensures callers pass the correct data type for each operation.
 */
export const enqueue = <K extends QueueOperationType>(
  operation: K,
  data: QueueDataMap[K],
  userId?: string,
  label?: string
): QueueItem<K> => {
  const item: QueueItem<K> = {
    id: generateQueueId(),
    operation,
    data,
    userId,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    label: label || operation,
  };

  const queue = getSerializedQueue();
  queue.push(item as unknown as SerializedQueueItem);
  saveQueue(queue);

  console.log(`[OfflineQueue] Queued: ${item.label} (${queue.length} pending)`);
  return item;
};

/** Remove a specific item from the queue */
export const dequeue = (id: string): void => {
  const queue = getSerializedQueue().filter(item => item.id !== id);
  saveQueue(queue);
};

/** Clear the entire queue */
export const clearQueue = (): void => {
  saveQueue([]);
  console.log('[OfflineQueue] Queue cleared');
};

// ============ OPERATION EXECUTOR ============

/**
 * Execute a single queued operation against the database.
 * Each branch validates the `data` shape at runtime before passing
 * it to the database function, so corrupted localStorage entries
 * fail with a clear error instead of silently passing bad data.
 */
const executeOperation = async (item: SerializedQueueItem): Promise<void> => {
  const { operation, data, userId } = item;

  switch (operation) {
    // Pass Logs
    case 'upsertPassLog':
      await db.upsertPassLog(assertEntity<PassLogEntry>(data, 'upsertPassLog'), userId);
      break;
    case 'deletePassLog':
      await db.deletePassLog(assertString(data, 'deletePassLog'));
      break;

    // Work Orders
    case 'upsertWorkOrder':
      await db.upsertWorkOrder(assertEntity<WorkOrder>(data, 'upsertWorkOrder'), userId);
      break;
    case 'deleteWorkOrder':
      await db.deleteWorkOrder(assertString(data, 'deleteWorkOrder'));
      break;

    // Engines
    case 'upsertEngine':
      await db.upsertEngine(assertEntity<Engine>(data, 'upsertEngine'), userId);
      break;
    case 'deleteEngine':
      await db.deleteEngine(assertString(data, 'deleteEngine'));
      break;

    // Superchargers
    case 'upsertSupercharger':
      await db.upsertSupercharger(assertEntity<Supercharger>(data, 'upsertSupercharger'), userId);
      break;
    case 'deleteSupercharger':
      await db.deleteSupercharger(assertString(data, 'deleteSupercharger'));
      break;

    // Cylinder Heads
    case 'upsertCylinderHead':
      await db.upsertCylinderHead(assertEntity<CylinderHead>(data, 'upsertCylinderHead'), userId);
      break;
    case 'deleteCylinderHead':
      await db.deleteCylinderHead(assertString(data, 'deleteCylinderHead'));
      break;

    // Maintenance Items
    case 'upsertMaintenanceItem':
      await db.upsertMaintenanceItem(assertEntity<MaintenanceItem>(data, 'upsertMaintenanceItem'), userId);
      break;
    case 'deleteMaintenanceItem':
      await db.deleteMaintenanceItem(assertString(data, 'deleteMaintenanceItem'));
      break;

    // SFI Certifications
    case 'upsertSFICertification':
      await db.upsertSFICertification(assertEntity<SFICertification>(data, 'upsertSFICertification'), userId);
      break;
    case 'deleteSFICertification':
      await db.deleteSFICertification(assertString(data, 'deleteSFICertification'));
      break;

    // Parts Inventory
    case 'upsertPartInventory':
      await db.upsertPartInventory(assertEntity<PartInventoryItem>(data, 'upsertPartInventory'), userId);
      break;
    case 'deletePartInventory':
      await db.deletePartInventory(assertString(data, 'deletePartInventory'));
      break;

    // Track Weather History
    case 'upsertTrackWeatherHistory':
      await db.upsertTrackWeatherHistory(assertEntity<TrackWeatherHistory>(data, 'upsertTrackWeatherHistory'), userId);
      break;

    // Checklists
    case 'upsertChecklistItem': {
      const payload = assertChecklistUpsert(data);
      await db.upsertChecklistItem(payload.item, payload.checklistType, userId);
      break;
    }
    case 'deleteChecklistItem':
      await db.deleteChecklistItem(assertString(data, 'deleteChecklistItem'));
      break;
    case 'updateChecklistCompletion': {
      const payload = assertChecklistCompletion(data);
      await db.updateChecklistCompletion(payload.id, payload.completed);
      break;
    }
    case 'resetChecklistByType': {
      const payload = assertChecklistReset(data);
      await db.resetChecklistByType(payload.checklistType, userId);
      break;
    }

    // Engine Swap Logs
    case 'insertEngineSwapLog':
      await db.insertEngineSwapLog(assertEntity<EngineSwapLog>(data, 'insertEngineSwapLog'), userId);
      break;

    // Race Events
    case 'upsertRaceEvent':
      await db.upsertRaceEvent(assertEntity<RaceEvent>(data, 'upsertRaceEvent'), userId);
      break;
    case 'deleteRaceEvent':
      await db.deleteRaceEvent(assertString(data, 'deleteRaceEvent'));
      break;

    // Team Members
    case 'upsertTeamMember':
      await db.upsertTeamMember(assertEntity<TeamMember>(data, 'upsertTeamMember'), userId);
      break;
    case 'deleteTeamMember':
      await db.deleteTeamMember(assertString(data, 'deleteTeamMember'));
      break;

    // Saved Tracks
    case 'upsertSavedTrack':
      await db.upsertSavedTrack(assertEntity<SavedTrack>(data, 'upsertSavedTrack'), userId);
      break;
    case 'deleteSavedTrack':
      await db.deleteSavedTrack(assertString(data, 'deleteSavedTrack'));
      break;
    case 'incrementTrackVisit':
      await db.incrementTrackVisitCount(assertString(data, 'incrementTrackVisit'));
      break;

    // To-Do Items
    case 'upsertToDoItem':
      await db.upsertToDoItem(assertEntity<ToDoItem>(data, 'upsertToDoItem'), userId);
      break;
    case 'deleteToDoItem':
      await db.deleteToDoItem(assertString(data, 'deleteToDoItem'));
      break;

    // Team Notes
    case 'upsertTeamNote':
      await db.upsertTeamNote(assertEntity<TeamNote>(data, 'upsertTeamNote'), userId);
      break;
    case 'deleteTeamNote':
      await db.deleteTeamNote(assertString(data, 'deleteTeamNote'));
      break;

    // Labor Entries
    case 'upsertLaborEntry':
      await db.upsertLaborEntry(assertEntity<LaborEntry>(data, 'upsertLaborEntry'), userId);
      break;
    case 'deleteLaborEntry':
      await db.deleteLaborEntry(assertString(data, 'deleteLaborEntry'));
      break;

    // Fuel Log Entries
    // upsertFuelLog needs special handling: the FuelLogEntry carries teamId and userId
    // inside the entity, which db.upsertFuelLog uses as fallbacks for its 2nd/3rd params.
    case 'upsertFuelLog': {
      const entry = assertEntity<FuelLogEntry>(data, 'upsertFuelLog');
      // Pass userId from queue item, and teamId from the entry itself
      await db.upsertFuelLog(entry, userId || entry.userId, entry.teamId);
      break;
    }
    case 'deleteFuelLog':
      await db.deleteFuelLog(assertString(data, 'deleteFuelLog'));
      break;

    default:
      console.warn(`[OfflineQueue] Unknown operation: ${operation}`);
  }
};

// ============ QUEUE PROCESSOR ============


/** Track whether a sync is currently in progress to prevent overlapping syncs */
let isSyncInProgress = false;

/**
 * Process all queued items in order (FIFO).
 * Items that fail are kept in the queue with incremented retry count.
 * Items that exceed max retries are removed, reported as errors,
 * and added to the exponential backoff retry queue.
 * 
 * Every attempt (success or failure) is recorded in the sync history log.
 */
export const processQueue = async (
  onProgress?: (processed: number, total: number) => void
): Promise<QueueSyncResult> => {
  if (isSyncInProgress) {
    console.log('[OfflineQueue] Sync already in progress, skipping');
    return { processed: 0, failed: 0, errors: [] };
  }

  const queue = getSerializedQueue();
  if (queue.length === 0) {
    // Even with an empty main queue, check for backoff retry items
    await processRetryQueue();
    return { processed: 0, failed: 0, errors: [] };
  }

  isSyncInProgress = true;
  console.log(`[OfflineQueue] Processing ${queue.length} queued items...`);

  const result: QueueSyncResult = { processed: 0, failed: 0, errors: [] };
  const remainingQueue: SerializedQueueItem[] = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const operationType = item.operation as QueueOperationType;
    const moduleLabel = getModuleLabelForOperation(item.operation);

    try {
      await executeOperation(item);
      result.processed++;

      // Record success in sync history
      addSyncEvent({
        operationType,
        moduleLabel,
        status: 'success',
        retryCount: item.retryCount,
        queueItemId: item.id,
        itemLabel: item.label,
      });

      console.log(`[OfflineQueue] Synced: ${item.label} (${i + 1}/${queue.length})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      item.retryCount++;

      if (item.retryCount >= item.maxRetries) {
        // Max retries exceeded — drop from main queue
        result.failed++;
        result.errors.push({ id: item.id, label: item.label, error: errorMsg });

        // Record failure in sync history
        addSyncEvent({
          operationType,
          moduleLabel,
          status: 'failed',
          errorMessage: errorMsg,
          retryCount: item.retryCount,
          queueItemId: item.id,
          itemLabel: item.label,
        });

        // Add to exponential backoff retry queue for additional attempts
        addToRetryQueue(
          item.id,
          operationType,
          item.data,
          item.userId,
          item.label,
          errorMsg
        );

        console.error(`[OfflineQueue] DROPPED after ${item.maxRetries} retries: ${item.label} — ${errorMsg}`);
      } else {
        // Keep in queue for next attempt
        remainingQueue.push(item);

        // Record failure in sync history (will retry)
        addSyncEvent({
          operationType,
          moduleLabel,
          status: 'failed',
          errorMessage: `Retry ${item.retryCount}/${item.maxRetries}: ${errorMsg}`,
          retryCount: item.retryCount,
          queueItemId: item.id,
          itemLabel: item.label,
        });

        console.warn(`[OfflineQueue] Retry ${item.retryCount}/${item.maxRetries}: ${item.label} — ${errorMsg}`);
      }
    }

    onProgress?.(i + 1, queue.length);
  }

  saveQueue(remainingQueue);
  isSyncInProgress = false;

  // After processing the main queue, also process any backoff retry items that are ready
  await processRetryQueue();

  console.log(`[OfflineQueue] Done. Processed: ${result.processed}, Failed: ${result.failed}, Remaining: ${remainingQueue.length}`);
  return result;
};

/**
 * Process items from the exponential backoff retry queue.
 * Only processes items whose backoff delay has elapsed.
 * Re-creates them as SerializedQueueItems and attempts execution.
 */
export const processRetryQueue = async (): Promise<{ processed: number; failed: number }> => {
  const retryableItems = getRetryableItems();
  if (retryableItems.length === 0) return { processed: 0, failed: 0 };

  console.log(`[OfflineQueue] Processing ${retryableItems.length} backoff retry items...`);
  let processed = 0;
  let failed = 0;

  for (const retryItem of retryableItems) {
    const syntheticQueueItem: SerializedQueueItem = {
      id: retryItem.originalQueueItemId,
      operation: retryItem.operationType,
      data: retryItem.data,
      userId: retryItem.userId,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 1, // Single attempt per backoff cycle
      label: retryItem.label,
    };

    const moduleLabel = getModuleLabelForOperation(retryItem.operationType);

    try {
      await executeOperation(syntheticQueueItem);

      // Success! Remove from retry queue and log
      removeFromRetryQueue(retryItem.originalQueueItemId);
      processed++;

      addSyncEvent({
        operationType: retryItem.operationType,
        moduleLabel,
        status: 'success',
        retryCount: retryItem.backoffRetryCount,
        queueItemId: retryItem.originalQueueItemId,
        itemLabel: `[Backoff retry] ${retryItem.label}`,
      });

      console.log(`[OfflineQueue] Backoff retry succeeded: ${retryItem.label}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failed++;

      // Re-add to retry queue with incremented backoff count
      // addToRetryQueue handles the max backoff retries check internally
      const result = addToRetryQueue(
        retryItem.originalQueueItemId,
        retryItem.operationType,
        retryItem.data,
        retryItem.userId,
        retryItem.label,
        errorMsg
      );

      addSyncEvent({
        operationType: retryItem.operationType,
        moduleLabel,
        status: 'failed',
        errorMessage: result
          ? `Backoff retry ${retryItem.backoffRetryCount + 1}/3: ${errorMsg}`
          : `Permanently failed after 3 backoff retries: ${errorMsg}`,
        retryCount: retryItem.backoffRetryCount + 1,
        queueItemId: retryItem.originalQueueItemId,
        itemLabel: `[Backoff retry] ${retryItem.label}`,
      });

      console.warn(`[OfflineQueue] Backoff retry failed: ${retryItem.label} — ${errorMsg}`);
    }
  }

  console.log(`[OfflineQueue] Backoff retry done. Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed };
};


// ============ CONNECTIVITY HELPERS ============

/**
 * Check if the browser reports being online.
 * Note: navigator.onLine can be unreliable (it may report true even when
 * there's no actual internet). For critical operations, use checkRealConnectivity.
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Perform a real connectivity check by making a lightweight HTTP request.
 * Returns true if the request succeeds, false otherwise.
 * Uses a short timeout to avoid blocking the UI.
 */
export const checkRealConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    await fetch(CONNECTIVITY_CHECK_URL, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return true; // If we get here, we have connectivity
  } catch {
    return false;
  }
};

/**
 * Determine if a database error indicates a connectivity problem
 * (as opposed to a data/auth error that would also fail when retried).
 */
export const isConnectivityError = (error: unknown): boolean => {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lowerMsg = message.toLowerCase();

  // Common network error patterns
  const networkPatterns = [
    'failed to fetch',
    'network error',
    'networkerror',
    'net::err_',
    'err_internet_disconnected',
    'err_network_changed',
    'err_connection_refused',
    'err_connection_reset',
    'err_connection_timed_out',
    'err_name_not_resolved',
    'timeout',
    'aborted',
    'load failed',
    'the internet connection appears to be offline',
    'a network error occurred',
    'the network connection was lost',
    'not connected to the internet',
    'could not connect to the server',
    'dns_probe_finished_no_internet',
  ];

  return networkPatterns.some(pattern => lowerMsg.includes(pattern));

};

// ============ FUEL LOG QUEUE HELPERS ============

/** Fuel-log-specific operation names for filtering the global queue. */
const FUEL_LOG_OPS: Set<string> = new Set(['upsertFuelLog', 'deleteFuelLog']);

/**
 * Get the number of pending fuel-log-specific operations in the queue.
 * Useful for showing a fuel-log-specific "X changes pending" indicator
 * without counting unrelated operations from other modules.
 */
export const getFuelLogPendingCount = (): number => {
  return getSerializedQueue().filter(item => FUEL_LOG_OPS.has(item.operation)).length;
};

/**
 * Get pending fuel-log queue items (for display in the UI).
 * Returns a lightweight summary: operation type, label, timestamp, retry count.
 */
export const getFuelLogPendingItems = (): Array<{
  id: string;
  operation: string;
  label: string;
  timestamp: number;
  retryCount: number;
}> => {
  return getSerializedQueue()
    .filter(item => FUEL_LOG_OPS.has(item.operation))
    .map(({ id, operation, label, timestamp, retryCount }) => ({
      id, operation, label, timestamp, retryCount
    }));
};
