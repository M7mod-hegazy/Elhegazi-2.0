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


  const pixelsPerMeter = useMemo(() => {
    const availableWidth = canvasSize.width - CANVAS_PADDING * 2;
    const availableHeight = canvasSize.height - CANVAS_PADDING * 2;
    const floorSize = layout.floorSize || 24; // Default to 24m if not set
    return Math.min(availableWidth, availableHeight) / floorSize * zoom;
  }, [canvasSize.width, canvasSize.height, zoom, layout.floorSize]);

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

      // wall line - Increased width, reduced visual height representation
      ctx.beginPath();
      ctx.strokeStyle = wall.id === selectedWallId ? primaryColor : wall.color;
      ctx.lineWidth = wall.id === selectedWallId ? 12 : 10; // Increased from 6/5 to 12/10
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // endpoints
      ctx.fillStyle = wall.id === selectedWallId ? primaryColor : '#64748b';
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
            ctx.fillStyle = column.id === selectedColumnId ? secondaryColor : column.color;
            ctx.strokeStyle = column.id === selectedColumnId ? primaryColor : '#64748b';
            ctx.lineWidth = column.id === selectedColumnId ? 3 : 2;
            ctx.beginPath();
            ctx.arc(columnScreenPos.x, columnScreenPos.y, columnWidthPx / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            // Square or rectangular column
            ctx.save();
            ctx.translate(columnScreenPos.x, columnScreenPos.y);
            ctx.rotate(wallAngle);
            
            ctx.fillStyle = column.id === selectedColumnId ? secondaryColor : column.color;
            ctx.strokeStyle = column.id === selectedColumnId ? primaryColor : '#64748b';
            ctx.lineWidth = column.id === selectedColumnId ? 3 : 2;
            
            ctx.fillRect(-columnDepthPx / 2, -columnWidthPx / 2, columnDepthPx, columnWidthPx);
            ctx.strokeRect(-columnDepthPx / 2, -columnWidthPx / 2, columnDepthPx, columnWidthPx);
            
            ctx.restore();
          }

          // Selection indicator
          if (column.id === selectedColumnId) {
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

    // Draw 3D products (top-down view)
    layout.products.forEach((product) => {
      const productScreenPos = toScreen({ x: product.position.x, y: product.position.z });
      
      // Estimate product size (default 1m x 1m if no scale info)
      const productSizeX = (product.scale?.x || 1) * pixelsPerMeter * 0.5;
      const productSizeZ = (product.scale?.z || 1) * pixelsPerMeter * 0.5;
      
      const isSelected = product.id === selectedProductId;
      
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
  }, [canvasSize.width, canvasSize.height, worldWalls, selectedWallId, selectedColumnId, selectedProductId, layout.products, pixelsPerMeter, pan.x, pan.y, isDrawingMode, drawingStartPoint, drawingPreviewPoint, snappedPoint]);

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
        for (const product of layout.products) {
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
      layout.products, 
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
      isShiftPressed
    ]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pos = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };

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

      // Handle product dragging
      if (productDragState.current) {
        const worldPos = screenToWorld(pos);
        const { productId, offset } = productDragState.current;
        const product = layout.products.find(p => p.id === productId);
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
      layout.products, 
      layout.floorSize,
      upsertProduct,
      isDrawingMode,
      drawingStartPoint
    ]
  );

  const onPointerUp = useCallback(() => {
    // Clear all drag states
    dragState.current = null;
    productDragState.current = null;
    panState.current = null;
    
    // In drawing mode, don't clear drawing preview
    // This allows the preview line to stay visible
  }, []);

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

  // Keyboard event handlers for drawing mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true);
      }
      if (e.key === 'Escape' && isDrawingMode) {
        setDrawingMode(false);
        setDrawingStartPoint(null);
        setDrawingPreviewPoint(null);
        setSnappedPoint(null);
        setShowLengthInput(false);
      }
      // Tab or L key to open length input
      if ((e.key === 'Tab' || e.key === 'l' || e.key === 'L') && isDrawingMode && drawingStartPoint && !showLengthInput) {
        e.preventDefault();
        setShowLengthInput(true);
        setLengthInputValue('');
      }
      // Enter key to confirm length input
      if (e.key === 'Enter' && showLengthInput && lengthInputValue && drawingStartPoint && drawingPreviewPoint) {
        e.preventDefault();
        const length = parseFloat(lengthInputValue);
        if (!isNaN(length) && length > 0) {
          // Calculate direction from start to preview point
          const dx = drawingPreviewPoint.x - drawingStartPoint.x;
          const dy = drawingPreviewPoint.y - drawingStartPoint.y;
          const angle = Math.atan2(dy, dx);
          
          // Create endpoint at exact length
          const endPoint = {
            x: drawingStartPoint.x + length * Math.cos(angle),
            y: drawingStartPoint.y + length * Math.sin(angle)
          };
          
          // Create wall with global default texture
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
          
          // Continue from endpoint
          setDrawingStartPoint(endPoint);
          setDrawingPreviewPoint(null);
          setSnappedPoint(null);
          setShowLengthInput(false);
          setLengthInputValue('');
          selectWall(wallId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDrawingMode, setDrawingMode]);

  // Reset drawing state when entering/exiting drawing mode
  useEffect(() => {
    if (!isDrawingMode) {
      // Exiting drawing mode - clear all drawing state
      setDrawingStartPoint(null);
      setDrawingPreviewPoint(null);
      setSnappedPoint(null);
      setShowLengthInput(false);
      setLengthInputValue('');
      // Clear drag states
      dragState.current = null;
      productDragState.current = null;
      panState.current = null;
      // Reset snapping flag
      disableSnappingRef.current = false;
    }
  }, [isDrawingMode]);

  // Removed info banner for cleaner UI

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Canvas with Overlay Panels */}
      <div className="flex-1 relative min-h-0" ref={containerRef}>
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
          }}
        />

        {/* Compact Length Input Popup */}
        {showLengthInput && isDrawingMode && drawingStartPoint && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-2xl p-4 min-w-[220px]">
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
                      setLengthInputValue('');
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const length = parseFloat(lengthInputValue);
                    if (!isNaN(length) && length > 0 && drawingPreviewPoint) {
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
