// Strange Engineering Rear End Mount Brackets
// Specifications for 4-Link suspension applications

export interface BracketMountHole {
  id: string;
  label: string;
  heightFromAxle: number; // inches from axle centerline
  forwardOfAxle: number; // inches forward of axle centerline
}

export interface StrangeBracket {
  id: string;
  partNumber: string;
  name: string;
  series: 'S-Series' | 'Pro Stock' | 'Ultra' | 'Sportsman' | 'Economy';
  type: 'Weld-On' | 'Bolt-On' | 'Clamp-On';
  description: string;
  application: string[];
  housingCompatibility: string[];
  material: string;
  upperMountHoles: BracketMountHole[];
  lowerMountHoles: BracketMountHole[];
  spread: number; // distance between upper and lower mount centerlines
  weight: number; // lbs per pair
  imageUrl?: string;
  notes: string;
}

export const strangeBrackets: StrangeBracket[] = [
  // S-SERIES (Pro Mod / High-End)
  {
    id: 'strange-s1000',
    partNumber: 'S1000',
    name: 'S-Series Pro Mod Bracket',
    series: 'S-Series',
    type: 'Weld-On',
    description: 'Premium Pro Mod 4-link bracket with multiple adjustment holes',
    application: ['Pro Mod', 'Pro 275', 'Radial vs World', 'Top Sportsman'],
    housingCompatibility: ['Strange S60', 'Strange Ultra', '9" Ford', 'Fabricated'],
    material: '4130 Chromoly',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.5, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3 (High)', heightFromAxle: 4.0, forwardOfAxle: 5.0 },
      { id: 'u4', label: 'Upper 4 (Highest)', heightFromAxle: 4.5, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1 (Low)', heightFromAxle: -1.0, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.5, forwardOfAxle: 2.0 },
      { id: 'l3', label: 'Lower 3 (High)', heightFromAxle: 0.0, forwardOfAxle: 2.0 }
    ],
    spread: 4.0,
    weight: 3.2,
    notes: 'Most popular bracket for Pro Mod applications. 4130 chromoly construction with precision laser-cut holes.'
  },
  {
    id: 'strange-s1001',
    partNumber: 'S1001',
    name: 'S-Series Pro Mod Extended',
    series: 'S-Series',
    type: 'Weld-On',
    description: 'Extended Pro Mod bracket for longer bar angles',
    application: ['Pro Mod', 'Pro 275', 'Outlaw 10.5'],
    housingCompatibility: ['Strange S60', 'Strange Ultra', '9" Ford', 'Fabricated'],
    material: '4130 Chromoly',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 3.0, forwardOfAxle: 6.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.5, forwardOfAxle: 6.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 4.0, forwardOfAxle: 6.0 },
      { id: 'u4', label: 'Upper 4 (High)', heightFromAxle: 4.5, forwardOfAxle: 6.0 },
      { id: 'u5', label: 'Upper 5 (Highest)', heightFromAxle: 5.0, forwardOfAxle: 6.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1 (Low)', heightFromAxle: -1.5, forwardOfAxle: 2.5 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -1.0, forwardOfAxle: 2.5 },
      { id: 'l3', label: 'Lower 3', heightFromAxle: -0.5, forwardOfAxle: 2.5 },
      { id: 'l4', label: 'Lower 4 (High)', heightFromAxle: 0.0, forwardOfAxle: 2.5 }
    ],
    spread: 5.0,
    weight: 3.8,
    notes: 'Extended bracket for more bar angle adjustment. Ideal for cars needing longer IC lengths.'
  },
  {
    id: 'strange-s1002',
    partNumber: 'S1002',
    name: 'S-Series Drag Radial',
    series: 'S-Series',
    type: 'Weld-On',
    description: 'Optimized for drag radial tire applications',
    application: ['Drag Radial', 'X275', 'Limited Drag Radial', 'No Prep'],
    housingCompatibility: ['Strange S60', '9" Ford', 'GM 12-Bolt', 'Fabricated'],
    material: '4130 Chromoly',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 2.75, forwardOfAxle: 5.5 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.25, forwardOfAxle: 5.5 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 3.75, forwardOfAxle: 5.5 },
      { id: 'u4', label: 'Upper 4 (High)', heightFromAxle: 4.25, forwardOfAxle: 5.5 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1 (Low)', heightFromAxle: -1.25, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.75, forwardOfAxle: 2.0 },
      { id: 'l3', label: 'Lower 3 (High)', heightFromAxle: -0.25, forwardOfAxle: 2.0 }
    ],
    spread: 4.0,
    weight: 3.0,
    notes: 'Designed specifically for radial tire applications. Hole spacing optimized for radial tire loading characteristics.'
  },

  // PRO STOCK SERIES
  {
    id: 'strange-ps2000',
    partNumber: 'PS2000',
    name: 'Pro Stock Standard',
    series: 'Pro Stock',
    type: 'Weld-On',
    description: 'Traditional Pro Stock style bracket',
    application: ['Pro Stock', 'Comp Eliminator', 'Top Sportsman', 'Top Dragster'],
    housingCompatibility: ['Strange S60', 'Strange Ultra', '9" Ford'],
    material: '4130 Chromoly',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 3.25, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.75, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 4.25, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.75, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.25, forwardOfAxle: 2.0 }
    ],
    spread: 4.0,
    weight: 2.8,
    notes: 'Classic Pro Stock bracket design. Proven geometry for consistent launches.'
  },
  {
    id: 'strange-ps2001',
    partNumber: 'PS2001',
    name: 'Pro Stock Multi-Adjust',
    series: 'Pro Stock',
    type: 'Weld-On',
    description: 'Pro Stock bracket with additional adjustment range',
    application: ['Pro Stock', 'Comp Eliminator', 'Super Stock', 'Stock Eliminator'],
    housingCompatibility: ['Strange S60', 'Strange Ultra', '9" Ford', 'Dana 60'],
    material: '4130 Chromoly',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 3.0, forwardOfAxle: 4.5 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.5, forwardOfAxle: 4.5 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 4.0, forwardOfAxle: 4.5 },
      { id: 'u4', label: 'Upper 4', heightFromAxle: 3.0, forwardOfAxle: 5.5 },
      { id: 'u5', label: 'Upper 5', heightFromAxle: 3.5, forwardOfAxle: 5.5 },
      { id: 'u6', label: 'Upper 6 (High)', heightFromAxle: 4.0, forwardOfAxle: 5.5 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -1.0, forwardOfAxle: 1.5 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.5, forwardOfAxle: 1.5 },
      { id: 'l3', label: 'Lower 3', heightFromAxle: -1.0, forwardOfAxle: 2.5 },
      { id: 'l4', label: 'Lower 4', heightFromAxle: -0.5, forwardOfAxle: 2.5 }
    ],
    spread: 4.0,
    weight: 3.4,
    notes: 'Maximum adjustability for fine-tuning. Multiple forward positions for IC length adjustment.'
  },

  // ULTRA SERIES (Heavy Duty)
  {
    id: 'strange-u3000',
    partNumber: 'U3000',
    name: 'Ultra Heavy Duty',
    series: 'Ultra',
    type: 'Weld-On',
    description: 'Heavy duty bracket for extreme horsepower applications',
    application: ['Top Fuel', 'Funny Car', 'Pro Mod 4000+ HP', 'Jet Cars'],
    housingCompatibility: ['Strange Ultra', 'Fabricated Heavy Duty'],
    material: '4130 Chromoly - Heavy Wall',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 3.5, forwardOfAxle: 5.5 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 4.0, forwardOfAxle: 5.5 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 4.5, forwardOfAxle: 5.5 },
      { id: 'u4', label: 'Upper 4', heightFromAxle: 5.0, forwardOfAxle: 5.5 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -1.0, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.5, forwardOfAxle: 2.0 },
      { id: 'l3', label: 'Lower 3', heightFromAxle: 0.0, forwardOfAxle: 2.0 }
    ],
    spread: 5.0,
    weight: 4.5,
    notes: 'Built for extreme applications. Heavy wall chromoly with reinforced gussets.'
  },
  {
    id: 'strange-u3001',
    partNumber: 'U3001',
    name: 'Ultra Adjustable',
    series: 'Ultra',
    type: 'Weld-On',
    description: 'Ultra series with maximum adjustment range',
    application: ['Pro Mod', 'Top Sportsman', 'Pro 275', 'Radial vs World'],
    housingCompatibility: ['Strange Ultra', 'Strange S60', 'Fabricated'],
    material: '4130 Chromoly - Heavy Wall',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.5, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 4.0, forwardOfAxle: 5.0 },
      { id: 'u4', label: 'Upper 4', heightFromAxle: 4.5, forwardOfAxle: 5.0 },
      { id: 'u5', label: 'Upper 5', heightFromAxle: 3.0, forwardOfAxle: 6.0 },
      { id: 'u6', label: 'Upper 6', heightFromAxle: 3.5, forwardOfAxle: 6.0 },
      { id: 'u7', label: 'Upper 7', heightFromAxle: 4.0, forwardOfAxle: 6.0 },
      { id: 'u8', label: 'Upper 8 (High)', heightFromAxle: 4.5, forwardOfAxle: 6.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -1.5, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -1.0, forwardOfAxle: 2.0 },
      { id: 'l3', label: 'Lower 3', heightFromAxle: -0.5, forwardOfAxle: 2.0 },
      { id: 'l4', label: 'Lower 4', heightFromAxle: -1.5, forwardOfAxle: 3.0 },
      { id: 'l5', label: 'Lower 5', heightFromAxle: -1.0, forwardOfAxle: 3.0 },
      { id: 'l6', label: 'Lower 6', heightFromAxle: -0.5, forwardOfAxle: 3.0 }
    ],
    spread: 5.0,
    weight: 4.2,
    notes: 'Maximum adjustability in a heavy-duty package. 8 upper and 6 lower hole positions.'
  },

  // SPORTSMAN SERIES
  {
    id: 'strange-sp4000',
    partNumber: 'SP4000',
    name: 'Sportsman Standard',
    series: 'Sportsman',
    type: 'Weld-On',
    description: 'Quality bracket for sportsman racing applications',
    application: ['Super Comp', 'Super Gas', 'Super Street', 'Bracket Racing'],
    housingCompatibility: ['9" Ford', 'GM 12-Bolt', 'Dana 60', 'Strange S60'],
    material: 'Mild Steel',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 2.75, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.25, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 3.75, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.75, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.25, forwardOfAxle: 2.0 }
    ],
    spread: 3.5,
    weight: 2.5,
    notes: 'Excellent value for sportsman applications. Precision laser-cut mild steel construction.'
  },
  {
    id: 'strange-sp4001',
    partNumber: 'SP4001',
    name: 'Sportsman Multi-Hole',
    series: 'Sportsman',
    type: 'Weld-On',
    description: 'Sportsman bracket with additional adjustment holes',
    application: ['Super Comp', 'Super Gas', 'Bracket Racing', 'Street/Strip'],
    housingCompatibility: ['9" Ford', 'GM 12-Bolt', 'Dana 60', 'Strange S60', 'Mopar 8.75'],
    material: 'Mild Steel',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 2.5, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 3.5, forwardOfAxle: 5.0 },
      { id: 'u4', label: 'Upper 4 (High)', heightFromAxle: 4.0, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1 (Low)', heightFromAxle: -1.0, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.5, forwardOfAxle: 2.0 },
      { id: 'l3', label: 'Lower 3 (High)', heightFromAxle: 0.0, forwardOfAxle: 2.0 }
    ],
    spread: 4.0,
    weight: 2.8,
    notes: 'More adjustment range than standard sportsman bracket. Great for tuning and experimentation.'
  },

  // ECONOMY SERIES
  {
    id: 'strange-e5000',
    partNumber: 'E5000',
    name: 'Economy Basic',
    series: 'Economy',
    type: 'Weld-On',
    description: 'Budget-friendly bracket for entry-level applications',
    application: ['Street/Strip', 'Bracket Racing', 'Test & Tune'],
    housingCompatibility: ['9" Ford', 'GM 10-Bolt', 'GM 12-Bolt', 'Dana 60'],
    material: 'Mild Steel',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.5, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.5, forwardOfAxle: 2.0 }
    ],
    spread: 3.5,
    weight: 2.2,
    notes: 'Entry-level bracket for budget builds. Simple 2-hole upper, single lower design.'
  },
  {
    id: 'strange-e5001',
    partNumber: 'E5001',
    name: 'Economy Street/Strip',
    series: 'Economy',
    type: 'Weld-On',
    description: 'Economy bracket with street/strip focused geometry',
    application: ['Street/Strip', 'Mild Bracket', 'Test & Tune', 'Weekend Warrior'],
    housingCompatibility: ['9" Ford', 'GM 10-Bolt', 'GM 12-Bolt', 'Dana 60', 'Ford 8.8'],
    material: 'Mild Steel',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1 (Low)', heightFromAxle: 2.5, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3 (High)', heightFromAxle: 3.5, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.75, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.25, forwardOfAxle: 2.0 }
    ],
    spread: 3.25,
    weight: 2.4,
    notes: 'Good value for street/strip builds. 3 upper and 2 lower hole positions.'
  },

  // BOLT-ON OPTIONS
  {
    id: 'strange-b6000',
    partNumber: 'B6000',
    name: 'Bolt-On 9" Ford',
    series: 'Sportsman',
    type: 'Bolt-On',
    description: 'Bolt-on bracket for 9" Ford housings',
    application: ['Street/Strip', 'Bracket Racing', 'No Welding Required'],
    housingCompatibility: ['9" Ford'],
    material: 'Billet Aluminum',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 2.75, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.25, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 3.75, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.5, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: 0.0, forwardOfAxle: 2.0 }
    ],
    spread: 3.75,
    weight: 3.0,
    notes: 'No welding required. Bolts to existing 9" Ford housing end flanges.'
  },
  {
    id: 'strange-b6001',
    partNumber: 'B6001',
    name: 'Bolt-On GM 12-Bolt',
    series: 'Sportsman',
    type: 'Bolt-On',
    description: 'Bolt-on bracket for GM 12-Bolt housings',
    application: ['Street/Strip', 'Bracket Racing', 'No Welding Required'],
    housingCompatibility: ['GM 12-Bolt'],
    material: 'Billet Aluminum',
    upperMountHoles: [
      { id: 'u1', label: 'Upper 1', heightFromAxle: 2.5, forwardOfAxle: 5.0 },
      { id: 'u2', label: 'Upper 2', heightFromAxle: 3.0, forwardOfAxle: 5.0 },
      { id: 'u3', label: 'Upper 3', heightFromAxle: 3.5, forwardOfAxle: 5.0 }
    ],
    lowerMountHoles: [
      { id: 'l1', label: 'Lower 1', heightFromAxle: -0.75, forwardOfAxle: 2.0 },
      { id: 'l2', label: 'Lower 2', heightFromAxle: -0.25, forwardOfAxle: 2.0 }
    ],
    spread: 3.5,
    weight: 2.8,
    notes: 'Designed for GM 12-Bolt housing. Uses existing mounting provisions.'
  }
];

