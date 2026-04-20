import React, { useState, useEffect } from 'react';
import { Cloud, Radio, Satellite, Wind, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  WeatherSource,
  WEATHER_SOURCE_LABELS,
  WEATHER_SOURCE_DESCRIPTIONS,
  getStoredWeatherSource,
  setStoredWeatherSource,
  fetchOpenMeteo,
  fetchNWS,
  fetchAeris,
  ProviderObservation,
} from '@/lib/weatherProviders';
import { __fetchWeatherApiObservation, calculateSAECorrection, isWeatherConfigured } from '@/lib/weather';

const SOURCE_ICONS: Record<WeatherSource, React.ComponentType<{ className?: string }>> = {
  weatherapi: Cloud,
  openmeteo: Satellite,
  nws: Radio,
  aeris: Wind,
};

interface CompareRow {
  source: WeatherSource;
  label: string;
  loading: boolean;
  error?: string;
  obs?: ProviderObservation;
  sae?: number;
  da?: number;
  hp?: number;
}

interface Props {
  trackLocation?: string;
  trackElevation?: number;
}

const WeatherSourceSettings: React.FC<Props> = ({ trackLocation = 'auto:ip', trackElevation = 0 }) => {
  const { profile, updateProfile, isAuthenticated, isDemoMode } = useAuth();
  const [selected, setSelected] = useState<WeatherSource>(() => getStoredWeatherSource());
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [comparing, setComparing] = useState(false);

  // Sync from profile on first load
  useEffect(() => {
    if (profile?.weatherSource && profile.weatherSource !== selected) {
      setSelected(profile.weatherSource);
      setStoredWeatherSource(profile.weatherSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.weatherSource]);

  const handleChoose = async (src: WeatherSource) => {
    setSelected(src);
    setStoredWeatherSource(src);
    toast.success(`Weather source set to ${WEATHER_SOURCE_LABELS[src]}`);
    if (isAuthenticated && !isDemoMode) {
      setSaving(true);
      try {
        await updateProfile({ weatherSource: src });
      } catch (e) {
        console.warn('[WeatherSourceSettings] profile save failed (local override kept):', e);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCompare = async () => {
    setComparing(true);
    const sources: WeatherSource[] = ['weatherapi', 'openmeteo', 'nws', 'aeris'];
    const initial: CompareRow[] = sources.map(s => ({ source: s, label: WEATHER_SOURCE_LABELS[s], loading: true }));
    setRows(initial);

    const loc = trackLocation || 'auto:ip';
    const fetchers: Record<WeatherSource, (l: string) => Promise<ProviderObservation>> = {
      weatherapi: __fetchWeatherApiObservation,
      openmeteo: fetchOpenMeteo,
      nws: fetchNWS,
      aeris: fetchAeris,
    };

    await Promise.all(sources.map(async (src) => {
      try {
        if (src === 'weatherapi' && !isWeatherConfigured()) {
          throw new Error('VITE_WEATHER_API_KEY not configured');
        }
        const obs = await fetchers[src](loc);
        const sae = calculateSAECorrection(obs.temperature, obs.pressure, obs.humidity, trackElevation);
        setRows(prev => prev.map(r => r.source === src ? {
          ...r, loading: false, obs, sae: sae.saeCorrection, da: sae.densityAltitude, hp: sae.correctedHP,
        } : r));
      } catch (e) {
        setRows(prev => prev.map(r => r.source === src ? {
          ...r, loading: false, error: e instanceof Error ? e.message : String(e),
        } : r));
      }
    }));
    setComparing(false);
  };

  // Compute DA delta range for UX hint
  const successfulRows = rows.filter(r => !r.error && typeof r.da === 'number');
  const daRange = successfulRows.length >= 2
    ? Math.max(...successfulRows.map(r => r.da!)) - Math.min(...successfulRows.map(r => r.da!))
    : 0;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cloud className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-100">Weather Source</h3>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <p className="text-sm text-slate-400">
          Choose which upstream provider powers every temp/humidity/pressure reading in the app — Log Pass, Weather Widget,
          and Race Day Forecast.  DA &amp; SAE are computed the same way across all providers, so cross-checks vs. your handheld
          are apples-to-apples.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(['weatherapi', 'openmeteo', 'nws', 'aeris'] as WeatherSource[]).map(src => {
          const Icon = SOURCE_ICONS[src];
          const isSelected = selected === src;
          return (
            <button
              key={src}
              onClick={() => handleChoose(src)}
              className={`text-left border rounded-lg p-4 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/40'
                  : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                      {WEATHER_SOURCE_LABELS[src]}
                    </span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {WEATHER_SOURCE_DESCRIPTIONS[src]}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-700 pt-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h4 className="font-semibold text-slate-100">Compare Sources</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Fetches all four providers at once so you can see which matches your trackside weather station best.
              {trackLocation && trackLocation !== 'auto:ip' && (
                <span className="block mt-1">
                  Location: <span className="text-slate-300 font-mono">{trackLocation}</span>
                  {trackElevation > 0 && <span> · elev {trackElevation} ft</span>}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md flex items-center gap-2 flex-shrink-0"
          >
            {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            {comparing ? 'Fetching…' : 'Run Comparison'}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 px-3 text-right">Temp</th>
                  <th className="py-2 px-3 text-right">RH</th>
                  <th className="py-2 px-3 text-right">Pressure</th>
                  <th className="py-2 px-3 text-right">DA</th>
                  <th className="py-2 px-3 text-right">SAE</th>
                  <th className="py-2 pl-3 text-right">Corr HP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.source} className="border-b border-slate-800">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${selected === r.source ? 'text-blue-300' : 'text-slate-200'}`}>
                          {r.label}
                        </span>
                        {selected === r.source && <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">active</span>}
                      </div>
                      {r.obs?.rawStation && (
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{r.obs.rawStation}</div>
                      )}
                    </td>
                    {r.loading ? (
                      <td colSpan={6} className="py-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin inline" /> fetching…
                      </td>
                    ) : r.error ? (
                      <td colSpan={6} className="py-2 text-amber-400">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        {r.error}
                      </td>
                    ) : r.obs ? (
                      <>
                        <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{r.obs.temperature.toFixed(1)}°F</td>
                        <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{r.obs.humidity}%</td>
                        <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{r.obs.pressure.toFixed(2)}"</td>
                        <td className="py-2 px-3 text-right text-slate-200 tabular-nums font-semibold">{r.da} ft</td>
                        <td className="py-2 px-3 text-right text-slate-200 tabular-nums">{r.sae?.toFixed(3)}</td>
                        <td className="py-2 pl-3 text-right text-slate-200 tabular-nums">{r.hp} hp</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {successfulRows.length >= 2 && (
              <div className={`mt-3 text-xs p-3 rounded-md border ${
                daRange > 300
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}>
                <strong>DA spread across providers: {daRange} ft</strong>
                {daRange > 300
                  ? ' — providers disagree significantly. Pick the one that matches your trackside weather station.'
                  : ' — all providers agree within a tight margin. Any of them will match your handheld closely.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherSourceSettings;
