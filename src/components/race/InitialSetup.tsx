import React, { useState, useEffect, useRef, useCallback } from 'react';

import { getLocalDateString } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import {
  SavedTrackRowSchema,
  EngineRowSchema,
  TransmissionRowSchema,
  SuperchargerRowSchema,
  PartsInventoryRowSchema,
  SetupVendorRowSchema,
} from '@/lib/validators';
import { US_STATES as US_STATES_DATA, getStateSelectOptions } from '@/data/usStates';




import { useApp } from '@/contexts/AppContext';
import { TeamMember } from '@/components/race/TeamProfile';
import {
  Settings, MapPin, Cog, Zap, Package, Users,
  Plus, Pencil, Trash2, Save, X, ChevronRight,
  Search, Check, AlertTriangle, Loader2, Star,
  Phone, Mail, Globe, Building2, Hash,
  Shield, Eye, Edit2, Wrench, Award, UserPlus,
  DollarSign, ChevronDown, Info
} from 'lucide-react';
import {
  CrewRole,
  hasPermission,
  getRoleColor,
  getRoleDescription,
  getPermissionsForRole,
  permissionCategories,
  Permission
} from '@/lib/permissions';

interface InitialSetupProps {
  currentRole: CrewRole;
}

// ============ TYPES ============
interface RaceTrack {
  id: string;
  name: string;
  location: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  elevation: number;
  trackLength: string;
  surfaceType: string;
  notes: string;
  isFavorite: boolean;
}

interface EngineEntry {
  id: string;
  name: string;
  serialNumber: string;
  builder: string;
  displacement: string;
  installDate: string;
  totalPasses: number;
  status: string;
  currentlyInstalled: boolean;
  notes: string;
}

interface TransmissionEntry {
  id: string;
  name: string;
  serialNumber: string;
  type: string;
  model: string;
  builder: string;
  gearCount: number;
  installDate: string;
  totalPasses: number;
  status: string;
  currentlyInstalled: boolean;
  notes: string;
}

interface SuperchargerEntry {
  id: string;
  name: string;
  serialNumber: string;
  model: string;
  installDate: string;
  totalPasses: number;
  status: string;
  currentlyInstalled: boolean;
  notes: string;
}

interface PartEntry {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  subcategory: string;
  vendor: string;
  vendorPartNumber: string;
  unitCost: number;
  onHand: number;
  minQuantity: number;
  location: string;
  notes: string;
}

interface VendorEntry {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  category: string;
  paymentTerms: string;
  notes: string;
  rating: number;
}

// ============ HELPER COMPONENTS (defined outside main component to prevent re-mount on re-render) ============
const InputField = ({ label, value, onChange, type = 'text', placeholder = '', required = false, className = '' }: any) => (
  <div className={className}>
    <label className="block text-xs font-medium text-slate-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
    {type === 'date' ? (
      <DateInputDark value={value} onChange={onChange} required={required}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
    ) : (
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className={`w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none${type === 'time' || type === 'datetime-local' ? ' date-input-white' : ''}`} />
    )}
  </div>
);



const SelectField = ({ label, value, onChange, options, className = '' }: any) => (
  <div className={className}>
    <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
    <select value={value} onChange={onChange}
      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none">
      {options.map((o: any) => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
    </select>
  </div>
);

const TextAreaField = ({ label, value, onChange, className = '' }: any) => (
  <div className={className}>
    <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
    <textarea value={value} onChange={onChange} rows={2}
      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none" />
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'Active': 'bg-green-500/20 text-green-400', 'Ready': 'bg-blue-500/20 text-blue-400',
    'Rebuild': 'bg-red-500/20 text-red-400', 'Service': 'bg-yellow-500/20 text-yellow-400',
    'Retired': 'bg-slate-500/20 text-slate-400', 'In Stock': 'bg-green-500/20 text-green-400',
    'Low Stock': 'bg-yellow-500/20 text-yellow-400', 'Out of Stock': 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-slate-500/20 text-slate-400'}`}>{status}</span>;
};

type SetupTab = 'tracks' | 'engines' | 'transmissions' | 'superchargers' | 'parts' | 'vendors' | 'crew';

const tabConfig: { id: SetupTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'tracks', label: 'Racetracks', icon: MapPin, description: 'Tracks you race at with addresses' },
  { id: 'engines', label: 'Engines', icon: Cog, description: 'Engine inventory and details' },
  { id: 'transmissions', label: 'Transmissions', icon: Settings, description: 'Transmission configurations' },
  { id: 'superchargers', label: 'Superchargers', icon: Zap, description: 'Supercharger inventory' },
  { id: 'parts', label: 'Parts', icon: Package, description: 'Parts and part numbers' },
  { id: 'vendors', label: 'Vendors', icon: Building2, description: 'Vendor contact information' },
  { id: 'crew', label: 'Crew Members', icon: Users, description: 'Team roster with roles & permissions' },
];

const generateId = () => crypto.randomUUID();


// Use shared US states data with full names and DC
const US_STATES = US_STATES_DATA.map(s => s.abbr);



const PART_CATEGORIES = ['Engine', 'Cylinder Heads', 'Supercharger', 'Drivetrain', 'Tires', 'Brakes', 'Fluids', 'Fuel System', 'Electronics', 'Suspension', 'Safety', 'Hardware', 'Chassis', 'Body'];
const VENDOR_CATEGORIES = ['Engine', 'Cylinder Heads', 'Supercharger', 'Drivetrain', 'Tires', 'Brakes', 'Electronics', 'Hardware', 'Safety', 'General'];

const MEMBER_ROLES: TeamMember['role'][] = ['Owner', 'Driver', 'Crew Chief', 'Crew', 'Mechanic', 'Tuner', 'Sponsor'];
const SPECIALTY_OPTIONS = ['Engine', 'Transmission', 'Chassis', 'Electronics', 'Fuel System', 'Suspension', 'Body/Paint', 'Data Analysis', 'Tires', 'Safety'];

const getDefaultPermissionsForRole = (role: TeamMember['role']): ('view' | 'edit' | 'admin')[] => {
  switch (role) {
    case 'Owner': return ['view', 'edit', 'admin'];
    case 'Crew Chief': return ['view', 'edit', 'admin'];
    case 'Driver': return ['view', 'edit'];
    case 'Tuner': return ['view', 'edit'];
    case 'Mechanic': return ['view', 'edit'];
    case 'Sponsor': return ['view'];
    default: return ['view'];
  }
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'Owner': return <Shield className="w-4 h-4" />;
    case 'Driver': return <Users className="w-4 h-4" />;
    case 'Crew Chief': return <Award className="w-4 h-4" />;
    case 'Tuner': return <Settings className="w-4 h-4" />;
    case 'Mechanic': return <Wrench className="w-4 h-4" />;
    case 'Sponsor': return <DollarSign className="w-4 h-4" />;
    default: return <Users className="w-4 h-4" />;
  }
};

