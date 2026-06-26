import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPartsUsageLog, deletePartsUsage, PartsUsageRecord } from '@/lib/teamMembership';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Database,
  RefreshCw,
  Download,
  Search,
  Package,
  DollarSign,
  Hash,
  Calendar,
  Loader2,
  AlertTriangle,
  Trash2,
  Filter,
  User,
  ArrowDownUp,
} from 'lucide-react';

/**
 * PartsUsageLog — a DATABASE-backed view of every parts usage entry.
 *
 * Unlike the legacy "Parts Usage History" view (which reads from localStorage),
 * this screen pulls directly from the Supabase `parts_usage_log` table via
 * fetchPartsUsageLog(). This is the authoritative source written whenever a
 * maintenance item is completed with parts, or parts are manually deducted.
 *
 * Provides full filtering (search, usage type, date range), sorting, summary
 * stats, CSV export, and per-row delete.
 */

type DateFilterKey = 'all' | '7days' | '30days' | '90days' | '1year';
type SortKey = 'date_desc' | 'date_asc' | 'cost_desc' | 'cost_asc' | 'qty_desc';

const PartsUsageLog: React.FC = () => {
  const { user, isDemoMode } = useAuth();

  const [records, setRecords] = useState<PartsUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPartsUsageLog(user?.id);
      setRecords(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to load parts_usage_log:', e);
      setError(e instanceof Error ? e.message : 'Failed to load parts usage records from the database.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique usage types present in the data (for the type filter)
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.usageType) set.add(r.usageType); });
    return Array.from(set).sort();
  }, [records]);

  // Apply filters + sorting
  const filtered = useMemo(() => {
    let rows = [...records];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        (r.partNumber || '').toLowerCase().includes(term) ||
        (r.partDescription || '').toLowerCase().includes(term) ||
        (r.relatedTitle || '').toLowerCase().includes(term) ||
        (r.recordedBy || '').toLowerCase().includes(term) ||
        (r.notes || '').toLowerCase().includes(term)
      );
    }

    if (typeFilter !== 'all') {
      rows = rows.filter(r => r.usageType === typeFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      switch (dateFilter) {
        case '7days': cutoff.setDate(now.getDate() - 7); break;
        case '30days': cutoff.setDate(now.getDate() - 30); break;
        case '90days': cutoff.setDate(now.getDate() - 90); break;
        case '1year': cutoff.setFullYear(now.getFullYear() - 1); break;
      }
      const cutoffStr = getLocalDateString(cutoff);
      rows = rows.filter(r => (r.usageDate || '') >= cutoffStr);
    }

    rows.sort((a, b) => {
      switch (sortKey) {
        case 'date_asc':
          return parseLocalDate(a.usageDate).getTime() - parseLocalDate(b.usageDate).getTime();
        case 'cost_desc':
          return b.totalCost - a.totalCost;
        case 'cost_asc':
          return a.totalCost - b.totalCost;
        case 'qty_desc':
          return b.quantityUsed - a.quantityUsed;
        case 'date_desc':
        default:
          return parseLocalDate(b.usageDate).getTime() - parseLocalDate(a.usageDate).getTime();
      }
    });

    return rows;
  }, [records, searchTerm, typeFilter, dateFilter, sortKey]);

  // Summary stats reflect the CURRENTLY FILTERED rows
  const stats = useMemo(() => {
    const totalRecords = filtered.length;
    const totalQty = filtered.reduce((s, r) => s + (r.quantityUsed || 0), 0);
    const totalCost = filtered.reduce((s, r) => s + (r.totalCost || 0), 0);
    const uniqueParts = new Set(filtered.map(r => r.partNumber)).size;
    return { totalRecords, totalQty, totalCost, uniqueParts };
  }, [filtered]);

  const handleDelete = async (rec: PartsUsageRecord) => {
    if (!window.confirm(`Delete this usage record for ${rec.partNumber}? This removes it from the database permanently.`)) {
      return;
    }
    setDeletingId(rec.id);
    try {
      await deletePartsUsage(rec.id);
      setRecords(prev => prev.filter(r => r.id !== rec.id));
      toast.success('Usage record deleted from database.');
    } catch (e) {
      console.error('Failed to delete parts usage record:', e);
      toast.error('Could not delete record. Check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      'Date', 'Part Number', 'Description', 'Qty', 'Unit Cost', 'Total Cost',
      'Type', 'Related To', 'Prev On Hand', 'New On Hand', 'Recorded By', 'Notes'
    ];
    const rows = filtered.map(r => [
      r.usageDate, r.partNumber, r.partDescription, r.quantityUsed,
      r.unitCost, r.totalCost, r.usageType, r.relatedTitle || '',
      r.previousOnHand, r.newOnHand, r.recordedBy || '', (r.notes || '').replace(/"/g, "'")
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parts_usage_log_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Database className="w-7 h-7 text-cyan-400" />
              Parts Usage Log
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-slate-400">Every parts usage entry, pulled live from the database</p>
              {lastRefresh && (
                <span className="text-xs text-slate-500">
                  Last loaded: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reload
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Demo mode notice */}
        {isDemoMode && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              You're in demo mode. The database parts usage log is empty for demo sessions — sign in to record and view real usage entries.
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Database className="w-5 h-5 text-cyan-400" />} bg="bg-cyan-500/20" value={stats.totalRecords.toString()} label="Records" />
          <StatCard icon={<Hash className="w-5 h-5 text-orange-400" />} bg="bg-orange-500/20" value={stats.totalQty.toString()} label="Total Qty Used" />
          <StatCard icon={<Package className="w-5 h-5 text-purple-400" />} bg="bg-purple-500/20" value={stats.uniqueParts.toString()} label="Unique Parts" />
          <StatCard icon={<DollarSign className="w-5 h-5 text-green-400" />} bg="bg-green-500/20" value={`$${stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} label="Total Cost" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search part #, description, related item, or who recorded it..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white capitalize"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterKey)}
              className="bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="1year">Last Year</option>
            </select>
          </div>

          <div className="relative">
            <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="cost_desc">Highest Cost</option>
              <option value="cost_asc">Lowest Cost</option>
              <option value="qty_desc">Most Quantity</option>
            </select>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-cyan-400" />
            <p>Loading usage records from the database…</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-300 font-medium mb-1">Could not load parts usage log</p>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <button onClick={loadData} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No usage records found</p>
            <p className="text-sm">
              {records.length === 0
                ? 'Complete a maintenance item with parts (or deduct parts) to populate this log.'
                : 'No records match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 text-left">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Part</th>
                    <th className="px-4 py-3 font-medium text-center">Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Related To</th>
                    <th className="px-4 py-3 font-medium text-center">On Hand</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 align-top">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{r.usageDate}</td>
                      <td className="px-4 py-3">
                        <p className="text-orange-400 font-mono text-xs">{r.partNumber}</p>
                        <p className="text-white">{r.partDescription}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-white font-medium">{r.quantityUsed}</td>
                      <td className="px-4 py-3 text-right text-slate-300">${r.unitCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium">${r.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium capitalize bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          {r.usageType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[220px]">
                        <p className="truncate" title={r.relatedTitle || ''}>{r.relatedTitle || '—'}</p>
                        {r.notes && (
                          <p className="text-xs text-slate-500 truncate" title={r.notes}>{r.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 whitespace-nowrap">
                        {r.previousOnHand} → <span className={r.newOnHand === 0 ? 'text-red-400' : 'text-white'}>{r.newOnHand}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {r.recordedBy || 'System'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete record"
                        >
                          {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-900/40 text-xs text-slate-400 flex items-center justify-between">
              <span>Showing {filtered.length} of {records.length} database records</span>
              <span>Source: parts_usage_log table</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; bg: string; value: string; label: string }> = ({ icon, bg, value, label }) => (
  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  </div>
);

export default PartsUsageLog;
