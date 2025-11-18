import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const SimpleRoom = () => {
  // Room dimensions in meters
  const roomWidth = 4;   // 400 cm
  const roomHeight = 2.5; // 250 cm
  const roomDepth = 3;   // 300 cm
  
  // Wall thickness
  const wallThickness = 0.1;
  
  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Simple Room Test</h1>
      </div>
      <div className="flex-1 bg-gray-100">
        <Canvas>
          {/* Floor */}
          <mesh position={[0, -roomHeight/2, 0]}>
            <boxGeometry args={[roomWidth, wallThickness, roomDepth]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
          
          {/* Ceiling */}
          <mesh position={[0, roomHeight/2, 0]}>
            <boxGeometry args={[roomWidth, wallThickness, roomDepth]} />
            <meshStandardMaterial color="#f9fafb" />
          </mesh>
          
          {/* Left wall */}
          <mesh position={[-roomWidth/2, 0, 0]}>
            <boxGeometry args={[wallThickness, roomHeight, roomDepth]} />
            <meshStandardMaterial color="#f3f4f6" />
          </mesh>
          
          {/* Right wall */}
          <mesh position={[roomWidth/2, 0, 0]}>
            <boxGeometry args={[wallThickness, roomHeight, roomDepth]} />
            <meshStandardMaterial color="#f3f4f6" />
          </mesh>
          
          {/* Back wall */}
          <mesh position={[0, 0, -roomDepth/2]}>
            <boxGeometry args={[roomWidth, roomHeight, wallThickness]} />
            <meshStandardMaterial color="#f3f4f6" />
          </mesh>
          
          {/* Front wall */}
          <mesh position={[0, 0, roomDepth/2]}>
            <boxGeometry args={[roomWidth, roomHeight, wallThickness]} />
            <meshStandardMaterial color="#f3f4f6" />
          </mesh>
          
          {/* Ambient light */}
          <ambientLight intensity={0.5} />
          
          {/* Directional light */}
          <directionalLight position={[5, 5, 5]} intensity={1} />
          
          {/* Controls */}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default SimpleRoom;