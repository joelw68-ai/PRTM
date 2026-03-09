import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as db from '@/lib/database';
import { MediaItem } from '@/lib/database';
import {
  Camera,
  Upload,
  X,
  Image,
  Link,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Check,
  Loader2,
  Grid,
  Crop,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  AlertTriangle
} from 'lucide-react';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage: string;
  defaultImage: string;
  onSave: (imageUrl: string) => void;
}

// Utility: Resize an image file to a max dimension, returns a Blob
const resizeImage = (file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if the image exceeds max dimensions
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
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Utility: Convert a Blob to a data URL for localStorage fallback
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

// Helper: Upload to Supabase storage with proper error handling and fallback
const uploadToStorage = async (
  blob: Blob,
  filePath: string,
  contentType: string = 'image/jpeg'
): Promise<{ publicUrl: string | null; error: any }> => {
  try {
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, blob, {
        contentType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      return { publicUrl: null, error: uploadError };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { publicUrl, error: null };
  } catch (err) {
    return { publicUrl: null, error: err };
  }
};

// Helper: Get a user-friendly error message from storage errors
const getStorageErrorMessage = (error: any): string => {
  const msg = error?.message || error?.error || String(error);
  
  if (msg.includes('Bucket not found') || msg.includes('bucket') || msg.includes('not found')) {
    return 'Storage bucket "media" not found. Run the sql_storage_fix.sql migration in the Supabase SQL Editor to create it.';
  }
  if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
    return 'Storage upload blocked by security policy. Run the sql_storage_fix.sql migration to fix storage permissions.';
  }
  if (msg.includes('Payload too large') || msg.includes('file size')) {
    return 'Image file is too large. Please choose a smaller image (max 50MB).';
  }
  if (msg.includes('mime') || msg.includes('type')) {
    return 'Unsupported file type. Please use JPG, PNG, GIF, or WebP.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your internet connection and try again.';
  }
  return `Upload failed: ${msg}`;
};


const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  currentImage,
  defaultImage,
  onSave
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<MediaItem[]>([]);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  
  // Cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1' | 'free'>('16:9');
  
  // Track natural image dimensions for proper centering
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  // Clear error when changing tabs or actions
  useEffect(() => {
    setUploadError(null);
    setUsedFallback(false);
  }, [activeTab, showCropper]);

  // Load gallery images when gallery tab is selected
  useEffect(() => {
    if (activeTab === 'gallery' && galleryImages.length === 0) {
      loadGalleryImages();
    }
  }, [activeTab]);

  const loadGalleryImages = async () => {
    setIsLoadingGallery(true);
    try {
      const items = await db.fetchMediaItems(user?.id);
      const photos = items.filter(item => item.mediaType === 'photo');
      setGalleryImages(photos);
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      const url = URL.createObjectURL(file);
      setPreviewImage(url);
      setCropImage(url);
      setShowCropper(true);
      resetCropState();
    }
  };

  // Reset crop state
  const resetCropState = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle gallery image selection
  const handleGallerySelect = (imageUrl: string) => {
    setSelectedGalleryImage(imageUrl);
    setPreviewImage(imageUrl);
    setCropImage(imageUrl);
    setShowCropper(true);
    resetCropState();
  };

  // Handle URL input
  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setPreviewImage(urlInput.trim());
      setCropImage(urlInput.trim());
      setShowCropper(true);
      resetCropState();
    }
  };

  // Handle revert to default
  const handleRevertToDefault = () => {
    onSave(defaultImage);
    onClose();
  };

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get crop dimensions based on aspect ratio
  const getCropDimensions = () => {
    const containerWidth = 500;
    const containerHeight = 300;
    
    switch (aspectRatio) {
      case '16:9':
        return { width: containerWidth, height: containerWidth * (9/16) };
      case '4:3':
        return { width: containerWidth, height: containerWidth * (3/4) };
      case '1:1':
        return { width: containerHeight, height: containerHeight };
      case 'free':
      default:
        return { width: containerWidth, height: containerHeight };
    }
  };

  // Calculate the base scale to fit the image within the crop container
  const getBaseScale = () => {
    if (naturalSize.width === 0 || naturalSize.height === 0) return 1;
    const cropDims = getCropDimensions();
    // Scale to cover the crop area (like object-cover)
    return Math.max(cropDims.width / naturalSize.width, cropDims.height / naturalSize.height);
  };

  // Handle image load to get natural dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  };

  // Helper: Try uploading to Supabase, fall back to data URL if it fails
  const uploadBlobOrFallback = async (blob: Blob, fileName: string): Promise<string> => {
    const filePath = `car-images/${fileName}`;
    const { publicUrl, error } = await uploadToStorage(blob, filePath);
    
    if (publicUrl && !error) {
      return publicUrl;
    }
    
    // Upload failed — fall back to data URL saved in localStorage
    console.warn('Storage upload failed, falling back to data URL:', error);
    setUsedFallback(true);
    
    // Convert blob to data URL
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl;
  };

  // Apply crop and save
  const applyCropAndSave = async () => {
    if (!cropImage) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUsedFallback(false);
    
    try {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      
      if (!canvas || !img || naturalSize.width === 0) {
        // If no cropping needed, just use the image directly
        if (selectedFile) {
          const resizedBlob = await resizeImage(selectedFile);
          const fileName = `car-hero-${Date.now()}.jpg`;
          const imageUrl = await uploadBlobOrFallback(resizedBlob, fileName);
          onSave(imageUrl);
        } else if (selectedGalleryImage) {
          onSave(selectedGalleryImage);
        } else if (urlInput) {
          onSave(urlInput);
        }
        onClose();
        return;
      }

      // Get crop dimensions
      const cropDims = getCropDimensions();
      const outputScale = Math.min(2, 1920 / cropDims.width);
      canvas.width = Math.round(cropDims.width * outputScale);
      canvas.height = Math.round(cropDims.height * outputScale);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Calculate the visible area matching the preview exactly
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      
      // Base scale fits the image to cover the crop area
      const baseScale = getBaseScale();
      const totalScale = baseScale * zoom;
      
      // Scaled dimensions of the image
      const scaledWidth = imgWidth * totalScale;
      const scaledHeight = imgHeight * totalScale;
      
      // Image is centered in the crop area, then offset by position
      const offsetX = (cropDims.width - scaledWidth) / 2 + position.x;
      const offsetY = (cropDims.height - scaledHeight) / 2 + position.y;
      
      // Draw the image onto the canvas
      ctx.drawImage(
        img,
        0, 0, imgWidth, imgHeight,
        offsetX * outputScale, offsetY * outputScale, scaledWidth * outputScale, scaledHeight * outputScale
      );

      // Convert to blob and upload
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob from canvas')),
          'image/jpeg',
          0.85
        );
      });

      const fileName = `car-hero-${Date.now()}.jpg`;
      const imageUrl = await uploadBlobOrFallback(blob, fileName);
      onSave(imageUrl);
      onClose();
    } catch (error: any) {
      console.error('Error saving image:', error);
      setUploadError(getStorageErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  // Skip cropping and save directly (with resize)
  const saveWithoutCrop = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUsedFallback(false);
    
    try {
      if (selectedFile) {
        const resizedBlob = await resizeImage(selectedFile);
        const fileName = `car-hero-${Date.now()}.jpg`;
        const imageUrl = await uploadBlobOrFallback(resizedBlob, fileName);
        onSave(imageUrl);
      } else if (selectedGalleryImage) {
        onSave(selectedGalleryImage);
      } else if (urlInput) {
        onSave(urlInput);
      } else if (previewImage) {
        onSave(previewImage);
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving image:', error);
      setUploadError(getStorageErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const cropDims = getCropDimensions();
  const baseScale = getBaseScale();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-400" />
            Change Car Photo
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevertToDefault}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Revert to Default
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!showCropper ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeTab === 'upload'
                      ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-700/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                <button
                  onClick={() => setActiveTab('gallery')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeTab === 'gallery'
                      ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-700/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  Gallery
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeTab === 'url'
                      ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-700/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Link className="w-4 h-4" />
                  URL
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Current Image Preview */}
                <div className="mb-6">
                  <p className="text-sm text-slate-400 mb-2">Current Image</p>
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-600">
                    <img
                      src={currentImage}
                      alt="Current car"
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  </div>
                </div>

                {/* Upload Tab */}
                {activeTab === 'upload' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-orange-500 hover:bg-slate-700/30 transition-all"
                    >
                      <div className="p-4 bg-slate-700 rounded-full">
                        <Upload className="w-8 h-8 text-orange-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">Click to upload an image</p>
                        <p className="text-sm text-slate-400 mt-1">JPG, PNG, GIF up to 10MB</p>
                        <p className="text-xs text-slate-500 mt-1">Images will be automatically resized to fit</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Gallery Tab */}
                {activeTab === 'gallery' && (
                  <div>
                    {isLoadingGallery ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
                      </div>
                    ) : galleryImages.length === 0 ? (
                      <div className="text-center py-12">
                        <Image className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No images in gallery</p>
                        <p className="text-sm text-slate-500 mt-1">Upload images to the Media Gallery first</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                        {galleryImages.map((image) => (
                          <button
                            key={image.id}
                            onClick={() => handleGallerySelect(image.url)}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedGalleryImage === image.url
                                ? 'border-orange-500 ring-2 ring-orange-500/50'
                                : 'border-transparent hover:border-slate-500'
                            }`}
                          >
                            <img
                              src={image.url}
                              alt={image.title}
                              className="w-full h-full object-cover object-center"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* URL Tab */}
                {activeTab === 'url' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Image URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                        />
                        <button
                          onClick={handleUrlSubmit}
                          disabled={!urlInput.trim()}
                          className="px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                    {urlInput && (
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Preview</p>
                        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-600">
                          <img
                            src={urlInput}
                            alt="URL preview"
                            className="absolute inset-0 w-full h-full object-cover object-center"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Cropping Interface */
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    setShowCropper(false);
                    setPreviewImage(null);
                    setCropImage(null);
                    setSelectedFile(null);
                    setSelectedGalleryImage(null);
                    setNaturalSize({ width: 0, height: 0 });
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <h4 className="text-white font-medium flex items-center gap-2">
                  <Crop className="w-4 h-4 text-orange-400" />
                  Adjust & Crop
                </h4>
                <div className="w-16" />
              </div>

              {/* Aspect Ratio Controls */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-sm text-slate-400 mr-2">Aspect Ratio:</span>
                {(['16:9', '4:3', '1:1', 'free'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      aspectRatio === ratio
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {ratio === 'free' ? 'Free' : ratio}
                  </button>
                ))}
              </div>

              {/* Crop Area */}
              <div
                ref={cropContainerRef}
                className="relative mx-auto bg-slate-900 rounded-lg overflow-hidden border border-slate-600"
                style={{ width: Math.min(cropDims.width, window.innerWidth - 80), height: Math.min(cropDims.height, 400), maxWidth: '100%' }}
              >
                {cropImage && (
                  <div
                    className="absolute inset-0 cursor-move overflow-hidden"
                    onMouseDown={handleMouseDown}
                    style={{ touchAction: 'none' }}
                  >
                    <img
                      ref={imageRef}
                      src={cropImage}
                      alt="Crop preview"
                      className="absolute"
                      onLoad={handleImageLoad}
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${baseScale * zoom})`,
                        transformOrigin: 'center center',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        pointerEvents: 'none'
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                )}
                
                {/* Crop overlay grid */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-2 border-orange-500/50" />
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-orange-500/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-orange-500/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-orange-500/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-orange-500/30" />
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 w-48">
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-sm text-slate-400 w-12">{Math.round(zoom * 100)}%</span>
                </div>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={resetCropState}
                  className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                  title="Reset position"
                >
                  <Move className="w-5 h-5" />
                </button>
              </div>

              <p className="text-center text-sm text-slate-500 mt-2">
                Drag the image to reposition, use slider to zoom
              </p>

              {/* Hidden canvas for cropping */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {/* Error Message */}
        {uploadError && (
          <div className="mx-4 mb-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{uploadError}</p>
              {uploadError.includes('sql_storage_fix') && (
                <p className="text-xs text-red-400/70 mt-1">
                  Go to Supabase Dashboard &gt; SQL Editor &gt; paste and run sql_storage_fix.sql
                </p>
              )}
            </div>
            <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Fallback Success Message */}
        {usedFallback && !uploadError && (
          <div className="mx-4 mb-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-300">
                Image saved locally (cloud upload unavailable). Run sql_storage_fix.sql for cloud storage.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex items-center gap-2">
            {showCropper && (
              <button
                onClick={saveWithoutCrop}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors disabled:opacity-50"
              >
                <Maximize2 className="w-4 h-4" />
                Use Original
              </button>
            )}
            <button
              onClick={showCropper ? applyCropAndSave : () => {}}
              disabled={isUploading || (!showCropper && !previewImage)}
              className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {showCropper ? 'Apply & Save' : 'Continue'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
