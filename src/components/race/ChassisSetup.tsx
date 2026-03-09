import React, { useState, useMemo, useEffect } from 'react';
import { getLocalDateString } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';

import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { ChassisSetupRowSchema, UserPresetRowSchema } from '@/lib/validators';
import {
  Settings,
  Plus,
  Save,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Target,
  Scale,
  Gauge,
  ArrowUpDown,
  Ruler,
  RefreshCw,
  Copy,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Info,
  Database,
  GitCompare,
  Calendar,
  MapPin,
  Cloud,
  Star,
  StarOff,
  Loader2,
  Clock,
  Crosshair,
  TrendingUp,
  Calculator,
  RotateCcw,
  Compass,
  Lightbulb,
  BookOpen,
  Car,
  Zap,
  Wrench,
  Circle
} from 'lucide-react';
import SetupRecommendationEngine from './SetupRecommendationEngine';
import StrangeBracketSelector from './StrangeBracketSelector';
import QuartermaxBracketSelector from './QuartermaxBracketSelector';
import { fourLinkPresets, getPresetCategories, getAllPresetCategories, FourLinkPreset, PresetCategory, FourLinkSettings as FourLinkSettingsType } from '@/data/fourLinkPresets';
import { strangeBrackets, getAllSeries, getBracketById, calculateMountHeight, StrangeBracket, BracketMountHole } from '@/data/strangeBrackets';



// Database type for user presets
interface UserPresetDB {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string;
  settings: FourLinkSettingsType;
  recommended_pinion_angle: number | null;
  target_anti_squat_min: number | null;
  target_anti_squat_max: number | null;
  characteristics: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}




// Database types
interface ChassisSetupDB {
  id: string;
  name: string;
  description: string | null;
  race_event: string | null;
  race_date: string | null;
  track_name: string | null;
  track_conditions: string | null;
  weather_conditions: string | null;
  upper_bar_chassis_x: number;
  upper_bar_chassis_y: number;
  upper_bar_rear_x: number;
  upper_bar_rear_y: number;
  lower_bar_chassis_x: number;
  lower_bar_chassis_y: number;
  lower_bar_rear_x: number;
  lower_bar_rear_y: number;
  rear_end_center_height: number;
  instant_center_length: number | null;
  instant_center_height: number | null;
  anti_squat_percentage: number | null;
  corner_weights: { lf: number; rf: number; lr: number; rr: number };
  ballast_items: BallastItem[];
  total_weight: number | null;
  cross_weight_percentage: number | null;
  shock_settings: ShockSettingsData;
  ride_heights: RideHeightData;
  spring_data: SpringData;
  cg_data: CGData | null;
  pinion_data: PinionData | null;
  performance_notes: string | null;
  sixty_foot_time: number | null;
  eighth_mile_et: number | null;
  eighth_mile_mph: number | null;
  quarter_mile_et: number | null;
  quarter_mile_mph: number | null;
  is_favorite: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface BallastItem {
  id: string;
  name: string;
  weight: number;
  location: 'Left Front' | 'Right Front' | 'Left Rear' | 'Right Rear' | 'Center Front' | 'Center Rear';
  isInstalled: boolean;
  notes: string;
}

interface ShockSettingsData {
  lf: { compression: number; rebound: number; gasCharge: number; model: string };
  rf: { compression: number; rebound: number; gasCharge: number; model: string };
  lr: { compression: number; rebound: number; gasCharge: number; model: string };
  rr: { compression: number; rebound: number; gasCharge: number; model: string };
}

interface RideHeightData {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
  pinionAngle: number;
}

interface SpringData {
  lf: { rate: number; preload: number; freeLength: number };
  rf: { rate: number; preload: number; freeLength: number };
  lr: { rate: number; preload: number; freeLength: number };
  rr: { rate: number; preload: number; freeLength: number };
}

interface CGData {
  levelFrontWeight: number;
  levelRearWeight: number;
  liftedRearWeight: number;
  frontLiftHeight: number;
  rearAxleHeight: number;
  calculatedCGHeight: number;
  cgDistanceFromRear: number;
}

interface PinionData {
  staticPinionAngle: number;
  transmissionAngle: number;
  driveshaftLength: number;
  maxCompression: number;
  maxExtension: number;
  trackCondition: 'sticky' | 'moderate' | 'slick';
}

// Local working state
interface FourLinkSettings {
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

interface ChassisSetupProps {
  currentRole?: string;
}

const defaultFourLink: FourLinkSettings = {
  upperBarChassisMountHeight: 18.5,
  upperBarChassisMountForward: 32,
  upperBarRearEndMountHeight: 14,
  upperBarRearEndMountForward: 6,
  lowerBarChassisMountHeight: 8.5,
  lowerBarChassisMountForward: 38,
  lowerBarRearEndMountHeight: 10,
  lowerBarRearEndMountForward: 2,
  wheelbase: 110,
  rearTireRadius: 17,
  frontTireRadius: 13,
  rearEndCenterHeight: 11
};


const defaultCGData: CGData = {
  levelFrontWeight: 1700,
  levelRearWeight: 2200,
  liftedRearWeight: 2350,
  frontLiftHeight: 12,
  rearAxleHeight: 11,
  calculatedCGHeight: 0,
  cgDistanceFromRear: 0
};

const defaultPinionData: PinionData = {
  staticPinionAngle: -2.5,
  transmissionAngle: 3.0,
  driveshaftLength: 48,
  maxCompression: 3.0,
  maxExtension: 4.0,
  trackCondition: 'moderate'
};

const defaultCornerWeights = { lf: 850, rf: 850, lr: 1100, rr: 1100 };

const defaultShockSettings: ShockSettingsData = {
  lf: { compression: 6, rebound: 8, gasCharge: 150, model: '' },
  rf: { compression: 6, rebound: 8, gasCharge: 150, model: '' },
  lr: { compression: 4, rebound: 6, gasCharge: 200, model: '' },
  rr: { compression: 4, rebound: 6, gasCharge: 200, model: '' }
};

const defaultRideHeights: RideHeightData = {
  frontLeft: 4.5,
  frontRight: 4.5,
  rearLeft: 5.0,
  rearRight: 5.0,
  pinionAngle: -2.5
};

const defaultSpringData: SpringData = {
  lf: { rate: 250, preload: 1.5, freeLength: 10 },
  rf: { rate: 250, preload: 1.5, freeLength: 10 },
  lr: { rate: 175, preload: 2.0, freeLength: 12 },
  rr: { rate: 175, preload: 2.0, freeLength: 12 }
};

type ChassisTab = '4link' | 'cg' | 'pinion' | 'weight' | 'shocks' | 'rideheight' | 'springs' | 'recommendations';

const ChassisSetup: React.FC<ChassisSetupProps> = ({ currentRole = 'Crew' }) => {
  const [activeTab, setActiveTab] = useState<ChassisTab>('4link');




  // Database state
  const [savedSetups, setSavedSetups] = useState<ChassisSetupDB[]>([]);
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Current working state
  const [setupName, setSetupName] = useState('New Setup');
  const [setupDescription, setSetupDescription] = useState('');
  const [raceEvent, setRaceEvent] = useState('');
  const [raceDate, setRaceDate] = useState(getLocalDateString());

  const [trackName, setTrackName] = useState('');
  const [trackConditions, setTrackConditions] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [performanceNotes, setPerformanceNotes] = useState('');
  const [sixtyFootTime, setSixtyFootTime] = useState<number | null>(null);
  const [eighthMileET, setEighthMileET] = useState<number | null>(null);
  const [eighthMileMPH, setEighthMileMPH] = useState<number | null>(null);
  const [quarterMileET, setQuarterMileET] = useState<number | null>(null);
  const [quarterMileMPH, setQuarterMileMPH] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // 4-Link State
  const [fourLink, setFourLink] = useState<FourLinkSettings>(defaultFourLink);

  // Weight State
  const [cornerWeights, setCornerWeights] = useState(defaultCornerWeights);
  const [ballastItems, setBallastItems] = useState<BallastItem[]>([]);
  const [targetCrossWeight, setTargetCrossWeight] = useState(50);

  // Shock State
  const [shockSettings, setShockSettings] = useState<ShockSettingsData>(defaultShockSettings);

  // Ride Height State
  // Ride Height State
  const [rideHeights, setRideHeights] = useState<RideHeightData>(defaultRideHeights);

  // Spring State
  // Spring State
  const [springData, setSpringData] = useState<SpringData>(defaultSpringData);

  // CG Calculator State
  const [cgData, setCgData] = useState<CGData>(defaultCGData);

  // Pinion Angle Calculator State
  const [pinionData, setPinionData] = useState<PinionData>(defaultPinionData);
  const [suspensionPosition, setSuspensionPosition] = useState(0); // -100 to +100 (extension to compression)

  // Track if pinion sync is enabled
  const [pinionSyncEnabled, setPinionSyncEnabled] = useState(true);
  const [lastPinionSource, setLastPinionSource] = useState<'pinion' | 'rideheight' | '4link'>('pinion');

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showBallastModal, setShowBallastModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [showBracketSelector, setShowBracketSelector] = useState(false);
  const [showQuartermaxBracketSelector, setShowQuartermaxBracketSelector] = useState(false);

  const [selectedPresetCategory, setSelectedPresetCategory] = useState<PresetCategory>('Pro');
  const [selectedPreset, setSelectedPreset] = useState<FourLinkPreset | null>(null);
  const [compareSetupId, setCompareSetupId] = useState<string | null>(null);
  const [presetsTab, setPresetsTab] = useState<'library' | 'my-presets'>('library');

  // User presets state
  const [userPresets, setUserPresets] = useState<FourLinkPreset[]>([]);
  const [isLoadingUserPresets, setIsLoadingUserPresets] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetData, setNewPresetData] = useState({
    name: '',
    description: '',
    category: 'Custom' as PresetCategory,
    characteristics: [''],
    notes: ''
  });

  const [newBallast, setNewBallast] = useState<BallastItem>({
    id: '',
    name: '',
    weight: 10,
    location: 'Left Rear',
    isInstalled: true,
    notes: ''
  });



  // Load preset function
  const loadFourLinkPreset = (preset: FourLinkPreset) => {
    setFourLink(preset.settings);
    // Also update pinion angle if recommended
    if (preset.recommendedPinionAngle) {
      setPinionData(prev => ({ ...prev, staticPinionAngle: preset.recommendedPinionAngle }));
      setRideHeights(prev => ({ ...prev, pinionAngle: preset.recommendedPinionAngle }));
    }
    setSetupName(`${preset.name} - Custom`);
    setSetupDescription(preset.description);
    markChanged();
    setShowPresetsModal(false);
    setSelectedPreset(null);
  };


  // Load setups from database
  useEffect(() => {
    loadSetups();
  }, []);

