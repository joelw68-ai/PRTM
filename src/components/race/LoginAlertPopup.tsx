import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { BorrowedLoanedPartRowSchema } from '@/lib/validators';
import { buildAlertDetails } from '@/lib/alertDetails';

import {
  AlertTriangle, Wrench, Package, ArrowLeftRight,
  X, ChevronRight, Bell, Clock, Shield
} from 'lucide-react';


interface LoginAlertPopupProps {
  onNavigate: (section: string) => void;
  onDismiss: () => void;
}

interface AlertItem {
  id: string;
  category: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  message: string;
  detail?: string;
  navTarget: string;
  severity: 'critical' | 'warning' | 'info';
}

// Pick an icon for an alert category produced by the canonical alert engine.
const iconForCategory = (category: string, navTarget: string): React.ElementType => {
  const cat = category.toLowerCase();
  if (cat.includes('sfi') || cat.includes('cert')) return Shield;
  if (cat.includes('stock') || cat.includes('part') || navTarget === 'parts') return Package;
  if (cat.includes('overdue')) return AlertTriangle;
  return Wrench;
};

const LoginAlertPopup: React.FC<LoginAlertPopupProps> = ({ onNavigate, onDismiss }) => {
  // Pull the SAME data the bell, dashboard and Alert Center use.
  const { sfiCertifications, maintenanceItems, partsInventory } = useApp();

  const { user, isDemoMode, effectiveUserId } = useAuth();
  const todayStr = getLocalDateString();

  // Borrowed/Loaned parts (shown as an extra reminder section — these are not
  // part of the bell badge count, so they're listed separately below).
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
    const load = async () => {
      try {
        const { data } = await supabase
          .from('borrowed_loaned_parts')
          .select('id, transaction_type, part_name, person_name, expected_return_date, status')
          .eq('user_id', uid)
          .neq('status', 'returned');
        setBorrowedLoanedParts(parseRows(data, BorrowedLoanedPartRowSchema, 'borrowed_loaned_parts') as BLPart[]);
      } catch { /* silent */ }
    };
    load();
  }, [effectiveUserId, user?.id, isDemoMode]);

  // ── CORE ALERTS: derived from the canonical alert engine so this popup
  //    always matches the nav bell badge, the Alert Center and the dashboard. ──
  const coreAlerts = useMemo<AlertItem[]>(() => {
    const details = buildAlertDetails(sfiCertifications, maintenanceItems, partsInventory);
    return details.map((d, idx) => {
      const isCritical = d.severity === 'critical';
      return {
        id: `core-${idx}`,
        category: d.category,
        icon: iconForCategory(d.category, d.navTarget),
        iconColor: isCritical ? 'text-red-400' : 'text-yellow-400',
        bgColor: isCritical ? 'bg-red-500/10' : 'bg-yellow-500/10',
        borderColor: isCritical ? 'border-red-500/30' : 'border-yellow-500/30',
        message: `${d.count} ${d.category.toLowerCase()}`,
        detail: d.items.join(', '),
        navTarget: d.navTarget,
        severity: d.severity,
      };
    });
  }, [sfiCertifications, maintenanceItems, partsInventory]);

  // The header count reflects the canonical alert total (matches the bell badge).
  const coreCount = useMemo(
    () => buildAlertDetails(sfiCertifications, maintenanceItems, partsInventory).reduce((s, a) => s + a.count, 0),
    [sfiCertifications, maintenanceItems, partsInventory]
  );

  // ── EXTRA: Borrowed/Loaned parts needing action (separate reminder) ──
  const blAlerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    const blOverdue = borrowedLoanedParts.filter(p => p.expected_return_date && p.expected_return_date < todayStr);
    const blDueSoon = borrowedLoanedParts.filter(p => {
      if (!p.expected_return_date) return false;
      if (p.expected_return_date < todayStr) return false;
      const dueDate = parseLocalDate(p.expected_return_date);
      const todayDate = parseLocalDate(todayStr);
      const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    });

    if (blOverdue.length > 0 || blDueSoon.length > 0) {
      const total = blOverdue.length + blDueSoon.length;
      items.push({
        id: 'bl-parts',
        category: 'Borrowed/Loaned Parts',
        icon: ArrowLeftRight,
        iconColor: blOverdue.length > 0 ? 'text-red-400' : 'text-yellow-400',
        bgColor: blOverdue.length > 0 ? 'bg-red-500/10' : 'bg-yellow-500/10',
        borderColor: blOverdue.length > 0 ? 'border-red-500/30' : 'border-yellow-500/30',
        message: `${total} borrowed/loaned part${total !== 1 ? 's' : ''} need${total === 1 ? 's' : ''} action`,
        detail: [
          blOverdue.length > 0 ? `${blOverdue.length} overdue` : '',
          blDueSoon.length > 0 ? `${blDueSoon.length} due soon` : '',
        ].filter(Boolean).join(', '),
        navTarget: 'borrowedloaned',
        severity: blOverdue.length > 0 ? 'critical' : 'warning',
      });
    }
    return items;
  }, [borrowedLoanedParts, todayStr]);

  const alerts = useMemo(() => [...coreAlerts, ...blAlerts], [coreAlerts, blAlerts]);

  // Don't show if no alerts
  if (alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />

      {/* Popup */}
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/10 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Attention Needed</h2>
              <p className="text-xs text-slate-400">
                {coreCount} active alert{coreCount !== 1 ? 's' : ''}
                {blAlerts.length > 0 && ' · plus borrowed/loaned reminders'}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert List */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {alerts.map(alert => {
            const Icon = alert.icon;
            return (
              <button
                key={alert.id}
                onClick={() => {
                  onNavigate(alert.navTarget);
                  onDismiss();
                }}
                className={`w-full text-left px-6 py-4 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0 group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${alert.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4.5 h-4.5 ${alert.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{alert.category}</span>
                      {alert.severity === 'critical' && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">URGENT</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white capitalize">{alert.message}</p>
                    {alert.detail && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{alert.detail}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-2" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/50 bg-slate-900/80">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginAlertPopup;
