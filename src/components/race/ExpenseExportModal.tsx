import React, { useState, useMemo } from 'react';
import {
  X, Download, FileText, FileSpreadsheet, Calendar, Flag,
  CreditCard, Printer, ChevronRight, CheckCircle2, Info,
  BarChart3, Building2, Loader2
} from 'lucide-react';
import DateInputDark from '@/components/ui/DateInputDark';
import {
  exportToCSV,
  exportSummaryPDF,
  exportPerEventPDF,
  exportMonthlyStatementPDF,
  exportPerEventCSV,
  type ExportableExpense,
  type ExportOptions
} from '@/lib/expenseExport';

interface ExpenseExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExportableExpense[];
  teamName?: string;
  defaultTab?: 'csv' | 'pdf' | 'event' | 'monthly';
}

type ExportType = 'csv' | 'summary-pdf' | 'event-pdf' | 'event-csv' | 'monthly-pdf';

interface ExportOption {
  id: ExportType;
  title: string;
  description: string;
  icon: React.ElementType;
  format: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'csv',
    title: 'Export All to CSV',
    description: 'Download all expense data as a CSV spreadsheet with every field — perfect for Excel or Google Sheets.',
    icon: FileSpreadsheet,
    format: 'CSV',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
  },
  {
    id: 'summary-pdf',
    title: 'Summary Report (PDF)',
    description: 'Professional formatted report with category breakdowns, totals, payment method analysis, and a detailed expense list.',
    icon: BarChart3,
    format: 'PDF',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30',
  },
  {
    id: 'event-pdf',
    title: 'Per-Event Report (PDF)',
    description: 'Expenses grouped by race event with per-event totals and category breakdowns — ideal for sponsor reporting.',
    icon: Flag,
    format: 'PDF',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'event-csv',
    title: 'Per-Event Report (CSV)',
    description: 'Expenses grouped by race event in spreadsheet format with subtotals per event.',
    icon: Flag,
    format: 'CSV',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/30',
  },
  {
    id: 'monthly-pdf',
    title: 'Monthly Statement (PDF)',
    description: 'Credit-card-style monthly statement with running totals, opening/closing balances, and monthly summaries.',
    icon: CreditCard,
    format: 'PDF',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
  },
];

const ExpenseExportModal: React.FC<ExpenseExportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  teamName,
  defaultTab,
}) => {
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [lastExported, setLastExported] = useState<ExportType | null>(null);

  // Preview stats based on date range
  const previewStats = useMemo(() => {
    let filtered = [...expenses];
    if (dateStart) filtered = filtered.filter(e => e.expense_date >= dateStart);
    if (dateEnd) filtered = filtered.filter(e => e.expense_date <= dateEnd);
    const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
    const events = new Set(filtered.filter(e => e.race_event_id).map(e => e.race_event_id)).size;

    const months = new Set(filtered.map(e => e.expense_date.substring(0, 7))).size;
    return { count: filtered.length, total, events, months };
  }, [expenses, dateStart, dateEnd]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    const options: ExportOptions = {
      teamName: teamName || 'Race Team',
      dateRangeStart: dateStart || undefined,
      dateRangeEnd: dateEnd || undefined,
    };

    // Small delay for UX feedback
    await new Promise(r => setTimeout(r, 300));

    try {
      switch (type) {
        case 'csv':
          exportToCSV(expenses, options);
          break;
        case 'summary-pdf':
          exportSummaryPDF(expenses, options);
          break;
        case 'event-pdf':
          exportPerEventPDF(expenses, options);
          break;
        case 'event-csv':
          exportPerEventCSV(expenses, options);
          break;
        case 'monthly-pdf':
          exportMonthlyStatementPDF(expenses, options);
          break;
      }
      setLastExported(type);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Export Expenses</h3>
              <p className="text-sm text-slate-400">Generate reports and download expense data</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Date Range Filter */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-orange-400" />
              <h4 className="text-sm font-semibold text-white">Date Range (Optional)</h4>
              <span className="text-xs text-slate-500 ml-auto">Leave blank for all time</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <DateInputDark
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <DateInputDark
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              {(dateStart || dateEnd) && (
                <button
                  onClick={() => { setDateStart(''); setDateEnd(''); }}
                  className="px-3 py-2 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors mt-4"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Preview Stats */}
            <div className="mt-3 flex flex-wrap gap-4 pt-3 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-slate-400">
                  <span className="text-white font-medium">{previewStats.count}</span> expenses
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-xs text-slate-400">
                  <span className="text-white font-medium">{formatCurrency(previewStats.total)}</span> total
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs text-slate-400">
                  <span className="text-white font-medium">{previewStats.events}</span> events
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-xs text-slate-400">
                  <span className="text-white font-medium">{previewStats.months}</span> month(s)
                </span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Printer className="w-4 h-4 text-slate-500" />
              Choose Export Format
            </h4>

            {EXPORT_OPTIONS.map(opt => {
              const isExporting = exporting === opt.id;
              const wasExported = lastExported === opt.id;
              const Icon = opt.icon;

              return (
                <button
                  key={opt.id}
                  onClick={() => handleExport(opt.id)}
                  disabled={!!exporting || previewStats.count === 0}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${
                    previewStats.count === 0
                      ? 'opacity-40 cursor-not-allowed bg-slate-900/30 border-slate-700/30'
                      : isExporting
                      ? `${opt.bgColor} ${opt.borderColor} ring-2 ring-offset-2 ring-offset-slate-800`
                      : wasExported
                      ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/15'
                      : `bg-slate-900/30 border-slate-700/50 hover:${opt.bgColor} hover:${opt.borderColor}`
                  }`}
                  style={isExporting ? { ringColor: opt.color } : undefined}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    wasExported ? 'bg-green-500/20' : opt.bgColor
                  }`}>
                    {isExporting ? (
                      <Loader2 className={`w-5 h-5 ${opt.color} animate-spin`} />
                    ) : wasExported ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Icon className={`w-5 h-5 ${opt.color}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{opt.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        opt.format === 'CSV'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {opt.format}
                      </span>
                      {wasExported && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                          Exported
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{opt.description}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                    previewStats.count === 0 ? 'text-slate-600' : 'text-slate-500 group-hover:text-white group-hover:translate-x-0.5'
                  }`} />
                </button>
              );
            })}
          </div>

          {/* Info note */}
          {previewStats.count === 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                No expenses match the selected date range. Adjust the date filter or clear it to include all expenses.
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              <strong className="text-slate-400">PDF reports</strong> open in a new window for printing. Use your browser's "Save as PDF" option in the print dialog to save as a file.
              <strong className="text-slate-400 ml-1">CSV files</strong> download directly and can be opened in Excel, Google Sheets, or any spreadsheet app.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseExportModal;
