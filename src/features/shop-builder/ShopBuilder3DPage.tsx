import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShopBuilderProvider, useShopBuilder } from './store';
import type { ShopBuilderWall, ShopBuilderSlatWall, ShopBuilderSlatAccessory, ShopBuilderColumn } from './types';
import { useDualAuth } from '@/hooks/useDualAuth';
import FloorplanCanvas from './floorplan/FloorplanCanvas';
import ThreeScene, { type ThreeSceneHandle, type TransformMode, WALL_TEXTURES } from './three/ThreeScene';
import BuilderToolbar from './ui/BuilderToolbar';
import { SceneItemsList } from './ui/SceneItemsList';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trash2, X, Focus, Palette, Edit2, RotateCcw, ArrowDown, Store, MapPin, Phone, Clock, Plus, ChevronUp, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useShopSetup } from '@/hooks/useShopSetup';
import { useTheme } from '@/context/ThemeContext';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const DEFAULT_TRANSFORM_MODE: TransformMode = 'translate';

function InteractiveAccessoryNode({
   accessory,
   slatWidth,
   slatHeight,
   slatSpacing,
   isActive,
   onActivate,
   updateAccessory,
   activeSide
}: {
   accessory: ShopBuilderSlatAccessory;
   slatWidth: number;
   slatHeight: number;
   slatSpacing: number;
   isActive: boolean;
   onActivate: () => void;
   updateAccessory: (updates: Partial<ShopBuilderSlatAccessory>) => void;
   activeSide: 'front' | 'back';
}) {
   const widthPct = (accessory.width / slatWidth) * 100;
   const visualX = activeSide === 'back' ? 1 - accessory.position.x : accessory.position.x;
   const leftPct = visualX * 100;
   const bottomPct = accessory.position.y * 100;

   const handlePointerDown = (e: React.PointerEvent) => {
      onActivate();
      e.stopPropagation();
      e.preventDefault();

      const el = e.currentTarget as HTMLDivElement;
      el.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startVisualX = activeSide === 'back' ? 1 - accessory.position.x : accessory.position.x;
      const startPosY = accessory.position.y;
      
      const parent = el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      const handleMove = (moveEvent: PointerEvent) => {
         const dx = moveEvent.clientX - startX;
         const dy = startY - moveEvent.clientY;
         
         let newVisualX = startVisualX + (dx / rect.width);
         let newY = startPosY + (dy / rect.height);
         
         const intervalY = slatSpacing / slatHeight;
         newY = Math.round(newY / intervalY) * intervalY;

         newVisualX = Math.max(0, Math.min(1, newVisualX));
         newY = Math.max(0, Math.min(1, newY));

         const newX = activeSide === 'back' ? 1 - newVisualX : newVisualX;
         updateAccessory({ position: { x: newX, y: newY } });
      };

      const handleUp = (upEvent: PointerEvent) => {
         el.releasePointerCapture(upEvent.pointerId);
         el.removeEventListener('pointermove', handleMove);
         el.removeEventListener('pointerup', handleUp);
      };

      el.addEventListener('pointermove', handleMove);
      el.addEventListener('pointerup', handleUp);
   };

   let colorCls, bgCls;
   if (accessory.type === 'shelf') {
       colorCls = 'border-amber-600';
       bgCls = 'bg-amber-500';
   } else if (accessory.type === 'hook_single') {
       colorCls = 'border-blue-500';
       bgCls = 'bg-blue-400';
   } else if (accessory.type === 'hook_waterfall') {
       colorCls = 'border-zinc-500';
       bgCls = 'bg-zinc-400';
   }

   return (
      <div
         onPointerDown={handlePointerDown}
         title={accessory.type === 'shelf' ? "رف" : accessory.type === 'hook_single' ? "خطاف مفرد" : "خطاف ملابس"}
         className={`absolute flex border-2 shadow-sm transition-colors cursor-move ${isActive ? `border-primary bg-primary/20 z-20` : `${colorCls} ${bgCls} border-opacity-70 z-10`} ${accessory.type === 'shelf' ? 'rounded-sm' : 'rounded-full'}`}
         style={{
            left: `${leftPct}%`,
            bottom: `${bottomPct}%`,
            width: accessory.type === 'shelf' ? `${widthPct}%` : '12px',
            height: '12px',
            transform: 'translateX(-50%) translateY(50%)'
         }}
      >
         {accessory.type === 'hook_single' && <div className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full bg-white opacity-60" />}
         {accessory.type === 'hook_waterfall' && (
            <div className="absolute inset-0 flex flex-col justify-around items-center py-0.5">
               <div className="w-1 h-1 rounded-full bg-white opacity-70"/>
               <div className="w-1 h-1 rounded-full bg-white opacity-70"/>
            </div>
         )}
      </div>
   );
}

function InteractiveSlatNode({
  slat,
  wallLength,
  wallHeight,
  isActive,
  onActivate,
  updateSlat,
  containerRef,
  activeAccessoryId,
  setActiveAccessoryId,
  updateAccessory,
  activeSide
}: {
  slat: ShopBuilderSlatWall;
  wallLength: number;
  wallHeight: number;
  isActive: boolean;
  onActivate: () => void;
  updateSlat: (updates: Partial<ShopBuilderSlatWall>) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  activeAccessoryId: string | null;
  setActiveAccessoryId: (id: string | null) => void;
  updateAccessory: (accId: string, updates: Partial<ShopBuilderSlatAccessory>) => void;
  activeSide: 'front' | 'back';
}) {
  const width = slat.fillType === 'full' ? wallLength : (slat.width || 1);
  const widthPct = (width / wallLength) * 100;
  const heightPct = (slat.height / wallHeight) * 100;
  const bottomPct = (slat.bottomOffset / wallHeight) * 100;
  const visualPos = activeSide === 'back' ? 1 - slat.position! : slat.position!;
  const leftPct = slat.fillType === 'full' ? 0 : (visualPos - (width/wallLength/2)) * 100;

  const handlePointerDown = (e: React.PointerEvent) => {
    onActivate();
    if (slat.fillType === 'full') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startVisualPos = activeSide === 'back' ? 1 - (slat.position || 0.5) : (slat.position || 0.5);
    const startBottom = slat.bottomOffset;
    
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = startY - moveEvent.clientY; 
      
      const dxMeters = (dx / rect.width) * wallLength;
      const dyMeters = (dy / rect.height) * wallHeight;
      
      let newVisualPos = startVisualPos + (dxMeters / wallLength);
      let newBottom = startBottom + dyMeters;
      
      const widthInMeters = slat.width || 1;
      
      newVisualPos = Math.max((widthInMeters / wallLength / 2), Math.min(1 - (widthInMeters / wallLength / 2), newVisualPos));
      newBottom = Math.max(0, Math.min(wallHeight - slat.height, newBottom));
      
      const newPos = activeSide === 'back' ? 1 - newVisualPos : newVisualPos;
      updateSlat({ position: newPos, bottomOffset: newBottom });
    };
    
    const handleUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
    };
    
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
  };

  const handleResizeStart = (e: React.PointerEvent, dirX: number, dirY: number) => {
    // If full, cannot resize horizontally. But they CAN resize vertically.
    if (slat.fillType === 'full' && dirX !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    onActivate();
    
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    const startWidth = slat.width || 1;
    const startHeight = slat.height;
    const startVisualPos = activeSide === 'back' ? 1 - (slat.position || 0.5) : (slat.position || 0.5);
    const startBottom = slat.bottomOffset;
    
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    const startLeft = (startVisualPos * wallLength) - (startWidth / 2);
    const startRight = (startVisualPos * wallLength) + (startWidth / 2);
    const startBottomEdge = startBottom;
    const startTopEdge = startBottom + startHeight;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = startY - moveEvent.clientY; 
      
      const dxMeters = (dx / rect.width) * wallLength;
      const dyMeters = (dy / rect.height) * wallHeight;

      let newLeft = startLeft;
      let newRight = startRight;
      let newBottom = startBottomEdge;
      let newTop = startTopEdge;

      if (dirX === 1) newRight += dxMeters; 
      if (dirX === -1) newLeft += dxMeters; 
      if (dirY === 1) newTop += dyMeters; 
      if (dirY === -1) newBottom += dyMeters; 

      if (newLeft < 0) newLeft = 0;
      if (newRight > wallLength) newRight = wallLength;
      if (newBottom < 0) newBottom = 0;
      if (newTop > wallHeight) newTop = wallHeight;

      if (newRight - newLeft < 0.1) {
         if (dirX === 1) newRight = newLeft + 0.1;
         if (dirX === -1) newLeft = newRight - 0.1;
      }
      if (newTop - newBottom < 0.1) {
         if (dirY === 1) newTop = newBottom + 0.1;
         if (dirY === -1) newBottom = newTop - 0.1;
      }

      const endWidth = newRight - newLeft;
      const endHeight = newTop - newBottom;
      const endVisualPos = (newLeft + (endWidth / 2)) / wallLength;
      const endBottomOffset = newBottom;
      const endPos = activeSide === 'back' ? 1 - endVisualPos : endVisualPos;

      updateSlat({
         width: endWidth,
         height: endHeight,
         position: endPos,
         bottomOffset: endBottomOffset
      });
    };
    
    const handleUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
    };
    
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute transition-colors cursor-move shadow-md ${
        isActive ? 'ring-2 ring-primary z-10' : 'ring-1 ring-black/20 hover:ring-2 hover:ring-black/30'
      }`}
      style={{
        left: `${leftPct}%`,
        bottom: `${bottomPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        backgroundColor: slat.systemType === 'supermarket_shelves' ? '#fff' : (slat.color || '#f5f5f5'),
        backgroundImage: slat.systemType === 'supermarket_shelves' 
           ? `repeating-linear-gradient(90deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 4px, transparent 4px, transparent ${Math.max(1, ((slat.uprightSpacing || 1.0) / width) * 100)}%), 
              repeating-linear-gradient(0deg, transparent, transparent calc(${100 / (slat.shelfCount || 5)}% - 4px), ${slat.color || '#e11d48'} calc(${100 / (slat.shelfCount || 5)}% - 4px), ${slat.color || '#e11d48'} ${100 / (slat.shelfCount || 5)}%)`
           : `repeating-linear-gradient(0deg, transparent, transparent calc(100% - 2px), rgba(0,0,0,0.2) calc(100% - 2px), rgba(0,0,0,0.2) 100%)`,
        backgroundSize: slat.systemType === 'supermarket_shelves' 
           ? `100% 100%, 100% 100%` 
           : `100% ${100 / (slat.height / Math.max(0.01, slat.slatSpacing))}%`,
      }}
    >
      {isActive && (
        <div className="absolute top-0 right-0 p-1 bg-primary text-primary-foreground text-[10px] rounded-bl-md font-bold pointer-events-none">
          محدد
        </div>
      )}
      
      {/* Resize Handles */}
      {isActive && slat.fillType === 'partial' && (
        <>
          <div onPointerDown={e => handleResizeStart(e, -1, 1)} className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full cursor-nwse-resize -left-1.5 -top-1.5" />
          <div onPointerDown={e => handleResizeStart(e, 1, 1)} className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full cursor-nesw-resize -right-1.5 -top-1.5" />
          <div onPointerDown={e => handleResizeStart(e, -1, -1)} className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full cursor-nesw-resize -left-1.5 -bottom-1.5" />
          <div onPointerDown={e => handleResizeStart(e, 1, -1)} className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full cursor-nwse-resize -right-1.5 -bottom-1.5" />
          <div onPointerDown={e => handleResizeStart(e, -1, 0)} className="absolute w-3 h-6 bg-white border-2 border-primary rounded-full cursor-ew-resize -left-1.5 top-1/2 -mt-3" />
          <div onPointerDown={e => handleResizeStart(e, 1, 0)} className="absolute w-3 h-6 bg-white border-2 border-primary rounded-full cursor-ew-resize -right-1.5 top-1/2 -mt-3" />
        </>
      )}
      
      {/* Vertical Handles (available for both partial and full if active) */}
      {isActive && (
        <>
          <div onPointerDown={e => handleResizeStart(e, 0, 1)} className="absolute h-3 w-6 bg-white border-2 border-primary rounded-full cursor-ns-resize left-1/2 -ml-3 -top-1.5" />
          <div onPointerDown={e => handleResizeStart(e, 0, -1)} className="absolute h-3 w-6 bg-white border-2 border-primary rounded-full cursor-ns-resize left-1/2 -ml-3 -bottom-1.5" />
        </>
      )}

      {/* Render Accessories */}
      {slat.accessories?.map(acc => (
          <InteractiveAccessoryNode 
             key={acc.id}
             accessory={acc}
             slatWidth={width}
             slatHeight={slat.height}
             slatSpacing={slat.slatSpacing || 0.15}
             isActive={activeAccessoryId === acc.id}
             onActivate={() => setActiveAccessoryId(acc.id)}
             updateAccessory={(updates) => updateAccessory(acc.id, updates)}
             activeSide={activeSide}
          />
      ))}
    </div>
  );
}

