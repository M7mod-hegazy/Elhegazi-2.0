import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wall } from '@/components/room-planner/plannerConstants';

export type Walls2DPlannerModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  walls: any[];
  onAddWall: (w: any) => void;
  onUpdateWallPosition: (id: string, x: number, z: number) => void;
  onRotateWall: (id: string, deltaY: number) => void;
  onSelectWall: (id: string | null) => void;
  wallSides: Record<string, 'front' | 'back'>;
  onToggleWallSide: (id: string) => void;
  onUpdateWallSize: (id: string, patch: { name?: string; width?: number; height?: number; depth?: number }) => void;
  onConnectWalls?: (selfId: string, selfEndpoint: 'a'|'b', otherId: string, otherEndpoint: 'a'|'b') => void;
  onResetToDefaultWalls?: () => void;
  onSetWallRotationAbs?: (id: string, radians: number) => void; // preferred: absolute angle API
};

const Walls2DPlannerModal: React.FC<Walls2DPlannerModalProps> = ({ open, onOpenChange, walls, onAddWall, onUpdateWallPosition, onRotateWall, onSelectWall, wallSides, onToggleWallSide, onUpdateWallSize, onConnectWalls, onResetToDefaultWalls, onSetWallRotationAbs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [newWall, setNewWall] = useState({ width: 400, height: 250, depth: 10, rotationY: 0, posX: 0, posZ: 0, name: 'Wall' });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
  const [zoom, setZoom] = useState(2.8); // 2D zoom factor (start even closer)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateStartAngle, setRotateStartAngle] = useState<number>(0);
  const [rotateStartWallAngle, setRotateStartWallAngle] = useState<number>(0);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // pixels
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showDims, setShowDims] = useState(true);
  const [showDir, setShowDir] = useState(true);
  const [dimSideOverride, setDimSideOverride] = useState<Record<string, 1 | -1 | null>>({});
  const [booting, setBooting] = useState(false);
  const [snapCandidate, setSnapCandidate] = useState<null | { targetWallId: string; targetEndpoint: 'a'|'b'; sourceEndpoint: 'a'|'b'; ex: number; ez: number }>(null);

  const floor = useMemo(() => walls.find(w => w.id === 'floor'), [walls]);
  const nonFloor = useMemo(() => walls.filter(w => w.id !== 'floor'), [walls]);

  // Track Space key for panning
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { setSpaceHeld(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };

  }, []);

  // Compute dimension side sign for a wall: +1 (front/+normal) or -1 (back/-normal)
  const getDimSideSign = (w: any): 1 | -1 => {
    const ov = dimSideOverride[w.id as string];
    if (ov === 1 || ov === -1) return ov;
    // Auto: pick the side with more available space to canvas bounds along the rotated normal
    const el = containerRef.current;
    if (!el) return 1;
    const rect = { w: el.clientWidth, h: el.clientHeight };
    const p = worldToView(w.position.x, w.position.z);
    const theta = w.rotation?.y ?? 0;
    // local normal is +Y in rotated space -> in view px: n = (sin(theta), -cos(theta))
    const nx = Math.sin(theta);
    const ny = -Math.cos(theta);
    // distance to edges along +n and -n (ray to bounds). Consider both axes constraints.
    const distToEdge = (sx: number, sy: number) => {
      const INF = 1e9;
      let tx = INF, ty = INF;
      if (sx > 0) tx = (rect.w - p.left) / sx; else if (sx < 0) tx = (0 - p.left) / sx;
      if (sy > 0) ty = (rect.h - p.top) / sy; else if (sy < 0) ty = (0 - p.top) / sy;
      const t = Math.min(tx, ty);
      return t > 0 ? t : 0;
    };
    const plus = distToEdge(nx, ny);
    const minus = distToEdge(-nx, -ny);
    return plus >= minus ? 1 : -1;
  };

  // Show a small loading overlay when opening
  React.useEffect(() => {
    if (open) {
      setBooting(true);
      const t = setTimeout(() => setBooting(false), 350);
      return () => clearTimeout(t);
    } else {
      setBooting(false);
    }
  }, [open]);

  const worldToView = (x: number, z: number) => {
    // Map world cm to pixels within the container; fit floor bounds
    const el = containerRef.current;
    if (!el) return { left: 0, top: 0 };
    const pad = 16;
    const w = (el.clientWidth - pad * 2);
    const h = (el.clientHeight - pad * 2);
    const minX = floor ? floor.position.x - floor.width / 2 : -500;
    const maxX = floor ? floor.position.x + floor.width / 2 : 500;
    const minZ = floor ? floor.position.z - floor.depth / 2 : -500;
    const maxZ = floor ? floor.position.z + floor.depth / 2 : 500;
    // isotropic base scale; apply zoom and pan directly so geometry scales uniformly
    const s = Math.min(w / (maxX - minX), h / (maxZ - minZ));
    const left = pad + (x - minX) * s * zoom + pan.x;
    const top = pad + (z - minZ) * s * zoom + pan.y;
    return { left, top };
  };

  const viewToWorldScale = () => {
    const el = containerRef.current;
    if (!el) return { scaleX: 1, scaleZ: 1, minX: 0, minZ: 0, pad: 16 };
    const pad = 16;
    const w = el.clientWidth - pad * 2;
    const h = el.clientHeight - pad * 2;
    const minX = floor ? floor.position.x - floor.width / 2 : -500;
    const maxX = floor ? floor.position.x + floor.width / 2 : 500;
    const minZ = floor ? floor.position.z - floor.depth / 2 : -500;
    const maxZ = floor ? floor.position.z + floor.depth / 2 : 500;
    const s = Math.min(w / (maxX - minX), h / (maxZ - minZ));
    // account for zoom in inverse mapping
    return { scaleX: s / zoom, scaleZ: s / zoom, minX, minZ, pad };
  };

  // Clamp pan so that the floor area remains within the view
  const clampPanForFloor = (px: number, py: number, zoomVal: number) => {
    const el = containerRef.current;
    if (!el || !floor) return { x: px, y: py };
    const pad = 16;
    const w = el.clientWidth - pad * 2;
    const h = el.clientHeight - pad * 2;
    const minX = floor.position.x - floor.width / 2;
    const maxX = floor.position.x + floor.width / 2;
    const minZ = floor.position.z - floor.depth / 2;
    const maxZ = floor.position.z + floor.depth / 2;
    const baseScale = Math.min(w / (maxX - minX), h / (maxZ - minZ));
    const floorWidthPx = (maxX - minX) * baseScale * zoomVal;
    const floorHeightPx = (maxZ - minZ) * baseScale * zoomVal;
    // pan.x shifts entire content; floor left = pad + pan.x, right = pad + floorWidthPx + pan.x
    const minPanX = Math.min(0, w - floorWidthPx);
    const maxPanX = 0;
    const minPanY = Math.min(0, h - floorHeightPx);
    const maxPanY = 0;
    return {
      x: Math.max(minPanX, Math.min(maxPanX, px)),
      y: Math.max(minPanY, Math.min(maxPanY, py)),
    };
  };

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDraggingId(id);
    setDragOffset({ dx: e.clientX - rect.left, dz: e.clientY - rect.top });
    setSelectedId(id);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    // Panning the view
    if (isPanning && panStartRef.current) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const dx = cur.x - panStartRef.current.x;
      const dy = cur.y - panStartRef.current.y;
      setPan(prev => {
        const next = { x: prev.x + dx, y: prev.y + dy };
        const clamped = clampPanForFloor(next.x, next.y, zoom);
        return clamped;
      });
      panStartRef.current = cur;
      return;
    }

    // Dragging position
    if (draggingId) {
      const el = containerRef.current;
      if (!el) return;
      const pad = 16;
      const w = el.clientWidth - pad * 2;
      const h = el.clientHeight - pad * 2;
      const rect = el.getBoundingClientRect();
      const xPix = (e.clientX - rect.left - pad - pan.x) / zoom;
      const zPix = (e.clientY - rect.top - pad - pan.y) / zoom;

      const minX = floor ? floor.position.x - floor.width / 2 : -500;
      const maxX = floor ? floor.position.x + floor.width / 2 : 500;
      const minZ = floor ? floor.position.z - floor.depth / 2 : -500;
      const maxZ = floor ? floor.position.z + floor.depth / 2 : 500;
      const sWorldPerPx = Math.max((maxX - minX) / w, (maxZ - minZ) / h); // inverse of isotropic screen scale

      let worldX = minX + xPix * sWorldPerPx;
      let worldZ = minZ + zPix * sWorldPerPx;

      // constrain inside floor bounds
      worldX = Math.max(minX, Math.min(maxX, worldX));
      worldZ = Math.max(minZ, Math.min(maxZ, worldZ));

      // Magnetic snapping to endpoints (world-cm based, zoom-independent)
      const draggingWall = walls.find(w => w.id === draggingId);
      if (draggingWall) {
        const theta = draggingWall.rotation?.y ?? 0;
        const tx = Math.cos(theta), tz = Math.sin(theta);
        const half = (Number(draggingWall.width) || 0) / 2;
        const aX = worldX - tx * half, aZ = worldZ - tz * half; // left endpoint
        const bX = worldX + tx * half, bZ = worldZ + tz * half; // right endpoint
        let best: { id: string; ex: number; ez: number; targetWhich: 'a'|'b'; srcWhich: 'a'|'b'; dist: number } | null = null;
        const SNAP_CM = 20; // stronger magnet: capture zone in cm
        const HYST = 2.2;   // stronger stickiness when already snapped
        for (const ow of walls) {
          if (ow.id === 'floor' || ow.id === draggingWall.id) continue;
          const ot = ow.rotation?.y ?? 0;
          const otx = Math.cos(ot), otz = Math.sin(ot);
          const oh = (Number(ow.width) || 0) / 2;
          const oaX = ow.position.x - otx * oh, oaZ = ow.position.z - otz * oh;
          const obX = ow.position.x + otx * oh, obZ = ow.position.z + otz * oh;
          const check = [
            { which: 'a' as const, ex: oaX, ez: oaZ },
            { which: 'b' as const, ex: obX, ez: obZ },
          ];
          for (const c of check) {
            const dA = Math.hypot(aX - c.ex, aZ - c.ez);
            const dB = Math.hypot(bX - c.ex, bZ - c.ez);
            const dist = Math.min(dA, dB);
            if (dist <= SNAP_CM * 1.5 && (!best || dist < best.dist)) {
              best = { id: ow.id, ex: c.ex, ez: c.ez, targetWhich: c.which, srcWhich: (dA < dB ? 'a' : 'b'), dist };
            }
          }
        }
        // Hysteresis: if previously snapped, allow larger threshold to keep it until pulled away
        if (!best && (draggingWall as any)._snapped && (draggingWall as any)._snapPoint) {
          const { ex, ez, which } = (draggingWall as any)._snapPoint;
          const dA = Math.hypot(aX - ex, aZ - ez);
          const dB = Math.hypot(bX - ex, bZ - ez);
          const dist = Math.min(dA, dB);
          if (dist <= SNAP_CM * HYST) {
            // keep the previously stored source endpoint when keeping
            const srcWhichKeep = (draggingWall as any)._snapWhich ?? (dA < dB ? 'a' : 'b');
            best = { id: 'keep', ex, ez, targetWhich: which as 'a'|'b', srcWhich: srcWhichKeep, dist };
          }
        }
        if (best) {
          // Shift center so selected endpoint coincides with target ex/ez
          const isSrcA = best.srcWhich === 'a';
          const ex = isSrcA ? aX : bX;
          const ez = isSrcA ? aZ : bZ;
          const dx = best.ex - ex;
          const dz = best.ez - ez;
          worldX += dx;
          worldZ += dz;
          (draggingWall as any)._snapped = true;
          (draggingWall as any)._snapPoint = { ex: best.ex, ez: best.ez };
          (draggingWall as any)._snapWhich = best.srcWhich;
          if (best.id !== 'keep') (draggingWall as any)._lastTargetId = best.id;
          setSnapCandidate({ targetWallId: best.id === 'keep' ? (draggingWall as any)._lastTargetId ?? '' : best.id, targetEndpoint: best.targetWhich, sourceEndpoint: best.srcWhich, ex: best.ex, ez: best.ez });
        } else {
          (draggingWall as any)._snapped = false;
          (draggingWall as any)._snapPoint = null;
          (draggingWall as any)._snapWhich = null;
          setSnapCandidate(null);
        }
      }

      onUpdateWallPosition(draggingId, worldX, worldZ);
      return;
    }

    // Rotating angle
    if (rotatingId) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // find wall center in view coords
      const wObj = walls.find(w => w.id === rotatingId);
      if (!wObj) return;
      const p = worldToView(wObj.position.x, wObj.position.z);
      const mx = e.clientX - rect.left; // view px
      const my = e.clientY - rect.top;  // view px
      const angle = Math.atan2(my - p.top, mx - p.left); // radians
      // Dampen sensitivity and smooth via lerp - invert angle direction for correct handedness
      const desired = rotateStartWallAngle + (angle - rotateStartAngle) * 0.3;
      const current = wObj.rotation?.y ?? 0;
      const next = current + (desired - current) * 0.25; // smoothing factor
      let delta = next - current;
      // Clamp per-step change for extra smoothness
      const MAX_STEP = 0.06; // radians per event
      if (delta > MAX_STEP) delta = MAX_STEP;
      if (delta < -MAX_STEP) delta = -MAX_STEP;
      if (Math.abs(delta) > 1e-4) {
        // Prefer absolute API to avoid 2D/3D sign mismatches
        if (onSetWallRotationAbs) {
          const appliedNext = current + delta; // 2D absolute angle we want
          onSetWallRotationAbs(rotatingId, appliedNext); // Send directly now that mouse math is fixed
        } else {
          onRotateWall(rotatingId, delta);
        }
        // If one endpoint is snapped to a target, preserve that endpoint world position during rotation by shifting the center
        const sp: any = (wObj as any)._snapPoint;
        const which: 'a'|'b' | null = (wObj as any)._snapWhich ?? null;
        if (sp && which) {
          const half = (Number(wObj.width) || 0) / 2;
          // Use the applied angle that was applied above
          const appliedNext = current + delta;
          const tx = Math.cos(appliedNext);
          const tz = Math.sin(appliedNext);
          // endpoint formulas in world space for angle `next`
          const centerFromA = { x: sp.ex + tx * half, z: sp.ez + tz * half };
          const centerFromB = { x: sp.ex - tx * half, z: sp.ez - tz * half };
          const newCenter = which === 'a' ? centerFromA : centerFromB;
          onUpdateWallPosition(rotatingId, newCenter.x, newCenter.z);
        }
      }
      return;
    }
  
    // otherwise: nothing
  };

  const onMouseUp = () => {
    if (draggingId && snapCandidate) {
      // Notify persistent connection if requested
      onConnectWalls?.(draggingId, snapCandidate.sourceEndpoint, snapCandidate.targetWallId, snapCandidate.targetEndpoint);
    }
    setDraggingId(null);
    setRotatingId(null);
    setIsPanning(false);
    panStartRef.current = null;
    setSnapCandidate(null);
  };

  const handleAdd = () => {
    onAddWall({
      width: Math.max(1, newWall.width),
      height: Math.max(1, newWall.height),
      depth: Math.max(1, newWall.depth),
      position: { x: newWall.posX, y: newWall.height / 2, z: newWall.posZ },
      rotation: { x: 0, y: newWall.rotationY, z: 0 },
      texture: 'default',
      isLocked: true,
      name: newWall.name,
    } as any);
  };
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[8000] pointer-events-auto">
      <div className="absolute inset-6 bg-white rounded-md border shadow-xl p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">مخطط الجدران (منظور علوي)</div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onResetToDefaultWalls?.()}
              disabled={!onResetToDefaultWalls}
              title="استرجاع الجدران الافتراضية (4)"
            >
              استرجاع 4 جدران
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </div>
        <div className="flex gap-4 items-stretch">
          {/* Sidebar: Insert or Selected Wall Info */}
          <div className="w-80 shrink-0 border rounded-md p-3 bg-white/90">
            {selectedId ? (
              (() => {
                const w = walls.find(x => x.id === selectedId);
                if (!w) return <div className="text-sm text-gray-600">لا يوجد جدار محدد</div>;
                return (
                  <div className="space-y-3">
                    <div className="font-semibold">معلومات الجدار المحدد</div>
                    <div className="text-xs text-gray-500">المعرف: {w.id}</div>
                    <div className="space-y-2">
                      <Label className="text-xs">الاسم</Label>
                      <Input value={(w as any).name || ''} onChange={(e) => onUpdateWallSize(w.id, { name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">العرض (سم)</Label>
                        <Input type="number" value={w.width} onChange={(e) => onUpdateWallSize(w.id, { width: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">الارتفاع (سم)</Label>
                        <Input type="number" value={w.height} onChange={(e) => onUpdateWallSize(w.id, { height: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">السمك (سم)</Label>
                        <Input type="number" value={w.depth} onChange={(e) => onUpdateWallSize(w.id, { depth: Number(e.target.value) || 0 })} />
                      </div>
                    </div>
                    {/* Rotation controls */}
                    {(() => {
                      const currentRad = w.rotation?.y ?? 0;
                      const normDeg = ((currentRad * 180) / Math.PI + 360) % 360;
                      const applyDeg = (deg: number) => {
                        const clamped = ((deg % 360) + 360) % 360;
                        const desiredRad = (-clamped * Math.PI) / 180; // Invert degrees to radians
                        const delta = desiredRad - (w.rotation?.y ?? 0);
                        if (Math.abs(delta) > 1e-4) {
                          if (onSetWallRotationAbs) {
                            onSetWallRotationAbs(w.id, desiredRad); // Send inverted angle
                          } else {
                            onRotateWall(w.id, delta);
                          }
                        }
                      };
                      return (
                        <div className="space-y-2">
                          <div className="text-xs font-medium">تدوير الجدار</div>
                          <div className="flex items-center gap-3">
                            <div className="w-full">
                              <input
                                type="range"
                                min={0}
                                max={360}
                                step={1}
                                value={Math.round(normDeg)}
                                onChange={(e) => applyDeg(Number(e.target.value) || 0)}
                                className="w-full"
                              />
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Input
                                type="number"
                                value={Math.round(normDeg)}
                                onChange={(e) => applyDeg(Number(e.target.value) || 0)}
                                className="w-16"
                              />
                              <span>°</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Dimension side override */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium">موضع الأبعاد</div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name="dimSide"
                            checked={dimSideOverride[w.id] == null}
                            onChange={() => setDimSideOverride(prev => ({ ...prev, [w.id]: null }))}
                          />
                          تلقائي
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name="dimSide"
                            checked={dimSideOverride[w.id] === 1}
                            onChange={() => setDimSideOverride(prev => ({ ...prev, [w.id]: 1 }))}
                          />
                          أمام
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name="dimSide"
                            checked={dimSideOverride[w.id] === -1}
                            onChange={() => setDimSideOverride(prev => ({ ...prev, [w.id]: -1 }))}
                          />
                          خلف
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onToggleWallSide(w.id)}>تبديل الاتجاه</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>إلغاء التحديد</Button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-3">
                <div className="font-semibold">إدراج جدار جديد</div>
                <div className="space-y-2">
                  <Label className="text-xs">الاسم</Label>
                  <Input value={newWall.name} onChange={(e) => setNewWall(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">العرض (سم)</Label>
                    <Input type="number" value={newWall.width} onChange={(e) => setNewWall(prev => ({ ...prev, width: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">الارتفاع (سم)</Label>
                    <Input type="number" value={newWall.height} onChange={(e) => setNewWall(prev => ({ ...prev, height: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">السمك (سم)</Label>
                    <Input type="number" value={newWall.depth} onChange={(e) => setNewWall(prev => ({ ...prev, depth: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">X (سم)</Label>
                    <Input type="number" value={newWall.posX} onChange={(e) => setNewWall(prev => ({ ...prev, posX: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Z (سم)</Label>
                    <Input type="number" value={newWall.posZ} onChange={(e) => setNewWall(prev => ({ ...prev, posZ: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">الدوران (راديان)</Label>
                    <Input type="number" value={newWall.rotationY} onChange={(e) => setNewWall(prev => ({ ...prev, rotationY: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleAdd}>إضافة الجدار</Button>
              </div>
            )}
          </div>
          {/* Canvas Area */}
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onMouseDown={(e) => {
              // start panning if right/middle button, or Space is held, or left-click on empty canvas (container itself)
              const isRight = e.button === 2;
              const isMiddle = e.button === 1;
              const el = containerRef.current;
              const isLeftEmpty = e.button === 0 && el && e.target === el;
              if (isRight || isMiddle || spaceHeld || isLeftEmpty) {
                e.preventDefault();
                if (!el) return;
                const rect = el.getBoundingClientRect();
                panStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setIsPanning(true);
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative h-[64vh] w-full bg-white border rounded-md overflow-hidden ${isPanning || spaceHeld ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={(e) => {
              e.preventDefault();
              const delta = Math.sign(e.deltaY);
              const newZoom = Math.max(0.5, Math.min(4.0, zoom + (delta > 0 ? -0.1 : 0.1)));
              setZoom(newZoom);
              // Clamp pan for the new zoom so floor stays within view
              setPan(prev => clampPanForFloor(prev.x, prev.y, newZoom));
            }}
          >
          {/* Zoom controls */}
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</Button>
            <Button size="sm" variant="secondary" onClick={() => setZoom(z => Math.min(4.0, z + 0.1))}>+</Button>
            <div className="px-2 py-1 text-xs bg-white border rounded">{Math.round(zoom*100)}%</div>
          </div>
          {/* Note: removed top center selection toggles per request */}
          {/* View toggles: show/hide dimensions and directions */}
          <div className="absolute top-10 left-2 z-10 flex items-center gap-3 bg-white/85 border rounded px-3 py-1 text-[12px]">
            <label className="flex items-center gap-1 select-none">
              <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} />
              الأبعاد
            </label>
            <label className="flex items-center gap-1 select-none">
              <input type="checkbox" checked={showDir} onChange={(e) => setShowDir(e.target.checked)} />
              الاتجاه
            </label>
          </div>
          {/* Loading overlay */}
          {booting && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin" />
                <div className="text-sm text-gray-700">جارٍ تحميل المخطط 2D...</div>
              </div>
            </div>
          )}
          {/* Floor outline */}
          {floor && (
            <div className="absolute border border-gray-400/70 bg-gray-50" style={{ left: 8, top: 8, right: 8, bottom: 8 }} />
          )}
          {/* Existing walls */}
          {nonFloor.map((w) => {
            const p = worldToView(w.position.x, w.position.z);
            const theta = w.rotation?.y ?? 0;
            // Derive pixel length directly from the two endpoints in view space for perfect alignment
            const half = (Number(w.width) || 0) / 2;
            const tx = Math.cos(theta), tz = Math.sin(theta);
            const aW = { x: w.position.x - tx * half, z: w.position.z - tz * half };
            const bW = { x: w.position.x + tx * half, z: w.position.z + tz * half };
            const aV = worldToView(aW.x, aW.z);
            const bV = worldToView(bW.x, bW.z);
            const wallPixLen = Math.max(4, Math.hypot(bV.left - aV.left, bV.top - aV.top));
            const extOffset = 22; // move dimension graphics away from wall for visibility
            const thetaDeg = (theta * 180) / Math.PI;
            return (
              <div key={w.id}>
                <div
                  className={`absolute text-white text-[10px] px-1 py-0.5 rounded-sm cursor-move select-none ${hoveredId===w.id || selectedId===w.id ? 'bg-primary border-2 border-primary shadow-lg' : 'bg-primary/70 border border-primary/60'}`}
                  style={{ left: p.left, top: p.top, transform: `translate(-50%, -50%) rotate(${thetaDeg}deg)`, width: wallPixLen, height: 6 }}
                  onMouseEnter={() => setHoveredId(w.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onMouseDown={(e) => { if (e.button === 0) { onMouseDown(e, w.id); } }}
                  onClick={() => setSelectedId(w.id)}
                  title={`${Number(w.width) || 0}×${Number(w.height) || 0}×${Number(w.depth) || 0} سم`}
                />
                {/* Engineering dimensions (width) with smart/override side */}
                {showDims && (() => {
                  const lineThick = 2;
                  const extLen = 18;
                  const arrow = 7;
                  const dimSign = getDimSideSign(w); // +1 or -1
                  return (
                    <div className="absolute select-none" style={{ left: p.left, top: p.top, transform: `translate(-50%, -50%) rotate(${thetaDeg}deg)` }}>
                      <div className="absolute" style={{ left: 0, top: dimSign * (extOffset + extLen), transform: 'translate(-50%, -50%)' }}>
                        {/* extension lines */}
                        <div className="absolute bg-gray-600" style={{ left: -wallPixLen / 2, top: -extLen/2, width: lineThick, height: extLen, transform: `translateX(${-lineThick/2}px)` }} />
                        <div className="absolute bg-gray-600" style={{ left: wallPixLen / 2, top: -extLen/2, width: lineThick, height: extLen, transform: `translateX(${-lineThick/2}px)` }} />
                        {/* dimension line */}
                        <div className="absolute bg-gray-700" style={{ left: -wallPixLen / 2, top: 0, width: wallPixLen, height: lineThick }} />
                        {/* arrow heads */}
                        <div className="absolute" style={{ left: -wallPixLen / 2, top: -arrow/2, borderTop: `${arrow/2}px solid transparent`, borderBottom: `${arrow/2}px solid transparent`, borderRight: `${arrow}px solid #374151` }} />
                        <div className="absolute" style={{ left: wallPixLen / 2 - arrow, top: -arrow/2, borderTop: `${arrow/2}px solid transparent`, borderBottom: `${arrow/2}px solid transparent`, borderLeft: `${arrow}px solid #374151` }} />
                        {/* label */}
                        <div className="absolute text-[12px] font-medium text-gray-800 bg-white/95 px-1.5 py-0.5 rounded shadow-sm"
                             style={{ left: 0, top: lineThick + 12, transform: 'translate(-50%, -50%)' }}>
                          {Math.round(Number(w.width) || 0)} سم
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* Endpoint markers */}
                {(() => {
                  const half = (Number(w.width) || 0) / 2;
                  const tx = Math.cos(theta), tz = Math.sin(theta);
                  const aW = { x: w.position.x - tx * half, z: w.position.z - tz * half };
                  const bW = { x: w.position.x + tx * half, z: w.position.z + tz * half };
                  const aV = worldToView(aW.x, aW.z);
                  const bV = worldToView(bW.x, bW.z);
                  const isSnapTarget = (pos: {left:number;top:number}) => snapCandidate && Math.abs(worldToView(snapCandidate.ex, snapCandidate.ez).left - pos.left) < 2 && Math.abs(worldToView(snapCandidate.ex, snapCandidate.ez).top - pos.top) < 2;
                  return (
                    <>
                      <div className={`absolute rounded-full ${isSnapTarget(aV) ? 'bg-green-500' : 'bg-primary'} border-2 border-white`} style={{ left: aV.left, top: aV.top, width: 8, height: 8, transform: 'translate(-50%, -50%)' }} />
                      <div className={`absolute rounded-full ${isSnapTarget(bV) ? 'bg-green-500' : 'bg-primary'} border-2 border-white`} style={{ left: bV.left, top: bV.top, width: 8, height: 8, transform: 'translate(-50%, -50%)' }} />
                    </>
                  );
                })()}
                {/* Tiny arrow that shows shelf side, clickable to toggle side */}
                {showDir && (() => {
                  let dirSign = wallSides[w.id] === 'back' ? 1 : -1; // reflected mapping by default
                  const offset = 20; // px along wall normal in screen space
                  const nx = Math.sin(theta);      // screen-space normal x
                  const ny = -Math.cos(theta);     // screen-space normal y (down positive)
                  // If the wall is vertical (|cos| < |sin|), flip the sign so verticals are reflected while horizontals stay as-is
                  const isVertical = Math.abs(Math.cos(theta)) < Math.abs(Math.sin(theta));
                  if (isVertical) dirSign *= -1;
                  const ax = p.left + dirSign * offset * nx;
                  const ay = p.top  + dirSign * offset * ny;
                  // Rotate arrow to follow wall rotation (same direction) and point outward along normal
                  // thetaDeg is wall orientation; add +/-90 so arrow points along normal side
                  const arrowDeg = thetaDeg + (dirSign > 0 ? 90 : -90);
                  return (
                    <button
                      className="absolute text-primary text-[11px] leading-none select-none hover:text-primary hover:scale-110 transition-transform"
                      style={{ left: ax, top: ay, transform: `translate(-50%, -50%) rotate(${arrowDeg}deg)` }}
                      title={dirSign < 0 ? 'جهة الرف: خلف (انقر للتبديل)' : 'جهة الرف: أمام (انقر للتبديل)'}
                      onClick={() => onToggleWallSide(w.id)}
                    >
                      ▲
                    </button>
                  );
                })()}
                {/* Rotation handle */}
                {selectedId === w.id && (
                  <button
                    className="absolute w-5 h-5 rounded-full bg-white border shadow hover:bg-gray-50"
                    style={{ left: p.left - wallPixLen / 2 - 12, top: p.top, transform: 'translate(-50%, -50%)' }}
                    title="تدوير (اسحب مع الاستمرار)"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const el = containerRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const mx = e.clientX - rect.left;
                      const my = e.clientY - rect.top;
                      const center = worldToView(w.position.x, w.position.z);
                      const a = Math.atan2(my - center.top, mx - center.left);
                      setRotatingId(w.id);
                      setRotateStartAngle(a);
                      setRotateStartWallAngle(w.rotation?.y ?? 0);
                    }}
                  />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Walls2DPlannerModal;
