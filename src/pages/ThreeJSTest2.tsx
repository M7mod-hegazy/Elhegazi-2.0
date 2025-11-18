import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Mesh } from 'three';

const Box = () => {
  const meshRef = useRef<Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={'orange'} />
    </mesh>
  );
};

const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Box />
      <OrbitControls />
    </>
  );
};

const ThreeJSTest2 = () => {
  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Three.js Test 2</h1>
        <p className="text-gray-600">Testing if Three.js works with a simple rotating box</p>
      </div>
      <div className="flex-1">
        <Canvas>
          <Scene />
        </Canvas>
      </div>
    </div>
  );
};

export default ThreeJSTest2;