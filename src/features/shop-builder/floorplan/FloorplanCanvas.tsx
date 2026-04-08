import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShopBuilderWall } from '../types';
import { useTheme } from '@/context/ThemeContext';
import { useShopBuilder } from '../store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { loadFloorplan } from './loadFloorplan';
import { cn } from '@/lib/utils';

// Helper function for distance calculation
function distancePointToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = start.x + clampedT * dx;
  const projY = start.y + clampedT * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const SNAP_THRESHOLD = 0.3; // meters - snap when within 30cm
const ENDPOINT_RADIUS = 10;
const CANVAS_PADDING = 50; // pixels

interface DragState {
  wallId: string;
  handle: 'start' | 'end' | 'body';
  offset?: { x: number; y: number };
}

interface ProductDragState {
  productId: string;
  offset: { x: number; y: number };
}

interface BulkDragState {
  anchorWorld: { x: number; y: number };
  initialWalls: Array<{ id: string; start: { x: number; y: number }; end: { x: number; y: number } }>;
  initialProducts: Array<{ id: string; x: number; z: number }>;
}

interface MarqueeSelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type FloorplanPointerTool = 'default' | 'marquee';

const FloorplanCanvas: React.FC = () => {
  const { primaryColor, secondaryColor } = useTheme();
  const { 
    layout, 
    upsertWall, 
    selectWall, 
    selectedWallId, 
    removeWall,
    addColumnToWall,
    updateColumn,
    removeColumn,
    selectedColumnId,
    selectColumn,
    selectedProductId,
    selectProduct,
    upsertProduct,
    removeProduct,
    isDrawingMode,
    setDrawingMode,
    defaultWallThickness
  } = useShopBuilder();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<DragState | null>(null);
  const productDragState = useRef<ProductDragState | null>(null);
  const bulkDragState = useRef<BulkDragState | null>(null);
  const panState = useRef<{ x: number; y: number } | null>(null);
  const [floorplanReady, setFloorplanReady] = useState(false);
  
  // Drawing mode states
  const [drawingStartPoint, setDrawingStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawingPreviewPoint, setDrawingPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [snappedPoint, setSnappedPoint] = useState<{ x: number; y: number } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [showLengthInput, setShowLengthInput] = useState(false);
  const [lengthInputValue, setLengthInputValue] = useState('');
  const [lengthInputMode, setLengthInputMode] = useState<'draw' | 'selected' | null>(null);
  const [pointerTool, setPointerTool] = useState<FloorplanPointerTool>('default');
  const [marqueeRect, setMarqueeRect] = useState<MarqueeSelectionRect | null>(null);
  const [multiSelectedWallIds, setMultiSelectedWallIds] = useState<string[]>([]);
  const [multiSelectedColumnIds, setMultiSelectedColumnIds] = useState<string[]>([]);
  const [multiSelectedProductIds, setMultiSelectedProductIds] = useState<string[]>([]);
  
  // Use ref for disableSnapping to avoid stale closure issues
  const disableSnappingRef = useRef(false);
  
  // Scrubby slider state
  const scrubbyState = useRef<{ 
    active: boolean; 
    startX: number; 
    startValue: number; 
    field: string;
    step: number;
  } | null>(null);

  useEffect(() => {
    // Floorplan library removed - using custom canvas implementation
    setFloorplanReady(true);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const worldWalls = layout.walls;
  const selectedWall = worldWalls.find((w) => w.id === selectedWallId);
  const interactiveProducts = useMemo(
    () => layout.products.filter((product) => !(product.metadata as any)?.autoHangFill),
    [layout.products]
  );
  const multiSelectedWallsSet = useMemo(() => new Set(multiSelectedWallIds), [multiSelectedWallIds]);
  const multiSelectedColumnsSet = useMemo(() => new Set(multiSelectedColumnIds), [multiSelectedColumnIds]);
  const multiSelectedProductsSet = useMemo(() => new Set(multiSelectedProductIds), [multiSelectedProductIds]);
  const hasMultiSelection = multiSelectedWallIds.length > 0 || multiSelectedColumnIds.length > 0 || multiSelectedProductIds.length > 0;


  const pixelsPerMeter = useMemo(() => {
    const availableWidth = canvasSize.width - CANVAS_PADDING * 2;
    const availableHeight = canvasSize.height - CANVAS_PADDING * 2;
    const floorSize = layout.floorSize || 24; // Default to 24m if not set
    return Math.min(availableWidth, availableHeight) / floorSize * zoom;
  }, [canvasSize.width, canvasSize.height, zoom, layout.floorSize]);

  const getNormalizedRect = useCallback((rect: MarqueeSelectionRect) => {
    const left = Math.min(rect.startX, rect.currentX);
    const right = Math.max(rect.startX, rect.currentX);
    const top = Math.min(rect.startY, rect.currentY);
    const bottom = Math.max(rect.startY, rect.currentY);
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Background - Light theme
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    const centerX = canvasSize.width / 2 + pan.x;
    const centerY = canvasSize.height / 2 + pan.y;

    // Floor boundary
    const floorSize = layout.floorSize || 24;
    const floorScreenSize = floorSize * pixelsPerMeter;
    const floorLeft = centerX - floorScreenSize / 2;
    const floorTop = centerY - floorScreenSize / 2;

    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(floorLeft, floorTop, floorScreenSize, floorScreenSize);

    ctx.fillStyle = 'rgba(241,245,249,0.8)';
    ctx.fillRect(floorLeft, floorTop, floorScreenSize, floorScreenSize);

    // Grid
    ctx.strokeStyle = 'rgba(203,213,225,0.4)';
    ctx.lineWidth = 1;
    const gridSpacing = pixelsPerMeter;
    for (let i = 0; i <= floorSize; i++) {
      const offset = i * gridSpacing;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(floorLeft + offset, floorTop);
      ctx.lineTo(floorLeft + offset, floorTop + floorScreenSize);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(floorLeft, floorTop + offset);
      ctx.lineTo(floorLeft + floorScreenSize, floorTop + offset);
      ctx.stroke();
    }

    const toScreen = (point: { x: number; y: number }) => ({
      x: centerX + point.x * pixelsPerMeter,
      y: centerY + point.y * pixelsPerMeter,
    });

    worldWalls.forEach((wall) => {
      const start = toScreen(wall.start);
      const end = toScreen(wall.end);
      const isWallSelected = wall.id === selectedWallId || multiSelectedWallsSet.has(wall.id);

      // wall line - Increased width, reduced visual height representation
      ctx.beginPath();
      ctx.strokeStyle = isWallSelected ? primaryColor : wall.color;
      ctx.lineWidth = isWallSelected ? 12 : 10; // Increased from 6/5 to 12/10
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // endpoints
      ctx.fillStyle = isWallSelected ? primaryColor : '#64748b';
      ctx.beginPath();
      ctx.arc(start.x, start.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(end.x, end.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Snap indicators (green glow when connected)
      if (dragState.current && dragState.current.wallId !== wall.id) {
        const draggedWall = worldWalls.find(w => w.id === dragState.current?.wallId);
        if (draggedWall) {
          const draggedPoint = dragState.current.handle === 'start' ? draggedWall.start : draggedWall.end;
          const draggedScreenPoint = toScreen(draggedPoint);
          
          // Check if near start point
          const distToStart = Math.hypot(draggedPoint.x - wall.start.x, draggedPoint.y - wall.start.y);
          if (distToStart < SNAP_THRESHOLD) {
            // Connection line
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(draggedScreenPoint.x, draggedScreenPoint.y);
            ctx.lineTo(start.x, start.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Outer green glow
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(start.x, start.y, ENDPOINT_RADIUS + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner green fill to show connection
            ctx.fillStyle = '#10b981';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(start.x, start.y, ENDPOINT_RADIUS + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }

          // Check if near end point
          const distToEnd = Math.hypot(draggedPoint.x - wall.end.x, draggedPoint.y - wall.end.y);
          if (distToEnd < SNAP_THRESHOLD) {
            // Connection line
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(draggedScreenPoint.x, draggedScreenPoint.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Outer green glow
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(end.x, end.y, ENDPOINT_RADIUS + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner green fill to show connection
            ctx.fillStyle = '#10b981';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(end.x, end.y, ENDPOINT_RADIUS + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }
      }

      // Draw columns on this wall
      if (wall.columns && wall.columns.length > 0) {
        wall.columns.forEach((column) => {
          // Calculate column position along wall
          const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
          const baseColumnWorldPos = {
            x: wall.start.x + (wall.end.x - wall.start.x) * column.position,
            y: wall.start.y + (wall.end.y - wall.start.y) * column.position,
          };

          // Calculate wall angle for perpendicular offset
          const wallAngle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
          const perpAngle = wallAngle + Math.PI / 2;

          // Apply side offset (perpendicular to wall)
          let sideOffset = 0;
          if (column.side === 'left') {
            sideOffset = -column.width / 2;
          } else if (column.side === 'right') {
            sideOffset = column.width / 2;
          }

          const columnWorldPos = {
            x: baseColumnWorldPos.x + Math.cos(perpAngle) * sideOffset,
            y: baseColumnWorldPos.y + Math.sin(perpAngle) * sideOffset,
          };
          const columnScreenPos = toScreen(columnWorldPos);

          // Column dimensions in screen space
          const columnWidthPx = column.width * pixelsPerMeter;
          const columnDepthPx = column.depth * pixelsPerMeter;

          // Draw column based on shape
          if (column.shape === 'round') {
            // Round column
            const isColumnSelected = column.id === selectedColumnId || multiSelectedColumnsSet.has(column.id);
            ctx.fillStyle = isColumnSelected ? secondaryColor : column.color;
            ctx.strokeStyle = isColumnSelected ? primaryColor : '#64748b';
            ctx.lineWidth = isColumnSelected ? 3 : 2;
            ctx.beginPath();
            ctx.arc(columnScreenPos.x, columnScreenPos.y, columnWidthPx / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            // Square or rectangular column
            ctx.save();
            ctx.translate(columnScreenPos.x, columnScreenPos.y);
            ctx.rotate(wallAngle);
            
            const isColumnSelected = column.id === selectedColumnId || multiSelectedColumnsSet.has(column.id);
            ctx.fillStyle = isColumnSelected ? secondaryColor : column.color;
            ctx.strokeStyle = isColumnSelected ? primaryColor : '#64748b';
            ctx.lineWidth = isColumnSelected ? 3 : 2;
            
            ctx.fillRect(-columnDepthPx / 2, -columnWidthPx / 2, columnDepthPx, columnWidthPx);
            ctx.strokeRect(-columnDepthPx / 2, -columnWidthPx / 2, columnDepthPx, columnWidthPx);
            
            ctx.restore();
          }

          // Selection indicator
          if (column.id === selectedColumnId || multiSelectedColumnsSet.has(column.id)) {
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(columnScreenPos.x, columnScreenPos.y, Math.max(columnWidthPx, columnDepthPx) / 2 + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }
    });

    // Draw manual 3D products only (exclude auto-hanging procedural shapes)
    interactiveProducts.forEach((product) => {
      const productScreenPos = toScreen({ x: product.position.x, y: product.position.z });
      
      // Estimate product size (default 1m x 1m if no scale info)
      const productSizeX = (product.scale?.x || 1) * pixelsPerMeter * 0.5;
      const productSizeZ = (product.scale?.z || 1) * pixelsPerMeter * 0.5;
      
      const isSelected = product.id === selectedProductId || multiSelectedProductsSet.has(product.id);
      
      ctx.save();
      ctx.translate(productScreenPos.x, productScreenPos.y);
      ctx.rotate(product.rotation?.y || 0);
      
      // Draw product rectangle
      ctx.fillStyle = isSelected ? primaryColor + '4d' : 'rgba(100, 116, 139, 0.2)'; // 30% opacity
      ctx.strokeStyle = isSelected ? primaryColor : '#64748b';
      ctx.lineWidth = isSelected ? 3 : 2;
      
      ctx.fillRect(-productSizeX / 2, -productSizeZ / 2, productSizeX, productSizeZ);
      ctx.strokeRect(-productSizeX / 2, -productSizeZ / 2, productSizeX, productSizeZ);
      
      // Draw rotation indicator (arrow)
      ctx.strokeStyle = isSelected ? primaryColor : '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -productSizeZ / 2 - 10);
      ctx.stroke();
      
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(0, -productSizeZ / 2 - 10);
      ctx.lineTo(-5, -productSizeZ / 2 - 5);
      ctx.moveTo(0, -productSizeZ / 2 - 10);
      ctx.lineTo(5, -productSizeZ / 2 - 5);
      ctx.stroke();
      
      ctx.restore();
      
      // Draw product name
      if (product.name) {
        ctx.fillStyle = isSelected ? '#3b82f6' : '#475569';
        ctx.font = isSelected ? 'bold 12px sans-serif' : '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(product.name, productScreenPos.x, productScreenPos.y + Math.max(productSizeX, productSizeZ) / 2 + 5);
      }
      
      // Selection indicator
      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const maxSize = Math.max(productSizeX, productSizeZ);
        ctx.arc(productScreenPos.x, productScreenPos.y, maxSize / 2 + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Drawing mode visualization
    if (isDrawingMode) {
      // Show cursor indicator even before first click
      if (!drawingStartPoint && drawingPreviewPoint) {
        const previewScreen = toScreen(drawingPreviewPoint);
        
        // Pulsing cursor indicator
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(previewScreen.x, previewScreen.y, ENDPOINT_RADIUS + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Small center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(previewScreen.x, previewScreen.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      if (drawingStartPoint) {
        const startScreen = toScreen(drawingStartPoint);
        
        // Draw start point indicator
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, ENDPOINT_RADIUS + 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer glow
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, ENDPOINT_RADIUS + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      
      // Ghost preview line
      if (drawingPreviewPoint) {
        const previewScreen = toScreen(drawingPreviewPoint);
        const finalPoint = snappedPoint || drawingPreviewPoint;
        const finalScreen = toScreen(finalPoint);
        
        // Dashed preview line
        ctx.strokeStyle = snappedPoint ? secondaryColor : primaryColor;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(finalScreen.x, finalScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        
        // End point preview
        ctx.fillStyle = snappedPoint ? secondaryColor : primaryColor;
        ctx.beginPath();
        ctx.arc(finalScreen.x, finalScreen.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Calculate length and angle
        const dx = finalPoint.x - drawingStartPoint.x;
        const dy = finalPoint.y - drawingStartPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Compact length and angle display near cursor
        const midX = (startScreen.x + finalScreen.x) / 2;
        const midY = (startScreen.y + finalScreen.y) / 2;
        
        // Compact rounded badge
        const badgeWidth = 85;
        const badgeHeight = 32;
        const badgeX = midX - badgeWidth / 2;
        const badgeY = midY - badgeHeight / 2 - 15;
        const radius = 16;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.roundRect(badgeX + 2, badgeY + 2, badgeWidth, badgeHeight, radius);
        ctx.fill();
        
        // Gradient background
        const gradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#6366f1');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
        ctx.fill();
        
        // Text - single line with length and angle
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${length.toFixed(1)}م • ${angle.toFixed(0)}°`, midX, midY - 15);
        }
      }
    }
    
    // Draw all endpoint snap indicators when in drawing mode
    if (isDrawingMode && drawingPreviewPoint && !drawingStartPoint) {
      worldWalls.forEach((wall) => {
        const startScreen = toScreen(wall.start);
        const endScreen = toScreen(wall.end);
        
        // Highlight endpoints for snapping
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, ENDPOINT_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(endScreen.x, endScreen.y, ENDPOINT_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });
    }

    if (marqueeRect) {
      const rect = getNormalizedRect(marqueeRect);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.setLineDash([]);
    }
  }, [canvasSize.width, canvasSize.height, worldWalls, selectedWallId, selectedColumnId, selectedProductId, interactiveProducts, pixelsPerMeter, pan.x, pan.y, isDrawingMode, drawingStartPoint, drawingPreviewPoint, snappedPoint, marqueeRect, getNormalizedRect, multiSelectedWallsSet, multiSelectedColumnsSet, multiSelectedProductsSet]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getWallHandleAtPosition = useCallback(
    (pos: { x: number; y: number }): DragState | null => {
      const centerX = canvasSize.width / 2 + pan.x;
      const centerY = canvasSize.height / 2 + pan.y;
      const toScreen = (point: { x: number; y: number }) => ({
        x: centerX + point.x * pixelsPerMeter,
        y: centerY + point.y * pixelsPerMeter,
      });

      for (let i = worldWalls.length - 1; i >= 0; i -= 1) {
        const wall = worldWalls[i];
        const start = toScreen(wall.start);
        const end = toScreen(wall.end);
        const distStart = Math.hypot(start.x - pos.x, start.y - pos.y);
        const distEnd = Math.hypot(end.x - pos.x, end.y - pos.y);
        if (distStart <= ENDPOINT_RADIUS + 4) {
          return { wallId: wall.id, handle: 'start' };
        }
        if (distEnd <= ENDPOINT_RADIUS + 4) {
          return { wallId: wall.id, handle: 'end' };
        }
      }
      return null;
    },
    [worldWalls, pixelsPerMeter, canvasSize.width, canvasSize.height, pan.x, pan.y]
  );

  const screenToWorld = useCallback(
    (pos: { x: number; y: number }) => {
      const centerX = canvasSize.width / 2 + pan.x;
      const centerY = canvasSize.height / 2 + pan.y;
      return {
        x: (pos.x - centerX) / pixelsPerMeter,
        y: (pos.y - centerY) / pixelsPerMeter,
      };
    },
    [pixelsPerMeter, canvasSize.width, canvasSize.height, pan.x, pan.y]
  );

  // Find nearest snap point
  const findSnapPoint = useCallback((point: { x: number; y: number }, excludeWallId?: string) => {
    let nearestPoint: { x: number; y: number } | null = null;
    let nearestDistance = SNAP_THRESHOLD;



    worldWalls.forEach(wall => {
      if (wall.id === excludeWallId) {

        return; // Don't snap to self
      }

      // Check start point
      const distToStart = Math.hypot(point.x - wall.start.x, point.y - wall.start.y);
      console.log('📏 Distance to wall', wall.id, 'start:', distToStart.toFixed(3), 'm');
      if (distToStart < nearestDistance) {
        nearestDistance = distToStart;
        nearestPoint = { x: wall.start.x, y: wall.start.y };

      }

      // Check end point
      const distToEnd = Math.hypot(point.x - wall.end.x, point.y - wall.end.y);
      console.log('📏 Distance to wall', wall.id, 'end:', distToEnd.toFixed(3), 'm');
      if (distToEnd < nearestDistance) {
        nearestDistance = distToEnd;
        nearestPoint = { x: wall.end.x, y: wall.end.y };

      }
    });


    return nearestPoint;
  }, [worldWalls]);

  const applyMarqueeSelection = useCallback((rect: MarqueeSelectionRect) => {
    const normalized = getNormalizedRect(rect);
    if (normalized.width < 4 && normalized.height < 4) {
      setMultiSelectedWallIds([]);
      setMultiSelectedColumnIds([]);
      setMultiSelectedProductIds([]);
      return;
    }

    const centerX = canvasSize.width / 2 + pan.x;
    const centerY = canvasSize.height / 2 + pan.y;
    const toScreen = (point: { x: number; y: number }) => ({
      x: centerX + point.x * pixelsPerMeter,
      y: centerY + point.y * pixelsPerMeter,
    });
    const pointInRect = (x: number, y: number) =>
      x >= normalized.left && x <= normalized.right && y >= normalized.top && y <= normalized.bottom;
    const segmentRectOverlap = (
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      if (maxX < normalized.left || minX > normalized.right || maxY < normalized.top || minY > normalized.bottom) {
        return false;
      }
      if (pointInRect(a.x, a.y) || pointInRect(b.x, b.y)) return true;
      const rectCenter = {
        x: (normalized.left + normalized.right) / 2,
        y: (normalized.top + normalized.bottom) / 2,
      };
      return distancePointToSegment(rectCenter, a, b) <= Math.max(normalized.width, normalized.height) / 2;
    };

    const selectedWalls: string[] = [];
    worldWalls.forEach((wall) => {
      const start = toScreen(wall.start);
      const end = toScreen(wall.end);
      if (segmentRectOverlap(start, end)) {
        selectedWalls.push(wall.id);
      }
    });

    const selectedColumns: string[] = [];
    worldWalls.forEach((wall) => {
      (wall.columns || []).forEach((column) => {
        const columnWorldPos = {
          x: wall.start.x + (wall.end.x - wall.start.x) * column.position,
          y: wall.start.y + (wall.end.y - wall.start.y) * column.position,
        };
        const screenPos = toScreen(columnWorldPos);
        if (pointInRect(screenPos.x, screenPos.y)) {
          selectedColumns.push(column.id);
        }
      });
    });

    const selectedProducts: string[] = [];
    interactiveProducts.forEach((product) => {
      const screenPos = toScreen({ x: product.position.x, y: product.position.z });
      if (pointInRect(screenPos.x, screenPos.y)) {
        selectedProducts.push(product.id);
      }
    });

    setMultiSelectedWallIds(selectedWalls);
    setMultiSelectedColumnIds(selectedColumns);
    setMultiSelectedProductIds(selectedProducts);

    if (selectedProducts.length > 0) {
      selectProduct(selectedProducts[0]);
      selectWall(null);
      selectColumn(null);
    } else if (selectedWalls.length > 0) {
      selectWall(selectedWalls[0]);
      selectProduct(null);
      selectColumn(null);
    } else if (selectedColumns.length > 0) {
      selectColumn(selectedColumns[0]);
      selectWall(null);
      selectProduct(null);
    } else {
      selectWall(null);
      selectColumn(null);
      selectProduct(null);
    }
  }, [canvasSize.width, canvasSize.height, pan.x, pan.y, pixelsPerMeter, worldWalls, interactiveProducts, getNormalizedRect, selectProduct, selectWall, selectColumn]);

  const startBulkDrag = useCallback((anchorWorld: { x: number; y: number }) => {
    const initialWalls = worldWalls
      .filter((wall) => multiSelectedWallsSet.has(wall.id))
      .map((wall) => ({
        id: wall.id,
        start: { ...wall.start },
        end: { ...wall.end },
      }));

    const initialProducts = interactiveProducts
      .filter((product) => multiSelectedProductsSet.has(product.id))
      .map((product) => ({
        id: product.id,
        x: product.position.x,
        z: product.position.z,
      }));

    if (initialWalls.length === 0 && initialProducts.length === 0) return false;

    bulkDragState.current = {
      anchorWorld,
      initialWalls,
      initialProducts,
    };
    return true;
  }, [worldWalls, interactiveProducts, multiSelectedWallsSet, multiSelectedProductsSet]);

  const deleteMultiSelection = useCallback(() => {
    if (!hasMultiSelection) return;

    multiSelectedProductIds.forEach((id) => removeProduct(id));
    multiSelectedWallIds.forEach((id) => removeWall(id));

    if (multiSelectedColumnIds.length > 0) {
      worldWalls.forEach((wall) => {
        (wall.columns || []).forEach((column) => {
          if (multiSelectedColumnIds.includes(column.id)) {
            removeColumn(wall.id, column.id);
          }
        });
      });
    }

    setMultiSelectedWallIds([]);
    setMultiSelectedColumnIds([]);
    setMultiSelectedProductIds([]);
    selectWall(null);
    selectColumn(null);
    selectProduct(null);
  }, [
    hasMultiSelection,
    multiSelectedProductIds,
    multiSelectedWallIds,
    multiSelectedColumnIds,
    removeProduct,
    removeWall,
    removeColumn,
    worldWalls,
    selectWall,
    selectColumn,
    selectProduct,
  ]);

  const isPointerOnCurrentSelection = useCallback((pos: { x: number; y: number }) => {
    if (!hasMultiSelection) return false;

    const centerX = canvasSize.width / 2 + pan.x;
    const centerY = canvasSize.height / 2 + pan.y;
    const toScreen = (point: { x: number; y: number }) => ({
      x: centerX + point.x * pixelsPerMeter,
      y: centerY + point.y * pixelsPerMeter,
    });

    for (const product of interactiveProducts) {
      if (!multiSelectedProductsSet.has(product.id)) continue;
      const screen = toScreen({ x: product.position.x, y: product.position.z });
      const rx = (product.scale?.x || 1) * pixelsPerMeter * 0.5;
      const rz = (product.scale?.z || 1) * pixelsPerMeter * 0.5;
      const radius = Math.max(rx, rz) / 2 + 10;
      if (Math.hypot(pos.x - screen.x, pos.y - screen.y) <= radius) return true;
    }

    for (const wall of worldWalls) {
      if (!multiSelectedWallsSet.has(wall.id)) continue;
      const start = toScreen(wall.start);
      const end = toScreen(wall.end);
      if (distancePointToSegment(pos, start, end) <= 15) return true;
    }

    for (const wall of worldWalls) {
      for (const column of wall.columns || []) {
        if (!multiSelectedColumnsSet.has(column.id)) continue;
        const worldPos = {
          x: wall.start.x + (wall.end.x - wall.start.x) * column.position,
          y: wall.start.y + (wall.end.y - wall.start.y) * column.position,
        };
        const screen = toScreen(worldPos);
        const size = Math.max(column.width, column.depth) * pixelsPerMeter * 0.5;
        if (Math.hypot(pos.x - screen.x, pos.y - screen.y) <= size + 8) return true;
      }
    }

    return false;
  }, [
    hasMultiSelection,
    canvasSize.width,
    canvasSize.height,
    pan.x,
    pan.y,
    pixelsPerMeter,
    interactiveProducts,
    worldWalls,
    multiSelectedProductsSet,
    multiSelectedWallsSet,
    multiSelectedColumnsSet,
  ]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pos = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      
      // Right-click handling
      if (event.button === 2) {
        event.preventDefault();
        // If in drawing mode, start new room (disconnect from last wall)
        if (isDrawingMode) {

          // COMPLETE reset of drawing state
          setDrawingStartPoint(null);
          setDrawingPreviewPoint(null);
          setSnappedPoint(null);
          setShowLengthInput(false);
          setLengthInputValue('');
          // DISABLE SNAPPING for next wall to prevent connecting to previous room
          disableSnappingRef.current = true;

          // Clear ALL drag states
          dragState.current = null;
          productDragState.current = null;
          panState.current = null;
          // Clear selection to indicate new room
          selectWall(null);
          selectProduct(null);
          selectColumn(null);
          return;
        }
        // Otherwise, pan
        panState.current = { x: pos.x - pan.x, y: pos.y - pan.y };
        return;
      }
      
      // Middle-click for panning
      if (event.button === 1) {
        event.preventDefault();
        panState.current = { x: pos.x - pan.x, y: pos.y - pan.y };
        return;
      }

      // If current click is on the existing multi-selection, start moving it immediately.
      if (!isDrawingMode && event.button === 0 && isPointerOnCurrentSelection(pos)) {
        const worldPos = screenToWorld(pos);
        if (startBulkDrag(worldPos)) {
          dragState.current = null;
          productDragState.current = null;
          return;
        }
      }

      // In marquee mode, clicking empty area starts a new rectangle selection.
      if (!isDrawingMode && pointerTool === 'marquee' && event.button === 0) {
        event.preventDefault();
        event.stopPropagation();
        dragState.current = null;
        productDragState.current = null;
        panState.current = null;
        setMarqueeRect({
          startX: pos.x,
          startY: pos.y,
          currentX: pos.x,
          currentY: pos.y,
        });
        return;
      }

      // Handle drawing mode - MUST be first to prevent any other interactions
      if (isDrawingMode && event.button === 0) {
        event.stopPropagation();
        event.preventDefault();
        
        const worldPos = screenToWorld(pos);
        
        // Check for snap to existing endpoints (but only if we have a start point)
        // Don't snap on first click OR if snapping is disabled (after right-click)
        let finalPos = worldPos;

        if (drawingStartPoint && !disableSnappingRef.current) {

          const snapPoint = findSnapPoint(worldPos, null);
          if (snapPoint) {

            finalPos = snapPoint;
          }
        } else {

        }
        
        // Apply length snapping if Ctrl is pressed
        if (isCtrlPressed && drawingStartPoint) {
          const dx = finalPos.x - drawingStartPoint.x;
          const dy = finalPos.y - drawingStartPoint.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const snappedLength = Math.round(length); // Snap to whole meters
          const angle = Math.atan2(dy, dx);
          finalPos = {
            x: drawingStartPoint.x + snappedLength * Math.cos(angle),
            y: drawingStartPoint.y + snappedLength * Math.sin(angle)
          };
        }
        
        // Apply angle locking if Shift is pressed
        if (isShiftPressed && drawingStartPoint) {
          const dx = finalPos.x - drawingStartPoint.x;
          const dy = finalPos.y - drawingStartPoint.y;
          const angle = Math.atan2(dy, dx);
          const snappedAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2); // Snap to 90° increments
          const length = Math.sqrt(dx * dx + dy * dy);
          finalPos = {
            x: drawingStartPoint.x + length * Math.cos(snappedAngle),
            y: drawingStartPoint.y + length * Math.sin(snappedAngle)
          };
        }
        
        if (!drawingStartPoint) {
          // First click - set start point
          setDrawingStartPoint(finalPos);
          // Keep snapping disabled for the second click too
        } else {
          // Check minimum distance to prevent accidental clicks
          const dx = finalPos.x - drawingStartPoint.x;
          const dy = finalPos.y - drawingStartPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Minimum 0.1 meters (10cm) to create a wall
          if (distance < 0.1) {

            return;
          }
          
          // Second click - create wall


          
          // Use global default texture, or texture from most recent wall, or default to 'painted_white'
          const defaultTexture = layout.defaultWallTexture || 
            (layout.walls.length > 0 ? layout.walls[layout.walls.length - 1].texture : undefined) || 
            'painted_white';
          const wallId = upsertWall({
            start: drawingStartPoint,
            end: finalPos,
            height: 2.4, // Reduced from 3m to 2.4m for better proportions
            thickness: defaultWallThickness,
            color: layout.defaultWallColor || '#64748b',
            texture: defaultTexture as any
          });
          
          // Continue drawing from this endpoint
          setDrawingStartPoint(finalPos);
          setDrawingPreviewPoint(null);
          setSnappedPoint(null);
          
          // NOW re-enable snapping after first wall is complete

          disableSnappingRef.current = false;
          
          // Select the newly created wall
          selectWall(wallId);
        }
        return;
      }

      // CRITICAL: Skip ALL handle detection if in drawing mode
      // This prevents the system from thinking we're dragging a wall handle
      if (!isDrawingMode) {
        const handle = getWallHandleAtPosition(pos);
        if (handle) {
          dragState.current = handle;
          selectWall(handle.wallId);
          selectColumn(null);
          return;
        }
      } else {
        // Explicitly prevent any drag state in drawing mode
        dragState.current = null;
        productDragState.current = null;
      }
      
      // Check if clicking on a product or column (only if not in drawing mode)
      if (!isDrawingMode) {
        // Check if clicking on a product or column
        const centerX = canvasSize.width / 2 + pan.x;
        const centerY = canvasSize.height / 2 + pan.y;
        const toScreen = (point: { x: number; y: number }) => ({
          x: centerX + point.x * pixelsPerMeter,
          y: centerY + point.y * pixelsPerMeter,
        });

        // Check products first
        let clickedProductId: string | null = null;
        let productOffset: { x: number; y: number } | null = null;
        for (const product of interactiveProducts) {
          const productScreenPos = toScreen({ x: product.position.x, y: product.position.z });
          const productSizeX = (product.scale?.x || 1) * pixelsPerMeter * 0.5;
          const productSizeZ = (product.scale?.z || 1) * pixelsPerMeter * 0.5;
          const maxRadius = Math.max(productSizeX, productSizeZ) / 2;
          const dist = Math.hypot(pos.x - productScreenPos.x, pos.y - productScreenPos.y);
          
          if (dist < maxRadius + 10) {
            clickedProductId = product.id;
            productOffset = {
              x: product.position.x - screenToWorld(pos).x,
              y: product.position.z - screenToWorld(pos).y
            };
            break;
          }
        }

        if (clickedProductId && productOffset) {
          setMultiSelectedWallIds([]);
          setMultiSelectedColumnIds([]);
          setMultiSelectedProductIds([]);
          selectProduct(clickedProductId);
          selectWall(null);
          selectColumn(null);
          // Start dragging the product
          productDragState.current = {
            productId: clickedProductId,
            offset: productOffset
          };
          return;
        }

        let clickedColumn: { wallId: string; columnId: string } | null = null;
        
        for (const wall of worldWalls) {
          if (wall.columns) {
            for (const column of wall.columns) {
              const columnWorldPos = {
                x: wall.start.x + (wall.end.x - wall.start.x) * column.position,
                y: wall.start.y + (wall.end.y - wall.start.y) * column.position,
              };
              const columnScreenPos = toScreen(columnWorldPos);
              const columnWidthPx = column.width * pixelsPerMeter;
              const columnDepthPx = column.depth * pixelsPerMeter;
              const maxRadius = Math.max(columnWidthPx, columnDepthPx) / 2;
              const dist = Math.hypot(pos.x - columnScreenPos.x, pos.y - columnScreenPos.y);
              
              if (dist < maxRadius + 5) {
                clickedColumn = { wallId: wall.id, columnId: column.id };
                break;
              }
            }
            if (clickedColumn) break;
          }
        }

        if (clickedColumn) {
          setMultiSelectedWallIds([]);
          setMultiSelectedColumnIds([]);
          setMultiSelectedProductIds([]);
          selectColumn(clickedColumn.columnId);
          selectWall(null);
        } else {
          // Check if clicking on wall body for dragging entire wall
          let closestId: string | null = null;
          let closestDist = Infinity;
          let closestWall: ShopBuilderWall | null = null;
          
          worldWalls.forEach((wall) => {
            const start = toScreen(wall.start);
            const end = toScreen(wall.end);
            const dist = distancePointToSegment(pos, start, end);
            if (dist < closestDist) {
              closestDist = dist;
              closestId = wall.id;
              closestWall = wall;
            }
          });
          if (closestId && closestDist < 15 && closestWall) {
            setMultiSelectedWallIds([]);
            setMultiSelectedColumnIds([]);
            setMultiSelectedProductIds([]);
            selectWall(closestId);
            selectColumn(null);
            // Enable dragging entire wall
            const worldPos = screenToWorld(pos);
            dragState.current = {
              wallId: closestId,
              handle: 'body',
              offset: {
                x: worldPos.x - (closestWall.start.x + closestWall.end.x) / 2,
                y: worldPos.y - (closestWall.start.y + closestWall.end.y) / 2,
              },
            };
          } else {
            setMultiSelectedWallIds([]);
            setMultiSelectedColumnIds([]);
            setMultiSelectedProductIds([]);
            selectWall(null);
            selectColumn(null);
          }
        }
      }
    },
    [
      getWallHandleAtPosition, 
      selectWall, 
      selectColumn, 
      selectProduct, 
      interactiveProducts,
      layout.walls,
      worldWalls, 
      pixelsPerMeter, 
      canvasSize.width, 
      canvasSize.height, 
      pan.x, 
      pan.y, 
      screenToWorld,
      isDrawingMode,
      drawingStartPoint,
      findSnapPoint,
      defaultWallThickness,
      upsertWall,
      isCtrlPressed,
      isShiftPressed,
      pointerTool,
      hasMultiSelection,
      multiSelectedProductsSet,
      multiSelectedWallsSet,
      startBulkDrag
    ]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pos = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };

      if (pointerTool === 'marquee' && marqueeRect) {
        setMarqueeRect((prev) =>
          prev
            ? {
                ...prev,
                currentX: pos.x,
                currentY: pos.y,
              }
            : prev
        );
        return;
      }

      // Handle drawing mode preview - ONLY update preview, don't allow dragging
      if (isDrawingMode) {
        const worldPos = screenToWorld(pos);
        setDrawingPreviewPoint(worldPos);
        
        // Check for snap points only if we have a start point AND snapping is enabled
        if (drawingStartPoint && !disableSnappingRef.current) {
          const snapPoint = findSnapPoint(worldPos, null);
          setSnappedPoint(snapPoint);
        } else {
          setSnappedPoint(null); // Clear snap indicator if snapping is disabled
        }
        return; // IMPORTANT: Return early to prevent any dragging in drawing mode
      }

      if (panState.current) {
        setPan({ x: pos.x - panState.current.x, y: pos.y - panState.current.y });
        return;
      }

      // Bulk move currently multi-selected walls/products while preserving relative layout.
      if (bulkDragState.current) {
        const worldPos = screenToWorld(pos);
        const { anchorWorld, initialWalls, initialProducts } = bulkDragState.current;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        initialWalls.forEach((wall) => {
          minX = Math.min(minX, wall.start.x, wall.end.x);
          maxX = Math.max(maxX, wall.start.x, wall.end.x);
          minY = Math.min(minY, wall.start.y, wall.end.y);
          maxY = Math.max(maxY, wall.start.y, wall.end.y);
        });
        initialProducts.forEach((product) => {
          minX = Math.min(minX, product.x);
          maxX = Math.max(maxX, product.x);
          minY = Math.min(minY, product.z);
          maxY = Math.max(maxY, product.z);
        });

        const floorHalf = (layout.floorSize || 24) / 2;
        const rawDx = worldPos.x - anchorWorld.x;
        const rawDy = worldPos.y - anchorWorld.y;
        const dx = Number.isFinite(minX) && Number.isFinite(maxX)
          ? Math.max(-floorHalf - minX, Math.min(floorHalf - maxX, rawDx))
          : rawDx;
        const dy = Number.isFinite(minY) && Number.isFinite(maxY)
          ? Math.max(-floorHalf - minY, Math.min(floorHalf - maxY, rawDy))
          : rawDy;

        initialWalls.forEach((initialWall) => {
          const target = worldWalls.find((w) => w.id === initialWall.id);
          if (!target) return;
          upsertWall({
            ...target,
            start: {
              x: initialWall.start.x + dx,
              y: initialWall.start.y + dy,
            },
            end: {
              x: initialWall.end.x + dx,
              y: initialWall.end.y + dy,
            },
          });
        });

        initialProducts.forEach((initialProduct) => {
          const target = interactiveProducts.find((p) => p.id === initialProduct.id);
          if (!target) return;
          upsertProduct({
            id: initialProduct.id,
            position: {
              ...target.position,
              x: initialProduct.x + dx,
              z: initialProduct.z + dy,
            },
          });
        });
        return;
      }

      // Handle product dragging
      if (productDragState.current) {
        const worldPos = screenToWorld(pos);
        const { productId, offset } = productDragState.current;
        const product = interactiveProducts.find(p => p.id === productId);
        if (product) {
          const floorSize = layout.floorSize || 24;
          const newX = Math.max(-floorSize / 2, Math.min(floorSize / 2, worldPos.x + offset.x));
          const newZ = Math.max(-floorSize / 2, Math.min(floorSize / 2, worldPos.y + offset.y));
          upsertProduct({
            id: productId,
            position: { ...product.position, x: newX, z: newZ }
          });
        }
        return;
      }

      if (!dragState.current) return;
      const worldPos = screenToWorld(pos);
      const { wallId, handle, offset } = dragState.current;
      const target = worldWalls.find((wall) => wall.id === wallId);
      if (!target) return;

      if (handle === 'body') {
        // Move entire wall
        const newCenterX = worldPos.x - (offset?.x || 0);
        const newCenterY = worldPos.y - (offset?.y || 0);
        const currentCenterX = (target.start.x + target.end.x) / 2;
        const currentCenterY = (target.start.y + target.end.y) / 2;
        const deltaX = newCenterX - currentCenterX;
        const deltaY = newCenterY - currentCenterY;

        const floorSize = layout.floorSize || 24;
        const newStart = {
          x: Math.max(-floorSize / 2, Math.min(floorSize / 2, target.start.x + deltaX)),
          y: Math.max(-floorSize / 2, Math.min(floorSize / 2, target.start.y + deltaY)),
        };
        const newEnd = {
          x: Math.max(-floorSize / 2, Math.min(floorSize / 2, target.end.x + deltaX)),
          y: Math.max(-floorSize / 2, Math.min(floorSize / 2, target.end.y + deltaY)),
        };

        upsertWall({
          ...target,
          start: newStart,
          end: newEnd,
        });
      } else {
        // Move single endpoint with smooth snapping
        const floorSize = layout.floorSize || 24;
        let finalPos = {
          x: Math.max(-floorSize / 2, Math.min(floorSize / 2, worldPos.x)),
          y: Math.max(-floorSize / 2, Math.min(floorSize / 2, worldPos.y)),
        };

        // Try to snap to nearby endpoints - this actually moves the point!
        const snapPoint = findSnapPoint(finalPos, wallId);
        if (snapPoint) {

          // Smoothly snap to the exact position
          finalPos = { x: snapPoint.x, y: snapPoint.y };
        }

        const updated: ShopBuilderWall = {
          ...target,
          [handle]: finalPos,
        } as ShopBuilderWall;
        upsertWall(updated);
      }
    },
    [
      screenToWorld, 
      upsertWall, 
      worldWalls, 
      findSnapPoint, 
      interactiveProducts,
      layout.floorSize,
      upsertProduct,
      isDrawingMode,
      drawingStartPoint,
      pointerTool,
      marqueeRect
    ]
  );

  const onPointerUp = useCallback(() => {
    if (pointerTool === 'marquee' && marqueeRect) {
      applyMarqueeSelection(marqueeRect);
      setMarqueeRect(null);
    }
    // Clear all drag states
    dragState.current = null;
    productDragState.current = null;
    bulkDragState.current = null;
    panState.current = null;
    
    // In drawing mode, don't clear drawing preview
    // This allows the preview line to stay visible
  }, [pointerTool, marqueeRect, applyMarqueeSelection]);

  const onWheel = useCallback((event: WheelEvent) => {
    // In drawing mode, only zoom if mouse is over the canvas
    // This allows page scrolling when mouse is outside
    if (isDrawingMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const isOverCanvas = 
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      
      if (!isOverCanvas) {
        // Allow page scroll
        return;
      }
    }
    
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * delta)));
  }, [isDrawingMode]);

  // Add wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const handleWallUpdate = useCallback(
    (field: keyof ShopBuilderWall, value: unknown) => {
      if (!selectedWall) return;
      upsertWall({ ...selectedWall, [field]: value });
    },
    [selectedWall, upsertWall]
  );

  const handleDeleteWall = useCallback(() => {
    if (!selectedWallId) return;
    removeWall(selectedWallId);
  }, [selectedWallId, removeWall]);

  const applySelectedWallLength = useCallback((length: number) => {
    if (!selectedWall || !(length > 0)) return;
    const dx = selectedWall.end.x - selectedWall.start.x;
    const dy = selectedWall.end.y - selectedWall.start.y;
    const angle = Math.atan2(dy, dx);
    handleWallUpdate('end', {
      x: selectedWall.start.x + length * Math.cos(angle),
      y: selectedWall.start.y + length * Math.sin(angle),
    });
  }, [handleWallUpdate, selectedWall]);

  // Scrubby slider handlers
  const handleScrubbyStart = useCallback((e: React.MouseEvent, field: string, currentValue: number, step: number) => {
    e.preventDefault();
    scrubbyState.current = {
      active: true,
      startX: e.clientX,
      startValue: currentValue,
      field,
      step
    };
    document.body.style.cursor = 'ew-resize';
  }, []);

  const handleScrubbyMove = useCallback((e: MouseEvent) => {
    if (!scrubbyState.current?.active || !selectedWall) return;
    
    const deltaX = e.clientX - scrubbyState.current.startX;
    const steps = Math.round(deltaX / 5); // 5 pixels = 1 step (reduced sensitivity from 2)
    const newValue = scrubbyState.current.startValue + (steps * scrubbyState.current.step);
    
    const field = scrubbyState.current.field;
    
    if (field === 'length') {
      const currentLength = Math.hypot(selectedWall.end.x - selectedWall.start.x, selectedWall.end.y - selectedWall.start.y);
      if (currentLength > 0 && newValue > 0) {
        const ratio = newValue / currentLength;
        const dx = selectedWall.end.x - selectedWall.start.x;
        const dy = selectedWall.end.y - selectedWall.start.y;
        handleWallUpdate('end', {
          x: selectedWall.start.x + dx * ratio,
          y: selectedWall.start.y + dy * ratio
        });
      }
    } else if (field === 'angle') {
      const angle = newValue * Math.PI / 180;
      const length = Math.hypot(selectedWall.end.x - selectedWall.start.x, selectedWall.end.y - selectedWall.start.y);
      handleWallUpdate('end', {
        x: selectedWall.start.x + length * Math.cos(angle),
        y: selectedWall.start.y + length * Math.sin(angle)
      });
    } else {
      handleWallUpdate(field as keyof ShopBuilderWall, Math.max(0.1, newValue));
    }
  }, [selectedWall, handleWallUpdate]);

  const handleScrubbyEnd = useCallback(() => {
    if (scrubbyState.current?.active) {
      scrubbyState.current = null;
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

  // Keyboard event handlers: fast inline wall length typing (draw + selected wall)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isNumberKey = /^[0-9.]$/.test(e.key);
      const openInlineLengthInput = (mode: 'draw' | 'selected', firstChar?: string) => {
        setShowLengthInput(true);
        setLengthInputMode(mode);
        if (firstChar && /^[0-9.]$/.test(firstChar)) {
          setLengthInputValue(firstChar === '.' ? '0.' : firstChar);
        } else {
          setLengthInputValue('');
        }
      };

      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);

      if ((e.key === 'Delete' || e.key === 'Backspace') && hasMultiSelection) {
        e.preventDefault();
        deleteMultiSelection();
        return;
      }

      if (e.key === 'Escape' && isDrawingMode) {
        setDrawingMode(false);
        setDrawingStartPoint(null);
        setDrawingPreviewPoint(null);
        setSnappedPoint(null);
        setShowLengthInput(false);
        setLengthInputMode(null);
        setLengthInputValue('');
      }

      if ((e.key === 'Tab' || e.key === 'l' || e.key === 'L') && isDrawingMode && drawingStartPoint && !showLengthInput) {
        e.preventDefault();
        openInlineLengthInput('draw');
      }

      if (isNumberKey && isDrawingMode && drawingStartPoint && !showLengthInput) {
        e.preventDefault();
        openInlineLengthInput('draw', e.key);
      }

      if (isNumberKey && !isDrawingMode && selectedWall && !showLengthInput) {
        e.preventDefault();
        openInlineLengthInput('selected', e.key);
      }

      if (
        e.key === 'Enter' &&
        showLengthInput &&
        lengthInputMode === 'draw' &&
        lengthInputValue &&
        drawingStartPoint &&
        drawingPreviewPoint
      ) {
        e.preventDefault();
        const length = parseFloat(lengthInputValue);
        if (!isNaN(length) && length > 0) {
          const dx = drawingPreviewPoint.x - drawingStartPoint.x;
          const dy = drawingPreviewPoint.y - drawingStartPoint.y;
          const angle = Math.atan2(dy, dx);
          const endPoint = {
            x: drawingStartPoint.x + length * Math.cos(angle),
            y: drawingStartPoint.y + length * Math.sin(angle)
          };

          const defaultTexture = layout.defaultWallTexture ||
            (layout.walls.length > 0 ? layout.walls[layout.walls.length - 1].texture : undefined) ||
            'painted_white';
          const wallId = upsertWall({
            start: drawingStartPoint,
            end: endPoint,
            height: 3,
            thickness: defaultWallThickness,
            color: '#64748b',
            texture: defaultTexture as any
          });

          setDrawingStartPoint(endPoint);
          setDrawingPreviewPoint(null);
          setSnappedPoint(null);
          setShowLengthInput(false);
          setLengthInputMode(null);
          setLengthInputValue('');
          selectWall(wallId);
        }
      }

      if (e.key === 'Enter' && showLengthInput && lengthInputMode === 'selected' && lengthInputValue && selectedWall) {
        e.preventDefault();
        const length = parseFloat(lengthInputValue);
        if (!isNaN(length) && length > 0) {
          applySelectedWallLength(length);
          setShowLengthInput(false);
          setLengthInputMode(null);
          setLengthInputValue('');
        }
      }

      if (e.key === 'Escape' && showLengthInput) {
        e.preventDefault();
        setShowLengthInput(false);
        setLengthInputMode(null);
        setLengthInputValue('');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isDrawingMode,
    drawingStartPoint,
    drawingPreviewPoint,
    showLengthInput,
    lengthInputValue,
    lengthInputMode,
    selectedWall,
    setDrawingMode,
    layout.defaultWallTexture,
    layout.walls,
    defaultWallThickness,
    upsertWall,
    selectWall,
    applySelectedWallLength,
    hasMultiSelection,
    deleteMultiSelection
  ]);

  // Reset drawing state when entering/exiting drawing mode
  useEffect(() => {
    if (!isDrawingMode) {
      // Exiting drawing mode - clear all drawing state
      setDrawingStartPoint(null);
      setDrawingPreviewPoint(null);
      setSnappedPoint(null);
      setShowLengthInput(false);
      setLengthInputMode(null);
      setLengthInputValue('');
      // Clear drag states
      dragState.current = null;
      productDragState.current = null;
      bulkDragState.current = null;
      panState.current = null;
      // Reset snapping flag
      disableSnappingRef.current = false;
    } else {
      // Drawing mode always uses drawing pointer behavior.
      setPointerTool('default');
      setMarqueeRect(null);
    }
  }, [isDrawingMode]);

  // Removed info banner for cleaner UI

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Canvas with Overlay Panels */}
      <div className="flex-1 relative min-h-0" ref={containerRef}>
        {!isDrawingMode && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-md">
            <button
              type="button"
              onClick={() => {
                setPointerTool('default');
                setMarqueeRect(null);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                pointerTool === 'default'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              تحديد عادي
            </button>
            <button
              type="button"
              onClick={() => setPointerTool('marquee')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                pointerTool === 'marquee'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              )}
            >
              تحديد جماعي
            </button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg bg-white shadow-lg touch-none border-2 border-slate-300"
          style={{ 
            cursor: panState.current 
              ? 'grabbing' 
              : dragState.current?.handle === 'body' 
                ? 'move' 
                : dragState.current 
                  ? 'crosshair' 
                  : isDrawingMode 
                    ? 'crosshair'
                    : pointerTool === 'marquee'
                      ? 'crosshair'
                      : 'default' 
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            // Right-click to deselect all
            selectWall(null);
            selectColumn(null);
            selectProduct(null);
            setMultiSelectedWallIds([]);
            setMultiSelectedColumnIds([]);
            setMultiSelectedProductIds([]);
            setMarqueeRect(null);
          }}
        />

        {/* Compact Length Input Popup */}
        {showLengthInput && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-2xl p-4 min-w-[220px]">
              <p className="text-white/90 text-[11px] font-semibold mb-2 text-center">
                {lengthInputMode === 'selected' ? 'تعديل طول الجدار المحدد (م)' : 'طول الجدار الجديد (م)'}
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={lengthInputValue}
                  onChange={(e) => setLengthInputValue(e.target.value)}
                  placeholder="الطول"
                  className="text-center text-base font-bold bg-white/95 border-0 h-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowLengthInput(false);
                      setLengthInputMode(null);
                      setLengthInputValue('');
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const length = parseFloat(lengthInputValue);
                      if (lengthInputMode === 'selected' && !isNaN(length) && length > 0 && selectedWall) {
                        applySelectedWallLength(length);
                        setShowLengthInput(false);
                        setLengthInputMode(null);
                        setLengthInputValue('');
                      } else if (lengthInputMode !== 'selected' && !isNaN(length) && length > 0 && drawingStartPoint && drawingPreviewPoint) {
                        const dx = drawingPreviewPoint.x - drawingStartPoint.x;
                        const dy = drawingPreviewPoint.y - drawingStartPoint.y;
                        const angle = Math.atan2(dy, dx);
                        const endPoint = {
                          x: drawingStartPoint.x + length * Math.cos(angle),
                          y: drawingStartPoint.y + length * Math.sin(angle)
                        };
                        const defaultTexture = layout.defaultWallTexture ||
                          (layout.walls.length > 0 ? layout.walls[layout.walls.length - 1].texture : undefined) ||
                          'painted_white';
                        const wallId = upsertWall({
                          start: drawingStartPoint,
                          end: endPoint,
                          height: 3,
                          thickness: defaultWallThickness,
                          color: '#64748b',
                          texture: defaultTexture as any
                        });
                        setDrawingStartPoint(endPoint);
                        setDrawingPreviewPoint(null);
                        setSnappedPoint(null);
                        setShowLengthInput(false);
                        setLengthInputMode(null);
                        setLengthInputValue('');
                        selectWall(wallId);
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const length = parseFloat(lengthInputValue);
                    if (lengthInputMode === 'selected' && !isNaN(length) && length > 0 && selectedWall) {
                      applySelectedWallLength(length);
                      setShowLengthInput(false);
                      setLengthInputMode(null);
                      setLengthInputValue('');
                    } else if (lengthInputMode !== 'selected' && !isNaN(length) && length > 0 && drawingStartPoint && drawingPreviewPoint) {
                      const dx = drawingPreviewPoint.x - drawingStartPoint.x;
                      const dy = drawingPreviewPoint.y - drawingStartPoint.y;
                      const angle = Math.atan2(dy, dx);
                      const endPoint = {
                        x: drawingStartPoint.x + length * Math.cos(angle),
                        y: drawingStartPoint.y + length * Math.sin(angle)
                      };
                      // Use global default texture
                      const defaultTexture = layout.defaultWallTexture || 
                        (layout.walls.length > 0 ? layout.walls[layout.walls.length - 1].texture : undefined) || 
                        'painted_white';
                      const wallId = upsertWall({
                        start: drawingStartPoint,
                        end: endPoint,
                        height: 3,
                        thickness: defaultWallThickness,
                        color: '#64748b',
                        texture: defaultTexture as any
                      });
                      setDrawingStartPoint(endPoint);
                      setDrawingPreviewPoint(null);
                      setSnappedPoint(null);
                      setShowLengthInput(false);
                      setLengthInputMode(null);
                      setLengthInputValue('');
                      selectWall(wallId);
                    }
                  }}
                  size="sm"
                  className="bg-white hover:bg-white/90 text-primary font-bold h-10 px-4"
                >
                  ✓
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Old panels removed - now using bottom toolbar in ShopBuilder3DPage */}

      </div>
    </div>
  );
};

export default FloorplanCanvas;
