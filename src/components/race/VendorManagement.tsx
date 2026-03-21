import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';



import { useApp } from '@/contexts/AppContext';
import InvoiceUpload from './InvoiceUpload';
import { VendorRecord } from '@/lib/database';
import { getStateSelectOptions } from '@/data/usStates';

import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  FileText,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Download,
  BarChart3,
  Calendar,
  Award,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Filter,
  Upload,
  Receipt,
  Loader2,
  RefreshCw
} from 'lucide-react';


import {
  Vendor,
  PurchaseOrder,
  PurchaseOrderItem,
  VendorPerformance,
  purchaseOrders as initialPurchaseOrders,
  vendorPerformance as initialVendorPerformance,
  VENDOR_CATEGORIES
} from '@/data/vendorData';

interface VendorManagementProps {
  currentRole?: string;
  onCreatePurchaseOrder?: (vendorId: string, items: { partId: string; quantity: number }[]) => void;
}

const VendorManagement: React.FC<VendorManagementProps> = ({ currentRole, onCreatePurchaseOrder }) => {
  const {
    partsInventory,
    vendors,
    addVendor: ctxAddVendor,
    updateVendor: ctxUpdateVendor,
    deleteVendor: ctxDeleteVendor,
    refreshVendors
  } = useApp();

  // Manual refresh state
  const [isRefreshingVendors, setIsRefreshingVendors] = useState(false);

  const handleRefreshVendors = useCallback(async () => {
    setIsRefreshingVendors(true);
    try {
      await refreshVendors();
    } finally {
      setIsRefreshingVendors(false);
    }
  }, [refreshVendors]);
  

  
  const [activeTab, setActiveTab] = useState<'vendors'>('vendors');


  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPurchaseOrders);
  const [vendorPerformance, setVendorPerformance] = useState<VendorPerformance[]>(initialVendorPerformance);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [selectedVendorForPO, setSelectedVendorForPO] = useState<string>('');

  // Performance detail modal
  const [showPerfDetailModal, setShowPerfDetailModal] = useState(false);
  const [selectedVendorPerf, setSelectedVendorPerf] = useState<string | null>(null);

  const categories = VENDOR_CATEGORIES;



  // Default new vendor
  const defaultVendor: Vendor = {
    id: '',
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    category: 'Parts Supplier',
    paymentTerms: 'Net 30',
    discountPercent: 0,
    leadTimeDays: 14,
    minimumOrder: 0,
    shippingMethod: 'UPS Ground',
    notes: '',
    rating: 5,
    isActive: true,
    createdDate: getLocalDateString()

  };

  const [newVendor, setNewVendor] = useState<Vendor>(defaultVendor);

  // Default new PO
  const defaultPO: PurchaseOrder = {
    id: '',
    vendorId: '',
    vendorName: '',
    createdDate: getLocalDateString(),
    items: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    notes: '',
    createdBy: 'Current User'
  };


  const [newPO, setNewPO] = useState<PurchaseOrder>(defaultPO);
  const [newPOItem, setNewPOItem] = useState<PurchaseOrderItem>({
    partNumber: '',
    description: '',
    quantity: 1,
    unitCost: 0,
    totalCost: 0
  });

  // Filter vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      const matchesSearch = 
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contactName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
      return matchesSearch && matchesCategory && vendor.isActive;
    });
  }, [vendors, searchTerm, categoryFilter]);

  // Filter purchase orders
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchesSearch = 
        po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalOrders = vendorPerformance.reduce((sum, vp) => sum + vp.totalOrders, 0);
    const onTimeDeliveries = vendorPerformance.reduce((sum, vp) => sum + vp.onTimeDeliveries, 0);
    
    return {
      totalVendors: vendors.filter(v => v.isActive).length,
      totalOrders: purchaseOrders.length,
      pendingOrders: purchaseOrders.filter(po => po.status !== 'Received' && po.status !== 'Cancelled').length,
      totalSpent: vendorPerformance.reduce((sum, vp) => sum + vp.totalSpent, 0),
      avgLeadTime: vendorPerformance.length > 0 ? Math.round(vendorPerformance.reduce((sum, vp) => sum + vp.averageLeadTime, 0) / vendorPerformance.length) : 0,
      onTimeRate: totalOrders > 0 ? Math.round((onTimeDeliveries / totalOrders) * 100) : 0,
      qualityIssues: vendorPerformance.reduce((sum, vp) => sum + vp.qualityIssues, 0),
      avgDiscount: vendors.filter(v => v.isActive).length > 0 ? Math.round(vendors.filter(v => v.isActive).reduce((sum, v) => sum + v.discountPercent, 0) / vendors.filter(v => v.isActive).length * 10) / 10 : 0
    };
  }, [vendors, purchaseOrders, vendorPerformance]);

  // Order history by month
  const orderHistory = useMemo(() => {
    const months: { [key: string]: { orders: number; spent: number } } = {};
    purchaseOrders.forEach(po => {
      const monthKey = po.createdDate.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) {
        months[monthKey] = { orders: 0, spent: 0 };
      }
      months[monthKey].orders++;
      months[monthKey].spent += po.total;
    });
    return Object.entries(months)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12);
  }, [purchaseOrders]);

  const handleSaveVendor = async () => {
    try {
      const id = editingVendor ? editingVendor.id : `VEND-${Date.now()}`;
      // Auto-generate vendor code from the first 4 uppercase characters of the name
      const autoCode = newVendor.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4)
        .toUpperCase()
        .padEnd(4, 'X');
      const vendorToSave: VendorRecord = {
        ...newVendor,
        id,
        code: autoCode
      };
      
      if (editingVendor) {
        // Update existing vendor via context
        await ctxUpdateVendor(id, vendorToSave);
      } else {
        // Add new vendor via context
        await ctxAddVendor(vendorToSave);
        // Initialize performance tracking for new vendor
        setVendorPerformance(prev => [...prev, {
          vendorId: id,
          totalOrders: 0,
          onTimeDeliveries: 0,
          lateDeliveries: 0,
          qualityIssues: 0,
          totalSpent: 0,
          averageLeadTime: newVendor.leadTimeDays,
          lastOrderDate: ''
        }]);
      }
      setShowVendorModal(false);
      setEditingVendor(null);
      setNewVendor(defaultVendor);
      // Trigger a background refresh to ensure DB and context stay in sync
      refreshVendors();
    } catch (err: any) {
      console.error('Failed to save vendor:', err);
      alert('Failed to save vendor: ' + (err?.message || 'Unknown error'));
    }
  };


  const handleDeleteVendor = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this vendor?')) {
      try {
        // Soft-delete: set isActive to false via context updateVendor
        await ctxUpdateVendor(id, { isActive: false });
        // Trigger a background refresh to ensure DB and context stay in sync
        refreshVendors();
      } catch (err: any) {
        console.error('Failed to deactivate vendor:', err);
        alert('Failed to deactivate vendor: ' + (err?.message || 'Unknown error'));
      }
    }
  };


  const handleAddPOItem = () => {
    if (newPOItem.description && newPOItem.quantity > 0) {
      const totalCost = newPOItem.quantity * newPOItem.unitCost;
      setNewPO(prev => ({
        ...prev,
        items: [...prev.items, { ...newPOItem, totalCost }]
      }));
      setNewPOItem({ partNumber: '', description: '', quantity: 1, unitCost: 0, totalCost: 0 });
    }
  };

  const handleRemovePOItem = (index: number) => {
    setNewPO(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculatePOTotals = () => {
    const subtotal = newPO.items.reduce((sum, item) => sum + item.totalCost, 0);
    const vendor = vendors.find(v => v.id === newPO.vendorId);
    const discount = vendor ? subtotal * (vendor.discountPercent / 100) : 0;
    const total = subtotal - discount + newPO.shipping + newPO.tax;
    return { subtotal, discount, total };
  };

  const handleSavePO = () => {
    const { subtotal, discount, total } = calculatePOTotals();
    const vendor = vendors.find(v => v.id === newPO.vendorId);
    const id = `PO-${String(purchaseOrders.length + 1).padStart(3, '0')}`;
    
    const po: PurchaseOrder = {
      ...newPO,
      id,
      vendorName: vendor?.name || '',
      subtotal,
      discount,
      total,
      expectedDelivery: vendor ?
        getLocalDateString(new Date(Date.now() + vendor.leadTimeDays * 24 * 60 * 60 * 1000)) :
        undefined
    };

    
    setPurchaseOrders(prev => [po, ...prev]);
    setShowPOModal(false);
    setNewPO(defaultPO);
  };

  const handleUpdatePOStatus = (poId: string, status: PurchaseOrder['status']) => {
    setPurchaseOrders(prev => prev.map(po => {
      if (po.id === poId) {
        const updates: any = { status };
        if (status === 'Submitted') updates.submittedDate = getLocalDateString();
        if (status === 'Received') {
          updates.receivedDate = getLocalDateString();
          
          // Update vendor performance
          const vendor = vendors.find(v => v.id === po.vendorId);
          if (vendor) {
            const expectedDate = po.expectedDelivery ? parseLocalDate(po.expectedDelivery) : null;

            const receivedDate = new Date();
            const isOnTime = !expectedDate || receivedDate <= expectedDate;
            
            setVendorPerformance(prev => prev.map(vp => {
              if (vp.vendorId === po.vendorId) {
                return {
                  ...vp,
                  totalOrders: vp.totalOrders + 1,
                  onTimeDeliveries: vp.onTimeDeliveries + (isOnTime ? 1 : 0),
                  lateDeliveries: vp.lateDeliveries + (isOnTime ? 0 : 1),
                  totalSpent: vp.totalSpent + po.total,
                  lastOrderDate: updates.receivedDate || vp.lastOrderDate
                };
              }
              return vp;
            }));
          }
        }
        return { ...po, ...updates };
      }
      return po;
    }));
  };



  const handleReportQualityIssue = (vendorId: string) => {
    setVendorPerformance(prev => prev.map(vp => {
      if (vp.vendorId === vendorId) {
        return { ...vp, qualityIssues: vp.qualityIssues + 1 };
      }
      return vp;
    }));
  };

  const getVendorPerf = (vendorId: string) => vendorPerformance.find(vp => vp.vendorId === vendorId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-slate-500/20 text-slate-400';
      case 'Submitted': return 'bg-blue-500/20 text-blue-400';
      case 'Confirmed': return 'bg-purple-500/20 text-purple-400';
      case 'Shipped': return 'bg-yellow-500/20 text-yellow-400';
      case 'Received': return 'bg-green-500/20 text-green-400';
      case 'Cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getRatingStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
      />
    ));
  };

  const getPerformanceScore = (vendorId: string) => {
    const perf = getVendorPerf(vendorId);
    if (!perf || perf.totalOrders === 0) return null;
    
    const onTimeRate = (perf.onTimeDeliveries / perf.totalOrders) * 100;
    const qualityRate = ((perf.totalOrders - perf.qualityIssues) / perf.totalOrders) * 100;
    const score = (onTimeRate * 0.6 + qualityRate * 0.4);
    
    return {
      score: Math.round(score),
      onTimeRate: Math.round(onTimeRate),
      qualityRate: Math.round(qualityRate),
      grade: score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'B+' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D'
    };
  };

  // Get parts that need ordering
  const partsNeedingOrder = useMemo(() => {
    return partsInventory.filter(p => 
      p.status === 'Low Stock' || p.status === 'Out of Stock' || p.reorderStatus === 'Reorder' || p.reorderStatus === 'Critical'
    );
  }, [partsInventory]);

  // Export functions
  const exportVendorsCSV = () => {
    const headers = ['Code', 'Name', 'Contact', 'Email', 'Phone', 'Category', 'Lead Time', 'Discount', 'Payment Terms', 'Rating'];
    const rows = vendors.filter(v => v.isActive).map(v => [
      v.code, v.name, v.contactName, v.email, v.phone, v.category, v.leadTimeDays, v.discountPercent, v.paymentTerms, v.rating
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase_orders_${getLocalDateString()}.csv`;

    a.click();
  };

  const exportOrdersCSV = () => {
    const headers = ['PO #', 'Vendor', 'Status', 'Created', 'Expected', 'Received', 'Items', 'Total'];
    const rows = purchaseOrders.map(po => [
      po.id, po.vendorName, po.status, po.createdDate, po.expectedDelivery || '', po.receivedDate || '', po.items.length, po.total
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_list_${getLocalDateString()}.csv`;

    a.click();
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-7 h-7 text-orange-500" />
              Vendor Management
            </h2>
            <p className="text-slate-400">Manage your vendor contacts and supplier information</p>

          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setEditingVendor(null);
                setNewVendor(defaultVendor);
                setShowVendorModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>

        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Active Vendors</p>
                <p className="text-xl font-bold text-white">{stats.totalVendors}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Orders</p>
                <p className="text-xl font-bold text-white">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Pending</p>
                <p className="text-xl font-bold text-yellow-400">{stats.pendingOrders}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Spent</p>
                <p className="text-lg font-bold text-green-400">${(stats.totalSpent / 1000).toFixed(0)}k</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Avg Lead Time</p>
                <p className="text-xl font-bold text-white">{stats.avgLeadTime}d</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">On-Time Rate</p>
                <p className="text-xl font-bold text-emerald-400">{stats.onTimeRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Quality Issues</p>
                <p className="text-xl font-bold text-red-400">{stats.qualityIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Percent className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Avg Discount</p>
                <p className="text-xl font-bold text-orange-400">{stats.avgDiscount}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Single Vendors tab - no tab bar needed */}


        {/* Filters - hidden on invoices tab since it has its own */}
        {activeTab !== 'invoices' && (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'vendors' ? "Search vendors..." : "Search orders..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
            />
          </div>
          
          {activeTab === 'vendors' && (
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
          )}
          
          {activeTab === 'orders' && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Shipped">Shipped</option>
                <option value="Received">Received</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <button
                onClick={exportOrdersCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </>
          )}
          
          {activeTab === 'vendors' && (
            <button
              onClick={exportVendorsCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
        )}


        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="space-y-4">
            {filteredVendors.map(vendor => {
              const perf = getVendorPerf(vendor.id);
              const perfScore = getPerformanceScore(vendor.id);
              const isExpanded = expandedVendor === vendor.id;
              
              return (
                <div
                  key={vendor.id}
                  className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => setExpandedVendor(isExpanded ? null : vendor.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                          <span className="text-orange-400 font-bold text-sm">{vendor.code}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{vendor.name}</h3>
                          <p className="text-sm text-slate-400">{vendor.category} • {vendor.contactName}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {getRatingStars(vendor.rating)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {perfScore && (
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${
                              perfScore.score >= 90 ? 'text-green-400' :
                              perfScore.score >= 80 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {perfScore.grade}
                            </div>
                            <p className="text-xs text-slate-400">Score</p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Lead Time</p>
                          <p className="text-white font-medium">{vendor.leadTimeDays} days</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Discount</p>
                          <p className="text-green-400 font-medium">{vendor.discountPercent}%</p>
                        </div>
                        {perf && (
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Total Spent</p>
                            <p className="text-white font-medium">${perf.totalSpent.toLocaleString()}</p>
                          </div>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 p-4 bg-slate-900/30">
                      <div className="grid md:grid-cols-4 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-3">Contact Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-300">
                              <Mail className="w-4 h-4 text-slate-500" />
                              <a href={`mailto:${vendor.email}`} className="hover:text-orange-400">{vendor.email}</a>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Phone className="w-4 h-4 text-slate-500" />
                              {vendor.phone}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Globe className="w-4 h-4 text-slate-500" />
                              <a href={`https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400">{vendor.website}</a>
                            </div>
                            <div className="flex items-start gap-2 text-slate-300">
                              <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                              <span>{vendor.address}, {vendor.city}, {vendor.state} {vendor.zip}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-3">Pricing & Terms</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Payment Terms</span>
                              <span className="text-white">{vendor.paymentTerms}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Discount</span>
                              <span className="text-green-400">{vendor.discountPercent}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Minimum Order</span>
                              <span className="text-white">${vendor.minimumOrder}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Shipping</span>
                              <span className="text-white">{vendor.shippingMethod}</span>
                            </div>
                          </div>
                        </div>
                        
                        {perf && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-3">Performance Metrics</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Total Orders</span>
                                <span className="text-white">{perf.totalOrders}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">On-Time Deliveries</span>
                                <span className="text-green-400">
                                  {perf.onTimeDeliveries} ({perf.totalOrders > 0 ? Math.round(perf.onTimeDeliveries / perf.totalOrders * 100) : 0}%)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Late Deliveries</span>
                                <span className={perf.lateDeliveries > 0 ? 'text-yellow-400' : 'text-white'}>{perf.lateDeliveries}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Quality Issues</span>
                                <span className={perf.qualityIssues > 0 ? 'text-red-400' : 'text-white'}>{perf.qualityIssues}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Last Order</span>
                                <span className="text-white">{perf.lastOrderDate || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h4>
                          <div className="space-y-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVendorForPO(vendor.id);
                                setNewPO({ ...defaultPO, vendorId: vendor.id, vendorName: vendor.name });
                                setShowPOModal(true);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Create PO
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReportQualityIssue(vendor.id);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Report Issue
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {vendor.notes && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                          <p className="text-sm text-slate-400">{vendor.notes}</p>
                        </div>
                      )}
                      
                      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700/50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingVendor(vendor);
                            setNewVendor(vendor);
                            setShowVendorModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVendor(vendor.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                          Deactivate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredVendors.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No vendors found</p>
              </div>
            )}
          </div>
        )}



      </div>

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
              <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newVendor.contactName}
                    onChange={(e) => setNewVendor({ ...newVendor, contactName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={newVendor.category}
                    onChange={(e) => setNewVendor({ ...newVendor, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Website</label>
                <input
                  type="text"
                  value={newVendor.website}
                  onChange={(e) => setNewVendor({ ...newVendor, website: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Address</label>
                <input
                  type="text"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={newVendor.city}
                    onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">State</label>
                  <select
                    value={newVendor.state}
                    onChange={(e) => setNewVendor({ ...newVendor, state: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {getStateSelectOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={newVendor.zip}
                    onChange={(e) => setNewVendor({ ...newVendor, zip: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              


              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowVendorModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVendor}
                disabled={!newVendor.name}

                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create Purchase Order</h3>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Vendor *</label>
                <select
                  value={newPO.vendorId}
                  onChange={(e) => {
                    const vendor = vendors.find(v => v.id === e.target.value);
                    setNewPO({ ...newPO, vendorId: e.target.value, vendorName: vendor?.name || '' });
                  }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select vendor...</option>
                  {vendors.filter(v => v.isActive).map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Add items */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  Order Items
                </h4>
                
                {/* Add from inventory */}
                <div className="flex gap-2 mb-3">
                  <select
                    value=""
                    onChange={(e) => {
                      const part = partsInventory.find(p => p.id === e.target.value);
                      if (part) {
                        setNewPOItem({
                          partId: part.id,
                          partNumber: part.partNumber,
                          description: part.description,
                          quantity: 1,
                          unitCost: part.unitCost,
                          totalCost: part.unitCost
                        });
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select from inventory...</option>
                    {partsInventory.map(part => (
                      <option key={part.id} value={part.id}>
                        {part.partNumber} - {part.description} (${part.unitCost})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Manual entry */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newPOItem.partNumber}
                    onChange={(e) => setNewPOItem({ ...newPOItem, partNumber: e.target.value })}
                    placeholder="Part #"
                    className="w-28 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    type="text"
                    value={newPOItem.description}
                    onChange={(e) => setNewPOItem({ ...newPOItem, description: e.target.value })}
                    placeholder="Description"
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    type="number"
                    value={newPOItem.quantity}
                    onChange={(e) => setNewPOItem({ ...newPOItem, quantity: parseInt(e.target.value) || 1 })}
                    placeholder="Qty"
                    className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    type="number"
                    value={newPOItem.unitCost}
                    onChange={(e) => setNewPOItem({ ...newPOItem, unitCost: parseFloat(e.target.value) || 0 })}
                    placeholder="Unit $"
                    className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleAddPOItem}
                    disabled={!newPOItem.description}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Items list */}
                {newPO.items.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                          <th className="text-left pb-2">Item</th>
                          <th className="text-center pb-2">Qty</th>
                          <th className="text-right pb-2">Unit</th>
                          <th className="text-right pb-2">Total</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newPO.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-700/50">
                            <td className="py-2 text-white">
                              {item.description}
                              <span className="text-slate-500 text-xs ml-2">{item.partNumber}</span>
                            </td>
                            <td className="py-2 text-center text-slate-300">{item.quantity}</td>
                            <td className="py-2 text-right text-slate-300">${item.unitCost.toLocaleString()}</td>
                            <td className="py-2 text-right text-white">${item.totalCost.toLocaleString()}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleRemovePOItem(idx)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              {/* Shipping and notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Shipping Cost</label>
                  <input
                    type="number"
                    value={newPO.shipping}
                    onChange={(e) => setNewPO({ ...newPO, shipping: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tax</label>
                  <input
                    type="number"
                    value={newPO.tax}
                    onChange={(e) => setNewPO({ ...newPO, tax: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newPO.notes}
                  onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              {/* Totals */}
              {newPO.items.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal:</span>
                      <span className="text-white">${calculatePOTotals().subtotal.toLocaleString()}</span>
                    </div>
                    {newPO.vendorId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Discount ({vendors.find(v => v.id === newPO.vendorId)?.discountPercent || 0}%):</span>
                        <span className="text-green-400">-${calculatePOTotals().discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping:</span>
                      <span className="text-white">${newPO.shipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax:</span>
                      <span className="text-white">${newPO.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700 font-medium">
                      <span className="text-white">Total:</span>
                      <span className="text-green-400 text-lg">${calculatePOTotals().total.toLocaleString()}</span>
                    </div>
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
                onClick={handleSavePO}
                disabled={!newPO.vendorId || newPO.items.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default VendorManagement;
