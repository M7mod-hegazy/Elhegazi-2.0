/**
 * Image Optimization Utilities
 * Handles responsive images, lazy loading, and format optimization
 */

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
  lazy?: boolean;
}

/**
 * Generate optimized image URL
 * Supports multiple formats and sizes
 */
export const optimizeImage = (
  url: string,
  options: ImageOptimizationOptions = {}
): string => {
  if (!url) return '';

  const {
    width = 800,
    height,
    quality = 80,
    format = 'webp',
  } = options;

  // If URL is already optimized or external, return as-is
  if (url.includes('cloudinary') || url.includes('imgix') || url.startsWith('data:')) {
    return url;
  }

  // For local images, add query parameters for optimization
  const separator = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    w: width.toString(),
    q: quality.toString(),
    f: format,
  });

  if (height) {
    params.append('h', height.toString());
  }

  return `${url}${separator}${params.toString()}`;
};

/**
 * Generate responsive image srcset
 * Creates multiple sizes for different screen resolutions
 */
export const generateSrcSet = (
  url: string,
  sizes: number[] = [320, 640, 960, 1280]
): string => {
  return sizes
    .map((size) => `${optimizeImage(url, { width: size })} ${size}w`)
    .join(', ');
};

/**
 * Generate picture element with WebP fallback
 */
export const generatePictureHTML = (
  url: string,
  alt: string,
  options: ImageOptimizationOptions & { sizes?: string } = {}
): string => {
  const { sizes = '(max-width: 640px) 100vw, 50vw', lazy = true } = options;

  const webpSrcSet = generateSrcSet(url);
  const jpgSrcSet = generateSrcSet(url).replace(/webp/g, 'jpg');

  const loading = lazy ? 'lazy' : 'eager';

  return `
    <picture>
      <source srcset="${webpSrcSet}" type="image/webp" sizes="${sizes}" />
      <source srcset="${jpgSrcSet}" type="image/jpeg" sizes="${sizes}" />
      <img 
        src="${optimizeImage(url, { width: 800, format: 'jpg' })}" 
        alt="${alt}"
        loading="${loading}"
        decoding="async"
        width="800"
        height="600"
      />
    </picture>
  `;
};

/**
 * React component for optimized images
 */
export interface OptimizedImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: number;
  lazy?: boolean;
  placeholder?: string;
}

/**
 * Get image dimensions for aspect ratio
 */
export const getImageDimensions = (
  url: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Preload images for better performance
 */
export const preloadImage = (url: string): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = optimizeImage(url, { width: 1280 });
  document.head.appendChild(link);
};

/**
 * Prefetch images for next page
 */
export const prefetchImages = (urls: string[]): void => {
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = optimizeImage(url, { width: 640 });
    document.head.appendChild(link);
  });
};

/**
 * Lazy load images with Intersection Observer
 */
export const lazyLoadImages = (selector: string = 'img[data-src]'): void => {
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without IntersectionObserver
    document.querySelectorAll(selector).forEach((img: Element) => {
      const htmlImg = img as HTMLImageElement;
      if (htmlImg.dataset.src) {
        htmlImg.src = htmlImg.dataset.src;
      }
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll(selector).forEach((img) => {
    observer.observe(img);
  });
};

/**
 * Get WebP support status
 */
export const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoBIAEAQAcJaACdLoAA3AAA/v3AgAA=';
  });
};

/**
 * Image compression utility
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1280,
  maxHeight: number = 1280,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob(resolve, 'image/webp', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};
