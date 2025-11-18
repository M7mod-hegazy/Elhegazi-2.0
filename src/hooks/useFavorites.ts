import { useState, useEffect, useCallback } from 'react';
import { Product } from '@/types';
import { useDualAuth } from '@/hooks/useDualAuth';
import { apiDelete, apiGet, apiPostJson } from '@/lib/api';

const FAVORITES_STORAGE_KEY = 'user_favorites';
const FAVORITES_EVENT = 'favorites:updated';

interface FavoritesState {
  items: string[]; // Product IDs
  count: number;
}

const initialFavoritesState: FavoritesState = {
  items: [],
  count: 0
};

export const useFavorites = () => {
  const [favoritesState, setFavoritesState] = useState<FavoritesState>(initialFavoritesState);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, isAuthenticated } = useDualAuth();

  // Helper to derive storage key per user
  const storageKey = user?.id ? `${FAVORITES_STORAGE_KEY}:${user.id}` : `${FAVORITES_STORAGE_KEY}:guest`;

  const broadcastFavorites = useCallback((items: string[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      // ignore storage write errors (quota, privacy, etc.)
    }
    try {
      window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { userId: user?.id || 'guest', items } }));
    } catch (e) {
      // ignore event dispatch errors
    }
  }, [storageKey, user?.id]);

  // Load favorites from backend on auth change
  useEffect(() => {
    const load = async () => {
      if (isAuthenticated && user) {
        try {
          // Use T=string so ApiResponse items?: string[]
          const res = await apiGet<string>(`/api/users/${user.id}/favorites`);
          const ok = res as Extract<import('@/lib/api').ApiResponse<string>, { ok: true }>;
          const items = (ok.items || []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
          setFavoritesState({ items, count: items.length });
          broadcastFavorites(items);
        } catch {
          setFavoritesState(initialFavoritesState);
        }
      } else {
        setFavoritesState(initialFavoritesState);
      }
    };
    load();
  }, [isAuthenticated, user, broadcastFavorites]);

  // Listen for global favorites updates to sync all hook instances (e.g., Navbar)
  useEffect(() => {
    const onFavs = (e: Event) => {
      const ev = e as CustomEvent<{ userId: string; items: string[] }>;
      const evUserId = ev.detail?.userId || 'guest';
      if ((user?.id || 'guest') !== evUserId) return;
      const items = Array.isArray(ev.detail?.items) ? ev.detail.items : [];
      setFavoritesState({ items, count: items.length });
    };
    window.addEventListener(FAVORITES_EVENT, onFavs as EventListener);
    return () => window.removeEventListener(FAVORITES_EVENT, onFavs as EventListener);
  }, [user?.id]);

  const addToFavorites = useCallback(async (productId: string) => {
    if (!isAuthenticated || !user) {
      setShowAuthModal(true);
      return false;
    }

    try {
      const res = await apiPostJson<string, Record<string, never>>(`/api/users/${user.id}/favorites/${productId}`, {});
      const ok = res as Extract<import('@/lib/api').ApiResponse<string>, { ok: true }>;
      const items = (ok.items || []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      setFavoritesState({ items, count: items.length });
      broadcastFavorites(items);
      return true;
    } catch {
      return false;
    }
  }, [isAuthenticated, user, broadcastFavorites]);

  const removeFromFavorites = useCallback(async (productId: string) => {
    if (!isAuthenticated || !user) return false;
    try {
      const res = await apiDelete(`/api/users/${user.id}/favorites/${productId}`);
      const ok = res as Extract<import('@/lib/api').ApiResponse<string>, { ok: true }>;
      const items = (ok.items || []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      setFavoritesState({ items, count: items.length });
      broadcastFavorites(items);
      return true;
    } catch {
      return false;
    }
  }, [isAuthenticated, user, broadcastFavorites]);

  const toggleFavorite = useCallback((productId: string) => {
    if (!isAuthenticated || !user) return false;
    const isInFavorites = favoritesState.items.includes(productId);
    return isInFavorites ? removeFromFavorites(productId) : addToFavorites(productId);
  }, [favoritesState.items, addToFavorites, removeFromFavorites, isAuthenticated, user]);

  const isFavorite = useCallback((productId: string) => {
    return favoritesState.items.includes(productId);
  }, [favoritesState.items]);

  const getFavoriteProducts = useCallback(() => {
    // This previously read products from local cache. For now, return [] or fetch if needed.
    return [] as Product[];
  }, []);

  const clearFavorites = useCallback(async () => {
    if (!isAuthenticated || !user) return false;
    try {
      const res = await apiDelete(`/api/users/${user.id}/favorites`);
      const ok = res as Extract<import('@/lib/api').ApiResponse<string>, { ok: true }>;
      const items = (ok.items || []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      setFavoritesState({ items, count: items.length });
      broadcastFavorites(items);
      return true;
    } catch {
      return false;
    }
  }, [isAuthenticated, user, broadcastFavorites]);

  const getFavoritesCount = useCallback(() => {
    return favoritesState.count;
  }, [favoritesState.count]);

  return {
    // State
    favorites: favoritesState.items,
    favoritesCount: favoritesState.count,
    showAuthModal,
    setShowAuthModal,

    // Actions
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    getFavoriteProducts,
    clearFavorites,
    getFavoritesCount,

    // Computed
    isEmpty: favoritesState.count === 0,
    isAuthenticated: isAuthenticated && !!user
  };
};
