import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopBuilderProvider, useShopBuilder } from './store';
import FloorplanCanvas from './floorplan/FloorplanCanvas';
import ThreeScene, { type ThreeSceneHandle, type TransformMode, WALL_TEXTURES } from './three/ThreeScene';
import BuilderToolbar from './ui/BuilderToolbar';
import { SceneItemsList } from './ui/SceneItemsList';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, X, Focus, Palette, Edit2, RotateCcw, ArrowDown, Store, MapPin, Phone, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useShopSetup } from '@/hooks/useShopSetup';
import { useTheme } from '@/context/ThemeContext';

const DEFAULT_TRANSFORM_MODE: TransformMode = 'translate';

// Helper to format Gregorian date and time
const formatGregorianDateTime = () => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  return { timeStr, dateStr };
};

// Wall texture options - mapped from WALL_TEXTURES
const WALL_TEXTURE_OPTIONS = [
  { key: '', label: 'افتراضي', preview: null },
  ...Object.entries(WALL_TEXTURES).map(([key, config]) => ({
    key,
    label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    preview: config.preview || config.map,
  })),
];

// Product texture options - Using simple color-based textures (data URLs for guaranteed loading)
const TEXTURE_OPTIONS = [
  { value: '', label: 'افتراضي', preview: null },
  {
    value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id29vZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiM4QjczNTIiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjEwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjxyZWN0IHg9IjIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjMwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjd29vZCkiLz48L3N2Zz4=',
    label: 'خشب بني',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id29vZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiM4QjczNTIiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjEwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjxyZWN0IHg9IjIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjMwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjd29vZCkiLz48L3N2Zz4='
  },
  {
    value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWFyYmxlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMCw1MCBRMjUsMzAgNTAsNTAgVDEwMCw1MCIgc3Ryb2tlPSIjREREIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCw3MCBRMzAsNjAgNjAsNzAgVDEwMCw3MCIgc3Ryb2tlPSIjRTBFMEUwIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ1cmwoI21hcmJsZSkiLz48L3N2Zz4=',
    label: 'رخام أبيض',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWFyYmxlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMCw1MCBRMjUsMzAgNTAsNTAgVDEwMCw1MCIgc3Ryb2tlPSIjREREIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCw3MCBRMzAsNjAgNjAsNzAgVDEwMCw3MCIgc3Ryb2tlPSIjRTBFMEUwIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ1cmwoI21hcmJsZSkiLz48L3N2Zz4='
  },
  {
    value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYnJpY2siIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjQjI0QTNEIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjMyIiB5PSIwIiB3aWR0aD0iMjgiIGhlaWdodD0iMTQiIGZpbGw9IiNDOTVBNEIiIHN0cm9rZT0iIzhBMzMyOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iLTE0IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYnJpY2spIi8+PC9zdmc+',
    label: 'طوب أحمر',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYnJpY2siIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjQjI0QTNEIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjMyIiB5PSIwIiB3aWR0aD0iMjgiIGhlaWdodD0iMTQiIGZpbGw9IiNDOTVBNEIiIHN0cm9rZT0iIzhBMzMyOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iLTE0IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYnJpY2spIi8+PC9zdmc+'
  },
  {
    value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iY29uY3JldGUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjQTBBMEEwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0iIzg4ODg4OCIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0iIzk1OTU5NSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iNDAiIHI9IjIiIGZpbGw9IiM4ODg4ODgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjM1IiByPSIxIiBmaWxsPSIjOTU5NTk1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNjb25jcmV0ZSkiLz48L3N2Zz4=',
    label: 'خرسانة',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iY29uY3JldGUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjQTBBMEEwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0iIzg4ODg4OCIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0iIzk1OTU5NSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iNDAiIHI9IjIiIGZpbGw9IiM4ODg4ODgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjM1IiByPSIxIiBmaWxsPSIjOTU5NTk1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNjb25jcmV0ZSkiLz48L3N2Zz4='
  },
  {
    value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWV0YWwiIHdpZHRoPSI0IiBoZWlnaHQ9IjUxMiIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjQiIGhlaWdodD0iNTEyIiBmaWxsPSIjQzBDMEMwIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iNTEyIiBmaWxsPSIjRDBEMEQwIi8+PHJlY3QgeD0iMyIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iNTEyIiBmaWxsPSIjQjBCMEIwIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNtZXRhbCkiLz48L3N2Zz4=',
    label: 'معدن',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWV0YWwiIHdpZHRoPSI0IiBoZWlnaHQ9IjUxMiIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjQiIGhlaWdodD0iNTEyIiBmaWxsPSIjQzBDMEMwIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iNTEyIiBmaWxsPSIjRDBEMEQwIi8+PHJlY3QgeD0iMyIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iNTEyIiBmaWxsPSIjQjBCMEIwIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNtZXRhbCkiLz48L3N2Zz4='
  },
];

