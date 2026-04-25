import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import QRCode from 'qrcode';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import AdminLayout from '@/components/admin/AdminLayout';
import SmartProductSelector from '@/components/admin/SmartProductSelector';
import { apiGet } from '@/lib/api';
import { buildProductPath } from '@/lib/product-link';
import { LOGO_IMAGE_FALLBACK, applyLogoImageFallback } from '@/lib/images';

import { Product, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useLogo } from '@/hooks/useLogo';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  TextRun,
  HeadingLevel,
  PageOrientation,
  convertMillimetersToTwip,
} from 'docx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  QrCode,
  Download,
  Printer,
  FileDown,
  Eye,
  Settings,
  RefreshCw,
  FileImage,
  Grid3X3,
  Maximize2,
  Copy,
  Share2,
  Palette,
  Layout,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Clock,
  Upload,
  X,
  Image,
  Search,
  Package,
  Minus,
  Plus
} from 'lucide-react';

interface QRSettings {
  size: number;
  showProductCode: boolean;
  showProductName: boolean;
  showPrice: boolean;
  includeLogo: boolean;
  addBorder: boolean;
  borderColor: string;
  backgroundColor: string;
  foregroundColor: string;
  layout: 'grid' | 'list' | 'compact';
  itemsPerRow: number;
  pageFormat: 'A4' | 'A5' | 'A3' | 'Letter' | 'Thermal';
  pageEdgeMarginMm: number;
  margin: number;
  // ── Thermal ──────────────────────────
  thermalPrinterModel: ThermalPresetId;
  thermalWidthMm: number;
  thermalLabelHeightMm: number;  // 0 = auto
  thermalColumns: number;        // labels per row (1–6 smart-capped)
  thermalRowsPerCut: number;     // label rows per cut/group (1–8)
  thermalQrSizeOverrideMm: number; // 0 = auto-fill column width
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getJsPdfFormat(fmt: QRSettings['pageFormat']): 'a4' | 'a5' | 'a3' | 'letter' | [number, number] {
  switch (fmt) {
    case 'A5': return 'a5';
    case 'A3': return 'a3';
    case 'Letter': return 'letter';
    default: return 'a4';
  }
}

function getPageDimensionsMm(fmt: QRSettings['pageFormat'], thermalWidthMm = 58): { w: number; h: number } {
  switch (fmt) {
    case 'A4': return { w: 210, h: 297 };
    case 'A5': return { w: 148, h: 210 };
    case 'A3': return { w: 297, h: 420 };
    case 'Letter': return { w: 216, h: 279 };
    case 'Thermal': return { w: thermalWidthMm, h: 0 }; // 0 = continuous/auto height
    default: return { w: 210, h: 297 };
  }
}

/** Printable content box inside @page margins (matches preview inner area). */
function getInnerPageDimensionsMm(
  pageFormat: QRSettings['pageFormat'],
  pageEdgeMarginMm: number,
  thermalWidthMm = 58,
  thermalLabelHeightMm = 0
): { w: number; h: number } {
  if (pageFormat === 'Thermal') {
    const innerW = Math.max(10, thermalWidthMm - 2 * pageEdgeMarginMm);
    const innerH = thermalLabelHeightMm > 0 ? Math.max(10, thermalLabelHeightMm - 2 * pageEdgeMarginMm) : 0;
    return { w: innerW, h: innerH };
  }
  const { w, h } = getPageDimensionsMm(pageFormat, thermalWidthMm);
  const innerW = Math.max(10, w - 2 * pageEdgeMarginMm);
  const innerH = Math.max(10, h - 2 * pageEdgeMarginMm);
  return { w: innerW, h: innerH };
}

// ── Thermal printer presets (Egypt market) ──────────────────────────────────
const THERMAL_PRESETS = [
  { id: 'xp235b',    name: 'Xprinter XP-235B',   maxMm: 60,  defaultMm: 58,  note: 'طابعتك الحالية ✓', popular: true  },
  { id: 'xp365b',    name: 'Xprinter XP-365B',   maxMm: 58,  defaultMm: 58,  note: 'الأكثر شيوعاً',     popular: true  },
  { id: 'xp460b',    name: 'Xprinter XP-460B',   maxMm: 108, defaultMm: 80,  note: '4 بوصة',            popular: false },
  { id: 'tsc244',    name: 'TSC TTP-244 Pro',     maxMm: 108, defaultMm: 80,  note: 'شحن وتوريد',        popular: true  },
  { id: 'zebrazd230',name: 'Zebra ZD230',         maxMm: 104, defaultMm: 80,  note: 'مؤسسي',             popular: false },
  { id: 'postekg3',  name: 'Postek G3/G6',        maxMm: 108, defaultMm: 80,  note: 'صناعي',             popular: false },
  { id: 'gen58',     name: 'لفافة عامة 58mm',     maxMm: 58,  defaultMm: 58,  note: 'استلام / POS',      popular: false },
  { id: 'gen80',     name: 'لفافة عامة 80mm',     maxMm: 80,  defaultMm: 80,  note: 'متعدد الاستخدام',   popular: false },
] as const;
type ThermalPresetId = typeof THERMAL_PRESETS[number]['id'];

/** Parse a CSS hex color → [r, g, b] (0–255). Falls back to black on error. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#000000').replace('#', '');
  const n = clean.length === 3
    ? parseInt(clean.split('').map(c => c + c).join(''), 16)
    : parseInt(clean.padEnd(6, '0'), 16);
  if (isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolveLogoSrcForCanvas(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (typeof window !== 'undefined' && u.startsWith('/')) return `${window.location.origin}${u}`;
  return u;
}

const AdminQRCodes = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  const { logo: siteLogo } = useLogo();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<QRSettings>({
    size: 200,
    showProductCode: true,
    showProductName: true,
    showPrice: false,
    includeLogo: false,
    addBorder: true,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    foregroundColor: '#000000',
    layout: 'grid',
    itemsPerRow: 3,
    pageFormat: 'A4',
    pageEdgeMarginMm: 0,
    margin: 20,
    thermalWidthMm: 58,
    thermalLabelHeightMm: 0,
    thermalColumns: 1,
    thermalPrinterModel: 'xp235b' as ThermalPresetId,
    thermalRowsPerCut: 1,
    thermalQrSizeOverrideMm: 0,
  });
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState<'grid' | 'a4'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoMode, setLogoMode] = useState<'site' | 'upload'>('site');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [qrCache, setQrCache] = useState<{ [key: string]: string }>({});
  const qrCacheRef = useRef<{ [key: string]: string }>({});

  // Auto-adjust itemsPerRow when margins, page size, or QR size changes
  useEffect(() => {
    if (settings.pageFormat === 'Thermal') return; // Thermal uses thermalColumns separately
    const { w } = getPageDimensionsMm(settings.pageFormat);
    const usableWidthMm = Math.max(20, w - 2 * settings.pageEdgeMarginMm);
    const qrSizeMm = (settings.size / 4) / 3.78;
    const marginEffectMm = settings.margin / 3.78;
    const effectiveItemWidth = qrSizeMm + marginEffectMm;
    const maxAllowed = Math.max(1, Math.min(Math.floor(usableWidthMm / effectiveItemWidth), 15));

    if (settings.itemsPerRow > maxAllowed) {
      setSettings(prev => ({
        ...prev,
        itemsPerRow: maxAllowed
      }));
    }
  }, [settings.margin, settings.size, settings.itemsPerRow, settings.pageFormat, settings.pageEdgeMarginMm]);

  // Load data from API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          apiGet<Product>('/api/products?limit=1000&fields=_id,name,nameAr,price,sku,image,category,categoryId,categorySlug'),
          apiGet<Category>('/api/categories?limit=500'),
        ]);
        if (!mounted) return;
        if (prodRes.ok) {
          const mappedProducts = (prodRes.items || []).map((p: any) => ({
            id: p._id,
            name: p.name,
            nameAr: p.nameAr,
            description: p.description || '',
            descriptionAr: '',
            price: p.price,
            image: p.image || '',
            images: p.images || [],
            category: p.categoryId || p.categorySlug || '',
            categoryAr: '',
            categoryId: p.categoryId,
            categorySlug: p.categorySlug,
            featured: !!p.featured,
            sku: p.sku || '',
            rating: 0,
            reviews: 0,
            tags: [],
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));
          setProducts(mappedProducts);
        }
        if (catRes.ok) setCategories(catRes.items || []);
      } catch (e) {
        // optionally show a toast
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Keep quantity map in sync with current selection
  useEffect(() => {
    setSelectedProductQuantities((prev) => {
      const next: Record<string, number> = {};
      selectedProductIds.forEach((id) => {
        next[id] = Math.max(1, Number(prev[id] || 1));
      });
      return next;
    });
  }, [selectedProductIds]);

  const resolvedSiteLogoUrl = useMemo(
    () => resolveLogoSrcForCanvas(siteLogo?.url || ''),
    [siteLogo?.url]
  );

  /** Data URL (upload) or absolute/site URL for canvas compositing */
  const effectiveLogoSrc = useMemo(() => {
    if (!settings.includeLogo) return '';
    if (logoMode === 'site') return resolvedSiteLogoUrl;
    return logoPreview;
  }, [settings.includeLogo, logoMode, resolvedSiteLogoUrl, logoPreview]);

