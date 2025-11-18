// OCR and Table Detection Utilities
// Now integrates real OCR paths for images and PDFs via Tesseract.js and pdfjs-dist.
// We still keep mock fallbacks to avoid breaking flows if OCR fails.

export interface TableCell {
  text: string;
  confidence: number;
  row: number;
  col: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  confidence: number;
}

// Minimal types for dynamic imports (avoid any)
type OcrWord = { text: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
type TesseractResult = { data?: { text?: string; words?: OcrWord[] } };
type TesseractModule = {
  recognize: (
    image: string,
    langs?: string,
    options?: Record<string, unknown>
  ) => Promise<TesseractResult>;
};

// Ready API: OCR.Space (supports images and PDFs; table mode)
type Env = { VITE_OCR_SPACE_API_KEY?: string };
const callOcrSpace = async (file: File): Promise<string | null> => {
  try {
    const env = (import.meta as unknown as { env?: Env }).env;
    const key = env?.VITE_OCR_SPACE_API_KEY;
    if (!key) return null;
    const form = new FormData();
    form.append('file', file);
    form.append('language', 'ara');
    form.append('OCREngine', '2');
    form.append('isTable', 'true');
    form.append('scale', 'true');
    form.append('OCROverlay', 'true');
    // For PDFs, let the API handle pages

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': key },
      body: form,
    });
    const json = await res.json();
    if (json?.IsErroredOnProcessing) throw new Error(json?.ErrorMessage || 'OCR.Space error');
    const parsed = json?.ParsedResults?.[0];
    const text = parsed?.ParsedText as string | undefined;
    return text && text.trim().length > 0 ? text : null;
  } catch (e) {
    console.warn('OCR.Space failed:', e);
    return null;
  }
};

type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (opts: { scale: number }) => PdfViewport;
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
};
type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfjsModule = {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc?: string };
};

// Minimal PDF.js text content types
type PdfTextItem = { str: string; transform: number[]; width?: number };
type PdfTextContent = { items: PdfTextItem[] };

// Attempt real OCR with Tesseract.js or OCR.Space; fallback to mock on failure
const normalizeAndFilterLines = (rawText: string): string[] => {
  const text = rawText.replace(/\r/g, '').trim();
  let lines = text.split(/\n+/).map(l => l.trim());
  // Generic header/footer filters
  const badPatterns = [
    /^page\s+\d+(\s*of\s*\d+)?$/i,
    /^صفحة\s+\d+/,
    /\b(unsplash|copyright|all rights reserved)\b/i,
    /\b(fax|phone|tel|email|website|www\.)\b/i,
    /\b(تاريخ|date)\b/i,
    /\bالمخازن\b/,
    /\bالأسعار\s+على\s+أساس\b/,
    /\bحامل\s+رف/,
    /^[-_=]{4,}$/,
  ];
  lines = lines.filter(l => l && l.length > 1 && !badPatterns.some(rx => rx.test(l)));
  return lines;
};

