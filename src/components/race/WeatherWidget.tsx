import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWeatherForWidget, WeatherWidgetData, calculateDewPoint, calculateSAECorrection } from '@/lib/weather';
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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mountain,
  Clock,
  CloudFog,
  Snowflake,
  ArrowUp,
  Settings,
  Navigation
} from 'lucide-react';

interface WeatherWidgetProps {
  onNavigate: (section: string) => void;
}

const WEATHER_CACHE_KEY = 'promod_weather_cache';
const WEATHER_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WEATHER_STALE_DURATION = 60 * 60 * 1000; // 1 hour — show stale cache on error


// Get weather icon component based on conditions
const getWeatherIcon = (conditions: string, isDay: boolean, size: string = 'w-8 h-8') => {
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
  const { profile } = useAuth();

  const [weatherData, setWeatherData] = useState<WeatherWidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForecast, setShowForecast] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [trackLocation, setTrackLocation] = useState<string>('');

  // Determine the best location to use for weather
  // Primary: IP-based geolocation via WeatherAPI's auto:ip feature
  // Override: Home track from profile if set
  const getWeatherLocation = useCallback((): string => {
    // If user has a home track set, use that as an override
    if (profile?.homeTrack) {
      return profile.homeTrack;
    }
    
    // Default: use IP-based geolocation
    return 'auto:ip';
  }, [profile?.homeTrack]);


  // Load cached weather data (use stale cache up to 1 hour as fallback)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { data, timestamp, location: cachedLocation } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < WEATHER_STALE_DURATION && data) {
          setWeatherData(data);
          setTrackLocation(cachedLocation || '');
          setLastFetchTime(new Date(timestamp));
        }
      }
    } catch {
      // Ignore cache errors
    }
  }, []);


  // Fetch weather data
  const fetchWeather = useCallback(async (force: boolean = false) => {
    const location = getWeatherLocation();
    if (!location) {
      setError('no-location');
      return;
    }

    // Check cache unless forced
    if (!force && weatherData && lastFetchTime) {
      const age = Date.now() - lastFetchTime.getTime();
      if (age < WEATHER_CACHE_DURATION) return;
    }

    setIsLoading(true);
    if (!weatherData) {
      // Only clear error on first load; keep stale data visible during refresh
      setError(null);
    }

    try {
      const data = await fetchWeatherForWidget(location);
      setWeatherData(data);
      setTrackLocation(location);
      setLastFetchTime(new Date());
      setError(null);
      
      // Cache the result
      try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now(),
          location
        }));
      } catch {
        // Ignore storage errors
      }
    } catch (err: any) {
      // Use warn instead of error for expected network issues
      console.warn('Weather widget: fetch failed —', err?.message || err);
      // If we have cached data, show it with a subtle indicator
      if (weatherData) {
        setError('refresh-failed');
      } else {
        setError('unavailable');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getWeatherLocation, weatherData, lastFetchTime]);



  // Auto-fetch on mount and when location changes
  useEffect(() => {
    const location = getWeatherLocation();
    if (location) {
      fetchWeather();
    }
  }, [getWeatherLocation]);

  // Auto-retry once after 5 seconds if first fetch fails with no cached data
  useEffect(() => {
    if (error === 'unavailable' && !weatherData && !isLoading) {
      const retryTimer = setTimeout(() => {
        fetchWeather(true);
      }, 5000);
      return () => clearTimeout(retryTimer);
    }
  }, [error, weatherData, isLoading]);

  // No location configured
  if (error === 'no-location' && !weatherData) {
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
          <p className="text-slate-400 mb-2">No track location configured</p>
          <p className="text-slate-500 text-sm mb-4">
            Set your home track in Team Profile or save a track to see live weather conditions and racing metrics.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onNavigate('team')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Set Home Track
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state (first load only)
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
          <span className="ml-3 text-slate-400">Fetching weather data...</span>
        </div>
      </div>
    );
  }

  // Weather unavailable — show a friendly retry state instead of hiding the widget
  if (error === 'unavailable' && !weatherData) {
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
            onClick={() => fetchWeather(true)}
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
              onClick={() => fetchWeather(true)}
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
        <div className="flex items-center gap-1.5 mt-1">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-400">
            {weatherData.location}{weatherData.region ? `, ${weatherData.region}` : ''}
          </span>
          {!profile?.homeTrack && (
            <span className="text-xs text-blue-400/70 flex items-center gap-0.5 ml-1" title="Location detected from your IP address">
              <Navigation className="w-2.5 h-2.5" />
              auto
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

      {/* Error banner */}
      {error && error !== 'no-location' && error !== 'refresh-failed' && error !== 'unavailable' && (
        <div className="flex items-center gap-2 px-6 py-2 bg-red-500/10 border-b border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {error === 'refresh-failed' && (
        <div className="flex items-center gap-2 px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-400 text-xs">Using cached data — refresh failed. Tap Refresh to retry.</span>
        </div>
      )}


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

        {/* Weather Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-slate-500">Humidity</span>
            </div>
            <p className="text-white font-medium">{weatherData.humidity}%</p>
          </div>

          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-slate-500">Barometer</span>
            </div>
            <p className="text-white font-medium">{weatherData.pressure.toFixed(2)}"</p>
          </div>

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

          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-slate-500">Dew Point</span>
            </div>
            <p className="text-white font-medium">{weatherData.dewPoint}°F</p>
          </div>

          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Mountain className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-slate-500">Density Alt</span>
            </div>
            <p className={`font-medium ${daQuality.color}`}>
              {weatherData.densityAltitude.toLocaleString()} ft
            </p>
          </div>

          <div className="p-2.5 bg-slate-900/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">Visibility</span>
            </div>
            <p className="text-white font-medium">{weatherData.visibility} mi</p>
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
