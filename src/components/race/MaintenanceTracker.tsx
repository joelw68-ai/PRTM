import React, { useState, useMemo, useEffect } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';
import CarDropdown from '@/components/race/CarDropdown';
import { useCar } from '@/contexts/CarContext';

import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import { MaintenanceItem, SFICertification } from '@/data/proModData';
import { PartInventoryItem } from '@/data/partsInventory';
import { toast } from 'sonner';
import MaintenanceCostReports from './MaintenanceCostReports';


import { 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield,
  Calendar,
  Plus,
  FileText,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Package,
  History,
  BarChart3
} from 'lucide-react';


// ============ MAINTENANCE HISTORY (localStorage) ============
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

function loadMaintenanceHistory(): MaintenanceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MAINTENANCE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMaintenanceHistory(entries: MaintenanceHistoryEntry[]) {
  try {
    localStorage.setItem(MAINTENANCE_HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save maintenance history to localStorage:', e);
  }
}

// ============ COMPONENT ============

interface MaintenanceTrackerProps {
  onNavigate?: (section: string) => void;
  currentRole?: CrewRole;
}

const MaintenanceTracker: React.FC<MaintenanceTrackerProps> = ({ onNavigate, currentRole = 'Crew' }) => {

  const { 
    maintenanceItems, 
    sfiCertifications, 
    updateMaintenanceItem, 
    addMaintenanceItem,
    deleteMaintenanceItem,
    addSFICertification,
    updateSFICertification,
    deleteSFICertification,
    addWorkOrder, 
    workOrders,
    drivetrainComponents,
    vendors: allVendors,
    partsInventory,
    updatePartInventory
  } = useApp();


  const { selectedCarId, getCarLabel } = useCar();
  
  const [activeTab, setActiveTab] = useState<'maintenance' | 'sfi' | 'costReports'>('maintenance');

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Modals
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showSFIModal, setShowSFIModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
  const [editingSFI, setEditingSFI] = useState<SFICertification | null>(null);

  // Complete Maintenance Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<MaintenanceItem | null>(null);
  const [completeDateValue, setCompleteDateValue] = useState(getLocalDateString());
  const [completePassNumber, setCompletePassNumber] = useState<string>('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completePartsUsed, setCompletePartsUsed] = useState<{ partId: string; quantity: number }[]>([]);
  const [partsSearchTerm, setPartsSearchTerm] = useState('');
  const [showPartsDropdown, setShowPartsDropdown] = useState(false);

  // Maintenance History
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    setMaintenanceHistory(loadMaintenanceHistory());
  }, []);

  // Drivetrain category labels
  const drivetrainCategoryLabels: Record<string, string> = {
    transmission: 'Transmission',
    transmission_drive: 'Transmission Drive',
    torque_converter: 'Torque Converter',
    third_member: '3rd Member',
    ring_and_pinion: 'Ring & Pinion'
  };

  // Build categories list including drivetrain types
  const baseCats = [...new Set(maintenanceItems.map(m => m.category))];
  const drivetrainCats = ['Drivetrain - Transmission', 'Drivetrain - Torque Converter', 'Drivetrain - 3rd Member', 'Drivetrain - Ring & Pinion', 'Drivetrain - Trans Drive'];
  const categories = [...new Set([...baseCats, ...drivetrainCats])];

  // Helper: check if a car_id is empty/null/undefined
  const isEmptyCarId = (id: string | null | undefined): boolean => !id || id === '';


  // Filter by selected car AND category
  const filteredMaintenance = maintenanceItems.filter(item => {
    const carId = item.car_id;
    const matchesCar = isEmptyCarId(selectedCarId) || carId === selectedCarId || isEmptyCarId(carId);
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesCar && matchesCategory;
  });


  const sortedMaintenance = [...filteredMaintenance].sort((a, b) => {
    const statusOrder = { 'Overdue': 0, 'Due': 1, 'Due Soon': 2, 'Good': 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Filter SFI certifications by selected car
  const filteredSfiCertifications = sfiCertifications.filter(cert => {
    const carId = cert.car_id;
    return isEmptyCarId(selectedCarId) || carId === selectedCarId || isEmptyCarId(carId);
  });


  const sortedCertifications = [...filteredSfiCertifications].sort((a, b) => 
    a.daysUntilExpiration - b.daysUntilExpiration
  );


  // Default new maintenance item - auto-assign selected car
  const defaultMaintenance: MaintenanceItem = {
    id: '',
    component: '',
    category: 'Drivetrain',
    passInterval: 50,
    currentPasses: 0,
    lastService: getLocalDateString(),
    nextServicePasses: 50,
    status: 'Good',
    priority: 'Medium',
    notes: '',
    car_id: selectedCarId || '',
  };



  // Default new SFI certification - auto-assign selected car
  const defaultSFI: SFICertification = {
    id: '',
    item: '',
    sfiSpec: '',
    certificationDate: getLocalDateString(),
    expirationDate: getLocalDateString(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2)),
    vendor: '',
    serialNumber: '',
    status: 'Valid',
    daysUntilExpiration: 730,
    notes: '',
    car_id: selectedCarId || '',
  };


  const [newMaintenance, setNewMaintenance] = useState<MaintenanceItem>(defaultMaintenance);
  const [newSFI, setNewSFI] = useState<SFICertification>(defaultSFI);

  // Active vendors derived from centralized AppContext (no more independent fetching)
  const vendorsList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);

  // Filtered parts for the searchable dropdown
  const filteredPartsForDropdown = useMemo(() => {
    if (!partsSearchTerm.trim()) return partsInventory.slice(0, 20);
    const term = partsSearchTerm.toLowerCase();
    return partsInventory.filter(p =>
      p.description.toLowerCase().includes(term) ||
      p.partNumber.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.name && p.name.toLowerCase().includes(term))
    ).slice(0, 20);
  }, [partsInventory, partsSearchTerm]);

  // ============ COMPLETE MAINTENANCE HANDLERS ============

  const openCompleteModal = (item: MaintenanceItem) => {
    setCompletingItem(item);
    setCompleteDateValue(getLocalDateString());
    setCompletePassNumber('');
    setCompleteNotes('');
    setCompletePartsUsed([]);
    setPartsSearchTerm('');
    setShowPartsDropdown(false);
    setShowCompleteModal(true);
  };

  const addPartToCompletion = (part: PartInventoryItem) => {
    // Don't add if already in list
    if (completePartsUsed.some(p => p.partId === part.id)) {
      setPartsSearchTerm('');
      setShowPartsDropdown(false);
      return;
    }
    setCompletePartsUsed(prev => [...prev, { partId: part.id, quantity: 1 }]);
    setPartsSearchTerm('');
    setShowPartsDropdown(false);
  };

  const updatePartQuantity = (partId: string, quantity: number) => {
    setCompletePartsUsed(prev => prev.map(p =>
      p.partId === partId ? { ...p, quantity: Math.max(1, quantity) } : p
    ));
  };

  const removePartFromCompletion = (partId: string) => {
    setCompletePartsUsed(prev => prev.filter(p => p.partId !== partId));
  };

  const handleConfirmComplete = async () => {
    if (!completingItem) return;

    try {
      // 1. Mark maintenance item as completed — reset passes, set status Good
      await updateMaintenanceItem(completingItem.id, {
        lastService: completeDateValue,
        currentPasses: 0,
        nextServicePasses: completingItem.passInterval,
        status: 'Good',
        notes: completeNotes ? `${completingItem.notes ? completingItem.notes + ' | ' : ''}Completed ${completeDateValue}: ${completeNotes}` : completingItem.notes
      });

      // 2. Deduct parts from inventory and track low-stock parts
      const lowStockParts: { id: string; partNumber: string; description: string; onHand: number; minQuantity: number; vendor: string }[] = [];

      for (const usedPart of completePartsUsed) {
        const inventoryPart = partsInventory.find(p => p.id === usedPart.partId);
        if (inventoryPart) {
          const newOnHand = Math.max(0, inventoryPart.onHand - usedPart.quantity);
          const status: PartInventoryItem['status'] = newOnHand === 0 ? 'Out of Stock' :
            newOnHand <= inventoryPart.minQuantity ? 'Low Stock' : 'In Stock';
          const reorderStatus: PartInventoryItem['reorderStatus'] = newOnHand === 0 ? 'Critical' :
            newOnHand <= inventoryPart.minQuantity ? 'Reorder' : 'OK';

          await updatePartInventory(inventoryPart.id, {
            onHand: newOnHand,
            totalValue: newOnHand * inventoryPart.unitCost,
            status,
            reorderStatus,
            lastUsed: completeDateValue
          });

          // Check if part dropped below minimum threshold
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

      // 3. Log completion in maintenance history (localStorage)
      const historyEntry: MaintenanceHistoryEntry = {
        id: `MH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        maintenanceItemId: completingItem.id,
        component: completingItem.component,
        category: completingItem.category,
        dateCompleted: completeDateValue,
        passNumberCompletedAt: completePassNumber ? parseInt(completePassNumber) : null,
        partsUsed: completePartsUsed.map(pu => {
          const part = partsInventory.find(p => p.id === pu.partId);
          return {
            partId: pu.partId,
            partNumber: part?.partNumber || '',
            description: part?.description || '',
            quantity: pu.quantity,
            unitCost: part?.unitCost || 0
          };
        }),
        notes: completeNotes,
        timestamp: new Date().toISOString()
      };

      const updatedHistory = [historyEntry, ...maintenanceHistory];
      setMaintenanceHistory(updatedHistory);
      saveMaintenanceHistory(updatedHistory);

      // Close modal and show success
      setShowCompleteModal(false);
      setCompletingItem(null);

      const partsCount = completePartsUsed.length;
      toast.success(`Maintenance completed: ${completingItem.component}`, {
        description: partsCount > 0
          ? `${partsCount} part${partsCount > 1 ? 's' : ''} deducted from inventory. Next due in ${completingItem.passInterval} passes.`
          : `Next due in ${completingItem.passInterval} passes.`,
        duration: 5000,
      });

      // 4. Show low-stock toast notifications with "Create Purchase Order" button
      if (lowStockParts.length > 0) {
        // Store low-stock part IDs in localStorage for PartsInventory to pick up
        try {
          const poRequest = {
            partIds: lowStockParts.map(p => p.id),
            timestamp: new Date().toISOString(),
            source: 'maintenance_completion',
            maintenanceComponent: completingItem.component
          };
          localStorage.setItem('raceLogbook_lowStockPORequest', JSON.stringify(poRequest));
        } catch (e) {
          console.warn('Failed to store PO request:', e);
        }

        // Show individual toast for each low-stock part (max 3, then summary)
        if (lowStockParts.length <= 3) {
          lowStockParts.forEach((part, index) => {
            setTimeout(() => {
              toast.warning(
                `Low Stock Alert: ${part.partNumber}`,
                {
                  description: `${part.description} — ${part.onHand === 0 ? 'OUT OF STOCK' : `only ${part.onHand} remaining`} (min: ${part.minQuantity})`,
                  duration: 15000,
                  action: {
                    label: 'Create Purchase Order',
                    onClick: () => {
                      if (onNavigate) onNavigate('parts');
                    }
                  }
                }
              );
            }, (index + 1) * 800); // Stagger toasts
          });
        } else {
          // Summary toast for many parts
          setTimeout(() => {
            const outOfStock = lowStockParts.filter(p => p.onHand === 0).length;
            const lowStock = lowStockParts.length - outOfStock;
            toast.warning(
              `${lowStockParts.length} Parts Below Minimum Stock`,
              {
                description: `${outOfStock > 0 ? `${outOfStock} out of stock, ` : ''}${lowStock > 0 ? `${lowStock} low stock` : ''} — ${lowStockParts.map(p => p.partNumber).join(', ')}`,
                duration: 15000,
                action: {
                  label: 'Create Purchase Order',
                  onClick: () => {
                    if (onNavigate) onNavigate('parts');
                  }
                }
              }
            );
          }, 800);
        }
      }
    } catch (error) {
      console.error('Error completing maintenance:', error);
      toast.error('Failed to complete maintenance. Please try again.');
    }
  };


  // ============ EXISTING HANDLERS ============

  const handleCreateWorkOrder = (item: MaintenanceItem) => {
    const newWorkOrder = {
      id: `WO-${String(workOrders.length + 1).padStart(3, '0')}`,
      title: `${item.component} Service`,
      description: `Scheduled maintenance for ${item.component}. ${item.notes}`,
      category: item.category,
      priority: item.status === 'Overdue' ? 'Critical' as const : item.status === 'Due' ? 'High' as const : 'Medium' as const,
      status: 'Open' as const,
      createdDate: getLocalDateString(),
      dueDate: getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      assignedTo: '',
      estimatedHours: 2,
      parts: [],
      relatedComponent: item.id,
      notes: ''
    };
    addWorkOrder(newWorkOrder);
    if (onNavigate) onNavigate('workorders');
  };

  const handleSaveMaintenance = async () => {
    try {
      // Compute the correct status based on current passes and next service passes
      const remaining = newMaintenance.nextServicePasses - newMaintenance.currentPasses;
      const percentage = newMaintenance.passInterval > 0 
        ? (remaining / newMaintenance.passInterval) * 100 
        : 100;
      
      let computedStatus: MaintenanceItem['status'] = 'Good';
      if (remaining <= 0) computedStatus = 'Overdue';
      else if (percentage <= 10) computedStatus = 'Due';
      else if (percentage <= 25) computedStatus = 'Due Soon';

      const itemToSave: MaintenanceItem = {
        ...newMaintenance,
        status: computedStatus
      };

      if (editingMaintenance) {
        await updateMaintenanceItem(editingMaintenance.id, itemToSave);
      } else {
        const id = `MT-${String(maintenanceItems.length + 1).padStart(3, '0')}`;
        await addMaintenanceItem({ ...itemToSave, id });
      }
    } catch (error) {
      console.error('Error saving maintenance item:', error);
    } finally {
      setShowMaintenanceModal(false);
      setEditingMaintenance(null);
      setNewMaintenance(defaultMaintenance);
    }
  };


  const handleDeleteMaintenance = async (id: string) => {
    if (confirm('Are you sure you want to delete this maintenance item?')) {
      await deleteMaintenanceItem(id);
    }
  };

  const calculateSFIStatus = (expirationDate: string): { status: SFICertification['status'], daysUntilExpiration: number } => {
    const expDate = parseLocalDate(expirationDate);

    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status: SFICertification['status'] = 'Valid';
    if (diffDays <= 0) status = 'Expired';
    else if (diffDays <= 60) status = 'Expiring Soon';
    
    return { status, daysUntilExpiration: diffDays };
  };

  const handleSaveSFI = async () => {
    try {
      const { status, daysUntilExpiration } = calculateSFIStatus(newSFI.expirationDate);
      const sfiToSave = { ...newSFI, status, daysUntilExpiration };
      
      if (editingSFI) {
        await updateSFICertification(editingSFI.id, sfiToSave);
      } else {
        const id = `SFI-${String(sfiCertifications.length + 1).padStart(3, '0')}`;
        await addSFICertification({ ...sfiToSave, id });
      }
    } catch (error) {
      console.error('Error saving SFI certification:', error);
    } finally {
      setShowSFIModal(false);
      setEditingSFI(null);
      setNewSFI(defaultSFI);
    }
  };


  const handleDeleteSFI = async (id: string) => {
    if (confirm('Are you sure you want to delete this SFI certification?')) {
      await deleteSFICertification(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Overdue': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Due': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'Due Soon': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Good': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getSFIStatusColor = (status: string) => {
    switch (status) {
      case 'Expired': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Expiring Soon': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Valid': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  // Get history for a specific maintenance item
  const getItemHistory = (itemId: string) => {
    return maintenanceHistory.filter(h => h.maintenanceItemId === itemId);
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Maintenance & Safety</h2>
            <p className="text-slate-400">Pass-count driven maintenance schedules and SFI certifications</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'maintenance' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Maintenance Schedule
          </button>
          <button
            onClick={() => setActiveTab('sfi')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'sfi' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            SFI Certifications
            {filteredSfiCertifications.filter(c => c.daysUntilExpiration <= 60).length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {filteredSfiCertifications.filter(c => c.daysUntilExpiration <= 60).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('costReports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'costReports' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Cost Reports
          </button>
        </div>




        {activeTab === 'maintenance' && (
          <>
            {/* Category Filter + Add Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterCategory === 'all' 
                      ? 'bg-orange-500/20 text-orange-400' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      filterCategory === cat 
                        ? 'bg-orange-500/20 text-orange-400' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEditingMaintenance(null);
                  setNewMaintenance(defaultMaintenance);
                  setShowMaintenanceModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Summary Cards - use filteredMaintenance to respect car filter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Overdue</span>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  {filteredMaintenance.filter(m => m.status === 'Overdue').length}
                </p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Due Now</span>
                </div>
                <p className="text-2xl font-bold text-orange-400">
                  {filteredMaintenance.filter(m => m.status === 'Due').length}
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Due Soon</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {filteredMaintenance.filter(m => m.status === 'Due Soon').length}
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Good</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {filteredMaintenance.filter(m => m.status === 'Good').length}
                </p>
              </div>
            </div>


            {/* Maintenance Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Component</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Category</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Interval</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Current</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Remaining</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMaintenance.map((item) => {
                      const remaining = item.nextServicePasses - item.currentPasses;
                      const progress = (item.currentPasses / item.nextServicePasses) * 100;
                      const itemHistoryCount = getItemHistory(item.id).length;
                      
                      return (
                        <React.Fragment key={item.id}>
                          <tr 
                            className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer"
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          >
                            <td className="px-4 py-3">
                              <p className="text-white font-medium">{item.component}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-slate-400">{item.category}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-white">{item.passInterval} passes</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-white">{item.currentPasses}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={remaining <= 0 ? 'text-red-400' : remaining <= 5 ? 'text-yellow-400' : 'text-white'}>
                                {remaining}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openCompleteModal(item); }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-xs font-medium"
                                  title="Complete Maintenance"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Complete
                                </button>
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingMaintenance(item);
                                    setNewMaintenance(item);
                                    setShowMaintenanceModal(true);
                                  }}
                                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCreateWorkOrder(item); }}
                                  className="p-1.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30"
                                  title="Create work order"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                {itemHistoryCount > 0 && (
                                  <button
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setHistoryItemId(item.id);
                                      setShowHistoryModal(true);
                                    }}
                                    className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 relative"
                                    title="View history"
                                  >
                                    <History className="w-4 h-4" />
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-white text-[10px] rounded-full flex items-center justify-center">
                                      {itemHistoryCount}
                                    </span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMaintenance(item.id); }}
                                  className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {expandedItem === item.id && (
                            <tr className="bg-slate-900/30">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-slate-400 mb-1">Last Service</p>
                                    <p className="text-white">{item.lastService}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-400 mb-1">Progress</p>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          progress >= 100 ? 'bg-red-500' :
                                          progress >= 75 ? 'bg-yellow-500' :
                                          'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{Math.round(progress)}% of interval</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-400 mb-1">Notes</p>
                                    <p className="text-white text-sm">{item.notes || 'No notes'}</p>
                                  </div>
                                </div>
                                {/* Inline history preview */}
                                {getItemHistory(item.id).length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                                    <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                                      <History className="w-3.5 h-3.5" />
                                      Recent Completions ({getItemHistory(item.id).length} total)
                                    </p>
                                    <div className="space-y-2">
                                      {getItemHistory(item.id).slice(0, 3).map(h => (
                                        <div key={h.id} className="flex items-center justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                                          <div className="flex items-center gap-3">
                                            <span className="text-green-400 font-medium">{h.dateCompleted}</span>
                                            {h.passNumberCompletedAt !== null && (
                                              <span className="text-slate-400">Pass #{h.passNumberCompletedAt}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            {h.partsUsed.length > 0 && (
                                              <span className="text-orange-400 text-xs">
                                                {h.partsUsed.length} part{h.partsUsed.length > 1 ? 's' : ''} used
                                              </span>
                                            )}
                                            {h.notes && (
                                              <span className="text-slate-500 text-xs max-w-[200px] truncate">{h.notes}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'sfi' && (
          <>
            {/* Add SFI Button */}
            <div className="flex justify-end mb-6">
              <button
                onClick={() => {
                  setEditingSFI(null);
                  setNewSFI(defaultSFI);
                  setShowSFIModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Certification
              </button>
            </div>

            {/* SFI Alert Banner - uses filtered data */}
            {filteredSfiCertifications.some(c => c.daysUntilExpiration <= 0) && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <div>
                    <h3 className="font-semibold text-red-400">EXPIRED CERTIFICATIONS</h3>
                    <p className="text-red-300 text-sm">
                      {filteredSfiCertifications.filter(c => c.daysUntilExpiration <= 0).map(c => c.item).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}


            {/* SFI Certifications Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCertifications.map((cert) => (
                <div 
                  key={cert.id}
                  className={`bg-slate-800/50 rounded-xl border p-4 ${
                    cert.daysUntilExpiration <= 0 ? 'border-red-500/50' :
                    cert.daysUntilExpiration <= 60 ? 'border-yellow-500/50' :
                    'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{cert.item}</h3>
                      <p className="text-sm text-slate-400">{cert.sfiSpec}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getSFIStatusColor(cert.status)}`}>
                        {cert.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingSFI(cert);
                          setNewSFI(cert);
                          setShowSFIModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSFI(cert.id)}
                        className="p-1 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vendor</span>
                      <span className="text-white">{cert.vendor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Serial #</span>
                      <span className="text-white font-mono text-xs">{cert.serialNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Certified</span>
                      <span className="text-white">{cert.certificationDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expires</span>
                      <span className={cert.daysUntilExpiration <= 0 ? 'text-red-400 font-bold' : 'text-white'}>
                        {cert.expirationDate}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Days Remaining</span>
                      <span className={`font-bold ${
                        cert.daysUntilExpiration <= 0 ? 'text-red-400' :
                        cert.daysUntilExpiration <= 30 ? 'text-orange-400' :
                        cert.daysUntilExpiration <= 60 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {cert.daysUntilExpiration <= 0 ? 'EXPIRED' : cert.daysUntilExpiration}
                      </span>
                    </div>
                  </div>
                  
                  {cert.notes && (
                    <p className="mt-3 text-xs text-slate-400 italic">{cert.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'costReports' && (
          <MaintenanceCostReports />
        )}
      </div>


      {/* ============ COMPLETE MAINTENANCE MODAL ============ */}
      {showCompleteModal && completingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Complete Maintenance
                </h3>
                <p className="text-sm text-slate-400 mt-1">{completingItem.component}</p>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Current status summary */}
            <div className="bg-slate-900/50 rounded-lg p-3 mb-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Category</p>
                <p className="text-white">{completingItem.category}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Current Passes</p>
                <p className="text-white">{completingItem.currentPasses} / {completingItem.nextServicePasses}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Interval</p>
                <p className="text-white">{completingItem.passInterval} passes</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Date Completed */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date Completed *</label>
                <DateInputDark
                  value={completeDateValue}
                  onChange={(e) => setCompleteDateValue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {/* Pass Number */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Pass Number Completed At <span className="text-slate-600">(optional)</span></label>
                <input
                  type="number"
                  value={completePassNumber}
                  onChange={(e) => setCompletePassNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., 47"
                />
              </div>

              {/* Parts Used */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Parts Used <span className="text-slate-600">(optional — auto-deducts from inventory)</span>
                </label>
                
                {/* Searchable parts dropdown */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={partsSearchTerm}
                      onChange={(e) => {
                        setPartsSearchTerm(e.target.value);
                        setShowPartsDropdown(true);
                      }}
                      onFocus={() => setShowPartsDropdown(true)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                      placeholder="Search parts by name, number, or category..."
                    />
                  </div>
                  
                  {showPartsDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredPartsForDropdown.length === 0 ? (
                        <div className="px-4 py-3 text-slate-500 text-sm">No parts found</div>
                      ) : (
                        filteredPartsForDropdown.map(part => {
                          const alreadyAdded = completePartsUsed.some(p => p.partId === part.id);
                          return (
                            <button
                              key={part.id}
                              onClick={() => addPartToCompletion(part)}
                              disabled={alreadyAdded}
                              className={`w-full text-left px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800 last:border-0 flex items-center justify-between ${
                                alreadyAdded ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <div>
                                <p className="text-white text-sm">{part.description}</p>
                                <p className="text-slate-500 text-xs">{part.partNumber} — {part.category}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-medium ${
                                  part.onHand === 0 ? 'text-red-400' :
                                  part.onHand <= part.minQuantity ? 'text-yellow-400' : 'text-green-400'
                                }`}>
                                  {part.onHand} in stock
                                </p>
                                {alreadyAdded && <p className="text-xs text-slate-500">Already added</p>}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Selected parts list */}
                {completePartsUsed.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {completePartsUsed.map(pu => {
                      const part = partsInventory.find(p => p.id === pu.partId);
                      if (!part) return null;
                      return (
                        <div key={pu.partId} className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/50">
                          <Package className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{part.description}</p>
                            <p className="text-slate-500 text-xs">{part.partNumber} — {part.onHand} in stock</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-slate-400 text-xs">Qty:</label>
                            <input
                              type="number"
                              min="1"
                              max={part.onHand}
                              value={pu.quantity}
                              onChange={(e) => updatePartQuantity(pu.partId, parseInt(e.target.value) || 1)}
                              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-center text-sm"
                            />
                          </div>
                          <button
                            onClick={() => removePartFromCompletion(pu.partId)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes <span className="text-slate-600">(optional)</span></label>
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                  placeholder="Any notes about this maintenance completion..."
                />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
              <p className="text-green-400 font-medium mb-1">On confirm, this will:</p>
              <ul className="text-green-300/80 space-y-1 ml-4 list-disc">
                <li>Mark "{completingItem.component}" as completed and reset pass counter</li>
                <li>Set next service due in {completingItem.passInterval} passes</li>
                {completePartsUsed.length > 0 && (
                  <li>Deduct {completePartsUsed.reduce((s, p) => s + p.quantity, 0)} part(s) from inventory</li>
                )}
                <li>Log this completion in maintenance history</li>
              </ul>
            </div>
            
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MAINTENANCE HISTORY MODAL ============ */}
      {showHistoryModal && historyItemId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Maintenance History
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {maintenanceItems.find(m => m.id === historyItemId)?.component || 'Unknown'}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {getItemHistory(historyItemId).map(entry => (
                <div key={entry.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{entry.dateCompleted}</p>
                        {entry.passNumberCompletedAt !== null && (
                          <p className="text-slate-400 text-sm">Pass #{entry.passNumberCompletedAt}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-500 text-xs">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {entry.partsUsed.length > 0 && (
                    <div className="mb-3">
                      <p className="text-slate-400 text-xs font-medium mb-2">Parts Used:</p>
                      <div className="space-y-1">
                        {entry.partsUsed.map((part, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Package className="w-3 h-3 text-orange-400" />
                              <span className="text-white">{part.description}</span>
                              <span className="text-slate-500 text-xs">({part.partNumber})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-300">x{part.quantity}</span>
                              <span className="text-green-400 text-xs">${(part.quantity * part.unitCost).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-right mt-1">
                        <span className="text-slate-400 text-xs">Total parts cost: </span>
                        <span className="text-green-400 text-sm font-medium">
                          ${entry.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {entry.notes && (
                    <p className="text-slate-400 text-sm italic border-t border-slate-700/50 pt-2">{entry.notes}</p>
                  )}
                </div>
              ))}

              {getItemHistory(historyItemId).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No completion history found</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingMaintenance ? 'Edit Maintenance Item' : 'Add Maintenance Item'}
              </h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Car Assignment */}
              <CarDropdown
                value={newMaintenance.car_id || ''}
                onChange={(carId) => setNewMaintenance({...newMaintenance, car_id: carId})}
                label="Assign to Car"
              />


              <div>
                <label className="block text-sm text-slate-400 mb-1">Component Name *</label>
                <input
                  type="text"
                  value={newMaintenance.component}
                  onChange={(e) => setNewMaintenance({...newMaintenance, component: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., U-Joints"
                />
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={newMaintenance.category}

                    onChange={(e) => setNewMaintenance({...newMaintenance, category: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <optgroup label="General">
                      <option value="Drivetrain">Drivetrain</option>
                      <option value="Engine">Engine</option>
                      <option value="Fuel System">Fuel System</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Suspension">Suspension</option>
                      <option value="Brakes">Brakes</option>
                      <option value="Wheels">Wheels</option>
                      <option value="Fluids">Fluids</option>
                      <option value="Safety">Safety</option>
                      <option value="Body">Body</option>
                    </optgroup>
                    <optgroup label="Drivetrain Components">
                      <option value="Transmission">Transmission</option>
                      <option value="Torque Converter">Torque Converter</option>
                      <option value="3rd Member">3rd Member</option>
                      <option value="Ring and Pinion">Ring and Pinion</option>
                      <option value="Transmission Drive">Transmission Drive</option>
                      <option value="Ty-Drive">Ty-Drive</option>
                      <option value="Quick Drive">Quick Drive</option>
                    </optgroup>
                  </select>


                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Priority</label>
                  <select
                    onChange={(e) => setNewMaintenance({...newMaintenance, priority: e.target.value as MaintenanceItem['priority']})}

                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Pass Interval</label>
                  <input
                    type="number"
                    value={newMaintenance.passInterval}
                    onChange={(e) => {
                      const interval = parseInt(e.target.value) || 0;
                      setNewMaintenance({
                        ...newMaintenance, 
                        passInterval: interval,
                        nextServicePasses: interval
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Current Passes</label>
                  <input
                    type="number"
                    value={newMaintenance.currentPasses}
                    onChange={(e) => setNewMaintenance({...newMaintenance, currentPasses: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Last Service Date</label>
                <DateInputDark
                  value={newMaintenance.lastService}
                  onChange={(e) => setNewMaintenance({...newMaintenance, lastService: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newMaintenance.notes}
                  onChange={(e) => setNewMaintenance({...newMaintenance, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMaintenance}
                disabled={!newMaintenance.component}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingMaintenance ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SFI Modal */}
      {showSFIModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingSFI ? 'Edit SFI Certification' : 'Add SFI Certification'}
              </h3>
              <button onClick={() => setShowSFIModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Car Assignment for SFI */}
              <CarDropdown
                value={newSFI.car_id || ''}
                onChange={(carId) => setNewSFI({...newSFI, car_id: carId})}
                label="Assign to Car"
              />


              <div>
                <label className="block text-sm text-slate-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newSFI.item}
                  onChange={(e) => setNewSFI({...newSFI, item: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Seat Belts (5-point)"
                />
              </div>

              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">SFI Spec</label>
                  <input
                    type="text"
                    value={newSFI.sfiSpec}
                    onChange={(e) => setNewSFI({...newSFI, sfiSpec: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., SFI 16.1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                  <select
                    value={newSFI.vendor}
                    onChange={(e) => setNewSFI({...newSFI, vendor: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select vendor</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}{v.category ? ` (${v.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={newSFI.serialNumber}
                  onChange={(e) => setNewSFI({...newSFI, serialNumber: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Certification Date</label>
                  <DateInputDark
                    value={newSFI.certificationDate}
                    onChange={(e) => setNewSFI({...newSFI, certificationDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Expiration Date</label>
                  <DateInputDark
                    value={newSFI.expirationDate}
                    onChange={(e) => setNewSFI({...newSFI, expirationDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newSFI.notes}
                  onChange={(e) => setNewSFI({...newSFI, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSFIModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSFI}
                disabled={!newSFI.item}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSFI ? 'Save Changes' : 'Add Certification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MaintenanceTracker;
