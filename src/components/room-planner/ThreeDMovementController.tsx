import React, { useState, useRef, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { RotateCw, Move3D, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';

type ThreeDMovementControllerProps = {
  position: [number, number, number];
  onMove: (deltaX: number, deltaY: number, deltaZ: number) => void;
  onRotate: (deltaY: number) => void;
  onQuit?: () => void;
  isVisible: boolean;
  scale?: number;
  wallSize?: { width: number; height: number; depth: number };
};

const ThreeDMovementController = ({ 
  position, 
  onMove, 
  onRotate,
  onQuit,
  isVisible,
  scale = 1,
  wallSize
}: ThreeDMovementControllerProps) => {
  const [isMoving, setIsMoving] = useState(false);
  const [activeDirection, setActiveDirection] = useState<{ x: number; y: number; z: number } | null>(null);
  const [activeRotation, setActiveRotation] = useState<number | null>(null);
  const moveDirection = useRef({ x: 0, y: 0, z: 0 });
  const rotationDirection = useRef(0);
  
  // Handle quit
  const handleQuit = () => {
    if (onQuit) {
      onQuit();
    }
  };
  
  // Apply movement and rotation
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      if (isMoving) {
        onMove(
          moveDirection.current.x * 5,
          moveDirection.current.y * 5,
          moveDirection.current.z * 5
        );
      }
      
      if (rotationDirection.current !== 0) {
        onRotate(rotationDirection.current * 0.1);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isMoving, onMove, onRotate, isVisible]);

  if (!isVisible) return null;

  // Handle continuous movement
  const handleMoveStart = (direction: { x: number; y: number; z: number }) => {
    moveDirection.current = direction;
    setActiveDirection(direction);
    setIsMoving(true);
  };

  const handleMoveEnd = () => {
    setIsMoving(false);
    setActiveDirection(null);
    moveDirection.current = { x: 0, y: 0, z: 0 };
  };

  // Handle continuous rotation
  const handleRotateStart = (direction: number) => {
    rotationDirection.current = direction;
    setActiveRotation(direction);
  };

  const handleRotateEnd = () => {
    setActiveRotation(null);
    rotationDirection.current = 0;
  };

  return (
    <Html position={position} center>
      <div className="flex flex-col items-center space-y-4 bg-gray-900/90 p-4 rounded-xl shadow-xl border border-cyan-500/50 shadow-cyan-500/20 backdrop-blur-sm hover:shadow-cyan-500/30 transition-all duration-300 transform hover:scale-[1.02]" style={{ transform: `scale(${scale})`, transformOrigin: 'center', fontFamily: 'Orbitron, sans-serif' }}>
        {/* Quit Button */}
        <Button 
          size="sm" 
          variant="destructive"
          className="absolute top-2 right-2 rounded-full w-6 h-6 p-0 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border border-red-300 text-white transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-red-500/30"
          onClick={handleQuit}
        >
          <X size={12} />
        </Button>
        
        {/* Movement controls - outer circle */}
        <div className="relative w-32 h-32 rounded-full border-2 border-cyan-500/50 flex items-center justify-center shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all duration-300">
          <Button 
            size="sm" 
            variant={activeDirection?.x === 0 && activeDirection?.y === 1 && activeDirection?.z === 0 ? "default" : "outline"}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full w-8 h-8 p-0 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border border-primary/50 text-primary transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
            onMouseDown={() => handleMoveStart({ x: 0, y: 1, z: 0 })}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            <ArrowUp size={16} />
          </Button>
          
          <Button 
            size="sm" 
            variant={activeDirection?.x === 0 && activeDirection?.y === -1 && activeDirection?.z === 0 ? "default" : "outline"}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rounded-full w-8 h-8 p-0 bg-gray-800 hover:bg-gray-700 border border-primary/50 text-primary transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
            onMouseDown={() => handleMoveStart({ x: 0, y: -1, z: 0 })}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            <ArrowDown size={16} />
          </Button>
          
          <Button 
            size="sm" 
            variant={activeDirection?.x === -1 && activeDirection?.y === 0 && activeDirection?.z === 0 ? "default" : "outline"}
            className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full w-8 h-8 p-0 bg-gray-800 hover:bg-gray-700 border border-primary/50 text-primary transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
            onMouseDown={() => handleMoveStart({ x: -1, y: 0, z: 0 })}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            <ArrowLeft size={16} />
          </Button>
          
          <Button 
            size="sm" 
            variant={activeDirection?.x === 1 && activeDirection?.y === 0 && activeDirection?.z === 0 ? "default" : "outline"}
            className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rounded-full w-8 h-8 p-0 bg-gray-800 hover:bg-gray-700 border border-primary/50 text-primary transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
            onMouseDown={() => handleMoveStart({ x: 1, y: 0, z: 0 })}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            <ArrowRight size={16} />
          </Button>
          
          <Button 
            size="sm" 
            variant={activeDirection?.x === 0 && activeDirection?.y === 0 && activeDirection?.z === 1 ? "default" : "outline"}
            className="rounded-full w-12 h-12 p-0 bg-gray-800 hover:bg-gray-700 border border-cyan-500/50 text-cyan-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30"
            onMouseDown={() => handleMoveStart({ x: 0, y: 0, z: 1 })}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            <Move3D size={16} />
          </Button>
        </div>
        
        {/* Rotation controls - inner circle */}
        <div className="relative w-20 h-20 rounded-full border-2 border-primary/50 flex items-center justify-center shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-300">
          <Button 
            size="sm" 
            variant={activeRotation === -1 ? "default" : "outline"}
            className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full w-6 h-6 p-0 bg-gray-800 hover:bg-gray-700 border border-primary/50 text-primary transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
            onMouseDown={() => handleRotateStart(-1)}
            onMouseUp={handleRotateEnd}
            onMouseLeave={handleRotateEnd}
          >
            <RotateCw size={12} className="rotate-180" />
          </Button>
          
          <Button 
            size="sm" 
            variant={activeRotation === 1 ? "default" : "outline"}
            className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rounded-full w-6 h-6 p-0 bg-gray-800 hover:bg-gray-700 border border-primary/50 text-primary transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
            onMouseDown={() => handleRotateStart(1)}
            onMouseUp={handleRotateEnd}
            onMouseLeave={handleRotateEnd}
          >
            <RotateCw size={12} />
          </Button>
          
          <div className="w-8 h-8 rounded-full bg-primary/50 flex items-center justify-center border border-primary/50 shadow-inner">
            <RotateCw size={16} className="text-primary" />
          </div>
        </div>
      </div>
    </Html>
  );
};

export default ThreeDMovementController;