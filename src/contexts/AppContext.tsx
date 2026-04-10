import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { purgeDeletedPartFromCaches } from '@/lib/partsCleanup';
import { auditLog } from '@/lib/auditLog';


import * as dbLogger from '@/lib/dbLogger';
import { toast } from 'sonner';
import { checkNewlyTriggeredAlerts, loadAlertSettings } from '@/lib/maintenanceAlerts';

import {

  ComponentTracker,

  PassLogEntry,
  Engine,
  Supercharger,
  CylinderHead,
  MaintenanceItem,
  SFICertification,
  ChecklistItem,
  EngineSwapLog,
  TrackWeatherHistory,
  calculateMaintenanceStatus,
  engines as initialEngines,
  superchargers as initialSuperchargers,
  cylinderHeads as initialCylinderHeads,
  maintenanceItems as initialMaintenanceItems,
  sfiCertifications as initialSFICertifications,
  passLogs as initialPassLogs,
  engineSwapLogs as initialEngineSwapLogs,
  preRunChecklist as initialPreRunChecklist,
  betweenRoundsChecklist as initialBetweenRoundsChecklist,
  postRunChecklist as initialPostRunChecklist,
  trackWeatherHistory as initialTrackWeatherHistory
} from '@/data/proModData';


import { PartInventoryItem, partsInventory as initialPartsInventory } from '@/data/partsInventory';
import { RaceEvent } from '@/components/race/RaceCalendar';
import { TeamMember } from '@/components/race/TeamProfile';
import * as db from '@/lib/database';
import { SavedTrack, ToDoItem, TeamNote, LaborEntry, MediaItem, DrivetrainComponent, DrivetrainCategory, DrivetrainSwapLog, VendorRecord, PassHistoryEntry, ComponentPart, TireSet, TreadDepthEntry, TirePressureEntry, TireChangeLog } from '@/lib/database';






import { useAuth } from '@/contexts/AuthContext';
import type { SaveStatus } from '@/components/race/SaveStatusIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { isConnectivityError, type QueueOperationType } from '@/lib/offlineQueue';

// ============ MODULE-LEVEL CONSTANT — UNDO DELETE WINDOW ============
// Declared at module scope (outside the component) so it cannot interfere
// with React's hook ordering inside AppProvider. This is the ONLY declaration.
const UNDO_DELETE_WINDOW_MS = 10000; // 10 seconds

// ============ TIRE SET PASS COUNT HELPERS (localStorage-based) ============
// Tire sets live in localStorage (managed by TireTracking component).
// These module-level helpers allow addPassLog / deletePassLog to auto-increment
// and auto-decrement active tire set pass counts without pulling tire data into
// React state inside AppContext.
const TIRE_SETS_LS_KEY = 'tire_tracking_sets';

interface TireSetLS {
  id: string;
  status: 'Active' | 'Spare' | 'Retired';
  totalPasses: number;
  [key: string]: any;
}

/**
 * Increment (or decrement when negative) totalPasses on every Active tire set
 * stored in localStorage. Returns the count of sets updated and a snapshot of
 * the data *before* the update (useful for undo).
 */
function incrementActiveTireSets(increment: number): { updatedCount: number; preUpdateSnapshot: TireSetLS[] } {
  const preUpdateSnapshot: TireSetLS[] = [];
  let updatedCount = 0;
  try {
    const raw = localStorage.getItem(TIRE_SETS_LS_KEY);
    if (!raw) return { updatedCount: 0, preUpdateSnapshot: [] };
    const sets: TireSetLS[] = JSON.parse(raw);
    if (!Array.isArray(sets) || sets.length === 0) return { updatedCount: 0, preUpdateSnapshot: [] };

    // Deep-copy snapshot before mutation
    preUpdateSnapshot.push(...sets.map(s => ({ ...s })));

    const updated = sets.map(s => {
      if (s.status === 'Active') {
        updatedCount++;
        return { ...s, totalPasses: Math.max(0, (s.totalPasses || 0) + increment) };
      }
      return s;
    });
    localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[AppContext] Tire set localStorage update failed:', err);
  }
  return { updatedCount, preUpdateSnapshot };
}

/** Restore tire sets in localStorage from a previously captured snapshot. */
function restoreTireSetsFromSnapshot(snapshot: TireSetLS[]) {
  try {
    if (snapshot.length > 0) {
      localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(snapshot));
    }
  } catch (err) {
    console.warn('[AppContext] Tire set localStorage restore failed:', err);
  }
}




interface AppContextType {
  // Loading state
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  
  // Save status tracking
  saveStatus: SaveStatus;
  lastSaveTime: Date | null;
  lastSaveError: string | null;
  retrySave: () => void;
  
  // Offline sync state
  isOnline: boolean;
  pendingOfflineCount: number;
  hasConnectivityIssue: boolean;
  isOfflineSyncing: boolean;
  offlineSyncProgress: number;
  syncOfflineQueue: () => Promise<void>;

  // Data
  engines: Engine[];
  superchargers: Supercharger[];
  cylinderHeads: CylinderHead[];
  maintenanceItems: MaintenanceItem[];
  sfiCertifications: SFICertification[];
  passLogs: PassLogEntry[];
  engineSwapLogs: EngineSwapLog[];
  preRunChecklist: ChecklistItem[];
  betweenRoundsChecklist: ChecklistItem[];
  postRunChecklist: ChecklistItem[];
  partsInventory: PartInventoryItem[];
  trackWeatherHistory: TrackWeatherHistory[];
  raceEvents: RaceEvent[];
  teamMembers: TeamMember[];
  savedTracks: SavedTrack[];
  drivetrainComponents: DrivetrainComponent[];
  drivetrainSwapLogs: DrivetrainSwapLog[];
  vendors: VendorRecord[];
  tireSets: TireSet[];
  treadDepth: TreadDepthEntry[];
  pressureHistory: TirePressureEntry[];
  tireChangeLog: TireChangeLog[];

  // Vendor Actions
  addVendor: (vendor: VendorRecord) => Promise<void>;
  updateVendor: (id: string, vendor: Partial<VendorRecord>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  refreshVendors: () => Promise<void>;

  // Tire Tracking Actions
  addTireSet: (tire: TireSet) => Promise<void>;
  updateTireSet: (id: string, tire: Partial<TireSet>) => Promise<void>;
  deleteTireSetAction: (id: string) => Promise<void>;
  addTreadDepth: (entry: TreadDepthEntry) => Promise<void>;
  deleteTreadDepthAction: (id: string) => Promise<void>;
  addPressureEntry: (entry: TirePressureEntry) => Promise<void>;
  deletePressureEntryAction: (id: string) => Promise<void>;
  addTireChangeLogEntry: (entry: TireChangeLog) => Promise<void>;
  deleteTireChangeLogEntryAction: (id: string) => Promise<void>;

  
  // Pass Log Actions
  addPassLog: (pass: PassLogEntry) => Promise<void>;
  updatePassLog: (id: string, pass: Partial<PassLogEntry>) => Promise<void>;
  deletePassLog: (id: string) => Promise<void>;
  
  // Engine Actions

  addEngine: (engine: Engine) => Promise<void>;
  performEngineSwap: (previousEngineId: string, newEngineId: string, reason: string, performedBy: string, notes: string) => Promise<void>;
  updateEngine: (id: string, engine: Partial<Engine>) => Promise<void>;
  deleteEngine: (id: string) => Promise<void>;
  
  // Supercharger Actions
  addSupercharger: (sc: Supercharger) => Promise<void>;
  updateSupercharger: (id: string, sc: Partial<Supercharger>) => Promise<void>;
  deleteSupercharger: (id: string) => Promise<void>;
  
  // Cylinder Head Actions
  addCylinderHead: (head: CylinderHead) => Promise<void>;
  updateCylinderHead: (id: string, head: Partial<CylinderHead>) => Promise<void>;
  deleteCylinderHead: (id: string) => Promise<void>;
  
  // Maintenance Actions
  addMaintenanceItem: (item: MaintenanceItem) => Promise<void>;
  updateMaintenanceItem: (id: string, item: Partial<MaintenanceItem>) => Promise<void>;
  deleteMaintenanceItem: (id: string) => Promise<void>;
  
  // SFI Certification Actions
  addSFICertification: (cert: SFICertification) => Promise<void>;
  updateSFICertification: (id: string, cert: Partial<SFICertification>) => Promise<void>;
  deleteSFICertification: (id: string) => Promise<void>;
  
  // Parts Inventory Actions
  addPartInventory: (part: PartInventoryItem) => Promise<void>;
  updatePartInventory: (id: string, part: Partial<PartInventoryItem>) => Promise<void>;
  deletePartInventory: (id: string) => Promise<void>;
  
  // Track Weather History Actions
  updateTrackWeatherHistory: (track: TrackWeatherHistory) => Promise<void>;
  
  // Checklist Actions
  addChecklistItem: (checklistType: 'preRun' | 'betweenRounds' | 'postRun', item: ChecklistItem) => Promise<void>;
  updateChecklistItem: (checklistType: 'preRun' | 'betweenRounds' | 'postRun', id: string, item: Partial<ChecklistItem>) => Promise<void>;
  deleteChecklistItem: (checklistType: 'preRun' | 'betweenRounds' | 'postRun', id: string) => Promise<void>;
  toggleChecklistItem: (checklistType: 'preRun' | 'betweenRounds' | 'postRun', itemId: string) => Promise<void>;
  resetChecklist: (checklistType: 'preRun' | 'betweenRounds' | 'postRun') => Promise<void>;
  
  // Race Event Actions
  addRaceEvent: (event: RaceEvent) => Promise<void>;
  updateRaceEvent: (id: string, event: Partial<RaceEvent>) => Promise<void>;
  deleteRaceEvent: (id: string) => Promise<void>;
  
  // Team Member Actions
  addTeamMember: (member: TeamMember) => Promise<void>;
  updateTeamMember: (id: string, member: Partial<TeamMember>) => Promise<void>;
  deleteTeamMember: (id: string) => Promise<void>;
  
  // Saved Track Actions
  addSavedTrack: (track: SavedTrack) => Promise<void>;
  updateSavedTrack: (id: string, track: Partial<SavedTrack>) => Promise<void>;
  deleteSavedTrack: (id: string) => Promise<void>;
  incrementTrackVisit: (id: string) => Promise<void>;
  
  // Drivetrain Component Actions
  addDrivetrainComponent: (comp: DrivetrainComponent) => Promise<void>;
  updateDrivetrainComponent: (id: string, comp: Partial<DrivetrainComponent>) => Promise<void>;
  deleteDrivetrainComponent: (id: string) => Promise<void>;
  performDrivetrainSwap: (componentType: DrivetrainCategory, previousComponentId: string, newComponentId: string, reason: string, performedBy: string, notes: string) => Promise<void>;


  
  // Sync
  refreshData: () => Promise<void>;
  
  // Computed
  getActiveEngine: () => Engine | undefined;
  getActiveSupercharger: () => Supercharger | undefined;
  getTotalPasses: () => number;
  getAlertCount: () => number;
  getLowStockCount: () => number;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isDemoMode, effectiveUserId, isTeamMember, activeTeamMembership, dataFetchSignal } = useAuth();

  // ============ OFFLINE SYNC ============
  const offlineSync = useOfflineSync();

  const mountedRef = useRef(true);
  
  // ALWAYS FALSE - app renders immediately with local data
  const isLoading = false;
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Data states - initialized with LOCAL data so app works immediately
  const [engines, setEngines] = useState<Engine[]>(initialEngines);
  const [superchargers, setSuperchargers] = useState<Supercharger[]>(initialSuperchargers);
  const [cylinderHeads, setCylinderHeads] = useState<CylinderHead[]>(initialCylinderHeads);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>(initialMaintenanceItems);
  const [sfiCertifications, setSFICertifications] = useState<SFICertification[]>(initialSFICertifications);
  const [passLogs, setPassLogs] = useState<PassLogEntry[]>(initialPassLogs);


