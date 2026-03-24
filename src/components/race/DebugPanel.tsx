import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Trash2,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Zap,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  ShieldAlert,
} from 'lucide-react';
import * as dbLogger from '@/lib/dbLogger';
import type { DbLogEntry } from '@/lib/dbLogger';
import { supabase } from '@/lib/supabase';
import {
  subscribe as subscribeValidation,
  getWarningCount,
} from '@/lib/validationWarningStore';
import ValidationMonitorTab from './ValidationMonitorTab';

type TabId = 'operations' | 'validation';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('operations');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);
  const [showCount, setShowCount] = useState(10);
  const [entries, setEntries] = useState<DbLogEntry[]>(dbLogger.getEntries());
  const [validationCount, setValidationCount] = useState(getWarningCount());

  // Subscribe to dbLogger updates
  useEffect(() => {
    const unsub = dbLogger.subscribe(() => {
      setEntries(dbLogger.getEntries());
    });
    return unsub;
  }, []);

  // Subscribe to validation warning count
  useEffect(() => {
    const unsub = subscribeValidation(() => {
      setValidationCount(getWarningCount());
    });
    return unsub;
  }, []);

  const visibleEntries = entries.slice(0, showCount);

  // Test database connection
  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const results: string[] = [];

    // Test 1: Basic SELECT
    const readId = dbLogger.logStart(
      'TEST: SELECT engines',
      'test',
      'engines',
      'Testing read access'
    );
    const readStart = performance.now();
    try {
      const { data, error, status, statusText } = await supabase
        .from('engines')
        .select('id, name')
        .limit(3);

      const readDuration = Math.round(performance.now() - readStart);

      if (error) {
        dbLogger.logError(
          readId,
          `${error.message} (code: ${error.code}, hint: ${error.hint || 'none'})`,
          readDuration
        );
        results.push(
          `READ FAILED: ${error.message} | code=${error.code} | hint=${error.hint || 'none'} | status=${status} ${statusText}`
        );
      } else {
        dbLogger.logSuccess(readId, readDuration, `Got ${data?.length || 0} rows`);
        results.push(`READ OK: ${data?.length || 0} rows in ${readDuration}ms`);
        if (data && data.length > 0) {
          results.push(`  Sample: ${JSON.stringify(data[0])}`);
        }
      }
    } catch (err) {
      const readDuration = Math.round(performance.now() - readStart);
      const msg = err instanceof Error ? err.message : String(err);
      dbLogger.logError(readId, msg, readDuration);
      results.push(`READ EXCEPTION: ${msg}`);
    }

    // Test 2: Try a simple upsert with a test row
    const writeId = dbLogger.logStart(
      'TEST: UPSERT engines (test row)',
      'test',
      'engines',
      'Testing write access'
    );
    const writeStart = performance.now();
    try {
      const testPayload = {
        id: '__debug_test__',
        name: `Debug Test ${new Date().toISOString()}`,
        serial_number: 'TEST',
        builder: 'Debug Panel',
        status: 'Ready',
        currently_installed: false,
        total_passes: 0,
        passes_since_rebuild: 0,
      };

      const { error, status, statusText } = await supabase
        .from('engines')
        .upsert(testPayload);

      const writeDuration = Math.round(performance.now() - writeStart);

      if (error) {
        dbLogger.logError(
          writeId,
          `${error.message} (code: ${error.code}, hint: ${error.hint || 'none'})`,
          writeDuration
        );
        results.push(
          `WRITE FAILED: ${error.message} | code=${error.code} | hint=${error.hint || 'none'} | status=${status} ${statusText}`
        );
      } else {
        dbLogger.logSuccess(writeId, writeDuration, 'Test row upserted successfully');
        results.push(`WRITE OK: Test row upserted in ${writeDuration}ms`);

        // Clean up test row
        const { error: delError } = await supabase
          .from('engines')
          .delete()
          .eq('id', '__debug_test__');
        if (delError) {
          results.push(`CLEANUP WARNING: ${delError.message}`);
        } else {
          results.push(`CLEANUP OK: Test row deleted`);
        }
      }
    } catch (err) {
      const writeDuration = Math.round(performance.now() - writeStart);
      const msg = err instanceof Error ? err.message : String(err);
      dbLogger.logError(writeId, msg, writeDuration);
      results.push(`WRITE EXCEPTION: ${msg}`);
    }

    // Test 3: Check auth state
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      results.push(
        `AUTH: ${user ? `Logged in as ${user.email} (${user.id})` : 'Anonymous (no user)'}`
      );
    } catch (err) {
      results.push(
        `AUTH CHECK FAILED: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allPassed =
      results.filter(r => r.includes('FAILED') || r.includes('EXCEPTION'))
        .length === 0;
    setTestResult({
      success: allPassed,
      message: allPassed
        ? 'All tests passed! Database read/write is working.'
        : 'Some tests failed. Check details below.',
      details: results.join('\n'),
    });
    setTesting(false);
  }, []);

  if (!isOpen) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        );
      case 'error':
        return (
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        );
      case 'pending':
        return (
          <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin flex-shrink-0" />
        );
      default:
        return (
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        );
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'read':
        return 'text-blue-400 bg-blue-400/10';
      case 'write':
        return 'text-emerald-400 bg-emerald-400/10';
      case 'delete':
        return 'text-red-400 bg-red-400/10';
      case 'test':
        return 'text-purple-400 bg-purple-400/10';
      case 'sync':
        return 'text-orange-400 bg-orange-400/10';
      default:
        return 'text-slate-400 bg-slate-400/10';
    }
  };

  const formatTime = (date: Date) => {
    return (
      date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '.' +
      String(date.getMilliseconds()).padStart(3, '0')
    );
  };

  const successCount = entries.filter(e => e.status === 'success').length;
  const errorCount = entries.filter(e => e.status === 'error').length;
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-950 border-t-2 border-orange-500/50 shadow-2xl shadow-black/50 max-h-[60vh] flex flex-col">
      {/* ================================================================ */}
      {/* Header                                                          */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-orange-400 tracking-wide uppercase">
              Debug Panel
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-slate-800/60 rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'operations'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Database className="w-3 h-3" />
              DB Operations
              <span
                className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === 'operations'
                    ? 'bg-slate-600 text-slate-200'
                    : 'bg-slate-700/50 text-slate-500'
                }`}
              >
                {entries.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'validation'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              Validation Monitor
              {validationCount > 0 && (
                <span
                  className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === 'validation'
                      ? 'bg-amber-500/30 text-amber-200'
                      : 'bg-amber-500/20 text-amber-400 animate-pulse'
                  }`}
                >
                  {validationCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick stats (only for operations tab) */}
          {activeTab === 'operations' && (
            <div className="flex items-center gap-2 text-xs ml-2">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" /> {successCount}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" /> {errorCount}
              </span>
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> {pendingCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'operations' && (
            <>
              <button
                onClick={testConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                Test DB
              </button>
              <button
                onClick={() => dbLogger.clearEntries()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Tab Content                                                      */}
      {/* ================================================================ */}

      {activeTab === 'validation' && <ValidationMonitorTab />}

      {activeTab === 'operations' && (
        <>
          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`px-4 py-2 text-xs border-b flex-shrink-0 ${
                testResult.success
                  ? 'bg-green-900/30 border-green-700/50 text-green-300'
                  : 'bg-red-900/30 border-red-700/50 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {testResult.success ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                <span className="font-semibold">{testResult.message}</span>
                <button
                  onClick={() => setTestResult(null)}
                  className="ml-auto text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {testResult.details && (
                <pre className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap opacity-80 mt-1 pl-5">
                  {testResult.details}
                </pre>
              )}
            </div>
          )}

          {/* Log Entries */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {visibleEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Database className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No database operations logged yet.</p>
                <p className="text-xs mt-1">
                  Operations will appear here as they happen.
                </p>
                <button
                  onClick={testConnection}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Run Connection Test
                </button>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                  <tr className="text-slate-400 border-b border-slate-700/50">
                    <th className="text-left py-1.5 px-3 w-8">#</th>
                    <th className="text-left py-1.5 px-2 w-24">Time</th>
                    <th className="text-left py-1.5 px-2 w-16">Type</th>
                    <th className="text-left py-1.5 px-2 w-12">Status</th>
                    <th className="text-left py-1.5 px-2">Operation</th>
                    <th className="text-right py-1.5 px-3 w-16">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map(entry => {
                    const isExpanded = expanded === entry.id;
                    const hasError = entry.status === 'error';
                    const hasDetails =
                      entry.details || entry.errorMessage || entry.table;

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                            hasError
                              ? 'bg-red-950/20 hover:bg-red-950/30'
                              : 'hover:bg-slate-800/30'
                          } ${
                            isExpanded
                              ? hasError
                                ? 'bg-red-950/30'
                                : 'bg-slate-800/40'
                              : ''
                          }`}
                          onClick={() =>
                            hasDetails
                              ? setExpanded(isExpanded ? null : entry.id)
                              : null
                          }
                        >
                          <td className="py-1.5 px-3 text-slate-600 font-mono">
                            {entry.id}
                          </td>
                          <td className="py-1.5 px-2 text-slate-400 font-mono whitespace-nowrap">
                            {formatTime(entry.timestamp)}
                          </td>
                          <td className="py-1.5 px-2">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${typeColor(
                                entry.type
                              )}`}
                            >
                              {entry.type}
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              {statusIcon(entry.status)}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-slate-200 font-mono truncate max-w-[400px]">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">
                                {entry.operation}
                              </span>
                              {hasError && entry.errorMessage && (
                                <span className="text-red-400 truncate text-[10px] opacity-70">
                                  — {entry.errorMessage.slice(0, 60)}
                                </span>
                              )}
                              {hasDetails &&
                                (isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                ))}
                            </div>
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-500 font-mono whitespace-nowrap">
                            {entry.durationMs !== undefined
                              ? `${entry.durationMs}ms`
                              : '—'}
                          </td>
                        </tr>
                        {isExpanded && hasDetails && (
                          <tr
                            className={
                              hasError ? 'bg-red-950/10' : 'bg-slate-800/20'
                            }
                          >
                            <td colSpan={6} className="px-6 py-2">
                              <div className="space-y-1">
                                {entry.table && (
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 w-14">
                                      Table:
                                    </span>
                                    <span className="text-slate-300 font-mono">
                                      {entry.table}
                                    </span>
                                  </div>
                                )}
                                {entry.details && (
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 w-14">
                                      Details:
                                    </span>
                                    <span className="text-slate-300 font-mono whitespace-pre-wrap">
                                      {entry.details}
                                    </span>
                                  </div>
                                )}
                                {entry.errorMessage && (
                                  <div className="flex gap-2">
                                    <span className="text-red-500 w-14">
                                      Error:
                                    </span>
                                    <span className="text-red-300 font-mono whitespace-pre-wrap break-all">
                                      {entry.errorMessage}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {entries.length > showCount && (
              <div className="flex justify-center py-2 border-t border-slate-800/50">
                <button
                  onClick={() => setShowCount(prev => prev + 10)}
                  className="text-xs text-slate-400 hover:text-orange-400 transition-colors"
                >
                  Show more ({entries.length - showCount} hidden)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DebugPanel;
