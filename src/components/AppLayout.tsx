
import React, { useState, useRef, useEffect } from 'react';


import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/contexts/AuthContext';

import { AppProvider, useApp } from '@/contexts/AppContext';
import { CarProvider } from '@/contexts/CarContext';
import Navigation from './race/Navigation';
import Dashboard from './race/Dashboard';
import PassLog from './race/PassLog';
import SetupLibrary from './race/SetupLibrary';

import PartsInventory from './race/PartsInventory';
import PartsUsageHistory from './race/PartsUsageHistory';
import BackupRestore from './race/BackupRestore';

import MaintenanceTracker from './race/MaintenanceTracker';
import TeamNotes from './race/TeamNotes';
import HeroSection from './race/HeroSection';
import Footer from './race/Footer';
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
import SeasonSummary from './race/SeasonSummary';
import { InviteAcceptBanner } from './race/TeamInviteFlow';
import BorrowedLoanedParts from './race/BorrowedLoanedParts';
import MiscExpenses from './race/MiscExpenses';
import FuelLog from './race/FuelLog';
import CarProfiles from './race/CarProfiles';
import BulkCarAssign from './race/BulkCarAssign';
import CarStatsDashboard from './race/CarStatsDashboard';
import RaceDayTimeline from './race/RaceDayTimeline';





import { CrewRole, hasPermission, isAdminRole, Permission } from '@/lib/permissions';
import { TeamMember } from './race/TeamProfile';
import { auditLog } from '@/lib/auditLog';





