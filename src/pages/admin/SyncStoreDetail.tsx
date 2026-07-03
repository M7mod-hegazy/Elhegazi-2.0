import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Store, Key, Globe, Shield, Clock, Activity,
  RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle,
  AlertTriangle, Trash2, Loader2, Edit, Zap, XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/hooks/use-toast';
import {
  getStoreById, getStoreActivity, triggerManualSync,
  type SyncStore, type SyncActivityEvent,
} from '@/lib/api-sync';

function computeHealthScore(store: SyncStore, activity: SyncActivityEvent[]): { score: number; label: string; color: string; bg: string } {
  let lastSeenScore = 0;
  if (store.lastSeenAt) {
    const mins = (Date.now() - new Date(store.lastSeenAt).getTime()) / 60000;
    if (mins < 5) lastSeenScore = 40;
    else if (mins < 30) lastSeenScore = 30;
    else if (mins < 120) lastSeenScore = 20;
    else if (mins < 1440) lastSeenScore = 10;
    else lastSeenScore = 0;
  }
  const recentActivity = activity.slice(0, 10);
  const successCount = recentActivity.filter((a) => a.type === 'sync').length;
  const successScore = Math.min(30, successCount * 3);
  const conflictScore = 15;
  const webhookScore = (store as any).webhookConfigured && (store as any).webhookWorking ? 15 : 0;
  const total = lastSeenScore + successScore + conflictScore + webhookScore;
  let label: string;
  if (total >= 90) label = 'ممتاز';
  else if (total >= 70) label = 'جيد';
  else if (total >= 50) label = 'متوسط';
  else label = 'ضعيف';
  let color: string, bg: string;
  if (total >= 90) { color = 'text-emerald-700'; bg = 'bg-emerald-100'; }
  else if (total >= 70) { color = 'text-amber-700'; bg = 'bg-amber-100'; }
  else if (total >= 50) { color = 'text-orange-700'; bg = 'bg-orange-100'; }
  else { color = 'text-red-700'; bg = 'bg-red-100'; }
  return { score: total, label, color, bg };
}

