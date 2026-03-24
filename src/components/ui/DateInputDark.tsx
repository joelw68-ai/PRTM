import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputDarkProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  // All standard input props are inherited
}

/**
 * A light-themed date input with a custom Calendar SVG icon.
 * 
 * The native browser calendar picker icon is COMPLETELY hidden using
 * display:none, opacity:0, and width:0 via the CSS class
 * `.date-input-dark-override`. The lucide Calendar SVG is the
 * ONLY visible icon — clicking it calls showPicker() on the hidden
 * native input to open the browser date picker.
 */
const DateInputDark: React.FC<DateInputDarkProps> = ({ className = '', style, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Strip any bg classes so the wrapper's bg shows through
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
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="relative w-full"
      style={{ backgroundColor: '#FFFFFF', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}
    >
      <input
        ref={inputRef}
        type="date"
        {...props}
        className={`${finalClassName} date-input-dark-override`}
        style={{
          colorScheme: 'light',
          paddingRight: '2.5rem',
          color: '#0F172A',
          WebkitAppearance: 'none',
          ...style,
        }}
      />
      {/* Calendar SVG icon */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleIconClick}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-0 m-0 bg-transparent border-none cursor-pointer flex items-center justify-center"
        aria-label="Open date picker"
        style={{ lineHeight: 0 }}
      >
        <Calendar className="w-4 h-4 text-slate-500" style={{ color: '#64748B' }} />
      </button>
    </div>
  );
};

export default DateInputDark;
