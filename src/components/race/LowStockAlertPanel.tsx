import React, { useState, useEffect, useRef, useMemo } from 'react';

import { useApp } from '@/contexts/AppContext';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Bell,
  X,
  DollarSign,
  Truck,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';


interface LowStockAlertPanelProps {
  onNavigate: (section: string) => void;
  onOpenReorderList?: () => void;
}

const LowStockAlertPanel: React.FC<LowStockAlertPanelProps> = ({ onNavigate, onOpenReorderList }) => {
  const { partsInventory, vendors: allVendors } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Derive active vendors from centralized AppContext state
  const vendorList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);



  // ============ REAL-TIME REACTIVE COMPUTATIONS ============
  // These are computed directly from partsInventory (no useMemo) to ensure
  // they ALWAYS reflect the latest state from the shared AppContext.
  // When any component calls updatePartInventory(), the context state updates,
  // this component re-renders, and these values recalculate immediately.

  // Filter low stock parts - recomputed on every render to ensure real-time accuracy
  const lowStockParts = partsInventory.filter(p =>
    (p.onHand <= p.minQuantity || p.status === 'Low Stock' || p.status === 'Out of Stock') &&
    !dismissed.has(p.id)
  );

  const criticalParts = lowStockParts.filter(p => p.onHand === 0 || p.reorderStatus === 'Critical');

  const warningParts = lowStockParts.filter(p => p.onHand > 0 && p.onHand <= p.minQuantity && p.reorderStatus !== 'Critical');

  const onOrderParts = partsInventory.filter(p => p.reorderStatus === 'On Order');

  const estimatedReorderCost = lowStockParts.reduce((sum, p) => {
    const qtyNeeded = Math.max(p.maxQuantity - p.onHand, p.minQuantity);
    return sum + (qtyNeeded * p.unitCost);
  }, 0);

  // Group low stock parts by vendor for quick summary
  const vendorGroups = (() => {
    const groups: Record<string, { vendor: string; count: number; cost: number; parts: typeof lowStockParts }> = {};
    lowStockParts.forEach(p => {
      const vendorName = p.vendor || 'Unknown Vendor';
      if (!groups[vendorName]) {
        groups[vendorName] = { vendor: vendorName, count: 0, cost: 0, parts: [] };
      }
      groups[vendorName].count++;
      const qtyNeeded = Math.max(p.maxQuantity - p.onHand, p.minQuantity);
      groups[vendorName].cost += qtyNeeded * p.unitCost;
      groups[vendorName].parts.push(p);
    });
    return Object.values(groups).sort((a, b) => b.cost - a.cost);
  })();

  // ============ AUTO-CLEAN DISMISSED ITEMS ============
  // When a part's quantity goes above the threshold, automatically remove it
  // from the dismissed set so it doesn't stay hidden if it drops back down later
  useEffect(() => {
    if (dismissed.size === 0) return;
    
    const stillLowStock = new Set(
      partsInventory
        .filter(p => p.onHand <= p.minQuantity || p.status === 'Low Stock' || p.status === 'Out of Stock')
        .map(p => p.id)
    );
    
    // Remove dismissed IDs that are no longer low stock
    const updatedDismissed = new Set<string>();
    dismissed.forEach(id => {
      if (stillLowStock.has(id)) {
        updatedDismissed.add(id);
      }
    });
    
    if (updatedDismissed.size !== dismissed.size) {
      setDismissed(updatedDismissed);
    }
  }, [partsInventory]); // Re-check whenever partsInventory changes

  // ============ TRACK CHANGES FOR VISUAL FEEDBACK ============
  const prevLowStockCountRef = useRef(lowStockParts.length);
  const [recentChange, setRecentChange] = useState<'added' | 'removed' | null>(null);
  
  useEffect(() => {
    const prevCount = prevLowStockCountRef.current;
    const currentCount = lowStockParts.length;
    
    if (prevCount !== currentCount && prevCount > 0) {
      if (currentCount > prevCount) {
        setRecentChange('added');
      } else if (currentCount < prevCount) {
        setRecentChange('removed');
      }
      // Clear the visual indicator after 3 seconds
      const timer = setTimeout(() => setRecentChange(null), 3000);
      prevLowStockCountRef.current = currentCount;
      return () => clearTimeout(timer);
    }
    
    prevLowStockCountRef.current = currentCount;
  }, [lowStockParts.length]);

  if (lowStockParts.length === 0 && onOrderParts.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Critical Alert Banner */}
      {criticalParts.length > 0 && (
        <div className="bg-gradient-to-r from-red-600/20 via-red-500/15 to-red-600/20 border border-red-500/40 rounded-xl p-4 mb-4 animate-pulse-slow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center relative">
                <AlertCircle className="w-7 h-7 text-red-400" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {criticalParts.length}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-red-400 text-lg">Critical Stock Alert</h3>
                <p className="text-red-300/80 text-sm">
                  {criticalParts.length} part{criticalParts.length !== 1 ? 's' : ''} out of stock — immediate reorder required
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenReorderList?.()}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                <ShoppingCart className="w-4 h-4" />
                Reorder Now
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {criticalParts.slice(0, 6).map(part => (
              <div key={part.id} className="flex items-center justify-between p-2.5 bg-red-950/40 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{part.partNumber}</p>
                    <p className="text-xs text-red-300/70 truncate">{part.description}</p>
                  </div>
                </div>
                <span className="text-red-400 font-bold text-sm flex-shrink-0 ml-2">
                  {part.onHand}/{part.minQuantity}
                </span>
              </div>
            ))}
          </div>
          {criticalParts.length > 6 && (
            <p className="text-sm text-red-300/60 mt-2 text-center">
              +{criticalParts.length - 6} more critical items
            </p>
          )}
        </div>
      )}

      {/* Low Stock Summary Card */}
      <div className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all duration-300 ${
        recentChange === 'removed' ? 'border-green-500/50' :
        recentChange === 'added' ? 'border-yellow-500/50' :
        'border-slate-700/50'
      }`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-yellow-500/30 to-orange-500/30 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                Low Stock Monitor
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors duration-300 ${
                  recentChange === 'removed' ? 'bg-green-500/20 text-green-400' :
                  recentChange === 'added' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {lowStockParts.length} item{lowStockParts.length !== 1 ? 's' : ''}
                </span>
                {onOrderParts.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold">
                    {onOrderParts.length} on order
                  </span>
                )}
                {recentChange === 'removed' && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-bold animate-in fade-in">
                    Updated
                  </span>
                )}
                {recentChange === 'added' && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold animate-in fade-in">
                    New Alert
                  </span>
                )}
              </h3>
              <p className="text-slate-400 text-sm">
                Estimated reorder cost: <span className="text-orange-400 font-semibold">${estimatedReorderCost.toLocaleString()}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenReorderList?.();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              View Reorder List
            </button>
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>


        {expanded && (
          <div className="px-6 pb-5 border-t border-slate-700/50">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-5">
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-300/80">Out of Stock</span>
                </div>
                <p className="text-2xl font-bold text-red-400">{criticalParts.length}</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-300/80">Low Stock</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{warningParts.length}</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-300/80">On Order</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">{onOrderParts.length}</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-orange-300/80">Reorder Cost</span>
                </div>
                <p className="text-2xl font-bold text-orange-400">${estimatedReorderCost.toLocaleString()}</p>
              </div>
            </div>

            {/* Vendor Breakdown */}
            {vendorGroups.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Reorder by Vendor
                </h4>
                <div className="space-y-2">
                  {vendorGroups.map(group => {
                    const vendorInfo = vendorList.find(v =>
                      v.name.toLowerCase().includes(group.vendor.toLowerCase()) ||
                      group.vendor.toLowerCase().includes(v.name.toLowerCase())
                    );
                    return (
                      <div key={group.vendor} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-300" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{group.vendor}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{group.count} part{group.count !== 1 ? 's' : ''}</span>
                              {vendorInfo && (
                                <>
                                  <span className="text-slate-600">|</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {vendorInfo.leadTimeDays}d lead
                                  </span>
                                  {vendorInfo.discountPercent > 0 && (
                                    <>
                                      <span className="text-slate-600">|</span>
                                      <span className="text-green-400">{vendorInfo.discountPercent}% disc.</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-orange-400 font-semibold text-sm">${group.cost.toLocaleString()}</span>
                          <button
                            onClick={() => onNavigate('parts')}
                            className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                            title="View in Parts Inventory"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warning Parts List */}
            {warningParts.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Low Stock Items
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {warningParts.slice(0, 8).map(part => (
                    <div key={part.id} className="flex items-center justify-between p-2.5 bg-yellow-500/5 rounded-lg border border-yellow-500/15 transition-all duration-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{part.partNumber}</p>
                          <p className="text-xs text-slate-400 truncate">{part.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-yellow-400 font-mono text-sm font-bold">
                          {part.onHand}/{part.minQuantity}
                        </span>
                        <button
                          onClick={() => setDismissed(prev => new Set([...prev, part.id]))}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {warningParts.length > 8 && (
                  <button
                    onClick={() => onNavigate('parts')}
                    className="mt-2 text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    View all {warningParts.length} low stock items
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* On Order Items */}
            {onOrderParts.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400" />
                  Currently On Order
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {onOrderParts.map(part => (
                    <div key={part.id} className="flex items-center justify-between p-2.5 bg-blue-500/5 rounded-lg border border-blue-500/15">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{part.partNumber}</p>
                          <p className="text-xs text-slate-400 truncate">{part.description}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium flex-shrink-0 ml-2">
                        On Order
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlertPanel;
