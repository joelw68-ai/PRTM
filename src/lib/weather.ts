// Weather API utility — calls WeatherAPI.com directly from the browser.
// API key is read from the VITE_WEATHER_API_KEY environment variable.
//
// ─── Vercel Deployment ───────────────────────────────────────────────────────
// In Vercel → Settings → Environment Variables, add:
//   Name:  VITE_WEATHER_API_KEY
//   Value: <your WeatherAPI.com key>
//
// IMPORTANT: This is a Vite app, NOT Next.js.  Vite requires the VITE_ prefix
// (not NEXT_PUBLIC_) for client-side env vars.  The variable is baked into the
// JS bundle at build time via import.meta.env.
//
// After adding/changing the env var in Vercel you MUST redeploy for the new
// value to take effect (Vercel → Deployments → Redeploy).
// ─────────────────────────────────────────────────────────────────────────────
import { parseLocalDate, getLocalDateString } from './utils';



// ─── Configuration ───────────────────────────────────────────────────────────

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY ?? '';
const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

// Startup diagnostic — logs once when the module is first imported so you can
// immediately see in the browser console whether the key was injected.
if (WEATHER_API_KEY) {
  // Only log the first/last 3 chars so the full key is never exposed in logs
  const masked = WEATHER_API_KEY.length > 6
    ? `${WEATHER_API_KEY.slice(0, 3)}...${WEATHER_API_KEY.slice(-3)}`
    : '***';
  console.log(`[weather] API key loaded (${masked}), length=${WEATHER_API_KEY.length}`);
} else {
  console.warn(
    '[weather] VITE_WEATHER_API_KEY is NOT set.\n' +
    '  → For local dev: create a .env file with VITE_WEATHER_API_KEY=your_key\n' +
    '  → For Vercel: add VITE_WEATHER_API_KEY in Settings → Environment Variables, then redeploy.\n' +
    '  → NOTE: This is a Vite app — use VITE_ prefix, NOT NEXT_PUBLIC_.'
  );
}

/**
 * Check whether the weather API key is configured.
 * Components can call this to show a helpful "not configured" state
 * instead of triggering a fetch that will always fail.
 */
export function isWeatherConfigured(): boolean {
  return WEATHER_API_KEY.length > 0;
}

/**
 * Returns a diagnostic object for debugging weather configuration issues.
 * Safe to call from browser console: `import('@/lib/weather').then(m => console.table(m.getWeatherDiagnostics()))`
 */
export function getWeatherDiagnostics(): Record<string, string | boolean | number> {
  return {
    keyPresent: WEATHER_API_KEY.length > 0,
    keyLength: WEATHER_API_KEY.length,
    keyPreview: WEATHER_API_KEY.length > 6
      ? `${WEATHER_API_KEY.slice(0, 3)}...${WEATHER_API_KEY.slice(-3)}`
      : WEATHER_API_KEY.length > 0 ? '***' : '(empty)',
    apiBase: WEATHER_API_BASE,
    envVarName: 'VITE_WEATHER_API_KEY',
    framework: 'Vite (use VITE_ prefix, not NEXT_PUBLIC_)',
    hint: WEATHER_API_KEY.length === 0
      ? 'Add VITE_WEATHER_API_KEY to Vercel env vars and redeploy'
      : 'Key is configured — if weather still fails, verify the key is valid at weatherapi.com',
  };
}


// ─── Shared helper: call WeatherAPI.com directly with retry ──────────────────

type WeatherEndpoint = 'current' | 'forecast' | 'history';

interface WeatherApiParams {
  endpoint: WeatherEndpoint;
  location: string;
  date?: string;
  days?: number;
  aqi?: string;
  alerts?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call WeatherAPI.com directly from the browser with retry logic.
 */
async function callWeatherApi(params: WeatherApiParams, maxRetries: number = 2): Promise<Record<string, unknown>> {
  if (!WEATHER_API_KEY) {
    throw new Error(
      'Weather API key is not configured. Please set VITE_WEATHER_API_KEY in your environment variables.'
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Build the URL with query parameters
      const queryParams = new URLSearchParams();
      queryParams.set('key', WEATHER_API_KEY);
      queryParams.set('q', params.location || 'auto:ip');

      if (params.endpoint === 'forecast') {
        queryParams.set('days', String(params.days || 1));
        queryParams.set('aqi', params.aqi || 'no');
        queryParams.set('alerts', params.alerts || 'no');
      }

      // Pass `dt` for BOTH history AND forecast endpoints when a date is
      // provided.  For history it selects the archive day; for forecast it
      // tells the API which date to start from, ensuring the response
      // contains the exact calendar day the caller requested rather than
      // relying on the server's idea of "today" (which could differ near
      // midnight / across timezones).
      //
      // IMPORTANT: `params.date` is always a plain YYYY-MM-DD string that
      // originated from the user's date-picker or from getLocalDateString().
      // It is NEVER derived from a Date object via toISOString(), so there
      // is no UTC off-by-one risk here.
      if ((params.endpoint === 'history' || params.endpoint === 'forecast') && params.date) {
        queryParams.set('dt', params.date);
        console.log(`[callWeatherApi] Setting dt=${params.date} for ${params.endpoint} endpoint (pure string, no Date object)`);
      }

      const url = `${WEATHER_API_BASE}/${params.endpoint}.json?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse the response
      let data: unknown;
      const responseText = await response.text();

      try {
        data = JSON.parse(responseText);
      } catch {
        console.warn(`[weather] Non-JSON response (HTTP ${response.status}), attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          await sleep((attempt + 1) * 600);
          continue;
        }
        throw new Error(`Weather service returned an invalid response (HTTP ${response.status}).`);
      }

      // Check for HTTP errors
      if (!response.ok) {
        const errData = data as Record<string, unknown>;
        const errObj = errData?.error as Record<string, unknown> | undefined;
        const errorMsg = (errObj?.message as string) || `HTTP ${response.status}`;
        const retryable = response.status >= 500;

        if (retryable && attempt < maxRetries) {
          console.warn(`[weather] Retryable error on attempt ${attempt + 1}: ${errorMsg}`);
          await sleep((attempt + 1) * 600);
          continue;
        }

        throw new Error(errorMsg);
      }

      return data as Record<string, unknown>;
    } catch (err) {
      clearTimeout(timeoutId);
      const error = err instanceof Error ? err : new Error(String(err));

      // Classify the error
      const isAbort = error.name === 'AbortError';
      const isNetwork =
        isAbort ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Load failed') ||
        error.message.includes('fetch');

      if (isNetwork && attempt < maxRetries) {
        console.warn(`[weather] Network error on attempt ${attempt + 1}/${maxRetries + 1}: ${isAbort ? 'timeout' : error.message}`);
        await sleep((attempt + 1) * 800);
        lastError = error;
        continue;
      }

      // If it's already a well-formatted error from above, throw it directly
      if (!isNetwork) {
        throw error;
      }

      lastError = error;
    }
  }

  // All retries exhausted — throw a user-friendly network error
  throw new Error(
    'Weather service is temporarily unavailable. Please try again in a moment.'
  );
}


