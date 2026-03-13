
import React, { useState, useRef, useEffect } from 'react';

import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/contexts/AuthContext';

import { AppProvider, useApp } from '@/contexts/AppContext';
import { CarProvider } from '@/contexts/CarContext';

// Layout components
import Sidebar from './race/Sidebar';
import LoginScreen from './race/LoginScreen';
import DashboardGrid from './race/DashboardGrid';
import LoginAlertPopup from './race/LoginAlertPopup';

// Section components
import Dashboard from './race/Dashboard';
import PassLog from './race/PassLog';
import SetupLibrary from './race/SetupLibrary';
import PartsInventory from './race/PartsInventory';
import PartsUsageHistory from './race/PartsUsageHistory';
import BackupRestore from './race/BackupRestore';
import MaintenanceTracker from './race/MaintenanceTracker';
import TeamNotes from './race/TeamNotes';
import HeroSection from './race/HeroSection';

import AuthModal from './auth/AuthModal';
import PasswordResetHandler from './auth/PasswordResetHandler';
import DemoModeBanner from './auth/DemoModeBanner';
import TeamProfile from './race/TeamProfile';
import RaceCalendar from './race/RaceCalendar';
import AnalyticsDashboard from './race/AnalyticsDashboard';
import CrewChecklist from './race/CrewChecklist';
import AdminSettings from './race/AdminSettings';
import MediaGallery from './race/MediaGallery';
import ToDoList from './race/ToDoList';
import WorkOrderSystem from './race/WorkOrderSystem';
import VendorManagement from './race/VendorManagement';
import CostAnalytics from './race/CostAnalytics';
import InitialSetup from './race/InitialSetup';
import OnboardingWizard from './race/OnboardingWizard';
import BetaFeedback from './race/BetaFeedback';
import { InviteAcceptBanner } from './race/TeamInviteFlow';
import BorrowedLoanedParts from './race/BorrowedLoanedParts';
import MiscExpenses from './race/MiscExpenses';
import FuelLog from './race/FuelLog';
import CarProfiles from './race/CarProfiles';
import BulkCarAssign from './race/BulkCarAssign';
import RaceDayTimeline from './race/RaceDayTimeline';

import { CrewRole, hasPermission, isAdminRole, Permission } from '@/lib/permissions';
import { TeamMember } from './race/TeamProfile';
import { auditLog } from '@/lib/auditLog';


