import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useCar } from '@/contexts/CarContext';

// Default team colors assigned by car index
const DEFAULT_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
];

const ALL_CARS_COLOR = '#f97316'; // orange — the app's original accent

const STORAGE_KEY = 'raceLogbook_teamColors';

// Convert hex to RGB components
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Generate a lighter shade
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const newR = Math.min(255, Math.round(r + (255 - r) * amount));
  const newG = Math.min(255, Math.round(g + (255 - g) * amount));
  const newB = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${newR}, ${newG}, ${newB})`;
}

// Generate a darker shade
function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const newR = Math.max(0, Math.round(r * (1 - amount)));
  const newG = Math.max(0, Math.round(g * (1 - amount)));
  const newB = Math.max(0, Math.round(b * (1 - amount)));
  return `rgb(${newR}, ${newG}, ${newB})`;
}

export interface ThemeColors {
  /** The base accent color hex */
  base: string;
  /** RGB string for use in rgba() — e.g., "239, 68, 68" */
  rgb: string;
  /** Lighter variant for text on dark backgrounds */
  light: string;
  /** Even lighter for subtle text */
  lighter: string;
  /** Darker variant for hover states */
  dark: string;
  /** HSL values */
  hsl: { h: number; s: number; l: number };
}

interface ThemeColorContextType {
  /** Current accent colors based on selected car */
  colors: ThemeColors;
  /** Get the team color for a specific car ID */
  getTeamColor: (carId: string) => string;
  /** Set the team color for a specific car ID */
  setTeamColor: (carId: string, color: string) => void;
  /** All stored team colors map */
  teamColors: Record<string, string>;
  /** Get default color for a car by its index */
  getDefaultColor: (index: number) => string;
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

function computeThemeColors(hex: string): ThemeColors {
  const { r, g, b } = hexToRgb(hex);
  const hsl = hexToHsl(hex);
  return {
    base: hex,
    rgb: `${r}, ${g}, ${b}`,
    light: lighten(hex, 0.3),
    lighter: lighten(hex, 0.55),
    dark: darken(hex, 0.2),
    hsl,
  };
}

export const ThemeColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectedCarId, cars } = useCar();

  // Load stored team colors from localStorage
  const [teamColors, setTeamColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(teamColors));
    } catch {}
  }, [teamColors]);

  const getDefaultColor = useCallback((index: number): string => {
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  }, []);

  const getTeamColor = useCallback((carId: string): string => {
    if (teamColors[carId]) return teamColors[carId];
    // Find the car's index to assign a default
    const idx = cars.findIndex(c => c.id === carId);
    return idx >= 0 ? getDefaultColor(idx) : ALL_CARS_COLOR;
  }, [teamColors, cars, getDefaultColor]);

  const setTeamColor = useCallback((carId: string, color: string) => {
    setTeamColors(prev => ({ ...prev, [carId]: color }));
  }, []);

  // Compute current accent color
  const currentHex = selectedCarId ? getTeamColor(selectedCarId) : ALL_CARS_COLOR;
  const colors = computeThemeColors(currentHex);

  // Apply CSS custom properties to document root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tc', colors.base);
    root.style.setProperty('--tc-rgb', colors.rgb);
    root.style.setProperty('--tc-light', colors.light);
    root.style.setProperty('--tc-lighter', colors.lighter);
    root.style.setProperty('--tc-dark', colors.dark);
    root.style.setProperty('--tc-h', String(colors.hsl.h));
    root.style.setProperty('--tc-s', `${colors.hsl.s}%`);
    root.style.setProperty('--tc-l', `${colors.hsl.l}%`);
  }, [colors]);

  return (
    <ThemeColorContext.Provider value={{
      colors,
      getTeamColor,
      setTeamColor,
      teamColors,
      getDefaultColor,
    }}>
      {children}
    </ThemeColorContext.Provider>
  );
};

export const useThemeColor = () => {
  const context = useContext(ThemeColorContext);
  if (!context) {
    throw new Error('useThemeColor must be used within ThemeColorProvider');
  }
  return context;
};

// Helper hook that returns inline style objects for common patterns
export function useAccentStyles() {
  const { colors } = useThemeColor();
  
  return {
    /** Background with low opacity — for active menu items, badges */
    activeBg: {
      backgroundColor: `rgba(${colors.rgb}, 0.15)`,
    } as React.CSSProperties,
    /** Border with medium opacity */
    activeBorder: {
      borderColor: `rgba(${colors.rgb}, 0.4)`,
    } as React.CSSProperties,
    /** Active menu item: bg + border + text */
    activeMenuItem: {
      backgroundColor: `rgba(${colors.rgb}, 0.15)`,
      borderColor: `rgba(${colors.rgb}, 0.4)`,
      color: colors.light,
    } as React.CSSProperties,
    /** Active submenu item */
    activeSubItem: {
      backgroundColor: `rgba(${colors.rgb}, 0.12)`,
      borderColor: `rgba(${colors.rgb}, 0.3)`,
      color: colors.light,
    } as React.CSSProperties,
    /** Icon color for active items */
    activeIcon: {
      color: colors.base,
    } as React.CSSProperties,
    /** Text in accent color */
    accentText: {
      color: colors.light,
    } as React.CSSProperties,
    /** Gradient button */
    gradientBtn: {
      background: `linear-gradient(to right, ${colors.base}, ${colors.dark})`,
    } as React.CSSProperties,
    /** Subtle badge background */
    badge: {
      backgroundColor: `rgba(${colors.rgb}, 0.15)`,
      color: colors.light,
    } as React.CSSProperties,
    /** Color indicator dot */
    dot: {
      backgroundColor: colors.base,
    } as React.CSSProperties,
    /** Ring/focus color */
    ring: {
      boxShadow: `0 0 0 2px rgba(${colors.rgb}, 0.3)`,
    } as React.CSSProperties,
    /** Sidebar logo gradient */
    logoGradient: {
      background: `linear-gradient(to bottom right, ${colors.base}, ${colors.dark})`,
    } as React.CSSProperties,
    /** Selected car indicator */
    carIndicator: {
      backgroundColor: `rgba(${colors.rgb}, 0.2)`,
      borderColor: `rgba(${colors.rgb}, 0.5)`,
      color: colors.light,
    } as React.CSSProperties,
    /** For user avatar gradient */
    avatarGradient: {
      background: `linear-gradient(to bottom right, ${colors.base}, ${colors.dark})`,
    } as React.CSSProperties,
    /** Version text */
    versionText: {
      color: colors.base,
    } as React.CSSProperties,
  };
}
