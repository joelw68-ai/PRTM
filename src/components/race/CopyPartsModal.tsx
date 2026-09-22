// ═══════════════════════════════════════════════════════════════════════
// COPY PARTS MODAL — copy standalone parts from one main component to another
// ═══════════════════════════════════════════════════════════════════════
// Opened from the expanded Main Components card ("Copy to Component").
//
//   • Lists every OTHER main component, grouped by type (using the shared
//     MAIN_COMPONENT_TABS list — single source of truth).
//   • Checkboxes select which of the source component's standalone parts
//     to copy (all selected by default).
//   • Toggle: reset passes to 0 (default) or keep the current pass counts.
//   • Duplicate detection: a part whose name already exists on the target
//     is flagged and skipped.
//
// The modal owns the SELECTION UI only — the parent (MainComponents) performs
// the actual ComponentPart creation, wear-limit copy and db.upsertComponentPart
// persistence via the onConfirm callback.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Copy, CheckSquare, Square, Loader2, AlertCircle, Package, ArrowRight,
} from 'lucide-react';
import { ComponentPart } from '@/lib/database';
import {
  ExportableComponent,
  MAIN_COMPONENT_TABS,
  getTabLabel,
} from '@/lib/mainComponentsIO';

export interface CopyPartsResult {
  copied: number;
  skipped: number;
  failed: number;
}

interface CopyPartsModalProps {
  open: boolean;
  onClose: () => void;
  /** The component the parts are being copied FROM */
  source: ExportableComponent | null;
  /** The source component's standalone parts */
  sourceParts: ComponentPart[];
  /** Every main component (the source is filtered out internally) */
  allComponents: ExportableComponent[];
  /** All parts across all components — used for duplicate detection on the target */
  allParts: ComponentPart[];
  /** Performs the copy. Returns a summary for the toast. */
  onConfirm: (args: {
    targetId: string;
    partIds: string[];
    keepPasses: boolean;
  }) => Promise<CopyPartsResult>;
}

const CopyPartsModal: React.FC<CopyPartsModalProps> = ({
  open,
  onClose,
  source,
  sourceParts,
  allComponents,
  allParts,
  onConfirm,
}) => {
  const [targetId, setTargetId] = useState<string>('');
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [keepPasses, setKeepPasses] = useState(false);
  const [copying, setCopying] = useState(false);

  // Reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setTargetId('');
      setKeepPasses(false);
      setCopying(false);
      setSelectedPartIds(new Set(sourceParts.map(p => p.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source?.id]);

  // Candidate targets = every component except the source, grouped by type
  const grouped = useMemo(() => {
    const others = allComponents.filter(c => c.id !== source?.id);
    return MAIN_COMPONENT_TABS.map(tab => ({
      tab,
      items: others.filter(c => c.tabId === tab.id),
    })).filter(g => g.items.length > 0);
  }, [allComponents, source?.id]);

  // Part names already on the selected target (lower-cased for comparison)
  const targetPartNames = useMemo(() => {
    if (!targetId) return new Set<string>();
    return new Set(
      allParts
        .filter(p => p.componentId === targetId)
        .map(p => p.partName.trim().toLowerCase())
    );
  }, [allParts, targetId]);

  if (!open || !source) return null;

  const selectedParts = sourceParts.filter(p => selectedPartIds.has(p.id));
  const duplicateCount = selectedParts.filter(p =>
    targetPartNames.has(p.partName.trim().toLowerCase())
  ).length;
  const willCopyCount = selectedParts.length - duplicateCount;
  const targetComp = allComponents.find(c => c.id === targetId);

  const togglePart = (id: string) => {
    setSelectedPartIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = sourceParts.length > 0 && selectedPartIds.size === sourceParts.length;
  const toggleAll = () => {
    setSelectedPartIds(allSelected ? new Set() : new Set(sourceParts.map(p => p.id)));
  };

  const handleConfirm = async () => {
    if (!targetId || selectedParts.length === 0) return;
    setCopying(true);
    try {
      await onConfirm({
        targetId,
        partIds: Array.from(selectedPartIds),
        keepPasses,
      });
      onClose();
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => !copying && onClose()}
    >
      <div
        className="bg-slate-800 rounded-xl max-w-3xl w-full border border-slate-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-purple-400" />
              Copy Parts to Another Component
            </h3>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium">{source.name}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className={targetComp ? 'text-purple-300 font-medium' : 'italic'}>
                {targetComp ? targetComp.name : 'choose a destination below'}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" disabled={copying}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-5">
          {/* ── Destination picker ── */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">1. Destination component</h4>
            {grouped.length === 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-300 font-medium">No other components</p>
                  <p className="text-xs text-yellow-400/70 mt-1">
                    Create another main component first, then copy parts into it.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2 max-h-[46vh] overflow-y-auto space-y-3">
                {grouped.map(group => (
                  <div key={group.tab.id}>
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {getTabLabel(group.tab.id)}
                    </p>
                    <div className="space-y-1">
                      {group.items.map(c => {
                        const count = allParts.filter(p => p.componentId === c.id).length;
                        const active = targetId === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setTargetId(c.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                              active
                                ? 'bg-purple-500/20 border-purple-500/60'
                                : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm truncate ${active ? 'text-purple-200 font-medium' : 'text-slate-200'}`}>
                                {c.name}
                              </span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {count} part{count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {c.serialNumber && (
                              <span className="text-[10px] text-slate-500">S/N: {c.serialNumber}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Parts picker ── */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <h4 className="text-sm font-semibold text-white">
                2. Parts to copy ({selectedPartIds.size}/{sourceParts.length})
              </h4>
              {sourceParts.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {sourceParts.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">
                This component has no standalone parts to copy.
              </p>
            ) : (
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-2 max-h-[38vh] overflow-y-auto space-y-1">
                {sourceParts.map(p => {
                  const checked = selectedPartIds.has(p.id);
                  const isDup = targetPartNames.has(p.partName.trim().toLowerCase());
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePart(p.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                        checked ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/40 border-slate-700/40'
                      }`}
                    >
                      {checked
                        ? <CheckSquare className="w-4 h-4 text-orange-400 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                      <span className="text-sm text-slate-200 truncate flex-1">{p.partName}</span>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {p.passesOnPart} passes
                      </span>
                      {isDup && checked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold whitespace-nowrap">
                          DUPLICATE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Keep-passes toggle */}
            <div className="mt-3 flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div>
                <p className="text-sm text-slate-200">Keep current pass counts</p>
                <p className="text-[10px] text-slate-500">
                  {keepPasses ? 'Copies will carry over their pass counts' : 'Copies start at 0 passes (default)'}
                </p>
              </div>
              <div
                onClick={() => setKeepPasses(v => !v)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  keepPasses ? 'bg-purple-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  keepPasses ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-5">
          {targetId && selectedParts.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">
                <Package className="w-3 h-3" />
                {willCopyCount} will be copied
              </span>
              {duplicateCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/25">
                  {duplicateCount} skipped as duplicate{duplicateCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-slate-500">Wear limits are copied too.</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={copying}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={copying || !targetId || willCopyCount <= 0}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {copying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Copying…</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy {willCopyCount > 0 ? willCopyCount : ''} Part{willCopyCount !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopyPartsModal;
