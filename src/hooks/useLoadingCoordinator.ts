import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { usePricingSettings } from './usePricingSettings';

interface LoadingCoordinatorState {
  themeReady: boolean;
  pricingReady: boolean;
  heroReady: boolean;
  allReady: boolean;
  isLoading: boolean;
}

/**
 * Coordinates loading of all critical site data
 * Ensures splash screen doesn't disappear until everything is ready
 */
export const useLoadingCoordinator = (): LoadingCoordinatorState => {
  const location = useLocation();
  const { isLoading: themeLoading } = useTheme();
  const { loading: pricingLoading } = usePricingSettings();
  const [heroReady, setHeroReady] = useState(location.pathname !== '/');
  const [allReady, setAllReady] = useState(false);

  // Listen for hero ready event
  useEffect(() => {
    const handleHeroReady = () => setHeroReady(true);
    window.addEventListener('hero-ready', handleHeroReady as EventListener);
    return () => window.removeEventListener('hero-ready', handleHeroReady as EventListener);
  }, []);

  // Determine when all critical data is ready
  useEffect(() => {
    const themeReady = !themeLoading;
    const pricingReady = !pricingLoading;
    const isHomePage = location.pathname === '/';
    
    // On home page: wait for theme, pricing, and hero
    // On other pages: wait for theme and pricing only
    const ready = themeReady && pricingReady && (!isHomePage || heroReady);
    
    setAllReady(ready);
  }, [themeLoading, pricingLoading, heroReady, location.pathname]);

  return {
    themeReady: !themeLoading,
    pricingReady: !pricingLoading,
    heroReady,
    allReady,
    isLoading: !allReady,
  };
};
