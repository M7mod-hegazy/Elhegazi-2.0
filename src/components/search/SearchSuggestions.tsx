import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { apiGet, type ApiResponse } from '@/lib/api';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Input } from '@/components/ui/input';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

interface SearchSuggestionsProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  showRecentSearches?: boolean;
}

const SearchSuggestions = ({
  placeholder = "البحث عن المنتجات...",
  className,
  onSearch,
  showRecentSearches = true
}: SearchSuggestionsProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { hidePrices } = usePricingSettings();

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

  // Fetch popular searches on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/search/popular');
        if (!res.ok) {
          // Silently use fallback if endpoint doesn't exist
          if (active) setPopularSearches(['آيفون', 'سامسونج', 'لابتوب', 'ساعة ذكية', 'سماعات']);
          return;
        }
        const data = await res.json();
        if (active && data.ok && Array.isArray(data.searches)) {
          setPopularSearches(data.searches.slice(0, 5));
        }
      } catch (e) {
        // Silently use fallback - endpoint not implemented yet
        if (active) setPopularSearches(['آيفون', 'سامسونج', 'لابتوب', 'ساعة ذكية', 'سماعات']);
      }
    })();
    return () => { active = false; };
  }, []);

  // Get product suggestions based on query
  useEffect(() => {
    let active = true;
    (async () => {
      const q = query.trim();
      if (!q) { setSuggestions([]); return; }
      try {
        const res = await apiGet<ApiProduct>(`/api/products?search=${encodeURIComponent(q)}&limit=6`);
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
          rating: 0,
          reviews: 0,
          tags: [],
          sku: p.sku ?? '',
          weight: undefined,
          dimensions: undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
        if (active) setSuggestions(mapped);
      } catch (e) {
        console.error('Search suggestions fetch failed:', e);
        if (active) setSuggestions([]);
      }
    })();
    return () => { active = false; };
  }, [query]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      // Save to recent searches
      if (showRecentSearches) {
        const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
        setRecentSearches(updated);
      }

      // Track search in backend (fire and forget)
      fetch('/api/search/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() })
      }).catch(err => console.error('Failed to track search:', err));

      // Navigate to products page with search
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setQuery('');
      setIsOpen(false);

      if (onSearch) {
        onSearch(searchQuery);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const removeRecentSearch = (searchTerm: string) => {
    const updated = recentSearches.filter(s => s !== searchTerm);
    setRecentSearches(updated);
  };

  return (
    <div ref={searchRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-4 h-11 bg-white/95 backdrop-blur border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
      </form>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
          {query.trim().length > 0 ? (
            // Product suggestions
            <div className="py-2">
              {suggestions.length > 0 ? (
                <>
                  <div className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-slate-100">
                    المنتجات المقترحة
                  </div>
                  {suggestions.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-150"
                    >
                      <img
                        src={product.image}
                        alt={product.nameAr}
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{product.nameAr}</p>
                        <p className="text-sm text-slate-500 truncate">{product.categoryAr}</p>
                        {!hidePrices && <p className="text-sm font-semibold text-primary">{product.price.toLocaleString()} ج.م</p>}
                      </div>
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 px-4 py-3">
                    <button
                      onClick={() => handleSearch(query)}
                      className="flex items-center gap-2 text-primary hover:text-primary font-medium text-sm transition-colors duration-150"
                    >
                      <Search className="w-4 h-4" />
                      البحث عن "{query}"
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-4 py-8 text-center">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">لا توجد منتجات مطابقة</p>
                  <button
                    onClick={() => handleSearch(query)}
                    className="mt-2 text-primary hover:text-primary font-medium text-sm transition-colors duration-150"
                  >
                    البحث عن "{query}"
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Recent and popular searches
            <div className="py-2">
              {showRecentSearches && recentSearches.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                    <span className="text-xs font-medium text-slate-500">عمليات البحث الأخيرة</span>
                    <button
                      onClick={clearRecentSearches}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors duration-150"
                    >
                      مسح الكل
                    </button>
                  </div>
                  {recentSearches.map((search, index) => (
                    <div key={index} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 group">
                      <button
                        onClick={() => handleSearch(search)}
                        className="flex items-center gap-2 flex-1 text-right"
                      >
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{search}</span>
                      </button>
                      <button
                        onClick={() => removeRecentSearch(search)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all duration-150"
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {popularSearches.length > 0 && (
                <>
                  <div className="px-4 py-2 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">البحث الشائع</span>
                  </div>
                  {popularSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="flex items-center gap-2 w-full px-4 py-2 hover:bg-slate-50 text-right transition-colors duration-150"
                    >
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{search}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
