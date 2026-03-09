import React, { useState, useMemo } from 'react';
import {
  Lightbulb,
  Target,
  Thermometer,
  Cloud,
  Sun,
  Snowflake,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Settings,
  Gauge,
  ArrowUp,
  ArrowDown,
  Minus,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Scale,
  Crosshair,
  Compass
} from 'lucide-react';

// Types for the recommendation engine
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

interface CGData {
  levelFrontWeight: number;
  levelRearWeight: number;
  liftedRearWeight: number;
  frontLiftHeight: number;
  rearAxleHeight: number;
  calculatedCGHeight: number;
  cgDistanceFromRear: number;
}

interface ShockSettingsData {
  lf: { compression: number; rebound: number; gasCharge: number; model: string };
  rf: { compression: number; rebound: number; gasCharge: number; model: string };
  lr: { compression: number; rebound: number; gasCharge: number; model: string };
  rr: { compression: number; rebound: number; gasCharge: number; model: string };
}

interface SpringData {
  lf: { rate: number; preload: number; freeLength: number };
  rf: { rate: number; preload: number; freeLength: number };
  lr: { rate: number; preload: number; freeLength: number };
  rr: { rate: number; preload: number; freeLength: number };
}

interface PinionData {
  staticPinionAngle: number;
  transmissionAngle: number;
  driveshaftLength: number;
  maxCompression: number;
  maxExtension: number;
  trackCondition: 'sticky' | 'moderate' | 'slick';
}

interface CornerWeights {
  lf: number;
  rf: number;
  lr: number;
  rr: number;
}

interface SetupRecommendationEngineProps {
  fourLink: FourLinkSettings;
  cgData: CGData;
  pinionData: PinionData;
  cornerWeights: CornerWeights;
  shockSettings: ShockSettingsData;
  springData: SpringData;
  fourLinkCalculations: {
    icLength: number;
    icHeight: number;
    antiSquat: number;
    upperBarLength: number;
    lowerBarLength: number;
  };
  onApplyPreset: (preset: Partial<{
    fourLink: Partial<FourLinkSettings>;
    pinionData: Partial<PinionData>;
    shockSettings: Partial<ShockSettingsData>;
    springData: Partial<SpringData>;
  }>) => void;
}

// Preset configurations for different scenarios
const trackPresets = {
  sticky: {
    name: 'Sticky Track',
    description: 'Well-prepped, high-grip surface',
    icon: Target,
    color: 'green',
    antiSquatRange: { min: 120, max: 150 },
    icLengthRange: { min: 55, max: 75 },
    icHeightRange: { min: 12, max: 18 },
    pinionAngle: -3.0,
    rearShockCompression: { min: 3, max: 5 },
    rearShockRebound: { min: 5, max: 7 },
    rearSpringRate: { min: 150, max: 200 },
    recommendations: [
      'Increase anti-squat for aggressive weight transfer',
      'Stiffen rear shocks to control body movement',
      'More negative pinion angle for harder hit',
      'Lower IC height for quicker response'
    ]
  },
  moderate: {
    name: 'Moderate Track',
    description: 'Average prep, consistent grip',
    icon: Gauge,
    color: 'yellow',
    antiSquatRange: { min: 100, max: 130 },
    icLengthRange: { min: 60, max: 80 },
    icHeightRange: { min: 14, max: 20 },
    pinionAngle: -2.0,
    rearShockCompression: { min: 4, max: 6 },
    rearShockRebound: { min: 6, max: 8 },
    rearSpringRate: { min: 165, max: 185 },
    recommendations: [
      'Balanced anti-squat for consistent launches',
      'Medium shock settings for versatility',
      'Moderate pinion angle for smooth power application',
      'Standard IC position for predictable behavior'
    ]
  },
  slick: {
    name: 'Slick Track',
    description: 'Unprepped or worn surface',
    icon: AlertTriangle,
    color: 'red',
    antiSquatRange: { min: 80, max: 110 },
    icLengthRange: { min: 70, max: 95 },
    icHeightRange: { min: 16, max: 24 },
    pinionAngle: -1.0,
    rearShockCompression: { min: 5, max: 8 },
    rearShockRebound: { min: 7, max: 10 },
    rearSpringRate: { min: 140, max: 170 },
    recommendations: [
      'Reduce anti-squat to prevent tire shake',
      'Soften rear shocks for better tire compliance',
      'Less negative pinion angle for gentler hit',
      'Raise IC height for slower weight transfer'
    ]
  }
};

