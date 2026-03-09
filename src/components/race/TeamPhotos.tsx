import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadWithFallback, getStorageErrorMessage } from '@/lib/storageUpload';
import * as db from '@/lib/database';
import { MediaItem } from '@/lib/database';
import {
  Camera,
  Upload,
  Image,
  Star,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Crown,
  ImagePlus,
  Maximize2,
  RefreshCw
} from 'lucide-react';

interface TeamPhotosProps {
  currentRole?: string;
}

const TeamPhotos: React.FC<TeamPhotosProps> = ({ currentRole = 'Crew' }) => {
  const { user, profile, updateProfile } = useAuth();
  const [teamPhotos, setTeamPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [settingLogo, setSettingLogo] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTeamPhotos();
  }, [user]);

  const loadTeamPhotos = async () => {
    setLoading(true);
    try {
      const items = await db.fetchMediaItems(user?.id);
      // Filter to team photos category
      const teamItems = items.filter(item =>
        item.category === 'Team' || item.category === 'Team Photo' || item.category === 'Car' || item.category === 'team-photos'
      );
      setTeamPhotos(teamItems);
    } catch (err) {
      console.error('Error loading team photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, isLogo: boolean = false) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload an image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUsedFallback(false);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const prefix = isLogo ? 'team-logo' : 'team-photo';
      const fileName = `team-photos/${prefix}-${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      // Use the shared upload utility with 3-tier fallback
      const result = await uploadWithFallback(file, fileName, file.type);

      if (!result.url) {
        throw new Error('Upload failed - no URL returned');
      }

      if (result.method === 'dataurl') {
        setUsedFallback(true);
      }

      // Save to media_gallery table
      const mediaItem: MediaItem & { id: string } = {
        id: `team-photo-${Date.now()}`,
        title: isLogo ? 'Team Logo' : file.name.replace(/\.[^/.]+$/, ''),
        description: isLogo ? 'Team logo image' : undefined,
        mediaType: 'photo',
        url: result.url,
        category: 'team-photos',
        tags: isLogo ? ['team', 'logo'] : ['team', 'car'],
        uploadedBy: user?.email || 'Unknown',
        fileSize: file.size,
        isFeatured: isLogo,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.upsertMediaItem(mediaItem, user?.id);

      // If it's a logo, also update the profile
      if (isLogo) {
        await updateProfile({ teamLogoUrl: result.url });
      }

      await loadTeamPhotos();

      setUploadSuccess(
        isLogo
          ? 'Team logo uploaded successfully!'
          : 'Photo uploaded successfully!'
      );
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(getStorageErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSetAsLogo = async (photo: MediaItem) => {
    setSettingLogo(photo.id);
    try {
      await updateProfile({ teamLogoUrl: photo.url });

      // Mark this one as featured, unmark others
      for (const p of teamPhotos) {
        if (p.id === photo.id && !p.isFeatured) {
          await db.upsertMediaItem({ ...p, isFeatured: true }, user?.id);
        } else if (p.id !== photo.id && p.isFeatured) {
          await db.upsertMediaItem({ ...p, isFeatured: false }, user?.id);
        }
      }

      await loadTeamPhotos();
      setUploadSuccess('Team logo updated!');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error setting logo:', err);
      setUploadError('Failed to set team logo: ' + err.message);
    } finally {
      setSettingLogo(null);
    }
  };

  const handleDeletePhoto = async (photo: MediaItem) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;

    setDeletingId(photo.id);
    try {
      // Try to delete from storage
      if (photo.url && !photo.url.startsWith('data:')) {
        const pathMatch = photo.url.match(/\/media\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('media').remove([pathMatch[1]]);
        }
      }

      // Delete from media_gallery table
      await db.deleteMediaItem(photo.id);

      // If this was the team logo, clear it
      if (profile?.teamLogoUrl === photo.url) {
        await updateProfile({ teamLogoUrl: undefined });
      }

      await loadTeamPhotos();
      setUploadSuccess('Photo deleted');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      setUploadError('Failed to delete photo: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const currentLogo = profile?.teamLogoUrl || null;

  return (
    <div className="space-y-6">
      {/* Team Logo Section */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Team Logo</h3>
            <p className="text-sm text-slate-400">Upload your team's logo or set one from your photos</p>
          </div>
        </div>

        <div className="flex items-start gap-6">
          {/* Logo Preview */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-600 overflow-hidden bg-slate-900/50 flex items-center justify-center">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Team Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-center">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">No logo</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Logo Button */}
          <div className="flex-1">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0], true);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload Logo</>
              )}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Recommended: Square image, at least 256x256px. JPG, PNG, WebP, or GIF.
            </p>
            {currentLogo && (
              <button
                onClick={() => updateProfile({ teamLogoUrl: undefined })}
                className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove current logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Status Messages */}
      {uploadError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{uploadError}</p>
            {uploadError.includes('security') || uploadError.includes('policy') ? (
              <p className="text-xs text-red-400/70 mt-1">
                Storage policies may need to be configured. Go to Admin Settings &gt; Storage Setup for instructions.
              </p>
            ) : null}
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300">{uploadSuccess}</p>
        </div>
      )}

      {usedFallback && !uploadError && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-300">
            Photo saved locally (cloud storage unavailable). Configure storage policies in Admin Settings for cloud persistence.
          </p>
        </div>
      )}

      {/* Team Photos Grid */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Image className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Team Photos ({teamPhotos.length})</h3>
              <p className="text-sm text-slate-400">Car photos, team shots, and race day images</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTeamPhotos}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  // Upload first file (could extend to multi-upload)
                  handleFileUpload(e.target.files[0], false);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><ImagePlus className="w-4 h-4" /> Add Photo</>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            <span className="ml-3 text-slate-400">Loading photos...</span>
          </div>
        ) : teamPhotos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera className="w-10 h-10 text-slate-500" />
            </div>
            <h4 className="text-white font-medium mb-2">No Team Photos Yet</h4>
            <p className="text-slate-400 text-sm mb-4">
              Upload photos of your car, team, or race day moments
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload First Photo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {teamPhotos.map((photo) => {
              const isLogo = profile?.teamLogoUrl === photo.url;
              const isDeleting = deletingId === photo.id;
              const isSettingAsLogo = settingLogo === photo.id;

              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    isLogo
                      ? 'border-purple-500 ring-2 ring-purple-500/30'
                      : 'border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {/* Image */}
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setPreviewImage(photo.url)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />

                  {/* Logo Badge */}
                  {isLogo && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-purple-600/90 backdrop-blur-sm rounded-lg">
                      <Crown className="w-3 h-3 text-white" />
                      <span className="text-xs text-white font-medium">Logo</span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-2 p-3 w-full">
                      {!isLogo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsLogo(photo);
                          }}
                          disabled={isSettingAsLogo}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-500/80 text-white rounded-lg text-xs font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
                          title="Set as team logo"
                        >
                          {isSettingAsLogo ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <><Star className="w-3 h-3" /> Set Logo</>
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(photo.url);
                        }}
                        className="flex items-center justify-center p-1.5 bg-slate-600/80 text-white rounded-lg hover:bg-slate-500 transition-colors"
                        title="View full size"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo);
                        }}
                        disabled={isDeleting}
                        className="flex items-center justify-center p-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                        title="Delete photo"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 group-hover:opacity-0 transition-opacity">
                    <p className="text-xs text-white truncate">{photo.title}</p>
                  </div>
                </div>
              );
            })}

            {/* Add Photo Card */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-600 hover:border-orange-500 hover:bg-slate-700/30 flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-8 h-8 text-slate-500" />
                  <span className="text-xs text-slate-500">Add Photo</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Full-size Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800/80 text-white rounded-full hover:bg-slate-700 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Full size preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default TeamPhotos;
