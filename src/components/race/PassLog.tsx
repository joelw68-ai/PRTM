import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';


import { toast } from 'sonner';
import DateInputDark from '@/components/ui/DateInputDark';

import TimeInputDark from '@/components/ui/TimeInputDark';
import { getStateSelectOptions, parseCityState } from '@/data/usStates';

import { useApp } from '@/contexts/AppContext';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { isConnectivityError } from '@/lib/offlineQueue';

import { useAuth } from '@/contexts/AuthContext';

import { CrewRole } from '@/lib/permissions';
import { fetchWeatherData, calculateDewPoint, calculateVaporPressure, calculateWaterGrains, calculateWetBulb, calculateSTDCorrection, calculateDensityAltitude, calculateSAECorrection, convertSLPtoStationPressure } from '@/lib/weather';



import { SavedTrack, ComponentPart } from '@/lib/database';
import * as db from '@/lib/database';

// ═══════════════════════════════════════════════════════════════════
// LOCALSTORAGE HELPERS FOR STANDALONE PARTS
// ═══════════════════════════════════════════════════════════════════
// When PassLog auto-increments standalone parts, it MUST update both:
//   1. The database (via bulkIncrementComponentPartPasses)
//   2. The localStorage fallback (mainComp_parts_db_fallback)
//
// WHY BOTH? MainComponents may not be mounted when a pass is logged.
// If MainComponents isn't mounted, the 'component-parts-incremented'
// custom event goes nowhere, and the localStorage fallback never gets
// updated. On next page load, MainComponents loads from localStorage
// (if DB is unavailable/PGRST205) and sees the old pass counts.
//
// By directly updating localStorage here, we guarantee the pass counts
// are persisted regardless of whether MainComponents is mounted, and
// regardless of whether the database update succeeds.
// ═══════════════════════════════════════════════════════════════════
const PARTS_FALLBACK_KEY = 'mainComp_parts_db_fallback';

/**
 * Directly update standalone part pass counts in the localStorage fallback.
 * Called by PassLog after auto-incrementing parts on a new pass.
 *
 * @param componentIds - IDs of the components whose parts should be updated
 * @param increment    - Number of passes to add (positive) or subtract (negative for undo)
 */
function updateLocalStoragePartPasses(componentIds: string[], increment: number): void {
  try {
    const raw = localStorage.getItem(PARTS_FALLBACK_KEY);
    if (!raw) {
      console.log('[PassLog] No localStorage parts fallback found — skipping localStorage update');
      return;
    }
    const parts: ComponentPart[] = JSON.parse(raw);
    if (!Array.isArray(parts) || parts.length === 0) return;

    let updatedCount = 0;
    const updatedParts = parts.map(p => {
      if (componentIds.includes(p.componentId)) {
        updatedCount++;
        return { ...p, passesOnPart: Math.max(0, (p.passesOnPart || 0) + increment) };
      }
      return p;
    });

    if (updatedCount > 0) {
      localStorage.setItem(PARTS_FALLBACK_KEY, JSON.stringify(updatedParts));
      console.log(`[PassLog] Updated ${updatedCount} standalone part(s) in localStorage fallback: ${increment > 0 ? '+' : ''}${increment}`);
    }
  } catch (err) {
    console.warn('[PassLog] Failed to update localStorage parts fallback:', err);
  }
}





import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Thermometer, 
  Droplets, 
  Gauge,
  Wind,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Cloud,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  CloudSun,
  Loader2,
  Pencil,
  Trash2,
  Star,
  Save,
  Settings,
  CheckCircle,
  History,
  Calendar,
  GitCompare,
  CheckSquare,
  Square,
  FlaskConical,
  Package,
  Undo2,
  Mountain
} from 'lucide-react';





import { PassLogEntry } from '@/data/proModData';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PassComparison from './PassComparison';
import OfflineSyncBanner from './OfflineSyncBanner';
import WeatherVerifyPanel from './WeatherVerifyPanel';
import PassLogAdvancedSearch from './PassLogAdvancedSearch';
import PassLogTimeline from './PassLogTimeline';



interface PassLogProps {
  currentRole?: CrewRole;
}

