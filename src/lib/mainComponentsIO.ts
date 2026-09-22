// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENTS — IMPORT / EXPORT SHARED MODULE
// ═══════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for:
//   • The Main Components tab ids + labels
//   • CSV encode / decode helpers
//   • The canonical CSV column headers for Standalone Parts and Components
//   • The JSON backup payload shape
//
// Imported by:
//   • src/components/race/MainComponents.tsx
//   • src/components/race/MainComponentsImportExport.tsx
// ═══════════════════════════════════════════════════════════════════════

import { ComponentPart } from './database';

// ─────────────────────────────────────────────────────────────────────
// TAB DEFINITIONS (single source of truth)
// ─────────────────────────────────────────────────────────────────────

export type MainComponentTabId =
  | 'engines'
  | 'powerAdders'
  | 'transmissions'
  | 'transmissionDrives'
  | 'torqueConverters'
  | 'thirdMemberGears'
  | 'rearTiresWheels';

export interface MainComponentTabDef {
  id: MainComponentTabId;
  /** Short label used on the tab button */
  label: string;
  /** Singular label used in buttons / modal titles */
  singular: string;
}

export const MAIN_COMPONENT_TABS: MainComponentTabDef[] = [
  { id: 'engines',            label: 'Engines',             singular: 'Engine' },
  { id: 'powerAdders',        label: 'Power Adders',        singular: 'Power Adder' },
  { id: 'transmissions',      label: 'Transmissions',       singular: 'Transmission' },
  { id: 'transmissionDrives', label: 'Trans Drives',        singular: 'Transmission Drive' },
  { id: 'torqueConverters',   label: 'Torque Conv.',        singular: 'Torque Converter' },
  { id: 'thirdMemberGears',   label: '3rd Member & Gears',  singular: '3rd Member / Gear' },
  { id: 'rearTiresWheels',    label: 'Rear Tires & Wheels', singular: 'Rear Tire / Wheel Set' },
];

export const getTabDef = (id: string): MainComponentTabDef | undefined =>
  MAIN_COMPONENT_TABS.find(t => t.id === id);

export const getTabLabel = (id: string): string => getTabDef(id)?.label || id;
export const getTabSingular = (id: string): string => getTabDef(id)?.singular || 'Component';

/** Resolve a free-form string (tab id, label or singular) back to a tab id. */
export const resolveTabId = (raw: string): MainComponentTabId | null => {
  const needle = (raw || '').trim().toLowerCase();
  if (!needle) return null;
  const hit = MAIN_COMPONENT_TABS.find(
    t =>
      t.id.toLowerCase() === needle ||
      t.label.toLowerCase() === needle ||
      t.singular.toLowerCase() === needle
  );
  return hit ? hit.id : null;
};

// ─────────────────────────────────────────────────────────────────────
// CSV HELPERS
// ─────────────────────────────────────────────────────────────────────

