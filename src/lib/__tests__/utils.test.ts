import { describe, it, expect } from 'vitest';
import { getLocalDateString, parseLocalDate } from '../utils';

describe('getLocalDateString', () => {
  // ── Format validation ──────────────────────────────────────────────────────

  it('returns a string in YYYY-MM-DD format', () => {
    const result = getLocalDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\u2019s date when called with no argument', () => {
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

  it('handles New Year\u2019s Day correctly', () => {
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

  it('returns the correct LOCAL date at midnight (00:00:00)', () => {
    const midnight = new Date(2025, 5, 15, 0, 0, 0); // June 15 at midnight local
    expect(getLocalDateString(midnight)).toBe('2025-06-15');
  });

  it('returns the correct LOCAL date at 00:00:01', () => {
    const justAfterMidnight = new Date(2025, 5, 15, 0, 0, 1);
    expect(getLocalDateString(justAfterMidnight)).toBe('2025-06-15');
  });

  // ── 11:59 PM edge case ─────────────────────────────────────────────────────

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


// ═══════════════════════════════════════════════════════════════════════════════
// parseLocalDate
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseLocalDate', () => {
  // ── Basic correctness ──────────────────────────────────────────────────────

  it('returns a Date object', () => {
    expect(parseLocalDate('2026-03-09')).toBeInstanceOf(Date);
  });

  it('parses the date as local midnight, not UTC', () => {
    const d = parseLocalDate('2026-03-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);   // March = 2
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('never shifts the day backwards (the UTC midnight bug)', () => {
    // This is the core bug: new Date("2026-03-09") in UTC-5 gives
    // March 8 at 7 PM local.  parseLocalDate must always give March 9.
    const d = parseLocalDate('2026-03-09');
    expect(d.getDate()).toBe(9);
  });

  // ── Single-digit months and days ───────────────────────────────────────────

  it('handles single-digit month (January)', () => {
    const d = parseLocalDate('2025-01-15');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('handles single-digit day', () => {
    const d = parseLocalDate('2025-10-05');
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(5);
  });

  // ── Double-digit months and days ───────────────────────────────────────────

  it('handles double-digit month and day', () => {
    const d = parseLocalDate('2025-12-25');
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
  });

  // ── Leap year ──────────────────────────────────────────────────────────────

  it('handles Feb 29 on a leap year', () => {
    const d = parseLocalDate('2024-02-29');
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  // ── Month boundaries ───────────────────────────────────────────────────────

  it('handles last day of February (non-leap)', () => {
    const d = parseLocalDate('2025-02-28');
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it('handles last day of a 30-day month', () => {
    const d = parseLocalDate('2025-04-30');
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(30);
  });

  it('handles last day of a 31-day month', () => {
    const d = parseLocalDate('2025-01-31');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
  });

  // ── Year boundaries ────────────────────────────────────────────────────────

  it('handles Jan 1', () => {
    const d = parseLocalDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('handles Dec 31', () => {
    const d = parseLocalDate('2025-12-31');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  // ── Comparison correctness ─────────────────────────────────────────────────

  it('compares correctly: later date > earlier date', () => {
    const a = parseLocalDate('2025-06-15');
    const b = parseLocalDate('2025-06-14');
    expect(a.getTime()).toBeGreaterThan(b.getTime());
  });

  it('compares correctly: same date = same timestamp', () => {
    const a = parseLocalDate('2025-06-15');
    const b = parseLocalDate('2025-06-15');
    expect(a.getTime()).toBe(b.getTime());
  });

  // ── Round-trip with getLocalDateString ──────────────────────────────────────

  it('round-trips through getLocalDateString', () => {
    const original = '2026-03-09';
    const parsed = parseLocalDate(original);
    const formatted = getLocalDateString(parsed);
    expect(formatted).toBe(original);
  });

  it('round-trips edge dates through getLocalDateString', () => {
    const dates = ['2024-02-29', '2025-01-01', '2025-12-31', '2025-06-15'];
    for (const dateStr of dates) {
      expect(getLocalDateString(parseLocalDate(dateStr))).toBe(dateStr);
    }
  });

  // ── Contrast with bare new Date(string) ────────────────────────────────────
  // Documents the bug that parseLocalDate was created to fix.

  it('getDate() always matches the day in the input string', () => {
    // For any YYYY-MM-DD string, parseLocalDate must return a Date whose
    // getDate() equals the day component, regardless of timezone offset.
    const testCases = [
      { input: '2026-03-09', expectedDay: 9 },
      { input: '2025-01-01', expectedDay: 1 },
      { input: '2025-11-30', expectedDay: 30 },
      { input: '2024-02-29', expectedDay: 29 },
    ];
    for (const { input, expectedDay } of testCases) {
      expect(parseLocalDate(input).getDate()).toBe(expectedDay);
    }
  });
});
