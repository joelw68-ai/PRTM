import React, { useMemo, useState } from 'react';

import { useApp } from '@/contexts/AppContext';
import {
  ShoppingCart,
  Package,
  X,
  Download,
  DollarSign,
  Truck,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Printer,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Building2,
  FileText,
  Star,
  Mail,
  Phone,
  Globe,
  Sliders,
  Save,
  Loader2
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseOrderItem
} from '@/data/vendorData';
import { VendorRecord } from '@/lib/database';

import { PartInventoryItem } from '@/data/partsInventory';

// Type aliases derived from PartInventoryItem for type-safe status assignments
type PartStatus = PartInventoryItem['status'];
type PartReorderStatus = PartInventoryItem['reorderStatus'];


interface ReorderListGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VendorGroup {
  vendor: VendorRecord | null;
  vendorName: string;
  parts: ReorderItem[];
  subtotal: number;
  discount: number;
  total: number;
  leadTimeDays: number;
}


interface ReorderItem {
  part: PartInventoryItem;
  orderQty: number;
  lineCost: number;
}

const ReorderListGenerator: React.FC<ReorderListGeneratorProps> = ({ isOpen, onClose }) => {
  const { partsInventory, updatePartInventory, vendors: allVendors } = useApp();
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(['all']));
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [excludedParts, setExcludedParts] = useState<Set<string>>(new Set());
  const [createdPOs, setCreatedPOs] = useState<PurchaseOrder[]>([]);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [poNotes, setPONotes] = useState<Record<string, string>>({});
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [thresholdEdits, setThresholdEdits] = useState<Record<string, number>>({});

  // Save Order Quantities state
  const [isSavingQuantities, setIsSavingQuantities] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Derive active vendors from centralized AppContext state
  const vendorList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);

  // Track whether there are unsaved custom quantity changes
  const hasUnsavedChanges = Object.keys(customQuantities).length > 0;


  // Get all parts that need reordering
  const lowStockParts = useMemo(() => {
    return partsInventory.filter(p =>
      (p.onHand <= p.minQuantity || p.status === 'Low Stock' || p.status === 'Out of Stock') &&
      p.reorderStatus !== 'On Order' &&
      !excludedParts.has(p.id)
    );
  }, [partsInventory, excludedParts]);

  // Group by vendor
  const vendorGroups = useMemo((): VendorGroup[] => {
    const groups: Record<string, VendorGroup> = {};

    lowStockParts.forEach(part => {
      const vendorName = part.vendor || 'Unknown Vendor';
      if (!groups[vendorName]) {
        const vendorInfo = vendorList.find(v =>

          v.name.toLowerCase() === vendorName.toLowerCase() ||
          v.name.toLowerCase().includes(vendorName.toLowerCase()) ||
          vendorName.toLowerCase().includes(v.name.toLowerCase())
        ) || null;

        groups[vendorName] = {
          vendor: vendorInfo,
          vendorName,
          parts: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          leadTimeDays: vendorInfo?.leadTimeDays || 14
        };
      }

      const orderQty = customQuantities[part.id] ?? Math.max(part.maxQuantity - part.onHand, part.minQuantity);
      const lineCost = orderQty * part.unitCost;

      groups[vendorName].parts.push({ part, orderQty, lineCost });
      groups[vendorName].subtotal += lineCost;
    });

    // Calculate discounts and totals
    Object.values(groups).forEach(group => {
      const discountPct = group.vendor?.discountPercent || 0;
      group.discount = group.subtotal * (discountPct / 100);
      group.total = group.subtotal - group.discount;
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [lowStockParts, customQuantities, vendorList]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return vendorGroups.reduce(
      (acc, g) => ({
        subtotal: acc.subtotal + g.subtotal,
        discount: acc.discount + g.discount,
        total: acc.total + g.total,
        parts: acc.parts + g.parts.length,
        vendors: acc.vendors + 1
      }),
      { subtotal: 0, discount: 0, total: 0, parts: 0, vendors: 0 }
    );
  }, [vendorGroups]);

  const toggleVendorExpanded = (vendorName: string) => {
    setExpandedVendors(prev => {
      const next = new Set(prev);
      if (next.has(vendorName)) {
        next.delete(vendorName);
      } else {
        next.add(vendorName);
      }
      return next;
    });
  };

  const updateOrderQty = (partId: string, qty: number) => {
    setCustomQuantities(prev => ({ ...prev, [partId]: Math.max(1, qty) }));
  };

  const excludePart = (partId: string) => {
    setExcludedParts(prev => new Set([...prev, partId]));
  };

  // ============ SAVE ORDER QUANTITIES ============
  // Persists the user's custom order quantities back to the parts inventory database
  // by updating each part's maxQuantity field (maxQuantity = onHand + orderQty).
  // This ensures the quantities are remembered when the reorder list is reopened.
  const handleSaveOrderQuantities = async () => {
    if (!hasUnsavedChanges) return;

    setIsSavingQuantities(true);
    setShowSaveSuccess(false);
    let count = 0;

    try {
      // Iterate through all vendor groups to find parts with custom quantities
      for (const group of vendorGroups) {
        for (const item of group.parts) {
          const customQty = customQuantities[item.part.id];
          if (customQty !== undefined) {
            // Update maxQuantity so the derived order qty (maxQuantity - onHand) matches the custom qty
            const newMaxQuantity = item.part.onHand + customQty;
            
            // Also recalculate status based on current onHand vs minQuantity
            const status = item.part.onHand === 0 ? 'Out of Stock' :
                           item.part.onHand <= item.part.minQuantity ? 'Low Stock' : 'In Stock';
            const reorderStatus = item.part.onHand === 0 ? 'Critical' :
                                  item.part.onHand <= item.part.minQuantity ? 'Reorder' : 'OK';

            await updatePartInventory(item.part.id, {
              maxQuantity: newMaxQuantity,
              status: status as PartStatus,
              reorderStatus: reorderStatus as PartReorderStatus

            });
            count++;
          }
        }
      }

      // Clear custom quantities since they're now saved to the database
      setCustomQuantities({});
      setSavedCount(count);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);
    } catch (error) {
      console.error('Error saving order quantities:', error);
    } finally {
      setIsSavingQuantities(false);
    }
  };

  const handleCreatePO = async (group: VendorGroup) => {
    const items: PurchaseOrderItem[] = group.parts.map(item => ({
      partId: item.part.id,
      partNumber: item.part.partNumber,
      description: item.part.description,
      quantity: item.orderQty,
      unitCost: item.part.unitCost,
      totalCost: item.lineCost
    }));

    const po: PurchaseOrder = {
      id: `PO-${Date.now().toString(36).toUpperCase()}`,
      vendorId: group.vendor?.id || '',
      vendorName: group.vendorName,
      status: 'Submitted',
      createdDate: new Date().toISOString().split('T')[0],
      submittedDate: new Date().toISOString().split('T')[0],
      expectedDelivery: new Date(Date.now() + group.leadTimeDays * 86400000).toISOString().split('T')[0],
      items,
      subtotal: group.subtotal,
      discount: group.discount,
      shipping: 0,
      tax: 0,
      total: group.total,
      notes: poNotes[group.vendorName] || `Auto-generated reorder for ${group.parts.length} low-stock items`,
      createdBy: 'System'
    };

    setCreatedPOs(prev => [po, ...prev]);

    // Update parts to "On Order" status
    try {
      for (const item of group.parts) {
        await updatePartInventory(item.part.id, { reorderStatus: 'On Order' as PartReorderStatus });

      }
    } catch (error) {
      console.error('Error updating part status:', error);
    }

    setShowSuccess(group.vendorName);
    setTimeout(() => setShowSuccess(null), 4000);
  };

  const handleCreateAllPOs = async () => {
    for (const group of vendorGroups) {
      await handleCreatePO(group);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      for (const [partId, newMin] of Object.entries(thresholdEdits)) {
        const part = partsInventory.find(p => p.id === partId);
        if (part && newMin !== part.minQuantity) {
          const status = part.onHand === 0 ? 'Out of Stock' :
                         part.onHand <= newMin ? 'Low Stock' : 'In Stock';
          const reorderStatus = part.onHand === 0 ? 'Critical' :
                                part.onHand <= newMin ? 'Reorder' : 'OK';
          await updatePartInventory(partId, {
            minQuantity: newMin,
            status: status as PartStatus,
            reorderStatus: reorderStatus as PartReorderStatus

          });
        }
      }
      setThresholdEdits({});
      setShowThresholdEditor(false);
    } catch (error) {
      console.error('Error saving thresholds:', error);
    }
  };

  const exportReorderList = () => {
    const headers = ['Vendor', 'Part Number', 'Description', 'On Hand', 'Min Qty', 'Order Qty', 'Unit Cost', 'Line Total', 'Lead Time'];
    const rows: string[][] = [];

    vendorGroups.forEach(group => {
      group.parts.forEach(item => {
        rows.push([
          group.vendorName,
          item.part.partNumber,
          item.part.description,
          String(item.part.onHand),
          String(item.part.minQuantity),
          String(item.orderQty),
          `$${item.part.unitCost.toLocaleString()}`,
          `$${item.lineCost.toLocaleString()}`,
          `${group.leadTimeDays} days`
        ]);
      });
      // Add vendor subtotal row
      rows.push([
        `--- ${group.vendorName} Total ---`, '', '', '', '', '',
        group.vendor?.discountPercent ? `${group.vendor.discountPercent}% disc.` : '',
        `$${group.total.toLocaleString()}`,
        ''
      ]);
    });

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['GRAND TOTAL', '', '', '', `${grandTotals.parts} items`, `${grandTotals.vendors} vendors`, '', `$${grandTotals.total.toLocaleString()}`, '']);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder_list_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl max-w-5xl w-full my-8 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 rounded-t-2xl border-b border-slate-700 px-6 py-5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-xl flex items-center justify-center">
                <FileText className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Reorder List Generator</h2>
                <p className="text-slate-400 text-sm">
                  {grandTotals.parts} items across {grandTotals.vendors} vendor{grandTotals.vendors !== 1 ? 's' : ''} need reordering
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowThresholdEditor(!showThresholdEditor)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                <Sliders className="w-4 h-4" />
                Thresholds
              </button>
              <button
                onClick={exportReorderList}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Success Toasts */}
          {showSuccess && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-green-600/20 border border-green-500/30 rounded-lg animate-in slide-in-from-top">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-300 text-sm">
                Purchase Order created and submitted to <span className="font-semibold">{showSuccess}</span>
              </p>
            </div>
          )}

          {showSaveSuccess && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg animate-in slide-in-from-top">
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-blue-300 text-sm">
                Order quantities saved successfully for <span className="font-semibold">{savedCount} part{savedCount !== 1 ? 's' : ''}</span>. Changes are now persisted in the database.
              </p>
            </div>
          )}

          {/* Unsaved Changes Indicator */}
          {hasUnsavedChanges && !showSaveSuccess && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-amber-600/15 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-amber-300 text-sm flex-1">
                You have unsaved changes to <span className="font-semibold">{Object.keys(customQuantities).length} order quantit{Object.keys(customQuantities).length !== 1 ? 'ies' : 'y'}</span>. Click <span className="font-semibold">Save Order Quantities</span> to persist them.
              </p>
              <button
                onClick={handleSaveOrderQuantities}
                disabled={isSavingQuantities}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {isSavingQuantities ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Now
              </button>
            </div>
          )}

          {/* Grand Totals Bar */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-800/70 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-0.5">Total Items</p>
              <p className="text-lg font-bold text-white">{grandTotals.parts}</p>
            </div>
            <div className="bg-slate-800/70 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-0.5">Vendors</p>
              <p className="text-lg font-bold text-white">{grandTotals.vendors}</p>
            </div>
            <div className="bg-slate-800/70 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-0.5">Subtotal</p>
              <p className="text-lg font-bold text-white">${grandTotals.subtotal.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/70 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-0.5">Discounts</p>
              <p className="text-lg font-bold text-green-400">-${grandTotals.discount.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3 border border-orange-500/30">
              <p className="text-xs text-orange-300/80 mb-0.5">Grand Total</p>
              <p className="text-lg font-bold text-orange-400">${grandTotals.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Create All POs Button */}
          {vendorGroups.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleCreateAllPOs}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/20"
              >
                <Send className="w-4 h-4" />
                Create All Purchase Orders ({vendorGroups.length})
              </button>
            </div>
          )}
        </div>

        {/* Threshold Editor */}
        {showThresholdEditor && (
          <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                Configure Minimum Stock Thresholds
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowThresholdEditor(false); setThresholdEdits({}); }}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveThresholds}
                  disabled={Object.keys(thresholdEdits).length === 0}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  Save Changes ({Object.keys(thresholdEdits).length})
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {partsInventory
                .filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock' || p.onHand <= p.minQuantity * 1.5)
                .map(part => (
                  <div key={part.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-orange-400 font-mono text-xs">{part.partNumber}</span>
                      <span className="text-white text-sm truncate">{part.description}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className="text-slate-400 text-xs">On Hand: <span className="text-white font-medium">{part.onHand}</span></span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">Min:</span>
                        <input
                          type="number"
                          min="0"
                          value={thresholdEdits[part.id] ?? part.minQuantity}
                          onChange={(e) => setThresholdEdits(prev => ({
                            ...prev,
                            [part.id]: parseInt(e.target.value) || 0
                          }))}
                          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Vendor Groups */}
        <div className="px-6 py-4 space-y-4">
          {vendorGroups.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-16 h-16 text-green-400/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">All Stock Levels OK</h3>
              <p className="text-slate-400">No parts currently need reordering. All inventory is above minimum thresholds.</p>
            </div>
          ) : (
            vendorGroups.map(group => {
              const isExpanded = expandedVendors.has(group.vendorName) || expandedVendors.has('all');
              const alreadyOrdered = createdPOs.some(po => po.vendorName === group.vendorName);

              return (
                <div
                  key={group.vendorName}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    alreadyOrdered
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-slate-700/50 bg-slate-800/30'
                  }`}
                >
                  {/* Vendor Header */}
                  <button
                    onClick={() => toggleVendorExpanded(group.vendorName)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        alreadyOrdered ? 'bg-green-500/20' : 'bg-slate-700/50'
                      }`}>
                        {alreadyOrdered ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {group.vendorName}
                          {alreadyOrdered && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                              PO Created
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>{group.parts.length} item{group.parts.length !== 1 ? 's' : ''}</span>
                          <span className="text-slate-600">|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {group.leadTimeDays}d lead time
                          </span>
                          {group.vendor && (
                            <>
                              <span className="text-slate-600">|</span>
                              <span className="flex items-center gap-0.5">
                                {[...Array(group.vendor.rating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                ))}
                              </span>
                              {group.vendor.discountPercent > 0 && (
                                <>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-green-400">{group.vendor.discountPercent}% discount</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-orange-400 font-bold">${group.total.toLocaleString()}</p>
                        {group.discount > 0 && (
                          <p className="text-xs text-green-400">-${group.discount.toLocaleString()} saved</p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>

                  {/* Vendor Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/50">
                      {/* Vendor Contact Info */}
                      {group.vendor && (
                        <div className="px-5 py-3 bg-slate-900/30 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {group.vendor.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {group.vendor.phone}
                          </span>
                          {group.vendor.website && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {group.vendor.website}
                            </span>
                          )}
                          <span className="text-slate-500">Terms: {group.vendor.paymentTerms}</span>
                          {group.vendor.minimumOrder > 0 && (
                            <span className={`${group.subtotal >= group.vendor.minimumOrder ? 'text-green-400' : 'text-yellow-400'}`}>
                              Min order: ${group.vendor.minimumOrder} {group.subtotal >= group.vendor.minimumOrder ? '(met)' : '(not met)'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Parts Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700/50">
                              <th className="text-left px-5 py-2.5">Part</th>
                              <th className="text-center px-3 py-2.5">On Hand</th>
                              <th className="text-center px-3 py-2.5">Min</th>
                              <th className="text-center px-3 py-2.5">Order Qty</th>
                              <th className="text-right px-3 py-2.5">Unit Cost</th>
                              <th className="text-right px-3 py-2.5">Line Total</th>
                              <th className="px-3 py-2.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.parts.map(item => {
                              const isCustomized = customQuantities[item.part.id] !== undefined;
                              return (
                                <tr key={item.part.id} className={`border-b border-slate-700/30 hover:bg-slate-800/30 ${isCustomized ? 'bg-amber-500/5' : ''}`}>
                                  <td className="px-5 py-3">
                                    <p className="text-white font-medium">{item.part.description}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-orange-400 font-mono text-xs">{item.part.partNumber}</span>
                                      {item.part.vendorPartNumber && (
                                        <>
                                          <span className="text-slate-600 text-xs">|</span>
                                          <span className="text-slate-500 text-xs">Vendor: {item.part.vendorPartNumber}</span>
                                        </>
                                      )}
                                      {isCustomized && (
                                        <>
                                          <span className="text-slate-600 text-xs">|</span>
                                          <span className="text-amber-400 text-xs font-medium">Modified</span>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`font-bold ${
                                      item.part.onHand === 0 ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                      {item.part.onHand}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center text-slate-400">
                                    {item.part.minQuantity}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => updateOrderQty(item.part.id, item.orderQty - 1)}
                                        className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.orderQty}
                                        onChange={(e) => updateOrderQty(item.part.id, parseInt(e.target.value) || 1)}
                                        className={`w-14 bg-slate-800 border rounded px-2 py-1 text-white text-center text-sm ${
                                          isCustomized ? 'border-amber-500/50' : 'border-slate-600'
                                        }`}
                                      />
                                      <button
                                        onClick={() => updateOrderQty(item.part.id, item.orderQty + 1)}
                                        className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right text-slate-300 font-mono">
                                    ${item.part.unitCost.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-3 text-right text-white font-mono font-medium">
                                    ${item.lineCost.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-3">
                                    <button
                                      onClick={() => excludePart(item.part.id)}
                                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                      title="Remove from reorder list"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900/50">
                              <td colSpan={5} className="px-5 py-3 text-right text-slate-400 font-medium">
                                Subtotal:
                              </td>
                              <td className="px-3 py-3 text-right text-white font-mono font-bold">
                                ${group.subtotal.toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                            {group.discount > 0 && (
                              <tr className="bg-slate-900/50">
                                <td colSpan={5} className="px-5 py-1 text-right text-green-400 text-sm">
                                  Vendor Discount ({group.vendor?.discountPercent}%):
                                </td>
                                <td className="px-3 py-1 text-right text-green-400 font-mono">
                                  -${group.discount.toLocaleString()}
                                </td>
                                <td></td>
                              </tr>
                            )}
                            <tr className="bg-slate-900/50 border-t border-slate-700/50">
                              <td colSpan={5} className="px-5 py-3 text-right text-orange-400 font-semibold">
                                Total:
                              </td>
                              <td className="px-3 py-3 text-right text-orange-400 font-mono font-bold text-lg">
                                ${group.total.toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* PO Notes & Create Button */}
                      <div className="px-5 py-4 bg-slate-900/30 flex items-end gap-4">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-1">PO Notes (optional)</label>
                          <input
                            type="text"
                            value={poNotes[group.vendorName] || ''}
                            onChange={(e) => setPONotes(prev => ({ ...prev, [group.vendorName]: e.target.value }))}
                            placeholder="Add notes for this purchase order..."
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                          />
                        </div>
                        <button
                          onClick={() => handleCreatePO(group)}
                          disabled={alreadyOrdered}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                            alreadyOrdered
                              ? 'bg-green-500/20 text-green-400 cursor-default'
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20'
                          }`}
                        >
                          {alreadyOrdered ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              PO Submitted
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Create & Send PO
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Created POs Summary */}
        {createdPOs.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Created Purchase Orders ({createdPOs.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {createdPOs.map(po => (
                <div key={po.id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div>
                    <p className="text-white font-medium text-sm">{po.id}</p>
                    <p className="text-green-300/70 text-xs">{po.vendorName} - {po.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">${po.total.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">ETA: {po.expectedDelivery}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer with Save & Close buttons */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-amber-400 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {Object.keys(customQuantities).length} unsaved change{Object.keys(customQuantities).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Save Order Quantities Button */}
            <button
              onClick={handleSaveOrderQuantities}
              disabled={!hasUnsavedChanges || isSavingQuantities}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSavingQuantities ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Order Quantities
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReorderListGenerator;
