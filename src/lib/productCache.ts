// Simple in-memory product cache shared across components
// Not persisted across reloads; avoids repeated network fetch on rapid config edits/slide changes.

export type CachedProduct = {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  discount?: number;
  badge?: string;
};

const CACHE_KEY = 'product_cache_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const productMap = new Map<string, CachedProduct>();

// Hydrate from localStorage on module load (best-effort)
(() => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { ts: number; items: CachedProduct[] };
    if (!data || !Array.isArray(data.items)) return;
    if (Date.now() - (data.ts || 0) > CACHE_TTL_MS) return; // expired
    for (const p of data.items) {
      if (p && p.id) productMap.set(String(p.id), p);
    }
  } catch {
    // ignore
  }
})();

export function cacheProducts(products: CachedProduct[]) {
  for (const p of products) {
    if (p && p.id) productMap.set(String(p.id), p);
  }
  // Persist
  if (typeof window !== 'undefined') {
    try {
      const items = Array.from(productMap.values()).slice(0, 2000); // cap size
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
    } catch {
      // ignore
    }
  }
}

export function getCachedProducts(ids: string[]): { map: Map<string, CachedProduct>; missing: string[] } {
  const result = new Map<string, CachedProduct>();
  const missing: string[] = [];
  for (const id of ids) {
    const key = String(id);
    const cached = productMap.get(key);
    if (cached) result.set(key, cached);
    else missing.push(key);
  }
  return { map: result, missing };
}

export type ProductApi = {
  _id?: string;
  id?: string;
  name?: string;
  nameAr?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  rating?: number;
  reviews?: number;
};

export function buildProductsFromApi(items: ProductApi[]): CachedProduct[] {
  const src = Array.isArray(items) ? items : [];
  return src.map((p) => ({
    id: String(p._id ?? p.id ?? ""),
    name: p.name || "",
    nameAr: p.nameAr || p.name || "",
    price: Number(p.price || 0),
    originalPrice: p.originalPrice,
    image: p.image || (Array.isArray(p.images) ? p.images[0] : ""),
    rating: Number(p.rating || 0),
    reviews: Number(p.reviews || 0),
  }));
}
