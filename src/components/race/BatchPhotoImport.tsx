import React, { useState, useRef, useCallback } from 'react';
import DateInputDark from '@/components/ui/DateInputDark';

import { useAuth } from '@/contexts/AuthContext';
import { uploadWithFallback } from '@/lib/storageUpload';
import { getStorageErrorMessage } from '@/lib/storageUpload';
import * as db from '@/lib/database';
import { MediaItem } from '@/lib/database';
import { auditLog } from '@/lib/auditLog';
import {
  Upload,
  X,
  Image,
  Film,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FolderUp,
  Tag,
  Trash2,
  FileImage,
  Info,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';


// ─── Types ───────────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'resizing' | 'uploading' | 'creating-record' | 'success' | 'failed';
type UploadMethod = 'direct' | 'edge' | 'dataurl';

interface BatchFile {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
  progress: number; // 0-100
  error?: string;
  uploadMethod?: UploadMethod;
  resultUrl?: string;
}

interface BatchPhotoImportProps {
  onClose: () => void;
  onComplete: () => void; // called after all uploads finish to reload gallery
  userEmail?: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'Race Day', label: 'Race Day', icon: '🏁' },
  { value: 'Testing', label: 'Testing', icon: '🔧' },
  { value: 'Shop Work', label: 'Shop Work', icon: '🏗️' },
  { value: 'Team Events', label: 'Team Events', icon: '👥' },
  { value: 'Burnouts', label: 'Burnouts', icon: '🔥' },
  { value: 'Wins', label: 'Wins', icon: '🏆' },
  { value: 'Sponsors', label: 'Sponsors', icon: '💼' },
  { value: 'Car Photos', label: 'Car Photos', icon: '🚗' },
  { value: 'Team Photos', label: 'Team Photos', icon: '📸' },
  { value: 'Track Photos', label: 'Track Photos', icon: '🛤️' },
  { value: 'General', label: 'General', icon: '📁' },
];

const MAX_FILES = 20;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];

// ─── Image resizer (same logic as MediaGallery) ─────────────────────────────

const resizeImage = (file: File, maxW = 1920, maxH = 1920, quality = 0.85): Promise<Blob> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxW && height <= maxH) { resolve(file); return; }
      const r = Math.min(maxW / width, maxH / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('No canvas')); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });

// ─── Component ───────────────────────────────────────────────────────────────

