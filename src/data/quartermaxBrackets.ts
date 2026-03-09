// Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Brackets
// Pro Mod Application Specifications:
//   - Bottom hole of chassis bracket: 5" from level ground (with driver, race weight)
//   - Chassis brackets: 20-22" forward of axle centerline
//   - Housing brackets: mounted on rear axle housing
//   - Hole spacing: 3/8" (0.375") staggered height differences
//   - Bracket adjustment: entire bracket moves up/down in 1/8" (0.125") increments
//   - Effective resolution: 1/8" (0.125") via combination of 3/8" holes + 1/8" bracket shift
//   - Material: 1/8" (0.125") billet 4130 chromoly
//
// HOW THE 1/8" ADJUSTMENT WORKS:
//   The bracket plate has holes drilled at 3/8" (0.375") vertical spacing.
//   The bracket mounts to the crossmember via slotted holes that allow the
//   entire bracket to be shifted up or down in 1/8" (0.125") increments.
//   With 3 bracket positions (0, +1/8", +1/4"), every 1/8" height is reachable:
//     Offset 0:    0/8, 3/8, 6/8, 9/8, 12/8, 15/8, 18/8, 21/8, 24/8, 27/8
//     Offset +1/8: 1/8, 4/8, 7/8, 10/8, 13/8, 16/8, 19/8, 22/8, 25/8, 28/8
//     Offset +2/8: 2/8, 5/8, 8/8, 11/8, 14/8, 17/8, 20/8, 23/8, 26/8, 29/8

export interface QuartermaxHole {
  id: string;
  label: string;
  position: number; // Hole number from bottom (1-based)
  heightFromAxle: number; // inches from axle centerline (negative = below axle) at offset 0
  forwardOfAxle: number; // inches forward of axle centerline
}

export interface QuartermaxBracket {
  id: string;
  partNumber: string;
  name: string;
  series: 'Extreme 1/8" Billet' | 'Extreme Pro Series' | 'Pro Series' | 'Standard';
  type: 'Chassis' | 'Housing';
  description: string;
  application: string[];
  material: string;
  thickness: string;
  holeSpacing: number; // inches between holes on the bracket plate
  bracketOffsetIncrement: number; // 1/8" = 0.125" for Extreme Billet
  bracketOffsetPositions: number; // 3 positions (0, +1/8, +2/8) for 3/8" hole spacing
  boltSize: string;
  notchSpread?: string; // For chassis brackets
  axleTubeSize?: string; // For housing brackets
  holes: QuartermaxHole[];
  totalHoles: number;
  weight: number;
  notes: string;
}

// ============ PRO MOD CONFIGURATION ============

export interface ProModFourLinkSpec {
  chassisBottomHoleFromGround: number; // Target: 5"
  chassisForwardOfAxleMin: number; // 20"
  chassisForwardOfAxleMax: number; // 22"
  chassisForwardOfAxleDefault: number; // 21"
  typicalTireDiameter: number; // 34.5"
  typicalTireDescription: string;
  typicalAxleCLHeight: number; // ~16" (loaded)
  typicalLoadedDeflection: number; // ~1.25"
  description: string;
  holeSpacingDescription: string;
  bracketAdjustmentDescription: string;
}

export const PRO_MOD_SPEC: ProModFourLinkSpec = {
  chassisBottomHoleFromGround: 5.0,
  chassisForwardOfAxleMin: 20.0,
  chassisForwardOfAxleMax: 22.0,
  chassisForwardOfAxleDefault: 21.0,
  typicalTireDiameter: 34.5,
  typicalTireDescription: '34.5 x 17.0-16 Pro Mod slick',
  typicalAxleCLHeight: 16.0,
  typicalLoadedDeflection: 1.25,
  description: 'Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Brackets - Pro Mod',
  holeSpacingDescription: '3/8" (0.375") staggered hole spacing',
  bracketAdjustmentDescription: 'Entire bracket adjustable in 1/8" (0.125") increments via slotted crossmember mount'
};

export const PRO_MOD_TOLERANCES = {
  bottomHoleHeightTolerance: 0.5,
  bottomHoleHeightWarning: 1.0,
  forwardDistanceTolerance: 1.0,
  axleCLHeightMin: 14.5,
  axleCLHeightMax: 18.0,
};

