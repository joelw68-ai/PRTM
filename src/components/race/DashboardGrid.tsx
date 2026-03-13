import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCar } from '@/contexts/CarContext';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { parseRows } from '@/lib/validatedQuery';
import { BorrowedLoanedPartRowSchema } from '@/lib/validators';

import {
  Car, Gauge, ClipboardList, Wrench, Package, Calendar, BarChart3,
  Camera, History, Cog, ArrowLeftRight, DollarSign, Receipt, Fuel,
  CheckSquare, ListTodo, FileText, User, SlidersHorizontal,
  AlertTriangle, ChevronRight, Users
} from 'lucide-react';

interface DashboardGridProps {
  onNavigate: (section: string) => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({ onNavigate }) => {
  const {
    passLogs, maintenanceItems, workOrders, partsInventory,
    engines, superchargers, drivetrainComponents, raceEvents,
    sfiCertifications, vendors
  } = useApp();
  const { user, isDemoMode, effectiveUserId } = useAuth();
  const { cars, selectedCarId } = useCar();

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

  const dueMaintenance = maintenanceItems.filter(m => m.status === 'Due' || m.status === 'Due Soon' || m.status === 'Overdue');
  const openWorkOrders = workOrders.filter(w => w.status !== 'Completed' && w.status !== 'Cancelled');
  const lowStockParts = partsInventory.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock');
  const upcomingEvents = useMemo(() => {
    return (raceEvents || [])
      .filter(e => e.startDate >= todayStr && e.status !== 'Cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);
  }, [raceEvents, todayStr]);
  const expiredCerts = sfiCertifications.filter(c => c.daysUntilExpiration <= 0);
  const bestET = passLogs.length > 0 ? Math.min(...passLogs.map(p => p.eighth)).toFixed(3) : null;
  const bestMPH = passLogs.length > 0 ? Math.max(...passLogs.map(p => p.mph)).toFixed(1) : null;

  const cards = [
    {
      id: 'cars',
      label: 'Race Cars',
      icon: Car,
      color: 'from-cyan-500 to-blue-600',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      preview: `${cars.length} car${cars.length !== 1 ? 's' : ''} registered`,
      alert: null,
    },
    {
      id: 'passlog',
      label: 'Pass Log',
      icon: ClipboardList,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-500/10 border-green-500/20',
      preview: passLogs.length > 0
        ? `${passLogs.length} passes${bestET ? ` · Best: ${bestET}s` : ''}`
        : 'No passes logged yet',
      alert: null,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      preview: passLogs.length > 0
        ? `${bestMPH ? `Top speed: ${bestMPH} MPH` : 'View performance data'}`
        : 'Log passes to see analytics',
      alert: null,
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Wrench,
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'bg-yellow-500/10 border-yellow-500/20',
      preview: dueMaintenance.length > 0
        ? `${dueMaintenance.length} item${dueMaintenance.length !== 1 ? 's' : ''} due`
        : 'All caught up',
      alert: dueMaintenance.length > 0 ? dueMaintenance.length : null,
    },
    {
      id: 'engines',
      label: 'Main Components',
      icon: Cog,
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-orange-500/10 border-orange-500/20',
      preview: `${engines.length} engines · ${superchargers.length} superchargers · ${drivetrainComponents.length} drivetrain`,
      alert: null,
    },
    {
      id: 'parts',
      label: 'Parts Inventory',
      icon: Package,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      preview: `${partsInventory.length} parts${lowStockParts.length > 0 ? ` · ${lowStockParts.length} low stock` : ''}`,
      alert: lowStockParts.length > 0 ? lowStockParts.length : null,
    },
    {
      id: 'calendar',
      label: 'Event Calendar',
      icon: Calendar,
      color: 'from-cyan-500 to-sky-600',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      preview: upcomingEvents.length > 0
        ? `Next: ${upcomingEvents[0]?.title || 'Event'}`
        : 'No upcoming events',
      alert: null,
    },
    {
      id: 'workorders',
      label: 'Work Orders',
      icon: FileText,
      color: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      preview: openWorkOrders.length > 0
        ? `${openWorkOrders.length} open work order${openWorkOrders.length !== 1 ? 's' : ''}`
        : 'No open work orders',
      alert: openWorkOrders.filter(w => w.priority === 'Critical').length > 0
        ? openWorkOrders.filter(w => w.priority === 'Critical').length
        : null,
    },
    {
      id: 'vendors',
      label: 'Vendors',
      icon: Users,
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-500/10 border-violet-500/20',
      preview: `${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}`,
      alert: null,
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: Receipt,
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      preview: 'Track team expenses',
      alert: null,
    },
    {
      id: 'checklists',
      label: 'Checklists',
      icon: CheckSquare,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      preview: 'Race day checklists',
      alert: null,
    },
    {
      id: 'gallery',
      label: 'Gallery',
      icon: Camera,
      color: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-500/10 border-pink-500/20',
      preview: 'Team photos & media',
      alert: null,
    },
    {
      id: 'borrowedloaned',
      label: 'Borrowed / Loaned',
      icon: ArrowLeftRight,
      color: 'from-violet-500 to-indigo-600',
      bgColor: 'bg-violet-500/10 border-violet-500/20',
      preview: borrowedLoanedParts.length > 0
        ? `${borrowedLoanedParts.length} active transaction${borrowedLoanedParts.length !== 1 ? 's' : ''}`
        : 'No active transactions',
      alert: null,
    },
    {
      id: 'todo',
      label: 'To Do',
      icon: ListTodo,
      color: 'from-teal-500 to-cyan-600',
      bgColor: 'bg-teal-500/10 border-teal-500/20',
      preview: 'Task management',
      alert: null,
    },
    {
      id: 'fuellog',
      label: 'Fuel Log',
      icon: Fuel,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      preview: 'Track fuel usage',
      alert: null,
    },
    {
      id: 'profile',
      label: 'Team Profile',
      icon: User,
      color: 'from-slate-400 to-slate-600',
      bgColor: 'bg-slate-500/10 border-slate-500/20',
      preview: 'Team info & crew',
      alert: null,
    },
  ];

  return (
    <section className="py-6 px-4">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1 ml-[52px]">Quick overview of all sections</p>
        </div>

        {/* Critical Alerts Banner */}
        {(expiredCerts.length > 0 || dueMaintenance.filter(m => m.status === 'Overdue').length > 0) && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-300 font-semibold text-sm">Critical Alerts</p>
              <p className="text-red-400/80 text-xs mt-0.5">
                {expiredCerts.length > 0 && `${expiredCerts.length} expired SFI cert${expiredCerts.length !== 1 ? 's' : ''}`}
                {expiredCerts.length > 0 && dueMaintenance.filter(m => m.status === 'Overdue').length > 0 && ' · '}
                {dueMaintenance.filter(m => m.status === 'Overdue').length > 0 && `${dueMaintenance.filter(m => m.status === 'Overdue').length} overdue maintenance`}
              </p>
            </div>
            <button
              onClick={() => onNavigate('maintenance')}
              className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center gap-1"
            >
              View <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => onNavigate(card.id)}
                className={`relative text-left p-5 rounded-xl border ${card.bgColor} hover:scale-[1.02] hover:shadow-lg transition-all duration-200 group`}
              >
                {/* Alert Badge */}
                {card.alert && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">{card.alert > 9 ? '9+' : card.alert}</span>
                  </div>
                )}

                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Label */}
                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-orange-300 transition-colors">
                  {card.label}
                </h3>

                {/* Preview */}
                <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                  {card.preview}
                </p>

                {/* Arrow */}
                <ChevronRight className="absolute bottom-4 right-4 w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DashboardGrid;
