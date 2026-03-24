import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWeatherForWidget,
  WeatherWidgetData,
  isWeatherConfigured,
} from '@/lib/weather';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  Eye,
  RefreshCw,
  Loader2,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mountain,
  Clock,
  CloudFog,
  Snowflake,
  Crosshair,
  Globe,
  MapPinOff,
} from 'lucide-react';

interface WeatherWidgetProps {
  onNavigate: (section: string) => void;
}

const WEATHER_CACHE_KEY = 'promod_team_weather_cache';
const WEATHER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

type LocationSource = 'gps' | 'ip' | 'none';
type FetchState = 'idle' | 'locating' | 'fetching' | 'done' | 'denied' | 'error';

// Get weather icon component based on conditions
const getWeatherIcon = (conditions: string, isDay: boolean = true, size: string = 'w-8 h-8') => {
  const lower = conditions.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return <CloudRain className={`${size} text-blue-400`} />;
  if (lower.includes('fog') || lower.includes('mist')) return <CloudFog className={`${size} text-slate-400`} />;
  if (lower.includes('snow') || lower.includes('sleet')) return <Snowflake className={`${size} text-blue-200`} />;
  if (lower.includes('overcast')) return <Cloud className={`${size} text-slate-400`} />;
  if (lower.includes('cloudy') || lower.includes('partly')) return <CloudSun className={`${size} text-yellow-400`} />;
  if (lower.includes('clear') || lower.includes('sunny')) return isDay ? <Sun className={`${size} text-yellow-400`} /> : <Cloud className={`${size} text-indigo-300`} />;
  return <CloudSun className={`${size} text-slate-300`} />;
};

// Get SAE quality indicator
const getSAEQuality = (sae: number): { label: string; color: string; description: string } => {
  if (sae <= 0.960) return { label: 'Excellent', color: 'text-green-400', description: 'Dense, cool air - maximum power' };
  if (sae <= 0.990) return { label: 'Good', color: 'text-green-400', description: 'Favorable conditions for racing' };
  if (sae <= 1.010) return { label: 'Standard', color: 'text-yellow-400', description: 'Near standard conditions' };
  if (sae <= 1.040) return { label: 'Fair', color: 'text-orange-400', description: 'Thin air - reduce tune-up slightly' };
  return { label: 'Poor', color: 'text-red-400', description: 'Hot/thin air - significant power loss' };
};