// ─── Public types ────────────────────────────────────────────────────────────

interface WeatherResult {
  weather: {
    temperature: number;    // °F
    humidity: number;       // %
    pressure: number;       // inHg
    windSpeed: number;      // mph
    windDirection: string;  // N, NE, etc.
    conditions: string;     // Clear, Cloudy, etc.
    location: string;
    region: string;
    dewPoint?: number;      // °F
  };
  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
  isHistorical: boolean;
}

export interface WeatherWidgetData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  windDegree: number;
  conditions: string;
  conditionIcon: string;
  dewPoint: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  precipInches: number;
  location: string;
  region: string;
  country: string;
  localTime: string;
  isDay: boolean;
  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
  hourlyForecast: HourlyForecast[];
  lastUpdated: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  conditions: string;
  conditionIcon: string;
  chanceOfRain: number;
  dewPoint: number;
  saeCorrection: number;
  densityAltitude: number;
}

export function calculateDewPoint(tempF: number, humidityPct: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidityPct / 100);
  const dewPointC = (b * alpha) / (a - alpha);
  const dewPointF = (dewPointC * 9 / 5) + 32;
  return Math.round(dewPointF * 10) / 10;
}

// ─── Sea-Level Pressure → Station Pressure conversion ────────────────────────
//
// Weather APIs (WeatherAPI.com, OpenWeatherMap, etc.) report "barometric
// pressure" which is actually the sea-level corrected pressure (QNH in
// aviation terms).  This is the pressure adjusted as if the station were at
// sea level, so that weather maps show meaningful isobars.
//
// Drag racing weather stations (Computech, RaceAir, Altus, Kestrel) measure
// STATION PRESSURE — the actual atmospheric pressure at the sensor's
// elevation.  Station pressure is always LOWER than sea-level pressure at
// any elevation above sea level.
//
// The density altitude formula requires STATION PRESSURE to produce correct
// results.  Using sea-level corrected pressure in the DA formula gives a DA
// that is too low by roughly the track's physical elevation.
//
// Conversion (ISA barometric formula):
//   P_station = P_slp × (1 − L × h / T0)^(g·M/(R·L))
//
// Where:
//   L  = 0.0065 K/m   (ISA temperature lapse rate)
//   T0 = 288.15 K     (ISA sea-level temperature)
//   g  = 9.80665 m/s²
//   M  = 0.0289644 kg/mol (molar mass of dry air)
//   R  = 8.31447 J/(mol·K)
//   g·M/(R·L) = 5.2561
//   h  = elevation in meters = elevationFt × 0.3048
//
// Simplified:
//   P_station = P_slp × (1 − elevationFt / 145442.16)^5.2561
//
// Examples:
//   500 ft elevation, 29.92" SLP → 29.38" station pressure
//   1000 ft elevation, 29.92" SLP → 28.86" station pressure
//
export function convertSLPtoStationPressure(slpInHg: number, elevationFt: number): number {
  if (elevationFt <= 0) return slpInHg;
  return slpInHg * Math.pow(1 - elevationFt / 145442.16, 5.2561);
}