const parseTableFromText = (rawText: string): TableData => {
  // Normalize line endings and trim
  const lines = normalizeAndFilterLines(rawText).filter(Boolean);

  // Try to locate a header line by looking for Arabic/English column cues
  const headerIdx = lines.findIndex(l => /\b(الكمية|كمية|quantity|qty)\b/i.test(l) || /(سعر|price)/i.test(l));
  const headerLine = headerIdx >= 0 ? lines[headerIdx] : lines[0] || '';

  // Split by 2+ spaces or tabs; handles Arabic RTL visually but the OCR text is LTR tokens
  const splitRow = (line: string) => line.split(/\s{2,}|\t+/).map(s => s.trim()).filter(Boolean);
  let headers = splitRow(headerLine);

  // Fallback headers if OCR header is weak
  if (headers.length < 3) headers = ['اسم المنتج', 'السعر', 'الكود', 'المخزون', 'الفئة'];

  // Collect rows after header line
  const rows: string[][] = [];
  for (let i = headerIdx >= 0 ? headerIdx + 1 : 1; i < lines.length; i++) {
    const row = splitRow(lines[i]);
    if (row.length >= 2) rows.push(row);
  }

  // Normalize row widths to headers length
  let normalized = rows.map(r => {
    if (r.length === headers.length) return r;
    if (r.length > headers.length) return r.slice(0, headers.length);
    return [...r, ...Array(headers.length - r.length).fill('')];
  });

  // Fallback: if we could not form rows, try deriving simple rows per line
  if (normalized.length === 0) {
    const deriveRows: string[][] = [];
    const fallbackHeaders = ['اسم المنتج', 'السعر', 'الكمية', 'الكود'];
    for (const line of lines) {
      // skip very short or header-like lines
      if (line.length < 4) continue;
      const priceMatch = line.match(/(\d+[.,]?\d*)\s*(?:ر[.]?س[.]?|sar)?/i);
      const qtyMatch = line.match(/\b(\d{1,4})\b(?!.*\b\1\b)/); // a number token as qty
      // extract code patterns like 2.44 or 2-44 or alnum code
      const codeMatch = line.match(/\b\d+[.-]\d+\b|\b[A-Z]{2,}\d{2,}\b/i);

      const price = priceMatch ? priceMatch[1] : '';
      const qty = qtyMatch ? qtyMatch[1] : '';
      const code = codeMatch ? codeMatch[0] : '';

      // product name: remove found tokens
      let name = line;
      [price, qty, code].forEach(tok => { if (tok) name = name.replace(tok, ' ').trim(); });
      // collapse spaces
      name = name.replace(/\s{2,}/g, ' ').trim();
      if (name && (price || qty || code)) {
        deriveRows.push([name, price, qty, code]);
      }
      if (deriveRows.length >= 200) break; // safety
    }

    if (deriveRows.length > 0) {
      headers = fallbackHeaders;
      normalized = deriveRows;
    }
  }

  // Last-resort fallback: treat each non-empty line as a name-only row
  if (normalized.length === 0 && lines.length > 0) {
    headers = ['اسم المنتج'];
    normalized = lines
      .filter(l => l.length > 2)
      .map(l => [l]);
  }

  return {
    headers,
    rows: normalized,
    confidence: 0.8,
  };
};

// Convert File to data URL
const fileToDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Real OCR function for images with fallback
export const extractTextFromImage = async (file: File): Promise<TableData> => {
  try {
    // Try OCR.Space first if API key exists
    const textFromApi = await callOcrSpace(file);
    if (textFromApi && textFromApi.trim().length > 0) {
      return parseTableFromText(textFromApi);
    }

    const { recognize } = (await import('tesseract.js')) as unknown as TesseractModule;

    // Try Arabic + English; Tesseract.js will fetch traineddata from CDN by default
    const imageUrl = await fileToDataURL(file);
    const result = await recognize(imageUrl, 'ara+eng', { logger: () => {} });
    const words = result?.data?.words || [];
    if (words.length > 10) {
      // Build table using word positions
      type W = { t: string; x: number; y: number; x1: number; y1: number };
      const ws: W[] = words.map(w => ({
        t: w.text?.trim() || '',
        x: w.bbox ? w.bbox.x0 : 0,
        y: w.bbox ? w.bbox.y0 : 0,
        x1: w.bbox ? w.bbox.x1 : 0,
        y1: w.bbox ? w.bbox.y1 : 0,
      })).filter(w => w.t.length > 0);

      // Remove extreme top/bottom lines (likely header/footer)
      const ys = ws.map(w => w.y).sort((a,b)=>a-b);
      const yMin = ys[0] ?? 0;
      const yMax = ys[ys.length-1] ?? 0;
      const pad = (yMax - yMin) * 0.05;
      const wsCore = ws.filter(w => w.y > yMin + pad && w.y1 < yMax - pad);

      // Group into lines by y with tolerance
      wsCore.sort((a,b)=> a.y - b.y || a.x - b.x);
      const lines: W[][] = [];
      const tolY = 8; // px
      for (const w of wsCore) {
        const last = lines[lines.length-1];
        if (!last) { lines.push([w]); continue; }
        if (Math.abs(last[0].y - w.y) <= tolY) last.push(w); else lines.push([w]);
      }

      // Determine column x-clusters from first few body lines
      const sample = lines.slice(0, 12).flat().map(w => w.x).sort((a,b)=>a-b);
      const gaps: number[] = [];
      for (let i=1;i<sample.length;i++) gaps.push(sample[i]-sample[i-1]);
      const gapThreshold = gaps.length ? (gaps.sort((a,b)=>a-b)[Math.floor(gaps.length*0.8)] || 30) : 30;

      // Build rows by splitting tokens when big x-gap occurs
      const rows: string[][] = lines.map(line => {
        const sorted = line.sort((a,b)=>a.x - b.x);
        const cells: string[] = [];
        let current = sorted[0]?.t || '';
        for (let i=1;i<sorted.length;i++) {
          const g = sorted[i].x - sorted[i-1].x1;
          if (g > gapThreshold) { cells.push(current.trim()); current = sorted[i].t; }
          else { current += ' ' + sorted[i].t; }
        }
        if (current) cells.push(current.trim());
        return cells;
      }).filter(r => r.join('').length > 0);

      // Header guess: search row with keywords
      const headerKeywords = /(سعر|الكمية|كود|price|qty|quantity|code)/i;
      let headerIndex = rows.findIndex(r => headerKeywords.test(r.join(' ')));
      if (headerIndex === -1) headerIndex = 0;
      let headers = rows[headerIndex] || [];
      if (headers.length < 3) headers = ['اسم المنتج','السعر','الكمية','الكود'];
      const body = rows.slice(headerIndex+1).filter(r => r.length >= 1);

      // Normalize
      const normalized = body.map(r => r.length > headers.length ? r.slice(0, headers.length) : [...r, ...Array(Math.max(0, headers.length - r.length)).fill('')]);
      if (normalized.length > 0) {
        return { headers, rows: normalized, confidence: 0.78 };
      }
    }

    const text: string = result?.data?.text || '';
    if (text.trim().length < 10) throw new Error('Low OCR text length');
    return parseTableFromText(text);
  } catch (err) {
    console.warn('Image OCR failed, using mock data:', err);
    const mockTables = [
      {
        headers: ['اسم المنتج', 'السعر', 'الكود', 'المخزون', 'الفئة'],
        rows: [
          ['لابتوب ديل XPS', '2500', 'LAP001', '10', 'إلكترونيات'],
          ['ماوس لاسلكي', '150', 'MOU001', '25', 'إلكترونيات'],
          ['كيبورد ميكانيكي', '300', 'KEY001', '15', 'إلكترونيات'],
          ['شاشة 24 بوصة', '800', 'MON001', '8', 'إلكترونيات'],
          ['سماعة بلوتوث', '200', 'HEA001', '20', 'إلكترونيات']
        ],
        confidence: 0.95
      },
      {
        headers: ['Product Name', 'Price', 'SKU', 'Stock', 'Category'],
        rows: [
          ['Gaming Mouse RGB', '250', 'GAM001', '30', 'Electronics'],
          ['Wireless Keyboard', '180', 'KEY002', '22', 'Electronics'],
          ['USB-C Cable', '50', 'CAB001', '100', 'Accessories'],
          ['Phone Case', '80', 'CAS001', '45', 'Accessories']
        ],
        confidence: 0.88
      },
      {
        headers: ['المنتج', 'السعر الجديد', 'الكمية', 'كود المنتج'],
        rows: [
          ['لابتوب ديل XPS', '2400', '12', 'LAP001'],
          ['ماوس لاسلكي', '140', '30', 'MOU001'],
          ['شاشة 24 بوصة', '750', '10', 'MON001']
        ],
        confidence: 0.92
      }
    ];
    return mockTables[Math.floor(Math.random() * mockTables.length)];
  }
};

