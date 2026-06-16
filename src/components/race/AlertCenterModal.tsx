import React from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  Wrench,
  Package,
  Shield,
  ChevronRight,
  BellOff,
  Bell,
} from 'lucide-react';

export interface AlertDetail {
  category: string;
  count: number;
  items: string[];
  severity: 'critical' | 'warning';
  navTarget: string;
}

interface AlertCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertDetail[];
  onNavigate: (section: string) => void;
}

// Friendly label for each navigation target so users know where they'll land.
const TARGET_LABEL: Record<string, string> = {
  maintenance: 'Maintenance',
  parts: 'Parts Inventory',
  engines: 'Main Components',
  borrowedloaned: 'Borrowed / Loaned',
  dashboard: 'Dashboard',
};

// Pick an icon based on what the alert is about.
const getCategoryIcon = (detail: AlertDetail) => {
  const cat = detail.category.toLowerCase();
  if (cat.includes('sfi') || cat.includes('cert')) return Shield;
  if (cat.includes('stock') || cat.includes('part')) return Package;
  if (detail.navTarget === 'parts') return Package;
  if (detail.severity === 'critical') return AlertTriangle;
  return Clock;
};

const AlertCenterModal: React.FC<AlertCenterModalProps> = ({
  isOpen,
  onClose,
  alerts,
  onNavigate,
}) => {
  if (!isOpen) return null;

  const totalCount = alerts.reduce((sum, a) => sum + a.count, 0);
  const criticalCount = alerts
    .filter((a) => a.severity === 'critical')
    .reduce((sum, a) => sum + a.count, 0);

  const handleNavigate = (target: string) => {
    onClose();
    onNavigate(target);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm px-3 py-6 sm:py-12 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-500/15 via-orange-500/10 to-slate-900 border-b border-slate-700/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Alert Center
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalCount} active alert{totalCount !== 1 ? 's' : ''}
                {criticalCount > 0 && (
                  <span className="text-red-400 font-medium">
                    {' '}
                    · {criticalCount} critical
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <BellOff className="w-7 h-7 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-300">All clear</p>
              <p className="text-xs text-slate-500 mt-1">
                You have no active alerts right now.
              </p>
            </div>
          ) : (
            alerts.map((detail, idx) => {
              const Icon = getCategoryIcon(detail);
              const isCritical = detail.severity === 'critical';
              const targetLabel =
                TARGET_LABEL[detail.navTarget] || 'View Details';

              return (
                <button
                  key={idx}
                  onClick={() => handleNavigate(detail.navTarget)}
                  className={`group w-full text-left rounded-xl border p-4 transition-all ${
                    isCritical
                      ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50'
                      : 'bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCritical
                          ? 'bg-red-500/20'
                          : 'bg-amber-500/20'
                      }`}
                    >
                      <Icon
                        className={`w-4.5 h-4.5 ${
                          isCritical ? 'text-red-400' : 'text-amber-400'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-sm font-semibold ${
                            isCritical ? 'text-red-300' : 'text-amber-300'
                          }`}
                        >
                          {detail.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isCritical
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {detail.count}
                        </span>
                      </div>

                      <ul className="space-y-0.5 mb-2">
                        {detail.items.map((item, itemIdx) => (
                          <li
                            key={itemIdx}
                            className="text-xs text-slate-400 truncate leading-relaxed"
                          >
                            • {item}
                          </li>
                        ))}
                        {detail.count > detail.items.length && (
                          <li className="text-xs text-slate-500 italic">
                            +{detail.count - detail.items.length} more...
                          </li>
                        )}
                      </ul>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[11px] font-medium ${
                            isCritical ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          Go to {targetLabel}
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                            isCritical ? 'text-red-400' : 'text-amber-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700/80 bg-slate-900/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Select an alert to jump to the relevant page.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertCenterModal;
