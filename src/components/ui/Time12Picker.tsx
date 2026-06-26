import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';

/**
 * Time12Picker — a custom 12-hour time picker built from three styled
 * dropdowns (hour, minute, AM/PM). It NEVER relies on the native
 * <input type="time"> control, so the AM/PM letters are always rendered
 * in crisp white text and can never be clipped/cut-off by the browser's
 * built-in spinner widget.
 *
 * The value flowing in/out is ALWAYS a 24-hour "HH:mm" string (e.g.
 * "14:05"), so storage/format logic elsewhere in the app stays unchanged.
 * Internally we present it to the user as 12-hour (2:05 PM).
 */

export interface Time12PickerProps {
  /** 24-hour "HH:mm" value (may be empty). */
  value: string;
  /** Called with the new 24-hour "HH:mm" value. */
  onChange: (value: string) => void;
  className?: string;
  /** Minute step (default 1). Use 5/15 for coarser pickers. */
  minuteStep?: number;
  disabled?: boolean;
}

interface Parsed {
  hour12: number; // 1..12
  minute: number; // 0..59
  period: 'AM' | 'PM';
}

const parse = (value: string): Parsed => {
  const m = /^(\d{1,2}):(\d{2})/.exec((value || '').trim());
  if (!m) return { hour12: 12, minute: 0, period: 'AM' };
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h)) h = 0;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return {
    hour12: h,
    minute: Number.isNaN(min) ? 0 : Math.min(59, Math.max(0, min)),
    period,
  };
};

const to24 = (hour12: number, minute: number, period: 'AM' | 'PM'): string => {
  let h = hour12 % 12; // 12 -> 0
  if (period === 'PM') h += 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(minute)}`;
};

const selectBase =
  'bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-orange-400 appearance-none cursor-pointer';

const Time12Picker: React.FC<Time12PickerProps> = ({
  value,
  onChange,
  className = '',
  minuteStep = 1,
  disabled = false,
}) => {
  const { hour12, minute, period } = parse(value);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => {
    const step = minuteStep > 0 ? minuteStep : 1;
    const list: number[] = [];
    for (let i = 0; i < 60; i += step) list.push(i);
    // Make sure the currently-selected minute is always available even if it
    // doesn't fall on the step grid (e.g. an existing "HH:07" value).
    if (!list.includes(minute)) list.push(minute);
    return list.sort((a, b) => a - b);
  }, [minuteStep, minute]);

  const emit = (h: number, m: number, p: 'AM' | 'PM') => onChange(to24(h, m, p));

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
      {/* Hour */}
      <select
        aria-label="Hour"
        disabled={disabled}
        value={hour12}
        onChange={(e) => emit(parseInt(e.target.value, 10), minute, period)}
        className={`${selectBase} w-[3.25rem] text-center`}
        style={{ colorScheme: 'dark' }}
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-slate-400 font-semibold">:</span>
      {/* Minute */}
      <select
        aria-label="Minute"
        disabled={disabled}
        value={minute}
        onChange={(e) => emit(hour12, parseInt(e.target.value, 10), period)}
        className={`${selectBase} w-[3.75rem] text-center`}
        style={{ colorScheme: 'dark' }}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
      {/* AM / PM — wide enough that the letters are NEVER clipped, white text */}
      <select
        aria-label="AM or PM"
        disabled={disabled}
        value={period}
        onChange={(e) => emit(hour12, minute, e.target.value as 'AM' | 'PM')}
        className={`${selectBase} w-[4rem] text-center font-semibold`}
        style={{ colorScheme: 'dark' }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default Time12Picker;