const AppLayoutContent: React.FC = () => {
  const { setTheme } = useTheme();
  const { profile, user, isAuthenticated, isDemoMode, showPasswordReset, isTeamMember, activeTeamMembership } = useAuth();
  const { teamMembers } = useApp();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [selectedCrewMember, setSelectedCrewMember] = useState<TeamMember | null>(null);
  // Track whether the user manually chose a crew member (via the dropdown)
  const [manuallySelected, setManuallySelected] = useState(false);

  // Reorder list trigger: incremented to signal PartsInventory to open its ReorderListGenerator modal
  const [reorderListTrigger, setReorderListTrigger] = useState(0);


  
  // Set dark theme on mount for racing aesthetic
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  // Reset manual selection when user changes (login/logout)
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentUserId = user?.id;
    if (currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId;
      setManuallySelected(false);
    }
  }, [user?.id]);

  // Auto-select the best crew member whenever teamMembers or auth state changes.
  // This runs on login, on data load, and on logout — but NOT when the user
  // manually picks a different crew member from the dropdown.
  useEffect(() => {
    // If user manually selected a crew member from the dropdown, don't override
    if (manuallySelected) return;

    let bestMember: TeamMember | null = null;

    if (teamMembers.length > 0) {
      // 1. Try to match the logged-in user by email
      if (user?.email) {
        bestMember = teamMembers.find(
          m => m.email?.toLowerCase() === user.email?.toLowerCase()
        ) || null;
      }
      // 2. Fall back to Owner or Crew Chief
      if (!bestMember) {
        bestMember = teamMembers.find(m => m.role === 'Owner') ||
                     teamMembers.find(m => m.role === 'Crew Chief') ||
                     null;
      }
      // 3. Fall back to first team member
      if (!bestMember) {
        bestMember = teamMembers[0];
      }
    }

    if (!bestMember) {
      // No team members exist — create a sensible default
      // If the user is authenticated, they ARE the account owner, so default to 'Owner'
      bestMember = {
        id: 'default',
        name: profile?.driverName || user?.email?.split('@')[0] || 'Crew Member',
        role: isAuthenticated ? 'Owner' : 'Crew',
        permissions: isAuthenticated ? ['view', 'edit', 'admin'] as ('view' | 'edit' | 'admin')[] : ['view', 'edit'] as ('view' | 'edit')[],
        isActive: true
      };
    }

    // Only update if the selected member actually changed
    setSelectedCrewMember(prev => {
      if (prev?.id === bestMember!.id && prev?.role === bestMember!.role && prev?.name === bestMember!.name) {
        return prev; // No change needed
      }
      // Update audit log
      auditLog.setCurrentUser({
        id: bestMember!.id,
        name: bestMember!.name,
        role: bestMember!.role as CrewRole
      });
      console.log('[AppLayout] Auto-selected crew member:', bestMember!.name, '— role:', bestMember!.role);
      return bestMember;
    });
  }, [teamMembers, isAuthenticated, isDemoMode, user?.email, user?.id, profile?.driverName, manuallySelected]);



  const sectionRefs = {
    setup: useRef<HTMLDivElement>(null),
    cars: useRef<HTMLDivElement>(null),
    dashboard: useRef<HTMLDivElement>(null),
    passlog: useRef<HTMLDivElement>(null),
    calendar: useRef<HTMLDivElement>(null),
    timeline: useRef<HTMLDivElement>(null),
    analytics: useRef<HTMLDivElement>(null),
    engines: useRef<HTMLDivElement>(null),

    parts: useRef<HTMLDivElement>(null),
    partsusage: useRef<HTMLDivElement>(null),
    borrowedloaned: useRef<HTMLDivElement>(null),
    vendors: useRef<HTMLDivElement>(null),
    costs: useRef<HTMLDivElement>(null),
    expenses: useRef<HTMLDivElement>(null),
    fuellog: useRef<HTMLDivElement>(null),
    maintenance: useRef<HTMLDivElement>(null),
    workorders: useRef<HTMLDivElement>(null),
    checklists: useRef<HTMLDivElement>(null),
    todo: useRef<HTMLDivElement>(null),
    gallery: useRef<HTMLDivElement>(null),
    backup: useRef<HTMLDivElement>(null),
    admin: useRef<HTMLDivElement>(null),
    profile: useRef<HTMLDivElement>(null),
    help: useRef<HTMLDivElement>(null),
  };










  const handleNavigate = (section: string) => {
    const ref = sectionRefs[section as keyof typeof sectionRefs];
    if (ref?.current) {
      const offset = 140; // Increased offset for two-row navigation height
      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
    setActiveSection(section);
  };

  // Callback for Dashboard's LowStockAlertPanel: scroll to Parts Inventory and open ReorderListGenerator
  const handleOpenReorderList = () => {
    // 1. Scroll to the Parts Inventory section
    const partsRef = sectionRefs.parts;
    if (partsRef?.current) {
      const offset = 140; // Match the two-row nav offset
      const elementPosition = partsRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
    setActiveSection('parts');
    // 2. Increment trigger to signal PartsInventory to open its ReorderListGenerator modal
    setReorderListTrigger(prev => prev + 1);
  };



  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      Object.entries(sectionRefs).forEach(([key, ref]) => {
        if (ref.current) {
          const element = ref.current;
          const offsetTop = element.offsetTop;
          const offsetBottom = offsetTop + element.offsetHeight;
          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(key);
          }
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get current user's role - map TeamMember role to CrewRole
  // CRITICAL: If the user is authenticated and NOT detected as a team member
  // (i.e., they are the account/team owner), always return 'Owner' role.
  // This prevents the owner from ever being downgraded to 'Crew' due to
  // stale team_memberships data from invite testing.
  const getCurrentRole = (): CrewRole => {
    // In demo mode, give full access
    if (isDemoMode) return 'Owner';
    
    // SAFETY NET: If the user is authenticated and is NOT a team member,
    // they are the account owner — always grant Owner role regardless of
    // what selectedCrewMember says. This is the authoritative check.
    if (isAuthenticated && !isTeamMember) return 'Owner';
    
    // If user IS a team member (viewing someone else's team), use the
    // membership role from AuthContext, not the local crew member selection
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
    // Map TeamMember roles to CrewRole
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
  
  // Helper function to check if current user has a permission
  const userHasPermission = (permission: Permission): boolean => {
    return hasPermission(currentRole, permission);
  };

  // Check if user can edit checklists (add/edit/delete items)
  const canEditChecklists = userHasPermission('checklist.edit');
  
  // Check if user can access admin settings
  const canAccessAdmin = isAdminRole(currentRole) || userHasPermission('settings.admin');

  const handleCrewMemberChange = (memberId: string) => {
    // Mark as manually selected so the auto-select effect doesn't override
    setManuallySelected(true);
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      setSelectedCrewMember(member);
      // Update audit log user when crew member changes
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

  return (
    <div className={`min-h-screen bg-slate-950 ${isDemoMode ? 'pb-16' : ''}`}>
      <Navigation 
        onNavigate={handleNavigate} 
        activeSection={activeSection}
        onOpenAuth={handleOpenAuth}
        currentRole={currentRole}
      />
      
      {/* Invite Accept Banner - shows when user arrives via ?invite=TOKEN */}
      <InviteAcceptBanner />

      <main className="pt-14 lg:pt-[130px]">



        {/* Initial Setup Section */}
        <div ref={sectionRefs.setup} className="bg-slate-950">
          <InitialSetup currentRole={currentRole} />
        </div>

        <div ref={sectionRefs.cars} className="bg-slate-900/30">
          <CarProfiles currentRole={currentRole} />
          {/* Bulk Car Assignment Tool — shown right below Car Profiles */}
          <BulkCarAssign />
        </div>


        <div ref={sectionRefs.dashboard}>
          <Dashboard onNavigate={handleNavigate} onOpenReorderList={handleOpenReorderList} />
        </div>




        <div ref={sectionRefs.calendar}>
          <RaceCalendar currentRole={currentRole} />
        </div>

        {/* Race Day Timeline Section */}
        <div ref={sectionRefs.timeline} className="bg-slate-900/30">
          <RaceDayTimeline />
        </div>
        
        <div ref={sectionRefs.passlog}>
          <PassLog currentRole={currentRole} />
        </div>

        
        <div ref={sectionRefs.analytics}>
          <AnalyticsDashboard currentRole={currentRole} />
        </div>

        
        <div ref={sectionRefs.engines}>
          <SetupLibrary currentRole={currentRole} />
        </div>
        

        
        <div ref={sectionRefs.parts}>
          <PartsInventory currentRole={currentRole} reorderListTrigger={reorderListTrigger} />
        </div>


        
        {/* Parts Usage History Section */}
        <div ref={sectionRefs.partsusage} className="bg-slate-900/30">
          <PartsUsageHistory />
        </div>
        
        {/* Borrowed & Loaned Parts Section */}
        <div ref={sectionRefs.borrowedloaned} className="bg-slate-950">
          <BorrowedLoanedParts onNavigate={handleNavigate} />
        </div>

        
        {/* Vendor Management Section */}
        <div ref={sectionRefs.vendors} className="bg-slate-900/30">
          <VendorManagement currentRole={currentRole} />
        </div>


        
        {/* Cost Analytics Section */}
        <div ref={sectionRefs.costs} className="bg-slate-950">
          <CostAnalytics currentRole={currentRole} />
        </div>

        {/* Miscellaneous Expenses Section */}
        <div ref={sectionRefs.expenses} className="bg-slate-900/30">
          <MiscExpenses currentRole={currentRole} />
        </div>

        {/* Fuel Log Section */}
        <div ref={sectionRefs.fuellog} className="bg-slate-950">
          <FuelLog currentRole={currentRole} />
        </div>
        

        <div ref={sectionRefs.maintenance}>
          <MaintenanceTracker onNavigate={handleNavigate} currentRole={currentRole} />
        </div>
        
        {/* Enhanced Work Order System */}
        <div ref={sectionRefs.workorders} className="bg-slate-900/30">
          <WorkOrderSystem />
        </div>
        
        <div className="bg-slate-950">
          <TeamNotes currentRole={currentRole} />
        </div>


        <div ref={sectionRefs.checklists} className="bg-slate-900/30">
          <div className="max-w-[1920px] mx-auto px-4 py-4">
            {/* Crew Member Selector */}
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
              {selectedCrewMember && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  isAdminRole(currentRole) 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : currentRole === 'Crew Chief'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {currentRole}
                </span>
              )}
            </div>
          </div>
          <CrewChecklist 
            crewMemberName={selectedCrewMember?.name || 'Crew Member'} 
            currentRole={currentRole}
          />
        </div>
        
        {/* To Do List Section */}
        <div ref={sectionRefs.todo} className="bg-slate-950">
          <ToDoList currentRole={currentRole} crewMemberName={selectedCrewMember?.name || 'Crew Member'} />
        </div>
        
        {/* Media Gallery Section */}
        <div ref={sectionRefs.gallery} className="bg-slate-900/30">
          <MediaGallery currentRole={currentRole} />
        </div>


        {/* Backup & Restore Section */}
        <div ref={sectionRefs.backup} className="bg-slate-950">
          <div className="max-w-[1920px] mx-auto px-4 py-8">
            <BackupRestore currentRole={currentRole} />
          </div>
        </div>


        {/* Admin Settings Section - Only show if user has admin access */}
        {canAccessAdmin && (
          <div ref={sectionRefs.admin} className="bg-slate-900/30">
            <AdminSettings currentRole={currentRole} />
          </div>
        )}

        
        <div ref={sectionRefs.profile} className="py-12 px-4 md:px-8 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <TeamProfile currentRole={currentRole} />
          </div>
        </div>
        
        <div ref={sectionRefs.help}>
          <HeroSection />
        </div>
      </main>
      
      <Footer />
      
      {/* Onboarding Wizard */}
      <OnboardingWizard onNavigate={handleNavigate} />
      
      {/* Beta Feedback Floating Button */}
      <BetaFeedback currentPage={activeSection} />
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Password Reset Handler (shows when user arrives from reset link) */}
      <PasswordResetHandler />

      {/* Demo Mode Banner */}
      <DemoModeBanner onOpenAuth={handleOpenAuth} />
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
