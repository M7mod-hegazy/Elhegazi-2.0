import { useBranding } from '@/hooks/useBranding';

const DEFAULT_SITE_NAME = 'متجر إلكتروني';
const SITE_NAME_CACHE_KEY = 'cached_site_name';

function readCachedSiteName(): string {
  try {
    const cached = localStorage.getItem(SITE_NAME_CACHE_KEY);
    if (cached && cached.trim()) return cached.trim();
  } catch {
    // ignore storage access issues
  }
  return DEFAULT_SITE_NAME;
}

/**
 * Custom hook to get the site name from centralized settings
 * Returns site name for use in page titles and meta tags
 */
export function useSiteName() {
  const { branding, loading } = useBranding();
  return { siteName: branding.siteName || readCachedSiteName(), loading };
}

/**
 * Get site name synchronously from settings cache
 */
export function getSiteName(): string {
  return readCachedSiteName();
}

/**
 * Update page title with site name
 * Format: "Page Title - Site Name"
 */
export function updatePageTitle(pageTitle: string, siteName?: string): void {
  const finalSiteName = siteName || getSiteName();
  document.title = pageTitle ? `${pageTitle} - ${finalSiteName}` : finalSiteName;
}

/**
 * Cache site name in localStorage for immediate access
 */
export function cacheSiteName(siteName?: string): void {
  try {
    const value = (siteName || '').trim();
    if (value) localStorage.setItem(SITE_NAME_CACHE_KEY, value);
  } catch {
    console.warn('Could not cache site name in localStorage');
  }
}
