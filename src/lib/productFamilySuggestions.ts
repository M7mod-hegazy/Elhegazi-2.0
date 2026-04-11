/**
 * Heuristic clustering of very similar product titles (e.g. same shelf line, different size).
 * Uses normalized Levenshtein + longest-common-prefix boost; compares only within a sorted window
 * to stay fast on large catalogs.
 */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeProductTitle(s: string): string {
  let out = '';
  for (const ch of s.trim()) {
    const i = AR_DIGITS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/[,،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}

/** 0–1, higher = more similar */
export function titleSimilarity(a: string, b: string): number {
  const A = normalizeProductTitle(a);
  const B = normalizeProductTitle(b);
  if (!A.length && !B.length) return 1;
  if (!A.length || !B.length) return 0;
  if (A === B) return 1;
  const d = levenshtein(A, B);
  const maxLen = Math.max(A.length, B.length);
  let sim = 1 - d / maxLen;

  let prefix = 0;
  const upto = Math.min(A.length, B.length);
  while (prefix < upto && A[prefix] === B[prefix]) prefix += 1;
  const prefixRatio = prefix / Math.min(maxLen, Math.max(A.length, B.length, 1));
  if (prefixRatio >= 0.55 && prefix >= 6) {
    const minSuffix = Math.min(A.length - prefix, B.length - prefix);
    // Long differing tails (many sizes/colours) should not inflate similarity via shared product line prefix.
    const boost =
      minSuffix > 12 ? 0.035 + prefixRatio * 0.035 : 0.11 + prefixRatio * 0.075;
    sim = Math.min(1, sim + boost);
  }
  return sim;
}

export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0]!;
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i]!;
    while (!s.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) return '';
  }
  return prefix.replace(/\s+$/u, '').trimEnd();
}

/**
 * Raw char LCP can end inside a size (e.g. "35*50" vs "30*50" → "… خاص 3"). Rewind through digits / × / *.
 */
function safeTitlePrefixForFamily(strings: string[]): string {
  let p = longestCommonPrefix(strings).trimEnd();
  for (let guard = 0; guard < 24; guard++) {
    const i = p.length;
    const nextChars = strings.map((s) => s[i] ?? '');
    const present = nextChars.filter((c) => c !== '');
    if (present.length === 0) break;
    if (new Set(present).size === 1) break;
    const tail = p.match(/[\d٠-٩*×xX.,٫٬\s]+$/u);
    if (tail) {
      p = p.slice(0, p.length - tail[0].length).replace(/\s+$/u, '').trimEnd();
      continue;
    }
    if (present.every((c) => /^[\d٠-٩]$/u.test(c))) {
      while (p.length > 0 && /[\d٠-٩\s]$/u.test(p)) {
        p = p.slice(0, -1);
      }
      p = p.replace(/\s+$/u, '').trimEnd();
      continue;
    }
    break;
  }
  return p.trimEnd();
}

function longestCommonSuffix(strings: string[]): string {
  if (strings.length === 0) return '';
  const rev = strings.map((s) => [...s].reverse().join(''));
  const rPref = longestCommonPrefix(rev);
  return [...rPref].reverse().join('');
}

/** Leading numeric token (Latin / Arabic digits + optional decimals) + rest. */
function splitLeadingNumericToken(s: string): { token: string; rest: string } {
  const m = s.match(/^\s*([\d٠-٩]+(?:[.,٫][\d٠-٩]+)?)\s*(.*)$/u);
  if (!m) return { token: '', rest: s.trim() };
  return { token: (m[1] || '').trim(), rest: (m[2] || '').trim() };
}

/** Drop trailing parenthetical segment (ASCII or full-width parens). */
function stripTrailingParenPhrase(s: string): string {
  return s.replace(/\s*[\u0028\uFF08][^)\uFF09]*[\u0029\uFF09]\s*$/u, '').trim();
}

