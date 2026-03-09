import { getLocalDateString } from './utils';
/**
 * Receipt OCR Processing Module
 * 
 * Uses Tesseract.js for client-side OCR and custom parsing logic
 * to extract receipt data (amount, date, vendor name).
 */

import Tesseract from 'tesseract.js';

// ===== TYPES =====
export interface OcrField {
  value: string;
  confidence: number; // 0-100
  rawMatch: string;
}

export interface OcrResult {
  amount: OcrField | null;
  date: OcrField | null;
  vendor: OcrField | null;
  rawText: string;
  overallConfidence: number;
  processingTimeMs: number;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0-1
}

// ===== IMAGE PREPROCESSING =====

/**
 * Preprocess an image for better OCR results:
 * - Convert to grayscale
 * - Increase contrast
 * - Apply slight sharpening
 * Returns a processed image as a Blob
 */
export const preprocessImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Scale down very large images for faster processing
      const MAX_DIM = 2000;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminosity method
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Increase contrast (factor of 1.5)
        const factor = 1.5;
        const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

        // Apply adaptive thresholding for cleaner text
        const threshold = adjusted > 140 ? 255 : adjusted < 80 ? 0 : adjusted;

        data[i] = threshold;
        data[i + 1] = threshold;
        data[i + 2] = threshold;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create processed image blob'));
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

// ===== TEXT PARSING =====

/**
 * Extract total amount from OCR text.
 * Looks for patterns like:
 * - TOTAL $12.34
 * - Total: 12.34
 * - AMOUNT DUE: $12.34
 * - Grand Total 12.34
 * - BALANCE DUE $12.34
 */
const extractAmount = (text: string): OcrField | null => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Priority patterns - most specific first
  const patterns: { regex: RegExp; confidence: number }[] = [
    // "TOTAL" with dollar amount on same line
    { regex: /(?:grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*charged|total\s*amount)\s*[:\s]*\$?\s*(\d{1,6}[.,]\d{2})/i, confidence: 95 },
    // "TOTAL" keyword with amount
    { regex: /(?:^|\s)total\s*[:\s]*\$?\s*(\d{1,6}[.,]\d{2})/i, confidence: 90 },
    // Dollar sign with amount near "total"
    { regex: /total.*?\$\s*(\d{1,6}[.,]\d{2})/i, confidence: 88 },
    // "SUBTOTAL" (less confident since it's not the final total)
    { regex: /sub\s*total\s*[:\s]*\$?\s*(\d{1,6}[.,]\d{2})/i, confidence: 70 },
    // Standalone dollar amount (largest one, likely the total)
    { regex: /\$\s*(\d{1,6}\.\d{2})/g, confidence: 60 },
  ];

  // Try each pattern
  for (const { regex, confidence } of patterns) {
    // Check each line for the pattern
    for (const line of lines) {
      const match = line.match(regex);
      if (match && match[1]) {
        const rawValue = match[1].replace(',', '.');
        const numValue = parseFloat(rawValue);
        if (numValue > 0 && numValue < 100000) {
          return {
            value: numValue.toFixed(2),
            confidence,
            rawMatch: line,
          };
        }
      }
    }
  }

  // Fallback: find the largest dollar amount in the text (likely the total)
  const allAmounts: { value: number; line: string }[] = [];
  const dollarRegex = /\$?\s*(\d{1,6}\.\d{2})/g;
  for (const line of lines) {
    let match;
    while ((match = dollarRegex.exec(line)) !== null) {
      const val = parseFloat(match[1]);
      if (val > 0 && val < 100000) {
        allAmounts.push({ value: val, line });
      }
    }
  }

  if (allAmounts.length > 0) {
    // Pick the largest amount (most likely the total)
    allAmounts.sort((a, b) => b.value - a.value);
    return {
      value: allAmounts[0].value.toFixed(2),
      confidence: 45,
      rawMatch: allAmounts[0].line,
    };
  }

  return null;
};