const getLocalRoleColor = (role: string) => {
  switch (role) {
    case 'Owner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Driver': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Crew Chief': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Tuner': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Mechanic': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Sponsor': return 'bg-green-500/20 text-green-400 border-green-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};


const InitialSetup: React.FC<InitialSetupProps> = ({ currentRole }) => {
  const { teamMembers, addTeamMember, updateTeamMember, deleteTeamMember, refreshData } = useApp();

  const [activeTab, setActiveTab] = useState<SetupTab>('tracks');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');


  // Data states
  const [tracks, setTracks] = useState<RaceTrack[]>([]);
  const [engines, setEngines] = useState<EngineEntry[]>([]);
  const [transmissions, setTransmissions] = useState<TransmissionEntry[]>([]);
  const [superchargers, setSuperchargers] = useState<SuperchargerEntry[]>([]);
  const [parts, setParts] = useState<PartEntry[]>([]);
  const [vendors, setVendors] = useState<VendorEntry[]>([]);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [trackForm, setTrackForm] = useState<RaceTrack>({ id: '', name: '', location: '', address: '', city: '', state: '', zip: '', elevation: 0, trackLength: '1/8 mile', surfaceType: 'Concrete', notes: '', isFavorite: false });
  const [engineForm, setEngineForm] = useState<EngineEntry>({ id: '', name: '', serialNumber: '', builder: '', displacement: '', installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
  const [transForm, setTransForm] = useState<TransmissionEntry>({ id: '', name: '', serialNumber: '', type: 'Manual', model: '', builder: '', gearCount: 5, installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
  const [scForm, setScForm] = useState<SuperchargerEntry>({ id: '', name: '', serialNumber: '', model: '', installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
  const [partForm, setPartForm] = useState<PartEntry>({ id: '', partNumber: '', description: '', category: 'Engine', subcategory: '', vendor: '', vendorPartNumber: '', unitCost: 0, onHand: 0, minQuantity: 1, location: '', notes: '' });
  const [vendorForm, setVendorForm] = useState<VendorEntry>({ id: '', name: '', code: '', contactName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', website: '', category: 'General', paymentTerms: 'Net 30', notes: '', rating: 5 });

  // Crew member form state
  const defaultCrewForm: Partial<TeamMember> = {
    name: '', email: '', phone: '', role: 'Crew',
    permissions: ['view'], specialties: [], isActive: true,
    joinedDate: getLocalDateString(),

    emergencyContactName: '', emergencyContactPhone: '',
    notes: '', hourlyRate: undefined, dailyRate: undefined
  };
  const [crewForm, setCrewForm] = useState<Partial<TeamMember>>(defaultCrewForm);
  const [showPermissionDetails, setShowPermissionDetails] = useState(false);


  // ============ DATA LOADING (completely non-blocking, no loading state) ============
  const loadData = useCallback(async () => {
    try {
      const fallback = { data: null, error: null };
      const timeoutMs = 2000;
      
      const withTimeout = <T,>(promise: PromiseLike<T>, ms: number, fb: T): Promise<T> =>
        Promise.race([Promise.resolve(promise), new Promise<T>(r => setTimeout(() => r(fb), ms))]);

      const [tracksRes, enginesRes, transRes, scRes, partsRes, vendorsRes] = await Promise.all([
        withTimeout(supabase.from('saved_tracks').select('*').order('name'), timeoutMs, fallback).catch(() => fallback),
        withTimeout(supabase.from('engines').select('*').order('name'), timeoutMs, fallback).catch(() => fallback),
        withTimeout(supabase.from('transmissions').select('*').order('name'), timeoutMs, fallback).catch(() => fallback),
        withTimeout(supabase.from('superchargers').select('*').order('name'), timeoutMs, fallback).catch(() => fallback),
        withTimeout(supabase.from('parts_inventory').select('*').order('category'), timeoutMs, fallback).catch(() => fallback),
        withTimeout(supabase.from('setup_vendors').select('*').order('name'), timeoutMs, fallback).catch(() => fallback),
      ]);

      if (tracksRes.data) setTracks(parseRows(tracksRes.data, SavedTrackRowSchema, 'saved_tracks').map((r: any) => ({
        id: r.id, name: r.name, location: r.location || '', address: r.address || '', city: r.city || '', state: r.state || '', zip: r.zip || '',
        elevation: r.elevation || 0, trackLength: r.track_length || '1/8 mile', surfaceType: r.surface_type || 'Concrete', notes: r.notes || '', isFavorite: r.is_favorite || false
      })));
      if (enginesRes.data) setEngines(parseRows(enginesRes.data, EngineRowSchema, 'engines').map((r: any) => ({
        id: r.id, name: r.name, serialNumber: r.serial_number || '', builder: r.builder || '', displacement: r.displacement || '',
        installDate: r.install_date || '', totalPasses: r.total_passes || 0, status: r.status || 'Ready', currentlyInstalled: r.currently_installed || false, notes: r.notes || ''
      })));
      if (transRes.data) setTransmissions(parseRows(transRes.data, TransmissionRowSchema, 'transmissions').map((r: any) => ({
        id: r.id, name: r.name, serialNumber: r.serial_number || '', type: r.type || 'Manual', model: r.model || '', builder: r.builder || '',
        gearCount: r.gear_count || 5, installDate: r.install_date || '', totalPasses: r.total_passes || 0, status: r.status || 'Ready', currentlyInstalled: r.currently_installed || false, notes: r.notes || ''
      })));
      if (scRes.data) setSuperchargers(parseRows(scRes.data, SuperchargerRowSchema, 'superchargers').map((r: any) => ({
        id: r.id, name: r.name, serialNumber: r.serial_number || '', model: r.model || '',
        installDate: r.install_date || '', totalPasses: r.total_passes || 0, status: r.status || 'Ready', currentlyInstalled: r.currently_installed || false, notes: r.notes || ''
      })));
      if (partsRes.data) setParts(parseRows(partsRes.data, PartsInventoryRowSchema, 'parts_inventory').map((r: any) => ({
        id: r.id, partNumber: r.part_number || '', description: r.description || '', category: r.category || '', subcategory: r.subcategory || '',
        vendor: r.vendor || '', vendorPartNumber: r.vendor_part_number || '', unitCost: parseFloat(r.unit_cost) || 0, onHand: r.on_hand || 0, minQuantity: r.min_quantity || 1, location: r.location || '', notes: r.notes || ''
      })));
      if (vendorsRes.data) setVendors(parseRows(vendorsRes.data, SetupVendorRowSchema, 'setup_vendors').map((r: any) => ({
        id: r.id, name: r.name, code: r.code || '', contactName: r.contact_name || '', email: r.email || '', phone: r.phone || '',
        address: r.address || '', city: r.city || '', state: r.state || '', zip: r.zip || '', website: r.website || '',
        category: r.category || 'General', paymentTerms: r.payment_terms || 'Net 30', notes: r.notes || '', rating: r.rating || 5
      })));

    } catch (err) {
      console.warn('Setup data load failed (non-blocking):', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);








  const showSuccess = (msg: string) => {
    setSaveError(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showSaveError = (msg: string) => {
    setSaveError(msg);
    setTimeout(() => setSaveError(null), 8000);
  };


  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTrackForm({ id: '', name: '', location: '', address: '', city: '', state: '', zip: '', elevation: 0, trackLength: '1/8 mile', surfaceType: 'Concrete', notes: '', isFavorite: false });
    setEngineForm({ id: '', name: '', serialNumber: '', builder: '', displacement: '', installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
    setTransForm({ id: '', name: '', serialNumber: '', type: 'Manual', model: '', builder: '', gearCount: 5, installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
    setScForm({ id: '', name: '', serialNumber: '', model: '', installDate: '', totalPasses: 0, status: 'Ready', currentlyInstalled: false, notes: '' });
    setPartForm({ id: '', partNumber: '', description: '', category: 'Engine', subcategory: '', vendor: '', vendorPartNumber: '', unitCost: 0, onHand: 0, minQuantity: 1, location: '', notes: '' });
    setVendorForm({ id: '', name: '', code: '', contactName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', website: '', category: 'General', paymentTerms: 'Net 30', notes: '', rating: 5 });
    setCrewForm(defaultCrewForm);
    setShowPermissionDetails(false);
  };

  const saveTrack = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, name: trackForm.name, location: `${trackForm.city}, ${trackForm.state}`,
        address: trackForm.address, city: trackForm.city, state: trackForm.state, zip: trackForm.zip,
        elevation: trackForm.elevation, track_length: trackForm.trackLength, surface_type: trackForm.surfaceType,
        notes: trackForm.notes, is_favorite: trackForm.isFavorite, updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('saved_tracks').upsert(payload);
      if (error) {
        console.error('Track save error:', error);
        showSaveError(`Failed to save track: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Track updated!' : 'Track added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Track save exception:', err);
      showSaveError(`Failed to save track: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };

  const saveEngine = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, name: engineForm.name, serial_number: engineForm.serialNumber, builder: engineForm.builder,
        displacement: engineForm.displacement, install_date: engineForm.installDate, total_passes: engineForm.totalPasses,
        status: engineForm.status, currently_installed: engineForm.currentlyInstalled, notes: engineForm.notes,
        components: {}
      };
      const { error } = await supabase.from('engines').upsert(payload);
      if (error) {
        console.error('Engine save error:', error);
        showSaveError(`Failed to save engine: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Engine updated!' : 'Engine added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Engine save exception:', err);
      showSaveError(`Failed to save engine: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };

  const saveTransmission = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, name: transForm.name, serial_number: transForm.serialNumber, type: transForm.type,
        model: transForm.model, builder: transForm.builder, gear_count: transForm.gearCount,
        install_date: transForm.installDate, total_passes: transForm.totalPasses,
        status: transForm.status, currently_installed: transForm.currentlyInstalled, notes: transForm.notes,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('transmissions').upsert(payload);
      if (error) {
        console.error('Transmission save error:', error);
        showSaveError(`Failed to save transmission: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Transmission updated!' : 'Transmission added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Transmission save exception:', err);
      showSaveError(`Failed to save transmission: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };

  const saveSupercharger = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, name: scForm.name, serial_number: scForm.serialNumber, model: scForm.model,
        install_date: scForm.installDate, total_passes: scForm.totalPasses,
        status: scForm.status, currently_installed: scForm.currentlyInstalled, notes: scForm.notes
      };
      const { error } = await supabase.from('superchargers').upsert(payload);
      if (error) {
        console.error('Supercharger save error:', error);
        showSaveError(`Failed to save supercharger: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Supercharger updated!' : 'Supercharger added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Supercharger save exception:', err);
      showSaveError(`Failed to save supercharger: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };

  const savePart = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, part_number: partForm.partNumber, description: partForm.description, category: partForm.category,
        subcategory: partForm.subcategory, vendor: partForm.vendor, vendor_part_number: partForm.vendorPartNumber,
        unit_cost: partForm.unitCost, on_hand: partForm.onHand, min_quantity: partForm.minQuantity,
        total_value: partForm.unitCost * partForm.onHand, location: partForm.location, notes: partForm.notes,
        status: partForm.onHand === 0 ? 'Out of Stock' : partForm.onHand <= partForm.minQuantity ? 'Low Stock' : 'In Stock',
        reorder_status: partForm.onHand === 0 ? 'Critical' : partForm.onHand <= partForm.minQuantity ? 'Reorder' : 'OK'
      };
      const { error } = await supabase.from('parts_inventory').upsert(payload);
      if (error) {
        console.error('Part save error:', error);
        showSaveError(`Failed to save part: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Part updated!' : 'Part added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Part save exception:', err);
      showSaveError(`Failed to save part: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };

  const saveVendor = async () => {
    setSaving(true);
    try {
      const id = editingId || generateId();
      const payload = {
        id, name: vendorForm.name, code: vendorForm.code, contact_name: vendorForm.contactName,
        email: vendorForm.email, phone: vendorForm.phone, address: vendorForm.address,
        city: vendorForm.city, state: vendorForm.state, zip: vendorForm.zip, website: vendorForm.website,
        category: vendorForm.category, payment_terms: vendorForm.paymentTerms,
        notes: vendorForm.notes, rating: vendorForm.rating, updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('setup_vendors').upsert(payload);
      if (error) {
        console.error('Vendor save error:', error);
        showSaveError(`Failed to save vendor: ${error.message || 'Unknown error'}`);
      } else {
        showSuccess(editingId ? 'Vendor updated!' : 'Vendor added!');
        resetForm();
        await loadData();
        await refreshData();
      }
    } catch (err: any) {
      console.error('Vendor save exception:', err);
      showSaveError(`Failed to save vendor: ${err?.message || 'Unexpected error'}`);
    }
    setSaving(false);
  };


  const saveCrewMember = async () => {
    setSaving(true);
    try {
      const member: TeamMember = {
        id: editingId || `TM-${Date.now()}`,
        name: crewForm.name || '',
        email: crewForm.email,
        phone: crewForm.phone,
        role: crewForm.role as TeamMember['role'] || 'Crew',
        permissions: crewForm.permissions || ['view'],
        specialties: crewForm.specialties,
        isActive: crewForm.isActive ?? true,
        joinedDate: crewForm.joinedDate || getLocalDateString(),

        emergencyContactName: crewForm.emergencyContactName,
        emergencyContactPhone: crewForm.emergencyContactPhone,
        notes: crewForm.notes,
        hourlyRate: crewForm.hourlyRate,
        dailyRate: crewForm.dailyRate,
      };

      if (editingId) {
        await updateTeamMember(member.id, member);
        showSuccess('Crew member updated!');
      } else {
        await addTeamMember(member);
        showSuccess('Crew member added!');
      }
      resetForm();
    } catch (err) {
      console.error('Error saving crew member:', err);
    }
    setSaving(false);
  };

  // ============ DELETE FUNCTIONS ============
  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      showSuccess('Item deleted!');
      await loadData();
      await refreshData();
    }
  };

  const deleteCrewMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this crew member?')) return;
    await deleteTeamMember(id);
    showSuccess('Crew member removed!');
  };



  // ============ EDIT FUNCTIONS ============
  const editTrack = (t: RaceTrack) => { setTrackForm(t); setEditingId(t.id); setShowForm(true); };
  const editEngine = (e: EngineEntry) => { setEngineForm(e); setEditingId(e.id); setShowForm(true); };
  const editTrans = (t: TransmissionEntry) => { setTransForm(t); setEditingId(t.id); setShowForm(true); };
  const editSc = (s: SuperchargerEntry) => { setScForm(s); setEditingId(s.id); setShowForm(true); };
  const editPart = (p: PartEntry) => { setPartForm(p); setEditingId(p.id); setShowForm(true); };
  const editVendor = (v: VendorEntry) => { setVendorForm(v); setEditingId(v.id); setShowForm(true); };
  const editCrewMember = (m: TeamMember) => {
    setCrewForm({
      name: m.name, email: m.email, phone: m.phone, role: m.role,
      permissions: m.permissions, specialties: m.specialties, isActive: m.isActive,
      joinedDate: m.joinedDate, emergencyContactName: m.emergencyContactName,
      emergencyContactPhone: m.emergencyContactPhone, notes: m.notes,
      hourlyRate: m.hourlyRate, dailyRate: m.dailyRate,
    });
    setEditingId(m.id);
    setShowForm(true);
  };


  const handleSave = () => {
    switch (activeTab) {
      case 'tracks': saveTrack(); break;
      case 'engines': saveEngine(); break;
      case 'transmissions': saveTransmission(); break;
      case 'superchargers': saveSupercharger(); break;
      case 'parts': savePart(); break;
      case 'vendors': saveVendor(); break;
      case 'crew': saveCrewMember(); break;
    }
  };

  const getItemCount = (tab: SetupTab) => {
    switch (tab) {
      case 'tracks': return tracks.length;
      case 'engines': return engines.length;
      case 'transmissions': return transmissions.length;
      case 'superchargers': return superchargers.length;
      case 'parts': return parts.length;
      case 'vendors': return vendors.length;
      case 'crew': return teamMembers.length;
    }
  };

  // ============ CREW PERMISSION TOGGLE ============
  const toggleCrewPermission = (permission: 'view' | 'edit' | 'admin') => {
    const current = crewForm.permissions || [];
    if (current.includes(permission)) {
      setCrewForm({ ...crewForm, permissions: current.filter(p => p !== permission) });
    } else {
      setCrewForm({ ...crewForm, permissions: [...current, permission] });
    }
  };

  const toggleCrewSpecialty = (spec: string) => {
    const current = crewForm.specialties || [];
    if (current.includes(spec)) {
      setCrewForm({ ...crewForm, specialties: current.filter(s => s !== spec) });
    } else {
      setCrewForm({ ...crewForm, specialties: [...current, spec] });
    }
  };

  const handleRoleChange = (newRole: TeamMember['role']) => {
    const defaultPerms = getDefaultPermissionsForRole(newRole);
    setCrewForm({ ...crewForm, role: newRole, permissions: defaultPerms });
  };

  // ============ FORM RENDERERS ============
  const renderTrackForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Track Name" value={trackForm.name} onChange={(e: any) => setTrackForm({ ...trackForm, name: e.target.value })} required placeholder="e.g. South Georgia Motorsports Park" />
      <InputField label="Street Address" value={trackForm.address} onChange={(e: any) => setTrackForm({ ...trackForm, address: e.target.value })} placeholder="1234 Racing Blvd" />
      <InputField label="City" value={trackForm.city} onChange={(e: any) => setTrackForm({ ...trackForm, city: e.target.value })} required placeholder="Valdosta" />
      <SelectField label="State" value={trackForm.state} onChange={(e: any) => setTrackForm({ ...trackForm, state: e.target.value })} options={getStateSelectOptions()} />

      <InputField label="ZIP Code" value={trackForm.zip} onChange={(e: any) => setTrackForm({ ...trackForm, zip: e.target.value })} placeholder="31601" />
      <InputField label="Elevation (ft)" value={trackForm.elevation} onChange={(e: any) => setTrackForm({ ...trackForm, elevation: parseInt(e.target.value) || 0 })} type="number" />
      <SelectField label="Track Length" value={trackForm.trackLength} onChange={(e: any) => setTrackForm({ ...trackForm, trackLength: e.target.value })} options={['1/8 mile', '1/4 mile', '1/8 & 1/4 mile']} />
      <SelectField label="Surface Type" value={trackForm.surfaceType} onChange={(e: any) => setTrackForm({ ...trackForm, surfaceType: e.target.value })} options={['Concrete', 'Asphalt', 'Mixed']} />
      <div className="flex items-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={trackForm.isFavorite} onChange={(e) => setTrackForm({ ...trackForm, isFavorite: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
          <span className="text-sm text-slate-300">Favorite Track</span>
        </label>
      </div>
      <TextAreaField label="Notes" value={trackForm.notes} onChange={(e: any) => setTrackForm({ ...trackForm, notes: e.target.value })} className="md:col-span-2 lg:col-span-3" />
    </div>
  );

  const renderEngineForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Engine Name" value={engineForm.name} onChange={(e: any) => setEngineForm({ ...engineForm, name: e.target.value })} required placeholder="e.g. Hemi #1 - Primary" />
      <InputField label="Serial Number" value={engineForm.serialNumber} onChange={(e: any) => setEngineForm({ ...engineForm, serialNumber: e.target.value })} placeholder="N49-2024-001" />
      <InputField label="Builder" value={engineForm.builder} onChange={(e: any) => setEngineForm({ ...engineForm, builder: e.target.value })} placeholder="Noonan Race Engineering" />
      <InputField label="Displacement" value={engineForm.displacement} onChange={(e: any) => setEngineForm({ ...engineForm, displacement: e.target.value })} placeholder="4.900" />
      <InputField label="Install Date" value={engineForm.installDate} onChange={(e: any) => setEngineForm({ ...engineForm, installDate: e.target.value })} type="date" />
      <InputField label="Total Passes" value={engineForm.totalPasses} onChange={(e: any) => setEngineForm({ ...engineForm, totalPasses: parseInt(e.target.value) || 0 })} type="number" />
      <SelectField label="Status" value={engineForm.status} onChange={(e: any) => setEngineForm({ ...engineForm, status: e.target.value })} options={['Active', 'Ready', 'Rebuild', 'Retired']} />
      <div className="flex items-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={engineForm.currentlyInstalled} onChange={(e) => setEngineForm({ ...engineForm, currentlyInstalled: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
          <span className="text-sm text-slate-300">Currently Installed</span>
        </label>
      </div>
      <TextAreaField label="Notes" value={engineForm.notes} onChange={(e: any) => setEngineForm({ ...engineForm, notes: e.target.value })} className="md:col-span-2 lg:col-span-3" />
    </div>
  );

  const renderTransmissionForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Transmission Name" value={transForm.name} onChange={(e: any) => setTransForm({ ...transForm, name: e.target.value })} required placeholder="e.g. Liberty 5-Speed #1" />
      <InputField label="Serial Number" value={transForm.serialNumber} onChange={(e: any) => setTransForm({ ...transForm, serialNumber: e.target.value })} placeholder="LIB-2024-001" />
      <SelectField label="Type" value={transForm.type} onChange={(e: any) => setTransForm({ ...transForm, type: e.target.value })} options={['Manual', 'Automatic', 'Lenco', 'Powerglide', 'TH400', 'Liberty', 'G-Force', 'Other']} />
      <InputField label="Model" value={transForm.model} onChange={(e: any) => setTransForm({ ...transForm, model: e.target.value })} placeholder="Liberty Air 5-Speed" />
      <InputField label="Builder" value={transForm.builder} onChange={(e: any) => setTransForm({ ...transForm, builder: e.target.value })} placeholder="Liberty Gears" />
      <InputField label="Gear Count" value={transForm.gearCount} onChange={(e: any) => setTransForm({ ...transForm, gearCount: parseInt(e.target.value) || 5 })} type="number" />
      <InputField label="Install Date" value={transForm.installDate} onChange={(e: any) => setTransForm({ ...transForm, installDate: e.target.value })} type="date" />
      <InputField label="Total Passes" value={transForm.totalPasses} onChange={(e: any) => setTransForm({ ...transForm, totalPasses: parseInt(e.target.value) || 0 })} type="number" />
      <SelectField label="Status" value={transForm.status} onChange={(e: any) => setTransForm({ ...transForm, status: e.target.value })} options={['Active', 'Ready', 'Rebuild', 'Service', 'Retired']} />
      <div className="flex items-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={transForm.currentlyInstalled} onChange={(e) => setTransForm({ ...transForm, currentlyInstalled: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
          <span className="text-sm text-slate-300">Currently Installed</span>
        </label>
      </div>
      <TextAreaField label="Notes" value={transForm.notes} onChange={(e: any) => setTransForm({ ...transForm, notes: e.target.value })} className="md:col-span-2 lg:col-span-2" />
    </div>
  );

  const renderSuperchargerForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Supercharger Name" value={scForm.name} onChange={(e: any) => setScForm({ ...scForm, name: e.target.value })} required placeholder="e.g. ProCharger #1 - Primary" />
      <InputField label="Serial Number" value={scForm.serialNumber} onChange={(e: any) => setScForm({ ...scForm, serialNumber: e.target.value })} placeholder="PC-F3X-2024-0156" />
      <InputField label="Model" value={scForm.model} onChange={(e: any) => setScForm({ ...scForm, model: e.target.value })} placeholder="F-3X-140" />
      <InputField label="Install Date" value={scForm.installDate} onChange={(e: any) => setScForm({ ...scForm, installDate: e.target.value })} type="date" />
      <InputField label="Total Passes" value={scForm.totalPasses} onChange={(e: any) => setScForm({ ...scForm, totalPasses: parseInt(e.target.value) || 0 })} type="number" />
      <SelectField label="Status" value={scForm.status} onChange={(e: any) => setScForm({ ...scForm, status: e.target.value })} options={['Active', 'Ready', 'Service', 'Retired']} />
      <div className="flex items-end">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={scForm.currentlyInstalled} onChange={(e) => setScForm({ ...scForm, currentlyInstalled: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
          <span className="text-sm text-slate-300">Currently Installed</span>
        </label>
      </div>
      <TextAreaField label="Notes" value={scForm.notes} onChange={(e: any) => setScForm({ ...scForm, notes: e.target.value })} className="md:col-span-2 lg:col-span-2" />
    </div>
  );

  const renderPartForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Part Number" value={partForm.partNumber} onChange={(e: any) => setPartForm({ ...partForm, partNumber: e.target.value })} required placeholder="NRE-CRANK-49" />
      <InputField label="Description" value={partForm.description} onChange={(e: any) => setPartForm({ ...partForm, description: e.target.value })} required placeholder="Noonan 4.9 Hemi Billet Crankshaft" className="lg:col-span-2" />
      <SelectField label="Category" value={partForm.category} onChange={(e: any) => setPartForm({ ...partForm, category: e.target.value })} options={PART_CATEGORIES} />
      <InputField label="Subcategory" value={partForm.subcategory} onChange={(e: any) => setPartForm({ ...partForm, subcategory: e.target.value })} placeholder="Bottom End" />
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Vendor</label>
        <select
          value={partForm.vendor}
          onChange={(e: any) => setPartForm({ ...partForm, vendor: e.target.value })}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
        >
          <option value="">Select vendor...</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}{v.category ? ` (${v.category})` : ''}
            </option>
          ))}
        </select>
      </div>

      <InputField label="Vendor Part Number" value={partForm.vendorPartNumber} onChange={(e: any) => setPartForm({ ...partForm, vendorPartNumber: e.target.value })} placeholder="NRE-49-CRANK-001" />
      <InputField label="Unit Cost ($)" value={partForm.unitCost} onChange={(e: any) => setPartForm({ ...partForm, unitCost: parseFloat(e.target.value) || 0 })} type="number" />
      <InputField label="On Hand" value={partForm.onHand} onChange={(e: any) => setPartForm({ ...partForm, onHand: parseInt(e.target.value) || 0 })} type="number" />
      <InputField label="Min Quantity" value={partForm.minQuantity} onChange={(e: any) => setPartForm({ ...partForm, minQuantity: parseInt(e.target.value) || 1 })} type="number" />
      <InputField label="Storage Location" value={partForm.location} onChange={(e: any) => setPartForm({ ...partForm, location: e.target.value })} placeholder="Engine Room - Shelf A1" />
      <TextAreaField label="Notes" value={partForm.notes} onChange={(e: any) => setPartForm({ ...partForm, notes: e.target.value })} className="md:col-span-2" />
    </div>
  );

  const renderVendorForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InputField label="Company Name" value={vendorForm.name} onChange={(e: any) => setVendorForm({ ...vendorForm, name: e.target.value })} required placeholder="Noonan Race Engineering" />
      <InputField label="Vendor Code" value={vendorForm.code} onChange={(e: any) => setVendorForm({ ...vendorForm, code: e.target.value })} placeholder="NRE" />
      <InputField label="Contact Name" value={vendorForm.contactName} onChange={(e: any) => setVendorForm({ ...vendorForm, contactName: e.target.value })} placeholder="Mike Noonan" />
      <InputField label="Email" value={vendorForm.email} onChange={(e: any) => setVendorForm({ ...vendorForm, email: e.target.value })} type="email" placeholder="orders@noonanracing.com" />
      <InputField label="Phone" value={vendorForm.phone} onChange={(e: any) => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="(555) 123-4567" />
      <InputField label="Website" value={vendorForm.website} onChange={(e: any) => setVendorForm({ ...vendorForm, website: e.target.value })} placeholder="www.noonanracing.com" />
      <InputField label="Street Address" value={vendorForm.address} onChange={(e: any) => setVendorForm({ ...vendorForm, address: e.target.value })} placeholder="1234 Racing Blvd" />
      <InputField label="City" value={vendorForm.city} onChange={(e: any) => setVendorForm({ ...vendorForm, city: e.target.value })} placeholder="Indianapolis" />
      <SelectField label="State" value={vendorForm.state} onChange={(e: any) => setVendorForm({ ...vendorForm, state: e.target.value })} options={getStateSelectOptions()} />

      <InputField label="ZIP Code" value={vendorForm.zip} onChange={(e: any) => setVendorForm({ ...vendorForm, zip: e.target.value })} placeholder="46222" />
      <SelectField label="Category" value={vendorForm.category} onChange={(e: any) => setVendorForm({ ...vendorForm, category: e.target.value })} options={VENDOR_CATEGORIES} />
      <SelectField label="Payment Terms" value={vendorForm.paymentTerms} onChange={(e: any) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })} options={['COD', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Prepaid']} />
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Rating</label>
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} type="button" onClick={() => setVendorForm({ ...vendorForm, rating: star })}
              className={`p-0.5 ${star <= vendorForm.rating ? 'text-orange-400' : 'text-slate-600'}`}>
              <Star className="w-5 h-5 fill-current" />
            </button>
          ))}
        </div>
      </div>
      <TextAreaField label="Notes" value={vendorForm.notes} onChange={(e: any) => setVendorForm({ ...vendorForm, notes: e.target.value })} className="md:col-span-2" />
    </div>
  );

  const renderCrewForm = () => {
    const selectedRole = (crewForm.role || 'Crew') as CrewRole;
    const rolePerms = getPermissionsForRole(selectedRole);

    return (
      <div className="space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField label="Full Name" value={crewForm.name || ''} onChange={(e: any) => setCrewForm({ ...crewForm, name: e.target.value })} required placeholder="e.g. John Smith" />
          <InputField label="Email" value={crewForm.email || ''} onChange={(e: any) => setCrewForm({ ...crewForm, email: e.target.value })} type="email" placeholder="john@example.com" />
          <InputField label="Phone" value={crewForm.phone || ''} onChange={(e: any) => setCrewForm({ ...crewForm, phone: e.target.value })} placeholder="(555) 123-4567" />
        </div>

        {/* Role & Permissions */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Role & Permissions
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
              <select
                value={crewForm.role || 'Crew'}
                onChange={(e) => handleRoleChange(e.target.value as TeamMember['role'])}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              >
                {MEMBER_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">{getRoleDescription(selectedRole)}</p>
            </div>

            {/* Quick Permissions */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Access Level</label>
              <div className="flex gap-2 mt-0.5">
                <button type="button" onClick={() => toggleCrewPermission('view')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    crewForm.permissions?.includes('view')
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'
                  }`}>
                  <Eye className="w-4 h-4" /> View
                </button>
                <button type="button" onClick={() => toggleCrewPermission('edit')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    crewForm.permissions?.includes('edit')
                      ? 'bg-green-500/20 text-green-400 border-green-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'
                  }`}>
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button type="button" onClick={() => toggleCrewPermission('admin')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    crewForm.permissions?.includes('admin')
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'
                  }`}>
                  <Shield className="w-4 h-4" /> Admin
                </button>
              </div>
            </div>
          </div>

          {/* Detailed Permission View Toggle */}
          <button
            type="button"
            onClick={() => setShowPermissionDetails(!showPermissionDetails)}
            className="flex items-center gap-2 mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPermissionDetails ? 'rotate-180' : ''}`} />
            {showPermissionDetails ? 'Hide' : 'Show'} detailed permissions for {selectedRole}
          </button>

          {/* Detailed Permissions Grid */}
          {showPermissionDetails && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-start gap-2 mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-300">
                  These are the system-level permissions automatically assigned to the <strong>{selectedRole}</strong> role. 
                  The access level buttons above control what this member can do within the app interface.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(permissionCategories).map(([key, category]) => {
                  const categoryPerms = category.permissions.filter(p =>
                    rolePerms.includes(p.id as Permission)
                  );
                  const totalPerms = category.permissions.length;
                  const hasPerms = categoryPerms.length;

                  return (
                    <div key={key} className="bg-slate-900/50 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <h6 className="text-xs font-medium text-white">{category.label}</h6>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          hasPerms === totalPerms ? 'bg-green-500/20 text-green-400' :
                          hasPerms > 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-500/20 text-slate-500'
                        }`}>
                          {hasPerms}/{totalPerms}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {category.permissions.map(perm => {
                          const hasIt = rolePerms.includes(perm.id as Permission);
                          return (
                            <div key={perm.id} className={`flex items-center gap-1.5 text-[11px] ${hasIt ? 'text-green-400' : 'text-slate-600'}`}>
                              {hasIt ? <Check className="w-3 h-3 flex-shrink-0" /> : <X className="w-3 h-3 flex-shrink-0" />}
                              <span className="truncate">{perm.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Specialties */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Specialties</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map(spec => (
              <button
                key={spec}
                type="button"
                onClick={() => toggleCrewSpecialty(spec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  crewForm.specialties?.includes(spec)
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField label="Join Date" value={crewForm.joinedDate || ''} onChange={(e: any) => setCrewForm({ ...crewForm, joinedDate: e.target.value })} type="date" />
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={crewForm.isActive ?? true} onChange={(e) => setCrewForm({ ...crewForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
              <span className="text-sm text-slate-300">Active Member</span>
            </label>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-red-400" />
            Emergency Contact
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Contact Name" value={crewForm.emergencyContactName || ''} onChange={(e: any) => setCrewForm({ ...crewForm, emergencyContactName: e.target.value })} placeholder="Jane Smith" />
            <InputField label="Contact Phone" value={crewForm.emergencyContactPhone || ''} onChange={(e: any) => setCrewForm({ ...crewForm, emergencyContactPhone: e.target.value })} placeholder="(555) 987-6543" />
          </div>
        </div>

        {/* Labor Costs */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
          <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Labor Costs
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField label="Hourly Rate ($)" value={crewForm.hourlyRate || ''} onChange={(e: any) => setCrewForm({ ...crewForm, hourlyRate: e.target.value ? parseFloat(e.target.value) : undefined })} type="number" placeholder="e.g. 125" />
              <p className="text-[10px] text-slate-500 mt-1">Per hour rate for labor tracking</p>
            </div>
            <div>
              <InputField label="Daily Rate ($)" value={crewForm.dailyRate || ''} onChange={(e: any) => setCrewForm({ ...crewForm, dailyRate: e.target.value ? parseFloat(e.target.value) : undefined })} type="number" placeholder="e.g. 800" />
              <p className="text-[10px] text-slate-500 mt-1">Per day rate for race events</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <TextAreaField label="Notes" value={crewForm.notes || ''} onChange={(e: any) => setCrewForm({ ...crewForm, notes: e.target.value })} />
      </div>
    );
  };

  // ============ LIST RENDERERS ============
  const filterBySearch = (items: any[], fields: string[]) => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(q)));
  };

  const renderTracksList = () => {
    const filtered = filterBySearch(tracks, ['name', 'city', 'state', 'address']);
    return filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-500">
        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No racetracks added yet</p>
        <p className="text-sm mt-1">Click "Add New" to enter your first track</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-orange-500/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <h4 className="font-semibold text-white text-sm">{t.name}</h4>
              </div>
              {t.isFavorite && <Star className="w-4 h-4 text-orange-400 fill-current flex-shrink-0" />}
            </div>
            <div className="space-y-1 text-xs text-slate-400 mb-3">
              {t.address && <p>{t.address}</p>}
              <p>{t.city}{t.state ? `, ${t.state}` : ''} {t.zip}</p>
              <p>{t.trackLength} | {t.surfaceType} | Elev: {t.elevation} ft</p>
              {t.notes && <p className="text-slate-500 italic mt-1">{t.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => editTrack(t)} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"><Pencil className="w-3 h-3" /> Edit</button>
              <button onClick={() => deleteItem('saved_tracks', t.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEquipmentList = (items: any[], type: 'engines' | 'transmissions' | 'superchargers', editFn: (item: any) => void, table: string) => {
    const fields = type === 'engines' ? ['name', 'builder', 'serialNumber'] : type === 'transmissions' ? ['name', 'builder', 'model'] : ['name', 'model', 'serialNumber'];
    const filtered = filterBySearch(items, fields);
    const Icon = type === 'engines' ? Cog : type === 'transmissions' ? Settings : Zap;
    const label = type === 'engines' ? 'engines' : type === 'transmissions' ? 'transmissions' : 'superchargers';

    return filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-500">
        <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No {label} added yet</p>
        <p className="text-sm mt-1">Click "Add New" to enter your first {label.slice(0, -1)}</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item: any) => (
          <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-orange-500/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <h4 className="font-semibold text-white text-sm">{item.name}</h4>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-400 mb-3">
              {item.serialNumber && <p className="flex items-center gap-1"><Hash className="w-3 h-3" /> {item.serialNumber}</p>}
              {item.builder && <p><span className="text-slate-500">Builder:</span> {item.builder}</p>}
              {item.model && <p><span className="text-slate-500">Model:</span> {item.model}</p>}
              {type === 'transmissions' && item.gearCount && <p><span className="text-slate-500">Gears:</span> {item.gearCount}-Speed {item.type}</p>}
              <p><span className="text-slate-500">Passes:</span> {item.totalPasses}</p>
              {item.currentlyInstalled && <span className="inline-block px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-medium">Installed</span>}
              {item.notes && <p className="text-slate-500 italic mt-1">{item.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => editFn(item)} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"><Pencil className="w-3 h-3" /> Edit</button>
              <button onClick={() => deleteItem(table, item.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPartsList = () => {
    const filtered = filterBySearch(parts, ['partNumber', 'description', 'vendor', 'category']);
    return filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-500">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No parts added yet</p>
        <p className="text-sm mt-1">Click "Add New" to enter your first part</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Part #</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Description</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs hidden md:table-cell">Category</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs hidden lg:table-cell">Vendor</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium text-xs">Qty</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium text-xs hidden md:table-cell">Cost</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-2 px-3 text-orange-400 font-mono text-xs">{p.partNumber}</td>
                <td className="py-2 px-3 text-white text-xs">{p.description}</td>
                <td className="py-2 px-3 text-slate-400 text-xs hidden md:table-cell">{p.category}</td>
                <td className="py-2 px-3 text-slate-400 text-xs hidden lg:table-cell">{p.vendor}</td>
                <td className="py-2 px-3 text-right text-xs">
                  <span className={p.onHand <= p.minQuantity ? 'text-red-400' : 'text-white'}>{p.onHand}</span>
                </td>
                <td className="py-2 px-3 text-right text-slate-300 text-xs hidden md:table-cell">${p.unitCost.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => editPart(p)} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deleteItem('parts_inventory', p.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderVendorsList = () => {
    const filtered = filterBySearch(vendors, ['name', 'contactName', 'email', 'category', 'city']);
    return filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-500">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No vendors added yet</p>
        <p className="text-sm mt-1">Click "Add New" to enter your first vendor</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(v => (
          <div key={v.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-orange-500/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">{v.name}</h4>
                {v.code && <span className="text-xs text-orange-400 font-mono">{v.code}</span>}
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">{v.category}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 mb-3">
              {v.contactName && <p className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-slate-500" /> {v.contactName}</p>}
              {v.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-500" /> {v.phone}</p>}
              {v.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-500" /> {v.email}</p>}
              {v.website && <p className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-slate-500" /> {v.website}</p>}
              {(v.city || v.state) && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-500" /> {v.address ? `${v.address}, ` : ''}{v.city}{v.state ? `, ${v.state}` : ''} {v.zip}</p>}
              <p><span className="text-slate-500">Terms:</span> {v.paymentTerms}</p>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-3 h-3 ${star <= v.rating ? 'text-orange-400 fill-current' : 'text-slate-600'}`} />
                ))}
              </div>
              {v.notes && <p className="text-slate-500 italic mt-1">{v.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => editVendor(v)} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"><Pencil className="w-3 h-3" /> Edit</button>
              <button onClick={() => deleteItem('setup_vendors', v.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCrewList = () => {
    const filtered = filterBySearch(teamMembers, ['name', 'email', 'phone', 'role']);
    return filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-500">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No crew members added yet</p>
        <p className="text-sm mt-1">Click "Add New" to add your first crew member</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(member => (
          <div key={member.id} className={`bg-slate-800/50 border rounded-xl p-4 hover:border-orange-500/30 transition-colors ${
            member.isActive ? 'border-slate-700/50' : 'border-red-500/30 opacity-60'
          }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                  {getRoleIcon(member.role)}
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{member.name}</h4>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getLocalRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              </div>
              {!member.isActive && (
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">Inactive</span>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-1.5 text-xs text-slate-400 mb-3">
              {member.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-500" /> {member.email}
                </p>
              )}
              {member.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-500" /> {member.phone}
                </p>
              )}
              {member.joinedDate && (
                <p className="text-slate-500">Joined: {member.joinedDate}</p>
              )}
              {(member.hourlyRate || member.dailyRate) && (
                <p className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-green-500" />
                  {member.hourlyRate ? `$${member.hourlyRate}/hr` : ''}
                  {member.hourlyRate && member.dailyRate ? ' | ' : ''}
                  {member.dailyRate ? `$${member.dailyRate}/day` : ''}
                </p>
              )}
            </div>

            {/* Specialties */}
            {member.specialties && member.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {member.specialties.map(spec => (
                  <span key={spec} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
                    {spec}
                  </span>
                ))}
              </div>
            )}

            {/* Permissions */}
            <div className="flex gap-1 mb-3 pt-2 border-t border-slate-700/50">
              {member.permissions.includes('view') && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                  <Eye className="w-2.5 h-2.5" /> View
                </span>
              )}
              {member.permissions.includes('edit') && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                  <Edit2 className="w-2.5 h-2.5" /> Edit
                </span>
              )}
              {member.permissions.includes('admin') && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              )}
            </div>

            {/* Notes */}
            {member.notes && (
              <p className="text-xs text-slate-500 italic mb-3">{member.notes}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => editCrewMember(member)} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => deleteCrewMember(member.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActiveForm = () => {
    switch (activeTab) {
      case 'tracks': return renderTrackForm();
      case 'engines': return renderEngineForm();
      case 'transmissions': return renderTransmissionForm();
      case 'superchargers': return renderSuperchargerForm();
      case 'parts': return renderPartForm();
      case 'vendors': return renderVendorForm();
      case 'crew': return renderCrewForm();
    }
  };

  const renderActiveList = () => {
    switch (activeTab) {
      case 'tracks': return renderTracksList();
      case 'engines': return renderEquipmentList(engines, 'engines', editEngine, 'engines');
      case 'transmissions': return renderEquipmentList(transmissions, 'transmissions', editTrans, 'transmissions');
      case 'superchargers': return renderEquipmentList(superchargers, 'superchargers', editSc, 'superchargers');
      case 'parts': return renderPartsList();
      case 'vendors': return renderVendorsList();
      case 'crew': return renderCrewList();
    }
  };

  const isFormValid = () => {
    switch (activeTab) {
      case 'tracks': return trackForm.name.trim() !== '' && trackForm.city.trim() !== '';
      case 'engines': return engineForm.name.trim() !== '';
      case 'transmissions': return transForm.name.trim() !== '';
      case 'superchargers': return scForm.name.trim() !== '';
      case 'parts': return partForm.partNumber.trim() !== '' && partForm.description.trim() !== '';
      case 'vendors': return vendorForm.name.trim() !== '';
      case 'crew': return (crewForm.name || '').trim() !== '';
    }
  };

  // NEVER block the UI with a loading screen — render immediately, data loads in background


  return (
    <div className="max-w-[1920px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Initial Setup</h2>
            <p className="text-sm text-slate-400">Enter your racetracks, equipment, parts, vendors, and crew information</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
          {tabConfig.map(tab => {
            const Icon = tab.icon;
            const count = getItemCount(tab.id);
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); resetForm(); setSearchQuery(''); }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  activeTab === tab.id ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-orange-400' : 'text-slate-500'}`} />
                <div>
                  <p className={`text-xs font-medium ${activeTab === tab.id ? 'text-orange-400' : 'text-slate-400'}`}>{tab.label}</p>
                  <p className="text-lg font-bold text-white">{count}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* Save Error Message */}
      {saveError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Tab Content */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        {/* Tab Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            {(() => { const Icon = tabConfig.find(t => t.id === activeTab)!.icon; return <Icon className="w-5 h-5 text-orange-400" />; })()}
            <div>
              <h3 className="text-lg font-semibold text-white">{tabConfig.find(t => t.id === activeTab)!.label}</h3>
              <p className="text-xs text-slate-400">{tabConfig.find(t => t.id === activeTab)!.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
                className="pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm w-48 focus:border-orange-500 outline-none" />
            </div>
            {!showForm ? (
              <button onClick={() => { resetForm(); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium hover:from-orange-600 hover:to-red-700 transition-all">
                <Plus className="w-4 h-4" /> {activeTab === 'crew' ? 'Add Member' : 'Add New'}
              </button>
            ) : (
              <button onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-all">
                <X className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="px-4 py-4 border-b border-slate-700/50 bg-slate-800/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-orange-500 rounded-full" />
              <h4 className="text-sm font-semibold text-white">
                {editingId ? 'Edit' : 'Add New'} {activeTab === 'crew' ? 'Crew Member' : tabConfig.find(t => t.id === activeTab)!.label.slice(0, -1)}
              </h4>
            </div>
            {renderActiveForm()}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-700/50">
              <button onClick={handleSave} disabled={saving || !isFormValid()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-all">
                Cancel
              </button>
              {!isFormValid() && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Fill in required fields
                </span>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="p-4">
          {renderActiveList()}
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;
