// Sample Data for Beta Testers
// Minimal, realistic Pro Mod drag racing data to demonstrate app functionality

import type { Engine, Supercharger, PassLogEntry, ChecklistItem } from '@/data/proModData';
import type { PartInventoryItem } from '@/data/partsInventory';

// ============ HELPER ============
const makeComponent = (
  name: string,
  serviceInterval: number,
  inspectionInterval: number,
  replaceInterval: number,
  passCount: number = 0
) => ({
  name,
  installDate: '2026-01-15',
  passCount,
  serviceInterval,
  inspectionInterval,
  replaceInterval,
  lastService: '2026-01-15',
  lastInspection: '2026-01-15',
  status: 'Good' as const,
  notes: '',
  partNumber: '',
  vendor: ''
});

// ============ 1 ENGINE ============
export const sampleEngine: Engine = {
  id: 'SAMPLE-ENG-001',
  name: 'Hemi 528 #1 (Sample)',
  serialNumber: 'BES-2026-0451',
  builder: 'Brad Anderson Enterprises',
  installDate: '2026-01-15',
  totalPasses: 47,
  passesSinceRebuild: 47,
  status: 'Active',
  currentlyInstalled: true,
  notes: 'Sample engine — 528 ci BAE Hemi, fresh build for 2026 season.',
  components: {
    crankshaft: makeComponent('BAE Billet Crankshaft', 200, 50, 500, 47),
    connectingRods: makeComponent('Carrillo H-Beam Rods', 150, 50, 400, 47),
    mainBearings: makeComponent('Clevite Race Main Bearings', 75, 25, 150, 47),
    rodBearings: makeComponent('Clevite Race Rod Bearings', 75, 25, 150, 47),
    pistons: makeComponent('JE Pro Mod Pistons', 100, 25, 200, 47),
    wristPins: makeComponent('Trend H13 Wrist Pins', 200, 50, 400, 47),
    pistonRings: makeComponent('Total Seal Gapless Rings', 75, 25, 150, 47),
    cylinderSleeves: makeComponent('Darton Ductile Sleeves', 300, 100, 600, 47),
    camshaft: makeComponent('Comp Cams Custom Roller', 200, 50, 500, 47),
    camBearings: makeComponent('Dura-Bond Cam Bearings', 150, 50, 300, 47),
    lifters: makeComponent('Jesel Shaft Roller Lifters', 150, 50, 400, 47)
  }
};

// ============ 1 SUPERCHARGER ============
export const sampleSupercharger: Supercharger = {
  id: 'SAMPLE-SC-001',
  name: 'Roots 14-71 #1 (Sample)',
  serialNumber: 'LTR-2026-1122',
  model: 'Littlefield 14-71',
  installDate: '2026-01-15',
  totalPasses: 47,
  passesSinceService: 47,
  status: 'Active',
  currentlyInstalled: true,
  notes: 'Sample supercharger — Littlefield 14-71 Hi-Helix, 18% overdrive.'
};

