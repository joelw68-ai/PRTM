// ─── Weather Provider Adapter Layer ──────────────────────────────────────────
//
// Lets the user pick which upstream weather source powers every temp/humidity/
// pressure number in the app (Log Pass modal, Weather Widget, Race Day Forecast,
// Compare Sources diagnostic).  DA / SAE / corrected-HP are always computed
// from the chosen provider's raw numbers using the same Patrick-Hale + J607
// formulas in '@/lib/weather', so cross-provider comparisons are apples-to-apples.
//
// Providers supported:
//   • weatherapi  — WeatherAPI.com (current default, paid key in VITE_WEATHER_API_KEY)
//   • openmeteo   — Open-Meteo (free, no key, DWD + GFS + HRRR ensemble)
//   • nws         — NOAA / NWS METAR (free, US-only, nearest observation station)
//   • aeris       — AerisWeather / Xweather (the exact provider DRWS pulls from)
//
// All providers return a common shape so the DA/SAE math downstream doesn't care
// which source produced it.

import { supabase } from './supabase';

export type WeatherSource = 'weatherapi' | 'openmeteo' | 'nws' | 'aeris';

export const WEATHER_SOURCE_LABELS: Record<WeatherSource, string> = {
  weatherapi: 'WeatherAPI.com',
  openmeteo: 'Open-Meteo (DWD/GFS)',
  nws: 'NOAA / NWS METAR (US only)',
  aeris: 'AerisWeather (DRWS upstream)',
};

export const WEATHER_SOURCE_DESCRIPTIONS: Record<WeatherSource, string> = {
  weatherapi: 'Global coverage, 1 hr resolution. Requires paid VITE_WEATHER_API_KEY.',
  openmeteo: 'Free, no API key. DWD + GFS + HRRR ensemble. Good global accuracy.',
  nws: 'Pulls the nearest METAR observation — the same data most weather stations compile. US tracks only.',
  aeris: 'The upstream provider powering the Drag Racing Weather Station app. Use this to match DRWS exactly.',
};

export const WEATHER_SOURCE_KEY = 'promod_weather_source';

export interface ProviderObservation {
  temperature: number;   // °F
  humidity: number;      // %
  pressure: number;      // inHg (sea-level corrected / altimeter setting)
  stationPressure?: number | null; // inHg (raw, if provider reports it separately)
  windSpeed: number;     // mph
  windGust?: number;     // mph
  windDirection: string;
  windDegree: number;
  conditions: string;
  conditionIcon?: string;
  dewPoint: number;      // °F
  feelsLike?: number;
  visibility?: number;   // miles
  uvIndex?: number;
  cloudCover?: number;   // %
  precipInches?: number;
  location: string;
  region: string;
  country?: string;
  localTime?: string;
  isDay?: boolean;
  provider: WeatherSource;
  timestamp?: string;
  rawStation?: string | null;
}

// ─── Local preference storage ────────────────────────────────────────────────

export function getStoredWeatherSource(): WeatherSource {
  try {
    const v = localStorage.getItem(WEATHER_SOURCE_KEY);
    if (v === 'weatherapi' || v === 'openmeteo' || v === 'nws' || v === 'aeris') return v;
  } catch {}
  return 'weatherapi';
}

export function setStoredWeatherSource(src: WeatherSource): void {
  try { localStorage.setItem(WEATHER_SOURCE_KEY, src); } catch {}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function degToDir(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function calcDewPoint(tempF: number, rh: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27, b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(Math.max(rh, 0.01) / 100);
  const dewC = (b * alpha) / (a - alpha);
  return Math.round(((dewC * 9 / 5) + 32) * 10) / 10;
}

// ─── Geocoding (lat/lon resolution) ─────────────────────────────────────────
// Open-Meteo provides a free geocoding endpoint with no key required.
// We use it for BOTH Open-Meteo and NWS (which both require lat/lon) so
// users can enter "Galot Motorsports Park" or "Benson, NC" uniformly.

interface GeoResult { lat: number; lon: number; name: string; region: string; country?: string; }

async function geocode(query: string): Promise<GeoResult | null> {
  // Direct lat,lon input — skip geocoding
  const coordMatch = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]), name: '', region: '' };
  }

  // auto:ip — use Open-Meteo's built-in client IP geolocation by falling back
  // to a generic IP lookup.  Kept simple: use ipapi.co which is CORS-friendly.
  if (query === 'auto:ip' || query === 'auto') {
    try {
      const r = await fetch('https://ipapi.co/json/');
      const d = await r.json();
      if (d?.latitude && d?.longitude) {
        return { lat: d.latitude, lon: d.longitude, name: d.city || '', region: d.region || '', country: d.country_name };
      }
    } catch {}
    return null;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const first = d?.results?.[0];
  if (!first) return null;
  return {
    lat: first.latitude,
    lon: first.longitude,
    name: first.name || '',
    region: first.admin1 || '',
    country: first.country,
  };
}

