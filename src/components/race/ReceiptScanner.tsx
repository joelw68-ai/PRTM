import React, { useState, useRef, useCallback } from 'react';
import {
  Camera, Upload, X, Loader2, CheckCircle2, AlertTriangle,
  Scan, FileImage, RotateCcw, Zap, Eye, ChevronDown, ChevronUp,
  Info, Shield, ShieldAlert, ShieldCheck, ShieldQuestion
} from 'lucide-react';
import { processReceipt, getConfidenceLabel, OcrResult, OcrProgress } from '@/lib/receiptOcr';

// ===== TYPES =====
export interface ScannedData {
  amount?: string;
  date?: string;
  vendor?: string;
}

interface ReceiptScannerProps {
  onScanComplete: (data: ScannedData, file: File) => void;
  onCancel?: () => void;
  className?: string;
}

// ===== CONFIDENCE BADGE =====
const ConfidenceBadge: React.FC<{ confidence: number; size?: 'sm' | 'md' }> = ({ confidence, size = 'sm' }) => {
  const { label, color, bgColor } = getConfidenceLabel(confidence);
  const Icon = confidence >= 85 ? ShieldCheck : confidence >= 60 ? Shield : confidence >= 30 ? ShieldAlert : ShieldQuestion;

  return (
    <div className={`flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${color}`} />
      <div className="flex items-center gap-1.5">
        <div className={`${size === 'sm' ? 'w-12 h-1.5' : 'w-16 h-2'} bg-slate-700 rounded-full overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${bgColor}`}
            style={{ width: `${Math.min(confidence, 100)}%` }}
          />
        </div>
        <span className={`font-medium ${color}`}>
          {confidence}% {label}
        </span>
      </div>
    </div>
  );
};

