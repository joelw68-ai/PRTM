import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import { useApp } from '@/contexts/AppContext';
import { MaintenanceItem } from '@/data/proModData';
import { PartInventoryItem } from '@/data/partsInventory';
import { toast } from 'sonner';
import {
  CheckCircle,
  X,
  Search,
  Package,
  Plus,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Minus,
  Trash2
} from 'lucide-react';

// ============ MAINTENANCE HISTORY (localStorage) ============
export interface MaintenanceHistoryEntry {
  id: string;
  maintenanceItemId: string;
  component: string;
  category: string;
  dateCompleted: string;
  passNumberCompletedAt: number | null;
  partsUsed: { partId: string; partNumber: string; description: string; quantity: number; unitCost: number }[];
  notes: string;
  timestamp: string;
}

export const MAINTENANCE_HISTORY_KEY = 'raceLogbook_maintenanceHistory';

export function loadMaintenanceHistory(): MaintenanceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MAINTENANCE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMaintenanceHistory(entries: MaintenanceHistoryEntry[]) {
  try {
    localStorage.setItem(MAINTENANCE_HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save maintenance history to localStorage:', e);
  }
}

// ============ COMPONENT PROPS ============
interface CompleteMaintenanceModalProps {
  item: MaintenanceItem;
  onClose: () => void;
  onCompleted: () => void;
  onNavigate?: (section: string) => void;
}

interface SelectedPart {
  partId: string;
  quantity: number;
}

const CompleteMaintenanceModal: React.FC<CompleteMaintenanceModalProps> = ({
  item,
  onClose,
  onCompleted,
  onNavigate
}) => {
  const {
    partsInventory,
    updateMaintenanceItem,
    updatePartInventory
  } = useApp();

  // Form state
  const [dateCompleted, setDateCompleted] = useState(getLocalDateString());
  const [passNumber, setPassNumber] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parts search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeDropdownIdx, setActiveDropdownIdx] = useState<number | null>(null);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Click outside handler for parts dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setActiveDropdownIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered parts for dropdown — pulls directly from parts_inventory via AppContext
  const filteredParts = useMemo(() => {
    const alreadySelectedIds = new Set(selectedParts.map(p => p.partId));
    let results = partsInventory.filter(p => !alreadySelectedIds.has(p.id));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter(p =>
        p.description.toLowerCase().includes(term) ||
        p.partNumber.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        p.vendor.toLowerCase().includes(term)
      );
    }

    return results.slice(0, 25);
  }, [partsInventory, searchTerm, selectedParts]);

  // Keyboard navigation for dropdown
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
        setActiveDropdownIdx(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveDropdownIdx(prev =>
        prev === null ? 0 : Math.min(prev + 1, filteredParts.length - 1)
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveDropdownIdx(prev =>
        prev === null ? 0 : Math.max(prev - 1, 0)
      );
    } else if (e.key === 'Enter' && activeDropdownIdx !== null) {
      e.preventDefault();
      const part = filteredParts[activeDropdownIdx];
      if (part) addPart(part);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setActiveDropdownIdx(null);
    }
  }, [isDropdownOpen, activeDropdownIdx, filteredParts]);

  // Add a part to the selected list
  const addPart = (part: PartInventoryItem) => {
    setSelectedParts(prev => [...prev, { partId: part.id, quantity: 1 }]);
    setSearchTerm('');
    setIsDropdownOpen(false);
    setActiveDropdownIdx(null);
  };

  // Update quantity for a selected part
  const updateQuantity = (partId: string, quantity: number) => {
    setSelectedParts(prev =>
      prev.map(p => p.partId === partId ? { ...p, quantity: Math.max(1, quantity) } : p)
    );
  };

  // Remove a part from the selected list
  const removePart = (partId: string) => {
    setSelectedParts(prev => prev.filter(p => p.partId !== partId));
  };

  // Get part details from inventory
  const getPartDetails = (partId: string): PartInventoryItem | undefined => {
    return partsInventory.find(p => p.id === partId);
  };

  // Calculate total parts cost
  const totalPartsCost = useMemo(() => {
    return selectedParts.reduce((sum, sp) => {
      const part = getPartDetails(sp.partId);
      return sum + (part ? part.unitCost * sp.quantity : 0);
    }, 0);
  }, [selectedParts, partsInventory]);

  // ============ CONFIRM COMPLETION HANDLER ============
  const handleConfirmCompletion = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1) Mark maintenance item as completed — reset pass counter to 0, set status Good
      await updateMaintenanceItem(item.id, {
        lastService: dateCompleted,
        currentPasses: 0,
        nextServicePasses: item.passInterval,
        status: 'Good',
        notes: notes
          ? `${item.notes ? item.notes + ' | ' : ''}Completed ${dateCompleted}: ${notes}`
          : item.notes
      });

      // 2) Deduct each selected part from parts_inventory on_hand and track low-stock
      const lowStockParts: { id: string; partNumber: string; description: string; onHand: number; minQuantity: number; vendor: string }[] = [];

      for (const sp of selectedParts) {
        const inventoryPart = partsInventory.find(p => p.id === sp.partId);
        if (inventoryPart) {
          const newOnHand = Math.max(0, inventoryPart.onHand - sp.quantity);
          const status: PartInventoryItem['status'] =
            newOnHand === 0 ? 'Out of Stock' :
            newOnHand <= inventoryPart.minQuantity ? 'Low Stock' : 'In Stock';
          const reorderStatus: PartInventoryItem['reorderStatus'] =
            newOnHand === 0 ? 'Critical' :
            newOnHand <= inventoryPart.minQuantity ? 'Reorder' : 'OK';

          await updatePartInventory(inventoryPart.id, {
            onHand: newOnHand,
            totalValue: newOnHand * inventoryPart.unitCost,
            status,
            reorderStatus,
            lastUsed: dateCompleted
          });

          if (newOnHand <= inventoryPart.minQuantity) {
            lowStockParts.push({
              id: inventoryPart.id,
              partNumber: inventoryPart.partNumber,
              description: inventoryPart.description,
              onHand: newOnHand,
              minQuantity: inventoryPart.minQuantity,
              vendor: inventoryPart.vendor
            });
          }
        }
      }

      // 3) Log completion in maintenance history (localStorage)
      const historyEntry: MaintenanceHistoryEntry = {
        id: `MH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        maintenanceItemId: item.id,
        component: item.component,
        category: item.category,
        dateCompleted,
        passNumberCompletedAt: passNumber ? parseInt(passNumber) : null,
        partsUsed: selectedParts.map(sp => {
          const part = partsInventory.find(p => p.id === sp.partId);
          return {
            partId: sp.partId,
            partNumber: part?.partNumber || '',
            description: part?.description || '',
            quantity: sp.quantity,
            unitCost: part?.unitCost || 0
          };
        }),
        notes,
        timestamp: new Date().toISOString()
      };

      const existingHistory = loadMaintenanceHistory();
      const updatedHistory = [historyEntry, ...existingHistory];
      saveMaintenanceHistory(updatedHistory);

      // 4) Show success toast
      const partsCount = selectedParts.length;
      toast.success(`Maintenance completed: ${item.component}`, {
        description: partsCount > 0
          ? `${partsCount} part${partsCount > 1 ? 's' : ''} deducted from inventory. Pass counter reset. Next due in ${item.passInterval} passes.`
          : `Pass counter reset to 0. Next due in ${item.passInterval} passes.`,
        duration: 5000,
      });

      // 5) Show low-stock warnings
      if (lowStockParts.length > 0) {
        // Store for PartsInventory to pick up
        try {
          localStorage.setItem('raceLogbook_lowStockPORequest', JSON.stringify({
            partIds: lowStockParts.map(p => p.id),
            timestamp: new Date().toISOString(),
            source: 'maintenance_completion',
            maintenanceComponent: item.component
          }));
        } catch (e) {
          console.warn('Failed to store PO request:', e);
        }

        if (lowStockParts.length <= 3) {
          lowStockParts.forEach((part, index) => {
            setTimeout(() => {
              toast.warning(`Low Stock Alert: ${part.partNumber}`, {
                description: `${part.description} — ${part.onHand === 0 ? 'OUT OF STOCK' : `only ${part.onHand} remaining`} (min: ${part.minQuantity})`,
                duration: 15000,
                action: onNavigate ? {
                  label: 'Go to Parts',
                  onClick: () => onNavigate('parts')
                } : undefined
              });
            }, (index + 1) * 800);
          });
        } else {
          setTimeout(() => {
            const outOfStock = lowStockParts.filter(p => p.onHand === 0).length;
            toast.warning(`${lowStockParts.length} Parts Below Minimum Stock`, {
              description: `${outOfStock > 0 ? `${outOfStock} out of stock. ` : ''}${lowStockParts.map(p => p.partNumber).join(', ')}`,
              duration: 15000,
              action: onNavigate ? {
                label: 'Go to Parts',
                onClick: () => onNavigate('parts')
              } : undefined
            });
          }, 800);
        }
      }

      // Close modal and notify parent
      onCompleted();
      onClose();
    } catch (error) {
      console.error('Error completing maintenance:', error);
      toast.error('Failed to complete maintenance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-600/50 shadow-2xl shadow-black/50 max-h-[92vh] flex flex-col"
      >
        {/* Header — fixed */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Complete Maintenance</h3>
              <p className="text-sm text-slate-400">{item.component} — {item.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Current Status Summary */}
          <div className="bg-slate-900/60 rounded-xl p-4 mb-6 border border-slate-700/30">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Passes</p>
                <p className="text-lg font-bold text-white">{item.currentPasses} <span className="text-sm text-slate-400 font-normal">/ {item.nextServicePasses}</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pass Interval</p>
                <p className="text-lg font-bold text-white">{item.passInterval} <span className="text-sm text-slate-400 font-normal">passes</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                  item.status === 'Overdue' ? 'bg-red-500/20 text-red-400' :
                  item.status === 'Due' ? 'bg-orange-500/20 text-orange-400' :
                  item.status === 'Due Soon' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {/* Date Completed */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Date Completed <span className="text-red-400">*</span>
              </label>
              <DateInputDark
                value={dateCompleted}
                onChange={(e) => setDateCompleted(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
              />
            </div>

            {/* Pass Number Completed At */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Pass Number Completed At
                <span className="text-slate-500 font-normal ml-1">(optional)</span>
              </label>
              <input
                type="number"
                value={passNumber}
                onChange={(e) => setPassNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                placeholder="e.g., 47"
                min="0"
              />
            </div>

            {/* ============ PARTS USED SECTION ============ */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Parts Used
                <span className="text-slate-500 font-normal ml-1">(auto-deducts from inventory)</span>
              </label>

              {/* Searchable Parts Dropdown */}
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                      setActiveDropdownIdx(0);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                    placeholder="Search parts by name, part number, category, or vendor..."
                  />
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {/* Dropdown results */}
                {isDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 max-h-56 overflow-y-auto">
                    {partsInventory.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm font-medium">No parts in inventory</p>
                        <p className="text-slate-500 text-xs mt-1">Add parts in the Parts Inventory section first</p>
                      </div>
                    ) : filteredParts.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className="text-slate-400 text-sm">No matching parts found</p>
                        <p className="text-slate-500 text-xs mt-1">Try a different search term</p>
                      </div>
                    ) : (
                      filteredParts.map((part, idx) => (
                        <button
                          key={part.id}
                          onClick={() => addPart(part)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-800/50 last:border-0 flex items-center justify-between transition-colors ${
                            idx === activeDropdownIdx
                              ? 'bg-green-500/10 border-l-2 border-l-green-500'
                              : 'hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate">{part.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-orange-400 font-mono text-xs">{part.partNumber}</span>
                              <span className="text-slate-600">|</span>
                              <span className="text-slate-500 text-xs">{part.category}</span>
                              {part.vendor && (
                                <>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-slate-500 text-xs">{part.vendor}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            <p className={`text-sm font-bold ${
                              part.onHand === 0 ? 'text-red-400' :
                              part.onHand <= part.minQuantity ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                              {part.onHand}
                            </p>
                            <p className="text-[10px] text-slate-500">in stock</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Parts List */}
              {selectedParts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedParts.map(sp => {
                    const part = getPartDetails(sp.partId);
                    if (!part) return null;
                    const exceedsStock = sp.quantity > part.onHand;

                    return (
                      <div
                        key={sp.partId}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
                          exceedsStock
                            ? 'bg-red-500/5 border-red-500/30'
                            : 'bg-slate-900/50 border-slate-700/30'
                        }`}
                      >
                        <div className="w-8 h-8 bg-orange-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{part.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-orange-400 font-mono text-xs">{part.partNumber}</span>
                            <span className="text-slate-600">|</span>
                            <span className={`text-xs font-medium ${
                              part.onHand === 0 ? 'text-red-400' :
                              part.onHand <= part.minQuantity ? 'text-yellow-400' : 'text-slate-400'
                            }`}>
                              {part.onHand} in stock
                            </span>
                            <span className="text-slate-600">|</span>
                            <span className="text-green-400 text-xs">${(part.unitCost * sp.quantity).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(sp.partId, sp.quantity - 1)}
                            disabled={sp.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={sp.quantity}
                            onChange={(e) => updateQuantity(sp.partId, parseInt(e.target.value) || 1)}
                            className="w-14 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-center text-sm font-medium focus:border-green-500"
                          />
                          <button
                            onClick={() => updateQuantity(sp.partId, sp.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removePart(sp.partId)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                          title="Remove part"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Parts cost summary */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900/30 rounded-lg">
                    <span className="text-sm text-slate-400">{selectedParts.length} part{selectedParts.length !== 1 ? 's' : ''} selected</span>
                    <span className="text-sm font-medium text-green-400">Total: ${totalPartsCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Add Another Part button */}
              <button
                onClick={() => {
                  searchInputRef.current?.focus();
                  setIsDropdownOpen(true);
                }}
                className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors w-full justify-center border border-dashed border-slate-700 hover:border-green-500/30"
              >
                <Plus className="w-4 h-4" />
                Add {selectedParts.length > 0 ? 'Another' : 'a'} Part
              </button>

              {/* Stock warning */}
              {selectedParts.some(sp => {
                const part = getPartDetails(sp.partId);
                return part && sp.quantity > part.onHand;
              }) && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">
                    One or more parts have a quantity exceeding current stock. The on-hand count will be set to 0 for those parts.
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Notes
                <span className="text-slate-500 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/30 resize-none"
                placeholder="Any notes about this maintenance completion..."
              />
            </div>
          </div>

          {/* What will happen summary */}
          <div className="mt-5 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
            <p className="text-green-400 font-semibold text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              On confirmation, this will:
            </p>
            <ul className="space-y-1.5 ml-6 text-sm">
              <li className="text-green-300/80 flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                Mark "{item.component}" as completed
              </li>
              <li className="text-green-300/80 flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                Reset pass counter from {item.currentPasses} back to 0
              </li>
              <li className="text-green-300/80 flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                Set next service due in {item.passInterval} passes
              </li>
              {selectedParts.length > 0 && (
                <li className="text-green-300/80 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-1.5 flex-shrink-0" />
                  Deduct {selectedParts.reduce((s, p) => s + p.quantity, 0)} part{selectedParts.reduce((s, p) => s + p.quantity, 0) !== 1 ? 's' : ''} from inventory (${totalPartsCost.toLocaleString()})
                </li>
              )}
              <li className="text-green-300/80 flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0" />
                Log this completion in maintenance history
              </li>
            </ul>
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700/50 flex-shrink-0 bg-slate-800/80">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmCompletion}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm Completion
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteMaintenanceModal;
