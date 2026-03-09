import React, { useState, useEffect } from 'react';
import DateInputDark from '@/components/ui/DateInputDark';
import { getLocalDateString } from '@/lib/utils';


import { useApp } from '@/contexts/AppContext';
import BackupRestore from './BackupRestore';
import StorageSetupGuide from './StorageSetupGuide';
import SyncHistoryTab from './SyncHistoryTab';

import { useAuth } from '@/contexts/AuthContext';
import { TeamMember } from './TeamProfile';
import {
  loadAlertSettings,
  saveAlertSettings,
  getDefaultSettings,
  checkMaintenanceAlerts,
  type MaintenanceAlertSettings,
  type AlertThreshold,
} from '@/lib/maintenanceAlerts';
import { 

  CrewRole, 
  Permission, 
  hasPermission, 
  isAdminRole, 
  canManageRole, 
  getRoleColor, 
  getRoleDescription,
  getPermissionsForRole,
  permissionCategories,
  allRoles,
  roleHierarchy
} from '@/lib/permissions';
import {
  auditLog,
  AuditLogEntry,
  AuditCategory,
  AuditActionType,
  formatAuditLogEntry,
  categoryLabels,
  actionTypeLabels
} from '@/lib/auditLog';
import { 

  Settings, 
  Save, 
  RefreshCw,
  Users,
  Wrench,
  Shield,
  Package,
  Zap,
  Wind,
  Settings2,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Lock,
  Eye,
  UserPlus,
  Crown,
  Check,
  Info,
  History,
  Search,
  Clock,
  FileText,
  Download,
  Database,
  Loader2,
  CheckCircle2,
  HardDrive,
  Upload,
  DollarSign,
  Phone,
  RotateCcw
} from 'lucide-react';





import { MaintenanceItem, SFICertification, Engine, Supercharger, CylinderHead } from '@/data/proModData';
import { PartInventoryItem } from '@/data/partsInventory';
import {
  sampleEngine,
  sampleSupercharger,
  samplePassLogs,
  sampleParts,
  sampleChecklistItems
} from '@/data/sampleData';



interface AdminSettingsProps {
  currentRole: CrewRole;
}

type AdminSection = 'roles' | 'team' | 'engines' | 'superchargers' | 'heads' | 'maintenance' | 'sfi' | 'parts' | 'auditlog' | 'sampledata' | 'backup' | 'storage' | 'alerts' | 'synchistory';


type AuditDateRange = '1d' | '7d' | '30d' | 'all';


