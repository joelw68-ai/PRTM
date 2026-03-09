/**
 * validationWarningStore.ts — In-memory store for runtime Zod validation warnings.
 *
 * Every time parseRows() or parseRow() encounters a row that fails schema
 * validation, it pushes a structured warning here.  The Debug Panel's
 * Validation Monitor tab subscribes and renders them in real time.
 *
 * Keeps the last MAX_WARNINGS entries (oldest are evicted first).
 */

export interface ValidationFieldIssue {
  /** Dot-joined path to the field, e.g. "notes" or "metadata.tags" */
  path: string;
  /** Zod issue code, e.g. "invalid_type", "too_small" */
  code: string;
  /** Human-readable message from Zod */
  message: string;
  /** The value Zod actually received (stringified) */
  received: string;
}

export interface ValidationWarning {
  /** Auto-incrementing ID */
  id: number;
  /** ISO timestamp of when the warning was recorded */
  timestamp: Date;
  /** Database table name, e.g. "engines", "pass_logs" */
  table: string;
  /** Row index within the batch (0-based) */
  rowIndex: number;
  /** Individual field-level issues */
  issues: ValidationFieldIssue[];
  /** First 500 chars of JSON-stringified raw row for inspection */
  rawRowSnippet: string;
}

export interface TableSummary {
  table: string;
  warningCount: number;
  /** Unique field paths that have failed across all warnings for this table */
  failedFields: string[];
  /** Timestamp of the most recent warning */
  lastSeen: Date;
}

const MAX_WARNINGS = 100;

let warnings: ValidationWarning[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// Pub/Sub
// ---------------------------------------------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // swallow listener errors
    }
  });
}

// ---------------------------------------------------------------------------
// Write API (called from validatedQuery.ts)
// ---------------------------------------------------------------------------

export function pushWarning(
  table: string,
  rowIndex: number,
  issues: ValidationFieldIssue[],
  rawRow: unknown
): void {
  const entry: ValidationWarning = {
    id: nextId++,
    timestamp: new Date(),
    table,
    rowIndex,
    issues,
    rawRowSnippet: safeStringify(rawRow, 500),
  };

  warnings.push(entry);

  // Evict oldest if over limit
  if (warnings.length > MAX_WARNINGS) {
    warnings = warnings.slice(-MAX_WARNINGS);
  }

  notify();
}

// ---------------------------------------------------------------------------
// Read API (called from UI)
// ---------------------------------------------------------------------------

/** All warnings, most recent first. */
export function getWarnings(): ValidationWarning[] {
  return [...warnings].reverse();
}

/** Warnings filtered to a single table, most recent first. */
export function getWarningsByTable(table: string): ValidationWarning[] {
  return warnings.filter(w => w.table === table).reverse();
}

/** Unique table names that have warnings. */
export function getTableNames(): string[] {
  const set = new Set(warnings.map(w => w.table));
  return Array.from(set).sort();
}

/** Per-table aggregation for the summary cards. */
export function getTableSummaries(): TableSummary[] {
  const map = new Map<string, { count: number; fields: Set<string>; lastSeen: Date }>();

  for (const w of warnings) {
    let entry = map.get(w.table);
    if (!entry) {
      entry = { count: 0, fields: new Set(), lastSeen: w.timestamp };
      map.set(w.table, entry);
    }
    entry.count++;
    if (w.timestamp > entry.lastSeen) entry.lastSeen = w.timestamp;
    for (const iss of w.issues) {
      entry.fields.add(iss.path || '(root)');
    }
  }

  return Array.from(map.entries())
    .map(([table, v]) => ({
      table,
      warningCount: v.count,
      failedFields: Array.from(v.fields).sort(),
      lastSeen: v.lastSeen,
    }))
    .sort((a, b) => b.warningCount - a.warningCount);
}

/** Total warning count. */
export function getWarningCount(): number {
  return warnings.length;
}

/** Clear all stored warnings. */
export function clearWarnings(): void {
  warnings = [];
  nextId = 1;
  notify();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeStringify(value: unknown, maxLen: number): string {
  try {
    const str = JSON.stringify(value);
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  } catch {
    return String(value).slice(0, maxLen);
  }
}
