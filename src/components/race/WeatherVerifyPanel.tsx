import React, { useState, useMemo } from 'react';
import {
  X,
  Thermometer,
  Droplets,
  Gauge,
  FlaskConical,
  RotateCcw,
  Clipboard,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  accurateSatVaporPressureInHg,
  calculateVaporPressure,
  calculateWaterGrains,
  calculateDewPoint,
  calculateWetBulb,
  calculateSTDCorrection,
} from '@/lib/weather';

interface WeatherVerifyPanelProps {
  onClose: () => void;
  initialTemp?: number;
  initialHumidity?: number;
  initialPressure?: number;
}

interface CalculatedValues {
  tempF: number;
  humidityPct: number;
  pressureInHg: number;
  tempC: number;
  satVP_hPa: number;
  satVP_inHg: number;
  actualVP_inHg: number;
  dryPressure_inHg: number;
  mixingRatio: number;
  waterGrains: number;
  dewPoint: number;
  wetBulb: number;
  saeCorrection: number;
  densityAltitude: number;
  correctedHP: number;
  stdCorrection: number;
}

function computeAll(tempF: number, humidityPct: number, pressureInHg: number): CalculatedValues {
  const tempC = (tempF - 32) * 5 / 9;
  const esHpa = 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  const satVP_inHg = esHpa / 33.8639;
  const actualVP_inHg = (humidityPct / 100) * satVP_inHg;
  const dryPressure_inHg = pressureInHg - actualVP_inHg;
  const mixingRatio = dryPressure_inHg > 0 ? 0.62198 * (actualVP_inHg / dryPressure_inHg) : 0;
  const waterGrains = calculateWaterGrains(tempF, humidityPct, pressureInHg);
  const dewPoint = calculateDewPoint(tempF, humidityPct);
  const wetBulb = calculateWetBulb(tempF, humidityPct);
  const stdCorrection = calculateSTDCorrection(tempF, pressureInHg, humidityPct);

  // Inline SAE J607 calculation (same as PassLog's calculateSAE)
  const tempFactor = Math.sqrt((tempF + 460) / 520);
  const pressureFactor = Math.sqrt(29.92 / pressureInHg);
  const humidityFactor = dryPressure_inHg > 0 ? Math.sqrt(29.92 / dryPressure_inHg) : 1;
  const saeCorrection = tempFactor * pressureFactor * humidityFactor;
  const stationPressure = pressureInHg * 33.8639;
  const densityAltitude = Math.round(145442.16 * (1 - Math.pow((stationPressure / 1013.25), 0.190284)));
  const correctedHP = Math.round(3500 * saeCorrection);

  return {
    tempF, humidityPct, pressureInHg, tempC,
    satVP_hPa: esHpa, satVP_inHg, actualVP_inHg, dryPressure_inHg,
    mixingRatio, waterGrains, dewPoint, wetBulb,
    saeCorrection, densityAltitude, correctedHP, stdCorrection,
  };
}

const PRESETS = [
  { label: 'STP (60°F / 0% / 29.92")', temp: 60, humidity: 0, pressure: 29.92 },
  { label: 'Hot Summer (95°F / 60% / 29.85")', temp: 95, humidity: 60, pressure: 29.85 },
  { label: 'Cool Evening (72°F / 45% / 30.05")', temp: 72, humidity: 45, pressure: 30.05 },
  { label: 'Typical Race Day (80°F / 50% / 29.92")', temp: 80, humidity: 50, pressure: 29.92 },
  { label: 'High Humidity (85°F / 80% / 29.80")', temp: 85, humidity: 80, pressure: 29.80 },
  { label: 'Cold Morning (55°F / 35% / 30.10")', temp: 55, humidity: 35, pressure: 30.10 },
];

