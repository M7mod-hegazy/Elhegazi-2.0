import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useBuilderProjectActions, useBuilderProjectsList, type BuilderProjectCard } from '@/hooks/useBuilderProjects';
import { useDualAuth } from '@/hooks/useDualAuth';
import {
  ArrowLeft,
  Download,
  FolderPlus,
  Loader2,
  Search,
  Trash2,
  Undo2,
  Upload,
  Sparkles,
  LayoutGrid,
  Clock3,
  AlertTriangle,
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'updated_desc', label: 'آخر تعديل' },
  { value: 'created_desc', label: 'الأحدث إنشاءً' },
  { value: 'name_asc', label: 'الاسم (أ-ي)' },
  { value: 'last_opened_desc', label: 'آخر فتح' },
];

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ShopBuilderProjects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, adminUser, user } = useDualAuth();
  const actions = useBuilderProjectActions();
  const fileImportRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [sort, setSort] = useState('updated_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [entryAnimationProject, setEntryAnimationProject] = useState<BuilderProjectCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuilderProjectCard | null>(null);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<BuilderProjectCard | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [restoringIds, setRestoringIds] = useState<Record<string, boolean>>({});
  const [forceDeletingIds, setForceDeletingIds] = useState<Record<string, boolean>>({});
  const [openingIds, setOpeningIds] = useState<Record<string, boolean>>({});
  const [exportingIds, setExportingIds] = useState<Record<string, boolean>>({});
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [importedPreviewCards, setImportedPreviewCards] = useState<BuilderProjectCard[]>([]);

  const canUseAdminMode = isAdmin || adminUser?.role === 'admin';
  const useAdminMode = canUseAdminMode && showAllUsers;
  const profileUser = adminUser || user;
  const profileEmail = profileUser?.email || '-';
  const profileType = profileUser?.role === 'admin' ? 'مدير' : profileUser?.role === 'customer' ? 'عميل' : '-';

  const list = useBuilderProjectsList({
    q,
    deleted,
    sort,
    page,
    limit,
    allUsers: useAdminMode,
    owner: useAdminMode && ownerFilter.trim() ? ownerFilter.trim() : undefined,
  });

  const listItemsWithImported = useMemo(() => {
    const base = list.data?.items || [];
    if (deleted) return base;
    const baseIds = new Set(base.map((item) => item._id));
    const injected = importedPreviewCards.filter((item) => !baseIds.has(item._id));
    return [...injected, ...base];
  }, [deleted, importedPreviewCards, list.data?.items]);

  const stats = useMemo(() => {
    const base = list.data?.items || [];
    const baseIds = new Set(base.map((item) => item._id));
    const injectedCount = deleted
      ? 0
      : importedPreviewCards.filter((item) => !baseIds.has(item._id)).length;
    const items = listItemsWithImported;
    return {
      projects: (list.data?.total || 0) + injectedCount,
      walls: items.reduce((sum, p) => sum + Number(p.stats?.wallsCount || 0), 0),
      products: items.reduce((sum, p) => sum + Number(p.stats?.productsCount || 0), 0),
    };
  }, [deleted, importedPreviewCards, list.data, listItemsWithImported]);

  const activeOpsCount =
    Object.keys(deletingIds).length +
    Object.keys(restoringIds).length +
    Object.keys(forceDeletingIds).length +
    Object.keys(openingIds).length +
    Object.keys(exportingIds).length;
  const visibleItems = useMemo(
    () => listItemsWithImported.filter((project) => !hiddenIds[project._id]),
    [hiddenIds, listItemsWithImported],
  );

  useEffect(() => {
    setHiddenIds({});
  }, [deleted, q, sort, page, useAdminMode, ownerFilter]);

  useEffect(() => {
    if (deleted) {
      setImportedPreviewCards([]);
      return;
    }
    const ids = new Set((list.data?.items || []).map((item) => item._id));
    if (ids.size === 0) return;
    setImportedPreviewCards((prev) => prev.filter((item) => !ids.has(item._id)));
  }, [deleted, list.data?.items]);

  const handleRestore = async (projectId: string) => {
    if (restoringIds[projectId]) return;
    setRestoringIds((prev) => ({ ...prev, [projectId]: true }));
    try {
      await actions.restoreProject.mutateAsync({ id: projectId, allUsers: useAdminMode });
      setHiddenIds((prev) => ({ ...prev, [projectId]: true }));
      void list.refetch();
      toast({ title: 'تمت استعادة المشروع' });
    } catch (err) {
      toast({
        title: 'فشل الاستعادة',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء الاستعادة',
        variant: 'destructive',
      });
    } finally {
      setRestoringIds((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  };

  const openProject = async (project: BuilderProjectCard) => {
    if (openingIds[project._id]) return;
    setOpeningIds((prev) => ({ ...prev, [project._id]: true }));
    try {
      await actions.touchOpen.mutateAsync({ id: project._id, allUsers: useAdminMode });
    } catch {
      // non-blocking
    }
    setEntryAnimationProject(project);
    window.setTimeout(() => {
      navigate(`/shop-builder/editor/${project._id}`, { state: useAdminMode ? { allUsers: true } : undefined });
    }, 1000);
    window.setTimeout(() => {
      setOpeningIds((prev) => {
        const next = { ...prev };
        delete next[project._id];
        return next;
      });
    }, 1800);
  };

  const createProject = async () => {
    if (canUseAdminMode) {
      try {
        const created = await actions.createProject.mutateAsync({
          title: 'مشروع جديد',
          layout: { walls: [], products: [], floorSize: 24 },
        });
        await openProject(created);
        return;
      } catch (err) {
        toast({
          title: 'تعذر إنشاء المشروع',
          description: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
          variant: 'destructive',
        });
        return;
      }
    }

    navigate('/shop-setup', {
      state: {
        fromProjects: true,
        redirectTo: '/shop-builder/projects',
      },
    });
  };

  const handleImportFile: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed?.layout ? parsed : { title: file.name.replace(/\.json$/i, ''), layout: parsed };
      const imported = await actions.importProject.mutateAsync(payload);
      setImportedPreviewCards((prev) => [imported, ...prev.filter((item) => item._id !== imported._id)]);
      setHiddenIds({});
      setDeleted(false);
      setPage(1);
      setSort('updated_desc');
      setQ('');
      void actions.invalidate();
      void list.refetch();
      toast({ title: 'تم استيراد المشروع بنجاح' });
    } catch (err) {
      toast({
        title: 'فشل الاستيراد',
        description: err instanceof Error ? err.message : 'تأكد من صحة ملف JSON',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async (project: BuilderProjectCard) => {
    if (exportingIds[project._id]) return;
    setExportingIds((prev) => ({ ...prev, [project._id]: true }));
    try {
      const payload = await actions.exportProject.mutateAsync({ id: project._id, allUsers: useAdminMode });
      downloadJson(`${project.title || 'builder-project'}.json`, payload);
      toast({ title: 'تم تصدير المشروع' });
    } catch (err) {
      toast({
        title: 'فشل التصدير',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء التصدير',
        variant: 'destructive',
      });
    } finally {
      setExportingIds((prev) => {
        const next = { ...prev };
        delete next[project._id];
        return next;
      });
    }
  };

  const handleDelete = async (projectId: string) => {
    if (deletingIds[projectId]) return;
    setDeletingIds((prev) => ({ ...prev, [projectId]: true }));
    try {
      await actions.deleteProject.mutateAsync({ id: projectId, allUsers: useAdminMode });
      setHiddenIds((prev) => ({ ...prev, [projectId]: true }));
      void list.refetch();
      toast({ title: 'تم نقل المشروع إلى سلة المحذوفات لمدة 30 يوم' });
    } catch (err) {
      toast({
        title: 'فشل الحذف',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف',
        variant: 'destructive',
      });
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  };

  const handleForceDelete = async (projectId: string) => {
    if (forceDeletingIds[projectId]) return;
    setForceDeletingIds((prev) => ({ ...prev, [projectId]: true }));
    try {
      await actions.hardDeleteProject.mutateAsync({ id: projectId, allUsers: useAdminMode });
      setHiddenIds((prev) => ({ ...prev, [projectId]: true }));
      void list.refetch();
      toast({ title: 'تم حذف المشروع نهائيًا' });
    } catch (err) {
      toast({
        title: 'فشل الحذف النهائي',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف النهائي',
        variant: 'destructive',
      });
    } finally {
      setForceDeletingIds((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-6 md:py-10 bg-gradient-to-br from-slate-50 via-cyan-50 to-indigo-100"
    >
      <input
        ref={fileImportRef}
        type="file"
        accept="application/json"
        onChange={handleImportFile}
        className="hidden"
      />

      <div className="mx-auto max-w-7xl space-y-5">
        <Card className="border-0 rounded-3xl p-5 md:p-7 bg-white/85 backdrop-blur-xl shadow-[0_30px_90px_-45px_rgba(2,6,23,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Badge className="w-fit bg-slate-900 text-white gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                مشاريع المصمم ثلاثي الأبعاد
              </Badge>
              <h1 className="text-2xl md:text-4xl font-black text-slate-900">لوحة مشاريعك</h1>
              <p className="text-sm md:text-base text-slate-600 font-semibold">
                احفظ عدة مشاريع، وابحث بسرعة، واستكمل العمل من أي جهاز.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="rounded-2xl bg-slate-900 text-white p-3">
                <p className="text-xs text-slate-300">المشاريع</p>
                <p className="text-xl font-black">{stats.projects}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-500">البريد الإلكتروني</p>
                <p className="text-sm md:text-base font-black text-slate-800 truncate" title={profileEmail}>{profileEmail}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-500">النوع</p>
                <p className="text-xl font-black text-slate-800">{profileType}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-0 rounded-3xl p-4 md:p-5 bg-white/90 backdrop-blur-xl shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="ابحث بالاسم أو الوصف..."
                  className="pr-10 h-11 rounded-xl border-slate-200"
                />
              </div>
              <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
                <SelectTrigger className="h-11 md:w-48 rounded-xl">
                  <SelectValue placeholder="الترتيب" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={deleted ? 'outline' : 'default'}
                className="h-11 rounded-xl"
                onClick={() => {
                  setHiddenIds({});
                  setDeleted((prev) => !prev);
                  setPage(1);
                }}
              >
                {deleted ? <Undo2 className="w-4 h-4 ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
                {deleted ? 'عرض النشطة' : 'عرض المحذوفات'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="h-11 rounded-xl" onClick={createProject} disabled={actions.createProject.isPending}>
                {actions.createProject.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <FolderPlus className="w-4 h-4 ml-2" />}
                مشروع جديد
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => fileImportRef.current?.click()}
                disabled={actions.importProject.isPending}
              >
                {actions.importProject.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
                استيراد
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate('/shop-builder/intro')}>
                <ArrowLeft className="w-4 h-4 ml-2" />
                رجوع للمقدمة
              </Button>
            </div>
          </div>

          {canUseAdminMode ? (
            <div className="mt-3 grid gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
              <Button
                variant={useAdminMode ? 'default' : 'outline'}
                className="h-10 rounded-xl"
                onClick={() => {
                  setHiddenIds({});
                  setShowAllUsers((prev) => !prev);
                  setOwnerFilter('');
                  setPage(1);
                }}
              >
                {useAdminMode ? 'العرض كمشاريعي فقط' : 'عرض جميع مشاريع المستخدمين'}
              </Button>
              {useAdminMode ? (
                <Input
                  value={ownerFilter}
                  onChange={(e) => {
                    setOwnerFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="تصفية بالبريد أو User ID"
                  className="h-10 rounded-xl border-slate-200"
                />
              ) : (
                <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 px-3 flex items-center">
                  الوضع الافتراضي: مشاريعي فقط
                </div>
              )}
            </div>
          ) : null}
        </Card>

        {activeOpsCount > 0 ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/90 text-blue-800 px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ تحديث المشاريع... التغييرات ستظهر بعد اكتمال العملية.
          </div>
        ) : null}

        {actions.importProject.isPending ? (
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-cyan-50 text-violet-900 px-4 py-3 text-sm font-semibold flex items-center gap-2 animate-pulse">
            <Upload className="w-4 h-4" />
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ استيراد الملف... سيظهر المشروع تلقائيًا بعد اكتمال المعالجة.
          </div>
        ) : null}

        {list.isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleItems
                .map((project) => (
                <Card
                  key={project._id}
                  className="group relative border border-slate-200/80 rounded-2xl overflow-hidden bg-white/95 shadow-[0_16px_40px_-28px_rgba(2,6,23,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-32px_rgba(2,6,23,0.55)]"
                >
                  {(deletingIds[project._id] || restoringIds[project._id] || forceDeletingIds[project._id] || openingIds[project._id] || exportingIds[project._id]) ? (
                    <div className="absolute inset-0 z-20 backdrop-blur-[2px] bg-white/60 flex items-center justify-center p-3">
                      {deletingIds[project._id] ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm">
                          <Trash2 className="w-3.5 h-3.5" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ حذف المشروع... سيتم نقله إلى المحذوفات
                        </div>
                      ) : forceDeletingIds[project._id] ? (
                        <div className="rounded-xl border border-rose-300 bg-rose-100 text-rose-900 px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ الحذف النهائي... لا يمكن التراجع
                        </div>
                      ) : restoringIds[project._id] ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm">
                          <Undo2 className="w-3.5 h-3.5" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ استعادة المشروع... سيتم إعادته للقائمة
                        </div>
                      ) : openingIds[project._id] ? (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm">
                          <Sparkles className="w-3.5 h-3.5" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ تجهيز المشروع للفتح...
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm">
                          <Download className="w-3.5 h-3.5" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جارٍ تجهيز ملف التصدير...
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
                    {project.previewImageUrl ? (
                      <img src={project.previewImageUrl} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <LayoutGrid className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/15 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black text-slate-900 truncate">{project.title}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Clock3 className="w-3 h-3" />
                          {formatDate(project.updatedAt)}
                        </p>
                        {useAdminMode && project.ownerEmailSnapshot ? (
                          <p className="text-[11px] text-slate-500 truncate mt-1">{project.ownerEmailSnapshot}</p>
                        ) : null}
                      </div>
                      {project.isDeleted && <Badge variant="destructive">محذوف</Badge>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-100 py-1.5 font-bold">{project.stats?.wallsCount || 0} جدار</div>
                      <div className="rounded-lg bg-slate-100 py-1.5 font-bold">{project.stats?.productsCount || 0} منتج</div>
                      <div className="rounded-lg bg-slate-100 py-1.5 font-bold">{project.stats?.floorSize || 24}م</div>
                    </div>

                    <div className="w-full">
                      {!project.isDeleted ? (
                        <div className="grid grid-cols-3 gap-2 w-full">
                          <Button
                            size="sm"
                            className="rounded-xl w-full justify-center font-bold"
                            onClick={() => openProject(project)}
                            disabled={openingIds[project._id] || exportingIds[project._id]}
                          >
                            {openingIds[project._id] ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : null}
                            {openingIds[project._id] ? 'جارٍ الفتح' : 'فتح'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl w-full justify-center font-bold"
                            onClick={() => handleExport(project)}
                            disabled={openingIds[project._id] || exportingIds[project._id]}
                          >
                            {exportingIds[project._id] ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Download className="w-3.5 h-3.5 ml-1" />}
                            {exportingIds[project._id] ? 'جارٍ التصدير' : 'تصدير'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-xl w-full justify-center font-bold"
                            onClick={() => setDeleteTarget(project)}
                            disabled={openingIds[project._id] || exportingIds[project._id]}
                          >
                            {deletingIds[project._id] ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 ml-1" />}
                            {deletingIds[project._id] ? 'جارٍ الحذف' : 'حذف'}
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl w-full justify-center font-bold"
                            onClick={() => handleRestore(project._id)}
                            disabled={restoringIds[project._id] || forceDeletingIds[project._id] || openingIds[project._id] || exportingIds[project._id]}
                          >
                            {restoringIds[project._id] ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Undo2 className="w-3.5 h-3.5 ml-1" />}
                            {restoringIds[project._id] ? 'جارٍ الاستعادة' : 'استعادة'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-xl w-full justify-center font-bold bg-rose-700 hover:bg-rose-800"
                            onClick={() => setForceDeleteTarget(project)}
                            disabled={forceDeletingIds[project._id] || restoringIds[project._id]}
                          >
                            {forceDeletingIds[project._id] ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 ml-1" />}
                            {forceDeletingIds[project._id] ? 'جارٍ الحذف النهائي' : 'حذف نهائي'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 p-4 border border-slate-200">
              <p className="text-sm text-slate-600">صفحة {list.data?.page || 1} من {list.data?.pages || 1}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(list.data?.page || 1) <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  السابق
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(list.data?.page || 1) >= (list.data?.pages || 1)}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحذير حذف المشروع</DialogTitle>
            <DialogDescription>
              سيتم نقل المشروع <span className="font-bold">{deleteTarget?.title}</span> إلى سلة المحذوفات لمدة 30 يوم.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                const id = deleteTarget._id;
                setDeleteTarget(null);
                void handleDelete(id);
              }}
            >
              {deleteTarget && deletingIds[deleteTarget._id] ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!forceDeleteTarget} onOpenChange={(open) => !open && setForceDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف نهائي للمشروع</DialogTitle>
            <DialogDescription>
              سيتم حذف المشروع <span className="font-bold">{forceDeleteTarget?.title}</span> نهائيًا من قاعدة البيانات، ولن يمكن استعادته بعد الآن.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceDeleteTarget(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              className="bg-rose-700 hover:bg-rose-800"
              onClick={() => {
                if (!forceDeleteTarget) return;
                const id = forceDeleteTarget._id;
                setForceDeleteTarget(null);
                void handleForceDelete(id);
              }}
            >
              {forceDeleteTarget && forceDeletingIds[forceDeleteTarget._id] ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 ml-2" />}
              تأكيد الحذف النهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {entryAnimationProject && (
        <div className="fixed inset-0 z-[120] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-indigo-900/80 to-cyan-900/80 animate-[fadeIn_250ms_ease-out]">
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-[0_50px_150px_-40px_rgba(56,189,248,0.9)] border border-white/20 animate-[zoomIn_900ms_cubic-bezier(0.22,1,0.36,1)]">
                <div className="aspect-[16/9] bg-slate-900">
                  {entryAnimationProject.previewImageUrl ? (
                    <img src={entryAnimationProject.previewImageUrl} alt="" className="w-full h-full object-cover opacity-90" />
                  ) : null}
                </div>
                <div className="bg-black/60 text-white p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Entering Project</p>
                  <h3 className="text-xl font-black mt-1">{entryAnimationProject.title}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