// ─── Density Altitude (Drag Racing Weather Station / Patrick Hale formula) ──
//
// This app now uses the SAME density-altitude formula as the popular
// "Drag Racing Weather Station" (DRWS) app by Patrick Hale, as well as
// Computech, RaceAir, Altus, and the NHRA-standard handheld weather stations.
//
// ── The Patrick Hale / NHRA formula ──
//
//   DA = 145366 × (1 − (17.326 × P / (459.67 + T))^0.235)
//
//   where:
//     P = ABSOLUTE (station) pressure in inHg
//     T = air temperature in °F
//     17.326 = 518.67 / 29.92  (ISA standard T°R / standard pressure inHg)
//     0.235  ≈ R·L / (g·M − R·L)  (same exponent as NWS formula)
//     145366 ≈ T0/L in feet (ISA temperature divided by lapse rate)
//
// This is the "dry" density-altitude — it does NOT include a humidity
// correction via virtual temperature.  DRWS and other drag-racing weather
// stations report two altitudes:
//
//   • Density Altitude (DA)     — uses STATION pressure, no humidity
//   • Corrected Altitude (CA)   — uses DRY pressure (station − vapor)
//
// The DA number is what DRWS displays as the headline "DA" reading and is
// the one most racers reference when tuning.  The CA (sometimes labelled
// "Grains-Corrected DA") accounts for water vapor and is typically a few
// hundred feet higher on a humid day.
//
// ── Why the switch ──
//
// The previous implementation used the NWS/NOAA virtual-temperature formula
// which is scientifically accurate but produces values that differ by a few
// hundred feet from what DRWS / Computech / RaceAir / Altus report.  Racers
// cross-checking against their handheld weather stations were seeing a
// mismatch, so we've aligned with the industry-standard racing formula.
//
// ── Pressure input ──
//
//   • If pressureInHg is from a WEATHER API (WeatherAPI.com, etc.) it's
//     sea-level-corrected (QNH).  Pass elevationFt so we convert to
//     station pressure first.
//   • If pressureInHg is from a DRAG RACING WEATHER STATION (Kestrel,
//     Computech, RaceAir, Altus, DRWS) it's already station pressure.
//     Pass elevationFt = 0 (or omit) — no conversion applied.
//
// Examples (sea level, 29.92 inHg station pressure):
//   59°F  → DA ≈    0 ft   (ISA standard)
//   80°F  → DA ≈ 1300 ft
//   95°F  → DA ≈ 2200 ft
//
export function calculateDensityAltitude(
  tempF: number,
  pressureInHg: number,
  humidityPct: number,   // kept in signature for API compatibility; not used
  elevationFt: number = 0
): number {
  // Convert sea-level pressure to station pressure when elevation is given
  const stationPressureInHg = elevationFt > 0
    ? convertSLPtoStationPressure(pressureInHg, elevationFt)
    : pressureInHg;

  // Patrick Hale / NHRA drag-racing DA formula (matches DRWS):
  //   DA = 145366 × (1 − (17.326 × P / (459.67 + T))^0.235)
  void humidityPct; // humidity not used in the headline DA — see calculateCorrectedAltitude
  const base = (17.326 * stationPressureInHg) / (459.67 + tempF);
  const DA = 145366 * (1 - Math.pow(base, 0.235));

  return Math.round(DA);
}

// ─── Corrected Altitude (Grains-Corrected DA, DRWS "CA") ─────────────────────
//
// Same Patrick-Hale formula as DA, but fed DRY pressure (station − vapor)
// so water vapor is accounted for.  DRWS displays this alongside DA and
// most tuners use this number for heads-up tuning in humid conditions.
//
//   CA = 145366 × (1 − (17.326 × Pd / (459.67 + T))^0.235)
//   where Pd = station pressure − actual vapor pressure
//
export function calculateCorrectedAltitude(
  tempF: number,
  pressureInHg: number,
  humidityPct: number,
  elevationFt: number = 0
): number {
  const stationPressureInHg = elevationFt > 0
    ? convertSLPtoStationPressure(pressureInHg, elevationFt)
    : pressureInHg;

  const satVP = accurateSatVaporPressureInHg(tempF);
  const actualVP = (humidityPct / 100) * satVP;
  const dryPressure = stationPressureInHg - actualVP;
  if (dryPressure <= 0) return calculateDensityAltitude(tempF, stationPressureInHg, humidityPct, 0);

  const base = (17.326 * dryPressure) / (459.67 + tempF);
  const CA = 145366 * (1 - Math.pow(base, 0.235));

  return Math.round(CA);
}

// ─── Air Density (DRWS / NHRA) ───────────────────────────────────────────────
//
// Returns air density as a percentage of ISA standard (1.000 = STP).
// Formula used by Drag Racing Weather Station and most NHRA apps:
//
//   ρ_relative = (Pd/29.92 + Pv/29.92 × 0.378) × (519.67 / (459.67 + T))
//
// where:
//   Pd = dry pressure (inHg)
//   Pv = vapor pressure (inHg)
//   T  = air temp (°F)
//   0.378 = 1 − (Mw/Md)   (water-vapor / dry-air molecular-weight ratio)
//
// Multiply by the ISA reference density (0.07647 lb/ft³) to get absolute
// density if needed.  We return the dimensionless relative density here.
//
export function calculateAirDensity(
  tempF: number,
  pressureInHg: number,
  humidityPct: number,
  elevationFt: number = 0
): number {
  const stationPressureInHg = elevationFt > 0
    ? convertSLPtoStationPressure(pressureInHg, elevationFt)
    : pressureInHg;

  const satVP = accurateSatVaporPressureInHg(tempF);
  const actualVP = (humidityPct / 100) * satVP;
  const dryPressure = stationPressureInHg - actualVP;

  const pressureTerm = (dryPressure / 29.92) + (actualVP / 29.92) * 0.378;
  const tempTerm = 519.67 / (459.67 + tempF);
  const relativeDensity = pressureTerm * tempTerm;

  return Math.round(relativeDensity * 1000) / 1000;
}

