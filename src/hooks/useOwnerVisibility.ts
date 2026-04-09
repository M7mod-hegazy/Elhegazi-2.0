import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';

export type OwnerVisibility = {
  publicPages: Record<string, boolean>;
  adminModules: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
};

export const defaultOwnerVisibility: OwnerVisibility = {
  publicPages: {
    home: true,
    products: true,
    productDetail: true,
    categories: true,
    cart: true,
    checkout: true,
    favorites: true,
    profile: true,
    orders: true,
    about: true,
    contact: true,
    locations: true,
    shopBuilder: true,
  },
  adminModules: {
    dashboard: true,
    products: true,
    products3d: true,
    categories: true,
    orders: true,
    users: true,
    locations: true,
    qrcodes: true,
    homeConfig: true,
    settings: true,
    history: true,
    profit: true,
    shareholders: true,
  },
  featureFlags: {
    rating: true,
    favorites: true,
    shopBuilder3d: true,
    prices: true,
  },
};

type SiteVisibilityResponse = {
  enabled?: boolean;
  visibility?: Partial<OwnerVisibility>;
};

function mergeVisibility(input?: Partial<OwnerVisibility>): OwnerVisibility {
  return {
    publicPages: { ...defaultOwnerVisibility.publicPages, ...(input?.publicPages || {}) },
    adminModules: { ...defaultOwnerVisibility.adminModules, ...(input?.adminModules || {}) },
    featureFlags: { ...defaultOwnerVisibility.featureFlags, ...(input?.featureFlags || {}) },
  };
}

export function useOwnerVisibility() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [visibility, setVisibility] = useState<OwnerVisibility>(defaultOwnerVisibility);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGet<SiteVisibilityResponse>('/api/site-visibility');
        if (!mounted || !res.ok) return;
        const item = res.item || {};
        setEnabled(item.enabled !== false);
        setVisibility(mergeVisibility(item.visibility));
      } catch {
        // keep defaults on error
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isVisible = useMemo(
    () => (scope: keyof OwnerVisibility, key: string) => {
      if (!enabled) return true;
      return Boolean(visibility?.[scope]?.[key] ?? true);
    },
    [enabled, visibility]
  );

  return { loading, enabled, visibility, isVisible };
}

