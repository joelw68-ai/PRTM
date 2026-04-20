// ─── BLE Weather Meter Adapter ────────────────────────────────────────────────
//
// Pairs the Pro-Mod Racing Journal directly with a trackside BLE weather meter
// (Kestrel 5500 / 5700, Drag Racing Weather Station / DRWS, Computech RaceAir
// Pro, or any meter exposing the Bluetooth SIG Environmental Sensing Service
// 0x181A).  When a meter is paired and in range we feed its live temperature /
// humidity / pressure / wind readings into the same pipeline that normally
// pulls from the WeatherAPI / Open-Meteo / NWS / Aeris adapter layer — so
// Log Pass auto-fill, the dashboard Weather Widget, and the Race Day timeline
// all show meter-accurate numbers without any extra taps.
//
// When the meter goes out of range (no reading for >FRESH_TIMEOUT_MS) we
// automatically fall back to the API provider chain so the app never goes
// dark on DA/SAE calculations.
//
// ── Supported GATT profiles ──────────────────────────────────────────────────
// 1. Environmental Sensing Service (0x181A)
//       Temperature   0x2A6E  (int16, 0.01°C)
//       Humidity      0x2A6F  (uint16, 0.01 %)
//       Pressure      0x2A6D  (uint32, 0.1 Pa)
//       Wind Speed    0x2A72  (uint16, 0.01 m/s)   — "True Wind Speed" char
//       Wind Dir      0x2A71  (uint16, 0.01 deg)
//    The Kestrel 5500 LiNK+, newer DRWS firmware, and most Bluefruit / ESP32
//    homebrew meters expose this.
//
// 2. Nordic UART Service (6E400001-B5A3-F393-E0A9-E50E24DCCA9E)
//       RX char       6E400002-…   (write, optional)
//       TX char       6E400003-…   (notify — stream of ASCII frames)
//    Parses newline-delimited key=value frames from Computech RaceAir Pro
//    clones, HM-10 gateways, or any Adafruit Bluefruit-based meter. Frames
//    look like  T=78.5,H=45,P=29.85,W=3.2,D=170
//
// Meters we've explicitly targeted:
//   • Kestrel 5500 / 5700 — ESS primary, falls back to Nordic UART
//   • Drag Racing Weather Station (DRWS) — Nordic UART primary, ESS fallback
//   • Computech RaceAir Pro — Nordic UART (HM-10 module)
//   • Generic — tries ESS first, then Nordic UART
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderObservation } from './weatherProviders';

// ─── Public types ────────────────────────────────────────────────────────────

export type BleMeterType = 'kestrel' | 'drws' | 'computech' | 'generic';

export const BLE_METER_LABELS: Record<BleMeterType, string> = {
  kestrel: 'Kestrel 5500 / 5700',
  drws: 'Drag Racing Weather Station',
  computech: 'Computech RaceAir Pro',
  generic: 'Generic BLE Meter (ESS)',
};

export type BleConnectionStatus =
  | 'unsupported'
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'live'            // receiving readings
  | 'out-of-range'    // connected but no reading for > FRESH_TIMEOUT_MS
  | 'error';

export interface BleMeterReading {
  /** °F */
  temperature: number;
  /** % RH */
  humidity: number;
  /** inHg — station pressure (meters measure station, not SLP) */
  pressure: number;
  /** mph */
  windSpeed: number;
  /** deg */
  windDegree: number;
  /** compass string (N, NE, …) */
  windDirection: string;
  /** epoch ms the reading was received */
  receivedAt: number;
  /** Which meter profile produced it */
  source: BleMeterType;
  /** Human-readable device name */
  deviceName: string;
}

