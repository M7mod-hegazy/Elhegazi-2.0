import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Wifi, WifiOff, Store, Package, Layers, Activity,
  ArrowLeftRight, ExternalLink, Clock, ImageIcon, Eye,
  CheckCircle2, AlertCircle, TrendingUp, ShoppingBag, Zap,
  Database, Shield, AlertTriangle, Info, Server, BarChart3, TrendingDown,
  Webhook, Copy, Loader2, Smartphone, ScanBarcode, Globe, Bell,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useBranding } from '@/hooks/useBranding';
import { getSyncStatus, getStores, getSyncedProducts, getSyncActivity, getSyncImpactSummary, getWebhookConfig, getWebhookLogs, testWebhookDelivery, getRollbackHistory, type SyncStore, type SyncStatusData, type SyncProduct, type SyncActivityEvent, type SyncImpactSummary, type WebhookConfig, type WebhookLog, type SyncSnapshot } from '@/lib/api-sync';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function SignalStrength({ bars, className }: { bars: number; className?: string }) {
  return (
    <div className={cn("flex items-end gap-[2px] h-4", className)}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-t-sm transition-all duration-300",
            i <= bars
              ? bars >= 4 ? 'bg-emerald-500'
                : bars >= 3 ? 'bg-amber-500'
                : bars >= 2 ? 'bg-amber-500'
                : 'bg-red-500'
              : 'bg-slate-200'
          )}
          style={{ height: `${4 + i * 3}px` }}
        />
      ))}
    </div>
  );
}

function getSignalBars(store: SyncStore): number {
  if (!store.isActive) return 0;
  if (!store.lastSeenAt) return 1;
  const mins = (Date.now() - new Date(store.lastSeenAt).getTime()) / 60000;
  if (mins < 5) return 4;
  if (mins < 30) return 3;
  if (mins < 120) return 2;
  return 1;
}

function getQuickHealth(store: SyncStore): { score: number; label: string; color: string; bg: string } {
  if (!store.isActive) return { score: 0, label: 'غير نشط', color: 'text-slate-500', bg: 'bg-slate-100' };
  if (!store.lastSeenAt) return { score: 10, label: 'ضعيف', color: 'text-red-700', bg: 'bg-red-100' };
  const mins = (Date.now() - new Date(store.lastSeenAt).getTime()) / 60000;
  let score: number;
  if (mins < 5) score = 95;
  else if (mins < 30) score = 80;
  else if (mins < 120) score = 60;
  else if (mins < 1440) score = 40;
  else score = 15;
  let label: string;
  if (score >= 90) label = 'ممتاز';
  else if (score >= 70) label = 'جيد';
  else if (score >= 50) label = 'متوسط';
  else label = 'ضعيف';
  let color: string, bg: string;
  if (score >= 90) { color = 'text-emerald-700'; bg = 'bg-emerald-100'; }
  else if (score >= 70) { color = 'text-amber-700'; bg = 'bg-amber-100'; }
  else if (score >= 50) { color = 'text-orange-700'; bg = 'bg-orange-100'; }
  else { color = 'text-red-700'; bg = 'bg-red-100'; }
  return { score, label, color, bg };
}

