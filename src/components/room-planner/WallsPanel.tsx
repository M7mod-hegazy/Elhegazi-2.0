import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Square, Lock, Unlock, RotateCcw, Trash2 } from 'lucide-react';
import { PRECONFIGURED_WALLS, PRECONFIGURED_SHELVES, PRECONFIGURED_COLUMNS, Wall, Shelf, Column } from './plannerConstants';
import Wall2DView from './Wall2DView';

type WallsPanelProps = {
  walls: Wall[];
  selectedWallId: string | null;
  wallWidth: number;
  wallHeight: number;
  wallDepth: number;
  wallTexture: string;
  wallPositionX: number;
  wallPositionY: number;
  wallPositionZ: number;
  wallRotationY: number;
  wallIsLocked: boolean;
  shelves: Shelf[];
  columns: Column[];
  selectedShelfType: string;
  columnWidth: number;
  columnHeight: number;
  columnDepth: number;
  setWallWidth: (width: number) => void;
  setWallHeight: (height: number) => void;
  setWallDepth: (depth: number) => void;
  setWallTexture: (texture: string) => void;
  setWallPositionX: (x: number) => void;
  setWallPositionY: (y: number) => void;
  setWallPositionZ: (z: number) => void;
  setWallRotationY: (rotation: number) => void;
  setWallIsLocked: (locked: boolean) => void;
  updateSelectedWall: (updatedWall: Wall) => void;
  handleWallClick: (id: string) => void;
  removeWall: (id: string) => void;
  toggleWallLock: () => void;
  resetToDefaultWalls: () => void;
  addShelfToWall: (position: { x: number; y: number }) => void;
  addColumnToWall: (position: { x: number; y: number }) => void;
  updateShelfPosition: (shelfId: string, position: { x: number; y: number }) => void;
  updateColumnPosition: (columnId: string, position: { x: number; y: number }) => void;
  removeShelf: (shelfId: string) => void;
  removeColumn: (columnId: string) => void;
  insertShelvesAndColumns: (config: {
    shelfType: string;
    columnType: string;
    shelvesPerColumn: number;
    shelfHeight: number;
    columnsCount: number | 'auto';
  }) => void;
};