// ============ BRACKET HOLE GENERATORS ============

// Generate holes for Extreme 1/8" Billet Chassis Bracket
// 10 holes at 3/8" (0.375") spacing = 3.375" total range on bracket plate
// With 3 bracket offset positions (0, +1/8", +1/4"), effective 1/8" resolution
const generateExtremeBilletChassisHoles = (
  startHeightFromAxle: number,
  forwardPosition: number,
  holeCount: number = 10,
  prefix: string = 'c'
): QuartermaxHole[] => {
  const holes: QuartermaxHole[] = [];
  const holeSpacing = 0.375; // 3/8" staggered spacing

  for (let i = 1; i <= holeCount; i++) {
    const heightFromAxle = startHeightFromAxle + ((i - 1) * holeSpacing);
    holes.push({
      id: `${prefix}-${i}`,
      label: `Hole ${i}${i === 1 ? ' (Bottom)' : i === holeCount ? ' (Top)' : ''}`,
      position: i,
      heightFromAxle: parseFloat(heightFromAxle.toFixed(3)),
      forwardOfAxle: forwardPosition
    });
  }

  return holes;
};

// Generate holes for Strange Modular Extreme Pro Series Housing Bracket
// 13 holes at 3/8" (0.375") spacing centered around axle CL
const generateStrangeHousingHoles = (startHeight: number, forwardPosition: number, holeCount: number = 13): QuartermaxHole[] => {
  const holes: QuartermaxHole[] = [];
  const holeSpacing = 0.375; // 3/8" spacing

  for (let i = 1; i <= holeCount; i++) {
    const heightFromAxle = startHeight + ((i - 1) * holeSpacing);
    holes.push({
      id: `h-${i}`,
      label: `Hole ${i}${i === 1 ? ' (Bottom)' : i === holeCount ? ' (Top)' : ''}`,
      position: i,
      heightFromAxle: parseFloat(heightFromAxle.toFixed(3)),
      forwardOfAxle: forwardPosition
    });
  }

  return holes;
};

// Legacy generators for non-Extreme series
const generateLegacyChassisHoles = (startHeight: number, forwardPosition: number, spacing: number, count: number, prefix: string): QuartermaxHole[] => {
  const holes: QuartermaxHole[] = [];
  for (let i = 1; i <= count; i++) {
    const heightFromAxle = startHeight + ((i - 1) * spacing);
    holes.push({
      id: `${prefix}-${i}`,
      label: `Hole ${i}${i === 1 ? ' (Bottom)' : i === count ? ' (Top)' : ''}`,
      position: i,
      heightFromAxle: parseFloat(heightFromAxle.toFixed(3)),
      forwardOfAxle: forwardPosition
    });
  }
  return holes;
};

const generateLegacyHousingHoles = (startHeight: number, forwardPosition: number, spacing: number, count: number, prefix: string): QuartermaxHole[] => {
  const holes: QuartermaxHole[] = [];
  for (let i = 1; i <= count; i++) {
    const heightFromAxle = startHeight + ((i - 1) * spacing);
    holes.push({
      id: `${prefix}-${i}`,
      label: `Hole ${i}${i === 1 ? ' (Bottom)' : i === count ? ' (Top)' : ''}`,
      position: i,
      heightFromAxle: parseFloat(heightFromAxle.toFixed(3)),
      forwardOfAxle: forwardPosition
    });
  }
  return holes;
};

// ============ BRACKET DEFINITIONS ============

