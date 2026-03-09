import React, { useState, useRef, useEffect, useMemo } from 'react';

import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrewRole, hasPermission, isAdminRole, getRoleColor } from '@/lib/permissions';
import SaveStatusIndicator from '@/components/race/SaveStatusIndicator';
import { checkMaintenanceAlerts, loadAlertSettings } from '@/lib/maintenanceAlerts';
import CarSelector from '@/components/race/CarSelector';

import {
  Gauge,
  ClipboardList,
  Wrench,
  Shield,
  FileText,
  Settings,
  Menu,
  X,
  AlertTriangle,
  Bell,
  Package,
  Database,
  Loader2,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Calendar,
  BarChart3,
  Camera,
  History,
  SlidersHorizontal,
  ChevronRight,
  DollarSign,
  CheckSquare,
  ListTodo,
  Cog,
  Play,
  ArrowLeftRight,
  Wifi,
  WifiOff,
  CloudUpload,
  HardDrive,
  Receipt,
  Fuel,
  Car,
  Activity
} from 'lucide-react';


interface NavigationProps {
  onNavigate: (section: string) => void;
  activeSection: string;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  currentRole?: CrewRole;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  requiresAdmin?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ onNavigate, activeSection, onOpenAuth, currentRole = 'Crew' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { getAlertCount, sfiCertifications, maintenanceItems, workOrders, partsInventory, isSyncing, lastSyncTime, syncError, refreshData, saveStatus, lastSaveTime, lastSaveError, retrySave, isOnline, pendingOfflineCount, hasConnectivityIssue, isOfflineSyncing, offlineSyncProgress, syncOfflineQueue } = useApp();
  const { user, profile, isAuthenticated, isDemoMode, signOut, disableDemoMode, isLoading: authLoading, isTeamMember, activeTeamMembership } = useAuth();
  const alertCount = getAlertCount();
  const [showOfflineTooltip, setShowOfflineTooltip] = useState(false);
  const [showAlertTooltip, setShowAlertTooltip] = useState(false);
  const alertTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute detailed alert breakdown for the tooltip
  const alertDetails = useMemo(() => {
    const details: { category: string; count: number; items: string[]; severity: 'critical' | 'warning'; navTarget: string }[] = [];

    const expiredCerts = sfiCertifications.filter(c => c.daysUntilExpiration <= 0);
    if (expiredCerts.length > 0) {
      details.push({
        category: 'Expired SFI Certifications',
        count: expiredCerts.length,
        items: expiredCerts.slice(0, 3).map(c => `${c.item} (${c.sfiSpec})`),
        severity: 'critical',
        navTarget: 'maintenance'
      });
    }

    const expiringSoonCerts = sfiCertifications.filter(c => c.daysUntilExpiration > 0 && c.daysUntilExpiration <= 60);
    if (expiringSoonCerts.length > 0) {
      details.push({
        category: 'SFI Certs Expiring Soon',
        count: expiringSoonCerts.length,
        items: expiringSoonCerts.slice(0, 3).map(c => `${c.item} — ${c.daysUntilExpiration}d left`),
        severity: 'warning',
        navTarget: 'maintenance'
      });
    }

    const dueMaintenance = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Overdue');
    if (dueMaintenance.length > 0) {
      details.push({
        category: 'Maintenance Due',
        count: dueMaintenance.length,
        items: dueMaintenance.slice(0, 3).map(m => `${m.component} (${m.status})`),
        severity: dueMaintenance.some(m => m.status === 'Overdue') ? 'critical' : 'warning',
        navTarget: 'maintenance'
      });
    }

    try {
      const alertSettings = loadAlertSettings();
      if (alertSettings.enabled && alertSettings.showBellAlerts) {
        const thresholdAlerts = checkMaintenanceAlerts(maintenanceItems, alertSettings);
        const dueIds = new Set(dueMaintenance.map(m => m.id));
        const additionalAlerts = thresholdAlerts.filter(a => !dueIds.has(a.maintenanceItemId));

        const criticalThreshold = additionalAlerts.filter(a => a.threshold.severity === 'critical');
        const warningThreshold = additionalAlerts.filter(a => a.threshold.severity === 'warning');
        const infoThreshold = additionalAlerts.filter(a => a.threshold.severity === 'info');

        if (criticalThreshold.length > 0) {
          details.push({
            category: 'Service Due (Threshold)',
            count: criticalThreshold.length,
            items: criticalThreshold.slice(0, 3).map(a => `${a.component} — ${a.percentUsed}% (${a.remainingPasses} left)`),
            severity: 'critical',
            navTarget: 'maintenance'
          });
        }
        if (warningThreshold.length > 0) {
          details.push({
            category: 'Service Imminent',
            count: warningThreshold.length,
            items: warningThreshold.slice(0, 3).map(a => `${a.component} — ${a.percentUsed}% (${a.remainingPasses} passes left)`),
            severity: 'warning',
            navTarget: 'maintenance'
          });
        }
        if (infoThreshold.length > 0) {
          details.push({
            category: 'Approaching Service',
            count: infoThreshold.length,
            items: infoThreshold.slice(0, 3).map(a => `${a.component} — ${a.percentUsed}% (${a.remainingPasses} passes left)`),
            severity: 'warning',
            navTarget: 'maintenance'
          });
        }
      }
    } catch (err) {
      console.warn('[Navigation] Error loading threshold alerts:', err);
    }

    const criticalWOs = workOrders.filter(w => w.priority === 'Critical' && w.status !== 'Completed');
    if (criticalWOs.length > 0) {
      details.push({
        category: 'Critical Work Orders',
        count: criticalWOs.length,
        items: criticalWOs.slice(0, 3).map(w => `${w.title} (${w.status})`),
        severity: 'critical',
        navTarget: 'workorders'
      });
    }

    const lowStockParts = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock');
    if (lowStockParts.length > 0) {
      details.push({
        category: 'Low / Out of Stock Parts',
        count: lowStockParts.length,
        items: lowStockParts.slice(0, 3).map(p => `${p.name} (${p.onHand}/${p.minQuantity})`),
        severity: lowStockParts.some(p => p.status === 'Out of Stock') ? 'critical' : 'warning',
        navTarget: 'parts'
      });
    }

    return details;
  }, [sfiCertifications, maintenanceItems, workOrders, partsInventory]);


