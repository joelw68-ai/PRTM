import React from 'react';
import { useRaceDay } from '@/contexts/RaceDayContext';
import {
  Zap,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Mountain,
  MapPin,
  ClipboardList,
  CheckSquare,
  Radio,
  X,
  RefreshCw,
  Loader2,
  Cloud,
  Sun,
  CloudRain,
  CloudSun,
  Snowflake,
  Flag,
} from 'lucide-react';

interface RaceDayBannerProps {
  onNavigate: (section: string) => void;
  activeSection: string;
}

const getWeatherIcon = (conditions: string) => {
  const lower = (conditions || '').toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (lower.includes('snow') || lower.includes('sleet')) return <Snowflake className="w-5 h-5 text-blue-200" />;
  if (lower.includes('overcast')) return <Cloud className="w-5 h-5 text-slate-400" />;
  if (lower.includes('cloudy') || lower.includes('partly')) return <CloudSun className="w-5 h-5 text-yellow-400" />;
  if (lower.includes('clear') || lower.includes('sunny')) return <Sun className="w-5 h-5 text-yellow-400" />;
  return <Cloud className="w-5 h-5 text-slate-300" />;
};

const getSAEColor = (sae: number): string => {
  if (sae <= 0.960) return 'text-green-400';
  if (sae <= 0.990) return 'text-green-400';
  if (sae <= 1.010) return 'text-yellow-400';
  if (sae <= 1.040) return 'text-orange-400';
  return 'text-red-400';
};

const RaceDayBanner: React.FC<RaceDayBannerProps> = ({ onNavigate, activeSection }) => {
  const {
    isRaceDayMode,
    disableRaceDayMode,
    currentRaceEvent,
    weatherSummary,
    todayPassCount,
    isWeatherLoading,
    refreshWeather,
    raceDaySections,
  } = useRaceDay();

  if (!isRaceDayMode) return null;

  const eventName = currentRaceEvent?.title || 'Race Day';
  const trackName = currentRaceEvent?.trackName || '';
  const trackLocation = currentRaceEvent?.trackLocation || '';

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-orange-600/95 via-red-600/95 to-orange-600/95 backdrop-blur-md border-b border-orange-500/50 shadow-lg shadow-orange-900/30">
      {/* Main Banner Row */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-14 sm:h-16">
          {/* Left: Race Day indicator + Event Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="relative">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase tracking-wider font-bold text-orange-200/80 leading-none block">
                  Race Day Mode
                </span>
                <span className="text-sm font-bold text-white leading-tight block truncate max-w-[200px] lg:max-w-[300px]">
                  {eventName}
                </span>
              </div>
              <span className="sm:hidden text-xs font-bold text-white truncate max-w-[100px]">
                {eventName}
              </span>
            </div>

            {/* Track info */}
            {trackName && (
              <div className="hidden md:flex items-center gap-1 text-orange-200/70 text-xs">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[200px]">
                  {trackName}{trackLocation ? `, ${trackLocation}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Center: Weather Summary */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-6 flex-shrink-0">
            {weatherSummary ? (
              <>
                <div className="flex items-center gap-1.5">
                  {getWeatherIcon(weatherSummary.conditions)}
                  <span className="text-white font-bold text-lg">{weatherSummary.temperature}°F</span>
                  <span className="text-orange-200/70 text-xs hidden xl:inline">{weatherSummary.conditions}</span>
                </div>

                <div className="flex items-center gap-1 text-orange-200/80 text-xs">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{weatherSummary.humidity}%</span>
                </div>

                <div className="flex items-center gap-1 text-orange-200/80 text-xs">
                  <Wind className="w-3.5 h-3.5" />
                  <span>{weatherSummary.windSpeed} mph {weatherSummary.windDirection}</span>
                </div>

                <div className="flex items-center gap-1 text-orange-200/80 text-xs">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>{weatherSummary.pressure.toFixed(2)}"</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-orange-200/60 uppercase">SAE</span>
                  <span className={`font-mono font-bold text-sm ${getSAEColor(weatherSummary.saeCorrection)}`}>
                    {weatherSummary.saeCorrection.toFixed(3)}
                  </span>
                </div>

                <div className="hidden xl:flex items-center gap-1">
                  <Mountain className="w-3.5 h-3.5 text-orange-200/60" />
                  <span className="text-orange-200/80 text-xs font-mono">
                    {weatherSummary.densityAltitude.toLocaleString()} ft
                  </span>
                </div>

                <button
                  onClick={refreshWeather}
                  disabled={isWeatherLoading}
                  className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Refresh weather (auto-refreshes every 5 min)"
                >
                  {isWeatherLoading ? (
                    <Loader2 className="w-3.5 h-3.5 text-orange-200/60 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-orange-200/60" />
                  )}
                </button>
              </>
            ) : isWeatherLoading ? (
              <div className="flex items-center gap-2 text-orange-200/60 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading weather...</span>
              </div>
            ) : (
              <span className="text-orange-200/50 text-xs">Weather unavailable</span>
            )}
          </div>

          {/* Right: Pass Counter + Quick Nav + Exit */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Pass Counter */}
            <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2.5 sm:px-3 py-1.5">
              <Flag className="w-4 h-4 text-yellow-300 flex-shrink-0" />
              <div className="text-center">
                <span className="text-xl sm:text-2xl font-bold text-white font-mono leading-none">
                  {todayPassCount}
                </span>
                <span className="text-[9px] text-orange-200/60 uppercase tracking-wider block leading-none mt-0.5">
                  Passes
                </span>
              </div>
            </div>

            {/* Quick Nav Buttons (desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { id: 'teamdash', icon: Radio, label: 'Dashboard' },
                { id: 'passlog', icon: ClipboardList, label: 'Pass Log' },
                { id: 'checklists', icon: CheckSquare, label: 'Checklists' },
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'text-orange-200/70 hover:bg-white/10 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Exit Race Day Mode */}
            <button
              onClick={disableRaceDayMode}
              className="flex items-center gap-1 px-2 py-1.5 bg-black/20 hover:bg-black/30 rounded-lg text-orange-200/80 hover:text-white transition-colors text-xs"
              title="Exit Race Day Mode"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Weather Row */}
      {weatherSummary && (
        <div className="lg:hidden border-t border-orange-500/30 px-3 py-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {getWeatherIcon(weatherSummary.conditions)}
                <span className="text-white font-bold">{weatherSummary.temperature}°F</span>
              </div>
              <span className="text-orange-200/70">{weatherSummary.humidity}% RH</span>
              <span className="text-orange-200/70">{weatherSummary.windSpeed} mph</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-200/60 text-[10px]">SAE</span>
              <span className={`font-mono font-bold ${getSAEColor(weatherSummary.saeCorrection)}`}>
                {weatherSummary.saeCorrection.toFixed(3)}
              </span>
              <span className="text-orange-200/60 font-mono text-[10px]">
                DA {weatherSummary.densityAltitude.toLocaleString()}'
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceDayBanner;
