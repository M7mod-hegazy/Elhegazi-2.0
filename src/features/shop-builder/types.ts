export interface ShopBuilderColumn {
  id: string;
  wallId: string; // Which wall this column is attached to
  position: number; // Position along wall (0 = start, 1 = end)
  width: number; // Column width (perpendicular to wall)
  depth: number; // Column depth (along wall)
  height: number; // Column height
  shape: 'square' | 'round' | 'rectangular';
  side: 'front' | 'back'; // Which face of the wall the column extends from
  color: string;
  slatWalls?: ShopBuilderSlatWall[]; // Slat walls attached to this column
}

export interface ShopBuilderSlatAccessory {
  id: string;
  type: 'shelf' | 'hook_single' | 'hook_waterfall' | 'basket';
  position: { x: number; y: number }; // local percentage coordinates on the slat wall (0-1)
  width: number; // width in meters
  depth: number; // depth/extrusion in meters
  color: string;
}

export interface ShopBuilderSlatWall {
  id: string;
  wallId: string;
  side: 'front' | 'back'; // Which face of the wall (based on start->end direction)
  systemType?: 'slat' | 'supermarket_shelves'; // Type of presentation system
  fillType: 'full' | 'partial';
  position?: number; // Center position along wall (0 to 1), required if partial
  width?: number; // Width of panel, required if partial
  height: number; // Height of panel
  bottomOffset: number; // Offset from floor
  color: string;
  slatSpacing: number; // Distance between grooves
  accessories?: ShopBuilderSlatAccessory[]; // Added accessories list
  
  // Supermarket shelves specific properties
  shelfCount?: number;     
  shelfDepth?: number;     
  uprightSpacing?: number; 
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
  createdAt?: string;
  updatedAt?: string;
  shopName?: string;
  field?: string;
}
