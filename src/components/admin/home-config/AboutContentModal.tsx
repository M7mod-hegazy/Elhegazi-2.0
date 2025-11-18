import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import ImageUpload from '@/components/ui/image-upload';

interface AboutContent {
  title?: string;
  description?: string;
  image?: string;
  stats?: {
    customers?: string;
    products?: string;
  };
  vision?: string;
  mission?: string;
}

interface AboutContentModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: AboutContent;
  onSave: (data: AboutContent) => void | Promise<void>;
}

const AboutContentModal = ({ open, onClose, initialData, onSave }: AboutContentModalProps) => {
  const [formData, setFormData] = useState<AboutContent>({
    title: '',
    description: '',
    image: '',
    stats: {
      customers: '',
      products: '',
    },
    vision: '',
    mission: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData && open) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        image: initialData.image || '',
        stats: {
          customers: initialData.stats?.customers || '',
          products: initialData.stats?.products || '',
        },
        vision: initialData.vision || '',
        mission: initialData.mission || '',
      });
    }
  }, [initialData, open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Remove empty fields but keep all data
      const cleanedData: AboutContent = {};
      
      if (formData.title?.trim()) cleanedData.title = formData.title.trim();
      if (formData.description?.trim()) cleanedData.description = formData.description.trim();
      if (formData.image?.trim()) cleanedData.image = formData.image.trim();
      
      // Always include vision and mission (even if empty, to allow clearing)
      cleanedData.vision = formData.vision?.trim() || '';
      cleanedData.mission = formData.mission?.trim() || '';
      
      if (formData.stats?.customers?.trim() || formData.stats?.products?.trim()) {
        cleanedData.stats = {};
        if (formData.stats.customers?.trim()) cleanedData.stats.customers = formData.stats.customers.trim();
        if (formData.stats.products?.trim()) cleanedData.stats.products = formData.stats.products.trim();
      }

      await onSave(cleanedData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagesChange = (images: string[]) => {
    setFormData(prev => ({ ...prev, image: images[0] || '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Info className="w-6 h-6 text-primary" />
            إعدادات صفحة من نحن
          </DialogTitle>
          <DialogDescription>
            قم بتخصيص محتوى صفحة "من نحن". اترك الحقول فارغة لإخفاء الأقسام المقابلة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Hero Section */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">قسم البطل (Hero)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="title">العنوان الرئيسي</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="من نحن؟"
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">سيظهر في أعلى الصفحة</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="شركة رائدة في التجارة الإلكترونية..."
                  rows={3}
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">وصف مختصر عن الشركة</p>
              </div>

              <div className="space-y-2">
                <Label>صورة الخلفية</Label>
                <ImageUpload
                  onImagesChange={handleImagesChange}
                  initialImages={formData.image ? [formData.image] : []}
                  maxImages={1}
                  multiple={false}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">صورة خلفية قسم البطل (يفضل 1920x600)</p>
              </div>
            </CardContent>
          </Card>

          {/* Stats Section */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">الإحصائيات</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customers">عدد العملاء</Label>
                  <Input
                    id="customers"
                    value={formData.stats?.customers || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      stats: { ...prev.stats, customers: e.target.value }
                    }))}
                    placeholder="1000+"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">مثال: 1000+ أو 5000</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="products">عدد المنتجات</Label>
                  <Input
                    id="products"
                    value={formData.stats?.products || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      stats: { ...prev.stats, products: e.target.value }
                    }))}
                    placeholder="500+"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">مثال: 500+ أو 2000</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                💡 إذا تركت كلا الحقلين فارغين، سيتم إخفاء قسم الإحصائيات بالكامل
              </p>
            </CardContent>
          </Card>

          {/* Vision & Mission */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">الرؤية والرسالة</h3>
              
              <div className="space-y-2">
                <Label htmlFor="vision">رؤيتنا</Label>
                <Textarea
                  id="vision"
                  value={formData.vision || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, vision: e.target.value }))}
                  placeholder="أن نكون الشركة الرائدة في..."
                  rows={3}
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">اترك فارغاً لإخفاء قسم الرؤية</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mission">رسالتنا</Label>
                <Textarea
                  id="mission"
                  value={formData.mission || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, mission: e.target.value }))}
                  placeholder="نسعى لتوفير..."
                  rows={3}
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">اترك فارغاً لإخفاء قسم الرسالة</p>
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-primary">ملاحظات هامة:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>الحقول الفارغة لن تظهر في الصفحة</li>
                  <li>الصور يتم رفعها تلقائياً إلى Cloudinary</li>
                  <li>التغييرات تحفظ في قاعدة البيانات MongoDB</li>
                  <li>يمكنك التحديث في أي وقت</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90" disabled={isSaving}>
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutContentModal;