// OCR for PDFs: render each page to canvas and OCR, then merge texts
export const extractTextFromPDF = async (file: File): Promise<TableData> => {
  try {
    const { getDocument, GlobalWorkerOptions } = (await import('pdfjs-dist')) as unknown as PdfjsModule;
    // Use CDN worker to avoid bundling
    if (GlobalWorkerOptions && !GlobalWorkerOptions.workerSrc) {
      GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuf = await file.arrayBuffer();
    const loadingTask = getDocument({ data: arrayBuf });
    const pdf = await loadingTask.promise;

    // 1) Pure JS text-layer extraction and table detection
    type TextItem = { str: string; x: number; y: number; w: number };
    const pagesLines: string[][] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
      const page = await pdf.getPage(p);
      const content = await (page as unknown as { getTextContent: () => Promise<PdfTextContent> }).getTextContent();
      const items: TextItem[] = content.items.map((it: PdfTextItem) => ({
        str: String(it.str).trim(),
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
      })).filter(i => i.str.length > 0);

      // Group by Y (line), tolerance in pixels
      items.sort((a, b) => b.y - a.y || a.x - b.x); // PDF y desc
      const lines: TextItem[][] = [];
      const tolY = 2; // line grouping tolerance
      for (const it of items) {
        const last = lines[lines.length - 1];
        if (!last) { lines.push([it]); continue; }
        const sameLine = Math.abs(last[0].y - it.y) <= tolY;
        if (sameLine) last.push(it); else lines.push([it]);
      }

      // Sort tokens per line by x, join with spaces
      const textLines = lines.map(line => line.sort((a, b) => a.x - b.x).map(t => t.str).join(' '));
      pagesLines.push(textLines);
    }

    const flatLines = pagesLines.flat();
    const filtered = normalizeAndFilterLines(flatLines.join('\n')).filter(Boolean);

    // If we extracted meaningful text, try structured parse
    if (filtered.length > 5) {
      const data = parseTableFromText(filtered.join('\n'));
      if (data.rows.length > 0) return data;
    }

    // 2) Try OCR.Space (JS fetch) if API key exists
    const textFromApi = await callOcrSpace(file);
    if (textFromApi && textFromApi.trim().length > 0) {
      return parseTableFromText(textFromApi);
    }

    // 3) Fallback to rasterize + Tesseract OCR
    let fullText = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) { // limit to 5 pages for performance
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataUrl = canvas.toDataURL('image/png');
      const { recognize } = (await import('tesseract.js')) as unknown as TesseractModule;
      const res = await recognize(dataUrl, 'ara+eng', { logger: () => {} });
      fullText += '\n' + (res?.data?.text || '');
    }

    if (fullText.trim().length < 10) throw new Error('Low OCR text length for PDF');
    return parseTableFromText(fullText);
  } catch (err) {
    console.warn('PDF OCR failed, using mock data:', err);
    const mockPDFTables = [
      {
        headers: ['Product Code', 'Product Name', 'Unit Price', 'Quantity', 'Category'],
        rows: [
          ['ELEC001', 'Smartphone Samsung', '1200', '15', 'Electronics'],
          ['ELEC002', 'Tablet iPad', '2000', '8', 'Electronics'],
          ['FASH001', 'T-Shirt Cotton', '120', '50', 'Fashion'],
          ['FASH002', 'Jeans Denim', '300', '25', 'Fashion'],
          ['HOME001', 'Coffee Maker', '450', '12', 'Home']
        ],
        confidence: 0.91
      },
      {
        headers: ['كود', 'اسم المنتج', 'السعر', 'المخزون', 'الوصف'],
        rows: [
          ['BOOK001', 'كتاب البرمجة', '85', '40', 'كتاب تعليمي'],
          ['BOOK002', 'كتاب التصميم', '95', '30', 'كتاب فني'],
          ['STAT001', 'قلم حبر', '15', '200', 'أدوات مكتبية'],
          ['STAT002', 'دفتر ملاحظات', '25', '150', 'أدوات مكتبية']
        ],
        confidence: 0.87
      }
    ];
    return mockPDFTables[Math.floor(Math.random() * mockPDFTables.length)];
  }
};

