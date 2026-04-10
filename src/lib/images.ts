export function optimizeImage(url: string, opts?: { w?: number; q?: number }): string {
  if (!url) return url;
  const w = opts?.w || 280;
  const q = opts?.q || 80;
  try {
    // Cloudinary delivery URL pattern: /image/upload/... => insert transformations after upload/
    if (url.includes('/image/upload/')) {
      const [head, tail] = url.split('/image/upload/');
      const trans = `image/upload/f_auto,q_auto,w_${w}/`;
      return `${head}/${trans}${tail}`;
    }
    // Unsplash patterns: append w and q
    if (url.includes('images.unsplash.com')) {
      const u = new URL(url);
      u.searchParams.set('w', String(w * 2)); // retina
      u.searchParams.set('q', String(q));
      u.searchParams.set('auto', 'format');
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export function buildSrcSet(url: string, baseW = 280): string | undefined {
  if (!url) return undefined;
  const w1 = baseW;
  const w2 = baseW * 2;
  const u1 = optimizeImage(url, { w: w1 });
  const u2 = optimizeImage(url, { w: w2 });
  if (u1 === url && u2 === url) return undefined;
  return `${u1} ${w1}w, ${u2} ${w2}w`;
}

const PRODUCT_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" fill="url(#g)"/>
    <g fill="none" stroke="#94a3b8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
      <rect x="110" y="80" width="260" height="200" rx="18"/>
      <path d="M150 232l54-58 48 42 40-34 38 50"/>
      <circle cx="186" cy="138" r="22"/>
    </g>
  </svg>`
);

export const PRODUCT_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${PRODUCT_FALLBACK_SVG}`;

const CATEGORY_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eef2ff"/>
        <stop offset="100%" stop-color="#e0e7ff"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" fill="url(#cg)"/>
    <g fill="none" stroke="#6366f1" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
      <rect x="110" y="92" width="260" height="176" rx="20"/>
      <path d="M150 160h180"/>
      <path d="M150 196h120"/>
      <path d="M150 232h160"/>
    </g>
  </svg>`
);

const GENERIC_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="#f1f5f9"/>
    <g fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="84" y="60" width="152" height="120" rx="12"/>
      <path d="M106 154l28-30 24 21 20-18 22 27"/>
      <circle cx="130" cy="95" r="12"/>
    </g>
  </svg>`
);

export const CATEGORY_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${CATEGORY_FALLBACK_SVG}`;
export const GENERIC_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${GENERIC_FALLBACK_SVG}`;

const LOGO_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ede9fe"/>
        <stop offset="100%" stop-color="#ddd6fe"/>
      </linearGradient>
    </defs>
    <rect width="240" height="240" rx="36" fill="url(#lg)"/>
    <circle cx="120" cy="120" r="68" fill="none" stroke="#7c3aed" stroke-width="14"/>
    <path d="M83 120h74M120 83v74" stroke="#7c3aed" stroke-width="14" stroke-linecap="round"/>
  </svg>`
);

const AVATAR_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" fill="#e2e8f0"/>
    <circle cx="80" cy="62" r="28" fill="#94a3b8"/>
    <rect x="36" y="102" width="88" height="44" rx="22" fill="#94a3b8"/>
  </svg>`
);

const HERO_FALLBACK_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#312e81"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#hg)"/>
    <circle cx="240" cy="170" r="100" fill="#ffffff" opacity="0.08"/>
    <circle cx="1030" cy="550" r="140" fill="#ffffff" opacity="0.06"/>
    <rect x="220" y="290" width="840" height="180" rx="20" fill="#ffffff" opacity="0.1"/>
  </svg>`
);

export const LOGO_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${LOGO_FALLBACK_SVG}`;
export const AVATAR_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${AVATAR_FALLBACK_SVG}`;
export const HERO_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${HERO_FALLBACK_SVG}`;

export function applyProductImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = PRODUCT_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
  img.style.objectFit = 'contain';
}

export function applyCategoryImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = CATEGORY_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)';
  img.style.objectFit = 'contain';
}

export function applyGenericImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = GENERIC_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = '#f1f5f9';
  img.style.objectFit = 'contain';
}

export function applyLogoImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = LOGO_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)';
  img.style.objectFit = 'contain';
}

export function applyAvatarImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = AVATAR_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = '#e2e8f0';
  img.style.objectFit = 'cover';
}

export function applyHeroImageFallback(event: { currentTarget: HTMLImageElement }) {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = HERO_IMAGE_FALLBACK;
  img.srcset = '';
  img.style.background = 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)';
  img.style.objectFit = 'cover';
}