function calculateSAECorrectionInternal(
  tempF: number,
  pressureInHg: number,
  humidityPct: number,
  elevationFt: number = 0
) {
  // Convert SLP → station pressure if an elevation was provided.
  // Drag-racing weather stations (Kestrel / DRWS / RaceAir / Altus) measure
  // station pressure directly, so this is a no-op for hand-entered data
  // but is essential for WeatherAPI.com values (which are SLP / QNH).
  const stationPressure = elevationFt > 0
    ? convertSLPtoStationPressure(pressureInHg, elevationFt)
    : pressureInHg;

  // ── SAE J607 Correction Factor (drag-racing standard, matches DRWS) ──
  //
  //   CF = (29.92 / Pd) × sqrt((T + 460) / 520)
  //
  // where:
  //   Pd = dry pressure  = station pressure − actual vapor pressure  (inHg)
  //   T  = air temperature (°F)
  //   29.92 = SAE J607 reference total pressure at 0% RH (dry)
  //   520   = 60°F in Rankine  (SAE J607 reference temperature)
  //
  // This is the canonical single-pressure-term J607 formula used by
  // Drag Racing Weather Station, Computech, RaceAir, Altus, and NHRA
  // naturally-aspirated HP tables.  The previous implementation squared
  // the pressure into two separate sqrt factors (station × dry), which
  // under-corrected on low-pressure days and over-corrected on humid
  // ones.  The single-term J607 form is the one the racing community
  // has standardised on.
  //
  // Uses the accurate Buck equation for saturation vapor pressure
  // (accurateSatVaporPressureInHg) for consistency with water-grains
  // and STD-correction calculations.
  const satVaporPressure = accurateSatVaporPressureInHg(tempF);
  const actualVaporPressure = (humidityPct / 100) * satVaporPressure;
  const dryPressure = stationPressure - actualVaporPressure;

  const tempFactor = Math.sqrt((tempF + 460) / 520);
  const pressureFactor = dryPressure > 0 ? (29.92 / dryPressure) : 1;
  const saeCorrection = tempFactor * pressureFactor;

  // Density altitude — uses the Patrick Hale / DRWS formula via
  // calculateDensityAltitude (station pressure already converted above).
  const densityAltitude = calculateDensityAltitude(tempF, stationPressure, humidityPct, 0);

  const correctedHP = Math.round(3500 * saeCorrection);
  return {
    saeCorrection: Math.round(saeCorrection * 1000) / 1000,
    densityAltitude,
    correctedHP,
  };
}




// Re-export under the public name used by consumers
export const calculateSAECorrection = calculateSAECorrectionInternal;


function degreeToDirection(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function mapCondition(conditionText: string): string {
  const text = conditionText.toLowerCase();
  if (text.includes('clear') || text.includes('sunny')) return 'Clear';
  if (text.includes('partly cloudy') || text.includes('partly')) return 'Partly Cloudy';
  if (text.includes('overcast')) return 'Overcast';
  if (text.includes('cloudy')) return 'Cloudy';
  if (text.includes('mist')) return 'Mist';
  if (text.includes('fog')) return 'Fog';
  if (text.includes('drizzle') || text.includes('light rain')) return 'Light Rain';
  if (text.includes('rain')) return 'Light Rain';
  if (text.includes('humid')) return 'Humid';
  return conditionText;
}

// ─── Fetch current weather ───────────────────────────────────────────────────

async function fetchCurrentWeather(location: string): Promise<WeatherResult> {
  const data = await callWeatherApi({ endpoint: 'current', location });

  const current = data.current as Record<string, unknown>;
  const loc = data.location as Record<string, unknown>;
  const condition = (current.condition as Record<string, unknown>) || {};

  const tempF = current.temp_f as number;
  const humidity = current.humidity as number;
  const pressureInHg = current.pressure_in as number;
  const windMph = current.wind_mph as number;
  const windDeg = current.wind_degree as number;
  const conditionText = (condition.text as string) || 'Clear';

  const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity);
  const dewPoint = calculateDewPoint(tempF, humidity);

  return {
    weather: {
      temperature: Math.round(tempF),
      humidity: Math.round(humidity),
      pressure: Math.round(pressureInHg * 100) / 100,
      windSpeed: Math.round(windMph),
      windDirection: degreeToDirection(windDeg),
      conditions: mapCondition(conditionText),
      location: (loc.name as string) || '',
      region: (loc.region as string) || '',
      dewPoint,
    },
    ...saeData,
    isHistorical: false,
  };
}

// ─── Fetch today's / future weather via the forecast endpoint ────────────────
// Uses forecast.json with dt=YYYY-MM-DD so the API response explicitly targets
// the exact calendar day the user selected.  The `date` parameter is a plain
// YYYY-MM-DD string that comes directly from the date-picker — it is NEVER
// converted to/from a Date object, so there is zero risk of the UTC off-by-one
// bug that plagued the old toISOString()-based approach.

