import { useState } from 'react';
import { Shelf, Wall, Column } from '@/components/room-planner/constants';

export const useRoomPlannerHandlers = (
  setSelectedShelfId: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedWallId: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedColumnId: React.Dispatch<React.SetStateAction<string | null>>,
  setShelfWidth: React.Dispatch<React.SetStateAction<number>>,
  setShelfHeight: React.Dispatch<React.SetStateAction<number>>,
  setShelfDepth: React.Dispatch<React.SetStateAction<number>>,
  setShelfPositionX: React.Dispatch<React.SetStateAction<number>>,
  setShelfPositionY: React.Dispatch<React.SetStateAction<number>>,
  setShelfPositionZ: React.Dispatch<React.SetStateAction<number>>,
  setWallWidth: React.Dispatch<React.SetStateAction<number>>,
  setWallHeight: React.Dispatch<React.SetStateAction<number>>,
  setWallDepth: React.Dispatch<React.SetStateAction<number>>,
  setWallPositionX: React.Dispatch<React.SetStateAction<number>>,
  setWallPositionY: React.Dispatch<React.SetStateAction<number>>,
  setWallPositionZ: React.Dispatch<React.SetStateAction<number>>,
  setWallRotationY: React.Dispatch<React.SetStateAction<number>>,
  setWallTexture: React.Dispatch<React.SetStateAction<string>>,
  setWallIsLocked: React.Dispatch<React.SetStateAction<boolean>>,
  setColumnWidth: React.Dispatch<React.SetStateAction<number>>,
  setColumnHeight: React.Dispatch<React.SetStateAction<number>>,
  setColumnDepth: React.Dispatch<React.SetStateAction<number>>,
  setColumnPositionX: React.Dispatch<React.SetStateAction<number>>,
  setColumnPositionY: React.Dispatch<React.SetStateAction<number>>,
  setColumnPositionZ: React.Dispatch<React.SetStateAction<number>>,
  setColumnIsLocked: React.Dispatch<React.SetStateAction<boolean>>,
  setShowMovementController: React.Dispatch<React.SetStateAction<boolean>>,
  setShowWallControls: React.Dispatch<React.SetStateAction<boolean>>,
  shelves: Shelf[],
  walls: Wall[],
  columns: Column[]
) => {
  // Handle shelf click
  const handleShelfClick = (id: string) => {
    setSelectedShelfId(id);
    setSelectedWallId(null);
    setSelectedColumnId(null);
    setShowMovementController(false);
    const shelf = shelves.find(s => s.id === id);
    if (shelf) {
      setShelfWidth(shelf.width);
      setShelfHeight(shelf.height);
      setShelfDepth(shelf.depth);
      setShelfPositionX(shelf.position.x);
      setShelfPositionY(shelf.position.y);
      setShelfPositionZ(shelf.position.z);
    }
  };

  // Handle wall click - updated to hide wall controls when a controller is clicked
  const handleWallClick = (id: string) => {
    // Prevent selection of floor
    if (id === 'floor') return;

    setSelectedWallId(id);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
    // Show wall controls when wall is selected
    setShowWallControls(true);
    // Don't automatically show movement controller - only show when move button is clicked
    // setShowMovementController(true);
    const wall = walls.find(w => w.id === id);
    if (wall) {
      setWallWidth(wall.width);
      setWallHeight(wall.height);
      setWallDepth(wall.depth);
      setWallPositionX(wall.position.x);
      setWallPositionY(wall.position.y);
      setWallPositionZ(wall.position.z);
      setWallRotationY(wall.rotation.y);
      setWallTexture(wall.texture);
      setWallIsLocked(wall.isLocked);
    }
  };

  // Handle wall delete - hide controls after deletion
  const handleDeleteWall = (id: string) => {
    // This will be implemented in the main component
  };

  // Handle wall move - hide wall controls and show movement controller
  const handleMoveWall = (id: string) => {
    setSelectedWallId(id);
    setShowMovementController(true);
    setShowWallControls(false);
  };

  // Handle wall color/texture change - hide wall controls
  const handleColorWall = (id: string) => {
    setSelectedWallId(id);
    setShowWallControls(false);
  };

  // Quit wall editing - hide controls and clear selection
  const quitWallEditing = () => {
    setSelectedWallId(null);
    setShowWallControls(false);
    setShowMovementController(false);
  };

  // Handle column click
  const handleColumnClick = (id: string) => {
    setSelectedColumnId(id);
    setSelectedShelfId(null);
    setSelectedWallId(null);
    setShowMovementController(false);
    const column = columns.find(c => c.id === id);
    if (column) {
      setColumnWidth(column.width);
      setColumnHeight(column.height);
      setColumnDepth(column.depth);
      setColumnPositionX(column.position.x);
      setColumnPositionY(column.position.y);
      setColumnPositionZ(column.position.z);
      setColumnIsLocked(column.isLocked);
    }
  };

  // Toggle wall lock status
  const toggleWallLock = () => {
    setWallIsLocked(prev => !prev);
  };

  // Toggle column lock status
  const toggleColumnLock = () => {
    setColumnIsLocked(prev => !prev);
  };

  // Update selected shelf properties
  const updateSelectedShelf = () => {
    // This will be implemented in the main component
  };

  // Update selected wall properties
  const updateSelectedWall = () => {
    // This will be implemented in the main component
  };

  // Update selected column properties
  const updateSelectedColumn = () => {
    // This will be implemented in the main component
  };

  return {
    handleShelfClick,
    handleWallClick,
    handleDeleteWall,
    handleMoveWall,
    handleColorWall,
    quitWallEditing,
    handleColumnClick,
    toggleWallLock,
    toggleColumnLock,
    updateSelectedShelf,
    updateSelectedWall,
    updateSelectedColumn
  };
};