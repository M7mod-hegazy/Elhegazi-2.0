export interface ShopBuilderColumn {
  id: string;
  wallId: string; // Which wall this column is attached to
  position: number; // Position along wall (0 = start, 1 = end)
  width: number; // Column width (perpendicular to wall)
  depth: number; // Column depth (along wall)
  height: number; // Column height
  shape: 'square' | 'round' | 'rectangular';
  side: 'front' | 'back'; // Which wall face the column extends from
  color: string;
}

export interface ShopBuilderWall {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  height: number;
  thickness: number;
  color: string;
  texture?: 'painted_white' | 'painted_beige' | 'painted_rough' | 'wallpaper_damask' | 'brick_red' | 'brick_white' | 'concrete_smooth' | 'concrete_panels' | 'wood_planks' | 'wood_panels' | 'marble_white' | 'tiles_white' | 'tiles_ceramic' | 'stone_wall' | 'stone_blocks'; // Wall texture type
  columns?: ShopBuilderColumn[]; // Columns attached to this wall
  slatWalls?: ShopBuilderSlatWall[]; // Slat walls attached to this wall
  primoStands?: ShopBuilderPrimoStand[]; // Primo stands attached to this wall
}

export interface ShopBuilderProduct {
  id: string;
  name: string;
  description?: string;
  modelUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color?: string; // Product color
  texture?: string; // Product texture URL
  metadata?: Record<string, unknown>;
}

export interface ShopBuilderCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface ShopBuilderLayout {
  walls: ShopBuilderWall[];
  products: ShopBuilderProduct[];
  camera?: ShopBuilderCameraState;
  floorTexture?: string; // Floor texture type
  floorSize?: number; // Floor size in meters (default: 24)
  defaultWallTexture?: string; // Default wall texture for new walls
  defaultWallColor?: string; // Default wall color for new walls
  shopName?: string; // Shop display name
  field?: string; // Shop field/category
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopBuilderSlatAccessory {
  id: string;
  type: 'shelf' | 'hook_single' | 'hook_waterfall' | 'basket';
  position: { x: number; y: number }; // Relative position (0-1) on the slat wall
  width: number;
  depth: number;
  color?: string;
}

export interface ShopBuilderSlatWall {
  id: string;
  wallId: string;
  side: 'front' | 'back';
  systemType?: 'slat' | 'supermarket_shelves' | 'primo';
  fillType: 'full' | 'partial';
  position?: number; // 0-1 for partial
  width?: number; // for partial
  height: number;
  bottomOffset: number; // distance from floor
  color?: string;
  slatSpacing?: number; // distance between slats (for slat wall)
  shelfCount?: number; // for supermarket shelves
  shelfDepth?: number; // for supermarket shelves
  uprightSpacing?: number; // for primo stands (المسافة بين الأعمدة) - DEPRECATED
  accessories?: ShopBuilderSlatAccessory[];
}

export interface ShopBuilderPrimoAccessory {
  id: string;
  type: 'shelf' | 'hook_single' | 'hook_waterfall' | 'basket';
  position: { x: number; y: number }; // Relative position (0-1) on the stand
  width: number;
  depth: number;
  color?: string;
}

export interface ShopBuilderPrimoStand {
  id: string;
  wallId: string;
  side: 'front' | 'back';
  fillType: 'full' | 'partial';
  position?: number; // 0-1 for partial
  width?: number; // for partial
  height: number;
  bottomOffset: number; // distance from floor
  color?: string;
  systemType?: 'primo';
  uprightSpacing: number; // distance between columns (bays)
  accessories?: ShopBuilderPrimoAccessory[];
}
