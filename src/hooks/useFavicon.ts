import { useEffect } from 'react';
import { getLogoUrl } from './useLogo';

/**
 * Hook to dynamically update favicon and loading screen logo
 */
export function useFavicon() {
  useEffect(() => {
    const logoUrl = getLogoUrl();
    
    // Update all favicon links
    const updateFavicon = () => {
      // Get all link elements with rel="icon" or rel="apple-touch-icon"
      const links = document.querySelectorAll('link[rel*="icon"]');
      links.forEach((link) => {
        (link as HTMLLinkElement).href = logoUrl;
      });
      
      // Update OG image meta tag
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        ogImage.setAttribute('content', logoUrl);
      }
      
      // Update Twitter image meta tag
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) {
        twitterImage.setAttribute('content', logoUrl);
      }
      
      // Update loading screen logo if it exists
      const preSplashImg = document.querySelector('#pre-splash img');
      if (preSplashImg) {
        (preSplashImg as HTMLImageElement).src = logoUrl;
      }
    };
    
    updateFavicon();
  }, []);
}
