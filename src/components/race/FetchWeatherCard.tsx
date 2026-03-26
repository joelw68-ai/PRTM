import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  Loader2,
  MapPin,
  CloudFog,
  Snowflake,
  Crosshair,
  RefreshCw,
  X,
  AlertTriangle,
  AlertCircle,
  Globe,
  Wifi,
  Search,
  RotateCcw,
} from 'lucide-react';
import { fetchWeatherData, calculateDewPoint, isWeatherConfigured } from '@/lib/weather';


interface FetchWeatherCardProps {}

interface LocalWeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  location: string;
  region: string;
  dewPoint: number;
  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
}

const FETCH_WEATHER_CACHE_KEY = 'promod_fetch_weather_cache';
const FETCH_WEATHER_CACHE_VERSION_KEY = 'promod_fetch_weather_cache_version';
const FETCH_WEATHER_CACHE_VERSION = 'v4_manual_location'; // Bump this to invalidate old caches
const FETCH_WEATHER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const GPS_TIMEOUT = 20000; // 20 seconds — high-accuracy GPS needs more time
const WIFI_TIMEOUT = 10000; // 10 seconds — Wi-Fi/cell positioning is faster
const MANUAL_LOCATION_KEY = 'promod_fetch_weather_manual_location';

// Location method describes how the browser determined the user's position
type LocationSource = 'gps' | 'wifi' | 'ip' | 'manual';

// ── Smart geolocation with GPS → Wi-Fi fallback ──────────────────────────────
// Tries high-accuracy (GPS hardware) first.  If that times out (common on
// desktops without GPS), automatically retries with enableHighAccuracy: false
// which uses Wi-Fi triangulation / cell towers — still much better than IP.
function getPositionWithFallback(): Promise<{ position: GeolocationPosition; method: 'gps' | 'wifi' }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    // ── Attempt 1: High-accuracy GPS ──
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const acc = position.coords.accuracy;
        const method = acc <= 100 ? 'gps' as const : 'wifi' as const;
        console.log(`[FetchWeatherGeo] High-accuracy position acquired (${acc.toFixed(0)}m) → method: ${method}`);
        resolve({ position, method });
      },
      (gpsError) => {
        if (gpsError.code === 3) {
          // TIMEOUT — GPS hardware not available or too slow (common on desktops)
          console.log('[FetchWeatherGeo] High-accuracy GPS timed out — falling back to Wi-Fi/cell positioning...');

          // ── Attempt 2: Wi-Fi / cell tower positioning ──
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const acc = position.coords.accuracy;
              console.log(`[FetchWeatherGeo] Wi-Fi/cell position acquired (${acc.toFixed(0)}m)`);
              resolve({ position, method: 'wifi' });
            },
            (wifiError) => {
              console.warn('[FetchWeatherGeo] Wi-Fi/cell positioning also failed:', wifiError.message, '(code:', wifiError.code, ')');
              reject(wifiError);
            },
            {
              enableHighAccuracy: false,
              timeout: WIFI_TIMEOUT,
              maximumAge: 0,
            }
          );
        } else {
          // PERMISSION_DENIED (1) or POSITION_UNAVAILABLE (2) — no point retrying
          console.warn('[FetchWeatherGeo] Geolocation error (no fallback):', gpsError.message, '(code:', gpsError.code, ')');
          reject(gpsError);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT,
        maximumAge: 0,
      }
    );
  });
}


// Get weather icon component based on conditions
const getWeatherIcon = (conditions: string, size: string = 'w-6 h-6') => {
  const lower = conditions.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return <CloudRain className={`${size} text-blue-400`} />;
  if (lower.includes('fog') || lower.includes('mist')) return <CloudFog className={`${size} text-slate-400`} />;
  if (lower.includes('snow') || lower.includes('sleet')) return <Snowflake className={`${size} text-blue-200`} />;
  if (lower.includes('overcast')) return <Cloud className={`${size} text-slate-400`} />;
  if (lower.includes('cloudy') || lower.includes('partly')) return <CloudSun className={`${size} text-yellow-400`} />;
  if (lower.includes('clear') || lower.includes('sunny')) return <Sun className={`${size} text-yellow-400`} />;
  return <CloudSun className={`${size} text-slate-300`} />;
};

