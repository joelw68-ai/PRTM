import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { MiscExpenseRowSchema } from '@/lib/validators';
import { uploadWithFallback, getStorageErrorMessage } from '@/lib/storageUpload';
import DateInputDark from '@/components/ui/DateInputDark';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCar } from '@/contexts/CarContext';
import CarDropdown from '@/components/race/CarDropdown';
import ReceiptScanner, { ScannedData } from '@/components/race/ReceiptScanner';
import ExpenseExportModal from '@/components/race/ExpenseExportModal';

import {
  Plus, X, Search, Trash2, Edit2, DollarSign, Calendar, Clock,
  CheckCircle2, AlertTriangle, Loader2, Receipt, CreditCard,
  FileImage, File, FileText, MoreVertical, Tag, Upload, Eye,
  Download, ExternalLink, BarChart3, Filter, ChevronDown, ChevronUp,
  Flag, Fuel, Car, Plane, Hotel, UtensilsCrossed, Shirt, Wrench,
  Ticket, Truck, ParkingCircle, HelpCircle, Users, TrendingUp,
  PieChart as PieChartIcon, Info, Scan, Camera
} from 'lucide-react';


// ===== TYPES =====
// Field names MUST match the exact misc_expenses DB columns:
// id (text), category (text), custom_description (text), amount (numeric),
// expense_date (text), paid_by (text), payment_method (text), receipt_url (text),
// receipt_file_name (text), receipt_file_type (text), receipt_file_size (integer),
// notes (text), race_event_id (text), linked_event_name (text),
// add_to_cost_report (boolean), user_id (uuid), car_id (text),
// created_at (timestamptz), updated_at (timestamptz)
interface MiscExpense {
  id: string;
  user_id?: string | null;
  car_id?: string | null;
  category: string;
  custom_description: string | null;
  amount: number;
  expense_date: string;
  paid_by: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  receipt_file_name: string | null;
  receipt_file_type: string | null;
  receipt_file_size: number | null;
  notes: string | null;
  race_event_id: string | null;
  linked_event_name: string | null;
  add_to_cost_report: boolean;
  created_at: string;
  updated_at: string;
}


type MiscExpenseSortField = 'date' | 'amount' | 'category';
type MiscExpenseSortDir = 'asc' | 'desc';

interface MiscExpenseDetailRow {
  label: string;
  value: string;
  color?: string;
}

interface MiscExpensesProps {
  currentRole?: string;
}


// ===== CONSTANTS =====
const EXPENSE_CATEGORIES = [
  { value: 'Fuel for Generators', label: 'Fuel for Generators', icon: Fuel },
  { value: 'Fuel for Support Vehicles', label: 'Fuel for Support Vehicles', icon: Car },
  { value: 'Rental Car', label: 'Rental Car', icon: Car },
  { value: 'Air Travel', label: 'Air Travel', icon: Plane },
  { value: 'Hotel and Lodging', label: 'Hotel and Lodging', icon: Hotel },
  { value: 'Food and Beverages', label: 'Food and Beverages', icon: UtensilsCrossed },
  { value: 'Apparel and Uniforms', label: 'Apparel and Uniforms', icon: Shirt },
  { value: 'Tools and Equipment', label: 'Tools and Equipment', icon: Wrench },
  { value: 'Entry Fees', label: 'Entry Fees', icon: Ticket },
  { value: 'Towing and Transport', label: 'Towing and Transport', icon: Truck },
  { value: 'Parking and Tolls', label: 'Parking and Tolls', icon: ParkingCircle },
  { value: 'Other', label: 'Other', icon: HelpCircle },
];

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Check', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  'Fuel for Generators': '#f97316',
  'Fuel for Support Vehicles': '#ea580c',
  'Rental Car': '#3b82f6',
  'Air Travel': '#8b5cf6',
  'Hotel and Lodging': '#06b6d4',
  'Food and Beverages': '#22c55e',
  'Apparel and Uniforms': '#ec4899',
  'Tools and Equipment': '#eab308',
  'Entry Fees': '#ef4444',
  'Towing and Transport': '#14b8a6',
  'Parking and Tolls': '#6366f1',
  'Other': '#64748b',
};

