/**
 * API Response Caching Hook
 * Caches API responses in localStorage with TTL
 * Instant load on subsequent visits
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

const CACHE_PREFIX = 'api_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const useApiCache = () => {
  /**
   * Get cached data if valid
   */
  const getCache = <T>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - entry.timestamp > entry.ttl) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  };

  /**
   * Set cache data
   */
  const setCache = <T>(key: string, data: T, ttl = DEFAULT_TTL): void => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  };

  /**
   * Clear specific cache
   */
  const clearCache = (key: string): void => {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  };

  /**
   * Clear all cache
   */
  const clearAllCache = (): void => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Clear all cache error:', error);
    }
  };

  return {
    getCache,
    setCache,
    clearCache,
    clearAllCache,
  };
};