const WeatherVerifyPanel: React.FC<WeatherVerifyPanelProps> = ({
  onClose,
  initialTemp = 80,
  initialHumidity = 50,
  initialPressure = 29.92,
}) => {
  const [mode, setMode] = useState<'current' | 'manual'>('current');
  const [manualTemp, setManualTemp] = useState(initialTemp);
  const [manualHumidity, setManualHumidity] = useState(initialHumidity);
  const [manualPressure, setManualPressure] = useState(initialPressure);
  const [showFormulas, setShowFormulas] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentValues = useMemo(() => computeAll(initialTemp, initialHumidity, initialPressure), [initialTemp, initialHumidity, initialPressure]);
  const manualValues = useMemo(() => computeAll(manualTemp, manualHumidity, manualPressure), [manualTemp, manualHumidity, manualPressure]);
  const activeValues = mode === 'current' ? currentValues : manualValues;

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setManualTemp(preset.temp);
    setManualHumidity(preset.humidity);
    setManualPressure(preset.pressure);
    setMode('manual');
  };

  const handleReset = () => {
    setManualTemp(initialTemp);
    setManualHumidity(initialHumidity);
    setManualPressure(initialPressure);
  };

  const handleCopyResults = () => {
    const v = activeValues;
    const text = [
      `Weather Verification — ${mode === 'current' ? 'Current Pass Data' : 'Manual Input'}`,
      `─────────────────────────────────────────`,
      `Inputs:`,
      `  Air Temp:       ${v.tempF}°F (${v.tempC.toFixed(1)}°C)`,
      `  Humidity:       ${v.humidityPct}%`,
      `  Barometer:      ${v.pressureInHg.toFixed(2)}" Hg`,
      ``,
      `Saturation VP:    ${v.satVP_inHg.toFixed(4)}" Hg (${v.satVP_hPa.toFixed(2)} hPa)`,
      `Actual VP:        ${v.actualVP_inHg.toFixed(4)}" Hg`,
      `Dry Air Pressure: ${v.dryPressure_inHg.toFixed(4)}" Hg`,
      `Mixing Ratio:     ${v.mixingRatio.toFixed(5)} lb/lb`,
      `Water Grains:     ${v.waterGrains.toFixed(1)} gr/lb`,
      `Dew Point:        ${v.dewPoint.toFixed(1)}°F`,
      `Wet Bulb:         ${v.wetBulb.toFixed(1)}°F`,
      `SAE Correction:   ${v.saeCorrection.toFixed(3)}`,
      `STD Correction:   ${v.stdCorrection.toFixed(4)}`,
      `Density Altitude: ${v.densityAltitude} ft`,
      `Corrected HP:     ${v.correctedHP}`,
      ``,
      `Formula: Buck (1981) equation for SVP`,
      `  es(hPa) = 6.1121 × exp((18.678 − T/234.5) × (T/(257.14 + T)))`,
      `  Water Grains = 4354 × (ActualVP / (Baro − ActualVP))`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const ResultRow = ({ label, value, unit, highlight, sublabel }: { label: string; value: string; unit?: string; highlight?: 'cyan' | 'yellow' | 'orange' | 'green' | 'white'; sublabel?: string; }) => {
    const colorClass = { cyan: 'text-cyan-300', yellow: 'text-yellow-400', orange: 'text-orange-300', green: 'text-green-400', white: 'text-white' }[highlight || 'white'];
    return (
      <div className="flex justify-between items-baseline py-1.5 border-b border-slate-700/30 last:border-0">
        <div>
          <span className="text-slate-400 text-sm">{label}</span>
          {sublabel && <span className="text-slate-600 text-xs ml-1">({sublabel})</span>}
        </div>
        <span className={`font-mono text-sm font-medium ${colorClass}`}>
          {value}{unit && <span className="text-slate-500 ml-1 text-xs">{unit}</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
        <div className="bg-slate-800 rounded-xl max-w-3xl w-full border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Verify Weather Calculations</h3>
                <p className="text-slate-400 text-sm">Cross-check against RaceAir, Altus, Computech</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg">
              <button onClick={() => setMode('current')} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'current' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                Current Pass Data
              </button>
              <button onClick={() => setMode('manual')} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                Manual Input
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {mode === 'manual' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"><Thermometer className="w-3 h-3" />Air Temp (°F)</label>
                    <input type="number" value={manualTemp} onChange={(e) => setManualTemp(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"><Droplets className="w-3 h-3" />Humidity (%)</label>
                    <input type="number" min="0" max="100" value={manualHumidity} onChange={(e) => setManualHumidity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"><Gauge className="w-3 h-3" />Barometer (inHg)</label>
                    <input type="number" step="0.01" value={manualPressure} onChange={(e) => setManualPressure(parseFloat(e.target.value) || 29.92)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">Quick Test Presets:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESETS.map((preset, i) => (
                      <button key={i} onClick={() => handlePreset(preset)} className="text-left px-2.5 py-1.5 text-xs bg-slate-900/50 border border-slate-700/50 rounded hover:border-cyan-500/50 hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-300 transition-all">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                  <RotateCcw className="w-3 h-3" />Reset to pass data
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-2">Input values from current pass:</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <Thermometer className="w-4 h-4 text-red-400 mx-auto mb-1" />
                    <p className="text-white font-mono font-bold">{initialTemp}°F</p>
                    <p className="text-slate-500 text-xs">Air Temp</p>
                  </div>
                  <div className="text-center">
                    <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <p className="text-white font-mono font-bold">{initialHumidity}%</p>
                    <p className="text-slate-500 text-xs">Humidity</p>
                  </div>
                  <div className="text-center">
                    <Gauge className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <p className="text-white font-mono font-bold">{initialPressure.toFixed(2)}"</p>
                    <p className="text-slate-500 text-xs">Barometer</p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-cyan-400 font-medium text-sm mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4" />Vapor Pressure & Moisture</h4>
                <div className="space-y-0">
                  <ResultRow label="Temp (°C)" value={activeValues.tempC.toFixed(2)} unit="°C" highlight="white" sublabel="converted" />
                  <ResultRow label="Sat. Vapor Pressure" value={activeValues.satVP_hPa.toFixed(3)} unit="hPa" highlight="cyan" sublabel="Buck eq." />
                  <ResultRow label="Sat. Vapor Pressure" value={activeValues.satVP_inHg.toFixed(4)} unit='" Hg' highlight="cyan" sublabel="converted" />
                  <ResultRow label="Actual Vapor Pressure" value={activeValues.actualVP_inHg.toFixed(4)} unit='" Hg' highlight="green" />
                  <ResultRow label="Dry Air Pressure" value={activeValues.dryPressure_inHg.toFixed(4)} unit='" Hg' highlight="white" sublabel="Baro - VP" />
                  <ResultRow label="Mixing Ratio" value={activeValues.mixingRatio.toFixed(5)} unit="lb/lb" highlight="white" sublabel="0.62198 × VP/Pd" />
                  <div className="pt-2 mt-2 border-t border-cyan-500/20">
                    <ResultRow label="Water Grains" value={activeValues.waterGrains.toFixed(1)} unit="gr/lb" highlight="cyan" />
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-yellow-400 font-medium text-sm mb-3 flex items-center gap-2"><Gauge className="w-4 h-4" />Corrections & Derived Values</h4>
                <div className="space-y-0">
                  <ResultRow label="Dew Point" value={activeValues.dewPoint.toFixed(1)} unit="°F" highlight="cyan" />
                  <ResultRow label="Wet Bulb" value={activeValues.wetBulb.toFixed(1)} unit="°F" highlight="cyan" />
                  <div className="pt-2 mt-2 border-t border-yellow-500/20">
                    <ResultRow label="SAE Correction" value={activeValues.saeCorrection.toFixed(3)} highlight="yellow" sublabel="J607" />
                  </div>
                  <ResultRow label="STD Correction" value={activeValues.stdCorrection.toFixed(4)} highlight="orange" />
                  <ResultRow label="Density Altitude" value={activeValues.densityAltitude.toLocaleString()} unit="ft" highlight="white" />
                  <ResultRow label="Corrected HP" value={activeValues.correctedHP.toLocaleString()} unit="hp" highlight="green" sublabel="base 3500" />
                </div>
              </div>
            </div>

            {/* Formula Reference */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50">
              <button onClick={() => setShowFormulas(!showFormulas)} className="w-full flex items-center justify-between p-3 text-sm text-slate-400 hover:text-white transition-colors">
                <span className="flex items-center gap-2"><Info className="w-4 h-4" />Formula Reference (Buck 1981 Equation)</span>
                {showFormulas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showFormulas && (
                <div className="px-4 pb-4 space-y-3 text-xs">
                  <div className="bg-slate-950/50 rounded p-3 font-mono text-slate-300 space-y-1.5 border border-slate-700/30">
                    <p className="text-cyan-400 font-sans font-medium text-xs mb-2">Saturation Vapor Pressure (Buck 1981):</p>
                    <p>T_c = (T_f - 32) × 5/9</p>
                    <p>es(hPa) = 6.1121 × exp((18.678 - T_c/234.5) × (T_c/(257.14 + T_c)))</p>
                    <p>es(inHg) = es(hPa) / 33.8639</p>
                  </div>
                  <div className="bg-slate-950/50 rounded p-3 font-mono text-slate-300 space-y-1.5 border border-slate-700/30">
                    <p className="text-green-400 font-sans font-medium text-xs mb-2">Actual Vapor Pressure:</p>
                    <p>VP = (RH / 100) × es</p>
                  </div>
                  <div className="bg-slate-950/50 rounded p-3 font-mono text-slate-300 space-y-1.5 border border-slate-700/30">
                    <p className="text-cyan-400 font-sans font-medium text-xs mb-2">Water Grains (NHRA Standard):</p>
                    <p>Pd = Baro - VP &nbsp;&nbsp;(dry air pressure)</p>
                    <p>w = 0.62198 × (VP / Pd) &nbsp;&nbsp;(mixing ratio)</p>
                    <p>Grains = w × 7000 = 4354 × (VP / Pd)</p>
                  </div>
                  <div className="bg-slate-950/50 rounded p-3 font-mono text-slate-300 space-y-1.5 border border-slate-700/30">
                    <p className="text-yellow-400 font-sans font-medium text-xs mb-2">SAE J607 Correction:</p>
                    <p>TF = sqrt((T_f + 460) / 520)</p>
                    <p>PF = sqrt(29.92 / Baro)</p>
                    <p>HF = sqrt(29.92 / Pd)</p>
                    <p>SAE = TF × PF × HF</p>
                  </div>
                  <p className="text-slate-500 italic">These formulas match RaceAir, Altus, Computech, and other NHRA-standard weather stations. The Buck equation is accurate to within 0.05% across all racing temperatures.</p>
                </div>
              )}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-400 text-xs leading-relaxed">
                <strong>How to verify:</strong> Enter the exact same Air Temp, Humidity, and Barometer values from your RaceAir, Altus, or Computech unit into Manual Input mode above. The Water Grains, Vapor Pressure, Dew Point, and SAE Correction should match within rounding (typically ±0.1 gr/lb for water grains, ±0.001 for SAE).
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-700">
            <button onClick={handleCopyResults} className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition-colors">
              {copied ? (<><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied!</span></>) : (<><Clipboard className="w-4 h-4" />Copy Results</>)}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherVerifyPanel;
