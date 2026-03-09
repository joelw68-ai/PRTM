/**
 * useOfflineSync Hook
 * 
 * Monitors browser online/offline status and automatically processes
 * the offline queue when connectivity is restored. Provides state for
 * UI indicators (online status, pending count, sync progress).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getQueue,
  processQueue,
  getPendingCount,
  isOnline as checkIsOnline,
  isConnectivityError,
  enqueue,
  QueueOperationType,
  QueueSyncResult,
  QueueDataMap,
} from '@/lib/offlineQueue';


export interface OfflineSyncState {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Number of items waiting to be synced */
  pendingCount: number;
  /** Whether the queue is currently being processed */
  isSyncing: boolean;
  /** Progress during sync (0-100) */
  syncProgress: number;
  /** Result of the last sync attempt */
  lastSyncResult: QueueSyncResult | null;
  /** Timestamp of last successful sync */
  lastSyncTime: Date | null;
  /** Manually trigger queue processing */
  syncNow: () => Promise<QueueSyncResult>;
  /** Queue an operation for offline processing (type-safe via QueueDataMap) */
  queueOperation: <K extends QueueOperationType>(
    operation: K,
    data: QueueDataMap[K],
    userId?: string,
    label?: string
  ) => void;

  /** Whether there was a recent connectivity error (even if navigator says online) */
  hasConnectivityIssue: boolean;
  /** Report a connectivity error from a failed database operation */
  reportConnectivityError: () => void;
  /** Report a successful database operation (clears connectivity issue flag) */
  reportSuccess: () => void;
}

export const useOfflineSync = (): OfflineSyncState => {
  const [isOnline, setIsOnline] = useState<boolean>(checkIsOnline());
  const [pendingCount, setPendingCount] = useState<number>(getPendingCount());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [lastSyncResult, setLastSyncResult] = useState<QueueSyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [hasConnectivityIssue, setHasConnectivityIssue] = useState<boolean>(false);

  const mountedRef = useRef(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailsRef = useRef(0);

  // ============ CONNECTIVITY MONITORING ============

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      console.log('[useOfflineSync] Browser went online');
      if (mountedRef.current) {
        setIsOnline(true);
        setHasConnectivityIssue(false);
        consecutiveFailsRef.current = 0;
        // Auto-sync after a short delay to let the connection stabilize
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && getPendingCount() > 0) {
            syncNow();
          }
        }, 2000);
      }
    };

    const handleOffline = () => {
      console.log('[useOfflineSync] Browser went offline');
      if (mountedRef.current) {
        setIsOnline(false);
        setHasConnectivityIssue(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // ============ PERIODIC PENDING COUNT UPDATE ============

  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setPendingCount(getPendingCount());
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // ============ AUTO-SYNC ON RECONNECT ============
  // Also periodically try to sync if there are pending items and we think we're online

  useEffect(() => {
    if (!isOnline || isSyncing) return;

    const count = getPendingCount();
    if (count === 0) return;

    // Try to sync pending items periodically (every 30 seconds)
    const interval = setInterval(() => {
      if (mountedRef.current && !isSyncing && getPendingCount() > 0 && isOnline) {
        console.log('[useOfflineSync] Periodic sync attempt...');
        syncNow();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, isSyncing]);

  // ============ SYNC FUNCTION ============

  const syncNow = useCallback(async (): Promise<QueueSyncResult> => {
    if (isSyncing) {
      return { processed: 0, failed: 0, errors: [] };
    }

    const count = getPendingCount();
    if (count === 0) {
      return { processed: 0, failed: 0, errors: [] };
    }

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const result = await processQueue((processed, total) => {
        if (mountedRef.current) {
          setSyncProgress(Math.round((processed / total) * 100));
        }
      });

      if (mountedRef.current) {
        setLastSyncResult(result);
        setPendingCount(getPendingCount());
        setSyncProgress(100);

        if (result.processed > 0) {
          setLastSyncTime(new Date());
          setHasConnectivityIssue(false);
          consecutiveFailsRef.current = 0;
        }

        if (result.failed > 0) {
          console.warn(`[useOfflineSync] ${result.failed} items failed to sync`);
        }
      }

      return result;
    } catch (error) {
      console.error('[useOfflineSync] Sync error:', error);
      if (mountedRef.current) {
        setHasConnectivityIssue(true);
      }
      return { processed: 0, failed: 0, errors: [] };
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        // Reset progress after a short delay
        setTimeout(() => {
          if (mountedRef.current) setSyncProgress(0);
        }, 2000);
      }
    }
  }, [isSyncing]);

  const queueOperation = useCallback(<K extends QueueOperationType>(
    operation: K,
    data: QueueDataMap[K],
    userId?: string,
    label?: string
  ) => {
    enqueue(operation, data, userId, label);
    setPendingCount(getPendingCount());
  }, []);


  // ============ CONNECTIVITY ERROR REPORTING ============

  const reportConnectivityError = useCallback(() => {
    consecutiveFailsRef.current++;
    if (consecutiveFailsRef.current >= 2) {
      // After 2 consecutive connectivity errors, mark as having issues
      setHasConnectivityIssue(true);
    }
  }, []);

  const reportSuccess = useCallback(() => {
    consecutiveFailsRef.current = 0;
    if (hasConnectivityIssue) {
      setHasConnectivityIssue(false);
    }
  }, [hasConnectivityIssue]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncProgress,
    lastSyncResult,
    lastSyncTime,
    syncNow,
    queueOperation,
    hasConnectivityIssue,
    reportConnectivityError,
    reportSuccess,
  };
};