/**
 * Extract date from OCR text.
 * Looks for common date formats:
 * - MM/DD/YYYY, MM-DD-YYYY
 * - MM/DD/YY, MM-DD-YY
 * - Month DD, YYYY
 * - DD Month YYYY
 * - YYYY-MM-DD
 */
const extractDate = (text: string): OcrField | null => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const monthNames = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

  const patterns: { regex: RegExp; confidence: number; format: string }[] = [
    // MM/DD/YYYY or MM-DD-YYYY
    { regex: new RegExp(`(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{4})`, 'i'), confidence: 90, format: 'MDY4' },
    // YYYY-MM-DD (ISO format)
    { regex: new RegExp(`(\\d{4})[/\\-](\\d{1,2})[/\\-](\\d{1,2})`, 'i'), confidence: 92, format: 'YMD' },
    // Month DD, YYYY
    { regex: new RegExp(`${monthNames}\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'), confidence: 88, format: 'NameDY' },
    // DD Month YYYY
    { regex: new RegExp(`(\\d{1,2})\\s+${monthNames}\\.?,?\\s+(\\d{4})`, 'i'), confidence: 85, format: 'DNameY' },
    // MM/DD/YY or MM-DD-YY
    { regex: new RegExp(`(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2})(?!\\d)`, 'i'), confidence: 75, format: 'MDY2' },
  ];

  const monthMap: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };

  for (const line of lines) {
    for (const { regex, confidence, format } of patterns) {
      const match = line.match(regex);
      if (match) {
        try {
          let date: Date | null = null;

          switch (format) {
            case 'MDY4': {
              const m = parseInt(match[1]) - 1;
              const d = parseInt(match[2]);
              const y = parseInt(match[3]);
              if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
                date = new Date(y, m, d);
              }
              break;
            }
            case 'YMD': {
              const y = parseInt(match[1]);
              const m = parseInt(match[2]) - 1;
              const d = parseInt(match[3]);
              if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
                date = new Date(y, m, d);
              }
              break;
            }
            case 'NameDY': {
              const monthStr = match[1].toLowerCase().replace('.', '');
              const m = monthMap[monthStr];
              const d = parseInt(match[2]);
              const y = parseInt(match[3]);
              if (m !== undefined && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
                date = new Date(y, m, d);
              }
              break;
            }
            case 'DNameY': {
              const d = parseInt(match[1]);
              const monthStr = match[2].toLowerCase().replace('.', '');
              const m = monthMap[monthStr];
              const y = parseInt(match[3]);
              if (m !== undefined && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
                date = new Date(y, m, d);
              }
              break;
            }
            case 'MDY2': {
              const m = parseInt(match[1]) - 1;
              const d = parseInt(match[2]);
              let y = parseInt(match[3]);
              y += y < 50 ? 2000 : 1900;
              if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
                date = new Date(y, m, d);
              }
              break;
            }
          }

          if (date && !isNaN(date.getTime())) {
            const isoDate = getLocalDateString(date);

            return {
              value: isoDate,
              confidence,
              rawMatch: line,
            };
          }
        } catch {
          // Continue to next pattern
        }
      }
    }
  }

  return null;
};

/**
 * Extract vendor/store name from OCR text.
 * Typically the first few lines of a receipt contain the store name.
 */
const extractVendor = (text: string): OcrField | null => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Skip common non-vendor lines
  const skipPatterns = [
    /^\d+$/, // Just numbers
    /^\d{1,2}[/\-]\d{1,2}/, // Dates
    /^tel|^phone|^fax|^www\.|^http/i,
    /^\d{3}[\s\-]\d{3}/, // Phone numbers
    /^receipt|^invoice|^order|^transaction/i,
    /^thank\s*you/i,
    /^\*+$/, // Decorative lines
    /^[-=_]+$/, // Separator lines
    /^#\d+/, // Order numbers
  ];

  // Address patterns to skip
  const addressPatterns = [
    /^\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|hwy|highway)/i,
    /^[A-Z]{2}\s+\d{5}/, // State + ZIP
    /\d{5}(-\d{4})?$/, // ZIP code at end
  ];

  // Look at the first 5 non-empty lines for the vendor name
  let candidateLines: { text: string; score: number }[] = [];

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (line.length < 3 || line.length > 60) continue;

    let skip = false;
    for (const pattern of [...skipPatterns, ...addressPatterns]) {
      if (pattern.test(line)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    // Score the line
    let score = 70;

    // Bonus for being in the first 3 lines
    if (i < 3) score += 15;
    else if (i < 5) score += 5;

    // Bonus for being all caps (common for store names)
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) score += 10;

    // Bonus for reasonable length (3-30 chars)
    if (line.length >= 3 && line.length <= 30) score += 5;

    // Penalty for containing mostly numbers
    const numRatio = (line.match(/\d/g) || []).length / line.length;
    if (numRatio > 0.5) score -= 30;

    // Penalty for containing dollar signs
    if (line.includes('$')) score -= 20;

    candidateLines.push({ text: line, score });
  }

  if (candidateLines.length === 0) return null;

  // Pick the best candidate
  candidateLines.sort((a, b) => b.score - a.score);
  const best = candidateLines[0];

  return {
    value: best.text.replace(/[*#=\-_]+/g, '').trim(),
    confidence: Math.min(best.score, 95),
    rawMatch: best.text,
  };
};

// ===== MAIN OCR FUNCTION =====

/**
 * Process a receipt image and extract structured data.
 * 
 * @param file - The image file to process
 * @param onProgress - Optional progress callback
 * @returns Extracted receipt data with confidence scores
 */
export const processReceipt = async (
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<OcrResult> => {
  const startTime = Date.now();

  try {
    // Step 1: Preprocess image
    onProgress?.({ status: 'Preprocessing image...', progress: 0.1 });
    let imageToProcess: Blob;
    try {
      imageToProcess = await preprocessImage(file);
    } catch {
      // If preprocessing fails, use the original file
      imageToProcess = file;
    }

    // Step 2: Run Tesseract OCR
    onProgress?.({ status: 'Initializing OCR engine...', progress: 0.2 });

    const result = await Tesseract.recognize(imageToProcess, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const progress = 0.2 + (m.progress || 0) * 0.6;
          onProgress?.({ status: 'Reading receipt text...', progress });
        }
      },
    });

    const rawText = result.data.text;
    const ocrConfidence = result.data.confidence || 0;

    onProgress?.({ status: 'Analyzing receipt data...', progress: 0.85 });

    // Step 3: Parse extracted text
    const amount = extractAmount(rawText);
    const date = extractDate(rawText);
    const vendor = extractVendor(rawText);

    // Step 4: Calculate overall confidence
    const fieldConfidences = [
      amount?.confidence || 0,
      date?.confidence || 0,
      vendor?.confidence || 0,
    ].filter(c => c > 0);

    const avgFieldConfidence = fieldConfidences.length > 0
      ? fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length
      : 0;

    // Blend OCR engine confidence with field extraction confidence
    const overallConfidence = Math.round(
      (ocrConfidence * 0.4 + avgFieldConfidence * 0.6)
    );

    onProgress?.({ status: 'Complete!', progress: 1 });

    return {
      amount,
      date,
      vendor,
      rawText,
      overallConfidence,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw new Error(
      `Failed to process receipt: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Get a human-readable confidence label
 */
export const getConfidenceLabel = (confidence: number): { label: string; color: string; bgColor: string } => {
  if (confidence >= 85) return { label: 'High', color: 'text-green-400', bgColor: 'bg-green-500' };
  if (confidence >= 60) return { label: 'Medium', color: 'text-yellow-400', bgColor: 'bg-yellow-500' };
  if (confidence >= 30) return { label: 'Low', color: 'text-orange-400', bgColor: 'bg-orange-500' };
  return { label: 'Very Low', color: 'text-red-400', bgColor: 'bg-red-500' };
};
