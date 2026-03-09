import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';

import { useApp } from '@/contexts/AppContext';

import { CrewRole } from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
import { VendorRecord } from '@/lib/database';

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
  FileText
} from 'lucide-react';
import { PartInventoryItem } from '@/data/partsInventory';
import {
  PurchaseOrder,
  PurchaseOrderItem
} from '@/data/vendorData';
import {
  partsUsageHistory,
  PartUsageRecord,
  getUsageByPart,
  calculatePartLifecycle
} from '@/data/partsUsageData';
import LowStockAlertPanel from './LowStockAlertPanel';
import ReorderListGenerator from './ReorderListGenerator';




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

  // Quick Order Mode
  const [quickOrderMode, setQuickOrderMode] = useState(false);
  const [selectedForQuickOrder, setSelectedForQuickOrder] = useState<Set<string>>(new Set());

  // Usage History Modal State
  const [showUsageHistoryModal, setShowUsageHistoryModal] = useState(false);
  const [selectedPartForHistory, setSelectedPartForHistory] = useState<PartInventoryItem | null>(null);

  // Reorder List Generator Modal State
  const [showReorderList, setShowReorderList] = useState(false);

  // Navigation handler for LowStockAlertPanel (no-op since we're already on Parts page)
  const handleLowStockNavigate = useCallback((section: string) => {
    // Already on the parts inventory page, just scroll to top or filter
    if (section === 'parts') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Watch for external trigger to open the ReorderListGenerator modal
  // (e.g., from Dashboard's LowStockAlertPanel "Reorder Now" / "View Reorder List" buttons)
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
  // Active vendors derived from centralized context state (no more independent fetching)
  const vendors = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);



  const categories = useMemo(() => [...new Set(partsInventory.map(p => p.category))], [partsInventory]);


  // Default new part
  const defaultPart: PartInventoryItem = {
    id: '',
    partNumber: '',
    description: '',
    category: 'Engine',
    subcategory: '',
    onHand: 0,
    minQuantity: 1,
    maxQuantity: 10,
    unitCost: 0,
    totalValue: 0,
    vendor: '',
    vendorPartNumber: '',
    lastOrdered: getLocalDateString(),

    lastUsed: '',
    location: '',
    status: 'In Stock',
    reorderStatus: 'OK',
    notes: ''
  };

  const [newPart, setNewPart] = useState<PartInventoryItem>(defaultPart);

  // Filter and sort parts
  const filteredParts = useMemo(() => {
    let result = partsInventory.filter(part => {
      const matchesSearch = 
        part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.vendorPartNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || part.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return result;
  }, [partsInventory, searchTerm, categoryFilter, statusFilter, sortField, sortDirection]);

  // Parts that need ordering
  const partsNeedingOrder = useMemo(() => {
    return partsInventory.filter(p => 
      p.status === 'Low Stock' || p.status === 'Out of Stock' || 
      p.reorderStatus === 'Reorder' || p.reorderStatus === 'Critical'
    );
  }, [partsInventory]);

  // Stats
  const stats = useMemo(() => ({
    totalValue: partsInventory.reduce((sum, p) => sum + p.totalValue, 0),
    totalParts: partsInventory.length,
    lowStock: partsInventory.filter(p => p.status === 'Low Stock').length,
    outOfStock: partsInventory.filter(p => p.status === 'Out of Stock').length,
    onOrder: partsInventory.filter(p => p.reorderStatus === 'On Order').length
  }), [partsInventory]);

  const handleSort = (field: keyof PartInventoryItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    const part = partsInventory.find(p => p.id === id);
    if (!part) return;
    
    const oldQuantity = part.onHand;
    const status = newQuantity === 0 ? 'Out of Stock' : 
                   newQuantity <= part.minQuantity ? 'Low Stock' : 'In Stock';
    const reorderStatus = newQuantity === 0 ? 'Critical' :
                          newQuantity <= part.minQuantity ? 'Reorder' : 'OK';
    
    await updatePartInventory(id, {
      onHand: newQuantity,
      totalValue: newQuantity * part.unitCost,
      status: status as PartInventoryItem['status'],
      reorderStatus: reorderStatus as PartInventoryItem['reorderStatus']
    });


    // Log the inventory change
    await auditLog.logInventoryChange(
      id,
      part.description,
      'update',
      { onHand: oldQuantity, totalValue: part.totalValue },
      { onHand: newQuantity, totalValue: newQuantity * part.unitCost }
    );
  };

  const handleSavePart = async () => {
    try {
      const status = newPart.onHand === 0 ? 'Out of Stock' :
                     newPart.onHand <= newPart.minQuantity ? 'Low Stock' : 'In Stock';
      const reorderStatus = newPart.onHand === 0 ? 'Critical' :
                            newPart.onHand <= newPart.minQuantity ? 'Reorder' : 'OK';
      
      const partToSave = {
        ...newPart,
        totalValue: newPart.onHand * newPart.unitCost,
        status: status as PartInventoryItem['status'],
        reorderStatus: reorderStatus as PartInventoryItem['reorderStatus']

      };

      if (editingPart) {
        await updatePartInventory(editingPart.id, partToSave);
        
        // Log the update
        await auditLog.logInventoryChange(
          editingPart.id,
          partToSave.description,
          'update',
          editingPart,
          partToSave
        );
      } else {
        const id = `PART-${String(partsInventory.length + 1).padStart(4, '0')}`;
        await addPartInventory({ ...partToSave, id });
        
        // Log the creation
        await auditLog.logInventoryChange(
          id,
          partToSave.description,
          'create',
          undefined,
          { ...partToSave, id }
        );
      }
    } catch (error) {
      console.error('Error saving part:', error);
    } finally {
      setShowAddModal(false);
      setEditingPart(null);
      setNewPart(defaultPart);
    }
  };


  const handleDeletePart = async (id: string) => {
    const part = partsInventory.find(p => p.id === id);
    if (confirm('Are you sure you want to delete this part?')) {
      await deletePartInventory(id);
      
      // Log the deletion
      if (part) {
        await auditLog.logInventoryChange(
          id,
          part.description,
          'delete',
          part,
          undefined
        );
      }
    }
  };

  // Purchase Order Functions
  const openPOModal = (parts: PartInventoryItem[]) => {
    setSelectedPartsForPO(parts);
    
    // Auto-populate PO items
    const items: PurchaseOrderItem[] = parts.map(part => ({
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      quantity: Math.max(part.maxQuantity - part.onHand, part.minQuantity),
      unitCost: part.unitCost,
      totalCost: Math.max(part.maxQuantity - part.onHand, part.minQuantity) * part.unitCost
    }));
    
    setPOItems(items);
    
    // Try to auto-select vendor based on first part's vendor
    const firstPartVendor = parts[0]?.vendor;
    if (firstPartVendor) {
      const matchingVendor = vendors.find(v => 
        v.name.toLowerCase().includes(firstPartVendor.toLowerCase()) ||
        firstPartVendor.toLowerCase().includes(v.name.toLowerCase())
      );
      if (matchingVendor) {
        setPOVendorId(matchingVendor.id);
      }
    }
    
    setShowPOModal(true);
  };

  const handleQuickOrderToggle = (partId: string) => {
    const newSelected = new Set(selectedForQuickOrder);
    if (newSelected.has(partId)) {
      newSelected.delete(partId);
    } else {
      newSelected.add(partId);
    }
    setSelectedForQuickOrder(newSelected);
  };

  const handleCreateQuickOrder = () => {
    const parts = partsInventory.filter(p => selectedForQuickOrder.has(p.id));
    if (parts.length > 0) {
      openPOModal(parts);
      setQuickOrderMode(false);
      setSelectedForQuickOrder(new Set());
    }
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
      'Min Qty', 'Vendor', 'Vendor P/N', 'Unit Cost', 'Total Value', 
      'Last Ordered', 'Location', 'Status', 'Notes'
    ];
    const rows = filteredParts.map(p => [
      p.partNumber, p.description, p.category, p.subcategory, p.onHand,
      p.minQuantity, p.vendor, p.vendorPartNumber, p.unitCost.toFixed(2),
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
            {quickOrderMode ? (
              <>
                <button
                  onClick={() => {
                    setQuickOrderMode(false);
                    setSelectedForQuickOrder(new Set());
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleCreateQuickOrder}
                  disabled={selectedForQuickOrder.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Create PO ({selectedForQuickOrder.size})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowReorderList(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Generate Reorder List
                </button>
                <button
                  onClick={() => setQuickOrderMode(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Quick Order
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
              </>
            )}
          </div>
        </div>

        {/* Parts Needing Order Alert */}
        {partsNeedingOrder.length > 0 && !quickOrderMode && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-red-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{partsNeedingOrder.length} Parts Need Ordering</h3>
                  <p className="text-sm text-slate-400">Low stock or out of stock items requiring attention</p>
                </div>
              </div>
              <button
                onClick={() => openPOModal(partsNeedingOrder)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <ShoppingCart className="w-4 h-4" />
                Create PO for All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {partsNeedingOrder.slice(0, 6).map(part => (
                <div 
                  key={part.id} 
                  className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      part.status === 'Out of Stock' ? 'bg-red-400' : 'bg-yellow-400'
                    }`} />
                    <div>
                      <p className="text-sm text-white">{part.partNumber}</p>
                      <p className="text-xs text-slate-400">{part.description.substring(0, 30)}...</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openPOModal([part])}
                    className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                    title="Create PO"
                  >
                    <ShoppingCart className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {partsNeedingOrder.length > 6 && (
              <p className="text-sm text-slate-400 mt-2 text-center">
                +{partsNeedingOrder.length - 6} more parts need ordering
              </p>
            )}
          </div>
        )}

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
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
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
                  {quickOrderMode && (
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedForQuickOrder.size === filteredParts.filter(p => 
                          p.status === 'Low Stock' || p.status === 'Out of Stock'
                        ).length && selectedForQuickOrder.size > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const needsOrder = filteredParts.filter(p => 
                              p.status === 'Low Stock' || p.status === 'Out of Stock'
                            );
                            setSelectedForQuickOrder(new Set(needsOrder.map(p => p.id)));
                          } else {
                            setSelectedForQuickOrder(new Set());
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                      />
                    </th>
                  )}
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Description</th>
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
                      className={`border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer ${
                        quickOrderMode && selectedForQuickOrder.has(part.id) ? 'bg-green-500/10' : ''
                      }`}
                      onClick={() => {
                        if (quickOrderMode) {
                          handleQuickOrderToggle(part.id);
                        } else {
                          setExpandedPart(expandedPart === part.id ? null : part.id);
                        }
                      }}
                    >
                      {quickOrderMode && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedForQuickOrder.has(part.id)}
                            onChange={() => handleQuickOrderToggle(part.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="text-orange-400 font-mono text-sm">{part.partNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{part.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-sm">{part.category}</span>
                        <span className="text-slate-500 text-xs block">{part.subcategory}</span>
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
                          {(part.status === 'Low Stock' || part.status === 'Out of Stock') && !quickOrderMode && (
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
                    {expandedPart === part.id && !quickOrderMode && (
                      <tr className="bg-slate-900/30">
                        <td colSpan={11} className="px-4 py-4">
                          <div className="grid md:grid-cols-4 gap-6">
                            <div>
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Part Details</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Vendor P/N</span>
                                  <span className="text-white font-mono">{part.vendorPartNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Location</span>
                                  <span className="text-white">{part.location}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Max Qty</span>
                                  <span className="text-white">{part.maxQuantity}</span>
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
                              <h4 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h4>
                              <div className="space-y-2">
                                {(part.status === 'Low Stock' || part.status === 'Out of Stock') && (
                                  <button
                                    onClick={() => openPOModal([part])}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                  >
                                    <ShoppingCart className="w-4 h-4" />
                                    Create Purchase Order
                                  </button>
                                )}
                                {onNavigateToVendors && (
                                  <button
                                    onClick={onNavigateToVendors}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
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
          {categories.map(category => {
            const categoryParts = partsInventory.filter(p => p.category === category);
            const categoryValue = categoryParts.reduce((sum, p) => sum + p.totalValue, 0);
            const lowStockCount = categoryParts.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length;
            
            return (
              <div key={category} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{category}</h4>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Part Number *</label>
                  <input
                    type="text"
                    value={newPart.partNumber}
                    onChange={(e) => setNewPart({...newPart, partNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., ENG-PISTON-001"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor Part Number</label>
                  <input
                    type="text"
                    value={newPart.vendorPartNumber}
                    onChange={(e) => setNewPart({...newPart, vendorPartNumber: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
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
                    <option value="Engine">Engine</option>
                    <option value="Drivetrain">Drivetrain</option>
                    <option value="Ty-Drive">Ty-Drive</option>
                    <option value="Quick Drive">Quick Drive</option>
                    <option value="Transmission">Transmission</option>
                    <option value="Fuel System">Fuel System</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Safety">Safety</option>
                    <option value="Body">Body</option>
                    <option value="Wheels/Tires">Wheels/Tires</option>
                    <option value="Supercharger">Supercharger</option>
                  </select>

                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={newPart.subcategory}
                    onChange={(e) => setNewPart({...newPart, subcategory: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., Pistons"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
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

      {/* Usage History Modal */}
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

            {/* Usage History List */}
            <div className="space-y-3">
              <h4 className="font-medium text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                Historical Usage Records
              </h4>
              
              {(() => {
                const usageRecords = partsUsageHistory.filter(
                  u => u.partNumber === selectedPartForHistory.partNumber || 
                       u.partId === selectedPartForHistory.id
                );
                
                if (usageRecords.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No usage history found for this part</p>
                      <p className="text-sm mt-2">Usage records will appear here when this part is used in work orders</p>
                    </div>
                  );
                }
                
                return usageRecords.map(record => (
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
                        
                        <p className="text-white font-medium">{record.installedOn}</p>
                        {record.location && <p className="text-sm text-slate-400">{record.location}</p>}
                        
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                          <span className="text-slate-400">
                            Passes: <span className="text-white">{record.passesAtAction}</span>
                          </span>
                          {record.workOrderId && (
                            <span className="text-slate-400">
                              Work Order: <span className="text-orange-400">{record.workOrderId}</span>
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
                        
                        {record.notes && (
                          <p className="text-sm text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
                            {record.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-white font-medium">${record.cost.toLocaleString()}</p>
                        {record.laborCost && (
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
                ));
              })()}
            </div>

            {/* Lifecycle Stats */}
            {(() => {
              const usageRecords = partsUsageHistory.filter(
                u => u.partNumber === selectedPartForHistory.partNumber || 
                     u.partId === selectedPartForHistory.id
              );
              
              if (usageRecords.length > 0) {
                const totalCost = usageRecords.reduce((sum, r) => sum + r.cost + (r.laborCost || 0), 0);
                const installs = usageRecords.filter(r => r.action === 'installed').length;
                const removals = usageRecords.filter(r => r.action === 'removed').length;
                
                return (
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <h4 className="font-medium text-white mb-4">Lifecycle Summary</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Total Records</p>
                        <p className="text-xl font-bold text-white">{usageRecords.length}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Installs</p>
                        <p className="text-xl font-bold text-green-400">{installs}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Removals</p>
                        <p className="text-xl font-bold text-red-400">{removals}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                        <p className="text-xl font-bold text-orange-400">${totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

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
    </section>
  );
};

export default PartsInventory;
