import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { apiGet, type ApiResponse } from '@/lib/api';

export interface ShopSetupData {
  _id?: string;
  ownerName: string;
  shopName: string;
  phone: string;
  field: string;
  isCustomField: boolean;
  customField?: string;
  createdAt?: string;
}

export interface UseShopSetupResult {
  shopData: ShopSetupData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useShopSetup = (): UseShopSetupResult => {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch }: UseQueryResult<ShopSetupData | null, Error> = useQuery<ShopSetupData | null, Error>({
    queryKey: ['shop-setup'],
    queryFn: async () => {
      const resp = await apiGet<ShopSetupData>('/api/shop-setup');
      if (resp.ok) return resp.item ?? null;
      const err = (resp as Extract<ApiResponse<ShopSetupData>, { ok: false }>).error;
      throw new Error(err || 'Failed to load shop setup');
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const onShopUpdated = () => { queryClient.invalidateQueries({ queryKey: ['shop-setup'] }); };
    window.addEventListener('shop-setup-updated', onShopUpdated as EventListener);
    return () => window.removeEventListener('shop-setup-updated', onShopUpdated as EventListener);
  }, [queryClient]);

  const shopData = data ?? null;
  const loading = isLoading || isFetching;
  const errMsg = (error as Error | null)?.message ?? null;

  return { shopData, loading, error: errMsg, refresh };
};

export default useShopSetup;