// Helper functions
export const getBracketsBySeries = (series: StrangeBracket['series']): StrangeBracket[] => {
  return strangeBrackets.filter(bracket => bracket.series === series);
};

export const getBracketsByType = (type: StrangeBracket['type']): StrangeBracket[] => {
  return strangeBrackets.filter(bracket => bracket.type === type);
};

export const getBracketById = (id: string): StrangeBracket | undefined => {
  return strangeBrackets.find(bracket => bracket.id === id);
};

export const getBracketsByApplication = (application: string): StrangeBracket[] => {
  return strangeBrackets.filter(bracket => 
    bracket.application.some(app => 
      app.toLowerCase().includes(application.toLowerCase())
    )
  );
};

export const getBracketsByHousingType = (housing: string): StrangeBracket[] => {
  return strangeBrackets.filter(bracket =>
    bracket.housingCompatibility.some(h =>
      h.toLowerCase().includes(housing.toLowerCase())
    )
  );
};

export const getAllSeries = (): StrangeBracket['series'][] => {
  return ['S-Series', 'Pro Stock', 'Ultra', 'Sportsman', 'Economy'];
};

// Calculate actual mount heights from axle centerline given rear end center height
export const calculateMountHeight = (
  holeHeightFromAxle: number,
  rearEndCenterHeight: number
): number => {
  return rearEndCenterHeight + holeHeightFromAxle;
};