  const handleAlertMouseEnter = () => {
    if (alertTooltipTimeoutRef.current) clearTimeout(alertTooltipTimeoutRef.current);
    setShowAlertTooltip(true);
  };

  const handleAlertMouseLeave = () => {
    alertTooltipTimeoutRef.current = setTimeout(() => {
      setShowAlertTooltip(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (alertTooltipTimeoutRef.current) clearTimeout(alertTooltipTimeoutRef.current);
    };
  }, []);

  const teamMemberCanAccessAdmin = isTeamMember && activeTeamMembership?.permissions?.includes('admin');
  const canAccessAdmin = !isTeamMember
    ? (isAdminRole(currentRole) || hasPermission(currentRole, 'settings.admin'))
    : teamMemberCanAccessAdmin;

  const isViewOnly = isTeamMember && activeTeamMembership?.permissions?.length === 1 && activeTeamMembership.permissions[0] === 'view';

  // ── Navigation items reordered: Maintenance moved between Analytics and Main Components ──
  // Row 1: Core operations & data entry
  const row1Items: NavItem[] = [
    { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
    { id: 'cars', label: 'Cars', icon: Car },
    { id: 'dashboard', label: 'Dashboard', icon: Gauge },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'timeline', label: 'Timeline', icon: Activity },
    { id: 'passlog', label: 'Pass Log', icon: ClipboardList },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'engines', label: 'Main Components', icon: Cog },
    { id: 'parts', label: 'Parts', icon: Package },
    { id: 'partsusage', label: 'Parts Usage', icon: History },
  ];


