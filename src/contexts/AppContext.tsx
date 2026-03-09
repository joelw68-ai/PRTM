import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { getLocalDateString } from '@/lib/utils';
import * as dbLogger from '@/lib/dbLogger';
import { toast } from 'sonner';
import { checkNewlyTriggeredAlerts, loadAlertSettings } from '@/lib/maintenanceAlerts';

import {

  PassLogEntry,
  Engine,
  Supercharger,
  CylinderHead,
  MaintenanceItem,
  SFICertification,
  WorkOrder,
  ChecklistItem,
  EngineSwapLog,
  TrackWeatherHistory,
  engines as initialEngines,
  superchargers as initialSuperchargers,
  cylinderHeads as initialCylinderHeads,
  maintenanceItems as initialMaintenanceItems,
  sfiCertifications as initialSFICertifications,
  passLogs as initialPassLogs,
  workOrders as initialWorkOrders,
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
import { SavedTrack, ToDoItem, TeamNote, LaborEntry, MediaItem, DrivetrainComponent, DrivetrainCategory, DrivetrainSwapLog, VendorRecord } from '@/lib/database';



import { useAuth } from '@/contexts/AuthContext';
import type { SaveStatus } from '@/components/race/SaveStatusIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { isConnectivityError, type QueueOperationType } from '@/lib/offlineQueue';



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
  workOrders: WorkOrder[];
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

  // Vendor Actions
  addVendor: (vendor: VendorRecord) => Promise<void>;
  updateVendor: (id: string, vendor: Partial<VendorRecord>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  refreshVendors: () => Promise<void>;



  
  // Pass Log Actions
  addPassLog: (pass: PassLogEntry) => Promise<void>;
  updatePassLog: (id: string, pass: Partial<PassLogEntry>) => Promise<void>;
  deletePassLog: (id: string) => Promise<void>;
  
  // Work Order Actions
  addWorkOrder: (order: WorkOrder) => Promise<void>;
  updateWorkOrder: (id: string, order: Partial<WorkOrder>) => Promise<void>;
  deleteWorkOrder: (id: string) => Promise<void>;
  
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
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
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



  // ============ SAVE STATUS TRACKING ============
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const lastFailedOperationRef = useRef<(() => Promise<void>) | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSavesRef = useRef(0);
  const vendorSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


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
  const trackSave = useCallback(async (
    operation: () => Promise<void>,
    label?: string,
    offlineInfo?: { type: QueueOperationType; data: any }
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
        dbSFICertifications, dbPassLogs, dbWorkOrders, dbEngineSwapLogs,
        dbChecklists, dbPartsInventory, dbTrackWeatherHistory,
        dbRaceEvents, dbTeamMembers, dbSavedTracks
      ] = await Promise.all([
        safeFetch(db.fetchEngines(userId), [] as Engine[], 'engines'),
        safeFetch(db.fetchSuperchargers(userId), [] as Supercharger[], 'superchargers'),
        safeFetch(db.fetchCylinderHeads(userId), [] as CylinderHead[], 'cylinder_heads'),
        safeFetch(db.fetchMaintenanceItems(userId), [] as MaintenanceItem[], 'maintenance_items'),
        safeFetch(db.fetchSFICertifications(userId), [] as SFICertification[], 'sfi_certifications'),
        safeFetch(db.fetchPassLogs(userId), [] as PassLogEntry[], 'pass_logs'),
        safeFetch(db.fetchWorkOrders(userId), [] as WorkOrder[], 'work_orders'),
        safeFetch(db.fetchEngineSwapLogs(userId), [] as EngineSwapLog[], 'engine_swap_logs'),
        safeFetch(db.fetchChecklists(userId), emptyChecklists, 'checklists'),
        safeFetch(db.fetchPartsInventory(userId), [] as PartInventoryItem[], 'parts_inventory'),
        safeFetch(db.fetchTrackWeatherHistory(userId), [] as TrackWeatherHistory[], 'track_weather_history'),
        safeFetch(db.fetchRaceEvents(userId), [] as RaceEvent[], 'race_events'),
        safeFetch(db.fetchTeamMembers(userId), [] as TeamMember[], 'team_members'),
        safeFetch(db.fetchSavedTracks(userId), [] as SavedTrack[], 'saved_tracks')
      ]);
      
      if (!mountedRef.current) return;
      
      // For authenticated users (or login transitions): always replace state with DB data
      // For unauthenticated: only replace if DB returned data (keeps sample data as fallback)
      if (isAuthenticated || isLoginTransition) {
        // Always set — even empty arrays — so user sees their real data
        setEngines(dbEngines.length > 0 ? dbEngines : []);
        setSuperchargers(dbSuperchargers.length > 0 ? dbSuperchargers : []);
        setCylinderHeads(dbCylinderHeads.length > 0 ? dbCylinderHeads : []);
        setMaintenanceItems(dbMaintenanceItems.length > 0 ? dbMaintenanceItems : []);
        setSFICertifications(dbSFICertifications.length > 0 ? dbSFICertifications : []);
        setPassLogs(dbPassLogs.length > 0 ? dbPassLogs : []);
        setWorkOrders(dbWorkOrders.length > 0 ? dbWorkOrders : []);
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
        if (dbMaintenanceItems.length > 0) setMaintenanceItems(dbMaintenanceItems);
        if (dbSFICertifications.length > 0) setSFICertifications(dbSFICertifications);
        if (dbPassLogs.length > 0) setPassLogs(dbPassLogs);
        if (dbWorkOrders.length > 0) setWorkOrders(dbWorkOrders);
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
        workOrders: dbWorkOrders.length,
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
        dbSFICertifications, dbPassLogs, dbWorkOrders, dbEngineSwapLogs,
        dbChecklists, dbPartsInventory, dbTrackWeatherHistory,
        dbRaceEvents, dbTeamMembers, dbSavedTracks
      ] = await Promise.all([
        safeFetch(db.fetchEngines(userId), [] as Engine[], 'engines'),
        safeFetch(db.fetchSuperchargers(userId), [] as Supercharger[], 'superchargers'),
        safeFetch(db.fetchCylinderHeads(userId), [] as CylinderHead[], 'cylinder_heads'),
        safeFetch(db.fetchMaintenanceItems(userId), [] as MaintenanceItem[], 'maintenance_items'),
        safeFetch(db.fetchSFICertifications(userId), [] as SFICertification[], 'sfi_certifications'),
        safeFetch(db.fetchPassLogs(userId), [] as PassLogEntry[], 'pass_logs'),
        safeFetch(db.fetchWorkOrders(userId), [] as WorkOrder[], 'work_orders'),
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
      if (dbMaintenanceItems.length > 0) setMaintenanceItems(dbMaintenanceItems);
      if (dbSFICertifications.length > 0) setSFICertifications(dbSFICertifications);
      if (dbPassLogs.length > 0) setPassLogs(dbPassLogs);
      if (dbWorkOrders.length > 0) setWorkOrders(dbWorkOrders);
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
  const addPassLog = useCallback(async (pass: PassLogEntry) => {
    const userId = user?.id;

    // Capture previous maintenance items state BEFORE incrementing (for threshold crossing detection)
    const previousMaintenanceItems = maintenanceItems.map(m => ({ ...m }));

    setPassLogs(prev => [pass, ...prev]);
    setEngines(prev => prev.map(e => 
      e.id === pass.engineId 
        ? { ...e, totalPasses: e.totalPasses + 1, passesSinceRebuild: e.passesSinceRebuild + 1 }
        : e
    ));
    setSuperchargers(prev => prev.map(s => 
      s.id === pass.superchargerId
        ? { ...s, totalPasses: s.totalPasses + 1, passesSinceService: s.passesSinceService + 1 }
        : s
    ));

    // Compute updated maintenance items
    const updatedMaintenanceItems = maintenanceItems.map(m => ({
      ...m,
      currentPasses: m.currentPasses + 1,
      status: (m.currentPasses + 1 >= m.nextServicePasses ? 'Due' : 
              m.currentPasses + 1 >= m.nextServicePasses - (m.passInterval * 0.25) ? 'Due Soon' : 'Good') as MaintenanceItem['status']
    }));

    setMaintenanceItems(updatedMaintenanceItems);

    // ============ AUTOMATIC MAINTENANCE ALERT NOTIFICATIONS ============
    // Check if any maintenance items (including drivetrain) just crossed a configured threshold
    try {
      const alertSettings = loadAlertSettings();
      if (alertSettings.enabled && alertSettings.showToastNotifications) {
        const newAlerts = checkNewlyTriggeredAlerts(previousMaintenanceItems, updatedMaintenanceItems, alertSettings);
        
        // Fire toast notifications for each newly triggered alert
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
    
    await trackSave(() => db.upsertPassLog(pass, userId), 'addPassLog', { type: 'upsertPassLog', data: pass });
  }, [user?.id, trackSave, maintenanceItems]);


  const updatePassLog = useCallback(async (id: string, pass: Partial<PassLogEntry>) => {
    let mergedItem: PassLogEntry | null = null;
    setPassLogs(prev => prev.map(p => {
      if (p.id === id) { mergedItem = { ...p, ...pass }; return mergedItem; }
      return p;
    }));
    if (mergedItem) await trackSave(() => db.upsertPassLog(mergedItem!, user?.id), 'updatePassLog', { type: 'upsertPassLog', data: mergedItem });
  }, [user?.id, trackSave]);

  const deletePassLogAction = useCallback(async (id: string) => {
    setPassLogs(prev => prev.filter(p => p.id !== id));
    await trackSave(() => db.deletePassLog(id), 'deletePassLog', { type: 'deletePassLog', data: id });
  }, [trackSave]);

  // Work Order actions
  const addWorkOrder = useCallback(async (order: WorkOrder) => {
    setWorkOrders(prev => [order, ...prev]);
    await trackSave(() => db.upsertWorkOrder(order, user?.id), 'addWorkOrder', { type: 'upsertWorkOrder', data: order });
  }, [user?.id, trackSave]);

  const updateWorkOrder = useCallback(async (id: string, order: Partial<WorkOrder>) => {
    let mergedItem: WorkOrder | null = null;
    setWorkOrders(prev => prev.map(w => {
      if (w.id === id) { mergedItem = { ...w, ...order }; return mergedItem; }
      return w;
    }));
    if (mergedItem) await trackSave(() => db.upsertWorkOrder(mergedItem!, user?.id), 'updateWorkOrder', { type: 'upsertWorkOrder', data: mergedItem });
  }, [user?.id, trackSave]);

  const deleteWorkOrderAction = useCallback(async (id: string) => {
    setWorkOrders(prev => prev.filter(w => w.id !== id));
    await trackSave(() => db.deleteWorkOrder(id), 'deleteWorkOrder', { type: 'deleteWorkOrder', data: id });
  }, [trackSave]);


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

  const deleteEngine = useCallback(async (id: string) => {
    setEngines(prev => prev.filter(e => e.id !== id));
    await trackSave(() => db.deleteEngine(id), 'deleteEngine');
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
    await trackSave(() => db.upsertMaintenanceItem(item, user?.id), 'addMaintenance');
  }, [user?.id, trackSave]);

  const deleteMaintenanceItem = useCallback(async (id: string) => {
    setMaintenanceItems(prev => prev.filter(m => m.id !== id));
    await trackSave(() => db.deleteMaintenanceItem(id), 'deleteMaintenance');
  }, [trackSave]);

  const addSFICertification = useCallback(async (cert: SFICertification) => {
    setSFICertifications(prev => [...prev, cert]);
    await trackSave(() => db.upsertSFICertification(cert, user?.id), 'addSFICert');
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
    await trackSave(() => db.upsertPartInventory(part, user?.id), 'addPart');
  }, [user?.id, trackSave]);

  const deletePartInventory = useCallback(async (id: string) => {
    setPartsInventory(prev => prev.filter(p => p.id !== id));
    await trackSave(() => db.deletePartInventory(id), 'deletePart');
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



  // Computed values
  const getActiveEngine = useCallback(() => engines.find(e => e.currentlyInstalled), [engines]);
  const getActiveSupercharger = useCallback(() => superchargers.find(s => s.currentlyInstalled), [superchargers]);
  const getTotalPasses = useCallback(() => passLogs.length, [passLogs]);
  
  const getAlertCount = useCallback(() => {
    const expiredCerts = sfiCertifications.filter(c => c.daysUntilExpiration <= 0).length;
    const expiringSoonCerts = sfiCertifications.filter(c => c.daysUntilExpiration > 0 && c.daysUntilExpiration <= 60).length;
    const dueMaintenance = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Overdue').length;
    const criticalWorkOrders = workOrders.filter(w => w.priority === 'Critical' && w.status !== 'Completed').length;
    const lowStockParts = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length;
    return expiredCerts + expiringSoonCerts + dueMaintenance + criticalWorkOrders + lowStockParts;
  }, [sfiCertifications, maintenanceItems, workOrders, partsInventory]);

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
      workOrders,
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
      addVendor,
      updateVendor: updateVendorAction,
      deleteVendor: deleteVendorAction,
      refreshVendors,


      addPassLog,
      updatePassLog,
      deletePassLog: deletePassLogAction,
      addWorkOrder,
      updateWorkOrder,
      deleteWorkOrder: deleteWorkOrderAction,
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
