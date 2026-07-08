import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Trash2, Key, ArrowLeft, Store, Copy,
  CheckCircle2, XCircle, AlertCircle, Loader2, Info,
  Globe, Mail, Shield, Smartphone, Monitor, Download,
  ChevronLeft, ChevronRight, Eye, EyeOff,
  Check, ArrowLeftRight, ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getStores, createStore, updateStore, deleteStore, rotateStoreKey,
  batchActivateStores, batchDeactivateStores, batchDeleteStores,
  type SyncStore,
} from '@/lib/api-sync';
import { cn } from '@/lib/utils';

function KeyDisplayDialog({
  open, onOpenChange, label, apiKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
  apiKey: string;
}) {
  const { toast } = useToast();

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: 'تم النسخ', description: 'تم نسخ المفتاح إلى الحافظة' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-amber-500" />
            {label}
          </DialogTitle>
          <DialogDescription className="text-xs">
            هذا المفتاح يظهر مرة واحدة فقط. انسخه واحفظه في مكان آمن.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-2">
          <code dir="ltr" className="text-xs font-mono font-bold text-amber-800 break-all">{apiKey}</code>
          <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={copyKey}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>تم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoreFormDialog({
  open, onOpenChange, store, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store?: SyncStore | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [allowedIps, setAllowedIps] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(store?.name || '');
      setAllowedIps(store?.allowedIps?.join(', ') || '');
      setNotes(store?.notes || '');
    }
  }, [open, store]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المتجر مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateStore(store!._id, {
        name: name.trim(),
        notes,
        allowedIps: allowedIps ? allowedIps.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      toast({ title: 'تم التحديث', description: 'تم تحديث بيانات المتجر' });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت العملية', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">تعديل المتجر</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">اسم المتجر</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: فرع المهندسين"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">IP مسموح (اختياري، مفصول بفواصل)</Label>
            <Input
              value={allowedIps}
              onChange={(e) => setAllowedIps(e.target.value)}
              placeholder="192.168.1.1, 10.0.0.0/24"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">ملاحظات</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  open, onOpenChange, store, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store: SyncStore | null;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!store) return;
    setDeleting(true);
    try {
      await deleteStore(store._id);
      toast({ title: 'تم الحذف', description: `تم حذف المتجر ${store.name}` });
      onOpenChange(false);
      onDeleted();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل الحذف', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            حذف المتجر
          </DialogTitle>
          <DialogDescription className="text-xs">
            هل أنت متأكد من حذف المتجر <strong>{store?.name}</strong>؟ هذا الإجراء لا يمكن التراجع عنه.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupGuideDialog({
  open, onOpenChange, storeId, storeName, apiKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  storeName: string;
  apiKey: string;
}) {
  const { toast } = useToast();

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: 'تم النسخ', description: 'تم نسخ المفتاح إلى الحافظة' });
  };

  const copyId = () => {
    navigator.clipboard.writeText(storeId);
    toast({ title: 'تم النسخ', description: 'تم نسخ المعرف إلى الحافظة' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-500" />
            تعليمات إعداد المتجر
          </DialogTitle>
          <DialogDescription className="text-xs">
            اتبع هذه الخطوات لربط تطبيق POS بالمتجر <strong>{storeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Mockup */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-md border border-slate-100 p-4 w-full max-w-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Smartphone className="h-3 w-3 text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">تطبيق POS</span>
                </div>
                <Badge variant="outline" className="text-[9px] h-5 px-2">الإعدادات</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                  <ArrowLeftRight className="h-3 w-3 text-indigo-600" />
                  <span className="text-[11px] font-bold text-indigo-700">المزامنة</span>
                  <div className="mr-auto">
                    <Badge className="text-[9px] h-5 bg-indigo-600">مفعل</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                  <Store className="h-3 w-3 text-slate-500" />
                  <span className="text-[11px] text-slate-600">إضافة متجر</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                  <Key className="h-3 w-3 text-slate-500" />
                  <span className="text-[11px] text-slate-600">مفتاح API</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                  <CheckCircle2 className="h-3 w-3 text-slate-500" />
                  <span className="text-[11px] text-slate-600">اختبار الاتصال</span>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {[
              { num: 1, text: 'افتح تطبيق POS على جهازك', extra: <p className="text-[10px] text-slate-400 mt-0.5">تأكد من أن جهازك متصل بالإنترنت</p> },
              { num: 2, text: 'اذهب إلى: الإعدادات ← المزامنة مع المتجر', extra: <p className="text-[10px] text-slate-400 mt-0.5">ستجد صفحة المزامنة في قائمة الإعدادات الرئيسية</p> },
              { num: 3, text: 'انقر على "ابدأ إعداد المزامنة"', extra: <p className="text-[10px] text-slate-400 mt-0.5">ستظهر شاشة الترحيب — انقر على الزر الأخضر لبدء الإعداد</p> },
              {
                num: 4,
                text: 'أدخل معرف المتجر (Store ID):',
                extra: (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mb-1">
                      <code dir="ltr" className="text-xs font-mono font-bold text-indigo-700 flex-1 break-all">{storeId}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyId}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Info className="h-3 w-3 text-indigo-500" />
                      <span>أين أجد هذا؟ هذا المعرف تجده هنا — في نافذة تعليمات الإعداد. فقط انسخه والصقه.</span>
                    </p>
                  </div>
                ),
              },
              {
                num: 5,
                text: 'أدخل مفتاح API:',
                extra: (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-1">
                      <code dir="ltr" className="text-xs font-mono font-bold text-amber-800 flex-1 break-all">{apiKey}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyKey}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span>يظهر هذا المفتاح مرة واحدة فقط. انسخه الآن واحفظه في مكان آمن.</span>
                    </p>
                  </div>
                ),
              },
              { num: 6, text: 'أدخل رابط موقعك الإلكتروني', extra: <p className="text-[10px] text-slate-400 mt-0.5">مثال: https://elhegazi.vercel.app — ستجده في شريط عنوان المتصفح</p> },
              { num: 7, text: 'انقر على "اختبار الاتصال" — إذا ظهرت رسالة نجاح، اضغط "حفظ الإعدادات"' },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${step.num <= 3 ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                  <span className={`text-[11px] font-bold ${step.num <= 3 ? 'text-indigo-700' : 'text-amber-700'}`}>{step.num}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-600">{step.text}</p>
                  {step.extra}
                </div>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-800">
              احتفظ بمفتاح API في مكان آمن. لا تشاركه مع أي شخص غير موثوق.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>تم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStoreStepper({
  open, onOpenChange, onSaved, onShowKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  onShowKey: (label: string, key: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [allowedIps, setAllowedIps] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdStore, setCreatedStore] = useState<SyncStore | null>(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setName('');
      setWebsiteUrl('');
      setContactEmail('');
      setAllowedIps('');
      setNotes('');
      setConfirmChecked(false);
      setCreatedStore(null);
      setGeneratedKey('');
      setShowSetupGuide(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المتجر مطلوب', variant: 'destructive' });
      return;
    }
    if (!confirmChecked) {
      toast({ title: 'خطأ', description: 'يرجى تأكيد صحة المعلومات', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await createStore({
        name: name.trim(),
        notes: notes || websiteUrl || contactEmail
          ? [notes, websiteUrl && `الموقع: ${websiteUrl}`, contactEmail && `البريد: ${contactEmail}`].filter(Boolean).join(' | ')
          : '',
        allowedIps: allowedIps ? allowedIps.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setCreatedStore(result.store);
      setGeneratedKey(result.apiKey);
      onSaved();
      onShowKey(`مفتاح API - ${result.store.name}`, result.apiKey);
      setTimeout(() => setShowSetupGuide(true), 500);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت العملية', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المتجر مطلوب', variant: 'destructive' });
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-indigo-500" />
              إضافة متجر جديد
            </DialogTitle>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              {['معلومات المتجر', 'الأمان', 'مراجعة'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                    step > i + 1 ? 'bg-indigo-600 text-white' :
                    step === i + 1 ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' :
                    'bg-slate-100 text-slate-400'
                  )}>
                    {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold',
                    step >= i + 1 ? 'text-slate-700' : 'text-slate-400'
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <Progress value={(step / 3) * 100} className="h-1.5" />
          </div>

          <Separator />

          {/* Step 1: Store Info */}
          {step === 1 && (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Store className="h-3 w-3 text-indigo-500" />
                  اسم المتجر
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: فرع المهندسين"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  أي اسم تميّز به هذا الفرع أو نقطة البيع. سيظهر في لوحة التحكم والتقارير.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-indigo-500" />
                  رابط الموقع الإلكتروني (اختياري)
                </Label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>أين أجد هذا؟ رابط موقعك الإلكتروني الذي سيتم الربط معه — مثال: https://elhegazi.vercel.app</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-indigo-500" />
                  البريد الإلكتروني للتواصل (اختياري)
                </Label>
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="store@example.com"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  لإشعارات المزامنة والتنبيهات الهامة.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Security */}
          {step === 2 && (
            <div className="space-y-4 py-1">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-800">مفتاح API</span>
                </div>
                <p className="text-[11px] text-indigo-600 mb-2">
                  سيتم إنشاء مفتاح API تلقائياً بعد إضافة المتجر.
                </p>
                <div className="bg-white border border-indigo-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-slate-400">
                    ••••••••••••••••••••••••
                  </code>
                  <div className="flex items-center gap-1">
                    <div className="h-6 w-6 rounded bg-indigo-100 flex items-center justify-center">
                      <Key className="h-3 w-3 text-indigo-600" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-indigo-500" />
                  IP مسموح (اختياري، مفصول بفواصل)
                </Label>
                <Input
                  value={allowedIps}
                  onChange={(e) => setAllowedIps(e.target.value)}
                  placeholder="192.168.1.1, 10.0.0.0/24"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>أين أجد هذا؟ عنوان IP الخاص بجهاز التطبيق — يمكنك معرفته من إعدادات الشبكة أو تركه فارغاً للسماح بالكل.</span>
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4 py-1">
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">اسم المتجر</span>
                  <span className="font-bold text-slate-800">{name}</span>
                </div>
                {websiteUrl && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">الموقع</span>
                    <span className="font-bold text-slate-800 dir-ltr text-[11px]">{websiteUrl}</span>
                  </div>
                )}
                {contactEmail && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">البريد</span>
                    <span className="font-bold text-slate-800 text-[11px]">{contactEmail}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">IP مسموح</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {allowedIps || 'الكل'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">مفتاح API</span>
                  <span className="font-mono text-[11px] text-amber-600 font-bold">
                    ••• سيتم إنشاؤه تلقائياً
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="confirm"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="confirm" className="text-xs text-slate-600 cursor-pointer">
                  أؤكد أن جميع المعلومات صحيحة وأوافق على إنشاء المتجر
                </Label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={prevStep} size="sm" className="gap-1">
                <ChevronRight className="h-3.5 w-3.5" />
                السابق
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={nextStep} size="sm" className="gap-1">
                التالي
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={saving || !confirmChecked} size="sm" className="gap-1.5">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {saving ? 'جارٍ الإنشاء...' : 'إنشاء المتجر'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SetupGuideDialog
        open={showSetupGuide}
        onOpenChange={setShowSetupGuide}
        storeId={createdStore?._id || ''}
        storeName={createdStore?.name || name}
        apiKey={generatedKey}
      />
    </>
  );
}

export default function SyncStoreManagement() {
  usePageTitle('إدارة المتاجر المتصلة');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stores, setStores] = useState<SyncStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStepper, setShowAddStepper] = useState(false);
  const [editingStore, setEditingStore] = useState<SyncStore | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deletingStore, setDeletingStore] = useState<SyncStore | null>(null);
  const [keyDialog, setKeyDialog] = useState<{ label: string; key: string } | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await getStores();
      setStores(items);
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل المتاجر', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (store: SyncStore) => {
    try {
      const updated = await updateStore(store._id, { isActive: !store.isActive });
      setStores((prev) => prev.map((s) => (s._id === store._id ? updated : s)));
      toast({ title: updated.isActive ? 'تم التفعيل' : 'تم الإيقاف', description: store.name });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleRotateKey = async (store: SyncStore) => {
    setRotatingId(store._id);
    try {
      const rawKey = await rotateStoreKey(store._id);
      setKeyDialog({ label: `مفتاح API جديد - ${store.name}`, key: rawKey });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل تدوير المفتاح', variant: 'destructive' });
    } finally {
      setRotatingId(null);
    }
  };

  const handleShowKey = (label: string, key: string) => {
    setKeyDialog({ label, key });
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === stores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stores.map((s) => s._id)));
    }
  };

  const handleBatchActivate = async () => {
    setBatchProcessing(true);
    try {
      await batchActivateStores(Array.from(selectedIds));
      toast({ title: 'تم', description: `تم تفعيل ${selectedIds.size} متاجر` });
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت العملية', variant: 'destructive' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDeactivate = async () => {
    setBatchProcessing(true);
    try {
      await batchDeactivateStores(Array.from(selectedIds));
      toast({ title: 'تم', description: `تم إيقاف ${selectedIds.size} متاجر` });
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت العملية', variant: 'destructive' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    setBatchProcessing(true);
    try {
      await batchDeleteStores(Array.from(selectedIds));
      toast({ title: 'تم', description: `تم حذف ${selectedIds.size} متاجر` });
      setSelectedIds(new Set());
      setShowBatchDelete(false);
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت العملية', variant: 'destructive' });
    } finally {
      setBatchProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/admin/sync')} className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
                <ArrowLeft className="h-4 w-4 text-slate-600" />
              </button>
              <Store className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-black text-slate-800">إدارة المتاجر المتصلة</h1>
            </div>
            <Button onClick={() => setShowAddStepper(true)} className="gap-1.5 text-xs font-bold">
              <Plus className="h-3.5 w-3.5" />
              إضافة متجر
            </Button>
          </div>

          {/* Onboarding Banner */}
          <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Info className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">ما هي المتاجر المتصلة؟ </span>
              المتجر هو فرع أو نقطة بيع تستخدم تطبيق POS. كل متجر يحصل على مفتاح API خاص لربطه بموقعك الإلكتروني.
              <br />
              <span className="font-bold text-slate-700">الرحلة كاملة: </span>
              <span className="inline-flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-indigo-200 text-indigo-700 font-bold text-[10px]">① أضف متجراً</span>
                <ArrowLeftRight className="h-3 w-3 text-slate-300" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-indigo-200 text-indigo-700 font-bold text-[10px]">② انسخ المفتاح ومعرف المتجر</span>
                <ArrowLeftRight className="h-3 w-3 text-slate-300" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-indigo-200 text-indigo-700 font-bold text-[10px]">③ أدخل البيانات في تطبيق POS</span>
                <ArrowLeftRight className="h-3 w-3 text-slate-300" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-indigo-200 text-indigo-700 font-bold text-[10px]">④ ابدأ المزامنة</span>
              </span>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : stores.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Store className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-base font-black text-slate-500 mb-2">ابدأ بربط متجرك الإلكتروني</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                المتجر يمثل فرعك أو نقطة البيع. بعد إضافته، ستحصل على مفتاح API خاص تدخله في تطبيق POS لبدء مزامنة المنتجات والمخزون والأسعار بين الموقع والتطبيق.
              </p>
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">إضافة متجر</span>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-slate-300" />
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Key className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">نسخ المفتاح</span>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-slate-300" />
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">إدخال في POS</span>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-slate-300" />
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">مزامنة</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={() => setShowAddStepper(true)} className="gap-1.5 text-xs font-bold">
                  <Plus className="h-3.5 w-3.5" />
                  إضافة متجر
                </Button>
                <a
                  href="https://elhegazi.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  طلب تطبيق POS
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                  <span className="text-xs font-bold text-indigo-700">
                    {selectedIds.size} متجر محدد
                  </span>
                  <div className="mr-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleBatchActivate} disabled={batchProcessing} className="text-[10px] h-7">
                      تفعيل
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBatchDeactivate} disabled={batchProcessing} className="text-[10px] h-7">
                      إيقاف
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setShowBatchDelete(true)} disabled={batchProcessing} className="text-[10px] h-7">
                      حذف
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={stores.length > 0 && selectedIds.size === stores.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">اسم المتجر</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">مفتاح API</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">الحالة</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">آخر اتصال</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">IP مسموح</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 text-left">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store) => (
                      <TableRow key={store._id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(store._id)}
                            onChange={() => toggleSelect(store._id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </TableCell>
                        <TableCell className="font-bold text-sm text-slate-800">{store.name}</TableCell>
                        <TableCell>
                          <code className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                            •••{store.apiKeyPrefix}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={store.isActive}
                              onCheckedChange={() => handleToggleActive(store)}
                            />
                            <Badge variant={store.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
                              {store.isActive ? 'نشط' : 'موقف'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400" dir="ltr">
                          {store.lastSeenAt ? new Date(store.lastSeenAt).toLocaleString('ar-EG') : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {store.allowedIps?.length ? store.allowedIps.join(', ') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingStore(store); setShowEditForm(true); }}
                            >
                              <Edit className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handleRotateKey(store)}
                              disabled={rotatingId === store._id}
                            >
                              {rotatingId === store._id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                : <Key className="h-3.5 w-3.5 text-amber-500" />
                              }
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setDeletingStore(store)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddStoreStepper
        open={showAddStepper}
        onOpenChange={setShowAddStepper}
        onSaved={load}
        onShowKey={handleShowKey}
      />

      <StoreFormDialog
        open={showEditForm}
        onOpenChange={setShowEditForm}
        store={editingStore}
        onSaved={load}
      />

      <ConfirmDeleteDialog
        open={!!deletingStore}
        onOpenChange={(v) => { if (!v) setDeletingStore(null); }}
        store={deletingStore}
        onDeleted={load}
      />

      <Dialog open={showBatchDelete} onOpenChange={setShowBatchDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              حذف المتاجر المحددة
            </DialogTitle>
            <DialogDescription className="text-xs">
              هل أنت متأكد من حذف {selectedIds.size} متجر؟ هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDelete(false)} disabled={batchProcessing}>إلغاء</Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={batchProcessing} className="gap-1.5">
              {batchProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              حذف الكل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {keyDialog && (
        <KeyDisplayDialog
          open={!!keyDialog}
          onOpenChange={(v) => { if (!v) setKeyDialog(null); }}
          label={keyDialog.label}
          apiKey={keyDialog.key}
        />
      )}
    </AdminLayout>
  );
}
