import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { History as HistoryIcon, RefreshCw, Filter, Clock, Tag, ChevronDown, Search, Activity, ArrowUpRight, Mail, Sparkles } from 'lucide-react';

interface HistoryItem {
  _id: string;
  userEmail?: string;
  userId?: string;
  section: string;
  action: string;
  note?: string;
  meta?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'critical';
  createdAt: string;
}

const prettifyToken = (value?: string) => {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const sectionLabel = (value?: string) => {
  const key = String(value || '').toLowerCase();
  const map: Record<string, string> = {
    admin: 'الإدارة',
    orders: 'الطلبات',
    products: 'المنتجات',
    categories: 'الفئات',
    users: 'المستخدمون',
    settings: 'الإعدادات',
    reports: 'التقارير',
    analytics: 'التحليلات',
    profit: 'الأرباح',
    'profit-settings': 'إعدادات الأرباح',
    'profit settings': 'إعدادات الأرباح',
  };
  return map[key] || 'قسم النظام';
};

const actionLabel = (value?: string) => {
  const key = String(value || '').toLowerCase();
  const map: Record<string, string> = {
    page_view: 'تم فتح الصفحة',
    sidebar_toggled: 'تم تغيير الشريط الجانبي',
    mobile_menu_toggled: 'تم تغيير قائمة الجوال',
    created: 'تم الإنشاء',
    updated: 'تم التحديث',
    deleted: 'تم الحذف',
    exported: 'تم التصدير',
    update: 'تم التحديث',
    delete: 'تم الحذف',
  };
  return map[key] || 'تم تنفيذ إجراء';
};

const changedKeyLabel = (key: string) => {
  const map: Record<string, string> = {
    globalBranches: 'الفروع العامة',
    globalExpenses: 'المصروفات العامة',
    shareholders: 'المساهمون',
    shareHistory: 'سجل الحصص',
    expenseTypes: 'أنواع المصروفات',
    username: 'اسم المستخدم',
  };
  return map[key] || '';
};

const arabicChangeList = (keys: unknown) => {
  if (!Array.isArray(keys) || keys.length === 0) return '';
  const mapped = keys.map((k) => changedKeyLabel(String(k))).filter(Boolean);
  if (!mapped.length) return '';
  const shown = mapped.slice(0, 4);
  const extra = mapped.length > 4 ? ` (+${mapped.length - 4})` : '';
  return `${shown.join('، ')}${extra}`;
};

const isArabicText = (value?: string) => /[\u0600-\u06FF]/.test(String(value || ''));

const extractAdminPath = (...candidates: Array<unknown>) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const match = candidate.match(/\/admin\/[a-z0-9\-\/]*/i);
    if (match?.[0]) return match[0].replace(/[.,;:!?]+$/, '');
  }
  return '';
};

const resolveHistoryTarget = (item: HistoryItem) => {
  const textPath = extractAdminPath(item.note, item.meta?.path, item.meta?.url, item.meta?.route);
  if (textPath) return textPath;

  const section = String(item.section || '').toLowerCase();
  const action = String(item.action || '').toLowerCase();
  const note = String(item.note || '').toLowerCase();
  const mixed = `${section} ${action} ${note}`;

  if (mixed.includes('products') && mixed.includes('3d')) return '/admin/products-3d';
  if (mixed.includes('order')) return '/admin/orders';
  if (mixed.includes('product')) return '/admin/products';
  if (mixed.includes('categor')) return '/admin/categories';
  if (mixed.includes('user')) return '/admin/users';
  if (mixed.includes('location')) return '/admin/locations';
  if (mixed.includes('qr')) return '/admin/qr-codes';
  if (mixed.includes('profit') || mixed.includes('report')) return '/admin/profit';
  if (mixed.includes('setting')) return '/admin/settings';
  if (mixed.includes('dashboard')) return '/admin/dashboard';
  return '/admin/history';
};