function SlatWallManagerContent({ targetId, type, primaryColor, secondaryColor }: { targetId: string, type: 'wall' | 'column', primaryColor: string, secondaryColor: string }) {
  const { layout, addSlatWallToWall, updateSlatWall, removeSlatWall, addAccessoryToSlat, updateAccessory, removeAccessory } = useShopBuilder();
  const [activeSide, setActiveSide] = useState<'front'|'back'>('front');
  const [activeId, setActiveId] = useState<string|null>(null);
  const [activeAccessoryId, setActiveAccessoryId] = useState<string|null>(null);
  const [insertSystemType, setInsertSystemType] = useState<string>('slat');
  const [isAddingNewSystem, setIsAddingNewSystem] = useState<boolean>(false);
  
  let targetObject: ShopBuilderWall | ShopBuilderColumn | undefined;
  let wallLength = 1;
  let wallHeight = 1;
  
  if (type === 'wall') {
     targetObject = layout.walls.find(w => w.id === targetId);
     if (targetObject) {
         wallLength = Math.hypot(targetObject.end.x - targetObject.start.x, targetObject.end.y - targetObject.start.y);
         wallHeight = targetObject.height;
     }
  } else {
     const wallContext = layout.walls.find(w => w.columns?.some(c => c.id === targetId));
     targetObject = wallContext?.columns?.find(c => c.id === targetId);
     if (targetObject) {
         wallLength = targetObject.width;
         wallHeight = targetObject.height;
     }
  }

  if (!targetObject) return null;
  
  const slatWalls = targetObject.slatWalls?.filter(s => s.side === activeSide) || [];
  const selectedSlat = slatWalls.find(s => s.id === activeId);

   const containerRef = useRef<HTMLDivElement>(null);
   
   return (
     <div className="flex flex-col md:flex-row gap-6 mt-4 w-full" style={{ minHeight: 460 }}>
       {/* 2D Canvas */}
       <div className="flex-1 min-w-[280px] min-h-[400px] relative bg-zinc-100 rounded-xl border border-zinc-200 overflow-auto flex items-center justify-center p-6" onPointerDown={(e) => { if (e.target === e.currentTarget) setActiveId(null); }}>
          <div className="w-full h-full flex items-center justify-center overflow-auto min-h-0">
             <div 
                ref={containerRef}
                className="bg-zinc-200 relative shadow-inner overflow-visible border-2 border-zinc-300 pointer-events-auto select-none shrink-0" 
                style={{ 
                   aspectRatio: `${wallLength} / ${wallHeight}`,
                   maxWidth: wallLength > wallHeight ? '100%' : 'none',
                   maxHeight: wallLength > wallHeight ? 'none' : '100%',
                   minWidth: Math.min(120, wallLength * 500),
                   ...(wallLength > wallHeight ? { width: '100%' } : { height: '100%' })
                }}
                onPointerDown={(e) => { if (e.target === e.currentTarget) setActiveId(null); }}
             >
                {/* Draw Columns - only show on the active side */}
             {type === 'wall' && (targetObject as ShopBuilderWall).columns
                ?.filter(col => {
                   const side = (col.side === 'front' || col.side === 'back') ? col.side : 'front';
                   return side === activeSide;
                })
                .map(col => {
                const wLen = wallLength || 1;
                const wHei = wallHeight || 1;
                const widthPct = ((col.width || 0.4) / wLen) * 100;
                const heightPct = ((col.height || 3) / wHei) * 100;
                
                // If viewing from back, left and right are reversed
                const visualPos = activeSide === 'back' ? 1 - (col.position || 0.5) : (col.position || 0.5);
                const leftPct = visualPos * 100 - (widthPct / 2);
                
                return (
                   <div 
                      key={col.id}
                      className="absolute bottom-0 bg-stone-300/80 border border-stone-400 z-20 flex flex-col items-center justify-center text-[10px] text-stone-600 font-bold pointer-events-none transition-all"
                      style={{
                         left: `${Math.max(0, leftPct)}%`,
                         width: `${Math.min(100 - Math.max(0, leftPct), widthPct)}%`,
                         height: `${Math.min(100, heightPct)}%`
                      }}
                   >
                      <div className="bg-white/90 px-1.5 py-0.5 rounded text-[9px] shadow-sm border border-stone-200">عمود</div>
                   </div>
                );
             })}
             {/* Draw Slats */}
             {slatWalls.map(slat => (
                <InteractiveSlatNode
                   key={slat.id}
                   slat={slat}
                   wallLength={wallLength}
                   wallHeight={wallHeight}
                   isActive={activeId === slat.id}
                   onActivate={() => { setActiveId(slat.id); setActiveAccessoryId(null); }}
                   updateSlat={(updates) => updateSlatWall(targetId, slat.id, updates)}
                   containerRef={containerRef}
                   activeAccessoryId={activeAccessoryId}
                   setActiveAccessoryId={setActiveAccessoryId}
                   updateAccessory={(accId, updates) => updateAccessory(targetId, slat.id, accId, updates)}
                   activeSide={activeSide}
                />
             ))}
          </div>
          </div>
       </div>
       
       {/* Controller Sidebar */}
       <div className="w-full md:w-[340px] md:max-w-[340px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-4" style={{ maxHeight: 500 }}>
          
          {/* Active Side Toggle (Global) */}
          <div className="flex bg-zinc-100 rounded-lg p-1">
             <button onClick={() => {setActiveSide('front'); setActiveId(null)}} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSide === 'front' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}>الوجه الأمامي</button>
             <button onClick={() => {setActiveSide('back'); setActiveId(null)}} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSide === 'back' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}>الوجه الخلفي</button>
          </div>

           {!isAddingNewSystem ? (
             <button
                onClick={() => {
                   setIsAddingNewSystem(true);
                   setActiveId(null);
                }}
                className="w-full py-4 mt-2 bg-white hover:bg-zinc-50 border-2 border-dashed border-zinc-200 hover:border-blue-400 text-zinc-600 hover:text-blue-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
             >
                <Plus className="w-5 h-5"/>
                إضافة نظام عرض جديد
             </button>
           ) : (
             <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border-2 border-blue-100 shadow-md relative overflow-hidden">
                <button 
                  onClick={() => setIsAddingNewSystem(false)}
                  className="absolute top-3 left-3 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-zinc-800 text-sm mb-1 pb-2 border-b border-zinc-100">إضافة نظام جديد</h3>
                
                {/* System Type Selector */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <label className="text-xs font-bold text-zinc-600">1. نوع النظام</label>
                    <select 
                       value={insertSystemType} 
                       onChange={e => setInsertSystemType(e.target.value)} 
                       className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:border-blue-500 font-semibold text-zinc-700"
                    >
                       <option value="slat">جدار شرائحي (Slat Wall)</option>
                       <option value="supermarket_shelves">أرفف سوبر ماركت (Supermarket Shelves)</option>
                    </select>
                </div>

               {/* Side Toggle removed from here (moved to top of sidebar) */}
      
               {/* Add Actions */}
               <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-zinc-100">
                  <button
                     onClick={() => {
                       if (slatWalls.some(s => s.fillType === 'full' && s.side === activeSide)) return alert('لا يمكن الإضافة، يوجد نظام يشغل كامل الجدار على هذا الوجه.');
                       const id = addSlatWallToWall(targetId, activeSide);
                       updateSlatWall(targetId, id, { systemType: insertSystemType as 'slat' | 'supermarket_shelves' });
                       setActiveId(id);
                       setIsAddingNewSystem(false);
                     }}
                     className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors border border-blue-200 flex flex-col items-center justify-center gap-1"
                     style={{ color: primaryColor }}
                  >
                     <Plus className="w-4 h-4"/>
                     كامل الجدار
                  </button>
                  <button
                     onClick={() => {
                       if (slatWalls.some(s => s.fillType === 'full' && s.side === activeSide)) return alert('لا يمكن الإضافة، يوجد نظام يشغل كامل الجدار على هذا الوجه.');
                       const id = addSlatWallToWall(targetId, activeSide);
                       updateSlatWall(targetId, id, { systemType: insertSystemType as 'slat' | 'supermarket_shelves', fillType: 'partial', position: 0.5, width: Math.min(1, wallLength), height: Math.min(2, wallHeight) });
                      setActiveId(id);
                      setIsAddingNewSystem(false);
                    }}
                    className="flex-1 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-bold transition-colors border border-zinc-200 flex flex-col items-center justify-center gap-1"
                 >
                    <Plus className="w-4 h-4 text-zinc-500"/>
                    جزء فقط
                 </button>
              </div>
            </div>
           )}

         {/* Selected Editor */}
         {selectedSlat ? (
            activeAccessoryId && selectedSlat.accessories?.find(a => a.id === activeAccessoryId) ? (
                 (() => {
                    const acc = selectedSlat.accessories?.find(a => a.id === activeAccessoryId)!;
                    return (
                        <div className="flex flex-col gap-4 p-4 border border-zinc-200 rounded-xl bg-white shadow-sm">
                           <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                             <h3 className="font-bold text-sm" style={{ color: primaryColor }}>إعدادات الرف</h3>
                             <button onClick={() => { removeAccessory(targetId, selectedSlat.id, acc.id); setActiveAccessoryId(null); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                           </div>
                           
                           {/* Color */}
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-zinc-600">اللون الأساسي</label>
                              <input type="color" value={acc.color || '#d97706'} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {color: e.target.value})} className="w-full h-8 rounded-md cursor-pointer border border-zinc-200"/>
                           </div>

                             {/* Dimensions */}
                             <div className="flex gap-2">
                               <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-semibold text-zinc-500">العرض (م)</label>
                                  <input type="number" step="0.1" value={acc.width} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {width: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                               </div>
                               <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-semibold text-zinc-500">العمق (م)</label>
                                  <input type="number" step="0.1" value={acc.depth} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {depth: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                               </div>
                             </div>

                           <button onClick={() => setActiveAccessoryId(null)} className="mt-4 p-2 w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs rounded-lg font-semibold transition-colors">
                             العودة إلى إعدادات النظام
                           </button>
                        </div>
                    )
                 })()
            ) : (
            <div className="flex flex-col gap-4 p-4 border border-zinc-200 rounded-xl bg-white shadow-sm">
               <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                 <h3 className="font-bold text-sm" style={{ color: primaryColor }}>إعدادات النظام</h3>
                 <button onClick={() => { removeSlatWall(targetId, selectedSlat.id); setActiveId(null); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
               </div>
               
               {/* System Type */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600">نوع النظام</label>
                  <select 
                     value={selectedSlat.systemType || 'slat'} 
                     onChange={e => updateSlatWall(targetId, selectedSlat.id, {systemType: e.target.value as any})} 
                     className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"
                  >
                     <option value="slat">جدار شرائحي (Slat Wall)</option>
                     <option value="supermarket_shelves">أرفف سوبر ماركت (Supermarket Shelves)</option>
                  </select>
               </div>
               
               {/* Color */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600">اللون الأساسي</label>
                  <input type="color" value={selectedSlat.color || '#f5f5f5'} onChange={e => updateSlatWall(targetId, selectedSlat.id, {color: e.target.value})} className="w-full h-8 rounded-md cursor-pointer border border-zinc-200"/>
               </div>

               {(!selectedSlat.systemType || selectedSlat.systemType === 'slat') && (
                 /* Spacing */
                 <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-600">المسافة بين الشرائح (م)</label>
                    <input type="number" step="0.01" min="0.05" value={selectedSlat.slatSpacing} onChange={e => updateSlatWall(targetId, selectedSlat.id, {slatSpacing: Number(e.target.value)})} className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"/>
                 </div>
               )}

               {selectedSlat.systemType === 'supermarket_shelves' && (
                 <>
                   <div className="flex gap-2">
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">عدد الأرفف الأفقية</label>
                        <input type="number" step="1" min="1" value={selectedSlat.shelfCount || 5} onChange={e => updateSlatWall(targetId, selectedSlat.id, {shelfCount: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">عمق الرف (م)</label>
                        <input type="number" step="0.05" min="0.2" value={selectedSlat.shelfDepth || 0.4} onChange={e => updateSlatWall(targetId, selectedSlat.id, {shelfDepth: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-600">المسافة بين الأعمدة (م)</label>
                      <input type="number" step="0.1" min="0.6" value={selectedSlat.uprightSpacing || 1.0} onChange={e => updateSlatWall(targetId, selectedSlat.id, {uprightSpacing: Number(e.target.value)})} className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"/>
                   </div>
                 </>
               )}

               {selectedSlat.fillType === 'partial' ? (
                  <>
                     <div className="flex gap-2">
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">العرض (م)</label>
                          <input type="number" step="0.1" value={selectedSlat.width || 1} onChange={e => updateSlatWall(targetId, selectedSlat.id, {width: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">الارتفاع (م)</label>
                          <input type="number" step="0.1" value={selectedSlat.height} onChange={e => updateSlatWall(targetId, selectedSlat.id, {height: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">الموضع الأفقي (0-1)</label>
                          <input type="number" step="0.05" min="0" max="1" value={selectedSlat.position || 0.5} onChange={e => updateSlatWall(targetId, selectedSlat.id, {position: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">الارتفاع من الأرض (م)</label>
                          <input type="number" step="0.1" value={selectedSlat.bottomOffset} onChange={e => updateSlatWall(targetId, selectedSlat.id, {bottomOffset: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                     </div>
                  </>
               ) : (
                  <>
                     <div className="flex flex-col gap-1.5 flex-1 mt-2">
                        <label className="text-[10px] font-semibold text-zinc-500">الارتفاع (م)</label>
                        <input type="number" step="0.1" value={selectedSlat.height} onChange={e => updateSlatWall(targetId, selectedSlat.id, {height: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">الارتفاع من الأرض (م)</label>
                        <input type="number" step="0.1" value={selectedSlat.bottomOffset} onChange={e => updateSlatWall(targetId, selectedSlat.id, {bottomOffset: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                  </>
               )}

               {(!selectedSlat.systemType || selectedSlat.systemType === 'slat') && (
                 <div className="pt-4 border-t border-zinc-100 flex flex-col gap-3">
                    <label className="text-xs font-semibold text-zinc-600">إضافة الملحقات (Accessories)</label>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => {
                          const accId = addAccessoryToSlat(targetId, selectedSlat.id, 'shelf');
                          setActiveAccessoryId(accId);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://static.commerceplatform.services/images/zoom/swws1224mp.rw_zoom.jpg" alt="رف خشبي" className="w-full h-full object-cover mix-blend-darken" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">رف مسطح</span>
                       </button>
                       <button onClick={() => {
                          const accId = addAccessoryToSlat(targetId, selectedSlat.id, 'hook_single');
                          setActiveAccessoryId(accId);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://m.media-amazon.com/images/I/51H+WnKu2fL._AC_SX679_.jpg" alt="شوك تعليق" className="w-full h-full object-cover mix-blend-multiply" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">شوك مفرد</span>
                       </button>
                       <button onClick={() => {
                          const accId = addAccessoryToSlat(targetId, selectedSlat.id, 'hook_waterfall');
                          setActiveAccessoryId(accId);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://s.alicdn.com/@sc04/kf/H3e06bf17449d413f8eebd8b07b989664K/Wholesale-Retail-Store-Metal-Waterfall-Display-Hook-with-Bins-Chrome-Finish-Slatwall-Compatible-Displays-for-Shop-Showcase.jpg_300x300.jpg" alt="خطاف ملابس" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">خطاف ملابس</span>
                       </button>
                    </div>
                 </div>
               )}
            </div>
            )
         ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6 text-zinc-400 text-xs border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
               الرجاء تحديد جدار شرائحي من معاينة الـ 2D أو إضافة واحد جديد للبدء بالتعديل.
            </div>
         )}
      </div>
    </div>
  )
}


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
    addSlatWallToWall,
    updateSlatWall,
    removeSlatWall,
    selectedSlatWallId,
    selectSlatWall,
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

  // Function to focus camera on selected wall
  const handleFocusOnWall = useCallback((wallId: string, side: 'front' | 'back' = 'front') => {
    const wall = layout.walls.find(w => w.id === wallId);
    if (!wall || !threeRef.current) return;

    threeRef.current.focusOnWall(wallId, side);
  }, [layout.walls]);

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
    <div className="min-h-screen w-full flex flex-col overflow-y-auto text-zinc-800 bg-zinc-50 font-sans selection:bg-slate-200 pb-12" dir="rtl" data-shop-builder-container>
      {/* Avant-Garde Minimal Top Nav */}
      <header className="flex-shrink-0 h-14 bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-6 flex items-center justify-between z-40 transition-all sticky top-0 mix-blend-luminosity">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2 group cursor-default">
             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
             <span className="font-bold text-lg tracking-tight text-zinc-900 group-hover:text-black transition-colors">{layout.shopName || 'مساحة العمل'}</span>
             <span className="text-xs font-medium text-zinc-400">/ {layout.field || 'بدون فئة'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono font-semibold text-zinc-400">
           <span className="px-2 py-1 bg-zinc-100/50 rounded-md tracking-wider border border-zinc-200/50 shadow-sm">{currentDate}</span>
           <span className="px-2 py-1 bg-zinc-100/50 rounded-md tracking-wider border border-zinc-200/50 shadow-sm">{currentTime}</span>
        </div>
      </header>

      {/* Main App Workspace */}
      <div 
        className="flex-1 w-full relative flex flex-col px-4 pt-3 pb-4 gap-3 overflow-hidden" 
        style={{ 
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)`, 
          backgroundSize: '24px 24px' 
        }}
      >
        {/* Floating Toolbar positioned top center */}
        <div className="flex justify-center z-30 pointer-events-none sticky top-0 mb-1">
           <div className="pointer-events-auto transform shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white/90 backdrop-blur-lg border border-zinc-100">
             <BuilderToolbar
               transformMode={transformMode}
               onTransformModeChange={setTransformMode}
               onResetCamera={handleResetCamera}
               onSnapshot={handleSnapshot}
               onFullscreen={handleFullscreen}
               onClearSelection={handleClearSelection}
             />
           </div>
        </div>

        {/* Editor Split Views */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-[60vh] lg:min-h-[calc(100vh-140px)] w-full max-w-[1920px] mx-auto">
          <div ref={floorplan2DRef} className={cn(
            "flex-1 rounded-2xl bg-white/90 backdrop-blur-lg shadow-sm border overflow-hidden relative flex flex-col group transition-all duration-500",
            isDrawingMode ? "border-transparent ring-2 ring-primary/40 shadow-xl" : "border-zinc-200/60 hover:border-zinc-300"
          )}
            style={isDrawingMode ? { backgroundColor: `${primaryColor}03` } : {}}>
            <div className="flex items-center justify-between mb-3 p-3 pb-0">
              <div className="flex items-center gap-2">
                <h2 className="text-zinc-800 tracking-tight font-bold">مُحرِّر المخطط ثنائي الأبعاد</h2>
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
                          style={{ border: `1px solid ${primaryColor}40` }}
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
                          style={{ border: `1px solid ${primaryColor}40` }}
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

            {/* Slat Wall Settings Panel */}
            {(is2DFullscreen || hasEnteredFullscreen) && selectedSlatWallId && (() => {
              const wall = layout.walls.find(w => w.slatWalls?.some(s => s.id === selectedSlatWallId));
              const slatWall = wall?.slatWalls?.find(s => s.id === selectedSlatWallId);
              if (!wall || !slatWall) return null;

              return (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto w-full max-w-4xl px-4">
                  <div className="bg-white rounded-xl shadow-2xl overflow-visible" style={{ border: `2px solid ${primaryColor}` }}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 w-full sm:w-auto" dir="rtl">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm text-white" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
                        <span className="text-sm font-bold">🛒 أنظمة العرض</span>
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>النوع</label>
                        <select
                          value={slatWall.fillType}
                          onChange={(e) => updateSlatWall(wall.id, slatWall.id, { fillType: e.target.value as 'full' | 'partial' })}
                          className="w-24 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                          style={{ border: `1px solid ${primaryColor}40` }}
                        >
                          <option value="full">كامل الجدار</option>
                          <option value="partial">مساحة جزئية</option>
                        </select>
                      </div>

                      {slatWall.fillType === 'partial' && (
                        <>
                          <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>العرض (م)</label>
                            <input
                              type="number" step="0.1" min="0.5"
                              value={(slatWall.width || 1).toFixed(1)}
                              onChange={(e) => updateSlatWall(wall.id, slatWall.id, { width: Number(e.target.value) })}
                              className="w-16 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                              style={{ border: `1px solid ${primaryColor}40` }}
                            />
                          </div>
                          <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>الموضع %</label>
                            <input
                              type="range" min="0" max="1" step="0.01"
                              value={slatWall.position || 0.5}
                              onChange={(e) => updateSlatWall(wall.id, slatWall.id, { position: Number(e.target.value) })}
                              className="w-20 h-9"
                            />
                          </div>
                        </>
                      )}

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>الارتفاع (م)</label>
                        <input
                          type="number" step="0.1" min="0.5" max="4"
                          value={(slatWall.height || 2).toFixed(1)}
                          onChange={(e) => updateSlatWall(wall.id, slatWall.id, { height: Number(e.target.value) })}
                          className="w-16 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                          style={{ border: `1px solid ${primaryColor}40` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>عن الأرض (م)</label>
                        <input
                          type="number" step="0.1" min="0" max="2"
                          value={(slatWall.bottomOffset || 0).toFixed(1)}
                          onChange={(e) => updateSlatWall(wall.id, slatWall.id, { bottomOffset: Number(e.target.value) })}
                          className="w-16 h-9 text-center text-xs rounded-md focus:outline-none focus:ring-1 bg-white"
                          style={{ border: `1px solid ${primaryColor}40` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold" style={{ color: primaryColor }}>اللون</label>
                        <input
                          type="color"
                          value={slatWall.color || '#f5f5f5'}
                          onChange={(e) => updateSlatWall(wall.id, slatWall.id, { color: e.target.value })}
                          className="w-12 h-9 rounded-lg cursor-pointer shadow-sm"
                          style={{ border: `1px solid ${primaryColor}40` }}
                        />
                      </div>

                      <div className="hidden sm:block h-8 w-px" style={{ backgroundColor: primaryColor }} />
                      <button
                        onClick={() => {
                          removeSlatWall(wall.id, slatWall.id);
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

          <div ref={three3DRef} className="flex-1 rounded-2xl bg-white/90 backdrop-blur-lg shadow-sm border border-zinc-200/60 flex flex-col relative overflow-hidden group hover:border-zinc-300 transition-colors duration-500" data-three-container>
            <div className="flex items-center justify-between p-3 bg-white/80 backdrop-blur-sm border-b border-zinc-100 z-10">
              <h2 className="text-zinc-800 tracking-tight font-bold">معاينة ثلاثية الأبعاد تفاعلية</h2>
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
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl border border-zinc-200/60 rounded-2xl shadow-2xl overflow-hidden hover:shadow-primary/5 transition-all">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 w-full sm:w-auto" dir="rtl">
                {/* Product Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white/50 backdrop-blur-md rounded-xl" style={{ border: `1px solid ${primaryColor}40`, color: primaryColor }}>
                  <span className="text-sm font-bold">📦 {product.name}</span>
                </div>

                <div className="hidden sm:block h-8 w-px bg-purple-200" />

                {/* Focus Camera Button */}
                <button
                  onClick={() => handleFocusOnProduct(product.id)}
                  className="h-9 px-4 flex items-center gap-2 text-white rounded-xl shadow-lg transition-all hover:-translate-y-0.5 font-semibold text-xs"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`, boxShadow: `0 8px 16px -6px ${primaryColor}50` }}
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
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl border border-zinc-200/60 rounded-2xl shadow-2xl overflow-visible hover:shadow-primary/5 transition-all">
              <div className="flex items-center justify-center gap-3 px-4 py-3 min-w-max" dir="rtl">
                {/* Wall Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white/50 backdrop-blur-md rounded-xl" style={{ border: `1px solid ${secondaryColor}40`, color: secondaryColor }}>
                  <span className="text-sm font-bold">🧱 جدار</span>
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Focus Wall */}
                <div className="relative group/focus">
                  <button
                    onClick={() => handleFocusOnWall(wall.id, 'front')}
                    className="h-9 px-4 flex items-center gap-2 text-white rounded-xl shadow-lg transition-all hover:-translate-y-0.5 font-semibold text-xs"
                    style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`, boxShadow: `0 8px 16px -6px ${secondaryColor}50` }}
                    title="تركيز الكاميرا على الجدار"
                  >
                    <Focus className="h-4 w-4" />
                    <span>تركيز</span>
                    <ChevronUp className="h-3 w-3 opacity-70" />
                  </button>
                  {/* Dropdown on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-white border border-zinc-200 rounded-xl shadow-xl opacity-0 invisible group-hover/focus:opacity-100 group-hover/focus:visible transition-all z-50 overflow-hidden flex flex-col">
                    <button onClick={() => handleFocusOnWall(wall.id, 'front')} className="w-full px-3 py-2 text-xs font-bold text-center hover:bg-zinc-50 border-b border-zinc-100 transition-colors text-zinc-700">
                      الوجه الأمامي
                    </button>
                    <button onClick={() => handleFocusOnWall(wall.id, 'back')} className="w-full px-3 py-2 text-xs font-bold text-center hover:bg-zinc-50 transition-colors text-zinc-700">
                      الوجه الخلفي
                    </button>
                  </div>
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Height Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: secondaryColor }}
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
                    className="w-16 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: secondaryColor }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Thickness Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: secondaryColor }}
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
                    className="w-16 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: secondaryColor }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Length Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: secondaryColor }}
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
                    className="w-16 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: secondaryColor }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Angle Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: secondaryColor }}
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
                    className="w-14 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: secondaryColor }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Slat Wall Manager Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      className="h-9 px-4 text-xs font-semibold text-white rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                    >
                      <Plus className="h-4 w-4" />
                      <span>أنظمة العرض</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border border-zinc-200/60 shadow-2xl" dir="rtl">
                    <DialogHeader className="flex-none pb-4 border-b border-zinc-100">
                      <DialogTitle className="text-xl" style={{ color: primaryColor }}>مدير أنظمة العرض (Display Systems)</DialogTitle>
                      <DialogDescription>
                        قم بتوزيع الشرائح على الجدار بشكل حر. استخدم المعاينة ثنائية الأبعاد (2D) لإضافة وتعديل الشرائح.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <SlatWallManagerContent targetId={wall.id} type="wall" primaryColor={primaryColor} secondaryColor={secondaryColor} />
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Column Management Button via Hover Dropdown */}
                <div className="relative group/column">
                  <button
                    className="h-9 px-4 text-xs font-semibold text-white rounded-lg flex items-center gap-2 transition-all shadow-md hover:-translate-y-0.5"
                    style={{ backgroundColor: secondaryColor }}
                    title="خيارات الأعمدة"
                  >
                    <span>🏛️ عمود</span>
                    <ChevronUp className="h-3 w-3 opacity-70" />
                  </button>
                  {/* Dropdown Menu */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl opacity-0 invisible group-hover/column:opacity-100 group-hover/column:visible transition-all z-50 overflow-hidden flex flex-col">
                    {/* List Existing Columns */}
                    {wall.columns && wall.columns.length > 0 && wall.columns.map((col, idx) => (
                      <button 
                        key={col.id} 
                        onClick={() => selectColumn(col.id)} 
                        className="w-full px-3 py-2 text-xs font-bold text-center hover:bg-zinc-50 border-b border-zinc-100 transition-colors text-zinc-700 flex justify-between items-center"
                      >
                         <span>عمود {idx + 1}</span>
                         <span className="text-[10px] text-zinc-400">تحديد</span>
                      </button>
                    ))}
                    {/* Add New Column */}
                    <button 
                      onClick={() => addColumnToWall(wall.id, 0.5, 'front')} 
                      className="w-full px-3 py-2 text-xs font-bold text-center hover:bg-blue-50 transition-colors text-blue-600 bg-blue-50/50 flex justify-center items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة عمود جديد
                    </button>
                  </div>
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `${secondaryColor}30` }} />

                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (confirm('هل تريد حذف هذا الجدار؟')) {
                      removeWall(wall.id);
                      selectWall(null);
                    }
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 rounded-lg flex items-center gap-2 transition-all shadow-sm"
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
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl border border-zinc-200/60 rounded-2xl shadow-2xl overflow-x-auto hover:shadow-primary/5 transition-all scrollbar-hide">
              <div className="flex items-center justify-center gap-3 px-4 py-3 min-w-max" dir="rtl">
                {/* Column Name Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white/50 backdrop-blur-md rounded-xl" style={{ border: `1px solid #d9770640`, color: "#d97706" }}>
                  <span className="text-sm font-bold">🏛️ عمود</span>
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `#d9770630` }} />

                {/* Back to Wall Button */}
                <button
                  onClick={() => {
                     selectColumn(null);
                     selectWall(wall.id);
                  }}
                  className="h-9 px-3 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>العودة للجدار 🔙</span>
                </button>

                <div className="h-8 w-px" style={{ backgroundColor: `#d9770630` }} />

                {/* Width Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: "#d97706" }}
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
                    className="w-16 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: "#d97706" }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `#d9770630` }} />

                {/* Position Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: "#d97706" }}
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
                    className="w-14 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: "#d97706" }}
                  />
                </div>

                <div className="h-8 w-px" style={{ backgroundColor: `#d9770630` }} />

                {/* Depth Control */}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] font-semibold cursor-ew-resize select-none px-1 py-0.5 rounded transition-colors"
                    style={{ color: "#d97706" }}
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
                    className="w-14 h-9 text-center text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 bg-white/80"
                    style={{ outlineColor: "#d97706" }}
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

                <div className="h-8 w-px bg-amber-200" />

                {/* Side Control */}
                <button
                  onClick={() => {
                     const nextSide = (column.side || 'front') === 'front' ? 'back' : 'front';
                     const updatedColumns = wall.columns?.map(c =>
                       c.id === column.id ? { ...c, side: nextSide as 'front' | 'back' } : c
                     );
                     upsertWall({ id: wall.id, columns: updatedColumns });
                  }}
                  className="h-9 px-4 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-2 transition-colors"
                  title="تبديل الوجه"
                >
                  <RotateCcw className="h-4 w-4 text-amber-600" />
                  <span>الوجه: {(column.side || 'front') === 'front' ? 'أمامي' : 'خلفي'}</span>
                </button>

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
                  onClick={() => {
                     selectColumn(null);
                     selectWall(null);
                  }}
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
        <div className="w-full max-w-[1920px] mx-auto mt-4 px-2">
          <SceneItemsList />
        </div>
      </div>
    </div>
  );
};

// Protection wrapper to ensure shop setup is complete
const ShopBuilderProtected = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shopData, loading } = useShopSetup();
  const { isAuthenticated } = useDualAuth();

  useEffect(() => {
    // If guest user and NOT coming from setup completion, redirect to setup
    if (!loading && !isAuthenticated && !location.state?.fromSetup) {
      navigate('/shop-setup', { replace: true });
      return;
    }

    // If shop data is missing (and not loading), redirect to setup
    // This covers logged-in users who haven't set up their shop yet
    if (!loading && !shopData && !location.state?.fromSetup) {
      navigate('/shop-setup', { replace: true });
    }
  }, [shopData, loading, navigate, isAuthenticated, location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow rendering if we have data OR if we're a guest coming from setup (using temporary state)
  if (!shopData && !location.state?.fromSetup) {
    return null;
  }

  return (
    <ShopBuilderProvider initialShopData={shopData}>
      <ShopBuilderContent />
    </ShopBuilderProvider>
  );
};

export default ShopBuilderProtected;
