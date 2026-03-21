import React, { useState, useMemo } from 'react';
import { PassLogEntry } from '@/data/proModData';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Gauge,
  MapPin,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  BarChart3,
  X
} from 'lucide-react';

interface PassLogTimelineProps {
  passLogs: PassLogEntry[];
}

// Session type color map
const SESSION_COLORS: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  'Test': { bg: 'bg-blue-500/20', dot: 'bg-blue-500', text: 'text-blue-400', label: 'Test' },
  'Qualifying': { bg: 'bg-yellow-500/20', dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'Qualifying' },
  'Eliminations': { bg: 'bg-red-500/20', dot: 'bg-red-500', text: 'text-red-400', label: 'Eliminations' },
  'Match Race': { bg: 'bg-purple-500/20', dot: 'bg-purple-500', text: 'text-purple-400', label: 'Match Race' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PassLogTimeline: React.FC<PassLogTimelineProps> = ({ passLogs }) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null);

  // Group passes by date (YYYY-MM-DD)
  const passesByDate = useMemo(() => {
    const map: Record<string, PassLogEntry[]> = {};
    for (const pass of passLogs) {
      if (!map[pass.date]) map[pass.date] = [];
      map[pass.date].push(pass);
    }
    return map;
  }, [passLogs]);

  // Monthly summary data
  const monthlySummaries = useMemo(() => {
    const summaries: Record<string, { totalPasses: number; bestET: number; avgMPH: number; tracks: Set<string>; sessions: Record<string, number> }> = {};
    
    for (const pass of passLogs) {
      const monthKey = pass.date.substring(0, 7); // YYYY-MM
      if (!summaries[monthKey]) {
        summaries[monthKey] = { totalPasses: 0, bestET: Infinity, avgMPH: 0, tracks: new Set(), sessions: {} };
      }
      const s = summaries[monthKey];
      s.totalPasses++;
      if (pass.eighth > 0 && pass.eighth < s.bestET) s.bestET = pass.eighth;
      s.avgMPH += pass.mph;
      if (pass.track) s.tracks.add(pass.track);
      s.sessions[pass.sessionType] = (s.sessions[pass.sessionType] || 0) + 1;
    }
    
    // Finalize averages
    for (const key of Object.keys(summaries)) {
      const s = summaries[key];
      s.avgMPH = s.totalPasses > 0 ? s.avgMPH / s.totalPasses : 0;
      if (s.bestET === Infinity) s.bestET = 0;
    }
    
    return summaries;
  }, [passLogs]);

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: Array<{ day: number | null; dateStr: string }> = [];
    
    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, dateStr: '' });
    }
    
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr });
    }
    
    return days;
  }, [currentYear, currentMonth]);

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentSummary = monthlySummaries[currentMonthKey];

  const navigateMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    setExpandedDate(null);
    setExpandedPassId(null);
  };

  // Get sorted month keys for the summary list
  const sortedMonthKeys = useMemo(() => {
    return Object.keys(monthlySummaries).sort().reverse();
  }, [monthlySummaries]);

  return (
    <div className="space-y-6">
      {/* Calendar View */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h3>
            {currentSummary && (
              <p className="text-sm text-slate-400 mt-0.5">
                {currentSummary.totalPasses} pass{currentSummary.totalPasses !== 1 ? 'es' : ''} this month
              </p>
            )}
          </div>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 bg-slate-900/30 border-b border-slate-700/30">
          {Object.entries(SESSION_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className={`text-xs ${colors.text}`}>{colors.label}</span>
            </div>
          ))}
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-slate-900/40">
          {DAY_NAMES.map(day => (
            <div key={day} className="text-center py-2 text-xs font-medium text-slate-500 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            const passes = cell.dateStr ? (passesByDate[cell.dateStr] || []) : [];
            const isToday = cell.dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const isExpanded = expandedDate === cell.dateStr;
            const hasPasses = passes.length > 0;

            return (
              <div
                key={idx}
                className={`min-h-[80px] border-b border-r border-slate-700/20 p-1.5 transition-colors ${
                  cell.day === null ? 'bg-slate-900/20' :
                  isExpanded ? 'bg-slate-700/30' :
                  hasPasses ? 'hover:bg-slate-700/20 cursor-pointer' : ''
                } ${isToday ? 'ring-1 ring-inset ring-orange-500/50' : ''}`}
                onClick={() => {
                  if (hasPasses && cell.dateStr) {
                    setExpandedDate(isExpanded ? null : cell.dateStr);
                    setExpandedPassId(null);
                  }
                }}
              >
                {cell.day !== null && (
                  <>
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-orange-400' : 'text-slate-400'}`}>
                      {cell.day}
                    </div>
                    {/* Session dots */}
                    {hasPasses && (
                      <div className="flex flex-wrap gap-1">
                        {passes.map((pass, pIdx) => {
                          const colors = SESSION_COLORS[pass.sessionType] || SESSION_COLORS['Test'];
                          return (
                            <div
                              key={pIdx}
                              className={`w-3 h-3 rounded-full ${colors.dot} ring-1 ring-white/10 transition-transform hover:scale-125`}
                              title={`${pass.sessionType}: ${pass.eighth.toFixed(3)} ET @ ${pass.mph.toFixed(1)} MPH`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {hasPasses && (
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-500">{passes.length} pass{passes.length !== 1 ? 'es' : ''}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded Date Detail */}
        {expandedDate && passesByDate[expandedDate] && (
          <div className="border-t border-slate-700/50 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                {expandedDate} — {passesByDate[expandedDate].length} pass{passesByDate[expandedDate].length !== 1 ? 'es' : ''}
              </h4>
              <button
                onClick={() => { setExpandedDate(null); setExpandedPassId(null); }}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {passesByDate[expandedDate].map(pass => {
                const colors = SESSION_COLORS[pass.sessionType] || SESSION_COLORS['Test'];
                const isPassExpanded = expandedPassId === pass.id;
                return (
                  <div key={pass.id} className="bg-slate-800/70 rounded-lg border border-slate-700/40 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPassId(isPassExpanded ? null : pass.id);
                      }}
                    >
                      <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {pass.sessionType}
                      </span>
                      <span className="text-white text-sm font-medium">{pass.track}</span>
                      <span className="text-slate-400 text-xs">{pass.time}</span>
                      <div className="flex-1" />
                      <span className="text-green-400 font-mono font-bold text-sm">{pass.eighth.toFixed(3)}</span>
                      <span className="text-blue-400 font-mono font-bold text-sm">{pass.mph.toFixed(1)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pass.result === 'Win' ? 'bg-green-500/20 text-green-400' :
                        pass.result === 'Loss' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {pass.result}
                      </span>
                      {isPassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                    {isPassExpanded && (
                      <div className="border-t border-slate-700/30 p-3 bg-slate-900/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 text-xs block">Reaction Time</span>
                            <span className="text-purple-400 font-mono">{pass.reactionTime.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">60' Time</span>
                            <span className="text-white font-mono">{pass.sixtyFoot.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">330' Time</span>
                            <span className="text-white font-mono">{pass.threeThirty.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">Lane</span>
                            <span className="text-white">{pass.lane}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">Temperature</span>
                            <span className="text-white">{pass.weather.temperature}°F</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">Humidity</span>
                            <span className="text-white">{pass.weather.humidity}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">Barometer</span>
                            <span className="text-white">{pass.weather.pressure.toFixed(2)}"</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">SAE Correction</span>
                            <span className="text-yellow-400 font-mono">{pass.saeCorrection.toFixed(3)}</span>
                          </div>
                          {pass.notes && (
                            <div className="col-span-full">
                              <span className="text-slate-500 text-xs block">Notes</span>
                              <span className="text-slate-300 text-sm">{pass.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Monthly Summaries */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Monthly Summaries
        </h3>
        {sortedMonthKeys.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No passes logged yet</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortedMonthKeys.map(monthKey => {
              const [year, month] = monthKey.split('-').map(Number);
              const summary = monthlySummaries[monthKey];
              const monthName = MONTH_NAMES[month - 1];
              
              return (
                <div
                  key={monthKey}
                  className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setCurrentYear(year);
                    setCurrentMonth(month - 1);
                    setExpandedDate(null);
                    setExpandedPassId(null);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">{monthName} {year}</h4>
                    <span className="text-orange-400 font-bold text-lg">{summary.totalPasses}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-900/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-slate-500">Best ET</span>
                      </div>
                      <span className="text-green-400 font-mono font-bold text-sm">
                        {summary.bestET > 0 ? summary.bestET.toFixed(3) : '--'}
                      </span>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Gauge className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-slate-500">Avg MPH</span>
                      </div>
                      <span className="text-blue-400 font-mono font-bold text-sm">
                        {summary.avgMPH > 0 ? summary.avgMPH.toFixed(1) : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Session breakdown */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(summary.sessions).map(([type, count]) => {
                      const colors = SESSION_COLORS[type] || SESSION_COLORS['Test'];
                      return (
                        <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {count} {type}
                        </span>
                      );
                    })}
                  </div>

                  {/* Tracks visited */}
                  {summary.tracks.size > 0 && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      {Array.from(summary.tracks).slice(0, 3).join(', ')}
                      {summary.tracks.size > 3 && ` +${summary.tracks.size - 3} more`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PassLogTimeline;
