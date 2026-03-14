import React, { useState, useMemo, useCallback } from 'react';
import { useCar } from '@/contexts/CarContext';
import { useThemeColor } from '@/contexts/ThemeColorContext';
import DateInputDark from '@/components/ui/DateInputDark';
import { PassLogEntry } from '@/data/proModData';
import { getLocalDateString } from '@/lib/utils';
import {
  Search, Filter, X, ChevronDown, ChevronUp, Download,
  RotateCcw, Thermometer, Droplets, Gauge, Calendar,
  Car, Trophy, FileText, SlidersHorizontal, Eye, EyeOff
} from 'lucide-react';

export interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  trackName: string;
  carId: string;
  etMin: string;
  etMax: string;
  mphMin: string;
  mphMax: string;
  round: string;
  tempMin: string;
  tempMax: string;
  humidityMin: string;
  humidityMax: string;
  pressureMin: string;
  pressureMax: string;
  result: string;
  notesKeyword: string;
}

const emptyFilters: AdvancedFilters = {
  dateFrom: '',
  dateTo: '',
  trackName: '',
  carId: '',
  etMin: '',
  etMax: '',
  mphMin: '',
  mphMax: '',
  round: '',
  tempMin: '',
  tempMax: '',
  humidityMin: '',
  humidityMax: '',
  pressureMin: '',
  pressureMax: '',
  result: '',
  notesKeyword: '',
};

interface PassLogAdvancedSearchProps {
  passLogs: PassLogEntry[];
  onFilteredResults: (filtered: PassLogEntry[]) => void;
  onExportCSV: (filtered: PassLogEntry[]) => void;
}

