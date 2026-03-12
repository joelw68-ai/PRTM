import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
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
import { Crosshair } from 'lucide-react';

interface WeatherWidgetProps {
  onNavigate: (section: string) => void;
}

const WEATHER_CACHE_KEY = 'promod_weather_cache';
const WEATHER_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WEATHER_STALE_DURATION = 60 * 60 * 1000; // 1 hour — show stale cache on error
const GPS_COORDS_KEY = 'promod_gps_coords';
const GPS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes — GPS coords don't change that fast

type LocationSource = 'gps' | 'ip' | 'home-track' | 'pending';

// Get cached GPS coordinates
function getCachedGPS(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(GPS_COORDS_KEY);
    if (!raw) return null;
    const { lat, lon, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > GPS_CACHE_DURATION) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// Cache GPS coordinates
function cacheGPS(lat: number, lon: number) {
  try {
    localStorage.setItem(GPS_COORDS_KEY, JSON.stringify({ lat, lon, timestamp: Date.now() }));
  } catch {
    // ignore
  }
}

// Request GPS position with a promise wrapper
function requestGPSPosition(timeoutMs: number = 10000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lon = Math.round(position.coords.longitude * 10000) / 10000;
        resolve({ lat, lon });
      },
      (err) => {
        reject(err);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: GPS_CACHE_DURATION }
    );
  });
}

// ─── Smart Track Location Resolution ─────────────────────────────────────────
// The homeTrack field stores a track NAME (e.g. "Milan Dragway", "Darana Milan
// Dragway").  Passing that directly to WeatherAPI.com often geocodes to the
// WRONG place (e.g. Darana → Darana, Kebbi, Nigeria instead of Milan, MI).
//
// This helper resolves the best geocodable string by:
//   1. Matching the homeTrack name against saved tracks that have city/state/zip
//   2. Falling back to the user's favorite saved track
//   3. Stripping common venue words and returning a cleaner location string
// ─────────────────────────────────────────────────────────────────────────────

function resolveWeatherLocationFromTracks(
  homeTrackName: string | undefined,
  savedTracks: Array<{
    name: string;
    location?: string;
    city?: string;
    state?: string;
    zip?: string;
    isFavorite: boolean;
  }>
): string | null {
  // Step 1: If we have saved tracks, try to find one matching the homeTrack name
  if (homeTrackName && savedTracks.length > 0) {
    const htLower = homeTrackName.toLowerCase().trim();
    const nameMatch = savedTracks.find(t => {
      const tName = t.name.toLowerCase().trim();
      // Exact match, or one contains the other
      return tName === htLower || tName.includes(htLower) || htLower.includes(tName);
    });

    if (nameMatch) {
      const loc = extractBestLocation(nameMatch);
      if (loc) {
        console.log('[WeatherWidget] Resolved homeTrack via saved track name match:', homeTrackName, '→', loc);
        return loc;
      }
    }
  }

  // Step 2: Use the favorite saved track (if any) — it's the user's primary track
  if (savedTracks.length > 0) {
    const favTrack = savedTracks.find(t => t.isFavorite);
    if (favTrack) {
      const loc = extractBestLocation(favTrack);
      if (loc) {
        console.log('[WeatherWidget] Resolved location via favorite saved track:', favTrack.name, '→', loc);
        return loc;
      }
    }
  }

  // Step 3: Strip venue words from the homeTrack name to get a cleaner city name
  if (homeTrackName) {
    const cleaned = cleanTrackNameForGeocoding(homeTrackName);
    if (cleaned && cleaned.length >= 2) {
      console.log('[WeatherWidget] Cleaned homeTrack name for geocoding:', homeTrackName, '→', cleaned);
      return cleaned;
    }
  }

  return null;
}

/**
 * Extract the best geocodable location string from a saved track.
 * Priority: zip code > city+state > location field
 * Zip codes are the most reliable for US geocoding (no ambiguity).
 */
function extractBestLocation(track: {
  city?: string;
  state?: string;
  zip?: string;
  location?: string;
}): string | null {
  // Zip code is most reliable (e.g. "48160" → Milan, MI, no ambiguity)
  if (track.zip && track.zip.trim().length >= 5) {
    return track.zip.trim();
  }
  // City + State is very reliable (e.g. "Milan, MI")
  if (track.city && track.city.trim() && track.state && track.state.trim()) {
    return `${track.city.trim()}, ${track.state.trim()}`;
  }
  // Location field (e.g. "Milan, MI" or "Milan, Michigan")
  if (track.location && track.location.trim().length >= 3) {
    return track.location.trim();
  }
  return null;
}

/**
 * Strip common racing venue words from a track name to extract a geocodable
 * city/location.  E.g. "Milan Dragway" → "Milan", "South Georgia Motorsports
 * Park" → "South Georgia".
 */