const AdminSettings: React.FC<AdminSettingsProps> = ({ currentRole }) => {
  const { profile, updateProfile } = useAuth();
  const { 
    engines, 
    superchargers, 
    cylinderHeads,
    maintenanceItems, 
    sfiCertifications,
    partsInventory,
    passLogs,
    preRunChecklist,
    teamMembers,
    updateEngine,
    addEngine,
    deleteEngine,
    updateSupercharger,
    addSupercharger,
    deleteSupercharger,
    updateCylinderHead,
    addCylinderHead,
    deleteCylinderHead,
    updateMaintenanceItem,
    addMaintenanceItem,
    deleteMaintenanceItem,
    updateSFICertification,
    addSFICertification,
    deleteSFICertification,
    updatePartInventory,
    addPartInventory,
    deletePartInventory,
    addPassLog,
    addChecklistItem,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    refreshData
  } = useApp();

  const [activeSection, setActiveSection] = useState<AdminSection>('roles');


  // Maintenance Alert Threshold Settings
  const [alertSettings, setAlertSettings] = useState<MaintenanceAlertSettings>(() => loadAlertSettings());
  const [alertSaveMsg, setAlertSaveMsg] = useState<string | null>(null);

  const handleSaveAlertSettings = () => {
    saveAlertSettings(alertSettings);
    setAlertSaveMsg('Alert settings saved!');
    setTimeout(() => setAlertSaveMsg(null), 3000);
  };

  const handleResetAlertSettings = () => {
    const defaults = getDefaultSettings();
    setAlertSettings(defaults);
    saveAlertSettings(defaults);
    setAlertSaveMsg('Alert settings reset to defaults.');
    setTimeout(() => setAlertSaveMsg(null), 3000);
  };

  const updateThreshold = (index: number, field: keyof AlertThreshold, value: AlertThreshold[keyof AlertThreshold]) => {

    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }));
  };

  const addThreshold = () => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: [...prev.thresholds, { percentage: 75, label: 'Custom Alert', severity: 'info' as const, enabled: true }]
    }));
  };

  const removeThreshold = (index: number) => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.filter((_, i) => i !== index)
    }));
  };

  const currentAlerts = checkMaintenanceAlerts(maintenanceItems, alertSettings);


  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedRoleForView, setSelectedRoleForView] = useState<CrewRole>('Crew');

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<{
    category: AuditCategory | '';
    actionType: AuditActionType | '';
    searchTerm: string;
    dateRange: '1d' | '7d' | '30d' | 'all';
  }>({
    category: '',
    actionType: '',
    searchTerm: '',
    dateRange: '7d'
  });
  const [selectedLogEntry, setSelectedLogEntry] = useState<AuditLogEntry | null>(null);
  const [auditStats, setAuditStats] = useState<{
    totalActions: number;
    actionsByCategory: Record<string, number>;
    actionsByUser: Record<string, number>;
    actionsByType: Record<string, number>;
  } | null>(null);

  // Permission checks
  const canManageRoles = hasPermission(currentRole, 'team.manage_roles');
  const canEditSettings = hasPermission(currentRole, 'settings.edit');
  const canEditTeam = hasPermission(currentRole, 'team.edit');
  const canDeleteTeam = hasPermission(currentRole, 'team.delete');
  const canViewAuditLog = isAdminRole(currentRole) || currentRole === 'Crew Chief';

  // Team Profile state
  const [teamName, setTeamName] = useState(profile?.teamName || '');
  const [driverName, setDriverName] = useState(profile?.driverName || '');
  const [carNumber, setCarNumber] = useState(profile?.carNumber || '');
  const [carClass, setCarClass] = useState(profile?.carClass || 'Pro Mod');
  const [engineType, setEngineType] = useState(profile?.engineType || 'Supercharged Hemi');
  const [fuelType, setFuelType] = useState(profile?.fuelType || 'Methanol');
  const [homeTrack, setHomeTrack] = useState(profile?.homeTrack || '');

  // Shared constants matching TeamProfile
  const memberRoles: TeamMember['role'][] = ['Owner', 'Driver', 'Crew Chief', 'Crew', 'Mechanic', 'Tuner', 'Sponsor'];
  const specialtyOptions = ['Engine', 'Transmission', 'Chassis', 'Electronics', 'Fuel System', 'Suspension', 'Body/Paint', 'Data Analysis'];

  const defaultNewMember: Partial<TeamMember> = {
    name: '',
    email: '',
    phone: '',
    role: 'Crew',
    permissions: ['view'],
    specialties: [],
    isActive: true,
    joinedDate: getLocalDateString(),

    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
    hourlyRate: undefined,
    dailyRate: undefined,
  };

  // Team member modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>(defaultNewMember);


  // Sample data import state
  const [showSampleDataConfirm, setShowSampleDataConfirm] = useState(false);
  const [sampleImportStatus, setSampleImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [sampleImportMessage, setSampleImportMessage] = useState('');


  // Fetch audit logs when section is active
  useEffect(() => {
    if (activeSection === 'auditlog' && canViewAuditLog) {
      fetchAuditLogs();
      fetchAuditStats();
    }
  }, [activeSection, auditFilter]);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      let startDate: string | undefined;
      const now = new Date();
      
      switch (auditFilter.dateRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          startDate = undefined;
      }

      const logs = await auditLog.fetchLogs({
        startDate,
        category: auditFilter.category || undefined,
        actionType: auditFilter.actionType || undefined,
        searchTerm: auditFilter.searchTerm || undefined,
        limit: 100
      });
      
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const days = auditFilter.dateRange === '1d' ? 1 : 
                   auditFilter.dateRange === '7d' ? 7 : 
                   auditFilter.dateRange === '30d' ? 30 : 365;
      const stats = await auditLog.getStats(days);
      setAuditStats(stats);
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const handleSaveTeamProfile = async () => {
    if (!canEditSettings) return;
    
    setIsSaving(true);
    try {
      const oldProfile = { teamName: profile?.teamName, driverName: profile?.driverName, carNumber: profile?.carNumber };
      await updateProfile({
        teamName,
        driverName,
        carNumber,
        carClass,
        engineType,
        fuelType,
        homeTrack
      });
      
      // Log the change
      await auditLog.logSettingsChange('Team Profile', oldProfile, {
        teamName, driverName, carNumber, carClass, engineType, fuelType, homeTrack
      });
      
      setSaveMessage('Team profile saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage('Error saving profile');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (permission: 'view' | 'edit' | 'admin') => {
    const current = newMember.permissions || [];
    if (current.includes(permission)) {
      setNewMember({ ...newMember, permissions: current.filter(p => p !== permission) });
    } else {
      setNewMember({ ...newMember, permissions: [...current, permission] });
    }
  };

  const handleSaveMember = async () => {
    if (!canEditTeam) return;
    
    const member: TeamMember = {
      id: editingMember?.id || `TM-${Date.now()}`,
      name: newMember.name || '',
      email: newMember.email,
      phone: newMember.phone,
      role: newMember.role as TeamMember['role'] || 'Crew',
      permissions: newMember.permissions || ['view'],
      specialties: newMember.specialties,
      isActive: newMember.isActive ?? true,
      joinedDate: newMember.joinedDate || getLocalDateString(),

      emergencyContactName: newMember.emergencyContactName,
      emergencyContactPhone: newMember.emergencyContactPhone,
      notes: newMember.notes,
      hourlyRate: newMember.hourlyRate,
      dailyRate: newMember.dailyRate
    };

    if (editingMember) {
      await updateTeamMember(member.id, member);
    } else {
      await addTeamMember(member);
      // Log the addition
      await auditLog.logTeamMemberAdd(member.id, member.name, member.role, member);
    }
    
    setShowMemberModal(false);
    setEditingMember(null);
    setNewMember({ ...defaultNewMember, joinedDate: getLocalDateString() });

  };


  const getDefaultPermissionsForRole = (role: TeamMember['role']): ('view' | 'edit' | 'admin')[] => {
    switch (role) {
      case 'Owner':
        return ['view', 'edit', 'admin'];
      case 'Crew Chief':
        return ['view', 'edit', 'admin'];
      case 'Driver':
        return ['view', 'edit'];
      case 'Tuner':
        return ['view', 'edit'];
      case 'Mechanic':
        return ['view', 'edit'];
      case 'Sponsor':
        return ['view'];
      default:
        return ['view'];
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!canDeleteTeam) return;
    
    const member = teamMembers.find(m => m.id === id);
    if (confirm('Are you sure you want to remove this team member?')) {
      await deleteTeamMember(id);
      // Log the removal
      if (member) {
        await auditLog.logTeamMemberRemove(id, member.name);
      }
    }
  };

  const handleChangeRole = async (memberId: string, newRole: TeamMember['role']) => {
    if (!canManageRoles) return;
    
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    // Check if current user can manage this role change
    const memberCrewRole = member.role as CrewRole;
    const newCrewRole = newRole as CrewRole;
    
    if (!canManageRole(currentRole, memberCrewRole) && !isAdminRole(currentRole)) {
      setSaveMessage('You cannot change the role of someone with equal or higher permissions');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    
    const oldRole = member.role;
    const newPermissions = getDefaultPermissionsForRole(newRole);
    await updateTeamMember(memberId, { role: newRole, permissions: newPermissions });
    
    // Log the role change
    await auditLog.logRoleChange(memberId, member.name, oldRole, newRole);
    
    setSaveMessage(`Role updated to ${newRole}`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const exportAuditLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Role', 'Action', 'Category', 'Entity', 'Description'].join(','),
      ...auditLogs.map(log => [
        log.timestamp,
        log.user_name,
        log.user_role,
        log.action_type,
        log.category,
        log.entity_name || '',
        `"${log.description.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${getLocalDateString()}.csv`;

    a.click();
    URL.revokeObjectURL(url);

    // Log the export
    auditLog.logDataExport('Audit Logs', auditLogs.length);
  };



  // Handle importing sample data
  const handleImportSampleData = async () => {
    setSampleImportStatus('importing');
    setSampleImportMessage('');
    setShowSampleDataConfirm(false);
    
    try {
      // Check for duplicates before importing
      const engineExists = engines.some(e => e.id === sampleEngine.id);
      const scExists = superchargers.some(s => s.id === sampleSupercharger.id);
      
      let imported = { engines: 0, superchargers: 0, passLogs: 0, parts: 0, checklist: 0 };
      
      // Import engine (skip if already exists)
      if (!engineExists) {
        await addEngine(sampleEngine);
        imported.engines = 1;
      }
      
      // Import supercharger (skip if already exists)
      if (!scExists) {
        await addSupercharger(sampleSupercharger);
        imported.superchargers = 1;
      }
      
      // Import pass logs (skip duplicates)
      for (const pass of samplePassLogs) {
        const exists = passLogs.some(p => p.id === pass.id);
        if (!exists) {
          await addPassLog(pass);
          imported.passLogs++;
        }
      }
      
      // Import parts (skip duplicates)
      for (const part of sampleParts) {
        const exists = partsInventory.some(p => p.id === part.id);
        if (!exists) {
          await addPartInventory(part);
          imported.parts++;
        }
      }
      
      // Import checklist items (skip duplicates)
      for (const item of sampleChecklistItems) {
        const exists = preRunChecklist.some(c => c.id === item.id);
        if (!exists) {
          await addChecklistItem('preRun', item);
          imported.checklist++;
        }
      }
      
      const parts = [];
      if (imported.engines > 0) parts.push(`${imported.engines} engine`);
      if (imported.superchargers > 0) parts.push(`${imported.superchargers} supercharger`);
      if (imported.passLogs > 0) parts.push(`${imported.passLogs} pass log${imported.passLogs > 1 ? 's' : ''}`);
      if (imported.parts > 0) parts.push(`${imported.parts} part${imported.parts > 1 ? 's' : ''}`);
      if (imported.checklist > 0) parts.push(`${imported.checklist} checklist item${imported.checklist > 1 ? 's' : ''}`);
      
      const total = imported.engines + imported.superchargers + imported.passLogs + imported.parts + imported.checklist;
      
      if (total === 0) {
        setSampleImportMessage('Sample data has already been imported. No new records were added.');
      } else {
        setSampleImportMessage(`Successfully imported ${parts.join(', ')}!`);
      }
      
      setSampleImportStatus('success');
    } catch (error) {
      console.error('Error importing sample data:', error);
      setSampleImportStatus('error');
      setSampleImportMessage(`Error importing sample data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sections = [

    { id: 'storage', label: 'Storage & Uploads', icon: Upload, adminOnly: false },
    { id: 'backup', label: 'Backup & Restore', icon: HardDrive, adminOnly: false },
    { id: 'alerts', label: 'Maintenance Alerts', icon: AlertTriangle, adminOnly: false, count: currentAlerts.length > 0 ? currentAlerts.length : undefined },
    { id: 'synchistory', label: 'Sync History', icon: RotateCcw, adminOnly: false },
    { id: 'roles', label: 'Role Management', icon: Shield, adminOnly: true },
    { id: 'auditlog', label: 'Audit Log', icon: History, adminOnly: true },
    { id: 'sampledata', label: 'Import Sample Data', icon: Database, adminOnly: false },
    { id: 'team', label: 'Team Profile', icon: Users },
    { id: 'engines', label: 'Main Components', icon: Zap, count: engines.length },

    { id: 'superchargers', label: 'Superchargers', icon: Wind, count: superchargers.length },
    { id: 'heads', label: 'Cylinder Heads', icon: Settings2, count: cylinderHeads.length },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, count: maintenanceItems.length },
    { id: 'sfi', label: 'SFI Certs', icon: Shield, count: sfiCertifications.length },
    { id: 'parts', label: 'Parts Inventory', icon: Package, count: partsInventory.length }
  ];



  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Admin': return <Crown className="w-4 h-4" />;
      case 'Owner': return <Crown className="w-4 h-4" />;
      case 'Crew Chief': return <Shield className="w-4 h-4" />;
      case 'Driver': return <Users className="w-4 h-4" />;
      case 'Tuner': return <Settings className="w-4 h-4" />;
      case 'Mechanic': return <Wrench className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getActionIcon = (actionType: AuditActionType) => {
    switch (actionType) {
      case 'create': return <Plus className="w-4 h-4" />;
      case 'update': return <Edit2 className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'check': return <Check className="w-4 h-4" />;
      case 'reset': return <RefreshCw className="w-4 h-4" />;
      case 'role_change': return <Shield className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getActionColor = (actionType: AuditActionType) => {
    switch (actionType) {
      case 'create': return 'text-green-400 bg-green-500/20';
      case 'update': return 'text-blue-400 bg-blue-500/20';
      case 'delete': return 'text-red-400 bg-red-500/20';
      case 'check': return 'text-green-400 bg-green-500/20';
      case 'uncheck': return 'text-yellow-400 bg-yellow-500/20';
      case 'reset': return 'text-orange-400 bg-orange-500/20';
      case 'role_change': return 'text-purple-400 bg-purple-500/20';
      case 'export': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Settings className="w-7 h-7 text-orange-500" />
              Admin Settings
            </h2>
            <p className="text-slate-400">Manage all app settings, parameters, and team roles</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleColor(currentRole)}`}>
                <Shield className="w-3 h-3" />
                {currentRole}
              </span>
              {canManageRoles && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Can manage roles
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={refreshData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Data
          </button>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-lg ${
            saveMessage.includes('Error') || saveMessage.includes('cannot')
              ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
              : 'bg-green-500/20 text-green-400 border border-green-500/50'
          }`}>
            {saveMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Settings Categories</h3>
              <div className="space-y-1">
                {sections.map(section => {
                  const Icon = section.icon;
                  const isAdminSection = section.adminOnly;
                  const canAccess = !isAdminSection || canViewAuditLog;
                  
                  return (
                    <button
                      key={section.id}
                      onClick={() => canAccess && setActiveSection(section.id as AdminSection)}

                      disabled={!canAccess}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                        activeSection === section.id 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : canAccess
                            ? 'text-slate-300 hover:bg-slate-700/50'
                            : 'text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{section.label}</span>
                        {!canAccess && <Lock className="w-3 h-3" />}
                      </div>
                      {section.count !== undefined && (
                        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                          {section.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">

            {/* Maintenance Alert Threshold Settings */}
            {activeSection === 'alerts' && (
              <div className="space-y-6">
                {/* Overview */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    Maintenance Alert Thresholds
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Configure when automatic alerts fire as drivetrain and engine components approach their pass-count service intervals.
                    Notifications appear as toast pop-ups when pass logs are added and in the navigation bell icon.
                  </p>

                  {alertSaveMsg && (
                    <div className={`mb-4 p-3 rounded-lg ${alertSaveMsg.includes('reset') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/50'}`}>
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{alertSaveMsg}</div>
                    </div>
                  )}

                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 mb-4">
                    <div>
                      <p className="text-white font-medium">Enable Automatic Alerts</p>
                      <p className="text-xs text-slate-400">Monitor all maintenance items including drivetrain components</p>
                    </div>
                    <button
                      onClick={() => setAlertSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${alertSettings.enabled ? 'bg-orange-500' : 'bg-slate-600'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${alertSettings.enabled ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Notification Channels */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-300">Toast Notifications</span>
                      </div>
                      <button
                        onClick={() => setAlertSettings(prev => ({ ...prev, showToastNotifications: !prev.showToastNotifications }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${alertSettings.showToastNotifications ? 'bg-orange-500' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${alertSettings.showToastNotifications ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-slate-300">Bell Icon Alerts</span>
                      </div>
                      <button
                        onClick={() => setAlertSettings(prev => ({ ...prev, showBellAlerts: !prev.showBellAlerts }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${alertSettings.showBellAlerts ? 'bg-orange-500' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${alertSettings.showBellAlerts ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Threshold Configuration */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Alert Thresholds</h3>
                    <button onClick={addThreshold} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 transition-colors">
                      <Plus className="w-4 h-4" /> Add Threshold
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Alerts trigger when a component reaches the configured percentage of its pass-count service interval. For example, at 80% of a 100-pass interval, an alert fires at pass 80.
                  </p>

                  <div className="space-y-3">
                    {alertSettings.thresholds.sort((a, b) => a.percentage - b.percentage).map((threshold, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border transition-colors ${threshold.enabled ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-900/30 border-slate-700/50 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateThreshold(idx, 'enabled', !threshold.enabled)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${threshold.enabled ? 'bg-orange-500' : 'bg-slate-600'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${threshold.enabled ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <div className={`w-3 h-3 rounded-full ${threshold.severity === 'critical' ? 'bg-red-400' : threshold.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                            <span className="text-white font-medium">{threshold.label}</span>
                          </div>
                          {alertSettings.thresholds.length > 1 && (
                            <button onClick={() => removeThreshold(idx)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Percentage (%)</label>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={threshold.percentage}
                              onChange={(e) => updateThreshold(idx, 'percentage', parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Label</label>
                            <input
                              type="text"
                              value={threshold.label}
                              onChange={(e) => updateThreshold(idx, 'label', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Severity</label>
                            <select
                              value={threshold.severity}
                              onChange={(e) => updateThreshold(idx, 'severity', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                            >
                              <option value="info">Info (Blue)</option>
                              <option value="warning">Warning (Amber)</option>
                              <option value="critical">Critical (Red)</option>
                            </select>
                          </div>
                        </div>

                        {/* Visual bar showing where this threshold sits */}
                        <div className="mt-3">
                          <div className="w-full bg-slate-700 rounded-full h-2 relative">
                            <div
                              className={`h-2 rounded-full transition-all ${threshold.severity === 'critical' ? 'bg-red-500' : threshold.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(threshold.percentage, 100)}%` }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-900 shadow"
                              style={{ left: `${Math.min(threshold.percentage, 100)}%`, transform: 'translate(-50%, -50%)' }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-slate-500">0%</span>
                            <span className="text-[10px] text-slate-500">Alert at {threshold.percentage}%</span>
                            <span className="text-[10px] text-slate-500">100%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save / Reset */}
                  <div className="flex items-center gap-3 mt-6">
                    <button onClick={handleSaveAlertSettings} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all">
                      <Save className="w-4 h-4" /> Save Settings
                    </button>
                    <button onClick={handleResetAlertSettings} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                      <RefreshCw className="w-4 h-4" /> Reset to Defaults
                    </button>
                  </div>
                </div>

                {/* Current Alert Preview */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Current Active Alerts ({currentAlerts.length})
                  </h3>
                  {currentAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
                      <p className="text-slate-400">No maintenance items have reached alert thresholds.</p>
                      <p className="text-xs text-slate-500 mt-1">Alerts will appear here as components approach their service intervals.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {currentAlerts.map((alert, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
                          alert.threshold.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                          alert.threshold.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-blue-500/10 border-blue-500/30'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              alert.threshold.severity === 'critical' ? 'bg-red-400' :
                              alert.threshold.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                            }`} />
                            <div>
                              <p className="text-white font-medium text-sm">{alert.component}</p>
                              <p className="text-xs text-slate-400">{alert.category} — {alert.threshold.label}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${
                              alert.threshold.severity === 'critical' ? 'text-red-400' :
                              alert.threshold.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                            }`}>{alert.percentUsed}%</p>
                            <p className="text-[11px] text-slate-500">{alert.currentPasses}/{alert.nextServicePasses} passes</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}


            {activeSection === 'auditlog' && canViewAuditLog && (
              <div className="space-y-6">
                {/* Stats Overview */}
                {auditStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                      <p className="text-slate-400 text-sm">Total Actions</p>
                      <p className="text-2xl font-bold text-white">{auditStats.totalActions}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                      <p className="text-slate-400 text-sm">Active Users</p>
                      <p className="text-2xl font-bold text-cyan-400">{Object.keys(auditStats.actionsByUser).length}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                      <p className="text-slate-400 text-sm">Creates</p>
                      <p className="text-2xl font-bold text-green-400">{auditStats.actionsByType['create'] || 0}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                      <p className="text-slate-400 text-sm">Updates</p>
                      <p className="text-2xl font-bold text-blue-400">{auditStats.actionsByType['update'] || 0}</p>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search audit logs..."
                          value={auditFilter.searchTerm}
                          onChange={(e) => setAuditFilter({ ...auditFilter, searchTerm: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400"
                        />
                      </div>
                    </div>
                    <select
                      value={auditFilter.dateRange}
                      onChange={(e) => setAuditFilter({ ...auditFilter, dateRange: e.target.value as AuditDateRange })}

                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="1d">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="all">All time</option>
                    </select>
                    <select
                      value={auditFilter.category}
                      onChange={(e) => setAuditFilter({ ...auditFilter, category: e.target.value as AuditCategory | '' })}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">All Categories</option>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <select
                      value={auditFilter.actionType}
                      onChange={(e) => setAuditFilter({ ...auditFilter, actionType: e.target.value as AuditActionType | '' })}

                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">All Actions</option>
                      {Object.entries(actionTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={exportAuditLogs}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>
                </div>

                {/* Audit Log List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-orange-400" />
                      Activity Log
                    </h3>
                    <button
                      onClick={fetchAuditLogs}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                    >
                      <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {auditLoading ? (
                    <div className="p-8 text-center">
                      <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-400">Loading audit logs...</p>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="p-8 text-center">
                      <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No audit logs found</p>
                      <p className="text-sm text-slate-500 mt-1">Activity will appear here as changes are made</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">
                      {auditLogs.map((log) => {
                        const { timeAgo } = formatAuditLogEntry(log);
                        return (
                          <div
                            key={log.id}
                            className="p-4 hover:bg-slate-700/30 cursor-pointer transition-colors"
                            onClick={() => setSelectedLogEntry(log)}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-lg ${getActionColor(log.action_type)}`}>
                                {getActionIcon(log.action_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium">{log.description}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-sm text-slate-400">by</span>
                                  <span className={`text-sm px-2 py-0.5 rounded ${getRoleColor(log.user_role as CrewRole)}`}>
                                    {log.user_name}
                                  </span>
                                  <span className="text-sm text-slate-500">•</span>
                                  <span className="text-sm text-slate-400">{categoryLabels[log.category as AuditCategory] || log.category}</span>
                                  {log.entity_name && (
                                    <>
                                      <span className="text-sm text-slate-500">•</span>
                                      <span className="text-sm text-cyan-400">{log.entity_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-sm text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  {timeAgo}
                                </div>
                                {(log.before_value || log.after_value) && (
                                  <span className="text-xs text-blue-400 mt-1 block">View details</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Role Management */}
            {activeSection === 'roles' && canManageRoles && (
              <div className="space-y-6">
                {/* Role Overview */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-orange-400" />
                    Role-Based Access Control
                  </h3>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="font-medium mb-1">How Roles Work</p>
                        <p className="text-blue-300/80">
                          Each team member is assigned a role that determines what they can view and edit in the app. 
                          Higher-level roles (Admin, Owner, Crew Chief) can manage lower-level roles.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Role Cards */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allRoles.filter(r => r !== 'Guest').map(role => {
                      const permissions = getPermissionsForRole(role);
                      const memberCount = teamMembers.filter(m => m.role === role).length;
                      
                      return (
                        <div 
                          key={role}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedRoleForView === role 
                              ? 'border-orange-500 bg-orange-500/10' 
                              : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                          }`}
                          onClick={() => setSelectedRoleForView(role)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getRoleIcon(role)}
                              <span className="font-medium text-white">{role}</span>
                            </div>
                            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                              {memberCount} member{memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{getRoleDescription(role)}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Level: {roleHierarchy[role]}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleColor(role)}`}>
                              {permissions.length} permissions
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Role Permissions Detail */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Permissions for: <span className="text-orange-400">{selectedRoleForView}</span>
                  </h3>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(permissionCategories).map(([key, category]) => {
                      const rolePerms = getPermissionsForRole(selectedRoleForView);
                      const categoryPerms = category.permissions.filter(p => 
                        rolePerms.includes(p.id as Permission)
                      );
                      
                      return (
                        <div key={key} className="bg-slate-900/50 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-white mb-2">{category.label}</h4>
                          <div className="space-y-1">
                            {category.permissions.map(perm => {
                              const hasIt = rolePerms.includes(perm.id as Permission);
                              return (
                                <div 
                                  key={perm.id}
                                  className={`flex items-center gap-2 text-xs ${
                                    hasIt ? 'text-green-400' : 'text-slate-500'
                                  }`}
                                >
                                  {hasIt ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                  {perm.label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Members with Role Management */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Manage Team Member Roles</h3>
                    <button
                      onClick={() => {
                        setEditingMember(null);
                        setNewMember({ ...defaultNewMember, joinedDate: getLocalDateString() });

                        setShowMemberModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Member
                    </button>
                  </div>
                  
                  {teamMembers.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No team members added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {teamMembers.map(member => {
                        const memberRole = member.role as CrewRole;
                        const canEdit = canManageRole(currentRole, memberRole) || isAdminRole(currentRole);
                        
                        return (
                          <div key={member.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                                {getRoleIcon(member.role)}
                              </div>
                              <div>
                                <p className="text-white font-medium">{member.name}</p>
                                <p className="text-sm text-slate-400">{member.email || 'No email'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {canEdit ? (
                                <select
                                  value={member.role}
                                  onChange={(e) => handleChangeRole(member.id, e.target.value as TeamMember['role'])}
                                  className={`bg-slate-800 border rounded-lg px-3 py-1.5 text-sm ${getRoleColor(memberRole)}`}
                                >
                                  {memberRoles.map(r => (<option key={r} value={r}>{r}</option>))}
                                </select>
                              ) : (
                                <span className={`px-3 py-1.5 rounded-lg text-sm ${getRoleColor(memberRole)}`}>
                                  {member.role}
                                </span>
                              )}
                              
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMember(member);
                                      setNewMember(member);
                                      setShowMemberModal(true);
                                    }}
                                    className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMember(member.id)}
                                    className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Team Profile */}
            {activeSection === 'team' && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Team Information</h3>
                  
                  {!canEditSettings && (
                    <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <Lock className="w-4 h-4" />
                        You have view-only access to team settings
                      </div>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Team Name</label>
                      <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Driver Name</label>
                      <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Car Number</label>
                      <input type="text" value={carNumber} onChange={(e) => setCarNumber(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Car Class</label>
                      <select value={carClass} onChange={(e) => setCarClass(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="Pro Mod">Pro Mod</option>
                        <option value="Pro Stock">Pro Stock</option>
                        <option value="Top Sportsman">Top Sportsman</option>
                        <option value="Top Dragster">Top Dragster</option>
                        <option value="Super Comp">Super Comp</option>
                        <option value="Super Gas">Super Gas</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Engine Type</label>
                      <input type="text" value={engineType} onChange={(e) => setEngineType(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Fuel Type</label>
                      <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="Methanol">Methanol</option>
                        <option value="Nitromethane">Nitromethane</option>
                        <option value="E85">E85</option>
                        <option value="Gasoline">Gasoline</option>
                        <option value="VP Racing Fuel">VP Racing Fuel</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-400 mb-1">Home Track</label>
                      <input type="text" value={homeTrack} onChange={(e) => setHomeTrack(e.target.value)} disabled={!canEditSettings} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  
                  {canEditSettings && (
                    <button onClick={handleSaveTeamProfile} disabled={isSaving} className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  )}
                </div>

                {/* Crew Members List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Crew Members</h3>
                    {canEditTeam && (
                      <button
                        onClick={() => {
                          setEditingMember(null);
                          setNewMember({ ...defaultNewMember, joinedDate: getLocalDateString() });

                          setShowMemberModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                        Add Member
                      </button>
                    )}
                  </div>
                  
                  {teamMembers.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No team members added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                          <div>
                            <p className="text-white font-medium">{member.name}</p>
                            <p className="text-sm text-slate-400">{member.role}</p>
                          </div>
                          {canEditTeam && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingMember(member);
                                  setNewMember(member);
                                  setShowMemberModal(true);
                                }}
                                className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {canDeleteTeam && (
                                <button
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Components */}
            {activeSection === 'engines' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Main Components Inventory</h3>
                  <span className="text-sm text-slate-400">{engines.length} engines</span>
                </div>
                <div className="space-y-3">
                  {engines.map(engine => (
                    <div key={engine.id} className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{engine.name}</p>
                          <p className="text-sm text-slate-400">S/N: {engine.serialNumber} | {engine.totalPasses} passes</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${engine.status === 'Active' ? 'bg-green-500/20 text-green-400' : engine.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' : engine.status === 'Rebuild' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'}`}>{engine.status}</span>
                          {engine.currentlyInstalled && (<span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">INSTALLED</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-500">Use the Main Components section to add, edit, or delete engines and drivetrain components.</p>
              </div>
            )}


            {/* Superchargers */}
            {activeSection === 'superchargers' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Supercharger Inventory</h3>
                  <span className="text-sm text-slate-400">{superchargers.length} units</span>
                </div>
                <div className="space-y-3">
                  {superchargers.map(sc => (
                    <div key={sc.id} className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{sc.name}</p>
                          <p className="text-sm text-slate-400">{sc.model} | {sc.totalPasses} passes</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${sc.status === 'Active' ? 'bg-green-500/20 text-green-400' : sc.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' : sc.status === 'Service' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'}`}>{sc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cylinder Heads */}
            {activeSection === 'heads' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Cylinder Head Inventory</h3>
                  <span className="text-sm text-slate-400">{cylinderHeads.length} heads</span>
                </div>
                <div className="space-y-3">
                  {cylinderHeads.map(head => (
                    <div key={head.id} className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{head.name}</p>
                          <p className="text-sm text-slate-400">S/N: {head.serialNumber} | {head.totalPasses} passes</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${head.position === 'Left' ? 'bg-blue-500/20 text-blue-400' : head.position === 'Right' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-500/20 text-slate-400'}`}>{head.position}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${head.status === 'Active' ? 'bg-green-500/20 text-green-400' : head.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{head.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maintenance Items */}
            {activeSection === 'maintenance' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Maintenance Schedule</h3>
                  <span className="text-sm text-slate-400">{maintenanceItems.length} items</span>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {maintenanceItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{item.component}</p>
                        <p className="text-sm text-slate-400">{item.category} | Every {item.passInterval} passes</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'Good' ? 'bg-green-500/20 text-green-400' : item.status === 'Due Soon' ? 'bg-yellow-500/20 text-yellow-400' : item.status === 'Due' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-500">Use the Maintenance & Safety section to add, edit, or delete maintenance items.</p>
              </div>
            )}

            {/* SFI Certifications */}
            {activeSection === 'sfi' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">SFI Certifications</h3>
                  <span className="text-sm text-slate-400">{sfiCertifications.length} items</span>
                </div>
                {sfiCertifications.filter(c => c.status === 'Expired').length > 0 && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">{sfiCertifications.filter(c => c.status === 'Expired').length} expired certification(s)</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {sfiCertifications.map(cert => (
                    <div key={cert.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{cert.item}</p>
                        <p className="text-sm text-slate-400">{cert.sfiSpec} | Expires: {cert.expirationDate}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${cert.status === 'Valid' ? 'bg-green-500/20 text-green-400' : cert.status === 'Expiring Soon' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{cert.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parts Inventory */}
            {activeSection === 'parts' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Parts Inventory Summary</h3>
                  <span className="text-sm text-slate-400">{partsInventory.length} parts</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm">Total Value</p>
                    <p className="text-xl font-bold text-green-400">${partsInventory.reduce((sum, p) => sum + p.totalValue, 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm">In Stock</p>
                    <p className="text-xl font-bold text-white">{partsInventory.filter(p => p.status === 'In Stock').length}</p>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm">Low Stock</p>
                    <p className="text-xl font-bold text-yellow-400">{partsInventory.filter(p => p.status === 'Low Stock').length}</p>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-400 text-sm">Out of Stock</p>
                    <p className="text-xl font-bold text-red-400">{partsInventory.filter(p => p.status === 'Out of Stock').length}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Use the Parts Inventory section for full inventory management with add, edit, and delete capabilities.</p>
              </div>
            )}

            {/* Backup & Restore */}
            {activeSection === 'backup' && (
              <BackupRestore currentRole={currentRole} />
            )}

            {/* Storage & Uploads Setup Guide */}
            {activeSection === 'storage' && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Upload className="w-6 h-6 text-orange-400" />
                    <h3 className="text-xl font-bold text-white">Storage & Upload Configuration</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-6">
                    This tool checks whether Supabase Storage RLS policies are correctly configured for the <code className="px-1.5 py-0.5 bg-slate-700 rounded text-orange-300 text-xs">media</code> bucket.
                  </p>
                  <StorageSetupGuide />

                </div>
              </div>
            )}

            {/* Sync History */}
            {activeSection === 'synchistory' && (
              <SyncHistoryTab />
            )}
          </div>



        </div>
      </div>

      {/* Team Member Modal - Full form matching TeamProfile */}
      {showMemberModal && canEditTeam && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingMember ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <button onClick={() => setShowMemberModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input type="text" value={newMember.name || ''} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Full name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input type="email" value={newMember.email || ''} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input type="tel" value={newMember.phone || ''} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Role</label>
                <select value={newMember.role || 'Crew'} onChange={(e) => setNewMember({ ...newMember, role: e.target.value as TeamMember['role'] })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  {memberRoles.map(role => (<option key={role} value={role}>{role}</option>))}
                </select>
                <p className="text-xs text-slate-500 mt-1">{getRoleDescription(newMember.role as CrewRole || 'Crew')}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Permissions</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => togglePermission('view')} className={`flex items-center gap-1 px-3 py-1.5 rounded border ${newMember.permissions?.includes('view') ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button type="button" onClick={() => togglePermission('edit')} className={`flex items-center gap-1 px-3 py-1.5 rounded border ${newMember.permissions?.includes('edit') ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button type="button" onClick={() => togglePermission('admin')} className={`flex items-center gap-1 px-3 py-1.5 rounded border ${newMember.permissions?.includes('admin') ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    <Shield className="w-4 h-4" /> Admin
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {specialtyOptions.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => {
                        const current = newMember.specialties || [];
                        if (current.includes(spec)) {
                          setNewMember({ ...newMember, specialties: current.filter(s => s !== spec) });
                        } else {
                          setNewMember({ ...newMember, specialties: [...current, spec] });
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm ${newMember.specialties?.includes(spec) ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-slate-700 text-slate-400'}`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="adminMemberActive" checked={newMember.isActive ?? true} onChange={(e) => setNewMember({ ...newMember, isActive: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500" />
                <label htmlFor="adminMemberActive" className="text-slate-300">Active member</label>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Joined Date</label>
                <DateInputDark value={newMember.joinedDate || ''} onChange={(e) => setNewMember({ ...newMember, joinedDate: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />


              </div>

              {/* Emergency Contact */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-400" />
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Contact Name</label>
                    <input type="text" value={newMember.emergencyContactName || ''} onChange={(e) => setNewMember({ ...newMember, emergencyContactName: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Emergency contact name" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Contact Phone</label>
                    <input type="tel" value={newMember.emergencyContactPhone || ''} onChange={(e) => setNewMember({ ...newMember, emergencyContactPhone: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="(555) 123-4567" />
                  </div>
                </div>
              </div>

              {/* Labor Cost Fields */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Labor Costs
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hourly Rate ($)</label>
                    <input type="number" step="5" min="0" value={newMember.hourlyRate || ''} onChange={(e) => setNewMember({ ...newMember, hourlyRate: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="e.g., 125" />
                    <p className="text-xs text-slate-500 mt-1">Per hour rate</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Daily Rate ($)</label>
                    <input type="number" step="50" min="0" value={newMember.dailyRate || ''} onChange={(e) => setNewMember({ ...newMember, dailyRate: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="e.g., 800" />
                    <p className="text-xs text-slate-500 mt-1">Per day rate</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={newMember.notes || ''} onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white h-20" placeholder="Additional notes..." />
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => { setShowMemberModal(false); setEditingMember(null); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveMember} disabled={!newMember.name} className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Audit Log Detail Modal */}
      {selectedLogEntry && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                Audit Log Details
              </h3>
              <button onClick={() => setSelectedLogEntry(null)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Timestamp</p>
                  <p className="text-white">{new Date(selectedLogEntry.timestamp || '').toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">User</p>
                  <p className="text-white">{selectedLogEntry.user_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Role</p>
                  <span className={`inline-block px-2 py-1 rounded text-sm ${getRoleColor(selectedLogEntry.user_role as CrewRole)}`}>
                    {selectedLogEntry.user_role}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Action</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${getActionColor(selectedLogEntry.action_type)}`}>
                    {getActionIcon(selectedLogEntry.action_type)}
                    {actionTypeLabels[selectedLogEntry.action_type]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Category</p>
                  <p className="text-white">{categoryLabels[selectedLogEntry.category as AuditCategory]}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Entity</p>
                  <p className="text-cyan-400">{selectedLogEntry.entity_name || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-slate-400 mb-1">Description</p>
                <p className="text-white bg-slate-900/50 rounded-lg p-3">{selectedLogEntry.description}</p>
              </div>
              
              {selectedLogEntry.before_value && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Before</p>
                  <pre className="text-sm text-red-300 bg-red-500/10 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selectedLogEntry.before_value, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLogEntry.after_value && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">After</p>
                  <pre className="text-sm text-green-300 bg-green-500/10 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selectedLogEntry.after_value, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLogEntry.metadata && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Additional Info</p>
                  <pre className="text-sm text-blue-300 bg-blue-500/10 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selectedLogEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedLogEntry(null)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Sample Data Section */}

      {activeSection === 'sampledata' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-bold text-white">Import Sample Data</h3>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-slate-600/30 p-5 mb-6">
            <p className="text-slate-300 mb-4">Load a small set of realistic example data so you can explore how the app works.</p>
            <div className="text-sm text-slate-400 space-y-1 mb-4">
              <p className="font-semibold text-slate-200 mb-2">What will be imported:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> 1 Engine (BAE Hemi 528)</div>
                <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-blue-400" /> 1 Supercharger (Littlefield 14-71)</div>
                <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-400" /> 3 Pass Logs</div>
                <div className="flex items-center gap-2"><Package className="w-4 h-4 text-purple-400" /> 5 Parts Inventory items</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> 5 Pre-Run Checklist items</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Duplicate records are automatically skipped.</p>
          </div>
          {sampleImportStatus === 'success' && (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-green-300 text-sm">{sampleImportMessage}</p>
            </div>
          )}
          {sampleImportStatus === 'error' && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-300 text-sm">{sampleImportMessage}</p>
            </div>
          )}
          <button
            onClick={() => setShowSampleDataConfirm(true)}
            disabled={sampleImportStatus === 'importing'}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {sampleImportStatus === 'importing' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
            ) : (
              <><Database className="w-4 h-4" /> Import Sample Data</>
            )}
          </button>
        </div>
      )}

      {/* Sample Data Confirmation Modal */}
      {showSampleDataConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <h4 className="text-lg font-bold text-white">Import Sample Data?</h4>
            </div>
            <p className="text-slate-300 text-sm mb-2">This will add sample records to your database:</p>
            <ul className="text-slate-400 text-sm space-y-1 mb-4 ml-4 list-disc">
              <li>1 engine, 1 supercharger</li>
              <li>3 pass logs, 5 parts, 5 checklist items</li>
            </ul>
            <p className="text-xs text-slate-500 mb-6">Existing records with the same IDs will be skipped.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSampleDataConfirm(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleImportSampleData} className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors">Yes, Import Data</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSettings;
