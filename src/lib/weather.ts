// Weather API utility — calls WeatherAPI.com directly from the browser.
// API key is read from VITE_WEATHER_API_KEY environment variable.
// No Supabase Edge Function needed.

// ─── Configuration ───────────────────────────────────────────────────────────

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY || '';
const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

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

      if (params.endpoint === 'history' && params.date) {
        queryParams.set('dt', params.date);
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

// ─── Pure calculation helpers (no API calls) ─────────────────────────────────

export function calculateDewPoint(tempF: number, humidityPct: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidityPct / 100);
  const dewPointC = (b * alpha) / (a - alpha);
  const dewPointF = (dewPointC * 9 / 5) + 32;
  return Math.round(dewPointF * 10) / 10;
}

function calculateSAECorrectionInternal(tempF: number, pressureInHg: number, humidityPct: number) {
  const tempFactor = Math.sqrt((tempF + 460) / 520);
  const pressureFactor = Math.sqrt(29.92 / pressureInHg);
  const satVaporPressure = 0.000004231 * Math.pow(tempF, 3) - 0.0003864 * Math.pow(tempF, 2) + 0.01857 * tempF + 0.1776;
  const actualVaporPressure = (humidityPct / 100) * satVaporPressure;
  const dryPressure = pressureInHg - actualVaporPressure;
  const humidityFactor = Math.sqrt(29.92 / dryPressure);
  const saeCorrection = tempFactor * pressureFactor * humidityFactor;
  const stationPressure = pressureInHg * 33.8639;
  const densityAltitude = Math.round(145442.16 * (1 - Math.pow((stationPressure / 1013.25), 0.190284)));
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

// ─── Main export: fetch weather (auto-detects current vs historical) ─────────

export async function fetchWeatherData(
  location: string,
  date?: string,
  time?: string
): Promise<WeatherResult> {
  const isHistorical = (() => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < today;
  })();

  if (isHistorical && date) {
    return fetchHistoricalWeather(location, date, time);
  } else {
    return fetchCurrentWeather(location);
  }
}

// ─── Fetch extended weather data for the dashboard widget ────────────────────

export async function fetchWeatherForWidget(location: string): Promise<WeatherWidgetData> {
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

  const saeData = calculateSAECorrectionInternal(tempF, pressureInHg, humidity);
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
        const hSae = calculateSAECorrectionInternal(hour.temp_f as number, hour.pressure_in as number, hour.humidity as number);
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
  eventDate: string
): Promise<RaceDayForecastData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
    apiParams = { endpoint: 'forecast', location, days, aqi: 'no', alerts: 'no' };
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
    const saeData = calculateSAECorrectionInternal(hTempF, hPressure, hHumidity);
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

export function calculateVaporPressure(tempF: number, humidityPct: number): number {
  const satVaporPressure = 0.000004231 * Math.pow(tempF, 3) - 0.0003864 * Math.pow(tempF, 2) + 0.01857 * tempF + 0.1776;
  const actualVaporPressure = (humidityPct / 100) * satVaporPressure;
  return Math.round(actualVaporPressure * 1000) / 1000;
}

export function calculateWaterGrains(tempF: number, humidityPct: number, pressureInHg: number): number {
  const vaporPressure = calculateVaporPressure(tempF, humidityPct);
  const dryPressure = pressureInHg - vaporPressure;
  if (dryPressure <= 0) return 0;
  const grains = 4354 * (vaporPressure / dryPressure);
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
