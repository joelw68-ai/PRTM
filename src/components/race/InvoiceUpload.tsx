import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';


import { supabase } from '@/lib/supabase';
import { uploadWithFallback, getStorageErrorMessage } from '@/lib/storageUpload';
import { parseRows } from '@/lib/validatedQuery';
import { VendorInvoiceRowSchema, InvoiceLineItemRowSchema } from '@/lib/validators';
import DateInputDark from '@/components/ui/DateInputDark';
import InvoiceLineItemsEditor, { InvoiceLineItem } from './InvoiceLineItemsEditor';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCar } from '@/contexts/CarContext';
import CarDropdown from '@/components/race/CarDropdown';

import {
  Upload, FileText, Search, Plus, X, Eye, Download, Trash2, Edit2,
  DollarSign, Calendar, Building2, Clock, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, ExternalLink, Receipt, CreditCard,
  FileImage, File, MoreVertical, Tag, Info, ShieldAlert, Package,
  Link2, Wrench, Flag, ClipboardList, UserPlus, History, ArrowRight
} from 'lucide-react';
import { Vendor } from '@/data/vendorData';

interface Invoice {
  id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  tax: number;
  total: number;
  status: 'Pending' | 'Approved' | 'Paid' | 'Overdue' | 'Disputed';
  po_number: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  category: string | null;
  payment_method: string | null;
  payment_date: string | null;
  linked_event_id: string | null;
  linked_event_name: string | null;
  linked_work_order_id: string | null;
  linked_work_order_title: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceUploadProps {
  vendors: Vendor[];
  currentRole?: string;
}

type UploadWarning = {
  type: 'edge' | 'dataurl' | 'failed';
  message: string;
  fileName: string;
} | null;

type InvoiceSortField = 'date' | 'amount' | 'due' | 'vendor';
type InvoiceSortDir = 'asc' | 'desc';

interface InvoiceDetailRow {
  label: string;
  value: string;
  color?: string;
}


const InvoiceUpload: React.FC<InvoiceUploadProps> = ({ vendors, currentRole }) => {
  // Context
  const { partsInventory, addPartInventory, updatePartInventory, raceEvents, workOrders } = useApp();
  const { user } = useAuth();

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'due' | 'vendor'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<UploadWarning>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Line items for detail modal
  const [detailLineItems, setDetailLineItems] = useState<any[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    vendor_id: '',
    vendor_name: '',
    invoice_number: '',
    invoice_date: getLocalDateString(),

    due_date: '',
    amount: 0,
    tax: 0,
    total: 0,
    status: 'Pending' as Invoice['status'],
    po_number: '',
    notes: '',
    category: '',
    payment_method: '',
    linked_event_id: '',
    linked_work_order_id: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [addToCostReport, setAddToCostReport] = useState(true);
  const [autoCreateInventory, setAutoCreateInventory] = useState(true);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // New vendor inline creation
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState('Parts Supplier');

  // Inventory creation results
  const [inventoryResults, setInventoryResults] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  // Load invoices
  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    setLoading(true);
    const safetyTimeout = setTimeout(() => { setLoading(false); }, 5000);
    try {
      const { data, error } = await supabase
        .from('vendor_invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(parseRows(data, VendorInvoiceRowSchema, 'vendor_invoices') as Invoice[]);

    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  // Load line items for detail modal
  const loadLineItems = async (invoiceId: string) => {
    setLoadingLineItems(true);
    try {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setDetailLineItems(parseRows(data, InvoiceLineItemRowSchema, 'invoice_line_items'));

    } catch (err) {
      console.error('Error loading line items:', err);
      setDetailLineItems([]);
    } finally {
      setLoadingLineItems(false);
    }
  };

  // Auto-calculate total from line items
  useEffect(() => {
    if (lineItems.length > 0) {
      const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
      setNewInvoice(prev => ({
        ...prev,
        amount: subtotal,
        total: subtotal + prev.tax
      }));
    } else {
      setNewInvoice(prev => ({
        ...prev,
        total: prev.amount + prev.tax
      }));
    }
  }, [lineItems, newInvoice.tax]);

  // Recalculate total when amount changes (only if no line items)
  useEffect(() => {
    if (lineItems.length === 0) {
      setNewInvoice(prev => ({ ...prev, total: prev.amount + prev.tax }));
    }
  }, [newInvoice.amount]);

  // File handling
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

  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string; size: number } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `invoices/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const result = await uploadWithFallback(file, fileName, file.type);
      if (!result.url) throw new Error('Upload failed');

      if (result.method === 'edge') {
        setUploadWarning({ type: 'edge', fileName: file.name, message: 'File uploaded via edge function fallback.' });
      } else if (result.method === 'dataurl') {
        setUploadWarning({ type: 'dataurl', fileName: file.name, message: 'File saved as embedded data URL.' });
      } else {
        setUploadWarning(null);
      }

      return { url: result.url, name: file.name, type: file.type, size: file.size };
    } catch (err: any) {
      const friendlyMessage = getStorageErrorMessage(err);
      setUploadWarning({ type: 'failed', fileName: file.name, message: `Upload failed: ${friendlyMessage}` });
      return null;
    }
  };

  // Create new vendor inline
  const handleCreateVendor = async (): Promise<string | null> => {
    if (!newVendorName.trim()) return null;
    try {
      const vendorId = `VENDOR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const vendorCode = newVendorName.trim().substring(0, 4).toUpperCase().replace(/\s/g, '');
      const payload: any = {
        id: vendorId,
        name: newVendorName.trim(),
        code: vendorCode,
        category: newVendorCategory,
        is_active: true,
        created_date: getLocalDateString(),

        updated_at: new Date().toISOString()
      };
      if (user?.id) payload.user_id = user.id;

      const { error } = await supabase.from('setup_vendors').upsert(payload);
      if (error) throw error;

      setNewInvoice(prev => ({ ...prev, vendor_id: vendorId, vendor_name: newVendorName.trim() }));
      setShowNewVendor(false);
      setNewVendorName('');
      return vendorId;
    } catch (err) {
      console.error('Error creating vendor:', err);
      alert('Failed to create vendor. Please try again.');
      return null;
    }
  };

  // Auto-create or update inventory entries from line items
  const processLineItemsInventory = async (invoiceId: string): Promise<{ created: number; updated: number; errors: string[] }> => {
    const results = { created: 0, updated: 0, errors: [] as string[] };
    if (!autoCreateInventory || lineItems.length === 0) return results;

    for (const item of lineItems) {
      if (!item.description.trim()) continue;

      try {
        if (item.matchedInventoryId) {
          // Update existing inventory item
          const existing = partsInventory.find(p => p.id === item.matchedInventoryId);
          if (existing) {
            await updatePartInventory(existing.id, {
              onHand: existing.onHand + item.quantity,
              unitCost: item.unitCost > 0 ? item.unitCost : existing.unitCost,
              totalValue: (existing.onHand + item.quantity) * (item.unitCost > 0 ? item.unitCost : existing.unitCost),
              lastOrdered: newInvoice.invoice_date,
              vendor: newInvoice.vendor_name || existing.vendor,
              vendorPartNumber: item.vendorPartNumber || existing.vendorPartNumber,
              status: 'In Stock',
              reorderStatus: (existing.onHand + item.quantity) <= existing.minQuantity ? 'Reorder' : 'OK',
              notes: `${existing.notes ? existing.notes + '\n' : ''}Updated from invoice ${newInvoice.invoice_number} on ${new Date().toLocaleDateString()}`
            });
            results.updated++;
          }
        } else if (item.partNumber.trim() || item.description.trim()) {
          // Create new inventory entry
          const newPartId = `PART-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          await addPartInventory({
            id: newPartId,
            partNumber: item.partNumber || `INV-${newInvoice.invoice_number}-${results.created + 1}`,
            description: item.description,
            category: item.category || newInvoice.category || 'Other',
            subcategory: '',
            onHand: item.quantity,
            minQuantity: 1,
            maxQuantity: item.quantity * 3,
            vendor: newInvoice.vendor_name,
            vendorPartNumber: item.vendorPartNumber,
            unitCost: item.unitCost,
            totalValue: item.total,
            lastOrdered: newInvoice.invoice_date,
            lastUsed: '',
            location: '',
            notes: `Auto-created from invoice ${newInvoice.invoice_number}`,
            status: 'In Stock',
            reorderStatus: 'OK'
          });

          // Save the auto-created inventory ID back to the line item record
          try {
            await supabase.from('invoice_line_items').update({
              auto_created_inventory_id: newPartId
            }).eq('id', item.id);
          } catch {} // non-critical

          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`${item.description}: ${err.message || 'Unknown error'}`);
      }
    }
    return results;
  };

  // Save line items to database
  const saveLineItems = async (invoiceId: string) => {
    if (lineItems.length === 0) return;
    for (const item of lineItems) {
      try {
        const payload: any = {
          id: item.id,
          invoice_id: invoiceId,
          part_number: item.partNumber || null,
          description: item.description,
          category: item.category || null,
          quantity: item.quantity,
          unit_cost: item.unitCost,
          total: item.total,
          vendor_part_number: item.vendorPartNumber || null,
          notes: item.notes || null,
          auto_created_inventory_id: item.matchedInventoryId || null,
          updated_at: new Date().toISOString()
        };
        if (user?.id) payload.user_id = user.id;
        await supabase.from('invoice_line_items').upsert(payload);
      } catch (err) {
        console.error('Error saving line item:', err);
      }
    }
  };

  const handleSaveInvoice = async () => {
    if (!newInvoice.vendor_id && !showNewVendor) {
      alert('Please select or create a vendor');
      return;
    }
    if (!newInvoice.invoice_number) {
      alert('Please enter an invoice number');
      return;
    }

    setUploading(true);
    setUploadWarning(null);
    setInventoryResults(null);

    try {
      // Create new vendor if needed
      if (showNewVendor && newVendorName.trim()) {
        const vendorId = await handleCreateVendor();
        if (!vendorId) { setUploading(false); return; }
      }

      let fileData = null;
      if (selectedFile) {
        fileData = await uploadFile(selectedFile);
      }

      // Get linked names
      const linkedEvent = raceEvents.find(e => e.id === newInvoice.linked_event_id);
      const linkedWO = workOrders.find(w => w.id === newInvoice.linked_work_order_id);

      const invoiceRecord: any = {
        vendor_id: newInvoice.vendor_id,
        vendor_name: newInvoice.vendor_name,
        invoice_number: newInvoice.invoice_number,
        invoice_date: newInvoice.invoice_date,
        due_date: newInvoice.due_date || null,
        amount: newInvoice.amount,
        tax: newInvoice.tax,
        total: newInvoice.total,
        status: newInvoice.status,
        po_number: newInvoice.po_number || null,
        notes: newInvoice.notes || null,
        category: newInvoice.category || null,
        payment_method: newInvoice.payment_method || null,
        file_url: fileData?.url || null,
        file_name: fileData?.name || null,
        file_type: fileData?.type || null,
        file_size: fileData?.size || null,
        linked_event_id: newInvoice.linked_event_id || null,
        linked_event_name: linkedEvent?.title || null,
        linked_work_order_id: newInvoice.linked_work_order_id || null,
        linked_work_order_title: linkedWO?.title || null,
      };

      let savedInvoiceId: string;

      if (editingInvoice) {
        const { error } = await supabase
          .from('vendor_invoices')
          .update({ ...invoiceRecord, updated_at: new Date().toISOString() })
          .eq('id', editingInvoice.id);
        if (error) throw error;
        savedInvoiceId = editingInvoice.id;

        // Delete old line items and re-save
        await supabase.from('invoice_line_items').delete().eq('invoice_id', editingInvoice.id);
      } else {
        const { data: insertedData, error } = await supabase
          .from('vendor_invoices')
          .insert(invoiceRecord)
          .select('id')
          .single();
        if (error) throw error;
        savedInvoiceId = insertedData.id;

        // Cost report
        if (addToCostReport) {
          const costReportEntry = {
            invoice_id: savedInvoiceId,
            vendor_name: newInvoice.vendor_name,
            amount: newInvoice.total,
            category: newInvoice.category || null,
            date: newInvoice.invoice_date,
            description: `Invoice ${newInvoice.invoice_number} from ${newInvoice.vendor_name}${newInvoice.notes ? ' — ' + newInvoice.notes : ''}`,
            source: 'invoice'
          };
          const { error: costError } = await supabase.from('cost_reports').insert(costReportEntry);
          if (costError) console.error('Cost report error:', costError);
        }
      }

      // Save line items
      await saveLineItems(savedInvoiceId);

      // Auto-create/update inventory
      const invResults = await processLineItemsInventory(savedInvoiceId);
      if (invResults.created > 0 || invResults.updated > 0) {
        setInventoryResults(invResults);
      }

      await loadInvoices();
      resetForm();
      setShowUploadModal(false);
    } catch (err) {
      console.error('Error saving invoice:', err);
      alert('Error saving invoice. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice and all its line items?')) return;
    try {
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice?.file_url) {
        const path = invoice.file_url.split('/media/')[1];
        if (path) await supabase.storage.from('media').remove([path]);
      }
      await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
      const { error } = await supabase.from('vendor_invoices').delete().eq('id', id);
      if (error) throw error;
      await loadInvoices();
      setActionMenuId(null);
    } catch (err) {
      console.error('Error deleting invoice:', err);
    }
  };

  const handleUpdateStatus = async (id: string, status: Invoice['status']) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'Paid') updates.payment_date = getLocalDateString();

      const { error } = await supabase.from('vendor_invoices').update(updates).eq('id', id);
      if (error) throw error;
      await loadInvoices();
      setActionMenuId(null);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setNewInvoice({
      vendor_id: invoice.vendor_id,
      vendor_name: invoice.vendor_name,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      amount: invoice.amount,
      tax: invoice.tax,
      total: invoice.total,
      status: invoice.status,
      po_number: invoice.po_number || '',
      notes: invoice.notes || '',
      category: invoice.category || '',
      payment_method: invoice.payment_method || '',
      linked_event_id: invoice.linked_event_id || '',
      linked_work_order_id: invoice.linked_work_order_id || '',
    });
    // Load existing line items for editing
    loadEditLineItems(invoice.id);
    setShowUploadModal(true);
    setActionMenuId(null);
  };

  const loadEditLineItems = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const validated = parseRows(data, InvoiceLineItemRowSchema, 'invoice_line_items');
        setLineItems(validated.map((row: any) => ({

          id: row.id,
          partNumber: row.part_number || '',
          description: row.description || '',
          category: row.category || '',
          quantity: row.quantity || 1,
          unitCost: parseFloat(row.unit_cost) || 0,
          total: parseFloat(row.total) || 0,
          vendorPartNumber: row.vendor_part_number || '',
          notes: row.notes || '',
          matchedInventoryId: row.auto_created_inventory_id || undefined,
        })));
      }
    } catch (err) {
      console.error('Error loading edit line items:', err);
    }
  };

  const resetForm = () => {
    setNewInvoice({
      vendor_id: '', vendor_name: '', invoice_number: '',
      invoice_date: getLocalDateString(),

      due_date: '', amount: 0, tax: 0, total: 0,
      status: 'Pending', po_number: '', notes: '', category: '',
      payment_method: '', linked_event_id: '', linked_work_order_id: '',
    });
    setSelectedFile(null);
    setEditingInvoice(null);
    setAddToCostReport(true);
    setAutoCreateInventory(true);
    setLineItems([]);
    setShowNewVendor(false);
    setNewVendorName('');
  };

  // Filter and sort
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => {
      const matchesSearch =
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.po_number && inv.po_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.linked_event_name && inv.linked_event_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.linked_work_order_title && inv.linked_work_order_title.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchesVendor = vendorFilter === 'all' || inv.vendor_id === vendorFilter;
      return matchesSearch && matchesStatus && matchesVendor;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date': comparison = parseLocalDate(a.invoice_date).getTime() - parseLocalDate(b.invoice_date).getTime(); break;
        case 'amount': comparison = a.total - b.total; break;
        case 'due':
          const dateA = a.due_date ? parseLocalDate(a.due_date).getTime() : Infinity;
          const dateB = b.due_date ? parseLocalDate(b.due_date).getTime() : Infinity;
          comparison = dateA - dateB; break;

        case 'vendor': comparison = a.vendor_name.localeCompare(b.vendor_name); break;
      }
      return sortDir === 'desc' ? -comparison : comparison;
    });
    return result;
  }, [invoices, searchTerm, statusFilter, vendorFilter, sortBy, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const pending = invoices.filter(i => i.status === 'Pending');
    const overdue = invoices.filter(i => {
      if (i.status === 'Paid') return false;
      if (!i.due_date) return false;
      return parseLocalDate(i.due_date) < now;
    });
    const paid = invoices.filter(i => i.status === 'Paid');
    const thisMonth = invoices.filter(i => {
      const d = parseLocalDate(i.invoice_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

    });
    return {
      totalInvoices: invoices.length,
      pendingCount: pending.length, pendingAmount: pending.reduce((s, i) => s + i.total, 0),
      overdueCount: overdue.length, overdueAmount: overdue.reduce((s, i) => s + i.total, 0),
      paidCount: paid.length, paidAmount: paid.reduce((s, i) => s + i.total, 0),
      thisMonthCount: thisMonth.length, thisMonthAmount: thisMonth.reduce((s, i) => s + i.total, 0),
      totalAmount: invoices.reduce((s, i) => s + i.total, 0)
    };
  }, [invoices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Approved': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Paid': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Overdue': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Disputed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="w-5 h-5" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'Paid') return false;
    if (!invoice.due_date) return false;
    return parseLocalDate(invoice.due_date) < new Date();
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const diff = Math.ceil((parseLocalDate(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };


  return (
    <div className="space-y-6">
      {/* Inventory Results Banner */}
      {inventoryResults && (inventoryResults.created > 0 || inventoryResults.updated > 0) && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-green-400 font-semibold text-sm">Inventory Updated from Invoice</h4>
              <p className="text-slate-300 text-sm mt-1">
                {inventoryResults.created > 0 && <span>{inventoryResults.created} new part{inventoryResults.created !== 1 ? 's' : ''} created. </span>}
                {inventoryResults.updated > 0 && <span>{inventoryResults.updated} existing part{inventoryResults.updated !== 1 ? 's' : ''} updated. </span>}
              </p>
              {inventoryResults.errors.length > 0 && (
                <p className="text-red-400 text-xs mt-1">{inventoryResults.errors.length} error(s): {inventoryResults.errors.join(', ')}</p>
              )}
              <button onClick={() => setInventoryResults(null)} className="text-xs text-slate-500 hover:text-slate-300 mt-2">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"><Receipt className="w-5 h-5 text-blue-400" /></div>
            <div><p className="text-slate-400 text-xs">Total Invoices</p><p className="text-xl font-bold text-white">{stats.totalInvoices}</p></div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-400" /></div>
            <div><p className="text-slate-400 text-xs">Pending</p><p className="text-xl font-bold text-yellow-400">{stats.pendingCount}</p><p className="text-xs text-slate-500">{formatCurrency(stats.pendingAmount)}</p></div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
            <div><p className="text-slate-400 text-xs">Overdue</p><p className="text-xl font-bold text-red-400">{stats.overdueCount}</p><p className="text-xs text-slate-500">{formatCurrency(stats.overdueAmount)}</p></div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-slate-400 text-xs">Paid</p><p className="text-xl font-bold text-green-400">{stats.paidCount}</p><p className="text-xs text-slate-500">{formatCurrency(stats.paidAmount)}</p></div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-orange-400" /></div>
            <div><p className="text-slate-400 text-xs">This Month</p><p className="text-xl font-bold text-orange-400">{stats.thisMonthCount}</p><p className="text-xs text-slate-500">{formatCurrency(stats.thisMonthAmount)}</p></div>
          </div>
        </div>
      </div>

      {/* Upload Warning Banner */}
      {uploadWarning && (
        <div className={`rounded-xl border p-4 ${uploadWarning.type === 'failed' ? 'bg-red-500/10 border-red-500/30' : uploadWarning.type === 'dataurl' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${uploadWarning.type === 'failed' ? 'bg-red-500/20' : uploadWarning.type === 'dataurl' ? 'bg-amber-500/20' : 'bg-yellow-500/20'}`}>
              {uploadWarning.type === 'failed' ? <ShieldAlert className="w-4 h-4 text-red-400" /> : uploadWarning.type === 'dataurl' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Info className="w-4 h-4 text-yellow-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className={`text-sm font-semibold ${uploadWarning.type === 'failed' ? 'text-red-400' : uploadWarning.type === 'dataurl' ? 'text-amber-400' : 'text-yellow-400'}`}>
                  {uploadWarning.type === 'failed' ? 'Upload Failed' : uploadWarning.type === 'dataurl' ? 'Storage Unavailable' : 'Storage Fallback Used'}
                </h4>
                <button onClick={() => setUploadWarning(null)} className="text-slate-500 hover:text-slate-300 p-1"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-slate-400 mt-1"><span className="font-medium text-slate-300">{uploadWarning.fileName}</span> — {uploadWarning.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search invoices, events, work orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Disputed">Disputed</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
          <option value="all">All Vendors</option>
          {vendors.filter(v => v.isActive).map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
        </select>
        <select value={`${sortBy}-${sortDir}`} onChange={(e) => { const [f, d] = e.target.value.split('-'); setSortBy(f as InvoiceSortField); setSortDir(d as InvoiceSortDir); }} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">

          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="amount-desc">Highest Amount</option>
          <option value="amount-asc">Lowest Amount</option>
          <option value="due-asc">Due Soonest</option>
          <option value="vendor-asc">Vendor A-Z</option>
        </select>
        <button onClick={() => { resetForm(); setShowUploadModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors whitespace-nowrap">
          <Upload className="w-4 h-4" /> Upload Invoice
        </button>
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /><span className="ml-3 text-slate-400">Loading invoices...</span></div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">{invoices.length === 0 ? 'No Invoices Yet' : 'No Matching Invoices'}</h3>
          <p className="text-slate-500 mb-6">{invoices.length === 0 ? 'Upload your first vendor invoice to get started.' : 'Try adjusting your search or filters.'}</p>
          {invoices.length === 0 && (
            <button onClick={() => { resetForm(); setShowUploadModal(true); }} className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
              <Upload className="w-5 h-5" /> Upload First Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map(invoice => {
            const overdue = isOverdue(invoice);
            const daysUntilDue = getDaysUntilDue(invoice.due_date);
            return (
              <div key={invoice.id} className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all hover:bg-slate-800/70 ${overdue ? 'border-red-500/40' : 'border-slate-700/50'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${invoice.file_url ? 'bg-slate-700 cursor-pointer hover:bg-slate-600' : 'bg-slate-700/50'}`}
                        onClick={() => { if (invoice.file_url) { setSelectedInvoice(invoice); loadLineItems(invoice.id); setShowDetailModal(true); } }}>
                        {invoice.file_url ? getFileIcon(invoice.file_type) : <Receipt className="w-5 h-5 text-slate-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-white font-semibold truncate">{invoice.invoice_number}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                            {overdue && invoice.status !== 'Overdue' ? 'Overdue' : invoice.status}
                          </span>
                          {invoice.file_url && <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{invoice.file_name}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm flex-wrap">
                          <span className="text-slate-400 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{invoice.vendor_name}</span>
                          <span className="text-slate-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatLocalDate(invoice.invoice_date)}</span>


                          {invoice.po_number && <span className="text-slate-500 flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{invoice.po_number}</span>}
                          {invoice.category && <span className="text-slate-500 text-xs px-2 py-0.5 bg-slate-700/50 rounded">{invoice.category}</span>}
                        </div>
                        {/* Linked event/work order badges */}
                        {(invoice.linked_event_name || invoice.linked_work_order_title) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {invoice.linked_event_name && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded border border-blue-500/20 flex items-center gap-1">
                                <Flag className="w-3 h-3" />{invoice.linked_event_name}
                              </span>
                            )}
                            {invoice.linked_work_order_title && (
                              <span className="text-xs px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded border border-purple-500/20 flex items-center gap-1">
                                <Wrench className="w-3 h-3" />{invoice.linked_work_order_title}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {invoice.due_date && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-slate-500">Due</p>
                          <p className={`text-sm font-medium ${overdue ? 'text-red-400' : daysUntilDue !== null && daysUntilDue <= 7 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            {formatLocalDate(invoice.due_date)}

                          </p>

                          {daysUntilDue !== null && invoice.status !== 'Paid' && (
                            <p className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                              {overdue ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days left`}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-400">{formatCurrency(invoice.total)}</p>
                        {invoice.tax > 0 && <p className="text-xs text-slate-500">Tax: {formatCurrency(invoice.tax)}</p>}
                      </div>
                      <div className="relative">
                        <button onClick={() => setActionMenuId(actionMenuId === invoice.id ? null : invoice.id)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {actionMenuId === invoice.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
                            <div className="absolute right-0 mt-1 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
                              <button onClick={() => { setSelectedInvoice(invoice); loadLineItems(invoice.id); setShowDetailModal(true); setActionMenuId(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              {invoice.file_url && (
                                <a href={invoice.file_url} target="_blank" rel="noopener noreferrer" onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                  <Download className="w-4 h-4" /> Download
                                </a>
                              )}
                              <button onClick={() => handleEditInvoice(invoice)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                                <Edit2 className="w-4 h-4" /> Edit
                              </button>
                              <div className="border-t border-slate-700 my-1" />
                              {invoice.status === 'Pending' && <button onClick={() => handleUpdateStatus(invoice.id, 'Approved')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-slate-700"><CheckCircle2 className="w-4 h-4" /> Approve</button>}
                              {(invoice.status === 'Pending' || invoice.status === 'Approved') && <button onClick={() => handleUpdateStatus(invoice.id, 'Paid')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-slate-700"><CreditCard className="w-4 h-4" /> Mark Paid</button>}
                              {invoice.status !== 'Disputed' && invoice.status !== 'Paid' && <button onClick={() => handleUpdateStatus(invoice.id, 'Disputed')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-purple-400 hover:bg-slate-700"><AlertTriangle className="w-4 h-4" /> Dispute</button>}
                              <div className="border-t border-slate-700 my-1" />
                              <button onClick={() => handleDeleteInvoice(invoice.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700"><Trash2 className="w-4 h-4" /> Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {invoice.notes && <p className="mt-2 text-sm text-slate-500 pl-16 truncate">{invoice.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-400" />
                {editingInvoice ? 'Edit Invoice' : 'Upload Invoice'}
              </h3>
              <button onClick={() => { setShowUploadModal(false); resetForm(); }} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Invoice File (PDF or Image)</label>
                <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragActive ? 'border-orange-500 bg-orange-500/10' : selectedFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'}`}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} className="hidden" />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      {getFileIcon(selectedFile.type)}
                      <div className="text-left"><p className="text-white font-medium">{selectedFile.name}</p><p className="text-sm text-slate-400">{formatFileSize(selectedFile.size)}</p></div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="ml-2 p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                  ) : editingInvoice?.file_url ? (
                    <div className="flex flex-col items-center gap-2">
                      {getFileIcon(editingInvoice.file_type)}
                      <p className="text-slate-300 text-sm">Current: {editingInvoice.file_name}</p>
                      <p className="text-slate-500 text-xs">Drop a new file to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-500" />
                      <p className="text-slate-300 text-sm">Drag & drop or click to browse</p>
                      <p className="text-slate-500 text-xs">PDF, JPEG, PNG — max 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor Selection with New Vendor Option */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor *</label>
                  {!showNewVendor ? (
                    <div className="space-y-1">
                      <select value={newInvoice.vendor_id} onChange={(e) => {
                        const vendor = vendors.find(v => v.id === e.target.value);
                        setNewInvoice(prev => ({ ...prev, vendor_id: e.target.value, vendor_name: vendor?.name || '' }));
                      }} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                        <option value="">Select vendor...</option>
                        {vendors.filter(v => v.isActive).map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
                      </select>
                      <button type="button" onClick={() => setShowNewVendor(true)} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Create new vendor
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 bg-slate-900/50 rounded-lg border border-orange-500/30">
                      <p className="text-xs text-orange-400 font-medium">New Vendor</p>
                      <input type="text" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="Vendor name" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" autoFocus />
                      <select value={newVendorCategory} onChange={(e) => setNewVendorCategory(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
                        <option value="Parts Supplier">Parts Supplier</option>
                        <option value="Engine Builder">Engine Builder</option>
                        <option value="Machine Shop">Machine Shop</option>
                        <option value="Safety Equipment">Safety Equipment</option>
                        <option value="Fuel Supplier">Fuel Supplier</option>
                        <option value="Tires">Tires</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Other">Other</option>
                      </select>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowNewVendor(false); setNewVendorName(''); }} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Invoice Number *</label>
                  <input type="text" value={newInvoice.invoice_number} onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_number: e.target.value }))} placeholder="INV-001" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-slate-400 mb-1">Invoice Date *</label><DateInputDark value={newInvoice.invoice_date} onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_date: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Due Date</label><DateInputDark value={newInvoice.due_date} onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" /></div>
              </div>

              {/* LINE ITEMS EDITOR */}
              <InvoiceLineItemsEditor
                lineItems={lineItems}
                onChange={setLineItems}
                partsInventory={partsInventory}
                vendorName={newInvoice.vendor_name}
              />

              {/* Amounts */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Subtotal ($){lineItems.length > 0 && <span className="text-xs text-orange-400 ml-1">(from line items)</span>}</label>
                  <input type="number" step="0.01" value={newInvoice.amount || ''} onChange={(e) => setNewInvoice(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" disabled={lineItems.length > 0} className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white ${lineItems.length > 0 ? 'opacity-60' : ''}`} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tax ($)</label>
                  <input type="number" step="0.01" value={newInvoice.tax || ''} onChange={(e) => setNewInvoice(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))} placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total</label>
                  <div className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-green-400 font-semibold">{formatCurrency(newInvoice.amount + newInvoice.tax)}</div>
                </div>
              </div>

              {/* Link to Race Event / Work Order */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <select value={newInvoice.linked_event_id} onChange={(e) => setNewInvoice(prev => ({ ...prev, linked_event_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">None</option>
                    {raceEvents.map(e => (<option key={e.id} value={e.id}>{e.title} ({formatLocalDate(e.startDate)})</option>))}
                  </select>

                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1"><Wrench className="w-3.5 h-3.5 text-purple-400" /> Link to Work Order</label>
                  <select value={newInvoice.linked_work_order_id} onChange={(e) => setNewInvoice(prev => ({ ...prev, linked_work_order_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">None</option>
                    {workOrders.map(w => (<option key={w.id} value={w.id}>{w.title} ({w.status})</option>))}
                  </select>
                </div>
              </div>

              {/* PO, Category, Status */}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm text-slate-400 mb-1">PO Number</label><input type="text" value={newInvoice.po_number} onChange={(e) => setNewInvoice(prev => ({ ...prev, po_number: e.target.value }))} placeholder="PO-001" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" /></div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select value={newInvoice.category} onChange={(e) => setNewInvoice(prev => ({ ...prev, category: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="">Select...</option>
                    {['Engine','Drivetrain','Ty-Drive','Quick Drive','Transmission','Supercharger','Electronics','Tires','Hardware','Cylinder Heads','Safety','Services','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select value={newInvoice.status} onChange={(e) => setNewInvoice(prev => ({ ...prev, status: e.target.value as Invoice['status'] }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                    <option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option><option value="Disputed">Disputed</option>
                  </select>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                <select value={newInvoice.payment_method} onChange={(e) => setNewInvoice(prev => ({ ...prev, payment_method: e.target.value }))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  <option value="">Select...</option><option value="Credit Card">Credit Card</option><option value="ACH Transfer">ACH Transfer</option><option value="Wire Transfer">Wire Transfer</option><option value="Check">Check</option><option value="Cash">Cash</option><option value="PayPal">PayPal</option><option value="Net Terms">Net Terms</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={newInvoice.notes} onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Additional notes..." className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none" />
              </div>

              {/* Checkboxes */}
              {!editingInvoice && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <input type="checkbox" id="addToCostReport" checked={addToCostReport} onChange={(e) => setAddToCostReport(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-orange-500 cursor-pointer" />
                    <label htmlFor="addToCostReport" className="flex-1 cursor-pointer">
                      <span className="text-white font-medium text-sm">Add to Cost Report</span>
                      <p className="text-xs text-slate-400">Auto-create cost report entry</p>
                    </label>
                  </div>
                  {lineItems.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      <input type="checkbox" id="autoCreateInventory" checked={autoCreateInventory} onChange={(e) => setAutoCreateInventory(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-orange-500 cursor-pointer" />
                      <label htmlFor="autoCreateInventory" className="flex-1 cursor-pointer">
                        <span className="text-white font-medium text-sm flex items-center gap-1"><Package className="w-3.5 h-3.5 text-green-400" /> Auto-Update Inventory</span>
                        <p className="text-xs text-slate-400">Create new parts or update quantities for matched items</p>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowUploadModal(false); resetForm(); }} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
              <button onClick={handleSaveInvoice} disabled={uploading || (!newInvoice.vendor_id && !showNewVendor) || !newInvoice.invoice_number}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {uploading ? (<><Loader2 className="w-4 h-4 animate-spin" />{editingInvoice ? 'Saving...' : 'Uploading...'}</>) : (<>{editingInvoice ? <Edit2 className="w-4 h-4" /> : <Upload className="w-4 h-4" />}{editingInvoice ? 'Save Changes' : 'Upload Invoice'}</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-5xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-orange-400" /> Invoice {selectedInvoice.invoice_number}</h3>
                <p className="text-sm text-slate-400">{selectedInvoice.vendor_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded text-sm font-medium border ${getStatusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</span>
                {selectedInvoice.file_url && <a href={selectedInvoice.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"><ExternalLink className="w-4 h-4" /> Open</a>}
                <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white p-1"><X className="w-6 h-6" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Preview */}
                <div className="bg-slate-900 flex items-center justify-center min-h-[300px] p-4">
                  {selectedInvoice.file_url ? (
                    selectedInvoice.file_type === 'application/pdf' ? (
                      <iframe src={selectedInvoice.file_url} className="w-full h-[500px] rounded" title="Invoice PDF" />
                    ) : selectedInvoice.file_type?.startsWith('image/') ? (
                      <img src={selectedInvoice.file_url} alt="Invoice" className="max-w-full max-h-[500px] object-contain rounded" />
                    ) : (
                      <div className="text-center text-slate-500"><File className="w-16 h-16 mx-auto mb-2" /><p>Preview not available</p></div>
                    )
                  ) : (
                    <div className="text-center text-slate-500"><Receipt className="w-16 h-16 mx-auto mb-2" /><p>No file attached</p></div>
                  )}
                </div>

                {/* Details */}
                <div className="p-6 space-y-4 overflow-y-auto">
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-green-400">{formatCurrency(selectedInvoice.total)}</p>
                    {selectedInvoice.tax > 0 && <p className="text-sm text-slate-400">Subtotal: {formatCurrency(selectedInvoice.amount)} + Tax: {formatCurrency(selectedInvoice.tax)}</p>}
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: 'Vendor', value: selectedInvoice.vendor_name },
                      { label: 'Invoice Date', value: formatLocalDate(selectedInvoice.invoice_date) },
                      ...(selectedInvoice.due_date ? [{ label: 'Due Date', value: formatLocalDate(selectedInvoice.due_date), color: isOverdue(selectedInvoice) ? 'text-red-400' : undefined }] : []),
                      ...(selectedInvoice.po_number ? [{ label: 'PO Number', value: selectedInvoice.po_number }] : []),
                      ...(selectedInvoice.category ? [{ label: 'Category', value: selectedInvoice.category }] : []),
                      ...(selectedInvoice.payment_method ? [{ label: 'Payment Method', value: selectedInvoice.payment_method }] : []),
                      ...(selectedInvoice.payment_date ? [{ label: 'Payment Date', value: formatLocalDate(selectedInvoice.payment_date), color: 'text-green-400' }] : []),

                      ...(selectedInvoice.file_name ? [{ label: 'File', value: `${selectedInvoice.file_name} (${formatFileSize(selectedInvoice.file_size)})` }] : []),

                    ].map((row: InvoiceDetailRow, i) => (
                      <div key={i} className="flex justify-between py-1.5 border-b border-slate-700/50">
                        <span className="text-slate-400 text-sm">{row.label}</span>
                        <span className={`text-sm font-medium ${row.color || 'text-white'}`}>{row.value}</span>
                      </div>

                    ))}
                  </div>

                  {/* Linked Event / Work Order */}
                  {(selectedInvoice.linked_event_name || selectedInvoice.linked_work_order_title) && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Linked To</p>
                      {selectedInvoice.linked_event_name && (
                        <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <Flag className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300 text-sm font-medium">{selectedInvoice.linked_event_name}</span>
                          <span className="text-xs text-slate-500 ml-auto">Race Event</span>
                        </div>
                      )}
                      {selectedInvoice.linked_work_order_title && (
                        <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <Wrench className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-300 text-sm font-medium">{selectedInvoice.linked_work_order_title}</span>
                          <span className="text-xs text-slate-500 ml-auto">Work Order</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Line Items */}
                  {loadingLineItems ? (
                    <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-orange-400" /><span className="text-sm text-slate-400">Loading line items...</span></div>
                  ) : detailLineItems.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Line Items ({detailLineItems.length})</p>
                      <div className="space-y-1.5">
                        {detailLineItems.map((li: any, idx: number) => (
                          <div key={li.id || idx} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {li.part_number && <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">{li.part_number}</span>}
                                <span className="text-sm text-white truncate">{li.description}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {li.category && <span className="text-xs text-slate-500">{li.category}</span>}
                                {li.auto_created_inventory_id && (
                                  <span className="text-xs text-green-400 flex items-center gap-0.5"><Package className="w-3 h-3" /> In inventory</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <span className="text-sm text-white font-medium">{formatCurrency(parseFloat(li.total) || 0)}</span>
                              <span className="text-xs text-slate-500 block">{li.quantity} x {formatCurrency(parseFloat(li.unit_cost) || 0)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-slate-700/50">
                          <span className="text-sm text-slate-400 font-medium">Line Items Total</span>
                          <span className="text-sm text-green-400 font-bold">{formatCurrency(detailLineItems.reduce((s: number, li: any) => s + (parseFloat(li.total) || 0), 0))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Audit Trail */}
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Audit Trail</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <History className="w-3 h-3" />
                        <span>Created: {new Date(selectedInvoice.created_at).toLocaleString()}</span>
                      </div>
                      {selectedInvoice.updated_at !== selectedInvoice.created_at && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Edit2 className="w-3 h-3" />
                          <span>Last updated: {new Date(selectedInvoice.updated_at).toLocaleString()}</span>
                        </div>
                      )}
                      {selectedInvoice.payment_date && (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <span>Paid on: {formatLocalDate(selectedInvoice.payment_date)}</span>
                        </div>
                      )}

                    </div>
                  </div>

                  {selectedInvoice.notes && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-sm text-slate-300">{selectedInvoice.notes}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                    {selectedInvoice.status === 'Pending' && (
                      <button onClick={() => { handleUpdateStatus(selectedInvoice.id, 'Approved'); setShowDetailModal(false); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                    )}
                    {(selectedInvoice.status === 'Pending' || selectedInvoice.status === 'Approved') && (
                      <button onClick={() => { handleUpdateStatus(selectedInvoice.id, 'Paid'); setShowDetailModal(false); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><CreditCard className="w-4 h-4" /> Mark Paid</button>
                    )}
                    <button onClick={() => { handleEditInvoice(selectedInvoice); setShowDetailModal(false); }} className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"><Edit2 className="w-4 h-4" /> Edit</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceUpload;
