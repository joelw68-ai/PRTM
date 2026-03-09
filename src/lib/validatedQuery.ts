/**
 * validatedQuery.ts — Runtime validation for Supabase query results.
 *
 * Provides `parseRows()` which takes raw PostgREST data and a Zod schema,
 * validates every row, and returns only the rows that pass.  Invalid rows
 * are logged with full Zod issue details so column renames, missing fields,
 * or type mismatches surface immediately in the console instead of silently
 * passing bad data through the app.
 *
 * All validation failures are also pushed to the validationWarningStore
 * so the Debug Panel's Validation Monitor tab can display them in real time.
 *
 * Usage in database.ts:
 *   import { parseRows } from './validatedQuery';
 *   import { EngineRowSchema } from './validators';
 *
 *   const { data, error } = await supabase.from('engines').select('*');
 *   if (error) throw error;
 *   const validRows = parseRows(data, EngineRowSchema, 'engines');
 *   return validRows.map(toEngine);
 *
 * Usage in components with inline queries:
 *   import { parseRows } from '@/lib/validatedQuery';
 *   import { CostReportRowSchema } from '@/lib/validators';
 *
 *   const { data, error } = await supabase.from('cost_reports').select('*');
 *   const reports = parseRows(data, CostReportRowSchema, 'cost_reports');
 */

import { z, ZodTypeAny } from 'zod';
import {
  pushWarning,
  type ValidationFieldIssue,
} from './validationWarningStore';

/**
 * Convert a Zod issue array into our structured ValidationFieldIssue[].
 */
function toFieldIssues(issues: z.ZodIssue[]): ValidationFieldIssue[] {
  return issues.map(iss => ({
    path: iss.path.join('.') || '(root)',
    code: iss.code,
    message: iss.message,
    received: String((iss as any).received ?? ''),
  }));
}

/**
 * Validate an array of raw database rows against a Zod schema.
 *
 * @param data     Raw rows from supabase `.select()` — may be null.
 * @param schema   A Zod object schema that describes the expected row shape.
 * @param table    Table name for log messages (e.g. 'engines').
 * @returns        Array of validated (and potentially transformed) rows.
 *                 Invalid rows are excluded and logged.
 */
export function parseRows<T extends ZodTypeAny>(
  data: unknown[] | null,
  schema: T,
  table: string
): z.infer<T>[] {
  if (!data || data.length === 0) return [];

  const valid: z.infer<T>[] = [];
  let invalidCount = 0;

  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalidCount++;

      const fieldIssues = toFieldIssues(result.error.issues);

      // Push to in-memory store for the Debug Panel
      pushWarning(table, i, fieldIssues, data[i]);

      // Also log the first 5 to the console for traditional debugging
      if (invalidCount <= 5) {
        console.warn(
          `[validatedQuery] ${table} row ${i} failed validation:`,
          fieldIssues,
          '\n  Raw row:', JSON.stringify(data[i]).slice(0, 500)
        );
      }
    }
  }

  if (invalidCount > 0) {
    console.warn(
      `[validatedQuery] ${table}: ${invalidCount}/${data.length} row(s) failed validation and were excluded.`
    );
  }

  return valid;
}

/**
 * Validate a single row (e.g. from `.maybeSingle()` or `.single()`).
 * Returns the validated row or null if validation fails.
 */
export function parseRow<T extends ZodTypeAny>(
  data: unknown | null,
  schema: T,
  table: string
): z.infer<T> | null {
  if (data == null) return null;

  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fieldIssues = toFieldIssues(result.error.issues);

  // Push to in-memory store for the Debug Panel
  pushWarning(table, 0, fieldIssues, data);

  console.warn(
    `[validatedQuery] ${table} single-row validation failed:`,
    fieldIssues,
    '\n  Raw row:', JSON.stringify(data).slice(0, 500)
  );

  return null;
}
