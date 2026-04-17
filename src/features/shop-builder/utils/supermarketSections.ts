export type SupermarketSectionWidth = 100 | 70 | 50;

export interface SupermarketSection {
  widthCm: SupermarketSectionWidth;
}

export interface SupermarketLayoutOption {
  sections: SupermarketSection[];
  columnCount: number;
  emptySpaceCm: number;
  label: string;
  totalWidthCm: number;
}

const WIDTHS: SupermarketSectionWidth[] = [100, 70, 50];

/**
 * Computes valid supermarket section layouts for a given wall width in cm.
 * Uses standard shelf widths: 100cm, 70cm, 50cm.
 * Always recommends the most 100cm-heavy, lowest-waste solution first.
 *
 * Uses iterative DP instead of exponential recursion.
 * For example, 783cm → best = 7×100 + 1×70 (770cm, 13cm gap)
 */

// Simple in-memory cache to avoid recomputation during re-renders
const layoutCache = new Map<number, SupermarketLayoutOption[]>();

export function computeSupermarketLayouts(wallWidthCm: number): SupermarketLayoutOption[] {
  if (wallWidthCm < 50) return [];

  const rounded = Math.round(wallWidthCm);
  if (layoutCache.has(rounded)) return layoutCache.get(rounded)!;

  // Iterate over all sensible combinations of (count100, count70, count50)
  // Max sections of each type is bounded by wall width
  const max100 = Math.floor(rounded / 100) + 1;
  const max70 = Math.floor(rounded / 70) + 1;
  const max50 = Math.floor(rounded / 50) + 1;

  const candidates: { counts: [number, number, number]; totalWidth: number; emptySpace: number }[] = [];

  for (let n100 = 0; n100 <= max100; n100++) {
    const used100 = n100 * 100;
    if (used100 > rounded + 50) break; // overshoot too much
    
    for (let n70 = 0; n70 <= max70; n70++) {
      const used = used100 + n70 * 70;
      if (used > rounded + 50) break;
      
      // Calculate how many 50cm sections we need
      const remaining = rounded - used;
      
      if (remaining <= 0) {
        // Already filled or slightly overshooting
        if (n100 + n70 > 0) {
          candidates.push({ counts: [n100, n70, 0], totalWidth: used, emptySpace: rounded - used });
        }
        continue;
      }

      // Try filling remaining with 50cm sections
      const n50needed = Math.round(remaining / 50);
      
      // Try n50needed and n50needed-1
      for (const n50 of [n50needed, Math.max(0, n50needed - 1), n50needed + 1]) {
        if (n50 < 0) continue;
        const total = used + n50 * 50;
        const empty = rounded - total;
        if (Math.abs(empty) <= 50 && (n100 + n70 + n50) > 0) {
          candidates.push({ counts: [n100, n70, n50], totalWidth: total, emptySpace: empty });
        }
      }

      // Also try no 50cm sections if the gap is acceptable
      if (remaining <= 50 && (n100 + n70) > 0) {
        candidates.push({ counts: [n100, n70, 0], totalWidth: used, emptySpace: remaining });
      }
    }
  }

  // Deduplicate by counts key
  const seen = new Set<string>();
  const unique = candidates.filter(c => {
    const key = c.counts.join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Convert to output format
  const finalized: SupermarketLayoutOption[] = unique.map(c => {
    const [n100, n70, n50] = c.counts;
    const sections: SupermarketSection[] = [];
    for (let i = 0; i < n100; i++) sections.push({ widthCm: 100 });
    for (let i = 0; i < n70; i++) sections.push({ widthCm: 70 });
    for (let i = 0; i < n50; i++) sections.push({ widthCm: 50 });

    const parts: string[] = [];
    if (n100 > 0) parts.push(`${n100}×1م`);
    if (n70 > 0) parts.push(`${n70}×70سم`);
    if (n50 > 0) parts.push(`${n50}×50سم`);
    const label = parts.join(' + ') + ` | ${sections.length + 1} أعمدة`;

    return {
      sections,
      columnCount: sections.length + 1,
      emptySpaceCm: c.emptySpace,
      label,
      totalWidthCm: c.totalWidth,
    };
  });

  // Sort priority:
  // 1) NEVER exceed wall — non-overshooting (emptySpace >= 0) always beats overshooting
  // 2) Within non-overshooting: maximize 100cm count (most cost-effective)
  // 3) Smallest gap as tiebreaker
  // 4) Within overshooting (fallback): smallest overshoot
  finalized.sort((a, b) => {
    const aOver = a.emptySpaceCm < 0;
    const bOver = b.emptySpaceCm < 0;
    // Non-overshooting always wins
    if (aOver !== bOver) return aOver ? 1 : -1;

    if (!aOver && !bOver) {
      // Both fit: prefer more 100cm sections
      const count100A = a.sections.filter(s => s.widthCm === 100).length;
      const count100B = b.sections.filter(s => s.widthCm === 100).length;
      if (count100A !== count100B) return count100B - count100A;
      // Same 100cm count: prefer smaller gap
      return a.emptySpaceCm - b.emptySpaceCm;
    }

    // Both overshoot: prefer smaller overshoot
    return Math.abs(a.emptySpaceCm) - Math.abs(b.emptySpaceCm);
  });

  const result = finalized.slice(0, 3);
  layoutCache.set(rounded, result);
  return result;
}
