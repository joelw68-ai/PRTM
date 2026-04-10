import React, { useState, useEffect, useMemo } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import { useApp } from '@/contexts/AppContext';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Circle,
  RotateCcw,
  Gauge,
  Ruler,
  History,
  AlertTriangle,
  CheckCircle,
  Archive,
  TrendingDown,
  ArrowRightLeft,
} from 'lucide-react';

// ============ TYPES ============

export interface TireSet {
  id: string;
  brand: string;
  model: string;
  size: string;
  compound: string;
  position: 'Front Left' | 'Front Right' | 'Rear Left' | 'Rear Right' | 'Front (Pair)' | 'Rear (Pair)';
  status: 'Active' | 'Spare' | 'Retired';
  installDate: string;
  totalPasses: number;
  notes: string;
}

export interface TreadDepthEntry {
  id: string;
  tireSetId: string;
  date: string;
  depth: number; // in 32nds of an inch
  passCount: number;
  location: string; // 'Inner', 'Center', 'Outer'
  notes: string;
}

export interface TirePressureEntry {
  id: string;
  tireSetId: string;
  date: string;
  passNumber: number;
  pressureBefore: number;
  pressureAfter: number;
  hotPressure?: number;
  trackTemp?: number;
  notes: string;
}

export interface TireChangeLog {
  id: string;
  date: string;
  passCount: number;
  tireSetId: string;
  tireSetName: string;
  action: 'Install' | 'Remove' | 'Rotate' | 'Replace';
  reason: string;
  performedBy: string;
  notes: string;
}

// ============ LOCAL STORAGE KEYS ============
const LS_TIRE_SETS = 'tire_tracking_sets';
const LS_TREAD_DEPTH = 'tire_tracking_tread_depth';
const LS_PRESSURE = 'tire_tracking_pressure';
const LS_CHANGE_LOG = 'tire_tracking_change_log';

// ============ HELPERS ============
function loadFromLS<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToLS<T>(key: string, data: T[]) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============ COMPOUND OPTIONS ============
const COMPOUND_OPTIONS = [
  'Drag Slick',
  'DOT Drag Radial',
  'Street/Strip',
  'Pro Bracket Radial',
  'Bias Ply Slick',
  'Radial Slick',
  'Front Runner',
  'Skinny Front',
  'Other',
];

const POSITION_OPTIONS: TireSet['position'][] = [
  'Front (Pair)',
  'Rear (Pair)',
  'Front Left',
  'Front Right',
  'Rear Left',
  'Rear Right',
];

const CHANGE_REASONS = [
  'Scheduled Replacement',
  'Excessive Wear',
  'Damage / Cut',
  'Traction Issues',
  'Rotation',
  'Season Change',
  'Testing New Compound',
  'Other',
];

// ============ SUB-TAB TYPE ============
type SubTab = 'sets' | 'tread' | 'pressure' | 'changelog';

// ============ COMPONENT ============

