import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Download, Upload, FileJson, FileSpreadsheet, Loader2,
  CheckCircle2, AlertCircle, RefreshCw, Package, Layers, FileDown
} from 'lucide-react';
import { ComponentPart } from '@/lib/database';
import {
  MainComponentTabId,
  ExportableComponent,
  MainComponentsBackup,
  PartsCsvRow,
  ComponentCsvRow,
  buildPartsCsv,
  buildComponentsCsv,
  parseCsv,
  detectCsvKind,
  parsePartsCsvRows,
  parseComponentsCsvRows,
  downloadTextFile,
  fileStamp,
  resolveTabId,
  getTabLabel,
  newPartId,
  PARTS_CSV_HEADERS,
  COMPONENTS_CSV_HEADERS,
  toCsv,
} from '@/lib/mainComponentsIO';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface ImportPlanPart {
  action: 'create' | 'update';
  existingPartId?: string;
  componentId: string;          // resolved existing id, or '' when the component must be created
  pendingComponentKey?: string; // key into pendingComponents when componentId === ''
  part: PartsCsvRow;
}

export interface PendingComponent {
  key: string;
  tabId: MainComponentTabId;
  name: string;
  row?: ComponentCsvRow;
}

interface Props {
  open: boolean;
  onClose: () => void;
  activeTab: MainComponentTabId;
  components: ExportableComponent[];
  parts: ComponentPart[];
  extraFields: Record<string, any>;
  wearThresholds: Record<string, number>;
  /** Create a main component. Returns the new component's id. */
  onCreateComponent: (tabId: MainComponentTabId, row: ComponentCsvRow) => Promise<string>;
  /** Persist imported / updated standalone parts + their wear limits. */
  onImportParts: (
    parts: ComponentPart[],
    wearLimits: Record<string, number>
  ) => Promise<{ saved: number; failed: number }>;
}

type PanelTab = 'export' | 'import';

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════