// ============ 3 PASS LOGS ============
export const samplePassLogs: PassLogEntry[] = [
  {
    id: 'SAMPLE-PASS-001',
    date: '2026-02-22',
    time: '14:35',
    track: 'South Georgia Motorsports Park',
    location: 'Valdosta, GA',
    sessionType: 'Test',
    round: undefined,
    lane: 'Left',
    result: 'Single',
    reactionTime: 0.042,
    sixtyFoot: 1.028,
    threeThirty: 2.712,
    eighth: 3.764,
    mph: 204.8,
    weather: {
      temperature: 68,
      humidity: 42,
      pressure: 30.12,
      windSpeed: 3,
      windDirection: 'NE',
      trackTemp: 92,
      conditions: 'Clear'
    },
    saeCorrection: 1.012,
    densityAltitude: 1250,
    correctedHP: 3450,
    engineId: 'SAMPLE-ENG-001',
    superchargerId: 'SAMPLE-SC-001',
    tirePressureFront: 30,
    tirePressureRearLeft: 5.5,
    tirePressureRearRight: 5.5,
    wheelieBarSetting: 42.5,
    launchRPM: 5800,
    boostSetting: 38,
    notes: 'First test hit of the weekend. Car left clean, good 60-ft. Pulled blower belt at 1000 ft — shut off early.',
    crewChief: 'Mike Johnson'
  },
  {
    id: 'SAMPLE-PASS-002',
    date: '2026-02-22',
    time: '17:10',
    track: 'South Georgia Motorsports Park',
    location: 'Valdosta, GA',
    sessionType: 'Test',
    round: undefined,
    lane: 'Right',
    result: 'Single',
    reactionTime: 0.038,
    sixtyFoot: 1.015,
    threeThirty: 2.681,
    eighth: 3.721,
    mph: 207.3,
    weather: {
      temperature: 64,
      humidity: 38,
      pressure: 30.14,
      windSpeed: 2,
      windDirection: 'N',
      trackTemp: 84,
      conditions: 'Clear'
    },
    saeCorrection: 1.008,
    densityAltitude: 980,
    correctedHP: 3520,
    engineId: 'SAMPLE-ENG-001',
    superchargerId: 'SAMPLE-SC-001',
    tirePressureFront: 30,
    tirePressureRearLeft: 5.0,
    tirePressureRearRight: 5.0,
    wheelieBarSetting: 42.0,
    launchRPM: 5900,
    boostSetting: 40,
    notes: 'Second pass — dropped tire pressure half pound, picked up 60-ft. Best run of the day. Car is responding well to the new tune-up.',
    crewChief: 'Mike Johnson'
  },
  {
    id: 'SAMPLE-PASS-003',
    date: '2026-03-01',
    time: '11:20',
    track: 'Virginia Motorsports Park',
    location: 'Dinwiddie, VA',
    sessionType: 'Qualifying',
    round: 'Q1',
    lane: 'Left',
    result: 'Win',
    reactionTime: 0.029,
    sixtyFoot: 1.009,
    threeThirty: 2.658,
    eighth: 3.698,
    mph: 209.1,
    weather: {
      temperature: 58,
      humidity: 35,
      pressure: 30.22,
      windSpeed: 5,
      windDirection: 'SW',
      trackTemp: 78,
      conditions: 'Overcast'
    },
    saeCorrection: 1.004,
    densityAltitude: 620,
    correctedHP: 3580,
    engineId: 'SAMPLE-ENG-001',
    superchargerId: 'SAMPLE-SC-001',
    tirePressureFront: 30,
    tirePressureRearLeft: 5.0,
    tirePressureRearRight: 5.0,
    wheelieBarSetting: 41.5,
    launchRPM: 5950,
    boostSetting: 42,
    notes: 'Q1 — best pass yet! Low qualifier. Cool air and good track prep made the difference. Car was on a rail.',
    crewChief: 'Mike Johnson'
  }
];