const pageLabel = (path: string) => {
  if (path.startsWith('/admin/orders') || path.startsWith('/admin/order/')) return 'الطلبات';
  if (path.startsWith('/admin/products-3d')) return 'نماذج 3D';
  if (path.startsWith('/admin/products')) return 'المنتجات';
  if (path.startsWith('/admin/categories')) return 'الفئات';
  if (path.startsWith('/admin/users')) return 'المستخدمون';
  if (path.startsWith('/admin/locations')) return 'المواقع';
  if (path.startsWith('/admin/qr-codes')) return 'رموز QR';
  if (path.startsWith('/admin/settings')) return 'الإعدادات';
  if (path.startsWith('/admin/profit')) return 'الأرباح';
  if (path.startsWith('/admin/dashboard')) return 'لوحة التحكم';
  if (path.startsWith('/admin/history')) return 'سجل النشاط';
  return 'الصفحة المرتبطة';
};

const messageEmoji = (item: HistoryItem) => {
  const action = String(item.action || '').toLowerCase();
  if (item.level === 'critical') return '🚨';
  if (action.includes('delete')) return '🗑️';
  if (action.includes('create')) return '🆕';
  if (action.includes('update')) return '✏️';
  if (action === 'page_view') return '👀';
  return '📌';
};

const historyMessage = (item: HistoryItem) => {
  const section = String(item.section || '').toLowerCase();
  const action = String(item.action || '').toLowerCase();
  const note = String(item.note || '').trim();
  const keysText = arabicChangeList(item.meta?.keys);

  if (note && isArabicText(note)) return `${messageEmoji(item)} ${note}`;

  if (section.includes('profit') && (action.includes('update') || note.toLowerCase().includes('updated profit settings'))) {
    const msg = keysText
      ? `تم تحديث إعدادات الأرباح. العناصر المتغيرة: ${keysText}.`
      : 'تم تحديث إعدادات الأرباح.';
    return `${messageEmoji(item)} ${msg}`;
  }

  if (action === 'page_view') {
    return `${messageEmoji(item)} تم فتح صفحة ${pageLabel(resolveHistoryTarget(item))}.`;
  }

  if (action === 'mobile_menu_toggled') {
    return note.toLowerCase().includes('closed')
      ? '📱 تم إغلاق قائمة الجوال.'
      : '📱 تم فتح قائمة الجوال.';
  }

  if (action === 'sidebar_toggled') {
    return note.toLowerCase().includes('collapsed')
      ? '📚 تم طي الشريط الجانبي.'
      : '📚 تم توسيع الشريط الجانبي.';
  }

  if (action.includes('create')) return `🆕 تم إنشاء عنصر جديد في ${sectionLabel(item.section)}.`;
  if (action.includes('delete')) return `🗑️ تم حذف عنصر من ${sectionLabel(item.section)}.`;
  if (action.includes('update')) {
    const msg = keysText
      ? `تم تحديث ${sectionLabel(item.section)}. العناصر المتغيرة: ${keysText}.`
      : `تم تحديث بيانات ${sectionLabel(item.section)}.`;
    return `✏️ ${msg}`;
  }

  return `📌 حدث نشاط جديد في ${sectionLabel(item.section)}.`;
};

const formatRelativeTime = (iso: string) => {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((now - t) / 1000));
  if (diff < 60) return `منذ ${diff} ثانية`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
};

const renderMeta = (meta?: Record<string, unknown>) => {
  if (!meta || Object.keys(meta).length === 0) return null;

  const hiddenKeys = new Set(['username']);
  const entries = Object.entries(meta).filter(([k]) => !hiddenKeys.has(k));
  if (!entries.length) return null;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (!value.length) return 'لا يوجد';
      const printable = value.slice(0, 5).map((v) => prettifyToken(String(v))).filter(Boolean);
      return value.length > 5 ? `${printable.join('، ')} (+${value.length - 5})` : printable.join('، ');
    }
    if (typeof value === 'object') {
      const keysCount = Object.keys(value as Record<string, unknown>).length;
      return `بيانات مركبة (${keysCount} حقول)`;
    }
    return String(value);
  };

  const labelForKey = (key: string) => {
    const map: Record<string, string> = {
      keys: 'العناصر المتأثرة',
    };
    return map[key] || prettifyToken(key);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-3 space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-xs font-bold text-slate-700 min-w-[140px]">{labelForKey(key)}:</span>
          <span className="text-xs text-slate-600 break-words">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  );
};

