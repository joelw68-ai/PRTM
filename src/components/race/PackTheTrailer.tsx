// ═══════════════════════════════════════════════════════════════════════════
// PackTheTrailer.tsx
//
// Auto-generates a printable/shareable "Load List" for the next upcoming
// Race Calendar event.  Pulls from:
//
//   • raceEvents              — next upcoming event (from AppContext)
//   • maintenanceItems        — items ≥75% of interval → take a spare
//   • sfiCertifications       — harnesses/nets/helmets expiring ≤ 60d
//   • partsInventory          — current on-hand vs. min quantity
//   • borrowed_loaned_parts   — outstanding BORROWED items to return
//   • Aeris weather forecast  — track-temp-driven tire compound picks
//   • User-entered expected pass count × gallons/pass → fuel quantity
//
// Output is a comprehensive checklist that can be:
//   1) Printed or saved as PDF (window.print()) with dedicated print CSS
//   2) Copied to clipboard (text) for pasting into group chats
//   3) Shared to the Team Dashboard via team_activity_feed insert (Realtime)
//
// No new database tables required — everything piggybacks on existing data.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getLocalDateString, parseLocalDate, formatLocalDate } from '@/lib/utils';
import { toast } from 'sonner';
import { CrewRole } from '@/lib/permissions';
import type { RaceEvent } from '@/components/race/RaceCalendar';
import { calculateMaintenanceStatus } from '@/data/proModData';

import {
  Package,
  PackageCheck,
  Printer,
  Share2,
  RefreshCw,
  Cloud,
  Thermometer,
  Wrench,
  Shield,
  ArrowLeftRight,
  Fuel,
  CalendarDays,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  Gauge,
  FileText,
} from 'lucide-react';

// ─── Tire Compound Recommendation Logic ────────────────────────────────────
// Based on typical drag-radial / bias-ply Pro Mod tire temperature windows.
interface TireCompoundRec {
  compound: string;
  sizeExample: string;
  reason: string;
  priority: 'critical' | 'recommended' | 'optional';
}

function recommendTireCompounds(trackTempF: number): TireCompoundRec[] {
  const recs: TireCompoundRec[] = [];

  if (trackTempF < 65) {
    recs.push({
      compound: 'Soft Compound (D6 / D2)',
      sizeExample: '17.0/36.0-16 soft',
      reason: `Cold track (${trackTempF.toFixed(0)}°F) — soft rubber grips better when cold`,
      priority: 'critical',
    });
    recs.push({
      compound: 'Hand Warmers + Tire Heaters',
      sizeExample: '— equipment',
      reason: 'Cold conditions demand pre-heating to operating temp',
      priority: 'recommended',
    });
  } else if (trackTempF < 85) {
    recs.push({
      compound: 'Medium Compound (D4)',
      sizeExample: '17.0/36.0-16 medium',
      reason: `Mild track (${trackTempF.toFixed(0)}°F) — medium sweet spot`,
      priority: 'critical',
    });
    recs.push({
      compound: 'Soft Compound Spare Set',
      sizeExample: '17.0/36.0-16 soft',
      reason: 'Backup if track cools overnight or weather shifts',
      priority: 'recommended',
    });
  } else if (trackTempF < 110) {
    recs.push({
      compound: 'Hard Compound (D2A / M5)',
      sizeExample: '17.0/36.0-16 hard',
      reason: `Hot track (${trackTempF.toFixed(0)}°F) — harder rubber survives heat`,
      priority: 'critical',
    });
    recs.push({
      compound: 'Medium Compound Backup',
      sizeExample: '17.0/36.0-16 medium',
      reason: 'For evening rounds when track cools',
      priority: 'recommended',
    });
  } else {
    recs.push({
      compound: 'Heat-Rated / Extra-Hard Compound',
      sizeExample: '17.0/36.0-16 HR',
      reason: `Extreme track temp (${trackTempF.toFixed(0)}°F) — risk of tire failure on standard compounds`,
      priority: 'critical',
    });
    recs.push({
      compound: 'Hard Compound Backup Set',
      sizeExample: '17.0/36.0-16 hard',
      reason: 'Swap if track temp drops below 110°F',
      priority: 'recommended',
    });
  }

  // Always include fronts + spare
  recs.push({
    compound: 'Front Runners',
    sizeExample: '26.0/4.5-17',
    reason: 'Standard front pair + one spare',
    priority: 'critical',
  });
  recs.push({
    compound: 'Tire Pyrometer + Pressure Gauge',
    sizeExample: '— equipment',
    reason: 'Critical for trackside temp/pressure monitoring',
    priority: 'critical',
  });

  return recs;
}

