import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Download, Table } from 'lucide-react';
import { PartInventoryItem } from '@/data/partsInventory';
import { getLocalDateString } from '@/lib/utils';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (parts: PartInventoryItem[]) => Promise<void>;
  existingParts: PartInventoryItem[];
}

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Partial<PartInventoryItem>;
  error?: string;
  status: 'pending' | 'importing' | 'success' | 'error';
}

// Standard columns we expect
const EXPECTED_COLUMNS = [
  { key: 'description', label: 'Description', required: true },
  { key: 'partNumber', label: 'Part Number', required: true },
  { key: 'category', label: 'Category', required: false },
  { key: 'onHand', label: 'Quantity', required: false },
  { key: 'unitCost', label: 'Unit Cost', required: false },
  { key: 'vendor', label: 'Vendor', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'subcategory', label: 'Subcategory', required: false },
  { key: 'minQuantity', label: 'Min Quantity', required: false },
  { key: 'maxQuantity', label: 'Max Quantity', required: false },
  { key: 'vendorPartNumber', label: 'Vendor Part #', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const VALID_CATEGORIES = [
  'Engine', 'Drivetrain', 'Ty-Drive', 'Quick Drive', 'Transmission',
  'Fuel System', 'Electrical', 'Suspension', 'Brakes', 'Safety',
  'Body', 'Wheels/Tires', 'Supercharger'
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => parseRow(line));
  return { headers, rows };
}

function autoMapColumns(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = csvHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  for (const col of EXPECTED_COLUMNS) {
    const colLower = col.label.toLowerCase().replace(/[^a-z0-9]/g, '');
    const keyLower = col.key.toLowerCase();

    const idx = lowerHeaders.findIndex(h =>
      h === colLower || h === keyLower ||
      h.includes(colLower) || colLower.includes(h) ||
      h.includes(keyLower) || keyLower.includes(h)
    );

    if (idx >= 0) {
      mapping[col.key] = csvHeaders[idx];
    }
  }

  return mapping;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImport, existingParts }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; skipped: number }>({ success: 0, errors: 0, skipped: 0 });
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const reset = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setParsedRows([]);
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0, skipped: 0 });
    setFileName('');
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      alert('Please upload a CSV file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        alert('CSV file appears to be empty.');
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      const autoMapping = autoMapColumns(headers);
      setColumnMapping(autoMapping);
      setStep('mapping');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleMappingChange = (targetKey: string, csvHeader: string) => {
    setColumnMapping(prev => ({ ...prev, [targetKey]: csvHeader }));
  };

  const processMapping = () => {
    const rows: ParsedRow[] = csvRows.map((row, idx) => {
      const raw: Record<string, string> = {};
      csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });

      const getValue = (key: string): string => {
        const csvCol = columnMapping[key];
        if (!csvCol) return '';
        const colIdx = csvHeaders.indexOf(csvCol);
        return colIdx >= 0 ? (row[colIdx] || '').trim() : '';
      };

      const description = getValue('description');
      const partNumber = getValue('partNumber');

      let error: string | undefined;
      if (!description && !partNumber) {
        error = 'Missing both description and part number';
      }

      const onHand = parseInt(getValue('onHand')) || 0;
      const unitCost = parseFloat(getValue('unitCost')?.replace(/[$,]/g, '')) || 0;
      const minQty = parseInt(getValue('minQuantity')) || 1;
      const maxQty = parseInt(getValue('maxQuantity')) || 10;
      const category = getValue('category') || 'Engine';

      const status: PartInventoryItem['status'] = onHand === 0 ? 'Out of Stock' : onHand <= minQty ? 'Low Stock' : 'In Stock';
      const reorderStatus: PartInventoryItem['reorderStatus'] = onHand === 0 ? 'Critical' : onHand <= minQty ? 'Reorder' : 'OK';

      const mapped: Partial<PartInventoryItem> = {
        description: description || `Part ${idx + 1}`,
        partNumber: partNumber || '',
        category: VALID_CATEGORIES.includes(category) ? category : 'Engine',
        subcategory: getValue('subcategory'),
        onHand,
        minQuantity: minQty,
        maxQuantity: maxQty,
        unitCost,
        totalValue: onHand * unitCost,
        vendor: getValue('vendor'),
        vendorPartNumber: getValue('vendorPartNumber'),
        location: getValue('location'),
        notes: getValue('notes'),
        lastOrdered: getLocalDateString(),
        lastUsed: '',
        status,
        reorderStatus,
      };

      return { rowIndex: idx + 2, raw, mapped, error, status: error ? 'error' as const : 'pending' as const };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => !r.error);
    if (validRows.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    const partsToImport: PartInventoryItem[] = [];
    let success = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Check for duplicates
        const isDuplicate = existingParts.some(
          p => p.partNumber && row.mapped.partNumber && p.partNumber.toLowerCase() === row.mapped.partNumber!.toLowerCase()
        );

        if (isDuplicate && row.mapped.partNumber) {
          row.status = 'error';
          row.error = `Duplicate part number: ${row.mapped.partNumber}`;
          skipped++;
        } else {
          const id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? `PART-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
            : `PART-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

          partsToImport.push({
            id,
            partNumber: row.mapped.partNumber || '',
            description: row.mapped.description || '',
            category: row.mapped.category || 'Engine',
            subcategory: row.mapped.subcategory || '',
            onHand: row.mapped.onHand || 0,
            minQuantity: row.mapped.minQuantity || 1,
            maxQuantity: row.mapped.maxQuantity || 10,
            unitCost: row.mapped.unitCost || 0,
            totalValue: row.mapped.totalValue || 0,
            vendor: row.mapped.vendor || '',
            vendorPartNumber: row.mapped.vendorPartNumber || '',
            lastOrdered: row.mapped.lastOrdered || getLocalDateString(),
            lastUsed: '',
            location: row.mapped.location || '',
            status: row.mapped.status || 'In Stock',
            reorderStatus: row.mapped.reorderStatus || 'OK',
            notes: row.mapped.notes || '',
          });
          row.status = 'success';
          success++;
        }
      } catch (err: any) {
        row.status = 'error';
        row.error = err?.message || 'Unknown error';
        errors++;
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
      setParsedRows([...parsedRows]);
    }

    if (partsToImport.length > 0) {
      try {
        await onImport(partsToImport);
      } catch (err: any) {
        errors += partsToImport.length;
        success = 0;
      }
    }

    setImportResults({ success, errors, skipped });
    setStep('complete');
  };

  const downloadTemplate = () => {
    const headers = 'Description,Part Number,Category,Quantity,Unit Cost,Vendor,Location,Subcategory,Min Quantity,Max Quantity,Vendor Part #,Notes';
    const example = '"CP Carrillo Piston Set","ENG-PISTON-001","Engine","4","1250.00","CP Carrillo","Trailer - Shelf A3","Pistons","2","8","CP-8765","Custom forged pistons"';
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parts_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const validCount = parsedRows.filter(r => !r.error).length;
  const errorCount = parsedRows.filter(r => r.error).length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-4xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="w-6 h-6 text-orange-400" />
              Import Parts from CSV
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {step === 'upload' && 'Upload a CSV file to bulk-import parts'}
              {step === 'mapping' && 'Map CSV columns to part fields'}
              {step === 'preview' && `Preview ${validCount} parts ready to import`}
              {step === 'importing' && 'Importing parts...'}
              {step === 'complete' && 'Import complete'}
            </p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {['Upload', 'Map Columns', 'Preview', 'Import'].map((label, idx) => {
            const stepIdx = ['upload', 'mapping', 'preview', 'importing'].indexOf(step);
            const isActive = idx <= stepIdx || step === 'complete';
            return (
              <React.Fragment key={label}>
                {idx > 0 && <ArrowRight className="w-4 h-4 text-slate-600" />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700/50 text-slate-500'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-400'
                  }`}>{idx + 1}</span>
                  {label}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div>
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-slate-600 hover:border-slate-500'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <p className="text-white text-lg font-medium mb-2">Drop your CSV file here</p>
              <p className="text-slate-400 text-sm mb-4">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                Choose File
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-slate-500 text-sm">
                Supported format: CSV with headers. Max recommended: 500 rows.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
          </div>
        )}

        {/* Mapping Step */}
        {step === 'mapping' && (
          <div>
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4 flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-white font-medium">{fileName}</p>
                <p className="text-sm text-slate-400">{csvRows.length} rows, {csvHeaders.length} columns detected</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-400">Map your CSV columns to the corresponding part fields:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {EXPECTED_COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                    <div className="flex-1">
                      <label className="text-sm text-slate-300 font-medium">
                        {col.label}
                        {col.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                    </div>
                    <select
                      value={columnMapping[col.key] || ''}
                      onChange={(e) => handleMappingChange(col.key, e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
                    >
                      <option value="">-- Skip --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('upload')} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                Back
              </button>
              <button
                onClick={processMapping}
                disabled={!columnMapping.description && !columnMapping.partNumber}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview Import
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {validCount} valid
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {errorCount} errors
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-3 py-2 text-slate-400">Row</th>
                    <th className="text-left px-3 py-2 text-slate-400">Description</th>
                    <th className="text-left px-3 py-2 text-slate-400">Part #</th>
                    <th className="text-left px-3 py-2 text-slate-400">Category</th>
                    <th className="text-center px-3 py-2 text-slate-400">Qty</th>
                    <th className="text-right px-3 py-2 text-slate-400">Cost</th>
                    <th className="text-left px-3 py-2 text-slate-400">Vendor</th>
                    <th className="text-center px-3 py-2 text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={`border-b border-slate-700/30 ${row.error ? 'bg-red-500/5' : ''}`}>
                      <td className="px-3 py-2 text-slate-500">{row.rowIndex}</td>
                      <td className="px-3 py-2 text-white truncate max-w-[200px]">{row.mapped.description}</td>
                      <td className="px-3 py-2 text-orange-400 font-mono">{row.mapped.partNumber}</td>
                      <td className="px-3 py-2 text-slate-300">{row.mapped.category}</td>
                      <td className="px-3 py-2 text-center text-white">{row.mapped.onHand}</td>
                      <td className="px-3 py-2 text-right text-white">${(row.mapped.unitCost || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-300 truncate max-w-[120px]">{row.mapped.vendor}</td>
                      <td className="px-3 py-2 text-center">
                        {row.error ? (
                          <span className="text-red-400 text-xs" title={row.error}>
                            <AlertTriangle className="w-4 h-4 inline" />
                          </span>
                        ) : (
                          <span className="text-green-400 text-xs">
                            <CheckCircle2 className="w-4 h-4 inline" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 100 && (
                <p className="text-center text-slate-500 text-sm py-2">
                  Showing first 100 of {parsedRows.length} rows
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('mapping')} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import {validCount} Parts
              </button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-orange-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Importing Parts...</p>
            <p className="text-slate-400 text-sm mb-6">Please do not close this window</p>
            <div className="max-w-md mx-auto">
              <div className="bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-slate-400 text-sm mt-2">{importProgress}% complete</p>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">Import Complete</p>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{importResults.success}</p>
                <p className="text-sm text-slate-400">Imported</p>
              </div>
              {importResults.skipped > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{importResults.skipped}</p>
                  <p className="text-sm text-slate-400">Skipped (duplicates)</p>
                </div>
              )}
              {importResults.errors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{importResults.errors}</p>
                  <p className="text-sm text-slate-400">Errors</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 max-w-md mx-auto">
              <button
                onClick={() => { reset(); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Import More
              </button>
              <button
                onClick={() => { reset(); onClose(); }}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImportModal;
