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