const weatherPresets = {
  hot: {
    name: 'Hot Weather',
    description: '85°F+ / High DA',
    icon: Sun,
    color: 'orange',
    adjustments: {
      antiSquatMod: -5,
      shockCompressionMod: -1,
      shockReboundMod: -1,
      springPreloadMod: -0.25,
      pinionAngleMod: 0.25
    },
    tips: [
      'Reduce anti-squat 5-10% - less power available',
      'Soften shocks slightly for tire compliance',
      'Reduce spring preload for better weight transfer',
      'Less aggressive pinion angle'
    ]
  },
  warm: {
    name: 'Warm Weather',
    description: '70-85°F / Normal DA',
    icon: Thermometer,
    color: 'yellow',
    adjustments: {
      antiSquatMod: 0,
      shockCompressionMod: 0,
      shockReboundMod: 0,
      springPreloadMod: 0,
      pinionAngleMod: 0
    },
    tips: [
      'Standard baseline settings',
      'Monitor track temperature changes',
      'Be ready to adjust as conditions change'
    ]
  },
  cool: {
    name: 'Cool Weather',
    description: '50-70°F / Low DA',
    icon: Cloud,
    color: 'blue',
    adjustments: {
      antiSquatMod: 5,
      shockCompressionMod: 1,
      shockReboundMod: 1,
      springPreloadMod: 0.25,
      pinionAngleMod: -0.25
    },
    tips: [
      'Increase anti-squat 5-10% - more power available',
      'Stiffen shocks to control additional power',
      'Increase spring preload slightly',
      'More aggressive pinion angle for harder hit'
    ]
  },
  cold: {
    name: 'Cold Weather',
    description: 'Below 50°F / Very Low DA',
    icon: Snowflake,
    color: 'cyan',
    adjustments: {
      antiSquatMod: 10,
      shockCompressionMod: 2,
      shockReboundMod: 2,
      springPreloadMod: 0.5,
      pinionAngleMod: -0.5
    },
    tips: [
      'Significantly increase anti-squat for max power',
      'Stiffen shocks considerably',
      'Increase spring preload for weight transfer control',
      'Most aggressive pinion angle settings',
      'Watch for tire shake - may need to back off'
    ]
  }
};

const performanceGoals = {
  sixtyFoot: {
    name: '60ft Focus',
    description: 'Optimize for best 60ft times',
    icon: Zap,
    color: 'purple',
    priorities: ['Anti-squat optimization', 'Shock tuning for launch', 'Weight transfer'],
    adjustments: {
      antiSquatTarget: 130,
      icLengthTarget: 65,
      rearShockFocus: 'compression',
      springFocus: 'preload'
    }
  },
  topEnd: {
    name: 'Top End Focus',
    description: 'Optimize for MPH and stability',
    icon: TrendingUp,
    color: 'blue',
    priorities: ['Aerodynamic stability', 'Rear end control', 'Consistent tracking'],
    adjustments: {
      antiSquatTarget: 100,
      icLengthTarget: 80,
      rearShockFocus: 'rebound',
      springFocus: 'rate'
    }
  },
  balanced: {
    name: 'Balanced',
    description: 'Overall performance optimization',
    icon: Scale,
    color: 'green',
    priorities: ['Consistent performance', 'Predictable behavior', 'All-around capability'],
    adjustments: {
      antiSquatTarget: 115,
      icLengthTarget: 70,
      rearShockFocus: 'both',
      springFocus: 'both'
    }
  }
};

