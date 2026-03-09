import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChecklistItem } from '@/data/proModData';
import { CrewRole, hasPermission } from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
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
  Lock,
  Shield
} from 'lucide-react';

interface CrewChecklistProps {
  crewMemberName: string;
  currentRole: CrewRole;
}

const CrewChecklist: React.FC<CrewChecklistProps> = ({ crewMemberName, currentRole }) => {
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
  
  const [activeChecklist, setActiveChecklist] = useState<'preRun' | 'betweenRounds' | 'postRun'>('preRun');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  
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

  const checklists = {
    preRun: preRunChecklist,
    betweenRounds: betweenRoundsChecklist,
    postRun: postRunChecklist
  };

  const checklistNames = {
    preRun: 'Pre-Run',
    betweenRounds: 'Between Rounds',
    postRun: 'Post-Run'
  };

  const currentChecklist = checklists[activeChecklist];
  
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

  const handleToggleItem = async (itemId: string) => {
    if (!canCheck) return;
    
    const item = currentChecklist.find(i => i.id === itemId);
    if (!item) return;
    
    // Update the item with who checked it and when
    const updates: Partial<ChecklistItem> = {
      completed: !item.completed
    };
    
    if (!item.completed) {
      // Item is being checked
      updates.checkedBy = crewMemberName;
      updates.checkedAt = new Date().toISOString();
    } else {
      // Item is being unchecked
      updates.checkedBy = undefined;
      updates.checkedAt = undefined;
    }
    
    await updateChecklistItem(activeChecklist, itemId, updates);
    
    // Log the action
    await auditLog.logChecklistCheck(
      itemId,
      item.task,
      checklistNames[activeChecklist],
      !item.completed
    );
  };

  const handleResetChecklist = async () => {
    if (!canReset) return;
    
    if (confirm(`Are you sure you want to reset the ${checklistNames[activeChecklist]} checklist? All items will be unchecked.`)) {
      await resetChecklist(activeChecklist);
      
      // Log the reset
      await auditLog.logChecklistReset(
        activeChecklist,
        checklistNames[activeChecklist],
        currentChecklist.length
      );
    }
  };

  const handleSaveItem = async () => {
    if (!canEdit) return;
    
    if (editingItem) {
      await updateChecklistItem(activeChecklist, editingItem.id, newItem);
      
      // Log the update
      await auditLog.logChecklistItemUpdate(
        editingItem.id,
        newItem.task,
        editingItem,
        newItem
      );
    } else {
      const id = `${activeChecklist.toUpperCase().slice(0, 3)}-${String(currentChecklist.length + 1).padStart(3, '0')}`;
      await addChecklistItem(activeChecklist, { ...newItem, id });
      
      // Log the creation
      await auditLog.logChecklistItemCreate(
        id,
        newItem.task,
        checklistNames[activeChecklist],
        { ...newItem, id }
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
      await deleteChecklistItem(activeChecklist, id);
      
      // Log the deletion
      if (item) {
        await auditLog.logChecklistItemDelete(
          id,
          item.task,
          checklistNames[activeChecklist]
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
          
          <div className="flex items-center gap-3">
            {canEdit && (
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
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['preRun', 'betweenRounds', 'postRun'] as const).map(type => {
            const checklist = checklists[type];
            const completed = checklist.filter(i => i.completed).length;
            const total = checklist.length;
            const critical = checklist.filter(i => i.critical && !i.completed).length;
            
            return (
              <button
                key={type}
                onClick={() => setActiveChecklist(type)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeChecklist === type 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {checklistNames[type]}
                <span className={`px-2 py-0.5 rounded text-xs ${
                  activeChecklist === type 
                    ? 'bg-white/20' 
                    : completed === total ? 'bg-green-500/20 text-green-400' : 'bg-slate-700'
                }`}>
                  {completed}/{total}
                </span>
                {critical > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs">
                    {critical} critical
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium">{checklistNames[activeChecklist]} Progress</span>
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
        {progress === 100 && (
          <div className="mt-6 bg-green-500/20 border border-green-500/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-400">{checklistNames[activeChecklist]} Checklist Complete!</h3>
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
                {editingItem ? 'Edit Checklist Item' : 'Add Checklist Item'}
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
                  <option value="Wheels">Wheels</option>
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
    </section>
  );
};

export default CrewChecklist;
