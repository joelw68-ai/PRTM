import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useThemeColor, useAccentStyles } from '@/contexts/ThemeColorContext';
import {
  Search, X, Package, Wrench, FileText, Users, Calendar,
  ClipboardList, CheckSquare, ChevronRight, Loader2
} from 'lucide-react';

interface GlobalSearchProps {
  onNavigate: (section: string) => void;
  collapsed: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryIcon: React.ElementType;
  section: string; // navigation target
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, collapsed }) => {
  const {
    partsInventory,
    maintenanceItems,
    workOrders,
    vendors,
    raceEvents,
    passLogs,
    preRunChecklist,
    betweenRoundsChecklist,
    postRunChecklist,
  } = useApp();
  const { colors } = useThemeColor();
  const styles = useAccentStyles();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const matches: SearchResult[] = [];
    const MAX_PER_CATEGORY = 5;

    // Search Parts Inventory
    let count = 0;
    for (const part of partsInventory) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${part.partNumber} ${part.description} ${part.name || ''} ${part.vendor} ${part.category} ${part.notes}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: part.id,
          title: part.description || part.name || part.partNumber,
          subtitle: `${part.partNumber} — ${part.vendor || 'No vendor'} — ${part.status}`,
          category: 'Parts Inventory',
          categoryIcon: Package,
          section: 'parts',
        });
        count++;
      }
    }

    // Search Maintenance Items
    count = 0;
    for (const item of maintenanceItems) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${item.component} ${item.category} ${item.notes} ${item.status}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: item.id,
          title: item.component,
          subtitle: `${item.category} — ${item.status} — ${item.currentPasses}/${item.nextServicePasses} passes`,
          category: 'Maintenance',
          categoryIcon: Wrench,
          section: 'maintenance',
        });
        count++;
      }
    }

    // Search Work Orders
    count = 0;
    for (const wo of workOrders) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${wo.title} ${wo.description} ${wo.category} ${wo.assignedTo} ${wo.notes} ${wo.status}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: wo.id,
          title: wo.title,
          subtitle: `${wo.status} — ${wo.priority} priority — ${wo.assignedTo || 'Unassigned'}`,
          category: 'Work Orders',
          categoryIcon: FileText,
          section: 'workorders',
        });
        count++;
      }
    }

    // Search Vendors
    count = 0;
    for (const v of vendors) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${v.name} ${v.contactName} ${v.email} ${v.phone} ${v.category} ${v.city} ${v.state} ${v.notes}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: v.id,
          title: v.name,
          subtitle: `${v.category} — ${v.contactName || 'No contact'} — ${v.city ? `${v.city}, ${v.state}` : ''}`,
          category: 'Vendors',
          categoryIcon: Users,
          section: 'vendors',
        });
        count++;
      }
    }

    // Search Race Events / Calendar
    count = 0;
    for (const event of raceEvents) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${event.title} ${event.trackName} ${event.trackLocation} ${event.sanctioningBody || ''} ${event.notes || ''} ${event.status}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: event.id,
          title: event.title,
          subtitle: `${event.trackName} — ${event.startDate} — ${event.status}`,
          category: 'Event Calendar',
          categoryIcon: Calendar,
          section: 'calendar',
        });
        count++;
      }
    }

    // Search Pass Logs
    count = 0;
    for (const pass of passLogs) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${pass.track} ${pass.location} ${pass.notes} ${pass.date} ${pass.sessionType} ${pass.result} ${pass.crewChief}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: pass.id,
          title: `${pass.track} — ${pass.eighth.toFixed(3)} @ ${pass.mph.toFixed(1)} MPH`,
          subtitle: `${pass.date} — ${pass.sessionType} — ${pass.result}`,
          category: 'Pass Log',
          categoryIcon: ClipboardList,
          section: 'passlog',
        });
        count++;
      }
    }

    // Search Checklists
    count = 0;
    const allChecklists = [
      ...preRunChecklist.map(c => ({ ...c, listType: 'Pre-Run' })),
      ...betweenRoundsChecklist.map(c => ({ ...c, listType: 'Between Rounds' })),
      ...postRunChecklist.map(c => ({ ...c, listType: 'Post-Run' })),
    ];
    for (const item of allChecklists) {
      if (count >= MAX_PER_CATEGORY) break;
      const searchable = `${item.task} ${item.category} ${item.notes || ''} ${item.listType}`.toLowerCase();
      if (searchable.includes(q)) {
        matches.push({
          id: item.id,
          title: item.task,
          subtitle: `${item.listType} — ${item.category} — ${item.completed ? 'Completed' : 'Pending'}${item.critical ? ' — CRITICAL' : ''}`,
          category: 'Checklists',
          categoryIcon: CheckSquare,
          section: 'checklists',
        });
        count++;
      }
    }

    return matches;
  }, [query, partsInventory, maintenanceItems, workOrders, vendors, raceEvents, passLogs, preRunChecklist, betweenRoundsChecklist, postRunChecklist]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [results]);

  const totalResults = results.length;
  const categoryCount = Object.keys(groupedResults).length;

  const handleResultClick = (result: SearchResult) => {
    onNavigate(result.section);
    setIsOpen(false);
    setQuery('');
  };

  // Collapsed mode: just show search icon button
  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <button
          onClick={() => {
            // Could open a modal search in collapsed mode
            // For now, just expand sidebar or show tooltip
          }}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      {/* Search Input */}
      <div
        className={`relative flex items-center rounded-lg border transition-all duration-200 ${
          isFocused
            ? 'border-current bg-slate-800/80'
            : 'border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60'
        }`}
        style={isFocused ? { borderColor: `rgba(${colors.rgb}, 0.5)` } : undefined}
      >
        <Search
          className="w-3.5 h-3.5 ml-2.5 flex-shrink-0 transition-colors"
          style={isFocused ? { color: colors.base } : { color: 'rgb(100 116 139)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder="Search everything..."
          className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 px-2 py-2"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-1 mr-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {!query && (
          <span className="text-[9px] text-slate-600 mr-2 px-1 py-0.5 rounded border border-slate-700 font-mono">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}K
          </span>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 max-h-[70vh] overflow-y-auto">
          {totalResults === 0 ? (
            <div className="px-4 py-6 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No results for "{query}"</p>
              <p className="text-slate-500 text-xs mt-1">
                Try searching for parts, maintenance items, work orders, vendors, events, passes, or checklists
              </p>
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  {totalResults} result{totalResults !== 1 ? 's' : ''} in {categoryCount} section{categoryCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Grouped Results */}
              {Object.entries(groupedResults).map(([category, items]) => {
                const CategoryIcon = items[0].categoryIcon;
                return (
                  <div key={category}>
                    {/* Category Header */}
                    <div className="px-3 py-1.5 bg-slate-900/50 border-b border-slate-700/30 flex items-center gap-2">
                      <CategoryIcon className="w-3.5 h-3.5" style={{ color: colors.base }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.light }}>
                        {category}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {items.length}
                      </span>
                    </div>

                    {/* Results */}
                    {items.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition-colors flex items-start gap-2.5 border-b border-slate-700/20 last:border-b-0 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate group-hover:text-opacity-100">
                            {result.title}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {result.subtitle}
                          </p>
                        </div>
                        <ChevronRight
                          className="w-3 h-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors"
                        />
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
