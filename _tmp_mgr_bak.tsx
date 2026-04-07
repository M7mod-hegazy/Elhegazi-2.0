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
                      <div className="bg-white/90 px-1.5 py-0.5 rounded text-[9px] shadow-sm border border-stone-200">Ø¹Ù…ÙˆØ¯</div>
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
             <button onClick={() => {setActiveSide('front'); setActiveId(null)}} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSide === 'front' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}>Ø§Ù„ÙˆØ¬Ù‡ Ø§Ù„Ø£Ù…Ø§Ù…ÙŠ</button>
             <button onClick={() => {setActiveSide('back'); setActiveId(null)}} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSide === 'back' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}>Ø§Ù„ÙˆØ¬Ù‡ Ø§Ù„Ø®Ù„ÙÙŠ</button>
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
                Ø¥Ø¶Ø§ÙØ© Ù†Ø¸Ø§Ù… Ø¹Ø±Ø¶ Ø¬Ø¯ÙŠØ¯
             </button>
           ) : (
             <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border-2 border-blue-100 shadow-md relative overflow-hidden">
                <button 
                  onClick={() => setIsAddingNewSystem(false)}
                  className="absolute top-3 left-3 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-zinc-800 text-sm mb-1 pb-2 border-b border-zinc-100">Ø¥Ø¶Ø§ÙØ© Ù†Ø¸Ø§Ù… Ø¬Ø¯ÙŠØ¯</h3>
                
                {/* System Type Selector */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <label className="text-xs font-bold text-zinc-600">1. Ù†ÙˆØ¹ Ø§Ù„Ù†Ø¸Ø§Ù…</label>
                    <select 
                       value={insertSystemType} 
                       onChange={e => setInsertSystemType(e.target.value)} 
                       className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:border-blue-500 font-semibold text-zinc-700"
                    >
                       <option value="slat">Ø¬Ø¯Ø§Ø± Ø´Ø±Ø§Ø¦Ø­ÙŠ (Slat Wall)</option>
                       <option value="supermarket_shelves">Ø£Ø±ÙÙ Ø³ÙˆØ¨Ø± Ù…Ø§Ø±ÙƒØª (Supermarket Shelves)</option>
                       <option value="primo">أعمدة بريمو (Primo Stands)</option>
                    </select>
                </div>

               {/* Side Toggle removed from here (moved to top of sidebar) */}
      
               {/* Add Actions */}
               <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-zinc-100">
                  <button
                     onClick={() => {
                       if (slatWalls.some(s => s.fillType === 'full' && s.side === activeSide)) return alert('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø¥Ø¶Ø§ÙØ©ØŒ ÙŠÙˆØ¬Ø¯ Ù†Ø¸Ø§Ù… ÙŠØ´ØºÙ„ ÙƒØ§Ù…Ù„ Ø§Ù„Ø¬Ø¯Ø§Ø± Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„ÙˆØ¬Ù‡.');
                       const id = addSlatWallToWall(targetId, activeSide);
                       updateSlatWall(targetId, id, { systemType: insertSystemType as 'slat' | 'supermarket_shelves' | 'primo' });
                       setActiveId(id);
                       setIsAddingNewSystem(false);
                     }}
                     className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors border border-blue-200 flex flex-col items-center justify-center gap-1"
                     style={{ color: primaryColor }}
                  >
                     <Plus className="w-4 h-4"/>
                     ÙƒØ§Ù…Ù„ Ø§Ù„Ø¬Ø¯Ø§Ø±
                  </button>
                  <button
                     onClick={() => {
                       if (slatWalls.some(s => s.fillType === 'full' && s.side === activeSide)) return alert('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø¥Ø¶Ø§ÙØ©ØŒ ÙŠÙˆØ¬Ø¯ Ù†Ø¸Ø§Ù… ÙŠØ´ØºÙ„ ÙƒØ§Ù…Ù„ Ø§Ù„Ø¬Ø¯Ø§Ø± Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„ÙˆØ¬Ù‡.');
                       const id = addSlatWallToWall(targetId, activeSide);
                       updateSlatWall(targetId, id, { systemType: insertSystemType as 'slat' | 'supermarket_shelves' | 'primo', fillType: 'partial', position: 0.5, width: Math.min(1, wallLength), height: Math.min(2, wallHeight) });
                      setActiveId(id);
                      setIsAddingNewSystem(false);
                    }}
                    className="flex-1 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-bold transition-colors border border-zinc-200 flex flex-col items-center justify-center gap-1"
                 >
                    <Plus className="w-4 h-4 text-zinc-500"/>
                    Ø¬Ø²Ø¡ ÙÙ‚Ø·
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
                             <h3 className="font-bold text-sm" style={{ color: primaryColor }}>Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø±Ù</h3>
                             <button onClick={() => { removeAccessory(targetId, selectedSlat.id, acc.id); setActiveAccessoryId(null); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                           </div>
                           
                           {/* Color */}
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-zinc-600">Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ</label>
                              <input type="color" value={acc.color || '#d97706'} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {color: e.target.value})} className="w-full h-8 rounded-md cursor-pointer border border-zinc-200"/>
                           </div>

                             {/* Dimensions */}
                             <div className="flex gap-2">
                               <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø¹Ø±Ø¶ (Ù…)</label>
                                  <input type="number" step="0.1" value={acc.width} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {width: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                               </div>
                               <div className="flex flex-col gap-1.5 flex-1">
                                  <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø¹Ù…Ù‚ (Ù…)</label>
                                  <input type="number" step="0.1" value={acc.depth} onChange={e => updateAccessory(targetId, selectedSlat.id, acc.id, {depth: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                               </div>
                             </div>

                           <button onClick={() => setActiveAccessoryId(null)} className="mt-4 p-2 w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs rounded-lg font-semibold transition-colors">
                             Ø§Ù„Ø¹ÙˆØ¯Ø© Ø¥Ù„Ù‰ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù…
                           </button>
                        </div>
                    )
                 })()
            ) : (
            <div className="flex flex-col gap-4 p-4 border border-zinc-200 rounded-xl bg-white shadow-sm">
               <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                 <h3 className="font-bold text-sm" style={{ color: primaryColor }}>Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù…</h3>
                 <button onClick={() => { removeSlatWall(targetId, selectedSlat.id); setActiveId(null); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
               </div>
               
               {/* System Type */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600">Ù†ÙˆØ¹ Ø§Ù„Ù†Ø¸Ø§Ù…</label>
                  <select 
                     value={selectedSlat.systemType || 'slat'} 
                     onChange={e => updateSlatWall(targetId, selectedSlat.id, {systemType: e.target.value as any})} 
                     className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"
                  >
                     <option value="slat">Ø¬Ø¯Ø§Ø± Ø´Ø±Ø§Ø¦Ø­ÙŠ (Slat Wall)</option>
                     <option value="supermarket_shelves">Ø£Ø±ÙÙ Ø³ÙˆØ¨Ø± Ù…Ø§Ø±ÙƒØª (Supermarket Shelves)</option>
                      <option value="primo">أعمدة بريمو (Primo Stands)</option>
                  </select>
               </div>
               
               {/* Color */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600">Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ</label>
                  <input type="color" value={selectedSlat.color || '#f5f5f5'} onChange={e => updateSlatWall(targetId, selectedSlat.id, {color: e.target.value})} className="w-full h-8 rounded-md cursor-pointer border border-zinc-200"/>
               </div>

               {(!selectedSlat.systemType || selectedSlat.systemType === 'slat' || selectedSlat.systemType === 'primo') && (
                 /* Spacing */
                 <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-600">Ø§Ù„Ù…Ø³Ø§ÙØ© Ø¨ÙŠÙ† Ø§Ù„Ø´Ø±Ø§Ø¦Ø­ (Ù…)</label>
                    <input type="number" step="0.01" min="0.05" value={selectedSlat.slatSpacing} onChange={e => updateSlatWall(targetId, selectedSlat.id, {slatSpacing: Number(e.target.value)})} className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"/>
                 </div>
               )}

               {selectedSlat.systemType === 'supermarket_shelves' && (
                 <>
                   <div className="flex gap-2">
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">Ø¹Ø¯Ø¯ Ø§Ù„Ø£Ø±ÙÙ Ø§Ù„Ø£ÙÙ‚ÙŠØ©</label>
                        <input type="number" step="1" min="1" value={selectedSlat.shelfCount || 5} onChange={e => updateSlatWall(targetId, selectedSlat.id, {shelfCount: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">Ø¹Ù…Ù‚ Ø§Ù„Ø±Ù (Ù…)</label>
                        <input type="number" step="0.05" min="0.2" value={selectedSlat.shelfDepth || 0.4} onChange={e => updateSlatWall(targetId, selectedSlat.id, {shelfDepth: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-600">Ø§Ù„Ù…Ø³Ø§ÙØ© Ø¨ÙŠÙ† Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© (Ù…)</label>
                      <input type="number" step="0.1" min="0.6" value={selectedSlat.uprightSpacing || 1.0} onChange={e => updateSlatWall(targetId, selectedSlat.id, {uprightSpacing: Number(e.target.value)})} className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"/>
                   </div>
                 </>
               )}

               {selectedSlat.systemType === 'primo' && (
                 <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-600">المسافة بين الأعمدة (م)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.4"
                      value={selectedSlat.uprightSpacing || 0.8}
                      onChange={e => updateSlatWall(targetId, selectedSlat.id, {uprightSpacing: Number(e.target.value)})}
                      className="w-full p-1.5 border border-zinc-200 rounded-md text-sm outline-none focus:border-blue-500"
                    />
                 </div>
               )}

               {selectedSlat.fillType === 'partial' ? (
                  <>
                     <div className="flex gap-2">
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø¹Ø±Ø¶ (Ù…)</label>
                          <input type="number" step="0.1" value={selectedSlat.width || 1} onChange={e => updateSlatWall(targetId, selectedSlat.id, {width: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø§Ø±ØªÙØ§Ø¹ (Ù…)</label>
                          <input type="number" step="0.1" value={selectedSlat.height} onChange={e => updateSlatWall(targetId, selectedSlat.id, {height: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ù…ÙˆØ¶Ø¹ Ø§Ù„Ø£ÙÙ‚ÙŠ (0-1)</label>
                          <input type="number" step="0.05" min="0" max="1" value={selectedSlat.position || 0.5} onChange={e => updateSlatWall(targetId, selectedSlat.id, {position: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                       <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø§Ø±ØªÙØ§Ø¹ Ù…Ù† Ø§Ù„Ø£Ø±Ø¶ (Ù…)</label>
                          <input type="number" step="0.1" value={selectedSlat.bottomOffset} onChange={e => updateSlatWall(targetId, selectedSlat.id, {bottomOffset: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                       </div>
                     </div>
                  </>
               ) : (
                  <>
                     <div className="flex flex-col gap-1.5 flex-1 mt-2">
                        <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø§Ø±ØªÙØ§Ø¹ (Ù…)</label>
                        <input type="number" step="0.1" value={selectedSlat.height} onChange={e => updateSlatWall(targetId, selectedSlat.id, {height: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                     <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-semibold text-zinc-500">Ø§Ù„Ø§Ø±ØªÙØ§Ø¹ Ù…Ù† Ø§Ù„Ø£Ø±Ø¶ (Ù…)</label>
                        <input type="number" step="0.1" value={selectedSlat.bottomOffset} onChange={e => updateSlatWall(targetId, selectedSlat.id, {bottomOffset: Number(e.target.value)})} className="w-full p-1 border border-zinc-200 rounded-md text-xs outline-none focus:border-blue-500"/>
                     </div>
                  </>
               )}

               {(!selectedSlat.systemType || selectedSlat.systemType === 'slat' || selectedSlat.systemType === 'primo') && (
                 <div className="pt-4 border-t border-zinc-100 flex flex-col gap-3">
                    <label className="text-xs font-semibold text-zinc-600">Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ù„Ø­Ù‚Ø§Øª (Accessories)</label>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => {
                          addAccessoryToSlat(targetId, selectedSlat.id, 'shelf');
                          setActiveAccessoryId(null);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://static.commerceplatform.services/images/zoom/swws1224mp.rw_zoom.jpg" alt="Ø±Ù Ø®Ø´Ø¨ÙŠ" className="w-full h-full object-cover mix-blend-darken" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">Ø±Ù Ù…Ø³Ø·Ø­</span>
                       </button>
                       <button onClick={() => {
                          addAccessoryToSlat(targetId, selectedSlat.id, 'hook_single');
                          setActiveAccessoryId(null);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://m.media-amazon.com/images/I/51H+WnKu2fL._AC_SX679_.jpg" alt="Ø´ÙˆÙƒ ØªØ¹Ù„ÙŠÙ‚" className="w-full h-full object-cover mix-blend-multiply" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">Ø´ÙˆÙƒ Ù…ÙØ±Ø¯</span>
                       </button>
                       <button onClick={() => {
                          addAccessoryToSlat(targetId, selectedSlat.id, 'hook_waterfall');
                          setActiveAccessoryId(null);
                       }} className="flex flex-col items-center gap-1.5 p-1.5 border border-zinc-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                          <div className="w-full aspect-square rounded-md bg-zinc-100 overflow-hidden relative">
                             <img src="https://s.alicdn.com/@sc04/kf/H3e06bf17449d413f8eebd8b07b989664K/Wholesale-Retail-Store-Metal-Waterfall-Display-Hook-with-Bins-Chrome-Finish-Slatwall-Compatible-Displays-for-Shop-Showcase.jpg_300x300.jpg" alt="Ø®Ø·Ø§Ù Ù…Ù„Ø§Ø¨Ø³" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-700">Ø®Ø·Ø§Ù Ù…Ù„Ø§Ø¨Ø³</span>
                       </button>
                    </div>
                 </div>
               )}
            </div>
            )
         ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6 text-zinc-400 text-xs border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
               Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ­Ø¯ÙŠØ¯ Ø¬Ø¯Ø§Ø± Ø´Ø±Ø§Ø¦Ø­ÙŠ Ù…Ù† Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ù€ 2D Ø£Ùˆ Ø¥Ø¶Ø§ÙØ© ÙˆØ§Ø­Ø¯ Ø¬Ø¯ÙŠØ¯ Ù„Ù„Ø¨Ø¯Ø¡ Ø¨Ø§Ù„ØªØ¹Ø¯ÙŠÙ„.
            </div>
         )}
      </div>
    </div>
  )
}