  const [engineSwapLogs, setEngineSwapLogs] = useState<EngineSwapLog[]>(initialEngineSwapLogs);
  const [preRunChecklist, setPreRunChecklist] = useState<ChecklistItem[]>(initialPreRunChecklist);
  const [betweenRoundsChecklist, setBetweenRoundsChecklist] = useState<ChecklistItem[]>(initialBetweenRoundsChecklist);
  const [postRunChecklist, setPostRunChecklist] = useState<ChecklistItem[]>(initialPostRunChecklist);
  const [partsInventory, setPartsInventory] = useState<PartInventoryItem[]>(initialPartsInventory);
  const [trackWeatherHistory, setTrackWeatherHistory] = useState<TrackWeatherHistory[]>(initialTrackWeatherHistory);
  const [raceEvents, setRaceEvents] = useState<RaceEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [drivetrainComponents, setDrivetrainComponents] = useState<DrivetrainComponent[]>([]);
  const [drivetrainSwapLogs, setDrivetrainSwapLogs] = useState<DrivetrainSwapLog[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [tireSets, setTireSets] = useState<TireSet[]>([]);
  const [treadDepth, setTreadDepth] = useState<TreadDepthEntry[]>([]);
  const [pressureHistory, setPressureHistory] = useState<TirePressureEntry[]>([]);
  const [tireChangeLog, setTireChangeLog] = useState<TireChangeLog[]>([]);


  // ============ SAVE STATUS TRACKING ============
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const lastFailedOperationRef = useRef<(() => Promise<void>) | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSavesRef = useRef(0);
  const vendorSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);



  // ============ UNDO DELETE: PENDING PART DELETES ============
  const pendingPartDeletesRef = useRef<Map<string, {
    part: PartInventoryItem;
    timeoutId: ReturnType<typeof setTimeout>;
    toastId: string | number;
  }>>(new Map());

  // ============ UNDO DELETE: PENDING ENGINE DELETES ============
  const pendingEngineDeletesRef = useRef<Map<string, {
    item: Engine;
    timeoutId: ReturnType<typeof setTimeout>;
    toastId: string | number;
  }>>(new Map());




  // ============ UNDO DELETE: PENDING MAINTENANCE ITEM DELETES ============
  const pendingMaintenanceDeletesRef = useRef<Map<string, {
    item: MaintenanceItem;
    timeoutId: ReturnType<typeof setTimeout>;
    toastId: string | number;
  }>>(new Map());

  // ============ UNDO DELETE: PENDING PASS LOG DELETES ============
  const pendingPassLogDeletesRef = useRef<Map<string, {
    item: PassLogEntry;
    timeoutId: ReturnType<typeof setTimeout>;
    toastId: string | number;
  }>>(new Map());



  // Wrapper to sync offline queue and then refresh data
  const syncOfflineQueue = useCallback(async () => {
    const result = await offlineSync.syncNow();
    if (result.processed > 0) {
      // After syncing queued items, refresh data from DB to get latest state
      await refreshData();
    }
  }, [offlineSync.syncNow]);

  // Tracks database save operations and updates the save status indicator
  // In demo mode, skip actual database operations but still update status
  // offlineInfo: optional info to queue the operation for offline replay
  // errorToastMessage: optional — when provided, shows a visible toast.error on DB save failure
  const trackSave = useCallback(async (
    operation: () => Promise<void>,
    label?: string,
    offlineInfo?: { type: QueueOperationType; data: any },
    errorToastMessage?: string
  ) => {
    // In demo mode, skip database operations entirely - just update local state
    if (isDemoMode) {
      setSaveStatus('saved');
      setLastSaveTime(new Date());
      // Auto-reset to idle
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle');
      }, 3000);
      return;
    }

    activeSavesRef.current += 1;
    setSaveStatus('saving');
    setLastSaveError(null);
    
    // Store the operation for potential retry
    lastFailedOperationRef.current = operation;

