import React, { useState, useMemo, useEffect } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';



import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import { MaintenanceItem, SFICertification, calculateMaintenanceStatus } from '@/data/proModData';
import { loadSFIAlertSettings, getEffectiveThresholdsForCert } from '@/lib/sfiAlerts';
import MaintenanceTemplates from './MaintenanceTemplates';

import CompleteMaintenanceModal, {
  MaintenanceHistoryEntry,
  loadMaintenanceHistory
} from './CompleteMaintenanceModal';


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
  Package,
  History,
  BookOpen,
  Download
} from 'lucide-react';






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
    vendors: allVendors,
  } = useApp();




  
  const [activeTab, setActiveTab] = useState<'maintenance' | 'sfi' | 'templates'>('maintenance');




  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Modals
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showSFIModal, setShowSFIModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
  const [editingSFI, setEditingSFI] = useState<SFICertification | null>(null);

  // Complete Maintenance Modal (uses separate CompleteMaintenanceModal component)
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<MaintenanceItem | null>(null);

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


  // ============ DYNAMIC STATUS COMPUTATION ============
  // Always recompute status from current pass counts so the summary cards,
  // table badges, and sort order are never stale — even if the stored status
  // field wasn't updated (e.g. after a background pass increment).
  const computedMaintenance: MaintenanceItem[] = useMemo(() => {
    return maintenanceItems.map(item => ({
      ...item,
      status: calculateMaintenanceStatus(item),
    }));
  }, [maintenanceItems]);

  // Filter by category (car filter removed — single-car app)
  const filteredMaintenance = computedMaintenance.filter(item => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesCategory;
  });


  const sortedMaintenance = [...filteredMaintenance].sort((a, b) => {
    const remainingA = a.nextServicePasses - a.currentPasses;
    const remainingB = b.nextServicePasses - b.currentPasses;
    return remainingA - remainingB;
  });



  // SFI certifications (no car filter — single-car app)
  const filteredSfiCertifications = sfiCertifications;


  const sortedCertifications = [...filteredSfiCertifications].sort((a, b) => 
    a.daysUntilExpiration - b.daysUntilExpiration
  );

  // Global SFI alert thresholds (enabled only), used to display the effective
  // alert threshold on every certification card — including those that fall
  // back to the global thresholds (no per-cert custom override).
  const globalEnabledThresholds = useMemo(() => {
    const settings = loadSFIAlertSettings();
    return settings.thresholds.filter(t => t.enabled).sort((a, b) => a.days - b.days);
  }, []);



  // Default new maintenance item
  const defaultMaintenance: MaintenanceItem = {
    id: '',
    component: '',
    category: 'Drivetrain',
    passInterval: 50,
    currentPasses: 0,
    lastService: getLocalDateString(),
    lastServiceTime: '',
    nextServicePasses: 50,
    status: 'Good',
    priority: 'Medium',
    notes: '',
    threshold: 5,
  };



  // Default new SFI certification
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
    threshold: 30, // days before expiration — sensible default, required
  };




  const [newMaintenance, setNewMaintenance] = useState<MaintenanceItem>(defaultMaintenance);
  const [newSFI, setNewSFI] = useState<SFICertification>(defaultSFI);

  // Inline validation error for the required Threshold field. Alerts depend
  // entirely on a configured threshold, so saving without one is blocked.
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  // Inline validation error for the required SFI alert threshold (days before
  // expiration). Mirrors the maintenance threshold — alerts depend on it.
  const [sfiThresholdError, setSfiThresholdError] = useState<string | null>(null);


  // Active vendors derived from centralized AppContext (no more independent fetching)
  const vendorsList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);

  // ============ OPEN COMPLETE MAINTENANCE MODAL ============
  const openCompleteModal = (item: MaintenanceItem) => {
    setCompletingItem(item);
    setShowCompleteModal(true);
  };




  // ============ EXISTING HANDLERS ============




  const handleSaveMaintenance = async () => {
    // ===== REQUIRED THRESHOLD VALIDATION =====
    // Alerts depend entirely on a configured threshold, so an item cannot be
    // saved without a valid one. Block the save and surface an inline error.
    const thr = newMaintenance.threshold;
    if (thr === undefined || thr === null || !Number.isFinite(thr) || thr < 1) {
      setThresholdError('Threshold is required and must be at least 1 pass.');
      return;
    }
    setThresholdError(null);

    try {
      // Use the canonical calculateMaintenanceStatus function for consistency
      const computedStatus = calculateMaintenanceStatus(newMaintenance);

      const itemToSave: MaintenanceItem = {
        ...newMaintenance,
        status: computedStatus
      };

      if (editingMaintenance) {
        await updateMaintenanceItem(editingMaintenance.id, itemToSave);
      } else {
        // Use crypto.randomUUID for globally unique IDs — avoids collisions
        // from length-based sequential IDs (MT-001, MT-002, …) which can
        // collide after deletes, imports, or multi-device usage.
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? `MT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
          : `MT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await addMaintenanceItem({ ...itemToSave, id });
      }
    } catch (error) {
      console.error('Error saving maintenance item:', error);
    } finally {
      setShowMaintenanceModal(false);
      setEditingMaintenance(null);
      setNewMaintenance(defaultMaintenance);
      setThresholdError(null);
    }
  };






  const handleDeleteMaintenance = async (id: string) => {
    await deleteMaintenanceItem(id);
  };



  // Compute status + days remaining for a cert, honoring its single alert
  // `threshold` (days before expiration) — mirrors the maintenance threshold.
  const calculateSFIStatus = (
    expirationDate: string,
    threshold?: number
  ): { status: SFICertification['status'], daysUntilExpiration: number } => {
    const expDate = parseLocalDate(expirationDate);

    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Days-before-expiration at which this cert begins alerting. Falls back to
    // 60 only when no threshold has been configured (legacy data).
    const alertDays = threshold != null && threshold >= 0 ? threshold : 60;

    let status: SFICertification['status'] = 'Valid';
    if (diffDays <= 0) status = 'Expired';
    else if (diffDays <= alertDays) status = 'Expiring Soon';

    return { status, daysUntilExpiration: diffDays };
  };

  const handleSaveSFI = async () => {
    // ===== REQUIRED THRESHOLD VALIDATION =====
    // Alerts depend entirely on a configured threshold (days before expiration),
    // so a cert cannot be saved without a valid one. Block + surface inline error.
    const thr = newSFI.threshold;
    if (thr === undefined || thr === null || !Number.isFinite(thr) || thr < 1) {
      setSfiThresholdError('Threshold is required and must be at least 1 day.');
      return;
    }
    setSfiThresholdError(null);

    try {
      const { status, daysUntilExpiration } = calculateSFIStatus(newSFI.expirationDate, thr);
      const sfiToSave: SFICertification = {
        ...newSFI,
        status,
        daysUntilExpiration,
        threshold: thr,
        // Single threshold supersedes the legacy multi-value list.
        alertThresholdDays: undefined,
      };

      if (editingSFI) {
        await updateSFICertification(editingSFI.id, sfiToSave);
      } else {
        // Use crypto.randomUUID for globally unique IDs — avoids collisions
        // from length-based sequential IDs (SFI-001, SFI-002, …) which can
        // collide after deletes, imports, or multi-device usage.
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? `SFI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
          : `SFI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await addSFICertification({ ...sfiToSave, id });
      }

    } catch (error) {
      console.error('Error saving SFI certification:', error);
    } finally {
      setShowSFIModal(false);
      setEditingSFI(null);
      setNewSFI(defaultSFI);
      setSfiThresholdError(null);
    }
  };


  const handleDeleteSFI = async (id: string) => {
    if (confirm('Are you sure you want to delete this SFI certification?')) {
      await deleteSFICertification(id);
    }
  };

  // ============ EXPORT SFI CERTIFICATIONS TO CSV ============
  // Builds a tech-inspection-ready CSV of every certification, including the
  // effective alert thresholds (custom per-cert overrides or global fallback).
  const handleExportSFICSV = () => {
    if (sortedCertifications.length === 0) {
      alert('There are no SFI certifications to export.');
      return;
    }

    const escapeCsv = (val: unknown): string => {
      const s = val === null || val === undefined ? '' : String(val);
      // Quote fields containing comma, quote, or newline; escape inner quotes.
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const formatThresholds = (cert: SFICertification): string => {
      const effective = getEffectiveThresholdsForCert(cert, globalEnabledThresholds);
      if (effective.length === 0) return 'None';
      return effective
        .map(t => `${t.days <= 0 ? 'Expired' : `${t.days}d`} (${t.severity})`)
        .join('; ');
    };

    const headers = [
      'Item',
      'SFI Spec',
      'Vendor',
      'Serial Number',
      'Certification Date',
      'Expiration Date',
      'Days Remaining',
      'Status',
      'Alert Threshold Source',
      'Effective Alert Thresholds',
      'Notes',
    ];

    const rows = sortedCertifications.map(cert => {
      const isCustom = !!(cert.alertThresholdDays && cert.alertThresholdDays.length > 0);
      return [
        cert.item,
        cert.sfiSpec,
        cert.vendor,
        cert.serialNumber,
        cert.certificationDate,
        cert.expirationDate,
        cert.daysUntilExpiration <= 0 ? 'EXPIRED' : cert.daysUntilExpiration,
        cert.status,
        isCustom ? 'Custom' : 'Global',
        formatThresholds(cert),
        cert.notes || '',
      ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');

    // Prepend UTF-8 BOM so Excel correctly renders special characters.
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sfi-certifications-${getLocalDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'templates' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Templates
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
                  setThresholdError(null);
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
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Threshold</th>
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
                              {/* Color the Remaining count based on the item's THRESHOLD-AWARE
                                  status (computed via calculateMaintenanceStatus). A yellow
                                  "Due Soon" number must never appear until the configured
                                  threshold is reached — when an item is still "Good", the
                                  number stays white regardless of how few passes remain. */}
                              <span className={
                                item.status === 'Overdue' || item.status === 'Due' ? 'text-red-400'
                                : item.status === 'Due Soon' ? 'text-yellow-400'
                                : 'text-white'
                              }>
                                {remaining}
                              </span>
                            </td>

                            {/* Threshold column — shows the item's configured alert
                                threshold (passes remaining at which it starts alerting)
                                plus a small inline indicator so users can quickly confirm
                                why an item is or isn't generating an alert. Renders a dash
                                when no threshold is set. */}
                            <td className="px-4 py-3 text-center">
                              {item.threshold != null && Number.isFinite(item.threshold) ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-xs font-medium border border-cyan-500/30">
                                    {item.threshold} pass{item.threshold === 1 ? '' : 'es'}
                                  </span>
                                  <span
                                    className={`text-[10px] ${
                                      remaining <= item.threshold ? 'text-yellow-400' : 'text-slate-500'
                                    }`}
                                  >
                                    {remaining <= item.threshold
                                      ? 'alert active'
                                      : `${item.threshold} passes left to alert`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600" title="No alert threshold set">—</span>
                              )}
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
                                    // Ensure a sensible default threshold for legacy items that
                                    // were saved before the threshold field was required.
                                    setNewMaintenance({ ...item, threshold: item.threshold ?? 5 });
                                    setThresholdError(null);
                                    setShowMaintenanceModal(true);
                                  }}
                                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
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
                              <td colSpan={8} className="px-4 py-4">

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
            {/* Export CSV + Add SFI Buttons */}
            <div className="flex flex-wrap justify-end gap-3 mb-6">
              <button
                onClick={handleExportSFICSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={sortedCertifications.length === 0}
                title="Export all certifications to a CSV file for tech-inspection records"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => {
                  setEditingSFI(null);
                  setNewSFI(defaultSFI);
                  setSfiThresholdError(null);
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
                          // Backfill a sensible threshold for legacy certs saved
                          // before the single threshold field was required.
                          setNewSFI({ ...cert, threshold: cert.threshold ?? 30 });
                          setSfiThresholdError(null);
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

                    {/* Alert Threshold — single days-before-expiration value */}
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
                        Alert Threshold
                      </span>
                      {cert.threshold != null ? (
                        <span className="text-cyan-300 font-medium">
                          {cert.threshold} day{cert.threshold === 1 ? '' : 's'} before
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">Not set</span>
                      )}
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




        {activeTab === 'templates' && (
          <MaintenanceTemplates onApplyTemplate={() => setActiveTab('maintenance')} />
        )}


      </div>




      {/* ============ COMPLETE MAINTENANCE MODAL (separate component) ============ */}
      {showCompleteModal && completingItem && (
        <CompleteMaintenanceModal
          item={completingItem}
          onClose={() => {
            setShowCompleteModal(false);
            setCompletingItem(null);
          }}
          onCompleted={() => {
            // Refresh history from localStorage after completion
            setMaintenanceHistory(loadMaintenanceHistory());
          }}
          onNavigate={onNavigate}
        />
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
              <button onClick={() => { setShowMaintenanceModal(false); setThresholdError(null); }} className="text-slate-400 hover:text-white">

                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">

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
                      <option value="Wheels and Tires">Wheels and Tires</option>

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
                  <label className="block text-sm text-slate-400 mb-1">Threshold (passes before alert) *</label>
                  <input
                    type="number"
                    min={1}
                    value={newMaintenance.threshold ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Empty input -> undefined so validation can flag it as missing.
                      const parsed = raw === '' ? undefined : parseInt(raw, 10);
                      setNewMaintenance({
                        ...newMaintenance,
                        threshold: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
                      });
                      // Live-clear the error once a valid value is entered.
                      if (parsed !== undefined && Number.isFinite(parsed) && parsed >= 1) {
                        setThresholdError(null);
                      }
                    }}
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white ${
                      thresholdError ? 'border-red-500' : 'border-slate-600'
                    }`}
                    placeholder="e.g., 5"
                  />
                  {/* Inline required-field error */}
                  {thresholdError && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {thresholdError}
                    </p>
                  )}
                  {/* Live helper: explains exactly when this item will switch to "Due Soon" */}
                  {!thresholdError && (() => {
                    const interval = newMaintenance.passInterval || 0;
                    const remaining = interval - (newMaintenance.currentPasses || 0);
                    const threshold = newMaintenance.threshold ?? 0;
                    // Use the canonical status function so the helper matches actual behavior.
                    const liveStatus = calculateMaintenanceStatus(newMaintenance);
                    const statusColor =
                      liveStatus === 'Overdue' ? 'text-red-400' :
                      liveStatus === 'Due' ? 'text-orange-400' :
                      liveStatus === 'Due Soon' ? 'text-yellow-400' :
                      'text-green-400';
                    return (
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        Alerts when{' '}
                        <span className="text-cyan-300 font-medium">{threshold} pass{threshold === 1 ? '' : 'es'}</span>{' '}
                        remain — currently{' '}
                        <span className={`font-medium ${remaining <= 0 ? 'text-red-400' : 'text-white'}`}>
                          {remaining} remaining
                        </span>
                        {', '}
                        <span className={`font-semibold ${statusColor}`}>{liveStatus}</span>
                      </p>
                    );
                  })()}
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Last Service Date</label>
                  <DateInputDark
                    value={newMaintenance.lastService}
                    onChange={(e) => setNewMaintenance({...newMaintenance, lastService: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Last Service Time</label>
                  <input
                    type="time"
                    value={newMaintenance.lastServiceTime || ''}
                    onChange={(e) => setNewMaintenance({...newMaintenance, lastServiceTime: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
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
                onClick={() => { setShowMaintenanceModal(false); setThresholdError(null); }}
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
              <button onClick={() => { setShowSFIModal(false); setSfiThresholdError(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">


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

              {/* Alert Threshold — single required days-before-expiration value
                  (mirrors the maintenance Threshold field). */}
              <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-lg p-4">
                <label className="text-sm font-medium text-cyan-300 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-cyan-400" />
                  Threshold (days before alert) *
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Required. The number of days before the expiration date at which this
                  certification begins alerting (becomes "Expiring Soon" and fires bell/toast
                  reminders). Alerts depend entirely on this value.
                </p>
                <input
                  type="number"
                  min={1}
                  value={newSFI.threshold ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Empty input -> undefined so validation can flag it as missing.
                    const parsed = raw === '' ? undefined : parseInt(raw, 10);
                    setNewSFI({
                      ...newSFI,
                      threshold: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
                    });
                    // Live-clear the error once a valid value is entered.
                    if (parsed !== undefined && Number.isFinite(parsed) && parsed >= 1) {
                      setSfiThresholdError(null);
                    }
                  }}
                  placeholder="e.g., 30"
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white ${
                    sfiThresholdError ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {/* Inline required-field error */}
                {sfiThresholdError ? (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {sfiThresholdError}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] text-slate-500">Quick set:</span>
                    {[90, 60, 30, 14].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => { setNewSFI({ ...newSFI, threshold: days }); setSfiThresholdError(null); }}
                        className={`px-2 py-1 text-[11px] rounded transition-colors ${
                          newSFI.threshold === days
                            ? 'bg-cyan-500/40 text-cyan-200'
                            : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowSFIModal(false); setSfiThresholdError(null); }}
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
