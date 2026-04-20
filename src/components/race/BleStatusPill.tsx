import React from 'react';
import { Bluetooth, BluetoothOff, Radio, Wifi, AlertTriangle } from 'lucide-react';
import { useBleMeter } from '@/contexts/BleMeterContext';

interface Props {
  onClick?: () => void;
  className?: string;
}

/**
 * Small connection-status pill for the top header.
 *   green = live BLE meter actively streaming readings
 *   amber = paired but out of range (falling back to API)
 *   gray  = no meter paired (using API provider)
 *   red   = error
 */
const BleStatusPill: React.FC<Props> = ({ onClick, className = '' }) => {
  const { supported, status, deviceName, lastReading, readingAgeMs, pairedDevice } = useBleMeter();

  if (!supported) {
    // Don't render anything if the browser has no Web Bluetooth — keeps the
    // header clean for Safari / Firefox users.
    return null;
  }

  let dotColor = 'bg-slate-500';
  let bgColor = 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60';
  let textColor = 'text-slate-400';
  let label = 'Using API';
  let Icon: React.ComponentType<{ className?: string }> = Wifi;
  let sub: string | null = null;
  let pulse = false;

  if (status === 'live') {
    dotColor = 'bg-emerald-400';
    bgColor = 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25';
    textColor = 'text-emerald-300';
    label = 'Meter Live';
    Icon = Radio;
    pulse = true;
    const secs = Math.round(readingAgeMs / 1000);
    sub = lastReading
      ? `${lastReading.temperature.toFixed(1)}° · ${lastReading.humidity}% · ${lastReading.pressure.toFixed(2)}"  · ${secs}s ago`
      : null;
  } else if (status === 'connecting' || status === 'scanning') {
    dotColor = 'bg-blue-400 animate-pulse';
    bgColor = 'bg-blue-500/15 border-blue-500/40';
    textColor = 'text-blue-300';
    label = status === 'scanning' ? 'Scanning…' : 'Connecting…';
    Icon = Bluetooth;
  } else if (status === 'connected') {
    dotColor = 'bg-cyan-400';
    bgColor = 'bg-cyan-500/15 border-cyan-500/40';
    textColor = 'text-cyan-300';
    label = 'Meter Connected';
    Icon = Bluetooth;
    sub = 'Waiting for first reading…';
  } else if (status === 'out-of-range') {
    dotColor = 'bg-amber-400 animate-pulse';
    bgColor = 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25';
    textColor = 'text-amber-300';
    label = 'Meter Out of Range';
    Icon = AlertTriangle;
    sub = 'Using API · will auto-reconnect';
  } else if (status === 'error') {
    dotColor = 'bg-red-400';
    bgColor = 'bg-red-500/15 border-red-500/40';
    textColor = 'text-red-300';
    label = 'Meter Error';
    Icon = AlertTriangle;
  } else {
    // disconnected — if device is paired, show "Paired, offline"
    if (pairedDevice) {
      label = 'Meter Offline';
      sub = pairedDevice.name;
      Icon = BluetoothOff;
    } else {
      label = 'Using API';
      Icon = Wifi;
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        deviceName
          ? `${deviceName} · ${label}${sub ? ` · ${sub}` : ''}`
          : `${label}${sub ? ` · ${sub}` : ''}`
      }
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${bgColor} ${textColor} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />
      <Icon className="h-3.5 w-3.5" />
      <span className="whitespace-nowrap">{label}</span>
      {sub && <span className="hidden md:inline text-[10px] opacity-70 font-mono">· {sub}</span>}
    </button>
  );
};

export default BleStatusPill;
