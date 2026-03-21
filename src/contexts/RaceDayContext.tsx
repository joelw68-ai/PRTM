import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWeatherForWidget, WeatherWidgetData } from '@/lib/weather';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';
import { RaceEvent } from '@/components/race/RaceCalendar';

// ─── Constants ───────────────────────────────────────────────────────────────
const RACE_DAY_MODE_KEY = 'promod_race_day_mode';
const RACE_DAY_WEATHER_KEY = 'promod_race_day_weather';
const RACE_DAY_POLL_MS = 5 * 60 * 1000; // 5 minutes
const NORMAL_POLL_MS = 15 * 60 * 1000;   // 15 minutes (default)

// ─── Types ───────────────────────────────────────────────────────────────────
interface RaceDayContextType {
  isRaceDayMode: boolean;
  toggleRaceDayMode: () => void;
  enableRaceDayMode: () => void;
  disableRaceDayMode: () => void;
  currentRaceEvent: RaceEvent | null;
  weatherSummary: WeatherSummary | null;
  todayPassCount: number;
  totalPassCount: number;
  isWeatherLoading: boolean;
  weatherError: string | null;
  refreshWeather: () => void;
  raceDaySections: string[];
}

interface WeatherSummary {
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  saeCorrection: number;
  densityAltitude: number;
  pressure: number;
  location: string;
  lastUpdated: string;
}

