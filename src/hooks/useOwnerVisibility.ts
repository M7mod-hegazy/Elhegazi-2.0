import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';

export type OwnerVisibility = {
  publicPages: Record<string, boolean>;
  adminModules: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
};

function coerceVisibilityBool(raw: unknown, fallback: boolean): boolean {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return fallback;
}

function boolifySection<K extends string>(
  defaults: Record<K, boolean>,
  layer: Record<string, unknown> | undefined
): Record<K, boolean> {
  const out = { ...defaults } as Record<K, boolean>;
  if (!layer || typeof layer !== 'object') return out;
  for (const key of Object.keys(defaults) as K[]) {
    out[key] = coerceVisibilityBool(layer[key as string], defaults[key]);
  }
  return out;
}

/** Merge defaults + patch and coerce to real booleans (Mongo/JSON sometimes yields strings). */
export function normalizeOwnerVisibility(vis: Partial<OwnerVisibility> | undefined | null): OwnerVisibility {
  const v = vis || {};
  const merged = {
    publicPages: { ...defaultOwnerVisibility.publicPages, ...(v.publicPages || {}) },
    adminModules: { ...defaultOwnerVisibility.adminModules, ...(v.adminModules || {}) },
    featureFlags: { ...defaultOwnerVisibility.featureFlags, ...(v.featureFlags || {}) },
  };
  return {
    publicPages: boolifySection(defaultOwnerVisibility.publicPages, merged.publicPages as Record<string, unknown>),
    adminModules: boolifySection(defaultOwnerVisibility.adminModules, merged.adminModules as Record<string, unknown>),
    featureFlags: boolifySection(defaultOwnerVisibility.featureFlags, merged.featureFlags as Record<string, unknown>),
  };
}

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
    latestWork: true,
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
    latestWork: true,
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
  return normalizeOwnerVisibility(input);
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

