import React from 'react';

type ColumnProps = {
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation: [number, number, number];
  isSelected?: boolean;
  onClick?: () => void;
};

const Column = ({ 
  position, 
  dimensions,
  rotation,
  isSelected,
  onClick
}: ColumnProps) => {
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
        color={isSelected ? '#8b5cf6' : '#7e22ce'} 
        roughness={0.6}
        metalness={0.2}
        emissive={isSelected ? '#8b5cf6' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0.1}
        transparent={true}
        opacity={isSelected ? 0.8 : 1.0}
      />
    </mesh>
  );
};

export default Column;
