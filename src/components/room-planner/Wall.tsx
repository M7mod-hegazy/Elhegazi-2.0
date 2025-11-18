import React from 'react';
import { useThree } from '@react-three/fiber';

type WallProps = {
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation: [number, number, number];
  texture: string;
  isSelected?: boolean;
  onClick?: () => void;
  isFloor?: boolean;
  usedArea?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
};

const Wall = ({ 
  position, 
  dimensions,
  rotation,
  texture,
  isSelected,
  onClick,
  isFloor = false,
  usedArea
}: WallProps) => {
  // Texture mapping with more realistic colors and materials
  const getWallMaterial = () => {
    switch (texture) {
      case 'wood':
        return { color: isSelected ? '#f59e0b' : '#8B4513', roughness: 0.9, metalness: 0.1 }; // Brown wood
      case 'brick':
        return { color: isSelected ? '#ef4444' : '#B22222', roughness: 0.8, metalness: 0.05 }; // Red brick
      case 'concrete':
        return { color: isSelected ? '#9ca3af' : '#696969', roughness: 0.7, metalness: 0.2 }; // Concrete gray
      case 'tile':
        return { color: isSelected ? '#3b82f6' : '#4682B4', roughness: 0.4, metalness: 0.3 }; // Blue tile
      case 'marble':
        return { color: isSelected ? '#f9fafb' : '#F5F5F5', roughness: 0.2, metalness: 0.8 }; // White marble
      default:
        // Default: blue walls; floor handled below
        return { color: isSelected ? '#2563eb' : '#3b82f6', roughness: 0.6, metalness: 0.15 }; // Blue
    }
  };
  
  const materialProps = getWallMaterial();
  
  // Ensure geometry dimensions are always valid (no zeros/negatives)
  const safeDims: [number, number, number] = [
    Math.max(0.001, Math.abs(dimensions[0] ?? 0.001)),
    Math.max(0.001, Math.abs(dimensions[1] ?? 0.001)),
    Math.max(0.001, Math.abs(dimensions[2] ?? 0.001)),
  ];

  // For floor, we might want to show used/unused areas differently
  if (isFloor && usedArea) {
    // This is a simplified approach - in a real implementation, you might want to use a shader
    // or multiple meshes to show the used/unused areas
    return (
      <group>
        {/* Full floor */}
        <mesh 
          position={position} 
          rotation={rotation}
          onClick={onClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'not-allowed';
          }}
        >
          <boxGeometry args={safeDims} />
          <meshStandardMaterial 
            color="#9ca3af" // Gray floor
            roughness={0.85}
            metalness={0.05}
            emissive="#9ca3af"
            emissiveIntensity={0.05}
          />
        </mesh>
        
        {/* Used area overlay */}
        <mesh 
          position={[
            (usedArea.minX + usedArea.maxX) / 2 / 100,
            position[1] + 0.01, // Slightly above the floor to avoid z-fighting
            (usedArea.minZ + usedArea.maxZ) / 2 / 100
          ]}
          rotation={rotation}
        >
          <boxGeometry args={[
            (usedArea.maxX - usedArea.minX) / 100,
            0.01,
            (usedArea.maxZ - usedArea.minZ) / 100
          ]} />
          <meshStandardMaterial 
            color="#6b7280" // Darker gray for used area
            roughness={0.8}
            metalness={0.1}
            transparent={true}
            opacity={0.6}
            emissive="#6b7280"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>
    );
  }
  
  return (
    <mesh 
      position={position} 
      rotation={rotation}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = isFloor ? 'not-allowed' : 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={dimensions} />
      <meshStandardMaterial 
        color={materialProps.color} 
        roughness={materialProps.roughness}
        metalness={materialProps.metalness}
        emissive={isSelected ? materialProps.color : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0.1}
        transparent={true}
        opacity={isSelected ? 0.7 : 1.0}
      />
    </mesh>
  );
};

export default Wall;