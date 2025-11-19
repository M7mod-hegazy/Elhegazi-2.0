import { useState, useEffect, useCallback } from 'react';

import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AuthModal from '@/components/ui/auth-modal';
import ProductCard from '@/components/product/ProductCard';
import { apiGet, type ApiResponse } from '@/lib/api';

const Favorites = () => {
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { favorites, clearFavorites } = useFavorites();
  const { addItem } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { toast } = useToast();

  type ApiProduct = {
    _id: string;
    name: string;
    nameAr?: string;
    sku?: string;
    categorySlug?: string;
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

  const mapApiProduct = useCallback((p: ApiProduct): Product => ({
    id: p._id,
    name: p.name,
    nameAr: p.nameAr ?? p.name,
    description: p.description ?? '',
    descriptionAr: p.description ?? '',
    price: p.price,
    originalPrice: undefined,
    image: p.image ?? '',
    images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
    category: p.categorySlug ?? '',
    categoryAr: p.categorySlug ?? '',
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
  }), []);

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || isAdmin) {
        setFavoriteProducts([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch each product by id. For better perf, consider a batch endpoint later.
        const validIds = (favorites || []).filter((id): id is string => {
          if (typeof id !== 'string') return false;
          const v = id.trim().toLowerCase();
          if (!v) return false;
          if (v === 'undefined' || v === 'null' || v === 'nan') return false;
          // Must look like a MongoDB ObjectId
          if (!/^[a-f0-9]{24}$/i.test(v)) return false;
          return true;
        });
        
        if (validIds.length === 0) {
          setFavoriteProducts([]);
          setLoading(false);
          return;
        }
        
        const prods = await Promise.all(
          validIds.map(async (id) => {
            try {
              const res = await apiGet<ApiProduct>(`/api/products/${id}`);
              const ok = res as Extract<ApiResponse<ApiProduct>, { ok: true }>;
              if (!ok.item) return null;
              return mapApiProduct(ok.item as ApiProduct);
            } catch {
              // ignore bad id
              return null;
            }
          })
        );
        const filtered = prods.filter((p): p is Product => !!p);
        setFavoriteProducts(filtered);
      } catch {
        setFavoriteProducts([]);
      }
      setLoading(false);
    };
    
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, JSON.stringify(favorites)]);

  const handleAddToCart = (product: Product) => {
    const result = addItem(product, 1);
    if (result.success) {
      toast({
        title: "تمت الإضافة للسلة",
        description: `تم إضافة ${product.nameAr} إلى سلة التسوق`,
      });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "فشل في إضافة المنتج",
        variant: "destructive"
      });
    }
  };

  const handleClearAll = () => {
    clearFavorites();
    setFavoriteProducts([]);
    toast({
      title: "تم مسح المفضلة",
      description: "تم حذف جميع المنتجات من قائمة المفضلة",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background py-16">
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
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <Heart className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h1 className="heading-2 mb-4">قائمة المفضلة</h1>
            <p className="body-text text-slate-600 mb-8">
              هذه الصفحة متاحة للعملاء فقط
            </p>
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
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  // Exclude hidden products from favorites display
  const visibleFavorites = favoriteProducts.filter(p => !p.isHidden);

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500" />
              <h1 className="heading-1">قائمة المفضلة</h1>
              {visibleFavorites.length > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {visibleFavorites.length} منتج
                </Badge>
              )}
            </div>

            {visibleFavorites.length > 0 && (
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                مسح الكل
              </Button>
            )}
          </div>

          <p className="body-large text-slate-600">
            {visibleFavorites.length > 0
              ? "منتجاتك المفضلة في مكان واحد"
              : "لم تقم بإضافة أي منتجات للمفضلة بعد"
            }
          </p>
        </div>

        {visibleFavorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleFavorites.map((product) => (
              <div key={product.id} className="mb-6">
                <ProductCard 
                  product={product} 
                  showQuickView={true} 
                  showFavorite={true} 
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-24 h-24 text-slate-200 mx-auto mb-6" />
            <h3 className="heading-3 mb-4">قائمة المفضلة فارغة</h3>
            <p className="body-text text-slate-600 mb-8 max-w-md mx-auto">
              ابدأ بإضافة المنتجات التي تعجبك إلى قائمة المفضلة لتجدها هنا بسهولة
            </p>
            <Button asChild>
              <Link to="/products">
                <ArrowRight className="w-4 h-4 mr-2" />
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
