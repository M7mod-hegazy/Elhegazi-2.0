import { useState, useEffect } from 'react';
import { useSiteName } from '@/hooks/useSiteName';

interface LogoData {
  url: string;
  altText: string;
  width: number;
  height: number;
}

/**
 * Custom hook to get the site logo - now uses fixed iconPng.png
 * Returns logo URL, alt text, and dimensions
 */
export function useLogo() {
  const { siteName } = useSiteName();
  const [logo, setLogo] = useState<LogoData>({
    url: '/iconPng.png',
    altText: siteName || 'Store Logo',
    width: 150,
    height: 150
  });
  const [isLoading, setIsLoading] = useState(false); // No loading needed for fixed logo

  useEffect(() => {
    setLogo({
      url: '/iconPng.png',
      altText: siteName || 'Store Logo',
      width: 150,
      height: 150
    });
  }, [siteName]);

  return { logo, isLoading };
}

/**
 * Get logo URL synchronously - now returns fixed iconPng.png path
 */
export function getLogoUrl(): string {
  return '/iconPng.png';
}

/**
 * Legacy compatibility - now returns fixed logo data
 */
export async function preloadLogo(): Promise<LogoData> {
  return {
    url: '/iconPng.png',
    altText: 'Store Logo',
    width: 150,
    height: 150
  };
}

/**
 * Legacy compatibility - no longer needed with fixed logo system
 */
export function clearLogoCache() {
  console.log('clearLogoCache called - no longer needed with fixed logo system');
}