    // Determine type from label
    const isDelete = label?.toLowerCase().includes('delete') || label?.toLowerCase().includes('reset');
    const logType = isDelete ? 'delete' as const : 'write' as const;
    const tableName = label?.replace(/^(add|update|delete|toggle|reset|increment)/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') || undefined;
    const logId = dbLogger.logStart(label || 'unknown_write', logType, tableName);
    const startTime = performance.now();
    
    try {
      await operation();
      activeSavesRef.current -= 1;
      
      const duration = Math.round(performance.now() - startTime);
      dbLogger.logSuccess(logId, duration);
      
      // Report success to offline sync (clears connectivity issue flag)
      offlineSync.reportSuccess();
      
      if (activeSavesRef.current <= 0) {
        activeSavesRef.current = 0;
        setSaveStatus('saved');
        setLastSaveTime(new Date());
        setLastSaveError(null);
        lastFailedOperationRef.current = null;
        
        // Auto-reset to idle after 30 seconds of no activity
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
          if (mountedRef.current) setSaveStatus('idle');
        }, 30000);
      }
    } catch (error) {
      activeSavesRef.current -= 1;
      if (activeSavesRef.current <= 0) activeSavesRef.current = 0;
      
      const duration = Math.round(performance.now() - startTime);
      const errorMsg = error instanceof Error ? error.message : 'Failed to save data';
      dbLogger.logError(logId, errorMsg, duration);
      
      // Check if this is a connectivity error — if so, queue for offline sync
      if (isConnectivityError(error) && offlineInfo) {
        console.log(`[AppContext] Connectivity error — queuing for offline sync: ${label}`);
        offlineSync.queueOperation(offlineInfo.type, offlineInfo.data, user?.id, label);
        offlineSync.reportConnectivityError();
        
        // Show "queued" status instead of error
        setSaveStatus('saved'); // treat as "saved locally"
        setLastSaveError(null);
        setLastSaveTime(new Date());
        lastFailedOperationRef.current = null;
        
        // Auto-reset to idle
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
          if (mountedRef.current) setSaveStatus('idle');
        }, 5000);
      } else {
        console.error(`Save error${label ? ` (${label})` : ''}:`, error);
        setSaveStatus('error');
        setLastSaveError(errorMsg);
        
        // Show a visible toast.error if the caller provided a message
        if (errorToastMessage) {
          toast.error(errorToastMessage, {
            description: 'Check your connection and try again.',
            duration: 8000,
          });
        }
      }
    }
  }, [isDemoMode, offlineSync.queueOperation, offlineSync.reportConnectivityError, offlineSync.reportSuccess, user?.id]);




  // Retry the last failed save operation
  const retrySave = useCallback(() => {
    const lastOp = lastFailedOperationRef.current;
    if (lastOp) {
      trackSave(lastOp, 'retry');
    } else {
      // If no specific operation to retry, do a full refresh
      refreshData();
    }
  }, [trackSave]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (vendorSyncIntervalRef.current) clearInterval(vendorSyncIntervalRef.current);
      // Execute any pending deletes immediately on unmount
      // (don't leave orphaned soft-deleted items that never get hard-deleted)
      const allPendingRefs = [
        pendingPartDeletesRef,
        pendingEngineDeletesRef,
        pendingMaintenanceDeletesRef,
        pendingPassLogDeletesRef,
      ];

      for (const ref of allPendingRefs) {
        ref.current.forEach((pending) => {
          clearTimeout(pending.timeoutId);
        });
        ref.current.clear();
      }
    };
  }, []);








  // ============ GLOBAL DATA FETCH TRIGGER ============
  // Watches BOTH effectiveUserId changes AND dataFetchSignal from AuthContext.
  // dataFetchSignal fires on: SIGNED_IN, INITIAL_SESSION, getSession restore, PKCE exchange.
  // This ensures ALL data is fetched immediately when a user logs in or the page loads with a session.
  const prevEffectiveUserIdRef = useRef<string | undefined>(undefined);
  const prevDataFetchSignalRef = useRef<number>(0);
  
  useEffect(() => {
    // Skip sync in demo mode
    if (isDemoMode) return;
    
    // Detect if this is a login transition (user just signed in)
    const isLoginTransition = !!(effectiveUserId && !prevEffectiveUserIdRef.current);
    // Detect if the signal changed (auth confirmed a session)
    const signalChanged = dataFetchSignal > 0 && dataFetchSignal !== prevDataFetchSignalRef.current;
    
    prevEffectiveUserIdRef.current = effectiveUserId;
    prevDataFetchSignalRef.current = dataFetchSignal;
    
    // Fetch if: signal changed, login transition, or effectiveUserId changed
    if (!mountedRef.current) return;
    
    if (signalChanged || isLoginTransition || effectiveUserId) {
      console.log('[AppContext] Triggering full data fetch — signal:', dataFetchSignal, 'userId:', effectiveUserId, 'loginTransition:', isLoginTransition, 'signalChanged:', signalChanged);
      backgroundSync(effectiveUserId, isLoginTransition || signalChanged).catch(() => {});
    }

    return () => {};
  }, [effectiveUserId, isDemoMode, dataFetchSignal]);




  // Background sync function - completely non-blocking, all errors caught
  // When isLoginTransition is true, always replace state even with empty arrays
  const backgroundSync = async (userId?: string, isLoginTransition: boolean = false) => {

    if (!mountedRef.current) return;
    
    const isAuthenticated = !!userId;
    const syncLogId = dbLogger.logStart('backgroundSync', 'sync', undefined, userId ? `user: ${userId}` : 'anonymous');
    const syncStart = performance.now();
    
    try {
      // Fetch all data from database directly - no hasData check needed
      const emptyChecklists = { preRun: [] as ChecklistItem[], betweenRounds: [] as ChecklistItem[], postRun: [] as ChecklistItem[] };
      
      const safeFetch = async <T,>(promise: Promise<T>, fallback: T, tableName: string): Promise<T> => {
        const fetchLogId = dbLogger.logStart(`fetch ${tableName}`, 'read', tableName);
        const fetchStart = performance.now();
        try {
          const result = await Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 8000))
          ]);
          dbLogger.logSuccess(fetchLogId, Math.round(performance.now() - fetchStart), Array.isArray(result) ? `${result.length} rows` : 'OK');

          return result;
        } catch (err) {
          dbLogger.logError(fetchLogId, err instanceof Error ? err.message : String(err), Math.round(performance.now() - fetchStart));
          return fallback;
        }
      };

      const [
        dbEngines, dbSuperchargers, dbCylinderHeads, dbMaintenanceItems,
        dbSFICertifications, dbPassLogs, dbEngineSwapLogs,
        dbChecklists, dbPartsInventory, dbTrackWeatherHistory,
        dbRaceEvents, dbTeamMembers, dbSavedTracks
      ] = await Promise.all([
        safeFetch(db.fetchEngines(userId), [] as Engine[], 'engines'),
        safeFetch(db.fetchSuperchargers(userId), [] as Supercharger[], 'superchargers'),
        safeFetch(db.fetchCylinderHeads(userId), [] as CylinderHead[], 'cylinder_heads'),
        safeFetch(db.fetchMaintenanceItems(userId), [] as MaintenanceItem[], 'maintenance_items'),
        safeFetch(db.fetchSFICertifications(userId), [] as SFICertification[], 'sfi_certifications'),
        safeFetch(db.fetchPassLogs(userId), [] as PassLogEntry[], 'pass_logs'),
        safeFetch(db.fetchEngineSwapLogs(userId), [] as EngineSwapLog[], 'engine_swap_logs'),
        safeFetch(db.fetchChecklists(userId), emptyChecklists, 'checklists'),
        safeFetch(db.fetchPartsInventory(userId), [] as PartInventoryItem[], 'parts_inventory'),
        safeFetch(db.fetchTrackWeatherHistory(userId), [] as TrackWeatherHistory[], 'track_weather_history'),
        safeFetch(db.fetchRaceEvents(userId), [] as RaceEvent[], 'race_events'),
        safeFetch(db.fetchTeamMembers(userId), [] as TeamMember[], 'team_members'),
        safeFetch(db.fetchSavedTracks(userId), [] as SavedTrack[], 'saved_tracks')
      ]);
      
      if (!mountedRef.current) return;
      
      // ═══════════════════════════════════════════════════════════════
      // MERGE STRATEGY: For data types that support optimistic adds,
      // merge DB data with any local-only items (items added optimistically
      // that may not have been persisted to DB yet). This prevents newly
      // added items from "disappearing" when a background sync replaces
      // state with DB data that doesn't yet include the pending item.
      //
      // The merge works by: starting with DB data, then appending any
      // local items whose IDs are NOT in the DB result set.
      // ═══════════════════════════════════════════════════════════════
      const mergeWithLocal = <T extends { id: string }>(dbItems: T[], localItems: T[]): T[] => {
        if (dbItems.length === 0 && localItems.length === 0) return [];
        if (dbItems.length === 0) return localItems; // keep local items if DB returned nothing
        const dbIds = new Set(dbItems.map(item => item.id));
        const localOnly = localItems.filter(item => !dbIds.has(item.id));
        if (localOnly.length > 0) {
          console.log(`[backgroundSync] Merging ${localOnly.length} local-only item(s) with ${dbItems.length} DB item(s)`);
        }
        return [...dbItems, ...localOnly];
      };

      // For authenticated users (or login transitions): always replace state with DB data
      // For unauthenticated: only replace if DB returned data (keeps sample data as fallback)
      if (isAuthenticated || isLoginTransition) {
        // Always set — even empty arrays — so user sees their real data
        // BUT merge maintenance items to preserve optimistic adds
        setEngines(dbEngines.length > 0 ? dbEngines : []);
        setSuperchargers(dbSuperchargers.length > 0 ? dbSuperchargers : []);
        setCylinderHeads(dbCylinderHeads.length > 0 ? dbCylinderHeads : []);
        setMaintenanceItems(prev => mergeWithLocal(dbMaintenanceItems, prev));
        setSFICertifications(prev => mergeWithLocal(dbSFICertifications, prev));
        setPassLogs(prev => mergeWithLocal(dbPassLogs, prev));



        setEngineSwapLogs(dbEngineSwapLogs.length > 0 ? dbEngineSwapLogs : []);
        setPreRunChecklist(dbChecklists.preRun.length > 0 ? dbChecklists.preRun : []);
        setBetweenRoundsChecklist(dbChecklists.betweenRounds.length > 0 ? dbChecklists.betweenRounds : []);
        setPostRunChecklist(dbChecklists.postRun.length > 0 ? dbChecklists.postRun : []);
        setPartsInventory(dbPartsInventory.length > 0 ? dbPartsInventory : []);
        setTrackWeatherHistory(dbTrackWeatherHistory.length > 0 ? dbTrackWeatherHistory : []);
      } else {
        // Unauthenticated: only overwrite if DB has data (preserve sample data)
        if (dbEngines.length > 0) setEngines(dbEngines);
        if (dbSuperchargers.length > 0) setSuperchargers(dbSuperchargers);
        if (dbCylinderHeads.length > 0) setCylinderHeads(dbCylinderHeads);
        if (dbMaintenanceItems.length > 0) setMaintenanceItems(prev => mergeWithLocal(dbMaintenanceItems, prev));
        if (dbSFICertifications.length > 0) setSFICertifications(prev => mergeWithLocal(dbSFICertifications, prev));
        if (dbPassLogs.length > 0) setPassLogs(prev => {
          const dbIds = new Set(dbPassLogs.map(item => item.id));
          const localOnly = prev.filter(item => !dbIds.has(item.id));
          return localOnly.length > 0 ? [...dbPassLogs, ...localOnly] : dbPassLogs;
        });



        if (dbEngineSwapLogs.length > 0) setEngineSwapLogs(dbEngineSwapLogs);
        if (dbChecklists.preRun.length > 0) setPreRunChecklist(dbChecklists.preRun);
        if (dbChecklists.betweenRounds.length > 0) setBetweenRoundsChecklist(dbChecklists.betweenRounds);
        if (dbChecklists.postRun.length > 0) setPostRunChecklist(dbChecklists.postRun);
        if (dbPartsInventory.length > 0) setPartsInventory(dbPartsInventory);
        if (dbTrackWeatherHistory.length > 0) setTrackWeatherHistory(dbTrackWeatherHistory);
      }

      // These three always replace (they start empty, no sample data)
      setRaceEvents(dbRaceEvents);
      setTeamMembers(dbTeamMembers);
      setSavedTracks(dbSavedTracks);

      // ─── DEBUG: Log data counts after fetch ─────────────────────
      console.log('[AppContext backgroundSync] Data counts after fetch:', {
        engines: dbEngines.length,
        superchargers: dbSuperchargers.length,
        cylinderHeads: dbCylinderHeads.length,
        maintenanceItems: dbMaintenanceItems.length,
        sfiCertifications: dbSFICertifications.length,
        passLogs: dbPassLogs.length,


        engineSwapLogs: dbEngineSwapLogs.length,
        partsInventory: dbPartsInventory.length,
        trackWeatherHistory: dbTrackWeatherHistory.length,
        raceEvents: dbRaceEvents.length,
        teamMembers: dbTeamMembers.length,
        savedTracks: dbSavedTracks.length,
        isAuthenticated,
        isLoginTransition,
        userId
      });

      // Fetch drivetrain components and swap logs separately (non-blocking)
      safeFetch(db.fetchDrivetrainComponents(userId), [] as DrivetrainComponent[], 'drivetrain_components').then(dbDT => {
        if (mountedRef.current) setDrivetrainComponents(dbDT);
      });
      safeFetch(db.fetchDrivetrainSwapLogs(userId), [] as DrivetrainSwapLog[], 'drivetrain_swap_logs').then(dbDTSwaps => {
        if (mountedRef.current) setDrivetrainSwapLogs(dbDTSwaps);
      });
      // Fetch vendors separately (non-blocking)
      safeFetch(db.fetchVendors(userId), [] as VendorRecord[], 'setup_vendors').then(dbVendors => {
        if (mountedRef.current) setVendors(dbVendors);
      });

      // Fetch tire tracking data separately (non-blocking)
      safeFetch(db.fetchTireSets(userId), [] as TireSet[], 'tire_sets').then(d => { if (mountedRef.current) setTireSets(d); });
      safeFetch(db.fetchTreadDepth(userId), [] as TreadDepthEntry[], 'tire_tread_depth').then(d => { if (mountedRef.current) setTreadDepth(d); });
      safeFetch(db.fetchTirePressureHistory(userId), [] as TirePressureEntry[], 'tire_pressure_history').then(d => { if (mountedRef.current) setPressureHistory(d); });
      safeFetch(db.fetchTireChangeLog(userId), [] as TireChangeLog[], 'tire_change_log').then(d => { if (mountedRef.current) setTireChangeLog(d); });
      // Also keep localStorage in sync for the module-level pass increment helpers
      safeFetch(db.fetchTireSets(userId), [] as TireSet[], 'tire_sets_ls_sync').then(d => {
        if (d.length > 0) { try { localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(d)); } catch {} }
      });
      setLastSyncTime(new Date());


      
      dbLogger.logSuccess(syncLogId, Math.round(performance.now() - syncStart), 'All data fetched successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      dbLogger.logError(syncLogId, msg, Math.round(performance.now() - syncStart));
      console.warn('Background sync failed (non-blocking):', error);
    }
  };



  // Refresh data from database (manual trigger)
  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    
    const refreshLogId = dbLogger.logStart('refreshData (manual)', 'sync', undefined, 'Manual refresh triggered');
    const refreshStart = performance.now();
    
    try {
      // Use effectiveUserId for team-aware data fetching
      const userId = effectiveUserId || user?.id;

      const emptyChecklists = { preRun: [] as ChecklistItem[], betweenRounds: [] as ChecklistItem[], postRun: [] as ChecklistItem[] };
      
      const safeFetch = async <T,>(promise: Promise<T>, fallback: T, tableName: string): Promise<T> => {
        const fetchLogId = dbLogger.logStart(`refresh ${tableName}`, 'read', tableName);
        const fetchStart = performance.now();
        try {
          const result = await Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 8000))
          ]);
          dbLogger.logSuccess(fetchLogId, Math.round(performance.now() - fetchStart), Array.isArray(result) ? `${result.length} rows` : 'OK');

          return result;
        } catch (err) {
          dbLogger.logError(fetchLogId, err instanceof Error ? err.message : String(err), Math.round(performance.now() - fetchStart));
          return fallback;
        }
      };

      const [
        dbEngines, dbSuperchargers, dbCylinderHeads, dbMaintenanceItems,
        dbSFICertifications, dbPassLogs, dbEngineSwapLogs,
        dbChecklists, dbPartsInventory, dbTrackWeatherHistory,
        dbRaceEvents, dbTeamMembers, dbSavedTracks
      ] = await Promise.all([
        safeFetch(db.fetchEngines(userId), [] as Engine[], 'engines'),
        safeFetch(db.fetchSuperchargers(userId), [] as Supercharger[], 'superchargers'),
        safeFetch(db.fetchCylinderHeads(userId), [] as CylinderHead[], 'cylinder_heads'),
        safeFetch(db.fetchMaintenanceItems(userId), [] as MaintenanceItem[], 'maintenance_items'),
        safeFetch(db.fetchSFICertifications(userId), [] as SFICertification[], 'sfi_certifications'),
        safeFetch(db.fetchPassLogs(userId), [] as PassLogEntry[], 'pass_logs'),
        safeFetch(db.fetchEngineSwapLogs(userId), [] as EngineSwapLog[], 'engine_swap_logs'),
        safeFetch(db.fetchChecklists(userId), emptyChecklists, 'checklists'),
        safeFetch(db.fetchPartsInventory(userId), [] as PartInventoryItem[], 'parts_inventory'),
        safeFetch(db.fetchTrackWeatherHistory(userId), [] as TrackWeatherHistory[], 'track_weather_history'),
        safeFetch(db.fetchRaceEvents(userId), [] as RaceEvent[], 'race_events'),
        safeFetch(db.fetchTeamMembers(userId), [] as TeamMember[], 'team_members'),
        safeFetch(db.fetchSavedTracks(userId), [] as SavedTrack[], 'saved_tracks')
      ]);

      
      
      if (dbEngines.length > 0) setEngines(dbEngines);
      if (dbSuperchargers.length > 0) setSuperchargers(dbSuperchargers);
      if (dbCylinderHeads.length > 0) setCylinderHeads(dbCylinderHeads);
      // Use merge strategy for maintenance items and SFI certs to preserve optimistic adds
      if (dbMaintenanceItems.length > 0) {
        setMaintenanceItems(prev => {
          const dbIds = new Set(dbMaintenanceItems.map(item => item.id));
          const localOnly = prev.filter(item => !dbIds.has(item.id));
          return localOnly.length > 0 ? [...dbMaintenanceItems, ...localOnly] : dbMaintenanceItems;
        });
      }
      if (dbSFICertifications.length > 0) {
        setSFICertifications(prev => {
          const dbIds = new Set(dbSFICertifications.map(item => item.id));
          const localOnly = prev.filter(item => !dbIds.has(item.id));
          return localOnly.length > 0 ? [...dbSFICertifications, ...localOnly] : dbSFICertifications;
        });
      }
      // Use merge strategy for pass logs to preserve optimistic adds and local-only entries
      if (dbPassLogs.length > 0) {
        setPassLogs(prev => {
          const dbIds = new Set(dbPassLogs.map(item => item.id));
          const localOnly = prev.filter(item => !dbIds.has(item.id));
          return localOnly.length > 0 ? [...dbPassLogs, ...localOnly] : dbPassLogs;
        });
      }




      if (dbEngineSwapLogs.length > 0) setEngineSwapLogs(dbEngineSwapLogs);
      if (dbChecklists.preRun.length > 0) setPreRunChecklist(dbChecklists.preRun);
      if (dbChecklists.betweenRounds.length > 0) setBetweenRoundsChecklist(dbChecklists.betweenRounds);
      if (dbChecklists.postRun.length > 0) setPostRunChecklist(dbChecklists.postRun);
      if (dbPartsInventory.length > 0) setPartsInventory(dbPartsInventory);
      if (dbTrackWeatherHistory.length > 0) setTrackWeatherHistory(dbTrackWeatherHistory);
      setRaceEvents(dbRaceEvents);
      setTeamMembers(dbTeamMembers);
      setSavedTracks(dbSavedTracks);
      // Also refresh drivetrain components
      safeFetch(db.fetchDrivetrainComponents(userId), [] as DrivetrainComponent[], 'drivetrain_components').then(dbDT => {
        if (mountedRef.current) setDrivetrainComponents(dbDT);
      });
      // Also refresh vendors (was previously missing from manual refreshData)
      safeFetch(db.fetchVendors(userId), [] as VendorRecord[], 'setup_vendors').then(dbVendors => {
        if (mountedRef.current) setVendors(dbVendors);
      });
      setLastSyncTime(new Date());


      
      dbLogger.logSuccess(refreshLogId, Math.round(performance.now() - refreshStart), 'All data refreshed');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to refresh data';
      dbLogger.logError(refreshLogId, msg, Math.round(performance.now() - refreshStart));
      console.error('Error refreshing data:', error);
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id]);


  // Pass Log actions
  // ============ AUTO-INCREMENT ALL INSTALLED COMPONENTS ON PASS SAVE ============
  // When a pass is saved from the Pass Log, automatically and silently update
  // passCount, totalPasses, passesSinceRebuild/Service/Refresh on EVERY currently
  // installed component for that car — engines, power adders, cylinder heads,
  // drivetrain — including all sub-components. Then check service intervals and
  // flag anything due or overdue. The user never has to manually update component
  // pass counts; saving a pass log entry triggers everything automatically.
  const addPassLog = useCallback(async (pass: PassLogEntry) => {
    const userId = user?.id;
    // Single-car app — no car_id filtering needed. Update ALL installed components.


    // Helper: increment sub-component pass counts and auto-flag status
    const bumpSubComponents = (comps: Record<string, ComponentTracker> | undefined): Record<string, ComponentTracker> | undefined => {
      if (!comps) return comps;
      const updated: Record<string, ComponentTracker> = {};
      for (const [key, comp] of Object.entries(comps)) {
        const newPassCount = (comp.passCount || 0) + 1;
        let newStatus: ComponentTracker['status'] = comp.status || 'Good';
        if (comp.replaceInterval > 0 && newPassCount >= comp.replaceInterval) {
          newStatus = 'Replace';
        } else if (comp.serviceInterval > 0 && newPassCount >= comp.serviceInterval) {
          newStatus = 'Service';
        } else if (comp.inspectionInterval > 0 && newPassCount >= comp.inspectionInterval) {
          newStatus = 'Inspect';
        }
        updated[key] = { ...comp, passCount: newPassCount, status: newStatus };
      }
      return updated;
    };

    // Capture previous maintenance items state BEFORE incrementing (for threshold crossing detection)
    const previousMaintenanceItems = maintenanceItems.map(m => ({ ...m }));

    // 1. Add pass to state
    setPassLogs(prev => [pass, ...prev]);

    // 2. Update ALL installed engines for this car (not just the one in the pass form)
    //    Increment totalPasses, passesSinceRebuild, and bump all sub-component pass counts
    const enginesToPersist: Engine[] = [];

    setEngines(prev => prev.map(e => {
      if (e.currentlyInstalled) {
        const updated: Engine = {
          ...e,
          totalPasses: e.totalPasses + 1,
          passesSinceRebuild: e.passesSinceRebuild + 1,
          components: bumpSubComponents(e.components) as any
        };
        enginesToPersist.push(updated);
        return updated;
      }
      return e;
    }));


    const scsToPersist: Supercharger[] = [];
    setSuperchargers(prev => prev.map(s => {
      if (s.currentlyInstalled) {
        const updated: Supercharger = {
          ...s,
          totalPasses: s.totalPasses + 1,
          passesSinceService: s.passesSinceService + 1,
        };
        scsToPersist.push(updated);
        return updated;
      }
      return s;
    }));

    // 4. Update ALL active cylinder heads
    const headsToPersist: CylinderHead[] = [];
    setCylinderHeads(prev => prev.map(h => {
      if (h.status === 'Active') {
        const updated: CylinderHead = {
          ...h,
          totalPasses: h.totalPasses + 1,
          passesSinceRefresh: h.passesSinceRefresh + 1,
          components: bumpSubComponents(h.components) as any
        };
        headsToPersist.push(updated);
        return updated;
      }
      return h;
    }));

    // 5. Update ALL installed drivetrain components
    const dtToPersist: DrivetrainComponent[] = [];
    setDrivetrainComponents(prev => prev.map(d => {
      if (d.currentlyInstalled) {
        const updated: DrivetrainComponent = {
          ...d,
          totalPasses: d.totalPasses + 1,
          passesSinceService: d.passesSinceService + 1,
          components: bumpSubComponents(d.components) as any
        };
        dtToPersist.push(updated);
        return updated;
      }
      return d;
    }));

    // 5b. Update ALL active tire sets (localStorage-based, managed by TireTracking)
    //     Tire sets are not in React state here — they live in localStorage.
    //     Increment totalPasses on every Active tire set and notify TireTracking via custom event.
    const { updatedCount: tireIncrementedCount } = incrementActiveTireSets(1);
    if (tireIncrementedCount > 0) {
      window.dispatchEvent(new CustomEvent('tire-sets-passes-updated', { detail: { increment: 1 } }));
      console.log(`[addPassLog] Auto-incremented ${tireIncrementedCount} active tire set(s)`);
    }

    // 6. Update ALL maintenance items (single-car app — update everything)

    const updatedMaintenanceItems = maintenanceItems.map(m => {
      const newPasses = m.currentPasses + 1;
      const updatedItem: MaintenanceItem = {
        ...m,
        currentPasses: newPasses,
      };
      updatedItem.status = calculateMaintenanceStatus(updatedItem);
      return updatedItem;
    });
    setMaintenanceItems(updatedMaintenanceItems);

    // 7. Count what was updated and collect flagged sub-components for toast
    const totalUpdated = enginesToPersist.length + scsToPersist.length + headsToPersist.length + dtToPersist.length;
    let flaggedCount = 0;
    const collectFlags = (comps: Record<string, ComponentTracker> | undefined) => {
      if (!comps) return;
      for (const comp of Object.values(comps)) {
        if (comp.status === 'Service' || comp.status === 'Replace' || comp.status === 'Inspect') {
          flaggedCount++;
        }
      }
    };
    enginesToPersist.forEach(e => collectFlags(e.components));
    headsToPersist.forEach(h => collectFlags(h.components));
    dtToPersist.forEach(d => collectFlags(d.components));

    // 8. Show a single summary toast if components were flagged
    if (totalUpdated > 0 && flaggedCount > 0) {
      toast.warning(
        `Pass logged — ${flaggedCount} sub-component${flaggedCount !== 1 ? 's' : ''} now due for service`,
        { description: `${totalUpdated} installed component${totalUpdated !== 1 ? 's' : ''} updated automatically`, duration: 6000 }
      );
    } else if (totalUpdated > 0) {
      console.log(`[addPassLog] Auto-updated ${totalUpdated} installed components`);
    }


    // 9. Automatic maintenance alert notifications (existing logic)
    try {
      const alertSettings = loadAlertSettings();
      if (alertSettings.enabled && alertSettings.showToastNotifications) {
        const newAlerts = checkNewlyTriggeredAlerts(previousMaintenanceItems, updatedMaintenanceItems, alertSettings);
        
        for (const alert of newAlerts) {
          const remaining = alert.remainingPasses;
          
          if (alert.threshold.severity === 'critical') {
            toast.error(`${alert.component} — ${alert.threshold.label}`, {
              description: `${alert.category} | ${alert.currentPasses}/${alert.nextServicePasses} passes (${remaining} remaining)`,
              duration: 8000,
            });
          } else if (alert.threshold.severity === 'warning') {
            toast.warning(`${alert.component} — ${alert.threshold.label}`, {
              description: `${alert.category} | ${alert.percentUsed}% of interval used (${remaining} passes left)`,
              duration: 6000,
            });
          } else {
            toast.info(`${alert.component} — ${alert.threshold.label}`, {
              description: `${alert.category} | ${alert.percentUsed}% of interval used (${remaining} passes left)`,
              duration: 5000,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AppContext] Error checking maintenance alerts:', err);
    }
    
    // 10. Persist pass log to database
    await trackSave(() => db.upsertPassLog(pass, userId), 'addPassLog', { type: 'upsertPassLog', data: pass });

    // 11. Persist all updated components to database silently in background
    //     These fire-and-forget so the pass save doesn't block on component persistence
    for (const eng of enginesToPersist) {
      trackSave(() => db.upsertEngine(eng, userId), 'autoUpdateEngine').catch(() => {});
    }
    for (const sc of scsToPersist) {
      trackSave(() => db.upsertSupercharger(sc, userId), 'autoUpdateSupercharger').catch(() => {});
    }
    for (const head of headsToPersist) {
      trackSave(() => db.upsertCylinderHead(head, userId), 'autoUpdateCylinderHead').catch(() => {});
    }
    for (const dt of dtToPersist) {
      trackSave(() => db.upsertDrivetrainComponent(dt, userId), 'autoUpdateDrivetrain').catch(() => {});
    }
    // Also persist updated maintenance items
    for (const m of updatedMaintenanceItems) {
      const prev = previousMaintenanceItems.find(p => p.id === m.id);
      if (prev && prev.currentPasses !== m.currentPasses) {
        trackSave(() => db.upsertMaintenanceItem(m, userId), 'autoUpdateMaintenance').catch(() => {});
      }
    }
  }, [user?.id, trackSave, maintenanceItems, engines, superchargers, cylinderHeads, drivetrainComponents]);




  const updatePassLog = useCallback(async (id: string, pass: Partial<PassLogEntry>) => {
    let mergedItem: PassLogEntry | null = null;
    setPassLogs(prev => prev.map(p => {
      if (p.id === id) { mergedItem = { ...p, ...pass }; return mergedItem; }
      return p;
    }));
    if (mergedItem) await trackSave(() => db.upsertPassLog(mergedItem!, user?.id), 'updatePassLog', { type: 'upsertPassLog', data: mergedItem });
  }, [user?.id, trackSave]);

  // ============ SOFT-DELETE WITH UNDO FOR PASS LOGS ============
  // When a pass is deleted, DECREMENT all pass-count-driven items:
  //   - Engines (totalPasses, passesSinceRebuild, sub-components)
  //   - Superchargers (totalPasses, passesSinceService)
  //   - Cylinder Heads (totalPasses, passesSinceRefresh, sub-components)
  //   - Drivetrain Components (totalPasses, passesSinceService, sub-components)
  //   - Maintenance Items (currentPasses, recalculate status)
  //   - Standalone Parts (DB, localStorage, custom event)
  // On Undo: restore the pass AND re-increment everything.
  const deletePassLogAction = useCallback(async (id: string) => {
    let itemToDelete: PassLogEntry | null = null;
    setPassLogs(prev => {
      itemToDelete = prev.find(p => p.id === id) || null;
      return prev.filter(p => p.id !== id);
    });
    if (!itemToDelete) return;
    const captured = { ...itemToDelete } as PassLogEntry;
    const userId = user?.id;

    // ═══════════════════════════════════════════════════════════════
    // HELPER: Decrement sub-component pass counts (reverse of bumpSubComponents)
    // ═══════════════════════════════════════════════════════════════
    const decrementSubComponents = (comps: Record<string, ComponentTracker> | undefined): Record<string, ComponentTracker> | undefined => {
      if (!comps) return comps;
      const updated: Record<string, ComponentTracker> = {};
      for (const [key, comp] of Object.entries(comps)) {
        const newPassCount = Math.max(0, (comp.passCount || 0) - 1);
        let newStatus: ComponentTracker['status'] = comp.status || 'Good';
        if (comp.replaceInterval > 0 && newPassCount >= comp.replaceInterval) {
          newStatus = 'Replace';
        } else if (comp.serviceInterval > 0 && newPassCount >= comp.serviceInterval) {
          newStatus = 'Service';
        } else if (comp.inspectionInterval > 0 && newPassCount >= comp.inspectionInterval) {
          newStatus = 'Inspect';
        } else {
          newStatus = 'Good';
        }
        updated[key] = { ...comp, passCount: newPassCount, status: newStatus };
      }
      return updated;
    };

    // ═══════════════════════════════════════════════════════════════
    // CAPTURE PRE-DECREMENT SNAPSHOTS (for undo)
    // ═══════════════════════════════════════════════════════════════
    const preDecrementEngines = engines.filter(e => e.currentlyInstalled).map(e => ({ ...e, components: e.components ? { ...e.components } : undefined }));
    const preDecrementSuperchargers = superchargers.filter(s => s.currentlyInstalled).map(s => ({ ...s }));
    const preDecrementCylinderHeads = cylinderHeads.filter(h => h.status === 'Active').map(h => ({ ...h, components: h.components ? { ...h.components } : undefined }));
    const preDecrementDrivetrain = drivetrainComponents.filter(d => d.currentlyInstalled).map(d => ({ ...d, components: d.components ? { ...d.components } : undefined }));
    const preDecrementMaintenance = maintenanceItems.map(m => ({ ...m }));
    // Capture pre-decrement tire sets snapshot from localStorage (for undo)
    let preDecrementTireSetsSnapshot: TireSetLS[] = [];
    try {
      const raw = localStorage.getItem(TIRE_SETS_LS_KEY);
      if (raw) preDecrementTireSetsSnapshot = JSON.parse(raw) || [];
    } catch {}


    // ═══════════════════════════════════════════════════════════════
    // DECREMENT ALL INSTALLED ENGINES
    // ═══════════════════════════════════════════════════════════════
    const enginesToPersist: Engine[] = [];
    setEngines(prev => prev.map(e => {
      if (e.currentlyInstalled) {
        const updated: Engine = {
          ...e,
          totalPasses: Math.max(0, e.totalPasses - 1),
          passesSinceRebuild: Math.max(0, e.passesSinceRebuild - 1),
          components: decrementSubComponents(e.components) as any
        };
        enginesToPersist.push(updated);
        return updated;
      }
      return e;
    }));

    // ═══════════════════════════════════════════════════════════════
    // DECREMENT ALL INSTALLED SUPERCHARGERS
    // ═══════════════════════════════════════════════════════════════
    const scsToPersist: Supercharger[] = [];
    setSuperchargers(prev => prev.map(s => {
      if (s.currentlyInstalled) {
        const updated: Supercharger = {
          ...s,
          totalPasses: Math.max(0, s.totalPasses - 1),
          passesSinceService: Math.max(0, s.passesSinceService - 1),
        };
        scsToPersist.push(updated);
        return updated;
      }
      return s;
    }));

    // ═══════════════════════════════════════════════════════════════
    // DECREMENT ALL ACTIVE CYLINDER HEADS
    // ═══════════════════════════════════════════════════════════════
    const headsToPersist: CylinderHead[] = [];
    setCylinderHeads(prev => prev.map(h => {
      if (h.status === 'Active') {
        const updated: CylinderHead = {
          ...h,
          totalPasses: Math.max(0, h.totalPasses - 1),
          passesSinceRefresh: Math.max(0, h.passesSinceRefresh - 1),
          components: decrementSubComponents(h.components) as any
        };
        headsToPersist.push(updated);
        return updated;
      }
      return h;
    }));

    // ═══════════════════════════════════════════════════════════════
    // DECREMENT ALL INSTALLED DRIVETRAIN COMPONENTS
    // ═══════════════════════════════════════════════════════════════
    const dtToPersist: DrivetrainComponent[] = [];
    setDrivetrainComponents(prev => prev.map(d => {
      if (d.currentlyInstalled) {
        const updated: DrivetrainComponent = {
          ...d,
          totalPasses: Math.max(0, d.totalPasses - 1),
          passesSinceService: Math.max(0, d.passesSinceService - 1),
          components: decrementSubComponents(d.components) as any
        };
        dtToPersist.push(updated);
        return updated;
      }
      return d;
    }));

    // ═══════════════════════════════════════════════════════════════
    // DECREMENT ALL ACTIVE TIRE SETS (localStorage-based)
    // ═══════════════════════════════════════════════════════════════
    const { updatedCount: tireDecrementedCount } = incrementActiveTireSets(-1);
    if (tireDecrementedCount > 0) {
      window.dispatchEvent(new CustomEvent('tire-sets-passes-updated', { detail: { increment: -1 } }));
      console.log(`[deletePassLog] Decremented ${tireDecrementedCount} active tire set(s)`);
    }


    // ═══════════════════════════════════════════════════════════════
    // DECREMENT MAINTENANCE ITEMS
    // ═══════════════════════════════════════════════════════════════
    const maintToPersist: MaintenanceItem[] = [];
    setMaintenanceItems(prev => prev.map(m => {
      const newPasses = Math.max(0, m.currentPasses - 1);
      if (newPasses !== m.currentPasses) {
        const updated: MaintenanceItem = { ...m, currentPasses: newPasses };
        updated.status = calculateMaintenanceStatus(updated);
        maintToPersist.push(updated);
        return updated;
      }
      return m;
    }));

    // ═══════════════════════════════════════════════════════════════
    // DECREMENT STANDALONE PARTS (DB + localStorage + custom event)
    // ═══════════════════════════════════════════════════════════════
    const allInstalledComponentIds = [
      ...engines.filter(e => e.currentlyInstalled).map(e => e.id),
      ...superchargers.filter(s => s.currentlyInstalled).map(s => s.id),
      ...drivetrainComponents.filter(d => d.currentlyInstalled).map(d => d.id),
    ];

    if (allInstalledComponentIds.length > 0) {
      // 1. DB: decrement standalone parts for each installed component
      for (const compId of allInstalledComponentIds) {
        db.bulkIncrementComponentPartPasses(compId, -1).catch(err =>
          console.warn('[deletePassLog] standalone parts DB decrement failed:', err)
        );
      }
      // 2. Custom event: notify MainComponents to update local state
      window.dispatchEvent(new CustomEvent('component-parts-incremented', {
        detail: { componentIds: allInstalledComponentIds, increment: -1 }
      }));
      // 3. localStorage fallback: update directly
      try {
        const PARTS_FALLBACK_KEY = 'mainComp_parts_db_fallback';
        const raw = localStorage.getItem(PARTS_FALLBACK_KEY);
        if (raw) {
          const parts: ComponentPart[] = JSON.parse(raw);
          if (Array.isArray(parts) && parts.length > 0) {
            const updatedParts = parts.map(p => {
              if (allInstalledComponentIds.includes(p.componentId)) {
                return { ...p, passesOnPart: Math.max(0, (p.passesOnPart || 0) - 1) };
              }
              return p;
            });
            localStorage.setItem(PARTS_FALLBACK_KEY, JSON.stringify(updatedParts));
          }
        }
      } catch (err) {
        console.warn('[deletePassLog] localStorage parts fallback update failed:', err);
      }
      console.log(`[deletePassLog] Decremented standalone parts for ${allInstalledComponentIds.length} installed component(s)`);
    }

    const totalDecremented = enginesToPersist.length + scsToPersist.length + headsToPersist.length + dtToPersist.length + maintToPersist.length;
    console.log(`[deletePassLog] Decremented ${totalDecremented} pass-count-driven items for pass ${id}`);

    // ═══════════════════════════════════════════════════════════════
    // UNDO / HARD-DELETE MECHANISM
    // ═══════════════════════════════════════════════════════════════
    const existing = pendingPassLogDeletesRef.current.get(id);
    if (existing) { clearTimeout(existing.timeoutId); toast.dismiss(existing.toastId); pendingPassLogDeletesRef.current.delete(id); }

    const timeoutId = setTimeout(() => {
      const pending = pendingPassLogDeletesRef.current.get(id);
      if (!pending) return;
      pendingPassLogDeletesRef.current.delete(id);
      // Hard-delete the pass from DB
      trackSave(() => db.deletePassLog(id), 'deletePassLog', { type: 'deletePassLog', data: id });
      // Persist all decremented components to DB
      for (const eng of enginesToPersist) {
        trackSave(() => db.upsertEngine(eng, userId), 'autoDecrementEngine').catch(() => {});
      }
      for (const sc of scsToPersist) {
        trackSave(() => db.upsertSupercharger(sc, userId), 'autoDecrementSupercharger').catch(() => {});
      }
      for (const head of headsToPersist) {
        trackSave(() => db.upsertCylinderHead(head, userId), 'autoDecrementCylinderHead').catch(() => {});
      }
      for (const dt of dtToPersist) {
        trackSave(() => db.upsertDrivetrainComponent(dt, userId), 'autoDecrementDrivetrain').catch(() => {});
      }
      for (const m of maintToPersist) {
        trackSave(() => db.upsertMaintenanceItem(m, userId), 'autoDecrementMaintenance').catch(() => {});
      }
      console.log(`[deletePassLog] Hard delete executed for pass ${id} — ${totalDecremented} components persisted`);
    }, UNDO_DELETE_WINDOW_MS);

    const toastId = toast(`Pass deleted — ${captured.date} at ${captured.track}`, {
      description: `${captured.eighth?.toFixed(3) || '—'} ET / ${captured.mph?.toFixed(1) || '—'} MPH — all component passes reduced. Click Undo within 10s to restore`,
      duration: UNDO_DELETE_WINDOW_MS + 500,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingPassLogDeletesRef.current.get(id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingPassLogDeletesRef.current.delete(id);

            // ═══════════════════════════════════════════════════════
            // RESTORE PASS
            // ═══════════════════════════════════════════════════════
            setPassLogs(prev => prev.some(p => p.id === id) ? prev : [captured, ...prev]);

            // ═══════════════════════════════════════════════════════
            // RE-INCREMENT ALL COMPONENTS (restore pre-decrement state)
            // ═══════════════════════════════════════════════════════
            setEngines(prev => prev.map(e => {
              const pre = preDecrementEngines.find(pe => pe.id === e.id);
              return pre ? { ...e, totalPasses: pre.totalPasses, passesSinceRebuild: pre.passesSinceRebuild, components: pre.components } as Engine : e;
            }));
            setSuperchargers(prev => prev.map(s => {
              const pre = preDecrementSuperchargers.find(ps => ps.id === s.id);
              return pre ? { ...s, totalPasses: pre.totalPasses, passesSinceService: pre.passesSinceService } as Supercharger : s;
            }));
            setCylinderHeads(prev => prev.map(h => {
              const pre = preDecrementCylinderHeads.find(ph => ph.id === h.id);
              return pre ? { ...h, totalPasses: pre.totalPasses, passesSinceRefresh: pre.passesSinceRefresh, components: pre.components } as CylinderHead : h;
            }));
            setDrivetrainComponents(prev => prev.map(d => {
              const pre = preDecrementDrivetrain.find(pd => pd.id === d.id);
              return pre ? { ...d, totalPasses: pre.totalPasses, passesSinceService: pre.passesSinceService, components: pre.components } as DrivetrainComponent : d;
            }));
            setMaintenanceItems(preDecrementMaintenance);

            // ═══════════════════════════════════════════════════════
            // RESTORE TIRE SETS (localStorage-based)
            // ═══════════════════════════════════════════════════════
            if (preDecrementTireSetsSnapshot.length > 0) {
              restoreTireSetsFromSnapshot(preDecrementTireSetsSnapshot);
              window.dispatchEvent(new CustomEvent('tire-sets-passes-updated', { detail: { increment: 0, restored: true } }));
              console.log(`[deletePassLog Undo] Tire sets restored from pre-decrement snapshot`);
            }


            // ═══════════════════════════════════════════════════════
            // RE-INCREMENT STANDALONE PARTS
            // ═══════════════════════════════════════════════════════
            if (allInstalledComponentIds.length > 0) {
              // DB
              for (const compId of allInstalledComponentIds) {
                db.bulkIncrementComponentPartPasses(compId, 1).catch(() => {});
              }
              // Custom event for MainComponents
              window.dispatchEvent(new CustomEvent('component-parts-incremented', {
                detail: { componentIds: allInstalledComponentIds, increment: 1 }
              }));
              // localStorage fallback
              try {
                const PARTS_FALLBACK_KEY = 'mainComp_parts_db_fallback';
                const raw = localStorage.getItem(PARTS_FALLBACK_KEY);
                if (raw) {
                  const parts: ComponentPart[] = JSON.parse(raw);
                  if (Array.isArray(parts) && parts.length > 0) {
                    const updatedParts = parts.map(p => {
                      if (allInstalledComponentIds.includes(p.componentId)) {
                        return { ...p, passesOnPart: (p.passesOnPart || 0) + 1 };
                      }
                      return p;
                    });
                    localStorage.setItem(PARTS_FALLBACK_KEY, JSON.stringify(updatedParts));
                  }
                }
              } catch {}
            }

            toast.success('Pass restored — all component passes reverted', {
              description: `${captured.date} at ${captured.track} — ${totalDecremented} component(s) re-incremented`,
              duration: 4000
            });
            console.log(`[deletePassLog Undo] Pass ${id} restored, ${totalDecremented} components re-incremented`);
          }
        },
      },
    });
    pendingPassLogDeletesRef.current.set(id, { item: captured, timeoutId, toastId: toastId as string | number });
  }, [trackSave, user?.id, engines, superchargers, cylinderHeads, drivetrainComponents, maintenanceItems]);







  // Engine Swap action
  const performEngineSwap = useCallback(async (previousEngineId: string, newEngineId: string, reason: string, performedBy: string, notes: string) => {
    const userId = user?.id;
    const swapLog: EngineSwapLog = {
      id: `SWAP-${String(engineSwapLogs.length + 1).padStart(3, '0')}`,
      date: getLocalDateString(),
      time: new Date().toTimeString().slice(0, 5),
      previousEngineId, newEngineId, reason, performedBy, notes
    };
    setEngineSwapLogs(prev => [swapLog, ...prev]);
    setEngines(prev => prev.map(e => {
      if (e.id === previousEngineId) return { ...e, currentlyInstalled: false, status: 'Ready' as const };
      if (e.id === newEngineId) return { ...e, currentlyInstalled: true, status: 'Active' as const, installDate: swapLog.date };
      return e;
    }));
    await trackSave(() => db.insertEngineSwapLog(swapLog, userId), 'engineSwap');
  }, [engineSwapLogs.length, user?.id, trackSave]);

  // Update actions
  const updateEngine = useCallback(async (id: string, engine: Partial<Engine>) => {
    let mergedItem: Engine | null = null;
    setEngines(prev => prev.map(e => { if (e.id === id) { mergedItem = { ...e, ...engine }; return mergedItem; } return e; }));
    if (mergedItem) await trackSave(() => db.upsertEngine(mergedItem!, user?.id), 'updateEngine');
  }, [user?.id, trackSave]);

  const updateSupercharger = useCallback(async (id: string, sc: Partial<Supercharger>) => {
    let mergedItem: Supercharger | null = null;
    setSuperchargers(prev => prev.map(s => { if (s.id === id) { mergedItem = { ...s, ...sc }; return mergedItem; } return s; }));
    if (mergedItem) await trackSave(() => db.upsertSupercharger(mergedItem!, user?.id), 'updateSupercharger');
  }, [user?.id, trackSave]);

  const updateCylinderHead = useCallback(async (id: string, head: Partial<CylinderHead>) => {
    let mergedItem: CylinderHead | null = null;
    setCylinderHeads(prev => prev.map(h => { if (h.id === id) { mergedItem = { ...h, ...head }; return mergedItem; } return h; }));
    if (mergedItem) await trackSave(() => db.upsertCylinderHead(mergedItem!, user?.id), 'updateCylinderHead');
  }, [user?.id, trackSave]);

  const updateMaintenanceItem = useCallback(async (id: string, item: Partial<MaintenanceItem>) => {
    let mergedItem: MaintenanceItem | null = null;
    setMaintenanceItems(prev => prev.map(m => { if (m.id === id) { mergedItem = { ...m, ...item } as MaintenanceItem; return mergedItem; } return m; }));
    if (mergedItem) await trackSave(() => db.upsertMaintenanceItem(mergedItem!, user?.id), 'updateMaintenance');
  }, [user?.id, trackSave]);

  const updatePartInventory = useCallback(async (id: string, part: Partial<PartInventoryItem>) => {
    let mergedItem: PartInventoryItem | null = null;
    setPartsInventory(prev => prev.map(p => { if (p.id === id) { mergedItem = { ...p, ...part }; return mergedItem; } return p; }));
    if (mergedItem) await trackSave(() => db.upsertPartInventory(mergedItem!, user?.id), 'updatePartInventory');
  }, [user?.id, trackSave]);

  const updateTrackWeatherHistoryAction = useCallback(async (track: TrackWeatherHistory) => {
    setTrackWeatherHistory(prev => {
      const exists = prev.find(t => t.trackId === track.trackId);
      if (exists) return prev.map(t => t.trackId === track.trackId ? track : t);
      return [...prev, track];
    });
    await trackSave(() => db.upsertTrackWeatherHistory(track, user?.id), 'updateTrackWeather');
  }, [user?.id, trackSave]);

  // Checklist actions
  const toggleChecklistItem = useCallback(async (checklistType: 'preRun' | 'betweenRounds' | 'postRun', itemId: string) => {
    const setters = { preRun: setPreRunChecklist, betweenRounds: setBetweenRoundsChecklist, postRun: setPostRunChecklist };
    const lists = { preRun: preRunChecklist, betweenRounds: betweenRoundsChecklist, postRun: postRunChecklist };
    const item = lists[checklistType].find(i => i.id === itemId);
    const newCompleted = item ? !item.completed : false;
    setters[checklistType](prev => prev.map(i => 
      i.id === itemId ? { ...i, completed: newCompleted, checkedBy: newCompleted ? i.checkedBy : undefined, checkedAt: newCompleted ? i.checkedAt : undefined } : i
    ));
    await trackSave(() => db.updateChecklistCompletion(itemId, newCompleted), 'toggleChecklist');
  }, [preRunChecklist, betweenRoundsChecklist, postRunChecklist, trackSave]);

  const resetChecklist = useCallback(async (checklistType: 'preRun' | 'betweenRounds' | 'postRun') => {
    const setters = { preRun: setPreRunChecklist, betweenRounds: setBetweenRoundsChecklist, postRun: setPostRunChecklist };
    setters[checklistType](prev => prev.map(item => ({ ...item, completed: false, checkedBy: undefined, checkedAt: undefined })));
    await trackSave(() => db.resetChecklistByType(checklistType, user?.id), 'resetChecklist');
  }, [user?.id, trackSave]);

  // Add new engine
  const addEngine = useCallback(async (engine: Engine) => {
    setEngines(prev => [...prev, engine]);
    await trackSave(() => db.upsertEngine(engine, user?.id), 'addEngine');
  }, [user?.id, trackSave]);

  // ============ SOFT-DELETE WITH UNDO FOR ENGINES ============
  const deleteEngine = useCallback(async (id: string) => {
    let itemToDelete: Engine | null = null;
    setEngines(prev => {
      itemToDelete = prev.find(e => e.id === id) || null;
      return prev.filter(e => e.id !== id);
    });
    if (!itemToDelete) return;
    const captured = { ...itemToDelete } as Engine;

    const existing = pendingEngineDeletesRef.current.get(id);
    if (existing) { clearTimeout(existing.timeoutId); toast.dismiss(existing.toastId); pendingEngineDeletesRef.current.delete(id); }

    const timeoutId = setTimeout(() => {
      const pending = pendingEngineDeletesRef.current.get(id);
      if (!pending) return;
      pendingEngineDeletesRef.current.delete(id);
      trackSave(() => db.deleteEngine(id), 'deleteEngine');
      console.log(`[deleteEngine] Hard delete executed for engine ${id} (${captured.name})`);
    }, UNDO_DELETE_WINDOW_MS);

    const toastId = toast(`Engine "${captured.name}" deleted`, {
      description: `S/N: ${captured.serialNumber} — click Undo within 10s to restore`,
      duration: UNDO_DELETE_WINDOW_MS + 500,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingEngineDeletesRef.current.get(id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingEngineDeletesRef.current.delete(id);
            setEngines(prev => prev.some(e => e.id === id) ? prev : [...prev, captured]);
            toast.success('Engine restored', { description: `"${captured.name}" has been restored`, duration: 3000 });
          }
        },
      },
    });
    pendingEngineDeletesRef.current.set(id, { item: captured, timeoutId, toastId: toastId as string | number });
  }, [trackSave]);


  const addSupercharger = useCallback(async (sc: Supercharger) => {
    setSuperchargers(prev => [...prev, sc]);
    await trackSave(() => db.upsertSupercharger(sc, user?.id), 'addSupercharger');
  }, [user?.id, trackSave]);

  const deleteSupercharger = useCallback(async (id: string) => {
    setSuperchargers(prev => prev.filter(s => s.id !== id));
    await trackSave(() => db.deleteSupercharger(id), 'deleteSupercharger');
  }, [trackSave]);

  const addCylinderHead = useCallback(async (head: CylinderHead) => {
    setCylinderHeads(prev => [...prev, head]);
    await trackSave(() => db.upsertCylinderHead(head, user?.id), 'addCylinderHead');
  }, [user?.id, trackSave]);

  const deleteCylinderHead = useCallback(async (id: string) => {
    setCylinderHeads(prev => prev.filter(h => h.id !== id));
    await trackSave(() => db.deleteCylinderHead(id), 'deleteCylinderHead');
  }, [trackSave]);

  const addMaintenanceItem = useCallback(async (item: MaintenanceItem) => {
    setMaintenanceItems(prev => [...prev, item]);
    await trackSave(
      () => db.upsertMaintenanceItem(item, user?.id),
      'addMaintenance',
      undefined,
      'Maintenance item saved locally but failed to sync to database — it may disappear on refresh.'
    );
  }, [user?.id, trackSave]);


  // ============ SOFT-DELETE WITH UNDO FOR MAINTENANCE ITEMS ============
  const deleteMaintenanceItem = useCallback(async (id: string) => {
    let itemToDelete: MaintenanceItem | null = null;
    setMaintenanceItems(prev => {
      itemToDelete = prev.find(m => m.id === id) || null;
      return prev.filter(m => m.id !== id);
    });
    if (!itemToDelete) return;
    const captured = { ...itemToDelete } as MaintenanceItem;

    const existing = pendingMaintenanceDeletesRef.current.get(id);
    if (existing) { clearTimeout(existing.timeoutId); toast.dismiss(existing.toastId); pendingMaintenanceDeletesRef.current.delete(id); }

    const timeoutId = setTimeout(() => {
      const pending = pendingMaintenanceDeletesRef.current.get(id);
      if (!pending) return;
      pendingMaintenanceDeletesRef.current.delete(id);
      trackSave(() => db.deleteMaintenanceItem(id), 'deleteMaintenance');
      console.log(`[deleteMaintenanceItem] Hard delete executed for maintenance item ${id} (${captured.component})`);
    }, UNDO_DELETE_WINDOW_MS);

    const toastId = toast(`Maintenance item "${captured.component}" deleted`, {
      description: `${captured.category} — click Undo within 10s to restore`,
      duration: UNDO_DELETE_WINDOW_MS + 500,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingMaintenanceDeletesRef.current.get(id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingMaintenanceDeletesRef.current.delete(id);
            setMaintenanceItems(prev => prev.some(m => m.id === id) ? prev : [...prev, captured]);
            toast.success('Maintenance item restored', { description: `"${captured.component}" has been restored`, duration: 3000 });
          }
        },
      },
    });
    pendingMaintenanceDeletesRef.current.set(id, { item: captured, timeoutId, toastId: toastId as string | number });
  }, [trackSave]);


  const addSFICertification = useCallback(async (cert: SFICertification) => {
    setSFICertifications(prev => [...prev, cert]);
    await trackSave(
      () => db.upsertSFICertification(cert, user?.id),
      'addSFICert',
      undefined,
      'SFI certification saved locally but failed to sync to database — it may disappear on refresh.'
    );
  }, [user?.id, trackSave]);

  const updateSFICertification = useCallback(async (id: string, cert: Partial<SFICertification>) => {
    let mergedItem: SFICertification | null = null;
    setSFICertifications(prev => prev.map(c => { if (c.id === id) { mergedItem = { ...c, ...cert }; return mergedItem; } return c; }));
    if (mergedItem) await trackSave(() => db.upsertSFICertification(mergedItem!, user?.id), 'updateSFICert');
  }, [user?.id, trackSave]);

  const deleteSFICertification = useCallback(async (id: string) => {
    setSFICertifications(prev => prev.filter(c => c.id !== id));
    await trackSave(() => db.deleteSFICertification(id), 'deleteSFICert');
  }, [trackSave]);

  const addPartInventory = useCallback(async (part: PartInventoryItem) => {
    setPartsInventory(prev => [...prev, part]);
    await trackSave(
      () => db.upsertPartInventory(part, user?.id),
      'addPart',
      undefined,
      'Part saved locally but failed to sync to database — it may disappear on refresh.'
    );
  }, [user?.id, trackSave]);


  // ============ SOFT-DELETE WITH UNDO FOR PARTS INVENTORY ============
  // When a part is deleted, it is immediately hidden from the UI (soft-delete)
  // but retained in memory for 10 seconds. A toast with an "Undo" button appears.
  // If the user clicks Undo within 10 seconds, the part is restored to state and
  // the database delete is cancelled. Only after the 10-second window expires
  // does the hard delete (cache purge + DB delete + audit log) execute.
  // This prevents accidental data loss from mis-clicks.



  const deletePartInventory = useCallback(async (id: string) => {
    // 1. Capture the part data BEFORE removing from state
    //    (using functional update so the updater runs synchronously)
    let partToDelete: PartInventoryItem | null = null;
    setPartsInventory(prev => {
      partToDelete = prev.find(p => p.id === id) || null;
      return prev.filter(p => p.id !== id);
    });

    // Guard: if the part wasn't found, nothing to do
    if (!partToDelete) {
      console.warn(`[deletePartInventory] Part ${id} not found in state — skipping`);
      return;
    }

    // 2. Cancel any existing pending delete for this part (edge case: rapid double-click)
    const existingPending = pendingPartDeletesRef.current.get(id);
    if (existingPending) {
      clearTimeout(existingPending.timeoutId);
      toast.dismiss(existingPending.toastId);
      pendingPartDeletesRef.current.delete(id);
    }

    // 3. Capture a local reference for closures
    const capturedPart = { ...partToDelete } as PartInventoryItem;

    // 4. Set up the deferred hard delete (fires after UNDO_DELETE_WINDOW_MS)
    const timeoutId = setTimeout(() => {
      // ── HARD DELETE: undo window has expired ──
      const pending = pendingPartDeletesRef.current.get(id);
      if (!pending) return; // Already undone or cleaned up

      pendingPartDeletesRef.current.delete(id);

      // Purge all localStorage caches referencing this part
      purgeDeletedPartFromCaches(id);

      // Delete from database
      trackSave(() => db.deletePartInventory(id), 'deletePart', { type: 'deletePartInventory', data: id });

      // Audit log the permanent deletion
      auditLog.logInventoryChange(id, capturedPart.description, 'delete', capturedPart, undefined).catch(() => {});

      console.log(`[deletePartInventory] Hard delete executed for part ${id} (${capturedPart.partNumber})`);
    }, UNDO_DELETE_WINDOW_MS);

    // 5. Show toast with Undo action button
    const toastId = toast(`"${capturedPart.description}" deleted`, {
      description: `${capturedPart.partNumber} — click Undo within 10s to restore`,
      duration: UNDO_DELETE_WINDOW_MS + 500, // Slightly longer than the window so it's still visible
      action: {
        label: 'Undo',
        onClick: () => {
          // ── UNDO: restore the part ──
          const pending = pendingPartDeletesRef.current.get(id);
          if (pending) {
            // Cancel the hard delete timer
            clearTimeout(pending.timeoutId);
            pendingPartDeletesRef.current.delete(id);

            // Restore the part back into state
            setPartsInventory(prev => {
              // Guard against duplicates (in case a background sync re-added it)
              if (prev.some(p => p.id === id)) return prev;
              return [...prev, capturedPart];
            });

            toast.success(`"${capturedPart.description}" restored`, {
              description: `${capturedPart.partNumber} has been restored to inventory`,
              duration: 3000,
            });

            console.log(`[deletePartInventory] Undo — part ${id} (${capturedPart.partNumber}) restored`);
          }
        },
      },
    });

    // 6. Store the pending delete for potential undo
    pendingPartDeletesRef.current.set(id, {
      part: capturedPart,
      timeoutId,
      toastId: toastId as string | number,
    });
  }, [trackSave]);




  const addChecklistItem = useCallback(async (checklistType: 'preRun' | 'betweenRounds' | 'postRun', item: ChecklistItem) => {
    const setters = { preRun: setPreRunChecklist, betweenRounds: setBetweenRoundsChecklist, postRun: setPostRunChecklist };
    setters[checklistType](prev => [...prev, item]);
    await trackSave(() => db.upsertChecklistItem(item, checklistType, user?.id), 'addChecklistItem');
  }, [user?.id, trackSave]);

  const updateChecklistItemAction = useCallback(async (checklistType: 'preRun' | 'betweenRounds' | 'postRun', id: string, item: Partial<ChecklistItem>) => {
    const setters = { preRun: setPreRunChecklist, betweenRounds: setBetweenRoundsChecklist, postRun: setPostRunChecklist };
    const lists = { preRun: preRunChecklist, betweenRounds: betweenRoundsChecklist, postRun: postRunChecklist };
    setters[checklistType](prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
    const existingItem = lists[checklistType].find(i => i.id === id);
    if (existingItem) await trackSave(() => db.upsertChecklistItem({ ...existingItem, ...item }, checklistType, user?.id), 'updateChecklistItem');
  }, [preRunChecklist, betweenRoundsChecklist, postRunChecklist, user?.id, trackSave]);

  const deleteChecklistItem = useCallback(async (checklistType: 'preRun' | 'betweenRounds' | 'postRun', id: string) => {
    const setters = { preRun: setPreRunChecklist, betweenRounds: setBetweenRoundsChecklist, postRun: setPostRunChecklist };
    setters[checklistType](prev => prev.filter(i => i.id !== id));
    await trackSave(() => db.deleteChecklistItem(id), 'deleteChecklistItem');
  }, [trackSave]);

  // Race Event actions
  const addRaceEvent = useCallback(async (event: RaceEvent) => {
    setRaceEvents(prev => [event, ...prev]);
    await trackSave(async () => {
      await db.upsertRaceEvent(event, user?.id);
    }, 'addRaceEvent').catch(() => {
      setRaceEvents(prev => prev.filter(e => e.id !== event.id));
    });
  }, [user?.id, trackSave]);

  const updateRaceEvent = useCallback(async (id: string, event: Partial<RaceEvent>) => {
    let mergedItem: RaceEvent | null = null;
    let originalItem: RaceEvent | null = null;
    setRaceEvents(prev => prev.map(e => {
      if (e.id === id) { originalItem = e; mergedItem = { ...e, ...event }; return mergedItem; }
      return e;
    }));
    if (mergedItem) {
      await trackSave(async () => {
        await db.upsertRaceEvent(mergedItem!, user?.id);
      }, 'updateRaceEvent').catch(() => {
        if (originalItem) setRaceEvents(prev => prev.map(e => e.id === id ? originalItem! : e));
      });
    }
  }, [user?.id, trackSave]);

  const deleteRaceEventAction = useCallback(async (id: string) => {
    setRaceEvents(prev => prev.filter(e => e.id !== id));
    await trackSave(() => db.deleteRaceEvent(id), 'deleteRaceEvent');
  }, [trackSave]);

  // Team Member actions
  const addTeamMember = useCallback(async (member: TeamMember) => {
    setTeamMembers(prev => [...prev, member]);
    await trackSave(() => db.upsertTeamMember(member, user?.id), 'addTeamMember');
  }, [user?.id, trackSave]);

  const updateTeamMember = useCallback(async (id: string, member: Partial<TeamMember>) => {
    let mergedItem: TeamMember | null = null;
    setTeamMembers(prev => prev.map(m => { if (m.id === id) { mergedItem = { ...m, ...member }; return mergedItem; } return m; }));
    if (mergedItem) await trackSave(() => db.upsertTeamMember(mergedItem!, user?.id), 'updateTeamMember');
  }, [user?.id, trackSave]);

  const deleteTeamMemberAction = useCallback(async (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
    await trackSave(() => db.deleteTeamMember(id), 'deleteTeamMember');
  }, [trackSave]);

  // Saved Track actions
  const addSavedTrack = useCallback(async (track: SavedTrack) => {
    setSavedTracks(prev => [...prev, track]);
    await trackSave(() => db.upsertSavedTrack(track, user?.id), 'addSavedTrack');
  }, [user?.id, trackSave]);

  const updateSavedTrackAction = useCallback(async (id: string, track: Partial<SavedTrack>) => {
    let mergedItem: SavedTrack | null = null;
    setSavedTracks(prev => prev.map(t => { if (t.id === id) { mergedItem = { ...t, ...track }; return mergedItem; } return t; }));
    if (mergedItem) await trackSave(() => db.upsertSavedTrack(mergedItem!, user?.id), 'updateSavedTrack');
  }, [user?.id, trackSave]);

  const deleteSavedTrackAction = useCallback(async (id: string) => {
    setSavedTracks(prev => prev.filter(t => t.id !== id));
    await trackSave(() => db.deleteSavedTrack(id), 'deleteSavedTrack');
  }, [trackSave]);

  const incrementTrackVisit = useCallback(async (id: string) => {
    setSavedTracks(prev => prev.map(t => 
      t.id === id ? { ...t, visitCount: t.visitCount + 1, lastVisited: getLocalDateString() } : t
    ));
    await trackSave(() => db.incrementTrackVisitCount(id), 'incrementTrackVisit');
  }, [trackSave]);

  // Drivetrain Component actions
  const addDrivetrainComponent = useCallback(async (comp: DrivetrainComponent) => {
    setDrivetrainComponents(prev => [...prev, comp]);
    await trackSave(() => db.upsertDrivetrainComponent(comp, user?.id), 'addDrivetrainComponent');
  }, [user?.id, trackSave]);

  const updateDrivetrainComponent = useCallback(async (id: string, comp: Partial<DrivetrainComponent>) => {
    let mergedItem: DrivetrainComponent | null = null;
    setDrivetrainComponents(prev => prev.map(c => { if (c.id === id) { mergedItem = { ...c, ...comp }; return mergedItem; } return c; }));
    if (mergedItem) await trackSave(() => db.upsertDrivetrainComponent(mergedItem!, user?.id), 'updateDrivetrainComponent');
  }, [user?.id, trackSave]);

  const deleteDrivetrainComponentAction = useCallback(async (id: string) => {
    setDrivetrainComponents(prev => prev.filter(c => c.id !== id));
    await trackSave(() => db.deleteDrivetrainComponent(id), 'deleteDrivetrainComponent');
  }, [trackSave]);

  // Drivetrain Swap action
  const performDrivetrainSwap = useCallback(async (
    componentType: DrivetrainCategory,
    previousComponentId: string,
    newComponentId: string,
    reason: string,
    performedBy: string,
    notes: string
  ) => {
    const userId = user?.id;
    const prevComp = drivetrainComponents.find(c => c.id === previousComponentId);
    const newComp = drivetrainComponents.find(c => c.id === newComponentId);
    
    const swapLog: DrivetrainSwapLog = {
      id: `DT-SWAP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: getLocalDateString(),
      time: new Date().toTimeString().slice(0, 5),
      componentType,
      previousComponentId,
      newComponentId,
      previousComponentName: prevComp?.name || 'Unknown',
      newComponentName: newComp?.name || 'Unknown',
      reason,
      performedBy,
      notes
    };
    
    setDrivetrainSwapLogs(prev => [swapLog, ...prev]);
    
    // Update component statuses
    setDrivetrainComponents(prev => prev.map(c => {
      if (c.id === previousComponentId) return { ...c, currentlyInstalled: false, status: 'Ready' as const };
      if (c.id === newComponentId) return { ...c, currentlyInstalled: true, status: 'Active' as const, installDate: swapLog.date };
      return c;
    }));
    
    // Persist swap log and updated components to DB
    await trackSave(() => db.insertDrivetrainSwapLog(swapLog, userId), 'drivetrainSwap');
    
    // Also persist the updated component statuses
    if (prevComp) {
      await trackSave(() => db.upsertDrivetrainComponent({ ...prevComp, currentlyInstalled: false, status: 'Ready' }, userId), 'updateDrivetrainComponent');
    }
    if (newComp) {
      await trackSave(() => db.upsertDrivetrainComponent({ ...newComp, currentlyInstalled: true, status: 'Active', installDate: swapLog.date }, userId), 'updateDrivetrainComponent');
    }
    
    toast.success(`Drivetrain Swap Complete`, {
      description: `${componentType}: ${prevComp?.name || 'None'} → ${newComp?.name || 'Unknown'}`,
      duration: 5000,
    });
  }, [drivetrainComponents, user?.id, trackSave]);

  // ============ VENDOR ACTIONS ============
  const addVendor = useCallback(async (vendor: VendorRecord) => {
    setVendors(prev => [...prev, vendor]);
    await trackSave(() => db.upsertVendor(vendor, user?.id), 'addVendor');
  }, [user?.id, trackSave]);

  const updateVendorAction = useCallback(async (id: string, vendor: Partial<VendorRecord>) => {
    let mergedItem: VendorRecord | null = null;
    setVendors(prev => prev.map(v => {
      if (v.id === id) { mergedItem = { ...v, ...vendor }; return mergedItem; }
      return v;
    }));
    if (mergedItem) await trackSave(() => db.upsertVendor(mergedItem!, user?.id), 'updateVendor');
  }, [user?.id, trackSave]);

  const deleteVendorAction = useCallback(async (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    await trackSave(() => db.deleteVendor(id), 'deleteVendor');
  }, [trackSave]);

  // ============ REFRESH VENDORS (standalone) ============
  // Lightweight vendor-only re-fetch from the database.
  // Can be called manually (e.g. after VendorManagement add/update/delete)
  // or automatically via the periodic background interval below.
  const refreshVendors = useCallback(async () => {
    if (isDemoMode) return; // Nothing to fetch in demo mode
    const userId = effectiveUserId || user?.id;
    try {
      const dbVendors = await Promise.race([
        db.fetchVendors(userId),
        new Promise<VendorRecord[]>((resolve) => setTimeout(() => resolve([] as VendorRecord[]), 8000))
      ]);
      if (mountedRef.current) {
        setVendors(dbVendors);
        console.log(`[AppContext] refreshVendors complete — ${dbVendors.length} vendors fetched`);
      }
    } catch (err) {
      console.warn('[AppContext] refreshVendors failed (non-blocking):', err);
    }
  }, [isDemoMode, effectiveUserId, user?.id]);

  // ============ PERIODIC VENDOR BACKGROUND SYNC (every 5 minutes) ============
  // Keeps vendor data fresh across tabs / team members without a full data refresh.
  // Only runs when the user is authenticated and not in demo mode.
  useEffect(() => {
    // Clear any existing interval first
    if (vendorSyncIntervalRef.current) {
      clearInterval(vendorSyncIntervalRef.current);
      vendorSyncIntervalRef.current = null;
    }

    const userId = effectiveUserId || user?.id;
    if (!userId || isDemoMode) return;

    const VENDOR_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    console.log('[AppContext] Starting periodic vendor background sync (every 5 min)');

    vendorSyncIntervalRef.current = setInterval(() => {
      if (mountedRef.current && document.visibilityState === 'visible') {
        console.log('[AppContext] Periodic vendor sync triggered');
        refreshVendors();
      }
    }, VENDOR_SYNC_INTERVAL_MS);

    return () => {
      if (vendorSyncIntervalRef.current) {
        clearInterval(vendorSyncIntervalRef.current);
        vendorSyncIntervalRef.current = null;
      }
    };
  }, [effectiveUserId, user?.id, isDemoMode, refreshVendors]);

  // ============ TIRE TRACKING ACTIONS ============
  const addTireSet = useCallback(async (tire: TireSet) => {
    setTireSets(prev => [...prev, tire]);
    // Also sync to localStorage for module-level pass increment helpers
    setTireSets(prev => { try { localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(prev)); } catch {} return prev; });
    await trackSave(() => db.upsertTireSet(tire, user?.id), 'addTireSet');
  }, [user?.id, trackSave]);

  const updateTireSet = useCallback(async (id: string, tire: Partial<TireSet>) => {
    let mergedItem: TireSet | null = null;
    setTireSets(prev => {
      const updated = prev.map(t => { if (t.id === id) { mergedItem = { ...t, ...tire }; return mergedItem!; } return t; });
      try { localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (mergedItem) await trackSave(() => db.upsertTireSet(mergedItem!, user?.id), 'updateTireSet');
  }, [user?.id, trackSave]);

  const deleteTireSetActionFn = useCallback(async (id: string) => {
    setTireSets(prev => { const updated = prev.filter(t => t.id !== id); try { localStorage.setItem(TIRE_SETS_LS_KEY, JSON.stringify(updated)); } catch {} return updated; });
    setTreadDepth(prev => prev.filter(t => t.tireSetId !== id));
    setPressureHistory(prev => prev.filter(p => p.tireSetId !== id));
    setTireChangeLog(prev => prev.filter(c => c.tireSetId !== id));
    await trackSave(() => db.deleteTireSet(id), 'deleteTireSet');
  }, [trackSave]);

  const addTreadDepthFn = useCallback(async (entry: TreadDepthEntry) => {
    setTreadDepth(prev => [...prev, entry]);
    await trackSave(() => db.upsertTreadDepth(entry, user?.id), 'addTreadDepth');
  }, [user?.id, trackSave]);

  const deleteTreadDepthFn = useCallback(async (id: string) => {
    setTreadDepth(prev => prev.filter(t => t.id !== id));
    await trackSave(() => db.deleteTreadDepth(id), 'deleteTreadDepth');
  }, [trackSave]);

  const addPressureEntryFn = useCallback(async (entry: TirePressureEntry) => {
    setPressureHistory(prev => [...prev, entry]);
    await trackSave(() => db.upsertTirePressure(entry, user?.id), 'addTirePressure');
  }, [user?.id, trackSave]);

  const deletePressureEntryFn = useCallback(async (id: string) => {
    setPressureHistory(prev => prev.filter(p => p.id !== id));
    await trackSave(() => db.deleteTirePressure(id), 'deleteTirePressure');
  }, [trackSave]);

  const addTireChangeLogEntryFn = useCallback(async (entry: TireChangeLog) => {
    setTireChangeLog(prev => [...prev, entry]);
    await trackSave(() => db.upsertTireChangeLog(entry, user?.id), 'addTireChangeLog');
  }, [user?.id, trackSave]);

  const deleteTireChangeLogEntryFn = useCallback(async (id: string) => {
    setTireChangeLog(prev => prev.filter(c => c.id !== id));
    await trackSave(() => db.deleteTireChangeLogEntry(id), 'deleteTireChangeLog');
  }, [trackSave]);


  // Computed values
  const getActiveEngine = useCallback(() => engines.find(e => e.currentlyInstalled), [engines]);
  const getActiveSupercharger = useCallback(() => superchargers.find(s => s.currentlyInstalled), [superchargers]);
  const getTotalPasses = useCallback(() => passLogs.length, [passLogs]);
  
  const getAlertCount = useCallback(() => {
    const expiredCerts = sfiCertifications.filter(c => c.daysUntilExpiration <= 0).length;
    const expiringSoonCerts = sfiCertifications.filter(c => c.daysUntilExpiration > 0 && c.daysUntilExpiration <= 60).length;
    const dueMaintenance = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Overdue').length;
    const lowStockParts = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length;
    return expiredCerts + expiringSoonCerts + dueMaintenance + lowStockParts;
  }, [sfiCertifications, maintenanceItems, partsInventory]);


  const getLowStockCount = useCallback(() => {
    return partsInventory.filter(p => 
      p.onHand <= p.minQuantity || p.status === 'Low Stock' || p.status === 'Out of Stock'
    ).length;
  }, [partsInventory]);

  return (
    <AppContext.Provider value={{
      isLoading,
      isSyncing,
      lastSyncTime,
      syncError,
      saveStatus,
      lastSaveTime,
      lastSaveError,
      retrySave,
      // Offline sync state
      isOnline: offlineSync.isOnline,
      pendingOfflineCount: offlineSync.pendingCount,
      hasConnectivityIssue: offlineSync.hasConnectivityIssue,
      isOfflineSyncing: offlineSync.isSyncing,
      offlineSyncProgress: offlineSync.syncProgress,
      syncOfflineQueue,
      engines,
      superchargers,
      cylinderHeads,
      maintenanceItems,
      sfiCertifications,
      passLogs,


      engineSwapLogs,
      preRunChecklist,
      betweenRoundsChecklist,
      postRunChecklist,
      partsInventory,
      trackWeatherHistory,
      raceEvents,
      teamMembers,
      savedTracks,
      drivetrainComponents,
      drivetrainSwapLogs,
      vendors,
      tireSets,
      treadDepth,
      pressureHistory,
      tireChangeLog,
      addTireSet,
      updateTireSet,
      deleteTireSetAction: deleteTireSetActionFn,
      addTreadDepth: addTreadDepthFn,
      deleteTreadDepthAction: deleteTreadDepthFn,
      addPressureEntry: addPressureEntryFn,
      deletePressureEntryAction: deletePressureEntryFn,
      addTireChangeLogEntry: addTireChangeLogEntryFn,
      deleteTireChangeLogEntryAction: deleteTireChangeLogEntryFn,
      addVendor,
      updateVendor: updateVendorAction,
      deleteVendor: deleteVendorAction,
      refreshVendors,



      addPassLog,
      updatePassLog,
      deletePassLog: deletePassLogAction,
      addEngine,

      performEngineSwap,
      updateEngine,
      deleteEngine,
      addSupercharger,
      updateSupercharger,
      deleteSupercharger,
      addCylinderHead,
      updateCylinderHead,
      deleteCylinderHead,
      addMaintenanceItem,
      updateMaintenanceItem,
      deleteMaintenanceItem,
      addSFICertification,
      updateSFICertification,
      deleteSFICertification,
      addPartInventory,
      updatePartInventory,
      deletePartInventory,
      updateTrackWeatherHistory: updateTrackWeatherHistoryAction,
      addChecklistItem,
      updateChecklistItem: updateChecklistItemAction,
      deleteChecklistItem,
      toggleChecklistItem,
      resetChecklist,
      addRaceEvent,
      updateRaceEvent,
      deleteRaceEvent: deleteRaceEventAction,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember: deleteTeamMemberAction,
      addSavedTrack,
      updateSavedTrack: updateSavedTrackAction,
      deleteSavedTrack: deleteSavedTrackAction,
      incrementTrackVisit,
      addDrivetrainComponent,
      updateDrivetrainComponent,
      deleteDrivetrainComponent: deleteDrivetrainComponentAction,
      performDrivetrainSwap,


      refreshData,
      getActiveEngine,
      getActiveSupercharger,
      getTotalPasses,
      getAlertCount,
      getLowStockCount
    }}>

      {children}
    </AppContext.Provider>
  );
};


export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
