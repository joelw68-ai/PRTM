// ═══════════════════════════════════════════════════════════════════════════
// SHARED SANCTIONING BODIES — used by every "Sanctioning Body" dropdown
// ═══════════════════════════════════════════════════════════════════════════
// Keep all dropdowns in sync (RaceCalendar, TeamProfile driver licenses,
// InitialSetup, etc.) by importing from this single source of truth.
//
// The list is ordered by US drag-racing market share so the most common
// choices appear first.  Add new bodies here and every dropdown picks them
// up automatically.

export const SANCTIONING_BODIES = [
  'NHRA',
  'PDRA',
  'IHRA',
  'Radial Outlaws',
  'No Time',
  'DI Winter Series',
  'Other',
] as const;

export type SanctioningBody = typeof SANCTIONING_BODIES[number];

// Bodies that issue formal competition licenses with class designations.
// The driver-license editor in TeamProfile uses this to decide whether
// to show the canned class list or a free-text "License Class" field.
export const LICENSE_ISSUING_BODIES: SanctioningBody[] = ['NHRA', 'PDRA', 'IHRA'];

// Convenience: a default value for "new" forms
export const DEFAULT_SANCTIONING_BODY: SanctioningBody = 'NHRA';
