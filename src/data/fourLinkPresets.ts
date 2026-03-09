// 4-Link Presets Library
// Common starting configurations for different drag racing car types

export type PresetCategory = 'Pro' | 'Radial' | 'Street' | 'Bracket' | 'No Prep' | 'Custom';

export interface FourLinkSettings {
  upperBarChassisMountHeight: number;
  upperBarChassisMountForward: number;
  upperBarRearEndMountHeight: number;
  upperBarRearEndMountForward: number;
  lowerBarChassisMountHeight: number;
  lowerBarChassisMountForward: number;
  lowerBarRearEndMountHeight: number;
  lowerBarRearEndMountForward: number;
  wheelbase: number;
  rearTireRadius: number;
  frontTireRadius: number;
  rearEndCenterHeight: number;
}

export interface FourLinkPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  characteristics: string[];
  targetAntiSquat: { min: number; max: number };
  settings: FourLinkSettings;
  recommendedPinionAngle: number;
  notes: string;
  isUserPreset?: boolean;
  createdAt?: string;
}



export const fourLinkPresets: FourLinkPreset[] = [
  // PRO CATEGORY
  {
    id: 'pro-mod-aggressive',
    name: 'Pro Mod - Aggressive',
    category: 'Pro',
    description: 'High anti-squat setup for maximum weight transfer on prepped surfaces',
    characteristics: [
      'High IC location for aggressive launch',
      'Optimized for 3000+ HP applications',
      'Best on well-prepped tracks',
      'Requires precise shock tuning'
    ],
    targetAntiSquat: { min: 130, max: 150 },
    settings: {
      upperBarChassisMountHeight: 19.5,
      upperBarChassisMountForward: 30,
      upperBarRearEndMountHeight: 14.5,
      upperBarRearEndMountForward: 5,
      lowerBarChassisMountHeight: 8.0,
      lowerBarChassisMountForward: 36,
      lowerBarRearEndMountHeight: 10.5,
      lowerBarRearEndMountForward: 2,
      wheelbase: 115,
      rearTireRadius: 18,
      frontTireRadius: 13,
      rearEndCenterHeight: 11.5
    },
    recommendedPinionAngle: -3.0,
    notes: 'Start here for Pro Mod on sticky tracks. May need to lower IC height on less prepped surfaces.'
  },
  {
    id: 'pro-mod-balanced',
    name: 'Pro Mod - Balanced',
    category: 'Pro',
    description: 'Versatile Pro Mod setup that works across varying track conditions',
    characteristics: [
      'Moderate IC height for consistency',
      'Good tire loading without excessive squat',
      'Works on good to excellent track prep',
      'Easier to tune around'
    ],
    targetAntiSquat: { min: 115, max: 130 },
    settings: {
      upperBarChassisMountHeight: 18.5,
      upperBarChassisMountForward: 32,
      upperBarRearEndMountHeight: 14.0,
      upperBarRearEndMountForward: 6,
      lowerBarChassisMountHeight: 8.5,
      lowerBarChassisMountForward: 38,
      lowerBarRearEndMountHeight: 10.0,
      lowerBarRearEndMountForward: 2,
      wheelbase: 115,
      rearTireRadius: 18,
      frontTireRadius: 13,
      rearEndCenterHeight: 11
    },
    recommendedPinionAngle: -2.5,
    notes: 'Good all-around Pro Mod baseline. Adjust IC height based on track conditions.'
  },
  {
    id: 'top-sportsman',
    name: 'Top Sportsman / Top Dragster',
    category: 'Pro',
    description: 'Setup optimized for Top Sportsman and similar high-HP bracket cars',
    characteristics: [
      'Moderate anti-squat for consistency',
      'Designed for 1500-2500 HP range',
      'Predictable launch characteristics',
      'Good for index racing'
    ],
    targetAntiSquat: { min: 110, max: 125 },
    settings: {
      upperBarChassisMountHeight: 18.0,
      upperBarChassisMountForward: 33,
      upperBarRearEndMountHeight: 13.5,
      upperBarRearEndMountForward: 6,
      lowerBarChassisMountHeight: 8.5,
      lowerBarChassisMountForward: 39,
      lowerBarRearEndMountHeight: 9.5,
      lowerBarRearEndMountForward: 2.5,
      wheelbase: 112,
      rearTireRadius: 17,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.5
    },
    recommendedPinionAngle: -2.0,
    notes: 'Consistent baseline for bracket-style racing. Focus on repeatability over peak performance.'
  },

  // RADIAL CATEGORY
  {
    id: 'drag-radial-sticky',
    name: 'Drag Radial - Sticky Track',
    category: 'Radial',
    description: 'Radial tire setup optimized for well-prepped surfaces',
    characteristics: [
      'Higher anti-squat for radial tire loading',
      'Optimized for 315/405 radial tires',
      'Works best on prepped tracks',
      'Aggressive weight transfer'
    ],
    targetAntiSquat: { min: 120, max: 140 },
    settings: {
      upperBarChassisMountHeight: 18.75,
      upperBarChassisMountForward: 31,
      upperBarRearEndMountHeight: 14.25,
      upperBarRearEndMountForward: 5.5,
      lowerBarChassisMountHeight: 8.25,
      lowerBarChassisMountForward: 37,
      lowerBarRearEndMountHeight: 10.25,
      lowerBarRearEndMountForward: 2,
      wheelbase: 110,
      rearTireRadius: 16.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.75
    },
    recommendedPinionAngle: -2.75,
    notes: 'Start here for Radial vs. The World or Pro 275 on sticky tracks.'
  },
  {
    id: 'drag-radial-moderate',
    name: 'Drag Radial - Moderate Track',
    category: 'Radial',
    description: 'Versatile radial setup for varying track conditions',
    characteristics: [
      'Balanced IC location',
      'Works on moderate to good track prep',
      'Forgiving on tire shake',
      'Good starting point for tuning'
    ],
    targetAntiSquat: { min: 105, max: 120 },
    settings: {
      upperBarChassisMountHeight: 18.0,
      upperBarChassisMountForward: 33,
      upperBarRearEndMountHeight: 13.75,
      upperBarRearEndMountForward: 6,
      lowerBarChassisMountHeight: 8.5,
      lowerBarChassisMountForward: 39,
      lowerBarRearEndMountHeight: 9.75,
      lowerBarRearEndMountForward: 2.5,
      wheelbase: 110,
      rearTireRadius: 16.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.5
    },
    recommendedPinionAngle: -2.25,
    notes: 'Good baseline for most radial tire applications. Adjust based on track conditions.'
  },
  {
    id: 'x275-ldr',
    name: 'X275 / Limited Drag Radial',
    category: 'Radial',
    description: 'Setup for X275 and Limited Drag Radial classes with smaller tires',
    characteristics: [
      'Optimized for 275 radial tires',
      'Lower IC for smaller tire footprint',
      'Works with limited power combinations',
      'Consistent 60-foot times'
    ],
    targetAntiSquat: { min: 100, max: 115 },
    settings: {
      upperBarChassisMountHeight: 17.5,
      upperBarChassisMountForward: 34,
      upperBarRearEndMountHeight: 13.25,
      upperBarRearEndMountForward: 6.5,
      lowerBarChassisMountHeight: 8.75,
      lowerBarChassisMountForward: 40,
      lowerBarRearEndMountHeight: 9.5,
      lowerBarRearEndMountForward: 3,
      wheelbase: 108,
      rearTireRadius: 15.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.25
    },
    recommendedPinionAngle: -2.0,
    notes: 'Baseline for 275 radial classes. May need adjustment for specific tire compounds.'
  },

  // NO PREP CATEGORY
  {
    id: 'no-prep-conservative',
    name: 'No Prep - Conservative',
    category: 'No Prep',
    description: 'Lower anti-squat setup for unprepared or lightly prepped surfaces',
    characteristics: [
      'Lower IC to prevent tire spin',
      'Gentler weight transfer',
      'Better for inconsistent surfaces',
      'Reduces tire shock'
    ],
    targetAntiSquat: { min: 85, max: 100 },
    settings: {
      upperBarChassisMountHeight: 17.0,
      upperBarChassisMountForward: 35,
      upperBarRearEndMountHeight: 13.0,
      upperBarRearEndMountForward: 7,
      lowerBarChassisMountHeight: 9.0,
      lowerBarChassisMountForward: 41,
      lowerBarRearEndMountHeight: 9.25,
      lowerBarRearEndMountForward: 3.5,
      wheelbase: 110,
      rearTireRadius: 16.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10
    },
    recommendedPinionAngle: -1.5,
    notes: 'Start here for no-prep racing. Focus on hooking rather than peak anti-squat.'
  },
  {
    id: 'no-prep-aggressive',
    name: 'No Prep - Aggressive',
    category: 'No Prep',
    description: 'Higher anti-squat for no-prep when track starts to come around',
    characteristics: [
      'Moderate IC for improving track',
      'More weight transfer as track grips',
      'Good for later rounds',
      'Requires good tire management'
    ],
    targetAntiSquat: { min: 95, max: 110 },
    settings: {
      upperBarChassisMountHeight: 17.75,
      upperBarChassisMountForward: 33,
      upperBarRearEndMountHeight: 13.5,
      upperBarRearEndMountForward: 6,
      lowerBarChassisMountHeight: 8.75,
      lowerBarChassisMountForward: 39,
      lowerBarRearEndMountHeight: 9.5,
      lowerBarRearEndMountForward: 3,
      wheelbase: 110,
      rearTireRadius: 16.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.25
    },
    recommendedPinionAngle: -2.0,
    notes: 'Use when track conditions improve. May need to back off if track gets slick again.'
  },

  // STREET CATEGORY
  {
    id: 'street-strip-mild',
    name: 'Street/Strip - Mild',
    category: 'Street',
    description: 'Setup for street cars with occasional track use (under 800 HP)',
    characteristics: [
      'Lower anti-squat for street manners',
      'Works with stock-style suspension',
      'Good ride quality compromise',
      'Suitable for 10-12 second cars'
    ],
    targetAntiSquat: { min: 80, max: 95 },
    settings: {
      upperBarChassisMountHeight: 16.5,
      upperBarChassisMountForward: 36,
      upperBarRearEndMountHeight: 12.5,
      upperBarRearEndMountForward: 7,
      lowerBarChassisMountHeight: 9.25,
      lowerBarChassisMountForward: 42,
      lowerBarRearEndMountHeight: 9.0,
      lowerBarRearEndMountForward: 4,
      wheelbase: 108,
      rearTireRadius: 15,
      frontTireRadius: 13,
      rearEndCenterHeight: 9.5
    },
    recommendedPinionAngle: -1.5,
    notes: 'Good starting point for street/strip cars. Maintains reasonable ride quality.'
  },
  {
    id: 'street-strip-aggressive',
    name: 'Street/Strip - Aggressive',
    category: 'Street',
    description: 'More aggressive setup for dedicated street/strip cars (800-1500 HP)',
    characteristics: [
      'Higher anti-squat for more power',
      'Better track performance',
      'May affect street ride quality',
      'Suitable for 9-10 second cars'
    ],
    targetAntiSquat: { min: 95, max: 110 },
    settings: {
      upperBarChassisMountHeight: 17.25,
      upperBarChassisMountForward: 34,
      upperBarRearEndMountHeight: 13.0,
      upperBarRearEndMountForward: 6.5,
      lowerBarChassisMountHeight: 9.0,
      lowerBarChassisMountForward: 40,
      lowerBarRearEndMountHeight: 9.25,
      lowerBarRearEndMountForward: 3.5,
      wheelbase: 108,
      rearTireRadius: 15.5,
      frontTireRadius: 13,
      rearEndCenterHeight: 10
    },
    recommendedPinionAngle: -2.0,
    notes: 'For more serious street/strip applications. Better track performance at expense of ride.'
  },
  {
    id: 'outlaw-105',
    name: 'Outlaw 10.5',
    category: 'Street',
    description: 'Setup for Outlaw 10.5 and similar small tire classes',
    characteristics: [
      'Optimized for 10.5" wide slicks',
      'Moderate anti-squat for tire loading',
      'Good for high HP small tire',
      'Works on prepped tracks'
    ],
    targetAntiSquat: { min: 105, max: 120 },
    settings: {
      upperBarChassisMountHeight: 17.75,
      upperBarChassisMountForward: 33,
      upperBarRearEndMountHeight: 13.5,
      upperBarRearEndMountForward: 6,
      lowerBarChassisMountHeight: 8.75,
      lowerBarChassisMountForward: 39,
      lowerBarRearEndMountHeight: 9.75,
      lowerBarRearEndMountForward: 2.5,
      wheelbase: 106,
      rearTireRadius: 15,
      frontTireRadius: 13,
      rearEndCenterHeight: 10
    },
    recommendedPinionAngle: -2.25,
    notes: 'Baseline for 10.5 small tire classes. Adjust IC based on power level and track.'
  },

  // BRACKET CATEGORY
  {
    id: 'bracket-consistent',
    name: 'Bracket - Consistency Focus',
    category: 'Bracket',
    description: 'Setup prioritizing consistent, repeatable 60-foot times',
    characteristics: [
      'Lower anti-squat for repeatability',
      'Gentle launch characteristics',
      'Easy to dial',
      'Forgiving on varying track conditions'
    ],
    targetAntiSquat: { min: 90, max: 105 },
    settings: {
      upperBarChassisMountHeight: 17.0,
      upperBarChassisMountForward: 35,
      upperBarRearEndMountHeight: 13.0,
      upperBarRearEndMountForward: 7,
      lowerBarChassisMountHeight: 9.0,
      lowerBarChassisMountForward: 41,
      lowerBarRearEndMountHeight: 9.25,
      lowerBarRearEndMountForward: 3.5,
      wheelbase: 108,
      rearTireRadius: 16,
      frontTireRadius: 13,
      rearEndCenterHeight: 10
    },
    recommendedPinionAngle: -1.75,
    notes: 'Prioritizes consistency over peak performance. Great for bracket racing.'
  },
  {
    id: 'bracket-performance',
    name: 'Bracket - Performance Focus',
    category: 'Bracket',
    description: 'Setup for bracket racing when you need every tenth',
    characteristics: [
      'Higher anti-squat for better ETs',
      'More aggressive launch',
      'Requires more precise tuning',
      'Best on consistent track conditions'
    ],
    targetAntiSquat: { min: 100, max: 115 },
    settings: {
      upperBarChassisMountHeight: 17.5,
      upperBarChassisMountForward: 34,
      upperBarRearEndMountHeight: 13.25,
      upperBarRearEndMountForward: 6.5,
      lowerBarChassisMountHeight: 8.75,
      lowerBarChassisMountForward: 40,
      lowerBarRearEndMountHeight: 9.5,
      lowerBarRearEndMountForward: 3,
      wheelbase: 108,
      rearTireRadius: 16,
      frontTireRadius: 13,
      rearEndCenterHeight: 10.25
    },
    recommendedPinionAngle: -2.0,
    notes: 'When you need to run your number. May sacrifice some consistency for performance.'
  },
  {
    id: 'junior-dragster',
    name: 'Junior Dragster',
    category: 'Bracket',
    description: 'Setup for Junior Dragster applications',
    characteristics: [
      'Scaled for smaller chassis',
      'Lower anti-squat for safety',
      'Gentle launch characteristics',
      'Easy for young drivers'
    ],
    targetAntiSquat: { min: 75, max: 90 },
    settings: {
      upperBarChassisMountHeight: 10.5,
      upperBarChassisMountForward: 22,
      upperBarRearEndMountHeight: 8.5,
      upperBarRearEndMountForward: 4,
      lowerBarChassisMountHeight: 5.5,
      lowerBarChassisMountForward: 26,
      lowerBarRearEndMountHeight: 6.0,
      lowerBarRearEndMountForward: 2,
      wheelbase: 90,
      rearTireRadius: 10,
      frontTireRadius: 8,
      rearEndCenterHeight: 7
    },
    recommendedPinionAngle: -1.0,
    notes: 'Baseline for Junior Dragster. Prioritizes safety and predictability.'
  }
];

// Helper function to get presets by category
export const getPresetsByCategory = (category: FourLinkPreset['category']): FourLinkPreset[] => {
  return fourLinkPresets.filter(preset => preset.category === category);
};

// Helper function to get all categories (including Custom for user presets)
export const getPresetCategories = (): PresetCategory[] => {
  return ['Pro', 'Radial', 'No Prep', 'Street', 'Bracket'];
};

// Helper function to get all categories including Custom
export const getAllPresetCategories = (): PresetCategory[] => {
  return ['Pro', 'Radial', 'No Prep', 'Street', 'Bracket', 'Custom'];
};

// Helper function to find a preset by ID
export const getPresetById = (id: string): FourLinkPreset | undefined => {
  return fourLinkPresets.find(preset => preset.id === id);
};

