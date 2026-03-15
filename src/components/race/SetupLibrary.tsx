import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';
import { toast } from 'sonner';



import DateInputDark from '@/components/ui/DateInputDark';
import CarDropdown from '@/components/race/CarDropdown';
import { useCar } from '@/contexts/CarContext';
import ChassisSetup from '@/components/race/ChassisSetup';

import { useApp } from '@/contexts/AppContext';

import { ComponentTracker, PowerAdderType } from '@/data/proModData';
import { PassHistoryEntry } from '@/lib/database';
import * as db from '@/lib/database';
import { DrivetrainComponent, DrivetrainCategory, DrivetrainSwapLog } from '@/lib/database';




import { 
  Settings, 
  Zap, 
  Wind, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Wrench,
  Save,
  History,
  ArrowRight,
  Clock,
  User,
  MessageSquare,
  Package,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  Bell,
  Play,
  CheckCircle2,
  RotateCcw,
  ListChecks,
  FileText,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';






interface SetupLibraryProps {
  currentRole?: CrewRole;
}

// Type aliases for status/position union types (eliminates `as any` casts in select onChange handlers)
type EngineStatus = 'Active' | 'Ready' | 'Rebuild' | 'Retired';
type SuperchargerStatus = 'Active' | 'Ready' | 'Service' | 'Retired';
type HeadStatus = 'Active' | 'Ready' | 'Refresh' | 'Retired';
type HeadPosition = 'Left' | 'Right' | 'Spare';
type ComponentStatus = 'Good' | 'Inspect' | 'Service' | 'Replace';
type DrivetrainStatus = 'Active' | 'Ready' | 'Service' | 'Rebuild' | 'Retired';


// Type definitions for local use
interface Engine {
  id: string;
  name: string;
  serialNumber: string;
  builder: string;
  installDate: string;
  totalPasses: number;
  passesSinceRebuild: number;
  status: 'Active' | 'Ready' | 'Rebuild' | 'Retired';
  currentlyInstalled: boolean;
  notes: string;
  components: Record<string, ComponentTracker>;
}

interface CylinderHead {
  id: string;
  name: string;
  serialNumber: string;
  builder: string;
  installDate: string;
  totalPasses: number;
  passesSinceRefresh: number;
  status: 'Active' | 'Ready' | 'Refresh' | 'Retired';
  position: 'Left' | 'Right' | 'Spare';
  engineId?: string;
  notes: string;
  components: Record<string, ComponentTracker>;
}

interface Supercharger {
  id: string;
  name: string;
  serialNumber: string;
  model: string;
  installDate: string;
  totalPasses: number;
  passesSinceService: number;
  status: 'Active' | 'Ready' | 'Service' | 'Retired';
  currentlyInstalled: boolean;
  notes: string;
  powerAdderType?: PowerAdderType;
  components?: Record<string, ComponentTracker>;
}

// Power Adder Type options and color mapping
const POWER_ADDER_TYPES: PowerAdderType[] = ['Supercharger', 'Turbocharger', 'Nitrous', 'ProCharger', 'Twin Turbo', 'Centrifugal Supercharger', 'Other'];

const getPowerAdderTypeBadgeColor = (type?: PowerAdderType): string => {
  switch (type) {
    case 'Supercharger': return 'bg-violet-500/20 text-violet-400 border-violet-500/40';
    case 'Turbocharger': return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
    case 'Nitrous': return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    case 'ProCharger': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'Twin Turbo': return 'bg-teal-500/20 text-teal-400 border-teal-500/40';
    case 'Centrifugal Supercharger': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
    case 'Other': return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  }
};


const SetupLibrary: React.FC<SetupLibraryProps> = ({ currentRole = 'Crew' }) => {

  const { selectedCarId, cars, getCarLabel, activeCars } = useCar();


  const { 
    engines: allEngines, 
    cylinderHeads: allCylinderHeads, 
    superchargers: allSuperchargers,
    drivetrainComponents: allDrivetrainComponents,
    drivetrainSwapLogs: allDrivetrainSwapLogs,
    partsInventory,
    vendors: allVendors,
    updateEngine, 
    addEngine,
    deleteEngine,
    updateCylinderHead,
    addCylinderHead,
    deleteCylinderHead,
    updateSupercharger,
    addSupercharger,
    deleteSupercharger,
    addDrivetrainComponent,
    updateDrivetrainComponent,
    deleteDrivetrainComponent,
    performDrivetrainSwap
  } = useApp();

  // Helper: check if a car_id is empty/null/undefined
  const isEmptyCarId = (id: any): boolean => !id || id === '';

  // Filter by selected car — when no car selected show ALL; when car selected show matching + legacy (no car_id)
  const engines = useMemo(() => (selectedCarId && selectedCarId !== '') ? allEngines.filter((e: any) => e.car_id === selectedCarId || isEmptyCarId(e.car_id)) : allEngines, [allEngines, selectedCarId]);
  const cylinderHeads = useMemo(() => (selectedCarId && selectedCarId !== '') ? allCylinderHeads.filter((h: any) => h.car_id === selectedCarId || isEmptyCarId(h.car_id)) : allCylinderHeads, [allCylinderHeads, selectedCarId]);
  const superchargers = useMemo(() => (selectedCarId && selectedCarId !== '') ? allSuperchargers.filter((s: any) => s.car_id === selectedCarId || isEmptyCarId(s.car_id)) : allSuperchargers, [allSuperchargers, selectedCarId]);
  const drivetrainComponents = useMemo(() => (selectedCarId && selectedCarId !== '') ? allDrivetrainComponents.filter((c: any) => c.car_id === selectedCarId || isEmptyCarId(c.car_id)) : allDrivetrainComponents, [allDrivetrainComponents, selectedCarId]);
  const drivetrainSwapLogs = useMemo(() => (selectedCarId && selectedCarId !== '') ? allDrivetrainSwapLogs.filter((l: any) => l.car_id === selectedCarId || isEmptyCarId(l.car_id)) : allDrivetrainSwapLogs, [allDrivetrainSwapLogs, selectedCarId]);

  // Active vendors derived from centralized AppContext (no more independent fetching)
  const vendorsList = useMemo(() => allVendors.filter((v: any) => v.isActive), [allVendors]);


  
  type ActiveTab = 'engines' | 'heads' | 'superchargers' | 'swap_history' | 'transmission' | 'transmission_drive' | 'torque_converter' | 'third_member_rear_gear' | 'chassis_setup';


  const [activeTab, setActiveTab] = useState<ActiveTab>('engines');
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);
  const [expandedHead, setExpandedHead] = useState<string | null>(null);
  const [expandedSC, setExpandedSC] = useState<string | null>(null);
  const [expandedDT, setExpandedDT] = useState<string | null>(null);

  // Power Adder Type filter
  const [powerAdderTypeFilter, setPowerAdderTypeFilter] = useState<PowerAdderType | 'All'>('All');
  const filteredSuperchargers = useMemo(() => {
    if (powerAdderTypeFilter === 'All') return superchargers;
    return superchargers.filter((sc: any) => (sc.powerAdderType || 'Supercharger') === powerAdderTypeFilter);
  }, [superchargers, powerAdderTypeFilter]);


  // Drivetrain Swap Modal state
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapComponentType, setSwapComponentType] = useState<DrivetrainCategory>('transmission');
  const [swapPreviousId, setSwapPreviousId] = useState('');
  const [swapNewId, setSwapNewId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapPerformedBy, setSwapPerformedBy] = useState('');
  const [swapNotes, setSwapNotes] = useState('');

  // Swap counts by category
  const swapCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of drivetrainSwapLogs) {
      counts[log.componentType] = (counts[log.componentType] || 0) + 1;
    }
    return counts;
  }, [drivetrainSwapLogs]);

  const handlePerformSwap = async () => {
    if (!swapPreviousId || !swapNewId || !swapReason || !swapPerformedBy) return;
    await performDrivetrainSwap(swapComponentType, swapPreviousId, swapNewId, swapReason, swapPerformedBy, swapNotes);
    setShowSwapModal(false);
    setSwapPreviousId('');
    setSwapNewId('');
    setSwapReason('');
    setSwapPerformedBy('');
    setSwapNotes('');
  };

  // Auto-populate previous component when type changes
  useEffect(() => {
    const installed = drivetrainComponents.find(c => c.category === swapComponentType && c.currentlyInstalled);
    setSwapPreviousId(installed?.id || '');
    setSwapNewId('');
  }, [swapComponentType, drivetrainComponents]);

  // Get associated parts for a drivetrain component
  const getAssociatedParts = (compId: string) => partsInventory.filter(p => p.relatedDrivetrainComponentId === compId);


  // Drivetrain modal state
  const [showDTModal, setShowDTModal] = useState(false);
  const [editingDT, setEditingDT] = useState<DrivetrainComponent | null>(null);
  const defaultDT: DrivetrainComponent = {
    id: '', category: 'transmission', name: '', make: '', model: '', serialNumber: '', builder: '',
    installDate: getLocalDateString(), dateRemoved: '', totalPasses: 0,

    passesSinceService: 0, hours: 0, status: 'Ready', currentlyInstalled: false, notes: '', components: {}
  };
  const [newDT, setNewDT] = useState<DrivetrainComponent>(defaultDT);

  // Drivetrain category helpers
  const dtCategoryLabels: Record<DrivetrainCategory, string> = {
    transmission: 'Transmissions', transmission_drive: 'Transmission Drive',
    torque_converter: 'Torque Converter', third_member: '3rd Member', ring_and_pinion: 'Ring and Pinion'
  };
  const dtCategorySingular: Record<DrivetrainCategory, string> = {
    transmission: 'Transmission', transmission_drive: 'Transmission Drive',
    torque_converter: 'Torque Converter', third_member: '3rd Member', ring_and_pinion: 'Ring and Pinion'
  };
  const getDTByCategory = (cat: DrivetrainCategory) => drivetrainComponents.filter(c => c.category === cat);
  // Tab categories for individual drivetrain tabs (excludes third_member and ring_and_pinion which are combined)
  const dtTabCategories: DrivetrainCategory[] = ['transmission', 'transmission_drive', 'torque_converter'];
  // All drivetrain categories (used for swap modal, labels, etc.)
  const dtCategories: DrivetrainCategory[] = ['transmission', 'transmission_drive', 'torque_converter', 'third_member', 'ring_and_pinion'];
  const isDTTab = (tab: ActiveTab): boolean => dtTabCategories.includes(tab as DrivetrainCategory);
  // Combined 3rd Member & Rear Gear helpers
  const getCombinedRearGearComponents = () => drivetrainComponents.filter(c => c.category === 'third_member' || c.category === 'ring_and_pinion');
  const isCombinedRearGearTab = (tab: ActiveTab): boolean => tab === 'third_member_rear_gear';


  
  // Modals
  const [showEngineModal, setShowEngineModal] = useState(false);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showSCModal, setShowSCModal] = useState(false);
  const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
  const [editingHead, setEditingHead] = useState<CylinderHead | null>(null);
  const [editingSC, setEditingSC] = useState<Supercharger | null>(null);

  // Component editing
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<{
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain';
    parentId: string;
    componentKey: string;
    component: ComponentTracker;
    isNew: boolean;
  } | null>(null);


  // Default component for new components
  const defaultComponent: ComponentTracker = {
    name: '',
    installDate: getLocalDateString(),

    passCount: 0,
    serviceInterval: 50,
    inspectionInterval: 25,
    replaceInterval: 100,
    lastService: getLocalDateString(),
    lastInspection: getLocalDateString(),

    status: 'Good',
    notes: '',
    partNumber: '',
    vendor: ''
  };

  // Default components for new engine
  const defaultEngineComponents: Record<string, ComponentTracker> = {
    crankshaft: { ...defaultComponent, name: 'Crankshaft', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 300 },
    connectingRods: { ...defaultComponent, name: 'Connecting Rods', serviceInterval: 75, inspectionInterval: 25, replaceInterval: 200 },
    mainBearings: { ...defaultComponent, name: 'Main Bearings', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 75 },
    rodBearings: { ...defaultComponent, name: 'Rod Bearings', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 75 },
    pistons: { ...defaultComponent, name: 'Pistons', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
    wristPins: { ...defaultComponent, name: 'Wrist Pins', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
    pistonRings: { ...defaultComponent, name: 'Piston Rings', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 75 },
    cylinderSleeves: { ...defaultComponent, name: 'Cylinder Sleeves', serviceInterval: 150, inspectionInterval: 75, replaceInterval: 300 },
    camshaft: { ...defaultComponent, name: 'Camshaft', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
    camBearings: { ...defaultComponent, name: 'Cam Bearings', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
    lifters: { ...defaultComponent, name: 'Lifters', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 }
  };

  const defaultHeadComponents: Record<string, ComponentTracker> = {
    intakeValves: { ...defaultComponent, name: 'Intake Valves', serviceInterval: 75, inspectionInterval: 25, replaceInterval: 150 },
    exhaustValves: { ...defaultComponent, name: 'Exhaust Valves', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
    valveSeats: { ...defaultComponent, name: 'Valve Seats', serviceInterval: 150, inspectionInterval: 75, replaceInterval: 300 },
    valveGuides: { ...defaultComponent, name: 'Valve Guides', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
    valveSprings: { ...defaultComponent, name: 'Valve Springs', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 75 },
    springLocators: { ...defaultComponent, name: 'Spring Locators', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
    shims: { ...defaultComponent, name: 'Shims', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
    springRetainers: { ...defaultComponent, name: 'Spring Retainers', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
    lashCaps: { ...defaultComponent, name: 'Lash Caps', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
    rockerArms: { ...defaultComponent, name: 'Rocker Arms', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
    oilingJets: { ...defaultComponent, name: 'Oiling Jets', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 150 }
  };

  const defaultSCComponents: Record<string, ComponentTracker> = {
    impeller: { ...defaultComponent, name: 'Impeller', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
    bearings: { ...defaultComponent, name: 'Bearings', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
    seals: { ...defaultComponent, name: 'Seals', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
    gearDrive: { ...defaultComponent, name: 'Gear Drive', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
    belt: { ...defaultComponent, name: 'Belt', serviceInterval: 25, inspectionInterval: 10, replaceInterval: 50 }
  };

  // ─── Default Drivetrain Sub-Components by Category ────────────────────────────
  const defaultDTComponents: Record<DrivetrainCategory, Record<string, ComponentTracker>> = {
    transmission: {
      inputShaft: { ...defaultComponent, name: 'Input Shaft', serviceInterval: 150, inspectionInterval: 50, replaceInterval: 300 },
      outputShaft: { ...defaultComponent, name: 'Output Shaft', serviceInterval: 150, inspectionInterval: 50, replaceInterval: 300 },
      clutchPacks: { ...defaultComponent, name: 'Clutch Packs', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
      bands: { ...defaultComponent, name: 'Bands', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
      seals: { ...defaultComponent, name: 'Seals', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
      planetaryGears: { ...defaultComponent, name: 'Planetary Gears', serviceInterval: 200, inspectionInterval: 75, replaceInterval: 400 },
    },
    torque_converter: {
      stator: { ...defaultComponent, name: 'Stator', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
      impeller: { ...defaultComponent, name: 'Impeller', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
      turbine: { ...defaultComponent, name: 'Turbine', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 250 },
      lockUpClutch: { ...defaultComponent, name: 'Lock-up Clutch', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
    },
    transmission_drive: {
      driveShaft: { ...defaultComponent, name: 'Drive Shaft', serviceInterval: 150, inspectionInterval: 50, replaceInterval: 300 },
      uJoints: { ...defaultComponent, name: 'U-Joints', serviceInterval: 50, inspectionInterval: 25, replaceInterval: 100 },
      yoke: { ...defaultComponent, name: 'Yoke', serviceInterval: 150, inspectionInterval: 50, replaceInterval: 300 },
    },
    third_member: {
      carrierBearings: { ...defaultComponent, name: 'Carrier Bearings', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
      spiderGears: { ...defaultComponent, name: 'Spider Gears', serviceInterval: 150, inspectionInterval: 75, replaceInterval: 300 },
      axleShafts: { ...defaultComponent, name: 'Axle Shafts', serviceInterval: 200, inspectionInterval: 75, replaceInterval: 400 },
    },
    ring_and_pinion: {
      ringGear: { ...defaultComponent, name: 'Ring Gear', serviceInterval: 200, inspectionInterval: 75, replaceInterval: 400 },
      pinionGear: { ...defaultComponent, name: 'Pinion Gear', serviceInterval: 200, inspectionInterval: 75, replaceInterval: 400 },
      pinionBearings: { ...defaultComponent, name: 'Pinion Bearings', serviceInterval: 100, inspectionInterval: 50, replaceInterval: 200 },
      crushSleeve: { ...defaultComponent, name: 'Crush Sleeve', serviceInterval: 75, inspectionInterval: 35, replaceInterval: 150 },
    },
  };

  // Helper: get a fresh defaultDT with the correct default sub-components for a given category
  const getDefaultDTForCategory = (cat: DrivetrainCategory): DrivetrainComponent => ({
    id: '', category: cat, name: '', make: '', model: '', serialNumber: '', builder: '',
    installDate: getLocalDateString(), dateRemoved: '', totalPasses: 0,
    passesSinceService: 0, hours: 0, status: 'Ready', currentlyInstalled: false, notes: '',
    components: Object.fromEntries(
      Object.entries(defaultDTComponents[cat]).map(([k, v]) => [k, { ...v }])
    ),
  });



  const defaultEngine: Engine = {
    id: '',
    name: '',
    serialNumber: '',
    builder: '',
    installDate: getLocalDateString(),

    totalPasses: 0,
    passesSinceRebuild: 0,
    status: 'Ready',
    currentlyInstalled: false,
    notes: '',
    components: defaultEngineComponents
  };

  const defaultHead: CylinderHead = {
    id: '',
    name: '',
    serialNumber: '',
    builder: '',
    installDate: getLocalDateString(),

    totalPasses: 0,
    passesSinceRefresh: 0,
    status: 'Ready',
    position: 'Spare',
    notes: '',
    components: defaultHeadComponents
  };

  const defaultSupercharger: Supercharger = {
    id: '',
    name: '',
    serialNumber: '',
    model: '',
    installDate: getLocalDateString(),

    totalPasses: 0,
    passesSinceService: 0,
    status: 'Ready',
    currentlyInstalled: false,
    notes: '',
    components: defaultSCComponents
  };

  const [newEngine, setNewEngine] = useState<Engine>(defaultEngine);
  const [newHead, setNewHead] = useState<CylinderHead>(defaultHead);
  const [newSC, setNewSC] = useState<Supercharger>(defaultSupercharger);
  const [newComponent, setNewComponent] = useState<ComponentTracker>(defaultComponent);


  // ─── Service Alert System ───────────────────────────────────────────────────
  const [serviceAlertThreshold, setServiceAlertThreshold] = useState(80); // percentage
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertBannerDismissed, setAlertBannerDismissed] = useState(false);
  const [scAlertBannerDismissed, setScAlertBannerDismissed] = useState(false);
  const [showSCAlertSettings, setShowSCAlertSettings] = useState(false);
  const [scServiceAlertThreshold, setScServiceAlertThreshold] = useState(80);
  const [dtAlertBannerDismissed, setDtAlertBannerDismissed] = useState(false);
  const [showDTAlertSettings, setShowDTAlertSettings] = useState(false);
  const [dtServiceAlertThreshold, setDtServiceAlertThreshold] = useState(80);

  // ─── Record Pass Modal State ────────────────────────────────────────────────
  const [showRecordPassModal, setShowRecordPassModal] = useState(false);
  const [recordPassCount, setRecordPassCount] = useState(1);
  const [recordPassCarId, setRecordPassCarId] = useState<string>(selectedCarId || (activeCars.length === 1 ? activeCars[0].id : ''));
  const [recordPassLoading, setRecordPassLoading] = useState(false);

  // Keep recordPassCarId in sync with selectedCarId
  useEffect(() => {
    if (selectedCarId) setRecordPassCarId(selectedCarId);
  }, [selectedCarId]);

  // ─── Pass History Log ───────────────────────────────────────────────────────
  interface PassHistoryEntry {
    id: string;
    date: string;
    time: string;
    carId: string;
    carName: string;
    passCount: number;
    componentsUpdated: number;
    flaggedCount: number;
  }

  const PASS_HISTORY_KEY = 'setupLibrary_passHistory';
  const [passHistory, setPassHistory] = useState<PassHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(PASS_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showPassHistory, setShowPassHistory] = useState(false);

  const addPassHistoryEntry = (entry: PassHistoryEntry) => {
    const updated = [entry, ...passHistory].slice(0, 50); // keep last 50
    setPassHistory(updated);
    try { localStorage.setItem(PASS_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  };

  // ─── Bulk Service Reset State ───────────────────────────────────────────────
  const [showBulkResetModal, setShowBulkResetModal] = useState(false);
  const [bulkResetSelections, setBulkResetSelections] = useState<Record<string, boolean>>({});
  const [bulkResetLoading, setBulkResetLoading] = useState(false);

  // ─── Service Reset Confirmation Modal State ─────────────────────────────────
  const [showServiceResetConfirm, setShowServiceResetConfirm] = useState(false);
  const [serviceResetTarget, setServiceResetTarget] = useState<{
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain';
    parentId: string;
    parentName: string;
    counterLabel: string;
    currentCounterValue: number;
    subComponentCount: number;
    flaggedCount: number;
  } | null>(null);
  const [serviceResetLoading, setServiceResetLoading] = useState(false);




  // ─── Record Pass Handler ────────────────────────────────────────────────────
  const handleRecordPass = async () => {
    if (!recordPassCarId || recordPassCount < 1) return;
    setRecordPassLoading(true);

    const n = recordPassCount;
    const carId = recordPassCarId;
    const matchesCar = (item: any) => item.car_id === carId || isEmptyCarId(item.car_id);

    // Helper: increment sub-component pass counts and auto-flag status
    const bumpSubComponents = (comps: Record<string, ComponentTracker> | undefined): Record<string, ComponentTracker> | undefined => {
      if (!comps) return comps;
      const updated: Record<string, ComponentTracker> = {};
      for (const [key, comp] of Object.entries(comps)) {
        const newPassCount = comp.passCount + n;
        let newStatus: ComponentStatus = comp.status;
        // Auto-flag based on intervals
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

    let totalUpdated = 0;
    let flaggedDue: string[] = [];

    // Helper to collect flagged items
    const collectFlags = (parentName: string, comps: Record<string, ComponentTracker> | undefined) => {
      if (!comps) return;
      for (const comp of Object.values(comps)) {
        if (comp.status === 'Service' || comp.status === 'Replace' || comp.status === 'Inspect') {
          if (comp.status !== 'Good') {
            flaggedDue.push(`${parentName} > ${comp.name} [${comp.status}]`);
          }
        }
      }
    };

    try {
      // 1. Update installed engines
      const installedEngines = allEngines.filter((e: any) => e.currentlyInstalled && matchesCar(e));
      for (const eng of installedEngines) {
        const updatedComponents = bumpSubComponents(eng.components);
        await updateEngine(eng.id, {
          totalPasses: eng.totalPasses + n,
          passesSinceRebuild: eng.passesSinceRebuild + n,
          components: updatedComponents,
        });
        totalUpdated++;
        collectFlags(eng.name, updatedComponents);
      }

      // 2. Update active cylinder heads (status === 'Active')
      const activeHeads = allCylinderHeads.filter((h: any) => h.status === 'Active' && matchesCar(h));
      for (const head of activeHeads) {
        const updatedComponents = bumpSubComponents(head.components);
        await updateCylinderHead(head.id, {
          totalPasses: head.totalPasses + n,
          passesSinceRefresh: head.passesSinceRefresh + n,
          components: updatedComponents,
        });
        totalUpdated++;
        collectFlags(head.name, updatedComponents);
      }

      // 3. Update installed power adders
      const installedSCs = allSuperchargers.filter((s: any) => s.currentlyInstalled && matchesCar(s));
      for (const sc of installedSCs) {
        const scTyped = sc as Supercharger;
        const updatedComponents = bumpSubComponents(scTyped.components);
        await updateSupercharger(sc.id, {
          totalPasses: sc.totalPasses + n,
          passesSinceService: sc.passesSinceService + n,
          components: updatedComponents,
        });
        totalUpdated++;
        collectFlags(sc.name, updatedComponents);
      }

      // 4. Update installed drivetrain components
      const installedDT = allDrivetrainComponents.filter((d: any) => d.currentlyInstalled && matchesCar(d));
      for (const dt of installedDT) {
        const updatedComponents = bumpSubComponents(dt.components);
        await updateDrivetrainComponent(dt.id, {
          totalPasses: dt.totalPasses + n,
          passesSinceService: dt.passesSinceService + n,
          components: updatedComponents,
        });
        totalUpdated++;
        collectFlags(dt.name, updatedComponents);
      }

      // Un-dismiss alert banners so new alerts show immediately
      setAlertBannerDismissed(false);
      setScAlertBannerDismissed(false);
      setDtAlertBannerDismissed(false);

      // Show results
      if (flaggedDue.length > 0) {
        toast.warning(
          `Recorded ${n} pass${n > 1 ? 'es' : ''} across ${totalUpdated} components. ${flaggedDue.length} sub-component${flaggedDue.length !== 1 ? 's' : ''} now due for service!`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Recorded ${n} pass${n > 1 ? 'es' : ''} across ${totalUpdated} installed components. All sub-components within service limits.`,
          { duration: 5000 }
        );
      }
    } catch (err) {
      console.error('[RecordPass] Error:', err);
      toast.error('Failed to record passes. Some components may not have been updated.');
    } finally {
      // Log to pass history
      const now = new Date();
      addPassHistoryEntry({
        id: `PH-${Date.now()}`,
        date: getLocalDateString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        carId: carId,
        carName: getCarLabel(carId),
        passCount: n,
        componentsUpdated: totalUpdated,
        flaggedCount: flaggedDue.length,
      });
      setRecordPassLoading(false);
      setShowRecordPassModal(false);
      setRecordPassCount(1);
    }
  };




  interface ServiceAlertItem {
    parentType: 'engine' | 'powerAdder' | 'head' | 'drivetrain';
    parentId: string;
    parentName: string;
    componentName: string;
    passCount: number;
    serviceInterval: number;
    percentUsed: number;
    severity: 'warning' | 'critical'; // warning = threshold reached, critical = exceeded 100%
  }

  const serviceAlerts = useMemo<ServiceAlertItem[]>(() => {
    const alerts: ServiceAlertItem[] = [];
    const threshold = serviceAlertThreshold / 100;

    // Helper to check sub-components
    const checkComponents = (
      components: Record<string, ComponentTracker> | undefined,
      parentType: ServiceAlertItem['parentType'],
      parentId: string,
      parentName: string
    ) => {
      if (!components) return;
      Object.values(components).forEach((comp: ComponentTracker) => {
        if (comp.serviceInterval > 0) {
          const pct = comp.passCount / comp.serviceInterval;
          if (pct >= threshold) {
            alerts.push({
              parentType,
              parentId,
              parentName,
              componentName: comp.name,
              passCount: comp.passCount,
              serviceInterval: comp.serviceInterval,
              percentUsed: Math.round(pct * 100),
              severity: pct >= 1 ? 'critical' : 'warning'
            });
          }
        }
      });
    };

    // Check engines
    engines.forEach((eng) => {
      checkComponents(eng.components, 'engine', eng.id, eng.name);
    });

    // Check power adders
    superchargers.forEach((sc) => {
      const scTyped = sc as Supercharger;
      checkComponents(scTyped.components, 'powerAdder', sc.id, sc.name);
    });

    // Check cylinder heads
    cylinderHeads.forEach((head) => {
      checkComponents(head.components, 'head', head.id, head.name);
    });

    // Check drivetrain sub-components
    drivetrainComponents.forEach((dt) => {
      if (dt.components) {
        checkComponents(dt.components, 'drivetrain', dt.id, dt.name);
      }
    });

    // Sort: critical first, then by percentUsed descending
    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.percentUsed - a.percentUsed;
    });

    return alerts;
  }, [engines, superchargers, cylinderHeads, drivetrainComponents, serviceAlertThreshold]);

  // Set of parent IDs that have alerts (for card highlighting)
  const alertedParentIds = useMemo(() => new Set(serviceAlerts.map(a => a.parentId)), [serviceAlerts]);
  const criticalParentIds = useMemo(() => new Set(serviceAlerts.filter(a => a.severity === 'critical').map(a => a.parentId)), [serviceAlerts]);

  // ─── Power Adder-Specific Service Alert System ──────────────────────────────
  const scServiceAlerts = useMemo<ServiceAlertItem[]>(() => {
    const alerts: ServiceAlertItem[] = [];
    const threshold = scServiceAlertThreshold / 100;

    superchargers.forEach((sc) => {
      const scTyped = sc as Supercharger;
      if (!scTyped.components) return;
      Object.values(scTyped.components).forEach((comp: ComponentTracker) => {
        if (comp.serviceInterval > 0) {
          const pct = comp.passCount / comp.serviceInterval;
          if (pct >= threshold) {
            alerts.push({
              parentType: 'powerAdder',
              parentId: sc.id,
              parentName: sc.name,
              componentName: comp.name,
              passCount: comp.passCount,
              serviceInterval: comp.serviceInterval,
              percentUsed: Math.round(pct * 100),
              severity: pct >= 1 ? 'critical' : 'warning'
            });
          }
        }
      });
    });

    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.percentUsed - a.percentUsed;
    });

    return alerts;
  }, [superchargers, scServiceAlertThreshold]);

  const scAlertedParentIds = useMemo(() => new Set(scServiceAlerts.map(a => a.parentId)), [scServiceAlerts]);
  const scCriticalParentIds = useMemo(() => new Set(scServiceAlerts.filter(a => a.severity === 'critical').map(a => a.parentId)), [scServiceAlerts]);

  // ─── Drivetrain-Specific Service Alert System ───────────────────────────────
  const dtServiceAlerts = useMemo<ServiceAlertItem[]>(() => {
    const alerts: ServiceAlertItem[] = [];
    const threshold = dtServiceAlertThreshold / 100;

    drivetrainComponents.forEach((dt) => {
      if (!dt.components) return;
      Object.values(dt.components).forEach((comp: ComponentTracker) => {
        if (comp.serviceInterval > 0) {
          const pct = comp.passCount / comp.serviceInterval;
          if (pct >= threshold) {
            alerts.push({
              parentType: 'drivetrain',
              parentId: dt.id,
              parentName: dt.name,
              componentName: comp.name,
              passCount: comp.passCount,
              serviceInterval: comp.serviceInterval,
              percentUsed: Math.round(pct * 100),
              severity: pct >= 1 ? 'critical' : 'warning'
            });
          }
        }
      });
    });

    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.percentUsed - a.percentUsed;
    });

    return alerts;
  }, [drivetrainComponents, dtServiceAlertThreshold]);

  const dtAlertedParentIds = useMemo(() => new Set(dtServiceAlerts.map(a => a.parentId)), [dtServiceAlerts]);
  const dtCriticalParentIds = useMemo(() => new Set(dtServiceAlerts.filter(a => a.severity === 'critical').map(a => a.parentId)), [dtServiceAlerts]);

  // Filtered drivetrain alerts by active tab category
  const dtAlertsForActiveTab = useMemo(() => {
    if (isDTTab(activeTab)) {
      const cat = activeTab as DrivetrainCategory;
      const idsInCategory = new Set(getDTByCategory(cat).map(c => c.id));
      return dtServiceAlerts.filter(a => idsInCategory.has(a.parentId));
    }
    if (isCombinedRearGearTab(activeTab)) {
      const idsInCategory = new Set(getCombinedRearGearComponents().map(c => c.id));
      return dtServiceAlerts.filter(a => idsInCategory.has(a.parentId));
    }
    return [];
  }, [dtServiceAlerts, activeTab, drivetrainComponents]);



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'bg-green-500/20 text-green-400';
      case 'Inspect': return 'bg-blue-500/20 text-blue-400';
      case 'Service': return 'bg-yellow-500/20 text-yellow-400';
      case 'Replace': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getEngineStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Ready': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'Rebuild': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Retired': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      case 'Service': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'Refresh': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const countComponentIssues = (components: Record<string, ComponentTracker> | undefined) => {
    if (!components) return 0;
    return Object.values(components).filter((c: ComponentTracker) => c.status !== 'Good').length;
  };

  // Component handlers
  const handleEditComponent = (
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain',
    parentId: string,
    componentKey: string,
    component: ComponentTracker
  ) => {
    setEditingComponent({
      parentType,
      parentId,
      componentKey,
      component: { ...component },
      isNew: false
    });
    setNewComponent({ ...component });
    setShowComponentModal(true);
  };

  const handleAddComponent = (
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain',
    parentId: string
  ) => {
    const newKey = `custom_${Date.now()}`;
    setEditingComponent({
      parentType,
      parentId,
      componentKey: newKey,
      component: { ...defaultComponent },
      isNew: true
    });
    setNewComponent({ ...defaultComponent });
    setShowComponentModal(true);
  };

  const handleSaveComponent = async () => {
    if (!editingComponent) return;
    
    const { parentType, parentId, componentKey } = editingComponent;
    
    if (parentType === 'engine') {
      const engine = engines.find(e => e.id === parentId);
      if (engine) {
        const updatedComponents = {
          ...engine.components,
          [componentKey]: newComponent
        };
        await updateEngine(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'head') {
      const head = cylinderHeads.find(h => h.id === parentId);
      if (head) {
        const updatedComponents = {
          ...head.components,
          [componentKey]: newComponent
        };
        await updateCylinderHead(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'supercharger') {
      const sc = superchargers.find(s => s.id === parentId) as Supercharger;
      if (sc) {
        const updatedComponents = {
          ...(sc.components || {}),
          [componentKey]: newComponent
        };
        await updateSupercharger(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'drivetrain') {
      const dt = drivetrainComponents.find(d => d.id === parentId);
      if (dt) {
        const updatedComponents = {
          ...(dt.components || {}),
          [componentKey]: newComponent
        };
        await updateDrivetrainComponent(parentId, { components: updatedComponents });
      }
    }
    
    setShowComponentModal(false);
    setEditingComponent(null);
    setNewComponent(defaultComponent);
  };

  const handleDeleteComponent = async (
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain',
    parentId: string,
    componentKey: string
  ) => {
    if (!confirm('Are you sure you want to delete this component?')) return;
    
    if (parentType === 'engine') {
      const engine = engines.find(e => e.id === parentId);
      if (engine) {
        const updatedComponents = { ...engine.components };
        delete updatedComponents[componentKey];
        await updateEngine(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'head') {
      const head = cylinderHeads.find(h => h.id === parentId);
      if (head) {
        const updatedComponents = { ...head.components };
        delete updatedComponents[componentKey];
        await updateCylinderHead(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'supercharger') {
      const sc = superchargers.find(s => s.id === parentId) as Supercharger;
      if (sc && sc.components) {
        const updatedComponents = { ...sc.components };
        delete updatedComponents[componentKey];
        await updateSupercharger(parentId, { components: updatedComponents });
      }
    } else if (parentType === 'drivetrain') {
      const dt = drivetrainComponents.find(d => d.id === parentId);
      if (dt && dt.components) {
        const updatedComponents = { ...dt.components };
        delete updatedComponents[componentKey];
        await updateDrivetrainComponent(parentId, { components: updatedComponents });
      }
    }
  };


  // Engine handlers
  const handleSaveEngine = async () => {
    if (editingEngine) {
      await updateEngine(editingEngine.id, newEngine);
    } else {
      const id = `ENG-${String(engines.length + 1).padStart(3, '0')}`;
      await addEngine({ ...newEngine, id });
    }
    setShowEngineModal(false);
    setEditingEngine(null);
    setNewEngine(defaultEngine);
  };

  const handleDeleteEngine = async (id: string) => {
    const engine = engines.find(e => e.id === id);
    if (engine?.currentlyInstalled) {
      alert('Cannot delete an installed engine. Swap it out first.');
      return;
    }
    await deleteEngine(id);
  };


  // Head handlers
  const handleSaveHead = async () => {
    if (editingHead) {
      await updateCylinderHead(editingHead.id, newHead);
    } else {
      const id = `HEAD-${String(cylinderHeads.length + 1).padStart(3, '0')}`;
      await addCylinderHead({ ...newHead, id });
    }
    setShowHeadModal(false);
    setEditingHead(null);
    setNewHead(defaultHead);
  };

  const handleDeleteHead = async (id: string) => {
    const head = cylinderHeads.find(h => h.id === id);
    if (head?.status === 'Active') {
      alert('Cannot delete an active cylinder head. Remove it from the engine first.');
      return;
    }
    if (confirm('Are you sure you want to delete this cylinder head?')) {
      await deleteCylinderHead(id);
    }
  };

  // Supercharger handlers
  const handleSaveSC = async () => {
    if (editingSC) {
      await updateSupercharger(editingSC.id, newSC);
    } else {
      const id = `SC-${String(superchargers.length + 1).padStart(3, '0')}`;
      await addSupercharger({ ...newSC, id });
    }
    setShowSCModal(false);
    setEditingSC(null);
    setNewSC(defaultSupercharger);
  };

  const handleDeleteSC = async (id: string) => {
    const sc = superchargers.find(s => s.id === id);
    if (sc?.currentlyInstalled) {
      alert('Cannot delete an installed power adder. Swap it out first.');
      return;
    }
    if (confirm('Are you sure you want to delete this power adder?')) {

      await deleteSupercharger(id);
    }
  };

  // ─── Reset After Service Handler ────────────────────────────────────────────
  const resetSubComponents = (comps: Record<string, ComponentTracker> | undefined): Record<string, ComponentTracker> | undefined => {
    if (!comps) return comps;
    const today = getLocalDateString();
    const updated: Record<string, ComponentTracker> = {};
    for (const [key, comp] of Object.entries(comps)) {
      updated[key] = { ...comp, passCount: 0, status: 'Good' as ComponentStatus, lastService: today, lastInspection: today };
    }
    return updated;
  };

  // ─── Open Service Reset Confirmation Modal ───────────────────────────────────
  const openServiceResetConfirmation = (parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain', parentId: string) => {
    let parentName = '';
    let counterLabel = '';
    let currentCounterValue = 0;
    let subComponentCount = 0;
    let flaggedCount = 0;

    if (parentType === 'engine') {
      const eng = engines.find(e => e.id === parentId);
      if (!eng) return;
      parentName = eng.name;
      counterLabel = 'passesSinceRebuild';
      currentCounterValue = eng.passesSinceRebuild;
      subComponentCount = eng.components ? Object.keys(eng.components).length : 0;
      flaggedCount = countComponentIssues(eng.components);
    } else if (parentType === 'head') {
      const head = cylinderHeads.find(h => h.id === parentId);
      if (!head) return;
      parentName = head.name;
      counterLabel = 'passesSinceRefresh';
      currentCounterValue = head.passesSinceRefresh;
      subComponentCount = head.components ? Object.keys(head.components).length : 0;
      flaggedCount = countComponentIssues(head.components);
    } else if (parentType === 'supercharger') {
      const sc = superchargers.find(s => s.id === parentId) as Supercharger | undefined;
      if (!sc) return;
      parentName = sc.name;
      counterLabel = 'passesSinceService';
      currentCounterValue = sc.passesSinceService;
      subComponentCount = sc.components ? Object.keys(sc.components).length : 0;
      flaggedCount = countComponentIssues(sc.components);
    } else if (parentType === 'drivetrain') {
      const dt = drivetrainComponents.find(d => d.id === parentId);
      if (!dt) return;
      parentName = dt.name;
      counterLabel = 'passesSinceService';
      currentCounterValue = dt.passesSinceService;
      subComponentCount = dt.components ? Object.keys(dt.components).length : 0;
      flaggedCount = countComponentIssues(dt.components);
    }

    setServiceResetTarget({ parentType, parentId, parentName, counterLabel, currentCounterValue, subComponentCount, flaggedCount });
    setShowServiceResetConfirm(true);
  };

  // ─── Confirm & Execute Service Reset ────────────────────────────────────────
  const confirmServiceReset = async () => {
    if (!serviceResetTarget) return;
    setServiceResetLoading(true);
    const { parentType, parentId, parentName, subComponentCount } = serviceResetTarget;
    try {
      if (parentType === 'engine') {
        const eng = engines.find(e => e.id === parentId);
        if (eng) {
          await updateEngine(parentId, { passesSinceRebuild: 0, components: resetSubComponents(eng.components) });
        }
      } else if (parentType === 'head') {
        const head = cylinderHeads.find(h => h.id === parentId);
        if (head) {
          await updateCylinderHead(parentId, { passesSinceRefresh: 0, components: resetSubComponents(head.components) });
        }
      } else if (parentType === 'supercharger') {
        const sc = superchargers.find(s => s.id === parentId) as Supercharger | undefined;
        if (sc) {
          await updateSupercharger(parentId, { passesSinceService: 0, components: resetSubComponents(sc.components) });
        }
      } else if (parentType === 'drivetrain') {
        const dt = drivetrainComponents.find(d => d.id === parentId);
        if (dt) {
          await updateDrivetrainComponent(parentId, { passesSinceService: 0, components: resetSubComponents(dt.components) });
        }
      }
      // Un-dismiss alert banners so cleared alerts disappear
      setAlertBannerDismissed(false);
      setScAlertBannerDismissed(false);
      setDtAlertBannerDismissed(false);
      toast.success(`${parentName}: service counters reset to 0. All ${subComponentCount} sub-components marked Good.`, { duration: 5000 });
    } catch (err) {
      console.error('[ServiceReset] Error:', err);
      toast.error('Failed to reset service counters.');
    } finally {
      setServiceResetLoading(false);
      setShowServiceResetConfirm(false);
      setServiceResetTarget(null);
    }
  };

  // Legacy handler (used by "Mark Serviced" inside expanded component grid — uses browser confirm)
  const handleServiceReset = async (parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain', parentId: string) => {
    openServiceResetConfirmation(parentType, parentId);
  };


  // ─── Bulk Service Reset Handler ─────────────────────────────────────────────
  const handleBulkServiceReset = async () => {
    const selectedIds = Object.entries(bulkResetSelections).filter(([_, v]) => v).map(([k]) => k);
    if (selectedIds.length === 0) return;
    setBulkResetLoading(true);
    let resetCount = 0;
    try {
      for (const id of selectedIds) {
        // Check engines
        const eng = allEngines.find((e: any) => e.id === id);
        if (eng) {
          await updateEngine(id, { passesSinceRebuild: 0, components: resetSubComponents(eng.components) });
          resetCount++;
          continue;
        }
        // Check heads
        const head = allCylinderHeads.find((h: any) => h.id === id);
        if (head) {
          await updateCylinderHead(id, { passesSinceRefresh: 0, components: resetSubComponents(head.components) });
          resetCount++;
          continue;
        }
        // Check power adders
        const sc = allSuperchargers.find((s: any) => s.id === id) as Supercharger | undefined;
        if (sc) {
          await updateSupercharger(id, { passesSinceService: 0, components: resetSubComponents(sc.components) });
          resetCount++;
          continue;
        }
        // Check drivetrain
        const dt = allDrivetrainComponents.find((d: any) => d.id === id);
        if (dt) {
          await updateDrivetrainComponent(id, { passesSinceService: 0, components: resetSubComponents(dt.components) });
          resetCount++;
          continue;
        }
      }
      toast.success(`Bulk service reset complete: ${resetCount} component${resetCount !== 1 ? 's' : ''} reset to zero.`);
      setAlertBannerDismissed(false);
      setScAlertBannerDismissed(false);
      setDtAlertBannerDismissed(false);
    } catch (err) {
      console.error('[BulkReset] Error:', err);
      toast.error('Bulk reset encountered errors. Some components may not have been reset.');
    } finally {
      setBulkResetLoading(false);
      setShowBulkResetModal(false);
      setBulkResetSelections({});
    }
  };


  // Component grid renderer
  const renderComponentGrid = (
    components: Record<string, ComponentTracker> | undefined,
    parentType: 'engine' | 'head' | 'supercharger' | 'drivetrain',
    parentId: string
  ) => {
    if (!components) return null;

    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-white">Components</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleServiceReset(parentType, parentId); }}
              className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm hover:bg-cyan-500/30"
              title="Mark Serviced — reset all sub-component pass counts to 0"
            >
              <RotateCcw className="w-3 h-3" />
              Mark Serviced
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddComponent(parentType, parentId); }}
              className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-sm hover:bg-orange-500/30"
            >
              <Plus className="w-3 h-3" />
              Add Component
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">

          {Object.entries(components).map(([key, comp]) => (
            <div 
              key={key} 
              className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200 text-sm font-medium truncate">{comp.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(comp.status)}`}>
                    {comp.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {comp.passCount} passes | Service: {comp.serviceInterval}
                </div>
                {comp.vendor && (
                  <div className="text-xs text-slate-500 truncate">{comp.vendor}</div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditComponent(parentType, parentId, key, comp);
                  }}
                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                  title="Edit component"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComponent(parentType, parentId, key);
                  }}
                  className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                  title="Delete component"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Main Components</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {passHistory.length > 0 && (
              <button
                onClick={() => setShowPassHistory(!showPassHistory)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                Pass Log ({passHistory.length})
              </button>
            )}
            <button
              onClick={() => {
                const selections: Record<string, boolean> = {};
                engines.forEach(e => { selections[e.id] = false; });
                cylinderHeads.forEach(h => { selections[h.id] = false; });
                superchargers.forEach(s => { selections[s.id] = false; });
                drivetrainComponents.forEach(d => { selections[d.id] = false; });
                setBulkResetSelections(selections);
                setShowBulkResetModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors whitespace-nowrap"
            >
              <ListChecks className="w-4 h-4" />
              Bulk Service Reset
            </button>
            <button
              onClick={() => {
                setRecordPassCarId(selectedCarId || (activeCars.length === 1 ? activeCars[0].id : ''));
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

        {/* Pass History Log */}
        {showPassHistory && passHistory.length > 0 && (
          <div className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-400" />
                Pass History Log
              </h3>
              <button onClick={() => setShowPassHistory(false)} className="text-slate-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {passHistory.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Play className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        +{entry.passCount} pass{entry.passCount !== 1 ? 'es' : ''} <span className="text-slate-400 font-normal">on</span> {entry.carName}
                      </p>
                      <p className="text-xs text-slate-500">{entry.date} at {entry.time} &middot; {entry.componentsUpdated} components updated</p>
                    </div>
                  </div>
                  {entry.flaggedCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-medium whitespace-nowrap">
                      {entry.flaggedCount} flagged
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Service Alert Banner */}
        {serviceAlerts.length > 0 && !alertBannerDismissed && (
          <div className={`mb-6 rounded-xl border p-4 ${serviceAlerts.some(a => a.severity === 'critical') ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className={`mt-0.5 p-2 rounded-lg ${serviceAlerts.some(a => a.severity === 'critical') ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                  <ShieldAlert className={`w-5 h-5 ${serviceAlerts.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-semibold ${serviceAlerts.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`}>
                      Service Alerts: {serviceAlerts.length} component{serviceAlerts.length !== 1 ? 's' : ''} need attention
                    </h3>
                    <span className="text-xs text-slate-500">Threshold: {serviceAlertThreshold}%</span>
                    <button onClick={() => setShowAlertSettings(!showAlertSettings)} className="text-xs text-slate-400 hover:text-white underline">
                      {showAlertSettings ? 'Hide' : 'Settings'}
                    </button>
                  </div>
                  {showAlertSettings && (
                    <div className="flex items-center gap-3 mb-3 p-2 bg-slate-800/60 rounded-lg">
                      <label className="text-xs text-slate-400 whitespace-nowrap">Alert Threshold:</label>
                      <input
                        type="range"
                        min={50}
                        max={100}
                        value={serviceAlertThreshold}
                        onChange={(e) => setServiceAlertThreshold(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <span className="text-sm font-bold text-white w-10 text-right">{serviceAlertThreshold}%</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                    {serviceAlerts.slice(0, 9).map((alert, idx) => (
                      <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                        <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                        <span className="truncate">
                          <span className="font-medium">{alert.parentName}</span> - {alert.componentName} ({alert.percentUsed}%)
                        </span>
                      </div>
                    ))}
                    {serviceAlerts.length > 9 && (
                      <div className="text-xs text-slate-500 px-2 py-1">+{serviceAlerts.length - 9} more...</div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setAlertBannerDismissed(true)} className="text-slate-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}


        {/* Tabs - scrollable */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab('engines')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'engines' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <Zap className="w-4 h-4" />
            Engines ({engines.length})
          </button>
          <button onClick={() => setActiveTab('superchargers')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'superchargers' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <Wind className="w-4 h-4" />
            Power Adders ({superchargers.length})

          </button>
          <button onClick={() => setActiveTab('heads')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'heads' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <Settings className="w-4 h-4" />
            Cylinder Heads ({cylinderHeads.length})
          </button>
          <button onClick={() => setActiveTab('swap_history')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'swap_history' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <History className="w-4 h-4" />
            Swap History ({drivetrainSwapLogs.length})
          </button>
          {dtTabCategories.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat as ActiveTab)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === cat ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              <Wrench className="w-4 h-4" />
              {dtCategoryLabels[cat]} ({getDTByCategory(cat).length})
            </button>
          ))}
          {/* Combined 3rd Member & Rear Gear tab */}
          <button onClick={() => setActiveTab('third_member_rear_gear')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'third_member_rear_gear' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <Wrench className="w-4 h-4" />
            3rd Member & Rear Gear ({getCombinedRearGearComponents().length})
          </button>
          {/* Chassis Setup tab */}
          <button onClick={() => setActiveTab('chassis_setup')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'chassis_setup' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Chassis Setup
          </button>
        </div>


        {/* Engines Tab */}
        {activeTab === 'engines' && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingEngine(null);
                  setNewEngine(defaultEngine);
                  setShowEngineModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Engine
              </button>
            </div>
            
            {engines.map((engine) => {
              const issueCount = countComponentIssues(engine.components);
              
              return (
                <div 
                  key={engine.id}
                  className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                    criticalParentIds.has(engine.id) ? 'border-red-500/70 animate-pulse ring-1 ring-red-500/30' :
                    alertedParentIds.has(engine.id) ? 'border-amber-500/60 ring-1 ring-amber-500/20' :
                    engine.currentlyInstalled ? 'border-green-500/50' : 'border-slate-700/50'
                  }`}

                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-700/20"
                    onClick={() => setExpandedEngine(expandedEngine === engine.id ? null : engine.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          engine.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                          <Zap className={`w-6 h-6 ${engine.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{engine.name}</h3>
                            {engine.currentlyInstalled && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                                INSTALLED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">S/N: {engine.serialNumber} | {engine.builder}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-white font-medium">{engine.totalPasses} total passes</p>
                          <p className="text-sm text-slate-400">{engine.passesSinceRebuild} since rebuild</p>
                        </div>
                        
                        {issueCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {issueCount}
                          </div>
                        )}
                        
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${getEngineStatusColor(engine.status)}`}>
                          {engine.status}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceReset('engine', engine.id);
                            }}
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                            title="Reset Service Counters — reset passesSinceRebuild to 0 and all sub-component pass counts to 0"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEngine(engine as Engine);
                              setNewEngine(engine as Engine);
                              setShowEngineModal(true);
                            }}
                            className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEngine(engine.id);
                            }}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        
                        {expandedEngine === engine.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedEngine === engine.id && (
                    <div className="border-t border-slate-700/50 p-4">
                      <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <h4 className="font-medium text-white mb-3">Engine Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Install Date</span>
                              <span className="text-white">{engine.installDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Passes</span>
                              <span className="text-white">{engine.totalPasses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Since Rebuild</span>
                              <span className="text-white">{engine.passesSinceRebuild}</span>
                            </div>
                          </div>
                          {engine.notes && (
                            <p className="mt-3 text-sm text-slate-400 italic">{engine.notes}</p>
                          )}
                        </div>
                        
                        <div className="md:col-span-2">
                          {renderComponentGrid(engine.components, 'engine', engine.id)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Power Adders Tab */}
        {activeTab === 'superchargers' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              {/* Filter by Power Adder Type */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPowerAdderTypeFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${powerAdderTypeFilter === 'All' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                >
                  All ({superchargers.length})
                </button>
                {POWER_ADDER_TYPES.map(type => {
                  const count = superchargers.filter((s: any) => (s.powerAdderType || 'Supercharger') === type).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={type}
                      onClick={() => setPowerAdderTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${powerAdderTypeFilter === type ? 'bg-orange-500 text-white border-orange-500' : `${getPowerAdderTypeBadgeColor(type)} hover:opacity-80`}`}
                    >
                      {type} ({count})
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setEditingSC(null);
                  setNewSC(defaultSupercharger);
                  setShowSCModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Power Adder
              </button>
            </div>

            {/* Power Adder Service Alert Banner */}
            {scServiceAlerts.length > 0 && !scAlertBannerDismissed && (
              <div className={`mb-4 rounded-xl border p-4 ${scServiceAlerts.some(a => a.severity === 'critical') ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 p-2 rounded-lg ${scServiceAlerts.some(a => a.severity === 'critical') ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      <ShieldAlert className={`w-5 h-5 ${scServiceAlerts.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-semibold ${scServiceAlerts.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`}>
                          Power Adder Alerts: {scServiceAlerts.length} component{scServiceAlerts.length !== 1 ? 's' : ''} need attention
                        </h3>
                        <span className="text-xs text-slate-500">Threshold: {scServiceAlertThreshold}%</span>
                        <button onClick={() => setShowSCAlertSettings(!showSCAlertSettings)} className="text-xs text-slate-400 hover:text-white underline">
                          {showSCAlertSettings ? 'Hide' : 'Settings'}
                        </button>
                      </div>
                      {showSCAlertSettings && (
                        <div className="flex items-center gap-3 mb-3 p-2 bg-slate-800/60 rounded-lg">
                          <label className="text-xs text-slate-400 whitespace-nowrap">Alert Threshold:</label>
                          <input
                            type="range"
                            min={50}
                            max={100}
                            value={scServiceAlertThreshold}
                            onChange={(e) => setScServiceAlertThreshold(parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <span className="text-sm font-bold text-white w-10 text-right">{scServiceAlertThreshold}%</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                        {scServiceAlerts.slice(0, 9).map((alert, idx) => (
                          <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                            <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                            <span className="truncate">
                              <span className="font-medium">{alert.parentName}</span> - {alert.componentName} ({alert.percentUsed}%)
                            </span>
                          </div>
                        ))}
                        {scServiceAlerts.length > 9 && (
                          <div className="text-xs text-slate-500 px-2 py-1">+{scServiceAlerts.length - 9} more...</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setScAlertBannerDismissed(true)} className="text-slate-500 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {filteredSuperchargers.map((sc) => {
              const scTyped = sc as Supercharger;
              const issueCount = countComponentIssues(scTyped.components);
              const paType = (sc as any).powerAdderType || 'Supercharger';
              
              return (
                <div 
                  key={sc.id}
                  className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                    scCriticalParentIds.has(sc.id) ? 'border-red-500/70 animate-pulse ring-1 ring-red-500/30' :
                    scAlertedParentIds.has(sc.id) ? 'border-amber-500/60 ring-1 ring-amber-500/20' :
                    sc.currentlyInstalled ? 'border-green-500/50' : 'border-slate-700/50'
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-700/20"

                    onClick={() => setExpandedSC(expandedSC === sc.id ? null : sc.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          sc.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                          <Wind className={`w-6 h-6 ${sc.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-white">{sc.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded font-medium border ${getPowerAdderTypeBadgeColor(paType)}`}>
                              {paType}
                            </span>
                            {sc.currentlyInstalled && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                                INSTALLED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">S/N: {sc.serialNumber} | {sc.model}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-white font-medium">{sc.totalPasses} total passes</p>
                          <p className="text-sm text-slate-400">{sc.passesSinceService} since service</p>
                        </div>
                        
                        {issueCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {issueCount}
                          </div>
                        )}
                        
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${getEngineStatusColor(sc.status)}`}>
                          {sc.status}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceReset('supercharger', sc.id);
                            }}
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                            title="Reset Service Counters — reset passesSinceService to 0 and all sub-component pass counts to 0"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSC(scTyped);
                              setNewSC(scTyped);
                              setShowSCModal(true);
                            }}
                            className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSC(sc.id);
                            }}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        
                        {expandedSC === sc.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedSC === sc.id && (
                    <div className="border-t border-slate-700/50 p-4">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <h4 className="font-medium text-white mb-3">Power Adder Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Type</span>
                              <span className={`px-2 py-0.5 text-xs rounded font-medium border ${getPowerAdderTypeBadgeColor(paType)}`}>{paType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Model</span>
                              <span className="text-white">{sc.model}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Install Date</span>
                              <span className="text-white">{sc.installDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Passes</span>
                              <span className="text-white">{sc.totalPasses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Since Service</span>
                              <span className="text-white">{sc.passesSinceService}</span>
                            </div>
                          </div>
                          {sc.notes && (
                            <p className="mt-3 text-sm text-slate-400 italic">{sc.notes}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          {renderComponentGrid(scTyped.components, 'supercharger', sc.id)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}


        {/* Cylinder Heads Tab */}
        {activeTab === 'heads' && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingHead(null);
                  setNewHead(defaultHead);
                  setShowHeadModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Cylinder Head
              </button>
            </div>
            
            {cylinderHeads.map((head) => {
              const issueCount = countComponentIssues(head.components);
              const assignedEngine = engines.find(e => e.id === head.engineId);
              
              return (
                <div 
                  key={head.id}
                  className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                    criticalParentIds.has(head.id) ? 'border-red-500/70 animate-pulse ring-1 ring-red-500/30' :
                    alertedParentIds.has(head.id) ? 'border-amber-500/60 ring-1 ring-amber-500/20' :
                    head.status === 'Active' ? 'border-green-500/50' : 'border-slate-700/50'
                  }`}

                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-700/20"
                    onClick={() => setExpandedHead(expandedHead === head.id ? null : head.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          head.status === 'Active' ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                          <Settings className={`w-6 h-6 ${head.status === 'Active' ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{head.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                              head.position === 'Left' ? 'bg-blue-500/20 text-blue-400' :
                              head.position === 'Right' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {head.position}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">
                            S/N: {head.serialNumber}
                            {assignedEngine && ` | Assigned to: ${assignedEngine.name}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-white font-medium">{head.totalPasses} total passes</p>
                          <p className="text-sm text-slate-400">{head.passesSinceRefresh} since refresh</p>
                        </div>
                        
                        {issueCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {issueCount}
                          </div>
                        )}
                        
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${getEngineStatusColor(head.status)}`}>
                          {head.status}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceReset('head', head.id);
                            }}
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                            title="Reset Service Counters — reset passesSinceRefresh to 0 and all sub-component pass counts to 0"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingHead(head as CylinderHead);
                              setNewHead(head as CylinderHead);
                              setShowHeadModal(true);
                            }}
                            className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHead(head.id);
                            }}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        
                        {expandedHead === head.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedHead === head.id && (
                    <div className="border-t border-slate-700/50 p-4">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <h4 className="font-medium text-white mb-3">Head Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Builder</span>
                              <span className="text-white">{head.builder}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Install Date</span>
                              <span className="text-white">{head.installDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Passes</span>
                              <span className="text-white">{head.totalPasses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Since Refresh</span>
                              <span className="text-white">{head.passesSinceRefresh}</span>
                            </div>
                          </div>
                          {head.notes && (
                            <p className="mt-3 text-sm text-slate-400 italic">{head.notes}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          {renderComponentGrid(head.components, 'head', head.id)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Drivetrain Swap History Tab */}
        {activeTab === 'swap_history' && (
          <div className="space-y-6">
            {/* Header with Perform Swap button and stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {(['transmission', 'torque_converter', 'third_member', 'transmission_drive', 'ring_and_pinion'] as DrivetrainCategory[]).map(cat => (
                  <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50">
                    <span className="text-xs text-slate-400">{dtCategorySingular[cat]}</span>
                    <span className="text-sm font-bold text-cyan-400">{swapCountsByCategory[cat] || 0}</span>
                    <span className="text-xs text-slate-500">swaps</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowSwapModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Perform Swap
              </button>
            </div>

            {/* Timeline */}
            {drivetrainSwapLogs.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <History className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg font-medium">No Drivetrain Swaps Recorded</p>
                <p className="text-slate-500 text-sm mt-1">Swap events will appear here when you change drivetrain components</p>
                <button onClick={() => setShowSwapModal(true)} className="mt-4 px-4 py-2 bg-cyan-600/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-600/30 transition-colors">
                  Record First Swap
                </button>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/60 via-cyan-500/30 to-transparent" />

                <div className="space-y-0">
                  {drivetrainSwapLogs.map((log, idx) => {
                    const prevComp = drivetrainComponents.find(c => c.id === log.previousComponentId);
                    const newComp = drivetrainComponents.find(c => c.id === log.newComponentId);
                    const catColor = log.componentType === 'transmission' ? 'cyan' :
                      log.componentType === 'torque_converter' ? 'purple' :
                      log.componentType === 'third_member' ? 'amber' :
                      log.componentType === 'ring_and_pinion' ? 'emerald' : 'blue';
                    const dotBg = `bg-${catColor}-500`;
                    const tagBg = `bg-${catColor}-500/20`;
                    const tagText = `text-${catColor}-400`;

                    return (
                      <div key={log.id} className="relative pl-14 pb-8 group">
                        {/* Timeline dot */}
                        <div className={`absolute left-[17px] top-1 w-5 h-5 rounded-full border-2 border-slate-900 z-10 flex items-center justify-center ${
                          idx === 0 ? 'bg-cyan-500 ring-4 ring-cyan-500/20' : 'bg-slate-600 group-hover:bg-cyan-500'
                        } transition-colors`}>
                          <RefreshCw className="w-2.5 h-2.5 text-white" />
                        </div>

                        <div className={`bg-slate-800/70 rounded-xl border ${idx === 0 ? 'border-cyan-500/30' : 'border-slate-700/50'} p-5 hover:border-slate-600/70 transition-all`}>
                          {/* Top row: date + category tag */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-300">
                                {formatLocalDate(log.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}


                              </span>
                              {log.time && <span className="text-xs text-slate-500">{log.time}</span>}
                              {idx === 0 && <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded font-medium">LATEST</span>}
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                              log.componentType === 'transmission' ? 'bg-cyan-500/20 text-cyan-400' :
                              log.componentType === 'torque_converter' ? 'bg-purple-500/20 text-purple-400' :
                              log.componentType === 'third_member' ? 'bg-amber-500/20 text-amber-400' :
                              log.componentType === 'ring_and_pinion' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {dtCategorySingular[log.componentType] || log.componentType}
                            </span>
                          </div>

                          {/* Swap arrow visualization */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                              <p className="text-xs text-red-400 mb-0.5 uppercase tracking-wide">Removed</p>
                              <p className="text-sm font-semibold text-white">{prevComp?.name || log.previousComponentName || 'Unknown'}</p>
                              {prevComp && <p className="text-xs text-slate-500 mt-0.5">{prevComp.make} {prevComp.model}</p>}
                            </div>
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                <ArrowRight className="w-4 h-4 text-cyan-400" />
                              </div>
                            </div>
                            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                              <p className="text-xs text-green-400 mb-0.5 uppercase tracking-wide">Installed</p>
                              <p className="text-sm font-semibold text-white">{newComp?.name || log.newComponentName || 'Unknown'}</p>
                              {newComp && <p className="text-xs text-slate-500 mt-0.5">{newComp.make} {newComp.model}</p>}
                            </div>
                          </div>

                          {/* Details row */}
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            {log.reason && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-medium text-slate-300">Reason:</span> {log.reason}
                              </div>
                            )}
                            {log.performedBy && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>{log.performedBy}</span>
                              </div>
                            )}
                          </div>
                          {log.notes && (
                            <p className="mt-2 text-xs text-slate-500 italic border-t border-slate-700/50 pt-2">{log.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Drivetrain Category Tabs */}
        {isDTTab(activeTab) && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingDT(null);
                  setNewDT(getDefaultDTForCategory(activeTab as DrivetrainCategory));

                  setShowDTModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add {dtCategorySingular[activeTab as DrivetrainCategory]}
              </button>
            </div>

            {/* Drivetrain Service Alert Banner */}
            {dtAlertsForActiveTab.length > 0 && !dtAlertBannerDismissed && (
              <div className={`mb-4 rounded-xl border p-4 ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 p-2 rounded-lg ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      <ShieldAlert className={`w-5 h-5 ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-semibold ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`}>
                          Drivetrain Alerts: {dtAlertsForActiveTab.length} component{dtAlertsForActiveTab.length !== 1 ? 's' : ''} need attention
                        </h3>
                        <span className="text-xs text-slate-500">Threshold: {dtServiceAlertThreshold}%</span>
                        <button onClick={() => setShowDTAlertSettings(!showDTAlertSettings)} className="text-xs text-slate-400 hover:text-white underline">
                          {showDTAlertSettings ? 'Hide' : 'Settings'}
                        </button>
                      </div>
                      {showDTAlertSettings && (
                        <div className="flex items-center gap-3 mb-3 p-2 bg-slate-800/60 rounded-lg">
                          <label className="text-xs text-slate-400 whitespace-nowrap">Alert Threshold:</label>
                          <input
                            type="range"
                            min={50}
                            max={100}
                            value={dtServiceAlertThreshold}
                            onChange={(e) => setDtServiceAlertThreshold(parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <span className="text-sm font-bold text-white w-10 text-right">{dtServiceAlertThreshold}%</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                        {dtAlertsForActiveTab.slice(0, 9).map((alert, idx) => (
                          <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                            <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                            <span className="truncate">
                              <span className="font-medium">{alert.parentName}</span> - {alert.componentName} ({alert.percentUsed}%)
                            </span>
                          </div>
                        ))}
                        {dtAlertsForActiveTab.length > 9 && (
                          <div className="text-xs text-slate-500 px-2 py-1">+{dtAlertsForActiveTab.length - 9} more...</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setDtAlertBannerDismissed(true)} className="text-slate-500 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {getDTByCategory(activeTab as DrivetrainCategory).length === 0 && (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-lg">No {dtCategoryLabels[activeTab as DrivetrainCategory].toLowerCase()} added yet</p>
                <p className="text-slate-500 text-sm mt-1">Click the button above to add your first {dtCategorySingular[activeTab as DrivetrainCategory].toLowerCase()}</p>
              </div>
            )}

            {getDTByCategory(activeTab as DrivetrainCategory).map((comp) => (
              <div
                key={comp.id}
                className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                  dtCriticalParentIds.has(comp.id) ? 'border-red-500/70 animate-pulse ring-1 ring-red-500/30' :
                  dtAlertedParentIds.has(comp.id) ? 'border-amber-500/60 ring-1 ring-amber-500/20' :
                  comp.currentlyInstalled ? 'border-green-500/50' : 'border-slate-700/50'
                }`}
              >
                <div

                  className="p-4 cursor-pointer hover:bg-slate-700/20"
                  onClick={() => setExpandedDT(expandedDT === comp.id ? null : comp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        comp.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
                      }`}>
                        <Wrench className={`w-6 h-6 ${comp.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{comp.name}</h3>
                          {comp.currentlyInstalled && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                              INSTALLED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {comp.make && `${comp.make} `}{comp.model && `${comp.model} | `}S/N: {comp.serialNumber || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-white font-medium">{comp.totalPasses} total passes</p>
                        <p className="text-sm text-slate-400">{comp.passesSinceService} since service{comp.hours > 0 ? ` | ${comp.hours} hrs` : ''}</p>
                      </div>

                      <span className={`px-3 py-1 rounded text-sm font-medium border ${getEngineStatusColor(comp.status)}`}>
                        {comp.status}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceReset('drivetrain', comp.id);
                          }}
                          className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                          title="Reset Service Counters — reset passesSinceService to 0 and all sub-component pass counts to 0"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDT(comp);
                            setNewDT({ ...comp });
                            setShowDTModal(true);
                          }}
                          className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (comp.currentlyInstalled) {
                              alert(`Cannot delete an installed ${dtCategorySingular[comp.category].toLowerCase()}. Remove it first.`);
                              return;
                            }
                            if (confirm(`Are you sure you want to delete this ${dtCategorySingular[comp.category].toLowerCase()}?`)) {
                              deleteDrivetrainComponent(comp.id);
                            }
                          }}
                          className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>


                      {expandedDT === comp.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedDT === comp.id && (
                  <div className="border-t border-slate-700/50 p-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-medium text-white mb-3">{dtCategorySingular[comp.category]} Details</h4>
                        <div className="space-y-2 text-sm">
                          {comp.make && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Make</span>
                              <span className="text-white">{comp.make}</span>
                            </div>
                          )}
                          {comp.model && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Model</span>
                              <span className="text-white">{comp.model}</span>
                            </div>
                          )}
                          {comp.serialNumber && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Serial Number</span>
                              <span className="text-white">{comp.serialNumber}</span>
                            </div>
                          )}
                          {comp.builder && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Builder</span>
                              <span className="text-white">{comp.builder}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Install Date</span>
                            <span className="text-white">{comp.installDate || 'N/A'}</span>
                          </div>
                          {comp.dateRemoved && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Date Removed</span>
                              <span className="text-white">{comp.dateRemoved}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-white mb-3">Usage</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Passes</span>
                            <span className="text-white">{comp.totalPasses}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Since Service</span>
                            <span className="text-white">{comp.passesSinceService}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hours</span>
                            <span className="text-white">{comp.hours}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Currently Installed</span>
                            <span className={comp.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}>{comp.currentlyInstalled ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                      {comp.notes && (
                        <div>
                          <h4 className="font-medium text-white mb-3">Notes</h4>
                          <p className="text-sm text-slate-400 italic">{comp.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Sub-Components Grid */}
                    <div className="mt-6 border-t border-slate-700/50 pt-4">
                      {renderComponentGrid(comp.components, 'drivetrain', comp.id)}
                    </div>


                    {/* Associated Parts from Inventory */}
                    {(() => {
                      const associatedParts = getAssociatedParts(comp.id);
                      if (associatedParts.length === 0) return null;
                      return (
                        <div className="mt-6 border-t border-slate-700/50 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-white flex items-center gap-2">
                              <Package className="w-4 h-4 text-orange-400" />
                              Associated Parts ({associatedParts.length})
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {associatedParts.map(part => (
                              <div key={part.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-200 truncate">{part.description}</p>
                                  <p className="text-xs text-slate-500">{part.partNumber} | {part.vendor}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      part.status === 'In Stock' ? 'bg-green-500/20 text-green-400' :
                                      part.status === 'Low Stock' ? 'bg-yellow-500/20 text-yellow-400' :
                                      part.status === 'Out of Stock' ? 'bg-red-500/20 text-red-400' :
                                      'bg-blue-500/20 text-blue-400'
                                    }`}>{part.status}</span>
                                    <span className="text-xs text-slate-400">Qty: {part.onHand}/{part.maxQuantity}</span>
                                  </div>
                                </div>
                                {(part.status === 'Low Stock' || part.status === 'Out of Stock') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="ml-2 flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 whitespace-nowrap"
                                    title="Navigate to Parts Inventory to reorder"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Reorder
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Combined 3rd Member & Rear Gear Tab */}
        {isCombinedRearGearTab(activeTab) && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2 mb-4">
              <button
                onClick={() => {
                  setEditingDT(null);
                  setNewDT(getDefaultDTForCategory('third_member'));

                  setShowDTModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add 3rd Member
              </button>
              <button
                onClick={() => {
                  setEditingDT(null);
                  setNewDT(getDefaultDTForCategory('ring_and_pinion'));

                  setShowDTModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Ring & Pinion
              </button>
            </div>

            {/* Drivetrain Service Alert Banner (3rd Member & Rear Gear) */}
            {dtAlertsForActiveTab.length > 0 && !dtAlertBannerDismissed && (
              <div className={`mb-4 rounded-xl border p-4 ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 p-2 rounded-lg ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      <ShieldAlert className={`w-5 h-5 ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-semibold ${dtAlertsForActiveTab.some(a => a.severity === 'critical') ? 'text-red-400' : 'text-amber-400'}`}>
                          Drivetrain Alerts: {dtAlertsForActiveTab.length} component{dtAlertsForActiveTab.length !== 1 ? 's' : ''} need attention
                        </h3>
                        <span className="text-xs text-slate-500">Threshold: {dtServiceAlertThreshold}%</span>
                        <button onClick={() => setShowDTAlertSettings(!showDTAlertSettings)} className="text-xs text-slate-400 hover:text-white underline">
                          {showDTAlertSettings ? 'Hide' : 'Settings'}
                        </button>
                      </div>
                      {showDTAlertSettings && (
                        <div className="flex items-center gap-3 mb-3 p-2 bg-slate-800/60 rounded-lg">
                          <label className="text-xs text-slate-400 whitespace-nowrap">Alert Threshold:</label>
                          <input
                            type="range"
                            min={50}
                            max={100}
                            value={dtServiceAlertThreshold}
                            onChange={(e) => setDtServiceAlertThreshold(parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <span className="text-sm font-bold text-white w-10 text-right">{dtServiceAlertThreshold}%</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                        {dtAlertsForActiveTab.slice(0, 9).map((alert, idx) => (
                          <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                            <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                            <span className="truncate">
                              <span className="font-medium">{alert.parentName}</span> - {alert.componentName} ({alert.percentUsed}%)
                            </span>
                          </div>
                        ))}
                        {dtAlertsForActiveTab.length > 9 && (
                          <div className="text-xs text-slate-500 px-2 py-1">+{dtAlertsForActiveTab.length - 9} more...</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setDtAlertBannerDismissed(true)} className="text-slate-500 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {getCombinedRearGearComponents().length === 0 && (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-lg">No 3rd members or ring & pinion components added yet</p>
                <p className="text-slate-500 text-sm mt-1">Click one of the buttons above to add your first component</p>
              </div>
            )}

            {getCombinedRearGearComponents().map((comp) => (
              <div
                key={comp.id}
                className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                  dtCriticalParentIds.has(comp.id) ? 'border-red-500/70 animate-pulse ring-1 ring-red-500/30' :
                  dtAlertedParentIds.has(comp.id) ? 'border-amber-500/60 ring-1 ring-amber-500/20' :
                  comp.currentlyInstalled ? 'border-green-500/50' : 'border-slate-700/50'
                }`}
              >

                <div
                  className="p-4 cursor-pointer hover:bg-slate-700/20"
                  onClick={() => setExpandedDT(expandedDT === comp.id ? null : comp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        comp.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
                      }`}>
                        <Wrench className={`w-6 h-6 ${comp.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{comp.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                            comp.category === 'third_member' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {comp.category === 'third_member' ? '3rd Member' : 'Ring & Pinion'}
                          </span>
                          {comp.currentlyInstalled && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                              INSTALLED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {comp.make && `${comp.make} `}{comp.model && `${comp.model} | `}S/N: {comp.serialNumber || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-white font-medium">{comp.totalPasses} total passes</p>
                        <p className="text-sm text-slate-400">{comp.passesSinceService} since service{comp.hours > 0 ? ` | ${comp.hours} hrs` : ''}</p>
                      </div>

                      <span className={`px-3 py-1 rounded text-sm font-medium border ${getEngineStatusColor(comp.status)}`}>
                        {comp.status}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceReset('drivetrain', comp.id);
                          }}
                          className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                          title="Reset Service Counters — reset passesSinceService to 0 and all sub-component pass counts to 0"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDT(comp);
                            setNewDT({ ...comp });
                            setShowDTModal(true);
                          }}
                          className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (comp.currentlyInstalled) {
                              alert(`Cannot delete an installed ${dtCategorySingular[comp.category].toLowerCase()}. Remove it first.`);
                              return;
                            }
                            if (confirm(`Are you sure you want to delete this ${dtCategorySingular[comp.category].toLowerCase()}?`)) {
                              deleteDrivetrainComponent(comp.id);
                            }
                          }}
                          className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>


                      {expandedDT === comp.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedDT === comp.id && (
                  <div className="border-t border-slate-700/50 p-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-medium text-white mb-3">{dtCategorySingular[comp.category]} Details</h4>
                        <div className="space-y-2 text-sm">
                          {comp.make && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Make</span>
                              <span className="text-white">{comp.make}</span>
                            </div>
                          )}
                          {comp.model && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Model</span>
                              <span className="text-white">{comp.model}</span>
                            </div>
                          )}
                          {comp.serialNumber && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Serial Number</span>
                              <span className="text-white">{comp.serialNumber}</span>
                            </div>
                          )}
                          {comp.builder && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Builder</span>
                              <span className="text-white">{comp.builder}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Install Date</span>
                            <span className="text-white">{comp.installDate || 'N/A'}</span>
                          </div>
                          {comp.dateRemoved && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Date Removed</span>
                              <span className="text-white">{comp.dateRemoved}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-white mb-3">Usage</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Passes</span>
                            <span className="text-white">{comp.totalPasses}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Since Service</span>
                            <span className="text-white">{comp.passesSinceService}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hours</span>
                            <span className="text-white">{comp.hours}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Currently Installed</span>
                            <span className={comp.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}>{comp.currentlyInstalled ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                      {comp.notes && (
                        <div>
                          <h4 className="font-medium text-white mb-3">Notes</h4>
                          <p className="text-sm text-slate-400 italic">{comp.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Sub-Components Grid */}
                    <div className="mt-6 border-t border-slate-700/50 pt-4">
                      {renderComponentGrid(comp.components, 'drivetrain', comp.id)}
                    </div>


                    {/* Associated Parts from Inventory */}
                    {(() => {
                      const associatedParts = getAssociatedParts(comp.id);
                      if (associatedParts.length === 0) return null;
                      return (
                        <div className="mt-6 border-t border-slate-700/50 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-white flex items-center gap-2">
                              <Package className="w-4 h-4 text-orange-400" />
                              Associated Parts ({associatedParts.length})
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {associatedParts.map(part => (
                              <div key={part.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-200 truncate">{part.description}</p>
                                  <p className="text-xs text-slate-500">{part.partNumber} | {part.vendor}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      part.status === 'In Stock' ? 'bg-green-500/20 text-green-400' :
                                      part.status === 'Low Stock' ? 'bg-yellow-500/20 text-yellow-400' :
                                      part.status === 'Out of Stock' ? 'bg-red-500/20 text-red-400' :
                                      'bg-blue-500/20 text-blue-400'
                                    }`}>{part.status}</span>
                                    <span className="text-xs text-slate-400">Qty: {part.onHand}/{part.maxQuantity}</span>
                                  </div>
                                </div>
                                {(part.status === 'Low Stock' || part.status === 'Out of Stock') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="ml-2 flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 whitespace-nowrap"
                                    title="Navigate to Parts Inventory to reorder"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Reorder
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Chassis Setup Tab */}
        {activeTab === 'chassis_setup' && (
          <ChassisSetup currentRole={currentRole} />
        )}
      </div>



      {/* Engine Modal */}
      {showEngineModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingEngine ? 'Edit Engine' : 'Add New Engine'}
              </h3>
              <button onClick={() => setShowEngineModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Engine Name *</label>
                <input
                  type="text"
                  value={newEngine.name}
                  onChange={(e) => setNewEngine({...newEngine, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Hemi #5 - Development"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={newEngine.serialNumber}
                    onChange={(e) => setNewEngine({...newEngine, serialNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Builder</label>
                  <input
                    type="text"
                    value={newEngine.builder}
                    onChange={(e) => setNewEngine({...newEngine, builder: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={newEngine.status}
                    onChange={(e) => setNewEngine({...newEngine, status: e.target.value as EngineStatus})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Ready">Ready</option>
                    <option value="Rebuild">Rebuild</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Install Date</label>
                  <DateInputDark
                    value={newEngine.installDate}
                    onChange={(e) => setNewEngine({...newEngine, installDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Passes</label>
                  <input
                    type="number"
                    value={newEngine.totalPasses}
                    onChange={(e) => setNewEngine({...newEngine, totalPasses: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Passes Since Rebuild</label>
                  <input
                    type="number"
                    value={newEngine.passesSinceRebuild}
                    onChange={(e) => setNewEngine({...newEngine, passesSinceRebuild: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newEngine.notes}
                  onChange={(e) => setNewEngine({...newEngine, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEngineModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEngine}
                disabled={!newEngine.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingEngine ? 'Save Changes' : 'Add Engine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supercharger Modal */}
      {showSCModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingSC ? 'Edit Power Adder' : 'Add New Power Adder'}
              </h3>
              <button onClick={() => setShowSCModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newSC.name}
                  onChange={(e) => setNewSC({...newSC, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Procharger #4 - Spare"
                />
               </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Power Adder Type</label>
                <select
                  value={newSC.powerAdderType || 'Supercharger'}
                  onChange={(e) => setNewSC({...newSC, powerAdderType: e.target.value as PowerAdderType})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {POWER_ADDER_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={newSC.serialNumber}
                    onChange={(e) => setNewSC({...newSC, serialNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={newSC.model}
                    onChange={(e) => setNewSC({...newSC, model: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., F-3X-140"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={newSC.status}
                    onChange={(e) => setNewSC({...newSC, status: e.target.value as SuperchargerStatus})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Ready">Ready</option>
                    <option value="Service">Service</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div>
                  <DateInputDark
                    value={newSC.installDate}
                    onChange={(e) => setNewSC({...newSC, installDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Passes</label>
                  <input
                    type="number"
                    value={newSC.totalPasses}
                    onChange={(e) => setNewSC({...newSC, totalPasses: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Passes Since Service</label>
                  <input
                    type="number"
                    value={newSC.passesSinceService}
                    onChange={(e) => setNewSC({...newSC, passesSinceService: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newSC.notes}
                  onChange={(e) => setNewSC({...newSC, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSCModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSC}
                disabled={!newSC.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSC ? 'Save Changes' : 'Add Power Adder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cylinder Head Modal */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingHead ? 'Edit Cylinder Head' : 'Add New Cylinder Head'}
              </h3>
              <button onClick={() => setShowHeadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newHead.name}
                  onChange={(e) => setNewHead({...newHead, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Head Set E - Left"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={newHead.serialNumber}
                    onChange={(e) => setNewHead({...newHead, serialNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Builder</label>
                  <input
                    type="text"
                    value={newHead.builder}
                    onChange={(e) => setNewHead({...newHead, builder: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Position</label>
                  <select
                    value={newHead.position}
                    onChange={(e) => setNewHead({...newHead, position: e.target.value as HeadPosition})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Left">Left</option>
                    <option value="Right">Right</option>
                    <option value="Spare">Spare</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={newHead.status}
                    onChange={(e) => setNewHead({...newHead, status: e.target.value as HeadStatus})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Ready">Ready</option>
                    <option value="Refresh">Refresh</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Passes</label>
                  <input
                    type="number"
                    value={newHead.totalPasses}
                    onChange={(e) => setNewHead({...newHead, totalPasses: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Passes Since Refresh</label>
                  <input
                    type="number"
                    value={newHead.passesSinceRefresh}
                    onChange={(e) => setNewHead({...newHead, passesSinceRefresh: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Assigned Engine</label>
                <select
                  value={newHead.engineId || ''}
                  onChange={(e) => setNewHead({...newHead, engineId: e.target.value || undefined})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">None (Spare)</option>
                  {engines.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newHead.notes}
                  onChange={(e) => setNewHead({...newHead, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowHeadModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHead}
                disabled={!newHead.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingHead ? 'Save Changes' : 'Add Cylinder Head'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component Edit Modal */}
      {showComponentModal && editingComponent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-500" />
                {editingComponent.isNew ? 'Add Component' : 'Edit Component'}
              </h3>
              <button onClick={() => setShowComponentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Component Name *</label>
                <input
                  type="text"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent({...newComponent, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Main Bearings"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Part Number</label>
                  <input
                    type="text"
                    value={newComponent.partNumber || ''}
                    onChange={(e) => setNewComponent({...newComponent, partNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                  <select
                    value={newComponent.vendor || ''}
                    onChange={(e) => setNewComponent({...newComponent, vendor: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select vendor...</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}{v.category ? ` (${v.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={newComponent.status}
                    onChange={(e) => setNewComponent({...newComponent, status: e.target.value as ComponentStatus})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Good">Good</option>
                    <option value="Inspect">Inspect</option>
                    <option value="Service">Service</option>
                    <option value="Replace">Replace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Install Date</label>
                  <DateInputDark
                    value={newComponent.installDate}
                    onChange={(e) => setNewComponent({...newComponent, installDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Count</label>
                  <input
                    type="number"
                    value={newComponent.passCount}
                    onChange={(e) => setNewComponent({...newComponent, passCount: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Service Interval</label>
                  <input
                    type="number"
                    value={newComponent.serviceInterval}
                    onChange={(e) => setNewComponent({...newComponent, serviceInterval: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Inspection Interval</label>
                  <input
                    type="number"
                    value={newComponent.inspectionInterval}
                    onChange={(e) => setNewComponent({...newComponent, inspectionInterval: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Replace Interval</label>
                  <input
                    type="number"
                    value={newComponent.replaceInterval}
                    onChange={(e) => setNewComponent({...newComponent, replaceInterval: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Last Service</label>
                  <DateInputDark
                    value={newComponent.lastService}
                    onChange={(e) => setNewComponent({...newComponent, lastService: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Last Inspection</label>
                  <DateInputDark
                    value={newComponent.lastInspection}
                    onChange={(e) => setNewComponent({...newComponent, lastInspection: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />

                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newComponent.notes}
                  onChange={(e) => setNewComponent({...newComponent, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., King bearings, .001 clearance"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowComponentModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComponent}
                disabled={!newComponent.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingComponent.isNew ? 'Add Component' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drivetrain Component Modal */}
      {showDTModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-500" />
                {editingDT ? `Edit ${dtCategorySingular[newDT.category]}` : `Add New ${dtCategorySingular[newDT.category]}`}
              </h3>
              <button onClick={() => { setShowDTModal(false); setEditingDT(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input type="text" value={newDT.name} onChange={(e) => setNewDT({ ...newDT, name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder={`e.g., ${dtCategorySingular[newDT.category]} #1`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Make</label>
                  <input type="text" value={newDT.make} onChange={(e) => setNewDT({ ...newDT, make: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="e.g., Lenco" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model</label>
                  <input type="text" value={newDT.model} onChange={(e) => setNewDT({ ...newDT, model: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="e.g., CS1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                  <input type="text" value={newDT.serialNumber} onChange={(e) => setNewDT({ ...newDT, serialNumber: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Builder</label>
                  <input type="text" value={newDT.builder} onChange={(e) => setNewDT({ ...newDT, builder: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date Installed</label>
                  <DateInputDark value={newDT.installDate} onChange={(e) => setNewDT({ ...newDT, installDate: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date Removed</label>
                  <DateInputDark value={newDT.dateRemoved} onChange={(e) => setNewDT({ ...newDT, dateRemoved: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Passes</label>
                  <input type="number" value={newDT.totalPasses} onChange={(e) => setNewDT({ ...newDT, totalPasses: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Since Service</label>
                  <input type="number" value={newDT.passesSinceService} onChange={(e) => setNewDT({ ...newDT, passesSinceService: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Hours</label>
                  <input type="number" value={newDT.hours} onChange={(e) => setNewDT({ ...newDT, hours: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select value={newDT.status} onChange={(e) => setNewDT({ ...newDT, status: e.target.value as DrivetrainStatus })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">

                    <option value="Active">Active</option>
                    <option value="Ready">Ready</option>
                    <option value="Service">Service</option>
                    <option value="Rebuild">Rebuild</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setNewDT({ ...newDT, currentlyInstalled: !newDT.currentlyInstalled })} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${newDT.currentlyInstalled ? 'bg-green-500' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${newDT.currentlyInstalled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-slate-300">Currently Installed</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={newDT.notes} onChange={(e) => setNewDT({ ...newDT, notes: e.target.value })} rows={3} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Additional notes..." />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowDTModal(false); setEditingDT(null); }} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button
                onClick={async () => {
                  if (editingDT) {
                    await updateDrivetrainComponent(editingDT.id, newDT);
                  } else {
                    const id = `DT-${newDT.category.toUpperCase().slice(0, 4)}-${Date.now()}`;
                    await addDrivetrainComponent({ ...newDT, id });
                  }
                  setShowDTModal(false);
                  setEditingDT(null);
                  setNewDT(defaultDT);
                }}
                disabled={!newDT.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingDT ? 'Save Changes' : `Add ${dtCategorySingular[newDT.category]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drivetrain Swap Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                Perform Drivetrain Swap
              </h3>
              <button onClick={() => setShowSwapModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Component Type *</label>
                <select
                  value={swapComponentType}
                  onChange={(e) => setSwapComponentType(e.target.value as DrivetrainCategory)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {dtCategories.map(cat => (
                    <option key={cat} value={cat}>{dtCategorySingular[cat]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Previous Component (being removed) *</label>
                <select
                  value={swapPreviousId}
                  onChange={(e) => setSwapPreviousId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select component...</option>
                  {drivetrainComponents.filter(c => c.category === swapComponentType).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.currentlyInstalled ? ' (Currently Installed)' : ''} - {c.make} {c.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">New Component (being installed) *</label>
                <select
                  value={swapNewId}
                  onChange={(e) => setSwapNewId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select component...</option>
                  {drivetrainComponents.filter(c => c.category === swapComponentType && c.id !== swapPreviousId).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.make} {c.model} [{c.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason for Swap *</label>
                <select
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select reason...</option>
                  <option value="Scheduled Maintenance">Scheduled Maintenance</option>
                  <option value="Component Failure">Component Failure</option>
                  <option value="Performance Upgrade">Performance Upgrade</option>
                  <option value="Testing / R&D">Testing / R&D</option>
                  <option value="Rebuild Required">Rebuild Required</option>
                  <option value="Preventive Replacement">Preventive Replacement</option>
                  <option value="Damage / Breakage">Damage / Breakage</option>
                  <option value="Setup Change">Setup Change</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Performed By *</label>
                <input
                  type="text"
                  value={swapPerformedBy}
                  onChange={(e) => setSwapPerformedBy(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={swapNotes}
                  onChange={(e) => setSwapNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Additional notes about this swap..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSwapModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handlePerformSwap}
                disabled={!swapPreviousId || !swapNewId || !swapReason || !swapPerformedBy}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Perform Swap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Pass Modal */}
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
              Instantly update <span className="text-white font-medium">passCount</span>, <span className="text-white font-medium">totalPasses</span>, <span className="text-white font-medium">passesSinceRebuild</span>, <span className="text-white font-medium">passesSinceService</span>, and <span className="text-white font-medium">passesSinceRefresh</span> on ALL currently installed components for the selected car, including every sub-component.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Which Car *</label>
                <select
                  value={recordPassCarId}
                  onChange={(e) => setRecordPassCarId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select a car...</option>
                  {activeCars.map(car => (
                    <option key={car.id} value={car.id}>{getCarLabel(car.id)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Number of Passes to Add</label>
                <input
                  type="number"
                  min={1}
                  value={recordPassCount}
                  onChange={(e) => setRecordPassCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg font-bold text-center"
                />
                <p className="text-xs text-slate-500 mt-1">Defaults to 1. Increase for multiple back-to-back passes.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRecordPassModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPass}
                disabled={!recordPassCarId || recordPassCount < 1 || recordPassLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {recordPassLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {recordPassLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset Service Counters Confirmation Modal ─────────────────────── */}
      {showServiceResetConfirm && serviceResetTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-cyan-400" />
                Reset Service Counters
              </h3>
              <button onClick={() => { setShowServiceResetConfirm(false); setServiceResetTarget(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-5 p-4 bg-slate-900/70 rounded-lg border border-slate-700/50">
              <p className="text-lg font-semibold text-white mb-1">{serviceResetTarget.parentName}</p>
              <p className="text-sm text-slate-400">
                This will mark the component as freshly serviced by resetting all counters to zero.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">What will be reset:</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-slate-300 font-mono">{serviceResetTarget.counterLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400">{serviceResetTarget.currentCounterValue}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-sm font-bold text-green-400">0</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-slate-300">Sub-component passCount</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{serviceResetTarget.subComponentCount} components</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-sm font-bold text-green-400">all 0</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-slate-300">Sub-component status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {serviceResetTarget.flaggedCount > 0 ? (
                      <span className="text-sm text-amber-400">{serviceResetTarget.flaggedCount} flagged</span>
                    ) : (
                      <span className="text-sm text-slate-400">all clear</span>
                    )}
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">all Good</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-slate-300">lastService / lastInspection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-sm font-bold text-green-400">today</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowServiceResetConfirm(false); setServiceResetTarget(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmServiceReset}
                disabled={serviceResetLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/20"
              >
                {serviceResetLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {serviceResetLoading ? 'Resetting...' : 'Reset Service Counters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>



  );
};

export default SetupLibrary;