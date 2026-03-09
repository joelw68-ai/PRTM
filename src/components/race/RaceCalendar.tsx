import React, { useState, useMemo, useRef } from 'react';
import DateInputDark from '@/components/ui/DateInputDark';
import { getStateSelectOptions, parseCityState } from '@/data/usStates';
import { useApp } from '@/contexts/AppContext';
import RaceDayWeatherCard from '@/components/race/RaceDayWeatherCard';
import { SavedTrack } from '@/lib/database';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';

import { CrewRole } from '@/lib/permissions';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trophy,
  DollarSign,
  Flag,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  Timer,
  Target,
  CalendarDays,
  Loader2,
  AlertCircle,
  Link2,
  Download
} from 'lucide-react';



export interface RaceEvent {
  id: string;
  title: string;
  eventType: 'Race' | 'Test Session' | 'Practice' | 'Meeting' | 'Maintenance';
  trackName: string;
  trackLocation: string;
  trackAddress?: string;
  trackZip?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  sanctioningBody?: string;
  entryFee?: number;
  purse?: number;
  notes?: string;
  result?: string;
  bestET?: number;
  bestMPH?: number;
  roundsWon?: number;
}



interface RaceCalendarProps {
  currentRole?: CrewRole;
}

const RaceCalendar: React.FC<RaceCalendarProps> = ({ currentRole = 'Crew' }) => {

  const { raceEvents, addRaceEvent, updateRaceEvent, deleteRaceEvent, savedTracks, addSavedTrack, updateSavedTrack } = useApp();



  const trackSelectRef = useRef<HTMLSelectElement>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RaceEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RaceEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newEvent, setNewEvent] = useState<Partial<RaceEvent>>({
    title: '',
    eventType: 'Race',
    trackName: '',
    trackLocation: '',
    startDate: getLocalDateString(),

    status: 'Scheduled',
    sanctioningBody: 'NHRA'
  });


  // Sort saved tracks: favorites first, then by visit count
  const sortedTracks = useMemo(() => {
    return [...savedTracks].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.visitCount - a.visitCount;
    });
  }, [savedTracks]);

  // Handle saved track selection in the event form — also fills trackAddress and trackZip

  const handleSavedTrackSelect = (trackId: string) => {
    if (!trackId) return;
    const track = savedTracks.find(t => t.id === trackId);
    if (track) {
      setNewEvent(prev => ({
        ...prev,
        trackName: track.name,
        trackLocation: track.location,
        trackAddress: track.address || '',
        trackZip: track.zip || ''
      }));
    }
    // Reset the select back to placeholder
    if (trackSelectRef.current) {
      trackSelectRef.current.value = '';
    }
  };

  // Helper: try to extract a US ZIP code (5-digit or 5+4) from an address string
  const parseZipFromAddress = (address: string): string => {
    if (!address) return '';
    // Match 5-digit ZIP optionally followed by -4 digits, typically at end of address
    const match = address.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    if (match) return match[1];
    // Also try to find it anywhere in the string
    const anyMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
    return anyMatch ? anyMatch[1] : '';
  };

  // Auto-save a new track to saved_tracks if it doesn't already exist
  // Now includes trackAddress, trackZip, and parses city/state from trackLocation
  const autoSaveTrackIfNew = async (trackName: string, trackLocation: string, trackAddress?: string, trackZip?: string) => {
    if (!trackName.trim() || !trackLocation.trim()) return;

    // Resolve ZIP: use explicit value, or try to parse from address
    const resolvedZip = trackZip?.trim() || parseZipFromAddress(trackAddress || '');

    // Check if this track already exists (case-insensitive match on name + location)
    const exists = savedTracks.some(
      t => t.name.toLowerCase() === trackName.trim().toLowerCase() &&
           t.location.toLowerCase() === trackLocation.trim().toLowerCase()
    );

    if (exists) {
      // Track already exists — but update its address/zip if we have data and it's missing
      const existingTrack = savedTracks.find(
        t => t.name.toLowerCase() === trackName.trim().toLowerCase() &&
             t.location.toLowerCase() === trackLocation.trim().toLowerCase()
      );
      if (existingTrack) {
        const needsAddressUpdate = trackAddress?.trim() && !existingTrack.address?.trim();
        const needsZipUpdate = resolvedZip && !existingTrack.zip?.trim();
        if (needsAddressUpdate || needsZipUpdate) {
          const parsed = parseCityState(trackLocation);
          try {
            await addSavedTrack({
              ...existingTrack,
              address: trackAddress?.trim() || existingTrack.address || '',
              zip: resolvedZip || existingTrack.zip || '',
              city: parsed.city || existingTrack.city || '',
              state: parsed.state || existingTrack.state || '',
            });
          } catch (err) {
            console.warn('Auto-update track address/zip failed (non-blocking):', err);
          }
        }
      }
      return;
    }

    // Also check by name alone (different location variant of same track)
    const nameMatch = savedTracks.find(
      t => t.name.toLowerCase() === trackName.trim().toLowerCase()
    );
    if (nameMatch) return; // Track name already exists with a different location — don't duplicate

    // Parse city/state from the "City, ST" location string
    const parsed = parseCityState(trackLocation);

    try {
      const newTrack: SavedTrack = {
        id: crypto.randomUUID(),
        name: trackName.trim(),
        location: trackLocation.trim(),
        address: trackAddress?.trim() || '',
        city: parsed.city || '',
        state: parsed.state || '',
        zip: resolvedZip,
        elevation: 0,
        trackLength: '1/8 mile',
        surfaceType: 'Concrete',
        notes: '',
        isFavorite: false,
        visitCount: 1,
        lastVisited: getLocalDateString()


      };

      await addSavedTrack(newTrack);
      toast.success(`Track "${trackName}" auto-saved to Initial Setup`, {
        description: `${trackLocation}${trackAddress ? ' — address included' : ''}${resolvedZip ? ` (ZIP: ${resolvedZip})` : ''}. Now available in Pass Log, Setup, and Calendar.`,
        duration: 4000,
      });
    } catch (err) {
      console.warn('Auto-save track failed (non-blocking):', err);
    }
  };




  // Auto-hide save message after 4 seconds
  React.useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get events for a specific date
  const getEventsForDate = (date: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return raceEvents.filter(event => {
      const eventStart = event.startDate;
      const eventEnd = event.endDate || event.startDate;
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    const today = getLocalDateString();

    return raceEvents
      .filter(e => e.startDate >= today && e.status !== 'Cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
  }, [raceEvents]);

  // Past events with results
  const pastEvents = useMemo(() => {
    const today = getLocalDateString();

    return raceEvents
      .filter(e => e.startDate < today || e.status === 'Completed')
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 10);
  }, [raceEvents]);


  // Season stats
  const seasonStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearEvents = raceEvents.filter(e => e.startDate.startsWith(String(currentYear)));
    const completed = yearEvents.filter(e => e.status === 'Completed');
    const wins = completed.filter(e => e.result === 'Win').length;
    const runnerUps = completed.filter(e => e.result === 'Runner-up').length;
    const totalRoundsWon = completed.reduce((sum, e) => sum + (e.roundsWon || 0), 0);
    const bestET = Math.min(...completed.filter(e => e.bestET).map(e => e.bestET!));
    const bestMPH = Math.max(...completed.filter(e => e.bestMPH).map(e => e.bestMPH!));

    return {
      totalEvents: yearEvents.length,
      completed: completed.length,
      wins,
      runnerUps,
      totalRoundsWon,
      bestET: isFinite(bestET) ? bestET : null,
      bestMPH: isFinite(bestMPH) ? bestMPH : null
    };
  }, [raceEvents]);

  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.startDate) {
      setSaveMessage({ type: 'error', text: 'Please fill in the Event Title and Start Date.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const event: RaceEvent = {
      id: editingEvent?.id || `EVT-${Date.now()}`,
      title: newEvent.title || '',
      eventType: newEvent.eventType as RaceEvent['eventType'] || 'Race',
      trackName: newEvent.trackName || '',
      trackLocation: newEvent.trackLocation || '',
      trackAddress: newEvent.trackAddress || undefined,
      trackZip: newEvent.trackZip || parseZipFromAddress(newEvent.trackAddress || '') || undefined,
      startDate: newEvent.startDate || '',
      endDate: newEvent.endDate || undefined,
      startTime: newEvent.startTime || undefined,
      endTime: newEvent.endTime || undefined,
      status: newEvent.status as RaceEvent['status'] || 'Scheduled',
      sanctioningBody: newEvent.sanctioningBody || undefined,
      entryFee: newEvent.entryFee || undefined,
      purse: newEvent.purse || undefined,
      notes: newEvent.notes || undefined,
      result: newEvent.result || undefined,
      bestET: newEvent.bestET || undefined,
      bestMPH: newEvent.bestMPH || undefined,
      roundsWon: newEvent.roundsWon || undefined
    };


    try {
      if (editingEvent) {
        await updateRaceEvent(event.id, event);
      } else {
        await addRaceEvent(event);
      }

      // Auto-save the track to saved_tracks if it's a new track (non-blocking)
      // Passes trackZip so it syncs to Initial Setup
      if (event.trackName && event.trackLocation) {
        autoSaveTrackIfNew(event.trackName, event.trackLocation, event.trackAddress, event.trackZip).catch(() => {});
      }



      setSaveMessage({ type: 'success', text: editingEvent ? 'Event updated!' : 'Event saved!' });
      setShowAddModal(false);
      setEditingEvent(null);
      setNewEvent({
        title: '',
        eventType: 'Race',
        trackName: '',
        trackLocation: '',
        startDate: getLocalDateString(),


        status: 'Scheduled',
        sanctioningBody: 'NHRA'
      });

    } catch (error) {
      console.error('Save failed:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };


  const handleEditEvent = (event: RaceEvent) => {
    setEditingEvent(event);
    setNewEvent(event);
    setShowAddModal(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      await deleteRaceEvent(id);
      setSelectedEvent(null);
    }
  };

  // ── Export CSV ──
  const handleExportCSV = () => {
    if (raceEvents.length === 0) {
      toast.error('No events to export', {
        description: 'Add some events to your calendar first.',
        duration: 3000,
      });
      return;
    }

    // CSV column headers
    const headers = [
      'Title',
      'Event Type',
      'Track Name',
      'Location',
      'Address',
      'ZIP Code',
      'Start Date',
      'End Date',
      'Start Time',
      'End Time',
      'Sanctioning Body',
      'Entry Fee',
      'Purse',
      'Status',
      'Result',
      'Best ET',
      'Best MPH',
      'Rounds Won',
      'Notes'
    ];

    // Helper to escape CSV values (wrap in quotes if contains comma, quote, or newline)
    const escapeCSV = (value: string): string => {
      if (!value) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build rows sorted by start date
    const sortedEvents = [...raceEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));

    const rows = sortedEvents.map(event => [
      escapeCSV(event.title),
      escapeCSV(event.eventType),
      escapeCSV(event.trackName),
      escapeCSV(event.trackLocation),
      escapeCSV(event.trackAddress || ''),
      escapeCSV(event.trackZip || ''),
      escapeCSV(event.startDate),
      escapeCSV(event.endDate || ''),
      escapeCSV(event.startTime || ''),
      escapeCSV(event.endTime || ''),
      escapeCSV(event.sanctioningBody || ''),
      event.entryFee != null ? String(event.entryFee) : '',
      event.purse != null ? String(event.purse) : '',
      escapeCSV(event.status),
      escapeCSV(event.result || ''),
      event.bestET != null ? String(event.bestET) : '',
      event.bestMPH != null ? String(event.bestMPH) : '',
      event.roundsWon != null ? String(event.roundsWon) : '',
      escapeCSV(event.notes || '')
    ]);

    // Assemble CSV content with BOM for Excel compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = getLocalDateString();


    link.href = url;
    link.download = `race-calendar-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${sortedEvents.length} event${sortedEvents.length !== 1 ? 's' : ''} to CSV`, {
      description: `File: race-calendar-${today}.csv`,
      duration: 4000,
    });
  };


  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'Race': return 'bg-orange-500';
      case 'Test Session': return 'bg-blue-500';
      case 'Practice': return 'bg-green-500';
      case 'Meeting': return 'bg-purple-500';
      case 'Maintenance': return 'bg-yellow-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'In Progress': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Completed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'Cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    // Empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-900/30" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const events = getEventsForDate(day);
      const isToday = isCurrentMonth && today.getDate() === day;

      days.push(
        <div
          key={day}
          className={`h-24 p-1 border border-slate-700/30 ${isToday ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-800/30'} hover:bg-slate-700/30 transition-colors cursor-pointer`}
          onClick={() => {
            if (events.length > 0) {
              setSelectedEvent(events[0]);
            }
          }}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-orange-400' : 'text-slate-400'}`}>
            {day}
          </div>
          <div className="space-y-1 overflow-hidden">
            {events.slice(0, 2).map(event => (
              <div
                key={event.id}
                className={`text-xs px-1 py-0.5 rounded truncate ${getEventTypeColor(event.eventType)} text-white`}
              >
                {event.title}
              </div>
            ))}
            {events.length > 2 && (
              <div className="text-xs text-slate-400">+{events.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Save Success/Error Banner */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
            saveMessage.type === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {saveMessage.type === 'success' 
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> 
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {saveMessage.text}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-orange-400" />
              Race Calendar
            </h2>
            <p className="text-slate-400">Schedule and track your race events</p>
          </div>


          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                List
              </button>
            </div>
            <button
              onClick={handleExportCSV}
              title="Export events to CSV"
              className="flex items-center justify-center p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 hover:text-white transition-colors border border-slate-600"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>


        {/* Season Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Events</p>
            <p className="text-2xl font-bold text-white">{seasonStats.totalEvents}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-white">{seasonStats.completed}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
            <p className="text-yellow-400 text-sm">Wins</p>
            <p className="text-2xl font-bold text-yellow-400">{seasonStats.wins}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Runner-ups</p>
            <p className="text-2xl font-bold text-white">{seasonStats.runnerUps}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Rounds Won</p>
            <p className="text-2xl font-bold text-white">{seasonStats.totalRoundsWon}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <p className="text-green-400 text-sm">Best ET</p>
            <p className="text-2xl font-bold text-green-400 font-mono">
              {seasonStats.bestET?.toFixed(3) || '-'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
            <p className="text-blue-400 text-sm">Best MPH</p>
            <p className="text-2xl font-bold text-blue-400 font-mono">
              {seasonStats.bestMPH?.toFixed(1) || '-'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Calendar/List View */}
          <div className="lg:col-span-3">
            {viewMode === 'calendar' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                {/* Calendar Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                  <button
                    onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <h3 className="text-lg font-semibold text-white">
                    {monthNames[month]} {year}
                  </h3>
                  <button
                    onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-700/50">
                  {dayNames.map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-slate-400 bg-slate-900/50">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7">
                  {renderCalendarDays()}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50">
                  <h3 className="text-lg font-semibold text-white">All Events</h3>
                </div>
                <div className="divide-y divide-slate-700/30">
                  {raceEvents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No events scheduled</p>
                      <p className="text-sm mt-1">Click "Add Event" to create your first event</p>
                    </div>
                  ) : (
                    [...raceEvents]
                      .sort((a, b) => a.startDate.localeCompare(b.startDate))
                      .map(event => (
                      <div
                        key={event.id}
                        className="p-4 hover:bg-slate-700/20 transition-colors cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-3 h-3 rounded-full mt-1.5 ${getEventTypeColor(event.eventType)}`} />
                            <div>
                              <h4 className="text-white font-medium">{event.title}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.trackName || 'TBD'}
                                </span>
                                <span>{event.startDate}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(event.status)}`}>
                            {event.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Event Details */}
            {selectedEvent && (
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">{selectedEvent.title}</h3>
                  <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4 text-orange-400" />
                    {selectedEvent.trackName}, {selectedEvent.trackLocation}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    {selectedEvent.startDate}
                    {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && ` - ${selectedEvent.endDate}`}
                  </div>
                  {selectedEvent.sanctioningBody && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Flag className="w-4 h-4 text-orange-400" />
                      {selectedEvent.sanctioningBody}
                    </div>
                  )}
                  {selectedEvent.entryFee && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <DollarSign className="w-4 h-4 text-orange-400" />
                      Entry: ${selectedEvent.entryFee.toLocaleString()}
                    </div>
                  )}
                  {selectedEvent.result && (
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <Trophy className="w-4 h-4" />
                      {selectedEvent.result}
                    </div>
                  )}
                  {selectedEvent.bestET && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Timer className="w-4 h-4 text-green-400" />
                      Best ET: {selectedEvent.bestET.toFixed(3)}
                    </div>
                  )}
                  {selectedEvent.notes && (
                    <p className="text-slate-400 mt-2 pt-2 border-t border-slate-700">
                      {selectedEvent.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEditEvent(selectedEvent)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Race Day Weather Card - shown when event is selected */}
            {selectedEvent && (selectedEvent.trackLocation || selectedEvent.trackName) && (
              <RaceDayWeatherCard
                trackLocation={selectedEvent.trackLocation}
                trackName={selectedEvent.trackName}
                eventDate={selectedEvent.startDate}
                eventTitle={selectedEvent.title}
              />
            )}


            {/* Upcoming Events */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                Upcoming Events
              </h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-slate-400 text-sm">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      className="p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.eventType)}`} />
                        <span className="text-white font-medium text-sm">{event.title}</span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1">{event.startDate}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Results */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Recent Results
              </h3>
              {pastEvents.filter(e => e.status === 'Completed').length === 0 ? (
                <p className="text-slate-400 text-sm">No completed events</p>
              ) : (
                <div className="space-y-3">
                  {pastEvents.filter(e => e.status === 'Completed').slice(0, 5).map(event => (
                    <div
                      key={event.id}
                      className="p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">{event.title}</span>
                        {event.result && (
                          <span className={`text-xs px-2 py-0.5 rounded ${event.result === 'Win' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {event.result}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-1">{event.startDate}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Event Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    {editingEvent ? 'Edit Event' : 'Add New Event'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingEvent(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Event Title *</label>
                    <input
                      type="text"
                      value={newEvent.title || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., NHRA Nationals"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Event Type</label>
                    <select
                      value={newEvent.eventType || 'Race'}
                      onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value as RaceEvent['eventType'] })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Race">Race</option>
                      <option value="Test Session">Test Session</option>
                      <option value="Practice">Practice</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Sanctioning Body</label>
                    <select
                      value={newEvent.sanctioningBody || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, sanctioningBody: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select...</option>
                      <option value="NHRA">NHRA</option>
                      <option value="PDRA">PDRA</option>
                      <option value="IHRA">IHRA</option>
                      <option value="DI Winter Series">DI Winter Series</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>



                  {/* ── Saved Tracks Dropdown ── */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-2 pt-2 border-t border-slate-700/50">
                      <Link2 className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-400">Track Location</span>
                      {savedTracks.length > 0 && (
                        <span className="text-xs text-slate-500">({savedTracks.length} saved track{savedTracks.length !== 1 ? 's' : ''})</span>
                      )}
                    </div>
                    <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Select Saved Track
                    </label>
                    <select
                      ref={trackSelectRef}
                      defaultValue=""
                      onChange={(e) => handleSavedTrackSelect(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">-- Choose a saved track to auto-fill --</option>
                      {sortedTracks.length > 0 ? (
                        sortedTracks.map(track => (
                          <option key={track.id} value={track.id}>
                            {track.isFavorite ? '\u2605 ' : ''}{track.name} — {track.location}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No saved tracks yet — enter one below</option>
                      )}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Select a saved track to auto-fill name, city, and state. Or type a new track below — it will be saved automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Track Name</label>
                    <input
                      type="text"
                      value={newEvent.trackName || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, trackName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., Gainesville Raceway"
                    />
                  </div>


                  <div>
                    <label className="block text-sm text-slate-400 mb-1">City</label>
                    <input
                      type="text"
                      value={parseCityState(newEvent.trackLocation || '').city}
                      onChange={(e) => {
                        const parsed = parseCityState(newEvent.trackLocation || '');
                        const composed = e.target.value && parsed.state ? `${e.target.value}, ${parsed.state}` : e.target.value || '';
                        setNewEvent({ ...newEvent, trackLocation: composed });
                      }}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., Gainesville"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">State</label>
                    <select
                      value={parseCityState(newEvent.trackLocation || '').state}
                      onChange={(e) => {
                        const parsed = parseCityState(newEvent.trackLocation || '');
                        const composed = parsed.city && e.target.value ? `${parsed.city}, ${e.target.value}` : parsed.city || '';
                        setNewEvent({ ...newEvent, trackLocation: composed });
                      }}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      {getStateSelectOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Track Address + ZIP Code */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Track Address</label>
                    <input
                      type="text"
                      value={newEvent.trackAddress || ''}
                      onChange={(e) => {
                        const addr = e.target.value;
                        setNewEvent(prev => ({
                          ...prev,
                          trackAddress: addr,
                          // Auto-parse ZIP from address if ZIP field is empty
                          trackZip: prev.trackZip || parseZipFromAddress(addr)
                        }));
                      }}
                      onBlur={() => {
                        // On blur, try to auto-fill ZIP if still empty
                        if (!newEvent.trackZip && newEvent.trackAddress) {
                          const parsed = parseZipFromAddress(newEvent.trackAddress);
                          if (parsed) {
                            setNewEvent(prev => ({ ...prev, trackZip: parsed }));
                          }
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 11211 N County Road 225"
                    />
                    <p className="text-xs text-slate-500 mt-1">Street address — syncs to Initial Setup racetracks</p>
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={newEvent.trackZip || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, trackZip: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 32609"
                      maxLength={10}
                    />
                    <p className="text-xs text-slate-500 mt-1">Auto-parsed from address or enter manually</p>
                  </div>



                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Start Date *</label>
                    <DateInputDark
                      value={newEvent.startDate || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">End Date</label>
                    <DateInputDark
                      value={newEvent.endDate || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>



                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Status</label>
                    <select
                      value={newEvent.status || 'Scheduled'}
                      onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value as RaceEvent['status'] })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Entry Fee ($)</label>
                    <input
                      type="number"
                      value={newEvent.entryFee || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, entryFee: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  {newEvent.status === 'Completed' && (
                    <>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Result</label>
                        <select
                          value={newEvent.result || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, result: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="">Select...</option>
                          <option value="Win">Win</option>
                          <option value="Runner-up">Runner-up</option>
                          <option value="Semi-finalist">Semi-finalist</option>
                          <option value="Quarter-finalist">Quarter-finalist</option>
                          <option value="First Round">First Round</option>
                          <option value="DNQ">Did Not Qualify</option>
                          <option value="DNS">Did Not Start</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Rounds Won</label>
                        <input
                          type="number"
                          value={newEvent.roundsWon || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, roundsWon: parseInt(e.target.value) || undefined })}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Best ET</label>
                        <input
                          type="number"
                          step="0.001"
                          value={newEvent.bestET || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, bestET: parseFloat(e.target.value) || undefined })}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Best MPH</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newEvent.bestMPH || ''}
                          onChange={(e) => setNewEvent({ ...newEvent, bestMPH: parseFloat(e.target.value) || undefined })}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Notes</label>
                    <textarea
                      value={newEvent.notes || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white h-24"
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Error message inside modal */}
              {saveMessage && saveMessage.type === 'error' && showAddModal && (
                <div className="px-6 pb-2">
                  <div className="p-3 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {saveMessage.text}
                  </div>
                </div>
              )}

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingEvent(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={isSaving}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving...' : (editingEvent ? 'Update Event' : 'Add Event')}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default RaceCalendar;
