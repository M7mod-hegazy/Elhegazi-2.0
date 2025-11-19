import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/context/AuthContextBase';
import { apiPostJson, apiPutJson } from '@/lib/api';
import { Shelf, Wall, Column, DEFAULT_WALLS, PRECONFIGURED_SHELVES } from '@/components/room-planner/constants';

export const useRoomPlanner = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  
  // 3D Mode toggle
  const [is3DMode, setIs3DMode] = useState(true);
  
  // Shelf placement
  const [shelfWidth, setShelfWidth] = useState(80);
  const [shelfHeight, setShelfHeight] = useState(25);
  const [shelfDepth, setShelfDepth] = useState(30);
  
  // Shelf position
  const [shelfPositionX, setShelfPositionX] = useState(0);
  const [shelfPositionY, setShelfPositionY] = useState(100);
  const [shelfPositionZ, setShelfPositionZ] = useState(15);
  
  // Preconfigured shelf selection
  const [selectedShelfType, setSelectedShelfType] = useState('standard');
  
  // Shelves in room
  const [shelves, setShelves] = useState<Shelf[]>([]);
  
  // Selected shelf
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  
  // Wall properties
  const [wallWidth, setWallWidth] = useState(400);
  const [wallHeight, setWallHeight] = useState(250);
  const [wallDepth, setWallDepth] = useState(10);
  const [wallTexture, setWallTexture] = useState('wood');
  
  // Wall position
  const [wallPositionX, setWallPositionX] = useState(0);
  const [wallPositionY, setWallPositionY] = useState(125);
  const [wallPositionZ, setWallPositionZ] = useState(0);
  
  // Wall rotation
  const [wallRotationY, setWallRotationY] = useState(0);
  
  // Walls in room (initialize with floor and 4 walls)
  const [walls, setWalls] = useState<Wall[]>(DEFAULT_WALLS);
  
  // Selected wall
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  
  // Wall lock status
  const [wallIsLocked, setWallIsLocked] = useState(true);
  
  // Column properties
  const [columnWidth, setColumnWidth] = useState(15);
  const [columnHeight, setColumnHeight] = useState(250);
  const [columnDepth, setColumnDepth] = useState(15);
  
  // Column position
  const [columnPositionX, setColumnPositionX] = useState(0);
  const [columnPositionY, setColumnPositionY] = useState(125);
  const [columnPositionZ, setColumnPositionZ] = useState(0);
  
  // Columns in room
  const [columns, setColumns] = useState<Column[]>([]);
  
  // Selected column
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  
  // Column lock status
  const [columnIsLocked, setColumnIsLocked] = useState(true);
  
  // UI states
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Movement controller visibility
  const [showMovementController, setShowMovementController] = useState(false);
  
  // Wall controls visibility
  const [showWallControls, setShowWallControls] = useState(true);

  // Room data for saving
  const [roomName, setRoomName] = useState('غرفة جديدة');
  const [isSaved, setIsSaved] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Reset to default walls
  const resetToDefaultWalls = () => {
    setWalls(DEFAULT_WALLS);
    setShelves([]);
    setColumns([]);
    setSelectedWallId(null);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
    setShowMovementController(false);
    setShowWallControls(true);
  };

  // Save room data to localStorage
  const saveToLocalStorage = () => {
    const roomData = {
      name: roomName,
      walls,
      shelves,
      columns,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    localStorage.setItem('roomPlannerData', JSON.stringify(roomData));
    setIsSaved(true);
    
    // Reset saved status after 2 seconds
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Save room data to MongoDB (for logged-in users)
  const saveToMongoDB = async () => {
    if (!isAuthenticated || !user) {
      alert('يرجى تسجيل الدخول لحفظ التصميم في قاعدة البيانات');
      return;
    }

    try {
      const roomData = {
        name: roomName,
        walls,
        shelves,
        columns,
        userId: user.id,
        lastModified: new Date().toISOString()
      };

      let response;
      if (roomId) {
        // Update existing room
        response = await apiPutJson<{ id: string }, typeof roomData>(
          `/api/rooms/${roomId}`,
          roomData
        );
      } else {
        // Create new room
        response = await apiPostJson<{ id: string }, typeof roomData>(
          '/api/rooms',
          roomData
        );
      }

      if (response.ok) {
        if (!roomId && response.item) {
          setRoomId(response.item.id);
        }
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        alert('تم حفظ التصميم بنجاح في قاعدة البيانات');
      } else {
        throw new Error(response.error || 'فشل في حفظ التصميم');
      }
    } catch (error) {
      console.error('Error saving room to MongoDB:', error);
      alert('حدث خطأ أثناء حفظ التصميم. يرجى المحاولة مرة أخرى.');
    }
  };

  // Share room design (placeholder implementation)
  const shareRoomDesign = () => {
    // In a real implementation, this would:
    // 1. Save to MongoDB if user is logged in
    // 2. Generate a shareable link
    // 3. Copy link to clipboard
    alert('في إصدار لاحق، ستتمكن من مشاركة هذا التصميم مع الآخرين. ستحتاج إلى تسجيل الدخول لاستخدام هذه الميزة.');
  };

  // Load room data from localStorage on component mount
  useEffect(() => {
    // Check if we have a room name from the welcome page
    const currentRoomName = localStorage.getItem('currentRoomName');
    if (currentRoomName) {
      setRoomName(currentRoomName);
      // Clear the temporary room name
      localStorage.removeItem('currentRoomName');
    }
    
    const savedData = localStorage.getItem('roomPlannerData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setRoomName(parsedData.name || currentRoomName || 'غرفة جديدة');
        
        // Load walls, shelves, and columns if they exist
        if (parsedData.walls) setWalls(parsedData.walls);
        if (parsedData.shelves) setShelves(parsedData.shelves);
        if (parsedData.columns) setColumns(parsedData.columns);
      } catch (error) {
        console.error('Error loading saved room data:', error);
      }
    }
  }, []);

  // Auto-save when data changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (walls.length > 0 || shelves.length > 0 || columns.length > 0) {
        saveToLocalStorage();
      }
    }, 5000); // Save every 5 seconds if there are changes

    return () => clearTimeout(timer);
  }, [walls, shelves, columns]);

  // Add a shelf to the scene
  const addShelf = () => {
    // Use preconfigured shelf dimensions if selected
    const shelfConfig = PRECONFIGURED_SHELVES.find(s => s.id === selectedShelfType);
    if (shelfConfig) {
      setShelfWidth(shelfConfig.width);
      setShelfHeight(shelfConfig.height);
      setShelfDepth(shelfConfig.depth);
    }
    
    const newShelf = {
      id: `shelf-${Date.now()}`,
      width: shelfWidth,
      height: shelfHeight,
      depth: shelfDepth,
      position: { x: shelfPositionX, y: shelfPositionY, z: shelfPositionZ }
    };
    
    setShelves([...shelves, newShelf]);
    setSelectedShelfId(newShelf.id);
    setSelectedWallId(null);
    setSelectedColumnId(null);
  };
  
  // Remove a shelf from the scene
  const removeShelf = (id: string) => {
    setShelves(shelves.filter(shelf => shelf.id !== id));
    if (selectedShelfId === id) {
      setSelectedShelfId(null);
    }
  };
  
  // Add a wall to the scene
  const addWall = () => {
    const newWall = {
      id: `wall-${Date.now()}`,
      name: `Wall ${walls.filter(w => w.id !== 'floor' && !w.id.startsWith('wall-')).length + 5}`,
      width: wallWidth,
      height: wallHeight,
      depth: wallDepth,
      position: { x: wallPositionX, y: wallPositionY, z: wallPositionZ },
      rotation: { x: 0, y: wallRotationY, z: 0 },
      isLocked: false,
      texture: wallTexture
    };
    
    setWalls([...walls, newWall]);
    setSelectedWallId(newWall.id);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
  };
  
  // Remove a wall from the scene
  const removeWall = (id: string) => {
    // Prevent removing the floor
    if (id === 'floor') return;
    
    setWalls(walls.filter(wall => wall.id !== id));
    if (selectedWallId === id) {
      setSelectedWallId(null);
      setShowMovementController(false);
    }
  };
  
  // Smart wall placement
  const addSmartWall = () => {
    // Find the last added wall to position the new one relative to it
    const lastWall = walls.filter(w => w.id !== 'floor' && !w.id.startsWith('wall-')).pop();
    
    // Default position
    let newX = wallPositionX;
    let newZ = wallPositionZ;
    
    // If there are existing user-added walls, position the new one adjacent
    if (lastWall) {
      // Position the new wall 10cm away from the last wall
      newX = lastWall.position.x + lastWall.width / 2 + wallWidth / 2 + 10;
      newZ = lastWall.position.z;
    } else {
      // If no user-added walls, position relative to the starter walls
      const starterWalls = walls.filter(w => w.id !== 'floor' && w.id.startsWith('wall-'));
      if (starterWalls.length > 0) {
        const lastStarterWall = starterWalls[starterWalls.length - 1];
        newX = lastStarterWall.position.x + lastStarterWall.width / 2 + wallWidth / 2 + 10;
        newZ = lastStarterWall.position.z;
      }
    }
    
    const newWall = {
      id: `wall-${Date.now()}`,
      name: `Wall ${walls.filter(w => w.id !== 'floor' && !w.id.startsWith('wall-')).length + 5}`,
      width: wallWidth,
      height: wallHeight,
      depth: wallDepth,
      position: { x: newX, y: wallPositionY, z: newZ },
      rotation: { x: 0, y: wallRotationY, z: 0 },
      isLocked: false,
      texture: wallTexture
    };
    
    setWalls([...walls, newWall]);
    setSelectedWallId(newWall.id);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
    
    // Update position inputs to reflect the new wall's position
    setWallPositionX(newX);
    setWallPositionZ(newZ);
  };
  
  // Add a column to the scene
  const addColumn = () => {
    const newColumn = {
      id: `column-${Date.now()}`,
      name: `Column ${columns.length + 1}`,
      width: columnWidth,
      height: columnHeight,
      depth: columnDepth,
      position: { x: columnPositionX, y: columnPositionY, z: columnPositionZ },
      rotation: { x: 0, y: 0, z: 0 },
      isLocked: false
    };
    
    setColumns([...columns, newColumn]);
    setSelectedColumnId(newColumn.id);
    setSelectedShelfId(null);
    setSelectedWallId(null);
  };
  
  // Remove a column from the scene
  const removeColumn = (id: string) => {
    setColumns(columns.filter(column => column.id !== id));
    if (selectedColumnId === id) {
      setSelectedColumnId(null);
    }
  };
  
  // Smart column placement
  const addSmartColumn = () => {
    // Find the last added column to position the new one relative to it
    const lastColumn = columns.length > 0 ? columns[columns.length - 1] : null;
    
    // Default position
    let newX = columnPositionX;
    let newZ = columnPositionZ;
    
    // If there are existing columns, position the new one adjacent
    if (lastColumn) {
      // Position the new column 10cm away from the last column
      newX = lastColumn.position.x + lastColumn.width / 2 + columnWidth / 2 + 10;
      newZ = lastColumn.position.z;
    }
    
    const newColumn = {
      id: `column-${Date.now()}`,
      name: `Column ${columns.length + 1}`,
      width: columnWidth,
      height: columnHeight,
      depth: columnDepth,
      position: { x: newX, y: columnPositionY, z: newZ },
      rotation: { x: 0, y: 0, z: 0 },
      isLocked: false
    };
    
    setColumns([...columns, newColumn]);
    setSelectedColumnId(newColumn.id);
    setSelectedShelfId(null);
    setSelectedWallId(null);
    
    // Update position inputs to reflect the new column's position
    setColumnPositionX(newX);
    setColumnPositionZ(newZ);
  };

  return {
    // State variables
    is3DMode, setIs3DMode,
    shelfWidth, setShelfWidth,
    shelfHeight, setShelfHeight,
    shelfDepth, setShelfDepth,
    shelfPositionX, setShelfPositionX,
    shelfPositionY, setShelfPositionY,
    shelfPositionZ, setShelfPositionZ,
    selectedShelfType, setSelectedShelfType,
    shelves, setShelves,
    selectedShelfId, setSelectedShelfId,
    wallWidth, setWallWidth,
    wallHeight, setWallHeight,
    wallDepth, setWallDepth,
    wallTexture, setWallTexture,
    wallPositionX, setWallPositionX,
    wallPositionY, setWallPositionY,
    wallPositionZ, setWallPositionZ,
    wallRotationY, setWallRotationY,
    walls, setWalls,
    selectedWallId, setSelectedWallId,
    wallIsLocked, setWallIsLocked,
    columnWidth, setColumnWidth,
    columnHeight, setColumnHeight,
    columnDepth, setColumnDepth,
    columnPositionX, setColumnPositionX,
    columnPositionY, setColumnPositionY,
    columnPositionZ, setColumnPositionZ,
    columns, setColumns,
    selectedColumnId, setSelectedColumnId,
    columnIsLocked, setColumnIsLocked,
    isControlsCollapsed, setIsControlsCollapsed,
    isFullscreen, setIsFullscreen,
    showMovementController, setShowMovementController,
    showWallControls, setShowWallControls,
    roomName, setRoomName,
    isSaved, setIsSaved,
    roomId, setRoomId,
    
    // Functions
    resetToDefaultWalls,
    saveToLocalStorage,
    saveToMongoDB,
    shareRoomDesign,
    addShelf,
    removeShelf,
    addWall,
    removeWall,
    addSmartWall,
    addColumn,
    removeColumn,
    addSmartColumn
  };
};