// ── Location source badge ─────────────────────────────────────────────────────
const LocationSourceBadge: React.FC<{ source: LocationSource }> = ({ source }) => {
  if (source === 'gps') {
    return (
      <span
        className="text-[10px] text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"
        title="Precise GPS location (satellite positioning)"
      >
        <Crosshair className="w-2.5 h-2.5" />
        GPS
      </span>
    );
  }
  if (source === 'wifi') {
    return (
      <span
        className="text-[10px] text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"
        title="Wi-Fi / cell tower location (GPS hardware unavailable)"
      >
        <Wifi className="w-2.5 h-2.5" />
        Wi-Fi
      </span>
    );
  }
  if (source === 'manual') {
    return (
      <span
        className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"
        title="Manually entered location"
      >
        <MapPin className="w-2.5 h-2.5" />
        Manual
      </span>
    );
  }
  // 'ip'
  return (
    <span
      className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"
      title="Approximate IP-based location"
    >
      <Globe className="w-2.5 h-2.5" />
      IP
    </span>
  );
};


// ── Manual location input form ────────────────────────────────────────────────
const ManualLocationForm: React.FC<{
  onSubmit: (location: string) => void;
  isLoading: boolean;
  error: string | null;
  compact?: boolean;
}> = ({ onSubmit, isLoading, error, compact }) => {
  const [input, setInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) {
      setValidationError('Please enter a city/state or zip code.');
      return;
    }
    if (trimmed.length < 2) {
      setValidationError('Location must be at least 2 characters.');
      return;
    }

    setValidationError(null);
    onSubmit(trimmed);
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setValidationError(null); }}
            placeholder="City, ST or zip..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
          Go
        </button>
        {(validationError || error) && (
          <span className="text-xs text-red-400 whitespace-nowrap">{validationError || error}</span>
        )}
      </form>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-slate-300">Enter location manually</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setValidationError(null); }}
            placeholder="e.g. Hartsville, SC  or  29550"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            disabled={isLoading}
          />
        </div>
        {(validationError || error) && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {validationError || error}
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          Fetch Weather
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Enter a city &amp; state, zip code, or airport code
        </p>
      </form>
    </div>
  );
};


