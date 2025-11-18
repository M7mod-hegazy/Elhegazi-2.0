import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical, Save, X, Palette, Image as ImageIcon, Download, Upload, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Category3D {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  order: number;
}

const DEFAULT_CATEGORIES: Category3D[] = [
  { id: '1', name: 'أثاث', nameEn: 'Furniture', icon: '🪑', color: '#3b82f6', order: 0 },
  { id: '2', name: 'أجهزة', nameEn: 'Appliances', icon: '🔌', color: '#10b981', order: 1 },
  { id: '3', name: 'إضاءة', nameEn: 'Lighting', icon: '💡', color: '#f59e0b', order: 2 },
  { id: '4', name: 'ديكور', nameEn: 'Decoration', icon: '🎨', color: '#ec4899', order: 3 },
  { id: '5', name: 'تخزين', nameEn: 'Storage', icon: '📦', color: '#8b5cf6', order: 4 },
  { id: '6', name: 'معمارية', nameEn: 'Architectural', icon: '🚪', color: '#6366f1', order: 5 },
  { id: '7', name: 'معدات متجر', nameEn: 'Store Equipment', icon: '🛒', color: '#14b8a6', order: 6 },
];

// Sortable item component
function SortableItem({ category, onEdit, onDelete }: { category: Category3D; onEdit: (cat: Category3D) => void; onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-slate-400" />
      </div>

      <div className="flex items-center gap-3 flex-1">
        <div 
          className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{category.name}</p>
          <p className="text-sm text-slate-600">{category.nameEn}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge 
          className="text-white" 
          style={{ backgroundColor: category.color }}
        >
          {category.color}
        </Badge>
        <Button size="sm" variant="outline" onClick={() => onEdit(category)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(category.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Models3DCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category3D[]>(DEFAULT_CATEGORIES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category3D | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    icon: '',
    color: '#3b82f6'
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load categories from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('3d-categories');
    if (saved) {
      try {
        setCategories(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    }
  }, []);

  // Save categories to localStorage
  const saveCategories = (cats: Category3D[]) => {
    localStorage.setItem('3d-categories', JSON.stringify(cats));
    setCategories(cats);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nameEn: '',
      icon: '',
      color: '#3b82f6'
    });
  };

  const handleAdd = () => {
    if (!formData.name || !formData.nameEn) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    const newCategory: Category3D = {
      id: Date.now().toString(),
      name: formData.name,
      nameEn: formData.nameEn,
      icon: formData.icon || '📁',
      color: formData.color,
      order: categories.length
    };

    saveCategories([...categories, newCategory]);
    toast({ title: 'نجح', description: 'تم إضافة الفئة بنجاح' });
    setIsAddModalOpen(false);
    resetForm();
  };

  const handleEdit = () => {
    if (!selectedCategory) return;
    if (!formData.name || !formData.nameEn) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    const updated = categories.map(cat =>
      cat.id === selectedCategory.id
        ? { ...cat, name: formData.name, nameEn: formData.nameEn, icon: formData.icon, color: formData.color }
        : cat
    );

    saveCategories(updated);
    toast({ title: 'نجح', description: 'تم تحديث الفئة بنجاح' });
    setIsEditModalOpen(false);
    setSelectedCategory(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) return;

    const updated = categories.filter(cat => cat.id !== id);
    saveCategories(updated);
    toast({ title: 'نجح', description: 'تم حذف الفئة بنجاح' });
  };

  const openEditModal = (category: Category3D) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      nameEn: category.nameEn,
      icon: category.icon,
      color: category.color
    });
    setIsEditModalOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(cat => cat.id === active.id);
      const newIndex = categories.findIndex(cat => cat.id === over.id);

      const reordered = arrayMove(categories, oldIndex, newIndex);
      const updated = reordered.map((item, index) => ({ ...item, order: index }));
      saveCategories(updated);
      toast({ title: 'نجح', description: 'تم إعادة ترتيب الفئات' });
    }
  };

  // Export categories to JSON
  const handleExport = () => {
    const dataStr = JSON.stringify(categories, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `3d-categories-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'نجح', description: 'تم تصدير الفئات بنجاح' });
  };

  // Import categories from JSON
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          saveCategories(imported);
          toast({ title: 'نجح', description: `تم استيراد ${imported.length} فئة` });
        } else {
          toast({ title: 'خطأ', description: 'صيغة الملف غير صحيحة', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'خطأ', description: 'فشل قراءة الملف', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الفئات إلى الافتراضية؟')) {
      saveCategories(DEFAULT_CATEGORIES);
      toast({ title: 'نجح', description: 'تم إعادة تعيين الفئات' });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">فئات النماذج ثلاثية الأبعاد</h1>
            <p className="text-slate-600 mt-1">إدارة فئات النماذج وترتيبها</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 ml-2" />
              تصدير
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 ml-2" />
                  استيراد
                </span>
              </Button>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <Button variant="outline" onClick={handleResetToDefaults}>
              <X className="h-4 w-4 ml-2" />
              إعادة تعيين
            </Button>
            <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 ml-2" />
              إضافة فئة
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">إجمالي الفئات</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{categories.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Categories List */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">الفئات (اسحب لإعادة الترتيب)</h2>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map(cat => cat.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {categories.map((category) => (
                  <SortableItem
                    key={category.id}
                    category={category}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Add/Edit Modal */}
        <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
          setIsAddModalOpen(open);
          setIsEditModalOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditModalOpen ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
              <DialogDescription>
                {isEditModalOpen ? 'تعديل بيانات الفئة' : 'إضافة فئة جديدة للنماذج ثلاثية الأبعاد'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">الاسم (عربي) *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أثاث"
                />
              </div>

              <div>
                <Label htmlFor="nameEn">الاسم (إنجليزي) *</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Example: Furniture"
                />
              </div>

              <div>
                <Label htmlFor="icon">الأيقونة (Emoji)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🪑"
                  className="text-2xl"
                />
                <p className="text-xs text-slate-500 mt-1">
                  يمكنك نسخ emoji من <a href="https://emojipedia.org" target="_blank" className="text-primary underline">Emojipedia</a>
                </p>
              </div>

              <div>
                <Label htmlFor="color">اللون</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
                resetForm();
              }}>
                إلغاء
              </Button>
              <Button onClick={isEditModalOpen ? handleEdit : handleAdd}>
                {isEditModalOpen ? 'تحديث' : 'إضافة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
