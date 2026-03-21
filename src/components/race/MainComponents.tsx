import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';
import DateInputDark from '@/components/ui/DateInputDark';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrewRole } from '@/lib/permissions';
import { DrivetrainComponent, DrivetrainCategory, ComponentPart, ComponentExtraFieldsRecord, checkComponentPartsSchema, didLastComponentPartsFetchHitSchemaCache } from '@/lib/database';
import * as db from '@/lib/database';







import {
  Zap, Wind, Plus, Edit2, Trash2, X, ChevronDown, ChevronUp,
  Wrench, Save, Package, Play, CheckCircle2, RefreshCw,
  ListChecks, FileText, RotateCcw, Cog, Settings,
  Check, ClipboardList, AlertCircle, Loader2, Upload, AlertTriangle, Sliders
} from 'lucide-react';





// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface MainComponentsProps {
  currentRole?: CrewRole;
}

/** Extra fields stored per component (beyond what AppContext stores) */
interface ComponentExtraFields {
  blockSerialNumber?: string;
  headSerial1?: string; // Left Head - Engines only
  headSerial2?: string; // Right Head - Engines only
  removalDate?: string;
  refreshDate?: string;
  currentHeadset?: string; // Transmissions only
  gearRatioHeadset?: string;
  gearRatio1?: string;
  gearRatio2?: string;
  gearRatio3?: string;
  gearRatio4?: string;
  gearRatio5?: string;
  currentStator?: string; // Torque Converters only
}

type TabId = 'engines' | 'powerAdders' | 'transmissions' | 'transmissionDrives' | 'torqueConverters' | 'thirdMemberGears';


// ═══════════════════════════════════════════════════════════════════════
// LOCALSTORAGE HELPERS (templates only — parts & extra fields migrated to DB)
// ═══════════════════════════════════════════════════════════════════════

const EXTRA_FIELDS_KEY = 'mainComp_extraFields';
const TEMPLATE_KEY = 'mainComp_template';
const PARTS_FALLBACK_KEY = 'mainComp_parts_db_fallback';

