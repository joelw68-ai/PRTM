import React, { useState, useMemo, useCallback } from 'react';
import DateInputDark from '@/components/ui/DateInputDark';


import { useApp } from '@/contexts/AppContext';
import {
  Users,
  Plus,
  Calendar,
  DollarSign,
  Clock,
  Edit2,
  Trash2,
  X,
  Download,
  TrendingUp,
  User,
  Search,
  Filter,
  Sun,
  Info,
  Flag,
  BarChart3,
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface DailyLaborEntry {
  id: string;
  teamMemberId: string;
  teamMemberName: string;
  date: string;
  hours: number;
  hourlyRate: number;
  dailyRate?: number;
  rateType: 'hourly' | 'daily';
  totalCost: number;
  description: string;
  category: 'Shop Work' | 'Race Day' | 'Travel' | 'Maintenance' | 'Fabrication' | 'Other';
  notes: string;
  eventId?: string;
  eventName?: string;
}

// Extracted union types for type-safe select onChange handlers (avoids `as any` casts)
type DateRangeFilter = 'week' | 'month' | 'year' | 'all';
type LaborCategory = DailyLaborEntry['category'];

interface LaborTrackingProps {
  laborEntries: DailyLaborEntry[];
  setLaborEntries: React.Dispatch<React.SetStateAction<DailyLaborEntry[]>>;
  onSyncEntry?: (entry: DailyLaborEntry) => Promise<void>;
  onDeleteEntry?: (id: string) => Promise<void>;
}

const LaborTracking: React.FC<LaborTrackingProps> = ({ laborEntries, setLaborEntries, onSyncEntry, onDeleteEntry }) => {

  const { teamMembers, raceEvents } = useApp();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyLaborEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [viewMode, setViewMode] = useState<'entries' | 'byEvent'>('entries');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  const DEFAULT_HOURLY_RATE = 125;
  const DEFAULT_DAILY_RATE = 800;
  
  const [newEntry, setNewEntry] = useState<Partial<DailyLaborEntry>>({
    date: new Date().toISOString().split('T')[0],
    teamMemberId: '',
    teamMemberName: '',
    hours: 0,
    hourlyRate: DEFAULT_HOURLY_RATE,
    dailyRate: DEFAULT_DAILY_RATE,
    rateType: 'hourly',
    totalCost: 0,
    description: '',
    category: 'Shop Work',
    notes: '',
    eventId: '',
    eventName: ''
  });

  // Filter entries based on date range
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return new Date('2020-01-01');
    }
  };

  const filteredEntries = useMemo(() => {
    const dateFilter = getDateFilter();
    return laborEntries.filter(entry => {
      const matchesSearch = 
        entry.teamMemberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.eventName && entry.eventName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesMember = filterMember === 'all' || entry.teamMemberId === filterMember;
      const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
      const matchesEvent = filterEvent === 'all' || entry.eventId === filterEvent || (filterEvent === 'unassigned' && !entry.eventId);
      const matchesDate = new Date(entry.date) >= dateFilter;
      return matchesSearch && matchesMember && matchesCategory && matchesEvent && matchesDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [laborEntries, searchTerm, filterMember, filterCategory, filterEvent, dateRange]);

  // Statistics
  const stats = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, e) => sum + (e.rateType === 'hourly' ? e.hours : 0), 0);
    const totalDays = filteredEntries.filter(e => e.rateType === 'daily').length;
    const totalCost = filteredEntries.reduce((sum, e) => sum + e.totalCost, 0);
    const avgHourlyRate = filteredEntries.filter(e => e.rateType === 'hourly').length > 0 
      ? filteredEntries.filter(e => e.rateType === 'hourly').reduce((sum, e) => sum + e.hourlyRate, 0) / filteredEntries.filter(e => e.rateType === 'hourly').length 
      : DEFAULT_HOURLY_RATE;
    
    // By team member
    const byMember: Record<string, { hours: number; days: number; cost: number; entries: number }> = {};
    filteredEntries.forEach(entry => {
      if (!byMember[entry.teamMemberName]) {
        byMember[entry.teamMemberName] = { hours: 0, days: 0, cost: 0, entries: 0 };
      }
      if (entry.rateType === 'hourly') {
        byMember[entry.teamMemberName].hours += entry.hours;
      } else {
        byMember[entry.teamMemberName].days += 1;
      }
      byMember[entry.teamMemberName].cost += entry.totalCost;
      byMember[entry.teamMemberName].entries += 1;
    });
    
    // By category
    const byCategory: Record<string, { hours: number; days: number; cost: number }> = {};
    filteredEntries.forEach(entry => {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { hours: 0, days: 0, cost: 0 };
      }
      if (entry.rateType === 'hourly') {
        byCategory[entry.category].hours += entry.hours;
      } else {
        byCategory[entry.category].days += 1;
      }
      byCategory[entry.category].cost += entry.totalCost;
    });

    // By event
    const byEvent: Record<string, { 
      eventId: string;
      eventName: string;
      hours: number; 
      days: number; 
      cost: number; 
      entries: DailyLaborEntry[];
      trackName?: string;
      startDate?: string;
    }> = {};
    
    filteredEntries.forEach(entry => {
      const eventKey = entry.eventId || 'unassigned';
      if (!byEvent[eventKey]) {
        const event = raceEvents.find(e => e.id === entry.eventId);
        byEvent[eventKey] = { 
          eventId: entry.eventId || 'unassigned',
          eventName: entry.eventName || 'Unassigned',
          hours: 0, 
          days: 0, 
          cost: 0, 
          entries: [],
          trackName: event?.trackName,
          startDate: event?.startDate
        };
      }
      if (entry.rateType === 'hourly') {
        byEvent[eventKey].hours += entry.hours;
      } else {
        byEvent[eventKey].days += 1;
      }
      byEvent[eventKey].cost += entry.totalCost;
      byEvent[eventKey].entries.push(entry);
    });
    
    return { totalHours, totalDays, totalCost, avgHourlyRate, byMember, byCategory, byEvent };
  }, [filteredEntries, raceEvents]);

  // Calculate total cost based on rate type
  const calculateTotalCost = (rateType: 'hourly' | 'daily', hours: number, hourlyRate: number, dailyRate: number) => {
    if (rateType === 'daily') {
      return dailyRate;
    }
    return hours * hourlyRate;
  };

  const handleSaveEntry = () => {
    const totalCost = calculateTotalCost(
      newEntry.rateType || 'hourly',
      newEntry.hours || 0,
      newEntry.hourlyRate || DEFAULT_HOURLY_RATE,
      newEntry.dailyRate || DEFAULT_DAILY_RATE
    );
    
    let savedEntry: DailyLaborEntry;
    
    if (editingEntry) {
      savedEntry = { ...editingEntry, ...newEntry, totalCost } as DailyLaborEntry;
      // Optimistic update
      setLaborEntries(prev => prev.map(e => 
        e.id === editingEntry.id ? savedEntry : e
      ));
    } else {
      savedEntry = {
        id: `LABOR-${Date.now()}`,
        ...newEntry as DailyLaborEntry,
        totalCost
      };
      // Optimistic update
      setLaborEntries(prev => [savedEntry, ...prev]);
    }
    
    // Sync to database in background
    if (onSyncEntry) {
      onSyncEntry(savedEntry).catch(err => {
        console.error('Failed to sync labor entry to database:', err);
        // Revert optimistic update on error
        if (editingEntry) {
          setLaborEntries(prev => prev.map(e => 
            e.id === editingEntry.id ? editingEntry : e
          ));
        } else {
          setLaborEntries(prev => prev.filter(e => e.id !== savedEntry.id));
        }
      });
    }
    
    setShowAddModal(false);
    setEditingEntry(null);
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      teamMemberId: '',
      teamMemberName: '',
      hours: 0,
      hourlyRate: DEFAULT_HOURLY_RATE,
      dailyRate: DEFAULT_DAILY_RATE,
      rateType: 'hourly',
      totalCost: 0,
      description: '',
      category: 'Shop Work',
      notes: '',
      eventId: '',
      eventName: ''
    });
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Delete this labor entry?')) {
      const deletedEntry = laborEntries.find(e => e.id === id);
      // Optimistic update
      setLaborEntries(prev => prev.filter(e => e.id !== id));
      
      // Sync to database in background
      if (onDeleteEntry) {
        onDeleteEntry(id).catch(err => {
          console.error('Failed to delete labor entry from database:', err);
          // Revert optimistic update on error
          if (deletedEntry) {
            setLaborEntries(prev => [...prev, deletedEntry]);
          }
        });
      }
    }
  };


  const handleEditEntry = (entry: DailyLaborEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      ...entry,
      rateType: entry.rateType || 'hourly',
      dailyRate: entry.dailyRate || DEFAULT_DAILY_RATE,
      eventId: entry.eventId || '',
      eventName: entry.eventName || ''
    });
    setShowAddModal(true);
  };

  const handleMemberSelect = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      setNewEntry({
        ...newEntry,
        teamMemberId: memberId,
        teamMemberName: member.name,
        hourlyRate: member.hourlyRate || DEFAULT_HOURLY_RATE,
        dailyRate: member.dailyRate || DEFAULT_DAILY_RATE
      });
    } else {
      setNewEntry({
        ...newEntry,
        teamMemberId: memberId,
        teamMemberName: ''
      });
    }
  };

  const handleEventSelect = (eventId: string) => {
    const event = raceEvents.find(e => e.id === eventId);
    if (event) {
      setNewEntry({
        ...newEntry,
        eventId: eventId,
        eventName: event.title
      });
    } else {
      setNewEntry({
        ...newEntry,
        eventId: '',
        eventName: ''
      });
    }
  };

  const handleRateTypeChange = (rateType: 'hourly' | 'daily') => {
    setNewEntry({
      ...newEntry,
      rateType,
      hours: rateType === 'daily' ? 8 : newEntry.hours // Default to 8 hours for daily
    });
  };

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Team Member', 'Category', 'Event', 'Rate Type', 'Hours', 'Hourly Rate', 'Daily Rate', 'Total Cost', 'Description', 'Notes'];
    const rows = filteredEntries.map(e => [
      e.date, e.teamMemberName, e.category, e.eventName || 'Unassigned', e.rateType || 'hourly', e.hours, e.hourlyRate, e.dailyRate || '', e.totalCost, e.description, e.notes
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labor_tracking_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Shop Work': return 'bg-blue-500/20 text-blue-400';
      case 'Race Day': return 'bg-green-500/20 text-green-400';
      case 'Travel': return 'bg-purple-500/20 text-purple-400';
      case 'Maintenance': return 'bg-orange-500/20 text-orange-400';
      case 'Fabrication': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getEventTypeColor = (eventType?: string) => {
    switch (eventType) {
      case 'Race': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Test Session': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Practice': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Meeting': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Maintenance': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Sort events by cost (highest first)
  const sortedEventStats = useMemo(() => {
    return Object.values(stats.byEvent).sort((a, b) => b.cost - a.cost);
  }, [stats.byEvent]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Daily Labor Tracking
          </h3>
          <p className="text-slate-400 text-sm">Track per-day or per-hour labor costs for team members</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => {
              setEditingEntry(null);
              setNewEntry({
                date: new Date().toISOString().split('T')[0],
                teamMemberId: '',
                teamMemberName: '',
                hours: 0,
                hourlyRate: DEFAULT_HOURLY_RATE,
                dailyRate: DEFAULT_DAILY_RATE,
                rateType: 'hourly',
                totalCost: 0,
                description: '',
                category: 'Shop Work',
                notes: '',
                eventId: '',
                eventName: ''
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Labor Cost</p>
              <p className="text-xl font-bold text-purple-400">${stats.totalCost.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Hours</p>
              <p className="text-xl font-bold text-white">{stats.totalHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
              <Sun className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Days</p>
              <p className="text-xl font-bold text-white">{stats.totalDays}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Entries</p>
              <p className="text-xl font-bold text-white">{filteredEntries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('entries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'entries' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            All Entries
          </button>
          <button
            onClick={() => setViewMode('byEvent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'byEvent' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            By Event
          </button>
        </div>
      </div>

      {viewMode === 'entries' ? (
        <>
          {/* Summary by Team Member */}
          {Object.keys(stats.byMember).length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Labor by Team Member
                </h4>
                <div className="space-y-3">
                  {Object.entries(stats.byMember)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([name, data]) => (
                      <div key={name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{name}</p>
                          <p className="text-slate-400 text-sm">
                            {data.hours > 0 && `${data.hours.toFixed(1)} hrs`}
                            {data.hours > 0 && data.days > 0 && ' • '}
                            {data.days > 0 && `${data.days} days`}
                            {' • '}{data.entries} entries
                          </p>
                        </div>
                        <p className="text-purple-400 font-bold">${data.cost.toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-400" />
                  Labor by Category
                </h4>
                <div className="space-y-3">
                  {Object.entries(stats.byCategory)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([category, data]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(category)}`}>
                            {category}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {data.hours > 0 && `${data.hours.toFixed(1)} hrs`}
                            {data.hours > 0 && data.days > 0 && ' • '}
                            {data.days > 0 && `${data.days} days`}
                          </span>
                        </div>
                        <p className="text-white font-bold">${data.cost.toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white"
                />
              </div>
            </div>
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Members</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Categories</option>
              <option value="Shop Work">Shop Work</option>
              <option value="Race Day">Race Day</option>
              <option value="Travel">Travel</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Fabrication">Fabrication</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Events</option>
              <option value="unassigned">Unassigned</option>
              {raceEvents.map(event => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>

          {/* Entries Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-sm">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Team Member</th>
                    <th className="text-left px-4 py-3">Event</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-center px-4 py-3">Rate Type</th>
                    <th className="text-center px-4 py-3">Hours/Days</th>
                    <th className="text-center px-4 py-3">Rate</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                      <td className="px-4 py-3 text-white">{entry.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-400" />
                          </div>
                          <span className="text-white">{entry.teamMemberName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.eventName ? (
                          <div className="flex items-center gap-2">
                            <Flag className="w-3 h-3 text-orange-400" />
                            <span className="text-orange-400 text-sm">{entry.eventName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(entry.category)}`}>
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{entry.description}</p>
                        {entry.notes && <p className="text-slate-500 text-xs">{entry.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${entry.rateType === 'daily' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {entry.rateType === 'daily' ? 'Daily' : 'Hourly'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-white font-mono">
                        {entry.rateType === 'daily' ? '1 day' : `${entry.hours.toFixed(1)} hrs`}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">
                        {entry.rateType === 'daily' 
                          ? `$${entry.dailyRate || DEFAULT_DAILY_RATE}/day`
                          : `$${entry.hourlyRate}/hr`
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-purple-400 font-bold">${entry.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No labor entries found</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-purple-400 hover:text-purple-300"
                >
                  Add your first entry
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* By Event View */
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              Labor Costs by Race Event
            </h4>
            <p className="text-slate-400 text-sm mb-6">
              View total labor costs associated with each race event. Click on an event to see detailed entries.
            </p>
            
            {sortedEventStats.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No labor entries found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEventStats.map((eventData) => {
                  const event = raceEvents.find(e => e.id === eventData.eventId);
                  const isExpanded = expandedEvents.has(eventData.eventId);
                  
                  return (
                    <div key={eventData.eventId} className="bg-slate-900/50 rounded-lg overflow-hidden">
                      {/* Event Header */}
                      <button
                        onClick={() => toggleEventExpanded(eventData.eventId)}
                        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            eventData.eventId === 'unassigned' 
                              ? 'bg-slate-700' 
                              : 'bg-orange-500/20'
                          }`}>
                            <Flag className={`w-5 h-5 ${
                              eventData.eventId === 'unassigned' 
                                ? 'text-slate-400' 
                                : 'text-orange-400'
                            }`} />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-medium">{eventData.eventName}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                              {event && (
                                <>
                                  {event.trackName && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {event.trackName}
                                    </span>
                                  )}
                                  {event.startDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {event.startDate}
                                    </span>
                                  )}
                                </>
                              )}
                              <span>
                                {eventData.hours > 0 && `${eventData.hours.toFixed(1)} hrs`}
                                {eventData.hours > 0 && eventData.days > 0 && ' • '}
                                {eventData.days > 0 && `${eventData.days} days`}
                                {' • '}{eventData.entries.length} entries
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-2xl font-bold text-purple-400">${eventData.cost.toLocaleString()}</p>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </button>
                      
                      {/* Expanded Entries */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-slate-400 text-xs">
                                  <th className="text-left pb-2">Date</th>
                                  <th className="text-left pb-2">Team Member</th>
                                  <th className="text-left pb-2">Category</th>
                                  <th className="text-left pb-2">Description</th>
                                  <th className="text-center pb-2">Type</th>
                                  <th className="text-center pb-2">Time</th>
                                  <th className="text-right pb-2">Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {eventData.entries
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map(entry => (
                                    <tr key={entry.id} className="border-t border-slate-700/30">
                                      <td className="py-2 text-white">{entry.date}</td>
                                      <td className="py-2 text-white">{entry.teamMemberName}</td>
                                      <td className="py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(entry.category)}`}>
                                          {entry.category}
                                        </span>
                                      </td>
                                      <td className="py-2 text-slate-300">{entry.description}</td>
                                      <td className="py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs ${entry.rateType === 'daily' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                          {entry.rateType === 'daily' ? 'Daily' : 'Hourly'}
                                        </span>
                                      </td>
                                      <td className="py-2 text-center text-slate-400">
                                        {entry.rateType === 'daily' ? '1 day' : `${entry.hours}h`}
                                      </td>
                                      <td className="py-2 text-right text-purple-400 font-medium">${entry.totalCost.toLocaleString()}</td>
                                    </tr>
                                  ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-slate-600">
                                  <td colSpan={6} className="py-2 text-right text-slate-400 font-medium">Total:</td>
                                  <td className="py-2 text-right text-purple-400 font-bold">${eventData.cost.toLocaleString()}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Event Cost Summary Chart */}
          {sortedEventStats.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Cost Distribution
              </h4>
              <div className="space-y-3">
                {sortedEventStats.slice(0, 10).map((eventData) => {
                  const percentage = (eventData.cost / stats.totalCost) * 100;
                  return (
                    <div key={eventData.eventId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300 truncate max-w-[200px]">{eventData.eventName}</span>
                        <span className="text-sm text-slate-400">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            eventData.eventId === 'unassigned' 
                              ? 'bg-slate-500' 
                              : 'bg-gradient-to-r from-purple-500 to-orange-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingEntry ? 'Edit Labor Entry' : 'Add Labor Entry'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingEntry(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date *</label>
                  <DateInputDark
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    required
                  />

                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Team Member *</label>
                  <select
                    value={newEntry.teamMemberId}
                    onChange={(e) => handleMemberSelect(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select member...</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {(member.hourlyRate || member.dailyRate) && ` ($${member.hourlyRate || '-'}/hr, $${member.dailyRate || '-'}/day)`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Race Event Selector */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  <span className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-orange-400" />
                    Associate with Race Event (Optional)
                  </span>
                </label>
                <select
                  value={newEntry.eventId || ''}
                  onChange={(e) => handleEventSelect(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">No event (General labor)</option>
                  {raceEvents
                    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                    .map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title} - {event.startDate} {event.trackName && `(${event.trackName})`}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Link this labor entry to a specific race event for cost tracking
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Category *</label>
                <select
                  value={newEntry.category}
                  onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value as LaborCategory })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="Shop Work">Shop Work</option>
                  <option value="Race Day">Race Day</option>
                  <option value="Travel">Travel</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Fabrication">Fabrication</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Rate Type Selector */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Rate Type *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRateTypeChange('hourly')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      newEntry.rateType === 'hourly' 
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-medium">Per Hour</p>
                      <p className="text-xs opacity-70">Track hours worked</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRateTypeChange('daily')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      newEntry.rateType === 'daily' 
                        ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-medium">Per Day</p>
                      <p className="text-xs opacity-70">Flat daily rate</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Conditional fields based on rate type */}
              {newEntry.rateType === 'hourly' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hours *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={newEntry.hours}
                      onChange={(e) => setNewEntry({ ...newEntry, hours: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={newEntry.hourlyRate}
                      onChange={(e) => setNewEntry({ ...newEntry, hourlyRate: parseFloat(e.target.value) || DEFAULT_HOURLY_RATE })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Daily Rate ($)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={newEntry.dailyRate}
                    onChange={(e) => setNewEntry({ ...newEntry, dailyRate: parseFloat(e.target.value) || DEFAULT_DAILY_RATE })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Daily rate is a flat fee for the entire day
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description *</label>
                <input
                  type="text"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="What work was performed?"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {/* Cost Preview */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Cost:</span>
                  <span className="text-2xl font-bold text-purple-400">
                    ${calculateTotalCost(
                      newEntry.rateType || 'hourly',
                      newEntry.hours || 0,
                      newEntry.hourlyRate || DEFAULT_HOURLY_RATE,
                      newEntry.dailyRate || DEFAULT_DAILY_RATE
                    ).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-1">
                  {newEntry.rateType === 'daily' 
                    ? `1 day × $${newEntry.dailyRate || DEFAULT_DAILY_RATE}/day`
                    : `${newEntry.hours || 0} hours × $${newEntry.hourlyRate || DEFAULT_HOURLY_RATE}/hr`
                  }
                </p>
                {newEntry.eventName && (
                  <p className="text-orange-400 text-sm mt-2 flex items-center gap-1">
                    <Flag className="w-3 h-3" />
                    Linked to: {newEntry.eventName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={!newEntry.teamMemberId || !newEntry.description || (newEntry.rateType === 'hourly' && !newEntry.hours)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingEntry ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborTracking;
