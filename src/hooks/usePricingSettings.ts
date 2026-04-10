import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api';

interface PricingSettings {
  hidePrices: boolean;
  contactMessage: string;
}

interface SettingsResponse {
  ok: boolean;
  item?: {
    pricingSettings?: {
      hidePrices?: boolean;
      contactMessage?: string;
    };
  };
}

const CACHE_KEY = 'pricing_settings_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedSettings extends PricingSettings {
  timestamp: number;
}

const getCachedSettings = (): PricingSettings | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedSettings = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return {
      hidePrices: data.hidePrices,
      contactMessage: data.contactMessage,
    };
  } catch (error) {
    console.error('Failed to read pricing settings cache:', error);
    return null;
  }
};

const setCachedSettings = (settings: PricingSettings): void => {
  try {
    const data: CachedSettings = {
      ...settings,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to cache pricing settings:', error);
  }
};

export const usePricingSettings = () => {
  // Initialize with cached settings if available
  const cachedSettings = getCachedSettings();
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(
    cachedSettings || {
      hidePrices: false,
      contactMessage: 'السلام عليكم، أود معرفة سعر المنتج',
    }
  );
  const [loading, setLoading] = useState(!cachedSettings); // Only loading if no cache
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await apiGet('/api/settings')) as SettingsResponse;
      
      if (res.ok && res.item) {
        const newSettings: PricingSettings = {
          hidePrices: res.item.pricingSettings?.hidePrices === true,
          contactMessage: res.item.pricingSettings?.contactMessage ?? 'السلام عليكم، أود معرفة سعر المنتج',
        };
        
        setPricingSettings(newSettings);
        setCachedSettings(newSettings); // Cache the settings
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    
    // Listen for visibility changes - refetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSettings();
      }
    };
    
    // Listen for settings change event from admin
    const handleSettingsChange = () => {
      loadSettings();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pricing-settings-changed', handleSettingsChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pricing-settings-changed', handleSettingsChange);
    };
  }, [loadSettings]);

  return {
    hidePrices: pricingSettings.hidePrices,
    contactMessage: pricingSettings.contactMessage,
    loading,
    error,
    refetch: loadSettings,
  };
};