  const loadSetups = async () => {
    setIsLoading(true);
    
    // Safety timeout — never let loading spinner hang forever
    const safetyTimeout = setTimeout(() => {
      console.warn('ChassisSetup: safety timeout — forcing loading to end');
      setIsLoading(false);
    }, 5000);
    
    try {
      const { data, error } = await supabase
        .from('chassis_setups')
        .select('*')
        .order('updated_at', { ascending: false });
      const savedSetups = parseRows(data, ChassisSetupRowSchema, 'chassis_setups') as ChassisSetupDB[];
      setSavedSetups(savedSetups);

      // Load the most recent setup if available — use validated savedSetups, not raw data
      if (savedSetups.length > 0) {
        loadSetupData(savedSetups[0]);
      }

    } catch (error) {
      console.error('Error loading setups:', error);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  };


  const loadSetupData = (setup: ChassisSetupDB) => {
    setSelectedSetupId(setup.id);
    setSetupName(setup.name);
    setSetupDescription(setup.description || '');
    setRaceDate(setup.race_date || getLocalDateString());


    setTrackConditions(setup.track_conditions || '');
    setWeatherConditions(setup.weather_conditions || '');
    setPerformanceNotes(setup.performance_notes || '');
    setSixtyFootTime(setup.sixty_foot_time);
    setEighthMileET(setup.eighth_mile_et);
    setEighthMileMPH(setup.eighth_mile_mph);
    setQuarterMileET(setup.quarter_mile_et);
    setQuarterMileMPH(setup.quarter_mile_mph);
    setIsFavorite(setup.is_favorite);

    setFourLink({
      upperBarChassisMountHeight: setup.upper_bar_chassis_y,
      upperBarChassisMountForward: setup.upper_bar_chassis_x,
      upperBarRearEndMountHeight: setup.upper_bar_rear_y,
      upperBarRearEndMountForward: setup.upper_bar_rear_x || 6,
      lowerBarChassisMountHeight: setup.lower_bar_chassis_y,
      lowerBarChassisMountForward: setup.lower_bar_chassis_x,
      lowerBarRearEndMountHeight: setup.lower_bar_rear_y,
      lowerBarRearEndMountForward: setup.lower_bar_rear_x || 2,
      wheelbase: 110,
      rearTireRadius: 17,
      frontTireRadius: 13,
      rearEndCenterHeight: setup.rear_end_center_height
    });

    setCornerWeights(setup.corner_weights);
    setBallastItems(setup.ballast_items || []);
    setShockSettings(setup.shock_settings);
    setRideHeights(setup.ride_heights);
    if (setup.cg_data) {
      setCgData(setup.cg_data);
    }
    if (setup.pinion_data) {
      setPinionData(setup.pinion_data);
    }
    setSpringData(setup.spring_data);
    setHasUnsavedChanges(false);
    setLastSaved(new Date(setup.updated_at));
  };



  const calculateInstantCenter = (settings: FourLinkSettings) => {
    // Upper bar: from chassis mount to rear end mount
    // Using rear end mount forward positions (distance forward from rear axle centerline)
    const upperDeltaX = settings.upperBarChassisMountForward - settings.upperBarRearEndMountForward;
    const upperDeltaY = settings.upperBarChassisMountHeight - settings.upperBarRearEndMountHeight;
    const m1 = upperDeltaY / upperDeltaX;
    const b1 = settings.upperBarRearEndMountHeight - m1 * settings.upperBarRearEndMountForward;
    
    // Lower bar: from chassis mount to rear end mount
    const lowerDeltaX = settings.lowerBarChassisMountForward - settings.lowerBarRearEndMountForward;
    const lowerDeltaY = settings.lowerBarChassisMountHeight - settings.lowerBarRearEndMountHeight;
    const m2 = lowerDeltaY / lowerDeltaX;
    const b2 = settings.lowerBarRearEndMountHeight - m2 * settings.lowerBarRearEndMountForward;

    if (Math.abs(m1 - m2) < 0.0001) {
      return { icLength: Infinity, icHeight: Infinity, antiSquat: 0, upperBarLength: 0, lowerBarLength: 0 };
    }

    // IC is where the two bar lines intersect (extended forward)
    const icX = (b2 - b1) / (m1 - m2);
    const icY = m1 * icX + b1;
    const icLength = icX; // Positive = forward of rear axle
    const icHeight = icY;
    
    // Anti-squat calculation (IC must be forward, so icLength should be positive)
    const antiSquat = icLength > 0 ? (icHeight / settings.rearTireRadius) * (settings.wheelbase / icLength) * 100 : 0;

    // Calculate bar lengths using Pythagorean theorem
    const upperBarLength = Math.sqrt(
      Math.pow(settings.upperBarChassisMountForward - settings.upperBarRearEndMountForward, 2) +
      Math.pow(settings.upperBarChassisMountHeight - settings.upperBarRearEndMountHeight, 2)
    );
    const lowerBarLength = Math.sqrt(
      Math.pow(settings.lowerBarChassisMountForward - settings.lowerBarRearEndMountForward, 2) +
      Math.pow(settings.lowerBarChassisMountHeight - settings.lowerBarRearEndMountHeight, 2)
    );

    return { icLength, icHeight, antiSquat, upperBarLength, lowerBarLength };
  };

  const fourLinkCalculations = useMemo(() => {
    return calculateInstantCenter(fourLink);
  }, [fourLink]);

  // Calculate pinion angle change rate based on 4-link IC
  const pinionAngleChangeRate = useMemo(() => {
    const icLength = fourLinkCalculations.icLength;
    const icHeight = fourLinkCalculations.icHeight;
    const icDistance = Math.sqrt(icLength * icLength + icHeight * icHeight);
    return icDistance > 0 ? (180 / Math.PI) * (1 / icDistance) : 0;
  }, [fourLinkCalculations]);

  // Sync pinion angle between pinionData and rideHeights when either changes
  useEffect(() => {
    if (pinionSyncEnabled && lastPinionSource === 'pinion') {
      // pinionData changed, update rideHeights
      if (rideHeights.pinionAngle !== pinionData.staticPinionAngle) {
        setRideHeights(prev => ({ ...prev, pinionAngle: pinionData.staticPinionAngle }));
      }
    }
  }, [pinionData.staticPinionAngle, pinionSyncEnabled, lastPinionSource]);

  useEffect(() => {
    if (pinionSyncEnabled && lastPinionSource === 'rideheight') {
      // rideHeights changed, update pinionData
      if (pinionData.staticPinionAngle !== rideHeights.pinionAngle) {
        setPinionData(prev => ({ ...prev, staticPinionAngle: rideHeights.pinionAngle }));
      }
    }
  }, [rideHeights.pinionAngle, pinionSyncEnabled, lastPinionSource]);

  // Handler for pinion angle changes from the Pinion tab
  const handlePinionDataChange = (newPinionData: Partial<PinionData>) => {
    setLastPinionSource('pinion');
    setPinionData(prev => ({ ...prev, ...newPinionData }));
    markChanged();
  };

  // Handler for pinion angle changes from the Ride Height tab
  const handleRideHeightPinionChange = (newAngle: number) => {
    setLastPinionSource('rideheight');
    setRideHeights(prev => ({ ...prev, pinionAngle: newAngle }));
    markChanged();
  };




  // Calculate corner weights with ballast
  const weightCalculations = useMemo(() => {
    const weights = { ...cornerWeights };
    
    ballastItems.filter(b => b.isInstalled).forEach(ballast => {
      switch (ballast.location) {
        case 'Left Front':
          weights.lf += ballast.weight;
          break;
        case 'Right Front':
          weights.rf += ballast.weight;
          break;
        case 'Left Rear':
          weights.lr += ballast.weight;
          break;
        case 'Right Rear':
          weights.rr += ballast.weight;
          break;
        case 'Center Front':
          weights.lf += ballast.weight / 2;
          weights.rf += ballast.weight / 2;
          break;
        case 'Center Rear':
          weights.lr += ballast.weight / 2;
          weights.rr += ballast.weight / 2;
          break;
      }
    });

    const totalWeight = weights.lf + weights.rf + weights.lr + weights.rr;
    const frontWeight = weights.lf + weights.rf;
    const rearWeight = weights.lr + weights.rr;
    const crossWeight = ((weights.lr + weights.rf) / totalWeight) * 100;
    const frontPercent = (frontWeight / totalWeight) * 100;
    const rearPercent = (rearWeight / totalWeight) * 100;

    return {
      ...weights,
      totalWeight,
      frontWeight,
      rearWeight,
      crossWeight,
      frontPercent,
      rearPercent
    };
  }, [cornerWeights, ballastItems]);

  // Mark changes
  const markChanged = () => {
    setHasUnsavedChanges(true);
  };

  // Save setup to database
  const saveSetup = async (saveAsNew: boolean = false) => {
    setIsSaving(true);
    try {
      const setupData = {
        name: setupName,
        description: setupDescription || null,
        race_event: raceEvent || null,
        race_date: raceDate || null,
        track_name: trackName || null,
        track_conditions: trackConditions || null,
        weather_conditions: weatherConditions || null,
        upper_bar_chassis_x: fourLink.upperBarChassisMountForward,
        upper_bar_chassis_y: fourLink.upperBarChassisMountHeight,
        upper_bar_rear_x: fourLink.upperBarRearEndMountForward,
        upper_bar_rear_y: fourLink.upperBarRearEndMountHeight,
        lower_bar_chassis_x: fourLink.lowerBarChassisMountForward,
        lower_bar_chassis_y: fourLink.lowerBarChassisMountHeight,
        lower_bar_rear_x: fourLink.lowerBarRearEndMountForward,
        lower_bar_rear_y: fourLink.lowerBarRearEndMountHeight,
        rear_end_center_height: fourLink.rearEndCenterHeight,
        instant_center_length: fourLinkCalculations.icLength,
        instant_center_height: fourLinkCalculations.icHeight,
        anti_squat_percentage: fourLinkCalculations.antiSquat,
        corner_weights: cornerWeights,
        ballast_items: ballastItems,
        total_weight: weightCalculations.totalWeight,
        cross_weight_percentage: weightCalculations.crossWeight,
        shock_settings: shockSettings,
        ride_heights: rideHeights,
        spring_data: springData,
        cg_data: cgData,
        pinion_data: pinionData,
        performance_notes: performanceNotes || null,
        sixty_foot_time: sixtyFootTime,
        eighth_mile_et: eighthMileET,
        eighth_mile_mph: eighthMileMPH,
        quarter_mile_et: quarterMileET,
        quarter_mile_mph: quarterMileMPH,
        is_favorite: isFavorite,
        updated_at: new Date().toISOString()
      };


      if (selectedSetupId && !saveAsNew) {
        // Update existing
        const { error } = await supabase
          .from('chassis_setups')
          .update(setupData)
          .eq('id', selectedSetupId);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('chassis_setups')
          .insert([setupData])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSelectedSetupId(data.id);
        }
      }

      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      setShowSaveModal(false);
      await loadSetups();
    } catch (error) {
      console.error('Error saving setup:', error);
      alert('Failed to save setup. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete setup
  const deleteSetup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setup?')) return;

    try {
      const { error } = await supabase
        .from('chassis_setups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (selectedSetupId === id) {
        setSelectedSetupId(null);
        setSetupName('New Setup');
        setFourLink(defaultFourLink);
        setCornerWeights(defaultCornerWeights);
        setBallastItems([]);
        setShockSettings(defaultShockSettings);
        setRideHeights(defaultRideHeights);
        setSpringData(defaultSpringData);
      }

      await loadSetups();
    } catch (error) {
      console.error('Error deleting setup:', error);
      alert('Failed to delete setup.');
    }
  };

  // Toggle favorite
  const toggleFavorite = async (id: string, currentFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('chassis_setups')
        .update({ is_favorite: !currentFavorite })
        .eq('id', id);

      if (error) throw error;
      
      if (selectedSetupId === id) {
        setIsFavorite(!currentFavorite);
      }
      
      await loadSetups();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Create new setup
  const createNewSetup = () => {
    setSelectedSetupId(null);
    setSetupName('New Setup');
    setRaceDate(getLocalDateString());

    setRaceEvent('');

    setTrackConditions('');
    setWeatherConditions('');
    setPerformanceNotes('');
    setSixtyFootTime(null);
    setEighthMileET(null);
    setEighthMileMPH(null);
    setQuarterMileET(null);
    setQuarterMileMPH(null);
    setIsFavorite(false);
    setFourLink(defaultFourLink);
    setCornerWeights(defaultCornerWeights);
    setBallastItems([]);
    setShockSettings(defaultShockSettings);
    setRideHeights(defaultRideHeights);
    setSpringData(defaultSpringData);
    setHasUnsavedChanges(false);
    setLastSaved(null);
  };

  // Duplicate setup
  const duplicateSetup = () => {
    setSelectedSetupId(null);
    setSetupName(`${setupName} (Copy)`);
    setHasUnsavedChanges(true);
  };

  // Ballast functions
  const toggleBallast = (ballastId: string) => {
    setBallastItems(prev => prev.map(b =>
      b.id === ballastId ? { ...b, isInstalled: !b.isInstalled } : b
    ));
    markChanged();
  };

  const handleAddBallast = () => {
    if (!newBallast.name) return;
    const id = `B-${Date.now()}`;
    setBallastItems(prev => [...prev, { ...newBallast, id }]);
    setShowBallastModal(false);
    setNewBallast({ id: '', name: '', weight: 10, location: 'Left Rear', isInstalled: true, notes: '' });
    markChanged();
  };

  const handleDeleteBallast = (ballastId: string) => {
    setBallastItems(prev => prev.filter(b => b.id !== ballastId));
    markChanged();
  };

  // Get comparison setup
  const compareSetup = useMemo(() => {
    return savedSetups.find(s => s.id === compareSetupId);
  }, [compareSetupId, savedSetups]);


  // 4-Link Plotter SVG Component - QuarterMax Universal Style
  const FourLinkPlotter = ({ settings }: { settings: FourLinkSettings }) => {
    const calc = calculateInstantCenter(settings);
    const svgWidth = 920;
    const svgHeight = 600;
    const scale = 8;
    
    // Ground line position
    const groundY = svgHeight - 70;
    
    // Axle centerline X position (right side of diagram)
    const axleCLX = 640;
    
    // Convert measurements to SVG coordinates
    // Forward from axle = LEFT in SVG (subtract from axleCLX)
    const toSvgX = (forwardFromAxle: number) => axleCLX - (forwardFromAxle * scale);
    const toSvgY = (heightFromGround: number) => groundY - (heightFromGround * scale);
    
    // Calculate mount positions in SVG coords
    const ucX = toSvgX(settings.upperBarChassisMountForward);
    const ucY = toSvgY(settings.upperBarChassisMountHeight);
    const urX = toSvgX(settings.upperBarRearEndMountForward);
    const urY = toSvgY(settings.upperBarRearEndMountHeight);
    
    const lcX = toSvgX(settings.lowerBarChassisMountForward);
    const lcY = toSvgY(settings.lowerBarChassisMountHeight);
    const lrX = toSvgX(settings.lowerBarRearEndMountForward);
    const lrY = toSvgY(settings.lowerBarRearEndMountHeight);
    
    // Calculate spreads
    const frontSpread = settings.upperBarChassisMountHeight - settings.lowerBarChassisMountHeight;
    const rearSpread = settings.upperBarRearEndMountHeight - settings.lowerBarRearEndMountHeight;
    
    // Calculate bar angles (degrees)
    const upperBarAngle = Math.atan2(
      settings.upperBarChassisMountHeight - settings.upperBarRearEndMountHeight,
      settings.upperBarChassisMountForward - settings.upperBarRearEndMountForward
    ) * (180 / Math.PI);
    
    const lowerBarAngle = Math.atan2(
      settings.lowerBarChassisMountHeight - settings.lowerBarRearEndMountHeight,
      settings.lowerBarChassisMountForward - settings.lowerBarRearEndMountForward
    ) * (180 / Math.PI);
    
    // Calculate bar slopes (rise per 10 inches)
    const upperBarSlope = ((settings.upperBarChassisMountHeight - settings.upperBarRearEndMountHeight) / 
      (settings.upperBarChassisMountForward - settings.upperBarRearEndMountForward)) * 10;
    const lowerBarSlope = ((settings.lowerBarChassisMountHeight - settings.lowerBarRearEndMountHeight) / 
      (settings.lowerBarChassisMountForward - settings.lowerBarRearEndMountForward)) * 10;

    // Helper: white value box
    const ValueBox = ({ x, y, value, width = 60, height = 22, isCalculated = false }: 
      { x: number; y: number; value: string; width?: number; height?: number; isCalculated?: boolean }) => (
      <g>
        <rect 
          x={x - width/2} y={y - height/2} 
          width={width} height={height} rx="3" 
          fill={isCalculated ? '#fef08a' : '#ffffff'} 
          stroke={isCalculated ? '#ca8a04' : '#9ca3af'} 
          strokeWidth="1.5" 
        />
        <text 
          x={x} y={y + 5} 
          fill={isCalculated ? '#92400e' : '#1e293b'} 
          fontSize="12" 
          textAnchor="middle" 
          fontFamily="monospace" 
          fontWeight="bold"
        >
          {value}
        </text>
      </g>
    );

    // Helper: crosshair mount point
    const MountPoint = ({ cx, cy, r = 8, color = '#374151' }: { cx: number; cy: number; r?: number; color?: string }) => (
      <g>
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={color} strokeWidth="1.5" />
        <line x1={cx - r - 5} y1={cy} x2={cx + r + 5} y2={cy} stroke={color} strokeWidth="1" />
        <line x1={cx} y1={cy - r - 5} x2={cx} y2={cy + r + 5} stroke={color} strokeWidth="1" />
        <circle cx={cx} cy={cy} r={2} fill={color} />
      </g>
    );

    // Draw a realistic 4-link bar (chrome tube with rod ends)
    const LinkBar = ({ x1, y1, x2, y2, color = '#4b5563' }: 
      { x1: number; y1: number; x2: number; y2: number; color?: string }) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const rodEndR = 10;
      const tubeOffset = rodEndR + 4;
      
      // Tube start/end (inset from rod ends)
      const tsx = x1 + Math.cos(angle) * tubeOffset;
      const tsy = y1 + Math.sin(angle) * tubeOffset;
      const tex = x2 - Math.cos(angle) * tubeOffset;
      const tey = y2 - Math.sin(angle) * tubeOffset;
      
      // Perpendicular for tube width
      const px = Math.sin(angle) * 5;
      const py = -Math.cos(angle) * 5;
      
      return (
        <g>
          {/* Tube body - gradient effect */}
          <line x1={tsx} y1={tsy} x2={tex} y2={tey} stroke="#1f2937" strokeWidth="14" strokeLinecap="round" />
          <line x1={tsx} y1={tsy} x2={tex} y2={tey} stroke="#4b5563" strokeWidth="11" strokeLinecap="round" />
          <line x1={tsx} y1={tsy} x2={tex} y2={tey} stroke="#6b7280" strokeWidth="7" strokeLinecap="round" />
          <line x1={tsx} y1={tsy + py * 0.3} x2={tex} y2={tey + py * 0.3} stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          
          {/* Adjustment sleeve in middle */}
          {(() => {
            const mx = (tsx + tex) / 2;
            const my = (tsy + tey) / 2;
            const sleeveLen = 30;
            const sx1 = mx - Math.cos(angle) * sleeveLen / 2;
            const sy1 = my - Math.sin(angle) * sleeveLen / 2;
            const sx2 = mx + Math.cos(angle) * sleeveLen / 2;
            const sy2 = my + Math.sin(angle) * sleeveLen / 2;
            return (
              <>
                <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#374151" strokeWidth="16" strokeLinecap="round" />
                <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#4b5563" strokeWidth="13" strokeLinecap="round" />
                {/* Knurl lines */}
                {[0.2, 0.35, 0.5, 0.65, 0.8].map((t, i) => {
                  const kx = sx1 + (sx2 - sx1) * t;
                  const ky = sy1 + (sy2 - sy1) * t;
                  return <line key={i} x1={kx - px * 1.2} y1={ky - py * 1.2} x2={kx + px * 1.2} y2={ky + py * 1.2} stroke="#374151" strokeWidth="1" />;
                })}
              </>
            );
          })()}
          
          {/* Rod ends (heim joints) */}
          <circle cx={x1} cy={y1} r={rodEndR} fill="#d4d4d8" stroke="#71717a" strokeWidth="2" />
          <circle cx={x1} cy={y1} r={4} fill="#52525b" stroke="#71717a" strokeWidth="1" />
          <circle cx={x2} cy={y2} r={rodEndR} fill="#d4d4d8" stroke="#71717a" strokeWidth="2" />
          <circle cx={x2} cy={y2} r={4} fill="#52525b" stroke="#71717a" strokeWidth="1" />
        </g>
      );
    };

    // Chassis bracket shape (left side - smaller, simpler)
    const ChassisBracket = ({ topY, bottomY, x }: { topY: number; bottomY: number; x: number }) => {
      const midY = (topY + bottomY) / 2;
      const bracketW = 30;
      const bracketH = Math.abs(bottomY - topY) + 60;
      const top = Math.min(topY, bottomY) - 30;
      
      return (
        <g>
          {/* Bracket plate */}
          <path 
            d={`M ${x - bracketW/2} ${top} 
                L ${x + bracketW/2} ${top} 
                L ${x + bracketW/2 + 8} ${top + 15}
                L ${x + bracketW/2 + 8} ${top + bracketH - 15}
                L ${x + bracketW/2} ${top + bracketH}
                L ${x - bracketW/2} ${top + bracketH}
                L ${x - bracketW/2 - 8} ${top + bracketH - 15}
                L ${x - bracketW/2 - 8} ${top + 15}
                Z`}
            fill="url(#bracketGrad)" 
            stroke="#a1a1aa" 
            strokeWidth="1.5" 
          />
          {/* Top mounting tab */}
          <rect x={x - 18} y={top - 12} width="36" height="14" rx="2" fill="url(#bracketGrad)" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx={x - 8} cy={top - 5} r="3" fill="#71717a" stroke="#52525b" strokeWidth="0.5" />
          <circle cx={x + 8} cy={top - 5} r="3" fill="#71717a" stroke="#52525b" strokeWidth="0.5" />
        </g>
      );
    };

    // Housing bracket shape (right side - larger, with lightening holes)
    const HousingBracket = ({ topY, bottomY, x }: { topY: number; bottomY: number; x: number }) => {
      const bracketW = 45;
      const bracketH = Math.abs(bottomY - topY) + 80;
      const top = Math.min(topY, bottomY) - 40;
      
      return (
        <g>
          {/* Main bracket plate - larger with distinctive shape */}
          <path 
            d={`M ${x - bracketW/2} ${top + 10} 
                Q ${x - bracketW/2} ${top} ${x - bracketW/2 + 10} ${top}
                L ${x + bracketW/2 - 10} ${top}
                Q ${x + bracketW/2} ${top} ${x + bracketW/2} ${top + 10}
                L ${x + bracketW/2 + 12} ${top + 25}
                L ${x + bracketW/2 + 12} ${top + bracketH - 25}
                L ${x + bracketW/2} ${top + bracketH - 10}
                Q ${x + bracketW/2} ${top + bracketH} ${x + bracketW/2 - 10} ${top + bracketH}
                L ${x - bracketW/2 + 10} ${top + bracketH}
                Q ${x - bracketW/2} ${top + bracketH} ${x - bracketW/2} ${top + bracketH - 10}
                L ${x - bracketW/2 - 12} ${top + bracketH - 25}
                L ${x - bracketW/2 - 12} ${top + 25}
                Z`}
            fill="url(#bracketGrad)" 
            stroke="#a1a1aa" 
            strokeWidth="1.5" 
          />
          {/* Lightening holes */}
          <circle cx={x + bracketW/2 - 5} cy={top + 18} r="6" fill="#b8b8bd" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx={x + bracketW/2 - 5} cy={top + bracketH - 18} r="6" fill="#b8b8bd" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx={x - bracketW/2 + 5} cy={top + 18} r="6" fill="#b8b8bd" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx={x - bracketW/2 + 5} cy={top + bracketH - 18} r="6" fill="#b8b8bd" stroke="#a1a1aa" strokeWidth="1" />
        </g>
      );
    };

    return (
      <div className="relative">
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="rounded-xl border border-zinc-400" style={{ background: 'linear-gradient(135deg, #d4d4d8 0%, #c4c4c8 50%, #b8b8bd 100%)' }}>
          <defs>
            {/* Bracket metal gradient */}
            <linearGradient id="bracketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4d4d8" />
              <stop offset="30%" stopColor="#c4c4c8" />
              <stop offset="70%" stopColor="#a8a8ad" />
              <stop offset="100%" stopColor="#b8b8bd" />
            </linearGradient>
            <linearGradient id="bracketGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a1a1aa" />
              <stop offset="100%" stopColor="#71717a" />
            </linearGradient>
          </defs>
          
          {/* ===== GROUND LINE ===== */}
          <line x1="40" y1={groundY} x2={axleCLX + 30} y2={groundY} stroke="#52525b" strokeWidth="2" />
          <text x="45" y={groundY + 18} fill="#52525b" fontSize="11" fontStyle="italic" fontFamily="serif">Level ground</text>
          
          {/* ===== AXLE CENTERLINE (subtle vertical dashed) ===== */}
          <line x1={axleCLX} y1={toSvgY(25)} x2={axleCLX} y2={groundY + 5} stroke="#71717a" strokeWidth="1" strokeDasharray="6,4" opacity="0.4" />
          
          {/* ===== CHASSIS BRACKETS (LEFT) ===== */}
          <ChassisBracket topY={ucY} bottomY={lcY} x={Math.min(ucX, lcX)} />
          
          {/* Mount crosshairs on chassis brackets */}
          <MountPoint cx={ucX} cy={ucY} r={7} color="#374151" />
          <MountPoint cx={lcX} cy={lcY} r={7} color="#374151" />
          
          {/* ===== HOUSING BRACKETS (RIGHT) ===== */}
          <HousingBracket topY={urY} bottomY={lrY} x={Math.max(urX, lrX)} />
          
          {/* Mount crosshairs on housing brackets */}
          <MountPoint cx={urX} cy={urY} r={7} color="#374151" />
          <MountPoint cx={lrX} cy={lrY} r={7} color="#374151" />
          
          {/* ===== 4-LINK BARS (chrome tubes with rod ends) ===== */}
          <LinkBar x1={ucX} y1={ucY} x2={urX} y2={urY} />
          <LinkBar x1={lcX} y1={lcY} x2={lrX} y2={lrY} />
          
          {/* ===== DIMENSION LINES & LABELS ===== */}
          
          {/* --- Upper bar: Distance forward of axle centerline --- */}
          {(() => {
            const labelY = Math.min(ucY, urY) - 70;
            return (
              <g>
                {/* Vertical leader from upper rear mount to label area */}
                <line x1={urX} y1={urY - 15} x2={urX} y2={labelY + 20} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
                <line x1={axleCLX} y1={urY - 15} x2={axleCLX} y2={labelY + 20} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
                {/* Horizontal dimension line */}
                <line x1={urX} y1={labelY + 15} x2={axleCLX} y2={labelY + 15} stroke="#3b82f6" strokeWidth="1" />
                {/* Arrowheads */}
                <polygon points={`${urX},${labelY + 15} ${urX + 6},${labelY + 12} ${urX + 6},${labelY + 18}`} fill="#3b82f6" />
                <polygon points={`${axleCLX},${labelY + 15} ${axleCLX - 6},${labelY + 12} ${axleCLX - 6},${labelY + 18}`} fill="#3b82f6" />
                {/* Label */}
                <text x={(urX + axleCLX) / 2} y={labelY - 8} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
                  Distance forward of axle centerline
                </text>
                <text x={(urX + axleCLX) / 2} y={labelY + 2} fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="sans-serif" fontStyle="italic">
                  ( - if behind centerline)
                </text>
                {/* Value box */}
                <ValueBox x={(urX + axleCLX) / 2} y={labelY + 15} value={settings.upperBarRearEndMountForward.toFixed(3)} width={65} />
              </g>
            );
          })()}
          
          {/* --- Upper Bar Length --- */}
          {(() => {
            const midX = (ucX + urX) / 2;
            const midY = (ucY + urY) / 2 - 30;
            return (
              <g>
                <text x={midX} y={midY - 15} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Upper Bar Length</text>
                <ValueBox x={midX} y={midY} value={calc.upperBarLength.toFixed(3)} width={70} />
              </g>
            );
          })()}
          
          {/* --- Front Spread (left side) --- */}
          {(() => {
            const dimX = Math.min(ucX, lcX) - 55;
            return (
              <g>
                {/* Vertical dimension line */}
                <line x1={dimX + 10} y1={ucY} x2={dimX + 10} y2={lcY} stroke="#3b82f6" strokeWidth="1" />
                {/* Horizontal ticks */}
                <line x1={dimX + 5} y1={ucY} x2={ucX - 20} y2={ucY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1={dimX + 5} y1={lcY} x2={lcX - 20} y2={lcY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                {/* Arrowheads */}
                <polygon points={`${dimX + 10},${ucY} ${dimX + 7},${ucY + 6} ${dimX + 13},${ucY + 6}`} fill="#3b82f6" />
                <polygon points={`${dimX + 10},${lcY} ${dimX + 7},${lcY - 6} ${dimX + 13},${lcY - 6}`} fill="#3b82f6" />
                {/* Label */}
                <text x={dimX - 25} y={(ucY + lcY) / 2 - 15} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif" 
                      transform={`rotate(-90, ${dimX - 25}, ${(ucY + lcY) / 2})`}>
                  Front Spread
                </text>
                {/* Value box */}
                <ValueBox x={dimX - 25} y={(ucY + lcY) / 2 + 15} value={frontSpread.toFixed(3)} width={60} />
              </g>
            );
          })()}
          
          {/* --- Rear Spread (right side) --- */}
          {(() => {
            const dimX = Math.max(urX, lrX) + 55;
            const midDimY = (urY + lrY) / 2;
            return (
              <g>
                {/* Vertical dimension line */}
                <line x1={dimX - 10} y1={urY} x2={dimX - 10} y2={lrY} stroke="#3b82f6" strokeWidth="1" />
                {/* Horizontal ticks */}
                <line x1={Math.max(urX, lrX) + 20} y1={urY} x2={dimX - 15} y2={urY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1={Math.max(urX, lrX) + 20} y1={lrY} x2={dimX - 15} y2={lrY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                {/* Arrowheads */}
                <polygon points={`${dimX - 10},${urY} ${dimX - 13},${urY + 6} ${dimX - 7},${urY + 6}`} fill="#3b82f6" />
                <polygon points={`${dimX - 10},${lrY} ${dimX - 13},${lrY - 6} ${dimX - 7},${lrY - 6}`} fill="#3b82f6" />
                {/* Label */}
                <text x={dimX + 15} y={midDimY - 15} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Rear Spread</text>
                {/* Value box */}
                <ValueBox x={dimX + 15} y={midDimY} value={rearSpread.toFixed(3)} width={65} />
              </g>
            );
          })()}
          
          {/* --- Lower bar: Distance forward of axle centerline --- */}
          {(() => {
            const labelY = Math.max(lcY, lrY) + 55;
            return (
              <g>
                {/* Vertical leaders */}
                <line x1={lrX} y1={lrY + 15} x2={lrX} y2={labelY - 15} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
                <line x1={axleCLX} y1={lrY + 15} x2={axleCLX} y2={labelY - 15} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
                {/* Horizontal dimension line */}
                <line x1={lrX} y1={labelY - 10} x2={axleCLX} y2={labelY - 10} stroke="#3b82f6" strokeWidth="1" />
                {/* Arrowheads */}
                <polygon points={`${lrX},${labelY - 10} ${lrX + 6},${labelY - 13} ${lrX + 6},${labelY - 7}`} fill="#3b82f6" />
                <polygon points={`${axleCLX},${labelY - 10} ${axleCLX - 6},${labelY - 13} ${axleCLX - 6},${labelY - 7}`} fill="#3b82f6" />
                {/* Label */}
                <text x={(lrX + axleCLX) / 2} y={labelY + 8} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
                  Distance forward of axle centerline
                </text>
                <text x={(lrX + axleCLX) / 2} y={labelY + 19} fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="sans-serif" fontStyle="italic">
                  ( - if behind centerline)
                </text>
                {/* Value box */}
                <ValueBox x={(lrX + axleCLX) / 2} y={labelY - 10} value={settings.lowerBarRearEndMountForward.toFixed(3)} width={65} />
              </g>
            );
          })()}
          
          {/* --- Lower Bar Length --- */}
          {(() => {
            const midX = (lcX + lrX) / 2;
            const midY = (lcY + lrY) / 2 + 35;
            return (
              <g>
                <ValueBox x={midX} y={midY} value={calc.lowerBarLength.toFixed(3)} width={70} />
                <text x={midX} y={midY + 20} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Lower Bar Length</text>
              </g>
            );
          })()}
          
          {/* --- Front Height (from ground to lower chassis mount) --- */}
          {(() => {
            const dimX = Math.min(ucX, lcX) - 10;
            return (
              <g>
                {/* Vertical dashed line from lower chassis mount to ground */}
                <line x1={dimX} y1={lcY} x2={dimX} y2={groundY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                {/* Label and value */}
                <text x={dimX} y={groundY + 18} fill="#374151" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Front Height</text>
                <ValueBox x={dimX} y={groundY + 33} value={settings.lowerBarChassisMountHeight.toFixed(3)} width={60} />
              </g>
            );
          })()}
          
          {/* --- Rear Height (from ground to lower housing mount) --- */}
          {(() => {
            const dimX = Math.max(urX, lrX) + 10;
            return (
              <g>
                {/* Vertical dashed line from lower housing mount to ground */}
                <line x1={dimX} y1={lrY} x2={dimX} y2={groundY} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3,3" />
                {/* Label and value */}
                <text x={dimX + 5} y={groundY + 18} fill="#374151" fontSize="10" textAnchor="start" fontFamily="sans-serif">Rear Height</text>
                <ValueBox x={dimX + 30} y={groundY + 33} value={settings.lowerBarRearEndMountHeight.toFixed(3)} width={60} />
              </g>
            );
          })()}
          
          {/* --- Lower Bar Angle (yellow calculated box) --- */}
          {(() => {
            const bx = (lcX + lrX) / 2 - 60;
            const by = groundY + 33;
            return (
              <g>
                <ValueBox x={bx} y={by} value={lowerBarAngle.toFixed(2)} width={55} isCalculated={true} />
                <text x={bx} y={by + 20} fill="#374151" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Lower Bar Angle</text>
              </g>
            );
          })()}
          
          {/* --- Lower Bar Slope (yellow calculated box) --- */}
          {(() => {
            const bx = (lcX + lrX) / 2 + 60;
            const by = groundY + 33;
            return (
              <g>
                <ValueBox x={bx} y={by} value={lowerBarSlope.toFixed(3)} width={55} isCalculated={true} />
                <text x={bx} y={by + 20} fill="#374151" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Lower Bar Slope</text>
              </g>
            );
          })()}
          
          {/* --- Upper Bar Angle (yellow calculated box) --- */}
          {(() => {
            const bx = (ucX + urX) / 2 - 70;
            const by = Math.min(ucY, urY) - 35;
            return (
              <g>
                <ValueBox x={bx} y={by} value={upperBarAngle.toFixed(2)} width={55} isCalculated={true} />
                <text x={bx} y={by - 16} fill="#374151" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Upper Bar Angle</text>
              </g>
            );
          })()}
          
          {/* ===== INSTANT CENTER BOX (top-left) ===== */}
          <g>
            <rect x="30" y="20" width="155" height="65" rx="4" fill="#ffffff" stroke="#9ca3af" strokeWidth="1.5" />
            {/* Title */}
            <text x="107" y="38" fill="#374151" fontSize="12" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">Instant Center</text>
            {/* Divider */}
            <line x1="30" y1="44" x2="185" y2="44" stroke="#d4d4d8" strokeWidth="1" />
            {/* Column headers */}
            <text x="72" y="57" fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Length</text>
            <text x="147" y="57" fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Height</text>
            {/* Column divider */}
            <line x1="107" y1="44" x2="107" y2="85" stroke="#d4d4d8" strokeWidth="1" />
            {/* Values */}
            <text x="72" y="76" fill="#1e293b" fontSize="14" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
              {calc.icLength !== Infinity ? calc.icLength.toFixed(2) : '---'}
            </text>
            <text x="147" y="76" fill="#1e293b" fontSize="14" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
              {calc.icHeight !== Infinity ? calc.icHeight.toFixed(2) : '---'}
            </text>
          </g>
          
          {/* ===== ANTI-SQUAT BOX (top-right area) ===== */}
          <g>
            <rect x={svgWidth - 175} y="20" width="145" height="45" rx="4" fill="#ffffff" stroke="#9ca3af" strokeWidth="1.5" />
            <text x={svgWidth - 102} y="38" fill="#374151" fontSize="11" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">Anti-Squat</text>
            <text x={svgWidth - 102} y="57" fill={calc.antiSquat >= 100 && calc.antiSquat <= 150 ? '#16a34a' : calc.antiSquat > 0 ? '#ca8a04' : '#dc2626'} 
                  fontSize="16" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
              {calc.antiSquat.toFixed(1)}%
            </text>
          </g>
          
          {/* ===== INSTRUCTION TEXT (bottom) ===== */}
          <text x={svgWidth / 2} y={svgHeight - 12} fill="#dc2626" fontSize="12" textAnchor="middle" fontFamily="sans-serif" fontStyle="italic">
            <tspan fontWeight="bold" fill="#dc2626">Enter data</tspan>
            <tspan fill="#374151"> in each of the white boxes:</tspan>
          </text>
          
        </svg>
      </div>
    );
  };









  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-[1920px] mx-auto flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading chassis setups...</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              Chassis Setup
              {hasUnsavedChanges && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Unsaved Changes</span>
              )}
            </h2>
            <p className="text-slate-400">4-Link geometry, weight distribution, shocks, and suspension settings</p>
            {lastSaved && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Last saved: {lastSaved.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={createNewSetup}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              <Database className="w-4 h-4" />
              Load
            </button>
            <button
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30"
            >
              <GitCompare className="w-4 h-4" />
              Compare
            </button>
            <button
              onClick={duplicateSetup}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Setup Info Card */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Setup Name</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => { setSetupName(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Race Event</label>
              <input
                type="text"
                value={raceEvent}
                onChange={(e) => { setRaceEvent(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="e.g., NHRA Bristol"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Track Name</label>
              <input
                type="text"
                value={trackName}
                onChange={(e) => { setTrackName(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="e.g., Bristol Dragway"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <DateInputDark
                value={raceDate}
                onChange={(e) => { setRaceDate(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />

            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Track Conditions</label>
              <select
                value={trackConditions}
                onChange={(e) => { setTrackConditions(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="">Select...</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Slick">Slick</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Weather</label>
              <select
                value={weatherConditions}
                onChange={(e) => { setWeatherConditions(e.target.value); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              >
                <option value="">Select...</option>
                <option value="Hot & Dry">Hot & Dry</option>
                <option value="Warm">Warm</option>
                <option value="Cool">Cool</option>
                <option value="Cold">Cold</option>
                <option value="Humid">Humid</option>
                <option value="Overcast">Overcast</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setIsFavorite(!isFavorite); markChanged(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isFavorite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                {isFavorite ? 'Favorite' : 'Mark as Favorite'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: '4link', label: '4-Link Plotter', icon: Target },
            { id: 'recommendations', label: 'Setup Advisor', icon: Lightbulb },
            { id: 'cg', label: 'CG Calculator', icon: Crosshair },
            { id: 'pinion', label: 'Pinion Angle', icon: Compass },
            { id: 'weight', label: 'Weight & Ballast', icon: Scale },
            { id: 'shocks', label: 'Shock Settings', icon: Gauge },
            { id: 'rideheight', label: 'Ride Height', icon: ArrowUpDown },
            { id: 'springs', label: 'Coil Springs', icon: Ruler }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ChassisTab)}

              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? tab.id === 'recommendations' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' 
                    : 'bg-orange-500 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>




        {/* 4-Link Tab */}
        {activeTab === '4link' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-400" />
                  4-Link Geometry Visualization
                </h3>
                <button
                  onClick={() => setShowPresetsModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
                >
                  <BookOpen className="w-4 h-4" />
                  Load Preset
                </button>
              </div>
              <FourLinkPlotter settings={fourLink} />

              {fourLinkCalculations && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">IC Length</p>
                    <p className="text-2xl font-bold text-orange-400">{fourLinkCalculations.icLength.toFixed(1)}"</p>
                    <p className="text-xs text-slate-500">from rear axle</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">IC Height</p>
                    <p className="text-2xl font-bold text-blue-400">{fourLinkCalculations.icHeight.toFixed(1)}"</p>
                    <p className="text-xs text-slate-500">from ground</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Anti-Squat</p>
                    <p className={`text-2xl font-bold ${
                      fourLinkCalculations.antiSquat >= 100 && fourLinkCalculations.antiSquat <= 150 
                        ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {fourLinkCalculations.antiSquat.toFixed(0)}%
                    </p>
                  </div>
                </div>
              )}
              
              {/* Pinion Angle Sync Info */}
              <div className="mt-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg p-4 border border-orange-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-orange-400" />
                    <span className="font-medium text-white">Pinion Angle Impact</span>
                    {pinionSyncEnabled && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Synced</span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('pinion')}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    View Details <ChevronUp className="w-3 h-3 rotate-90" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Static Pinion</p>
                    <p className="text-lg font-bold text-orange-400">{pinionData.staticPinionAngle.toFixed(1)}°</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Angle Change Rate</p>
                    <p className="text-lg font-bold text-blue-400">{pinionAngleChangeRate.toFixed(3)}°/in</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">At Full Compression</p>
                    <p className="text-lg font-bold text-green-400">
                      {(pinionData.staticPinionAngle + (pinionData.maxCompression * pinionAngleChangeRate)).toFixed(1)}°
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  Based on IC position ({fourLinkCalculations.icLength.toFixed(1)}" length, {fourLinkCalculations.icHeight.toFixed(1)}" height), 
                  the pinion angle changes {pinionAngleChangeRate.toFixed(3)}° per inch of suspension travel.
                </p>
              </div>
            </div>

            <div className="space-y-4">

              {/* Bracket Selector Buttons */}
              <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-orange-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-orange-400" />
                    <div>
                      <h4 className="font-medium text-white">Rear End Mount Brackets</h4>
                      <p className="text-xs text-slate-400">Select brackets to auto-populate mount positions</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowBracketSelector(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
                  >
                    <Wrench className="w-4 h-4" />
                    Strange Engineering
                  </button>
                  <button
                    onClick={() => setShowQuartermaxBracketSelector(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25"
                  >
                    <Zap className="w-4 h-4" />
                    Quartermax
                  </button>
                </div>
              </div>



              <div className="bg-slate-800/50 rounded-xl border border-blue-500/30 p-4">

                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-blue-400 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    Upper Bar Settings
                  </h4>
                  <div className="text-sm text-blue-300 bg-blue-500/20 px-2 py-1 rounded">

                    Length: {fourLinkCalculations.upperBarLength.toFixed(2)}"
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Chassis Mount Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.upperBarChassisMountHeight}
                        onChange={(e) => { setFourLink({ ...fourLink, upperBarChassisMountHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Chassis Mount Forward</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.upperBarChassisMountForward}
                        onChange={(e) => { setFourLink({ ...fourLink, upperBarChassisMountForward: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear End Mount Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.upperBarRearEndMountHeight}
                        onChange={(e) => { setFourLink({ ...fourLink, upperBarRearEndMountHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear End Mount Forward</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.upperBarRearEndMountForward}
                        onChange={(e) => { setFourLink({ ...fourLink, upperBarRearEndMountForward: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-green-500/30 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-green-400 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    Lower Bar Settings
                  </h4>
                  <div className="text-sm text-green-300 bg-green-500/20 px-2 py-1 rounded">
                    Length: {fourLinkCalculations.lowerBarLength.toFixed(2)}"
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Chassis Mount Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.lowerBarChassisMountHeight}
                        onChange={(e) => { setFourLink({ ...fourLink, lowerBarChassisMountHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Chassis Mount Forward</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.lowerBarChassisMountForward}
                        onChange={(e) => { setFourLink({ ...fourLink, lowerBarChassisMountForward: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear End Mount Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.lowerBarRearEndMountHeight}
                        onChange={(e) => { setFourLink({ ...fourLink, lowerBarRearEndMountHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear End Mount Forward</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.lowerBarRearEndMountForward}
                        onChange={(e) => { setFourLink({ ...fourLink, lowerBarRearEndMountForward: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <h4 className="font-medium text-white mb-4">Vehicle Specifications</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Wheelbase</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        value={fourLink.wheelbase}
                        onChange={(e) => { setFourLink({ ...fourLink, wheelbase: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear End Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.rearEndCenterHeight}
                        onChange={(e) => { setFourLink({ ...fourLink, rearEndCenterHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Front Tire Radius</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.frontTireRadius}
                        onChange={(e) => { setFourLink({ ...fourLink, frontTireRadius: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Rear Tire Radius</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={fourLink.rearTireRadius}
                        onChange={(e) => { setFourLink({ ...fourLink, rearTireRadius: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                      <span className="text-slate-500 text-sm">in</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CG Calculator Tab */}
        {activeTab === 'cg' && (() => {
          // CG Height Calculation using the lifting method
          // Formula: CG Height = (Wheelbase × ΔRearWeight) / (TotalWeight × tan(θ)) + RearAxleHeight
          // Where θ is the angle created by lifting the front
          const totalWeight = cgData.levelFrontWeight + cgData.levelRearWeight;
          const deltaRearWeight = cgData.liftedRearWeight - cgData.levelRearWeight;
          const liftAngleRad = Math.atan(cgData.frontLiftHeight / fourLink.wheelbase);
          const tanAngle = Math.tan(liftAngleRad);
          
          let cgHeight = 0;
          if (tanAngle > 0 && totalWeight > 0) {
            cgHeight = ((fourLink.wheelbase * deltaRearWeight) / (totalWeight * tanAngle)) + cgData.rearAxleHeight;
          }
          
          // CG distance from rear axle (horizontal)
          const cgDistanceFromRear = (cgData.levelFrontWeight / totalWeight) * fourLink.wheelbase;
          
          // Weight transfer calculations
          const gForce = 1.5; // Typical launch G-force for drag car
          const weightTransferDuringLaunch = (totalWeight * cgHeight * gForce) / fourLink.wheelbase;
          const rearWeightAtLaunch = cgData.levelRearWeight + weightTransferDuringLaunch;
          const rearWeightPercentAtLaunch = (rearWeightAtLaunch / totalWeight) * 100;
          
          return (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* CG Visualization */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Crosshair className="w-5 h-5 text-orange-400" />
                  Center of Gravity Visualization
                </h3>
                
                {/* CG Visualization SVG */}
                <svg width="100%" height="280" viewBox="0 0 700 280" className="bg-slate-900 rounded-lg">
                  <defs>
                    <pattern id="cgGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
                    </pattern>
                    <linearGradient id="cgBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#475569" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                  </defs>
                  
                  <rect width="100%" height="100%" fill="url(#cgGrid)" />
                  
                  {/* Ground line */}
                  <line x1="20" y1="240" x2="680" y2="240" stroke="#64748b" strokeWidth="3" />
                  
                  {/* Car body outline */}
                  <rect x="120" y="140" width="450" height="60" rx="8" fill="url(#cgBodyGradient)" stroke="#64748b" strokeWidth="2" />
                  
                  {/* Roof */}
                  <path d="M 200 140 Q 220 100 280 100 L 400 100 Q 460 100 480 140" fill="url(#cgBodyGradient)" stroke="#64748b" strokeWidth="2" />
                  
                  {/* Front tire */}
                  <circle cx="180" cy="220" r="35" fill="#374151" stroke="#4b5563" strokeWidth="4" />
                  <circle cx="180" cy="220" r="15" fill="#4b5563" />
                  
                  {/* Rear tire */}
                  <circle cx="510" cy="210" r="45" fill="#374151" stroke="#4b5563" strokeWidth="5" />
                  <circle cx="510" cy="210" r="20" fill="#4b5563" />
                  
                  {/* CG marker */}
                  {cgHeight > 0 && (
                    <>
                      {/* CG position calculation for SVG */}
                      {(() => {
                        const scale = 2.5;
                        const rearAxleX = 510;
                        const groundY = 240;
                        const cgX = rearAxleX - (cgDistanceFromRear * scale);
                        const cgY = groundY - (cgHeight * scale);
                        
                        return (
                          <>
                            {/* Vertical line from CG to ground */}
                            <line x1={cgX} y1={cgY} x2={cgX} y2={groundY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
                            
                            {/* Horizontal line from CG to rear axle */}
                            <line x1={cgX} y1={cgY} x2={rearAxleX} y2={cgY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" />
                            
                            {/* CG marker */}
                            <circle cx={cgX} cy={cgY} r={12} fill="#ef4444" stroke="#fff" strokeWidth="2" />
                            <text x={cgX} y={cgY + 4} fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">CG</text>
                            
                            {/* CG height label */}
                            <text x={cgX + 20} y={(cgY + groundY) / 2} fill="#ef4444" fontSize="10" textAnchor="start">
                              {cgHeight.toFixed(1)}"
                            </text>
                            
                            {/* CG distance from rear label */}
                            <text x={(cgX + rearAxleX) / 2} y={cgY - 10} fill="#3b82f6" fontSize="10" textAnchor="middle">
                              {cgDistanceFromRear.toFixed(1)}" from rear
                            </text>
                            
                            {/* IC marker if available */}
                            {fourLinkCalculations.icLength < 500 && (
                              <>
                                {(() => {
                                  const icX = rearAxleX + (fourLinkCalculations.icLength * scale);
                                  const icY = groundY - (fourLinkCalculations.icHeight * scale);
                                  
                                  // Line from CG to IC
                                  return (
                                    <>
                                      <line x1={cgX} y1={cgY} x2={Math.min(icX, 680)} y2={icY} stroke="#f97316" strokeWidth="1" strokeDasharray="6,4" opacity="0.5" />
                                      {icX < 680 && (
                                        <>
                                          <circle cx={icX} cy={icY} r={8} fill="#f97316" stroke="#fff" strokeWidth="1" />
                                          <text x={icX} y={icY - 12} fill="#f97316" fontSize="9" textAnchor="middle">IC</text>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                  
                  {/* Legend */}
                  <rect x="10" y="10" width="130" height="65" fill="#1e293b" rx="6" stroke="#334155" strokeWidth="1" />
                  <circle cx="25" cy="28" r={6} fill="#ef4444" />
                  <text x="38" y="32" fill="#94a3b8" fontSize="10">Center of Gravity</text>
                  <circle cx="25" cy="48" r={5} fill="#f97316" />
                  <text x="38" y="52" fill="#94a3b8" fontSize="10">Instant Center</text>
                  <line x1="18" y1="65" x2="32" y2="65" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3,2" />
                  <text x="38" y="69" fill="#94a3b8" fontSize="10">CG Distance</text>
                </svg>
                
                {/* Results Grid */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-red-500/30">
                    <p className="text-xs text-slate-500 mb-1">CG Height</p>
                    <p className="text-3xl font-bold text-red-400">{cgHeight > 0 ? cgHeight.toFixed(2) : '--'}"</p>
                    <p className="text-xs text-slate-500">from ground</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-blue-500/30">
                    <p className="text-xs text-slate-500 mb-1">CG Distance</p>
                    <p className="text-3xl font-bold text-blue-400">{cgDistanceFromRear > 0 ? cgDistanceFromRear.toFixed(1) : '--'}"</p>
                    <p className="text-xs text-slate-500">from rear axle</p>
                  </div>
                </div>
              </div>
              
              {/* Input Fields and Weight Transfer */}
              <div className="space-y-4">
                {/* Measurement Inputs */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-orange-400" />
                    CG Measurement Data (Lifting Method)
                  </h4>
                  
                  <div className="bg-slate-900/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-slate-400">
                      <Info className="w-3 h-3 inline mr-1" />
                      To measure CG height: Scale the car level, then lift the front to a known height and measure rear weight change.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Level Front Weight</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={cgData.levelFrontWeight}
                          onChange={(e) => { setCgData({ ...cgData, levelFrontWeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">lbs</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Level Rear Weight</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={cgData.levelRearWeight}
                          onChange={(e) => { setCgData({ ...cgData, levelRearWeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">lbs</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Front Lift Height</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={cgData.frontLiftHeight}
                          onChange={(e) => { setCgData({ ...cgData, frontLiftHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Lifted Rear Weight</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={cgData.liftedRearWeight}
                          onChange={(e) => { setCgData({ ...cgData, liftedRearWeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">lbs</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Rear Axle Height</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          value={cgData.rearAxleHeight}
                          onChange={(e) => { setCgData({ ...cgData, rearAxleHeight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Wheelbase</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={fourLink.wheelbase}
                          onChange={(e) => { setFourLink({ ...fourLink, wheelbase: parseFloat(e.target.value) || 0 }); markChanged(); }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Weight Transfer Calculations */}
                <div className="bg-slate-800/50 rounded-xl border border-green-500/30 p-4">
                  <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Weight Transfer Analysis
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Total Vehicle Weight</span>
                      <span className="text-white font-bold">{totalWeight.toFixed(0)} lbs</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Static Rear Weight %</span>
                      <span className="text-white font-bold">{((cgData.levelRearWeight / totalWeight) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Weight Shift (when lifted)</span>
                      <span className="text-yellow-400 font-bold">+{deltaRearWeight.toFixed(0)} lbs</span>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-3 mt-3">
                      <p className="text-xs text-slate-500 mb-2">At {gForce}G Launch:</p>
                      <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                        <span className="text-slate-400">Weight Transfer</span>
                        <span className="text-green-400 font-bold">+{weightTransferDuringLaunch.toFixed(0)} lbs</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/30 mt-2">
                        <span className="text-slate-400">Rear Weight at Launch</span>
                        <span className="text-green-400 font-bold">{rearWeightAtLaunch.toFixed(0)} lbs ({rearWeightPercentAtLaunch.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* CG Tips */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    CG Height Guidelines
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">•</span>
                      Lower CG = Less weight transfer, better for traction-limited cars
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">•</span>
                      Higher CG = More weight transfer, better for power-limited cars
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">•</span>
                      Typical Pro Mod CG: 18-22" from ground
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">•</span>
                      CG affects anti-squat effectiveness and launch characteristics
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pinion Angle Calculator Tab */}
        {activeTab === 'pinion' && (() => {
          // Calculate pinion angle changes through suspension travel
          // Based on 4-link geometry and IC location
          
          // Calculate pinion angle change per inch of travel
          // The rear end rotates around the IC as the suspension moves
          const icLength = fourLinkCalculations.icLength;
          const icHeight = fourLinkCalculations.icHeight;
          
          // Distance from rear axle center to IC
          const icDistance = Math.sqrt(icLength * icLength + icHeight * icHeight);
          
          // Calculate angle change per inch of travel
          // As the rear end moves up/down, it rotates around the IC
          const angleChangePerInch = icDistance > 0 ? (180 / Math.PI) * (1 / icDistance) : 0;
          
          // Current travel position
          const travelInches = (suspensionPosition / 100) * (suspensionPosition >= 0 ? pinionData.maxCompression : pinionData.maxExtension);
          
          // Calculate pinion angle at current position
          const pinionAngleAtPosition = pinionData.staticPinionAngle + (travelInches * angleChangePerInch);
          
          // Calculate U-joint operating angle (difference between trans angle and pinion angle)
          const uJointAngle = Math.abs(pinionData.transmissionAngle - pinionAngleAtPosition);
          
          // Calculate angles at full compression and extension
          const pinionAtFullCompression = pinionData.staticPinionAngle + (pinionData.maxCompression * angleChangePerInch);
          const pinionAtFullExtension = pinionData.staticPinionAngle - (pinionData.maxExtension * angleChangePerInch);
          
          // Recommended pinion angles based on track conditions
          const recommendations = {
            sticky: { angle: -3.0, description: 'More negative for aggressive launches on sticky tracks' },
            moderate: { angle: -2.0, description: 'Balanced setting for most conditions' },
            slick: { angle: -1.0, description: 'Less negative to reduce tire shock on slick tracks' }
          };
          
          const currentRecommendation = recommendations[pinionData.trackCondition];
          
          // Optimal pinion angle based on IC and expected travel
          // Goal: minimize U-joint angle change through travel
          const optimalStaticPinion = pinionData.transmissionAngle - (angleChangePerInch * pinionData.maxCompression / 2);
          
          return (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Pinion Angle Visualization */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-orange-400" />
                  Pinion Angle Through Travel
                </h3>
                
                {/* Visualization SVG */}
                <svg width="100%" height="320" viewBox="0 0 700 320" className="bg-slate-900 rounded-lg">
                  <defs>
                    <pattern id="pinionGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
                    </pattern>
                    <linearGradient id="driveshaftGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                  
                  <rect width="100%" height="100%" fill="url(#pinionGrid)" />
                  
                  {/* Ground reference line */}
                  <line x1="50" y1="280" x2="650" y2="280" stroke="#64748b" strokeWidth="2" />
                  <text x="60" y="295" fill="#64748b" fontSize="10">Ground</text>
                  
                  {/* Transmission representation */}
                  <rect x="100" y="120" width="80" height="50" rx="6" fill="#475569" stroke="#64748b" strokeWidth="2" />
                  <text x="140" y="150" fill="#94a3b8" fontSize="10" textAnchor="middle">Trans</text>
                  <text x="140" y="165" fill="#f97316" fontSize="9" textAnchor="middle">{pinionData.transmissionAngle.toFixed(1)}°</text>
                  
                  {/* Transmission output angle indicator */}
                  <line 
                    x1="180" 
                    y1="145" 
                    x2="220" 
                    y2={145 - Math.tan(pinionData.transmissionAngle * Math.PI / 180) * 40}
                    stroke="#3b82f6" 
                    strokeWidth="3" 
                    strokeLinecap="round"
                  />
                  
                  {/* Driveshaft at different positions */}
                  {[-1, 0, 1].map((pos, idx) => {
                    const travel = pos * (pos >= 0 ? pinionData.maxCompression : pinionData.maxExtension);
                    const angle = pinionData.staticPinionAngle + (travel * angleChangePerInch);
                    const rearEndY = 145 + (pos * 25);
                    const opacity = pos === 0 ? 1 : 0.4;
                    const color = pos === 0 ? '#f97316' : pos > 0 ? '#22c55e' : '#ef4444';
                    const label = pos === 0 ? 'Static' : pos > 0 ? 'Compressed' : 'Extended';
                    
                    // Driveshaft line
                    const dsLength = pinionData.driveshaftLength * 3.5;
                    const dsEndX = 180 + dsLength * Math.cos(angle * Math.PI / 180);
                    const dsEndY = rearEndY - dsLength * Math.sin(angle * Math.PI / 180);
                    
                    return (
                      <g key={idx} opacity={opacity}>
                        {/* Driveshaft */}
                        <line 
                          x1="180" 
                          y1={145 - Math.tan(pinionData.transmissionAngle * Math.PI / 180) * 35}
                          x2={dsEndX} 
                          y2={dsEndY}
                          stroke={color} 
                          strokeWidth={pos === 0 ? 8 : 5} 
                          strokeLinecap="round"
                        />
                        
                        {/* Rear end housing */}
                        <rect 
                          x={dsEndX - 10} 
                          y={dsEndY - 15} 
                          width={60} 
                          height={30} 
                          rx="4" 
                          fill="#374151" 
                          stroke={color} 
                          strokeWidth="2"
                        />
                        
                        {/* Pinion angle label */}
                        <text x={dsEndX + 65} y={dsEndY + 5} fill={color} fontSize="11" fontWeight="bold">
                          {angle.toFixed(1)}°
                        </text>
                        
                        {/* Position label */}
                        <text x={dsEndX + 65} y={dsEndY + 18} fill="#94a3b8" fontSize="9">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Current position indicator based on slider */}
                  {suspensionPosition !== 0 && (() => {
                    const travel = travelInches;
                    const angle = pinionAngleAtPosition;
                    const yOffset = (suspensionPosition / 100) * 25;
                    const rearEndY = 145 + yOffset;
                    const dsLength = pinionData.driveshaftLength * 3.5;
                    const dsEndX = 180 + dsLength * Math.cos(angle * Math.PI / 180);
                    const dsEndY = rearEndY - dsLength * Math.sin(angle * Math.PI / 180);
                    
                    return (
                      <g>
                        <line 
                          x1="180" 
                          y1={145 - Math.tan(pinionData.transmissionAngle * Math.PI / 180) * 35}
                          x2={dsEndX} 
                          y2={dsEndY}
                          stroke="#a855f7" 
                          strokeWidth={6} 
                          strokeLinecap="round"
                        />
                        <circle cx={dsEndX + 20} cy={dsEndY} r={8} fill="#a855f7" />
                        <text x={dsEndX + 35} y={dsEndY + 4} fill="#a855f7" fontSize="12" fontWeight="bold">
                          {angle.toFixed(2)}°
                        </text>
                      </g>
                    );
                  })()}
                  
                  {/* Legend */}
                  <rect x="10" y="10" width="140" height="95" fill="#1e293b" rx="6" stroke="#334155" strokeWidth="1" />
                  <line x1="20" y1="28" x2="40" y2="28" stroke="#ef4444" strokeWidth="4" />
                  <text x="48" y="32" fill="#94a3b8" fontSize="10">Full Extension</text>
                  <line x1="20" y1="48" x2="40" y2="48" stroke="#f97316" strokeWidth="4" />
                  <text x="48" y="52" fill="#94a3b8" fontSize="10">Static Position</text>
                  <line x1="20" y1="68" x2="40" y2="68" stroke="#22c55e" strokeWidth="4" />
                  <text x="48" y="72" fill="#94a3b8" fontSize="10">Full Compression</text>
                  <line x1="20" y1="88" x2="40" y2="88" stroke="#a855f7" strokeWidth="4" />
                  <text x="48" y="92" fill="#94a3b8" fontSize="10">Current Position</text>
                  
                  {/* Angle change info */}
                  <rect x="530" y="10" width="160" height="55" fill="#1e293b" rx="6" stroke="#334155" strokeWidth="1" />
                  <text x="545" y="30" fill="#94a3b8" fontSize="10">Angle Change Rate:</text>
                  <text x="545" y="48" fill="#f97316" fontSize="14" fontWeight="bold">{angleChangePerInch.toFixed(2)}° / inch</text>
                </svg>
                
                {/* Suspension Position Slider */}
                <div className="mt-4 bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Suspension Position</span>
                    <span className="text-sm font-bold text-white">
                      {travelInches > 0 ? '+' : ''}{travelInches.toFixed(2)}" ({suspensionPosition > 0 ? 'Compressed' : suspensionPosition < 0 ? 'Extended' : 'Static'})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={suspensionPosition}
                    onChange={(e) => setSuspensionPosition(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Full Extension (-{pinionData.maxExtension}")</span>
                    <span>Static</span>
                    <span>Full Compression (+{pinionData.maxCompression}")</span>
                  </div>
                </div>
                
                {/* Results Grid */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-orange-500/30">
                    <p className="text-xs text-slate-500 mb-1">Current Pinion</p>
                    <p className="text-xl font-bold text-orange-400">{pinionAngleAtPosition.toFixed(2)}°</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-blue-500/30">
                    <p className="text-xs text-slate-500 mb-1">U-Joint Angle</p>
                    <p className={`text-xl font-bold ${uJointAngle > 3 ? 'text-red-400' : uJointAngle > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {uJointAngle.toFixed(2)}°
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-purple-500/30">
                    <p className="text-xs text-slate-500 mb-1">Total Change</p>
                    <p className="text-xl font-bold text-purple-400">
                      {(pinionAtFullCompression - pinionAtFullExtension).toFixed(2)}°
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Input Fields and Recommendations */}
              <div className="space-y-4">
                {/* Measurement Inputs */}
                {/* Measurement Inputs */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-orange-400" />
                    Pinion Angle Settings
                  </h4>
                  
                  {/* 4-Link Sync Indicator */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 mb-4 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${pinionSyncEnabled ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="text-sm text-slate-300">4-Link Sync</span>
                      </div>
                      <button
                        onClick={() => setPinionSyncEnabled(!pinionSyncEnabled)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          pinionSyncEnabled 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                            : 'bg-slate-700 text-slate-400 border border-slate-600'
                        }`}
                      >
                        {pinionSyncEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Based on IC position: <span className="text-orange-400 font-medium">{pinionAngleChangeRate.toFixed(3)}°/inch</span> of suspension travel
                    </p>
                    {pinionSyncEnabled && (
                      <p className="text-xs text-blue-400 mt-1">
                        <Info className="w-3 h-3 inline mr-1" />
                        Pinion angle syncs with Ride Height tab
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Static Pinion Angle</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          value={pinionData.staticPinionAngle}
                          onChange={(e) => handlePinionDataChange({ staticPinionAngle: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">deg</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Negative = nose down</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Transmission Angle</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          value={pinionData.transmissionAngle}
                          onChange={(e) => handlePinionDataChange({ transmissionAngle: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">deg</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Positive = nose up</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Driveshaft Length</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={pinionData.driveshaftLength}
                          onChange={(e) => handlePinionDataChange({ driveshaftLength: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Track Condition</label>
                      <select
                        value={pinionData.trackCondition}
                        onChange={(e) => handlePinionDataChange({ trackCondition: e.target.value as PinionData['trackCondition'] })}

                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      >
                        <option value="sticky">Sticky / Prepped</option>
                        <option value="moderate">Moderate</option>
                        <option value="slick">Slick / Unprepped</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max Compression</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          value={pinionData.maxCompression}
                          onChange={(e) => handlePinionDataChange({ maxCompression: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max Extension</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          value={pinionData.maxExtension}
                          onChange={(e) => handlePinionDataChange({ maxExtension: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        />
                        <span className="text-slate-500 text-sm">in</span>
                      </div>
                    </div>
                  </div>
                </div>
                

                {/* Calculated Values */}
                <div className="bg-slate-800/50 rounded-xl border border-green-500/30 p-4">
                  <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Calculated Values
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Pinion at Full Extension</span>
                      <span className="text-red-400 font-bold">{pinionAtFullExtension.toFixed(2)}°</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Pinion at Static</span>
                      <span className="text-orange-400 font-bold">{pinionData.staticPinionAngle.toFixed(2)}°</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                      <span className="text-slate-400">Pinion at Full Compression</span>
                      <span className="text-green-400 font-bold">{pinionAtFullCompression.toFixed(2)}°</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <span className="text-slate-400">Optimal Static Pinion</span>
                      <span className="text-blue-400 font-bold">{optimalStaticPinion.toFixed(2)}°</span>
                    </div>
                  </div>
                </div>
                
                {/* Track Condition Recommendations */}
                <div className="bg-slate-800/50 rounded-xl border border-purple-500/30 p-4">
                  <h4 className="font-medium text-purple-400 mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Recommendation for {pinionData.trackCondition.charAt(0).toUpperCase() + pinionData.trackCondition.slice(1)} Track
                  </h4>
                  
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400">Suggested Pinion Angle</span>
                      <span className="text-2xl font-bold text-purple-400">{currentRecommendation.angle}°</span>
                    </div>
                    <p className="text-xs text-slate-400">{currentRecommendation.description}</p>
                    
                    {Math.abs(pinionData.staticPinionAngle - currentRecommendation.angle) > 0.5 && (
                      <div className="mt-3 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                        <p className="text-xs text-yellow-400">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Current setting differs from recommendation by {Math.abs(pinionData.staticPinionAngle - currentRecommendation.angle).toFixed(1)}°
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* U-Joint Guidelines */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    U-Joint Operating Guidelines
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      Ideal U-joint angle: 1-3° (minimizes vibration and wear)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400">•</span>
                      Acceptable: 3-5° (monitor for vibration)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      Avoid: Over 5° (excessive wear and power loss)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400">•</span>
                      Front and rear U-joint angles should be equal and opposite
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}


        {/* Weight & Ballast Tab */}
        {activeTab === 'weight' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-orange-400" />
                Corner Weights
              </h3>
              
              <div className="relative bg-slate-900 rounded-lg p-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="bg-slate-800 rounded-lg p-4 border border-blue-500/30">
                      <p className="text-xs text-slate-500 mb-1">Left Front</p>
                      <input
                        type="number"
                        value={cornerWeights.lf}
                        onChange={(e) => { setCornerWeights({ ...cornerWeights, lf: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="w-full bg-transparent text-2xl font-bold text-blue-400 text-center border-none outline-none"
                      />
                      <p className="text-xs text-slate-500">lbs</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-slate-800 rounded-lg p-4 border border-purple-500/30">
                      <p className="text-xs text-slate-500 mb-1">Right Front</p>
                      <input
                        type="number"
                        value={cornerWeights.rf}
                        onChange={(e) => { setCornerWeights({ ...cornerWeights, rf: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="w-full bg-transparent text-2xl font-bold text-purple-400 text-center border-none outline-none"
                      />
                      <p className="text-xs text-slate-500">lbs</p>
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-center py-4">
                    <div className="inline-flex items-center gap-4 bg-slate-800 rounded-lg px-6 py-3">
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-bold text-white">{weightCalculations.totalWeight.toFixed(0)} lbs</p>
                      </div>
                      <div className="w-px h-8 bg-slate-600"></div>
                      <div>
                        <p className="text-xs text-slate-500">Front/Rear</p>
                        <p className="text-lg font-medium text-slate-300">
                          {weightCalculations.frontPercent.toFixed(1)}% / {weightCalculations.rearPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="bg-slate-800 rounded-lg p-4 border border-green-500/30">
                      <p className="text-xs text-slate-500 mb-1">Left Rear</p>
                      <input
                        type="number"
                        value={cornerWeights.lr}
                        onChange={(e) => { setCornerWeights({ ...cornerWeights, lr: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="w-full bg-transparent text-2xl font-bold text-green-400 text-center border-none outline-none"
                      />
                      <p className="text-xs text-slate-500">lbs</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-slate-800 rounded-lg p-4 border border-orange-500/30">
                      <p className="text-xs text-slate-500 mb-1">Right Rear</p>
                      <input
                        type="number"
                        value={cornerWeights.rr}
                        onChange={(e) => { setCornerWeights({ ...cornerWeights, rr: parseFloat(e.target.value) || 0 }); markChanged(); }}
                        className="w-full bg-transparent text-2xl font-bold text-orange-400 text-center border-none outline-none"
                      />
                      <p className="text-xs text-slate-500">lbs</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Cross Weight (LR + RF)</p>
                    <p className="text-xs text-slate-500">Target: {targetCrossWeight}%</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      Math.abs(weightCalculations.crossWeight - targetCrossWeight) <= 1 
                        ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {weightCalculations.crossWeight.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-400" />
                  Ballast Items
                </h3>
                <button
                  onClick={() => setShowBallastModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {ballastItems.map(ballast => (
                  <div
                    key={ballast.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      ballast.isInstalled 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-slate-900/50 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleBallast(ballast.id)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          ballast.isInstalled 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-slate-500 hover:border-slate-400'
                        }`}
                      >
                        {ballast.isInstalled && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </button>
                      <div>
                        <p className="text-white font-medium">{ballast.name}</p>
                        <p className="text-xs text-slate-400">{ballast.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-white">{ballast.weight} lbs</span>
                      <button
                        onClick={() => handleDeleteBallast(ballast.id)}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {ballastItems.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Scale className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No ballast items configured</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shock Settings Tab */}
        {activeTab === 'shocks' && (
          <div className="grid md:grid-cols-2 gap-6">
            {(['lf', 'rf', 'lr', 'rr'] as const).map((corner) => {
              const colors = { lf: 'blue', rf: 'purple', lr: 'green', rr: 'orange' };
              const labels = { lf: 'Left Front', rf: 'Right Front', lr: 'Left Rear', rr: 'Right Rear' };
              const color = colors[corner];
              
              return (
                <div key={corner} className={`bg-slate-800/50 rounded-xl border border-${color}-500/30 p-4`}>
                  <h4 className={`font-medium text-${color}-400 mb-4`}>{labels[corner]} Shock</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Model</label>
                      <input
                        type="text"
                        value={shockSettings[corner].model}
                        onChange={(e) => { setShockSettings({ ...shockSettings, [corner]: { ...shockSettings[corner], model: e.target.value } }); markChanged(); }}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        placeholder="e.g., Strange S1234"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Compression</label>
                        <input
                          type="number"
                          value={shockSettings[corner].compression}
                          onChange={(e) => { setShockSettings({ ...shockSettings, [corner]: { ...shockSettings[corner], compression: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                        />
                        <p className="text-xs text-slate-500 text-center mt-1">clicks</p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Rebound</label>
                        <input
                          type="number"
                          value={shockSettings[corner].rebound}
                          onChange={(e) => { setShockSettings({ ...shockSettings, [corner]: { ...shockSettings[corner], rebound: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                        />
                        <p className="text-xs text-slate-500 text-center mt-1">clicks</p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Gas Charge</label>
                        <input
                          type="number"
                          value={shockSettings[corner].gasCharge}
                          onChange={(e) => { setShockSettings({ ...shockSettings, [corner]: { ...shockSettings[corner], gasCharge: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                        />
                        <p className="text-xs text-slate-500 text-center mt-1">psi</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ride Height Tab */}
        {activeTab === 'rideheight' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-orange-400" />
              Ride Height Measurements
            </h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-blue-500/30">
                <p className="text-xs text-slate-500 mb-2">Left Front</p>
                <input
                  type="number"
                  step="0.125"
                  value={rideHeights.frontLeft}
                  onChange={(e) => { setRideHeights({ ...rideHeights, frontLeft: parseFloat(e.target.value) || 0 }); markChanged(); }}
                  className="w-full bg-transparent text-3xl font-bold text-blue-400 text-center border-none outline-none"
                />
                <p className="text-xs text-slate-500">inches</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-purple-500/30">
                <p className="text-xs text-slate-500 mb-2">Right Front</p>
                <input
                  type="number"
                  step="0.125"
                  value={rideHeights.frontRight}
                  onChange={(e) => { setRideHeights({ ...rideHeights, frontRight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                  className="w-full bg-transparent text-3xl font-bold text-purple-400 text-center border-none outline-none"
                />
                <p className="text-xs text-slate-500">inches</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-orange-500/30">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <p className="text-xs text-slate-500">Pinion Angle</p>
                  {pinionSyncEnabled && (
                    <RefreshCw className="w-3 h-3 text-blue-400" title="Synced with Pinion tab" />
                  )}
                </div>
                <input
                  type="number"
                  step="0.25"
                  value={rideHeights.pinionAngle}
                  onChange={(e) => handleRideHeightPinionChange(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-3xl font-bold text-orange-400 text-center border-none outline-none"
                />
                <p className="text-xs text-slate-500">degrees</p>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-green-500/30">
                <p className="text-xs text-slate-500 mb-2">Left Rear</p>
                <input
                  type="number"
                  step="0.125"
                  value={rideHeights.rearLeft}
                  onChange={(e) => { setRideHeights({ ...rideHeights, rearLeft: parseFloat(e.target.value) || 0 }); markChanged(); }}
                  className="w-full bg-transparent text-3xl font-bold text-green-400 text-center border-none outline-none"
                />
                <p className="text-xs text-slate-500">inches</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-yellow-500/30">
                <p className="text-xs text-slate-500 mb-2">Right Rear</p>
                <input
                  type="number"
                  step="0.125"
                  value={rideHeights.rearRight}
                  onChange={(e) => { setRideHeights({ ...rideHeights, rearRight: parseFloat(e.target.value) || 0 }); markChanged(); }}
                  className="w-full bg-transparent text-3xl font-bold text-yellow-400 text-center border-none outline-none"
                />
                <p className="text-xs text-slate-500">inches</p>
              </div>
            </div>
          </div>
        )}

        {/* Springs Tab */}
        {activeTab === 'springs' && (
          <div className="grid md:grid-cols-2 gap-6">
            {(['lf', 'rf', 'lr', 'rr'] as const).map((corner) => {
              const colors = { lf: 'blue', rf: 'purple', lr: 'green', rr: 'orange' };
              const labels = { lf: 'Left Front', rf: 'Right Front', lr: 'Left Rear', rr: 'Right Rear' };
              const color = colors[corner];
              
              return (
                <div key={corner} className={`bg-slate-800/50 rounded-xl border border-${color}-500/30 p-4`}>
                  <h4 className={`font-medium text-${color}-400 mb-4`}>{labels[corner]} Spring</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Rate</label>
                      <input
                        type="number"
                        value={springData[corner].rate}
                        onChange={(e) => { setSpringData({ ...springData, [corner]: { ...springData[corner], rate: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                      />
                      <p className="text-xs text-slate-500 text-center mt-1">lb/in</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Preload</label>
                      <input
                        type="number"
                        step="0.25"
                        value={springData[corner].preload}
                        onChange={(e) => { setSpringData({ ...springData, [corner]: { ...springData[corner], preload: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                      />
                      <p className="text-xs text-slate-500 text-center mt-1">inches</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Free Length</label>
                      <input
                        type="number"
                        step="0.5"
                        value={springData[corner].freeLength}
                        onChange={(e) => { setSpringData({ ...springData, [corner]: { ...springData[corner], freeLength: parseFloat(e.target.value) || 0 } }); markChanged(); }}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm text-center"
                      />
                      <p className="text-xs text-slate-500 text-center mt-1">inches</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Setup Advisor / Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <SetupRecommendationEngine
            fourLink={fourLink}
            cgData={cgData}
            pinionData={pinionData}
            cornerWeights={cornerWeights}
            shockSettings={shockSettings}
            springData={springData}
            fourLinkCalculations={fourLinkCalculations}
            onApplyPreset={(preset) => {
              if (preset.pinionData) {
                setPinionData(prev => ({ ...prev, ...preset.pinionData }));
              }
              if (preset.shockSettings) {
                setShockSettings(prev => ({
                  ...prev,
                  lr: { ...prev.lr, ...(preset.shockSettings?.lr || {}) },
                  rr: { ...prev.rr, ...(preset.shockSettings?.rr || {}) }
                }));
              }
              if (preset.springData) {
                setSpringData(prev => ({ ...prev, ...preset.springData }));
              }
              markChanged();
            }}
          />
        )}


        {/* Performance Notes */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Data</h3>
          <div className="grid md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">60ft Time</label>
              <input
                type="number"
                step="0.001"
                value={sixtyFootTime || ''}
                onChange={(e) => { setSixtyFootTime(e.target.value ? parseFloat(e.target.value) : null); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="1.000"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">1/8 Mile ET</label>
              <input
                type="number"
                step="0.001"
                value={eighthMileET || ''}
                onChange={(e) => { setEighthMileET(e.target.value ? parseFloat(e.target.value) : null); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="3.700"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">1/8 Mile MPH</label>
              <input
                type="number"
                step="0.01"
                value={eighthMileMPH || ''}
                onChange={(e) => { setEighthMileMPH(e.target.value ? parseFloat(e.target.value) : null); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="200.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">1/4 Mile ET</label>
              <input
                type="number"
                step="0.001"
                value={quarterMileET || ''}
                onChange={(e) => { setQuarterMileET(e.target.value ? parseFloat(e.target.value) : null); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="5.700"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">1/4 Mile MPH</label>
              <input
                type="number"
                step="0.01"
                value={quarterMileMPH || ''}
                onChange={(e) => { setQuarterMileMPH(e.target.value ? parseFloat(e.target.value) : null); markChanged(); }}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                placeholder="250.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Performance Notes</label>
            <textarea
              value={performanceNotes}
              onChange={(e) => { setPerformanceNotes(e.target.value); markChanged(); }}
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="Notes about car behavior, track conditions, etc..."
            />
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Save Setup</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Setup Name</label>
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={setupDescription}
                  onChange={(e) => setSetupDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {selectedSetupId && (
                <button
                  onClick={() => saveSetup(true)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Save as New
                </button>
              )}
              <button
                onClick={() => saveSetup(false)}
                disabled={isSaving || !setupName}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : selectedSetupId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Load Setup</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {savedSetups.map(setup => (
                <div
                  key={setup.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedSetupId === setup.id 
                      ? 'bg-orange-500/20 border-orange-500/50' 
                      : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                  onClick={() => { loadSetupData(setup); setShowLoadModal(false); }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(setup.id, setup.is_favorite); }}
                      className={setup.is_favorite ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-400'}
                    >
                      {setup.is_favorite ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className="text-white font-medium">{setup.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {setup.track_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{setup.track_name}</span>}
                        {setup.race_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{setup.race_date}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {setup.anti_squat_percentage && (
                      <span className="text-sm text-slate-400">{setup.anti_squat_percentage.toFixed(0)}% AS</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSetup(setup.id); }}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {savedSetups.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No saved setups found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-purple-400" />
                Compare Setups
              </h3>
              <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Compare current setup with:</label>
              <select
                value={compareSetupId || ''}
                onChange={(e) => setCompareSetupId(e.target.value || null)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Select a setup to compare...</option>
                {savedSetups.filter(s => s.id !== selectedSetupId).map(setup => (
                  <option key={setup.id} value={setup.id}>
                    {setup.name} {setup.track_name ? `- ${setup.track_name}` : ''} {setup.race_date ? `(${setup.race_date})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {compareSetup && (
              <div className="overflow-y-auto flex-1">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="font-medium text-slate-400">Setting</div>
                  <div className="font-medium text-orange-400">Current: {setupName}</div>
                  <div className="font-medium text-purple-400">Compare: {compareSetup.name}</div>

                  {/* 4-Link Comparison */}
                  <div className="col-span-3 text-white font-semibold mt-4 border-b border-slate-700 pb-2">4-Link Settings</div>
                  
                  <div className="text-slate-400">Upper Bar Chassis Height</div>
                  <div className="text-white">{fourLink.upperBarChassisMountHeight}"</div>
                  <div className={`${compareSetup.upper_bar_chassis_y !== fourLink.upperBarChassisMountHeight ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.upper_bar_chassis_y}"
                  </div>

                  <div className="text-slate-400">Lower Bar Chassis Height</div>
                  <div className="text-white">{fourLink.lowerBarChassisMountHeight}"</div>
                  <div className={`${compareSetup.lower_bar_chassis_y !== fourLink.lowerBarChassisMountHeight ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.lower_bar_chassis_y}"
                  </div>

                  <div className="text-slate-400">Anti-Squat %</div>
                  <div className="text-white">{fourLinkCalculations.antiSquat.toFixed(1)}%</div>
                  <div className={`${compareSetup.anti_squat_percentage?.toFixed(1) !== fourLinkCalculations.antiSquat.toFixed(1) ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.anti_squat_percentage?.toFixed(1)}%
                  </div>

                  {/* Weight Comparison */}
                  <div className="col-span-3 text-white font-semibold mt-4 border-b border-slate-700 pb-2">Weight Distribution</div>
                  
                  <div className="text-slate-400">Total Weight</div>
                  <div className="text-white">{weightCalculations.totalWeight.toFixed(0)} lbs</div>
                  <div className={`${compareSetup.total_weight !== weightCalculations.totalWeight ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.total_weight?.toFixed(0)} lbs
                  </div>

                  <div className="text-slate-400">Cross Weight</div>
                  <div className="text-white">{weightCalculations.crossWeight.toFixed(1)}%</div>
                  <div className={`${compareSetup.cross_weight_percentage?.toFixed(1) !== weightCalculations.crossWeight.toFixed(1) ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.cross_weight_percentage?.toFixed(1)}%
                  </div>

                  {/* Performance Comparison */}
                  <div className="col-span-3 text-white font-semibold mt-4 border-b border-slate-700 pb-2">Performance</div>
                  
                  <div className="text-slate-400">60ft Time</div>
                  <div className="text-white">{sixtyFootTime || '-'}</div>
                  <div className={`${compareSetup.sixty_foot_time !== sixtyFootTime ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.sixty_foot_time || '-'}
                  </div>

                  <div className="text-slate-400">1/8 Mile ET</div>
                  <div className="text-white">{eighthMileET || '-'}</div>
                  <div className={`${compareSetup.eighth_mile_et !== eighthMileET ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.eighth_mile_et || '-'}
                  </div>

                  <div className="text-slate-400">1/4 Mile ET</div>
                  <div className="text-white">{quarterMileET || '-'}</div>
                  <div className={`${compareSetup.quarter_mile_et !== quarterMileET ? 'text-yellow-400' : 'text-white'}`}>
                    {compareSetup.quarter_mile_et || '-'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Ballast Modal */}
      {showBallastModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add Ballast</h3>
              <button onClick={() => setShowBallastModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newBallast.name}
                  onChange={(e) => setNewBallast({ ...newBallast, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Lead Block A"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    value={newBallast.weight}
                    onChange={(e) => setNewBallast({ ...newBallast, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Location</label>
                  <select
                    value={newBallast.location}
                    onChange={(e) => setNewBallast({ ...newBallast, location: e.target.value as BallastItem['location'] })}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Left Front">Left Front</option>
                    <option value="Right Front">Right Front</option>
                    <option value="Left Rear">Left Rear</option>
                    <option value="Right Rear">Right Rear</option>
                    <option value="Center Front">Center Front</option>
                    <option value="Center Rear">Center Rear</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={newBallast.notes}
                  onChange={(e) => setNewBallast({ ...newBallast, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Behind driver seat"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBallastModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBallast}
                disabled={!newBallast.name}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                Add Ballast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Link Presets Modal */}
      {showPresetsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-5xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">4-Link Presets Library</h3>
                  <p className="text-sm text-slate-400">Load a baseline configuration for your car type</p>
                </div>
              </div>
              <button onClick={() => { setShowPresetsModal(false); setSelectedPreset(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {getPresetCategories().map(category => {
                const categoryIcons: Record<string, React.ReactNode> = {
                  'Pro': <Zap className="w-4 h-4" />,
                  'Radial': <Target className="w-4 h-4" />,
                  'No Prep': <AlertTriangle className="w-4 h-4" />,
                  'Street': <Car className="w-4 h-4" />,
                  'Bracket': <Clock className="w-4 h-4" />
                };
                const categoryColors: Record<string, string> = {
                  'Pro': 'from-red-500 to-orange-500',
                  'Radial': 'from-blue-500 to-cyan-500',
                  'No Prep': 'from-yellow-500 to-amber-500',
                  'Street': 'from-green-500 to-emerald-500',
                  'Bracket': 'from-purple-500 to-pink-500'
                };
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedPresetCategory(category)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      selectedPresetCategory === category
                        ? `bg-gradient-to-r ${categoryColors[category]} text-white shadow-lg`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {categoryIcons[category]}
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Preset List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {fourLinkPresets
                  .filter(preset => preset.category === selectedPresetCategory)
                  .map(preset => (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedPreset?.id === preset.id
                          ? 'bg-orange-500/20 border-orange-500/50 shadow-lg shadow-orange-500/10'
                          : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-white">{preset.name}</h4>
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                          {preset.targetAntiSquat.min}-{preset.targetAntiSquat.max}% AS
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-3">{preset.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {preset.characteristics.slice(0, 2).map((char, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                            {char}
                          </span>
                        ))}
                        {preset.characteristics.length > 2 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-500">
                            +{preset.characteristics.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Preview Panel */}
              {selectedPreset && (
                <div className="w-96 bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 overflow-y-auto">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-orange-400" />
                    Preset Details
                  </h4>

                  {/* Settings Preview */}
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <h5 className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Upper Bar</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400">Chassis Height:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.upperBarChassisMountHeight}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Forward:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.upperBarChassisMountForward}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Rear Height:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.upperBarRearEndMountHeight}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Rear Fwd:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.upperBarRearEndMountForward}"</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <h5 className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Lower Bar</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400">Chassis Height:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.lowerBarChassisMountHeight}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Forward:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.lowerBarChassisMountForward}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Rear Height:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.lowerBarRearEndMountHeight}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Rear Fwd:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.lowerBarRearEndMountForward}"</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <h5 className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Vehicle Specs</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400">Wheelbase:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.wheelbase}"</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Rear Tire:</span>
                          <span className="text-white ml-1">{selectedPreset.settings.rearTireRadius}" rad</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg p-3 border border-orange-500/30">
                      <h5 className="text-xs text-orange-400 mb-2 uppercase tracking-wide">Recommended</h5>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Pinion Angle:</span>
                        <span className="text-lg font-bold text-orange-400">{selectedPreset.recommendedPinionAngle}°</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-400">Target Anti-Squat:</span>
                        <span className="text-lg font-bold text-blue-400">{selectedPreset.targetAntiSquat.min}-{selectedPreset.targetAntiSquat.max}%</span>
                      </div>
                    </div>

                    {/* Characteristics */}
                    <div>
                      <h5 className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Characteristics</h5>
                      <ul className="space-y-1">
                        {selectedPreset.characteristics.map((char, idx) => (
                          <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            {char}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Notes */}
                    <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                      <h5 className="text-xs text-blue-400 mb-2 uppercase tracking-wide flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Notes
                      </h5>
                      <p className="text-sm text-slate-300">{selectedPreset.notes}</p>
                    </div>
                  </div>

                  {/* Load Button */}
                  <button
                    onClick={() => loadFourLinkPreset(selectedPreset)}
                    className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Load This Preset
                  </button>
                </div>
              )}

              {/* No Selection State */}
              {!selectedPreset && (
                <div className="w-96 bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a preset to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Strange Bracket Selector Modal */}
      <StrangeBracketSelector
        isOpen={showBracketSelector}
        onClose={() => setShowBracketSelector(false)}
        rearEndCenterHeight={fourLink.rearEndCenterHeight}
        onApplyBracket={(settings) => {
          setFourLink(prev => ({
            ...prev,
            upperBarRearEndMountHeight: settings.upperBarRearEndMountHeight,
            upperBarRearEndMountForward: settings.upperBarRearEndMountForward,
            lowerBarRearEndMountHeight: settings.lowerBarRearEndMountHeight,
            lowerBarRearEndMountForward: settings.lowerBarRearEndMountForward
          }));
          markChanged();
        }}
      />

      {/* Quartermax Bracket Selector Modal */}
      <QuartermaxBracketSelector
        isOpen={showQuartermaxBracketSelector}
        onClose={() => setShowQuartermaxBracketSelector(false)}
        rearEndCenterHeight={fourLink.rearEndCenterHeight}
        wheelbaseInches={fourLink.wheelbase}
        onApplyBracket={(settings) => {
          setFourLink(prev => ({
            ...prev,
            // Chassis mounts
            upperBarChassisMountHeight: settings.upperBarChassisMountHeight,
            upperBarChassisMountForward: settings.upperBarChassisMountForward,
            lowerBarChassisMountHeight: settings.lowerBarChassisMountHeight,
            lowerBarChassisMountForward: settings.lowerBarChassisMountForward,
            // Housing (rear end) mounts
            upperBarRearEndMountHeight: settings.upperBarRearEndMountHeight,
            upperBarRearEndMountForward: settings.upperBarRearEndMountForward,
            lowerBarRearEndMountHeight: settings.lowerBarRearEndMountHeight,
            lowerBarRearEndMountForward: settings.lowerBarRearEndMountForward
          }));
          markChanged();
        }}
      />

    </section>

  );
};

export default ChassisSetup;

