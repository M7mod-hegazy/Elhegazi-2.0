import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

// HARDCODED SITE NAME - DO NOT CHANGE
const HARDCODED_SITE_NAME = 'الحجازي لتجهيز المحلات';

/**
 * Custom hook to get the site name from centralized settings
 * Returns site name for use in page titles and meta tags
 */
export function useSiteName() {
  const { storeInfo, loading } = useSettings();
  const [siteName, setSiteName] = useState<string>(HARDCODED_SITE_NAME);

  useEffect(() => {
    // Always use hardcoded name, never from API
    setSiteName(HARDCODED_SITE_NAME);
  }, [loading]);

  return { siteName, loading };
}

/**
 * Get site name synchronously from settings
 * Always returns hardcoded name
 */
export function getSiteName(): string {
  return HARDCODED_SITE_NAME;
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
 * Always caches the hardcoded name
 */
export function cacheSiteName(): void {
  try {
    localStorage.setItem('cached_site_name', HARDCODED_SITE_NAME);
  } catch (error) {
    console.warn('Could not cache site name in localStorage');
  }
}
