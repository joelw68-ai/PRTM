import React, { useState, useMemo, useEffect } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';



import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import { MaintenanceItem, ServiceLogEntry, calculateMaintenanceStatus } from '@/data/proModData';
import MaintenanceTemplates from './MaintenanceTemplates';
import ServiceLogGrid, { createServiceLogRow } from './ServiceLogGrid';
import {
  DEFAULT_GENERAL_CATEGORIES,
  DEFAULT_DRIVETRAIN_CATEGORIES,
  loadCustomCategories,
  addCustomCategory,
  removeCustomCategory,
  renameCustomCategory,
  setCustomCategoryColor,
  reorderCustomCategories,
  categoryExists,
  getCategoryColor,
  CustomCategory,
  CATEGORY_COLOR_PALETTE,
  DEFAULT_CATEGORY_COLOR,
  // Editable built-in (default) category overrides
  DefaultOverride,
  loadDefaultOverrides,
  getEffectiveDefaults,
  buildColorResolutionList,
  renameDefaultCategory,
  removeDefaultCategory,
  restoreDefaultCategory,
  setDefaultCategoryColor,
  reorderDefaultCategories,
  countItemsUsingCategory,
} from '@/data/maintenanceCategories';
import CategoryBreakdownCard from './CategoryBreakdownCard';




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
  Download,
  GripVertical

} from 'lucide-react';






// ============ COMPONENT ============

interface MaintenanceTrackerProps {
  onNavigate?: (section: string) => void;
  currentRole?: CrewRole;
}