async function fetchTodayWeather(location: string, date: string, time?: string): Promise<WeatherResult> {
  // `date` is the raw YYYY-MM-DD string from the user's date picker.
  // We pass it directly as `date` so callWeatherApi sets dt=YYYY-MM-DD
  // on the forecast URL.  No Date object is created at any point.
  console.log('[fetchTodayWeather] passing date string directly to API:', date, '(type:', typeof date, ')');
  const data = await callWeatherApi({
    endpoint: 'forecast',
    location,
    date,      // ← passed straight through as dt= query param (pure string)
    days: 1,
    aqi: 'no',
    alerts: 'no',
  });


  const loc = data.location as Record<string, unknown>;
  const forecast = data.forecast as Record<string, unknown> | undefined;
  const forecastDays = (forecast?.forecastday as Array<Record<string, unknown>>) || [];

  // Find today's forecast day by matching the date string.
  // Fall back to the first (and usually only) day if no exact match.
  const todayForecast = forecastDays.find((d) => (d.date as string) === date) || forecastDays[0];

  if (!todayForecast) {
    // Shouldn't happen, but fall back to the current endpoint as a safety net
    return fetchCurrentWeather(location);
  }

  const hours = (todayForecast.hour as Array<Record<string, unknown>>) || [];

  // If the caller provided a specific time, find the closest hourly entry.
  // Otherwise pick the hour closest to the current local time.
  let targetHour: number;
  if (time) {
    targetHour = parseInt(time.split(':')[0]) || new Date().getHours();
  } else {
    targetHour = new Date().getHours();
  }

  const hourEntry = hours.find((h) => {
    const hTime = h.time as string; // e.g. "2026-03-10 14:00"
    const hourPart = parseInt(hTime.split(' ')[1]?.split(':')[0] || '-1');
    return hourPart === targetHour;
  });

  // If we found a matching hour, use its detailed data; otherwise use the
  // current-conditions block from the same response (which IS included in
  // forecast responses and is always tagged with today's date).
  if (hourEntry) {
    const hCondition = (hourEntry.condition as Record<string, unknown>) || {};
    const tempF = hourEntry.temp_f as number;
    const humidity = hourEntry.humidity as number;
    const pressureInHg = (hourEntry.pressure_in as number) || 29.92;
    const windMph = (hourEntry.wind_mph as number) || 0;
    const windDeg = (hourEntry.wind_degree as number) || 0;
    const conditionText = (hCondition.text as string) || 'Clear';

    const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity);
    const dewPoint = calculateDewPoint(tempF, humidity);

    return {
      weather: {
        temperature: Math.round(tempF),
        humidity: Math.round(humidity),
        pressure: Math.round(pressureInHg * 100) / 100,
        windSpeed: Math.round(windMph),
        windDirection: degreeToDirection(windDeg),
        conditions: mapCondition(conditionText),
        location: (loc.name as string) || '',
        region: (loc.region as string) || '',
        dewPoint,
      },
      ...saeData,
      isHistorical: false,
    };
  }

  // No matching hour found — use the "current" block from the forecast response
  // (forecast.json always includes a `current` object alongside the forecast days)
  const current = data.current as Record<string, unknown> | undefined;
  if (current) {
    const condition = (current.condition as Record<string, unknown>) || {};
    const tempF = current.temp_f as number;
    const humidity = current.humidity as number;
    const pressureInHg = current.pressure_in as number;
    const windMph = current.wind_mph as number;
    const windDeg = current.wind_degree as number;
    const conditionText = (condition.text as string) || 'Clear';

    const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity);
    const dewPoint = calculateDewPoint(tempF, humidity);

    return {
      weather: {
        temperature: Math.round(tempF),
        humidity: Math.round(humidity),
        pressure: Math.round(pressureInHg * 100) / 100,
        windSpeed: Math.round(windMph),
        windDirection: degreeToDirection(windDeg),
        conditions: mapCondition(conditionText),
        location: (loc.name as string) || '',
        region: (loc.region as string) || '',
        dewPoint,
      },
      ...saeData,
      isHistorical: false,
    };
  }

  // Last resort: fall back to the standalone current endpoint
  return fetchCurrentWeather(location);
}

// ─── Fetch historical weather ────────────────────────────────────────────────

async function fetchHistoricalWeather(location: string, date: string, time?: string): Promise<WeatherResult> {
  const data = await callWeatherApi({ endpoint: 'history', location, date });

  const loc = data.location as Record<string, unknown>;
  const forecast = data.forecast as Record<string, unknown> | undefined;
  const forecastDays = (forecast?.forecastday as Array<Record<string, unknown>>) || [];
  const forecastDay = forecastDays[0];

  if (!forecastDay) {
    throw new Error('No historical weather data available for this date.');
  }

  const dayData = forecastDay.day as Record<string, unknown>;
  const hours = (forecastDay.hour as Array<Record<string, unknown>>) || [];

  let hourData: Record<string, unknown> = dayData;
  let useHourly = false;

  if (time && hours.length > 0) {
    const requestedHour = parseInt(time.split(':')[0]) || 12;
    const hourEntry = hours.find((h) => {
      const hourTime = new Date(h.time as string);
      return hourTime.getHours() === requestedHour;
    });
    if (hourEntry) {
      hourData = hourEntry;
      useHourly = true;
    }
  }

  let tempF: number, humidity: number, pressureInHg: number, windMph: number, windDeg: number, conditionText: string;

  if (useHourly) {
    tempF = hourData.temp_f as number;
    humidity = hourData.humidity as number;
    pressureInHg = hourData.pressure_in as number;
    windMph = hourData.wind_mph as number;
    windDeg = hourData.wind_degree as number;
    conditionText = ((hourData.condition as Record<string, unknown>)?.text as string) || 'Clear';
  } else {
    tempF = dayData.avgtemp_f as number;
    humidity = dayData.avghumidity as number;
    pressureInHg = 29.92;
    windMph = dayData.maxwind_mph as number;
    windDeg = 0;
    conditionText = ((dayData.condition as Record<string, unknown>)?.text as string) || 'Clear';
  }

  const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity);
  const dewPoint = calculateDewPoint(tempF, humidity);

  return {
    weather: {
      temperature: Math.round(tempF),
      humidity: Math.round(humidity),
      pressure: Math.round(pressureInHg * 100) / 100,
      windSpeed: Math.round(windMph),
      windDirection: degreeToDirection(windDeg),
      conditions: mapCondition(conditionText),
      location: (loc?.name as string) || '',
      region: (loc?.region as string) || '',
      dewPoint,
    },
    ...saeData,
    isHistorical: true,
  };
}

// ─── Main export: fetch weather (auto-detects current vs historical vs today) ─

export async function fetchWeatherData(
  location: string,
  date?: string,
  time?: string
): Promise<WeatherResult> {
  const todayStr = getLocalDateString();
  console.log('[fetchWeatherData] called with:', { location, date, time, todayStr, buildTimestamp: '2026-03-10T06:43:00Z' });


  if (!date) {
    // No date provided at all — use the current endpoint (e.g. auto-fetch on modal open)
    console.log('[fetchWeatherData] → no date provided, using CURRENT endpoint');
    return fetchCurrentWeather(location);
  }

  if (date < todayStr) {
    // Past date — use the history endpoint
    console.log('[fetchWeatherData] → date is in the past, using HISTORY endpoint');
    return fetchHistoricalWeather(location, date, time);
  }

  // Today (or future date within forecast range) — use the forecast endpoint
  // so the API response explicitly contains today's date in its payload,
  // eliminating the off-by-one bug from the current endpoint's `last_updated`
  // timestamp which may still show yesterday near midnight.
  console.log('[fetchWeatherData] → date >= today, using FORECAST endpoint (days=1)');
  return fetchTodayWeather(location, date, time);
}




