import React, { useState, useMemo } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  Package,
  Wrench,
  Calendar,
  Download,
  Printer,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Flame,
  Target,
  Clock,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// ============ SHARED TYPES ============
interface MaintenanceHistoryEntry {
  id: string;
  maintenanceItemId: string;
  component: string;
  category: string;
  dateCompleted: string;
  passNumberCompletedAt: number | null;
  partsUsed: { partId: string; partNumber: string; description: string; quantity: number; unitCost: number }[];
  notes: string;
  timestamp: string;
}

const MAINTENANCE_HISTORY_KEY = 'raceLogbook_maintenanceHistory';

function loadMaintenanceHistory(): MaintenanceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MAINTENANCE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ============ COLOR PALETTE ============
const CATEGORY_COLORS: Record<string, string> = {
  'Engine': '#f97316',
  'Drivetrain': '#22c55e',
  'Fuel System': '#3b82f6',
  'Electronics': '#06b6d4',
  'Suspension': '#eab308',
  'Brakes': '#ef4444',
  'Wheels': '#a855f7',
  'Fluids': '#14b8a6',
  'Safety': '#ec4899',
  'Body': '#f59e0b',
  'Transmission': '#8b5cf6',
  'Torque Converter': '#6366f1',
  '3rd Member': '#0ea5e9',
  'Ring and Pinion': '#84cc16',
  'Transmission Drive': '#d946ef',
  'Ty-Drive': '#fb923c',
  'Quick Drive': '#2dd4bf'
};

const PIE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#a855f7', '#f59e0b', '#6366f1'];

// ============ COMPONENT ============
interface MaintenanceCostReportsProps {
  // No props needed — reads from localStorage
}

