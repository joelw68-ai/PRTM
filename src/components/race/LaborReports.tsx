import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { DailyLaborEntry } from './LaborTracking';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart,
  ArrowRight,
  Printer,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Sun,
  Flag,
  Building,
  User,
  CalendarDays,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface LaborReportsProps {
  laborEntries: DailyLaborEntry[];
}

interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  totalCost: number;
  totalHours: number;
  totalDays: number;
  entries: number;
  byMember: Record<string, { cost: number; hours: number; days: number }>;
  byCategory: Record<string, { cost: number; hours: number; days: number }>;
  byEvent: Record<string, { cost: number; eventName: string }>;
}

interface QuarterlyData {
  quarter: string;
  year: number;
  quarterNum: number;
  totalCost: number;
  totalHours: number;
  totalDays: number;
  entries: number;
  months: MonthlyData[];
}

const LaborReports: React.FC<LaborReportsProps> = ({ laborEntries }) => {
  const { teamMembers, raceEvents } = useApp();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly' | 'comparison' | 'trends'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'all'>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [comparisonMetric, setComparisonMetric] = useState<'cost' | 'hours' | 'entries'>('cost');

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    laborEntries.forEach(entry => {
      years.add(new Date(entry.date).getFullYear());
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [laborEntries]);

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    const months: Record<string, MonthlyData> = {};
    
    laborEntries.forEach(entry => {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      const monthNum = date.getMonth();
      const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthName,
          year,
          monthNum,
          totalCost: 0,
          totalHours: 0,
          totalDays: 0,
          entries: 0,
          byMember: {},
          byCategory: {},
          byEvent: {}
        };
      }
      
      months[monthKey].totalCost += entry.totalCost;
      months[monthKey].entries += 1;
      
      if (entry.rateType === 'hourly') {
        months[monthKey].totalHours += entry.hours;
      } else {
        months[monthKey].totalDays += 1;
      }
      
      // By member
      if (!months[monthKey].byMember[entry.teamMemberName]) {
        months[monthKey].byMember[entry.teamMemberName] = { cost: 0, hours: 0, days: 0 };
      }
      months[monthKey].byMember[entry.teamMemberName].cost += entry.totalCost;
      if (entry.rateType === 'hourly') {
        months[monthKey].byMember[entry.teamMemberName].hours += entry.hours;
      } else {
        months[monthKey].byMember[entry.teamMemberName].days += 1;
      }
      
      // By category
      if (!months[monthKey].byCategory[entry.category]) {
        months[monthKey].byCategory[entry.category] = { cost: 0, hours: 0, days: 0 };
      }
      months[monthKey].byCategory[entry.category].cost += entry.totalCost;
      if (entry.rateType === 'hourly') {
        months[monthKey].byCategory[entry.category].hours += entry.hours;
      } else {
        months[monthKey].byCategory[entry.category].days += 1;
      }
      
      // By event
      const eventKey = entry.eventId || 'unassigned';
      if (!months[monthKey].byEvent[eventKey]) {
        months[monthKey].byEvent[eventKey] = { cost: 0, eventName: entry.eventName || 'Unassigned' };
      }
      months[monthKey].byEvent[eventKey].cost += entry.totalCost;
    });
    
    return Object.values(months).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.monthNum - a.monthNum;
    });
  }, [laborEntries]);

  // Filter monthly data by year
  const filteredMonthlyData = useMemo(() => {
    return monthlyData.filter(m => m.year === selectedYear);
  }, [monthlyData, selectedYear]);

  // Calculate quarterly data
  const quarterlyData = useMemo(() => {
    const quarters: Record<string, QuarterlyData> = {};
    
    filteredMonthlyData.forEach(month => {
      const quarterNum = Math.floor(month.monthNum / 3) + 1;
      const quarterKey = `${month.year}-Q${quarterNum}`;
      
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = {
          quarter: `Q${quarterNum}`,
          year: month.year,
          quarterNum,
          totalCost: 0,
          totalHours: 0,
          totalDays: 0,
          entries: 0,
          months: []
        };
      }
      
      quarters[quarterKey].totalCost += month.totalCost;
      quarters[quarterKey].totalHours += month.totalHours;
      quarters[quarterKey].totalDays += month.totalDays;
      quarters[quarterKey].entries += month.entries;
      quarters[quarterKey].months.push(month);
    });
    
    return Object.values(quarters).sort((a, b) => b.quarterNum - a.quarterNum);
  }, [filteredMonthlyData]);

  // Filter quarterly data
  const filteredQuarterlyData = useMemo(() => {
    if (selectedQuarter === 'all') return quarterlyData;
    return quarterlyData.filter(q => q.quarterNum === selectedQuarter);
  }, [quarterlyData, selectedQuarter]);

  // Team member comparison data
  const memberComparisonData = useMemo(() => {
    const members: Record<string, { 
      name: string; 
      totalCost: number; 
      totalHours: number; 
      totalDays: number;
      entries: number;
      monthlyData: { month: string; cost: number }[];
    }> = {};
    
    filteredMonthlyData.forEach(month => {
      Object.entries(month.byMember).forEach(([name, data]) => {
        if (!members[name]) {
          members[name] = { 
            name, 
            totalCost: 0, 
            totalHours: 0, 
            totalDays: 0,
            entries: 0,
            monthlyData: []
          };
        }
        members[name].totalCost += data.cost;
        members[name].totalHours += data.hours;
        members[name].totalDays += data.days;
        members[name].monthlyData.push({ month: month.month, cost: data.cost });
      });
    });
    
    // Count entries per member
    laborEntries.forEach(entry => {
      const date = new Date(entry.date);
      if (date.getFullYear() === selectedYear) {
        if (members[entry.teamMemberName]) {
          members[entry.teamMemberName].entries += 1;
        }
      }
    });
    
    return Object.values(members).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredMonthlyData, laborEntries, selectedYear]);

  // Trend data for chart
  const trendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data: { month: string; cost: number; hours: number; entries: number }[] = [];
    
    monthNames.forEach((name, index) => {
      const monthData = filteredMonthlyData.find(m => m.monthNum === index);
      data.push({
        month: name,
        cost: monthData?.totalCost || 0,
        hours: monthData?.totalHours || 0,
        entries: monthData?.entries || 0
      });
    });
    
    return data;
  }, [filteredMonthlyData]);

  // Year totals
  const yearTotals = useMemo(() => {
    return filteredMonthlyData.reduce((acc, month) => ({
      cost: acc.cost + month.totalCost,
      hours: acc.hours + month.totalHours,
      days: acc.days + month.totalDays,
      entries: acc.entries + month.entries
    }), { cost: 0, hours: 0, days: 0, entries: 0 });
  }, [filteredMonthlyData]);

  // Calculate month-over-month change
  const getMonthChange = (currentIndex: number) => {
    if (currentIndex >= filteredMonthlyData.length - 1) return null;
    const current = filteredMonthlyData[currentIndex].totalCost;
    const previous = filteredMonthlyData[currentIndex + 1].totalCost;
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const toggleMonthExpanded = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Generate PDF report
  const generatePDFReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate the PDF report');
      return;
    }

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Labor Cost Report - ${selectedYear}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #1e293b; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
          h2 { color: #475569; margin-top: 30px; }
          h3 { color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
          th { background-color: #f8fafc; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 24px; font-weight: bold; color: #f97316; }
          .summary-label { color: #64748b; font-size: 14px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Labor Cost Report</h1>
        <p><strong>Year:</strong> ${selectedYear}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        
        <div class="summary-box">
          <h2 style="margin-top: 0;">Annual Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">$${yearTotals.cost.toLocaleString()}</div>
              <div class="summary-label">Total Labor Cost</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${yearTotals.hours.toFixed(1)}</div>
              <div class="summary-label">Total Hours</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${yearTotals.days}</div>
              <div class="summary-label">Total Days</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${yearTotals.entries}</div>
              <div class="summary-label">Total Entries</div>
            </div>
          </div>
        </div>

        <h2>Monthly Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Cost</th>
              <th>Hours</th>
              <th>Days</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMonthlyData.map(month => `
              <tr>
                <td>${month.month} ${month.year}</td>
                <td>$${month.totalCost.toLocaleString()}</td>
                <td>${month.totalHours.toFixed(1)}</td>
                <td>${month.totalDays}</td>
                <td>${month.entries}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #f1f5f9;">
              <td>Total</td>
              <td>$${yearTotals.cost.toLocaleString()}</td>
              <td>${yearTotals.hours.toFixed(1)}</td>
              <td>${yearTotals.days}</td>
              <td>${yearTotals.entries}</td>
            </tr>
          </tfoot>
        </table>

        <h2>Quarterly Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Total Cost</th>
              <th>Hours</th>
              <th>Days</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            ${quarterlyData.map(q => `
              <tr>
                <td>${q.quarter} ${q.year}</td>
                <td>$${q.totalCost.toLocaleString()}</td>
                <td>${q.totalHours.toFixed(1)}</td>
                <td>${q.totalDays}</td>
                <td>${q.entries}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Team Member Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Team Member</th>
              <th>Total Cost</th>
              <th>Hours</th>
              <th>Days</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            ${memberComparisonData.map(member => `
              <tr>
                <td>${member.name}</td>
                <td>$${member.totalCost.toLocaleString()}</td>
                <td>${member.totalHours.toFixed(1)}</td>
                <td>${member.totalDays}</td>
                <td>${member.entries}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated automatically from the Race Team Labor Tracking System.</p>
          <p>For accounting purposes only. Please verify all figures before submission.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.print();
  };

  // Export to CSV
  const exportToCSV = () => {
    let csv = '';
    
    // Monthly summary
    csv += 'MONTHLY SUMMARY\n';
    csv += 'Month,Year,Total Cost,Hours,Days,Entries\n';
    filteredMonthlyData.forEach(month => {
      csv += `${month.month},${month.year},${month.totalCost},${month.totalHours},${month.totalDays},${month.entries}\n`;
    });
    
    csv += '\nQUARTERLY SUMMARY\n';
    csv += 'Quarter,Year,Total Cost,Hours,Days,Entries\n';
    quarterlyData.forEach(q => {
      csv += `${q.quarter},${q.year},${q.totalCost},${q.totalHours},${q.totalDays},${q.entries}\n`;
    });
    
    csv += '\nTEAM MEMBER SUMMARY\n';
    csv += 'Name,Total Cost,Hours,Days,Entries\n';
    memberComparisonData.forEach(member => {
      csv += `${member.name},${member.totalCost},${member.totalHours},${member.totalDays},${member.entries}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labor_report_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Shop Work': return 'bg-blue-500';
      case 'Race Day': return 'bg-green-500';
      case 'Travel': return 'bg-purple-500';
      case 'Maintenance': return 'bg-orange-500';
      case 'Fabrication': return 'bg-cyan-500';
      default: return 'bg-slate-500';
    }
  };

  const maxCost = Math.max(...trendData.map(d => d.cost), 1);

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-400" />
            Labor Cost Reports
          </h3>
          <p className="text-slate-400 text-sm">Monthly/quarterly summaries, trends, and team comparisons</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={generatePDFReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            <Printer className="w-4 h-4" />
            Generate PDF
          </button>
        </div>
      </div>

      {/* Year Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">{selectedYear} Total</p>
              <p className="text-xl font-bold text-green-400">${yearTotals.cost.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Hours</p>
              <p className="text-xl font-bold text-white">{yearTotals.hours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
              <Sun className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Days</p>
              <p className="text-xl font-bold text-white">{yearTotals.days}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Avg/Month</p>
              <p className="text-xl font-bold text-white">
                ${filteredMonthlyData.length > 0 ? Math.round(yearTotals.cost / filteredMonthlyData.length).toLocaleString() : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Monthly
          </button>
          <button
            onClick={() => setViewMode('quarterly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'quarterly' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Quarterly
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'comparison' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Comparison
          </button>
          <button
            onClick={() => setViewMode('trends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'trends' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trends
          </button>
        </div>
      </div>

      {/* Monthly View */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          {filteredMonthlyData.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No labor entries found for {selectedYear}</p>
            </div>
          ) : (
            filteredMonthlyData.map((month, index) => {
              const monthKey = `${month.year}-${month.monthNum}`;
              const isExpanded = expandedMonths.has(monthKey);
              const change = getMonthChange(index);
              
              return (
                <div key={monthKey} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <button
                    onClick={() => toggleMonthExpanded(monthKey)}
                    className="w-full p-5 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <CalendarDays className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-semibold text-white">{month.month} {month.year}</h4>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>{month.totalHours.toFixed(1)} hours</span>
                          <span>{month.totalDays} days</span>
                          <span>{month.entries} entries</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {change !== null && (
                        <div className={`flex items-center gap-1 text-sm ${
                          change > 0 ? 'text-red-400' : change < 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {change > 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : change < 0 ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <Minus className="w-4 h-4" />
                          )}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      )}
                      <p className="text-2xl font-bold text-green-400">${month.totalCost.toLocaleString()}</p>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 p-5">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* By Team Member */}
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            By Team Member
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(month.byMember)
                              .sort((a, b) => b[1].cost - a[1].cost)
                              .map(([name, data]) => (
                                <div key={name} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                                  <span className="text-white text-sm">{name}</span>
                                  <span className="text-green-400 font-medium">${data.cost.toLocaleString()}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                        
                        {/* By Category */}
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            By Category
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(month.byCategory)
                              .sort((a, b) => b[1].cost - a[1].cost)
                              .map(([category, data]) => (
                                <div key={category} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getCategoryColor(category)}`} />
                                    <span className="text-white text-sm">{category}</span>
                                  </div>
                                  <span className="text-green-400 font-medium">${data.cost.toLocaleString()}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                        
                        {/* By Event */}
                        <div>
                          <h5 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <Flag className="w-4 h-4" />
                            By Event
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(month.byEvent)
                              .sort((a, b) => b[1].cost - a[1].cost)
                              .slice(0, 5)
                              .map(([eventId, data]) => (
                                <div key={eventId} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                                  <span className="text-white text-sm truncate max-w-[150px]">{data.eventName}</span>
                                  <span className="text-green-400 font-medium">${data.cost.toLocaleString()}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quarterly View */}
      {viewMode === 'quarterly' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedQuarter === 'all' ? 'all' : selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="all">All Quarters</option>
              <option value="1">Q1 (Jan-Mar)</option>
              <option value="2">Q2 (Apr-Jun)</option>
              <option value="3">Q3 (Jul-Sep)</option>
              <option value="4">Q4 (Oct-Dec)</option>
            </select>
          </div>
          
          {filteredQuarterlyData.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No data for selected quarter</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredQuarterlyData.map(quarter => (
                <div key={`${quarter.year}-${quarter.quarter}`} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-purple-400 font-bold">{quarter.quarter}</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">{quarter.quarter} {quarter.year}</h4>
                        <p className="text-slate-400 text-sm">{quarter.entries} entries</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">${quarter.totalCost.toLocaleString()}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Hours</p>
                      <p className="text-white font-semibold">{quarter.totalHours.toFixed(1)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Days</p>
                      <p className="text-white font-semibold">{quarter.totalDays}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">Avg/Month</p>
                      <p className="text-white font-semibold">
                        ${quarter.months.length > 0 ? Math.round(quarter.totalCost / quarter.months.length).toLocaleString() : 0}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-slate-400 text-sm">Monthly Breakdown:</p>
                    {quarter.months
                      .sort((a, b) => a.monthNum - b.monthNum)
                      .map(month => (
                        <div key={month.month} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                          <span className="text-white text-sm">{month.month}</span>
                          <span className="text-green-400 font-medium">${month.totalCost.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Comparison View */}
      {viewMode === 'comparison' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-slate-400 text-sm">Compare by:</span>
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setComparisonMetric('cost')}
                className={`px-3 py-1 rounded text-sm ${comparisonMetric === 'cost' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
              >
                Cost
              </button>
              <button
                onClick={() => setComparisonMetric('hours')}
                className={`px-3 py-1 rounded text-sm ${comparisonMetric === 'hours' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
              >
                Hours
              </button>
              <button
                onClick={() => setComparisonMetric('entries')}
                className={`px-3 py-1 rounded text-sm ${comparisonMetric === 'entries' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
              >
                Entries
              </button>
            </div>
          </div>
          
          {memberComparisonData.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No team member data for {selectedYear}</p>
            </div>
          ) : (
            <>
              {/* Bar Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Team Member Comparison - {comparisonMetric === 'cost' ? 'Total Cost' : comparisonMetric === 'hours' ? 'Total Hours' : 'Total Entries'}
                </h4>
                <div className="space-y-3">
                  {memberComparisonData.map((member, index) => {
                    const value = comparisonMetric === 'cost' ? member.totalCost : comparisonMetric === 'hours' ? member.totalHours : member.entries;
                    const maxValue = Math.max(...memberComparisonData.map(m => 
                      comparisonMetric === 'cost' ? m.totalCost : comparisonMetric === 'hours' ? m.totalHours : m.entries
                    ), 1);
                    const percentage = (value / maxValue) * 100;
                    const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500'];
                    
                    return (
                      <div key={member.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm">{member.name}</span>
                          <span className="text-slate-400 text-sm">
                            {comparisonMetric === 'cost' ? `$${value.toLocaleString()}` : value.toFixed(comparisonMetric === 'hours' ? 1 : 0)}
                          </span>
                        </div>
                        <div className="h-6 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${colors[index % colors.length]} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Detailed Table */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 text-sm">
                        <th className="text-left px-4 py-3">Team Member</th>
                        <th className="text-right px-4 py-3">Total Cost</th>
                        <th className="text-right px-4 py-3">Hours</th>
                        <th className="text-right px-4 py-3">Days</th>
                        <th className="text-right px-4 py-3">Entries</th>
                        <th className="text-right px-4 py-3">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberComparisonData.map(member => (
                        <tr key={member.name} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                              <span className="text-white">{member.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-green-400 font-medium">${member.totalCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white">{member.totalHours.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-white">{member.totalDays}</td>
                          <td className="px-4 py-3 text-right text-white">{member.entries}</td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {yearTotals.cost > 0 ? ((member.totalCost / yearTotals.cost) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900/50 font-semibold">
                        <td className="px-4 py-3 text-white">Total</td>
                        <td className="px-4 py-3 text-right text-green-400">${yearTotals.cost.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-white">{yearTotals.hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-white">{yearTotals.days}</td>
                        <td className="px-4 py-3 text-right text-white">{yearTotals.entries}</td>
                        <td className="px-4 py-3 text-right text-slate-400">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-6">
          {/* Cost Trend Chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Labor Cost Trend - {selectedYear}
            </h4>
            <div className="h-64 flex items-end gap-2">
              {trendData.map((data, index) => {
                const height = maxCost > 0 ? (data.cost / maxCost) * 100 : 0;
                const isCurrentMonth = index === new Date().getMonth() && selectedYear === new Date().getFullYear();
                
                return (
                  <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end h-48">
                      {data.cost > 0 && (
                        <span className="text-xs text-slate-400 mb-1">${(data.cost / 1000).toFixed(1)}k</span>
                      )}
                      <div 
                        className={`w-full rounded-t transition-all duration-500 ${
                          isCurrentMonth ? 'bg-green-500' : data.cost > 0 ? 'bg-green-500/60' : 'bg-slate-700'
                        }`}
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                    <span className={`text-xs ${isCurrentMonth ? 'text-green-400 font-medium' : 'text-slate-400'}`}>
                      {data.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend Statistics */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Highest Month */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Highest Month</p>
                  <p className="text-white font-semibold">
                    {filteredMonthlyData.length > 0 
                      ? filteredMonthlyData.reduce((max, m) => m.totalCost > max.totalCost ? m : max, filteredMonthlyData[0]).month
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold text-red-400">
                ${filteredMonthlyData.length > 0 
                  ? Math.max(...filteredMonthlyData.map(m => m.totalCost)).toLocaleString()
                  : 0
                }
              </p>
            </div>

            {/* Lowest Month */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Lowest Month</p>
                  <p className="text-white font-semibold">
                    {filteredMonthlyData.length > 0 
                      ? filteredMonthlyData.reduce((min, m) => m.totalCost < min.totalCost ? m : min, filteredMonthlyData[0]).month
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-400">
                ${filteredMonthlyData.length > 0 
                  ? Math.min(...filteredMonthlyData.map(m => m.totalCost)).toLocaleString()
                  : 0
                }
              </p>
            </div>

            {/* Average */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Monthly Average</p>
                  <p className="text-white font-semibold">{filteredMonthlyData.length} months</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                ${filteredMonthlyData.length > 0 
                  ? Math.round(yearTotals.cost / filteredMonthlyData.length).toLocaleString()
                  : 0
                }
              </p>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              Category Distribution - {selectedYear}
            </h4>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {(() => {
                  const categoryTotals: Record<string, number> = {};
                  filteredMonthlyData.forEach(month => {
                    Object.entries(month.byCategory).forEach(([cat, data]) => {
                      categoryTotals[cat] = (categoryTotals[cat] || 0) + data.cost;
                    });
                  });
                  
                  return Object.entries(categoryTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, cost]) => {
                      const percentage = yearTotals.cost > 0 ? (cost / yearTotals.cost) * 100 : 0;
                      return (
                        <div key={category}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getCategoryColor(category)}`} />
                              <span className="text-white text-sm">{category}</span>
                            </div>
                            <span className="text-slate-400 text-sm">${cost.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getCategoryColor(category)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
              
              {/* Visual Pie Chart Representation */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  {(() => {
                    const categoryTotals: Record<string, number> = {};
                    filteredMonthlyData.forEach(month => {
                      Object.entries(month.byCategory).forEach(([cat, data]) => {
                        categoryTotals[cat] = (categoryTotals[cat] || 0) + data.cost;
                      });
                    });
                    
                    const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
                    let cumulativePercentage = 0;
                    
                    const gradientStops = categories.map(([category, cost]) => {
                      const percentage = yearTotals.cost > 0 ? (cost / yearTotals.cost) * 100 : 0;
                      const start = cumulativePercentage;
                      cumulativePercentage += percentage;
                      const colorMap: Record<string, string> = {
                        'Shop Work': '#3b82f6',
                        'Race Day': '#22c55e',
                        'Travel': '#a855f7',
                        'Maintenance': '#f97316',
                        'Fabrication': '#06b6d4',
                        'Other': '#64748b'
                      };
                      return `${colorMap[category] || '#64748b'} ${start}% ${cumulativePercentage}%`;
                    });
                    
                    return (
                      <div 
                        className="w-full h-full rounded-full"
                        style={{
                          background: categories.length > 0 
                            ? `conic-gradient(${gradientStops.join(', ')})`
                            : '#334155'
                        }}
                      >
                        <div className="absolute inset-8 bg-slate-800 rounded-full flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-white">${(yearTotals.cost / 1000).toFixed(1)}k</p>
                            <p className="text-slate-400 text-xs">Total</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborReports;
