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
import { apiGet } from '@/lib/api';

import { Product, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Document, Page, Text, View, StyleSheet, PDFViewer, Image as PDFImage } from '@react-pdf/renderer';
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
  Image
} from 'lucide-react';

// PDF Styles for react-pdf
const pdfStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  header: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  qrItem: {
    marginBottom: 15,
    alignItems: 'center',
    textAlign: 'center',
  },
  qrCode: {
    width: 80,
    height: 80,
    marginBottom: 5,
  },
  productCode: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  productName: {
    fontSize: 6,
    color: '#666666',
  },
});

// PDF Document Component
const QRCodesPDFDocument = ({ products, settings }: { products: Product[]; settings: QRSettings }) => {
  // Generate QR codes as base64 for PDF
  const generateQRForPDF = async (product: Product) => {
    try {
      const qrData = `${window.location.origin}/product/${product.id}`;
      return await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>رموز QR للمنتجات</Text>
        <View style={pdfStyles.grid}>
          {products.map((product, index) => (
            <View key={product.id} style={[
              pdfStyles.qrItem,
              { width: `${100 / settings.itemsPerRow}%` }
            ]}>
              {/* QR Code placeholder - will be enhanced */}
              <View style={{ width: 80, height: 80, backgroundColor: '#f0f0f0', marginBottom: 5 }} />
              {settings.showProductCode && (
                <Text style={pdfStyles.productCode}>{product.sku}</Text>
              )}
              {settings.showProductName && (
                <Text style={pdfStyles.productName}>{product.nameAr}</Text>
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};

interface QRSettings {
  productSelection: 'all' | 'category';
  selectedCategory: string;
  // When selecting by category, optionally enable SKU range within that category
  categoryRangeEnabled: boolean;
  fromCode: string;
  toCode: string;
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
  pageFormat: 'A4' | 'A3' | 'Letter';
  margin: number;
}

const AdminQRCodes = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<QRSettings>({
    productSelection: 'all',
    selectedCategory: '',
    categoryRangeEnabled: false,
    fromCode: '',
    toCode: '',
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
    margin: 20
  });
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState<'grid' | 'a4'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [qrCache, setQrCache] = useState<{ [key: string]: string }>({});

  // Auto-adjust itemsPerRow when margin or QR size changes
  useEffect(() => {
    // Calculate max items inline to avoid dependency issues
    const availableWidth = 200; // mm (approximate usable width)
    const qrSizeMm = (settings.size / 4) / 3.78; // Reduced effect
    const marginEffectMm = settings.margin / 3.78; // Convert px to mm
    const effectiveItemWidth = qrSizeMm + marginEffectMm;
    const maxAllowed = Math.max(1, Math.min(Math.floor(availableWidth / effectiveItemWidth), 15));

    if (settings.itemsPerRow > maxAllowed) {
      setSettings(prev => ({
        ...prev,
        itemsPerRow: maxAllowed
      }));
    }
  }, [settings.margin, settings.size, settings.itemsPerRow]);

  // Load data from API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          apiGet<Product>('/api/products'),
          apiGet<Category>('/api/categories'),
        ]);
        if (!mounted) return;
        if (prodRes.ok) setProducts(prodRes.items || []);
        if (catRes.ok) setCategories(catRes.items || []);
      } catch (e) {
        // optionally show a toast
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Update selected products based on settings
  useEffect(() => {
    let filtered: Product[] = [];

    switch (settings.productSelection) {
      case 'all':
        filtered = products;
        break;
      case 'category':
        filtered = products.filter(p => p.category === settings.selectedCategory);
        if (settings.categoryRangeEnabled && settings.fromCode && settings.toCode) {
          filtered = filtered.filter(p => p.sku >= settings.fromCode && p.sku <= settings.toCode);
        }
        break;
    }

    setSelectedProducts(filtered);
  }, [products, settings]);

  // Reset to first page when layout settings change
  useEffect(() => {
    setCurrentPage(1);
  }, [settings.itemsPerRow, settings.margin, settings.size, settings.pageFormat]);

  // Clear QR cache when settings change to force regeneration
  useEffect(() => {
    setQrCache({});
  }, [settings.size, settings.foregroundColor, settings.backgroundColor, settings.includeLogo, logoPreview]);

  // QR Code Image Component with logo support
  const QRCodeImage = ({ product, size, className, fitContainer, imgStyle }: { product: Product; size?: number; className?: string; fitContainer?: boolean; imgStyle?: React.CSSProperties }) => {
    const [qrSrc, setQrSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const generateQR = async () => {
        setIsLoading(true);
        try {
          const dataURL = await generateQRCodeWithLogo(product, size);
          setQrSrc(dataURL);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
          // Fallback to simple QR
          setQrSrc(generateQRCodeURL(product, size));
        } finally {
          setIsLoading(false);
        }
      };

      generateQR();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product.id, size]);

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

  // Generate QR code with logo overlay using canvas
  const generateQRCodeWithLogo = useCallback(async (product: Product, customSize?: number): Promise<string> => {
    const productURL = `${window.location.origin}/product/${product.id}`;
    const size = customSize || settings.size;
    const cacheKey = `${product.id}-${size}-${settings.includeLogo}-${logoPreview ? 'logo' : 'nologo'}`;

    // Check cache first
    if (qrCache[cacheKey]) {
      return qrCache[cacheKey];
    }

    try {
      // Generate base QR code
      const qrDataURL = await QRCode.toDataURL(productURL, {
        width: size,
        margin: 1,
        color: {
          dark: settings.foregroundColor,
          light: settings.backgroundColor
        },
        errorCorrectionLevel: 'M'
      });

      // If no logo or logo not enabled, return base QR
      if (!settings.includeLogo || !logoPreview) {
        setQrCache(prev => ({ ...prev, [cacheKey]: qrDataURL }));
        return qrDataURL;
      }

      // Create canvas for logo overlay
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = size;
      canvas.height = size;

      // Load QR code image
      const qrImage = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error('Failed to load QR image'));
        qrImage.src = qrDataURL;
      });

      // Draw QR code
      ctx.drawImage(qrImage, 0, 0, size, size);

      // Load and draw logo
      const logoImage = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        logoImage.onload = () => resolve();
        logoImage.onerror = () => reject(new Error('Failed to load logo image'));
        logoImage.src = logoPreview;
      });

      // Calculate logo size (20% of QR code size)
      const logoSize = size * 0.2;
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;

      // Draw white background circle for logo
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, 2 * Math.PI);
      ctx.fill();

      // Draw logo
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

      const finalDataURL = canvas.toDataURL('image/png');
      setQrCache(prev => ({ ...prev, [cacheKey]: finalDataURL }));
      return finalDataURL;

    } catch (error) {
      console.error('Error generating QR code with logo:', error);
      // Fallback to simple QR code
      const fallbackQR = await QRCode.toDataURL(productURL, {
        width: size,
        margin: 1,
        color: {
          dark: settings.foregroundColor,
          light: settings.backgroundColor
        }
      });
      setQrCache(prev => ({ ...prev, [cacheKey]: fallbackQR }));
      return fallbackQR;
    }
  }, [settings, logoPreview, qrCache]);

  // Legacy function for compatibility - now uses the new logo-enabled function
  const generateQRCodeURL = (product: Product, customSize?: number) => {
    // For immediate use, return a placeholder and generate async
    const cacheKey = `${product.id}-${customSize || settings.size}-${settings.includeLogo}-${logoPreview ? 'logo' : 'nologo'}`;

    if (qrCache[cacheKey]) {
      return qrCache[cacheKey];
    }

    // Generate async and update cache
    generateQRCodeWithLogo(product, customSize).then(dataURL => {
      setQrCache(prev => ({ ...prev, [cacheKey]: dataURL }));
    });

    // Return fallback URL while generating
    const productURL = `${window.location.origin}/product/${product.id}`;
    const size = customSize || settings.size;
    const params = new URLSearchParams({
      size: `${size}x${size}`,
      data: productURL,
      bgcolor: settings.backgroundColor.replace('#', ''),
      color: settings.foregroundColor.replace('#', ''),
      qzone: '1',
      format: 'png'
    });

    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
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

  // Calculate maximum items per row based on margin and QR size
  const getMaxItemsPerRow = () => {
    // Base calculation: reduce QR size effect to allow more items per line
    const availableWidth = 200; // mm (approximate usable width)

    // Reduce QR size effect by using smaller factor
    const qrSizeMm = (settings.size / 4) / 3.78; // Reduced from /2.5 to /4
    const marginEffectMm = settings.margin / 3.78; // Convert px to mm

    const effectiveItemWidth = qrSizeMm + marginEffectMm;
    const maxItems = Math.floor(availableWidth / effectiveItemWidth);

    return Math.max(1, Math.min(maxItems, 15)); // Increased max from 12 to 15
  };

  // Calculate items per page for A4 layout - integrated with layout settings
  const getItemsPerPage = () => {
    // Use the user-defined itemsPerRow from layout settings
    const itemsPerRow = settings.itemsPerRow;

    // Calculate based on A4 page dimensions
    const pageHeight = settings.pageFormat === 'A4' ? 297 : settings.pageFormat === 'A3' ? 420 : 279; // mm

    // QR code size in pixels (use actual print size)
    const actualQrSize = Math.min(settings.size / 2.5, 80); // Same as used in print

    // Calculate text height in pixels (very compact sizes to match print)
    const textHeight = (settings.showProductCode ? 8 : 0) +
                      (settings.showProductName ? 8 : 0) +
                      (settings.showPrice ? 8 : 0);

    // Total item height including minimal margins (matching print layout)
    const itemHeight = actualQrSize + textHeight + (Math.max(settings.margin / 6, 6));

    // Account for new compact margins: 8mm page + 3mm padding + 3mm header = 14mm total
    const usableHeight = (pageHeight * 3.78) - (14 * 3.78);

    // Calculate how many rows fit on a page
    const rowsPerPage = Math.max(1, Math.floor(usableHeight / itemHeight));

    // Total items per page = user-defined items per row × calculated rows per page
    const totalItemsPerPage = itemsPerRow * rowsPerPage;

    return Math.max(1, totalItemsPerPage);
  };

  // Get paginated products for A4 preview
  const getPaginatedProducts = () => {
    const itemsPerPage = getItemsPerPage();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return selectedProducts.slice(startIndex, endIndex);
  };

  // Get total pages
  const getTotalPages = () => {
    if (selectedProducts.length === 0) return 1;
    const itemsPerPage = getItemsPerPage();
    return Math.ceil(selectedProducts.length / itemsPerPage);
  };

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

  // Handle print all with enhanced A4 layout - Fixed QR Loading
  const handlePrintAll = async () => {
    const itemsPerPage = getItemsPerPage();
    const totalPages = getTotalPages();

    setIsGenerating(true);
    setProgress(0);

    try {
      // Pre-load all QR code images as base64 to ensure they print correctly
      const qrImages: { [key: string]: string } = {};
      const totalProducts = selectedProducts.length;

      for (let i = 0; i < totalProducts; i++) {
        const product = selectedProducts[i];

        try {
          // Generate QR with logo using the new function
          const qrDataURL = await generateQRCodeWithLogo(product);
          qrImages[product.id] = qrDataURL;
          setProgress(Math.round(((i + 1) / totalProducts) * 100));
        } catch (error) {
          console.error(`Failed to generate QR for product ${product.sku}:`, error);
          // Fallback to simple QR
          const fallbackUrl = generateQRCodeURL(product);
          qrImages[product.id] = fallbackUrl;
        }
      }

      let printContent = `
        <html dir="rtl">
          <head>
            <title>رموز QR للمنتجات</title>
            <style>
              @page {
                size: ${settings.pageFormat};
                /* Use minimal margins to utilize full width */
                margin: 0mm;
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
                /* Remove extra inner padding to reclaim width */
                padding: 0mm;
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
                gap: ${Math.max(settings.margin / 4, 4)}px;
                flex: 1;
                align-content: start;
                justify-items: stretch;
                padding: 0px;
              }
              .qr-item {
                text-align: center;
                page-break-inside: avoid;
                background: white;
                padding: ${Math.max(settings.margin / 16, 2)}px;
                border-radius: 2px;
                ${settings.addBorder ? `border: 3px solid ${settings.borderColor || '#333'}; box-shadow: 0 1px 3px rgba(0,0,0,0.2);` : 'border: none;'}
                width: 100%;
                box-sizing: border-box;
              }
              .qr-code {
                width: 100%;
                height: auto;
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
              ${pageProducts.map(product => `
                <div class="qr-item">
                  <img src="${qrImages[product.id]}" alt="QR ${product.sku}" class="qr-code" crossorigin="anonymous">
                  ${settings.showProductCode ? `<div class="product-code">${product.sku}</div>` : ''}
                  ${settings.showProductName ? `<div class="product-name">${product.nameAr}</div>` : ''}
                  ${settings.showPrice ? `<div class="product-price">${product.price.toLocaleString()} ج.م</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      printContent += `
          </body>
        </html>
      `;

      // Print using a hidden iframe in the same tab (no new window)
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

        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            // Clean up after a short delay
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 500);
          }, 600);
        };
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
        productUrl: `${window.location.origin}/product/${product.id}`,
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
                  <div class="url">${window.location.origin}/product/${product.id}</div>
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

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: "تم رفع الشعار",
        description: "تم رفع الشعار بنجاح",
      });
    }
  };

  // Remove logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setSettings({...settings, includeLogo: false});

    toast({
      title: "تم حذف الشعار",
      description: "تم حذف الشعار من الإعدادات",
    });
  };

  // Handle preview link for individual product
  const handlePreviewLink = (product: Product) => {
    const qrUrl = generateQRCodeURL(product);
    const productUrl = `${window.location.origin}/product/${product.id}`;

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

          {/* Mobile Preview Mode Toggle */}
          <div className="mx-3 mb-6 flex items-center justify-between">
            <div className="flex bg-gradient-to-r from-slate-100 to-slate-200/50 rounded-xl p-1 shadow-md">
              <Button
                variant={previewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('grid')}
                className={`transition-all duration-300 text-xs px-3 py-2 ${previewMode === 'grid'
                  ? 'bg-white shadow-lg text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Grid3X3 className="w-3 h-3 mr-1" />
                شبكية
              </Button>
              <Button
                variant={previewMode === 'a4' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('a4')}
                className={`transition-all duration-300 text-xs px-3 py-2 ${previewMode === 'a4'
                  ? 'bg-white shadow-lg text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <FileText className="w-3 h-3 mr-1" />
                A4
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPreview}
              disabled={isGenerating}
              className="border-primary/20 text-primary hover:bg-primary/5 disabled:opacity-50 shadow-md px-3 py-2"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="text-xs">تحديث</span>
            </Button>
          </div>

          {/* Mobile Card Layout */}
          <div className="mx-3 space-y-4 pb-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Mobile Product Selection Card */}
            <Card className="bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-slate-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-lg shadow-md">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  اختيار المنتجات
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium text-sm">
                  حدد المنتجات المراد إنشاء رموز QR لها
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <RadioGroup 
                  value={settings.productSelection} 
                  onValueChange={(value: QRSettings['productSelection']) => setSettings({...settings, productSelection: value})}
                  className="space-y-3"
                >
                  {/* Mobile All products option */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${settings.productSelection === 'all' ? 'bg-primary/5 border-primary/30' : 'hover:bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="all" id="all-mobile" />
                      <Label htmlFor="all-mobile" className="cursor-pointer font-medium">جميع المنتجات</Label>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border font-bold">{products.length}</span>
                  </div>

                  {/* Mobile Category option */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${settings.productSelection === 'category' ? 'bg-primary/5 border-primary/30' : 'hover:bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="category" id="category-mobile" />
                      <Label htmlFor="category-mobile" className="cursor-pointer font-medium">فئة محددة</Label>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border font-bold">{categories.length}</span>
                  </div>
                </RadioGroup>

                {settings.productSelection === 'category' && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-3 bg-white shadow-sm">
                    <Select 
                      value={settings.selectedCategory} 
                      onValueChange={(value) => setSettings({...settings, selectedCategory: value})}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="اختر الفئة" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name} className="text-right">
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{cat.nameAr}</span>
                              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                                {products.filter(p => p.category === cat.name).length}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

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
                    onValueChange={(value) => setSettings({...settings, size: value[0]})}
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
                        onChange={(e) => setSettings({...settings, foregroundColor: e.target.value})}
                        className="w-8 h-8 rounded border"
                      />
                      <Input
                        value={settings.foregroundColor}
                        onChange={(e) => setSettings({...settings, foregroundColor: e.target.value})}
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
                        onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
                        className="w-8 h-8 rounded border"
                      />
                      <Input
                        value={settings.backgroundColor}
                        onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
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
                        onCheckedChange={(checked) => setSettings({...settings, showProductCode: checked})}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إظهار اسم المنتج</Label>
                      <Switch
                        checked={settings.showProductName}
                        onCheckedChange={(checked) => setSettings({...settings, showProductName: checked})}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إظهار السعر</Label>
                      <Switch
                        checked={settings.showPrice}
                        onCheckedChange={(checked) => setSettings({...settings, showPrice: checked})}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">إضافة إطار</Label>
                      <Switch
                        checked={settings.addBorder}
                        onCheckedChange={(checked) => setSettings({...settings, addBorder: checked})}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Preview Card */}
            <Card className="bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-b border-slate-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  معاينة {previewMode === 'a4' ? 'A4' : 'شبكية'}
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium text-sm">
                  {previewMode === 'a4' ? 'معاينة كاملة بتخطيط A4' : 'عرض نموذج من رموز QR'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {selectedProducts.length > 0 ? (
                  previewMode === 'a4' ? (
                    /* Mobile A4 Preview */
                    <div className="space-y-4">
                      {/* Mobile A4 Pagination Controls */}
                      {getTotalPages() > 1 && (
                        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="text-xs px-2 py-1"
                          >
                            <ChevronLeft className="w-3 h-3 mr-1" />
                            السابق
                          </Button>
                          <span className="text-xs text-slate-600">
                            صفحة {currentPage} من {getTotalPages()}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                            disabled={currentPage === getTotalPages()}
                            className="text-xs px-2 py-1"
                          >
                            التالي
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Mobile A4 Preview Grid */}
                      <div 
                        className="grid gap-1 p-2 bg-white border rounded-lg"
                        style={{
                          gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`,
                          backgroundColor: settings.backgroundColor
                        }}
                      >
                        {getPaginatedProducts().map((product) => (
                          <div
                            key={product.id}
                            className="text-center p-1"
                            style={{
                              border: settings.addBorder ? `1px solid ${settings.borderColor}` : 'none'
                            }}
                          >
                            <QRCodeImage
                              product={product}
                              size={40}
                              className="mx-auto mb-1"
                            />
                            {settings.showProductCode && (
                              <div className="text-[8px] font-bold truncate" style={{ color: settings.foregroundColor }}>
                                {product.sku}
                              </div>
                            )}
                            {settings.showProductName && (
                              <div className="text-[7px] text-slate-600 line-clamp-1">
                                {product.nameAr}
                              </div>
                            )}
                            {settings.showPrice && (
                              <div className="text-[7px] text-primary font-medium">
                                {product.price.toLocaleString()} ج.م
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="text-xs text-slate-500 text-center">
                        {getItemsPerPage()} عنصر/صفحة • {settings.itemsPerRow} عنصر/صف
                      </div>
                    </div>
                  ) : (
                    /* Mobile Grid Preview */
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProducts.slice(0, 4).map((product) => (
                        <div
                          key={product.id}
                          className="bg-white p-2 rounded-lg border shadow-sm text-center"
                          style={{
                            border: settings.addBorder ? `2px solid ${settings.borderColor}` : '1px solid #e2e8f0'
                          }}
                        >
                          <QRCodeImage
                            product={product}
                            size={80}
                            className="mx-auto mb-1"
                          />
                          {settings.showProductCode && (
                            <div className="text-xs font-bold truncate" style={{ color: settings.foregroundColor }}>
                              {product.sku}
                            </div>
                          )}
                          {settings.showProductName && (
                            <div className="text-xs text-slate-600 line-clamp-1">
                              {product.nameAr}
                            </div>
                          )}
                          {settings.showPrice && (
                            <div className="text-xs text-primary font-medium">
                              {product.price.toLocaleString()} ج.م
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد منتجات محددة</p>
                  </div>
                )
                } 
                
                {selectedProducts.length > 4 && previewMode !== 'a4' && (
                  <p className="text-xs text-slate-500 text-center mt-2">
                    و {selectedProducts.length - 4} منتج آخر
                  </p>
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
                  <CardContent className="space-y-6">
                    {/* Color Settings */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">لون الرمز</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.foregroundColor}
                            onChange={(e) => setSettings({...settings, foregroundColor: e.target.value})}
                            className="w-8 h-8 rounded border"
                          />
                          <Input
                            value={settings.foregroundColor}
                            onChange={(e) => setSettings({...settings, foregroundColor: e.target.value})}
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
                          onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
                          className="w-8 h-8 rounded border"
                        />
                        <Input
                          value={settings.backgroundColor}
                          onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
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
                      onCheckedChange={(checked) => setSettings({...settings, addBorder: checked})}
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
                          onChange={(e) => setSettings({...settings, borderColor: e.target.value})}
                          className="w-8 h-8 rounded border"
                        />
                        <Input
                          value={settings.borderColor}
                          onChange={(e) => setSettings({...settings, borderColor: e.target.value})}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                    </div>

                    {/* Logo Settings */}
                    <div className="space-y-4 p-4 rounded-lg border bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium text-slate-900">إضافة الشعار</Label>
                      <p className="text-sm text-slate-500">تضمين شعار الشركة في الرمز</p>
                    </div>
                    <Switch
                      checked={settings.includeLogo}
                      onCheckedChange={(checked) => setSettings({...settings, includeLogo: checked})}
                      className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-400 scale-125 shadow-lg data-[state=checked]:shadow-indigo-300 transition-all duration-300 disabled:opacity-50 disabled:scale-100"
                      disabled={!logoPreview}
                    />
                  </div>

                  {/* Logo Upload Section */}
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
                            <span className="font-medium text-primary hover:text-primary">
                              اختر ملف الشعار
                            </span>
                            <p className="text-xs text-slate-500 mt-1">
                              PNG, JPG, GIF حتى 2MB
                            </p>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                        <div className="flex-shrink-0">
                          <img
                            src={logoPreview}
                            alt="Logo Preview"
                            className="w-12 h-12 object-contain rounded border"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {logoFile?.name}
                          </p>
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

                    {logoPreview && (
                      <div className="text-xs text-slate-500 bg-primary/5 p-2 rounded">
                        <Image className="w-3 h-3 inline mr-1" />
                        سيتم عرض الشعار في وسط رمز QR عند تفعيل الخيار أعلاه
                      </div>
                    )}
                  </div>
                    </div>
              </CardContent>
            </Card>

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
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>تنسيق الصفحة</Label>
                  <Select
                    value={settings.pageFormat}
                    onValueChange={(value: QRSettings['pageFormat']) => setSettings({...settings, pageFormat: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                      <SelectItem value="A3">A3 (297×420mm)</SelectItem>
                      <SelectItem value="Letter">Letter (216×279mm)</SelectItem>
                    </SelectContent>
                  </Select>
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
                    onValueChange={(value) => setSettings({...settings, size: value[0]})}
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
                    onValueChange={(value) => setSettings({...settings, itemsPerRow: value[0]})}
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
                    <Label>الهامش: {settings.margin}px</Label>
                    <div className="text-xs text-slate-500">
                      المسافة بين العناصر
                    </div>
                  </div>
                  <Slider
                    value={[settings.margin]}
                    onValueChange={(value) => setSettings({...settings, margin: value[0]})}
                    min={10}
                    max={50}
                    step={5}
                    className="w-full"
                  />
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
                      disabled={selectedProducts.length === 0}
                      className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      طباعة A4
                    </Button>

                    <Button
                      onClick={handleDownloadZIP}
                      variant="outline"
                      disabled={selectedProducts.length === 0}
                      className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      تحميل ZIP
                    </Button>
                  </div>

                  {/* Additional Actions */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={selectedProducts.length === 0}
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

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={selectedProducts.length === 0}
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: 'رموز QR للمنتجات',
                              text: `${selectedProducts.length} رمز QR للمنتجات`
                            });
                          }
                        }}
                        className="border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all duration-200"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        مشاركة
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
                </div>

                {/* Right Column: Preview */}
                <div>
          {/* Enhanced Right Panel: Preview */}
          <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-cyan-50/50 to-primary/5 border-b border-slate-100">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xl font-bold text-slate-900">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-md">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  {previewMode === 'a4' ? 'معاينة A4 مباشرة' : 'معاينة شبكية'}
                </div>
                <div className="flex gap-2">
                  {previewMode === 'a4' && getTotalPages() > 1 && (
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="disabled:opacity-50 hover:bg-white hover:shadow-sm transition-all"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        السابق
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 p-0 transition-all ${
                              currentPage === page
                                ? 'bg-white shadow-sm'
                                : 'hover:bg-white/50'
                            }`}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                        disabled={currentPage === getTotalPages()}
                        className="disabled:opacity-50 hover:bg-white hover:shadow-sm transition-all"
                      >
                        التالي
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPreview}
                    disabled={isGenerating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                    تحديث
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {previewMode === 'a4'
                  ? `معاينة مباشرة لصفحة ${settings.pageFormat} • ${settings.itemsPerRow} عنصر/صف • ${getItemsPerPage()} عنصر/صفحة • ${getTotalPages()} صفحة إجمالي`
                  : 'معاينة شبكية لرموز QR مع الإعدادات الحالية'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewMode === 'a4' ? (
                /* Enhanced A4 Preview with Proper Layout */
                <div className="relative w-full">
                  <div
                    className="mx-auto overflow-hidden"
                    style={{
                      width: '100%',
                      maxWidth: '794px', // A4 width in pixels at 96 DPI
                      minHeight: 'auto', // Remove fixed height
                      backgroundColor: settings.backgroundColor
                    }}
                  >
                    {/* No header to match real print layout */}

                    {/* Full Page Grid Layout (mirrors print) */}
                    <div
                      className="p-0"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`,
                        gap: `${Math.max(settings.margin / 4, 4)}px`,
                        alignContent: 'start',
                        justifyItems: 'stretch',
                        boxSizing: 'border-box',
                        height: '1123px' // A4 height at ~96 DPI for true preview
                      }}
                    >
                      {/* Render actual page products only (no placeholders) */}
                      {selectedProducts
                        .slice((currentPage - 1) * getItemsPerPage(), Math.min(currentPage * getItemsPerPage(), selectedProducts.length))
                        .map((product) => (
                          <div
                            key={product.id}
                            className="text-center w-full flex flex-col items-center"
                            style={{
                              padding: `${Math.max(settings.margin / 16, 2)}px`,
                              border: settings.addBorder ? `3px solid ${settings.borderColor}` : 'none',
                              boxShadow: settings.addBorder ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                              borderRadius: '2px',
                              backgroundColor: '#ffffff',
                              maxWidth: '100%',
                              minWidth: 0
                            }}
                          >
                            <div className="flex justify-center mb-1 w-full">
                              <QRCodeImage
                                product={product}
                                className="block rounded w-full h-auto"
                                fitContainer
                                imgStyle={{ imageRendering: 'crisp-edges' }}
                              />
                            </div>
                            {settings.showProductCode && (
                              <div
                                className="text-xs font-bold truncate"
                                style={{
                                  color: settings.foregroundColor,
                                  fontSize: `${getTextSizes().productCode}px`,
                                  lineHeight: '1.1',
                                  marginBottom: '2px'
                                }}
                                title={product.sku}
                              >
                                {product.sku}
                              </div>
                            )}
                            {settings.showProductName && (
                              <div
                                className="text-xs text-slate-600 leading-tight"
                                style={{
                                  fontSize: `${getTextSizes().productName}px`,
                                  lineHeight: '1.1',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  marginBottom: '2px'
                                }}
                                title={product.nameAr}
                              >
                                {product.nameAr}
                              </div>
                            )}
                            {settings.showPrice && (
                              <div
                                className="text-xs text-blue-600 font-medium"
                                style={{
                                  fontSize: `${getTextSizes().productPrice}px`,
                                  lineHeight: '1.1'
                                }}
                              >
                                {product.price.toLocaleString()} ج.م
                              </div>
                            )}
                          </div>
                        ))}
                    </div>


                  </div>

                  {/* A4 Preview Controls */}
                  <div className="mt-6 flex justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const element = document.querySelector('.mx-auto.bg-white.shadow-lg') as HTMLElement;
                        if (element) {
                          element.style.transform = element.style.transform === 'scale(0.8)' ? 'scale(1)' : 'scale(0.8)';
                        }
                      }}
                      className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Maximize2 className="w-4 h-4 mr-2" />
                      تكبير/تصغير
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrintAll}
                      disabled={selectedProducts.length === 0}
                      className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      طباعة هذه الصفحة
                    </Button>
                  </div>
                </div>
              ) : (
                /* Grid Preview */
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {selectedProducts.slice(0, 12).map((product) => (
                    <div
                      key={product.id}
                      className="text-center space-y-2 p-3 border rounded-lg hover:shadow-md transition-shadow"
                      style={{
                        backgroundColor: settings.backgroundColor,
                        borderColor: settings.addBorder ? settings.borderColor : 'transparent',
                        borderWidth: settings.addBorder ? '3px' : '0px',
                        boxShadow: settings.addBorder ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                      }}
                    >
                      <div className="mx-auto" style={{ width: 'fit-content' }}>
                        <QRCodeImage
                          product={product}
                          size={Math.min(settings.size, 100)}
                          className="mx-auto rounded"
                        />
                      </div>

                      {settings.showProductCode && (
                        <p className="text-xs font-bold" style={{ color: settings.foregroundColor }}>
                          {product.sku}
                        </p>
                      )}

                      {settings.showProductName && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-tight">
                          {product.nameAr}
                        </p>
                      )}

                      {settings.showPrice && (
                        <p className="text-xs text-blue-600 font-medium">
                          {product.price.toLocaleString()} ج.م
                        </p>
                      )}

                      <div className="flex gap-1 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewLink(product)}
                          className="flex-1 text-xs border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadSingle(product)}
                          className="flex-1 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-all duration-200"
                        >
                          <Download className="w-3 h-3 mr-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedProducts.length > 12 && (
                  <div className="text-center mt-4 pt-4 border-t">
                    <p className="text-sm text-slate-500">
                      عرض 12 من أصل {selectedProducts.length} منتج
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setPreviewMode('a4')}
                    >
                      عرض الكل في معاينة A4
                    </Button>
                  </div>
                )}

              {selectedProducts.length === 0 && (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">لا توجد منتجات محددة</h3>
                  <p className="text-slate-500">اختر المنتجات من الإعدادات لرؤية المعاينة</p>
                </div>
              )}
                </>
              )}
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
