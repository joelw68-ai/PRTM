import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { WifiOff, RefreshCw, CloudOff, Cloud, Loader2 } from 'lucide-react';

interface OfflineSyncBannerProps {
  /** Module label shown in the banner, e.g. "Pass Log" */
  moduleLabel?: string;
}

/**
 * Shared offline-sync status banner.
 * Reads global offline state from AppContext and renders:
 *  - A yellow/orange bar when there are pending queued operations
 *  - A red bar when the app detects a connectivity issue
 *  - A "Sync Now" button to manually flush the queue
 *  - Nothing when everything is online and the queue is empty
 */
const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({ moduleLabel }) => {
  const {
    isOnline,
    pendingOfflineCount,
    hasConnectivityIssue,
    isOfflineSyncing,
    offlineSyncProgress,
    syncOfflineQueue,
  } = useApp();

  // Nothing to show when online with no pending items and no issues
  if (isOnline && pendingOfflineCount === 0 && !hasConnectivityIssue && !isOfflineSyncing) {
    return null;
  }

  const handleSyncNow = async () => {
    try {
      await syncOfflineQueue();
    } catch {
      // Errors are handled inside syncOfflineQueue
    }
  };

  // Currently syncing
  if (isOfflineSyncing) {
    return (
      <div className="flex items-center justify-between p-3 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl animate-pulse">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <div>
            <p className="text-blue-400 font-medium text-sm">
              Syncing {moduleLabel ? `${moduleLabel} ` : ''}changes...
            </p>
            {offlineSyncProgress > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-32 h-1.5 bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-300"
                    style={{ width: `${offlineSyncProgress}%` }}
                  />
                </div>
                <span className="text-xs text-blue-300">{offlineSyncProgress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Offline or connectivity issue
  if (!isOnline || hasConnectivityIssue) {
    return (
      <div className="flex items-center justify-between p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-red-400 font-medium text-sm">
              {!isOnline ? 'You are offline' : 'Connection issue detected'}
            </p>
            <p className="text-red-300/70 text-xs">
              {pendingOfflineCount > 0
                ? `${pendingOfflineCount} change${pendingOfflineCount !== 1 ? 's' : ''} saved locally — will sync when connection is restored`
                : 'Changes will be saved locally until connection is restored'}
            </p>
          </div>
        </div>
        {pendingOfflineCount > 0 && (
          <button
            onClick={handleSyncNow}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Sync
          </button>
        )}
      </div>
    );
  }

  // Online but has pending items (queue not yet flushed)
  if (pendingOfflineCount > 0) {
    return (
      <div className="flex items-center justify-between p-3 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <CloudOff className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-amber-400 font-medium text-sm">
              {pendingOfflineCount} pending change{pendingOfflineCount !== 1 ? 's' : ''}
            </p>
            <p className="text-amber-300/70 text-xs">
              {moduleLabel ? `${moduleLabel} has` : 'There are'} offline changes waiting to sync
            </p>
          </div>
        </div>
        <button
          onClick={handleSyncNow}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors whitespace-nowrap"
        >
          <RefreshCw className="w-4 h-4" />
          Sync Now
        </button>
      </div>
    );
  }

  return null;
};

export default OfflineSyncBanner;