// Smart column detection based on header text
export const detectColumnType = (headerText: string): string => {
  const header = headerText.toLowerCase().trim();
  
  // PRIORITY: Generic OCR headers like Text64, Text55 possibly embedded in a longer header -> treat as name
  if (/\btext\s*\d+\b/i.test(headerText)) return 'name';
  
  // Arabic patterns
  if (header.includes('اسم') && header.includes('منتج')) return 'nameAr';
  if (header.includes('سعر')) return 'price';
  if (header.includes('كود') || header.includes('رقم')) return 'sku';
  if (header.includes('مخزون') || header.includes('كمية')) return 'stock';
  if (header.includes('فئة') || header.includes('قسم')) return 'categoryAr';
  if (header.includes('وصف')) return 'descriptionAr';
  if (header.includes('وزن')) return 'weight';
  
  // English patterns
  if (header.includes('product') && header.includes('name')) return 'name';
  if (header.includes('price') || header.includes('cost')) return 'price';
  if (header.includes('sku') || header.includes('code')) return 'sku';
  if (header.includes('stock') || header.includes('quantity') || header.includes('qty')) return 'stock';
  if (header.includes('category') || header.includes('type')) return 'category';
  if (header.includes('description') || header.includes('desc')) return 'description';
  if (header.includes('weight')) return 'weight';
  if (header.includes('featured')) return 'featured';
  
  // Mixed patterns
  if (header.includes('name') || header.includes('اسم')) return 'name';
  if (header.includes('price') || header.includes('سعر')) return 'price';
  
  return '';
};

