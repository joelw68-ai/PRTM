import React, { useState, useEffect, useCallback } from 'react';
import {
  getSyncHistory,
  clearSyncHistory,
  getAllModuleLabels,
  getSyncHistoryStats,
  getRetryQueue,
  clearRetryQueue,
  getRetryQueueCount,
  calculateBackoffDelay,
  type SyncEvent,
  type SyncEventStatus,
  type RetryQueueItem,
} from '@/lib/syncHistory';
import { getPendingCount } from '@/lib/offlineQueue';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Download,
  AlertTriangle,
  ArrowUpDown,
  RotateCcw,
  Wifi,
  WifiOff,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

/**
 * Format a relative time string from an ISO timestamp.
 */
const formatTimeAgo = (isoTimestamp: string): string => {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

/**
 * Format a timestamp for display in the table.
 */
const formatTimestamp = (isoTimestamp: string): string => {
  try {
    const d = new Date(isoTimestamp);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoTimestamp;
  }
};

const SyncHistoryTab: React.FC = () => {
  const { isOnline, isSyncing, syncNow, pendingCount } = useOfflineSync();

  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [retryQueue, setRetryQueue] = useState<RetryQueueItem[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<SyncEventStatus | ''>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showRetryQueue, setShowRetryQueue] = useState(false);
  const [stats, setStats] = useState<ReturnType<typeof getSyncHistoryStats> | null>(null);

  const moduleLabels = getAllModuleLabels();

  const refreshData = useCallback(() => {
    setEvents(getSyncHistory());
    setRetryQueue(getRetryQueue());
    setStats(getSyncHistoryStats());
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Apply filters
  const filteredEvents = events.filter(event => {
    if (moduleFilter && event.moduleLabel !== moduleFilter) return false;
    if (statusFilter && event.status !== statusFilter) return false;
    return true;
  });

  // Apply sort
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
  });

  const handleClearHistory = () => {
    if (confirm('Clear all sync history? This cannot be undone.')) {
      clearSyncHistory();
      refreshData();
    }
  };

  const handleClearRetryQueue = () => {
    if (confirm('Clear the retry queue? Failed items will not be retried.')) {
      clearRetryQueue();
      refreshData();
    }
  };

  const handleSyncNow = async () => {
    await syncNow();
    // Small delay to let sync history populate
    setTimeout(refreshData, 500);
  };

  const handleExportHistory = () => {
    const csvContent = [
      ['Timestamp', 'Module', 'Operation', 'Status', 'Retry Count', 'Error Message', 'Item Label'].join(','),
      ...events.map(e => [
        e.timestamp,
        e.moduleLabel,
        e.operationType,
        e.status,
        e.retryCount,
        `"${(e.errorMessage || '').replace(/"/g, '""')}"`,
        `"${(e.itemLabel || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = stats?.successes ?? 0;
  const failureCount = stats?.failures ?? 0;
  const retryQueueCount = retryQueue.length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-sm">Total Events</p>
          <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-sm">Successes</p>
          <p className="text-2xl font-bold text-green-400">{successCount}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-sm">Failures</p>
          <p className="text-2xl font-bold text-red-400">{failureCount}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-sm">Pending Queue</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <p className="text-slate-400 text-sm">Backoff Retry</p>
          <p className="text-2xl font-bold text-orange-400">{retryQueueCount}</p>
        </div>
      </div>

      {/* Connection Status & Actions */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
              isOnline
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {stats?.lastSyncTime && (
              <span className="text-sm text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last sync: {formatTimeAgo(stats.lastSyncTime)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || (!isOnline && pendingCount === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleExportHistory}
              disabled={events.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleClearHistory}
              disabled={events.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Backoff Retry Queue (collapsible) */}
      {retryQueueCount > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-orange-500/30 overflow-hidden">
          <button
            onClick={() => setShowRetryQueue(!showRetryQueue)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <RotateCcw className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-left">
                <h3 className="text-white font-semibold">
                  Exponential Backoff Retry Queue ({retryQueueCount} item{retryQueueCount !== 1 ? 's' : ''})
                </h3>
                <p className="text-xs text-slate-400">
                  Items that exhausted main queue retries. Max 3 additional attempts with exponential backoff.
                </p>
              </div>
            </div>
            {showRetryQueue ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showRetryQueue && (
            <div className="border-t border-slate-700/50">
              <div className="p-4 space-y-2">
                {retryQueue.map((item) => {
                  const nextRetryIn = Math.max(0, item.nextRetryAfter - Date.now());
                  const isReady = nextRetryIn === 0;

                  return (
                    <div
                      key={item.originalQueueItemId}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.operationType} — Backoff retry {item.backoffRetryCount}/{item.maxBackoffRetries}
                        </p>
                        <p className="text-xs text-red-400/80 mt-0.5 truncate">{item.lastError}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        {isReady ? (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded font-medium">
                            Ready to retry
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded font-medium">
                            Next retry in {Math.ceil(nextRetryIn / 1000)}s
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-slate-700/50 flex justify-end">
                <button
                  onClick={handleClearRetryQueue}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Retry Queue
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Module Breakdown */}
      {stats && Object.keys(stats.byModule).length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            Sync Events by Module
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.entries(stats.byModule)
              .sort((a, b) => (b[1].success + b[1].failed) - (a[1].success + a[1].failed))
              .map(([module, counts]) => (
                <button
                  key={module}
                  onClick={() => setModuleFilter(moduleFilter === module ? '' : module)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    moduleFilter === module
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs text-slate-400 truncate">{module}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-green-400 font-medium">{counts.success}</span>
                    <span className="text-xs text-slate-600">/</span>
                    <span className="text-xs text-red-400 font-medium">{counts.failed}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Filter className="w-4 h-4" />
            Filters:
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All Modules</option>
            {moduleLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SyncEventStatus | '')}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
          {(moduleFilter || statusFilter) && (
            <button
              onClick={() => { setModuleFilter(''); setStatusFilter(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-orange-400 hover:text-orange-300 text-sm transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="text-sm text-slate-500 ml-auto">
            {sortedEvents.length} of {events.length} events
          </span>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-orange-400" />
            Sync Event Log
          </h3>
          <button
            onClick={refreshData}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No sync events recorded</p>
            <p className="text-sm text-slate-500 mt-1">
              {events.length === 0
                ? 'Sync events will appear here when offline queue items are processed.'
                : 'No events match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Module</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Operation</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Retries</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    {/* Status Badge */}
                    <td className="px-4 py-3">
                      {event.status === 'success' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{formatTimestamp(event.timestamp)}</div>
                      <div className="text-xs text-slate-500">{formatTimeAgo(event.timestamp)}</div>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                        {event.moduleLabel}
                      </span>
                    </td>

                    {/* Operation */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-300 font-mono">{event.operationType}</div>
                      {event.itemLabel && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{event.itemLabel}</div>
                      )}
                    </td>

                    {/* Retry Count */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        event.retryCount === 0 ? 'text-slate-400' :
                        event.retryCount <= 2 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {event.retryCount}
                      </span>
                    </td>

                    {/* Error Message */}
                    <td className="px-4 py-3">
                      {event.errorMessage ? (
                        <div className="text-xs text-red-400/80 max-w-[300px] truncate" title={event.errorMessage}>
                          {event.errorMessage}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        {sortedEvents.length > 0 && (
          <div className="p-3 border-t border-slate-700/50 bg-slate-900/30 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {sortedEvents.length} of {events.length} events (max {50} stored)
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                {filteredEvents.filter(e => e.status === 'success').length} success
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" />
                {filteredEvents.filter(e => e.status === 'failed').length} failed
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncHistoryTab;
