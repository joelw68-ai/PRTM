import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  Info,
  Circle,
  Ruler,
  Target,
  Zap,
  Calculator,
  Save,
  FolderOpen,
  Trash2,
  Star,
  Plus,
  Search,
  Lock,
  Unlock,
  RotateCcw,
  MousePointer2,
  AlertCircle,
  ArrowDown,
  Crosshair,
  Gauge,
  AlertTriangle,
  CircleDot,
  ChevronDown,
  ChevronUp,
  Settings2,
  ArrowLeftRight,
  ArrowUpDown,
  Minus
} from 'lucide-react';

import { 
  quartermaxBrackets, 
  getAllQuartermaxSeries, 
  getHousingBrackets,
  getChassisBrackets,
  getEffectiveHoles,
  getEffectiveHoleHeight,
  QuartermaxBracket, 
  QuartermaxHole,
  PRO_MOD_SPEC,
  PRO_MOD_TOLERANCES,
  validateProModSetup,
  getBottomHole
} from '@/data/quartermaxBrackets';


interface QuartermaxBracketSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  rearEndCenterHeight: number;
  wheelbaseInches: number;
  onApplyBracket: (settings: {
    upperBarChassisMountHeight: number;
    upperBarChassisMountForward: number;
    lowerBarChassisMountHeight: number;
    lowerBarChassisMountForward: number;
    upperBarRearEndMountHeight: number;
    upperBarRearEndMountForward: number;
    lowerBarRearEndMountHeight: number;
    lowerBarRearEndMountForward: number;
    upperBarLength: number;
    lowerBarLength: number;
    instantCenterX: number;
    instantCenterY: number;
    antiSquatPercent: number;
  }) => void;
}

interface GeometryCalculation {
  upperBarLength: number;
  lowerBarLength: number;
  calculatedUpperBarLength: number;
  calculatedLowerBarLength: number;
  instantCenterX: number;
  instantCenterY: number;
  antiSquatPercent: number;
  upperBarAngle: number;
  lowerBarAngle: number;
  rearSpread: number;
  chassisSpread: number;
}

// Extracted union type for selection mode (eliminates `as any` cast in button onClick handlers)
type SelectionMode = 'reference' | 'chassisUpper' | 'chassisLower' | 'housingUpper' | 'housingLower';

type PresetCategory = 'Sticky Track' | 'Moderate' | 'Slick Track' | 'Custom';


interface BracketPreset {
  id: string;
  name: string;
  category: PresetCategory;
  notes: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  series: QuartermaxBracket['series'];
  notchSpread: '13"' | '15"';
  chassisUpperHoleId: string;
  chassisLowerHoleId: string;
  housingBracketId: string;
  housingUpperHoleId: string;
  housingLowerHoleId: string;
  upperBarLengthOverride?: number | null;
  lowerBarLengthOverride?: number | null;
  useManualUpperBar?: boolean;
  useManualLowerBar?: boolean;
  geometry?: GeometryCalculation;
  referenceHoleId?: string;
  referenceHeightFromGround?: number;
}

const PRESET_STORAGE_KEY = 'quartermax-bracket-presets';

const PRESET_CATEGORIES: { value: PresetCategory; label: string; color: string; description: string }[] = [
  { value: 'Sticky Track', label: 'Sticky Track', color: 'green', description: 'High grip, good prep' },
  { value: 'Moderate', label: 'Moderate', color: 'yellow', description: 'Average track conditions' },
  { value: 'Slick Track', label: 'Slick Track', color: 'red', description: 'Low grip, poor prep' },
  { value: 'Custom', label: 'Custom', color: 'purple', description: 'User-defined setup' }
];

// Common drag racing rear tire sizes (diameter in inches)
const COMMON_TIRE_SIZES: { label: string; diameter: number; description: string }[] = [
  { label: '29.5 x 10.5-15W', diameter: 29.5, description: 'Small tire / X275' },
  { label: '31.0 x 14.0-15', diameter: 31.0, description: 'Mid-size slick' },
  { label: '32.0 x 14.0-15', diameter: 32.0, description: 'Mid-size slick' },
  { label: '33.0 x 10.5-15', diameter: 33.0, description: 'Sportsman / Bracket' },
  { label: '33.0 x 16.0-15', diameter: 33.0, description: 'Radial tire' },
  { label: '33.0 x 22.5-15', diameter: 33.0, description: 'Pro Mod radial' },
  { label: '34.5 x 17.0-16', diameter: 34.5, description: 'Pro Mod slick' },
  { label: '36.0 x 17.5-16', diameter: 36.0, description: 'Top Fuel / Funny Car' },
  { label: 'Custom', diameter: 0, description: 'Enter custom diameter' },
];

// Typical tire deflection ranges under load (inches)
const TIRE_DEFLECTION_MIN = 0.5;
const TIRE_DEFLECTION_MAX = 2.5;
const TIRE_DEFLECTION_TYPICAL = 1.25;


