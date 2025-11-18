import { useEffect } from 'react';
import { useSiteName, updatePageTitle } from '@/hooks/useSiteName';

/**
 * Hook to set page title with site name
 * Usage: usePageTitle("المنتجات") -> "المنتجات - Site Name"
 */
export function usePageTitle(pageTitle?: string) {
  const { siteName } = useSiteName();

  useEffect(() => {
    if (pageTitle) {
      updatePageTitle(pageTitle, siteName);
    } else if (siteName) {
      // Just site name for home page
      document.title = siteName;
    }
  }, [pageTitle, siteName]);

  return { siteName };
}

/**
 * Set page title immediately (for components that don't use hooks)
 */
export function setPageTitle(pageTitle: string): void {
  updatePageTitle(pageTitle);
}
