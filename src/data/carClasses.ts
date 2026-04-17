/**
 * Shared constants for team/car profile dropdowns.
 *
 * These arrays are the single source of truth for dropdown option lists
 * that are used in multiple places (e.g. TeamProfile.tsx and AdminSettings.tsx).
 *
 * Update these lists here only — all consumers will pick up changes
 * automatically.
 */

// ============================================================
// Car Classes
// ============================================================
// Used in:
//   - TeamProfile → Car Information → Car Class dropdown
//   - AdminSettings → Team Profile → Car Class dropdown
export const carClasses = [
  'Pro Mod',
  'Pro Nitrous',
  'Pro Boost',
  'Outlaw Pro Mod',
  'X275',
  'Radial vs World',
  'No Prep',
  'Top Sportsman',
  'Top Dragster',
  'Super Street',
  'Limited Drag Radial',
  'Outlaw 10.5',
  'Pro Street 10.5',
  'Small Tire 28 x 10.5',
  'Ultra Street',
  'Outlaw 632',
  'Nitro Funny Car',
  'Top Alcohol Funny Car',
  'Top Fuel Dragster',
  'Top Alcohol Dragster',
  'Factory Stock',
  'Other',
] as const;

export type CarClass = (typeof carClasses)[number];

// ============================================================
// Engine Types
// ============================================================
// Used in:
//   - TeamProfile → Engine & Fuel → Engine Type dropdown
export const engineTypes = [
  'Supercharged Hemi',
  'Twin Turbo',
  'ProCharger',
  'Nitrous',
  'Roots Blown',
  'Screw Blown',
  'Other',
] as const;

export type EngineType = (typeof engineTypes)[number];

// ============================================================
// Fuel Types
// ============================================================
// Used in:
//   - TeamProfile → Engine & Fuel → Fuel Type dropdown
export const fuelTypes = [
  'Methanol',
  'E85',
  'Race Gas',
  'VP Racing Fuel',
  'Other',
] as const;

export type FuelType = (typeof fuelTypes)[number];

// ============================================================
// Team Member Roles
// ============================================================
// Used in:
//   - TeamProfile → Add/Edit Member modal → Role dropdown
//   - AdminSettings → Add/Edit Member modal → Role dropdown
//   - AdminSettings → Role Management → Change Role dropdown
export const memberRoles = [
  'Owner',
  'Driver',
  'Crew Chief',
  'Crew',
  'Mechanic',
  'Tuner',
  'Sponsor',
] as const;

export type MemberRole = (typeof memberRoles)[number];

// ============================================================
// Team Member Specialties
// ============================================================
// Used in:
//   - TeamProfile → Add/Edit Member modal → Specialties picker
//   - AdminSettings → Add/Edit Member modal → Specialties picker
export const specialtyOptions = [
  'Engine',
  'Transmission',
  'Chassis',
  'Electronics',
  'Fuel System',
  'Suspension',
  'Body/Paint',
  'Data Analysis',
] as const;

export type Specialty = (typeof specialtyOptions)[number];