const PassLogAdvancedSearch: React.FC<PassLogAdvancedSearchProps> = ({
  passLogs,
  onFilteredResults,
  onExportCSV,
}) => {
  const { cars, getCarLabel } = useCar();
  const { colors } = useThemeColor();

  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(emptyFilters);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== '');
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length;
  }, [filters]);

  const updateFilter = useCallback((key: keyof AdvancedFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(emptyFilters);
  }, []);

  // Apply filters to pass logs
  const filteredPasses = useMemo(() => {
    let result = [...passLogs];

    // Date Range
    if (filters.dateFrom) {
      result = result.filter(p => p.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(p => p.date <= filters.dateTo);
    }

    // Track / Event Name
    if (filters.trackName.trim()) {
      const q = filters.trackName.trim().toLowerCase();
      result = result.filter(p =>
        p.track.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    }

    // Car
    if (filters.carId) {
      result = result.filter(p => p.car_id === filters.carId);
    }

    // ET Range
    if (filters.etMin) {
      const min = parseFloat(filters.etMin);
      if (!isNaN(min)) result = result.filter(p => p.eighth >= min);
    }
    if (filters.etMax) {
      const max = parseFloat(filters.etMax);
      if (!isNaN(max)) result = result.filter(p => p.eighth <= max);
    }

    // MPH Range
    if (filters.mphMin) {
      const min = parseFloat(filters.mphMin);
      if (!isNaN(min)) result = result.filter(p => p.mph >= min);
    }
    if (filters.mphMax) {
      const max = parseFloat(filters.mphMax);
      if (!isNaN(max)) result = result.filter(p => p.mph <= max);
    }

    // Round
    if (filters.round) {
      if (filters.round === 'qualifier') {
        result = result.filter(p => p.sessionType === 'Qualifying');
      } else if (filters.round === 'test') {
        result = result.filter(p => p.sessionType === 'Test');
      } else if (filters.round === 'match') {
        result = result.filter(p => p.sessionType === 'Match Race');
      } else {
        // Elimination rounds
        const roundMap: Record<string, string[]> = {
          'first': ['R1', 'Round 1', 'First Round', '1st', 'E1'],
          'second': ['R2', 'Round 2', 'Second Round', '2nd', 'E2'],
          'semi': ['Semi', 'Semifinals', 'Semi-final', 'SF', 'Semis'],
          'final': ['Final', 'Finals', 'F', 'Championship'],
        };
        const keywords = roundMap[filters.round] || [];
        if (keywords.length > 0) {
          result = result.filter(p => {
            if (!p.round) return false;
            const r = p.round.toLowerCase();
            return keywords.some(kw => r.includes(kw.toLowerCase()));
          });
        }
      }
    }

    // Weather: Temperature Range
    if (filters.tempMin) {
      const min = parseFloat(filters.tempMin);
      if (!isNaN(min)) result = result.filter(p => p.weather?.temperature >= min);
    }
    if (filters.tempMax) {
      const max = parseFloat(filters.tempMax);
      if (!isNaN(max)) result = result.filter(p => p.weather?.temperature <= max);
    }

    // Weather: Humidity Range
    if (filters.humidityMin) {
      const min = parseFloat(filters.humidityMin);
      if (!isNaN(min)) result = result.filter(p => p.weather?.humidity >= min);
    }
    if (filters.humidityMax) {
      const max = parseFloat(filters.humidityMax);
      if (!isNaN(max)) result = result.filter(p => p.weather?.humidity <= max);
    }

    // Weather: Barometric Pressure Range
    if (filters.pressureMin) {
      const min = parseFloat(filters.pressureMin);
      if (!isNaN(min)) result = result.filter(p => p.weather?.pressure >= min);
    }
    if (filters.pressureMax) {
      const max = parseFloat(filters.pressureMax);
      if (!isNaN(max)) result = result.filter(p => p.weather?.pressure <= max);
    }

    // Win / Loss / Result
    if (filters.result) {
      result = result.filter(p => p.result === filters.result);
    }

    // Notes Keyword
    if (filters.notesKeyword.trim()) {
      const q = filters.notesKeyword.trim().toLowerCase();
      result = result.filter(p => p.notes.toLowerCase().includes(q));
    }

    return result;
  }, [passLogs, filters]);

  // Notify parent of filtered results whenever they change
  React.useEffect(() => {
    if (hasActiveFilters) {
      onFilteredResults(filteredPasses);
    } else {
      onFilteredResults(passLogs);
    }
  }, [filteredPasses, hasActiveFilters, passLogs]);

  const handleExport = () => {
    onExportCSV(hasActiveFilters ? filteredPasses : passLogs);
  };

  // Unique tracks for autocomplete hints
  const uniqueTracks = useMemo(() => {
    const tracks = new Set<string>();
    passLogs.forEach(p => { if (p.track) tracks.add(p.track); });
    return Array.from(tracks).sort();
  }, [passLogs]);

  const inputClass = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-opacity-70 focus:outline-none transition-colors';
  const labelClass = 'block text-xs text-slate-400 mb-1 font-medium';

  return (
    <div className="mb-6">
      {/* Toggle Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
          isExpanded
            ? 'bg-slate-800/80 border-slate-600'
            : hasActiveFilters
            ? 'bg-slate-800/60 border-current'
            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60'
        }`}
        style={hasActiveFilters && !isExpanded ? { borderColor: `rgba(${colors.rgb}, 0.4)` } : undefined}
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal
            className="w-4 h-4"
            style={hasActiveFilters ? { color: colors.base } : { color: 'rgb(148 163 184)' }}
          />
          <span className="text-sm font-medium text-white">Advanced Search & Filters</span>
          {hasActiveFilters && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: colors.base }}
            >
              {activeFilterCount} active
            </span>
          )}
          {hasActiveFilters && (
            <span className="text-xs text-slate-400">
              — {filteredPasses.length} of {passLogs.length} passes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Clear All
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="mt-2 bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
          {/* Row 1: Date Range + Track + Car */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label className={labelClass}>
                <Calendar className="w-3 h-3 inline mr-1" />
                From Date
              </label>
              <DateInputDark
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Date To */}
            <div>
              <label className={labelClass}>
                <Calendar className="w-3 h-3 inline mr-1" />
                To Date
              </label>
              <DateInputDark
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Track / Event Name */}
            <div>
              <label className={labelClass}>
                <Search className="w-3 h-3 inline mr-1" />
                Event / Track Name
              </label>
              <input
                type="text"
                value={filters.trackName}
                onChange={(e) => updateFilter('trackName', e.target.value)}
                placeholder="Search track or location..."
                className={inputClass}
                list="track-suggestions"
              />
              <datalist id="track-suggestions">
                {uniqueTracks.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {/* Car Dropdown */}
            <div>
              <label className={labelClass}>
                <Car className="w-3 h-3 inline mr-1" />
                Car
              </label>
              <select
                value={filters.carId}
                onChange={(e) => updateFilter('carId', e.target.value)}
                className={inputClass}
              >
                <option value="">All Cars</option>
                {cars.map(car => (
                  <option key={car.id} value={car.id}>
                    {getCarLabel(car.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: ET Range + MPH Range + Round + Result */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* ET Min */}
            <div>
              <label className={labelClass}>Min ET</label>
              <input
                type="number"
                step="0.001"
                value={filters.etMin}
                onChange={(e) => updateFilter('etMin', e.target.value)}
                placeholder="e.g. 3.500"
                className={inputClass}
              />
            </div>

            {/* ET Max */}
            <div>
              <label className={labelClass}>Max ET</label>
              <input
                type="number"
                step="0.001"
                value={filters.etMax}
                onChange={(e) => updateFilter('etMax', e.target.value)}
                placeholder="e.g. 4.000"
                className={inputClass}
              />
            </div>

            {/* MPH Min */}
            <div>
              <label className={labelClass}>Min MPH</label>
              <input
                type="number"
                step="0.1"
                value={filters.mphMin}
                onChange={(e) => updateFilter('mphMin', e.target.value)}
                placeholder="e.g. 170"
                className={inputClass}
              />
            </div>

            {/* MPH Max */}
            <div>
              <label className={labelClass}>Max MPH</label>
              <input
                type="number"
                step="0.1"
                value={filters.mphMax}
                onChange={(e) => updateFilter('mphMax', e.target.value)}
                placeholder="e.g. 200"
                className={inputClass}
              />
            </div>

            {/* Round */}
            <div>
              <label className={labelClass}>Round</label>
              <select
                value={filters.round}
                onChange={(e) => updateFilter('round', e.target.value)}
                className={inputClass}
              >
                <option value="">All Rounds</option>
                <option value="test">Test / Hit</option>
                <option value="qualifier">Qualifier</option>
                <option value="first">First Round</option>
                <option value="second">Second Round</option>
                <option value="semi">Semifinals</option>
                <option value="final">Finals</option>
                <option value="match">Match Race</option>
              </select>
            </div>

            {/* Result */}
            <div>
              <label className={labelClass}>
                <Trophy className="w-3 h-3 inline mr-1" />
                Result
              </label>
              <select
                value={filters.result}
                onChange={(e) => updateFilter('result', e.target.value)}
                className={inputClass}
              >
                <option value="">All Results</option>
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
                <option value="Single">Single</option>
                <option value="Red Light">Red Light</option>
                <option value="Broke">Broke</option>
              </select>
            </div>
          </div>

          {/* Row 3: Weather Conditions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `rgba(${colors.rgb}, 0.15)` }}>
                <Thermometer className="w-3 h-3" style={{ color: colors.base }} />
              </div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Weather Conditions</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {/* Temp Min */}
              <div>
                <label className={labelClass}>
                  <Thermometer className="w-3 h-3 inline mr-1" />
                  Min Temp (°F)
                </label>
                <input
                  type="number"
                  value={filters.tempMin}
                  onChange={(e) => updateFilter('tempMin', e.target.value)}
                  placeholder="e.g. 50"
                  className={inputClass}
                />
              </div>

              {/* Temp Max */}
              <div>
                <label className={labelClass}>Max Temp (°F)</label>
                <input
                  type="number"
                  value={filters.tempMax}
                  onChange={(e) => updateFilter('tempMax', e.target.value)}
                  placeholder="e.g. 100"
                  className={inputClass}
                />
              </div>

              {/* Humidity Min */}
              <div>
                <label className={labelClass}>
                  <Droplets className="w-3 h-3 inline mr-1" />
                  Min Humidity (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.humidityMin}
                  onChange={(e) => updateFilter('humidityMin', e.target.value)}
                  placeholder="e.g. 20"
                  className={inputClass}
                />
              </div>

              {/* Humidity Max */}
              <div>
                <label className={labelClass}>Max Humidity (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.humidityMax}
                  onChange={(e) => updateFilter('humidityMax', e.target.value)}
                  placeholder="e.g. 80"
                  className={inputClass}
                />
              </div>

              {/* Pressure Min */}
              <div>
                <label className={labelClass}>
                  <Gauge className="w-3 h-3 inline mr-1" />
                  Min Baro (inHg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filters.pressureMin}
                  onChange={(e) => updateFilter('pressureMin', e.target.value)}
                  placeholder="e.g. 29.50"
                  className={inputClass}
                />
              </div>

              {/* Pressure Max */}
              <div>
                <label className={labelClass}>Max Baro (inHg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={filters.pressureMax}
                  onChange={(e) => updateFilter('pressureMax', e.target.value)}
                  placeholder="e.g. 30.50"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Notes Keyword */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                <FileText className="w-3 h-3 inline mr-1" />
                Notes Keyword Search
              </label>
              <input
                type="text"
                value={filters.notesKeyword}
                onChange={(e) => updateFilter('notesKeyword', e.target.value)}
                placeholder="Search inside pass notes..."
                className={inputClass}
              />
            </div>

            {/* Results Summary + Actions */}
            <div className="flex items-end gap-3">
              {/* Results Count */}
              <div className="flex-1 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Filtered Results</p>
                    <p className="text-lg font-bold text-white">
                      {hasActiveFilters ? filteredPasses.length : passLogs.length}
                      <span className="text-xs text-slate-500 font-normal ml-1">
                        of {passLogs.length} passes
                      </span>
                    </p>
                  </div>
                  {hasActiveFilters && filteredPasses.length !== passLogs.length && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `rgba(${colors.rgb}, 0.15)` }}
                    >
                      <Filter className="w-4 h-4" style={{ color: colors.base }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={clearAllFilters}
                  disabled={!hasActiveFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear All Filters
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:brightness-110 transition-all text-sm font-medium"
                  style={{ backgroundColor: colors.base }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassLogAdvancedSearch;
