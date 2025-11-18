import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { cacheProducts, getCachedProducts, buildProductsFromApi, type CachedProduct } from '@/lib/productCache';

export interface UseProductsByIdsResult {
  products: CachedProduct[];
  map: Map<string, CachedProduct>;
  isLoading: boolean;
  error: string | null;
}

export function useProductsByIds(ids: string[], fields: string = 'name,nameAr,price,originalPrice,image,rating,reviews'): UseProductsByIdsResult {
  const normIds = Array.from(new Set((ids || []).map(String))).sort();
  const { data, isLoading, error }: UseQueryResult<CachedProduct[], Error> = useQuery<CachedProduct[], Error>({
    queryKey: ['products-by-ids', normIds, fields],
    queryFn: async () => {
      if (normIds.length === 0) return [];
      const { map: cachedMap, missing } = getCachedProducts(normIds);
      if (missing.length === 0) {
        return normIds.map((id) => cachedMap.get(id)!).filter(Boolean) as CachedProduct[];
      }
      const url = `/api/products?ids=${encodeURIComponent(missing.join(','))}&fields=${encodeURIComponent(fields)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json || !json.ok) {
        // fall back to cached only (may be partial)
        return normIds.map((id) => cachedMap.get(id)).filter(Boolean) as CachedProduct[];
      }
      const built = buildProductsFromApi(json.items || []);
      cacheProducts(built);
      const merged: Map<string, CachedProduct> = new Map<string, CachedProduct>(Array.from(cachedMap.entries()));
      for (const p of built) merged.set(String(p.id), p);
      return normIds.map((id) => merged.get(id)).filter(Boolean) as CachedProduct[];
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const list = data ?? [];
  const map = new Map<string, CachedProduct>();
  list.forEach((p) => map.set(String(p.id), p));
  return { products: list, map, isLoading, error: (error as Error | null)?.message ?? null };
}