function HealthDayCell({ date, status }: { date: string; status: 'success' | 'warning' | 'error' | 'none' }) {
  const statusColors = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-red-400',
    none: 'bg-slate-200',
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-slate-400">{date}</span>
            <div className={`w-8 h-8 rounded-lg ${statusColors[status]} flex items-center justify-center`}>
              {status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              {status === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-white" />}
              {status === 'error' && <XCircle className="h-3.5 w-3.5 text-white" />}
              {status === 'none' && <span className="text-slate-400 text-[10px] font-bold">—</span>}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          {status === 'success' ? 'تمت المزامنة بنجاح' : status === 'warning' ? 'تحذير' : status === 'error' ? 'فشل الاتصال' : 'لا يوجد نشاط'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActivityTypeIcon({ type }: { type: string }) {
  if (type === 'sync') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (type === 'error') return <XCircle className="h-3.5 w-3.5 text-red-600" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
}

function ActivityTypeBg({ type }: { type: string }) {
  if (type === 'sync') return 'bg-emerald-100';
  if (type === 'error') return 'bg-red-100';
  return 'bg-amber-100';
}

export default function SyncStoreDetail() {
  usePageTitle('تفاصيل المتجر');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [store, setStore] = useState<SyncStore | null>(null);
  const [activity, setActivity] = useState<SyncActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [activityDays, setActivityDays] = useState(7);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [storeData, activityData] = await Promise.all([
        getStoreById(id).catch(() => null),
        getStoreActivity(id, { days: activityDays }).catch(() => [] as SyncActivityEvent[]),
      ]);
      if (storeData) setStore(storeData);
      setActivity(activityData);
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل بيانات المتجر', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, activityDays, toast]);

  useEffect(() => { load(); }, [load]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync(id);
      toast({ title: 'تم', description: 'بدأت المزامنة اليدوية' });
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشلت المزامنة', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const health = store ? computeHealthScore(store, activity) : null;

  const filteredActivity = activityTypeFilter === 'all'
    ? activity
    : activity.filter((a) => a.type === activityTypeFilter);

  const previousDays = Array.from({ length: activityDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' });
    const dayActivity = activity.filter((a) => {
      const aDate = new Date(a.createdAt).toDateString();
      return aDate === d.toDateString();
    });
    let status: 'success' | 'warning' | 'error' | 'none' = 'none';
    if (dayActivity.some((a) => a.type === 'error')) status = 'error';
    else if (dayActivity.some((a) => a.type === 'warning')) status = 'warning';
    else if (dayActivity.some((a) => a.type === 'sync')) status = 'success';
    return { date: dateStr, status };
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      </AdminLayout>
    );
  }

  if (!store) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Store className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-400">المتجر غير موجود</p>
            <Button variant="link" onClick={() => navigate('/admin/sync')} className="mt-2">
              العودة إلى لوحة المزامنة
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const totalSyncs = activity.filter((a) => a.type === 'sync').length;
  const totalActivity = activity.length;
  const successRate = totalActivity > 0 ? Math.round((totalSyncs / totalActivity) * 100) : 0;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {/* Back + Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/sync')}
                className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-slate-600" />
              </button>
              <Store className="h-6 w-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-black text-slate-800">{store.name}</h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">تفاصيل المتجر ونشاط المزامنة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {health && (
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${health.bg} ${health.color}`}>
                  {health.score}% · {health.label}
                </span>
              )}
              <Badge variant={store.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
                {store.isActive ? 'نشط' : 'موقف'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Store Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Store className="h-4 w-4 text-indigo-500" />
                    معلومات المتجر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">المعرف</span>
                    <code className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded">{store._id}</code>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">المفتاح</span>
                    <code className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded">•••{store.apiKeyPrefix}</code>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">IP مسموح</span>
                    <span className="text-[11px] font-bold text-slate-700">
                      {store.allowedIps?.length ? store.allowedIps.join(', ') : 'الكل'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">تاريخ الإضافة</span>
                    <span className="text-[11px] font-bold text-slate-700" dir="ltr">
                      {new Date(store.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">آخر اتصال</span>
                    <span className="text-[11px] font-bold text-slate-700" dir="ltr">
                      {store.lastSeenAt ? new Date(store.lastSeenAt).toLocaleString('ar-EG') : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs font-bold flex-1">
                      <Edit className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs font-bold flex-1 text-amber-600 border-amber-200 hover:bg-amber-50">
                      <Key className="h-3.5 w-3.5" />
                      تدوير المفتاح
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Health Score Detail */}
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-500" />
                    صحة الاتصال
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    {previousDays.map((day, i) => (
                      <HealthDayCell key={i} date={day.date.split(' ')[0]} status={day.status} />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mb-3">الأيام السبعة الماضية</p>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">نسبة النجاح</span>
                      <span className="font-black text-slate-800">{successRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${successRate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sync Activity */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-500" />
                      نشاط المزامنة
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <select
                        value={activityTypeFilter}
                        onChange={(e) => setActivityTypeFilter(e.target.value)}
                        className="text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">جميع الأنواع</option>
                        <option value="sync">مزامنة</option>
                        <option value="error">خطأ</option>
                        <option value="warning">تحذير</option>
                      </select>
                      <select
                        value={activityDays}
                        onChange={(e) => setActivityDays(Number(e.target.value))}
                        className="text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={7}>آخر 7 أيام</option>
                        <option value={30}>آخر 30 يوماً</option>
                        <option value={90}>آخر 90 يوماً</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredActivity.length === 0 ? (
                    <div className="p-8 text-center">
                      <Activity className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-400">لا يوجد نشاط مزامنة</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredActivity.slice(0, 30).map((event) => (
                        <div key={event._id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                          <div className={`h-7 w-7 rounded-full ${ActivityTypeBg({ type: event.type })} flex items-center justify-center shrink-0`}>
                            <ActivityTypeIcon type={event.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-700">{event.descriptionAr || event.description}</p>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono" dir="ltr">
                                {new Date(event.createdAt).toLocaleString('ar-EG')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manual Sync */}
              <div className="flex justify-center">
                <Button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="gap-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {syncing ? 'جاري المزامنة…' : 'مزامنة يدوية'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