/** Remove leading size/count tokens (Latin or Arabic digits, optional decimals) repeatedly. */
function peelLeadingDigitTokens(s: string): string {
  let t = s.trim();
  let prev = '';
  while (t !== prev) {
    prev = t;
    t = t.replace(/^[\d٠-٩]+(?:[.,٫][\d٠-٩]+)?\s*/u, '').trim();
  }
  return t;
}

/** Unit words (Arabic + Latin) — must not sit in the family name; stay on variant / chip. */
const UNIT_WORD =
  '(?:سم|سنتيمتر|سنتمتر|متر|مم|ملم|مليمتر|بوصة|قدم|انش|إنش|inch|ft|cm|mm|m\\b)';

/** Strip one leading variant block: W×H, number+unit, glued number+unit, or plain number. */
function stripOneLeadingVariantBlock(s: string): string {
  let t = s.trim();
  if (!t) return t;
  // 35*50 / 30 * 70 (Arabic digits ok)
  const wxh = t.match(
    /^[\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?\s*[*x×X]\s*[\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?\s*/u
  );
  if (wxh) return t.slice(wxh[0].length).trim();
  // 20 سم / 1.25 متر
  const numUnit = t.match(
    new RegExp(
      `^[\\d٠-٩]+(?:[.,٫٬][\\d٠-٩]+)?\\s+${UNIT_WORD}\\s*`,
      'iu'
    )
  );
  if (numUnit) return t.slice(numUnit[0].length).trim();
  // 25سم / 30مم (glued)
  const glued = t.match(
    new RegExp(`^[\\d٠-٩]+(?:[.,٫٬][\\d٠-٩]+)?${UNIT_WORD}\\s*`, 'iu')
  );
  if (glued) return t.slice(glued[0].length).trim();
  // plain number (size index, count, etc.)
  const num = t.match(/^[\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?\s*/u);
  if (num) return t.slice(num[0].length).trim();
  return t;
}

/** Remove all leading variant/size fragments so LCP is taken on stable descriptive text only. */
function peelLeadingVariantBlocks(s: string, maxRounds = 8): string {
  let t = s.trim();
  for (let i = 0; i < maxRounds; i++) {
    const next = stripOneLeadingVariantBlock(t);
    if (next === t) break;
    t = next;
  }
  return t;
}

/** Drop standalone unit tokens at start (after numeric peel). */
function peelLeadingUnitWordOnly(s: string): string {
  let t = s.trim();
  const m = t.match(new RegExp(`^${UNIT_WORD}\\s+`, 'iu'));
  if (m) return t.slice(m[0].length).trim();
  return t;
}

/** Remove trailing unit words from family label (not part of product line name). */
function stripTrailingUnitWords(s: string): string {
  let t = s.trim();
  const re = new RegExp(`\\s+${UNIT_WORD}\\s*$`, 'iu');
  for (let i = 0; i < 4; i++) {
    const n = t.replace(re, '').trim();
    if (n === t) break;
    t = n;
  }
  return t;
}

/** Remove stray size symbols or lone digits accidentally left at end of the family string. */
function stripDegenerateFamilyTail(s: string): string {
  return s
    .replace(/\s+[*x×X]\s*$/u, '')
    .replace(/\s+[\d٠-٩]+\s*$/u, '')
    .trim();
}

/** When every chip ends with `(…)`, drop those tails so only the differing core remains (e.g. 5 vs 7). */
function stripCommonTrailingParenFromChips(chips: string[]): string[] {
  const endsParen = /\s*[\u0028\uFF08][^)\uFF09]*[\u0029\uFF09]\s*$/u;
  if (chips.length < 2 || !chips.every((c) => endsParen.test(c))) return chips;
  return chips.map((c) => c.replace(endsParen, '').trim());
}

/** Shorten chip labels: shared trailing segment, then shared leading segment. */
function compressChipStrings(chips: string[]): string[] {
  let r = chips.map((c) => c.replace(/\s+/g, ' ').trim());
  r = stripCommonTrailingParenFromChips(r);
  for (let k = 0; k < 4; k++) {
    const suf = longestCommonSuffix(r);
    if (suf.length < 2) break;
    r = r.map((c) => c.slice(0, c.length - suf.length).trim());
  }
  for (let k = 0; k < 2; k++) {
    const pre = longestCommonPrefix(r);
    if (pre.length < 2) break;
    r = r.map((c) => c.slice(pre.length).trim());
  }
  return r.map((c) => c || '—');
}

/** Text after family prefix: strip (…), then W×H / numbers / units so LCP skips varying sizes. */
function coreAfterSizeTokens(rest: string): string {
  let t = stripTrailingParenPhrase(rest.trim());
  t = peelLeadingVariantBlocks(t);
  t = peelLeadingUnitWordOnly(t);
  return t.trim();
}

/** First size/count token(s) for chip text (W×H, number+unit, or leading number). */
function splitFirstVariantBlock(s: string): { variant: string; rest: string } {
  const t = s.trim();
  if (!t) return { variant: '', rest: '' };
  const wxh = t.match(
    /^([\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?\s*[*x×X]\s*[\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?)\s+(.*)$/u
  );
  if (wxh) return { variant: wxh[1]!.trim(), rest: (wxh[2] || '').trim() };
  const wxhEnd = t.match(
    /^([\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?\s*[*x×X]\s*[\d٠-٩]+(?:[.,٫٬][\d٠-٩]+)?)\s*$/u
  );
  if (wxhEnd) return { variant: wxhEnd[1]!.trim(), rest: '' };
  const numUnit = t.match(
    new RegExp(
      `^([\\d٠-٩]+(?:[.,٫٬][\\d٠-٩]+)?\\s+${UNIT_WORD})\\s+(.*)$`,
      'iu'
    )
  );
  if (numUnit) return { variant: numUnit[1]!.trim(), rest: (numUnit[2] || '').trim() };
  const glued = t.match(
    new RegExp(`^([\\d٠-٩]+(?:[.,٫٬][\\d٠-٩]+)?${UNIT_WORD})\\s+(.*)$`, 'iu')
  );
  if (glued) return { variant: glued[1]!.trim(), rest: (glued[2] || '').trim() };
  const st = splitLeadingNumericToken(t);
  if (st.token) return { variant: st.token, rest: st.rest };
  return { variant: '', rest: t };
}

/**
 * Longer family label: strict start LCP + shared middle after skipping size numbers and trailing (…);
 * shorter chips: leading size token + tail, then strip shared ends.
 */
function smartFamilyNameAndChips(
  displayNames: string[]
): { familyAr: string; chips: string[] } {
  const names = displayNames.map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) {
    return { familyAr: names[0] || '', chips: [names[0] || ''] };
  }

  const baseLcp = safeTitlePrefixForFamily(names);
  const rests = names.map((n) => n.slice(baseLcp.length).trim());
  const bodies = rests.map(coreAfterSizeTokens);
  const midRaw = longestCommonPrefix(bodies).trimEnd();
  const mid = midRaw.length >= 2 ? midRaw : '';

  const joinParts = [baseLcp.trim(), mid.trim()].filter(Boolean);
  let familyAr = joinParts.join(' ').trim() || baseLcp.trim();
  familyAr = stripTrailingUnitWords(familyAr);
  familyAr = stripDegenerateFamilyTail(familyAr);
  if (familyAr.length < 4) {
    familyAr = names[0]!.slice(0, Math.min(48, names[0]!.length));
  }

  const rawChips = names.map((full, idx) => {
    const r = rests[idx]!.trim();
    const parenM = r.match(/[\u0028\uFF08]([^)\uFF09]*)[\u0029\uFF09]\s*$/u);
    const paren = parenM ? `(${parenM[1]})` : '';
    const r0 = stripTrailingParenPhrase(r);
    const { variant, rest: afterVar } = splitFirstVariantBlock(r0);
    let tail = '';
    if (mid.length > 0 && afterVar.startsWith(mid)) {
      tail = afterVar.slice(mid.length).trim();
    } else if (mid.length > 0) {
      const nudged = peelLeadingUnitWordOnly(afterVar);
      if (nudged.startsWith(mid)) tail = nudged.slice(mid.length).trim();
    } else {
      tail = afterVar;
    }
    let chip = [variant, tail, paren].filter(Boolean).join(' ').trim();
    if (!chip) chip = full.slice(baseLcp.length).trim() || full;
    return chip;
  });

  const chips = compressChipStrings(rawChips);
  return { familyAr, chips };
}

export type SuggestionCluster<T extends { _id: string; name?: string; nameAr?: string }> = {
  id: string;
  members: T[];
  /** Suggested Arabic family name (may combine start LCP + shared middle; pre-filled in wizard) */
  suggestedFamilyNameAr: string;
  /** Contiguous prefix every title starts with — list UI grey highlight when extended name is not a prefix */
  displayNamePrefixAr?: string;
  /** Average pairwise similarity in cluster */
  avgSimilarity: number;
  /** Single option key to use in merge wizard */
  optionKey: string;
  /** labelAr for the distinguishing option */
  suggestedOptionLabelAr: string;
  /** Per product id → button text (differing part of title) */
  valuesByProduct: Record<string, Record<string, string>>;
};

function clusterAvgSimilarity(names: string[]): number {
  if (names.length < 2) return 1;
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      sum += titleSimilarity(names[i]!, names[j]!);
      cnt += 1;
    }
  }
  return cnt ? sum / cnt : 1;
}

/** True only when the product is not linked to any product family (suggestions ignore «in family» rows). */
export function isProductEligibleForFamilySuggestion(p: {
  productFamilyId?: string | null | undefined;
}): boolean {
  const v = p.productFamilyId;
  if (v == null) return true;
  const s = String(v).trim();
  if (s.length === 0) return true;
  if (s === 'null' || s === 'undefined') return true;
  return false;
}

function bucketPrefix(norm: string, len: number): string {
  if (!norm) return '_';
  return norm.slice(0, Math.min(len, norm.length));
}

type LabeledRow<T> = { p: T; label: string; norm: string };

/** Pairwise union–find; n stays small (only within one coarse cluster). */
function connectedComponentIndices(labels: string[], simThreshold: number): number[][] {
  const n = labels.length;
  if (n === 0) return [];
  const parent = [...Array(n).keys()];
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]!);
    return parent[x]!;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (titleSimilarity(labels[i]!, labels[j]!) >= simThreshold) union(i, j);
    }
  }
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(i);
  }
  return [...map.values()];
}

