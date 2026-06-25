import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  StickyNote,
  CalendarDays,
  Tag,
  Search,
  ArrowDownAZ,
  ArrowUpDown,
  Settings2,
  X,
  Pencil,
  Check,
  Save,
  Loader2,
  Cloud,
  HardDrive,
  Download,
  ImagePlus,
} from 'lucide-react';
import DateInputDark from '@/components/ui/DateInputDark';
import { CrewRole } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { exportNotesToCSV } from '@/lib/expenseExport';
import { uploadFileWithFallback } from '@/lib/storageUpload';

/**
 * GeneralNotes — a spreadsheet-style general notes page with three core columns
 * (Date, Time, Description) plus a Category column. Notes can be sorted/grouped
 * by Date or by Category via the top tabs. A built-in Category Manager lets users
 * create, rename, color-code, and delete their own categories; those categories
 * render as colored badges on each note row, in group headers, and in the filter.
 *
 * Notes are persisted to the `general_notes` Supabase table (per signed-in user,
 * protected by RLS) so they sync across devices and team members. When no user is
 * signed in (demo mode), notes fall back to localStorage. Each note is added in an
 * editable draft state with a "Save Note" button, and saved rows expose an "Edit"
 * button to make further changes.
 */

export interface GeneralNote {
  id: string;
  date: string;
  time: string;
  category: string;
  description: string;
  attachments: string[]; // public URLs of attached photos
}

export interface NoteCategory {
  id: string;
  name: string;
  color: string; // hex
}

const STORAGE_KEY = 'promod.generalNotes.v1';
const CATEGORY_STORAGE_KEY = 'promod.generalNotes.categories.v1';

// A palette of pleasant, high-contrast badge colors for new categories.
const COLOR_PALETTE = [
  '#64748b', // slate
  '#f97316', // orange
  '#ef4444', // red
  '#eab308', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#f59e0b', // gold
];

const DEFAULT_CATEGORIES: NoteCategory[] = [
  { id: 'cat-general', name: 'General', color: '#64748b' },
  { id: 'cat-setup', name: 'Setup', color: '#3b82f6' },
  { id: 'cat-engine', name: 'Engine', color: '#ef4444' },
  { id: 'cat-track', name: 'Track', color: '#22c55e' },
  { id: 'cat-weather', name: 'Weather', color: '#06b6d4' },
  { id: 'cat-crew', name: 'Crew', color: '#8b5cf6' },
  { id: 'cat-parts', name: 'Parts', color: '#f97316' },
  { id: 'cat-reminder', name: 'Reminder', color: '#eab308' },
];

