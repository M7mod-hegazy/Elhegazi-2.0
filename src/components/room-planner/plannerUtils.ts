// Utility functions for the room planner

export const calculateShelfQuantity = (wallWidth: number, shelfWidth: number) => {
  const shelvesPerRow = Math.floor(wallWidth / shelfWidth);
  return shelvesPerRow;
};

export const getDefaultWalls = () => {
  return [
    {
      id: 'floor',
      name: 'Floor',
      width: 4000, // Much larger floor to take full horizon
      height: 10,
      depth: 4000,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isLocked: true,
      texture: 'default'
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
      texture: 'default'
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
      texture: 'default'
    },
    // Left wall (same dimensions as front/back, rotated 90°)
    {
      id: 'wall-3',
      name: 'Left Wall',
      width: 400,
      height: 250,
      depth: 10,
      position: { x: -200, y: 125, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      isLocked: false,
      texture: 'wood'
    },
    // Right wall (same dimensions as front/back, rotated -90°)
    {
      id: 'wall-4',
      name: 'Right Wall',
      width: 400,
      height: 250,
      depth: 10,
      position: { x: 200, y: 125, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      isLocked: false,
      texture: 'default'
    }
  ];
};