const MaintenanceTracker: React.FC<MaintenanceTrackerProps> = ({ onNavigate, currentRole = 'Crew' }) => {

  const { 
    maintenanceItems, 
    updateMaintenanceItem, 
    addMaintenanceItem,
    deleteMaintenanceItem,
    vendors: allVendors,
  } = useApp();




  
  const [activeTab, setActiveTab] = useState<'maintenance' | 'templates'>('maintenance');




  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Modals
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceItem | null>(null);
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

  // NOTE: the category filter list (`categories`) is built lower down, after
  // the `customCategories` state is declared, to avoid a temporal-dead-zone
  // reference. See "USER-EDITABLE CATEGORIES" below.



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


  const [newMaintenance, setNewMaintenance] = useState<MaintenanceItem>(defaultMaintenance);


  // Inline validation error for the required Threshold field. Alerts depend
  // entirely on a configured threshold, so saving without one is blocked.
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  // ============ USER-EDITABLE CATEGORIES ============
  // Custom categories are user-created and persisted PER USER to the Supabase
  // `maintenance_categories` table (with a color), syncing across devices.
  // localStorage acts only as an offline cache. Each category carries a color
  // used for the dot/badge in the table and filter chips.
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  // Rename editing state for the inline manager.
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // ============ EDITABLE BUILT-IN (DEFAULT) CATEGORIES ============
  // The shipped General + Drivetrain categories can now be renamed, recolored,
  // and deleted (hidden) per user. Edits are stored as a small "override" object
  // (renames / colors / hidden / order) in the maintenance_category_overrides
  // table, with a localStorage cache fallback. We keep the ORIGINAL shipped name
  // as the stable key and migrate items on rename.
  const [defaultOverrides, setDefaultOverrides] = useState<DefaultOverride>({
    renames: {}, colors: {}, hidden: [], order: [],
  });
  // Rename state for built-in categories (keyed by ORIGINAL name).
  const [renamingDefault, setRenamingDefault] = useState<string | null>(null);
  const [renameDefaultValue, setRenameDefaultValue] = useState('');
  const [renameDefaultError, setRenameDefaultError] = useState<string | null>(null);

  // ===== DELETE-CATEGORY CONFIRMATION =====
  // Deleting (hiding) a category — built-in or custom — first asks the user to
  // confirm, surfacing how many maintenance items currently use it so the
  // impact is clear before anything changes.
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<
    { display: string; key: string; kind: 'custom' | 'default'; count: number } | null
  >(null);
  // When the deleted category still has items, the user can optionally pick a
  // target category here to reassign those items to (instead of leaving them on
  // the removed value). Empty string = "keep their saved value".
  const [reassignTo, setReassignTo] = useState<string>('');

  // ===== BULK THRESHOLD EDITING =====
  // Users can select multiple rows via checkboxes and apply a single alert
  // threshold to all of them at once (instead of editing each item).
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkThreshold, setBulkThreshold] = useState<string>('');
  const [bulkApplying, setBulkApplying] = useState(false);

  // ===== DRAG-TO-REORDER built-in (default) categories =====
  // Mirrors the custom-category reordering. We track the index within the
  // combined [general, drivetrain] effective list and persist the new order of
  // ORIGINAL names to the overrides 'order' field.
  const [defaultDragIndex, setDefaultDragIndex] = useState<number | null>(null);
  const [defaultDragOverIndex, setDefaultDragOverIndex] = useState<number | null>(null);


  useEffect(() => {
    let mounted = true;
    loadDefaultOverrides().then((o) => {
      if (mounted) setDefaultOverrides(o);
    });
    return () => { mounted = false; };
  }, []);

  // Effective (post-override) built-in category lists used by the dropdown.
  const effectiveDefaults = useMemo(
    () => getEffectiveDefaults(defaultOverrides),
    [defaultOverrides]
  );

  // Combined color-resolution list (effective defaults + customs) so the dots /
  // badges across the table & filter chips reflect built-in edits too.
  const colorResolutionList = useMemo(
    () => buildColorResolutionList(customCategories, defaultOverrides),
    [customCategories, defaultOverrides]
  );

  // Rename a built-in category. `orig` = original shipped name. Persists the
  // override AND migrates every maintenance item from the current display name
  // to the new name so data stays consistent.
  const handleRenameDefault = async (orig: string) => {
    const newName = renameDefaultValue.trim();
    if (!newName) {
      setRenameDefaultError('Enter a new name.');
      return;
    }
    const currentDisplay = defaultOverrides.renames[orig]?.trim() || orig;
    const next = await renameDefaultCategory(orig, newName, defaultOverrides, customCategories);
    // If nothing changed (collision blocked), surface an error.
    if ((next.renames[orig]?.trim() || orig) === currentDisplay && newName.toLowerCase() !== currentDisplay.toLowerCase()) {
      setRenameDefaultError('That name collides with another category.');
      return;
    }
    setDefaultOverrides(next);

    // Migrate items currently saved under the old display name.
    if (newName !== currentDisplay) {
      const affected = maintenanceItems.filter((m) => m.category === currentDisplay);
      await Promise.all(affected.map((m) => updateMaintenanceItem(m.id, { category: newName })));
      setNewMaintenance((prev) => prev.category === currentDisplay ? { ...prev, category: newName } : prev);
      setFilterCategory((prev) => (prev === currentDisplay ? newName : prev));
    }

    setRenamingDefault(null);
    setRenameDefaultValue('');
    setRenameDefaultError(null);
  };

  // Delete (hide) a built-in category from the pickers. Items already saved
  // with it keep their stored value.
  const handleRemoveDefault = async (orig: string) => {
    const next = await removeDefaultCategory(orig, defaultOverrides);
    setDefaultOverrides(next);
    if (renamingDefault === orig) setRenamingDefault(null);
  };

  // Restore a previously hidden built-in category.
  const handleRestoreDefault = async (orig: string) => {
    const next = await restoreDefaultCategory(orig, defaultOverrides);
    setDefaultOverrides(next);
  };

  // Recolor a built-in category.
  const handleChangeDefaultColor = async (orig: string, color: string) => {
    const next = await setDefaultCategoryColor(orig, color, defaultOverrides);
    setDefaultOverrides(next);
  };


  // Load custom categories from the DB (falls back to local cache) on mount.
  useEffect(() => {
    let mounted = true;
    loadCustomCategories().then((cats) => {
      if (mounted) setCustomCategories(cats);
    });
    return () => { mounted = false; };
  }, []);

  // Names only — used for the dropdown <optgroup> and to test membership.
  const customCategoryNames = useMemo(
    () => customCategories.map((c) => c.name),
    [customCategories]
  );

  // Build the category filter list (declared here, after state, to avoid a TDZ
  // reference): categories actually used by items + built-in drivetrain types +
  // any user-created custom categories so they're selectable before first use.
  const baseCats = [...new Set(maintenanceItems.map((m) => m.category))];
  const drivetrainCats = [
    'Drivetrain - Transmission',
    'Drivetrain - Torque Converter',
    'Drivetrain - 3rd Member',
    'Drivetrain - Ring & Pinion',
    'Drivetrain - Trans Drive',
  ];
  const categories = [...new Set([...baseCats, ...drivetrainCats, ...customCategoryNames])];

  // Create a new custom category (with color), then select it on the item.
  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError('Enter a category name.');
      return;
    }
    if (categoryExists(name, customCategories)) {
      setCategoryError('That category already exists.');
      return;
    }
    const next = await addCustomCategory(name, newCategoryColor, customCategories);
    setCustomCategories(next);
    setNewMaintenance((prev) => ({ ...prev, category: name }));
    setNewCategoryName('');
    setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
    setCategoryError(null);
  };

  // Delete a custom category. Items still using it keep their stored value.
  const handleRemoveCategory = async (name: string) => {
    const next = await removeCustomCategory(name, customCategories);
    setCustomCategories(next);
    if (renamingCategory === name) setRenamingCategory(null);
  };

  // Change a custom category's color (persisted to DB).
  const handleChangeCategoryColor = async (name: string, color: string) => {
    const next = await setCustomCategoryColor(name, color, customCategories);
    setCustomCategories(next);
  };

  // Rename a custom category AND migrate every maintenance item currently using
  // the old name so the data stays consistent across the app.
  const handleRenameCategory = async (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName) {
      setRenameError('Enter a new name.');
      return;
    }
    if (
      newName.toLowerCase() !== oldName.toLowerCase() &&
      categoryExists(newName, customCategories)
    ) {
      setRenameError('That category already exists.');
      return;
    }
    // 1) Persist the rename in the category store / DB.
    const next = await renameCustomCategory(oldName, newName, customCategories);
    setCustomCategories(next);

    // 2) Migrate every maintenance item referencing the old category name.
    const affected = maintenanceItems.filter((m) => m.category === oldName);
    await Promise.all(
      affected.map((m) => updateMaintenanceItem(m.id, { category: newName }))
    );

    // 3) Keep the in-progress edit form & active filter in sync.
    setNewMaintenance((prev) =>
      prev.category === oldName ? { ...prev, category: newName } : prev
    );
    setFilterCategory((prev) => (prev === oldName ? newName : prev));

    setRenamingCategory(null);
    setRenameValue('');
    setRenameError(null);
  };

  // ===== DRAG-TO-REORDER custom categories =====
  // Users can drag rows in the inline manager to set their preferred order;
  // the new order is persisted to the maintenance_categories.sort_order column
  // so the dropdown and filter chips follow it across devices.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  };

  const handleDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...customCategories];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setCustomCategories(reordered); // optimistic
    setDragIndex(null);
    setDragOverIndex(null);
    const next = await reorderCustomCategories(reordered);
    setCustomCategories(next);
  };





  // Active vendors derived from centralized AppContext (no more independent fetching)
  const vendorsList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);

  // ============ OPEN COMPLETE MAINTENANCE MODAL ============
  const openCompleteModal = (item: MaintenanceItem) => {
    setCompletingItem(item);
    setShowCompleteModal(true);
  };


  // ============ SERVICE LOG HELPERS ============
  // The service log is a spreadsheet-style list of service records (date, time,
  // notes). When opening an item for add/edit, seed the grid: use the saved
  // serviceLog if present, otherwise migrate the legacy single lastService /
  // lastServiceTime / notes fields into a single first row so existing data
  // isn't lost. Always guarantee at least one editable row.
  const seedServiceLog = (item: MaintenanceItem): ServiceLogEntry[] => {
    if (Array.isArray(item.serviceLog) && item.serviceLog.length > 0) {
      return item.serviceLog.map((r) => ({
        id: r.id || createServiceLogRow().id,
        date: r.date || '',
        time: r.time || '',
        notes: r.notes || '',
      }));
    }
    if (item.lastService || item.lastServiceTime || item.notes) {
      return [
        createServiceLogRow({
          date: item.lastService || '',
          time: item.lastServiceTime || '',
          notes: item.notes || '',
        }),
      ];
    }
    return [createServiceLogRow({ date: getLocalDateString() })];
  };

  // Derive the canonical "last service" snapshot (lastService / lastServiceTime /
  // notes) from the spreadsheet rows. The most recent dated row wins; rows with
  // no date are treated as oldest. This keeps the status badges, expanded-row
  // display, and any code that still reads the single fields in sync with the
  // spreadsheet — without keeping three separate modals.
  const deriveLastServiceFields = (rows: ServiceLogEntry[]) => {
    const filled = rows.filter((r) => r.date || r.time || (r.notes && r.notes.trim()));
    if (filled.length === 0) {
      return { lastService: '', lastServiceTime: '', notes: '' };
    }
    const sorted = [...filled].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const latest = sorted[sorted.length - 1];
    // Notes: combine all non-empty notes (newest first) so nothing is lost.
    const combinedNotes = [...sorted]
      .reverse()
      .map((r) => (r.notes || '').trim())
      .filter(Boolean)
      .join(' | ');
    return {
      lastService: latest.date || '',
      lastServiceTime: latest.time || '',
      notes: combinedNotes,
    };
  };






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
      // Sync the legacy single fields (lastService / lastServiceTime / notes)
      // from the spreadsheet rows so status badges and other readers stay correct.
      const derived = deriveLastServiceFields(newMaintenance.serviceLog || []);

      // Use the canonical calculateMaintenanceStatus function for consistency
      const computedStatus = calculateMaintenanceStatus(newMaintenance);

      const itemToSave: MaintenanceItem = {
        ...newMaintenance,
        ...derived,
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





  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Overdue': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Due': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'Due Soon': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Good': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };



  // Get history for a specific maintenance item
  const getItemHistory = (itemId: string) => {
    return maintenanceHistory.filter(h => h.maintenanceItemId === itemId);
  };

  // ===== DELETE-CATEGORY CONFIRMATION HELPERS =====
  // Open the confirmation panel for a CUSTOM category, computing how many items
  // currently use it.
  const requestDeleteCustom = (name: string) => {
    setReassignTo('');
    setPendingDeleteCategory({
      display: name,
      key: name,
      kind: 'custom',
      count: countItemsUsingCategory(name, maintenanceItems),
    });
  };
  // Open the confirmation panel for a BUILT-IN category. `orig` is the original
  // shipped key; `display` is the current (possibly renamed) display name used
  // by items.
  const requestDeleteDefault = (orig: string, display: string) => {
    setReassignTo('');
    setPendingDeleteCategory({
      display,
      key: orig,
      kind: 'default',
      count: countItemsUsingCategory(display, maintenanceItems),
    });
  };

  // NOTE: `reassignOptions` (which depends on `combinedDefaults`) is declared
  // further down, AFTER `combinedDefaults`, to avoid a temporal-dead-zone ref.


  // Execute the confirmed deletion. If the user chose a reassignment target,
  // first migrate every item currently using the deleted category to that
  // target; otherwise items keep their saved value.
  const confirmDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    const { display, key, kind } = pendingDeleteCategory;

    // Reassign affected items to the chosen target category first.
    if (reassignTo && reassignTo !== display) {
      const affected = maintenanceItems.filter((m) => m.category === display);
      await Promise.all(
        affected.map((m) => updateMaintenanceItem(m.id, { category: reassignTo }))
      );
      // Keep the in-progress edit form & active filter in sync.
      setNewMaintenance((prev) =>
        prev.category === display ? { ...prev, category: reassignTo } : prev
      );
      setFilterCategory((prev) => (prev === display ? reassignTo : prev));
    }

    if (kind === 'custom') {
      await handleRemoveCategory(key);
    } else {
      await handleRemoveDefault(key);
    }
    setReassignTo('');
    setPendingDeleteCategory(null);
  };

  // ===== BULK THRESHOLD HELPERS =====
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allVisibleSelected =
    sortedMaintenance.length > 0 && sortedMaintenance.every((m) => selectedItemIds.has(m.id));
  const toggleSelectAll = () => {
    setSelectedItemIds((prev) => {
      if (sortedMaintenance.every((m) => prev.has(m.id))) {
        // Deselect all currently-visible rows.
        const next = new Set(prev);
        sortedMaintenance.forEach((m) => next.delete(m.id));
        return next;
      }
      const next = new Set(prev);
      sortedMaintenance.forEach((m) => next.add(m.id));
      return next;
    });
  };
  const clearSelection = () => {
    setSelectedItemIds(new Set());
    setBulkThreshold('');
  };
  const applyBulkThreshold = async () => {
    const parsed = parseInt(bulkThreshold, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    if (selectedItemIds.size === 0) return;
    setBulkApplying(true);
    try {
      const ids = Array.from(selectedItemIds);
      await Promise.all(ids.map((id) => updateMaintenanceItem(id, { threshold: parsed })));
      clearSelection();
    } catch (err) {
      console.error('Failed to bulk-apply threshold:', err);
    } finally {
      setBulkApplying(false);
    }
  };

  // ===== DRAG-TO-REORDER built-in categories =====
  // The combined list order (general first, then drivetrain) maps each visible
  // built-in to its ORIGINAL name; we reorder within that combined list and
  // persist the full ordered list of originals.
  const combinedDefaults = useMemo(
    () => [...effectiveDefaults.general, ...effectiveDefaults.drivetrain],
    [effectiveDefaults]
  );

  // Candidate target categories for reassigning items off a category being
  // deleted — all currently-visible built-ins + customs, minus the one being
  // removed. Built-in order first (user's preferred order), then customs.
  const reassignOptions = useMemo(() => {
    if (!pendingDeleteCategory) return [] as string[];
    const all = [
      ...combinedDefaults.map((c) => c.name),
      ...customCategories.map((c) => c.name),
    ];
    return [...new Set(all)].filter((n) => n !== pendingDeleteCategory.display);
  }, [pendingDeleteCategory, combinedDefaults, customCategories]);
  const handleDefaultDragStart = (index: number) => setDefaultDragIndex(index);
  const handleDefaultDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (index !== defaultDragOverIndex) setDefaultDragOverIndex(index);
  };
  const handleDefaultDrop = async (dropIndex: number) => {
    if (defaultDragIndex === null || defaultDragIndex === dropIndex) {
      setDefaultDragIndex(null);
      setDefaultDragOverIndex(null);
      return;
    }
    // Build the current ordered list of ORIGINAL names from the combined list.
    const originals = combinedDefaults.map(
      (c) => effectiveDefaults.originalByDisplay[c.name] || c.name
    );
    const [moved] = originals.splice(defaultDragIndex, 1);
    originals.splice(dropIndex, 0, moved);
    setDefaultDragIndex(null);
    setDefaultDragOverIndex(null);
    const next = await reorderDefaultCategories(originals, defaultOverrides);
    setDefaultOverrides(next);
  };


  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Maintenance</h2>
            <p className="text-slate-400">Pass-count driven maintenance schedules</p>
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      filterCategory === cat 
                        ? 'bg-orange-500/20 text-orange-400' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {/* Color dot for faster visual scanning */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoryColor(cat, colorResolutionList) }}
                    />
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

            {/* Category Breakdown analytics — grouped by category with status
                counts and category-colored bars for quick visual insight. */}
            <CategoryBreakdownCard
              items={filteredMaintenance}
              customCategories={customCategories}
            />



            {/* ===== BULK THRESHOLD ACTION BAR ===== */}
            {selectedItemIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <span className="text-sm font-medium text-cyan-200">
                  {selectedItemIds.size} item{selectedItemIds.size === 1 ? '' : 's'} selected
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300">Set threshold (passes):</label>
                  <input
                    type="number"
                    min={1}
                    value={bulkThreshold}
                    onChange={(e) => setBulkThreshold(e.target.value)}
                    placeholder="e.g., 5"
                    className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white"
                  />
                </div>
                <button
                  onClick={applyBulkThreshold}
                  disabled={bulkApplying || !(parseInt(bulkThreshold, 10) >= 1)}
                  className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkApplying ? 'Applying…' : 'Apply to selected'}
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Maintenance Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="px-4 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-cyan-500 cursor-pointer"
                          title="Select all"
                        />
                      </th>
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
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => toggleSelectItem(item.id)}
                                className="w-4 h-4 accent-cyan-500 cursor-pointer"
                                title="Select item"
                              />
                            </td>

                            <td className="px-4 py-3">
                              <p className="text-white font-medium">{item.component}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2">
                                {/* Category color dot/badge for fast visual scanning */}
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getCategoryColor(item.category, colorResolutionList) }}
                                />
                                <span className="text-slate-300">{item.category}</span>
                              </span>
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
                                    {(() => {
                                      // Passes remaining until the alert fires is the
                                      // gap between the current "remaining" count and the
                                      // threshold (NOT the threshold value itself).
                                      const passesUntilAlert = remaining - item.threshold;
                                      return passesUntilAlert <= 0
                                        ? 'alert active'
                                        : `${passesUntilAlert} pass${passesUntilAlert === 1 ? '' : 'es'} left to alert`;
                                    })()}
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
                              <td colSpan={9} className="px-4 py-4">


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
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">

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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-400">Category</label>
                    <button
                      type="button"
                      onClick={() => { setShowManageCategories(v => !v); setCategoryError(null); }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      {showManageCategories ? 'Done' : 'Manage'}
                    </button>
                  </div>
                  <select
                    value={newMaintenance.category}
                    onChange={(e) => setNewMaintenance({...newMaintenance, category: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <optgroup label="General">
                      {effectiveDefaults.general.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Drivetrain Components">
                      {effectiveDefaults.drivetrain.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="Custom">
                        {customCategories.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {/* Preserve a value not in any preset list (e.g. legacy/imported/hidden). */}
                    {newMaintenance.category &&
                      ![...effectiveDefaults.general, ...effectiveDefaults.drivetrain].some((c) => c.name === newMaintenance.category) &&
                      !customCategoryNames.includes(newMaintenance.category) && (
                        <option value={newMaintenance.category}>{newMaintenance.category}</option>
                      )}

                  </select>

                  {/* ===== INLINE CATEGORY MANAGER ===== */}
                  {showManageCategories && (
                    <div className="mt-2 bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1.5">Create a new category</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => { setNewCategoryName(e.target.value); setCategoryError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                            placeholder="e.g., Parachute"
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddCategory}
                            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                        {/* Color picker for the new category */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[11px] text-slate-500 mr-1">Color:</span>
                          {CATEGORY_COLOR_PALETTE.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewCategoryColor(color)}
                              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                                newCategoryColor === color ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        {categoryError && (
                          <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{categoryError}
                          </p>
                        )}
                      </div>

                      {customCategories.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1.5">
                            Your custom categories
                            <span className="text-slate-500"> — drag to reorder</span>
                          </p>
                          <div className="space-y-2">
                            {customCategories.map((c, index) => (
                              <div
                                key={c.name}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={() => handleDrop(index)}
                                className={`bg-slate-800 border rounded-lg p-2 transition-colors ${
                                  dragOverIndex === index && dragIndex !== null && dragIndex !== index
                                    ? 'border-orange-500'
                                    : 'border-slate-600'
                                } ${dragIndex === index ? 'opacity-50' : ''}`}
                              >

                                {renamingCategory === c.name ? (
                                  /* ===== RENAME MODE ===== */
                                  <div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={renameValue}
                                        autoFocus
                                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(c.name); } }}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRenameCategory(c.name)}
                                        className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setRenamingCategory(null); setRenameError(null); }}
                                        className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                    {renameError && (
                                      <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />{renameError}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  /* ===== DISPLAY MODE ===== */
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {/* Drag handle — only this grip starts a drag so
                                          the color swatches/buttons stay clickable. */}
                                      <span
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 flex-shrink-0"
                                        title="Drag to reorder"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </span>
                                      <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: c.color }}
                                      />
                                      <span className="text-sm text-white truncate">{c.name}</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => { setRenamingCategory(c.name); setRenameValue(c.name); setRenameError(null); }}
                                        className="p-1 text-blue-400 hover:text-blue-300"
                                        title="Rename category"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => requestDeleteCustom(c.name)}
                                        className="p-1 text-slate-400 hover:text-red-400"
                                        title="Delete category"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>

                                    </div>
                                  </div>
                                )}
                                {/* Per-category color picker (always visible in display mode) */}
                                {renamingCategory !== c.name && (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {CATEGORY_COLOR_PALETTE.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => handleChangeCategoryColor(c.name, color)}
                                        className={`w-4 h-4 rounded-full border-2 transition-transform ${
                                          c.color === color ? 'border-white scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-500">
                            Renaming updates every item using the category. Deleting won't change items already saved with it.
                          </p>
                        </div>
                      )}

                      {/* ===== BUILT-IN (DEFAULT) CATEGORIES — now editable ===== */}
                      <div>
                        <p className="text-xs text-slate-400 mb-1.5">
                          Built-in categories
                          <span className="text-slate-500"> — rename, recolor, delete, or drag to reorder</span>
                        </p>
                        <div className="space-y-2">
                          {combinedDefaults.map((c, index) => {
                            const orig = effectiveDefaults.originalByDisplay[c.name] || c.name;
                            return (
                              <div
                                key={orig}
                                onDragOver={(e) => handleDefaultDragOver(e, index)}
                                onDrop={() => handleDefaultDrop(index)}
                                className={`bg-slate-800 border rounded-lg p-2 transition-colors ${
                                  defaultDragOverIndex === index && defaultDragIndex !== null && defaultDragIndex !== index
                                    ? 'border-orange-500'
                                    : 'border-slate-600'
                                } ${defaultDragIndex === index ? 'opacity-50' : ''}`}
                              >

                                {renamingDefault === orig ? (
                                  /* ===== RENAME MODE ===== */
                                  <div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={renameDefaultValue}
                                        autoFocus
                                        onChange={(e) => { setRenameDefaultValue(e.target.value); setRenameDefaultError(null); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameDefault(orig); } }}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRenameDefault(orig)}
                                        className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setRenamingDefault(null); setRenameDefaultError(null); }}
                                        className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                    {renameDefaultError && (
                                      <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />{renameDefaultError}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  /* ===== DISPLAY MODE ===== */
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {/* Drag handle — only this grip starts a drag so
                                          the color swatches/buttons stay clickable. */}
                                      <span
                                        draggable
                                        onDragStart={() => handleDefaultDragStart(index)}
                                        onDragEnd={() => { setDefaultDragIndex(null); setDefaultDragOverIndex(null); }}
                                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 flex-shrink-0"
                                        title="Drag to reorder"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </span>
                                      <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: c.color }}
                                      />
                                      <span className="text-sm text-white truncate">{c.name}</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => { setRenamingDefault(orig); setRenameDefaultValue(c.name); setRenameDefaultError(null); }}
                                        className="p-1 text-blue-400 hover:text-blue-300"
                                        title="Rename category"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => requestDeleteDefault(orig, c.name)}
                                        className="p-1 text-slate-400 hover:text-red-400"
                                        title="Delete category"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>

                                    </div>
                                  </div>
                                )}
                                {/* Per-category color picker */}
                                {renamingDefault !== orig && (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {CATEGORY_COLOR_PALETTE.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => handleChangeDefaultColor(orig, color)}
                                        className={`w-4 h-4 rounded-full border-2 transition-transform ${
                                          c.color === color ? 'border-white scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Restore any deleted built-in categories */}
                        {defaultOverrides.hidden.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[11px] text-slate-500 mb-1">Deleted built-in categories:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {defaultOverrides.hidden.map((orig) => (
                                <button
                                  key={orig}
                                  type="button"
                                  onClick={() => handleRestoreDefault(orig)}
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
                                  title="Restore this category"
                                >
                                  <Plus className="w-3 h-3" />
                                  {defaultOverrides.renames[orig]?.trim() || orig}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Renaming updates every item using the category. Deleting hides it from the pickers; items already saved with it keep their value.
                        </p>
                      </div>

                    </div>
                  )}
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
              
              {/* Spreadsheet-style service log — replaces the three separate
                  Last Service Date / Last Service Time / Notes inputs with one
                  grid of unbounded rows. */}
              <ServiceLogGrid
                rows={newMaintenance.serviceLog && newMaintenance.serviceLog.length > 0
                  ? newMaintenance.serviceLog
                  : seedServiceLog(newMaintenance)}
                onChange={(rows) => setNewMaintenance({ ...newMaintenance, serviceLog: rows })}
              />

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

      {/* ============ DELETE CATEGORY CONFIRMATION MODAL ============ */}
      {pendingDeleteCategory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete category?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  You're about to delete{' '}
                  <span className="text-white font-medium">"{pendingDeleteCategory.display}"</span>
                  {pendingDeleteCategory.kind === 'default' ? ' (built-in)' : ''}.
                </p>
              </div>
            </div>
            <div className={`rounded-lg p-3 mb-5 text-sm ${
              pendingDeleteCategory.count > 0
                ? 'bg-orange-500/10 border border-orange-500/30 text-orange-300'
                : 'bg-slate-900/60 border border-slate-700 text-slate-400'
            }`}>
              {pendingDeleteCategory.count > 0 ? (
                <>
                  <span className="font-semibold text-orange-200">
                    {pendingDeleteCategory.count} maintenance item{pendingDeleteCategory.count === 1 ? '' : 's'}
                  </span>{' '}
                  currently use{pendingDeleteCategory.count === 1 ? 's' : ''} this category. Choose a
                  category below to move {pendingDeleteCategory.count === 1 ? 'it' : 'them'} to, or leave
                  it on "Keep current value" to leave {pendingDeleteCategory.count === 1 ? 'it' : 'them'} on
                  the removed value.
                </>
              ) : (
                'No maintenance items currently use this category.'
              )}
            </div>

            {/* ===== OPTIONAL REASSIGNMENT ===== */}
            {pendingDeleteCategory.count > 0 && (
              <div className="mb-5">
                <label className="block text-sm text-slate-300 mb-1.5">
                  Reassign {pendingDeleteCategory.count} item{pendingDeleteCategory.count === 1 ? '' : 's'} to
                </label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Keep current value (don't reassign)</option>
                  {reassignOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {reassignTo && (
                  <p className="mt-1.5 text-[11px] text-cyan-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {pendingDeleteCategory.count} item{pendingDeleteCategory.count === 1 ? '' : 's'} will move to "{reassignTo}".
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeleteCategory(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {reassignTo ? 'Reassign & Delete' : 'Delete'}
              </button>

            </div>
          </div>
        </div>
      )}
    </section>


  );
};

export default MaintenanceTracker;
