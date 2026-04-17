import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProductPath } from '@/lib/product-link';
import {
  familyVariantChipLabel,
  type StorefrontProductFamily,
} from '@/lib/productFamilyListings';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { optimizeImage, buildSrcSet, applyProductImageFallback } from '@/lib/images';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { cn } from '@/lib/utils';

type Props = {
  family: StorefrontProductFamily;
  className?: string;
};

export function FamilyListingCard({ family, className = '' }: Props) {
  const navigate = useNavigate();
  const { hidePrices, familyCardsInListings } = usePricingSettings();
  const [hoveredImg, setHoveredImg] = useState<string | null>(null);

  const def = family.variants.find((v) => v.productId === family.defaultProductId) || family.variants[0];
  const activeVariants = family.variants.filter((v) => v.active !== false);
  const prices = activeVariants.map((v) => v.price).filter((n) => Number.isFinite(n));
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const showRange = !hidePrices && prices.length > 1 && minP !== maxP;
  const showSingle = !hidePrices && prices.length > 0;

  const img = def?.image || '';
  const displayImg = hoveredImg || img;
  const familyTitle = String(family.nameAr || family.name || '').trim() || 'مجموعة منتجات';
  const legacyTitle = def?.nameAr || familyTitle;
  const defaultDetailPath = buildProductPath(family.defaultProductId);

  const goDefault = () => {
    navigate(defaultDetailPath);
  };

  const shellClass = cn(
    'relative group flex h-full flex-col overflow-hidden rounded-xl bg-white sm:rounded-2xl',
    'border-2 border-slate-200 shadow-md transition-all duration-500',
    'hover:-translate-y-3 hover:scale-[1.02] hover:border-primary hover:shadow-2xl',
    'cursor-pointer',
    className
  );

  /** بطاقة العائلة: اسم العائلة + شرائح الخيارات (فقط عند تفعيل إعداد بطاقات العائلة في لوحة التحكم) */
  if (familyCardsInListings) {
    return (
      <div
        role="link"
        tabIndex={0}
        className={shellClass}
        dir="rtl"
        aria-label={`${familyTitle} — افتح المنتج الافتراضي أو اختر خياراً`}
        onClick={goDefault}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goDefault();
          }
        }}
      >
        <div className="relative aspect-[10/7] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 sm:aspect-[4/3]">
          {img ? (
            <>
              {/* base image */}
              <img
                src={optimizeImage(img, { w: 320 })}
                alt={familyTitle}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                decoding="async"
                srcSet={buildSrcSet(img, 320)}
                sizes="(max-width: 640px) 50vw, 320px"
                onError={applyProductImageFallback}
              />
              {/* hovered variant overlay — crossfade */}
              {hoveredImg && hoveredImg !== img && (
                <img
                  key={hoveredImg}
                  src={optimizeImage(hoveredImg, { w: 320 })}
                  alt={familyTitle}
                  className="absolute inset-0 h-full w-full object-cover animate-[fadeIn_0.28s_ease_forwards]"
                  style={{ animation: 'familyCardFadeIn 0.28s ease forwards' }}
                  onError={applyProductImageFallback}
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">بدون صورة</div>
          )}

          <div
            className="absolute inset-x-0 top-0 z-20 flex justify-end p-2 sm:p-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <FavoriteButton
              productId={String(family.defaultProductId)}
              favoriteGroupIds={(family.variants || []).map((v) => String(v.productId))}
              size="sm"
              className="heart-button h-9 w-9 rounded-full border border-slate-100 bg-white/95 shadow-lg backdrop-blur-sm hover:bg-white hover:shadow-2xl sm:h-10 sm:w-10"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col space-y-2 p-2 sm:space-y-3 sm:p-3">
          <div>
            <h3 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{familyTitle}</h3>
            <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
              انقر البطاقة للافتراضي، أو اختر خياراً أدناه
            </p>
          </div>

          <div
            className="max-h-[min(9.5rem,32vh)] overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/60 p-2 sm:max-h-[min(11rem,38vh)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap justify-end gap-2">
              {(family.variants || []).map((v) => {
                const active = v.active !== false;
                const chip = familyVariantChipLabel(family, v);
                const path = buildProductPath(v.productId);
                if (!active) {
                  return (
                    <span
                      key={v.productId}
                      className="max-w-[11rem] cursor-not-allowed truncate rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-400"
                      title="غير متوفر"
                    >
                      {chip}
                    </span>
                  );
                }
                return (
                  <button
                    key={v.productId}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(path);
                    }}
                    onMouseEnter={() => {
                      if (v.image) setHoveredImg(v.image);
                    }}
                    onMouseLeave={() => setHoveredImg(null)}
                    className="max-w-[11rem] truncate rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-primary hover:bg-primary/5 hover:text-primary sm:text-sm"
                    aria-label={`${familyTitle} — ${chip}`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative h-px rounded-full bg-slate-100 sm:h-0.5">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-primary via-secondary to-primary transition-transform duration-700 ease-out group-hover:translate-x-0" />
          </div>

          {!hidePrices && (showRange || showSingle) ? (
            <p className="text-sm font-semibold text-primary sm:text-base">
              {showRange ? `من ${minP.toLocaleString()} — ${maxP.toLocaleString()} ج.م` : `${minP.toLocaleString()} ج.م`}
            </p>
          ) : hidePrices ? (
            <p className="text-xs text-slate-600">السعر حسب الخيار — تواصل معنا</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goDefault}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goDefault();
        }
      }}
      aria-label={`عرض تفاصيل ${legacyTitle}`}
      className={shellClass}
    >
      <div className="relative aspect-[10/7] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 sm:aspect-[4/3]">
        {img ? (
          <img
            src={optimizeImage(img, { w: 320 })}
            alt={legacyTitle}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
            decoding="async"
            srcSet={buildSrcSet(img, 320)}
            sizes="(max-width: 640px) 50vw, 320px"
            onError={applyProductImageFallback}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">بدون صورة</div>
        )}

        <div
          className="absolute inset-x-0 top-0 z-20 flex justify-end p-2 sm:p-3"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FavoriteButton
            productId={String(family.defaultProductId)}
            favoriteGroupIds={(family.variants || []).map((v) => String(v.productId))}
            size="sm"
            className="heart-button h-9 w-9 rounded-full border border-slate-100 bg-white/95 shadow-lg backdrop-blur-sm hover:bg-white hover:shadow-2xl sm:h-10 sm:w-10"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-1.5 p-2 sm:space-y-2 sm:p-3">
        <h3 className="line-clamp-2 min-h-[1.5rem] text-[15px] font-bold text-slate-900 transition-colors group-hover:text-primary sm:min-h-[2.5rem] sm:text-sm">
          {legacyTitle}
        </h3>

        <div className="relative h-px rounded-full bg-slate-100 sm:h-0.5">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-primary via-secondary to-primary transition-transform duration-700 ease-out group-hover:translate-x-0" />
        </div>

        {!hidePrices && (showRange || showSingle) ? (
          <p className="text-sm font-semibold text-primary sm:text-base">
            {showRange ? `من ${minP.toLocaleString()} — ${maxP.toLocaleString()} ج.م` : `${minP.toLocaleString()} ج.م`}
          </p>
        ) : hidePrices ? (
          <p className="text-xs text-slate-600">السعر حسب الخيار — تواصل معنا</p>
        ) : null}

        <div className="mt-auto pt-1 sm:pt-2">
          <span className="flex w-full items-center justify-center rounded-lg bg-primary py-2 text-xs font-semibold text-white shadow-sm transition-colors group-hover:bg-primary/90 sm:rounded-xl sm:py-2.5 sm:text-sm">
            تفاصيل
          </span>
        </div>
      </div>
    </div>
  );
}