function StoreCard({ store }: { store: SyncStore }) {
  const navigate = useNavigate();
  const bars = getSignalBars(store);
  const health = getQuickHealth(store);
  const lastSeenLabel = store.lastSeenAt
    ? new Date(store.lastSeenAt).toLocaleString('ar-EG')
    : 'لم يتم';

  return (
    <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate('/admin/sync/stores/' + store._id)}
        className="cursor-pointer"
      >
      <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500 ${
                bars >= 4 ? 'bg-emerald-100 text-emerald-600' :
                bars >= 2 ? 'bg-amber-100 text-amber-600' :
                'bg-red-100 text-red-600'
              }`}>
                {bars >= 4 ? (
                  <Wifi className="h-4 w-4" />
                ) : bars >= 2 ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-800">{store.name}</h3>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${health.bg} ${health.color}`}>
                      {health.score}%
                    </span>
                  </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 font-mono">•••{store.apiKeyPrefix}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <SignalStrength bars={bars} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    {bars >= 4 ? 'اتصال ممتاز' : bars >= 3 ? 'اتصال جيد' : bars >= 2 ? 'اتصال ضعيف' : bars === 0 ? 'غير نشط' : 'انقطاع في الاتصال'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant={store.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
                {store.isActive ? 'نشط' : 'موقف'}
              </Badge>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-medium space-y-1.5">
            <div className="flex justify-between">
              <span>آخر اتصال</span>
              <span dir="ltr" className="font-bold text-slate-700">{lastSeenLabel}</span>
            </div>
            {store.allowedIps?.length > 0 && (
              <div className="flex justify-between">
                <span>IP مسموح</span>
                <span className="font-mono text-[10px]">{store.allowedIps.join(', ')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  if (!images?.length) return null;

  return (
    <>
      <div className="flex gap-1.5 flex-wrap">
        {images.slice(0, 4).map((url, i) => (
          <button
            key={i}
            onClick={() => setPreviewIdx(i)}
            className="w-14 h-14 rounded-lg overflow-hidden border border-slate-100 hover:border-indigo-300 transition-all hover:scale-105 active:scale-95 group relative"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
        {images.length > 4 && (
          <button
            onClick={() => setPreviewIdx(4)}
            className="w-14 h-14 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all"
          >
            +{images.length - 4}
          </button>
        )}
      </div>

      {previewIdx !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewIdx(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] mx-4 animate-fade-in">
            <img
              src={images[previewIdx]}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setPreviewIdx(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === previewIdx ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewIdx((p) => p! > 0 ? p! - 1 : images.length - 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewIdx((p) => p! < images.length - 1 ? p! + 1 : 0); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ActivityTimeline({ events }: { events: SyncActivityEvent[] }) {
  const navigate = useNavigate();
  if (events.length === 0) return null;

  const typeConfig = {
    sync: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-300' },
    error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-300' },
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          نشاط المزامنة
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mr-auto">
            {events.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute right-[21px] top-3 bottom-3 w-0.5 bg-slate-100 rounded-full" />
          <div className="space-y-0">
            {events.slice(0, 10).map((event, i) => {
              const cfg = typeConfig[event.type];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className={`h-7 w-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 relative z-10`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-700 truncate">{event.storeName}</p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                        {new Date(event.createdAt).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{event.descriptionAr || event.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        {events.length > 10 && (
          <div className="p-3 text-center border-t border-slate-100">
            <Button variant="link" size="sm" onClick={() => navigate('/admin/sync')} className="text-xs font-bold">
              عرض الكل ({events.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookSection({ stores }: { stores: SyncStore[] }) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, WebhookConfig | null>>({});
  const [logs, setLogs] = useState<Record<string, WebhookLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results: Record<string, WebhookConfig | null> = {};
      const logResults: Record<string, WebhookLog[]> = {};
      for (const store of stores) {
        results[store._id] = await getWebhookConfig(store._id).catch(() => null);
        logResults[store._id] = await getWebhookLogs(store._id).catch(() => []);
      }
      if (!cancelled) {
        setConfigs(results);
        setLogs(logResults);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [stores]);

  const handleTest = async (storeId: string) => {
    setTesting((prev) => ({ ...prev, [storeId]: true }));
    try {
      const res = await testWebhookDelivery(storeId);
      if (res?.ok) {
        toast({ title: 'تم إرسال اختبار webhook بنجاح' });
      } else {
        toast({ title: res?.message || 'فشل اختبار webhook', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'فشل اختبار webhook', variant: 'destructive' });
    } finally {
      setTesting((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  if (loading) return null;

  const hasWebhooks = Object.values(configs).some((c) => c !== null);

  if (!hasWebhooks) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }} className="mb-6">
      <h2 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
        <Webhook className="h-4 w-4 text-indigo-500" />
        إعدادات Webhook
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => {
          const cfg = configs[store._id];
          if (!cfg) return null;
          const storeLogs = logs[store._id] || [];
          const lastLog = storeLogs[0];
          return (
            <motion.div key={store._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-0 shadow-md bg-white/90 backdrop-blur-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                        cfg.isActive
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Webhook className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{store.name}</span>
                    </div>
                    <Badge variant={cfg.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
                      {cfg.isActive ? 'نشط' : 'موقف'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <span className="text-slate-400 font-medium block mb-1">رابط Webhook</span>
                      <code dir="ltr" className="text-[10px] font-mono text-slate-600 break-all">
                        {cfg.webhookUrl || '—'}
                      </code>
                    </div>

                    {lastLog && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5">
                        <span className="text-slate-400 font-medium">آخر تسليم</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            lastLog.status === 'success'
                              ? 'bg-emerald-100 text-emerald-700'
                              : lastLog.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {lastLog.status === 'success' ? 'نجاح' : lastLog.status === 'failed' ? 'فشل' : 'معلق'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(lastLog.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(store._id)}
                      disabled={testing[store._id]}
                      className="text-[10px] h-7 gap-1"
                    >
                      {testing[store._id] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      اختبار
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function AdminSyncPage() {
  const { branding } = useBranding();
  usePageTitle(`Sync · ${branding.siteName}`);
  const navigate = useNavigate();

  const [status, setStatus] = useState<SyncStatusData | null>(null);
  const [stores, setStores] = useState<SyncStore[]>([]);
  const [available, setAvailable] = useState<SyncProduct[]>([]);
  const [activity, setActivity] = useState<SyncActivityEvent[]>([]);
  const [impact, setImpact] = useState<SyncImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, st, products, events, imp] = await Promise.all([
        getSyncStatus().catch(() => null),
        getStores().catch(() => [] as SyncStore[]),
        getSyncedProducts().catch(() => [] as SyncProduct[]),
        getSyncActivity().catch(() => [] as SyncActivityEvent[]),
        getSyncImpactSummary().catch(() => null),
      ]);
      if (s) setStatus(s);
      setStores(st);
      setAvailable(products);
      setActivity(events);
      if (imp) setImpact(imp);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      </AdminLayout>
    );
  }

  const activeStores = stores.filter((s) => s.isActive);
  const totalImages = available.reduce((sum, p) => sum + (p.images?.length || 0) + (p.image ? 1 : 0), 0);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Branded Hero */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-2xl">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 overflow-hidden p-1.5">
                      {branding.logo.url ? (
                        <img src={branding.logo.url} alt={branding.logo.altText} className="w-full h-full object-contain" />
                      ) : (
                        <ArrowLeftRight className="h-7 w-7 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl md:text-2xl font-black text-white">Sync</h1>
                        <span className="text-white/40 text-lg font-light">by</span>
                        <span className="text-xl md:text-2xl font-black text-white">تطبيق الحجازي للمحاسبة</span>
                      </div>
                      <p className="text-sm text-white/60 font-medium">
                        منصة المزامنة الذكية — {branding.siteName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="secondary" size="sm" onClick={load} className="gap-1.5 text-xs font-bold bg-white/15 text-white hover:bg-white/25 border-0">
                      <RefreshCw className="h-3.5 w-3.5" />
                      تحديث
                    </Button>
                    <Button size="sm" onClick={() => navigate('/admin/sync/stores')} className="gap-1.5 text-xs font-bold bg-white text-slate-900 hover:bg-white/90">
                      <Store className="h-3.5 w-3.5" />
                      إدارة المتاجر
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {activeStores.length} متجر نشط
                  </span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3 w-3" />
                    {available.length} منتج متزامن
                  </span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" />
                    {totalImages} صورة
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Capabilities / Features */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Database, title: 'مزامنة المخزون التلقائية', desc: 'تحديث فوري للمخزون بين المتجر الإلكتروني وجميع نقاط البيع دون تدخل يدوي', accent: 'from-indigo-500 to-blue-600' },
                { icon: ScanBarcode, title: 'مزامنة الأسعار والباركود', desc: 'تطابق تام للأسعار والباركود بين جميع المتاجر — تغيير واحد ينعكس في كل مكان', accent: 'from-emerald-500 to-teal-600' },
                { icon: Globe, title: 'إدارة مركزية للمنتجات', desc: 'أضف المنتجات والفئات مرة واحدة ووزعها على جميع المتاجر المتصلة', accent: 'from-purple-500 to-violet-600' },
                { icon: Smartphone, title: 'دعم متعدد المتاجر', desc: 'اربط عدد غير محدود من المتاجر ونقاط البيع بإعدادات أمان مستقلة لكل متجر', accent: 'from-amber-500 to-orange-600' },
                { icon: Bell, title: 'إشعارات Webhook', desc: 'استقبل تحديثات لحظية عند تغير المنتجات، الأسعار، أو المخزون عبر webhooks', accent: 'from-rose-500 to-pink-600' },
                { icon: Activity, title: 'مراقبة في الوقت الفعلي', desc: 'لوحة تحكم حية تعرض حالة الاتصال، نشاط المزامنة، وأداء كل متجر', accent: 'from-cyan-500 to-sky-600' },
                { icon: Shield, title: 'أمان متقدم', desc: 'مفاتيح API مشفرة، نطاقات IP مسموحة، وسجلات تدقيق كاملة لجميع العمليات', accent: 'from-slate-600 to-slate-800' },
                { icon: Clock, title: 'سجل المزامنة والتراجع', desc: 'سجل كامل للتغييرات مع إمكانية التراجع عن المزامنات السابقة عند الحاجة', accent: 'from-teal-500 to-emerald-600' },
              ].map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.04 }}
                  className="group relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-br rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -m-px" style={{ backgroundImage: `linear-gradient(135deg, ${feat.accent.replace('from-', '').split(' ')[0]}15, ${feat.accent.replace('to-', '').split(' ')[1]}08)` }} />
                  <Card className="relative border-0 shadow-md bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 h-full">
                    <CardContent className="p-4">
                      <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${feat.accent} bg-opacity-10 flex items-center justify-center mb-3 shadow-sm`}>
                        <feat.icon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1">{feat.title}</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{feat.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'المنتجات', value: status?.totalProducts ?? available.length, icon: Package, color: 'text-blue-600 bg-blue-100', desc: `${status?.activeProducts ?? '-'} نشط` },
              { label: 'الفئات', value: status?.totalCategories ?? 0, icon: Layers, color: 'text-emerald-600 bg-emerald-100', desc: 'إجمالي الفئات' },
              { label: 'المتاجر', value: stores.length, icon: Store, color: 'text-purple-600 bg-purple-100', desc: `${activeStores.length} نشط` },
              { label: 'التغييرات', value: status?.changesSinceLastSync ?? 0, icon: TrendingUp, color: 'text-amber-600 bg-amber-100', desc: 'منذ آخر مزامنة' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                        <p className="text-[11px] font-bold text-slate-400">{stat.label}</p>
                        <p className="text-[10px] text-slate-300">{stat.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Impact Summary */}
          {impact && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  تأثير التغييرات · Impact Summary
                </h2>
                <Button
                  size="sm"
                  onClick={() => navigate('/admin/sync')}
                  className="gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  بدء المزامنة
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {([
                  {
                    label: 'سعر مرتفع',
                    value: impact.pricesUp.count,
                    detail: `+${impact.pricesUp.totalIncrease.toFixed(0)} ر.س`,
                    icon: TrendingUp,
                    color: 'text-emerald-600 bg-emerald-100',
                    detailClass: 'text-emerald-600',
                  },
                  {
                    label: 'سعر منخفض',
                    value: impact.pricesDown.count,
                    detail: `-${impact.pricesDown.totalDecrease.toFixed(0)} ر.س`,
                    icon: TrendingDown,
                    color: 'text-red-600 bg-red-100',
                    detailClass: 'text-red-600',
                  },
                  {
                    label: 'مخزون صفر',
                    value: impact.stockToZero.count,
                    icon: AlertTriangle,
                    color: 'text-amber-600 bg-amber-100',
                    detailClass: undefined as string | undefined,
                  },
                  {
                    label: 'منتجات جديدة',
                    value: impact.newProducts,
                    icon: Package,
                    color: 'text-blue-600 bg-blue-100',
                    detailClass: undefined,
                  },
                  {
                    label: 'تغييرات صور',
                    value: impact.imageChanges.count,
                    icon: ImageIcon,
                    color: 'text-purple-600 bg-purple-100',
                    detailClass: undefined,
                  },
                ] as const).map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.04 }}
                  >
                    <Card className="border-0 shadow-md bg-white/90 backdrop-blur-sm hover:shadow-lg transition-all duration-300 h-full">
                      <CardContent className="p-4 flex flex-col gap-1.5">
                        <div className={`h-8 w-8 rounded-xl ${item.color} flex items-center justify-center`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="text-xl font-black text-slate-800">{item.value}</span>
                        <span className="text-[11px] font-bold text-slate-400">{item.label}</span>
                        {item.detail && (
                          <span className={`text-[10px] font-bold ${item.detailClass || 'text-slate-500'}`}>
                            {item.detail}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Connected stores */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
            <h2 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              المتاجر المتصلة
              {stores.length > 0 && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {stores.length}
                </span>
              )}
            </h2>
            {stores.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-200 bg-white/50">
                <CardContent className="p-8 text-center">
                  <Store className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400 mb-1">لا توجد متاجر متصلة بعد</p>
                  <p className="text-xs text-slate-300 mb-4">أضف متجراً لبدء مزامنة المنتجات والمخزون</p>
                  <Button
                    onClick={() => navigate('/admin/sync/stores')}
                    className="gap-1.5 text-xs font-bold"
                  >
                    إضافة متجر
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => (
                  <StoreCard key={store._id} store={store} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Available products with images */}
          {available.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
              <h2 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                أحدث المنتجات المتزامنة
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {available.length}
                </span>
              </h2>
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-100">
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">الصورة</th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">المنتج</th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">السعر</th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">المخزون</th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">توزيع المخزون</th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">الصور</th>
                      </tr>
                    </thead>
                    <tbody>
                      {available.slice(0, 20).map((product, i) => {
                        const images = [product.image, ...(product.images || [])].filter(Boolean) as string[];
                        const stockBreakdown = product.stockByStore
                          ? Object.entries(product.stockByStore).filter(([, v]) => (v as number) > 0)
                          : [];
                        const storeMap = Object.fromEntries(stores.map((s) => [s._id, s.name]));
                        return (
                          <tr key={product._id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3 px-4">
                              {product.image ? (
                                <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-slate-300" />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800 text-xs">{product.nameAr || product.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</div>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700 text-xs">{product.price?.toLocaleString()} ر.س</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                product.stock > 10 ? 'bg-green-100 text-green-700' :
                                product.stock > 0 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {product.stock ?? 0}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-0.5">
                                {stockBreakdown.length > 0 ? (
                                  stockBreakdown.map(([storeId, qty]) => (
                                    <span key={storeId} className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                      {storeMap[storeId] || storeId.slice(-6)}: <span className="text-slate-700">{Number(qty)}</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-300">موحد</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {images.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <ImageGallery images={images} />
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {available.length > 20 && (
                  <div className="p-3 text-center border-t border-slate-100">
                    <Button variant="link" size="sm" onClick={() => navigate('/admin/products')} className="text-xs font-bold">
                      عرض الكل ({available.length})
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Activity timeline */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-6">
            <ActivityTimeline events={activity} />
          </motion.div>

          {/* Webhook section */}
          {stores.length > 0 && (
            <WebhookSection stores={stores} />
          )}

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  إجراءات سريعة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'إدارة المتاجر', desc: 'إضافة وتعديل المتاجر المتصلة', href: '/admin/sync/stores', icon: Store, color: 'bg-indigo-100 text-indigo-600' },
                    { label: 'المنتجات', desc: 'عرض وإدارة المنتجات', href: '/admin/products', icon: Package, color: 'bg-blue-100 text-blue-600' },
                    { label: 'الفئات', desc: 'فئات المنتجات', href: '/admin/categories', icon: Layers, color: 'bg-emerald-100 text-emerald-600' },
                    { label: 'تحديث شامل', desc: 'مزامنة كل المنتجات الآن', href: '/admin/products', icon: RefreshCw, color: 'bg-amber-100 text-amber-600' },
                  ].map((action, i) => (
                    <motion.button
                      key={action.label}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(action.href)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-right group"
                    >
                      <div className={`h-9 w-9 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <action.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700">{action.label}</p>
                        <p className="text-[10px] text-slate-400">{action.desc}</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}
