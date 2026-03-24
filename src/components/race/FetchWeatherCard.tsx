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
  Globe,
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
const FETCH_WEATHER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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

const FetchWeatherCard: React.FC<FetchWeatherCardProps> = () => {
  const [weatherData, setWeatherData] = useState<LocalWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle');
  const [locationSource, setLocationSource] = useState<'ip' | 'gps'>('ip');
  const autoFetchedRef = useRef(false);

  // Load cached data on mount
  useEffect(() => {
    try {
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

  // Auto-fetch weather on mount using IP location (no permission needed)
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
    fetchWeatherByIP();
  }, []);

  const processWeatherResult = useCallback((result: any, source: 'ip' | 'gps') => {
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

  // Fetch weather using GPS for more precise location
  const fetchWeatherByGPS = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFetchStatus('fetching');

    try {
      // Step 1: Get GPS coordinates from browser
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 5 * 60 * 1000, // 5 min cache
        });
      });

      const lat = Math.round(position.coords.latitude * 10000) / 10000;
      const lon = Math.round(position.coords.longitude * 10000) / 10000;
      const locationStr = `${lat},${lon}`;

      console.log('[FetchWeatherCard] GPS acquired:', lat, lon);

      // Step 2: Fetch weather using the GPS coordinates
      const result = await fetchWeatherData(locationStr);
      processWeatherResult(result, 'gps');
    } catch (err: any) {
      console.warn('[FetchWeatherCard] GPS weather error:', err?.message || err);
      setFetchStatus('error');

      if (err?.code === 1) {
        setError('Location access denied. Weather is using your approximate IP location instead.');
        // Fall back to IP-based weather silently
        fetchWeatherByIP();
        return;
      } else if (err?.code === 2) {
        setError('Unable to determine precise location. Using IP location instead.');
        fetchWeatherByIP();
        return;
      } else if (err?.code === 3) {
        setError('GPS request timed out. Using IP location instead.');
        fetchWeatherByIP();
        return;
      } else {
        setError(err?.message || 'Failed to fetch weather. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processWeatherResult, fetchWeatherByIP]);

  const clearWeather = useCallback(() => {
    setWeatherData(null);
    setLastFetchTime(null);
    setFetchStatus('idle');
    setError(null);
    setLocationSource('ip');
    autoFetchedRef.current = false;
    try {
      localStorage.removeItem(FETCH_WEATHER_CACHE_KEY);
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

  // Loading state (first load — auto-fetching via IP)
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

  // Error state (no cached data to show)
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
            ) : (
              <Globe className="w-4 h-4 text-blue-400" />
            )}
            <h3 className="text-white font-semibold text-sm">Local Weather</h3>
            <span className="text-xs text-slate-500">
              <MapPin className="w-3 h-3 inline mr-0.5" />
              {weatherData.location}{weatherData.region ? `, ${weatherData.region}` : ''}
            </span>
            {/* Location source badge */}
            {locationSource === 'gps' ? (
              <span className="text-[10px] text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Using precise GPS location">
                <Crosshair className="w-2.5 h-2.5" />
                GPS
              </span>
            ) : (
              <span className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Using approximate IP-based location">
                <Globe className="w-2.5 h-2.5" />
                IP
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {lastFetchTime && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {/* Use GPS for precision upgrade */}
            {locationSource === 'ip' && (
              <button
                onClick={fetchWeatherByGPS}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-green-400 transition-colors disabled:opacity-50"
                title="Use GPS for precise location"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isLoading ? 'animate-pulse' : ''}`} />
              </button>
            )}
            <button
              onClick={locationSource === 'gps' ? fetchWeatherByGPS : fetchWeatherByIP}
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
