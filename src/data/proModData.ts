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

  // Quarter Mile Data (MODULE 4 additions)
  quarterMileET?: number;
  quarterMileMPH?: number;
  endSplit?: number; // Difference between 1/8 Mile ET and Quarter Mile ET
  
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
    uvIndex?: number;        // UV Index (0-11+) at the time of the pass
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
  // Rear tire LINER pressures (inner tube/liner inside the slick).
  // Optional so existing pass logs that pre-date these fields still validate.
  rearLeftLinerPSI?: number;
  rearRightLinerPSI?: number;
  wheelieBarSetting: number;
  launchRPM: number;
  boostSetting: number;

  // ═══════════════════════════════════════════════════════════════════
  // TRACK GRIP — optional per-pass trackside traction measurements.
  // ═══════════════════════════════════════════════════════════════════
  // Both fields are optional so existing passes logged before these
  // columns existed continue to validate.  Max entry width is 5 digits
  // (0 – 99999) enforced in the PassLog modal UI.
  //   - kegTractionMeterNM: Keg-style drag-meter reading in Newton-Meters
  //   - trackMeterTorqueInLbs: Track meter torque reading in inch-pounds
  kegTractionMeterNM?: number;
  trackMeterTorqueInLbs?: number;

  
  // Notes
  notes: string;
  crewChief: string;
  
  // Aborted pass flag - when true, data is excluded from performance analytics/trends but counted in pass totals
  aborted?: boolean;
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

// A single row in a maintenance item's service log spreadsheet.
// Each entry captures one service event with a date, time, and free-form
// description/notes. The list is unbounded ("infinite lines").
export interface ServiceLogEntry {
  id: string;
  date: string;        // Last service date (YYYY-MM-DD)
  time: string;        // Last service time (HH:mm)
  notes: string;       // Description / notes for this service record
}

export interface MaintenanceItem {

  id: string;
  component: string;
  category: string;
  passInterval: number;
  currentPasses: number;
  lastService: string;
  lastServiceTime?: string;
  nextServicePasses: number;
  status: 'Good' | 'Due Soon' | 'Due' | 'Overdue';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  notes: string;
  estimatedCost?: number;
  threshold?: number; // Alert threshold - number of passes remaining before alert triggers
  // Spreadsheet-style service log: an unbounded list of service records, each
  // with its own date, time, and description/notes. Replaces the three
  // separate single-value modals (last service date, last service time, notes).
  serviceLog?: ServiceLogEntry[];
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
  // Per-certification alert threshold, expressed as the number of DAYS before the
  // expiration date at which this cert begins alerting (becomes "Expiring Soon"
  // and fires bell/toast alerts). This mirrors the single `threshold` field used
  // by MaintenanceItem (passes remaining) — here it is days remaining. Required
  // on new certs; alerts depend entirely on this configured value.
  threshold?: number;
  // DEPRECATED (kept for backward compatibility with older saved data): a list of
  // custom day thresholds. New code uses the single `threshold` field above.
  alertThresholdDays?: number[];
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


export const calculateMaintenanceStatus = (item: MaintenanceItem): MaintenanceItem['status'] => {
  const remaining = item.nextServicePasses - item.currentPasses;

  // ── Per-item alert threshold (number of passes REMAINING before alert) ──
  // When the user configures `threshold`, the item must stay "Good" until the
  // remaining passes drop to/under that number. Only then does it become
  // "Due Soon", and only "Overdue" once the service interval is reached/passed.
  // This makes the configured threshold the single source of truth for when an
  // alert (Due Soon / dashboard / bell) is allowed to appear for this item.
  if (item.threshold != null && item.threshold >= 0) {
    if (remaining <= 0) return 'Overdue';
    if (remaining <= item.threshold) return 'Due Soon';
    return 'Good';
  }

  // ── No custom threshold configured ──
  // Per product rule: an alert (yellow "Due Soon") must NEVER appear unless a
  // threshold has been reached. Items without a configured `threshold` therefore
  // do NOT use any percentage-based heuristic to become "Due Soon" / "Due".
  // They simply stay "Good" until the service interval is actually reached, at
  // which point they become "Overdue". This guarantees no alert shows anywhere
  // in the app without an explicit threshold being hit.
  if (remaining <= 0) return 'Overdue';
  return 'Good';
};


export const calculateSFIStatus = (cert: SFICertification): SFICertification['status'] => {
  if (cert.daysUntilExpiration <= 0) return 'Expired';
  // The per-cert `threshold` (days before expiration) is the single source of
  // truth for when a cert begins alerting — mirroring the maintenance threshold.
  // Fall back to 60 days only for legacy certs saved without a threshold.
  const days = cert.threshold != null && cert.threshold >= 0 ? cert.threshold : 60;
  if (cert.daysUntilExpiration <= days) return 'Expiring Soon';
  return 'Valid';
};
