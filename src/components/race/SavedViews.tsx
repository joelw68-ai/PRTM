import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark, BookmarkPlus, Check, ChevronDown, Loader2, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FilterPreset,
  FilterPresetPage,
  fetchFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
} from '@/lib/filterPresets';

interface SavedViewsProps {
  /** Which page these presets belong to. */
  page: FilterPresetPage;
  /** The current active filter combination to snapshot when saving a view. */
  currentFilters: Record<string, any>;
  /** Called with a stored filters object when the user applies a saved view. */
  onApply: (filters: Record<string, any>) => void;
  /** Optional short human-readable summary of the current filters (shown in save dialog). */
  summary?: string;
}

/**
 * Reusable "Saved Views" dropdown. Lets the user name the current filter
 * combination, store it in the database, and quickly re-apply or delete it.
 * Page-agnostic: it just persists/restores whatever `currentFilters` object
 * the parent provides.
 */
const SavedViews: React.FC<SavedViewsProps> = ({ page, currentFilters, onApply, summary }) => {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchFilterPresets(page);
    setPresets(data);
    setLoading(false);
  };

  // Load presets on mount / when page changes
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSave = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name for this view');
      return;
    }
    setSaving(true);
    const result = await saveFilterPreset(page, newName, currentFilters);
    setSaving(false);
    if (result) {
      toast.success(`Saved view "${result.name}"`);
      setPresets(prev => [result, ...prev]);
      setActiveId(result.id);
      setNewName('');
      setShowSave(false);
      setOpen(false);
    } else {
      toast.error('Failed to save view');
    }
  };

  const handleApply = (preset: FilterPreset) => {
    onApply(preset.filters || {});
    setActiveId(preset.id);
    setOpen(false);
    toast.success(`Applied "${preset.name}"`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await deleteFilterPreset(id);
    if (ok) {
      setPresets(prev => prev.filter(p => p.id !== id));
      if (activeId === id) setActiveId(null);
      toast.success('View deleted');
    } else {
      toast.error('Failed to delete view');
    }
  };

  const activePreset = presets.find(p => p.id === activeId);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white hover:bg-slate-700 transition-colors whitespace-nowrap"
        title="Saved Views"
      >
        <Bookmark className="w-4 h-4 text-orange-400" />
        <span className="text-sm">{activePreset ? activePreset.name : 'Saved Views'}</span>
        {presets.length > 0 && (
          <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
            {presets.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
          {/* Save current view */}
          {!showSave ? (
            <button
              type="button"
              onClick={() => { setShowSave(true); setNewName(''); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-orange-400 hover:bg-slate-700/50 transition-colors border-b border-slate-700"
            >
              <BookmarkPlus className="w-4 h-4" />
              Save current filters as a view
            </button>
          ) : (
            <div className="p-3 border-b border-slate-700 bg-slate-900/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">New Saved View</p>
                <button onClick={() => setShowSave(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {summary && (
                <p className="text-xs text-slate-500 mb-2 truncate" title={summary}>{summary}</p>
              )}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
                placeholder="e.g., Low stock — Engine"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 mb-2"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !newName.trim()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save View
              </button>
            </div>
          )}

          {/* Saved presets list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : presets.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                No saved views yet. Set your filters, then save them above.
              </div>
            ) : (
              presets.map(preset => (
                <div
                  key={preset.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleApply(preset)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApply(preset); }}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer hover:bg-slate-700/50 transition-colors ${
                    activeId === preset.id ? 'bg-slate-700/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {activeId === preset.id ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                    <span className="text-sm text-white truncate">{preset.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(preset.id, e)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                    title="Delete view"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedViews;
