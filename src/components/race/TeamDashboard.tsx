import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

import { useThemeColor } from '@/contexts/ThemeColorContext';
import { CrewRole, getRoleColor } from '@/lib/permissions';
import WeatherWidget from '@/components/race/WeatherWidget';
import {
  Radio, Users, ClipboardList, Wrench, Gauge, Activity,
  Zap, CheckSquare, AlertTriangle, Package,
  RefreshCw, Loader2, Circle, Wifi, Eye, ChevronDown, ChevronUp,
  ArrowRight, Cog, RotateCcw, Flame, X, ShieldCheck, ChevronRight, Download, Printer,
  ListTodo, Clock, Calendar, Flag
} from 'lucide-react';
import { fetchToDoItems, ToDoItem } from '@/lib/database';
import { parseLocalDate } from '@/lib/utils';




interface TeamDashboardProps {
  currentRole: CrewRole;
  onNavigate: (section: string) => void;
}

interface ConnectedMember {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
  section?: string;
}

interface ActivityItem {
  id: string;
  action_type: string;
  action_label: string;
  description: string;
  actor_name: string;
  actor_role: string;
  category: string;
  metadata: Record<string, any>;
  car_id?: string; // Optional — single-car app
  created_at: string;

}

const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentRole, onNavigate }) => {
  const { user, profile, isAuthenticated, isDemoMode, effectiveUserId } = useAuth();
  const {
    passLogs, engines, superchargers, cylinderHeads, drivetrainComponents,
    maintenanceItems, sfiCertifications, partsInventory,
    preRunChecklist, betweenRoundsChecklist, postRunChecklist,
    teamMembers, savedTracks, refreshData
  } = useApp();


  // Single-car mode — no car selection needed
  const selectedCarId: string | null = null;

  const { colors } = useThemeColor();

  const [connectedMembers, setConnectedMembers] = useState<ConnectedMember[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<Date | null>(null);
  const [showAllPasses, setShowAllPasses] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [pulsePass, setPulsePass] = useState(false);
  const [pulseChecklist, setPulseChecklist] = useState(false);
  const [pulseMaintenance, setPulseMaintenance] = useState(false);

  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  const [showTodoModal, setShowTodoModal] = useState(false);

  // Assignee per alert (keyed by stable alert key) for the printable punch list / accountability sheet
  const [alertAssignees, setAlertAssignees] = useState<Record<string, string>>({});



  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // ── Fetch activity feed from database ──
  const fetchActivityFeed = useCallback(async () => {
    if (isDemoMode) {
      setIsLoadingActivity(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('team_activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (mountedRef.current) {
        setActivityFeed(data || []);
      }
    } catch (err) {
      console.warn('[TeamDashboard] Failed to fetch activity feed:', err);
    } finally {
      if (mountedRef.current) setIsLoadingActivity(false);
    }
  }, [isDemoMode]);

  // ── Log activity to database ──
  const logActivity = useCallback(async (
    actionType: string,
    actionLabel: string,
    description: string,
    category: string = 'general',
    metadata: Record<string, any> = {}
  ) => {
    if (isDemoMode || !effectiveUserId) return;
    try {
      const memberName = profile?.driverName || user?.email?.split('@')[0] || 'Team Member';
      const { error } = await supabase.from('team_activity_feed').insert({
        user_id: effectiveUserId,
        action_type: actionType,
        action_label: actionLabel,
        description,
        actor_name: memberName,
        category,
        metadata,
        // Single-car app — no car_id needed
      });

      if (error) console.warn('[TeamDashboard] Failed to log activity:', error);
    } catch (err) {
      console.warn('[TeamDashboard] Activity log error:', err);
    }
  }, [isDemoMode, effectiveUserId, profile, user, currentRole, selectedCarId]);

  // ── Set up Supabase Realtime subscriptions ──
  useEffect(() => {
    mountedRef.current = true;
    fetchActivityFeed();

    if (isDemoMode || !effectiveUserId) {
      setRealtimeStatus('disconnected');
      return;
    }

    // Create a single channel for all table subscriptions
    const channel = supabase
      .channel('team-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pass_logs' }, (payload) => {
        console.log('[TeamDashboard] pass_logs change:', payload.eventType);
        setLastRealtimeEvent(new Date());
        setPulsePass(true);
        setTimeout(() => setPulsePass(false), 2000);
        // Refresh data to get latest
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, (payload) => {
        console.log('[TeamDashboard] checklists change:', payload.eventType);
        setLastRealtimeEvent(new Date());
        setPulseChecklist(true);
        setTimeout(() => setPulseChecklist(false), 2000);
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_items' }, (payload) => {
        console.log('[TeamDashboard] maintenance_items change:', payload.eventType);
        setLastRealtimeEvent(new Date());
        setPulseMaintenance(true);
        setTimeout(() => setPulseMaintenance(false), 2000);
        refreshData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_activity_feed' }, (payload) => {
        console.log('[TeamDashboard] New activity:', payload.new);
        if (mountedRef.current && payload.new) {
          setActivityFeed(prev => [payload.new as ActivityItem, ...prev].slice(0, 50));
        }
      })
      .subscribe((status) => {
        console.log('[TeamDashboard] Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    channelRef.current = channel;

    // ── Presence channel for connected members ──
    const memberName = profile?.driverName || user?.email?.split('@')[0] || 'Team Member';
    const presenceChannel = supabase.channel('team-dashboard-presence', {
      config: { presence: { key: effectiveUserId } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const members: ConnectedMember[] = [];
        for (const [_key, presences] of Object.entries(state)) {
          const p = (presences as any[])[0];
          if (p) {
            members.push({
              id: p.user_id || _key,
              name: p.name || 'Unknown',
              role: p.role || 'Crew',
              joinedAt: p.joined_at || new Date().toISOString(),
              section: p.section
            });
          }
        }
        if (mountedRef.current) setConnectedMembers(members);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: effectiveUserId,
            name: memberName,
            role: currentRole,
            joined_at: new Date().toISOString(),
            section: 'team-dashboard'
          });
        }
      });

    presenceChannelRef.current = presenceChannel;

    // Log dashboard view
    logActivity('view', 'Opened Team Dashboard', `${memberName} opened the Team Dashboard`, 'navigation');

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [effectiveUserId, isDemoMode]);

  // ── Computed data ──
  const recentPasses = useMemo(() => {
    const sorted = [...passLogs].sort((a, b) => {
      const dateA = `${a.date} ${a.time || '00:00'}`;
      const dateB = `${b.date} ${b.time || '00:00'}`;
      return dateB.localeCompare(dateA);
    });
    return showAllPasses ? sorted.slice(0, 20) : sorted.slice(0, 5);
  }, [passLogs, showAllPasses]);

  const bestPass = useMemo(() => {
    if (passLogs.length === 0) return null;
    return passLogs.reduce((best, p) => {
      if (!best || (p.eighth > 0 && (best.eighth === 0 || p.eighth < best.eighth))) return p;
      return best;
    }, passLogs[0]);
  }, [passLogs]);

  const checklistProgress = useMemo(() => {
    const calc = (items: any[]) => {
      if (items.length === 0) return { total: 0, completed: 0, percent: 0, critical: 0, criticalDone: 0 };
      const completed = items.filter(i => i.completed).length;
      const critical = items.filter(i => i.critical);
      const criticalDone = critical.filter(i => i.completed).length;
      return {
        total: items.length,
        completed,
        percent: Math.round((completed / items.length) * 100),
        critical: critical.length,
        criticalDone
      };
    };
    return {
      preRun: calc(preRunChecklist),
      betweenRounds: calc(betweenRoundsChecklist),
      postRun: calc(postRunChecklist)
    };
  }, [preRunChecklist, betweenRoundsChecklist, postRunChecklist]);

  const componentStatus = useMemo(() => {
    const installedEngines = engines.filter(e => e.currentlyInstalled);
    const installedSC = superchargers.filter(s => s.currentlyInstalled);
    const activeCylHeads = cylinderHeads.filter(h => h.status === 'Active');
    const installedDT = drivetrainComponents.filter(d => d.currentlyInstalled);

    const dueMaintenance = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Overdue');
    const expiredCerts = sfiCertifications.filter(c => c.daysUntilExpiration <= 0);
    const lowStockParts = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock');

    return {
      installedEngines,
      installedSC,
      activeCylHeads,
      installedDT,
      dueMaintenance,
      expiredCerts,
      lowStockParts,
      totalAlerts: dueMaintenance.length + expiredCerts.length + lowStockParts.length
    };

  }, [engines, superchargers, cylinderHeads, drivetrainComponents, maintenanceItems, sfiCertifications, partsInventory]);

  // ── Build a crew roster (connected + active roster members) for alert assignment ──
  const crewRoster = useMemo(() => {
    const names = new Set<string>();
    connectedMembers.forEach((m) => { if (m.name && m.name !== 'Unknown') names.add(m.name); });
    teamMembers.filter((m) => m.isActive).forEach((m) => { if (m.name) names.add(m.name); });
    // Always include the current user so they can self-assign
    const me = profile?.driverName || user?.email?.split('@')[0];
    if (me) names.add(me);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [connectedMembers, teamMembers, profile, user]);

  // Assign a crew member to a specific alert (keyed by stable alert key)
  const setAssignee = useCallback((key: string, name: string) => {
    setAlertAssignees((prev) => {
      const next = { ...prev };
      if (name) next[key] = name;
      else delete next[key];
      return next;
    });
  }, []);


  const displayedActivity = useMemo(() => {
    return showAllActivity ? activityFeed.slice(0, 30) : activityFeed.slice(0, 8);
  }, [activityFeed, showAllActivity]);

  // ── Load open To Do items (skip completed/archived) ──
  const loadTodos = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const items = await fetchToDoItems(effectiveUserId || user?.id);
      if (mountedRef.current) setTodoItems(items || []);
    } catch (err) {
      console.warn('[TeamDashboard] Failed to fetch to-do items:', err);
    }
  }, [isDemoMode, effectiveUserId, user?.id]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Refresh todos when the realtime "Refresh" handler fires (lightweight)
  useEffect(() => {
    if (!isDemoMode && effectiveUserId) {
      const todoChannel = supabase
        .channel('team-dashboard-todos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, () => {
          loadTodos();
        })
        .subscribe();
      return () => { supabase.removeChannel(todoChannel); };
    }
  }, [isDemoMode, effectiveUserId, loadTodos]);

  // ── Compute open / overdue To Do stats ──
  const todoStats = useMemo(() => {
    const isItemOverdue = (dueDate?: string) => {
      if (!dueDate) return false;
      const due = parseLocalDate(dueDate);
      const now = new Date();
      return due < now && due.toDateString() !== now.toDateString();
    };

    const open = todoItems.filter(
      (i) => !i.isArchived && i.status !== 'Completed'
    );
    const withOverdue = open.map((i) => ({ item: i, overdue: isItemOverdue(i.dueDate) }));
    const overdue = withOverdue.filter((x) => x.overdue);
    const urgent = open.filter((i) => i.priority === 'Urgent');

    const priorityRank: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    // Sort: overdue first, then due date, then priority
    const sorted = [...withOverdue].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const da = a.item.dueDate ? parseLocalDate(a.item.dueDate).getTime() : Infinity;
      const db = b.item.dueDate ? parseLocalDate(b.item.dueDate).getTime() : Infinity;
      if (da !== db) return da - db;
      return (priorityRank[a.item.priority] ?? 9) - (priorityRank[b.item.priority] ?? 9);
    });

    return {
      open: open.length,
      overdueCount: overdue.length,
      urgentCount: urgent.length,
      sorted,
      isItemOverdue,
    };
  }, [todoItems]);


  // ── Export all current alerts to CSV (crew pre-race prep records) ──
  const handleExportAlertsCSV = useCallback(() => {
    const escape = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['Alert Type', 'Item Name', 'Status', 'Days Remaining / Overdue', 'Recommended Action'];
    const rows: string[][] = [];

    // Maintenance Due
    componentStatus.dueMaintenance.forEach((m) => {
      rows.push([
        'Maintenance',
        m.component || 'Maintenance Item',
        m.status || 'Due',
        m.status === 'Overdue' ? 'Overdue' : 'Due now',
        m.status === 'Overdue'
          ? `Service ${m.component || 'item'} immediately before running`
          : `Perform scheduled service on ${m.component || 'item'}`,
      ]);
    });

    // Expired SFI Certifications
    componentStatus.expiredCerts.forEach((c) => {
      const days = c.daysUntilExpiration ?? 0;
      const daysLabel = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Expires today' : `${days} days remaining`;
      rows.push([
        'SFI Certification',
        `${c.item}${c.sfiSpec ? ` (${c.sfiSpec})` : ''}`,
        days <= 0 ? 'Expired' : 'Expiring',
        daysLabel,
        `Recertify or replace ${c.item} before tech inspection`,
      ]);
    });

    // Low / Out of Stock Parts
    componentStatus.lowStockParts.forEach((p) => {
      rows.push([
        'Parts Stock',
        p.name || p.description || 'Part',
        p.status || 'Low Stock',
        `On hand ${p.onHand ?? 0}${p.minQuantity != null ? ` / min ${p.minQuantity}` : ''}`,
        p.status === 'Out of Stock'
          ? `Reorder ${p.name || p.description || 'part'} — out of stock`
          : `Restock ${p.name || p.description || 'part'} to minimum level`,
      ]);
    });

    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ];
    // UTF-8 BOM for Excel compatibility
    const csv = '\uFEFF' + csvLines.join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [componentStatus]);

  // ── Print a clean, printer-friendly punch list of all current alerts ──
  const handlePrintAlerts = useCallback(() => {
    const esc = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val);
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    interface PrintRow { item: string; status: string; days: string; action: string; overdue: boolean; assignedTo: string; }
    const groups: { title: string; rows: PrintRow[] }[] = [];

    if (componentStatus.dueMaintenance.length > 0) {
      groups.push({
        title: 'Maintenance Due',
        rows: componentStatus.dueMaintenance.map((m) => ({
          item: m.component || 'Maintenance Item',
          status: m.status || 'Due',
          days: m.status === 'Overdue' ? 'Overdue' : 'Due now',
          action: m.status === 'Overdue'
            ? `Service ${m.component || 'item'} immediately before running`
            : `Perform scheduled service on ${m.component || 'item'}`,
          overdue: m.status === 'Overdue',
          assignedTo: alertAssignees[`maint-${m.id}`] || '',
        })),
      });
    }

    if (componentStatus.expiredCerts.length > 0) {
      groups.push({
        title: 'Expired SFI Certifications',
        rows: componentStatus.expiredCerts.map((c) => {
          const days = c.daysUntilExpiration ?? 0;
          return {
            item: `${c.item}${c.sfiSpec ? ` (${c.sfiSpec})` : ''}`,
            status: days <= 0 ? 'Expired' : 'Expiring',
            days: days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Expires today' : `${days} days remaining`,
            action: `Recertify or replace ${c.item} before tech inspection`,
            overdue: days <= 0,
            assignedTo: alertAssignees[`cert-${c.id}`] || '',
          };
        }),
      });
    }

    if (componentStatus.lowStockParts.length > 0) {
      groups.push({
        title: 'Low / Out of Stock Parts',
        rows: componentStatus.lowStockParts.map((p) => ({
          item: p.name || p.description || 'Part',
          status: p.status || 'Low Stock',
          days: `On hand ${p.onHand ?? 0}${p.minQuantity != null ? ` / min ${p.minQuantity}` : ''}`,
          action: p.status === 'Out of Stock'
            ? `Reorder ${p.name || p.description || 'part'} — out of stock`
            : `Restock ${p.name || p.description || 'part'} to minimum level`,
          overdue: p.status === 'Out of Stock',
          assignedTo: alertAssignees[`part-${p.id}`] || '',
        })),
      });
    }

    const printedOn = new Date().toLocaleString();
    const total = componentStatus.totalAlerts;
    const assignedCount = Object.values(alertAssignees).filter(Boolean).length;

    const groupsHtml = groups.length === 0
      ? `<p class="allclear">No active alerts. All maintenance, certifications, and parts stock are in good standing.</p>`
      : groups.map((g) => `
        <section class="group">
          <h2>${esc(g.title)} <span class="count">(${g.rows.length})</span></h2>
          <table>
            <thead>
              <tr>
                <th class="chk"></th>
                <th>Item</th>
                <th>Status</th>
                <th>Days Remaining / Overdue</th>
                <th>Recommended Action</th>
                <th class="assigned">Assigned To</th>
                <th class="signoff">Initials / Sign-off</th>
              </tr>
            </thead>
            <tbody>
              ${g.rows.map((r) => `
                <tr>
                  <td class="chk"><span class="box"></span></td>
                  <td class="item">${esc(r.item)}</td>
                  <td><span class="status ${r.overdue ? 'crit' : 'warn'}">${esc(r.status)}</span></td>
                  <td>${esc(r.days)}</td>
                  <td class="action">${esc(r.action)}</td>
                  <td class="assigned">${r.assignedTo ? esc(r.assignedTo) : '<span class="blankline">&nbsp;</span>'}</td>
                  <td class="signoff"><span class="blankline">&nbsp;</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </section>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pre-Race Alerts Punch List</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; }
    header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #555; }
    .summary { font-size: 14px; font-weight: bold; margin-top: 8px; }
    .submeta { font-size: 11px; color: #555; margin-top: 2px; }
    .group { margin-bottom: 24px; page-break-inside: avoid; }
    h2 { font-size: 16px; margin: 0 0 8px; border-left: 5px solid #111; padding-left: 8px; }
    .count { font-weight: normal; color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eee; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
    .chk { width: 28px; text-align: center; }
    .box { display: inline-block; width: 14px; height: 14px; border: 2px solid #333; }
    .item { font-weight: bold; }
    .action { color: #333; }
    .assigned { width: 110px; }
    .signoff { width: 110px; }
    .blankline { display: inline-block; min-width: 90px; border-bottom: 1px solid #999; }
    .status { font-weight: bold; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    .status.crit { color: #b00020; }
    .status.warn { color: #8a5b00; }
    .allclear { font-size: 14px; padding: 20px; border: 1px dashed #999; text-align: center; color: #060; }
    footer { margin-top: 28px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 11px; color: #777; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <header>
    <h1>Pre-Race Alerts Punch List &amp; Accountability Sheet</h1>
    <div class="meta">Printed: ${esc(printedOn)}</div>
    <div class="summary">${total} item${total === 1 ? '' : 's'} require attention before race day</div>
    <div class="submeta">${assignedCount} of ${total} item${total === 1 ? '' : 's'} pre-assigned to a crew member</div>
  </header>
  ${groupsHtml}
  <footer>Generated by the Team Dashboard — assign each item, check the box when complete, and have the responsible crew member initial / sign off. Post at the trailer for crew reference.</footer>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups for this site.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Give the new window a moment to render before invoking print
    setTimeout(() => {
      try { printWindow.print(); } catch (e) { /* user can print manually */ }
    }, 300);
  }, [componentStatus, alertAssignees]);


  // ── Helper: format relative time ──
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  // ── Helper: get activity icon ──
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pass_logged': return <Gauge className="w-4 h-4 text-green-400" />;
      case 'maintenance_completed': return <Wrench className="w-4 h-4 text-blue-400" />;
      case 'parts_used': return <Package className="w-4 h-4 text-orange-400" />;
      case 'checklist_completed': return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'engine_swap': return <RotateCcw className="w-4 h-4 text-purple-400" />;
      case 'service_reset': return <RefreshCw className="w-4 h-4 text-cyan-400" />;


      case 'view': return <Eye className="w-4 h-4 text-slate-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  // ── Checklist progress bar component ──
  const ChecklistBar = ({ label, data, type }: { label: string; data: any; type: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs text-slate-400">
          {data.completed}/{data.total}
          {data.critical > 0 && (
            <span className={`ml-1 ${data.criticalDone === data.critical ? 'text-emerald-400' : 'text-red-400'}`}>
              ({data.criticalDone}/{data.critical} critical)
            </span>
          )}
        </span>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            data.percent === 100 ? 'bg-emerald-500' :
            data.percent >= 75 ? 'bg-blue-500' :
            data.percent >= 50 ? 'bg-yellow-500' :
            data.percent > 0 ? 'bg-orange-500' : 'bg-slate-600'
          }`}
          style={{ width: `${data.percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold ${
          data.percent === 100 ? 'text-emerald-400' : 'text-slate-500'
        }`}>
          {data.percent}%
        </span>
        {data.percent === 100 && (
          <span className="text-[10px] text-emerald-400 font-medium">Complete</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-950 min-h-screen">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* ═══════════ Header ═══════════ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${colors.base}, ${colors.dark})` }}
              >
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Team Dashboard</h1>
                <p className="text-sm text-slate-400">Real-time race day status &amp; team activity</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Realtime Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : realtimeStatus === 'connecting'
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {realtimeStatus === 'connected' ? (
                <><Wifi className="w-3.5 h-3.5" /><span className="hidden sm:inline">Live</span><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /></>
              ) : realtimeStatus === 'connecting' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline">Connecting...</span></>
              ) : (
                <><Circle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Offline</span></>
              )}
            </div>

            {/* Connected Members Count */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>{connectedMembers.length} online</span>
            </div>

            {/* Last Update */}
            {lastRealtimeEvent && (
              <span className="text-[10px] text-slate-500">
                Last update: {formatRelativeTime(lastRealtimeEvent.toISOString())}
              </span>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => { refreshData(); fetchActivityFeed(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ═══════════ Quick Stats Row ═══════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <button onClick={() => onNavigate('passlog')} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:bg-slate-800 transition-colors text-left group">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Total Passes</span>
            </div>
            <p className="text-2xl font-bold text-white">{passLogs.length}</p>
            {bestPass && bestPass.eighth > 0 && (
              <p className="text-[10px] text-green-400 mt-1">Best: {bestPass.eighth.toFixed(3)}s @ {bestPass.mph.toFixed(1)} mph</p>
            )}
          </button>

          <button onClick={() => onNavigate('engines')} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:bg-slate-800 transition-colors text-left">
            <div className="flex items-center gap-2 mb-2">
              <Cog className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400">Components</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {componentStatus.installedEngines.length + componentStatus.installedSC.length + componentStatus.activeCylHeads.length + componentStatus.installedDT.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">installed / active</p>
          </button>

          <button onClick={() => onNavigate('maintenance')} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:bg-slate-800 transition-colors text-left">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Maintenance</span>
            </div>
            <p className={`text-2xl font-bold ${componentStatus.dueMaintenance.length > 0 ? 'text-red-400' : 'text-white'}`}>
              {componentStatus.dueMaintenance.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">items due</p>
          </button>

          {/* Parts — combined Low Stock + Total Alerts card */}
          <button
            onClick={() => setShowAlertsModal(true)}
            className={`bg-slate-800/60 rounded-xl border p-4 transition-colors text-left ${
              componentStatus.totalAlerts > 0
                ? 'border-red-500/40 hover:bg-red-500/10'
                : 'border-slate-700/50 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Package className={`w-4 h-4 ${componentStatus.totalAlerts > 0 ? 'text-red-400' : 'text-purple-400'}`} />
              <span className="text-xs text-slate-400">Parts</span>
            </div>
            <p className={`text-2xl font-bold ${componentStatus.totalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {componentStatus.totalAlerts}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              {componentStatus.totalAlerts === 0
                ? 'All clear'
                : `${componentStatus.lowStockParts.length} low/out · view details`}
              {componentStatus.totalAlerts > 0 && <ChevronRight className="w-3 h-3" />}
            </p>
          </button>

          {/* To Do Items — overdue emphasized */}
          <button
            onClick={() => setShowTodoModal(true)}
            className={`bg-slate-800/60 rounded-xl border p-4 transition-colors text-left ${
              todoStats.overdueCount > 0
                ? 'border-red-500/40 hover:bg-red-500/10'
                : todoStats.open > 0
                  ? 'border-orange-500/30 hover:bg-slate-800'
                  : 'border-slate-700/50 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <ListTodo className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400">To Do</span>
            </div>
            <p className={`text-2xl font-bold ${
              todoStats.overdueCount > 0 ? 'text-red-400' : todoStats.open > 0 ? 'text-white' : 'text-emerald-400'
            }`}>
              {todoStats.open}
            </p>
            <p className="text-[10px] mt-1 flex items-center gap-1">
              {todoStats.overdueCount > 0 ? (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {todoStats.overdueCount} overdue
                </span>
              ) : todoStats.open > 0 ? (
                <span className="text-slate-500">open tasks</span>
              ) : (
                <span className="text-slate-500">all done</span>
              )}
              {todoStats.open > 0 && <ChevronRight className="w-3 h-3 text-slate-500" />}
            </p>
          </button>
        </div>


        {/* ═══════════ Main Grid ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Column 1: Latest Passes + Checklist Progress ── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Latest Pass Data */}
            <div className={`bg-slate-800/50 rounded-xl border transition-all duration-500 ${
              pulsePass ? 'border-green-500/60 shadow-lg shadow-green-500/10' : 'border-slate-700/50'
            }`}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4.5 h-4.5 text-green-400" />
                  <h2 className="text-sm font-semibold text-white">Latest Passes</h2>
                  {pulsePass && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  )}
                </div>
                <button
                  onClick={() => onNavigate('passlog')}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {recentPasses.length === 0 ? (
                  <div className="text-center py-6">
                    <Gauge className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No passes logged yet</p>
                  </div>
                ) : (
                  <>
                    {recentPasses.map((pass, idx) => (
                      <div
                        key={pass.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg ${
                          idx === 0 && pulsePass ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-900/40'
                        } transition-all`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">{pass.date}</span>
                            {pass.time && <span className="text-[10px] text-slate-500">{pass.time}</span>}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{pass.track}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {pass.eighth > 0 ? (
                            <>
                              <p className="text-sm font-bold font-mono text-white">{pass.eighth.toFixed(3)}</p>
                              <p className="text-[10px] text-slate-400">{pass.mph > 0 ? `${pass.mph.toFixed(1)} mph` : ''}</p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">{pass.aborted ? 'Aborted' : 'No ET'}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {passLogs.length > 5 && (
                      <button
                        onClick={() => setShowAllPasses(!showAllPasses)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {showAllPasses ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showAllPasses ? 'Show Less' : `Show More (${passLogs.length} total)`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Checklist Progress */}
            <div className={`bg-slate-800/50 rounded-xl border transition-all duration-500 ${
              pulseChecklist ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10' : 'border-slate-700/50'
            }`}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4.5 h-4.5 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Checklist Progress</h2>
                  {pulseChecklist && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <button
                  onClick={() => onNavigate('checklists')}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  Open <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {preRunChecklist.length === 0 && betweenRoundsChecklist.length === 0 && postRunChecklist.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No checklists configured</p>
                  </div>
                ) : (
                  <>
                    {preRunChecklist.length > 0 && (
                      <ChecklistBar label="Pre-Run" data={checklistProgress.preRun} type="preRun" />
                    )}
                    {betweenRoundsChecklist.length > 0 && (
                      <ChecklistBar label="Between Rounds" data={checklistProgress.betweenRounds} type="betweenRounds" />
                    )}
                    {postRunChecklist.length > 0 && (
                      <ChecklistBar label="Post-Run" data={checklistProgress.postRun} type="postRun" />
                    )}

                    {/* Overall summary */}
                    <div className="pt-2 border-t border-slate-700/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Overall</span>
                        <span className="font-medium text-white">
                          {checklistProgress.preRun.completed + checklistProgress.betweenRounds.completed + checklistProgress.postRun.completed}
                          /
                          {checklistProgress.preRun.total + checklistProgress.betweenRounds.total + checklistProgress.postRun.total}
                          {' '}items
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Connected Team Members */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-blue-400" />
                  <h2 className="text-sm font-semibold text-white">Connected Members</h2>
                </div>
                <span className="text-xs text-slate-400">{connectedMembers.length} online</span>
              </div>

              <div className="p-4">
                {connectedMembers.length === 0 ? (
                  <div className="text-center py-4">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      {isDemoMode ? 'Presence tracking requires authentication' : 'No members currently viewing'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connectedMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-800" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{member.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRoleColor(member.role as any)}`}>
                              {member.role}
                            </span>
                            {member.section && (
                              <span className="text-[10px] text-slate-500">{member.section}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500">{formatRelativeTime(member.joinedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show registered team members who are offline */}
                {teamMembers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-[10px] text-slate-500 mb-2">Team Roster ({teamMembers.filter(m => m.isActive).length} members)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {teamMembers.filter(m => m.isActive).slice(0, 8).map(m => {
                        const isOnline = connectedMembers.some(c => c.name === m.name);
                        return (
                          <span
                            key={m.id}
                            className={`text-[10px] px-2 py-1 rounded-full border ${
                              isOnline
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            {isOnline && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />}
                            {m.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Column 2: Weather + Component Status ── */}
          <div className="lg:col-span-1 space-y-6">
            <WeatherWidget onNavigate={onNavigate} trackElevation={(() => {
              const favTrack = savedTracks.find((t: any) => t.isFavorite && (t.elevation || 0) > 0);
              if (favTrack) return favTrack.elevation || 0;
              const anyTrack = savedTracks.find((t: any) => (t.elevation || 0) > 0);
              return anyTrack?.elevation || 0;
            })()} />


            {/* Component Status Overview */}
            <div className={`bg-slate-800/50 rounded-xl border transition-all duration-500 ${
              pulseMaintenance ? 'border-orange-500/60 shadow-lg shadow-orange-500/10' : 'border-slate-700/50'
            }`}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Cog className="w-4.5 h-4.5 text-orange-400" />
                  <h2 className="text-sm font-semibold text-white">Component Status</h2>
                  {pulseMaintenance && (
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                  )}
                </div>
                <button
                  onClick={() => onNavigate('engines')}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  Details <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Engines */}
                {componentStatus.installedEngines.map(eng => (
                  <div key={eng.id} className="p-3 bg-slate-900/40 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-medium text-white truncate">{eng.name}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        eng.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-400'
                      }`}>{eng.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500">Total Passes</span>
                        <p className="text-white font-mono">{eng.totalPasses}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Since Rebuild</span>
                        <p className="text-white font-mono">{eng.passesSinceRebuild}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Power Adders */}
                {componentStatus.installedSC.map(sc => (
                  <div key={sc.id} className="p-3 bg-slate-900/40 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-xs font-medium text-white truncate">{sc.name}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        sc.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-400'
                      }`}>{sc.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500">Total Passes</span>
                        <p className="text-white font-mono">{sc.totalPasses}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Since Service</span>
                        <p className="text-white font-mono">{sc.passesSinceService}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Drivetrain highlights */}
                {componentStatus.installedDT.length > 0 && (
                  <div className="p-3 bg-slate-900/40 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Cog className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-medium text-white">Drivetrain</span>
                      <span className="text-[10px] text-slate-500">{componentStatus.installedDT.length} installed</span>
                    </div>
                    <div className="space-y-1">
                      {componentStatus.installedDT.slice(0, 4).map(dt => (
                        <div key={dt.id} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate">{dt.name}</span>
                          <span className="text-white font-mono">{dt.totalPasses} passes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance Alerts */}
                {componentStatus.dueMaintenance.length > 0 && (
                  <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-medium text-red-400">Maintenance Due</span>
                    </div>
                    <div className="space-y-1">
                      {componentStatus.dueMaintenance.slice(0, 4).map(m => (
                        <div key={m.id} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate">{m.component}</span>
                          <span className={`font-medium ${m.status === 'Overdue' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {componentStatus.installedEngines.length === 0 && componentStatus.installedSC.length === 0 && componentStatus.installedDT.length === 0 && (
                  <div className="text-center py-6">
                    <Cog className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No installed components</p>
                    <button
                      onClick={() => onNavigate('engines')}
                      className="mt-2 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Set up components
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Column 3: Activity Feed ── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Team Activity</h2>
                  {realtimeStatus === 'connected' && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4">
                {isLoadingActivity ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                  </div>
                ) : displayedActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 mb-1">No activity yet</p>
                    <p className="text-xs text-slate-500">
                      Team actions like logging passes, completing maintenance, and using parts will appear here in real time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {displayedActivity.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={`flex gap-3 p-2.5 rounded-lg transition-all ${
                          idx === 0 ? 'bg-slate-900/60 border border-slate-700/30' : 'hover:bg-slate-900/30'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getActivityIcon(item.action_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white font-medium leading-snug">{item.action_label}</p>
                          {item.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {item.actor_name && (
                              <span className="text-[10px] text-slate-500">{item.actor_name}</span>
                            )}
                            {item.actor_role && (
                              <span className={`text-[9px] px-1 py-0.5 rounded ${getRoleColor(item.actor_role as any)}`}>
                                {item.actor_role}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-600">{formatRelativeTime(item.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {activityFeed.length > 8 && (
                      <button
                        onClick={() => setShowAllActivity(!showAllActivity)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {showAllActivity ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showAllActivity ? 'Show Less' : `Show More (${activityFeed.length} total)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="px-5 py-3.5 border-b border-slate-700/50">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Quick Actions
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onNavigate('passlog')}
                  className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-xs font-medium"
                >
                  <Gauge className="w-4 h-4" />
                  Log Pass
                </button>
                <button
                  onClick={() => onNavigate('checklists')}
                  className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium"
                >
                  <CheckSquare className="w-4 h-4" />
                  Checklists
                </button>
                <button
                  onClick={() => onNavigate('maintenance')}
                  className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                >
                  <Wrench className="w-4 h-4" />
                  Maintenance
                </button>


                <button
                  onClick={() => onNavigate('engines')}
                  className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors text-xs font-medium"
                >
                  <Cog className="w-4 h-4" />
                  Components
                </button>
                <button
                  onClick={() => onNavigate('parts')}
                  className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors text-xs font-medium"
                >
                  <Package className="w-4 h-4" />
                  Parts
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ Total Alerts Modal ═══════════ */}
        {showAlertsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowAlertsModal(false)}
          >
            <div
              className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    componentStatus.totalAlerts > 0 ? 'bg-red-500/15' : 'bg-emerald-500/15'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 ${componentStatus.totalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Parts &amp; Alerts</h2>
                    <p className="text-xs text-slate-400">
                      {componentStatus.totalAlerts} item{componentStatus.totalAlerts === 1 ? '' : 's'} need attention
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAlertsModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {componentStatus.totalAlerts === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                      <CheckSquare className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-white">All clear</p>
                    <p className="text-xs text-slate-400 mt-1">No maintenance, certification, or stock alerts right now.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400 -mt-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      Assign each alert to a crew member, then print the punch list with{' '}
                      <span className="text-slate-300 font-medium">Assigned&nbsp;To</span> and{' '}
                      <span className="text-slate-300 font-medium">Initials&nbsp;/&nbsp;Sign-off</span> columns.
                    </p>
                    {/* Maintenance Due */}

                    {componentStatus.dueMaintenance.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold text-white">Maintenance Due</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                              {componentStatus.dueMaintenance.length}
                            </span>
                          </div>
                          <button
                            onClick={() => { setShowAlertsModal(false); onNavigate('maintenance'); }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            Go to Maintenance <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {componentStatus.dueMaintenance.map((m) => {
                            const key = `maint-${m.id}`;
                            return (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40"
                              >
                                <button
                                  onClick={() => { setShowAlertsModal(false); onNavigate('maintenance'); }}
                                  className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                >
                                  <p className="text-xs font-medium text-white truncate">{m.component || 'Maintenance Item'}</p>
                                  {m.category && <p className="text-[10px] text-slate-400 truncate">{m.category}</p>}
                                </button>
                                <select
                                  value={alertAssignees[key] || ''}
                                  onChange={(e) => setAssignee(key, e.target.value)}
                                  className="text-[10px] bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[110px]"
                                  title="Assign crew member"
                                >
                                  <option value="">Unassigned</option>
                                  {crewRoster.map((n) => (<option key={n} value={n}>{n}</option>))}
                                </select>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                                  m.status === 'Overdue' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}>{m.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}


                    {/* Expired Certifications */}
                    {componentStatus.expiredCerts.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-semibold text-white">Expired SFI Certifications</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                              {componentStatus.expiredCerts.length}
                            </span>
                          </div>
                          <button
                            onClick={() => { setShowAlertsModal(false); onNavigate('maintenance'); }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                          >
                            View Certs <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {componentStatus.expiredCerts.map((c) => {
                            const key = `cert-${c.id}`;
                            return (
                              <div
                                key={c.id}
                                className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40"
                              >
                                <button
                                  onClick={() => { setShowAlertsModal(false); onNavigate('maintenance'); }}
                                  className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                >
                                  <p className="text-xs font-medium text-white truncate">{c.item}</p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {c.sfiSpec ? `${c.sfiSpec} · ` : ''}Exp: {c.expirationDate || 'N/A'}
                                  </p>
                                </button>
                                <select
                                  value={alertAssignees[key] || ''}
                                  onChange={(e) => setAssignee(key, e.target.value)}
                                  className="text-[10px] bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[110px]"
                                  title="Assign crew member"
                                >
                                  <option value="">Unassigned</option>
                                  {crewRoster.map((n) => (<option key={n} value={n}>{n}</option>))}
                                </select>
                                <span className="text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0 bg-red-500/20 text-red-400">
                                  {c.daysUntilExpiration < 0 ? `${Math.abs(c.daysUntilExpiration)}d expired` : 'Expired'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}


                    {/* Low / Out of Stock Parts */}
                    {componentStatus.lowStockParts.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-orange-400" />
                            <span className="text-sm font-semibold text-white">Low / Out of Stock Parts</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                              {componentStatus.lowStockParts.length}
                            </span>
                          </div>
                          <button
                            onClick={() => { setShowAlertsModal(false); onNavigate('parts'); }}
                            className="text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-1"
                          >
                            Go to Parts <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {componentStatus.lowStockParts.map((p) => {
                            const key = `part-${p.id}`;
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40"
                              >
                                <button
                                  onClick={() => { setShowAlertsModal(false); onNavigate('parts'); }}
                                  className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                >
                                  <p className="text-xs font-medium text-white truncate">{p.name || p.description}</p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    On hand: {p.onHand ?? 0}{p.minQuantity != null ? ` / min ${p.minQuantity}` : ''}
                                  </p>
                                </button>
                                <select
                                  value={alertAssignees[key] || ''}
                                  onChange={(e) => setAssignee(key, e.target.value)}
                                  className="text-[10px] bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 max-w-[110px]"
                                  title="Assign crew member"
                                >
                                  <option value="">Unassigned</option>
                                  {crewRoster.map((n) => (<option key={n} value={n}>{n}</option>))}
                                </select>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                                  p.status === 'Out of Stock' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                }`}>{p.status}</span>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-700/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportAlertsCSV}
                    disabled={componentStatus.totalAlerts === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    title={componentStatus.totalAlerts === 0 ? 'No alerts to export' : 'Export all current alerts to CSV'}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={handlePrintAlerts}
                    disabled={componentStatus.totalAlerts === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    title={componentStatus.totalAlerts === 0 ? 'No alerts to print' : 'Print a clean punch list of all current alerts'}
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
                <button
                  onClick={() => setShowAlertsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ To Do Items Modal ═══════════ */}
        {showTodoModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowTodoModal(false)}
          >
            <div
              className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    todoStats.overdueCount > 0 ? 'bg-red-500/15' : todoStats.open > 0 ? 'bg-orange-500/15' : 'bg-emerald-500/15'
                  }`}>
                    <ListTodo className={`w-5 h-5 ${
                      todoStats.overdueCount > 0 ? 'text-red-400' : todoStats.open > 0 ? 'text-orange-400' : 'text-emerald-400'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">To Do List</h2>
                    <p className="text-xs text-slate-400">
                      {todoStats.open} open task{todoStats.open === 1 ? '' : 's'}
                      {todoStats.overdueCount > 0 && (
                        <span className="text-red-400 font-medium"> · {todoStats.overdueCount} overdue</span>
                      )}
                      {todoStats.urgentCount > 0 && (
                        <span className="text-orange-400 font-medium"> · {todoStats.urgentCount} urgent</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTodoModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-1.5">
                {isDemoMode ? (
                  <div className="text-center py-10">
                    <ListTodo className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-white">Sign in to track tasks</p>
                    <p className="text-xs text-slate-400 mt-1">The To Do List requires an account to sync tasks.</p>
                  </div>
                ) : todoStats.open === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                      <CheckSquare className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-white">No open tasks</p>
                    <p className="text-xs text-slate-400 mt-1">Everything on the to-do list is complete.</p>
                  </div>
                ) : (
                  todoStats.sorted.map(({ item, overdue }) => {
                    const priorityColor =
                      item.priority === 'Urgent' ? 'bg-red-500/20 text-red-400' :
                      item.priority === 'High' ? 'bg-orange-500/20 text-orange-400' :
                      item.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400';
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setShowTodoModal(false); onNavigate('todo'); }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                          overdue
                            ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                            : 'bg-slate-800/60 border-slate-700/40 hover:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                            <p className="text-xs font-medium text-white truncate">{item.title}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><Flag className="w-3 h-3" />{item.category || 'General'}</span>
                            {item.assignedTo && (
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.assignedTo}</span>
                            )}
                            {item.dueDate && (
                              <span className={`flex items-center gap-1 ${overdue ? 'text-red-400 font-semibold' : ''}`}>
                                {overdue ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                                {(() => {
                                  const due = parseLocalDate(item.dueDate);
                                  const today = new Date();
                                  const diffDays = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
                                  if (overdue) return `${Math.abs(diffDays)}d overdue`;
                                  if (diffDays === 0) return 'Due today';
                                  if (diffDays === 1) return 'Due tomorrow';
                                  return `Due in ${diffDays}d`;
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${priorityColor}`}>{item.priority}</span>
                          {item.status === 'In Progress' && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-400">In Progress</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-700/70 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setShowTodoModal(false); onNavigate('todo'); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors text-xs font-medium"
                >
                  <ListTodo className="w-4 h-4" />
                  Open To Do List
                </button>
                <button
                  onClick={() => setShowTodoModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TeamDashboard;
