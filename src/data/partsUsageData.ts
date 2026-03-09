import { getLocalDateString } from '@/lib/utils';


export type PartUsageAction = 'installed' | 'removed' | 'replaced' | 'inspected' | 'serviced';

export interface PartUsageRecord {
  id: string;
  partId: string;
  partNumber: string;
  partDescription: string;
  action: PartUsageAction;
  date: string;
  time?: string;
  
  // Location/Component
  installedOn: string; // e.g., "Engine #1", "Supercharger", "Rear End"
  location?: string; // Specific location like "Cylinder 1", "Left Side"
  
  // Tracking
  passesAtAction: number;
  milesAtAction?: number;
  
  // Lifecycle
  installDate?: string; // When this specific part was originally installed
  removalDate?: string; // When removed (if applicable)
  passesInService?: number; // How many passes this part was in service
  
  // Linked Records
  workOrderId?: string;
  raceEventId?: string;
  raceEventName?: string;
  
  // Cost & Details
  cost: number;
  laborHours?: number;
  laborCost?: number;
  
  // Personnel
  performedBy: string;
  verifiedBy?: string;
  
  // Condition & Notes
  conditionOnRemoval?: 'Good' | 'Worn' | 'Damaged' | 'Failed';
  failureReason?: string;
  notes: string;
  
  // Photos
  photos?: string[];
}

export interface PartLifecycleStats {
  partId: string;
  partNumber: string;
  partDescription: string;
  category: string;
  
  // Usage Stats
  totalInstalls: number;
  totalRemovals: number;
  currentlyInstalled: boolean;
  
  // Lifespan
  averagePassesPerUse: number;
  maxPassesRecorded: number;
  minPassesRecorded: number;
  
  // Cost Analysis
  totalCostOwnership: number;
  costPerPass: number;
  costPerUse: number;
  
  // Predictions
  predictedNextReplacement?: string;
  predictedPassesRemaining?: number;
  
  // Reliability
  failureRate: number; // Percentage of removals due to failure
  averageConditionOnRemoval: string;
}

// Sample Parts Usage History (empty for beta)
export const partsUsageHistory: PartUsageRecord[] = [];

// Helper functions
export const getUsageByPart = (partId: string): PartUsageRecord[] => 
  partsUsageHistory.filter(u => u.partId === partId);

export const getUsageByWorkOrder = (workOrderId: string): PartUsageRecord[] => 
  partsUsageHistory.filter(u => u.workOrderId === workOrderId);

export const getUsageByEvent = (eventId: string): PartUsageRecord[] => 
  partsUsageHistory.filter(u => u.raceEventId === eventId);

export const getUsageByAction = (action: PartUsageAction): PartUsageRecord[] => 
  partsUsageHistory.filter(u => u.action === action);

export const getUsageByDateRange = (startDate: string, endDate: string): PartUsageRecord[] => 
  partsUsageHistory.filter(u => u.date >= startDate && u.date <= endDate);

export const getRecentUsage = (days: number = 30): PartUsageRecord[] => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = getLocalDateString(cutoffDate);

  return partsUsageHistory.filter(u => u.date >= cutoffStr);
};

export const calculatePartLifecycle = (partNumber: string): PartLifecycleStats | null => {
  const usageRecords = partsUsageHistory.filter(u => u.partNumber === partNumber);
  if (usageRecords.length === 0) return null;
  
  const installs = usageRecords.filter(u => u.action === 'installed' || u.action === 'replaced');
  const removals = usageRecords.filter(u => u.action === 'removed' || u.action === 'replaced');
  
  const passesInService = removals
    .filter(r => r.passesInService !== undefined)
    .map(r => r.passesInService!);
  
  const avgPasses = passesInService.length > 0 
    ? passesInService.reduce((a, b) => a + b, 0) / passesInService.length 
    : 0;
  
  const totalCost = usageRecords.reduce((sum, u) => sum + u.cost + (u.laborCost || 0), 0);
  const totalPasses = passesInService.reduce((a, b) => a + b, 0);
  
  const failures = removals.filter(r => r.conditionOnRemoval === 'Failed' || r.conditionOnRemoval === 'Damaged');
  
  return {
    partId: usageRecords[0].partId,
    partNumber,
    partDescription: usageRecords[0].partDescription,
    category: 'Engine',
    totalInstalls: installs.length,
    totalRemovals: removals.length,
    currentlyInstalled: installs.length > removals.length,
    averagePassesPerUse: Math.round(avgPasses),
    maxPassesRecorded: passesInService.length > 0 ? Math.max(...passesInService) : 0,
    minPassesRecorded: passesInService.length > 0 ? Math.min(...passesInService) : 0,
    totalCostOwnership: totalCost,
    costPerPass: totalPasses > 0 ? totalCost / totalPasses : 0,
    costPerUse: installs.length > 0 ? totalCost / installs.length : 0,
    failureRate: removals.length > 0 ? (failures.length / removals.length) * 100 : 0,
    averageConditionOnRemoval: removals.length > 0 
      ? removals[0].conditionOnRemoval || 'Unknown'
      : 'N/A'
  };
};

