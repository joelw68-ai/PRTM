import React, { useState, useMemo } from 'react';
import {
  X,
  Wrench,
  ChevronRight,
  CheckCircle2,
  Info,
  Circle,
  Settings,
  Package,
  Ruler,
  Target,
  AlertTriangle
} from 'lucide-react';
import { 
  strangeBrackets, 
  getAllSeries, 
  getBracketById, 
  calculateMountHeight, 
  StrangeBracket, 
  BracketMountHole 
} from '@/data/strangeBrackets';

interface StrangeBracketSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  rearEndCenterHeight: number;
  onApplyBracket: (settings: {
    upperBarRearEndMountHeight: number;
    upperBarRearEndMountForward: number;
    lowerBarRearEndMountHeight: number;
    lowerBarRearEndMountForward: number;
  }) => void;
}

const StrangeBracketSelector: React.FC<StrangeBracketSelectorProps> = ({
  isOpen,
  onClose,
  rearEndCenterHeight,
  onApplyBracket
}) => {
  const [selectedSeries, setSelectedSeries] = useState<StrangeBracket['series']>('S-Series');
  const [selectedBracket, setSelectedBracket] = useState<StrangeBracket | null>(null);
  const [selectedUpperHole, setSelectedUpperHole] = useState<BracketMountHole | null>(null);
  const [selectedLowerHole, setSelectedLowerHole] = useState<BracketMountHole | null>(null);

  const seriesList = getAllSeries();
  
  const bracketsInSeries = useMemo(() => {
    return strangeBrackets.filter(b => b.series === selectedSeries);
  }, [selectedSeries]);

  const seriesColors: Record<StrangeBracket['series'], { bg: string; border: string; text: string }> = {
    'S-Series': { bg: 'from-red-500 to-orange-500', border: 'border-red-500/50', text: 'text-red-400' },
    'Pro Stock': { bg: 'from-blue-500 to-cyan-500', border: 'border-blue-500/50', text: 'text-blue-400' },
    'Ultra': { bg: 'from-purple-500 to-pink-500', border: 'border-purple-500/50', text: 'text-purple-400' },
    'Sportsman': { bg: 'from-green-500 to-emerald-500', border: 'border-green-500/50', text: 'text-green-400' },
    'Economy': { bg: 'from-yellow-500 to-amber-500', border: 'border-yellow-500/50', text: 'text-yellow-400' }
  };

  const seriesDescriptions: Record<StrangeBracket['series'], string> = {
    'S-Series': 'Premium Pro Mod & high-end applications',
    'Pro Stock': 'Traditional Pro Stock style brackets',
    'Ultra': 'Heavy duty for extreme horsepower',
    'Sportsman': 'Quality brackets for sportsman racing',
    'Economy': 'Budget-friendly entry-level options'
  };

  const handleSelectBracket = (bracket: StrangeBracket) => {
    setSelectedBracket(bracket);
    setSelectedUpperHole(null);
    setSelectedLowerHole(null);
  };

  const handleApply = () => {
    if (!selectedBracket || !selectedUpperHole || !selectedLowerHole) return;

    const upperHeight = calculateMountHeight(selectedUpperHole.heightFromAxle, rearEndCenterHeight);
    const lowerHeight = calculateMountHeight(selectedLowerHole.heightFromAxle, rearEndCenterHeight);

    onApplyBracket({
      upperBarRearEndMountHeight: upperHeight,
      upperBarRearEndMountForward: selectedUpperHole.forwardOfAxle,
      lowerBarRearEndMountHeight: lowerHeight,
      lowerBarRearEndMountForward: selectedLowerHole.forwardOfAxle
    });

    onClose();
  };

  const canApply = selectedBracket && selectedUpperHole && selectedLowerHole;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-6xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Strange Engineering Brackets</h3>
              <p className="text-sm text-slate-400">Select rear end mount brackets for your 4-link</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Rear End Height Info */}
        <div className="bg-slate-900/50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-400">Rear End Center Height:</span>
            <span className="text-lg font-bold text-blue-400">{rearEndCenterHeight}"</span>
            <span className="text-xs text-slate-500">(from ground)</span>
          </div>
          <p className="text-xs text-slate-500">Mount heights will be calculated based on this value</p>
        </div>

        {/* Series Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {seriesList.map(series => (
            <button
              key={series}
              onClick={() => { setSelectedSeries(series); setSelectedBracket(null); setSelectedUpperHole(null); setSelectedLowerHole(null); }}
              className={`flex flex-col items-start px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap min-w-[140px] ${
                selectedSeries === series
                  ? `bg-gradient-to-r ${seriesColors[series].bg} text-white shadow-lg`
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <span className="font-semibold">{series}</span>
              <span className={`text-xs ${selectedSeries === series ? 'text-white/80' : 'text-slate-500'}`}>
                {bracketsInSeries.length > 0 ? `${strangeBrackets.filter(b => b.series === series).length} brackets` : ''}
              </span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Bracket List */}
          <div className="w-1/3 overflow-y-auto space-y-2 pr-2">
            <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Available Brackets
            </h4>
            {bracketsInSeries.map(bracket => (
              <div
                key={bracket.id}
                onClick={() => handleSelectBracket(bracket)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedBracket?.id === bracket.id
                    ? `bg-slate-900 ${seriesColors[bracket.series].border} shadow-lg`
                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-semibold text-white text-sm">{bracket.name}</p>
                    <p className="text-xs text-slate-500">P/N: {bracket.partNumber}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    bracket.type === 'Weld-On' ? 'bg-orange-500/20 text-orange-400' :
                    bracket.type === 'Bolt-On' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {bracket.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{bracket.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500">{bracket.upperMountHoles.length} upper</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-500">{bracket.lowerMountHoles.length} lower</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-500">{bracket.material}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bracket Details & Hole Selection */}
          {selectedBracket ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Bracket Info */}
              <div className={`bg-slate-900/50 rounded-xl p-4 border ${seriesColors[selectedBracket.series].border}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white">{selectedBracket.name}</h4>
                    <p className="text-sm text-slate-400">Part Number: {selectedBracket.partNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${seriesColors[selectedBracket.series].text}`}>
                      {selectedBracket.series}
                    </span>
                    <p className="text-xs text-slate-500">{selectedBracket.weight} lbs/pair</p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-300 mb-3">{selectedBracket.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Applications</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedBracket.application.map((app, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Compatible Housings</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedBracket.housingCompatibility.map((housing, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {housing}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedBracket.notes && (
                  <div className="mt-3 p-2 bg-blue-500/10 rounded border border-blue-500/30">
                    <p className="text-xs text-blue-300">
                      <Info className="w-3 h-3 inline mr-1" />
                      {selectedBracket.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Hole Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Upper Mount Holes */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-blue-500/30">
                  <h5 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <Circle className="w-4 h-4" />
                    Upper Mount Hole
                  </h5>
                  <div className="space-y-2">
                    {selectedBracket.upperMountHoles.map(hole => {
                      const actualHeight = calculateMountHeight(hole.heightFromAxle, rearEndCenterHeight);
                      return (
                        <div
                          key={hole.id}
                          onClick={() => setSelectedUpperHole(hole)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedUpperHole?.id === hole.id
                              ? 'bg-blue-500/20 border-blue-500/50'
                              : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {selectedUpperHole?.id === hole.id ? (
                                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-500" />
                              )}
                              <span className="text-sm font-medium text-white">{hole.label}</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">From Axle:</span>
                              <span className="text-slate-300 ml-1">
                                {hole.heightFromAxle > 0 ? '+' : ''}{hole.heightFromAxle}"
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Forward:</span>
                              <span className="text-slate-300 ml-1">{hole.forwardOfAxle}"</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-500">Actual Height:</span>
                              <span className="text-blue-400 font-medium ml-1">{actualHeight.toFixed(2)}"</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lower Mount Holes */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-green-500/30">
                  <h5 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                    <Circle className="w-4 h-4" />
                    Lower Mount Hole
                  </h5>
                  <div className="space-y-2">
                    {selectedBracket.lowerMountHoles.map(hole => {
                      const actualHeight = calculateMountHeight(hole.heightFromAxle, rearEndCenterHeight);
                      return (
                        <div
                          key={hole.id}
                          onClick={() => setSelectedLowerHole(hole)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedLowerHole?.id === hole.id
                              ? 'bg-green-500/20 border-green-500/50'
                              : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {selectedLowerHole?.id === hole.id ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-500" />
                              )}
                              <span className="text-sm font-medium text-white">{hole.label}</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">From Axle:</span>
                              <span className="text-slate-300 ml-1">
                                {hole.heightFromAxle > 0 ? '+' : ''}{hole.heightFromAxle}"
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Forward:</span>
                              <span className="text-slate-300 ml-1">{hole.forwardOfAxle}"</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-500">Actual Height:</span>
                              <span className="text-green-400 font-medium ml-1">{actualHeight.toFixed(2)}"</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bracket Visualization */}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <h5 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-400" />
                  Bracket Visualization
                </h5>
                <svg width="100%" height="200" viewBox="0 0 400 200" className="bg-slate-800 rounded-lg">
                  <defs>
                    <pattern id="bracketGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
                    </pattern>
                    <linearGradient id="bracketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#64748b" />
                      <stop offset="50%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                  </defs>
                  
                  <rect width="100%" height="100%" fill="url(#bracketGrid)" />
                  
                  {/* Axle centerline */}
                  <line x1="200" y1="20" x2="200" y2="180" stroke="#ef4444" strokeWidth="2" strokeDasharray="6,3" />
                  <text x="200" y="195" fill="#ef4444" fontSize="10" textAnchor="middle">Axle CL</text>
                  
                  {/* Ground reference */}
                  <line x1="20" y1="160" x2="380" y2="160" stroke="#64748b" strokeWidth="1" />
                  <text x="30" y="175" fill="#64748b" fontSize="9">Ground</text>
                  
                  {/* Bracket body */}
                  <rect x="170" y="40" width="60" height="100" rx="4" fill="url(#bracketGrad)" stroke="#94a3b8" strokeWidth="2" />
                  
                  {/* Upper holes */}
                  {selectedBracket.upperMountHoles.map((hole, idx) => {
                    const y = 100 - (hole.heightFromAxle * 8);
                    const x = 200 + (hole.forwardOfAxle * 4);
                    const isSelected = selectedUpperHole?.id === hole.id;
                    return (
                      <g key={`upper-${idx}`}>
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={isSelected ? 10 : 7} 
                          fill={isSelected ? '#3b82f6' : '#1e293b'} 
                          stroke={isSelected ? '#93c5fd' : '#64748b'} 
                          strokeWidth={isSelected ? 3 : 2} 
                        />
                        {isSelected && (
                          <text x={x + 15} y={y + 4} fill="#3b82f6" fontSize="10" fontWeight="bold">
                            Upper
                          </text>
                        )}
                      </g>
                    );
                  })}
                  
                  {/* Lower holes */}
                  {selectedBracket.lowerMountHoles.map((hole, idx) => {
                    const y = 100 - (hole.heightFromAxle * 8);
                    const x = 200 + (hole.forwardOfAxle * 4);
                    const isSelected = selectedLowerHole?.id === hole.id;
                    return (
                      <g key={`lower-${idx}`}>
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={isSelected ? 10 : 7} 
                          fill={isSelected ? '#22c55e' : '#1e293b'} 
                          stroke={isSelected ? '#86efac' : '#64748b'} 
                          strokeWidth={isSelected ? 3 : 2} 
                        />
                        {isSelected && (
                          <text x={x + 15} y={y + 4} fill="#22c55e" fontSize="10" fontWeight="bold">
                            Lower
                          </text>
                        )}
                      </g>
                    );
                  })}
                  
                  {/* Legend */}
                  <rect x="280" y="20" width="100" height="50" fill="#1e293b" rx="4" stroke="#334155" />
                  <circle cx="295" cy="35" r={5} fill="#3b82f6" />
                  <text x="305" y="38" fill="#94a3b8" fontSize="9">Upper Holes</text>
                  <circle cx="295" cy="55" r={5} fill="#22c55e" />
                  <text x="305" y="58" fill="#94a3b8" fontSize="9">Lower Holes</text>
                </svg>
              </div>

              {/* Selection Summary */}
              {(selectedUpperHole || selectedLowerHole) && (
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-orange-500/30">
                  <h5 className="font-medium text-orange-400 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Selection Summary
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-3 rounded-lg ${selectedUpperHole ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                      <p className="text-xs text-slate-500 mb-1">Upper Mount</p>
                      {selectedUpperHole ? (
                        <>
                          <p className="text-white font-medium">{selectedUpperHole.label}</p>
                          <p className="text-sm text-blue-400">
                            Height: {calculateMountHeight(selectedUpperHole.heightFromAxle, rearEndCenterHeight).toFixed(2)}" | 
                            Forward: {selectedUpperHole.forwardOfAxle}"
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm">Not selected</p>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg ${selectedLowerHole ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                      <p className="text-xs text-slate-500 mb-1">Lower Mount</p>
                      {selectedLowerHole ? (
                        <>
                          <p className="text-white font-medium">{selectedLowerHole.label}</p>
                          <p className="text-sm text-green-400">
                            Height: {calculateMountHeight(selectedLowerHole.heightFromAxle, rearEndCenterHeight).toFixed(2)}" | 
                            Forward: {selectedLowerHole.forwardOfAxle}"
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm">Not selected</p>
                      )}
                    </div>
                  </div>
                  
                  {selectedUpperHole && selectedLowerHole && (
                    <div className="mt-3 p-2 bg-slate-800/50 rounded">
                      <p className="text-xs text-slate-400">
                        <Ruler className="w-3 h-3 inline mr-1" />
                        Rear Spread: {(
                          calculateMountHeight(selectedUpperHole.heightFromAxle, rearEndCenterHeight) -
                          calculateMountHeight(selectedLowerHole.heightFromAxle, rearEndCenterHeight)
                        ).toFixed(2)}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a bracket to view details</p>
                <p className="text-sm mt-1">Choose from the list on the left</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
          <div className="text-sm text-slate-400">
            {selectedBracket && (
              <span>
                Selected: <span className="text-white font-medium">{selectedBracket.name}</span>
                {selectedUpperHole && selectedLowerHole && (
                  <span className="text-green-400 ml-2">
                    <CheckCircle2 className="w-4 h-4 inline" /> Ready to apply
                  </span>
                )}
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
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply Bracket Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrangeBracketSelector;
