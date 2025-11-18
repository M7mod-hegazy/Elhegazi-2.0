import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Info, Upload, Settings, Eye, CheckCircle, X } from 'lucide-react';

interface TabbedUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  categories: string[];
}

export function TabbedUploadModal({ open, onOpenChange, onSave, categories }: TabbedUploadModalProps) {
  const [currentTab, setCurrentTab] = useState('basic');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    description: '',
    category: '',
    format: 'glb' as 'glb' | 'gltf' | 'obj' | 'fbx',
    modelUrl: '',
    thumbnailUrl: '',
    fileSize: 0,
    tags: [] as string[],
    color: '#ffffff',
    material: '',
    dimensions: { width: 1, height: 1, depth: 1 },
    defaultScale: { x: 1, y: 1, z: 1 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    isActive: true,
    isPremium: false
  });
  const [tagInput, setTagInput] = useState('');

  const tabs = [
    { id: 'basic', label: 'معلومات أساسية', icon: Info },
    { id: 'upload', label: 'رفع الملف', icon: Upload },
    { id: 'properties', label: 'الخصائص', icon: Settings },
    { id: 'review', label: 'مراجعة', icon: Eye }
  ];

  const handleNext = () => {
    const currentIndex = tabs.findIndex(t => t.id === currentTab);
    if (currentIndex < tabs.length - 1) {
      setCurrentTab(tabs[currentIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    const currentIndex = tabs.findIndex(t => t.id === currentTab);
    if (currentIndex > 0) {
      setCurrentTab(tabs[currentIndex - 1].id);
    }
  };

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const handleFilesAccepted = (files: File[]) => {
    setUploadedFiles(files);
    if (files.length > 0) {
      setFormData({ ...formData, fileSize: files[0].size });
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({ ...formData, tags: formData.tags.filter((_, i) => i !== index) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>إضافة نموذج ثلاثي الأبعاد</DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Tab 1: Basic Information */}
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">الاسم (عربي) *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: كرسي مكتب"
                  />
                </div>
                <div>
                  <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                  <Input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="Example: Office Chair"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للنموذج..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الفئة *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>صيغة الملف *</Label>
                  <Select value={formData.format} onValueChange={(value: any) => setFormData({ ...formData, format: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glb">GLB</SelectItem>
                      <SelectItem value="gltf">GLTF</SelectItem>
                      <SelectItem value="obj">OBJ</SelectItem>
                      <SelectItem value="fbx">FBX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} />
                  <Label>نشط</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.isPremium} onCheckedChange={(checked) => setFormData({ ...formData, isPremium: checked })} />
                  <Label>مميز</Label>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: File Upload */}
            <TabsContent value="upload" className="space-y-4 mt-0">
              <FileDropzone
                onFilesAccepted={handleFilesAccepted}
                accept=".glb,.gltf,.obj,.fbx"
                maxSize={10485760}
                maxFiles={1}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modelUrl">أو أدخل رابط النموذج</Label>
                  <Input
                    id="modelUrl"
                    value={formData.modelUrl}
                    onChange={(e) => setFormData({ ...formData, modelUrl: e.target.value })}
                    placeholder="https://example.com/model.glb"
                  />
                </div>
                <div>
                  <Label htmlFor="thumbnailUrl">رابط الصورة المصغرة</Label>
                  <Input
                    id="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                    placeholder="https://example.com/thumbnail.jpg"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Properties */}
            <TabsContent value="properties" className="space-y-4 mt-0">
              <div>
                <Label>الوسوم (Tags)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="اضغط Enter للإضافة"
                  />
                  <Button type="button" onClick={addTag}>إضافة</Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(index)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>المادة</Label>
                  <Select value={formData.material} onValueChange={(value) => setFormData({ ...formData, material: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
                      <SelectItem value="خشب">خشب</SelectItem>
                      <SelectItem value="معدن">معدن</SelectItem>
                      <SelectItem value="زجاج">زجاج</SelectItem>
                      <SelectItem value="بلاستيك">بلاستيك</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>اللون</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-20 rounded border cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>الأبعاد (بالمتر)</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Input type="number" step="0.1" value={formData.dimensions.width} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, width: Number(e.target.value) } })} placeholder="العرض" />
                  <Input type="number" step="0.1" value={formData.dimensions.height} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, height: Number(e.target.value) } })} placeholder="الارتفاع" />
                  <Input type="number" step="0.1" value={formData.dimensions.depth} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, depth: Number(e.target.value) } })} placeholder="العمق" />
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Review */}
            <TabsContent value="review" className="space-y-4 mt-0">
              <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <h3 className="font-semibold">جاهز للحفظ!</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">الاسم:</p>
                    <p className="font-semibold">{formData.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">الفئة:</p>
                    <p className="font-semibold">{formData.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">الصيغة:</p>
                    <p className="font-semibold">{formData.format.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">الملفات:</p>
                    <p className="font-semibold">{uploadedFiles.length > 0 ? uploadedFiles[0].name : formData.modelUrl || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">الوسوم:</p>
                    <p className="font-semibold">{formData.tags.length} وسم</p>
                  </div>
                  <div>
                    <p className="text-slate-600">الحالة:</p>
                    <p className="font-semibold">{formData.isActive ? 'نشط' : 'غير نشط'}</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentTab === 'basic'}
            >
              السابق
            </Button>

            <div className="flex gap-2">
              {currentTab === 'review' ? (
                <Button onClick={handleSave} className="bg-primary">
                  حفظ النموذج
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  التالي
                </Button>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
