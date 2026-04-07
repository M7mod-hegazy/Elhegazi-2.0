const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

const toBase64Url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return `${normalized}${padding}`;
};

export const isObjectId = (value?: string): boolean =>
  OBJECT_ID_REGEX.test((value || '').toString().trim());

export const encodeObjectId = (id?: string): string => {
  const value = (id || '').toString().trim();
  if (!isObjectId(value)) return value;

  let binary = '';
  for (let i = 0; i < value.length; i += 2) {
    binary += String.fromCharCode(parseInt(value.slice(i, i + 2), 16));
  }
  return toBase64Url(btoa(binary));
};

export const decodeObjectId = (encoded?: string): string => {
  const value = (encoded || '').toString().trim();
  if (!value) return '';
  if (isObjectId(value)) return value;

  try {
    const binary = atob(fromBase64Url(value));
    let hex = '';
    for (let i = 0; i < binary.length; i += 1) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return isObjectId(hex) ? hex : value;
  } catch {
    return value;
  }
};

export const buildProductPath = (id?: string): string => `/product/${encodeObjectId(id)}`;

export const resolveProductIdParam = (idParam?: string): string => decodeObjectId(idParam);
