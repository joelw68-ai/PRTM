import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { BorrowedLoanedPartRowSchema } from '@/lib/validators';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PartInventoryItem } from '@/data/partsInventory';
import DateInputDark from '@/components/ui/DateInputDark';
import {

  ArrowLeftRight,
  Plus,
  X,
  Edit2,
  Trash2,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  User,
  Phone,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  Bell,
  Link2,
  Filter,
} from 'lucide-react';



// ─── Types ───────────────────────────────────────────────────────────
interface BorrowedLoanedPart {
  id: string;
  user_id: string;
  transaction_type: 'borrowed' | 'loaned';
  part_name: string;
  part_number: string | null;
  description: string | null;
  quantity: number;
  person_name: string;
  contact: string | null;
  date_transaction: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  condition_out: string | null;
  condition_returned: string | null;
  notes: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  linked_inventory_id: string | null;
  inventory_adjusted: boolean;
  created_at: string;
  updated_at: string;
}

type FormData = {
  part_name: string;
  part_number: string;
  description: string;
  quantity: number;
  person_name: string;
  contact: string;
  date_transaction: string;
  expected_return_date: string;
  actual_return_date: string;
  condition_out: string;
  condition_returned: string;
  notes: string;
  status: 'borrowed' | 'returned' | 'overdue';
  linked_inventory_id: string;
};

const emptyForm: FormData = {
  part_name: '',
  part_number: '',
  description: '',
  quantity: 1,
  person_name: '',
  contact: '',
  date_transaction: new Date().toISOString().split('T')[0],
  expected_return_date: '',
  actual_return_date: '',
  condition_out: '',
  condition_returned: '',
  notes: '',
  status: 'borrowed',
  linked_inventory_id: '',
};

type ActiveTab = 'borrowed' | 'loaned';
type StatusFilter = 'all' | 'borrowed' | 'returned' | 'overdue';