// ─── Open-Meteo provider ─────────────────────────────────────────────────────

export async function fetchOpenMeteo(location: string): Promise<ProviderObservation> {
  const geo = await geocode(location);
  if (!geo) throw new Error(`Open-Meteo: could not geocode "${location}"`);

  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lon),
    current: 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,cloud_cover,is_day',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
  });

  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const d = await r.json();
  const c = d.current || {};

  // Open-Meteo gives us surface_pressure (station, hPa) directly — huge win vs.
  // WeatherAPI.  Convert hPa → inHg: 1 hPa = 0.02953 inHg.
  const slpInHg = (c.pressure_msl ?? 1013.25) * 0.02953;
  const stationInHg = c.surface_pressure != null ? c.surface_pressure * 0.02953 : null;

  const tempF = c.temperature_2m ?? 0;
  const humidity = c.relative_humidity_2m ?? 0;
  const windMph = c.wind_speed_10m ?? 0;
  const windDeg = c.wind_direction_10m ?? 0;

  // Weather code → text (WMO mapping, abbreviated)
  const wmo: Record<number, string> = {
    0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
    80: 'Rain Showers', 81: 'Heavy Rain Showers', 82: 'Violent Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Severe Thunderstorm',
  };
  const conditions = wmo[c.weather_code as number] || 'Clear';

  return {
    temperature: Math.round(tempF * 10) / 10,
    humidity: Math.round(humidity),
    pressure: Math.round(slpInHg * 100) / 100,
    stationPressure: stationInHg != null ? Math.round(stationInHg * 100) / 100 : null,
    windSpeed: Math.round(windMph),
    windGust: c.wind_gusts_10m ? Math.round(c.wind_gusts_10m) : 0,
    windDirection: degToDir(windDeg),
    windDegree: windDeg,
    conditions,
    conditionIcon: '',
    dewPoint: Math.round((c.dew_point_2m ?? calcDewPoint(tempF, humidity)) * 10) / 10,
    feelsLike: c.apparent_temperature ? Math.round(c.apparent_temperature) : Math.round(tempF),
    cloudCover: c.cloud_cover ?? 0,
    precipInches: 0,
    location: geo.name,
    region: geo.region,
    country: geo.country,
    localTime: c.time,
    isDay: c.is_day === 1,
    provider: 'openmeteo',
    timestamp: c.time,
    rawStation: null,
  };
}

// ─── NOAA / NWS METAR provider ───────────────────────────────────────────────

