/**
 * Normalize branch phone data: supports legacy single `phone` (possibly comma-separated)
 * and explicit `phones` arrays from admin.
 */
export function getLocationPhoneList(loc: { phone?: string; phones?: unknown }): string[] {
  if (Array.isArray(loc.phones)) {
    const fromArr = loc.phones.map((p) => String(p).trim()).filter(Boolean);
    if (fromArr.length > 0) return fromArr;
  }
  const raw = String(loc.phone ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/[,،;|\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getLocationPrimaryPhone(loc: { phone?: string; phones?: unknown }): string {
  return getLocationPhoneList(loc)[0] ?? '';
}
