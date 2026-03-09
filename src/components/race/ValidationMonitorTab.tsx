import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Trash2,
  Filter,
  ChevronDown,
  ChevronUp,
  Table2,
  Clock,
  Search,
  X,
  ShieldAlert,
  FileWarning,
  Eye,
} from 'lucide-react';
import {
  subscribe,
  getWarnings,
  getTableSummaries,
  getTableNames,
  getWarningCount,
  clearWarnings,
  type ValidationWarning,
  type TableSummary,
} from '@/lib/validationWarningStore';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryCard: React.FC<{
  summary: TableSummary;
  isSelected: boolean;
  onClick: () => void;
}> = ({ summary, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col gap-1 px-3 py-2 rounded-lg border text-left transition-all text-xs min-w-[160px] ${
      isSelected
        ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
        : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70 hover:border-slate-600/50'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono font-semibold text-amber-300 truncate">
        {summary.table}
      </span>
      <span
        className={`flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold ${
          isSelected
            ? 'bg-amber-500/30 text-amber-200'
            : 'bg-red-500/20 text-red-300'
        }`}
      >
        {summary.warningCount}
      </span>
    </div>
    <div className="text-[10px] text-slate-400 leading-snug truncate">
      Fields: {summary.failedFields.slice(0, 4).join(', ')}
      {summary.failedFields.length > 4 && ` +${summary.failedFields.length - 4}`}
    </div>
    <div className="text-[10px] text-slate-500">
      Last: {formatTimeShort(summary.lastSeen)}
    </div>
  </button>
);

const IssueRow: React.FC<{
  warning: ValidationWarning;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ warning, isExpanded, onToggle }) => (
  <>
    <tr
      className={`border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/30 ${
        isExpanded ? 'bg-amber-950/20' : ''
      }`}
      onClick={onToggle}
    >
      <td className="py-1.5 px-3 text-slate-600 font-mono text-[11px]">
        {warning.id}
      </td>
      <td className="py-1.5 px-2 text-slate-400 font-mono whitespace-nowrap text-[11px]">
        {formatTimeFull(warning.timestamp)}
      </td>
      <td className="py-1.5 px-2">
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-400/10 text-amber-400 tracking-wider">
          {warning.table}
        </span>
      </td>
      <td className="py-1.5 px-2 text-slate-400 font-mono text-[11px] text-center">
        {warning.rowIndex}
      </td>
      <td className="py-1.5 px-2 text-[11px]">
        <div className="flex items-center gap-1.5 max-w-[400px]">
          <span className="text-red-300 truncate">
            {warning.issues.map(i => i.path).join(', ')}
          </span>
          <span className="text-slate-600 flex-shrink-0">
            ({warning.issues.length} issue{warning.issues.length !== 1 ? 's' : ''})
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
          )}
        </div>
      </td>
    </tr>
    {isExpanded && (
      <tr className="bg-slate-900/60">
        <td colSpan={5} className="px-4 py-3">
          {/* Field issues */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" />
              Field Issues
            </div>
            <div className="space-y-1">
              {warning.issues.map((iss, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-[11px] font-mono bg-slate-800/50 rounded px-3 py-1.5 border border-slate-700/30"
                >
                  <span className="text-amber-400 font-semibold min-w-[100px] truncate flex-shrink-0">
                    {iss.path}
                  </span>
                  <span className="text-slate-500 min-w-[90px] flex-shrink-0">
                    [{iss.code}]
                  </span>
                  <span className="text-slate-300 flex-1">{iss.message}</span>
                  {iss.received && (
                    <span className="text-red-400/70 text-[10px] flex-shrink-0 max-w-[120px] truncate">
                      got: {iss.received}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Raw row */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              Raw Row (row index {warning.rowIndex})
            </div>
            <pre className="text-[10px] leading-relaxed font-mono text-slate-400 bg-slate-950/60 rounded px-3 py-2 border border-slate-700/30 overflow-x-auto whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
              {formatJson(warning.rawRowSnippet)}
            </pre>
          </div>
        </td>
      </tr>
    )}
  </>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ValidationMonitorTab: React.FC = () => {
  const [warnings, setWarnings] = useState<ValidationWarning[]>(getWarnings());
  const [summaries, setSummaries] = useState<TableSummary[]>(getTableSummaries());
  const [totalCount, setTotalCount] = useState(getWarningCount());
  const [tableFilter, setTableFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCount, setShowCount] = useState(20);

  // Subscribe to store updates
  useEffect(() => {
    const unsub = subscribe(() => {
      setWarnings(getWarnings());
      setSummaries(getTableSummaries());
      setTotalCount(getWarningCount());
    });
    return unsub;
  }, []);

  // Filtered warnings
  const filteredWarnings = useMemo(() => {
    let result = warnings;

    if (tableFilter) {
      result = result.filter(w => w.table === tableFilter);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        w =>
          w.table.toLowerCase().includes(q) ||
          w.issues.some(
            i =>
              i.path.toLowerCase().includes(q) ||
              i.message.toLowerCase().includes(q) ||
              i.code.toLowerCase().includes(q)
          ) ||
          w.rawRowSnippet.toLowerCase().includes(q)
      );
    }

    return result;
  }, [warnings, tableFilter, searchText]);

  const visibleWarnings = filteredWarnings.slice(0, showCount);
  const tableNames = useMemo(() => getTableNames(), [warnings]);

  const handleClear = () => {
    clearWarnings();
    setExpandedId(null);
    setTableFilter('');
    setSearchText('');
  };

  // Empty state
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-500">
        <ShieldAlert className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">No validation warnings</p>
        <p className="text-xs mt-1 text-slate-600 max-w-xs text-center">
          When database rows fail Zod schema validation, warnings will appear
          here with field-level details.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* ---- Summary cards ---- */}
      <div className="flex-shrink-0 border-b border-slate-700/50 px-4 py-2.5">
        <div className="flex items-center gap-2 mb-2">
          <FileWarning className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Warnings by Table
          </span>
          <span className="text-[10px] text-slate-500 ml-auto">
            {totalCount} total warning{totalCount !== 1 ? 's' : ''} (max 100 stored)
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* "All" chip */}
          <button
            onClick={() => setTableFilter('')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all flex-shrink-0 ${
              !tableFilter
                ? 'bg-slate-600/30 border-slate-500/50 text-slate-200 ring-1 ring-slate-500/30'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
            }`}
          >
            <Table2 className="w-3 h-3" />
            All
            <span className="ml-1 text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          </button>
          {summaries.map(s => (
            <SummaryCard
              key={s.table}
              summary={s}
              isSelected={tableFilter === s.table}
              onClick={() =>
                setTableFilter(prev => (prev === s.table ? '' : s.table))
              }
            />
          ))}
        </div>
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-800/50">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search fields, messages, codes..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-800/50 border border-slate-700/40 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/40"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Table filter dropdown */}
        <div className="relative">
          <select
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            className="appearance-none pl-7 pr-6 py-1.5 text-xs bg-slate-800/50 border border-slate-700/40 rounded-md text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/40 cursor-pointer"
          >
            <option value="">All tables</option>
            {tableNames.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        {/* Result count */}
        <span className="text-[10px] text-slate-500">
          {filteredWarnings.length} result{filteredWarnings.length !== 1 ? 's' : ''}
        </span>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition-colors ml-auto"
        >
          <Trash2 className="w-3 h-3" />
          Clear All
        </button>
      </div>

      {/* ---- Warning list ---- */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {filteredWarnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <Search className="w-6 h-6 mb-2 opacity-20" />
            <p className="text-xs">No warnings match the current filter.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left py-1.5 px-3 w-10">#</th>
                <th className="text-left py-1.5 px-2 w-28">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Time
                  </span>
                </th>
                <th className="text-left py-1.5 px-2 w-28">
                  <span className="flex items-center gap-1">
                    <Table2 className="w-3 h-3" /> Table
                  </span>
                </th>
                <th className="text-center py-1.5 px-2 w-12">Row</th>
                <th className="text-left py-1.5 px-2">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Failed Fields
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleWarnings.map(w => (
                <IssueRow
                  key={w.id}
                  warning={w}
                  isExpanded={expandedId === w.id}
                  onToggle={() =>
                    setExpandedId(prev => (prev === w.id ? null : w.id))
                  }
                />
              ))}
            </tbody>
          </table>
        )}

        {filteredWarnings.length > showCount && (
          <div className="flex justify-center py-2 border-t border-slate-800/50">
            <button
              onClick={() => setShowCount(prev => prev + 20)}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              Show more ({filteredWarnings.length - showCount} hidden)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTimeFull(date: Date): string {
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
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(snippet: string): string {
  try {
    const parsed = JSON.parse(snippet.replace(/\.\.\.$/,''));
    return JSON.stringify(parsed, null, 2);
  } catch {
    return snippet;
  }
}

export default ValidationMonitorTab;
