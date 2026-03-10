import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useCar } from '@/contexts/CarContext';
import { parseLocalDateTime, formatLocalDate } from '@/lib/utils';
import { RaceEvent } from '@/components/race/RaceCalendar';

import {
  Clock,
  Calendar,
  Filter,
  Gauge,
  Thermometer,
  Wrench,
  CheckSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Timer,
  Wind,
  Droplets,
  Zap,
  Trophy,
  AlertTriangle,
  Activity,
  Eye,
  EyeOff,
  LayoutList,
  X
} from 'lucide-react';

// ─── Timeline entry types ───
type TimelineEntryType = 'pass' | 'weather' | 'maintenance' | 'checklist' | 'workorder';

interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: Date;
  title: string;
  subtitle?: string;
  details: Record<string, string | number | undefined>;
  color: string;       // Tailwind color class for the dot/border
  bgColor: string;     // Tailwind bg class for the card
  borderColor: string; // Tailwind border class
  iconColor: string;   // Tailwind text color for icon
  raw?: any;           // original data for expanded view
}

// ─── Color config per type ───
const TYPE_CONFIG: Record<TimelineEntryType, { label: string; color: string; bgColor: string; borderColor: string; iconColor: string; icon: any }> = {
  pass:        { label: 'Passes',      color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', iconColor: 'text-emerald-400', icon: Gauge },
  weather:     { label: 'Weather',     color: 'bg-sky-500',     bgColor: 'bg-sky-500/10',     borderColor: 'border-sky-500/30',     iconColor: 'text-sky-400',     icon: Thermometer },
  maintenance: { label: 'Maintenance', color: 'bg-amber-500',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   iconColor: 'text-amber-400',   icon: Wrench },
  checklist:   { label: 'Checklists',  color: 'bg-violet-500',  bgColor: 'bg-violet-500/10',  borderColor: 'border-violet-500/30',  iconColor: 'text-violet-400',  icon: CheckSquare },
  workorder:   { label: 'Work Orders', color: 'bg-rose-500',    bgColor: 'bg-rose-500/10',    borderColor: 'border-rose-500/30',    iconColor: 'text-rose-400',    icon: FileText },
};

const isEmptyCarId = (id?: string) => !id || id === '' || id === 'all';

const RaceDayTimeline: React.FC = () => {
  const {
    passLogs,
    maintenanceItems,
    workOrders,
    preRunChecklist,
    betweenRoundsChecklist,
    postRunChecklist,
    raceEvents,
  } = useApp();

  const { selectedCarId } = useCar();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<TimelineEntryType>>(
    new Set(['pass', 'weather', 'maintenance', 'checklist', 'workorder'])
  );
  const [showFilters, setShowFilters] = useState(false);

  // ─── Sort events for dropdown (most recent first) ───
  const sortedEvents = useMemo(() => {
    return [...raceEvents]
      .filter(e => e.status !== 'Cancelled')
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [raceEvents]);

  const selectedEvent = useMemo(() => {
    return raceEvents.find(e => e.id === selectedEventId) || null;
  }, [raceEvents, selectedEventId]);

  // ─── Helper: check if a date string falls within event range ───
  const isDateInEvent = (dateStr: string, event: RaceEvent): boolean => {
    if (!dateStr || !event) return false;
    const d = dateStr.slice(0, 10); // YYYY-MM-DD
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return d >= start && d <= end;
  };

  // ─── Build timeline entries ───
  const timelineEntries = useMemo(() => {
    if (!selectedEvent) return [];

    const entries: TimelineEntry[] = [];
    const cfg = TYPE_CONFIG;

    // Filter by car if a specific car is selected
    const carFilter = (carId?: string) => isEmptyCarId(selectedCarId) || carId === selectedCarId;

    // 1. PASS LOG ENTRIES (green)
    passLogs
      .filter(p => isDateInEvent(p.date, selectedEvent) && carFilter(p.car_id))
      .forEach(pass => {
        // Pass entry
        entries.push({
          id: `pass-${pass.id}`,
          type: 'pass',
           timestamp: parseLocalDateTime(pass.date, pass.time || '12:00'),

          title: `Pass — ${pass.eighth.toFixed(3)}s @ ${pass.mph.toFixed(1)} MPH`,
          subtitle: `${pass.sessionType}${pass.round ? ` R${pass.round}` : ''} • ${pass.lane} Lane • ${pass.result}`,
          details: {
            'ET': `${pass.eighth.toFixed(3)}s`,
            'MPH': pass.mph.toFixed(1),
            '60\'': `${pass.sixtyFoot.toFixed(3)}s`,
            '330\'': `${pass.threeThirty.toFixed(3)}s`,
            'RT': `${pass.reactionTime.toFixed(3)}s`,
            'Result': pass.result,
            'Track': pass.track,
            'Launch RPM': pass.launchRPM.toLocaleString(),
            'Boost': `${pass.boostSetting} PSI`,
          },
          ...cfg.pass,
          raw: pass,
        });

        // Weather snapshot from this pass (blue)
        entries.push({
          id: `weather-${pass.id}`,
          type: 'weather',
          timestamp: parseLocalDateTime(pass.date, pass.time || '12:00'),

          title: `Weather Snapshot — ${pass.weather.conditions}`,
          subtitle: `Recorded with pass at ${pass.time || '—'}`,
          details: {
            'Air Temp': `${pass.weather.temperature}°F`,
            'Humidity': `${pass.weather.humidity}%`,
            'Barometer': `${pass.weather.pressure} inHg`,
            'Track Temp': `${pass.weather.trackTemp}°F`,
            'Wind': `${pass.weather.windSpeed} MPH ${pass.weather.windDirection}`,
            'Dew Point': pass.weather.dewPoint ? `${pass.weather.dewPoint}°F` : undefined,
            'DA': `${pass.densityAltitude} ft`,
            'SAE': pass.saeCorrection.toFixed(3),
          },
          ...cfg.weather,
          raw: pass.weather,
        });
      });

    // 2. MAINTENANCE ACTIONS (yellow) — items whose lastService falls in event range
    maintenanceItems
      .filter(m => isDateInEvent(m.lastService, selectedEvent) && carFilter(m.car_id))
      .forEach(item => {
        entries.push({
          id: `maint-${item.id}`,
          type: 'maintenance',
          timestamp: parseLocalDateTime(item.lastService, '08:00'),

          title: `Maintenance — ${item.component}`,
          subtitle: `${item.category} • ${item.status} • Priority: ${item.priority}`,
          details: {
            'Component': item.component,
            'Category': item.category,
            'Status': item.status,
            'Priority': item.priority,
            'Current Passes': item.currentPasses,
            'Next Service': `${item.nextServicePasses} passes`,
            'Interval': `${item.passInterval} passes`,
            'Est. Cost': item.estimatedCost ? `$${item.estimatedCost.toLocaleString()}` : undefined,
          },
          ...cfg.maintenance,
          raw: item,
        });
      });

    // 3. CHECKLIST COMPLETIONS (purple) — items with checkedAt in event range
    const allChecklists = [
      ...preRunChecklist.map(c => ({ ...c, listType: 'Pre-Run' })),
      ...betweenRoundsChecklist.map(c => ({ ...c, listType: 'Between Rounds' })),
      ...postRunChecklist.map(c => ({ ...c, listType: 'Post-Run' })),
    ];

    allChecklists
      .filter(c => c.completed && c.checkedAt && isDateInEvent(c.checkedAt.slice(0, 10), selectedEvent))
      .forEach(item => {
        entries.push({
          id: `check-${item.id}`,
          type: 'checklist',
          timestamp: new Date(item.checkedAt!),
          title: `${item.listType} — ${item.task}`,
          subtitle: `${item.category}${item.checkedBy ? ` • Checked by ${item.checkedBy}` : ''}${item.critical ? ' • CRITICAL' : ''}`,
          details: {
            'Task': item.task,
            'List': item.listType,
            'Category': item.category,
            'Checked By': item.checkedBy || '—',
            'Critical': item.critical ? 'Yes' : 'No',
          },
          ...cfg.checklist,
          raw: item,
        });
      });

    // 4. WORK ORDERS (rose) — created or completed during event
    workOrders
      .filter(wo => {
        const created = isDateInEvent(wo.createdDate, selectedEvent);
        const completed = wo.completedDate ? isDateInEvent(wo.completedDate, selectedEvent) : false;
        const carMatch = carFilter(wo.car_id);
        return (created || completed) && carMatch;
      })
      .forEach(wo => {
        entries.push({
          id: `wo-${wo.id}`,
          type: 'workorder',
          timestamp: parseLocalDateTime(wo.createdDate, '09:00'),

          title: `Work Order — ${wo.title}`,
          subtitle: `${wo.category} • ${wo.status} • ${wo.priority} Priority`,
          details: {
            'Title': wo.title,
            'Status': wo.status,
            'Priority': wo.priority,
            'Category': wo.category,
            'Assigned To': wo.assignedTo || '—',
            'Est. Hours': wo.estimatedHours,
            'Actual Hours': wo.actualHours || '—',
            'Due Date': wo.dueDate,
          },
          ...cfg.workorder,
          raw: wo,
        });
      });

    // Sort chronologically
    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return entries;
  }, [selectedEvent, passLogs, maintenanceItems, workOrders, preRunChecklist, betweenRoundsChecklist, postRunChecklist, selectedCarId]);

  // ─── Filter by visible types ───
  const filteredEntries = useMemo(() => {
    return timelineEntries.filter(e => visibleTypes.has(e.type));
  }, [timelineEntries, visibleTypes]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; label: string; entries: TimelineEntry[] }[] = [];
    const map = new Map<string, TimelineEntry[]>();

    filteredEntries.forEach(entry => {
      const dateKey = entry.timestamp.toISOString().slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(entry);
    });

    map.forEach((entries, dateKey) => {
      groups.push({
        date: dateKey,
        label: formatLocalDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        entries,
      });
    });

    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }, [filteredEntries]);


  // ─── Toggle type filter ───
  const toggleType = (type: TimelineEntryType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // ─── Stats for selected event ───
  const stats = useMemo(() => {
    const passes = timelineEntries.filter(e => e.type === 'pass');
    const weather = timelineEntries.filter(e => e.type === 'weather');
    const maint = timelineEntries.filter(e => e.type === 'maintenance');
    const checks = timelineEntries.filter(e => e.type === 'checklist');
    const wos = timelineEntries.filter(e => e.type === 'workorder');
    return { passes: passes.length, weather: weather.length, maintenance: maint.length, checklists: checks.length, workorders: wos.length, total: timelineEntries.length };
  }, [timelineEntries]);

  // ─── Format time ───
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // ─── Render icon for type ───
  const TypeIcon: React.FC<{ type: TimelineEntryType; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
    const Icon = TYPE_CONFIG[type].icon;
    return <Icon className={className} />;
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* ═══ Header ═══ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              Race Day Timeline
            </h2>
            <p className="text-slate-400 mt-1">
              Chronological view of all race day activity — passes, weather, maintenance, checklists, and work orders
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showFilters
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                  : 'bg-slate-800 border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* ═══ Event Selector ═══ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="font-medium">Select Race Event:</span>
            </div>
            <div className="flex-1 max-w-lg">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setExpandedEntryId(null);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
              >
                <option value="">— Choose an event —</option>
                {sortedEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} — {event.startDate}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ''} ({event.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedEvent && (
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                  selectedEvent.status === 'Completed' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                  selectedEvent.status === 'In Progress' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  selectedEvent.status === 'Scheduled' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {selectedEvent.status}
                </span>
                {selectedEvent.trackName && (
                  <span className="text-slate-400">{selectedEvent.trackName}</span>
                )}
                {selectedEvent.result && (
                  <span className="flex items-center gap-1 text-yellow-400 font-medium">
                    <Trophy className="w-3.5 h-3.5" />
                    {selectedEvent.result}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Type Filters ═══ */}
        {showFilters && selectedEvent && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Show / Hide Entry Types</span>
              <button
                onClick={() => setShowFilters(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(TYPE_CONFIG) as [TimelineEntryType, typeof TYPE_CONFIG['pass']][]).map(([type, cfg]) => {
                const isActive = visibleTypes.has(type);
                const count = timelineEntries.filter(e => e.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.iconColor}`
                        : 'bg-slate-900/50 border-slate-700/50 text-slate-500'
                    }`}
                  >
                    {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <TypeIcon type={type} className="w-3.5 h-3.5" />
                    {cfg.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      isActive ? 'bg-white/10' : 'bg-slate-800'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Stats Summary Bar ═══ */}
        {selectedEvent && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Events</p>
            </div>
            {(Object.entries(TYPE_CONFIG) as [TimelineEntryType, typeof TYPE_CONFIG['pass']][]).map(([type, cfg]) => {
              const count = timelineEntries.filter(e => e.type === type).length;
              return (
                <div key={type} className={`rounded-lg border p-3 text-center ${cfg.bgColor} ${cfg.borderColor}`}>
                  <p className={`text-2xl font-bold ${cfg.iconColor}`}>{count}</p>
                  <p className="text-xs text-slate-400">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Empty States ═══ */}
        {!selectedEvent && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Race Event</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Choose a race event from the dropdown above to view a chronological timeline of all activity during that event — passes, weather conditions, maintenance, checklists, and work orders.
            </p>
            {sortedEvents.length === 0 && (
              <p className="text-amber-400/80 text-sm mt-4 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No race events found. Add events in the Race Calendar section first.
              </p>
            )}
          </div>
        )}

        {selectedEvent && filteredEntries.length === 0 && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-12 text-center">
            <LayoutList className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Timeline Entries</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              {stats.total === 0
                ? `No activity was recorded during "${selectedEvent.title}" (${selectedEvent.startDate}${selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` — ${selectedEvent.endDate}` : ''}). Pass logs, maintenance actions, checklist completions, and work orders that fall within the event dates will appear here.`
                : 'All entry types are currently hidden. Use the filter buttons above to show them.'
              }
            </p>
          </div>
        )}

        {/* ═══ Timeline ═══ */}
        {selectedEvent && filteredEntries.length > 0 && (
          <div className="space-y-8">
            {groupedByDate.map(group => (
              <div key={group.date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700/50">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">{group.label}</span>
                    <span className="text-xs text-slate-500 ml-1">({group.entries.length} entries)</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>

                {/* Timeline entries for this date */}
                <div className="relative ml-6 md:ml-10">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-600/50 via-slate-700/30 to-transparent" />

                  <div className="space-y-3">
                    {group.entries.map((entry, idx) => {
                      const isExpanded = expandedEntryId === entry.id;
                      const Icon = TYPE_CONFIG[entry.type].icon;

                      return (
                        <div key={entry.id} className="relative flex items-start gap-4">
                          {/* Timeline dot */}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${entry.color} border-slate-900 shadow-lg`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>

                          {/* Card */}
                          <div
                            className={`flex-1 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-lg ${entry.bgColor} ${entry.borderColor} ${
                              isExpanded ? 'shadow-lg ring-1 ring-white/5' : ''
                            }`}
                            onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          >
                            {/* Card header */}
                            <div className="flex items-start justify-between p-3 md:p-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold uppercase tracking-wider ${entry.iconColor}`}>
                                    {TYPE_CONFIG[entry.type].label}
                                  </span>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(entry.timestamp)}
                                  </span>
                                </div>
                                <h4 className="text-sm font-semibold text-white leading-snug">{entry.title}</h4>
                                {entry.subtitle && (
                                  <p className="text-xs text-slate-400 mt-0.5">{entry.subtitle}</p>
                                )}
                              </div>
                              <button
                                className="text-slate-500 hover:text-slate-300 transition-colors ml-2 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedEntryId(isExpanded ? null : entry.id);
                                }}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-3 md:px-4 pb-3 md:pb-4 border-t border-white/5">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 pt-3">
                                  {Object.entries(entry.details)
                                    .filter(([_, val]) => val !== undefined && val !== '' && val !== '—')
                                    .map(([key, val]) => (
                                      <div key={key}>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{key}</p>
                                        <p className="text-sm text-white font-mono">{String(val)}</p>
                                      </div>
                                    ))}
                                </div>

                                {/* Pass-specific: quick performance bar */}
                                {entry.type === 'pass' && entry.raw && (
                                  <div className="mt-3 pt-3 border-t border-white/5">
                                    <div className="flex items-center gap-4 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <Timer className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-slate-400">ET:</span>
                                        <span className="text-emerald-400 font-bold font-mono">{entry.raw.eighth.toFixed(3)}s</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="text-slate-400">MPH:</span>
                                        <span className="text-blue-400 font-bold font-mono">{entry.raw.mph.toFixed(1)}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Gauge className="w-3.5 h-3.5 text-orange-400" />
                                        <span className="text-slate-400">60':</span>
                                        <span className="text-orange-400 font-bold font-mono">{entry.raw.sixtyFoot.toFixed(3)}s</span>
                                      </div>
                                      {entry.raw.result === 'Win' && (
                                        <div className="flex items-center gap-1.5">
                                          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                                          <span className="text-yellow-400 font-bold">WIN</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Weather-specific: condition badges */}
                                {entry.type === 'weather' && entry.raw && (
                                  <div className="mt-3 pt-3 border-t border-white/5">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                        <Thermometer className="w-3 h-3" />
                                        {entry.raw.temperature}°F
                                      </span>
                                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        <Droplets className="w-3 h-3" />
                                        {entry.raw.humidity}%
                                      </span>
                                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                        <Wind className="w-3 h-3" />
                                        {entry.raw.windSpeed} MPH {entry.raw.windDirection}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Work order: parts list */}
                                {entry.type === 'workorder' && entry.raw?.parts?.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-white/5">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">Parts Used</p>
                                    <div className="space-y-1">
                                      {entry.raw.parts.map((part: any, pIdx: number) => (
                                        <div key={pIdx} className="flex items-center justify-between text-xs">
                                          <span className="text-slate-300">{part.name} ({part.partNumber})</span>
                                          <span className="text-slate-400">x{part.quantity} — ${part.cost.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default RaceDayTimeline;
