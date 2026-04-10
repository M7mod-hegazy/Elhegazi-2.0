import { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';

interface LogoData {
  url: string;
  publicId?: string;
  altText: string;
  width: number;
  height: number;
}

const DEFAULT_LOGO: LogoData = {
  url: '/iconPng.png',
  publicId: '',
  altText: 'Store Logo',
  width: 150,
  height: 150,
};

const LOGO_CACHE_KEY = 'cached_site_logo';

function readCachedLogo(): LogoData {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    if (!raw) return DEFAULT_LOGO;
    const parsed = JSON.parse(raw);
    const url = String(parsed?.url || '').trim();
    if (!url) return DEFAULT_LOGO;
    return {
      url,
      publicId: String(parsed?.publicId || ''),
      altText: String(parsed?.altText || DEFAULT_LOGO.altText),
      width: Number(parsed?.width || DEFAULT_LOGO.width),
      height: Number(parsed?.height || DEFAULT_LOGO.height),
    };
  } catch {
    return DEFAULT_LOGO;
  }
}

function cacheLogo(logo: LogoData) {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(logo));
  } catch {
    // ignore cache failures
  }
}

/**
 * Custom hook to get site logo from settings with safe cache fallback.
 */
export function useLogo() {
  const { branding, loading } = useBranding();
  const [logo, setLogo] = useState<LogoData>(readCachedLogo());

  useEffect(() => {
    const next: LogoData = {
      url: branding.logo.url || DEFAULT_LOGO.url,
      publicId: String(branding.logo.publicId || ''),
      altText: String(branding.logo.altText || DEFAULT_LOGO.altText),
      width: Number(branding.logo.width || DEFAULT_LOGO.width),
      height: Number(branding.logo.height || DEFAULT_LOGO.height),
    };
    setLogo(next);
    cacheLogo(next);
  }, [branding]);

  return { logo, isLoading: loading };
}

/**
 * Get logo URL synchronously from cache.
 */
export function getLogoUrl(): string {
  return readCachedLogo().url;
}

/**
 * Legacy compatibility.
 */
export async function preloadLogo(): Promise<LogoData> {
  return readCachedLogo();
}

/**
 * Legacy compatibility.
 */
export function clearLogoCache() {
  try {
    localStorage.removeItem(LOGO_CACHE_KEY);
  } catch {
    // ignore
  }
}
