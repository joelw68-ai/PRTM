// Database operation logger for debugging
// Stores the last N operations with their status, error messages, and timestamps

export interface DbLogEntry {
  id: number;
  timestamp: Date;
  operation: string; // e.g. 'upsertPassLog', 'fetchEngines', 'deleteWorkOrder'
  type: 'read' | 'write' | 'delete' | 'test' | 'sync';
  table?: string;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  durationMs?: number;
  details?: string;
}

const MAX_ENTRIES = 30; // Store more than we show, so we have history
let entries: DbLogEntry[] = [];
let nextId = 1;
let listeners: Set<() => void> = new Set();

// Subscribe to log changes
export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Get current log entries (most recent first)
export const getEntries = (): DbLogEntry[] => {
  return [...entries].reverse();
};

// Clear all entries
export const clearEntries = (): void => {
  entries = [];
  notify();
};

const notify = () => {
  listeners.forEach(fn => {
    try { fn(); } catch {}
  });
};

// Start a new log entry (returns the entry ID for updating later)
export const logStart = (
  operation: string,
  type: DbLogEntry['type'],
  table?: string,
  details?: string
): number => {
  const id = nextId++;
  const entry: DbLogEntry = {
    id,
    timestamp: new Date(),
    operation,
    type,
    table,
    status: 'pending',
    details,
  };
  entries.push(entry);
  // Trim old entries
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  notify();
  return id;
};

// Mark an entry as successful
export const logSuccess = (id: number, durationMs?: number, details?: string): void => {
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.status = 'success';
    entry.durationMs = durationMs;
    if (details) entry.details = details;
    notify();
  }
};

// Mark an entry as failed
export const logError = (id: number, errorMessage: string, durationMs?: number): void => {
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.status = 'error';
    entry.errorMessage = errorMessage;
    entry.durationMs = durationMs;
    notify();
  }
};

// Convenience: log a complete operation (wraps an async function)
export const logOperation = async <T>(
  operation: string,
  type: DbLogEntry['type'],
  fn: () => Promise<T>,
  table?: string,
  details?: string
): Promise<T> => {
  const id = logStart(operation, type, table, details);
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - startTime);
    logSuccess(id, duration);
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    const msg = error instanceof Error ? error.message : String(error);
    logError(id, msg, duration);
    throw error; // Re-throw so caller can handle it
  }
};

// Quick log for non-async events (like "sync started")
export const logEvent = (
  operation: string,
  type: DbLogEntry['type'],
  status: 'success' | 'error',
  details?: string,
  errorMessage?: string
): void => {
  const id = logStart(operation, type, undefined, details);
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.status = status;
    entry.errorMessage = errorMessage;
    notify();
  }
};