// ─── Fetch extended weather data for the dashboard widget ────────────────────

export async function fetchWeatherForWidget(location: string, elevationFt: number = 0): Promise<WeatherWidgetData> {
  const data = await callWeatherApi({
    endpoint: 'forecast',
    location,
    days: 1,
    aqi: 'no',
    alerts: 'no',
  });

  const current = data.current as Record<string, unknown>;
  const loc = data.location as Record<string, unknown>;
  const currentCondition = (current.condition as Record<string, unknown>) || {};

  const tempF = current.temp_f as number;
  const humidity = current.humidity as number;
  const pressureInHg = current.pressure_in as number;

  // Pass elevation so SLP → station pressure conversion is applied
  const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity, elevationFt);
  const dewPoint = calculateDewPoint(tempF, humidity);

  const forecast = data.forecast as Record<string, unknown> | undefined;
  const forecastDays = (forecast?.forecastday as Array<Record<string, unknown>>) || [];
  const forecastDay = forecastDays[0];
  const currentHour = new Date((loc.localtime as string) || '').getHours();
  const hourlyForecast: HourlyForecast[] = [];

  if (forecastDay) {
    const hours = (forecastDay.hour as Array<Record<string, unknown>>) || [];
    for (let i = currentHour + 1; i <= Math.min(currentHour + 6, 23); i++) {
      const hour = hours[i];
      if (hour) {
        // Pass elevation for hourly forecast DA/SAE too
        const hSae = calculateSAECorrectionInternal(hour.temp_f as number, hour.pressure_in as number, hour.humidity as number, elevationFt);
        const hDew = calculateDewPoint(hour.temp_f as number, hour.humidity as number);
        const hCondition = (hour.condition as Record<string, unknown>) || {};
        hourlyForecast.push({
          time: (hour.time as string)?.split(' ')[1] || `${i}:00`,
          temperature: Math.round(hour.temp_f as number),
          humidity: Math.round(hour.humidity as number),
          pressure: Math.round((hour.pressure_in as number) * 100) / 100,
          windSpeed: Math.round(hour.wind_mph as number),
          conditions: mapCondition((hCondition.text as string) || 'Clear'),
          conditionIcon: (hCondition.icon as string) ? `https:${hCondition.icon}` : '',
          chanceOfRain: (hour.chance_of_rain as number) || 0,
          dewPoint: hDew,
          saeCorrection: hSae.saeCorrection,
          densityAltitude: hSae.densityAltitude,
        });
      }
    }
  }

  return {
    temperature: Math.round(tempF),
    feelsLike: Math.round((current.feelslike_f as number) || tempF),
    humidity: Math.round(humidity),
    pressure: Math.round(pressureInHg * 100) / 100,
    windSpeed: Math.round(current.wind_mph as number),
    windGust: Math.round((current.gust_mph as number) || 0),
    windDirection: degreeToDirection(current.wind_degree as number),
    windDegree: current.wind_degree as number,
    conditions: mapCondition((currentCondition.text as string) || 'Clear'),
    conditionIcon: (currentCondition.icon as string) ? `https:${currentCondition.icon}` : '',
    dewPoint,
    visibility: (current.vis_miles as number) || 10,
    uvIndex: (current.uv as number) || 0,
    cloudCover: (current.cloud as number) || 0,
    precipInches: (current.precip_in as number) || 0,
    location: (loc.name as string) || '',
    region: (loc.region as string) || '',
    country: (loc.country as string) || '',
    localTime: (loc.localtime as string) || '',
    isDay: (current.is_day as number) === 1,
    ...saeData,
    hourlyForecast,
    lastUpdated: (current.last_updated as string) || new Date().toISOString(),
  };
}


// ─── Race Day Forecast ───────────────────────────────────────────────────────

export interface RaceDayForecastData {
  location: string;
  region: string;
  date: string;
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  maxWind: number;
  avgHumidity: number;
  totalPrecipIn: number;
  chanceOfRain: number;
  conditions: string;
  conditionIcon: string;
  sunrise: string;
  sunset: string;
  uvIndex: number;
  racingHours: RaceDayHour[];
  bestSAE: number;
  worstSAE: number;
  bestDA: number;
  worstDA: number;
  avgSAE: number;
  avgDA: number;
  dataType: 'forecast' | 'historical' | 'unavailable';
  daysUntilEvent: number;
}

export interface RaceDayHour {
  time: string;
  hour: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  conditions: string;
  conditionIcon: string;
  chanceOfRain: number;
  dewPoint: number;
  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
}