export const quartermaxBrackets: QuartermaxBracket[] = [
  // ================================================================
  // QUARTERMAX EXTREME 1/8" ADJUSTABLE BILLET - PRO MOD APPLICATION
  // Holes: 3/8" (0.375") staggered spacing
  // Bracket offset: 1/8" (0.125") increments, 3 positions
  // ================================================================

  // CHASSIS BRACKETS - 13" Notch Spread - Pro Mod
  // Lower chassis bracket: Bottom hole at -11" from axle CL (= 5" from ground with 16" axle CL)
  // 10 holes x 0.375" spacing = 3.375" total range on bracket
  // With offset: 3.375 + 0.250 = 3.625" effective range
  {
    id: 'qm-ext-billet-chassis-13-lower',
    partNumber: 'QM-EXT-BLT-201001-13',
    name: 'Extreme 1/8" Billet Lower Chassis Bracket (13" Spread)',
    series: 'Extreme 1/8" Billet',
    type: 'Chassis',
    description: 'Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Bracket. 10 holes with 3/8" staggered spacing. Entire bracket adjustable in 1/8" increments. Pro Mod lower bar mounting. Bottom hole targets 5" from level ground.',
    application: ['Pro Mod', 'Pro 275', 'Radial vs World', 'Outlaw 10.5'],
    material: '1/8" (0.125") Billet 4130 Chromoly',
    thickness: '1/8"',
    holeSpacing: 0.375, // 3/8" staggered
    bracketOffsetIncrement: 0.125, // 1/8" bracket movement
    bracketOffsetPositions: 3, // 0, +1/8", +1/4"
    boltSize: '1/2"',
    notchSpread: '13"',
    holes: generateExtremeBilletChassisHoles(-11.0, 21.0, 10, 'cl'),
    totalHoles: 10,
    weight: 2.6,
    notes: 'Pro Mod: Bottom hole 5" from ground. 3/8" hole spacing + 1/8" bracket adjustment = 1/8" effective resolution. Mount 20-22" fwd of axle CL.'
  },

  // Upper chassis bracket
  // Hole 1 (bottom): -7.0" from axle CL → 9.0" from ground
  // 10 holes x 0.375" = 3.375" range
  {
    id: 'qm-ext-billet-chassis-13-upper',
    partNumber: 'QM-EXT-BLT-201000-13',
    name: 'Extreme 1/8" Billet Upper Chassis Bracket (13" Spread)',
    series: 'Extreme 1/8" Billet',
    type: 'Chassis',
    description: 'Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Bracket. 10 holes with 3/8" staggered spacing. Entire bracket adjustable in 1/8" increments. Pro Mod upper bar mounting.',
    application: ['Pro Mod', 'Pro 275', 'Radial vs World', 'Outlaw 10.5'],
    material: '1/8" (0.125") Billet 4130 Chromoly',
    thickness: '1/8"',
    holeSpacing: 0.375,
    bracketOffsetIncrement: 0.125,
    bracketOffsetPositions: 3,
    boltSize: '1/2"',
    notchSpread: '13"',
    holes: generateExtremeBilletChassisHoles(-7.0, 21.0, 10, 'cu'),
    totalHoles: 10,
    weight: 2.6,
    notes: 'Pro Mod upper bar chassis mount. 3/8" hole spacing + 1/8" bracket adjustment. Pair with lower bracket.'
  },

  // 15" Notch Spread variants
  {
    id: 'qm-ext-billet-chassis-15-lower',
    partNumber: 'QM-EXT-BLT-201001-15',
    name: 'Extreme 1/8" Billet Lower Chassis Bracket (15" Spread)',
    series: 'Extreme 1/8" Billet',
    type: 'Chassis',
    description: 'Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Bracket. 15" notch spread. 10 holes with 3/8" staggered spacing.',
    application: ['Pro Mod', 'Funny Car', 'Top Sportsman', 'Comp Eliminator'],
    material: '1/8" (0.125") Billet 4130 Chromoly',
    thickness: '1/8"',
    holeSpacing: 0.375,
    bracketOffsetIncrement: 0.125,
    bracketOffsetPositions: 3,
    boltSize: '1/2"',
    notchSpread: '15"',
    holes: generateExtremeBilletChassisHoles(-11.0, 21.0, 10, 'cl15'),
    totalHoles: 10,
    weight: 2.9,
    notes: 'Pro Mod 15" spread. 3/8" hole spacing + 1/8" bracket adjustment.'
  },
  {
    id: 'qm-ext-billet-chassis-15-upper',
    partNumber: 'QM-EXT-BLT-201000-15',
    name: 'Extreme 1/8" Billet Upper Chassis Bracket (15" Spread)',
    series: 'Extreme 1/8" Billet',
    type: 'Chassis',
    description: 'Quartermax Extreme 1/8 in. Adjustable Billet Four Link Chassis Bracket. 15" notch spread. Upper bar mounting.',
    application: ['Pro Mod', 'Funny Car', 'Top Sportsman', 'Comp Eliminator'],
    material: '1/8" (0.125") Billet 4130 Chromoly',
    thickness: '1/8"',
    holeSpacing: 0.375,
    bracketOffsetIncrement: 0.125,
    bracketOffsetPositions: 3,
    boltSize: '1/2"',
    notchSpread: '15"',
    holes: generateExtremeBilletChassisHoles(-7.0, 21.0, 10, 'cu15'),
    totalHoles: 10,
    weight: 2.9,
    notes: 'Pro Mod upper chassis bracket 15" spread. 3/8" hole spacing + 1/8" bracket adjustment.'
  },

  // ================================================================
  // STRANGE MODULAR EXTREME PRO SERIES HOUSING BRACKETS
  // Holes: 3/8" (0.375") spacing
  // ================================================================
  {
    id: 'strange-modular-extreme-pro-doubler',
    partNumber: 'STR-MEPD-4L',
    name: 'Strange Modular Extreme Pro Series Housing Bracket w/ Doubler',
    series: 'Extreme 1/8" Billet',
    type: 'Housing',
    description: 'Strange Modular Extreme Pro Series Four Link Housing Bracket with Doubler. 13 holes with 3/8" spacing. Welded doubler plates for maximum strength. Billet shock mounts. 3-1/2" axle tube.',
    application: ['Pro Mod', 'Pro 275', 'Radial vs World', 'High HP Applications', 'Outlaw 10.5'],
    material: '4130 Chromoly with 1/8" welded doubler plates',
    thickness: '1/8" base + 1/8" doubler (1/4" total)',
    holeSpacing: 0.375,
    bracketOffsetIncrement: 0.125,
    bracketOffsetPositions: 3,
    boltSize: '1/2"',
    axleTubeSize: '3-1/2"',
    // 13 holes centered around axle: -2.25" to +2.25"
    holes: generateStrangeHousingHoles(-2.25, 0.0, 13),
    totalHoles: 13,
    weight: 4.8,
    notes: 'Strange Modular Extreme Pro w/ Doubler. 3/8" hole spacing. 1/4" total thickness at holes. 3000+ HP. 3-1/2" axle tube. Billet shock mounts.'
  },
  {
    id: 'strange-modular-extreme-pro-standard',
    partNumber: 'STR-MEP-4L',
    name: 'Strange Modular Extreme Pro Series Housing Bracket (Standard)',
    series: 'Extreme 1/8" Billet',
    type: 'Housing',
    description: 'Strange Modular Extreme Pro Series Four Link Housing Bracket. Standard version without doubler. 13 holes with 3/8" spacing.',
    application: ['Pro Mod', 'Pro 275', 'Radial vs World', 'All 4-Link Applications'],
    material: '1/8" (0.125") 4130 Chromoly',
    thickness: '1/8"',
    holeSpacing: 0.375,
    bracketOffsetIncrement: 0.125,
    bracketOffsetPositions: 3,
    boltSize: '1/2"',
    axleTubeSize: '3-1/2"',
    holes: generateStrangeHousingHoles(-2.25, 0.0, 13),
    totalHoles: 13,
    weight: 3.4,
    notes: 'Strange Modular Extreme Pro standard. 3/8" hole spacing. 13 holes for maximum tuning range.'
  },

  // ================================================================
  // LEGACY EXTREME PRO SERIES (0.625" spacing)
  // ================================================================
  {
    id: 'qm-eps-chassis-13-upper',
    partNumber: 'QM-201000-13',
    name: 'Extreme Pro Series Upper Chassis Bracket (13" Spread)',
    series: 'Extreme Pro Series',
    type: 'Chassis',
    description: '16 holes with 0.625" spacing. 13" notch spread.',
    application: ['Top Sportsman', 'Super Comp', 'Bracket Racing'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.625,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    notchSpread: '13"',
    holes: generateLegacyChassisHoles(-5.0, 18.0, 0.625, 16, 'eps-cu'),
    totalHoles: 16,
    weight: 2.8,
    notes: 'Extreme Pro Series. 16 holes at 0.625" spacing.'
  },
  {
    id: 'qm-eps-chassis-13-lower',
    partNumber: 'QM-201001-13',
    name: 'Extreme Pro Series Lower Chassis Bracket (13" Spread)',
    series: 'Extreme Pro Series',
    type: 'Chassis',
    description: '16 holes with 0.625" spacing. 13" notch spread for lower bar.',
    application: ['Top Sportsman', 'Super Comp', 'Bracket Racing'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.625,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    notchSpread: '13"',
    holes: generateLegacyChassisHoles(-9.0, 18.0, 0.625, 16, 'eps-cl'),
    totalHoles: 16,
    weight: 2.8,
    notes: 'Lower chassis bracket. 0.625" spacing.'
  },
  {
    id: 'qm-eps-chassis-15-upper',
    partNumber: 'QM-201000-15',
    name: 'Extreme Pro Series Upper Chassis Bracket (15" Spread)',
    series: 'Extreme Pro Series',
    type: 'Chassis',
    description: '16 holes with 0.625" spacing. 15" notch spread.',
    application: ['Top Sportsman', 'Top Dragster', 'Comp Eliminator'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.625,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    notchSpread: '15"',
    holes: generateLegacyChassisHoles(-5.0, 18.0, 0.625, 16, 'eps-cu15'),
    totalHoles: 16,
    weight: 3.2,
    notes: '15" spread. 0.625" spacing.'
  },
  {
    id: 'qm-eps-chassis-15-lower',
    partNumber: 'QM-201001-15',
    name: 'Extreme Pro Series Lower Chassis Bracket (15" Spread)',
    series: 'Extreme Pro Series',
    type: 'Chassis',
    description: '16 holes with 0.625" spacing. 15" notch spread for lower bar.',
    application: ['Top Sportsman', 'Top Dragster', 'Comp Eliminator'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.625,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    notchSpread: '15"',
    holes: generateLegacyChassisHoles(-9.0, 18.0, 0.625, 16, 'eps-cl15'),
    totalHoles: 16,
    weight: 3.2,
    notes: '15" spread lower. 0.625" spacing.'
  },

  // HOUSING BRACKETS - Extreme Pro Series
  {
    id: 'qm-eps-housing-standard',
    partNumber: 'QM-202000',
    name: 'Extreme Pro Series Housing Bracket',
    series: 'Extreme Pro Series',
    type: 'Housing',
    description: '19 holes with 0.625" spacing.',
    application: ['Top Sportsman', 'All 4-Link Applications'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.625,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    axleTubeSize: '3-1/2"',
    holes: generateLegacyHousingHoles(-5.625, 0.0, 0.625, 19, 'eps-h'),
    totalHoles: 19,
    weight: 3.5,
    notes: '19 holes at 0.625" spacing.'
  },

  // PRO SERIES (0.800" spacing)
  {
    id: 'qm-ps-housing',
    partNumber: 'QM-203000',
    name: 'Pro Series Housing Bracket',
    series: 'Pro Series',
    type: 'Housing',
    description: '15 holes with 0.800" spacing.',
    application: ['Top Sportsman', 'Super Comp', 'Bracket Racing', 'Street/Strip'],
    material: '4130 Chromoly',
    thickness: '1/4"',
    holeSpacing: 0.800,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    axleTubeSize: '3-1/2"',
    holes: generateLegacyHousingHoles(-5.6, 0.0, 0.800, 15, 'ps-h'),
    totalHoles: 15,
    weight: 3.2,
    notes: 'Pro Series. 0.800" hole spacing.'
  },

  // STANDARD SERIES (1.000" spacing)
  {
    id: 'qm-std-housing',
    partNumber: 'QM-204000',
    name: 'Standard Housing Bracket',
    series: 'Standard',
    type: 'Housing',
    description: 'Standard 1.000" hole spacing.',
    application: ['Bracket Racing', 'Street/Strip', 'Budget Builds'],
    material: 'Mild Steel',
    thickness: '1/4"',
    holeSpacing: 1.000,
    bracketOffsetIncrement: 0,
    bracketOffsetPositions: 1,
    boltSize: '1/2"',
    axleTubeSize: '3-1/2"',
    holes: generateLegacyHousingHoles(-4.5, 0.0, 1.000, 10, 'std-h'),
    totalHoles: 10,
    weight: 2.8,
    notes: 'Budget option. 1" hole spacing.'
  }
];

// ============ HELPER FUNCTIONS ============

export const getQuartermaxBracketsBySeries = (series: QuartermaxBracket['series']): QuartermaxBracket[] => {
  return quartermaxBrackets.filter(bracket => bracket.series === series);
};

export const getQuartermaxBracketsByType = (type: QuartermaxBracket['type']): QuartermaxBracket[] => {
  return quartermaxBrackets.filter(bracket => bracket.type === type);
};

export const getQuartermaxBracketById = (id: string): QuartermaxBracket | undefined => {
  return quartermaxBrackets.find(bracket => bracket.id === id);
};

export const getAllQuartermaxSeries = (): QuartermaxBracket['series'][] => {
  return ['Extreme 1/8" Billet', 'Extreme Pro Series', 'Pro Series', 'Standard'];
};

export const getHousingBrackets = (): QuartermaxBracket[] => {
  return quartermaxBrackets.filter(bracket => bracket.type === 'Housing');
};

export const getChassisBrackets = (): QuartermaxBracket[] => {
  return quartermaxBrackets.filter(bracket => bracket.type === 'Chassis');
};

export const calculateQuartermaxMountHeight = (
  holeHeightFromAxle: number,
  rearEndCenterHeight: number
): number => {
  return rearEndCenterHeight + holeHeightFromAxle;
};

// Get effective hole height with bracket offset applied
export const getEffectiveHoleHeight = (
  hole: QuartermaxHole,
  bracketOffset: number // in inches (0, 0.125, 0.250)
): number => {
  return hole.heightFromAxle + bracketOffset;
};

// Get all effective hole positions for a bracket at a given offset
export const getEffectiveHoles = (
  bracket: QuartermaxBracket,
  bracketOffset: number
): QuartermaxHole[] => {
  return bracket.holes.map(hole => ({
    ...hole,
    heightFromAxle: parseFloat((hole.heightFromAxle + bracketOffset).toFixed(3))
  }));
};

export const getRecommendedHole = (
  bracket: QuartermaxBracket,
  targetHeight: number,
  rearEndCenterHeight: number
): QuartermaxHole | null => {
  const targetHeightFromAxle = targetHeight - rearEndCenterHeight;
  let closestHole: QuartermaxHole | null = null;
  let closestDiff = Infinity;

  for (const hole of bracket.holes) {
    const diff = Math.abs(hole.heightFromAxle - targetHeightFromAxle);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestHole = hole;
    }
  }

  return closestHole;
};

// ============ PRO MOD VALIDATION ============

export interface ProModValidationResult {
  isValid: boolean;
  bottomHoleHeight: number | null;
  bottomHoleTarget: number;
  bottomHoleDifference: number | null;
  bottomHoleStatus: 'good' | 'warning' | 'error' | 'pending';
  bottomHoleMessage: string;
  forwardDistance: number;
  forwardDistanceStatus: 'good' | 'warning' | 'error';
  forwardDistanceMessage: string;
  axleCLStatus: 'good' | 'warning' | 'error' | 'pending';
  axleCLMessage: string;
}

export const validateProModSetup = (
  axleCLHeight: number | null,
  chassisBottomHole: QuartermaxHole | null,
  chassisForwardDistance: number,
  bracketOffset: number = 0
): ProModValidationResult => {
  const result: ProModValidationResult = {
    isValid: false,
    bottomHoleHeight: null,
    bottomHoleTarget: PRO_MOD_SPEC.chassisBottomHoleFromGround,
    bottomHoleDifference: null,
    bottomHoleStatus: 'pending',
    bottomHoleMessage: '',
    forwardDistance: chassisForwardDistance,
    forwardDistanceStatus: 'good',
    forwardDistanceMessage: '',
    axleCLStatus: 'pending',
    axleCLMessage: '',
  };

  // Validate forward distance
  if (chassisForwardDistance >= PRO_MOD_SPEC.chassisForwardOfAxleMin &&
      chassisForwardDistance <= PRO_MOD_SPEC.chassisForwardOfAxleMax) {
    result.forwardDistanceStatus = 'good';
    result.forwardDistanceMessage = `${chassisForwardDistance}" is within Pro Mod range (${PRO_MOD_SPEC.chassisForwardOfAxleMin}-${PRO_MOD_SPEC.chassisForwardOfAxleMax}")`;
  } else if (Math.abs(chassisForwardDistance - 21) <= PRO_MOD_TOLERANCES.forwardDistanceTolerance + 1) {
    result.forwardDistanceStatus = 'warning';
    result.forwardDistanceMessage = `${chassisForwardDistance}" is outside typical Pro Mod range`;
  } else {
    result.forwardDistanceStatus = 'error';
    result.forwardDistanceMessage = `${chassisForwardDistance}" is significantly outside Pro Mod range`;
  }

  // Validate axle CL height
  if (axleCLHeight !== null) {
    if (axleCLHeight >= PRO_MOD_TOLERANCES.axleCLHeightMin &&
        axleCLHeight <= PRO_MOD_TOLERANCES.axleCLHeightMax) {
      result.axleCLStatus = 'good';
      result.axleCLMessage = `Axle CL ${axleCLHeight.toFixed(2)}" within expected range`;
    } else if (axleCLHeight >= PRO_MOD_TOLERANCES.axleCLHeightMin - 1 &&
               axleCLHeight <= PRO_MOD_TOLERANCES.axleCLHeightMax + 1) {
      result.axleCLStatus = 'warning';
      result.axleCLMessage = `Axle CL ${axleCLHeight.toFixed(2)}" slightly outside range`;
    } else {
      result.axleCLStatus = 'error';
      result.axleCLMessage = `Axle CL ${axleCLHeight.toFixed(2)}" outside expected range`;
    }

    // Validate bottom hole height from ground (with bracket offset applied)
    if (chassisBottomHole) {
      const effectiveHeight = chassisBottomHole.heightFromAxle + bracketOffset;
      result.bottomHoleHeight = axleCLHeight + effectiveHeight;
      result.bottomHoleDifference = result.bottomHoleHeight - PRO_MOD_SPEC.chassisBottomHoleFromGround;
      const absDiff = Math.abs(result.bottomHoleDifference);

      if (absDiff <= PRO_MOD_TOLERANCES.bottomHoleHeightTolerance) {
        result.bottomHoleStatus = 'good';
        result.bottomHoleMessage = `Bottom hole at ${result.bottomHoleHeight.toFixed(2)}" from ground (target: ${PRO_MOD_SPEC.chassisBottomHoleFromGround}")`;
      } else if (absDiff <= PRO_MOD_TOLERANCES.bottomHoleHeightWarning) {
        result.bottomHoleStatus = 'warning';
        result.bottomHoleMessage = `Bottom hole at ${result.bottomHoleHeight.toFixed(2)}" (${result.bottomHoleDifference > 0 ? '+' : ''}${result.bottomHoleDifference.toFixed(2)}" from target)`;
      } else {
        result.bottomHoleStatus = 'error';
        result.bottomHoleMessage = `Bottom hole at ${result.bottomHoleHeight.toFixed(2)}" is ${absDiff.toFixed(2)}" from ${PRO_MOD_SPEC.chassisBottomHoleFromGround}" target`;
      }
    }

    result.isValid = result.bottomHoleStatus !== 'error' &&
                     result.forwardDistanceStatus !== 'error' &&
                     result.axleCLStatus !== 'error';
  }

  return result;
};

export const getBottomHole = (bracket: QuartermaxBracket): QuartermaxHole | null => {
  if (!bracket.holes.length) return null;
  return bracket.holes.reduce((lowest, hole) =>
    hole.heightFromAxle < lowest.heightFromAxle ? hole : lowest
  , bracket.holes[0]);
};
