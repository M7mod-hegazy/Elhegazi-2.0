import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type ShopBuilderLayout,
  type ShopBuilderProduct,
  type ShopBuilderWall,
  type ShopBuilderColumn,
  type ShopBuilderSlatWall,
  type ShopBuilderCameraState,
} from './types';
import { apiGet } from '@/lib/api';
import type { ShopBuilderSlatAccessory } from './types';

const STORAGE_KEY = 'shop-builder-design';

export type CameraMode = 'orbit' | 'freeMove';

interface ShopBuilderContextValue {
  layout: ShopBuilderLayout;
  selectedProductId: string | null;
  selectedWallId: string | null;
  selectedColumnId: string | null;
  selectedSlatWallId: string | null;
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
  setGlobalWallTexture: (texture: string) => void;
  upsertWall: (wall: Partial<ShopBuilderWall> & { id?: string }) => string;
  removeWall: (id: string) => void;
  upsertProduct: (product: Partial<ShopBuilderProduct> & { id?: string }) => string;
  removeProduct: (id: string) => void;
  addColumnToWall: (wallId: string, position?: number, side?: 'front' | 'back') => string;
  updateColumn: (wallId: string, columnId: string, updates: Partial<ShopBuilderColumn>) => void;
  removeColumn: (wallId: string, columnId: string) => void;
  selectProduct: (id: string | null) => void;
  selectWall: (id: string | null) => void;
  selectColumn: (id: string | null) => void;
  selectSlatWall: (id: string | null) => void;
  addSlatWallToWall: (wallId: string, side?: 'front' | 'back') => string;
  updateSlatWall: (wallId: string, slatWallId: string, updates: Partial<ShopBuilderSlatWall>) => void;
  removeSlatWall: (wallId: string, slatWallId: string) => void;
  addAccessoryToSlat: (wallId: string, slatWallId: string, type?: 'shelf' | 'hook_single' | 'hook_waterfall' | 'basket') => string;
  updateAccessory: (wallId: string, slatWallId: string, accessoryId: string, updates: Partial<ShopBuilderSlatAccessory>) => void;
  removeAccessory: (wallId: string, slatWallId: string, accessoryId: string) => void;
  importLayout: (next: ShopBuilderLayout) => void;
  exportLayout: () => ShopBuilderLayout;
  exportToFile: () => void;
  importFromFile: (file: File) => Promise<void>;
  reset: () => void;
}

const defaultLayout: ShopBuilderLayout = {
  walls: [],
  products: [],
};

const ShopBuilderContext = createContext<ShopBuilderContextValue | undefined>(undefined);