export async function fetchRaceDayForecast(
  location: string,
  eventDate: string,
  elevationFt: number = 0
): Promise<RaceDayForecastData> {

  // Derive "today" from local date components via getLocalDateString() to avoid
  // the UTC-midnight off-by-one bug that occurs when using new Date() directly.
  const todayStr = getLocalDateString();
  const today = parseLocalDate(todayStr);
  const target = parseLocalDate(eventDate);
  const diffMs = target.getTime() - today.getTime();
  // Use Math.round (not Math.ceil) so DST transitions (±1 hr) don't shift
  // the day count.  E.g. 23 h (spring-forward) → round(0.958) = 1,
  // 25 h (fall-back) → round(1.042) = 1.
  const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));




  const unavailable: RaceDayForecastData = {
    location: '', region: '', date: eventDate,
    maxTemp: 0, minTemp: 0, avgTemp: 0, maxWind: 0, avgHumidity: 0,
    totalPrecipIn: 0, chanceOfRain: 0, conditions: '', conditionIcon: '',
    sunrise: '', sunset: '', uvIndex: 0, racingHours: [],
    bestSAE: 0, worstSAE: 0, bestDA: 0, worstDA: 0, avgSAE: 0, avgDA: 0,
    dataType: 'unavailable', daysUntilEvent: daysUntil,
  };

  let apiParams: WeatherApiParams;
  let dataType: 'forecast' | 'historical';

  if (daysUntil < 0) {
    apiParams = { endpoint: 'history', location, date: eventDate };
    dataType = 'historical';
  } else if (daysUntil <= 14) {
    const days = Math.max(daysUntil + 1, 1);
    // Pass eventDate as `date` so callWeatherApi sets dt=YYYY-MM-DD on the
    // forecast URL — the string flows straight from the caller, never through
    // a Date object, eliminating the UTC off-by-one risk.
    apiParams = { endpoint: 'forecast', location, date: eventDate, days, aqi: 'no', alerts: 'no' };
    dataType = 'forecast';

  } else {
    return unavailable;
  }

  const data = await callWeatherApi(apiParams);
  const loc = data.location as Record<string, unknown>;
  const forecast = data.forecast as Record<string, unknown> | undefined;
  const forecastDays = (forecast?.forecastday as Array<Record<string, unknown>>) || [];
  const targetDay = forecastDays.find((d) => (d.date as string) === eventDate) || forecastDays[forecastDays.length - 1];

  if (!targetDay) {
    throw new Error('No weather data available for this date.');
  }

  const day = targetDay.day as Record<string, unknown>;
  const astro = (targetDay.astro as Record<string, unknown>) || {};
  const dayCondition = (day.condition as Record<string, unknown>) || {};

  const racingHours: RaceDayHour[] = [];
  let bestSAE = Infinity, worstSAE = -Infinity, bestDA = Infinity, worstDA = -Infinity;
  let saeSum = 0, daSum = 0, hourCount = 0;

  const hours = (targetDay.hour as Array<Record<string, unknown>>) || [];
  for (const h of hours) {
    const hourTime = new Date(h.time as string);
    const hourNum = hourTime.getHours();
    const hTempF = h.temp_f as number;
    const hHumidity = h.humidity as number;
    const hPressure = (h.pressure_in as number) || 29.92;
    const saeData = calculateSAECorrectionInternal(hTempF, hPressure, hHumidity, elevationFt);

    const hDewPoint = calculateDewPoint(hTempF, hHumidity);
    const hCondition = (h.condition as Record<string, unknown>) || {};

    if (hourNum >= 8 && hourNum <= 20) {
      racingHours.push({
        time: (h.time as string)?.split(' ')[1] || `${hourNum}:00`,
        hour: hourNum,
        temperature: Math.round(hTempF),
        feelsLike: Math.round((h.feelslike_f as number) || hTempF),
        humidity: Math.round(hHumidity),
        pressure: Math.round(hPressure * 100) / 100,
        windSpeed: Math.round((h.wind_mph as number) || 0),
        windGust: Math.round((h.gust_mph as number) || 0),
        windDirection: degreeToDirection((h.wind_degree as number) || 0),
        conditions: mapCondition((hCondition.text as string) || 'Clear'),
        conditionIcon: (hCondition.icon as string) ? `https:${hCondition.icon}` : '',
        chanceOfRain: (h.chance_of_rain as number) || 0,
        dewPoint: hDewPoint,
        saeCorrection: saeData.saeCorrection,
        densityAltitude: saeData.densityAltitude,
        correctedHP: saeData.correctedHP,
      });

      bestSAE = Math.min(bestSAE, saeData.saeCorrection);
      worstSAE = Math.max(worstSAE, saeData.saeCorrection);
      bestDA = Math.min(bestDA, saeData.densityAltitude);
      worstDA = Math.max(worstDA, saeData.densityAltitude);
      saeSum += saeData.saeCorrection;
      daSum += saeData.densityAltitude;
      hourCount++;
    }
  }

  return {
    location: (loc?.name as string) || '',
    region: (loc?.region as string) || '',
    date: eventDate,
    maxTemp: Math.round((day.maxtemp_f as number) || 0),
    minTemp: Math.round((day.mintemp_f as number) || 0),
    avgTemp: Math.round((day.avgtemp_f as number) || 0),
    maxWind: Math.round((day.maxwind_mph as number) || 0),
    avgHumidity: Math.round((day.avghumidity as number) || 0),
    totalPrecipIn: (day.totalprecip_in as number) || 0,
    chanceOfRain: (day.daily_chance_of_rain as number) || 0,
    conditions: mapCondition((dayCondition.text as string) || 'Clear'),
    conditionIcon: (dayCondition.icon as string) ? `https:${dayCondition.icon}` : '',
    sunrise: (astro.sunrise as string) || '',
    sunset: (astro.sunset as string) || '',
    uvIndex: (day.uv as number) || 0,
    racingHours,
    bestSAE: isFinite(bestSAE) ? bestSAE : 0,
    worstSAE: isFinite(worstSAE) ? worstSAE : 0,
    bestDA: isFinite(bestDA) ? bestDA : 0,
    worstDA: isFinite(worstDA) ? worstDA : 0,
    avgSAE: hourCount > 0 ? Math.round((saeSum / hourCount) * 1000) / 1000 : 0,
    avgDA: hourCount > 0 ? Math.round(daSum / hourCount) : 0,
    dataType,
    daysUntilEvent: daysUntil,
  };
}

// ─── Additional racing calculation exports ───────────────────────────────────

