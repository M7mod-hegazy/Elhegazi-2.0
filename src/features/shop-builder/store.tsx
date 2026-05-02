import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type ShopBuilderLayout,
  type ShopBuilderProduct,
  type ShopBuilderWall,
  type ShopBuilderColumn,
  type ShopBuilderCameraState,
} from './types';
import { findShopEnclosurePolygon } from './utils/enclosedShopPolygon';
import { apiGet } from '@/lib/api';

const STORAGE_KEY = 'shop-builder-design';

export type CameraMode = 'orbit' | 'freeMove';

interface ShopBuilderContextValue {
  layout: ShopBuilderLayout;
  selectedProductId: string | null;
  selectedWallId: string | null;
  selectedColumnId: string | null;
  isDrawingMode: boolean;
  setDrawingMode: (enabled: boolean) => void;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  defaultWallThickness: number;
  setDefaultWallThickness: (thickness: number) => void;
  setWalls: (walls: ShopBuilderWall[]) => void;
  setProducts: (products: ShopBuilderProduct[]) => void;
  setCamera: (camera: ShopBuilderCameraState) => void;
  setFloorTexture: (texture: string) => void;
  setFloorSize: (size: number) => void;
  /** Set tint for enclosed shop floor; pass fromUser: true when the user picks a color. */
  setInteriorFloorTint: (color: string | undefined, options?: { fromUser?: boolean }) => void;
  /** Allow auto-detection to set interior floor tint again. */
  resetInteriorFloorTintAuto: () => void;
  setGlobalWallTexture: (texture: string) => void;
  upsertWall: (wall: Partial<ShopBuilderWall> & { id?: string }) => string;
  removeWall: (id: string) => void;
  upsertProduct: (product: Partial<ShopBuilderProduct> & { id?: string }) => string;
  removeProduct: (id: string) => void;
  addColumnToWall: (wallId: string, position?: number) => string;
  updateColumn: (wallId: string, columnId: string, updates: Partial<ShopBuilderColumn>) => void;
  removeColumn: (wallId: string, columnId: string) => void;
  selectProduct: (id: string | null) => void;
  selectWall: (id: string | null) => void;
  selectColumn: (id: string | null) => void;
  importLayout: (next: ShopBuilderLayout) => void;
  exportLayout: () => ShopBuilderLayout;
  exportToFile: () => void;
  importFromFile: (file: File) => Promise<void>;
  reset: () => void;
  
  // SlatWall and Accessory Management
  selectedSlatWallId: string | null;
  selectSlatWall: (id: string | null) => void;
  addSlatWallToWall: (wallId: string, side: 'front'|'back') => string;
  updateSlatWall: (wallId: string, slatId: string, updates: any) => void;
  removeSlatWall: (wallId: string, slatId: string) => void;
  addAccessoryToSlat: (wallId: string, slatId: string, type: string) => string;
  updateAccessory: (wallId: string, slatId: string, accId: string, updates: any) => void;
  removeAccessory: (wallId: string, slatId: string, accId: string) => void;

  selectedPrimoStandId: string | null;
  selectPrimoStand: (id: string | null) => void;
  addPrimoStandToWall: (wallId: string, side: 'front'|'back') => string;
  updatePrimoStand: (wallId: string, primoId: string, updates: any) => void;
  removePrimoStand: (wallId: string, primoId: string) => void;
  addAccessoryToPrimo: (wallId: string, primoId: string, type: string) => string;
  updatePrimoAccessory: (wallId: string, primoId: string, accId: string, updates: any) => void;
  removePrimoAccessory: (wallId: string, primoId: string, accId: string) => void;
}

const defaultLayout: ShopBuilderLayout = {
  walls: [],
  products: [],
};

const ShopBuilderContext = createContext<ShopBuilderContextValue | undefined>(undefined);

const now = () => new Date().toISOString();
const AUTO_INTERIOR_FLOOR_HEX = '#dbeafe';
const normalizeColumnSide = (side: unknown): 'front' | 'back' => {
  if (side === 'back' || side === 'right') return 'back';
  return 'front';
};
const normalizeLayoutColumns = (input: ShopBuilderLayout): ShopBuilderLayout => ({
  ...input,
  walls: (input.walls || []).map((wall) => ({
    ...wall,
    columns: (wall.columns || []).map((column) => ({
      ...column,
      side: normalizeColumnSide((column as any).side),
    })),
  })),
});