// ===== COMPONENT =====
const MiscExpenses: React.FC<MiscExpensesProps> = ({ currentRole }) => {
  const { raceEvents, teamMembers } = useApp();
  const { user } = useAuth();
  const { selectedCarId } = useCar();

  // Data state
  const [expenses, setExpenses] = useState<MiscExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<'list' | 'summary'>('list');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MiscExpense | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<MiscExpense | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Summary date range
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');

  // Form state — local field names, mapped to DB columns on save
  const [formData, setFormData] = useState({
    category: '',
    custom_description: '',
    amount: '',
    expense_date: getLocalDateString(),

    paid_by: '',
    payment_method: '',
    notes: '',
    race_event_id: '',
    add_to_cost_report: true,
    car_id: selectedCarId || '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter expenses by selected car — when no car selected show ALL; when car selected show matching + legacy (no car_id)
  const carFilteredExpenses = useMemo(() => {
    if (!selectedCarId || selectedCarId === '') return expenses;
    return expenses.filter(e => e.car_id === selectedCarId || !e.car_id || e.car_id === '');
  }, [expenses, selectedCarId]);

  // Helper: look up event name from raceEvents by race_event_id
  const getEventName = useCallback((eventId: string | null | undefined): string | null => {
    if (!eventId) return null;
    const event = raceEvents.find(e => e.id === eventId);
    return event?.title || null;
  }, [raceEvents]);


  // ===== DATA LOADING =====
  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 5000);
    try {
      const { data, error } = await supabase
        .from('misc_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) {
        console.error('Error loading misc expenses — full error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }
      setExpenses(parseRows(data, MiscExpenseRowSchema, 'misc_expenses') as MiscExpense[]);
    } catch (err) {
      console.error('Error loading misc expenses:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  // ===== FILE HANDLING =====
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF or image file (JPEG, PNG, WebP, GIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    setSelectedFile(file);
  };

  const uploadReceipt = async (file: File): Promise<{ url: string; type: string } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const result = await uploadWithFallback(file, fileName, file.type);
      if (!result.url) throw new Error('Upload failed');
      return { url: result.url, type: file.type };
    } catch (err: any) {
      console.error('Receipt upload error:', err);
      return null;
    }
  };

  // ===== FORM ACTIONS =====
  const resetForm = () => {
    setFormData({
      category: '',
      custom_description: '',
      amount: '',
      expense_date: getLocalDateString(),

      paid_by: '',
      payment_method: '',
      notes: '',
      race_event_id: '',
      add_to_cost_report: true,
      car_id: selectedCarId || '',
    });

    setSelectedFile(null);
    setEditingExpense(null);
    setShowScanner(false);
  };


  // ===== RECEIPT SCANNER HANDLER =====
  const handleScanComplete = useCallback((data: ScannedData, file: File) => {
    // Auto-populate form fields from scanned data
    setFormData(prev => ({
      ...prev,
      amount: data.amount || prev.amount,
      expense_date: data.date || prev.expense_date,
      // If vendor name was extracted, add it to notes
      notes: data.vendor
        ? (prev.notes ? `${prev.notes} | Vendor: ${data.vendor}` : `Vendor: ${data.vendor}`)
        : prev.notes,
    }));
    // Set the scanned image as the receipt file
    setSelectedFile(file);
    // Collapse the scanner after applying
    setShowScanner(false);
  }, []);



  const handleOpenAdd = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleOpenEdit = (expense: MiscExpense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      custom_description: expense.custom_description || '',
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      paid_by: expense.paid_by || '',
      payment_method: expense.payment_method || '',
      notes: expense.notes || '',
      race_event_id: expense.race_event_id || '',
      add_to_cost_report: expense.add_to_cost_report,
      car_id: expense.car_id || '',
    });
    setShowFormModal(true);
    setActionMenuId(null);
  };


  const handleSave = async () => {
    if (!formData.category) { alert('Please select a category'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { alert('Please enter a valid amount'); return; }
    if (!formData.expense_date) { alert('Please enter a date'); return; }
    if (formData.category === 'Other' && !formData.custom_description.trim()) { alert('Please enter a description for the "Other" category'); return; }

    setSaving(true);
    try {
      let receiptData: { url: string; type: string } | null = null;
      if (selectedFile) {
        receiptData = await uploadReceipt(selectedFile);
      }

      const amount = parseFloat(formData.amount);

      // Resolve linked event name for the linked_event_name DB column
      const linkedEventName = formData.race_event_id ? getEventName(formData.race_event_id) : null;

      // Build record with ONLY the exact DB column names.
      // Verified misc_expenses columns (19 total):
      //   id (text PK), category (text NOT NULL), custom_description (text),
      //   amount (numeric NOT NULL), expense_date (text NOT NULL),
      //   paid_by (text), payment_method (text),
      //   receipt_url (text), receipt_file_name (text), receipt_file_type (text), receipt_file_size (int),
      //   notes (text), race_event_id (text), linked_event_name (text),
      //   add_to_cost_report (boolean), user_id (uuid), car_id (text),
      //   created_at (timestamptz default now()), updated_at (timestamptz default now())
      const record: Record<string, any> = {
        category: formData.category,
        custom_description: formData.category === 'Other' ? formData.custom_description.trim() : null,
        amount,
        expense_date: formData.expense_date,
        paid_by: formData.paid_by || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        race_event_id: formData.race_event_id || null,
        linked_event_name: linkedEventName || null,
        add_to_cost_report: formData.add_to_cost_report,
        car_id: formData.car_id || null,
        updated_at: new Date().toISOString(),
      };

      // Include receipt fields if we have new receipt data
      if (receiptData) {
        record.receipt_url = receiptData.url;
        record.receipt_file_type = receiptData.type;
        record.receipt_file_name = selectedFile?.name || null;
        record.receipt_file_size = selectedFile?.size || null;
      }

      console.log('[MiscExpenses] handleSave — mode:', editingExpense ? 'UPDATE' : 'INSERT');
      console.log('[MiscExpenses] handleSave — payload keys:', Object.keys(record));
      console.log('[MiscExpenses] handleSave — full payload:', JSON.stringify(record, null, 2));
      console.log('[MiscExpenses] handleSave — user?.id:', user?.id || '(no user)');

      if (editingExpense) {
        // ── UPDATE existing expense ──
        console.log('[MiscExpenses] Updating expense id:', editingExpense.id);
        const { data: updateData, error, status, statusText } = await supabase
          .from('misc_expenses')
          .update(record)
          .eq('id', editingExpense.id)
          .select();
        if (error) {
          console.error('[MiscExpenses] Supabase UPDATE error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            status,
            statusText,
            payload: record,
          });
          throw new Error(`Database update failed: ${error.message}${error.hint ? ' (Hint: ' + error.hint + ')' : ''}`);
        }
        console.log('[MiscExpenses] Update successful, returned:', updateData);
      } else {
        // ── INSERT new expense ──
        const expenseId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        record.id = expenseId;
        // Set user_id if authenticated; leave null if in demo mode (RLS allows null)
        if (user?.id) {
          record.user_id = user.id;
        }

        console.log('[MiscExpenses] Inserting new expense with id:', expenseId, 'user_id:', record.user_id || '(null/demo)');
        const { data: insertData, error, status, statusText } = await supabase
          .from('misc_expenses')
          .insert(record)
          .select();
        if (error) {
          console.error('[MiscExpenses] Supabase INSERT error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            status,
            statusText,
            payloadKeys: Object.keys(record),
            payload: record,
          });
          throw new Error(`Database insert failed: ${error.message}${error.hint ? ' (Hint: ' + error.hint + ')' : ''}`);
        }
        console.log('[MiscExpenses] Insert successful, returned:', insertData);

        // Add to cost_reports if checked (non-blocking — errors here won't affect the expense save)
        if (formData.add_to_cost_report) {
          try {
            const displayCategory = formData.category === 'Other' ? (formData.custom_description.trim() || 'Other') : formData.category;
            // cost_reports columns: id (uuid), user_id (uuid), invoice_id (uuid),
            // vendor_name (text NOT NULL), amount (numeric), category (text),
            // date (text NOT NULL), description (text), source (text),
            // created_at (timestamptz), updated_at (timestamptz)
            const costReportEntry: Record<string, any> = {
              vendor_name: formData.paid_by || 'Misc Expense',
              amount,
              category: displayCategory,
              date: formData.expense_date,
              description: `${displayCategory}${formData.notes ? ' — ' + formData.notes : ''}${linkedEventName ? ' | Event: ' + linkedEventName : ''}`,
              source: 'misc_expense',
            };
            if (user?.id) costReportEntry.user_id = user.id;

            console.log('[MiscExpenses] Inserting cost_reports entry:', JSON.stringify(costReportEntry, null, 2));
            const { error: costError } = await supabase.from('cost_reports').insert(costReportEntry);
            if (costError) {
              console.warn('[MiscExpenses] Cost report insert warning (non-blocking):', {
                message: costError.message,
                details: costError.details,
                hint: costError.hint,
                code: costError.code,
              });
            } else {
              console.log('[MiscExpenses] Cost report entry created successfully');
            }
          } catch (costErr) {
            console.warn('[MiscExpenses] Cost report insert exception (non-blocking):', costErr);
          }
        }
      }

      await loadExpenses();
      resetForm();
      setShowFormModal(false);
    } catch (err: any) {
      console.error('[MiscExpenses] Error saving expense — caught exception:', err);
      console.error('[MiscExpenses] Error type:', typeof err, 'constructor:', err?.constructor?.name);
      console.error('[MiscExpenses] Error stack:', err?.stack);
      const detail = err?.message || err?.details || JSON.stringify(err) || 'Unknown error';
      alert(`Error saving expense: ${detail}`);
    } finally {
      setSaving(false);
    }
  };



  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const expense = expenses.find(e => e.id === id);
      if (expense?.receipt_url) {
        const path = expense.receipt_url.split('/media/')[1];
        if (path) await supabase.storage.from('media').remove([path]);
      }
      const { error } = await supabase.from('misc_expenses').delete().eq('id', id);
      if (error) {
        console.error('Supabase DELETE misc_expenses error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }
      await loadExpenses();
      setActionMenuId(null);
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  // ===== FILTERING & SORTING =====
  const filteredExpenses = useMemo(() => {
    let result = carFilteredExpenses.filter(exp => {
      const eventName = getEventName(exp.race_event_id) || '';
      const matchesSearch =
        exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.custom_description && exp.custom_description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (exp.paid_by && exp.paid_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (eventName && eventName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
      const matchesPayment = paymentFilter === 'all' || exp.payment_method === paymentFilter;
      const matchesEvent = eventFilter === 'all' || exp.race_event_id === eventFilter;
      return matchesSearch && matchesCategory && matchesPayment && matchesEvent;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date': cmp = new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime(); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [carFilteredExpenses, searchTerm, categoryFilter, paymentFilter, eventFilter, sortBy, sortDir, getEventName]);

  // ===== SUMMARY DATA =====
  const summaryData = useMemo(() => {
    let filtered = carFilteredExpenses;
    if (summaryStartDate) filtered = filtered.filter(e => e.expense_date >= summaryStartDate);
    if (summaryEndDate) filtered = filtered.filter(e => e.expense_date <= summaryEndDate);

    const totalAmount = filtered.reduce((s, e) => s + Number(e.amount), 0);

    const byCategory: Record<string, { total: number; count: number }> = {};
    filtered.forEach(e => {
      const key = e.category === 'Other' ? (e.custom_description || 'Other') : e.category;
      if (!byCategory[key]) byCategory[key] = { total: 0, count: 0 };
      byCategory[key].total += Number(e.amount);
      byCategory[key].count += 1;
    });
    const categoryBreakdown = Object.entries(byCategory)
      .map(([name, data]) => ({ name, ...data, pct: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    const byPayment: Record<string, number> = {};
    filtered.forEach(e => {
      const key = e.payment_method || 'Unspecified';
      byPayment[key] = (byPayment[key] || 0) + Number(e.amount);
    });

    const byEvent: Record<string, { total: number; count: number }> = {};
    filtered.forEach(e => {
      const key = getEventName(e.race_event_id) || 'Unlinked';
      if (!byEvent[key]) byEvent[key] = { total: 0, count: 0 };
      byEvent[key].total += Number(e.amount);
      byEvent[key].count += 1;
    });
    const eventBreakdown = Object.entries(byEvent)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    const byPaidBy: Record<string, number> = {};
    filtered.forEach(e => {
      const key = e.paid_by || 'Unspecified';
      byPaidBy[key] = (byPaidBy[key] || 0) + Number(e.amount);
    });
    const paidByBreakdown = Object.entries(byPaidBy)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return { totalAmount, count: filtered.length, categoryBreakdown, byPayment, eventBreakdown, paidByBreakdown };
  }, [carFilteredExpenses, summaryStartDate, summaryEndDate, getEventName]);

  // ===== STATS =====
  const stats = useMemo(() => {
    const base = carFilteredExpenses;
    const now = new Date();
    const thisMonth = base.filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonth = base.filter(e => {
      const d = new Date(e.expense_date);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });
    return {
      total: base.reduce((s, e) => s + Number(e.amount), 0),
      count: base.length,
      thisMonthTotal: thisMonth.reduce((s, e) => s + Number(e.amount), 0),
      thisMonthCount: thisMonth.length,
      lastMonthTotal: lastMonth.reduce((s, e) => s + Number(e.amount), 0),
      avgPerExpense: base.length > 0 ? base.reduce((s, e) => s + Number(e.amount), 0) / base.length : 0,
    };
  }, [carFilteredExpenses]);


  // ===== HELPERS =====
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = (category: string) => {
    const found = EXPENSE_CATEGORIES.find(c => c.value === category);
    return found ? found.icon : HelpCircle;
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || '#64748b';
  };

  const getDisplayCategory = (exp: MiscExpense) => {
    if (exp.category === 'Other' && exp.custom_description) return exp.custom_description;
    return exp.category;
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="w-5 h-5" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  // Unique events used in expenses for filter dropdown
  const usedEvents = useMemo(() => {
    const map = new Map<string, string>();
    expenses.forEach(e => {
      if (e.race_event_id) {
        const name = getEventName(e.race_event_id);
        if (name) map.set(e.race_event_id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [expenses, getEventName]);

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Receipt className="w-7 h-7 text-orange-500" />
              Miscellaneous Expenses
            </h2>
            <p className="text-slate-400">Track fuel, travel, lodging, entry fees, and other race-day expenses</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={expenses.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed border border-slate-600"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> Add Expense
            </button>
          </div>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Expenses</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(stats.total)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Entries</p>
                <p className="text-xl font-bold text-white">{stats.count}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-4 border border-orange-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">This Month</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(stats.thisMonthTotal)}</p>
                <p className="text-xs text-slate-500">{stats.thisMonthCount} entries</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Avg per Expense</p>
                <p className="text-xl font-bold text-white">{formatCurrency(stats.avgPerExpense)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'list' as const, label: 'Expense List', icon: Receipt },
            { id: 'summary' as const, label: 'Summary & Reports', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== LIST TAB ===== */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
                />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                <option value="all">All Payment Methods</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {usedEvents.length > 0 && (
                <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                  <option value="all">All Events</option>
                  {usedEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              )}
              <select
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => { const [f, d] = e.target.value.split('-'); setSortBy(f as MiscExpenseSortField); setSortDir(d as MiscExpenseSortDir); }}

                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="category-asc">Category A-Z</option>
              </select>
            </div>

            {/* Expense List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <span className="ml-3 text-slate-400">Loading expenses...</span>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-400 mb-2">
                  {expenses.length === 0 ? 'No Expenses Yet' : 'No Matching Expenses'}
                </h3>
                <p className="text-slate-500 mb-6">
                  {expenses.length === 0 ? 'Add your first miscellaneous expense to start tracking.' : 'Try adjusting your search or filters.'}
                </p>
                {expenses.length === 0 && (
                  <button onClick={handleOpenAdd} className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
                    <Plus className="w-5 h-5" /> Add First Expense
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map(expense => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  const color = getCategoryColor(expense.category);
                  const eventName = getEventName(expense.race_event_id);
                  return (
                    <div key={expense.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:bg-slate-800/70 transition-all">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                              <CategoryIcon className="w-5 h-5" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h4 className="text-white font-semibold">{getDisplayCategory(expense)}</h4>
                                {expense.payment_method && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                    {expense.payment_method}
                                  </span>
                                )}
                                {expense.receipt_url && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                    Receipt
                                  </span>
                                )}
                                {expense.add_to_cost_report && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/15 text-green-400 border border-green-500/20">
                                    In Cost Report
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm flex-wrap">
                                <span className="text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(expense.expense_date).toLocaleDateString()}
                                </span>
                                {expense.paid_by && (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    {expense.paid_by}
                                  </span>
                                )}
                              </div>
                              {eventName && (
                                <div className="mt-1.5">
                                  <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded border border-blue-500/20 flex items-center gap-1 w-fit">
                                    <Flag className="w-3 h-3" />{eventName}
                                  </span>
                                </div>
                              )}
                              {expense.notes && (
                                <p className="mt-1 text-sm text-slate-500 truncate">{expense.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-400">{formatCurrency(expense.amount)}</p>
                            </div>
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuId(actionMenuId === expense.id ? null : expense.id)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {actionMenuId === expense.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
                                  <div className="absolute right-0 mt-1 w-44 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
                                    <button onClick={() => { setSelectedExpense(expense); setShowDetailModal(true); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                      <Eye className="w-4 h-4" /> View Details
                                    </button>
                                    {expense.receipt_url && (
                                      <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                        <Download className="w-4 h-4" /> Download Receipt
                                      </a>
                                    )}
                                    <button onClick={() => handleOpenEdit(expense)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                      <Edit2 className="w-4 h-4" /> Edit
                                    </button>
                                    <div className="border-t border-slate-700 my-1" />
                                    <button onClick={() => handleDelete(expense.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700">
                                      <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* List Total */}
                <div className="bg-slate-800/80 rounded-xl border border-slate-700/50 p-4 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">
                    Showing {filteredExpenses.length} of {expenses.length} expenses
                  </span>
                  <span className="text-green-400 font-bold text-lg">
                    Total: {formatCurrency(filteredExpenses.reduce((s, e) => s + Number(e.amount), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== SUMMARY TAB ===== */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-orange-400" />
                Date Range Filter
              </h3>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                  <DateInputDark
                    value={summaryStartDate}
                    onChange={(e) => setSummaryStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">End Date</label>
                  <DateInputDark
                    value={summaryEndDate}
                    onChange={(e) => setSummaryEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <button
                  onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); }}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Clear
                </button>
              </div>
              <p className="text-slate-400 text-sm mt-3">
                Showing {summaryData.count} expenses{summaryStartDate || summaryEndDate ? ' (filtered)' : ''}.
                Total: <span className="text-green-400 font-bold">{formatCurrency(summaryData.totalAmount)}</span>
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-5 border border-green-500/30">
                <p className="text-slate-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(summaryData.totalAmount)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-5 border border-blue-500/30">
                <p className="text-slate-400 text-sm">Expense Entries</p>
                <p className="text-2xl font-bold text-white">{summaryData.count}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl p-5 border border-orange-500/30">
                <p className="text-slate-400 text-sm">Categories Used</p>
                <p className="text-2xl font-bold text-white">{summaryData.categoryBreakdown.length}</p>
              </div>
            </div>

            {/* Export Reports Bar */}
            {expenses.length > 0 && (
              <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Download className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-sm">Export Reports</h4>
                      <p className="text-xs text-slate-500">Download CSV, PDF summary, per-event, or monthly statement</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" /> Export Expenses
                  </button>
                </div>
              </div>
            )}

            {summaryData.count === 0 ? (

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
                <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Expense Data</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Add expenses to see category breakdowns and spending summaries here.
                </p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* By Category */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-orange-400" />
                    Totals by Category
                  </h4>
                  <div className="space-y-3">
                    {summaryData.categoryBreakdown.map((cat) => {
                      const color = getCategoryColor(cat.name) || '#64748b';
                      return (
                        <div key={cat.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-white truncate">{cat.name}</span>
                            <span className="text-xs text-slate-500">({cat.count})</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-24 bg-slate-700 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${cat.pct}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-green-400 font-medium w-28 text-right">{formatCurrency(cat.total)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By Event */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Flag className="w-5 h-5 text-blue-400" />
                    Totals by Race Event
                  </h4>
                  {summaryData.eventBreakdown.length === 0 ? (
                    <p className="text-slate-500 text-sm">No expenses linked to events yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {summaryData.eventBreakdown.map((ev, idx) => (
                        <div key={ev.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-700 text-slate-300 flex-shrink-0">
                              {idx + 1}
                            </div>
                            <span className="text-white truncate">{ev.name}</span>
                            <span className="text-xs text-slate-500">({ev.count})</span>
                          </div>
                          <span className="text-green-400 font-medium flex-shrink-0">{formatCurrency(ev.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* By Person */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Totals by Person
                  </h4>
                  <div className="space-y-3">
                    {summaryData.paidByBreakdown.map((p) => (
                      <div key={p.name} className="flex items-center justify-between">
                        <span className="text-white">{p.name}</span>
                        <span className="text-green-400 font-medium">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* By Payment Method */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-cyan-400" />
                    Totals by Payment Method
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(summaryData.byPayment).sort(([,a], [,b]) => b - a).map(([method, total]) => (
                      <div key={method} className="flex items-center justify-between">
                        <span className="text-white">{method}</span>
                        <span className="text-green-400 font-medium">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ADD / EDIT MODAL ===== */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-orange-400" />
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </h3>
                <button onClick={() => { setShowFormModal(false); resetForm(); }} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>


              {/* ===== OCR Receipt Scanner ===== */}
              {!editingExpense && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowScanner(!showScanner)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      showScanner
                        ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                        : 'bg-gradient-to-r from-violet-600/20 to-blue-600/20 text-violet-300 border border-violet-500/20 hover:border-violet-500/40 hover:from-violet-600/30 hover:to-blue-600/30'
                    }`}
                  >
                    <Scan className="w-5 h-5" />
                    {showScanner ? 'Hide Receipt Scanner' : 'Scan Receipt with OCR'}
                    <span className="text-xs px-2 py-0.5 bg-violet-500/20 rounded-full text-violet-300 ml-1">AI</span>
                    {showScanner ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                  </button>

                  {showScanner && (
                    <div className="mt-3">
                      <ReceiptScanner
                        onScanComplete={handleScanComplete}
                        onCancel={() => setShowScanner(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Divider between scanner and form */}
              {!editingExpense && (
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Expense Details</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
              )}

              <div className="space-y-4">
                {/* Car Assignment */}
                <CarDropdown
                  value={formData.car_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, car_id: val }))}
                  label="Assign to Car"
                />


                {/* Category */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Expense Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom description for "Other" */}
                {formData.category === 'Other' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Custom Description *</label>
                    <input
                      type="text"
                      value={formData.custom_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_description: e.target.value }))}
                      placeholder="Describe the expense..."
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                )}

                {/* Amount & Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Date *</label>
                    <DateInputDark
                      value={formData.expense_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                {/* Paid By & Payment Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Paid By</label>
                    <select
                      value={formData.paid_by}
                      onChange={(e) => setFormData(prev => ({ ...prev, paid_by: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select person...</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                      ))}
                      {teamMembers.length === 0 && (
                        <option value="Owner">Owner</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select method...</option>
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Link to Race Event */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                    <Flag className="w-3.5 h-3.5 text-blue-400" /> Link to Race Event
                  </label>
                  <select
                    value={formData.race_event_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, race_event_id: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">None</option>
                    {raceEvents.map(e => (
                      <option key={e.id} value={e.id}>{e.title} ({new Date(e.startDate).toLocaleDateString()})</option>
                    ))}
                  </select>
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Receipt (Optional — PDF or Image)</label>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      dragActive ? 'border-orange-500 bg-orange-500/10' :
                      selectedFile ? 'border-green-500/50 bg-green-500/5' :
                      'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                      onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        {getFileIcon(selectedFile.type)}
                        <div className="text-left">
                          <p className="text-white font-medium text-sm">{selectedFile.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="ml-2 p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : editingExpense?.receipt_url ? (
                      <div className="flex flex-col items-center gap-1">
                        {getFileIcon(editingExpense.receipt_file_type)}
                        <p className="text-slate-300 text-sm">Current receipt attached</p>
                        <p className="text-slate-500 text-xs">Drop a new file to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-6 h-6 text-slate-500" />
                        <p className="text-slate-300 text-sm">Drag & drop or click to browse</p>
                        <p className="text-slate-500 text-xs">PDF, JPEG, PNG — max 10MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Additional notes..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none"
                  />
                </div>

                {/* Add to Cost Report */}
                {!editingExpense && (
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <input
                      type="checkbox"
                      id="expAddToCostReport"
                      checked={formData.add_to_cost_report}
                      onChange={(e) => setFormData(prev => ({ ...prev, add_to_cost_report: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-orange-500 cursor-pointer"
                    />
                    <label htmlFor="expAddToCostReport" className="flex-1 cursor-pointer">
                      <span className="text-white font-medium text-sm">Add to Cost Report</span>
                      <p className="text-xs text-slate-400">Automatically include this expense in the Cost Reports tab for unified tracking</p>
                    </label>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowFormModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.category || !formData.amount || !formData.expense_date}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <>{editingExpense ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingExpense ? 'Save Changes' : 'Add Expense'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== DETAIL MODAL ===== */}
        {showDetailModal && selectedExpense && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-orange-400" />
                  Expense Details
                </h3>
                <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-green-400">{formatCurrency(selectedExpense.amount)}</p>
                <p className="text-slate-400 mt-1">{getDisplayCategory(selectedExpense)}</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'Category', value: getDisplayCategory(selectedExpense) },
                  { label: 'Date', value: new Date(selectedExpense.expense_date).toLocaleDateString() },
                  ...(selectedExpense.paid_by ? [{ label: 'Paid By', value: selectedExpense.paid_by }] : []),
                  ...(selectedExpense.payment_method ? [{ label: 'Payment Method', value: selectedExpense.payment_method }] : []),
                  { label: 'In Cost Report', value: selectedExpense.add_to_cost_report ? 'Yes' : 'No', color: selectedExpense.add_to_cost_report ? 'text-green-400' : 'text-slate-400' },
                  ...(selectedExpense.receipt_url ? [{ label: 'Receipt', value: 'Attached' }] : []),
                ].map((row: MiscExpenseDetailRow, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">{row.label}</span>
                    <span className={`text-sm font-medium ${row.color || 'text-white'}`}>{row.value}</span>
                  </div>

                ))}
              </div>

              {(() => {
                const eventName = getEventName(selectedExpense.race_event_id);
                return eventName ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Linked To</p>
                    <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Flag className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-300 text-sm font-medium">{eventName}</span>
                      <span className="text-xs text-slate-500 ml-auto">Race Event</span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Receipt Preview */}
              {selectedExpense.receipt_url && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Receipt</p>
                  {selectedExpense.receipt_file_type?.startsWith('image/') ? (
                    <img src={selectedExpense.receipt_url} alt="Receipt" className="max-w-full max-h-64 object-contain rounded-lg mx-auto" />
                  ) : selectedExpense.receipt_file_type === 'application/pdf' ? (
                    <iframe src={selectedExpense.receipt_url} className="w-full h-64 rounded-lg" title="Receipt PDF" />
                  ) : null}
                  <a
                    href={selectedExpense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 mt-2 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Full Size
                  </a>
                </div>
              )}

              {selectedExpense.notes && (
                <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-300">{selectedExpense.notes}</p>
                </div>
              )}

              {/* Audit */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>Created: {new Date(selectedExpense.created_at).toLocaleString()}</span>
                </div>
                {selectedExpense.updated_at !== selectedExpense.created_at && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Edit2 className="w-3 h-3" />
                    <span>Updated: {new Date(selectedExpense.updated_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => { handleOpenEdit(selectedExpense); setShowDetailModal(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { handleDelete(selectedExpense.id); setShowDetailModal(false); }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 border border-red-500/30"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== EXPORT MODAL ===== */}
        <ExpenseExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          expenses={expenses}
          teamName={teamMembers?.[0]?.name ? `${teamMembers[0].name}'s Team` : 'Race Team'}
        />

      </div>
    </section>
  );

};

export default MiscExpenses;
