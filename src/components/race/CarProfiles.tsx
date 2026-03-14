import React, { useState, useEffect, useRef } from 'react';
import { useCar, RaceCar } from '@/contexts/CarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/contexts/ThemeColorContext';
import { CrewRole, hasPermission } from '@/lib/permissions';
import {
  Car, Plus, Edit2, Trash2, X, Save, Search, CheckCircle, XCircle,
  Hash, Palette, Calendar, FileText, Tag, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, RefreshCw, Paintbrush
} from 'lucide-react';

interface CarProfilesProps {
  currentRole?: CrewRole;
}


const carClasses = [
  'Pro Mod', 'Pro Nitrous', 'Pro Boost', 'Outlaw Pro Mod', 'X275',
  'Radial vs World', 'No Prep', 'Top Sportsman', 'Top Dragster',
  'Super Street', 'Limited Drag Radial',
  'Outlaw 10.5', 'Pro Street 10.5', 'Small Tire 28 x 10.5', 'Ultra Street',
  'Outlaw 632', 'Nitro Funny Car', 'Top Alcohol Funny Car',
  'Top Fuel Dragster', 'Top Alcohol Dragster', 'Factory Stock', 'Other'
];

const PRESET_TEAM_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#f43f5e', '#64748b', '#78716c', '#ffffff',
];

const defaultForm = {
  carNumber: '',
  nickname: '',
  class: 'Pro Mod',
  year: null as number | null,
  make: '',
  model: '',
  color: '',
  isActive: true,
  notes: '',
};

