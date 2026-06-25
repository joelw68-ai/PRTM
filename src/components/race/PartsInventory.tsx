import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';

import { useApp } from '@/contexts/AppContext';

import { CrewRole } from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
import { VendorRecord } from '@/lib/database';
import { toast } from 'sonner';



import {
  Package,
  Search,
  Download,
  Plus,
  AlertTriangle,
  DollarSign,
  Truck,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Box,
  ShoppingCart,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Eye,
  FileText,
  Upload,
  Shield,
  Wrench,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { PartInventoryItem } from '@/data/partsInventory';
import { useCustomCategories, useCategoryGroups, CategoryDot } from './CategoryBadge';

import {
  PurchaseOrder,
  PurchaseOrderItem
} from '@/data/vendorData';
import {
  loadPartsUsageHistory,
  PartUsageRecord,
  getUsageByPart,
  calculatePartLifecycle
} from '@/data/partsUsageData';





// ============ MAINTENANCE HISTORY (shared with MaintenanceTracker) ============
interface MaintenanceHistoryEntry {
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

const MAINTENANCE_HISTORY_KEY = 'raceLogbook_maintenanceHistory';
const LOW_STOCK_PO_REQUEST_KEY = 'raceLogbook_lowStockPORequest';

function loadMaintenanceHistory(): MaintenanceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MAINTENANCE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

interface RecentlyDepletedPart {
  partId: string;
  partNumber: string;
  description: string;
  totalQuantityUsed: number;
  totalCost: number;
  usageCount: number;
  lastUsedDate: string;
  lastUsedComponent: string;
  currentOnHand: number;
  minQuantity: number;
  vendor: string;
  status: string;
}




interface PartsInventoryProps {
  currentRole?: CrewRole;
  onNavigateToVendors?: () => void;
  /** Incremented by parent (AppLayout) to signal this component to open the ReorderListGenerator modal */
  reorderListTrigger?: number;
}

const PartsInventory: React.FC<PartsInventoryProps> = ({ currentRole, onNavigateToVendors, reorderListTrigger }) => {

  const { partsInventory, updatePartInventory, addPartInventory, deletePartInventory, vendors: allVendors } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof PartInventoryItem>('partNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartInventoryItem | null>(null);

  // Purchase Order Modal State
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedPartsForPO, setSelectedPartsForPO] = useState<PartInventoryItem[]>([]);
  const [poVendorId, setPOVendorId] = useState<string>('');
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([]);
  const [poShipping, setPOShipping] = useState(0);
  const [poTax, setPOTax] = useState(0);
  const [poNotes, setPONotes] = useState('');
  const [createdPOs, setCreatedPOs] = useState<PurchaseOrder[]>([]);
  const [showPOSuccess, setShowPOSuccess] = useState(false);
  const [lastCreatedPO, setLastCreatedPO] = useState<PurchaseOrder | null>(null);

  // Usage History Modal State
  const [showUsageHistoryModal, setShowUsageHistoryModal] = useState(false);
  const [selectedPartForHistory, setSelectedPartForHistory] = useState<PartInventoryItem | null>(null);

  // CSV Import Modal State
  const [showCSVImport, setShowCSVImport] = useState(false);




  // Reorder List Generator Modal State
  const [showReorderList, setShowReorderList] = useState(false);

  // Recently Depleted section state
  const [recentlyDepletedExpanded, setRecentlyDepletedExpanded] = useState(true);

  // ============ RECENTLY DEPLETED PARTS (from maintenance completions) ============
  // CRITICAL: Only show parts that STILL EXIST in parts_inventory.
  // If a part has been deleted from the database, it must never appear here
  // regardless of what the maintenance history localStorage cache contains.
  const recentlyDepletedParts = useMemo<RecentlyDepletedPart[]>(() => {
    const history = loadMaintenanceHistory();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Build a Set of valid part IDs for O(1) lookups
    const validPartIds = new Set(partsInventory.map(p => p.id));

    // Filter entries from the last 7 days that used parts
    const recentEntries = history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= sevenDaysAgo && entry.partsUsed.length > 0;
    });

    if (recentEntries.length === 0) return [];

    // Aggregate parts used across all recent entries
    const partMap = new Map<string, RecentlyDepletedPart>();

    recentEntries.forEach(entry => {
      entry.partsUsed.forEach(pu => {
        // ── GUARD: Skip any part whose ID no longer exists in parts_inventory ──
        // This prevents deleted parts (like the ghost spark plug) from appearing.
        if (!validPartIds.has(pu.partId)) return;

        const inventoryPart = partsInventory.find(p => p.id === pu.partId);
        // Double-check: inventoryPart must exist (should always be true after the Set check)
        if (!inventoryPart) return;

        const existing = partMap.get(pu.partId);

        if (existing) {
          existing.totalQuantityUsed += pu.quantity;
          existing.totalCost += pu.quantity * pu.unitCost;
          existing.usageCount += 1;
          // Update to most recent usage
          if (entry.timestamp > existing.lastUsedDate) {
            existing.lastUsedDate = entry.dateCompleted;
            existing.lastUsedComponent = entry.component;
          }
          // Update current stock from live inventory
          existing.currentOnHand = inventoryPart.onHand;
          existing.status = inventoryPart.status;
        } else {
          partMap.set(pu.partId, {
            partId: pu.partId,
            partNumber: inventoryPart.partNumber,
            description: inventoryPart.description,
            totalQuantityUsed: pu.quantity,
            totalCost: pu.quantity * pu.unitCost,
            usageCount: 1,
            lastUsedDate: entry.dateCompleted,
            lastUsedComponent: entry.component,
            currentOnHand: inventoryPart.onHand,
            minQuantity: inventoryPart.minQuantity,
            vendor: inventoryPart.vendor,
            status: inventoryPart.status
          });
        }
      });
    });

    // Sort by most recently used, then by lowest stock
    return Array.from(partMap.values()).sort((a, b) => {
      // Prioritize out of stock / low stock
      if (a.currentOnHand === 0 && b.currentOnHand > 0) return -1;
      if (b.currentOnHand === 0 && a.currentOnHand > 0) return 1;
      if (a.currentOnHand <= a.minQuantity && b.currentOnHand > b.minQuantity) return -1;
      if (b.currentOnHand <= b.minQuantity && a.currentOnHand > a.minQuantity) return 1;
      // Then by total quantity used (most used first)
      return b.totalQuantityUsed - a.totalQuantityUsed;
    });
  }, [partsInventory]); // Re-compute when partsInventory changes


  // ============ PENDING PO REQUEST FROM MAINTENANCE ============
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOW_STOCK_PO_REQUEST_KEY);
      if (!raw) return;

      const request = JSON.parse(raw);
      const requestTime = new Date(request.timestamp);
      const now = new Date();
      // Only process requests from the last 5 minutes
      if (now.getTime() - requestTime.getTime() > 5 * 60 * 1000) {
        localStorage.removeItem(LOW_STOCK_PO_REQUEST_KEY);
        return;
      }

      // Find the parts that need PO
      const partIds: string[] = request.partIds || [];
      const lowStockParts = partsInventory.filter(p => partIds.includes(p.id));

      if (lowStockParts.length > 0) {
        // Auto-open PO modal for these parts
        openPOModal(lowStockParts);
        // Clear the request
        localStorage.removeItem(LOW_STOCK_PO_REQUEST_KEY);
      }
    } catch (e) {
      // Silently ignore
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // CSV Import handler — batch add parts
  const handleCSVImport = async (parts: PartInventoryItem[]) => {
    for (const part of parts) {
      await addPartInventory(part);
    }
    toast.success(`Successfully imported ${parts.length} parts`);
  };


  // Navigation handler for LowStockAlertPanel (no-op since we're already on Parts page)
  const handleLowStockNavigate = useCallback((section: string) => {
    // Already on the parts inventory page, just scroll to top or filter
    if (section === 'parts') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Watch for external trigger to open the ReorderListGenerator modal
  const prevReorderTriggerRef = useRef(reorderListTrigger ?? 0);
  useEffect(() => {
    if (
      reorderListTrigger !== undefined &&
      reorderListTrigger > 0 &&
      reorderListTrigger !== prevReorderTriggerRef.current
    ) {
      prevReorderTriggerRef.current = reorderListTrigger;
      setShowReorderList(true);
    }
  }, [reorderListTrigger]);
  // ============ VENDORS FROM APPCONTEXT ============
  const vendors = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);



  const categories = useMemo(() => [...new Set(partsInventory.map(p => p.category))], [partsInventory]);

  // Shared maintenance category colors — parts are color-coded with the SAME
  // user-defined category colors so scanning is consistent across the app.
  const customCategories = useCustomCategories();

  // The user's category groups in their preferred order (built-in defaults with
  // rename/recolor/hide + 'order' overrides applied, plus custom categories).
  // Drives the Category <select> so its ordering matches the Maintenance picker
  // and filter chips app-wide.
  const categoryGroups = useCategoryGroups();

  // Categories actually present in the inventory, sorted by the user's preferred
  // app-wide ordering (built-in defaults order, then customs order). Categories
  // not found in the user's lists fall to the end alphabetically. Used by the
  // Category filter dropdown and the "Summary by Category" cards so ordering is
  // consistent with the Maintenance picker.
  const orderedCategories = useMemo(() => {
    const orderList = [
      ...categoryGroups.general,
      ...categoryGroups.drivetrain,
      ...categoryGroups.customs,
    ].map((c) => c.name);
    const indexOf = (name: string) => {
      const i = orderList.indexOf(name);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...categories].sort((a, b) => {
      const ia = indexOf(a);
      const ib = indexOf(b);
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
  }, [categories, categoryGroups]);



  // ============ DEFAULT PART & FORM STATE ============
  const defaultPart: PartInventoryItem = {
    id: '',
    partNumber: '',
    name: '',
    description: '',
    category: 'Engine',
    subcategory: '',
    onHand: 0,
    minQuantity: 1,
    maxQuantity: 5,
    vendor: '',
    vendorPartNumber: '',
    unitCost: 0,
    totalValue: 0,
    lastOrdered: '',
    lastUsed: '',
    location: '',
    notes: '',
    status: 'In Stock',
    reorderStatus: 'OK',
  };

  const [newPart, setNewPart] = useState<PartInventoryItem>(defaultPart);

  // ============ STATS ============
  const stats = useMemo(() => {
    const totalParts = partsInventory.length;
    const totalValue = partsInventory.reduce((sum, p) => sum + p.totalValue, 0);
    const lowStock = partsInventory.filter(p => p.status === 'Low Stock').length;
    const outOfStock = partsInventory.filter(p => p.status === 'Out of Stock').length;
    const onOrder = partsInventory.filter(p => p.status === 'On Order').length;
    return { totalParts, totalValue, lowStock, outOfStock, onOrder };
  }, [partsInventory]);

  // ============ FILTERED & SORTED PARTS ============
  const filteredParts = useMemo(() => {
    let filtered = [...partsInventory];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.partNumber.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.vendor.toLowerCase().includes(term) ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.notes && p.notes.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return filtered;
  }, [partsInventory, searchTerm, categoryFilter, statusFilter, sortField, sortDirection]);

  // ============ HANDLERS ============
  const handleSort = (field: keyof PartInventoryItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUpdateQuantity = async (partId: string, newQuantity: number) => {
    const part = partsInventory.find(p => p.id === partId);
    if (!part) return;

    let newStatus: PartInventoryItem['status'] = 'In Stock';
    if (newQuantity === 0) newStatus = 'Out of Stock';
    else if (newQuantity <= part.minQuantity) newStatus = 'Low Stock';

    let newReorderStatus: PartInventoryItem['reorderStatus'] = 'OK';
    if (newQuantity === 0) newReorderStatus = 'Critical';
    else if (newQuantity <= part.minQuantity) newReorderStatus = 'Reorder';

    await updatePartInventory(partId, {
      onHand: newQuantity,
      totalValue: newQuantity * part.unitCost,
      status: newStatus,
      reorderStatus: newReorderStatus,
    });
  };

  const handleDeletePart = async (partId: string) => {
    if (!confirm('Are you sure you want to delete this part?')) return;
    await deletePartInventory(partId);
    toast.success('Part deleted');
  };

  const handleSavePart = async () => {
    if (!newPart.partNumber || !newPart.description) return;

    const partToSave: PartInventoryItem = {
      ...newPart,
      id: editingPart ? editingPart.id : `PART-${Date.now()}`,
      totalValue: newPart.onHand * newPart.unitCost,
      status: newPart.onHand === 0 ? 'Out of Stock' : newPart.onHand <= newPart.minQuantity ? 'Low Stock' : 'In Stock',
      reorderStatus: newPart.onHand === 0 ? 'Critical' : newPart.onHand <= newPart.minQuantity ? 'Reorder' : 'OK',
      name: newPart.name || newPart.description,
    };

    if (editingPart) {
      await updatePartInventory(editingPart.id, partToSave);
      toast.success('Part updated');
    } else {
      await addPartInventory(partToSave);
      toast.success('Part added');
    }

    setShowAddModal(false);
    setEditingPart(null);
    setNewPart(defaultPart);
  };

  const openPOModal = (parts: PartInventoryItem[]) => {
    setSelectedPartsForPO(parts);
    const items: PurchaseOrderItem[] = parts.map(part => ({
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      quantity: Math.max(1, part.maxQuantity - part.onHand),
      unitCost: part.unitCost,
      totalCost: Math.max(1, part.maxQuantity - part.onHand) * part.unitCost,
    }));
    setPOItems(items);

    // Auto-select vendor if all parts share the same vendor
    const vendorNames = [...new Set(parts.map(p => p.vendor).filter(Boolean))];
    if (vendorNames.length === 1) {
      const matchedVendor = vendors.find(v => v.name === vendorNames[0]);
      if (matchedVendor) setPOVendorId(matchedVendor.id);
    } else {
      setPOVendorId('');
    }

    setPOShipping(0);
    setPOTax(0);
    setPONotes('');
    setShowPOModal(true);
  };


  const updatePOItemQuantity = (index: number, quantity: number) => {
    setPOItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity, totalCost: quantity * item.unitCost } : item
    ));
  };

  const removePOItem = (index: number) => {
    setPOItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculatePOTotals = () => {
    const subtotal = poItems.reduce((sum, item) => sum + item.totalCost, 0);
    const vendor = vendors.find(v => v.id === poVendorId);
    const discount = vendor ? subtotal * (vendor.discountPercent / 100) : 0;
    const total = subtotal - discount + poShipping + poTax;
    return { subtotal, discount, total };
  };

  const handleCreatePO = () => {
    const vendor = vendors.find(v => v.id === poVendorId);
    if (!vendor || poItems.length === 0) return;

    const { subtotal, discount, total } = calculatePOTotals();
    
    const po: PurchaseOrder = {
      id: `PO-${String(createdPOs.length + 100).padStart(3, '0')}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      status: 'Draft',
      createdDate: getLocalDateString(),
      expectedDelivery: getLocalDateString(new Date(Date.now() + vendor.leadTimeDays * 24 * 60 * 60 * 1000)),

      items: poItems,
      subtotal,
      discount,
      shipping: poShipping,
      tax: poTax,
      total,
      notes: poNotes,
      createdBy: 'Current User'
    };

    setCreatedPOs(prev => [po, ...prev]);
    setLastCreatedPO(po);
    
    poItems.forEach(item => {
      if (item.partId) {
        updatePartInventory(item.partId, { reorderStatus: 'On Order' as PartInventoryItem['reorderStatus'] });
      }
    });


    // Reset modal
    setShowPOModal(false);
    setPOVendorId('');
    setPOItems([]);
    setPOShipping(0);
    setPOTax(0);
    setPONotes('');
    setSelectedPartsForPO([]);
    
    // Show success message
    setShowPOSuccess(true);
    setTimeout(() => setShowPOSuccess(false), 5000);
  };
  const exportToCSV = () => {
    const headers = [

      'Part Number', 'Description', 'Category', 'Subcategory', 'On Hand', 
      'Min Qty', 'Max Qty', 'Threshold', 'Vendor', 'Unit Cost', 'Total Value', 
      'Last Ordered', 'Location', 'Status', 'Notes'
    ];
    const rows = filteredParts.map(p => [
      p.partNumber, p.description, p.category, p.subcategory, p.onHand,
      p.minQuantity, p.maxQuantity, p.threshold ?? '', p.vendor, p.unitCost.toFixed(2),
      p.totalValue.toFixed(2), p.lastOrdered, p.location, p.status, p.notes
    ]);

    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parts_inventory_${getLocalDateString()}.csv`;

    a.click();

    // Log the export
    auditLog.logDataExport('Parts Inventory', filteredParts.length);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock': return 'bg-green-500/20 text-green-400';
      case 'Low Stock': return 'bg-yellow-500/20 text-yellow-400';
      case 'Out of Stock': return 'bg-red-500/20 text-red-400';
      case 'On Order': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getReorderColor = (status: string) => {
    switch (status) {
      case 'OK': return 'text-green-400';
      case 'Reorder': return 'text-yellow-400';
      case 'Critical': return 'text-red-400';
      case 'On Order': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Success Toast */}
        {showPOSuccess && lastCreatedPO && (
          <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-right">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <p className="font-semibold">Purchase Order Created!</p>
              <p className="text-sm text-green-100">{lastCreatedPO.id} - ${lastCreatedPO.total.toLocaleString()} to {lastCreatedPO.vendorName}</p>
            </div>
            <button onClick={() => setShowPOSuccess(false)} className="ml-4 text-green-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Low Stock Alert Panel */}
        <LowStockAlertPanel
          onNavigate={handleLowStockNavigate}
          onOpenReorderList={() => setShowReorderList(true)}
        />

        {/* ============ RECENTLY DEPLETED SECTION ============ */}
        {recentlyDepletedParts.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-orange-500/5 border border-orange-500/20 rounded-xl overflow-hidden">
            {/* Header - Collapsible */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setRecentlyDepletedExpanded(!recentlyDepletedExpanded)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRecentlyDepletedExpanded(!recentlyDepletedExpanded); }}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-orange-500/30 to-red-500/20 rounded-xl flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                    Recently Depleted
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-bold">
                      {recentlyDepletedParts.length} part{recentlyDepletedParts.length !== 1 ? 's' : ''}
                    </span>
                    {recentlyDepletedParts.some(p => p.currentOnHand === 0) && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                        {recentlyDepletedParts.filter(p => p.currentOnHand === 0).length} out of stock
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Parts used in maintenance completions over the last 7 days — 
                    <span className="text-orange-400 font-medium ml-1">
                      ${recentlyDepletedParts.reduce((s, p) => s + p.totalCost, 0).toLocaleString()} total cost
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {recentlyDepletedParts.some(p => p.currentOnHand <= p.minQuantity) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const lowParts = recentlyDepletedParts
                        .filter(p => p.currentOnHand <= p.minQuantity)
                        .map(p => partsInventory.find(inv => inv.id === p.partId))
                        .filter(Boolean) as PartInventoryItem[];
                      if (lowParts.length > 0) openPOModal(lowParts);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Reorder All Low
                  </button>
                )}
                {recentlyDepletedExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </div>

            {recentlyDepletedExpanded && (
              <div className="px-5 pb-5 border-t border-slate-700/30">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-slate-400">Total Used</span>
                    </div>
                    <p className="text-xl font-bold text-orange-400">
                      {recentlyDepletedParts.reduce((s, p) => s + p.totalQuantityUsed, 0)}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/20">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-slate-400">Parts Cost</span>
                    </div>
                    <p className="text-xl font-bold text-green-400">
                      ${recentlyDepletedParts.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/20">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-slate-400">Need Reorder</span>
                    </div>
                    <p className="text-xl font-bold text-yellow-400">
                      {recentlyDepletedParts.filter(p => p.currentOnHand <= p.minQuantity).length}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-400">Maintenance Events</span>
                    </div>
                    <p className="text-xl font-bold text-cyan-400">
                      {recentlyDepletedParts.reduce((s, p) => s + p.usageCount, 0)}
                    </p>
                  </div>
                </div>

                {/* Parts List */}
                <div className="space-y-2">
                  {recentlyDepletedParts.map(part => {
                    const isLowStock = part.currentOnHand <= part.minQuantity;
                    const isOutOfStock = part.currentOnHand === 0;
                    const inventoryPart = partsInventory.find(p => p.id === part.partId);

                    return (
                      <div
                        key={part.partId}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isOutOfStock
                            ? 'bg-red-500/5 border-red-500/20'
                            : isLowStock
                            ? 'bg-yellow-500/5 border-yellow-500/15'
                            : 'bg-slate-800/30 border-slate-700/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isOutOfStock ? 'bg-red-400 animate-pulse' :
                            isLowStock ? 'bg-yellow-400' :
                            'bg-green-400'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-400 font-mono text-sm font-medium">{part.partNumber}</span>
                              {isOutOfStock && (
                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">OUT OF STOCK</span>
                              )}
                              {isLowStock && !isOutOfStock && (
                                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold">LOW STOCK</span>
                              )}
                            </div>
                            <p className="text-white text-sm truncate">{part.description}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {part.lastUsedComponent}
                              </span>
                              <span>{part.lastUsedDate}</span>
                              {part.vendor && <span>{part.vendor}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                          {/* Usage stats */}
                          <div className="text-right hidden md:block">
                            <p className="text-sm text-slate-300">
                              <span className="text-orange-400 font-bold">{part.totalQuantityUsed}</span>
                              <span className="text-slate-500"> used</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {part.usageCount} event{part.usageCount > 1 ? 's' : ''} — ${part.totalCost.toLocaleString()}
                            </p>
                          </div>

                          {/* Current stock */}
                          <div className="text-center min-w-[60px]">
                            <p className={`text-lg font-bold ${
                              isOutOfStock ? 'text-red-400' :
                              isLowStock ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {part.currentOnHand}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              of {part.minQuantity} min
                            </p>
                          </div>

                          {/* Quick reorder button */}
                          {isLowStock && inventoryPart && (
                            <button
                              onClick={() => openPOModal([inventoryPart])}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                isOutOfStock
                                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                              }`}
                              title="Create Purchase Order"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              {isOutOfStock ? 'Reorder Now' : 'Reorder'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Header */}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-7 h-7 text-orange-500" />
              Parts Inventory
            </h2>
            <p className="text-slate-400">Comprehensive parts tracking with cost analysis and reorder management</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowCSVImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>

                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>

                <button
                  onClick={() => {
                    setEditingPart(null);
                    setNewPart(defaultPart);
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Part
                </button>
          </div>

        </div>




        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Value</p>
                <p className="text-xl font-bold text-white">${stats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Box className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Parts</p>
                <p className="text-xl font-bold text-white">{stats.totalParts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Low Stock</p>
                <p className="text-xl font-bold text-yellow-400">{stats.lowStock}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Out of Stock</p>
                <p className="text-xl font-bold text-red-400">{stats.outOfStock}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">On Order</p>
                <p className="text-xl font-bold text-purple-400">{stats.onOrder}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by part number, description, or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3">
            {/* Color swatch reflecting the selected category for fast scanning */}
            {categoryFilter !== 'all' && (
              <CategoryDot category={categoryFilter} customCategories={customCategories} />
            )}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-2 bg-transparent text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {orderedCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}

            </select>
          </div>

          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
            <option value="On Order">On Order</option>
          </select>
        </div>

        {/* Parts Table */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700/50">


                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center gap-1">
                      Description
                      {sortField === 'description' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('partNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Part #
                      {sortField === 'partNumber' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>

                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Category</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">On Hand</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Min</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vendor</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Unit Cost</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Total Value</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.map((part) => (
                  <React.Fragment key={part.id}>
                    <tr 
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer"
                      onClick={() => setExpandedPart(expandedPart === part.id ? null : part.id)}
                    >



                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{part.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-orange-400 font-mono text-sm">{part.partNumber}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {/* Shared maintenance-category color dot for fast scanning */}
                          <CategoryDot category={part.category} customCategories={customCategories} />
                          <span className="text-slate-300 text-sm">{part.category}</span>
                        </span>
                        <span className="text-slate-500 text-xs block ml-4">{part.subcategory}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${
                          part.onHand === 0 ? 'text-red-400' :
                          part.onHand <= part.minQuantity ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {part.onHand}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-slate-400 text-sm">{part.minQuantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white text-sm">{part.vendor}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-mono text-sm">${part.unitCost.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-400 font-mono text-sm font-bold">${part.totalValue.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(part.status)}`}>
                          {part.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(part.status === 'Low Stock' || part.status === 'Out of Stock') && (

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPOModal([part]);
                              }}
                              className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                              title="Create Purchase Order"
                            >
                              <ShoppingCart className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQuantity(part.id, part.onHand + 1);
                            }}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
                          >
                            +1
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (part.onHand > 0) handleUpdateQuantity(part.id, part.onHand - 1);
                            }}
                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30"
                          >
                            -1
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPart(part);
                              setNewPart(part);
                              setShowAddModal(true);
                            }}
                            className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartForHistory(part);
                              setShowUsageHistoryModal(true);
                            }}
                            className="p-1.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30"
                            title="View Usage History"
                          >
                            <History className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePart(part.id);
                            }}
                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                    </tr>
                    
                    {/* Expanded Details */}
                    {expandedPart === part.id && (

                      <tr className="bg-slate-900/30">
                        <td colSpan={11} className="px-4 py-4">
                          <div className="grid md:grid-cols-4 gap-6">
                            <div>
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Part Details</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Location</span>
                                  <span className="text-white">{part.location}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Max Qty</span>
                                  <span className="text-white">{part.maxQuantity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Threshold</span>
                                  <span className={`font-medium ${
                                    part.threshold != null && part.onHand <= part.threshold ? 'text-amber-400' : 'text-white'
                                  }`}>
                                    {part.threshold != null ? part.threshold : 'Not set'}
                                  </span>
                                </div>
                              </div>
                            </div>


                            
                            <div>
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Order Info</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Last Ordered</span>
                                  <span className="text-white">{part.lastOrdered}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Last Used</span>
                                  <span className="text-white">{part.lastUsed || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Reorder Status</span>
                                  <span className={`font-medium ${getReorderColor(part.reorderStatus)}`}>
                                    {part.reorderStatus}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Notes</h4>
                              <p className="text-white text-sm">{part.notes || 'No notes'}</p>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Vendor</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Vendor</span>
                                  <span className="text-white">{part.vendor || 'N/A'}</span>
                                </div>
                                {onNavigateToVendors && (
                                  <button
                                    onClick={onNavigateToVendors}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 mt-2"
                                  >
                                    <Building2 className="w-4 h-4" />
                                    View Vendor Details
                                  </button>
                                )}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredParts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No parts found matching your criteria</p>
            </div>
          )}
        </div>

        {/* Summary by Category */}
        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedCategories.map(category => {

            const categoryParts = partsInventory.filter(p => p.category === category);
            const categoryValue = categoryParts.reduce((sum, p) => sum + p.totalValue, 0);
            const lowStockCount = categoryParts.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length;
            
            return (
              <div key={category} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <CategoryDot category={category} customCategories={customCategories} />
                    {category}
                  </h4>

                  {lowStockCount > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                      {lowStockCount} low
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{categoryParts.length} parts</span>
                  <span className="text-green-400 font-medium">${categoryValue.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Part Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingPart ? 'Edit Part' : 'Add New Part'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Brand and Part # *</label>
                <input
                  type="text"
                  value={newPart.partNumber}
                  onChange={(e) => setNewPart({...newPart, partNumber: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., CP Carrillo CP-1234"

                />
              </div>

              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description *</label>
                <input
                  type="text"
                  value={newPart.description}
                  onChange={(e) => setNewPart({...newPart, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., CP Carrillo Custom Piston Set"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={newPart.category}
                    onChange={(e) => setNewPart({...newPart, category: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {/* Categories pull from the shared maintenanceCategories module
                        so Parts and Maintenance stay aligned (and share colors).
                        Options follow the user's preferred order (rename / recolor /
                        hide / reorder overrides applied) via useCategoryGroups(). */}
                    <optgroup label="General">
                      {categoryGroups.general.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Drivetrain Components">
                      {categoryGroups.drivetrain.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                    {categoryGroups.customs.length > 0 && (
                      <optgroup label="Custom">
                        {categoryGroups.customs.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {/* Preserve any existing/legacy value not in the shared lists. */}
                    {newPart.category &&
                      !categoryGroups.general.some((c) => c.name === newPart.category) &&
                      !categoryGroups.drivetrain.some((c) => c.name === newPart.category) &&
                      !categoryGroups.customs.some((c) => c.name === newPart.category) && (
                        <option value={newPart.category}>{newPart.category}</option>
                      )}

                  </select>

                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Subcategory</label>
                  <select
                    value={newPart.subcategory}
                    onChange={(e) => setNewPart({...newPart, subcategory: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select subcategory...</option>
                    <option value="Torque Converter">Torque Converter</option>
                    <option value="Ty-Drive">Ty-Drive</option>
                    <option value="Quick Drive">Quick Drive</option>
                    <option value="Lenco Drive">Lenco Drive</option>
                    <option value="Bruno">Bruno</option>
                    <option value="Short Block">Short Block</option>
                    <option value="Intake">Intake</option>
                    <option value="Cylinder Head">Cylinder Head</option>
                    <option value="Oil">Oil</option>
                    <option value="Fuel">Fuel</option>
                    <option value="Hartz Charger">Hartz Charger</option>
                    <option value="Procharger">Procharger</option>
                    <option value="Screw Blower">Screw Blower</option>
                    <option value="Roots Blower">Roots Blower</option>
                    <option value="Turbo Charger">Turbo Charger</option>
                    <option value="Other">Other</option>
                  </select>
                </div>


              </div>
              

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">On Hand</label>
                  <input
                    type="number"
                    value={newPart.onHand}
                    onChange={(e) => setNewPart({...newPart, onHand: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Min Quantity</label>
                  <input
                    type="number"
                    value={newPart.minQuantity}
                    onChange={(e) => setNewPart({...newPart, minQuantity: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Quantity</label>
                  <input
                    type="number"
                    value={newPart.maxQuantity}
                    onChange={(e) => setNewPart({...newPart, maxQuantity: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Threshold
                    <span className="ml-1 text-xs text-amber-400">(alert)</span>
                  </label>
                  <input
                    type="number"
                    value={newPart.threshold ?? ''}
                    onChange={(e) => setNewPart({...newPart, threshold: e.target.value === '' ? undefined : parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., 3"
                  />
                  <p className="text-xs text-slate-500 mt-1">Alert when stock falls to this level</p>
                </div>
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPart.unitCost}
                    onChange={(e) => setNewPart({...newPart, unitCost: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                  <select
                    value={newPart.vendor}
                    onChange={(e) => setNewPart({...newPart, vendor: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={newPart.location}
                  onChange={(e) => setNewPart({...newPart, location: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Trailer - Shelf A3"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newPart.notes}
                  onChange={(e) => setNewPart({...newPart, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePart}
                disabled={!newPart.partNumber || !newPart.description}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingPart ? 'Save Changes' : 'Add Part'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-green-400" />
                  Create Purchase Order
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedPartsForPO.length} part{selectedPartsForPO.length !== 1 ? 's' : ''} selected for ordering
                </p>
              </div>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Vendor Selection */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Select Vendor *</label>
                <select
                  value={poVendorId}
                  onChange={(e) => setPOVendorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Choose a vendor...</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.category}) - {vendor.leadTimeDays} day lead time
                    </option>
                  ))}
                </select>
                {poVendorId && (
                  <div className="mt-2 p-3 bg-slate-900/50 rounded-lg">
                    {(() => {
                      const vendor = vendors.find(v => v.id === poVendorId);
                      if (!vendor) return null;
                      return (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Discount:</span>
                            <span className="text-green-400 ml-2">{vendor.discountPercent}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Lead Time:</span>
                            <span className="text-white ml-2">{vendor.leadTimeDays} days</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Terms:</span>
                            <span className="text-white ml-2">{vendor.paymentTerms}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  Order Items
                </h4>
                <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                        <th className="text-left px-4 py-2">Part</th>
                        <th className="text-center px-4 py-2">Current</th>
                        <th className="text-center px-4 py-2">Order Qty</th>
                        <th className="text-right px-4 py-2">Unit Cost</th>
                        <th className="text-right px-4 py-2">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.map((item, index) => {
                        const part = partsInventory.find(p => p.id === item.partId);
                        return (
                          <tr key={index} className="border-b border-slate-700/50">
                            <td className="px-4 py-3">
                              <p className="text-white">{item.description}</p>
                              <p className="text-xs text-slate-400">{item.partNumber}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-medium ${
                                part?.onHand === 0 ? 'text-red-400' : 
                                (part?.onHand || 0) <= (part?.minQuantity || 0) ? 'text-yellow-400' : 'text-green-400'
                              }`}>
                                {part?.onHand || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updatePOItemQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              ${item.unitCost.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-white font-medium">
                              ${item.totalCost.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => removePOItem(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shipping and Tax */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Shipping Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poShipping}
                    onChange={(e) => setPOShipping(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tax ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poTax}
                    onChange={(e) => setPOTax(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  rows={2}
                  placeholder="Add any special instructions or notes..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                />
              </div>

              {/* Totals */}
              {poItems.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal:</span>
                      <span className="text-white">${calculatePOTotals().subtotal.toLocaleString()}</span>
                    </div>
                    {poVendorId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Discount ({vendors.find(v => v.id === poVendorId)?.discountPercent || 0}%):
                        </span>
                        <span className="text-green-400">-${calculatePOTotals().discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping:</span>
                      <span className="text-white">${poShipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax:</span>
                      <span className="text-white">${poTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700 font-medium">
                      <span className="text-white">Total:</span>
                      <span className="text-green-400 text-lg">${calculatePOTotals().total.toLocaleString()}</span>
                    </div>
                    {poVendorId && (
                      <div className="flex items-center gap-2 pt-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>
                          Expected delivery: {new Date(Date.now() + (vendors.find(v => v.id === poVendorId)?.leadTimeDays || 14) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPOModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePO}
                disabled={!poVendorId || poItems.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage History Modal — reads live from localStorage */}
      {showUsageHistoryModal && selectedPartForHistory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-6 h-6 text-purple-400" />
                  Usage History
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedPartForHistory.partNumber} - {selectedPartForHistory.description}
                </p>
              </div>
              <button onClick={() => setShowUsageHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Part Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Current Stock</p>
                <p className={`text-xl font-bold ${
                  selectedPartForHistory.onHand === 0 ? 'text-red-400' :
                  selectedPartForHistory.onHand <= selectedPartForHistory.minQuantity ? 'text-yellow-400' : 'text-green-400'
                }`}>{selectedPartForHistory.onHand}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Unit Cost</p>
                <p className="text-xl font-bold text-white">${selectedPartForHistory.unitCost.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Last Ordered</p>
                <p className="text-white">{selectedPartForHistory.lastOrdered || 'N/A'}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Last Used</p>
                <p className="text-white">{selectedPartForHistory.lastUsed || 'N/A'}</p>
              </div>
            </div>

            {/* Usage History List — loaded from localStorage */}
            <div className="space-y-3">
              <h4 className="font-medium text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                Historical Usage Records
              </h4>
              
              {(() => {
                // Load fresh from localStorage every time the modal renders
                const allUsageRecords = loadPartsUsageHistory();
                const usageRecords = allUsageRecords.filter(
                  u => u.partNumber === selectedPartForHistory.partNumber || 
                       u.partId === selectedPartForHistory.id
                ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                if (usageRecords.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No usage history found for this part</p>
                      <p className="text-sm mt-2">Usage records will appear here when this part is used in maintenance completions</p>

                    </div>
                  );
                }
                
                return (
                  <>
                    {usageRecords.map(record => (
                      <div key={record.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {record.action === 'installed' && <ArrowDownCircle className="w-4 h-4 text-green-400" />}
                              {record.action === 'removed' && <ArrowUpCircle className="w-4 h-4 text-red-400" />}
                              {record.action === 'replaced' && <RefreshCw className="w-4 h-4 text-yellow-400" />}
                              {record.action === 'inspected' && <Eye className="w-4 h-4 text-blue-400" />}
                              {record.action === 'serviced' && <RefreshCw className="w-4 h-4 text-purple-400" />}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                record.action === 'installed' ? 'bg-green-500/20 text-green-400' :
                                record.action === 'removed' ? 'bg-red-500/20 text-red-400' :
                                record.action === 'replaced' ? 'bg-yellow-500/20 text-yellow-400' :
                                record.action === 'inspected' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {record.action}
                              </span>
                              <span className="text-slate-400 text-sm">{record.date}</span>
                              {record.time && <span className="text-slate-500 text-sm">{record.time}</span>}
                            </div>
                            
                            {/* Reason / Notes — prominently displayed */}
                            {record.notes && (
                              <p className="text-white font-medium mb-1">{record.notes}</p>
                            )}
                            
                            {/* Key details grid */}
                            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
                              {/* Quantity Used */}
                              {record.quantityUsed && record.quantityUsed > 0 && (
                                <span className="text-slate-400">
                                  Qty Used: <span className="text-orange-400 font-bold">{record.quantityUsed}</span>
                                </span>
                              )}
                              {/* Car */}
                              {record.carName && (
                                <span className="text-slate-400">
                                  Car: <span className="text-cyan-400">{record.carName}</span>
                                </span>
                              )}
                              {/* Pass Number */}
                              {record.passesAtAction > 0 && (
                                <span className="text-slate-400">
                                  Pass #: <span className="text-white">{record.passesAtAction}</span>
                                </span>
                              )}
                              {/* Installed On / Component */}
                              {record.installedOn && (
                                <span className="text-slate-400">
                                  Component: <span className="text-white">{record.installedOn}</span>
                                </span>
                              )}


                              {record.raceEventName && (
                                <span className="text-slate-400">
                                  Event: <span className="text-cyan-400">{record.raceEventName}</span>
                                </span>
                              )}
                              <span className="text-slate-400">
                                By: <span className="text-white">{record.performedBy}</span>
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            <p className="text-white font-medium">${record.cost.toLocaleString()}</p>
                            {record.laborCost && record.laborCost > 0 && (
                              <p className="text-xs text-slate-400">+${record.laborCost.toLocaleString()} labor</p>
                            )}
                            {record.conditionOnRemoval && (
                              <span className={`mt-2 inline-block px-2 py-0.5 rounded text-xs ${
                                record.conditionOnRemoval === 'Good' ? 'bg-green-500/20 text-green-400' :
                                record.conditionOnRemoval === 'Worn' ? 'bg-yellow-500/20 text-yellow-400' :
                                record.conditionOnRemoval === 'Damaged' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {record.conditionOnRemoval}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Lifecycle Stats Summary */}
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <h4 className="font-medium text-white mb-4">Lifecycle Summary</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total Records</p>
                          <p className="text-xl font-bold text-white">{usageRecords.length}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total Qty Used</p>
                          <p className="text-xl font-bold text-orange-400">
                            {usageRecords.reduce((sum, r) => sum + (r.quantityUsed || 0), 0)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Cars Used On</p>
                          <p className="text-xl font-bold text-cyan-400">
                            {new Set(usageRecords.filter(r => r.carName).map(r => r.carName)).size || 0}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                          <p className="text-xl font-bold text-green-400">
                            ${usageRecords.reduce((sum, r) => sum + r.cost + (r.laborCost || 0), 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowUsageHistoryModal(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Reorder List Generator Modal */}
      <ReorderListGenerator
        isOpen={showReorderList}
        onClose={() => setShowReorderList(false)}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onImport={handleCSVImport}
      />



    </section>

  );
};

export default PartsInventory;
