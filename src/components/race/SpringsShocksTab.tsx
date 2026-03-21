import React, { useState, useMemo, useEffect } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import {
  Save,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Scale,
  Gauge,
  Ruler,
  ArrowUpDown,
  Clock,
  Plus,
  RotateCcw,
} from 'lucide-react';

interface CornerValues {
  lf: number;
  rf: number;
  lr: number;
  rr: number;
}

interface ShockCorner {
  compression: number;
  rebound: number;
}

interface SetupSnapshot {
  id: string;
  date: string;
  label: string;
  springRates: CornerValues;
  shockSettings: { lf: ShockCorner; rf: ShockCorner; lr: ShockCorner; rr: ShockCorner };
  rideHeights: CornerValues;
  cornerWeights: CornerValues;
}

const STORAGE_KEY = 'prtm_springs_shocks_history';

const defaultCorner: CornerValues = { lf: 0, rf: 0, lr: 0, rr: 0 };
const defaultShock: ShockCorner = { compression: 0, rebound: 0 };

const SpringsShocksTab: React.FC = () => {
  // Spring rates
  const [springRates, setSpringRates] = useState<CornerValues>({ lf: 250, rf: 250, lr: 175, rr: 175 });

  // Shock settings
  const [shocks, setShocks] = useState({
    lf: { compression: 6, rebound: 8 },
    rf: { compression: 6, rebound: 8 },
    lr: { compression: 4, rebound: 6 },
    rr: { compression: 4, rebound: 6 },
  });

  // Ride heights
  const [rideHeights, setRideHeights] = useState<CornerValues>({ lf: 4.5, rf: 4.5, lr: 5.0, rr: 5.0 });

  // Corner weights
  const [cornerWeights, setCornerWeights] = useState<CornerValues>({ lf: 850, rf: 850, lr: 1100, rr: 1100 });

  // History
  const [history, setHistory] = useState<SetupSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // Weight calculations
  const weightCalcs = useMemo(() => {
    const total = cornerWeights.lf + cornerWeights.rf + cornerWeights.lr + cornerWeights.rr;
    const front = cornerWeights.lf + cornerWeights.rf;
    const rear = cornerWeights.lr + cornerWeights.rr;
    const cross = total > 0 ? ((cornerWeights.lr + cornerWeights.rf) / total) * 100 : 0;
    return { total, front, rear, cross, frontPct: total > 0 ? (front / total) * 100 : 0, rearPct: total > 0 ? (rear / total) * 100 : 0 };
  }, [cornerWeights]);

  // Save snapshot
  const saveSnapshot = () => {
    const snapshot: SetupSnapshot = {
      id: `SS-${Date.now()}`,
      date: new Date().toISOString(),
      label: snapshotLabel || `Setup ${history.length + 1}`,
      springRates: { ...springRates },
      shockSettings: {
        lf: { ...shocks.lf },
        rf: { ...shocks.rf },
        lr: { ...shocks.lr },
        rr: { ...shocks.rr },
      },
      rideHeights: { ...rideHeights },
      cornerWeights: { ...cornerWeights },
    };
    setHistory(prev => [snapshot, ...prev].slice(0, 100));
    setSnapshotLabel('');
  };

  // Load snapshot
  const loadSnapshot = (snap: SetupSnapshot) => {
    setSpringRates(snap.springRates);
    setShocks(snap.shockSettings);
    setRideHeights(snap.rideHeights);
    setCornerWeights(snap.cornerWeights);
  };

  // Delete snapshot
  const deleteSnapshot = (id: string) => {
    setHistory(prev => prev.filter(s => s.id !== id));
  };

  const cornerLabels = ['LF', 'RF', 'LR', 'RR'] as const;
  const cornerKeys = ['lf', 'rf', 'lr', 'rr'] as const;
  const cornerColors = ['blue', 'purple', 'green', 'orange'] as const;

  return (
    <div className="space-y-6">
      {/* Save Bar */}
      <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <input
          type="text"
          value={snapshotLabel}
          onChange={(e) => setSnapshotLabel(e.target.value)}
          placeholder="Setup label (e.g., 'Bristol Round 1')..."
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <button
          onClick={saveSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          Save Snapshot
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            showHistory ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <History className="w-4 h-4" />
          History ({history.length})
        </button>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-amber-500/20 p-4 max-h-64 overflow-y-auto">
          <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Setup History — Date Stamped
          </h4>
          <div className="space-y-2">
            {history.map((snap) => (
              <div key={snap.id} className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/50"
                  onClick={() => setExpandedSnapshot(expandedSnapshot === snap.id ? null : snap.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-white">{snap.label}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(snap.date).toLocaleString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); loadSnapshot(snap); }}
                      className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 font-medium"
                    >
                      Load
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSnapshot(snap.id); }}
                      className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {expandedSnapshot === snap.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandedSnapshot === snap.id && (
                  <div className="border-t border-slate-700/50 p-3 grid grid-cols-4 gap-2 text-xs">
                    {cornerKeys.map((k, i) => (
                      <div key={k} className="bg-slate-800/50 rounded p-2 text-center">
                        <p className="text-slate-500 mb-1">{cornerLabels[i]}</p>
                        <p className="text-white">Spring: {snap.springRates[k]} lb/in</p>
                        <p className="text-white">Comp: {snap.shockSettings[k].compression} / Reb: {snap.shockSettings[k].rebound}</p>
                        <p className="text-white">RH: {snap.rideHeights[k]}"</p>
                        <p className="text-white">Wt: {snap.cornerWeights[k]} lbs</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spring Rates */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Ruler className="w-5 h-5 text-orange-400" />
          Spring Rate (lb/in)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cornerKeys.map((k, i) => (
            <div key={k} className={`bg-slate-900/50 rounded-lg p-4 border border-${cornerColors[i]}-500/30 text-center`}>
              <p className={`text-xs text-${cornerColors[i]}-400 font-medium mb-2`}>{cornerLabels[i]}</p>
              <input
                type="number"
                value={springRates[k]}
                onChange={(e) => setSpringRates(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-transparent text-2xl font-bold text-white text-center border-none outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">lb/in</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shock Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-orange-400" />
          Shock Compression & Rebound (clicks)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cornerKeys.map((k, i) => (
            <div key={k} className={`bg-slate-900/50 rounded-lg p-4 border border-${cornerColors[i]}-500/30`}>
              <p className={`text-xs text-${cornerColors[i]}-400 font-medium mb-3 text-center`}>{cornerLabels[i]}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 text-center">Compression</label>
                  <input
                    type="number"
                    value={shocks[k].compression}
                    onChange={(e) => setShocks(prev => ({ ...prev, [k]: { ...prev[k], compression: parseFloat(e.target.value) || 0 } }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-center text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 text-center">Rebound</label>
                  <input
                    type="number"
                    value={shocks[k].rebound}
                    onChange={(e) => setShocks(prev => ({ ...prev, [k]: { ...prev[k], rebound: parseFloat(e.target.value) || 0 } }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-center text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ride Heights */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-orange-400" />
          Ride Height (inches)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cornerKeys.map((k, i) => (
            <div key={k} className={`bg-slate-900/50 rounded-lg p-4 border border-${cornerColors[i]}-500/30 text-center`}>
              <p className={`text-xs text-${cornerColors[i]}-400 font-medium mb-2`}>{cornerLabels[i]}</p>
              <input
                type="number"
                step="0.125"
                value={rideHeights[k]}
                onChange={(e) => setRideHeights(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-transparent text-2xl font-bold text-white text-center border-none outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">inches</p>
            </div>
          ))}
        </div>
      </div>

      {/* Corner Weights */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-orange-400" />
          Corner Weights (lbs)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cornerKeys.map((k, i) => (
            <div key={k} className={`bg-slate-900/50 rounded-lg p-4 border border-${cornerColors[i]}-500/30 text-center`}>
              <p className={`text-xs text-${cornerColors[i]}-400 font-medium mb-2`}>{cornerLabels[i]}</p>
              <input
                type="number"
                value={cornerWeights[k]}
                onChange={(e) => setCornerWeights(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-transparent text-2xl font-bold text-white text-center border-none outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">lbs</p>
            </div>
          ))}
        </div>

        {/* Weight summary */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/30">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Total Weight</p>
            <p className="text-lg font-bold text-white">{weightCalcs.total.toFixed(0)} lbs</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/30">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Front / Rear</p>
            <p className="text-sm font-bold text-white">{weightCalcs.frontPct.toFixed(1)}% / {weightCalcs.rearPct.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/30">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Cross Weight</p>
            <p className={`text-lg font-bold ${Math.abs(weightCalcs.cross - 50) <= 1 ? 'text-green-400' : 'text-amber-400'}`}>
              {weightCalcs.cross.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/30">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Left / Right</p>
            <p className="text-sm font-bold text-white">
              {weightCalcs.total > 0 ? (((cornerWeights.lf + cornerWeights.lr) / weightCalcs.total) * 100).toFixed(1) : '0.0'}% / {weightCalcs.total > 0 ? (((cornerWeights.rf + cornerWeights.rr) / weightCalcs.total) * 100).toFixed(1) : '0.0'}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpringsShocksTab;
