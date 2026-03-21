import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Database,
  Shield,
  ChevronDown,
  ChevronRight,
  Wrench,
  Table2,
  FileWarning,
  Link2Off,
  Calendar,
  Hash,
  DollarSign,
  Info,
  Zap,
  ArrowRight,
  Clock,
  BarChart3,
  Server,
  ChevronUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface HealthCheckIssue {
  id: string;
  category: string;
  severity: 'red' | 'yellow' | 'green';
  table: string;
  title: string;
  description: string;
  count: number;
  fixable: boolean;
  fixType?: string;
  details?: any[];
}

interface HealthCheckSummary {
  totalTables: number;
  accessibleTables: number;
  totalRecords: number;
  issuesFound: number;
  critical: number;
  warnings: number;
  healthy: number;
  fixableIssues: number;
}

interface HealthCheckResult {
  timestamp: string;
  userId: string;
  userEmail: string;
  summary: HealthCheckSummary;
  tableCounts: Record<string, number>;
  checks: HealthCheckIssue[];
}

// ── Category metadata ────────────────────────────────────────
const categoryMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  orphaned_records: { label: 'Orphaned Records', icon: <Link2Off className="w-4 h-4" />, color: 'text-red-400' },
  null_fields: { label: 'Null Required Fields', icon: <FileWarning className="w-4 h-4" />, color: 'text-amber-400' },
  future_dates: { label: 'Future Dates', icon: <Calendar className="w-4 h-4" />, color: 'text-amber-400' },
  pass_inconsistency: { label: 'Pass Count Issues', icon: <Hash className="w-4 h-4" />, color: 'text-red-400' },
  sfi_status: { label: 'SFI Cert Status', icon: <Shield className="w-4 h-4" />, color: 'text-red-400' },
  value_mismatch: { label: 'Value Mismatches', icon: <DollarSign className="w-4 h-4" />, color: 'text-amber-400' },
  empty_tables: { label: 'Empty Tables', icon: <Table2 className="w-4 h-4" />, color: 'text-amber-400' },
  missing_tables: { label: 'Missing Tables', icon: <Database className="w-4 h-4" />, color: 'text-red-400' },
};

