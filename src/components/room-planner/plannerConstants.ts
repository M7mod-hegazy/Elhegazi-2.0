// Preconfigured shelf types
export const PRECONFIGURED_SHELVES = [
  { id: 'standard', name: 'Standard Shelf', width: 80, height: 10, depth: 30 },
  { id: 'narrow', name: 'Narrow Shelf', width: 60, height: 10, depth: 25 },
  { id: 'wide', name: 'Wide Shelf', width: 120, height: 10, depth: 35 },
  { id: 'tall', name: 'Tall Shelf', width: 80, height: 10, depth: 30 },
  { id: 'corner', name: 'Corner Shelf', width: 60, height: 10, depth: 60 },
];

// Preconfigured column types
export const PRECONFIGURED_COLUMNS = [
  { id: 'standard', name: 'Standard Column', width: 15, height: 250, depth: 15 },
  { id: 'slim', name: 'Slim Column', width: 10, height: 250, depth: 10 },
  { id: 'thick', name: 'Thick Column', width: 20, height: 250, depth: 20 },
];

// Preconfigured wall types
export const PRECONFIGURED_WALLS = [
  { id: 'standard', name: 'Standard Wall', width: 400, height: 250, depth: 10 },
  { id: 'tall', name: 'Tall Wall', width: 400, height: 300, depth: 10 },
  { id: 'wide', name: 'Wide Wall', width: 600, height: 250, depth: 10 },
  { id: 'narrow', name: 'Narrow Wall', width: 200, height: 250, depth: 10 },
];

// Define types
export type Shelf = {
  id: string;
  width: number;
  height: number;
  depth: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  // Optional: when created on a wall, we store the wallId for linkage
  wallId?: string;
  // Optional rotation, used to align shelf with wall
  rotation?: {
    x: number;
    y: number;
    z: number;
  };
};

export type Wall = {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  isLocked: boolean;
  texture: string;
};

export type Column = {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  isLocked: boolean;
  // Optional: when created on a wall, we store the wallId for linkage
  wallId?: string;
};