import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Plus, Move, Trash2, Palette, X } from 'lucide-react';
import ShelfColumnInsertModal from './ShelfColumnInsertModal';

type Wall2DViewProps = {
  wall: {
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
    rotation: {
      x: number;
      y: number;
      z: number;
    };
    isLocked: boolean;
    texture: string;
  };
  shelves: Array<{
    id: string;
    width: number;
    height: number;
    depth: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
  }>;
  columns: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
    rotation: {
      x: number;
      y: number;
      z: number;
    };
    isLocked: boolean;
  }>;
  preconfiguredShelves: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
  }>;
  preconfiguredColumns: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
  }>;
  onUpdate: (updatedWall: { id: string; name: string; width: number; height: number; depth: number; position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; isLocked: boolean; texture: string }) => void;
  onAddShelf: (position: { x: number; y: number }) => void;
  onAddColumn: (position: { x: number; y: number }) => void;
  onMove: () => void;
  onDelete: () => void;
  onColor: () => void;
  onQuit: () => void;
  onShelfPositionChange: (shelfId: string, position: { x: number; y: number }) => void;
  onColumnPositionChange: (columnId: string, position: { x: number; y: number }) => void;
  onRemoveShelf: (shelfId: string) => void;
  onRemoveColumn: (columnId: string) => void;
  onInsertShelvesAndColumns: (config: {
    shelfType: string;
    columnType: string;
    shelvesPerColumn: number;
    shelfHeight: number;
    columnsCount: number | 'auto';
  }) => void;
};

