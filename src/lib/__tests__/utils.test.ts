import { describe, it, expect } from 'vitest';
import { getLocalDateString } from '../utils';

describe('getLocalDateString', () => {
  // ── Format validation ──────────────────────────────────────────────────────

  it('returns a string in YYYY-MM-DD format', () => {
    const result = getLocalDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today's date when called with no argument', () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    expect(getLocalDateString()).toBe(expected);
  });

  // ── Specific Date objects ──────────────────────────────────────────────────

  it('returns the correct date for a specific Date object', () => {
    // 2024-07-04 at noon local time
    const july4 = new Date(2024, 6, 4, 12, 0, 0);
    expect(getLocalDateString(july4)).toBe('2024-07-04');
  });

  it('handles New Year's Day correctly', () => {
    const newYear = new Date(2026, 0, 1, 10, 0, 0);
    expect(getLocalDateString(newYear)).toBe('2026-01-01');
  });

  it('handles Dec 31 correctly', () => {
    const newYearsEve = new Date(2025, 11, 31, 23, 30, 0);
    expect(getLocalDateString(newYearsEve)).toBe('2025-12-31');
  });

  // ── Single-digit month and day padding ─────────────────────────────────────

  it('zero-pads single-digit months', () => {
    // March 15 → month 3 should become "03"
    const march15 = new Date(2025, 2, 15, 12, 0, 0);
    expect(getLocalDateString(march15)).toBe('2025-03-15');
  });

  it('zero-pads single-digit days', () => {
    // October 5 → day 5 should become "05"
    const oct5 = new Date(2025, 9, 5, 12, 0, 0);
    expect(getLocalDateString(oct5)).toBe('2025-10-05');
  });

  it('zero-pads both single-digit month and day', () => {
    // January 1 → "01-01"
    const jan1 = new Date(2025, 0, 1, 12, 0, 0);
    expect(getLocalDateString(jan1)).toBe('2025-01-01');
  });

  it('does not pad double-digit months and days', () => {
    // December 25 → "12-25"
    const xmas = new Date(2025, 11, 25, 12, 0, 0);
    expect(getLocalDateString(xmas)).toBe('2025-12-25');
  });

  // ── Midnight edge case (the original bug) ─────────────────────────────────
  // In US timezones (UTC-5 to UTC-10), midnight local = 5:00–10:00 AM UTC.
  // toISOString() at midnight local would still show the correct UTC date,
  // but the *previous* day's 11 PM local → next day in UTC.
  // getLocalDateString must always reflect the LOCAL date.

  it('returns the correct LOCAL date at midnight (00:00:00)', () => {
    const midnight = new Date(2025, 5, 15, 0, 0, 0); // June 15 at midnight local
    expect(getLocalDateString(midnight)).toBe('2025-06-15');
  });

  it('returns the correct LOCAL date at 00:00:01', () => {
    const justAfterMidnight = new Date(2025, 5, 15, 0, 0, 1);
    expect(getLocalDateString(justAfterMidnight)).toBe('2025-06-15');
  });

  // ── 11:59 PM edge case ─────────────────────────────────────────────────────
  // At 11:59 PM local in UTC+ timezones, toISOString() could show the
  // *previous* UTC date.  getLocalDateString must still return the local date.

  it('returns the correct LOCAL date at 11:59:59 PM', () => {
    const lateNight = new Date(2025, 5, 15, 23, 59, 59);
    expect(getLocalDateString(lateNight)).toBe('2025-06-15');
  });

  it('returns the correct LOCAL date at 11:00 PM', () => {
    const elevenPM = new Date(2025, 5, 15, 23, 0, 0);
    expect(getLocalDateString(elevenPM)).toBe('2025-06-15');
  });

  // ── Month boundary edge cases ──────────────────────────────────────────────

  it('handles the last day of a 28-day February', () => {
    const feb28 = new Date(2025, 1, 28, 23, 59, 59);
    expect(getLocalDateString(feb28)).toBe('2025-02-28');
  });

  it('handles Feb 29 on a leap year', () => {
    const feb29 = new Date(2024, 1, 29, 0, 0, 0);
    expect(getLocalDateString(feb29)).toBe('2024-02-29');
  });

  it('handles the last day of a 31-day month', () => {
    const jan31 = new Date(2025, 0, 31, 23, 59, 59);
    expect(getLocalDateString(jan31)).toBe('2025-01-31');
  });

  it('handles the last day of a 30-day month', () => {
    const apr30 = new Date(2025, 3, 30, 23, 59, 59);
    expect(getLocalDateString(apr30)).toBe('2025-04-30');
  });

  // ── Contrast with toISOString().split('T')[0] ─────────────────────────────
  // This test documents the bug that getLocalDateString was created to fix.
  // It constructs a date at midnight local time and verifies that
  // getLocalDateString returns the local date, regardless of what
  // toISOString would return.

  it('always matches local date components, not UTC', () => {
    const d = new Date(2025, 0, 15, 0, 0, 0); // Jan 15 midnight local
    const result = getLocalDateString(d);

    // Verify against local date components directly
    expect(result).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  });

  // ── Default argument (undefined) ───────────────────────────────────────────

  it('accepts undefined and defaults to now', () => {
    const before = new Date();
    const result = getLocalDateString(undefined);
    const after = new Date();

    // The result should match either `before` or `after` (in case of
    // midnight rollover during the call — astronomically unlikely but safe)
    const expected1 = [
      before.getFullYear(),
      String(before.getMonth() + 1).padStart(2, '0'),
      String(before.getDate()).padStart(2, '0'),
    ].join('-');
    const expected2 = [
      after.getFullYear(),
      String(after.getMonth() + 1).padStart(2, '0'),
      String(after.getDate()).padStart(2, '0'),
    ].join('-');

    expect([expected1, expected2]).toContain(result);
  });
});
