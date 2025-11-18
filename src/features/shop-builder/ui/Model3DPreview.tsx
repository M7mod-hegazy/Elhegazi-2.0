import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

interface Model3DPreviewProps {
  modelUrl: string;
  thumbnailUrl?: string;
  className?: string;
  autoRotate?: boolean;
  showThumbnail?: boolean;
}

const Model3DPreview: React.FC<Model3DPreviewProps> = ({ 
  modelUrl, 
  thumbnailUrl,
  className = '',
  autoRotate = true,
  showThumbnail = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Setup camera - better angle for product viewing
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(2, 1.5, 2.5); // Slight angle for depth
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(300, 300);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    // Load model
    const fileExtension = modelUrl.split('.').pop()?.toLowerCase();
    
    const onLoad = (object: THREE.Group) => {
      // Calculate bounding box BEFORE any transformations
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Better scaling - not too big, not too small
      const scale = 1.8 / maxDim;
      
      // Create a wrapper group for proper centering
      const wrapper = new THREE.Group();
      wrapper.add(object);
      
      // Scale the object
      object.scale.multiplyScalar(scale);
      
      // Center the object at origin (0, 0, 0) - CRITICAL for proper centering
      object.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      );
      
      // Smart camera positioning - centered with slight angle
      const fittedSize = maxDim * scale;
      const distance = fittedSize * 1.8; // Closer view
      
      // Position camera with slight angle but centered on object
      camera.position.set(
        distance * 0.7,   // Slight right
        distance * 0.5,   // Slight above
        distance * 0.9    // Main distance
      );
      camera.lookAt(0, 0, 0); // Look at center (origin)
      camera.updateProjectionMatrix();
      
      scene.add(wrapper);
      modelRef.current = wrapper;
    };

    const onError = (error: unknown) => {
      console.error('Error loading 3D model:', error);
    };

    if (fileExtension === 'glb' || fileExtension === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => onLoad(gltf.scene), undefined, onError);
    } else if (fileExtension === 'obj') {
      const loader = new OBJLoader();
      loader.load(modelUrl, onLoad, undefined, onError);
    } else if (fileExtension === 'fbx') {
      const loader = new FBXLoader();
      loader.load(modelUrl, onLoad, undefined, onError);
    }

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      if (autoRotate && modelRef.current) {
        modelRef.current.rotation.y += 0.003; // Very slow, smooth rotation
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [modelUrl, autoRotate]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      {/* Thumbnail overlay in bottom-left */}
      {showThumbnail && thumbnailUrl && (
        <div className="absolute bottom-2 left-2 w-16 h-16 rounded border-2 border-white shadow-lg overflow-hidden bg-white">
          <img
            src={thumbnailUrl}
            alt="Thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
};

export default Model3DPreview;
