import type { ShopBuilderWall } from '../types';

function quantKey(x: number, y: number): string {
  const qx = Math.round(x * 100) / 100;
  const qy = Math.round(y * 100) / 100;
  return `${qx.toFixed(2)},${qy.toFixed(2)}`;
}

function mergeVertex(map: Map<string, { x: number; y: number }>, key: string, p: { x: number; y: number }) {
  const cur = map.get(key);
  if (!cur) {
    map.set(key, { x: p.x, y: p.y });
  } else {
    map.set(key, { x: (cur.x + p.x) / 2, y: (cur.y + p.y) / 2 });
  }
}

function polygonArea(poly: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return Math.abs(a / 2);
}

export function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const denom = yj - yi;
    const intersect =
      yi !== yj && ((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (denom + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

type Edge = { id: string; a: string; b: string };

function wallCentroid(walls: ShopBuilderWall[]): { x: number; y: number } {
  if (!walls.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const w of walls) {
    sx += (w.start.x + w.end.x) / 2;
    sy += (w.start.y + w.end.y) / 2;
  }
  return { x: sx / walls.length, y: sy / walls.length };
}

/**
 * Finds a single closed loop of wall segments whose interior contains the layout centroid.
 * Used to tint “inside the shop” floor in 2D/3D when the plan is fully closed (walls + doors as edges).
 */
export function findShopEnclosurePolygon(
  walls: ShopBuilderWall[],
  options?: { maxEdgesInCycle?: number; minAreaM2?: number }
): { vertices: { x: number; y: number }[]; area: number } | null {
  const maxN = options?.maxEdgesInCycle ?? 40;
  const minA = options?.minAreaM2 ?? 4;

  const pos = new Map<string, { x: number; y: number }>();
  const edges: Edge[] = [];

  for (const w of walls) {
    const a = quantKey(w.start.x, w.start.y);
    const b = quantKey(w.end.x, w.end.y);
    if (a === b) continue;
    mergeVertex(pos, a, w.start);
    mergeVertex(pos, b, w.end);
    edges.push({ id: w.id, a, b });
  }

  if (edges.length < 3) return null;

  const byVertex = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!byVertex.has(e.a)) byVertex.set(e.a, []);
    if (!byVertex.has(e.b)) byVertex.set(e.b, []);
    byVertex.get(e.a)!.push(e);
    byVertex.get(e.b)!.push(e);
  }

  const C = wallCentroid(walls);

  function otherEnd(e: Edge, v: string): string {
    return e.a === v ? e.b : e.a;
  }

  let best: { verts: { x: number; y: number }[]; area: number } | null = null;

  function dfs(start: string, curr: string, path: string[], used: Set<string>) {
    if (path.length > maxN) return;
    const outs = byVertex.get(curr) || [];
    for (const e of outs) {
      if (used.has(e.id)) continue;
      const nx = otherEnd(e, curr);
      if (nx === start) {
        if (path.length >= 2) {
          const orderedKeys = [start, ...path];
          const poly = orderedKeys.map((k) => {
            const p = pos.get(k);
            if (!p) return null;
            return { ...p };
          });
          if (poly.some((p) => p === null)) continue;
          const verts = poly as { x: number; y: number }[];
          const area = polygonArea(verts);
          if (area < minA) continue;
          if (!pointInPolygon(C.x, C.y, verts)) continue;
          if (!best || area > best.area) {
            best = { vertices: verts, area };
          }
        }
        continue;
      }
      if (path.includes(nx)) continue;
      used.add(e.id);
      path.push(nx);
      dfs(start, nx, path, used);
      path.pop();
      used.delete(e.id);
    }
  }

  for (const start of byVertex.keys()) {
    for (const e0 of byVertex.get(start) || []) {
      const v1 = otherEnd(e0, start);
      if (v1 === start) continue;
      dfs(start, v1, [v1], new Set([e0.id]));
    }
  }

  return best;
}
