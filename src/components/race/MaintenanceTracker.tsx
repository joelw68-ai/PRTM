import React, { useState, useMemo } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import CarDropdown from '@/components/race/CarDropdown';
import { useCar } from '@/contexts/CarContext';

import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import { MaintenanceItem, SFICertification } from '@/data/proModData';


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
  ChevronUp
} from 'lucide-react';

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
    vendors: allVendors
  } = useApp();


  const { selectedCarId, getCarLabel } = useCar();
  
  const [activeTab, setActiveTab] = useState<'maintenance' | 'sfi'>('maintenance');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Modals
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showSFIModal, setShowSFIModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
  const [editingSFI, setEditingSFI] = useState<SFICertification | null>(null);

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
  // When "All Cars" selected (selectedCarId is null/empty): show ALL records
  // When specific car selected: show matching car_id + records with no car_id (legacy data)
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




  const handleServiceComplete = (itemId: string) => {
    const item = maintenanceItems.find(m => m.id === itemId);
    if (item) {
      updateMaintenanceItem(itemId, {
        lastService: getLocalDateString(),
        currentPasses: 0,
        nextServicePasses: item.passInterval,
        status: 'Good'
      });
    }
  };

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
    const expDate = new Date(expirationDate);
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
                                  onClick={(e) => { e.stopPropagation(); handleServiceComplete(item.id); }}
                                  className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                  title="Mark as serviced"
                                >
                                  <CheckCircle className="w-4 h-4" />
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
      </div>

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
