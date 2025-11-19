// Preconfigured shelf types
export const PRECONFIGURED_SHELVES = [
  { id: 'standard', name: 'Standard Shelf', width: 80, height: 25, depth: 30 },
  { id: 'narrow', name: 'Narrow Shelf', width: 60, height: 20, depth: 25 },
  { id: 'wide', name: 'Wide Shelf', width: 120, height: 30, depth: 35 },
  { id: 'tall', name: 'Tall Shelf', width: 80, height: 40, depth: 30 },
  { id: 'corner', name: 'Corner Shelf', width: 60, height: 25, depth: 60 },
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

// Default walls configuration
export const DEFAULT_WALLS = [
  {
    id: 'floor',
    name: 'Floor',
    width: 4000, // Much larger floor to take full horizon
    height: 10,
    depth: 4000,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: true,
    texture: 'wood'
  },
  // Front wall
  {
    id: 'wall-1',
    name: 'Front Wall',
    width: 400,
    height: 250,
    depth: 10,
    position: { x: 0, y: 125, z: -200 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: false,
    texture: 'wood'
  },
  // Back wall
  {
    id: 'wall-2',
    name: 'Back Wall',
    width: 400,
    height: 250,
    depth: 10,
    position: { x: 0, y: 125, z: 200 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: false,
    texture: 'wood'
  },
  // Left wall
  {
    id: 'wall-3',
    name: 'Left Wall',
    width: 10,
    height: 250,
    depth: 400,
    position: { x: -200, y: 125, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: false,
    texture: 'wood'
  },
  // Right wall
  {
    id: 'wall-4',
    name: 'Right Wall',
    width: 10,
    height: 250,
    depth: 400,
    position: { x: 200, y: 125, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: false,
    texture: 'wood'
  }
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
};
