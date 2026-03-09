import React, { useMemo } from 'react';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Trophy,
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  Cloud,
  Clock,
  MapPin,
  Settings,
  TrendingUp,
  TrendingDown,
  Equal,
  Zap,
  Timer
} from 'lucide-react';
import { PassLogEntry, Engine, Supercharger } from '@/data/proModData';

interface PassComparisonProps {
  selectedPasses: PassLogEntry[];
  engines: Engine[];
  superchargers: Supercharger[];
  onClose: () => void;
}

interface MetricComparison {
  label: string;
  values: (number | string)[];
  deltas?: number[];
  bestIndex?: number;
  worstIndex?: number;
  unit?: string;
  lowerIsBetter?: boolean;
  isNumeric?: boolean;
  precision?: number;
}

const PassComparison: React.FC<PassComparisonProps> = ({
  selectedPasses,
  engines,
  superchargers,
  onClose
}) => {
  // Sort passes by date/time for consistent ordering
  const sortedPasses = useMemo(() => {
    return [...selectedPasses].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [selectedPasses]);

  // Calculate deltas and find best/worst for numeric metrics
  const calculateMetricComparison = (
    values: number[],
    lowerIsBetter: boolean = true,
    precision: number = 3
  ): { deltas: number[]; bestIndex: number; worstIndex: number } => {
    if (values.length < 2) {
      return { deltas: [], bestIndex: 0, worstIndex: 0 };
    }

    // Use first pass as baseline for deltas
    const baseline = values[0];
    const deltas = values.map((v, i) => i === 0 ? 0 : v - baseline);

    // Find best and worst
    let bestIndex = 0;
    let worstIndex = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (lowerIsBetter) {
        if (values[i] < values[bestIndex]) bestIndex = i;
        if (values[i] > values[worstIndex]) worstIndex = i;
      } else {
        if (values[i] > values[bestIndex]) bestIndex = i;
        if (values[i] < values[worstIndex]) worstIndex = i;
      }
    }

    return { deltas, bestIndex, worstIndex };
  };

  // Performance metrics
  const performanceMetrics: MetricComparison[] = useMemo(() => {
    const rtValues = sortedPasses.map(p => p.reactionTime);
    const sixtyValues = sortedPasses.map(p => p.sixtyFoot);
    const threeThirtyValues = sortedPasses.map(p => p.threeThirty);
    const eighthValues = sortedPasses.map(p => p.eighth);
    const mphValues = sortedPasses.map(p => p.mph);
    
    // Calculate splits
    const frontSplitValues = sortedPasses.map(p => p.threeThirty - p.sixtyFoot);
    const backSplitValues = sortedPasses.map(p => p.eighth - p.threeThirty);

    return [
      {
        label: 'Reaction Time',
        values: rtValues,
        ...calculateMetricComparison(rtValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: "60' Time",
        values: sixtyValues,
        ...calculateMetricComparison(sixtyValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: "330' Time",
        values: threeThirtyValues,
        ...calculateMetricComparison(threeThirtyValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: '1/8 Mile ET',
        values: eighthValues,
        ...calculateMetricComparison(eighthValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: 'MPH',
        values: mphValues,
        ...calculateMetricComparison(mphValues, false, 1),
        unit: '',
        lowerIsBetter: false,
        isNumeric: true,
        precision: 1
      },
      {
        label: "Front Split (330'-60')",
        values: frontSplitValues,
        ...calculateMetricComparison(frontSplitValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: "Back Split (1/8-330')",
        values: backSplitValues,
        ...calculateMetricComparison(backSplitValues, true, 3),
        unit: 's',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      }
    ];
  }, [sortedPasses]);

  // Weather metrics
  const weatherMetrics: MetricComparison[] = useMemo(() => {
    const tempValues = sortedPasses.map(p => p.weather.temperature);
    const humidityValues = sortedPasses.map(p => p.weather.humidity);
    const pressureValues = sortedPasses.map(p => p.weather.pressure);
    const windValues = sortedPasses.map(p => p.weather.windSpeed);
    const trackTempValues = sortedPasses.map(p => p.weather.trackTemp);

    return [
      {
        label: 'Air Temperature',
        values: tempValues,
        ...calculateMetricComparison(tempValues, true, 0),
        unit: '°F',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Track Temperature',
        values: trackTempValues,
        ...calculateMetricComparison(trackTempValues, true, 0),
        unit: '°F',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Humidity',
        values: humidityValues,
        ...calculateMetricComparison(humidityValues, true, 0),
        unit: '%',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Barometric Pressure',
        values: pressureValues,
        ...calculateMetricComparison(pressureValues, false, 2),
        unit: '"Hg',
        lowerIsBetter: false,
        isNumeric: true,
        precision: 2
      },
      {
        label: 'Wind Speed',
        values: windValues,
        ...calculateMetricComparison(windValues, true, 0),
        unit: 'mph',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Wind Direction',
        values: sortedPasses.map(p => p.weather.windDirection),
        isNumeric: false
      },
      {
        label: 'Conditions',
        values: sortedPasses.map(p => p.weather.conditions),
        isNumeric: false
      }
    ];
  }, [sortedPasses]);

  // SAE metrics
  const saeMetrics: MetricComparison[] = useMemo(() => {
    const saeValues = sortedPasses.map(p => p.saeCorrection);
    const daValues = sortedPasses.map(p => p.densityAltitude);
    const hpValues = sortedPasses.map(p => p.correctedHP);

    return [
      {
        label: 'SAE Correction',
        values: saeValues,
        ...calculateMetricComparison(saeValues, true, 3),
        unit: '',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 3
      },
      {
        label: 'Density Altitude',
        values: daValues,
        ...calculateMetricComparison(daValues, true, 0),
        unit: 'ft',
        lowerIsBetter: true,
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Corrected HP',
        values: hpValues,
        ...calculateMetricComparison(hpValues, false, 0),
        unit: '',
        lowerIsBetter: false,
        isNumeric: true,
        precision: 0
      }
    ];
  }, [sortedPasses]);

  // Setup metrics
  const setupMetrics: MetricComparison[] = useMemo(() => {
    const launchRPMValues = sortedPasses.map(p => p.launchRPM);
    const boostValues = sortedPasses.map(p => p.boostSetting);
    const wheelieBarValues = sortedPasses.map(p => p.wheelieBarSetting);
    const frontTireValues = sortedPasses.map(p => p.tirePressureFront);
    const rearLeftValues = sortedPasses.map(p => p.tirePressureRearLeft);
    const rearRightValues = sortedPasses.map(p => p.tirePressureRearRight);

    return [
      {
        label: 'Launch RPM',
        values: launchRPMValues,
        deltas: launchRPMValues.map((v, i) => i === 0 ? 0 : v - launchRPMValues[0]),
        unit: '',
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Boost Setting',
        values: boostValues,
        deltas: boostValues.map((v, i) => i === 0 ? 0 : v - boostValues[0]),
        unit: 'psi',
        isNumeric: true,
        precision: 0
      },
      {
        label: 'Wheelie Bar',
        values: wheelieBarValues,
        deltas: wheelieBarValues.map((v, i) => i === 0 ? 0 : v - wheelieBarValues[0]),
        unit: '"',
        isNumeric: true,
        precision: 2
      },
      {
        label: 'Front Tire PSI',
        values: frontTireValues,
        deltas: frontTireValues.map((v, i) => i === 0 ? 0 : v - frontTireValues[0]),
        unit: '',
        isNumeric: true,
        precision: 1
      },
      {
        label: 'Rear Left PSI',
        values: rearLeftValues,
        deltas: rearLeftValues.map((v, i) => i === 0 ? 0 : v - rearLeftValues[0]),
        unit: '',
        isNumeric: true,
        precision: 1
      },
      {
        label: 'Rear Right PSI',
        values: rearRightValues,
        deltas: rearRightValues.map((v, i) => i === 0 ? 0 : v - rearRightValues[0]),
        unit: '',
        isNumeric: true,
        precision: 1
      },
      {
        label: 'Engine',
        values: sortedPasses.map(p => engines.find(e => e.id === p.engineId)?.name || 'Unknown'),
        isNumeric: false
      },
      {
        label: 'Supercharger',
        values: sortedPasses.map(p => superchargers.find(s => s.id === p.superchargerId)?.name || 'Unknown'),
        isNumeric: false
      }
    ];
  }, [sortedPasses, engines, superchargers]);

  // Render delta indicator
  const renderDelta = (delta: number, lowerIsBetter: boolean = true, precision: number = 3) => {
    if (delta === 0) {
      return (
        <span className="text-slate-500 text-xs flex items-center gap-1">
          <Equal className="w-3 h-3" />
          baseline
        </span>
      );
    }

    const isGood = lowerIsBetter ? delta < 0 : delta > 0;
    const isBad = lowerIsBetter ? delta > 0 : delta < 0;
    const sign = delta > 0 ? '+' : '';

    return (
      <span className={`text-xs flex items-center gap-1 ${isGood ? 'text-green-400' : isBad ? 'text-red-400' : 'text-slate-400'}`}>
        {isGood ? <TrendingUp className="w-3 h-3" /> : isBad ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {sign}{delta.toFixed(precision)}
      </span>
    );
  };

  // Render metric row
  const renderMetricRow = (metric: MetricComparison, index: number) => {
    return (
      <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20">
        <td className="px-4 py-3 text-sm text-slate-300 font-medium sticky left-0 bg-slate-800/95 z-10">
          {metric.label}
        </td>
        {metric.values.map((value, i) => {
          const isBest = metric.bestIndex === i && metric.isNumeric;
          const isWorst = metric.worstIndex === i && metric.isNumeric && metric.bestIndex !== metric.worstIndex;
          const delta = metric.deltas?.[i];
          
          return (
            <td 
              key={i} 
              className={`px-4 py-3 text-center ${
                isBest ? 'bg-green-500/10' : isWorst ? 'bg-red-500/10' : ''
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className={`font-mono ${
                  isBest ? 'text-green-400 font-bold' : 
                  isWorst ? 'text-red-400' : 
                  'text-white'
                }`}>
                  {metric.isNumeric 
                    ? (value as number).toFixed(metric.precision || 3)
                    : value}
                  {metric.unit && <span className="text-slate-400 text-xs ml-1">{metric.unit}</span>}
                </span>
                {delta !== undefined && metric.isNumeric && (
                  renderDelta(delta, metric.lowerIsBetter, metric.precision || 3)
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  // Find best pass overall (by 1/8 mile ET)
  const bestPassIndex = useMemo(() => {
    let bestIdx = 0;
    let bestET = sortedPasses[0].eighth;
    
    sortedPasses.forEach((pass, i) => {
      if (pass.eighth < bestET) {
        bestET = pass.eighth;
        bestIdx = i;
      }
    });
    
    return bestIdx;
  }, [sortedPasses]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              Pass Comparison
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Comparing {sortedPasses.length} passes • Deltas calculated from first pass (baseline)
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Pass Headers */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400 sticky left-0 bg-slate-800 z-10 min-w-[180px]">
                    Pass Info
                  </th>
                  {sortedPasses.map((pass, i) => (
                    <th key={pass.id} className={`px-4 py-3 text-center min-w-[160px] ${
                      i === bestPassIndex ? 'bg-green-500/10' : ''
                    }`}>
                      <div className="flex flex-col items-center gap-1">
                        {i === bestPassIndex && (
                          <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                            <Trophy className="w-3 h-3" />
                            Best Pass
                          </span>
                        )}
                        <span className="text-white font-bold">{pass.id}</span>
                        <span className="text-slate-400 text-xs">{pass.date}</span>
                        <span className="text-slate-500 text-xs">{pass.time}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Basic Info */}
                <tr className="border-b border-slate-700/30">
                  <td className="px-4 py-2 text-sm text-slate-300 sticky left-0 bg-slate-800/95 z-10">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Track
                    </div>
                  </td>
                  {sortedPasses.map((pass, i) => (
                    <td key={i} className={`px-4 py-2 text-center text-sm text-white ${
                      i === bestPassIndex ? 'bg-green-500/10' : ''
                    }`}>
                      {pass.track}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/30">
                  <td className="px-4 py-2 text-sm text-slate-300 sticky left-0 bg-slate-800/95 z-10">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Session
                    </div>
                  </td>
                  {sortedPasses.map((pass, i) => (
                    <td key={i} className={`px-4 py-2 text-center text-sm text-white ${
                      i === bestPassIndex ? 'bg-green-500/10' : ''
                    }`}>
                      {pass.sessionType} {pass.round && `(${pass.round})`}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/30">
                  <td className="px-4 py-2 text-sm text-slate-300 sticky left-0 bg-slate-800/95 z-10">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-slate-400" />
                      Result
                    </div>
                  </td>
                  {sortedPasses.map((pass, i) => (
                    <td key={i} className={`px-4 py-2 text-center ${
                      i === bestPassIndex ? 'bg-green-500/10' : ''
                    }`}>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pass.result === 'Win' ? 'bg-green-500/20 text-green-400' :
                        pass.result === 'Loss' ? 'bg-red-500/20 text-red-400' :
                        pass.result === 'Red Light' ? 'bg-red-500/20 text-red-400' :
                        pass.result === 'Broke' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {pass.result}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Metrics */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Timer className="w-5 h-5 text-green-400" />
              Performance Metrics
            </h4>
            <div className="overflow-x-auto bg-slate-900/30 rounded-lg border border-slate-700/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400 sticky left-0 bg-slate-900/95 z-10 min-w-[180px]">
                      Metric
                    </th>
                    {sortedPasses.map((pass, i) => (
                      <th key={pass.id} className={`px-4 py-3 text-center min-w-[140px] text-sm font-medium text-slate-400 ${
                        i === bestPassIndex ? 'bg-green-500/10' : ''
                      }`}>
                        {pass.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {performanceMetrics.map((metric, i) => renderMetricRow(metric, i))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weather Metrics */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              Weather Conditions
            </h4>
            <div className="overflow-x-auto bg-slate-900/30 rounded-lg border border-slate-700/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400 sticky left-0 bg-slate-900/95 z-10 min-w-[180px]">
                      Metric
                    </th>
                    {sortedPasses.map((pass, i) => (
                      <th key={pass.id} className={`px-4 py-3 text-center min-w-[140px] text-sm font-medium text-slate-400 ${
                        i === bestPassIndex ? 'bg-green-500/10' : ''
                      }`}>
                        {pass.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weatherMetrics.map((metric, i) => renderMetricRow(metric, i))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SAE Metrics */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              SAE Correction & Density Altitude
            </h4>
            <div className="overflow-x-auto bg-slate-900/30 rounded-lg border border-slate-700/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400 sticky left-0 bg-slate-900/95 z-10 min-w-[180px]">
                      Metric
                    </th>
                    {sortedPasses.map((pass, i) => (
                      <th key={pass.id} className={`px-4 py-3 text-center min-w-[140px] text-sm font-medium text-slate-400 ${
                        i === bestPassIndex ? 'bg-green-500/10' : ''
                      }`}>
                        {pass.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saeMetrics.map((metric, i) => renderMetricRow(metric, i))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Setup Metrics */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Car Setup
            </h4>
            <div className="overflow-x-auto bg-slate-900/30 rounded-lg border border-slate-700/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400 sticky left-0 bg-slate-900/95 z-10 min-w-[180px]">
                      Metric
                    </th>
                    {sortedPasses.map((pass, i) => (
                      <th key={pass.id} className={`px-4 py-3 text-center min-w-[140px] text-sm font-medium text-slate-400 ${
                        i === bestPassIndex ? 'bg-green-500/10' : ''
                      }`}>
                        {pass.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setupMetrics.map((metric, i) => renderMetricRow(metric, i))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes Comparison */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Notes
            </h4>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${sortedPasses.length}, minmax(200px, 1fr))` }}>
              {sortedPasses.map((pass, i) => (
                <div 
                  key={pass.id} 
                  className={`p-4 rounded-lg border ${
                    i === bestPassIndex 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-slate-900/30 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-400">{pass.id}</span>
                    {i === bestPassIndex && (
                      <Trophy className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <p className="text-sm text-white">
                    {pass.notes || <span className="text-slate-500 italic">No notes</span>}
                  </p>
                  {pass.crewChief && (
                    <p className="text-xs text-slate-400 mt-2">
                      Crew Chief: {pass.crewChief}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-slate-700 flex-shrink-0 bg-slate-800">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></div>
              <span className="text-slate-400">Best Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></div>
              <span className="text-slate-400">Worst Value</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-slate-400">Improvement</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-slate-400">Regression</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PassComparison;