const MainComponentsImportExport: React.FC<Props> = ({
  open,
  onClose,
  activeTab,
  components,
  parts,
  extraFields,
  wearThresholds,
  onCreateComponent,
  onImportParts,
}) => {
  const [panel, setPanel] = useState<PanelTab>('export');
  const [scopeAll, setScopeAll] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [planParts, setPlanParts] = useState<ImportPlanPart[]>([]);
  const [pendingComponents, setPendingComponents] = useState<PendingComponent[]>([]);
  const [planComponents, setPlanComponents] = useState<ComponentCsvRow[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const scopedComponents = useMemo(
    () => (scopeAll ? components : components.filter(c => c.tabId === activeTab)),
    [components, scopeAll, activeTab]
  );

  const scopedComponentIds = useMemo(
    () => new Set(scopedComponents.map(c => c.id)),
    [scopedComponents]
  );

  const scopedParts = useMemo(
    () => parts.filter(p => scopedComponentIds.has(p.componentId)),
    [parts, scopedComponentIds]
  );

  if (!open) return null;

  // ═════════════════════════════════════════════════════════════════
  // EXPORT
  // ═════════════════════════════════════════════════════════════════

  const suffix = scopeAll ? 'all' : activeTab;

  const exportPartsCsv = () => {
    if (scopedParts.length === 0) {
      toast.info('No standalone parts to export for this selection');
      return;
    }
    const csv = buildPartsCsv(scopedParts, scopedComponents, wearThresholds);
    downloadTextFile(`standalone-parts-${suffix}-${fileStamp()}.csv`, csv, 'text/csv;charset=utf-8;');
    toast.success(`Exported ${scopedParts.length} standalone part${scopedParts.length !== 1 ? 's' : ''} to CSV`);
  };

  const exportComponentsCsv = () => {
    if (scopedComponents.length === 0) {
      toast.info('No components to export for this selection');
      return;
    }
    const csv = buildComponentsCsv(scopedComponents);
    downloadTextFile(`main-components-${suffix}-${fileStamp()}.csv`, csv, 'text/csv;charset=utf-8;');
    toast.success(`Exported ${scopedComponents.length} component${scopedComponents.length !== 1 ? 's' : ''} to CSV`);
  };

  const exportJsonBackup = () => {
    const scopedExtra: Record<string, any> = {};
    const scopedThresholds: Record<string, number> = {};
    for (const c of scopedComponents) if (extraFields[c.id]) scopedExtra[c.id] = extraFields[c.id];
    for (const p of scopedParts) if (wearThresholds[p.id]) scopedThresholds[p.id] = wearThresholds[p.id];

    const payload: MainComponentsBackup = {
      version: 1,
      type: 'main-components-backup',
      exportedAt: new Date().toISOString(),
      components: scopedComponents,
      parts: scopedParts,
      extraFields: scopedExtra,
      wearThresholds: scopedThresholds,
    };
    downloadTextFile(
      `main-components-backup-${suffix}-${fileStamp()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    toast.success(`Exported backup — ${scopedComponents.length} components, ${scopedParts.length} parts`);
  };

  const downloadTemplate = () => {
    const rows: any[][] = [
      PARTS_CSV_HEADERS,
      ['Engines', 'Engine #1 - Race', '', 'Piston Set', 12, 60, '2026-01-15', 'New set'],
      ['Engines', 'Engine #1 - Race', '', 'Rod Bearings', 12, 40, '', ''],
      ['Transmissions', 'Trans #1', '', 'Input Shaft', 0, 100, '', ''],
    ];
    downloadTextFile('standalone-parts-template.csv', toCsv(rows), 'text/csv;charset=utf-8;');
    toast.success('Template CSV downloaded');
  };

  const downloadComponentsTemplate = () => {
    const rows: any[][] = [
      COMPONENTS_CSV_HEADERS,
      ['Engines', 'Engine #2 - Spare', 'BLK-4421', '2026-03-01', '', '', 0, 0, 'No', 'Fresh build'],
      ['Torque Conv.', 'Converter 3200', 'TC-889', '2026-02-10', '', '', 14, 14, 'Yes', ''],
    ];
    downloadTextFile('main-components-template.csv', toCsv(rows), 'text/csv;charset=utf-8;');
    toast.success('Components template CSV downloaded');
  };

  // ═════════════════════════════════════════════════════════════════
  // IMPORT — PARSE & PLAN
  // ═════════════════════════════════════════════════════════════════

  const resetPlan = () => {
    setPlanParts([]);
    setPendingComponents([]);
    setPlanComponents([]);
    setParseError('');
  };

  const buildPlanFromPartRows = (rows: PartsCsvRow[]) => {
    const pending: PendingComponent[] = [];
    const plan: ImportPlanPart[] = [];

    const byId = new Map(components.map(c => [c.id, c]));
    const byName = new Map(components.map(c => [c.name.trim().toLowerCase(), c]));

    for (const row of rows) {
      // 1. Resolve the target component
      let componentId = '';
      let pendingKey: string | undefined;

      if (row.componentId && byId.has(row.componentId)) {
        componentId = row.componentId;
      } else if (row.componentName && byName.has(row.componentName.trim().toLowerCase())) {
        componentId = byName.get(row.componentName.trim().toLowerCase())!.id;
      } else if (row.componentName) {
        const tabId = resolveTabId(row.componentType) || activeTab;
        const key = `${tabId}::${row.componentName.trim().toLowerCase()}`;
        pendingKey = key;
        if (!pending.some(p => p.key === key)) {
          pending.push({ key, tabId, name: row.componentName.trim() });
        }
      } else {
        // No component reference at all — attach to nothing, skip
        continue;
      }

      // 2. Does this part already exist on that component?
      const existing = componentId
        ? parts.find(
            p =>
              p.componentId === componentId &&
              p.partName.trim().toLowerCase() === row.partName.trim().toLowerCase()
          )
        : undefined;

      plan.push({
        action: existing ? 'update' : 'create',
        existingPartId: existing?.id,
        componentId,
        pendingComponentKey: pendingKey,
        part: row,
      });
    }

    setPlanParts(plan);
    setPendingComponents(pending);
    setPlanComponents([]);
  };

  const buildPlanFromComponentRows = (rows: ComponentCsvRow[]) => {
    const existingNames = new Set(components.map(c => c.name.trim().toLowerCase()));
    const fresh = rows.filter(r => !existingNames.has(r.name.trim().toLowerCase()));
    setPlanComponents(fresh);
    setPendingComponents(
      fresh.map(r => ({
        key: `${resolveTabId(r.componentType) || activeTab}::${r.name.trim().toLowerCase()}`,
        tabId: resolveTabId(r.componentType) || activeTab,
        name: r.name.trim(),
        row: r,
      }))
    );
    setPlanParts([]);
  };

  const handleFile = async (file: File) => {
    resetPlan();
    setFileName(file.name);
    try {
      const text = await file.text();

      // ── JSON backup ──
      if (file.name.toLowerCase().endsWith('.json')) {
        const data = JSON.parse(text);
        const backupParts: ComponentPart[] = Array.isArray(data?.parts) ? data.parts : [];
        const backupComponents: ExportableComponent[] = Array.isArray(data?.components) ? data.components : [];
        const thresholds: Record<string, number> = data?.wearThresholds || {};

        if (backupParts.length === 0 && backupComponents.length === 0) {
          setParseError('This JSON file contains no components or parts.');
          return;
        }

        const compById = new Map(backupComponents.map(c => [c.id, c]));
        const partRows: PartsCsvRow[] = backupParts.map(p => {
          const c = compById.get(p.componentId);
          return {
            componentType: c ? getTabLabel(c.tabId) : p.componentType || '',
            componentName: c ? c.name : '',
            componentId: p.componentId,
            partName: p.partName,
            passes: p.passesOnPart ?? 0,
            wearLimit: thresholds[p.id] || 0,
            dateReplaced: p.dateReplaced || '',
            notes: p.notes || '',
          };
        });

        // Components from the backup that don't exist locally become pending creates
        const existingNames = new Set(components.map(c => c.name.trim().toLowerCase()));
        const missingComponents: ComponentCsvRow[] = backupComponents
          .filter(c => !existingNames.has(c.name.trim().toLowerCase()))
          .map(c => ({
            componentType: getTabLabel(c.tabId),
            name: c.name,
            serialNumber: c.serialNumber || '',
            installDate: c.installDate || '',
            removalDate: c.removalDate || '',
            refreshDate: c.refreshDate || '',
            totalPasses: c.totalPasses || 0,
            passesSinceRebuild: c.passesSinceRebuild || 0,
            currentlyInstalled: !!c.currentlyInstalled,
            notes: c.notes || '',
          }));

        buildPlanFromPartRows(partRows);
        setPlanComponents(missingComponents);
        // Merge the richer component rows into the pending list
        setPendingComponents(prev => {
          const merged = [...prev];
          for (const row of missingComponents) {
            const tabId = resolveTabId(row.componentType) || activeTab;
            const key = `${tabId}::${row.name.trim().toLowerCase()}`;
            const hit = merged.find(m => m.key === key);
            if (hit) hit.row = row;
            else merged.push({ key, tabId, name: row.name.trim(), row });
          }
          return merged;
        });
        return;
      }

      // ── CSV ──
      const rows = parseCsv(text);
      const kind = detectCsvKind(rows);
      if (kind === 'parts') {
        const partRows = parsePartsCsvRows(rows);
        if (partRows.length === 0) {
          setParseError('No usable rows found. Make sure the file has a "Part Name" column.');
          return;
        }
        buildPlanFromPartRows(partRows);
      } else if (kind === 'components') {
        const compRows = parseComponentsCsvRows(rows);
        if (compRows.length === 0) {
          setParseError('No usable rows found. Make sure the file has a "Name" column.');
          return;
        }
        buildPlanFromComponentRows(compRows);
      } else {
        setParseError(
          'Unrecognised CSV. The header row must include "Part Name" (parts import) or "Component Type" + "Name" (components import).'
        );
      }
    } catch (err: any) {
      console.error('[MainComponentsImportExport] parse failed:', err);
      setParseError(err?.message || 'Could not read that file.');
    }
  };

  // ═════════════════════════════════════════════════════════════════
  // IMPORT — APPLY
  // ═════════════════════════════════════════════════════════════════

  const componentsToCreate = createMissing ? pendingComponents : [];
  const skippedForMissingComponent = createMissing
    ? 0
    : planParts.filter(p => !p.componentId).length;
  const createCount = planParts.filter(p => p.action === 'create' && (createMissing || p.componentId)).length;
  const updateCount = planParts.filter(p => p.action === 'update').length;
  const hasWork = componentsToCreate.length > 0 || createCount > 0 || updateCount > 0;

  const applyImport = async () => {
    if (!hasWork) return;
    setBusy(true);
    try {
      // 1. Create any missing components first, mapping key → new id
      const keyToId = new Map<string, string>();
      let createdComponents = 0;
      for (const pc of componentsToCreate) {
        try {
          const row: ComponentCsvRow = pc.row || {
            componentType: getTabLabel(pc.tabId),
            name: pc.name,
            serialNumber: '',
            installDate: '',
            removalDate: '',
            refreshDate: '',
            totalPasses: 0,
            passesSinceRebuild: 0,
            currentlyInstalled: false,
            notes: '',
          };
          const newId = await onCreateComponent(pc.tabId, row);
          keyToId.set(pc.key, newId);
          createdComponents++;
        } catch (err) {
          console.error('[Import] Failed to create component', pc.name, err);
        }
      }

      // 2. Build the part records
      const partRecords: ComponentPart[] = [];
      const wearLimits: Record<string, number> = {};
      let skipped = 0;

      planParts.forEach((entry, idx) => {
        let compId = entry.componentId;
        if (!compId && entry.pendingComponentKey) {
          compId = keyToId.get(entry.pendingComponentKey) || '';
        }
        if (!compId) { skipped++; return; }

        const id = entry.existingPartId || newPartId(idx);
        const tabId = resolveTabId(entry.part.componentType) || activeTab;
        partRecords.push({
          id,
          componentId: compId,
          componentType: tabId,
          partName: entry.part.partName,
          passesOnPart: entry.part.passes,
          dateReplaced: entry.part.dateReplaced || undefined,
          notes: entry.part.notes || undefined,
        });
        if (entry.part.wearLimit > 0) wearLimits[id] = entry.part.wearLimit;
      });

      let saved = 0;
      let failed = 0;
      if (partRecords.length > 0) {
        const res = await onImportParts(partRecords, wearLimits);
        saved = res.saved;
        failed = res.failed;
      }

      const bits: string[] = [];
      if (createdComponents > 0) bits.push(`${createdComponents} component${createdComponents !== 1 ? 's' : ''} created`);
      if (saved > 0) bits.push(`${saved} part${saved !== 1 ? 's' : ''} imported`);
      if (failed > 0) bits.push(`${failed} failed`);
      if (skipped > 0) bits.push(`${skipped} skipped (no matching component)`);

      if (failed > 0) toast.warning(`Import finished — ${bits.join(', ')}`, { duration: 7000 });
      else toast.success(`Import complete — ${bits.join(', ') || 'nothing to do'}`, { duration: 5000 });

      resetPlan();
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      onClose();
    } catch (err: any) {
      console.error('[MainComponentsImportExport] import failed:', err);
      toast.error(err?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            Import / Export — Main Components
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Close">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Panel tabs */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => setPanel('export')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              panel === 'export' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setPanel('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              panel === 'import' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" /> Import
          </button>
        </div>

        {/* Scope selector (shared) */}
        <div className="px-5 pt-4">
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium mr-1">Scope</span>
            <button
              onClick={() => setScopeAll(true)}
              className={`px-3 py-1 rounded text-xs font-medium ${scopeAll ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              All component types
            </button>
            <button
              onClick={() => setScopeAll(false)}
              className={`px-3 py-1 rounded text-xs font-medium ${!scopeAll ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              Current tab — {getTabLabel(activeTab)}
            </button>
            <span className="ml-auto text-xs text-slate-500">
              {scopedComponents.length} component{scopedComponents.length !== 1 ? 's' : ''} · {scopedParts.length} standalone part{scopedParts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── EXPORT PANEL ── */}
        {panel === 'export' && (
          <div className="p-5 space-y-3">
            <button
              onClick={exportPartsCsv}
              className="w-full flex items-center gap-3 p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-left transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium">Standalone Parts — CSV</p>
                <p className="text-xs text-slate-400">
                  One row per part: component, part name, passes, wear limit, date replaced, notes. Re-importable.
                </p>
              </div>
              <Download className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" />
            </button>

            <button
              onClick={exportComponentsCsv}
              className="w-full flex items-center gap-3 p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-orange-500/50 rounded-lg text-left transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium">Main Components — CSV</p>
                <p className="text-xs text-slate-400">
                  Engines, power adders and drivetrain components with serials, dates and pass counts.
                </p>
              </div>
              <Download className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" />
            </button>

            <button
              onClick={exportJsonBackup}
              className="w-full flex items-center gap-3 p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-purple-500/50 rounded-lg text-left transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <FileJson className="w-5 h-5 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium">Full Backup — JSON</p>
                <p className="text-xs text-slate-400">
                  Components + standalone parts + extra fields + wear limits in one restorable file.
                </p>
              </div>
              <Download className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" />
            </button>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-slate-300 rounded text-xs hover:bg-slate-700 border border-slate-700"
              >
                <FileDown className="w-3.5 h-3.5" />
                Parts CSV template
              </button>
              <button
                onClick={downloadComponentsTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-slate-300 rounded text-xs hover:bg-slate-700 border border-slate-700"
              >
                <FileDown className="w-3.5 h-3.5" />
                Components CSV template
              </button>
            </div>
          </div>
        )}

        {/* ── IMPORT PANEL ── */}
        {panel === 'import' && (
          <div className="p-5">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-xl p-6 text-center transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">
                {fileName ? `Selected: ${fileName}` : 'Choose a CSV or JSON file'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Standalone parts CSV, main components CSV, or a full JSON backup
              </p>
            </button>

            {parseError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{parseError}</p>
              </div>
            )}

            {(planParts.length > 0 || planComponents.length > 0) && (
              <div className="mt-4 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-orange-400">{componentsToCreate.length}</p>
                    <p className="text-[10px] text-orange-400/70 font-medium uppercase">New Components</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-green-400">{createCount}</p>
                    <p className="text-[10px] text-green-400/70 font-medium uppercase">New Parts</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-400">{updateCount}</p>
                    <p className="text-[10px] text-blue-400/70 font-medium uppercase">Parts Updated</p>
                  </div>
                  <div className="bg-slate-700/30 border border-slate-600/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-slate-300">{skippedForMissingComponent}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">Skipped</p>
                  </div>
                </div>

                {/* Create missing toggle */}
                {pendingComponents.length > 0 && (
                  <label className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createMissing}
                      onChange={(e) => setCreateMissing(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm text-slate-300">
                      Create the {pendingComponents.length} main component{pendingComponents.length !== 1 ? 's' : ''} referenced in this file that don't exist yet
                      <span className="block text-xs text-slate-500 mt-1">
                        {pendingComponents.slice(0, 6).map(p => `${p.name} (${getTabLabel(p.tabId)})`).join(', ')}
                        {pendingComponents.length > 6 ? ` +${pendingComponents.length - 6} more` : ''}
                      </span>
                    </span>
                  </label>
                )}

                {/* Part preview */}
                {planParts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-orange-400" />
                      Parts preview ({planParts.length})
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 max-h-[220px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-900">
                          <tr className="text-slate-500 uppercase tracking-wider">
                            <th className="text-left px-3 py-2 font-medium">Component</th>
                            <th className="text-left px-3 py-2 font-medium">Part</th>
                            <th className="text-center px-3 py-2 font-medium">Passes</th>
                            <th className="text-center px-3 py-2 font-medium">Limit</th>
                            <th className="text-center px-3 py-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {planParts.slice(0, 200).map((entry, i) => (
                            <tr key={i} className="border-t border-slate-800">
                              <td className="px-3 py-1.5 text-slate-300 truncate max-w-[160px]">
                                {entry.part.componentName || entry.componentId || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-white truncate max-w-[180px]">{entry.part.partName}</td>
                              <td className="px-3 py-1.5 text-center text-slate-300">{entry.part.passes}</td>
                              <td className="px-3 py-1.5 text-center text-slate-400">{entry.part.wearLimit || '—'}</td>
                              <td className="px-3 py-1.5 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    entry.action === 'update'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-green-500/20 text-green-400'
                                  }`}
                                >
                                  {entry.action === 'update' ? 'UPDATE' : 'NEW'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {planParts.length > 200 && (
                      <p className="text-[10px] text-slate-500 mt-1">Showing first 200 of {planParts.length} rows.</p>
                    )}
                  </div>
                )}

                {/* Components-only preview */}
                {planParts.length === 0 && planComponents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-orange-400" />
                      Components to create ({planComponents.length})
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-3 max-h-[200px] overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {planComponents.map((c, i) => (
                          <span key={i} className="px-2.5 py-1 bg-orange-500/15 text-orange-300 text-xs rounded-full border border-orange-500/20">
                            {c.name} · {c.componentType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { resetPlan(); setFileName(''); if (fileRef.current) fileRef.current.value = ''; }}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                  >
                    Clear
                  </button>
                  <button
                    onClick={applyImport}
                    disabled={!hasWork || busy}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {busy ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Apply Import</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainComponentsImportExport;
