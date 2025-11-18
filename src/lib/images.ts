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