function loadExtraFieldsFromLocalStorage(): Record<string, ComponentExtraFields> {
  try {
    const raw = localStorage.getItem(EXTRA_FIELDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadTemplates(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveTemplates(data: Record<string, string[]>) {
  try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data)); } catch {}
}

function saveExtraFieldsToLocalStorage(data: Record<string, ComponentExtraFields>) {
  try { localStorage.setItem(EXTRA_FIELDS_KEY, JSON.stringify(data)); } catch {}
}

/** Save parts to localStorage as a fallback when DB is unavailable */
function savePartsToLocalStorageFallback(parts: ComponentPart[]) {
  try { localStorage.setItem(PARTS_FALLBACK_KEY, JSON.stringify(parts)); } catch {}
}

/** Load parts from localStorage fallback */
function loadPartsFromLocalStorageFallback(): ComponentPart[] {
  try {
    const raw = localStorage.getItem(PARTS_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Clear localStorage fallback (called when DB save succeeds) */
function clearPartsLocalStorageFallback() {
  try { localStorage.removeItem(PARTS_FALLBACK_KEY); } catch {}
}



// Helper: map tab id to a component_type string for the DB
const tabToComponentType = (tab: TabId): string => tab;




// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

const MainComponents: React.FC<MainComponentsProps> = ({ currentRole = 'Crew' }) => {
  const { user } = useAuth();
  const {
    engines,
    superchargers,
    drivetrainComponents: allDrivetrainComponents,
    updateEngine, addEngine, deleteEngine,
    updateSupercharger, addSupercharger, deleteSupercharger,
    addDrivetrainComponent, updateDrivetrainComponent, deleteDrivetrainComponent,
  } = useApp();

  // No car filtering — single-car app, show all data
  const allEngines = engines;
  const allSuperchargers = superchargers;

  const transmissions = useMemo(() => allDrivetrainComponents.filter(c => c.category === 'transmission'), [allDrivetrainComponents]);
  const transmissionDrives = useMemo(() => allDrivetrainComponents.filter(c => c.category === 'transmission_drive'), [allDrivetrainComponents]);
  const torqueConverters = useMemo(() => allDrivetrainComponents.filter(c => c.category === 'torque_converter'), [allDrivetrainComponents]);
  const thirdMemberGears = useMemo(() => allDrivetrainComponents.filter(c => c.category === 'third_member' || c.category === 'ring_and_pinion'), [allDrivetrainComponents]);

  // State
  const [activeTab, setActiveTab] = useState<TabId>('engines');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<Record<string, ComponentExtraFields>>(loadExtraFieldsFromLocalStorage);
  const [templates, setTemplates] = useState<Record<string, string[]>>(loadTemplates);

  // ═══════════════════════════════════════════════════════════════════
  // DATABASE-BACKED PARTS STATE
  // ═══════════════════════════════════════════════════════════════════
  const [componentParts, setComponentParts] = useState<ComponentPart[]>([]);
  const [partsLoaded, setPartsLoaded] = useState(false);
  const partsLoadedRef = useRef(false);

  // Load parts from database on mount, with localStorage fallback
  useEffect(() => {
    if (partsLoadedRef.current) return;
    partsLoadedRef.current = true;
    const loadParts = async () => {
      try {
        const dbParts = await db.fetchComponentParts(user?.id);
        // ── CHECK PGRST205 FLAG ──
        // Must be read IMMEDIATELY after fetchComponentParts returns,
        // before any other async calls that might reset it.
        const wasSchemaCacheIssue = didLastComponentPartsFetchHitSchemaCache();

        if (dbParts.length > 0) {
          setComponentParts(dbParts);
          clearPartsLocalStorageFallback(); // DB has data, clear any fallback
          console.log(`[MainComponents] Loaded ${dbParts.length} component parts from database`);
        } else if (wasSchemaCacheIssue) {
          // ── PGRST205 DETECTED ──
          // The table EXISTS in the database but PostgREST's schema cache
          // doesn't know about it yet. A schema reload has been triggered.
          // Silently use localStorage data — NO toast. The user doesn't
          // need to do anything; it will resolve on its own.
          const fallbackParts = loadPartsFromLocalStorageFallback();
          if (fallbackParts.length > 0) {
            setComponentParts(fallbackParts);
            console.log(`[MainComponents] PGRST205 — silently using ${fallbackParts.length} parts from localStorage while schema cache refreshes`);
          } else {
            console.log('[MainComponents] PGRST205 — no localStorage fallback available. Parts will appear after schema cache refreshes.');
          }
        } else {
          // DB returned empty AND it was NOT a PGRST205 issue.
          // This could mean: (a) table is genuinely empty, or (b) table doesn't exist.
          // If we have localStorage data, try to sync it to the DB.
          const fallbackParts = loadPartsFromLocalStorageFallback();
          if (fallbackParts.length > 0) {
            setComponentParts(fallbackParts);
            console.log(`[MainComponents] DB returned empty — attempting to sync ${fallbackParts.length} parts from localStorage to database...`);

            // Attempt to sync localStorage parts to the DB in the background
            let syncedCount = 0;
            let syncFailedCount = 0;
            let hitSchemaCache = false;

            for (const part of fallbackParts) {
              try {
                await db.upsertComponentPart(part, user?.id);
                syncedCount++;
              } catch (syncErr: any) {
                syncFailedCount++;
                // If we hit PGRST205 during sync, stop trying — table isn't in cache yet
                const msg = (syncErr?.message || '').toLowerCase();
                const code = syncErr?.code || '';
                if (code === 'PGRST205' || code === '42P01' || msg.includes('schema cache')) {
                  hitSchemaCache = true;
                  break;
                }
              }
            }

            if (hitSchemaCache) {
              // Schema cache issue during sync — silently use localStorage, no toast
              console.log('[MainComponents] Sync hit PGRST205 — silently using localStorage. Schema cache will refresh automatically.');
            } else if (syncedCount > 0 && syncFailedCount === 0) {
              // All parts synced successfully!
              console.log(`[MainComponents] Successfully synced ${syncedCount} parts to database`);
              toast.success(`Synced ${syncedCount} parts to database`, { duration: 3000 });
            } else if (syncedCount > 0) {
              console.log(`[MainComponents] Partially synced: ${syncedCount} succeeded, ${syncFailedCount} failed`);
              toast.warning(`Synced ${syncedCount} of ${fallbackParts.length} parts to database. ${syncFailedCount} failed.`, { duration: 5000 });
            } else {
              // All syncs failed (and not PGRST205) — show a gentle message
              console.warn(`[MainComponents] All ${syncFailedCount} sync attempts failed`);
              toast.warning(`Using ${fallbackParts.length} parts from local cache. Database sync will retry on next refresh.`, { duration: 5000 });
            }
          } else {
            // No fallback — check legacy localStorage migration
            try {
              const raw = localStorage.getItem('mainComp_parts');
              if (raw) {
                const legacyParts: Record<string, Array<{ id: string; partName: string; passesOnPart: number }>> = JSON.parse(raw);
                const migratedParts: ComponentPart[] = [];
                for (const [compId, parts] of Object.entries(legacyParts)) {
                  for (const p of parts) {
                    migratedParts.push({
                      id: p.id,
                      componentId: compId,
                      componentType: 'unknown',
                      partName: p.partName,
                      passesOnPart: p.passesOnPart,
                    });
                  }
                }
                if (migratedParts.length > 0) {
                  setComponentParts(migratedParts);
                  for (const part of migratedParts) {
                    db.upsertComponentPart(part, user?.id).catch(err => {
                      console.warn('[MainComponents] Migration upsert failed for part', part.id, err);
                    });
                  }
                  console.log(`[MainComponents] Migrated ${migratedParts.length} parts from localStorage to database`);
                  toast.success(`Migrated ${migratedParts.length} standalone parts to database`, { duration: 4000 });
                  localStorage.removeItem('mainComp_parts');
                }
              }
            } catch (migErr) {
              console.warn('[MainComponents] localStorage migration failed:', migErr);
            }
          }
        }
      } catch (err) {
        console.warn('[MainComponents] Failed to fetch component parts from DB (table may not exist):', err);
        // DB fetch failed entirely — restore from localStorage fallback silently
        const fallbackParts = loadPartsFromLocalStorageFallback();
        if (fallbackParts.length > 0) {
          setComponentParts(fallbackParts);
          console.log(`[MainComponents] DB unavailable — silently restored ${fallbackParts.length} parts from localStorage fallback`);
        }
      } finally {
        setPartsLoaded(true);
      }
    };
    loadParts();
  }, [user?.id]);



  // ═══════════════════════════════════════════════════════════════════
  // PERSIST PARTS TO LOCALSTORAGE AS SAFETY NET
  // ═══════════════════════════════════════════════════════════════════
  // Always keep localStorage in sync so parts survive if DB is unavailable
  useEffect(() => {
    if (partsLoaded && componentParts.length > 0) {
      savePartsToLocalStorageFallback(componentParts);
    }
  }, [componentParts, partsLoaded]);

  // ═══════════════════════════════════════════════════════════════════
  // LISTEN FOR PASS LOG AUTO-INCREMENT EVENTS
  // ═══════════════════════════════════════════════════════════════════
  // When PassLog logs a new pass with auto-increment enabled, it dispatches
  // a 'component-parts-incremented' CustomEvent with { componentIds, increment }.
  // This listener updates the local componentParts state immediately so the UI
  // reflects the new pass counts without requiring a page refresh or DB re-fetch.
  // Also handles the Undo case (increment = -1).
  useEffect(() => {
    const handlePartsIncremented = (e: Event) => {
      const detail = (e as CustomEvent<{ componentIds: string[]; increment: number }>).detail;
      if (!detail?.componentIds || typeof detail.increment !== 'number') return;

      const { componentIds, increment } = detail;
      setComponentParts(prev =>
        prev.map(p =>
          componentIds.includes(p.componentId)
            ? { ...p, passesOnPart: Math.max(0, p.passesOnPart + increment) }
            : p
        )
      );
      console.log(
        `[MainComponents] Received component-parts-incremented event: ${increment > 0 ? '+' : ''}${increment} ` +
        `for ${componentIds.length} component(s), updating local standalone parts state`
      );
    };

    window.addEventListener('component-parts-incremented', handlePartsIncremented);
    return () => window.removeEventListener('component-parts-incremented', handlePartsIncremented);
  }, []);



  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<TabId>('engines');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formBlockSerial, setFormBlockSerial] = useState('');
  const [formHeadSerial1, setFormHeadSerial1] = useState('');
  const [formHeadSerial2, setFormHeadSerial2] = useState('');
  const [formInstallDate, setFormInstallDate] = useState(getLocalDateString());
  const [formRemovalDate, setFormRemovalDate] = useState('');
  const [formRefreshDate, setFormRefreshDate] = useState('');
  const [formTotalPasses, setFormTotalPasses] = useState(0);
  const [formPassesSinceRebuild, setFormPassesSinceRebuild] = useState(0);
  const [formCurrentlyInstalled, setFormCurrentlyInstalled] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  // Transmission-specific
  const [formCurrentHeadset, setFormCurrentHeadset] = useState('');
  const [formGearHeadset, setFormGearHeadset] = useState('');
  const [formGear1, setFormGear1] = useState('');
  const [formGear2, setFormGear2] = useState('');
  const [formGear3, setFormGear3] = useState('');
  const [formGear4, setFormGear4] = useState('');
  const [formGear5, setFormGear5] = useState('');
  // Torque Converter-specific
  const [formCurrentStator, setFormCurrentStator] = useState('');

  // Parts list editing
  const [editingPartCompId, setEditingPartCompId] = useState<string | null>(null);
  const [newPartName, setNewPartName] = useState('');

  // Inline part editing (edit existing part name)
  const [editingInlinePartId, setEditingInlinePartId] = useState<string | null>(null);
  const [editInlinePartName, setEditInlinePartName] = useState('');

  // Dirty parts tracking — parts whose passes have been changed locally but not yet saved to DB
  const [dirtyPartIds, setDirtyPartIds] = useState<Set<string>>(new Set());
  const [savingParts, setSavingParts] = useState(false);

  // ═══════════════════════════════════════════════════════════════════
  // AUTO-SAVE STATE & REFS
  // ═══════════════════════════════════════════════════════════════════
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs to access latest state inside the debounced timer callback
  const componentPartsRef = useRef(componentParts);
  componentPartsRef.current = componentParts;
  const dirtyPartIdsRef = useRef(dirtyPartIds);
  dirtyPartIdsRef.current = dirtyPartIds;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;


  // Bulk import state
  const [bulkImportCompId, setBulkImportCompId] = useState<string | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportStep, setBulkImportStep] = useState<'input' | 'preview'>('input');
  const [bulkImportSaving, setBulkImportSaving] = useState(false);
  const [bulkImportPreview, setBulkImportPreview] = useState<{ newNames: string[]; existingNames: string[]; emptyCount: number }>({ newNames: [], existingNames: [], emptyCount: 0 });



  // Record Pass modal
  const [showRecordPassModal, setShowRecordPassModal] = useState(false);
  const [recordPassCount, setRecordPassCount] = useState(1);
  const [recordPassLoading, setRecordPassLoading] = useState(false);

  // ═══════════════════════════════════════════════════════════════════
  // WEAR THRESHOLD STATE — stored in localStorage
  // ═══════════════════════════════════════════════════════════════════
  const WEAR_THRESHOLDS_KEY = 'mainComp_wearThresholds';
  const WEAR_DEFAULTS_KEY = 'mainComp_wearDefaults';

  const [wearThresholds, setWearThresholds] = useState<Record<string, number>>(() => {
    try { const raw = localStorage.getItem(WEAR_THRESHOLDS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [wearDefaults, setWearDefaults] = useState<Record<string, number>>(() => {
    try { const raw = localStorage.getItem(WEAR_DEFAULTS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [showWearSettingsModal, setShowWearSettingsModal] = useState(false);
  const [resetConfirmPartId, setResetConfirmPartId] = useState<string | null>(null);

  // Persist wear thresholds
  useEffect(() => { try { localStorage.setItem(WEAR_THRESHOLDS_KEY, JSON.stringify(wearThresholds)); } catch {} }, [wearThresholds]);
  useEffect(() => { try { localStorage.setItem(WEAR_DEFAULTS_KEY, JSON.stringify(wearDefaults)); } catch {} }, [wearDefaults]);

  const getWearThreshold = (partId: string): number => wearThresholds[partId] || 0;
  const setWearThreshold = (partId: string, threshold: number) => {
    setWearThresholds(prev => ({ ...prev, [partId]: threshold }));
  };
  const isPartOverThreshold = (part: ComponentPart): boolean => {
    const threshold = wearThresholds[part.id] || 0;
    return threshold > 0 && part.passesOnPart >= threshold;
  };

  // Count parts exceeding wear thresholds (for badge display)
  const wearAlertCount = useMemo(() => {
    return componentParts.filter(p => isPartOverThreshold(p)).length;
  }, [componentParts, wearThresholds]);

  // Reset passes for a single part
  const handleResetPartPasses = (compId: string, partId: string) => {
    const today = getLocalDateString();
    setComponentParts(prev =>
      prev.map(p =>
        p.id === partId && p.componentId === compId
          ? { ...p, passesOnPart: 0, dateReplaced: today, notes: `${p.notes ? p.notes + ' | ' : ''}Reset ${today}` }
          : p
      )
    );
    // Mark as dirty so it auto-saves
    setDirtyPartIds(prev => { const next = new Set(prev); next.add(partId); return next; });
    setResetConfirmPartId(null);
    toast.success('Part passes reset to 0', { description: `Reset date logged: ${today}`, duration: 4000 });
  };



  // Persist extra fields and templates to localStorage (parts are now DB-backed)
  useEffect(() => { saveExtraFieldsToLocalStorage(extraFields); }, [extraFields]);
  useEffect(() => { saveTemplates(templates); }, [templates]);


  // ═══════════════════════════════════════════════════════════════════
  // STARTUP MIGRATION CHECK — verify component_parts has date_replaced & notes
  // ═══════════════════════════════════════════════════════════════════
  const schemaCheckDoneRef = useRef(false);
  useEffect(() => {
    if (schemaCheckDoneRef.current) return;
    schemaCheckDoneRef.current = true;

    const runSchemaCheck = async () => {
      try {
        const schema = await checkComponentPartsSchema();

        if (schema.tableExists && !schema.allColumnsPresent) {
          const missingCols: string[] = [];
          if (!schema.hasDateReplaced) missingCols.push('date_replaced');
          if (!schema.hasNotes) missingCols.push('notes');

          console.warn(
            `[MainComponents] Schema check: component_parts table is missing columns: ${missingCols.join(', ')}. ` +
            'Run sql_add_component_parts_columns.sql to add them.'
          );

          toast.warning(
            `Database migration needed: component_parts is missing ${missingCols.join(' and ')} column${missingCols.length > 1 ? 's' : ''}. ` +
            'Parts will save without these fields until the migration runs.',
            {
              description: 'Run: ALTER TABLE component_parts ADD COLUMN IF NOT EXISTS date_replaced TEXT; ALTER TABLE component_parts ADD COLUMN IF NOT EXISTS notes TEXT;',
              duration: 15000,
            }
          );
        } else if (!schema.tableExists) {
          console.warn('[MainComponents] Schema check: component_parts table does not exist or is not accessible.');
          // Don't show a toast here — the parts load effect already handles this case
        } else {
          console.log('[MainComponents] Schema check passed — all columns present.');
        }
      } catch (err) {
        console.warn('[MainComponents] Schema check failed (non-blocking):', err);
      }
    };

    // Run after a short delay so it doesn't block initial render
    const timer = setTimeout(runSchemaCheck, 2000);
    return () => clearTimeout(timer);
  }, []);








  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  const getExtra = (id: string): ComponentExtraFields => extraFields[id] || {};
  const setExtra = (id: string, fields: Partial<ComponentExtraFields>) => {
    setExtraFields(prev => ({ ...prev, [id]: { ...prev[id], ...fields } }));
  };

  const getPartsForComponent = (id: string): ComponentPart[] => componentParts.filter(p => p.componentId === id);

  const addPartToComponent = (compId: string, partName: string) => {
    if (!partName.trim()) return;
    const newPart: ComponentPart = {
      id: `SP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      componentId: compId,
      componentType: tabToComponentType(activeTab),
      partName: partName.trim(),
      passesOnPart: 0,
    };
    setComponentParts(prev => [...prev, newPart]);
    // Persist to DB
    db.upsertComponentPart(newPart, user?.id)
      .then(() => {
        toast.success(`Part "${partName.trim()}" added`);
      })
      .catch(err => {
        console.error('[addPart] DB upsert failed:', err);
        toast.error('Part added locally but failed to save to database. It may be lost on refresh.');
      });

    // Update template for this tab category
    const templateKey = activeTab;
    const currentTemplate = templates[templateKey] || [];
    if (!currentTemplate.includes(partName.trim())) {
      const newTemplate = [...currentTemplate, partName.trim()];
      setTemplates(prev => ({ ...prev, [templateKey]: newTemplate }));
    }
  };

  const removePartFromComponent = (compId: string, partId: string) => {
    setComponentParts(prev => prev.filter(p => !(p.id === partId && p.componentId === compId)));
    // Delete from DB
    db.deleteComponentPart(partId).catch(err => {
      console.error('[removePart] DB delete failed:', err);
      toast.error('Failed to remove part from database');
    });
  };

  const updatePartPasses = (compId: string, partId: string, passes: number) => {
    // Update local state only — mark as dirty so user can batch-save
    setComponentParts(prev =>
      prev.map(p =>
        p.id === partId && p.componentId === compId ? { ...p, passesOnPart: passes } : p
      )
    );
    // Mark this part as dirty (unsaved)
    setDirtyPartIds(prev => {
      const next = new Set(prev);
      next.add(partId);
      return next;
    });
  };

  /** Save ALL parts for a given component to the database (manual fallback) */
  const handleSaveAllParts = async (compId: string) => {
    const parts = getPartsForComponent(compId);
    if (parts.length === 0) return;

    // Cancel any pending auto-save timer — manual save takes precedence
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setSavingParts(true);
    let savedCount = 0;
    let failedCount = 0;
    const failedErrors: string[] = [];

    const promises = parts.map(part =>
      db.upsertComponentPart(part, user?.id)
        .then(() => { savedCount++; })
        .catch(err => {
          failedCount++;
          const errMsg = err?.message || 'Unknown error';
          const errCode = err?.code || '';
          const errHint = err?.hint || '';
          failedErrors.push(`"${part.partName}": ${errCode ? `[${errCode}] ` : ''}${errMsg}`);
          console.error('[handleSaveAllParts] DB upsert failed for part:', part.partName, {
            message: errMsg,
            code: errCode,
            details: err?.details,
            hint: errHint,
          });
        })
    );

    await Promise.all(promises);

    // Clear dirty state for all parts of this component
    setDirtyPartIds(prev => {
      const next = new Set(prev);
      parts.forEach(p => next.delete(p.id));
      return next;
    });

    setSavingParts(false);

    if (failedCount === 0) {
      toast.success(`All ${savedCount} part${savedCount !== 1 ? 's' : ''} saved to database`);
    } else if (savedCount > 0) {
      toast.warning(`Saved ${savedCount} parts, but ${failedCount} failed to save`, {
        description: failedErrors.join('\n'),
        duration: 10000,
      });
    } else {
      // ALL parts failed — show detailed error
      const firstError = failedErrors[0] || 'Unknown error';
      const isOrphanedRow = firstError.includes('ORPHANED_ROW') || firstError.includes('orphaned');
      const isRLS = firstError.includes('row-level security') || firstError.includes('42501') || firstError.includes('permission');
      const isNoUser = firstError.includes('NO_USER_ID') || firstError.includes('No authenticated');

      if (isNoUser) {
        toast.error('Not logged in — please log in and try again.', {
          description: 'Your session may have expired. Refresh the page and log in again.',
          duration: 10000,
        });
      } else if (isOrphanedRow) {
        toast.error(`Save failed: orphaned database rows detected`, {
          description: 'Run sql_add_component_parts_columns.sql in Supabase SQL Editor to fix orphaned rows, then try again.',
          duration: 15000,
        });
      } else if (isRLS) {
        toast.error(`Save failed: database permission error`, {
          description: 'Row Level Security blocked the save. Run the latest migration SQL to fix RLS policies. Error: ' + firstError,
          duration: 15000,
        });
      } else {
        toast.error(`All ${failedCount} part${failedCount !== 1 ? 's' : ''} failed to save`, {
          description: firstError.length > 200 ? firstError.substring(0, 200) + '...' : firstError,
          duration: 10000,
        });
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // DEBOUNCED AUTO-SAVE — persists dirty parts 3 seconds after last edit
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Only trigger when there are dirty parts to save
    if (dirtyPartIds.size === 0) return;

    // Clear any existing debounce timer (resets the 3s countdown on each new edit)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set a new 3-second debounce timer
    autoSaveTimerRef.current = setTimeout(async () => {
      // Read latest state from refs (avoids stale closure issues)
      const currentDirtyIds = Array.from(dirtyPartIdsRef.current);
      if (currentDirtyIds.length === 0) return;

      const currentParts = componentPartsRef.current;
      const partsToSave = currentParts.filter(p => currentDirtyIds.includes(p.id));
      if (partsToSave.length === 0) return;

      setAutoSaving(true);
      console.log(`[AutoSave] Saving ${partsToSave.length} dirty part(s)...`);

      let savedCount = 0;
      let failedCount = 0;
      const savedIds: string[] = [];

      const promises = partsToSave.map(part =>
        db.upsertComponentPart(part, userIdRef.current)
          .then(() => { savedCount++; savedIds.push(part.id); })
          .catch(err => {
            failedCount++;
            console.error('[AutoSave] DB upsert failed for part:', part.partName, err);
          })
      );

      await Promise.all(promises);

      // Clear dirty state only for successfully saved parts
      if (savedIds.length > 0) {
        setDirtyPartIds(prev => {
          const next = new Set(prev);
          savedIds.forEach(id => next.delete(id));
          return next;
        });
      }

      setAutoSaving(false);

      if (failedCount === 0 && savedCount > 0) {
        toast.success(`Auto-saved ${savedCount} part${savedCount !== 1 ? 's' : ''}`, {
          duration: 2000,
          id: 'auto-save-success', // Deduplicate rapid toasts
        });
      } else if (failedCount > 0 && savedCount > 0) {
        toast.warning(`Auto-save: ${savedCount} saved, ${failedCount} failed`, {
          duration: 4000,
          id: 'auto-save-partial',
        });
      } else if (failedCount > 0 && savedCount === 0) {
        toast.error(`Auto-save failed for ${failedCount} part${failedCount !== 1 ? 's' : ''} — use "Save All Parts" to retry`, {
          duration: 5000,
          id: 'auto-save-failed',
        });
      }
    }, 3000);

    // Cleanup: clear timer if dirtyPartIds changes before the 3s fires
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [dirtyPartIds]);

  // Cleanup auto-save timer on component unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);




  /** Update a part's name (inline edit) and persist to DB */
  const updatePartName = (compId: string, partId: string, newName: string) => {
    if (!newName.trim()) return;
    setComponentParts(prev => {
      const updated = prev.map(p =>
        p.id === partId && p.componentId === compId ? { ...p, partName: newName.trim() } : p
      );
      const updatedPart = updated.find(p => p.id === partId && p.componentId === compId);
      if (updatedPart) {
        db.upsertComponentPart(updatedPart, user?.id)
          .then(() => toast.success(`Part renamed to "${newName.trim()}"`))
          .catch(err => {
            console.error('[updatePartName] DB upsert failed:', err);
            toast.error('Failed to save part name to database');
          });
      }
      return updated;
    });
    setEditingInlinePartId(null);
    setEditInlinePartName('');
  };


  const applyTemplateToComponent = (compId: string, templateKey: string) => {
    const templateNames = templates[templateKey] || [];
    if (templateNames.length === 0) return;
    const existingNames = new Set(getPartsForComponent(compId).map(p => p.partName));
    const newParts: ComponentPart[] = templateNames
      .filter(name => !existingNames.has(name))
      .map(name => ({
        id: `SP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        componentId: compId,
        componentType: tabToComponentType(activeTab),
        partName: name,
        passesOnPart: 0,
      }));
    if (newParts.length > 0) {
      setComponentParts(prev => [...prev, ...newParts]);
      // Persist to DB
      for (const part of newParts) {
        db.upsertComponentPart(part, user?.id).catch(err => console.warn('[applyTemplate] DB upsert failed:', err));
      }
      toast.success(`Applied ${newParts.length} parts from template`);
    } else {
      toast.info('All template parts already exist on this component');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // BULK IMPORT PARTS
  // ═══════════════════════════════════════════════════════════════════

  const openBulkImport = (compId: string) => {
    setBulkImportCompId(compId);
    setBulkImportText('');
    setBulkImportStep('input');
    setBulkImportSaving(false);
    setBulkImportPreview({ newNames: [], existingNames: [], emptyCount: 0 });
  };

  const closeBulkImport = () => {
    setBulkImportCompId(null);
    setBulkImportText('');
    setBulkImportStep('input');
    setBulkImportSaving(false);
  };

  /** Parse pasted text into unique, trimmed part names and classify as new vs existing */
  const parseBulkImportText = (text: string, compId: string) => {
    // Split on commas, newlines, or semicolons
    const rawNames = text.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    for (const name of rawNames) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNames.push(name);
      }
    }
    // Check against existing parts for this component
    const existingSet = new Set(getPartsForComponent(compId).map(p => p.partName.toLowerCase()));
    const newNames: string[] = [];
    const existingNames: string[] = [];
    for (const name of uniqueNames) {
      if (existingSet.has(name.toLowerCase())) {
        existingNames.push(name);
      } else {
        newNames.push(name);
      }
    }
    const emptyCount = text.split(/[,\n;]+/).filter(s => !s.trim()).length;
    return { newNames, existingNames, emptyCount };
  };

  const handleBulkImportPreview = () => {
    if (!bulkImportCompId || !bulkImportText.trim()) return;
    const preview = parseBulkImportText(bulkImportText, bulkImportCompId);
    setBulkImportPreview(preview);
    setBulkImportStep('preview');
  };

  const handleBulkImportSave = async () => {
    if (!bulkImportCompId || bulkImportPreview.newNames.length === 0) return;
    setBulkImportSaving(true);

    const compId = bulkImportCompId;
    const newParts: ComponentPart[] = bulkImportPreview.newNames.map((name, idx) => ({
      id: `SP-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      componentId: compId,
      componentType: tabToComponentType(activeTab),
      partName: name,
      passesOnPart: 0,
    }));

    // Update local state in one batch
    setComponentParts(prev => [...prev, ...newParts]);

    // Persist all to DB in parallel
    let savedCount = 0;
    let failedCount = 0;
    const promises = newParts.map(part =>
      db.upsertComponentPart(part, user?.id)
        .then(() => { savedCount++; })
        .catch(err => {
          failedCount++;
          console.error('[BulkImport] DB upsert failed for part:', part.partName, err);
        })
    );

    await Promise.all(promises);

    // Update template for this tab category with new names
    const templateKey = activeTab;
    const currentTemplate = templates[templateKey] || [];
    const newTemplateNames = bulkImportPreview.newNames.filter(
      name => !currentTemplate.includes(name)
    );
    if (newTemplateNames.length > 0) {
      setTemplates(prev => ({
        ...prev,
        [templateKey]: [...(prev[templateKey] || []), ...newTemplateNames],
      }));
    }

    setBulkImportSaving(false);

    if (failedCount === 0) {
      toast.success(`Successfully imported ${savedCount} part${savedCount !== 1 ? 's' : ''}`);
    } else {
      toast.warning(`Imported ${savedCount} parts, but ${failedCount} failed to save to database`);
    }

    closeBulkImport();
  };


  // ═══════════════════════════════════════════════════════════════════
  // RECORD PASS
  const handleRecordPass = async () => {
    if (recordPassCount < 1) return;
    setRecordPassLoading(true);
    const n = recordPassCount;
    let totalUpdated = 0;

    try {
      // Update all installed engines
      for (const eng of allEngines.filter((e: any) => e.currentlyInstalled)) {
        await updateEngine(eng.id, { totalPasses: eng.totalPasses + n, passesSinceRebuild: eng.passesSinceRebuild + n });
        totalUpdated++;
        db.bulkIncrementComponentPartPasses(eng.id, n).catch(err => console.warn('[RecordPass] bulk increment failed:', err));
        setComponentParts(prev => prev.map(p => p.componentId === eng.id ? { ...p, passesOnPart: p.passesOnPart + n } : p));
      }
      // Update all installed power adders
      for (const sc of allSuperchargers.filter((s: any) => s.currentlyInstalled)) {
        await updateSupercharger(sc.id, { totalPasses: sc.totalPasses + n, passesSinceService: sc.passesSinceService + n });
        totalUpdated++;
        db.bulkIncrementComponentPartPasses(sc.id, n).catch(err => console.warn('[RecordPass] bulk increment failed:', err));
        setComponentParts(prev => prev.map(p => p.componentId === sc.id ? { ...p, passesOnPart: p.passesOnPart + n } : p));
      }
      // Update all installed drivetrain components
      for (const dt of allDrivetrainComponents.filter((d: any) => d.currentlyInstalled)) {
        await updateDrivetrainComponent(dt.id, { totalPasses: dt.totalPasses + n, passesSinceService: dt.passesSinceService + n });
        totalUpdated++;
        db.bulkIncrementComponentPartPasses(dt.id, n).catch(err => console.warn('[RecordPass] bulk increment failed:', err));
        setComponentParts(prev => prev.map(p => p.componentId === dt.id ? { ...p, passesOnPart: p.passesOnPart + n } : p));
      }

      toast.success(`Recorded ${n} pass${n > 1 ? 'es' : ''} across ${totalUpdated} installed components.`);
    } catch (err) {
      console.error('[RecordPass] Error:', err);
      toast.error('Failed to record passes.');
    } finally {
      setRecordPassLoading(false);
      setShowRecordPassModal(false);
      setRecordPassCount(1);
    }
  };


  // ═══════════════════════════════════════════════════════════════════
  // MODAL OPEN/CLOSE
  // ═══════════════════════════════════════════════════════════════════

  const resetForm = () => {
    setFormName(''); setFormBlockSerial(''); setFormHeadSerial1(''); setFormHeadSerial2('');
    setFormInstallDate(getLocalDateString()); setFormRemovalDate(''); setFormRefreshDate('');
    setFormTotalPasses(0); setFormPassesSinceRebuild(0); setFormCurrentlyInstalled(false); setFormNotes('');
    setFormCurrentHeadset(''); setFormGearHeadset(''); setFormGear1(''); setFormGear2('');
    setFormGear3(''); setFormGear4(''); setFormGear5(''); setFormCurrentStator('');
  };

  const openAddModal = (tab: TabId) => {
    resetForm();
    setEditingId(null);
    setModalTab(tab);
    setShowModal(true);
  };

  const openEditModal = (tab: TabId, id: string) => {
    setEditingId(id);
    setModalTab(tab);
    const extra = getExtra(id);

    if (tab === 'engines') {
      const eng = engines.find(e => e.id === id);
      if (eng) {
        setFormName(eng.name); setFormBlockSerial(eng.serialNumber || '');
        setFormHeadSerial1(extra.headSerial1 || ''); setFormHeadSerial2(extra.headSerial2 || '');
        setFormInstallDate(eng.installDate); setFormRemovalDate(extra.removalDate || '');
        setFormRefreshDate(extra.refreshDate || ''); setFormTotalPasses(eng.totalPasses);
        setFormPassesSinceRebuild(eng.passesSinceRebuild); setFormCurrentlyInstalled(eng.currentlyInstalled);
        setFormNotes(eng.notes);
      }
    } else if (tab === 'powerAdders') {
      const sc = superchargers.find(s => s.id === id);
      if (sc) {
        setFormName(sc.name); setFormBlockSerial(sc.serialNumber || '');
        setFormInstallDate(sc.installDate); setFormRemovalDate(extra.removalDate || '');
        setFormRefreshDate(extra.refreshDate || ''); setFormTotalPasses(sc.totalPasses);
        setFormPassesSinceRebuild(sc.passesSinceService); setFormCurrentlyInstalled(sc.currentlyInstalled);
        setFormNotes(sc.notes);
      }
    } else {
      // Drivetrain-based tabs
      const dt = allDrivetrainComponents.find(c => c.id === id);

      if (dt) {
        setFormName(dt.name); setFormBlockSerial(dt.serialNumber || '');
        setFormInstallDate(dt.installDate); setFormRemovalDate(dt.dateRemoved || extra.removalDate || '');
        setFormRefreshDate(extra.refreshDate || ''); setFormTotalPasses(dt.totalPasses);
        setFormPassesSinceRebuild(dt.passesSinceService); setFormCurrentlyInstalled(dt.currentlyInstalled);
        setFormNotes(dt.notes);
        if (tab === 'transmissions') {
          setFormCurrentHeadset(extra.currentHeadset || '');
          setFormGearHeadset(extra.gearRatioHeadset || ''); setFormGear1(extra.gearRatio1 || '');
          setFormGear2(extra.gearRatio2 || ''); setFormGear3(extra.gearRatio3 || '');
          setFormGear4(extra.gearRatio4 || ''); setFormGear5(extra.gearRatio5 || '');
        }
        if (tab === 'torqueConverters') {
          setFormCurrentStator(extra.currentStator || '');
        }
      }
    }
    setShowModal(true);
  };

  // ═══════════════════════════════════════════════════════════════════
  // SAVE HANDLER
  // ═══════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    if (!formName.trim()) return;

    const extraFieldsToSave: ComponentExtraFields = {
      blockSerialNumber: formBlockSerial,
      removalDate: formRemovalDate,
      refreshDate: formRefreshDate,
    };

    if (modalTab === 'engines') {
      extraFieldsToSave.headSerial1 = formHeadSerial1;
      extraFieldsToSave.headSerial2 = formHeadSerial2;
    }
    if (modalTab === 'transmissions') {
      extraFieldsToSave.currentHeadset = formCurrentHeadset;
      extraFieldsToSave.gearRatioHeadset = formGearHeadset;
      extraFieldsToSave.gearRatio1 = formGear1;
      extraFieldsToSave.gearRatio2 = formGear2;
      extraFieldsToSave.gearRatio3 = formGear3;
      extraFieldsToSave.gearRatio4 = formGear4;
      extraFieldsToSave.gearRatio5 = formGear5;
    }
    if (modalTab === 'torqueConverters') {
      extraFieldsToSave.currentStator = formCurrentStator;
    }

    if (modalTab === 'engines') {
      if (editingId) {
        await updateEngine(editingId, {
          name: formName, serialNumber: formBlockSerial, installDate: formInstallDate,
          totalPasses: formTotalPasses, passesSinceRebuild: formPassesSinceRebuild,
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
        });
        setExtra(editingId, extraFieldsToSave);
      } else {
        const id = `ENG-${Date.now()}`;
        await addEngine({
          id, name: formName, serialNumber: formBlockSerial, builder: '',
          installDate: formInstallDate, totalPasses: formTotalPasses,
          passesSinceRebuild: formPassesSinceRebuild,
          status: formCurrentlyInstalled ? 'Active' : 'Ready',
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
          components: {} as any,
        });
        setExtra(id, extraFieldsToSave);
        // Apply template parts
        const templateKey = 'engines';
        if ((templates[templateKey] || []).length > 0) {
          applyTemplateToComponent(id, templateKey);
        }
      }
    } else if (modalTab === 'powerAdders') {
      if (editingId) {
        await updateSupercharger(editingId, {
          name: formName, serialNumber: formBlockSerial, installDate: formInstallDate,
          totalPasses: formTotalPasses, passesSinceService: formPassesSinceRebuild,
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
        });
        setExtra(editingId, extraFieldsToSave);
      } else {
        const id = `SC-${Date.now()}`;
        await addSupercharger({
          id, name: formName, serialNumber: formBlockSerial, model: '',
          installDate: formInstallDate, totalPasses: formTotalPasses,
          passesSinceService: formPassesSinceRebuild,
          status: formCurrentlyInstalled ? 'Active' : 'Ready',
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
        });
        setExtra(id, extraFieldsToSave);
        if ((templates['powerAdders'] || []).length > 0) {
          applyTemplateToComponent(id, 'powerAdders');
        }
      }
    } else {
      // Drivetrain-based tabs
      const catMap: Record<TabId, DrivetrainCategory> = {
        engines: 'transmission', powerAdders: 'transmission',
        transmissions: 'transmission', transmissionDrives: 'transmission_drive',
        torqueConverters: 'torque_converter', thirdMemberGears: 'third_member',
      };
      const category = catMap[modalTab];

      if (editingId) {
        await updateDrivetrainComponent(editingId, {
          name: formName, serialNumber: formBlockSerial, installDate: formInstallDate,
          dateRemoved: formRemovalDate, totalPasses: formTotalPasses,
          passesSinceService: formPassesSinceRebuild,
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
        });
        setExtra(editingId, extraFieldsToSave);
      } else {
        const id = `DT-${category.toUpperCase().slice(0, 4)}-${Date.now()}`;
        await addDrivetrainComponent({
          id, category, name: formName, make: '', model: '',
          serialNumber: formBlockSerial, builder: '',
          installDate: formInstallDate, dateRemoved: formRemovalDate,
          totalPasses: formTotalPasses, passesSinceService: formPassesSinceRebuild,
          hours: 0, status: formCurrentlyInstalled ? 'Active' : 'Ready',
          currentlyInstalled: formCurrentlyInstalled, notes: formNotes,
          components: {},
        });
        setExtra(id, extraFieldsToSave);
        if ((templates[modalTab] || []).length > 0) {
          applyTemplateToComponent(id, modalTab);
        }
      }
    }

    setShowModal(false);
    resetForm();
    toast.success(editingId ? 'Component updated' : 'Component added');
  };

  // ═══════════════════════════════════════════════════════════════════
  // DELETE HANDLER
  // ═══════════════════════════════════════════════════════════════════

  const handleDelete = async (tab: TabId, id: string) => {
    if (!confirm('Are you sure you want to delete this component?')) return;
    if (tab === 'engines') await deleteEngine(id);
    else if (tab === 'powerAdders') await deleteSupercharger(id);
    else await deleteDrivetrainComponent(id);
    // Clean up extra fields and DB parts for this component
    setExtraFields(prev => { const n = { ...prev }; delete n[id]; return n; });
    setComponentParts(prev => prev.filter(p => p.componentId !== id));
    db.deleteComponentPartsByComponentId(id).catch(err => console.warn('[handleDelete] DB parts cleanup failed:', err));

  };

  // ═══════════════════════════════════════════════════════════════════
  // TAB CONFIG
  // ═══════════════════════════════════════════════════════════════════

  const tabConfig: { id: TabId; label: string; icon: any; items: any[]; }[] = [
    { id: 'engines', label: 'Engines', icon: Zap, items: engines },
    { id: 'powerAdders', label: 'Power Adders', icon: Wind, items: superchargers },
    { id: 'transmissions', label: 'Transmissions', icon: Cog, items: transmissions },
    { id: 'transmissionDrives', label: 'Trans Drives', icon: Settings, items: transmissionDrives },
    { id: 'torqueConverters', label: 'Torque Conv.', icon: RefreshCw, items: torqueConverters },
    { id: 'thirdMemberGears', label: '3rd Member & Gears', icon: Wrench, items: thirdMemberGears },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // GET DISPLAY DATA FOR A COMPONENT
  // ═══════════════════════════════════════════════════════════════════

  const getComponentData = (tab: TabId, item: any) => {
    const extra = getExtra(item.id);
    return {
      id: item.id,
      name: item.name,
      serialNumber: item.serialNumber || extra.blockSerialNumber || '',
      installDate: item.installDate || '',
      removalDate: item.dateRemoved || extra.removalDate || '',
      refreshDate: extra.refreshDate || '',
      totalPasses: item.totalPasses || 0,
      passesSinceRebuild: tab === 'engines' ? (item.passesSinceRebuild || 0) : (item.passesSinceService || 0),
      currentlyInstalled: item.currentlyInstalled || false,
      notes: item.notes || '',
      headSerial1: extra.headSerial1 || '',
      headSerial2: extra.headSerial2 || '',
      currentHeadset: extra.currentHeadset || '',
      gearRatioHeadset: extra.gearRatioHeadset || '',
      gearRatio1: extra.gearRatio1 || '',
      gearRatio2: extra.gearRatio2 || '',
      gearRatio3: extra.gearRatio3 || '',
      gearRatio4: extra.gearRatio4 || '',
      gearRatio5: extra.gearRatio5 || '',
      currentStator: extra.currentStator || '',
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER STANDALONE PARTS LIST
  // ═══════════════════════════════════════════════════════════════════

  const renderPartsList = (compId: string) => {
    const parts = getPartsForComponent(compId);
    const isEditing = editingPartCompId === compId;
    const templateKey = activeTab;
    const hasTemplate = (templates[templateKey] || []).length > 0;
    // Count how many parts for THIS component are dirty (unsaved)
    const dirtyCountForComp = parts.filter(p => dirtyPartIds.has(p.id)).length;
    const hasDirtyParts = dirtyCountForComp > 0;

    return (
      <div className="mt-4 border-t border-slate-700/50 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-400" />
            Standalone Parts List ({parts.length})
            {autoSaving && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-500/15 text-blue-400 text-[10px] rounded font-medium border border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin" />
                Auto-saving...
              </span>
            )}
            {hasDirtyParts && !autoSaving && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded font-medium animate-pulse">
                {dirtyCountForComp} UNSAVED
              </span>
            )}
            {!hasDirtyParts && !autoSaving && parts.length > 0 && (
              <span className="px-2 py-0.5 bg-green-500/10 text-green-500/60 text-[10px] rounded font-medium">
                SAVED
              </span>
            )}
          </h4>

          <div className="flex items-center gap-2">
            {hasTemplate && (
              <button
                onClick={(e) => { e.stopPropagation(); applyTemplateToComponent(compId, templateKey); }}
                className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30"
                title="Apply universal template parts"
              >
                <ListChecks className="w-3 h-3" />
                Apply Template
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); openBulkImport(compId); }}
              className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30"
              title="Bulk import multiple parts at once"
            >
              <ClipboardList className="w-3 h-3" />
              Bulk Import
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditingPartCompId(isEditing ? null : compId); setNewPartName(''); }}
              className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
            >
              <Plus className="w-3 h-3" />
              Add Part
            </button>
          </div>
        </div>

        {/* Add part form */}
        {isEditing && (
          <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPartName.trim()) {
                  addPartToComponent(compId, newPartName);
                  setNewPartName('');
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              placeholder="Part name..."
              autoFocus
            />
            <button
              onClick={() => {
                if (newPartName.trim()) {
                  addPartToComponent(compId, newPartName);
                  setNewPartName('');
                }
              }}
              disabled={!newPartName.trim()}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

        {parts.length > 0 ? (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_65px_100px_1fr_32px_32px_32px] gap-2 px-3 py-1.5 text-xs text-slate-500 font-medium uppercase tracking-wider">
              <span>Part Name</span>
              <span className="text-center">Passes</span>
              <span className="text-center" title="Wear threshold — alert when passes reach this number">Limit</span>
              <span className="text-center">Date Replaced</span>
              <span>Notes</span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            {parts.map(part => {
              const isInlineEditing = editingInlinePartId === part.id;
              const isDirty = dirtyPartIds.has(part.id);
              const threshold = getWearThreshold(part.id);
              const overThreshold = threshold > 0 && part.passesOnPart >= threshold;
              const nearThreshold = threshold > 0 && !overThreshold && part.passesOnPart >= threshold * 0.8;
              return (
                <div key={part.id} className={`grid grid-cols-[1fr_80px_65px_100px_1fr_32px_32px_32px] gap-2 items-center px-3 py-2 bg-slate-900/50 rounded-lg border ${overThreshold ? 'border-red-500/50 bg-red-500/5' : isDirty ? 'border-yellow-500/40' : 'border-slate-700/30'}`} onClick={(e) => e.stopPropagation()}>
                  {/* Part Name — inline editable + wear badge */}
                  {isInlineEditing ? (
                    <input
                      type="text"
                      value={editInlinePartName}
                      onChange={(e) => setEditInlinePartName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editInlinePartName.trim()) {
                          updatePartName(compId, part.id, editInlinePartName);
                        }
                        if (e.key === 'Escape') {
                          setEditingInlinePartId(null);
                          setEditInlinePartName('');
                        }
                      }}
                      className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-slate-200 truncate">{part.partName}</span>
                      {overThreshold && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] rounded font-bold flex items-center gap-0.5" title={`Wear limit reached: ${part.passesOnPart}/${threshold} passes`}>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          REPLACE
                        </span>
                      )}
                      {nearThreshold && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] rounded font-bold" title={`Approaching wear limit: ${part.passesOnPart}/${threshold} passes`}>
                          DUE SOON
                        </span>
                      )}
                    </div>
                  )}

                  {/* Passes input */}
                  <input
                    type="number"
                    value={part.passesOnPart}
                    onChange={(e) => updatePartPasses(compId, part.id, parseInt(e.target.value) || 0)}
                    className={`w-full bg-slate-800 border rounded px-2 py-1 text-sm text-center ${overThreshold ? 'text-red-400 border-red-500/60 font-bold' : isDirty ? 'text-white border-yellow-500/60' : 'text-white border-slate-600'}`}
                    min={0}
                  />

                  {/* Wear Threshold input */}
                  <input
                    type="number"
                    value={threshold || ''}
                    onChange={(e) => setWearThreshold(part.id, parseInt(e.target.value) || 0)}
                    placeholder="--"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-sm text-center"
                    min={0}
                    title="Set max passes before replacement (0 = no limit)"
                  />

                  {/* Date Replaced input */}
                  <input
                    type="date"
                    value={part.dateReplaced || ''}
                    onChange={(e) => {
                      setComponentParts(prev =>
                        prev.map(p =>
                          p.id === part.id && p.componentId === compId ? { ...p, dateReplaced: e.target.value } : p
                        )
                      );
                      setDirtyPartIds(prev => { const next = new Set(prev); next.add(part.id); return next; });
                    }}
                    className={`w-full bg-slate-800 border rounded px-1 py-1 text-white text-xs ${isDirty ? 'border-yellow-500/60' : 'border-slate-600'}`}
                  />

                  {/* Notes input */}
                  <input
                    type="text"
                    value={part.notes || ''}
                    onChange={(e) => {
                      setComponentParts(prev =>
                        prev.map(p =>
                          p.id === part.id && p.componentId === compId ? { ...p, notes: e.target.value } : p
                        )
                      );
                      setDirtyPartIds(prev => { const next = new Set(prev); next.add(part.id); return next; });
                    }}
                    placeholder="Notes..."
                    className={`w-full bg-slate-800 border rounded px-2 py-1 text-white text-sm ${isDirty ? 'border-yellow-500/60' : 'border-slate-600'}`}
                  />

                  {/* Edit / Save button */}
                  {isInlineEditing ? (
                    <button
                      onClick={() => {
                        if (editInlinePartName.trim()) {
                          updatePartName(compId, part.id, editInlinePartName);
                        }
                      }}
                      className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingInlinePartId(part.id);
                        setEditInlinePartName(part.partName);
                      }}
                      className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                      title="Edit part name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Reset Passes button */}
                  <button
                    onClick={() => setResetConfirmPartId(part.id)}
                    className="p-1 text-amber-400 hover:bg-amber-500/20 rounded"
                    title="Reset passes to 0 (part replaced/rebuilt)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => removePartFromComponent(compId, part.id)}
                    className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                    title="Remove part"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

        ) : (
          <p className="text-xs text-slate-500 italic py-2">No parts added yet. Click "Add Part" to start building the parts list.</p>
        )}


        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SAVE ALL PARTS BUTTON + AUTO-SAVE INDICATOR */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {parts.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>

            <span className="text-[10px] text-slate-500 italic">
              Changes auto-save 3s after last edit
            </span>
            <div className="flex items-center gap-3">
              {hasDirtyParts && !autoSaving && (
                <span className="text-xs text-yellow-400/80">
                  {dirtyCountForComp} unsaved change{dirtyCountForComp !== 1 ? 's' : ''}
                </span>
              )}
              {autoSaving && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400/80">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Auto-saving...
                </span>
              )}
              <button
                onClick={() => handleSaveAllParts(compId)}
                disabled={savingParts || autoSaving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  hasDirtyParts
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-500/20 animate-pulse'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-600/20'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none`}
                title="Manual save — also happens automatically 3s after last edit"
              >
                {savingParts ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save All Parts
                  </>
                )}
              </button>
            </div>
          </div>
        )}


        {/* Template info */}
        {hasTemplate && (
          <p className="text-[10px] text-slate-600 mt-2">
            Universal template: {(templates[templateKey] || []).join(', ')}
          </p>
        )}
      </div>
    );
  };


  // ═══════════════════════════════════════════════════════════════════
  // RENDER COMPONENT CARD
  // ═══════════════════════════════════════════════════════════════════

  const renderComponentCard = (tab: TabId, item: any) => {
    const data = getComponentData(tab, item);
    const isExpanded = expandedId === data.id;

    return (
      <div
        key={data.id}
        className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
          data.currentlyInstalled ? 'border-green-500/50' : 'border-slate-700/50'
        }`}
      >
        {/* Header */}
        <div
          className="p-4 cursor-pointer hover:bg-slate-700/20"
          onClick={() => setExpandedId(isExpanded ? null : data.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                data.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
              }`}>
                {React.createElement(tabConfig.find(t => t.id === tab)?.icon || Wrench, {
                  className: `w-6 h-6 ${data.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`
                })}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-white">{data.name}</h3>
                  {data.currentlyInstalled && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">INSTALLED</span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  S/N: {data.serialNumber || 'N/A'}
                  {tab === 'engines' && data.headSerial1 && ` | Head L: ${data.headSerial1}`}
                  {tab === 'engines' && data.headSerial2 && ` | Head R: ${data.headSerial2}`}
                  {tab === 'transmissions' && data.currentHeadset && ` | Headset: ${data.currentHeadset}`}
                  {tab === 'torqueConverters' && data.currentStator && ` | Stator: ${data.currentStator}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-white font-medium">{data.totalPasses} total passes</p>
                <p className="text-sm text-slate-400">{data.passesSinceRebuild} since rebuild/refresh</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(tab, data.id); }}
                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(tab, data.id); }}
                  className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-slate-700/50 p-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
              {/* Core Details */}
              <div>
                <h4 className="font-medium text-white mb-3">Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Name / Number</span><span className="text-white">{data.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">{tab === 'engines' ? 'Block Serial Number' : 'Serial Number'}</span><span className="text-white">{data.serialNumber || 'N/A'}</span></div>

                  {tab === 'engines' && (
                    <>
                      <div className="flex justify-between"><span className="text-slate-400">Head #1 Serial (Left)</span><span className="text-white">{data.headSerial1 || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Head #2 Serial (Right)</span><span className="text-white">{data.headSerial2 || 'N/A'}</span></div>
                    </>
                  )}
                  {tab === 'torqueConverters' && (
                    <div className="flex justify-between"><span className="text-slate-400">Current Stator</span><span className="text-white">{data.currentStator || 'N/A'}</span></div>
                  )}
                </div>
              </div>

              {/* Dates & Passes */}
              <div>
                <h4 className="font-medium text-white mb-3">Dates & Passes</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Install Date</span><span className="text-white">{data.installDate || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Removal Date</span><span className="text-white">{data.removalDate || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Refresh Date</span><span className="text-white">{data.refreshDate || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total Passes</span><span className="text-white font-medium">{data.totalPasses}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Since Rebuild/Refresh</span><span className="text-white font-medium">{data.passesSinceRebuild}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Currently Installed</span><span className={data.currentlyInstalled ? 'text-green-400 font-medium' : 'text-slate-400'}>{data.currentlyInstalled ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              {/* Transmission Gear Ratios */}
              {tab === 'transmissions' && (
                <div>
                  <h4 className="font-medium text-white mb-3">Gear Ratios</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Current Headset</span><span className="text-white">{data.currentHeadset || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Headset Ratio</span><span className="text-white">{data.gearRatioHeadset || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">1st Gear</span><span className="text-white">{data.gearRatio1 || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">2nd Gear</span><span className="text-white">{data.gearRatio2 || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">3rd Gear</span><span className="text-white">{data.gearRatio3 || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">4th Gear</span><span className="text-white">{data.gearRatio4 || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">5th Gear</span><span className="text-white">{data.gearRatio5 || 'N/A'}</span></div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {data.notes && !(tab === 'transmissions') && (
                <div>
                  <h4 className="font-medium text-white mb-3">Notes</h4>
                  <p className="text-sm text-slate-400 italic">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Notes for transmissions (shown below gear ratios) */}
            {tab === 'transmissions' && data.notes && (
              <div className="mb-4">
                <h4 className="font-medium text-white mb-2">Notes</h4>
                <p className="text-sm text-slate-400 italic">{data.notes}</p>
              </div>
            )}

            {/* Standalone Parts List */}
            {renderPartsList(data.id)}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  const currentTabConfig = tabConfig.find(t => t.id === activeTab);
  const currentItems = currentTabConfig?.items || [];

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Main Components</h2>
            <p className="text-sm text-slate-400 mt-1">Track engines, power adders, transmissions, and drivetrain components</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">



            <button
              onClick={() => {
                setRecordPassCount(1);
                setShowRecordPassModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg shadow-green-600/20 whitespace-nowrap"
            >
              <Play className="w-5 h-5" />
              Record Pass
            </button>
          </div>

        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {tabConfig.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label} ({tab.items.length})
              </button>
            );
          })}
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => openAddModal(activeTab)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add {currentTabConfig?.label.replace(/s$/, '').replace('Trans Drive', 'Transmission Drive').replace('Torque Conv.', 'Torque Converter').replace('3rd Member & Gear', '3rd Member / Gear')}
          </button>
        </div>

        {/* Component List */}
        {currentItems.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
            {React.createElement(currentTabConfig?.icon || Wrench, { className: 'w-14 h-14 text-slate-600 mx-auto mb-4' })}
            <p className="text-slate-400 text-lg font-medium">No {currentTabConfig?.label.toLowerCase()} added yet</p>
            <p className="text-slate-500 text-sm mt-1">Click the button above to add your first component</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentItems.map(item => renderComponentCard(activeTab, item))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ADD/EDIT MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Edit' : 'Add New'} {tabConfig.find(t => t.id === modalTab)?.label.replace(/s$/, '')}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {modalTab === 'engines' ? 'Engine' : modalTab === 'powerAdders' ? 'Power Adder' : 'Component'} Name / Number *
                </label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Engine #1 - Race" />
              </div>
              {/* Serial Number (Block Serial Number for Engines, Serial Number for others) */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">{modalTab === 'engines' ? 'Block Serial Number' : 'Serial Number'}</label>
                <input type="text" value={formBlockSerial} onChange={(e) => setFormBlockSerial(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>


              {/* Head Serial Numbers - Engines only */}
              {modalTab === 'engines' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Head #1 Serial (Left Head)</label>
                    <input type="text" value={formHeadSerial1} onChange={(e) => setFormHeadSerial1(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Head #2 Serial (Right Head)</label>
                    <input type="text" value={formHeadSerial2} onChange={(e) => setFormHeadSerial2(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                  </div>
                </div>
              )}

              {/* Transmission-specific: Current Headset + Gear Ratios */}
              {modalTab === 'transmissions' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Current Headset</label>
                    <input type="text" value={formCurrentHeadset} onChange={(e) => setFormCurrentHeadset(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 2.50" />
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <label className="block text-sm text-slate-300 font-medium mb-3">Gear Ratios</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Headset</label>
                        <input type="text" value={formGearHeadset} onChange={(e) => setFormGearHeadset(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">1st Gear</label>
                        <input type="text" value={formGear1} onChange={(e) => setFormGear1(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">2nd Gear</label>
                        <input type="text" value={formGear2} onChange={(e) => setFormGear2(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">3rd Gear</label>
                        <input type="text" value={formGear3} onChange={(e) => setFormGear3(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">4th Gear</label>
                        <input type="text" value={formGear4} onChange={(e) => setFormGear4(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">5th Gear</label>
                        <input type="text" value={formGear5} onChange={(e) => setFormGear5(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Torque Converter-specific: Current Stator */}
              {modalTab === 'torqueConverters' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Current Stator</label>
                  <input type="text" value={formCurrentStator} onChange={(e) => setFormCurrentStator(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 3200 RPM" />
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Install Date</label>
                  <DateInputDark value={formInstallDate} onChange={(e) => setFormInstallDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Removal Date</label>
                  <DateInputDark value={formRemovalDate} onChange={(e) => setFormRemovalDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Refresh Date</label>
                  <DateInputDark value={formRefreshDate} onChange={(e) => setFormRefreshDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>

              {/* Passes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Number of Passes</label>
                  <input type="number" value={formTotalPasses} onChange={(e) => setFormTotalPasses(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" min={0} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Passes Since Rebuild/Refresh</label>
                  <input type="number" value={formPassesSinceRebuild} onChange={(e) => setFormPassesSinceRebuild(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" min={0} />
                </div>
              </div>

              {/* Currently Installed */}
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <span className="text-sm text-slate-300">Currently Installed</span>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFormCurrentlyInstalled(!formCurrentlyInstalled)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${formCurrentlyInstalled ? 'bg-green-500' : 'bg-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formCurrentlyInstalled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </div>
                  <span className={`text-sm font-medium ${formCurrentlyInstalled ? 'text-green-400' : 'text-slate-500'}`}>
                    {formCurrentlyInstalled ? 'Yes' : 'No'}
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                Cancel
              </button>
              <button onClick={handleSave} disabled={!formName.trim()}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {editingId ? 'Save Changes' : 'Add Component'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RECORD PASS MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showRecordPassModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-green-400" />
                Record Pass
              </h3>
              <button onClick={() => setShowRecordPassModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-5">
              Update <span className="text-white font-medium">totalPasses</span>, <span className="text-white font-medium">passesSinceRebuild/Refresh</span>, and all <span className="text-white font-medium">standalone parts list passes</span> on every currently installed component.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Number of Passes to Add</label>
                <input type="number" min={1} value={recordPassCount}
                  onChange={(e) => setRecordPassCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg font-bold text-center" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRecordPassModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                Cancel
              </button>
              <button onClick={handleRecordPass}
                disabled={recordPassCount < 1 || recordPassLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
                {recordPassLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {recordPassLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>


          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BULK IMPORT MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {bulkImportCompId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeBulkImport}>
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-cyan-400" />
                Bulk Import Parts
              </h3>
              <button onClick={closeBulkImport} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Step 1: Input */}
            {bulkImportStep === 'input' && (
              <div>
                <p className="text-sm text-slate-400 mb-3">
                  Paste or type part names below. Separate with <span className="text-cyan-400 font-medium">commas</span>, <span className="text-cyan-400 font-medium">newlines</span>, or <span className="text-cyan-400 font-medium">semicolons</span>.
                </p>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono min-h-[160px] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  placeholder={"Piston Set\nRod Bearings\nMain Bearings, Head Gaskets\nIntake Valves; Exhaust Valves\nCam Bearings, Lifters\nPush Rods, Rocker Arms"}
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  Duplicates and empty lines will be automatically removed.
                </p>
                <div className="flex gap-3 mt-5">
                  <button onClick={closeBulkImport}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkImportPreview}
                    disabled={!bulkImportText.trim()}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Preview Import
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {bulkImportStep === 'preview' && (
              <div>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{bulkImportPreview.newNames.length}</p>
                    <p className="text-xs text-green-400/70 font-medium">New Parts to Add</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{bulkImportPreview.existingNames.length}</p>
                    <p className="text-xs text-yellow-400/70 font-medium">Already Exist (Skipped)</p>
                  </div>
                </div>

                {/* New parts list */}
                {bulkImportPreview.newNames.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Will be added ({bulkImportPreview.newNames.length})
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-3 max-h-[200px] overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {bulkImportPreview.newNames.map((name, i) => (
                          <span key={i} className="px-2.5 py-1 bg-green-500/15 text-green-300 text-xs rounded-full border border-green-500/20">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing parts list */}
                {bulkImportPreview.existingNames.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Already exist — will be skipped ({bulkImportPreview.existingNames.length})
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-3 max-h-[120px] overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {bulkImportPreview.existingNames.map((name, i) => (
                          <span key={i} className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400/70 text-xs rounded-full border border-yellow-500/20 line-through">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* No new parts warning */}
                {bulkImportPreview.newNames.length === 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-300 font-medium">No new parts to import</p>
                      <p className="text-xs text-yellow-400/60 mt-1">All part names already exist on this component.</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setBulkImportStep('input')}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                    Back
                  </button>
                  <button
                    onClick={handleBulkImportSave}
                    disabled={bulkImportPreview.newNames.length === 0 || bulkImportSaving}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    {bulkImportSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import {bulkImportPreview.newNames.length} Part{bulkImportPreview.newNames.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RESET PASSES CONFIRMATION DIALOG */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {resetConfirmPartId && (() => {
        const part = componentParts.find(p => p.id === resetConfirmPartId);
        if (!part) return null;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setResetConfirmPartId(null)}>
            <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reset Part Passes</h3>
                  <p className="text-sm text-slate-400">This action cannot be undone</p>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 mb-4 border border-slate-700/50">
                <p className="text-white font-medium text-sm">{part.partName}</p>
                <p className="text-slate-400 text-xs mt-1">Current passes: <span className="text-white font-bold">{part.passesOnPart}</span></p>
              </div>
              <p className="text-sm text-slate-400 mb-5">
                This will reset the pass count to <span className="text-white font-bold">0</span> and log today's date as the replacement/rebuild date.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setResetConfirmPartId(null)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                  Cancel
                </button>
                <button onClick={() => handleResetPartPasses(part.componentId, part.id)}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset to 0
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </section>

  );
};

export default MainComponents;
