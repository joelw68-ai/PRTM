import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Cloud,
  CloudOff,
  ChevronDown,
  X
} from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  lastSaveTime: Date | null;
  lastSaveError: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncTime: Date | null;
}

const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  saveStatus,
  lastSaveTime,
  lastSaveError,
  onRetry,
  onRefresh,
  isSyncing,
  syncError,
  lastSyncTime
}) => {
  const [expanded, setExpanded] = useState(false);
  const [relativeTime, setRelativeTime] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update relative time every 10 seconds
  useEffect(() => {
    const updateTime = () => {
      const time = lastSaveTime || lastSyncTime;
      if (!time) {
        setRelativeTime('');
        return;
      }
      const now = new Date();
      const diffMs = now.getTime() - time.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);

      if (diffSec < 5) setRelativeTime('just now');
      else if (diffSec < 60) setRelativeTime(`${diffSec}s ago`);
      else if (diffMin < 60) setRelativeTime(`${diffMin}m ago`);
      else if (diffHr < 24) setRelativeTime(`${diffHr}h ago`);
      else setRelativeTime(time.toLocaleDateString());
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [lastSaveTime, lastSyncTime]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  // Auto-expand briefly on error
  useEffect(() => {
    if (saveStatus === 'error' || syncError) {
      setExpanded(true);
      const timer = setTimeout(() => setExpanded(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, syncError]);

  const hasError = saveStatus === 'error' || !!syncError;
  const isBusy = saveStatus === 'saving' || isSyncing;
  const isSaved = saveStatus === 'saved' || (lastSyncTime && !hasError && !isBusy);

  // Determine the primary display state
  const getStatusDisplay = () => {
    if (isBusy) {
      return {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        text: isSyncing ? 'Syncing...' : 'Saving...',
        colorClasses: 'text-blue-400',
        bgClasses: 'bg-blue-500/10 border-blue-500/30',
        dotColor: 'bg-blue-400'
      };
    }
    if (hasError) {
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        text: 'Save Error',
        colorClasses: 'text-red-400',
        bgClasses: 'bg-red-500/15 border-red-500/40',
        dotColor: 'bg-red-400 animate-pulse'
      };
    }
    if (isSaved) {
      return {
        icon: <Check className="w-3.5 h-3.5" />,
        text: 'Saved',
        colorClasses: 'text-green-400',
        bgClasses: 'bg-green-500/10 border-green-500/30',
        dotColor: 'bg-green-400'
      };
    }
    return {
      icon: <Cloud className="w-3.5 h-3.5" />,
      text: 'Ready',
      colorClasses: 'text-slate-400',
      bgClasses: 'bg-slate-700/50 border-slate-600/30',
      dotColor: 'bg-slate-400'
    };
  };

  const status = getStatusDisplay();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Status Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all duration-300 hover:brightness-110 ${status.bgClasses} ${status.colorClasses}`}
        title={hasError ? (lastSaveError || syncError || 'Save error') : isBusy ? 'Saving data...' : relativeTime ? `Last saved ${relativeTime}` : 'Database status'}
      >
        {/* Status dot for mobile (icon hidden) */}
        <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} sm:hidden flex-shrink-0`} />
        
        {/* Icon for sm+ */}
        <span className="hidden sm:flex items-center">
          {status.icon}
        </span>
        
        {/* Text for md+ */}
        <span className="hidden md:inline whitespace-nowrap">
          {status.text}
        </span>
        
        {/* Relative time for lg+ */}
        {relativeTime && !isBusy && (
          <span className="hidden lg:inline text-[10px] opacity-70 whitespace-nowrap">
            {relativeTime}
          </span>
        )}
        
        <ChevronDown className={`w-3 h-3 hidden sm:block transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Dropdown */}
      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/80">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Database Status</span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Status Details */}
            <div className="p-4 space-y-3">
              {/* Current Save Status */}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${
                  hasError ? 'bg-red-500/20' : isBusy ? 'bg-blue-500/20' : isSaved ? 'bg-green-500/20' : 'bg-slate-700'
                }`}>
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : hasError ? (
                    <CloudOff className="w-4 h-4 text-red-400" />
                  ) : isSaved ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Cloud className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${status.colorClasses}`}>
                    {isBusy ? (isSyncing ? 'Syncing with database...' : 'Saving changes...') :
                     hasError ? 'Save Failed' :
                     isSaved ? 'All changes saved' : 'Connected'}
                  </p>
                  {relativeTime && !isBusy && !hasError && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last saved {relativeTime}
                    </p>
                  )}
                  {(lastSaveTime || lastSyncTime) && !isBusy && !hasError && (
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {(lastSaveTime || lastSyncTime)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Error Details */}
              {hasError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-xs text-red-300 leading-relaxed">
                    {lastSaveError || syncError || 'An error occurred while saving your data.'}
                  </p>
                  <button
                    onClick={() => {
                      onRetry();
                      setExpanded(false);
                    }}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 text-xs font-medium transition-colors w-full justify-center"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Save
                  </button>
                </div>
              )}

              {/* Sync Progress Bar (when saving) */}
              {isBusy && (
                <div className="space-y-1.5">
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Writing to database...
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/50">
              <button
                onClick={() => {
                  onRefresh();
                  setExpanded(false);
                }}
                disabled={isBusy}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync from Database'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
