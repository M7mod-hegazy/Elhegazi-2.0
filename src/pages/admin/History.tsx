import React, { useState, useCallback, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { History as HistoryIcon, RefreshCw, Filter, Calendar, Clock, Tag, Mail, User as UserIcon, ChevronDown, Search, Activity, TrendingUp, BarChart3, Eye } from 'lucide-react';

interface HistoryItem {
  _id: string;
  userEmail?: string;
  userId?: string;
  section: string;
  action: string;
  note?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const AdminHistory = () => {
  const { isMobile, isTablet } = useDeviceDetection();
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
        // include the whole day
        end.setHours(23, 59, 59, 999);
        qs.set('to', end.toISOString());
      }
      const res = await apiGet<HistoryItem>(`/api/history?${qs.toString()}`);
      if (res.ok) setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }, [q, section, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => {
    const s = new Set(items.map(i => i.section));
    return Array.from(s);
  }, [items]);

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

  const pickMetaName = (meta?: Record<string, unknown>): string | undefined => {
    if (!meta) return undefined;
    const keys = ['username', 'userName', 'name'] as const;
    for (const k of keys) {
      const v = meta[k as keyof typeof meta];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return undefined;
  };

  const getDisplayName = (it: HistoryItem) => {
    const metaName = pickMetaName(it.meta);
    if (metaName) return metaName;
    if (it.userEmail) return it.userEmail.split('@')[0];
    return 'مستخدم غير معروف';
  };

  const renderMeta = (meta?: Record<string, unknown>) => {
    if (!meta || Object.keys(meta).length === 0) {
      return (
        <div className="text-sm text-slate-500 font-medium bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg p-4 text-center">
          لا توجد بيانات إضافية
        </div>
      );
    }
    return (
      <pre className="text-xs leading-relaxed bg-gradient-to-r from-slate-900 to-slate-800 text-green-400 rounded-lg p-4 overflow-x-auto border border-slate-300 font-mono shadow-inner">
        {JSON.stringify(meta, null, 2)}
      </pre>
    );
  };

  const filteredHistoryData = useMemo(() => {
    let filtered = items;
    
    if (q) {
      const searchTerm = q.toLowerCase();
      filtered = filtered.filter(item => 
        item.action.toLowerCase().includes(searchTerm) ||
        item.section.toLowerCase().includes(searchTerm) ||
        (item.note && item.note.toLowerCase().includes(searchTerm)) ||
        (item.userEmail && item.userEmail.toLowerCase().includes(searchTerm))
      );
    }
    
    if (section) {
      filtered = filtered.filter(item => item.section === section);
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(item => new Date(item.createdAt) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the whole day
      filtered = filtered.filter(item => new Date(item.createdAt) <= toDate);
    }
    
    return filtered;
  }, [items, q, section, dateFrom, dateTo]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
              <HistoryIcon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-primary" /> 
              سجل النشاط
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium mt-1 sm:mt-2">عرض شامل ومُحسَّن لأحداث النظام مع تفاصيل المستخدم والوقت والبيانات الإضافية</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Badge variant="outline" className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {items.length} حدث
            </Badge>
            <Button 
              variant="outline" 
              onClick={load} 
              disabled={loading}
              size={isMobile ? "sm" : "default"}
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary hover:from-primary/10 hover:to-primary/20 shadow-md text-xs sm:text-sm"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} /> 
              <span className="hidden sm:inline">تحديث</span>
              <span className="sm:hidden">تحديث</span>
            </Button>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-wide">إجمالي الأحداث</p>
                  <p className="text-3xl font-black text-primary mt-1">{items.length}</p>
                </div>
                <div className="p-3 bg-primary/20 rounded-xl">
                  <HistoryIcon className="w-8 h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">الأقسام النشطة</p>
                  <p className="text-3xl font-black text-green-900 mt-1">{sections.length}</p>
                </div>
                <div className="p-3 bg-green-200/50 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">أنشطة حديثة</p>
                  <p className="text-3xl font-black text-purple-900 mt-1">{filteredHistoryData.slice(0, 5).length}</p>
                </div>
                <div className="p-3 bg-purple-200/50 rounded-xl">
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide">المرشحات النشطة</p>
                  <p className="text-3xl font-black text-orange-900 mt-1">{[q, section, dateFrom, dateTo].filter(Boolean).length}</p>
                </div>
                <div className="p-3 bg-orange-200/50 rounded-xl">
                  <Filter className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revolutionary Mobile vs Desktop Filters */}
        {isMobile ? (
          <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg rounded-2xl mb-6 mx-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-primary" />
                المرشحات والبحث
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">البحث</Label>
                <Input 
                  placeholder="ابحث في النشاط..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">القسم</Label>
                <select 
                  value={section} 
                  onChange={(e) => setSection(e.target.value)} 
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">جميع الأقسام</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">من تاريخ</Label>
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)} 
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">إلى تاريخ</Label>
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)} 
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-blue-600" />
                مرشحات البحث والتصفية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">البحث النصي</Label>
                  <Input 
                    placeholder="ابحث في النشاط والأحداث..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">تصفية بالقسم</Label>
                  <select 
                    value={section} 
                    onChange={(e) => setSection(e.target.value)} 
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">جميع الأقسام</option>
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">من تاريخ</Label>
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)} 
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">إلى تاريخ</Label>
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)} 
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        <div className={`space-y-4 ${isMobile ? 'px-1' : ''}`}>
          {filteredHistoryData.length > 0 ? (
            filteredHistoryData.map((item) => (
              <Card key={item._id} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-slate-900">{getDisplayName(item)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600" />
                          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                            {item.section}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-600">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="font-medium text-slate-900">{item.action}</p>
                        {item.note && (
                          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{item.note}</p>
                        )}
                      </div>
                      
                      {item.meta && Object.keys(item.meta).length > 0 && (
                        <div className="mt-4">
                          <button
                            onClick={() => setExpanded(prev => ({ ...prev, [item._id]: !prev[item._id] }))}
                            className="flex items-center gap-2 text-sm text-primary hover:text-primary transition-colors"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${expanded[item._id] ? 'rotate-180' : ''}`} />
                            عرض البيانات الإضافية
                          </button>
                          
                          {expanded[item._id] && (
                            <div className="mt-3">
                              {renderMeta(item.meta)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد أحداث</h3>
                    <p className="text-slate-600">لم يتم العثور على أي أحداث تطابق معايير البحث المحددة</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => { setQ(''); setSection(''); setDateFrom(''); setDateTo(''); }}
                    className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary hover:from-primary/10 hover:to-primary/20"
                  >
                    مسح المرشحات
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminHistory;