const MaintenanceCostReports: React.FC<MaintenanceCostReportsProps> = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Load all maintenance history
  const allHistory = useMemo(() => loadMaintenanceHistory(), []);

  // Filter by date range
  const filteredHistory = useMemo(() => {
    let result = allHistory;
    if (startDate) {
      result = result.filter(h => h.dateCompleted >= startDate);
    }
    if (endDate) {
      result = result.filter(h => h.dateCompleted <= endDate);
    }
    return result;
  }, [allHistory, startDate, endDate]);

  // ============ COMPUTED ANALYTICS ============

  // Total cost
  const totalCost = useMemo(() => {
    return filteredHistory.reduce((sum, h) => {
      return sum + h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
    }, 0);
  }, [filteredHistory]);

  // Total completions
  const totalCompletions = filteredHistory.length;

  // Average cost per completion
  const avgCostPerCompletion = totalCompletions > 0 ? totalCost / totalCompletions : 0;

  // Unique parts used
  const uniquePartsCount = useMemo(() => {
    const ids = new Set<string>();
    filteredHistory.forEach(h => h.partsUsed.forEach(p => ids.add(p.partId)));
    return ids.size;
  }, [filteredHistory]);

  // ============ MONTHLY COST LINE CHART ============
  const monthlyCostData = useMemo(() => {
    const monthMap: Record<string, { month: string; cost: number; completions: number; partsCost: number }> = {};

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { month: key, cost: 0, completions: 0, partsCost: 0 };
    }

    filteredHistory.forEach(h => {
      const month = h.dateCompleted.substring(0, 7);
      if (!monthMap[month]) {
        monthMap[month] = { month, cost: 0, completions: 0, partsCost: 0 };
      }
      const partsCost = h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
      monthMap[month].cost += partsCost;
      monthMap[month].partsCost += partsCost;
      monthMap[month].completions += 1;
    });

    return Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      }));
  }, [filteredHistory]);

  // ============ CATEGORY PIE CHART ============
  const categoryCostData = useMemo(() => {
    const catMap: Record<string, { name: string; value: number; count: number }> = {};

    filteredHistory.forEach(h => {
      const cat = h.category || 'Other';
      if (!catMap[cat]) {
        catMap[cat] = { name: cat, value: 0, count: 0 };
      }
      catMap[cat].value += h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
      catMap[cat].count += 1;
    });

    return Object.values(catMap)
      .sort((a, b) => b.value - a.value)
      .map((c, i) => ({
        ...c,
        color: CATEGORY_COLORS[c.name] || PIE_COLORS[i % PIE_COLORS.length]
      }));
  }, [filteredHistory]);

  // ============ MOST EXPENSIVE ITEMS ============
  const mostExpensiveItems = useMemo(() => {
    const itemMap: Record<string, { component: string; category: string; totalCost: number; completions: number; avgCost: number }> = {};

    filteredHistory.forEach(h => {
      const key = h.component;
      if (!itemMap[key]) {
        itemMap[key] = { component: h.component, category: h.category, totalCost: 0, completions: 0, avgCost: 0 };
      }
      itemMap[key].totalCost += h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
      itemMap[key].completions += 1;
    });

    return Object.values(itemMap)
      .map(item => ({ ...item, avgCost: item.completions > 0 ? item.totalCost / item.completions : 0 }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredHistory]);

  // ============ PARTS CONSUMPTION RATE ============
  const partsConsumption = useMemo(() => {
    const partMap: Record<string, {
      partId: string;
      partNumber: string;
      description: string;
      totalQuantity: number;
      totalCost: number;
      usageCount: number;
      firstUsed: string;
      lastUsed: string;
      burnRatePerMonth: number;
      avgQuantityPerUse: number;
    }> = {};

    filteredHistory.forEach(h => {
      h.partsUsed.forEach(p => {
        if (!partMap[p.partId]) {
          partMap[p.partId] = {
            partId: p.partId,
            partNumber: p.partNumber,
            description: p.description,
            totalQuantity: 0,
            totalCost: 0,
            usageCount: 0,
            firstUsed: h.dateCompleted,
            lastUsed: h.dateCompleted,
            burnRatePerMonth: 0,
            avgQuantityPerUse: 0
          };
        }
        partMap[p.partId].totalQuantity += p.quantity;
        partMap[p.partId].totalCost += p.quantity * p.unitCost;
        partMap[p.partId].usageCount += 1;
        if (h.dateCompleted < partMap[p.partId].firstUsed) partMap[p.partId].firstUsed = h.dateCompleted;
        if (h.dateCompleted > partMap[p.partId].lastUsed) partMap[p.partId].lastUsed = h.dateCompleted;
      });
    });

    return Object.values(partMap)
      .map(part => {
        const firstDate = new Date(part.firstUsed);
        const lastDate = new Date(part.lastUsed);
        const monthSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        const burnRate = part.totalQuantity / monthSpan;
        return {
          ...part,
          burnRatePerMonth: burnRate,
          avgQuantityPerUse: part.usageCount > 0 ? part.totalQuantity / part.usageCount : 0
        };
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [filteredHistory]);

  // Top 10 parts for bar chart
  const topPartsChartData = useMemo(() => {
    return partsConsumption.slice(0, 10).map(p => ({
      name: p.description.length > 25 ? p.description.substring(0, 25) + '...' : p.description,
      quantity: p.totalQuantity,
      cost: p.totalCost,
      burnRate: parseFloat(p.burnRatePerMonth.toFixed(2))
    }));
  }, [partsConsumption]);

  // ============ PROJECTED COST FORECAST ============
  const costForecast = useMemo(() => {
    // Calculate average monthly cost from history
    const monthsWithData = monthlyCostData.filter(m => m.cost > 0);
    if (monthsWithData.length < 2) return [];

    const avgMonthlyCost = monthsWithData.reduce((s, m) => s + m.cost, 0) / monthsWithData.length;

    // Calculate trend (simple linear regression)
    const n = monthsWithData.length;
    const xValues = monthsWithData.map((_, i) => i);
    const yValues = monthsWithData.map(m => m.cost);
    const xMean = xValues.reduce((s, x) => s + x, 0) / n;
    const yMean = yValues.reduce((s, y) => s + y, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Generate 6 months of forecast
    const forecast = [];
    const lastMonth = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(lastMonth);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const projected = Math.max(0, intercept + slope * (n + i - 1));
      forecast.push({
        month: key,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        projected: Math.round(projected),
        low: Math.round(Math.max(0, projected * 0.7)),
        high: Math.round(projected * 1.3)
      });
    }

    return forecast;
  }, [monthlyCostData]);

  // Combined chart data (historical + forecast)
  const combinedChartData = useMemo(() => {
    const historical = monthlyCostData.map(m => ({
      label: m.label,
      actual: m.cost,
      projected: null as number | null,
      low: null as number | null,
      high: null as number | null
    }));

    const forecastData = costForecast.map(f => ({
      label: f.label,
      actual: null as number | null,
      projected: f.projected,
      low: f.low,
      high: f.high
    }));

    // Bridge: last actual month also gets projected value
    if (historical.length > 0 && forecastData.length > 0) {
      const lastHistorical = historical[historical.length - 1];
      lastHistorical.projected = lastHistorical.actual;
    }

    return [...historical, ...forecastData];
  }, [monthlyCostData, costForecast]);

  // Forecast summary
  const forecastSummary = useMemo(() => {
    if (costForecast.length === 0) return null;
    const totalProjected = costForecast.reduce((s, f) => s + f.projected, 0);
    const avgProjected = totalProjected / costForecast.length;
    const monthsWithData = monthlyCostData.filter(m => m.cost > 0);
    const avgHistorical = monthsWithData.length > 0 ? monthsWithData.reduce((s, m) => s + m.cost, 0) / monthsWithData.length : 0;
    const trendPct = avgHistorical > 0 ? ((avgProjected - avgHistorical) / avgHistorical) * 100 : 0;
    return { totalProjected, avgProjected, avgHistorical, trendPct };
  }, [costForecast, monthlyCostData]);

  // ============ EXPORT FUNCTIONS ============
  const exportCSV = () => {
    const headers = [
      'Date Completed', 'Component', 'Category', 'Pass #', 'Parts Used',
      'Total Parts Cost', 'Notes'
    ];
    const rows = filteredHistory.map(h => {
      const partsCost = h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
      const partsStr = h.partsUsed.map(p => `${p.description} x${p.quantity} ($${(p.quantity * p.unitCost).toFixed(2)})`).join('; ');
      return [
        h.dateCompleted,
        h.component,
        h.category,
        h.passNumberCompletedAt ?? '',
        partsStr,
        partsCost.toFixed(2),
        h.notes
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance_cost_report_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Maintenance Cost Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
          h1 { color: #f97316; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
          h2 { color: #334155; margin-top: 30px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .summary-card h3 { margin: 0 0 5px 0; font-size: 14px; color: #64748b; }
          .summary-card p { margin: 0; font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          th { background: #f8fafc; font-weight: 600; }
          .section { page-break-inside: avoid; margin-bottom: 30px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Maintenance Cost Report</h1>
          <div style="color: #64748b;">Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Maintenance Cost</h3>
            <p>$${totalCost.toLocaleString()}</p>
          </div>
          <div class="summary-card">
            <h3>Total Completions</h3>
            <p>${totalCompletions}</p>
          </div>
          <div class="summary-card">
            <h3>Avg Cost / Completion</h3>
            <p>$${avgCostPerCompletion.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div class="summary-card">
            <h3>Unique Parts Used</h3>
            <p>${uniquePartsCount}</p>
          </div>
        </div>

        <div class="section">
          <h2>Cost by Category</h2>
          <table>
            <tr><th>Category</th><th>Completions</th><th>Total Cost</th><th>% of Total</th></tr>
            ${categoryCostData.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.count}</td>
                <td>$${c.value.toLocaleString()}</td>
                <td>${totalCost > 0 ? ((c.value / totalCost) * 100).toFixed(1) : 0}%</td>
              </tr>
            `).join('')}
          </table>
        </div>

        <div class="section">
          <h2>Most Expensive Maintenance Items</h2>
          <table>
            <tr><th>Component</th><th>Category</th><th>Completions</th><th>Total Cost</th><th>Avg Cost</th></tr>
            ${mostExpensiveItems.slice(0, 15).map(item => `
              <tr>
                <td>${item.component}</td>
                <td>${item.category}</td>
                <td>${item.completions}</td>
                <td>$${item.totalCost.toLocaleString()}</td>
                <td>$${item.avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            `).join('')}
          </table>
        </div>

        <div class="section">
          <h2>Parts Consumption Analysis</h2>
          <table>
            <tr><th>Part</th><th>Part #</th><th>Total Used</th><th>Total Cost</th><th>Burn Rate/mo</th></tr>
            ${partsConsumption.slice(0, 15).map(p => `
              <tr>
                <td>${p.description}</td>
                <td>${p.partNumber}</td>
                <td>${p.totalQuantity}</td>
                <td>$${p.totalCost.toLocaleString()}</td>
                <td>${p.burnRatePerMonth.toFixed(1)}/mo</td>
              </tr>
            `).join('')}
          </table>
        </div>

        ${forecastSummary ? `
        <div class="section">
          <h2>6-Month Cost Forecast</h2>
          <table>
            <tr><th>Month</th><th>Projected Cost</th><th>Low Estimate</th><th>High Estimate</th></tr>
            ${costForecast.map(f => `
              <tr>
                <td>${f.label}</td>
                <td>$${f.projected.toLocaleString()}</td>
                <td>$${f.low.toLocaleString()}</td>
                <td>$${f.high.toLocaleString()}</td>
              </tr>
            `).join('')}
          </table>
          <p style="color: #64748b; font-size: 13px; margin-top: 10px;">
            Projected 6-month total: <strong>$${forecastSummary.totalProjected.toLocaleString()}</strong> |
            Trend: <span class="${forecastSummary.trendPct > 0 ? 'negative' : 'positive'}">${forecastSummary.trendPct > 0 ? '+' : ''}${forecastSummary.trendPct.toFixed(1)}%</span> vs historical average
          </p>
        </div>
        ` : ''}

        <div class="footer">
          <p>This report was generated from maintenance completion history data.</p>
          <p>Date Range: ${startDate || 'All time'} to ${endDate || 'Present'}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color || entry.stroke }}>
              {entry.name}: {typeof entry.value === 'number' ? `$${entry.value.toLocaleString()}` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ============ EMPTY STATE ============
  if (allHistory.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
        <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Maintenance Cost Data</h3>
        <p className="text-slate-400 max-w-lg mx-auto">
          Maintenance cost reports will appear here once you start completing maintenance items with parts.
          Use the "Complete" button on any maintenance item to log completions with parts used.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Date Filters + Export */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              Maintenance Cost Reports
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Aggregated cost analysis from {totalCompletions} maintenance completion{totalCompletions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Start Date</label>
              <DateInputDark
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm w-36"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">End Date</label>
              <DateInputDark
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm w-36"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
              >
                Clear
              </button>
            )}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-5 border border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Cost</p>
              <p className="text-2xl font-bold text-green-400">${totalCost.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-5 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Completions</p>
              <p className="text-2xl font-bold text-white">{totalCompletions}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-5 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Avg / Completion</p>
              <p className="text-2xl font-bold text-white">${avgCostPerCompletion.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-5 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Unique Parts</p>
              <p className="text-2xl font-bold text-white">{uniquePartsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Monthly Cost Line Chart + Category Pie Chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Cost Over Time */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Total Maintenance Cost Over Time
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyCostData}>
                <defs>
                  <linearGradient id="mcCostGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Parts Cost"
                  stroke="#f97316"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#mcCostGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="completions"
                  name="Completions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  yAxisId={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-orange-400" />
            Cost by Category
          </h4>
          {categoryCostData.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryCostData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryCostData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {categoryCostData.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-300 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-500 text-xs">{cat.count}x</span>
                      <span className="text-white font-medium">${cat.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <PieChartIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No category data</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Most Expensive Items + Parts Consumption */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most Expensive Maintenance Items */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-400" />
            Most Expensive Maintenance Items
          </h4>
          {mostExpensiveItems.length > 0 ? (
            <div className="space-y-3">
              {mostExpensiveItems.slice(0, 10).map((item, idx) => {
                const pctOfTotal = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0;
                return (
                  <div key={item.component} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-500 text-black' :
                      idx === 1 ? 'bg-slate-400 text-black' :
                      idx === 2 ? 'bg-orange-600 text-white' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-white text-sm font-medium truncate">{item.component}</span>
                          <span className="text-slate-500 text-xs flex-shrink-0">{item.category}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-slate-400 text-xs">{item.completions}x</span>
                          <span className="text-green-400 font-medium text-sm">${item.totalCost.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(pctOfTotal, 100)}%`,
                            backgroundColor: CATEGORY_COLORS[item.category] || '#f97316'
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-slate-500 text-xs">Avg: ${item.avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/completion</span>
                        <span className="text-slate-500 text-xs">{pctOfTotal.toFixed(1)}% of total</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">No data</div>
          )}
        </div>

        {/* Parts Consumption Rate Analysis */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Parts Consumption Rate
          </h4>
          {partsConsumption.length > 0 ? (
            <>
              {/* Top parts bar chart */}
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPartsChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm">
                              <p className="text-white font-medium mb-1">{label}</p>
                              <p className="text-orange-400">Quantity: {d.quantity}</p>
                              <p className="text-green-400">Cost: ${d.cost.toLocaleString()}</p>
                              <p className="text-cyan-400">Burn Rate: {d.burnRate}/mo</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="quantity" name="Quantity Used" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {partsConsumption.slice(0, 8).map(part => (
                  <div key={part.partId} className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-lg border border-slate-700/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{part.description}</p>
                      <p className="text-slate-500 text-xs">{part.partNumber}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                      <div className="text-center">
                        <p className="text-orange-400 font-bold text-sm">{part.totalQuantity}</p>
                        <p className="text-slate-500 text-[10px]">total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-cyan-400 font-bold text-sm">{part.burnRatePerMonth.toFixed(1)}</p>
                        <p className="text-slate-500 text-[10px]">/month</p>
                      </div>
                      <div className="text-center">
                        <p className="text-green-400 font-bold text-sm">${part.totalCost.toLocaleString()}</p>
                        <p className="text-slate-500 text-[10px]">cost</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No parts consumption data</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Projected Cost Forecast */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Projected Cost Forecast (6 Months)
          </h4>
          {forecastSummary && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-slate-400 text-xs">Projected 6-Month Total</p>
                <p className="text-lg font-bold text-white">${forecastSummary.totalProjected.toLocaleString()}</p>
              </div>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                forecastSummary.trendPct > 5 ? 'bg-red-500/20 text-red-400' :
                forecastSummary.trendPct < -5 ? 'bg-green-500/20 text-green-400' :
                'bg-slate-700 text-slate-300'
              }`}>
                {forecastSummary.trendPct > 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {forecastSummary.trendPct > 0 ? '+' : ''}{forecastSummary.trendPct.toFixed(1)}% trend
              </div>
            </div>
          )}
        </div>

        {combinedChartData.length > 0 ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedChartData}>
                  <defs>
                    <linearGradient id="mcActualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mcForecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual Cost"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#mcActualGrad)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    name="Projected"
                    stroke="#eab308"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    fillOpacity={1}
                    fill="url(#mcForecastGrad)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    name="High Estimate"
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fillOpacity={0}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="low"
                    name="Low Estimate"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fillOpacity={0}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast details table */}
            {costForecast.length > 0 && (
              <div className="mt-4 grid grid-cols-6 gap-3">
                {costForecast.map(f => (
                  <div key={f.month} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30 text-center">
                    <p className="text-slate-400 text-xs mb-1">{f.label}</p>
                    <p className="text-yellow-400 font-bold">${f.projected.toLocaleString()}</p>
                    <p className="text-slate-500 text-[10px] mt-1">
                      ${f.low.toLocaleString()} - ${f.high.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {costForecast.length === 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Need at least 2 months of maintenance data to generate forecasts. Keep completing maintenance items to unlock projections.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Not enough data for forecasting</p>
          </div>
        )}
      </div>

      {/* Row 4: Detailed Completion History Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Completion History Detail
          </h4>
          <span className="text-sm text-slate-400">{filteredHistory.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-sm">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Component</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-center px-4 py-3">Pass #</th>
                <th className="text-center px-4 py-3">Parts</th>
                <th className="text-right px-4 py-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.slice(0, 50).map(h => {
                const cost = h.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
                return (
                  <React.Fragment key={h.id}>
                    <tr
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer"
                      onClick={() => setExpandedSection(expandedSection === h.id ? null : h.id)}
                    >
                      <td className="px-4 py-3 text-white text-sm">{h.dateCompleted}</td>
                      <td className="px-4 py-3 text-white text-sm font-medium">{h.component}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                          backgroundColor: `${CATEGORY_COLORS[h.category] || '#64748b'}20`,
                          color: CATEGORY_COLORS[h.category] || '#94a3b8'
                        }}>
                          {h.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 text-sm">
                        {h.passNumberCompletedAt !== null ? `#${h.passNumberCompletedAt}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 text-sm">
                        {h.partsUsed.length > 0 ? (
                          <span className="text-orange-400">{h.partsUsed.length} part{h.partsUsed.length > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium text-sm">
                        {cost > 0 ? `$${cost.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                    {expandedSection === h.id && h.partsUsed.length > 0 && (
                      <tr className="bg-slate-900/30">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-slate-400 text-xs font-medium mb-2">Parts Used:</p>
                              <div className="space-y-1">
                                {h.partsUsed.map((p, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-3 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3 h-3 text-orange-400" />
                                      <span className="text-white">{p.description}</span>
                                      <span className="text-slate-500 text-xs">({p.partNumber})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-300">x{p.quantity}</span>
                                      <span className="text-green-400 text-xs">${(p.quantity * p.unitCost).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {h.notes && (
                              <div>
                                <p className="text-slate-400 text-xs font-medium mb-2">Notes:</p>
                                <p className="text-slate-300 text-sm">{h.notes}</p>
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
            {filteredHistory.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900/70 font-semibold">
                  <td className="px-4 py-3 text-white" colSpan={5}>Total</td>
                  <td className="px-4 py-3 text-right text-green-400">${totalCost.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceCostReports;