const WallsPanel = ({
  walls,
  selectedWallId,
  wallWidth,
  wallHeight,
  wallDepth,
  wallTexture,
  wallPositionX,
  wallPositionY,
  wallPositionZ,
  wallRotationY,
  wallIsLocked,
  shelves,
  columns,
  selectedShelfType,
  columnWidth,
  columnHeight,
  columnDepth,
  setWallWidth,
  setWallHeight,
  setWallDepth,
  setWallTexture,
  setWallPositionX,
  setWallPositionY,
  setWallPositionZ,
  setWallRotationY,
  setWallIsLocked,
  updateSelectedWall,
  handleWallClick,
  removeWall,
  toggleWallLock,
  resetToDefaultWalls,
  addShelfToWall,
  addColumnToWall,
  updateShelfPosition,
  updateColumnPosition,
  removeShelf,
  removeColumn,
  insertShelvesAndColumns
}: WallsPanelProps) => {
  // Texture options with colors
  const textureOptions = [
    { id: 'wood', name: 'Wood', color: 'bg-amber-800' },
    { id: 'brick', name: 'Brick', color: 'bg-red-800' },
    { id: 'concrete', name: 'Concrete', color: 'bg-gray-600' },
    { id: 'tile', name: 'Tile', color: 'bg-primary' },
    { id: 'marble', name: 'Marble', color: 'bg-white' },
    { id: 'default', name: 'Default', color: 'bg-gray-400' }
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">الجدران</h3>
        <Button 
          onClick={resetToDefaultWalls}
          className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white px-3 py-1 rounded-lg border border-primary/30 transition-all duration-300 font-medium transform hover:scale-105 shadow-md hover:shadow-lg text-sm"
        >
          <RotateCcw className="ml-1" size={14} />
          جدران افتراضية
        </Button>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {walls.map((wall) => (
          <div 
            key={wall.id} 
            className={`flex justify-between items-center p-3 rounded cursor-pointer border ${
              selectedWallId === wall.id 
                ? 'bg-primary/10 border-primary/30' 
                : 'bg-white hover:bg-gray-50 border-gray-200'
            }`}
            onClick={() => handleWallClick(wall.id)}
          >
            <div>
              <p className="font-medium text-gray-800">{wall.name}</p>
              <p className="text-sm text-gray-600">
                {wall.width}×{wall.height}×{wall.depth} سم
              </p>
            </div>
            {wall.id !== 'floor' && (
              <Button 
                variant="destructive" 
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white rounded border border-red-300"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWall(wall.id);
                }}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      {/* Wall 2D View - appears when wall is selected */}
      {selectedWallId && selectedWallId !== 'floor' && (
        <Wall2DView
          wall={walls.find(w => w.id === selectedWallId)!}
          shelves={shelves.filter(shelf => {
            const wall = walls.find(w => w.id === selectedWallId);
            if (!wall) return false;
            // Check if shelf is on this wall (simplified check)
            return Math.abs(shelf.position.z - wall.position.z) < wall.depth + 5;
          })}
          columns={columns.filter(column => {
            const wall = walls.find(w => w.id === selectedWallId);
            if (!wall) return false;
            // Check if column is on this wall (simplified check)
            return Math.abs(column.position.z - wall.position.z) < wall.depth + 5;
          })}
          preconfiguredShelves={PRECONFIGURED_SHELVES}
          preconfiguredColumns={PRECONFIGURED_COLUMNS}
          onUpdate={updateSelectedWall}
          onAddShelf={addShelfToWall}
          onAddColumn={addColumnToWall}
          onMove={() => {}}
          onDelete={() => removeWall(selectedWallId!)}
          onColor={() => {}}
          onQuit={() => {}}
          onShelfPositionChange={updateShelfPosition}
          onColumnPositionChange={updateColumnPosition}
          onRemoveShelf={removeShelf}
          onRemoveColumn={removeColumn}
          onInsertShelvesAndColumns={insertShelvesAndColumns}
        />
      )}
      
      {selectedWallId && (
        <Card className="mt-4 border border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="flex items-center text-gray-800">
              <Square className="mr-2 text-primary" />
              خصائص الجدار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-700">العرض (سم)</Label>
              <Slider 
                min={50} 
                max={1000} 
                step={10} 
                value={[wallWidth]} 
                onValueChange={(value) => setWallWidth(value[0])} 
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallWidth} 
                onChange={(e) => setWallWidth(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  width: wallWidth
                })}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الارتفاع (سم)</Label>
              <Slider 
                min={50} 
                max={500} 
                step={10} 
                value={[wallHeight]} 
                onValueChange={(value) => setWallHeight(value[0])} 
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallHeight} 
                onChange={(e) => setWallHeight(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  height: wallHeight
                })}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">العمق (سم)</Label>
              <Slider 
                min={5} 
                max={50} 
                step={1} 
                value={[wallDepth]} 
                onValueChange={(value) => setWallDepth(value[0])} 
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallDepth} 
                onChange={(e) => setWallDepth(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  depth: wallDepth
                })}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الموضع س (سم)</Label>
              <Slider 
                min={-1000} 
                max={1000} 
                step={5} 
                value={[wallPositionX]} 
                onValueChange={(value) => setWallPositionX(value[0])} 
                disabled={wallIsLocked}
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallPositionX} 
                onChange={(e) => setWallPositionX(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  position: {
                    ...walls.find(w => w.id === selectedWallId)!.position,
                    x: wallPositionX
                  }
                })}
                disabled={wallIsLocked}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الموضع ص (سم)</Label>
              <Slider 
                min={0} 
                max={250} 
                step={5} 
                value={[wallPositionY]} 
                onValueChange={(value) => setWallPositionY(value[0])} 
                disabled={wallIsLocked}
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallPositionY} 
                onChange={(e) => setWallPositionY(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  position: {
                    ...walls.find(w => w.id === selectedWallId)!.position,
                    y: wallPositionY
                  }
                })}
                disabled={wallIsLocked}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الموضع ع (سم)</Label>
              <Slider 
                min={-1000} 
                max={1000} 
                step={5} 
                value={[wallPositionZ]} 
                onValueChange={(value) => setWallPositionZ(value[0])} 
                disabled={wallIsLocked}
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallPositionZ} 
                onChange={(e) => setWallPositionZ(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  position: {
                    ...walls.find(w => w.id === selectedWallId)!.position,
                    z: wallPositionZ
                  }
                })}
                disabled={wallIsLocked}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الدوران (درجة)</Label>
              <Slider 
                min={0} 
                max={360} 
                step={1} 
                value={[wallRotationY]} 
                onValueChange={(value) => setWallRotationY(value[0])} 
                className="my-2"
              />
              <Input 
                type="number" 
                value={wallRotationY} 
                onChange={(e) => setWallRotationY(Number(e.target.value))} 
                onBlur={() => updateSelectedWall({
                  ...walls.find(w => w.id === selectedWallId)!,
                  rotation: {
                    ...walls.find(w => w.id === selectedWallId)!.rotation,
                    y: wallRotationY
                  }
                })}
                className="border-gray-300 focus:ring-primary focus:border-primary"
              />
            </div>
            
            <div>
              <Label className="text-gray-700">الملمس</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {textureOptions.map((texture) => (
                  <button
                    key={texture.id}
                    className={`w-8 h-8 rounded-full ${texture.color} border-2 ${
                      wallTexture === texture.id ? 'border-white' : 'border-gray-400'
                    } hover:border-white transition-all duration-300`}
                    onClick={() => {
                      setWallTexture(texture.id);
                      updateSelectedWall({
                        ...walls.find(w => w.id === selectedWallId)!,
                        texture: texture.id
                      });
                    }}
                    title={texture.name}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lock-wall" 
                checked={wallIsLocked}
                onCheckedChange={(checked) => {
                  setWallIsLocked(checked as boolean);
                  toggleWallLock();
                }}
                className="border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="lock-wall" className="text-gray-700">
                {wallIsLocked ? "مقفل" : "غير مقفل"}
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-300 hover:bg-gray-100 text-gray-700"
                onClick={toggleWallLock}
              >
                {wallIsLocked ? <Lock size={16} /> : <Unlock size={16} />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default WallsPanel;