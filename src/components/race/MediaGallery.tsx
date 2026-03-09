import React, { useState, useEffect, useRef } from 'react';
import DateInputDark from '@/components/ui/DateInputDark';
import { useAuth } from '@/contexts/AuthContext';
import { CrewRole, hasPermission, isAdminRole } from '@/lib/permissions';
import { auditLog } from '@/lib/auditLog';
import * as db from '@/lib/database';
import { MediaItem } from '@/lib/database';
import BatchPhotoImport from './BatchPhotoImport';

import {
  Camera,
  Video,
  Upload,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  Grid,
  List,
  Star,
  StarOff,
  Calendar,
  Tag,
  Play,
  Pause,
  Maximize2,
  Download,
  Image,
  Film,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  RefreshCw,
  Eye,
  FolderUp
} from 'lucide-react';

type MediaFilterType = 'all' | 'photo' | 'video';

interface MediaGalleryProps {
  currentRole: CrewRole;
}


// Utility: Resize an image file to a max dimension, returns a Blob
const resizeImageForGallery = (file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Skip non-image files (videos)
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight) {
        resolve(file);
        return;
      }
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

const MediaGallery: React.FC<MediaGalleryProps> = ({ currentRole }) => {
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<MediaFilterType>('all');

  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBatchImport, setShowBatchImport] = useState(false);

  // Permissions
  const canUpload = hasPermission(currentRole, 'team.add') || isAdminRole(currentRole);
  const canEdit = hasPermission(currentRole, 'team.edit') || isAdminRole(currentRole);
  const canDelete = hasPermission(currentRole, 'team.delete') || isAdminRole(currentRole);

  // Categories
  const categories = ['Race Day', 'Testing', 'Shop Work', 'Team Events', 'Burnouts', 'Wins', 'Sponsors', 'General'];

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    category: 'General',
    eventName: '',
    eventDate: '',
    tags: '',
    isFeatured: false,
    isPublic: true
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Load media items on mount and when user changes
  useEffect(() => {
    loadMediaItems();
  }, [user?.id]);

  const loadMediaItems = async () => {
    setIsLoading(true);
    const safetyTimeout = setTimeout(() => {
      console.warn('MediaGallery: safety timeout - forcing loading to end');
      setIsLoading(false);
    }, 5000);
    try {
      const items = await db.fetchMediaItems(user?.id);
      setMediaItems(items);
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  };

  // Filter media items
  const filteredItems = mediaItems.filter(item => {
    if (filterType !== 'all' && item.mediaType !== filterType) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.eventName?.toLowerCase().includes(search) ||
        item.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      const fileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadForm(prev => ({ ...prev, title: fileName }));
    }
  };

  // Handle upload (with auto-resize for images)
  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const isVideo = selectedFile.type.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'photo';

      let fileToUpload: File | Blob = selectedFile;
      if (!isVideo) {
        try {
          fileToUpload = await resizeImageForGallery(selectedFile);
        } catch (resizeErr) {
          console.warn('Image resize failed, uploading original:', resizeErr);
          fileToUpload = selectedFile;
        }
      }

      const fileExt = isVideo ? (selectedFile.name.split('.').pop() || 'mp4') : 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${mediaType}s/${fileName}`;

      const url = await db.uploadMediaFile(fileToUpload, filePath);

      const newId = crypto.randomUUID();

      const newItem: Partial<MediaItem> & { id: string } = {
        id: newId,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        mediaType,
        url,
        category: uploadForm.category,
        tags: uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        eventName: uploadForm.eventName || undefined,
        eventDate: uploadForm.eventDate || undefined,
        uploadedBy: user?.email || 'Unknown',
        fileSize: fileToUpload instanceof File ? fileToUpload.size : (fileToUpload as Blob).size,
        isFeatured: uploadForm.isFeatured,
        isPublic: uploadForm.isPublic
      };

      await db.upsertMediaItem(newItem, user?.id);

      await auditLog.log({
        action_type: 'create',
        category: 'media',
        entity_type: mediaType,
        entity_id: newItem.id,
        entity_name: newItem.title,
        description: `Uploaded ${mediaType}: ${newItem.title}`,
        after_value: newItem
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadError(null);
      setUploadForm({
        title: '',
        description: '',
        category: 'General',
        eventName: '',
        eventDate: '',
        tags: '',
        isFeatured: false,
        isPublic: true
      });
      await loadMediaItems();
    } catch (error: any) {
      console.error('Error uploading media:', error);
      const msg = error?.message || error?.error_description || 'Unknown error';
      setUploadError('Upload failed: ' + msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!editingItem) return;
    try {
      await db.upsertMediaItem(editingItem, user?.id);
      await auditLog.log({
        action_type: 'update',
        category: 'media',
        entity_type: editingItem.mediaType,
        entity_id: editingItem.id,
        entity_name: editingItem.title,
        description: `Updated ${editingItem.mediaType}: ${editingItem.title}`
      });
      setShowEditModal(false);
      setEditingItem(null);
      await loadMediaItems();
    } catch (error) {
      console.error('Error updating media:', error);
    }
  };

  // Handle delete
  const handleDelete = async (item: MediaItem) => {
    if (!confirm('Are you sure you want to delete "' + item.title + '"?')) return;
    try {
      await db.deleteMediaItem(item.id);
      await auditLog.log({
        action_type: 'delete',
        category: 'media',
        entity_type: item.mediaType,
        entity_id: item.id,
        entity_name: item.title,
        description: `Deleted ${item.mediaType}: ${item.title}`
      });
      await loadMediaItems();
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  // Toggle featured
  const toggleFeatured = async (item: MediaItem) => {
    try {
      await db.upsertMediaItem({ ...item, isFeatured: !item.isFeatured }, user?.id);
      await loadMediaItems();
    } catch (error) {
      console.error('Error toggling featured:', error);
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Stats
  const photoCount = mediaItems.filter(m => m.mediaType === 'photo').length;
  const videoCount = mediaItems.filter(m => m.mediaType === 'video').length;
  const featuredCount = mediaItems.filter(m => m.isFeatured).length;

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Camera className="w-7 h-7 text-orange-500" />
              Photo &amp; Video Gallery
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-400">Team media collection</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                isAdminRole(currentRole)
                  ? 'bg-purple-500/20 text-purple-400'
                  : currentRole === 'Crew Chief'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-slate-500/20 text-slate-400'
              }`}>
                <Shield className="w-3 h-3" />
                {currentRole}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadMediaItems}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {canUpload && (
              <>
                <button
                  onClick={() => setShowBatchImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <FolderUp className="w-4 h-4" />
                  Batch Import
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Media
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Image className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{photoCount}</p>
                <p className="text-sm text-slate-400">Photos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Film className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{videoCount}</p>
                <p className="text-sm text-slate-400">Videos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{featuredCount}</p>
                <p className="text-sm text-slate-400">Featured</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FolderOpen className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{categories.length}</p>
                <p className="text-sm text-slate-400">Categories</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MediaFilterType)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="all">All Types</option>

                <option value="photo">Photos Only</option>
                <option value="video">Videos Only</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-l-lg ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-r-lg ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Media Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
            <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Media Found</h3>
            <p className="text-slate-400 mb-4">
              {mediaItems.length === 0
                ? 'Start building your team gallery by uploading photos and videos.'
                : 'No media matches your current filters.'}
            </p>
            {canUpload && mediaItems.length === 0 && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Media
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className="group relative bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-orange-500/50 transition-all"
              >
                <div
                  className="aspect-square relative cursor-pointer"
                  onClick={() => setLightboxIndex(index)}
                >
                  {item.mediaType === 'photo' ? (
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Featured badge */}
                  {item.isFeatured && (
                    <div className="absolute top-2 left-2 p-1.5 bg-yellow-500 rounded-full">
                      <Star className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full backdrop-blur-sm">
                    {item.mediaType === 'photo' ? (
                      <Image className="w-3 h-3 text-white" />
                    ) : (
                      <Film className="w-3 h-3 text-white" />
                    )}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-medium truncate">{item.title}</p>
                      <p className="text-xs text-slate-300">{item.category}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(canEdit || canDelete) && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFeatured(item);
                          }}
                          className={`p-1.5 rounded-full backdrop-blur-sm ${
                            item.isFeatured ? 'bg-yellow-500 text-white' : 'bg-black/50 text-white hover:bg-yellow-500'
                          }`}
                        >
                          <Star className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm hover:bg-blue-500"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item);
                        }}
                        className="p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm hover:bg-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-orange-500/50 transition-all"
              >
                <div
                  className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={() => setLightboxIndex(index)}
                >
                  {item.mediaType === 'photo' ? (
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    {item.isFeatured && <Star className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <p className="text-sm text-slate-400 truncate">{item.description || 'No description'}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />
                      {item.category}
                    </span>
                    {item.eventDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.eventDate)}
                      </span>
                    )}
                    <span>{formatFileSize(item.fileSize)}</span>
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => toggleFeatured(item)}
                          className={`p-2 rounded-lg ${
                            item.isFeatured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400 hover:text-yellow-400'
                          }`}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowEditModal(true);
                          }}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && canUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-400" />
                Upload Media
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Selection */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="relative">
                    {selectedFile?.type.startsWith('video/') ? (
                      <video src={previewUrl} className="w-full h-48 object-cover rounded-lg" controls />
                    ) : (
                      <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    )}
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-orange-500 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-slate-400">Click to select photo or video</span>
                    <span className="text-xs text-slate-500">Supports images and videos</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter a title"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Event Date</label>
                  <DateInputDark
                    value={uploadForm.eventDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, eventDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Event Name</label>
                <input
                  type="text"
                  value={uploadForm.eventName}
                  onChange={(e) => setUploadForm({ ...uploadForm, eventName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., NHRA Nationals"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., burnout, qualifying, win"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadForm.isFeatured}
                    onChange={(e) => setUploadForm({ ...uploadForm, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500"
                  />
                  <span className="text-white text-sm">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadForm.isPublic}
                    onChange={(e) => setUploadForm({ ...uploadForm, isPublic: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500"
                  />
                  <span className="text-white text-sm">Public</span>
                </label>
              </div>
            </div>

            {/* Upload error message */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">{uploadError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !uploadForm.title || isUploading}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && canEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-400" />
                Edit Media
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Event Date</label>
                  <DateInputDark
                    value={editingItem.eventDate || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, eventDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Event Name</label>
                <input
                  type="text"
                  value={editingItem.eventName || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, eventName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isFeatured}
                    onChange={(e) => setEditingItem({ ...editingItem, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500"
                  />
                  <span className="text-white text-sm">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isPublic}
                    onChange={(e) => setEditingItem({ ...editingItem, isPublic: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500"
                  />
                  <span className="text-white text-sm">Public</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editingItem.title}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white hover:text-orange-400 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
              className="absolute left-4 p-2 text-white hover:text-orange-400 z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {lightboxIndex < filteredItems.length - 1 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
              className="absolute right-4 p-2 text-white hover:text-orange-400 z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="max-w-5xl max-h-[90vh] w-full mx-4">
            {filteredItems[lightboxIndex].mediaType === 'photo' ? (
              <img
                src={filteredItems[lightboxIndex].url}
                alt={filteredItems[lightboxIndex].title}
                className="max-w-full max-h-[80vh] mx-auto object-contain"
              />
            ) : (
              <video
                src={filteredItems[lightboxIndex].url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] mx-auto"
              />
            )}

            <div className="text-center mt-4">
              <h3 className="text-xl font-semibold text-white">{filteredItems[lightboxIndex].title}</h3>
              {filteredItems[lightboxIndex].description && (
                <p className="text-slate-400 mt-1">{filteredItems[lightboxIndex].description}</p>
              )}
              <div className="flex items-center justify-center gap-4 mt-2 text-sm text-slate-500">
                <span>{filteredItems[lightboxIndex].category}</span>
                {filteredItems[lightboxIndex].eventDate && (
                  <span>{formatDate(filteredItems[lightboxIndex].eventDate)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Photo Import Modal */}
      {showBatchImport && canUpload && (
        <BatchPhotoImport
          onClose={() => setShowBatchImport(false)}
          onComplete={loadMediaItems}
          userEmail={user?.email || undefined}
        />
      )}
    </section>
  );
};

export default MediaGallery;
