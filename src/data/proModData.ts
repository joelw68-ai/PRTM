// Pro Mod Drag Racing Logbook Data Types and Initial Data

// ============ TYPES ============

export interface PassLogEntry {
  id: string;
  date: string;
  time: string;
  track: string;
  location: string;
  sessionType: 'Test' | 'Qualifying' | 'Eliminations' | 'Match Race';
  round?: string;
  lane: 'Left' | 'Right';
  result: 'Win' | 'Loss' | 'Single' | 'Red Light' | 'Broke';
  
  // Performance Data
  reactionTime: number;
  sixtyFoot: number;
  threeThirty: number;
  eighth: number;
  mph: number;
  
  // Weather & Conditions (snapshot stored with each pass)
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: string;
    trackTemp: number;
    conditions: string;
    dewPoint?: number;       // °F - calculated from temp & humidity
  };

  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
  
  // Car Setup
  engineId: string;
  superchargerId: string;
  tirePressureFront: number;
  tirePressureRearLeft: number;
  tirePressureRearRight: number;
  wheelieBarSetting: number;
  launchRPM: number;
  boostSetting: number;
  
  // Notes
  notes: string;
  crewChief: string;
  
  // Aborted pass flag - when true, data is excluded from performance analytics/trends but counted in pass totals
  aborted?: boolean;

  // Multi-car support
  car_id?: string;
}



export interface Engine {
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
  
  // Internal Components
  components: EngineComponents;

  // Multi-car support
  car_id?: string;
}


export interface EngineComponents {
  crankshaft: ComponentTracker;
  connectingRods: ComponentTracker;
  mainBearings: ComponentTracker;
  rodBearings: ComponentTracker;
  pistons: ComponentTracker;
  wristPins: ComponentTracker;
  pistonRings: ComponentTracker;
  cylinderSleeves: ComponentTracker;
  camshaft: ComponentTracker;
  camBearings: ComponentTracker;
  lifters: ComponentTracker;
}

export interface CylinderHead {
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
  
  // Head Components
  components: HeadComponents;
}

export interface HeadComponents {
  intakeValves: ComponentTracker;
  exhaustValves: ComponentTracker;
  valveSeats: ComponentTracker;
  valveGuides: ComponentTracker;
  valveSprings: ComponentTracker;
  springLocators: ComponentTracker;
  shims: ComponentTracker;
  springRetainers: ComponentTracker;
  lashCaps: ComponentTracker;
  rockerArms: ComponentTracker;
  oilingJets: ComponentTracker;
}

export type PowerAdderType = 'Supercharger' | 'Turbocharger' | 'Nitrous' | 'ProCharger' | 'Twin Turbo' | 'Centrifugal Supercharger' | 'Other';

export interface Supercharger {
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
  // Multi-car support
  car_id?: string;
}


export interface ComponentTracker {
  name: string;
  installDate: string;
  passCount: number;
  serviceInterval: number;
  inspectionInterval: number;
  replaceInterval: number;
  lastService: string;
  lastInspection: string;
  status: 'Good' | 'Inspect' | 'Service' | 'Replace';
  notes: string;
  partNumber?: string;
  vendor?: string;
}

export interface MaintenanceItem {
  id: string;
  component: string;
  category: string;
  passInterval: number;
  currentPasses: number;
  lastService: string;
  nextServicePasses: number;
  status: 'Good' | 'Due Soon' | 'Due' | 'Overdue';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  notes: string;
  estimatedCost?: number;
  // Multi-car support
  car_id?: string;
}


export interface SFICertification {
  id: string;
  item: string;
  sfiSpec: string;
  certificationDate: string;
  expirationDate: string;
  vendor: string;
  serialNumber: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  daysUntilExpiration: number;
  notes: string;
  // Multi-car support
  car_id?: string;
}


export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Pending Parts' | 'Completed' | 'Cancelled';
  createdDate: string;
  dueDate: string;
  completedDate?: string;
  assignedTo: string;
  estimatedHours: number;
  actualHours?: number;
  parts: { name: string; partNumber: string; quantity: number; cost: number }[];
  relatedComponent?: string;
  notes: string;
  // Multi-car support
  car_id?: string;
}


export interface ChecklistItem {
  id: string;
  task: string;
  category: string;
  completed: boolean;
  notes?: string;
  critical: boolean;
  checkedBy?: string; // Name of crew member who checked the item
  checkedAt?: string; // Timestamp when the item was checked
}

