const MONGO_OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

export const normalizeCategorySegment = (value?: string): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const isMongoObjectIdLike = (value?: string): boolean =>
  MONGO_OBJECT_ID_REGEX.test((value || '').toString().trim());

export type CategoryPathInput = {
  slug?: string;
  nameAr?: string;
  name?: string;
  id?: string;
};

export const getCategorySegment = (input: CategoryPathInput): string => {
  const bySlug = normalizeCategorySegment(input.slug);
  if (bySlug && !isMongoObjectIdLike(bySlug)) return bySlug;

  const byNameAr = normalizeCategorySegment(input.nameAr);
  if (byNameAr) return byNameAr;

  const byName = normalizeCategorySegment(input.name);
  if (byName) return byName;

  const byId = (input.id || '').toString().trim();
  if (byId && !isMongoObjectIdLike(byId)) return normalizeCategorySegment(byId) || byId;

  return '';
};

export const buildCategoryPath = (input: CategoryPathInput): string => {
  const segment = getCategorySegment(input);
  return segment ? `/category/${segment}` : '/categories';
};