// Load from localStorage
const loadFromStorage = (): ShopBuilderLayout | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Clean up invalid products (without model URLs)
      if (parsed.products && Array.isArray(parsed.products)) {
        const validProducts = parsed.products.filter((p: any) => {
          const hasValidUrl = p.modelUrl && p.modelUrl.trim() !== '';
          if (!hasValidUrl) {
            console.warn('⚠️ Removing invalid product without model URL:', p.name);
          }
          return hasValidUrl;
        });
        
        if (validProducts.length !== parsed.products.length) {
          parsed.products = validProducts;

          // Save cleaned version
          saveToStorage(parsed);
        }
      }
      

      return normalizeLayoutColumns(parsed);
    }
  } catch (error) {
    console.error('❌ Failed to load design from localStorage:', error);
  }
  return null;
};

// Save to localStorage
const saveToStorage = (layout: ShopBuilderLayout) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));

  } catch (error) {
    console.error('❌ Failed to save design to localStorage:', error);
  }
};

interface ShopBuilderProviderProps {
  children: ReactNode;
  initialShopData?: {
    shopName?: string;
    field?: string;
    ownerName?: string;
    phone?: string;
  };
}

export const ShopBuilderProvider = ({ children, initialShopData }: ShopBuilderProviderProps): JSX.Element => {
  const [layout, setLayout] = useState<ShopBuilderLayout>(() => {
    const stored = loadFromStorage();
    if (stored) {
      return stored;
    }
    return {
      ...defaultLayout,
      shopName: initialShopData?.shopName || '',
      field: initialShopData?.field || '',
      createdAt: now(),
      updatedAt: now(),
    };
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedSlatWallId, setSelectedSlatWallId] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [defaultWallThickness, setDefaultWallThickness] = useState(0.20); // Default 20cm
  
  // Load defaults from MongoDB on mount and apply to localStorage
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await apiGet('/api/settings');
        const settings = (response as any).item || (response as any).settings || response;
        
        if (settings && settings.shopBuilderDefaults) {
          const { floorTexture, wallTexture, wallColor } = settings.shopBuilderDefaults;
          
          // Apply defaults - ONLY set if not already in localStorage or if it's a fresh load
          setLayout((prev) => {
            const needsFloor = !prev.floorTexture || prev.floorTexture === 'tiles_white';
            const needsWallTex = !prev.defaultWallTexture || prev.defaultWallTexture === 'painted_white';
            const needsWallCol = !prev.defaultWallColor || prev.defaultWallColor === '#ffffff';
            
            const updated = {
              ...prev,
              floorTexture: needsFloor ? (floorTexture || 'tiles_white') : prev.floorTexture,
              defaultWallTexture: needsWallTex ? (wallTexture || 'painted_white') : prev.defaultWallTexture,
              defaultWallColor: needsWallCol ? (wallColor || '#ffffff') : prev.defaultWallColor,
            };
            
            // Always save to localStorage so defaults persist
            saveToStorage(updated);
            
            return updated;
          });
        }
      } catch (error) {
        console.error('Failed to load shop builder defaults:', error);
      }
    };
    
    loadDefaults();
  }, []);
  
  const setDrawingMode = useCallback((enabled: boolean) => {
    setIsDrawingMode(enabled);
    // Clear selections when entering drawing mode
    if (enabled) {
      setSelectedProductId(null);
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setSelectedSlatWallId(null);
      setSelectedPrimoStandId(null);
    }
  }, []);

  // Auto-save to localStorage whenever layout changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveToStorage(layout);
    }, 800);
    return () => clearTimeout(timeout);
  }, [layout]);

  // Helper to compute interior floor tint dynamically during wall updates
  const computeNextLayoutWithFloorTint = useCallback((prev: ShopBuilderLayout, newWalls: ShopBuilderWall[]): ShopBuilderLayout => {
    let nextColor = prev.interiorFloorColor;
    if (!prev.interiorFloorColorUserOverride) {
      const hit = findShopEnclosurePolygon(newWalls);
      nextColor = hit ? AUTO_INTERIOR_FLOOR_HEX : undefined;
    }
    return { ...prev, walls: newWalls, interiorFloorColor: nextColor, updatedAt: now() };
  }, []);

  const setWalls = useCallback((walls: ShopBuilderWall[]) => {
    setLayout((prev) => computeNextLayoutWithFloorTint(prev, walls));
  }, [computeNextLayoutWithFloorTint]);

  const setProducts = useCallback((products: ShopBuilderProduct[]) => {
    setLayout((prev) => ({ ...prev, products, updatedAt: now() }));
  }, []);

  const setCamera = useCallback((camera: ShopBuilderCameraState) => {
    // Camera is ephemeral — do NOT set updatedAt to avoid triggering save chains
    setLayout((prev) => ({ ...prev, camera }));
  }, []);

  const setFloorTexture = useCallback((texture: string) => {
    setLayout((prev) => ({ ...prev, floorTexture: texture, updatedAt: now() }));
  }, []);

  const setFloorSize = useCallback((size: number) => {
    setLayout((prev) => ({ ...prev, floorSize: size, updatedAt: now() }));
  }, []);

  const setInteriorFloorTint = useCallback((color: string | undefined, options?: { fromUser?: boolean }) => {
    setLayout((prev) => ({
      ...prev,
      interiorFloorColor: color,
      ...(options?.fromUser ? { interiorFloorColorUserOverride: true } : {}),
      updatedAt: now(),
    }));
  }, []);

  const resetInteriorFloorTintAuto = useCallback(() => {
    setLayout((prev) => {
      const hit = findShopEnclosurePolygon(prev.walls);
      return {
        ...prev,
        interiorFloorColorUserOverride: false,
        interiorFloorColor: hit ? AUTO_INTERIOR_FLOOR_HEX : undefined,
        updatedAt: now(),
      };
    });
  }, []);

  const setGlobalWallTexture = useCallback((texture: string) => {
    setLayout((prev) => ({
      ...prev,
      // Keep door walls as doors; only apply global texture to regular walls.
      walls: prev.walls.map((wall) =>
        wall.texture?.startsWith('door_')
          ? wall
          : ({ ...wall, texture: texture as any })
      ),
      defaultWallTexture: texture, // Store as default for new walls
      updatedAt: now()
    }));
  }, []);

  const upsertWall = useCallback((wall: Partial<ShopBuilderWall> & { id?: string }) => {
    const id = wall.id ?? crypto.randomUUID();
    setLayout((prev) => {
      const existingWall = prev.walls.find((w) => w.id === id);
      const nextWall: ShopBuilderWall = {
        id,
        start: { x: 0, y: 0 },
        end: { x: 2, y: 0 },
        height: 2.4, // Reduced from 3m to 2.4m for better proportions
        thickness: 0.2,
        color: '#ffffff',
        ...existingWall,  // Merge existing wall data first
        ...wall,          // Then apply updates
      } as ShopBuilderWall;

      // Keep wall-attached columns visually in sync with the owning wall color.
      if (nextWall.columns?.length) {
        nextWall.columns = nextWall.columns.map((column) => ({
          ...column,
          color: nextWall.color,
        }));
      }

      const newWalls = existingWall 
        ? prev.walls.map((w) => (w.id === id ? nextWall : w))
        : [...prev.walls, nextWall];
        
      return computeNextLayoutWithFloorTint(prev, newWalls);
    });
    setSelectedWallId(id);
    return id;
  }, [computeNextLayoutWithFloorTint]);

  const removeWall = useCallback((id: string) => {
    setLayout((prev) => {
      const newWalls = prev.walls.filter((w) => w.id !== id);
      return computeNextLayoutWithFloorTint(prev, newWalls);
    });
    setSelectedWallId((current) => (current === id ? null : current));
  }, [computeNextLayoutWithFloorTint]);

  const upsertProduct = useCallback((product: Partial<ShopBuilderProduct> & { id?: string }) => {
    const id = product.id ?? crypto.randomUUID();
    setLayout((prev) => {
      // Find existing product to preserve all properties
      const existing = prev.products.find((p) => p.id === id);
      
      const nextProduct: ShopBuilderProduct = {
        // Default values for new products
        name: 'منتج جديد',
        modelUrl: '',
        position: { x: 0, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        // Spread existing product to preserve all properties
        ...existing,
        // Apply updates (this will override defaults and existing)
        ...product,
        // Ensure ID is always set correctly
        id,
      } as ShopBuilderProduct;

      const products = prev.products.some((p) => p.id === id)
        ? prev.products.map((p) => (p.id === id ? nextProduct : p))
        : [...prev.products, nextProduct];

      return { ...prev, products, updatedAt: now() };
    });
    setSelectedProductId(id);
    return id;
  }, []);

  const removeProduct = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
      updatedAt: now(),
    }));
    setSelectedProductId((current) => (current === id ? null : current));
  }, []);

  const selectProduct = useCallback((id: string | null) => {
    setSelectedProductId(id);
    if (id) {
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setSelectedSlatWallId(null);
      setSelectedPrimoStandId(null);
    }
  }, []);

  const selectWall = useCallback((id: string | null) => {
    setSelectedWallId(id);
    if (id) {
      setSelectedProductId(null);
      setSelectedColumnId(null);
      setSelectedSlatWallId(null);
      setSelectedPrimoStandId(null);
    }
  }, []);

  const selectColumn = useCallback((id: string | null) => {
    setSelectedColumnId(id);
    if (id) {
      setSelectedProductId(null);
      setSelectedWallId(null);
      setSelectedSlatWallId(null);
      setSelectedPrimoStandId(null);
    }
  }, []);

  // Column management functions
  const addColumnToWall = useCallback((wallId: string, position: number = 0.5) => {
    const columnId = crypto.randomUUID();
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === wallId) {
          const newColumn: ShopBuilderColumn = {
            id: columnId,
            wallId,
            position, // 0 to 1 along wall
            width: 0.3, // Default width (عرض) = 0.3m
            depth: 0.5, // Default depth (عمق) = 0.5m
            height: wall.height, // Match wall height
            shape: 'square',
            side: 'front', // Default side = front face
            color: wall.color, // Match wall color
          };
          return {
            ...wall,
            columns: [...(wall.columns || []), newColumn],
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedColumnId(columnId);
    return columnId;
  }, []);

  const updateColumn = useCallback((wallId: string, columnId: string, updates: Partial<ShopBuilderColumn>) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === wallId && wall.columns) {
          return {
            ...wall,
            columns: wall.columns.map((col) =>
              col.id === columnId ? { ...col, ...updates } : col
            ),
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removeColumn = useCallback((wallId: string, columnId: string) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === wallId && wall.columns) {
          return {
            ...wall,
            columns: wall.columns.filter((col) => col.id !== columnId),
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedColumnId((current) => (current === columnId ? null : current));
  }, []);

  const selectSlatWall = useCallback((id: string | null) => {
    setSelectedSlatWallId(id);
    if (id) {
      setSelectedProductId(null);
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setSelectedPrimoStandId(null);
    }
  }, []);

  const addSlatWallToWall = useCallback((wallId: string, side: 'front'|'back' = 'front') => {
    const slatId = crypto.randomUUID();
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId) {
          const newSlat = {
            id: slatId,
            wallId,
            side,
            fillType: 'full',
            // Full wall insert should occupy full wall height in 2D by default.
            height: wall.height || 2,
            bottomOffset: 0,
            color: '#f5f5f5',
            slatSpacing: 0.15,
            accessories: []
          };
          return {
            ...wall,
            slatWalls: [...(wall.slatWalls || []), newSlat as any]
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedSlatWallId(slatId);
    return slatId;
  }, []);

  const updateSlatWall = useCallback((wallId: string, slatId: string, updates: any) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.slatWalls) {
          return {
            ...wall,
            slatWalls: wall.slatWalls.map(s => s.id === slatId ? { ...s, ...updates } : s)
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removeSlatWall = useCallback((wallId: string, slatId: string) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.slatWalls) {
          return {
            ...wall,
            slatWalls: wall.slatWalls.filter(s => s.id !== slatId)
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedSlatWallId(current => current === slatId ? null : current);
  }, []);

  const addAccessoryToSlat = useCallback((wallId: string, slatId: string, type: string) => {
    const accId = crypto.randomUUID();
    let width = 0.6;
    let depth = 0.3;
    if (type === 'hook_single') { width = 0.05; depth = 0.2; }
    if (type === 'hook_waterfall') { width = 0.05; depth = 0.3; }
    if (type === 'basket') { width = 0.6; depth = 0.4; }

    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.slatWalls) {
          return {
            ...wall,
            slatWalls: wall.slatWalls.map(slat => {
              if (slat.id === slatId) {
                let finalWidth = width;
                if (slat.systemType === 'primo' && type === 'shelf') {
                   finalWidth = slat.uprightSpacing || 0.8;
                }

                const existing = slat.accessories || [];
                const spacing = slat.slatSpacing || 0.15;
                const slatH = slat.height || 2;
                const railInterval = spacing / Math.max(0.01, slatH);
                const slatW = slat.fillType === 'full'
                  ? Math.hypot((wall.end.x - wall.start.x), (wall.end.y - wall.start.y))
                  : (slat.width || 1);
                const normalizedAccWidth = Math.max(0.01, finalWidth / Math.max(0.01, slatW));
                const halfW = Math.min(0.49, normalizedAccWidth / 2);

                let posX = 0.5;
                let posY = 0.5;
                const yCandidates: number[] = [];
                for (let y = 0.95; y >= 0.1; y -= railInterval) {
                  const snapped = Math.round(y / railInterval) * railInterval;
                  if (snapped >= 0.05 && snapped <= 0.95) yCandidates.push(Number(snapped.toFixed(4)));
                }

                if (slat.systemType === 'primo') {
                  const uprightSpacing = Math.max(0.2, slat.uprightSpacing || 0.8);
                  const baysCount = Math.max(1, Math.round(slatW / uprightSpacing));
                  const baySpacing = 1 / baysCount;
                  const xAnchors = type === 'shelf'
                    ? Array.from({ length: baysCount }, (_, i) => Number(((i + 0.5) * baySpacing).toFixed(4)))
                    : Array.from({ length: baysCount + 1 }, (_, i) => Number((i * baySpacing).toFixed(4)));
                  xAnchors.sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));

                  let placed = false;
                  for (const testY of yCandidates) {
                    for (const testX of xAnchors) {
                      const occupied = existing.some((a: any) => {
                        const sameGroup = type === 'shelf' ? a.type === 'shelf' : a.type !== 'shelf';
                        if (!sameGroup) return false;
                        const aWNorm = Math.max(0.01, (a.width || 0.05) / Math.max(0.01, slatW));
                        const xOverlap = Math.abs((a.position?.x ?? 0.5) - testX) < ((aWNorm + normalizedAccWidth) / 2) * 0.9;
                        const yOverlap = Math.abs((a.position?.y ?? 0.5) - testY) < railInterval * 1.1;
                        return xOverlap && yOverlap;
                      });
                      const blockedByShelfRow = type !== 'shelf' && existing.some((a: any) =>
                        a.type === 'shelf' && Math.abs((a.position?.y ?? 0.5) - testY) < railInterval * 0.95
                      );
                      if (!occupied && !blockedByShelfRow) {
                        posX = testX;
                        posY = testY;
                        placed = true;
                        break;
                      }
                    }
                    if (placed) break;
                  }
                } else {
                  // Smart free-slot placement across both X and Y (not always center).
                  const xStep = type === 'hook_single' || type === 'hook_waterfall'
                    ? 0.08
                    : Math.max(0.12, normalizedAccWidth * 1.1);
                  const xCandidates: number[] = [];
                  for (let x = halfW; x <= 1 - halfW + 1e-6; x += xStep) {
                    xCandidates.push(Number(x.toFixed(4)));
                  }
                  xCandidates.sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));

                  let placed = false;
                  for (const testY of yCandidates) {
                    for (const testX of xCandidates) {
                      const occupied = existing.some((a: any) => {
                        const aWNorm = Math.max(0.01, (a.width || 0.05) / Math.max(0.01, slatW));
                        const xOverlap = Math.abs((a.position?.x ?? 0.5) - testX) < ((aWNorm + normalizedAccWidth) / 2) * 0.95;
                        const yOverlap = Math.abs((a.position?.y ?? 0.5) - testY) < railInterval * 0.9;
                        return xOverlap && yOverlap;
                      });
                      if (!occupied) {
                        posX = testX;
                        posY = testY;
                        placed = true;
                        break;
                      }
                    }
                    if (placed) break;
                  }
                }

                const newAcc = {
                  id: accId,
                  type,
                  position: { x: posX, y: posY },
                  width: finalWidth,
                  depth,
                  color: type === 'shelf' ? '#d97706' : '#94a3b8'
                };
                return {
                  ...slat,
                  accessories: [...existing, newAcc as any]
                };
              }
              return slat;
            })
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    return accId;
  }, []);

  const updateAccessory = useCallback((wallId: string, slatId: string, accId: string, updates: any) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.slatWalls) {
          return {
            ...wall,
            slatWalls: wall.slatWalls.map(slat => {
              if (slat.id === slatId && slat.accessories) {
                 return {
                   ...slat,
                   accessories: slat.accessories.map((a: any) => a.id === accId ? { ...a, ...updates } : a)
                 };
              }
              return slat;
            })
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removeAccessory = useCallback((wallId: string, slatId: string, accId: string) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.slatWalls) {
           return {
             ...wall,
             slatWalls: wall.slatWalls.map(slat => {
               if (slat.id === slatId && slat.accessories) {
                 return {
                   ...slat,
                   accessories: slat.accessories.filter((a: any) => a.id !== accId)
                 };
               }
               return slat;
             })
           };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const [selectedPrimoStandId, setSelectedPrimoStandId] = useState<string | null>(null);

  const selectPrimoStand = useCallback((id: string | null) => {
    setSelectedPrimoStandId(id);
    if (id) {
      setSelectedProductId(null);
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setSelectedSlatWallId(null);
    }
  }, []);

  const addPrimoStandToWall = useCallback((wallId: string, side: 'front'|'back' = 'front') => {
    const primoId = crypto.randomUUID();
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId) {
          const newPrimo = {
            id: primoId,
            wallId,
            side,
            fillType: 'full',
            height: 2,
            bottomOffset: 0,
            color: '#94a3b8',
            uprightSpacing: 0.8,
            systemType: 'primo',
            accessories: []
          };
          return {
            ...wall,
            primoStands: [...(wall.primoStands || []), newPrimo as any]
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedPrimoStandId(primoId);
    return primoId;
  }, []);

  const updatePrimoStand = useCallback((wallId: string, primoId: string, updates: any) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.primoStands) {
          return {
            ...wall,
            primoStands: wall.primoStands.map(s => s.id === primoId ? { ...s, ...updates } : s)
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removePrimoStand = useCallback((wallId: string, primoId: string) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.primoStands) {
          return {
            ...wall,
            primoStands: wall.primoStands.filter(s => s.id !== primoId)
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedPrimoStandId(current => current === primoId ? null : current);
  }, []);

  const addAccessoryToPrimo = useCallback((wallId: string, primoId: string, type: string) => {
    const accId = crypto.randomUUID();
    let width = 0.6;
    let depth = 0.3;
    if (type === 'hook_single') { width = 0.05; depth = 0.2; }
    if (type === 'hook_waterfall') { width = 0.05; depth = 0.3; }
    if (type === 'basket') { width = 0.6; depth = 0.4; }

    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.primoStands) {
          return {
            ...wall,
            primoStands: wall.primoStands.map(primo => {
              if (primo.id === primoId) {
                const uprightSp = primo.uprightSpacing || 0.8;
                const primoWidth = primo.fillType === 'full' 
                  ? Math.hypot(
                      (wall.end.x - wall.start.x),
                      (wall.end.y - wall.start.y)
                    )
                  : (primo.width || 1);
                const baysCount = Math.max(1, Math.ceil(primoWidth / uprightSp));
                const baySpacing = 1 / baysCount;

                let finalWidth = width;
                if (type === 'shelf') {
                   finalWidth = uprightSp;
                }

                const existing = primo.accessories || [];

                // Find first non-occupied position
                let posX = 0.5;
                let posY = 0.5;

                if (type === 'shelf') {
                  // Shelves go in bay centers: 0.5*baySpacing, 1.5*baySpacing, etc.
                  // Find first bay without a shelf at this Y level
                  const ySlot = 0.05 / Math.max(0.01, primo.height || 2);
                  const existingShelves = existing.filter((a: any) => a.type === 'shelf');
                  
                  let placed = false;
                  for (let row = Math.floor(0.7 / ySlot); !placed; row--) {
                    if (row < 2) row = Math.floor(0.9 / ySlot); // wrap around
                    const testY = row * ySlot;
                    if (testY < 0.05 || testY > 0.95) continue;
                    
                    for (let bay = 0; bay < baysCount; bay++) {
                      const testX = (bay + 0.5) * baySpacing;
                      const occupied = existingShelves.some((s: any) => 
                        Math.abs(s.position.x - testX) < baySpacing * 0.5 && 
                        Math.abs(s.position.y - testY) < ySlot * 2
                      );
                      if (!occupied) {
                        posX = testX;
                        posY = testY;
                        placed = true;
                        break;
                      }
                    }
                    if (existingShelves.length > baysCount * 10) break; // safety
                  }
                } else {
                  // Hooks snap to uprights: 0, baySpacing, 2*baySpacing, ..., 1
                  const existingHooks = existing.filter((a: any) => a.type !== 'shelf');
                  const ySlot = 0.05 / Math.max(0.01, primo.height || 2);
                  
                  let placed = false;
                  for (let col = 0; col <= baysCount && !placed; col++) {
                    const testX = col * baySpacing;
                    for (let row = Math.floor(0.6 / ySlot); row > 1 && !placed; row--) {
                      const testY = row * ySlot;
                      if (testY < 0.05 || testY > 0.95) continue;
                      const occupied = existingHooks.some((h: any) =>
                        Math.abs(h.position.x - testX) < 0.01 &&
                        Math.abs(h.position.y - testY) < ySlot * 2
                      );
                      if (!occupied) {
                        posX = testX;
                        posY = testY;
                        placed = true;
                      }
                    }
                  }
                }

                const newAcc = {
                  id: accId,
                  type,
                  position: { x: posX, y: posY },
                  width: finalWidth,
                  depth,
                  color: type === 'shelf' ? '#d97706' : '#94a3b8'
                };
                return {
                  ...primo,
                  accessories: [...existing, newAcc as any]
                };
              }
              return primo;
            })
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    return accId;
  }, []);

  const updatePrimoAccessory = useCallback((wallId: string, primoId: string, accId: string, updates: any) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.primoStands) {
          return {
            ...wall,
            primoStands: wall.primoStands.map(primo => {
              if (primo.id === primoId && primo.accessories) {
                 return {
                   ...primo,
                   accessories: primo.accessories.map((a: any) => a.id === accId ? { ...a, ...updates } : a)
                 };
              }
              return primo;
            })
          };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removePrimoAccessory = useCallback((wallId: string, primoId: string, accId: string) => {
    setLayout(prev => {
      const walls = prev.walls.map(wall => {
        if (wall.id === wallId && wall.primoStands) {
           return {
             ...wall,
             primoStands: wall.primoStands.map(primo => {
               if (primo.id === primoId && primo.accessories) {
                 return {
                   ...primo,
                   accessories: primo.accessories.filter((a: any) => a.id !== accId)
                 };
               }
               return primo;
             })
           };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const importLayout = useCallback((next: ShopBuilderLayout | null | undefined) => {
    if (!next || typeof next !== 'object') {
      console.warn('Skipped importLayout: invalid payload', next);
      return;
    }

    const normalized = normalizeLayoutColumns(next);
    setLayout({
      ...normalized,
      createdAt: (next as any).createdAt ?? now(),
      updatedAt: now(),
    });
    setSelectedProductId(null);
    setSelectedWallId(null);
    setSelectedColumnId(null);
    setSelectedSlatWallId(null);
    setSelectedPrimoStandId(null);
  }, []);

  const exportLayout = useCallback(() => layout, [layout]);

  const exportToFile = useCallback(() => {
    const dataStr = JSON.stringify(layout, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shop-design-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }, [layout]);

  const importFromFile = useCallback(async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content);
          importLayout(imported);

          resolve();
        } catch (error) {
          console.error('❌ Failed to import design:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, [importLayout]);

  const reset = useCallback(() => {
    const timestamp = now();
    setLayout({ ...defaultLayout, createdAt: timestamp, updatedAt: timestamp });
    setSelectedProductId(null);
    setSelectedWallId(null);
    setSelectedColumnId(null);
    setSelectedSlatWallId(null);
    setSelectedPrimoStandId(null);
    localStorage.removeItem(STORAGE_KEY);

  }, []);

  const value = useMemo<ShopBuilderContextValue>(() => ({
    layout,
    selectedProductId,
    selectedWallId,
    selectedColumnId,
    isDrawingMode,
    setDrawingMode,
    cameraMode,
    setCameraMode,
    defaultWallThickness,
    setDefaultWallThickness,
    setWalls,
    setProducts,
    setCamera,
    setFloorTexture,
    setFloorSize,
    setInteriorFloorTint,
    resetInteriorFloorTintAuto,
    setGlobalWallTexture,
    upsertWall,
    removeWall,
    upsertProduct,
    removeProduct,
    addColumnToWall,
    updateColumn,
    removeColumn,
    selectProduct,
    selectWall,
    selectColumn,
    selectedSlatWallId,
    selectSlatWall,
    addSlatWallToWall,
    updateSlatWall,
    removeSlatWall,
    addAccessoryToSlat,
    updateAccessory,
    removeAccessory,

    selectedPrimoStandId,
    selectPrimoStand,
    addPrimoStandToWall,
    updatePrimoStand,
    removePrimoStand,
    addAccessoryToPrimo,
    updatePrimoAccessory,
    removePrimoAccessory,

    importLayout,
    exportLayout,
    exportToFile,
    importFromFile,
    reset,
  }), [
    exportLayout,
    exportToFile,
    importFromFile,
    importLayout,
    layout,
    removeProduct,
    removeWall,
    addColumnToWall,
    updateColumn,
    removeColumn,
    reset,
    selectedProductId,
    selectedWallId,
    selectedColumnId,
    selectedSlatWallId,
    selectSlatWall,
    addSlatWallToWall,
    updateSlatWall,
    removeSlatWall,
    addAccessoryToSlat,
    updateAccessory,
    removeAccessory,

    selectedPrimoStandId,
    selectPrimoStand,
    addPrimoStandToWall,
    updatePrimoStand,
    removePrimoStand,
    addAccessoryToPrimo,
    updatePrimoAccessory,
    removePrimoAccessory,

    selectedPrimoStandId,
    selectPrimoStand,
    addPrimoStandToWall,
    updatePrimoStand,
    removePrimoStand,
    addAccessoryToPrimo,
    updatePrimoAccessory,
    removePrimoAccessory,
    isDrawingMode,
    setDrawingMode,
    cameraMode,
    defaultWallThickness,
    selectProduct,
    selectWall,
    selectColumn,
    setCamera,
    setFloorTexture,
    setFloorSize,
    setInteriorFloorTint,
    resetInteriorFloorTintAuto,
    setGlobalWallTexture,
    setProducts,
    setWalls,
    upsertProduct,
    upsertWall,
  ]);

  return React.createElement(ShopBuilderContext.Provider, { value }, children);
};

export const useShopBuilder = () => {
  const ctx = useContext(ShopBuilderContext);
  if (!ctx) {
    throw new Error('useShopBuilder must be used within a ShopBuilderProvider');
  }
  return ctx;
};

export const useShopBuilderLayout = () => {
  const { layout } = useShopBuilder();
  if (!layout) {
    return { ...defaultLayout };
  }
  return layout;
};

