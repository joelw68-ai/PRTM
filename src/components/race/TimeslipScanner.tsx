import React, { useState, useRef, useCallback } from 'react';
import { preprocessImage } from '@/lib/receiptOcr';
import Tesseract from 'tesseract.js';
import {
  Camera,
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Eye,
  RotateCcw,
  Scan,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface TimeslipField {
  value: number;
  confidence: number; // 0-100
  rawMatch: string;   // the raw text line that matched
  label: string;      // human-readable field name
}

export interface TimeslipData {
  reactionTime?: TimeslipField;
  sixtyFoot?: TimeslipField;
  threeThirty?: TimeslipField;
  eighthET?: TimeslipField;
  eighthMPH?: TimeslipField;
  quarterET?: TimeslipField;
  quarterMPH?: TimeslipField;
  dialIn?: TimeslipField;
  lane?: string;
  rawText: string;
  overallConfidence: number;
  processingTimeMs: number;
  fieldsFound: number;
  totalFields: number;
}

interface TimeslipScannerProps {
  onApply: (data: {
    reactionTime?: number;
    sixtyFoot?: number;
    threeThirty?: number;
    eighth?: number;
    mph?: number;
    quarterMileET?: number;
    quarterMileMPH?: number;
  }) => void;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// TIMESLIP TEXT PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse OCR text from a drag strip timeslip and extract performance fields.
 *
 * Timeslips vary by track and timing system (Compulink, Portatree, etc.)
 * but generally follow patterns like:
 *   R.T.    .0234
 *   60'     1.023
 *   330     3.123
 *   1/8     3.789
 *   MPH     198.23
 *   1000    5.234
 *   1/4     5.789
 *   MPH     245.67
 *
 * Some timeslips use "E.T." labels, some use "ELAPSED TIME", etc.
 * We try multiple patterns and pick the best match for each field.
 */
function parseTimeslipText(rawText: string): Omit<TimeslipData, 'processingTimeMs'> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = rawText.toUpperCase();

  // Helper: find a number near a label pattern
  const findNumberNearLabel = (
    patterns: RegExp[],
    minVal: number,
    maxVal: number,
    baseConfidence: number
  ): TimeslipField | undefined => {
    for (const pattern of patterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          // Try to extract the number from capture groups
          const numStr = match[1] || match[2] || match[3];
          if (numStr) {
            const num = parseFloat(numStr.replace(/[oO]/g, '0').replace(/[lI]/g, '1'));
            if (!isNaN(num) && num >= minVal && num <= maxVal) {
              return {
                value: num,
                confidence: baseConfidence,
                rawMatch: line,
                label: '',
              };
            }
          }
        }
      }
    }
    return undefined;
  };

  // ── REACTION TIME ──
  // RT is typically 0.000-0.999 or negative for foul starts (-0.001 to -0.999)
  // Labels: "R.T.", "RT", "REACTION", "R/T", "REACT"
  const rt = findNumberNearLabel(
    [
      /(?:R\.?\s*T\.?|REACT(?:ION)?|R\s*\/\s*T)\s*[:\s]*(-?\d*\.?\d{1,4})/i,
      /(-?\.\d{3,4})\s*(?:R\.?\s*T\.?|REACT)/i,
      // Standalone .XXXX at start of line (common for RT)
      /^[:\s]*(-?\.\d{3,4})\s*$/i,
    ],
    -1.0, 1.0, 90
  );
  if (rt) rt.label = 'Reaction Time';

  // ── 60' TIME ──
  // Typically 0.900-1.300 for Pro Mod
  // Labels: "60'", "60FT", "60 FT", "SIXTY"
  const sixtyFoot = findNumberNearLabel(
    [
      /(?:60\s*['']?\s*(?:FT|FOOT)?|SIXTY)\s*[:\s]*(\d+\.\d{2,4})/i,
      /(\d+\.\d{2,4})\s*(?:60\s*['']|60\s*FT|SIXTY)/i,
    ],
    0.5, 2.5, 88
  );
  if (sixtyFoot) sixtyFoot.label = "60' Time";

  // ── 330' TIME ──
  // Typically 2.5-4.5 for Pro Mod
  // Labels: "330'", "330", "330FT"
  const threeThirty = findNumberNearLabel(
    [
      /(?:330\s*['']?\s*(?:FT|FOOT)?)\s*[:\s]*(\d+\.\d{2,4})/i,
      /(\d+\.\d{2,4})\s*(?:330\s*['']|330\s*FT)/i,
    ],
    1.5, 6.0, 85
  );
  if (threeThirty) threeThirty.label = "330' Time";

  // ── 1/8 MILE ET ──
  // Typically 3.5-7.0 for Pro Mod (1/8 mile)
  // Labels: "1/8", "660'", "660", "EIGHTH"
  const eighthET = findNumberNearLabel(
    [
      /(?:1\s*\/\s*8|660\s*['']?\s*(?:FT)?|EIGHTH)\s*[:\s]*(\d+\.\d{2,4})/i,
      /(\d+\.\d{2,4})\s*(?:1\s*\/\s*8|660|EIGHTH)/i,
      // "E.T." label near a time value in the 1/8 mile range
      /(?:E\.?\s*T\.?)\s*[:\s]*(\d+\.\d{2,4})/i,
    ],
    2.0, 10.0, 85
  );
  if (eighthET) eighthET.label = '1/8 Mile ET';

  // ── 1/8 MILE MPH ──
  // Typically 100-250 for Pro Mod
  // Labels: "MPH" (first occurrence after 1/8 ET)
  const eighthMPH = findNumberNearLabel(
    [
      /(?:MPH|SPEED)\s*[:\s]*(\d{2,3}\.\d{1,3})/i,
      /(\d{2,3}\.\d{1,3})\s*(?:MPH|SPEED)/i,
    ],
    50, 300, 82
  );
  if (eighthMPH) eighthMPH.label = '1/8 Mile MPH';

  // ── 1/4 MILE ET ──
  // Typically 5.5-12.0
  // Labels: "1/4", "1320'", "1320", "QUARTER"
  const quarterET = findNumberNearLabel(
    [
      /(?:1\s*\/\s*4|1320\s*['']?\s*(?:FT)?|QUARTER)\s*[:\s]*(\d+\.\d{2,4})/i,
      /(\d+\.\d{2,4})\s*(?:1\s*\/\s*4|1320|QUARTER)/i,
    ],
    4.0, 20.0, 80
  );
  if (quarterET) quarterET.label = '1/4 Mile ET';

  // ── 1/4 MILE MPH ──
  // Second MPH value on the timeslip, typically higher than 1/8 MPH
  // We need to find a second MPH value different from the first
  let quarterMPH: TimeslipField | undefined;
  if (eighthMPH) {
    // Find all MPH values and pick the one that's NOT the 1/8 MPH
    const mphPattern = /(\d{2,3}\.\d{1,3})\s*(?:MPH|SPEED)|(?:MPH|SPEED)\s*[:\s]*(\d{2,3}\.\d{1,3})/gi;
    const allMPH: { value: number; line: string }[] = [];
    for (const line of lines) {
      let match;
      const linePattern = new RegExp(mphPattern.source, 'gi');
      while ((match = linePattern.exec(line)) !== null) {
        const numStr = match[1] || match[2];
        if (numStr) {
          const num = parseFloat(numStr);
          if (!isNaN(num) && num >= 50 && num <= 350 && Math.abs(num - eighthMPH.value) > 5) {
            allMPH.push({ value: num, line });
          }
        }
      }
    }
    if (allMPH.length > 0) {
      // Pick the highest MPH that's different from 1/8 MPH
      allMPH.sort((a, b) => b.value - a.value);
      quarterMPH = {
        value: allMPH[0].value,
        confidence: 75,
        rawMatch: allMPH[0].line,
        label: '1/4 Mile MPH',
      };
    }
  }

  // ── DIAL-IN ──
  const dialIn = findNumberNearLabel(
    [
      /(?:DIAL|D\.?\s*I\.?)\s*[:\s]*(\d+\.\d{2,4})/i,
      /(\d+\.\d{2,4})\s*(?:DIAL|D\.?\s*I\.?)/i,
    ],
    1.0, 30.0, 70
  );
  if (dialIn) dialIn.label = 'Dial-In';

  // ── LANE ──
  let lane: string | undefined;
  if (/\bLEFT\b/i.test(fullText) || /\bL\s*A\s*N\s*E\s*[:=]?\s*L/i.test(fullText)) {
    lane = 'Left';
  } else if (/\bRIGHT\b/i.test(fullText) || /\bL\s*A\s*N\s*E\s*[:=]?\s*R/i.test(fullText)) {
    lane = 'Right';
  }

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK: POSITIONAL PARSING
  // ═══════════════════════════════════════════════════════════════
  // If labeled parsing didn't find enough fields, try positional:
  // Look for sequences of numbers that match typical timeslip order
  // RT → 60' → 330' → 1/8 ET → MPH (→ 1/4 ET → MPH)
  const allNumbers: { value: number; line: string; lineIdx: number }[] = [];
  lines.forEach((line, idx) => {
    const numMatches = line.match(/-?\d+\.\d{2,4}/g);
    if (numMatches) {
      for (const numStr of numMatches) {
        const num = parseFloat(numStr);
        if (!isNaN(num)) {
          allNumbers.push({ value: num, line, lineIdx: idx });
        }
      }
    }
  });

  // Count how many fields we found with labeled parsing
  const labeledFields = [rt, sixtyFoot, threeThirty, eighthET, eighthMPH, quarterET, quarterMPH].filter(Boolean);

  // If we found fewer than 3 labeled fields, try positional fallback
  let finalRT = rt;
  let finalSixty = sixtyFoot;
  let finalThreeThirty = threeThirty;
  let finalEighthET = eighthET;
  let finalEighthMPH = eighthMPH;
  let finalQuarterET = quarterET;
  let finalQuarterMPH = quarterMPH;

  if (labeledFields.length < 3 && allNumbers.length >= 4) {
    // Try to identify numbers by their value ranges
    const rtCandidates = allNumbers.filter(n => n.value >= -1 && n.value <= 1 && Math.abs(n.value) < 1);
    const sixtyCandidates = allNumbers.filter(n => n.value >= 0.7 && n.value <= 2.5);
    const threeThirtyCandidates = allNumbers.filter(n => n.value >= 2.0 && n.value <= 5.5);
    const eighthETCandidates = allNumbers.filter(n => n.value >= 3.0 && n.value <= 8.0);
    const mphCandidates = allNumbers.filter(n => n.value >= 80 && n.value <= 300);
    const quarterETCandidates = allNumbers.filter(n => n.value >= 5.0 && n.value <= 15.0);

    if (!finalRT && rtCandidates.length > 0) {
      const best = rtCandidates[0];
      finalRT = { value: best.value, confidence: 60, rawMatch: best.line, label: 'Reaction Time' };
    }
    if (!finalSixty && sixtyCandidates.length > 0) {
      // Pick the one most likely to be 60' (smallest value in range)
      const sorted = [...sixtyCandidates].sort((a, b) => a.value - b.value);
      const best = sorted[0];
      finalSixty = { value: best.value, confidence: 55, rawMatch: best.line, label: "60' Time" };
    }
    if (!finalThreeThirty && threeThirtyCandidates.length > 0) {
      const best = threeThirtyCandidates.find(n => 
        finalSixty ? n.value > finalSixty.value : true
      );
      if (best) {
        finalThreeThirty = { value: best.value, confidence: 50, rawMatch: best.line, label: "330' Time" };
      }
    }
    if (!finalEighthET && eighthETCandidates.length > 0) {
      const best = eighthETCandidates.find(n => 
        finalThreeThirty ? n.value > finalThreeThirty.value : true
      );
      if (best) {
        finalEighthET = { value: best.value, confidence: 55, rawMatch: best.line, label: '1/8 Mile ET' };
      }
    }
    if (!finalEighthMPH && mphCandidates.length > 0) {
      const best = mphCandidates[0];
      finalEighthMPH = { value: best.value, confidence: 55, rawMatch: best.line, label: '1/8 Mile MPH' };
    }
    if (!finalQuarterET && quarterETCandidates.length > 0) {
      const best = quarterETCandidates.find(n =>
        finalEighthET ? n.value > finalEighthET.value : true
      );
      if (best) {
        finalQuarterET = { value: best.value, confidence: 45, rawMatch: best.line, label: '1/4 Mile ET' };
      }
    }
    if (!finalQuarterMPH && mphCandidates.length > 1) {
      const second = mphCandidates.find(n => 
        finalEighthMPH ? Math.abs(n.value - finalEighthMPH.value) > 5 : true
      );
      if (second) {
        finalQuarterMPH = { value: second.value, confidence: 45, rawMatch: second.line, label: '1/4 Mile MPH' };
      }
    }
  }

  // Calculate overall stats
  const allFields = [finalRT, finalSixty, finalThreeThirty, finalEighthET, finalEighthMPH, finalQuarterET, finalQuarterMPH];
  const foundFields = allFields.filter(Boolean) as TimeslipField[];
  const avgConfidence = foundFields.length > 0
    ? Math.round(foundFields.reduce((sum, f) => sum + f.confidence, 0) / foundFields.length)
    : 0;

  return {
    reactionTime: finalRT,
    sixtyFoot: finalSixty,
    threeThirty: finalThreeThirty,
    eighthET: finalEighthET,
    eighthMPH: finalEighthMPH,
    quarterET: finalQuarterET,
    quarterMPH: finalQuarterMPH,
    dialIn,
    lane,
    rawText,
    overallConfidence: avgConfidence,
    fieldsFound: foundFields.length,
    totalFields: 7,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONFIDENCE HELPERS
// ═══════════════════════════════════════════════════════════════════

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-400';
  if (confidence >= 60) return 'text-yellow-400';
  if (confidence >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 80) return 'bg-green-500';
  if (confidence >= 60) return 'bg-yellow-500';
  if (confidence >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 60) return 'Medium';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

const TimeslipScanner: React.FC<TimeslipScannerProps> = ({ onApply, onClose }) => {
  const [step, setStep] = useState<'capture' | 'processing' | 'confirm' | 'error'>('capture');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState({ status: '', progress: 0 });
  const [timeslipData, setTimeslipData] = useState<TimeslipData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [editableValues, setEditableValues] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Process the selected image
  const processImage = useCallback(async (file: File) => {
    setStep('processing');
    setProgress({ status: 'Preparing image...', progress: 0.05 });

    const startTime = Date.now();

    try {
      // Step 1: Create preview
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // Step 2: Preprocess image for better OCR
      setProgress({ status: 'Enhancing image for OCR...', progress: 0.1 });
      let imageToProcess: Blob;
      try {
        imageToProcess = await preprocessImage(file);
      } catch {
        imageToProcess = file;
      }

      // Step 3: Run Tesseract OCR
      setProgress({ status: 'Initializing OCR engine...', progress: 0.15 });

      const result = await Tesseract.recognize(imageToProcess, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const p = 0.15 + (m.progress || 0) * 0.65;
            setProgress({ status: 'Reading timeslip text...', progress: p });
          } else if (m.status === 'loading tesseract core') {
            setProgress({ status: 'Loading OCR engine...', progress: 0.12 });
          } else if (m.status === 'initializing tesseract') {
            setProgress({ status: 'Initializing OCR...', progress: 0.14 });
          } else if (m.status === 'loading language traineddata') {
            setProgress({ status: 'Loading language data...', progress: 0.13 });
          }
        },
      });

      const rawText = result.data.text;

      // Step 4: Parse timeslip data
      setProgress({ status: 'Extracting timeslip data...', progress: 0.85 });
      const parsed = parseTimeslipText(rawText);

      const timeslipResult: TimeslipData = {
        ...parsed,
        processingTimeMs: Date.now() - startTime,
      };

      setTimeslipData(timeslipResult);

      // Initialize editable values from parsed data
      const editable: Record<string, string> = {};
      if (parsed.reactionTime) editable.reactionTime = String(parsed.reactionTime.value);
      if (parsed.sixtyFoot) editable.sixtyFoot = String(parsed.sixtyFoot.value);
      if (parsed.threeThirty) editable.threeThirty = String(parsed.threeThirty.value);
      if (parsed.eighthET) editable.eighthET = String(parsed.eighthET.value);
      if (parsed.eighthMPH) editable.eighthMPH = String(parsed.eighthMPH.value);
      if (parsed.quarterET) editable.quarterET = String(parsed.quarterET.value);
      if (parsed.quarterMPH) editable.quarterMPH = String(parsed.quarterMPH.value);
      setEditableValues(editable);

      setProgress({ status: 'Complete!', progress: 1 });

      if (parsed.fieldsFound === 0) {
        setErrorMessage(
          'No timeslip data could be extracted from this image. Try taking a clearer photo with good lighting, or ensure the timeslip text is visible and not folded.'
        );
        setStep('error');
      } else {
        setStep('confirm');
      }
    } catch (err) {
      console.error('Timeslip OCR error:', err);
      setErrorMessage(
        err instanceof Error
          ? `OCR processing failed: ${err.message}`
          : 'Failed to process the timeslip image. Please try again.'
      );
      setStep('error');
    }
  }, []);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  // Apply extracted values to the form
  const handleApply = () => {
    const data: Parameters<typeof onApply>[0] = {};

    if (editableValues.reactionTime) {
      const v = parseFloat(editableValues.reactionTime);
      if (!isNaN(v)) data.reactionTime = v;
    }
    if (editableValues.sixtyFoot) {
      const v = parseFloat(editableValues.sixtyFoot);
      if (!isNaN(v)) data.sixtyFoot = v;
    }
    if (editableValues.threeThirty) {
      const v = parseFloat(editableValues.threeThirty);
      if (!isNaN(v)) data.threeThirty = v;
    }
    if (editableValues.eighthET) {
      const v = parseFloat(editableValues.eighthET);
      if (!isNaN(v)) data.eighth = v;
    }
    if (editableValues.eighthMPH) {
      const v = parseFloat(editableValues.eighthMPH);
      if (!isNaN(v)) data.mph = v;
    }
    if (editableValues.quarterET) {
      const v = parseFloat(editableValues.quarterET);
      if (!isNaN(v)) data.quarterMileET = v;
    }
    if (editableValues.quarterMPH) {
      const v = parseFloat(editableValues.quarterMPH);
      if (!isNaN(v)) data.quarterMileMPH = v;
    }

    onApply(data);
  };

  // Reset to capture step
  const handleRetry = () => {
    setStep('capture');
    setImagePreview(null);
    setTimeslipData(null);
    setErrorMessage('');
    setEditableValues({});
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: CAPTURE STEP
  // ═══════════════════════════════════════════════════════════════
  if (step === 'capture') {
    return (
      <div className="bg-slate-900/80 rounded-xl border border-slate-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-orange-400" />
            <h4 className="font-semibold text-white">Scan Timeslip</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Take a photo of your timeslip or upload an existing image. The OCR engine will extract
          RT, 60', 330', 1/8 ET, MPH, and other fields automatically.
        </p>

        {/* Tips */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-700/50">
          <p className="text-xs text-slate-400 font-medium mb-2">Tips for best results:</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Lay the timeslip flat on a dark surface</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Ensure good, even lighting (no shadows)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Fill the frame with the timeslip — crop out background</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Make sure the text is sharp and in focus</span>
            </li>
          </ul>
        </div>

        {/* Capture Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 bg-orange-500/10 border-2 border-dashed border-orange-500/40 rounded-xl hover:bg-orange-500/20 hover:border-orange-500/60 transition-all group"
          >
            <Camera className="w-8 h-8 text-orange-400 group-hover:scale-110 transition-transform" />
            <span className="text-orange-400 font-medium text-sm">Take Photo</span>
            <span className="text-slate-500 text-xs">Use device camera</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 border-2 border-dashed border-blue-500/40 rounded-xl hover:bg-blue-500/20 hover:border-blue-500/60 transition-all group"
          >
            <Upload className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-blue-400 font-medium text-sm">Upload Image</span>
            <span className="text-slate-500 text-xs">From gallery/files</span>
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: PROCESSING STEP
  // ═══════════════════════════════════════════════════════════════
  if (step === 'processing') {
    return (
      <div className="bg-slate-900/80 rounded-xl border border-slate-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <h4 className="font-semibold text-white">Scanning Timeslip...</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 max-h-48">
            <img src={imagePreview} alt="Timeslip" className="w-full h-full object-contain bg-slate-950" />
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{progress.status}</span>
            <span className="text-orange-400 font-mono">{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.progress * 100}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          First scan may take longer while the OCR engine loads. Subsequent scans will be faster.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: ERROR STEP
  // ═══════════════════════════════════════════════════════════════
  if (step === 'error') {
    return (
      <div className="bg-slate-900/80 rounded-xl border border-red-500/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="font-semibold text-white">Scan Failed</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {imagePreview && (
          <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 max-h-32">
            <img src={imagePreview} alt="Timeslip" className="w-full h-full object-contain bg-slate-950" />
          </div>
        )}

        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>

        {/* Show raw text if available */}
        {timeslipData?.rawText && (
          <div className="mb-4">
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {showRawText ? 'Hide' : 'Show'} raw OCR text
              {showRawText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showRawText && (
              <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs text-slate-400 font-mono overflow-x-auto max-h-40 overflow-y-auto border border-slate-700">
                {timeslipData.rawText}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: CONFIRMATION STEP
  // ═══════════════════════════════════════════════════════════════
  if (step === 'confirm' && timeslipData) {
    const fields: { key: string; field?: TimeslipField; unit: string }[] = [
      { key: 'reactionTime', field: timeslipData.reactionTime, unit: 's' },
      { key: 'sixtyFoot', field: timeslipData.sixtyFoot, unit: 's' },
      { key: 'threeThirty', field: timeslipData.threeThirty, unit: 's' },
      { key: 'eighthET', field: timeslipData.eighthET, unit: 's' },
      { key: 'eighthMPH', field: timeslipData.eighthMPH, unit: 'mph' },
      { key: 'quarterET', field: timeslipData.quarterET, unit: 's' },
      { key: 'quarterMPH', field: timeslipData.quarterMPH, unit: 'mph' },
    ];

    const fieldLabels: Record<string, string> = {
      reactionTime: 'Reaction Time',
      sixtyFoot: "60' Time",
      threeThirty: "330' Time",
      eighthET: '1/8 Mile ET',
      eighthMPH: '1/8 Mile MPH',
      quarterET: '1/4 Mile ET',
      quarterMPH: '1/4 Mile MPH',
    };

    return (
      <div className="bg-slate-900/80 rounded-xl border border-slate-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h4 className="font-semibold text-white">Timeslip Scanned</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Fields found:</span>
              <span className="text-white font-bold">{timeslipData.fieldsFound}/{timeslipData.totalFields}</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Confidence:</span>
              <span className={`font-bold ${getConfidenceColor(timeslipData.overallConfidence)}`}>
                {getConfidenceLabel(timeslipData.overallConfidence)}
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            {(timeslipData.processingTimeMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Confidence Bar */}
        <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getConfidenceBg(timeslipData.overallConfidence)}`}
            style={{ width: `${timeslipData.overallConfidence}%` }}
          />
        </div>

        {/* Image Preview (small) */}
        {imagePreview && (
          <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 max-h-28 cursor-pointer group relative"
               onClick={() => setShowRawText(!showRawText)}>
            <img src={imagePreview} alt="Timeslip" className="w-full h-full object-contain bg-slate-950" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Eye className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {/* Extracted Fields — Editable */}
        <div className="space-y-2 mb-4">
          <p className="text-xs text-slate-400 font-medium">
            Review and edit extracted values before applying:
          </p>
          {fields.map(({ key, field, unit }) => {
            const hasValue = field !== undefined && editableValues[key] !== undefined;
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  hasValue
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : 'bg-slate-800/20 border-slate-700/20 opacity-50'
                }`}
              >
                {/* Field Label */}
                <div className="w-28 flex-shrink-0">
                  <span className="text-sm text-slate-300">{fieldLabels[key]}</span>
                </div>

                {/* Value Input */}
                {hasValue ? (
                  <>
                    <input
                      type="text"
                      value={editableValues[key] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                          setEditableValues(prev => ({ ...prev, [key]: val }));
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white font-mono text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none"
                    />
                    <span className="text-xs text-slate-500 w-8">{unit}</span>
                    {/* Confidence Indicator */}
                    <div className="flex items-center gap-1 w-16 justify-end">
                      <div className={`w-2 h-2 rounded-full ${getConfidenceBg(field!.confidence)}`} />
                      <span className={`text-xs font-mono ${getConfidenceColor(field!.confidence)}`}>
                        {field!.confidence}%
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-slate-600 italic">Not detected</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Lane Detection */}
        {timeslipData.lane && (
          <div className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 mb-4">
            <span className="text-xs text-slate-400">Lane detected:</span>
            <span className="text-white text-sm font-medium">{timeslipData.lane}</span>
          </div>
        )}

        {/* Raw Text Toggle */}
        <div className="mb-4">
          <button
            onClick={() => setShowRawText(!showRawText)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            {showRawText ? 'Hide' : 'Show'} raw OCR text
            {showRawText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showRawText && (
            <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs text-slate-400 font-mono overflow-x-auto max-h-40 overflow-y-auto border border-slate-700">
              {timeslipData.rawText || '(No text extracted)'}
            </pre>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Rescan
          </button>
          <button
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20"
          >
            <CheckCircle className="w-4 h-4" />
            Apply to Form
          </button>
        </div>

        {timeslipData.overallConfidence < 60 && (
          <p className="text-xs text-yellow-400/80 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Low confidence — please verify the values above before applying.
          </p>
        )}
      </div>
    );
  }

  return null;
};

export default TimeslipScanner;