const AdminHistory = () => {
  const navigate = useNavigate();
  const { isMobile } = useDeviceDetection();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [section, setSection] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (section) qs.set('section', section);
      if (dateFrom) qs.set('from', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        qs.set('to', end.toISOString());
      }
      const res = await apiGet<HistoryItem>(`/api/history?${qs.toString()}`);
      if (res.ok) setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [q, section, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const s = new Set(items.map((i) => i.section));
    return Array.from(s);
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (q.trim()) {
      const term = q.toLowerCase();
      filtered = filtered.filter((item) =>
        item.action.toLowerCase().includes(term) ||
        item.section.toLowerCase().includes(term) ||
        (item.note && item.note.toLowerCase().includes(term)) ||
        (item.userEmail && item.userEmail.toLowerCase().includes(term))
      );
    }

    if (section) filtered = filtered.filter((item) => item.section === section);

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((item) => new Date(item.createdAt) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => new Date(item.createdAt) <= toDate);
    }

    return filtered;
  }, [items, q, section, dateFrom, dateTo]);

  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredItems.filter((i) => new Date(i.createdAt) >= today).length;
  }, [filteredItems]);

  const updateCount = useMemo(() => filteredItems.filter((i) => String(i.action).toLowerCase().includes('update')).length, [filteredItems]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 flex items-center gap-3">
              <HistoryIcon className="w-7 h-7 sm:w-9 sm:h-9 text-primary" />
              سجل النشاط الذكي
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-2">
              عرض عربي واضح لما حدث فعليًا، مع الانتقال السريع للصفحات المرتبطة.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            size={isMobile ? 'sm' : 'default'}
            className="bg-white border-primary/25 text-primary hover:bg-primary/5 font-bold"
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث الآن
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-primary/15 bg-white/90">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-slate-500">إجمالي الأحداث</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{filteredItems.length}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-emerald-700">أحداث اليوم</p>
              <p className="text-2xl font-black text-emerald-900 mt-1">{todayCount}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-amber-700">عمليات التحديث</p>
              <p className="text-2xl font-black text-amber-900 mt-1">{updateCount}</p>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-indigo-50/60">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-indigo-700">الأقسام النشطة</p>
              <p className="text-2xl font-black text-indigo-900 mt-1">{sections.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/90 border border-slate-200/60 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5 text-primary" />
              مرشحات البحث
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">بحث عام</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالعملية أو الملاحظة أو البريد..." />
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">القسم</Label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">جميع الأقسام</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>{sectionLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">من تاريخ</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">إلى تاريخ</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const target = resolveHistoryTarget(item);
              const metaBlock = renderMeta(item.meta);
              return (
                <Card key={item._id} className="group border border-slate-200/60 bg-white/95 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-bold">
                            {sectionLabel(item.section)}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 font-semibold">
                            {actionLabel(item.action)}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                          <Mail className="w-4 h-4 text-primary" />
                          <span dir="ltr" className="font-bold">{item.userEmail || 'غير متوفر'}</span>
                        </div>
                      </div>

                      <p className="text-sm sm:text-[15px] leading-7 text-slate-800 bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-3">
                        {historyMessage(item)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => navigate(target)}
                          className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-white"
                        >
                          فتح الصفحة المرتبطة
                          <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                        </Button>

                        {metaBlock && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExpanded((prev) => ({ ...prev, [item._id]: !prev[item._id] }))}
                            className="h-8 px-3 text-xs font-bold"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${expanded[item._id] ? 'rotate-180' : ''}`} />
                            تفاصيل إضافية
                          </Button>
                        )}
                      </div>

                      {expanded[item._id] && metaBlock}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="bg-white/95 border border-slate-200/70 shadow-sm">
              <CardContent className="p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-slate-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">لا توجد نتائج حالياً</h3>
                <p className="text-slate-600 mb-4">غيّر المرشحات أو امسح البحث لعرض أحداث أكثر.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ('');
                    setSection('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  مسح المرشحات
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminHistory;
