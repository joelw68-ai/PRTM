// US States + DC — shared across all components
// Each entry: { abbr, name }
export const US_STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'DC', name: 'District of Columbia' },
] as const;

// Flat array of abbreviations (for quick lookups)
export const US_STATE_ABBRS = US_STATES.map(s => s.abbr);

// Set of abbreviations for type-safe O(1) membership checks.
// Unlike US_STATE_ABBRS.includes(), Set<string>.has() accepts a plain `string`
// without requiring a cast to the narrow literal-union element type.
const US_STATE_ABBR_SET: Set<string> = new Set(US_STATE_ABBRS);


// Lookup: abbreviation → full name
export const STATE_NAME_MAP: Record<string, string> = Object.fromEntries(
  US_STATES.map(s => [s.abbr, s.name])
);

// Lookup: full name → abbreviation (case-insensitive)
export const STATE_ABBR_MAP: Record<string, string> = Object.fromEntries(
  US_STATES.map(s => [s.name.toLowerCase(), s.abbr])
);

/**
 * Parse a combined "City, State" or "City, ST" string into { city, state }.
 * Handles gracefully: returns whatever it can extract.
 * Examples:
 *   "Gainesville, FL"  → { city: "Gainesville", state: "FL" }
 *   "Gainesville, Florida" → { city: "Gainesville", state: "FL" }
 *   "Gainesville"       → { city: "Gainesville", state: "" }
 *   ""                  → { city: "", state: "" }
 */
export function parseCityState(combined: string): { city: string; state: string } {
  if (!combined || !combined.trim()) return { city: '', state: '' };

  const parts = combined.split(',').map(p => p.trim());
  if (parts.length < 2) return { city: parts[0], state: '' };

  const city = parts[0];
  let stateStr = parts[1];

  // Check if it's already a valid abbreviation (Set<string>.has() is type-safe with plain strings)
  const upper = stateStr.toUpperCase();
  if (US_STATE_ABBR_SET.has(upper)) {
    return { city, state: upper };
  }


  // Check if it's a full state name
  const abbrFromName = STATE_ABBR_MAP[stateStr.toLowerCase()];
  if (abbrFromName) {
    return { city, state: abbrFromName };
  }

  // If it's a 2-letter string, assume it's an abbreviation even if not in list
  if (stateStr.length === 2) {
    return { city, state: upper };
  }

  // Fallback: put everything after comma as state
  return { city, state: stateStr };
}

/**
 * Reusable StateSelect dropdown component props helper.
 * Returns the option elements for a state dropdown.
 */
export function getStateSelectOptions(): { value: string; label: string }[] {
  return [
    { value: '', label: 'Select State...' },
    ...US_STATES.map(s => ({ value: s.abbr, label: `${s.abbr} - ${s.name}` }))
  ];
}
