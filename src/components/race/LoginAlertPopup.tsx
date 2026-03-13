import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { BorrowedLoanedPartRowSchema } from '@/lib/validators';

import {
  AlertTriangle, Wrench, FileText, Package, ArrowLeftRight,
  X, ChevronRight, Bell, Clock
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

const LoginAlertPopup: React.FC<LoginAlertPopupProps> = ({ onNavigate, onDismiss }) => {
  const { maintenanceItems, workOrders, partsInventory } = useApp();
  const { user, isDemoMode, effectiveUserId } = useAuth();
  const todayStr = getLocalDateString();

  // Borrowed/Loaned parts
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

  const alerts = useMemo(() => {
    const items: AlertItem[] = [];

    // Overdue maintenance
    const overdueMaint = maintenanceItems.filter(m => m.status === 'Overdue');
    if (overdueMaint.length > 0) {
      items.push({
        id: 'maint-overdue',
        category: 'Overdue Maintenance',
        icon: AlertTriangle,
        iconColor: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        message: `${overdueMaint.length} maintenance item${overdueMaint.length !== 1 ? 's' : ''} overdue`,
        detail: overdueMaint.slice(0, 3).map(m => m.component).join(', '),
        navTarget: 'maintenance',
        severity: 'critical',
      });
    }

    // Upcoming maintenance (Due or Due Soon)
    const upcomingMaint = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Due Soon');
    if (upcomingMaint.length > 0) {
      items.push({
        id: 'maint-upcoming',
        category: 'Upcoming Maintenance',
        icon: Wrench,
        iconColor: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        message: `${upcomingMaint.length} maintenance item${upcomingMaint.length !== 1 ? 's' : ''} due soon`,
        detail: upcomingMaint.slice(0, 3).map(m => m.component).join(', '),
        navTarget: 'maintenance',
        severity: 'warning',
      });
    }

    // Open work orders
    const openWO = workOrders.filter(w => w.status !== 'Completed' && w.status !== 'Cancelled');
    if (openWO.length > 0) {
      const criticalCount = openWO.filter(w => w.priority === 'Critical').length;
      items.push({
        id: 'workorders-open',
        category: 'Open Work Orders',
        icon: FileText,
        iconColor: criticalCount > 0 ? 'text-red-400' : 'text-amber-400',
        bgColor: criticalCount > 0 ? 'bg-red-500/10' : 'bg-amber-500/10',
        borderColor: criticalCount > 0 ? 'border-red-500/30' : 'border-amber-500/30',
        message: `${openWO.length} open work order${openWO.length !== 1 ? 's' : ''}${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}`,
        detail: openWO.slice(0, 3).map(w => w.title).join(', '),
        navTarget: 'workorders',
        severity: criticalCount > 0 ? 'critical' : 'warning',
      });
    }

    // Low stock parts
    const lowStock = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock');
    if (lowStock.length > 0) {
      const outOfStock = lowStock.filter(p => p.status === 'Out of Stock').length;
      items.push({
        id: 'parts-lowstock',
        category: 'Low Parts Inventory',
        icon: Package,
        iconColor: outOfStock > 0 ? 'text-red-400' : 'text-yellow-400',
        bgColor: outOfStock > 0 ? 'bg-red-500/10' : 'bg-yellow-500/10',
        borderColor: outOfStock > 0 ? 'border-red-500/30' : 'border-yellow-500/30',
        message: `${lowStock.length} part${lowStock.length !== 1 ? 's' : ''} low or out of stock`,
        detail: lowStock.slice(0, 3).map(p => `${p.name || p.description} (${p.onHand}/${p.minQuantity})`).join(', '),
        navTarget: 'parts',
        severity: outOfStock > 0 ? 'critical' : 'warning',
      });
    }

    // Borrowed/Loaned parts needing action
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
  }, [maintenanceItems, workOrders, partsInventory, borrowedLoanedParts, todayStr]);

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
              <p className="text-xs text-slate-400">{alerts.length} alert{alerts.length !== 1 ? 's' : ''} require your attention</p>
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
                    <p className="text-sm font-medium text-white">{alert.message}</p>
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