const RaceDayContext = createContext<RaceDayContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
export const RaceDayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { raceEvents, passLogs, savedTracks } = useApp();
  const { profile, user, effectiveUserId, isAuthenticated, isDemoMode } = useAuth();

  // Persist mode in localStorage
  const [isRaceDayMode, setIsRaceDayMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RACE_DAY_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [weatherSummary, setWeatherSummary] = useState<WeatherSummary | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const weatherIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  // ─── Sections available in Race Day Mode ─────────────────────────────────
  const raceDaySections = ['teamdash', 'passlog', 'checklists', 'timeline'];


  // ─── Toggle ──────────────────────────────────────────────────────────────
  const toggleRaceDayMode = useCallback(() => {
    setIsRaceDayMode(prev => {
      const next = !prev;
      try { localStorage.setItem(RACE_DAY_MODE_KEY, String(next)); } catch {}
      if (next) {
        toast.success('Race Day Mode Activated', {
          description: 'Streamlined interface with live weather updates every 5 minutes.',
          duration: 4000,
        });
      } else {
        toast.info('Race Day Mode Deactivated', {
          description: 'Full navigation restored.',
          duration: 3000,
        });
      }
      return next;
    });
  }, []);

  const enableRaceDayMode = useCallback(() => {
    setIsRaceDayMode(true);
    try { localStorage.setItem(RACE_DAY_MODE_KEY, 'true'); } catch {}
  }, []);

  const disableRaceDayMode = useCallback(() => {
    setIsRaceDayMode(false);
    try { localStorage.setItem(RACE_DAY_MODE_KEY, 'false'); } catch {}
  }, []);

  // ─── Current Race Event (today) ──────────────────────────────────────────
  const currentRaceEvent: RaceEvent | null = React.useMemo(() => {
    const today = getLocalDateString();
    // Find an event where today falls between startDate and endDate
    const active = raceEvents.find(e => {
      const end = e.endDate || e.startDate;
      return today >= e.startDate && today <= end && e.status !== 'Cancelled';
    });
    if (active) return active;

    // If no active event, find the next upcoming event
    const upcoming = raceEvents
      .filter(e => e.startDate >= today && e.status !== 'Cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return upcoming[0] || null;
  }, [raceEvents]);

  // ─── Today's Pass Count ──────────────────────────────────────────────────
  const today = getLocalDateString();
  const todayPassCount = React.useMemo(() => {
    return passLogs.filter(p => p.date === today).length;
  }, [passLogs, today]);

  const totalPassCount = passLogs.length;

  // ─── Weather Location Resolution ─────────────────────────────────────────
  const getWeatherLocation = useCallback((): string | null => {
    // Priority 1: Current race event track location / zip
    if (currentRaceEvent) {
      if (currentRaceEvent.trackZip) return currentRaceEvent.trackZip;
      if (currentRaceEvent.trackLocation) return currentRaceEvent.trackLocation;
      if (currentRaceEvent.trackName) return currentRaceEvent.trackName;
    }

    // Priority 2: Home track from profile
    if (profile?.homeTrack) {
      // Try to resolve from saved tracks
      const htLower = profile.homeTrack.toLowerCase().trim();
      const match = savedTracks.find(t => {
        const tName = t.name.toLowerCase().trim();
        return tName === htLower || tName.includes(htLower) || htLower.includes(tName);
      });
      if (match) {
        if (match.zip) return match.zip;
        if (match.city && match.state) return `${match.city}, ${match.state}`;
        if (match.location) return match.location;
      }
      return profile.homeTrack;
    }

    // Priority 3: IP-based
    return 'auto:ip';
  }, [currentRaceEvent, profile?.homeTrack, savedTracks]);

  // ─── Weather Fetch ───────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    const location = getWeatherLocation();
    if (!location) return;

    setIsWeatherLoading(true);
    try {
      const data: WeatherWidgetData = await fetchWeatherForWidget(location);
      if (!mountedRef.current) return;

      const summary: WeatherSummary = {
        temperature: data.temperature,
        conditions: data.conditions,
        humidity: data.humidity,
        windSpeed: data.windSpeed,
        windDirection: data.windDirection,
        saeCorrection: data.saeCorrection,
        densityAltitude: data.densityAltitude,
        pressure: data.pressure,
        location: data.location + (data.region ? `, ${data.region}` : ''),
        lastUpdated: new Date().toISOString(),
      };

      setWeatherSummary(summary);
      setWeatherError(null);

      // Cache
      try {
        localStorage.setItem(RACE_DAY_WEATHER_KEY, JSON.stringify(summary));
      } catch {}
    } catch (err: any) {
      if (mountedRef.current) {
        setWeatherError(err?.message || 'Weather unavailable');
      }
    } finally {
      if (mountedRef.current) {
        setIsWeatherLoading(false);
      }
    }
  }, [getWeatherLocation]);

  const refreshWeather = useCallback(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Load cached weather on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(RACE_DAY_WEATHER_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as WeatherSummary;
        setWeatherSummary(parsed);
      }
    } catch {}
  }, []);

  // ─── Weather Polling ─────────────────────────────────────────────────────
  // When Race Day Mode is active: poll every 5 minutes
  // Otherwise: poll every 15 minutes (or don't poll at all if not active)
  useEffect(() => {
    // Clear existing interval
    if (weatherIntervalRef.current) {
      clearInterval(weatherIntervalRef.current);
      weatherIntervalRef.current = null;
    }

    // Fetch immediately when mode changes
    if (isRaceDayMode) {
      fetchWeather();
    }

    const interval = isRaceDayMode ? RACE_DAY_POLL_MS : NORMAL_POLL_MS;

    weatherIntervalRef.current = setInterval(() => {
      if (mountedRef.current && document.visibilityState === 'visible') {
        fetchWeather();
      }
    }, interval);

    return () => {
      if (weatherIntervalRef.current) {
        clearInterval(weatherIntervalRef.current);
        weatherIntervalRef.current = null;
      }
    };
  }, [isRaceDayMode, fetchWeather]);

  // ─── Realtime Toast Notifications for Team Activity Feed ─────────────────
  // When Race Day Mode is active, subscribe to team_activity_feed inserts
  // and show toast notifications so crew members see updates on any page.
  useEffect(() => {
    // Clean up previous channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    if (!isRaceDayMode) return;

    const userId = effectiveUserId || user?.id;
    if (!userId && !isDemoMode) return;

    const channel = supabase
      .channel('race-day-activity-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_activity_feed',
          ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (payload: any) => {
          const record = payload.new;
          if (!record || !mountedRef.current) return;

          const actionType = record.action_type || 'update';
          const actorName = record.actor_name || 'Team Member';
          const description = record.description || '';
          const actorRole = record.actor_role || '';

          // Determine toast style based on action type
          const roleLabel = actorRole ? ` (${actorRole})` : '';

          switch (actionType) {
            case 'pass_logged':
              toast.info(`${actorName}${roleLabel} logged a pass`, {
                description: description || 'New pass recorded',
                duration: 5000,
              });
              break;
            case 'maintenance_completed':
              toast.success(`${actorName}${roleLabel} completed maintenance`, {
                description: description || 'Maintenance item marked complete',
                duration: 5000,
              });
              break;
            case 'parts_used':
              toast.info(`${actorName}${roleLabel} used parts`, {
                description: description || 'Parts inventory updated',
                duration: 4000,
              });
              break;
            case 'checklist_completed':
              toast.success(`${actorName}${roleLabel} completed a checklist`, {
                description: description || 'Checklist finished',
                duration: 5000,
              });
              break;
            case 'weather_alert':

              toast.warning(`Weather Alert`, {
                description: description || 'Weather conditions have changed',
                duration: 8000,
              });
              break;
            default:
              toast.info(`${actorName}${roleLabel}: ${actionType}`, {
                description: description || undefined,
                duration: 4000,
              });
              break;
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [isRaceDayMode, effectiveUserId, user?.id, isDemoMode]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <RaceDayContext.Provider
      value={{
        isRaceDayMode,
        toggleRaceDayMode,
        enableRaceDayMode,
        disableRaceDayMode,
        currentRaceEvent,
        weatherSummary,
        todayPassCount,
        totalPassCount,
        isWeatherLoading,
        weatherError,
        refreshWeather,
        raceDaySections,
      }}
    >
      {children}
    </RaceDayContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────
export const useRaceDay = () => {
  const context = useContext(RaceDayContext);
  if (!context) {
    throw new Error('useRaceDay must be used within RaceDayProvider');
  }
  return context;
};
