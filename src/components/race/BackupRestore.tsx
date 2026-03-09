import React, { useState, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { ChassisSetupRowSchema } from '@/lib/validators';

import {
  Download,
  Upload,
  FileText,
  FileJson,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Clock,
  HardDrive,
  RefreshCw,
  X,
  FileArchive,
  Table2,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// ============ ERROR BOUNDARY ============
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class BackupRestoreErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BackupRestore] Component crashed:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 m-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-red-300 mb-2">Backup & Restore Error</h3>
              <p className="text-sm text-red-300/80 mb-3">
                The Backup & Restore section encountered an error and could not render. This is likely a temporary issue.
              </p>
              {this.state.error && (
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-red-400 font-mono break-all">{this.state.error.message}</p>
                </div>
              )}
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


// ============ CSV HELPERS ============

const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const arrayToCSV = (data: any[], columns?: string[]): string => {
  if (!data || data.length === 0) return '';
  const keys = columns || Object.keys(data[0]);
  const header = keys.map(escapeCSV).join(',');
  const rows = data.map(item =>
    keys.map(key => escapeCSV(item[key])).join(',')
  );
  return [header, ...rows].join('\n');
};

// ============ SIMPLE ZIP CREATOR ============

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const createZip = (files: { name: string; content: string }[]): Blob => {
  const encoder = new TextEncoder();
  const entries: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const fileCrc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, fileCrc, true);
    view.setUint32(18, dataBytes.length, true);
    view.setUint32(22, dataBytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: dataBytes, crc: fileCrc, offset });
    parts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;
  }

  const centralStart = offset;
  for (const entry of entries) {
    const centralHeader = new Uint8Array(46 + entry.name.length);
    const view = new DataView(centralHeader.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.name.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    centralHeader.set(entry.name, 46);
    parts.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  parts.push(endRecord);

  return new Blob(parts, { type: 'application/zip' });
};

// ============ BACKUP VERSION ============
const BACKUP_VERSION = '2.0';
const BACKUP_APP_ID = 'pro-mod-logbook';

// ============ SAFE ARRAY HELPER ============
// Ensures a value is always an array, even if undefined/null
const safeArray = <T,>(val: T[] | undefined | null): T[] => {
  if (Array.isArray(val)) return val;
  return [];
};

// ============ COMPONENT ============

interface BackupRestoreProps {
  currentRole?: string;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ currentRole = 'Owner' }) => {
  // ============ SAFE CONTEXT ACCESS ============
  // Wrap useAuth and useApp in try-catch to prevent crashes if context is unavailable
  let authContext: any = {};
  let appContext: any = {};
  
  try {
    authContext = useAuth();
  } catch (e) {
    console.error('[BackupRestore] useAuth() failed:', e);
  }
  
  try {
    appContext = useApp();
  } catch (e) {
    console.error('[BackupRestore] useApp() failed:', e);
  }

  const user = authContext?.user;
  const isDemoMode = authContext?.isDemoMode ?? false;

  // Destructure with safe defaults for ALL values
  const engines = safeArray(appContext?.engines);
  const superchargers = safeArray(appContext?.superchargers);
  const cylinderHeads = safeArray(appContext?.cylinderHeads);
  const maintenanceItems = safeArray(appContext?.maintenanceItems);
  const sfiCertifications = safeArray(appContext?.sfiCertifications);
  const passLogs = safeArray(appContext?.passLogs);
  const workOrders = safeArray(appContext?.workOrders);
  const preRunChecklist = safeArray(appContext?.preRunChecklist);
  const betweenRoundsChecklist = safeArray(appContext?.betweenRoundsChecklist);
  const postRunChecklist = safeArray(appContext?.postRunChecklist);
  const partsInventory = safeArray(appContext?.partsInventory);
  const raceEvents = safeArray(appContext?.raceEvents);
  const teamMembers = safeArray(appContext?.teamMembers);
  const savedTracks = safeArray(appContext?.savedTracks);
  const drivetrainComponents = safeArray(appContext?.drivetrainComponents);
  const drivetrainSwapLogs = safeArray(appContext?.drivetrainSwapLogs);

  const refreshData = appContext?.refreshData || (async () => {});
  const addEngine = appContext?.addEngine || (async () => {});
  const addSupercharger = appContext?.addSupercharger || (async () => {});
  const addCylinderHead = appContext?.addCylinderHead || (async () => {});
  const addMaintenanceItem = appContext?.addMaintenanceItem || (async () => {});
  const addSFICertification = appContext?.addSFICertification || (async () => {});
  const addPassLog = appContext?.addPassLog || (async () => {});
  const addWorkOrder = appContext?.addWorkOrder || (async () => {});
  const addChecklistItem = appContext?.addChecklistItem || (async () => {});
  const addPartInventory = appContext?.addPartInventory || (async () => {});
  const addRaceEvent = appContext?.addRaceEvent || (async () => {});
  const addTeamMember = appContext?.addTeamMember || (async () => {});
  const addSavedTrack = appContext?.addSavedTrack || (async () => {});
  const addDrivetrainComponent = appContext?.addDrivetrainComponent || (async () => {});

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'preview'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('promod_last_backup_time');
    } catch {
      return null;
    }
  });
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, table: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gather all data for export
  const gatherAllData = useCallback(async () => {
    // Fetch chassis_setups directly from supabase (not in AppContext)
    let chassisSetups: any[] = [];
    try {
      const { data, error } = await supabase
        .from('chassis_setups')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) chassisSetups = parseRows(data, ChassisSetupRowSchema, 'chassis_setups');

    } catch (e) {
      console.warn('Could not fetch chassis_setups:', e);
    }

    return {
      _meta: {
        appId: BACKUP_APP_ID,
        version: BACKUP_VERSION,
        exportDate: new Date().toISOString(),
        exportedBy: user?.email || 'unknown',
        userId: user?.id || 'demo',
        totalRecords: 0
      },
      passLogs: safeArray(passLogs),
      engines: safeArray(engines),
      superchargers: safeArray(superchargers),
      cylinderHeads: safeArray(cylinderHeads),
      maintenanceItems: safeArray(maintenanceItems),
      sfiCertifications: safeArray(sfiCertifications),
      workOrders: safeArray(workOrders),
      checklists: {
        preRun: safeArray(preRunChecklist),
        betweenRounds: safeArray(betweenRoundsChecklist),
        postRun: safeArray(postRunChecklist)
      },
      partsInventory: safeArray(partsInventory),
      raceEvents: safeArray(raceEvents),
      teamMembers: safeArray(teamMembers),
      savedTracks: safeArray(savedTracks),
      chassisSetups,
      drivetrainComponents: safeArray(drivetrainComponents),
      drivetrainSwapLogs: safeArray(drivetrainSwapLogs)
    };
  }, [
    passLogs, engines, superchargers, cylinderHeads, maintenanceItems,
    sfiCertifications, workOrders, preRunChecklist, betweenRoundsChecklist,
    postRunChecklist, partsInventory, raceEvents, teamMembers, savedTracks,
    drivetrainComponents, drivetrainSwapLogs, user
  ]);


  // Calculate total records
  const getTotalRecords = (data: any): number => {
    let total = 0;
    const countable = [
      'passLogs', 'engines', 'superchargers', 'cylinderHeads',
      'maintenanceItems', 'sfiCertifications', 'workOrders',
      'partsInventory', 'raceEvents', 'teamMembers', 'chassisSetups', 'savedTracks',
      'drivetrainComponents', 'drivetrainSwapLogs'
    ];

    for (const key of countable) {
      if (Array.isArray(data?.[key])) total += data[key].length;
    }
    if (data?.checklists) {
      total += safeArray(data.checklists.preRun).length;
      total += safeArray(data.checklists.betweenRounds).length;
      total += safeArray(data.checklists.postRun).length;
    }
    return total;
  };

  // ============ EXPORT JSON ============
  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setStatusMessage('');

    try {
      const data = await gatherAllData();
      data._meta.totalRecords = getTotalRecords(data);

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `pro-mod-logbook-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      try { localStorage.setItem('promod_last_backup_time', now); } catch {}
      setLastBackupTime(now);
      setExportStatus('success');
      setStatusMessage(`Exported ${data._meta.totalRecords} records across all tables as JSON.`);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ============ EXPORT CSV ZIP ============
  const handleExportCSV = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setStatusMessage('');

    try {
      const data = await gatherAllData();
      data._meta.totalRecords = getTotalRecords(data);

      const files: { name: string; content: string }[] = [];

      const addCSV = (name: string, arr: any[]) => {
        if (arr && arr.length > 0) {
          files.push({ name: `${name}.csv`, content: arrayToCSV(arr) });
        }
      };

      addCSV('pass_logs', safeArray(data.passLogs));
      addCSV('engines', safeArray(data.engines));
      addCSV('superchargers', safeArray(data.superchargers));
      addCSV('cylinder_heads', safeArray(data.cylinderHeads));
      addCSV('maintenance_items', safeArray(data.maintenanceItems));
      addCSV('sfi_certifications', safeArray(data.sfiCertifications));
      addCSV('work_orders', safeArray(data.workOrders));
      addCSV('parts_inventory', safeArray(data.partsInventory));
      addCSV('race_events', safeArray(data.raceEvents));
      addCSV('team_members', safeArray(data.teamMembers));
      addCSV('saved_tracks', safeArray(data.savedTracks));
      addCSV('chassis_setups', safeArray(data.chassisSetups));
      addCSV('drivetrain_components', safeArray(data.drivetrainComponents));
      addCSV('drivetrain_swap_logs', safeArray(data.drivetrainSwapLogs));

      // Checklists as separate CSVs
      if (safeArray(data.checklists?.preRun).length > 0) {
        addCSV('checklist_pre_run', data.checklists.preRun);
      }
      if (safeArray(data.checklists?.betweenRounds).length > 0) {
        addCSV('checklist_between_rounds', data.checklists.betweenRounds);
      }
      if (safeArray(data.checklists?.postRun).length > 0) {
        addCSV('checklist_post_run', data.checklists.postRun);
      }

      // Add a manifest file
      files.push({
        name: 'MANIFEST.txt',
        content: [
          `Professional Racing Management - CSV Backup`,
          `Export Date: ${new Date().toLocaleString()}`,
          `Exported By: ${user?.email || 'unknown'}`,
          `Total Records: ${data._meta.totalRecords}`,
          ``,
          `Files included:`,
          ...files.map(f => `  - ${f.name}`),
          ``,
          `NOTE: To restore data, use the JSON backup format.`,
          `CSV exports are for viewing/analysis in spreadsheet software.`
        ].join('\n')
      });

      const zipBlob = createZip(files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `pro-mod-logbook-backup-${dateStr}.csv.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      try { localStorage.setItem('promod_last_backup_time', now); } catch {}
      setLastBackupTime(now);
      setExportStatus('success');
      setStatusMessage(`Exported ${data._meta.totalRecords} records across ${files.length - 1} CSV files in a ZIP archive.`);
    } catch (error) {
      console.error('CSV export error:', error);
      setExportStatus('error');
      setStatusMessage(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ============ IMPORT / RESTORE ============
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportStatus('error');
      setStatusMessage('Only JSON backup files can be imported. CSV exports are for viewing only.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Validate backup file
        if (!data._meta || data._meta.appId !== BACKUP_APP_ID) {
          setImportStatus('error');
          setStatusMessage('This file is not a valid Professional Racing Management backup. Please select a file exported from this app.');
          return;
        }

        setImportPreview(data);
        setImportStatus('preview');
        setShowImportConfirm(true);
      } catch (err) {
        setImportStatus('error');
        setStatusMessage('Could not read backup file. The file may be corrupted or not a valid JSON file.');
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;

    setIsImporting(true);
    setShowImportConfirm(false);
    setImportStatus('idle');
    setStatusMessage('');

    const data = importPreview;
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const tables = [
        { key: 'engines', items: safeArray(data.engines), addFn: addEngine, label: 'Engines', existingIds: new Set(engines.map((e: any) => e.id)) },
        { key: 'superchargers', items: safeArray(data.superchargers), addFn: addSupercharger, label: 'Superchargers', existingIds: new Set(superchargers.map((s: any) => s.id)) },
        { key: 'cylinderHeads', items: safeArray(data.cylinderHeads), addFn: addCylinderHead, label: 'Cylinder Heads', existingIds: new Set(cylinderHeads.map((h: any) => h.id)) },
        { key: 'maintenanceItems', items: safeArray(data.maintenanceItems), addFn: addMaintenanceItem, label: 'Maintenance Items', existingIds: new Set(maintenanceItems.map((m: any) => m.id)) },
        { key: 'sfiCertifications', items: safeArray(data.sfiCertifications), addFn: addSFICertification, label: 'SFI Certifications', existingIds: new Set(sfiCertifications.map((c: any) => c.id)) },
        { key: 'passLogs', items: safeArray(data.passLogs), addFn: addPassLog, label: 'Pass Logs', existingIds: new Set(passLogs.map((p: any) => p.id)) },
        { key: 'workOrders', items: safeArray(data.workOrders), addFn: addWorkOrder, label: 'Work Orders', existingIds: new Set(workOrders.map((w: any) => w.id)) },
        { key: 'partsInventory', items: safeArray(data.partsInventory), addFn: addPartInventory, label: 'Parts Inventory', existingIds: new Set(partsInventory.map((p: any) => p.id)) },
        { key: 'raceEvents', items: safeArray(data.raceEvents), addFn: addRaceEvent, label: 'Race Events', existingIds: new Set(raceEvents.map((e: any) => e.id)) },
        { key: 'teamMembers', items: safeArray(data.teamMembers), addFn: addTeamMember, label: 'Team Members', existingIds: new Set(teamMembers.map((m: any) => m.id)) },
        { key: 'savedTracks', items: safeArray(data.savedTracks), addFn: addSavedTrack, label: 'Saved Tracks', existingIds: new Set(savedTracks.map((t: any) => t.id)) },
        { key: 'drivetrainComponents', items: safeArray(data.drivetrainComponents), addFn: addDrivetrainComponent, label: 'Drivetrain Components', existingIds: new Set(drivetrainComponents.map((d: any) => d.id)) },
      ];

      // Calculate total items
      let totalItems = tables.reduce((sum, t) => sum + t.items.length, 0);

      // Add checklists
      const checklistTypes: Array<{ type: 'preRun' | 'betweenRounds' | 'postRun'; items: any[] }> = [];
      if (safeArray(data.checklists?.preRun).length > 0) {
        checklistTypes.push({ type: 'preRun', items: data.checklists.preRun });
        totalItems += data.checklists.preRun.length;
      }
      if (safeArray(data.checklists?.betweenRounds).length > 0) {
        checklistTypes.push({ type: 'betweenRounds', items: data.checklists.betweenRounds });
        totalItems += data.checklists.betweenRounds.length;
      }
      if (safeArray(data.checklists?.postRun).length > 0) {
        checklistTypes.push({ type: 'postRun', items: data.checklists.postRun });
        totalItems += data.checklists.postRun.length;
      }

      // Add chassis setups count
      if (safeArray(data.chassisSetups).length > 0) {
        totalItems += data.chassisSetups.length;
      }

      // Add drivetrain swap logs count
      if (safeArray(data.drivetrainSwapLogs).length > 0) {
        totalItems += data.drivetrainSwapLogs.length;
      }

      setImportProgress({ current: 0, total: totalItems, table: '' });

      // Import each table
      for (const table of tables) {
        setImportProgress(prev => ({ ...prev, table: table.label }));
        for (const item of table.items) {
          try {
            if (table.existingIds.has(item.id)) {
              skipped++;
            } else {
              await table.addFn(item);
              imported++;
            }
          } catch (err) {
            console.warn(`Error importing ${table.label} item ${item.id}:`, err);
            errors++;
          }
          setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      // Import checklists
      const existingChecklistIds = new Set([
        ...preRunChecklist.map((c: any) => c.id),
        ...betweenRoundsChecklist.map((c: any) => c.id),
        ...postRunChecklist.map((c: any) => c.id)
      ]);

      for (const cl of checklistTypes) {
        setImportProgress(prev => ({ ...prev, table: `Checklist (${cl.type})` }));
        for (const item of cl.items) {
          try {
            if (existingChecklistIds.has(item.id)) {
              skipped++;
            } else {
              await addChecklistItem(cl.type, item);
              imported++;
            }
          } catch (err) {
            console.warn(`Error importing checklist item:`, err);
            errors++;
          }
          setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      // Import chassis setups directly via supabase
      if (safeArray(data.chassisSetups).length > 0) {
        setImportProgress(prev => ({ ...prev, table: 'Chassis Setups' }));
        for (const setup of data.chassisSetups) {
          try {
            const { user_id, ...setupData } = setup;
            const { error } = await supabase.from('chassis_setups').upsert(setupData);
            if (error) throw error;
            imported++;
          } catch (err) {
            console.warn('Error importing chassis setup:', err);
            errors++;
          }
          setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      // Import drivetrain swap logs directly via supabase
      // The actual table name is 'drivetrain_swap_logs' in the database
      if (safeArray(data.drivetrainSwapLogs).length > 0) {
        const existingSwapLogIds = new Set(drivetrainSwapLogs.map((l: any) => l.id));
        setImportProgress(prev => ({ ...prev, table: 'Drivetrain Swap Logs' }));
        for (const log of data.drivetrainSwapLogs) {
          try {
            if (existingSwapLogIds.has(log.id)) {
              skipped++;
            } else {
              const { user_id, ...logData } = log;
              const payload: any = {
                id: logData.id,
                date: logData.date,
                time: logData.time || null,
                component_type: logData.componentType || logData.component_type || null,
                previous_component_id: logData.previousComponentId || logData.previous_component_id || null,
                new_component_id: logData.newComponentId || logData.new_component_id || null,
                previous_component_name: logData.previousComponentName || logData.previous_component_name || null,
                new_component_name: logData.newComponentName || logData.new_component_name || null,
                reason: logData.reason || null,
                performed_by: logData.performedBy || logData.performed_by || null,
                notes: logData.notes || null
              };
              // Try inserting into drivetrain_swap_logs table
              try {
                const { error } = await supabase.from('drivetrain_swap_logs').insert(payload);
                if (error) throw error;
                imported++;
              } catch (insertErr) {
                // If the table doesn't exist, log and skip gracefully
                console.warn('Error inserting drivetrain swap log (table may not exist):', insertErr);
                errors++;
              }
            }
          } catch (err) {
            console.warn('Error importing drivetrain swap log:', err);
            errors++;
          }
          setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }

      // Refresh data from database
      try {
        await refreshData();
      } catch (refreshErr) {
        console.warn('Error refreshing data after import:', refreshErr);
      }

      setImportStatus('success');
      const resultParts = [];
      if (imported > 0) resultParts.push(`${imported} imported`);
      if (skipped > 0) resultParts.push(`${skipped} skipped (already exist)`);
      if (errors > 0) resultParts.push(`${errors} errors`);
      setStatusMessage(`Restore complete: ${resultParts.join(', ')}.`);
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('error');
      setStatusMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      setImportPreview(null);
    }
  };

  // ============ DATA SUMMARY ============
  const dataSummary = [
    { label: 'Pass Logs', count: passLogs.length, icon: FileText },
    { label: 'Engines', count: engines.length, icon: Database },
    { label: 'Superchargers', count: superchargers.length, icon: Database },
    { label: 'Cylinder Heads', count: cylinderHeads.length, icon: Database },
    { label: 'Drivetrain Components', count: drivetrainComponents.length, icon: Database },
    { label: 'Maintenance Items', count: maintenanceItems.length, icon: Database },
    { label: 'SFI Certifications', count: sfiCertifications.length, icon: Shield },
    { label: 'Work Orders', count: workOrders.length, icon: FileText },
    { label: 'Checklist Items', count: preRunChecklist.length + betweenRoundsChecklist.length + postRunChecklist.length, icon: Database },
    { label: 'Parts Inventory', count: partsInventory.length, icon: Database },
    { label: 'Race Events', count: raceEvents.length, icon: Database },
    { label: 'Team Members', count: teamMembers.length, icon: Database },
    { label: 'Saved Tracks', count: savedTracks.length, icon: Database },
  ];

  const totalRecords = dataSummary.reduce((sum, item) => sum + item.count, 0);

  const formatBackupTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      else if (diffHours < 24) relative = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      else if (diffDays < 7) relative = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      else relative = d.toLocaleDateString();

      return { formatted: d.toLocaleString(), relative };
    } catch {
      return { formatted: 'Unknown', relative: 'Unknown' };
    }
  };

  // ============ RENDER ============
  // Wrap entire render in try-catch for safety
  try {
    return (
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10 rounded-xl border border-blue-500/30 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">Data Backup & Restore</h3>
              <p className="text-slate-400 text-sm">
                Export all your data as a single JSON file or CSV zip archive. You can restore from a previously exported JSON backup at any time.
              </p>

              {/* Last Backup Timestamp */}
              <div className="mt-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-500" />
                {lastBackupTime ? (
                  <div className="text-sm">
                    <span className="text-slate-400">Last backup: </span>
                    <span className="text-green-400 font-medium">{formatBackupTime(lastBackupTime).relative}</span>
                    <span className="text-slate-500 ml-2">({formatBackupTime(lastBackupTime).formatted})</span>
                  </div>
                ) : (
                  <span className="text-sm text-yellow-400">No backups recorded yet</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Toggle */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-orange-400" />
              <span className="font-medium text-white">How to Use Backup & Restore</span>
            </div>
            {showInstructions ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showInstructions && (
            <div className="px-4 pb-4 border-t border-slate-700/50">
              <div className="mt-4 space-y-5">
                {/* How to Export */}
                <div>
                  <h4 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    How to Export / Back Up Your Data
                  </h4>
                  <ol className="text-sm text-slate-300 space-y-2 ml-6 list-decimal">
                    <li>Click <strong className="text-white">"Export as JSON"</strong> to download a single file containing ALL your data. This is the recommended format because it can be used to restore your data later.</li>
                    <li>Click <strong className="text-white">"Export as CSV ZIP"</strong> to download a ZIP archive containing individual CSV files for each data table. This is useful for viewing your data in Excel, Google Sheets, or other spreadsheet software.</li>
                    <li>Store the downloaded file in a safe location (cloud drive, USB, etc.).</li>
                    <li>We recommend backing up <strong className="text-white">before and after every race event</strong>, and at least once per week during the season.</li>
                  </ol>
                </div>

                {/* How to Restore */}
                <div>
                  <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    How to Restore / Import Data
                  </h4>
                  <ol className="text-sm text-slate-300 space-y-2 ml-6 list-decimal">
                    <li>Click <strong className="text-white">"Import from Backup"</strong> and select a previously exported <strong>.json</strong> backup file.</li>
                    <li>The app will show you a preview of what's in the backup file (record counts per table).</li>
                    <li>Click <strong className="text-white">"Confirm Import"</strong> to begin the restore process.</li>
                    <li>Records that already exist in your database (same ID) will be <strong className="text-white">skipped</strong> — your existing data is never overwritten.</li>
                    <li>Only new records (not already in your database) will be added.</li>
                  </ol>
                </div>

                {/* Important Notes */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Important Notes
                  </h4>
                  <ul className="text-sm text-yellow-300/80 space-y-1 ml-4 list-disc">
                    <li>Only <strong>JSON</strong> files can be used for restore. CSV exports are for viewing/analysis only.</li>
                    <li>Importing does NOT delete or overwrite existing data — it only adds missing records.</li>
                    <li>If you need to fully reset and restore, contact support to clear your database first.</li>
                    <li>Backup files include: pass logs, engines, superchargers, cylinder heads, drivetrain components (transmissions, torque converters, 3rd members, ring and pinions), maintenance items, SFI certs, work orders, checklists, parts inventory, race events, team members, chassis setups, and saved tracks.</li>
                  </ul>
                </div>

                {/* General App Usage Tips */}
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    General App Tips
                  </h4>
                  <ul className="text-sm text-slate-300 space-y-1 ml-4 list-disc">
                    <li>All data saves automatically to the cloud database as you make changes.</li>
                    <li>The <strong className="text-white">save status indicator</strong> in the header shows whether your latest changes have been synced.</li>
                    <li>Use the <strong className="text-white">"Sync Data"</strong> button in Admin Settings to manually refresh data from the database.</li>
                    <li>If you see a sync error, check your internet connection and try the Sync button again.</li>
                    <li>Your data is accessible from any device when you sign in with the same account.</li>
                    <li>Use the <strong className="text-white">Audit Log</strong> (Admin Settings) to see a history of all changes made to your data.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Summary */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Table2 className="w-4 h-4 text-cyan-400" />
              Current Data Summary
            </h4>
            <span className="text-sm text-slate-400">
              <span className="text-white font-bold">{totalRecords}</span> total records
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {dataSummary.map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className={`text-sm font-bold ${item.count > 0 ? 'text-white' : 'text-slate-600'}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* JSON Export */}
          <div className="bg-slate-800/50 rounded-xl border border-green-500/30 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FileJson className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Export as JSON</h4>
                <p className="text-xs text-slate-400">Single file, can be used for restore</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Downloads a single <code className="text-green-400 bg-green-500/10 px-1 rounded">.json</code> file containing all your data. 
              This is the <strong className="text-white">recommended format</strong> for backups because it can be imported back into the app.
            </p>
            <button
              onClick={handleExportJSON}
              disabled={isExporting || totalRecords === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isExporting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-5 h-5" /> Export as JSON</>
              )}
            </button>
          </div>

          {/* CSV ZIP Export */}
          <div className="bg-slate-800/50 rounded-xl border border-blue-500/30 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <FileArchive className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Export as CSV ZIP</h4>
                <p className="text-xs text-slate-400">Multiple CSV files in a ZIP archive</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Downloads a <code className="text-blue-400 bg-blue-500/10 px-1 rounded">.zip</code> archive containing individual CSV files for each data table. 
              Open in Excel or Google Sheets for analysis.
            </p>
            <button
              onClick={handleExportCSV}
              disabled={isExporting || totalRecords === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isExporting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-5 h-5" /> Export as CSV ZIP</>
              )}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-slate-800/50 rounded-xl border border-orange-500/30 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">Import from Backup</h4>
              <p className="text-xs text-slate-400">Restore data from a previously exported JSON backup file</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Select a <code className="text-orange-400 bg-orange-500/10 px-1 rounded">.json</code> backup file to restore. 
            Existing records will be skipped — only new records are added. Your current data is never overwritten.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isDemoMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isImporting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Importing ({importProgress.current}/{importProgress.total}) — {importProgress.table}...</>
            ) : (
              <><Upload className="w-5 h-5" /> Select Backup File to Import</>
            )}
          </button>

          {isDemoMode && (
            <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Import is disabled in demo mode. Sign in to restore data.
            </p>
          )}
        </div>

        {/* Status Messages */}
        {exportStatus === 'success' && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-300 font-medium">Export Successful</p>
              <p className="text-green-300/80 text-sm">{statusMessage}</p>
            </div>
            <button onClick={() => setExportStatus('idle')} className="ml-auto text-green-400 hover:text-green-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {importStatus === 'success' && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-300 font-medium">Import Successful</p>
              <p className="text-green-300/80 text-sm">{statusMessage}</p>
            </div>
            <button onClick={() => setImportStatus('idle')} className="ml-auto text-green-400 hover:text-green-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {(exportStatus === 'error' || importStatus === 'error') && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-medium">Error</p>
              <p className="text-red-300/80 text-sm">{statusMessage}</p>
            </div>
            <button onClick={() => { setExportStatus('idle'); setImportStatus('idle'); }} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Import Confirmation Modal */}
        {showImportConfirm && importPreview && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Upload className="w-6 h-6 text-orange-400" />
                </div>
                <h4 className="text-lg font-bold text-white">Confirm Data Import</h4>
              </div>

              {/* Backup Info */}
              <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Backup Date:</span>
                    <span className="text-white ml-1">{new Date(importPreview._meta?.exportDate).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Exported By:</span>
                    <span className="text-white ml-1">{importPreview._meta?.exportedBy || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Version:</span>
                    <span className="text-white ml-1">{importPreview._meta?.version || '1.0'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Records:</span>
                    <span className="text-orange-400 font-bold ml-1">{importPreview._meta?.totalRecords || getTotalRecords(importPreview)}</span>
                  </div>
                </div>
              </div>

              {/* Record Counts */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-slate-400 mb-2">Records in backup file:</h5>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: 'Pass Logs', count: safeArray(importPreview.passLogs).length },
                    { label: 'Engines', count: safeArray(importPreview.engines).length },
                    { label: 'Superchargers', count: safeArray(importPreview.superchargers).length },
                    { label: 'Cylinder Heads', count: safeArray(importPreview.cylinderHeads).length },
                    { label: 'Drivetrain Components', count: safeArray(importPreview.drivetrainComponents).length },
                    { label: 'Maintenance', count: safeArray(importPreview.maintenanceItems).length },
                    { label: 'SFI Certs', count: safeArray(importPreview.sfiCertifications).length },
                    { label: 'Work Orders', count: safeArray(importPreview.workOrders).length },
                    { label: 'Checklists', count: safeArray(importPreview.checklists?.preRun).length + safeArray(importPreview.checklists?.betweenRounds).length + safeArray(importPreview.checklists?.postRun).length },
                    { label: 'Parts Inventory', count: safeArray(importPreview.partsInventory).length },
                    { label: 'Race Events', count: safeArray(importPreview.raceEvents).length },
                    { label: 'Team Members', count: safeArray(importPreview.teamMembers).length },
                    { label: 'Chassis Setups', count: safeArray(importPreview.chassisSetups).length },
                    { label: 'Saved Tracks', count: safeArray(importPreview.savedTracks).length },
                    { label: 'Swap Logs', count: safeArray(importPreview.drivetrainSwapLogs).length },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between bg-slate-900/30 rounded px-2 py-1">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <span className={`text-xs font-bold ${item.count > 0 ? 'text-white' : 'text-slate-600'}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    Records that already exist in your database (matching IDs) will be <strong>skipped</strong>. 
                    Only new records will be added. Your existing data will not be modified or deleted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportConfirm(false); setImportPreview(null); setImportStatus('idle'); }}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportConfirm}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Confirm Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } catch (renderError) {
    // Catch any render errors that somehow bypass the error boundary
    console.error('[BackupRestore] Render error caught by try-catch:', renderError);
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 m-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-red-300 mb-2">Backup & Restore Render Error</h3>
            <p className="text-sm text-red-300/80 mb-3">
              An unexpected error occurred while rendering the Backup & Restore section.
            </p>
            {renderError instanceof Error && (
              <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-red-400 font-mono break-all">{renderError.message}</p>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Try refreshing the page. If the issue persists, please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }
};

// Wrapped export with error boundary
const BackupRestoreWithErrorBoundary: React.FC<BackupRestoreProps> = (props) => (
  <BackupRestoreErrorBoundary>
    <BackupRestore {...props} />
  </BackupRestoreErrorBoundary>
);

export default BackupRestoreWithErrorBoundary;
