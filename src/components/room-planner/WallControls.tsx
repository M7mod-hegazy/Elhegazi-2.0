import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Trash2, Move, Palette, Copy, X } from 'lucide-react';

type WallControlsProps = {
  position: [number, number, number];
  onDelete: () => void;
  onMove: () => void;
  onColor: () => void;
  isVisible: boolean;
  onTextureChange?: (texture: string) => void;
  onHideControls?: () => void;
  onClone?: () => void;
  onQuit?: () => void;
};

const WallControls = ({ 
  position, 
  onDelete, 
  onMove,
  onColor,
  isVisible,
  onTextureChange,
  onHideControls,
  onClone,
  onQuit,
}: WallControlsProps) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!isVisible) return null;

  // Texture options with colors
  const textureOptions = [
    { id: 'wood', name: 'Wood', color: 'bg-amber-800' },
    { id: 'brick', name: 'Brick', color: 'bg-red-800' },
    { id: 'concrete', name: 'Concrete', color: 'bg-gray-600' },
    { id: 'tile', name: 'Tile', color: 'bg-blue-600' },
    { id: 'marble', name: 'Marble', color: 'bg-white' },
    { id: 'default', name: 'Default', color: 'bg-gray-400' },
  ];

  // Handle delete with hide controls
  const handleDelete = () => {
    onDelete();
    if (onHideControls) onHideControls();
  };

  // Handle move with hide controls
  const handleMove = () => {
    onMove();
    if (onHideControls) onHideControls();
  };

  // Handle color with hide controls
  const handleColor = () => {
    onColor();
    if (onHideControls) onHideControls();
    setShowColorPicker(!showColorPicker);
  };

  return (
    <Html position={position} center>
      <div className="flex space-x-2 bg-white/90 p-2 rounded-lg shadow-lg backdrop-blur-sm border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
        <Button 
          size="sm"
          variant="ghost"
          className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-2 h-8 w-8 rounded-md"
          onClick={(e) => { e.stopPropagation(); if (onQuit) { onQuit(); } }}
          title="إنهاء التحديد"
        >
          <X size={16} />
        </Button>

        <Button 
          size="sm" 
          variant="ghost" 
          className="text-red-500 hover:text-red-600 hover:bg-red-50 p-2 h-8 w-8 rounded-md transition-all duration-300 transform hover:scale-110 hover:shadow-md"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 size={16} />
        </Button>
        
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 p-2 h-8 w-8 rounded-md transition-all duration-300 transform hover:scale-110 hover:shadow-md"
          onClick={(e) => {
            e.stopPropagation();
            handleMove();
          }}
        >
          <Move size={16} />
        </Button>
        
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-purple-500 hover:text-purple-600 hover:bg-purple-50 p-2 h-8 w-8 rounded-md transition-all duration-300 transform hover:scale-110 hover:shadow-md"
          onClick={(e) => {
            e.stopPropagation();
            handleColor();
          }}
        >
          <Palette size={16} />
        </Button>

        <Button 
          size="sm" 
          variant="ghost" 
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-2 h-8 w-8 rounded-md transition-all duration-300 transform hover:scale-110 hover:shadow-md"
          onClick={(e) => {
            e.stopPropagation();
            if (onClone) { onClone(); }
            if (onHideControls) { onHideControls(); }
          }}
          title="استنساخ الجدار"
        >
          <Copy size={16} />
        </Button>
      </div>
      
      {showColorPicker && (
        <div className="absolute top-12 left-0 bg-white/90 p-3 rounded-lg shadow-lg backdrop-blur-sm border border-gray-200 z-10" style={{
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div className="grid grid-cols-3 gap-2">
            {textureOptions.map((texture) => (
              <button 
                key={texture.id}
                className={`w-8 h-8 rounded-md ${texture.color} border-2 border-gray-300 hover:border-gray-700 transition-all duration-300 transform hover:scale-110 hover:shadow-md`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTextureChange) {
                    onTextureChange(texture.id);
                  }
                  setShowColorPicker(false);
                  if (onHideControls) onHideControls();
                }}
                title={texture.name}
              />
            ))}
          </div>
        </div>
      )}
    </Html>
  );
};

export default WallControls;