const ShopBuilderContent = () => {
  const [transformMode, setTransformMode] = useState<TransformMode>(DEFAULT_TRANSFORM_MODE);
  const threeRef = useRef<ThreeSceneHandle | null>(null);

  // Scrubby slider state
  const scrubbyState = useRef<{
    active: boolean;
    startX: number;
    startValue: number;
    field: string;
    step: number;
    callback: (value: number) => void;
  } | null>(null);

  // Texture dropdown state
  const [showProductTextureDropdown, setShowProductTextureDropdown] = useState(false);
  const [showWallTextureDropdown, setShowWallTextureDropdown] = useState(false);

  const { toast } = useToast();

  const {
    layout,
    selectProduct,
    selectWall,
    selectedProductId,
    selectedWallId,
    selectedColumnId,
    selectColumn,
    upsertProduct,
    cameraMode,
    setCameraMode,
    removeProduct,
    upsertWall,
    removeWall,
    addColumnToWall,
    removeColumn,
    isDrawingMode,
    setDrawingMode
  } = useShopBuilder();

  // Undo/Redo history - Track complete layout snapshots
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoingRef = useRef(false);
  const lastSavedStateRef = useRef<string>('');

  // Initialize history with first state
  useEffect(() => {
    if (history.length === 0) {
      const initialState = JSON.parse(JSON.stringify(layout));
      setHistory([initialState]);
      setHistoryIndex(0);
      lastSavedStateRef.current = JSON.stringify(initialState);
    }
  }, []);

  // Save state to history when layout changes (but not during undo/redo)
  useEffect(() => {
    if (isUndoRedoingRef.current || history.length === 0) return;

    const newStateStr = JSON.stringify(layout);

    // Only save if state actually changed
    if (newStateStr !== lastSavedStateRef.current) {
      const newState = JSON.parse(newStateStr);
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newState);
        return newHistory.slice(-100); // Keep last 100 states
      });
      setHistoryIndex(prev => prev + 1);
      lastSavedStateRef.current = newStateStr;
    }
  }, [layout, historyIndex, history.length]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoingRef.current = true;
      const prevState = history[historyIndex - 1];

      // Clear current state
      const currentWalls = [...layout.walls];
      const currentProducts = [...layout.products];
      currentWalls.forEach(w => removeWall(w.id));
      currentProducts.forEach(p => removeProduct(p.id));

      // Apply previous state
      setTimeout(() => {
        prevState.walls.forEach((w: any) => upsertWall(w));
        prevState.products.forEach((p: any) => upsertProduct(p));
        setHistoryIndex(historyIndex - 1);
        lastSavedStateRef.current = JSON.stringify(prevState);
        setTimeout(() => {
          isUndoRedoingRef.current = false;
        }, 50);
      }, 50);
    }
  }, [historyIndex, history, layout, upsertWall, upsertProduct, removeWall, removeProduct]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoingRef.current = true;
      const nextState = history[historyIndex + 1];

      // Clear current state
      const currentWalls = [...layout.walls];
      const currentProducts = [...layout.products];
      currentWalls.forEach(w => removeWall(w.id));
      currentProducts.forEach(p => removeProduct(p.id));

      // Apply next state
      setTimeout(() => {
        nextState.walls.forEach((w: any) => upsertWall(w));
        nextState.products.forEach((p: any) => upsertProduct(p));
        setHistoryIndex(historyIndex + 1);
        lastSavedStateRef.current = JSON.stringify(nextState);
        setTimeout(() => {
          isUndoRedoingRef.current = false;
        }, 50);
      }, 50);
    }
  }, [historyIndex, history, layout, upsertWall, upsertProduct, removeWall, removeProduct]);

  // Auto-enter fullscreen when wall mode is activated (only on initial entry)
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const shouldExitFullscreenRef = useRef(false);

  useEffect(() => {
    const floorplanDiv = floorplan2DRef.current;
    if (!floorplanDiv) return;

    if (isDrawingMode && !hasEnteredFullscreen) {
      // Enter fullscreen only on first entry
      if (floorplanDiv.requestFullscreen) {
        floorplanDiv.requestFullscreen().catch(err => {

        });
        setHasEnteredFullscreen(true);
      }
    } else if (!isDrawingMode && shouldExitFullscreenRef.current) {
      // Only exit fullscreen if explicitly requested (not on toggle)
      shouldExitFullscreenRef.current = false;
      setHasEnteredFullscreen(false);
      if (document.fullscreenElement === floorplanDiv) {
        document.exitFullscreen().catch(err => {

        });
      }
    }
  }, [isDrawingMode, hasEnteredFullscreen]);

  // Exit wall mode when fullscreen is exited via ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      const floorplanDiv = floorplan2DRef.current;
      if (!floorplanDiv) return;

      // If fullscreen was exited (ESC pressed), exit drawing mode
      if (document.fullscreenElement !== floorplanDiv && hasEnteredFullscreen) {
        shouldExitFullscreenRef.current = true;
        setDrawingMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [hasEnteredFullscreen, setDrawingMode]);
  const [is2DFullscreen, setIs2DFullscreen] = useState(false);
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);
  const floorplan2DRef = useRef<HTMLDivElement | null>(null);
  const three3DRef = useRef<HTMLDivElement | null>(null);

  const handleResetCamera = useCallback(() => {
    threeRef.current?.resetCamera();
  }, []);

  // Scrubby slider handlers
  const handleScrubbyStart = useCallback((e: React.MouseEvent, startValue: number, step: number, callback: (value: number) => void) => {
    e.preventDefault();
    scrubbyState.current = {
      active: true,
      startX: e.clientX,
      startValue,
      field: 'scrubby',
      step,
      callback
    };
    document.body.style.cursor = 'ew-resize';
  }, []);

  const handleScrubbyMove = useCallback((e: MouseEvent) => {
    if (!scrubbyState.current?.active) return;
    const deltaX = e.clientX - scrubbyState.current.startX;
    const steps = Math.round(deltaX / 5); // 5px = 1 step
    const newValue = scrubbyState.current.startValue + (steps * scrubbyState.current.step);
    scrubbyState.current.callback(newValue);
  }, []);

  const handleScrubbyEnd = useCallback(() => {
    if (scrubbyState.current) {
      scrubbyState.current.active = false;
      document.body.style.cursor = '';
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleScrubbyMove);
    document.addEventListener('mouseup', handleScrubbyEnd);
    return () => {
      document.removeEventListener('mousemove', handleScrubbyMove);
      document.removeEventListener('mouseup', handleScrubbyEnd);
    };
  }, [handleScrubbyMove, handleScrubbyEnd]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.texture-dropdown')) {
        setShowProductTextureDropdown(false);
        setShowWallTextureDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSnapshot = useCallback(async () => {
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;

      // Get the 3D snapshot first
      const threeSnapshot = threeRef.current?.snapshot();

      // Get the main container
      const container = (document.querySelector('[data-shop-builder-container]') || document.body) as HTMLElement;

      // Get the 3D container element
      const threeContainer = container.querySelector('[data-three-container]') as HTMLElement;

      // Hide the 3D container temporarily
      let originalDisplay = '';
      if (threeContainer) {
        originalDisplay = threeContainer.style.display;
        threeContainer.style.display = 'none';
      }

      // Capture the page without the 3D view
      const pageCanvas = await html2canvas(container, {
        allowTaint: true,
        useCORS: true,
        scale: 1.2,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDocument) => {
          const allElements = clonedDocument.querySelectorAll('*');
          allElements.forEach((el: any) => {
            el.style.visibility = 'visible';
            el.style.opacity = '1';
          });
        },
      });

      // Restore the 3D container
      if (threeContainer) {
        threeContainer.style.display = originalDisplay;
      }

      // If we have a 3D snapshot, create a combined image
      if (threeSnapshot) {
        // Create a new canvas to combine both images
        const combinedCanvas = document.createElement('canvas');
        const ctx = combinedCanvas.getContext('2d');
        if (!ctx) return pageCanvas.toDataURL('image/png');

        // Set canvas size to match page canvas
        combinedCanvas.width = pageCanvas.width;
        combinedCanvas.height = pageCanvas.height;

        // Draw the page canvas
        ctx.drawImage(pageCanvas, 0, 0);

        // Find where the 3D container is and draw the 3D snapshot there
        const threeImg = new Image();
        threeImg.onload = () => {
          // Calculate position and size of 3D container in the screenshot
          if (threeContainer) {
            const rect = threeContainer.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scale = 1.2; // Same scale as html2canvas

            const x = (rect.left - containerRect.left) * scale;
            const y = (rect.top - containerRect.top) * scale;
            const width = rect.width * scale;
            const height = rect.height * scale;

            ctx.drawImage(threeImg, x, y, width, height);
          }
        };
        threeImg.src = threeSnapshot;

        return combinedCanvas.toDataURL('image/png');
      }

      return pageCanvas.toDataURL('image/png');
    } catch (error) {
      // Fallback to 3D canvas snapshot
      console.warn('html2canvas error:', error, 'using 3D snapshot fallback');
      return threeRef.current?.snapshot();
    }
  }, []);

  const handleSnapshotDownload = useCallback(() => {
    const dataUrl = threeRef.current?.snapshot();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `shop-layout-${Date.now()}.png`;
    link.click();
  }, []);

  const handleFullscreen = useCallback(() => {
    threeRef.current?.toggleFullscreen();
  }, []);

  const handleClearSelection = useCallback(() => {
    selectProduct(null);
    selectWall(null);
  }, [selectProduct, selectWall]);

  const toggle2DFullscreen = useCallback(() => {
    if (!floorplan2DRef.current) return;
    if (!is2DFullscreen) {
      floorplan2DRef.current.requestFullscreen?.();
      setIs2DFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIs2DFullscreen(false);
    }
  }, [is2DFullscreen]);

  const toggle3DFullscreen = useCallback(() => {
    if (!three3DRef.current) return;
    if (!is3DFullscreen) {
      three3DRef.current.requestFullscreen?.();
      setIs3DFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIs3DFullscreen(false);
    }
  }, [is3DFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIs2DFullscreen(false);
        setIs3DFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Function to focus camera on selected product
  const handleFocusOnProduct = useCallback((productId: string) => {
    const product = layout.products.find(p => p.id === productId);
    if (!product || !threeRef.current) return;

    threeRef.current.focusOnProduct(productId);
  }, [layout.products]);

  const { primaryColor, secondaryColor } = useTheme();
  const { timeStr, dateStr } = formatGregorianDateTime();
  const [currentTime, setCurrentTime] = useState(timeStr);
  const [currentDate, setCurrentDate] = useState(dateStr);

  useEffect(() => {
    const timer = setInterval(() => {
      const { timeStr: newTime, dateStr: newDate } = formatGregorianDateTime();
      setCurrentTime(newTime);
      setCurrentDate(newDate);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen text-slate-900 relative overflow-y-auto" style={{ background: `linear-gradient(135deg, ${primaryColor}08 0%, ${secondaryColor}08 100%)` }} dir="rtl" data-shop-builder-container>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative">
        {/* Modern Professional Header */}
        <header className="pt-4 pb-2 lg:pt-6 lg:pb-4">
          <div className="rounded-2xl shadow-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
            <div className="p-4 lg:p-6 text-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                {/* Left: Shop Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium opacity-90">Shop Name</p>
                    <p className="text-2xl font-bold">{layout.shopName || 'Your Shop'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium opacity-90">Category</p>
                    <p className="text-lg font-semibold">{layout.field || 'Not Set'}</p>
                  </div>
                </div>

                {/* Center: Divider */}
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-px h-24" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}></div>
                </div>

                {/* Right: Date & Time */}
                <div className="space-y-4 md:text-right">
                  <div>
                    <p className="text-sm font-medium opacity-90">Current Time</p>
                    <p className="text-2xl font-bold font-mono">{currentTime}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium opacity-90">Date</p>
                    <p className="text-lg font-semibold">{currentDate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div>
          <BuilderToolbar
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onResetCamera={handleResetCamera}
            onSnapshot={handleSnapshot}
            onFullscreen={handleFullscreen}
            onClearSelection={handleClearSelection}
          />
        </div>

        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
          <div ref={floorplan2DRef} className={cn(
            "rounded-2xl border-2 bg-white p-4 shadow-xl h-[400px] lg:h-[600px] flex flex-col relative transition-all duration-300",
            isDrawingMode
              ? `ring-2 shadow-lg`
              : "border-slate-300"
          )}
            style={isDrawingMode ? { borderColor: primaryColor, backgroundColor: `${primaryColor}05`, boxShadow: `0 0 20px ${primaryColor}30` } : {}}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: primaryColor }}>مُحرِّر المخطط ثنائي الأبعاد</h2>
                {isDrawingMode && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full animate-pulse text-white" style={{ backgroundColor: primaryColor, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'white' }}></span>
                    وضع الرسم
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggle2DFullscreen}
                className="h-7 w-7 p-0 transition-all"
                style={{ color: primaryColor, hover: { backgroundColor: `${primaryColor}10` } }}
              >
                {is2DFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <FloorplanCanvas />
            </div>

            {/* Fullscreen Controls Overlay - Visible when fullscreen is active */}
            {(is2DFullscreen || hasEnteredFullscreen) && (
              <div className="absolute top-16 right-4 flex items-center gap-2 z-50 pointer-events-auto">
                {/* Undo/Redo Buttons */}
                <div className="flex items-center gap-1 bg-white rounded-lg border-2 p-1 shadow-lg" style={{ borderColor: primaryColor }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="h-8 w-8 p-0 disabled:opacity-30 transition-all"
                    style={{ color: primaryColor }}
                    title="تراجع"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6" style={{ backgroundColor: primaryColor }} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="h-8 w-8 p-0 disabled:opacity-30 transition-all"
                    style={{ color: primaryColor }}
                    title="إعادة"
                  >
                    <RotateCcw className="h-4 w-4 scale-x-[-1]" />
                  </Button>
                </div>

                {/* Edit Mode Toggle */}
                <Button
                  onClick={() => {
                    setDrawingMode(!isDrawingMode);
                  }}
                  className="flex items-center gap-2 font-semibold h-10 px-4 transition-all shadow-lg text-white"
                  style={{
                    background: isDrawingMode ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` : `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                  {isDrawingMode ? 'وضع التحرير' : 'وضع الرسم'}
                </Button>
              </div>
            )}

            {/* Selection Panel Copy - Visible when fullscreen is active and wall is selected */}
            {(is2DFullscreen || hasEnteredFullscreen) && selectedWallId && !selectedColumnId && !selectedProductId && (() => {
              const wall = layout.walls.find(w => w.id === selectedWallId);
              if (!wall) return null;

              return (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto w-full max-w-3xl px-4">
                  <div className="bg-white rounded-xl shadow-2xl overflow-visible" style={{ border: `2px solid ${primaryColor}` }}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 w-full sm:w-auto" dir="rtl">
                      {/* Wall Name Badge */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm text-white" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
                        <span className="text-sm font-bold">🧱 جدار</span>
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />

                      {/* Height Control */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>📏 ارتفاع (م)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={(wall.height || 3).toFixed(1)}
                          onChange={(e) => {
                            const height = Number(e.target.value);
                            upsertWall({ id: wall.id, height });
                          }}
                          className="w-16 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                          style={{ border: `1px solid ${primaryColor}40`, focusRing: `1px solid ${primaryColor}` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />

                      {/* Thickness Control */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>📐 سمك (م)</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={(wall.thickness || 0.2).toFixed(2)}
                          onChange={(e) => {
                            const thickness = Number(e.target.value);
                            upsertWall({ id: wall.id, thickness });
                          }}
                          className="w-16 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                          style={{ border: `1px solid ${primaryColor}40`, focusRing: `1px solid ${primaryColor}` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />

                      {/* Color Picker */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>🎨 لون</label>
                        <input
                          type="color"
                          value={wall.color || '#64748b'}
                          onChange={(e) => upsertWall({ id: wall.id, color: e.target.value })}
                          className="w-12 h-9 rounded-lg cursor-pointer shadow-sm"
                          style={{ border: `1px solid ${primaryColor}40` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          removeWall(wall.id);
                          selectWall(null);
                        }}
                        className="h-9 px-3 text-xs font-semibold text-white rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                        style={{ background: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)` }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div ref={three3DRef} className="rounded-2xl border-2 bg-white shadow-xl h-[400px] lg:h-[600px] flex flex-col relative overflow-hidden" style={{ borderColor: secondaryColor }} data-three-container>
            <div className="flex items-center justify-between p-3 bg-white border-b" style={{ borderColor: secondaryColor }}>
              <h2 className="text-lg font-bold" style={{ color: secondaryColor }}>معاينة ثلاثية الأبعاد تفاعلية</h2>
              <div className="flex items-center gap-2">
                {/* Camera Mode Toggle Buttons */}
                <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: `${primaryColor}10` }}>
                  <button
                    onClick={() => setCameraMode('orbit')}
                    className="px-3 py-1 rounded text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: cameraMode === 'orbit' ? primaryColor : 'transparent',
                      color: cameraMode === 'orbit' ? 'white' : primaryColor,
                      boxShadow: cameraMode === 'orbit' ? `0 2px 8px ${primaryColor}40` : 'none',
                    }}
                    title="وضع الكاميرا العادي"
                  >
                    🔄 عادي
                  </button>
                  <button
                    onClick={() => setCameraMode('freeMove')}
                    className="px-3 py-1 rounded text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: cameraMode === 'freeMove' ? secondaryColor : 'transparent',
                      color: cameraMode === 'freeMove' ? 'white' : secondaryColor,
                      boxShadow: cameraMode === 'freeMove' ? `0 2px 8px ${secondaryColor}40` : 'none',
                    }}
                    title="وضع الطيران - حركة حرة"
                  >
                    ✈️ طيران
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggle3DFullscreen}
                  className="h-7 w-7 p-0 transition-all"
                  style={{ color: primaryColor }}
                  title={is3DFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
                >
                  {is3DFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <ThreeScene ref={threeRef} transformMode={transformMode} cameraMode={cameraMode} />

              {/* Free Move Instructions Overlay */}
              {cameraMode === 'freeMove' && (
                <div className="absolute top-4 left-4 text-white p-4 rounded-lg text-sm shadow-lg z-10 backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}dd` }}>
                  <h3 className="font-bold mb-2 text-base">
                    ✈️ وضع الطيران الحر
                  </h3>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">•</span>
                      <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">W/S/A/D</kbd>
                      <span>الحركة</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">•</span>
                      <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">Mouse</kbd>
                      <span>النظر حولك</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">•</span>
                      <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">Space</kbd>
                      <span>للأعلى</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">•</span>
                      <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">Shift</kbd>
                      <span>للأسفل</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">•</span>
                      <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs">ESC</kbd>
                      <span>إلغاء القفل</span>
                    </li>
                    <li className="flex items-center gap-2 mt-2 pt-2 border-t border-white/20">
                      <span className="text-green-400">💡</span>
                      <span className="text-xs opacity-90">انقر للبدء</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Crosshair */}
              {cameraMode === 'freeMove' && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                  <div className="relative">
                    <div className="w-2 h-2 bg-white rounded-full opacity-70 shadow-lg" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white rounded-full opacity-30" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified Selection Toolbar - Below Both Views */}
        {selectedProductId && !selectedWallId && !selectedColumnId && (() => {
          const product = layout.products.find(p => p.id === selectedProductId);
          if (!product) return null;
          const similarCount = layout.products.filter(p => p.modelUrl === product.modelUrl).length;

          return (
            <div className="w-full max-w-3xl mx-auto bg-white border-2 border-purple-300 rounded-xl shadow-lg overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 w-full sm:w-auto" dir="rtl">
                {/* Product Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-sm">
                  <span className="text-sm font-bold text-white">📦 {product.name}</span>
                </div>

                <div className="hidden sm:block h-8 w-px bg-purple-200" />

                {/* Focus Camera Button */}
                <button
                  onClick={() => handleFocusOnProduct(product.id)}
                  className="h-9 px-4 flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-sm transition-all font-semibold text-xs"
                  title="تركيز الكاميرا على المنتج"
                >
                  <Focus className="h-4 w-4" />
                  <span>تركيز</span>
                </button>

                {/* Place on Floor Button */}
                <button
                  onClick={() => {
                    // Remove and re-add the product to trigger the smart positioning logic
                    // This forces the Three.js scene to recalculate the floor position
                    const tempProduct = { ...product };

                    // First remove the product
                    removeProduct(product.id);

                    // Then add it back with Y=0.5 to trigger auto-calculation
                    setTimeout(() => {
                      upsertProduct({
                        ...tempProduct,
                        position: {
                          x: tempProduct.position.x,
                          y: 0.5,
                          z: tempProduct.position.z
                        }
                      });

                      toast({
                        title: 'تم وضع المنتج على الأرضية',
                        description: 'تم حساب الموضع الصحيح تلقائياً بناءً على أبعاد المنتج'
                      });
                    }, 50);
                  }}
                  className="h-9 px-4 flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-sm transition-all font-semibold text-xs"
                  title="وضع المنتج على الأرضية - يحسب الموضع تلقائياً"
                >
                  <ArrowDown className="h-4 w-4" />
                  <span>على الأرضية</span>
                </button>

                <div className="h-8 w-px bg-purple-200" />

                {/* Texture Selector */}
                <div className="flex flex-col gap-1 relative texture-dropdown">
                  <label className="text-[10px] font-semibold text-purple-600">🖼️ نسيج</label>
                  <button
                    type="button"
                    onClick={() => setShowProductTextureDropdown(!showProductTextureDropdown)}
                    className="w-28 h-9 px-2 flex items-center gap-2 text-xs border border-purple-200 rounded-md bg-white hover:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
                  >
                    {product.texture ? (
                      <>
                        <img src={product.texture} alt="" className="w-5 h-5 rounded border border-purple-300 object-cover" crossOrigin="anonymous" />
                        <span className="flex-1 text-left truncate">{TEXTURE_OPTIONS.find(t => t.value === product.texture)?.label || 'نسيج'}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-left">افتراضي</span>
                    )}
                    <span className="text-purple-400">▼</span>
                  </button>
                  {showProductTextureDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border-2 border-purple-300 rounded-md shadow-lg z-50 overflow-hidden">
                      <div className="max-h-[156px] overflow-y-auto">
                        {TEXTURE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              upsertProduct({ id: product.id, texture: option.value });
                              setShowProductTextureDropdown(false);
                            }}
                            className="w-full px-2 py-2 flex items-center gap-2 hover:bg-purple-50 text-xs text-right"
                          >
                            {option.preview ? (
                              <img src={option.preview} alt="" className="w-6 h-6 rounded border border-purple-200 object-cover" crossOrigin="anonymous" />
                            ) : (
                              <div className="w-6 h-6 rounded border border-purple-200 bg-gray-100" />
                            )}
                            <span className="flex-1">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-8 w-px bg-purple-200" />

                {/* Color Picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-purple-600">
                    🎨 لون {product.texture && <span className="text-[8px] opacity-70">(تأثير)</span>}
                  </label>
                  <input
                    type="color"
                    value={product.color || '#ffffff'}
                    onChange={(e) => upsertProduct({ id: product.id, color: e.target.value })}
                    className="w-12 h-9 rounded-lg border border-purple-200 cursor-pointer shadow-sm"
                    title={product.texture ? 'لون كتأثير على النسيج' : product.color || '#ffffff'}
                  />
                </div>

                <div className="h-8 w-px bg-purple-200" />

                {/* Rotation Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-purple-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-purple-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      Math.round((product.rotation?.y || 0) * 180 / Math.PI),
                      15,
                      (degrees) => {
                        const radians = degrees * Math.PI / 180;
                        upsertProduct({ id: product.id, rotation: { ...product.rotation, y: radians } });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    🔄 دوران
                  </label>
                  <input
                    type="number"
                    step="15"
                    value={Math.round((product.rotation?.y || 0) * 180 / Math.PI)}
                    onChange={(e) => {
                      const degrees = Number(e.target.value);
                      const radians = degrees * Math.PI / 180;
                      upsertProduct({ id: product.id, rotation: { ...product.rotation, y: radians } });
                    }}
                    className="w-16 h-9 text-center text-xs border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-purple-200" />

                {/* Scale Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-purple-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-purple-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      product.scale?.x || 1,
                      0.1,
                      (scale) => {
                        const newScale = Math.max(0.1, scale);
                        upsertProduct({ id: product.id, scale: { x: newScale, y: newScale, z: newScale } });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📏 حجم
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={(product.scale?.x || 1).toFixed(1)}
                    onChange={(e) => {
                      const scale = Number(e.target.value);
                      upsertProduct({ id: product.id, scale: { x: scale, y: scale, z: scale } });
                    }}
                    className="w-16 h-9 text-center text-xs border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                  />
                </div>

                {/* Apply to Similar Button */}
                {similarCount > 1 && (
                  <>
                    <div className="h-8 w-px bg-purple-200" />
                    <button
                      onClick={() => {
                        const similarProducts = layout.products.filter(p => p.modelUrl === product.modelUrl);
                        if (confirm(`تطبيق اللون والنسيج على ${similarProducts.length} منتج مشابه؟`)) {
                          similarProducts.forEach(p => {
                            if (p.id !== product.id) {
                              upsertProduct({
                                id: p.id,
                                color: product.color,
                                texture: product.texture
                              });
                            }
                          });
                        }
                      }}
                      className="h-9 px-4 text-xs font-semibold bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-sm flex items-center gap-2"
                      title={`تطبيق على ${similarCount} منتجات`}
                    >
                      <span>⚡</span>
                      <span>تطبيق ({similarCount})</span>
                    </button>
                  </>
                )}

                <div className="h-8 w-px bg-purple-200" />

                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (confirm('هل تريد حذف هذا الكائن؟')) {
                      removeProduct(product.id);
                      selectProduct(null);
                    }
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => selectProduct(null)}
                  className="h-9 w-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="إغلاق"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Wall Selection Toolbar */}
        {selectedWallId && !selectedColumnId && !selectedProductId && (() => {
          const wall = layout.walls.find(w => w.id === selectedWallId);
          if (!wall) return null;

          return (
            <div className="w-full bg-white border-2 border-emerald-300 rounded-xl shadow-lg overflow-visible">
              <div className="flex items-center justify-center gap-3 px-4 py-3 min-w-max" dir="rtl">
                {/* Wall Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-sm">
                  <span className="text-sm font-bold text-white">🧱 جدار</span>
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Height Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-emerald-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-emerald-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      wall.height || 3,
                      0.5,
                      (height) => {
                        const newHeight = Math.max(0.5, height);
                        upsertWall({ id: wall.id, height: newHeight });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📏 ارتفاع (م)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={(wall.height || 3).toFixed(1)}
                    onChange={(e) => {
                      const height = Number(e.target.value);
                      upsertWall({ id: wall.id, height });
                    }}
                    className="w-16 h-9 text-center text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Thickness Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-emerald-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-emerald-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      wall.thickness || 0.2,
                      0.05,
                      (thickness) => {
                        const newThickness = Math.max(0.05, thickness);
                        upsertWall({ id: wall.id, thickness: newThickness });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📐 سمك (م)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={(wall.thickness || 0.2).toFixed(2)}
                    onChange={(e) => {
                      const thickness = Number(e.target.value);
                      upsertWall({ id: wall.id, thickness });
                    }}
                    className="w-16 h-9 text-center text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Length Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-emerald-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-emerald-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y),
                      0.1,
                      (newLength) => {
                        const currentLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
                        if (currentLength > 0 && newLength > 0) {
                          const ratio = newLength / currentLength;
                          const dx = wall.end.x - wall.start.x;
                          const dy = wall.end.y - wall.start.y;
                          upsertWall({
                            id: wall.id,
                            end: {
                              x: wall.start.x + dx * ratio,
                              y: wall.start.y + dy * ratio
                            }
                          });
                        }
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📏 طول (م)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y).toFixed(2)}
                    onChange={(e) => {
                      const newLength = Number(e.target.value);
                      const currentLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
                      if (currentLength > 0 && newLength > 0) {
                        const ratio = newLength / currentLength;
                        const dx = wall.end.x - wall.start.x;
                        const dy = wall.end.y - wall.start.y;
                        upsertWall({
                          id: wall.id,
                          end: {
                            x: wall.start.x + dx * ratio,
                            y: wall.start.y + dy * ratio
                          }
                        });
                      }
                    }}
                    className="w-16 h-9 text-center text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Angle Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-emerald-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-emerald-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      Math.round((Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / Math.PI)),
                      1,
                      (angleDeg) => {
                        const angle = angleDeg * Math.PI / 180;
                        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
                        upsertWall({
                          id: wall.id,
                          end: {
                            x: wall.start.x + length * Math.cos(angle),
                            y: wall.start.y + length * Math.sin(angle)
                          }
                        });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    🔄 زاوية (°)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={Math.round((Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / Math.PI))}
                    onChange={(e) => {
                      const angle = Number(e.target.value) * Math.PI / 180;
                      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
                      upsertWall({
                        id: wall.id,
                        end: {
                          x: wall.start.x + length * Math.cos(angle),
                          y: wall.start.y + length * Math.sin(angle)
                        }
                      });
                    }}
                    className="w-14 h-9 text-center text-xs border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Texture Selector */}
                <div className="flex flex-col gap-1 relative texture-dropdown">
                  <label className="text-[10px] font-semibold text-emerald-600">🖼️ نسيج</label>
                  <button
                    type="button"
                    onClick={() => setShowWallTextureDropdown(!showWallTextureDropdown)}
                    className="w-28 h-9 px-2 flex items-center gap-2 text-xs border border-emerald-200 rounded-md bg-white hover:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                  >
                    {wall.texture ? (
                      <>
                        <img src={WALL_TEXTURES[wall.texture as keyof typeof WALL_TEXTURES]?.preview || WALL_TEXTURES[wall.texture as keyof typeof WALL_TEXTURES]?.map} alt="" className="w-5 h-5 rounded border border-emerald-300 object-cover" crossOrigin="anonymous" />
                        <span className="flex-1 text-left truncate">{WALL_TEXTURE_OPTIONS.find(t => t.key === wall.texture)?.label || 'نسيج'}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-left">افتراضي</span>
                    )}
                    <span className="text-emerald-400">▼</span>
                  </button>
                  {showWallTextureDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white border-2 border-emerald-300 rounded-md shadow-lg z-50 overflow-hidden">
                      <div className="max-h-[200px] overflow-y-auto">
                        {WALL_TEXTURE_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              upsertWall({ id: wall.id, texture: option.key as any });
                              setShowWallTextureDropdown(false);
                            }}
                            className="w-full px-2 py-2 flex items-center gap-2 hover:bg-emerald-50 text-xs text-right"
                          >
                            {option.preview ? (
                              <img src={option.preview} alt="" className="w-6 h-6 rounded border border-emerald-200 object-cover" crossOrigin="anonymous" />
                            ) : (
                              <div className="w-6 h-6 rounded border border-emerald-200 bg-gray-100" />
                            )}
                            <span className="flex-1">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Apply to All Walls Button */}
                <button
                  onClick={() => {
                    // Apply current wall's texture to all walls
                    layout.walls.forEach(w => {
                      if (w.id !== wall.id) {
                        upsertWall({ id: w.id, texture: wall.texture });
                      }
                    });
                  }}
                  className="h-9 px-3 text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                  title="تطبيق النسيج على جميع الجدران"
                >
                  <Palette className="h-4 w-4" />
                  <span>تطبيق على الكل</span>
                </button>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Color Picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-emerald-600">🎨 لون</label>
                  <input
                    type="color"
                    value={wall.color || '#64748b'}
                    onChange={(e) => upsertWall({ id: wall.id, color: e.target.value })}
                    className="w-12 h-9 rounded-lg border border-emerald-200 cursor-pointer shadow-sm"
                    title={wall.color || '#64748b'}
                  />
                </div>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Add Column Button */}
                <button
                  onClick={() => addColumnToWall(wall.id, 0.5)}
                  className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                  title="إضافة عمود"
                >
                  <span>🏛️ عمود</span>
                </button>

                <div className="h-8 w-px bg-emerald-200" />

                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (confirm('هل تريد حذف هذا الجدار؟')) {
                      removeWall(wall.id);
                      selectWall(null);
                    }
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => selectWall(null)}
                  className="h-9 w-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="إغلاق"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Column Selection Toolbar */}
        {selectedColumnId && !selectedProductId && (() => {
          const wall = layout.walls.find(w => w.columns?.some(c => c.id === selectedColumnId));
          const column = wall?.columns?.find(c => c.id === selectedColumnId);
          if (!wall || !column) return null;

          return (
            <div className="w-full bg-white border-2 border-amber-300 rounded-xl shadow-lg overflow-x-auto">
              <div className="flex items-center justify-center gap-3 px-4 py-3 min-w-max" dir="rtl">
                {/* Column Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg shadow-sm">
                  <span className="text-sm font-bold text-white">🏛️ عمود</span>
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Width Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-amber-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-amber-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      column.width || 0.4,
                      0.1,
                      (width) => {
                        const newWidth = Math.max(0.1, width);
                        const updatedColumns = wall.columns?.map(c =>
                          c.id === column.id ? { ...c, width: newWidth } : c
                        );
                        upsertWall({ id: wall.id, columns: updatedColumns });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📏 عرض (م)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={(column.width || 0.4).toFixed(1)}
                    onChange={(e) => {
                      const width = Number(e.target.value);
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, width } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="w-16 h-9 text-center text-xs border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Position Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-amber-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-amber-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      column.position || 0.5,
                      0.1,
                      (position) => {
                        const newPosition = Math.max(0, Math.min(1, position));
                        const updatedColumns = wall.columns?.map(c =>
                          c.id === column.id ? { ...c, position: newPosition } : c
                        );
                        upsertWall({ id: wall.id, columns: updatedColumns });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📍 موضع
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={(column.position || 0.5).toFixed(2)}
                    onChange={(e) => {
                      const position = Math.max(0, Math.min(1, Number(e.target.value)));
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, position } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="w-14 h-9 text-center text-xs border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Depth Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-amber-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-amber-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      column.depth || 0.4,
                      0.05,
                      (depth) => {
                        const newDepth = Math.max(0.05, depth);
                        const updatedColumns = wall.columns?.map(c =>
                          c.id === column.id ? { ...c, depth: newDepth } : c
                        );
                        upsertWall({ id: wall.id, columns: updatedColumns });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📐 عمق (م)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={(column.depth || 0.4).toFixed(2)}
                    onChange={(e) => {
                      const depth = Number(e.target.value);
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, depth } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="w-14 h-9 text-center text-xs border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Height Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold text-amber-600 cursor-ew-resize select-none px-1 py-0.5 rounded hover:bg-amber-100"
                    onMouseDown={(e) => handleScrubbyStart(
                      e,
                      column.height || 3,
                      0.1,
                      (height) => {
                        const newHeight = Math.max(0.1, height);
                        const updatedColumns = wall.columns?.map(c =>
                          c.id === column.id ? { ...c, height: newHeight } : c
                        );
                        upsertWall({ id: wall.id, columns: updatedColumns });
                      }
                    )}
                    title="اسحب لتغيير القيمة"
                  >
                    📏 ارتفاع (م)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={(column.height || 3).toFixed(1)}
                    onChange={(e) => {
                      const height = Number(e.target.value);
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, height } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="w-14 h-9 text-center text-xs border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Side Control */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-amber-600">↔️ جانب</label>
                  <select
                    value={column.side || 'center'}
                    onChange={(e) => {
                      const side = e.target.value as 'center' | 'left' | 'right';
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, side } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="h-9 px-2 text-xs border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white cursor-pointer"
                  >
                    <option value="center">وسط</option>
                    <option value="left">يسار</option>
                    <option value="right">يمين</option>
                  </select>
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Color Picker */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-amber-600">🎨 لون</label>
                  <input
                    type="color"
                    value={column.color || '#64748b'}
                    onChange={(e) => {
                      const color = e.target.value;
                      const updatedColumns = wall.columns?.map(c =>
                        c.id === column.id ? { ...c, color } : c
                      );
                      upsertWall({ id: wall.id, columns: updatedColumns });
                    }}
                    className="w-12 h-9 rounded-lg border border-amber-200 cursor-pointer shadow-sm"
                    title={column.color || '#64748b'}
                  />
                </div>

                <div className="h-8 w-px bg-amber-200" />

                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (confirm('هل تريد حذف هذا العمود؟')) {
                      removeColumn(wall.id, column.id);
                    }
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => selectWall(null)}
                  className="h-9 w-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="إغلاق"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Scene Items List - Organized view of all elements */}
        <SceneItemsList />
      </div>
    </div>
  );
};

// Protection wrapper to ensure shop setup is complete
const ShopBuilderProtected = () => {
  const navigate = useNavigate();
  const { shopData, loading } = useShopSetup();

  useEffect(() => {
    if (!loading && !shopData) {
      navigate('/shop-setup', { replace: true });
    }
  }, [shopData, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!shopData) {
    return null;
  }

  return (
    <ShopBuilderProvider initialShopData={shopData}>
      <ShopBuilderContent />
    </ShopBuilderProvider>
  );
};

export const ShopBuilder3DPage = () => <ShopBuilderProtected />;

export default ShopBuilder3DPage;
