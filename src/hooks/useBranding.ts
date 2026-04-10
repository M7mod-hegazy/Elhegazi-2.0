import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type BrandingState = {
  siteName: string;
  logo: {
    url: string;
    publicId?: string;
    altText: string;
    width: number;
    height: number;
  };
};

const DEFAULT_SITE_NAME = 'متجر إلكتروني';
const SITE_NAME_CACHE_KEY = 'cached_site_name';
const LOGO_CACHE_KEY = 'cached_site_logo';

const DEFAULT_BRANDING: BrandingState = {
  siteName: DEFAULT_SITE_NAME,
  logo: {
    url: '/iconPng.png',
    publicId: '',
    altText: 'Store Logo',
    width: 150,
    height: 150,
  },
};

let inflight: Promise<BrandingState> | null = null;

function readFromCache(): BrandingState {
  try {
    const cachedName = localStorage.getItem(SITE_NAME_CACHE_KEY) || DEFAULT_SITE_NAME;
    const rawLogo = localStorage.getItem(LOGO_CACHE_KEY);
    if (!rawLogo) return { ...DEFAULT_BRANDING, siteName: cachedName };
    const parsed = JSON.parse(rawLogo);
    const url = String(parsed?.url || '').trim();
    return {
      siteName: cachedName.trim() || DEFAULT_SITE_NAME,
      logo: {
        url: url || DEFAULT_BRANDING.logo.url,
        publicId: String(parsed?.publicId || ''),
        altText: String(parsed?.altText || cachedName || DEFAULT_BRANDING.logo.altText),
        width: Number(parsed?.width || DEFAULT_BRANDING.logo.width),
        height: Number(parsed?.height || DEFAULT_BRANDING.logo.height),
      },
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function writeCache(next: BrandingState) {
  try {
    localStorage.setItem(SITE_NAME_CACHE_KEY, next.siteName);
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(next.logo));
  } catch {
    // ignore cache failures
  }
}

export async function fetchBranding(): Promise<BrandingState> {
  if (inflight) return inflight;
  inflight = (async () => {
    const fallback = readFromCache();
    try {
      const res = await apiGet<{ storeInfo?: { name?: string }; logo?: Partial<BrandingState['logo']> }>('/api/settings');
      if (!res.ok) return fallback;
      const siteName = String(res.item?.storeInfo?.name || '').trim() || fallback.siteName || DEFAULT_SITE_NAME;
      const incomingLogo = res.item?.logo || {};
      const next: BrandingState = {
        siteName,
        logo: {
          url: String(incomingLogo.url || fallback.logo.url || DEFAULT_BRANDING.logo.url),
          publicId: String(incomingLogo.publicId || fallback.logo.publicId || ''),
          altText: String(incomingLogo.altText || siteName || fallback.logo.altText),
          width: Number(incomingLogo.width || fallback.logo.width),
          height: Number(incomingLogo.height || fallback.logo.height),
        },
      };
      writeCache(next);
      return next;
    } catch {
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingState>(readFromCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchBranding().then((data) => {
      if (mounted) setBranding(data);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { branding, loading };
}
