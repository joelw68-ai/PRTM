import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';
import TimeInputDark from '@/components/ui/TimeInputDark';


import { useApp } from '@/contexts/AppContext';
import {
  Package,
  History,
  TrendingUp,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Wrench,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Eye,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  PieChart,
  FileText,
  Link2,
  User,
  MapPin
} from 'lucide-react';
import {
  PartUsageRecord,
  PartUsageAction,
  PartLifecycleStats,
  loadPartsUsageHistory,
  calculatePartLifecycle,
  getUsageByPart,
  getRecentUsage
} from '@/data/partsUsageData';

const PartsUsageHistory: React.FC = () => {
  const { partsInventory, workOrders, raceEvents } = useApp();
  
  // ============ LIVE DATA FROM LOCALSTORAGE ============
  const [usageData, setUsageData] = useState<PartUsageRecord[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load usage data from localStorage on mount and when refreshed
  const refreshData = useCallback(() => {
    const records = loadPartsUsageHistory();
    setUsageData(records);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Also listen for storage events (cross-tab sync) and custom events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'raceLogbook_partsUsageHistory') {
        refreshData();
      }
    };
    const handleCustomRefresh = () => refreshData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('partsUsageUpdated', handleCustomRefresh);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('partsUsageUpdated', handleCustomRefresh);
    };
  }, [refreshData]);

  const [activeTab, setActiveTab] = useState<'history' | 'analytics' | 'predictions'>('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPartForAnalytics, setSelectedPartForAnalytics] = useState<string | null>(null);
  
  // Get unique components from usage history — uses live localStorage data
  const uniqueComponents = useMemo(() => {
    const components = new Set(usageData.map(u => u.installedOn));
    return Array.from(components).sort();
  }, [usageData]);

  
  // Filter usage records — uses live localStorage data
  const filteredRecords = useMemo(() => {
    let records = [...usageData];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      records = records.filter(r => 
        r.partNumber.toLowerCase().includes(term) ||
        r.partDescription.toLowerCase().includes(term) ||
        r.installedOn.toLowerCase().includes(term) ||
        r.performedBy.toLowerCase().includes(term) ||
        (r.notes && r.notes.toLowerCase().includes(term))
      );
    }
    
    // Action filter
    if (actionFilter !== 'all') {
      records = records.filter(r => r.action === actionFilter);
    }
    
    // Component filter
    if (componentFilter !== 'all') {
      records = records.filter(r => r.installedOn === componentFilter);
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateFilter) {
        case '7days':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case '1year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      const cutoffStr = getLocalDateString(cutoffDate);

      records = records.filter(r => r.date >= cutoffStr);
    }
    
    // Sort by date descending
    records.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    return records;

  }, [usageData, searchTerm, actionFilter, dateFilter, componentFilter]);

  // Calculate lifecycle stats for all unique parts — uses live localStorage data
  const lifecycleStats = useMemo(() => {
    const uniqueParts = new Set(usageData.map(u => u.partNumber));
    const stats: PartLifecycleStats[] = [];
    
    uniqueParts.forEach(partNumber => {
      const lifecycle = calculatePartLifecycle(partNumber);
      if (lifecycle) {
        stats.push(lifecycle);
      }
    });
    
    return stats.sort((a, b) => b.totalCostOwnership - a.totalCostOwnership);
  }, [usageData]);
  
  // Summary statistics — uses live localStorage data
  const summaryStats = useMemo(() => {
    const totalRecords = usageData.length;
    const totalCost = usageData.reduce((sum, r) => sum + r.cost + (r.laborCost || 0), 0);
    const installs = usageData.filter(r => r.action === 'installed').length;
    const removals = usageData.filter(r => r.action === 'removed').length;
    const replacements = usageData.filter(r => r.action === 'replaced').length;
    const failures = usageData.filter(r => r.conditionOnRemoval === 'Failed' || r.conditionOnRemoval === 'Damaged').length;
    const recentActivity = getRecentUsage(30).length;
    
    return {
      totalRecords,
      totalCost,
      installs,
      removals,
      replacements,
      failures,
      recentActivity,
      failureRate: removals > 0 ? ((failures / removals) * 100).toFixed(1) : '0'
    };
  }, [usageData]);

  
  // Predictions based on lifecycle data — uses live localStorage data
  const predictions = useMemo(() => {
    return lifecycleStats
      .filter(s => s.averagePassesPerUse > 0 && s.currentlyInstalled)
      .map(s => {
        const currentPart = usageData
          .filter(u => u.partNumber === s.partNumber && u.action === 'installed')
          .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())[0];

        if (!currentPart) return null;
        
        const passesAtInstall = currentPart.passesAtAction;
        const currentPasses = 155; // Would come from actual pass count
        const passesInUse = currentPasses - passesAtInstall;
        const remainingPasses = Math.max(0, s.averagePassesPerUse - passesInUse);
        const percentUsed = s.averagePassesPerUse > 0 
          ? Math.min(100, (passesInUse / s.averagePassesPerUse) * 100)
          : 0;
        
        return {
          ...s,
          passesInUse,
          remainingPasses,
          percentUsed,
          urgency: percentUsed >= 90 ? 'critical' : percentUsed >= 75 ? 'warning' : 'good'
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.percentUsed || 0) - (a?.percentUsed || 0));
  }, [lifecycleStats, usageData]);

  
  const getActionIcon = (action: PartUsageAction) => {
    switch (action) {
      case 'installed': return <ArrowDownCircle className="w-4 h-4 text-green-400" />;
      case 'removed': return <ArrowUpCircle className="w-4 h-4 text-red-400" />;
      case 'replaced': return <RefreshCw className="w-4 h-4 text-yellow-400" />;
      case 'inspected': return <Eye className="w-4 h-4 text-blue-400" />;
      case 'serviced': return <Settings className="w-4 h-4 text-purple-400" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };
  
  const getActionColor = (action: PartUsageAction) => {
    switch (action) {
      case 'installed': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'removed': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'replaced': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'inspected': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'serviced': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };
  
  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'Good': return 'text-green-400';
      case 'Worn': return 'text-yellow-400';
      case 'Damaged': return 'text-orange-400';
      case 'Failed': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };
  
  const exportToCSV = () => {
    const headers = [
      'Date', 'Part Number', 'Description', 'Action', 'Installed On', 
      'Passes', 'Cost', 'Labor Cost', 'Performed By', 'Work Order', 'Event', 'Notes'
    ];
    const rows = filteredRecords.map(r => [
      r.date, r.partNumber, r.partDescription, r.action, r.installedOn,
      r.passesAtAction, r.cost, r.laborCost || 0, r.performedBy,
      r.workOrderId || '', r.raceEventName || '', r.notes
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parts_usage_history_${getLocalDateString()}.csv`;

    a.click();
  };
  
  const generatePDFReport = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parts Usage History Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #f97316; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
          h2 { color: #64748b; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f97316; color: white; }
          tr:nth-child(even) { background: #f8fafc; }
          .stat-box { display: inline-block; padding: 15px; margin: 10px; background: #f8fafc; border-radius: 8px; min-width: 150px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #f97316; }
          .stat-label { color: #64748b; font-size: 12px; }
          .summary { display: flex; flex-wrap: wrap; margin-bottom: 30px; }
          .installed { color: #22c55e; }
          .removed { color: #ef4444; }
          .replaced { color: #eab308; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Parts Usage History Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
          <div class="stat-box">
            <div class="stat-value">${summaryStats.totalRecords}</div>
            <div class="stat-label">Total Records</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">$${summaryStats.totalCost.toLocaleString()}</div>
            <div class="stat-label">Total Cost</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${summaryStats.installs}</div>
            <div class="stat-label">Installations</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${summaryStats.replacements}</div>
            <div class="stat-label">Replacements</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${summaryStats.failureRate}%</div>
            <div class="stat-label">Failure Rate</div>
          </div>
        </div>
        
        <h2>Usage History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Part Number</th>
              <th>Description</th>
              <th>Action</th>
              <th>Installed On</th>
              <th>Passes</th>
              <th>Cost</th>
              <th>Performed By</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.slice(0, 50).map(r => `
              <tr>
                <td>${r.date}</td>
                <td>${r.partNumber}</td>
                <td>${r.partDescription}</td>
                <td class="${r.action}">${r.action}</td>
                <td>${r.installedOn}</td>
                <td>${r.passesAtAction}</td>
                <td>$${(r.cost + (r.laborCost || 0)).toLocaleString()}</td>
                <td>${r.performedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2>Lifecycle Analytics</h2>
        <table>
          <thead>
            <tr>
              <th>Part Number</th>
              <th>Description</th>
              <th>Avg Passes/Use</th>
              <th>Total Cost</th>
              <th>Cost/Pass</th>
              <th>Failure Rate</th>
            </tr>
          </thead>
          <tbody>
            ${lifecycleStats.slice(0, 20).map(s => `
              <tr>
                <td>${s.partNumber}</td>
                <td>${s.partDescription}</td>
                <td>${s.averagePassesPerUse}</td>
                <td>$${s.totalCostOwnership.toLocaleString()}</td>
                <td>$${s.costPerPass.toFixed(2)}</td>
                <td>${s.failureRate.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <History className="w-7 h-7 text-orange-500" />
              Parts Usage History
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-slate-400">Track part installations, removals, and lifecycle analytics</p>
              <span className="text-xs text-slate-500">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={refreshData}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              title="Reload usage records from storage"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={generatePDFReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF Report
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Usage
            </button>
          </div>
        </div>
        

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summaryStats.totalRecords}</p>
                <p className="text-xs text-slate-400">Total Records</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">${(summaryStats.totalCost / 1000).toFixed(1)}k</p>
                <p className="text-xs text-slate-400">Total Cost</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <ArrowDownCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{summaryStats.installs}</p>
                <p className="text-xs text-slate-400">Installations</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{summaryStats.removals}</p>
                <p className="text-xs text-slate-400">Removals</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{summaryStats.replacements}</p>
                <p className="text-xs text-slate-400">Replacements</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{summaryStats.failureRate}%</p>
                <p className="text-xs text-slate-400">Failure Rate</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{summaryStats.recentActivity}</p>
                <p className="text-xs text-slate-400">Last 30 Days</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'history' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            Usage History
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Lifecycle Analytics
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'predictions' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Replacement Predictions
          </button>
        </div>
        
        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search parts, components, or technicians..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white"
                  />
                </div>
              </div>
              
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Actions</option>
                <option value="installed">Installed</option>
                <option value="removed">Removed</option>
                <option value="replaced">Replaced</option>
                <option value="inspected">Inspected</option>
                <option value="serviced">Serviced</option>
              </select>
              
              <select
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Components</option>
                {uniqueComponents.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
              
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="1year">Last Year</option>
              </select>
            </div>
            
            {/* Usage Records */}
            <div className="space-y-3">
              {filteredRecords.map(record => (
                <div
                  key={record.id}
                  className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getActionColor(record.action)}`}>
                          {getActionIcon(record.action)}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-orange-400 font-mono text-sm">{record.partNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize border ${getActionColor(record.action)}`}>
                              {record.action}
                            </span>
                            {record.workOrderId && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                {record.workOrderId}
                              </span>
                            )}
                            {record.raceEventName && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {record.raceEventName}
                              </span>
                            )}
                          </div>
                          
                          <h4 className="text-white font-medium">{record.partDescription}</h4>
                          
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {record.installedOn}
                              {record.location && ` - ${record.location}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {record.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {record.performedBy}
                            </span>
                            <span>Pass #{record.passesAtAction}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-medium">${(record.cost + (record.laborCost || 0)).toLocaleString()}</p>
                          <p className="text-xs text-slate-500">Total Cost</p>
                        </div>
                        {expandedRecord === record.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedRecord === record.id && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
                      <div className="grid md:grid-cols-4 gap-6">
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3">Cost Breakdown</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Part Cost</span>
                              <span className="text-white">${record.cost.toLocaleString()}</span>
                            </div>
                            {record.laborHours && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Labor ({record.laborHours}h)</span>
                                <span className="text-white">${(record.laborCost || 0).toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-slate-700">
                              <span className="text-slate-400 font-medium">Total</span>
                              <span className="text-green-400 font-medium">${(record.cost + (record.laborCost || 0)).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3">Lifecycle Data</h5>
                          <div className="space-y-2 text-sm">
                            {record.installDate && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Installed</span>
                                <span className="text-white">{record.installDate}</span>
                              </div>
                            )}
                            {record.removalDate && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Removed</span>
                                <span className="text-white">{record.removalDate}</span>
                              </div>
                            )}
                            {record.passesInService !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Passes in Service</span>
                                <span className="text-white">{record.passesInService}</span>
                              </div>
                            )}
                            {record.conditionOnRemoval && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Condition</span>
                                <span className={getConditionColor(record.conditionOnRemoval)}>
                                  {record.conditionOnRemoval}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3">Personnel</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Performed By</span>
                              <span className="text-white">{record.performedBy}</span>
                            </div>
                            {record.verifiedBy && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Verified By</span>
                                <span className="text-white">{record.verifiedBy}</span>
                              </div>
                            )}
                            {record.time && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Time</span>
                                <span className="text-white">{record.time}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3">Notes</h5>
                          <p className="text-white text-sm">{record.notes || 'No notes'}</p>
                          {record.failureReason && (
                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-xs text-red-400 font-medium">Failure Reason:</p>
                              <p className="text-sm text-white">{record.failureReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No usage records found</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Cost Analysis Chart */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-400" />
                Cost by Part Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Engine', 'Cylinder Heads', 'Supercharger', 'Drivetrain', 'Tires', 'Brakes', 'Electronics', 'Safety'].map(category => {
                  const categoryRecords = usageData.filter(r => 
                    r.installedOn.toLowerCase().includes(category.toLowerCase()) ||
                    r.partDescription.toLowerCase().includes(category.toLowerCase())
                  );

                  const totalCost = categoryRecords.reduce((sum, r) => sum + r.cost + (r.laborCost || 0), 0);
                  const maxCost = 15000; // For bar scaling
                  
                  return (
                    <div key={category} className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-2">{category}</p>
                      <p className="text-xl font-bold text-white mb-2">${totalCost.toLocaleString()}</p>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (totalCost / maxCost) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{categoryRecords.length} records</p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Lifecycle Stats Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-orange-400" />
                  Part Lifecycle Analysis
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm">
                      <th className="text-left px-4 py-3">Part</th>
                      <th className="text-center px-4 py-3">Installs</th>
                      <th className="text-center px-4 py-3">Avg Passes/Use</th>
                      <th className="text-center px-4 py-3">Max Passes</th>
                      <th className="text-right px-4 py-3">Total Cost</th>
                      <th className="text-right px-4 py-3">Cost/Pass</th>
                      <th className="text-right px-4 py-3">Cost/Use</th>
                      <th className="text-center px-4 py-3">Failure Rate</th>
                      <th className="text-center px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lifecycleStats.map(stat => (
                      <tr key={stat.partNumber} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="px-4 py-3">
                          <p className="text-orange-400 font-mono text-sm">{stat.partNumber}</p>
                          <p className="text-white text-sm">{stat.partDescription}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-white">{stat.totalInstalls}</td>
                        <td className="px-4 py-3 text-center text-white">{stat.averagePassesPerUse}</td>
                        <td className="px-4 py-3 text-center text-white">{stat.maxPassesRecorded}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">${stat.totalCostOwnership.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${stat.costPerPass.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${stat.costPerUse.toFixed(0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`${stat.failureRate > 20 ? 'text-red-400' : stat.failureRate > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {stat.failureRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stat.currentlyInstalled ? (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Installed</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs">Not Installed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-orange-400" />
                <div>
                  <h3 className="font-semibold text-white">Replacement Predictions</h3>
                  <p className="text-sm text-slate-400">Based on historical lifecycle data and average passes per use</p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((pred: any) => (
                <div
                  key={pred.partNumber}
                  className={`bg-slate-800/50 rounded-xl p-4 border ${
                    pred.urgency === 'critical' ? 'border-red-500/50' :
                    pred.urgency === 'warning' ? 'border-yellow-500/50' :
                    'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-orange-400 font-mono text-sm">{pred.partNumber}</p>
                      <p className="text-white font-medium">{pred.partDescription}</p>
                    </div>
                    {pred.urgency === 'critical' && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                        Replace Soon
                      </span>
                    )}
                    {pred.urgency === 'warning' && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                        Monitor
                      </span>
                    )}
                    {pred.urgency === 'good' && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                        Good
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Lifecycle Progress</span>
                      <span>{pred.percentUsed.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          pred.urgency === 'critical' ? 'bg-red-500' :
                          pred.urgency === 'warning' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${pred.percentUsed}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Passes in Use</p>
                      <p className="text-white font-medium">{pred.passesInUse}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Avg Lifespan</p>
                      <p className="text-white font-medium">{pred.averagePassesPerUse} passes</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Est. Remaining</p>
                      <p className={`font-medium ${
                        pred.remainingPasses <= 10 ? 'text-red-400' :
                        pred.remainingPasses <= 25 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {pred.remainingPasses} passes
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Replacement Cost</p>
                      <p className="text-white font-medium">${pred.costPerUse.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {predictions.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No prediction data available</p>
                  <p className="text-sm">Add more usage history to generate predictions</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Add Usage Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Log Part Usage</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Select Part *</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">Choose a part...</option>
                    {partsInventory.map(part => (
                      <option key={part.id} value={part.id}>
                        {part.partNumber} - {part.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Action *</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="installed">Installed</option>
                    <option value="removed">Removed</option>
                    <option value="replaced">Replaced</option>
                    <option value="inspected">Inspected</option>
                    <option value="serviced">Serviced</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date *</label>
                  <DateInputDark
                    defaultValue={getLocalDateString()}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Time</label>
                  <TimeInputDark
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Installed On *</label>
                <input
                  type="text"
                  placeholder="e.g., Engine #1 (Noonan 521)"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Current Pass Count</label>
                  <input
                    type="number"
                    placeholder="155"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Performed By *</label>
                  <input
                    type="text"
                    placeholder="Technician name"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Link to Work Order</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">None</option>
                    {workOrders.map(wo => (
                      <option key={wo.id} value={wo.id}>{wo.id} - {wo.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Link to Race Event</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">None</option>
                    {raceEvents.map(event => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Labor Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="2.0"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Condition on Removal</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">N/A</option>
                    <option value="Good">Good</option>
                    <option value="Worn">Worn</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add any relevant notes about this usage..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Would save the record here
                  setShowAddModal(false);
                }}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
              >
                Log Usage
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PartsUsageHistory;