// Get DA quality indicator
const getDAQuality = (da: number): { label: string; color: string } => {
  if (da < 500) return { label: 'Excellent', color: 'text-green-400' };
  if (da < 1500) return { label: 'Good', color: 'text-green-400' };
  if (da < 3000) return { label: 'Fair', color: 'text-yellow-400' };
  if (da < 5000) return { label: 'Marginal', color: 'text-orange-400' };
  return { label: 'Poor', color: 'text-red-400' };
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ onNavigate }) => {
  const [weatherData, setWeatherData] = useState<WeatherWidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [locationSource, setLocationSource] = useState<LocationSource>('none');
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [showForecast, setShowForecast] = useState(false);
  const autoFetchedRef = useRef(false);

  // ── Load cached data on mount ──
  useEffect(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { data, timestamp, source } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < WEATHER_CACHE_DURATION && data) {
          setWeatherData(data);
          setLastFetchTime(new Date(timestamp));
          setFetchState('done');
          if (source) setLocationSource(source);
        }
      }
    } catch {
      // Ignore cache errors
    }
  }, []);

  // ── Cache helper ──
  const cacheWeather = useCallback((data: WeatherWidgetData, source: LocationSource) => {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        source,
      }));
    } catch {
      // ignore
    }
  }, []);

  // ── Fetch weather using a location string ──
  const fetchWeatherWithLocation = useCallback(async (location: string, source: LocationSource) => {
    setIsLoading(true);
    setFetchState('fetching');

    try {
      console.log(`[WeatherWidget] Fetching weather for: ${location} (source: ${source})`);
      const data = await fetchWeatherForWidget(location);
      setWeatherData(data);
      setLastFetchTime(new Date());
      setFetchState('done');
      setLocationSource(source);
      cacheWeather(data, source);
    } catch (err: any) {
      console.warn('[WeatherWidget] Weather fetch error:', err?.message || err);
      // If we have cached data, keep showing it
      if (!weatherData) {
        setFetchState('error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheWeather, weatherData]);

  // ── Fetch weather via IP fallback ──
  const fetchWeatherByIP = useCallback(async () => {
    await fetchWeatherWithLocation('auto:ip', 'ip');
  }, [fetchWeatherWithLocation]);

  // ── Fetch weather via GPS geolocation ──
  const fetchWeatherByGPS = useCallback(async () => {
    setIsLoading(true);
    setFetchState('locating');

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

      console.log('[WeatherWidget] GPS acquired:', lat, lon);

      // Step 2: Fetch weather using the GPS coordinates
      await fetchWeatherWithLocation(locationStr, 'gps');
    } catch (err: any) {
      console.warn('[WeatherWidget] GPS error:', err?.message || err, 'code:', err?.code);

      // GeolocationPositionError codes:
      // 1 = PERMISSION_DENIED
      // 2 = POSITION_UNAVAILABLE
      // 3 = TIMEOUT
      if (err?.code === 1) {
        // User denied location access
        setFetchState('denied');
        setIsLoading(false);
        // Still try IP fallback silently so we show something
        console.log('[WeatherWidget] GPS denied — falling back to IP location');
        // Don't await — let it run in background
        fetchWeatherByIP();
        return;
      } else if (err?.code === 2 || err?.code === 3) {
        // GPS unavailable or timed out — fall back to IP
        console.log('[WeatherWidget] GPS unavailable/timeout — falling back to IP');
        await fetchWeatherByIP();
        return;
      } else if (err?.message?.includes('Geolocation is not supported')) {
        // Browser doesn't support geolocation — fall back to IP
        console.log('[WeatherWidget] Geolocation not supported — falling back to IP');
        await fetchWeatherByIP();
        return;
      }

      // Unknown error
      if (!weatherData) {
        setFetchState('error');
      }
      setIsLoading(false);
    }
  }, [fetchWeatherWithLocation, fetchWeatherByIP, weatherData]);

  // ── Refresh using last known source ──
  const handleRefresh = useCallback(() => {
    if (locationSource === 'gps') {
      fetchWeatherByGPS();
    } else {
      // Try GPS first, fall back to IP
      fetchWeatherByGPS();
    }
  }, [locationSource, fetchWeatherByGPS]);

  // ── Auto-fetch on mount using GPS (with IP fallback) ──
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!isWeatherConfigured()) return;

    // If we already have fresh cached data, skip auto-fetch
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < WEATHER_CACHE_DURATION) {
          autoFetchedRef.current = true;
          return;
        }
      }
    } catch {
      // ignore
    }

    autoFetchedRef.current = true;
    fetchWeatherByGPS();
  }, []);

  // ─── API key not configured ─────────────────────────────────────────────────
  if (!isWeatherConfigured()) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            Track Weather
          </h2>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-semibold text-sm">Weather API Key Not Configured</p>
            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
              To enable live weather data, add{' '}
              <code className="text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded text-[11px] font-mono">VITE_WEATHER_API_KEY</code>{' '}
              to your Vercel environment variables and redeploy.
            </p>
            <p className="text-slate-500 text-[11px] mt-2">
              Get a free API key at{' '}
              <a
                href="https://www.weatherapi.com/signup.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                weatherapi.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Location denied state (no cached data) ────────────────────────────────
  if (fetchState === 'denied' && !weatherData) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            Track Weather
          </h2>
        </div>
        <div className="text-center py-6">
          <MapPinOff className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-2">Enable location access to see local weather</p>
          <p className="text-slate-500 text-sm mb-4 max-w-xs mx-auto">
            Allow location access in your browser to automatically see live weather conditions and racing metrics for your area.
          </p>
          <button
            onClick={fetchWeatherByGPS}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors mx-auto disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state (first load — getting GPS / fetching weather) ────────────
  if (isLoading && !weatherData) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            Track Weather
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="ml-3 text-slate-400">
            {fetchState === 'locating' ? 'Getting your location...' : 'Fetching weather data...'}
          </span>
        </div>
      </div>
    );
  }

  // ─── Error state (no cached data) ──────────────────────────────────────────
  if (fetchState === 'error' && !weatherData) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            Track Weather
          </h2>
        </div>
        <div className="text-center py-6">
          <Cloud className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">Weather temporarily unavailable</p>
          <p className="text-slate-500 text-sm mb-4">
            The weather service could not be reached. This usually resolves on its own.
          </p>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors mx-auto disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!weatherData) return null;

  const saeQuality = getSAEQuality(weatherData.saeCorrection);
  const daQuality = getDAQuality(weatherData.densityAltitude);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            Track Weather
          </h2>
          <div className="flex items-center gap-3">
            {lastFetchTime && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                Updated {lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-400">
            {weatherData.location}{weatherData.region ? `, ${weatherData.region}` : ''}
          </span>
          {/* Location source indicator */}
          {locationSource === 'gps' && (
            <span className="text-[10px] text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-1" title="Using precise GPS location">
              <Crosshair className="w-2.5 h-2.5" />
              GPS
            </span>
          )}
          {locationSource === 'ip' && (
            <span className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-1" title="Using approximate IP-based location">
              <Globe className="w-2.5 h-2.5" />
              IP
            </span>
          )}
          {/* GPS denied banner — shown when we fell back to IP after denial */}
          {fetchState === 'denied' && locationSource === 'ip' && (
            <span className="text-[10px] text-yellow-400/80 bg-yellow-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-1" title="GPS denied — using approximate IP location. Enable location access for precise weather.">
              <MapPinOff className="w-2.5 h-2.5" />
              Approx
            </span>
          )}
          {weatherData.localTime && (
            <span className="text-xs text-slate-500 ml-2">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {weatherData.localTime.split(' ')[1] || ''}
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Main Weather Display */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {getWeatherIcon(weatherData.conditions, weatherData.isDay, 'w-12 h-12')}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{weatherData.temperature}</span>
                <span className="text-xl text-slate-400">°F</span>
              </div>
              <p className="text-slate-400 text-sm">{weatherData.conditions}</p>
              {weatherData.feelsLike !== weatherData.temperature && (
                <p className="text-slate-500 text-xs">Feels like {weatherData.feelsLike}°F</p>
              )}
            </div>
          </div>

          {/* SAE & DA Quick View */}
          <div className="text-right space-y-1">
            <div>
              <span className="text-xs text-slate-500">SAE Correction</span>
              <p className={`text-xl font-bold font-mono ${saeQuality.color}`}>
                {weatherData.saeCorrection.toFixed(3)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Density Altitude</span>
              <p className={`text-lg font-bold font-mono ${daQuality.color}`}>
                {weatherData.densityAltitude.toLocaleString()} ft
              </p>
            </div>
          </div>
        </div>

        {/* Racing Conditions Assessment */}
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">Racing Conditions</span>
            </div>
            <span className={`text-sm font-bold ${saeQuality.color}`}>{saeQuality.label}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{saeQuality.description}</p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-slate-500">Corrected HP:</span>
            <span className="text-xs font-mono font-medium text-white">{weatherData.correctedHP.toLocaleString()}</span>
          </div>
        </div>

        {/* Weather Details Grid — matches Pass Log fields */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {/* Temperature */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-slate-500">Temperature</span>
            </div>
            <p className="text-white font-medium">{weatherData.temperature}°F</p>
          </div>

          {/* Humidity */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-slate-500">Humidity</span>
            </div>
            <p className="text-white font-medium">{weatherData.humidity}%</p>
          </div>

          {/* Barometric Pressure */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-slate-500">Barometric Pressure</span>
            </div>
            <p className="text-white font-medium">{weatherData.pressure.toFixed(2)}" Hg</p>
          </div>

          {/* Wind Speed & Direction */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-500">Wind</span>
            </div>
            <p className="text-white font-medium">
              {weatherData.windSpeed} mph {weatherData.windDirection}
            </p>
            {weatherData.windGust > weatherData.windSpeed && (
              <p className="text-xs text-slate-500">Gusts {weatherData.windGust} mph</p>
            )}
          </div>

          {/* Dew Point */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-slate-500">Dew Point</span>
            </div>
            <p className="text-white font-medium">{weatherData.dewPoint.toFixed(1)}°F</p>
          </div>

          {/* Density Altitude */}
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Mountain className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-slate-500">Density Alt</span>
            </div>
            <p className={`font-medium ${daQuality.color}`}>
              {weatherData.densityAltitude.toLocaleString()} ft
            </p>
          </div>
        </div>

        {/* Hourly Forecast Toggle */}
        {weatherData.hourlyForecast.length > 0 && (
          <div>
            <button
              onClick={() => setShowForecast(!showForecast)}
              className="flex items-center gap-2 w-full px-3 py-2 bg-slate-900/40 rounded-lg text-sm text-slate-300 hover:bg-slate-900/60 transition-colors"
            >
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="font-medium">Hourly Forecast</span>
              <span className="text-xs text-slate-500 ml-1">
                ({weatherData.hourlyForecast.length} hours)
              </span>
              <div className="ml-auto">
                {showForecast ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {showForecast && (
              <div className="mt-3 space-y-2">
                {weatherData.hourlyForecast.map((hour, idx) => {
                  const hSaeQ = getSAEQuality(hour.saeCorrection);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-900/30 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-400 font-mono text-xs w-12">{hour.time}</span>
                        {getWeatherIcon(hour.conditions, true, 'w-5 h-5')}
                        <span className="text-white font-medium">{hour.temperature}°F</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">
                          <Droplets className="w-3 h-3 inline mr-0.5" />
                          {hour.humidity}%
                        </span>
                        <span className="text-slate-400">
                          <Wind className="w-3 h-3 inline mr-0.5" />
                          {hour.windSpeed}
                        </span>
                        <span className={`font-mono font-medium ${hSaeQ.color}`}>
                          {hour.saeCorrection.toFixed(3)}
                        </span>
                        {hour.chanceOfRain > 0 && (
                          <span className="text-blue-400">
                            <CloudRain className="w-3 h-3 inline mr-0.5" />
                            {hour.chanceOfRain}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;
