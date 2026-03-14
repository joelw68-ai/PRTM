import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';

import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCar } from '@/contexts/CarContext';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { BorrowedLoanedPartRowSchema } from '@/lib/validators';
import {

  Gauge, AlertTriangle, Clock, Zap, Wind, TrendingUp, Calendar, Wrench,
  Shield, RefreshCw, Camera, Edit2, Package, ArrowLeftRight,
  Bell, ArrowDownToLine, ArrowUpFromLine, Cog, Car, FileText,
  SlidersHorizontal, ChevronRight, BarChart3, MapPin, Building2
} from 'lucide-react';


import {
  PassLogEntry,
  Engine,
  Supercharger,
  MaintenanceItem,
  SFICertification,
  WorkOrder,
} from '@/data/proModData';
import { PartInventoryItem } from '@/data/partsInventory';
import { VendorRecord, DrivetrainComponent } from '@/lib/database';
import { RaceEvent } from '@/components/race/RaceCalendar';

import ImageEditor from './ImageEditor';
import OnboardingProgressBar from './OnboardingProgressBar';
import EmptyState from './EmptyState';
import WeatherWidget from './WeatherWidget';
import * as db from '@/lib/database';


interface DashboardProps {
  onNavigate: (section: string) => void;
  onOpenReorderList?: () => void;
}
const DEFAULT_CAR_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/697973e8e2220874110e4962_1769569697841_001ae990.jpg';