function cleanTrackNameForGeocoding(trackName: string): string {
  // Common racing venue suffixes/words — sorted longest-first to avoid partial matches
  const venueWords = [
    'motorsports park', 'motorsport park', 'motor speedway', 'raceway park',
    'drag strip', 'dragstrip', 'race park', 'racepark',
    'international raceway', 'international dragway', 'international speedway',
    'national dragway', 'national speedway', 'national raceway',
    'dragway', 'raceway', 'speedway', 'drag way',
    'motorsports', 'motorsport', 'racing', 'strip', 'dragplex',
  ];

  let cleaned = trackName;
  for (const word of venueWords) {
    // Case-insensitive replacement, word-boundary aware where possible
    cleaned = cleaned.replace(new RegExp(word, 'gi'), ' ');
  }

  // Collapse whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Remove leading/trailing non-alphanumeric chars
  cleaned = cleaned.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

  return cleaned;
}


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
  const { savedTracks } = useApp();

  const [weatherData, setWeatherData] = useState<WeatherWidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForecast, setShowForecast] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [trackLocation, setTrackLocation] = useState<string>('');
  const [locationSource, setLocationSource] = useState<LocationSource>('pending');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Memoize the resolved home-track location so it only recalculates when
  // profile.homeTrack or savedTracks actually change.
  const resolvedHomeTrackLocation = useMemo(() => {
    if (!profile?.homeTrack && savedTracks.length === 0) return null;
    return resolveWeatherLocationFromTracks(profile?.homeTrack, savedTracks);
  }, [profile?.homeTrack, savedTracks]);

  // Resolve the best location: homeTrack (smart) > GPS > auto:ip
  const getWeatherLocation = useCallback((): string => {
    // Priority 1: Smart-resolved home track location (uses saved track city/state/zip)
    if (resolvedHomeTrackLocation) {
      setLocationSource('home-track');
      return resolvedHomeTrackLocation;
    }
    
    // Priority 2: GPS coordinates
    if (gpsCoords) {
      setLocationSource('gps');
      return `${gpsCoords.lat},${gpsCoords.lon}`;
    }
    
    // Priority 3: IP-based fallback
    setLocationSource('ip');
    return 'auto:ip';
  }, [resolvedHomeTrackLocation, gpsCoords]);

  // Request GPS on mount
  useEffect(() => {
    // If user has a resolved home track location, skip GPS entirely
    if (resolvedHomeTrackLocation) {
      setLocationSource('home-track');
      return;
    }

    // Check cached GPS first
    const cached = getCachedGPS();
    if (cached) {
      console.log('[WeatherWidget] Using cached GPS:', cached);
      setGpsCoords(cached);
      setLocationSource('gps');
      return;
    }

    // Request fresh GPS
    setLocationSource('pending');
    requestGPSPosition(8000)
      .then(({ lat, lon }) => {
        console.log('[WeatherWidget] GPS acquired:', lat, lon);
        cacheGPS(lat, lon);
        setGpsCoords({ lat, lon });
        setLocationSource('gps');
      })
      .catch((err) => {
        console.warn('[WeatherWidget] GPS unavailable, falling back to IP:', err?.message || err);
        setLocationSource('ip');
      });
  }, [resolvedHomeTrackLocation]);

  // When the resolved location changes (e.g. user updates saved track data),
  // clear the stale weather cache so we don't keep showing wrong-location data.
  useEffect(() => {
    if (!resolvedHomeTrackLocation) return;
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const { location: cachedLoc } = JSON.parse(cached);
        if (cachedLoc && cachedLoc !== resolvedHomeTrackLocation) {
          console.log('[WeatherWidget] Location changed from', cachedLoc, 'to', resolvedHomeTrackLocation, '— clearing stale cache');
          localStorage.removeItem(WEATHER_CACHE_KEY);
          setWeatherData(null);
          setLastFetchTime(null);
        }
      }
    } catch {
      // ignore
    }
  }, [resolvedHomeTrackLocation]);



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
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-400">
            {weatherData.location}{weatherData.region ? `, ${weatherData.region}` : ''}
          </span>
          {/* Location source indicator */}
          {locationSource === 'gps' && (
            <span className="text-xs text-green-400/80 flex items-center gap-0.5 ml-1" title="Location from GPS (precise)">
              <Crosshair className="w-2.5 h-2.5" />
              GPS
            </span>
          )}
          {locationSource === 'ip' && (
            <span className="text-xs text-yellow-400/70 flex items-center gap-0.5 ml-1" title="Location from IP address (approximate — allow GPS for better accuracy)">
              <Navigation className="w-2.5 h-2.5" />
              IP
            </span>
          )}
          {locationSource === 'home-track' && (
            <span className="text-xs text-orange-400/70 flex items-center gap-0.5 ml-1" title="Using your home track setting">
              <MapPin className="w-2.5 h-2.5" />
              Home Track
            </span>
          )}
          {locationSource === 'pending' && (
            <span className="text-xs text-slate-500 flex items-center gap-0.5 ml-1" title="Requesting GPS location...">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              locating
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