export interface EngineSwapLog {
  id: string;
  date: string;
  time: string;
  previousEngineId: string;
  newEngineId: string;
  reason: string;
  performedBy: string;
  notes: string;
}

// ============ WEATHER HISTORY TYPES ============

export interface TrackWeatherHistory {
  trackId: string;
  trackName: string;
  location: string;
  elevation: number; // feet above sea level
  visits: TrackVisit[];
}

export interface TrackVisit {
  id: string;
  date: string;
  event: string;
  passes: WeatherPassRecord[];
  bestET: number;
  bestMPH: number;
  avgSAE: number;
  avgDensityAltitude: number;
  notes: string;
}

export interface WeatherPassRecord {
  passId: string;
  time: string;
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: string;
    trackTemp: number;
    conditions: string;
  };
  saeCorrection: number;
  densityAltitude: number;
  performance: {
    sixtyFoot: number;
    threeThirty: number;
    eighth: number;
    mph: number;
    reactionTime: number;
  };
  setup: {
    launchRPM: number;
    boostSetting: number;
    tirePressureRear: number;
    wheelieBarSetting: number;
  };
  result: 'Win' | 'Loss' | 'Single' | 'Red Light' | 'Broke';
}

export interface TuneUpSuggestion {
  parameter: string;
  currentValue: number | string;
  suggestedValue: number | string;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low';
  basedOnPasses: number;
}

export interface WeatherComparison {
  currentConditions: {
    temperature: number;
    humidity: number;
    pressure: number;
    saeCorrection: number;
    densityAltitude: number;
  };
  historicalAverage: {
    temperature: number;
    humidity: number;
    pressure: number;
    saeCorrection: number;
    densityAltitude: number;
  };
  difference: {
    temperature: number;
    humidity: number;
    pressure: number;
    saeCorrection: number;
    densityAltitude: number;
  };
  similarPasses: WeatherPassRecord[];
  suggestions: TuneUpSuggestion[];
}



// ============ INITIAL DATA (EMPTY FOR BETA) ============

export const engines: Engine[] = [];

export const superchargers: Supercharger[] = [];

export const cylinderHeads: CylinderHead[] = [];

export const maintenanceItems: MaintenanceItem[] = [];

export const sfiCertifications: SFICertification[] = [];

export const passLogs: PassLogEntry[] = [];

export const workOrders: WorkOrder[] = [];

export const engineSwapLogs: EngineSwapLog[] = [];

// Checklists
export const preRunChecklist: ChecklistItem[] = [];

export const betweenRoundsChecklist: ChecklistItem[] = [];

export const postRunChecklist: ChecklistItem[] = [];


// ============ TRACK WEATHER HISTORY DATA ============

export const trackWeatherHistory: TrackWeatherHistory[] = [];


// Helper functions
export const getActiveEngine = () => engines.find(e => e.currentlyInstalled);
export const getActiveSupercharger = () => superchargers.find(s => s.currentlyInstalled);
export const getExpiredCertifications = () => sfiCertifications.filter(c => c.status === 'Expired');
export const getExpiringSoonCertifications = () => sfiCertifications.filter(c => c.daysUntilExpiration <= 60 && c.daysUntilExpiration > 0);
export const getOverdueMaintenanceItems = () => maintenanceItems.filter(m => m.status === 'Overdue' || m.status === 'Due');
export const getDueSoonMaintenanceItems = () => maintenanceItems.filter(m => m.status === 'Due Soon');
export const getOpenWorkOrders = () => workOrders.filter(w => w.status === 'Open' || w.status === 'In Progress' || w.status === 'Pending Parts');
export const getCriticalWorkOrders = () => workOrders.filter(w => w.priority === 'Critical' && w.status !== 'Completed');

export const calculateMaintenanceStatus = (item: MaintenanceItem): MaintenanceItem['status'] => {
  const remaining = item.nextServicePasses - item.currentPasses;
  const interval = item.passInterval;
  const percentage = (remaining / interval) * 100;
  
  if (remaining <= 0) return 'Overdue';
  if (percentage <= 10) return 'Due';
  if (percentage <= 25) return 'Due Soon';
  return 'Good';
};

export const calculateSFIStatus = (cert: SFICertification): SFICertification['status'] => {
  if (cert.daysUntilExpiration <= 0) return 'Expired';
  if (cert.daysUntilExpiration <= 60) return 'Expiring Soon';
  return 'Valid';
};