const CarProfiles: React.FC<CarProfilesProps> = ({ currentRole = 'Crew' }) => {
  const { cars, addCar, updateCar, deleteCar, selectedCarId, setSelectedCarId, isLoading: carsLoading, refreshCars } = useCar();
  const { user, isDemoMode, isAuthenticated } = useAuth();
  const { getTeamColor, setTeamColor, getDefaultColor } = useThemeColor();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [teamColorValue, setTeamColorValue] = useState('#ef4444');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canEdit = hasPermission(currentRole, 'settings.edit');

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    // Set default team color for new car based on index
    const nextIndex = cars.length;
    setTeamColorValue(getDefaultColor(nextIndex));
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (car: RaceCar) => {
    setEditingId(car.id);
    setForm({
      carNumber: car.carNumber,
      nickname: car.nickname,
      class: car.class,
      year: car.year,
      make: car.make,
      model: car.model,
      color: car.color,
      isActive: car.isActive,
      notes: car.notes,
    });
    // Load the car's team color
    setTeamColorValue(getTeamColor(car.id));
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    // Validate: need at least one identifier
    if (!form.nickname && !form.carNumber && !form.make) {
      setFormError('Please provide at least a car number, nickname, or make to identify this car.');
      return;
    }

    // Check authentication
    if (!isAuthenticated) {
      setFormError('You must be signed in to save a car. Please sign in first.');
      return;
    }

    if (!isDemoMode && !user?.id) {
      setFormError('Authentication error: No user ID found. Please sign out and sign back in.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      let result;
      if (editingId) {
        result = await updateCar(editingId, form);
        if (result.success) {
          // Save team color for existing car
          setTeamColor(editingId, teamColorValue);
        }
      } else {
        result = await addCar(form);
        // For new cars, we need to find the newly added car and set its team color
        // The car will be added to the cars array after addCar completes
      }

      if (result.success) {
        // For new cars, set team color after a brief delay to allow the car to be added
        if (!editingId) {
          setTimeout(() => {
            // Find the most recently added car (last in the array)
            const latestCars = JSON.parse(localStorage.getItem('demo_race_cars') || '[]');
            // We'll set it on the next render when cars update
          }, 100);
        }
        setShowForm(false);
        setEditingId(null);
        setForm(defaultForm);
        setFormError(null);
      } else {
        setFormError(result.error || 'An unknown error occurred. Please try again.');
      }
    } catch (err: any) {
      console.error('[CarProfiles] Unexpected error in handleSave:', err);
      setFormError(`Unexpected error: ${err?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  // When a new car is added, set its team color
  const handleSaveWithTeamColor = async () => {
    if (!form.nickname && !form.carNumber && !form.make) {
      setFormError('Please provide at least a car number, nickname, or make to identify this car.');
      return;
    }

    if (!isAuthenticated) {
      setFormError('You must be signed in to save a car. Please sign in first.');
      return;
    }

    if (!isDemoMode && !user?.id) {
      setFormError('Authentication error: No user ID found. Please sign out and sign back in.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      let result;
      if (editingId) {
        result = await updateCar(editingId, form);
        if (result.success) {
          setTeamColor(editingId, teamColorValue);
        }
      } else {
        // Capture current car count to identify the new car
        const prevCarIds = new Set(cars.map(c => c.id));
        result = await addCar(form);
        if (result.success) {
          // Wait a tick for the cars array to update, then find the new car
          setTimeout(() => {
            const newCar = cars.find(c => !prevCarIds.has(c.id));
            if (newCar) {
              setTeamColor(newCar.id, teamColorValue);
            }
          }, 500);
        }
      }

      if (result.success) {
        setShowForm(false);
        setEditingId(null);
        setForm(defaultForm);
        setFormError(null);
      } else {
        setFormError(result.error || 'An unknown error occurred. Please try again.');
      }
    } catch (err: any) {
      console.error('[CarProfiles] Unexpected error in handleSave:', err);
      setFormError(`Unexpected error: ${err?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}"? This cannot be undone.`)) {
      const result = await deleteCar(id);
      if (!result.success) {
        // Error toast is already shown by CarContext
      }
    }
  };

  const handleRefresh = async () => {
    await refreshCars();
  };

  const filteredCars = cars.filter(car => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      car.carNumber.toLowerCase().includes(s) ||
      car.nickname.toLowerCase().includes(s) ||
      car.make.toLowerCase().includes(s) ||
      car.model.toLowerCase().includes(s) ||
      car.class.toLowerCase().includes(s)
    );
  });

  const getCarDisplayName = (car: RaceCar) => {
    const parts: string[] = [];
    if (car.carNumber) parts.push(`#${car.carNumber}`);
    if (car.nickname) parts.push(car.nickname);
    if (!parts.length) {
      if (car.year) parts.push(String(car.year));
      if (car.make) parts.push(car.make);
      if (car.model) parts.push(car.model);
    }
    return parts.join(' ') || 'Unnamed Car';
  };

  const getCarSubtitle = (car: RaceCar) => {
    const parts: string[] = [];
    if (car.year) parts.push(String(car.year));
    if (car.make) parts.push(car.make);
    if (car.model) parts.push(car.model);
    return parts.join(' ');
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Car Profiles</h2>
              <p className="text-slate-400 text-sm">
                {cars.length} car{cars.length !== 1 ? 's' : ''} registered
                {cars.filter(c => c.isActive).length !== cars.length && ` (${cars.filter(c => c.isActive).length} active)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={carsLoading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh car list"
            >
              <RefreshCw className={`w-4 h-4 ${carsLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Search */}
            {cars.length > 0 && (
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search cars..."
                  className="pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm w-48 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {canEdit && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Car
              </button>
            )}
          </div>
        </div>

        {/* Auth Warning */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium">Sign in required</p>
              <p className="text-amber-400/70 text-sm">You need to sign in to add and manage cars. Cars won't be saved without an account.</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {carsLoading && cars.length === 0 && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
            <p className="text-slate-400">Loading cars...</p>
          </div>
        )}

        {/* Car Grid */}
        {!carsLoading && filteredCars.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Car className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {cars.length === 0 ? 'No Cars Added Yet' : 'No Cars Match Your Search'}
            </h3>
            <p className="text-slate-400 mb-4">
              {cars.length === 0
                ? 'Add your first race car to get started with multi-car team management.'
                : 'Try adjusting your search terms.'}
            </p>
            {cars.length === 0 && canEdit && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Your First Car
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCars.map(car => {
              const isExpanded = expandedId === car.id;
              const isSelected = selectedCarId === car.id;
              const carTeamColor = getTeamColor(car.id);
              
              return (
                <div
                  key={car.id}
                  className={`bg-slate-800/50 rounded-xl border transition-all overflow-hidden ${
                    isSelected
                      ? 'ring-1'
                      : car.isActive
                        ? 'border-slate-700/50 hover:border-slate-600'
                        : 'border-red-500/30 opacity-70'
                  }`}
                  style={isSelected ? {
                    borderColor: `${carTeamColor}99`,
                    boxShadow: `0 0 0 1px ${carTeamColor}4D`,
                  } : undefined}
                >
                  {/* Team Color Strip at top */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: carTeamColor }}
                  />

                  {/* Card Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border-2"
                          style={{
                            backgroundColor: `${carTeamColor}33`,
                            borderColor: `${carTeamColor}66`,
                          }}
                        >
                          <Car className="w-5 h-5 text-white drop-shadow" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold truncate">{getCarDisplayName(car)}</h3>
                          <p className="text-slate-400 text-sm truncate">{getCarSubtitle(car)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(car)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(car.id, getCarDisplayName(car))}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Info */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {car.class && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${carTeamColor}26`,
                            color: carTeamColor,
                          }}
                        >
                          {car.class}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        car.isActive
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {car.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {car.carNumber && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                          #{car.carNumber}
                        </span>
                      )}
                    </div>

                    {/* Team Color indicator */}
                    <div className="flex items-center gap-2 mt-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-slate-600"
                        style={{ backgroundColor: carTeamColor }}
                      />
                      <span className="text-[11px] text-slate-500">Team Color</span>
                    </div>

                    {/* Expand/Collapse */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : car.id)}
                      className="flex items-center gap-1 mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? 'Less' : 'More details'}
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2 text-sm">
                        {car.color && (
                          <div className="flex items-center gap-2">
                            <Palette className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-400">Paint Color:</span>
                            <span className="text-white">{car.color}</span>
                            <div className="w-4 h-4 rounded border border-slate-600" style={{ backgroundColor: car.color }} />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Paintbrush className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-400">Team Color:</span>
                          <div className="w-4 h-4 rounded border border-slate-600" style={{ backgroundColor: carTeamColor }} />
                          <span className="text-white text-xs font-mono">{carTeamColor}</span>
                        </div>
                        {car.notes && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                            <p className="text-slate-300 text-xs">{car.notes}</p>
                          </div>
                        )}
                        {car.userId && (
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-500 text-xs">ID: {car.id.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Select Button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => setSelectedCarId(isSelected ? null : car.id)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-all border ${
                        isSelected
                          ? 'border-current'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white border-transparent'
                      }`}
                      style={isSelected ? {
                        backgroundColor: `${carTeamColor}33`,
                        color: carTeamColor,
                        borderColor: `${carTeamColor}4D`,
                      } : undefined}
                    >
                      {isSelected ? 'Currently Selected' : 'Select This Car'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Car className="w-5 h-5 text-cyan-400" />
                  {editingId ? 'Edit Car' : 'Add New Car'}
                </h3>
                <button
                  onClick={() => { setShowForm(false); setFormError(null); }}
                  className="text-slate-400 hover:text-white"
                  disabled={isSaving}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Error Banner */}
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-medium">Save Failed</p>
                    <p className="text-red-400/80 text-xs mt-0.5">{formError}</p>
                  </div>
                  <button
                    onClick={() => setFormError(null)}
                    className="ml-auto text-red-400/60 hover:text-red-300 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Car Number & Nickname */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Car Number</label>
                  <input
                    type="text"
                    value={form.carNumber}
                    onChange={e => setForm({ ...form, carNumber: e.target.value })}
                    placeholder="e.g., 777"
                    disabled={isSaving}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    placeholder="e.g., Nitro Express"
                    disabled={isSaving}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Class */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Class</label>
                <select
                  value={form.class}
                  onChange={e => setForm({ ...form, class: e.target.value })}
                  disabled={isSaving}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select class...</option>
                  {carClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Year / Make / Model */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Year</label>
                  <input
                    type="number"
                    value={form.year || ''}
                    onChange={e => setForm({ ...form, year: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="2024"
                    disabled={isSaving}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Make</label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={e => setForm({ ...form, make: e.target.value })}
                    placeholder="Chevrolet"
                    disabled={isSaving}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="Camaro"
                    disabled={isSaving}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Paint Color */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Paint Color</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    placeholder="e.g., Red, #FF0000"
                    disabled={isSaving}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                  <input
                    type="color"
                    value={form.color && form.color.startsWith('#') ? form.color : '#3b82f6'}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    disabled={isSaving}
                    className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-slate-900 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* ========== TEAM COLOR SECTION ========== */}
              <div className="pt-2 border-t border-slate-700/50">
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <Paintbrush className="w-4 h-4" style={{ color: teamColorValue }} />
                  Team Color
                  <span className="text-xs text-slate-500 font-normal">(changes app accent when this car is selected)</span>
                </label>
                <div className="space-y-3">
                  {/* Color preview + picker */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-slate-600 flex-shrink-0 shadow-lg"
                      style={{
                        backgroundColor: teamColorValue,
                        boxShadow: `0 4px 14px ${teamColorValue}40`,
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={teamColorValue}
                          onChange={e => {
                            const val = e.target.value;
                            if (/^#[0-9a-fA-F]{0,6}$/.test(val) || val === '') {
                              setTeamColorValue(val || '#');
                            }
                          }}
                          placeholder="#ef4444"
                          disabled={isSaving}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                        />
                        <input
                          type="color"
                          value={teamColorValue}
                          onChange={e => setTeamColorValue(e.target.value)}
                          disabled={isSaving}
                          className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-slate-900 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset color swatches */}
                  <div>
                    <p className="text-[11px] text-slate-500 mb-1.5">Quick pick:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TEAM_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTeamColorValue(color)}
                          disabled={isSaving}
                          className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 disabled:opacity-50 ${
                            teamColorValue === color
                              ? 'border-white scale-110 shadow-lg'
                              : 'border-slate-600 hover:border-slate-400'
                          }`}
                          style={{
                            backgroundColor: color,
                            boxShadow: teamColorValue === color ? `0 0 10px ${color}80` : undefined,
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview bar */}
                  <div
                    className="rounded-lg p-3 border"
                    style={{
                      backgroundColor: `${teamColorValue}15`,
                      borderColor: `${teamColorValue}40`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: teamColorValue }}
                      />
                      <span className="text-xs" style={{ color: teamColorValue }}>
                        Preview: This is how accent elements will look
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="carIsActive"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  disabled={isSaving}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="carIsActive" className="text-slate-300">Active (available for racing)</label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this car..."
                  disabled={isSaving}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none disabled:opacity-50"
                />
              </div>

              {/* Debug Info (only shown when there's an error) */}
              {formError && (
                <div className="text-xs text-slate-600 border-t border-slate-700/50 pt-3">
                  <p>Debug: user.id = {user?.id || 'null'} | isDemoMode = {String(isDemoMode)} | isAuthenticated = {String(isAuthenticated)}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setFormError(null); }}
                disabled={isSaving}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWithTeamColor}
                disabled={isSaving || (!form.nickname && !form.carNumber && !form.make)}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] justify-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update Car' : 'Add Car'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CarProfiles;
