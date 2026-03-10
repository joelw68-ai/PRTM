import React, { useState, useMemo, useCallback } from 'react';
import { parseLocalDate, formatLocalDate } from '@/lib/utils';


import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrewRole, hasPermission } from '@/lib/permissions';
import { fetchPartsUsageLog, PartsUsageRecord } from '@/lib/teamMembership';
import * as db from '@/lib/database';
import {
  Trophy,
  Calendar,
  TrendingUp,
  DollarSign,
  Gauge,
  Wrench,
  BarChart3,
  Download,
  FileText,
  ChevronDown,
  Flag,
  Target,
  Zap,
  Clock,
  Package,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus as MinusIcon,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface SeasonSummaryProps {
  currentRole?: CrewRole;
}

const SeasonSummary: React.FC<SeasonSummaryProps> = ({ currentRole = 'Crew' }) => {
  const { raceEvents, passLogs, maintenanceItems, partsInventory, workOrders } = useApp();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [partsUsage, setPartsUsage] = useState<PartsUsageRecord[]>([]);
  const [laborEntries, setLaborEntries] = useState<db.LaborEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    raceEvents.forEach(e => {
      const y = parseLocalDate(e.startDate).getFullYear();
      if (y > 2000) years.add(y);
    });
    passLogs.forEach(p => {
      const y = parseLocalDate(p.date).getFullYear();
      if (y > 2000) years.add(y);

    });
    return Array.from(years).sort((a, b) => b - a);
  }, [raceEvents, passLogs, currentYear]);

  // Load supplementary data
  const loadExtraData = useCallback(async () => {
    if (dataLoaded) return;
    setLoading(true);
    try {
      const [usage, labor] = await Promise.all([
        fetchPartsUsageLog(user?.id).catch(() => []),
        db.fetchLaborEntries(user?.id).catch(() => [])
      ]);
      setPartsUsage(usage);
      setLaborEntries(labor);
      setDataLoaded(true);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user?.id, dataLoaded]);

  // Load on mount
  React.useEffect(() => { loadExtraData(); }, [loadExtraData]);

  const yearEvents = useMemo(() =>
    raceEvents.filter(e => parseLocalDate(e.startDate).getFullYear() === selectedYear),
    [raceEvents, selectedYear]
  );


  const yearPasses = useMemo(() =>
    passLogs.filter(p => parseLocalDate(p.date).getFullYear() === selectedYear),

    [passLogs, selectedYear]
  );

  const yearPartsUsage = useMemo(() =>
    partsUsage.filter(p => parseLocalDate(p.usageDate).getFullYear() === selectedYear),

    [partsUsage, selectedYear]
  );

  const yearLabor = useMemo(() =>
    laborEntries.filter(l => parseLocalDate(l.date).getFullYear() === selectedYear),

    [laborEntries, selectedYear]
  );

  const yearWorkOrders = useMemo(() =>
    workOrders.filter(w => w.createdDate && parseLocalDate(w.createdDate).getFullYear() === selectedYear),

    [workOrders, selectedYear]
  );

  // ============ COMPUTED METRICS ============

  const totalEvents = yearEvents.length;
  const completedEvents = yearEvents.filter(e => e.status === 'Completed').length;

  // Win/Loss from event results
  const wins = yearEvents.filter(e => e.result?.toLowerCase().includes('win') || e.result?.toLowerCase().includes('1st')).length;
  const losses = yearEvents.filter(e => e.result && !e.result.toLowerCase().includes('win') && !e.result.toLowerCase().includes('1st') && e.status === 'Completed').length;

  // Best ET/MPH progression
  const sortedPasses = [...yearPasses].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

  const validETs = sortedPasses.filter(p => p.eighth > 0 && !p.aborted);
  const validMPHs = sortedPasses.filter(p => p.mph > 0 && !p.aborted);
  
  const bestET = validETs.length > 0 ? Math.min(...validETs.map(p => p.eighth)) : null;
  const bestMPH = validMPHs.length > 0 ? Math.max(...validMPHs.map(p => p.mph)) : null;
  const avgET = validETs.length > 0 ? validETs.reduce((s, p) => s + p.eighth, 0) / validETs.length : null;
  const avgMPH = validMPHs.length > 0 ? validMPHs.reduce((s, p) => s + p.mph, 0) / validMPHs.length : null;

  // ET progression (first vs last)
  const firstET = validETs.length > 0 ? validETs[0].eighth : null;
  const lastET = validETs.length > 0 ? validETs[validETs.length - 1].eighth : null;
  const etImprovement = firstET && lastET ? firstET - lastET : null;

  // Financial
  const totalEntryFees = yearEvents.reduce((s, e) => s + (e.entryFee || 0), 0);
  const totalPurseWinnings = yearEvents.reduce((s, e) => s + (e.purse || 0), 0);
  const totalPartsCost = yearPartsUsage.reduce((s, p) => s + p.totalCost, 0);
  const totalLaborCost = yearLabor.reduce((s, l) => s + l.totalCost, 0);
  const totalSpent = totalEntryFees + totalPartsCost + totalLaborCost;
  const netResult = totalPurseWinnings - totalSpent;

  // Maintenance
  const maintenanceDone = yearWorkOrders.filter(w => w.status === 'Completed').length;
  const maintenanceOpen = yearWorkOrders.filter(w => w.status !== 'Completed').length;

  // Most common maintenance categories
  const maintenanceCounts: Record<string, number> = {};
  yearWorkOrders.forEach(w => {
    const cat = w.category || 'Other';
    maintenanceCounts[cat] = (maintenanceCounts[cat] || 0) + 1;
  });
  const topMaintenance = Object.entries(maintenanceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Pass count by month
  const monthlyPasses: Record<string, number> = {};
  yearPasses.forEach(p => {
    const month = formatLocalDate(p.date, { month: 'short' }, 'default');


    monthlyPasses[month] = (monthlyPasses[month] || 0) + 1;
  });

  // Reaction time stats
  const validReactions = yearPasses.filter(p => p.reactionTime > 0 && !p.aborted);
  const avgReaction = validReactions.length > 0
    ? validReactions.reduce((s, p) => s + p.reactionTime, 0) / validReactions.length
    : null;
  const bestReaction = validReactions.length > 0
    ? Math.min(...validReactions.map(p => p.reactionTime))
    : null;

  // Track visits
  const trackVisits: Record<string, number> = {};
  yearPasses.forEach(p => {
    trackVisits[p.track] = (trackVisits[p.track] || 0) + 1;
  });
  const topTracks = Object.entries(trackVisits).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ============ EXPORT FUNCTIONS ============

  const exportCSV = () => {
    const rows = [
      ['Season Summary Report', `${selectedYear}`],
      ['Generated', new Date().toLocaleString()],
      [''],
      ['EVENTS'],
      ['Total Events', totalEvents.toString()],
      ['Completed', completedEvents.toString()],
      ['Wins', wins.toString()],
      ['Losses', losses.toString()],
      [''],
      ['PERFORMANCE'],
      ['Total Passes', yearPasses.length.toString()],
      ['Best ET', bestET?.toFixed(3) || 'N/A'],
      ['Best MPH', bestMPH?.toFixed(2) || 'N/A'],
      ['Avg ET', avgET?.toFixed(3) || 'N/A'],
      ['Avg MPH', avgMPH?.toFixed(2) || 'N/A'],
      ['Best Reaction', bestReaction?.toFixed(4) || 'N/A'],
      ['Avg Reaction', avgReaction?.toFixed(4) || 'N/A'],
      [''],
      ['FINANCIAL'],
      ['Entry Fees', `$${totalEntryFees.toFixed(2)}`],
      ['Parts Cost', `$${totalPartsCost.toFixed(2)}`],
      ['Labor Cost', `$${totalLaborCost.toFixed(2)}`],
      ['Total Spent', `$${totalSpent.toFixed(2)}`],
      ['Purse Winnings', `$${totalPurseWinnings.toFixed(2)}`],
      ['Net Result', `$${netResult.toFixed(2)}`],
      [''],
      ['MAINTENANCE'],
      ['Work Orders Completed', maintenanceDone.toString()],
      ['Work Orders Open', maintenanceOpen.toString()],
      [''],
      ['PASS LOG DETAIL'],
      ['Date', 'Track', 'Session', 'ET', 'MPH', 'Reaction', '60ft', 'Result', 'Aborted'],
      ...yearPasses.map(p => [
        p.date, p.track, p.sessionType, p.eighth.toFixed(3), p.mph.toFixed(2),
        p.reactionTime.toFixed(4), p.sixtyFoot.toFixed(3), p.result || '', p.aborted ? 'Yes' : 'No'
      ]),
      [''],
      ['EVENT DETAIL'],
      ['Date', 'Event', 'Track', 'Result', 'Best ET', 'Best MPH', 'Entry Fee', 'Purse'],
      ...yearEvents.map(e => [
        e.startDate, e.title, e.trackName, e.result || '', e.bestET?.toFixed(3) || '',
        e.bestMPH?.toFixed(2) || '', e.entryFee?.toFixed(2) || '', e.purse?.toFixed(2) || ''
      ])
    ];

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `season-summary-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Generate a printable HTML page and trigger print dialog
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Season Summary ${selectedYear}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 10px; }
          h2 { color: #475569; margin-top: 30px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
          .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
          .stat-sub { font-size: 12px; color: #94a3b8; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
          th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
          td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Season Summary Report - ${selectedYear}</h1>
        <p style="color: #64748b;">Generated ${new Date().toLocaleString()}</p>
        
        <h2>Events & Results</h2>
        <div class="grid">
          <div class="stat"><div class="stat-label">Total Events</div><div class="stat-value">${totalEvents}</div></div>
          <div class="stat"><div class="stat-label">Wins</div><div class="stat-value">${wins}</div></div>
          <div class="stat"><div class="stat-label">Total Passes</div><div class="stat-value">${yearPasses.length}</div></div>
        </div>

        <h2>Performance</h2>
        <div class="grid">
          <div class="stat"><div class="stat-label">Best ET</div><div class="stat-value">${bestET?.toFixed(3) || 'N/A'}</div><div class="stat-sub">seconds</div></div>
          <div class="stat"><div class="stat-label">Best MPH</div><div class="stat-value">${bestMPH?.toFixed(2) || 'N/A'}</div><div class="stat-sub">mph</div></div>
          <div class="stat"><div class="stat-label">Best Reaction</div><div class="stat-value">${bestReaction?.toFixed(4) || 'N/A'}</div><div class="stat-sub">seconds</div></div>
        </div>

        <h2>Financial Summary</h2>
        <div class="grid">
          <div class="stat"><div class="stat-label">Total Spent</div><div class="stat-value">$${totalSpent.toFixed(2)}</div></div>
          <div class="stat"><div class="stat-label">Purse Winnings</div><div class="stat-value">$${totalPurseWinnings.toFixed(2)}</div></div>
          <div class="stat"><div class="stat-label">Net Result</div><div class="stat-value ${netResult >= 0 ? 'positive' : 'negative'}">$${netResult.toFixed(2)}</div></div>
        </div>
        <table>
          <tr><th>Category</th><th>Amount</th></tr>
          <tr><td>Entry Fees</td><td>$${totalEntryFees.toFixed(2)}</td></tr>
          <tr><td>Parts</td><td>$${totalPartsCost.toFixed(2)}</td></tr>
          <tr><td>Labor</td><td>$${totalLaborCost.toFixed(2)}</td></tr>
          <tr style="font-weight:bold;"><td>Total Expenses</td><td>$${totalSpent.toFixed(2)}</td></tr>
        </table>

        <h2>Event Results</h2>
        <table>
          <tr><th>Date</th><th>Event</th><th>Track</th><th>Result</th><th>Best ET</th><th>Best MPH</th></tr>
          ${yearEvents.map(e => `<tr><td>${e.startDate}</td><td>${e.title}</td><td>${e.trackName}</td><td>${e.result || '-'}</td><td>${e.bestET?.toFixed(3) || '-'}</td><td>${e.bestMPH?.toFixed(2) || '-'}</td></tr>`).join('')}
        </table>

        <h2>Pass Log Summary</h2>
        <p>Total passes: ${yearPasses.length} | Aborted: ${yearPasses.filter(p => p.aborted).length} | Avg ET: ${avgET?.toFixed(3) || 'N/A'} | Avg MPH: ${avgMPH?.toFixed(2) || 'N/A'}</p>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  // ============ RENDER ============

  const MetricCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string; trend?: 'up' | 'down' | 'neutral' }> = 
    ({ label, value, sub, icon, color = 'text-orange-400', trend }) => (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && (
          <span className={`flex items-center text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : <MinusIcon className="w-3 h-3" />}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Season Summary</h2>
            <p className="text-slate-400 text-sm">Comprehensive season performance report</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y} Season</option>
            ))}
          </select>

          {/* Export Buttons */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg text-sm hover:from-orange-600 hover:to-red-700 transition-all"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading season data...
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Events" value={totalEvents} sub={`${completedEvents} completed`} icon={<Calendar className="w-5 h-5" />} />
        <MetricCard label="Passes" value={yearPasses.length} sub={`${yearPasses.filter(p => p.aborted).length} aborted`} icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
        <MetricCard label="Wins" value={wins} sub={losses > 0 ? `${wins}-${losses} W/L` : 'No losses recorded'} icon={<Trophy className="w-5 h-5" />} color="text-yellow-400" />
        <MetricCard label="Best ET" value={bestET?.toFixed(3) || 'N/A'} sub={avgET ? `Avg: ${avgET.toFixed(3)}` : ''} icon={<Gauge className="w-5 h-5" />} color="text-green-400" />
        <MetricCard label="Best MPH" value={bestMPH?.toFixed(2) || 'N/A'} sub={avgMPH ? `Avg: ${avgMPH.toFixed(2)}` : ''} icon={<Zap className="w-5 h-5" />} color="text-cyan-400" />
        <MetricCard 
          label="Net P&L" 
          value={`$${Math.abs(netResult).toFixed(0)}`} 
          sub={netResult >= 0 ? 'Profit' : 'Loss'} 
          icon={<DollarSign className="w-5 h-5" />} 
          color={netResult >= 0 ? 'text-green-400' : 'text-red-400'}
          trend={netResult > 0 ? 'up' : netResult < 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Progression */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Performance Progression
          </h3>
          {etImprovement !== null ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-slate-400">First ET of season</span>
                <span className="text-white font-mono">{firstET?.toFixed(3)}s</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-slate-400">Latest ET</span>
                <span className="text-white font-mono">{lastET?.toFixed(3)}s</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg ${etImprovement > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <span className="text-slate-300">Improvement</span>
                <span className={`font-mono font-bold ${etImprovement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {etImprovement > 0 ? '-' : '+'}{Math.abs(etImprovement).toFixed(3)}s
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-slate-400">Best Reaction Time</span>
                <span className="text-white font-mono">{bestReaction?.toFixed(4) || 'N/A'}s</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <span className="text-slate-400">Avg Reaction Time</span>
                <span className="text-white font-mono">{avgReaction?.toFixed(4) || 'N/A'}s</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Not enough pass data to show progression</p>
          )}
        </div>

        {/* Financial Breakdown */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Financial Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-400 flex items-center gap-2"><Flag className="w-4 h-4" /> Entry Fees</span>
              <span className="text-red-400 font-mono">-${totalEntryFees.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-400 flex items-center gap-2"><Package className="w-4 h-4" /> Parts</span>
              <span className="text-red-400 font-mono">-${totalPartsCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-400 flex items-center gap-2"><Users className="w-4 h-4" /> Labor</span>
              <span className="text-red-400 font-mono">-${totalLaborCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border-t border-slate-700">
              <span className="text-slate-300 font-medium">Total Expenses</span>
              <span className="text-red-400 font-mono font-bold">-${totalSpent.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg border border-green-500/20">
              <span className="text-slate-300 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> Purse Winnings</span>
              <span className="text-green-400 font-mono font-bold">+${totalPurseWinnings.toFixed(2)}</span>
            </div>
            <div className={`flex items-center justify-between p-4 rounded-lg ${netResult >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <span className="text-white font-semibold">Net Result</span>
              <span className={`text-xl font-mono font-bold ${netResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netResult >= 0 ? '+' : '-'}${Math.abs(netResult).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly Pass Trend */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Monthly Passes
          </h3>
          {Object.keys(monthlyPasses).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(monthlyPasses).map(([month, count]) => {
                const maxCount = Math.max(...Object.values(monthlyPasses));
                const pct = (count / maxCount) * 100;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs w-8">{month}</span>
                    <div className="flex-1 bg-slate-700/50 rounded-full h-4">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-4 rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 10)}%` }}>
                        <span className="text-[10px] text-white font-medium">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No passes recorded</p>
          )}
        </div>

        {/* Top Tracks */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-400" />
            Most Visited Tracks
          </h3>
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map(([track, count], i) => (
                <div key={track} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                    <span className="text-white text-sm truncate">{track}</span>
                  </div>
                  <span className="text-slate-400 text-sm">{count} passes</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No track data</p>
          )}
        </div>

        {/* Top Maintenance */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-yellow-400" />
            Maintenance Categories
          </h3>
          {topMaintenance.length > 0 ? (
            <div className="space-y-2">
              {topMaintenance.map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                  <span className="text-white text-sm">{cat}</span>
                  <span className="text-slate-400 text-sm">{count} orders</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No maintenance data</p>
          )}
          <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between text-xs">
            <span className="text-slate-400">Completed: {maintenanceDone}</span>
            <span className="text-yellow-400">Open: {maintenanceOpen}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonSummary;
