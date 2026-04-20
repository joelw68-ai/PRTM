import React, { useState } from 'react';
import {
  Bluetooth, BluetoothOff, Radio, Loader2, Wifi, CheckCircle2, XCircle, AlertTriangle,
  Wind, Thermometer, Droplets, Gauge, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBleMeter } from '@/contexts/BleMeterContext';
import { BleMeterType, BLE_METER_LABELS, isBluetoothSupported } from '@/lib/bleWeatherMeter';

/**
 * "Connect Weather Meter" card — drop into ProfileSettings and AdminSettings
 * so a driver can pair a trackside BLE meter in seconds.  When paired, live
 * temp/humidity/pressure/wind are used in place of the API fetch for both the
 * Log Pass modal and the Race Day dashboard.
 */
const BleMeterConnect: React.FC = () => {
  const {
    supported, status, deviceName, lastReading, readingAgeMs,
    pairedDevice, error, connect, disconnect, forget,
  } = useBleMeter();

  const [selectedType, setSelectedType] = useState<BleMeterType>(
    pairedDevice?.meterType || 'generic'
  );
  const [working, setWorking] = useState(false);

  const handleConnect = async () => {
    setWorking(true);
    try {
      await connect(selectedType);
      toast.success(`Paired ${BLE_METER_LABELS[selectedType]} — live readings will flow into Log Pass & Race Day.`);
    } catch (e: any) {
      const msg = e?.message || 'Failed to pair BLE meter.';
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    toast.info('Disconnected from weather meter — falling back to API provider.');
  };

  const handleForget = async () => {
    if (!confirm('Forget this weather meter? You will need to re-pair it next time.')) return;
    await forget();
    toast.info('Weather meter unpaired.');
  };

  // ── Unsupported browser fallback ─────────────────────────────────────────
  if (!supported && !isBluetoothSupported()) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BluetoothOff className="h-5 w-5 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-100">Connect Weather Meter</h3>
        </div>
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 leading-relaxed">
            <strong>Web Bluetooth is not available in this browser.</strong><br />
            Use <span className="font-mono">Chrome</span>, <span className="font-mono">Edge</span>, or <span className="font-mono">Opera</span> on
            desktop or Android to pair a trackside weather meter.  iOS Safari does not yet support Web Bluetooth.
            The app will continue to use the API weather provider in the meantime.
          </div>
        </div>
      </div>
    );
  }

  // ── Status chip colors ───────────────────────────────────────────────────
  let statusLabel = 'Not connected';
  let statusColor = 'text-slate-400';
  let statusBg = 'bg-slate-900/60 border-slate-700';
  if (status === 'live') {
    statusLabel = 'Live'; statusColor = 'text-emerald-300';
    statusBg = 'bg-emerald-500/10 border-emerald-500/40';
  } else if (status === 'connected') {
    statusLabel = 'Connected (waiting)'; statusColor = 'text-cyan-300';
    statusBg = 'bg-cyan-500/10 border-cyan-500/40';
  } else if (status === 'connecting' || status === 'scanning') {
    statusLabel = status === 'scanning' ? 'Scanning for devices…' : 'Connecting…';
    statusColor = 'text-blue-300';
    statusBg = 'bg-blue-500/10 border-blue-500/40';
  } else if (status === 'out-of-range') {
    statusLabel = 'Out of range — using API'; statusColor = 'text-amber-300';
    statusBg = 'bg-amber-500/10 border-amber-500/40';
  } else if (status === 'error') {
    statusLabel = 'Error'; statusColor = 'text-red-300';
    statusBg = 'bg-red-500/10 border-red-500/40';
  }

  const connected = status === 'live' || status === 'connected' || status === 'out-of-range';

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bluetooth className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-slate-100">Connect Weather Meter</h3>
        </div>
        <p className="text-sm text-slate-400">
          Pair a trackside BLE weather meter over Bluetooth and the app will use its live
          temperature, humidity, station pressure, and wind readings in place of the API
          fetch — both in the Log Pass modal and on the Race Day dashboard.  When the
          meter goes out of range we automatically fall back to the selected API provider.
        </p>
      </div>

      {/* Current status chip */}
      <div className={`flex items-center justify-between gap-3 p-3 border rounded-md ${statusBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          {status === 'live' && <Radio className="h-5 w-5 text-emerald-400 flex-shrink-0 animate-pulse" />}
          {(status === 'connecting' || status === 'scanning') && <Loader2 className="h-5 w-5 text-blue-400 flex-shrink-0 animate-spin" />}
          {status === 'connected' && <Bluetooth className="h-5 w-5 text-cyan-400 flex-shrink-0" />}
          {status === 'out-of-range' && <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />}
          {status === 'error' && <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />}
          {status === 'disconnected' && <Wifi className="h-5 w-5 text-slate-500 flex-shrink-0" />}
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</div>
            <div className="text-xs text-slate-500 truncate">
              {deviceName || pairedDevice?.name || 'No meter paired — app is using the API weather provider.'}
            </div>
          </div>
        </div>
        {connected ? (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md flex-shrink-0"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={working || status === 'scanning' || status === 'connecting'}
            className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-md flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
          >
            {working || status === 'scanning' || status === 'connecting'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Bluetooth className="h-3.5 w-3.5" />}
            {pairedDevice ? 'Reconnect' : 'Pair Meter'}
          </button>
        )}
      </div>

      {/* Live reading preview */}
      {status === 'live' && lastReading && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Reading
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {Math.round(readingAgeMs / 1000)}s ago · {lastReading.deviceName}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                <div className="text-slate-100 font-mono tabular-nums">{lastReading.temperature.toFixed(1)}°F</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Humidity</div>
                <div className="text-slate-100 font-mono tabular-nums">{lastReading.humidity}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Pressure</div>
                <div className="text-slate-100 font-mono tabular-nums">{lastReading.pressure.toFixed(2)}"</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Wind</div>
                <div className="text-slate-100 font-mono tabular-nums">{lastReading.windSpeed.toFixed(1)} {lastReading.windDirection}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {status === 'error' && error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
          <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-300 leading-relaxed">{error}</div>
        </div>
      )}

      {/* Meter type picker */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
          Meter Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(BLE_METER_LABELS) as BleMeterType[]).map((t) => {
            const isSel = selectedType === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                disabled={connected}
                className={`text-xs px-3 py-2 rounded-md border transition-all ${
                  isSel
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-1.5 justify-center">
                  {isSel && <CheckCircle2 className="h-3 w-3" />}
                  <span>{BLE_METER_LABELS[t]}</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          The app probes both the Bluetooth SIG Environmental Sensing Service (Kestrel, newer DRWS)
          and the Nordic UART Service (RaceAir, HM-10 gateways, Bluefruit) — the meter type just
          tweaks the probe order.  Pick "Generic" if you're unsure.
        </p>
      </div>

      {/* Paired device info + forget */}
      {pairedDevice && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-700 pt-4">
          <div className="text-xs text-slate-500">
            <span className="text-slate-400">Paired device:</span>{' '}
            <span className="font-mono text-slate-300">{pairedDevice.name}</span>
            <span className="text-slate-600 mx-2">·</span>
            Last seen {pairedDevice.lastSeen
              ? new Date(pairedDevice.lastSeen).toLocaleString()
              : 'never'}
          </div>
          <button
            onClick={handleForget}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Forget
          </button>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-md">
        <Wifi className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-200/80 leading-relaxed">
          <strong>Smart fallback.</strong> When your meter is streaming (green pill in the header),
          DA, SAE, and corrected HP use those readings directly.  If the meter goes quiet for more
          than 30 seconds we fall back to your selected API weather provider so your numbers never
          go blank between passes.
        </div>
      </div>
    </div>
  );
};

export default BleMeterConnect;
