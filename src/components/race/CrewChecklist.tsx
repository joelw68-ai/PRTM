import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChecklistItem } from '@/data/proModData';
import { CrewRole, hasPermission } from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import * as db from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  X,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  Check,
  ListPlus,
  Pencil,
  FolderPlus,
  GripVertical,
  Printer,
  FileDown
} from 'lucide-react';


// ============ CONSTANTS ============
const BUILTIN_TYPES = ['preRun', 'betweenRounds', 'postRun'] as const;
type BuiltinChecklistType = typeof BUILTIN_TYPES[number];
const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
  preRun: 'Pre-Run',
  betweenRounds: 'Between Rounds',
  postRun: 'Post-Run'
};
const LS_DISPLAY_NAMES_KEY = 'checklist_display_names';
const LS_CUSTOM_TYPES_KEY = 'checklist_custom_types'; // string[] of custom type keys
const LS_TAB_ORDER_KEY = 'checklist_tab_order'; // string[] of ordered type keys

// ============ HELPERS ============
function loadDisplayNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_DISPLAY_NAMES_KEY);
    return raw ? { ...DEFAULT_DISPLAY_NAMES, ...JSON.parse(raw) } : { ...DEFAULT_DISPLAY_NAMES };
  } catch { return { ...DEFAULT_DISPLAY_NAMES }; }
}
function saveDisplayNames(names: Record<string, string>) {
  try { localStorage.setItem(LS_DISPLAY_NAMES_KEY, JSON.stringify(names)); } catch {}
}
function loadCustomTypes(): string[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_TYPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveCustomTypes(types: string[]) {
  try { localStorage.setItem(LS_CUSTOM_TYPES_KEY, JSON.stringify(types)); } catch {}
}
function loadTabOrder(): string[] {
  try {
    const raw = localStorage.getItem(LS_TAB_ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveTabOrder(order: string[]) {
  try { localStorage.setItem(LS_TAB_ORDER_KEY, JSON.stringify(order)); } catch {}
}
/** Build the ordered list of all checklist types, respecting saved tab order.
 *  Any types not in the saved order are appended at the end (built-in first, then custom). */
function buildOrderedTypes(customTypes: string[], savedOrder: string[]): string[] {
  const allTypes = [...BUILTIN_TYPES, ...customTypes];
  if (savedOrder.length === 0) return allTypes;
  // Start with saved order, filtering out any that no longer exist
  const ordered = savedOrder.filter(t => allTypes.includes(t));
  // Append any types not in the saved order
  for (const t of allTypes) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  return ordered;
}


interface CrewChecklistProps {
  crewMemberName: string;
  currentRole: CrewRole;
}

const CrewChecklist: React.FC<CrewChecklistProps> = ({ crewMemberName, currentRole }) => {
  const { user, profile } = useAuth();

  const { 
    preRunChecklist, 
    betweenRoundsChecklist, 
    postRunChecklist,
    toggleChecklistItem,
    resetChecklist,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem
  } = useApp();
  
  // ============ STATE ============
  const [activeChecklist, setActiveChecklist] = useState<string>('preRun');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  
  // Rename state
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(loadDisplayNames);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Custom checklists
  const [customTypes, setCustomTypes] = useState<string[]>(loadCustomTypes);
  const [customChecklists, setCustomChecklists] = useState<Record<string, ChecklistItem[]>>({});
  
  // New checklist modal
  const [showNewChecklistModal, setShowNewChecklistModal] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState('');
  
  // Permission checks
  const canCheck = hasPermission(currentRole, 'checklist.check');
  const canEdit = hasPermission(currentRole, 'checklist.edit');
  const canDelete = hasPermission(currentRole, 'checklist.delete');
  const canReset = hasPermission(currentRole, 'checklist.reset');
  
  const defaultItem: ChecklistItem = {
    id: '',
    task: '',
    category: 'General',
    completed: false,
    critical: false,
    notes: ''
  };
  
  const [newItem, setNewItem] = useState<ChecklistItem>(defaultItem);

  // ============ LOAD CUSTOM CHECKLISTS FROM DB ============
  useEffect(() => {
    const loadCustom = async () => {
      try {
        const result = await db.fetchChecklists(user?.id);
        if (result.custom && Object.keys(result.custom).length > 0) {
          setCustomChecklists(result.custom);
          // Merge any DB-discovered custom types with localStorage
          const dbTypes = Object.keys(result.custom);
          setCustomTypes(prev => {
            const merged = [...new Set([...prev, ...dbTypes])];
            saveCustomTypes(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('[CrewChecklist] Failed to load custom checklists:', err);
      }
    };
    loadCustom();
  }, [user?.id]);

  // ============ TAB ORDER ============
  const [tabOrder, setTabOrder] = useState<string[]>(() => loadTabOrder());
  const orderedTypes = buildOrderedTypes(customTypes, tabOrder);

  // Persist tab order whenever it changes
  const updateTabOrder = (newOrder: string[]) => {
    setTabOrder(newOrder);
    saveTabOrder(newOrder);
  };

  const moveTab = (type: string, direction: 'left' | 'right') => {
    const currentOrder = [...orderedTypes];
    const idx = currentOrder.indexOf(type);
    if (idx < 0) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    // Swap
    [currentOrder[idx], currentOrder[targetIdx]] = [currentOrder[targetIdx], currentOrder[idx]];
    updateTabOrder(currentOrder);
    toast.success(`Moved "${displayName(type)}" ${direction}`);
  };

  // ============ COMPUTED ============
  const isBuiltin = (type: string): type is BuiltinChecklistType => 
    (BUILTIN_TYPES as readonly string[]).includes(type);

  const allTypes = [...BUILTIN_TYPES, ...customTypes];


  const getChecklistItems = useCallback((type: string): ChecklistItem[] => {
    if (type === 'preRun') return preRunChecklist;
    if (type === 'betweenRounds') return betweenRoundsChecklist;
    if (type === 'postRun') return postRunChecklist;
    return customChecklists[type] || [];
  }, [preRunChecklist, betweenRoundsChecklist, postRunChecklist, customChecklists]);

  const currentChecklist = getChecklistItems(activeChecklist);
  const displayName = (type: string) => displayNames[type] || type;
  
  // Group items by category
  const categories = [...new Set(currentChecklist.map(item => item.category))];
  
  const getItemsByCategory = (category: string) => 
    currentChecklist.filter(item => item.category === category);

  const getCompletedCount = () => currentChecklist.filter(i => i.completed).length;
  const getTotalCount = () => currentChecklist.length;
  const getCriticalIncomplete = () => currentChecklist.filter(i => i.critical && !i.completed).length;

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // ============ RENAME ============
  const startRename = (type: string) => {
    setRenamingTab(type);
    setRenameValue(displayName(type));
  };

  const confirmRename = () => {
    if (!renamingTab || !renameValue.trim()) return;
    const updated = { ...displayNames, [renamingTab]: renameValue.trim() };
    setDisplayNames(updated);
    saveDisplayNames(updated);
    setRenamingTab(null);
    setRenameValue('');
    toast.success(`Checklist renamed to "${renameValue.trim()}"`);
  };

  const cancelRename = () => {
    setRenamingTab(null);
    setRenameValue('');
  };

  // ============ ADD NEW CHECKLIST ============
  const handleAddNewChecklist = () => {
    if (!newChecklistName.trim()) return;
    // Generate a safe key from the name
    const key = 'custom_' + newChecklistName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString(36);
    const updated = [...customTypes, key];
    setCustomTypes(updated);
    saveCustomTypes(updated);
    // Set display name
    const names = { ...displayNames, [key]: newChecklistName.trim() };
    setDisplayNames(names);
    saveDisplayNames(names);
    // Initialize empty checklist
    setCustomChecklists(prev => ({ ...prev, [key]: [] }));
    setActiveChecklist(key);
    setShowNewChecklistModal(false);
    setNewChecklistName('');
    toast.success(`New checklist "${newChecklistName.trim()}" created`);
  };

  // ============ DELETE CUSTOM CHECKLIST ============
  const handleDeleteCustomChecklist = async (type: string) => {
    if (isBuiltin(type)) return; // Can't delete built-in checklists
    const name = displayName(type);
    if (!confirm(`Are you sure you want to delete the "${name}" checklist and all its items? This cannot be undone.`)) return;
    
    // Remove from custom types
    const updatedTypes = customTypes.filter(t => t !== type);
    setCustomTypes(updatedTypes);
    saveCustomTypes(updatedTypes);
    
    // Remove display name
    const updatedNames = { ...displayNames };
    delete updatedNames[type];
    setDisplayNames(updatedNames);
    saveDisplayNames(updatedNames);
    
    // Remove from local state
    setCustomChecklists(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
    
    // Delete from DB
    try {
      await db.deleteChecklistsByType(type, user?.id);
    } catch (err) {
      console.warn('[CrewChecklist] Failed to delete custom checklist from DB:', err);
    }
    
    // Switch to first tab
    setActiveChecklist('preRun');
    toast.success(`Checklist "${name}" deleted`);
  };

  // ============ CHECKLIST ITEM ACTIONS ============
  const handleToggleItem = async (itemId: string) => {
    if (!canCheck) return;
    
    const item = currentChecklist.find(i => i.id === itemId);
    if (!item) return;
    
    const updates: Partial<ChecklistItem> = {
      completed: !item.completed
    };
    
    if (!item.completed) {
      updates.checkedBy = crewMemberName;
      updates.checkedAt = new Date().toISOString();
    } else {
      updates.checkedBy = undefined;
      updates.checkedAt = undefined;
    }
    
    if (isBuiltin(activeChecklist)) {
      await updateChecklistItem(activeChecklist, itemId, updates);
    } else {
      // Custom checklist: update local state + DB
      setCustomChecklists(prev => ({
        ...prev,
        [activeChecklist]: (prev[activeChecklist] || []).map(i => 
          i.id === itemId ? { ...i, ...updates } : i
        )
      }));
      try {
        await db.updateChecklistCompletion(itemId, !item.completed);
      } catch (err) {
        console.warn('[CrewChecklist] Failed to update custom checklist item:', err);
      }
    }
    
    await auditLog.logChecklistCheck(
      itemId,
      item.task,
      displayName(activeChecklist),
      !item.completed
    );
  };

  const handleResetChecklist = async () => {
    if (!canReset) return;
    
    if (confirm(`Are you sure you want to reset the ${displayName(activeChecklist)} checklist? All items will be unchecked.`)) {
      if (isBuiltin(activeChecklist)) {
        await resetChecklist(activeChecklist);
      } else {
        // Custom checklist: reset local state + DB
        setCustomChecklists(prev => ({
          ...prev,
          [activeChecklist]: (prev[activeChecklist] || []).map(item => ({
            ...item, completed: false, checkedBy: undefined, checkedAt: undefined
          }))
        }));
        try {
          await db.resetChecklistByType(activeChecklist, user?.id);
        } catch (err) {
          console.warn('[CrewChecklist] Failed to reset custom checklist:', err);
        }
      }
      
      await auditLog.logChecklistReset(
        activeChecklist,
        displayName(activeChecklist),
        currentChecklist.length
      );
    }
  };

  const handleSaveItem = async () => {
    if (!canEdit) return;
    
    if (editingItem) {
      if (isBuiltin(activeChecklist)) {
        await updateChecklistItem(activeChecklist, editingItem.id, newItem);
      } else {
        setCustomChecklists(prev => ({
          ...prev,
          [activeChecklist]: (prev[activeChecklist] || []).map(i => 
            i.id === editingItem.id ? { ...i, ...newItem } : i
          )
        }));
        try {
          const existing = (customChecklists[activeChecklist] || []).find(i => i.id === editingItem.id);
          if (existing) await db.upsertChecklistItem({ ...existing, ...newItem }, activeChecklist, user?.id);
        } catch (err) {
          console.warn('[CrewChecklist] Failed to update custom checklist item in DB:', err);
        }
      }
      
      await auditLog.logChecklistItemUpdate(
        editingItem.id,
        newItem.task,
        editingItem,
        newItem
      );
    } else {
      const id = `${activeChecklist.toUpperCase().slice(0, 6)}-${String(currentChecklist.length + 1).padStart(3, '0')}-${Date.now().toString(36)}`;
      const itemWithId = { ...newItem, id };
      
      if (isBuiltin(activeChecklist)) {
        await addChecklistItem(activeChecklist, itemWithId);
      } else {
        setCustomChecklists(prev => ({
          ...prev,
          [activeChecklist]: [...(prev[activeChecklist] || []), itemWithId]
        }));
        try {
          await db.upsertChecklistItem(itemWithId, activeChecklist, user?.id);
        } catch (err) {
          console.warn('[CrewChecklist] Failed to add custom checklist item to DB:', err);
        }
      }
      
      await auditLog.logChecklistItemCreate(
        id,
        newItem.task,
        displayName(activeChecklist),
        itemWithId
      );
    }
    setShowAddModal(false);
    setEditingItem(null);
    setNewItem(defaultItem);
  };

  const handleDeleteItem = async (id: string) => {
    if (!canDelete) return;
    
    const item = currentChecklist.find(i => i.id === id);
    if (confirm('Are you sure you want to delete this checklist item?')) {
      if (isBuiltin(activeChecklist)) {
        await deleteChecklistItem(activeChecklist, id);
      } else {
        setCustomChecklists(prev => ({
          ...prev,
          [activeChecklist]: (prev[activeChecklist] || []).filter(i => i.id !== id)
        }));
        try {
          await db.deleteChecklistItem(id);
        } catch (err) {
          console.warn('[CrewChecklist] Failed to delete custom checklist item from DB:', err);
        }
      }
      
      if (item) {
        await auditLog.logChecklistItemDelete(
          id,
          item.task,
          displayName(activeChecklist)
        );
      }
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const progress = getTotalCount() > 0 ? (getCompletedCount() / getTotalCount()) * 100 : 0;

  // ============ PRINT / PDF EXPORT ============
  const generatePrintHTML = (triggerPrint: boolean): string => {
    const teamNameStr = profile?.teamName || 'Race Team';
    const driverNameStr = profile?.driverName || '';
    const checklistName = displayName(activeChecklist);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const completedCount = getCompletedCount();
    const totalCount = getTotalCount();
    const criticalIncomplete = getCriticalIncomplete();
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Build category sections
    let categorySectionsHTML = '';
    for (const category of categories) {
      const items = getItemsByCategory(category);
      const catCompleted = items.filter(i => i.completed).length;

      let itemsHTML = '';
      for (const item of items) {
        const checkboxSVG = item.completed
          ? `<svg width="16" height="16" viewBox="0 0 16 16" style="flex-shrink:0"><rect x="1" y="1" width="14" height="14" rx="2" fill="#16a34a" stroke="#16a34a" stroke-width="1.5"/><polyline points="4 8 7 11 12 5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 16 16" style="flex-shrink:0"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#6b7280" stroke-width="1.5"/></svg>`;

        const criticalBadge = item.critical
          ? `<span style="display:inline-block;margin-left:8px;padding:1px 6px;font-size:10px;font-weight:700;color:#dc2626;border:1.5px solid #dc2626;border-radius:3px;text-transform:uppercase;letter-spacing:0.5px;">Critical</span>`
          : '';

        const taskStyle = item.completed ? 'text-decoration:line-through;color:#9ca3af;' : 'color:#111827;';
        const criticalRowBg = item.critical && !item.completed ? 'background:#fef2f2;' : '';

        const checkedByHTML = item.completed && item.checkedBy
          ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">Checked by ${item.checkedBy}${item.checkedAt ? ' at ' + formatTime(item.checkedAt) : ''}</div>`
          : '';

        const notesHTML = item.notes
          ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;font-style:italic;">${item.notes}</div>`
          : '';

        itemsHTML += `
          <tr style="${criticalRowBg}">
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:28px;">${checkboxSVG}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
              <div style="display:flex;align-items:center;flex-wrap:wrap;">
                <span style="${taskStyle}font-size:13px;">${item.task}</span>${criticalBadge}
              </div>
              ${checkedByHTML}
              ${notesHTML}
            </td>
          </tr>`;
      }

      categorySectionsHTML += `
        <div style="margin-bottom:20px;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#f3f4f6;padding:8px 12px;border-radius:6px 6px 0 0;border:1px solid #d1d5db;border-bottom:none;">
            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1f2937;">${category}</h3>
            <span style="font-size:12px;color:#6b7280;font-weight:600;">${catCompleted}/${items.length} complete</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">
            ${itemsHTML}
          </table>
        </div>`;
    }

    // Status summary
    const statusColor = progressPct === 100 ? '#16a34a' : criticalIncomplete > 0 ? '#d97706' : '#ea580c';
    const statusText = progressPct === 100
      ? 'CHECKLIST COMPLETE'
      : criticalIncomplete > 0
        ? `${criticalIncomplete} CRITICAL ITEM${criticalIncomplete !== 1 ? 'S' : ''} REMAINING`
        : `${totalCount - completedCount} ITEM${totalCount - completedCount !== 1 ? 'S' : ''} REMAINING`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${checklistName} Checklist — ${teamNameStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #fff; padding: 0; }
    .print-container { max-width: 800px; margin: 0 auto; padding: 40px 32px; }

    /* Screen-only toolbar */
    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding: 12px 16px; background: #1e293b; border-radius: 10px; }
    .toolbar button { padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .btn-print { background: #ea580c; color: #fff; }
    .btn-print:hover { background: #c2410c; }
    .btn-pdf { background: #0284c7; color: #fff; }
    .btn-pdf:hover { background: #0369a1; }
    .btn-close { background: #475569; color: #fff; margin-left: auto; }
    .btn-close:hover { background: #334155; }

    /* Progress bar */
    .progress-bar-outer { width: 100%; height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; margin: 8px 0 4px; }
    .progress-bar-inner { height: 100%; border-radius: 5px; transition: width 0.3s; }

    /* Signature section */
    .signature-section { margin-top: 40px; page-break-inside: avoid; }
    .sig-line { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 24px; }
    .sig-line .sig-label { font-size: 13px; font-weight: 600; color: #374151; white-space: nowrap; min-width: 110px; }
    .sig-line .sig-field { flex: 1; border-bottom: 2px solid #1f2937; min-height: 28px; }
    .sig-line .sig-date { width: 180px; border-bottom: 2px solid #1f2937; min-height: 28px; }

    /* Print styles */
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-container { padding: 20px 16px; max-width: 100%; }
      .toolbar { display: none !important; }
      .page-break { page-break-before: always; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .signature-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- Screen-only toolbar -->
    <div class="toolbar">
      <button class="btn-print" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print Checklist
      </button>
      <button class="btn-pdf" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF
      </button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1f2937;">
      <h1 style="font-size:26px;font-weight:800;color:#1f2937;margin-bottom:4px;letter-spacing:-0.5px;">${teamNameStr}</h1>
      ${driverNameStr ? `<p style="font-size:14px;color:#6b7280;margin-bottom:8px;">Driver: ${driverNameStr}</p>` : ''}
      <h2 style="font-size:20px;font-weight:700;color:#ea580c;margin-bottom:6px;">${checklistName} Checklist</h2>
      <p style="font-size:13px;color:#6b7280;">${dateStr} &mdash; ${timeStr}</p>
    </div>

    <!-- Completion Status -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:8px;border:2px solid ${statusColor};margin-bottom:24px;background:${progressPct === 100 ? '#f0fdf4' : criticalIncomplete > 0 ? '#fffbeb' : '#fff7ed'};">
      <div>
        <div style="font-size:14px;font-weight:700;color:${statusColor};">${statusText}</div>
        <div style="font-size:12px;color:#6b7280;">${completedCount} of ${totalCount} items verified</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:800;color:${statusColor};">${progressPct}%</div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar-outer">
      <div class="progress-bar-inner" style="width:${progressPct}%;background:${statusColor};"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;margin-bottom:24px;">
      <span>0%</span>
      <span>Completion</span>
      <span>100%</span>
    </div>

    <!-- Checklist Items by Category -->
    ${categorySectionsHTML}

    <!-- Signature Section -->
    <div class="signature-section">
      <h3 style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:20px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Sign-Off</h3>

      <div class="sig-line">
        <span class="sig-label">Crew Chief:</span>
        <div class="sig-field"></div>
        <span style="font-size:12px;color:#6b7280;white-space:nowrap;">Date / Time:</span>
        <div class="sig-date"></div>
      </div>

      <div class="sig-line">
        <span class="sig-label">Driver:</span>
        <div class="sig-field"></div>
        <span style="font-size:12px;color:#6b7280;white-space:nowrap;">Date / Time:</span>
        <div class="sig-date"></div>
      </div>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;">
        <span>Generated: ${dateStr} at ${timeStr}</span>
        <span>${teamNameStr} &mdash; ${checklistName} Checklist</span>
      </div>
    </div>
  </div>
  ${triggerPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400)});</script>' : ''}
</body>
</html>`;
  };

  const openPrintView = () => {
    if (currentChecklist.length === 0) {
      toast.error('Cannot print an empty checklist');
      return;
    }
    const html = generatePrintHTML(false);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      toast.success('Print view opened in new tab');
    } else {
      toast.error('Pop-up blocked — please allow pop-ups for this site');
    }
  };

  const handleDownloadPDF = () => {
    if (currentChecklist.length === 0) {
      toast.error('Cannot export an empty checklist');
      return;
    }
    const html = generatePrintHTML(true);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      toast.success('PDF print dialog will open — choose "Save as PDF" as the destination');
    } else {
      toast.error('Pop-up blocked — please allow pop-ups for this site');
    }
  };


  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <ClipboardCheck className="w-7 h-7 text-orange-500" />
              Crew Checklists
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-400">
                Logged in as: <span className="text-orange-400 font-medium">{crewMemberName}</span>
              </p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                currentRole === 'Admin' || currentRole === 'Owner' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : currentRole === 'Crew Chief'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-slate-500/20 text-slate-400'
              }`}>
                <Shield className="w-3 h-3" />
                {currentRole}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Print / PDF Export */}
            <button
              onClick={openPrintView}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600/20 text-cyan-400 rounded-lg font-medium hover:bg-cyan-600/30 transition-colors border border-cyan-600/30"
              title="Open printer-friendly view of this checklist"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg font-medium hover:bg-blue-600/30 transition-colors border border-blue-600/30"
              title="Download checklist as PDF (uses browser print-to-PDF)"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block" />

            {canEdit && (
              <>
                <button
                  onClick={() => setShowNewChecklistModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
                  title="Add a new checklist"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Checklist
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setNewItem(defaultItem);
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </>
            )}
            {canReset ? (
              <button
                onClick={handleResetChecklist}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-500 rounded-lg cursor-not-allowed"
                title="You don't have permission to reset checklists"
              >
                <Lock className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

        </div>

        {/* Permission Notice */}
        {!canCheck && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400">
              <Lock className="w-4 h-4" />
              <span className="text-sm">You have view-only access. Contact a Crew Chief or Admin to check items.</span>
            </div>
          </div>
        )}

        {/* Checklist Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 items-center">
          {orderedTypes.map((type, idx) => {
            const checklist = getChecklistItems(type);
            const completed = checklist.filter(i => i.completed).length;
            const total = checklist.length;
            const critical = checklist.filter(i => i.critical && !i.completed).length;
            const isCustom = !isBuiltin(type);
            const isFirst = idx === 0;
            const isLast = idx === orderedTypes.length - 1;
            
            return (
              <div key={type} className="flex items-center gap-0 shrink-0">
                {/* Rename inline editor */}
                {renamingTab === type ? (
                  <div className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1.5">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                      className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-slate-600 w-36 focus:outline-none focus:border-orange-500"
                    />
                    <button onClick={confirmRename} className="p-1 text-green-400 hover:text-green-300" title="Confirm">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelRename} className="p-1 text-slate-400 hover:text-slate-300" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0">
                    {/* Move Left button — shown on active tab when not first */}
                    {canEdit && activeChecklist === type && !isFirst && (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveTab(type, 'left'); }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-lg transition-colors"
                        title="Move tab left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setActiveChecklist(type)}
                      className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                        activeChecklist === type 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      } ${canEdit && activeChecklist === type ? (isFirst ? 'rounded-l-lg' : '') + ' ' + (isLast ? 'rounded-r-lg' : '') : 'rounded-lg'}`}
                    >
                      {/* Drag handle indicator for active tab */}
                      {canEdit && activeChecklist === type && orderedTypes.length > 1 && (
                        <GripVertical className="w-3.5 h-3.5 opacity-50" />
                      )}
                      {displayName(type)}
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        activeChecklist === type 
                          ? 'bg-white/20' 
                          : completed === total && total > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700'
                      }`}>
                        {completed}/{total}
                      </span>
                      {critical > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs">
                          {critical} critical
                        </span>
                      )}
                      {/* Rename button (inline, on hover) */}
                      {canEdit && activeChecklist === type && (
                        <span
                          onClick={(e) => { e.stopPropagation(); startRename(type); }}
                          className="ml-1 p-0.5 rounded hover:bg-white/20 cursor-pointer"
                          title={`Rename "${displayName(type)}"`}
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                      )}
                      {/* Delete button for custom checklists */}
                      {canEdit && isCustom && activeChecklist === type && (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleDeleteCustomChecklist(type); }}
                          className="ml-0.5 p-0.5 rounded hover:bg-red-500/30 cursor-pointer text-red-400"
                          title={`Delete "${displayName(type)}" checklist`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                    {/* Move Right button — shown on active tab when not last */}
                    {canEdit && activeChecklist === type && !isLast && (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveTab(type, 'right'); }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-lg transition-colors"
                        title="Move tab right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>


        {/* Progress Bar */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">{displayName(activeChecklist)} Progress</span>
            <span className="text-slate-400">{getCompletedCount()} of {getTotalCount()} complete</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                progress === 100 ? 'bg-green-500' : 
                getCriticalIncomplete() > 0 ? 'bg-yellow-500' : 
                'bg-orange-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {getCriticalIncomplete() > 0 && (
            <p className="mt-2 text-yellow-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {getCriticalIncomplete()} critical items remaining
            </p>
          )}
        </div>

        {/* Empty state for custom checklists */}
        {currentChecklist.length === 0 && !isBuiltin(activeChecklist) && (
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center mb-6">
            <ListPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No items yet</h3>
            <p className="text-slate-400 text-sm mb-4">
              This checklist is empty. Add items to get started.
            </p>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setNewItem(defaultItem);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Item
              </button>
            )}
          </div>
        )}

        {/* Checklist Items by Category */}
        <div className="space-y-4">
          {categories.map(category => {
            const items = getItemsByCategory(category);
            const completedInCategory = items.filter(i => i.completed).length;
            const isExpanded = expandedCategories.has(category) || expandedCategories.size === 0;
            
            return (
              <div key={category} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{category}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      completedInCategory === items.length 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {completedInCategory}/{items.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="border-t border-slate-700/50">
                    {items.map(item => (
                      <div 
                        key={item.id}
                        className={`flex items-center gap-4 p-4 border-b border-slate-700/30 last:border-b-0 hover:bg-slate-700/10 ${
                          item.critical && !item.completed ? 'bg-red-500/5' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleToggleItem(item.id)}
                          disabled={!canCheck}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                            item.completed 
                              ? 'bg-green-500 border-green-500' 
                              : item.critical 
                                ? 'border-red-400 hover:border-red-300' 
                                : 'border-slate-500 hover:border-slate-400'
                          } ${!canCheck ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                        </button>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`${item.completed ? 'text-slate-400 line-through' : 'text-white'}`}>
                              {item.task}
                            </span>
                            {item.critical && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded font-medium">
                                CRITICAL
                              </span>
                            )}
                          </div>
                          
                          {item.completed && item.checkedBy && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {item.checkedBy}
                              </span>
                              {item.checkedAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(item.checkedAt)}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {item.notes && (
                            <p className="text-xs text-slate-500 mt-1">{item.notes}</p>
                          )}
                        </div>
                        
                        {(canEdit || canDelete) && (
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setNewItem(item);
                                  setShowAddModal(true);
                                }}
                                className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion Summary */}
        {progress === 100 && getTotalCount() > 0 && (
          <div className="mt-6 bg-green-500/20 border border-green-500/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-400">{displayName(activeChecklist)} Checklist Complete!</h3>
                <p className="text-green-300 text-sm">All {getTotalCount()} items have been verified.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      {showAddModal && canEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingItem ? 'Edit Checklist Item' : `Add Item to "${displayName(activeChecklist)}"`}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Task *</label>
                <input
                  type="text"
                  value={newItem.task}
                  onChange={(e) => setNewItem({...newItem, task: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Check engine oil level"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="Engine">Engine</option>
                  <option value="Drivetrain">Drivetrain</option>
                  <option value="Ty-Drive">Ty-Drive</option>
                  <option value="Quick Drive">Quick Drive</option>
                  <option value="Transmission">Transmission</option>
                  <option value="Fuel">Fuel</option>
                  <option value="Safety">Safety</option>
                  <option value="Wheels and Tires">Wheels and Tires</option>
                  <option value="Chassis">Chassis</option>
                  <option value="Body">Body</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Brakes">Brakes</option>
                  <option value="General">General</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="critical"
                  checked={newItem.critical}
                  onChange={(e) => setNewItem({...newItem, critical: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="critical" className="text-white">Mark as critical item</label>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={newItem.notes || ''}
                  onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                  rows={2}
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
                onClick={handleSaveItem}
                disabled={!newItem.task}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Checklist Modal */}
      {showNewChecklistModal && canEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-orange-500" />
                New Checklist
              </h3>
              <button onClick={() => setShowNewChecklistModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Checklist Name *</label>
              <input
                type="text"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newChecklistName.trim()) handleAddNewChecklist(); }}
                autoFocus
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="e.g., Warm-Up, Test Session, Pack-Up"
              />
              <p className="text-xs text-slate-500 mt-2">
                You can add items to the checklist after creating it.
              </p>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewChecklistModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewChecklist}
                disabled={!newChecklistName.trim()}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CrewChecklist;