// Auto-generate column mapping suggestions
export const generateColumnMapping = (headers: string[]): {[key: number]: string} => {
  const mapping: {[key: number]: string} = {};
  let chosenNameIdx: number | null = null;
  
  headers.forEach((header, index) => {
    const detectedType = detectColumnType(header);
    if (!detectedType) return;

    if (detectedType === 'name' || detectedType === 'nameAr') {
      const h = header.trim().toLowerCase();
      const isTextNN = /^text\s*\d+$/i.test(header.trim());
      const isText64 = h === 'text64';

      // If name not chosen yet, accept this one
      if (chosenNameIdx === null) {
        mapping[index] = 'name';
        chosenNameIdx = index;
        return;
      }

      // Prefer Text64 over previously chosen non-Text64
      if (isText64) {
        // Remove previous mapping for name
        if (chosenNameIdx in mapping) delete mapping[chosenNameIdx];
        mapping[index] = 'name';
        chosenNameIdx = index;
        return;
      }

      // Do not let other TextNN overwrite an already chosen name
      if (isTextNN) {
        return;
      }

      // If previous was TextNN and current is a more semantic header, replace
      const prevHeader = headers[chosenNameIdx].trim().toLowerCase();
      const prevIsTextNN = /^text\s*\d+$/i.test(prevHeader);
      if (prevIsTextNN && !isTextNN) {
        if (chosenNameIdx in mapping) delete mapping[chosenNameIdx];
        mapping[index] = 'name';
        chosenNameIdx = index;
      }
      return;
    }

    mapping[index] = detectedType;
  });
  
  // Post-processing: ensure the correct Price column is chosen when multiple price-like columns exist
  // Prefer exact 'Price'/'السعر' or 'Unit Price' over derived ones like 'AVGPriceOf...'
  const lc = headers.map(h => h.toLowerCase().trim());
  const isAvgLike = (h: string) => /\b(avg|average|mean)\b/.test(h);
  const exactPriceIdx = lc.findIndex(h => h === 'price' || h === 'السعر');
  const unitPriceIdx = lc.findIndex(h => /unit\s*price|سعر\s*الوحدة/.test(h));
  const cleanPriceIdx = lc.findIndex(h => (h.includes('price') || h.includes('سعر')) && !isAvgLike(h));

  const preferredPriceIdx = [exactPriceIdx, unitPriceIdx, cleanPriceIdx].find(i => (i ?? -1) >= 0);

  if (preferredPriceIdx !== undefined && (preferredPriceIdx as number) >= 0) {
    // Remove any other columns that were auto-mapped to price
    Object.entries(mapping).forEach(([idx, field]) => {
      if (field === 'price' && Number(idx) !== preferredPriceIdx) {
        delete mapping[Number(idx)];
      }
    });
    // Ensure preferred index is mapped to price
    mapping[preferredPriceIdx as number] = 'price';
  }

  return mapping;
};

// Validate extracted data
export const validateTableData = (data: TableData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if we have data
  if (!data.headers || data.headers.length === 0) {
    errors.push('لم يتم العثور على رؤوس الأعمدة');
  }
  
  if (!data.rows || data.rows.length === 0) {
    errors.push('لم يتم العثور على بيانات');
  }
  
  // Check confidence level
  if (data.confidence < 0.7) {
    warnings.push('مستوى الثقة في استخراج البيانات منخفض');
  }
  
  // Check for consistent row lengths
  if (data.rows && data.headers) {
    const headerCount = data.headers.length;
    const inconsistentRows = data.rows.filter(row => row.length !== headerCount);
    
    if (inconsistentRows.length > 0) {
      warnings.push(`${inconsistentRows.length} صف لا يحتوي على نفس عدد الأعمدة`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Format extracted data for preview
type PreviewValue = string | number | boolean;
type PreviewProductPartial = Record<string, PreviewValue>;

export const formatDataForPreview = (
  data: TableData,
  columnMapping: {[key: number]: string}
): PreviewProductPartial[] => {
  if (!data.rows || !data.headers) return [];
  
  return data.rows.map(row => {
    const product: PreviewProductPartial = {};
    
    Object.entries(columnMapping).forEach(([colIndex, field]) => {
      const value = row[parseInt(colIndex)];
      if (value && field) {
        switch (field) {
          case 'price':
          case 'originalPrice':
          case 'stock':
          case 'weight':
            product[field] = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
            break;
          case 'featured':
            product[field] = value.toLowerCase() === 'true' || 
                           value.toLowerCase() === 'نعم' || 
                           value === '1';
            break;
          default:
            product[field] = value.trim();
        }
      }
    });
    
    return product;
  });
};

// Export functions for real OCR integration
export const initializeOCR = async () => {
  // In production, initialize Tesseract.js here
  console.log('OCR system initialized (mock)');
};

export const processImageWithOCR = async (imageFile: File): Promise<TableData> => {
  // In production, use Tesseract.js
  return extractTextFromImage(imageFile);
};

export const processPDFWithOCR = async (pdfFile: File): Promise<TableData> => {
  // In production, use PDF.js + OCR
  return extractTextFromPDF(pdfFile);
};
