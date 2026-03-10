#!/usr/bin/env node

/**
 * Multi-timezone test runner for parseLocalDate / formatLocalDate / parseLocalDateTime.
 *
 * Runs the parseLocalDate test suite under five different TZ environment values
 * to catch timezone-dependent regressions that only manifest in specific offsets.
 *
 * Usage:
 *   node scripts/test-timezones.mjs
 *   npm run test:tz
 *
 * Timezones tested:
 *   - Pacific/Honolulu   (UTC-10)  — Hawaii, no DST
 *   - America/New_York   (UTC-5/-4) — US Eastern
 *   - UTC                (UTC+0)   — baseline
 *   - Asia/Kolkata        (UTC+5:30) — India, half-hour offset
 *   - Pacific/Auckland    (UTC+12/+13) — New Zealand
 */

import { execSync } from 'node:child_process';

const TIMEZONES = [
  { tz: 'Pacific/Honolulu',  label: 'Hawaii (UTC-10)' },
  { tz: 'America/New_York',  label: 'Eastern (UTC-5/-4)' },
  { tz: 'UTC',               label: 'UTC (UTC+0)' },
  { tz: 'Asia/Kolkata',      label: 'India (UTC+5:30)' },
  { tz: 'Pacific/Auckland',  label: 'New Zealand (UTC+12/+13)' },
];

const TEST_FILE = 'src/lib/__tests__/parseLocalDate.test.ts';

let passed = 0;
let failed = 0;
const failures = [];

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Multi-Timezone Test Runner — parseLocalDate suite');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

for (const { tz, label } of TIMEZONES) {
  process.stdout.write(`  ▸ ${label.padEnd(30)} `);
  try {
    execSync(`npx vitest run ${TEST_FILE}`, {
      env: { ...process.env, TZ: tz },
      stdio: 'pipe',
      timeout: 30_000,
    });
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✗ FAIL');
    failed++;
    failures.push({ tz, label, output: err.stdout?.toString() || err.message });
  }
}

console.log('');
console.log('───────────────────────────────────────────────────────────');
console.log(`  Results: ${passed} passed, ${failed} failed, ${TIMEZONES.length} total`);
console.log('───────────────────────────────────────────────────────────');

if (failures.length > 0) {
  console.log('');
  console.log('  Failed timezones:');
  for (const f of failures) {
    console.log(`    • ${f.label} (TZ=${f.tz})`);
    if (f.output) {
      // Print last 20 lines of output for context
      const lines = f.output.split('\n').filter(Boolean).slice(-20);
      for (const line of lines) {
        console.log(`      ${line}`);
      }
    }
  }
  console.log('');
  process.exit(1);
} else {
  console.log('');
  console.log('  All timezone tests passed!');
  console.log('');
  process.exit(0);
}
