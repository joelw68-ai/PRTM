import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';



import { useApp } from '@/contexts/AppContext';
import { useCar } from '@/contexts/CarContext';
import DateInputDark from '@/components/ui/DateInputDark';
import {

  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  Wrench,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileSpreadsheet,
  Target,
  Users,
  Settings,
  Shield,
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  ClipboardList,
  History,
  Receipt,
  Car
} from 'lucide-react';


import { purchaseOrders, vendorPerformance, vendors } from '@/data/vendorData';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { VendorInvoiceRowSchema, CostReportRowSchema } from '@/lib/validators';
import LaborTracking, { DailyLaborEntry } from './LaborTracking';
import LaborReports from './LaborReports';
import PartsUsageHistory from './PartsUsageHistory';
import { fetchLaborEntries, upsertLaborEntry, deleteLaborEntry, getCurrentUserId, LaborEntry } from '@/lib/database';


interface CostAnalyticsProps {
  currentRole?: string;
}

type CostDateRange = '30d' | '90d' | '6m' | '1y' | 'all';
type CostActiveView = 'overview' | 'workorders' | 'categories' | 'trends' | 'budget' | 'labor' | 'laborReports' | 'sponsor' | 'vendorSpending' | 'costReports';

const CostAnalytics: React.FC<CostAnalyticsProps> = ({ currentRole }) => {
  const { workOrders: allWorkOrders, partsInventory: allPartsInventory, maintenanceItems: allMaintenanceItems, teamMembers } = useApp();
  const { selectedCarId, cars, getCarLabel } = useCar();

  // Helper: check if a car_id is empty/null/undefined
  const isEmptyCarId = (id: string | null | undefined): boolean => !id || id === '';


  // ─── Car-Filtered Data ─────────────────────────────────────
  // When "All Cars" selected (selectedCarId is null/empty): show ALL records
  // When specific car selected: show matching car_id + records with no car_id (legacy data)
  const workOrders = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? allWorkOrders.filter((w) => w.car_id === selectedCarId || isEmptyCarId(w.car_id)) : allWorkOrders,
    [allWorkOrders, selectedCarId]
  );
  const partsInventory = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? allPartsInventory.filter((p) => p.car_id === selectedCarId || isEmptyCarId(p.car_id)) : allPartsInventory,
    [allPartsInventory, selectedCarId]
  );
  const maintenanceItems = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? allMaintenanceItems.filter((m) => m.car_id === selectedCarId || isEmptyCarId(m.car_id)) : allMaintenanceItems,
    [allMaintenanceItems, selectedCarId]

  );



  const [dateRange, setDateRange] = useState<'30d' | '90d' | '6m' | '1y' | 'all'>('1y');
  const [activeView, setActiveView] = useState<'overview' | 'workorders' | 'categories' | 'trends' | 'budget' | 'labor' | 'laborReports' | 'sponsor' | 'vendorSpending' | 'costReports'>('overview');


  const [expandedWorkOrder, setExpandedWorkOrder] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Daily labor entries state — starts empty, loaded from database
  const [laborEntries, setLaborEntries] = useState<DailyLaborEntry[]>([]);
  const [laborLoading, setLaborLoading] = useState(true);

  // Load labor entries from database on mount
  useEffect(() => {
    let cancelled = false;
    const loadLabor = async () => {
      try {
        setLaborLoading(true);
        const userId = await getCurrentUserId();
        const entries = await fetchLaborEntries(userId || undefined);
        if (!cancelled) {
          // Convert LaborEntry to DailyLaborEntry (compatible types)
          setLaborEntries(entries as DailyLaborEntry[]);
        }
      } catch (err) {
        console.error('Failed to load labor entries from database:', err);
      } finally {
        if (!cancelled) setLaborLoading(false);
      }
    };
    loadLabor();
    return () => { cancelled = true; };
  }, []);

  // Vendor invoices state — loaded from database for vendor spending summary
  interface VendorInvoiceRecord {
    id: string;
    vendor_name: string;
    total: number;
    invoice_date: string;
    status: string;
  }
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoiceRecord[]>([]);

  // Load vendor invoices from database on mount
  useEffect(() => {
    let cancelled = false;
    const loadInvoices = async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_invoices')
          .select('id, vendor_name, total, invoice_date, status')
          .order('invoice_date', { ascending: false });
        if (!cancelled && !error && data) {
          setVendorInvoices(parseRows(data, VendorInvoiceRowSchema, 'vendor_invoices') as VendorInvoiceRecord[]);
        }
      } catch (err) {
        console.error('Failed to load vendor invoices for spending summary:', err);
      }
    };
    loadInvoices();
    return () => { cancelled = true; };
  }, []);

  // ========== COST REPORTS from cost_reports table ==========
  interface CostReportEntry {
    id: string;
    vendor_name: string;
    amount: number;
    category: string | null;
    date: string;
    description: string | null;
    source: string | null;
    created_at: string;
  }
  const [costReports, setCostReports] = useState<CostReportEntry[]>([]);
  const [costReportsLoading, setCostReportsLoading] = useState(false);
  const [crStartDate, setCrStartDate] = useState('');
  const [crEndDate, setCrEndDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadCostReports = async () => {
      try {
        setCostReportsLoading(true);
        const { data, error } = await supabase
          .from('cost_reports')
          .select('*')
          .order('created_at', { ascending: false });


        if (!cancelled && !error && data) {
          setCostReports(parseRows(data, CostReportRowSchema, 'cost_reports') as CostReportEntry[]);
        }
      } catch (err) {
        console.error('Failed to load cost reports:', err);
      } finally {
        if (!cancelled) setCostReportsLoading(false);
      }
    };
    loadCostReports();
    return () => { cancelled = true; };
  }, []);

  // Cost reports filtered by date range
  const filteredCostReports = useMemo(() => {
    let filtered = costReports;
    if (crStartDate) filtered = filtered.filter(r => r.date >= crStartDate);
    if (crEndDate) filtered = filtered.filter(r => r.date <= crEndDate);
    return filtered;
  }, [costReports, crStartDate, crEndDate]);

  const crTotalAmount = useMemo(() => filteredCostReports.reduce((s, r) => s + Number(r.amount || 0), 0), [filteredCostReports]);

  const crByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCostReports.forEach(r => { const k = r.category || 'Uncategorized'; map[k] = (map[k] || 0) + Number(r.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));
  }, [filteredCostReports]);

  const crByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCostReports.forEach(r => { const k = r.vendor_name || 'Unknown'; map[k] = (map[k] || 0) + Number(r.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));
  }, [filteredCostReports]);



  // Sync a labor entry to the database (used by LaborTracking as callback)
  const handleSyncLaborEntry = useCallback(async (entry: DailyLaborEntry) => {
    const userId = await getCurrentUserId();
    await upsertLaborEntry(entry as LaborEntry, userId || undefined);
  }, []);

  // Delete a labor entry from the database (used by LaborTracking as callback)
  const handleDeleteLaborEntry = useCallback(async (id: string) => {
    await deleteLaborEntry(id);
  }, []);

  const DEFAULT_HOURLY_RATE = 125;

  
  // Color palette for charts
  const COLORS = {
    parts: '#f97316',
    labor: '#8b5cf6',
    maintenance: '#06b6d4',
    vendors: '#10b981',
    primary: '#f97316',
    secondary: '#3b82f6',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444'
  };

  const CATEGORY_COLORS: Record<string, string> = {
    'Engine': '#f97316',
    'Cylinder Heads': '#3b82f6',
    'Supercharger': '#8b5cf6',
    'Drivetrain': '#22c55e',
    'Suspension': '#eab308',
    'Brakes': '#ef4444',
    'Electronics': '#06b6d4',
    'Safety': '#ec4899',
    'Fluids': '#14b8a6',
    'General': '#64748b',
    'Tires': '#a855f7',
    'Body': '#f59e0b'
  };

  // Calculate date filter

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '6m': return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return parseLocalDate('2020-01-01');
    }
  };


  // Calculate daily labor costs
  const dailyLaborStats = useMemo(() => {
    const dateFilter = getDateFilter();
    const filteredLabor = laborEntries.filter(e => parseLocalDate(e.date) >= dateFilter);

    
    const totalHours = filteredLabor.reduce((sum, e) => sum + e.hours, 0);
    const totalCost = filteredLabor.reduce((sum, e) => sum + e.totalCost, 0);
    
    return { totalHours, totalCost, entries: filteredLabor.length };
  }, [laborEntries, dateRange]);

  // Calculate work order costs with detailed breakdown
  const workOrderCosts = useMemo(() => {
    const dateFilter = getDateFilter();
    
    return workOrders
      .filter(wo => parseLocalDate(wo.createdDate) >= dateFilter)

      .map(wo => {
        const parts = Array.isArray(wo.parts) ? wo.parts : [];
        const partsCost = parts.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0);
        const estimatedLaborCost = (wo.estimatedHours || 0) * DEFAULT_HOURLY_RATE;
        const actualLaborCost = (wo.actualHours || wo.estimatedHours || 0) * DEFAULT_HOURLY_RATE;
        const estimatedTotal = partsCost + estimatedLaborCost;
        const actualTotal = partsCost + actualLaborCost;
        const variance = actualTotal - estimatedTotal;
        const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;
        
        return {
          ...wo,
          partsCost,
          estimatedLaborCost,
          actualLaborCost,
          estimatedTotal,
          actualTotal,
          variance,
          variancePercent
        };
      });
  }, [workOrders, dateRange]);


  // Overall statistics
  const stats = useMemo(() => {
    const completed = workOrderCosts.filter(wo => wo.status === 'Completed');
    const pending = workOrderCosts.filter(wo => wo.status !== 'Completed' && wo.status !== 'Cancelled');
    
    const totalEstimated = workOrderCosts.reduce((sum, wo) => sum + wo.estimatedTotal, 0);
    const totalActual = completed.reduce((sum, wo) => sum + wo.actualTotal, 0);
    const totalPending = pending.reduce((sum, wo) => sum + wo.estimatedTotal, 0);
    
    const totalPartsCost = workOrderCosts.reduce((sum, wo) => sum + wo.partsCost, 0);
    const totalLaborCost = completed.reduce((sum, wo) => sum + wo.actualLaborCost, 0);
    
    const avgVariance = completed.length > 0 
      ? completed.reduce((sum, wo) => sum + wo.variancePercent, 0) / completed.length 
      : 0;
    
    const overBudget = completed.filter(wo => wo.variance > 0).length;
    const underBudget = completed.filter(wo => wo.variance < 0).length;
    const onBudget = completed.filter(wo => wo.variance === 0).length;
    
    // Vendor spending from purchase orders
    const vendorSpending = purchaseOrders
      .filter(po => po.status === 'Received')
      .reduce((sum, po) => sum + po.total, 0);
    
    // Inventory value
    const inventoryValue = partsInventory.reduce((sum, p) => sum + p.totalValue, 0);
    
    // Maintenance costs
    const maintenanceCosts = maintenanceItems.reduce((sum, m) => sum + (m.estimatedCost || 0), 0);
    
    return {
      totalEstimated,
      totalActual,
      totalPending,
      totalPartsCost,
      totalLaborCost,
      avgVariance,
      overBudget,
      underBudget,
      onBudget,
      completedCount: completed.length,
      pendingCount: pending.length,
      vendorSpending,
      inventoryValue,
      maintenanceCosts
    };
  }, [workOrderCosts, partsInventory, maintenanceItems]);

  // Spending by category
  const categorySpending = useMemo(() => {
    const categories: Record<string, { estimated: number; actual: number; count: number; parts: number; labor: number }> = {};
    
    workOrderCosts.forEach(wo => {
      if (!categories[wo.category]) {
        categories[wo.category] = { estimated: 0, actual: 0, count: 0, parts: 0, labor: 0 };
      }
      categories[wo.category].estimated += wo.estimatedTotal;
      categories[wo.category].actual += wo.status === 'Completed' ? wo.actualTotal : 0;
      categories[wo.category].parts += wo.partsCost;
      categories[wo.category].labor += wo.status === 'Completed' ? wo.actualLaborCost : wo.estimatedLaborCost;
      categories[wo.category].count += 1;
    });
    
    return Object.entries(categories)
      .map(([category, data]) => ({
        category,
        name: category,
        ...data,
        variance: data.actual - data.estimated,
        variancePercent: data.estimated > 0 ? ((data.actual - data.estimated) / data.estimated) * 100 : 0,
        color: CATEGORY_COLORS[category] || '#64748b'
      }))
      .sort((a, b) => b.actual - a.actual);
  }, [workOrderCosts]);

  // Monthly spending trend
  const monthlyTrend = useMemo(() => {
    const months: Record<string, { parts: number; labor: number; maintenance: number; vendors: number; total: number; estimated: number }> = {};
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toISOString().substring(0, 7);
      months[key] = { parts: 0, labor: 0, maintenance: 0, vendors: 0, total: 0, estimated: 0 };
    }
    
    workOrderCosts.forEach(wo => {
      const month = wo.createdDate.substring(0, 7);
      if (months[month]) {
        months[month].parts += wo.partsCost;
        months[month].estimated += wo.estimatedTotal;
        if (wo.status === 'Completed') {
          months[month].labor += wo.actualLaborCost;
          months[month].total += wo.actualTotal;
        }
      }
    });
    
    // Add vendor spending
    purchaseOrders.forEach(po => {
      if (po.status === 'Received' && po.receivedDate) {
        const month = po.receivedDate.substring(0, 7);
        if (months[month]) {
          months[month].vendors += po.total;
        }
      }
    });
    
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: formatLocalDate(month + '-01', { month: 'short', year: '2-digit' }),


        ...data
      }));
  }, [workOrderCosts]);

  // Estimated vs Actual comparison data
  const estimatedVsActual = useMemo(() => {
    return workOrderCosts
      .filter(wo => wo.status === 'Completed')
      .slice(0, 10)
      .map(wo => ({
        name: wo.title.length > 20 ? wo.title.substring(0, 20) + '...' : wo.title,
        estimated: wo.estimatedTotal,
        actual: wo.actualTotal,
        variance: wo.variance
      }));
  }, [workOrderCosts]);

  // Budget allocation data
  const budgetAllocation = useMemo(() => {
    const total = stats.totalPartsCost + stats.totalLaborCost + stats.vendorSpending;
    return [
      { name: 'Parts', value: stats.totalPartsCost, color: COLORS.parts },
      { name: 'Labor', value: stats.totalLaborCost, color: COLORS.labor },
      { name: 'Vendor Orders', value: stats.vendorSpending, color: COLORS.vendors }
    ].filter(item => item.value > 0);
  }, [stats]);

  // ========== VENDOR SPENDING SUMMARY ==========
  // Aggregates costs from parts inventory, purchase orders, and vendor invoices by vendor name
  const vendorSpendingData = useMemo(() => {
    const vendorMap: Record<string, { totalSpend: number; transactions: number; sources: { parts: number; purchaseOrders: number; invoices: number } }> = {};

    const addToVendor = (name: string, amount: number, source: 'parts' | 'purchaseOrders' | 'invoices') => {
      const key = name.trim();
      if (!key) return;
      if (!vendorMap[key]) {
        vendorMap[key] = { totalSpend: 0, transactions: 0, sources: { parts: 0, purchaseOrders: 0, invoices: 0 } };
      }
      vendorMap[key].totalSpend += amount;
      vendorMap[key].transactions += 1;
      vendorMap[key].sources[source] += amount;
    };

    // 1. Parts inventory — each part with a vendor and totalValue > 0 is a transaction
    partsInventory.forEach(part => {
      if (part.vendor && part.totalValue > 0) {
        addToVendor(part.vendor, part.totalValue, 'parts');
      }
    });

    // 2. Purchase orders (received)
    purchaseOrders.forEach(po => {
      if (po.vendorName && po.total > 0) {
        addToVendor(po.vendorName, po.total, 'purchaseOrders');
      }
    });

    // 3. Vendor invoices from database
    vendorInvoices.forEach(inv => {
      if (inv.vendor_name && inv.total > 0) {
        addToVendor(inv.vendor_name, inv.total, 'invoices');
      }
    });

    const result = Object.entries(vendorMap)
      .map(([name, data]) => ({
        name,
        totalSpend: data.totalSpend,
        transactions: data.transactions,
        avgPerTransaction: data.transactions > 0 ? data.totalSpend / data.transactions : 0,
        partsSpend: data.sources.parts,
        poSpend: data.sources.purchaseOrders,
        invoiceSpend: data.sources.invoices,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    const grandTotal = result.reduce((sum, v) => sum + v.totalSpend, 0);
    const totalTransactions = result.reduce((sum, v) => sum + v.transactions, 0);

    return { vendors: result, grandTotal, totalTransactions, vendorCount: result.length };
  }, [partsInventory, vendorInvoices]);

  // Bar chart colors for vendor spending
  const VENDOR_BAR_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#ef4444', '#14b8a6', '#a855f7', '#f59e0b', '#6366f1'];


  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Work Order ID', 'Title', 'Category', 'Status', 'Priority', 'Created Date',
      'Parts Cost', 'Est. Labor', 'Actual Labor', 'Est. Total', 'Actual Total', 'Variance', 'Variance %'
    ];
    const rows = workOrderCosts.map(wo => [
      wo.id, wo.title, wo.category, wo.status, wo.priority, wo.createdDate,
      wo.partsCost.toFixed(2), wo.estimatedLaborCost.toFixed(2), wo.actualLaborCost.toFixed(2),
      wo.estimatedTotal.toFixed(2), wo.actualTotal.toFixed(2), wo.variance.toFixed(2), wo.variancePercent.toFixed(1)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost_report_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (using print)
  const exportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cost Analytics Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
          h1 { color: #f97316; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
          h2 { color: #334155; margin-top: 30px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #f97316; }
          .date { color: #64748b; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .summary-card h3 { margin: 0 0 5px 0; font-size: 14px; color: #64748b; }
          .summary-card p { margin: 0; font-size: 24px; font-weight: bold; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; }
          .section { page-break-inside: avoid; margin-bottom: 30px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Professional Racing Management - Cost Analytics Report</div>
          <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        
        <div class="section">
          <h2>Executive Summary</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Actual Spending</h3>
              <p>$${stats.totalActual.toLocaleString()}</p>
            </div>
            <div class="summary-card">
              <h3>Total Estimated</h3>
              <p>$${stats.totalEstimated.toLocaleString()}</p>
            </div>
            <div class="summary-card">
              <h3>Average Variance</h3>
              <p class="${stats.avgVariance > 0 ? 'negative' : 'positive'}">${stats.avgVariance > 0 ? '+' : ''}${stats.avgVariance.toFixed(1)}%</p>
            </div>
            <div class="summary-card">
              <h3>Parts Cost</h3>
              <p>$${stats.totalPartsCost.toLocaleString()}</p>
            </div>
            <div class="summary-card">
              <h3>Labor Cost</h3>
              <p>$${stats.totalLaborCost.toLocaleString()}</p>
            </div>
            <div class="summary-card">
              <h3>Inventory Value</h3>
              <p>$${stats.inventoryValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Budget Performance</h2>
          <table>
            <tr>
              <th>Metric</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
            <tr>
              <td>Work Orders Under Budget</td>
              <td>${stats.underBudget}</td>
              <td class="positive">${stats.completedCount > 0 ? ((stats.underBudget / stats.completedCount) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>Work Orders On Budget</td>
              <td>${stats.onBudget}</td>
              <td>${stats.completedCount > 0 ? ((stats.onBudget / stats.completedCount) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>Work Orders Over Budget</td>
              <td>${stats.overBudget}</td>
              <td class="negative">${stats.completedCount > 0 ? ((stats.overBudget / stats.completedCount) * 100).toFixed(1) : 0}%</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>Spending by Category</h2>
          <table>
            <tr>
              <th>Category</th>
              <th>Work Orders</th>
              <th>Estimated</th>
              <th>Actual</th>
              <th>Variance</th>
            </tr>
            ${categorySpending.map(cat => `
              <tr>
                <td>${cat.category}</td>
                <td>${cat.count}</td>
                <td>$${cat.estimated.toLocaleString()}</td>
                <td>$${cat.actual.toLocaleString()}</td>
                <td class="${cat.variance > 0 ? 'negative' : 'positive'}">${cat.variance > 0 ? '+' : ''}$${cat.variance.toLocaleString()} (${cat.variancePercent.toFixed(1)}%)</td>
              </tr>
            `).join('')}
          </table>
        </div>

        <div class="section">
          <h2>Vendor Spending Summary</h2>
          <table>
            <tr>
              <th>Vendor</th>
              <th>Total Orders</th>
              <th>Total Spent</th>
              <th>On-Time Rate</th>
            </tr>
            ${vendorPerformance.slice(0, 8).map(vp => {
              const vendor = vendors.find(v => v.id === vp.vendorId);
              const onTimeRate = vp.totalOrders > 0 ? (vp.onTimeDeliveries / vp.totalOrders) * 100 : 0;
              return `
                <tr>
                  <td>${vendor?.name || 'Unknown'}</td>
                  <td>${vp.totalOrders}</td>
                  <td>$${vp.totalSpent.toLocaleString()}</td>
                  <td>${onTimeRate.toFixed(0)}%</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>

        <div class="footer">
          <p>This report was automatically generated by Professional Racing Management Cost Analytics.</p>
          <p>Report Period: ${dateRange === 'all' ? 'All Time' : dateRange === '30d' ? 'Last 30 Days' : dateRange === '90d' ? 'Last 90 Days' : dateRange === '6m' ? 'Last 6 Months' : 'Last Year'}</p>
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

  // Generate sponsor report
  const generateSponsorReport = () => {
    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sponsor Financial Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 50px; color: #1e293b; max-width: 900px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h1 { color: #f97316; font-size: 32px; margin-bottom: 5px; }
          .header p { color: #64748b; font-size: 14px; }
          .highlight-box { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 12px; margin: 30px 0; }
          .highlight-box h2 { margin: 0 0 10px 0; font-size: 18px; opacity: 0.9; }
          .highlight-box .amount { font-size: 48px; font-weight: bold; }
          .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
          .metric-card { background: #f8fafc; border-radius: 12px; padding: 25px; }
          .metric-card h3 { color: #64748b; font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .metric-card .value { font-size: 28px; font-weight: bold; color: #1e293b; }
          .metric-card .subtext { font-size: 12px; color: #94a3b8; margin-top: 5px; }
          .section { margin: 40px 0; }
          .section h2 { color: #334155; font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8fafc; padding: 15px; text-align: left; font-weight: 600; color: #475569; }
          td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
          .efficiency-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 10px; }
          .efficiency-fill { height: 100%; background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pro Mod Racing Team</h1>
          <p>Financial Performance Report for Sponsors</p>
          <p>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div class="highlight-box">
          <h2>Total Investment This Season</h2>
          <div class="amount">$${(stats.totalActual + stats.vendorSpending).toLocaleString()}</div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <h3>Parts & Components</h3>
            <div class="value">$${stats.totalPartsCost.toLocaleString()}</div>
            <div class="subtext">High-performance racing components</div>
          </div>
          <div class="metric-card">
            <h3>Professional Labor</h3>
            <div class="value">$${stats.totalLaborCost.toLocaleString()}</div>
            <div class="subtext">Expert technician services</div>
          </div>
          <div class="metric-card">
            <h3>Current Inventory Value</h3>
            <div class="value">$${stats.inventoryValue.toLocaleString()}</div>
            <div class="subtext">Spare parts and consumables</div>
          </div>
          <div class="metric-card">
            <h3>Budget Efficiency</h3>
            <div class="value">${(100 - Math.abs(stats.avgVariance)).toFixed(1)}%</div>
            <div class="subtext">Actual vs estimated spending accuracy</div>
            <div class="efficiency-bar">
              <div class="efficiency-fill" style="width: ${Math.max(0, 100 - Math.abs(stats.avgVariance))}%"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Investment Allocation by Category</h2>
          <table>
            <tr>
              <th>Category</th>
              <th>Investment</th>
              <th>% of Total</th>
              <th>Work Orders</th>
            </tr>
            ${categorySpending.slice(0, 6).map(cat => {
              const percentage = stats.totalActual > 0 ? (cat.actual / stats.totalActual) * 100 : 0;
              return `
                <tr>
                  <td><strong>${cat.category}</strong></td>
                  <td>$${cat.actual.toLocaleString()}</td>
                  <td>${percentage.toFixed(1)}%</td>
                  <td>${cat.count}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>

        <div class="section">
          <h2>Key Performance Indicators</h2>
          <table>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
            <tr>
              <td>Completed Work Orders</td>
              <td>${stats.completedCount}</td>
              <td class="positive">On Track</td>
            </tr>
            <tr>
              <td>Budget Adherence Rate</td>
              <td>${stats.completedCount > 0 ? (((stats.underBudget + stats.onBudget) / stats.completedCount) * 100).toFixed(0) : 0}%</td>
              <td class="${((stats.underBudget + stats.onBudget) / stats.completedCount) >= 0.7 ? 'positive' : 'negative'}">
                ${((stats.underBudget + stats.onBudget) / stats.completedCount) >= 0.7 ? 'Excellent' : 'Needs Attention'}
              </td>
            </tr>
            <tr>
              <td>Vendor Reliability</td>
              <td>${vendorPerformance.length > 0 ? (vendorPerformance.reduce((sum, vp) => sum + (vp.onTimeDeliveries / vp.totalOrders), 0) / vendorPerformance.length * 100).toFixed(0) : 0}%</td>
              <td class="positive">Strong</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>This report is confidential and intended for sponsor review only.</p>
          <p>Pro Mod Racing Team | ${new Date().getFullYear()} Season</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Custom tooltip for charts
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <section className="py-8 px-4" ref={reportRef}>
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-orange-500" />
              Cost Analytics & Reporting
            </h2>
            <p className="text-slate-400">Track spending, analyze costs, and generate budget reports</p>
            {cars.length > 1 && (
              <div className="flex items-center gap-2 mt-1">
                <Car className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-slate-400">
                  Showing data for: <span className="text-orange-400 font-semibold">{getCarLabel(selectedCarId)}</span>
                </span>
              </div>
            )}
          </div>

          
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as CostDateRange)}

              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print PDF
            </button>
            <button
              onClick={generateSponsorReport}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Users className="w-4 h-4" />
              Sponsor Report
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Actual</p>
                <p className="text-xl font-bold text-green-400">${stats.totalActual.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Estimated</p>
                <p className="text-xl font-bold text-white">${stats.totalEstimated.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/30 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Pending</p>
                <p className="text-xl font-bold text-yellow-400">${stats.totalPending.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-4 border border-orange-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Parts Cost</p>
                <p className="text-xl font-bold text-white">${stats.totalPartsCost.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Labor Cost</p>
                <p className="text-xl font-bold text-white">${stats.totalLaborCost.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className={`bg-gradient-to-br rounded-xl p-4 border ${
            stats.avgVariance > 5 ? 'from-red-500/20 to-red-600/10 border-red-500/30' : 
            stats.avgVariance < -5 ? 'from-green-500/20 to-green-600/10 border-green-500/30' : 
            'from-slate-500/20 to-slate-600/10 border-slate-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stats.avgVariance > 5 ? 'bg-red-500/30' : stats.avgVariance < -5 ? 'bg-green-500/30' : 'bg-slate-500/30'
              }`}>
                {stats.avgVariance > 0 ? (
                  <ArrowUpRight className={`w-5 h-5 ${stats.avgVariance > 5 ? 'text-red-400' : 'text-slate-400'}`} />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-green-400" />
                )}
              </div>
              <div>
                <p className="text-slate-400 text-sm">Avg Variance</p>
                <p className={`text-xl font-bold ${
                  stats.avgVariance > 5 ? 'text-red-400' : stats.avgVariance < -5 ? 'text-green-400' : 'text-white'
                }`}>
                  {stats.avgVariance > 0 ? '+' : ''}{stats.avgVariance.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: PieChartIcon },
            { id: 'costReports', label: 'Cost Reports', icon: FileSpreadsheet },
            { id: 'workorders', label: 'Work Order Analysis', icon: FileText },
            { id: 'categories', label: 'Category Breakdown', icon: BarChart3 },
            { id: 'trends', label: 'Spending Trends', icon: TrendingUp },
            { id: 'budget', label: 'Budget Planning', icon: Target },
            { id: 'labor', label: 'Daily Labor', icon: Users },
            { id: 'laborReports', label: 'Labor Reports', icon: ClipboardList },
            { id: 'sponsor', label: 'Sponsor View', icon: User },
            { id: 'vendorSpending', label: 'Vendor Spending', icon: Building2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as CostActiveView)}

              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === tab.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeView === 'costReports' && (
          <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-400" />
                Unified Cost Reports
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                All costs from vendor invoices and miscellaneous expenses in one place. Entries are automatically added when "Add to Cost Report" is checked.
              </p>
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                  <DateInputDark
                    value={crStartDate}
                    onChange={(e) => setCrStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">End Date</label>
                  <DateInputDark
                    value={crEndDate}
                    onChange={(e) => setCrEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <button
                  onClick={() => { setCrStartDate(''); setCrEndDate(''); }}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Clear Dates
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <p className="text-slate-400">
                  Showing {filteredCostReports.length} entries{crStartDate || crEndDate ? ' (filtered)' : ''}.
                  Total: <span className="text-green-400 font-bold">${crTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
                {filteredCostReports.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-slate-500">Invoices: {filteredCostReports.filter(r => r.source !== 'misc_expense').length}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      <span className="text-slate-500">Misc Expenses: {filteredCostReports.filter(r => r.source === 'misc_expense').length}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-5 border border-green-500/30">
                <p className="text-slate-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-green-400">${crTotalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-5 border border-blue-500/30">
                <p className="text-slate-400 text-sm">Entries</p>
                <p className="text-2xl font-bold text-white">{filteredCostReports.length}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-5 border border-orange-500/30">
                <p className="text-slate-400 text-sm">Categories</p>
                <p className="text-2xl font-bold text-white">{crByCategory.length}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-5 border border-purple-500/30">
                <p className="text-slate-400 text-sm">Sources</p>
                <p className="text-2xl font-bold text-white">{crByVendor.length}</p>
              </div>
            </div>

            {filteredCostReports.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Cost Report Entries</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Cost report entries are automatically created when you upload invoices or add miscellaneous expenses with the "Add to Cost Report" checkbox enabled.
                </p>
              </div>
            ) : (
              <>
                {/* Totals by Category */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      Totals by Category
                    </h4>
                    <div className="space-y-3">
                      {crByCategory.map((cat, idx) => (
                        <div key={cat.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VENDOR_BAR_COLORS[idx % VENDOR_BAR_COLORS.length] }} />
                            <span className="text-white">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-700 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${crTotalAmount > 0 ? (cat.total / crTotalAmount) * 100 : 0}%`, backgroundColor: VENDOR_BAR_COLORS[idx % VENDOR_BAR_COLORS.length] }} />
                            </div>
                            <span className="text-green-400 font-medium w-28 text-right">${cat.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals by Source */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-orange-400" />
                      Totals by Source
                    </h4>
                    <div className="space-y-3">
                      {crByVendor.map((v, idx) => (
                        <div key={v.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VENDOR_BAR_COLORS[(idx + 4) % VENDOR_BAR_COLORS.length] }} />
                            <span className="text-white">{v.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-700 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${crTotalAmount > 0 ? (v.total / crTotalAmount) * 100 : 0}%`, backgroundColor: VENDOR_BAR_COLORS[(idx + 4) % VENDOR_BAR_COLORS.length] }} />
                            </div>
                            <span className="text-green-400 font-medium w-28 text-right">${v.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* All Entries Table */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50">
                    <h4 className="font-semibold text-white">All Cost Report Entries</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-sm">
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Source / Vendor</th>
                          <th className="text-left px-4 py-3">Category</th>
                          <th className="text-left px-4 py-3">Description</th>
                          <th className="text-right px-4 py-3">Amount</th>
                          <th className="text-center px-4 py-3">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCostReports.map(r => (
                          <tr key={r.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                            <td className="px-4 py-3 text-white">{r.date}</td>
                            <td className="px-4 py-3 text-white font-medium">{r.vendor_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                {r.category || 'Uncategorized'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300 text-sm max-w-xs truncate">{r.description || '-'}</td>
                            <td className="px-4 py-3 text-right text-green-400 font-semibold">${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-center">
                              {r.source === 'misc_expense' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
                                  <Receipt className="w-3 h-3" />
                                  Expense
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                                  <FileText className="w-3 h-3" />
                                  Invoice
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900/70 font-semibold">
                          <td className="px-4 py-3 text-white" colSpan={4}>Total</td>
                          <td className="px-4 py-3 text-right text-green-400">${crTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}




        {/* Daily Labor Tab */}
        {activeView === 'labor' && (
          <LaborTracking
            laborEntries={laborEntries}
            setLaborEntries={setLaborEntries}
            onSyncEntry={handleSyncLaborEntry}
            onDeleteEntry={handleDeleteLaborEntry}
          />
        )}


        {/* Labor Reports Tab */}
        {activeView === 'laborReports' && (
          <LaborReports laborEntries={laborEntries} />
        )}


        {/* Overview Tab */}
        {activeView === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Budget Allocation Pie Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-orange-400" />
                Budget Allocation
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={budgetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {budgetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {budgetAllocation.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300">{item.name}</span>
                    </div>
                    <span className="text-white font-medium">${item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Performance */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Budget Performance
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Under Budget</span>
                    <span className="text-green-400 font-medium">{stats.underBudget} work orders</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${stats.completedCount > 0 ? (stats.underBudget / stats.completedCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">On Budget</span>
                    <span className="text-slate-300 font-medium">{stats.onBudget} work orders</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className="bg-slate-500 h-3 rounded-full transition-all"
                      style={{ width: `${stats.completedCount > 0 ? (stats.onBudget / stats.completedCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Over Budget</span>
                    <span className="text-red-400 font-medium">{stats.overBudget} work orders</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full transition-all"
                      style={{ width: `${stats.completedCount > 0 ? (stats.overBudget / stats.completedCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-700">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Budget Adherence Rate</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {stats.completedCount > 0 ? (((stats.underBudget + stats.onBudget) / stats.completedCount) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Spending Categories */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Top Spending Categories
              </h3>
              <div className="space-y-4">
                {categorySpending.slice(0, 6).map((cat, idx) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white">{cat.category}</span>
                      </div>
                      <span className="text-green-400 font-medium">${cat.actual.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${categorySpending[0].actual > 0 ? (cat.actual / categorySpending[0].actual) * 100 : 0}%`,
                          backgroundColor: cat.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Work Orders Tab */}
        {activeView === 'workorders' && (
          <div className="space-y-6">
            {/* Estimated vs Actual Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4">Estimated vs Actual Costs</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={estimatedVsActual} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="estimated" name="Estimated" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Work Orders Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="font-semibold text-white">Work Order Cost Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm">
                      <th className="text-left px-4 py-3">Work Order</th>
                      <th className="text-left px-4 py-3">Category</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Parts</th>
                      <th className="text-right px-4 py-3">Est. Labor</th>
                      <th className="text-right px-4 py-3">Act. Labor</th>
                      <th className="text-right px-4 py-3">Est. Total</th>
                      <th className="text-right px-4 py-3">Act. Total</th>
                      <th className="text-right px-4 py-3">Variance</th>
                      <th className="text-center px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrderCosts.map(wo => (
                      <React.Fragment key={wo.id}>
                        <tr className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{wo.title}</p>
                              <p className="text-xs text-slate-500">{wo.id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[wo.category] || '#64748b' }} />
                              <span className="text-slate-300">{wo.category}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              wo.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                              wo.status === 'In Progress' ? 'bg-yellow-500/20 text-yellow-400' :
                              wo.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {wo.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-white">${wo.partsCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-400">${wo.estimatedLaborCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white">
                            {wo.status === 'Completed' ? `$${wo.actualLaborCost.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">${wo.estimatedTotal.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {wo.status === 'Completed' ? `$${wo.actualTotal.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {wo.status === 'Completed' ? (
                              <span className={`font-medium ${
                                wo.variance > 0 ? 'text-red-400' : wo.variance < 0 ? 'text-green-400' : 'text-slate-400'
                              }`}>
                                {wo.variance > 0 ? '+' : ''}{wo.variancePercent.toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setExpandedWorkOrder(expandedWorkOrder === wo.id ? null : wo.id)}
                              className="p-1 hover:bg-slate-700 rounded"
                            >
                              {expandedWorkOrder === wo.id ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                        </tr>
                        {expandedWorkOrder === wo.id && (
                          <tr className="bg-slate-900/30">
                            <td colSpan={10} className="px-4 py-4">
                              <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">Parts Used</p>
                                  {wo.parts && wo.parts.length > 0 ? (
                                    <ul className="space-y-1">
                                      {wo.parts.map((part, idx) => (
                                        <li key={idx} className="text-white text-sm flex justify-between">
                                          <span>{part.name} x{part.quantity}</span>
                                          <span className="text-slate-400">${((part.cost || 0) * (part.quantity || 0)).toLocaleString()}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-slate-500 text-sm">No parts recorded</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">Labor Details</p>
                                  <p className="text-white text-sm">Estimated: {wo.estimatedHours || 0} hours</p>
                                  <p className="text-white text-sm">Actual: {wo.actualHours || wo.estimatedHours || 0} hours</p>
                                  <p className="text-white text-sm">Rate: ${DEFAULT_HOURLY_RATE}/hour</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 text-sm mb-1">Notes</p>
                                  <p className="text-white text-sm">{wo.notes || 'No notes'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeView === 'categories' && (
          <div className="space-y-6">
            {/* Category Distribution Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4">Spending Distribution by Category</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySpending}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="parts" name="Parts" stackId="a" fill={COLORS.parts} />
                    <Bar dataKey="labor" name="Labor" stackId="a" fill={COLORS.labor} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorySpending.map(cat => (
                <div key={cat.category} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                        <Settings className="w-5 h-5" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{cat.category}</h4>
                        <p className="text-sm text-slate-400">{cat.count} work orders</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Estimated</span>
                      <span className="text-white">${cat.estimated.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Actual</span>
                      <span className="text-green-400 font-medium">${cat.actual.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Parts</span>
                      <span className="text-orange-400">${cat.parts.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Labor</span>
                      <span className="text-purple-400">${cat.labor.toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-700 flex justify-between">
                      <span className="text-slate-400 text-sm">Variance</span>
                      <span className={`font-medium ${
                        cat.variance > 0 ? 'text-red-400' : cat.variance < 0 ? 'text-green-400' : 'text-slate-400'
                      }`}>
                        {cat.variance > 0 ? '+' : ''}${cat.variance.toLocaleString()} ({cat.variancePercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {activeView === 'trends' && (
          <div className="space-y-6">
            {/* Monthly Spending Trend */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Monthly Spending Trend
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="colorParts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.parts} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.parts} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLabor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.labor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.labor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="parts" name="Parts" stroke={COLORS.parts} fillOpacity={1} fill="url(#colorParts)" />
                    <Area type="monotone" dataKey="labor" name="Labor" stroke={COLORS.labor} fillOpacity={1} fill="url(#colorLabor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Estimated vs Actual Trend */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4">Estimated vs Actual Over Time</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="estimated" name="Estimated" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                    <Line type="monotone" dataKey="total" name="Actual" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Summary Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="font-semibold text-white">Monthly Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm">
                      <th className="text-left px-4 py-3">Month</th>
                      <th className="text-right px-4 py-3">Parts</th>
                      <th className="text-right px-4 py-3">Labor</th>
                      <th className="text-right px-4 py-3">Vendors</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-right px-4 py-3">MoM Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((month, idx) => {
                      const prevMonth = monthlyTrend[idx - 1];
                      const change = prevMonth && prevMonth.total > 0 ? ((month.total - prevMonth.total) / prevMonth.total) * 100 : 0;
                      
                      return (
                        <tr key={month.month} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-white font-medium">{month.label}</td>
                          <td className="px-4 py-3 text-right text-orange-400">${month.parts.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-purple-400">${month.labor.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-cyan-400">${month.vendors.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">${month.total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {idx > 0 && prevMonth.total > 0 ? (
                              <span className={`font-medium ${
                                change > 0 ? 'text-red-400' : change < 0 ? 'text-green-400' : 'text-slate-400'
                              }`}>
                                {change > 0 ? '+' : ''}{change.toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Budget Planning Tab */}
        {activeView === 'budget' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Budget Summary */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  Budget Summary
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400">Total Budget (Estimated)</span>
                      <span className="text-2xl font-bold text-white">${stats.totalEstimated.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400">Actual Spending</span>
                      <span className="text-2xl font-bold text-green-400">${stats.totalActual.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${stats.totalEstimated > 0 ? Math.min((stats.totalActual / stats.totalEstimated) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      {stats.totalEstimated > 0 ? ((stats.totalActual / stats.totalEstimated) * 100).toFixed(1) : 0}% of budget used
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400">Pending Commitments</span>
                      <span className="text-2xl font-bold text-yellow-400">${stats.totalPending.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className="bg-yellow-500 h-3 rounded-full"
                        style={{ width: `${stats.totalEstimated > 0 ? Math.min((stats.totalPending / stats.totalEstimated) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-slate-900/50 to-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Remaining Budget</span>
                      <span className={`text-2xl font-bold ${
                        stats.totalEstimated - stats.totalActual - stats.totalPending >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${(stats.totalEstimated - stats.totalActual - stats.totalPending).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projected Costs */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Cost Projections
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Average Monthly Spend</p>
                    <p className="text-2xl font-bold text-white">
                      ${monthlyTrend.length > 0 ? 
                        (monthlyTrend.reduce((sum, m) => sum + m.total, 0) / monthlyTrend.filter(m => m.total > 0).length || 1).toLocaleString(undefined, { maximumFractionDigits: 0 }) 
                        : '0'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Projected Annual Spend</p>
                    <p className="text-2xl font-bold text-orange-400">
                      ${monthlyTrend.length > 0 ? 
                        ((monthlyTrend.reduce((sum, m) => sum + m.total, 0) / monthlyTrend.filter(m => m.total > 0).length || 1) * 12).toLocaleString(undefined, { maximumFractionDigits: 0 }) 
                        : '0'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Inventory Investment</p>
                    <p className="text-2xl font-bold text-cyan-400">${stats.inventoryValue.toLocaleString()}</p>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Vendor Commitments (YTD)</p>
                    <p className="text-2xl font-bold text-purple-400">${stats.vendorSpending.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Budget Recommendations */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Budget Insights & Recommendations
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.avgVariance > 10 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-white font-medium">High Budget Variance</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Average variance is {stats.avgVariance.toFixed(1)}% over budget. Consider reviewing estimation processes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {stats.overBudget > stats.underBudget && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-white font-medium">Cost Overruns Detected</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {stats.overBudget} work orders exceeded budget. Review labor hour estimates.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Budget Adherence</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {stats.completedCount > 0 ? (((stats.underBudget + stats.onBudget) / stats.completedCount) * 100).toFixed(0) : 0}% of work orders within budget.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Parts vs Labor Split</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Parts: {stats.totalPartsCost + stats.totalLaborCost > 0 ? ((stats.totalPartsCost / (stats.totalPartsCost + stats.totalLaborCost)) * 100).toFixed(0) : 0}% | 
                        Labor: {stats.totalPartsCost + stats.totalLaborCost > 0 ? ((stats.totalLaborCost / (stats.totalPartsCost + stats.totalLaborCost)) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Top Vendor Spend</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {vendorPerformance.length > 0 ? 
                          `${vendors.find(v => v.id === vendorPerformance.sort((a, b) => b.totalSpent - a.totalSpent)[0]?.vendorId)?.name || 'Unknown'}: $${vendorPerformance[0]?.totalSpent.toLocaleString()}` 
                          : 'No vendor data'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sponsor View Tab */}
        {activeView === 'sponsor' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 rounded-xl border border-orange-500/30 p-8">
              <div className="text-center">
                <h3 className="text-slate-400 text-lg mb-2">Total Season Investment</h3>
                <p className="text-5xl font-bold text-white mb-4">
                  ${(stats.totalActual + stats.vendorSpending).toLocaleString()}
                </p>
                <p className="text-slate-400">
                  Across {stats.completedCount} completed work orders and {purchaseOrders.filter(po => po.status === 'Received').length} vendor orders
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
                <Package className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Parts & Components</p>
                <p className="text-2xl font-bold text-white mt-1">${stats.totalPartsCost.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
                <Wrench className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Professional Labor</p>
                <p className="text-2xl font-bold text-white mt-1">${stats.totalLaborCost.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
                <Shield className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Inventory Value</p>
                <p className="text-2xl font-bold text-white mt-1">${stats.inventoryValue.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
                <Target className="w-8 h-8 text-green-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Budget Efficiency</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(100 - Math.abs(stats.avgVariance)).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Investment by Category for Sponsors */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-orange-400" />
                Investment Allocation
              </h3>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySpending.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        dataKey="actual"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categorySpending.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {categorySpending.slice(0, 6).map((cat, idx) => (
                    <div key={cat.category} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-white">{cat.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">${cat.actual.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{cat.count} work orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Sponsor Report Button */}
            <div className="flex justify-center">
              <button
                onClick={generateSponsorReport}
                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
              >
                <Printer className="w-5 h-5" />
                Generate Printable Sponsor Report
              </button>
            </div>
          </div>
        )}

        {/* Vendor Spending Summary Tab */}
        {activeView === 'vendorSpending' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-5 border border-orange-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Vendors</p>
                    <p className="text-2xl font-bold text-white">{vendorSpendingData.vendorCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-5 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Spend</p>
                    <p className="text-2xl font-bold text-green-400">${vendorSpendingData.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-5 border border-blue-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Transactions</p>
                    <p className="text-2xl font-bold text-white">{vendorSpendingData.totalTransactions}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-5 border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Avg per Vendor</p>
                    <p className="text-2xl font-bold text-white">
                      ${vendorSpendingData.vendorCount > 0 ? (vendorSpendingData.grandTotal / vendorSpendingData.vendorCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {vendorSpendingData.vendors.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Vendor Spending Data</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Vendor spending will appear here as you add parts to inventory, create purchase orders, and upload vendor invoices.
                </p>
              </div>
            ) : (
              <>
                {/* Horizontal Bar Chart — Top Vendors by Spend */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange-400" />
                    Top Vendors by Total Spend
                  </h3>
                  <div style={{ height: Math.max(280, vendorSpendingData.vendors.slice(0, 12).length * 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={vendorSpendingData.vendors.slice(0, 12)}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" width={140} tick={{ fontSize: 12 }} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm">
                                  <p className="text-white font-medium mb-2">{label}</p>
                                  <p className="text-orange-400">Parts: ${d.partsSpend.toLocaleString()}</p>
                                  <p className="text-blue-400">Purchase Orders: ${d.poSpend.toLocaleString()}</p>
                                  <p className="text-green-400">Invoices: ${d.invoiceSpend.toLocaleString()}</p>
                                  <p className="text-white font-medium mt-1 pt-1 border-t border-slate-700">Total: ${d.totalSpend.toLocaleString()}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar dataKey="partsSpend" name="Parts" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="poSpend" name="Purchase Orders" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="invoiceSpend" name="Invoices" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Ranked Vendor List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-400" />
                      Vendor Spending Breakdown
                    </h3>
                    <span className="text-sm text-slate-400">{vendorSpendingData.vendors.length} vendors</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-sm">
                          <th className="text-left px-4 py-3 w-10">Rank</th>
                          <th className="text-left px-4 py-3">Vendor</th>
                          <th className="text-right px-4 py-3">Parts</th>
                          <th className="text-right px-4 py-3">POs</th>
                          <th className="text-right px-4 py-3">Invoices</th>
                          <th className="text-right px-4 py-3">Total Spend</th>
                          <th className="text-center px-4 py-3">Transactions</th>
                          <th className="text-right px-4 py-3">Avg / Txn</th>
                          <th className="text-right px-4 py-3">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorSpendingData.vendors.map((v, idx) => {
                          const pctOfTotal = vendorSpendingData.grandTotal > 0 ? (v.totalSpend / vendorSpendingData.grandTotal) * 100 : 0;
                          return (
                            <tr key={v.name} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                              <td className="px-4 py-3">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-yellow-500 text-black' :
                                  idx === 1 ? 'bg-slate-400 text-black' :
                                  idx === 2 ? 'bg-orange-600 text-white' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${VENDOR_BAR_COLORS[idx % VENDOR_BAR_COLORS.length]}20` }}>
                                    <Building2 className="w-4 h-4" style={{ color: VENDOR_BAR_COLORS[idx % VENDOR_BAR_COLORS.length] }} />
                                  </div>
                                  <span className="text-white font-medium">{v.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-orange-400">{v.partsSpend > 0 ? `$${v.partsSpend.toLocaleString()}` : '-'}</td>
                              <td className="px-4 py-3 text-right text-blue-400">{v.poSpend > 0 ? `$${v.poSpend.toLocaleString()}` : '-'}</td>
                              <td className="px-4 py-3 text-right text-green-400">{v.invoiceSpend > 0 ? `$${v.invoiceSpend.toLocaleString()}` : '-'}</td>
                              <td className="px-4 py-3 text-right text-white font-semibold">${v.totalSpend.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center text-slate-300">{v.transactions}</td>
                              <td className="px-4 py-3 text-right text-slate-300">${v.avgPerTransaction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-700 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full"
                                      style={{
                                        width: `${Math.min(pctOfTotal, 100)}%`,
                                        backgroundColor: VENDOR_BAR_COLORS[idx % VENDOR_BAR_COLORS.length]
                                      }}
                                    />
                                  </div>
                                  <span className="text-slate-300 text-sm w-12 text-right">{pctOfTotal.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {vendorSpendingData.vendors.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-900/70 font-semibold">
                            <td className="px-4 py-3" colSpan={2}>
                              <span className="text-white">Totals</span>
                            </td>
                            <td className="px-4 py-3 text-right text-orange-400">
                              ${vendorSpendingData.vendors.reduce((s, v) => s + v.partsSpend, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-400">
                              ${vendorSpendingData.vendors.reduce((s, v) => s + v.poSpend, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-green-400">
                              ${vendorSpendingData.vendors.reduce((s, v) => s + v.invoiceSpend, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-white">${vendorSpendingData.grandTotal.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center text-white">{vendorSpendingData.totalTransactions}</td>
                            <td className="px-4 py-3 text-right text-white">
                              ${vendorSpendingData.totalTransactions > 0 ? (vendorSpendingData.grandTotal / vendorSpendingData.totalTransactions).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                            </td>
                            <td className="px-4 py-3 text-right text-white">100%</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Optimization Insights */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-yellow-400" />
                    Purchasing Optimization Insights
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vendorSpendingData.vendors.length >= 1 && (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <ArrowUpRight className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-white font-medium">Highest Spend Vendor</p>
                            <p className="text-sm text-slate-400 mt-1">
                              <span className="text-orange-400 font-medium">{vendorSpendingData.vendors[0].name}</span> accounts for{' '}
                              {vendorSpendingData.grandTotal > 0 ? ((vendorSpendingData.vendors[0].totalSpend / vendorSpendingData.grandTotal) * 100).toFixed(1) : 0}% of total spend
                              (${vendorSpendingData.vendors[0].totalSpend.toLocaleString()}). Consider negotiating volume discounts.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {vendorSpendingData.vendors.length >= 2 && (() => {
                      const topTwo = vendorSpendingData.vendors.slice(0, 2);
                      const topTwoPct = vendorSpendingData.grandTotal > 0 ? ((topTwo[0].totalSpend + topTwo[1].totalSpend) / vendorSpendingData.grandTotal) * 100 : 0;
                      return topTwoPct > 60 ? (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-white font-medium">Vendor Concentration Risk</p>
                              <p className="text-sm text-slate-400 mt-1">
                                Top 2 vendors represent {topTwoPct.toFixed(0)}% of spending. Consider diversifying suppliers to reduce supply chain risk.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-white font-medium">Good Vendor Diversification</p>
                              <p className="text-sm text-slate-400 mt-1">
                                Spending is well-distributed across {vendorSpendingData.vendorCount} vendors, reducing supply chain risk.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {vendorSpendingData.vendors.some(v => v.transactions >= 3 && v.avgPerTransaction > 500) && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <DollarSign className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-white font-medium">Bulk Order Opportunity</p>
                            <p className="text-sm text-slate-400 mt-1">
                              {vendorSpendingData.vendors.filter(v => v.transactions >= 3 && v.avgPerTransaction > 500).map(v => v.name).slice(0, 2).join(', ')} have
                              frequent high-value orders. Consolidating into bulk POs could yield savings.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!vendorSpendingData.vendors.some(v => v.transactions >= 3 && v.avgPerTransaction > 500) && (
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <History className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-white font-medium">Track More Data</p>
                            <p className="text-sm text-slate-400 mt-1">
                              Continue logging purchases and invoices to unlock deeper cost optimization recommendations over time.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default CostAnalytics;
