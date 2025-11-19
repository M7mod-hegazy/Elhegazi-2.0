import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Archive, ChevronLeft, ChevronRight, Package, Square, XCircle, Settings, Pointer, MoveRight, Copy, Trash2, RotateCw } from 'lucide-react';
import Room from '@/components/room-planner/Room';
import ThreeDMovementController from '@/components/room-planner/ThreeDMovementController';
import ShelvesPanel from '@/components/room-planner/ShelvesPanel';
import WallsPanel from '@/components/room-planner/WallsPanel';
import ColumnsPanel from '@/components/room-planner/ColumnsPanel';
import { PRECONFIGURED_COLUMNS, PRECONFIGURED_SHELVES, Shelf, Wall, Column } from '@/components/room-planner/plannerConstants';
import { calculateShelfQuantity, getDefaultWalls } from '@/components/room-planner/plannerUtils';
import { AuthContext } from '@/context/AuthContextBase';
import ShelfColumnInsertModal from '@/components/room-planner/ShelfColumnInsertModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Walls2DPlannerModal from '@/components/room-planner/Walls2DPlannerModal';

const RoomPlanner3D_v2: React.FC = () => {
  const { isAuthenticated, user } = useContext(AuthContext);

  // Shelves
  const [shelfWidth, setShelfWidth] = useState(80);
  const [shelfHeight, setShelfHeight] = useState(25);
  const [shelfDepth, setShelfDepth] = useState(30);
  const [shelfPositionX, setShelfPositionX] = useState(0);
  const [shelfPositionY, setShelfPositionY] = useState(100);
  const [shelfPositionZ, setShelfPositionZ] = useState(15);
  const [selectedShelfType, setSelectedShelfType] = useState('standard');
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);

  // Walls
  const [wallWidth, setWallWidth] = useState(400);
  const [wallHeight, setWallHeight] = useState(250);
  const [wallDepth, setWallDepth] = useState(10);
  const [wallTexture, setWallTexture] = useState('wood');
  const [wallPositionX, setWallPositionX] = useState(0);
  const [wallPositionY, setWallPositionY] = useState(125);
  const [wallPositionZ, setWallPositionZ] = useState(0);
  const [wallRotationY, setWallRotationY] = useState(0);
  const [walls, setWalls] = useState<Wall[]>(getDefaultWalls() as any);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [wallIsLocked, setWallIsLocked] = useState(true);

  // Columns
  const [columnWidth, setColumnWidth] = useState(15);
  const [columnHeight, setColumnHeight] = useState(250);
  const [columnDepth, setColumnDepth] = useState(15);
  const [columnPositionX, setColumnPositionX] = useState(0);
  const [columnPositionY, setColumnPositionY] = useState(125);
  const [columnPositionZ, setColumnPositionZ] = useState(0);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [columnIsLocked, setColumnIsLocked] = useState(true);

  // UI
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'insert'|'view'>('insert');
  const [insertCategory, setInsertCategory] = useState<'shelves'|'walls'|'columns'|'objects'>('walls');
  const [showMovementController, setShowMovementController] = useState(false);
  // Object movement controller (for shelves/columns)
  const [movingObject, setMovingObject] = useState<null | { type: 'shelf' | 'column'; id: string }>(null);

  const controlsRef = useRef<any>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [deleteTargetWallId, setDeleteTargetWallId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>('');
  const [hoveredOverlay, setHoveredOverlay] = useState<null | { type: 'shelf'|'column'; id: string }>(null);
  const [replaceTarget, setReplaceTarget] = useState<null | { type: 'shelf'|'column'; id: string }>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  // Wall side selection: 'front' or 'back' per wall
  const [wallSides, setWallSides] = useState<Record<string, 'front'|'back'>>({});
  // 2D Walls planner modal
  const [isWalls2DOpen, setIsWalls2DOpen] = useState(false);
  // Start choice dialog (Option B)
  const [isStartChoiceOpen, setIsStartChoiceOpen] = useState(false);

  const STORAGE_KEY = 'room_planner_draft_v1';

  // DEBUG: log modal open/close and expose a quick key toggle
  useEffect(() => {
    // eslint-disable-next-line no-console

  }, [isWalls2DOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + W to toggle (avoid browser Ctrl+W close-tab)
      if (e.key.toLowerCase() === 'w' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setIsWalls2DOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load draft from localStorage on first mount
  useEffect(() => {
    try {
      // Force-new handling via URL or session flag
      const params = new URLSearchParams(window.location.search);
      const forceNew = params.get('new') === '1' || window.location.hash.includes('new') || sessionStorage.getItem('planner_new_project') === '1';
      if (forceNew) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('planner_new_project');
        setProjectId(`proj-${Date.now()}`);
        setIsStartChoiceOpen(true);
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.projectId) setProjectId(data.projectId);
        if (Array.isArray(data?.walls)) setWalls(data.walls);
        if (Array.isArray(data?.shelves)) setShelves(data.shelves);
        if (Array.isArray(data?.columns)) setColumns(data.columns);
      } else {
        // initialize a new project id
        setProjectId(`proj-${Date.now()}`);
        // no existing draft: show start choices (default 4 walls or 2D planner)
        setIsStartChoiceOpen(true);
      }
    } catch (e) {
      console.warn('Failed to load draft from localStorage', e);
      setProjectId(`proj-${Date.now()}`);
      setIsStartChoiceOpen(true);
    }
  }, []);

  // Auto-save draft when core state changes
  useEffect(() => {
    try {
      const payload = JSON.stringify({ projectId: projectId || `proj-${Date.now()}`, walls, shelves, columns, ts: Date.now() });
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e);
    }
  }, [projectId, walls, shelves, columns]);

  const saveToServer = async () => {
    try {
      const body = { projectId: projectId || `proj-${Date.now()}`, walls, shelves, columns, user: user?.id || null };
      const res = await fetch('/api/room-planner/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.alert('تم الحفظ بنجاح');
    } catch (err) {
      console.error('Save failed', err);
      window.alert('فشل الحفظ، حاول مرة أخرى');
    }
  };

  const handleReplaceConfirm = (newTypeId: string) => {
    if (!replaceTarget) return;
    if (replaceTarget.type === 'shelf') {
      const cfg = PRECONFIGURED_SHELVES.find(s => s.id === newTypeId);
      if (!cfg) return;
      setShelves(prev => prev.map(s => s.id === replaceTarget.id ? {
        ...s,
        width: cfg.width,
        height: Math.min(10, cfg.height),
        depth: cfg.depth,
      } : s));
    } else {
      const cfg = PRECONFIGURED_COLUMNS.find(c => c.id === newTypeId);
      if (!cfg) return;
      setColumns(prev => prev.map(c => c.id === replaceTarget.id ? {
        ...c,
        width: cfg.width,
        height: cfg.height,
        depth: cfg.depth,
      } : c));
    }
    setIsReplaceModalOpen(false);
    setReplaceTarget(null);
  };

  // Camera: center on main walls center; allow wide zoom range
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !c.target) return;
    const mainWalls = walls.filter(w => w.id !== 'floor');
    if (mainWalls.length === 0) return;
    const cx = mainWalls.reduce((a, w) => a + w.position.x, 0) / mainWalls.length;
    const cy = mainWalls.reduce((a, w) => a + w.position.y, 0) / mainWalls.length;
    const cz = mainWalls.reduce((a, w) => a + w.position.z, 0) / mainWalls.length;
    try {
      c.target.set(cx, cy, cz);
      // Compute a reasonable camera distance to frame the 4 walls
      const xs = mainWalls.map(w => w.position.x);
      const zs = mainWalls.map(w => w.position.z);
      const spanX = Math.max(...xs) - Math.min(...xs); // true span without over-padding
      const spanZ = Math.max(...zs) - Math.min(...zs);
      const span = Math.max(spanX, spanZ);
      const cam = c.object; // camera
      // Make FOV smaller and distance tighter for a much more zoomed-in start
      if (cam && typeof cam.updateProjectionMatrix === 'function') {
        cam.fov = 24; // was ~32, smaller FOV = more zoom
        cam.updateProjectionMatrix();
      }
      const fov = (cam?.fov ?? 24) * Math.PI / 180;
      const base = Math.max(250, span + 150); // reduce base to zoom more
      let dist = (base / 2) / Math.tan(fov / 2) + 20; // much smaller margin
      dist = Math.max(120, dist * 0.35); // aggressively closer
      if (cam && typeof cam.position?.set === 'function') {
        cam.position.set(cx, cy + 60, cz + dist);
      }
      c.update();
    } catch (err) { /* optional camera fit failed; ignore */ }
  }, [walls]);

  // Handlers
  const handleShelfClick = (id: string) => {
    const shelf = shelves.find(s => s.id === id);
    if (!shelf) return;
    setSelectedShelfId(id);
    setSelectedWallId(null);
    setSelectedColumnId(null);
    setShelfWidth(shelf.width);
    setShelfHeight(shelf.height);
    setShelfDepth(shelf.depth);
    setShelfPositionX(shelf.position.x);
    setShelfPositionY(shelf.position.y);
    setShelfPositionZ(shelf.position.z);
    setActiveTab('insert');
    setInsertCategory('shelves');
  };

  const handleWallClick = (id: string) => {
    if (id === 'floor') return;
    const wall = walls.find(w => w.id === id);
    if (!wall) return;
    setSelectedWallId(id);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
    setWallWidth(wall.width);
    setWallHeight(wall.height);
    setWallDepth(wall.depth);
    setWallPositionX(wall.position.x);
    setWallPositionY(wall.position.y);
    setWallPositionZ(wall.position.z);
    setWallRotationY(wall.rotation.y);
    setWallTexture(wall.texture);
    setWallIsLocked(wall.isLocked);
    setShowMovementController(false);
    setWallSides(prev => ({ ...prev, [id]: prev[id] || 'front' }));
    // Special wall panel shown when a wall is selected
  };

  const handleColumnClick = (id: string) => {
    const column = columns.find(c => c.id === id);
    if (!column) return;
    setSelectedColumnId(id);
    setSelectedShelfId(null);
    setSelectedWallId(null);
    setColumnWidth(column.width);
    setColumnHeight(column.height);
    setColumnDepth(column.depth);
    setColumnPositionX(column.position.x);
    setColumnPositionY(column.position.y);
    setColumnPositionZ(column.position.z);
    setColumnIsLocked(column.isLocked);
    setActiveTab('insert');
    setInsertCategory('columns');
  };

  const handleDeleteWall = (id: string) => {
    if (id === 'floor') return;
    setDeleteTargetWallId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteWall = (deleteAttached: boolean) => {
    if (!deleteTargetWallId) return;
    const id = deleteTargetWallId;
    const attachedShelves = shelves.filter(s => s.wallId === id);
    const attachedColumns = columns.filter(c => c.wallId === id);
    setWalls(prev => prev.filter(w => w.id !== id));
    if (deleteAttached) {
      if (attachedShelves.length) setShelves(prev => prev.filter(s => s.wallId !== id));
      if (attachedColumns.length) setColumns(prev => prev.filter(c => c.wallId !== id));
    } else {
      // Detach
      if (attachedShelves.length) setShelves(prev => prev.map(s => s.wallId === id ? { ...s, wallId: undefined } as any : s));
      if (attachedColumns.length) setColumns(prev => prev.map(c => c.wallId === id ? { ...c, wallId: undefined } as any : c));
    }
    if (selectedWallId === id) {
      setSelectedWallId(null);
      setShowMovementController(false);
    }
    setIsDeleteModalOpen(false);
    setDeleteTargetWallId(null);
  };

  const handleMoveWall = (id: string) => {
    setSelectedWallId(id);
    setShowMovementController(true);
  };

  const handleWallTextureChange = (id: string, texture: string) => {
    setWalls(prev => prev.map(w => w.id === id ? { ...w, texture } : w));
  };

  const handle3DMovement = (dx: number, dy: number, dz: number) => {
    if (movingObject) {
      // Move shelf/column
      if (movingObject.type === 'shelf') {
        setShelves(prev => prev.map(s => s.id === movingObject.id ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy, z: s.position.z + dz } } as any : s));
        const s = shelves.find(s => s.id === movingObject.id);
        if (s) {
          setShelfPositionX(s.position.x + dx);
          setShelfPositionY(s.position.y + dy);
          setShelfPositionZ(s.position.z + dz);
        }
      } else if (movingObject.type === 'column') {
        setColumns(prev => prev.map(c => c.id === movingObject.id ? { ...c, position: { x: c.position.x + dx, y: c.position.y + dy, z: c.position.z + dz } } as any : c));
        const c = columns.find(c => c.id === movingObject.id);
        if (c) {
          setColumnPositionX(c.position.x + dx);
          setColumnPositionY(c.position.y + dy);
          setColumnPositionZ(c.position.z + dz);
        }
      }
      return;
    }
    if (!selectedWallId) return;
    // Move wall
    const updated = walls.map(w => w.id === selectedWallId ? { ...w, position: { x: w.position.x + dx, y: w.position.y + dy, z: w.position.z + dz } } : w);
    setWalls(updated);
    const sel = updated.find(w => w.id === selectedWallId);
    if (sel) {
      setWallPositionX(sel.position.x);
      setWallPositionY(sel.position.y);
      setWallPositionZ(sel.position.z);
      // Move attached objects with wall
      setShelves(prev => prev.map(s => s.wallId === sel.id ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy, z: s.position.z + dz } } as any : s));
      setColumns(prev => prev.map(c => c.wallId === sel.id ? { ...c, position: { x: c.position.x + dx, y: c.position.y + dy, z: c.position.z + dz } } as any : c));
    }
  };

  const handle3DRotation = (dy: number) => {
    if (!selectedWallId) return;
    const updated = walls.map(w => w.id === selectedWallId ? { ...w, rotation: { ...w.rotation, y: w.rotation.y + dy } } : w);
    setWalls(updated);
    const sel = updated.find(w => w.id === selectedWallId);
    if (sel) setWallRotationY(sel.rotation.y);
  };

  // CRUD helpers
  const addShelf = () => {
    const cfg = PRECONFIGURED_SHELVES.find(s => s.id === selectedShelfType);
    const w = cfg?.width ?? shelfWidth;
    const h = Math.min(10, cfg?.height ?? shelfHeight);
    const d = cfg?.depth ?? shelfDepth;
    const newShelf: Shelf = { id: `shelf-${Date.now()}`, width: w, height: h, depth: d, position: { x: shelfPositionX, y: shelfPositionY, z: shelfPositionZ } } as any;
    setShelves(prev => [...prev, newShelf]);
    setSelectedShelfId(newShelf.id);
  };

  const removeShelf = (id: string) => {
    setShelves(prev => prev.filter(s => s.id !== id));
    if (selectedShelfId === id) setSelectedShelfId(null);
  };

  const addColumn = () => {
    const newCol: Column = { id: `column-${Date.now()}`, name: `Column ${columns.length + 1}`, width: columnWidth, height: columnHeight, depth: columnDepth, position: { x: columnPositionX, y: columnPositionY, z: columnPositionZ }, rotation: { x:0,y:0,z:0 }, isLocked: false } as any;
    setColumns(prev => [...prev, newCol]);
    setSelectedColumnId(newCol.id);
  };

  const removeColumn = (id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
    if (selectedColumnId === id) setSelectedColumnId(null);
  };

  const updateSelectedShelf = () => {
    if (!selectedShelfId) return;
    setShelves(prev => prev.map(s => s.id === selectedShelfId ? { ...s, width: shelfWidth, height: Math.min(10, shelfHeight), depth: shelfDepth, position: { x: shelfPositionX, y: shelfPositionY, z: shelfPositionZ } } : s));
  };

  const updateSelectedColumn = () => {
    if (!selectedColumnId) return;
    setColumns(prev => prev.map(c => c.id === selectedColumnId ? { ...c, width: columnWidth, height: columnHeight, depth: columnDepth, position: { x: columnIsLocked ? c.position.x : columnPositionX, y: columnIsLocked ? c.position.y : columnPositionY, z: columnIsLocked ? c.position.z : columnPositionZ }, isLocked: columnIsLocked } : c));
  };

  const updateSelectedWall = (updated: Wall) => {
    setWalls(prev => prev.map(w => w.id === updated.id ? updated : w));
    if (selectedWallId === updated.id) {
      setWallWidth(updated.width);
      setWallHeight(updated.height);
      setWallDepth(updated.depth);
      setWallPositionX(updated.position.x);
      setWallPositionY(updated.position.y);
      setWallPositionZ(updated.position.z);
      setWallRotationY(updated.rotation.y);
      setWallTexture(updated.texture);
      setWallIsLocked(updated.isLocked);
    }
  };

  const addShelfToWall = (pos: {x:number;y:number}) => {
    const cfg = PRECONFIGURED_SHELVES.find(s => s.id === selectedShelfType);
    const w = cfg?.width ?? shelfWidth;
    const h = Math.min(10, cfg?.height ?? shelfHeight);
    const d = cfg?.depth ?? shelfDepth;
    const wall = selectedWallId ? walls.find(wl => wl.id === selectedWallId) : undefined;
    const z = wall ? wall.position.z : 0;
    const rotation = wall ? { x: 0, y: wall.rotation.y, z: 0 } : undefined;
    // Offset outward along wall normal according to selected side
    let xOut = pos.x;
    let zOut = z;
    if (wall) {
      const theta = wall.rotation.y;
      const normalX = Math.sin(theta);
      const normalZ = Math.cos(theta);
      const side = wallSides[wall.id] || 'front';
      const dir = side === 'front' ? 1 : -1;
      const offset = (wall.depth/2 + d/2);
      xOut = pos.x + normalX * offset * dir;
      zOut = z + normalZ * offset * dir;
    }
    const newShelf: Shelf = { id: `shelf-${Date.now()}`, width: w, height: h, depth: d, position: { x: xOut, y: pos.y, z: zOut }, wallId: selectedWallId || undefined, rotation } as any;
    setShelves(prev => [...prev, newShelf]);
    setSelectedShelfId(newShelf.id);
    setSelectedWallId(null);
    setSelectedColumnId(null);
  };

  const addColumnToWall = (pos: {x:number;y:number}) => {
    const wall = selectedWallId ? walls.find(w => w.id === selectedWallId) : undefined;
    const z = wall ? wall.position.z : 0;
    const rotation = wall ? { x: 0, y: wall.rotation.y, z: 0 } : { x:0,y:0,z:0 };
    let xOut = pos.x;
    let zOut = z;
    if (wall) {
      const theta = wall.rotation.y;
      const normalX = Math.sin(theta);
      const normalZ = Math.cos(theta);
      const side = wallSides[wall.id] || 'front';
      const dir = side === 'front' ? 1 : -1;
      const offset = (wall.depth/2 + columnDepth/2);
      xOut = pos.x + normalX * offset * dir;
      zOut = z + normalZ * offset * dir;
    }
    const newCol: Column = { id: `column-${Date.now()}`, name: `Column ${columns.length + 1}`, width: columnWidth, height: columnHeight, depth: columnDepth, position: { x: xOut, y: pos.y, z: zOut }, rotation, isLocked:false, wallId: selectedWallId || undefined } as any;
    setColumns(prev => [...prev, newCol]);
    setSelectedColumnId(newCol.id);
    setSelectedShelfId(null);
    setSelectedWallId(null);
  };

  const updateShelfPosition = (id: string, pos: {x:number;y:number}) => {
    setShelves(prev => prev.map(s => s.id === id ? { ...s, position: { ...s.position, x: pos.x, y: pos.y } } : s));
  };
  const updateColumnPosition = (id: string, pos: {x:number;y:number}) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, position: { ...c.position, x: pos.x, y: pos.y } } : c));
  };

  const resetToDefaultWalls = () => {
    setWalls(getDefaultWalls() as any);
    setShelves([]);
    setColumns([]);
    setSelectedWallId(null);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
    setShowMovementController(false);
  };

  const insertShelvesAndColumns = (config: { shelfType: string; columnType: string; shelvesPerColumn: number; shelfHeight: number; columnsCount: number|'auto' }) => {
    if (!selectedWallId) return;
    const wall = walls.find(w => w.id === selectedWallId);
    if (!wall) return;
    const shelfCfg = PRECONFIGURED_SHELVES.find(s => s.id === config.shelfType);
    const colCfg = PRECONFIGURED_COLUMNS.find(c => c.id === config.columnType);
    if (!shelfCfg || !colCfg) return;
    const count = config.columnsCount === 'auto' ? Math.floor((wall.width + 10) / (shelfCfg.width + 10)) : config.columnsCount;
    const totalWidth = count * shelfCfg.width;
    const spacing = (wall.width - totalWidth) / (count + 1);
    const newShelves: Shelf[] = [] as any;
    const newColumns: Column[] = [] as any;
    const side = wallSides[wall.id] || 'front';
    const dir = side === 'front' ? 1 : -1;
    const theta = wall.rotation.y;
    const normalX = Math.sin(theta);
    const normalZ = Math.cos(theta);
    const tangentX = Math.cos(theta);
    const tangentZ = -Math.sin(theta);
    // Start point along wall's left edge (local), then move along tangent
    const startX = wall.position.x - tangentX * (wall.width / 2);
    const startZ = wall.position.z - tangentZ * (wall.width / 2);
    for (let col = 0; col < count; col++) {
      const along = spacing + shelfCfg.width / 2 + col * (shelfCfg.width + spacing);
      const baseX = startX + tangentX * along;
      const baseZ = startZ + tangentZ * along;
      const colOffset = (wall.depth / 2 + colCfg.depth / 2);
      const colX = baseX + normalX * colOffset * dir;
      const colZ = baseZ + normalZ * colOffset * dir;
      const newCol: Column = { id: `column-${Date.now()}-${col}`, name: `Column ${columns.length + col + 1}`, width: colCfg.width, height: colCfg.height, depth: colCfg.depth, position: { x: colX, y: wall.position.y, z: colZ }, rotation: { x: 0, y: wall.rotation.y, z: 0 }, isLocked: false, wallId: wall.id } as any;
      newColumns.push(newCol);
      const shelfH = Math.min(10, shelfCfg.height);
      let currentY = wall.position.y - wall.height / 2 + shelfH / 2;
      for (let s = 0; s < config.shelvesPerColumn; s++) {
        const shelfOffset = (wall.depth / 2 + shelfCfg.depth / 2);
        const shelfX = baseX + normalX * shelfOffset * dir;
        const shelfZ = baseZ + normalZ * shelfOffset * dir;
        const newShelf: Shelf = { id: `shelf-${Date.now()}-${col}-${s}`, width: shelfCfg.width, height: shelfH, depth: shelfCfg.depth, position: { x: shelfX, y: currentY, z: shelfZ }, wallId: wall.id, rotation: { x: 0, y: wall.rotation.y, z: 0 } } as any;
        newShelves.push(newShelf);
        currentY += shelfH + config.shelfHeight;
      }
    }
    setShelves(prev => [...prev, ...newShelves]);
    setColumns(prev => [...prev, ...newColumns]);
    setSelectedShelfId(null);
    setSelectedColumnId(null);
  };

  const perWallShelvesPerRow = useMemo(() => calculateShelfQuantity(wallWidth, shelfWidth), [wallWidth, shelfWidth]);

  // Named handlers to keep JSX clean and avoid chaining issues
  const handleMoveShelfFromControls = (id: string) => {
    setMovingObject({ type: 'shelf', id });
    setSelectedShelfId(id);
    setActiveTab('insert');
    setInsertCategory('shelves');
    setIsControlsCollapsed(true);
  };

  const handleEditShelfFromControls = (id: string) => {
    setSelectedShelfId(id);
    setActiveTab('insert');
    setInsertCategory('shelves');
    setIsControlsCollapsed(true);
  };

  const handleMoveColumnFromControls = (id: string) => {
    setMovingObject({ type: 'column', id });
    setSelectedColumnId(id);
    setActiveTab('insert');
    setInsertCategory('columns');
    setIsControlsCollapsed(true);
  };

  const handleEditColumnFromControls = (id: string) => {
    setSelectedColumnId(id);
    setActiveTab('insert');
    setInsertCategory('columns');
    setIsControlsCollapsed(true);
  };

  // Insert helpers
  const addNewWall = () => {
    // Determine placement: to the right of the rightmost wall
    const nonFloor = walls.filter(w => w.id !== 'floor');
    const rightmost = nonFloor.length ? Math.max(...nonFloor.map(w => w.position.x + w.width / 2)) : 0;
    const x = rightmost + (wallWidth / 2) + 20; // 20cm gap
    const newWall: Wall = {
      id: `wall-${Date.now()}`,
      name: `Wall ${nonFloor.length + 1}`,
      width: wallWidth,
      height: wallHeight,
      depth: wallDepth,
      position: { x, y: wallPositionY, z: wallPositionZ },
      rotation: { x: 0, y: wallRotationY, z: 0 },
      texture: wallTexture || 'default',
      isLocked: true,
    } as any;
    setWalls(prev => [...prev, newWall]);
    setSelectedWallId(newWall.id);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out" style={{ fontFamily: 'Orbitron, sans-serif' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 -right-4 z-10 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border border-gray-300 text-gray-600 rounded-full w-8 h-8 p-0 transition-all duration-300 transform hover:scale-110 shadow-md hover:shadow-lg"
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          >
            {isControlsCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>

          <div className={`${isControlsCollapsed ? 'w-12' : 'w-80'} bg-white p-4 overflow-y-auto transition-all duration-300 relative border-r border-gray-200 shadow-lg hover:shadow-xl`} style={{ scrollbarGutter: 'stable both-edges' }}>
            {!isControlsCollapsed && (
              selectedWallId ? (
                <div className="space-y-3 animate-fade-in">
                  {/* Quit selection at top */}
                  <div className="flex gap-2 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedWallId(null); }} className="text-gray-600">
                      <XCircle className="mr-1" size={16} /> إنهاء التحديد
                    </Button>
                  </div>
                  {/* Quick controls for selected wall */}
                  {(() => {
                    const w = walls.find(x => x.id === selectedWallId);
                    if (!w) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => handleDeleteWall(w.id)}>حذف</Button>
                        <Button size="sm" variant="outline" onClick={() => handleMoveWall(w.id)}>تحريك</Button>
                        <Button size="sm" variant="outline" onClick={() => handleWallTextureChange(w.id, w.texture === 'tile' ? 'default' : 'tile')}>لون</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const clone: Wall = { ...w, id: `wall-${Date.now()}`, position: { ...w.position, x: w.position.x + 20 } } as any;
                          setWalls(prev => [...prev, clone]);
                        }}>استنساخ</Button>
                      </div>
                    );
                  })()}
                  {(() => {
                    const w = walls.find(w => w.id === selectedWallId);
                    if (!w) return null;
                    const aspect = w.height > 0 ? Math.max(0.2, Math.min(2, w.width / w.height)) : 1;
                    return (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-2">معاينة الجدار (ثنائي الأبعاد)</div>
                        <div className="border rounded-lg p-2 bg-gray-50">
                          <div className="relative mx-auto" style={{ width: '100%', height: '140px' }}>
                            {/* Wall rectangle */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white border border-gray-300 rounded shadow-inner" style={{ width: `${Math.min(100, 80 * aspect)}%`, height: '80%', position: 'relative' }}>
                                {/* Overlay shelves and columns scaled into this box */}
                                {(() => {
                                  const boxWidth = Math.min(100, 80 * aspect);
                                  const wallPX = boxWidth; // percentage basis
                                  const wallPH = 80; // height percentage of container
                                  const itemsShelves = shelves.filter(s => s.wallId === w.id);
                                  const itemsColumns = columns.filter(c => c.wallId === w.id);
                                  const leftX = w.position.x - w.width/2;
                                  const bottomY = w.position.y - w.height/2;
                                  const toPct = (x: number, total: number) => (x / total) * 100;
                                  return (
                                    <>
                                      {itemsShelves.map(s => {
                                        const relX = s.position.x - leftX - (s.width/2);
                                        const relY = s.position.y - bottomY - (s.height/2);
                                        const xPct = toPct(relX, w.width);
                                        const yPct = 100 - toPct(relY + s.height, w.height); // invert Y for CSS
                                        const wPct = toPct(s.width, w.width);
                                        const hPct = toPct(s.height, w.height);
                                        const isHover = hoveredOverlay?.id === s.id && hoveredOverlay?.type === 'shelf';
                                        return (
                                          <div
                                            key={s.id}
                                            style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, width: `${wPct}%`, height: `${hPct}%` }}
                                            className={`cursor-pointer ${isHover ? 'ring-2 ring-blue-600' : ''}`}
                                            onMouseEnter={() => setHoveredOverlay({ type: 'shelf', id: s.id })}
                                            onMouseLeave={() => setHoveredOverlay(null)}
                                            onClick={() => { setReplaceTarget({ type: 'shelf', id: s.id }); setIsReplaceModalOpen(true); }}
                                          >
                                            <div className="absolute inset-0 bg-primary/25 border border-primary/60" />
                                            {isHover && (
                                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white border border-gray-300 rounded px-2 py-0.5 text-[11px] shadow">
                                                رف {s.width}×{s.height} سم
                                              </div>
                                            )}

      {/* Start Choice Dialog */}
      <Dialog open={isStartChoiceOpen} onOpenChange={setIsStartChoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بدء التصميم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>اختر طريقة بدء الجدران:</p>
            <div className="flex gap-2">
              <Button onClick={() => { setWalls(getDefaultWalls() as any); setIsStartChoiceOpen(false); }}>إضافة 4 جدران افتراضية</Button>
              <Button variant="secondary" onClick={() => { setIsStartChoiceOpen(false); setIsWalls2DOpen(true); }}>فتح المخطط ثنائي الأبعاد</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Walls 2D Planner Modal (mounted globally) */}
      <Walls2DPlannerModal
        open={isWalls2DOpen}
        onOpenChange={setIsWalls2DOpen}
        walls={walls}
        wallSides={wallSides}
        onUpdateWallSize={(id, patch) => {
          setWalls(prev => prev.map(w => w.id === id ? { ...w, ...('name' in patch ? { name: patch.name } : {}),
            width: patch.width ?? w.width,
            height: patch.height ?? w.height,
            depth: patch.depth ?? w.depth } : w));
        }}
        onAddWall={(w) => {
          const id = `wall-${Date.now()}`;
          const name = (w as any).name || `Wall ${walls.filter(x=>x.id!=='floor').length + 1}`;
          const newWall: Wall = { id, name, width: w.width, height: w.height, depth: w.depth, position: w.position as any, rotation: w.rotation as any, texture: w.texture as any, isLocked: true } as any;
          setWalls(prev => [...prev, newWall]);
          setSelectedWallId(id);
        }}
        onUpdateWallPosition={(id, x, z) => {
          setWalls(prev => prev.map(w => w.id === id ? { ...w, position: { ...w.position, x, z } } : w));
          const w = walls.find(w => w.id === id);
          if (w) {
            const dx = x - w.position.x;
            const dz = z - w.position.z;
            if (dx !== 0 || dz !== 0) {
              setShelves(prev => prev.map(s => s.wallId === id ? { ...s, position: { ...s.position, x: s.position.x + dx, z: s.position.z + dz } } as any : s));
              setColumns(prev => prev.map(c => c.wallId === id ? { ...c, position: { ...c.position, x: c.position.x + dx, z: c.position.z + dz } } as any : c));
            }
          }
        }}
        onRotateWall={(id, dy) => {
          setWalls(prev => prev.map(w => w.id === id ? { ...w, rotation: { ...w.rotation, y: (w.rotation?.y || 0) + dy } } : w));
          const w = walls.find(w => w.id === id);
          if (w && dy) {
            const cx = w.position.x;
            const cz = w.position.z;
            const cos = Math.cos(dy);
            const sin = Math.sin(dy);
            setShelves(prev => prev.map(s => {
              if (s.wallId !== id) return s;
              const rx = s.position.x - cx;
              const rz = s.position.z - cz;
              const nx = cx + rx * cos - rz * sin;
              const nz = cz + rx * sin + rz * cos;
              return { ...s, position: { ...s.position, x: nx, z: nz }, rotation: { x: 0, y: (s.rotation?.y || 0) + dy, z: 0 } } as any;
            }));
            setColumns(prev => prev.map(c => {
              if (c.wallId !== id) return c;
              const rx = c.position.x - cx;
              const rz = c.position.z - cz;
              const nx = cx + rx * cos - rz * sin;
              const nz = cz + rx * sin + rz * cos;
              return { ...c, position: { ...c.position, x: nx, z: nz }, rotation: { ...c.rotation, y: (c.rotation?.y || 0) + dy } } as any;
            }));
          }
        }}
        onSetWallRotationAbs={(id, radians) => {
    // three.js vector rotation to guarantee correct handedness
    const w = walls.find(w => w.id === id);
    if (!w) return;
    const current = w.rotation?.y || 0;
    // Invert the angle to fix 2D/3D rotation direction mismatch
    const adjusted = -radians;
    const dy = adjusted - current;
    if (Math.abs(dy) < 1e-6) return;

    setWalls(prev =>
      prev.map(x => (x.id === id ? { ...x, rotation: { ...x.rotation, y: adjusted } } : x))
    );

    const cx = w.position.x;
    const cz = w.position.z;
    const axis = new THREE.Vector3(0, 1, 0);

    setShelves(prev =>
      prev.map(s => {
        if (s.wallId !== id) return s;
        const v = new THREE.Vector3(s.position.x - cx, 0, s.position.z - cz);
        v.applyAxisAngle(axis, -dy);
        return {
          ...s,
          position: { ...s.position, x: cx + v.x, z: cz + v.z },
          rotation: { x: 0, y: adjusted, z: 0 },
        } as any;
      })
    );
    setColumns(prev =>
      prev.map(c => {
        if (c.wallId !== id) return c;
        const v = new THREE.Vector3(c.position.x - cx, 0, c.position.z - cz);
        v.applyAxisAngle(axis, -dy);
        return {
          ...c,
          position: { ...c.position, x: cx + v.x, z: cz + v.z },
          rotation: { ...c.rotation, y: adjusted },
        } as any;
      })
    );
  }}
        onToggleWallSide={(id) => {
          setWallSides(prev => ({ ...prev, [id]: prev[id] === 'back' ? 'front' : 'back' }));
        }}
        onSelectWall={(id) => {
          handleWallClick(id);
          setIsWalls2DOpen(false);
        }}
      />
                                          </div>
                                        );
                                      })}
                                      {itemsColumns.map(c => {
                                        const relX = c.position.x - leftX - (c.width/2);
                                        const relY = c.position.y - bottomY - (c.height/2);
                                        const xPct = toPct(relX, w.width);
                                        const yPct = 100 - toPct(relY + c.height, w.height);
                                        const wPct = toPct(c.width, w.width);
                                        const hPct = toPct(c.height, w.height);
                                        const isHover = hoveredOverlay?.id === c.id && hoveredOverlay?.type === 'column';
                                        return (
                                          <div
                                            key={c.id}
                                            style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, width: `${wPct}%`, height: `${hPct}%` }}
                                            className={`cursor-pointer ${isHover ? 'ring-2 ring-emerald-600' : ''}`}
                                            onMouseEnter={() => setHoveredOverlay({ type: 'column', id: c.id })}
                                            onMouseLeave={() => setHoveredOverlay(null)}
                                            onClick={() => { setReplaceTarget({ type: 'column', id: c.id }); setIsReplaceModalOpen(true); }}
                                          >
                                            <div className="absolute inset-0 bg-emerald-500/25 border border-emerald-500/60" />
                                            {isHover && (
                                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white border border-gray-300 rounded px-2 py-0.5 text-[11px] shadow">
                                                عمود {c.width}×{c.height} سم
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="absolute bottom-1 right-2 text-[11px] text-gray-600">W: {w.width}cm × H: {w.height}cm</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Attached elements list */}
                  {(() => {
                    const w = walls.find(x => x.id === selectedWallId);
                    if (!w) return null;
                    const wShelves = shelves.filter(s => s.wallId === w.id);
                    const wColumns = columns.filter(c => c.wallId === w.id);
                    return (
                      <div className="mt-2">
                        <div className="text-sm font-semibold text-gray-700 mb-1">العناصر المرتبطة</div>
                        {wShelves.length === 0 && wColumns.length === 0 ? (
                          <div className="text-xs text-gray-500">لا توجد عناصر مرتبطة بهذا الجدار</div>
                        ) : (
                          <ul className="text-xs text-gray-700 space-y-1 max-h-28 overflow-auto pr-1">
                            {wShelves.map(s => (
                              <li key={s.id}>رف: {s.width}×{s.height}×{s.depth}cm عند X:{s.position.x} Y:{s.position.y}</li>
                            ))}
                            {wColumns.map(c => (
                              <li key={c.id}>عمود: {c.width}×{c.height}×{c.depth}cm عند X:{c.position.x} Y:{c.position.y}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  <div className="text-sm font-semibold text-gray-700 mt-3">إدراج مُسبق</div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white" onClick={() => setIsInsertModalOpen(true)}>إدراج شبكة أرفف قياسية</Button>
                    <Button variant="outline" onClick={() => addColumn()}>إضافة عمود ذكي واحد</Button>
                    <Button variant="outline" onClick={() => addShelf()}>إضافة رف واحد</Button>
                  </div>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 rounded-lg mb-4 p-1 shadow-inner">
                    <TabsTrigger value="insert" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-white text-gray-600 rounded-lg border border-transparent transition-all duration-300 font-medium py-2">
                      إدراج
                    </TabsTrigger>
                    <TabsTrigger value="view" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-white text-gray-600 rounded-lg border border-transparent transition-all duration-300 font-medium py-2">
                      عرض
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="insert">
                    <div className="mb-3">
                      <label className="text-sm text-gray-700 mb-1 block">الفئة</label>
                      <Select value={insertCategory} onValueChange={(v) => setInsertCategory(v as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="walls">الجدران</SelectItem>
                          <SelectItem value="shelves">الرفوف</SelectItem>
                          <SelectItem value="columns">الأعمدة</SelectItem>
                          <SelectItem value="objects">الأشياء</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {insertCategory === 'shelves' && (
                      <ShelvesPanel
                        shelfWidth={shelfWidth}
                        shelfHeight={shelfHeight}
                        shelfDepth={shelfDepth}
                        shelfPositionX={shelfPositionX}
                        shelfPositionY={shelfPositionY}
                        shelfPositionZ={shelfPositionZ}
                        selectedShelfType={selectedShelfType}
                        shelves={shelves}
                        selectedShelfId={selectedShelfId}
                        setShelfWidth={setShelfWidth}
                        setShelfHeight={setShelfHeight}
                        setShelfDepth={setShelfDepth}
                        setShelfPositionX={setShelfPositionX}
                        setShelfPositionY={setShelfPositionY}
                        setShelfPositionZ={setShelfPositionZ}
                        setSelectedShelfType={setSelectedShelfType}
                        updateSelectedShelf={updateSelectedShelf}
                        addShelf={addShelf}
                        handleShelfClick={handleShelfClick}
                        removeShelf={removeShelf}
                        calculateShelfQuantity={() => perWallShelvesPerRow}
                      />
                    )}

                    {insertCategory === 'walls' && (
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200">
                          <CardTitle className="text-gray-800">إدراج جدار جديد</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4">
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <div className="text-xs text-gray-600 mb-1">العرض (سم)</div>
                              <input className="w-full border rounded px-2 py-1 text-sm" type="number" value={wallWidth} onChange={e=>setWallWidth(Math.max(1, Number(e.target.value)||1))} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">الارتفاع (سم)</div>
                              <input className="w-full border rounded px-2 py-1 text-sm" type="number" value={wallHeight} onChange={e=>setWallHeight(Math.max(1, Number(e.target.value)||1))} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">السمك (سم)</div>
                              <input className="w-full border rounded px-2 py-1 text-sm" type="number" value={wallDepth} onChange={e=>setWallDepth(Math.max(1, Number(e.target.value)||1))} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button className="bg-primary hover:bg-primary" onClick={addNewWall}>إضافة جدار</Button>
                            <Button variant="outline" onClick={resetToDefaultWalls}>استعادة 4 جدران افتراضية</Button>
                          </div>
                          <div>
                            <Button
                              className="w-full mt-2"
                              variant="secondary"
                              onClick={() => {
                                // eslint-disable-next-line no-console

                                setIsWalls2DOpen(true);
                              }}
                            >
                              عرض مخطط الجدران (2D)
                            </Button>
                          </div>
                          <div>
                            <Button className="w-full" variant="ghost" onClick={() => setIsStartChoiceOpen(true)}>بدء</Button>
                          </div>
                          <div className="text-xs text-gray-500">ملاحظة: يمكن تعديل موقع الجدار واتجاهه بعد الإدراج من خلال وضع التحريك.</div>
                        </CardContent>
                      </Card>
                    )}

                    {insertCategory === 'columns' && (
                      <ColumnsPanel
                        columns={columns}
                        selectedColumnId={selectedColumnId}
                        columnWidth={columnWidth}
                        columnHeight={columnHeight}
                        columnDepth={columnDepth}
                        columnPositionX={columnPositionX}
                        columnPositionY={columnPositionY}
                        columnPositionZ={columnPositionZ}
                        columnIsLocked={columnIsLocked}
                        setColumnWidth={setColumnWidth}
                        setColumnHeight={setColumnHeight}
                        setColumnDepth={setColumnDepth}
                        setColumnPositionX={setColumnPositionX}
                        setColumnPositionY={setColumnPositionY}
                        setColumnPositionZ={setColumnPositionZ}
                        setColumnIsLocked={setColumnIsLocked}
                        updateSelectedColumn={updateSelectedColumn}
                        handleColumnClick={handleColumnClick}
                        removeColumn={removeColumn}
                        toggleColumnLock={() => setColumnIsLocked(v => !v)}
                        addColumn={addColumn}
                        addSmartColumn={addColumn}
                      />
                    )}

                    {insertCategory === 'objects' && (
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200">
                          <CardTitle className="flex items-center text-gray-800">
                            <Archive className="mr-2 text-primary" /> أشياء الغرفة
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-500">أضف الأثاث والأشياء الأخرى إلى غرفتك</p>
                          <Button className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-lg border border-gray-300 font-medium">
                            قريباً
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="view">
                    <div className="space-y-4">
                      {/* Walls Card */}
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="flex items-center justify-between text-gray-800 text-[15px]">
                            <span>الجدران</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {walls.filter(w=>w.id!=="floor").length}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                          {walls.filter(w=>w.id!=="floor").length === 0 ? (
                            <div className="text-xs text-gray-500">لا توجد جدران مُضافة</div>
                          ) : (
                            <div className="space-y-2">
                              {walls.filter(w=>w.id!=="floor").map(w => (
                                <div key={w.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{w.name}</span>
                                    <span className="text-[11px] text-gray-600">{w.width}×{w.height}×{w.depth} سم</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => handleWallClick(w.id)}>
                                          <Pointer size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>تحديد</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => handleMoveWall(w.id)}>
                                          <MoveRight size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>تحريك</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => setWalls(prev=>[...prev, {...w, id:`wall-${Date.now()}`, position:{...w.position, x:w.position.x+20}} as any])}>
                                          <Copy size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>استنساخ</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDeleteWall(w.id)}>
                                          <Trash2 size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>حذف</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Shelves Card */}
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="flex items-center justify-between text-gray-800 text-[15px]">
                            <span>الرفوف</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              {shelves.length}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                          {shelves.length === 0 ? (
                            <div className="text-xs text-gray-500">لا توجد رفوف مُضافة</div>
                          ) : (
                            <div className="space-y-2">
                              {shelves.map(s => (
                                <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                                  <div className="flex flex-col">
                                    <span className="font-medium">رف</span>
                                    <span className="text-[11px] text-gray-600">{s.width}×{s.height}×{s.depth} سم</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => handleShelfClick(s.id)}>
                                          <Pointer size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>تحديد</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => setShelves(prev=>[...prev, {...s, id:`shelf-${Date.now()}`, position:{...s.position, x:s.position.x+10}} as any])}>
                                          <Copy size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>استنساخ</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => removeShelf(s.id)}>
                                          <Trash2 size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>حذف</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Columns Card */}
                      <Card className="border border-gray-200">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="flex items-center justify-between text-gray-800 text-[15px]">
                            <span>الأعمدة</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              {columns.length}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                          {columns.length === 0 ? (
                            <div className="text-xs text-gray-500">لا توجد أعمدة مُضافة</div>
                          ) : (
                            <div className="space-y-2">
                              {columns.map(c => (
                                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                                  <div className="flex flex-col">
                                    <span className="font-medium">عمود</span>
                                    <span className="text-[11px] text-gray-600">{c.width}×{c.height}×{c.depth} سم</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => handleColumnClick(c.id)}>
                                          <Pointer size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>تحديد</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => setColumns(prev=>[...prev, {...c, id:`column-${Date.now()}`, position:{...c.position, x:c.position.x+10}} as any])}>
                                          <Copy size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>استنساخ</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => removeColumn(c.id)}>
                                          <Trash2 size={16} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>حذف</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              )
            )}
          </div>
        </div>

        {/* 3D View */}
        <div className="flex-1 relative overflow-y-scroll min-h-0" style={{ scrollbarGutter: 'stable both-edges' }}>
          <Canvas key={canvasKey} camera={{ position: [0, 60, 100], fov: 32 }} style={{ width: '100%', height: '100%' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[100, 200, 100]} intensity={1} />

            <Room
              walls={walls}
              shelves={shelves}
              columns={columns}
              onWallClick={handleWallClick}
              onShelfClick={handleShelfClick}
              onColumnClick={handleColumnClick}
              onDeleteWall={handleDeleteWall}
              onMoveWall={handleMoveWall}
              onColorWall={() => { /* texture handled in panel and controls */ }}
              onWallTextureChange={handleWallTextureChange}
              selectedWallId={selectedWallId}
              selectedShelfId={selectedShelfId}
              selectedColumnId={selectedColumnId}
              showMovementController={showMovementController}
              onCloneWall={(id) => {
                const w = walls.find(x => x.id === id);
                if (!w) return;
                const clone: Wall = { ...w, id: `wall-${Date.now()}`, position: { ...w.position, x: w.position.x + 20 } } as any;
                setWalls(prev => [...prev, clone]);
              }}
              onQuitWall={() => { setSelectedWallId(null); setShowMovementController(false); }}
              onMoveShelf={(id) => { setMovingObject({ type: 'shelf', id }); setSelectedShelfId(id); setActiveTab('insert'); setInsertCategory('shelves'); setIsControlsCollapsed(true); }}
              onEditShelf={(id) => { setSelectedShelfId(id); setActiveTab('insert'); setInsertCategory('shelves'); setIsControlsCollapsed(true); }}
              onDeleteShelf={(id) => { removeShelf(id); setIsControlsCollapsed(true); }}
              onCloneShelf={(id) => {
                const s = shelves.find(x => x.id === id);
                if (!s) return;
                const clone: Shelf = { ...s, id: `shelf-${Date.now()}`, position: { ...s.position, x: s.position.x + 10 } } as any;
                setShelves(prev => [...prev, clone]);
                setIsControlsCollapsed(true);
              }}
              onQuitShelf={() => { setSelectedShelfId(null); }}
              onMoveColumn={(id) => { setMovingObject({ type: 'column', id }); setSelectedColumnId(id); setActiveTab('insert'); setInsertCategory('columns'); setIsControlsCollapsed(true); }}
              onEditColumn={(id) => { setSelectedColumnId(id); setActiveTab('insert'); setInsertCategory('columns'); setIsControlsCollapsed(true); }}
              onDeleteColumn={(id) => { removeColumn(id); setIsControlsCollapsed(true); }}
              onCloneColumn={(id) => {
                const c = columns.find(x => x.id === id);
                if (!c) return;
                const clone: Column = { ...c, id: `column-${Date.now()}`, position: { ...c.position, x: c.position.x + 10 } } as any;
                setColumns(prev => [...prev, clone]);
                setIsControlsCollapsed(true);
              }}
              onQuitColumn={() => { setSelectedColumnId(null); }}
            />

            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
              minDistance={1}
              maxDistance={3000}
            />

            {showMovementController && selectedWallId && selectedWallId !== 'floor' && (
              <ThreeDMovementController
                onMove={handle3DMovement}
                onRotate={handle3DRotation}
                onQuit={() => { setShowMovementController(false); setSelectedWallId(null); }}
                isVisible={showMovementController}
                position={[0, 0, 0]}
              />
            )}
            {movingObject && (
              <ThreeDMovementController
                onMove={handle3DMovement}
                onRotate={() => { /* no rotation for objects */ }}
                onQuit={() => setMovingObject(null)}
                isVisible={true}
                position={[0, 0, 0]}
              />
            )}
          </Canvas>
          {/* Floating actions: Reload 3D and Settings */}
          <div className="absolute top-2 right-2 z-20 flex gap-2">
            <Button size="icon" variant="secondary" className="rounded-full shadow" onClick={() => setCanvasKey(k => k + 1)} title="إعادة تحميل المشهد ثلاثي الأبعاد">
              <RotateCw size={18} />
            </Button>
            <Button size="icon" variant="secondary" className="rounded-full shadow" onClick={() => setIsSettingsOpen(true)} title="الإعدادات">
              <Settings size={18} />
            </Button>
          </div>
        </div>
      </div>
      <Walls2DPlannerModal
        open={isWalls2DOpen}
        onOpenChange={setIsWalls2DOpen}
        walls={walls}
        wallSides={wallSides}
        onUpdateWallSize={(id, patch) => {
          setWalls(prev => prev.map(w => w.id === id ? { ...w, ...('name' in patch ? { name: patch.name } : {}),
            width: patch.width ?? w.width,
            height: patch.height ?? w.height,
            depth: patch.depth ?? w.depth } : w));
        }}
        onAddWall={(w) => {
          const id = `wall-${Date.now()}`;
          const name = (w as any).name || `Wall ${walls.filter(x=>x.id!=='floor').length + 1}`;
          const newWall: Wall = { id, name, width: w.width, height: w.height, depth: w.depth, position: w.position as any, rotation: w.rotation as any, texture: w.texture as any, isLocked: true } as any;
          setWalls(prev => [...prev, newWall]);
          setSelectedWallId(id);
        }}
        onUpdateWallPosition={(id, x, z) => {
          const wPrev = walls.find(w => w.id === id);
          const dx = wPrev ? x - wPrev.position.x : 0;
          const dz = wPrev ? z - wPrev.position.z : 0;
          setWalls(prev => prev.map(w => w.id === id ? { ...w, position: { ...w.position, x, z } } : w));
          if (dx !== 0 || dz !== 0) {
            setShelves(prev => prev.map(s => s.wallId === id ? { ...s, position: { ...s.position, x: s.position.x + dx, z: s.position.z + dz } } as any : s));
            setColumns(prev => prev.map(c => c.wallId === id ? { ...c, position: { ...c.position, x: c.position.x + dx, z: c.position.z + dz } } as any : c));
          }
        }}
        onRotateWall={(id, dy) => {
          const wPrev = walls.find(w => w.id === id);
          setWalls(prev => prev.map(w => w.id === id ? { ...w, rotation: { ...w.rotation, y: (w.rotation?.y || 0) + dy } } : w));
          if (wPrev && dy) {
            const cx = wPrev.position.x;
            const cz = wPrev.position.z;
            const cos = Math.cos(dy);
            const sin = Math.sin(dy);
            setShelves(prev => prev.map(s => {
              if (s.wallId !== id) return s;
              const rx = s.position.x - cx;
              const rz = s.position.z - cz;
              const nx = cx + rx * cos - rz * sin;
              const nz = cz + rx * sin + rz * cos;
              return { ...s, position: { ...s.position, x: nx, z: nz }, rotation: { x: 0, y: (s.rotation?.y || 0) + dy, z: 0 } } as any;
            }));
            setColumns(prev => prev.map(c => {
              if (c.wallId !== id) return c;
              const rx = c.position.x - cx;
              const rz = c.position.z - cz;
              const nx = cx + rx * cos - rz * sin;
              const nz = cz + rx * sin + rz * cos;
              return { ...c, position: { ...c.position, x: nx, z: nz }, rotation: { ...c.rotation, y: (c.rotation?.y || 0) + dy } } as any;
            }));
          }
        }}
        onToggleWallSide={(id) => {
          setWallSides(prev => ({ ...prev, [id]: prev[id] === 'back' ? 'front' : 'back' }));
        }}
        onSelectWall={(id) => {
          handleWallClick(id);
          setIsWalls2DOpen(false);
        }}
      />
      {/* Insert Modal */}
      {selectedWallId && (
        <ShelfColumnInsertModal
          wall={walls.find(w => w.id === selectedWallId)!}
          preconfiguredShelves={PRECONFIGURED_SHELVES}
          preconfiguredColumns={PRECONFIGURED_COLUMNS}
          isOpen={isInsertModalOpen}
          onClose={() => setIsInsertModalOpen(false)}
          onInsert={(config) => { insertShelvesAndColumns(config); setIsInsertModalOpen(false); }}
        />
      )}
      {/* Delete Wall Modal */}
      {isDeleteModalOpen && deleteTargetWallId && (
        <Dialog open={isDeleteModalOpen} onOpenChange={() => setIsDeleteModalOpen(false)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>حذف الجدار</DialogTitle>
            </DialogHeader>
            {(() => {
              const w = walls.find(x => x.id === deleteTargetWallId);
              const attachShelves = shelves.filter(s => s.wallId === deleteTargetWallId);
              const attachColumns = columns.filter(c => c.wallId === deleteTargetWallId);
              return (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">هل تريد حذف هذا الجدار{w ? ` (${w.name})` : ''} مع العناصر المرتبطة به؟</div>
                  <div className="bg-gray-50 border rounded p-3">
                    <div className="font-semibold text-sm mb-1">العناصر المرتبطة</div>
                    {attachShelves.length === 0 && attachColumns.length === 0 ? (
                      <div className="text-xs text-gray-500">لا توجد عناصر مرتبطة</div>
                    ) : (
                      <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-auto pr-1">
                        {attachShelves.map(s => (
                          <li key={s.id}>رف: {s.width}×{s.height}×{s.depth}cm عند X:{s.position.x} Y:{s.position.y}</li>
                        ))}
                        {attachColumns.map(c => (
                          <li key={c.id}>عمود: {c.width}×{c.height}×{c.depth}cm عند X:{c.position.x} Y:{c.position.y}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => confirmDeleteWall(false)}>حذف الجدار فقط</Button>
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => confirmDeleteWall(true)}>حذف مع العناصر</Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
      {/* Settings Modal */}
      {isSettingsOpen && (
        <Dialog open={isSettingsOpen} onOpenChange={() => setIsSettingsOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>الإعدادات</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Button variant="outline" onClick={() => { setSelectedWallId(null); setSelectedShelfId(null); setSelectedColumnId(null); setShowMovementController(false); setMovingObject(null); setIsSettingsOpen(false); }}>
                إنهاء التصميم (إلغاء التحديد)
              </Button>
              <Button className="bg-primary hover:bg-primary" onClick={() => { resetToDefaultWalls(); setIsSettingsOpen(false); }}>
                العودة إلى الوضع الافتراضي (4 جدران)
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveToServer}>
                حفظ المشروع
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default RoomPlanner3D_v2;
