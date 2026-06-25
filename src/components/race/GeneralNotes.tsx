import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  StickyNote,
  CalendarDays,
  Tag,
  Search,
  ArrowDownAZ,
  ArrowUpDown,
} from 'lucide-react';
import DateInputDark from '@/components/ui/DateInputDark';
import { CrewRole } from '@/lib/permissions';


/**
 * GeneralNotes — a spreadsheet-style general notes page with three core columns
 * (Date, Time, Description) plus a Category column. Notes can be sorted/grouped
 * by Date or by Category via the top tabs. Records are unbounded ("infinite
 * lines") and persist to localStorage so they survive reloads reliably.
 */

export interface GeneralNote {
  id: string;
  date: string;
  time: string;
  category: string;
  description: string;
}

const STORAGE_KEY = 'promod.generalNotes.v1';

const DEFAULT_CATEGORIES = [
  'General',
  'Setup',
  'Engine',
  'Track',
  'Weather',
  'Crew',
  'Parts',
  'Reminder',
];

const genId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `gn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createNote = (partial?: Partial<GeneralNote>): GeneralNote => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: genId(),
    date: partial?.date ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: partial?.time ?? `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    category: partial?.category ?? 'General',
    description: partial?.description ?? '',
  };
};

const loadNotes = (): GeneralNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return [];
};

type SortMode = 'date' | 'category';

interface GeneralNotesProps {
  currentRole?: CrewRole;
}

const GeneralNotes: React.FC<GeneralNotesProps> = ({ currentRole = 'Crew' }) => {
  void currentRole;

  const [notes, setNotes] = useState<GeneralNote[]>(() => loadNotes());
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [dateAsc, setDateAsc] = useState(false); // newest first by default
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Persist whenever notes change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      /* ignore quota errors */
    }
  }, [notes]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    notes.forEach((n) => n.category && set.add(n.category));
    return Array.from(set);
  }, [notes]);

  const updateNote = useCallback((id: string, patch: Partial<GeneralNote>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNote = useCallback(() => {
    setNotes((prev) => [createNote(), ...prev]);
  }, []);

  // Filter (search + category)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        n.description.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        n.date.includes(q)
      );
    });
  }, [notes, search, categoryFilter]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === 'date') {
      arr.sort((a, b) => {
        const ad = `${a.date} ${a.time}`;
        const bd = `${b.date} ${b.time}`;
        return dateAsc ? ad.localeCompare(bd) : bd.localeCompare(ad);
      });
    } else {
      arr.sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        if (c !== 0) return c;
        // within same category, newest first
        return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
      });
    }
    return arr;
  }, [filtered, sortMode, dateAsc]);

  // Group by category when in category mode
  const grouped = useMemo(() => {
    if (sortMode !== 'category') return null;
    const map = new Map<string, GeneralNote[]>();
    sorted.forEach((n) => {
      const key = n.category || 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return Array.from(map.entries());
  }, [sorted, sortMode]);

  const renderRow = (note: GeneralNote) => (
    <div
      key={note.id}
      className="grid grid-cols-[150px_110px_150px_1fr_44px] border-b border-slate-700/40 last:border-b-0 hover:bg-slate-700/10"
    >
      <div className="px-1.5 py-1">
        <DateInputDark
          value={note.date}
          onChange={(e) => updateNote(note.id, { date: e.target.value })}
          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="px-1.5 py-1 border-l border-slate-700/40">
        <input
          type="time"
          value={note.time}
          onChange={(e) => updateNote(note.id, { time: e.target.value })}
          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="px-1.5 py-1 border-l border-slate-700/40">
        <input
          list="general-notes-categories"
          value={note.category}
          onChange={(e) => updateNote(note.id, { category: e.target.value })}
          placeholder="Category"
          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="px-1.5 py-1 border-l border-slate-700/40">
        <input
          type="text"
          value={note.description}
          onChange={(e) => updateNote(note.id, { description: e.target.value })}
          placeholder="Write your note…"
          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="px-1 py-1 border-l border-slate-700/40 flex items-center justify-center">
        <button
          type="button"
          onClick={() => removeNote(note.id)}
          className="p-1 text-red-400 hover:bg-red-500/20 rounded"
          title="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const headerRow = (
    <div className="grid grid-cols-[150px_110px_150px_1fr_44px] bg-slate-900/70 border-b border-slate-700 text-xs font-medium text-slate-400 sticky top-0 z-10">
      <div className="px-3 py-2">Date</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Time</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Category</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Description</div>
      <div className="px-2 py-2 border-l border-slate-700/60" />
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <StickyNote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">General Notes</h1>
            <p className="text-xs text-slate-400">
              {notes.length} note{notes.length === 1 ? '' : 's'} · saved automatically
            </p>
          </div>
        </div>

        <button
          onClick={addNote}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {/* Sort Tabs + Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        {/* Sort tabs */}
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
          <button
            onClick={() => setSortMode('date')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'date'
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            By Date
          </button>
          <button
            onClick={() => setSortMode('category')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortMode === 'category'
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            By Category
          </button>
        </div>

        {/* Date direction toggle (only in date mode) */}
        {sortMode === 'date' && (
          <button
            onClick={() => setDateAsc((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-sm text-slate-300 hover:text-white"
            title="Toggle date order"
          >
            <ArrowUpDown className="w-4 h-4" />
            {dateAsc ? 'Oldest first' : 'Newest first'}
          </button>
        )}

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <ArrowDownAZ className="w-4 h-4 text-slate-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      <datalist id="general-notes-categories">
        {allCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Spreadsheet */}
      {sortMode === 'date' ? (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          {headerRow}
          <div className="max-h-[60vh] overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-slate-500">
                No notes yet. Click "Add Note" to create your first record.
              </div>
            ) : (
              sorted.map(renderRow)
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped && grouped.length === 0 && (
            <div className="border border-slate-700 rounded-lg px-3 py-10 text-center text-sm text-slate-500">
              No notes yet. Click "Add Note" to create your first record.
            </div>
          )}
          {grouped &&
            grouped.map(([category, catNotes]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-semibold text-white">{category}</h2>
                  <span className="text-xs text-slate-500">
                    {catNotes.length} note{catNotes.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  {headerRow}
                  <div>{catNotes.map(renderRow)}</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default GeneralNotes;
