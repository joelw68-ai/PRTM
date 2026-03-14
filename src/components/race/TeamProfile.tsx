import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';

import { useAuth, UserProfile, DriverLicense } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import TeamInviteFlow from './TeamInviteFlow';
import TeamPhotos from './TeamPhotos';


import { CrewRole, hasPermission, getRoleColor as getPermissionRoleColor, getRoleDescription } from '@/lib/permissions';
import {
  User,
  Car,
  Flag,
  MapPin,
  Phone,
  Mail,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Edit3,
  X,
  Gauge,
  Fuel,
  Weight,
  Calendar,
  Award,
  Settings,
  Users,
  Plus,
  Trash2,
  Shield,
  UserPlus,
  Wrench,
  Eye,
  Edit2,
  Lock,
  Info,
  DollarSign,
  Camera,
  Clock,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Helper: compute license expiration status
const getLicenseExpirationInfo = (expirationDate: string) => {
  if (!expirationDate) return { diffDays: 0, isExpired: false, isExpiringSoon: false, formattedDate: '-' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = expirationDate.split('-');
  const exp = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const diffMs = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffDays < 0;
  const isExpiringSoon = !isExpired && diffDays <= 60;
  const formattedDate = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { diffDays, isExpired, isExpiringSoon, formattedDate };
};





export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'Owner' | 'Driver' | 'Crew Chief' | 'Crew' | 'Mechanic' | 'Tuner' | 'Sponsor';
  permissions: ('view' | 'edit' | 'admin')[];
  specialties?: string[];
  isActive: boolean;
  joinedDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  avatarUrl?: string;
  // Labor cost fields
  hourlyRate?: number;
  dailyRate?: number;
}


interface TeamProfileProps {
  currentRole?: CrewRole;
}

const TeamProfile: React.FC<TeamProfileProps> = ({ currentRole = 'Crew' }) => {
  const { profile, updateProfile, user, isAuthenticated } = useAuth();
  const { teamMembers, addTeamMember, updateTeamMember, deleteTeamMember } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'photos' | 'invites'>('profile');

  // Multi-license state
  const [licenses, setLicenses] = useState<DriverLicense[]>([]);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const emptyLicense: Omit<DriverLicense, 'id'> = { sanctioningBody: 'NHRA', licenseClass: '', licenseNumber: '', expirationDate: '', isPrimary: false };
  const [newLicenseForm, setNewLicenseForm] = useState<Omit<DriverLicense, 'id'>>(emptyLicense);


  // Permission checks
  const canEditProfile = hasPermission(currentRole, 'settings.edit');
  const canEditTeam = hasPermission(currentRole, 'team.edit');
  const canDeleteTeam = hasPermission(currentRole, 'team.delete');
  const canAddTeam = hasPermission(currentRole, 'team.add');

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    teamName: '',
    driverName: '',
    driverLicenseNumber: '',
    driverLicenseClass: '',
    driverLicenseExpiration: '',
    carName: '',
    carNumber: '',
    carClass: 'Pro Mod',
    carMake: '',
    carModel: '',
    carYear: undefined,
    carWeight: undefined,
    engineType: 'Supercharged Hemi',
    fuelType: 'Methanol',
    homeTrack: '',
    contactEmail: '',
    contactPhone: '',
    notes: ''
  });


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

  const [newMember, setNewMember] = useState<Partial<TeamMember>>(defaultNewMember);


  useEffect(() => {
    if (profile) {
      setFormData({
        teamName: profile.teamName || '',
        driverName: profile.driverName || '',
        driverLicenseNumber: profile.driverLicenseNumber || '',
        driverLicenseClass: profile.driverLicenseClass || '',
        driverLicenseExpiration: profile.driverLicenseExpiration || '',
        carName: profile.carName || '',
        carNumber: profile.carNumber || '',
        carClass: profile.carClass || 'Pro Mod',
        carMake: profile.carMake || '',
        carModel: profile.carModel || '',
        carYear: profile.carYear,
        carWeight: profile.carWeight,
        engineType: profile.engineType || 'Supercharged Hemi',
        fuelType: profile.fuelType || 'Methanol',
        homeTrack: profile.homeTrack || '',
        contactEmail: profile.contactEmail || user?.email || '',
        contactPhone: profile.contactPhone || '',
        notes: profile.notes || ''
      });
      // Load licenses from profile (with backward compat migration from single-license fields)
      if (profile.driverLicenses && profile.driverLicenses.length > 0) {
        setLicenses(profile.driverLicenses);
      } else if (profile.driverLicenseNumber || profile.driverLicenseClass) {
        // Migrate legacy single-license to multi-license
        const body = (profile.driverLicenseClass || '').startsWith('IHRA') ? 'IHRA' : 'NHRA';
        setLicenses([{
          id: `legacy-${Date.now()}`,
          sanctioningBody: body as 'NHRA' | 'IHRA',
          licenseClass: profile.driverLicenseClass || '',
          licenseNumber: profile.driverLicenseNumber || '',
          expirationDate: profile.driverLicenseExpiration || '',
          isPrimary: true,
        }]);
      } else {
        setLicenses([]);
      }
    }
  }, [profile, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseInt(value, 10) }));
  };

  // License CRUD handlers
  const handleAddLicense = () => {
    if (!newLicenseForm.licenseClass) return;
    const newLic: DriverLicense = {
      id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...newLicenseForm,
      isPrimary: licenses.length === 0 ? true : newLicenseForm.isPrimary,
    };
    // If new license is primary, un-primary all others
    let updated = newLic.isPrimary ? licenses.map(l => ({ ...l, isPrimary: false })) : [...licenses];
    updated.push(newLic);
    setLicenses(updated);
    setNewLicenseForm(emptyLicense);
    setShowAddLicense(false);
  };

  const handleUpdateLicense = () => {
    if (!editingLicenseId || !newLicenseForm.licenseClass) return;
    let updated = licenses.map(l => {
      if (l.id === editingLicenseId) return { ...l, ...newLicenseForm };
      if (newLicenseForm.isPrimary) return { ...l, isPrimary: false };
      return l;
    });
    setLicenses(updated);
    setEditingLicenseId(null);
    setNewLicenseForm(emptyLicense);
    setShowAddLicense(false);
  };

  const handleDeleteLicense = (id: string) => {
    const remaining = licenses.filter(l => l.id !== id);
    // If deleted was primary, make the first remaining one primary
    if (remaining.length > 0 && !remaining.some(l => l.isPrimary)) {
      remaining[0].isPrimary = true;
    }
    setLicenses(remaining);
  };

  const handleSetPrimary = (id: string) => {
    setLicenses(licenses.map(l => ({ ...l, isPrimary: l.id === id })));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Sync primary license back to legacy single-license fields for backward compat
      const primary = licenses.find(l => l.isPrimary) || licenses[0];
      const saveData: Partial<UserProfile> = {
        ...formData,
        driverLicenseNumber: primary?.licenseNumber || '',
        driverLicenseClass: primary?.licenseClass || '',
        driverLicenseExpiration: primary?.expirationDate || '',
        driverLicenses: licenses,
      };
      console.log('[TeamProfile] Saving profile with licenses:', licenses.length);
      const { error } = await updateProfile(saveData);

      if (error) {
        setSaveError(`Save failed: ${error.message}`);
      } else {
        setSaveSuccess(true);
        setIsEditing(false);
        setShowAddLicense(false);
        setEditingLicenseId(null);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setSaveError(`Unexpected error: ${err?.message || String(err)}`);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        teamName: profile.teamName || '',
        driverName: profile.driverName || '',
        driverLicenseNumber: profile.driverLicenseNumber || '',
        driverLicenseClass: profile.driverLicenseClass || '',
        driverLicenseExpiration: profile.driverLicenseExpiration || '',
        carName: profile.carName || '',
        carNumber: profile.carNumber || '',
        carClass: profile.carClass || 'Pro Mod',
        carMake: profile.carMake || '',
        carModel: profile.carModel || '',
        carYear: profile.carYear,
        carWeight: profile.carWeight,
        engineType: profile.engineType || 'Supercharged Hemi',
        fuelType: profile.fuelType || 'Methanol',
        homeTrack: profile.homeTrack || '',
        contactEmail: profile.contactEmail || user?.email || '',
        contactPhone: profile.contactPhone || '',
        notes: profile.notes || ''
      });
      // Reset licenses from profile
      setLicenses(profile.driverLicenses || []);
    }
    setIsEditing(false);
    setShowAddLicense(false);
    setEditingLicenseId(null);
  };



  const handleSaveMember = async () => {
    if (!newMember.name) return;

    const member: TeamMember = {
      id: editingMember?.id || `TM-${Date.now()}`,
      name: newMember.name || '',
      email: newMember.email,
      phone: newMember.phone,
      role: newMember.role as TeamMember['role'] || 'Crew',
      permissions: newMember.permissions || ['view'],
      specialties: newMember.specialties,
      isActive: newMember.isActive ?? true,
      joinedDate: newMember.joinedDate,
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
    }

    setShowAddMember(false);
    setEditingMember(null);
    setNewMember({ ...defaultNewMember, joinedDate: getLocalDateString() });
  };






  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setNewMember(member);
    setShowAddMember(true);
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      await deleteTeamMember(id);
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

  if (!isAuthenticated) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
        <User className="w-16 h-16 text-slate-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
        <p className="text-slate-400">Please sign in to view and edit your team profile.</p>
      </div>
    );
  }

  const nhraLicenseClasses = [
    'NHRA Top Fuel',
    'NHRA Funny Car',
    'NHRA Pro Stock',
    'NHRA Pro Stock Motorcycle',
    'NHRA Top Alcohol Dragster',
    'NHRA Top Alcohol Funny Car',
    'NHRA Pro Mod',
    'NHRA Mountain Motor Pro Stock',
    'NHRA Nostalgia Top Fuel',
    'NHRA Nostalgia Funny Car',
    'NHRA Top Fuel Harley',
    'NHRA Pro Fuel Harley',
    'NHRA Advanced ET',
    'NHRA Heads Up Pro Mod',
    'NHRA Competition Eliminator',
    'NHRA Top Dragster',
    'NHRA Top Sportsman',
    'NHRA Factory Stock Showdown',
    'NHRA Super Stock',
    'NHRA Super Comp',
    'NHRA Super Gas',
    'NHRA Super Street',
    'NHRA Snowmobile',
    'NHRA ET Bracket',
    'NHRA ET Bracket Motorcycle'
  ];

  const ihraLicenseClasses = [
    'IHRA Top Fuel',
    'IHRA Nitro Funny Car',
    'IHRA Pro Stock',
    'IHRA Pro Mod',
    'IHRA Top Alcohol Dragster',
    'IHRA Top Alcohol Funny Car',
    'IHRA Pro Stock Motorcycle',
    'IHRA Mountain Motor Pro Stock',
    'IHRA Top Sportsman',
    'IHRA Top Dragster',
    'IHRA Quick Rod',
    'IHRA Super Rod',
    'IHRA Stock Eliminator',
    'IHRA Super Stock',
    'IHRA Hot Rod',
    'IHRA Super Gas',
    'IHRA Super Comp',
    'IHRA Junior Dragster',
    'IHRA ET Bracket',
    'IHRA ET Bracket Motorcycle',
    'IHRA Trophy',
    'IHRA Outlaw Fuel Altered',
    'IHRA Nitro Harley'
  ];


  const carClasses = [
    'Pro Mod', 'Pro Nitrous', 'Pro Boost', 'Outlaw Pro Mod', 'X275',
    'Radial vs World', 'No Prep', 'Top Sportsman', 'Top Dragster',
    'Super Street', 'Limited Drag Radial',
    'Outlaw 10.5', 'Pro Street 10.5', 'Small Tire 28 x 10.5', 'Ultra Street',
    'Outlaw 632', 'Nitro Funny Car', 'Top Alcohol Funny Car',
    'Top Fuel Dragster', 'Top Alcohol Dragster', 'Factory Stock', 'Other'
  ];

  const engineTypes = ['Supercharged Hemi', 'Twin Turbo', 'ProCharger', 'Nitrous', 'Roots Blown', 'Screw Blown', 'Other'];
  const fuelTypes = ['Methanol', 'E85', 'Race Gas', 'VP Racing Fuel', 'Other'];
  const memberRoles: TeamMember['role'][] = ['Owner', 'Driver', 'Crew Chief', 'Crew', 'Mechanic', 'Tuner', 'Sponsor'];
  const specialtyOptions = ['Engine', 'Transmission', 'Chassis', 'Electronics', 'Fuel System', 'Suspension', 'Body/Paint', 'Data Analysis'];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Owner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Driver': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Crew Chief': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Tuner': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Mechanic': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Sponsor': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Owner': return <Shield className="w-4 h-4" />;
      case 'Driver': return <User className="w-4 h-4" />;
      case 'Crew Chief': return <Award className="w-4 h-4" />;
      case 'Tuner': return <Settings className="w-4 h-4" />;
      case 'Mechanic': return <Wrench className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Flag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{formData.teamName || 'My Race Team'}</h2>
            <p className="text-slate-400">{user?.email}</p>
          </div>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-slate-800 rounded-lg p-1 flex-wrap">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Team Members
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'photos' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Camera className="w-3.5 h-3.5" />
            Photos
          </button>
          {canEditTeam && (
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'invites' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Mail className="w-3.5 h-3.5" />
              Invites
            </button>
          )}
        </div>

      </div>


      {activeTab === 'invites' ? (
        <TeamInviteFlow 
          teamName={formData.teamName || 'Race Team'} 
          invitedByName={profile?.driverName || user?.email?.split('@')[0] || 'Team Owner'} 
        />
      ) : activeTab === 'photos' ? (
        <TeamPhotos currentRole={currentRole} />
      ) : activeTab === 'profile' ? (
        <>
          {/* Profile Actions */}

          <div className="flex items-center justify-end gap-3">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Saved!</span>
              </div>
            )}
            
            {saveError && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{saveError}</span>
              </div>
            )}
            
            {isEditing ? (
              <>
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Profile Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Information */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Flag className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Team Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Team Name</label>
                  {isEditing ? (
                    <input type="text" name="teamName" value={formData.teamName} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  ) : (
                    <p className="text-white font-medium">{formData.teamName || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Home Track</label>
                  {isEditing ? (
                    <input type="text" name="homeTrack" value={formData.homeTrack} onChange={handleChange} placeholder="e.g., South Georgia Motorsports Park" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  ) : (
                    <p className="text-white">{formData.homeTrack || '-'}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Contact Email</label>
                    {isEditing ? (
                      <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.contactEmail || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Contact Phone</label>
                    {isEditing ? (
                      <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} placeholder="(555) 123-4567" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.contactPhone || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Information + Multi-License System */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Driver Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Driver Name</label>
                  {isEditing ? (
                    <input type="text" name="driverName" value={formData.driverName} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  ) : (
                    <p className="text-white font-medium">{formData.driverName || '-'}</p>
                  )}
                </div>

                {/* Racing Licenses Section */}
                <div className="border-t border-slate-700/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Racing Licenses ({licenses.length})
                    </h4>
                    {isEditing && (
                      <button onClick={() => { setEditingLicenseId(null); setNewLicenseForm(emptyLicense); setShowAddLicense(true); }} className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium hover:bg-blue-500/30 transition-colors border border-blue-500/30">
                        <Plus className="w-3 h-3" /> Add License
                      </button>
                    )}
                  </div>

                  {/* License List */}
                  {licenses.length === 0 && !showAddLicense ? (
                    <div className="text-center py-4 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                      <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No licenses added yet</p>
                      {isEditing && <p className="text-slate-600 text-xs mt-1">Click "Add License" to add your first racing license</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Sort: primary first */}
                      {[...licenses].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map(lic => {
                        const exp = getLicenseExpirationInfo(lic.expirationDate);
                        return (
                          <div key={lic.id} className={`p-3 rounded-lg border ${lic.isPrimary ? 'bg-blue-500/5 border-blue-500/30' : 'bg-slate-900/30 border-slate-700/50'} ${exp.isExpired ? 'border-red-500/40' : exp.isExpiringSoon ? 'border-yellow-500/40' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {lic.isPrimary && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-semibold border border-blue-500/30 uppercase tracking-wider">
                                      <Star className="w-2.5 h-2.5" /> Primary
                                    </span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${lic.sanctioningBody === 'NHRA' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                                    {lic.sanctioningBody}
                                  </span>
                                  {exp.isExpired && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] border border-red-500/30">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Expired
                                    </span>
                                  )}
                                  {exp.isExpiringSoon && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] border border-yellow-500/30">
                                      <Clock className="w-2.5 h-2.5" /> {exp.diffDays}d left
                                    </span>
                                  )}
                                </div>
                                <p className="text-white text-sm font-medium truncate">{lic.licenseClass || 'No class'}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                  <span>#{lic.licenseNumber || '-'}</span>
                                  <span className={`${exp.isExpired ? 'text-red-400' : exp.isExpiringSoon ? 'text-yellow-400' : ''}`}>
                                    Exp: {exp.formattedDate}
                                  </span>
                                </div>
                              </div>
                              {isEditing && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!lic.isPrimary && (
                                    <button onClick={() => handleSetPrimary(lic.id)} title="Set as primary" className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors">
                                      <Star className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button onClick={() => { setEditingLicenseId(lic.id); setNewLicenseForm({ sanctioningBody: lic.sanctioningBody, licenseClass: lic.licenseClass, licenseNumber: lic.licenseNumber, expirationDate: lic.expirationDate, isPrimary: lic.isPrimary }); setShowAddLicense(true); }} title="Edit" className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteLicense(lic.id)} title="Remove" className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {/* Individual warning banner */}
                            {!isEditing && exp.isExpired && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                Expired {Math.abs(exp.diffDays)} day{Math.abs(exp.diffDays) !== 1 ? 's' : ''} ago — renew before your next {lic.sanctioningBody} event.
                              </div>
                            )}
                            {!isEditing && exp.isExpiringSoon && (
                              <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                                <Clock className="w-3 h-3 inline mr-1" />
                                Expires in {exp.diffDays} day{exp.diffDays !== 1 ? 's' : ''} — consider renewing your {lic.sanctioningBody} license soon.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add/Edit License Inline Form */}
                  {showAddLicense && isEditing && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-600 space-y-3">
                      <h5 className="text-sm font-medium text-white">{editingLicenseId ? 'Edit License' : 'Add New License'}</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Sanctioning Body</label>
                          <select value={newLicenseForm.sanctioningBody} onChange={e => setNewLicenseForm({ ...newLicenseForm, sanctioningBody: e.target.value as 'NHRA' | 'IHRA', licenseClass: '' })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="NHRA">NHRA</option>
                            <option value="IHRA">IHRA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">License Class</label>
                          <select value={newLicenseForm.licenseClass} onChange={e => setNewLicenseForm({ ...newLicenseForm, licenseClass: e.target.value })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Select Class</option>
                            {(newLicenseForm.sanctioningBody === 'NHRA' ? nhraLicenseClasses : ihraLicenseClasses).map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">License Number</label>
                          <input type="text" value={newLicenseForm.licenseNumber} onChange={e => setNewLicenseForm({ ...newLicenseForm, licenseNumber: e.target.value })} placeholder="e.g., 12345" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Expiration Date</label>
                          <DateInputDark name="licExpDate" value={newLicenseForm.expirationDate} onChange={e => setNewLicenseForm({ ...newLicenseForm, expirationDate: e.target.value })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="licPrimary" checked={newLicenseForm.isPrimary} onChange={e => setNewLicenseForm({ ...newLicenseForm, isPrimary: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500" />
                        <label htmlFor="licPrimary" className="text-xs text-slate-300">Set as primary license</label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowAddLicense(false); setEditingLicenseId(null); setNewLicenseForm(emptyLicense); }} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={editingLicenseId ? handleUpdateLicense : handleAddLicense} disabled={!newLicenseForm.licenseClass} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          {editingLicenseId ? 'Update' : 'Add License'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>




            {/* Car Information */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Car Information</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Car Name</label>
                    {isEditing ? (
                      <input type="text" name="carName" value={formData.carName} onChange={handleChange} placeholder="e.g., Nitro Express" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white font-medium">{formData.carName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Car Number</label>
                    {isEditing ? (
                      <input type="text" name="carNumber" value={formData.carNumber} onChange={handleChange} placeholder="e.g., 777" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.carNumber || '-'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Car Class</label>
                  {isEditing ? (
                    <select name="carClass" value={formData.carClass} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {carClasses.map(cls => (<option key={cls} value={cls}>{cls}</option>))}
                    </select>
                  ) : (
                    <p className="text-white">{formData.carClass || '-'}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Make</label>
                    {isEditing ? (
                      <input type="text" name="carMake" value={formData.carMake} onChange={handleChange} placeholder="e.g., Chevrolet" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.carMake || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                    {isEditing ? (
                      <input type="text" name="carModel" value={formData.carModel} onChange={handleChange} placeholder="e.g., Camaro" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.carModel || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Year</label>
                    {isEditing ? (
                      <input type="number" name="carYear" value={formData.carYear || ''} onChange={handleNumberChange} placeholder="2024" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    ) : (
                      <p className="text-white">{formData.carYear || '-'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Weight (lbs)</label>
                  {isEditing ? (
                    <input type="number" name="carWeight" value={formData.carWeight || ''} onChange={handleNumberChange} placeholder="e.g., 2650" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  ) : (
                    <p className="text-white">{formData.carWeight ? `${formData.carWeight} lbs` : '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Engine & Fuel */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Engine & Fuel</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Engine Type</label>
                  {isEditing ? (
                    <select name="engineType" value={formData.engineType} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {engineTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                    </select>
                  ) : (
                    <p className="text-white font-medium">{formData.engineType || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Fuel Type</label>
                  {isEditing ? (
                    <select name="fuelType" value={formData.fuelType} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {fuelTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                    </select>
                  ) : (
                    <p className="text-white">{formData.fuelType || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                  {isEditing ? (
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} placeholder="Additional notes about your setup..." className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                  ) : (
                    <p className="text-white whitespace-pre-wrap">{formData.notes || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Team Members Tab */
        <div className="space-y-6">
          {/* Team Members Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Team Members ({teamMembers.length})
              </h3>
              <p className="text-slate-400 text-sm">Manage your team roster and permissions</p>
            </div>
            <button
              onClick={() => {
                setEditingMember(null);
                setNewMember({ ...defaultNewMember });
                setShowAddMember(true);
              }}

              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>

          </div>

          {/* Team Members Grid */}
          {teamMembers.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No team members added yet</p>
              <p className="text-slate-500 text-sm mt-1">Click "Add Member" to start building your team</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map(member => (
                <div key={member.id} className={`bg-slate-800/50 rounded-xl border ${member.isActive ? 'border-slate-700/50' : 'border-red-500/30 opacity-60'} p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                        {getRoleIcon(member.role)}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{member.name}</h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditMember(member)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteMember(member.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {member.email && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3 h-3" />
                        {member.phone}
                      </div>
                    )}
                    {member.specialties && member.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.specialties.map(spec => (
                          <span key={spec} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 mt-3 pt-3 border-t border-slate-700/50">
                    {member.permissions.includes('view') && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                        <Eye className="w-3 h-3" /> View
                      </span>
                    )}
                    {member.permissions.includes('edit') && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        <Edit2 className="w-3 h-3" /> Edit
                      </span>
                    )}
                    {member.permissions.includes('admin') && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingMember ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <button onClick={() => { setShowAddMember(false); setEditingMember(null); }} className="text-slate-400 hover:text-white">
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
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newMember.isActive ?? true}
                  onChange={(e) => setNewMember({ ...newMember, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="isActive" className="text-slate-300">Active member</label>
              </div>



              <div>
                <label className="block text-sm text-slate-400 mb-1">Joined Date</label>
                <DateInputDark
                  value={newMember.joinedDate || ''}
                  onChange={(e) => setNewMember({ ...newMember, joinedDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />

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
                    <input
                      type="text"
                      value={newMember.emergencyContactName || ''}
                      onChange={(e) => setNewMember({ ...newMember, emergencyContactName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={newMember.emergencyContactPhone || ''}
                      onChange={(e) => setNewMember({ ...newMember, emergencyContactPhone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="(555) 123-4567"
                    />
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
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={newMember.hourlyRate || ''}
                      onChange={(e) => setNewMember({ ...newMember, hourlyRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 125"
                    />
                    <p className="text-xs text-slate-500 mt-1">Per hour rate</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Daily Rate ($)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={newMember.dailyRate || ''}
                      onChange={(e) => setNewMember({ ...newMember, dailyRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g., 800"
                    />
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
              <button onClick={() => { setShowAddMember(false); setEditingMember(null); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveMember} className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all">
                {editingMember ? 'Update Member' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamProfile;