const SetupRecommendationEngine: React.FC<SetupRecommendationEngineProps> = ({
  fourLink,
  cgData,
  pinionData,
  cornerWeights,
  shockSettings,
  springData,
  fourLinkCalculations,
  onApplyPreset
}) => {
  const [selectedTrackCondition, setSelectedTrackCondition] = useState<'sticky' | 'moderate' | 'slick'>('moderate');
  const [selectedWeather, setSelectedWeather] = useState<'hot' | 'warm' | 'cool' | 'cold'>('warm');
  const [selectedGoal, setSelectedGoal] = useState<'sixtyFoot' | 'topEnd' | 'balanced'>('balanced');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(true);

  // Calculate current setup metrics
  const currentMetrics = useMemo(() => {
    const totalWeight = cornerWeights.lf + cornerWeights.rf + cornerWeights.lr + cornerWeights.rr;
    const rearWeight = cornerWeights.lr + cornerWeights.rr;
    const rearWeightPercent = (rearWeight / totalWeight) * 100;
    
    // Calculate CG height using the lifting method
    const deltaRearWeight = cgData.liftedRearWeight - cgData.levelRearWeight;
    const liftAngleRad = Math.atan(cgData.frontLiftHeight / fourLink.wheelbase);
    const tanAngle = Math.tan(liftAngleRad);
    let cgHeight = 0;
    if (tanAngle > 0 && totalWeight > 0) {
      cgHeight = ((fourLink.wheelbase * deltaRearWeight) / (totalWeight * tanAngle)) + cgData.rearAxleHeight;
    }
    
    return {
      totalWeight,
      rearWeightPercent,
      cgHeight,
      antiSquat: fourLinkCalculations.antiSquat,
      icLength: fourLinkCalculations.icLength,
      icHeight: fourLinkCalculations.icHeight,
      pinionAngle: pinionData.staticPinionAngle,
      rearShockCompression: (shockSettings.lr.compression + shockSettings.rr.compression) / 2,
      rearShockRebound: (shockSettings.lr.rebound + shockSettings.rr.rebound) / 2,
      rearSpringRate: (springData.lr.rate + springData.rr.rate) / 2
    };
  }, [fourLink, cgData, pinionData, cornerWeights, shockSettings, springData, fourLinkCalculations]);

  // Generate recommendations based on selected conditions
  const recommendations = useMemo(() => {
    const track = trackPresets[selectedTrackCondition];
    const weather = weatherPresets[selectedWeather];
    const goal = performanceGoals[selectedGoal];
    
    const issues: { area: string; current: string; recommended: string; severity: 'critical' | 'warning' | 'info'; adjustment: string }[] = [];
    
    // Analyze anti-squat
    const targetAntiSquat = track.antiSquatRange.min + (track.antiSquatRange.max - track.antiSquatRange.min) / 2 + weather.adjustments.antiSquatMod;
    if (currentMetrics.antiSquat < track.antiSquatRange.min + weather.adjustments.antiSquatMod) {
      issues.push({
        area: 'Anti-Squat',
        current: `${currentMetrics.antiSquat.toFixed(1)}%`,
        recommended: `${(track.antiSquatRange.min + weather.adjustments.antiSquatMod).toFixed(0)}-${(track.antiSquatRange.max + weather.adjustments.antiSquatMod).toFixed(0)}%`,
        severity: currentMetrics.antiSquat < track.antiSquatRange.min - 15 ? 'critical' : 'warning',
        adjustment: `Increase by ${(targetAntiSquat - currentMetrics.antiSquat).toFixed(0)}%`
      });
    } else if (currentMetrics.antiSquat > track.antiSquatRange.max + weather.adjustments.antiSquatMod) {
      issues.push({
        area: 'Anti-Squat',
        current: `${currentMetrics.antiSquat.toFixed(1)}%`,
        recommended: `${(track.antiSquatRange.min + weather.adjustments.antiSquatMod).toFixed(0)}-${(track.antiSquatRange.max + weather.adjustments.antiSquatMod).toFixed(0)}%`,
        severity: currentMetrics.antiSquat > track.antiSquatRange.max + 15 ? 'critical' : 'warning',
        adjustment: `Decrease by ${(currentMetrics.antiSquat - targetAntiSquat).toFixed(0)}%`
      });
    }
    
    // Analyze IC Length
    if (currentMetrics.icLength < track.icLengthRange.min) {
      issues.push({
        area: 'IC Length',
        current: `${currentMetrics.icLength.toFixed(1)}"`,
        recommended: `${track.icLengthRange.min}-${track.icLengthRange.max}"`,
        severity: 'warning',
        adjustment: `Increase by ${(track.icLengthRange.min - currentMetrics.icLength).toFixed(1)}"`
      });
    } else if (currentMetrics.icLength > track.icLengthRange.max) {
      issues.push({
        area: 'IC Length',
        current: `${currentMetrics.icLength.toFixed(1)}"`,
        recommended: `${track.icLengthRange.min}-${track.icLengthRange.max}"`,
        severity: 'warning',
        adjustment: `Decrease by ${(currentMetrics.icLength - track.icLengthRange.max).toFixed(1)}"`
      });
    }
    
    // Analyze IC Height
    if (currentMetrics.icHeight < track.icHeightRange.min) {
      issues.push({
        area: 'IC Height',
        current: `${currentMetrics.icHeight.toFixed(1)}"`,
        recommended: `${track.icHeightRange.min}-${track.icHeightRange.max}"`,
        severity: 'info',
        adjustment: `Raise by ${(track.icHeightRange.min - currentMetrics.icHeight).toFixed(1)}"`
      });
    } else if (currentMetrics.icHeight > track.icHeightRange.max) {
      issues.push({
        area: 'IC Height',
        current: `${currentMetrics.icHeight.toFixed(1)}"`,
        recommended: `${track.icHeightRange.min}-${track.icHeightRange.max}"`,
        severity: 'info',
        adjustment: `Lower by ${(currentMetrics.icHeight - track.icHeightRange.max).toFixed(1)}"`
      });
    }
    
    // Analyze Pinion Angle
    const targetPinion = track.pinionAngle + weather.adjustments.pinionAngleMod;
    if (Math.abs(currentMetrics.pinionAngle - targetPinion) > 0.75) {
      issues.push({
        area: 'Pinion Angle',
        current: `${currentMetrics.pinionAngle.toFixed(1)}°`,
        recommended: `${targetPinion.toFixed(1)}°`,
        severity: Math.abs(currentMetrics.pinionAngle - targetPinion) > 1.5 ? 'warning' : 'info',
        adjustment: currentMetrics.pinionAngle > targetPinion 
          ? `More negative by ${(currentMetrics.pinionAngle - targetPinion).toFixed(1)}°`
          : `Less negative by ${(targetPinion - currentMetrics.pinionAngle).toFixed(1)}°`
      });
    }
    
    // Analyze Rear Shock Compression
    const targetCompression = (track.rearShockCompression.min + track.rearShockCompression.max) / 2 + weather.adjustments.shockCompressionMod;
    if (currentMetrics.rearShockCompression < track.rearShockCompression.min + weather.adjustments.shockCompressionMod) {
      issues.push({
        area: 'Rear Shock Compression',
        current: `${currentMetrics.rearShockCompression.toFixed(0)} clicks`,
        recommended: `${track.rearShockCompression.min + weather.adjustments.shockCompressionMod}-${track.rearShockCompression.max + weather.adjustments.shockCompressionMod} clicks`,
        severity: 'info',
        adjustment: `Add ${(targetCompression - currentMetrics.rearShockCompression).toFixed(0)} clicks`
      });
    } else if (currentMetrics.rearShockCompression > track.rearShockCompression.max + weather.adjustments.shockCompressionMod) {
      issues.push({
        area: 'Rear Shock Compression',
        current: `${currentMetrics.rearShockCompression.toFixed(0)} clicks`,
        recommended: `${track.rearShockCompression.min + weather.adjustments.shockCompressionMod}-${track.rearShockCompression.max + weather.adjustments.shockCompressionMod} clicks`,
        severity: 'info',
        adjustment: `Remove ${(currentMetrics.rearShockCompression - targetCompression).toFixed(0)} clicks`
      });
    }
    
    // Analyze Rear Spring Rate
    if (currentMetrics.rearSpringRate < track.rearSpringRate.min) {
      issues.push({
        area: 'Rear Spring Rate',
        current: `${currentMetrics.rearSpringRate.toFixed(0)} lb/in`,
        recommended: `${track.rearSpringRate.min}-${track.rearSpringRate.max} lb/in`,
        severity: 'info',
        adjustment: `Increase to ${track.rearSpringRate.min} lb/in or higher`
      });
    } else if (currentMetrics.rearSpringRate > track.rearSpringRate.max) {
      issues.push({
        area: 'Rear Spring Rate',
        current: `${currentMetrics.rearSpringRate.toFixed(0)} lb/in`,
        recommended: `${track.rearSpringRate.min}-${track.rearSpringRate.max} lb/in`,
        severity: 'info',
        adjustment: `Decrease to ${track.rearSpringRate.max} lb/in or lower`
      });
    }
    
    return issues;
  }, [selectedTrackCondition, selectedWeather, selectedGoal, currentMetrics]);

  // Calculate overall setup score
  const setupScore = useMemo(() => {
    let score = 100;
    recommendations.forEach(rec => {
      if (rec.severity === 'critical') score -= 20;
      else if (rec.severity === 'warning') score -= 10;
      else score -= 5;
    });
    return Math.max(0, score);
  }, [recommendations]);

  // Generate quick adjustment suggestions
  const quickAdjustments = useMemo(() => {
    const track = trackPresets[selectedTrackCondition];
    const weather = weatherPresets[selectedWeather];
    
    return {
      fourLink: {
        // Calculate bar angle adjustments needed to achieve target anti-squat
        targetAntiSquat: (track.antiSquatRange.min + track.antiSquatRange.max) / 2 + weather.adjustments.antiSquatMod
      },
      pinionData: {
        staticPinionAngle: track.pinionAngle + weather.adjustments.pinionAngleMod,
        trackCondition: selectedTrackCondition
      },
      shockSettings: {
        lr: {
          compression: Math.round((track.rearShockCompression.min + track.rearShockCompression.max) / 2 + weather.adjustments.shockCompressionMod),
          rebound: Math.round((track.rearShockRebound.min + track.rearShockRebound.max) / 2 + weather.adjustments.shockReboundMod)
        },
        rr: {
          compression: Math.round((track.rearShockCompression.min + track.rearShockCompression.max) / 2 + weather.adjustments.shockCompressionMod),
          rebound: Math.round((track.rearShockRebound.min + track.rearShockRebound.max) / 2 + weather.adjustments.shockReboundMod)
        }
      }
    };
  }, [selectedTrackCondition, selectedWeather]);

  const handleApplyQuickAdjustments = () => {
    onApplyPreset({
      pinionData: quickAdjustments.pinionData,
      shockSettings: {
        ...shockSettings,
        lr: { ...shockSettings.lr, ...quickAdjustments.shockSettings.lr },
        rr: { ...shockSettings.rr, ...quickAdjustments.shockSettings.rr }
      }
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/50';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  return (
    <div className="space-y-6">
      {/* Header with Setup Score */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Setup Recommendation Engine</h3>
              <p className="text-slate-400 text-sm">AI-powered analysis for optimal chassis configuration</p>
            </div>
          </div>
          <div className={`text-center px-6 py-3 rounded-xl border ${getScoreBgColor(setupScore)}`}>
            <p className="text-xs text-slate-400 mb-1">Setup Score</p>
            <p className={`text-4xl font-bold ${getScoreColor(setupScore)}`}>{setupScore}</p>
            <p className="text-xs text-slate-500">/ 100</p>
          </div>
        </div>
      </div>

      {/* Condition Selectors */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Track Condition */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Track Condition
          </h4>
          <div className="space-y-2">
            {(Object.entries(trackPresets) as [keyof typeof trackPresets, typeof trackPresets.sticky][]).map(([key, preset]) => {
              const Icon = preset.icon;
              const isSelected = selectedTrackCondition === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTrackCondition(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 text-white`
                      : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? `text-${preset.color}-400` : ''}`} />
                  <div className="text-left flex-1">
                    <p className={`font-medium ${isSelected ? 'text-white' : ''}`}>{preset.name}</p>
                    <p className="text-xs text-slate-500">{preset.description}</p>
                  </div>
                  {isSelected && <CheckCircle2 className={`w-5 h-5 text-${preset.color}-400`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weather Condition */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Thermometer className="w-4 h-4" />
            Weather Condition
          </h4>
          <div className="space-y-2">
            {(Object.entries(weatherPresets) as [keyof typeof weatherPresets, typeof weatherPresets.hot][]).map(([key, preset]) => {
              const Icon = preset.icon;
              const isSelected = selectedWeather === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedWeather(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 text-white`
                      : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? `text-${preset.color}-400` : ''}`} />
                  <div className="text-left flex-1">
                    <p className={`font-medium ${isSelected ? 'text-white' : ''}`}>{preset.name}</p>
                    <p className="text-xs text-slate-500">{preset.description}</p>
                  </div>
                  {isSelected && <CheckCircle2 className={`w-5 h-5 text-${preset.color}-400`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Performance Goal */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance Goal
          </h4>
          <div className="space-y-2">
            {(Object.entries(performanceGoals) as [keyof typeof performanceGoals, typeof performanceGoals.sixtyFoot][]).map(([key, preset]) => {
              const Icon = preset.icon;
              const isSelected = selectedGoal === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedGoal(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 text-white`
                      : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? `text-${preset.color}-400` : ''}`} />
                  <div className="text-left flex-1">
                    <p className={`font-medium ${isSelected ? 'text-white' : ''}`}>{preset.name}</p>
                    <p className="text-xs text-slate-500">{preset.description}</p>
                  </div>
                  {isSelected && <CheckCircle2 className={`w-5 h-5 text-${preset.color}-400`} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Setup Analysis */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-orange-400" />
            Current Setup Analysis
          </h4>
          <button
            onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
          >
            {showDetailedAnalysis ? 'Hide Details' : 'Show Details'}
            <ChevronRight className={`w-4 h-4 transition-transform ${showDetailedAnalysis ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Anti-Squat</p>
            <p className={`text-xl font-bold ${
              currentMetrics.antiSquat >= trackPresets[selectedTrackCondition].antiSquatRange.min &&
              currentMetrics.antiSquat <= trackPresets[selectedTrackCondition].antiSquatRange.max
                ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {currentMetrics.antiSquat.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">IC Length</p>
            <p className={`text-xl font-bold ${
              currentMetrics.icLength >= trackPresets[selectedTrackCondition].icLengthRange.min &&
              currentMetrics.icLength <= trackPresets[selectedTrackCondition].icLengthRange.max
                ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {currentMetrics.icLength.toFixed(1)}"
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">IC Height</p>
            <p className={`text-xl font-bold ${
              currentMetrics.icHeight >= trackPresets[selectedTrackCondition].icHeightRange.min &&
              currentMetrics.icHeight <= trackPresets[selectedTrackCondition].icHeightRange.max
                ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {currentMetrics.icHeight.toFixed(1)}"
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Pinion Angle</p>
            <p className="text-xl font-bold text-blue-400">{currentMetrics.pinionAngle.toFixed(1)}°</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">CG Height</p>
            <p className="text-xl font-bold text-purple-400">{currentMetrics.cgHeight.toFixed(1)}"</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Rear Weight</p>
            <p className="text-xl font-bold text-orange-400">{currentMetrics.rearWeightPercent.toFixed(1)}%</p>
          </div>
        </div>

        {/* Detailed Analysis */}
        {showDetailedAnalysis && (
          <div className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    rec.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                    rec.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    rec.severity === 'critical' ? 'bg-red-500/20' :
                    rec.severity === 'warning' ? 'bg-yellow-500/20' :
                    'bg-blue-500/20'
                  }`}>
                    {rec.severity === 'critical' ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : rec.severity === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{rec.area}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        rec.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        rec.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {rec.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-400">Current: <span className="text-white">{rec.current}</span></span>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                      <span className="text-slate-400">Target: <span className="text-green-400">{rec.recommended}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-400">{rec.adjustment}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Setup is optimized!</p>
                  <p className="text-sm text-slate-400">Your current configuration is within optimal ranges for the selected conditions.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommended Adjustments */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Track-Specific Tips */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" />
            {trackPresets[selectedTrackCondition].name} Tips
          </h4>
          <ul className="space-y-3">
            {trackPresets[selectedTrackCondition].recommendations.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-400 text-xs font-bold">{idx + 1}</span>
                </div>
                <span className="text-slate-300">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weather-Specific Tips */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            {React.createElement(weatherPresets[selectedWeather].icon, { className: 'w-5 h-5 text-blue-400' })}
            {weatherPresets[selectedWeather].name} Adjustments
          </h4>
          <ul className="space-y-3">
            {weatherPresets[selectedWeather].tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs font-bold">{idx + 1}</span>
                </div>
                <span className="text-slate-300">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Apply Section */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              Quick Apply Recommended Settings
            </h4>
            <p className="text-sm text-slate-400">
              Apply shock and pinion angle adjustments for {trackPresets[selectedTrackCondition].name} + {weatherPresets[selectedWeather].name}
            </p>
            <div className="flex items-center gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">Pinion:</span>
                <span className="text-white font-medium">{quickAdjustments.pinionData.staticPinionAngle.toFixed(1)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-green-400" />
                <span className="text-slate-400">Rear Comp:</span>
                <span className="text-white font-medium">{quickAdjustments.shockSettings.lr.compression} clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400">Rear Rebound:</span>
                <span className="text-white font-medium">{quickAdjustments.shockSettings.lr.rebound} clicks</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleApplyQuickAdjustments}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <Play className="w-5 h-5" />
            Apply Settings
          </button>
        </div>
      </div>

      {/* Optimal Ranges Reference */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Optimal Ranges for {trackPresets[selectedTrackCondition].name}
        </h4>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">Anti-Squat</p>
            <p className="text-lg font-bold text-white">
              {trackPresets[selectedTrackCondition].antiSquatRange.min + weatherPresets[selectedWeather].adjustments.antiSquatMod}% - {trackPresets[selectedTrackCondition].antiSquatRange.max + weatherPresets[selectedWeather].adjustments.antiSquatMod}%
            </p>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${currentMetrics.antiSquat >= trackPresets[selectedTrackCondition].antiSquatRange.min && currentMetrics.antiSquat <= trackPresets[selectedTrackCondition].antiSquatRange.max ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ 
                  width: `${Math.min(100, Math.max(0, ((currentMetrics.antiSquat - 50) / 150) * 100))}%`,
                  marginLeft: `${Math.min(100, Math.max(0, ((trackPresets[selectedTrackCondition].antiSquatRange.min - 50) / 150) * 100))}%`
                }}
              />
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">IC Length</p>
            <p className="text-lg font-bold text-white">
              {trackPresets[selectedTrackCondition].icLengthRange.min}" - {trackPresets[selectedTrackCondition].icLengthRange.max}"
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">IC Height</p>
            <p className="text-lg font-bold text-white">
              {trackPresets[selectedTrackCondition].icHeightRange.min}" - {trackPresets[selectedTrackCondition].icHeightRange.max}"
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">Pinion Angle</p>
            <p className="text-lg font-bold text-white">
              {(trackPresets[selectedTrackCondition].pinionAngle + weatherPresets[selectedWeather].adjustments.pinionAngleMod).toFixed(1)}°
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">Rear Shock Comp</p>
            <p className="text-lg font-bold text-white">
              {trackPresets[selectedTrackCondition].rearShockCompression.min + weatherPresets[selectedWeather].adjustments.shockCompressionMod} - {trackPresets[selectedTrackCondition].rearShockCompression.max + weatherPresets[selectedWeather].adjustments.shockCompressionMod} clicks
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">Rear Spring Rate</p>
            <p className="text-lg font-bold text-white">
              {trackPresets[selectedTrackCondition].rearSpringRate.min} - {trackPresets[selectedTrackCondition].rearSpringRate.max} lb/in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupRecommendationEngine;
