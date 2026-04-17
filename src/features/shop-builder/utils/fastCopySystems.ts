import type { ShopBuilderSlatWall, ShopBuilderWall } from '../types';

type WallFaceSide = 'front' | 'back';

const isWallFaceSide = (side: unknown): side is WallFaceSide => side === 'front' || side === 'back';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wallLength = (wall: ShopBuilderWall) => Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);

export const cloneSlatSystemForSide = (
  source: ShopBuilderSlatWall,
  side: WallFaceSide,
  reflectX = false
): ShopBuilderSlatWall => {
  const clonedAccessories = (source.accessories || []).map((acc) => ({
    ...acc,
    id: crypto.randomUUID(),
    position: {
      ...(acc.position || { x: 0.5, y: 0.5 }),
      x: reflectX ? 1 - (acc.position?.x ?? 0.5) : (acc.position?.x ?? 0.5),
    },
  }));

  const sourcePosX = source.position ?? 0.5;

  return {
    ...source,
    id: crypto.randomUUID(),
    position: reflectX ? 1 - sourcePosX : sourcePosX,
    side,
    accessories: clonedAccessories,
  };
};

export const copySourceWallSystemsToAllWalls = (
  walls: ShopBuilderWall[],
  sourceWallId: string
): {
  walls: ShopBuilderWall[];
  copiedWallsCount: number;
  sourceSystemsCount: number;
} => {
  const sourceWall = walls.find((w) => w.id === sourceWallId);
  if (!sourceWall) {
    return { walls, copiedWallsCount: 0, sourceSystemsCount: 0 };
  }

  const sourceSystems = (sourceWall.slatWalls || []).filter((s) => isWallFaceSide(s.side));
  if (sourceSystems.length === 0) {
    return { walls, copiedWallsCount: 0, sourceSystemsCount: 0 };
  }

  let copiedWallsCount = 0;

  const nextWalls = walls.map((wall) => {
    if (wall.id === sourceWallId) return wall;
    // Skip doors — they can't host display systems
    if (wall.texture?.startsWith('door_')) return wall;
    copiedWallsCount += 1;

    const kept = (wall.slatWalls || []).filter((s) => !isWallFaceSide(s.side));
    const cloned = sourceSystems.map((system) => ({
      ...cloneSlatSystemForSide(system, (system.side as WallFaceSide) || 'front', false),
      wallId: wall.id,
    }));

    return {
      ...wall,
      slatWalls: [...kept, ...cloned],
    };
  });

  return {
    walls: nextWalls,
    copiedWallsCount,
    sourceSystemsCount: sourceSystems.length,
  };
};

export const copySourceWallSystemsToTargets = (
  walls: ShopBuilderWall[],
  sourceWallId: string,
  targetWallIds: string[],
  options?: { copyBothSides?: boolean; sourceSide?: WallFaceSide }
): {
  walls: ShopBuilderWall[];
  copiedWallsCount: number;
  sourceSystemsCount: number;
} => {
  const sourceWall = walls.find((w) => w.id === sourceWallId);
  if (!sourceWall) {
    return { walls, copiedWallsCount: 0, sourceSystemsCount: 0 };
  }

  const copyBothSides = options?.copyBothSides ?? true;
  const sourceSide = options?.sourceSide ?? 'front';
  const validTargets = new Set(targetWallIds.filter((id) => id !== sourceWallId));

  if (validTargets.size === 0) {
    return { walls, copiedWallsCount: 0, sourceSystemsCount: 0 };
  }

  const sourceSystemsAll = (sourceWall.slatWalls || []).filter((s) => isWallFaceSide(s.side));
  const sourceSystems = copyBothSides
    ? sourceSystemsAll
    : sourceSystemsAll.filter((s) => s.side === sourceSide);

  if (sourceSystems.length === 0) {
    return { walls, copiedWallsCount: 0, sourceSystemsCount: 0 };
  }

  let copiedWallsCount = 0;
  const destinationSides = copyBothSides ? new Set<WallFaceSide>(['front', 'back']) : new Set<WallFaceSide>([sourceSide]);
  const sourceWallLength = Math.max(0.001, wallLength(sourceWall));
  const sourceWallHeight = Math.max(0.001, sourceWall.height || 3);

  const nextWalls = walls.map((wall) => {
    if (!validTargets.has(wall.id)) return wall;
    // Skip doors — they can't host display systems
    if (wall.texture?.startsWith('door_')) return wall;
    copiedWallsCount += 1;

    const targetWallLength = Math.max(0.001, wallLength(wall));
    const targetWallHeight = Math.max(0.001, wall.height || 3);
    const lengthRatio = targetWallLength / sourceWallLength;
    const heightRatio = targetWallHeight / sourceWallHeight;

    const kept = (wall.slatWalls || []).filter((s) => !isWallFaceSide(s.side) || !destinationSides.has(s.side));
    const cloned = sourceSystems.map((system) => ({
      ...(() => {
        const clonedSystem = cloneSlatSystemForSide(system, (system.side as WallFaceSide) || sourceSide, false);

        const scaledHeight = clamp((system.height || 1) * heightRatio, 0.1, targetWallHeight);
        const scaledBottom = clamp((system.bottomOffset || 0) * heightRatio, 0, Math.max(0, targetWallHeight - scaledHeight));

        const scaledWidth =
          system.fillType === 'full'
            ? undefined
            : clamp((system.width || 1) * lengthRatio, 0.1, targetWallLength);

        return {
          ...clonedSystem,
          wallId: wall.id,
          height: scaledHeight,
          bottomOffset: scaledBottom,
          width: scaledWidth,
          accessories: (clonedSystem.accessories || []).map((acc) => ({
            ...acc,
            width: clamp((acc.width || 0.3) * lengthRatio, 0.05, targetWallLength),
            // Depth is visual/fixture depth, keep mostly stable with light scaling cap.
            depth: clamp((acc.depth || 0.2) * Math.min(lengthRatio, 1.35), 0.05, 1.6),
            position: {
              x: clamp(acc.position?.x ?? 0.5, 0, 1),
              y: clamp(acc.position?.y ?? 0.5, 0, 1),
            },
          })),
        };
      })(),
    }));

    return {
      ...wall,
      slatWalls: [...kept, ...cloned],
    };
  });

  return {
    walls: nextWalls,
    copiedWallsCount,
    sourceSystemsCount: sourceSystems.length,
  };
};
