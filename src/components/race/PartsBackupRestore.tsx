import React, { useState, useEffect, useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle2, X, RefreshCw, Database, Clock, Trash2, Download } from 'lucide-react';
import { PartInventoryItem } from '@/data/partsInventory';

const BACKUP_KEY = 'promod_parts_backup';
const BACKUP_TIMESTAMP_KEY = 'promod_parts_backup_timestamp';

export interface PartsBackup {
  parts: PartInventoryItem[];
  timestamp: number;
  count: number;
}

// Save parts backup to localStorage
export function savePartsBackup(parts: PartInventoryItem[]) {
  try {
    const backup: PartsBackup = {
      parts,
      timestamp: Date.now(),
      count: parts.length,
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
    console.log(`[PartsBackup] Saved ${parts.length} parts to localStorage backup`);
  } catch (err) {
    console.warn('[PartsBackup] Failed to save backup:', err);
  }
}

// Get the current backup from localStorage
export function getPartsBackup(): PartsBackup | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PartsBackup;
  } catch {
    return null;
  }
}

// Clear the backup
export function clearPartsBackup() {
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
}

interface PartsBackupRestoreProps {
  isOpen: boolean;
  onClose: () => void;
  currentParts: PartInventoryItem[];
  onRestore: (parts: PartInventoryItem[]) => Promise<void>;
}

const PartsBackupRestore: React.FC<PartsBackupRestoreProps> = ({ isOpen, onClose, currentParts, onRestore }) => {
  const [backup, setBackup] = useState<PartsBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoredCount, setRestoredCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setBackup(getPartsBackup());
      setRestoreComplete(false);
      setRestoredCount(0);
    }
  }, [isOpen]);

  // Find parts that are in the backup but missing from the database
  const missingParts = useMemo(() => {
    if (!backup) return [];
    const currentIds = new Set(currentParts.map(p => p.id));
    const currentPartNumbers = new Set(currentParts.map(p => p.partNumber.toLowerCase()));
    
    return backup.parts.filter(bp => {
      // Part is missing if neither its ID nor part number exists in current data
      return !currentIds.has(bp.id) && !currentPartNumbers.has(bp.partNumber.toLowerCase());
    });
  }, [backup, currentParts]);

  // Find parts that exist in both but have different data
  const modifiedParts = useMemo(() => {
    if (!backup) return [];
    const modified: { backup: PartInventoryItem; current: PartInventoryItem; changes: string[] }[] = [];
    
    for (const bp of backup.parts) {
      const current = currentParts.find(cp => cp.id === bp.id || cp.partNumber.toLowerCase() === bp.partNumber.toLowerCase());
      if (current) {
        const changes: string[] = [];
        if (current.description !== bp.description) changes.push('Description');
        if (current.onHand !== bp.onHand) changes.push(`Qty: ${current.onHand} → ${bp.onHand}`);
        if (current.unitCost !== bp.unitCost) changes.push(`Cost: $${current.unitCost} → $${bp.unitCost}`);
        if (current.vendor !== bp.vendor) changes.push('Vendor');
        if (current.location !== bp.location) changes.push('Location');
        if (changes.length > 0) {
          modified.push({ backup: bp, current, changes });
        }
      }
    }
    return modified;
  }, [backup, currentParts]);

  const handleRestore = async () => {
    if (missingParts.length === 0) return;
    setIsRestoring(true);
    try {
      await onRestore(missingParts);
      setRestoredCount(missingParts.length);
      setRestoreComplete(true);
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearBackup = () => {
    if (confirm('Are you sure you want to clear the local backup? This cannot be undone.')) {
      clearPartsBackup();
      setBackup(null);
    }
  };

  if (!isOpen) return null;

  const backupAge = backup ? Math.round((Date.now() - backup.timestamp) / 60000) : 0;
  const backupAgeText = backupAge < 60 ? `${backupAge} min ago` : backupAge < 1440 ? `${Math.round(backupAge / 60)} hrs ago` : `${Math.round(backupAge / 1440)} days ago`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" />
              Parts Backup & Restore
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Recover parts data from local backup if database save failed
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Backup Status */}
        {!backup ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">No Local Backup Found</p>
            <p className="text-slate-400 text-sm">
              Parts are automatically backed up to your browser when you add or edit them.
              <br />
              If you've recently added parts, they should appear here.
            </p>
          </div>
        ) : restoreComplete ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">Restore Complete</p>
            <p className="text-slate-400">
              Successfully restored {restoredCount} missing parts to the database.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Backup Info */}
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Local Backup</p>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {backupAgeText} | {backup.count} parts backed up
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            {/* Comparison Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">{backup.count}</p>
                <p className="text-sm text-slate-400">In Backup</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{currentParts.length}</p>
                <p className="text-sm text-slate-400">In Database</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${missingParts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {missingParts.length}
                </p>
                <p className="text-sm text-slate-400">Missing from DB</p>
              </div>
            </div>

            {/* Missing Parts */}
            {missingParts.length > 0 && (
              <div className="mb-6">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Missing Parts ({missingParts.length}) — Not in Database
                </h4>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-700">
                        <th className="text-left px-3 py-2 text-slate-400">Description</th>
                        <th className="text-left px-3 py-2 text-slate-400">Part #</th>
                        <th className="text-left px-3 py-2 text-slate-400">Category</th>
                        <th className="text-center px-3 py-2 text-slate-400">Qty</th>
                        <th className="text-right px-3 py-2 text-slate-400">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingParts.map((part, idx) => (
                        <tr key={idx} className="border-b border-slate-700/30">
                          <td className="px-3 py-2 text-white">{part.description}</td>
                          <td className="px-3 py-2 text-orange-400 font-mono">{part.partNumber}</td>
                          <td className="px-3 py-2 text-slate-300">{part.category}</td>
                          <td className="px-3 py-2 text-center text-white">{part.onHand}</td>
                          <td className="px-3 py-2 text-right text-white">${part.unitCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modified Parts */}
            {modifiedParts.length > 0 && (
              <div className="mb-6">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-yellow-400" />
                  Modified Parts ({modifiedParts.length}) — Different from Backup
                </h4>
                <div className="space-y-2">
                  {modifiedParts.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <div>
                        <p className="text-white text-sm font-medium">{item.current.description}</p>
                        <p className="text-xs text-slate-400">{item.current.partNumber}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.changes.map((change, ci) => (
                          <span key={ci} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                            {change}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Issues */}
            {missingParts.length === 0 && modifiedParts.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white text-lg font-medium">All Parts Synced</p>
                <p className="text-slate-400 text-sm mt-1">
                  All {backup.count} backed-up parts are present in the database. No restore needed.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                Close
              </button>
              {missingParts.length > 0 && (
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRestoring ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Restore {missingParts.length} Missing Parts
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PartsBackupRestore;
