import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { Link } from 'react-router-dom';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFavorites } from '@/hooks/useFavorites';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useToast } from '@/hooks/use-toast';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';
import { apiGet, ApiHttpError, type ApiResponse } from '@/lib/api';
import { resolveProductCategory, type CategoryListRecord } from '@/lib/category-display';

type ApiProduct = {
  _id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  categorySlug?: string;
  categoryId?: string;
  category?: string;
  price: number;
  description?: string;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapApiProductToFavorite(p: ApiProduct, catItems: CategoryListRecord[]): Product {
  const cid =
    p.categoryId != null && String(p.categoryId).trim() !== ''
      ? String(p.categoryId)
      : '';
  const resolved = resolveProductCategory(
    {
      categorySlug: p.categorySlug,
      category: typeof p.category === 'string' ? p.category : undefined,
      categoryId: cid,
    },
    catItems
  );
  const slug = resolved.slug || (p.categorySlug ?? '').trim();
  const categoryAr = resolved.categoryAr || slug;

  return {
    id: p._id,
    _id: p._id,
    name: p.name,
    nameAr: p.nameAr ?? p.name,
    description: p.description ?? '',
    descriptionAr: p.description ?? '',
    price: p.price,
    originalPrice: undefined,
    image: p.image ?? '',
    images: Array.isArray(p.images) ? p.images : p.image ? [p.image] : [],
    category: slug,
    categorySlug: slug || undefined,
    categoryAr,
    stock: p.stock,
    isHidden: p.active === false,
    featured: !!p.featured,
    discount: undefined,
    rating: 0,
    reviews: 0,
    tags: [],
    sku: p.sku ?? '',
    weight: undefined,
    dimensions: undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const Favorites = () => {
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { favorites, clearFavorites, removeFromFavorites } = useFavorites();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { toast } = useToast();
  const { isMobile } = useDeviceDetection();
  const loadGenRef = useRef(0);

  const favoritesKey = useMemo(
    () =>
      [...(favorites || [])]
        .filter((id) => typeof id === 'string' && id.trim())
        .map((id) => id.trim())
        .sort()
        .join('|'),
    [favorites]
  );

  const loadFavorites = useCallback(async () => {
    if (!isAuthenticated || isAdmin) {
      setFavoriteProducts([]);
      setLoading(false);
      return;
    }

    const runId = ++loadGenRef.current;

    const validIds = favoritesKey
      ? favoritesKey.split('|').filter((id): id is string => {
          const v = id.trim().toLowerCase();
          if (!v) return false;
          if (v === 'undefined' || v === 'null' || v === 'nan') return false;
          if (!/^[a-f0-9]{24}$/i.test(v)) return false;
          return true;
        })
      : [];

    if (validIds.length === 0) {
      if (loadGenRef.current === runId) {
        setFavoriteProducts([]);
        setLoading(false);
      }
      return;
    }

    if (loadGenRef.current === runId) setLoading(true);

    try {
      const catsRes = await apiGet<CategoryListRecord>('/api/categories?limit=500&page=1');
      if (loadGenRef.current !== runId) return;
      const catItems =
        (catsRes as Extract<ApiResponse<CategoryListRecord>, { ok: true }>).items ?? [];

      type Row = { id: string; product: Product | null; prune: boolean };
      const results: Row[] = await Promise.all(
        validIds.map(async (id): Promise<Row> => {
          try {
            const res = await apiGet<ApiProduct>(`/api/products/${id}`);
            const ok = res as Extract<ApiResponse<ApiProduct>, { ok: true }>;
            if (!ok.item) return { id, product: null, prune: false };
            return { id, product: mapApiProductToFavorite(ok.item as ApiProduct, catItems), prune: false };
          } catch (e) {
            const prune = e instanceof ApiHttpError && e.status === 404;
            return { id, product: null, prune };
          }
        })
      );

      if (loadGenRef.current !== runId) return;

      const missing404 = results.filter((r) => r.product == null && r.prune).map((r) => r.id);
      const prods = results.map((r) => r.product).filter((p): p is Product => !!p);
      setFavoriteProducts(prods);

      if (missing404.length > 0) {
        void (async () => {
          let removed = 0;
          for (const id of missing404) {
            if (await removeFromFavorites(id)) removed += 1;
          }
          if (removed > 0) {
            toast({
              title: 'تنظيف المفضلة',
              description:
                removed === 1
                  ? 'منتج لم يعد متوفراً وتمت إزالته من قائمة المفضلة.'
                  : `تمت إزالة ${removed} منتجات لم تعد متوفرة من قائمة المفضلة.`,
            });
          }
        })();
      }
    } catch {
      if (loadGenRef.current === runId) setFavoriteProducts([]);
    } finally {
      if (loadGenRef.current === runId) setLoading(false);
    }
  }, [isAuthenticated, isAdmin, favoritesKey, removeFromFavorites, toast]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const handleClearAll = () => {
    clearFavorites();
    setFavoriteProducts([]);
    toast({
      title: 'تم مسح المفضلة',
      description: 'تم حذف جميع المنتجات من قائمة المفضلة',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <Heart className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h1 className="heading-2 mb-4">قائمة المفضلة</h1>
            <p className="body-text text-slate-600 mb-8">
              يجب تسجيل الدخول لعرض قائمة المنتجات المفضلة
            </p>
            <Button asChild>
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <Heart className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h1 className="heading-2 mb-4">قائمة المفضلة</h1>
            <p className="body-text text-slate-600 mb-8">هذه الصفحة متاحة للعملاء فقط</p>
            <Button asChild>
              <Link to="/">العودة للرئيسية</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  const visibleFavorites = favoriteProducts.filter((p) => !p.isHidden);

  return (
    <div
      className="min-h-screen bg-background py-4 sm:py-8"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="container mx-auto px-3 sm:px-4">
        <header className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3 min-w-0">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 shrink-0" aria-hidden />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight min-w-0">
              قائمة المفضلة
            </h1>
          </div>

          {visibleFavorites.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <Badge
                  variant="secondary"
                  className="text-sm shrink-0 min-h-10 px-3 py-1.5 inline-flex items-center justify-center tabular-nums font-medium self-start sm:self-center"
                >
                  {visibleFavorites.length} منتج
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="min-h-10 w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="w-4 h-4 shrink-0 ms-0 me-2" aria-hidden />
                  مسح الكل
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {visibleFavorites.length > 0
              ? 'منتجاتك المفضلة في مكان واحد'
              : 'لم تقم بإضافة أي منتجات للمفضلة بعد'}
          </p>
        </header>

        {visibleFavorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {visibleFavorites.map((product) => (
              <div key={product.id}>
                <ProductCard
                  product={product}
                  showQuickView
                  showFavorite
                  compactMobile={isMobile}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16">
            <Heart className="w-20 h-20 sm:w-24 sm:h-24 text-slate-200 mx-auto mb-6" />
            <h3 className="heading-3 mb-4">قائمة المفضلة فارغة</h3>
            <p className="body-text text-slate-600 mb-8 max-w-md mx-auto px-2">
              ابدأ بإضافة المنتجات التي تعجبك إلى قائمة المفضلة لتجدها هنا بسهولة
            </p>
            <Button asChild>
              <Link to="/products">
                <ArrowRight className="w-4 h-4 me-2" />
                تصفح المنتجات
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
