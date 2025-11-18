import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, RotateCcw, Save } from 'lucide-react';

interface PNG3DConverterProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (modelData: {
    name: string;
    modelUrl: string;
    thumbnailUrl: string;
    fileSize: number;
  }) => void;
}

export const PNG3DConverter: React.FC<PNG3DConverterProps> = ({ isOpen, onClose, onSave }) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const meshRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  
  const [depth, setDepth] = useState(0.2);
  const [lightIntensity, setLightIntensity] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [THREE, setTHREE] = useState<any>(null);
  const [OrbitControlsClass, setOrbitControlsClass] = useState<any>(null);
  const [GLTFExporter, setGLTFExporter] = useState<any>(null);

  // Load Three.js dynamically
  useEffect(() => {
    if (!isOpen) return;

    const loadThreeJS = async () => {
      try {
        // Load Three.js core
        const threeModule = await import('three');
        setTHREE(threeModule);

        // Load OrbitControls
        const orbitControlsModule = await import('three/examples/jsm/controls/OrbitControls.js');
        setOrbitControlsClass(() => orbitControlsModule.OrbitControls);
        
        // Load GLTFExporter
        const exporterModule = await import('three/examples/jsm/exporters/GLTFExporter.js');
        setGLTFExporter(() => exporterModule.GLTFExporter);
      } catch (error) {
        console.error('Error loading Three.js:', error);
        toast({
          title: 'خطأ',
          description: 'فشل تحميل مكتبة Three.js',
          variant: 'destructive'
        });
      }
    };

    loadThreeJS();
  }, [isOpen, toast]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !THREE || !OrbitControlsClass) return;

    const container = canvasRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.5);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControlsClass(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(hemisphereLight);

    // Floor plane with reflection
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      metalness: 0.8,
      roughness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [isOpen, THREE, OrbitControlsClass, lightIntensity]);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'خطأ',
        description: 'الرجاء اختيار صورة PNG',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setUploadedImage(imageUrl);
      setModelName(file.name.replace(/\.[^/.]+$/, ''));
      createMeshFromImage(imageUrl);
    };
    reader.readAsDataURL(file);
  };

  // Create 3D mesh from image
  const createMeshFromImage = (imageUrl: string) => {
    if (!THREE || !sceneRef.current) return;

    // Remove existing mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      meshRef.current.material.dispose();
    }

    // Load texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
      // Get image aspect ratio
      const img = texture.image;
      const aspectRatio = img.width / img.height;

      // Create geometry with proper aspect ratio
      const width = aspectRatio > 1 ? 1 : aspectRatio;
      const height = aspectRatio > 1 ? 1 / aspectRatio : 1;
      
      const geometry = new THREE.BoxGeometry(width, height, depth);

      // Create material with texture
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.2,
        roughness: 0.4,
        side: THREE.DoubleSide,
      });

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sceneRef.current.add(mesh);
      meshRef.current = mesh;

      toast({
        title: 'نجح',
        description: 'تم إنشاء النموذج ثلاثي الأبعاد بنجاح',
      });
    });
  };

  // Update depth
  useEffect(() => {
    if (!meshRef.current || !THREE) return;
    
    const mesh = meshRef.current;
    const oldGeometry = mesh.geometry;
    
    // Get current dimensions
    const width = oldGeometry.parameters.width;
    const height = oldGeometry.parameters.height;
    
    // Create new geometry with updated depth
    const newGeometry = new THREE.BoxGeometry(width, height, depth);
    mesh.geometry = newGeometry;
    oldGeometry.dispose();
  }, [depth, THREE]);

  // Update light intensity
  useEffect(() => {
    if (!sceneRef.current) return;
    
    const directionalLight = sceneRef.current.children.find(
      (child: any) => child.type === 'DirectionalLight'
    );
    
    if (directionalLight) {
      directionalLight.intensity = lightIntensity;
    }
  }, [lightIntensity]);

  // Reset view
  const handleResetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    cameraRef.current.position.set(0, 0, 2.5);
    controlsRef.current.reset();
    
    toast({
      title: 'تم',
      description: 'تم إعادة تعيين العرض',
    });
  };

  // Export as GLB
  const handleExportGLB = async () => {
    if (!meshRef.current || !GLTFExporter) {
      toast({
        title: 'خطأ',
        description: 'لا يوجد نموذج للتصدير',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);

    try {
      const exporter = new GLTFExporter();
      
      exporter.parse(
        meshRef.current,
        (gltf: any) => {
          const blob = new Blob([gltf], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${modelName || 'model'}.glb`;
          link.click();
          URL.revokeObjectURL(url);

          toast({
            title: 'نجح',
            description: 'تم تصدير النموذج بنجاح',
          });
          setIsExporting(false);
        },
        (error: any) => {
          console.error('Export error:', error);
          toast({
            title: 'خطأ',
            description: 'فشل تصدير النموذج',
            variant: 'destructive'
          });
          setIsExporting(false);
        },
        { binary: true }
      );
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تصدير النموذج',
        variant: 'destructive'
      });
      setIsExporting(false);
    }
  };

  // Save to products database
  const handleSaveToDatabase = async () => {
    if (!meshRef.current || !uploadedImage) {
      toast({
        title: 'خطأ',
        description: 'لا يوجد نموذج للحفظ',
        variant: 'destructive'
      });
      return;
    }

    if (!modelName.trim()) {
      toast({
        title: 'خطأ',
        description: 'الرجاء إدخال اسم النموذج',
        variant: 'destructive'
      });
      return;
    }

    // Export GLB first, then save
    setIsExporting(true);

    try {
      const exporter = new GLTFExporter();
      
      exporter.parse(
        meshRef.current,
        async (gltf: any) => {
          const blob = new Blob([gltf], { type: 'application/octet-stream' });
          
          // Create FormData for upload
          const formData = new FormData();
          formData.append('file', blob, `${modelName}.glb`);
          formData.append('type', '3d-model');

          try {
            // Upload GLB file
            const uploadResponse = await fetch('/api/upload-3d-model', {
              method: 'POST',
              body: formData
            });

            if (!uploadResponse.ok) throw new Error('Upload failed');

            const uploadData = await uploadResponse.json();

            // Call onSave callback with model data
            if (onSave) {
              onSave({
                name: modelName,
                modelUrl: uploadData.url || uploadData.fileUrl,
                thumbnailUrl: uploadedImage,
                fileSize: blob.size
              });
            }

            toast({
              title: 'نجح',
              description: 'تم حفظ النموذج بنجاح',
            });

            setIsExporting(false);
            onClose();
          } catch (error) {
            console.error('Save error:', error);
            toast({
              title: 'خطأ',
              description: 'فشل حفظ النموذج',
              variant: 'destructive'
            });
            setIsExporting(false);
          }
        },
        (error: any) => {
          console.error('Export error:', error);
          toast({
            title: 'خطأ',
            description: 'فشل تصدير النموذج',
            variant: 'destructive'
          });
          setIsExporting(false);
        },
        { binary: true }
      );
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تصدير النموذج',
        variant: 'destructive'
      });
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            🎨 محول PNG إلى 3D
          </DialogTitle>
          <p className="text-sm text-slate-600">
            قم برفع صورة PNG شفافة وحولها إلى نموذج ثلاثي الأبعاد تفاعلي
          </p>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
          {/* Controls Panel */}
          <div className="space-y-4 overflow-y-auto p-4 bg-slate-50 rounded-lg">
            <div>
              <Label htmlFor="image-upload" className="text-base font-semibold mb-2 block">
                📤 رفع الصورة
              </Label>
              <div className="relative">
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleImageUpload}
                  className="cursor-pointer"
                />
                <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
              {uploadedImage && (
                <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                  <img src={uploadedImage} alt="Preview" className="w-full h-24 object-contain" />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="model-name" className="text-base font-semibold mb-2 block">
                📝 اسم النموذج
              </Label>
              <Input
                id="model-name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="أدخل اسم النموذج"
              />
            </div>

            <div>
              <Label className="text-base font-semibold mb-2 block">
                📏 العمق: {depth.toFixed(2)}
              </Label>
              <Slider
                value={[depth]}
                onValueChange={(value) => setDepth(value[0])}
                min={0.01}
                max={0.5}
                step={0.01}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-base font-semibold mb-2 block">
                💡 شدة الإضاءة: {lightIntensity.toFixed(1)}
              </Label>
              <Slider
                value={[lightIntensity]}
                onValueChange={(value) => setLightIntensity(value[0])}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="pt-4 space-y-2">
              <Button
                onClick={handleResetView}
                variant="outline"
                className="w-full"
                disabled={!uploadedImage}
              >
                <RotateCcw className="h-4 w-4 ml-2" />
                إعادة تعيين العرض
              </Button>

              <Button
                onClick={handleExportGLB}
                variant="outline"
                className="w-full"
                disabled={!uploadedImage || isExporting}
              >
                <Download className="h-4 w-4 ml-2" />
                {isExporting ? 'جاري التصدير...' : 'تصدير GLB'}
              </Button>

              {onSave && (
                <Button
                  onClick={handleSaveToDatabase}
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!uploadedImage || isExporting}
                >
                  <Save className="h-4 w-4 ml-2" />
                  {isExporting ? 'جاري الحفظ...' : 'حفظ في قاعدة البيانات'}
                </Button>
              )}
            </div>

            <div className="text-xs text-slate-500 space-y-1 pt-4 border-t">
              <p>💡 <strong>نصائح:</strong></p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                <li>استخدم صور PNG بخلفية شفافة للحصول على أفضل النتائج</li>
                <li>اسحب بالماوس للدوران حول النموذج</li>
                <li>استخدم عجلة الماوس للتكبير والتصغير</li>
                <li>انقر بزر الماوس الأيمن للتحريك</li>
              </ul>
            </div>
          </div>

          {/* 3D Canvas */}
          <div className="lg:col-span-2 relative">
            <div
              ref={canvasRef}
              className="w-full h-full rounded-lg overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800"
            />
            {!uploadedImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-lg">
                <div className="text-center text-white p-8">
                  <Upload className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-semibold mb-2">قم برفع صورة PNG</p>
                  <p className="text-sm opacity-75">لبدء إنشاء النموذج ثلاثي الأبعاد</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
