import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { PartInventoryItem } from '@/data/partsInventory';
import { insertPartsUsage } from '@/lib/teamMembership';
import {
  Package,
  X,
  Minus,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowDown,
  Wrench,
  FileText
} from 'lucide-react';

interface PartsUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  usageType: 'work_order' | 'maintenance';
  relatedId?: string;
  relatedTitle?: string;
  onComplete?: () => void;
}

interface PartSelection {
  part: PartInventoryItem;
  quantity: number;
}

const PartsUsageModal: React.FC<PartsUsageModalProps> = ({
  isOpen,
  onClose,
  usageType,
  relatedId,
  relatedTitle,
  onComplete
}) => {
  const { partsInventory, updatePartInventory } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedParts, setSelectedParts] = useState<PartSelection[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableParts = useMemo(() => {
    return partsInventory
      .filter(p => p.onHand > 0)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          p.partNumber.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      });
  }, [partsInventory, search]);

  const addPart = (part: PartInventoryItem) => {
    const existing = selectedParts.find(s => s.part.id === part.id);
    if (existing) {
      if (existing.quantity < part.onHand) {
        setSelectedParts(prev =>
          prev.map(s => s.part.id === part.id ? { ...s, quantity: s.quantity + 1 } : s)
        );
      }
    } else {
      setSelectedParts(prev => [...prev, { part, quantity: 1 }]);
    }
  };

  const removePart = (partId: string) => {
    setSelectedParts(prev => prev.filter(s => s.part.id !== partId));
  };

  const updateQuantity = (partId: string, qty: number) => {
    const sel = selectedParts.find(s => s.part.id === partId);
    if (!sel) return;
    if (qty < 1) {
      removePart(partId);
      return;
    }
    if (qty > sel.part.onHand) qty = sel.part.onHand;
    setSelectedParts(prev =>
      prev.map(s => s.part.id === partId ? { ...s, quantity: qty } : s)
    );
  };

  const totalCost = selectedParts.reduce((sum, s) => sum + (s.part.unitCost * s.quantity), 0);

  const handleSubmit = async () => {
    if (selectedParts.length === 0) {
      setError('Select at least one part');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      for (const sel of selectedParts) {
        const newOnHand = sel.part.onHand - sel.quantity;
        const newTotalValue = newOnHand * sel.part.unitCost;
        const newStatus = newOnHand <= 0 ? 'Out of Stock' : newOnHand <= sel.part.minQuantity ? 'Low Stock' : 'In Stock';
        const newReorderStatus = newOnHand <= sel.part.minQuantity ? 'Reorder' : 'OK';

        // Log the usage
        await insertPartsUsage({
          partId: sel.part.id,
          partNumber: sel.part.partNumber,
          partDescription: sel.part.description,
          quantityUsed: sel.quantity,
          unitCost: sel.part.unitCost,
          totalCost: sel.part.unitCost * sel.quantity,
          usageDate: today,
          usageType,
          relatedId,
          relatedTitle,
          notes,
          recordedBy: user?.email || 'Unknown',
          previousOnHand: sel.part.onHand,
          newOnHand
        }, user?.id);

        // Update inventory
        await updatePartInventory(sel.part.id, {
          onHand: newOnHand,
          totalValue: newTotalValue,
          lastUsed: today,
          status: newStatus,
          reorderStatus: newReorderStatus
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onComplete?.();
        onClose();
        setSelectedParts([]);
        setNotes('');
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to record parts usage');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-400" />
                Deduct Parts from Inventory
              </h3>
              {relatedTitle && (
                <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                  {usageType === 'work_order' ? <FileText className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                  {usageType === 'work_order' ? 'Work Order' : 'Maintenance'}: {relatedTitle}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Success State */}
          {success && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
              <h4 className="text-lg font-semibold text-white">Parts Deducted Successfully</h4>
              <p className="text-slate-400 text-sm mt-1">
                {selectedParts.length} part(s) updated in inventory
              </p>
            </div>
          )}

          {!success && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search parts by number, description, or category..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm"
                />
              </div>

              {/* Available Parts */}
              <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg">
                {availableParts.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    {search ? 'No parts match your search' : 'No parts with stock available'}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/50 sticky top-0">
                      <tr>
                        <th className="text-left text-slate-400 font-medium px-3 py-2">Part</th>
                        <th className="text-center text-slate-400 font-medium px-3 py-2">In Stock</th>
                        <th className="text-right text-slate-400 font-medium px-3 py-2">Cost</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableParts.map(part => {
                        const isSelected = selectedParts.some(s => s.part.id === part.id);
                        return (
                          <tr key={part.id} className={`border-t border-slate-700/50 ${isSelected ? 'bg-orange-500/5' : 'hover:bg-slate-700/30'}`}>
                            <td className="px-3 py-2">
                              <p className="text-white font-medium">{part.partNumber}</p>
                              <p className="text-slate-400 text-xs">{part.description}</p>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`${part.onHand <= part.minQuantity ? 'text-yellow-400' : 'text-white'}`}>
                                {part.onHand}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-300">
                              ${part.unitCost.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => addPart(part)}
                                disabled={isSelected && selectedParts.find(s => s.part.id === part.id)?.quantity === part.onHand}
                                className="p-1 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 disabled:opacity-30 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Selected Parts */}
              {selectedParts.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg border border-orange-500/20 p-4">
                  <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                    <ArrowDown className="w-4 h-4" />
                    Parts to Deduct ({selectedParts.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedParts.map(sel => (
                      <div key={sel.part.id} className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{sel.part.partNumber}</p>
                          <p className="text-slate-400 text-xs truncate">{sel.part.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => updateQuantity(sel.part.id, sel.quantity - 1)}
                            className="p-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={sel.part.onHand}
                            value={sel.quantity}
                            onChange={(e) => updateQuantity(sel.part.id, parseInt(e.target.value) || 1)}
                            className="w-12 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-center text-sm"
                          />
                          <button
                            onClick={() => updateQuantity(sel.part.id, sel.quantity + 1)}
                            disabled={sel.quantity >= sel.part.onHand}
                            className="p-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-30"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-slate-400 text-xs w-16 text-right">
                            ${(sel.part.unitCost * sel.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => removePart(sel.part.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Total Cost:</span>
                    <span className="text-white font-bold">${totalCost.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none"
                  placeholder="Any notes about this parts usage..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="p-6 border-t border-slate-700 flex justify-between items-center flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || selectedParts.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Deduct {selectedParts.length} Part{selectedParts.length !== 1 ? 's' : ''} ({totalCost > 0 ? `$${totalCost.toFixed(2)}` : '$0.00'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartsUsageModal;