const QuartermaxBracketSelector: React.FC<QuartermaxBracketSelectorProps> = ({
  isOpen,
  onClose,
  rearEndCenterHeight: initialRearEndCenterHeight,
  wheelbaseInches = 110,
  onApplyBracket
}) => {
  // Reference height calibration state
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [referenceHole, setReferenceHole] = useState<QuartermaxHole | null>(null);
  const [referenceHeightFromGround, setReferenceHeightFromGround] = useState<string>('');
  const [calculatedAxleCenterHeight, setCalculatedAxleCenterHeight] = useState<number>(initialRearEndCenterHeight);
  
  const [selectedSeries, setSelectedSeries] = useState<QuartermaxBracket['series']>('Extreme 1/8" Billet');
  const [notchSpread, setNotchSpread] = useState<'13"' | '15"'>('13"');
  
  // Chassis bracket selections
  const [selectedChassisBracketUpper, setSelectedChassisBracketUpper] = useState<QuartermaxBracket | null>(null);
  const [selectedChassisBracketLower, setSelectedChassisBracketLower] = useState<QuartermaxBracket | null>(null);
  const [selectedChassisUpperHole, setSelectedChassisUpperHole] = useState<QuartermaxHole | null>(null);
  const [selectedChassisLowerHole, setSelectedChassisLowerHole] = useState<QuartermaxHole | null>(null);
  
  // Housing bracket selections
  const [selectedHousingBracket, setSelectedHousingBracket] = useState<QuartermaxBracket | null>(null);
  const [selectedHousingUpperHole, setSelectedHousingUpperHole] = useState<QuartermaxHole | null>(null);
  const [selectedHousingLowerHole, setSelectedHousingLowerHole] = useState<QuartermaxHole | null>(null);
  
  // Bar length adjustments
  const [upperBarLengthOverride, setUpperBarLengthOverride] = useState<number | null>(null);
  const [lowerBarLengthOverride, setLowerBarLengthOverride] = useState<number | null>(null);
  const [upperBarInputValue, setUpperBarInputValue] = useState<string>('');
  const [lowerBarInputValue, setLowerBarInputValue] = useState<string>('');
  const [useManualUpperBar, setUseManualUpperBar] = useState(false);
  const [useManualLowerBar, setUseManualLowerBar] = useState(false);

  // Visualization state
  const [hoveredHole, setHoveredHole] = useState<{ type: string; hole: QuartermaxHole; bracket?: QuartermaxBracket } | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('reference');
  const [showPresets, setShowPresets] = useState(false);

  // Preset state
  const [presets, setPresets] = useState<BracketPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<PresetCategory>('Moderate');
  const [newPresetNotes, setNewPresetNotes] = useState('');
  const [presetFilterCategory, setPresetFilterCategory] = useState<PresetCategory | 'All'>('All');
  const [presetSearchQuery, setPresetSearchQuery] = useState('');
  const [editingPreset, setEditingPreset] = useState<BracketPreset | null>(null);

  // Rear tire state - default to Pro Mod 34.5" slick
  const [tireDiameterInput, setTireDiameterInput] = useState<string>(PRO_MOD_SPEC.typicalTireDiameter.toString());
  const [selectedTirePreset, setSelectedTirePreset] = useState<string>('34.5 x 17.0-16');
  const [tireDeflection, setTireDeflection] = useState<string>(PRO_MOD_SPEC.typicalLoadedDeflection.toString());
  const [showTireDetails, setShowTireDetails] = useState(false);

  // Pro Mod chassis bracket forward distance (configurable 20-22")
  const [chassisForwardDistance, setChassisForwardDistance] = useState<number>(PRO_MOD_SPEC.chassisForwardOfAxleDefault);
  const [showProModGuide, setShowProModGuide] = useState(true);

  // Pro Mod validation
  const proModValidation = useMemo(() => {
    const bottomHole = selectedChassisBracketLower ? getBottomHole(selectedChassisBracketLower) : null;
    return validateProModSetup(
      isCalibrated ? calculatedAxleCenterHeight : null,
      bottomHole,
      chassisForwardDistance
    );
  }, [selectedChassisBracketLower, isCalibrated, calculatedAxleCenterHeight, chassisForwardDistance]);



  // Load presets from localStorage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem(PRESET_STORAGE_KEY);
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    }
  }, []);

  // Save presets to localStorage when they change
  useEffect(() => {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  const seriesList = getAllQuartermaxSeries();
  
  // Get chassis brackets filtered by series and notch spread
  const chassisBracketsInSeries = useMemo(() => {
    return getChassisBrackets().filter(b => 
      b.series === selectedSeries && 
      b.notchSpread === notchSpread
    );
  }, [selectedSeries, notchSpread]);

  // Get housing brackets filtered by series
  const housingBracketsInSeries = useMemo(() => {
    return getHousingBrackets().filter(b => b.series === selectedSeries);
  }, [selectedSeries]);

  // Auto-select matching brackets when notch spread changes
  useEffect(() => {
    const upperBracket = chassisBracketsInSeries.find(b => b.name.toLowerCase().includes('upper'));
    const lowerBracket = chassisBracketsInSeries.find(b => b.name.toLowerCase().includes('lower'));
    const housingBracket = housingBracketsInSeries[0];
    
    if (upperBracket) setSelectedChassisBracketUpper(upperBracket);
    if (lowerBracket) setSelectedChassisBracketLower(lowerBracket);
    if (housingBracket) setSelectedHousingBracket(housingBracket);
    
    setSelectedChassisUpperHole(null);
    setSelectedChassisLowerHole(null);
    setSelectedHousingUpperHole(null);
    setSelectedHousingLowerHole(null);
    setReferenceHole(null);
    setIsCalibrated(false);
  }, [notchSpread, selectedSeries, chassisBracketsInSeries, housingBracketsInSeries]);

  // Calculate axle center height when reference is set
  useEffect(() => {
    if (referenceHole && referenceHeightFromGround) {
      const measuredHeight = parseFloat(referenceHeightFromGround);
      if (!isNaN(measuredHeight) && measuredHeight > 0) {
        // Axle center height = measured height - hole's height from axle
        const axleHeight = measuredHeight - referenceHole.heightFromAxle;
        setCalculatedAxleCenterHeight(axleHeight);
        setIsCalibrated(true);
      }
    }
  }, [referenceHole, referenceHeightFromGround]);

  const rearEndCenterHeight = isCalibrated ? calculatedAxleCenterHeight : initialRearEndCenterHeight;

  // Tire validation calculations
  const tireValidation = useMemo(() => {
    const diameter = parseFloat(tireDiameterInput);
    const deflection = parseFloat(tireDeflection);
    
    if (isNaN(diameter) || diameter <= 0) {
      return null;
    }

    const staticRadius = diameter / 2;
    const loadedRadius = staticRadius - (isNaN(deflection) ? TIRE_DEFLECTION_TYPICAL : deflection);
    const expectedAxleHeight = loadedRadius;
    
    // Only validate if calibrated
    if (!isCalibrated) {
      return {
        diameter,
        staticRadius,
        loadedRadius,
        expectedAxleHeight,
        difference: 0,
        status: 'pending' as const,
        message: 'Enter tire size, then calibrate to validate',
        groundClearanceAxle: 0,
      };
    }

    const difference = calculatedAxleCenterHeight - expectedAxleHeight;
    const absDiff = Math.abs(difference);
    
    let status: 'good' | 'warning' | 'error' | 'pending';
    let message: string;

    if (absDiff <= 0.75) {
      status = 'good';
      message = `Axle height matches tire size well (${absDiff.toFixed(2)}" difference)`;
    } else if (absDiff <= 1.75) {
      status = 'warning';
      if (difference > 0) {
        message = `Axle CL is ${absDiff.toFixed(2)}" higher than expected. Check: tire pressure may be high, or tire may be taller than spec.`;
      } else {
        message = `Axle CL is ${absDiff.toFixed(2)}" lower than expected. Check: car may be heavier than expected, or tire may be worn/underinflated.`;
      }
    } else {
      status = 'error';
      if (difference > 0) {
        message = `Axle CL is ${absDiff.toFixed(2)}" higher than expected for a ${diameter}" tire. Likely measurement error - re-check your reference height measurement.`;
      } else {
        message = `Axle CL is ${absDiff.toFixed(2)}" lower than expected for a ${diameter}" tire. This is physically unlikely - re-check your reference height measurement.`;
      }
    }

    return {
      diameter,
      staticRadius,
      loadedRadius,
      expectedAxleHeight,
      difference,
      status,
      message,
      groundClearanceAxle: calculatedAxleCenterHeight,
    };
  }, [tireDiameterInput, tireDeflection, isCalibrated, calculatedAxleCenterHeight]);

  // Handle tire preset selection
  const handleTirePresetChange = (presetLabel: string) => {
    setSelectedTirePreset(presetLabel);
    const preset = COMMON_TIRE_SIZES.find(t => t.label === presetLabel);
    if (preset && preset.diameter > 0) {
      setTireDiameterInput(preset.diameter.toString());
    } else if (preset?.label === 'Custom') {
      setTireDiameterInput('');
    }
  };


  // Calculate complete 4-link geometry
  const geometry = useMemo((): GeometryCalculation | null => {
    if (!selectedChassisUpperHole || !selectedChassisLowerHole || 
        !selectedHousingUpperHole || !selectedHousingLowerHole || !isCalibrated) {
      return null;
    }

    const chassisUpperHeight = rearEndCenterHeight + selectedChassisUpperHole.heightFromAxle;
    const chassisUpperForward = selectedSeries === 'Extreme 1/8" Billet' ? chassisForwardDistance : selectedChassisUpperHole.forwardOfAxle;
    const chassisLowerHeight = rearEndCenterHeight + selectedChassisLowerHole.heightFromAxle;
    const chassisLowerForward = selectedSeries === 'Extreme 1/8" Billet' ? chassisForwardDistance : selectedChassisLowerHole.forwardOfAxle;

    const housingUpperHeight = rearEndCenterHeight + selectedHousingUpperHole.heightFromAxle;
    const housingUpperForward = selectedHousingUpperHole.forwardOfAxle;
    const housingLowerHeight = rearEndCenterHeight + selectedHousingLowerHole.heightFromAxle;
    const housingLowerForward = selectedHousingLowerHole.forwardOfAxle;


    const upperBarHorizontal = chassisUpperForward - housingUpperForward;
    const upperBarVertical = chassisUpperHeight - housingUpperHeight;
    const calculatedUpperBarLength = Math.sqrt(Math.pow(upperBarHorizontal, 2) + Math.pow(upperBarVertical, 2));

    const lowerBarHorizontal = chassisLowerForward - housingLowerForward;
    const lowerBarVertical = chassisLowerHeight - housingLowerHeight;
    const calculatedLowerBarLength = Math.sqrt(Math.pow(lowerBarHorizontal, 2) + Math.pow(lowerBarVertical, 2));

    const upperBarLength = useManualUpperBar && upperBarLengthOverride !== null 
      ? upperBarLengthOverride 
      : calculatedUpperBarLength;
    const lowerBarLength = useManualLowerBar && lowerBarLengthOverride !== null 
      ? lowerBarLengthOverride 
      : calculatedLowerBarLength;

    const upperBarAngle = Math.atan2(upperBarVertical, upperBarHorizontal) * (180 / Math.PI);
    const lowerBarAngle = Math.atan2(lowerBarVertical, lowerBarHorizontal) * (180 / Math.PI);

    const x1 = housingUpperForward, y1 = housingUpperHeight;
    const x2 = chassisUpperForward, y2 = chassisUpperHeight;
    const x3 = housingLowerForward, y3 = housingLowerHeight;
    const x4 = chassisLowerForward, y4 = chassisLowerHeight;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    let instantCenterX = 0;
    let instantCenterY = 0;

    if (Math.abs(denom) > 0.0001) {
      instantCenterX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
      instantCenterY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
    }

    const cgHeight = rearEndCenterHeight * 1.5;
    const antiSquatPercent = Math.abs(instantCenterY / cgHeight) * Math.abs(instantCenterX / wheelbaseInches) * 100;

    const rearSpread = selectedHousingUpperHole.heightFromAxle - selectedHousingLowerHole.heightFromAxle;
    const chassisSpread = selectedChassisUpperHole.heightFromAxle - selectedChassisLowerHole.heightFromAxle;

    return {
      upperBarLength,
      lowerBarLength,
      calculatedUpperBarLength,
      calculatedLowerBarLength,
      instantCenterX,
      instantCenterY,
      antiSquatPercent,
      upperBarAngle,
      lowerBarAngle,
      rearSpread,
      chassisSpread
    };
  }, [selectedChassisUpperHole, selectedChassisLowerHole, selectedHousingUpperHole, selectedHousingLowerHole, rearEndCenterHeight, wheelbaseInches, useManualUpperBar, useManualLowerBar, upperBarLengthOverride, lowerBarLengthOverride, isCalibrated]);

  // Initialize bar length overrides when geometry is calculated
  useEffect(() => {
    if (geometry && upperBarLengthOverride === null) {
      setUpperBarLengthOverride(geometry.calculatedUpperBarLength);
      setUpperBarInputValue(geometry.calculatedUpperBarLength.toFixed(2));
    }
    if (geometry && lowerBarLengthOverride === null) {
      setLowerBarLengthOverride(geometry.calculatedLowerBarLength);
      setLowerBarInputValue(geometry.calculatedLowerBarLength.toFixed(2));
    }
  }, [geometry?.calculatedUpperBarLength, geometry?.calculatedLowerBarLength]);

  const handleUpperBarInputChange = (value: string) => {
    setUpperBarInputValue(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 50) {
      setUpperBarLengthOverride(parsed);
    }
  };

  const handleLowerBarInputChange = (value: string) => {
    setLowerBarInputValue(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 50) {
      setLowerBarLengthOverride(parsed);
    }
  };

  const resetUpperBarLength = () => {
    if (geometry) {
      setUpperBarLengthOverride(geometry.calculatedUpperBarLength);
      setUpperBarInputValue(geometry.calculatedUpperBarLength.toFixed(2));
    }
  };

  const resetLowerBarLength = () => {
    if (geometry) {
      setLowerBarLengthOverride(geometry.calculatedLowerBarLength);
      setLowerBarInputValue(geometry.calculatedLowerBarLength.toFixed(2));
    }
  };

  // Handle hole click in visualization
  const handleHoleClick = useCallback((type: string, hole: QuartermaxHole) => {
    if (selectionMode === 'reference') {
      setReferenceHole(hole);
      // Don't auto-advance, let user input the height
    } else if (type === 'chassisUpper' && selectionMode === 'chassisUpper') {
      setSelectedChassisUpperHole(hole);
      setSelectionMode('chassisLower');
    } else if (type === 'chassisLower' && selectionMode === 'chassisLower') {
      setSelectedChassisLowerHole(hole);
      setSelectionMode('housingUpper');
    } else if (type === 'housingUpper' && selectionMode === 'housingUpper') {
      setSelectedHousingUpperHole(hole);
      setSelectionMode('housingLower');
    } else if (type === 'housingLower' && selectionMode === 'housingLower') {
      setSelectedHousingLowerHole(hole);
      setSelectionMode('chassisUpper');
    }
  }, [selectionMode]);

  // Filter presets
  const filteredPresets = useMemo(() => {
    return presets.filter(preset => {
      const matchesCategory = presetFilterCategory === 'All' || preset.category === presetFilterCategory;
      const matchesSearch = presetSearchQuery === '' || 
        preset.name.toLowerCase().includes(presetSearchQuery.toLowerCase()) ||
        preset.notes.toLowerCase().includes(presetSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [presets, presetFilterCategory, presetSearchQuery]);

  const handleSavePreset = () => {
    if (!newPresetName.trim() || !selectedChassisUpperHole || !selectedChassisLowerHole || 
        !selectedHousingBracket || !selectedHousingUpperHole || !selectedHousingLowerHole) {
      return;
    }

    const now = new Date().toISOString();
    const newPreset: BracketPreset = {
      id: editingPreset?.id || `preset-${Date.now()}`,
      name: newPresetName.trim(),
      category: newPresetCategory,
      notes: newPresetNotes.trim(),
      createdAt: editingPreset?.createdAt || now,
      updatedAt: now,
      isFavorite: editingPreset?.isFavorite || false,
      series: selectedSeries,
      notchSpread: notchSpread,
      chassisUpperHoleId: selectedChassisUpperHole.id,
      chassisLowerHoleId: selectedChassisLowerHole.id,
      housingBracketId: selectedHousingBracket.id,
      housingUpperHoleId: selectedHousingUpperHole.id,
      housingLowerHoleId: selectedHousingLowerHole.id,
      upperBarLengthOverride: useManualUpperBar ? upperBarLengthOverride : null,
      lowerBarLengthOverride: useManualLowerBar ? lowerBarLengthOverride : null,
      useManualUpperBar,
      useManualLowerBar,
      geometry: geometry || undefined,
      referenceHoleId: referenceHole?.id,
      referenceHeightFromGround: parseFloat(referenceHeightFromGround) || undefined
    };

    if (editingPreset) {
      setPresets(prev => prev.map(p => p.id === editingPreset.id ? newPreset : p));
    } else {
      setPresets(prev => [...prev, newPreset]);
    }

    setNewPresetName('');
    setNewPresetNotes('');
    setNewPresetCategory('Moderate');
    setShowSaveModal(false);
    setEditingPreset(null);
  };

  const handleLoadPreset = (preset: BracketPreset) => {
    setSelectedSeries(preset.series);
    setNotchSpread(preset.notchSpread);

    setTimeout(() => {
      const chassisBrackets = getChassisBrackets().filter(b => 
        b.series === preset.series && b.notchSpread === preset.notchSpread
      );
      const upperChassis = chassisBrackets.find(b => b.name.toLowerCase().includes('upper'));
      const lowerChassis = chassisBrackets.find(b => b.name.toLowerCase().includes('lower'));
      
      if (upperChassis) {
        setSelectedChassisBracketUpper(upperChassis);
        const hole = upperChassis.holes.find(h => h.id === preset.chassisUpperHoleId);
        if (hole) setSelectedChassisUpperHole(hole);
      }
      
      if (lowerChassis) {
        setSelectedChassisBracketLower(lowerChassis);
        const hole = lowerChassis.holes.find(h => h.id === preset.chassisLowerHoleId);
        if (hole) setSelectedChassisLowerHole(hole);
      }

      const housingBrackets = getHousingBrackets().filter(b => b.series === preset.series);
      const housing = housingBrackets.find(b => b.id === preset.housingBracketId);
      
      if (housing) {
        setSelectedHousingBracket(housing);
        const upperHole = housing.holes.find(h => h.id === preset.housingUpperHoleId);
        const lowerHole = housing.holes.find(h => h.id === preset.housingLowerHoleId);
        if (upperHole) setSelectedHousingUpperHole(upperHole);
        if (lowerHole) setSelectedHousingLowerHole(lowerHole);
        
        // Load reference hole if saved
        if (preset.referenceHoleId) {
          const refHole = housing.holes.find(h => h.id === preset.referenceHoleId);
          if (refHole) {
            setReferenceHole(refHole);
            if (preset.referenceHeightFromGround) {
              setReferenceHeightFromGround(preset.referenceHeightFromGround.toString());
            }
          }
        }
      }

      if (preset.useManualUpperBar && preset.upperBarLengthOverride !== null && preset.upperBarLengthOverride !== undefined) {
        setUseManualUpperBar(true);
        setUpperBarLengthOverride(preset.upperBarLengthOverride);
      } else {
        setUseManualUpperBar(false);
      }

      if (preset.useManualLowerBar && preset.lowerBarLengthOverride !== null && preset.lowerBarLengthOverride !== undefined) {
        setUseManualLowerBar(true);
        setLowerBarLengthOverride(preset.lowerBarLengthOverride);
      } else {
        setUseManualLowerBar(false);
      }
    }, 100);

    setShowPresets(false);
  };

  const handleDeletePreset = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  };

  const handleToggleFavorite = (presetId: string) => {
    setPresets(prev => prev.map(p => 
      p.id === presetId ? { ...p, isFavorite: !p.isFavorite } : p
    ));
  };

  const handleApply = () => {
    if (!selectedChassisUpperHole || !selectedChassisLowerHole || 
        !selectedHousingUpperHole || !selectedHousingLowerHole || !geometry) return;
    const chassisFwd = selectedSeries === 'Extreme 1/8" Billet' ? chassisForwardDistance : selectedChassisUpperHole.forwardOfAxle;
    const chassisFwdLower = selectedSeries === 'Extreme 1/8" Billet' ? chassisForwardDistance : selectedChassisLowerHole.forwardOfAxle;

    onApplyBracket({
      upperBarChassisMountHeight: rearEndCenterHeight + selectedChassisUpperHole.heightFromAxle,
      upperBarChassisMountForward: chassisFwd,
      lowerBarChassisMountHeight: rearEndCenterHeight + selectedChassisLowerHole.heightFromAxle,
      lowerBarChassisMountForward: chassisFwdLower,
      upperBarRearEndMountHeight: rearEndCenterHeight + selectedHousingUpperHole.heightFromAxle,
      upperBarRearEndMountForward: selectedHousingUpperHole.forwardOfAxle,
      lowerBarRearEndMountHeight: rearEndCenterHeight + selectedHousingLowerHole.heightFromAxle,
      lowerBarRearEndMountForward: selectedHousingLowerHole.forwardOfAxle,

      upperBarLength: geometry.upperBarLength,
      lowerBarLength: geometry.lowerBarLength,
      instantCenterX: geometry.instantCenterX,
      instantCenterY: geometry.instantCenterY,
      antiSquatPercent: geometry.antiSquatPercent
    });

    onClose();
  };

  const canApply = selectedChassisUpperHole && selectedChassisLowerHole && 
                   selectedHousingUpperHole && selectedHousingLowerHole && geometry && isCalibrated;

  const canSavePreset = selectedChassisUpperHole && selectedChassisLowerHole && 
                        selectedHousingBracket && selectedHousingUpperHole && selectedHousingLowerHole && isCalibrated;

  const getCategoryColor = (category: PresetCategory) => {
    switch (category) {
      case 'Sticky Track': return { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400' };
      case 'Moderate': return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' };
      case 'Slick Track': return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' };
      case 'Custom': return { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' };
    }
  };

  // Get all holes from all brackets for reference selection
  const allHolesForReference = useMemo(() => {
    const holes: { hole: QuartermaxHole; bracket: QuartermaxBracket; type: string }[] = [];
    
    if (selectedChassisBracketLower) {
      selectedChassisBracketLower.holes.forEach(hole => {
        holes.push({ hole, bracket: selectedChassisBracketLower, type: 'chassisLower' });
      });
    }
    if (selectedHousingBracket) {
      selectedHousingBracket.holes.forEach(hole => {
        holes.push({ hole, bracket: selectedHousingBracket, type: 'housing' });
      });
    }
    
    return holes;
  }, [selectedChassisBracketLower, selectedHousingBracket]);

  // SVG Visualization constants - REAR TIRE LEFT, FRONT TIRE RIGHT
  const svgWidth = 1050;
  const svgHeight = 560;
  const scale = 16;
  const axleCenterX = 240;  // Rear axle on LEFT
  const axleCenterY = 300;
  const groundY = axleCenterY + (rearEndCenterHeight * scale);
  const chassisBracketX = 720; // Chassis brackets on RIGHT (forward of axle)
  const housingBracketX = 360; // Housing brackets near axle
  const rearTireRadius = 90;
  const frontTireX = 930;
  const frontTireRadius = 50;

  if (!isOpen) return null;

  const heightToY = (heightFromAxle: number) => axleCenterY - (heightFromAxle * scale);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl max-w-[1500px] w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Quartermax 4-Link Geometry Setup</h3>
              <p className="text-xs text-slate-400">
                {!isCalibrated 
                  ? 'Step 1: Click a hole and enter its height from ground (with driver, race weight)'
                  : 'Click on bracket holes to select mount points'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                showPresets ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Presets
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Controls Bar */}
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-800/30 border-b border-slate-700/50 flex-wrap">
          <div className="flex items-center gap-3">
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value as QuartermaxBracket['series'])}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {seriesList.map(series => (
                <option key={series} value={series}>{series}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5">
              {(['13"', '15"'] as const).map(spread => (
                <button
                  key={spread}
                  onClick={() => setNotchSpread(spread)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    notchSpread === spread
                      ? 'bg-purple-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {spread}
                </button>
              ))}
            </div>

            {housingBracketsInSeries.length > 1 && (
              <select
                value={selectedHousingBracket?.id || ''}
                onChange={(e) => {
                  const bracket = housingBracketsInSeries.find(b => b.id === e.target.value);
                  if (bracket) {
                    setSelectedHousingBracket(bracket);
                    setSelectedHousingUpperHole(null);
                    setSelectedHousingLowerHole(null);
                  }
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {housingBracketsInSeries.map(bracket => (
                  <option key={bracket.id} value={bracket.id}>{bracket.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm">
            {isCalibrated ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-slate-400">Axle CL Height:</span>
                  <span className="text-green-400 font-bold">{calculatedAxleCenterHeight.toFixed(2)}"</span>
                </div>
                {tireValidation && tireValidation.status !== 'pending' && (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    tireValidation.status === 'good' 
                      ? 'bg-green-500/20 text-green-400' 
                      : tireValidation.status === 'warning'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tireValidation.status === 'good' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : tireValidation.status === 'warning' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    <span>
                      {tireValidation.status === 'good' ? 'Tire OK' : 
                       tireValidation.status === 'warning' ? 'Tire Check' : 'Tire Mismatch'}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsCalibrated(false);
                    setSelectionMode('reference');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Recalibrate
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Calibration required</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Wheelbase:</span>
              <span className="text-blue-400 font-bold">{wheelbaseInches}"</span>
            </div>
            {tireDiameterInput && (
              <div className="flex items-center gap-2">
                <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-500">Tire:</span>
                <span className="text-cyan-400 font-bold">{tireDiameterInput}"</span>
              </div>
            )}
          </div>

        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <div className="w-80 border-r border-slate-700 p-4 overflow-y-auto bg-slate-800/30">
            {/* Rear Tire Size */}
            <div className="mb-4 p-3 rounded-lg border border-slate-600 bg-slate-800/50">
              <button
                onClick={() => setShowTireDetails(!showTireDetails)}
                className="w-full flex items-center justify-between text-sm font-bold text-slate-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-cyan-400" />
                  <span>Rear Tire Size</span>
                  {tireValidation && isCalibrated && (
                    <span className={`w-2 h-2 rounded-full ${
                      tireValidation.status === 'good' ? 'bg-green-400' :
                      tireValidation.status === 'warning' ? 'bg-yellow-400' :
                      tireValidation.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                    }`} />
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showTireDetails ? 'rotate-180' : ''}`} />
              </button>

              {tireDiameterInput && !showTireDetails && (
                <div className="mt-2 text-xs text-slate-400">
                  {selectedTirePreset && selectedTirePreset !== 'Custom' ? selectedTirePreset : `${tireDiameterInput}" diameter`}
                  {tireValidation && isCalibrated && (
                    <span className={`ml-2 ${
                      tireValidation.status === 'good' ? 'text-green-400' :
                      tireValidation.status === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      ({tireValidation.status === 'good' ? 'Valid' : tireValidation.status === 'warning' ? 'Check' : 'Mismatch'})
                    </span>
                  )}
                </div>
              )}

              {showTireDetails && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Common Tire Sizes</label>
                    <select
                      value={selectedTirePreset}
                      onChange={(e) => handleTirePresetChange(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Select tire size...</option>
                      {COMMON_TIRE_SIZES.map(tire => (
                        <option key={tire.label} value={tire.label}>
                          {tire.label} - {tire.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Tire Diameter (inches)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="20"
                        max="40"
                        value={tireDiameterInput}
                        onChange={(e) => {
                          setTireDiameterInput(e.target.value);
                          setSelectedTirePreset('Custom');
                        }}
                        placeholder="e.g., 33.0"
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm font-bold focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-slate-400 text-sm">"</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Loaded Deflection</label>
                      <span className="text-[10px] text-slate-500">({TIRE_DEFLECTION_MIN}" - {TIRE_DEFLECTION_MAX}")</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.125"
                        min={TIRE_DEFLECTION_MIN}
                        max={TIRE_DEFLECTION_MAX}
                        value={tireDeflection}
                        onChange={(e) => setTireDeflection(e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-slate-400 text-sm">"</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      How much the tire compresses under race weight. Typical: {TIRE_DEFLECTION_TYPICAL}"
                    </p>
                  </div>

                  {tireValidation && (
                    <div className="space-y-2 pt-2 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-1.5 bg-slate-800 rounded">
                          <span className="text-slate-500">Static Radius</span>
                          <div className="text-white font-mono">{tireValidation.staticRadius.toFixed(2)}"</div>
                        </div>
                        <div className="p-1.5 bg-slate-800 rounded">
                          <span className="text-slate-500">Loaded Radius</span>
                          <div className="text-cyan-400 font-mono">{tireValidation.loadedRadius.toFixed(2)}"</div>
                        </div>
                        <div className="p-1.5 bg-slate-800 rounded">
                          <span className="text-slate-500">Expected Axle CL</span>
                          <div className="text-blue-400 font-mono">{tireValidation.expectedAxleHeight.toFixed(2)}"</div>
                        </div>
                        {isCalibrated && (
                          <div className="p-1.5 bg-slate-800 rounded">
                            <span className="text-slate-500">Measured Axle CL</span>
                            <div className="text-green-400 font-mono">{calculatedAxleCenterHeight.toFixed(2)}"</div>
                          </div>
                        )}
                      </div>

                      {isCalibrated && tireValidation.status !== 'pending' && (
                        <div className={`p-2.5 rounded-lg border text-xs ${
                          tireValidation.status === 'good' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : tireValidation.status === 'warning'
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                          <div className="flex items-start gap-2">
                            {tireValidation.status === 'good' ? (
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            ) : tireValidation.status === 'warning' ? (
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <div className="font-bold mb-0.5">
                                {tireValidation.status === 'good' ? 'Measurement Validated' :
                                 tireValidation.status === 'warning' ? 'Check Measurement' : 'Measurement Mismatch'}
                              </div>
                              <div className="opacity-80 leading-relaxed">{tireValidation.message}</div>
                              {tireValidation.status !== 'good' && (
                                <div className="mt-1.5 opacity-70">
                                  Difference: {tireValidation.difference > 0 ? '+' : ''}{tireValidation.difference.toFixed(2)}"
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {isCalibrated && tireValidation.status === 'good' && (
                        <div className="p-2 bg-slate-800 rounded text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Est. Tire Deflection</span>
                            <span className="text-cyan-400 font-bold">
                              {(tireValidation.staticRadius - calculatedAxleCenterHeight).toFixed(2)}"
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-slate-400">Ground Clearance (Axle)</span>
                            <span className="text-green-400 font-bold">
                              {calculatedAxleCenterHeight.toFixed(2)}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pro Mod Setup Guide */}
            {selectedSeries === 'Extreme 1/8" Billet' && (
              <div className={`mb-4 p-3 rounded-lg border transition-all ${
                showProModGuide ? 'border-pink-500/40 bg-pink-500/5' : 'border-slate-600 bg-slate-800/50'
              }`}>
                <button
                  onClick={() => setShowProModGuide(!showProModGuide)}
                  className="w-full flex items-center justify-between text-sm font-bold text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-pink-400" />
                    <span>Pro Mod Setup Guide</span>
                    {isCalibrated && (
                      <span className={`w-2 h-2 rounded-full ${
                        proModValidation.isValid ? 'bg-green-400' :
                        proModValidation.bottomHoleStatus === 'warning' || proModValidation.forwardDistanceStatus === 'warning' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showProModGuide ? 'rotate-180' : ''}`} />
                </button>

                {showProModGuide && (
                  <div className="mt-3 space-y-3">
                    {/* Product Info */}
                    <div className="p-2 bg-slate-800 rounded text-xs">
                      <div className="text-pink-400 font-bold mb-1">Quartermax Extreme 1/8" Adjustable Billet</div>
                      <div className="text-slate-400">Four Link Chassis Brackets - Pro Mod</div>
                      <div className="text-slate-500 mt-1">1/8" billet 4130 chromoly</div>
                      <div className="text-slate-500">Holes: 3/8" (0.375") staggered spacing</div>
                      <div className="text-slate-500">Bracket: slides in 1/8" increments</div>
                      <div className="text-cyan-500/70 mt-1 italic">3/8" holes + 1/8" slide = 1/8" resolution</div>
                    </div>


                    {/* Pro Mod Specs */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300">Target Specifications:</div>
                      
                      {/* Bottom Hole Height */}
                      <div className={`p-2 rounded border text-xs ${
                        proModValidation.bottomHoleStatus === 'good' ? 'bg-green-500/10 border-green-500/30' :
                        proModValidation.bottomHoleStatus === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        proModValidation.bottomHoleStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
                        'bg-slate-800 border-slate-700'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400">Bottom Hole from Ground</span>
                          <span className="font-bold text-pink-400">{PRO_MOD_SPEC.chassisBottomHoleFromGround}"</span>
                        </div>
                        {proModValidation.bottomHoleHeight !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Actual:</span>
                            <span className={`font-bold ${
                              proModValidation.bottomHoleStatus === 'good' ? 'text-green-400' :
                              proModValidation.bottomHoleStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {proModValidation.bottomHoleHeight.toFixed(2)}"
                              {proModValidation.bottomHoleDifference !== null && (
                                <span className="ml-1 opacity-70">
                                  ({proModValidation.bottomHoleDifference > 0 ? '+' : ''}{proModValidation.bottomHoleDifference.toFixed(2)}")
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {!isCalibrated && (
                          <div className="text-slate-500 italic mt-1">Calibrate to validate</div>
                        )}
                        {proModValidation.bottomHoleMessage && isCalibrated && (
                          <div className={`mt-1 text-[10px] ${
                            proModValidation.bottomHoleStatus === 'good' ? 'text-green-400' :
                            proModValidation.bottomHoleStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {proModValidation.bottomHoleMessage}
                          </div>
                        )}
                      </div>

                      {/* Forward Distance */}
                      <div className={`p-2 rounded border text-xs ${
                        proModValidation.forwardDistanceStatus === 'good' ? 'bg-green-500/10 border-green-500/30' :
                        proModValidation.forwardDistanceStatus === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-red-500/10 border-red-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-400">Chassis Fwd of Axle CL</span>
                          <span className="font-bold text-pink-400">{PRO_MOD_SPEC.chassisForwardOfAxleMin}-{PRO_MOD_SPEC.chassisForwardOfAxleMax}"</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <input
                            type="number"
                            step="0.5"
                            min="15"
                            max="30"
                            value={chassisForwardDistance}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setChassisForwardDistance(val);
                            }}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm font-bold focus:outline-none focus:border-pink-500"
                          />
                          <span className="text-slate-400">"</span>
                        </div>
                        {proModValidation.forwardDistanceMessage && (
                          <div className={`mt-1.5 text-[10px] ${
                            proModValidation.forwardDistanceStatus === 'good' ? 'text-green-400' :
                            proModValidation.forwardDistanceStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {proModValidation.forwardDistanceMessage}
                          </div>
                        )}
                      </div>

                      {/* Axle CL Validation */}
                      {isCalibrated && (
                        <div className={`p-2 rounded border text-xs ${
                          proModValidation.axleCLStatus === 'good' ? 'bg-green-500/10 border-green-500/30' :
                          proModValidation.axleCLStatus === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                          proModValidation.axleCLStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
                          'bg-slate-800 border-slate-700'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Axle CL Height</span>
                            <span className={`font-bold ${
                              proModValidation.axleCLStatus === 'good' ? 'text-green-400' :
                              proModValidation.axleCLStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {calculatedAxleCenterHeight.toFixed(2)}"
                            </span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Expected: {PRO_MOD_TOLERANCES.axleCLHeightMin}-{PRO_MOD_TOLERANCES.axleCLHeightMax}"
                          </div>
                          {proModValidation.axleCLMessage && (
                            <div className={`mt-1 text-[10px] ${
                              proModValidation.axleCLStatus === 'good' ? 'text-green-400' :
                              proModValidation.axleCLStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {proModValidation.axleCLMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Overall Status */}
                    {isCalibrated && (
                      <div className={`p-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                        proModValidation.isValid
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                        {proModValidation.isValid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Pro Mod Setup Validated</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            <span>Setup Needs Attention</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reference Height Calibration */}

            <div className={`mb-4 p-3 rounded-lg border-2 transition-all ${
              !isCalibrated 
                ? 'bg-amber-500/10 border-amber-500/50' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                {!isCalibrated ? (
                  <>
                    <Crosshair className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">Step 1: Reference Height</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Calibrated</span>
                  </>
                )}
              </h4>
              
              <p className="text-xs text-slate-400 mb-3">
                {!isCalibrated 
                  ? 'With driver seated and car at race weight, measure from level ground to any bracket hole center.'
                  : `Reference: ${referenceHole?.label}`
                }
              </p>

              {!isCalibrated && (
                <button
                  onClick={() => setSelectionMode('reference')}
                  className={`w-full mb-2 px-3 py-2 rounded text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    selectionMode === 'reference'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <MousePointer2 className="w-4 h-4" />
                  {referenceHole ? `Selected: ${referenceHole.label}` : 'Click a Hole to Select'}
                </button>
              )}

              {referenceHole && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Hole from axle CL:</span>
                    <span className="text-cyan-400 font-mono">
                      {referenceHole.heightFromAxle > 0 ? '+' : ''}{referenceHole.heightFromAxle.toFixed(3)}"
                    </span>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      Measured height from ground:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.0625"
                        min="0"
                        max="20"
                        value={referenceHeightFromGround}
                        onChange={(e) => setReferenceHeightFromGround(e.target.value)}
                        placeholder="e.g., 8.5"
                        className="flex-1 bg-slate-700 border border-amber-500/50 rounded px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-slate-400">"</span>
                    </div>
                  </div>

                  {isCalibrated && (
                    <div className="mt-2 p-2 bg-slate-800 rounded text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Calculated Axle CL:</span>
                        <span className="text-green-400 font-bold">{calculatedAxleCenterHeight.toFixed(3)}"</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selection Mode - Only show after calibration */}
            {isCalibrated && (
              <>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <MousePointer2 className="w-4 h-4" />
                    Step 2: Select Mount Points
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'chassisUpper' as SelectionMode, label: 'Chassis Upper', color: 'orange', selected: selectedChassisUpperHole },
                      { key: 'chassisLower' as SelectionMode, label: 'Chassis Lower', color: 'yellow', selected: selectedChassisLowerHole },
                      { key: 'housingUpper' as SelectionMode, label: 'Housing Upper', color: 'blue', selected: selectedHousingUpperHole },
                      { key: 'housingLower' as SelectionMode, label: 'Housing Lower', color: 'green', selected: selectedHousingLowerHole },
                    ]).map(item => (
                      <button
                        key={item.key}
                        onClick={() => setSelectionMode(item.key)}
                        className={`p-2 rounded-lg text-xs font-medium transition-all border ${
                          selectionMode === item.key
                            ? 'bg-opacity-20 border-current'
                            : item.selected
                              ? 'bg-slate-700 border-slate-600'
                              : 'bg-slate-800 border-slate-600 hover:border-slate-500'
                        }`}
                        style={{
                          color: selectionMode === item.key || item.selected 
                            ? item.color === 'orange' ? '#f97316' 
                            : item.color === 'yellow' ? '#eab308'
                            : item.color === 'blue' ? '#3b82f6'
                            : '#22c55e'
                            : '#94a3b8'
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {item.selected ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          {item.label}
                        </div>
                        {item.selected && (
                          <div className="text-[10px] mt-1 opacity-75">{item.selected.label}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bar Lengths */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Bar Lengths
                  </h4>

                  {/* Upper Bar */}
                  <div className={`p-3 rounded-lg border transition-all ${
                    useManualUpperBar ? 'bg-blue-500/10 border-blue-500/50' : 'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-400">Upper Bar</span>
                      <button
                        onClick={() => setUseManualUpperBar(!useManualUpperBar)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          useManualUpperBar ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {useManualUpperBar ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {useManualUpperBar ? 'Manual' : 'Auto'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="10"
                        max="50"
                        value={upperBarInputValue}
                        onChange={(e) => handleUpperBarInputChange(e.target.value)}
                        disabled={!useManualUpperBar}
                        className={`flex-1 bg-slate-700 border rounded px-2 py-1.5 text-white text-sm font-bold focus:outline-none ${
                          useManualUpperBar ? 'border-blue-500/50' : 'border-slate-600 opacity-60'
                        }`}
                      />
                      <span className="text-slate-400 text-sm">"</span>
                      {useManualUpperBar && (
                        <button onClick={resetUpperBarLength} className="p-1 rounded bg-slate-700 text-slate-400 hover:text-white">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {geometry && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Calc: {geometry.calculatedUpperBarLength.toFixed(2)}" | Angle: {geometry.upperBarAngle.toFixed(1)}°
                      </div>
                    )}
                  </div>

                  {/* Lower Bar */}
                  <div className={`p-3 rounded-lg border transition-all ${
                    useManualLowerBar ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-green-400">Lower Bar</span>
                      <button
                        onClick={() => setUseManualLowerBar(!useManualLowerBar)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          useManualLowerBar ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {useManualLowerBar ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {useManualLowerBar ? 'Manual' : 'Auto'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="10"
                        max="50"
                        value={lowerBarInputValue}
                        onChange={(e) => handleLowerBarInputChange(e.target.value)}
                        disabled={!useManualLowerBar}
                        className={`flex-1 bg-slate-700 border rounded px-2 py-1.5 text-white text-sm font-bold focus:outline-none ${
                          useManualLowerBar ? 'border-green-500/50' : 'border-slate-600 opacity-60'
                        }`}
                      />
                      <span className="text-slate-400 text-sm">"</span>
                      {useManualLowerBar && (
                        <button onClick={resetLowerBarLength} className="p-1 rounded bg-slate-700 text-slate-400 hover:text-white">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {geometry && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Calc: {geometry.calculatedLowerBarLength.toFixed(2)}" | Angle: {geometry.lowerBarAngle.toFixed(1)}°
                      </div>
                    )}
                  </div>
                </div>

                {/* Geometry Results */}
                {geometry && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      Calculated Geometry
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                        <div className="text-[10px] text-purple-400">Instant Center X</div>
                        <div className="text-sm font-bold text-white">{geometry.instantCenterX.toFixed(1)}"</div>
                      </div>
                      <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                        <div className="text-[10px] text-purple-400">Instant Center Y</div>
                        <div className="text-sm font-bold text-white">{geometry.instantCenterY.toFixed(1)}"</div>
                      </div>
                      <div className="p-2 bg-orange-500/10 rounded border border-orange-500/30">
                        <div className="text-[10px] text-orange-400">Anti-Squat</div>
                        <div className="text-sm font-bold text-white">{geometry.antiSquatPercent.toFixed(1)}%</div>
                      </div>
                      <div className="p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                        <div className="text-[10px] text-cyan-400">Spreads</div>
                        <div className="text-[10px] text-white">C: {geometry.chassisSpread.toFixed(2)}" H: {geometry.rearSpread.toFixed(2)}"</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Center - Interactive Visualization */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="flex-1 bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border border-slate-700 overflow-hidden relative">
              <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                className="w-full h-full"
                style={{ minHeight: '420px' }}
              >
                <defs>
                  <pattern id="gridPattern" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.5" />
                  </pattern>
                  
                  <linearGradient id="steelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4a5568" />
                    <stop offset="30%" stopColor="#718096" />
                    <stop offset="50%" stopColor="#a0aec0" />
                    <stop offset="70%" stopColor="#718096" />
                    <stop offset="100%" stopColor="#4a5568" />
                  </linearGradient>

                  <linearGradient id="billetGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2a2a3e" />
                    <stop offset="20%" stopColor="#3d3d5c" />
                    <stop offset="40%" stopColor="#4d4d6a" />
                    <stop offset="50%" stopColor="#5a5a78" />
                    <stop offset="60%" stopColor="#4d4d6a" />
                    <stop offset="80%" stopColor="#3d3d5c" />
                    <stop offset="100%" stopColor="#2a2a3e" />
                  </linearGradient>

                  <linearGradient id="doublerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1e3a5f" />
                    <stop offset="30%" stopColor="#2d5a8a" />
                    <stop offset="50%" stopColor="#3b7ab5" />
                    <stop offset="70%" stopColor="#2d5a8a" />
                    <stop offset="100%" stopColor="#1e3a5f" />
                  </linearGradient>
                  
                  <linearGradient id="tireGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a1a1a" />
                    <stop offset="30%" stopColor="#252525" />
                    <stop offset="50%" stopColor="#2d2d2d" />
                    <stop offset="70%" stopColor="#252525" />
                    <stop offset="100%" stopColor="#1a1a1a" />
                  </linearGradient>

                  <linearGradient id="tireWallGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#222" />
                    <stop offset="50%" stopColor="#333" />
                    <stop offset="100%" stopColor="#222" />
                  </linearGradient>
                  
                  <linearGradient id="axleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4a5568" />
                    <stop offset="50%" stopColor="#718096" />
                    <stop offset="100%" stopColor="#4a5568" />
                  </linearGradient>

                  <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>

                  <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>

                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4"/>
                  </filter>
                </defs>

                {/* Background Grid */}
                <rect width="100%" height="100%" fill="url(#gridPattern)" />

                {/* Ground/Track Surface */}
                <rect x="0" y={groundY} width={svgWidth} height={svgHeight - groundY} fill="#1a1a1a" />
                <line x1="0" y1={groundY} x2={svgWidth} y2={groundY} stroke="#4a5568" strokeWidth="3" />
                <line x1="0" y1={groundY + 1} x2={svgWidth} y2={groundY + 1} stroke="#333" strokeWidth="1" />
                <text x="30" y={groundY + 20} fill="#64748b" fontSize="11" fontWeight="bold">TRACK SURFACE (LEVEL GROUND)</text>

                {/* Direction Arrow */}
                <g transform={`translate(${svgWidth / 2}, 25)`}>
                  <text x="0" y="0" fill="#475569" fontSize="10" textAnchor="middle" fontWeight="bold">FRONT OF CAR</text>
                  <path d="M 50 -5 L 65 -5 L 65 -10 L 80 0 L 65 10 L 65 5 L 50 5 Z" fill="#475569" opacity="0.6" />
                </g>

                {/* Pro Mod Car Body Outline (simplified) */}
                <path
                  d={`
                    M ${axleCenterX - 60} ${axleCenterY - rearTireRadius - 20}
                    Q ${axleCenterX + 50} ${axleCenterY - rearTireRadius - 60} ${(axleCenterX + frontTireX) / 2} ${axleCenterY - rearTireRadius - 70}
                    Q ${frontTireX - 80} ${axleCenterY - rearTireRadius - 65} ${frontTireX + 30} ${axleCenterY - frontTireRadius - 30}
                    L ${frontTireX + 50} ${axleCenterY - frontTireRadius + 10}
                  `}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="8,6"
                  opacity="0.4"
                />

                {/* ============ REAR TIRE (LEFT SIDE) ============ */}
                <g filter="url(#shadow)">
                  {/* Outer tire */}
                  <circle 
                    cx={axleCenterX} 
                    cy={axleCenterY} 
                    r={rearTireRadius} 
                    fill="url(#tireGradient)" 
                    stroke="#333"
                    strokeWidth="3"
                  />
                  {/* Tread pattern rings */}
                  <circle cx={axleCenterX} cy={axleCenterY} r={rearTireRadius - 4} fill="none" stroke="#2a2a2a" strokeWidth="1" />
                  <circle cx={axleCenterX} cy={axleCenterY} r={rearTireRadius - 10} fill="none" stroke="#303030" strokeWidth="0.5" />
                  {/* Sidewall */}
                  <circle cx={axleCenterX} cy={axleCenterY} r={rearTireRadius - 18} fill="url(#tireWallGradient)" stroke="#3a3a3a" strokeWidth="1.5" />
                  {/* Wheel/Rim */}
                  <circle cx={axleCenterX} cy={axleCenterY} r={38} fill="#2d2d2d" stroke="#4a5568" strokeWidth="2" />
                  <circle cx={axleCenterX} cy={axleCenterY} r={32} fill="#252525" stroke="#3a3a3a" strokeWidth="1" />
                  {/* Hub */}
                  <circle cx={axleCenterX} cy={axleCenterY} r={14} fill="#1a1a1a" stroke="#4a5568" strokeWidth="2" />
                  {/* Lug pattern */}
                  {[0, 72, 144, 216, 288].map((angle, i) => (
                    <circle 
                      key={`lug-${i}`}
                      cx={axleCenterX + Math.cos(angle * Math.PI / 180) * 24}
                      cy={axleCenterY + Math.sin(angle * Math.PI / 180) * 24}
                      r="3.5"
                      fill="#333"
                      stroke="#4a5568"
                      strokeWidth="0.5"
                    />
                  ))}
                  {/* Spoke lines */}
                  {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                    <line
                      key={`spoke-${i}`}
                      x1={axleCenterX + Math.cos(angle * Math.PI / 180) * 16}
                      y1={axleCenterY + Math.sin(angle * Math.PI / 180) * 16}
                      x2={axleCenterX + Math.cos(angle * Math.PI / 180) * 34}
                      y2={axleCenterY + Math.sin(angle * Math.PI / 180) * 34}
                      stroke="#3a3a3a"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                <text x={axleCenterX} y={axleCenterY + rearTireRadius + 22} fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="bold">REAR TIRE</text>

                {/* ============ FRONT TIRE (RIGHT SIDE) ============ */}
                <g opacity="0.6">
                  <circle cx={frontTireX} cy={groundY - frontTireRadius} r={frontTireRadius} fill="url(#tireGradient)" stroke="#333" strokeWidth="2" />
                  <circle cx={frontTireX} cy={groundY - frontTireRadius} r={frontTireRadius - 8} fill="url(#tireWallGradient)" stroke="#3a3a3a" strokeWidth="1" />
                  <circle cx={frontTireX} cy={groundY - frontTireRadius} r={22} fill="#2d2d2d" stroke="#4a5568" strokeWidth="1.5" />
                  <circle cx={frontTireX} cy={groundY - frontTireRadius} r={8} fill="#1a1a1a" stroke="#4a5568" strokeWidth="1" />
                  {[0, 72, 144, 216, 288].map((angle, i) => (
                    <circle 
                      key={`flug-${i}`}
                      cx={frontTireX + Math.cos(angle * Math.PI / 180) * 15}
                      cy={(groundY - frontTireRadius) + Math.sin(angle * Math.PI / 180) * 15}
                      r="2"
                      fill="#333"
                      stroke="#4a5568"
                      strokeWidth="0.5"
                    />
                  ))}
                </g>
                <text x={frontTireX} y={groundY - frontTireRadius * 2 - 8} fill="#475569" fontSize="9" textAnchor="middle">FRONT</text>

                {/* ============ AXLE HOUSING TUBE ============ */}
                <g>
                  {/* Main tube extending right from tire */}
                  <rect 
                    x={axleCenterX + 15} 
                    y={axleCenterY - 10} 
                    width={housingBracketX - axleCenterX + 30} 
                    height="20" 
                    fill="url(#axleGradient)" 
                    stroke="#64748b"
                    strokeWidth="1.5"
                    rx="10"
                  />
                  {/* Diff housing bulge */}
                  <ellipse 
                    cx={axleCenterX + 60} 
                    cy={axleCenterY} 
                    rx="30" 
                    ry="22" 
                    fill="url(#axleGradient)" 
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <text x={axleCenterX + 60} y={axleCenterY + 40} fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">REAR AXLE HOUSING</text>
                </g>

                {/* ============ CHASSIS FRAME RAILS ============ */}
                <g>
                  {/* Upper rail */}
                  <rect 
                    x={housingBracketX - 40} 
                    y={axleCenterY - 170} 
                    width={frontTireX - housingBracketX + 80} 
                    height="18" 
                    fill="url(#steelGradient)" 
                    stroke="#64748b" 
                    strokeWidth="1.5"
                    rx="3"
                  />
                  {/* Lower rail */}
                  <rect 
                    x={housingBracketX - 40} 
                    y={axleCenterY + 15} 
                    width={frontTireX - housingBracketX + 80} 
                    height="14" 
                    fill="url(#steelGradient)" 
                    stroke="#64748b" 
                    strokeWidth="1.5"
                    rx="3"
                  />
                  {/* Crossmember at chassis bracket location */}
                  <rect 
                    x={chassisBracketX - 5} 
                    y={axleCenterY - 170} 
                    width="12" 
                    height={170 + 30} 
                    fill="url(#steelGradient)" 
                    stroke="#64748b" 
                    strokeWidth="1"
                    rx="2"
                  />
                  <text x={chassisBracketX + 30} y={axleCenterY - 175} fill="#94a3b8" fontSize="9" fontWeight="bold">CHASSIS FRAME</text>
                </g>

                {/* Axle Centerline Reference */}
                <line 
                  x1={axleCenterX - rearTireRadius - 10} 
                  y1={axleCenterY} 
                  x2={chassisBracketX + 60} 
                  y2={axleCenterY} 
                  stroke="#ef4444" 
                  strokeWidth="1" 
                  strokeDasharray="8,4" 
                  opacity="0.5"
                />
                <text x={axleCenterX - rearTireRadius - 8} y={axleCenterY - 8} fill="#ef4444" fontSize="8" opacity="0.7">AXLE CL</text>

                {/* Forward distance dimension line */}
                <g opacity="0.5">
                  <line x1={axleCenterX} y1={groundY - 10} x2={chassisBracketX + 20} y2={groundY - 10} stroke="#a855f7" strokeWidth="1" />
                  <line x1={axleCenterX} y1={groundY - 15} x2={axleCenterX} y2={groundY - 5} stroke="#a855f7" strokeWidth="1" />
                  <line x1={chassisBracketX + 20} y1={groundY - 15} x2={chassisBracketX + 20} y2={groundY - 5} stroke="#a855f7" strokeWidth="1" />
                  <text x={(axleCenterX + chassisBracketX + 20) / 2} y={groundY - 14} fill="#a855f7" fontSize="8" textAnchor="middle">
                    {chassisForwardDistance}" fwd of axle CL
                  </text>
                </g>

                {/* ============ QUARTERMAX EXTREME BILLET CHASSIS BRACKETS (RIGHT SIDE) ============ */}
                {/* Upper Chassis Bracket - Realistic Quartermax Extreme 1/8" Adjustable Billet */}
                {selectedChassisBracketUpper && (() => {
                  const holes = selectedChassisBracketUpper.holes;
                  const topHoleY = heightToY(holes[holes.length - 1].heightFromAxle);
                  const botHoleY = heightToY(holes[0].heightFromAxle);
                  const bracketX = chassisBracketX + 15;
                  const bracketW = 30;
                  const padding = 14;
                  const bracketTop = topHoleY - padding;
                  const bracketBot = botHoleY + padding;
                  const bracketH = bracketBot - bracketTop;
                  const slotHeight = 10; // 1/8" adjustment slot visual height
                  const slotWidth = 6;
                  return (
                    <g>
                      {/* Crossmember mounting tab with 1/8" adjustment SLOT */}
                      <rect x={chassisBracketX - 4} y={bracketTop - 14} width={22} height={20} fill="#3d3d5c" stroke="#7c3aed" strokeWidth="1" rx="2" />
                      {/* Vertical slot (shows 1/8" adjustment capability) */}
                      <rect x={chassisBracketX + 5} y={bracketTop - 12} width={slotWidth} height={slotHeight} fill="#0f0f1a" stroke="#5a5a78" strokeWidth="0.8" rx="2" />
                      {/* Slot label */}
                      <text x={chassisBracketX + 24} y={bracketTop - 5} fill="#7c3aed" fontSize="5" opacity="0.7">1/8" ADJ</text>
                      
                      {/* Main billet plate body - tall narrow rectangle with rounded corners */}
                      <rect 
                        x={bracketX - bracketW/2} 
                        y={bracketTop} 
                        width={bracketW} 
                        height={bracketH} 
                        fill="url(#billetGradient)" 
                        stroke="#a855f7" 
                        strokeWidth="2" 
                        rx="4"
                      />
                      {/* Inner machined edge chamfer */}
                      <rect 
                        x={bracketX - bracketW/2 + 2} 
                        y={bracketTop + 2} 
                        width={bracketW - 4} 
                        height={bracketH - 4} 
                        fill="none" 
                        stroke="#5a5a78" 
                        strokeWidth="0.5" 
                        rx="3"
                      />
                      {/* Machined surface lines (billet texture) */}
                      {[0.15, 0.3, 0.45, 0.6, 0.75, 0.85].map((pct, i) => (
                        <line key={`mach-u-${i}`}
                          x1={bracketX - bracketW/2 + 3} y1={bracketTop + bracketH * pct}
                          x2={bracketX + bracketW/2 - 3} y2={bracketTop + bracketH * pct}
                          stroke="#4a4a68" strokeWidth="0.3" opacity="0.3"
                        />
                      ))}
                      
                      {/* Bracket label */}
                      <text x={bracketX} y={bracketTop - 20} fill="#a855f7" fontSize="8" textAnchor="middle" fontWeight="bold">QM UPPER</text>
                      <text x={bracketX} y={bracketTop - 10} fill="#7c3aed" fontSize="6" textAnchor="middle">EXTREME 1/8" BILLET</text>

                      {/* Holes - 3/8" staggered spacing */}
                      {holes.map((hole, idx) => {
                        const holeY = heightToY(hole.heightFromAxle);
                        const isSelected = selectedChassisUpperHole?.id === hole.id;
                        const isReference = referenceHole?.id === hole.id;
                        const isHovered = hoveredHole?.type === 'chassisUpper' && hoveredHole.hole.id === hole.id;
                        const isTarget = selectionMode === 'chassisUpper' || selectionMode === 'reference';
                        return (
                          <g key={hole.id}>
                            {/* Hole bore (dark center with metallic ring) */}
                            <circle cx={bracketX} cy={holeY} r="5.5" fill="#1a1a2e" stroke="#4a4a68" strokeWidth="0.5" />
                            {/* Selectable hole overlay */}
                            <circle
                              cx={bracketX} cy={holeY}
                              r={isSelected || isReference ? 7 : isHovered ? 6.5 : 5}
                              fill={isReference ? '#f59e0b' : isSelected ? '#f97316' : isHovered ? '#fb923c' : 'transparent'}
                              stroke={isReference ? '#fbbf24' : isSelected ? '#fff' : isTarget ? '#f97316' : 'transparent'}
                              strokeWidth={isSelected || isReference ? 2.5 : isTarget ? 1.5 : 0}
                              className={`cursor-pointer ${isTarget ? 'hover:fill-orange-500/50' : ''}`}
                              onClick={() => selectionMode === 'reference' ? setReferenceHole(hole) : handleHoleClick('chassisUpper', hole)}
                              onMouseEnter={() => setHoveredHole({ type: 'chassisUpper', hole })}
                              onMouseLeave={() => setHoveredHole(null)}
                              filter={isSelected || isReference ? 'url(#glow)' : undefined}
                              opacity={isSelected || isReference || isHovered ? 1 : 0.8}
                            />
                            {/* Hole number label */}
                            {(isSelected || isHovered || isReference) && (
                              <text x={bracketX + bracketW/2 + 6} y={holeY + 3} fill={isReference ? '#f59e0b' : '#f97316'} fontSize="7" fontWeight="bold">#{hole.position}</text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* Lower Chassis Bracket - Realistic Quartermax Extreme 1/8" Adjustable Billet */}
                {selectedChassisBracketLower && (() => {
                  const holes = selectedChassisBracketLower.holes;
                  const topHoleY = heightToY(holes[holes.length - 1].heightFromAxle);
                  const botHoleY = heightToY(holes[0].heightFromAxle);
                  const bracketX = chassisBracketX + 50;
                  const bracketW = 30;
                  const padding = 14;
                  const bracketTop = topHoleY - padding;
                  const bracketBot = botHoleY + padding;
                  const bracketH = bracketBot - bracketTop;
                  const slotHeight = 10;
                  const slotWidth = 6;
                  return (
                    <g>
                      {/* Crossmember mounting tab with 1/8" adjustment SLOT */}
                      <rect x={chassisBracketX - 4} y={bracketTop - 14} width={57} height={20} fill="#3d3d5c" stroke="#ca8a04" strokeWidth="1" rx="2" />
                      {/* Vertical slot */}
                      <rect x={bracketX - slotWidth/2} y={bracketTop - 12} width={slotWidth} height={slotHeight} fill="#0f0f1a" stroke="#5a5a78" strokeWidth="0.8" rx="2" />
                      <text x={bracketX + 20} y={bracketTop - 5} fill="#ca8a04" fontSize="5" opacity="0.7">1/8" ADJ</text>
                      
                      {/* Main billet plate body */}
                      <rect 
                        x={bracketX - bracketW/2} 
                        y={bracketTop} 
                        width={bracketW} 
                        height={bracketH} 
                        fill="url(#billetGradient)" 
                        stroke="#eab308" 
                        strokeWidth="2" 
                        rx="4"
                      />
                      {/* Inner machined edge chamfer */}
                      <rect 
                        x={bracketX - bracketW/2 + 2} 
                        y={bracketTop + 2} 
                        width={bracketW - 4} 
                        height={bracketH - 4} 
                        fill="none" 
                        stroke="#5a5a78" 
                        strokeWidth="0.5" 
                        rx="3"
                      />
                      {/* Machined surface lines */}
                      {[0.15, 0.3, 0.45, 0.6, 0.75, 0.85].map((pct, i) => (
                        <line key={`mach-l-${i}`}
                          x1={bracketX - bracketW/2 + 3} y1={bracketTop + bracketH * pct}
                          x2={bracketX + bracketW/2 - 3} y2={bracketTop + bracketH * pct}
                          stroke="#4a4a68" strokeWidth="0.3" opacity="0.3"
                        />
                      ))}
                      
                      {/* Bracket label */}
                      <text x={bracketX} y={bracketTop - 20} fill="#eab308" fontSize="8" textAnchor="middle" fontWeight="bold">QM LOWER</text>
                      <text x={bracketX} y={bracketTop - 10} fill="#ca8a04" fontSize="6" textAnchor="middle">EXTREME 1/8" BILLET</text>

                      {/* Holes - 3/8" staggered spacing */}
                      {holes.map((hole) => {
                        const holeY = heightToY(hole.heightFromAxle);
                        const isSelected = selectedChassisLowerHole?.id === hole.id;
                        const isReference = referenceHole?.id === hole.id;
                        const isHovered = hoveredHole?.type === 'chassisLower' && hoveredHole.hole.id === hole.id;
                        const isTarget = selectionMode === 'chassisLower' || selectionMode === 'reference';
                        return (
                          <g key={hole.id}>
                            <circle cx={bracketX} cy={holeY} r="5.5" fill="#1a1a2e" stroke="#4a4a68" strokeWidth="0.5" />
                            <circle
                              cx={bracketX} cy={holeY}
                              r={isSelected || isReference ? 7 : isHovered ? 6.5 : 5}
                              fill={isReference ? '#f59e0b' : isSelected ? '#eab308' : isHovered ? '#fbbf24' : 'transparent'}
                              stroke={isReference ? '#fbbf24' : isSelected ? '#fff' : isTarget ? '#eab308' : 'transparent'}
                              strokeWidth={isSelected || isReference ? 2.5 : isTarget ? 1.5 : 0}
                              className={`cursor-pointer ${isTarget ? 'hover:fill-yellow-500/50' : ''}`}
                              onClick={() => selectionMode === 'reference' ? setReferenceHole(hole) : handleHoleClick('chassisLower', hole)}
                              onMouseEnter={() => setHoveredHole({ type: 'chassisLower', hole })}
                              onMouseLeave={() => setHoveredHole(null)}
                              filter={isSelected || isReference ? 'url(#glow)' : undefined}
                              opacity={isSelected || isReference || isHovered ? 1 : 0.8}
                            />
                            {(isSelected || isHovered || isReference) && (
                              <text x={bracketX + bracketW/2 + 6} y={holeY + 3} fill={isReference ? '#f59e0b' : '#eab308'} fontSize="7" fontWeight="bold">#{hole.position}</text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}


                {/* ============ STRANGE MODULAR EXTREME PRO SERIES HOUSING BRACKET w/ DOUBLER ============ */}
                {selectedHousingBracket && (() => {
                  const holes = selectedHousingBracket.holes;
                  const topHoleY = heightToY(holes[holes.length - 1].heightFromAxle);
                  const botHoleY = heightToY(holes[0].heightFromAxle);
                  const bracketX = housingBracketX;
                  const bracketW = 32;
                  const padding = 14;
                  const isStrangeDoubler = selectedHousingBracket.id.includes('doubler');
                  return (
                    <g>
                      {/* Axle tube clamp/saddle */}
                      <path
                        d={`
                          M ${bracketX - bracketW/2 - 8} ${axleCenterY - 16}
                          Q ${bracketX - bracketW/2 - 20} ${axleCenterY - 16} ${bracketX - bracketW/2 - 20} ${axleCenterY}
                          Q ${bracketX - bracketW/2 - 20} ${axleCenterY + 16} ${bracketX - bracketW/2 - 8} ${axleCenterY + 16}
                        `}
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      {/* Clamp bolts */}
                      <circle cx={bracketX - bracketW/2 - 14} cy={axleCenterY - 20} r="3" fill="#4a5568" stroke="#64748b" strokeWidth="1" />
                      <circle cx={bracketX - bracketW/2 - 14} cy={axleCenterY + 20} r="3" fill="#4a5568" stroke="#64748b" strokeWidth="1" />

                      {/* Main bracket plate */}
                      <rect 
                        x={bracketX - bracketW/2} 
                        y={topHoleY - padding} 
                        width={bracketW} 
                        height={botHoleY - topHoleY + padding * 2} 
                        fill="url(#billetGradient)" 
                        stroke="#22d3ee" 
                        strokeWidth="2" 
                        rx="3"
                      />

                      {/* Doubler plate overlay (if Strange Doubler model) */}
                      {isStrangeDoubler && (
                        <g>
                          <rect 
                            x={bracketX - bracketW/2 + 3} 
                            y={topHoleY - padding + 6} 
                            width={bracketW - 6} 
                            height={botHoleY - topHoleY + padding * 2 - 12} 
                            fill="url(#doublerGradient)" 
                            stroke="#0ea5e9" 
                            strokeWidth="1.5" 
                            rx="2"
                            opacity="0.8"
                          />
                          {/* Doubler weld lines */}
                          <line x1={bracketX - bracketW/2 + 4} y1={topHoleY - padding + 8} x2={bracketX + bracketW/2 - 4} y2={topHoleY - padding + 8} stroke="#38bdf8" strokeWidth="0.5" opacity="0.4" strokeDasharray="2,2" />
                          <line x1={bracketX - bracketW/2 + 4} y1={botHoleY + padding - 8} x2={bracketX + bracketW/2 - 4} y2={botHoleY + padding - 8} stroke="#38bdf8" strokeWidth="0.5" opacity="0.4" strokeDasharray="2,2" />
                        </g>
                      )}

                      {/* Shock mount tab (if applicable) */}
                      <rect x={bracketX + bracketW/2} y={axleCenterY - 25} width="12" height="50" fill="#2a2a3e" stroke="#0891b2" strokeWidth="1" rx="2" />
                      <circle cx={bracketX + bracketW/2 + 6} cy={axleCenterY - 15} r="3" fill="#0f0f0f" stroke="#0891b2" strokeWidth="0.5" />
                      <circle cx={bracketX + bracketW/2 + 6} cy={axleCenterY + 15} r="3" fill="#0f0f0f" stroke="#0891b2" strokeWidth="0.5" />

                      {/* Labels */}
                      <text x={bracketX} y={topHoleY - padding - 18} fill="#22d3ee" fontSize="7" textAnchor="middle" fontWeight="bold">STRANGE MODULAR</text>
                      <text x={bracketX} y={topHoleY - padding - 8} fill="#0891b2" fontSize="6" textAnchor="middle">
                        {isStrangeDoubler ? 'EXTREME PRO w/ DOUBLER' : 'EXTREME PRO SERIES'}
                      </text>

                      {holes.map((hole) => {
                        const holeY = heightToY(hole.heightFromAxle);
                        const isSelectedUpper = selectedHousingUpperHole?.id === hole.id;
                        const isSelectedLower = selectedHousingLowerHole?.id === hole.id;
                        const isReference = referenceHole?.id === hole.id;
                        const isHoveredH = hoveredHole?.type === 'housingUpper' && hoveredHole.hole.id === hole.id;
                        const isHoveredL = hoveredHole?.type === 'housingLower' && hoveredHole.hole.id === hole.id;
                        const isRefMode = selectionMode === 'reference';
                        const isTargetU = selectionMode === 'housingUpper';
                        const isTargetL = selectionMode === 'housingLower';
                        const isSelected = isSelectedUpper || isSelectedLower;
                        const isHovered = isHoveredH || isHoveredL;
                        const fillColor = isReference ? '#f59e0b' : isSelectedUpper ? '#3b82f6' : isSelectedLower ? '#22c55e' : isHovered ? '#0ea5e9' : '#0f0f0f';
                        const strokeColor = isReference ? '#fbbf24' : isSelected ? '#fff' : (isTargetU || isTargetL || isRefMode) ? '#06b6d4' : '#4a5568';
                        return (
                          <g key={hole.id}>
                            <rect x={bracketX - 10} y={holeY - 10} width="20" height="20" fill="transparent" className="cursor-pointer"
                              onClick={() => {
                                if (selectionMode === 'reference') setReferenceHole(hole);
                                else if (selectionMode === 'housingUpper') handleHoleClick('housingUpper', hole);
                                else if (selectionMode === 'housingLower') handleHoleClick('housingLower', hole);
                              }}
                              onMouseEnter={() => setHoveredHole({ type: selectionMode === 'housingLower' ? 'housingLower' : 'housingUpper', hole })}
                              onMouseLeave={() => setHoveredHole(null)}
                            />
                            <circle cx={bracketX} cy={holeY}
                              r={isSelected || isReference ? 7 : isHovered ? 6 : 4.5}
                              fill={fillColor} stroke={strokeColor}
                              strokeWidth={isSelected || isReference ? 2.5 : (isTargetU || isTargetL || isRefMode) ? 1.5 : 1}
                              className="pointer-events-none"
                              filter={isSelected || isReference ? 'url(#glow)' : undefined}
                            />
                            {isSelectedUpper && <text x={bracketX - bracketW/2 - 10} y={holeY + 3} fill="#3b82f6" fontSize="7" fontWeight="bold">U</text>}
                            {isSelectedLower && <text x={bracketX - bracketW/2 - 10} y={holeY + 3} fill="#22c55e" fontSize="7" fontWeight="bold">L</text>}
                            {(isSelected || isHovered || isReference) && (
                              <text x={bracketX + bracketW/2 + 18} y={holeY + 3} fill={isReference ? '#f59e0b' : '#22d3ee'} fontSize="7" fontWeight="bold">#{hole.position}</text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* ============ 4-LINK BARS ============ */}
                {isCalibrated && selectedChassisUpperHole && selectedHousingUpperHole && (() => {
                  const chassisY = heightToY(selectedChassisUpperHole.heightFromAxle);
                  const housingY = heightToY(selectedHousingUpperHole.heightFromAxle);
                  const cX = chassisBracketX + 15;
                  const hX = housingBracketX;
                  return (
                    <g>
                      <line x1={cX} y1={chassisY} x2={hX} y2={housingY} stroke="#1e40af" strokeWidth="10" strokeLinecap="round" />
                      <line x1={cX} y1={chassisY} x2={hX} y2={housingY} stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" filter="url(#softGlow)" />
                      <circle cx={cX} cy={chassisY} r="7" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
                      <circle cx={hX} cy={housingY} r="7" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
                      {geometry && (
                        <g>
                          <rect x={(cX + hX) / 2 - 32} y={(chassisY + housingY) / 2 - 20} width="64" height="16" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" rx="3" />
                          <text x={(cX + hX) / 2} y={(chassisY + housingY) / 2 - 9} fill="#3b82f6" fontSize="10" fontWeight="bold" textAnchor="middle">{geometry.upperBarLength.toFixed(2)}"</text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {isCalibrated && selectedChassisLowerHole && selectedHousingLowerHole && (() => {
                  const chassisY = heightToY(selectedChassisLowerHole.heightFromAxle);
                  const housingY = heightToY(selectedHousingLowerHole.heightFromAxle);
                  const cX = chassisBracketX + 50;
                  const hX = housingBracketX;
                  return (
                    <g>
                      <line x1={cX} y1={chassisY} x2={hX} y2={housingY} stroke="#166534" strokeWidth="10" strokeLinecap="round" />
                      <line x1={cX} y1={chassisY} x2={hX} y2={housingY} stroke="#22c55e" strokeWidth="6" strokeLinecap="round" filter="url(#softGlow)" />
                      <circle cx={cX} cy={chassisY} r="7" fill="#14532d" stroke="#22c55e" strokeWidth="2" />
                      <circle cx={hX} cy={housingY} r="7" fill="#14532d" stroke="#22c55e" strokeWidth="2" />
                      {geometry && (
                        <g>
                          <rect x={(cX + hX) / 2 - 32} y={(chassisY + housingY) / 2 + 6} width="64" height="16" fill="#1e293b" stroke="#22c55e" strokeWidth="1" rx="3" />
                          <text x={(cX + hX) / 2} y={(chassisY + housingY) / 2 + 17} fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">{geometry.lowerBarLength.toFixed(2)}"</text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* ============ PERFORMANCE TREND STYLE ANGLE ANNOTATIONS ============ */}
                {geometry && isCalibrated && selectedChassisUpperHole && selectedHousingUpperHole && (() => {
                  const hX = housingBracketX;
                  const housingY = heightToY(selectedHousingUpperHole.heightFromAxle);
                  const angleRad = geometry.upperBarAngle * (Math.PI / 180);
                  const arcR = 30;
                  // Draw angle arc from horizontal to bar angle
                  const arcEndX = hX + arcR * Math.cos(angleRad);
                  const arcEndY = housingY - arcR * Math.sin(angleRad);
                  const largeArc = Math.abs(geometry.upperBarAngle) > 180 ? 1 : 0;
                  const sweep = geometry.upperBarAngle >= 0 ? 0 : 1;
                  return (
                    <g opacity="0.6">
                      {/* Horizontal reference */}
                      <line x1={hX} y1={housingY} x2={hX + 40} y2={housingY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,2" />
                      {/* Angle arc */}
                      <path d={`M ${hX + arcR} ${housingY} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${arcEndX} ${arcEndY}`}
                        fill="none" stroke="#3b82f6" strokeWidth="1" />
                      {/* Angle text */}
                      <text x={hX + arcR + 8} y={housingY - 8} fill="#3b82f6" fontSize="8" fontWeight="bold">
                        {geometry.upperBarAngle.toFixed(1)}°
                      </text>
                    </g>
                  );
                })()}

                {geometry && isCalibrated && selectedChassisLowerHole && selectedHousingLowerHole && (() => {
                  const hX = housingBracketX;
                  const housingY = heightToY(selectedHousingLowerHole.heightFromAxle);
                  const angleRad = geometry.lowerBarAngle * (Math.PI / 180);
                  const arcR = 25;
                  const arcEndX = hX + arcR * Math.cos(angleRad);
                  const arcEndY = housingY - arcR * Math.sin(angleRad);
                  const largeArc = Math.abs(geometry.lowerBarAngle) > 180 ? 1 : 0;
                  const sweep = geometry.lowerBarAngle >= 0 ? 0 : 1;
                  return (
                    <g opacity="0.6">
                      <line x1={hX} y1={housingY} x2={hX + 35} y2={housingY} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="3,2" />
                      <path d={`M ${hX + arcR} ${housingY} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${arcEndX} ${arcEndY}`}
                        fill="none" stroke="#22c55e" strokeWidth="1" />
                      <text x={hX + arcR + 8} y={housingY + 14} fill="#22c55e" fontSize="8" fontWeight="bold">
                        {geometry.lowerBarAngle.toFixed(1)}°
                      </text>
                    </g>
                  );
                })()}

                {/* ============ HEIGHT FROM GROUND DIMENSION LINES (Performance Trend style) ============ */}
                {isCalibrated && selectedChassisUpperHole && (() => {
                  const holeY = heightToY(selectedChassisUpperHole.heightFromAxle);
                  const heightFromGround = calculatedAxleCenterHeight + selectedChassisUpperHole.heightFromAxle;
                  const dimX = chassisBracketX + 85;
                  return (
                    <g opacity="0.5">
                      <line x1={dimX} y1={groundY} x2={dimX} y2={holeY} stroke="#f97316" strokeWidth="0.8" />
                      <line x1={dimX - 4} y1={groundY} x2={dimX + 4} y2={groundY} stroke="#f97316" strokeWidth="0.8" />
                      <line x1={dimX - 4} y1={holeY} x2={dimX + 4} y2={holeY} stroke="#f97316" strokeWidth="0.8" />
                      <rect x={dimX - 18} y={(groundY + holeY) / 2 - 7} width="36" height="14" fill="#1e293b" rx="2" />
                      <text x={dimX} y={(groundY + holeY) / 2 + 4} fill="#f97316" fontSize="7" fontWeight="bold" textAnchor="middle">
                        {heightFromGround.toFixed(2)}"
                      </text>
                    </g>
                  );
                })()}

                {isCalibrated && selectedChassisLowerHole && (() => {
                  const holeY = heightToY(selectedChassisLowerHole.heightFromAxle);
                  const heightFromGround = calculatedAxleCenterHeight + selectedChassisLowerHole.heightFromAxle;
                  const dimX = chassisBracketX + 100;
                  return (
                    <g opacity="0.5">
                      <line x1={dimX} y1={groundY} x2={dimX} y2={holeY} stroke="#eab308" strokeWidth="0.8" />
                      <line x1={dimX - 4} y1={groundY} x2={dimX + 4} y2={groundY} stroke="#eab308" strokeWidth="0.8" />
                      <line x1={dimX - 4} y1={holeY} x2={dimX + 4} y2={holeY} stroke="#eab308" strokeWidth="0.8" />
                      <rect x={dimX - 18} y={(groundY + holeY) / 2 - 7} width="36" height="14" fill="#1e293b" rx="2" />
                      <text x={dimX} y={(groundY + holeY) / 2 + 4} fill="#eab308" fontSize="7" fontWeight="bold" textAnchor="middle">
                        {heightFromGround.toFixed(2)}"
                      </text>
                    </g>
                  );
                })()}

                {/* ============ INSTANT CENTER PROJECTION ============ */}

                {geometry && geometry.instantCenterX !== 0 && isCalibrated && selectedChassisUpperHole && selectedChassisLowerHole && selectedHousingUpperHole && selectedHousingLowerHole && (() => {
                  // IC projects forward (to the right) and up from the axle
                  const icVisX = Math.min(svgWidth - 50, Math.max(50, axleCenterX + (geometry.instantCenterX * 2)));
                  const icVisY = Math.min(svgHeight - 60, Math.max(30, axleCenterY - (geometry.instantCenterY * 2)));
                  return (
                    <g opacity="0.7">
                      <line x1={chassisBracketX + 15} y1={heightToY(selectedChassisUpperHole.heightFromAxle)} x2={icVisX} y2={icVisY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="6,4" opacity="0.4" />
                      <line x1={chassisBracketX + 50} y1={heightToY(selectedChassisLowerHole.heightFromAxle)} x2={icVisX} y2={icVisY} stroke="#22c55e" strokeWidth="1" strokeDasharray="6,4" opacity="0.4" />
                      <circle cx={icVisX} cy={icVisY} r="12" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4,2" filter="url(#glow)" />
                      <circle cx={icVisX} cy={icVisY} r="4" fill="#a855f7" />
                      <text x={icVisX} y={icVisY - 18} fill="#a855f7" fontSize="9" fontWeight="bold" textAnchor="middle">INSTANT CENTER</text>
                    </g>
                  );
                })()}

                {/* Measurement reference line */}
                {referenceHole && selectionMode === 'reference' && (
                  <g>
                    <line x1={housingBracketX + 50} y1={groundY} x2={housingBracketX + 50} y2={heightToY(referenceHole.heightFromAxle)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3" />
                    <circle cx={housingBracketX + 50} cy={groundY} r="4" fill="#f59e0b" />
                    <text x={housingBracketX + 60} y={(groundY + heightToY(referenceHole.heightFromAxle)) / 2} fill="#f59e0b" fontSize="10" fontWeight="bold">Measure this</text>
                  </g>
                )}

                {/* ============ LEGEND ============ */}
                <g transform="translate(20, 20)">
                  <rect x="0" y="0" width="180" height="180" fill="#1e293b" rx="6" stroke="#334155" opacity="0.95" />
                  <text x="10" y="16" fill="#94a3b8" fontSize="9" fontWeight="bold">QUARTERMAX / STRANGE 4-LINK</text>
                  <text x="10" y="28" fill="#64748b" fontSize="7">3/8" holes | 1/8" bracket adj</text>
                  
                  <circle cx="16" cy="42" r="4" fill="#f59e0b" />
                  <text x="26" y="45" fill="#f59e0b" fontSize="8">Reference Hole</text>
                  
                  <circle cx="16" cy="58" r="4" fill="#f97316" />
                  <text x="26" y="61" fill="#f97316" fontSize="8">QM Chassis Upper</text>
                  
                  <circle cx="16" cy="74" r="4" fill="#eab308" />
                  <text x="26" y="77" fill="#eab308" fontSize="8">QM Chassis Lower</text>
                  
                  <circle cx="16" cy="90" r="4" fill="#3b82f6" />
                  <text x="26" y="93" fill="#3b82f6" fontSize="8">Strange Housing Upper</text>
                  
                  <circle cx="16" cy="106" r="4" fill="#22c55e" />
                  <text x="26" y="109" fill="#22c55e" fontSize="8">Strange Housing Lower</text>
                  
                  <circle cx="16" cy="122" r="4" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="2,1" />
                  <text x="26" y="125" fill="#a855f7" fontSize="8">Instant Center</text>
                  
                  <line x1="12" y1="138" x2="20" y2="138" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" />
                  <text x="26" y="141" fill="#ef4444" fontSize="8">Axle Centerline</text>

                  <rect x="10" y="148" width="8" height="6" fill="url(#doublerGradient)" stroke="#0ea5e9" strokeWidth="0.5" rx="1" />
                  <text x="26" y="155" fill="#0ea5e9" fontSize="8">Doubler Plate</text>

                  {/* 3/8" spacing indicator */}
                  <line x1="12" y1="165" x2="12" y2="173" stroke="#a855f7" strokeWidth="1" />
                  <line x1="10" y1="165" x2="14" y2="165" stroke="#a855f7" strokeWidth="1" />
                  <line x1="10" y1="173" x2="14" y2="173" stroke="#a855f7" strokeWidth="1" />
                  <text x="26" y="172" fill="#a855f7" fontSize="8">3/8" hole spacing</text>
                </g>

                {/* ============ PERFORMANCE TREND STYLE MEASUREMENT READOUT ============ */}
                {geometry && isCalibrated && (
                  <g transform={`translate(${svgWidth - 220}, ${svgHeight - 130})`}>
                    <rect x="0" y="0" width="200" height="115" fill="#0f172a" rx="6" stroke="#1e40af" strokeWidth="1.5" opacity="0.95" />
                    <rect x="0" y="0" width="200" height="20" fill="#1e40af" rx="6" />
                    <rect x="0" y="10" width="200" height="10" fill="#1e40af" />
                    <text x="100" y="14" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">4-LINK GEOMETRY DATA</text>
                    
                    <text x="10" y="35" fill="#94a3b8" fontSize="8">Upper Bar:</text>
                    <text x="190" y="35" fill="#3b82f6" fontSize="9" fontWeight="bold" textAnchor="end">{geometry.upperBarLength.toFixed(2)}" @ {geometry.upperBarAngle.toFixed(1)}°</text>
                    
                    <text x="10" y="50" fill="#94a3b8" fontSize="8">Lower Bar:</text>
                    <text x="190" y="50" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="end">{geometry.lowerBarLength.toFixed(2)}" @ {geometry.lowerBarAngle.toFixed(1)}°</text>
                    
                    <line x1="10" y1="56" x2="190" y2="56" stroke="#334155" strokeWidth="0.5" />
                    
                    <text x="10" y="69" fill="#94a3b8" fontSize="8">Instant Center:</text>
                    <text x="190" y="69" fill="#a855f7" fontSize="9" fontWeight="bold" textAnchor="end">X:{geometry.instantCenterX.toFixed(1)}" Y:{geometry.instantCenterY.toFixed(1)}"</text>
                    
                    <text x="10" y="84" fill="#94a3b8" fontSize="8">Anti-Squat:</text>
                    <text x="190" y="84" fill="#f97316" fontSize="9" fontWeight="bold" textAnchor="end">{geometry.antiSquatPercent.toFixed(1)}%</text>
                    
                    <text x="10" y="99" fill="#94a3b8" fontSize="8">Spreads (C/H):</text>
                    <text x="190" y="99" fill="#06b6d4" fontSize="9" fontWeight="bold" textAnchor="end">{geometry.chassisSpread.toFixed(3)}" / {geometry.rearSpread.toFixed(3)}"</text>
                    
                    <text x="10" y="112" fill="#64748b" fontSize="7">Axle CL: {calculatedAxleCenterHeight.toFixed(2)}" | Fwd: {chassisForwardDistance}"</text>
                  </g>
                )}

                {/* ============ BRACKET SPACING ANNOTATIONS ============ */}
                {/* Show 3/8" spacing dimension on upper chassis bracket */}
                {selectedChassisBracketUpper && selectedChassisBracketUpper.holes.length >= 2 && (() => {
                  const h1 = selectedChassisBracketUpper.holes[0];
                  const h2 = selectedChassisBracketUpper.holes[1];
                  const y1 = heightToY(h1.heightFromAxle);
                  const y2 = heightToY(h2.heightFromAxle);
                  const dimX = chassisBracketX + 15 + 22;
                  return (
                    <g opacity="0.6">
                      <line x1={dimX} y1={y1} x2={dimX + 8} y2={y1} stroke="#a855f7" strokeWidth="0.5" />
                      <line x1={dimX} y1={y2} x2={dimX + 8} y2={y2} stroke="#a855f7" strokeWidth="0.5" />
                      <line x1={dimX + 4} y1={y1} x2={dimX + 4} y2={y2} stroke="#a855f7" strokeWidth="0.5" />
                      <text x={dimX + 8} y={(y1 + y2) / 2 + 3} fill="#a855f7" fontSize="6">3/8"</text>
                    </g>
                  );
                })()}

                {/* Show 3/8" spacing dimension on housing bracket */}
                {selectedHousingBracket && selectedHousingBracket.holes.length >= 2 && (() => {
                  const midIdx = Math.floor(selectedHousingBracket.holes.length / 2);
                  const h1 = selectedHousingBracket.holes[midIdx];
                  const h2 = selectedHousingBracket.holes[midIdx + 1];
                  const y1 = heightToY(h1.heightFromAxle);
                  const y2 = heightToY(h2.heightFromAxle);
                  const dimX = housingBracketX - 24;
                  return (
                    <g opacity="0.6">
                      <line x1={dimX} y1={y1} x2={dimX - 8} y2={y1} stroke="#06b6d4" strokeWidth="0.5" />
                      <line x1={dimX} y1={y2} x2={dimX - 8} y2={y2} stroke="#06b6d4" strokeWidth="0.5" />
                      <line x1={dimX - 4} y1={y1} x2={dimX - 4} y2={y2} stroke="#06b6d4" strokeWidth="0.5" />
                      <text x={dimX - 10} y={(y1 + y2) / 2 + 3} fill="#06b6d4" fontSize="6" textAnchor="end">3/8"</text>
                    </g>
                  );
                })()}

                {/* ============ HEIGHT SCALE (Performance Trend style) ============ */}
                {isCalibrated && (() => {
                  const scaleX = 115;
                  const marks: number[] = [];
                  for (let h = 0; h <= 20; h += 2) {
                    const y = groundY - (h * scale);
                    if (y > 30 && y < svgHeight - 20) {
                      marks.push(h);
                    }
                  }
                  return (
                    <g opacity="0.35">
                      <line x1={scaleX} y1={groundY} x2={scaleX} y2={30} stroke="#64748b" strokeWidth="0.5" />
                      {marks.map(h => {
                        const y = groundY - (h * scale);
                        return (
                          <g key={`scale-${h}`}>
                            <line x1={scaleX - 4} y1={y} x2={scaleX + 4} y2={y} stroke="#64748b" strokeWidth="0.5" />
                            <text x={scaleX - 8} y={y + 3} fill="#64748b" fontSize="7" textAnchor="end">{h}"</text>
                          </g>
                        );
                      })}
                      <text x={scaleX} y={25} fill="#64748b" fontSize="7" textAnchor="middle">HEIGHT</text>
                    </g>
                  );
                })()}


                {/* ============ HOVER INFO PANEL ============ */}
                {hoveredHole && (
                  <g transform={`translate(${svgWidth - 210}, 20)`}>
                    <rect x="0" y="0" width="190" height={tireValidation && isCalibrated ? 135 : 100} fill="#1e293b" rx="6" stroke="#06b6d4" opacity="0.95" />
                    <text x="10" y="18" fill="#06b6d4" fontSize="10" fontWeight="bold">{hoveredHole.hole.label}</text>
                    <text x="10" y="35" fill="#94a3b8" fontSize="9">
                      From Axle CL: {hoveredHole.hole.heightFromAxle > 0 ? '+' : ''}{hoveredHole.hole.heightFromAxle.toFixed(3)}"
                    </text>
                    <text x="10" y="50" fill="#94a3b8" fontSize="9">
                      Height from Ground: {(rearEndCenterHeight + hoveredHole.hole.heightFromAxle).toFixed(2)}"
                    </text>
                    <text x="10" y="65" fill="#94a3b8" fontSize="9">
                      Forward of Axle: {(hoveredHole.type.startsWith('chassis') && selectedSeries === 'Extreme 1/8" Billet') ? chassisForwardDistance : hoveredHole.hole.forwardOfAxle}"
                    </text>
                    {tireValidation && isCalibrated && (
                      <>
                        <line x1="10" y1="74" x2="180" y2="74" stroke="#334155" strokeWidth="0.5" />
                        <text x="10" y="88" fill="#22d3ee" fontSize="9" fontWeight="bold">
                          Ground Clearance: {(calculatedAxleCenterHeight + hoveredHole.hole.heightFromAxle).toFixed(2)}"
                        </text>
                        <text x="10" y="103" fill={
                          (calculatedAxleCenterHeight + hoveredHole.hole.heightFromAxle) < 3 ? '#ef4444' :
                          (calculatedAxleCenterHeight + hoveredHole.hole.heightFromAxle) < 5 ? '#f59e0b' : '#22c55e'
                        } fontSize="9">
                          {(calculatedAxleCenterHeight + hoveredHole.hole.heightFromAxle) < 3 ? 'LOW - Check clearance!' :
                           (calculatedAxleCenterHeight + hoveredHole.hole.heightFromAxle) < 5 ? 'Moderate clearance' : 'Good clearance'}
                        </text>
                        <text x="10" y="118" fill="#94a3b8" fontSize="8">
                          Tire: {tireValidation.diameter}" ({tireValidation.loadedRadius.toFixed(1)}" loaded R)
                        </text>
                      </>
                    )}
                    {selectionMode === 'reference' && (
                      <text x="10" y={tireValidation && isCalibrated ? 132 : 82} fill="#f59e0b" fontSize="9" fontWeight="bold">Click to set as reference</text>
                    )}
                  </g>
                )}

                {/* Tire size indicators */}
                {tireValidation && isCalibrated && (
                  <g>
                    <line
                      x1={axleCenterX - rearTireRadius - 15}
                      y1={groundY - (tireValidation.expectedAxleHeight * scale)}
                      x2={axleCenterX - rearTireRadius - 50}
                      y2={groundY - (tireValidation.expectedAxleHeight * scale)}
                      stroke={tireValidation.status === 'good' ? '#22c55e' : tireValidation.status === 'warning' ? '#eab308' : '#ef4444'}
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                    />
                    <text
                      x={axleCenterX - rearTireRadius - 55}
                      y={groundY - (tireValidation.expectedAxleHeight * scale) + 4}
                      fill={tireValidation.status === 'good' ? '#22c55e' : tireValidation.status === 'warning' ? '#eab308' : '#ef4444'}
                      fontSize="7"
                      textAnchor="end"
                    >
                      Expected CL ({tireValidation.expectedAxleHeight.toFixed(1)}")
                    </text>
                    <text x={axleCenterX} y={axleCenterY + rearTireRadius + 34} fill="#06b6d4" fontSize="8" textAnchor="middle" opacity="0.6">
                      {tireValidation.diameter}" tire
                    </text>
                  </g>
                )}

              </svg>

              {/* Selection Mode Indicator */}
              <div className="absolute bottom-4 left-4 bg-slate-900/95 rounded-lg px-4 py-2 border border-slate-700">
                <div className="flex items-center gap-2 text-sm">
                  <MousePointer2 className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-400">Mode:</span>
                  <span className={`font-bold ${
                    selectionMode === 'reference' ? 'text-amber-400' :
                    selectionMode === 'chassisUpper' ? 'text-orange-400' :
                    selectionMode === 'chassisLower' ? 'text-yellow-400' :
                    selectionMode === 'housingUpper' ? 'text-blue-400' : 'text-green-400'
                  }`}>
                    {selectionMode === 'reference' ? 'Select Reference Hole' :
                     selectionMode === 'chassisUpper' ? 'Chassis Upper' :
                     selectionMode === 'chassisLower' ? 'Chassis Lower' :
                     selectionMode === 'housingUpper' ? 'Housing Upper' : 'Housing Lower'}
                  </span>
                </div>
              </div>

              {/* Brand Labels */}
              <div className="absolute top-4 right-4 bg-slate-900/80 rounded-lg px-3 py-2 border border-purple-500/30">
                <div className="text-purple-400 font-bold text-xs">QUARTERMAX</div>
                <div className="text-cyan-400 font-bold text-xs">STRANGE</div>
                <div className="text-slate-500 text-[10px]">{selectedSeries}</div>
              </div>
            </div>
          </div>


          {/* Right Panel - Presets */}
          {showPresets && (
            <div className="w-80 border-l border-slate-700 p-4 overflow-y-auto bg-slate-800/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-purple-400" />
                  Saved Presets
                </h4>
                <button
                  onClick={() => {
                    setEditingPreset(null);
                    setNewPresetName('');
                    setNewPresetNotes('');
                    setNewPresetCategory('Moderate');
                    setShowSaveModal(true);
                  }}
                  disabled={!canSavePreset}
                  className="p-1.5 rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={presetSearchQuery}
                    onChange={(e) => setPresetSearchQuery(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <select
                  value={presetFilterCategory}
                  onChange={(e) => setPresetFilterCategory(e.target.value as PresetCategory | 'All')}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="All">All Categories</option>
                  {PRESET_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {filteredPresets.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No presets found</p>
                  </div>
                ) : (
                  filteredPresets.map(preset => {
                    const colors = getCategoryColor(preset.category);
                    return (
                      <div
                        key={preset.id}
                        className={`p-3 rounded-lg border ${colors.border} bg-slate-800/50 hover:bg-slate-800 transition-all`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white text-sm">{preset.name}</span>
                              {preset.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                              {preset.category}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleToggleFavorite(preset.id)}
                              className="p-1 rounded hover:bg-slate-700"
                            >
                              <Star className={`w-3 h-3 ${preset.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'}`} />
                            </button>
                            <button
                              onClick={() => handleDeletePreset(preset.id)}
                              className="p-1 rounded hover:bg-red-500/20"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                        {preset.geometry && (
                          <div className="text-[10px] text-slate-400 mb-2">
                            Upper: {preset.geometry.upperBarLength.toFixed(2)}" | Lower: {preset.geometry.lowerBarLength.toFixed(2)}"
                          </div>
                        )}
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className={`w-full py-1.5 rounded text-xs font-medium ${colors.bg} ${colors.text} hover:opacity-80`}
                        >
                          Load
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-1.5 ${isCalibrated ? 'text-green-400' : 'text-amber-400'}`}>
              {isCalibrated ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isCalibrated ? 'Calibrated' : 'Needs Calibration'}
            </div>
            <div className={`flex items-center gap-1.5 ${selectedChassisUpperHole && selectedChassisLowerHole ? 'text-orange-400' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
              Chassis
            </div>
            <div className={`flex items-center gap-1.5 ${selectedHousingUpperHole && selectedHousingLowerHole ? 'text-cyan-400' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
              Housing
            </div>
            {canApply && (
              <span className="text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Ready to Apply
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply Setup
            </button>
          </div>
        </div>

        {/* Save Preset Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Save className="w-5 h-5 text-purple-400" />
                Save Preset
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g., Bristol Sticky Setup"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_CATEGORIES.map(cat => {
                      const colors = getCategoryColor(cat.value);
                      const isSelected = newPresetCategory === cat.value;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => setNewPresetCategory(cat.value)}
                          className={`p-2 rounded-lg border text-left text-sm ${
                            isSelected ? `${colors.bg} ${colors.border}` : 'bg-slate-700/50 border-slate-600'
                          }`}
                        >
                          <span className={isSelected ? colors.text : 'text-white'}>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={newPresetNotes}
                    onChange={(e) => setNewPresetNotes(e.target.value)}
                    placeholder="When does this setup work best?"
                    rows={2}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuartermaxBracketSelector;
