import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '@/lib/utils';
import { fetchRaceDayForecast, RaceDayForecastData, RaceDayHour } from '@/lib/weather';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  Mountain,
  Loader2,
  MapPin,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CloudFog,
  Snowflake,
  Sunrise,
  Sunset,
  RefreshCw,
  CalendarDays,
  Clock,
  CloudDrizzle
} from 'lucide-react';

interface RaceDayWeatherCardProps {
  trackLocation: string;
  trackName: string;
  eventDate: string;
  eventTitle: string;
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

// Get SAE quality indicator
const getSAEQuality = (sae: number): { label: string; color: string; bgColor: string } => {
  if (sae <= 0.960) return { label: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' };
  if (sae <= 0.990) return { label: 'Good', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' };
  if (sae <= 1.010) return { label: 'Standard', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' };
  if (sae <= 1.040) return { label: 'Fair', color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' };
  return { label: 'Poor', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' };
};

// Get DA quality indicator
const getDAQuality = (da: number): { label: string; color: string } => {
  if (da < 500) return { label: 'Excellent', color: 'text-green-400' };
  if (da < 1500) return { label: 'Good', color: 'text-green-400' };
  if (da < 3000) return { label: 'Fair', color: 'text-yellow-400' };
  if (da < 5000) return { label: 'Marginal', color: 'text-orange-400' };
  return { label: 'Poor', color: 'text-red-400' };
};

// Format hour for display (e.g., "08:00" -> "8 AM")
const formatHour = (time: string): string => {
  const hour = parseInt(time.split(':')[0]);
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
};

const RaceDayWeatherCard: React.FC<RaceDayWeatherCardProps> = ({
  trackLocation,
  trackName,
  eventDate,
  eventTitle
}) => {
  const [forecast, setForecast] = useState<RaceDayForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHourly, setShowHourly] = useState(false);
  const [selectedHour, setSelectedHour] = useState<RaceDayHour | null>(null);

  const fetchForecast = async () => {
    if (!trackLocation && !trackName) {
      setError('No track location set for this event');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use trackLocation (city, state) first, fall back to trackName
      const location = trackLocation || trackName;
      const data = await fetchRaceDayForecast(location, eventDate);
      setForecast(data);
    } catch (err: any) {
      console.error('Race day weather error:', err);
      setError(err.message || 'Failed to fetch weather forecast');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [trackLocation, trackName, eventDate]);

  // Format the event date for display using the centralized utility
  const formatDate = (dateStr: string) => {
    return formatLocalDate(dateStr, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Days until event label
  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)} days ago`;
    return `In ${days} days`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-white">Race Day Weather</h4>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-slate-400 text-sm">Loading forecast...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-white">Race Day Weather</h4>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{error}</span>
        </div>
        <button
          onClick={fetchForecast}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  // Unavailable (too far out)
  if (forecast?.dataType === 'unavailable') {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-white">Race Day Weather</h4>
        </div>
        <div className="text-center py-4">
          <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Forecast not yet available</p>
          <p className="text-slate-500 text-xs mt-1">
            {getDaysLabel(forecast.daysUntilEvent)} — Weather forecast will be available within 14 days of the event
          </p>
        </div>
      </div>
    );
  }

  if (!forecast) return null;

  const saeQuality = getSAEQuality(forecast.avgSAE);
  const daQuality = getDAQuality(forecast.avgDA);

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-blue-500/20 bg-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">Race Day Weather</h4>
          </div>
          <div className="flex items-center gap-2">
            {forecast.dataType === 'historical' && (
              <span className="text-xs px-1.5 py-0.5 bg-slate-600/50 text-slate-300 rounded">Historical</span>
            )}
            {forecast.dataType === 'forecast' && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded">Forecast</span>
            )}
            <button
              onClick={fetchForecast}
              disabled={isLoading}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Refresh forecast"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {forecast.location}{forecast.region ? `, ${forecast.region}` : ''}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {getDaysLabel(forecast.daysUntilEvent)}
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Main Weather Overview */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {getWeatherIcon(forecast.conditions, 'w-10 h-10')}
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-white">{forecast.avgTemp}</span>
                <span className="text-sm text-slate-400">°F</span>
              </div>
              <p className="text-slate-400 text-xs">{forecast.conditions}</p>
              <p className="text-slate-500 text-xs">
                H: {forecast.maxTemp}° L: {forecast.minTemp}°
              </p>
            </div>
          </div>

          {/* SAE Quick View */}
          <div className="text-right">
            <div className={`inline-block px-2 py-1 rounded border text-xs font-medium ${saeQuality.bgColor} ${saeQuality.color}`}>
              {saeQuality.label}
            </div>
            <p className={`text-lg font-bold font-mono mt-1 ${saeQuality.color}`}>
              {forecast.avgSAE.toFixed(3)}
            </p>
            <p className="text-xs text-slate-500">SAE Avg</p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-900/40 rounded-lg p-2 text-center">
            <Droplets className="w-3.5 h-3.5 text-blue-400 mx-auto mb-0.5" />
            <p className="text-white text-sm font-medium">{forecast.avgHumidity}%</p>
            <p className="text-slate-500 text-xs">Humidity</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2 text-center">
            <Wind className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-0.5" />
            <p className="text-white text-sm font-medium">{forecast.maxWind} mph</p>
            <p className="text-slate-500 text-xs">Max Wind</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2 text-center">
            <CloudDrizzle className="w-3.5 h-3.5 text-blue-300 mx-auto mb-0.5" />
            <p className="text-white text-sm font-medium">{forecast.chanceOfRain}%</p>
            <p className="text-slate-500 text-xs">Rain</p>
          </div>
        </div>

        {/* SAE & DA Range */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-slate-400">SAE Correction</span>
            </div>
            <p className={`font-mono font-bold ${saeQuality.color}`}>
              {forecast.avgSAE.toFixed(3)}
            </p>
            {forecast.bestSAE !== forecast.worstSAE && (
              <p className="text-xs text-slate-500 mt-0.5">
                Range: {forecast.bestSAE.toFixed(3)} – {forecast.worstSAE.toFixed(3)}
              </p>
            )}
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Mountain className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-slate-400">Density Altitude</span>
            </div>
            <p className={`font-mono font-bold ${daQuality.color}`}>
              {forecast.avgDA.toLocaleString()} ft
            </p>
            {forecast.bestDA !== forecast.worstDA && (
              <p className="text-xs text-slate-500 mt-0.5">
                Range: {forecast.bestDA.toLocaleString()} – {forecast.worstDA.toLocaleString()} ft
              </p>
            )}
          </div>
        </div>

        {/* Sunrise / Sunset */}
        {(forecast.sunrise || forecast.sunset) && (
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
            {forecast.sunrise && (
              <span className="flex items-center gap-1">
                <Sunrise className="w-3 h-3 text-orange-400" />
                {forecast.sunrise}
              </span>
            )}
            {forecast.sunset && (
              <span className="flex items-center gap-1">
                <Sunset className="w-3 h-3 text-orange-400" />
                {forecast.sunset}
              </span>
            )}
          </div>
        )}

        {/* Hourly Racing Window Toggle */}
        {forecast.racingHours.length > 0 && (
          <div>
            <button
              onClick={() => setShowHourly(!showHourly)}
              className="flex items-center gap-2 w-full px-3 py-2 bg-slate-900/40 rounded-lg text-sm text-slate-300 hover:bg-slate-900/60 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium">Racing Window Hourly</span>
              <span className="text-xs text-slate-500 ml-1">8 AM – 8 PM</span>
              <div className="ml-auto">
                {showHourly ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>

            {showHourly && (
              <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                {forecast.racingHours.map((hour, idx) => {
                  const hSaeQ = getSAEQuality(hour.saeCorrection);
                  const isSelected = selectedHour?.hour === hour.hour;
                  return (
                    <div key={idx}>
                      <div
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-900/30 hover:bg-slate-900/50'
                        }`}
                        onClick={() => setSelectedHour(isSelected ? null : hour)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-400 font-mono w-12">{formatHour(hour.time)}</span>
                          {getWeatherIcon(hour.conditions, 'w-4 h-4')}
                          <span className="text-white font-medium">{hour.temperature}°F</span>
                        </div>
                        <div className="flex items-center gap-3">
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

                      {/* Expanded hour detail */}
                      {isSelected && (
                        <div className="mx-2 mt-1 mb-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">Feels Like</span>
                              <p className="text-white font-medium">{hour.feelsLike}°F</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Dew Point</span>
                              <p className="text-white font-medium">{hour.dewPoint}°F</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Barometer</span>
                              <p className="text-white font-medium">{hour.pressure.toFixed(2)}"</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Wind</span>
                              <p className="text-white font-medium">{hour.windSpeed} mph {hour.windDirection}</p>
                              {hour.windGust > hour.windSpeed && (
                                <p className="text-slate-500">Gusts {hour.windGust} mph</p>
                              )}
                            </div>
                            <div>
                              <span className="text-slate-500">SAE Correction</span>
                              <p className={`font-mono font-bold ${hSaeQ.color}`}>{hour.saeCorrection.toFixed(3)}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Density Alt</span>
                              <p className={`font-mono font-bold ${getDAQuality(hour.densityAltitude).color}`}>
                                {hour.densityAltitude.toLocaleString()} ft
                              </p>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-500">Corrected HP</span>
                              <p className="text-white font-mono font-bold">{hour.correctedHP.toLocaleString()} HP</p>
                            </div>
                          </div>
                        </div>
                      )}
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

export default RaceDayWeatherCard;