const TireTracking: React.FC = () => {
  const { passLogs } = useApp();

  // Data state
  const [tireSets, setTireSets] = useState<TireSet[]>(() => loadFromLS(LS_TIRE_SETS, []));
  const [treadDepth, setTreadDepth] = useState<TreadDepthEntry[]>(() => loadFromLS(LS_TREAD_DEPTH, []));
  const [pressureHistory, setPressureHistory] = useState<TirePressureEntry[]>(() => loadFromLS(LS_PRESSURE, []));
  const [changeLog, setChangeLog] = useState<TireChangeLog[]>(() => loadFromLS(LS_CHANGE_LOG, []));

  // UI state
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('sets');
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [showTireModal, setShowTireModal] = useState(false);
  const [editingTire, setEditingTire] = useState<TireSet | null>(null);
  const [showTreadModal, setShowTreadModal] = useState(false);
  const [showPressureModal, setShowPressureModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedTireId, setSelectedTireId] = useState<string>('');

  // Persist on change
  useEffect(() => { saveToLS(LS_TIRE_SETS, tireSets); }, [tireSets]);
  useEffect(() => { saveToLS(LS_TREAD_DEPTH, treadDepth); }, [treadDepth]);
  useEffect(() => { saveToLS(LS_PRESSURE, pressureHistory); }, [pressureHistory]);
  useEffect(() => { saveToLS(LS_CHANGE_LOG, changeLog); }, [changeLog]);

  // ============ SYNC FROM APPCONTEXT (pass log add/delete auto-increments) ============
  // When AppContext addPassLog or deletePassLog updates tire set pass counts in
  // localStorage, it dispatches a 'tire-sets-passes-updated' custom event.
  // Listen for that event and reload tire sets from localStorage to keep the
  // React state in sync with what AppContext wrote.
  useEffect(() => {
    const handleTirePassesUpdated = () => {
      const updated = loadFromLS<TireSet>(LS_TIRE_SETS, []);
      setTireSets(updated);
    };
    window.addEventListener('tire-sets-passes-updated', handleTirePassesUpdated);
    return () => window.removeEventListener('tire-sets-passes-updated', handleTirePassesUpdated);
  }, []);


  // ============ TIRE SET FORM STATE ============
  const defaultTire: TireSet = {
    id: '', brand: '', model: '', size: '', compound: 'Drag Slick',
    position: 'Rear (Pair)', status: 'Active', installDate: getLocalDateString(),
    totalPasses: 0, notes: '',
  };
  const [tireForm, setTireForm] = useState<TireSet>(defaultTire);

  // ============ TREAD DEPTH FORM STATE ============
  const defaultTread: TreadDepthEntry = {
    id: '', tireSetId: '', date: getLocalDateString(), depth: 0,
    passCount: 0, location: 'Center', notes: '',
  };
  const [treadForm, setTreadForm] = useState<TreadDepthEntry>(defaultTread);

  // ============ PRESSURE FORM STATE ============
  const defaultPressure: TirePressureEntry = {
    id: '', tireSetId: '', date: getLocalDateString(), passNumber: 0,
    pressureBefore: 0, pressureAfter: 0, hotPressure: undefined,
    trackTemp: undefined, notes: '',
  };
  const [pressureForm, setPressureForm] = useState<TirePressureEntry>(defaultPressure);

  // ============ CHANGE LOG FORM STATE ============
  const defaultChange: TireChangeLog = {
    id: '', date: getLocalDateString(), passCount: 0, tireSetId: '',
    tireSetName: '', action: 'Replace', reason: 'Scheduled Replacement',
    performedBy: '', notes: '',
  };
  const [changeForm, setChangeForm] = useState<TireChangeLog>(defaultChange);

  // ============ COMPUTED ============
  const activeSets = useMemo(() => tireSets.filter(t => t.status === 'Active'), [tireSets]);
  const spareSets = useMemo(() => tireSets.filter(t => t.status === 'Spare'), [tireSets]);
  const retiredSets = useMemo(() => tireSets.filter(t => t.status === 'Retired'), [tireSets]);
  const totalPassCount = passLogs.length;

  const getTreadForTire = (tireId: string) =>
    treadDepth.filter(t => t.tireSetId === tireId).sort((a, b) => b.date.localeCompare(a.date));

  const getPressureForTire = (tireId: string) =>
    pressureHistory.filter(p => p.tireSetId === tireId).sort((a, b) => b.passNumber - a.passNumber);

  const getChangeLogForTire = (tireId: string) =>
    changeLog.filter(c => c.tireSetId === tireId).sort((a, b) => b.date.localeCompare(a.date));

  const getLatestTread = (tireId: string) => {
    const entries = getTreadForTire(tireId);
    return entries.length > 0 ? entries[0] : null;
  };

  const getLatestPressure = (tireId: string) => {
    const entries = getPressureForTire(tireId);
    return entries.length > 0 ? entries[0] : null;
  };

  // ============ HANDLERS ============
  const handleSaveTire = () => {
    if (!tireForm.brand || !tireForm.model) return;
    if (editingTire) {
      setTireSets(prev => prev.map(t => t.id === editingTire.id ? { ...tireForm, id: editingTire.id } : t));
    } else {
      setTireSets(prev => [...prev, { ...tireForm, id: genId('TIRE') }]);
    }
    setShowTireModal(false);
    setEditingTire(null);
    setTireForm(defaultTire);
  };

  const handleDeleteTire = (id: string) => {
    if (!confirm('Delete this tire set? All associated tread depth and pressure data will also be removed.')) return;
    setTireSets(prev => prev.filter(t => t.id !== id));
    setTreadDepth(prev => prev.filter(t => t.tireSetId !== id));
    setPressureHistory(prev => prev.filter(p => p.tireSetId !== id));
    setChangeLog(prev => prev.filter(c => c.tireSetId !== id));
  };

  const handleSaveTread = () => {
    if (!treadForm.tireSetId || treadForm.depth <= 0) return;
    setTreadDepth(prev => [...prev, { ...treadForm, id: genId('TD') }]);
    setShowTreadModal(false);
    setTreadForm(defaultTread);
  };

  const handleDeleteTread = (id: string) => {
    setTreadDepth(prev => prev.filter(t => t.id !== id));
  };

  const handleSavePressure = () => {
    if (!pressureForm.tireSetId) return;
    setPressureHistory(prev => [...prev, { ...pressureForm, id: genId('TP') }]);
    setShowPressureModal(false);
    setPressureForm(defaultPressure);
  };

  const handleDeletePressure = (id: string) => {
    setPressureHistory(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveChange = () => {
    if (!changeForm.tireSetId) return;
    const tire = tireSets.find(t => t.id === changeForm.tireSetId);
    setChangeLog(prev => [...prev, {
      ...changeForm,
      id: genId('TC'),
      tireSetName: tire ? `${tire.brand} ${tire.model}` : 'Unknown',
    }]);
    setShowChangeModal(false);
    setChangeForm(defaultChange);
  };

  const handleDeleteChange = (id: string) => {
    setChangeLog(prev => prev.filter(c => c.id !== id));
  };

  const openEditTire = (tire: TireSet) => {
    setEditingTire(tire);
    setTireForm(tire);
    setShowTireModal(true);
  };

  const openAddTread = (tireId?: string) => {
    const activeTire = tireSets.find(t => t.status === 'Active');
    setTreadForm({ ...defaultTread, tireSetId: tireId || activeTire?.id || '', passCount: totalPassCount });
    setShowTreadModal(true);
  };

  const openAddPressure = (tireId?: string) => {
    const activeTire = tireSets.find(t => t.status === 'Active');
    setPressureForm({ ...defaultPressure, tireSetId: tireId || activeTire?.id || '', passNumber: totalPassCount });
    setShowPressureModal(true);
  };

  const openAddChange = (tireId?: string) => {
    const activeTire = tireSets.find(t => t.status === 'Active');
    setChangeForm({ ...defaultChange, tireSetId: tireId || activeTire?.id || '', passCount: totalPassCount });
    setShowChangeModal(true);
  };

  const getStatusColor = (status: TireSet['status']) => {
    switch (status) {
      case 'Active': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Spare': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'Retired': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getStatusIcon = (status: TireSet['status']) => {
    switch (status) {
      case 'Active': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'Spare': return <Circle className="w-3.5 h-3.5" />;
      case 'Retired': return <Archive className="w-3.5 h-3.5" />;
    }
  };

  // ============ RENDER ============
  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Active Sets</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{activeSets.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Circle className="w-4 h-4" />
            <span className="text-sm">Spare Sets</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{spareSets.length}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <Gauge className="w-4 h-4" />
            <span className="text-sm">Pressure Records</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{pressureHistory.length}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="text-sm">Changes Logged</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{changeLog.length}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { id: 'sets' as SubTab, label: 'Tire Sets', icon: Circle },
          { id: 'tread' as SubTab, label: 'Tread Depth', icon: Ruler },
          { id: 'pressure' as SubTab, label: 'Pressure History', icon: Gauge },
          { id: 'changelog' as SubTab, label: 'Rotation / Replacement Log', icon: History },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ TIRE SETS TAB ============ */}
      {activeSubTab === 'sets' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingTire(null); setTireForm(defaultTire); setShowTireModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tire Set
            </button>
          </div>

          {tireSets.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Circle className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No Tire Sets Added</p>
              <p className="text-sm">Add your first tire set to start tracking wear, pressure, and changes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active */}
              {activeSets.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-green-400 font-bold mb-2">Active</h4>
                  {activeSets.map(tire => renderTireCard(tire))}
                </div>
              )}
              {/* Spare */}
              {spareSets.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-2 mt-4">Spare</h4>
                  {spareSets.map(tire => renderTireCard(tire))}
                </div>
              )}
              {/* Retired */}
              {retiredSets.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 mt-4">Retired</h4>
                  {retiredSets.map(tire => renderTireCard(tire))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============ TREAD DEPTH TAB ============ */}
      {activeSubTab === 'tread' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">Track tread depth measurements over time to monitor wear patterns.</p>
            <button
              onClick={() => openAddTread()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Measurement
            </button>
          </div>

          {treadDepth.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Ruler className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No Tread Depth Records</p>
              <p className="text-sm">Record tread depth measurements to track tire wear over time.</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Tire Set</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Location</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Depth (32nds)</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Pass Count</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Notes</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...treadDepth].sort((a, b) => b.date.localeCompare(a.date)).map(entry => {
                      const tire = tireSets.find(t => t.id === entry.tireSetId);
                      return (
                        <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-white text-sm">{entry.date}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="text-white">{tire ? `${tire.brand} ${tire.model}` : 'Unknown'}</span>
                            {tire && <span className="text-slate-500 ml-1 text-xs">({tire.position})</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-300 text-sm">{entry.location}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-mono font-bold ${
                              entry.depth <= 2 ? 'text-red-400' :
                              entry.depth <= 4 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {entry.depth}/32"
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-300 text-sm">{entry.passCount}</td>
                          <td className="px-4 py-3 text-slate-400 text-sm max-w-[200px] truncate">{entry.notes || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeleteTread(entry.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tread Wear Trend per Tire */}
          {activeSets.length > 0 && treadDepth.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-400" />
                Tread Wear Trends
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                {activeSets.map(tire => {
                  const entries = getTreadForTire(tire.id).reverse(); // oldest first
                  if (entries.length === 0) return null;
                  const latest = entries[entries.length - 1];
                  const first = entries[0];
                  const wearRate = entries.length >= 2
                    ? ((first.depth - latest.depth) / Math.max(1, latest.passCount - first.passCount)).toFixed(2)
                    : '—';
                  return (
                    <div key={tire.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-sm">{tire.brand} {tire.model}</span>
                        <span className="text-xs text-slate-400">{tire.position}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-slate-400">Initial</p>
                          <p className="text-sm font-bold text-slate-300">{first.depth}/32"</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Latest</p>
                          <p className={`text-sm font-bold ${
                            latest.depth <= 2 ? 'text-red-400' :
                            latest.depth <= 4 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>{latest.depth}/32"</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Wear/Pass</p>
                          <p className="text-sm font-bold text-orange-400">{wearRate}</p>
                        </div>
                      </div>
                      {/* Mini bar chart */}
                      <div className="flex items-end gap-1 mt-3 h-10">
                        {entries.map((e, i) => (
                          <div
                            key={e.id}
                            className={`flex-1 rounded-t ${
                              e.depth <= 2 ? 'bg-red-500' :
                              e.depth <= 4 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ height: `${Math.max(10, (e.depth / Math.max(...entries.map(x => x.depth))) * 100)}%` }}
                            title={`${e.date}: ${e.depth}/32" @ ${e.passCount} passes`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                        <span>{entries[0]?.date}</span>
                        <span>{entries[entries.length - 1]?.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ PRESSURE HISTORY TAB ============ */}
      {activeSubTab === 'pressure' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">Record tire pressure before and after each pass.</p>
            <button
              onClick={() => openAddPressure()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Pressure Record
            </button>
          </div>

          {/* Filter by tire */}
          {tireSets.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-400">Filter:</span>
              <button
                onClick={() => setSelectedTireId('')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedTireId === '' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All
              </button>
              {tireSets.filter(t => t.status !== 'Retired').map(tire => (
                <button
                  key={tire.id}
                  onClick={() => setSelectedTireId(tire.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedTireId === tire.id ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tire.brand} {tire.model} ({tire.position})
                </button>
              ))}
            </div>
          )}

          {pressureHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Gauge className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No Pressure Records</p>
              <p className="text-sm">Log tire pressure before and after each pass to track consistency.</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Tire Set</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Pass #</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Before (psi)</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">After (psi)</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Hot (psi)</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Track Temp</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Change</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Notes</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pressureHistory]
                      .filter(p => !selectedTireId || p.tireSetId === selectedTireId)
                      .sort((a, b) => b.passNumber - a.passNumber)
                      .map(entry => {
                        const tire = tireSets.find(t => t.id === entry.tireSetId);
                        const change = entry.pressureAfter - entry.pressureBefore;
                        return (
                          <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                            <td className="px-4 py-3 text-white text-sm">{entry.date}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-white">{tire ? `${tire.brand} ${tire.model}` : 'Unknown'}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-300 text-sm font-mono">{entry.passNumber}</td>
                            <td className="px-4 py-3 text-center text-white text-sm font-mono">{entry.pressureBefore.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center text-white text-sm font-mono">{entry.pressureAfter.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center text-slate-300 text-sm font-mono">
                              {entry.hotPressure ? entry.hotPressure.toFixed(1) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-300 text-sm">
                              {entry.trackTemp ? `${entry.trackTemp}°F` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm font-mono font-bold ${
                                change > 0 ? 'text-red-400' : change < 0 ? 'text-blue-400' : 'text-slate-400'
                              }`}>
                                {change > 0 ? '+' : ''}{change.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm max-w-[150px] truncate">{entry.notes || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleDeletePressure(entry.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ CHANGE LOG TAB ============ */}
      {activeSubTab === 'changelog' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">Track tire rotations, replacements, and changes with reasons.</p>
            <button
              onClick={() => openAddChange()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Change
            </button>
          </div>

          {changeLog.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <RotateCcw className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No Changes Logged</p>
              <p className="text-sm">Log tire rotations, replacements, and other changes here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...changeLog].sort((a, b) => b.date.localeCompare(a.date)).map(entry => {
                const actionColor = {
                  'Install': 'bg-green-500/20 text-green-400 border-green-500/50',
                  'Remove': 'bg-red-500/20 text-red-400 border-red-500/50',
                  'Rotate': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                  'Replace': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                }[entry.action];
                return (
                  <div key={entry.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${actionColor}`}>
                          {entry.action}
                        </span>
                        <div>
                          <p className="text-white font-medium">{entry.tireSetName}</p>
                          <p className="text-xs text-slate-400">{entry.date} &middot; Pass #{entry.passCount}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteChange(entry.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-400">Reason:</span>
                        <span className="text-white ml-1">{entry.reason}</span>
                      </div>
                      {entry.performedBy && (
                        <div>
                          <span className="text-slate-400">By:</span>
                          <span className="text-white ml-1">{entry.performedBy}</span>
                        </div>
                      )}
                      {entry.notes && (
                        <div className="col-span-2 md:col-span-1">
                          <span className="text-slate-400">Notes:</span>
                          <span className="text-slate-300 ml-1">{entry.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ============ MODALS ============ */}

      {/* Tire Set Modal */}
      {showTireModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingTire ? 'Edit Tire Set' : 'Add Tire Set'}
              </h3>
              <button onClick={() => { setShowTireModal(false); setEditingTire(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Brand *</label>
                  <input
                    type="text"
                    value={tireForm.brand}
                    onChange={e => setTireForm({ ...tireForm, brand: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., Mickey Thompson"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model *</label>
                  <input
                    type="text"
                    value={tireForm.model}
                    onChange={e => setTireForm({ ...tireForm, model: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., ET Drag"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Size</label>
                  <input
                    type="text"
                    value={tireForm.size}
                    onChange={e => setTireForm({ ...tireForm, size: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 33x10.5-15W"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Compound</label>
                  <select
                    value={tireForm.compound}
                    onChange={e => setTireForm({ ...tireForm, compound: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {COMPOUND_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Position</label>
                  <select
                    value={tireForm.position}
                    onChange={e => setTireForm({ ...tireForm, position: e.target.value as TireSet['position'] })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={tireForm.status}
                    onChange={e => setTireForm({ ...tireForm, status: e.target.value as TireSet['status'] })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Spare">Spare</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Install Date</label>
                  <DateInputDark
                    value={tireForm.installDate}
                    onChange={e => setTireForm({ ...tireForm, installDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Passes on Set</label>
                  <input
                    type="number"
                    value={tireForm.totalPasses}
                    onChange={e => setTireForm({ ...tireForm, totalPasses: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={tireForm.notes}
                  onChange={e => setTireForm({ ...tireForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowTireModal(false); setEditingTire(null); }} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button
                onClick={handleSaveTire}
                disabled={!tireForm.brand || !tireForm.model}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTire ? 'Save Changes' : 'Add Tire Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tread Depth Modal */}
      {showTreadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add Tread Depth Measurement</h3>
              <button onClick={() => setShowTreadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tire Set *</label>
                <select
                  value={treadForm.tireSetId}
                  onChange={e => setTreadForm({ ...treadForm, tireSetId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select tire set</option>
                  {tireSets.filter(t => t.status !== 'Retired').map(t => (
                    <option key={t.id} value={t.id}>{t.brand} {t.model} ({t.position})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <DateInputDark
                    value={treadForm.date}
                    onChange={e => setTreadForm({ ...treadForm, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Depth (32nds") *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={treadForm.depth || ''}
                    onChange={e => setTreadForm({ ...treadForm, depth: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 8"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Count</label>
                  <input
                    type="number"
                    value={treadForm.passCount}
                    onChange={e => setTreadForm({ ...treadForm, passCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Measurement Location</label>
                <select
                  value={treadForm.location}
                  onChange={e => setTreadForm({ ...treadForm, location: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="Inner">Inner</option>
                  <option value="Center">Center</option>
                  <option value="Outer">Outer</option>
                  <option value="Average">Average (all positions)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={treadForm.notes}
                  onChange={e => setTreadForm({ ...treadForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTreadModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button
                onClick={handleSaveTread}
                disabled={!treadForm.tireSetId || treadForm.depth <= 0}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Measurement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pressure Modal */}
      {showPressureModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add Pressure Record</h3>
              <button onClick={() => setShowPressureModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tire Set *</label>
                <select
                  value={pressureForm.tireSetId}
                  onChange={e => setPressureForm({ ...pressureForm, tireSetId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select tire set</option>
                  {tireSets.filter(t => t.status !== 'Retired').map(t => (
                    <option key={t.id} value={t.id}>{t.brand} {t.model} ({t.position})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <DateInputDark
                    value={pressureForm.date}
                    onChange={e => setPressureForm({ ...pressureForm, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Number</label>
                  <input
                    type="number"
                    value={pressureForm.passNumber}
                    onChange={e => setPressureForm({ ...pressureForm, passNumber: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pressure Before (psi)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pressureForm.pressureBefore || ''}
                    onChange={e => setPressureForm({ ...pressureForm, pressureBefore: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 5.0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pressure After (psi)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pressureForm.pressureAfter || ''}
                    onChange={e => setPressureForm({ ...pressureForm, pressureAfter: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 7.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Hot Pressure (psi)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pressureForm.hotPressure || ''}
                    onChange={e => setPressureForm({ ...pressureForm, hotPressure: parseFloat(e.target.value) || undefined })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Track Temp (°F)</label>
                  <input
                    type="number"
                    value={pressureForm.trackTemp || ''}
                    onChange={e => setPressureForm({ ...pressureForm, trackTemp: parseInt(e.target.value) || undefined })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={pressureForm.notes}
                  onChange={e => setPressureForm({ ...pressureForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPressureModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button
                onClick={handleSavePressure}
                disabled={!pressureForm.tireSetId}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Log Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Log Tire Change</h3>
              <button onClick={() => setShowChangeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tire Set *</label>
                <select
                  value={changeForm.tireSetId}
                  onChange={e => setChangeForm({ ...changeForm, tireSetId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select tire set</option>
                  {tireSets.map(t => (
                    <option key={t.id} value={t.id}>{t.brand} {t.model} ({t.position}) — {t.status}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Action</label>
                  <select
                    value={changeForm.action}
                    onChange={e => setChangeForm({ ...changeForm, action: e.target.value as TireChangeLog['action'] })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Install">Install</option>
                    <option value="Remove">Remove</option>
                    <option value="Rotate">Rotate</option>
                    <option value="Replace">Replace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Reason</label>
                  <select
                    value={changeForm.reason}
                    onChange={e => setChangeForm({ ...changeForm, reason: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {CHANGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <DateInputDark
                    value={changeForm.date}
                    onChange={e => setChangeForm({ ...changeForm, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Count at Change</label>
                  <input
                    type="number"
                    value={changeForm.passCount}
                    onChange={e => setChangeForm({ ...changeForm, passCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Performed By</label>
                <input
                  type="text"
                  value={changeForm.performedBy}
                  onChange={e => setChangeForm({ ...changeForm, performedBy: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={changeForm.notes}
                  onChange={e => setChangeForm({ ...changeForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowChangeModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button
                onClick={handleSaveChange}
                disabled={!changeForm.tireSetId}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ============ TIRE CARD RENDERER ============
  function renderTireCard(tire: TireSet) {
    const isExpanded = expandedSetId === tire.id;
    const latestTread = getLatestTread(tire.id);
    const latestPressure = getLatestPressure(tire.id);
    const tireChanges = getChangeLogForTire(tire.id);
    const tireTreads = getTreadForTire(tire.id);
    const tirePressures = getPressureForTire(tire.id);

    return (
      <div key={tire.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 mb-3 overflow-hidden">
        {/* Card Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
          onClick={() => setExpandedSetId(isExpanded ? null : tire.id)}
        >
          <div className="flex items-center gap-3">
            {/* Tire icon */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              tire.status === 'Active' ? 'bg-green-500/20' :
              tire.status === 'Spare' ? 'bg-blue-500/20' :
              'bg-slate-700/50'
            }`}>
              <Circle className={`w-5 h-5 ${
                tire.status === 'Active' ? 'text-green-400' :
                tire.status === 'Spare' ? 'text-blue-400' :
                'text-slate-500'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-white font-semibold">{tire.brand} {tire.model}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(tire.status)}`}>
                  {getStatusIcon(tire.status)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span>{tire.size}</span>
                <span>&middot;</span>
                <span>{tire.compound}</span>
                <span>&middot;</span>
                <span>{tire.position}</span>
                <span>&middot;</span>
                <span className="font-medium text-orange-400">{tire.totalPasses} passes</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick stats */}
            {latestTread && (
              <span className={`text-xs px-2 py-1 rounded ${
                latestTread.depth <= 2 ? 'bg-red-500/20 text-red-400' :
                latestTread.depth <= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {latestTread.depth}/32"
              </span>
            )}
            {latestPressure && (
              <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                {latestPressure.pressureBefore}→{latestPressure.pressureAfter} psi
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); openEditTire(tire); }}
              className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteTire(tire.id); }}
              className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-slate-700/50 p-4 bg-slate-900/30">
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Install Date</p>
                <p className="text-white text-sm">{tire.installDate}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Passes</p>
                <p className="text-white text-sm font-bold">{tire.totalPasses}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Notes</p>
                <p className="text-slate-300 text-sm">{tire.notes || 'No notes'}</p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => openAddTread(tire.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/30"
              >
                <Ruler className="w-3.5 h-3.5" />
                Add Tread Depth
              </button>
              <button
                onClick={() => openAddPressure(tire.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/30"
              >
                <Gauge className="w-3.5 h-3.5" />
                Add Pressure
              </button>
              <button
                onClick={() => openAddChange(tire.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Log Change
              </button>
            </div>

            {/* Recent tread depth */}
            {tireTreads.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Ruler className="w-3 h-3" /> Recent Tread Depth ({tireTreads.length})
                </h5>
                <div className="space-y-1">
                  {tireTreads.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-3 py-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{t.date}</span>
                        <span className="text-slate-500">{t.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold ${
                          t.depth <= 2 ? 'text-red-400' : t.depth <= 4 ? 'text-yellow-400' : 'text-green-400'
                        }`}>{t.depth}/32"</span>
                        <span className="text-slate-500">@ {t.passCount} passes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent pressure */}
            {tirePressures.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Gauge className="w-3 h-3" /> Recent Pressure ({tirePressures.length})
                </h5>
                <div className="space-y-1">
                  {tirePressures.slice(0, 3).map(p => {
                    const change = p.pressureAfter - p.pressureBefore;
                    return (
                      <div key={p.id} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-3 py-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{p.date}</span>
                          <span className="text-slate-500">Pass #{p.passNumber}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-mono">{p.pressureBefore}→{p.pressureAfter} psi</span>
                          <span className={`font-mono ${change > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            ({change > 0 ? '+' : ''}{change.toFixed(1)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent changes */}
            {tireChanges.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <History className="w-3 h-3" /> Change History ({tireChanges.length})
                </h5>
                <div className="space-y-1">
                  {tireChanges.slice(0, 3).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-3 py-1.5">
                      <div className="flex items-center gap-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          c.action === 'Install' ? 'bg-green-500/20 text-green-400' :
                          c.action === 'Remove' ? 'bg-red-500/20 text-red-400' :
                          c.action === 'Rotate' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>{c.action}</span>
                        <span className="text-slate-400">{c.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300">{c.reason}</span>
                        <span className="text-slate-500">@ {c.passCount} passes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tireTreads.length === 0 && tirePressures.length === 0 && tireChanges.length === 0 && (
              <p className="text-xs text-slate-500 italic">No tread depth, pressure, or change data recorded yet. Use the buttons above to start tracking.</p>
            )}
          </div>
        )}
      </div>
    );
  }
};

export default TireTracking;