const BatchPhotoImport: React.FC<BatchPhotoImportProps> = ({ onClose, onComplete, userEmail }) => {
  const { user } = useAuth();

  // Files
  const [files, setFiles] = useState<BatchFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch metadata
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Upload state
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fallbackWarnings, setFallbackWarnings] = useState<string[]>([]);

  // Drag state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // ── File validation ──────────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return `Unsupported file type: ${file.type || 'unknown'}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 50 MB.`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles(prev => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) return prev;
      const toAdd = arr.slice(0, remaining);
      const mapped: BatchFile[] = toAdd.map(f => {
        const validationError = validateFile(f);
        return {
          id: crypto.randomUUID(),
          file: f,
          previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
          status: validationError ? 'failed' as FileStatus : 'pending' as FileStatus,
          progress: validationError ? 100 : 0,
          error: validationError || undefined,
        };
      });
      return [...prev, ...mapped];
    });
  }, []);

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // ── Remove file ──────────────────────────────────────────────────────────

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setFiles([]);
    setFallbackWarnings([]);
  };

  // ── Upload all ───────────────────────────────────────────────────────────

  const uploadAll = async () => {
    const pending = files.filter(f => f.status === 'pending');
    if (pending.length === 0) return;

    setIsRunning(true);
    setFallbackWarnings([]);
    const warnings: string[] = [];

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    for (const bf of pending) {


      // Step 1: Resize
      const isVideo = bf.file.type.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'photo';

      setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'resizing' as FileStatus, progress: 10 } : f));

      let blob: Blob = bf.file;
      if (!isVideo) {
        try {
          blob = await resizeImage(bf.file);
        } catch {
          // use original
          blob = bf.file;
        }
      }

      setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'uploading' as FileStatus, progress: 30 } : f));

      // Step 2: Upload with fallback
      const fileExt = isVideo ? (bf.file.name.split('.').pop() || 'mp4') : 'jpg';
      const fileName = `${mediaType}s/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const contentType = isVideo ? bf.file.type : 'image/jpeg';

      try {
        const result = await uploadWithFallback(blob, fileName, contentType);

        setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, progress: 70, uploadMethod: result.method } : f));

        if (!result.url) {
          throw new Error(result.error ? getStorageErrorMessage(result.error) : 'Upload returned empty URL');
        }

        // Track fallback warnings
        if (result.method === 'edge') {
          warnings.push(`"${bf.file.name}" uploaded via edge function (storage RLS policies may be missing)`);
        } else if (result.method === 'dataurl') {
          warnings.push(`"${bf.file.name}" stored as data URL (not persisted in cloud storage)`);
        }

        // Step 3: Create database record
        setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'creating-record' as FileStatus, progress: 85 } : f));

        const newId = crypto.randomUUID();
        const titleFromName = bf.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const newItem: Partial<MediaItem> & { id: string } = {
          id: newId,
          title: titleFromName,
          description: eventName ? `Batch import — ${eventName}` : 'Batch import',
          mediaType,
          url: result.url,
          category,
          tags: parsedTags,
          eventName: eventName || undefined,
          eventDate: eventDate || undefined,
          uploadedBy: userEmail || user?.email || 'Unknown',
          fileSize: blob instanceof File ? blob.size : (blob as Blob).size,
          isFeatured: false,
          isPublic,
        };

        await db.upsertMediaItem(newItem, user?.id);

        await auditLog.log({
          action_type: 'create',
          category: 'media',
          entity_type: mediaType,
          entity_id: newId,
          entity_name: titleFromName,
          description: `Batch uploaded ${mediaType}: ${titleFromName}`,
          after_value: newItem,
        });

        setFiles(prev => prev.map(f => f.id === bf.id ? {
          ...f,
          status: 'success' as FileStatus,
          progress: 100,
          resultUrl: result.url,
        } : f));
      } catch (err: any) {
        const msg = getStorageErrorMessage(err);
        setFiles(prev => prev.map(f => f.id === bf.id ? {
          ...f,
          status: 'failed' as FileStatus,
          progress: 100,
          error: msg,
        } : f));
      }
    }

    setFallbackWarnings(warnings);
    setIsRunning(false);
    onComplete(); // reload gallery
  };

  // ── Retry failed ─────────────────────────────────────────────────────────

  const retryFailed = () => {
    setFiles(prev => prev.map(f => f.status === 'failed' && !validateFile(f.file) ? { ...f, status: 'pending' as FileStatus, progress: 0, error: undefined } : f));
  };

  // ── Stats ────────────────────────────────────────────────────────────────

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const activeCount = files.filter(f => ['resizing', 'uploading', 'creating-record'].includes(f.status)).length;
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusLabel = (s: FileStatus) => {
    switch (s) {
      case 'pending': return 'Waiting';
      case 'resizing': return 'Resizing';
      case 'uploading': return 'Uploading';
      case 'creating-record': return 'Saving';
      case 'success': return 'Done';
      case 'failed': return 'Failed';
    }
  };

  const statusColor = (s: FileStatus) => {
    switch (s) {
      case 'pending': return 'text-slate-400';
      case 'resizing': return 'text-blue-400';
      case 'uploading': return 'text-orange-400';
      case 'creating-record': return 'text-purple-400';
      case 'success': return 'text-green-400';
      case 'failed': return 'text-red-400';
    }
  };

  const progressBarColor = (s: FileStatus) => {
    switch (s) {
      case 'pending': return 'bg-slate-600';
      case 'resizing': return 'bg-blue-500';
      case 'uploading': return 'bg-orange-500';
      case 'creating-record': return 'bg-purple-500';
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
    }
  };

  const methodBadge = (m?: UploadMethod) => {
    if (!m) return null;
    const colors = {
      direct: 'bg-green-500/20 text-green-400',
      edge: 'bg-yellow-500/20 text-yellow-400',
      dataurl: 'bg-orange-500/20 text-orange-400',
    };
    const labels = { direct: 'Direct', edge: 'Edge Fn', dataurl: 'Data URL' };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[m]}`}>
        {labels[m]}
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-3xl w-full border border-slate-700 max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <FolderUp className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Batch Photo Import</h3>
              <p className="text-xs text-slate-400">Upload up to {MAX_FILES} photos or videos at once</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Drop zone ─────────────────────────────────────────────── */}
          {files.length < MAX_FILES && !isRunning && (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-600 hover:border-orange-500/50 hover:bg-slate-700/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                className="hidden"
              />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-orange-400' : 'text-slate-500'}`} />
              <p className="text-white font-medium">
                {isDragOver ? 'Drop files here' : 'Drag & drop photos/videos here'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or click to browse — up to {MAX_FILES - files.length} more file{MAX_FILES - files.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                JPEG, PNG, WebP, GIF, MP4, MOV, WebM — max 50 MB each
              </p>
            </div>
          )}

          {/* ── Batch metadata ────────────────────────────────────────── */}
          {files.length > 0 && (
            <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-400" />
                  Batch Tags &amp; Metadata
                </h4>
                <span className="text-xs text-slate-500">Applied to all {files.length} file{files.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Event Name */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    disabled={isRunning}
                    placeholder="e.g., NHRA Nationals"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                  />
                </div>

                {/* Event Date */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Date</label>
                  <DateInputDark
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                  />

                </div>
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAdvanced ? 'Hide' : 'Show'} advanced options
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      disabled={isRunning}
                      placeholder="e.g., burnout, qualifying, win"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      disabled={isRunning}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500"
                    />
                    <span className="text-sm text-white">Make all photos public</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── File list ─────────────────────────────────────────────── */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-blue-400" />
                  Files ({files.length}/{MAX_FILES})
                  <span className="text-xs font-normal text-slate-500">— {formatSize(totalSize)} total</span>
                </h4>
                {!isRunning && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {files.map(bf => (
                  <div
                    key={bf.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      bf.status === 'success'
                        ? 'bg-green-500/5 border-green-500/20'
                        : bf.status === 'failed'
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-slate-900/40 border-slate-700/50'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center">
                      {bf.previewUrl ? (
                        <img src={bf.previewUrl} alt="" className="w-full h-full object-cover" />
                      ) : bf.file.type.startsWith('video/') ? (
                        <Film className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Image className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    {/* Info + progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white truncate">{bf.file.name}</p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{formatSize(bf.file.size)}</span>
                        {methodBadge(bf.uploadMethod)}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progressBarColor(bf.status)}`}
                            style={{ width: `${bf.progress}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium flex-shrink-0 ${statusColor(bf.status)}`}>
                          {statusLabel(bf.status)}
                        </span>
                      </div>

                      {/* Error message */}
                      {bf.error && (
                        <p className="text-[11px] text-red-400 mt-0.5 truncate" title={bf.error}>{bf.error}</p>
                      )}
                    </div>

                    {/* Status icon / remove */}
                    <div className="flex-shrink-0">
                      {bf.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : bf.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-red-400" />
                      ) : ['resizing', 'uploading', 'creating-record'].includes(bf.status) ? (
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      ) : (
                        <button
                          onClick={() => removeFile(bf.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Fallback warnings ─────────────────────────────────────── */}
          {fallbackWarnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-300">Some files used fallback upload methods</p>
                  <p className="text-xs text-yellow-400/80 mt-1">
                    This usually means storage.objects RLS policies are missing. Go to Admin Settings → Storage &amp; Uploads to fix.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {fallbackWarnings.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-400/70 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── Summary stats (after upload) ──────────────────────────── */}
          {!isRunning && successCount + failedCount > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/60 rounded-lg p-3 text-center border border-slate-700/50">
                <p className="text-xl font-bold text-white">{files.length}</p>
                <p className="text-xs text-slate-400">Total</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/20">
                <p className="text-xl font-bold text-green-400">{successCount}</p>
                <p className="text-xs text-green-400/70">Uploaded</p>
              </div>
              <div className={`rounded-lg p-3 text-center border ${failedCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-900/60 border-slate-700/50'}`}>
                <p className={`text-xl font-bold ${failedCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{failedCount}</p>
                <p className={`text-xs ${failedCount > 0 ? 'text-red-400/70' : 'text-slate-500'}`}>Failed</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <div className="text-xs text-slate-500">
            {isRunning && activeCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing {activeCount} file{activeCount !== 1 ? 's' : ''}...
              </span>
            )}
            {!isRunning && pendingCount > 0 && (
              <span>{pendingCount} file{pendingCount !== 1 ? 's' : ''} ready to upload</span>
            )}
            {!isRunning && pendingCount === 0 && successCount > 0 && (
              <span className="text-green-400">All done! Gallery has been refreshed.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Retry failed */}
            {!isRunning && failedCount > 0 && (
              <button
                onClick={retryFailed}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Retry {failedCount} Failed
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {successCount > 0 && pendingCount === 0 ? 'Close' : 'Cancel'}
            </button>

            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                disabled={isRunning || pendingCount === 0}
                className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchPhotoImport;
