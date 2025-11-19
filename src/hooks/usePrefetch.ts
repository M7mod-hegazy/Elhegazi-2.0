import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Prefetch common routes and data
 * Improves navigation performance
 */
export const usePrefetch = () => {
  const location = useLocation();

  const prefetchRoute = useCallback((path: string) => {
    // Create a link element for prefetching
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = path;
    document.head.appendChild(link);
  }, []);

  const prefetchAPI = useCallback((endpoint: string) => {
    // Prefetch API endpoint
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetch(endpoint, { priority: 'low' as any }).catch(() => {
          // Silently fail if prefetch doesn't work
        });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        fetch(endpoint).catch(() => {
          // Silently fail
        });
      }, 2000);
    }
  }, []);

  // Prefetch common routes based on current page
  useEffect(() => {
    const currentPath = location.pathname;

    // On home page, prefetch category and products pages
    if (currentPath === '/') {
      prefetchRoute('/categories');
      prefetchRoute('/products');
      prefetchAPI('/api/categories');
      prefetchAPI('/api/products?limit=10');
    }

    // On category page, prefetch product detail and related categories
    if (currentPath.startsWith('/category/')) {
      prefetchRoute('/products');
      prefetchAPI('/api/categories');
    }

    // On products page, prefetch category and featured
    if (currentPath === '/products') {
      prefetchRoute('/featured');
      prefetchRoute('/best-sellers');
      prefetchAPI('/api/products?featured=true');
    }

    // On product detail, prefetch related products
    if (currentPath.startsWith('/product/')) {
      prefetchRoute('/products');
      prefetchAPI('/api/products?limit=5');
    }

    // On cart page, prefetch checkout
    if (currentPath === '/cart') {
      prefetchRoute('/checkout');
      prefetchAPI('/api/orders');
    }
  }, [location.pathname, prefetchRoute, prefetchAPI]);

  return { prefetchRoute, prefetchAPI };
};

/**
 * Prefetch on idle time
 * Loads resources when browser is idle
 */
export const usePrefetchOnIdle = () => {
  useEffect(() => {
    if (!('requestIdleCallback' in window)) {
      return;
    }

    // Prefetch common resources when browser is idle
    requestIdleCallback(() => {
      // Prefetch popular products
      fetch('/api/products?featured=true&limit=10').catch(() => {});

      // Prefetch categories
      fetch('/api/categories').catch(() => {});

      // Prefetch home config
      fetch('/api/home-config').catch(() => {});

      // Prefetch settings
      fetch('/api/settings').catch(() => {});
    });
  }, []);
};

/**
 * Prefetch images on hover
 * Improves perceived performance
 */
export const usePrefetchImageOnHover = (imageUrl: string) => {
  const handleMouseEnter = useCallback(() => {
    if (imageUrl) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = imageUrl;
      document.head.appendChild(link);
    }
  }, [imageUrl]);

  return { onMouseEnter: handleMouseEnter };
};

/**
 * Prefetch next page in pagination
 */
export const usePrefetchNextPage = (nextPageUrl: string | null) => {
  useEffect(() => {
    if (!nextPageUrl) return;

    // Prefetch next page when user scrolls near bottom
    const handleScroll = () => {
      const scrollPercentage = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;

      if (scrollPercentage > 0.8) {
        // User is near bottom, prefetch next page
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = nextPageUrl;
        document.head.appendChild(link);

        window.removeEventListener('scroll', handleScroll);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [nextPageUrl]);
};

/**
 * Preload critical resources
 */
export const usePreloadCritical = () => {
  useEffect(() => {
    // Preload critical fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.as = 'font';
    fontLink.href = '/fonts/main.woff2';
    fontLink.type = 'font/woff2';
    fontLink.crossOrigin = 'anonymous';
    document.head.appendChild(fontLink);

    // Preload critical CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'preload';
    cssLink.as = 'style';
    cssLink.href = '/styles/critical.css';
    document.head.appendChild(cssLink);

    // Preload critical images
    const criticalImages = [
      '/logo.png',
      '/hero-image.jpg',
      '/banner.jpg',
    ];

    criticalImages.forEach((img) => {
      const imgLink = document.createElement('link');
      imgLink.rel = 'preload';
      imgLink.as = 'image';
      imgLink.href = img;
      document.head.appendChild(imgLink);
    });
  }, []);
};