const PassLog: React.FC<PassLogProps> = ({ currentRole = 'Crew' }) => {

  const { 
    passLogs, 
    addPassLog, 
    updatePassLog, 
    deletePassLog, 
    engines, 
    superchargers, 
    drivetrainComponents,
    getActiveEngine, 
    getActiveSupercharger,
    updateEngine,
    updateSupercharger,
    updateDrivetrainComponent,
    savedTracks,
    addSavedTrack,
    updateSavedTrack,
    deleteSavedTrack,
    incrementTrackVisit
  } = useApp();
  const { profile } = useAuth();
  const { queueOperation, reportConnectivityError, reportSuccess } = useOfflineSync();

  // ═══════════════════════════════════════════════════════════════════
  // AUTO-INCREMENT STANDALONE PARTS ON NEW PASS
  // ═══════════════════════════════════════════════════════════════════
  // When enabled (default ON), saving a new pass automatically adds +1 pass
  // to every standalone part on every currently-installed component.
  // User can toggle this off per-pass in the modal footer.
  const AUTO_INCREMENT_KEY = 'passlog_auto_increment_parts';
  const [autoIncrementParts, setAutoIncrementParts] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(AUTO_INCREMENT_KEY);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });

  // Persist the toggle to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem(AUTO_INCREMENT_KEY, String(autoIncrementParts)); } catch {}
  }, [autoIncrementParts]);


  const autoFetchTriggered = useRef(false);
  const trackSelectRef = useRef<HTMLSelectElement>(null);
  // ═══════════════════════════════════════════════════════════════════
  // TRACK ELEVATION — critical for correct Density Altitude calculation
  // ═══════════════════════════════════════════════════════════════════
  // Weather APIs report sea-level corrected pressure (QNH), but DA requires
  // station pressure (QFE).  When we know the track elevation, we convert
  // SLP → station pressure before computing DA, matching what Computech,
  // RaceAir, and Altus weather stations report.
  const [trackElevation, setTrackElevation] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedPass, setExpandedPass] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPassId, setEditingPassId] = useState<string | null>(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSuccess, setWeatherSuccess] = useState<string | null>(null);
  const [showTrackManager, setShowTrackManager] = useState(false);
  const [savingTrack, setSavingTrack] = useState(false);
  const [trackSaveSuccess, setTrackSaveSuccess] = useState<string | null>(null);
  const [isHistoricalFetch, setIsHistoricalFetch] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmPassId, setDeleteConfirmPassId] = useState<string | null>(null);

  // Bulk delete confirmation state
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // View mode: table or timeline
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  // ═══════════════════════════════════════════════════════════════════
  // REACTION TIME STRING STATE — allows typing negative values
  // ═══════════════════════════════════════════════════════════════════
  // A controlled <input type="number"> with value={number} prevents
  // typing "-" because valueAsNumber is NaN for the intermediate "-"
  // string, and the NaN guard blocks the state update, causing React
  // to re-render with the old numeric value (erasing the "-").
  //
  // Fix: use a separate string state for the input display value.
  // We sync the numeric formData.reactionTime only when the string
  // parses to a valid number.  On blur, we clean up the display.
  const [rtInputStr, setRtInputStr] = useState<string>('0');





  // Weather Verify Panel state
  const [showVerifyPanel, setShowVerifyPanel] = useState(false);
  const [verifyWeatherData, setVerifyWeatherData] = useState<{temp: number; humidity: number; pressure: number}>({temp: 70, humidity: 50, pressure: 29.92});


  // Separate city/state fields for the location (combined into formData.location for weather/saving)
  const [trackCity, setTrackCity] = useState('');
  const [trackState, setTrackState] = useState('');

  const stateOptions = getStateSelectOptions();

  // Helper: combine city + state into "City, ST" for formData.location
  const combineCityState = (city: string, state: string): string => {
    const c = city.trim();
    const s = state.trim();
    if (c && s) return `${c}, ${s}`;
    if (c) return c;
    if (s) return s;
    return '';
  };


  
  // Pass comparison state
  const [selectedPassIds, setSelectedPassIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Advanced search state — when active, overrides the basic filtered passes for the table display
  const [advancedFilteredPasses, setAdvancedFilteredPasses] = useState<PassLogEntry[] | null>(null);


  const activeEngine = getActiveEngine();
  const activeSupercharger = getActiveSupercharger();
  // Default form state for new pass
  // First pass ever: car setup fields default to 0
  // Subsequent passes: pre-fill car setup from the most recent previous pass
  const getDefaultPassState = (): Partial<PassLogEntry> => {
    const mostRecent = passLogs.length > 0 ? passLogs[0] : null;

    // Build today's date in LOCAL time (not UTC).
    // new Date().toISOString() converts to UTC which can shift the calendar day
    // in negative-UTC timezones (e.g. US time zones).  Instead, use the local
    // year/month/day components directly.
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return {
      date: localDate,
      time: new Date().toTimeString().slice(0, 5),
      track: '',
      location: '',
      sessionType: 'Test',
      lane: 'Left',
      result: 'Single',
      reactionTime: 0,
      sixtyFoot: 0,
      threeThirty: 0,
      eighth: 0,
      mph: 0,
      weather: {
        temperature: 70,
        humidity: 50,
        pressure: 29.92,
        windSpeed: 0,
        windDirection: 'N',
        trackTemp: mostRecent ? (mostRecent.weather?.trackTemp ?? 0) : 0,
        conditions: 'Clear'
      },
      saeCorrection: 1.000,
      densityAltitude: 0,
      correctedHP: 3500,
      engineId: activeEngine?.id || '',
      superchargerId: activeSupercharger?.id || '',
      tirePressureFront: mostRecent ? (mostRecent.tirePressureFront ?? 0) : 0,
      tirePressureRearLeft: mostRecent ? (mostRecent.tirePressureRearLeft ?? 0) : 0,
      tirePressureRearRight: mostRecent ? (mostRecent.tirePressureRearRight ?? 0) : 0,
      wheelieBarSetting: mostRecent ? (mostRecent.wheelieBarSetting ?? 0) : 0,
      launchRPM: mostRecent ? (mostRecent.launchRPM ?? 0) : 0,
      boostSetting: mostRecent ? (mostRecent.boostSetting ?? 0) : 0,
      notes: '',
      crewChief: '',
      aborted: false,
    };

  };




  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<PassLogEntry>>(getDefaultPassState());

  // Reset form when modal closes

  useEffect(() => {
    if (!showModal) {
      setEditingPassId(null);
      setFormData(getDefaultPassState());
      setRtInputStr('0');
      setTrackCity('');
      setTrackState('');
      setWeatherError(null);
      setWeatherSuccess(null);
      setTrackSaveSuccess(null);
    }
  }, [showModal]);



  // Auto-fetch weather when opening the modal for a new pass (not editing)
  // Uses the last-used track location, home track from profile, or favorite saved track
  useEffect(() => {
    if (showModal && !editingPassId && !autoFetchTriggered.current) {
      // Determine best location for auto-fetch
      let autoLocation = '';
      let autoTrackName = '';
      
      // Priority: 1) Last pass location, 2) Favorite saved track, 3) Home track from profile
      if (passLogs.length > 0 && passLogs[0].location) {
        autoLocation = passLogs[0].location;
        autoTrackName = passLogs[0].track;
      } else {
        const favTrack = savedTracks.find(t => t.isFavorite);
        if (favTrack) {
          autoLocation = favTrack.location;
          autoTrackName = favTrack.name;
        } else if (profile?.homeTrack) {
          autoLocation = profile.homeTrack;
          autoTrackName = profile.homeTrack;
        }
      }
      
      if (autoLocation) {
        autoFetchTriggered.current = true;
        // Pre-fill track info and parse city/state
        const parsed = parseCityState(autoLocation);
        setTrackCity(parsed.city);
        setTrackState(parsed.state);
        setFormData(prev => ({
          ...prev,
          track: prev.track || autoTrackName,
          location: prev.location || autoLocation
        }));

        
        // Auto-fetch weather for today (not historical)
        // Use local date components to avoid UTC shift from toISOString()
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isToday = formData.date === todayLocal;
        if (isToday) {

          // Small delay to let form data update first
          setTimeout(async () => {
            try {
              setFetchingWeather(true);
              const data = await fetchWeatherData(autoLocation);
              if (data?.weather) {
                const dewPt = calculateDewPoint(data.weather.temperature, data.weather.humidity);
                setFormData(prev => ({
                  ...prev,
                  weather: {
                    ...prev.weather!,
                    temperature: data.weather.temperature,
                    humidity: data.weather.humidity,
                    pressure: data.weather.pressure,
                    windSpeed: data.weather.windSpeed,
                    windDirection: data.weather.windDirection,
                    conditions: data.weather.conditions,
                    dewPoint: dewPt
                  },
                  saeCorrection: data.saeCorrection,
                  densityAltitude: data.densityAltitude,
                  correctedHP: data.correctedHP
                }));
                const locName = data.weather.location 
                  ? `${data.weather.location}${data.weather.region ? `, ${data.weather.region}` : ''}`
                  : autoLocation;
                setWeatherSuccess(`Weather auto-loaded for ${locName}`);
                setTimeout(() => setWeatherSuccess(null), 5000);
              }
            } catch (err) {
              // Silent fail for auto-fetch - user can manually fetch
              console.warn('Auto-fetch weather failed:', err);
            } finally {
              setFetchingWeather(false);
            }
          }, 300);
        }
      }
    }
    
    if (!showModal) {
      autoFetchTriggered.current = false;
    }
  }, [showModal, editingPassId]);


  const handleAddNew = () => {
    setEditingPassId(null);
    setFormData(getDefaultPassState());
    setRtInputStr('0');
    setTrackCity('');
    setTrackState('');
    setShowModal(true);
  };



  // Open modal for editing existing pass
  const handleEdit = (pass: PassLogEntry) => {
    setEditingPassId(pass.id);
    setFormData({
      date: pass.date,
      time: pass.time,
      track: pass.track,
      location: pass.location,
      sessionType: pass.sessionType,
      round: pass.round,
      lane: pass.lane,
      result: pass.result,
      reactionTime: pass.reactionTime,
      sixtyFoot: pass.sixtyFoot,
      threeThirty: pass.threeThirty,
      eighth: pass.eighth,
      mph: pass.mph,
      quarterMileET: pass.quarterMileET,
      quarterMileMPH: pass.quarterMileMPH,
      endSplit: pass.endSplit,
      weather: { ...pass.weather },
      saeCorrection: pass.saeCorrection,
      densityAltitude: pass.densityAltitude,
      correctedHP: pass.correctedHP,
      engineId: pass.engineId,
      superchargerId: pass.superchargerId,
      tirePressureFront: pass.tirePressureFront,
      tirePressureRearLeft: pass.tirePressureRearLeft,
      tirePressureRearRight: pass.tirePressureRearRight,
      wheelieBarSetting: pass.wheelieBarSetting,
      launchRPM: pass.launchRPM,
      boostSetting: pass.boostSetting,
      notes: pass.notes,
      crewChief: pass.crewChief,
      aborted: pass.aborted
    });
    // Sync the reaction time string state for the text input
    setRtInputStr(String(pass.reactionTime));
    // Parse location into separate city/state for the split fields
    const parsed = parseCityState(pass.location || '');
    setTrackCity(parsed.city);
    setTrackState(parsed.state);
    setShowModal(true);
  };



  // Handle saved track selection — uses ref to reset the native <select> after picking
  const handleTrackSelect = (trackId: string) => {
    if (trackId === '') return;

    const selectedTrack = savedTracks.find(t => t.id === trackId);
    if (selectedTrack) {
      // Parse the saved track's location into city/state
      const parsed = parseCityState(selectedTrack.location || '');
      setTrackCity(parsed.city);
      setTrackState(parsed.state);

      // Store track elevation for DA correction
      const elev = selectedTrack.elevation || 0;
      setTrackElevation(elev);
      console.log(`[PassLog] Track selected: ${selectedTrack.name}, elevation: ${elev} ft`);

      setFormData(prev => ({
        ...prev,
        track: selectedTrack.name,
        location: selectedTrack.location
      }));

      // If we already have weather data, recalculate DA/SAE with the new elevation
      if (formData.weather?.pressure && formData.weather?.temperature && elev > 0) {
        const corrected = calculateSAECorrection(
          formData.weather.temperature,
          formData.weather.pressure,
          formData.weather.humidity || 50,
          elev
        );
        setFormData(prev => ({
          ...prev,
          track: selectedTrack.name,
          location: selectedTrack.location,
          saeCorrection: corrected.saeCorrection,
          densityAltitude: corrected.densityAltitude,
          correctedHP: corrected.correctedHP,
        }));
        console.log(`[PassLog] Recalculated DA with elevation ${elev} ft: ${corrected.densityAltitude} ft`);
      }

      // Increment visit count
      incrementTrackVisit(trackId);
    }

    // Reset the native select back to the placeholder via ref (avoids controlled-value issues)
    if (trackSelectRef.current) {
      trackSelectRef.current.value = '';
    }
  };



  // Save current track as preset
  const handleSaveTrack = async () => {
    const trackName = formData.track?.trim();
    const location = formData.location?.trim();
    
    if (!trackName || !location) {
      setWeatherError('Please enter both track name and location to save');
      setTimeout(() => setWeatherError(null), 4000);
      return;
    }
    
    // Check if track already exists
    const existingTrack = savedTracks.find(
      t => t.name.toLowerCase() === trackName.toLowerCase() && 
           t.location.toLowerCase() === location.toLowerCase()
    );
    
    if (existingTrack) {
      setWeatherError('This track is already saved');
      setTimeout(() => setWeatherError(null), 4000);
      return;
    }
    
    setSavingTrack(true);
    
    try {
      const newTrack: SavedTrack = {
        id: crypto.randomUUID(),

        name: trackName,
        location: location,
        elevation: 0,
        trackLength: '1/8 mile',
        surfaceType: 'Concrete',
        notes: '',
        isFavorite: false,
        visitCount: 1,
        lastVisited: getLocalDateString()

      };
      
      await addSavedTrack(newTrack);
      setTrackSaveSuccess(`"${trackName}" saved to your tracks!`);
      setTimeout(() => setTrackSaveSuccess(null), 4000);
    } catch (error) {
      console.error('Error saving track:', error);
      setWeatherError('Failed to save track');
      setTimeout(() => setWeatherError(null), 4000);
    } finally {
      setSavingTrack(false);
    }
  };

  // Check if the selected date is in the past (for historical weather)
  const isDateInPast = (): boolean => {
    if (!formData.date) return false;
    // Compare YYYY-MM-DD strings directly to avoid any Date-object UTC
    // conversion.  getLocalDateString() builds today's date from local
    // year/month/day components, so the comparison is always in the
    // user's local timezone — no off-by-one near midnight.
    const todayStr = getLocalDateString();
    return formData.date < todayStr;
  };



  // Fetch weather from WeatherAPI.com (supports both current and historical)
  const fetchWeather = async () => {
    const location = formData.location?.trim();
    
    if (!location) {
      setWeatherError('Please enter a track location first (City, State or City, Country)');
      setTimeout(() => setWeatherError(null), 4000);
      return;
    }

    const isHistorical = isDateInPast();
    setFetchingWeather(true);
    setIsHistoricalFetch(isHistorical);
    setWeatherError(null);
    setWeatherSuccess(null);

    try {
      const data = await fetchWeatherData(location, formData.date, formData.time);

      if (data?.weather) {
        // The API returns sea-level corrected pressure.  If we know the track
        // elevation, recalculate DA/SAE using station pressure so the values
        // match what a Computech/RaceAir at the track would show.
        let sae = data.saeCorrection;
        let da = data.densityAltitude;
        let hp = data.correctedHP;

        if (trackElevation > 0) {
          const corrected = calculateSAECorrection(
            data.weather.temperature,
            data.weather.pressure,
            data.weather.humidity,
            trackElevation
          );
          sae = corrected.saeCorrection;
          da = corrected.densityAltitude;
          hp = corrected.correctedHP;
          console.log(`[PassLog fetchWeather] Elevation-corrected DA: ${da} ft (elev: ${trackElevation} ft, SLP: ${data.weather.pressure}" → station: ${convertSLPtoStationPressure(data.weather.pressure, trackElevation).toFixed(2)}")`);
        }

        // Update weather fields
        setFormData(prev => ({
          ...prev,
          weather: {
            ...prev.weather!,
            temperature: data.weather.temperature,
            humidity: data.weather.humidity,
            pressure: data.weather.pressure,
            windSpeed: data.weather.windSpeed,
            windDirection: data.weather.windDirection,
            conditions: data.weather.conditions
          },
          saeCorrection: sae,
          densityAltitude: da,
          correctedHP: hp
        }));


        const locationName = data.weather.location 
          ? `${data.weather.location}${data.weather.region ? `, ${data.weather.region}` : ''}`
          : location;
        
        // Show different success message for historical vs current weather
        if (data.isHistorical) {
          // Parse as local time to avoid UTC date shift in the formatted display
          const formattedDate = formatLocalDate(formData.date!, { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });

          setWeatherSuccess(`Historical weather loaded for ${locationName} on ${formattedDate}`);

        } else {
          setWeatherSuccess(`Current weather loaded for ${locationName}`);
        }
        setTimeout(() => setWeatherSuccess(null), 6000);
      }
    } catch (err: unknown) {
      console.error('Weather fetch error:', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      if (isHistorical) {
        setWeatherError(`Failed to fetch historical weather: ${message}`);
      } else {
        setWeatherError(`Failed to fetch weather data: ${message}`);
      }
      // Don't auto-clear — user can click Retry or dismiss manually

    } finally {
      setFetchingWeather(false);
      setIsHistoricalFetch(false);
    }
  };


  // Calculate SAE correction factor manually based on weather inputs.
  // Now uses track elevation to convert API sea-level pressure to station
  // pressure, matching Computech/RaceAir readings.
  const calculateSAE = () => {
    const temp = formData.weather?.temperature || 70;
    const humidity = formData.weather?.humidity || 50;
    const pressure = formData.weather?.pressure || 29.92;
    
    // Use the shared calculateSAECorrection which handles elevation-based
    // SLP → station pressure conversion internally
    const corrected = calculateSAECorrection(temp, pressure, humidity, trackElevation);
    
    console.log(`[PassLog calculateSAE] temp=${temp}°F, pressure=${pressure}" (SLP), humidity=${humidity}%, elevation=${trackElevation} ft → DA=${corrected.densityAltitude} ft, SAE=${corrected.saeCorrection}`);
    
    setFormData(prev => ({
      ...prev,
      saeCorrection: corrected.saeCorrection,
      densityAltitude: corrected.densityAltitude,
      correctedHP: corrected.correctedHP
    }));
  };




  // Save pass (add new or update existing) — with offline queue fallback
  // When adding a NEW pass and autoIncrementParts is ON, also increment
  // standalone parts passes on all currently-installed components.
  const handleSave = async () => {
    const isNewPass = !editingPassId;

    try {
      if (editingPassId) {
        await updatePassLog(editingPassId, formData);
      } else {
        const pass: PassLogEntry = {
          id: `PASS-${String(passLogs.length + 1).padStart(3, '0')}`,
          ...formData as PassLogEntry
        };
        await addPassLog(pass);
      }
      reportSuccess();
    } catch (err) {
      console.error('[PassLog] save failed:', err);
      if (isConnectivityError(err)) {
        reportConnectivityError();
        toast.warning('Pass saved locally — will sync when connection is restored');
      } else {
        toast.error('Failed to save pass');
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-INCREMENT STANDALONE PARTS ON NEW PASS + UNDO CAPABILITY
    // ═══════════════════════════════════════════════════════════════════
    if (isNewPass && autoIncrementParts) {
      try {
        let totalUpdated = 0;
        const n = 1; // Always +1 pass per logged pass

        // Capture snapshot of components for undo
        const undoEngineIds: { id: string; prevTotal: number; prevSinceRebuild: number }[] = [];
        const undoSuperchargerIds: { id: string; prevTotal: number; prevSinceService: number }[] = [];
        const undoDrivetrainIds: { id: string; prevTotal: number; prevSinceService: number }[] = [];
        const passId = `PASS-${String(passLogs.length + 1).padStart(3, '0')}`;

        // Increment all installed engines
        for (const eng of engines.filter((e: any) => e.currentlyInstalled)) {
          undoEngineIds.push({ id: eng.id, prevTotal: eng.totalPasses, prevSinceRebuild: eng.passesSinceRebuild });
          updateEngine(eng.id, {
            totalPasses: eng.totalPasses + n,
            passesSinceRebuild: eng.passesSinceRebuild + n,
          }).catch(err => console.warn('[PassLog AutoIncrement] engine update failed:', err));
          db.bulkIncrementComponentPartPasses(eng.id, n).catch(err => console.warn('[PassLog AutoIncrement] engine parts increment failed:', err));
          totalUpdated++;
        }

        // Increment all installed power adders (superchargers)
        for (const sc of superchargers.filter((s: any) => s.currentlyInstalled)) {
          undoSuperchargerIds.push({ id: sc.id, prevTotal: sc.totalPasses, prevSinceService: sc.passesSinceService });
          updateSupercharger(sc.id, {
            totalPasses: sc.totalPasses + n,
            passesSinceService: sc.passesSinceService + n,
          }).catch(err => console.warn('[PassLog AutoIncrement] supercharger update failed:', err));
          db.bulkIncrementComponentPartPasses(sc.id, n).catch(err => console.warn('[PassLog AutoIncrement] supercharger parts increment failed:', err));
          totalUpdated++;
        }

        // Increment all installed drivetrain components
        for (const dt of drivetrainComponents.filter((d: any) => d.currentlyInstalled)) {
          undoDrivetrainIds.push({ id: dt.id, prevTotal: dt.totalPasses, prevSinceService: dt.passesSinceService });
          updateDrivetrainComponent(dt.id, {
            totalPasses: dt.totalPasses + n,
            passesSinceService: dt.passesSinceService + n,
          }).catch(err => console.warn('[PassLog AutoIncrement] drivetrain update failed:', err));
          db.bulkIncrementComponentPartPasses(dt.id, n).catch(err => console.warn('[PassLog AutoIncrement] drivetrain parts increment failed:', err));
          totalUpdated++;
        }

        // ═══════════════════════════════════════════════════════════════
        // DISPATCH EVENT TO SYNC MAINCOMPONENTS LOCAL STATE
        // ═══════════════════════════════════════════════════════════════
        // MainComponents holds standalone parts in local React state.
        // The DB is updated above via bulkIncrementComponentPartPasses,
        // but MainComponents won't see the change until it re-fetches.
        // This custom event tells MainComponents to update its local
        // state immediately so the UI reflects the new pass counts.
        const incrementedComponentIds = [
          ...engines.filter((e: any) => e.currentlyInstalled).map((e: any) => e.id),
          ...superchargers.filter((s: any) => s.currentlyInstalled).map((s: any) => s.id),
          ...drivetrainComponents.filter((d: any) => d.currentlyInstalled).map((d: any) => d.id),
        ];
        if (incrementedComponentIds.length > 0) {
          window.dispatchEvent(new CustomEvent('component-parts-incremented', {
            detail: { componentIds: incrementedComponentIds, increment: n }
          }));
          console.log(`[PassLog] Dispatched component-parts-incremented event: +${n} for ${incrementedComponentIds.length} component(s)`);

          // ═══════════════════════════════════════════════════════════
          // GUARANTEED LOCALSTORAGE UPDATE
          // ═══════════════════════════════════════════════════════════
          // Directly update the localStorage fallback for standalone parts.
          // This is the CRITICAL fix: even if the DB update fails (PGRST205,
          // RLS, schema cache) AND MainComponents is not mounted (so the
          // custom event goes nowhere), the parts' pass counts are still
          // persisted in localStorage. On next page load, MainComponents
          // will pick up the updated values from localStorage.
          updateLocalStoragePartPasses(incrementedComponentIds, n);
        }


        if (totalUpdated > 0) {
          console.log(`[PassLog AutoIncrement] +1 pass added to ${totalUpdated} installed component(s) and their standalone parts`);
          
          // Show undo toast with 10-second window
          const UNDO_WINDOW_MS = 10000;
          const undoTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
          let undone = false;

          const handleUndo = async () => {
            if (undone) return;
            undone = true;
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

            try {
              // 1. Delete the pass log entry
              await deletePassLog(passId);

              // 2. Reverse engine increments
              for (const eng of undoEngineIds) {
                updateEngine(eng.id, { totalPasses: eng.prevTotal, passesSinceRebuild: eng.prevSinceRebuild })
                  .catch(err => console.warn('[Undo] engine revert failed:', err));
                db.bulkIncrementComponentPartPasses(eng.id, -n)
                  .catch(err => console.warn('[Undo] engine parts decrement failed:', err));
              }

              // 3. Reverse supercharger increments
              for (const sc of undoSuperchargerIds) {
                updateSupercharger(sc.id, { totalPasses: sc.prevTotal, passesSinceService: sc.prevSinceService })
                  .catch(err => console.warn('[Undo] supercharger revert failed:', err));
                db.bulkIncrementComponentPartPasses(sc.id, -n)
                  .catch(err => console.warn('[Undo] supercharger parts decrement failed:', err));
              }

              // 4. Reverse drivetrain increments
              for (const dt of undoDrivetrainIds) {
                updateDrivetrainComponent(dt.id, { totalPasses: dt.prevTotal, passesSinceService: dt.prevSinceService })
                  .catch(err => console.warn('[Undo] drivetrain revert failed:', err));
                db.bulkIncrementComponentPartPasses(dt.id, -n)
                  .catch(err => console.warn('[Undo] drivetrain parts decrement failed:', err));
              }

              // Dispatch decrement event so MainComponents updates its local state
              const undoComponentIds = [
                ...undoEngineIds.map(e => e.id),
                ...undoSuperchargerIds.map(s => s.id),
                ...undoDrivetrainIds.map(d => d.id),
              ];
              if (undoComponentIds.length > 0) {
                window.dispatchEvent(new CustomEvent('component-parts-incremented', {
                  detail: { componentIds: undoComponentIds, increment: -n }
                }));
                console.log(`[PassLog Undo] Dispatched component-parts-incremented event: -${n} for ${undoComponentIds.length} component(s)`);

                // Also revert localStorage fallback
                updateLocalStoragePartPasses(undoComponentIds, -n);
              }


              toast.success('Pass undone — pass log entry deleted and component passes reverted', { duration: 4000 });
              console.log('[PassLog Undo] Successfully reverted pass and component increments');

            } catch (err) {
              console.error('[PassLog Undo] Error:', err);
              toast.error('Failed to undo pass — some changes may not have been reverted');
            }
          };

          toast(`Pass logged — ${totalUpdated} component${totalUpdated !== 1 ? 's' : ''} updated`, {
            description: 'Click Undo within 10 seconds to reverse this action',
            duration: UNDO_WINDOW_MS + 500,
            action: {
              label: 'Undo',
              onClick: handleUndo,
            },
          });
        }
      } catch (err) {
        console.error('[PassLog AutoIncrement] Error:', err);
        // Don't block the pass save — this is a background enhancement
      }
    }

    setShowModal(false);
  };



  const handleToggleAborted = async (passId: string, currentAborted: boolean) => {
    try {
      await updatePassLog(passId, { aborted: !currentAborted });
      reportSuccess();
    } catch (err) {
      console.error('[PassLog] toggle aborted failed:', err);
      if (isConnectivityError(err)) {
        reportConnectivityError();
        toast.warning('Change saved locally — will sync when connection is restored');
      }
    }
  };

  // Delete a pass — undo toast is handled by AppContext
  const handleDelete = async (passId: string) => {
    try {
      await deletePassLog(passId);
      setExpandedPass(null);
      reportSuccess();
    } catch (err) {
      console.error('[PassLog] delete failed:', err);
      if (isConnectivityError(err)) {
        reportConnectivityError();
        toast.warning('Delete queued locally — will sync when connection is restored');
      } else {
        toast.error('Failed to delete pass');
      }
      setExpandedPass(null);
    }
  };

  // Bulk delete selected passes — calls deletePassLog for each selected pass sequentially
  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedPassIds);
    if (idsToDelete.length === 0) return;
    setBulkDeleting(true);
    let deletedCount = 0;
    let failedCount = 0;
    for (const passId of idsToDelete) {
      try {
        await deletePassLog(passId);
        deletedCount++;
      } catch (err) {
        console.error(`[PassLog BulkDelete] Failed to delete pass ${passId}:`, err);
        failedCount++;
      }
    }
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedPassIds(new Set());
    setExpandedPass(null);
    if (failedCount === 0) {
      toast.success(`Deleted ${deletedCount} pass${deletedCount !== 1 ? 'es' : ''} — all component passes reduced by ${deletedCount}`, { duration: 5000 });
    } else {
      toast.warning(`Deleted ${deletedCount} of ${idsToDelete.length} passes. ${failedCount} failed.`, { duration: 6000 });
    }
  };

  // Compute bulk delete summary for the confirmation modal
  const bulkDeleteSummary = useMemo(() => {
    if (selectedPassIds.size === 0) return { count: 0, dateRange: '', tracks: [], trackNames: '' };
    const selected = passLogs.filter(p => selectedPassIds.has(p.id));
    const dates = selected.map(p => p.date).sort();
    const tracks = [...new Set(selected.map(p => p.track))];
    return {
      count: selected.length,
      dateRange: dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] || '',
      tracks,
      trackNames: tracks.slice(0, 4).join(', ') + (tracks.length > 4 ? ` +${tracks.length - 4} more` : ''),
    };
  }, [selectedPassIds, passLogs]);



  // Toggle favorite status for a track
  const handleToggleFavorite = async (trackId: string, currentFavorite: boolean) => {
    await updateSavedTrack(trackId, { isFavorite: !currentFavorite });
  };

  // Delete a saved track
  const handleDeleteTrack = async (trackId: string) => {
    if (window.confirm('Are you sure you want to delete this saved track?')) {
      await deleteSavedTrack(trackId);
    }
  };


  const filteredPasses = passLogs.filter(pass => {
    const matchesSearch = 
      pass.track.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pass.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pass.date.includes(searchTerm);
    
    const matchesFilter = filterType === 'all' || pass.sessionType === filterType;
    
    return matchesSearch && matchesFilter;
  });



  const exportToCSV = () => {
    exportPassesToCSV(filteredPasses);
  };

  // Shared CSV export function — used by both the header Export button and the Advanced Search Export button
  const exportPassesToCSV = (passes: PassLogEntry[]) => {
    const headers = ['Date', 'Time', 'Track', 'Session', 'Lane', 'Result', 'RT', '60ft', '330ft', '1/8 ET', 'MPH', 'Temp', 'Humidity', 'Pressure', 'SAE', 'DA', 'Aborted', 'Notes'];
    const rows = passes.map(p => [
      p.date, p.time, p.track, p.sessionType, p.lane, p.result,
      p.reactionTime.toFixed(3), p.sixtyFoot.toFixed(3), p.threeThirty.toFixed(3),
      p.eighth.toFixed(3), p.mph.toFixed(1),
      p.weather.temperature, p.weather.humidity, p.weather.pressure.toFixed(2),
      p.saeCorrection.toFixed(3), p.densityAltitude, p.aborted ? 'Yes' : 'No', `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pass_log_${getLocalDateString()}.csv`;
    a.click();
  };

  // The passes actually displayed in the table: advanced search results take priority over basic filters
  const displayPasses = advancedFilteredPasses ?? filteredPasses;

  // Check if modal is in edit mode


  // Check if modal is in edit mode
  const isEditMode = editingPassId !== null;

  // Sort saved tracks: favorites first, then by visit count
  const sortedTracks = [...savedTracks].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.visitCount - a.visitCount;
  });

  // Pass selection handlers
  const handleTogglePassSelection = (passId: string) => {
    setSelectedPassIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(passId)) {
        newSet.delete(passId);
      } else {
        newSet.add(passId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPassIds.size === filteredPasses.length) {
      // Deselect all
      setSelectedPassIds(new Set());
    } else {
      // Select all filtered passes
      setSelectedPassIds(new Set(filteredPasses.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedPassIds(new Set());
  };

  const handleOpenComparison = () => {
    if (selectedPassIds.size >= 2) {
      setShowComparison(true);
    }
  };

  // Get selected passes for comparison
  const selectedPasses = passLogs.filter(p => selectedPassIds.has(p.id));

  return (
    <TooltipProvider>
      <section className="py-8 px-4">
        <div className="max-w-[1920px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Pass Log</h2>
              <p className="text-slate-400">Track every run with weather data and SAE correction</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTrackManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Manage Tracks
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Log Pass
              </button>
            </div>
          </div>

          {/* Selection Bar - Shows when passes are selected */}
          {selectedPassIds.size > 0 && (
            <div className="flex items-center justify-between p-4 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-400 font-medium">
                    {selectedPassIds.size} pass{selectedPassIds.size !== 1 ? 'es' : ''} selected
                  </span>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedPassIds.size})
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleOpenComparison}
                      disabled={selectedPassIds.size < 2}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedPassIds.size >= 2
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <GitCompare className="w-4 h-4" />
                      Compare
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                    {selectedPassIds.size < 2 ? (
                      <p className="text-sm">Select at least 2 passes to compare</p>
                    ) : (
                      <p className="text-sm">Compare {selectedPassIds.size} selected passes side-by-side</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Advanced Search & Filter Panel */}
          <PassLogAdvancedSearch
            passLogs={filteredPasses}
            onFilteredResults={(results) => setAdvancedFilteredPasses(results)}
            onExportCSV={(passes) => exportPassesToCSV(passes)}
          />

          {/* Quick Filters + View Mode Toggle */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search passes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="all">All Sessions</option>
              <option value="Test">Test</option>
              <option value="Qualifying">Qualifying</option>
              <option value="Eliminations">Eliminations</option>
              <option value="Match Race">Match Race</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'timeline' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Timeline
              </button>
            </div>
          </div>

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <PassLogTimeline passLogs={filteredPasses} />
          )}

          {/* Table View */}
          {viewMode === 'table' && (

          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-slate-700/50">
                    <th className="px-4 py-3 w-12">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleSelectAll}
                            className="flex items-center justify-center w-full"
                          >
                            {selectedPassIds.size === filteredPasses.length && filteredPasses.length > 0 ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                          <p className="text-sm">
                            {selectedPassIds.size === filteredPasses.length && filteredPasses.length > 0
                              ? 'Deselect all passes'
                              : 'Select all passes for comparison'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date/Time</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Track</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Session</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">RT</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">60'</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">330'</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">1/8 ET</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">MPH</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Result</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">SAE</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center gap-1 cursor-help">
                            Aborted
                            <Info className="w-3 h-3 text-slate-500" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                          <p className="text-sm">
                            When checked, this pass will NOT be included in Performance Analytics or Performance Trends calculations. 
                            However, it will still be counted in the total pass count for maintenance tracking and other functions.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPasses.map((pass) => (
                    <React.Fragment key={pass.id}>
                      <tr 
                        className={`border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer ${
                          pass.aborted ? 'opacity-60' : ''
                        } ${selectedPassIds.has(pass.id) ? 'bg-blue-500/10' : ''}`}
                        onClick={() => setExpandedPass(expandedPass === pass.id ? null : pass.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleTogglePassSelection(pass.id)}
                            className="flex items-center justify-center w-full"
                          >
                            {selectedPassIds.has(pass.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{pass.date}</p>
                          <p className="text-slate-400 text-sm">{pass.time}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{pass.track}</p>
                          <p className="text-slate-400 text-sm">{pass.location}</p>
                        </td>
                        <td className="px-4 py-3">

                          <span className="text-white">{pass.sessionType}</span>
                          {pass.round && <span className="text-slate-400 text-sm ml-1">({pass.round})</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`font-mono ${pass.reactionTime < 0 ? 'text-red-400 font-bold' : 'text-purple-400'}`}>
                              {pass.reactionTime.toFixed(3)}
                            </span>
                            {pass.reactionTime < 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-[10px] font-bold text-red-400 uppercase tracking-wider leading-none">
                                <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="12" r="5" />
                                </svg>
                                RL
                              </span>
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="text-white font-mono">{pass.sixtyFoot.toFixed(3)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-white font-mono">{pass.threeThirty.toFixed(3)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-400 font-mono font-bold">{pass.eighth.toFixed(3)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-blue-400 font-mono font-bold">{pass.mph.toFixed(1)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pass.result === 'Win' ? 'bg-green-500/20 text-green-400' :
                            pass.result === 'Loss' ? 'bg-red-500/20 text-red-400' :
                            pass.result === 'Red Light' ? 'bg-red-500/20 text-red-400' :
                            pass.result === 'Broke' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {pass.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-yellow-400 font-mono">{pass.saeCorrection.toFixed(3)}</span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={pass.aborted || false}
                                  onChange={() => handleToggleAborted(pass.id, pass.aborted || false)}
                                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900 cursor-pointer"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                              <p className="text-sm">
                                <strong>Aborted Pass:</strong> When checked, this pass data will NOT be included in Performance Analytics averages or Performance Trends graphs. 
                                The pass will still count toward total pass counts for maintenance tracking and component lifecycle management.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-3">
                          {expandedPass === pass.id ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {expandedPass === pass.id && (
                        <tr className="bg-slate-900/30">
                          <td colSpan={13} className="px-4 py-4">
                            <div className="grid md:grid-cols-4 gap-6">
                              {/* Weather */}
                              <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                  <Cloud className="w-4 h-4" />
                                  Weather Conditions
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Air Temp</span>
                                    <span className="text-white">{pass.weather.temperature}°F</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Track Temp</span>
                                    <span className="text-white">{pass.weather.trackTemp}°F</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Humidity</span>
                                    <span className="text-white">{pass.weather.humidity}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Barometer</span>
                                    <span className="text-white">{pass.weather.pressure.toFixed(2)}"</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Wind</span>
                                    <span className="text-white">{pass.weather.windSpeed} mph {pass.weather.windDirection}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Dew Point</span>
                                    <span className="text-cyan-300 font-mono">{calculateDewPoint(pass.weather.temperature, pass.weather.humidity).toFixed(1)}°F</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Vapor Pressure</span>
                                    <span className="text-cyan-300 font-mono">{calculateVaporPressure(pass.weather.temperature, pass.weather.humidity).toFixed(3)}" Hg</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Water Grains</span>
                                    <span className="text-cyan-300 font-mono">{calculateWaterGrains(pass.weather.temperature, pass.weather.humidity, pass.weather.pressure).toFixed(1)} gr/lb</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Wet Bulb</span>
                                    <span className="text-cyan-300 font-mono">{calculateWetBulb(pass.weather.temperature, pass.weather.humidity).toFixed(1)}°F</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                                    <span className="text-slate-400">Density Alt</span>
                                    <span className="text-white font-mono">{pass.densityAltitude} ft</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">SAE Correction</span>
                                    <span className="text-yellow-400 font-mono">{pass.saeCorrection.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">STD Correction</span>
                                    <span className="text-orange-300 font-mono">{calculateSTDCorrection(pass.weather.temperature, pass.weather.pressure, pass.weather.humidity).toFixed(4)}</span>
                                  </div>
                                </div>
                              </div>

                              
                              {/* Car Setup */}
                              <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                  <Gauge className="w-4 h-4" />
                                  Car Setup
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Wheelie Bar</span>
                                    <span className="text-white">{pass.wheelieBarSetting}"</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Front Tire</span>
                                    <span className="text-white">{pass.tirePressureFront} psi</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Rear L/R</span>
                                    <span className="text-white">{pass.tirePressureRearLeft}/{pass.tirePressureRearRight} psi</span>
                                  </div>
                                </div>
                              </div>

                              
                              {/* Equipment */}
                              <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-3">Equipment</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Engine</span>
                                    <span className="text-white">{engines.find(e => e.id === pass.engineId)?.name || 'Unknown'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Supercharger</span>
                                    <span className="text-white">{superchargers.find(s => s.id === pass.superchargerId)?.name || 'Unknown'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Lane</span>
                                    <span className="text-white">{pass.lane}</span>
                                  </div>


                                  {pass.aborted && (
                                    <div className="flex items-center gap-2 mt-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                                      <AlertCircle className="w-4 h-4 text-orange-400" />
                                      <span className="text-orange-400 text-xs">Aborted - Excluded from analytics</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Notes & Actions */}
                              <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-3">Notes</h4>
                                <p className="text-white text-sm mb-4">{pass.notes || 'No notes'}</p>
                                
                                {/* Split Times Display */}
                                <div className="space-y-2 mb-4">
                                  <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                                    <span className="text-xs text-slate-400">Front Split (330' - 60')</span>
                                    <span className="text-green-400 font-mono font-bold text-sm">
                                      {(pass.threeThirty - pass.sixtyFoot).toFixed(3)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                                    <span className="text-xs text-slate-400">Back Split (1/8 - 330')</span>
                                    <span className="text-green-400 font-mono font-bold text-sm">
                                      {(pass.eighth - pass.threeThirty).toFixed(3)}
                                    </span>
                                  </div>
                                  {pass.quarterMileET && pass.quarterMileET > 0 && pass.eighth > 0 && (
                                    <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                                      <span className="text-xs text-slate-400">1/4 Mile Back Split (1/4 ET - 1/8 ET)</span>
                                      <span className="text-green-400 font-mono font-bold text-sm">
                                        {(pass.endSplit && pass.endSplit > 0)
                                          ? pass.endSplit.toFixed(3)
                                          : (pass.quarterMileET - pass.eighth).toFixed(3)}
                                      </span>
                                    </div>
                                  )}



                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(pass);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Edit Pass
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmPassId(pass.id);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>

                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredPasses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-400">No passes found</p>
              </div>
            )}
          </div>
          )}
        </div>



        {/* Add/Edit Pass Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
            <div className="bg-slate-800 rounded-xl max-w-6xl w-full p-6 border border-slate-700">


              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {isEditMode ? 'Edit Pass' : 'Log New Pass'}
                  </h3>
                  {isEditMode && (
                    <p className="text-slate-400 text-sm mt-1">Editing pass {editingPassId}</p>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="font-medium text-white border-b border-slate-700 pb-2">Basic Info</h4>




                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Date</label>
                      <DateInputDark
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Time</label>
                      <TimeInputDark
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>


                  
                  {/* Saved Tracks Dropdown — uncontrolled via ref so selection always works */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1 flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      Select Saved Track
                    </label>
                    <select
                      ref={trackSelectRef}
                      defaultValue=""
                      onChange={(e) => handleTrackSelect(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">-- Select a saved track --</option>
                      {sortedTracks.length > 0 ? (
                        sortedTracks.map(track => (
                          <option key={track.id} value={track.id}>
                            {track.isFavorite ? '★ ' : ''}{track.name} - {track.location}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No saved tracks yet</option>
                      )}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      {savedTracks.length} saved track{savedTracks.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Track Name</label>
                    <input
                      type="text"
                      value={formData.track}
                      onChange={(e) => setFormData({...formData, track: e.target.value})}
                      placeholder="Track name"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  
                  {/* Location — separate City and State fields */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">City</label>
                    <input
                      type="text"
                      value={trackCity}
                      onChange={(e) => {
                        const newCity = e.target.value;
                        setTrackCity(newCity);
                        setFormData(prev => ({...prev, location: combineCityState(newCity, trackState)}));
                      }}
                      placeholder="e.g. Ennis"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">State</label>
                    <div className="flex gap-2">
                      <select
                        value={trackState}
                        onChange={(e) => {
                          const newState = e.target.value;
                          setTrackState(newState);
                          setFormData(prev => ({...prev, location: combineCityState(trackCity, newState)}));
                        }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="">-- Select State --</option>
                        {stateOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={handleSaveTrack}
                            disabled={savingTrack || !formData.track?.trim() || !formData.location?.trim()}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          >
                            {savingTrack ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                          <p className="text-sm">Save this track to your presets</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">City + State used for weather lookup</p>
                  </div>


                  {/* Track Save Success Message */}
                  {trackSaveSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-green-400 text-sm">{trackSaveSuccess}</span>
                    </div>
                  )}

                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Session</label>
                      <select
                        value={formData.sessionType}
                        onChange={(e) => setFormData({...formData, sessionType: e.target.value as PassLogEntry['sessionType']})}

                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="Test">Test</option>
                        <option value="Qualifying">Qualifying</option>
                        <option value="Eliminations">Eliminations</option>
                        <option value="Match Race">Match Race</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Round</label>
                      <input
                        type="text"
                        value={formData.round || ''}
                        onChange={(e) => setFormData({...formData, round: e.target.value})}
                        placeholder="Q1, R1, etc."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Lane</label>
                      <select
                        value={formData.lane}
                        onChange={(e) => setFormData({...formData, lane: e.target.value as PassLogEntry['lane']})}

                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="Left">Left</option>
                        <option value="Right">Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Result</label>
                      <select
                        value={formData.result}
                        onChange={(e) => setFormData({...formData, result: e.target.value as PassLogEntry['result']})}

                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="Win">Win</option>
                        <option value="Loss">Loss</option>
                        <option value="Single">Single</option>
                        <option value="Red Light">Red Light</option>
                        <option value="Broke">Broke</option>
                      </select>
                    </div>
                  </div>

                  {/* Aborted Pass Checkbox */}
                  <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.aborted || false}
                            onChange={(e) => setFormData({...formData, aborted: e.target.checked})}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-white text-sm flex items-center gap-2">
                            Aborted Pass
                            <Info className="w-4 h-4 text-slate-500" />
                          </span>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                        <p className="text-sm">
                          Check this if the pass was aborted (e.g., pedaled, shut off early, mechanical issue). 
                          Data will NOT be included in Performance Analytics or Trends, but WILL count toward total passes for maintenance tracking.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Performance Data */}
                <div className="space-y-4">
                  <h4 className="font-medium text-white border-b border-slate-700 pb-2">Performance</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm text-slate-400">Reaction Time</label>
                        {(formData.reactionTime ?? 0) < 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-[10px] font-bold text-red-400 uppercase tracking-wider animate-pulse">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Red Light
                          </span>
                        )}
                      </div>
                      {/* ═══════════════════════════════════════════════════════
                          TEXT INPUT for Reaction Time — allows negative values
                          ═══════════════════════════════════════════════════════
                          Uses type="text" with inputMode="decimal" instead of
                          type="number" because controlled number inputs prevent
                          typing "-" (the intermediate NaN blocks state updates).
                          The rtInputStr state holds the raw string; we parse to
                          a number and sync formData.reactionTime on every valid
                          keystroke, and clean up the display on blur.
                      */}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rtInputStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRtInputStr(val);
                          // Parse and sync to formData when the string is a valid number
                          // Allow intermediate states: "", "-", "-0", "-0.", "0.", etc.
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            setFormData(prev => ({...prev, reactionTime: num}));
                          }
                        }}
                        onBlur={() => {
                          // On blur, clean up the display to show the actual numeric value
                          const num = parseFloat(rtInputStr);
                          if (isNaN(num)) {
                            // If the string isn't a valid number (e.g. just "-"), reset to 0
                            setRtInputStr('0');
                            setFormData(prev => ({...prev, reactionTime: 0}));
                          } else {
                            // Normalize display (e.g. "-.005" → "-0.005")
                            setRtInputStr(String(num));
                          }
                        }}
                        className={`w-full bg-slate-900 rounded-lg px-3 py-2 font-mono ${
                          (formData.reactionTime ?? 0) < 0
                            ? 'border-2 border-red-500 text-red-400 ring-1 ring-red-500/30'
                            : 'border border-slate-600 text-white'
                        }`}
                        placeholder="0.000"
                      />
                      {(formData.reactionTime ?? 0) < 0 && (
                        <p className="text-[11px] text-red-400/80 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Foul start — negative RT recorded
                        </p>
                      )}
                    </div>


                    <div>
                      <label className="block text-sm text-slate-400 mb-1">60' Time</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.sixtyFoot}
                        onChange={(e) => setFormData({...formData, sixtyFoot: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">330' Time</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.threeThirty}
                        onChange={(e) => setFormData({...formData, threeThirty: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                      />
                      {/* Front Split - 330' minus 60' */}
                      <div className="mt-2 p-2 bg-slate-900/70 border border-green-500/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Front Split</span>
                          <span className="text-green-400 font-mono font-bold text-sm">
                            {((formData.threeThirty || 0) - (formData.sixtyFoot || 0)).toFixed(3)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">330' - 60'</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">1/8 Mile ET</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.eighth}
                        onChange={(e) => setFormData({...formData, eighth: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                      />
                      {/* Back Split - 1/8 ET minus 330' */}
                      <div className="mt-2 p-2 bg-slate-900/70 border border-green-500/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Back Split</span>
                          <span className="text-green-400 font-mono font-bold text-sm">
                            {((formData.eighth || 0) - (formData.threeThirty || 0)).toFixed(3)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">1/8 ET - 330'</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">1/8 Mile MPH</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.mph}
                      onChange={(e) => setFormData({...formData, mph: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>

                  {/* Quarter Mile Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">1/4 Mile ET</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.quarterMileET || ''}
                        onChange={(e) => {
                          const qmET = parseFloat(e.target.value) || 0;
                          const endSplit = qmET > 0 && (formData.eighth || 0) > 0 ? qmET - (formData.eighth || 0) : 0;
                          setFormData({...formData, quarterMileET: qmET, endSplit: endSplit > 0 ? Math.round(endSplit * 1000) / 1000 : 0});
                        }}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                        placeholder="0.000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">1/4 Mile MPH</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.quarterMileMPH || ''}
                        onChange={(e) => setFormData({...formData, quarterMileMPH: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {/* 1/4 Mile Back Split - always visible, matches Front/Back Split styling */}
                  <div className="p-2 bg-slate-900/70 border border-green-500/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">1/4 Mile Back Split</span>
                      <span className="text-green-400 font-mono font-bold text-sm">
                        {((formData.quarterMileET || 0) - (formData.eighth || 0)).toFixed(3)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">1/4 ET - 1/8 ET</p>
                  </div>




                  <h4 className="font-medium text-white border-b border-slate-700 pb-2 pt-2">Car Setup</h4>


                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Front PSI</label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.tirePressureFront}
                        onChange={(e) => setFormData({...formData, tirePressureFront: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Rear L PSI</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.tirePressureRearLeft}
                        onChange={(e) => setFormData({...formData, tirePressureRearLeft: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Rear R PSI</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.tirePressureRearRight}
                        onChange={(e) => setFormData({...formData, tirePressureRearRight: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {/* Track Temp & Wheelie Bar — moved below tire pressure */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Track Temp (°F)</label>
                      <input
                        type="number"
                        value={formData.weather?.trackTemp}
                        onChange={(e) => setFormData({...formData, weather: {...formData.weather!, trackTemp: parseInt(e.target.value) || 0}})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Wheelie Bar Setting</label>
                      <input
                        type="number"
                        step="0.25"
                        value={formData.wheelieBarSetting}
                        onChange={(e) => setFormData({...formData, wheelieBarSetting: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                </div>

                {/* Weather & Notes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">Weather / SAE</h4>
                      {isDateInPast() && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                          <History className="w-3 h-3" />
                          Historical
                        </span>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={fetchWeather}
                          disabled={fetchingWeather}
                          className={`flex items-center gap-2 px-3 py-1.5 text-white text-sm rounded-lg transition-colors ${
                            isDateInPast() 
                              ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800' 
                              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800'
                          } disabled:cursor-not-allowed`}
                        >
                          {fetchingWeather ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {isHistoricalFetch ? 'Loading History...' : 'Fetching...'}
                            </>
                          ) : (
                            <>
                              {isDateInPast() ? (
                                <>
                                  <History className="w-4 h-4" />
                                  Fetch Historical
                                </>
                              ) : (
                                <>
                                  <CloudSun className="w-4 h-4" />
                                  Fetch Weather
                                </>
                              )}
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                        {isDateInPast() ? (
                          <p className="text-sm">
                            <strong>Historical Weather:</strong> Fetch weather conditions from {formData.date} at approximately {formData.time}. 
                            This retrieves archived weather data for accurate SAE correction when logging passes retroactively.
                          </p>
                        ) : (
                          <p className="text-sm">
                            Automatically fetch current weather conditions from the track location. 
                            This will populate temperature, humidity, barometer, wind data, and calculate SAE correction.
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Historical Weather Notice */}
                  {isDateInPast() && !weatherSuccess && !weatherError && (
                    <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <History className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-purple-400 text-sm">
                        Past date detected. Click "Fetch Historical" to retrieve weather data from {formData.date}.
                      </span>
                    </div>
                  )}
                  {/* Weather Status Messages */}
                  {weatherError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-red-400 text-sm flex-1">{weatherError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setWeatherError(null);
                          fetchWeather();
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded hover:bg-red-500/30 transition-colors flex-shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}
                  
                  {weatherSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      {weatherSuccess.includes('Historical') ? (
                        <History className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <CloudSun className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                      <span className="text-green-400 text-sm">{weatherSuccess}</span>
                    </div>
                  )}


                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      <Thermometer className="w-3 h-3 inline mr-1" />
                      Air Temp (°F)
                    </label>
                    <input
                      type="number"
                      value={formData.weather?.temperature}
                      onChange={(e) => setFormData({...formData, weather: {...formData.weather!, temperature: parseInt(e.target.value) || 0}})}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Droplets className="w-3 h-3 inline mr-1" />
                        Humidity (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.weather?.humidity}
                        onChange={(e) => setFormData({...formData, weather: {...formData.weather!, humidity: parseInt(e.target.value) || 0}})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Gauge className="w-3 h-3 inline mr-1" />
                        Barometer (inHg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.weather?.pressure}
                        onChange={(e) => setFormData({...formData, weather: {...formData.weather!, pressure: parseFloat(e.target.value) || 29.92}})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Wind className="w-3 h-3 inline mr-1" />
                        Wind Speed (mph)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.weather?.windSpeed}
                        onChange={(e) => setFormData({...formData, weather: {...formData.weather!, windSpeed: parseInt(e.target.value) || 0}})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Wind Direction</label>
                      <select
                        value={formData.weather?.windDirection}
                        onChange={(e) => setFormData({...formData, weather: {...formData.weather!, windDirection: e.target.value}})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="N">N</option>
                        <option value="NNE">NNE</option>
                        <option value="NE">NE</option>
                        <option value="ENE">ENE</option>
                        <option value="E">E</option>
                        <option value="ESE">ESE</option>
                        <option value="SE">SE</option>
                        <option value="SSE">SSE</option>
                        <option value="S">S</option>
                        <option value="SSW">SSW</option>
                        <option value="SW">SW</option>
                        <option value="WSW">WSW</option>
                        <option value="W">W</option>
                        <option value="WNW">WNW</option>
                        <option value="NW">NW</option>
                        <option value="NNW">NNW</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      <Cloud className="w-3 h-3 inline mr-1" />
                      Conditions
                    </label>
                    <select
                      value={formData.weather?.conditions}
                      onChange={(e) => setFormData({...formData, weather: {...formData.weather!, conditions: e.target.value}})}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="Clear">Clear</option>
                      <option value="Sunny">Sunny</option>
                      <option value="Partly Cloudy">Partly Cloudy</option>
                      <option value="Cloudy">Cloudy</option>
                      <option value="Overcast">Overcast</option>
                      <option value="Light Rain">Light Rain</option>
                      <option value="Humid">Humid</option>
                      <option value="Mist">Mist</option>
                      <option value="Fog">Fog</option>
                    </select>
                  </div>
                  
                  {/* SAE Calculation Display */}
                  <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                      <span className="text-yellow-400 font-medium">SAE Correction</span>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 font-bold font-mono">{formData.saeCorrection?.toFixed(3)}</span>
                        <button
                          type="button"
                          onClick={calculateSAE}
                          className="p-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                          title="Recalculate SAE"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">STD Correction</span>
                      <span className="text-orange-300 font-mono font-bold">
                        {calculateSTDCorrection(
                          formData.weather?.temperature || 70,
                          formData.weather?.pressure || 29.92,
                          formData.weather?.humidity || 50
                        ).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Density Altitude</span>
                      <span className="text-white font-mono">{formData.densityAltitude} ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Corrected HP</span>
                      <span className="text-white font-mono">{formData.correctedHP}</span>
                    </div>
                    {trackElevation > 0 && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-700/30 mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-slate-500 flex items-center gap-1 cursor-help">
                              <Mountain className="w-3 h-3" />
                              Track Elev.
                              <Info className="w-3 h-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                            <p className="text-sm">
                              Track elevation from saved track settings. Used to convert the weather API's sea-level barometric pressure to station pressure for accurate DA calculation — matching your Computech/RaceAir readings.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-orange-400/80 font-mono text-xs">{trackElevation.toLocaleString()} ft</span>
                      </div>
                    )}
                    {trackElevation === 0 && (
                      <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                        Set track elevation in Manage Tracks for accurate DA
                      </p>
                    )}
                    </div>

                  {/* Calculated Weather Data */}
                  <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="text-cyan-400 font-medium border-b border-slate-700 pb-2 mb-2">Calculated Weather</div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dew Point</span>
                      <span className="text-white font-mono">
                        {calculateDewPoint(
                          formData.weather?.temperature || 70,
                          formData.weather?.humidity || 50
                        ).toFixed(1)}°F
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vapor Pressure</span>
                      <span className="text-white font-mono">
                        {calculateVaporPressure(
                          formData.weather?.temperature || 70,
                          formData.weather?.humidity || 50
                        ).toFixed(3)}" Hg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Water Grains</span>
                      <span className="text-white font-mono">
                        {calculateWaterGrains(
                          formData.weather?.temperature || 70,
                          formData.weather?.humidity || 50,
                          formData.weather?.pressure || 29.92
                        ).toFixed(1)} gr/lb
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Wet Bulb</span>
                      <span className="text-white font-mono">
                        {calculateWetBulb(
                          formData.weather?.temperature || 70,
                          formData.weather?.humidity || 50
                        ).toFixed(1)}°F
                      </span>
                    </div>
                  </div>

                  


                  


                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Auto-increment toggle + action buttons */}
              {!isEditMode && (
                <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 mt-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <div
                          onClick={() => setAutoIncrementParts(!autoIncrementParts)}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${autoIncrementParts ? 'bg-green-500' : 'bg-slate-600'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoIncrementParts ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          <Package className="w-4 h-4 text-orange-400" />
                          Auto-update standalone parts (+1 pass)
                        </span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-white">
                      <p className="text-sm">
                        When enabled, saving a new pass will automatically add +1 to the pass count on every standalone part 
                        across all currently-installed components (engines, power adders, transmissions, etc.). 
                        You can adjust individual part passes later in Main Components. This setting is remembered between sessions.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  {isEditMode ? 'Update Pass' : 'Save Pass'}
                </button>
              </div>

            </div>
            </div>
          </div>
        )}


        {/* Track Manager Modal */}
        {showTrackManager && (
          <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
              <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Manage Saved Tracks</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      {savedTracks.length} saved track{savedTracks.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button onClick={() => setShowTrackManager(false)} className="text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {savedTracks.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">No saved tracks yet</p>
                    <p className="text-slate-500 text-sm">
                      When logging a pass, enter a track name and location, then click the save button to add it to your presets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {sortedTracks.map(track => (
                      <div 
                        key={track.id}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium">{track.name}</h4>
                            {track.isFavorite && (
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                          <p className="text-slate-400 text-sm">{track.location}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span>{track.visitCount} visit{track.visitCount !== 1 ? 's' : ''}</span>
                            {track.lastVisited && (
                              <span>Last: {track.lastVisited}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleFavorite(track.id, track.isFavorite)}
                            className={`p-2 rounded-lg transition-colors ${
                              track.isFavorite 
                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                            title={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(track.id)}
                            className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                            title="Delete track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-end mt-6 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setShowTrackManager(false)}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Pass Comparison Modal */}
        {showComparison && selectedPasses.length >= 2 && (
          <PassComparison
            selectedPasses={selectedPasses}
            engines={engines}
            superchargers={superchargers}
            onClose={() => setShowComparison(false)}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* DELETE PASS CONFIRMATION MODAL — Large Red Alert */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {deleteConfirmPassId && (() => {
          const passToDelete = passLogs.find(p => p.id === deleteConfirmPassId);
          return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setDeleteConfirmPassId(null)}>
              <div
                className="bg-slate-900 rounded-2xl max-w-md w-full border-2 border-red-500/60 shadow-2xl shadow-red-500/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Red Header Bar */}
                <div className="bg-red-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-wide">ARE YOU SURE?</h3>
                      <p className="text-red-100 text-sm font-medium">This action will reduce all component passes</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  {/* Pass Info */}
                  {passToDelete && (
                    <div className="bg-slate-800 rounded-xl p-4 mb-5 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-lg">{passToDelete.track}</span>
                        <span className="text-slate-400 text-sm">{passToDelete.date}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-400 font-mono font-bold">{passToDelete.eighth.toFixed(3)} ET</span>
                        <span className="text-blue-400 font-mono font-bold">{passToDelete.mph.toFixed(1)} MPH</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          passToDelete.result === 'Win' ? 'bg-green-500/20 text-green-400' :
                          passToDelete.result === 'Loss' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {passToDelete.result}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Warning Message */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
                    <p className="text-red-300 text-sm leading-relaxed">
                      <strong className="text-red-400">Deleting this pass will:</strong>
                    </p>
                    <ul className="mt-2 space-y-1.5 text-red-300/90 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 font-bold mt-0.5">-1</span>
                        <span>Reduce passes on all installed engines, power adders, and drivetrain components</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 font-bold mt-0.5">-1</span>
                        <span>Reduce passes on all standalone parts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 font-bold mt-0.5">-1</span>
                        <span>Reduce passes on all maintenance items</span>
                      </li>
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirmPassId(null)}
                      className="flex-1 px-5 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-colors text-base"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(deleteConfirmPassId);
                        setDeleteConfirmPassId(null);
                      }}
                      className="flex-1 px-5 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 text-base"
                    >
                      <Trash2 className="w-5 h-5" />
                      Confirm Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BULK DELETE CONFIRMATION MODAL — Large Red Alert */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => !bulkDeleting && setShowBulkDeleteConfirm(false)}>
            <div
              className="bg-slate-900 rounded-2xl max-w-lg w-full border-2 border-red-500/60 shadow-2xl shadow-red-500/20 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red Header Bar */}
              <div className="bg-red-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-wide">ARE YOU SURE?</h3>
                    <p className="text-red-100 text-sm font-medium">
                      You are about to delete {bulkDeleteSummary.count} pass{bulkDeleteSummary.count !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                {/* Summary */}
                <div className="bg-slate-800 rounded-xl p-4 mb-5 border border-slate-700">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-slate-500 text-xs block">Passes to Delete</span>
                      <span className="text-red-400 font-bold text-2xl">{bulkDeleteSummary.count}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Date Range</span>
                      <span className="text-white text-sm font-medium">{bulkDeleteSummary.dateRange}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block mb-1">Tracks</span>
                    <span className="text-slate-300 text-sm">{bulkDeleteSummary.trackNames}</span>
                  </div>
                </div>

                {/* Warning Message */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
                  <p className="text-red-300 text-sm leading-relaxed">
                    <strong className="text-red-400">Deleting {bulkDeleteSummary.count} passes will:</strong>
                  </p>
                  <ul className="mt-2 space-y-1.5 text-red-300/90 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold mt-0.5">-{bulkDeleteSummary.count}</span>
                      <span>passes on all installed engines, power adders, and drivetrain components</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold mt-0.5">-{bulkDeleteSummary.count}</span>
                      <span>passes on all standalone parts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold mt-0.5">-{bulkDeleteSummary.count}</span>
                      <span>passes on all maintenance items</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    disabled={bulkDeleting}
                    className="flex-1 px-5 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-colors text-base disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex-1 px-5 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 text-base disabled:opacity-50"
                  >
                    {bulkDeleting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Confirm Delete {bulkDeleteSummary.count} Passes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </section>

    </TooltipProvider>
  );
};

export default PassLog;