export interface BlePairedDevice {
  id: string;
  name: string;
  meterType: BleMeterType;
  lastSeen: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAIRED_DEVICE_KEY = 'promod_ble_meter_device';

/** How long a meter reading is considered "live" before we fall back to API. */
export const FRESH_TIMEOUT_MS = 30_000;

// Environmental Sensing Service and characteristic UUIDs (SIG standard)
const ESS_SERVICE = 0x181A;
const ESS_TEMP = 0x2A6E;
const ESS_HUMIDITY = 0x2A6F;
const ESS_PRESSURE = 0x2A6D;
const ESS_WIND_SPEED = 0x2A72;
const ESS_WIND_DIRECTION = 0x2A71;

// Nordic UART Service
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// ─── Unit helpers ────────────────────────────────────────────────────────────

function cToF(c: number): number { return c * 9 / 5 + 32; }
function paToInHg(pa: number): number { return pa / 3386.389; }
function msToMph(ms: number): number { return ms * 2.23694; }
function degToDir(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Paired-device persistence ───────────────────────────────────────────────

export function getPairedDevice(): BlePairedDevice | null {
  try {
    const raw = localStorage.getItem(PAIRED_DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return {
        id: parsed.id,
        name: parsed.name,
        meterType: (parsed.meterType as BleMeterType) || 'generic',
        lastSeen: Number(parsed.lastSeen) || 0,
      };
    }
  } catch {}
  return null;
}

export function setPairedDevice(d: BlePairedDevice | null): void {
  try {
    if (d) localStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(d));
    else localStorage.removeItem(PAIRED_DEVICE_KEY);
  } catch {}
}

// ─── Feature detection ───────────────────────────────────────────────────────

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined'
    && typeof (navigator as any).bluetooth !== 'undefined'
    && typeof (navigator as any).bluetooth.requestDevice === 'function';
}

// Some browsers (Safari) expose `navigator.bluetooth` but hide
// `getDevices()` behind a flag — that's the method we need for silent
// reconnect to a previously-paired device without another user gesture.
export function canAutoReconnect(): boolean {
  if (!isBluetoothSupported()) return false;
  const bt: any = (navigator as any).bluetooth;
  return typeof bt.getDevices === 'function';
}

// ─── Singleton manager ───────────────────────────────────────────────────────

type StatusListener = (s: BleConnectionStatus, info?: { deviceName?: string; error?: string }) => void;
type ReadingListener = (r: BleMeterReading) => void;