const Wall2DView = ({ 
  wall,
  shelves,
  columns,
  preconfiguredShelves,
  preconfiguredColumns,
  onUpdate,
  onAddShelf,
  onAddColumn,
  onMove,
  onDelete,
  onColor,
  onQuit,
  onShelfPositionChange,
  onColumnPositionChange,
  onRemoveShelf,
  onRemoveColumn,
  onInsertShelvesAndColumns
}: Wall2DViewProps) => {
  // State for the insert modal
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  
  // Handle dimension change
  const handleDimensionChange = (dimension: string, value: number) => {
    onUpdate({
      ...wall,
      [dimension]: value
    });
  };

  // Texture options with colors
  const textureOptions = [
    { id: 'wood', name: 'Wood', color: 'bg-amber-800' },
    { id: 'brick', name: 'Brick', color: 'bg-red-800' },
    { id: 'concrete', name: 'Concrete', color: 'bg-gray-600' },
    { id: 'tile', name: 'Tile', color: 'bg-blue-600' },
    { id: 'marble', name: 'Marble', color: 'bg-white' },
    { id: 'default', name: 'Default', color: 'bg-gray-400' }
  ];

  // Handle click on 2D wall visualization to add shelves/columns
  const handleWallClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * wall.width + (wall.position.x - wall.width/2);
    const y = (1 - (e.clientY - rect.top) / rect.height) * wall.height + (wall.position.y - wall.height/2);
    
    // For now, we'll add a shelf at the clicked position
    // In a more advanced implementation, we could show a menu to choose between shelf/column
    onAddShelf({ x, y });
  };

  // Handle drag start for shelves and columns
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, type: 'shelf' | 'column', id: string) => {
    e.dataTransfer.setData('type', type);
    e.dataTransfer.setData('id', id);
  };

  // Handle drag over for the wall visualization
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Handle drop for the wall visualization
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * wall.width + (wall.position.x - wall.width/2);
    const y = (1 - (e.clientY - rect.top) / rect.height) * wall.height + (wall.position.y - wall.height/2);
    
    if (type === 'shelf') {
      onShelfPositionChange(id, { x, y });
    } else if (type === 'column') {
      onColumnPositionChange(id, { x, y });
    }
  };

  return (
    <Card className="mt-4 bg-gray-900/80 backdrop-blur-lg border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-[1.02]">
      <CardHeader className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-cyan-500/30 rounded-t-xl hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
        <CardTitle className="flex justify-between items-center text-cyan-400">
          <span>جدار: {wall.name}</span>
          <div className="flex space-x-1">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onMove}
              className="h-8 w-8 p-0 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 border border-blue-500/50 text-blue-300 rounded-full transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-blue-500/30"
            >
              <Move size={16} />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onColor}
              className="h-8 w-8 p-0 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 border border-purple-500/50 text-purple-300 rounded-full transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-purple-500/30"
            >
              <Palette size={16} />
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={onDelete}
              className="h-8 w-8 p-0 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 border border-red-500/50 rounded-full transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-red-500/30"
            >
              <Trash2 size={16} />
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={onQuit}
              className="h-8 w-8 p-0 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 border border-gray-500/50 text-gray-300 rounded-full transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-gray-500/30"
            >
              <X size={16} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <div>
          <Label className="text-cyan-200">الاسم</Label>
          <Input 
            value={wall.name} 
            onChange={(e) => onUpdate({...wall, name: e.target.value})} 
            className="bg-gray-800/50 border border-cyan-500/30 text-cyan-100 rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300 hover:border-cyan-400/50"
          />
        </div>
        
        <div>
          <Label className="text-cyan-200">العرض (سم)</Label>
          <Slider 
            min={50} 
            max={1000} 
            step={10} 
            value={[wall.width]} 
            onValueChange={(value) => handleDimensionChange('width', value[0])} 
            className="[&>span]:bg-cyan-500/50 transition-all duration-300 hover:opacity-90"
          />
          <Input 
            type="number" 
            value={wall.width} 
            onChange={(e) => handleDimensionChange('width', Number(e.target.value))} 
            className="bg-gray-800/50 border border-cyan-500/30 text-cyan-100 rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300"
          />
        </div>
        
        <div>
          <Label className="text-cyan-200">الارتفاع (سم)</Label>
          <Slider 
            min={50} 
            max={500} 
            step={10} 
            value={[wall.height]} 
            onValueChange={(value) => handleDimensionChange('height', value[0])} 
            className="[&>span]:bg-cyan-500/50"
          />
          <Input 
            type="number" 
            value={wall.height} 
            onChange={(e) => handleDimensionChange('height', Number(e.target.value))} 
            className="bg-gray-800/50 border border-cyan-500/30 text-cyan-100 rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300"
          />
        </div>
        
        <div>
          <Label className="text-cyan-200">العمق (سم)</Label>
          <Slider 
            min={5} 
            max={50} 
            step={1} 
            value={[wall.depth]} 
            onValueChange={(value) => handleDimensionChange('depth', value[0])} 
            className="[&>span]:bg-cyan-500/50"
          />
          <Input 
            type="number" 
            value={wall.depth} 
            onChange={(e) => handleDimensionChange('depth', Number(e.target.value))} 
            className="bg-gray-800/50 border border-cyan-500/30 text-cyan-100 rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300"
          />
        </div>
        
        <div className="pt-4">
          <Label className="text-cyan-200">الملمس</Label>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {textureOptions.map((texture) => (
              <button
                key={texture.id}
                className={`w-8 h-8 rounded-full ${texture.color} border-2 ${
                  wall.texture === texture.id ? 'border-white' : 'border-gray-400'
                } hover:border-white transition-all duration-300`}
                onClick={() => onUpdate({...wall, texture: texture.id})}
                title={texture.name}
              />
            ))}
          </div>
        </div>
        
        <div className="pt-4">
          <Label className="text-cyan-200">إضافة إلى الجدار</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button 
              onClick={() => setIsInsertModalOpen(true)}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border border-cyan-500/50 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 active:scale-95"
            >
              <Plus className="mr-2 h-4 w-4" /> إضافة رفوف وأعمدة
            </Button>
            <Button 
              onClick={() => onAddColumn({ 
                x: wall.position.x, 
                y: wall.position.y 
              })}
              variant="secondary" 
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-purple-100 border border-purple-500/50 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95"
            >
              <Plus className="mr-2 h-4 w-4" /> إضافة عمود
            </Button>
          </div>
        </div>
        
        {/* 2D Wall Visualization */}
        <div className="pt-4">
          <Label className="text-cyan-200">عرض الجدار ثنائي الأبعاد</Label>
          <div 
            className="relative w-full h-64 bg-gray-700/50 border border-cyan-500/30 rounded-lg mt-2 overflow-hidden cursor-crosshair transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20"
            style={{
              backgroundColor: wall.texture === 'wood' ? '#8B4513' : 
                              wall.texture === 'brick' ? '#B22222' : 
                              wall.texture === 'concrete' ? '#696969' : 
                              wall.texture === 'tile' ? '#4682B4' : 
                              wall.texture === 'marble' ? '#F5F5F5' : '#e5e7eb'
            }}
            onClick={handleWallClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Shelves on the wall */}
            {shelves.map((shelf) => (
              <div
                key={shelf.id}
                draggable
                onDragStart={(e) => handleDragStart(e, 'shelf', shelf.id)}
                className="absolute bg-amber-700 border-2 border-amber-900 cursor-move rounded-md shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                style={{
                  width: `${(shelf.width / wall.width) * 100}%`,
                  height: `${(shelf.height / wall.height) * 100}%`,
                  left: `${((shelf.position.x - wall.position.x + wall.width/2) / wall.width) * 100}%`,
                  top: `${((wall.position.y + wall.height/2 - shelf.position.y) / wall.height) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute -top-6 right-0">
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-6 w-6 p-0 bg-red-600 hover:bg-red-700 rounded-full transition-all duration-300 transform hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveShelf(shelf.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Columns on the wall */}
            {columns.map((column) => (
              <div
                key={column.id}
                draggable
                onDragStart={(e) => handleDragStart(e, 'column', column.id)}
                className="absolute bg-purple-700 border-2 border-purple-900 cursor-move rounded-md shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                style={{
                  width: `${(column.width / wall.width) * 100}%`,
                  height: `${(column.height / wall.height) * 100}%`,
                  left: `${((column.position.x - wall.position.x + wall.width/2) / wall.width) * 100}%`,
                  top: `${((wall.position.y + wall.height/2 - column.position.y) / wall.height) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute -top-6 right-0">
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-6 w-6 p-0 bg-red-600 hover:bg-red-700 rounded-full transition-all duration-300 transform hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveColumn(column.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      {/* Insert Modal */}
      <ShelfColumnInsertModal
        wall={wall}
        preconfiguredShelves={preconfiguredShelves}
        preconfiguredColumns={preconfiguredColumns}
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        onInsert={onInsertShelvesAndColumns}
      />
    </Card>
  );
};

export default Wall2DView;
