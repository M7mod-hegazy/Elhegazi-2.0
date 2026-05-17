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
import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';
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
  Plus,
  Pencil,
  Trash2,
  BookmarkPlus,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  pageFormat: 'A4' | 'A5' | 'A3' | 'Letter';
  /** Uniform margin from each physical page edge (print + preview), in mm. */
  pageEdgeMarginMm: number;
  /** Gap between QR cells on the sheet, in px. */
  margin: number;
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

function getJsPdfFormat(fmt: QRSettings['pageFormat']): 'a4' | 'a5' | 'a3' | 'letter' {
  switch (fmt) {
    case 'A5': return 'a5';
    case 'A3': return 'a3';
    case 'Letter': return 'letter';
    default: return 'a4';
  }
}

function getPageDimensionsMm(fmt: QRSettings['pageFormat']): { w: number; h: number } {
  switch (fmt) {
    case 'A4': return { w: 210, h: 297 };
    case 'A5': return { w: 148, h: 210 };
    case 'A3': return { w: 297, h: 420 };
    case 'Letter': return { w: 216, h: 279 };
    default: return { w: 210, h: 297 };
  }
}

/** Printable content box inside @page margins (matches preview inner area). */
function getInnerPageDimensionsMm(
  pageFormat: QRSettings['pageFormat'],
  pageEdgeMarginMm: number
): { w: number; h: number } {
  const { w, h } = getPageDimensionsMm(pageFormat);
  const innerW = Math.max(10, w - 2 * pageEdgeMarginMm);
  const innerH = Math.max(10, h - 2 * pageEdgeMarginMm);
  return { w: innerW, h: innerH };
}

// ── Presets ──────────────────────────────────────────────────────────────────
interface QRPreset {
  id: string;
  name: string;
  createdAt: string;
  settings: QRSettings;
  productIds: string[] | null;
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
    margin: 20
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

  // Presets state
  const [presets, setPresets] = useState<QRPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [saveName, setSaveName] = useState('');
  const [saveOverwriteId, setSaveOverwriteId] = useState<string>('');
  const [saveWithProducts, setSaveWithProducts] = useState(false);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Auto-adjust itemsPerRow when margins, page size, or QR size changes
  useEffect(() => {
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

  // ── Preset handlers ─────────────────────────────────────────────────────────
  const fetchPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const res = await apiGet<QRPreset>('/api/qr-presets');
      if (res.ok) setPresets(res.items ?? []);
    } catch {
      // ignore network errors silently
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPresets(); }, [fetchPresets]);

  const handleLoadPreset = (preset: QRPreset) => {
    setSettings(preset.settings);
    if (preset.productIds !== null) {
      const validIds = preset.productIds.filter(id => products.some(p => p.id === id));
      setSelectedProductIds(validIds);
    }
    setActivePresetId(preset.id);
    setShowPresetsModal(false);
    toast({ title: `تم تحميل: ${preset.name}` });
  };

  const handleOpenSaveDialog = () => {
    setSaveMode('new');
    setSaveName('');
    setSaveOverwriteId(activePresetId || (presets[0]?.id ?? ''));
    setSaveWithProducts(false);
    setShowSaveDialog(true);
  };

