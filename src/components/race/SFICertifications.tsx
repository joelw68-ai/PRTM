import React, { useState, useMemo } from 'react';
import { getLocalDateString, parseLocalDate } from '@/lib/utils';
import DateInputDark from '@/components/ui/DateInputDark';
import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import { SFICertification } from '@/data/proModData';
import { loadSFIAlertSettings, getEffectiveThresholdsForCert } from '@/lib/sfiAlerts';

import {
  AlertTriangle,
  Shield,
  Plus,
  Edit2,
  Trash2,
  X,
  Download,
} from 'lucide-react';

interface SFICertificationsProps {
  onNavigate?: (section: string) => void;
  currentRole?: CrewRole;
}

const SFICertifications: React.FC<SFICertificationsProps> = () => {
  const {
    sfiCertifications,
    addSFICertification,
    updateSFICertification,
    deleteSFICertification,
    vendors: allVendors,
  } = useApp();

  const [showSFIModal, setShowSFIModal] = useState(false);
  const [editingSFI, setEditingSFI] = useState<SFICertification | null>(null);

  // SFI certifications (no car filter — single-car app)
  const filteredSfiCertifications = sfiCertifications;

  const sortedCertifications = [...filteredSfiCertifications].sort((a, b) =>
    a.daysUntilExpiration - b.daysUntilExpiration
  );

  // Global SFI alert thresholds (enabled only), used for the CSV export.
  const globalEnabledThresholds = useMemo(() => {
    const settings = loadSFIAlertSettings();
    return settings.thresholds.filter(t => t.enabled).sort((a, b) => a.days - b.days);
  }, []);

  // Default new SFI certification
  const defaultSFI: SFICertification = {
    id: '',
    item: '',
    sfiSpec: '',
    certificationDate: getLocalDateString(),
    expirationDate: getLocalDateString(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2)),
    vendor: '',
    serialNumber: '',
    status: 'Valid',
    daysUntilExpiration: 730,
    notes: '',
    threshold: 30,
  };

  const [newSFI, setNewSFI] = useState<SFICertification>(defaultSFI);
  const [sfiThresholdError, setSfiThresholdError] = useState<string | null>(null);

  const vendorsList = useMemo(() => allVendors.filter(v => v.isActive), [allVendors]);

  const calculateSFIStatus = (
    expirationDate: string,
    threshold?: number
  ): { status: SFICertification['status'], daysUntilExpiration: number } => {
    const expDate = parseLocalDate(expirationDate);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const alertDays = threshold != null && threshold >= 0 ? threshold : 60;

    let status: SFICertification['status'] = 'Valid';
    if (diffDays <= 0) status = 'Expired';
    else if (diffDays <= alertDays) status = 'Expiring Soon';

    return { status, daysUntilExpiration: diffDays };
  };

  const handleSaveSFI = async () => {
    const thr = newSFI.threshold;
    if (thr === undefined || thr === null || !Number.isFinite(thr) || thr < 1) {
      setSfiThresholdError('Threshold is required and must be at least 1 day.');
      return;
    }
    setSfiThresholdError(null);

    try {
      const { status, daysUntilExpiration } = calculateSFIStatus(newSFI.expirationDate, thr);
      const sfiToSave: SFICertification = {
        ...newSFI,
        status,
        daysUntilExpiration,
        threshold: thr,
        alertThresholdDays: undefined,
      };

      if (editingSFI) {
        await updateSFICertification(editingSFI.id, sfiToSave);
      } else {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? `SFI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
          : `SFI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await addSFICertification({ ...sfiToSave, id });
      }
    } catch (error) {
      console.error('Error saving SFI certification:', error);
    } finally {
      setShowSFIModal(false);
      setEditingSFI(null);
      setNewSFI(defaultSFI);
      setSfiThresholdError(null);
    }
  };

  const handleDeleteSFI = async (id: string) => {
    if (confirm('Are you sure you want to delete this SFI certification?')) {
      await deleteSFICertification(id);
    }
  };

  const handleExportSFICSV = () => {
    if (sortedCertifications.length === 0) {
      alert('There are no SFI certifications to export.');
      return;
    }

    const escapeCsv = (val: unknown): string => {
      const s = val === null || val === undefined ? '' : String(val);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const formatThresholds = (cert: SFICertification): string => {
      const effective = getEffectiveThresholdsForCert(cert, globalEnabledThresholds);
      if (effective.length === 0) return 'None';
      return effective
        .map(t => `${t.days <= 0 ? 'Expired' : `${t.days}d`} (${t.severity})`)
        .join('; ');
    };

    const headers = [
      'Item',
      'SFI Spec',
      'Vendor',
      'Serial Number',
      'Certification Date',
      'Expiration Date',
      'Days Remaining',
      'Status',
      'Alert Threshold Source',
      'Effective Alert Thresholds',
      'Notes',
    ];

    const rows = sortedCertifications.map(cert => {
      const isCustom = !!(cert.alertThresholdDays && cert.alertThresholdDays.length > 0);
      return [
        cert.item,
        cert.sfiSpec,
        cert.vendor,
        cert.serialNumber,
        cert.certificationDate,
        cert.expirationDate,
        cert.daysUntilExpiration <= 0 ? 'EXPIRED' : cert.daysUntilExpiration,
        cert.status,
        isCustom ? 'Custom' : 'Global',
        formatThresholds(cert),
        cert.notes || '',
      ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sfi-certifications-${getLocalDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSFIStatusColor = (status: string) => {
    switch (status) {
      case 'Expired': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Expiring Soon': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Valid': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-orange-400" />
              SFI Certifications
            </h2>
            <p className="text-slate-400">Track SFI safety certifications and expiration alerts</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportSFICSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sortedCertifications.length === 0}
              title="Export all certifications to a CSV file for tech-inspection records"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => {
                setEditingSFI(null);
                setNewSFI(defaultSFI);
                setSfiThresholdError(null);
                setShowSFIModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Certification
            </button>
          </div>
        </div>

        {/* SFI Alert Banner */}
        {filteredSfiCertifications.some(c => c.daysUntilExpiration <= 0) && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="font-semibold text-red-400">EXPIRED CERTIFICATIONS</h3>
                <p className="text-red-300 text-sm">
                  {filteredSfiCertifications.filter(c => c.daysUntilExpiration <= 0).map(c => c.item).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {sortedCertifications.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No SFI certifications yet</p>
            <p className="text-slate-500 text-sm mb-4">Add your first certification to start tracking expiration dates.</p>
            <button
              onClick={() => {
                setEditingSFI(null);
                setNewSFI(defaultSFI);
                setSfiThresholdError(null);
                setShowSFIModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Certification
            </button>
          </div>
        ) : (
          /* SFI Certifications Grid */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCertifications.map((cert) => (
              <div
                key={cert.id}
                className={`bg-slate-800/50 rounded-xl border p-4 ${
                  cert.daysUntilExpiration <= 0 ? 'border-red-500/50' :
                  cert.daysUntilExpiration <= 60 ? 'border-yellow-500/50' :
                  'border-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{cert.item}</h3>
                    <p className="text-sm text-slate-400">{cert.sfiSpec}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getSFIStatusColor(cert.status)}`}>
                      {cert.status}
                    </span>
                    <button
                      onClick={() => {
                        setEditingSFI(cert);
                        setNewSFI({ ...cert, threshold: cert.threshold ?? 30 });
                        setSfiThresholdError(null);
                        setShowSFIModal(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSFI(cert.id)}
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vendor</span>
                    <span className="text-white">{cert.vendor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Serial #</span>
                    <span className="text-white font-mono text-xs">{cert.serialNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Certified</span>
                    <span className="text-white">{cert.certificationDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expires</span>
                    <span className={cert.daysUntilExpiration <= 0 ? 'text-red-400 font-bold' : 'text-white'}>
                      {cert.expirationDate}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span className="text-slate-400">Days Remaining</span>
                    <span className={`font-bold ${
                      cert.daysUntilExpiration <= 0 ? 'text-red-400' :
                      cert.daysUntilExpiration <= 30 ? 'text-orange-400' :
                      cert.daysUntilExpiration <= 60 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {cert.daysUntilExpiration <= 0 ? 'EXPIRED' : cert.daysUntilExpiration}
                    </span>
                  </div>

                  {/* Alert Threshold — single days-before-expiration value */}
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
                      Alert Threshold
                    </span>
                    {cert.threshold != null ? (
                      <span className="text-cyan-300 font-medium">
                        {cert.threshold} day{cert.threshold === 1 ? '' : 's'} before
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Not set</span>
                    )}
                  </div>
                </div>

                {cert.notes && (
                  <p className="mt-3 text-xs text-slate-400 italic">{cert.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SFI Modal */}
      {showSFIModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingSFI ? 'Edit SFI Certification' : 'Add SFI Certification'}
              </h3>
              <button onClick={() => { setShowSFIModal(false); setSfiThresholdError(null); }} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newSFI.item}
                  onChange={(e) => setNewSFI({...newSFI, item: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Seat Belts (5-point)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">SFI Spec</label>
                  <input
                    type="text"
                    value={newSFI.sfiSpec}
                    onChange={(e) => setNewSFI({...newSFI, sfiSpec: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., SFI 16.1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                  <select
                    value={newSFI.vendor}
                    onChange={(e) => setNewSFI({...newSFI, vendor: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select vendor</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}{v.category ? ` (${v.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={newSFI.serialNumber}
                  onChange={(e) => setNewSFI({...newSFI, serialNumber: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Certification Date</label>
                  <DateInputDark
                    value={newSFI.certificationDate}
                    onChange={(e) => setNewSFI({...newSFI, certificationDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Expiration Date</label>
                  <DateInputDark
                    value={newSFI.expirationDate}
                    onChange={(e) => setNewSFI({...newSFI, expirationDate: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={newSFI.notes}
                  onChange={(e) => setNewSFI({...newSFI, notes: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {/* Alert Threshold */}
              <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-lg p-4">
                <label className="text-sm font-medium text-cyan-300 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-cyan-400" />
                  Threshold (days before alert) *
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Required. The number of days before the expiration date at which this
                  certification begins alerting (becomes "Expiring Soon" and fires bell/toast
                  reminders). Alerts depend entirely on this value.
                </p>
                <input
                  type="number"
                  min={1}
                  value={newSFI.threshold ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? undefined : parseInt(raw, 10);
                    setNewSFI({
                      ...newSFI,
                      threshold: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
                    });
                    if (parsed !== undefined && Number.isFinite(parsed) && parsed >= 1) {
                      setSfiThresholdError(null);
                    }
                  }}
                  placeholder="e.g., 30"
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white ${
                    sfiThresholdError ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {sfiThresholdError ? (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {sfiThresholdError}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] text-slate-500">Quick set:</span>
                    {[90, 60, 30, 14].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => { setNewSFI({ ...newSFI, threshold: days }); setSfiThresholdError(null); }}
                        className={`px-2 py-1 text-[11px] rounded transition-colors ${
                          newSFI.threshold === days
                            ? 'bg-cyan-500/40 text-cyan-200'
                            : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowSFIModal(false); setSfiThresholdError(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSFI}
                disabled={!newSFI.item}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSFI ? 'Save Changes' : 'Add Certification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SFICertifications;
