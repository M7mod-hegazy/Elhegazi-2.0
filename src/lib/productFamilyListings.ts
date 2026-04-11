import { apiGet } from '@/lib/api';

export type StorefrontFamilyVariant = {
  productId: string;
  name: string;
  nameAr: string;
  values: Record<string, string>;
  image: string;
  price: number;
  active: boolean;
};

export type StorefrontProductFamily = {
  id: string;
  name: string;
  nameAr: string;
  defaultProductId: string;
  options: Array<{ key: string; label?: string; labelAr?: string }>;
  variants: StorefrontFamilyVariant[];
};

/** Typed option rows for a variant (labels from family.options when keys exist). */
export function familyVariantTypedValues(
  family: StorefrontProductFamily,
  v: StorefrontFamilyVariant
): { label: string; value: string }[] {
  const values = v.values || {};
  const opts = Array.isArray(family.options) ? family.options : [];
  const withKeys = opts.filter((o) => o.key);
  if (withKeys.length) {
    const out: { label: string; value: string }[] = [];
    for (const o of withKeys) {
      const raw = values[o.key];
      const val = raw != null ? String(raw).trim() : '';
      if (!val) continue;
      const label = String(o.labelAr || o.label || o.key).trim() || o.key;
      out.push({ label, value: val });
    }
    return out;
  }
  return Object.entries(values)
    .map(([k, raw]) => {
      const val = String(raw).trim();
      if (!val) return null;
      return { label: k, value: val };
    })
    .filter((x): x is { label: string; value: string } => x != null);
}

/** Short label for listing chips (e.g. «1.5 متر» when a single axis differs). */
export function familyVariantChipLabel(family: StorefrontProductFamily, v: StorefrontFamilyVariant): string {
  const typed = familyVariantTypedValues(family, v);
  if (typed.length === 1) return typed[0].value;
  if (typed.length > 1) return typed.map((t) => t.value).join(' · ');
  const fallback = String(v.nameAr || v.name || '').trim();
  if (fallback) return fallback;
  return 'خيار';
}

type Cache = { items: StorefrontProductFamily[]; ts: number };
let storefrontFamiliesCache: Cache | null = null;
const STOREFRONT_FAMILIES_TTL_MS = 5 * 60 * 1000;

export function clearStorefrontFamiliesCache() {
  storefrontFamiliesCache = null;
}

export async function fetchStorefrontProductFamilies(): Promise<StorefrontProductFamily[]> {
  if (storefrontFamiliesCache && Date.now() - storefrontFamiliesCache.ts < STOREFRONT_FAMILIES_TTL_MS) {
    return storefrontFamiliesCache.items;
  }
  const res = (await apiGet('/api/product-families/storefront')) as {
    ok?: boolean;
    items?: StorefrontProductFamily[];
  };
  const items = res?.ok && Array.isArray(res.items) ? res.items : [];
  storefrontFamiliesCache = { items, ts: Date.now() };
  return items;
}

type WithProductId = { id: string };

export function groupListingRowsByFamily<T extends WithProductId>(
  products: T[],
  families: StorefrontProductFamily[],
  enabled: boolean
): Array<{ kind: 'family'; family: StorefrontProductFamily } | { kind: 'product'; product: T }> {
  if (!enabled || !families.length) {
    return products.map((product) => ({ kind: 'product' as const, product }));
  }
  const memberToFamily = new Map<string, StorefrontProductFamily>();
  for (const f of families) {
    for (const v of f.variants || []) {
      memberToFamily.set(String(v.productId), f);
    }
  }
  const seenFamily = new Set<string>();
  const out: Array<{ kind: 'family'; family: StorefrontProductFamily } | { kind: 'product'; product: T }> = [];
  for (const p of products) {
    const fam = memberToFamily.get(String(p.id));
    if (fam) {
      if (seenFamily.has(fam.id)) continue;
      seenFamily.add(fam.id);
      out.push({ kind: 'family', family: fam });
    } else {
      out.push({ kind: 'product', product: p });
    }
  }
  return out;
}
