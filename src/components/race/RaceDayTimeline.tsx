import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseLocalDateTime, formatLocalDate, getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';

import { RaceEvent } from '@/components/race/RaceCalendar';
import { exportTimelineReport, exportTimelineCSV, TimelineReportEntry } from '@/components/race/TimelineReportExport';

import {
  Clock,
  Calendar,
  Filter,
  Gauge,
  Thermometer,
  Wrench,
  CheckSquare,
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
  X,
  Search,
  Download,
  Printer,
  User,
  Wifi,
  Circle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Package,
  RotateCcw,
  FileSpreadsheet,
  Settings2,
  BarChart3,
  Target,
  Milestone
} from 'lucide-react';


// ─── Timeline entry types ───
type TimelineEntryType = 'pass' | 'weather' | 'maintenance' | 'checklist' | 'activity';


interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: Date;
  title: string;
  subtitle?: string;
  actor?: string;
  actorRole?: string;
  details: Record<string, string | number | undefined>;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  raw?: any;
}

// ─── Export options interface ───
interface ExportOptions {
  types: Set<TimelineEntryType>;
  dateFrom: string;
  dateTo: string;
  includeStats: boolean;
}

// ─── Color config per type ───
const TYPE_CONFIG: Record<TimelineEntryType, { label: string; color: string; bgColor: string; borderColor: string; iconColor: string; icon: any }> = {
  pass:        { label: 'Passes',      color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', iconColor: 'text-emerald-400', icon: Gauge },
  weather:     { label: 'Weather',     color: 'bg-sky-500',     bgColor: 'bg-sky-500/10',     borderColor: 'border-sky-500/30',     iconColor: 'text-sky-400',     icon: Thermometer },
  maintenance: { label: 'Maintenance', color: 'bg-amber-500',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   iconColor: 'text-amber-400',   icon: Wrench },
  checklist:   { label: 'Checklists',  color: 'bg-violet-500',  bgColor: 'bg-violet-500/10',  borderColor: 'border-violet-500/30',  iconColor: 'text-violet-400',  icon: CheckSquare },
  activity:    { label: 'Activity',    color: 'bg-cyan-500',    bgColor: 'bg-cyan-500/10',    borderColor: 'border-cyan-500/30',    iconColor: 'text-cyan-400',    icon: Activity },
};

const isEmptyCarId = (id?: string) => !id || id === '' || id === 'all';

const RaceDayTimeline: React.FC = () => {
  const {
    passLogs,
    maintenanceItems,
    preRunChecklist,
    betweenRoundsChecklist,
    postRunChecklist,
    raceEvents,
    teamMembers,
    refreshData,
  } = useApp();




  const { user, profile, effectiveUserId, isDemoMode } = useAuth();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<TimelineEntryType>>(
    new Set(['pass', 'weather', 'maintenance', 'checklist', 'activity'])
  );
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isExporting, setIsExporting] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    types: new Set(['pass', 'weather', 'maintenance', 'checklist', 'activity']),
    dateFrom: '',
    dateTo: '',
    includeStats: true,
  });


  // Realtime state
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [activityFeedEntries, setActivityFeedEntries] = useState<any[]>([]);
  const [pulseNew, setPulseNew] = useState(false);
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // ─── Fetch activity feed from DB ───
  const fetchActivityFeed = useCallback(async () => {
    if (isDemoMode || !effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('team_activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data && mountedRef.current) {
        setActivityFeedEntries(data);
      }
    } catch {}
  }, [isDemoMode, effectiveUserId]);

  // ─── Realtime subscription ───
  useEffect(() => {
    mountedRef.current = true;
    fetchActivityFeed();

    if (isDemoMode || !effectiveUserId) {
      setRealtimeStatus('disconnected');
      return;
    }

    const channel = supabase
      .channel('timeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pass_logs' }, () => {
        setPulseNew(true);
        setTimeout(() => setPulseNew(false), 3000);
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, () => {
        setPulseNew(true);
        setTimeout(() => setPulseNew(false), 3000);
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_items' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_activity_feed' }, (payload) => {
        if (mountedRef.current && payload.new) {
          setActivityFeedEntries(prev => [payload.new as any, ...prev].slice(0, 100));
          setPulseNew(true);
          setTimeout(() => setPulseNew(false), 3000);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('disconnected');
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [effectiveUserId, isDemoMode]);

  // ─── Sort events for dropdown ───
  const sortedEvents = useMemo(() => {
    return [...raceEvents]
      .filter(e => e.status !== 'Cancelled')
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [raceEvents]);

  const selectedEvent = useMemo(() => {
    return raceEvents.find(e => e.id === selectedEventId) || null;
  }, [raceEvents, selectedEventId]);

  // Auto-select today's event
  useEffect(() => {
    if (!selectedEventId && raceEvents.length > 0) {
      const today = getLocalDateString();
      const todayEvent = raceEvents.find(e => {
        const end = e.endDate || e.startDate;
        return today >= e.startDate && today <= end && e.status !== 'Cancelled';
      });
      if (todayEvent) setSelectedEventId(todayEvent.id);
    }
  }, [raceEvents, selectedEventId]);

  // ─── Helper: check if a date falls within event range ───
  const isDateInEvent = (dateStr: string, event: RaceEvent): boolean => {
    if (!dateStr || !event) return false;
    const d = dateStr.slice(0, 10);
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return d >= start && d <= end;
  };

  // ─── Resolve actor name from various sources ───
  const resolveActor = (checkedBy?: string, performedBy?: string, assignedTo?: string): { name: string; role: string } => {
    const rawName = checkedBy || performedBy || assignedTo || '';
    if (!rawName) return { name: '', role: '' };

    // Try to find in team members
    const member = teamMembers.find(m =>
      m.name.toLowerCase() === rawName.toLowerCase() ||
      m.name.toLowerCase().includes(rawName.toLowerCase())
    );
    if (member) return { name: member.name, role: member.role };
    return { name: rawName, role: '' };
  };

  // ─── Build timeline entries ───
  const timelineEntries = useMemo(() => {
    if (!selectedEvent) return [];

    const entries: TimelineEntry[] = [];
    const cfg = TYPE_CONFIG;
    const carFilter = (_carId?: string) => true; // Single-car mode — no filtering needed


    // 1. PASS LOG ENTRIES
    passLogs
      .filter(p => isDateInEvent(p.date, selectedEvent) && carFilter(p.car_id))
      .forEach(pass => {
        // Calculate back split for quarter-mile
        const qmBackSplit = (() => {
          if (pass.endSplit && pass.endSplit > 0) return pass.endSplit;
          if ((pass.quarterMileET || 0) > 0 && pass.eighth > 0) return (pass.quarterMileET || 0) - pass.eighth;
          return 0;
        })();

        entries.push({
          id: `pass-${pass.id}`,
          type: 'pass',
          timestamp: parseLocalDateTime(pass.date, pass.time || '12:00'),
          title: `Pass — ${pass.eighth > 0 ? pass.eighth.toFixed(3) + 's' : 'No ET'} @ ${pass.mph > 0 ? pass.mph.toFixed(1) + ' MPH' : '—'}`,
          subtitle: `${pass.sessionType}${pass.round ? ` R${pass.round}` : ''} | ${pass.lane} Lane | ${pass.result}`,
          actor: profile?.driverName || 'Driver',
          actorRole: 'Driver',
          details: {
            'ET': pass.eighth > 0 ? `${pass.eighth.toFixed(3)}s` : undefined,
            'MPH': pass.mph > 0 ? pass.mph.toFixed(1) : undefined,
            "60'": pass.sixtyFoot > 0 ? `${pass.sixtyFoot.toFixed(3)}s` : undefined,
            "330'": pass.threeThirty > 0 ? `${pass.threeThirty.toFixed(3)}s` : undefined,
            'RT': pass.reactionTime > 0 ? `${pass.reactionTime.toFixed(3)}s` : undefined,
            'Result': pass.result,
            'Track': pass.track,
            // Quarter-mile fields (only shown when values exist)
            '1/4 ET': (pass.quarterMileET || 0) > 0 ? `${pass.quarterMileET!.toFixed(3)}s` : undefined,
            '1/4 MPH': (pass.quarterMileMPH || 0) > 0 ? pass.quarterMileMPH!.toFixed(1) : undefined,
            '1/4 Back Split': qmBackSplit > 0 ? `${qmBackSplit.toFixed(3)}s` : undefined,
          },
          ...cfg.pass,
          raw: pass,
        });

        // Weather snapshot from this pass
        if (pass.weather) {
          entries.push({
            id: `weather-${pass.id}`,
            type: 'weather',
            timestamp: parseLocalDateTime(pass.date, pass.time || '12:00'),
            title: `Weather — ${pass.weather.conditions || 'Conditions recorded'}`,
            subtitle: `Snapshot with pass at ${pass.time || '—'}`,
            details: {
              'Air Temp': pass.weather.temperature ? `${pass.weather.temperature}°F` : undefined,
              'Humidity': pass.weather.humidity ? `${pass.weather.humidity}%` : undefined,
              'Barometer': pass.weather.pressure ? `${pass.weather.pressure} inHg` : undefined,
              'Track Temp': pass.weather.trackTemp ? `${pass.weather.trackTemp}°F` : undefined,
              'Wind': pass.weather.windSpeed ? `${pass.weather.windSpeed} MPH ${pass.weather.windDirection || ''}` : undefined,
              'DA': pass.densityAltitude ? `${pass.densityAltitude} ft` : undefined,
              'SAE': pass.saeCorrection ? pass.saeCorrection.toFixed(3) : undefined,
            },
            ...cfg.weather,
            raw: pass.weather,
          });
        }
      });

    // 2. MAINTENANCE ACTIONS
    maintenanceItems
      .filter(m => isDateInEvent(m.lastService, selectedEvent) && carFilter(m.car_id))
      .forEach(item => {
        const actor = resolveActor(undefined, undefined, undefined);
        entries.push({
          id: `maint-${item.id}`,
          type: 'maintenance',
          timestamp: parseLocalDateTime(item.lastService, '08:00'),
          title: `Maintenance — ${item.component}`,
          subtitle: `${item.category} | ${item.status} | Priority: ${item.priority}`,
          actor: actor.name || 'Crew',
          actorRole: actor.role || 'Mechanic',
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

    // 3. CHECKLIST COMPLETIONS
    const allChecklists = [
      ...preRunChecklist.map(c => ({ ...c, listType: 'Pre-Run' })),
      ...betweenRoundsChecklist.map(c => ({ ...c, listType: 'Between Rounds' })),
      ...postRunChecklist.map(c => ({ ...c, listType: 'Post-Run' })),
    ];

    allChecklists
      .filter(c => c.completed && c.checkedAt && isDateInEvent(c.checkedAt.slice(0, 10), selectedEvent))
      .forEach(item => {
        const actor = resolveActor(item.checkedBy);
        entries.push({
          id: `check-${item.id}`,
          type: 'checklist',
          timestamp: new Date(item.checkedAt!),
          title: `${item.listType} — ${item.task}`,
          subtitle: `${item.category}${item.critical ? ' | CRITICAL' : ''}`,
          actor: actor.name || item.checkedBy || '',
          actorRole: actor.role || '',
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


    // 4. TEAM ACTIVITY FEED entries that fall within the event
    activityFeedEntries
      .filter(a => {
        if (!a.created_at) return false;
        const dateStr = a.created_at.slice(0, 10);
        return isDateInEvent(dateStr, selectedEvent);
      })
      .forEach(a => {
        // Skip duplicates that overlap with pass/checklist/maintenance entries
        const actionType = a.action_type || '';
        if (['pass_logged', 'checklist_completed', 'maintenance_completed'].includes(actionType)) return;

        entries.push({
          id: `activity-${a.id}`,
          type: 'activity',
          timestamp: new Date(a.created_at),
          title: a.action_label || a.action_type || 'Team Activity',
          subtitle: a.description || '',
          actor: a.actor_name || '',
          actorRole: a.actor_role || '',
          details: {
            'Action': a.action_type,
            'Category': a.category || '—',
          },
          ...TYPE_CONFIG.activity,
          raw: a,
        });
      });

    // Sort
    entries.sort((a, b) => sortOrder === 'asc'
      ? a.timestamp.getTime() - b.timestamp.getTime()
      : b.timestamp.getTime() - a.timestamp.getTime()
    );
    return entries;
  }, [selectedEvent, passLogs, maintenanceItems, preRunChecklist, betweenRoundsChecklist, postRunChecklist, activityFeedEntries, sortOrder, teamMembers, profile]);


  // ─── Filter by visible types + search ───
  const filteredEntries = useMemo(() => {
    let result = timelineEntries.filter(e => visibleTypes.has(e.type));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.subtitle || '').toLowerCase().includes(q) ||
        (e.actor || '').toLowerCase().includes(q) ||
        Object.values(e.details).some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    return result;
  }, [timelineEntries, visibleTypes, searchQuery]);

  // ─── Group by date ───
  const groupedByDate = useMemo(() => {
    const groups: { date: string; label: string; entries: TimelineEntry[] }[] = [];
    const map = new Map<string, TimelineEntry[]>();

    filteredEntries.forEach(entry => {
      const dateKey = getLocalDateString(entry.timestamp);
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

    groups.sort((a, b) => sortOrder === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    return groups;
  }, [filteredEntries, sortOrder]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const passes = timelineEntries.filter(e => e.type === 'pass');
    const passRaws = passes.map(p => p.raw).filter(Boolean);
    const bestET = passRaws.length > 0 ? Math.min(...passRaws.filter((p: any) => p.eighth > 0).map((p: any) => p.eighth)) : null;
    const bestMPH = passRaws.length > 0 ? Math.max(...passRaws.filter((p: any) => p.mph > 0).map((p: any) => p.mph)) : null;
    const bestQuarterET = passRaws.length > 0 ? Math.min(...passRaws.filter((p: any) => (p.quarterMileET || 0) > 0).map((p: any) => p.quarterMileET)) : null;
    const bestQuarterMPH = passRaws.length > 0 ? Math.max(...passRaws.filter((p: any) => (p.quarterMileMPH || 0) > 0).map((p: any) => p.quarterMileMPH)) : null;

    return {
      passes: passes.length,
      weather: timelineEntries.filter(e => e.type === 'weather').length,
      maintenance: timelineEntries.filter(e => e.type === 'maintenance').length,
      checklists: timelineEntries.filter(e => e.type === 'checklist').length,
      activity: timelineEntries.filter(e => e.type === 'activity').length,
      total: timelineEntries.length,
      bestET: bestET && isFinite(bestET) ? bestET : null,
      bestMPH: bestMPH && isFinite(bestMPH) ? bestMPH : null,
      bestQuarterET: bestQuarterET && isFinite(bestQuarterET) ? bestQuarterET : null,
      bestQuarterMPH: bestQuarterMPH && isFinite(bestQuarterMPH) ? bestQuarterMPH : null,
    };
  }, [timelineEntries]);

  // ─── Unique actors ───
  const uniqueActors = useMemo(() => {
    const actors = new Set<string>();
    timelineEntries.forEach(e => { if (e.actor) actors.add(e.actor); });
    return Array.from(actors);
  }, [timelineEntries]);

  // ─── Toggle type filter ───
  const toggleType = (type: TimelineEntryType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // ─── Toggle export type filter ───
  const toggleExportType = (type: TimelineEntryType) => {
    setExportOptions(prev => {
      const next = new Set(prev.types);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, types: next };
    });
  };

  // ─── Format time ───
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // ─── Open Export Modal ───
  const openExportModal = () => {
    if (!selectedEvent) {
      toast.error('Select a race event first');
      return;
    }
    if (filteredEntries.length === 0) {
      toast.error('No timeline entries to export');
      return;
    }
    // Initialize export options with event date range
    setExportOptions({
      types: new Set(['pass', 'weather', 'maintenance', 'checklist', 'activity'] as TimelineEntryType[]),
      dateFrom: selectedEvent.startDate,
      dateTo: selectedEvent.endDate || selectedEvent.startDate,
      includeStats: true,
    });
    setShowExportModal(true);
  };

  // ─── Get filtered entries for export based on export options ───
  const getExportEntries = (): TimelineEntry[] => {
    return timelineEntries.filter(entry => {
      // Type filter
      if (!exportOptions.types.has(entry.type)) return false;
      // Date range filter
      if (exportOptions.dateFrom || exportOptions.dateTo) {
        const entryDate = getLocalDateString(entry.timestamp);
        if (exportOptions.dateFrom && entryDate < exportOptions.dateFrom) return false;
        if (exportOptions.dateTo && entryDate > exportOptions.dateTo) return false;
      }
      return true;
    });
  };

  // ─── Build report data for export ───
  const buildReportData = (entries: TimelineEntry[]): {
    reportEntries: TimelineReportEntry[];
    reportStats: any;
  } => {
    const reportEntries: TimelineReportEntry[] = entries.map(e => ({
      id: e.id,
      type: e.type,
      timestamp: e.timestamp,
      title: e.title,
      subtitle: e.subtitle,
      actor: e.actor,
      actorRole: e.actorRole,
      details: e.details,
    }));

    // Calculate stats from filtered entries
    const passRaws = entries.filter(e => e.type === 'pass').map(p => p.raw).filter(Boolean);
    const bestET = passRaws.length > 0 ? Math.min(...passRaws.filter((p: any) => p.eighth > 0).map((p: any) => p.eighth)) : null;
    const bestMPH = passRaws.length > 0 ? Math.max(...passRaws.filter((p: any) => p.mph > 0).map((p: any) => p.mph)) : null;
    const bestQuarterET = passRaws.length > 0 ? Math.min(...passRaws.filter((p: any) => (p.quarterMileET || 0) > 0).map((p: any) => p.quarterMileET)) : null;
    const bestQuarterMPH = passRaws.length > 0 ? Math.max(...passRaws.filter((p: any) => (p.quarterMileMPH || 0) > 0).map((p: any) => p.quarterMileMPH)) : null;

    const reportStats = {
      totalPasses: entries.filter(e => e.type === 'pass').length,
      bestET: bestET && isFinite(bestET) ? bestET : null,
      bestMPH: bestMPH && isFinite(bestMPH) ? bestMPH : null,
      bestQuarterET: bestQuarterET && isFinite(bestQuarterET) ? bestQuarterET : null,
      bestQuarterMPH: bestQuarterMPH && isFinite(bestQuarterMPH) ? bestQuarterMPH : null,
      checklistCompletion: entries.filter(e => e.type === 'checklist').length,
      maintenanceActions: entries.filter(e => e.type === 'maintenance').length,
      weatherSnapshots: entries.filter(e => e.type === 'weather').length,
    };

    return { reportEntries, reportStats };
  };


  // ─── PDF Export ───
  const handleExportPDF = () => {
    if (!selectedEvent) return;

    const exportEntries = getExportEntries();
    if (exportEntries.length === 0) {
      toast.error('No entries match the selected filters');
      return;
    }

    setIsExporting(true);

    try {
      const { reportEntries, reportStats } = buildReportData(exportEntries);

      exportTimelineReport({
        event: selectedEvent,
        entries: reportEntries,
        teamName: profile?.teamName || 'Race Team',
        generatedBy: profile?.driverName || user?.email?.split('@')[0] || 'User',
        stats: reportStats,
        includeStats: exportOptions.includeStats,
      });

      toast.success('Race Day Report opened', {
        description: 'Use your browser\'s Print dialog to save as PDF.',
        duration: 5000,
      });
      setShowExportModal(false);
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── CSV Export ───
  const handleExportCSV = () => {
    if (!selectedEvent) return;

    const exportEntries = getExportEntries();
    if (exportEntries.length === 0) {
      toast.error('No entries match the selected filters');
      return;
    }

    setIsExporting(true);

    try {
      const { reportEntries, reportStats } = buildReportData(exportEntries);

      exportTimelineCSV({
        event: selectedEvent,
        entries: reportEntries,
        teamName: profile?.teamName || 'Race Team',
        generatedBy: profile?.driverName || user?.email?.split('@')[0] || 'User',
        stats: reportStats,
        includeStats: exportOptions.includeStats,
      });

      toast.success(`Exported ${exportEntries.length} entries to CSV`, {
        description: `File: race-day-timeline-${selectedEvent.startDate}.csv`,
        duration: 4000,
      });
      setShowExportModal(false);
    } catch (err) {
      toast.error('Failed to generate CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render icon for type ───
  const TypeIcon: React.FC<{ type: TimelineEntryType; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
    const Icon = TYPE_CONFIG[type].icon;
    return <Icon className={className} />;
  };

  // ─── Activity type icon (for activity feed entries) ───
  const getActivityTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'pass_logged': return <Gauge className="w-3.5 h-3.5" />;
      case 'maintenance_completed': return <Wrench className="w-3.5 h-3.5" />;
      case 'parts_used': return <Package className="w-3.5 h-3.5" />;
      case 'checklist_completed': return <CheckSquare className="w-3.5 h-3.5" />;
      case 'engine_swap': return <RotateCcw className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };


  // ─── Export entry count preview ───
  const exportEntryCount = useMemo(() => {
    if (!showExportModal) return 0;
    return getExportEntries().length;
  }, [showExportModal, exportOptions, timelineEntries]);

  return (
    <section className="py-6 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* ═══ Header ═══ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              Race Day Timeline
            </h2>
            <p className="text-slate-400 mt-1 text-sm">
              Chronological feed of all race day activities with actor attribution and live updates
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Realtime Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : realtimeStatus === 'connecting'
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              {realtimeStatus === 'connected' ? (
                <><Wifi className="w-3 h-3" /><span>Live</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /></>
              ) : realtimeStatus === 'connecting' ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /><span>Connecting</span></>
              ) : (
                <><Circle className="w-3 h-3" /><span>Offline</span></>
              )}
            </div>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-medium"
              title={sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
            </button>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                showFilters
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              <Filter className="w-3 h-3" />
              Filters
              {visibleTypes.size < 6 && (
                <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {visibleTypes.size}
                </span>
              )}
            </button>

            {/* Export Button (opens modal) */}
            <button
              onClick={openExportModal}
              disabled={!selectedEvent || filteredEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Download className="w-3 h-3" />
              Export Report
            </button>
          </div>
        </div>

        {/* ═══ Event Selector ═══ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="font-medium">Race Event:</span>
            </div>
            <div className="flex-1 max-w-lg">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setExpandedEntryId(null);
                  setSearchQuery('');
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
                  <span className="text-slate-400 text-xs">{selectedEvent.trackName}</span>
                )}
                {selectedEvent.result && (
                  <span className="flex items-center gap-1 text-yellow-400 font-medium text-xs">
                    <Trophy className="w-3.5 h-3.5" />
                    {selectedEvent.result}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Search bar */}
          {selectedEvent && (
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search timeline entries — type, actor, details..."
                className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ═══ Type Filters ═══ */}
        {showFilters && selectedEvent && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 mb-5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Filter by Activity Type</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVisibleTypes(new Set(['pass', 'weather', 'maintenance', 'checklist', 'activity'] as TimelineEntryType[]))}

                  className="text-[10px] text-slate-500 hover:text-white transition-colors px-2 py-1 rounded bg-slate-800"
                >
                  Show All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(TYPE_CONFIG) as [TimelineEntryType, typeof TYPE_CONFIG['pass']][]).map(([type, tcfg]) => {
                const isActive = visibleTypes.has(type);
                const count = timelineEntries.filter(e => e.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? `${tcfg.bgColor} ${tcfg.borderColor} ${tcfg.iconColor}`
                        : 'bg-slate-900/50 border-slate-700/50 text-slate-500'
                    }`}
                  >
                    {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <TypeIcon type={type} className="w-3.5 h-3.5" />
                    {tcfg.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isActive ? 'bg-white/10' : 'bg-slate-800'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Actor filter info */}
            {uniqueActors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/30">
                <span className="text-xs text-slate-500 mr-2">Contributors:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {uniqueActors.map(actor => (
                    <span key={actor} className="text-[10px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center gap-1">
                      <User className="w-2.5 h-2.5" />
                      {actor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Stats Summary Bar ═══ */}
        {selectedEvent && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-5">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 text-center">
              <p className="text-xl font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-slate-400">Total</p>
            </div>
            {(Object.entries(TYPE_CONFIG) as [TimelineEntryType, typeof TYPE_CONFIG['pass']][]).map(([type, tcfg]) => {
              const count = timelineEntries.filter(e => e.type === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className={`rounded-lg border p-3 text-center ${tcfg.bgColor} ${tcfg.borderColor}`}>
                  <p className={`text-xl font-bold ${tcfg.iconColor}`}>{count}</p>
                  <p className="text-[10px] text-slate-400">{tcfg.label}</p>
                </div>
              );
            })}
            {stats.bestET && (
              <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/30 p-3 text-center">
                <p className="text-xl font-bold text-emerald-400 font-mono">{stats.bestET.toFixed(3)}</p>
                <p className="text-[10px] text-slate-400">Best 1/8 ET</p>
              </div>
            )}
            {stats.bestMPH && (
              <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 p-3 text-center">
                <p className="text-xl font-bold text-blue-400 font-mono">{stats.bestMPH.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">Best 1/8 MPH</p>
              </div>
            )}
            {stats.bestQuarterET && (
              <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/30 p-3 text-center">
                <p className="text-xl font-bold text-emerald-300 font-mono">{stats.bestQuarterET.toFixed(3)}</p>
                <p className="text-[10px] text-slate-400">Best 1/4 ET</p>
              </div>
            )}
            {stats.bestQuarterMPH && (
              <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 p-3 text-center">
                <p className="text-xl font-bold text-blue-300 font-mono">{stats.bestQuarterMPH.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">Best 1/4 MPH</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Empty States ═══ */}
        {!selectedEvent && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Race Event</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Choose a race event from the dropdown above to view a chronological timeline of all activity — passes, weather, maintenance, checklists, and team activity.

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
              {searchQuery
                ? `No entries match "${searchQuery}". Try a different search term.`
                : stats.total === 0
                ? `No activity was recorded during "${selectedEvent.title}". Pass logs, maintenance actions, and checklist completions that fall within the event dates will appear here.`
                : 'All entry types are currently hidden. Use the filter buttons above to show them.'
              }

            </p>
          </div>
        )}

        {/* ═══ Timeline ═══ */}
        {selectedEvent && filteredEntries.length > 0 && (
          <div className="space-y-8">
            {/* New entry pulse indicator */}
            {pulseNew && (
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-medium animate-pulse">
                  <Zap className="w-3.5 h-3.5" />
                  New activity detected — timeline updated
                </div>
              </div>
            )}

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
                <div className="relative ml-4 md:ml-8">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-600/50 via-slate-700/30 to-transparent" />

                  <div className="space-y-3">
                    {group.entries.map((entry) => {
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
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${entry.iconColor}`}>
                                    {TYPE_CONFIG[entry.type].label}
                                  </span>
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatTime(entry.timestamp)}
                                  </span>
                                  {/* Actor badge */}
                                  {entry.actor && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded">
                                      <User className="w-2.5 h-2.5" />
                                      {entry.actor}
                                      {entry.actorRole && (
                                        <span className="text-slate-500">({entry.actorRole})</span>
                                      )}
                                    </span>
                                  )}
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
                                    <div className="flex items-center gap-4 text-xs flex-wrap">
                                      {/* Eighth-mile metrics */}
                                      {entry.raw.eighth > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Timer className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="text-slate-400">1/8 ET:</span>
                                          <span className="text-emerald-400 font-bold font-mono">{entry.raw.eighth.toFixed(3)}s</span>
                                        </div>
                                      )}
                                      {entry.raw.mph > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Zap className="w-3.5 h-3.5 text-blue-400" />
                                          <span className="text-slate-400">1/8 MPH:</span>
                                          <span className="text-blue-400 font-bold font-mono">{entry.raw.mph.toFixed(1)}</span>
                                        </div>
                                      )}
                                      {entry.raw.sixtyFoot > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Gauge className="w-3.5 h-3.5 text-orange-400" />
                                          <span className="text-slate-400">60':</span>
                                          <span className="text-orange-400 font-bold font-mono">{entry.raw.sixtyFoot.toFixed(3)}s</span>
                                        </div>
                                      )}
                                      {/* Quarter-mile metrics */}
                                      {(entry.raw.quarterMileET || 0) > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Milestone className="w-3.5 h-3.5 text-purple-400" />
                                          <span className="text-slate-400">1/4 ET:</span>
                                          <span className="text-purple-400 font-bold font-mono">{entry.raw.quarterMileET.toFixed(3)}s</span>
                                        </div>
                                      )}
                                      {(entry.raw.quarterMileMPH || 0) > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                                          <span className="text-slate-400">1/4 MPH:</span>
                                          <span className="text-cyan-400 font-bold font-mono">{entry.raw.quarterMileMPH.toFixed(1)}</span>
                                        </div>
                                      )}
                                      {(() => {
                                        const backSplit = (entry.raw.endSplit && entry.raw.endSplit > 0)
                                          ? entry.raw.endSplit
                                          : ((entry.raw.quarterMileET || 0) > 0 && entry.raw.eighth > 0)
                                            ? (entry.raw.quarterMileET || 0) - entry.raw.eighth
                                            : 0;
                                        return backSplit > 0 ? (
                                          <div className="flex items-center gap-1.5">
                                            <BarChart3 className="w-3.5 h-3.5 text-pink-400" />
                                            <span className="text-slate-400">Back Split:</span>
                                            <span className="text-pink-400 font-bold font-mono">{backSplit.toFixed(3)}s</span>
                                          </div>
                                        ) : null;
                                      })()}
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
                                      {entry.raw.temperature && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                          <Thermometer className="w-3 h-3" />
                                          {entry.raw.temperature}°F
                                        </span>
                                      )}
                                      {entry.raw.humidity && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                          <Droplets className="w-3 h-3" />
                                          {entry.raw.humidity}%
                                        </span>
                                      )}
                                      {entry.raw.windSpeed && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                          <Wind className="w-3 h-3" />
                                          {entry.raw.windSpeed} MPH {entry.raw.windDirection || ''}
                                        </span>
                                      )}
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

            {/* Export CTA at bottom */}
            {filteredEntries.length > 3 && (
              <div className="flex items-center justify-center pt-4 pb-2">
                <button
                  onClick={openExportModal}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-red-500/30 transition-all text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export Full Race Day Report
                  <span className="text-xs text-orange-400/60 ml-1">({filteredEntries.length} entries)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Export Modal ═══ */}
        {showExportModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowExportModal(false)}>
            <div
              className="bg-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                      <Settings2 className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Export Race Day Report</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedEvent.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5">
                {/* Entry Type Filters */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-orange-400" />
                      Include Entry Types
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setExportOptions(prev => ({
                          ...prev,
                          types: new Set(['pass', 'weather', 'maintenance', 'checklist', 'activity'] as TimelineEntryType[]),

                        }))}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      >
                        All
                      </button>
                      <button
                        onClick={() => setExportOptions(prev => ({
                          ...prev,
                          types: new Set(),
                        }))}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.entries(TYPE_CONFIG) as [TimelineEntryType, typeof TYPE_CONFIG['pass']][]).map(([type, tcfg]) => {
                      const isActive = exportOptions.types.has(type);
                      const count = timelineEntries.filter(e => e.type === type).length;
                      return (
                        <button
                          key={type}
                          onClick={() => toggleExportType(type)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                            isActive
                              ? `${tcfg.bgColor} ${tcfg.borderColor} ${tcfg.iconColor}`
                              : 'bg-slate-900/50 border-slate-700/50 text-slate-500'
                          }`}
                        >
                          {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <TypeIcon type={type} className="w-3 h-3" />
                          <span className="flex-1 text-left">{tcfg.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-white/10' : 'bg-slate-800'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-400" />
                    Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1 block">From</label>
                      <input
                        type="date"
                        value={exportOptions.dateFrom}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, dateFrom: e.target.value }))}
                        min={selectedEvent.startDate}
                        max={selectedEvent.endDate || selectedEvent.startDate}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1 block">To</label>
                      <input
                        type="date"
                        value={exportOptions.dateTo}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, dateTo: e.target.value }))}
                        min={selectedEvent.startDate}
                        max={selectedEvent.endDate || selectedEvent.startDate}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Event dates: {selectedEvent.startDate}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` to ${selectedEvent.endDate}` : ''}
                  </p>
                </div>

                {/* Include Stats Toggle */}
                <div>
                  <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2.5">
                    <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                    Report Options
                  </label>
                  <button
                    onClick={() => setExportOptions(prev => ({ ...prev, includeStats: !prev.includeStats }))}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition-all ${
                      exportOptions.includeStats
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                        : 'bg-slate-900/50 border-slate-700/50 text-slate-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                      exportOptions.includeStats
                        ? 'bg-orange-500 border-orange-500'
                        : 'border-slate-600'
                    }`}>
                      {exportOptions.includeStats && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Include Stats Summary</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Best ET, MPH, quarter-mile data, type counts, and performance overview</p>
                    </div>
                  </button>
                </div>

                {/* Preview count */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/30 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span>Entries matching filters:</span>

                  </div>
                  <span className={`text-lg font-bold font-mono ${exportEntryCount > 0 ? 'text-white' : 'text-red-400'}`}>
                    {exportEntryCount}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-700/50 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-medium rounded-lg border border-slate-700 hover:border-slate-600"
                >
                  Cancel
                </button>
                <div className="flex-1 flex gap-3">
                  <button
                    onClick={handleExportCSV}
                    disabled={isExporting || exportEntryCount === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm font-medium hover:bg-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isExporting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                    )}
                    Export CSV
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting || exportEntryCount === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isExporting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default RaceDayTimeline;
