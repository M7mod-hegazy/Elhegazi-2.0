import type { ShopBuilderWall } from '../types';

export function isDoorWall(wall: ShopBuilderWall | null | undefined): boolean {
  return Boolean(wall?.texture?.startsWith('door_'));
}

/** Center of the axis-aligned bounds of all wall segments (world meters). */
export function getWallsBoundsCenter(walls: ShopBuilderWall[]): { x: number; y: number } {
  if (!walls.length) return { x: 0, y: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.start.x, w.end.x);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export type DoorMaterial = 'glass' | 'wood' | 'metal';

/** New door wall payload centered on current plan (or origin if empty). */
export function createDoorWallDraft(
  material: DoorMaterial,
  walls: ShopBuilderWall[],
  halfLengthM = 0.45
): Partial<ShopBuilderWall> {
  const { x: cx, y: cy } = getWallsBoundsCenter(walls);
  const color =
    material === 'wood' ? '#a16207' : material === 'metal' ? '#64748b' : '#0284c7';
  return {
    start: { x: cx - halfLengthM, y: cy },
    end: { x: cx + halfLengthM, y: cy },
    height: 3,
    thickness: 0.1,
    color,
    texture: `door_${material}` as ShopBuilderWall['texture'],
  };
}

/** Change segment length (m) while keeping midpoint and direction. */
export function wallSegmentWithLength(
  wall: ShopBuilderWall,
  newLength: number
): Pick<ShopBuilderWall, 'start' | 'end'> {
  const mx = (wall.start.x + wall.end.x) / 2;
  const my = (wall.start.y + wall.end.y) / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const cur = Math.hypot(dx, dy);
  if (cur < 1e-9 || newLength <= 0) {
    return { start: { ...wall.start }, end: { ...wall.end } };
  }
  const ux = dx / cur;
  const uy = dy / cur;
  const half = newLength / 2;
  return {
    start: { x: mx - ux * half, y: my - uy * half },
    end: { x: mx + ux * half, y: my + uy * half },
  };
}