  // Build printable list (allows same product multiple times)
  const selectedProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const out: Product[] = [];
    selectedProductIds.forEach((id) => {
      const product = byId.get(id);
      if (!product) return;
      const qty = Math.max(1, Number(selectedProductQuantities[id] || 1));
      for (let i = 0; i < qty; i += 1) out.push(product);
    });
    return out;
  }, [products, selectedProductIds, selectedProductQuantities]);

  const updateSelectedQuantity = (productId: string, nextQty: number) => {
    setSelectedProductQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(1, Math.min(999, Number(nextQty) || 1)),
    }));
  };

  // Reset to first page when layout settings change
  useEffect(() => {
    setCurrentPage(1);
  }, [settings.itemsPerRow, settings.margin, settings.size, settings.pageFormat, settings.pageEdgeMarginMm]);

  // Clear QR cache when settings change to force regeneration
  useEffect(() => {
    qrCacheRef.current = {};
    setQrCache({});
  }, [
    settings.size,
    settings.foregroundColor,
    settings.backgroundColor,
    settings.includeLogo,
    effectiveLogoSrc,
    logoMode,
  ]);

  const generateQRCodeWithLogo = useCallback(async (product: Product, customSize?: number): Promise<string> => {
    const productURL = `${window.location.origin}${buildProductPath(product.id)}`;
    const size = customSize || settings.size;
    const logoKey = effectiveLogoSrc ? `${logoMode}-${effectiveLogoSrc.slice(0, 180)}` : 'nologo';
    const cacheKey = `${product.id}-${size}-${settings.includeLogo}-${logoKey}-${settings.foregroundColor}-${settings.backgroundColor}`;

    const hit = qrCacheRef.current[cacheKey];
    if (hit) return hit;

    const ecc: 'L' | 'M' | 'Q' | 'H' = settings.includeLogo && effectiveLogoSrc ? 'H' : 'M';

    try {
      const qrDataURL = await QRCode.toDataURL(productURL, {
        width: size,
        margin: 2,
        color: {
          dark: settings.foregroundColor,
          light: settings.backgroundColor,
        },
        errorCorrectionLevel: ecc,
      });

      if (!settings.includeLogo || !effectiveLogoSrc) {
        qrCacheRef.current[cacheKey] = qrDataURL;
        setQrCache((prev) => ({ ...prev, [cacheKey]: qrDataURL }));
        return qrDataURL;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = size;
      canvas.height = size;

      const qrImage = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error('Failed to load QR image'));
        qrImage.src = qrDataURL;
      });

      ctx.drawImage(qrImage, 0, 0, size, size);

      const logoImage = document.createElement('img');
      if (!effectiveLogoSrc.startsWith('data:')) {
        try {
          const abs = new URL(effectiveLogoSrc, window.location.origin);
          if (abs.origin !== window.location.origin) {
            logoImage.crossOrigin = 'anonymous';
          }
        } catch {
          /* same-origin relative URLs: omit crossOrigin to avoid needless CORS */
        }
      }
      await new Promise<void>((resolve, reject) => {
        logoImage.onload = () => resolve();
        logoImage.onerror = () => reject(new Error('Failed to load logo image'));
        logoImage.src = effectiveLogoSrc;
      });

      const logoSize = Math.max(8, size * 0.22);
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;

      ctx.fillStyle = settings.backgroundColor || '#ffffff';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2 + 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      const finalDataURL = canvas.toDataURL('image/png');
      qrCacheRef.current[cacheKey] = finalDataURL;
      setQrCache((prev) => ({ ...prev, [cacheKey]: finalDataURL }));
      return finalDataURL;
    } catch (error) {
      console.error('Error generating QR code with logo:', error);
      const fallbackQR = await QRCode.toDataURL(productURL, {
        width: size,
        margin: 2,
        color: {
          dark: settings.foregroundColor,
          light: settings.backgroundColor,
        },
        errorCorrectionLevel: 'M',
      });
      qrCacheRef.current[cacheKey] = fallbackQR;
      setQrCache((prev) => ({ ...prev, [cacheKey]: fallbackQR }));
      return fallbackQR;
    }
  }, [
    settings.size,
    settings.foregroundColor,
    settings.backgroundColor,
    settings.includeLogo,
    effectiveLogoSrc,
    logoMode,
  ]);

  const generateQRCodeURL = (product: Product, customSize?: number) => {
    const size = customSize || settings.size;
    const logoKey = effectiveLogoSrc ? `${logoMode}-${effectiveLogoSrc.slice(0, 180)}` : 'nologo';
    const cacheKey = `${product.id}-${size}-${settings.includeLogo}-${logoKey}-${settings.foregroundColor}-${settings.backgroundColor}`;

    const sync = qrCacheRef.current[cacheKey];
    if (sync) return sync;

    generateQRCodeWithLogo(product, customSize).then((dataURL) => {
      setQrCache((prev) => ({ ...prev, [cacheKey]: dataURL }));
    });

    const productURL = `${window.location.origin}${buildProductPath(product.id)}`;
    const params = new URLSearchParams({
      size: `${size}x${size}`,
      data: productURL,
      bgcolor: settings.backgroundColor.replace('#', ''),
      color: settings.foregroundColor.replace('#', ''),
      qzone: '1',
      format: 'png',
    });

    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  };

  // QR Code Image Component with logo support
  const QRCodeImage = ({ product, size, className, fitContainer, imgStyle }: { product: Product; size?: number; className?: string; fitContainer?: boolean; imgStyle?: React.CSSProperties }) => {
    const [qrSrc, setQrSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      const generateQR = async () => {
        setIsLoading(true);
        try {
          const dataURL = await generateQRCodeWithLogo(product, size);
          if (!cancelled) setQrSrc(dataURL);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
          if (!cancelled) setQrSrc(generateQRCodeURL(product, size));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      generateQR();
      return () => {
        cancelled = true;
      };
    }, [
      product.id,
      size,
      settings.includeLogo,
      effectiveLogoSrc,
      settings.foregroundColor,
      settings.backgroundColor,
      generateQRCodeWithLogo,
    ]);

    if (isLoading) {
      return (
        <div className={`bg-slate-200 animate-pulse ${className}`} style={{ width: size || settings.size, height: size || settings.size }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      );
    }

    const style = fitContainer
      ? { width: '100%', height: 'auto' as const }
      : { width: size || settings.size, height: size || settings.size };

    return (
      <img
        src={qrSrc}
        alt={`QR Code for ${product.sku}`}
        className={className}
        style={{ ...style, ...(imgStyle || {}) }}
        loading="lazy"
        decoding="async"
      />
    );
  };

  // Calculate text sizes based on QR size
  const getTextSizes = () => {
    const baseSize = settings.size;
    const scaleFactor = baseSize / 200; // 200px is the base size

    return {
      productCode: Math.max(8, Math.round(10 * scaleFactor)),
      productName: Math.max(7, Math.round(9 * scaleFactor)),
      productPrice: Math.max(7, Math.round(8 * scaleFactor))
    };
  };

  // Calculate maximum items per row from usable sheet width (page minus edge margins)
  const getMaxItemsPerRow = () => {
    if (settings.pageFormat === 'Thermal') return 2; // Max 2 for 60mm roll
    const { w } = getPageDimensionsMm(settings.pageFormat);
    const usableWidthMm = Math.max(20, w - 2 * settings.pageEdgeMarginMm);
    const qrSizeMm = (settings.size / 4) / 3.78;
    const marginEffectMm = settings.margin / 3.78;
    const effectiveItemWidth = qrSizeMm + marginEffectMm;
    const maxItems = Math.floor(usableWidthMm / effectiveItemWidth);
    return Math.max(1, Math.min(maxItems, 15));
  };

  const MM_TO_PX = 3.7795275591; // 96dpi

  const getPageWidthPx = () => {
    if (settings.pageFormat === 'Thermal') {
      return `${Math.round(settings.thermalWidthMm * MM_TO_PX)}px`;
    }
    switch (settings.pageFormat) {
      case 'A4': return '794px';
      case 'A5': return '559px';
      case 'A3': return '1123px';
      case 'Letter': return '816px';
      default: return '794px';
    }
  };

  const getPageHeightPx = () => {
    if (settings.pageFormat === 'Thermal') {
      const usableW = Math.max(10, settings.thermalWidthMm - 2 * settings.pageEdgeMarginMm);
      const gapMm = Math.max(0.5, settings.margin / MM_TO_PX);
      const gapTotalMm = (settings.thermalColumns - 1) * gapMm;
      const qrMm = settings.thermalQrSizeOverrideMm > 0
        ? Math.min(settings.thermalQrSizeOverrideMm, Math.max(8, (usableW - gapTotalMm) / settings.thermalColumns))
        : Math.max(8, (usableW - gapTotalMm) / settings.thermalColumns);
      let singleLabelH: number;
      if (settings.thermalLabelHeightMm > 0) {
        singleLabelH = settings.thermalLabelHeightMm;
      } else {
        const textLines = (settings.showProductCode ? 1 : 0) + (settings.showProductName ? 2 : 0) + (settings.showPrice ? 1 : 0);
        singleLabelH = Math.ceil(qrMm + textLines * 3.5 + settings.pageEdgeMarginMm * 2 + 4);
      }
      const rows = Math.max(1, settings.thermalRowsPerCut || 1);
      const totalHmm = singleLabelH * rows + (rows - 1) * gapMm;
      return `${Math.round(totalHmm * MM_TO_PX)}px`;
    }
    switch (settings.pageFormat) {
      case 'A4': return '1123px';
      case 'A5': return '794px';
      case 'A3': return '1587px';
      case 'Letter': return '1056px';
      default: return '1123px';
    }
  };

  /** One page edge inset in CSS px (matches print @page margin for this format). */
  const getPageEdgePaddingPx = () => {
    const pageWPx = parseInt(getPageWidthPx(), 10);
    const { w: pageWmm } = getPageDimensionsMm(settings.pageFormat, settings.thermalWidthMm);
    if (pageWmm <= 0) return 0;
    return (settings.pageEdgeMarginMm / pageWmm) * pageWPx;
  };

  /** Thermal: usable label width in mm */
  const getThermalUsableWidthMm = () =>
    Math.max(10, settings.thermalWidthMm - 2 * settings.pageEdgeMarginMm);

  /** Gap between columns in mm */
  const getThermalGapMm = () => Math.max(0.5, settings.margin / MM_TO_PX);

  /** Thermal: QR size in mm — respects manual override or auto-fills column */
  const getThermalQrSizeMm = () => {
    const usable = getThermalUsableWidthMm();
    const gapMm = (settings.thermalColumns - 1) * getThermalGapMm();
    const autoMm = Math.max(8, (usable - gapMm) / settings.thermalColumns);
    if (settings.thermalQrSizeOverrideMm > 0) {
      // Clamp override to not exceed auto (can't be wider than cell)
      return Math.min(settings.thermalQrSizeOverrideMm, autoMm);
    }
    return autoMm;
  };

  /** Max columns before QR drops below 15mm (minimum scannable) */
  const getMaxThermalColumns = () => {
    const usable = getThermalUsableWidthMm();
    const minQrMm = 15;
    const minGapMm = 0.5;
    return Math.max(1, Math.min(6, Math.floor((usable + minGapMm) / (minQrMm + minGapMm))));
  };

  /** Max rows per cut before label group exceeds 200mm practical limit */
  const getMaxThermalRows = () => {
    const qrMm = getThermalQrSizeMm();
    const textLines = (settings.showProductCode ? 1 : 0) + (settings.showProductName ? 2 : 0) + (settings.showPrice ? 1 : 0);
    const rowHeightMm = qrMm + textLines * 3.5 + 2;
    return Math.max(1, Math.min(8, Math.floor(200 / rowHeightMm)));
  };

  /** Thermal: QR size in px for preview and print */
  const getThermalQrSizePx = () =>
    Math.round(getThermalQrSizeMm() * MM_TO_PX);

  /** Thermal: auto-calculate label height in mm from content */
  const getThermalLabelHeightMm = () => {
    if (settings.thermalLabelHeightMm > 0) return settings.thermalLabelHeightMm;
    const qrMm = getThermalQrSizeMm();
    const textLines = (settings.showProductCode ? 1 : 0) + (settings.showProductName ? 2 : 0) + (settings.showPrice ? 1 : 0);
    const textMm = textLines * 3.5;
    const paddingMm = settings.pageEdgeMarginMm * 2 + 4;
    return Math.ceil(qrMm + textMm + paddingMm);
  };

  /** Items per cut group in thermal mode */
  const getThermalItemsPerCut = () =>
    settings.thermalColumns * settings.thermalRowsPerCut;

  /** Active columns: thermalColumns for thermal, itemsPerRow otherwise */
  const getActiveColumns = () =>
    settings.pageFormat === 'Thermal' ? settings.thermalColumns : settings.itemsPerRow;

  const getPrintQrSizePx = () => {
    if (settings.pageFormat === 'Thermal') return getThermalQrSizePx();
    return Math.min(settings.size / 2.5, 80);
  };

  const getPrintItemHeightPx = () => {
    const qrPx = getPrintQrSizePx();
    const codePt = Math.max(6, Math.round(7 * (settings.size / 200)));
    const namePt = Math.max(5, Math.round(6 * (settings.size / 200)));
    const pricePt = 8;
    const codePx = settings.showProductCode ? (codePt * 1.333 + 4) : 0;
    const namePx = settings.showProductName ? (namePt * 1.333 * 2 + 4) : 0;
    const pricePx = settings.showPrice ? (pricePt * 1.333 + 4) : 0;
    const textPx = codePx + namePx + pricePx;
    const chromePx = settings.addBorder ? 8 : 6;
    return qrPx + textPx + settings.margin + chromePx;
  };

  const getItemsPerPage = () => {
    if (settings.pageFormat === 'Thermal') {
      return getThermalItemsPerCut();
    }
    const itemsPerRow = Math.max(1, settings.itemsPerRow);
    const pageHeightPx = parseInt(getPageHeightPx(), 10);
    const edgePx = getPageEdgePaddingPx();
    const gapPx = settings.margin;
    const usableHeightPx = Math.max(100, pageHeightPx - edgePx * 2);
    const itemHeightPx = getPrintItemHeightPx();
    const rowsPerPage = Math.max(1, Math.floor((usableHeightPx + gapPx) / (itemHeightPx + gapPx)));
    return Math.max(1, rowsPerPage * itemsPerRow);
  };

  // Get paginated products for A4 preview
  const getPaginatedProducts = () => {
    const itemsPerPage = getItemsPerPage();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return selectedProducts.slice(startIndex, endIndex);
  };

  // Get total pages
  const getTotalPages = useCallback(() => {
    if (selectedProducts.length === 0) return 1;
    const itemsPerPage = getItemsPerPage();
    return Math.ceil(selectedProducts.length / itemsPerPage);
  }, [selectedProducts.length, settings.itemsPerRow, settings.margin, settings.size, settings.pageFormat, settings.pageEdgeMarginMm]);

  // Stable pagination window
  const getVisiblePages = useCallback(() => {
    const total = getTotalPages();
    const windowSize = 5;
    if (total <= windowSize) return Array.from({ length: total }, (_, i) => i + 1);
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > total) {
      end = total;
      start = end - windowSize + 1;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, getTotalPages]);

  // Get optimal columns based on layout settings and container
  const getOptimalColumns = () => {
    // For A4 preview, use the user-defined itemsPerRow
    if (previewMode === 'a4') {
      return settings.itemsPerRow;
    }

    // For grid preview, calculate based on container width
    const containerWidth = 600; // Preview container max width
    const qrSize = Math.min(settings.size / 2.5, 70);
    const itemWidth = qrSize + settings.margin;
    const usableWidth = containerWidth - 32; // Account for padding

    return Math.max(1, Math.min(settings.itemsPerRow, Math.floor(usableWidth / itemWidth)));
  };

  // Keep page index valid when selected items or layout changes
  useEffect(() => {
    const total = getTotalPages();
    if (currentPage > total) setCurrentPage(total);
    if (currentPage < 1) setCurrentPage(1);
  }, [currentPage, getTotalPages]);

  // Handle QR generation
  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setProgress(0);

    // Simulate generation progress
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsGenerating(false);
    toast({
      title: "تم إنشاء الرموز بنجاح",
      description: `تم إنشاء ${selectedProducts.length} رمز QR`,
    });
  };

  /** Builds RTL HTML used ONLY for standard page printing (A4/A5/A3/Letter).
   *  Thermal mode uses buildThermalPdf() instead — never this function. */
  const preparePrintSheetHtml = async (onProgress?: (pct: number) => void): Promise<string> => {
    const itemsPerPage = getItemsPerPage();
    const totalPages = getTotalPages();
    const totalProducts = selectedProducts.length;
    const qrImageList: string[] = [];

    for (let i = 0; i < totalProducts; i++) {
      const product = selectedProducts[i]!;
      try {
        qrImageList.push(await generateQRCodeWithLogo(product));
      } catch {
        qrImageList.push(await QRCode.toDataURL(`${window.location.origin}${buildProductPath(product.id)}`, {
          width: settings.size, margin: 2,
          color: { dark: settings.foregroundColor, light: settings.backgroundColor },
          errorCorrectionLevel: 'M',
        }));
      }
      onProgress?.(Math.round(((i + 1) / totalProducts) * 50));
    }

    const innerPageMm = getInnerPageDimensionsMm(settings.pageFormat, settings.pageEdgeMarginMm, settings.thermalWidthMm, settings.thermalLabelHeightMm);
    const activeColumns = settings.itemsPerRow;
    const printQrPx = getPrintQrSizePx();
    const codeFontPt = Math.max(6, Math.round(7 * (settings.size / 200)));
    const nameFontPt = Math.max(5, Math.round(6 * (settings.size / 200)));

    let html = `<html dir="rtl"><head><title>رموز QR</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:${settings.pageFormat};margin:${settings.pageEdgeMarginMm}mm;}
      body{font-family:Arial,sans-serif;background:${settings.backgroundColor};-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .page{break-after:page;page-break-after:always;width:${innerPageMm.w}mm;height:${innerPageMm.h}mm;overflow:hidden;display:flex;flex-direction:column;}
      .page:last-child{break-after:auto;page-break-after:auto;}
      .qr-grid{display:grid;grid-template-columns:repeat(${activeColumns},minmax(0,1fr));gap:${settings.margin}px;align-content:start;padding:0;flex:1;}
      .qr-item{text-align:center;page-break-inside:avoid;background:#fff;padding:4px;border-radius:2px;${settings.addBorder ? `border:3px solid ${settings.borderColor};box-shadow:0 1px 3px rgba(0,0,0,.2);` : 'border:none;'}}
      .qr-code{width:${printQrPx}px;height:${printQrPx}px;margin:0 auto 2px;display:block;image-rendering:crisp-edges;}
      .code{font-weight:700;font-size:${codeFontPt}pt;color:${settings.foregroundColor};line-height:1.1;word-break:break-all;}
      .name{font-size:${nameFontPt}pt;color:#555;line-height:1.1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
      .price{font-size:8pt;color:#1d4ed8;font-weight:700;margin-top:2px;}
    </style></head><body>`;

    for (let page = 1; page <= totalPages; page++) {
      const slice = selectedProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
      html += `<div class="page"><div class="qr-grid">${
        slice.map((p, idx) => {
          const src = qrImageList[(page - 1) * itemsPerPage + idx] || '';
          return `<div class="qr-item"><img src="${src}" class="qr-code"/>
            ${settings.showProductCode ? `<div class="code">${p.sku}</div>` : ''}
            ${settings.showProductName ? `<div class="name">${p.nameAr}</div>` : ''}
            ${settings.showPrice ? `<div class="price">${p.price.toLocaleString()} ج.م</div>` : ''}
          </div>`;
        }).join('')
      }</div></div>`;
      onProgress?.(50 + Math.round((page / totalPages) * 50));
    }
    html += `</body></html>`;
    return html;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  THERMAL PDF ENGINE — bypasses CSS, browser layout, and Chrome headers
  //  Uses pure jsPDF coordinate drawing. Output is pixel-perfect at any DPI.
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  //  THERMAL PDF ENGINE v2 — canvas-based rendering
  //  Each cut group is drawn on an offscreen canvas at 203 DPI, then placed
  //  as a single PNG image filling the PDF page.
  //  WHY CANVAS:
  //   • Arabic text rendered natively by the browser (no jsPDF font encoding)
  //   • Pixel-perfect at 203 DPI — exactly what XP-235B expects
  //   • No CSS layout engine — coordinates are explicit mm→px math
  //   • PDF page size = exact label/group dimensions — driver won't rotate/scale
  // ─────────────────────────────────────────────────────────────────────────
  const buildThermalPdf = async (onProgress?: (pct: number) => void): Promise<Blob> => {
    const DPI = 203; // XP-235B native DPI
    const PX_PER_MM = DPI / 25.4;

    const cols = Math.max(1, settings.thermalColumns);
    const rowsPerCut = Math.max(1, settings.thermalRowsPerCut);
    const itemsPerCut = cols * rowsPerCut;

    // Physical label dimensions (what the printer driver is configured for)
    const labelWmm = settings.thermalWidthMm;
    const labelHmm = getThermalLabelHeightMm();
    const qrMm = getThermalQrSizeMm();
    const marginMm = Math.max(0, settings.pageEdgeMarginMm);
    const interGapMm = Math.max(0.3, settings.margin / MM_TO_PX);

    // Pixel sizes at 203 DPI
    const labelWpx = Math.round(labelWmm * PX_PER_MM);
    const labelHpx = Math.round(labelHmm * PX_PER_MM);
    const qrPx = Math.round(qrMm * PX_PER_MM);
    const marginPx = Math.round(marginMm * PX_PER_MM);
    const gapPx = Math.round(interGapMm * PX_PER_MM);

    // Usable column width in px
    const usableWpx = labelWpx - 2 * marginPx;
    const colWpx = Math.max(Math.round(8 * PX_PER_MM), Math.floor((usableWpx - (cols - 1) * gapPx) / cols));

    // Cut group canvas size
    const groupWpx = labelWpx;
    const groupHpx = labelHpx * rowsPerCut + Math.max(0, rowsPerCut - 1) * gapPx;
    const groupWmm = labelWmm;
    const groupHmm = labelHmm * rowsPerCut + Math.max(0, rowsPerCut - 1) * interGapMm;

    // Pre-generate QR images at printer resolution
    const n = selectedProducts.length;
    const qrImages: HTMLImageElement[] = [];
    for (let i = 0; i < n; i++) {
      try {
        const dataUrl = await generateQRCodeWithLogo(selectedProducts[i]!, qrPx);
        const img = new Image();
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = dataUrl; });
        qrImages.push(img);
      } catch {
        const fallback = await QRCode.toDataURL(`${window.location.origin}${buildProductPath(selectedProducts[i]!.id)}`, {
          width: qrPx, margin: 1, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'H',
        });
        const img = new Image();
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = fallback; });
        qrImages.push(img);
      }
      onProgress?.(Math.round(((i + 1) / n) * 55));
    }

    // Split products into cut groups
    const cutGroups: Product[][] = [];
    for (let i = 0; i < n; i += itemsPerCut) cutGroups.push(selectedProducts.slice(i, i + itemsPerCut));

    // jsPDF: ALWAYS portrait for thermal. Pass [w, h] in portrait order.
    // jsPDF swaps [w,h] if orientation doesn't match aspect ratio, so we must
    // always pass [min(w,h), max(w,h)] with the matching orientation.
    const isWiderThanTall = groupWmm > groupHmm;
    const pdfFormat: [number, number] = isWiderThanTall
      ? [groupWmm, groupHmm]   // landscape: pass as-is
      : [groupWmm, groupHmm];  // portrait: pass as-is
    const pdfOrientation: 'portrait' | 'landscape' = isWiderThanTall ? 'landscape' : 'portrait';

    const pdf = new jsPDF({ unit: 'mm', format: pdfFormat, orientation: pdfOrientation });

    // Draw each cut group onto a canvas → PNG → PDF page
    for (let gi = 0; gi < cutGroups.length; gi++) {
      if (gi > 0) pdf.addPage(pdfFormat, pdfOrientation);

      const group = cutGroups[gi]!;
      const canvas = document.createElement('canvas');
      canvas.width = groupWpx;
      canvas.height = groupHpx;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = settings.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, groupWpx, groupHpx);

      for (let pi = 0; pi < group.length; pi++) {
        const product = group[pi]!;
        const col = pi % cols;
        const row = Math.floor(pi / cols);

        const cellX = marginPx + col * (colWpx + gapPx);
        const cellY = row * (labelHpx + gapPx);

        // Cell background
        ctx.fillStyle = settings.backgroundColor || '#ffffff';
        ctx.fillRect(cellX, cellY, colWpx, labelHpx);

        // Border
        if (settings.addBorder) {
          ctx.strokeStyle = settings.borderColor || '#e2e8f0';
          ctx.lineWidth = Math.max(1, Math.round(0.25 * PX_PER_MM));
          const r = Math.round(0.8 * PX_PER_MM);
          ctx.beginPath();
          ctx.roundRect(cellX, cellY, colWpx, labelHpx, r);
          ctx.stroke();
        }

        // QR code — centered in column
        const qrImg = qrImages[gi * itemsPerCut + pi];
        const qrX = cellX + Math.round((colWpx - qrPx) / 2);
        const qrY = cellY + marginPx;
        if (qrImg) ctx.drawImage(qrImg, qrX, qrY, qrPx, qrPx);

        // Text — using browser canvas text (handles Arabic natively)
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        let textY = qrY + qrPx + Math.round(1.5 * PX_PER_MM);
        const textCenterX = cellX + Math.round(colWpx / 2);
        const maxTextW = colWpx - marginPx * 2;

        if (settings.showProductCode) {
          const fs = Math.max(8, Math.round(qrMm * 0.18 * PX_PER_MM));
          ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle = settings.foregroundColor || '#000000';
          ctx.textBaseline = 'top';
          ctx.fillText(product.sku, textCenterX, textY, maxTextW);
          textY += fs + Math.round(0.8 * PX_PER_MM);
        }
        if (settings.showProductName) {
          const fs = Math.max(7, Math.round(qrMm * 0.14 * PX_PER_MM));
          ctx.font = `${fs}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle = '#555555';
          ctx.textBaseline = 'top';
          // Fit name to width
          let name = product.nameAr;
          while (name.length > 3 && ctx.measureText(name).width > maxTextW) name = name.slice(0, -1);
          if (name !== product.nameAr) name = name.trimEnd() + '…';
          ctx.fillText(name, textCenterX, textY, maxTextW);
          textY += fs + Math.round(0.8 * PX_PER_MM);
        }
        if (settings.showPrice) {
          const fs = Math.max(8, Math.round(qrMm * 0.16 * PX_PER_MM));
          ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle = '#1d4ed8';
          ctx.textBaseline = 'top';
          ctx.fillText(`${product.price.toLocaleString()} ج.م`, textCenterX, textY, maxTextW);
        }
      }

      // Place canvas as full-page image in PDF (0,0 → exact page dimensions)
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, groupWmm, groupHmm, `g${gi}`, 'FAST');
      onProgress?.(55 + Math.round(((gi + 1) / cutGroups.length) * 45));
    }

    return pdf.output('blob');
  };



  const renderSheetPdfBlob = async (
    html: string,
    onPageProgress?: (pct: number) => void
  ): Promise<Blob> => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.title = 'qr-print-export';
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      throw new Error('تعذر إنشاء مستند الطباعة');
    }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 450));
    });
    const pageEls = iframeDoc.querySelectorAll('.page');
    if (pageEls.length === 0) {
      document.body.removeChild(iframe);
      throw new Error('لا توجد صفحات للتصدير');
    }
    const format = getJsPdfFormat(settings.pageFormat);
    const pdf = new jsPDF({ unit: 'mm', format, orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const n = pageEls.length;
    for (let i = 0; i < n; i++) {
      const el = pageEls[i] as HTMLElement;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: settings.backgroundColor || '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      if (i > 0) pdf.addPage(format, 'portrait');
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
      onPageProgress?.(Math.round(((i + 1) / n) * 100));
    }
    document.body.removeChild(iframe);
    return pdf.output('blob');
  };

  const buildWordBlob = async (onProgress?: (pct: number) => void): Promise<Blob> => {
    const n = selectedProducts.length;
    const qrImageList: string[] = [];
    for (let i = 0; i < n; i++) {
      const product = selectedProducts[i]!;
      try {
        qrImageList.push(await generateQRCodeWithLogo(product));
      } catch {
        const fallback = await QRCode.toDataURL(`${window.location.origin}${buildProductPath(product.id)}`, {
          width: settings.size,
          margin: 2,
          color: {
            dark: settings.foregroundColor,
            light: settings.backgroundColor,
          },
          errorCorrectionLevel: 'M',
        });
        qrImageList.push(fallback);
      }
      onProgress?.(Math.round(((i + 1) / n) * 70));
    }

    const cols = Math.max(1, settings.itemsPerRow);
    const imgPx = Math.min(140, Math.round(getPrintQrSizePx() * 1.6));
    const rows: TableRow[] = [];
    const rowCount = Math.ceil(selectedProducts.length / cols);
    for (let r = 0; r < rowCount; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= selectedProducts.length) {
          cells.push(new TableCell({ children: [new Paragraph('')] }));
          continue;
        }
        const product = selectedProducts[idx]!;
        const src = qrImageList[idx]!;
        const cellChildren: Paragraph[] = [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            children: [
              new ImageRun({
                type: 'png',
                data: dataUrlToUint8Array(src),
                transformation: { width: imgPx, height: imgPx },
              }),
            ],
          }),
        ];
        if (settings.showProductCode) {
          cellChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              children: [new TextRun({ text: product.sku, bold: true, size: 18 })],
            })
          );
        }
        if (settings.showProductName) {
          cellChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              children: [new TextRun({ text: product.nameAr, size: 16 })],
            })
          );
        }
        if (settings.showPrice) {
          cellChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              children: [new TextRun({ text: `${product.price.toLocaleString('ar-EG')} ج.م`, size: 18 })],
            })
          );
        }
        cells.push(new TableCell({ children: cellChildren }));
      }
      rows.push(new TableRow({ children: cells }));
    }

    const { w: pageWmm, h: pageHmm } = getPageDimensionsMm(settings.pageFormat);
    const doc = new DocxDocument({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(pageWmm),
                height: convertMillimetersToTwip(pageHmm),
                orientation: PageOrientation.PORTRAIT,
              },
              margin: {
                top: convertMillimetersToTwip(settings.pageEdgeMarginMm),
                right: convertMillimetersToTwip(settings.pageEdgeMarginMm),
                bottom: convertMillimetersToTwip(settings.pageEdgeMarginMm),
                left: convertMillimetersToTwip(settings.pageEdgeMarginMm),
              },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              children: [new TextRun({ text: 'رموز QR للمنتجات', bold: true, size: 32 })],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            }),
          ],
        },
      ],
    });
    onProgress?.(90);
    const blob = await Packer.toBlob(doc);
    onProgress?.(100);
    return blob;
  };

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareBlobWithFallback = async (blob: Blob, filename: string, successTitle: string) => {
    const file = new File([blob], filename, {
      type: blob.type || 'application/octet-stream',
    });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'رموز QR للمنتجات',
          text: filename,
        });
        toast({ title: successTitle, description: 'يمكنك الآن فتح الملف من تطبيق المشاركة.' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      console.warn('Share failed, falling back to download', e);
    }
    triggerFileDownload(blob, filename);
    toast({
      title: 'تم التحميل',
      description: 'المشاركة غير متاحة على هذا الجهاز؛ تم تنزيل الملف.',
    });
  };

  const handlePrintAll = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      if (settings.pageFormat === 'Thermal') {
        // ── THERMAL: generate precise PDF, open in new tab for printing ──
        // This completely bypasses Chrome's HTML layout engine, page size guessing,
        // and forced headers/footers. The PDF viewer prints at exact mm dimensions.
        const blob = await buildThermalPdf((p) => setProgress(p));
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.addEventListener('load', () => {
            setTimeout(() => {
              win.print();
              setTimeout(() => URL.revokeObjectURL(url), 3000);
            }, 800);
          });
        } else {
          // Popup blocked — offer download instead
          const a = document.createElement('a');
          a.href = url;
          a.download = `thermal-labels-${new Date().toISOString().split('T')[0]}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
          toast({ title: 'تم تحضير الطباعة', description: 'افتح الملف PDF واطبعه — قم بتفعيل النوافذ المنبثقة للطباعة المباشرة' });
        }
        toast({ title: '🖨 فتح PDF للطباعة الحرارية', description: `${selectedProducts.length} بطاقة · ${settings.thermalWidthMm}×${getThermalLabelHeightMm()}mm · تأكد أن إعداد الورق في الطابعة = ${settings.thermalWidthMm}×${getThermalLabelHeightMm()}mm` });
      } else {
        // ── STANDARD (A4/A5/…): HTML iframe print ──
        const printContent = await preparePrintSheetHtml((p) => setProgress(p));
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(printContent);
          iframeDoc.close();
          requestAnimationFrame(() => setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }, 500));
        }
        toast({ title: 'تم تحضير الطباعة', description: `${getTotalPages()} صفحة ${settings.pageFormat}` });
      }
    } catch (error) {
      console.error('Print failed:', error);
      toast({ title: 'خطأ في الطباعة', description: String(error), variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleDownloadPdf = async () => {
    if (selectedProducts.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    try {
      const stamp = new Date().toISOString().split('T')[0];
      if (settings.pageFormat === 'Thermal') {
        // Pure jsPDF — pixel-perfect thermal labels
        const blob = await buildThermalPdf((p) => setProgress(p));
        triggerFileDownload(blob, `thermal-labels-${stamp}.pdf`);
        toast({ title: 'تم التحميل', description: `PDF حراري · ${settings.thermalWidthMm}×${getThermalLabelHeightMm()}mm · ${selectedProducts.length} بطاقة` });
      } else {
        const html = await preparePrintSheetHtml((p) => setProgress(Math.round(p * 0.55)));
        const blob = await renderSheetPdfBlob(html, (p) => setProgress(55 + Math.round(p * 0.45)));
        triggerFileDownload(blob, `qr-codes-${stamp}.pdf`);
        toast({ title: 'تم التحميل', description: 'تم حفظ ملف PDF' });
      }
    } catch (error) {
      toast({ title: 'خطأ في PDF', description: String(error), variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleDownloadWord = async () => {
    if (selectedProducts.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    try {
      const blob = await buildWordBlob((p) => setProgress(p));
      const stamp = new Date().toISOString().split('T')[0];
      triggerFileDownload(blob, `qr-codes-${stamp}.docx`);
      toast({ title: 'تم التحميل', description: 'تم حفظ ملف Word (.docx)' });
    } catch (error) {
      console.error('Word export failed:', error);
      toast({
        title: 'خطأ في Word',
        description: 'تعذر إنشاء ملف Word',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleSharePdf = async () => {
    if (selectedProducts.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    try {
      const html = await preparePrintSheetHtml((p) => setProgress(Math.round(p * 0.55)));
      const blob = await renderSheetPdfBlob(html, (p) => setProgress(55 + Math.round(p * 0.45)));
      const stamp = new Date().toISOString().split('T')[0];
      await shareBlobWithFallback(blob, `qr-codes-${stamp}.pdf`, 'تمت مشاركة PDF');
    } catch (error) {
      console.error('Share PDF failed:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر مشاركة PDF',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleShareWord = async () => {
    if (selectedProducts.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    try {
      const blob = await buildWordBlob((p) => setProgress(p));
      const stamp = new Date().toISOString().split('T')[0];
      await shareBlobWithFallback(blob, `qr-codes-${stamp}.docx`, 'تمت مشاركة Word');
    } catch (error) {
      console.error('Share Word failed:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر مشاركة ملف Word',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Handle ZIP download with enhanced data
  const handleDownloadZIP = async () => {
    setIsGenerating(true);
    setProgress(0);

    toast({
      title: "جاري التحضير",
      description: "جاري تحضير ملف ZIP مع جميع البيانات...",
    });

    // Simulate ZIP creation process with progress
    for (let i = 0; i <= 100; i += 20) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Create comprehensive data package
    const qrData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalProducts: selectedProducts.length,
        settings: settings,
        format: 'QR Codes Export'
      },
      products: selectedProducts.map(product => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        nameAr: product.nameAr,
        price: product.price,
        category: product.category,
        qrUrl: generateQRCodeURL(product),
        productUrl: `${window.location.origin}${buildProductPath(product.id)}`,
        qrSettings: {
          size: settings.size,
          backgroundColor: settings.backgroundColor,
          foregroundColor: settings.foregroundColor,
          showCode: settings.showProductCode,
          showName: settings.showProductName,
          showPrice: settings.showPrice
        }
      }))
    };

    // Create HTML file for easy viewing
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>رموز QR للمنتجات</title>
          <style>
            body { font-family: Arial; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .item { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .qr { width: 150px; height: 150px; margin: 0 auto 15px; }
            .code { font-weight: bold; color: #333; margin: 10px 0; }
            .name { color: #666; margin: 5px 0; }
            .price { color: #007bff; font-weight: bold; }
            .url { font-size: 12px; color: #999; word-break: break-all; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>رموز QR للمنتجات</h1>
              <p>تم الإنشاء في: ${new Date().toLocaleDateString('ar-SA')}</p>
              <p>عدد المنتجات: ${selectedProducts.length}</p>
            </div>
            <div class="grid">
              ${selectedProducts.map(product => `
                <div class="item">
                  <img src="${generateQRCodeURL(product)}" alt="QR ${product.sku}" class="qr">
                  ${settings.showProductCode ? `<div class="code">${product.sku}</div>` : ''}
                  ${settings.showProductName ? `<div class="name">${product.nameAr}</div>` : ''}
                  ${settings.showPrice ? `<div class="price">${product.price.toLocaleString()} ج.م</div>` : ''}
                  <div class="url">${window.location.origin}${buildProductPath(product.id)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </body>
      </html>
    `;

    // Create and download files
    const jsonBlob = new Blob([JSON.stringify(qrData, null, 2)], { type: 'application/json' });
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

    // Download JSON data
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `qr-codes-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);

    // Download HTML preview
    setTimeout(() => {
      const htmlUrl = URL.createObjectURL(htmlBlob);
      const htmlLink = document.createElement('a');
      htmlLink.href = htmlUrl;
      htmlLink.download = `qr-codes-preview-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(htmlLink);
      htmlLink.click();
      document.body.removeChild(htmlLink);
      URL.revokeObjectURL(htmlUrl);
    }, 500);

    setIsGenerating(false);
    setProgress(100);

    toast({
      title: "تم التحميل بنجاح",
      description: `تم تحميل ${selectedProducts.length} رمز QR مع ملف المعاينة`,
    });
  };

  // Handle refresh preview
  const handleRefreshPreview = () => {
    setIsGenerating(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "تم التحديث",
        description: "تم تحديث المعاينة بنجاح",
      });
    }, 1000);
  };

  // Handle logo upload
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "خطأ في نوع الملف",
          description: "يرجى اختيار ملف صورة صالح",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "حجم الملف كبير",
          description: "يرجى اختيار صورة أصغر من 2 ميجابايت",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      setLogoMode('upload');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
        setSettings((prev) => ({ ...prev, includeLogo: true }));
      };
      reader.readAsDataURL(file);

      toast({
        title: "تم رفع الشعار",
        description: "تم تفعيل «إضافة الشعار» في وسط الرمز تلقائياً",
      });
    }
  };

  // Remove logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (resolvedSiteLogoUrl) {
      setLogoMode('site');
      setSettings((prev) => ({ ...prev, includeLogo: true }));
      toast({
        title: "تم إزالة الملف",
        description: "تم العودة لشعار الموقع من الإعدادات",
      });
    } else {
      setSettings((prev) => ({ ...prev, includeLogo: false }));
      toast({
        title: "تم حذف الشعار",
        description: "تم حذف الشعار من الإعدادات",
      });
    }
  };

  // Handle preview link for individual product
  const handlePreviewLink = (product: Product) => {
    const qrUrl = generateQRCodeURL(product);
    const productUrl = `${window.location.origin}${buildProductPath(product.id)}`;

    // Open in new window
    const previewWindow = window.open('', '_blank', 'width=600,height=400');
    if (previewWindow) {
      previewWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>معاينة QR - ${product.nameAr}</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .product-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h2>معاينة رمز QR</h2>
            <div class="product-info">
              <h3>${product.nameAr}</h3>
              <p>رمز المنتج: ${product.sku}</p>
              <p>السعر: ${product.price.toLocaleString()} ج.م</p>
            </div>
            <div class="qr-container">
              <img src="${qrUrl}" alt="QR Code" style="width: ${settings.size}px; height: ${settings.size}px;" />
            </div>
            <p>الرابط المقصود: <a href="${productUrl}" target="_blank">${productUrl}</a></p>
            <button onclick="window.print()" style="padding: 10px 20px; margin: 10px;">طباعة</button>
            <button onclick="window.close()" style="padding: 10px 20px; margin: 10px;">إغلاق</button>
          </body>
        </html>
      `);
    }
  };

  // Handle download single QR
  const handleDownloadSingle = (product: Product) => {
    const qrUrl = generateQRCodeURL(product);
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-${product.sku}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "تم التحميل",
      description: `تم تحميل رمز QR للمنتج ${product.nameAr}`,
    });
  };

  return (
    <AdminLayout>
      {/* Revolutionary Mobile vs Desktop Layout */}
      {isMobile ? (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50/30 to-indigo-50 relative overflow-hidden">
          {/* Mobile Revolutionary Header with Glassmorphism */}
          <div className="relative z-10 mb-6">
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/40 rounded-3xl shadow-2xl p-4 mx-3 mt-3 ring-1 ring-white/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl blur-sm opacity-70 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    رموز QR المتقدمة
                  </h1>
                  <p className="text-sm text-slate-600 font-medium">
                    إنشاء وطباعة رموز QR للمنتجات
                  </p>
                </div>
              </div>

              {/* Mobile Stats Row */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 rounded-xl px-3 py-2 shadow-md flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold">{selectedProducts.length} مختار</span>
                  </div>
                </div>

                {isGenerating && (
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border border-primary/20 rounded-xl px-3 py-2 shadow-md flex-1">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-bold">جارٍ الإعداد...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleGenerateAll}
                  disabled={selectedProducts.length === 0 || isGenerating}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      إنشاء الرموز
                    </>
                  )}
                </Button>
                <Button
                  onClick={handlePrintAll}
                  disabled={selectedProducts.length === 0 || isGenerating}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  طباعة الكل
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={selectedProducts.length === 0 || isGenerating}
                  className="h-11 rounded-xl font-semibold text-xs border-slate-200"
                >
                  <FileDown className="w-4 h-4 ml-1" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadWord}
                  disabled={selectedProducts.length === 0 || isGenerating}
                  className="h-11 rounded-xl font-semibold text-xs border-slate-200"
                >
                  <FileText className="w-4 h-4 ml-1" />
                  Word
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadZIP}
                  disabled={selectedProducts.length === 0 || isGenerating}
                  className="h-11 rounded-xl font-semibold text-xs border-orange-200 text-orange-800"
                >
                  <Download className="w-4 h-4 ml-1" />
                  ZIP
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={selectedProducts.length === 0 || isGenerating}
                      className="h-11 rounded-xl font-semibold text-xs w-full flex items-center justify-between gap-1 px-2"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Share2 className="w-4 h-4" />
                        مشاركة
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[11rem]">
                    <DropdownMenuItem
                      disabled={isGenerating}
                      onSelect={() => {
                        void handleSharePdf();
                      }}
                    >
                      <FileDown className="w-4 h-4 ml-2" />
                      مشاركة PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isGenerating}
                      onSelect={() => {
                        void handleShareWord();
                      }}
                    >
                      <FileText className="w-4 h-4 ml-2" />
                      مشاركة Word
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile Enhanced Progress Bar */}
          {isGenerating && (
            <div className="mx-3 mb-6 bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="font-bold text-slate-900 text-sm">جاري إنشاء رموز QR...</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-100" />
              <p className="text-xs text-slate-600 mt-2">{progress}% من العملية مكتملة</p>
            </div>
          )}

          {/* Mobile Preview Indicator */}
          <div className="mx-3 mb-4 flex items-center justify-between">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <span className="text-xs px-3 py-2 font-bold text-slate-800 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-primary" />
                معاينة الطباعة ({settings.pageFormat})
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPreview}
              disabled={isGenerating}
              className="border-primary/20 text-primary hover:bg-primary/5 disabled:opacity-50 shadow-sm px-3 py-2 bg-white"
            >
              <RefreshCw className={`w-3 h-3 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="text-xs font-semibold">تحديث</span>
            </Button>
          </div>

          {/* Mobile Card Layout */}
          <div className="mx-3 space-y-4 pb-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Smart Product Selector - Mobile */}
            <SmartProductSelector
              products={products}
              categories={categories}
              selectedProductIds={selectedProductIds}
              onSelectionChange={setSelectedProductIds}
            />
            {selectedProductIds.length > 0 && (
              <details className="rounded-lg border bg-white/95 shadow-sm">
                <summary className="cursor-pointer list-none p-2 text-xs font-semibold flex items-center justify-between">
                  <span>تكرار المنتجات (لاستهلاك مساحة أقل)</span>
                  <span className="text-slate-500">{selectedProductIds.length} عنصر</span>
                </summary>
                <div className="max-h-40 overflow-auto p-2 space-y-1">
                  {selectedProductIds.map((id) => {
                    const product = products.find((p) => p.id === id);
                    if (!product) return null;
                    const qty = selectedProductQuantities[id] || 1;
                    return (
                      <div key={`mobile-qty-${id}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate">{product.nameAr}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateSelectedQuantity(id, qty - 1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input type="number" min={1} className="w-14 h-6 text-center text-xs px-1" value={qty} onChange={(e) => updateSelectedQuantity(id, Number(e.target.value))} />
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateSelectedQuantity(id, qty + 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            <details className="rounded-lg border bg-white/95 shadow-sm">
              <summary className="cursor-pointer list-none p-3 text-sm font-semibold flex items-center gap-2">
                <Layout className="w-4 h-4 text-emerald-600" />
                إعدادات التخطيط
                <span className="text-xs font-normal text-slate-500 mr-auto">
                  {getItemsPerPage()} عنصر/صفحة
                </span>
              </summary>
              <div className="px-3 pb-3 space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">تنسيق الصفحة</Label>
                  <Select
                    value={settings.pageFormat}
                    onValueChange={(value: QRSettings['pageFormat']) =>
                      setSettings({ ...settings, pageFormat: value })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="A3">A3</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">هامش الحواف: {settings.pageEdgeMarginMm}mm</Label>
                  <Slider
                    value={[settings.pageEdgeMarginMm]}
                    onValueChange={(value) =>
                      setSettings({ ...settings, pageEdgeMarginMm: value[0] })
                    }
                    min={0}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">
                    عناصر/صف (حد {getMaxItemsPerRow()}): {Math.min(settings.itemsPerRow, getMaxItemsPerRow())}
                  </Label>
                  <Slider
                    value={[Math.min(settings.itemsPerRow, getMaxItemsPerRow())]}
                    onValueChange={(value) => setSettings({ ...settings, itemsPerRow: value[0] })}
                    min={1}
                    max={getMaxItemsPerRow()}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">بين الرموز: {settings.margin}px</Label>
                  <Slider
                    value={[settings.margin]}
                    onValueChange={(value) => setSettings({ ...settings, margin: value[0] })}
                    min={0}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">حجم الرمز: {settings.size}px</Label>
                  <Slider
                    value={[settings.size]}
                    onValueChange={(value) => setSettings({ ...settings, size: value[0] })}
                    min={100}
                    max={300}
                    step={25}
                    className="w-full"
                  />
                </div>
              </div>
            </details>

            {/* Mobile QR Settings Card */}
            <Card className="bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-purple-50/80 to-pink-50/80 border-b border-slate-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-md">
                    <Palette className="w-4 h-4 text-white" />
                  </div>
                  إعدادات التخصيص
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium text-sm">
                  تخصيص مظهر رموز QR وألوانها
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Mobile QR Size */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">حجم الرمز: {settings.size}px</Label>
                  <Slider
                    value={[settings.size]}
                    onValueChange={(value) => setSettings({ ...settings, size: value[0] })}
                    min={100}
                    max={300}
                    step={25}
                    className="w-full"
                  />
                </div>

                {/* Mobile Color Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">لون الرمز</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.foregroundColor}
                        onChange={(e) => setSettings({ ...settings, foregroundColor: e.target.value })}
                        className="w-8 h-8 rounded border"
                      />
                      <Input
                        value={settings.foregroundColor}
                        onChange={(e) => setSettings({ ...settings, foregroundColor: e.target.value })}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">لون الخلفية</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded border"
                      />
                      <Input
                        value={settings.backgroundColor}
                        onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Display Options */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">خيارات العرض</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إظهار رقم المنتج</Label>
                      <Switch
                        checked={settings.showProductCode}
                        onCheckedChange={(checked) => setSettings({ ...settings, showProductCode: checked })}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إظهار اسم المنتج</Label>
                      <Switch
                        checked={settings.showProductName}
                        onCheckedChange={(checked) => setSettings({ ...settings, showProductName: checked })}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إظهار السعر</Label>
                      <Switch
                        checked={settings.showPrice}
                        onCheckedChange={(checked) => setSettings({ ...settings, showPrice: checked })}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إضافة إطار</Label>
                      <Switch
                        checked={settings.addBorder}
                        onCheckedChange={(checked) => setSettings({ ...settings, addBorder: checked })}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Preview Card */}
            <Card className="bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 mb-6">
              <CardHeader className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-b border-slate-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  المعاينة الطِباعية ({settings.pageFormat})
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium text-xs">
                  معاينة دقيقة لصفحة الطباعة
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 overflow-x-auto select-none">
                {selectedProducts.length > 0 ? (
                  <div className="space-y-4">
                    {/* Mobile A4 Pagination Controls */}
                    {getTotalPages() > 1 && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="text-xs px-2 py-1 font-bold"
                        >
                          <ChevronLeft className="w-3 h-3 mr-1" />
                          السابق
                        </Button>
                        <span className="text-xs text-slate-700 font-bold bg-white px-2 py-1 rounded shadow-sm border">
                          صفحة {currentPage} من {getTotalPages()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                          disabled={currentPage === getTotalPages()}
                          className="text-xs px-2 py-1 font-bold"
                        >
                          التالي
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    )}

                    {/* Mobile Real Preview Container */}
                    <div className="flex justify-center w-full min-w-fit overflow-x-auto pb-4 pt-2">
                      <div className="bg-slate-100 p-2 sm:p-4 rounded-xl shadow-inner border border-slate-200 inline-block">
                        <div
                          className="bg-white shadow-md border"
                          style={{
                            width: getPageWidthPx(),
                            height: getPageHeightPx(),
                            backgroundColor: settings.backgroundColor,
                            transformOrigin: 'top center',
                            transform: 'scale(0.5)',
                            marginBottom: '-50%' // compensate for scale height collapse on mobile
                          }}
                        >
                          {/* Full Page Grid Layout (mirrors print) */}
                          <div
                            className="p-0"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`,
                              gap: `${settings.margin}px`,
                              alignContent: 'start',
                              justifyItems: 'stretch',
                              boxSizing: 'border-box',
                              height: '100%',
                              padding: `${getPageEdgePaddingPx()}px`
                            }}
                          >
                            {selectedProducts
                              .slice((currentPage - 1) * getItemsPerPage(), Math.min(currentPage * getItemsPerPage(), selectedProducts.length))
                              .map((product, idx) => (
                                <div
                                  key={`${product.id}-m-${idx}`}
                                  className="text-center w-full flex flex-col items-center"
                                  style={{
                                    padding: `4px`,
                                    border: settings.addBorder ? `3px solid ${settings.borderColor}` : 'none',
                                    boxShadow: settings.addBorder ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                                    borderRadius: '2px',
                                    backgroundColor: '#ffffff',
                                    maxWidth: '100%',
                                    minWidth: 0
                                  }}
                                >
                                  <div className="flex justify-center mb-1 w-full">
                                    <QRCodeImage
                                      product={product}
                                      className="block"
                                      size={getPrintQrSizePx()}
                                      imgStyle={{ imageRendering: 'crisp-edges', mixBlendMode: 'multiply' }}
                                    />
                                  </div>
                                  {settings.showProductCode && (
                                    <div
                                      className="font-bold truncate"
                                      style={{
                                        color: settings.foregroundColor,
                                        fontSize: `${getTextSizes().productCode}pt`,
                                        lineHeight: '1.2',
                                        marginBottom: '1px'
                                      }}
                                    >
                                      {product.sku}
                                    </div>
                                  )}
                                  {settings.showProductName && (
                                    <div
                                      className="text-slate-600 leading-tight"
                                      style={{
                                        fontSize: `${getTextSizes().productName}pt`,
                                        lineHeight: '1.2',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        marginBottom: '1px'
                                      }}
                                    >
                                      {product.nameAr}
                                    </div>
                                  )}
                                  {settings.showPrice && (
                                    <div
                                      className="text-blue-600 font-bold"
                                      style={{
                                        fontSize: `${getTextSizes().productPrice}pt`,
                                        lineHeight: '1.2',
                                        marginTop: '2px'
                                      }}
                                    >
                                      {product.price.toLocaleString()} ج.م
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 font-medium text-center bg-slate-50 p-2 rounded-lg border">
                      {getItemsPerPage()} عنصر/صفحة • {settings.itemsPerRow} عنصر/صف
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 font-medium">لا توجد منتجات محددة</p>
                    <p className="text-xs text-slate-400 mt-1">يرجى تحديد المنتجات أولاً لرؤية المعاينة الطِباعية</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Desktop: Original Desktop Layout continues here... */
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/30 relative overflow-hidden">
          <div className="relative z-10 p-8">
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Settings */}
                <div className="space-y-8">
                  {/* Smart Product Selector - Desktop */}
                  <SmartProductSelector
                    products={products}
                    categories={categories}
                    selectedProductIds={selectedProductIds}
                    onSelectionChange={setSelectedProductIds}
                  />
                  {selectedProductIds.length > 0 && (
                    <details className="rounded-lg border bg-white/80 shadow-sm">
                      <summary className="cursor-pointer list-none p-3 text-sm font-semibold flex items-center justify-between">
                        <span>تكرار المنتجات</span>
                        <span className="text-xs text-slate-500">{selectedProductIds.length} عنصر</span>
                      </summary>
                      <div className="max-h-44 overflow-auto p-3 space-y-2">
                        {selectedProductIds.map((id) => {
                          const product = products.find((p) => p.id === id);
                          if (!product) return null;
                          const qty = selectedProductQuantities[id] || 1;
                          return (
                            <div key={`desktop-qty-${id}`} className="flex items-center justify-between gap-3 rounded border px-2 py-1.5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{product.nameAr}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => updateSelectedQuantity(id, qty - 1)}>
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input type="number" min={1} className="w-16 h-7 text-center text-xs px-1" value={qty} onChange={(e) => updateSelectedQuantity(id, Number(e.target.value))} />
                                <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => updateSelectedQuantity(id, qty + 1)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {/* Enhanced Layout Settings */}
                  <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 border-b border-slate-100">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-md">
                          <Layout className="w-6 h-6 text-white" />
                        </div>
                        إعدادات التخطيط
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium">
                        تخصيص تخطيط الطباعة والعرض • {getItemsPerPage()} عنصر لكل صفحة
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Page Format Selector */}
                      <div className="space-y-2">
                        <Label>نوع الطباعة</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['A4','A5','Thermal'] as QRSettings['pageFormat'][]).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setSettings(prev => ({ ...prev, pageFormat: fmt }))}
                              className={`rounded-lg border-2 p-2 text-center transition-all ${settings.pageFormat === fmt ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                            >
                              {fmt === 'A4' && <><div className="text-xs font-bold">A4</div><div className="text-[10px] text-slate-400">210×297mm</div></>}
                              {fmt === 'A5' && <><div className="text-xs font-bold">A5</div><div className="text-[10px] text-slate-400">148×210mm</div></>}
                              {fmt === 'Thermal' && <><div className="text-xs font-bold">🖨 حراري</div><div className="text-[10px] text-slate-400">لفافة {settings.thermalWidthMm}mm</div></>}
                            </button>
                          ))}
                        </div>
                        {/* Extra formats collapsible */}
                        <Select
                          value={['A4','A5','Thermal'].includes(settings.pageFormat) ? '' : settings.pageFormat}
                          onValueChange={(value: QRSettings['pageFormat']) => value && setSettings({ ...settings, pageFormat: value })}
                        >
                          <SelectTrigger className="text-xs text-slate-500 h-7 border-dashed">
                            <SelectValue placeholder="تنسيقات أخرى (A3، Letter)…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A3">A3 (297×420mm)</SelectItem>
                            <SelectItem value="Letter">Letter (216×279mm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* ── THERMAL-SPECIFIC CONTROLS ── */}
                      {settings.pageFormat === 'Thermal' && (() => {
                        const maxCols = getMaxThermalColumns();
                        const maxRows = getMaxThermalRows();
                        const qrMm = getThermalQrSizeMm();
                        const labelH = getThermalLabelHeightMm();
                        const preset = THERMAL_PRESETS.find(p => p.id === settings.thermalPrinterModel);
                        const totalLabels = selectedProducts.length;
                        const labelsPerCut = getThermalItemsPerCut();

                        return (
                        <div className="space-y-4 rounded-xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white p-4">

                          {/* ⚠ Calibration warning — most important info */}
                          <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900">
                            <span className="text-base leading-none">⚠</span>
                            <div>
                              <div className="font-bold mb-0.5">يجب مطابقة الأبعاد مع الملصق الفعلي</div>
                              <div className="text-amber-700">الأبعاد في الإعدادات يجب أن تكون نفس حجم ملصقك الفعلي — اقس ملصقك أو راجع إعدادات الطابعة في Windows قبل الطباعة</div>
                            </div>
                          </div>

                          {/* Printer model dropdown */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-emerald-800">طراز الطابعة</Label>
                            <Select
                              value={settings.thermalPrinterModel}
                              onValueChange={(v: ThermalPresetId) => {
                                const p = THERMAL_PRESETS.find(x => x.id === v)!;
                                setSettings(prev => ({
                                  ...prev,
                                  thermalPrinterModel: v,
                                  thermalWidthMm: p.defaultMm,
                                  thermalColumns: Math.min(prev.thermalColumns, Math.max(1, Math.floor((p.defaultMm - 4) / 16))),
                                }));
                              }}
                            >
                              <SelectTrigger className="bg-white border-emerald-300 text-sm h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {THERMAL_PRESETS.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{p.name}</span>
                                      {p.popular && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">شائع</span>}
                                      <span className="text-[10px] text-slate-400 mr-auto">{p.note}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Label stock size presets */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-emerald-800">حجم الملصق الفعلي <span className="font-normal text-slate-500">(اختر أو اضبط يدوياً)</span></Label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { w: 30, h: 20, label: '30×20' },
                                { w: 40, h: 30, label: '40×30' },
                                { w: 40, h: 40, label: '40×40' },
                                { w: 50, h: 30, label: '50×30' },
                                { w: 58, h: 40, label: '58×40' },
                                { w: 58, h: 60, label: '58×60' },
                              ].map(({ w, h, label }) => {
                                const active = settings.thermalWidthMm === w && settings.thermalLabelHeightMm === h;
                                return (
                                  <button key={label} type="button"
                                    onClick={() => setSettings(prev => ({ ...prev, thermalWidthMm: w, thermalLabelHeightMm: h }))}
                                    className={`rounded-lg border py-1.5 text-[11px] font-semibold transition-all ${active ? 'border-emerald-500 bg-emerald-500 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}
                                  >
                                    {label}mm
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Roll Width */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-emerald-800">عرض الملصق <span className="font-normal text-slate-400">(mm)</span></Label>
                              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 rounded px-2 py-0.5">{settings.thermalWidthMm}mm</span>
                            </div>
                            <Slider
                              value={[settings.thermalWidthMm]}
                              onValueChange={([v]) => setSettings(prev => ({
                                ...prev, thermalWidthMm: v,
                                thermalColumns: Math.min(prev.thermalColumns, Math.max(1, Math.floor((v - 4) / 16))),
                              }))}
                              min={20} max={preset?.maxMm ?? 108} step={1} className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>20mm</span>
                              <span>الحد الأقصى للطابعة: {preset?.maxMm ?? 108}mm</span>
                            </div>
                          </div>

                          {/* Grid: Columns × Rows */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Columns */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-emerald-800">أعمدة / صف</Label>
                                <span className="text-xs font-bold text-emerald-700">{settings.thermalColumns}</span>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {Array.from({ length: maxCols }, (_, i) => i + 1).map(c => (
                                  <button key={c} type="button"
                                    onClick={() => setSettings(prev => ({ ...prev, thermalColumns: c }))}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold border-2 transition-all ${settings.thermalColumns === c ? 'border-emerald-500 bg-emerald-500 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
                                  >{c}</button>
                                ))}
                              </div>
                              <div className="text-[10px] text-slate-400">أقصى ممكن: {maxCols} (QR ≥15mm)</div>
                            </div>

                            {/* Rows per cut */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-emerald-800">صفوف / قطعة</Label>
                                <span className="text-xs font-bold text-emerald-700">{settings.thermalRowsPerCut}</span>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {Array.from({ length: maxRows }, (_, i) => i + 1).map(r => (
                                  <button key={r} type="button"
                                    onClick={() => setSettings(prev => ({ ...prev, thermalRowsPerCut: r }))}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold border-2 transition-all ${settings.thermalRowsPerCut === r ? 'border-emerald-500 bg-emerald-500 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
                                  >{r}</button>
                                ))}
                              </div>
                              <div className="text-[10px] text-slate-400">أقصى ممكن: {maxRows} صفوف</div>
                            </div>
                          </div>

                          {/* Grid visual preview */}
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-slate-500">شكل القطعة:</div>
                            <div className="inline-grid gap-0.5 border border-slate-200 rounded p-1 bg-white"
                              style={{ gridTemplateColumns: `repeat(${settings.thermalColumns}, 1fr)` }}>
                              {Array.from({ length: settings.thermalColumns * settings.thermalRowsPerCut }).map((_, i) => (
                                <div key={i} className="w-5 h-5 bg-emerald-200 rounded-sm flex items-center justify-center">
                                  <div className="w-3 h-3 bg-emerald-600 rounded-[1px]" />
                                </div>
                              ))}
                            </div>
                            <div className="text-xs font-bold text-emerald-700">{settings.thermalColumns}×{settings.thermalRowsPerCut} = {labelsPerCut} بطاقة/قطعة</div>
                          </div>

                          {/* QR Size override */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-emerald-800">حجم QR</Label>
                              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 rounded px-2 py-0.5">
                                {settings.thermalQrSizeOverrideMm === 0 ? `تلقائي (${Math.round(qrMm)}mm)` : `${settings.thermalQrSizeOverrideMm}mm`}
                              </span>
                            </div>
                            <Slider
                              value={[settings.thermalQrSizeOverrideMm]}
                              onValueChange={([v]) => setSettings(prev => ({ ...prev, thermalQrSizeOverrideMm: v }))}
                              min={0} max={Math.floor(getThermalUsableWidthMm())} step={1} className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>0 = تلقائي (يملأ العمود)</span>
                              <span>أقصى: {Math.floor(getThermalUsableWidthMm())}mm</span>
                            </div>
                            {settings.thermalQrSizeOverrideMm > 0 && settings.thermalQrSizeOverrideMm < 15 && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                ⚠ أقل من 15mm قد يصعب مسحه — يُنصح بـ 20mm على الأقل
                              </div>
                            )}
                          </div>

                          {/* Label height */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-emerald-800">ارتفاع الملصق <span className="font-normal text-slate-400">(mm)</span></Label>
                              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 rounded px-2 py-0.5">
                                {settings.thermalLabelHeightMm === 0 ? `تلقائي (${labelH}mm)` : `${settings.thermalLabelHeightMm}mm ← فعلي`}
                              </span>
                            </div>
                            <Slider
                              value={[settings.thermalLabelHeightMm]}
                              onValueChange={([v]) => setSettings(prev => ({ ...prev, thermalLabelHeightMm: v }))}
                              min={0} max={120} step={1} className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>0 = تلقائي (محسوب)</span><span>قس ملصقك واضبط هنا → 120mm</span>
                            </div>
                          </div>

                          {/* Margin */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-emerald-800">هامش البطاقة</Label>
                              <span className="text-xs font-bold text-emerald-700">{settings.pageEdgeMarginMm}mm</span>
                            </div>
                            <Slider
                              value={[settings.pageEdgeMarginMm]}
                              onValueChange={([v]) => setSettings(prev => ({ ...prev, pageEdgeMarginMm: v }))}
                              min={0} max={5} step={0.5} className="w-full"
                            />
                          </div>

                          {/* Live specs grid */}
                          <div className="grid grid-cols-2 gap-2 rounded-xl bg-white border border-emerald-200 p-3 text-xs">
                            {[
                              ['عرض اللفافة', `${settings.thermalWidthMm}mm`],
                              ['حجم QR الفعلي', `${Math.round(qrMm)}×${Math.round(qrMm)}mm`],
                              ['ارتفاع البطاقة', `${labelH}mm`],
                              ['بطاقة / قطعة', `${labelsPerCut}`],
                              ['إجمالي البطاقات', `${totalLabels}`],
                              ['عدد القطع', `${Math.ceil(totalLabels / labelsPerCut)}`],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1.5">
                                <span className="text-slate-500">{k}</span>
                                <span className="font-bold text-slate-700">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })()}

                      {/* ── STANDARD PAGE CONTROLS (non-thermal) ── */}
                      {settings.pageFormat !== 'Thermal' && (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <Label>هامش حواف الصفحة: {settings.pageEdgeMarginMm}mm</Label>
                              <div className="text-xs text-slate-500 text-left">يحدّ العرض والارتفاع المتاحين</div>
                            </div>
                            <Slider
                              value={[settings.pageEdgeMarginMm]}
                              onValueChange={(value) => setSettings({ ...settings, pageEdgeMarginMm: value[0] })}
                              min={0} max={30} step={1} className="w-full"
                            />
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>0 — بدون هامش</span><span>30mm</span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>حجم الرمز: {settings.size}px</Label>
                              <div className="text-xs text-slate-500">يؤثر على العدد المسموح في الصف</div>
                            </div>
                            <Slider
                              value={[settings.size]}
                              onValueChange={(value) => setSettings({ ...settings, size: value[0] })}
                              min={100} max={500} step={25} className="w-full"
                            />
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>صغير (100px)</span><span>متوسط (300px)</span><span>كبير (500px)</span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>العناصر في كل صف: {Math.min(settings.itemsPerRow, getMaxItemsPerRow())} (الحد الأقصى: {getMaxItemsPerRow()})</Label>
                              <div className="text-xs text-slate-500">{getItemsPerPage()} عنصر/صفحة</div>
                            </div>
                            <Slider
                              value={[Math.min(settings.itemsPerRow, getMaxItemsPerRow())]}
                              onValueChange={(value) => setSettings({ ...settings, itemsPerRow: value[0] })}
                              min={1} max={getMaxItemsPerRow()} step={1} className="w-full"
                            />
                            <div className="mt-2 p-2 bg-slate-50 rounded border">
                              <div className="text-xs text-slate-600 mb-1">معاينة التخطيط:</div>
                              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`, width: '120px', height: '60px', overflow: 'hidden' }}>
                                {Array.from({ length: Math.min(settings.itemsPerRow * 3, 12) }).map((_, i) => (
                                  <div key={i} className="bg-primary/30 rounded-sm" style={{ width: '8px', height: '8px', margin: '1px' }} />
                                ))}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{settings.itemsPerRow} عنصر/صف</div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>المسافة بين الرموز: {settings.margin}px</Label>
                              <div className="text-xs text-slate-500">داخل منطقة الطباعة</div>
                            </div>
                            <Slider
                              value={[settings.margin]}
                              onValueChange={(value) => setSettings({ ...settings, margin: value[0] })}
                              min={0} max={50} step={5} className="w-full"
                            />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* QR Customization Settings */}
                  <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-50/50 border-b border-slate-100">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                        <div className="p-2 bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-md">
                          <Palette className="w-6 h-6 text-white" />
                        </div>
                        إعدادات التخصيص
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium">
                        تخصيص مظهر رموز QR وألوانها
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      {/* Color Settings */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm">لون الرمز</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={settings.foregroundColor}
                              onChange={(e) => setSettings({ ...settings, foregroundColor: e.target.value })}
                              className="w-8 h-8 rounded border"
                            />
                            <Input
                              value={settings.foregroundColor}
                              onChange={(e) => setSettings({ ...settings, foregroundColor: e.target.value })}
                              className="text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">لون الخلفية</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={settings.backgroundColor}
                              onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                              className="w-8 h-8 rounded border"
                            />
                            <Input
                              value={settings.backgroundColor}
                              onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Border Settings */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-gradient-to-r from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/50 transition-all duration-200 shadow-sm hover:shadow-md">
                          <div>
                            <Label className="font-semibold text-slate-900 text-base">إضافة إطار</Label>
                            <p className="text-sm text-slate-600 mt-1">إضافة إطار حول الرمز</p>
                          </div>
                          <Switch
                            checked={settings.addBorder}
                            onCheckedChange={(checked) => setSettings({ ...settings, addBorder: checked })}
                            className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-400 scale-125 shadow-lg data-[state=checked]:shadow-purple-300 transition-all duration-300"
                          />
                        </div>

                        {settings.addBorder && (
                          <div className="space-y-2">
                            <Label className="text-sm">لون الإطار</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={settings.borderColor}
                                onChange={(e) => setSettings({ ...settings, borderColor: e.target.value })}
                                className="w-8 h-8 rounded border"
                              />
                              <Input
                                value={settings.borderColor}
                                onChange={(e) => setSettings({ ...settings, borderColor: e.target.value })}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Display Options */}
                      <div className="space-y-4 mt-6">
                        <h4 className="font-semibold text-slate-800 border-b pb-2">خيارات النص</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <Label className="text-sm cursor-pointer" htmlFor="showCode">إظهار رقم المنتج</Label>
                            <Switch
                              id="showCode"
                              checked={settings.showProductCode}
                              onCheckedChange={(checked) => setSettings({ ...settings, showProductCode: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <Label className="text-sm cursor-pointer" htmlFor="showName">إظهار اسم المنتج</Label>
                            <Switch
                              id="showName"
                              checked={settings.showProductName}
                              onCheckedChange={(checked) => setSettings({ ...settings, showProductName: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <Label className="text-sm cursor-pointer" htmlFor="showPrice">إظهار السعر</Label>
                            <Switch
                              id="showPrice"
                              checked={settings.showPrice}
                              onCheckedChange={(checked) => setSettings({ ...settings, showPrice: checked })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Logo Settings — site logo or custom upload */}
                      <div className="space-y-4 p-4 rounded-lg border bg-slate-50/50">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <Label className="font-medium text-slate-900">إضافة الشعار</Label>
                            <p className="text-sm text-slate-500">شعار الموقع من الإعدادات أو صورة ترفعها هنا</p>
                          </div>
                          <Switch
                            checked={settings.includeLogo}
                            onCheckedChange={(checked) => setSettings({ ...settings, includeLogo: checked })}
                            className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-400 scale-125 shadow-lg data-[state=checked]:shadow-indigo-300 transition-all duration-300 shrink-0"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={logoMode === 'site' ? 'default' : 'outline'}
                            className="gap-1.5"
                            onClick={() => {
                              setLogoMode('site');
                              setLogoFile(null);
                              setLogoPreview('');
                            }}
                          >
                            <Image className="h-4 w-4" aria-hidden />
                            شعار الموقع
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={logoMode === 'upload' ? 'default' : 'outline'}
                            className="gap-1.5"
                            onClick={() => setLogoMode('upload')}
                          >
                            <Upload className="h-4 w-4" aria-hidden />
                            رفع صورة
                          </Button>
                        </div>

                        {settings.includeLogo && !effectiveLogoSrc ? (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                            {logoMode === 'site'
                              ? 'لا يوجد شعار محفوظ للموقع. عيّنه من الإعدادات أو اختر «رفع صورة».'
                              : 'ارفع صورة شعار لاستخدامها في الرمز.'}
                          </p>
                        ) : null}

                        {logoMode === 'site' ? (
                          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                            <div className="flex-shrink-0">
                              <img
                                src={resolvedSiteLogoUrl || LOGO_IMAGE_FALLBACK}
                                alt=""
                                className="w-14 h-14 object-contain rounded border bg-white"
                                onError={applyLogoImageFallback}
                              />
                            </div>
                            <p className="text-sm text-slate-600 flex-1 min-w-0">
                              يُستخدم الشعار المعروض في المتجر (من صفحة الإعدادات).
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {!logoPreview ? (
                              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                  id="logo-upload"
                                />
                                <label
                                  htmlFor="logo-upload"
                                  className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                  <Upload className="w-8 h-8 text-slate-400" />
                                  <div className="text-sm text-slate-600">
                                    <span className="font-medium text-primary">اختر ملف الشعار</span>
                                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF حتى 2MB</p>
                                  </div>
                                </label>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                <div className="flex-shrink-0">
                                  <img
                                    src={logoPreview || LOGO_IMAGE_FALLBACK}
                                    alt=""
                                    className="w-12 h-12 object-contain rounded border"
                                    onError={applyLogoImageFallback}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{logoFile?.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRemoveLogo}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Generation Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        إجراءات الإنشاء
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Progress Bar */}
                      {isGenerating && (
                        <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-primary">جاري المعالجة…</span>
                            <span className="text-primary">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      )}

                      {/* Stats bar */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { v: selectedProducts.length, l: 'بطاقة', icon: '🏷' },
                          { v: settings.pageFormat === 'Thermal' ? Math.ceil(selectedProducts.length / getThermalItemsPerCut()) : getTotalPages(), l: settings.pageFormat === 'Thermal' ? 'قطعة' : 'صفحة', icon: settings.pageFormat === 'Thermal' ? '✂' : '📄' },
                          { v: settings.pageFormat === 'Thermal' ? getThermalItemsPerCut() : getItemsPerPage(), l: settings.pageFormat === 'Thermal' ? '/قطعة' : '/صفحة', icon: '⚡' },
                        ].map(({ v, l, icon }) => (
                          <div key={l} className="text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <div className="text-base">{icon}</div>
                            <div className="text-lg font-bold text-slate-800">{v}</div>
                            <div className="text-[10px] text-slate-500">{l}</div>
                          </div>
                        ))}
                      </div>

                      {/* Primary: Print */}
                      <Button
                        onClick={handlePrintAll}
                        disabled={selectedProducts.length === 0 || isGenerating}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 text-base shadow-lg shadow-green-200"
                        size="lg"
                      >
                        <Printer className="w-5 h-5 mr-2" />
                        {settings.pageFormat === 'Thermal' ? `طباعة ${selectedProducts.length} بطاقة حرارية` : `طباعة ${getTotalPages()} صفحة`}
                      </Button>

                      {/* Secondary: Export */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" onClick={handleDownloadPdf} variant="outline" disabled={selectedProducts.length === 0 || isGenerating}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold">
                          <FileDown className="w-4 h-4 mr-1.5" />تصدير PDF
                        </Button>
                        <Button onClick={handleDownloadZIP} variant="outline" disabled={selectedProducts.length === 0 || isGenerating}
                          className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs font-semibold">
                          <Download className="w-4 h-4 mr-1.5" />تحميل ZIP
                        </Button>
                      </div>

                      {/* Tertiary: Word + Refresh */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" onClick={handleDownloadWord} variant="outline" disabled={selectedProducts.length === 0 || isGenerating}
                          className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">
                          <FileText className="w-4 h-4 mr-1.5" />Word
                        </Button>
                        <Button variant="outline" onClick={handleRefreshPreview} disabled={isGenerating}
                          className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">
                          <RefreshCw className={`w-4 h-4 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />تحديث
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:w-full max-w-[100vw]">
                  {/* Enhanced Right Panel: Preview */}

                  <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 sticky top-4">
                    <CardHeader className="bg-gradient-to-r from-cyan-50/50 to-primary/5 border-b border-slate-100 p-5">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xl font-bold text-slate-900">
                          <div className={`p-2 rounded-xl shadow-md bg-gradient-to-br ${settings.pageFormat === 'Thermal' ? 'from-emerald-500 to-green-600' : 'from-cyan-500 to-blue-600'}`}>
                            {settings.pageFormat === 'Thermal' ? <Printer className="w-6 h-6 text-white" /> : <Eye className="w-6 h-6 text-white" />}
                          </div>
                          معاينة الطباعة
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${settings.pageFormat === 'Thermal' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {settings.pageFormat === 'Thermal' ? `🖨 حراري ${settings.thermalWidthMm}mm` : settings.pageFormat}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {/* Pagination: only for non-thermal */}
                          {settings.pageFormat !== 'Thermal' && getTotalPages() > 1 && (
                            <div className="flex items-center gap-1 bg-white/80 rounded-lg p-1 shadow-sm border border-slate-200">
                              {getVisiblePages().map((page) => (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-8 h-8 p-0 font-bold transition-all ${currentPage === page ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-md border-0' : 'hover:bg-slate-100 text-slate-600'}`}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                          )}
                          <Button
                            onClick={handlePrintAll}
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className={`font-bold text-white text-sm ${settings.pageFormat === 'Thermal' ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'}`}
                            size="sm"
                          >
                            <Printer className="w-4 h-4 mr-1.5" />
                            {settings.pageFormat === 'Thermal' ? 'طباعة حرارية' : 'طباعة'}
                          </Button>
                        </div>
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium mt-2">
                        {settings.pageFormat === 'Thermal'
                          ? `لفافة ${settings.thermalWidthMm}mm · ${settings.thermalColumns} عمود × ${settings.thermalRowsPerCut} صف · ${selectedProducts.length} بطاقة · ${Math.ceil(selectedProducts.length / getThermalItemsPerCut())} قطعة`
                          : `${getActiveColumns()} عنصر/صف · ${getItemsPerPage()} عنصر/صفحة · إجمالي ${getTotalPages()} صفحة`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto p-0 m-6 pb-6 select-none bg-slate-100/50 rounded-xl border border-slate-200/60 shadow-inner block max-h-[calc(100vh-250px)] custom-scrollbar">
                      <div className="min-w-fit flex flex-col items-center justify-start p-4 md:p-8">
                        {selectedProducts.length > 0 ? (
                          <>
                            {/* ── THERMAL PREVIEW: full scroll roll strip with cut groups ── */}
                            {settings.pageFormat === 'Thermal' ? (() => {
                              const PREVIEW_SCALE = 2.8;
                              const cols = settings.thermalColumns;
                              const rowsPerCut = Math.max(1, settings.thermalRowsPerCut);
                              const itemsPerCut = cols * rowsPerCut;
                              const rollWpx = Math.round(settings.thermalWidthMm * PREVIEW_SCALE);
                              const labelHmm = getThermalLabelHeightMm();
                              const labelHpx = Math.round(labelHmm * PREVIEW_SCALE);
                              const qrPx = Math.round(getThermalQrSizeMm() * PREVIEW_SCALE);
                              const marginPx = Math.max(2, Math.round(settings.pageEdgeMarginMm * PREVIEW_SCALE));
                              const gapPx = Math.max(2, Math.round((settings.margin / MM_TO_PX) * PREVIEW_SCALE));
                              const fontSize = Math.max(7, Math.round(getThermalQrSizeMm() * 0.18 * PREVIEW_SCALE * 0.5));

                              // Build cut groups
                              const cutGroups: typeof selectedProducts[] = [];
                              for (let i = 0; i < selectedProducts.length; i += itemsPerCut) {
                                cutGroups.push(selectedProducts.slice(i, i + itemsPerCut));
                              }

                              return (
                                <div className="flex flex-col items-center gap-0">
                                  {/* Roll top cap */}
                                  <div style={{ width: rollWpx + 12, height: 10, background: 'linear-gradient(to bottom, #d6d0c5, #ebe6da)', border: '0.5px solid #bdb8ac', borderBottom: 'none', borderRadius: '6px 6px 0 0', flexShrink: 0 }} />

                                  {/* Scrollable roll body */}
                                  <div style={{ width: rollWpx + 12, maxHeight: 520, overflowY: 'auto', background: '#f7f4ee', borderLeft: '0.5px solid #bdb8ac', borderRight: '0.5px solid #bdb8ac', paddingTop: 6, paddingBottom: 6 }}
                                    className="custom-scrollbar"
                                  >
                                    {cutGroups.map((group, gi) => (
                                      <div key={`cut-${gi}`}>
                                        {/* Cut group header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px 3px', marginBottom: 2 }}>
                                          <div style={{ flex: 1, height: '1px', background: '#d1c9ba', borderTop: '1px dashed #b5ac9e' }} />
                                          <span style={{ fontSize: 9, color: '#9e9587', fontFamily: 'monospace', background: '#ede8df', borderRadius: 3, padding: '1px 5px', border: '0.5px solid #cdc5b8' }}>
                                            ✂ قطعة {gi + 1} • {group.length} بطاقة
                                          </span>
                                          <div style={{ flex: 1, height: '1px', background: '#d1c9ba', borderTop: '1px dashed #b5ac9e' }} />
                                        </div>

                                        {/* Rows within this cut group */}
                                        {Array.from({ length: rowsPerCut }).map((_, ri) => {
                                          const rowItems = group.slice(ri * cols, ri * cols + cols);
                                          if (rowItems.length === 0) return null;
                                          return (
                                            <div key={`row-${gi}-${ri}`} style={{ margin: `0 6px ${gapPx}px` }}>
                                              <div style={{
                                                width: rollWpx,
                                                minHeight: labelHpx,
                                                background: settings.backgroundColor,
                                                border: settings.addBorder ? `1px solid ${settings.borderColor}` : '0.5px solid #ddd',
                                                borderRadius: 3,
                                                padding: marginPx,
                                                display: 'grid',
                                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                                gap: gapPx,
                                                boxSizing: 'border-box',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                              }}>
                                                {rowItems.map((p, ci) => (
                                                  <div key={`cell-${gi}-${ri}-${ci}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', minWidth: 0 }}>
                                                    <QRCodeImage product={p} size={qrPx} imgStyle={{ imageRendering: 'crisp-edges', display: 'block' }} />
                                                    {settings.showProductCode && (
                                                      <div style={{ fontSize, fontWeight: 700, color: settings.foregroundColor, lineHeight: 1.2, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                                        {p.sku}
                                                      </div>
                                                    )}
                                                    {settings.showProductName && (
                                                      <div style={{ fontSize: Math.max(6, fontSize - 1), color: '#555', lineHeight: 1.15, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {p.nameAr}
                                                      </div>
                                                    )}
                                                    {settings.showPrice && (
                                                      <div style={{ fontSize, fontWeight: 700, color: '#1d4ed8', lineHeight: 1.2, textAlign: 'center' }}>
                                                        {p.price.toLocaleString()} ج.م
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                                {/* Fill empty cells in last row */}
                                                {rowItems.length < cols && Array.from({ length: cols - rowItems.length }).map((_, ei) => (
                                                  <div key={`empty-${ei}`} style={{ background: '#f8f7f5', borderRadius: 2, border: '0.5px dashed #ddd', minHeight: labelHpx - marginPx * 2 }} />
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Roll bottom cap */}
                                  <div style={{ width: rollWpx + 12, height: 10, background: 'linear-gradient(to top, #d6d0c5, #ebe6da)', borderTop: '2px dashed #a09b91', border: '0.5px solid #bdb8ac', borderRadius: '0 0 6px 6px', flexShrink: 0 }} />

                                  {/* Ruler */}
                                  <div className="text-[11px] text-slate-400 text-center mt-3 space-y-0.5">
                                    <div>← {settings.thermalWidthMm}mm → · بطاقة {Math.round(getThermalQrSizeMm())}×{labelHmm}mm · {cols}×{rowsPerCut} تخطيط</div>
                                    <div className="text-slate-300">{selectedProducts.length} بطاقة · {cutGroups.length} قطعة · {PREVIEW_SCALE}px/mm</div>
                                  </div>
                                </div>
                              );
                            })() : (
                            /* ── STANDARD A4/A5 PREVIEW ── */
                            <div className="relative w-full flex justify-center mb-6">
                              {getTotalPages() > 1 && (
                                <>
                                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 shadow" aria-label="الصفحة السابقة">
                                    <ChevronLeft className="w-5 h-5" />
                                  </Button>
                                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))} disabled={currentPage === getTotalPages()} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 shadow" aria-label="الصفحة التالية">
                                    <ChevronRight className="w-5 h-5" />
                                  </Button>
                                </>
                              )}
                              <div style={{ width: `${parseInt(getPageWidthPx()) * 0.55}px`, height: `${parseInt(getPageHeightPx()) * 0.55}px`, position: 'relative' }}>
                                <div
                                  className="overflow-hidden bg-white shadow-2xl transition-transform duration-300 ring-1 ring-slate-200 absolute top-0 left-0"
                                  style={{ width: getPageWidthPx(), height: getPageHeightPx(), backgroundColor: settings.backgroundColor, transformOrigin: 'top left', transform: 'scale(0.55)' }}
                                >
                                  <div className="p-0" style={{ display: 'grid', gridTemplateColumns: `repeat(${getActiveColumns()}, 1fr)`, gap: `${settings.margin}px`, alignContent: 'start', justifyItems: 'stretch', boxSizing: 'border-box', height: '100%', padding: `${getPageEdgePaddingPx()}px` }}>
                                    {selectedProducts
                                      .slice((currentPage - 1) * getItemsPerPage(), Math.min(currentPage * getItemsPerPage(), selectedProducts.length))
                                      .map((product, idx) => (
                                        <div key={`${product.id}-d-${idx}`} className="text-center w-full flex flex-col items-center" style={{ padding: '4px', border: settings.addBorder ? `3px solid ${settings.borderColor}` : 'none', boxShadow: settings.addBorder ? '0 1px 3px rgba(0,0,0,0.2)' : 'none', borderRadius: '2px', backgroundColor: '#ffffff', maxWidth: '100%', minWidth: 0 }}>
                                          <div className="flex justify-center mb-1 w-full">
                                            <QRCodeImage product={product} className="block" size={getPrintQrSizePx()} imgStyle={{ imageRendering: 'crisp-edges', mixBlendMode: 'multiply' }} />
                                          </div>
                                          {settings.showProductCode && (
                                            <div className="font-bold truncate w-full px-1" style={{ color: settings.foregroundColor, fontSize: `${getTextSizes().productCode}pt`, lineHeight: '1.2', marginBottom: '1px' }} title={product.sku}>
                                              {product.sku}
                                            </div>
                                          )}
                                          {settings.showProductName && (
                                            <div className="text-slate-600 leading-tight w-full px-1" style={{ fontSize: `${getTextSizes().productName}pt`, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1px' }} title={product.nameAr}>
                                              {product.nameAr}
                                            </div>
                                          )}
                                          {settings.showPrice && (
                                            <div className="text-blue-600 font-bold w-full" style={{ fontSize: `${getTextSizes().productPrice}pt`, lineHeight: '1.2', marginTop: '2px' }}>
                                              {product.price.toLocaleString()} ج.م
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-20 w-full flex flex-col items-center opacity-70">
                            <div className="w-24 h-24 mb-6 rounded-3xl bg-slate-200/50 flex items-center justify-center border-2 border-dashed border-slate-300">
                              <QrCode className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد منتجات محددة</h3>
                            <p className="text-slate-500 font-medium">يرجى اختيار المنتجات من لوحة الإعدادات لرؤية المعاينة الطِباعية</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminQRCodes;

