import React from 'react';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import DateInputDark from '@/components/ui/DateInputDark';
import { ServiceLogEntry } from '@/data/proModData';

/**
 * ServiceLogGrid — a spreadsheet-style editor for a maintenance item's service
 * log. Combines what used to be three separate single-value inputs/modals
 * (Last Service Date, Last Service Time, Notes) into one grid with an
 * unbounded number of rows ("infinite lines"), each capturing one service
 * event with its own date, time, and description/notes.
 *
 * The most-recent row (by date) is treated as the item's "last service" by the
 * parent, which syncs lastService / lastServiceTime / notes from it on save.
 */

const genId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createServiceLogRow = (
  partial?: Partial<ServiceLogEntry>
): ServiceLogEntry => ({
  id: genId(),
  date: partial?.date ?? '',
  time: partial?.time ?? '',
  notes: partial?.notes ?? '',
});

interface ServiceLogGridProps {
  rows: ServiceLogEntry[];
  onChange: (rows: ServiceLogEntry[]) => void;
}

const ServiceLogGrid: React.FC<ServiceLogGridProps> = ({ rows, onChange }) => {
  const updateRow = (id: string, patch: Partial<ServiceLogEntry>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  const addRow = () => {
    onChange([...rows, createServiceLogRow()]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <ClipboardList className="w-4 h-4 text-cyan-400" />
          Service Records
        </label>
        <span className="text-xs text-slate-500">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="border border-slate-700 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[150px_120px_1fr_40px] bg-slate-900/70 border-b border-slate-700 text-xs font-medium text-slate-400">
          <div className="px-3 py-2">Last Service Date</div>
          <div className="px-3 py-2 border-l border-slate-700/60">Last Service Time</div>
          <div className="px-3 py-2 border-l border-slate-700/60">Description / Notes</div>
          <div className="px-2 py-2 border-l border-slate-700/60" />
        </div>

        {/* Data rows */}
        <div className="max-h-64 overflow-y-auto">
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No service records yet. Click "Add Row" to start logging.
            </div>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[150px_120px_1fr_40px] border-b border-slate-700/40 last:border-b-0 hover:bg-slate-700/10"
            >
              <div className="px-1.5 py-1">
                <DateInputDark
                  value={row.date}
                  onChange={(e) => updateRow(row.id, { date: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div className="px-1.5 py-1 border-l border-slate-700/40">
                <input
                  type="time"
                  value={row.time || ''}
                  onChange={(e) => updateRow(row.id, { time: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div className="px-1.5 py-1 border-l border-slate-700/40">
                <input
                  type="text"
                  value={row.notes || ''}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  placeholder="Describe the service performed…"
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div className="px-1 py-1 border-l border-slate-700/40 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                  title="Delete row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600"
      >
        <Plus className="w-4 h-4" />
        Add Row
      </button>
    </div>
  );
};

export default ServiceLogGrid;
