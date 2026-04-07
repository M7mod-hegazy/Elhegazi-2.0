import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPostJson } from '@/lib/api';

export interface BuilderPricing {
  isFreeNow: boolean;
  currentPriceEgp: number;
  nextPriceEgp: number;
  sessionMinutes: number;
}

export interface BuilderAccessState {
  actorKey: string;
  adminBypass: boolean;
  hasActiveSession: boolean;
  sessionId: string | null;
  sessionType: 'free_trial' | 'paid' | 'admin_bypass' | null;
  remainingSeconds: number | null;
  expiresAt: string | null;
  pricing: BuilderPricing;
}

export function useBuilderAccess() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['builder-access'],
    queryFn: async () => {
      const res = await apiGet<BuilderAccessState>('/api/builder/access');
      if (!res.ok) throw new Error(res.error || 'Failed to load builder access');
      return res.item as BuilderAccessState;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['builder-access'] });
  }, [queryClient]);

  const startSession = useCallback(async () => {
    const res = await apiPostJson('/api/builder/session/start', { source: 'intro_page' });
    if (!res.ok) throw new Error(res.error || 'Failed to start session');
    await refresh();
    return res.item;
  }, [refresh]);

  const heartbeat = useCallback(async () => {
    await apiPostJson('/api/builder/session/heartbeat', {});
    await refresh();
  }, [refresh]);

  const endSession = useCallback(async () => {
    await apiPostJson('/api/builder/session/end', {});
    await refresh();
  }, [refresh]);

  return {
    access: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    error: (query.error as Error | null)?.message ?? null,
    refresh,
    startSession,
    heartbeat,
    endSession,
  };
}

export default useBuilderAccess;