/** Split groups where titles differ by load class (ثقيل / وسط / خفيف). */
function splitByArWeightClass<T>(rows: LabeledRow<T>[], minSize: number): LabeledRow<T>[][] | null {
  const groups = new Map<string, LabeledRow<T>[]>();
  for (const r of rows) {
    const m = r.label.match(/\b(ثقيل|وسط|خفيف)\b/i);
    const key = m ? m[1]!.toLowerCase() : '_other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const tagged = [...groups.entries()].filter(([k]) => k !== '_other');
  if (tagged.length < 2) return null;
  const out: LabeledRow<T>[][] = [];
  for (const [, g] of tagged) {
    if (g.length >= minSize) out.push(g);
  }
  if (out.length < 2) return null;
  const other = groups.get('_other') || [];
  if (other.length >= minSize) out.push(other);
  else if (other.length > 0) return null;
  return out;
}

/**
 * Break one coarse cluster into several smaller suggestions (cap size, prefer semantic / tight similarity).
 */
function refineToSmallerClusters<T>(rows: LabeledRow<T>[], minSize: number, maxSize: number): LabeledRow<T>[][] {
  if (rows.length <= maxSize) return [rows];

  const lex = splitByArWeightClass(rows, minSize);
  if (lex && lex.length >= 2) {
    const br = lex.flatMap((g) => refineToSmallerClusters(g, minSize, maxSize));
    if (br.length > 0) return br;
  }

  const labels = rows.map((r) => r.label);
  let t = 0.9;
  const tMax = 0.982;
  while (t <= tMax) {
    const comps = connectedComponentIndices(labels, t);
    const maxC = Math.max(0, ...comps.map((c) => c.length));
    if (maxC <= maxSize) {
      const split = comps
        .map((idxs) => idxs.map((i) => rows[i]!))
        .filter((g) => g.length >= minSize)
        .flatMap((g) => refineToSmallerClusters(g, minSize, maxSize));
      if (split.length > 0) return split;
    }
    t += 0.007;
  }

  const sorted = [...rows].sort((a, b) => a.norm.localeCompare(b.norm, 'ar'));
  const n = sorted.length;
  const k = Math.ceil(n / maxSize);
  const chunks: LabeledRow<T>[][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const remSlots = k - i;
    const remaining = n - start;
    const size = Math.ceil(remaining / remSlots);
    chunks.push(sorted.slice(start, start + size));
    start += size;
  }
  return chunks.filter((g) => g.length >= minSize);
}

function rowToCluster<T extends { _id: string; name?: string; nameAr?: string }>(
  rows: LabeledRow<T>[],
  id: string
): SuggestionCluster<T> | null {
  if (rows.length < 2) return null;
  const members = rows.map((r) => r.p);
  const displayNames = members.map((m) => ((m.nameAr || m.name || '') as string).trim()).filter(Boolean);
  if (displayNames.length < 2) return null;

  const strictPrefix = safeTitlePrefixForFamily(displayNames);
  const { familyAr, chips } = smartFamilyNameAndChips(displayNames);
  const suggestedFamilyNameAr = familyAr;
  const displayNamePrefixAr = strictPrefix.length >= 2 ? strictPrefix : undefined;

  const optKey = 'opt1';
  const valuesByProduct: Record<string, Record<string, string>> = {};
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!;
    valuesByProduct[m._id] = { [optKey]: chips[i] ?? '—' };
  }

  let suggestedOptionLabelAr = 'مقاس';
  const chipSample = chips[0] || '';
  if (/لون|أبيض|أسود|أحمر|أخضر|أزرق|ابيض|رمادي|بيج/i.test(chipSample)) suggestedOptionLabelAr = 'لون';
  else if (/ثقيل|وسط|خفيف/i.test(chipSample)) suggestedOptionLabelAr = 'النوع';
  else if (/متر|سم|مم|cm|mm|inch|بوصة|قدم/i.test(chipSample)) suggestedOptionLabelAr = 'الطول';

  return {
    id,
    members,
    suggestedFamilyNameAr,
    displayNamePrefixAr,
    avgSimilarity: clusterAvgSimilarity(displayNames),
    optionKey: optKey,
    suggestedOptionLabelAr,
    valuesByProduct,
  };
}

