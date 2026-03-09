import React, { useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimeInputDarkProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  // All standard input props are inherited
}

/**
 * A dark-themed time input with a custom white Clock SVG icon.
 * 
 * The native browser clock picker icon is COMPLETELY hidden using
 * display:none, opacity:0, and width:0 via the CSS class
 * `.time-input-dark-override`. The white lucide Clock SVG is the
 * ONLY visible icon — clicking it calls showPicker() on the hidden
 * native input to open the browser time picker.
 * 
 * The input has sufficient right padding (pr-10 / 2.5rem) so the
 * time text never slides underneath the icon.
 */
const TimeInputDark: React.FC<TimeInputDarkProps> = ({ className = '', style, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Strip any dark bg classes so the wrapper's bg shows through
  const inputClassName = className
    .replace(/bg-slate-900/g, 'bg-transparent')
    .replace(/bg-slate-800/g, 'bg-transparent')
    .replace(/bg-slate-700/g, 'bg-transparent');

  const finalClassName = inputClassName.includes('bg-transparent')
    ? inputClassName
    : `${inputClassName} bg-transparent`;

  const handleIconClick = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      // showPicker() may not be supported in all browsers — fall back to focus
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="relative w-full"
      style={{ backgroundColor: '#1a1a2e', borderRadius: '0.5rem' }}
    >
      <input
        ref={inputRef}
        type="time"
        {...props}
        className={`${finalClassName} time-input-dark-override`}
        style={{
          colorScheme: 'dark',
          paddingRight: '2.5rem',
          WebkitAppearance: 'none',
          ...style,
        }}
      />
      {/* White Clock SVG — the ONLY visible icon */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleIconClick}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-0 m-0 bg-transparent border-none cursor-pointer flex items-center justify-center"
        aria-label="Open time picker"
        style={{ lineHeight: 0 }}
      >
        <Clock className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  );
};

export default TimeInputDark;
