import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ApiHttpError, apiDelete, apiGet, apiPatchJson, apiPostJson } from '@/lib/api';
import ImageUpload from '@/components/ui/image-upload';
import { optimizeImage } from '@/lib/imageOptimization';
import { cn } from '@/lib/utils';
import { FileImage, Images, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

type MediaRow = { url: string; type: 'image' | 'video'; order: number; publicId?: string };
type PostRow = {
  _id: string;
  titleAr?: string;
  bodyAr?: string;
  media?: MediaRow[];
  published?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

const emptyForm = (): { titleAr: string; bodyAr: string; published: boolean; sortOrder: string; media: MediaRow[] } => ({
  titleAr: '',
  bodyAr: '',
  published: true,
  sortOrder: '0',
  media: [],
});

const AdminPortfolioWork = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = (await apiGet<unknown>(
        `/api/admin/portfolio-posts?page=${p}&limit=24`
      )) as { ok: boolean; items?: PostRow[]; totalPages?: number };
      if (!data.ok) throw new Error('فشل التحميل');
      setPosts(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setPage(p);
    } catch (e) {
      const description =
        e instanceof ApiHttpError && e.status === 403
          ? 'تعذر التحقق من صلاحية المدير. تأكد أن الحساب مسجّل في قاعدة البيانات وأن البريد/المعرّف يُرسل مع الطلب.'
          : e instanceof Error
            ? e.message
            : 'تعذر تحميل المنشورات';
      toast({ title: 'خطأ', description, variant: 'destructive' });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(1);
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: PostRow) => {
    setEditingId(row._id);
    const m = [...(row.media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setForm({
      titleAr: row.titleAr || '',
      bodyAr: row.bodyAr || '',
      published: row.published !== false,
      sortOrder: String(row.sortOrder ?? 0),
      media: m.map((x, i) => ({ ...x, order: i })),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        titleAr: form.titleAr.trim(),
        bodyAr: form.bodyAr.trim(),
        published: form.published,
        sortOrder: Number(form.sortOrder) || 0,
        media: form.media.map((m, i) => ({
          url: m.url,
          type: m.type,
          order: i,
          publicId: m.publicId || '',
        })),
      };
      if (editingId) {
        const res = await apiPatchJson<{ _id: string }>(`/api/admin/portfolio-posts/${editingId}`, payload);
        if (!res.ok) throw new Error('فشل الحفظ');
      } else {
        const res = await apiPostJson<{ _id: string }>('/api/admin/portfolio-posts', payload);
        if (!res.ok) throw new Error('فشل الإنشاء');
      }
      toast({ title: 'تم الحفظ' });
      setDialogOpen(false);
      void load(page);
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل الحفظ',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removePost = async (id: string) => {
    if (!confirm('حذف هذا المنشور نهائياً؟')) return;
    try {
      const res = await apiDelete(`/api/admin/portfolio-posts/${id}`);
      if (!res.ok) throw new Error('فشل الحذف');
      toast({ title: 'تم الحذف' });
      void load(page);
    } catch {
      toast({ title: 'فشل الحذف', variant: 'destructive' });
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Images className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">أعمالنا السابقة</h1>
              <p className="text-sm text-slate-500">منشورات بصور وفيديو — تظهر للزوار في صفحة /portfolio</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-primary to-secondary">
            <Plus className="h-4 w-4" />
            منشور جديد
          </Button>
        </div>

        <Card className="border-slate-200/80 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-primary/5 border-b">
            <CardTitle className="text-lg">المنشورات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <p className="text-center text-slate-500 py-16">لا توجد منشورات بعد.</p>
            ) : (
              <ul className="divide-y">
                {posts.map((row) => {
                  const cover = [...(row.media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
                  return (
                    <li key={row._id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors">
                      <div className="h-20 w-28 shrink-0 rounded-xl overflow-hidden bg-slate-100 border">
                        {cover?.type === 'video' ? (
                          <video src={cover.url} className="h-full w-full object-cover" muted />
                        ) : cover ? (
                          <img src={optimizeImage(cover.url, { w: 200 })} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <Images className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-slate-900 truncate">{row.titleAr || 'بدون عنوان'}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{row.bodyAr || '—'}</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 font-semibold',
                              row.published ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            )}
                          >
                            {row.published ? 'منشور' : 'مسودة'}
                          </span>
                          <span className="text-slate-400">{(row.media || []).length} وسائط</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                          تعديل
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void removePost(row._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 ? (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              السابق
            </Button>
            <span className="text-sm text-slate-600 self-center px-2">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
              التالي
            </Button>
          </div>
        ) : null}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'تعديل منشور' : 'منشور جديد'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>العنوان</Label>
                <Input value={form.titleAr} onChange={(e) => setForm((p) => ({ ...p, titleAr: e.target.value }))} dir="auto" />
              </div>
              <div className="space-y-2">
                <Label>النص</Label>
                <Textarea
                  value={form.bodyAr}
                  onChange={(e) => setForm((p) => ({ ...p, bodyAr: e.target.value }))}
                  rows={4}
                  dir="auto"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الأولوية (رقم أكبر = أعلى في القائمة)</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  />
                </div>
                <div className="flex items-end justify-between rounded-lg border p-3">
                  <Label>منشور</Label>
                  <Switch checked={form.published} onCheckedChange={(c) => setForm((p) => ({ ...p, published: c }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileImage className="h-3.5 w-3.5 text-green-600" />
                  وسائط (صور أو فيديو)
                </Label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <ImageUpload
                    key={editingId || 'new-post'}
                    onMediaItemsChange={(items) =>
                      setForm((p) => ({
                        ...p,
                        media: items.map((it, i) => ({
                          url: it.url,
                          type: it.type,
                          order: i,
                          publicId: it.publicId,
                        })),
                      }))
                    }
                    initialMedia={form.media.map((x) => ({
                      url: x.url,
                      type: x.type,
                      publicId: x.publicId,
                    }))}
                    allowVideo
                    cloudinaryFolder="portfolio-work"
                    maxImages={20}
                    multiple
                    maxSizeKB={500}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  نفس تجربة رفع المنتجات (ملف + استيراد من رابط). الفيديو: رفع مباشر أو رابط خارجي؛ استيراد Cloudinary للصور
                  فقط.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={() => void save()} disabled={saving || !form.media.length}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                </Button>
              </div>
              {!form.media.length ? (
                <p className="text-xs text-amber-700">أضف وسيطاً واحداً على الأقل قبل الحفظ.</p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPortfolioWork;
