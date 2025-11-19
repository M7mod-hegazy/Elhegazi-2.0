import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const MinimalThreeJS = () => {
  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Minimal Three.js Test</h1>
      </div>
      <div className="flex-1 bg-gray-100">
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
          </mesh>
          <OrbitControls />
        </Canvas>
      </div>
    </div>
  );
};

export default MinimalThreeJS;
