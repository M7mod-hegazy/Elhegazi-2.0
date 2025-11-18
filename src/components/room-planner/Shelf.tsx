import React from 'react';

type ShelfProps = {
  position: [number, number, number];
  dimensions: [number, number, number];
  isSelected?: boolean;
  onClick?: () => void;
  rotation?: [number, number, number];
};

const Shelf = ({ 
  position, 
  dimensions,
  isSelected,
  onClick,
  rotation
}: ShelfProps) => {
  return (
    <mesh 
      position={position} 
      rotation={rotation}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={dimensions} />
      <meshStandardMaterial 
        color={isSelected ? '#f59e0b' : '#d97706'} 
        roughness={0.7}
        metalness={0.1}
        emissive={isSelected ? '#f59e0b' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0.1}
        transparent={true}
        opacity={isSelected ? 0.8 : 1.0}
      />
    </mesh>
  );
};

export default Shelf;