  const handleSavePreset = async () => {
    const name = saveMode === 'new'
      ? saveName.trim()
      : presets.find(p => p.id === saveOverwriteId)?.name ?? saveName.trim();
    if (!name) {
      toast({ title: 'أدخل اسماً للـ preset', variant: 'destructive' });
      return;
    }
    const payload = {
      name,
      settings: { ...settings },
      productIds: saveWithProducts ? [...selectedProductIds] : null,
    };
    try {
      if (saveMode === 'overwrite' && saveOverwriteId) {
        const res = await apiPutJson<QRPreset, typeof payload>(`/api/qr-presets/${saveOverwriteId}`, payload);
        if (res.ok && res.item) {
          setPresets(prev => prev.map(p => p.id === saveOverwriteId ? res.item! : p));
          setActivePresetId(saveOverwriteId);
        }
      } else {
        const res = await apiPostJson<QRPreset, typeof payload>('/api/qr-presets', payload);
        if (res.ok && res.item) {
          setPresets(prev => [res.item!, ...prev]);
          setActivePresetId(res.item!.id);
        }
      }
      setShowSaveDialog(false);
      toast({ title: `تم الحفظ: ${name}` });
    } catch {
      toast({ title: 'حدث خطأ أثناء الحفظ', variant: 'destructive' });
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذا الـ preset؟')) return;
    try {
      await apiDelete(`/api/qr-presets/${id}`);
      setPresets(prev => prev.filter(p => p.id !== id));
      if (activePresetId === id) setActivePresetId(null);
    } catch {
      toast({ title: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  };

  const handleStartRename = (preset: QRPreset) => {
    setRenamingPresetId(preset.id);
    setRenameValue(preset.name);
  };

  const handleFinishRename = async () => {
    if (!renamingPresetId) return;
    const name = renameValue.trim();
    if (name) {
      try {
        const res = await apiPutJson<QRPreset, { name: string }>(`/api/qr-presets/${renamingPresetId}`, { name });
        if (res.ok && res.item) {
          setPresets(prev => prev.map(p => p.id === renamingPresetId ? res.item! : p));
        }
      } catch {
        // ignore
      }
    }
    setRenamingPresetId(null);
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
    const { w } = getPageDimensionsMm(settings.pageFormat);
    const usableWidthMm = Math.max(20, w - 2 * settings.pageEdgeMarginMm);
    const qrSizeMm = (settings.size / 4) / 3.78;
    const marginEffectMm = settings.margin / 3.78;
    const effectiveItemWidth = qrSizeMm + marginEffectMm;
    const maxItems = Math.floor(usableWidthMm / effectiveItemWidth);
    return Math.max(1, Math.min(maxItems, 15));
  };

  const getPageWidthPx = () => {
    switch (settings.pageFormat) {
      case 'A4': return '794px';
      case 'A5': return '559px';
      case 'A3': return '1123px';
      case 'Letter': return '816px';
      default: return '794px';
    }
  };
  const getPageHeightPx = () => {
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
    const { w: pageWmm } = getPageDimensionsMm(settings.pageFormat);
    if (pageWmm <= 0) return 0;
    return (settings.pageEdgeMarginMm / pageWmm) * pageWPx;
  };

  const getPrintQrSizePx = () => Math.min(settings.size / 2.5, 80);

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

  /** Builds the same RTL HTML used for print, PDF export, and PDF rasterization. */
  const preparePrintSheetHtml = async (onProgress?: (pct: number) => void): Promise<string> => {
    const itemsPerPage = getItemsPerPage();
    const totalPages = getTotalPages();
    const totalProducts = selectedProducts.length;
    const qrImageList: string[] = [];

    for (let i = 0; i < totalProducts; i++) {
      const product = selectedProducts[i]!;
      try {
        qrImageList.push(await generateQRCodeWithLogo(product));
      } catch (error) {
        console.error(`Failed to generate QR for product ${product.sku}:`, error);
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
      onProgress?.(Math.round(((i + 1) / totalProducts) * 100));
    }

    const innerPageMm = getInnerPageDimensionsMm(settings.pageFormat, settings.pageEdgeMarginMm);

    let printContent = `
        <html dir="rtl">
          <head>
            <title>رموز QR للمنتجات</title>
            <style>
              @page {
                size: ${settings.pageFormat};
                margin: ${settings.pageEdgeMarginMm}mm;
              }
              body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 0;
                background: ${settings.backgroundColor};
                font-size: 12px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page {
                break-after: page;
                page-break-after: always;
                display: flex;
                flex-direction: column;
                width: ${innerPageMm.w}mm;
                height: ${innerPageMm.h}mm;
                padding: 0;
                box-sizing: border-box;
                overflow: hidden;
              }
              .page:last-child {
                break-after: auto;
                page-break-after: auto;
              }
              .header {
                text-align: center;
                margin-bottom: 2mm;
                border-bottom: 1px solid ${settings.borderColor || '#ddd'};
                padding-bottom: 1mm;
              }
              .header h2 {
                margin: 0;
                font-size: 10pt;
                color: #333;
                font-weight: normal;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(${settings.itemsPerRow}, minmax(0, 1fr));
                gap: ${settings.margin}px;
                flex: 1;
                align-content: start;
                justify-items: stretch;
                padding: 0px;
              }
              .qr-item {
                text-align: center;
                page-break-inside: avoid;
                background: white;
                padding: 4px;
                border-radius: 2px;
                ${settings.addBorder ? `border: 3px solid ${settings.borderColor || '#333'}; box-shadow: 0 1px 3px rgba(0,0,0,0.2);` : 'border: none;'}
                width: 100%;
                box-sizing: border-box;
              }
              .qr-code {
                width: ${getPrintQrSizePx()}px;
                height: ${getPrintQrSizePx()}px;
                margin: 0 auto 2px;
                display: block;
                border: none;
                image-rendering: -webkit-optimize-contrast;
                image-rendering: crisp-edges;
              }
              .product-code {
                font-weight: bold;
                font-size: ${Math.max(6, Math.round(7 * (settings.size / 200)))}pt;
                margin: 1px 0;
                color: ${settings.foregroundColor || '#333'};
                word-break: break-all;
                line-height: 1.1;
              }
              .product-name {
                font-size: ${Math.max(5, Math.round(6 * (settings.size / 200)))}pt;
                margin: 1px 0;
                color: #666;
                line-height: 1.1;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
              }
              .product-price {
                font-size: 8pt;
                color: #007bff;
                font-weight: bold;
                margin: 2px 0 0 0;
              }
              @media print {
                .qr-code {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
      `;

      // Generate pages
      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, selectedProducts.length);
        const pageProducts = selectedProducts.slice(startIndex, endIndex);

        printContent += `
          <div class="page">
            <div class="qr-grid">
              ${pageProducts.map((product, idx) => {
                const globalIndex = startIndex + idx;
                const src = qrImageList[globalIndex] || '';
                return `
                <div class="qr-item">
                  <img src="${src}" alt="QR ${product.sku}" class="qr-code" />
                  ${settings.showProductCode ? `<div class="product-code">${product.sku}</div>` : ''}
                  ${settings.showProductName ? `<div class="product-name">${product.nameAr}</div>` : ''}
                  ${settings.showPrice ? `<div class="product-price">${product.price.toLocaleString()} ج.م</div>` : ''}
                </div>
              `;
              }).join('')}
            </div>
          </div>
        `;
      }

    printContent += `
          </body>
        </html>
      `;

    return printContent;
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
    const itemsPerPage = getItemsPerPage();
    const totalPages = getTotalPages();

    setIsGenerating(true);
    setProgress(0);

    try {
      const printContent = await preparePrintSheetHtml((p) => setProgress(p));

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();
        requestAnimationFrame(() => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 500);
          }, 400);
        });
      }

