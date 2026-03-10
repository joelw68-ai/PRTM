import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a YYYY-MM-DD date string in LOCAL time.
 *
 * The common pattern `new Date().toISOString().split('T')[0]` returns the date
 * in UTC, which in US timezones (UTC-5 … UTC-10) shifts to *yesterday* after
 * local midnight → ~5-10 PM the previous day UTC.  This helper avoids that
 * off-by-one bug by building the string from local year/month/day components.
 *
 * @param date  Optional `Date` object.  Defaults to `new Date()` (now).
 * @returns     `"YYYY-MM-DD"` in the user's local timezone.
 *
 * @example
 *   getLocalDateString()                                       // today
 *   getLocalDateString(new Date(Date.now() + 7 * 86400000))   // ~7 days from now
 */
export function getLocalDateString(date?: Date): string {
  const d = date ?? new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


/**
 * Parse a `"YYYY-MM-DD"` date string as **local** midnight.
 *
 * `new Date("2026-03-09")` is treated by the JS spec as **UTC** midnight,
 * which in US timezones (UTC-5 … UTC-10) falls on the **previous** calendar
 * day in local time.  This helper appends `T00:00:00` (no trailing `Z`) so
 * the engine interprets the string as local midnight, keeping the calendar
 * day correct regardless of the user's timezone.
 *
 * Use this everywhere a date-only string (from a date picker, DB column,
 * etc.) needs to be converted to a `Date` object for comparison or display.
 *
 * @param dateStr  A `"YYYY-MM-DD"` string.
 * @returns        A `Date` at local midnight on that calendar day.
 *
 * @example
 *   parseLocalDate('2026-03-09').getDate() // → 9  (never 8)
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}


/**
 * Parse a date string and a time string into a **local** `Date` object.
 *
 * Combines a `"YYYY-MM-DD"` date with a `"HH:MM"` or `"HH:MM:SS"` time
 * into a single `Date` at that local time.  This avoids the UTC-midnight
 * bug from bare `new Date("YYYY-MM-DD")` and provides a consistent,
 * readable pattern for constructing date-time values from separate
 * date and time components.
 *
 * If `timeStr` already contains seconds (e.g. `"14:30:00"`), it is used
 * as-is.  If it only has hours and minutes (e.g. `"14:30"`), `:00` is
 * appended automatically.
 *
 * @param dateStr  A `"YYYY-MM-DD"` string.
 * @param timeStr  A `"HH:MM"` or `"HH:MM:SS"` string.  Defaults to `"00:00"`.
 * @returns        A `Date` at the specified local date and time.
 *
 * @example
 *   parseLocalDateTime('2026-03-09', '14:30')    // March 9 at 2:30 PM local
 *   parseLocalDateTime('2026-03-09', '08:00:00') // March 9 at 8:00 AM local
 *   parseLocalDateTime('2026-03-09')             // March 9 at midnight local
 */
export function parseLocalDateTime(dateStr: string, timeStr: string = '00:00'): Date {
  // Normalize: if timeStr is "HH:MM" (5 chars), append ":00" for seconds
  const normalizedTime = timeStr.length === 5 ? timeStr + ':00' : timeStr;
  return new Date(`${dateStr}T${normalizedTime}`);
}


/**
 * Format a `"YYYY-MM-DD"` date string for display using `toLocaleDateString()`.
 *
 * This is a convenience wrapper that combines `parseLocalDate()` with
 * `toLocaleDateString()` into a single call, reducing boilerplate and
 * ensuring consistent timezone-safe formatting across the codebase.
 *
 * Many components previously chained:
 *   `parseLocalDate(str).toLocaleDateString('en-US', { ... })`
 *
 * With this helper, the same result is achieved more concisely:
 *   `formatLocalDate(str, { month: 'short', day: 'numeric', year: 'numeric' })`
 *
 * @param dateStr  A `"YYYY-MM-DD"` string.
 * @param options  Optional `Intl.DateTimeFormatOptions`.  Defaults to the
 *                 browser's default short date format when omitted.
 * @param locale   Optional BCP 47 locale string.  Defaults to `'en-US'`.
 * @returns        A formatted date string, or `''` if `dateStr` is falsy or
 *                 produces an invalid date.
 *
 * @example
 *   formatLocalDate('2026-03-09')
 *   // → "3/9/2026" (browser default)
 *
 *   formatLocalDate('2026-03-09', { month: 'long', day: 'numeric', year: 'numeric' })
 *   // → "March 9, 2026"
 *
 *   formatLocalDate('2026-03-09', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
 *   // → "Mon, Mar 9, 2026"
 */
export function formatLocalDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'en-US',
): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return options
    ? d.toLocaleDateString(locale, options)
    : d.toLocaleDateString();
}
