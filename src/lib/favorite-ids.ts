/**
 * Canonical favorite id: trim + lowercase so Mongo ObjectId / API strings match everywhere.
 */
export function normalizeFavoriteProductId(raw: string | number | undefined | null): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s === 'undefined' || s === 'null') return '';
  return s.toLowerCase();
}

/** Prefer API _id when present so cards built with only id still match the server list. */
export function favoriteProductKey(product: { id?: string; _id?: string } | null | undefined): string {
  if (!product) return '';
  const raw = product._id ?? product.id;
  return normalizeFavoriteProductId(raw ?? '');
}

/** Use with `useFavorites().isFavorite` so every card agrees with the canonical id list. */
export function isProductFavorited(
  product: { id?: string; _id?: string } | null | undefined,
  isFavorite: (productId: string) => boolean
): boolean {
  const k = favoriteProductKey(product);
  return k.length > 0 && isFavorite(k);
}