      toast({
        title: "تم تحضير الطباعة",
        description: `${totalPages} صفحة جاهزة للطباعة • ${settings.itemsPerRow} عنصر/صف • ${itemsPerPage} عنصر/صفحة`,
      });
    } catch (error) {
      console.error('Print preparation failed:', error);
      toast({
        title: "خطأ في التحضير",
        description: "حدث خطأ أثناء تحضير الطباعة",
        variant: "destructive"
      });
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
      const html = await preparePrintSheetHtml((p) => setProgress(Math.round(p * 0.55)));
      const blob = await renderSheetPdfBlob(html, (p) => setProgress(55 + Math.round(p * 0.45)));
      const stamp = new Date().toISOString().split('T')[0];
      triggerFileDownload(blob, `qr-codes-${stamp}.pdf`);
      toast({ title: 'تم التحميل', description: 'تم حفظ ملف PDF' });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: 'خطأ في PDF',
        description: 'تعذر إنشاء ملف PDF',
        variant: 'destructive',
      });
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

            {/* Presets Bar — Mobile */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2 border-amber-200 bg-amber-50/60 text-amber-700 text-xs h-9"
                onClick={() => setShowPresetsModal(true)}
              >
                <Star className="w-3.5 h-3.5" />
                الإعدادات المحفوظة
                {presets.length > 0 && (
                  <span className="mr-auto bg-amber-200 text-amber-800 text-[10px] rounded-full px-1.5 font-bold">{presets.length}</span>
                )}
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                onClick={handleOpenSaveDialog}
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                حفظ
              </Button>
            </div>

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

                  {/* Presets Bar — Desktop */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-start gap-2 border-amber-200 bg-amber-50/60 hover:bg-amber-50 text-amber-700 hover:text-amber-800"
                      onClick={() => setShowPresetsModal(true)}
                    >
                      <Star className="w-4 h-4" />
                      الإعدادات المحفوظة
                      {presets.length > 0 && (
                        <span className="mr-auto bg-amber-200 text-amber-800 text-xs rounded-full px-1.5 py-0.5 font-bold">{presets.length}</span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleOpenSaveDialog}
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      حفظ
                    </Button>
                  </div>

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
                      <div className="space-y-2">
                        <Label>تنسيق الصفحة</Label>
                        <Select
                          value={settings.pageFormat}
                          onValueChange={(value: QRSettings['pageFormat']) => setSettings({ ...settings, pageFormat: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                            <SelectItem value="A5">A5 (148×210mm)</SelectItem>
                            <SelectItem value="A3">A3 (297×420mm)</SelectItem>
                            <SelectItem value="Letter">Letter (216×279mm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label>هامش حواف الصفحة: {settings.pageEdgeMarginMm}mm</Label>
                          <div className="text-xs text-slate-500 text-left">
                            يحدّ العرض والارتفاع المتاحين للرموز
                          </div>
                        </div>
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
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>0 — بدون هامش</span>
                          <span>30mm</span>
                        </div>
                      </div>

                      {/* QR Size Settings */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>حجم الرمز: {settings.size}px</Label>
                          <div className="text-xs text-slate-500">
                            يؤثر على العدد المسموح في الصف
                          </div>
                        </div>
                        <Slider
                          value={[settings.size]}
                          onValueChange={(value) => setSettings({ ...settings, size: value[0] })}
                          min={100}
                          max={500}
                          step={25}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>صغير (100px)</span>
                          <span>متوسط (300px)</span>
                          <span>كبير (500px)</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>العناصر في كل صف: {Math.min(settings.itemsPerRow, getMaxItemsPerRow())} (الحد الأقصى: {getMaxItemsPerRow()})</Label>
                          <div className="text-xs text-slate-500">
                            {getItemsPerPage()} عنصر/صفحة
                          </div>
                        </div>
                        <Slider
                          value={[Math.min(settings.itemsPerRow, getMaxItemsPerRow())]}
                          onValueChange={(value) => setSettings({ ...settings, itemsPerRow: value[0] })}
                          min={1}
                          max={getMaxItemsPerRow()}
                          step={1}
                          className="w-full"
                        />

                        {/* Compact Layout Preview */}
                        <div className="mt-2 p-2 bg-slate-50 rounded border">
                          <div className="text-xs text-slate-600 mb-1">معاينة:</div>
                          <div
                            className="grid gap-0.5"
                            style={{
                              gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`,
                              width: '120px',
                              height: '60px',
                              overflow: 'hidden'
                            }}
                          >
                            {Array.from({ length: Math.min(settings.itemsPerRow * 3, 12) }).map((_, i) => (
                              <div
                                key={i}
                                className="bg-primary/30 rounded-sm"
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  margin: '1px'
                                }}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {settings.itemsPerRow} عنصر/صف
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>المسافة بين الرموز: {settings.margin}px</Label>
                          <div className="text-xs text-slate-500">
                            داخل منطقة الطباعة
                          </div>
                        </div>
                        <Slider
                          value={[settings.margin]}
                          onValueChange={(value) => setSettings({ ...settings, margin: value[0] })}
                          min={0}
                          max={50}
                          step={5}
                          className="w-full"
                        />
                      </div>
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
                      <CardDescription>
                        إنشاء وتصدير رموز QR للمنتجات المحددة
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      {isGenerating && (
                        <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex justify-between text-sm font-medium">
                            <span className="text-primary">جاري المعالجة...</span>
                            <span className="text-primary">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-primary">
                            يتم إنشاء {selectedProducts.length} رمز QR
                          </p>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-900">{selectedProducts.length}</div>
                          <div className="text-sm text-slate-600">منتج محدد</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-900">{getTotalPages()}</div>
                          <div className="text-sm text-slate-600">صفحة للطباعة</div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        <Button
                          onClick={handleGenerateAll}
                          disabled={selectedProducts.length === 0 || isGenerating}
                          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary hover:to-purple-700 text-white font-medium py-3"
                          size="lg"
                        >
                          <QrCode className="w-5 h-5 mr-2" />
                          إنشاء جميع الرموز ({selectedProducts.length})
                        </Button>

                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={handlePrintAll}
                            variant="outline"
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            طباعة A4
                          </Button>

                          <Button
                            onClick={handleDownloadZIP}
                            variant="outline"
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            تحميل ZIP
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            type="button"
                            onClick={handleDownloadPdf}
                            variant="outline"
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className="border-slate-200 text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-all duration-200 shadow-sm"
                          >
                            <FileDown className="w-4 h-4 mr-2" />
                            تحميل PDF
                          </Button>
                          <Button
                            type="button"
                            onClick={handleDownloadWord}
                            variant="outline"
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className="border-slate-200 text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-all duration-200 shadow-sm"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            تحميل Word
                          </Button>
                        </div>

                        {/* Additional Actions */}
                        <div className="pt-4 border-t border-slate-200">
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={selectedProducts.length === 0 || isGenerating}
                              onClick={() => {
                                const urls = selectedProducts.map(p => generateQRCodeURL(p)).join('\n');
                                navigator.clipboard.writeText(urls);
                                toast({ title: "تم النسخ", description: "تم نسخ روابط الرموز" });
                              }}
                              className="border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all duration-200"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              نسخ الروابط
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={selectedProducts.length === 0 || isGenerating}
                                  className="border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all duration-200 w-full flex items-center justify-between gap-2"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Share2 className="w-4 h-4" />
                                    مشاركة
                                  </span>
                                  <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[12rem]">
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
                          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-md">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          معاينة الطباعة ({settings.pageFormat})
                        </div>
                        <div className="flex gap-2">
                          {getTotalPages() > 1 && (
                            <div className="flex items-center gap-1 bg-white/80 rounded-lg p-1 shadow-sm border border-slate-200">
                              {getVisiblePages().map((page) => (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-8 h-8 p-0 font-bold transition-all ${currentPage === page
                                    ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-md border-0'
                                    : 'hover:bg-slate-100 text-slate-600'
                                    }`}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshPreview}
                            disabled={isGenerating}
                            className="bg-white font-bold text-slate-700"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                            تحديث
                          </Button>
                          <Button
                            onClick={handlePrintAll}
                            disabled={selectedProducts.length === 0 || isGenerating}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
                            size="sm"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            طباعة الصفحات
                          </Button>
                        </div>
                      </CardTitle>
                      <CardDescription className="text-slate-600 font-medium mt-2">
                        معاينة مباشرة لصفحة الطباعة • {settings.itemsPerRow} عنصر/صف • {getItemsPerPage()} عنصر/صفحة • إجمالي {getTotalPages()} صفحة
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto p-0 m-6 pb-6 select-none bg-slate-100/50 rounded-xl border border-slate-200/60 shadow-inner block max-h-[calc(100vh-250px)] custom-scrollbar">
                      <div className="min-w-fit flex flex-col items-center justify-start p-4 md:p-8">
                        {selectedProducts.length > 0 ? (
                          <>
                            <div className="relative w-full flex justify-center mb-6">
                              {getTotalPages() > 1 && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 shadow"
                                    aria-label="الصفحة السابقة"
                                  >
                                    <ChevronLeft className="w-5 h-5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                                    disabled={currentPage === getTotalPages()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 shadow"
                                    aria-label="الصفحة التالية"
                                  >
                                    <ChevronRight className="w-5 h-5" />
                                  </Button>
                                </>
                              )}
                              <div
                                style={{
                                  width: `${parseInt(getPageWidthPx()) * 0.55}px`,
                                  height: `${parseInt(getPageHeightPx()) * 0.55}px`,
                                  position: 'relative'
                                }}
                              >
                                <div
                                  className="overflow-hidden bg-white shadow-2xl transition-transform duration-300 ring-1 ring-slate-200 absolute top-0 left-0"
                                  style={{
                                    width: getPageWidthPx(),
                                    height: getPageHeightPx(),
                                    backgroundColor: settings.backgroundColor,
                                    transformOrigin: 'top left',
                                    transform: 'scale(0.55)',
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
                                    {/* Render actual page products only (no placeholders) */}
                                    {selectedProducts
                                      .slice((currentPage - 1) * getItemsPerPage(), Math.min(currentPage * getItemsPerPage(), selectedProducts.length))
                                      .map((product, idx) => (
                                        <div
                                          key={`${product.id}-d-${idx}`}
                                          className="text-center w-full flex flex-col items-center"
                                          style={{
                                            padding: '4px',
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
                                              className="font-bold truncate w-full px-1"
                                              style={{
                                                color: settings.foregroundColor,
                                                fontSize: `${getTextSizes().productCode}pt`,
                                                lineHeight: '1.2',
                                                marginBottom: '1px'
                                              }}
                                              title={product.sku}
                                            >
                                              {product.sku}
                                            </div>
                                          )}
                                          {settings.showProductName && (
                                            <div
                                              className="text-slate-600 leading-tight w-full px-1"
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
                                              title={product.nameAr}
                                            >
                                              {product.nameAr}
                                            </div>
                                          )}
                                          {settings.showPrice && (
                                            <div
                                              className="text-blue-600 font-bold w-full"
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

                            {/* Print action moved to header for clearer flow */}
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

      {/* ── Presets Modal ─────────────────────────────────────────────── */}
      <Dialog open={showPresetsModal} onOpenChange={setShowPresetsModal}>
        <DialogContent className="max-w-lg w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-500" />
              الإعدادات المحفوظة
            </DialogTitle>
          </DialogHeader>

          {presets.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              لا توجد إعدادات محفوظة بعد — اضغط "حفظ" لإنشاء أول preset
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1">
              {presets.map(preset => {
                const isActive = preset.id === activePresetId;
                const cols = preset.settings.itemsPerRow ?? 3;
                const fg = preset.settings.foregroundColor || '#1e293b';
                const bg = preset.settings.backgroundColor || '#ffffff';
                const isRenaming = renamingPresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={`border rounded-xl p-3 flex gap-3 items-center transition-all ${isActive ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    {/* Layout preview thumbnail */}
                    <div
                      className="flex-shrink-0 rounded-md border overflow-hidden"
                      style={{ width: 56, height: 44, background: bg, borderColor: preset.settings.borderColor || '#e2e8f0', display: 'flex', alignItems: 'flex-start', padding: 3, gap: 2 }}
                    >
                      {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: fg,
                            borderRadius: 2,
                            opacity: 0.25 + (i % 2 === 0 ? 0.1 : 0),
                            border: preset.settings.addBorder ? `1px solid ${preset.settings.borderColor || '#e2e8f0'}` : 'none',
                          }}
                        />
                      ))}
                    </div>

                    {/* Name + summary */}
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={handleFinishRename}
                          onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setRenamingPresetId(null); }}
                          className="w-full text-sm font-semibold border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      ) : (
                        <div className="font-semibold text-sm text-slate-800 truncate flex items-center gap-1.5">
                          {preset.name}
                          {isActive && <span className="text-[10px] bg-blue-100 text-blue-600 rounded px-1.5 py-0.5 font-medium">محمّل</span>}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {preset.settings.pageFormat} · {cols} أعمدة
                        {preset.settings.includeLogo ? ' · مع شعار' : ''}
                        {preset.productIds !== null ? ` · ${preset.productIds.length} منتج` : ''}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isActive ? (
                        <span className="text-xs text-slate-400 px-2">محمّل ✓</span>
                      ) : (
                        <Button size="sm" className="h-7 text-xs px-3" onClick={() => handleLoadPreset(preset)}>
                          تحميل
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-800" onClick={() => handleStartRename(preset)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => void handleDeletePreset(preset.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t pt-3 mt-1 text-xs text-slate-400 text-center">
            لتعديل preset: حمّله → غيّر الإعدادات → اضغط "+ حفظ"
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save Preset Dialog ────────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-blue-500" />
              حفظ الإعدادات الحالية
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSaveMode('new')}
                className={`flex-1 text-sm py-2 rounded-lg border transition-all ${saveMode === 'new' ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                ⊕ preset جديد
              </button>
              <button
                onClick={() => { setSaveMode('overwrite'); if (!saveOverwriteId && presets.length > 0) setSaveOverwriteId(presets[0].id); }}
                disabled={presets.length === 0}
                className={`flex-1 text-sm py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${saveMode === 'overwrite' ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                ↩ الكتابة فوق موجود
              </button>
            </div>

            {/* Name or overwrite select */}
            {saveMode === 'new' ? (
              <div className="space-y-1">
                <label className="text-sm text-slate-600">اسم الـ preset</label>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                  placeholder="مثال: فاتورة A4 عادية"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm text-slate-600">اختر preset للكتابة فوقه</label>
                <select
                  value={saveOverwriteId}
                  onChange={e => setSaveOverwriteId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.id === activePresetId ? ' (محمّل حالياً)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Products toggle */}
            <div
              onClick={() => setSaveWithProducts(v => !v)}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors select-none"
            >
              <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center ${saveWithProducts ? 'bg-blue-500' : 'bg-slate-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${saveWithProducts ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-700">حفظ المنتجات المحددة</div>
                <div className="text-xs text-slate-400">{selectedProductIds.length} منتج محدد حالياً</div>
              </div>
            </div>

            <Button className="w-full" onClick={() => void handleSavePreset()}>
              <Check className="w-4 h-4 ml-2" />
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminQRCodes;

