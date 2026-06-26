import React from 'react';
import Time12Picker from '@/components/ui/Time12Picker';

interface TimeInputDarkProps {
  value?: string;
  /**
   * Kept event-shaped for backwards compatibility with the many call sites
   * that read `e.target.value`. We synthesize a minimal event-like object.
   */
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * TimeInputDark — now a thin wrapper around the custom 12-hour Time12Picker
 * (hour / minute / AM-PM dropdowns). This replaces the old native
 * <input type="time"> implementation whose AM/PM letters rendered in dark,
 * clipped text on dark backgrounds.
 *
 * The value in/out is still a 24-hour "HH:mm" string, and onChange still
 * receives an event-like `{ target: { value } }` object so existing callers
 * (PassLog, PartsUsageHistory, …) keep working without changes.
 */
const TimeInputDark: React.FC<TimeInputDarkProps> = ({
  value = '',
  onChange,
  className = '',
  disabled = false,
}) => {
  return (
    <Time12Picker
      value={value}
      disabled={disabled}
      className={className}
      onChange={(v) => onChange?.({ target: { value: v } })}
    />
  );
};

export default TimeInputDark;
