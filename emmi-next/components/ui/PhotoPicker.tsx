'use client';
// components/ui/PhotoPicker.tsx — Photo attachment component
// Supports TWO input methods:
//   1. Camera capture  — takes a photo directly with device camera
//   2. Local file pick — browse gallery / file explorer for existing photos
//
// Usage:
//   <PhotoPicker
//     photos={urls}
//     onChange={setPhotos}
//     folder="faults"
//     userId={userId}
//   />

import { useRef, useState } from 'react';
import { Camera, FolderOpen, X, Loader2, ImageIcon } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import { uploadPhoto } from '@/lib/utils';
import Image from 'next/image';

interface Props {
  photos:   string[];                    // Current array of photo URLs
  onChange: (urls: string[]) => void;   // Called when photos change
  folder:   string;                      // Storage subfolder: 'faults', 'equipment', etc.
  userId:   string;
  maxPhotos?: number;                    // Max allowed (default: 5)
}

export default function PhotoPicker({ photos, onChange, folder, userId, maxPhotos = 5 }: Props) {
  const supabase = createBrowserClient();

  // Two hidden file inputs — one for camera, one for gallery/file system
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // ── Handle file selection ─────────────────────────────────
  // Called when user selects file(s) from camera or gallery
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Check max photos limit
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload all selected files (up to remaining slots)
      const newUrls: string[] = [];
      const filesToUpload = Array.from(files).slice(0, remaining);

      for (const file of filesToUpload) {
        // Validate file type — only images
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed');
          continue;
        }
        // Validate file size — max 10MB per photo
        if (file.size > 10 * 1024 * 1024) {
          setError('Each photo must be under 10MB');
          continue;
        }

        // Upload to Supabase Storage and get public URL
        const url = await uploadPhoto(supabase, userId, file, folder);
        newUrls.push(url);
      }

      // Merge new URLs with existing ones
      onChange([...photos, ...newUrls]);
    } catch (err: any) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      // Reset inputs so same file can be selected again if needed
      if (cameraRef.current)  cameraRef.current.value  = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  // ── Remove a photo ────────────────────────────────────────
  function removePhoto(url: string) {
    onChange(photos.filter(p => p !== url));
    // Note: we don't delete from Supabase Storage here to keep it simple.
    // Orphaned files can be cleaned up via Supabase dashboard.
  }

  const canAdd = photos.length < maxPhotos && !uploading;

  return (
    <div>
      {/* Existing photos grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)' }}>
              {/* Photo thumbnail */}
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="100px"
              />
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
              >
                <X size={10} strokeWidth={3}/>
              </button>
            </div>
          ))}

          {/* Uploading placeholder */}
          {uploading && (
            <div className="aspect-square rounded-lg flex items-center justify-center"
              style={{ border: '1px dashed var(--border)', background: 'var(--surface)' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--amber)' }}/>
            </div>
          )}
        </div>
      )}

      {/* Empty state — show icon placeholder if no photos yet */}
      {photos.length === 0 && !uploading && (
        <div className="flex items-center gap-3 p-3 rounded-lg mb-3"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <ImageIcon size={20} style={{ color: 'var(--text-3)' }}/>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            No photos attached yet
          </span>
        </div>
      )}

      {/* Add photo buttons */}
      {canAdd && (
        <div className="flex gap-2">
          {/* Camera button — opens device camera directly */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-2)',
            }}
          >
            <Camera size={15}/>
            Take Photo
          </button>

          {/* Gallery / file browser button — opens file explorer */}
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-2)',
            }}
          >
            <FolderOpen size={15}/>
            From Device
          </button>
        </div>
      )}

      {/* Photo count */}
      <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
        {photos.length}/{maxPhotos} photos
        {canAdd ? ` · Max 10MB each` : ' · Limit reached'}
      </p>

      {/* Error message */}
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>
          ⚠ {error}
        </p>
      )}

      {/* Hidden camera input — capture="environment" opens rear camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"   // Uses device camera directly on mobile
        multiple={false}        // One photo at a time from camera
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Hidden gallery/file input — no capture attribute = file browser */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple                // Allow selecting multiple files from gallery
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