/** Escape a single CSV cell (quotes, commas, newlines). */
export const csvCell = (value: any): string => {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

/** Build a CSV string from a 2D array of rows. */
export const toCsv = (rows: any[][]): string =>
  rows.map(r => r.map(csvCell).join(',')).join('\n');

/**
 * Parse a CSV string into a 2D array of strings.
 * Handles quoted fields, escaped quotes ("") and CRLF line endings.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const src = (text || '').replace(/^\uFEFF/, ''); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  // Flush the final field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows
  return rows.filter(r => r.some(c => (c || '').trim() !== ''));
};

/** Trigger a browser download for a text payload. */
export const downloadTextFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** yyyy-mm-dd stamp used in export filenames. */
export const fileStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ─────────────────────────────────────────────────────────────────────
// CANONICAL CSV HEADERS
// ─────────────────────────────────────────────────────────────────────

export const PARTS_CSV_HEADERS = [
  'Component Type',
  'Component Name',
  'Component ID',
  'Part Name',
  'Passes',
  'Wear Limit',
  'Date Replaced',
  'Notes',
];

export const COMPONENTS_CSV_HEADERS = [
  'Component Type',
  'Name',
  'Serial Number',
  'Install Date',
  'Removal Date',
  'Refresh Date',
  'Total Passes',
  'Passes Since Rebuild',
  'Currently Installed',
  'Notes',
];

// ─────────────────────────────────────────────────────────────────────
// ROW TYPES
// ─────────────────────────────────────────────────────────────────────

export interface PartsCsvRow {
  componentType: string;
  componentName: string;
  componentId: string;
  partName: string;
  passes: number;
  wearLimit: number;
  dateReplaced: string;
  notes: string;
}

export interface ComponentCsvRow {
  componentType: string;
  name: string;
  serialNumber: string;
  installDate: string;
  removalDate: string;
  refreshDate: string;
  totalPasses: number;
  passesSinceRebuild: number;
  currentlyInstalled: boolean;
  notes: string;
}

/** Minimal shape MainComponents hands to the import/export modal. */
export interface ExportableComponent {
  id: string;
  tabId: MainComponentTabId;
  name: string;
  serialNumber: string;
  installDate: string;
  removalDate: string;
  refreshDate: string;
  totalPasses: number;
  passesSinceRebuild: number;
  currentlyInstalled: boolean;
  notes: string;
}

export interface MainComponentsBackup {
  version: 1;
  type: 'main-components-backup';
  exportedAt: string;
  components: ExportableComponent[];
  parts: ComponentPart[];
  extraFields: Record<string, any>;
  wearThresholds: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────
// BUILDERS
// ─────────────────────────────────────────────────────────────────────

export const buildPartsCsv = (
  parts: ComponentPart[],
  components: ExportableComponent[],
  wearThresholds: Record<string, number>
): string => {
  const byId = new Map(components.map(c => [c.id, c]));
  const rows: any[][] = [PARTS_CSV_HEADERS];
  for (const p of parts) {
    const comp = byId.get(p.componentId);
    rows.push([
      comp ? getTabLabel(comp.tabId) : p.componentType || '',
      comp ? comp.name : '(unassigned)',
      p.componentId,
      p.partName,
      p.passesOnPart ?? 0,
      wearThresholds[p.id] || '',
      p.dateReplaced || '',
      p.notes || '',
    ]);
  }
  return toCsv(rows);
};

export const buildComponentsCsv = (components: ExportableComponent[]): string => {
  const rows: any[][] = [COMPONENTS_CSV_HEADERS];
  for (const c of components) {
    rows.push([
      getTabLabel(c.tabId),
      c.name,
      c.serialNumber || '',
      c.installDate || '',
      c.removalDate || '',
      c.refreshDate || '',
      c.totalPasses ?? 0,
      c.passesSinceRebuild ?? 0,
      c.currentlyInstalled ? 'Yes' : 'No',
      c.notes || '',
    ]);
  }
  return toCsv(rows);
};

// ─────────────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────────────

const headerIndex = (headers: string[], name: string): number =>
  headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());

export type DetectedCsvKind = 'parts' | 'components' | 'unknown';

export const detectCsvKind = (rows: string[][]): DetectedCsvKind => {
  if (rows.length === 0) return 'unknown';
  const headers = rows[0].map(h => h.trim().toLowerCase());
  if (headers.includes('part name')) return 'parts';
  if (headers.includes('name') && headers.includes('component type')) return 'components';
  return 'unknown';
};

export const parsePartsCsvRows = (rows: string[][]): PartsCsvRow[] => {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const iType = headerIndex(headers, 'Component Type');
  const iName = headerIndex(headers, 'Component Name');
  const iCompId = headerIndex(headers, 'Component ID');
  const iPart = headerIndex(headers, 'Part Name');
  const iPasses = headerIndex(headers, 'Passes');
  const iLimit = headerIndex(headers, 'Wear Limit');
  const iDate = headerIndex(headers, 'Date Replaced');
  const iNotes = headerIndex(headers, 'Notes');

  const get = (r: string[], i: number) => (i >= 0 && r[i] != null ? r[i].trim() : '');

  const out: PartsCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const partName = get(r, iPart);
    if (!partName) continue;
    out.push({
      componentType: get(r, iType),
      componentName: get(r, iName),
      componentId: get(r, iCompId),
      partName,
      passes: parseInt(get(r, iPasses), 10) || 0,
      wearLimit: parseInt(get(r, iLimit), 10) || 0,
      dateReplaced: get(r, iDate),
      notes: get(r, iNotes),
    });
  }
  return out;
};

export const parseComponentsCsvRows = (rows: string[][]): ComponentCsvRow[] => {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const iType = headerIndex(headers, 'Component Type');
  const iName = headerIndex(headers, 'Name');
  const iSerial = headerIndex(headers, 'Serial Number');
  const iInstall = headerIndex(headers, 'Install Date');
  const iRemoval = headerIndex(headers, 'Removal Date');
  const iRefresh = headerIndex(headers, 'Refresh Date');
  const iTotal = headerIndex(headers, 'Total Passes');
  const iSince = headerIndex(headers, 'Passes Since Rebuild');
  const iInstalled = headerIndex(headers, 'Currently Installed');
  const iNotes = headerIndex(headers, 'Notes');

  const get = (r: string[], i: number) => (i >= 0 && r[i] != null ? r[i].trim() : '');

  const out: ComponentCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = get(r, iName);
    if (!name) continue;
    const installedRaw = get(r, iInstalled).toLowerCase();
    out.push({
      componentType: get(r, iType),
      name,
      serialNumber: get(r, iSerial),
      installDate: get(r, iInstall),
      removalDate: get(r, iRemoval),
      refreshDate: get(r, iRefresh),
      totalPasses: parseInt(get(r, iTotal), 10) || 0,
      passesSinceRebuild: parseInt(get(r, iSince), 10) || 0,
      currentlyInstalled: installedRaw === 'yes' || installedRaw === 'true' || installedRaw === '1',
      notes: get(r, iNotes),
    });
  }
  return out;
};

/** Generate a fresh standalone-part id. */
export const newPartId = (suffix: string | number = ''): string =>
  `SP-${Date.now()}-${suffix}${Math.random().toString(36).slice(2, 7)}`;