  // Row 2: Business, admin, and secondary features
  const row2Items: NavItem[] = [
    { id: 'borrowedloaned', label: 'Borrowed/Loaned', icon: ArrowLeftRight },
    { id: 'vendors', label: 'Vendors', icon: Database },
    { id: 'costs', label: 'Cost Reports', icon: DollarSign },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'fuellog', label: 'Fuel Log', icon: Fuel },
    { id: 'workorders', label: 'Work Orders', icon: FileText },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare },
    { id: 'todo', label: 'To Do', icon: ListTodo },
    { id: 'gallery', label: 'Gallery', icon: Camera },
    { id: 'backup', label: 'Backup', icon: HardDrive },
    { id: 'admin', label: 'Admin', icon: Settings, requiresAdmin: true },
  ];




  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  // ── Render a single nav tab button ──
  const renderNavTab = (item: NavItem) => {
    const Icon = item.icon;
    if (item.requiresAdmin && !canAccessAdmin) return null;
    const isActive = activeSection === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
          transition-all duration-150 whitespace-nowrap border
          ${isActive
            ? 'bg-orange-500/25 border-orange-500/70 text-orange-300 shadow-md shadow-orange-500/15 ring-1 ring-orange-500/30'
            : 'bg-slate-800/90 border-slate-600/50 text-slate-400 hover:bg-slate-700/90 hover:text-slate-100 hover:border-slate-500/70'
          }
        `}
      >
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
        {item.label}
        {item.requiresAdmin && <Shield className="w-3 h-3 text-purple-400" />}
      </button>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50">
      {/* Team Member Banner */}
      {isTeamMember && activeTeamMembership && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 px-3 py-1.5">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-300">
                Viewing <span className="font-semibold text-blue-200">{activeTeamMembership.teamOwnerName}</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                {activeTeamMembership.role}
              </span>
              <span className="text-blue-400/60">|</span>
              <span className="text-blue-400/80">
                {activeTeamMembership.permissions.join(', ')}
              </span>
              {isViewOnly && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                  Read Only
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Top Bar: Logo + Car Selector + Status/Auth ═══════════ */}
      <div className="max-w-[1920px] mx-auto px-3">
        <div className="flex items-center justify-between h-12">
          {/* Logo + Car Selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Gauge className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="hidden xl:block">
              <h1 className="text-sm font-bold text-white leading-tight">
                {isTeamMember && activeTeamMembership
                  ? activeTeamMembership.teamOwnerName
                  : isAuthenticated && profile?.teamName ? profile.teamName : 'Professional Racing Management'}
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight">
                {isTeamMember ? `Crew Member - ${activeTeamMembership?.role}` : 'Race Team Management'}
              </p>
            </div>
            {/* Car Selector */}
            <div className="hidden lg:block ml-1">
              <CarSelector />
            </div>
          </div>

          {/* Right side: Sync Status, Alert Badge, Auth & Mobile Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Offline / Connectivity Status Indicator */}
            <div className="relative">
              <button
                onClick={() => {
                  if (pendingOfflineCount > 0 && isOnline && !isOfflineSyncing) {
                    syncOfflineQueue();
                  }
                  setShowOfflineTooltip(!showOfflineTooltip);
                }}
                onMouseEnter={() => setShowOfflineTooltip(true)}
                onMouseLeave={() => setShowOfflineTooltip(false)}
                className={`relative p-1.5 rounded-lg transition-colors ${
                  !isOnline || hasConnectivityIssue
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : isOfflineSyncing
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    : pendingOfflineCount > 0
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                }`}
                title={
                  !isOnline ? 'Offline — data saved locally' :
                  hasConnectivityIssue ? 'Connection unstable' :
                  isOfflineSyncing ? `Syncing ${offlineSyncProgress}%` :
                  pendingOfflineCount > 0 ? `${pendingOfflineCount} items pending sync` :
                  'Online'
                }
              >
                {!isOnline || hasConnectivityIssue ? (
                  <WifiOff className="w-4 h-4" />
                ) : isOfflineSyncing ? (
                  <CloudUpload className="w-4 h-4 animate-pulse" />
                ) : pendingOfflineCount > 0 ? (
                  <CloudUpload className="w-4 h-4" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {pendingOfflineCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingOfflineCount > 99 ? '99+' : pendingOfflineCount}
                  </span>
                )}
              </button>

              {/* Offline Tooltip */}
              {showOfflineTooltip && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 px-3 z-50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      !isOnline || hasConnectivityIssue ? 'bg-red-400' :
                      isOfflineSyncing ? 'bg-blue-400 animate-pulse' :
                      pendingOfflineCount > 0 ? 'bg-amber-400' :
                      'bg-emerald-400'
                    }`} />
                    <span className="text-xs font-semibold text-white">
                      {!isOnline ? 'Offline' :
                       hasConnectivityIssue ? 'Connection Unstable' :
                       isOfflineSyncing ? 'Syncing...' :
                       'Online'}
                    </span>
                  </div>

                  {(!isOnline || hasConnectivityIssue) && (
                    <p className="text-[11px] text-slate-400 mb-2">
                      Data is being saved locally and will sync automatically when connection is restored.
                    </p>
                  )}

                  {isOfflineSyncing && (
                    <div className="mb-2">
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${offlineSyncProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Syncing {offlineSyncProgress}%</p>
                    </div>
                  )}

                  {pendingOfflineCount > 0 && !isOfflineSyncing && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-amber-400">
                        {pendingOfflineCount} item{pendingOfflineCount !== 1 ? 's' : ''} pending
                      </span>
                      {isOnline && (
                        <button
                          onClick={(e) => { e.stopPropagation(); syncOfflineQueue(); }}
                          className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors font-medium"
                        >
                          Sync Now
                        </button>
                      )}
                    </div>
                  )}

                  {pendingOfflineCount === 0 && isOnline && !hasConnectivityIssue && (
                    <p className="text-[11px] text-emerald-400/80">All data synced</p>
                  )}
                </div>
              )}
            </div>

            {/* Role Badge */}
            {isAuthenticated && (
              <span className={`hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleColor(currentRole)}`}>
                <Shield className="w-3 h-3" />
                {currentRole}
              </span>
            )}

            {/* Save Status Indicator */}
            <SaveStatusIndicator
              saveStatus={saveStatus}
              lastSaveTime={lastSaveTime}
              lastSaveError={lastSaveError}
              onRetry={retrySave}
              onRefresh={refreshData}
              isSyncing={isSyncing}
              syncError={syncError}
              lastSyncTime={lastSyncTime}
            />

            {/* Alert Badge with Hover Tooltip */}
            {alertCount > 0 && (
              <div
                className="relative"
                onMouseEnter={handleAlertMouseEnter}
                onMouseLeave={handleAlertMouseLeave}
              >
                <button
                  onClick={() => {
                    setShowAlertTooltip(false);
                    onNavigate('maintenance');
                  }}
                  className="relative p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {alertCount}
                  </span>
                </button>

                {/* Alert Details Tooltip */}
                {showAlertTooltip && (
                  <div
                    className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden"
                    onMouseEnter={handleAlertMouseEnter}
                    onMouseLeave={handleAlertMouseLeave}
                  >
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500/15 to-orange-500/10 border-b border-slate-700/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {alertCount} Active Alert{alertCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto py-1">
                      {alertDetails.map((detail, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setShowAlertTooltip(false);
                            onNavigate(detail.navTarget);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                detail.severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'
                              }`} />
                              <span className={`text-xs font-semibold ${
                                detail.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                              }`}>
                                {detail.category}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              detail.severity === 'critical'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {detail.count}
                            </span>
                          </div>
                          <div className="ml-4 space-y-0.5">
                            {detail.items.map((item, itemIdx) => (
                              <p key={itemIdx} className="text-[11px] text-slate-400 truncate leading-relaxed">
                                {item}
                              </p>
                            ))}
                            {detail.count > 3 && (
                              <p className="text-[11px] text-slate-500 italic">
                                +{detail.count - 3} more...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-orange-400 font-medium">View details</span>
                            <ChevronRight className="w-3 h-3 text-orange-400" />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="px-4 py-2 border-t border-slate-700/80 bg-slate-800/50">
                      <button
                        onClick={() => {
                          setShowAlertTooltip(false);
                          onNavigate('maintenance');
                        }}
                        className="w-full text-center text-[11px] text-orange-400 hover:text-orange-300 font-medium transition-colors"
                      >
                        View All Alerts in Maintenance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auth Section */}
            {authLoading ? (
              <div className="p-1.5">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            ) : isDemoMode ? (
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg">
                  <Play className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Demo</span>
                </div>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:block text-xs font-medium">Sign Up</span>
                </button>
                <button
                  onClick={() => {
                    disableDemoMode();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Exit Demo Mode"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="hidden xl:block text-xs font-medium max-w-[100px] truncate">
                    {profile?.teamName || user?.email?.split('@')[0]}
                  </span>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-700">
                        <p className="text-sm font-medium text-white truncate">
                          {profile?.teamName || 'My Team'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(currentRole)}`}>
                          <Shield className="w-3 h-3" />
                          {currentRole}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          onNavigate('profile');
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Team Profile
                      </button>

                      {canAccessAdmin && (
                        <button
                          onClick={() => {
                            onNavigate('admin');
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Admin Settings
                        </button>
                      )}

                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:block text-xs font-medium">Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:block text-xs font-medium">Sign Up</span>
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ═══════════ Desktop Two-Row Navigation Tabs ═══════════ */}
        <div className="hidden lg:block pb-2 pt-0.5">
          {/* Row 1 — Core Operations */}
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mr-1 w-12 flex-shrink-0 text-right">Core</span>
            {row1Items.map(item => renderNavTab(item))}
          </div>
          {/* Row 2 — Business & Admin */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mr-1 w-12 flex-shrink-0 text-right">More</span>
            {row2Items.map(item => renderNavTab(item))}
            {/* Profile tab (only when logged in) */}
            {isAuthenticated && (
              <button
                onClick={() => onNavigate('profile')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                  transition-all duration-150 whitespace-nowrap border
                  ${activeSection === 'profile'
                    ? 'bg-orange-500/25 border-orange-500/70 text-orange-300 shadow-md shadow-orange-500/15 ring-1 ring-orange-500/30'
                    : 'bg-slate-800/90 border-slate-600/50 text-slate-400 hover:bg-slate-700/90 hover:text-slate-100 hover:border-slate-500/70'
                  }
                `}
              >
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                Profile
              </button>
            )}
          </div>
        </div>

        {/* ═══════════ Mobile Navigation ═══════════ */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-700/50 max-h-[70vh] overflow-y-auto">
            {/* Car Selector in mobile */}
            <div className="mb-3 px-2">
              <CarSelector />
            </div>

            {/* Role Badge in Mobile */}
            {isAuthenticated && (
              <div className="mb-3 px-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleColor(currentRole)}`}>
                  <Shield className="w-3 h-3" />
                  {currentRole}
                </span>
              </div>
            )}

            {/* Mobile: Row 1 label */}
            <div className="px-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Core</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1 mb-3">
              {row1Items.map((item) => {
                const Icon = item.icon;
                if (item.requiresAdmin && !canAccessAdmin) return null;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-orange-500/25 border-orange-500/60 text-orange-300'
                        : 'bg-slate-800/80 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile: Row 2 label */}
            <div className="px-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">More</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1">
              {row2Items.map((item) => {
                const Icon = item.icon;
                if (item.requiresAdmin && !canAccessAdmin) return null;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-orange-500/25 border-orange-500/60 text-orange-300'
                        : 'bg-slate-800/80 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.requiresAdmin && <Shield className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                  </button>
                );
              })}

              {/* Profile in mobile menu */}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    onNavigate('profile');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    activeSection === 'profile'
                      ? 'bg-orange-500/25 border-orange-500/60 text-orange-300'
                      : 'bg-slate-800/80 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4 flex-shrink-0" />
                  Profile
                </button>
              )}
            </div>

            {/* Mobile Auth Buttons */}
            {!isAuthenticated && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50 px-1">
                <button
                  onClick={() => {
                    onOpenAuth('login');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 text-white text-sm border border-slate-600/50"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    onOpenAuth('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm border border-orange-500/50"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
