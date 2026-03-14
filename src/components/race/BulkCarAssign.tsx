import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useCar } from '@/contexts/CarContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  PassLogEntry,
  MaintenanceItem,
  SFICertification,
} from '@/data/proModData';
import {
  Car,
  ClipboardList,
  Wrench,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Package,
  Zap,
  Info,
  Eye,
  X,
  Calendar,
  MapPin,
  Gauge,
  Timer,
  Thermometer,
  Droplets,
  Wind,
  FileText,
  Tag,
  Hash,
  Clock,
  DollarSign,
  Activity,
} from 'lucide-react';

// Helper: check if a car_id is empty/null/undefined
const isEmptyCarId = (id: string | null | undefined): boolean => !id || id === '';


interface SectionConfig {
  key: 'passLogs' | 'maintenance' | 'sfiCerts';
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'passLogs',
    label: 'Pass Log Entries',
    icon: ClipboardList,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    key: 'maintenance',
    label: 'Maintenance Items',
    icon: Wrench,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    key: 'sfiCerts',
    label: 'SFI Certifications',
    icon: Shield,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
];

/* ============================================================
   Preview Detail Field Component
   ============================================================ */
const DetailField: React.FC<{
  label: string;
  value: string | number | undefined | null;
  icon?: React.ElementType;
  color?: string;
  fullWidth?: boolean;
}> = ({ label, value, icon: Icon, color = 'text-slate-300', fullWidth = false }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={fullWidth ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </dt>
      <dd className={`text-sm font-medium ${color}`}>{value}</dd>
    </div>
  );
};

/* ============================================================
   Status Badge Component
   ============================================================ */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    'Good': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Due Soon': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Due': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Overdue': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Valid': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Expiring Soon': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Expired': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Win': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Loss': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Single': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Red Light': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Broke': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  const cls = colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
};

/* ============================================================
   Pass Log Preview
   ============================================================ */
const PassLogPreview: React.FC<{ record: PassLogEntry }> = ({ record }) => (
  <div className="space-y-5">
    {/* Header */}
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h4 className="text-lg font-bold text-white">{record.track || 'Unknown Track'}</h4>
        <p className="text-sm text-slate-400">{record.date} {record.time && `at ${record.time}`}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={record.result} />
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          {record.sessionType}
        </span>
      </div>
    </div>

    {/* Performance Data */}
    <div>
      <h5 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3 flex items-center gap-1.5">
        <Gauge className="w-3.5 h-3.5" /> Performance
      </h5>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-slate-700/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">60ft</div>
          <div className="text-lg font-bold text-white">{record.sixtyFoot}s</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-slate-700/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">330ft</div>
          <div className="text-lg font-bold text-white">{record.threeThirty}s</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-slate-700/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">1/8 Mile</div>
          <div className="text-lg font-bold text-emerald-400">{record.eighth}s</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-slate-700/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">MPH</div>
          <div className="text-lg font-bold text-emerald-400">{record.mph}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-slate-700/40">
          <div className="text-[10px] uppercase text-slate-500 mb-1">RT</div>
          <div className="text-lg font-bold text-amber-400">{record.reactionTime}</div>
        </div>
      </div>
    </div>

    {/* Details Grid */}
    <div>
      <h5 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Details
      </h5>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        <DetailField label="Location" value={record.location} icon={MapPin} />
        <DetailField label="Lane" value={record.lane} />
        <DetailField label="Round" value={record.round} />
        <DetailField label="SAE Correction" value={record.saeCorrection} />
        <DetailField label="Density Altitude" value={record.densityAltitude ? `${record.densityAltitude} ft` : undefined} />
        <DetailField label="Corrected HP" value={record.correctedHP} />
        <DetailField label="Crew Chief" value={record.crewChief} />
        {record.aborted && <DetailField label="Aborted" value="Yes" color="text-red-400" />}
      </dl>
    </div>

    {/* Setup */}
    <div>
      <h5 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" /> Car Setup
      </h5>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        <DetailField label="Launch RPM" value={record.launchRPM} />
        <DetailField label="Boost Setting" value={record.boostSetting} />
        <DetailField label="Wheelie Bar" value={record.wheelieBarSetting} />
        <DetailField label="Tire PSI (Front)" value={record.tirePressureFront} />
        <DetailField label="Tire PSI (RL)" value={record.tirePressureRearLeft} />
        <DetailField label="Tire PSI (RR)" value={record.tirePressureRearRight} />
      </dl>
    </div>

    {/* Weather */}
    {record.weather && (
      <div>
        <h5 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-3 flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5" /> Weather Conditions
        </h5>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          <DetailField label="Temperature" value={`${record.weather.temperature}°F`} icon={Thermometer} />
          <DetailField label="Humidity" value={`${record.weather.humidity}%`} icon={Droplets} />
          <DetailField label="Barometric Pressure" value={`${record.weather.pressure} inHg`} />
          <DetailField label="Wind" value={`${record.weather.windSpeed} mph ${record.weather.windDirection}`} icon={Wind} />
          <DetailField label="Track Temp" value={`${record.weather.trackTemp}°F`} />
          <DetailField label="Conditions" value={record.weather.conditions} />
          {record.weather.dewPoint !== undefined && (
            <DetailField label="Dew Point" value={`${record.weather.dewPoint}°F`} />
          )}
        </dl>
      </div>
    )}

    {/* Notes */}
    {record.notes && (
      <div>
        <h5 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Notes
        </h5>
        <p className="text-sm text-slate-300 bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 whitespace-pre-wrap">
          {record.notes}
        </p>
      </div>
    )}
  </div>
);