const FetchWeatherCard: React.FC<FetchWeatherCardProps> = () => {
  const [weatherData, setWeatherData] = useState<LocalWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle');
  const [locationSource, setLocationSource] = useState<LocationSource>('ip');
  const [manualLocationError, setManualLocationError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [savedManualLocation, setSavedManualLocation] = useState<string | null>(null);
  const autoFetchedRef = useRef(false);

  // ── Load saved manual location on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MANUAL_LOCATION_KEY);
      if (saved) {
        setSavedManualLocation(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Invalidate stale cache on version mismatch & load cached data on mount ──
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem(FETCH_WEATHER_CACHE_VERSION_KEY);

      if (storedVersion !== FETCH_WEATHER_CACHE_VERSION) {
        console.log('[FetchWeatherCard] Cache version mismatch — clearing stale weather cache',
          { stored: storedVersion, current: FETCH_WEATHER_CACHE_VERSION });
        localStorage.removeItem(FETCH_WEATHER_CACHE_KEY);
        localStorage.setItem(FETCH_WEATHER_CACHE_VERSION_KEY, FETCH_WEATHER_CACHE_VERSION);
        return;
      }

      const cached = localStorage.getItem(FETCH_WEATHER_CACHE_KEY);
      if (cached) {
        const { data, timestamp, source } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < FETCH_WEATHER_CACHE_DURATION && data) {
          setWeatherData(data);
          setLastFetchTime(new Date(timestamp));
          setFetchStatus('done');
          if (source) setLocationSource(source);
        }
      }
    } catch {
      // Ignore cache errors
    }
  }, []);


  // Auto-fetch weather on mount — use saved manual location, or IP
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!isWeatherConfigured()) return;

    // If we already have fresh cached data, skip auto-fetch
    try {
      const cached = localStorage.getItem(FETCH_WEATHER_CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < FETCH_WEATHER_CACHE_DURATION) {
          autoFetchedRef.current = true;
          return;
        }
      }
    } catch {
      // ignore
    }

    autoFetchedRef.current = true;

    // Check for saved manual location first
    try {
      const savedManual = localStorage.getItem(MANUAL_LOCATION_KEY);
      if (savedManual) {
        console.log('[FetchWeatherCard] Using saved manual location:', savedManual);
        setSavedManualLocation(savedManual);
        fetchWeatherByManualLocation(savedManual);
        return;
      }
    } catch {
      // ignore
    }

    fetchWeatherByIP();
  }, []);

  const processWeatherResult = useCallback((result: any, source: LocationSource) => {
    const data: LocalWeatherData = {
      temperature: result.weather.temperature,
      humidity: result.weather.humidity,
      pressure: result.weather.pressure,
      windSpeed: result.weather.windSpeed,
      windDirection: result.weather.windDirection,
      conditions: result.weather.conditions,
      location: result.weather.location,
      region: result.weather.region,
      dewPoint: result.weather.dewPoint ?? calculateDewPoint(result.weather.temperature, result.weather.humidity),
      saeCorrection: result.saeCorrection,
      densityAltitude: result.densityAltitude,
      correctedHP: result.correctedHP,
    };

    setWeatherData(data);
    setLastFetchTime(new Date());
    setFetchStatus('done');
    setLocationSource(source);
    setError(null);
    setManualLocationError(null);
    setShowManualInput(false);

    // Cache
    try {
      localStorage.setItem(FETCH_WEATHER_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        source,
      }));
    } catch {
      // ignore
    }
  }, []);

  // Fetch weather using IP-based location (auto:ip)
  const fetchWeatherByIP = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFetchStatus('fetching');

    try {
      console.log('[FetchWeatherCard] Fetching weather via IP location (auto:ip)');
      const result = await fetchWeatherData('auto:ip');
      processWeatherResult(result, 'ip');
    } catch (err: any) {
      console.warn('[FetchWeatherCard] IP weather error:', err?.message || err);
      setFetchStatus('error');
      setError(err?.message || 'Failed to fetch weather. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [processWeatherResult]);

  // Fetch weather using a manual location string
  const fetchWeatherByManualLocation = useCallback(async (locationStr: string) => {
    setIsLoading(true);
    setError(null);
    setManualLocationError(null);
    setFetchStatus('fetching');

    try {
      console.log('[FetchWeatherCard] Fetching weather for manual location:', locationStr);
      const result = await fetchWeatherData(locationStr);
      processWeatherResult(result, 'manual');
    } catch (err: any) {
      console.warn('[FetchWeatherCard] Manual location weather error:', err?.message || err);
      setManualLocationError(err?.message || 'Could not find weather for that location.');
      // Don't set fetchStatus to 'error' — keep showing the form
      if (!weatherData) {
        setFetchStatus('error');
        setError(err?.message || 'Failed to fetch weather for that location.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processWeatherResult, weatherData]);

  // Fetch weather using GPS with smart GPS → Wi-Fi → IP fallback chain
  const fetchWeatherByGPS = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFetchStatus('fetching');

    try {
      // Step 1: Get position using the smart fallback chain (GPS → Wi-Fi)
      const { position, method } = await getPositionWithFallback();

      const lat = Math.round(position.coords.latitude * 1000000) / 1000000;
      const lon = Math.round(position.coords.longitude * 1000000) / 1000000;
      const locationStr = `${lat},${lon}`;

      console.log('[FetchWeatherCard] Position acquired:', lat, lon,
        'accuracy:', position.coords.accuracy.toFixed(0), 'm',
        'method:', method);

      // Step 2: Fetch weather using the coordinates
      const result = await fetchWeatherData(locationStr);
      processWeatherResult(result, method);
    } catch (err: any) {
      console.warn('[FetchWeatherCard] GPS/Wi-Fi weather error:', err?.message || err);

      if (err?.code === 1) {
        // PERMISSION_DENIED — fall back to IP silently
        setError('Location access denied. Using approximate IP location instead.');
        fetchWeatherByIP();
        return;
      } else if (err?.code === 2 || err?.code === 3) {
        // POSITION_UNAVAILABLE or TIMEOUT (both GPS and Wi-Fi failed) — fall back to IP
        console.log('[FetchWeatherCard] Both GPS and Wi-Fi failed — falling back to IP location');
        setError(null); // Clear error since we're falling back gracefully
        fetchWeatherByIP();
        return;
      } else {
        setFetchStatus('error');
        setError(err?.message || 'Failed to fetch weather. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processWeatherResult, fetchWeatherByIP]);

  // ── Handle manual location submission ──
  const handleManualLocationSubmit = useCallback((location: string) => {
    console.log('[FetchWeatherCard] Manual location submitted:', location);

    // Save to localStorage for persistence
    try {
      localStorage.setItem(MANUAL_LOCATION_KEY, location);
    } catch {
      // ignore
    }
    setSavedManualLocation(location);

    fetchWeatherByManualLocation(location);
  }, [fetchWeatherByManualLocation]);

  // ── Reset to auto-detect (clear manual location, go back to IP) ──
  const handleResetToAutoDetect = useCallback(() => {
    console.log('[FetchWeatherCard] Resetting to auto-detect location');

    // Clear manual location from storage
    try {
      localStorage.removeItem(MANUAL_LOCATION_KEY);
      localStorage.removeItem(FETCH_WEATHER_CACHE_KEY);
    } catch {
      // ignore
    }

    setSavedManualLocation(null);
    setShowManualInput(false);
    setManualLocationError(null);
    setLocationSource('ip');
    setWeatherData(null);
    setLastFetchTime(null);
    setError(null);
    setFetchStatus('idle');
    autoFetchedRef.current = false;

    // Re-fetch via IP
    fetchWeatherByIP();
  }, [fetchWeatherByIP]);


  const clearWeather = useCallback(() => {
    setWeatherData(null);
    setLastFetchTime(null);
    setFetchStatus('idle');
    setError(null);
    setLocationSource('ip');
    setShowManualInput(false);
    setManualLocationError(null);
    setSavedManualLocation(null);
    autoFetchedRef.current = false;
    try {
      localStorage.removeItem(FETCH_WEATHER_CACHE_KEY);
      localStorage.removeItem(MANUAL_LOCATION_KEY);
    } catch {
      // ignore
    }
  }, []);

  // SAE quality color
  const getSAEColor = (sae: number): string => {
    if (sae <= 0.960) return 'text-green-400';
    if (sae <= 0.990) return 'text-green-400';
    if (sae <= 1.010) return 'text-yellow-400';
    if (sae <= 1.040) return 'text-orange-400';
    return 'text-red-400';
  };

  // ─── API key not configured ─────────────────────────────────────────────────
  if (!isWeatherConfigured()) {
    return (
      <div className="bg-gradient-to-r from-amber-600/10 via-amber-600/10 to-amber-600/10 rounded-xl border border-amber-500/30 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-amber-400 font-semibold text-sm">Weather API Key Not Configured</h3>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              To enable live weather, add <code className="text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded text-[11px] font-mono">VITE_WEATHER_API_KEY</code> to
              your Vercel environment variables, then redeploy.
            </p>
            <p className="text-slate-500 text-[11px] mt-1.5">
              Get a free key at{' '}
              <a
                href="https://www.weatherapi.com/signup.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                weatherapi.com
              </a>
              {' '} &mdash; This is a Vite app, so use the <code className="font-mono text-[10px] text-amber-300">VITE_</code> prefix (not <code className="font-mono text-[10px] text-slate-500 line-through">NEXT_PUBLIC_</code>).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state (first load — auto-fetching)
  if (isLoading && !weatherData) {
    return (
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 rounded-xl border border-blue-500/30 p-5">
        <div className="flex items-center justify-center gap-3 py-2">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-slate-300 text-sm font-medium">
            Fetching weather for your location...
          </span>
        </div>
      </div>
    );
  }

  // Error state (no cached data to show) — includes manual location fallback
  if (fetchStatus === 'error' && !weatherData) {
    return (
      <div className="bg-gradient-to-r from-red-600/10 via-red-600/10 to-red-600/10 rounded-xl border border-red-500/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Cloud className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-red-400 font-semibold text-sm">Weather Unavailable</h3>
              <p className="text-red-300/70 text-xs truncate">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchWeatherByIP}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ml-3"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
        {/* Manual location fallback */}
        <ManualLocationForm
          onSubmit={handleManualLocationSubmit}
          isLoading={isLoading}
          error={manualLocationError}
        />
      </div>
    );
  }

  // Weather data display
  if (!weatherData) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-blue-500/30 overflow-hidden">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {locationSource === 'gps' ? (
              <Crosshair className="w-4 h-4 text-green-400" />
            ) : locationSource === 'wifi' ? (
              <Wifi className="w-4 h-4 text-sky-400" />
            ) : locationSource === 'manual' ? (
              <MapPin className="w-4 h-4 text-amber-400" />
            ) : (
              <Globe className="w-4 h-4 text-blue-400" />
            )}
            <h3 className="text-white font-semibold text-sm">Local Weather</h3>
            <span className="text-xs text-slate-500">
              <MapPin className="w-3 h-3 inline mr-0.5" />
              {weatherData.location}{weatherData.region ? `, ${weatherData.region}` : ''}
            </span>
            {/* Location source badge */}
            <LocationSourceBadge source={locationSource} />
          </div>
          <div className="flex items-center gap-1.5">
            {lastFetchTime && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {/* Reset to auto-detect (only when using manual) */}
            {locationSource === 'manual' && (
              <button
                onClick={handleResetToAutoDetect}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-slate-700/50 text-amber-400/70 hover:text-amber-400 transition-colors disabled:opacity-50"
                title="Reset to auto-detect location"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {/* Use GPS for precision upgrade (show when on IP) */}
            {locationSource === 'ip' && (
              <button
                onClick={fetchWeatherByGPS}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-green-400 transition-colors disabled:opacity-50"
                title="Use GPS/Wi-Fi for precise location"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isLoading ? 'animate-pulse' : ''}`} />
              </button>
            )}
            <button
              onClick={locationSource === 'manual' && savedManualLocation
                ? () => fetchWeatherByManualLocation(savedManualLocation)
                : locationSource !== 'ip'
                  ? fetchWeatherByGPS
                  : fetchWeatherByIP}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
              title="Refresh weather"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={clearWeather}
              className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Change location link */}
        <div className="flex items-center justify-between mt-1">
          <div />
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`text-[11px] transition-colors ${
              locationSource === 'manual'
                ? 'text-amber-400/70 hover:text-amber-400'
                : 'text-slate-500 hover:text-amber-400'
            }`}
          >
            {showManualInput ? 'Cancel' : 'Change location'}
          </button>
        </div>
        {/* Inline manual location input (compact) */}
        {showManualInput && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <ManualLocationForm
              onSubmit={handleManualLocationSubmit}
              isLoading={isLoading}
              error={manualLocationError}
              compact
            />
          </div>
        )}
      </div>

      {/* Weather Data Grid */}
      <div className="p-4">
        {/* Top row: Temperature + Conditions + SAE */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getWeatherIcon(weatherData.conditions, 'w-10 h-10')}
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-white">{weatherData.temperature}</span>
                <span className="text-lg text-slate-400">°F</span>
              </div>
              <p className="text-slate-400 text-xs">{weatherData.conditions}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1">
              <span className="text-xs text-slate-500 block">SAE</span>
              <span className={`text-lg font-bold font-mono ${getSAEColor(weatherData.saeCorrection)}`}>
                {weatherData.saeCorrection.toFixed(3)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">DA</span>
              <span className="text-sm font-bold font-mono text-slate-300">
                {weatherData.densityAltitude.toLocaleString()} ft
              </span>
            </div>
          </div>
        </div>

        {/* Weather details grid - compact 2x3 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Humidity */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-lg">
            <Droplets className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Humidity</p>
              <p className="text-white font-semibold text-sm">{weatherData.humidity}%</p>
            </div>
          </div>

          {/* Barometric Pressure */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-lg">
            <Gauge className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Barometer</p>
              <p className="text-white font-semibold text-sm">{weatherData.pressure.toFixed(2)}" Hg</p>
            </div>
          </div>

          {/* Wind Speed & Direction */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-lg">
            <Wind className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Wind</p>
              <p className="text-white font-semibold text-sm">{weatherData.windSpeed} mph {weatherData.windDirection}</p>
            </div>
          </div>

          {/* Dew Point */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-lg">
            <Thermometer className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dew Point</p>
              <p className="text-white font-semibold text-sm">{weatherData.dewPoint.toFixed(1)}°F</p>
            </div>
          </div>

          {/* Corrected HP */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-900/40 rounded-lg">
            <Gauge className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Corr. HP</p>
              <p className="text-white font-semibold text-sm">{weatherData.correctedHP.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FetchWeatherCard;