/**
 * Clustering uses **only** products with no `productFamilyId` — never compares or groups an already-family member.
 * Union-find: (1) sliding window on full list sorted by normalized name, (2) same window inside each prefix-bucket
 * so near-identical titles that sort far apart (e.g. 1.25 vs 10) still get compared.
 *
 * Coarse groups are then split so each suggestion stays small (default max 8): tighter similarity, ثقيل/وسط/خفيف
 * lines, then ordered chunks — favouring more, smaller families.
 */
export function buildFamilySuggestions<T extends { _id: string; name?: string; nameAr?: string }>(
  products: T[],
  opts?: {
    threshold?: number;
    window?: number;
    minSize?: number;
    bucketPrefixLen?: number;
    maxClusterSize?: number;
    /** Extra pair suggestions (same product may appear in several cards until assigned to a family). */
    maxSupplementalPairs?: number;
  }
): SuggestionCluster<T>[] {
  const threshold = opts?.threshold ?? 0.88;
  const window = opts?.window ?? 48;
  const minSize = opts?.minSize ?? 2;
  const bucketLen = opts?.bucketPrefixLen ?? 14;
  const maxClusterSize = Math.max(minSize, opts?.maxClusterSize ?? 8);

  const eligible = products.filter((p) =>
    isProductEligibleForFamilySuggestion(p as { productFamilyId?: string | null })
  ) as T[];
  if (eligible.length < minSize) return [];

  const withLabel = eligible.map((p, idx) => ({
    p,
    idx,
    label: ((p.nameAr || p.name || '') as string).trim(),
    norm: normalizeProductTitle((p.nameAr || p.name || '') as string),
  }));
  withLabel.sort((a, b) => a.norm.localeCompare(b.norm, 'ar'));

  const n = withLabel.length;
  const parent = [...Array(n).keys()];
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]!);
    return parent[x]!;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const tryPair = (i: number, j: number) => {
    const ai = withLabel[i]!;
    const bj = withLabel[j]!;
    if (!ai.label || !bj.label) return;
    if (titleSimilarity(ai.label, bj.label) >= threshold) union(i, j);
  };

  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + window);
    for (let j = i + 1; j <= hi; j++) tryPair(i, j);
  }

  const buckets = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = bucketPrefix(withLabel[i]!.norm, bucketLen);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i);
  }
  for (const [, arr] of buckets) {
    for (let t = 0; t < arr.length; t++) {
      const hi = Math.min(arr.length - 1, t + window);
      for (let u = t + 1; u <= hi; u++) tryPair(arr[t]!, arr[u]!);
    }
  }

  const groups = new Map<number, typeof withLabel>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(withLabel[i]!);
  }

  const clusters: SuggestionCluster<T>[] = [];
  let gid = 0;
  for (const [, rows] of groups) {
    if (rows.length < minSize) continue;
    const labeled: LabeledRow<T>[] = rows.map((r) => ({ p: r.p, label: r.label, norm: r.norm }));
    const parts = refineToSmallerClusters(labeled, minSize, maxClusterSize);
    for (const part of parts) {
      const c = rowToCluster(part, `sug-${gid++}`);
      if (c) clusters.push(c);
    }
  }

  const maxSupplementalPairs = opts?.maxSupplementalPairs ?? 400;
  const pairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

  const primaryPairKeys = new Set<string>();
  const memberToClusterIdx = new Map<string, number>();
  clusters.forEach((c, idx) => {
    for (const m of c.members) memberToClusterIdx.set(m._id, idx);
    if (c.members.length === 2) {
      const [x, y] = [...c.members].sort((u, v) => u._id.localeCompare(v._id));
      primaryPairKeys.add(pairKey(x._id, y._id));
    }
  });

  type PairCand = { k: string; sim: number; part: LabeledRow<T>[] };
  const pairCands: PairCand[] = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const pi = eligible[i]!;
      const pj = eligible[j]!;
      const li = ((pi.nameAr || pi.name || '') as string).trim();
      const lj = ((pj.nameAr || pj.name || '') as string).trim();
      if (!li || !lj) continue;
      const sim = titleSimilarity(li, lj);
      const cia = memberToClusterIdx.get(pi._id);
      const cib = memberToClusterIdx.get(pj._id);
      const sameCluster = cia !== undefined && cia === cib;
      const sizeSame = sameCluster ? clusters[cia!]!.members.length : 0;
      const k = pairKey(pi._id, pj._id);
      if (primaryPairKeys.has(k)) continue;

      const crossOrSolo = cia === undefined || cib === undefined || cia !== cib;
      const tightPairInLarge = sameCluster && sizeSame >= 3 && sim >= 0.94;
      const crossStrong = crossOrSolo && sim >= 0.9;
      if (!tightPairInLarge && !crossStrong) continue;

      pairCands.push({
        k,
        sim,
        part: [
          { p: pi, label: li, norm: normalizeProductTitle(li) },
          { p: pj, label: lj, norm: normalizeProductTitle(lj) },
        ],
      });
    }
  }

  pairCands.sort((a, b) => b.sim - a.sim);
  const seenSuppPair = new Set<string>();
  for (const cand of pairCands) {
    if (seenSuppPair.size >= maxSupplementalPairs) break;
    if (seenSuppPair.has(cand.k)) continue;
    seenSuppPair.add(cand.k);
    const c = rowToCluster(cand.part, `sug-pair-${gid++}`);
    if (c) clusters.push(c);
  }

  clusters.sort((a, b) => b.avgSimilarity - a.avgSimilarity || b.members.length - a.members.length);
  return clusters;
}
