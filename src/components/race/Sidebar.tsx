import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCar } from '@/contexts/CarContext';
import { useApp } from '@/contexts/AppContext';
import { useThemeColor, useAccentStyles } from '@/contexts/ThemeColorContext';
import { CrewRole, isAdminRole, hasPermission, getRoleColor } from '@/lib/permissions';
import SaveStatusIndicator from '@/components/race/SaveStatusIndicator';
import CarSelector from '@/components/race/CarSelector';
import GlobalSearch from '@/components/race/GlobalSearch';

import {
  Gauge, Car, ClipboardList, Wrench, Shield, FileText, Settings,
  Menu, X, Package, Calendar, BarChart3, Camera, History,
  SlidersHorizontal, ChevronDown, ChevronRight, DollarSign,
  CheckSquare, ListTodo, Cog, ArrowLeftRight, Receipt, Fuel,
  User, LogOut, LogIn, UserPlus, Play, Bell, AlertTriangle,
  Loader2, Wifi, WifiOff, CloudUpload, Users, LayoutDashboard,
  Home, HardDrive
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  currentRole: CrewRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  submenu?: { id: string; label: string; icon: React.ElementType }[];
  requiresAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  onOpenAuth,
  currentRole,
  collapsed,
  onToggleCollapse,
}) => {
  const { user, profile, isAuthenticated, isDemoMode, signOut, disableDemoMode, isLoading: authLoading, isTeamMember, activeTeamMembership } = useAuth();
  const { cars, selectedCarId, getCarLabel } = useCar();
  const { getAlertCount, saveStatus, lastSaveTime, lastSaveError, retrySave, refreshData, isSyncing, syncError, lastSyncTime, isOnline, pendingOfflineCount, hasConnectivityIssue, isOfflineSyncing, offlineSyncProgress, syncOfflineQueue } = useApp();
  const { colors } = useThemeColor();
  const styles = useAccentStyles();
  const alertCount = getAlertCount();

  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const canAccessAdmin = !isTeamMember
    ? (isAdminRole(currentRole) || hasPermission(currentRole, 'settings.admin'))
    : isTeamMember && activeTeamMembership?.permissions?.includes('admin');

  // Get the selected car for the active car indicator
  const selectedCar = selectedCarId ? cars.find(c => c.id === selectedCarId) : null;

  // Build car submenu items from actual car profiles
  const carSubmenuItems = cars.map(car => ({
    id: `car-${car.id}`,
    label: car.nickname || `#${car.carNumber}` || `${car.make} ${car.model}` || 'Car',
    icon: Car,
  }));

  const menuItems: MenuItem[] = [
    {
      id: 'cars',
      label: 'Race Cars',
      icon: Car,
      submenu: carSubmenuItems.length > 0 ? carSubmenuItems : [{ id: 'cars', label: 'Car Profiles', icon: Car }],
    },
    {
      id: 'raceday',
      label: 'Race Day',
      icon: Gauge,
      submenu: [
        { id: 'passlog', label: 'Pass Log', icon: ClipboardList },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'checklists', label: 'Checklists', icon: CheckSquare },
        { id: 'todo', label: 'To Do', icon: ListTodo },
        { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      ],
    },
    {
      id: 'partsgroup',
      label: 'Parts & Components',
      icon: Package,
      submenu: [
        { id: 'engines', label: 'Main Components', icon: Cog },
        { id: 'parts', label: 'Parts', icon: Package },
        { id: 'partsusage', label: 'Parts Usage', icon: History },
        { id: 'borrowedloaned', label: 'Borrowed or Loaned', icon: ArrowLeftRight },
      ],
    },
    { id: 'calendar', label: 'Event Calendar', icon: Calendar },
    { id: 'vendors', label: 'Vendors', icon: Users },
    {
      id: 'finances',
      label: 'Finances',
      icon: DollarSign,
      submenu: [
        { id: 'expenses', label: 'Expenses', icon: Receipt },
        { id: 'costs', label: 'Cost Reports', icon: DollarSign },
        { id: 'fuellog', label: 'Fuel Log', icon: Fuel },
      ],
    },
    { id: 'workorders', label: 'Work Orders', icon: FileText },
    { id: 'gallery', label: 'Gallery', icon: Camera },
    { id: 'profile', label: 'Team & Crew Profile', icon: User },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
  ];

  // Auto-expand the menu group that contains the active section
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.submenu) {
        const hasActive = item.submenu.some(sub => sub.id === activeSection);
        if (hasActive) {
          setExpandedMenus(prev => new Set([...prev, item.id]));
        }
      }
    });
  }, [activeSection]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  const handleNavigate = (section: string) => {
    // Handle car-specific navigation
    if (section.startsWith('car-')) {
      onNavigate('cars');
    } else {
      onNavigate(section);
    }
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  const isActiveSection = (id: string) => {
    if (id.startsWith('car-')) return activeSection === 'cars';
    return activeSection === id;
  };

  const isParentActive = (item: MenuItem) => {
    if (!item.submenu) return activeSection === item.id;
    return item.submenu.some(sub => isActiveSection(sub.id));
  };

  const sidebarContent = (
    <div className="flex flex-col h-full theme-transition">
      {/* Logo / Header */}
      <div className="px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={styles.logoGradient}
          >
            <Gauge className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate leading-tight">
                {isTeamMember && activeTeamMembership
                  ? activeTeamMembership.teamOwnerName
                  : isAuthenticated && profile?.teamName ? profile.teamName : 'Pro Mod Logbook'}
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight truncate">
                {isTeamMember ? `Crew - ${activeTeamMembership?.role}` : 'Race Team Management'}
              </p>
            </div>
          )}
        </div>

        {/* Car Selector */}
        {!collapsed && (
          <div className="mt-3">
            <CarSelector />
          </div>
        )}
      </div>

      {/* Active Car Indicator — always visible at top */}
      {!collapsed && (
        <div
          className="px-3 py-2.5 border-b border-slate-700/50"
          style={{
            backgroundColor: selectedCar ? `rgba(${colors.rgb}, 0.08)` : 'transparent',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-slate-900"
              style={{
                backgroundColor: colors.base,
                ringColor: `rgba(${colors.rgb}, 0.4)`,
                boxShadow: `0 0 8px rgba(${colors.rgb}, 0.4), inset 0 0 0 2px rgba(${colors.rgb}, 0.3)`,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold truncate" style={{ color: colors.light }}>
                {selectedCar ? getCarLabel(selectedCarId) : 'All Cars'}
              </p>
              <p className="text-[9px] text-slate-500 truncate">
                {selectedCar
                  ? `${selectedCar.class || 'No class'} ${selectedCar.isActive ? '' : '(Inactive)'}`
                  : 'Combined team view'}
              </p>
            </div>
            {selectedCar && (
              <div
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `rgba(${colors.rgb}, 0.2)`,
                }}
              >
                <Car className="w-3 h-3" style={{ color: colors.light }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed: just show color dot */}
      {collapsed && (
        <div className="px-2 py-3 border-b border-slate-700/50 flex justify-center">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: colors.base,
              boxShadow: `0 0 8px rgba(${colors.rgb}, 0.5)`,
            }}
            title={selectedCar ? getCarLabel(selectedCarId) : 'All Cars'}
          />
        </div>
      )}

      {/* Team Member Banner */}
      {isTeamMember && activeTeamMembership && !collapsed && (
        <div className="px-3 py-2 bg-blue-600/15 border-b border-blue-500/20">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <span className="text-blue-300 truncate">
              Viewing <span className="font-semibold">{activeTeamMembership.teamOwnerName}</span>
            </span>
          </div>
        </div>
      )}

      {/* Status Bar */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-slate-700/50 flex items-center gap-2">
          {/* Online/Offline */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            !isOnline || hasConnectivityIssue ? 'bg-red-400' :
            isOfflineSyncing ? 'bg-blue-400 animate-pulse' :
            pendingOfflineCount > 0 ? 'bg-amber-400' :
            'bg-emerald-400'
          }`} />
          <span className="text-[10px] text-slate-500 flex-1">
            {!isOnline ? 'Offline' : hasConnectivityIssue ? 'Unstable' : isOfflineSyncing ? 'Syncing...' : 'Online'}
          </span>

          {/* Save Status */}
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

          {/* Alert Badge */}
          {alertCount > 0 && (
            <button
              onClick={() => handleNavigate('maintenance')}
              className="relative p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Global Search */}
      <GlobalSearch onNavigate={handleNavigate} collapsed={collapsed} />

      {/* Navigation Menu */}

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {menuItems.map(item => {
          const Icon = item.icon;
          const hasSubmenu = !!item.submenu;
          const isExpanded = expandedMenus.has(item.id);
          const parentActive = isParentActive(item);

          if (item.requiresAdmin && !canAccessAdmin) return null;

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (hasSubmenu) {
                    toggleMenu(item.id);
                  } else {
                    handleNavigate(item.id);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group border ${
                  parentActive && !hasSubmenu
                    ? 'border-current'
                    : parentActive && hasSubmenu
                    ? 'bg-slate-800 text-white border-slate-600/50'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border-transparent'
                }`}
                style={
                  parentActive && !hasSubmenu
                    ? styles.activeMenuItem
                    : undefined
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className="w-5 h-5 flex-shrink-0"
                  style={
                    parentActive
                      ? { color: colors.base }
                      : { color: undefined }
                  }
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {hasSubmenu && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        style={parentActive ? { color: colors.base } : { color: 'rgb(71 85 105)' }}
                      />
                    )}
                  </>
                )}
              </button>

              {/* Submenu */}
              {hasSubmenu && isExpanded && !collapsed && (
                <div className="ml-4 mt-0.5 mb-1 pl-3 border-l border-slate-700/50 space-y-0.5">
                  {item.submenu!.map(sub => {
                    const SubIcon = sub.icon;
                    const subActive = isActiveSection(sub.id);

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNavigate(sub.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                          subActive
                            ? 'border-current'
                            : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 border-transparent'
                        }`}
                        style={subActive ? styles.activeSubItem : undefined}
                      >
                        <SubIcon
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={subActive ? { color: colors.base } : undefined}
                        />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin & Backup */}
        {canAccessAdmin && (
          <>
            <div className="pt-2 mt-2 border-t border-slate-700/50">
              <button
                onClick={() => handleNavigate('admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'admin'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Settings className={`w-4.5 h-4.5 flex-shrink-0 ${activeSection === 'admin' ? 'text-purple-400' : 'text-slate-500'}`} />
                {!collapsed && <span className="flex-1 text-left">Admin</span>}
              </button>
            </div>
          </>
        )}

        {/* Backup */}
        <button
          onClick={() => handleNavigate('backup')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
            activeSection === 'backup'
              ? 'border-current'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border-transparent'
          }`}
          style={activeSection === 'backup' ? styles.activeMenuItem : undefined}
        >
          <HardDrive
            className="w-4.5 h-4.5 flex-shrink-0"
            style={activeSection === 'backup' ? { color: colors.base } : { color: 'rgb(100 116 139)' }}
          />
          {!collapsed && <span className="flex-1 text-left">Backup</span>}
        </button>
      </nav>

      {/* User Section at Bottom */}
      <div className="border-t border-slate-700/50 p-3">
        {authLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : isDemoMode ? (
          <div className="space-y-2">
            {!collapsed && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 rounded-lg">
                <Play className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-400 font-medium">Demo Mode</span>
              </div>
            )}
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium hover:brightness-110 transition-all"
              style={styles.gradientBtn}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {!collapsed && 'Sign Up'}
            </button>
          </div>
        ) : isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={styles.avatarGradient}
              >
                <User className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <div className="min-w-0 text-left">
                  <p className="text-xs font-medium text-white truncate">
                    {profile?.teamName || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
              )}
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <p className="text-sm font-medium text-white truncate">{profile?.teamName || 'My Team'}</p>
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(currentRole)}`}>
                      <Shield className="w-3 h-3" />
                      {currentRole}
                    </span>
                  </div>
                  <button
                    onClick={() => { handleNavigate('profile'); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Team Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={() => onOpenAuth('login')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              {!collapsed && 'Sign In'}
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium hover:brightness-110 transition-all"
              style={styles.gradientBtn}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {!collapsed && 'Sign Up'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white shadow-lg"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900/98 border-r border-slate-700/50 z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-16' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
