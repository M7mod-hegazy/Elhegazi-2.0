// Generate a data URI for fallback images
export const generateFallbackImage = (width: number, height: number, text: string = 'لا توجد صورة'): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f1f5f9');
  gradient.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Text
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.min(width, height) / 8}px Cairo, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  
  return canvas.toDataURL('image/png');
};

// Static base64 fallback images
export const FALLBACK_IMAGES = {
  small: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12" fill="%2394a3b8"%3Eلا توجد صورة%3C/text%3E%3C/svg%3E',
  medium: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f1f5f9" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="%2394a3b8"%3Eلا توجد صورة%3C/text%3E%3C/svg%3E',
  large: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="240"%3E%3Crect fill="%23f1f5f9" width="320" height="240"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="18" fill="%2394a3b8"%3Eلا توجد صورة%3C/text%3E%3C/svg%3E',
};

export const getFallbackImage = (size: 'small' | 'medium' | 'large' = 'medium'): string => {
  return FALLBACK_IMAGES[size];
};