class BleWeatherMeterManager {
  private device: any | null = null;           // BluetoothDevice
  private server: any | null = null;           // BluetoothRemoteGATTServer
  private status: BleConnectionStatus = isBluetoothSupported() ? 'disconnected' : 'unsupported';
  private meterType: BleMeterType = 'generic';
  private latestReading: BleMeterReading | null = null;
  private readingBuffer: Partial<BleMeterReading> = {};
  private nusBuffer = '';
  private freshCheckTimer: ReturnType<typeof setInterval> | null = null;
  private statusListeners: Set<StatusListener> = new Set();
  private readingListeners: Set<ReadingListener> = new Set();
  private errorMessage = '';

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    // Emit current state immediately for new subscribers
    fn(this.status, { deviceName: this.device?.name, error: this.errorMessage });
    return () => { this.statusListeners.delete(fn); };
  }

  onReading(fn: ReadingListener): () => void {
    this.readingListeners.add(fn);
    if (this.latestReading) fn(this.latestReading);
    return () => { this.readingListeners.delete(fn); };
  }

  getStatus(): BleConnectionStatus { return this.status; }
  getLatestReading(): BleMeterReading | null { return this.latestReading; }
  getDeviceName(): string { return this.device?.name || ''; }
  getMeterType(): BleMeterType { return this.meterType; }
  getError(): string { return this.errorMessage; }

  private setStatus(s: BleConnectionStatus, error?: string) {
    this.status = s;
    this.errorMessage = error || '';
    const deviceName = this.device?.name;
    this.statusListeners.forEach(fn => fn(s, { deviceName, error }));
  }

  /**
   * Scan for a meter & pair.  Must be called from a user gesture.
   */
  async connect(preferredType: BleMeterType = 'generic'): Promise<void> {
    if (!isBluetoothSupported()) {
      this.setStatus('unsupported', 'Web Bluetooth is not available in this browser.');
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome, Edge, or Opera on desktop / Android.');
    }

    this.meterType = preferredType;
    this.setStatus('scanning');

    try {
      const bt: any = (navigator as any).bluetooth;

      // Ask for devices exposing either the Environmental Sensing Service
      // or the Nordic UART Service.  `acceptAllDevices: false` requires at
      // least one filter — we provide both service filters so the picker
      // shows both kinds of meters.
      const device = await bt.requestDevice({
        filters: [
          { services: [ESS_SERVICE] },
          { services: [NUS_SERVICE] },
        ],
        optionalServices: [ESS_SERVICE, NUS_SERVICE],
      });

      if (!device) {
        this.setStatus('disconnected');
        return;
      }

      await this.attachToDevice(device, preferredType);
    } catch (e: any) {
      const msg = e?.message || String(e);
      // "User cancelled" is not a real error — just reset
      if (msg.includes('cancel') || msg.includes('User')) {
        this.setStatus('disconnected');
        return;
      }
      this.setStatus('error', msg);
      throw e;
    }
  }

  /**
   * Try to silently reconnect to the last-paired device (e.g. on app load).
   * Requires navigator.bluetooth.getDevices(), which needs the
   * chrome://flags/#enable-web-bluetooth-new-permissions-backend flag enabled
   * on Chrome <= 113.  Silent fails are expected and non-fatal.
   */
  async autoReconnect(): Promise<boolean> {
    if (!canAutoReconnect()) return false;
    const saved = getPairedDevice();
    if (!saved) return false;

    try {
      const bt: any = (navigator as any).bluetooth;
      const devices: any[] = await bt.getDevices();
      const match = devices.find(d => d.id === saved.id);
      if (!match) return false;

      // Must still "connect" to the GATT server; if the device isn't
      // advertising this will throw — that's OK, it means out of range.
      await this.attachToDevice(match, saved.meterType);
      return true;
    } catch (e) {
      console.warn('[ble] auto-reconnect failed:', e);
      return false;
    }
  }

  private async attachToDevice(device: any, preferredType: BleMeterType): Promise<void> {
    this.device = device;
    this.meterType = preferredType;
    device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    this.setStatus('connecting');

    const server = await device.gatt.connect();
    this.server = server;

    // Remember pairing
    setPairedDevice({
      id: device.id,
      name: device.name || 'Weather Meter',
      meterType: preferredType,
      lastSeen: Date.now(),
    });

    // Try ESS first, then NUS.  Order flipped for meters that prefer UART.
    const order = (preferredType === 'drws' || preferredType === 'computech')
      ? ['nus', 'ess']
      : ['ess', 'nus'];

    let anySubscribed = false;
    for (const proto of order) {
      try {
        if (proto === 'ess') anySubscribed = (await this.subscribeESS(server)) || anySubscribed;
        else                anySubscribed = (await this.subscribeNUS(server)) || anySubscribed;
      } catch (e) {
        console.warn(`[ble] ${proto} subscribe failed:`, e);
      }
    }

    if (!anySubscribed) {
      this.setStatus('error', 'Paired device does not expose any supported weather characteristics (ESS / Nordic UART).');
      return;
    }

    this.setStatus('connected');
    this.startFreshnessMonitor();
  }

  private async subscribeESS(server: any): Promise<boolean> {
    const svc = await server.getPrimaryService(ESS_SERVICE).catch(() => null);
    if (!svc) return false;
    let anySubbed = false;

    const sub = async (uuid: number, handler: (dv: DataView) => void) => {
      try {
        const ch = await svc.getCharacteristic(uuid);
        await ch.startNotifications();
        ch.addEventListener('characteristicvaluechanged', (ev: any) => {
          const dv: DataView = ev.target.value;
          try { handler(dv); } catch (e) { console.warn('[ble] ESS handler error:', e); }
        });
        // Also read once immediately so we have a reading even before the
        // first notify fires.
        try {
          const initial = await ch.readValue();
          handler(initial);
        } catch {}
        anySubbed = true;
      } catch (e) {
        console.log(`[ble] ESS char 0x${uuid.toString(16)} not supported:`, (e as any)?.message);
      }
    };

    await sub(ESS_TEMP, (dv) => {
      const tempC = dv.getInt16(0, true) / 100;
      this.ingest({ temperature: cToF(tempC) });
    });
    await sub(ESS_HUMIDITY, (dv) => {
      const rh = dv.getUint16(0, true) / 100;
      this.ingest({ humidity: rh });
    });
    await sub(ESS_PRESSURE, (dv) => {
      const pa = dv.getUint32(0, true) / 10;
      this.ingest({ pressure: paToInHg(pa) });
    });
    await sub(ESS_WIND_SPEED, (dv) => {
      const ms = dv.getUint16(0, true) / 100;
      this.ingest({ windSpeed: msToMph(ms) });
    });
    await sub(ESS_WIND_DIRECTION, (dv) => {
      const deg = dv.getUint16(0, true) / 100;
      this.ingest({ windDegree: deg, windDirection: degToDir(deg) });
    });

    return anySubbed;
  }

  private async subscribeNUS(server: any): Promise<boolean> {
    const svc = await server.getPrimaryService(NUS_SERVICE).catch(() => null);
    if (!svc) return false;
    try {
      const tx = await svc.getCharacteristic(NUS_TX_CHAR);
      await tx.startNotifications();
      tx.addEventListener('characteristicvaluechanged', (ev: any) => {
        const dv: DataView = ev.target.value;
        const chunk = new TextDecoder().decode(dv);
        this.nusBuffer += chunk;
        // Process complete lines
        let idx;
        while ((idx = this.nusBuffer.indexOf('\n')) >= 0) {
          const line = this.nusBuffer.slice(0, idx).trim();
          this.nusBuffer = this.nusBuffer.slice(idx + 1);
          if (line) this.parseNusLine(line);
        }
      });
      return true;
    } catch (e) {
      console.warn('[ble] NUS subscribe failed:', e);
      return false;
    }
  }

  /**
   * Parse a single Nordic-UART ASCII frame.  Accepts either CSV k=v pairs or
   * JSON.  Keys recognised (case-insensitive):
   *   t/temp/tempf        → °F (or °C if suffixed "c")
   *   h/hum/rh            → % humidity
   *   p/pres/baro/inhg    → inHg (or hPa if suffixed "hpa")
   *   w/wind/windmph      → mph
   *   d/dir/winddir       → degrees
   */
  private parseNusLine(line: string): void {
    // Try JSON first
    if (line.startsWith('{')) {
      try {
        const j = JSON.parse(line);
        const partial: Partial<BleMeterReading> = {};
        if (j.temp_f != null) partial.temperature = Number(j.temp_f);
        else if (j.temp_c != null) partial.temperature = cToF(Number(j.temp_c));
        else if (j.t != null) partial.temperature = Number(j.t);
        if (j.humidity != null) partial.humidity = Number(j.humidity);
        else if (j.h != null) partial.humidity = Number(j.h);
        if (j.pressure_inhg != null) partial.pressure = Number(j.pressure_inhg);
        else if (j.pressure_hpa != null) partial.pressure = Number(j.pressure_hpa) * 0.02953;
        else if (j.p != null) partial.pressure = Number(j.p);
        if (j.wind_mph != null) partial.windSpeed = Number(j.wind_mph);
        else if (j.w != null) partial.windSpeed = Number(j.w);
        if (j.wind_dir != null) {
          partial.windDegree = Number(j.wind_dir);
          partial.windDirection = degToDir(Number(j.wind_dir));
        }
        this.ingest(partial);
        return;
      } catch {}
    }

    // CSV fallback: T=78.5,H=45,P=29.85,W=3.2,D=170
    const partial: Partial<BleMeterReading> = {};
    for (const kv of line.split(/[,;]/)) {
      const m = kv.match(/^\s*([a-z]+)\s*=\s*(-?\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i);
      if (!m) continue;
      const k = m[1].toLowerCase();
      const v = parseFloat(m[2]);
      const unit = m[3].toLowerCase();
      if (k === 't' || k === 'temp' || k === 'tempf') {
        partial.temperature = unit === 'c' ? cToF(v) : v;
      } else if (k === 'h' || k === 'hum' || k === 'rh') {
        partial.humidity = v;
      } else if (k === 'p' || k === 'pres' || k === 'baro' || k === 'inhg') {
        partial.pressure = unit === 'hpa' || unit === 'mb' ? v * 0.02953 : v;
      } else if (k === 'w' || k === 'wind' || k === 'windmph') {
        partial.windSpeed = unit === 'mps' ? msToMph(v) : v;
      } else if (k === 'd' || k === 'dir' || k === 'winddir') {
        partial.windDegree = v;
        partial.windDirection = degToDir(v);
      }
    }
    if (Object.keys(partial).length > 0) this.ingest(partial);
  }

  /** Merge a partial reading into the current buffer; publish when meaningful. */
  private ingest(partial: Partial<BleMeterReading>): void {
    Object.assign(this.readingBuffer, partial);
    // Publish once we have at least temp/humidity/pressure — the three DA
    // inputs.  Wind is optional.
    const b = this.readingBuffer;
    if (b.temperature != null && b.humidity != null && b.pressure != null) {
      const reading: BleMeterReading = {
        temperature: Math.round((b.temperature || 0) * 10) / 10,
        humidity: Math.round(b.humidity || 0),
        pressure: Math.round((b.pressure || 0) * 100) / 100,
        windSpeed: Math.round((b.windSpeed || 0) * 10) / 10,
        windDegree: b.windDegree || 0,
        windDirection: b.windDirection || 'N',
        receivedAt: Date.now(),
        source: this.meterType,
        deviceName: this.device?.name || 'Weather Meter',
      };
      this.latestReading = reading;
      // Refresh "lastSeen" on the saved device
      const saved = getPairedDevice();
      if (saved) setPairedDevice({ ...saved, lastSeen: reading.receivedAt });
      if (this.status !== 'live') this.setStatus('live');
      this.readingListeners.forEach(fn => fn(reading));
    }
  }

  private startFreshnessMonitor(): void {
    if (this.freshCheckTimer) clearInterval(this.freshCheckTimer);
    this.freshCheckTimer = setInterval(() => {
      if (!this.latestReading) return;
      const age = Date.now() - this.latestReading.receivedAt;
      if (age > FRESH_TIMEOUT_MS && this.status === 'live') {
        this.setStatus('out-of-range', `No reading for ${Math.round(age / 1000)}s — falling back to API.`);
      }
    }, 5_000);
  }

  private handleDisconnect = () => {
    if (this.freshCheckTimer) {
      clearInterval(this.freshCheckTimer);
      this.freshCheckTimer = null;
    }
    this.setStatus('disconnected');
  };

  async disconnect(): Promise<void> {
    if (this.freshCheckTimer) {
      clearInterval(this.freshCheckTimer);
      this.freshCheckTimer = null;
    }
    try {
      if (this.device?.gatt?.connected) await this.device.gatt.disconnect();
    } catch {}
    this.device = null;
    this.server = null;
    this.latestReading = null;
    this.readingBuffer = {};
    this.setStatus('disconnected');
  }

  /** Forget the paired device entirely. */
  async forget(): Promise<void> {
    await this.disconnect();
    setPairedDevice(null);
  }

  /**
   * Is the meter currently producing live data?  Used by the weather adapter
   * layer to decide whether to intercept API calls with meter readings.
   */
  hasLiveReading(): boolean {
    if (!this.latestReading) return false;
    return (Date.now() - this.latestReading.receivedAt) <= FRESH_TIMEOUT_MS;
  }

  /** Return the current reading as a ProviderObservation (or null). */
  getAsObservation(location: string): ProviderObservation | null {
    const r = this.latestReading;
    if (!r || !this.hasLiveReading()) return null;
    return {
      temperature: r.temperature,
      humidity: r.humidity,
      pressure: r.pressure,               // meters already report STATION pressure
      stationPressure: r.pressure,
      windSpeed: r.windSpeed,
      windGust: 0,
      windDirection: r.windDirection,
      windDegree: r.windDegree,
      conditions: 'Live BLE',
      conditionIcon: '',
      dewPoint: calcDewPoint(r.temperature, r.humidity),
      feelsLike: r.temperature,
      visibility: 10,
      uvIndex: 0,
      cloudCover: 0,
      precipInches: 0,
      location: location || r.deviceName,
      region: BLE_METER_LABELS[r.source] || 'BLE Meter',
      country: '',
      localTime: new Date(r.receivedAt).toISOString(),
      isDay: true,
      provider: 'weatherapi', // keep a known provider tag so downstream code is happy
      timestamp: new Date(r.receivedAt).toISOString(),
      rawStation: `BLE:${r.deviceName}`,
    };
  }
}

function calcDewPoint(tempF: number, rh: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const a = 17.27, b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(Math.max(rh, 0.01) / 100);
  const dewC = (b * alpha) / (a - alpha);
  return Math.round(((dewC * 9 / 5) + 32) * 10) / 10;
}

export const bleMeter = new BleWeatherMeterManager();

// Kick off silent auto-reconnect on module load if permissions allow it.
// Wrapped in a queueMicrotask so it doesn't block the first render.
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    bleMeter.autoReconnect().catch(() => { /* expected when flag not set */ });
  });
}