// ─── Vapor Pressure (actual, in inHg) ────────────────────────────────────────
// Now uses the accurate Buck (1981) equation for saturation vapor pressure,
// consistent with calculateWaterGrains, calculateSAECorrectionInternal, and
// calculateSTDCorrection.
//
// OLD (inaccurate — overestimated SVP by ~30-40% in the 60-100°F range):
//   SVP = 0.000004231·T³ − 0.0003864·T² + 0.01857·T + 0.1776
//
// NEW (accurate to within 0.05% across all racing temperatures):
//   SVP = Buck equation via accurateSatVaporPressureInHg()
//
// This is the value displayed as "Vapor Pressure" in the Pass Log weather
// section (both the expanded row view and the add/edit modal).
//
export function calculateVaporPressure(tempF: number, humidityPct: number): number {
  const satVaporPressure = accurateSatVaporPressureInHg(tempF);
  const actualVaporPressure = (humidityPct / 100) * satVaporPressure;

  // Diagnostic logging — verify in browser console against proven weather stations
  console.log('[calculateVaporPressure] Buck equation:', {
    tempF,
    humidityPct,
    satVP_inHg: Math.round(satVaporPressure * 10000) / 10000,
    actualVP_inHg: Math.round(actualVaporPressure * 10000) / 10000,
  });

  return Math.round(actualVaporPressure * 1000) / 1000;
}


// ─── Accurate Saturation Vapor Pressure (Buck equation) ──────────────────────
// The Buck (1981) equation is one of the most accurate empirical fits for
// saturation vapor pressure over liquid water and is the standard reference
// in meteorology and drag racing weather calculations.
//
// Returns saturation vapor pressure in inches of mercury (inHg).
export function accurateSatVaporPressureInHg(tempF: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  // Buck equation: es (hPa) = 6.1121 × exp((18.678 − T/234.5) × (T/(257.14 + T)))
  const esHpa = 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  // Convert hPa → inHg  (1 inHg = 33.8639 hPa)
  return esHpa / 33.8639;
}

// ─── NHRA / Industry Standard Water Grains Calculation ───────────────────────
//
// Standard drag racing water grains formula (mixing ratio × 7000):
//
//   Saturation Vapor Pressure = Buck equation at current air temperature
//   Actual Vapor Pressure     = (Humidity% / 100) × Saturation Vapor Pressure
//   Mixing Ratio (lb/lb)      = 0.62198 × (Actual VP / (Baro − Actual VP))
//   Water Grains (gr/lb)      = Mixing Ratio × 7000
//                              = 4354 × (Actual VP / (Baro − Actual VP))
//
// This is the same formula used by RaceAir, Altus, Computech, and other
// proven drag racing weather stations.  The constant 4354 = 0.62198 × 7000,
// where 0.62198 is the ratio of molecular weights (water / dry air) and
// 7000 converts pounds to grains.
//
// ── What was wrong with the old formula ──
// The old code used the SAME mixing-ratio structure (4354 × Pv/(Pb−Pv)),
// but its saturation vapor pressure came from an inaccurate cubic polynomial:
//   SVP = 0.000004231·T³ − 0.0003864·T² + 0.01857·T + 0.1776
// That polynomial over-estimates SVP by ~30-40% in the 60–100 °F range
// (e.g. at 80 °F it returns 1.357 inHg vs the correct 1.033 inHg).
// Because water grains are directly proportional to vapor pressure, the
// ~30% SVP error translated directly into ~30% inflated water grains —
// exactly matching the discrepancy the user observed vs other proven apps.
//
// The fix: replace the polynomial with the Buck equation, which is accurate
// to within 0.05% across the full range of racing temperatures.
//
export function calculateWaterGrains(tempF: number, humidityPct: number, pressureInHg: number): number {
  // Step 1: Accurate saturation vapor pressure via Buck equation (inHg)
  const satVP = accurateSatVaporPressureInHg(tempF);

  // Step 2: Actual vapor pressure = (RH / 100) × saturation VP
  const actualVP = (humidityPct / 100) * satVP;

  // Step 3: Mixing ratio × 7000 = water grains per pound of dry air
  //         4354 = 0.62198 × 7000
  const dryPressure = pressureInHg - actualVP;
  if (dryPressure <= 0) return 0;
  const grains = 4354 * (actualVP / dryPressure);

  // Diagnostic logging — remove once verified in production
  console.log('[calculateWaterGrains] NHRA standard (Buck eq + mixing ratio):', {
    tempF,
    humidityPct,
    pressureInHg,
    satVP_inHg: Math.round(satVP * 10000) / 10000,
    actualVP_inHg: Math.round(actualVP * 10000) / 10000,
    dryPressure_inHg: Math.round(dryPressure * 10000) / 10000,
    waterGrains: Math.round(grains * 10) / 10,
    formula: `4354 × (${Math.round(actualVP * 10000) / 10000} / ${Math.round(dryPressure * 100) / 100}) = ${Math.round(grains * 10) / 10} gr/lb`,
  });

  return Math.round(grains * 10) / 10;
}



export function calculateWetBulb(tempF: number, humidityPct: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const rh = humidityPct;
  const wetBulbC = tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
    + Math.atan(tempC + rh)
    - Math.atan(rh - 1.676331)
    + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
    - 4.686035;
  const wetBulbF = (wetBulbC * 9 / 5) + 32;
  return Math.round(wetBulbF * 10) / 10;
}

export function calculateSTDCorrection(tempF: number, pressureInHg: number, humidityPct: number): number {
  const vaporPressure = calculateVaporPressure(tempF, humidityPct);
  const dryPressure = pressureInHg - vaporPressure;
  const stdCorrection = (29.235 / dryPressure) * ((tempF + 460) / 520);
  return Math.round(stdCorrection * 10000) / 10000;
}