interface BorrowedLoanedPartsProps {
  onNavigate?: (section: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────
const BorrowedLoanedParts: React.FC<BorrowedLoanedPartsProps> = ({ onNavigate }) => {
  const { user, isDemoMode, effectiveUserId } = useAuth();
  const { partsInventory, updatePartInventory } = useApp();
  const userId = effectiveUserId || user?.id;

  // State
  const [parts, setParts] = useState<BorrowedLoanedPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('borrowed');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<BorrowedLoanedPart | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const isOverdue = (part: BorrowedLoanedPart): boolean => {
    if (part.status === 'returned') return false;
    if (!part.expected_return_date) return false;
    return part.expected_return_date < today;
  };

  const isDueSoon = (part: BorrowedLoanedPart): boolean => {
    if (part.status === 'returned') return false;
    if (!part.expected_return_date) return false;
    if (part.expected_return_date < today) return false; // overdue, not due-soon
    const dueDate = new Date(part.expected_return_date + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  };

  const getDaysUntilDue = (part: BorrowedLoanedPart): number | null => {
    if (!part.expected_return_date) return null;
    const dueDate = new Date(part.expected_return_date + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    return Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const effectiveStatus = (part: BorrowedLoanedPart): 'borrowed' | 'returned' | 'overdue' => {
    if (part.status === 'returned') return 'returned';
    if (isOverdue(part)) return 'overdue';
    return 'borrowed';
  };

  // Get inventory item by ID
  const getLinkedInventoryItem = (inventoryId: string | null) => {
    if (!inventoryId) return null;
    return partsInventory.find(p => p.id === inventoryId) || null;
  };

  // ─── Reminder Items ─────────────────────────────────────────────
  const overdueItems = useMemo(() =>
    parts.filter(p => p.status !== 'returned' && isOverdue(p)),
    [parts, today]
  );

  const dueSoonItems = useMemo(() =>
    parts.filter(p => isDueSoon(p)),
    [parts, today]
  );

  // ─── Data Loading ────────────────────────────────────────────────
  const loadParts = useCallback(async () => {
    if (!userId || isDemoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('borrowed_loaned_parts')
        .select('*')
        .eq('user_id', userId)
        .order('date_transaction', { ascending: false });

      if (error) {
        console.error('[BorrowedLoaned] Load error:', error.message);
      } else {
        setParts(parseRows(data, BorrowedLoanedPartRowSchema, 'borrowed_loaned_parts') as BorrowedLoanedPart[]);
      }

    } catch (err) {
      console.error('[BorrowedLoaned] Load exception:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  // Auto-update overdue statuses in DB
  useEffect(() => {
    if (!userId || isDemoMode || parts.length === 0) return;

    const overdueUpdates = parts.filter(
      (p) => p.status === 'borrowed' && isOverdue(p)
    );

    if (overdueUpdates.length > 0) {
      const ids = overdueUpdates.map((p) => p.id);
      supabase
        .from('borrowed_loaned_parts')
        .update({ status: 'overdue', updated_at: new Date().toISOString() })
        .in('id', ids)
        .then(({ error }) => {
          if (!error) {
            setParts((prev) =>
              prev.map((p) =>
                ids.includes(p.id) ? { ...p, status: 'overdue' as const } : p
              )
            );
          }
        });
    }
  }, [parts, userId, isDemoMode]);

  // ─── Inventory Adjustment Helpers ───────────────────────────────
  const adjustInventory = async (inventoryId: string, quantityChange: number) => {
    const item = partsInventory.find(p => p.id === inventoryId);
    if (!item) return;
    const newQty = Math.max(0, item.onHand + quantityChange);
    const status = newQty === 0 ? 'Out of Stock' :
                   newQty <= item.minQuantity ? 'Low Stock' : 'In Stock';
    const reorderStatus = newQty === 0 ? 'Critical' :
                          newQty <= item.minQuantity ? 'Reorder' : 'OK';
    await updatePartInventory(item.id, {
      onHand: newQty,
      totalValue: newQty * item.unitCost,
      status: status as PartInventoryItem['status'],
      reorderStatus: reorderStatus as PartInventoryItem['reorderStatus'],
    });

  };

  // ─── CRUD ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) return;
    if (!formData.part_name.trim() || !formData.person_name.trim()) return;

    setSaving(true);
    try {
      const linkedId = formData.linked_inventory_id || null;
      const payload: any = {
        user_id: userId,
        transaction_type: activeTab,
        part_name: formData.part_name.trim(),
        part_number: formData.part_number.trim() || null,
        description: formData.description.trim() || null,
        quantity: formData.quantity || 1,
        person_name: formData.person_name.trim(),
        contact: formData.contact.trim() || null,
        date_transaction: formData.date_transaction || today,
        expected_return_date: formData.expected_return_date || null,
        actual_return_date: formData.actual_return_date || null,
        condition_out: formData.condition_out.trim() || null,
        condition_returned: formData.condition_returned.trim() || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        linked_inventory_id: linkedId,
        updated_at: new Date().toISOString(),
      };

      // Auto-set status to returned if actual_return_date is set
      if (payload.actual_return_date && payload.status !== 'returned') {
        payload.status = 'returned';
      }

      // Auto-detect overdue
      if (
        payload.status !== 'returned' &&
        payload.expected_return_date &&
        payload.expected_return_date < today
      ) {
        payload.status = 'overdue';
      }

      if (editingPart) {
        // Update
        const { error } = await supabase
          .from('borrowed_loaned_parts')
          .update(payload)
          .eq('id', editingPart.id);

        if (error) {
          console.error('[BorrowedLoaned] Update error:', error.message);
          alert('Failed to update: ' + error.message);
        } else {
          // Handle inventory adjustments for edits
          // If returning and linked, restore inventory
          if (payload.status === 'returned' && editingPart.status !== 'returned' && linkedId && editingPart.transaction_type === 'loaned') {
            if (editingPart.inventory_adjusted) {
              await adjustInventory(linkedId, payload.quantity);
              payload.inventory_adjusted = false;
              await supabase.from('borrowed_loaned_parts').update({ inventory_adjusted: false }).eq('id', editingPart.id);
            }
          }
          setParts((prev) =>
            prev.map((p) =>
              p.id === editingPart.id ? { ...p, ...payload } : p
            )
          );
          closeModal();
        }
      } else {
        // Insert
        payload.created_at = new Date().toISOString();
        payload.inventory_adjusted = false;

        // For new loaned transactions with linked inventory, reduce inventory
        if (activeTab === 'loaned' && linkedId && payload.status !== 'returned') {
          await adjustInventory(linkedId, -(payload.quantity));
          payload.inventory_adjusted = true;
        }

        const { data, error } = await supabase
          .from('borrowed_loaned_parts')
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error('[BorrowedLoaned] Insert error:', error.message);
          alert('Failed to save: ' + error.message);
          // Rollback inventory if insert failed
          if (activeTab === 'loaned' && linkedId && payload.inventory_adjusted) {
            await adjustInventory(linkedId, payload.quantity);
          }
        } else if (data) {
          setParts((prev) => [data, ...prev]);
          closeModal();
        }
      }
    } catch (err) {
      console.error('[BorrowedLoaned] Save exception:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    const part = parts.find(p => p.id === id);
    try {
      const { error } = await supabase
        .from('borrowed_loaned_parts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[BorrowedLoaned] Delete error:', error.message);
      } else {
        // If deleting a loaned part that had inventory adjusted, restore it
        if (part && part.transaction_type === 'loaned' && part.linked_inventory_id && part.inventory_adjusted && part.status !== 'returned') {
          await adjustInventory(part.linked_inventory_id, part.quantity);
        }
        setParts((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('[BorrowedLoaned] Delete exception:', err);
    }
  };

  const handleMarkReturned = async (part: BorrowedLoanedPart) => {
    if (!userId) return;
    const now = today;
    try {
      const updatePayload: any = {
        status: 'returned',
        actual_return_date: now,
        updated_at: new Date().toISOString(),
      };

      // If loaned with linked inventory and was adjusted, restore inventory
      if (part.transaction_type === 'loaned' && part.linked_inventory_id && part.inventory_adjusted) {
        await adjustInventory(part.linked_inventory_id, part.quantity);
        updatePayload.inventory_adjusted = false;
      }

      const { error } = await supabase
        .from('borrowed_loaned_parts')
        .update(updatePayload)
        .eq('id', part.id);

      if (!error) {
        setParts((prev) =>
          prev.map((p) =>
            p.id === part.id
              ? { ...p, status: 'returned' as const, actual_return_date: now, inventory_adjusted: false }
              : p
          )
        );
      }
    } catch (err) {
      console.error('[BorrowedLoaned] Mark returned error:', err);
    }
  };

  // ─── Modal Helpers ───────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingPart(null);
    setFormData({ ...emptyForm, date_transaction: today });
    setModalOpen(true);
  };

  const openEditModal = (part: BorrowedLoanedPart) => {
    setEditingPart(part);
    setActiveTab(part.transaction_type);
    setFormData({
      part_name: part.part_name,
      part_number: part.part_number || '',
      description: part.description || '',
      quantity: part.quantity,
      person_name: part.person_name,
      contact: part.contact || '',
      date_transaction: part.date_transaction,
      expected_return_date: part.expected_return_date || '',
      actual_return_date: part.actual_return_date || '',
      condition_out: part.condition_out || '',
      condition_returned: part.condition_returned || '',
      notes: part.notes || '',
      status: part.status,
      linked_inventory_id: part.linked_inventory_id || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPart(null);
    setFormData({ ...emptyForm });
  };

  // Auto-fill from inventory when linking
  const handleInventoryLink = (inventoryId: string) => {
    setFormData(prev => {
      const updated = { ...prev, linked_inventory_id: inventoryId };
      if (inventoryId) {
        const item = partsInventory.find(p => p.id === inventoryId);
        if (item && !prev.part_name) {
          updated.part_name = item.description;
          updated.part_number = item.partNumber;
        }
      }
      return updated;
    });
  };

  // ─── Filtering ───────────────────────────────────────────────────
  const filteredParts = parts.filter((p) => {
    if (p.transaction_type !== activeTab) return false;
    const eff = effectiveStatus(p);
    if (statusFilter !== 'all' && eff !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.part_name.toLowerCase().includes(q) ||
        (p.part_number || '').toLowerCase().includes(q) ||
        p.person_name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ─── Stats ───────────────────────────────────────────────────────
  const tabParts = parts.filter((p) => p.transaction_type === activeTab);
  const borrowedCount = tabParts.filter(
    (p) => effectiveStatus(p) === 'borrowed'
  ).length;
  const returnedCount = tabParts.filter(
    (p) => effectiveStatus(p) === 'returned'
  ).length;
  const overdueCount = tabParts.filter(
    (p) => effectiveStatus(p) === 'overdue'
  ).length;

  // ─── Status Badge ────────────────────────────────────────────────
  const StatusBadge: React.FC<{ status: 'borrowed' | 'returned' | 'overdue' }> = ({
    status,
  }) => {
    const config = {
      borrowed: {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        icon: Clock,
        label: 'Active',
      },
      returned: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: CheckCircle2,
        label: 'Returned',
      },
      overdue: {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
        icon: AlertTriangle,
        label: 'Overdue',
      },
    };
    const c = config[status];
    const Icon = c.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}
      >
        <Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <section className="max-w-[1920px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Borrowed &amp; Loaned Parts
            </h2>
            <p className="text-sm text-slate-400">
              Track parts borrowed from or loaned to others
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          disabled={!userId && !isDemoMode}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          New Transaction
        </button>
      </div>

      {/* ─── Reminder Banners ─────────────────────────────────────── */}
      {overdueItems.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-400 mb-1">
                {overdueItems.length} Overdue {overdueItems.length === 1 ? 'Item' : 'Items'}
              </h3>
              <div className="space-y-1">
                {overdueItems.slice(0, 5).map(item => {
                  const days = getDaysUntilDue(item);
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-red-300 font-medium truncate">{item.part_name}</span>
                      <span className="text-red-400/70">
                        {item.transaction_type === 'borrowed' ? 'from' : 'to'} {item.person_name}
                      </span>
                      {days !== null && (
                        <span className="text-red-400 font-semibold ml-auto flex-shrink-0">
                          {Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} overdue
                        </span>
                      )}
                    </div>
                  );
                })}
                {overdueItems.length > 5 && (
                  <p className="text-xs text-red-400/60 mt-1">+{overdueItems.length - 5} more overdue items</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {dueSoonItems.length > 0 && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-yellow-400 mb-1">
                {dueSoonItems.length} {dueSoonItems.length === 1 ? 'Item' : 'Items'} Due Within 3 Days
              </h3>
              <div className="space-y-1">
                {dueSoonItems.slice(0, 5).map(item => {
                  const days = getDaysUntilDue(item);
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                      <span className="text-yellow-300 font-medium truncate">{item.part_name}</span>
                      <span className="text-yellow-400/70">
                        {item.transaction_type === 'borrowed' ? 'from' : 'to'} {item.person_name}
                      </span>
                      <span className="text-yellow-400 font-semibold ml-auto flex-shrink-0">
                        {days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} left`}
                      </span>
                    </div>
                  );
                })}
                {dueSoonItems.length > 5 && (
                  <p className="text-xs text-yellow-400/60 mt-1">+{dueSoonItems.length - 5} more items due soon</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setActiveTab('borrowed');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'borrowed'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/10'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Borrowed From Others
          {parts.filter((p) => p.transaction_type === 'borrowed').length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 text-xs font-bold">
              {parts.filter((p) => p.transaction_type === 'borrowed').length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('loaned');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'loaned'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Loaned To Others
          {parts.filter((p) => p.transaction_type === 'loaned').length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs font-bold">
              {parts.filter((p) => p.transaction_type === 'loaned').length}
            </span>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{tabParts.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-400 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-400">{borrowedCount}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 mb-1">Returned</p>
          <p className="text-2xl font-bold text-emerald-400">{returnedCount}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-red-400 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by part name, number, or person..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-transparent text-sm text-white py-2.5 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-800">All Statuses</option>
              <option value="borrowed" className="bg-slate-800">Active</option>
              <option value="returned" className="bg-slate-800">Returned</option>
              <option value="overdue" className="bg-slate-800">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredParts.length === 0 && (
        <div className="text-center py-20 bg-slate-800/30 border border-slate-700/30 rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-800/60 rounded-2xl flex items-center justify-center">
            {activeTab === 'borrowed' ? (
              <ArrowDownToLine className="w-8 h-8 text-slate-500" />
            ) : (
              <ArrowUpFromLine className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {searchQuery || statusFilter !== 'all'
              ? 'No matching transactions'
              : activeTab === 'borrowed'
              ? 'No borrowed parts yet'
              : 'No loaned parts yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            {activeTab === 'borrowed'
              ? 'Track parts you\'ve borrowed from other teams or people. Keep tabs on what needs to be returned.'
              : 'Track parts you\'ve loaned to other teams or people. Never lose track of your equipment.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-purple-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add First {activeTab === 'borrowed' ? 'Borrowed' : 'Loaned'} Part
            </button>
          )}
        </div>
      )}

      {/* Parts List */}
      {!loading && filteredParts.length > 0 && (
        <div className="space-y-3">
          {filteredParts.map((part) => {
            const eff = effectiveStatus(part);
            const isExpanded = expandedId === part.id;
            const dueSoon = isDueSoon(part);
            const linkedItem = getLinkedInventoryItem(part.linked_inventory_id);
            const borderColor =
              eff === 'overdue'
                ? 'border-red-500/40'
                : dueSoon
                ? 'border-yellow-500/40'
                : eff === 'returned'
                ? 'border-emerald-500/30'
                : 'border-blue-500/30';
            const leftAccent =
              eff === 'overdue'
                ? 'bg-red-500'
                : dueSoon
                ? 'bg-yellow-500'
                : eff === 'returned'
                ? 'bg-emerald-500'
                : 'bg-blue-500';

            return (
              <div
                key={part.id}
                className={`bg-slate-800/60 border ${borderColor} rounded-xl overflow-hidden transition-all hover:bg-slate-800/80`}
              >
                <div className="flex">
                  <div className={`w-1 ${leftAccent} flex-shrink-0`} />
                  <div className="flex-1 p-4">
                    {/* Main Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-base font-semibold text-white truncate">
                            {part.part_name}
                          </h3>
                          {part.part_number && (
                            <span className="px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 text-xs font-mono">
                              #{part.part_number}
                            </span>
                          )}
                          <StatusBadge status={eff} />
                          {dueSoon && eff !== 'overdue' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              <Bell className="w-3 h-3" />
                              Due Soon
                            </span>
                          )}
                          {linkedItem && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              <Link2 className="w-3 h-3" />
                              Linked: {linkedItem.partNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {activeTab === 'borrowed' ? 'From:' : 'To:'}{' '}
                            <span className="text-slate-300 font-medium">
                              {part.person_name}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" />
                            Qty: {part.quantity}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(part.date_transaction).toLocaleDateString()}
                          </span>
                          {part.expected_return_date && (
                            <span
                              className={`flex items-center gap-1.5 ${
                                eff === 'overdue' ? 'text-red-400 font-medium' :
                                dueSoon ? 'text-yellow-400 font-medium' : ''
                              }`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Due:{' '}
                              {new Date(
                                part.expected_return_date
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {eff !== 'returned' && (
                          <button
                            onClick={() => handleMarkReturned(part)}
                            title="Mark as Returned"
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(part)}
                          title="Edit"
                          className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === part.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(part.id)}
                              className="px-2 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(part.id)}
                            title="Delete"
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : part.id)
                          }
                          className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {part.contact && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Contact</p>
                            <p className="text-sm text-slate-300 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {part.contact}
                            </p>
                          </div>
                        )}
                        {part.description && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Description
                            </p>
                            <p className="text-sm text-slate-300">
                              {part.description}
                            </p>
                          </div>
                        )}
                        {part.condition_out && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Condition When{' '}
                              {activeTab === 'borrowed' ? 'Borrowed' : 'Loaned'}
                            </p>
                            <p className="text-sm text-slate-300">
                              {part.condition_out}
                            </p>
                          </div>
                        )}
                        {part.condition_returned && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Condition When Returned
                            </p>
                            <p className="text-sm text-slate-300">
                              {part.condition_returned}
                            </p>
                          </div>
                        )}
                        {part.actual_return_date && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Actual Return Date
                            </p>
                            <p className="text-sm text-slate-300">
                              {new Date(
                                part.actual_return_date
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {linkedItem && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Linked Inventory</p>
                            <div className="flex items-center gap-2">
                              <Link2 className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-sm text-purple-300 font-medium">{linkedItem.description}</span>
                              <span className="text-xs text-slate-500">({linkedItem.partNumber})</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Current stock: <span className={`font-medium ${linkedItem.onHand === 0 ? 'text-red-400' : linkedItem.onHand <= linkedItem.minQuantity ? 'text-yellow-400' : 'text-green-400'}`}>{linkedItem.onHand}</span>
                            </p>
                          </div>
                        )}
                        {part.notes && (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <p className="text-xs text-slate-500 mb-1">Notes</p>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                              {part.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create / Edit Modal ──────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeTab === 'borrowed'
                      ? 'bg-blue-500/20'
                      : 'bg-amber-500/20'
                  }`}
                >
                  {activeTab === 'borrowed' ? (
                    <ArrowDownToLine className="w-5 h-5 text-blue-400" />
                  ) : (
                    <ArrowUpFromLine className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingPart ? 'Edit' : 'New'}{' '}
                  {activeTab === 'borrowed' ? 'Borrowed' : 'Loaned'} Part
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Type selector (only for new) */}
              {!editingPart && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Transaction Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('borrowed')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'borrowed'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                      }`}
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Borrowed
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('loaned')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'loaned'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                      }`}
                    >
                      <ArrowUpFromLine className="w-4 h-4" />
                      Loaned
                    </button>
                  </div>
                </div>
              )}

              {/* Link to Inventory */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-purple-400" />
                    Link to Inventory
                    <span className="text-xs text-slate-500 font-normal">(optional)</span>
                  </span>
                </label>
                <select
                  value={formData.linked_inventory_id}
                  onChange={(e) => handleInventoryLink(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                >
                  <option value="" className="bg-slate-800">No inventory link</option>
                  {partsInventory.map(item => (
                    <option key={item.id} value={item.id} className="bg-slate-800">
                      {item.partNumber} — {item.description} (Stock: {item.onHand})
                    </option>
                  ))}
                </select>
                {formData.linked_inventory_id && activeTab === 'loaned' && (
                  <p className="mt-1.5 text-xs text-purple-400 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Inventory will be reduced by {formData.quantity} when saved, and restored when returned.
                  </p>
                )}
                {formData.linked_inventory_id && activeTab === 'borrowed' && (
                  <p className="mt-1.5 text-xs text-blue-400 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Linked for reference only. Borrowed parts don't affect your inventory counts.
                  </p>
                )}
              </div>

              {/* Part Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Part Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.part_name}
                    onChange={(e) =>
                      setFormData({ ...formData, part_name: e.target.value })
                    }
                    placeholder="e.g., Torque Converter"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Part Number
                  </label>
                  <input
                    type="text"
                    value={formData.part_number}
                    onChange={(e) =>
                      setFormData({ ...formData, part_number: e.target.value })
                    }
                    placeholder="e.g., TC-4500"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of the part..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    {activeTab === 'borrowed'
                      ? 'Borrowed From'
                      : 'Loaned To'}{' '}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.person_name}
                    onChange={(e) =>
                      setFormData({ ...formData, person_name: e.target.value })
                    }
                    placeholder="Person or team name"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData({ ...formData, contact: e.target.value })
                    }
                    placeholder="Phone or email"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Date {activeTab === 'borrowed' ? 'Borrowed' : 'Loaned'}
                  </label>
                  <DateInputDark
                    value={formData.date_transaction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        date_transaction: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Expected Return Date
                  </label>
                  <DateInputDark
                    value={formData.expected_return_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expected_return_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Actual Return Date
                  </label>
                  <DateInputDark
                    value={formData.actual_return_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        actual_return_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
              </div>

              {/* Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Condition When{' '}
                    {activeTab === 'borrowed' ? 'Borrowed' : 'Loaned'}
                  </label>
                  <input
                    type="text"
                    value={formData.condition_out}
                    onChange={(e) =>
                      setFormData({ ...formData, condition_out: e.target.value })
                    }
                    placeholder="e.g., Good, Like New, Used"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Condition When Returned
                  </label>
                  <input
                    type="text"
                    value={formData.condition_returned}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition_returned: e.target.value,
                      })
                    }
                    placeholder="e.g., Good, Damaged"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['borrowed', 'returned', 'overdue'] as const).map((s) => {
                    const cfg = {
                      borrowed: {
                        label: 'Active',
                        active: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                        inactive: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
                      },
                      returned: {
                        label: 'Returned',
                        active:
                          'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                        inactive: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
                      },
                      overdue: {
                        label: 'Overdue',
                        active: 'bg-red-500/20 text-red-400 border-red-500/40',
                        inactive: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
                      },
                    };
                    const c = cfg[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, status: s })
                        }
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                          formData.status === s ? c.active : c.inactive
                        } hover:opacity-80`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.part_name.trim() ||
                  !formData.person_name.trim()
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingPart ? 'Update' : 'Save'} Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BorrowedLoanedParts;
