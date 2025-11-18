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

export const usePricingSettings = () => {
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    hidePrices: false,
    contactMessage: 'السلام عليكم، أود معرفة سعر المنتج',
  });
  const [loading, setLoading] = useState(true);
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    
    // Poll for changes every 1 second (faster response)
    const interval = setInterval(loadSettings, 1000);
    
    // Also listen for visibility changes - refetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSettings();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
