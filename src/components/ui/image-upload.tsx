import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/lib/api';

interface ImageUploadProps {
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeKB?: number;
  acceptedTypes?: string[];
  className?: string;
  multiple?: boolean;
  // Optional resize/compression controls
  maxWidth?: number; // e.g., 1280
  maxHeight?: number; // e.g., 1280
  quality?: number; // 0.1 - 1.0 initial quality for compression
  // Preloaded images (e.g., when editing)
  initialImages?: string[];
}

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
  const [images, setImages] = useState<string[]>([]);
  const [sizes, setSizes] = useState<number[]>([]); // bytes of compressed uploads aligned with images
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from initialImages when provided/changed
  useEffect(() => {
    if (Array.isArray(initialImages)) {
      setImages(initialImages);
      // Try to fetch blob sizes for preloaded images to show accurate labels
      (async () => {
        try {
          const fetchedSizes = await Promise.all(
            initialImages.map(async (url) => {
              try {
                const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
                const blob = await res.blob();
                return blob.size || 0;
              } catch {
                return 0;
              }
            })
          );
          setSizes(fetchedSizes);
        } catch {
          // Fallback to zeros if fetch fails
          setSizes(initialImages.map(() => 0));
        }
      })();
    }
  }, [initialImages]);

  // Helper: compress image using canvas, resize to fit within maxWidth/maxHeight, iterate quality down to fit maxSizeKB
  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    // Read into ImageBitmap or HTMLImageElement
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

    // Calculate target dimensions maintaining aspect ratio
    let { width, height } = img;
    const scale = Math.min(1, maxWidth / width || 1, maxHeight / height || 1);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    // draw with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer WEBP for better compression if supported
    const targetType = 'image/webp';
    const maxBytes = maxSizeKB * 1024;
    let q = Math.max(0.1, Math.min(1, quality));
    for (let i = 0; i < 6; i++) {
      const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), targetType, q));
      if (!blob) throw new Error('Failed to compress image');
      if (blob.size <= maxBytes || q <= 0.3) return blob;
      q = Math.max(0.1, q - 0.15); // reduce quality and retry
    }
    // Fallback last try
    const lastBlob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), targetType, 0.3));
    if (!lastBlob) throw new Error('Failed to compress image');
    return lastBlob;
  }, [maxWidth, maxHeight, maxSizeKB, quality]);

  const handleFiles = useCallback(async (files: FileList) => {
    setIsUploading(true);
    const newUrls: string[] = [];
    const newSizes: number[] = [];

    for (let i = 0; i < files.length && newUrls.length + images.length < maxImages; i++) {
      const file = files[i];

      if (!acceptedTypes.includes(file.type)) {
        continue;
      }

      try {
        // Compress client-side to reduce upload time/size
        const compressedBlob = await compressImage(file);
        const ext = 'webp';
        const compressedFile = new File([compressedBlob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: 'image/webp' });
        // Upload to backend -> Cloudinary, get secure_url
        const { secure_url } = await uploadFile(compressedFile);
        newUrls.push(secure_url);
        newSizes.push(compressedBlob.size);
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }

    const updatedImages = multiple ? [...images, ...newUrls] : newUrls.slice(0, 1);
    const updatedSizes = multiple ? [...sizes, ...newSizes] : newSizes.slice(0, 1);
    setImages(updatedImages);
    setSizes(updatedSizes);
    onImagesChange(updatedImages);
    setIsUploading(false);
  }, [images, sizes, maxImages, acceptedTypes, onImagesChange, multiple, compressImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeImage = useCallback((index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    const updatedSizes = sizes.filter((_, i) => i !== index);
    setImages(updatedImages);
    setSizes(updatedSizes);
    onImagesChange(updatedImages);
  }, [images, sizes, onImagesChange]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-slate-300 hover:border-primary hover:bg-slate-50'
          }
          ${images.length >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={images.length >= maxImages}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-slate-600">جاري رفع الصور...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                {multiple ? 'اسحب الصور هنا أو انقر للتحديد' : 'اسحب الصورة هنا أو انقر للتحديد'}
              </p>
              <p className="text-sm text-slate-500">
                {multiple ? `حد أقصى ${maxImages} صور` : 'صورة واحدة'} • حد أقصى {maxSizeKB}KB لكل صورة
              </p>
              <p className="text-xs text-slate-400 mt-1">
                يدعم: JPG, PNG, WebP
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={image}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Size label */}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {(() => {
                  const bytes = sizes[index] ?? 0;
                  const kb = bytes / 1024;
                  const mb = kb / 1024;
                  return kb < 1024 ? `${Math.round(kb)} KB` : `${mb.toFixed(2)} MB`;
                })()}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
              {index === 0 && multiple && (
                <div className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                  الصورة الرئيسية
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add More Button */}
      {images.length > 0 && images.length < maxImages && multiple && (
        <Button
          onClick={openFileDialog}
          variant="outline"
          className="w-full border-dashed border-2 border-slate-300 hover:border-primary"
        >
          <ImageIcon className="w-5 h-5 mr-2" />
          إضافة المزيد من الصور ({images.length}/{maxImages})
        </Button>
      )}
    </div>
  );
};

export default ImageUpload;