const CAR_IMAGE_STORAGE_KEY = 'promod_car_image_url';
const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenReorderList
}) => {
  const {
    engines,
    superchargers,
    passLogs,
    maintenanceItems,
    sfiCertifications,
    workOrders,
    partsInventory,
    drivetrainComponents,
    raceEvents,
    savedTracks,
    vendors,
    getActiveEngine,
    getActiveSupercharger,
    performEngineSwap,
    isLoading
  } = useApp();


  const { selectedCarId, cars, getCarLabel } = useCar();
  const { user, isDemoMode, effectiveUserId } = useAuth();


  // ─── DEBUG: Log raw data counts from AppContext ─────────────
  useEffect(() => {
    console.log('[Dashboard] Raw data from AppContext:', {
      engines: engines.length,
      superchargers: superchargers.length,
      passLogs: passLogs.length,
      maintenanceItems: maintenanceItems.length,
      sfiCertifications: sfiCertifications.length,
      workOrders: workOrders.length,
      partsInventory: partsInventory.length,
      drivetrainComponents: drivetrainComponents.length,
      raceEvents: raceEvents.length,
      savedTracks: savedTracks.length,
      vendors: vendors.length,
      selectedCarId,
      carsCount: cars.length,
    });
  }, [engines, superchargers, passLogs, maintenanceItems, sfiCertifications, workOrders, partsInventory, drivetrainComponents, raceEvents, savedTracks, vendors, selectedCarId, cars]);

  // ─── Car-Filtered Data ─────────────────────────────────────
  const isEmptyCarId = (id: string | null | undefined): boolean => !id || id === '';

  const carPassLogs = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? passLogs.filter((p: PassLogEntry) => p.car_id === selectedCarId || isEmptyCarId(p.car_id)) : passLogs,
    [passLogs, selectedCarId]
  );
  const carMaintenanceItems = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? maintenanceItems.filter((m: MaintenanceItem) => m.car_id === selectedCarId || isEmptyCarId(m.car_id)) : maintenanceItems,
    [maintenanceItems, selectedCarId]
  );
  const carWorkOrders = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? workOrders.filter((w: WorkOrder) => w.car_id === selectedCarId || isEmptyCarId(w.car_id)) : workOrders,
    [workOrders, selectedCarId]
  );
  const carEngines = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? engines.filter((e: Engine) => e.car_id === selectedCarId || isEmptyCarId(e.car_id)) : engines,
    [engines, selectedCarId]
  );
  const carSuperchargers = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? superchargers.filter((s: Supercharger) => s.car_id === selectedCarId || isEmptyCarId(s.car_id)) : superchargers,
    [superchargers, selectedCarId]
  );
  const carDrivetrainComponents = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? drivetrainComponents.filter((c: DrivetrainComponent) => c.car_id === selectedCarId || isEmptyCarId(c.car_id)) : drivetrainComponents,
    [drivetrainComponents, selectedCarId]
  );
  const carSfiCertifications = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? sfiCertifications.filter((c: SFICertification) => c.car_id === selectedCarId || isEmptyCarId(c.car_id)) : sfiCertifications,
    [sfiCertifications, selectedCarId]
  );
  const carPartsInventory = useMemo(() =>
    (selectedCarId && selectedCarId !== '') ? partsInventory.filter((p: PartInventoryItem) => p.car_id === selectedCarId || isEmptyCarId(p.car_id)) : partsInventory,
    [partsInventory, selectedCarId]
  );

  // Vendors from AppContext (filtered to active only)
  const activeVendors = useMemo(() => vendors.filter((v: VendorRecord) => v.isActive), [vendors]);


  // ─── DEBUG: Log filtered data counts ─────────────────────
  useEffect(() => {
    console.log('[Dashboard] Filtered data (car:', selectedCarId || 'ALL', '):', {
      carEngines: carEngines.length,
      carSuperchargers: carSuperchargers.length,
      carDrivetrainComponents: carDrivetrainComponents.length,
      carPartsInventory: carPartsInventory.length,
      activeVendors: activeVendors.length,
      carPassLogs: carPassLogs.length,
      carMaintenanceItems: carMaintenanceItems.length,
      carWorkOrders: carWorkOrders.length,
      carSfiCertifications: carSfiCertifications.length,
    });
  }, [carEngines, carSuperchargers, carDrivetrainComponents, carPartsInventory, activeVendors, carPassLogs, carMaintenanceItems, carWorkOrders, carSfiCertifications, selectedCarId]);




  const [showEngineSwapModal, setShowEngineSwapModal] = useState(false);
  const [swapEngineId, setSwapEngineId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapPerformedBy, setSwapPerformedBy] = useState('');
  const [swapNotes, setSwapNotes] = useState('');

  // Car image state
  const [carImageUrl, setCarImageUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(CAR_IMAGE_STORAGE_KEY);
      return saved || DEFAULT_CAR_IMAGE;
    } catch {
      return DEFAULT_CAR_IMAGE;
    }
  });
  const [showImageEditor, setShowImageEditor] = useState(false);

  // ─── Borrowed / Loaned Parts Alerts ────────────────────────────
  interface BLPart {
    id: string;
    transaction_type: 'borrowed' | 'loaned';
    part_name: string;
    person_name: string;
    expected_return_date: string | null;
    status: string;
  }
  const [borrowedLoanedParts, setBorrowedLoanedParts] = useState<BLPart[]>([]);

  useEffect(() => {
    const uid = effectiveUserId || user?.id;
    if (!uid || isDemoMode) return;
    const loadBL = async () => {
      try {
        const { data } = await supabase
          .from('borrowed_loaned_parts')
          .select('id, transaction_type, part_name, person_name, expected_return_date, status')
          .eq('user_id', uid)
          .neq('status', 'returned');
        setBorrowedLoanedParts(parseRows(data, BorrowedLoanedPartRowSchema, 'borrowed_loaned_parts') as BLPart[]);

      } catch { /* silent */ }
    };
    loadBL();
  }, [effectiveUserId, user?.id, isDemoMode]);

  const todayStr = getLocalDateString();



  const blOverdueItems = useMemo(() =>
    borrowedLoanedParts.filter(p => p.expected_return_date && p.expected_return_date < todayStr),
    [borrowedLoanedParts, todayStr]
  );

  const blDueSoonItems = useMemo(() =>
    borrowedLoanedParts.filter(p => {
      if (!p.expected_return_date) return false;
      if (p.expected_return_date < todayStr) return false;
      const dueDate = parseLocalDate(p.expected_return_date);
      const todayDate = parseLocalDate(todayStr);

      const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    }),
    [borrowedLoanedParts, todayStr]
  );

  const blHasAlerts = blOverdueItems.length > 0 || blDueSoonItems.length > 0;

  // On mount, also try to load from Supabase user_settings
  useEffect(() => {
    const loadCloudImage = async () => {
      if (!user?.id) return;
      try {
        const settings = await db.fetchUserSettings('dashboard', user.id);
        if (settings?.carImageUrl && settings.carImageUrl !== carImageUrl) {
          setCarImageUrl(settings.carImageUrl);
          try { localStorage.setItem(CAR_IMAGE_STORAGE_KEY, settings.carImageUrl); } catch {}
        }
      } catch (e) {
        console.debug('Could not load car image from cloud settings:', e);
      }
    };
    loadCloudImage();
  }, [user?.id]);

  const activeEngine = getActiveEngine();
  const activeSupercharger = getActiveSupercharger();
  const latestPass = carPassLogs[0];

  // Calculate alerts
  const expiredCerts = carSfiCertifications.filter(c => c.daysUntilExpiration <= 0);
  const expiringSoonCerts = carSfiCertifications.filter(c => c.daysUntilExpiration > 0 && c.daysUntilExpiration <= 60);
  const dueMaintenance = carMaintenanceItems.filter(m => m.status === 'Due' || m.status === 'Due Soon' || m.status === 'Overdue');
  const criticalWorkOrders = carWorkOrders.filter(w => w.priority === 'Critical' && w.status !== 'Completed');
  const openWorkOrders = carWorkOrders.filter(w => w.status !== 'Completed' && w.status !== 'Cancelled');
  const availableEngines = carEngines.filter(e => !e.currentlyInstalled && e.status === 'Ready');
  const lowStockParts = carPartsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock');

  // Upcoming race events — use local date (not UTC) to match todayStr
  const upcomingEvents = useMemo(() => {
    return (raceEvents || [])
      .filter((e: RaceEvent) => e.startDate >= todayStr && e.status !== 'Cancelled')
      .sort((a: RaceEvent, b: RaceEvent) => a.startDate.localeCompare(b.startDate))
      .slice(0, 4);
  }, [raceEvents, todayStr]);




  // Analytics summary data
  const analyticsSummary = useMemo(() => {
    if (carPassLogs.length === 0) return null;
    const sorted = [...carPassLogs].sort((a, b) => {
      const dateA = a.date + (a.time || '');
      const dateB = b.date + (b.time || '');
      return dateB.localeCompare(dateA);
    });
    const recent5 = sorted.slice(0, 5);
    const avgET = recent5.reduce((sum, p) => sum + p.eighth, 0) / recent5.length;
    const avgMPH = recent5.reduce((sum, p) => sum + p.mph, 0) / recent5.length;
    const avg60 = recent5.reduce((sum, p) => sum + p.sixtyFoot, 0) / recent5.length;
    const bestET = Math.min(...carPassLogs.map(p => p.eighth));
    const bestMPH = Math.max(...carPassLogs.map(p => p.mph));
    const wins = carPassLogs.filter(p => p.result === 'Win').length;
    const losses = carPassLogs.filter(p => p.result === 'Loss').length;
    return { avgET, avgMPH, avg60, bestET, bestMPH, wins, losses, totalPasses: carPassLogs.length, recent5Count: recent5.length };
  }, [carPassLogs]);

  const handleEngineSwap = async () => {
    if (activeEngine && swapEngineId && swapReason && swapPerformedBy) {
      await performEngineSwap(activeEngine.id, swapEngineId, swapReason, swapPerformedBy, swapNotes);
      setShowEngineSwapModal(false);
      setSwapEngineId('');
      setSwapReason('');
      setSwapPerformedBy('');
      setSwapNotes('');
    }
  };

  const handleImageSave = (newImageUrl: string) => {
    setCarImageUrl(newImageUrl);
    try {
      localStorage.setItem(CAR_IMAGE_STORAGE_KEY, newImageUrl);
    } catch (e) {
      console.error('Error saving car image to localStorage:', e);
    }
    if (user?.id && !newImageUrl.startsWith('data:')) {
      db.upsertUserSettings('dashboard', { carImageUrl: newImageUrl }, user.id)
        .catch(e => console.debug('Could not save car image to cloud settings:', e));
    }
  };

  // ─── Section Header helper ───
  const SectionHeader = ({ icon: Icon, title, iconColor, navTarget, count }: { icon: React.ElementType; title: string; iconColor: string; navTarget?: string; count?: number }) => (

    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">{count}</span>
        )}
      </h2>
      {navTarget && (
        <button onClick={() => onNavigate(navTarget)} className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors">
          View All <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return <section className="py-8 px-4 from-cyan-400 to-blue-500 text-lg text-black bg-gray-500 bg-cover bg-center">
      <div className="max-w-[1920px] mx-auto">
        {/* Hero Banner with Editable Image */}
        <div className="relative rounded-2xl overflow-hidden mb-8 group h-64 md:h-80">
          <img key={carImageUrl} src={carImageUrl} alt="Pro Mod Drag Racing" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/70 to-transparent" />
          <div className="absolute inset-0 flex items-center p-8">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-2 text-white">Professional Race Team Management</h1>
              <p className="text-xl text-orange-400 font-semibold mb-1"></p>
              <p className="text-slate-300">1/8 Mile Professional Drag Racing </p>
            </div>
          </div>
          <button onClick={() => setShowImageEditor(true)} className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 backdrop-blur-sm text-white rounded-lg font-medium hover:bg-orange-500 transition-all shadow-lg border border-slate-700/50 hover:border-orange-400">
            <Edit2 className="w-4 h-4" />
            <span className="hidden sm:inline">Change Photo</span>
            <Camera className="w-4 h-4 sm:hidden" />
          </button>
        </div>

        {/* Onboarding Progress Bar */}
        <OnboardingProgressBar onNavigate={onNavigate} />

        {/* Critical Alert Banner */}
        {(expiredCerts.length > 0 || criticalWorkOrders.length > 0) && <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-400">Critical Alerts</h3>
                <div className="text-sm text-red-300 mt-1">
                  {expiredCerts.map(cert => <p key={cert.id} data-mixed-content="true">• {cert.item} - SFI EXPIRED</p>)}
                  {criticalWorkOrders.map(wo => <p key={wo.id} data-mixed-content="true">• {wo.title} - CRITICAL WORK ORDER</p>)}
                </div>
              </div>
              <button onClick={() => onNavigate('maintenance')} className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors">
                View All
              </button>
            </div>
          </div>}

        {/* Car Indicator */}
        {cars.length > 1 && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <Car className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-slate-400">
              Showing data for: <span className="text-orange-400 font-semibold">{getCarLabel(selectedCarId)}</span>
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SECTION 1: QUICK STATS
        ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Gauge className="w-4 h-4" />
              Total Passes
            </div>
            <p className="text-2xl font-bold text-white">{carPassLogs.length}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Best ET
            </div>
            <p className="text-2xl font-bold text-green-400">
              {carPassLogs.length > 0 ? Math.min(...carPassLogs.map(p => p.eighth)).toFixed(3) : '-.---'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Zap className="w-4 h-4" />
              Best MPH
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {carPassLogs.length > 0 ? Math.max(...carPassLogs.map(p => p.mph)).toFixed(1) : '---.-'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Best 60'
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {carPassLogs.length > 0 ? Math.min(...carPassLogs.map(p => p.sixtyFoot)).toFixed(3) : '-.---'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Wrench className="w-4 h-4" />
              Maintenance Due
            </div>
            <p className={`text-2xl font-bold ${dueMaintenance.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {dueMaintenance.length}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Shield className="w-4 h-4" />
              SFI Alerts
            </div>
            <p className={`text-2xl font-bold ${expiredCerts.length > 0 ? 'text-red-400' : expiringSoonCerts.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {expiredCerts.length + expiringSoonCerts.length}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 2: PASS LOG SUMMARY
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={Gauge} title="Pass Log" iconColor="text-green-400" navTarget="passlog" count={carPassLogs.length} />
          {latestPass ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">Latest Pass</h3>
                <span className="text-sm text-slate-500" data-mixed-content="true">{latestPass.date} @ {latestPass.time}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">60'</p>
                  <p className="text-xl font-bold text-white">{latestPass.sixtyFoot.toFixed(3)}</p>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">330'</p>
                  <p className="text-xl font-bold text-white">{latestPass.threeThirty.toFixed(3)}</p>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">1/8 ET</p>
                  <p className="text-xl font-bold text-green-400">{latestPass.eighth.toFixed(3)}</p>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">MPH</p>
                  <p className="text-xl font-bold text-blue-400">{latestPass.mph.toFixed(1)}</p>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">RT</p>
                  <p className="text-xl font-bold text-purple-400">{latestPass.reactionTime.toFixed(3)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{latestPass.track}</span>
                <span className={`px-2 py-1 rounded font-medium ${latestPass.result === 'Win' ? 'bg-green-500/20 text-green-400' : latestPass.result === 'Loss' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {latestPass.result}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState section="passlog" onAction={() => onNavigate('passlog')} compact />
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 3: RACE CALENDAR UPCOMING EVENTS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={Calendar} title="Upcoming Events" iconColor="text-cyan-400" navTarget="calendar" count={upcomingEvents.length} />
          {upcomingEvents.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {upcomingEvents.map((event: RaceEvent) => {

                const eventDate = event.startDate || '';
                const daysUntil = eventDate ? Math.ceil((parseLocalDate(eventDate).getTime() - parseLocalDate(todayStr).getTime()) / (1000 * 60 * 60 * 24)) : null;

                return (
                  <div key={event.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 hover:border-cyan-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-medium text-sm truncate flex-1">{event.title || 'Race Event'}</h4>
                      {daysUntil !== null && daysUntil >= 0 && (
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                          daysUntil <= 3 ? 'bg-orange-500/20 text-orange-400' :
                          daysUntil <= 7 ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs">{eventDate}</p>
                    {(event.trackName || event.trackLocation) && (
                      <p className="text-slate-500 text-xs mt-1 truncate">{event.trackName}{event.trackLocation ? `, ${event.trackLocation}` : ''}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No upcoming events scheduled</p>
              <button onClick={() => onNavigate('calendar')} className="mt-2 text-sm text-orange-400 hover:text-orange-300">
                Add events in Race Calendar →
              </button>
            </div>
          )}
        </div>


        {/* ═══════════════════════════════════════════════════════════
            SECTION 4: ANALYTICS SUMMARY
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={BarChart3} title="Analytics Summary" iconColor="text-indigo-400" navTarget="analytics" />
          {analyticsSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Avg ET (Last {analyticsSummary.recent5Count})</p>
                <p className="text-lg font-bold text-green-400">{analyticsSummary.avgET.toFixed(3)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Avg MPH (Last {analyticsSummary.recent5Count})</p>
                <p className="text-lg font-bold text-blue-400">{analyticsSummary.avgMPH.toFixed(1)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Avg 60' (Last {analyticsSummary.recent5Count})</p>
                <p className="text-lg font-bold text-purple-400">{analyticsSummary.avg60.toFixed(3)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Best ET (All Time)</p>
                <p className="text-lg font-bold text-green-300">{analyticsSummary.bestET.toFixed(3)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Best MPH (All Time)</p>
                <p className="text-lg font-bold text-blue-300">{analyticsSummary.bestMPH.toFixed(1)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Wins</p>
                <p className="text-lg font-bold text-emerald-400">{analyticsSummary.wins}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">Losses</p>
                <p className="text-lg font-bold text-red-400">{analyticsSummary.losses}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No pass data available for analytics</p>
              <button onClick={() => onNavigate('passlog')} className="mt-2 text-sm text-orange-400 hover:text-orange-300">
                Log passes to see analytics →
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 5: MAINTENANCE — Upcoming & Alerts
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={Wrench} title="Maintenance" iconColor="text-yellow-400" navTarget="maintenance" count={dueMaintenance.length} />
          {dueMaintenance.length === 0 && carMaintenanceItems.length === 0 ? (
            <EmptyState section="maintenance" onAction={() => onNavigate('maintenance')} compact />
          ) : dueMaintenance.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-green-400 font-medium">All caught up!</p>
              <p className="text-slate-500 text-sm">No maintenance items are due</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dueMaintenance.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-200 text-sm font-medium block truncate">{item.component}</span>
                    {item.lastServiceDate && (
                      <span className="text-slate-500 text-xs">Last: {item.lastServiceDate}</span>
                    )}
                  </div>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    item.status === 'Overdue' ? 'bg-red-500/20 text-red-400' :
                    item.status === 'Due' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
              {dueMaintenance.length > 6 && (
                <div className="flex items-center justify-center p-3 bg-slate-900/30 rounded-lg border border-dashed border-slate-700/50">
                  <button onClick={() => onNavigate('maintenance')} className="text-sm text-orange-400 hover:text-orange-300">
                    +{dueMaintenance.length - 6} more items →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 6: MAIN COMPONENTS — Engines, Power Adder, Drivetrain
        ═══════════════════════════════════════════════════════════ */}

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 px-6 py-4 border-b border-slate-700/50">
            <SectionHeader icon={Cog} title="Main Components" iconColor="text-orange-400" navTarget="engines" />
          </div>
          <div className="p-6 space-y-6">
            {/* Active Engine */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  Current Engine
                </h3>
                <button onClick={() => setShowEngineSwapModal(true)} disabled={availableEngines.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Quick Swap
                </button>
              </div>
              {activeEngine ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">{activeEngine.name}</h4>
                    <p className="text-slate-400 text-sm mb-3" data-mixed-content="true">S/N: {activeEngine.serialNumber}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Total Passes</span><span className="text-white font-medium">{activeEngine.totalPasses}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Since Rebuild</span><span className="text-white font-medium">{activeEngine.passesSinceRebuild}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Install Date</span><span className="text-white font-medium">{activeEngine.installDate}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Builder</span><span className="text-white font-medium">{activeEngine.builder}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Component Status</h4>
                    <div className="space-y-2">
                      {Object.entries(activeEngine.components).slice(0, 6).map(([key, comp]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{comp.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            comp.status === 'Good' ? 'bg-green-500/20 text-green-400' :
                            comp.status === 'Inspect' ? 'bg-blue-500/20 text-blue-400' :
                            comp.status === 'Service' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {comp.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : engines.length === 0 ? (
                <EmptyState section="engines" onAction={() => onNavigate('engines')} compact />
              ) : (
                <p className="text-slate-400 text-sm">No engine currently installed. Go to <button onClick={() => onNavigate('engines')} className="text-orange-400 hover:text-orange-300 underline">Main Components</button> to install one.</p>
              )}
            </div>

            {/* Engine Inventory */}
            {carEngines.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Engine Inventory ({carEngines.length})</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {carEngines.map(engine => (
                    <div key={engine.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium text-sm">{engine.name}</p>
                        <p className="text-slate-400 text-xs" data-mixed-content="true">{engine.totalPasses} passes</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        engine.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                        engine.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' :
                        engine.status === 'Rebuild' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {engine.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Power Adder */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-blue-400" />
                Active Power Adder
              </h3>
              {activeSupercharger ? (
                <div className="grid md:grid-cols-4 gap-4">
                  <div><p className="text-slate-400 text-xs">Unit</p><p className="text-white font-medium text-sm">{activeSupercharger.name}</p></div>
                  <div><p className="text-slate-400 text-xs">Model</p><p className="text-white font-medium text-sm">{activeSupercharger.model}</p></div>
                  <div><p className="text-slate-400 text-xs">Total Passes</p><p className="text-white font-medium text-sm">{activeSupercharger.totalPasses}</p></div>
                  <div><p className="text-slate-400 text-xs">Since Service</p><p className={`font-medium text-sm ${activeSupercharger.passesSinceService > 75 ? 'text-yellow-400' : 'text-white'}`}>{activeSupercharger.passesSinceService}</p></div>
                </div>
              ) : <p className="text-slate-400 text-sm">No power adder currently installed</p>}
            </div>

            {/* Power Adder Inventory */}
            {carSuperchargers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Power Adder Inventory ({carSuperchargers.length})</h3>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {carSuperchargers.map(sc => (
                    <div key={sc.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium text-sm">{sc.name}</p>
                        <p className="text-slate-400 text-xs" data-mixed-content="true">{sc.totalPasses} passes</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        sc.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                        sc.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' :
                        sc.status === 'Service' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {sc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drivetrain Components */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Cog className="w-4 h-4 text-cyan-400" />
                Drivetrain Components
              </h3>
              {carDrivetrainComponents.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-slate-400 text-sm">No drivetrain components added yet</p>
                  <button onClick={() => onNavigate('engines')} className="mt-1 text-sm text-orange-400 hover:text-orange-300">
                    Add components in Main Components →
                  </button>
                </div>
              ) : (
                <>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Transmissions', cat: 'transmission' },
                      { label: 'Trans Drives', cat: 'transmission_drive' },
                      { label: 'Torque Converters', cat: 'torque_converter' },
                      { label: '3rd Member & Rear Gear', cat: 'third_member_rear_gear' },
                    ].map(({ label, cat }) => {
                      const count = cat === 'third_member_rear_gear'
                        ? carDrivetrainComponents.filter(c => c.category === 'third_member' || c.category === 'ring_and_pinion').length
                        : carDrivetrainComponents.filter(c => c.category === cat).length;
                      const installed = cat === 'third_member_rear_gear'
                        ? carDrivetrainComponents.filter(c => (c.category === 'third_member' || c.category === 'ring_and_pinion') && c.currentlyInstalled).length
                        : carDrivetrainComponents.filter(c => c.category === cat && c.currentlyInstalled).length;
                      if (count === 0) return null;
                      return (
                        <div key={cat} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-xs text-slate-400">{label}</span>
                          <div className="flex items-center gap-1.5">
                            {installed > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Installed" />}
                            <span className="text-sm font-bold text-white">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>



                  {carDrivetrainComponents.filter(c => c.currentlyInstalled).length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Currently Installed</h4>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {carDrivetrainComponents.filter(c => c.currentlyInstalled).map(comp => {
                          const catLabels: Record<string, string> = {
                            transmission: 'Transmission', transmission_drive: 'Trans Drive',
                            torque_converter: 'Torque Converter', third_member: '3rd Member', ring_and_pinion: 'Ring & Pinion'
                          };
                          return (
                            <div key={comp.id} className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg">
                              <div>
                                <p className="text-white font-medium text-sm">{comp.name}</p>
                                <p className="text-slate-500 text-xs">{catLabels[comp.category] || comp.category}{comp.totalPasses > 0 ? ` · ${comp.totalPasses} passes` : ''}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                comp.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                                comp.status === 'Ready' ? 'bg-blue-500/20 text-blue-400' :
                                comp.status === 'Service' ? 'bg-yellow-500/20 text-yellow-400' :
                                comp.status === 'Rebuild' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {comp.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {carDrivetrainComponents.filter(c => c.status === 'Service' || c.status === 'Rebuild').length > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                      <p className="text-xs text-yellow-400 font-medium">
                        {carDrivetrainComponents.filter(c => c.status === 'Service' || c.status === 'Rebuild').length} component{carDrivetrainComponents.filter(c => c.status === 'Service' || c.status === 'Rebuild').length !== 1 ? 's' : ''} need service/rebuild
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 7: SETUP LIBRARY SUMMARY (with Saved Tracks & Vendors)
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={SlidersHorizontal} title="Setup Library" iconColor="text-teal-400" navTarget="engines" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('engines')}>
              <Zap className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Engines</p>
              <p className="text-slate-400 text-xs mt-1">{carEngines.length} total</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('engines')}>
              <Wind className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Power Adders</p>
              <p className="text-slate-400 text-xs mt-1">{carSuperchargers.length} total</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('engines')}>
              <Cog className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Drivetrain</p>
              <p className="text-slate-400 text-xs mt-1">{carDrivetrainComponents.length} total</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('parts')}>
              <Package className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Parts</p>
              <p className="text-slate-400 text-xs mt-1">{carPartsInventory.length} total</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('passlog')}>
              <MapPin className="w-6 h-6 text-rose-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Saved Tracks</p>
              <p className="text-slate-400 text-xs mt-1">{savedTracks.length} total</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30 hover:border-teal-500/30 transition-colors cursor-pointer" onClick={() => onNavigate('vendors')}>
              <Building2 className="w-6 h-6 text-violet-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">Vendors</p>
              <p className="text-slate-400 text-xs mt-1">{activeVendors.length} active</p>

            </div>
          </div>
        </div>


        {/* ═══════════════════════════════════════════════════════════
            SECTION 8: WORK ORDERS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={FileText} title="Work Orders" iconColor="text-amber-400" navTarget="workorders" count={openWorkOrders.length} />
          {carWorkOrders.length === 0 ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No work orders created yet</p>
              <button onClick={() => onNavigate('workorders')} className="mt-2 text-sm text-orange-400 hover:text-orange-300">
                Create a work order →
              </button>
            </div>
          ) : openWorkOrders.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-green-400 font-medium">All work orders completed!</p>
              <p className="text-slate-500 text-sm">{carWorkOrders.length} total work orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openWorkOrders.slice(0, 5).map(wo => (
                <div key={wo.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{wo.title}</p>
                    <p className="text-slate-500 text-xs">{wo.status} · Assigned: {wo.assignedTo || 'Unassigned'}</p>
                  </div>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    wo.priority === 'Critical' ? 'bg-red-500/20 text-red-400' :
                    wo.priority === 'High' ? 'bg-orange-500/20 text-orange-400' :
                    wo.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {wo.priority}
                  </span>
                </div>
              ))}
              {openWorkOrders.length > 5 && (
                <button onClick={() => onNavigate('workorders')} className="w-full text-center py-2 text-sm text-orange-400 hover:text-orange-300">
                  +{openWorkOrders.length - 5} more open work orders →
                </button>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 9: PARTS INVENTORY & LOW STOCK ALERTS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={Package} title="Parts Inventory" iconColor="text-emerald-400" navTarget="parts" count={carPartsInventory.length} />
          {carPartsInventory.length === 0 ? (
            <div className="text-center py-4">
              <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No parts in inventory</p>
              <button onClick={() => onNavigate('parts')} className="mt-2 text-sm text-orange-400 hover:text-orange-300">
                Add parts →
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">Total Parts</p>
                  <p className="text-lg font-bold text-white">{carPartsInventory.length}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">In Stock</p>
                  <p className="text-lg font-bold text-green-400">{carPartsInventory.filter(p => p.status === 'In Stock').length}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">Low Stock</p>
                  <p className={`text-lg font-bold ${lowStockParts.filter(p => p.status === 'Low Stock').length > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {lowStockParts.filter(p => p.status === 'Low Stock').length}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">Out of Stock</p>
                  <p className={`text-lg font-bold ${lowStockParts.filter(p => p.status === 'Out of Stock').length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {lowStockParts.filter(p => p.status === 'Out of Stock').length}
                  </p>
                </div>
              </div>

              {lowStockParts.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <h4 className="text-sm font-semibold text-yellow-400">Low Stock Alerts ({lowStockParts.length})</h4>
                    {onOpenReorderList && (
                      <button onClick={onOpenReorderList} className="ml-auto text-xs text-orange-400 hover:text-orange-300 font-medium">
                        Generate Reorder List
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {lowStockParts.slice(0, 5).map(part => (
                      <div key={part.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate">{part.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-slate-500 text-xs">{part.onHand}/{part.minQuantity}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            part.status === 'Out of Stock' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {part.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {lowStockParts.length > 5 && (
                      <button onClick={() => onNavigate('parts')} className="text-xs text-orange-400 hover:text-orange-300">
                        +{lowStockParts.length - 5} more →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 10: BORROWED & LOANED PARTS ALERTS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={ArrowLeftRight} title="Borrowed & Loaned Parts" iconColor="text-violet-400" navTarget="borrowedloaned" count={borrowedLoanedParts.length} />
          {borrowedLoanedParts.length === 0 ? (
            <div className="text-center py-4">
              <ArrowLeftRight className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No active borrowed or loaned parts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blOverdueItems.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h4 className="text-sm font-semibold text-red-400">{blOverdueItems.length} Overdue</h4>
                  </div>
                  <div className="space-y-1.5">
                    {blOverdueItems.slice(0, 4).map(item => {
                      const days = item.expected_return_date
                        ? Math.abs(Math.ceil((parseLocalDate(todayStr).getTime() - parseLocalDate(item.expected_return_date).getTime()) / (1000 * 60 * 60 * 24)))

                        : 0;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          {item.transaction_type === 'borrowed' ? (
                            <ArrowDownToLine className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          ) : (
                            <ArrowUpFromLine className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                          <span className="text-red-300 font-medium">{item.part_name}</span>
                          <span className="text-red-400/60">{item.transaction_type === 'borrowed' ? 'from' : 'to'} {item.person_name}</span>
                          <span className="text-red-400 font-semibold ml-auto text-xs">{days}d overdue</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {blDueSoonItems.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-4 h-4 text-yellow-400" />
                    <h4 className="text-sm font-semibold text-yellow-400">{blDueSoonItems.length} Due Within 3 Days</h4>
                  </div>
                  <div className="space-y-1.5">
                    {blDueSoonItems.slice(0, 4).map(item => {
                      const days = item.expected_return_date
                        ? Math.ceil((parseLocalDate(item.expected_return_date).getTime() - parseLocalDate(todayStr).getTime()) / (1000 * 60 * 60 * 24))

                        : 0;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          {item.transaction_type === 'borrowed' ? (
                            <ArrowDownToLine className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                          ) : (
                            <ArrowUpFromLine className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                          )}
                          <span className="text-yellow-300 font-medium">{item.part_name}</span>
                          <span className="text-yellow-400/60">{item.transaction_type === 'borrowed' ? 'from' : 'to'} {item.person_name}</span>
                          <span className="text-yellow-400 font-semibold ml-auto text-xs">
                            {days === 0 ? 'Due today' : `${days}d left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!blHasAlerts && (
                <div className="text-center py-3">
                  <p className="text-green-400 font-medium text-sm">No overdue items</p>
                  <p className="text-slate-500 text-xs">{borrowedLoanedParts.length} active transaction{borrowedLoanedParts.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ═══════════════════════════════════════════════════════════
            SECTION 11: SFI CERTIFICATIONS ALERTS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
          <SectionHeader icon={Shield} title="SFI Certifications" iconColor="text-rose-400" navTarget="maintenance" count={expiredCerts.length + expiringSoonCerts.length} />
          {carSfiCertifications.length === 0 ? (
            <div className="text-center py-4">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No SFI certifications tracked</p>
              <button onClick={() => onNavigate('maintenance')} className="mt-2 text-sm text-orange-400 hover:text-orange-300">
                Add certifications →
              </button>
            </div>
          ) : expiredCerts.length === 0 && expiringSoonCerts.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-green-400 font-medium">All certifications current!</p>
              <p className="text-slate-500 text-sm">{carSfiCertifications.length} certifications tracked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiredCerts.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h4 className="text-sm font-semibold text-red-400">{expiredCerts.length} Expired</h4>
                  </div>
                  <div className="space-y-1.5">
                    {expiredCerts.map(cert => (
                      <div key={cert.id} className="flex items-center justify-between text-sm">
                        <span className="text-red-300 font-medium">{cert.item}</span>
                        <span className="text-red-400 text-xs">SFI {cert.sfiSpec} · Expired {Math.abs(cert.daysUntilExpiration)}d ago</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expiringSoonCerts.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <h4 className="text-sm font-semibold text-yellow-400">{expiringSoonCerts.length} Expiring Soon</h4>
                  </div>
                  <div className="space-y-1.5">
                    {expiringSoonCerts.map(cert => (
                      <div key={cert.id} className="flex items-center justify-between text-sm">
                        <span className="text-yellow-300 font-medium">{cert.item}</span>
                        <span className="text-yellow-400 text-xs">SFI {cert.sfiSpec} · {cert.daysUntilExpiration}d left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 12: WEATHER WIDGET (Sidebar utility)
        ═══════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <WeatherWidget onNavigate={onNavigate} />
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 13: PER-CAR SUMMARY (Bottom, when All Cars selected)
        ═══════════════════════════════════════════════════════════ */}
        {!selectedCarId && cars.length > 1 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-orange-400" />
              Per-Car Summary
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cars.map(car => {
                const cPasses = passLogs.filter((p: PassLogEntry) => p.car_id === car.id);
                const cMaint = maintenanceItems.filter((m: MaintenanceItem) => m.car_id === car.id);
                const cWO = workOrders.filter((w: WorkOrder) => w.car_id === car.id);

                const cDueMaint = cMaint.filter(m => m.status === 'Due' || m.status === 'Due Soon' || m.status === 'Overdue');
                const cCritWO = cWO.filter(w => w.priority === 'Critical' && w.status !== 'Completed');
                const bestET = cPasses.length > 0 ? Math.min(...cPasses.map(p => p.eighth)) : null;
                const bestMPH = cPasses.length > 0 ? Math.max(...cPasses.map(p => p.mph)) : null;
                const carLabel = getCarLabel(car.id);

                return (
                  <div key={car.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 hover:border-orange-500/40 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <Car className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <h3 className="text-white font-semibold truncate">{carLabel}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-slate-500 text-xs">Passes</p>
                        <p className="text-white font-bold">{cPasses.length}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Best ET</p>
                        <p className="text-green-400 font-bold">{bestET ? bestET.toFixed(3) : '-.---'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Best MPH</p>
                        <p className="text-blue-400 font-bold">{bestMPH ? bestMPH.toFixed(1) : '---.-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Work Orders</p>
                        <p className="text-white font-bold">{cWO.length}</p>
                      </div>
                    </div>
                    {(cDueMaint.length > 0 || cCritWO.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                        {cDueMaint.length > 0 && (
                          <p className="text-xs text-yellow-400 flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> {cDueMaint.length} maintenance due
                          </p>
                        )}
                        {cCritWO.length > 0 && (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {cCritWO.length} critical work order{cCritWO.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Engine Swap Modal */}
      {showEngineSwapModal && <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-400" />
              Quick Engine Swap
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Current Engine</label>
                <p className="text-white font-medium">{activeEngine?.name}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Swap To</label>
                <select value={swapEngineId} onChange={e => setSwapEngineId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  <option value="">Select engine...</option>
                  {availableEngines.map(e => <option key={e.id} value={e.id} data-mixed-content="true">
                      {e.name} ({e.passesSinceRebuild} passes since rebuild)
                    </option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason</label>
                <input type="text" value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="e.g., Scheduled rotation, issue found..." className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Performed By</label>
                <input type="text" value={swapPerformedBy} onChange={e => setSwapPerformedBy(e.target.value)} placeholder="Crew member name" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea value={swapNotes} onChange={e => setSwapNotes(e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEngineSwapModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                Cancel
              </button>
              <button onClick={handleEngineSwap} disabled={!swapEngineId || !swapReason || !swapPerformedBy} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Confirm Swap
              </button>
            </div>
          </div>
        </div>}

      {/* Image Editor Modal */}
      <ImageEditor isOpen={showImageEditor} onClose={() => setShowImageEditor(false)} currentImage={carImageUrl} defaultImage={DEFAULT_CAR_IMAGE} onSave={handleImageSave} />
    </section>;
};
export default Dashboard;