// ─── Borrowed Part type (matches borrowed_loaned_parts schema) ────────────
interface BorrowedPart {
  id: string;
  transaction_type: 'borrowed' | 'loaned';
  part_name: string;
  part_number: string | null;
  quantity: number;
  person_name: string;
  contact: string | null;
  date_transaction: string;
  expected_return_date: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
}

// ─── SFI item category keywords for filtering to "safety-dated gear" ───────
const SFI_SAFETY_KEYWORDS = [
  'harness', 'seat belt', 'belt', 'window net', 'helmet', 'jacket', 'suit',
  'shoes', 'gloves', 'neck', 'head restraint', 'parachute', 'chute', 'roll cage',
  'shock', 'shoe', 'blanket', 'fire', 'hans', 'device',
];

function isSfiSafetyItem(itemName: string): boolean {
  const lower = itemName.toLowerCase();
  return SFI_SAFETY_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Component ────────────────────────────────────────────────────────────
interface PackTheTrailerProps {
  currentRole?: CrewRole;
  onNavigate?: (section: string) => void;
}

const PackTheTrailer: React.FC<PackTheTrailerProps> = ({ currentRole = 'Crew', onNavigate }) => {
  const { user, isDemoMode, effectiveUserId, profile } = useAuth();
  const {
    raceEvents,
    maintenanceItems,
    sfiCertifications,
    partsInventory,
    savedTracks,
  } = useApp();

  const userId = effectiveUserId || user?.id;

  // ─── Upcoming events list (for picking which event to pack for) ─────────
  const upcomingEvents = useMemo(() => {
    const today = getLocalDateString();
    return raceEvents
      .filter(e => e.startDate >= today && e.status !== 'Cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [raceEvents]);

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const selectedEvent = useMemo<RaceEvent | null>(() => {
    if (!selectedEventId) return upcomingEvents[0] || null;
    return upcomingEvents.find(e => e.id === selectedEventId) || upcomingEvents[0] || null;
  }, [selectedEventId, upcomingEvents]);

  // ─── Forecast state ────────────────────────────────────────────────────
  const [forecastTemp, setForecastTemp] = useState<number | null>(null);
  const [forecastTrackTemp, setForecastTrackTemp] = useState<number | null>(null);
  const [forecastConditions, setForecastConditions] = useState<string>('');
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [manualTrackTemp, setManualTrackTemp] = useState<string>('');

  // ─── Fuel planning inputs ──────────────────────────────────────────────
  const [expectedPasses, setExpectedPasses] = useState<number>(8);
  const [gallonsPerPass, setGallonsPerPass] = useState<number>(2.5);
  const [fuelType, setFuelType] = useState<string>('Methanol');

  // ─── Borrowed parts (outstanding) ──────────────────────────────────────
  const [borrowedParts, setBorrowedParts] = useState<BorrowedPart[]>([]);
  const [borrowedLoading, setBorrowedLoading] = useState(false);

  // ─── UI state ──────────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['tires', 'sparesMaint', 'sfiExpiring', 'fuel', 'borrowed'])
  );
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // ─── Fetch forecast for selected event ─────────────────────────────────
  const fetchForecast = useCallback(async () => {
    if (!selectedEvent) return;
    const loc = selectedEvent.trackZip || selectedEvent.trackLocation || selectedEvent.trackName;
    if (!loc) return;

    setForecastLoading(true);
    setForecastError(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-aeris-weather', {
        body: { location: loc },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const airTemp: number = data?.temperature ?? 0;
      setForecastTemp(airTemp);
      setForecastConditions(data?.conditions || 'Unknown');
      // Estimate track temp as air temp + 15-25°F solar heating (common rule of thumb)
      // For a "pack the trailer" estimate, bias toward the higher end.
      const estimatedTrack = airTemp + 20;
      setForecastTrackTemp(estimatedTrack);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[PackTheTrailer] Forecast fetch failed:', msg);
      setForecastError(msg);
    } finally {
      setForecastLoading(false);
    }
  }, [selectedEvent]);

  // Auto-fetch when event changes
  useEffect(() => {
    if (selectedEvent) fetchForecast();
  }, [selectedEvent?.id]);

  // ─── Fetch outstanding borrowed parts ──────────────────────────────────
  const fetchBorrowed = useCallback(async () => {
    if (!userId || isDemoMode) return;
    setBorrowedLoading(true);
    try {
      const { data, error } = await supabase
        .from('borrowed_loaned_parts')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', 'borrowed')
        .neq('status', 'returned');
      if (error) throw error;
      setBorrowedParts((data || []) as BorrowedPart[]);
    } catch (err) {
      console.warn('[PackTheTrailer] Borrowed parts fetch failed:', err);
    } finally {
      setBorrowedLoading(false);
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    fetchBorrowed();
  }, [fetchBorrowed]);

  // ─── Effective track temp (manual override wins) ───────────────────────
  const effectiveTrackTemp = useMemo(() => {
    const manual = parseFloat(manualTrackTemp);
    if (!isNaN(manual) && manual > 0) return manual;
    return forecastTrackTemp ?? 85; // default fallback
  }, [manualTrackTemp, forecastTrackTemp]);

  // ─── Derived checklist items ────────────────────────────────────────────
  const tireRecs = useMemo(() => recommendTireCompounds(effectiveTrackTemp), [effectiveTrackTemp]);

  // Spare parts: maintenance items approaching service life (≥ 75% used)
  const sparesMaintenance = useMemo(() => {
    return maintenanceItems
      .map(m => {
        const interval = m.passInterval || 1;
        const remaining = m.nextServicePasses - m.currentPasses;
        const used = interval - remaining;
        const pct = Math.max(0, Math.min(100, (used / interval) * 100));
        // Always derive the THRESHOLD-AWARE status so per-item thresholds are
        // the single source of truth (matches the Maintenance Tracker badges).
        const status = calculateMaintenanceStatus(m);
        return { item: { ...m, status }, percentUsed: pct, remaining, status };
      })
      // An item is only flagged for a spare once it is actually alerting:
      //   • Items WITH a per-item threshold: only when status leaves "Good"
      //     (i.e. remaining passes have reached the configured threshold).
      //   • Items WITHOUT a threshold: legacy rule (≥75% of interval used, or
      //     already Due / Due Soon / Overdue).
      .filter(x => {
        const hasThreshold = x.item.threshold != null && x.item.threshold >= 0;
        if (hasThreshold) return x.status !== 'Good';
        return x.percentUsed >= 75 || x.status === 'Due' || x.status === 'Due Soon' || x.status === 'Overdue';
      })
      .sort((a, b) => b.percentUsed - a.percentUsed);
  }, [maintenanceItems]);


  // SFI items expiring within 60 days OR already expired
  const expiringSfi = useMemo(() => {
    return sfiCertifications
      .filter(c => c.daysUntilExpiration <= 60)
      .filter(c => isSfiSafetyItem(c.item))
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }, [sfiCertifications]);

  // Low-stock parts that should be topped up before leaving
  const lowStockParts = useMemo(() => {
    return partsInventory
      .filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock' || p.onHand <= p.minQuantity)
      .sort((a, b) => a.onHand - b.onHand)
      .slice(0, 15);
  }, [partsInventory]);

  // Fuel quantity + small "pad" for warm-ups
  const fuelPlan = useMemo(() => {
    const raw = expectedPasses * gallonsPerPass;
    const warmupPad = Math.max(2, Math.ceil(raw * 0.1));
    return {
      passes: expectedPasses,
      perPass: gallonsPerPass,
      raceGal: raw,
      warmupGal: warmupPad,
      totalGal: raw + warmupPad,
      fuelType,
    };
  }, [expectedPasses, gallonsPerPass, fuelType]);

  // Track info
  const trackElevation = useMemo(() => {
    if (!selectedEvent) return 0;
    const match = savedTracks.find(t =>
      t.name.toLowerCase() === (selectedEvent.trackName || '').toLowerCase()
    );
    return match?.elevation || 0;
  }, [selectedEvent, savedTracks]);

  // ─── Section toggle ─────────────────────────────────────────────────────
  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Build plain-text version for clipboard / share ─────────────────────
  const buildTextChecklist = useCallback((): string => {
    if (!selectedEvent) return '';
    const lines: string[] = [];
    const team = profile?.teamName || 'Race Team';
    lines.push(`═══════════════════════════════════════════════════════`);
    lines.push(`  PACK-THE-TRAILER LOAD LIST — ${team}`);
    lines.push(`═══════════════════════════════════════════════════════`);
    lines.push(`Event:    ${selectedEvent.title}`);
    lines.push(`Track:    ${selectedEvent.trackName}${selectedEvent.trackLocation ? ' — ' + selectedEvent.trackLocation : ''}`);
    lines.push(`Date:     ${formatLocalDate(selectedEvent.startDate)}${selectedEvent.endDate ? ' → ' + formatLocalDate(selectedEvent.endDate) : ''}`);
    if (forecastTemp != null) {
      lines.push(`Forecast: ${forecastTemp.toFixed(0)}°F air / ~${effectiveTrackTemp.toFixed(0)}°F track (${forecastConditions})`);
    } else {
      lines.push(`Forecast: Track temp set to ${effectiveTrackTemp.toFixed(0)}°F (manual)`);
    }
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('■ TIRE COMPOUNDS');
    tireRecs.forEach(r => {
      const mark = r.priority === 'critical' ? '[*]' : r.priority === 'recommended' ? '[+]' : '[ ]';
      lines.push(`  ${mark} ${r.compound} (${r.sizeExample}) — ${r.reason}`);
    });
    lines.push('');

    lines.push('■ SPARE PARTS (approaching service life)');
    if (sparesMaintenance.length === 0) {
      lines.push('  [ ] (none flagged)');
    } else {
      sparesMaintenance.slice(0, 20).forEach(s => {
        lines.push(`  [ ] ${s.item.component} — ${s.item.category} (${s.percentUsed.toFixed(0)}% used, ${s.remaining} passes left) [${s.item.status}]`);
      });
    }
    lines.push('');

    lines.push('■ SFI SAFETY GEAR — EXPIRING / RECERTIFY');
    if (expiringSfi.length === 0) {
      lines.push('  [ ] (none in 60-day window)');
    } else {
      expiringSfi.forEach(c => {
        const status = c.daysUntilExpiration <= 0 ? 'EXPIRED' : `${c.daysUntilExpiration}d left`;
        lines.push(`  [ ] ${c.item} — ${c.sfiSpec} — expires ${c.expirationDate} (${status})`);
      });
    }
    lines.push('');

    lines.push('■ FUEL');
    lines.push(`  [ ] ${fuelPlan.totalGal.toFixed(1)} gallons ${fuelPlan.fuelType}`);
    lines.push(`        (${fuelPlan.passes} passes × ${fuelPlan.perPass} gal/pass = ${fuelPlan.raceGal.toFixed(1)} gal + ${fuelPlan.warmupGal} gal warmup pad)`);
    lines.push('');

    lines.push('■ LOW-STOCK PARTS TO TOP UP');
    if (lowStockParts.length === 0) {
      lines.push('  [ ] (inventory OK)');
    } else {
      lowStockParts.forEach(p => {
        lines.push(`  [ ] ${p.description} (#${p.partNumber}) — on hand ${p.onHand} / min ${p.minQuantity} [${p.status}]`);
      });
    }
    lines.push('');

    lines.push('■ BORROWED PARTS TO RETURN');
    if (borrowedParts.length === 0) {
      lines.push('  [ ] (nothing outstanding)');
    } else {
      borrowedParts.forEach(p => {
        const due = p.expected_return_date ? ` — due ${p.expected_return_date}` : '';
        lines.push(`  [ ] RETURN: ${p.part_name} (qty ${p.quantity}) to ${p.person_name}${due}${p.status === 'overdue' ? ' [OVERDUE]' : ''}`);
      });
    }
    lines.push('');
    lines.push(`═══════════════════════════════════════════════════════`);

    return lines.join('\n');
  }, [selectedEvent, profile, forecastTemp, forecastConditions, effectiveTrackTemp, tireRecs, sparesMaintenance, expiringSfi, fuelPlan, lowStockParts, borrowedParts]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const handlePrintPdf = () => {
    if (!selectedEvent) {
      toast.error('No event selected to pack for');
      return;
    }
    // Print window (user can Save as PDF from print dialog)
    window.print();
  };

  const handleCopyText = async () => {
    const text = buildTextChecklist();
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Load list copied to clipboard', {
        description: `${text.split('\n').length} lines ready to paste into chat`,
        duration: 3000,
      });
    } catch {
      toast.error('Failed to copy — try Print instead');
    }
  };

  const handleShareToTeam = async () => {
    if (!selectedEvent) return;
    if (!userId || isDemoMode) {
      toast.error('Sign in to share with the team');
      return;
    }

    setSharing(true);
    try {
      const memberName = profile?.driverName || user?.email?.split('@')[0] || 'Team Member';
      const summary = [
        `${tireRecs.length} tire compounds`,
        `${sparesMaintenance.length} spare parts`,
        `${expiringSfi.length} SFI items`,
        `${fuelPlan.totalGal.toFixed(1)} gal fuel`,
        `${borrowedParts.length} borrowed to return`,
      ].join(' • ');

      const { error } = await supabase.from('team_activity_feed').insert({
        user_id: userId,
        action_type: 'pack_trailer',
        action_label: `Pack-the-Trailer list for ${selectedEvent.title}`,
        description: summary,
        actor_name: memberName,
        actor_role: currentRole,
        category: 'planning',
        metadata: {
          event_id: selectedEvent.id,
          event_title: selectedEvent.title,
          track: selectedEvent.trackName,
          start_date: selectedEvent.startDate,
          forecast_track_temp: effectiveTrackTemp,
          fuel_total_gal: fuelPlan.totalGal,
          fuel_type: fuelPlan.fuelType,
          expected_passes: fuelPlan.passes,
          tire_compounds: tireRecs.map(t => t.compound),
          spare_parts_count: sparesMaintenance.length,
          sfi_expiring_count: expiringSfi.length,
          low_stock_count: lowStockParts.length,
          borrowed_return_count: borrowedParts.length,
          checklist_text: buildTextChecklist(),
        },
      });

      if (error) throw error;

      setShareSuccess(true);
      toast.success('Load list shared to Team Dashboard', {
        description: 'All team members with the app open will see it in real time',
        duration: 5000,
      });
      setTimeout(() => setShareSuccess(false), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PackTheTrailer] Share failed:', msg);
      toast.error('Failed to share to Team Dashboard', { description: msg });
    } finally {
      setSharing(false);
    }
  };

  // ─── Stats for header ───────────────────────────────────────────────────
  const totalItems =
    tireRecs.length +
    sparesMaintenance.length +
    expiringSfi.length +
    1 /* fuel */ +
    lowStockParts.length +
    borrowedParts.length;

  // ─── No upcoming events empty state ─────────────────────────────────────
  if (upcomingEvents.length === 0) {
    return (
      <section className="max-w-[1920px] mx-auto px-4 py-8">
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-12 text-center">
          <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Upcoming Events</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add a race event to your Calendar to generate a Pack-the-Trailer load list.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('calendar')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              <CalendarDays className="w-4 h-4" />
              Go to Race Calendar
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1920px] mx-auto px-4 py-6 pack-trailer-root">
      {/* ─── Print-only CSS ────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .pack-trailer-root, .pack-trailer-root * { visibility: visible; }
          .pack-trailer-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0.5in; background: white !important; color: black !important; }
          .pack-trailer-root .no-print { display: none !important; }
          .pack-trailer-root .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #444 !important; background: white !important; color: black !important; margin-bottom: 12px; padding: 10px; border-radius: 4px; }
          .pack-trailer-root h1, .pack-trailer-root h2, .pack-trailer-root h3, .pack-trailer-root h4, .pack-trailer-root p, .pack-trailer-root li, .pack-trailer-root span, .pack-trailer-root div, .pack-trailer-root td, .pack-trailer-root th { color: black !important; background: transparent !important; }
          .pack-trailer-root .checkbox-print { display: inline-block; width: 12px; height: 12px; border: 1.5px solid black; margin-right: 6px; vertical-align: middle; }
          .pack-trailer-root .critical-print { font-weight: bold; }
          .pack-trailer-root .print-divider { border-top: 2px solid black; margin: 8px 0; }
          .pack-trailer-root .section-header-print { background: #e5e7eb !important; padding: 4px 8px; border-radius: 2px; }
        }
      `}</style>

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <PackageCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Pack the Trailer</h1>
            <p className="text-sm text-slate-400">
              Auto-generated load list from your Calendar, Forecast, Inventory &amp; Borrowed Parts
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchForecast}
            disabled={forecastLoading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {forecastLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh Forecast
          </button>
          <button
            onClick={handleCopyText}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy as Text
          </button>
          <button
            onClick={handlePrintPdf}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/40 text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-500/30 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
          <button
            onClick={handleShareToTeam}
            disabled={sharing || isDemoMode}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              shareSuccess
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 border-transparent text-white hover:brightness-110'
            }`}
            title={isDemoMode ? 'Sign in to share with your team' : 'Post to Team Dashboard activity feed'}
          >
            {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             shareSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> :
             <Share2 className="w-3.5 h-3.5" />}
            {shareSuccess ? 'Shared!' : 'Share to Team'}
          </button>
        </div>
      </div>

      {/* ─── Event Picker + Forecast Summary ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-slate-700/50 p-5 mb-6 print-card">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Event selector */}
          <div className="lg:col-span-2">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block no-print">
              Packing For
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="flex-1 min-w-[220px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 no-print"
              >
                {upcomingEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} — {formatLocalDate(ev.startDate)} — {ev.trackName || 'TBD'}
                  </option>
                ))}
              </select>
            </div>
            {selectedEvent && (
              <div className="mt-3 space-y-1.5">
                <h2 className="text-xl font-bold text-white section-header-print">
                  {selectedEvent.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-slate-300 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedEvent.trackName}
                    {selectedEvent.trackLocation && ` — ${selectedEvent.trackLocation}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                    {formatLocalDate(selectedEvent.startDate)}
                    {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate &&
                      ` → ${formatLocalDate(selectedEvent.endDate)}`}
                  </span>
                  {trackElevation > 0 && (
                    <span className="text-xs text-slate-400">
                      Elevation: {trackElevation} ft
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Forecast */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-700/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5">
                <Cloud className="w-3 h-3" />
                Forecast
              </span>
              {forecastLoading && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
            </div>
            {forecastError ? (
              <div className="text-xs text-red-400">
                {forecastError}
                <p className="text-slate-400 mt-1">Enter track temp manually below →</p>
              </div>
            ) : forecastTemp != null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{forecastTemp.toFixed(0)}°F</span>
                  <span className="text-xs text-slate-400">air</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{forecastConditions}</p>
                <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-sm text-orange-400 font-semibold">
                    ~{effectiveTrackTemp.toFixed(0)}°F track
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Loading forecast…</p>
            )}
            <div className="mt-3 no-print">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium block mb-1">
                Override Track Temp
              </label>
              <input
                type="number"
                value={manualTrackTemp}
                onChange={(e) => setManualTrackTemp(e.target.value)}
                placeholder={forecastTrackTemp ? forecastTrackTemp.toFixed(0) : '85'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Overview Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 no-print">
        <StatCard icon={Gauge} label="Tire Items" value={tireRecs.length} tint="orange" />
        <StatCard icon={Wrench} label="Spare Parts" value={sparesMaintenance.length} tint="blue" />
        <StatCard icon={Shield} label="SFI Expiring" value={expiringSfi.length} tint={expiringSfi.length > 0 ? 'red' : 'emerald'} />
        <StatCard icon={Fuel} label="Fuel (gal)" value={fuelPlan.totalGal.toFixed(1)} tint="purple" />
        <StatCard icon={Package} label="Low Stock" value={lowStockParts.length} tint={lowStockParts.length > 0 ? 'amber' : 'emerald'} />
        <StatCard icon={ArrowLeftRight} label="To Return" value={borrowedParts.length} tint={borrowedParts.length > 0 ? 'violet' : 'emerald'} />
      </div>

      <div className="mb-4 text-xs text-slate-500 no-print">
        <span className="font-semibold text-slate-400">{totalItems}</span> total items on load list • Generated {new Date().toLocaleString()}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TIRE COMPOUNDS                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="tires"
        title="Tire Compounds"
        icon={Gauge}
        tint="orange"
        count={tireRecs.length}
        subtitle={`Based on forecast track temp ${effectiveTrackTemp.toFixed(0)}°F`}
        expanded={expandedSections.has('tires')}
        onToggle={toggleSection}
      >
        <div className="space-y-2">
          {tireRecs.map((rec, idx) => (
            <label key={idx} className="flex items-start gap-3 p-3 bg-slate-900/40 border border-slate-700/30 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer group">
              <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 checkbox-field" />
              <span className="checkbox-print" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${rec.priority === 'critical' ? 'text-orange-300 critical-print' : 'text-white'}`}>
                    {rec.compound}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{rec.sizeExample}</span>
                  <PriorityBadge priority={rec.priority} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
              </div>
            </label>
          ))}
        </div>
      </ChecklistSection>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SPARE PARTS — approaching service limit                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="sparesMaint"
        title="Spare Parts — Approaching Service Limit"
        icon={Wrench}
        tint="blue"
        count={sparesMaintenance.length}
        subtitle="Items flagged from Maintenance Tracker (≥75% of interval used or already due)"
        expanded={expandedSections.has('sparesMaint')}
        onToggle={toggleSection}
      >
        {sparesMaintenance.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            No maintenance items approaching service limit. All systems look fresh.
          </p>
        ) : (
          <div className="space-y-1.5">
            {sparesMaintenance.map((s, idx) => (
              <label key={s.item.id || idx} className="flex items-center gap-3 p-2.5 bg-slate-900/40 border border-slate-700/30 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                <span className="checkbox-print" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${s.item.status === 'Overdue' ? 'text-red-300 critical-print' : 'text-white'}`}>
                      {s.item.component}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                      {s.item.category}
                    </span>
                    <StatusPill status={s.item.status} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {s.percentUsed.toFixed(0)}% used • {s.remaining} passes left • interval: {s.item.passInterval}
                  </p>
                </div>
                <div className="w-20 flex-shrink-0 no-print">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.percentUsed >= 100 ? 'bg-red-500' : s.percentUsed >= 90 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                      style={{ width: `${Math.min(100, s.percentUsed)}%` }}
                    />
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </ChecklistSection>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SFI EXPIRING ITEMS                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="sfiExpiring"
        title="SFI Safety Gear — Expiring / Recertify"
        icon={Shield}
        tint={expiringSfi.some(c => c.daysUntilExpiration <= 0) ? 'red' : 'amber'}
        count={expiringSfi.length}
        subtitle="Harnesses, window nets, helmets, suits, parachutes within 60-day window"
        expanded={expandedSections.has('sfiExpiring')}
        onToggle={toggleSection}
      >
        {expiringSfi.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            No SFI safety items expiring within 60 days.
          </p>
        ) : (
          <div className="space-y-1.5">
            {expiringSfi.map(c => {
              const isExpired = c.daysUntilExpiration <= 0;
              return (
                <label key={c.id} className="flex items-center gap-3 p-2.5 bg-slate-900/40 border border-slate-700/30 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500" />
                  <span className="checkbox-print" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isExpired ? 'text-red-300 critical-print' : 'text-white'}`}>
                        {c.item}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {c.sfiSpec}
                      </span>
                      {isExpired ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 font-bold critical-print">EXPIRED</span>
                      ) : c.daysUntilExpiration <= 14 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Critical</span>
                      ) : c.daysUntilExpiration <= 30 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Soon</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500">Warning</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Expires {c.expirationDate} • {isExpired ? `${Math.abs(c.daysUntilExpiration)}d past due` : `${c.daysUntilExpiration}d left`}
                      {c.vendor && ` • vendor: ${c.vendor}`}
                      {c.serialNumber && ` • S/N: ${c.serialNumber}`}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </ChecklistSection>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FUEL QUANTITY                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="fuel"
        title="Fuel Plan"
        icon={Fuel}
        tint="purple"
        count={1}
        subtitle={`${fuelPlan.passes} passes × ${fuelPlan.perPass} gal + warmup pad`}
        expanded={expandedSections.has('fuel')}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 no-print">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Expected Passes
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={expectedPasses}
              onChange={(e) => setExpectedPasses(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Gallons / Pass
            </label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="20"
              value={gallonsPerPass}
              onChange={(e) => setGallonsPerPass(parseFloat(e.target.value) || 0.5)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Fuel Type
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
            >
              <option value="Methanol">Methanol</option>
              <option value="Nitromethane">Nitromethane</option>
              <option value="VP M1">VP M1 (Methanol)</option>
              <option value="VP Q16">VP Q16</option>
              <option value="VP C16">VP C16</option>
              <option value="VP X98">VP X98</option>
              <option value="E85">E85</option>
              <option value="Race Gas 110">Race Gas 110</option>
              <option value="Pump Gas">Pump Gas</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Warmup Pad (gal)
            </label>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm font-mono">
              {fuelPlan.warmupGal}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/40 rounded-xl cursor-pointer">
          <input type="checkbox" className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500" />
          <span className="checkbox-print" />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{fuelPlan.totalGal.toFixed(1)}</span>
              <span className="text-sm text-purple-300 font-semibold">gallons {fuelPlan.fuelType}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {fuelPlan.passes} passes × {fuelPlan.perPass} gal = {fuelPlan.raceGal.toFixed(1)} gal race fuel + {fuelPlan.warmupGal} gal warmup/burnout pad
            </p>
          </div>
          <Fuel className="w-8 h-8 text-purple-400" />
        </label>
      </ChecklistSection>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOW-STOCK PARTS                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="lowStock"
        title="Low-Stock Inventory — Top Up Before Loading"
        icon={Package}
        tint="amber"
        count={lowStockParts.length}
        subtitle="Parts below minimum quantity — order or pick up before leaving"
        expanded={expandedSections.has('lowStock')}
        onToggle={toggleSection}
      >
        {lowStockParts.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            Inventory stocked. No parts flagged as low or out of stock.
          </p>
        ) : (
          <div className="space-y-1.5">
            {lowStockParts.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2.5 bg-slate-900/40 border border-slate-700/30 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500" />
                <span className="checkbox-print" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${p.status === 'Out of Stock' ? 'text-red-300 critical-print' : 'text-white'}`}>
                      {p.description}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {p.partNumber}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      p.status === 'Out of Stock' ? 'bg-red-500/20 text-red-400' :
                      p.status === 'Low Stock' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    On hand: <span className={`font-semibold ${p.onHand === 0 ? 'text-red-400' : 'text-white'}`}>{p.onHand}</span> / Min: {p.minQuantity}
                    {p.vendor && ` • vendor: ${p.vendor}`}
                    {p.location && ` • loc: ${p.location}`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </ChecklistSection>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BORROWED PARTS TO RETURN                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ChecklistSection
        id="borrowed"
        title="Borrowed Parts — Load to Return"
        icon={ArrowLeftRight}
        tint={borrowedParts.some(b => b.status === 'overdue') ? 'red' : 'violet'}
        count={borrowedParts.length}
        subtitle="Outstanding borrowed parts you should bring back to the owners"
        expanded={expandedSections.has('borrowed')}
        onToggle={toggleSection}
      >
        {borrowedLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading borrowed parts…</span>
          </div>
        ) : borrowedParts.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            Nothing currently borrowed. You're clear.
          </p>
        ) : (
          <div className="space-y-1.5">
            {borrowedParts.map(p => {
              const overdue = p.status === 'overdue';
              const today = getLocalDateString();
              const isOverdueByDate = p.expected_return_date && p.expected_return_date < today;
              const effectiveOverdue = overdue || isOverdueByDate;
              return (
                <label key={p.id} className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-700/30 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500" />
                  <span className="checkbox-print" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${effectiveOverdue ? 'text-red-300 critical-print' : 'text-white'}`}>
                        {p.part_name}
                      </span>
                      {p.part_number && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          #{p.part_number}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        Qty: {p.quantity}
                      </span>
                      {effectiveOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 font-bold critical-print">
                          <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Return to <span className="text-slate-300 font-medium">{p.person_name}</span>
                      {p.contact && ` (${p.contact})`}
                      {p.expected_return_date && ` • due ${formatLocalDate(p.expected_return_date)}`}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </ChecklistSection>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-slate-700/40 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          <span>Generated {new Date().toLocaleString()} — {totalItems} total items on load list</span>
        </div>
        <div className="text-slate-600 no-print">
          Data source: Race Calendar • Aeris Forecast • Maintenance Tracker • SFI Registry • Parts Inventory • Borrowed/Loaned DB
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tint: 'orange' | 'blue' | 'red' | 'amber' | 'purple' | 'violet' | 'emerald';
}
const tintMap = {
  orange: 'from-orange-500/15 to-orange-500/5 border-orange-500/30 text-orange-400',
  blue:   'from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-400',
  red:    'from-red-500/15 to-red-500/5 border-red-500/30 text-red-400',
  amber:  'from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-400',
  purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-400',
  violet: 'from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-400',
  emerald:'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
};
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, tint }) => (
  <div className={`bg-gradient-to-br border rounded-xl p-3 ${tintMap[tint]}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

interface ChecklistSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  tint: 'orange' | 'blue' | 'red' | 'amber' | 'purple' | 'violet' | 'emerald';
  count: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}
const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  id, title, subtitle, icon: Icon, tint, count, expanded, onToggle, children,
}) => {
  const accent = tintMap[tint];
  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden print-card">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br border flex items-center justify-center ${accent}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white section-header-print">
              {title}
              <span className="ml-2 text-xs font-semibold text-slate-400">({count})</span>
            </h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="no-print">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {(expanded || typeof window === 'undefined') && (
        <div className="px-5 pb-4 pt-1 print-expanded">
          {children}
        </div>
      )}
      {/* For print: force-render content even when collapsed */}
      {!expanded && (
        <div className="hidden print:block px-5 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
};

interface PriorityBadgeProps {
  priority: 'critical' | 'recommended' | 'optional';
}
const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const cfg = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    recommended: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    optional: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${cfg[priority]}`}>
      {priority}
    </span>
  );
};

interface StatusPillProps {
  status: string;
}
const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const cfg: Record<string, string> = {
    'Good': 'bg-emerald-500/20 text-emerald-400',
    'Due Soon': 'bg-yellow-500/20 text-yellow-400',
    'Due': 'bg-orange-500/20 text-orange-400',
    'Overdue': 'bg-red-500/20 text-red-400 critical-print',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cfg[status] || 'bg-slate-500/20 text-slate-400'}`}>
      {status}
    </span>
  );
};

export default PackTheTrailer;
