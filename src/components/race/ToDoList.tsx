import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { parseLocalDate, formatLocalDate } from '@/lib/utils';

import DateInputDark from '@/components/ui/DateInputDark';


import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  CrewRole, 
  hasPermission, 
  isAdminRole, 
  getRoleColor,
  allRoles,
  Permission
} from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
import {
  fetchToDoItems,
  upsertToDoItem,
  deleteToDoItem as dbDeleteToDoItem,
  bulkDeleteToDoItems,
  bulkUpdateToDoItems,
  archiveToDoItem as dbArchiveToDoItem,
  restoreToDoItem as dbRestoreToDoItem,
  bulkArchiveToDoItems as dbBulkArchiveToDoItems,
  fetchUserSettings,
  upsertUserSettings,
  ToDoItem
} from '@/lib/database';


import {
  ListTodo,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Circle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Calendar,
  User,
  Tag,
  ChevronDown,
  ChevronUp,
  Settings,
  Shield,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  Square,
  CheckSquare,
  MinusSquare,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

type ToDoSortBy = 'dueDate' | 'priority' | 'createdAt';
type ToDoSortOrder = 'asc' | 'desc';

interface ToDoListProps {
  currentRole?: CrewRole;
  crewMemberName?: string;
}


const ToDoList: React.FC<ToDoListProps> = ({ currentRole = 'Crew', crewMemberName = 'Crew Member' }) => {
  const { teamMembers } = useApp();
  const { user, isDemoMode } = useAuth();
  
  // Database-backed state - starts EMPTY, loaded from Supabase
  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; code?: string; details?: string; hint?: string } | null>(null);


  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ToDoItem | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<ToDoSortBy>('dueDate');
  const [sortOrder, setSortOrder] = useState<ToDoSortOrder>('asc');

  const [showArchived, setShowArchived] = useState(false);
  
  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Default permissions - used as fallback before DB load
  const defaultPermissions: Record<CrewRole, Permission[]> = {
    Admin: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'],
    Owner: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'],
    'Crew Chief': ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'],
    Tuner: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'],
    Driver: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete'],
    Mechanic: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete'],
    Crew: ['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete'],
    Sponsor: ['todo.view'],
    Guest: ['todo.view']
  };

  // Custom role permissions state (admin can modify) - loaded from DB
  const [customPermissions, setCustomPermissions] = useState<Record<CrewRole, Permission[]>>(defaultPermissions);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);


  const [newItem, setNewItem] = useState<Partial<ToDoItem>>({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Pending',
    category: 'General',
    assignedTo: '',
    dueDate: '',
    tags: []
  });


  const categories = ['General', 'Pre-Race', 'Post-Race', 'Parts', 'Maintenance', 'Testing', 'Documentation', 'Safety', 'Shop Work'];

  // ============ LOAD DATA FROM DATABASE ============
  const loadItems = useCallback(async () => {
    // In demo mode, just show empty list (no DB calls)
    if (isDemoMode) {
      setIsLoadingItems(false);
      return;
    }

    setIsLoadingItems(true);
    setLoadError(null);
    try {
      const items = await fetchToDoItems(user?.id);
      setTodoItems(items);
    } catch (err) {
      console.error('Failed to load to-do items:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load to-do items');
    } finally {
      setIsLoadingItems(false);
    }
  }, [user?.id, isDemoMode]);

  // Load items on mount and when user changes
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ============ LOAD/SAVE PERMISSIONS FROM DATABASE ============
  const loadPermissions = useCallback(async () => {
    if (isDemoMode) {
      setIsLoadingPermissions(false);
      return;
    }
    try {
      const settings = await fetchUserSettings('todo_permissions', user?.id);
      if (settings && settings.permissions) {
        setCustomPermissions(prev => ({
          ...prev,
          ...settings.permissions
        }));
      }
    } catch (err) {
      console.error('Failed to load todo permissions:', err);
    } finally {
      setIsLoadingPermissions(false);
    }
  }, [user?.id, isDemoMode]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Save permissions to DB whenever they change (skip initial load)
  const permissionsLoadedRef = React.useRef(false);
  useEffect(() => {
    if (isLoadingPermissions) return;
    if (!permissionsLoadedRef.current) {
      permissionsLoadedRef.current = true;
      return;
    }
    if (isDemoMode) return;

    const savePermissions = async () => {
      try {
        await upsertUserSettings('todo_permissions', { permissions: customPermissions }, user?.id);
      } catch (err) {
        console.error('Failed to save todo permissions:', err);
      }
    };

    // Debounce saves to avoid rapid DB writes while toggling
    const timer = setTimeout(savePermissions, 500);
    return () => clearTimeout(timer);
  }, [customPermissions, isLoadingPermissions, isDemoMode, user?.id]);



  // ============ PERMISSIONS ============
  const hasCustomPermission = (permission: Permission): boolean => {
    const perms = customPermissions[currentRole] || [];
    return perms.includes(permission);
  };

  const canView = hasCustomPermission('todo.view');
  const canAdd = hasCustomPermission('todo.add');
  const canEdit = hasCustomPermission('todo.edit');
  const canDelete = hasCustomPermission('todo.delete');
  const canComplete = hasCustomPermission('todo.complete');
  const canAssign = hasCustomPermission('todo.assign');
  const canManage = hasCustomPermission('todo.manage');
  const canManagePermissions = isAdminRole(currentRole);

  // Separate active and archived items
  const activeItems = useMemo(() => todoItems.filter(item => !item.isArchived), [todoItems]);
  const archivedItems = useMemo(() => todoItems.filter(item => item.isArchived), [todoItems]);

  // Count completed items that can be archived
  const completedNotArchivedCount = useMemo(() => 
    activeItems.filter(item => item.status === 'Completed').length,
    [activeItems]
  );

  // Filter and sort items (only active items for main list)
  const filteredItems = useMemo(() => {
    let items = [...activeItems];

    if (filterStatus !== 'all') {
      items = items.filter(item => item.status === filterStatus);
    }
    if (filterPriority !== 'all') {
      items = items.filter(item => item.priority === filterPriority);
    }
    if (filterCategory !== 'all') {
      items = items.filter(item => item.category === filterCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    items.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'dueDate') {
        const dateA = a.dueDate ? parseLocalDate(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? parseLocalDate(b.dueDate).getTime() : Infinity;

        comparison = dateA - dateB;
      } else if (sortBy === 'priority') {
        const priorityOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return items;
  }, [activeItems, filterStatus, filterPriority, filterCategory, searchTerm, sortBy, sortOrder]);

  // Filter archived items
  const filteredArchivedItems = useMemo(() => {
    let items = [...archivedItems];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    items.sort((a, b) => {
      const dateA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
      const dateB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
      return dateB - dateA;
    });
    return items;
  }, [archivedItems, searchTerm]);

  // ============ CRUD HANDLERS (DATABASE-BACKED) ============

  const handleAddItem = async () => {
    if (!canAdd || !newItem.title) return;

    // Clear any previous save error
    setSaveError(null);

    // 1. Generate a proper UUID for the new item
    const newId = crypto.randomUUID();

    // 2. Build the item object
    const item: ToDoItem = {
      id: newId,
      title: newItem.title,
      description: newItem.description || undefined,
      priority: (newItem.priority as ToDoItem['priority']) || 'Medium',
      status: 'Pending',
      category: newItem.category || 'General',
      assignedTo: canAssign ? (newItem.assignedTo || undefined) : undefined,
      createdBy: crewMemberName,
      createdByRole: currentRole,
      dueDate: newItem.dueDate || undefined,
      tags: newItem.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    };

    // 3. Optimistic update — add to local state immediately
    setTodoItems(prev => [item, ...prev]);
    setShowAddModal(false);
    setNewItem({
      title: '', description: '', priority: 'Medium', status: 'Pending',
      category: 'General', assignedTo: '', dueDate: '', tags: []
    });

    // 4. In demo mode, skip DB save entirely (local state only)
    if (isDemoMode) {
      console.log('[ToDoList] Demo mode — item added to local state only, no DB save.');
      return;
    }

    // 5. Persist to database
    try {
      setIsSaving(true);

      // Explicitly get the authenticated user from Supabase
      const authResponse = await supabase.auth.getUser();
      const authenticatedUserId = authResponse.data?.user?.id;

      console.log('[ToDoList] Auth getUser result:', {
        userId: authenticatedUserId,
        authError: authResponse.error?.message || null,
      });

      if (!authenticatedUserId) {
        const errMsg = 'No authenticated user found. Please log in again.';
        console.error('[ToDoList]', errMsg);
        setSaveError({
          message: errMsg,
          code: 'AUTH_MISSING',
          details: 'supabase.auth.getUser() returned no user. The session may have expired.',
          hint: 'Try logging out and back in, or refresh the page.'
        });
        // Revert optimistic update
        setTodoItems(prev => prev.filter(i => i.id !== newId));
        setIsSaving(false);
        return;
      }

      // Log every single field being sent to the database
      console.log('[ToDoList] handleAddItem — full item object:', JSON.stringify(item, null, 2));
      console.log('[ToDoList] handleAddItem — userId being passed:', authenticatedUserId);

      // Persist to database — pass the explicitly-fetched user ID
      await upsertToDoItem(item, authenticatedUserId);

      console.log('[ToDoList] handleAddItem — SUCCESS! Item saved to database.');

      // Audit log (best-effort, don't block on failure)
      try {
        await auditLog.log({
          action_type: 'create', category: 'todo', entity_type: 'todo_item',
          entity_id: item.id, entity_name: item.title,
          description: `Created to-do item: ${item.title}`, after_value: item
        });
      } catch (auditErr) {
        console.warn('[ToDoList] Audit log failed (non-blocking):', auditErr);
      }

    } catch (err: any) {
      console.error('[ToDoList] handleAddItem FULL ERROR:', err);
      console.error('[ToDoList] Error type:', typeof err);
      console.error('[ToDoList] Error constructor:', err?.constructor?.name);
      console.error('[ToDoList] Error keys:', err ? Object.keys(err) : 'null');
      console.error('[ToDoList] Error stringified:', JSON.stringify(err, null, 2));
      console.error('[ToDoList] Error fields:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        status: err?.status,
        statusText: err?.statusText,
      });

      // Revert optimistic update — remove the exact item we added
      setTodoItems(prev => prev.filter(i => i.id !== newId));

      // Display the COMPLETE raw error on screen
      const errorInfo = {
        message: err?.message || String(err) || 'Unknown error (no message property)',
        code: err?.code || undefined,
        details: err?.details || (err?.statusText ? `HTTP ${err.status}: ${err.statusText}` : undefined),
        hint: err?.hint || undefined,
      };
      setSaveError(errorInfo);
    } finally {
      setIsSaving(false);
    }
  };




  const handleEditItem = async () => {
    if (!canEdit || !editingItem) return;

    const updatedItem: ToDoItem = {
      ...editingItem,
      updatedAt: new Date().toISOString()
    };

    // Optimistic update
    const previousItems = [...todoItems];
    setTodoItems(prev => prev.map(item => 
      item.id === editingItem.id ? updatedItem : item
    ));
    setEditingItem(null);

    // Persist to database
    try {
      setIsSaving(true);
      await upsertToDoItem(updatedItem, user?.id);
      
      await auditLog.log({
        action_type: 'update', category: 'todo', entity_type: 'todo_item',
        entity_id: editingItem.id, entity_name: editingItem.title,
        description: `Updated to-do item: ${editingItem.title}`, after_value: updatedItem
      });
    } catch (err) {
      console.error('Failed to update to-do item:', err);
      setTodoItems(previousItems);
      alert(`Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: ToDoItem) => {
    if (!canDelete && !canManage) return;

    if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
      // Optimistic update
      const previousItems = [...todoItems];
      setTodoItems(prev => prev.filter(i => i.id !== item.id));

      try {
        setIsSaving(true);
        await dbDeleteToDoItem(item.id);
        
        await auditLog.log({
          action_type: 'delete', category: 'todo', entity_type: 'todo_item',
          entity_id: item.id, entity_name: item.title,
          description: `Deleted to-do item: ${item.title}`, before_value: item
        });
      } catch (err) {
        console.error('Failed to delete to-do item:', err);
        setTodoItems(previousItems);
        alert(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleToggleComplete = async (item: ToDoItem) => {
    if (!canComplete) return;

    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    const updatedItem: ToDoItem = {
      ...item,
      status: newStatus as ToDoItem['status'],
      completedDate: newStatus === 'Completed' ? new Date().toISOString() : undefined,
      completedBy: newStatus === 'Completed' ? crewMemberName : undefined,
      updatedAt: new Date().toISOString()
    };

    // Optimistic update
    const previousItems = [...todoItems];
    setTodoItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));

    try {
      await upsertToDoItem(updatedItem, user?.id);
      
      await auditLog.log({
        action_type: newStatus === 'Completed' ? 'check' : 'uncheck',
        category: 'todo', entity_type: 'todo_item',
        entity_id: item.id, entity_name: item.title,
        description: `${newStatus === 'Completed' ? 'Completed' : 'Reopened'} to-do item: ${item.title}`
      });
    } catch (err) {
      console.error('Failed to toggle complete:', err);
      setTodoItems(previousItems);
    }
  };

  // Archive all completed items — uses dedicated bulkArchiveToDoItems (not upsertToDoItem)
  const handleArchiveCompleted = async () => {
    if (!canManage && !canEdit) return;

    const completedItems = activeItems.filter(item => item.status === 'Completed');
    if (completedItems.length === 0) return;

    if (confirm(`Archive ${completedItems.length} completed task${completedItems.length > 1 ? 's' : ''}?`)) {
      const now = new Date().toISOString();
      const completedIds = completedItems.map(i => i.id);
      
      // Optimistic update
      const previousItems = [...todoItems];
      setTodoItems(prev => prev.map(item => {
        if (item.status === 'Completed' && !item.isArchived) {
          return { ...item, isArchived: true, archivedAt: now, archivedBy: crewMemberName, updatedAt: now };
        }
        return item;
      }));

      try {
        setIsSaving(true);
        // Use dedicated bulk archive function — sends ONLY archive columns
        await dbBulkArchiveToDoItems(completedIds, crewMemberName);
        
        await auditLog.log({
          action_type: 'archive', category: 'todo', entity_type: 'todo_items',
          entity_id: 'batch', entity_name: `${completedItems.length} completed tasks`,
          description: `Archived ${completedItems.length} completed to-do item${completedItems.length > 1 ? 's' : ''}`
        });
      } catch (err) {
        console.error('Failed to archive completed items:', err);
        setTodoItems(previousItems);
        alert(`Failed to archive: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Archive a single item — uses dedicated archiveToDoItem (not upsertToDoItem)
  const handleArchiveItem = async (item: ToDoItem) => {
    if (!canManage && !canEdit) return;

    const now = new Date().toISOString();
    const updatedItem: ToDoItem = {
      ...item, isArchived: true, archivedAt: now, archivedBy: crewMemberName, updatedAt: now
    };

    const previousItems = [...todoItems];
    setTodoItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));

    try {
      // Use dedicated archive function — sends ONLY archive columns, not the full item
      await dbArchiveToDoItem(item.id, crewMemberName, user?.id);
      
      await auditLog.log({
        action_type: 'archive', category: 'todo', entity_type: 'todo_item',
        entity_id: item.id, entity_name: item.title,
        description: `Archived to-do item: ${item.title}`
      });
    } catch (err) {
      console.error('Failed to archive item:', err);
      setTodoItems(previousItems);
    }
  };

  // Restore an archived item — uses dedicated restoreToDoItem (not upsertToDoItem)
  const handleRestoreItem = async (item: ToDoItem) => {
    if (!canManage && !canEdit) return;

    const now = new Date().toISOString();
    const updatedItem: ToDoItem = {
      ...item, isArchived: false, archivedAt: undefined, archivedBy: undefined, updatedAt: now
    };

    const previousItems = [...todoItems];
    setTodoItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));

    try {
      // Use dedicated restore function — sends ONLY archive columns (set to null/false)
      await dbRestoreToDoItem(item.id, user?.id);
      
      await auditLog.log({
        action_type: 'restore', category: 'todo', entity_type: 'todo_item',
        entity_id: item.id, entity_name: item.title,
        description: `Restored to-do item from archive: ${item.title}`
      });
    } catch (err) {
      console.error('Failed to restore item:', err);
      setTodoItems(previousItems);
    }
  };


  // Multi-select handlers
  const handleToggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) { newSet.delete(itemId); } else { newSet.add(itemId); }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleDeleteSelected = async () => {
    if (!canDelete && !canManage) return;
    if (selectedItems.size === 0) return;

    const itemsToDelete = todoItems.filter(item => selectedItems.has(item.id));
    const idsToDelete = Array.from(selectedItems);
    
    // Optimistic update
    const previousItems = [...todoItems];
    setTodoItems(prev => prev.filter(item => !selectedItems.has(item.id)));
    setSelectedItems(new Set());
    setShowDeleteConfirmModal(false);

    try {
      setIsSaving(true);
      await bulkDeleteToDoItems(idsToDelete);
      
      await auditLog.log({
        action_type: 'delete', category: 'todo', entity_type: 'todo_items',
        entity_id: 'batch', entity_name: `${itemsToDelete.length} tasks`,
        description: `Deleted ${itemsToDelete.length} to-do item${itemsToDelete.length > 1 ? 's' : ''}: ${itemsToDelete.map(i => i.title).join(', ')}`,
        before_value: itemsToDelete
      });
    } catch (err) {
      console.error('Failed to delete selected items:', err);
      setTodoItems(previousItems);
      alert(`Failed to delete tasks: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Selection state helpers
  const isAllSelected = filteredItems.length > 0 && selectedItems.size === filteredItems.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredItems.length;
  const selectedCount = selectedItems.size;

  const handlePermissionToggle = (role: CrewRole, permission: Permission) => {
    setCustomPermissions(prev => {
      const rolePerms = prev[role] || [];
      const hasIt = rolePerms.includes(permission);
      return {
        ...prev,
        [role]: hasIt ? rolePerms.filter(p => p !== permission) : [...rolePerms, permission]
      };
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'High': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-500/20 text-green-400';
      case 'In Progress': return 'bg-blue-500/20 text-blue-400';
      case 'Pending': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return parseLocalDate(dueDate) < new Date() && parseLocalDate(dueDate).toDateString() !== new Date().toDateString();
  };


  // Stats (only for active items)
  const stats = useMemo(() => ({
    total: activeItems.length,
    pending: activeItems.filter(i => i.status === 'Pending').length,
    inProgress: activeItems.filter(i => i.status === 'In Progress').length,
    completed: activeItems.filter(i => i.status === 'Completed').length,
    overdue: activeItems.filter(i => i.status !== 'Completed' && isOverdue(i.dueDate)).length,
    urgent: activeItems.filter(i => i.priority === 'Urgent' && i.status !== 'Completed').length,
    archived: archivedItems.length
  }), [activeItems, archivedItems]);

  if (!canView) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-[1920px] mx-auto">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
            <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-2">Access Restricted</h3>
            <p className="text-slate-400">You don't have permission to view the To Do List.</p>
          </div>
        </div>
      </section>
    );
  }

  // Render a task item (used for both active and archived lists)
  const renderTaskItem = (item: ToDoItem, isArchivedView: boolean = false) => (
    <div
      key={item.id}
      className={`bg-slate-800/50 rounded-xl border p-4 transition-all ${
        selectedItems.has(item.id) 
          ? 'border-orange-500/50 bg-orange-500/5'
          : isArchivedView
            ? 'border-purple-500/30 opacity-80'
            : item.status === 'Completed' 
              ? 'border-green-500/30 opacity-75' 
              : isOverdue(item.dueDate)
                ? 'border-red-500/50'
                : 'border-slate-700/50'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Selection Checkbox - only for active items */}
        {!isArchivedView && (canDelete || canManage) && (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id); }}
            className="mt-1 flex-shrink-0 p-0.5 hover:bg-slate-700/50 rounded transition-colors"
            title={selectedItems.has(item.id) ? "Deselect" : "Select"}
          >
            {selectedItems.has(item.id) ? (
              <CheckSquare className="w-5 h-5 text-orange-400" />
            ) : (
              <Square className="w-5 h-5 text-slate-500 hover:text-slate-400" />
            )}
          </button>
        )}

        {/* Complete Checkbox */}
        {!isArchivedView && (
          <button
            onClick={() => handleToggleComplete(item)}
            disabled={!canComplete}
            className={`mt-1 flex-shrink-0 ${!canComplete ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {item.status === 'Completed' ? (
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            ) : (
              <Circle className="w-6 h-6 text-slate-500 hover:text-orange-400 transition-colors" />
            )}
          </button>
        )}

        {isArchivedView && (
          <div className="mt-1 flex-shrink-0">
            <Archive className="w-6 h-6 text-purple-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className={`font-medium ${item.status === 'Completed' || isArchivedView ? 'text-slate-400 line-through' : 'text-white'}`}>
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {isArchivedView && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                  Archived
                </span>
              )}
              <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                {item.priority}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
            <span className="text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {item.category}
            </span>
            
            {item.assignedTo && (
              <span className="text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.assignedTo}
              </span>
            )}
            
            {item.dueDate && (
              <span className={`flex items-center gap-1 ${
                isOverdue(item.dueDate) && item.status !== 'Completed' && !isArchivedView
                  ? 'text-red-400' : 'text-slate-400'
              }`}>
                {isOverdue(item.dueDate) && item.status !== 'Completed' && !isArchivedView ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {formatLocalDate(item.dueDate)}

              </span>
            )}
            

            <span className="text-slate-500 text-xs">
              Created by {item.createdBy} ({item.createdByRole})
            </span>
            
            {item.completedBy && (
              <span className="text-green-400 text-xs">
                Completed by {item.completedBy}
              </span>
            )}

            {isArchivedView && item.archivedAt && (
              <span className="text-purple-400 text-xs">
                Archived {new Date(item.archivedAt).toLocaleDateString()} by {item.archivedBy}
              </span>
            )}
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isArchivedView ? (
            <>
              {(canEdit || canManage) && (
                <button
                  onClick={() => handleRestoreItem(item)}
                  className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                  title="Restore from archive"
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
              )}
              {(canDelete || canManage) && (
                <button
                  onClick={() => handleDeleteItem(item)}
                  className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  title="Delete permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {item.status === 'Completed' && (canEdit || canManage) && (
                <button
                  onClick={() => handleArchiveItem(item)}
                  className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                  title="Archive this task"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setEditingItem(item)}
                  className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {(canDelete || canManage) && (
                <button
                  onClick={() => handleDeleteItem(item)}
                  className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <ListTodo className="w-7 h-7 text-orange-500" />
              To Do List
              {isSaving && (
                <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
              )}
            </h2>
            <p className="text-slate-400">Track tasks and assignments for the team</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Refresh Button */}
            <button
              onClick={loadItems}
              disabled={isLoadingItems}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Refresh from database"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingItems ? 'animate-spin' : ''}`} />
            </button>

            {/* Archive Completed Button */}
            {(canEdit || canManage) && completedNotArchivedCount > 0 && (
              <button
                onClick={handleArchiveCompleted}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive Completed ({completedNotArchivedCount})
              </button>
            )}

            {/* Show/Hide Archived Toggle */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showArchived 
                  ? 'bg-purple-500/30 text-purple-300' 
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {showArchived ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showArchived ? 'Hide' : 'Show'} Archived ({stats.archived})
            </button>

            {canManagePermissions && (
              <button
                onClick={() => setShowPermissionsModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Permissions
              </button>
            )}
            
            {canAdd && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Task
              </button>
            )}
          </div>
        </div>

        {/* Load Error Banner */}
        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-400 font-medium">Failed to load tasks</p>
              <p className="text-red-400/70 text-sm">{loadError}</p>
            </div>
            <button
              onClick={loadItems}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Save Error Banner — shows FULL error details on screen */}
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6" data-testid="todo-save-error">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-400 font-medium mb-2">Failed to save task — Full Error Details</p>
                <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-xs space-y-1 overflow-x-auto">
                  <p className="text-red-300"><span className="text-slate-500">message:</span> {saveError.message}</p>
                  <p className="text-red-300"><span className="text-slate-500">code:</span> {saveError.code || '(none)'}</p>
                  <p className="text-red-300"><span className="text-slate-500">details:</span> {saveError.details || '(none)'}</p>
                  <p className="text-red-300"><span className="text-slate-500">hint:</span> {saveError.hint || '(none)'}</p>
                </div>
              </div>
              <button
                onClick={() => setSaveError(null)}
                className="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}


        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-slate-400">{stats.pending}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">In Progress</p>
            <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Overdue</p>
            <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Urgent</p>
            <p className="text-2xl font-bold text-orange-400">{stats.urgent}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-purple-500/30 p-4">
            <p className="text-purple-400 text-sm">Archived</p>
            <p className="text-2xl font-bold text-purple-400">{stats.archived}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400"
                />
              </div>
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">All Priority</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as ToDoSortBy);
                setSortOrder(order as ToDoSortOrder);

              }}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="dueDate-asc">Due Date (Earliest)</option>
              <option value="dueDate-desc">Due Date (Latest)</option>
              <option value="priority-asc">Priority (Highest)</option>
              <option value="priority-desc">Priority (Lowest)</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Selection Bar */}
        {(canDelete || canManage) && filteredItems.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                title={isAllSelected ? "Deselect all" : "Select all visible tasks"}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-orange-400" />
                ) : isSomeSelected ? (
                  <MinusSquare className="w-4 h-4 text-orange-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </span>
              </button>

              {selectedCount > 0 && (
                <span className="text-sm text-slate-400">
                  {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearSelection}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm">Clear</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Delete Selected ({selectedCount})</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoadingItems && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Loader2 className="w-10 h-10 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Loading tasks from database...</p>
          </div>
        )}

        {/* Active To Do Items List */}
        {!isLoadingItems && (
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
                <ListTodo className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">
                  {todoItems.length === 0 ? 'No tasks yet' : 'No active tasks found'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {todoItems.length === 0 
                    ? 'Add your first task to get started' 
                    : 'Try adjusting your filters or search term'
                  }
                </p>
                {canAdd && todoItems.length === 0 && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Add Your First Task
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map(item => renderTaskItem(item, false))
            )}
          </div>
        )}

        {/* Archived Items Section */}
        {showArchived && !isLoadingItems && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-6 h-6 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Archived Tasks</h3>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">
                {filteredArchivedItems.length} item{filteredArchivedItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {filteredArchivedItems.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl border border-purple-500/30 p-8 text-center">
                  <Archive className="w-12 h-12 text-purple-500/50 mx-auto mb-3" />
                  <p className="text-slate-400">No archived tasks</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Completed tasks will appear here when archived
                  </p>
                </div>
              ) : (
                filteredArchivedItems.map(item => renderTaskItem(item, true))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 todo-modal">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto todo-form">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingItem ? 'Edit Task' : 'Add New Task'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingItem(null); }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingItem?.title || newItem.title}
                  onChange={(e) => editingItem 
                    ? setEditingItem({...editingItem, title: e.target.value})
                    : setNewItem({...newItem, title: e.target.value})
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={editingItem?.description || newItem.description}
                  onChange={(e) => editingItem 
                    ? setEditingItem({...editingItem, description: e.target.value})
                    : setNewItem({...newItem, description: e.target.value})
                  }
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter task description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Priority</label>
                  <select
                    value={editingItem?.priority || newItem.priority}
                    onChange={(e) => editingItem 
                      ? setEditingItem({...editingItem, priority: e.target.value as ToDoItem['priority']})
                      : setNewItem({...newItem, priority: e.target.value as ToDoItem['priority']})
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={editingItem?.category || newItem.category}
                    onChange={(e) => editingItem 
                      ? setEditingItem({...editingItem, category: e.target.value})
                      : setNewItem({...newItem, category: e.target.value})
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingItem && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({...editingItem, status: e.target.value as ToDoItem['status']})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Due Date</label>
                <DateInputDark
                  value={editingItem?.dueDate || newItem.dueDate}
                  onChange={(e) => editingItem 
                    ? setEditingItem({...editingItem, dueDate: e.target.value})
                    : setNewItem({...newItem, dueDate: e.target.value})
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>





              {canAssign && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Assign To</label>
                  <select
                    value={editingItem?.assignedTo || newItem.assignedTo}
                    onChange={(e) => editingItem 
                      ? setEditingItem({...editingItem, assignedTo: e.target.value})
                      : setNewItem({...newItem, assignedTo: e.target.value})
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.name}>{member.name} ({member.role})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setEditingItem(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={editingItem ? handleEditItem : handleAddItem}
                disabled={!(editingItem?.title || newItem.title) || isSaving}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Management Modal */}
      {showPermissionsModal && canManagePermissions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                To Do List Permissions
              </h3>
              <button onClick={() => setShowPermissionsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-slate-400 mb-6">
              Configure which roles can perform actions on the To Do List. Changes take effect immediately.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">View</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Add</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Edit</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Delete</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Complete</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Assign</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium text-sm">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {allRoles.map(role => {
                    const perms = customPermissions[role] || [];
                    const isLocked = role === 'Admin';
                    
                    return (
                      <tr key={role} className="border-b border-slate-700/50">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${getRoleColor(role)}`}>
                            {role}
                          </span>
                        </td>
                        {(['todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'] as Permission[]).map(perm => (
                          <td key={perm} className="text-center py-3 px-2">
                            <button
                              onClick={() => !isLocked && handlePermissionToggle(role, perm)}
                              disabled={isLocked}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                perms.includes(perm)
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-slate-700 text-slate-500'
                              } ${isLocked ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
                            >
                              {perms.includes(perm) ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Delete Tasks</h3>
                <p className="text-slate-400 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
              <p className="text-white">
                Are you sure you want to delete{' '}
                <span className="font-bold text-red-400">{selectedCount}</span>{' '}
                task{selectedCount !== 1 ? 's' : ''}?
              </p>
              
              <div className="mt-3 max-h-40 overflow-y-auto">
                <ul className="space-y-1">
                  {todoItems
                    .filter(item => selectedItems.has(item.id))
                    .map(item => (
                      <li key={item.id} className="text-sm text-slate-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"></span>
                        <span className="truncate">{item.title}</span>
                      </li>
                    ))
                  }
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ToDoList;