// ===== MAIN COMPONENT =====
const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onScanComplete, onCancel, className = '' }) => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  // Editable fields from scan results
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editVendor, setEditVendor] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select an image file (JPEG, PNG, WebP, GIF, BMP). PDFs cannot be scanned for text.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image must be less than 15MB.');
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScannedFile(file);
    setError(null);
    setResult(null);
    setScanning(true);
    setProgress({ status: 'Starting...', progress: 0 });

    try {
      const ocrResult = await processReceipt(file, (p) => {
        setProgress(p);
      });

      setResult(ocrResult);

      // Pre-fill editable fields
      setEditAmount(ocrResult.amount?.value || '');
      setEditDate(ocrResult.date?.value || '');
      setEditVendor(ocrResult.vendor?.value || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [handleFileSelected]);

  const handleApply = useCallback(() => {
    if (!scannedFile) return;
    const data: ScannedData = {};
    if (editAmount) data.amount = editAmount;
    if (editDate) data.date = editDate;
    if (editVendor) data.vendor = editVendor;
    onScanComplete(data, scannedFile);
  }, [editAmount, editDate, editVendor, scannedFile, onScanComplete]);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setScannedFile(null);
    setResult(null);
    setError(null);
    setEditAmount('');
    setEditDate('');
    setEditVendor('');
    setShowRawText(false);
  }, [previewUrl]);

  // ===== INITIAL STATE: No file selected =====
  if (!previewUrl && !scanning) {
    return (
      <div className={`${className}`}>
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="bg-gradient-to-br from-violet-500/10 to-blue-500/10 rounded-xl border-2 border-dashed border-violet-500/30 p-6">
          <div className="text-center mb-4">
            <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Scan className="w-7 h-7 text-violet-400" />
            </div>
            <h4 className="text-white font-semibold text-lg">Scan Receipt</h4>
            <p className="text-slate-400 text-sm mt-1">
              Take a photo or upload a receipt image to auto-extract amount, date, and vendor
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* Camera button - primarily for mobile */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>

            {/* File picker button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors border border-slate-600"
            >
              <Upload className="w-5 h-5" />
              Upload Image
            </button>
          </div>

          <div className="flex items-start gap-2 mt-4 p-3 bg-slate-800/50 rounded-lg">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              For best results, ensure the receipt is well-lit, flat, and the text is clearly visible.
              Supported formats: JPEG, PNG, WebP, GIF. Max 15MB.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ===== SCANNING STATE =====
  if (scanning) {
    return (
      <div className={`${className}`}>
        <div className="bg-slate-800/80 rounded-xl border border-violet-500/30 p-6">
          <div className="flex items-center gap-4 mb-4">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-20 h-20 object-cover rounded-lg border border-slate-600"
              />
            )}
            <div className="flex-1">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                Scanning Receipt...
              </h4>
              <p className="text-slate-400 text-sm mt-1">
                {progress?.status || 'Processing...'}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress?.progress || 0) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 text-right">
            {Math.round((progress?.progress || 0) * 100)}%
          </p>
        </div>
      </div>
    );
  }

  // ===== RESULTS STATE =====
  return (
    <div className={`${className}`}>
      <div className="bg-slate-800/80 rounded-xl border border-violet-500/30 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-violet-500/10 to-blue-500/10 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
                {result && result.overallConfidence >= 50 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
              </div>
              <div>
                <h4 className="text-white font-semibold">Scan Results</h4>
                {result && (
                  <div className="mt-0.5">
                    <ConfidenceBadge confidence={result.overallConfidence} size="sm" />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rescan
            </button>
          </div>
          {result && (
            <p className="text-xs text-slate-500 mt-2">
              Processed in {(result.processingTimeMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Preview thumbnail */}
          {previewUrl && (
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
              <img
                src={previewUrl}
                alt="Scanned receipt"
                className="w-16 h-16 object-cover rounded-lg border border-slate-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{scannedFile?.name}</p>
                <p className="text-xs text-slate-500">
                  {scannedFile ? `${(scannedFile.size / 1024).toFixed(0)} KB` : ''}
                </p>
              </div>
              <FileImage className="w-5 h-5 text-slate-500" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Extracted Fields */}
          {result && (
            <div className="space-y-3">
              {/* Amount */}
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    Amount
                  </label>
                  {result.amount ? (
                    <ConfidenceBadge confidence={result.amount.confidence} />
                  ) : (
                    <span className="text-xs text-slate-600 italic">Not detected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg font-semibold focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                  />
                </div>
                {result.amount?.rawMatch && (
                  <p className="text-xs text-slate-600 mt-1 truncate" title={result.amount.rawMatch}>
                    Matched: "{result.amount.rawMatch}"
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    Date
                  </label>
                  {result.date ? (
                    <ConfidenceBadge confidence={result.date.confidence} />
                  ) : (
                    <span className="text-xs text-slate-600 italic">Not detected</span>
                  )}
                </div>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                />
                {result.date?.rawMatch && (
                  <p className="text-xs text-slate-600 mt-1 truncate" title={result.date.rawMatch}>
                    Matched: "{result.date.rawMatch}"
                  </p>
                )}
              </div>

              {/* Vendor */}
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    Vendor / Store Name
                  </label>
                  {result.vendor ? (
                    <ConfidenceBadge confidence={result.vendor.confidence} />
                  ) : (
                    <span className="text-xs text-slate-600 italic">Not detected</span>
                  )}
                </div>
                <input
                  type="text"
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  placeholder="Store or vendor name"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                />
                {result.vendor?.rawMatch && (
                  <p className="text-xs text-slate-600 mt-1 truncate" title={result.vendor.rawMatch}>
                    Matched: "{result.vendor.rawMatch}"
                  </p>
                )}
              </div>

              {/* Raw Text Toggle */}
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors w-full"
              >
                <Eye className="w-4 h-4" />
                {showRawText ? 'Hide' : 'Show'} Raw OCR Text
                {showRawText ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>

              {showRawText && (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700/50 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">
                    {result.rawText || 'No text extracted'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button
                onClick={() => { handleReset(); onCancel(); }}
                className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleApply}
              disabled={!editAmount && !editDate && !editVendor}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply to Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
