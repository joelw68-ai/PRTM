import { describe, it, expect } from 'vitest';
import { parseLocalDate, getLocalDateString } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════════
// parseLocalDate — Comprehensive Test Suite
//
// This file validates that parseLocalDate() correctly converts "YYYY-MM-DD"
// date-only strings into Date objects at LOCAL midnight, avoiding the
// well-known JavaScript bug where `new Date("2026-03-09")` is parsed as
// UTC midnight — which in US timezones (UTC-5 … UTC-10) falls on the
// PREVIOUS calendar day in local time.
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseLocalDate', () => {
  // ── Returns a valid Date ─────────────────────────────────────────────────

  it('returns a Date object', () => {
    expect(parseLocalDate('2025-06-15')).toBeInstanceOf(Date);
  });

  it('does not return NaN (Invalid Date)', () => {
    const d = parseLocalDate('2025-06-15');
    expect(isNaN(d.getTime())).toBe(false);
  });

  // ── Core correctness: local midnight ─────────────────────────────────────

  it('parses a date-only string as local midnight', () => {
    const d = parseLocalDate('2026-03-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);     // March = 2 (0-indexed)
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('parses January 1 correctly', () => {
    const d = parseLocalDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('parses December 31 correctly', () => {
    const d = parseLocalDate('2025-12-31');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  // ── Regression: the off-by-one-day UTC bug ───────────────────────────────
  //
  // The original bug: `new Date("2026-03-09")` in UTC-5 timezone gives
  // March 8 at 7:00 PM local time, so `.getDate()` returns 8 instead of 9.
  // parseLocalDate must ALWAYS return the correct calendar day.

  it('REGRESSION: never shifts March 9 to March 8 (the UTC midnight bug)', () => {
    const d = parseLocalDate('2026-03-09');
    expect(d.getDate()).toBe(9);
    // Also verify month didn't shift
    expect(d.getMonth()).toBe(2); // March
  });

  it('REGRESSION: never shifts January 1 to December 31 of previous year', () => {
    const d = parseLocalDate('2026-01-01');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
    expect(d.getFullYear()).toBe(2026);
  });

  it('REGRESSION: getDate() always matches the day in the input string', () => {
    // Test a variety of dates that are known to be problematic with UTC parsing
    const testCases = [
      { input: '2026-03-09', expectedDay: 9, expectedMonth: 2 },
      { input: '2025-01-01', expectedDay: 1, expectedMonth: 0 },
      { input: '2025-07-04', expectedDay: 4, expectedMonth: 6 },
      { input: '2025-11-30', expectedDay: 30, expectedMonth: 10 },
      { input: '2024-02-29', expectedDay: 29, expectedMonth: 1 },
      { input: '2025-12-31', expectedDay: 31, expectedMonth: 11 },
      { input: '2025-06-01', expectedDay: 1, expectedMonth: 5 },
      { input: '2025-10-15', expectedDay: 15, expectedMonth: 9 },
    ];
    for (const { input, expectedDay, expectedMonth } of testCases) {
      const d = parseLocalDate(input);
      expect(d.getDate()).toBe(expectedDay);
      expect(d.getMonth()).toBe(expectedMonth);
    }
  });

  it('REGRESSION: batch test — every day in March 2026 parses correctly', () => {
    for (let day = 1; day <= 31; day++) {
      const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
      const d = parseLocalDate(dateStr);
      expect(d.getDate()).toBe(day);
      expect(d.getMonth()).toBe(2); // March
      expect(d.getFullYear()).toBe(2026);
    }
  });

  // ── Leap year handling ───────────────────────────────────────────────────

  it('handles Feb 29 on a leap year (2024)', () => {
    const d = parseLocalDate('2024-02-29');
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
    expect(d.getFullYear()).toBe(2024);
  });

  it('handles Feb 28 on a non-leap year (2025)', () => {
    const d = parseLocalDate('2025-02-28');
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it('handles Feb 29 on a century leap year (2000)', () => {
    const d = parseLocalDate('2000-02-29');
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  // ── Month boundary edge cases ──────────────────────────────────────────

  it('handles last day of a 30-day month (April 30)', () => {
    const d = parseLocalDate('2025-04-30');
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(30);
  });

  it('handles last day of a 31-day month (January 31)', () => {
    const d = parseLocalDate('2025-01-31');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
  });

  it('handles first day of every month', () => {
    for (let month = 1; month <= 12; month++) {
      const dateStr = `2025-${String(month).padStart(2, '0')}-01`;
      const d = parseLocalDate(dateStr);
      expect(d.getMonth()).toBe(month - 1);
      expect(d.getDate()).toBe(1);
    }
  });

  // ── Single-digit months and days (zero-padded input) ───────────────────

  it('handles single-digit month (January = 01)', () => {
    const d = parseLocalDate('2025-01-15');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('handles single-digit day (05)', () => {
    const d = parseLocalDate('2025-10-05');
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(5);
  });

  it('handles double-digit month and day (December 25)', () => {
    const d = parseLocalDate('2025-12-25');
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
  });

  // ── Comparison correctness ─────────────────────────────────────────────

  it('later date > earlier date when compared by getTime()', () => {
    const a = parseLocalDate('2025-06-15');
    const b = parseLocalDate('2025-06-14');
    expect(a.getTime()).toBeGreaterThan(b.getTime());
  });

  it('same date = same timestamp', () => {
    const a = parseLocalDate('2025-06-15');
    const b = parseLocalDate('2025-06-15');
    expect(a.getTime()).toBe(b.getTime());
  });

  it('cross-month comparison works correctly', () => {
    const jan31 = parseLocalDate('2025-01-31');
    const feb01 = parseLocalDate('2025-02-01');
    expect(feb01.getTime()).toBeGreaterThan(jan31.getTime());
  });

  it('cross-year comparison works correctly', () => {
    const dec31 = parseLocalDate('2024-12-31');
    const jan01 = parseLocalDate('2025-01-01');
    expect(jan01.getTime()).toBeGreaterThan(dec31.getTime());
  });

  // ── Round-trip with getLocalDateString ──────────────────────────────────

  it('round-trips through getLocalDateString', () => {
    const original = '2026-03-09';
    const parsed = parseLocalDate(original);
    const formatted = getLocalDateString(parsed);
    expect(formatted).toBe(original);
  });

  it('round-trips a variety of edge dates through getLocalDateString', () => {
    const dates = [
      '2024-02-29', // leap day
      '2025-01-01', // new year
      '2025-12-31', // new year's eve
      '2025-06-15', // mid-year
      '2025-03-09', // DST transition (US spring forward)
      '2025-11-02', // DST transition (US fall back)
      '2025-07-04', // Independence Day
      '2026-03-09', // the original bug date
    ];
    for (const dateStr of dates) {
      expect(getLocalDateString(parseLocalDate(dateStr))).toBe(dateStr);
    }
  });

  // ── DST transition dates ───────────────────────────────────────────────
  // These dates are when DST transitions occur in the US, which can cause
  // subtle off-by-one issues if UTC is used instead of local time.

  it('handles US spring-forward DST date (March 9, 2025)', () => {
    const d = parseLocalDate('2025-03-09');
    expect(d.getDate()).toBe(9);
    expect(d.getMonth()).toBe(2);
  });

  it('handles US fall-back DST date (November 2, 2025)', () => {
    const d = parseLocalDate('2025-11-02');
    expect(d.getDate()).toBe(2);
    expect(d.getMonth()).toBe(10);
  });

  it('handles US spring-forward DST date (March 8, 2026)', () => {
    const d = parseLocalDate('2026-03-08');
    expect(d.getDate()).toBe(8);
    expect(d.getMonth()).toBe(2);
  });

  // ── Graceful handling of edge inputs ───────────────────────────────────

  it('handles empty string gracefully (returns Invalid Date)', () => {
    // parseLocalDate('') will create new Date('' + 'T00:00:00') = new Date('T00:00:00')
    // which is an Invalid Date. We just verify it doesn't throw.
    const d = parseLocalDate('');
    expect(d).toBeInstanceOf(Date);
    // The result should be Invalid Date (NaN)
    expect(isNaN(d.getTime())).toBe(true);
  });

  // ── Contrast with bare new Date(string) ────────────────────────────────
  // Documents the bug that parseLocalDate was created to fix.
  // NOTE: These tests demonstrate the PROBLEM, not the solution.

  it('demonstrates the UTC bug that parseLocalDate prevents', () => {
    // new Date("2026-03-09") is parsed as UTC midnight.
    // In any timezone behind UTC (e.g., UTC-5), this becomes March 8 at 7 PM local.
    const buggyDate = new Date('2026-03-09');
    const safeDate = parseLocalDate('2026-03-09');

    // parseLocalDate always gives the correct day
    expect(safeDate.getDate()).toBe(9);

    // The buggy version MAY give 8 depending on timezone.
    // We can't assert the buggy behavior because the test runner's timezone
    // is unknown, but we CAN assert parseLocalDate is always correct.
    expect(safeDate.getMonth()).toBe(2);
    expect(safeDate.getFullYear()).toBe(2026);
  });

  // ── Timezone consistency ───────────────────────────────────────────────
  // Regardless of the user's timezone offset, parseLocalDate should always
  // return a Date whose local date components match the input string.

  it('local date components always match the input string regardless of timezone', () => {
    // Test a broad range of dates
    const testDates = [
      '2020-01-01', '2020-06-15', '2020-12-31',
      '2024-02-29', '2025-03-09', '2025-11-02',
      '2026-03-09', '2026-07-04', '2026-12-25',
    ];

    for (const dateStr of testDates) {
      const [yearStr, monthStr, dayStr] = dateStr.split('-');
      const d = parseLocalDate(dateStr);

      expect(d.getFullYear()).toBe(parseInt(yearStr));
      expect(d.getMonth()).toBe(parseInt(monthStr) - 1);
      expect(d.getDate()).toBe(parseInt(dayStr));
    }
  });

  // ── Usage in date arithmetic (common patterns in the codebase) ─────────

  it('works correctly for "days until" calculations', () => {
    const date1 = parseLocalDate('2025-06-10');
    const date2 = parseLocalDate('2025-06-15');
    const diffMs = date2.getTime() - date1.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(5);
  });

  it('works correctly for "days overdue" calculations', () => {
    const dueDate = parseLocalDate('2025-06-10');
    const today = parseLocalDate('2025-06-13');
    const diffMs = today.getTime() - dueDate.getTime();
    const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    expect(daysOverdue).toBe(3);
  });

  it('works correctly for date >= comparison (filtering)', () => {
    const cutoff = parseLocalDate('2025-06-10');
    const before = parseLocalDate('2025-06-09');
    const same = parseLocalDate('2025-06-10');
    const after = parseLocalDate('2025-06-11');

    expect(before >= cutoff).toBe(false);
    expect(same >= cutoff).toBe(true);
    expect(after >= cutoff).toBe(true);
  });

  it('works correctly for toLocaleDateString() formatting', () => {
    const d = parseLocalDate('2025-07-04');
    const formatted = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // Should contain "July" and "4" and "2025"
    expect(formatted).toContain('July');
    expect(formatted).toContain('4');
    expect(formatted).toContain('2025');
  });

  it('works correctly for toLocaleDateString() with weekday', () => {
    // July 4, 2025 is a Friday
    const d = parseLocalDate('2025-07-04');
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(formatted).toContain('Friday');
  });

  // ── Sorting correctness ────────────────────────────────────────────────

  it('sorts an array of date strings correctly via parseLocalDate', () => {
    const dates = ['2025-12-01', '2025-01-15', '2025-06-30', '2025-03-09'];
    const sorted = [...dates].sort(
      (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
    );
    expect(sorted).toEqual(['2025-01-15', '2025-03-09', '2025-06-30', '2025-12-01']);
  });
});
