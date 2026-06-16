import React, { useState, useEffect, useMemo } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';
import DateInputDark from '@/components/ui/DateInputDark';
import {
  History, Plus, Trash2, X, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Circle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// Tire/Wheel Set Lifecycle Log
//
// Records the lifecycle of a rear tire & wheel assembly: when a set was
// Installed, Removed, and Rotated, capturing the pass count at each event.
// Persists to localStorage keyed by component id so the data survives reloads
// without requiring a DB schema migration.
// ═══════════════════════════════════════════════════════════════════════

export type TireEventType = 'Installed' | 'Removed' | 'Rotated';

export interface TireLifecycleEvent {
  id: string;
  componentId: string;
  eventType: TireEventType;
  date: string;        // YYYY-MM-DD
  passCount: number;   // pass count at the time of the event
  position?: string;   // optional: e.g., "LR→RR" for rotations
  notes?: string;
  timestamp: number;   // when the record was created
}

const STORAGE_KEY = 'tireSet_lifecycleLog';

function loadAllEvents(): TireLifecycleEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllEvents(events: TireLifecycleEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* ignore quota errors */
  }
}

interface TireSetLifecycleLogProps {
  componentId: string;
  /** Current total passes on the assembly — used as the default pass count for a new event */
  currentPasses?: number;
}

const EVENT_META: Record<TireEventType, { icon: any; color: string; bg: string; border: string }> = {
  Installed: { icon: ArrowDownToLine, color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/40' },
  Removed: { icon: ArrowUpFromLine, color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40' },
  Rotated: { icon: RefreshCw, color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
};

const TireSetLifecycleLog: React.FC<TireSetLifecycleLogProps> = ({ componentId, currentPasses = 0 }) => {
  const [allEvents, setAllEvents] = useState<TireLifecycleEvent[]>(loadAllEvents);
  const [showAdd, setShowAdd] = useState(false);

  // Add-form state
  const [formType, setFormType] = useState<TireEventType>('Installed');
  const [formDate, setFormDate] = useState(getLocalDateString());
  const [formPasses, setFormPasses] = useState<number>(currentPasses);
  const [formPosition, setFormPosition] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Persist whenever events change
  useEffect(() => { saveAllEvents(allEvents); }, [allEvents]);

  // Events for THIS component, newest first
  const events = useMemo(
    () =>
      allEvents
        .filter(e => e.componentId === componentId)
        .sort((a, b) => (b.date.localeCompare(a.date)) || (b.timestamp - a.timestamp)),
    [allEvents, componentId]
  );

  const resetForm = () => {
    setFormType('Installed');
    setFormDate(getLocalDateString());
    setFormPasses(currentPasses);
    setFormPosition('');
    setFormNotes('');
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const handleAdd = () => {
    const newEvent: TireLifecycleEvent = {
      id: `TLE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      componentId,
      eventType: formType,
      date: formDate,
      passCount: Number.isFinite(formPasses) ? formPasses : 0,
      position: formType === 'Rotated' ? (formPosition.trim() || undefined) : undefined,
      notes: formNotes.trim() || undefined,
      timestamp: Date.now(),
    };
    setAllEvents(prev => [...prev, newEvent]);
    setShowAdd(false);
    toast.success(`${formType} event logged`, {
      description: `${formDate} · ${newEvent.passCount} passes`,
      duration: 3500,
    });
  };

  const handleDelete = (id: string) => {
    setAllEvents(prev => prev.filter(e => e.id !== id));
    toast.success('Lifecycle event removed');
  };

  // Quick lifecycle summary
  const installCount = events.filter(e => e.eventType === 'Installed').length;
  const rotateCount = events.filter(e => e.eventType === 'Rotated').length;
  const removeCount = events.filter(e => e.eventType === 'Removed').length;

  return (
    <div className="mt-4 border-t border-slate-700/50 pt-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          Usage &amp; Lifecycle Log ({events.length})
        </h4>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium hover:bg-cyan-500/30"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Event
        </button>
      </div>

      {/* Summary pills */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[11px] rounded border border-green-500/30">
            {installCount} installed
          </span>
          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[11px] rounded border border-cyan-500/30">
            {rotateCount} rotated
          </span>
          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[11px] rounded border border-red-500/30">
            {removeCount} removed
          </span>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 ? (
        <div className="space-y-2">
          {events.map(ev => {
            const meta = EVENT_META[ev.eventType];
            const Icon = meta.icon;
            return (
              <div
                key={ev.id}
                className={`flex items-start gap-3 px-3 py-2.5 bg-slate-900/50 rounded-lg border ${meta.border}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${meta.color}`}>{ev.eventType}</span>
                    <span className="text-xs text-slate-400">{ev.date}</span>
                    <span className="px-1.5 py-0.5 bg-slate-700/60 text-slate-200 text-[10px] rounded font-medium">
                      {ev.passCount} passes
                    </span>
                    {ev.position && (
                      <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-300 text-[10px] rounded font-medium">
                        {ev.position}
                      </span>
                    )}
                  </div>
                  {ev.notes && <p className="text-xs text-slate-400 italic mt-1 break-words">{ev.notes}</p>}
                </div>
                <button
                  onClick={() => handleDelete(ev.id)}
                  className="p-1 text-slate-500 hover:text-red-400 flex-shrink-0"
                  title="Delete event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 bg-slate-900/30 rounded-lg border border-slate-700/40">
          <Circle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No lifecycle events yet</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Log when this set is installed, rotated, or removed to track its lifecycle.
          </p>
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                Log Lifecycle Event
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event type selector */}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Event Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Installed', 'Rotated', 'Removed'] as TireEventType[]).map(t => {
                    const meta = EVENT_META[t];
                    const Icon = meta.icon;
                    const active = formType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                          active ? `${meta.bg} ${meta.color} ${meta.border}` : 'bg-slate-900 text-slate-400 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <DateInputDark
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Count</label>
                  <input
                    type="number"
                    value={formPasses}
                    onChange={(e) => setFormPasses(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {formType === 'Rotated' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Rotation Position (optional)</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="e.g., LR → RR"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g., New Hoosier set, swapped after qualifying"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-500 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Log Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TireSetLifecycleLog;