const genId = (prefix = 'gn'): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createNote = (partial?: Partial<GeneralNote>): GeneralNote => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: genId('note'),
    date: partial?.date ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: partial?.time ?? `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    category: partial?.category ?? 'General',
    description: partial?.description ?? '',
    attachments: partial?.attachments ?? [],
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

const loadCategories = (): NoteCategory[] => {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter(
          (c) => c && typeof c.name === 'string' && typeof c.color === 'string',
        );
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CATEGORIES;
};

// Decide whether a badge needs dark or light text based on its background luminance.
const readableTextColor = (hex: string): string => {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

type SortMode = 'date' | 'category';

interface GeneralNotesProps {
  currentRole?: CrewRole;
}

const GeneralNotes: React.FC<GeneralNotesProps> = ({ currentRole = 'Crew' }) => {
  void currentRole;

  const { user, isDemoMode, effectiveUserId } = useAuth();
  const persistUserId = effectiveUserId || user?.id || null;
  // Use the database only when we have a real signed-in user (not demo).
  const useDatabase = !!persistUserId && !isDemoMode;

  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>(() => loadCategories());
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [dateAsc, setDateAsc] = useState(false); // newest first by default
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [managerOpen, setManagerOpen] = useState(false);
  // Note id pending delete-confirmation (null = no confirmation open).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Which notes are currently in edit mode (show inputs + Save button).
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  // Drafts hold un-committed edits keyed by note id, so cancelling/closing
  // a row never mutates the saved data until "Save Note" is pressed.
  const [drafts, setDrafts] = useState<Record<string, GeneralNote>>({});
  // Ids that have been saved to the database (or localStorage).
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Photo-upload state: which note is currently uploading + per-row file inputs.
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ---- Load notes (DB or localStorage) ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (useDatabase) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('general_notes')
            .select('id, date, time, category, description, attachments, created_at')
            .eq('user_id', persistUserId)
            .order('created_at', { ascending: false });
          if (!cancelled) {
            if (error) {
              console.warn('Failed to load general notes from DB:', error.message);
              setNotes(loadNotes()); // graceful fallback
            } else {
              setNotes(
                (data ?? []).map((d) => ({
                  id: d.id,
                  date: d.date ?? '',
                  time: d.time ?? '',
                  category: d.category ?? 'General',
                  description: d.description ?? '',
                  attachments: Array.isArray(d.attachments) ? d.attachments : [],
                })),
              );
            }
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setNotes(loadNotes());
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [useDatabase, persistUserId]);

  // Persist to localStorage only in non-DB (demo) mode.
  useEffect(() => {
    if (useDatabase) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      /* ignore quota errors */
    }
  }, [notes, useDatabase]);

  // Persist categories (always local — categories are a UI preference).
  useEffect(() => {
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      /* ignore */
    }
  }, [categories]);

  const colorFor = useCallback(
    (name: string): string => {
      const found = categories.find(
        (c) => c.name.toLowerCase() === (name || '').toLowerCase(),
      );
      return found?.color ?? '#475569';
    },
    [categories],
  );

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>(categories.map((c) => c.name));
    notes.forEach((n) => n.category && set.add(n.category));
    return Array.from(set);
  }, [categories, notes]);

  // ---- Draft / edit helpers ----
  const setEditing = (id: string, on: boolean) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const beginEdit = (note: GeneralNote) => {
    setDrafts((prev) => ({ ...prev, [note.id]: { ...note } }));
    setEditing(note.id, true);
  };

  const updateDraft = (id: string, patch: Partial<GeneralNote>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const cancelEdit = (id: string, wasNew: boolean) => {
    setEditing(id, false);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // A brand-new note that was never saved is discarded on cancel.
    if (wasNew) setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const addNote = useCallback(() => {
    const note = createNote({ category: categories[0]?.name ?? 'General' });
    setNotes((prev) => [note, ...prev]);
    setDrafts((prev) => ({ ...prev, [note.id]: { ...note } }));
    setEditing(note.id, true);
  }, [categories]);

  // ---- Save a single note (DB upsert or local) ----
  const saveNote = useCallback(
    async (id: string) => {
      const draft = drafts[id];
      if (!draft) return;
      setSavingId(id);
      try {
        if (useDatabase) {
          const { error } = await supabase.from('general_notes').upsert({
            id: draft.id,
            user_id: persistUserId,
            date: draft.date,
            time: draft.time,
            category: draft.category,
            description: draft.description,
            attachments: draft.attachments ?? [],
          });
          if (error) {
            console.error('Failed to save note:', error.message);
            // Keep the row in edit mode so the user can retry.
            return;
          }
        }
        // Commit the draft into the visible notes list.
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...draft } : n)));
        setEditing(id, false);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } finally {
        setSavingId(null);
      }
    },
    [drafts, useDatabase, persistUserId],
  );

  const removeNote = useCallback(
    async (id: string) => {
      if (useDatabase) {
        const { error } = await supabase.from('general_notes').delete().eq('id', id);
        if (error) {
          console.error('Failed to delete note:', error.message);
          return;
        }
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setEditing(id, false);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [useDatabase],
  );

  // ---- Photo attachments ----
  const handleAttachFiles = useCallback(
    async (noteId: string, files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploadingId(noteId);
      try {
        const urls: string[] = [];
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/')) continue;
          const result = await uploadFileWithFallback(file, 'general-notes');
          if (result.url) urls.push(result.url);
        }
        if (urls.length) {
          setDrafts((prev) => {
            const current = prev[noteId];
            if (!current) return prev;
            return {
              ...prev,
              [noteId]: {
                ...current,
                attachments: [...(current.attachments ?? []), ...urls],
              },
            };
          });
        }
      } finally {
        setUploadingId(null);
        // Reset the input so the same file can be re-selected later.
        const input = fileInputRefs.current[noteId];
        if (input) input.value = '';
      }
    },
    [],
  );

  const removeAttachment = useCallback((noteId: string, url: string) => {
    setDrafts((prev) => {
      const current = prev[noteId];
      if (!current) return prev;
      return {
        ...prev,
        [noteId]: {
          ...current,
          attachments: (current.attachments ?? []).filter((u) => u !== url),
        },
      };
    });
  }, []);

  // ---- CSV export handler is defined after `sorted` is computed (see below). ----

  // ---- Category manager actions ----
  const addCategory = useCallback(() => {
    setCategories((prev) => {
      const color = COLOR_PALETTE[prev.length % COLOR_PALETTE.length];
      let name = 'New Category';
      let i = 2;
      const existing = new Set(prev.map((c) => c.name.toLowerCase()));
      while (existing.has(name.toLowerCase())) {
        name = `New Category ${i++}`;
      }
      return [...prev, { id: genId('cat'), name, color }];
    });
  }, []);

  const renameCategory = useCallback((id: string, newName: string) => {
    setCategories((prev) => {
      const target = prev.find((c) => c.id === id);
      const oldName = target?.name;
      const next = prev.map((c) => (c.id === id ? { ...c, name: newName } : c));
      if (oldName && oldName !== newName) {
        setNotes((pn) =>
          pn.map((n) => (n.category === oldName ? { ...n, category: newName } : n)),
        );
        setDrafts((pd) => {
          const nd = { ...pd };
          Object.keys(nd).forEach((k) => {
            if (nd[k].category === oldName) nd[k] = { ...nd[k], category: newName };
          });
          return nd;
        });
        setCategoryFilter((f) => (f === oldName ? newName : f));
      }
      return next;
    });
  }, []);

  const recolorCategory = useCallback((id: string, color: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) setCategoryFilter((f) => (f === target.name ? 'all' : f));
      return prev.filter((c) => c.id !== id);
    });
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

  // ---- CSV export (current filtered + sorted view) ----
  const handleExportCSV = useCallback(() => {
    if (sorted.length === 0) return;
    exportNotesToCSV(
      sorted.map((n) => ({
        date: n.date,
        time: n.time,
        category: n.category,
        description: n.description,
      })),
    );
  }, [sorted]);

  const CategoryBadge: React.FC<{ name: string }> = ({ name }) => {
    if (!name) return null;
    const bg = colorFor(name);
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
        style={{ backgroundColor: bg, color: readableTextColor(bg) }}
      >
        {name}
      </span>
    );
  };

  const renderRow = (note: GeneralNote) => {
    const isEditing = editingIds.has(note.id);
    const draft = drafts[note.id] ?? note;
    const isSaving = savingId === note.id;

    if (!isEditing) {
      // Read-only saved row with an Edit button.
      return (
        <div
          key={note.id}
          className="grid grid-cols-[150px_110px_170px_1fr_84px] border-b border-slate-700/40 last:border-b-0 hover:bg-slate-700/10 items-center"
        >
          <div className="px-3 py-2 text-sm text-slate-200">{note.date || '—'}</div>
          <div className="px-3 py-2 border-l border-slate-700/40 text-sm text-slate-200">
            {note.time || '—'}
          </div>
          <div className="px-3 py-2 border-l border-slate-700/40">
            <CategoryBadge name={note.category} />
          </div>
          <div className="px-3 py-2 border-l border-slate-700/40 text-sm text-slate-200 whitespace-pre-wrap break-words">
            {note.description || <span className="text-slate-500 italic">No description</span>}
            {(note.attachments ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {note.attachments.map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-10 h-10 rounded border border-slate-600 overflow-hidden bg-slate-950"
                    title="Open photo"
                  >
                    <img src={url} alt={`attachment ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="px-1 py-1 border-l border-slate-700/40 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => beginEdit(note)}
              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded"
              title="Edit note"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => removeNote(note.id)}
              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
              title="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    // Editable draft row with a Save button.
    const isNew = !note.description && note.date === draft.date; // heuristic; cancel removes if blank
    return (
      <div
        key={note.id}
        className="grid grid-cols-[150px_110px_170px_1fr_84px] border-b border-slate-700/40 last:border-b-0 bg-blue-500/5"
      >
        <div className="px-1.5 py-1">
          <DateInputDark
            value={draft.date}
            onChange={(e) => updateDraft(note.id, { date: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div className="px-1.5 py-1 border-l border-slate-700/40">
          <input
            type="time"
            value={draft.time}
            onChange={(e) => updateDraft(note.id, { time: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div className="px-1.5 py-1 border-l border-slate-700/40 flex flex-col gap-1">
          <select
            value={
              categories.some((c) => c.name === draft.category) ? draft.category : '__custom'
            }
            onChange={(e) => {
              if (e.target.value !== '__custom')
                updateDraft(note.id, { category: e.target.value });
            }}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
            style={{ borderLeft: `4px solid ${colorFor(draft.category)}` }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            {!categories.some((c) => c.name === draft.category) && draft.category && (
              <option value="__custom">{draft.category}</option>
            )}
          </select>
          <div className="pl-0.5">
            <CategoryBadge name={draft.category} />
          </div>
        </div>
        <div className="px-1.5 py-1 border-l border-slate-700/40 space-y-1.5">
          <textarea
            value={draft.description}
            onChange={(e) => updateDraft(note.id, { description: e.target.value })}
            placeholder="Write your note…"
            rows={2}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white resize-y"
          />
          {/* Attachment thumbnails + uploader */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(draft.attachments ?? []).map((url, i) => (
              <div
                key={url + i}
                className="relative group w-12 h-12 rounded border border-slate-600 overflow-hidden bg-slate-950"
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`attachment ${i + 1}`} className="w-full h-full object-cover" />
                </a>
                <button
                  type="button"
                  onClick={() => removeAttachment(note.id, url)}
                  className="absolute top-0 right-0 bg-red-600/90 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRefs.current[note.id]?.click()}
              disabled={uploadingId === note.id}
              className="w-12 h-12 rounded border border-dashed border-slate-600 flex items-center justify-center text-slate-400 hover:text-orange-300 hover:border-orange-400 disabled:opacity-50"
              title="Attach photo(s)"
            >
              {uploadingId === note.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
            </button>
            <input
              ref={(el) => (fileInputRefs.current[note.id] = el)}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAttachFiles(note.id, e.target.files)}
            />
          </div>
        </div>
        <div className="px-1 py-1 border-l border-slate-700/40 flex flex-col items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => saveNote(note.id)}
            disabled={isSaving}
            className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-xs font-medium rounded w-full justify-center"
            title="Save note"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cancelEdit(note.id, isNew)}
              className="p-1 text-slate-400 hover:bg-slate-700 rounded"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeNote(note.id)}
              className="p-1 text-red-400 hover:bg-red-500/20 rounded"
              title="Delete note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const headerRow = (
    <div className="grid grid-cols-[150px_110px_170px_1fr_84px] bg-slate-900/70 border-b border-slate-700 text-xs font-medium text-slate-400 sticky top-0 z-10">
      <div className="px-3 py-2">Date</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Time</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Category</div>
      <div className="px-3 py-2 border-l border-slate-700/60">Description</div>
      <div className="px-2 py-2 border-l border-slate-700/60 text-center">Actions</div>
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
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              {notes.length} note{notes.length === 1 ? '' : 's'}
              <span className="text-slate-600">·</span>
              {useDatabase ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Cloud className="w-3 h-3" /> Synced to your account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <HardDrive className="w-3 h-3" /> Saved on this device
                </span>
              )}
              {loading && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={sorted.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-900/60 text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download the currently shown notes as a CSV file"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-900/60 text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-800 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            Manage Categories
          </button>
          <button
            onClick={addNote}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </div>

      {/* Sort Tabs + Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
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

        <div className="flex items-center gap-2">
          <ArrowDownAZ className="w-4 h-4 text-slate-500" />
          <div
            className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-1 py-0.5"
            style={
              categoryFilter !== 'all'
                ? { borderLeft: `4px solid ${colorFor(categoryFilter)}` }
                : undefined
            }
          >
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {allCategoryNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorFor(category) }}
                  />
                  <CategoryBadge name={category} />
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

      {/* Category Manager Modal */}
      {managerOpen && (
        <CategoryManager
          categories={categories}
          notes={notes}
          palette={COLOR_PALETTE}
          onAdd={addCategory}
          onRename={renameCategory}
          onRecolor={recolorCategory}
          onDelete={deleteCategory}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Category Manager Modal                                              */
/* ------------------------------------------------------------------ */

interface CategoryManagerProps {
  categories: NoteCategory[];
  notes: GeneralNote[];
  palette: string[];
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  notes,
  palette,
  onAdd,
  onRename,
  onRecolor,
  onDelete,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const countFor = useCallback(
    (name: string) => notes.filter((n) => n.category === name).length,
    [notes],
  );

  const startEdit = (cat: NoteCategory) => {
    setEditingId(cat.id);
    setDraftName(cat.name);
  };

  const commitEdit = (id: string) => {
    const name = draftName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
    setDraftName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-semibold text-white">Manage Categories</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-3 space-y-2">
          {categories.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-6">
              No categories yet. Add one below.
            </p>
          )}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2"
            >
              <label className="relative flex-shrink-0" title="Pick a color">
                <span
                  className="block w-6 h-6 rounded-full border border-slate-600 cursor-pointer"
                  style={{ backgroundColor: cat.color }}
                />
                <input
                  type="color"
                  value={cat.color}
                  onChange={(e) => onRecolor(cat.id, e.target.value)}
                  className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer"
                />
              </label>

              <div className="flex-1 min-w-0">
                {editingId === cat.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(cat.id);
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setDraftName('');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: cat.color,
                        color: readableTextColor(cat.color),
                      }}
                    >
                      {cat.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {countFor(cat.name)} note{countFor(cat.name) === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-1">
                {palette.slice(0, 6).map((p) => (
                  <button
                    key={p}
                    onClick={() => onRecolor(cat.id, p)}
                    className="w-4 h-4 rounded-full border border-slate-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: p }}
                    title={`Use ${p}`}
                  />
                ))}
              </div>

              {editingId === cat.id ? (
                <button
                  onClick={() => commitEdit(cat.id)}
                  className="p-1.5 text-green-400 hover:bg-green-500/20 rounded"
                  title="Save name"
                >
                  <Check className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1.5 text-slate-300 hover:bg-slate-700 rounded"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onDelete(cat.id)}
                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                title="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium rounded-lg hover:brightness-110"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralNotes;
