import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  bleMeter,
  BleMeterType,
  BleMeterReading,
  BleConnectionStatus,
  isBluetoothSupported,
  getPairedDevice,
  BlePairedDevice,
} from '@/lib/bleWeatherMeter';

interface BleMeterContextValue {
  supported: boolean;
  status: BleConnectionStatus;
  deviceName: string;
  meterType: BleMeterType;
  pairedDevice: BlePairedDevice | null;
  lastReading: BleMeterReading | null;
  readingAgeMs: number;
  isLive: boolean;
  error: string;
  connect: (type?: BleMeterType) => Promise<void>;
  disconnect: () => Promise<void>;
  forget: () => Promise<void>;
}

const BleMeterContext = createContext<BleMeterContextValue | null>(null);

export const BleMeterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<BleConnectionStatus>(bleMeter.getStatus());
  const [deviceName, setDeviceName] = useState<string>(bleMeter.getDeviceName());
  const [lastReading, setLastReading] = useState<BleMeterReading | null>(bleMeter.getLatestReading());
  const [readingAgeMs, setReadingAgeMs] = useState(0);
  const [error, setError] = useState<string>(bleMeter.getError());
  const [pairedDevice, setPairedDeviceState] = useState<BlePairedDevice | null>(() => getPairedDevice());

  useEffect(() => {
    const offStatus = bleMeter.onStatus((s, info) => {
      setStatus(s);
      setDeviceName(info?.deviceName || bleMeter.getDeviceName() || '');
      setError(info?.error || '');
      setPairedDeviceState(getPairedDevice());
    });
    const offReading = bleMeter.onReading((r) => {
      setLastReading(r);
      setPairedDeviceState(getPairedDevice());
    });
    return () => { offStatus(); offReading(); };
  }, []);

  // Tick reading age every second so the UI updates "X s ago" live
  useEffect(() => {
    if (!lastReading) return;
    const t = setInterval(() => {
      setReadingAgeMs(Date.now() - lastReading.receivedAt);
    }, 1000);
    // Initialize immediately
    setReadingAgeMs(Date.now() - lastReading.receivedAt);
    return () => clearInterval(t);
  }, [lastReading]);

  const value: BleMeterContextValue = {
    supported: isBluetoothSupported(),
    status,
    deviceName,
    meterType: bleMeter.getMeterType(),
    pairedDevice,
    lastReading,
    readingAgeMs,
    isLive: status === 'live',
    error,
    connect: (type?: BleMeterType) => bleMeter.connect(type),
    disconnect: () => bleMeter.disconnect(),
    forget: () => bleMeter.forget(),
  };

  return (
    <BleMeterContext.Provider value={value}>{children}</BleMeterContext.Provider>
  );
};

export function useBleMeter(): BleMeterContextValue {
  const ctx = useContext(BleMeterContext);
  if (!ctx) {
    // Return a safe default so components can render outside the provider
    // (e.g. during SSR or tests) without crashing.
    return {
      supported: false,
      status: 'unsupported',
      deviceName: '',
      meterType: 'generic',
      pairedDevice: null,
      lastReading: null,
      readingAgeMs: 0,
      isLive: false,
      error: 'BLE meter context not available',
      connect: async () => {},
      disconnect: async () => {},
      forget: async () => {},
    };
  }
  return ctx;
}
