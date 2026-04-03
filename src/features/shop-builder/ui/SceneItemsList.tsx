import React, { useState } from 'react';
import { Box, Layers, Grid3x3, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, ChevronRight, Focus, Copy } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useShopBuilder } from '../store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const SceneItemsList: React.FC = () => {
  const { primaryColor, secondaryColor } = useTheme();
  const {
    layout,
    selectedProductId,
    selectedWallId,
    selectedColumnId,
    selectProduct,
    selectWall,
    selectColumn,
    removeProduct,
    removeWall,
    removeColumn,
  } = useShopBuilder();

  const [expandedSections, setExpandedSections] = useState({
    products: true,
    walls: true,
  });

  const [expandedWalls, setExpandedWalls] = useState<Set<string>>(new Set());

  const toggleSection = (section: 'products' | 'walls') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleWall = (wallId: string) => {
    setExpandedWalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wallId)) {
        newSet.delete(wallId);
      } else {
        newSet.add(wallId);
      }
      return newSet;
    });
  };

  const totalColumns = layout.walls.reduce((sum, wall) => sum + (wall.columns?.length || 0), 0);

  return (
    <div className="w-full bg-white/95 backdrop-blur-xl rounded-2xl border border-zinc-200/60 shadow-xl overflow-hidden flex flex-col max-h-full">
      <div className="px-4 py-3 border-b border-zinc-200/60 bg-zinc-50/50 text-zinc-800">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          عناصر المشهد
        </h3>
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-col divide-y divide-zinc-100 overflow-y-auto min-h-0 min-h-[300px]">
        {/* Products Section - RIGHT COLUMN */}
        <div className="order-1 flex flex-col flex-shrink-0 relative">
          <button
            onClick={() => toggleSection('products')}
            className="w-full px-3 py-3 flex items-center justify-between transition-colors hover:bg-zinc-50 sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-zinc-100/50"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-zinc-600 bg-zinc-100 border border-zinc-200/50">
                <Box className="h-4 w-4" />
              </div>
              <div className="text-right">
                <h4 className="font-bold text-slate-900 text-sm">المنتجات</h4>
                <p className="text-[10px] text-slate-600">{layout.products.length} منتج</p>
              </div>
            </div>
            {expandedSections.products ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {expandedSections.products && (
            <div className="px-2 pb-3 space-y-1.5 max-h-80 overflow-y-auto">
              {layout.products.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Box className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">لا توجد منتجات</p>
                </div>
              ) : (
                layout.products.map((product) => {
                  // Try to get thumbnail from metadata or use modelUrl
                  const thumbnailUrl = (product.metadata?.thumbnailUrl as string) ||
                    (product.metadata?.imageUrl as string) ||
                    product.modelUrl;
                  const isImageUrl = thumbnailUrl && (
                    thumbnailUrl.endsWith('.jpg') ||
                    thumbnailUrl.endsWith('.jpeg') ||
                    thumbnailUrl.endsWith('.png') ||
                    thumbnailUrl.endsWith('.webp')
                  );

                  return (
                    <div
                      key={product.id}
                      className={`group flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${selectedProductId === product.id
                        ? 'border-zinc-400 bg-zinc-100 shadow-sm ring-1 ring-zinc-300'
                        : 'border-zinc-200/60 hover:border-zinc-300 hover:bg-zinc-50/50'
                        }`}
                      onClick={() => selectProduct(product.id)}
                    >
                      {/* Product Image/Icon */}
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center overflow-hidden border border-zinc-200/60 flex-shrink-0">
                        {isImageUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to icon if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Box className={`h-5 w-5 text-purple-600 ${isImageUrl ? 'hidden' : ''}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate text-xs">{product.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            📍 ({product.position.x.toFixed(1)}, {product.position.z.toFixed(1)})
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProduct(product.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Walls Section - LEFT COLUMN */}
        <div className="order-2 flex flex-col flex-shrink-0 relative">
          <button
            onClick={() => toggleSection('walls')}
            className="w-full px-3 py-3 flex items-center justify-between transition-colors hover:bg-zinc-50 border-t border-zinc-100/50 sticky top-0 bg-white/90 backdrop-blur-md z-10"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-zinc-600 bg-zinc-100 border border-zinc-200/50">
                <Grid3x3 className="h-4 w-4" />
              </div>
              <div className="text-right">
                <h4 className="font-bold text-slate-900 text-sm">الجدران</h4>
                <p className="text-[10px] text-slate-600">{layout.walls.length} جدار</p>
              </div>
            </div>
            {expandedSections.walls ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {expandedSections.walls && (
            <div className="px-2 pb-3 space-y-1.5 max-h-80 overflow-y-auto">
              {layout.walls.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Grid3x3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد جدران</p>
                </div>
              ) : (
                layout.walls.map((wall, index) => {
                  const wallLength = Math.sqrt(
                    Math.pow(wall.end.x - wall.start.x, 2) +
                    Math.pow(wall.end.y - wall.start.y, 2)
                  );
                  const hasColumns = wall.columns && wall.columns.length > 0;
                  const isExpanded = expandedWalls.has(wall.id);

                  return (
                    <div key={wall.id} className="space-y-1">
                      {/* Wall Item */}
                      <div
                        className={`group flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${selectedWallId === wall.id
                          ? 'border-zinc-400 bg-zinc-100 shadow-sm ring-1 ring-zinc-300'
                          : 'border-zinc-200/60 hover:border-zinc-300 hover:bg-zinc-50/50'
                          }`}
                        onClick={() => selectWall(wall.id)}
                      >
                        {/* Expand/Collapse Button for Columns */}
                        {hasColumns && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWall(wall.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-200 transition-colors flex-shrink-0 text-zinc-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-blue-600" />
                            )}
                          </button>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="font-semibold text-slate-900 text-xs">جدار {index + 1}</p>
                            {hasColumns && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                {wall.columns!.length} عمود
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              📏 {wallLength.toFixed(1)}م
                            </Badge>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              ⬛ {(wall.thickness * 100).toFixed(0)}سم
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWall(wall.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Nested Columns */}
                      {hasColumns && isExpanded && (
                        <div className="mr-6 space-y-1">
                          {wall.columns!.map((column, colIndex) => (
                            <div
                              key={column.id}
                              className={`group flex items-center gap-1.5 p-1.5 rounded-lg border transition-all cursor-pointer ${selectedColumnId === column.id
                                ? 'border-zinc-400 bg-zinc-100 shadow-sm ring-1 ring-zinc-300'
                                : 'border-zinc-200/60 hover:border-zinc-300 hover:bg-zinc-50/50'
                                }`}
                              onClick={() => selectColumn(column.id)}
                            >
                              <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center border border-zinc-200 flex-shrink-0">
                                <Box className="h-3 w-3 text-zinc-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-[10px]">عمود {colIndex + 1}</p>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-[8px] h-3 px-0.5">
                                    📍 {(column.position * 100).toFixed(0)}%
                                  </Badge>
                                  <Badge variant="outline" className="text-[8px] h-3 px-0.5">
                                    ↕️ {(column.height || 3).toFixed(1)}م
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeColumn(wall.id, column.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 hover:bg-red-100 hover:text-red-600"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
