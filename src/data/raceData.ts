// Types
export interface SessionEntry {
  id: string;
  date: string;
  track: string;
  driver: string;
  sessionType: 'Practice' | 'Qualifying' | 'Race' | 'Test';
  weather: string;
  temperature: number;
  bestLap: string;
  totalLaps: number;
  carSetup: string;
  notes: string;
  sectors: [string, string, string];
}

export interface CalendarEvent {
  id: string;
  date: string;
  endDate?: string;
  track: string;
  country: string;
  eventType: 'Race Weekend' | 'Test Day' | 'Practice Session';
  status: 'Completed' | 'Upcoming' | 'In Progress';
  sessions: string[];
}

export interface MaintenanceRecord {
  id: string;
  component: string;
  lastService: string;
  nextService: string;
  currentMileage: number;
  lifespanMileage: number;
  status: 'Good' | 'Warning' | 'Critical';
  notes: string;
}

export interface DriverStats {
  id: string;
  name: string;
  number: number;
  nationality: string;
  avatar: string;
  totalRaces: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  bestFinish: number;
  currentPoints: number;
  recentLaps: { track: string; time: string; date: string }[];
}

export interface SetupConfig {
  id: string;
  name: string;
  track: string;
  date: string;
  frontWing: number;
  rearWing: number;
  frontSuspension: number;
  rearSuspension: number;
  frontTirePressure: number;
  rearTirePressure: number;
  gearRatios: number[];
  brakeBias: number;
  differential: number;
  notes: string;
  rating: number;
}

export interface TeamNote {
  id: string;
  date: string;
  author: string;
  category: 'Strategy' | 'Technical' | 'Driver Feedback' | 'General';
  title: string;
  content: string;
  priority: 'Low' | 'Medium' | 'High';
}

// Session Log Data (empty for beta)
export const sessionLogs: SessionEntry[] = [];

// Calendar Events
export const calendarEvents: CalendarEvent[] = [];

// Maintenance Records
export const maintenanceRecords: MaintenanceRecord[] = [];

// Driver Stats
export const driverStats: DriverStats[] = [];

// Setup Configurations
export const setupConfigs: SetupConfig[] = [];

// Team Notes
export const teamNotes: TeamNote[] = [];

// Helper functions
export const getSessionsByDriver = (driver: string) => 
  sessionLogs.filter(s => s.driver === driver);

export const getSessionsByTrack = (track: string) => 
  sessionLogs.filter(s => s.track.includes(track));

export const getSessionsByType = (type: SessionEntry['sessionType']) => 
  sessionLogs.filter(s => s.sessionType === type);

export const getUpcomingEvents = () => 
  calendarEvents.filter(e => e.status === 'Upcoming');

export const getCompletedEvents = () => 
  calendarEvents.filter(e => e.status === 'Completed');

export const getCriticalMaintenance = () => 
  maintenanceRecords.filter(m => m.status === 'Critical' || m.status === 'Warning');

export const getSetupsByTrack = (track: string) => 
  setupConfigs.filter(s => s.track.includes(track));

export const getNotesByCategory = (category: TeamNote['category']) => 
  teamNotes.filter(n => n.category === category);

export const getHighPriorityNotes = () => 
  teamNotes.filter(n => n.priority === 'High');
