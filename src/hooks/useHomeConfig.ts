import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { apiGet, type ApiResponse } from '@/lib/api';
import type { HomeConfig } from '@/types/home-config';

export interface UseHomeConfigResult {
  homeConfig: HomeConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  about: { 
    title: string; 
    description: string; 
    image: string; 
    stats: { customers: string; products: string };
    vision?: string;
    mission?: string;
  };
  workHours: { weekdays: string; friday: string; phone: string };
  getCurrentStatus: () => string;
}

export const useHomeConfig = (): UseHomeConfigResult => {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch }: UseQueryResult<HomeConfig | null, Error> = useQuery<HomeConfig | null, Error>({
    queryKey: ['home-config'],
    queryFn: async () => {
      const resp = await apiGet<HomeConfig>('/api/home-config');
      if (resp.ok) return resp.item ?? null;
      const err = (resp as Extract<ApiResponse<HomeConfig>, { ok: false }>).error;
      throw new Error(err || 'Failed to load home config');
    },
    staleTime: 60_000, // 1 min fresh
    gcTime: 10 * 60_000, // 10 min in cache (v5)
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const onCfgUpdated = () => { queryClient.invalidateQueries({ queryKey: ['home-config'] }); };
    window.addEventListener('home-config-updated', onCfgUpdated as EventListener);
    return () => window.removeEventListener('home-config-updated', onCfgUpdated as EventListener);
  }, [queryClient]);

  const homeConfig = data ?? null;

  const about = useMemo(() => {
    const a = homeConfig?.aboutUsContent || {};
    return {
      title: a.title || 'من نحن؟',
      description: a.description || 'شركة رائدة في التجارة الإلكترونية، نقدم أفضل المنتجات وأجود الخدمات بجودة عالية وخدمة متميزة.',
      image: a.image || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop',
      stats: {
        customers: (a.stats?.customers) || '1000+',
        products: (a.stats?.products) || '500+',
      },
      vision: a.vision || '',
      mission: a.mission || '',
    };
  }, [homeConfig]);

  const workHours = useMemo(() => {
    const w = homeConfig?.workHours || {};
    return {
      weekdays: w.weekdays || '9:00 ص - 10:00 م',
      friday: w.friday || '2:00 م - 10:00 م',
      phone: w.phone || '+966 12 345 6789',
    };
  }, [homeConfig]);

  // compute open/closed from workHours
  const getCurrentStatus = useCallback(() => {
    try {
      const now = new Date();
      const day = now.getDay();
      const isFri = day === 5;
      const range = (isFri ? workHours.friday : workHours.weekdays) || '';
      const match = range.match(/(\d{1,2}:\d{2})\s*(ص|م)\s*-\s*(\d{1,2}:\d{2})\s*(ص|م)/);
      if (!match) return 'مغلق';
      const [_, s, sp, e, ep] = match;
      const to24 = (t: string, p: string) => {
        const [hRaw, m] = t.split(':').map(Number);
        let h = hRaw;
        if (p === 'م' && h < 12) h += 12;
        if (p === 'ص' && h === 12) h = 0;
        return h * 60 + m;
      };
      const start = to24(s, sp);
      const end = to24(e, ep);
      const cur = now.getHours() * 60 + now.getMinutes();
      const open = end > start ? cur >= start && cur <= end : cur >= start || cur <= end;
      return open ? 'مفتوح الآن' : 'مغلق';
    } catch {
      return 'مغلق';
    }
  }, [workHours]);

  const loading = isLoading || isFetching;
  const errMsg = (error as Error | null)?.message ?? null;
  return { homeConfig, loading, error: errMsg, refresh, about, workHours, getCurrentStatus };
};

export default useHomeConfig;
