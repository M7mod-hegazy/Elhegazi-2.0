import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { apiGet, type ApiResponse } from '@/lib/api';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import type { Product } from '@/types';
import ProductsDesktop from './ProductsDesktop';
import ProductsMobile from './ProductsMobile';

interface CreativeProductsSliderProps {
  title: string;
  subtitle: string;
  filterType: 'featured' | 'trending' | 'sale' | 'new';
  gradientFrom: string;
  gradientTo: string;
  icon: React.ReactNode;
  selectedIds?: string[];
}

const CreativeProductsSlider = ({
  title,
  subtitle,
  filterType,
  selectedIds,
}: CreativeProductsSliderProps) => {
  const { hidePrices } = usePricingSettings();
  // Get redirect URL based on filter type
  const getRedirectUrl = () => {
    switch (filterType) {
      case 'featured':
        return '/featured';
      case 'trending':
        return '/best-sellers';
      case 'sale':
        return '/special-offers';
      case 'new':
        return '/latest';
      default:
        return '/products';
    }
  };
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
    rating?: number;
    reviews?: number;
    createdAt: string;
    updatedAt: string;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Array.isArray(selectedIds)) {
          if (selectedIds.length === 0) {
            if (mounted) setLiveProducts([]);
            return;
          }
          const idsParam = encodeURIComponent(selectedIds.join(','));
          const fields = ['_id', 'name', 'nameAr', 'price', 'image', 'images', 'categorySlug', 'featured', 'active', 'createdAt', 'updatedAt', 'stock', 'sku', 'rating', 'reviews'].join(',');
          const res = await apiGet<ApiProduct>(`/api/products?ids=${idsParam}&fields=${fields}`);
          const items = (res as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];
          const mapped: Product[] = items.map((p) => ({
            id: p._id,
            name: p.name,
            nameAr: p.nameAr ?? p.name,
            description: '',
            descriptionAr: '',
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
            rating: p.rating ?? 0,
            reviews: p.reviews ?? 0,
            tags: [],
            sku: p.sku ?? '',
            weight: undefined,
            dimensions: undefined,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));
          if (mounted) setLiveProducts(mapped);
          return;
        }

        const params = new URLSearchParams();
        params.set('limit', '60');
        if (filterType === 'featured') params.set('featured', 'true');
        const fields = ['_id', 'name', 'nameAr', 'price', 'image', 'images', 'categorySlug', 'featured', 'active', 'createdAt', 'updatedAt', 'stock', 'sku', 'rating', 'reviews'].join(',');
        params.set('fields', fields);
        const res = await apiGet<ApiProduct>(`/api/products?${params.toString()}`);
        const items = (res as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];
        const mapped: Product[] = items.map((p) => ({
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
          rating: p.rating ?? 0,
          reviews: p.reviews ?? 0,
          tags: [],
          sku: p.sku ?? '',
          weight: undefined,
          dimensions: undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
        if (mounted) setLiveProducts(mapped);
      } catch (e) {
        console.error('Failed to fetch products for slider:', e);
        if (mounted) setLiveProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedIds, filterType]);

  const getFilteredProducts = () => {
    if (Array.isArray(selectedIds)) {
      const map = new Map(liveProducts.map(p => [p.id, p] as const));
      return selectedIds
        .map(id => map.get(id))
        .filter((p): p is Product => !!p && !p.isHidden)
        .slice(0, 12);
    }
    switch (filterType) {
      case 'featured':
        return liveProducts.filter(p => !p.isHidden && p.featured).slice(0, 8);
      case 'trending':
        return liveProducts.filter(p => !p.isHidden && p.rating >= 4.5).slice(0, 8);
      case 'sale':
        return liveProducts.filter(p => !p.isHidden && p.originalPrice && p.originalPrice > p.price).slice(0, 8);
      case 'new':
        return liveProducts
          .filter(p => !p.isHidden)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8);
      default:
        return liveProducts.filter(p => !p.isHidden).slice(0, 8);
    }
  };

  let filteredProducts = getFilteredProducts();
  const hasExplicitSelection = Array.isArray(selectedIds);
  if (!hasExplicitSelection && filteredProducts.length === 0 && liveProducts.length > 0) {
    filteredProducts = liveProducts
      .filter(p => !p.isHidden)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }

  return (
    <section className="relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-1 h-12 bg-gradient-to-b from-primary via-secondary to-primary rounded-full"></div>
                  <div className="absolute inset-0 w-1 h-12 bg-gradient-to-b from-primary to-secondary rounded-full blur-sm opacity-50"></div>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    {title}
                  </h2>
                  <div className="h-1 w-20 bg-gradient-to-r from-primary to-transparent rounded-full mt-1"></div>
                </div>
              </div>
              <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            </div>
            <Link
              to={getRedirectUrl()}
              className="hidden md:flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-105 group"
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        <div>
          <div className="hidden md:block">
            <ProductsDesktop
              products={filteredProducts}
              loading={loading}
              hoveredProduct={hoveredProduct}
              setHoveredProduct={setHoveredProduct}
              hidePrices={hidePrices}
            />
          </div>
          <div className="md:hidden">
            <ProductsMobile
              products={filteredProducts}
              loading={loading}
              redirectUrl={getRedirectUrl()}
              hidePrices={hidePrices}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreativeProductsSlider;