/* ============================================================
   Maintenance Preview
   ============================================================ */
const MaintenancePreview: React.FC<{ record: MaintenanceItem }> = ({ record }) => {
  const remaining = record.nextServicePasses - record.currentPasses;
  const progressPct = record.passInterval > 0
    ? Math.min(100, Math.max(0, (record.currentPasses / record.nextServicePasses) * 100))
    : 0;

  const progressColor =
    record.status === 'Overdue' ? 'bg-red-500' :
    record.status === 'Due' ? 'bg-orange-500' :
    record.status === 'Due Soon' ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-lg font-bold text-white">{record.component}</h4>
          <p className="text-sm text-slate-400">{record.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={record.status} />
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            record.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
            record.priority === 'High' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
            record.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
            'bg-slate-500/20 text-slate-400 border-slate-500/30'
          }`}>
            {record.priority} Priority
          </span>
        </div>
      </div>

      {/* Pass Progress */}
      <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Pass Progress</span>
          <span className="text-sm font-semibold text-white">
            {record.currentPasses} / {record.nextServicePasses} passes
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
          <div
            className={`${progressColor} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {remaining > 0 ? `${remaining} passes remaining` : `${Math.abs(remaining)} passes overdue`}
          </span>
          <span className="text-slate-500">
            Interval: every {record.passInterval} passes
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div>
        <h5 className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Details
        </h5>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          <DetailField label="Category" value={record.category} icon={Tag} />
          <DetailField label="Pass Interval" value={`${record.passInterval} passes`} icon={Hash} />
          <DetailField label="Current Passes" value={record.currentPasses} icon={Activity} />
          <DetailField label="Next Service At" value={`${record.nextServicePasses} passes`} icon={Clock} />
          <DetailField label="Last Service" value={record.lastService} icon={Calendar} />
          {record.estimatedCost !== undefined && record.estimatedCost > 0 && (
            <DetailField label="Estimated Cost" value={`$${record.estimatedCost.toLocaleString()}`} icon={DollarSign} />
          )}
        </dl>
      </div>

      {/* Notes */}
      {record.notes && (
        <div>
          <h5 className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Notes
          </h5>
          <p className="text-sm text-slate-300 bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 whitespace-pre-wrap">
            {record.notes}
          </p>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   SFI Certification Preview
   ============================================================ */
const SFICertPreview: React.FC<{ record: SFICertification }> = ({ record }) => {
  const daysColor =
    record.daysUntilExpiration <= 0 ? 'text-red-400' :
    record.daysUntilExpiration <= 30 ? 'text-orange-400' :
    record.daysUntilExpiration <= 60 ? 'text-amber-400' :
    'text-emerald-400';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-lg font-bold text-white">{record.item}</h4>
          <p className="text-sm text-slate-400">SFI Spec {record.sfiSpec}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {/* Expiration Card */}
      <div className={`rounded-lg p-4 border ${
        record.daysUntilExpiration <= 0
          ? 'bg-red-500/10 border-red-500/30'
          : record.daysUntilExpiration <= 60
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-emerald-500/10 border-emerald-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500">Days Until Expiration</span>
            <p className={`text-3xl font-bold ${daysColor}`}>
              {record.daysUntilExpiration <= 0
                ? `${Math.abs(record.daysUntilExpiration)} days expired`
                : `${record.daysUntilExpiration} days`
              }
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-500">Expires</span>
            <p className="text-sm font-medium text-white">{record.expirationDate}</p>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div>
        <h5 className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-3 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Certification Details
        </h5>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          <DetailField label="SFI Specification" value={record.sfiSpec} icon={Shield} />
          <DetailField label="Certification Date" value={record.certificationDate} icon={Calendar} />
          <DetailField label="Expiration Date" value={record.expirationDate} icon={Calendar} />
          <DetailField label="Vendor" value={record.vendor} icon={Tag} />
          <DetailField label="Serial Number" value={record.serialNumber} icon={Hash} />
        </dl>
      </div>

      {/* Notes */}
      {record.notes && (
        <div>
          <h5 className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Notes
          </h5>
          <p className="text-sm text-slate-300 bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 whitespace-pre-wrap">
            {record.notes}
          </p>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Preview Modal
   ============================================================ */
const PreviewModal: React.FC<{
  sectionKey: string;
  record: PassLogEntry | MaintenanceItem | SFICertification;
  onClose: () => void;
  onAssign: (recordId: string, sectionKey: string) => void;
  targetCarId: string;
  targetCarLabel: string;
  isAssigning: boolean;
}> = ({ sectionKey, record, onClose, onAssign, targetCarId, targetCarLabel, isAssigning }) => {
  const sectionConfig = SECTIONS.find(s => s.key === sectionKey);
  const Icon = sectionConfig?.icon || FileText;
  const sectionColor = sectionConfig?.color || 'text-slate-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              sectionKey === 'passLogs' ? 'bg-blue-500/20' :
              sectionKey === 'maintenance' ? 'bg-amber-500/20' :
              'bg-purple-500/20'
            }`}>
              <Icon className={`w-5 h-5 ${sectionColor}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Record Preview</h3>
              <p className="text-xs text-slate-500">{sectionConfig?.label} — Unassigned Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {sectionKey === 'passLogs' && <PassLogPreview record={record as PassLogEntry} />}
          {sectionKey === 'maintenance' && <MaintenancePreview record={record as MaintenanceItem} />}
          {sectionKey === 'sfiCerts' && <SFICertPreview record={record as SFICertification} />}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            ID: <span className="font-mono text-slate-400">{record.id}</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50"
            >
              Close
            </button>
            {targetCarId ? (
              <button
                onClick={() => onAssign(record.id, sectionKey)}
                disabled={isAssigning}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Assign to {targetCarLabel}
              </button>
            ) : (
              <span className="text-xs text-amber-400/80 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select a car above to assign
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


/* ============================================================
   Main BulkCarAssign Component
   ============================================================ */
const BulkCarAssign: React.FC = () => {
  const {
    passLogs,
    maintenanceItems,
    sfiCertifications,
    updatePassLog,
    updateMaintenanceItem,
    updateSFICertification,
  } = useApp();
  const { cars, getCarLabel } = useCar();
  const { isAuthenticated } = useAuth();

  const [targetCarId, setTargetCarId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Record<string, Set<string>>>({
    passLogs: new Set(),
    maintenance: new Set(),
    sfiCerts: new Set(),
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignProgress, setAssignProgress] = useState({ current: 0, total: 0 });

  // Preview state
  const [previewRecord, setPreviewRecord] = useState<PassLogEntry | MaintenanceItem | SFICertification | null>(null);
  const [previewSection, setPreviewSection] = useState<string>('');

  // Get unassigned records for each section
  const unassignedPassLogs = useMemo(
    () => passLogs.filter((p) => isEmptyCarId(p.car_id)),
    [passLogs]
  );

  const unassignedMaintenance = useMemo(
    () => maintenanceItems.filter((m) => isEmptyCarId(m.car_id)),
    [maintenanceItems]
  );

  const unassignedSfiCerts = useMemo(
    () => sfiCertifications.filter((c) => isEmptyCarId(c.car_id)),
    [sfiCertifications]
  );

  const unassignedCounts: Record<string, number> = {
    passLogs: unassignedPassLogs.length,
    maintenance: unassignedMaintenance.length,
    sfiCerts: unassignedSfiCerts.length,
  };

  const totalUnassigned = unassignedPassLogs.length + unassignedMaintenance.length + unassignedSfiCerts.length;

  const getUnassignedRecords = (sectionKey: string) => {
    switch (sectionKey) {
      case 'passLogs':
        return unassignedPassLogs;
      case 'maintenance':
        return unassignedMaintenance;
      case 'sfiCerts':
        return unassignedSfiCerts;
      default:
        return [];
    }
  };

  // Get a display label for each record
  const getRecordLabel = (sectionKey: string, record: PassLogEntry | MaintenanceItem | SFICertification): string => {
    switch (sectionKey) {
      case 'passLogs': {
        const p = record as PassLogEntry;
        return `${p.date} — ${p.track || 'Unknown Track'} — ${p.eighth}s @ ${p.mph} MPH (${p.sessionType})`;
      }
      case 'maintenance': {
        const m = record as MaintenanceItem;
        return `${m.component} — ${m.category} — ${m.status} (${m.currentPasses}/${m.nextServicePasses} passes)`;
      }
      case 'sfiCerts': {
        const c = record as SFICertification;
        return `${c.item} — SFI ${c.sfiSpec} — ${c.status} (expires ${c.expirationDate})`;
      }
      default:
        return record.id;
    }
  };

  // Get secondary info for each record
  const getRecordSubtext = (sectionKey: string, record: PassLogEntry | MaintenanceItem | SFICertification): string => {
    switch (sectionKey) {
      case 'passLogs': {
        const p = record as PassLogEntry;
        return `${p.result} | ${p.lane} Lane | RT: ${p.reactionTime}`;
      }
      case 'maintenance': {
        const m = record as MaintenanceItem;
        return `Priority: ${m.priority} | Interval: ${m.passInterval} passes`;
      }
      case 'sfiCerts': {
        const c = record as SFICertification;
        return `Vendor: ${c.vendor} | S/N: ${c.serialNumber}`;
      }
      default:
        return '';
    }
  };


  // Toggle section expansion
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle individual record selection
  const toggleRecord = (sectionKey: string, recordId: string) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      const sectionSet = new Set(prev[sectionKey]);
      if (sectionSet.has(recordId)) sectionSet.delete(recordId);
      else sectionSet.add(recordId);
      next[sectionKey] = sectionSet;
      return next;
    });
  };

  // Toggle all records in a section
  const toggleAllInSection = (sectionKey: string) => {
    const records = getUnassignedRecords(sectionKey);
    const currentSelected = selectedIds[sectionKey];
    const allSelected = records.length > 0 && records.every((r) => currentSelected.has(r.id));

    setSelectedIds((prev) => {
      const next = { ...prev };
      if (allSelected) {
        next[sectionKey] = new Set();
      } else {
        next[sectionKey] = new Set(records.map((r) => r.id));
      }
      return next;
    });
  };

  // Count total selected across all sections
  const totalSelected = Object.values(selectedIds).reduce((sum, set) => sum + set.size, 0);

  // Open preview modal
  const openPreview = (sectionKey: string, record: PassLogEntry | MaintenanceItem | SFICertification) => {
    setPreviewRecord(record);
    setPreviewSection(sectionKey);
  };

  // Close preview modal
  const closePreview = () => {
    setPreviewRecord(null);
    setPreviewSection('');
  };

  // Assign a single record from the preview modal
  const handleAssignSingle = useCallback(async (recordId: string, sectionKey: string) => {
    if (!targetCarId) {
      toast.error('Please select a car to assign records to.');
      return;
    }

    setIsAssigning(true);
    try {
      switch (sectionKey) {
        case 'passLogs':
          await updatePassLog(recordId, { car_id: targetCarId });
          break;
        case 'maintenance':
          await updateMaintenanceItem(recordId, { car_id: targetCarId });
          break;
        case 'sfiCerts':
          await updateSFICertification(recordId, { car_id: targetCarId });
          break;
      }
      const carLabel = getCarLabel(targetCarId);
      toast.success(`Record assigned to ${carLabel}`);
      closePreview();
      // Remove from selection if it was selected
      setSelectedIds((prev) => {
        const next = { ...prev };
        const sectionSet = new Set(prev[sectionKey]);
        sectionSet.delete(recordId);
        next[sectionKey] = sectionSet;
        return next;
      });
    } catch (err) {
      console.error(`[BulkCarAssign] Error assigning record:`, err);
      toast.error('Failed to assign record. Check console for details.');
    }
    setIsAssigning(false);
  }, [targetCarId, updatePassLog, updateMaintenanceItem, updateSFICertification, getCarLabel]);

  // Assign selected records to the target car
  const handleAssignSelected = useCallback(async () => {
    if (!targetCarId) {
      toast.error('Please select a car to assign records to.');
      return;
    }

    const operations: { sectionKey: string; id: string }[] = [];
    for (const [sectionKey, ids] of Object.entries(selectedIds)) {
      for (const id of ids) {
        operations.push({ sectionKey, id });
      }
    }

    if (operations.length === 0) {
      toast.error('No records selected. Please select records to assign.');
      return;
    }

    setIsAssigning(true);
    setAssignProgress({ current: 0, total: operations.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      try {
        switch (op.sectionKey) {
          case 'passLogs':

             await updatePassLog(op.id, { car_id: targetCarId });
             break;
           case 'maintenance':
             await updateMaintenanceItem(op.id, { car_id: targetCarId });
             break;
           case 'sfiCerts':
             await updateSFICertification(op.id, { car_id: targetCarId });
             break;

        }
        successCount++;
      } catch (err) {
        console.error(`[BulkCarAssign] Error assigning ${op.sectionKey} record ${op.id}:`, err);
        errorCount++;
      }
      setAssignProgress({ current: i + 1, total: operations.length });
    }

    setIsAssigning(false);

    // Clear selections
    setSelectedIds({
      passLogs: new Set(),
      maintenance: new Set(),
      sfiCerts: new Set(),
    });

    const carLabel = getCarLabel(targetCarId);
    if (errorCount === 0) {
      toast.success(`Assigned ${successCount} record${successCount !== 1 ? 's' : ''} to ${carLabel}`);
    } else {
      toast.warning(
        `Assigned ${successCount} record${successCount !== 1 ? 's' : ''}, ${errorCount} failed. Check console for details.`
      );
    }
  }, [targetCarId, selectedIds, updatePassLog, updateMaintenanceItem, updateSFICertification, getCarLabel]);

  // Assign ALL unassigned records to the target car (one-click)
  const handleAssignAll = useCallback(async () => {
    if (!targetCarId) {
      toast.error('Please select a car to assign records to.');
      return;
    }

    if (totalUnassigned === 0) {
      toast.info('No unassigned records to assign.');
      return;
    }

    const carLabel = getCarLabel(targetCarId);
    if (!confirm(`Assign all ${totalUnassigned} unassigned record${totalUnassigned !== 1 ? 's' : ''} to ${carLabel}?`)) {
      return;
    }

    setIsAssigning(true);
    setAssignProgress({ current: 0, total: totalUnassigned });

    let successCount = 0;
    let errorCount = 0;
    let current = 0;

    // Pass Logs
    for (const pass of unassignedPassLogs) {
      try {
        await updatePassLog(pass.id, { car_id: targetCarId });

        successCount++;
      } catch {
        errorCount++;
      }
      current++;
      setAssignProgress({ current, total: totalUnassigned });
    }

    // Maintenance Items
    for (const item of unassignedMaintenance) {
      try {
        await updateMaintenanceItem(item.id, { car_id: targetCarId });

        successCount++;
      } catch {
        errorCount++;
      }
      current++;
      setAssignProgress({ current, total: totalUnassigned });
    }

    // SFI Certifications
    for (const cert of unassignedSfiCerts) {
      try {
        await updateSFICertification(cert.id, { car_id: targetCarId });

        successCount++;
      } catch {
        errorCount++;
      }
      current++;
      setAssignProgress({ current, total: totalUnassigned });
    }

    setIsAssigning(false);

    // Clear selections
    setSelectedIds({
      passLogs: new Set(),
      maintenance: new Set(),
      sfiCerts: new Set(),
    });

    if (errorCount === 0) {
      toast.success(`All ${successCount} record${successCount !== 1 ? 's' : ''} assigned to ${carLabel}`);
    } else {
      toast.warning(
        `Assigned ${successCount}, ${errorCount} failed. Check console for details.`
      );
    }
  }, [
    targetCarId,
    totalUnassigned,
    unassignedPassLogs,
    unassignedMaintenance,
    unassignedSfiCerts,
    updatePassLog,
    updateMaintenanceItem,
    updateSFICertification,
    getCarLabel,
  ]);

  // Don't render if there are no cars or no unassigned records
  if (cars.length === 0) return null;
  if (totalUnassigned === 0) {
    return (
      <section className="px-4 pb-8">
        <div className="max-w-[1920px] mx-auto">
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                <Package className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Bulk Car Assignment</h3>
                <p className="text-emerald-400 text-sm flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  All records are assigned to a car — no legacy data found.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const progressPercent = assignProgress.total > 0 ? Math.round((assignProgress.current / assignProgress.total) * 100) : 0;

  return (
    <section className="px-4 pb-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="bg-slate-800/50 rounded-xl border border-amber-500/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b border-slate-700/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Bulk Car Assignment</h3>
                  <p className="text-slate-400 text-sm">
                    <span className="text-amber-400 font-semibold">{totalUnassigned}</span> record{totalUnassigned !== 1 ? 's' : ''} found without a car assigned (legacy pre-multi-car data)
                  </p>
                </div>
              </div>

              {/* Target Car Selector + Assign All Button */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400 whitespace-nowrap">Assign to:</label>
                  <select
                    value={targetCarId}
                    onChange={(e) => setTargetCarId(e.target.value)}
                    disabled={isAssigning}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm min-w-[200px] focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">-- Select a car --</option>
                    {cars
                      .filter((c) => c.isActive)
                      .map((car) => {
                        const parts = [
                          car.carNumber ? `#${car.carNumber}` : '',
                          car.nickname || '',
                          car.year || '',
                          car.make,
                          car.model,
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <option key={car.id} value={car.id}>
                            {parts || 'Unnamed Car'}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <button
                  onClick={handleAssignAll}
                  disabled={!targetCarId || isAssigning || totalUnassigned === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Car className="w-4 h-4" />
                      Assign All {totalUnassigned} to Car
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isAssigning && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Assigning records...</span>
                  <span>
                    {assignProgress.current} / {assignProgress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Info Banner */}
          <div className="px-6 py-3 bg-blue-500/5 border-b border-slate-700/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300/80">
              These records were created before multi-car support was added. Click the <Eye className="w-3 h-3 inline-block mx-0.5 -mt-0.5" /> preview icon on any record to see its full details before assigning. Use the selector above to assign them all at once, or expand each section below to selectively assign individual records.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const count = unassignedCounts[section.key];
              const selectedCount = selectedIds[section.key].size;

              return (
                <div
                  key={section.key}
                  className={`${section.bgColor} border ${section.borderColor} rounded-lg p-4 cursor-pointer hover:brightness-110 transition-all`}
                  onClick={() => count > 0 && toggleSection(section.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${section.color}`} />
                      <span className="text-sm font-medium text-white">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-2xl font-bold ${count > 0 ? section.color : 'text-slate-500'}`}
                      >
                        {count}
                      </span>
                      {count > 0 && (
                        expandedSections.has(section.key) ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )
                      )}
                    </div>
                  </div>
                  {selectedCount > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedCount} selected
                    </p>
                  )}
                  {count === 0 && (
                    <p className="text-xs text-emerald-400/70 mt-1 flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" /> All assigned
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expandable Sections */}
          {SECTIONS.map((section) => {
            if (!expandedSections.has(section.key)) return null;
            const records = getUnassignedRecords(section.key);
            if (records.length === 0) return null;

            const Icon = section.icon;
            const sectionSelected = selectedIds[section.key];
            const allSelected = records.length > 0 && records.every((r) => sectionSelected.has(r.id));

            return (
              <div key={section.key} className="border-t border-slate-700/50">
                {/* Section Header with Select All */}
                <div className="px-6 py-3 bg-slate-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleAllInSection(section.key)}
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                      disabled={isAssigning}
                    >
                      {allSelected ? (
                        <CheckSquare className={`w-4 h-4 ${section.color}`} />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="font-medium">
                        {allSelected ? 'Deselect All' : 'Select All'} {section.label}
                      </span>
                    </button>
                    <span className="text-xs text-slate-500">
                      ({sectionSelected.size} of {records.length} selected)
                    </span>
                  </div>

                  {sectionSelected.size > 0 && targetCarId && (
                    <button
                      onClick={handleAssignSelected}
                      disabled={isAssigning}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Assign {sectionSelected.size} Selected
                    </button>
                  )}
                </div>

                {/* Record List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {records.map((record, idx) => {
                    const isSelected = sectionSelected.has(record.id);
                    return (
                      <div
                        key={record.id}
                        className={`px-6 py-3 flex items-start gap-3 border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors ${
                          isSelected ? 'bg-slate-700/15' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className="flex-shrink-0 mt-0.5 cursor-pointer"
                          onClick={() => !isAssigning && toggleRecord(section.key, record.id)}
                        >
                          {isSelected ? (
                            <CheckSquare className={`w-4 h-4 ${section.color}`} />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400 transition-colors" />
                          )}
                        </div>

                        {/* Record Info — clickable for selection */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => !isAssigning && toggleRecord(section.key, record.id)}
                        >
                          <p className="text-sm text-white truncate">
                            {getRecordLabel(section.key, record)}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {getRecordSubtext(section.key, record)}
                          </p>
                        </div>

                        {/* Preview Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(section.key, record);
                          }}
                          className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all group"
                          title="Preview record details"
                        >
                          <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Quick Assign Button (when car is selected) */}
                        {targetCarId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignSingle(record.id, section.key);
                            }}
                            disabled={isAssigning}
                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50 group"
                            title={`Assign to ${getCarLabel(targetCarId)}`}
                          >
                            <ArrowRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        )}

                        {/* Row number */}
                        <span className="text-[10px] text-slate-600 flex-shrink-0 mt-1">
                          #{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer: Assign Selected Button */}
          {totalSelected > 0 && (
            <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                <span className="text-white font-semibold">{totalSelected}</span> record{totalSelected !== 1 ? 's' : ''} selected across all sections
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setSelectedIds({
                      passLogs: new Set(),
                      maintenance: new Set(),
                      sfiCerts: new Set(),
                    })
                  }
                  disabled={isAssigning}
                  className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleAssignSelected}
                  disabled={!targetCarId || isAssigning}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Assign {totalSelected} Selected to Car
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* No car selected warning */}
          {!targetCarId && totalUnassigned > 0 && (
            <div className="px-6 py-3 bg-slate-800/30 border-t border-slate-700/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400/80">
                Select a car from the dropdown above to enable assignment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewRecord && previewSection && (
        <PreviewModal
          sectionKey={previewSection}
          record={previewRecord}
          onClose={closePreview}
          onAssign={handleAssignSingle}
          targetCarId={targetCarId}
          targetCarLabel={targetCarId ? getCarLabel(targetCarId) : ''}
          isAssigning={isAssigning}
        />
      )}
    </section>
  );
};

export default BulkCarAssign;