// ── Component ────────────────────────────────────────────────
const DatabaseHealthCheck: React.FC = () => {
  const { session, demoMode } = useAuth();
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, { fixed: number; errors: string[] }>>({});
  const [showTableCounts, setShowTableCounts] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(
    () => localStorage.getItem('db-health-check-last')
  );

  const runHealthCheck = useCallback(async () => {
    if (demoMode) {
      setError('Health check requires an authenticated database connection. Not available in demo mode.');
      return;
    }
    if (!session) {
      setError('You must be logged in to run a health check.');
      return;
    }

    setLoading(true);
    setError(null);
    setFixResults({});

    try {
      const { data, error: fnError } = await supabase.functions.invoke('db-health-check', {
        body: { action: 'check' },
      });

      if (fnError) throw new Error(fnError.message || 'Edge function error');
      if (data?.error) throw new Error(data.error);

      setResult(data as HealthCheckResult);
      const now = new Date().toISOString();
      setLastCheckTime(now);
      localStorage.setItem('db-health-check-last', now);

      // Auto-expand categories with issues
      const cats = new Set<string>();
      (data as HealthCheckResult).checks.forEach(c => {
        if (c.severity === 'red') cats.add(c.category);
      });
      setExpandedCategories(cats);
    } catch (err) {
      console.error('Health check error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [session, demoMode]);

  const handleFix = useCallback(async (fixType: string, issueId: string) => {
    if (!session) return;
    setFixingIssue(issueId);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('db-health-check', {
        body: { action: 'fix', fixType },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setFixResults(prev => ({
        ...prev,
        [issueId]: { fixed: data.fixed || 0, errors: data.errors || [] },
      }));

      // Re-run health check after fix
      setTimeout(() => runHealthCheck(), 1500);
    } catch (err) {
      setFixResults(prev => ({
        ...prev,
        [issueId]: { fixed: 0, errors: [err instanceof Error ? err.message : 'Fix failed'] },
      }));
    } finally {
      setFixingIssue(null);
    }
  }, [session, runHealthCheck]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group checks by category
  const grouped = result?.checks.reduce<Record<string, HealthCheckIssue[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {}) || {};

  const severityBadge = (severity: 'red' | 'yellow' | 'green') => {
    switch (severity) {
      case 'red':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" /> Critical
          </span>
        );
      case 'yellow':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle2 className="w-3 h-3" /> OK
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-emerald-900/30 rounded-xl border border-slate-700/50 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Database Health Check</h3>
                <p className="text-sm text-slate-400">
                  Validate all 39 tables for integrity issues
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
              39 TABLES
            </span>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Scans for orphaned records, null required fields, future dates, pass count inconsistencies,
            expired SFI certs, value mismatches, and empty core tables. Fixable issues include one-click
            repair buttons.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Health Check
                </>
              )}
            </button>

            {lastCheckTime && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last check: {new Date(lastCheckTime).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-300 font-medium">Health check failed</p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !result && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-white font-medium text-lg">Scanning 39 tables...</p>
          <p className="text-slate-400 text-sm mt-1">
            Checking foreign keys, required fields, date validity, pass counts, SFI certs, and more
          </p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-slate-400" />
                <p className="text-sm text-slate-400">Tables Scanned</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {result.summary.accessibleTables}
                <span className="text-sm text-slate-500 font-normal">/{result.summary.totalTables}</span>
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <p className="text-sm text-slate-400">Total Records</p>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {result.summary.totalRecords.toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-slate-400">Critical Issues</p>
              </div>
              <p className={`text-2xl font-bold ${result.summary.critical > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {result.summary.critical}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-sm text-slate-400">Warnings</p>
              </div>
              <p className={`text-2xl font-bold ${result.summary.warnings > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {result.summary.warnings}
              </p>
            </div>
          </div>

          {/* Overall Status Banner */}
          {result.summary.issuesFound === 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-xl font-bold text-emerald-300">All Clear!</h4>
              <p className="text-emerald-400/80 text-sm mt-1">
                No integrity issues found across {result.summary.accessibleTables} tables
                and {result.summary.totalRecords.toLocaleString()} records.
              </p>
            </div>
          ) : (
            <div className={`rounded-xl p-4 border flex items-center gap-4 ${
              result.summary.critical > 0
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              {result.summary.critical > 0 ? (
                <XCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${result.summary.critical > 0 ? 'text-red-300' : 'text-amber-300'}`}>
                  {result.summary.issuesFound} issue{result.summary.issuesFound !== 1 ? 's' : ''} found
                </p>
                <p className="text-sm text-slate-400">
                  {result.summary.critical} critical, {result.summary.warnings} warnings
                  {result.summary.fixableIssues > 0 && (
                    <> — <span className="text-emerald-400 font-medium">{result.summary.fixableIssues} auto-fixable</span></>
                  )}
                </p>
              </div>
              {result.summary.fixableIssues > 0 && (
                <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  {result.summary.fixableIssues} fixable
                </span>
              )}
            </div>
          )}

          {/* Issue Categories */}
          {Object.keys(grouped).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Issues by Category
              </h4>
              {Object.entries(grouped).map(([cat, issues]) => {
                const meta = categoryMeta[cat] || {
                  label: cat.replace(/_/g, ' '),
                  icon: <Info className="w-4 h-4" />,
                  color: 'text-slate-400',
                };
                const isExpanded = expandedCategories.has(cat);
                const hasCritical = issues.some(i => i.severity === 'red');
                const hasFixable = issues.some(i => i.fixable);

                return (
                  <div
                    key={cat}
                    className={`bg-slate-800/50 rounded-xl border transition-colors ${
                      hasCritical ? 'border-red-500/30' : 'border-slate-700/50'
                    }`}
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/20 transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${
                          hasCritical ? 'bg-red-500/20' : 'bg-amber-500/20'
                        }`}>
                          <span className={meta.color}>{meta.icon}</span>
                        </div>
                        <div>
                          <span className="text-white font-medium">{meta.label}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {issues.length} issue{issues.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasFixable && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
                            Fixable
                          </span>
                        )}
                        {issues.some(i => i.severity === 'red') && (
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Issues List */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {issues.map(issue => {
                          const isIssueExpanded = expandedIssues.has(issue.id);
                          const fr = fixResults[issue.id];

                          return (
                            <div
                              key={issue.id}
                              className={`rounded-lg border p-3 ${
                                issue.severity === 'red'
                                  ? 'bg-red-500/5 border-red-500/20'
                                  : 'bg-amber-500/5 border-amber-500/20'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {severityBadge(issue.severity)}
                                    <span className="text-xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                                      {issue.table}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {issue.count} record{issue.count !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <p className="text-white font-medium mt-1.5 text-sm">
                                    {issue.title}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {issue.description}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {issue.fixable && issue.fixType && (
                                    <button
                                      onClick={() => handleFix(issue.fixType!, issue.id)}
                                      disabled={fixingIssue === issue.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50 border border-emerald-500/30"
                                    >
                                      {fixingIssue === issue.id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Fixing...
                                        </>
                                      ) : (
                                        <>
                                          <Wrench className="w-3.5 h-3.5" />
                                          Auto-Fix
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {issue.details && issue.details.length > 0 && (
                                    <button
                                      onClick={() => toggleIssue(issue.id)}
                                      className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                      title="View details"
                                    >
                                      {isIssueExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Fix Result */}
                              {fr && (
                                <div className={`mt-2 p-2 rounded text-xs ${
                                  fr.errors.length > 0
                                    ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                }`}>
                                  {fr.fixed > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Fixed {fr.fixed} record{fr.fixed !== 1 ? 's' : ''}. Re-running health check...
                                    </div>
                                  )}
                                  {fr.fixed === 0 && fr.errors.length === 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5" />
                                      No records needed fixing.
                                    </div>
                                  )}
                                  {fr.errors.length > 0 && (
                                    <div>
                                      <p className="font-medium">Errors:</p>
                                      {fr.errors.map((e, i) => (
                                        <p key={i} className="ml-2">{e}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Expanded Details */}
                              {isIssueExpanded && issue.details && (
                                <div className="mt-2 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                  <p className="text-xs text-slate-400 mb-2 font-medium">
                                    Affected Records (showing up to 10):
                                  </p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-700">
                                          {Object.keys(issue.details[0] || {}).map(key => (
                                            <th
                                              key={key}
                                              className="text-left py-1.5 px-2 text-slate-400 font-medium"
                                            >
                                              {key}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {issue.details.map((row, idx) => (
                                          <tr
                                            key={idx}
                                            className="border-b border-slate-800 last:border-0"
                                          >
                                            {Object.values(row).map((val, ci) => (
                                              <td
                                                key={ci}
                                                className="py-1.5 px-2 text-slate-300 font-mono"
                                              >
                                                {val === null ? (
                                                  <span className="text-slate-600 italic">null</span>
                                                ) : typeof val === 'number' ? (
                                                  String(val)
                                                ) : (
                                                  String(val)
                                                )}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Table Row Counts */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setShowTableCounts(!showTableCounts)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/20 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Table2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-white font-medium">Table Row Counts</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {result.summary.accessibleTables} tables, {result.summary.totalRecords.toLocaleString()} total rows
                  </span>
                </div>
              </div>
              {showTableCounts ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTableCounts && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(result.tableCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([table, count]) => {
                      const hasIssue = result.checks.some(c => c.table === table);
                      const isMissing = count === -1;

                      return (
                        <div
                          key={table}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                            isMissing
                              ? 'bg-red-500/5 border-red-500/20'
                              : hasIssue
                                ? 'bg-amber-500/5 border-amber-500/20'
                                : count === 0
                                  ? 'bg-slate-900/30 border-slate-700/30'
                                  : 'bg-slate-900/50 border-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isMissing ? (
                              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            ) : hasIssue ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            ) : count > 0 ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0" />
                            )}
                            <span className="font-mono text-xs text-slate-300 truncate">
                              {table}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xs font-bold flex-shrink-0 ml-2 ${
                              isMissing
                                ? 'text-red-400'
                                : count === 0
                                  ? 'text-slate-500'
                                  : 'text-white'
                            }`}
                          >
                            {isMissing ? 'N/A' : count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Validation Checks Legend */}
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Checks Performed
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: <Link2Off className="w-3.5 h-3.5" />, label: 'Orphaned FK Records', desc: 'pass_logs → engines, cylinder_heads → engines, etc.' },
                { icon: <FileWarning className="w-3.5 h-3.5" />, label: 'Null Required Fields', desc: '13 critical fields across 8 tables' },
                { icon: <Calendar className="w-3.5 h-3.5" />, label: 'Future Date Detection', desc: 'Pass logs and maintenance with future dates' },
                { icon: <Hash className="w-3.5 h-3.5" />, label: 'Pass Count Consistency', desc: 'current_passes vs next_service_passes' },
                { icon: <Shield className="w-3.5 h-3.5" />, label: 'SFI Cert Expiration', desc: 'Expired certs not marked, 30-day warnings' },
                { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Value Calculations', desc: 'total_value = on_hand × unit_cost' },
                { icon: <Table2 className="w-3.5 h-3.5" />, label: 'Empty Core Tables', desc: '6 core tables checked for zero rows' },
                { icon: <Database className="w-3.5 h-3.5" />, label: 'Table Accessibility', desc: 'All 39 tables queried for existence' },
              ].map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">{check.icon}</span>
                  <div>
                    <p className="text-xs text-slate-300 font-medium">{check.label}</p>
                    <p className="text-[10px] text-slate-500">{check.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DatabaseHealthCheck;
