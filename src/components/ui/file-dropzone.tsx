import { useCallback, useState } from 'react';
import { Upload, X, File, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
}

export function FileDropzone({
  onFilesAccepted,
  accept = '.glb,.gltf,.obj,.fbx',
  maxSize = 10485760, // 10MB
  maxFiles = 1,
  className
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `الملف ${file.name} كبير جداً. الحد الأقصى: ${(maxSize / 1024 / 1024).toFixed(0)} MB`;
    }

    const acceptedTypes = accept.split(',').map(t => t.trim());
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!acceptedTypes.includes(fileExt)) {
      return `نوع الملف ${fileExt} غير مدعوم. الأنواع المدعومة: ${accept}`;
    }

    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    setError('');
    const fileArray = Array.from(newFiles);

    // Validate files
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      setError(`يمكنك رفع ${maxFiles} ملف كحد أقصى`);
      return;
    }

    const updatedFiles = [...files, ...fileArray].slice(0, maxFiles);
    setFiles(updatedFiles);
    onFilesAccepted(updatedFiles);
  }, [files, maxFiles, onFilesAccepted, accept, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesAccepted(updatedFiles);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            'h-16 w-16 rounded-full flex items-center justify-center transition-colors',
            isDragging ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
          )}>
            <Upload className="h-8 w-8" />
          </div>

          <div>
            <p className="text-lg font-semibold text-slate-900">
              اسحب الملفات هنا أو انقر للاختيار
            </p>
            <p className="text-sm text-slate-600 mt-1">
              الأنواع المدعومة: {accept}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              الحد الأقصى: {(maxSize / 1024 / 1024).toFixed(0)} MB لكل ملف
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">الملفات المحددة:</p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <File className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-600">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center flex-shrink-0"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