// ============ 5 PARTS ============
export const sampleParts: PartInventoryItem[] = [
  {
    id: 'SAMPLE-PART-001',
    partNumber: 'JE-PM-528-040',
    description: 'JE Pro Mod Pistons (set of 8)',
    category: 'Engine',
    subcategory: 'Pistons',
    onHand: 2,
    minQuantity: 1,
    maxQuantity: 4,
    vendor: 'JE Pistons',
    vendorPartNumber: 'JE-PM-528-040',
    unitCost: 2850,
    totalValue: 5700,
    lastOrdered: '2026-01-05',
    lastUsed: '2026-01-15',
    location: 'Engine Cabinet - Shelf A',
    notes: '.040 over bore, custom dome, coated skirts',
    status: 'In Stock',
    reorderStatus: 'OK'
  },
  {
    id: 'SAMPLE-PART-002',
    partNumber: 'TS-GL-4310',
    description: 'Total Seal Gapless Ring Set',
    category: 'Engine',
    subcategory: 'Rings',
    onHand: 1,
    minQuantity: 2,
    maxQuantity: 4,
    vendor: 'Total Seal',
    vendorPartNumber: 'TS-GL-4310',
    unitCost: 485,
    totalValue: 485,
    lastOrdered: '2026-01-05',
    lastUsed: '2026-01-15',
    location: 'Engine Cabinet - Shelf B',
    notes: 'AP steel top, Napier 2nd, low-tension oil ring',
    status: 'Low Stock',
    reorderStatus: 'Reorder'
  },
  {
    id: 'SAMPLE-PART-003',
    partNumber: 'MSD-8261',
    description: 'MSD Pro Mag 44 Magneto',
    category: 'Ignition',
    subcategory: 'Magneto',
    onHand: 1,
    minQuantity: 1,
    maxQuantity: 2,
    vendor: 'MSD Performance',
    vendorPartNumber: '8261',
    unitCost: 4200,
    totalValue: 4200,
    lastOrdered: '2025-11-20',
    lastUsed: '2026-02-22',
    location: 'Electrical Cabinet',
    notes: 'Spare magneto, freshened by MSD Nov 2025',
    status: 'In Stock',
    reorderStatus: 'OK'
  },
  {
    id: 'SAMPLE-PART-004',
    partNumber: 'GDY-D2990',
    description: 'Goodyear D2990 Slicks (pair)',
    category: 'Tires & Wheels',
    subcategory: 'Rear Tires',
    onHand: 0,
    minQuantity: 2,
    maxQuantity: 6,
    vendor: 'Goodyear Racing',
    vendorPartNumber: 'D2990',
    unitCost: 425,
    totalValue: 0,
    lastOrdered: '2026-02-10',
    lastUsed: '2026-03-01',
    location: 'Tire Rack',
    notes: 'Need to reorder — used last pair at VMP event',
    status: 'Out of Stock',
    reorderStatus: 'Critical'
  },
  {
    id: 'SAMPLE-PART-005',
    partNumber: 'VP-M1-5GAL',
    description: 'VP Racing M1 Methanol (5 gal)',
    category: 'Fuel & Fluids',
    subcategory: 'Fuel',
    onHand: 8,
    minQuantity: 4,
    maxQuantity: 20,
    vendor: 'VP Racing Fuels',
    vendorPartNumber: 'M1-5',
    unitCost: 42,
    totalValue: 336,
    lastOrdered: '2026-02-18',
    lastUsed: '2026-03-01',
    location: 'Fuel Storage',
    notes: 'Standard race fuel. Burns approx 3 gal per pass.',
    status: 'In Stock',
    reorderStatus: 'OK'
  }
];

// ============ 5 CHECKLIST ITEMS (Pre-Run) ============
export const sampleChecklistItems: ChecklistItem[] = [
  {
    id: 'SAMPLE-CHK-001',
    task: 'Check engine oil level & pressure',
    category: 'Engine',
    completed: false,
    notes: 'Oil should be at full mark on dipstick. Verify 60+ psi at idle.',
    critical: true
  },
  {
    id: 'SAMPLE-CHK-002',
    task: 'Inspect blower belt tension & condition',
    category: 'Supercharger',
    completed: false,
    notes: 'Belt should deflect ~1/2" at center. Look for glazing or fraying.',
    critical: true
  },
  {
    id: 'SAMPLE-CHK-003',
    task: 'Verify tire pressure (front & rear)',
    category: 'Chassis',
    completed: false,
    notes: 'Front: 30 psi. Rear: per crew chief call (typically 5.0-5.5 psi).',
    critical: true
  },
  {
    id: 'SAMPLE-CHK-004',
    task: 'Check parachute pack & lanyard',
    category: 'Safety',
    completed: false,
    notes: 'Both chutes packed and pins secure. Lanyards routed correctly.',
    critical: true
  },
  {
    id: 'SAMPLE-CHK-005',
    task: 'Verify data logger is armed & recording',
    category: 'Electronics',
    completed: false,
    notes: 'RacePak armed, GPS locked, all channels reading.',
    critical: false
  }
];