const AppLayoutContent: React.FC = () => {
  const { setTheme } = useTheme();
  const { profile, user, isAuthenticated, isDemoMode, showPasswordReset, isTeamMember, activeTeamMembership } = useAuth();
  const { teamMembers } = useApp();

  const [activeSection, setActiveSection] = useState('profile');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [selectedCrewMember, setSelectedCrewMember] = useState<TeamMember | null>(null);
  const [manuallySelected, setManuallySelected] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [hasShownLoginAlert, setHasShownLoginAlert] = useState(false);

  // Reorder list trigger
  const [reorderListTrigger, setReorderListTrigger] = useState(0);

  // Set dark theme on mount
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  // Show login alert popup after authentication
  useEffect(() => {
    if (isAuthenticated && !hasShownLoginAlert && !isDemoMode) {
      // Delay to allow data to load
      const timer = setTimeout(() => {
        setShowLoginAlert(true);
        setHasShownLoginAlert(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasShownLoginAlert, isDemoMode]);

  // Reset alert flag on logout
  useEffect(() => {
    if (!isAuthenticated && !isDemoMode) {
      setHasShownLoginAlert(false);
      setActiveSection('profile');
    }
  }, [isAuthenticated, isDemoMode]);

  // Reset manual selection when user changes
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentUserId = user?.id;
    if (currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId;
      setManuallySelected(false);
    }
  }, [user?.id]);

  // Auto-select the best crew member
  useEffect(() => {
    if (manuallySelected) return;

    let bestMember: TeamMember | null = null;

    if (teamMembers.length > 0) {
      if (user?.email) {
        bestMember = teamMembers.find(
          m => m.email?.toLowerCase() === user.email?.toLowerCase()
        ) || null;
      }
      if (!bestMember) {
        bestMember = teamMembers.find(m => m.role === 'Owner') ||
                     teamMembers.find(m => m.role === 'Crew Chief') ||
                     null;
      }
      if (!bestMember) {
        bestMember = teamMembers[0];
      }
    }

    if (!bestMember) {
      bestMember = {
        id: 'default',
        name: profile?.driverName || user?.email?.split('@')[0] || 'Crew Member',
        role: isAuthenticated ? 'Owner' : 'Crew',
        permissions: isAuthenticated ? ['view', 'edit', 'admin'] as ('view' | 'edit' | 'admin')[] : ['view', 'edit'] as ('view' | 'edit')[],
        isActive: true
      };
    }

    setSelectedCrewMember(prev => {
      if (prev?.id === bestMember!.id && prev?.role === bestMember!.role && prev?.name === bestMember!.name) {
        return prev;
      }
      auditLog.setCurrentUser({
        id: bestMember!.id,
        name: bestMember!.name,
        role: bestMember!.role as CrewRole
      });
      return bestMember;
    });
  }, [teamMembers, isAuthenticated, isDemoMode, user?.email, user?.id, profile?.driverName, manuallySelected]);

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    // Scroll to top when changing sections
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReorderList = () => {
    setActiveSection('parts');
    setReorderListTrigger(prev => prev + 1);
  };

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Get current user's role
  const getCurrentRole = (): CrewRole => {
    if (isDemoMode) return 'Owner';
    if (isAuthenticated && !isTeamMember) return 'Owner';
    if (isTeamMember && activeTeamMembership) {
      const memberRole = activeTeamMembership.role;
      switch (memberRole) {
        case 'Owner': return 'Owner';
        case 'Driver': return 'Driver';
        case 'Crew Chief': return 'Crew Chief';
        case 'Crew': return 'Crew';
        case 'Mechanic': return 'Mechanic';
        case 'Tuner': return 'Tuner';
        case 'Sponsor': return 'Sponsor';
        default: return 'Crew';
      }
    }
    if (!selectedCrewMember) return 'Crew';
    const role = selectedCrewMember.role;
    switch (role) {
      case 'Owner': return 'Owner';
      case 'Driver': return 'Driver';
      case 'Crew Chief': return 'Crew Chief';
      case 'Crew': return 'Crew';
      case 'Mechanic': return 'Mechanic';
      case 'Tuner': return 'Tuner';
      case 'Sponsor': return 'Sponsor';
      default: return 'Crew';
    }
  };

  const currentRole = getCurrentRole();

  const userHasPermission = (permission: Permission): boolean => {
    return hasPermission(currentRole, permission);
  };

  const canEditChecklists = userHasPermission('checklist.edit');
  const canAccessAdmin = isAdminRole(currentRole) || userHasPermission('settings.admin');

  const handleCrewMemberChange = (memberId: string) => {
    setManuallySelected(true);
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      setSelectedCrewMember(member);
      auditLog.setCurrentUser({
        id: member.id,
        name: member.name,
        role: member.role as CrewRole
      });
    } else if (memberId === 'default') {
      const defaultMember = {
        id: 'default',
        name: profile?.driverName || 'Crew Member',
        role: 'Crew' as const,
        permissions: ['view'] as ('view')[],
        isActive: true
      };
      setSelectedCrewMember(defaultMember);
      auditLog.setCurrentUser({
        id: defaultMember.id,
        name: defaultMember.name,
        role: defaultMember.role as CrewRole
      });
    }
  };

  // Auto-open auth modal when password reset is triggered
  useEffect(() => {
    if (showPasswordReset) {
      setAuthModalOpen(true);
    }
  }, [showPasswordReset]);

  // Render the active section content
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardGrid onNavigate={handleNavigate} />;

      case 'dashboard-detail':
        return (
          <Dashboard onNavigate={handleNavigate} onOpenReorderList={handleOpenReorderList} />
        );

      case 'setup':
        return (
          <div className="bg-slate-950">
            <InitialSetup currentRole={currentRole} />
          </div>
        );

      case 'cars':
        return (
          <div className="bg-slate-900/30">
            <CarProfiles currentRole={currentRole} />
            <BulkCarAssign />
          </div>
        );

      case 'passlog':
        return <PassLog currentRole={currentRole} />;

      case 'calendar':
        return <RaceCalendar currentRole={currentRole} />;

      case 'timeline':
        return (
          <div className="bg-slate-900/30">
            <RaceDayTimeline />
          </div>
        );

      case 'analytics':
        return <AnalyticsDashboard currentRole={currentRole} />;

      case 'engines':
        return <SetupLibrary currentRole={currentRole} />;

      case 'parts':
        return <PartsInventory currentRole={currentRole} reorderListTrigger={reorderListTrigger} />;

      case 'partsusage':
        return (
          <div className="bg-slate-900/30">
            <PartsUsageHistory />
          </div>
        );

      case 'borrowedloaned':
        return (
          <div className="bg-slate-950">
            <BorrowedLoanedParts onNavigate={handleNavigate} />
          </div>
        );

      case 'vendors':
        return (
          <div className="bg-slate-900/30">
            <VendorManagement currentRole={currentRole} />
          </div>
        );

      case 'costs':
        return (
          <div className="bg-slate-950">
            <CostAnalytics currentRole={currentRole} />
          </div>
        );

      case 'expenses':
        return (
          <div className="bg-slate-900/30">
            <MiscExpenses currentRole={currentRole} />
          </div>
        );

      case 'fuellog':
        return (
          <div className="bg-slate-950">
            <FuelLog currentRole={currentRole} />
          </div>
        );

      case 'maintenance':
        return <MaintenanceTracker onNavigate={handleNavigate} currentRole={currentRole} />;

      case 'workorders':
        return (
          <div className="bg-slate-900/30">
            <WorkOrderSystem />
          </div>
        );

      case 'checklists':
        return (
          <div className="bg-slate-900/30">
            <div className="max-w-[1920px] mx-auto px-4 py-4">
              <div className="flex items-center justify-end gap-3 mb-2">
                <label className="text-sm text-slate-400">Checking as:</label>
                <select
                  value={selectedCrewMember?.id || 'default'}
                  onChange={(e) => handleCrewMemberChange(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
                >
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                  {teamMembers.length === 0 && (
                    <option value="default">
                      {profile?.driverName || 'Crew Member'} (Crew)
                    </option>
                  )}
                </select>
              </div>
            </div>
            <CrewChecklist
              crewMemberName={selectedCrewMember?.name || 'Crew Member'}
              currentRole={currentRole}
            />
          </div>
        );

      case 'todo':
        return (
          <div className="bg-slate-950">
            <ToDoList currentRole={currentRole} crewMemberName={selectedCrewMember?.name || 'Crew Member'} />
          </div>
        );

      case 'gallery':
        return (
          <div className="bg-slate-900/30">
            <MediaGallery currentRole={currentRole} />
          </div>
        );

      case 'backup':
        return (
          <div className="bg-slate-950">
            <div className="max-w-[1920px] mx-auto px-4 py-8">
              <BackupRestore currentRole={currentRole} />
            </div>
          </div>
        );

      case 'admin':
        if (canAccessAdmin) {
          return (
            <div className="bg-slate-900/30">
              <AdminSettings currentRole={currentRole} />
            </div>
          );
        }
        return null;

      case 'profile':
        return (
          <div className="py-8 px-4 md:px-8 bg-slate-900/50">
            <div className="max-w-7xl mx-auto">
              <TeamProfile currentRole={currentRole} />
            </div>
          </div>
        );

      case 'help':
        return <HeroSection />;

      default:
        return <DashboardGrid onNavigate={handleNavigate} />;
    }
  };

  // If not authenticated and not in demo mode, show login screen
  if (!isAuthenticated && !isDemoMode) {
    return (
      <div className="min-h-screen bg-slate-950">
        <LoginScreen onOpenAuth={handleOpenAuth} />

        {/* Auth Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
        />

        {/* Password Reset Handler */}
        <PasswordResetHandler />
      </div>
    );
  }

  // Authenticated layout with sidebar
  return (
    <div className={`min-h-screen bg-slate-950 ${isDemoMode ? 'pb-16' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        currentRole={currentRole}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Invite Accept Banner */}
      <InviteAcceptBanner />

      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Mobile top padding for hamburger */}
        <div className="h-14 lg:hidden" />

        {/* Team Notes (always accessible but not in sidebar) */}
        {activeSection === 'notes' && (
          <div className="bg-slate-950">
            <TeamNotes currentRole={currentRole} />
          </div>
        )}

        {/* Render active section */}
        {renderSection()}
      </main>

      {/* Onboarding Wizard */}
      <OnboardingWizard onNavigate={handleNavigate} />

      {/* Beta Feedback */}
      <BetaFeedback />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Password Reset Handler */}
      <PasswordResetHandler />

      {/* Demo Mode Banner */}
      <DemoModeBanner onOpenAuth={handleOpenAuth} />

      {/* Login Alert Popup */}
      {showLoginAlert && (
        <LoginAlertPopup
          onNavigate={handleNavigate}
          onDismiss={() => setShowLoginAlert(false)}
        />
      )}

      {/* Version Number */}
      <div
        className={`fixed ${isDemoMode ? 'bottom-[52px]' : 'bottom-2'} left-2 z-30 select-none pointer-events-none`}
      >
        <span className="text-sm font-mono font-semibold text-orange-400 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          v1.0.4
        </span>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <AppProvider>
      <CarProvider>
        <AppLayoutContent />
      </CarProvider>
    </AppProvider>
  );
};

export default AppLayout;
