/**
 * Shared category slug / display-name resolution for storefront pages.
 * Keeps category pills and breadcrumbs consistent when products use categoryId-only or slug.
 */

export type CategoryListRecord = {
  _id: string;
  name: string;
  nameAr?: string;
  slug: string;
};

export function resolveProductCategory(
  raw: { categorySlug?: string; category?: string; categoryId?: string },
  catItems: CategoryListRecord[]
): { slug: string; categoryAr: string } {
  const catBySlug = new Map(catItems.map((c) => [c.slug, c]));
  const catById = new Map(catItems.map((c) => [String(c._id), c]));

  const cid =
    raw.categoryId != null && String(raw.categoryId).length > 0
      ? String(raw.categoryId)
      : '';

  let slug = (raw.categorySlug || '').trim();
  if (!slug && typeof raw.category === 'string' && raw.category.trim()) {
    slug = raw.category.trim();
  }
  if (!slug && cid) {
    const byId = catById.get(cid);
    if (byId?.slug) slug = byId.slug.trim();
  }

  const cat =
    (slug ? catBySlug.get(slug) : undefined) ?? (cid ? catById.get(cid) : undefined);

  const categoryAr =
    cat?.nameAr?.trim() ||
    cat?.name?.trim() ||
    slug ||
    '';

  return { slug, categoryAr };
}

export function categoryDisplayLabel(product: {
  categoryAr?: string;
  category?: string;
}): string {
  const t = (product.categoryAr || product.category || '').trim();
  return t || 'غير مصنّف';
}
