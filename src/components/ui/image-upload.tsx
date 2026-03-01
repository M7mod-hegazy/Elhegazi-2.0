import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle, Crown, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';

interface ImageUploadProps {
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeKB?: number;
  acceptedTypes?: string[];
  className?: string;
  multiple?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  initialImages?: string[];
}

interface FileEntry {
  id: string;
  name: string;
  previewUrl: string;
  remoteUrl?: string;
  progress: number;
  status: 'queued' | 'compressing' | 'uploading' | 'done' | 'error';
  error?: string;
  sizeBytes?: number;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {current + 1} / {images.length}
      </div>

      {/* Image */}
      <img
        src={images[current]}
        alt={`preview-${current}`}
        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-2 px-4">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-12 h-12 rounded-md overflow-hidden border-2 transition ${i === current ? 'border-white' : 'border-white/30 opacity-50'}`}
            >
              <img src={src} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ── Circular SVG progress ring ─────────────────────────────────────────────────
function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={4}
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        strokeLinecap="round" className="transition-all duration-300 ease-out"
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const ImageUpload = ({
  onImagesChange,
  maxImages = 5,
  maxSizeKB = 500,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  className = '',
  multiple = true,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8,
  initialImages = [],
}: ImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  // Initialise from initialImages
  const prevInitRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevInitRef.current;
    const same = prev.length === initialImages.length && prev.every((u, i) => u === initialImages[i]);
    if (same) return;
    prevInitRef.current = initialImages;
    setEntries(
      initialImages.map((url, i) => ({
        id: `init-${i}-${url}`,
        name: url.split('/').pop() || `image-${i + 1}`,
        previewUrl: url,
        remoteUrl: url,
        progress: 100,
        status: 'done',
      }))
    );
  }, [initialImages]);

  const syncParent = useCallback(
    (updated: FileEntry[]) => {
      const urls = updated.filter((e) => e.status === 'done' && e.remoteUrl).map((e) => e.remoteUrl!);
      onImagesChange(urls);
    },
    [onImagesChange]
  );

  // Set as main image — moves entry to index 0
  const setAsMain = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx <= 0) return prev;
        const next = [...prev];
        const [entry] = next.splice(idx, 1);
        next.unshift(entry);
        syncParent(next);
        return next;
      });
    },
    [syncParent]
  );

  // Open lightbox for all done images
  const openLightbox = useCallback((clickedEntry: FileEntry) => {
    const doneEntries = entries.filter((e) => e.status === 'done' && e.remoteUrl);
    const urls = doneEntries.map((e) => e.remoteUrl!);
    const index = doneEntries.findIndex((e) => e.id === clickedEntry.id);
    if (urls.length > 0) setLightbox({ urls, index: Math.max(0, index) });
  }, [entries]);

  // Compress
  const compressImage = useCallback(
    async (file: File): Promise<Blob> => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });
      let { width, height } = img;
      const scale = Math.min(1, maxWidth / width || 1, maxHeight / height || 1);
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.floor(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      const maxBytes = maxSizeKB * 1024;
      let q = Math.max(0.1, Math.min(1, quality));
      for (let i = 0; i < 6; i++) {
        const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/webp', q));
        if (!blob) throw new Error('Compress failed');
        if (blob.size <= maxBytes || q <= 0.3) return blob;
        q = Math.max(0.1, q - 0.15);
      }
      const last: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/webp', 0.3));
      if (!last) throw new Error('Compress failed');
      return last;
    },
    [maxWidth, maxHeight, maxSizeKB, quality]
  );

  // Upload via XHR with progress
  const uploadWithProgress = useCallback(
    (blob: Blob, fileName: string, onProgress: (pct: number) => void): Promise<string> => {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', new File([blob], fileName, { type: 'image/webp' }));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/cloudinary/upload-file');
        try {
          const adminToken = localStorage.getItem('admin.auth.token');
          const adminUid = localStorage.getItem('admin.auth.userId');
          const adminEmail = localStorage.getItem('admin.auth.userEmail');
          const uid = localStorage.getItem('auth.userId');
          const email = localStorage.getItem('auth.userEmail');
          const token = localStorage.getItem('auth.token');
          const mode = localStorage.getItem('AUTH_MODE');
          if (adminUid) xhr.setRequestHeader('x-user-id', adminUid);
          else if (uid) xhr.setRequestHeader('x-user-id', uid);
          if (adminEmail) xhr.setRequestHeader('x-user-email', adminEmail);
          else if (email) xhr.setRequestHeader('x-user-email', email);
          if (mode) xhr.setRequestHeader('x-auth-mode', mode);
          if (adminToken) xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);
          else if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        } catch { /* ignore */ }
        xhr.withCredentials = true;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText);
              if (resp.ok && resp.result?.secure_url) { onProgress(100); resolve(resp.result.secure_url); }
              else reject(new Error(resp.error || 'Upload failed'));
            } catch { reject(new Error('Invalid response')); }
          } else {
            let msg = `Server error ${xhr.status}`;
            try { const r = JSON.parse(xhr.responseText); if (r.error) msg = r.error; } catch { /* */ }
            reject(new Error(msg));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Aborted')));
        xhr.send(fd);
      });
    },
    []
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      const currentDone = entries.filter((e) => e.status === 'done' && e.remoteUrl).length;
      const slots = maxImages - currentDone;
      if (slots <= 0) return;
      const toProcess = Array.from(files).filter((f) => acceptedTypes.includes(f.type)).slice(0, slots);
      if (toProcess.length === 0) return;

      const newEntries: FileEntry[] = toProcess.map((f) => ({
        id: `upload-${Date.now()}-${Math.random()}`,
        name: f.name,
        previewUrl: URL.createObjectURL(f),
        progress: 0,
        status: 'queued',
      }));
      setEntries((prev) => { const next = [...prev, ...newEntries]; return multiple ? next : next.slice(-1); });

      for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i];
        const entry = newEntries[i];
        setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'compressing', progress: 0 } : e));
        try {
          const blob = await compressImage(file);
          const fileName = `${file.name.replace(/\.[^.]+$/, '')}.webp`;
          setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'uploading', sizeBytes: blob.size } : e));
          const secureUrl = await uploadWithProgress(blob, fileName, (pct) => {
            setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, progress: pct } : e));
          });
          setEntries((prev) => {
            const next = prev.map((e) => e.id === entry.id ? { ...e, status: 'done' as const, remoteUrl: secureUrl, progress: 100 } : e);
            syncParent(next);
            return next;
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'error' as const, error: msg } : e));
        }
      }
    },
    [entries, maxImages, acceptedTypes, multiple, compressImage, uploadWithProgress, syncParent]
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => {
          if (e.id !== id) return true;
          if (!e.remoteUrl && e.previewUrl.startsWith('blob:')) URL.revokeObjectURL(e.previewUrl);
          return false;
        });
        syncParent(next);
        return next;
      });
    },
    [syncParent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const openFileDialog = () => fileInputRef.current?.click();
  const totalDone = entries.filter((e) => e.status === 'done').length;
  const hasUploading = entries.some((e) => e.status === 'uploading' || e.status === 'compressing' || e.status === 'queued');
  const isFull = totalDone >= maxImages;

  return (
    <div className={`space-y-3 ${className}`}>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onClick={isFull ? undefined : openFileDialog}
        className={[
          'relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-300',
          isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary hover:bg-slate-50',
          isFull ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={isFull}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {isFull ? `وصلت للحد الأقصى (${maxImages} صور)` : multiple ? 'اسحب الصور هنا أو انقر للتحديد' : 'اسحب الصورة هنا أو انقر للتحديد'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiple ? `حد أقصى ${maxImages} صور` : 'صورة واحدة'} • {maxSizeKB}KB لكل صورة • JPG, PNG, WebP
            </p>
          </div>
        </div>
      </div>

      {/* Image Cards Grid */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {entries.map((entry, index) => {
            const isDone = entry.status === 'done';
            const isMain = index === 0 && multiple && isDone;
            return (
              <div key={entry.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">

                {/* Thumbnail — click to preview */}
                <div
                  className={`aspect-square bg-slate-100 relative overflow-hidden ${isDone ? 'cursor-zoom-in' : ''}`}
                  onClick={() => isDone && openLightbox(entry)}
                >
                  <img
                    src={entry.previewUrl}
                    alt={entry.name}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${isDone ? 'opacity-100' : 'opacity-50'}`}
                    draggable={false}
                  />

                  {/* Uploading overlay */}
                  {entry.status !== 'done' && entry.status !== 'error' && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                      <ProgressRing progress={entry.progress} size={44} />
                      <p className="text-white text-[10px] font-semibold">
                        {entry.status === 'compressing' ? 'ضغط...' : entry.status === 'queued' ? 'انتظار' : `${entry.progress}%`}
                      </p>
                    </div>
                  )}

                  {/* Error overlay */}
                  {entry.status === 'error' && (
                    <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1 p-2">
                      <AlertCircle className="w-5 h-5 text-red-200" />
                      <p className="text-red-100 text-[9px] text-center leading-tight">{entry.error || 'فشل الرفع'}</p>
                    </div>
                  )}

                  {/* Main image crown badge */}
                  {isMain && (
                    <div className="absolute top-1 left-1 bg-amber-400 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold shadow">
                      <Crown className="w-2.5 h-2.5" />
                      رئيسية
                    </div>
                  )}

                  {/* Zoom hint on hover */}
                  {isDone && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                    </div>
                  )}

                  {/* Progress bar strip */}
                  {(entry.status === 'uploading' || entry.status === 'compressing' || entry.status === 'queued') && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                      <div className="h-1 bg-primary transition-all duration-300" style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                </div>

                {/* Action bar — only for done cards */}
                {isDone && multiple && !isMain && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setAsMain(entry.id); }}
                    title="اجعلها الصورة الرئيسية"
                    className="absolute bottom-0 left-0 right-0 bg-amber-400/0 group-hover:bg-amber-400 text-amber-400 group-hover:text-white text-[9px] font-bold flex items-center justify-center gap-0.5 h-5 transition-all duration-200"
                  >
                    <Crown className="w-2.5 h-2.5" />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">رئيسية</span>
                  </button>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-20 shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add More */}
      {entries.length > 0 && !isFull && multiple && !hasUploading && (
        <Button
          type="button"
          onClick={openFileDialog}
          variant="outline"
          className="w-full border-dashed border-2 border-slate-300 hover:border-primary h-9 text-sm"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          إضافة المزيد ({totalDone}/{maxImages})
        </Button>
      )}

      {/* Lightbox portal */}
      {lightbox && (
        <Lightbox
          images={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default ImageUpload;