export async function fetchNWS(location: string): Promise<ProviderObservation> {
  const geo = await geocode(location);
  if (!geo) throw new Error(`NWS: could not geocode "${location}"`);

  // Step 1: find the nearest NWS point (returns grid + nearest station list URL)
  const pointUrl = `https://api.weather.gov/points/${geo.lat.toFixed(4)},${geo.lon.toFixed(4)}`;
  const pr = await fetch(pointUrl, { headers: { 'Accept': 'application/geo+json' } });
  if (!pr.ok) throw new Error(`NWS: no coverage at ${geo.lat.toFixed(2)},${geo.lon.toFixed(2)} — NOAA/NWS only covers the US & territories.`);
  const pd = await pr.json();
  const stationsUrl = pd?.properties?.observationStations;
  if (!stationsUrl) throw new Error('NWS: no observation stations link returned.');

  // Step 2: pick the first (nearest) station
  const sr = await fetch(stationsUrl, { headers: { 'Accept': 'application/geo+json' } });
  const sd = await sr.json();
  const stationId = sd?.features?.[0]?.properties?.stationIdentifier;
  if (!stationId) throw new Error('NWS: no METAR stations found nearby.');

  // Step 3: latest observation
  const or = await fetch(`https://api.weather.gov/stations/${stationId}/observations/latest`, {
    headers: { 'Accept': 'application/geo+json' },
  });
  if (!or.ok) throw new Error(`NWS: observation fetch failed (${or.status})`);
  const od = await or.json();
  const p = od?.properties || {};

  // NWS returns values in SI with unit codes. Convert:
  //   temperature.value is °C, barometricPressure is Pa (station pressure),
  //   seaLevelPressure is Pa (SLP), windSpeed is km/h, windDirection is deg.
  const tempC = p.temperature?.value;
  const tempF = tempC != null ? (tempC * 9/5 + 32) : 0;
  const humidity = p.relativeHumidity?.value ?? 0;
  const dewC = p.dewpoint?.value;
  const dewF = dewC != null ? (dewC * 9/5 + 32) : calcDewPoint(tempF, humidity);
  const stationPa = p.barometricPressure?.value; // station pressure (Pa)
  const slpPa = p.seaLevelPressure?.value ?? stationPa;
  const stationInHg = stationPa != null ? stationPa * 0.0002953 : null;
  const slpInHg = slpPa != null ? slpPa * 0.0002953 : 29.92;
  const windKmh = p.windSpeed?.value ?? 0;
  const windMph = windKmh * 0.621371;
  const windDeg = p.windDirection?.value ?? 0;
  const gustKmh = p.windGust?.value ?? 0;
  const conditions = p.textDescription || 'Clear';

  return {
    temperature: Math.round(tempF * 10) / 10,
    humidity: Math.round(humidity),
    pressure: Math.round(slpInHg * 100) / 100,
    stationPressure: stationInHg != null ? Math.round(stationInHg * 100) / 100 : null,
    windSpeed: Math.round(windMph),
    windGust: Math.round(gustKmh * 0.621371),
    windDirection: degToDir(windDeg),
    windDegree: windDeg,
    conditions,
    conditionIcon: p.icon || '',
    dewPoint: Math.round(dewF * 10) / 10,
    feelsLike: Math.round(tempF),
    cloudCover: 0,
    precipInches: 0,
    location: geo.name,
    region: geo.region,
    country: 'US',
    localTime: p.timestamp || '',
    isDay: true,
    provider: 'nws',
    timestamp: p.timestamp,
    rawStation: stationId,
  };
}

// ─── AerisWeather provider (via edge function) ───────────────────────────────

export async function fetchAeris(location: string): Promise<ProviderObservation> {
  const { data, error } = await supabase.functions.invoke('fetch-aeris-weather', {
    body: { location },
  });
  if (error) throw new Error(`AerisWeather: ${error.message}`);
  if (!data || data.error) throw new Error(`AerisWeather: ${data?.error || 'unknown error'}`);

  return {
    temperature: data.temperature,
    humidity: data.humidity,
    pressure: data.pressure,
    stationPressure: data.stationPressure ?? null,
    windSpeed: data.windSpeed,
    windGust: 0,
    windDirection: data.windDirection,
    windDegree: data.windDegree,
    conditions: data.conditions,
    conditionIcon: '',
    dewPoint: data.dewPoint,
    feelsLike: data.temperature,
    cloudCover: 0,
    precipInches: 0,
    location: data.location || '',
    region: data.region || '',
    country: data.country || '',
    localTime: data.timestamp || '',
    isDay: true,
    provider: 'aeris',
    timestamp: data.timestamp || undefined,
    rawStation: data.rawStation || null,
  };
}

// ─── Unified dispatch ────────────────────────────────────────────────────────

export async function fetchObservationFromProvider(
  source: WeatherSource,
  location: string
): Promise<ProviderObservation> {
  switch (source) {
    case 'openmeteo': return fetchOpenMeteo(location);
    case 'nws':       return fetchNWS(location);
    case 'aeris':     return fetchAeris(location);
    case 'weatherapi':
    default:
      // Lazy import to avoid circular dep — weather.ts imports from here too.
      const mod = await import('./weather');
      const r = await mod.__fetchWeatherApiObservation(location);
      return r;
  }
}