const now = () => new Date().toISOString();

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
      

      return parsed;
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
          
          // Always apply defaults from MongoDB to localStorage
          // This ensures settings saved in admin panel take effect on the main site
          setLayout((prev) => {
            const updated = {
              ...prev,
              floorTexture: floorTexture || 'tiles_white',
              defaultWallTexture: wallTexture || 'painted_white',
              defaultWallColor: wallColor || '#ffffff',
            };
            
            // Save to localStorage so defaults persist
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
    }
  }, []);

  // Auto-save to localStorage whenever layout changes
  useEffect(() => {
    saveToStorage(layout);
  }, [layout]);

  const setWalls = useCallback((walls: ShopBuilderWall[]) => {
    setLayout((prev) => ({ ...prev, walls, updatedAt: now() }));
  }, []);

  const setProducts = useCallback((products: ShopBuilderProduct[]) => {
    setLayout((prev) => ({ ...prev, products, updatedAt: now() }));
  }, []);

  const setCamera = useCallback((camera: ShopBuilderCameraState) => {
    setLayout((prev) => ({ ...prev, camera, updatedAt: now() }));
  }, []);

  const setFloorTexture = useCallback((texture: string) => {
    setLayout((prev) => ({ ...prev, floorTexture: texture, updatedAt: now() }));
  }, []);

  const setFloorSize = useCallback((size: number) => {
    setLayout((prev) => ({ ...prev, floorSize: size, updatedAt: now() }));
  }, []);

  const setGlobalWallTexture = useCallback((texture: string) => {
    setLayout((prev) => ({
      ...prev,
      walls: prev.walls.map(wall => ({ ...wall, texture: texture as any })),
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
        color: prev.defaultWallColor || '#ffffff',
        ...existingWall,  // Merge existing wall data first
        ...wall,          // Then apply updates
      } as ShopBuilderWall;

      const walls = existingWall
        ? prev.walls.map((w) => (w.id === id ? nextWall : w))
        : [...prev.walls, nextWall];

      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedWallId(id);
    return id;
  }, []);

  const removeWall = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      walls: prev.walls.filter((w) => w.id !== id),
      updatedAt: now(),
    }));
    setSelectedWallId((current) => (current === id ? null : current));
  }, []);

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
    // Allow multi-selection: Don't auto-deselect other items
    // Users can click empty space to deselect all
  }, []);

  const selectWall = useCallback((id: string | null) => {
    setSelectedWallId(id);
    // Allow multi-selection: Don't auto-deselect other items
    // Users can click empty space to deselect all
  }, []);

  const selectColumn = useCallback((id: string | null) => {
    setSelectedColumnId(id);
    // Allow multi-selection: Don't auto-deselect other items
    // Users can click empty space to deselect all
  }, []);

  // Column management functions
  const addColumnToWall = useCallback((wallId: string, position: number = 0.5, side: 'front' | 'back' = 'front') => {
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
            side, // Use the provided side

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

  // Slat Wall management
  const selectSlatWall = useCallback((id: string | null) => {
    setSelectedSlatWallId(id);
  }, []);

  const addSlatWallToWall = useCallback((targetId: string, side: 'front' | 'back' = 'front') => {
    const slatWallId = crypto.randomUUID();
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === targetId) {
          const newSlatWall: ShopBuilderSlatWall = {
             id: slatWallId,
             wallId: targetId,
             side,
             fillType: 'full',
             height: wall.height,
             bottomOffset: 0,
             color: '#f5f5f5', 
             slatSpacing: 0.15, 
          };
          return { ...wall, slatWalls: [...(wall.slatWalls || []), newSlatWall] };
        } else if (wall.columns?.some(c => c.id === targetId)) {
           return {
              ...wall,
              columns: wall.columns.map(col => {
                 if (col.id === targetId) {
                    const newSlatWall: ShopBuilderSlatWall = {
                       id: slatWallId,
                       wallId: targetId,
                       side,
                       fillType: 'full',
                       height: col.height,
                       bottomOffset: 0,
                       color: '#f5f5f5',
                       slatSpacing: 0.15,
                    };
                    return { ...col, slatWalls: [...(col.slatWalls || []), newSlatWall] };
                 }
                 return col;
              })
           };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedSlatWallId(slatWallId);
    return slatWallId;
  }, []);

  const updateSlatWall = useCallback((targetId: string, slatWallId: string, updates: Partial<ShopBuilderSlatWall>) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === targetId && wall.slatWalls) {
          return {
            ...wall,
            slatWalls: wall.slatWalls.map((slat) => slat.id === slatWallId ? { ...slat, ...updates } : slat),
          };
        } else if (wall.columns?.some(c => c.id === targetId)) {
           return {
              ...wall,
              columns: wall.columns.map(col => {
                 if (col.id === targetId && col.slatWalls) {
                    return { ...col, slatWalls: col.slatWalls.map(slat => slat.id === slatWallId ? { ...slat, ...updates } : slat) };
                 }
                 return col;
              })
           }
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removeSlatWall = useCallback((targetId: string, slatWallId: string) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        if (wall.id === targetId && wall.slatWalls) {
          return { ...wall, slatWalls: wall.slatWalls.filter((slat) => slat.id !== slatWallId) };
        } else if (wall.columns?.some(c => c.id === targetId)) {
           return {
              ...wall,
              columns: wall.columns.map(col => {
                 if (col.id === targetId && col.slatWalls) {
                    return { ...col, slatWalls: col.slatWalls.filter(slat => slat.id !== slatWallId) };
                 }
                 return col;
              })
           }
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    setSelectedSlatWallId((current) => (current === slatWallId ? null : current));
  }, []);

  const addAccessoryToSlat = useCallback((targetId: string, slatWallId: string, type: 'shelf' | 'hook_single' | 'hook_waterfall' | 'basket' = 'shelf') => {
    const accessoryId = crypto.randomUUID();
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
        
        const mapSlat = (slat: ShopBuilderSlatWall) => {
           if (slat.id === slatWallId) {
              const defaultColor = type === 'shelf' ? '#d97706' : '#e5e7eb';
              const defaultWidth = type === 'shelf' ? 0.8 : 0.05;
              const defaultDepth = type === 'hook_waterfall' ? 0.4 : type === 'hook_single' ? 0.2 : 0.3;
              return {
                 ...slat,
                 accessories: [...(slat.accessories || []), { id: accessoryId, type, position: { x: 0.5, y: 0.5 }, width: defaultWidth, depth: defaultDepth, color: defaultColor }]
              }
           }
           return slat;
        };

        if (wall.id === targetId && wall.slatWalls) {
          return { ...wall, slatWalls: wall.slatWalls.map(mapSlat) };
        } else if (wall.columns?.some(c => c.id === targetId)) {
           return { ...wall, columns: wall.columns.map(col => col.id === targetId && col.slatWalls ? { ...col, slatWalls: col.slatWalls.map(mapSlat) } : col) };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
    return accessoryId;
  }, []);

  const updateAccessory = useCallback((targetId: string, slatWallId: string, accessoryId: string, updates: Partial<ShopBuilderSlatAccessory>) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
         const mapSlat = (slat: ShopBuilderSlatWall) => {
            if (slat.id === slatWallId && slat.accessories) {
               return { ...slat, accessories: slat.accessories.map(acc => acc.id === accessoryId ? { ...acc, ...updates } : acc) };
            }
            return slat;
         };

        if (wall.id === targetId && wall.slatWalls) {
          return { ...wall, slatWalls: wall.slatWalls.map(mapSlat) };
        } else if (wall.columns?.some(c => c.id === targetId)) {
          return { ...wall, columns: wall.columns.map(col => col.id === targetId && col.slatWalls ? { ...col, slatWalls: col.slatWalls.map(mapSlat) } : col) };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const removeAccessory = useCallback((targetId: string, slatWallId: string, accessoryId: string) => {
    setLayout((prev) => {
      const walls = prev.walls.map((wall) => {
         const mapSlat = (slat: ShopBuilderSlatWall) => {
            if (slat.id === slatWallId && slat.accessories) {
               return { ...slat, accessories: slat.accessories.filter(acc => acc.id !== accessoryId) };
            }
            return slat;
         };

        if (wall.id === targetId && wall.slatWalls) {
          return { ...wall, slatWalls: wall.slatWalls.map(mapSlat) };
        } else if (wall.columns?.some(c => c.id === targetId)) {
          return { ...wall, columns: wall.columns.map(col => col.id === targetId && col.slatWalls ? { ...col, slatWalls: col.slatWalls.map(mapSlat) } : col) };
        }
        return wall;
      });
      return { ...prev, walls, updatedAt: now() };
    });
  }, []);

  const importLayout = useCallback((next: ShopBuilderLayout) => {
    setLayout({
      ...next,
      createdAt: next.createdAt ?? now(),
      updatedAt: now(),
    });
    setSelectedProductId(null);
    setSelectedWallId(null);
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
    localStorage.removeItem(STORAGE_KEY);

  }, []);

  const value = useMemo<ShopBuilderContextValue>(() => ({
    layout,
    selectedProductId,
    selectedWallId,
    selectedColumnId,
    selectedSlatWallId,
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
    selectSlatWall,
    addSlatWallToWall,
    updateSlatWall,
    removeSlatWall,
    addAccessoryToSlat,
    updateAccessory,
    removeAccessory,
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
    isDrawingMode,
    setDrawingMode,
    cameraMode,
    defaultWallThickness,
    selectProduct,
    selectWall,
    selectColumn,
    selectSlatWall,
    addSlatWallToWall,
    updateSlatWall,
    removeSlatWall,
    setCamera,
    setFloorTexture,
    setFloorSize,
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
