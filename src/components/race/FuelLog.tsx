import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import DateInputDark from '@/components/ui/DateInputDark';
import { CrewRole } from '@/lib/permissions';
import { FuelLogEntry, fetchFuelLogs, upsertFuelLog, deleteFuelLog } from '@/lib/database';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getFuelLogPendingCount } from '@/lib/offlineQueue';
import {
  Fuel,
  Plus,
  X,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Droplets,
  BarChart3,
  Calendar,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowUpDown,
  Gauge,
  Target,
  Activity,
  FileText,
  MapPin,
  Clock,
  Info,
  Users,
  User,
  RefreshCw,
  CloudOff,
  Cloud
} from 'lucide-react';

// Re-export FuelLogEntry so any existing imports from this file still work
export type { FuelLogEntry } from '@/lib/database';

interface FuelLogProps {
  currentRole?: CrewRole;
}


// ============ LOCAL STORAGE HELPERS (offline fallback) ============

const STORAGE_KEY = 'fuel_log_entries';

const loadFuelLogsFromLocalStorage = (): FuelLogEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveFuelLogsToLocalStorage = (entries: FuelLogEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save fuel logs to localStorage:', e);
  }
};


// ============ MINI BAR CHART COMPONENT ============

const MiniBarChart: React.FC<{ data: { label: string; value: number; color?: string }[]; maxHeight?: number; showLabels?: boolean }> = ({ 
  data, maxHeight = 120, showLabels = true 
}) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="flex items-end gap-1.5" style={{ height: maxHeight }}>
      {data.map((item, idx) => {
        const barHeight = Math.max((item.value / maxVal) * (maxHeight - 20), 4);
        return (
          <div key={idx} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="relative group w-full flex justify-center">
              <div
                className={`w-full max-w-[32px] rounded-t-sm transition-all hover:opacity-80 ${item.color || 'bg-orange-500'}`}
                style={{ height: barHeight }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                ${item.value.toFixed(2)}
              </div>
            </div>
            {showLabels && (
              <span className="text-[9px] text-slate-500 truncate w-full text-center leading-tight">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============ TREND LINE CHART COMPONENT ============

const TrendLineChart: React.FC<{ 
  data: { label: string; value: number }[]; 
  height?: number;
  color?: string;
  fillColor?: string;
  unit?: string;
}> = ({ data, height = 140, color = '#f97316', fillColor = 'rgba(249,115,22,0.1)', unit = '$' }) => {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
        Need at least 2 entries for trend
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const range = maxVal - minVal || 1;
  const padding = 30;
  const chartHeight = height - padding;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = chartHeight - ((d.value - minVal) / range) * (chartHeight - 20) - 10;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPathD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 100 ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Fill area */}
        <path d={fillPathD} fill={fillColor} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} className="hover:r-3 transition-all" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
        {data.length <= 8 ? data.map((d, i) => (
          <span key={i} className="text-[9px] text-slate-500">{d.label}</span>
        )) : (
          <>
            <span className="text-[9px] text-slate-500">{data[0].label}</span>
            <span className="text-[9px] text-slate-500">{data[Math.floor(data.length / 2)].label}</span>
            <span className="text-[9px] text-slate-500">{data[data.length - 1].label}</span>
          </>
        )}
      </div>
      {/* Y-axis labels */}
      <div className="absolute top-0 left-0 bottom-6 flex flex-col justify-between pointer-events-none">
        <span className="text-[9px] text-slate-500">{unit}{maxVal.toFixed(2)}</span>
        <span className="text-[9px] text-slate-500">{unit}{minVal.toFixed(2)}</span>
      </div>
    </div>
  );
};


// ============ MAIN COMPONENT ============

const FuelLog: React.FC<FuelLogProps> = ({ currentRole = 'Crew' }) => {
  const { raceEvents, passLogs } = useApp();
  const { user, isDemoMode, activeTeamMembership, effectiveUserId, isTeamMember } = useAuth();
  const hasFetchedRef = useRef(false);
  const lastViewModeRef = useRef<string | null>(null);

  // ============ OFFLINE SYNC HOOK ============
  const {
    isOnline,
    pendingCount: globalPendingCount,
    isSyncing,
    syncNow,
    queueOperation,
    reportConnectivityError,
    reportSuccess,
    hasConnectivityIssue,
  } = useOfflineSync();

  // Fuel-log-specific pending count (refreshed periodically)
  const [fuelPendingCount, setFuelPendingCount] = useState<number>(() => getFuelLogPendingCount());
  const pendingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh fuel-log pending count every 3 seconds and after sync
  useEffect(() => {
    const refresh = () => setFuelPendingCount(getFuelLogPendingCount());
    refresh();
    pendingIntervalRef.current = setInterval(refresh, 3000);
    return () => { if (pendingIntervalRef.current) clearInterval(pendingIntervalRef.current); };
  }, [isSyncing]); // re-run after sync finishes to update count

  // State — initialise from localStorage for instant render
  const [entries, setEntries] = useState<FuelLogEntry[]>(() => loadFuelLogsFromLocalStorage());
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FuelLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFuelType, setFilterFuelType] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'totalCost' | 'gallonsPurchased'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'log' | 'analytics'>('log');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // ============ TEAM VIEW MODE ============
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my');
  const teamId = effectiveUserId || user?.id;

  // Form state
  const [formData, setFormData] = useState<Partial<FuelLogEntry>>({
    date: new Date().toISOString().split('T')[0],
    gallonsPurchased: undefined,
    costPerGallon: undefined,
    vendor: '',
    fuelType: 'Methanol',
    linkedEventId: '',
    gallonsUsed: undefined,
    passesAtEvent: undefined,
    notes: '',
    receiptNumber: ''
  });

  // ============ DATABASE FETCH ============
  const loadFromDb = useCallback(async () => {
    if (isDemoMode) return;
    setIsDbLoading(true);
    try {
      let dbEntries: FuelLogEntry[];
      if (viewMode === 'team' && teamId) {
        dbEntries = await fetchFuelLogs(undefined, teamId);
      } else {
        dbEntries = await fetchFuelLogs(user?.id);
      }
      setEntries(dbEntries);
      if (viewMode === 'my') {
        saveFuelLogsToLocalStorage(dbEntries);
      }
      reportSuccess();
      console.log(`[FuelLog] Loaded ${dbEntries.length} entries from database (viewMode=${viewMode})`);

      // ── Auto-replay queued operations on successful DB connection ──
      const pending = getFuelLogPendingCount();
      if (pending > 0) {
        console.log(`[FuelLog] ${pending} queued operations detected — replaying via syncNow...`);
        const result = await syncNow();
        console.log(`[FuelLog] Sync result: ${result.succeeded} succeeded, ${result.failed} failed`);
        setFuelPendingCount(getFuelLogPendingCount());
        // Re-fetch to pick up any changes from replayed operations
        if (result.succeeded > 0) {
          let refreshed: FuelLogEntry[];
          if (viewMode === 'team' && teamId) {
            refreshed = await fetchFuelLogs(undefined, teamId);
          } else {
            refreshed = await fetchFuelLogs(user?.id);
          }
          setEntries(refreshed);
          if (viewMode === 'my') saveFuelLogsToLocalStorage(refreshed);
        }
      }
    } catch (err) {
      console.warn('[FuelLog] Failed to load from database, using localStorage fallback:', err);
      reportConnectivityError();
    } finally {
      setIsDbLoading(false);
    }
  }, [viewMode, teamId, user?.id, isDemoMode, syncNow, reportSuccess, reportConnectivityError]);

  // Initial fetch on mount
  useEffect(() => {
    if (hasFetchedRef.current || isDemoMode) return;
    hasFetchedRef.current = true;
    loadFromDb();
  }, [loadFromDb, isDemoMode]);

  // Re-fetch when viewMode changes
  useEffect(() => {
    if (!hasFetchedRef.current) return;
    if (lastViewModeRef.current === viewMode) return;
    lastViewModeRef.current = viewMode;
    loadFromDb();
  }, [viewMode, loadFromDb]);

  // Write-through cache
  useEffect(() => {
    if (viewMode === 'my') {
      saveFuelLogsToLocalStorage(entries);
    }
  }, [entries, viewMode]);

  // Auto-hide save message
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const calculatedTotal = (formData.gallonsPurchased || 0) * (formData.costPerGallon || 0);

  const getEventName = useCallback((eventId?: string) => {
    if (!eventId) return '';
    const event = raceEvents.find(e => e.id === eventId);
    return event ? `${event.title} (${event.startDate})` : 'Unknown Event';
  }, [raceEvents]);

  // ============ MANUAL SYNC ============
  const handleSyncNow = async () => {
    if (fuelPendingCount === 0) return;
    try {
      const result = await syncNow();
      setFuelPendingCount(getFuelLogPendingCount());
      if (result.succeeded > 0) {
        setSaveMessage({ type: 'success', text: `Synced ${result.succeeded} pending change${result.succeeded > 1 ? 's' : ''} to database.` });
        // Re-fetch to get the latest state
        loadFromDb();
      }
      if (result.failed > 0) {
        setSaveMessage({ type: 'error', text: `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync. Will retry later.` });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Sync failed — check your connection.' });
    }
  };

  // ============ CRUD ============

  const handleSave = async () => {
    if (!formData.date || !formData.gallonsPurchased || !formData.costPerGallon) {
      setSaveMessage({ type: 'error', text: 'Please fill in Date, Gallons, and Cost Per Gallon.' });
      return;
    }

    const linkedEvent = raceEvents.find(e => e.id === formData.linkedEventId);

    const entry: FuelLogEntry = {
      id: editingEntry?.id || `FUEL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: formData.date || '',
      gallonsPurchased: formData.gallonsPurchased || 0,
      costPerGallon: formData.costPerGallon || 0,
      totalCost: (formData.gallonsPurchased || 0) * (formData.costPerGallon || 0),
      vendor: formData.vendor || '',
      fuelType: (formData.fuelType as FuelLogEntry['fuelType']) || 'Methanol',
      linkedEventId: formData.linkedEventId || undefined,
      linkedEventName: linkedEvent ? linkedEvent.title : undefined,
      gallonsUsed: formData.gallonsUsed || undefined,
      passesAtEvent: formData.passesAtEvent || undefined,
      notes: formData.notes || undefined,
      receiptNumber: formData.receiptNumber || undefined,
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
      teamId: teamId || undefined,
      userId: user?.id || undefined,
    };

    // Optimistic local update
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? entry : e));
      setSaveMessage({ type: 'success', text: 'Fuel log entry updated!' });
    } else {
      setEntries(prev => [entry, ...prev]);
      setSaveMessage({ type: 'success', text: 'Fuel log entry added!' });
    }

    resetForm();

    // Persist to database (non-blocking) — queue on failure
    if (!isDemoMode) {
      try {
        await upsertFuelLog(entry, user?.id, teamId);
        reportSuccess();
        console.log('[FuelLog] Entry saved to database:', entry.id);
      } catch (err) {
        console.warn('[FuelLog] DB write failed — queuing for offline sync:', err);
        reportConnectivityError();
        queueOperation('upsertFuelLog', entry, user?.id || undefined, `Fuel: ${entry.date} ${entry.vendor || entry.fuelType}`);
        setSaveMessage({ type: 'error', text: 'Saved locally — will sync to database when connection is restored.' });
      }
    }
  };


  const handleEdit = (entry: FuelLogEntry) => {
    if (viewMode === 'team' && entry.userId && entry.userId !== user?.id) {
      setSaveMessage({ type: 'error', text: 'You can only edit your own fuel log entries.' });
      return;
    }
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      gallonsPurchased: entry.gallonsPurchased,
      costPerGallon: entry.costPerGallon,
      vendor: entry.vendor,
      fuelType: entry.fuelType,
      linkedEventId: entry.linkedEventId || '',
      gallonsUsed: entry.gallonsUsed,
      passesAtEvent: entry.passesAtEvent,
      notes: entry.notes || '',
      receiptNumber: entry.receiptNumber || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    const entryToDelete = entries.find(e => e.id === id);
    if (viewMode === 'team' && entryToDelete?.userId && entryToDelete.userId !== user?.id) {
      setSaveMessage({ type: 'error', text: 'You can only delete your own fuel log entries.' });
      return;
    }
    if (confirm('Delete this fuel log entry?')) {
      setEntries(prev => prev.filter(e => e.id !== id));
      setSaveMessage({ type: 'success', text: 'Entry deleted.' });

      if (!isDemoMode) {
        try {
          await deleteFuelLog(id);
          reportSuccess();
          console.log('[FuelLog] Entry deleted from database:', id);
        } catch (err) {
          console.warn('[FuelLog] DB delete failed — queuing for offline sync:', err);
          reportConnectivityError();
          queueOperation('deleteFuelLog', id, user?.id || undefined, `Delete fuel entry ${id.substring(0, 12)}`);
          setFuelPendingCount(getFuelLogPendingCount());
          setSaveMessage({ type: 'error', text: 'Deleted locally — will sync to database when connection is restored.' });
        }
      }
    }
  };



  const resetForm = () => {
    setShowAddModal(false);
    setEditingEntry(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      gallonsPurchased: undefined,
      costPerGallon: undefined,
      vendor: '',
      fuelType: 'Methanol',
      linkedEventId: '',
      gallonsUsed: undefined,
      passesAtEvent: undefined,
      notes: '',
      receiptNumber: ''
    });
  };

  // Helper: check if an entry belongs to the current user
  const isOwnEntry = (entry: FuelLogEntry): boolean => {
    if (!user?.id) return true; // In demo mode, treat all as own
    return !entry.userId || entry.userId === user.id;
  };


  // ============ FILTERING & SORTING ============

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.vendor.toLowerCase().includes(term) ||
        e.notes?.toLowerCase().includes(term) ||
        e.linkedEventName?.toLowerCase().includes(term) ||
        e.receiptNumber?.toLowerCase().includes(term) ||
        e.fuelType.toLowerCase().includes(term)
      );
    }

    // Filter by fuel type
    if (filterFuelType !== 'all') {
      result = result.filter(e => e.fuelType === filterFuelType);
    }

    // Filter by year
    if (filterYear !== 'all') {
      result = result.filter(e => e.date.startsWith(filterYear));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'totalCost') cmp = a.totalCost - b.totalCost;
      else if (sortField === 'gallonsPurchased') cmp = a.gallonsPurchased - b.gallonsPurchased;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [entries, searchTerm, filterFuelType, filterYear, sortField, sortDir]);

  // ============ ANALYTICS ============

  const analytics = useMemo(() => {
    if (entries.length === 0) return null;

    const totalGallons = entries.reduce((sum, e) => sum + e.gallonsPurchased, 0);
    const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);
    const avgCostPerGallon = totalCost / totalGallons;
    const totalGallonsUsed = entries.reduce((sum, e) => sum + (e.gallonsUsed || 0), 0);
    const totalPasses = entries.reduce((sum, e) => sum + (e.passesAtEvent || 0), 0);
    const avgGallonsPerPass = totalPasses > 0 ? totalGallonsUsed / totalPasses : 0;
    const costPerPass = totalPasses > 0 ? totalCost / totalPasses : 0;

    // Entries with linked events that have passes
    const entriesWithPasses = entries.filter(e => e.passesAtEvent && e.passesAtEvent > 0 && e.gallonsUsed);
    const avgGallonsPerPassDetailed = entriesWithPasses.length > 0
      ? entriesWithPasses.reduce((sum, e) => sum + ((e.gallonsUsed || 0) / (e.passesAtEvent || 1)), 0) / entriesWithPasses.length
      : 0;

    // Cost trend by month
    const monthMap = new Map<string, { cost: number; gallons: number; count: number }>();
    entries.forEach(e => {
      const monthKey = e.date.substring(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey) || { cost: 0, gallons: 0, count: 0 };
      existing.cost += e.totalCost;
      existing.gallons += e.gallonsPurchased;
      existing.count += 1;
      monthMap.set(monthKey, existing);
    });
    const costTrend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        label: month.substring(5), // MM
        fullLabel: month,
        value: data.cost,
        gallons: data.gallons,
        count: data.count
      }));

    // Price per gallon trend
    const priceTrend = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({
        label: e.date.substring(5), // MM-DD
        value: e.costPerGallon
      }));

    // Cost per event
    const eventCosts = new Map<string, { cost: number; gallons: number; passes: number; name: string }>();
    entries.filter(e => e.linkedEventId).forEach(e => {
      const key = e.linkedEventId!;
      const existing = eventCosts.get(key) || { cost: 0, gallons: 0, passes: 0, name: e.linkedEventName || 'Unknown' };
      existing.cost += e.totalCost;
      existing.gallons += e.gallonsPurchased;
      existing.passes += e.passesAtEvent || 0;
      eventCosts.set(key, existing);
    });
    const eventBreakdown = Array.from(eventCosts.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      cost: data.cost,
      gallons: data.gallons,
      passes: data.passes,
      costPerPass: data.passes > 0 ? data.cost / data.passes : 0
    })).sort((a, b) => b.cost - a.cost);

    // Vendor breakdown
    const vendorMap = new Map<string, { cost: number; gallons: number; count: number }>();
    entries.forEach(e => {
      const vendor = e.vendor || 'Unknown';
      const existing = vendorMap.get(vendor) || { cost: 0, gallons: 0, count: 0 };
      existing.cost += e.totalCost;
      existing.gallons += e.gallonsPurchased;
      existing.count += 1;
      vendorMap.set(vendor, existing);
    });
    const vendorBreakdown = Array.from(vendorMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost);

    // Recent price change
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const latestPrice = sorted.length > 0 ? sorted[0].costPerGallon : 0;
    const previousPrice = sorted.length > 1 ? sorted[1].costPerGallon : latestPrice;
    const priceChange = latestPrice - previousPrice;
    const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

    // Years available
    const years = [...new Set(entries.map(e => e.date.substring(0, 4)))].sort().reverse();

    return {
      totalGallons,
      totalCost,
      avgCostPerGallon,
      totalGallonsUsed,
      totalPasses,
      avgGallonsPerPass,
      avgGallonsPerPassDetailed,
      costPerPass,
      costTrend,
      priceTrend,
      eventBreakdown,
      vendorBreakdown,
      latestPrice,
      priceChange,
      priceChangePercent,
      years,
      entryCount: entries.length
    };
  }, [entries]);

  const availableYears = analytics?.years || [];

  // ============ EXPORT ============

  const handleExportCSV = () => {
    const headers = ['Date', 'Fuel Type', 'Gallons Purchased', 'Cost/Gallon', 'Total Cost', 'Vendor', 'Event', 'Gallons Used', 'Passes', 'Receipt #', 'Notes'];
    const rows = filteredEntries.map(e => [
      e.date,
      e.fuelType,
      e.gallonsPurchased.toFixed(1),
      e.costPerGallon.toFixed(2),
      e.totalCost.toFixed(2),
      e.vendor,
      e.linkedEventName || '',
      e.gallonsUsed?.toFixed(1) || '',
      e.passesAtEvent || '',
      e.receiptNumber || '',
      e.notes || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel-log-${viewMode === 'team' ? 'team-' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============ TOGGLE SORT ============

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ============ RENDER ============

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {saveMessage.text}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Fuel className="w-7 h-7 text-orange-400" />
              Fuel Log
              {viewMode === 'team' && (
                <span className="text-sm font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Team View
                </span>
              )}
              {isDbLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
            </h2>
            <p className="text-slate-400">
              {viewMode === 'team'
                ? 'Viewing fuel logs from all team members'
                : 'Track methanol purchases, consumption, and costs per race event'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* My Logs / Team Logs Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700/50">
              <button
                onClick={() => setViewMode('my')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'my'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                My Logs
              </button>
              <button
                onClick={() => setViewMode('team')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'team'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Team Logs
              </button>
            </div>

            {/* Tab Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('log')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'log' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Log</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Analytics</span>
              </button>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors text-sm"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Purchase
            </button>
          </div>
        </div>

        {/* Team View Info Banner */}
        {viewMode === 'team' && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-blue-300 text-sm font-medium">
                Team Fuel Log — Showing all entries from team members
              </p>
              <p className="text-blue-400/70 text-xs mt-0.5">
                You can view all team entries but can only edit or delete your own.
                {activeTeamMembership && (
                  <span className="ml-1">Team: {activeTeamMembership.teamOwnerName}</span>
                )}
              </p>
            </div>
            <span className="text-blue-400 text-sm font-mono bg-blue-500/20 px-2 py-0.5 rounded">
              {entries.length} entries
            </span>
          </div>
        )}

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-blue-400" />
              <p className="text-slate-400 text-xs">Total Gallons</p>
            </div>
            <p className="text-xl font-bold text-white">{analytics ? analytics.totalGallons.toFixed(1) : '0'}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <p className="text-orange-400 text-xs">Total Spent</p>
            </div>
            <p className="text-xl font-bold text-orange-400">${analytics ? analytics.totalCost.toFixed(2) : '0.00'}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-400" />
              <p className="text-slate-400 text-xs">Avg $/Gallon</p>
            </div>
            <p className="text-xl font-bold text-white">
              ${analytics && analytics.avgCostPerGallon ? analytics.avgCostPerGallon.toFixed(2) : '0.00'}
            </p>
            {analytics && analytics.priceChange !== 0 && (
              <div className={`flex items-center gap-1 mt-0.5 text-xs ${analytics.priceChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {analytics.priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {analytics.priceChange > 0 ? '+' : ''}{analytics.priceChangePercent.toFixed(1)}%
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-4 h-4 text-purple-400" />
              <p className="text-slate-400 text-xs">Avg Gal/Pass</p>
            </div>
            <p className="text-xl font-bold text-white">
              {analytics && analytics.avgGallonsPerPassDetailed > 0 ? analytics.avgGallonsPerPassDetailed.toFixed(2) : '-'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-xs">Cost/Pass</p>
            </div>
            <p className="text-xl font-bold text-green-400">
              ${analytics && analytics.costPerPass > 0 ? analytics.costPerPass.toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-slate-400" />
              <p className="text-slate-400 text-xs">Entries</p>
            </div>
            <p className="text-xl font-bold text-white">{entries.length}</p>
          </div>
        </div>

        {/* ============ LOG TAB ============ */}
        {activeTab === 'log' && (
          <>
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search vendor, event, notes..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <select
                value={filterFuelType}
                onChange={(e) => setFilterFuelType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Fuel Types</option>
                <option value="Methanol">Methanol</option>
                <option value="Race Gas">Race Gas</option>
                <option value="E85">E85</option>
                <option value="Nitromethane">Nitromethane</option>
                <option value="Other">Other</option>
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Entries Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              {/* Table Header */}
              <div className={`hidden lg:grid gap-2 px-4 py-3 bg-slate-900/50 border-b border-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                viewMode === 'team' ? 'lg:grid-cols-13' : 'lg:grid-cols-12'
              }`} style={viewMode === 'team' ? { gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' } : undefined}>
                <button className="col-span-2 flex items-center gap-1 hover:text-white transition-colors" onClick={() => toggleSort('date')}>
                  Date {sortField === 'date' && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <div className="col-span-1">Type</div>
                <button className="col-span-1 flex items-center gap-1 hover:text-white transition-colors" onClick={() => toggleSort('gallonsPurchased')}>
                  Gallons {sortField === 'gallonsPurchased' && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <div className="col-span-1">$/Gal</div>
                <button className="col-span-1 flex items-center gap-1 hover:text-white transition-colors" onClick={() => toggleSort('totalCost')}>
                  Total {sortField === 'totalCost' && <ArrowUpDown className="w-3 h-3" />}
                </button>
                <div className="col-span-2">Vendor</div>
                <div className="col-span-2">Event</div>
                {viewMode === 'team' && <div className="col-span-1">Added By</div>}
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Entries */}
              {filteredEntries.length === 0 ? (
                <div className="p-12 text-center">
                  <Fuel className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 font-medium">
                    {viewMode === 'team' ? 'No team fuel log entries' : 'No fuel log entries'}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    {viewMode === 'team'
                      ? 'No team members have recorded fuel purchases yet'
                      : 'Click "Add Purchase" to record your first fuel purchase'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/30">
                  {filteredEntries.map(entry => {
                    const ownEntry = isOwnEntry(entry);
                    return (
                    <div key={entry.id}>
                      {/* Desktop Row */}
                      <div
                        className={`hidden lg:grid gap-2 px-4 py-3 hover:bg-slate-700/20 transition-colors items-center cursor-pointer ${
                          viewMode === 'team' && !ownEntry ? 'opacity-90' : ''
                        }`}
                        style={viewMode === 'team' ? { gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' } : { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
                        onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                      >
                        <div className="col-span-2 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-white text-sm">{entry.date}</span>
                        </div>
                        <div className="col-span-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.fuelType === 'Methanol' ? 'bg-blue-500/20 text-blue-400' :
                            entry.fuelType === 'Race Gas' ? 'bg-amber-500/20 text-amber-400' :
                            entry.fuelType === 'Nitromethane' ? 'bg-red-500/20 text-red-400' :
                            entry.fuelType === 'E85' ? 'bg-green-500/20 text-green-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {entry.fuelType}
                          </span>
                        </div>
                        <div className="col-span-1 text-white text-sm font-mono">{entry.gallonsPurchased.toFixed(1)}</div>
                        <div className="col-span-1 text-slate-300 text-sm font-mono">${entry.costPerGallon.toFixed(2)}</div>
                        <div className="col-span-1 text-orange-400 text-sm font-bold font-mono">${entry.totalCost.toFixed(2)}</div>
                        <div className="col-span-2 text-slate-300 text-sm truncate">{entry.vendor || '-'}</div>
                        <div className="col-span-2 text-slate-400 text-sm truncate">
                          {entry.linkedEventName || <span className="text-slate-600">No event linked</span>}
                        </div>
                        {viewMode === 'team' && (
                          <div className="col-span-1">
                            {ownEntry ? (
                              <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
                                You
                              </span>
                            ) : (
                              <span className="text-xs bg-slate-600/30 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                                Team
                              </span>
                            )}
                          </div>
                        )}
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {entry.passesAtEvent && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                              {entry.passesAtEvent} passes
                            </span>
                          )}
                          {ownEntry ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-600 italic">View only</span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div
                        className="lg:hidden p-4 hover:bg-slate-700/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">{entry.date}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                entry.fuelType === 'Methanol' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {entry.fuelType}
                              </span>
                              {viewMode === 'team' && !ownEntry && (
                                <span className="text-xs bg-slate-600/30 text-slate-400 px-1.5 py-0.5 rounded-full">
                                  Team
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-sm">{entry.vendor || 'No vendor'}</p>
                            {entry.linkedEventName && (
                              <p className="text-slate-500 text-xs mt-0.5">{entry.linkedEventName}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-orange-400 font-bold">${entry.totalCost.toFixed(2)}</p>
                            <p className="text-slate-500 text-xs">{entry.gallonsPurchased.toFixed(1)} gal</p>
                          </div>
                        </div>
                        {ownEntry && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Edit
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {expandedEntryId === entry.id && (
                        <div className="px-4 pb-4 bg-slate-900/30 border-t border-slate-700/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3">
                            {entry.gallonsUsed !== undefined && (
                              <div>
                                <p className="text-xs text-slate-500">Gallons Used</p>
                                <p className="text-sm text-white font-mono">{entry.gallonsUsed.toFixed(1)}</p>
                              </div>
                            )}
                            {entry.passesAtEvent !== undefined && (
                              <div>
                                <p className="text-xs text-slate-500">Passes at Event</p>
                                <p className="text-sm text-white">{entry.passesAtEvent}</p>
                              </div>
                            )}
                            {entry.passesAtEvent && entry.gallonsUsed && (
                              <div>
                                <p className="text-xs text-slate-500">Gal/Pass</p>
                                <p className="text-sm text-green-400 font-mono">{(entry.gallonsUsed / entry.passesAtEvent).toFixed(2)}</p>
                              </div>
                            )}
                            {entry.passesAtEvent && (
                              <div>
                                <p className="text-xs text-slate-500">Cost/Pass</p>
                                <p className="text-sm text-orange-400 font-mono">${(entry.totalCost / entry.passesAtEvent).toFixed(2)}</p>
                              </div>
                            )}
                            {entry.receiptNumber && (
                              <div>
                                <p className="text-xs text-slate-500">Receipt #</p>
                                <p className="text-sm text-white">{entry.receiptNumber}</p>
                              </div>
                            )}
                            {entry.notes && (
                              <div className="col-span-2">
                                <p className="text-xs text-slate-500">Notes</p>
                                <p className="text-sm text-slate-300">{entry.notes}</p>
                              </div>
                            )}
                            {viewMode === 'team' && (
                              <div>
                                <p className="text-xs text-slate-500">Added By</p>
                                <p className="text-sm text-white">
                                  {ownEntry ? 'You' : 'Team Member'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ============ ANALYTICS TAB ============ */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {!analytics || entries.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400 font-medium">No data for analytics</p>
                <p className="text-slate-500 text-sm mt-1">Add fuel purchases to see trends and insights</p>
              </div>
            ) : (
              <>
                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Monthly Cost Trend */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-orange-400" />
                      Monthly Fuel Cost
                      {viewMode === 'team' && <span className="text-xs text-blue-400 font-normal">(Team)</span>}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Total spend per month</p>
                    {analytics.costTrend.length >= 2 ? (
                      <TrendLineChart
                        data={analytics.costTrend.map(d => ({ label: d.label, value: d.value }))}
                        height={160}
                        color="#f97316"
                        fillColor="rgba(249,115,22,0.08)"
                        unit="$"
                      />
                    ) : (
                      <MiniBarChart
                        data={analytics.costTrend.map(d => ({ label: d.label, value: d.value, color: 'bg-orange-500' }))}
                        maxHeight={140}
                      />
                    )}
                  </div>

                  {/* Price Per Gallon Trend */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      Price Per Gallon Trend
                      {viewMode === 'team' && <span className="text-xs text-blue-400 font-normal">(Team)</span>}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Cost per gallon over time</p>
                    {analytics.priceTrend.length >= 2 ? (
                      <TrendLineChart
                        data={analytics.priceTrend}
                        height={160}
                        color="#22c55e"
                        fillColor="rgba(34,197,94,0.08)"
                        unit="$"
                      />
                    ) : (
                      <div className="flex items-center justify-center text-slate-500 text-sm h-[160px]">
                        Need more entries for trend
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Breakdown & Vendor Breakdown */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Cost by Event */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      Fuel Cost by Event
                    </h3>
                    {analytics.eventBreakdown.length === 0 ? (
                      <div className="text-center py-8">
                        <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="text-slate-500 text-sm">Link fuel purchases to events to see breakdown</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {analytics.eventBreakdown.slice(0, 8).map((event, idx) => (
                          <div key={event.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-blue-400 font-bold">{idx + 1}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-medium truncate">{event.name}</p>
                                <p className="text-slate-500 text-xs">{event.gallons.toFixed(1)} gal | {event.passes} passes</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-orange-400 font-bold text-sm">${event.cost.toFixed(2)}</p>
                              {event.costPerPass > 0 && (
                                <p className="text-slate-500 text-xs">${event.costPerPass.toFixed(2)}/pass</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vendor Breakdown */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      Spend by Vendor
                    </h3>
                    {analytics.vendorBreakdown.length === 0 ? (
                      <div className="text-center py-8">
                        <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="text-slate-500 text-sm">Add vendor info to see breakdown</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {analytics.vendorBreakdown.map((vendor, idx) => {
                          const pct = analytics!.totalCost > 0 ? (vendor.cost / analytics!.totalCost) * 100 : 0;
                          return (
                            <div key={vendor.name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-medium">{vendor.name}</span>
                                  <span className="text-slate-500 text-xs">({vendor.count} purchases)</span>
                                </div>
                                <span className="text-orange-400 font-bold text-sm">${vendor.cost.toFixed(2)}</span>
                              </div>
                              <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-slate-500 text-xs mt-0.5">{vendor.gallons.toFixed(1)} gallons | {pct.toFixed(0)}% of total</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Consumption Efficiency */}
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 p-5">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-green-400" />
                    Consumption Efficiency
                    {viewMode === 'team' && <span className="text-xs text-blue-400 font-normal">(Team Total)</span>}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-white">{analytics.totalGallonsUsed.toFixed(1)}</p>
                      <p className="text-slate-400 text-sm mt-1">Total Gallons Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-400">
                        {analytics.avgGallonsPerPassDetailed > 0 ? analytics.avgGallonsPerPassDetailed.toFixed(2) : '-'}
                      </p>
                      <p className="text-slate-400 text-sm mt-1">Avg Gallons/Pass</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-400">${analytics.costPerPass > 0 ? analytics.costPerPass.toFixed(2) : '0.00'}</p>
                      <p className="text-slate-400 text-sm mt-1">Avg Cost/Run</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-400">{analytics.totalPasses}</p>
                      <p className="text-slate-400 text-sm mt-1">Total Passes Tracked</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ ADD/EDIT MODAL ============ */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-orange-400" />
                    {editingEntry ? 'Edit Fuel Purchase' : 'Add Fuel Purchase'}
                  </h3>
                  <button onClick={resetForm} className="text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Purchase Date *</label>
                    <DateInputDark
                      value={formData.date || ''}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  {/* Fuel Type */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Fuel Type</label>
                    <select
                      value={formData.fuelType || 'Methanol'}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as FuelLogEntry['fuelType'] })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Methanol">Methanol</option>
                      <option value="Race Gas">Race Gas</option>
                      <option value="E85">E85</option>
                      <option value="Nitromethane">Nitromethane</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Gallons Purchased */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Gallons Purchased *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.gallonsPurchased ?? ''}
                      onChange={(e) => setFormData({ ...formData, gallonsPurchased: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 55"
                    />
                  </div>

                  {/* Cost Per Gallon */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Cost Per Gallon ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costPerGallon ?? ''}
                      onChange={(e) => setFormData({ ...formData, costPerGallon: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 3.50"
                    />
                  </div>

                  {/* Total Cost (calculated) */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Total Cost</label>
                    <div className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-orange-400 font-bold font-mono">
                      ${calculatedTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Vendor */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Vendor / Supplier</label>
                    <input
                      type="text"
                      value={formData.vendor || ''}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., VP Racing Fuels"
                    />
                  </div>

                  {/* Linked Race Event */}
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Linked Race Event</label>
                    <select
                      value={formData.linkedEventId || ''}
                      onChange={(e) => setFormData({ ...formData, linkedEventId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">-- No Event Linked --</option>
                      {raceEvents
                        .sort((a, b) => b.startDate.localeCompare(a.startDate))
                        .map(event => (
                          <option key={event.id} value={event.id}>
                            {event.title} ({event.startDate}) — {event.trackName || 'No Track'}
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Gallons Used */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Gallons Used at Event</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.gallonsUsed ?? ''}
                      onChange={(e) => setFormData({ ...formData, gallonsUsed: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 30"
                    />
                  </div>

                  {/* Passes at Event */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Passes at Event</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.passesAtEvent ?? ''}
                      onChange={(e) => setFormData({ ...formData, passesAtEvent: parseInt(e.target.value) || undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 6"
                    />
                  </div>

                  {/* Calculated per-pass stats */}
                  {formData.gallonsUsed && formData.passesAtEvent && formData.passesAtEvent > 0 && (
                    <div className="md:col-span-2 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-500">Gallons/Pass</p>
                          <p className="text-sm font-bold text-green-400 font-mono">
                            {(formData.gallonsUsed / formData.passesAtEvent).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Cost/Pass</p>
                          <p className="text-sm font-bold text-orange-400 font-mono">
                            ${(calculatedTotal / formData.passesAtEvent).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Remaining</p>
                          <p className="text-sm font-bold text-blue-400 font-mono">
                            {((formData.gallonsPurchased || 0) - formData.gallonsUsed).toFixed(1)} gal
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receipt Number */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Receipt / Invoice #</label>
                    <input
                      type="text"
                      value={formData.receiptNumber || ''}
                      onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="Optional"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Notes</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white h-20"
                      placeholder="Additional notes about this purchase..."
                    />
                  </div>
                </div>
              </div>

              {/* Error inside modal */}
              {saveMessage && saveMessage.type === 'error' && (
                <div className="px-6 pb-2">
                  <div className="p-3 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {saveMessage.text}
                  </div>
                </div>
              )}

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all flex items-center gap-2"
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default FuelLog;
