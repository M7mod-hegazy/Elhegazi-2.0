import type { ShopBuilderLayout } from '../types';

export function downloadLayout(layout: ShopBuilderLayout) {
  const pretty = JSON.stringify(layout, null, 2);
  downloadFile(pretty, `shop-layout-${Date.now()}.json`, 'application/json');
}

export async function readLayoutFile(file: File): Promise<ShopBuilderLayout> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ShopBuilderLayout;
  if (!Array.isArray(parsed.walls) || !Array.isArray(parsed.products)) {
    throw new Error('ملف التخطيط غير صالح.');
  }
  return parsed;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
