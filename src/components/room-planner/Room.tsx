import React from 'react';
import Wall from './Wall';
import Shelf from './Shelf';
import Column from './Column';
import WallControls from './WallControls';
import ObjectControls from './ObjectControls';

// Define types
type ShelfType = {
  id: string;
  width: number;
  height: number;
  depth: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    x: number;
    y: number;
    z: number;
  };
};

type WallType = {
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

type ColumnType = {
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

type RoomProps = {
  walls: WallType[];
  shelves: ShelfType[];
  columns: ColumnType[];
  selectedWallId: string | null;
  selectedShelfId: string | null;
  selectedColumnId: string | null;
  showMovementController?: boolean;
  onWallClick: (id: string) => void;
  onShelfClick: (id: string) => void;
  onColumnClick: (id: string) => void;
  onDeleteWall: (id: string) => void;
  onMoveWall: (id: string) => void;
  onColorWall: (id: string) => void;
  onWallTextureChange?: (id: string, texture: string) => void;
  onHideWallControls?: () => void;
  onCloneWall?: (id: string) => void;
  onQuitWall?: () => void;
  // New: object-level controls
  onMoveShelf?: (id: string) => void;
  onEditShelf?: (id: string) => void;
  onDeleteShelf?: (id: string) => void;
  onCloneShelf?: (id: string) => void;
  onQuitShelf?: () => void;
  onMoveColumn?: (id: string) => void;
  onEditColumn?: (id: string) => void;
  onDeleteColumn?: (id: string) => void;
  onCloneColumn?: (id: string) => void;
  onQuitColumn?: () => void;
};

const Room = ({
  walls,
  shelves,
  columns,
  selectedWallId,
  selectedShelfId,
  selectedColumnId,
  showMovementController,
  onWallClick,
  onShelfClick,
  onColumnClick,
  onDeleteWall,
  onMoveWall,
  onColorWall,
  onWallTextureChange,
  onHideWallControls,
  onCloneWall,
  onQuitWall,
  onMoveShelf,
  onEditShelf,
  onDeleteShelf,
  onCloneShelf,
  onQuitShelf,
  onMoveColumn,
  onEditColumn,
  onDeleteColumn,
  onCloneColumn,
  onQuitColumn,
}: RoomProps) => {
  // Calculate used area on floor based on wall positions
  const calculateUsedArea = () => {
    const floorWalls = walls.filter(wall => wall.id !== 'floor');
    if (floorWalls.length === 0) {
      return null;
    }
    
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    floorWalls.forEach(wall => {
      const halfWidth = wall.width / 2;
      const halfDepth = wall.depth / 2;
      
      minX = Math.min(minX, wall.position.x - halfWidth);
      maxX = Math.max(maxX, wall.position.x + halfWidth);
      minZ = Math.min(minZ, wall.position.z - halfDepth);
      maxZ = Math.max(maxZ, wall.position.z + halfDepth);
    });
    
    return { minX, maxX, minZ, maxZ };
  };
  
  const usedArea = calculateUsedArea();

  return (
    <>
      {/* Walls */}
      {walls.map((wall) => (
        <React.Fragment key={wall.id}>
          <Wall
            position={[
              wall.position.x / 100,  // Convert cm to meters
              wall.position.y / 100,  // Convert cm to meters
              wall.position.z / 100   // Convert cm to meters
            ]}
            dimensions={[
              wall.width / 100,       // Convert cm to meters
              wall.height / 100,      // Convert cm to meters
              wall.depth / 100        // Convert cm to meters
            ]}
            rotation={[
              wall.rotation.x,
              wall.rotation.y,
              wall.rotation.z
            ]}
            texture={wall.texture}
            isSelected={wall.id === selectedWallId}
            onClick={() => {
              // Prevent floor selection
              if (wall.id !== 'floor') {
                onWallClick(wall.id);
              }
            }}
            isFloor={wall.id === 'floor'}
            usedArea={wall.id === 'floor' ? usedArea : undefined}
          />
          
          {/* Wall Controls - only show for non-floor walls when selected and movement controller is not active */}
          {wall.id !== 'floor' && wall.id === selectedWallId && !showMovementController && (
            <WallControls
              position={[
                wall.position.x / 100,
                (wall.position.y + wall.height / 2) / 100 + 0.5, // Position above the wall
                wall.position.z / 100
              ]}
              onDelete={() => onDeleteWall(wall.id)}
              onMove={() => onMoveWall(wall.id)}
              onColor={() => onColorWall(wall.id)}
              isVisible={wall.id === selectedWallId}
              onTextureChange={(texture) => onWallTextureChange && onWallTextureChange(wall.id, texture)}
              onHideControls={onHideWallControls}
              onClone={() => onCloneWall && onCloneWall(wall.id)}
              onQuit={onQuitWall}
            />
          )}
        </React.Fragment>
      ))}
      
      {/* Shelves */}
      {shelves.map((shelf) => (
        <React.Fragment key={shelf.id}>
          <Shelf
            position={[
              shelf.position.x / 100,  // Convert cm to meters
              shelf.position.y / 100,  // Convert cm to meters
              shelf.position.z / 100   // Convert cm to meters
            ]}
            dimensions={[
              shelf.width / 100,       // Convert cm to meters
              shelf.height / 100,      // Convert cm to meters
              shelf.depth / 100        // Convert cm to meters
            ]}
            rotation={shelf.rotation ? [shelf.rotation.x, shelf.rotation.y, shelf.rotation.z] : undefined}
            isSelected={shelf.id === selectedShelfId}
            onClick={() => onShelfClick(shelf.id)}
          />
          {shelf.id === selectedShelfId && (
            <ObjectControls
              position={[
                shelf.position.x / 100,
                (shelf.position.y + shelf.height / 2) / 100 + 0.3,
                shelf.position.z / 100
              ]}
              isVisible={true}
              onQuit={onQuitShelf}
              onMove={() => onMoveShelf && onMoveShelf(shelf.id)}
              onEdit={() => onEditShelf && onEditShelf(shelf.id)}
              onDelete={() => onDeleteShelf && onDeleteShelf(shelf.id)}
              onClone={() => onCloneShelf && onCloneShelf(shelf.id)}
            />
          )}
        </React.Fragment>
      ))}
      
      {/* Columns */}
      {columns.map((column) => (
        <React.Fragment key={column.id}>
          <Column
            position={[
              column.position.x / 100,  // Convert cm to meters
              column.position.y / 100,  // Convert cm to meters
              column.position.z / 100   // Convert cm to meters
            ]}
            dimensions={[
              column.width / 100,       // Convert cm to meters
              column.height / 100,      // Convert cm to meters
              column.depth / 100        // Convert cm to meters
            ]}
            rotation={[
              column.rotation.x,
              column.rotation.y,
              column.rotation.z
            ]}
            isSelected={column.id === selectedColumnId}
            onClick={() => onColumnClick(column.id)}
          />
          {column.id === selectedColumnId && (
            <ObjectControls
              position={[
                column.position.x / 100,
                (column.position.y + column.height / 2) / 100 + 0.3,
                column.position.z / 100
              ]}
              isVisible={true}
              onQuit={onQuitColumn}
              onMove={() => onMoveColumn && onMoveColumn(column.id)}
              onEdit={() => onEditColumn && onEditColumn(column.id)}
              onDelete={() => onDeleteColumn && onDeleteColumn(column.id)}
              onClone={() => onCloneColumn && onCloneColumn(column.id)}
            />
          )}
        </React.Fragment>
      ))}
      
      {/* Ambient light */}
      <ambientLight intensity={0.5} />
      
      {/* Directional light */}
      <directionalLight position={[5, 5, 5]} intensity={1} />
      
      {/* Soft fill lights for modern look */}
      <pointLight position={[0, 5, 0]} intensity={0.3} />
      <pointLight position={[-5, 3, -5]} intensity={0.2} />
      <pointLight position={[5, 3, 5]} intensity={0.2} />
    </>
  );
};

export default Room;
