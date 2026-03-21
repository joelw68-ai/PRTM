import React, { useState, useMemo } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';
import DateInputDark from '@/components/ui/DateInputDark';
import { ComponentPart } from '@/lib/database';
import * as db from '@/lib/database';
import {
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckSquare,
  Square,
  X,
  Wrench,
  Zap,
  Wind,
  Cog,
  Settings,
  RefreshCw,
  Package,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface RebuildWizardProps {
  engines: any[];
  superchargers: any[];
  drivetrainComponents: any[];
  componentParts: ComponentPart[];
  updateEngine: (id: string, data: any) => Promise<void>;
  updateSupercharger: (id: string, data: any) => Promise<void>;
  updateDrivetrainComponent: (id: string, data: any) => Promise<void>;
  setComponentParts: React.Dispatch<React.SetStateAction<ComponentPart[]>>;
  setDirtyPartIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  extraFields: Record<string, any>;
  setExtraFields: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  userId?: string;
  onClose: () => void;
}

type WizardStep = 'select' | 'configure' | 'parts' | 'notes' | 'summary';

interface ComponentOption {
  id: string;
  name: string;
  type: 'engine' | 'supercharger' | 'drivetrain';
  category?: string;
  totalPasses: number;
  passesSinceRebuild: number;
  currentlyInstalled: boolean;
  icon: any;
}

const REBUILD_LOG_KEY = 'mainComp_rebuildLog';

function loadRebuildLog(): Array<{ date: string; componentId: string; componentName: string; notes: string; partsReset: number }> {
  try {
    const raw = localStorage.getItem(REBUILD_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRebuildLog(log: any[]) {
  try { localStorage.setItem(REBUILD_LOG_KEY, JSON.stringify(log)); } catch {}
}

const RebuildWizard: React.FC<RebuildWizardProps> = ({
  engines, superchargers, drivetrainComponents, componentParts,
  updateEngine, updateSupercharger, updateDrivetrainComponent,
  setComponentParts, setDirtyPartIds, extraFields, setExtraFields,
  userId, onClose
}) => {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [rebuildDate, setRebuildDate] = useState(getLocalDateString());
  const [resetPassesSinceRebuild, setResetPassesSinceRebuild] = useState(true);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectAllParts, setSelectAllParts] = useState(false);
  const [rebuildNotes, setRebuildNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Build component options list
  const componentOptions: ComponentOption[] = useMemo(() => {
    const options: ComponentOption[] = [];
    for (const eng of engines) {
      options.push({
        id: eng.id, name: eng.name, type: 'engine',
        totalPasses: eng.totalPasses, passesSinceRebuild: eng.passesSinceRebuild,
        currentlyInstalled: eng.currentlyInstalled, icon: Zap,
      });
    }
    for (const sc of superchargers) {
      options.push({
        id: sc.id, name: sc.name, type: 'supercharger',
        totalPasses: sc.totalPasses, passesSinceRebuild: sc.passesSinceService,
        currentlyInstalled: sc.currentlyInstalled, icon: Wind,
      });
    }
    for (const dt of drivetrainComponents) {
      const iconMap: Record<string, any> = {
        'transmission': Cog, 'transmission_drive': Settings,
        'torque_converter': RefreshCw, 'third_member': Wrench, 'ring_and_pinion': Wrench,
      };
      options.push({
        id: dt.id, name: dt.name, type: 'drivetrain', category: dt.category,
        totalPasses: dt.totalPasses, passesSinceRebuild: dt.passesSinceService,
        currentlyInstalled: dt.currentlyInstalled, icon: iconMap[dt.category] || Wrench,
      });
    }
    return options;
  }, [engines, superchargers, drivetrainComponents]);

  const selectedComponent = componentOptions.find(c => c.id === selectedComponentId);
  const partsForSelected = useMemo(() => {
    if (!selectedComponentId) return [];
    return componentParts.filter(p => p.componentId === selectedComponentId);
  }, [selectedComponentId, componentParts]);

  // Toggle part selection
  const togglePart = (partId: string) => {
    setSelectedPartIds(prev => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  };

  const handleSelectAllParts = () => {
    if (selectAllParts) {
      setSelectedPartIds(new Set());
      setSelectAllParts(false);
    } else {
      setSelectedPartIds(new Set(partsForSelected.map(p => p.id)));
      setSelectAllParts(true);
    }
  };

  // Navigate steps
  const canProceed = () => {
    if (step === 'select') return !!selectedComponentId;
    return true;
  };

  const nextStep = () => {
    const steps: WizardStep[] = ['select', 'configure', 'parts', 'notes', 'summary'];
    const idx = steps.indexOf(step);
    // Skip parts step if no parts exist
    if (step === 'configure' && partsForSelected.length === 0) {
      setStep('notes');
    } else if (idx < steps.length - 1) {
      setStep(steps[idx + 1]);
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ['select', 'configure', 'parts', 'notes', 'summary'];
    const idx = steps.indexOf(step);
    // Skip parts step if no parts exist
    if (step === 'notes' && partsForSelected.length === 0) {
      setStep('configure');
    } else if (idx > 0) {
      setStep(steps[idx - 1]);
    }
  };

  // Execute the rebuild
  const handleConfirmRebuild = async () => {
    if (!selectedComponent) return;
    setSaving(true);

    try {
      const today = rebuildDate || getLocalDateString();

      // 1. Reset passesSinceRebuild on the component
      if (selectedComponent.type === 'engine') {
        await updateEngine(selectedComponent.id, {
          passesSinceRebuild: resetPassesSinceRebuild ? 0 : selectedComponent.passesSinceRebuild,
        });
      } else if (selectedComponent.type === 'supercharger') {
        await updateSupercharger(selectedComponent.id, {
          passesSinceService: resetPassesSinceRebuild ? 0 : selectedComponent.passesSinceRebuild,
        });
      } else {
        await updateDrivetrainComponent(selectedComponent.id, {
          passesSinceService: resetPassesSinceRebuild ? 0 : selectedComponent.passesSinceRebuild,
        });
      }

      // 2. Update refresh date in extra fields
      setExtraFields((prev: Record<string, any>) => ({
        ...prev,
        [selectedComponent.id]: {
          ...prev[selectedComponent.id],
          refreshDate: today,
        }
      }));

      // 3. Reset selected standalone parts
      if (selectedPartIds.size > 0) {
        const partIdsToReset = Array.from(selectedPartIds);
        setComponentParts(prev =>
          prev.map(p => {
            if (partIdsToReset.includes(p.id)) {
              return { ...p, passesOnPart: 0, dateReplaced: today, notes: `${p.notes ? p.notes + ' | ' : ''}Rebuild reset ${today}` };
            }
            return p;
          })
        );
        // Mark as dirty for auto-save
        setDirtyPartIds(prev => {
          const next = new Set(prev);
          partIdsToReset.forEach(id => next.add(id));
          return next;
        });
        // Also persist to DB immediately
        for (const partId of partIdsToReset) {
          const part = componentParts.find(p => p.id === partId);
          if (part) {
            const updatedPart = { ...part, passesOnPart: 0, dateReplaced: today, notes: `${part.notes ? part.notes + ' | ' : ''}Rebuild reset ${today}` };
            db.upsertComponentPart(updatedPart, userId).catch(err =>
              console.warn('[RebuildWizard] DB upsert failed for part:', part.partName, err)
            );
          }
        }
      }

      // 4. Log the rebuild event
      const rebuildLog = loadRebuildLog();
      rebuildLog.unshift({
        date: today,
        componentId: selectedComponent.id,
        componentName: selectedComponent.name,
        notes: rebuildNotes || 'Rebuild/Refresh completed',
        partsReset: selectedPartIds.size,
      });
      // Keep last 100 entries
      saveRebuildLog(rebuildLog.slice(0, 100));

      setCompleted(true);
      toast.success(`${selectedComponent.name} rebuild completed`, {
        description: `Passes reset to 0, ${selectedPartIds.size} part${selectedPartIds.size !== 1 ? 's' : ''} reset`,
        duration: 5000,
      });
    } catch (err) {
      console.error('[RebuildWizard] Error:', err);
      toast.error('Failed to complete rebuild. Some changes may not have been saved.');
    } finally {
      setSaving(false);
    }
  };

  // Step indicator
  const allSteps: { id: WizardStep; label: string }[] = [
    { id: 'select', label: 'Select' },
    { id: 'configure', label: 'Configure' },
    ...(partsForSelected.length > 0 ? [{ id: 'parts' as WizardStep, label: 'Parts' }] : []),
    { id: 'notes', label: 'Notes' },
    { id: 'summary', label: 'Confirm' },
  ];

  const currentStepIndex = allSteps.findIndex(s => s.id === step);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Rebuild / Refresh Wizard</h3>
              <p className="text-amber-100 text-sm">Reset component passes after a rebuild</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-900/50 border-b border-slate-700/50 flex items-center gap-2 flex-shrink-0">
          {allSteps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                idx < currentStepIndex ? 'bg-green-500/20 text-green-400' :
                idx === currentStepIndex ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30' :
                'bg-slate-700/50 text-slate-500'
              }`}>
                {idx < currentStepIndex ? <Check className="w-3 h-3" /> : <span>{idx + 1}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < allSteps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* COMPLETED STATE */}
          {completed && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Rebuild Complete!</h3>
              <p className="text-slate-400 mb-6">
                {selectedComponent?.name} has been reset. {selectedPartIds.size > 0 && `${selectedPartIds.size} part${selectedPartIds.size !== 1 ? 's' : ''} reset to 0 passes.`}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* STEP 1: SELECT COMPONENT */}
          {!completed && step === 'select' && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Select Component</h4>
              <p className="text-sm text-slate-400 mb-4">Choose which component was rebuilt or refreshed.</p>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {componentOptions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Wrench className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                    <p>No components found. Add components first.</p>
                  </div>
                ) : (
                  componentOptions.map(comp => {
                    const Icon = comp.icon;
                    const isSelected = selectedComponentId === comp.id;
                    return (
                      <div
                        key={comp.id}
                        onClick={() => setSelectedComponentId(comp.id)}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30'
                            : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-orange-500/20' : comp.currentlyInstalled ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-orange-400' : comp.currentlyInstalled ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">{comp.name}</span>
                            {comp.currentlyInstalled && (
                              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-medium flex-shrink-0">INSTALLED</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 capitalize">
                            {comp.type === 'drivetrain' ? (comp.category || '').replace(/_/g, ' ') : comp.type}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white text-sm font-medium">{comp.totalPasses} total</p>
                          <p className="text-slate-400 text-xs">{comp.passesSinceRebuild} since rebuild</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURE */}
          {!completed && step === 'configure' && selectedComponent && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Configure Rebuild</h4>
              <p className="text-sm text-slate-400 mb-4">Set the rebuild parameters for <span className="text-orange-400 font-medium">{selectedComponent.name}</span>.</p>

              <div className="space-y-5">
                {/* Rebuild Date */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Rebuild / Refresh Date</label>
                  <DateInputDark
                    value={rebuildDate}
                    onChange={(e) => setRebuildDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white"
                  />
                </div>

                {/* Reset passes since rebuild */}
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setResetPassesSinceRebuild(!resetPassesSinceRebuild)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${resetPassesSinceRebuild ? 'bg-green-500' : 'bg-slate-600'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${resetPassesSinceRebuild ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <span className="text-white font-medium">Reset "Passes Since Rebuild" to 0</span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Current value: <span className="text-white font-mono">{selectedComponent.passesSinceRebuild}</span> passes
                      </p>
                    </div>
                  </label>
                </div>

                {/* Info box */}
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-300">
                    Total passes ({selectedComponent.totalPasses}) will NOT be reset — only "passes since rebuild" will be zeroed out. The refresh date will be updated to {rebuildDate}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PARTS */}
          {!completed && step === 'parts' && selectedComponent && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Reset Standalone Parts</h4>
              <p className="text-sm text-slate-400 mb-4">
                Select which parts to reset to 0 passes. Unselected parts will keep their current pass count.
              </p>

              {partsForSelected.length > 0 ? (
                <>
                  {/* Select All */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700/50">
                    <button
                      onClick={handleSelectAllParts}
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                    >
                      {selectAllParts ? (
                        <CheckSquare className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                      {selectAllParts ? 'Deselect All' : 'Select All'} ({partsForSelected.length} parts)
                    </button>
                    <span className="text-xs text-slate-500">
                      {selectedPartIds.size} selected
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {partsForSelected.map(part => {
                      const isSelected = selectedPartIds.has(part.id);
                      return (
                        <div
                          key={part.id}
                          onClick={() => togglePart(part.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-orange-500/10 border-orange-500/40'
                              : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          )}
                          <span className="text-white text-sm flex-1 truncate">{part.partName}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`font-mono text-sm ${isSelected ? 'text-red-400 line-through' : 'text-slate-300'}`}>
                              {part.passesOnPart}
                            </span>
                            {isSelected && (
                              <span className="text-green-400 font-mono text-sm font-bold">0</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p>No standalone parts on this component.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: NOTES */}
          {!completed && step === 'notes' && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Rebuild Notes</h4>
              <p className="text-sm text-slate-400 mb-4">
                Document what was done during this rebuild for future reference.
              </p>

              <textarea
                value={rebuildNotes}
                onChange={(e) => setRebuildNotes(e.target.value)}
                rows={5}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                placeholder="e.g., Full rebuild - new pistons, bearings, rings. Honed block. New head gaskets..."
              />

              {/* Quick note suggestions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {['Full rebuild', 'Refresh only', 'New bearings', 'New pistons', 'New rings', 'Honed block', 'New seals', 'New clutch packs'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setRebuildNotes(prev => prev ? `${prev}, ${suggestion}` : suggestion)}
                    className="px-2.5 py-1 bg-slate-700 text-slate-300 text-xs rounded-full hover:bg-slate-600 transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY */}
          {!completed && step === 'summary' && selectedComponent && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">Confirm Rebuild</h4>
              <p className="text-sm text-slate-400 mb-4">Review the changes before applying.</p>

              <div className="space-y-4">
                {/* Component */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    {React.createElement(selectedComponent.icon, { className: 'w-5 h-5 text-orange-400' })}
                    <span className="text-white font-semibold text-lg">{selectedComponent.name}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rebuild Date</span>
                      <span className="text-white">{rebuildDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Passes Since Rebuild</span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 line-through font-mono">{selectedComponent.passesSinceRebuild}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <span className="text-green-400 font-bold font-mono">{resetPassesSinceRebuild ? '0' : selectedComponent.passesSinceRebuild}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Passes</span>
                      <span className="text-white font-mono">{selectedComponent.totalPasses} (unchanged)</span>
                    </div>
                  </div>
                </div>

                {/* Parts reset summary */}
                {selectedPartIds.size > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                    <h5 className="text-white font-medium mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-400" />
                      Parts to Reset ({selectedPartIds.size})
                    </h5>
                    <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                      {partsForSelected.filter(p => selectedPartIds.has(p.id)).map(part => (
                        <span key={part.id} className="px-2 py-1 bg-orange-500/10 text-orange-300 text-xs rounded-full border border-orange-500/20">
                          {part.partName} ({part.passesOnPart} → 0)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {rebuildNotes && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                    <h5 className="text-white font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-400" />
                      Rebuild Notes
                    </h5>
                    <p className="text-slate-300 text-sm">{rebuildNotes}</p>
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-300">
                    This action cannot be undone. Make sure all information is correct before confirming.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!completed && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 bg-slate-900/30 flex-shrink-0">
            <button
              onClick={step === 'select' ? onClose : prevStep}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              {step === 'select' ? (
                'Cancel'
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </>
              )}
            </button>

            {step === 'summary' ? (
              <button
                onClick={handleConfirmRebuild}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirm Rebuild
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RebuildWizard;
