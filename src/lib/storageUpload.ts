// Shared storage upload utilities with edge function fallback
// This module provides a reliable upload path that works even when
// storage.objects RLS policies are missing.

import { supabase } from './supabase';

/**
 * Convert a Blob to a base64 string (without the data:... prefix)
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:...;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert a Blob to a full data URL (for localStorage fallback)
 */
export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Get a user-friendly error message from storage errors
 */
export const getStorageErrorMessage = (error: any): string => {
  const msg = error?.message || error?.error || String(error);
  
  if (msg.includes('Bucket not found') || msg.includes('bucket') || msg.includes('not found')) {
    return 'Storage bucket "media" not found. The media bucket needs to be created in Supabase.';
  }
  if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy') || msg.includes('security')) {
    return 'Storage upload blocked by security policy. Storage policies may need to be configured.';
  }
  if (msg.includes('Payload too large') || msg.includes('file size')) {
    return 'File is too large. Please choose a smaller file (max 50MB).';
  }
  if (msg.includes('mime') || msg.includes('type')) {
    return 'Unsupported file type.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your internet connection and try again.';
  }
  return `Upload failed: ${msg}`;
};

/**
 * Upload a file directly to Supabase storage (client-side).
 * Returns the public URL on success, or null + error on failure.
 */
export const uploadDirect = async (
  blob: Blob,
  filePath: string,
  contentType: string = 'application/octet-stream'
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

/**
 * Upload a file via the storage-upload edge function (server-side, bypasses RLS).
 * Returns the public URL on success, or null + error on failure.
 */
export const uploadViaEdgeFunction = async (
  blob: Blob,
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<{ publicUrl: string | null; error: any }> => {
  try {
    const base64Data = await blobToBase64(blob);
    
    const { data, error } = await supabase.functions.invoke('storage-upload', {
      body: {
        fileName,
        fileData: base64Data,
        fileContentType: contentType,
        bucket: 'media'
      }
    });

    if (error) {
      return { publicUrl: null, error };
    }

    if (data?.error) {
      return { publicUrl: null, error: new Error(data.error) };
    }

    return { publicUrl: data?.publicUrl || null, error: null };
  } catch (err) {
    return { publicUrl: null, error: err };
  }
};

/**
 * Upload a file with automatic fallback:
 * 1. Try direct Supabase storage upload (fastest)
 * 2. If that fails (RLS), try the edge function (server-side, bypasses RLS)
 * 3. If that also fails, return a data URL for localStorage fallback
 * 
 * Returns { publicUrl, usedFallback, error }
 */
export const uploadWithFallback = async (
  blob: Blob,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<{ url: string; method: 'direct' | 'edge' | 'dataurl'; error: any }> => {
  // Attempt 1: Direct upload
  const directResult = await uploadDirect(blob, fileName, contentType);
  if (directResult.publicUrl) {
    return { url: directResult.publicUrl, method: 'direct', error: null };
  }
  
  console.warn('Direct storage upload failed, trying edge function:', directResult.error);
  
  // Attempt 2: Edge function upload
  const edgeResult = await uploadViaEdgeFunction(blob, fileName, contentType);
  if (edgeResult.publicUrl) {
    return { url: edgeResult.publicUrl, method: 'edge', error: null };
  }
  
  console.warn('Edge function upload failed, falling back to data URL:', edgeResult.error);
  
  // Attempt 3: Data URL fallback (for localStorage)
  try {
    const dataUrl = await blobToDataUrl(blob);
    return { url: dataUrl, method: 'dataurl', error: edgeResult.error };
  } catch (err) {
    return { url: '', method: 'dataurl', error: err };
  }
};

/**
 * Upload a File object with fallback. Convenience wrapper.
 */
export const uploadFileWithFallback = async (
  file: File,
  pathPrefix: string = 'uploads'
): Promise<{ url: string; method: 'direct' | 'edge' | 'dataurl'; error: any; fileName: string }> => {
  const ext = file.name.split('.').pop() || 'bin';
  const uniqueName = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  
  const result = await uploadWithFallback(file, uniqueName, file.type);
  return { ...result, fileName: file.name };
};
