import { useState, useEffect, memo, useCallback, useRef } from 'react';
import { Plus, Edit, Trash2, MapPin, Phone, Clock, Save, X, Globe, Navigation, Building, Star, Mail, Link2, CheckCircle, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StoreMapPicker, hasValidPick, buildMapsUrls } from '@/components/admin/StoreMapPicker';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { logHistory } from '@/lib/history';
import { apiGet, apiPutJson, ApiHttpError } from '@/lib/api';

function extractCoordinatesFromMapsLink(link: string): { lat: number; lng: number } | null {
  const atMatch = link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  try {
    const u = new URL(link.trim());
    const q = u.searchParams.get('q');
    if (q) {
      const parts = q.split(',').map((x) => parseFloat(x.trim()));
      if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

const emptyLocationForm = (): Partial<Location> => ({
  name: '',
  address: '',
  phone: '',
  email: '',
  hours: '',
  coordinates: { lat: 0, lng: 0 },
  googleMapsLink: '',
  googleMapsEmbed: '',
  isActive: true,
});

interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  googleMapsLink: string;
  googleMapsEmbed: string;
  isActive: boolean;
}

function normalizeLocations(input: unknown): Location[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((o, i) => {
      const c = o.coordinates as { lat?: unknown; lng?: unknown } | undefined;
      const lat = typeof c?.lat === 'number' ? c.lat : 0;
      const lng = typeof c?.lng === 'number' ? c.lng : 0;
      return {
        id: String(o.id ?? `loc-${i}`),
        name: String(o.name ?? ''),
        address: String(o.address ?? ''),
        phone: String(o.phone ?? ''),
        email: String(o.email ?? ''),
        hours: String(o.hours ?? ''),
        coordinates: { lat, lng },
        googleMapsLink: String(o.googleMapsLink ?? ''),
        googleMapsEmbed: String(o.googleMapsEmbed ?? ''),
        isActive: o.isActive !== false,
      };
    });
}

const AdminLocations = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsHydrated, setLocationsHydrated] = useState(false);
  const [locationsLoadError, setLocationsLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const skipNextServerSave = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from /api/settings (same source the storefront uses). One-time migrate from legacy localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocationsLoadError(null);
      let fromLs: Location[] = [];
      try {
        const raw = localStorage.getItem('admin_locations');
        if (raw) fromLs = normalizeLocations(JSON.parse(raw));
      } catch {
        fromLs = [];
      }

      try {
        const res = await apiGet<{
          locations?: unknown;
        }>('/api/settings');
        const item = (res as { ok?: boolean; item?: { locations?: unknown } }).item;
        let merged = normalizeLocations(item?.locations);
        let skipPersistOnHydrate = true;

        if (merged.length === 0 && fromLs.length > 0) {
          try {
            await apiPutJson('/api/settings', { locations: fromLs });
            localStorage.removeItem('admin_locations');
            merged = fromLs;
            skipPersistOnHydrate = true;
          } catch (migrateErr) {
            const msg =
              migrateErr instanceof ApiHttpError
                ? migrateErr.message
                : 'تعذر رفع المواقع المحفوظة محلياً إلى الخادم';
            if (!cancelled) setLocationsLoadError(msg);
            merged = fromLs;
            skipPersistOnHydrate = false;
          }
        }

        if (!cancelled) {
          skipNextServerSave.current = skipPersistOnHydrate;
          setLocations(merged);
          setLocationsHydrated(true);
        }
      } catch (e) {
        const msg =
          e instanceof ApiHttpError ? e.message : 'تعذر تحميل المواقع من الخادم';
        if (!cancelled) {
          skipNextServerSave.current = fromLs.length === 0;
          setLocations(fromLs.length ? fromLs : []);
          setLocationsLoadError(fromLs.length ? `${msg} — عُرضت نسخة محلية مؤقتة.` : msg);
          setLocationsHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // audit: page view
  useEffect(() => {
    (async () => {
      try {
        await logHistory({ section: 'admin_locations', action: 'page_view' });
      } catch (e) { /* no-op */ }
    })();
  }, []);

  // Persist to server (storefront reads /api/settings → locations)
  useEffect(() => {
    if (!locationsHydrated) return;
    if (skipNextServerSave.current) {
      skipNextServerSave.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await apiPutJson('/api/settings', { locations });
          setSyncError(null);
        } catch (e) {
          const msg =
            e instanceof ApiHttpError ? e.message : 'تعذر حفظ المواقع';
          setSyncError(msg);
          toast({
            title: 'فشل الحفظ على الخادم',
            description: msg,
            variant: 'destructive',
          });
        }
      })();
    }, 550);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [locations, locationsHydrated, toast]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<Partial<Location>>(() => emptyLocationForm());

  const applyPickedLocation = useCallback((lat: number, lng: number) => {
    const urls = buildMapsUrls(lat, lng);
    setFormData((prev) => ({
      ...prev,
      coordinates: { lat, lng },
      googleMapsLink: urls.link,
      googleMapsEmbed: urls.embed,
    }));
  }, []);

  const handleInputChange = (field: keyof Location, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCoordinateChange = (field: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value);
    const n = Number.isFinite(numValue) ? numValue : 0;
    setFormData((prev) => {
      const lat = field === 'lat' ? n : (prev.coordinates?.lat ?? 0);
      const lng = field === 'lng' ? n : (prev.coordinates?.lng ?? 0);
      const next: Partial<Location> = { ...prev, coordinates: { lat, lng } };
      if (hasValidPick(lat, lng)) {
        const urls = buildMapsUrls(lat, lng);
        next.googleMapsLink = urls.link;
        next.googleMapsEmbed = urls.embed;
      }
      return next;
    });
  };

  const handleGoogleMapsLinkChange = (link: string) => {
    setFormData(prev => ({ ...prev, googleMapsLink: link }));

    // Try to extract coordinates from the link
    const coordinates = extractCoordinatesFromMapsLink(link);
    if (coordinates) {
      const urls = buildMapsUrls(coordinates.lat, coordinates.lng);
      setFormData((prev) => ({
        ...prev,
        coordinates,
        googleMapsLink: link.trim() || urls.link,
        googleMapsEmbed: urls.embed,
      }));

      toast({
        title: "تم استخراج الإحداثيات",
        description: "تم استخراج الإحداثيات وإنشاء رابط التضمين تلقائياً"
      });

      // audit: maps extract success
      try {
        logHistory({ section: 'admin_locations', action: 'maps_extract_success', meta: { lat: coordinates.lat, lng: coordinates.lng } });
      } catch (e) { /* no-op */ }
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.address || !formData.phone) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    const clat = formData.coordinates?.lat;
    const clng = formData.coordinates?.lng;
    if (!hasValidPick(clat, clng)) {
      toast({
        title: 'خطأ',
        description: 'حدد الموقع على الخريطة أو أدخل خط عرض وطول صالحين (لا تترك 0،0).',
        variant: 'destructive',
      });
      return;
    }

    if (editingLocation) {
      // Update existing location
      const prevLoc = locations.find(l => l.id === editingLocation.id);
      const updated = { ...editingLocation, ...formData } as Location;
      setLocations(prev => prev.map(loc => loc.id === editingLocation.id ? updated : loc));
      try {
        logHistory({ section: 'admin_locations', action: 'update', note: updated.name, meta: { id: updated.id, before: prevLoc, after: updated } });
      } catch (e) { /* no-op */ }
      toast({
        title: "تم التحديث",
        description: "تم تحديث الموقع بنجاح"
      });
    } else {
      const urls =
        clat != null && clng != null && hasValidPick(clat, clng) ? buildMapsUrls(clat, clng) : null;
      const newLocation: Location = {
        ...formData,
        id: Date.now().toString(),
        googleMapsLink: formData.googleMapsLink || urls?.link || '',
        googleMapsEmbed: formData.googleMapsEmbed || urls?.embed || '',
      } as Location;
      
      setLocations(prev => [...prev, newLocation]);
      try {
        logHistory({ section: 'admin_locations', action: 'create', note: newLocation.name, meta: { id: newLocation.id } });
      } catch (e) { /* no-op */ }
      toast({
        title: "تم الإضافة",
        description: "تم إضافة الموقع الجديد بنجاح"
      });
    }

    resetForm();
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData(location);
    setIsDialogOpen(true);
    try { logHistory({ section: 'admin_locations', action: 'dialog_open', note: 'edit_location', meta: { id: location.id } }); } catch (e) { /* no-op */ }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('حذف هذا الموقع نهائياً؟')) return;
    const loc = locations.find(l => l.id === id);
    setLocations(prev => prev.filter(loc => loc.id !== id));
    try { logHistory({ section: 'admin_locations', action: 'delete', note: loc?.name, meta: { id } }); } catch (e) { /* no-op */ }
    toast({
      title: "تم الحذف",
      description: "تم حذف الموقع بنجاح"
    });
  };

  const toggleStatus = (id: string) => {
    setLocations(prev => prev.map(loc => 
      loc.id === id 
        ? { ...loc, isActive: !loc.isActive }
        : loc
    ));
    const loc = locations.find(l => l.id === id);
    if (loc) {
      try { logHistory({ section: 'admin_locations', action: 'toggle_active', note: loc.name, meta: { id, to: !loc.isActive } }); } catch (e) { /* no-op */ }
    }
  };

  const resetForm = () => {
    setFormData(emptyLocationForm());
    setEditingLocation(null);
    setIsDialogOpen(false);
  };

  const openCreateDialog = () => {
    try {
      logHistory({ section: 'admin_locations', action: 'dialog_open', note: 'create_location' });
    } catch {
      /* no-op */
    }
    setEditingLocation(null);
    setFormData(emptyLocationForm());
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2 md:gap-3">
              <Building className="w-6 h-6 md:w-10 md:h-10 text-primary" />
              إدارة المواقع
            </h1>
            <p className="text-sm md:text-lg text-slate-600 font-medium mt-1 md:mt-2">
              إدارة فروع ومواقع المتجر — تُحفظ في الخادم وتظهر في الصفحة الرئيسية وصفحة المواقع.
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
            <Badge variant="outline" className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 px-3 md:px-4 py-1 md:py-2 text-xs md:text-sm flex-1 md:flex-none">
              <Star className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {locations.filter(loc => loc.isActive).length} موقع نشط
            </Badge>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingLocation(null);
                  setFormData(emptyLocationForm());
                }
              }}
            >
              <Button
                type="button"
                onClick={openCreateDialog}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary shadow-lg text-xs md:text-sm px-3 md:px-4 py-2 md:py-3 flex-1 md:flex-none"
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">إضافة موقع جديد</span>
                <span className="sm:hidden">إضافة</span>
              </Button>
              <DialogContent
                className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 backdrop-blur-3xl border border-slate-200/30 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] rounded-3xl"
                key={editingLocation ? String(editingLocation.id) : 'new'}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogHeader className="border-b border-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 pb-6">
                  <DialogTitle className="text-3xl font-black bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary via-secondary to-primary rounded-2xl flex items-center justify-center shadow-xl">
                      {editingLocation ? <Edit className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
                    </div>
                    {editingLocation ? 'تعديل الموقع' : 'إضافة موقع جديد'}
                  </DialogTitle>
                  <DialogDescription className="text-lg text-slate-600 font-medium mt-2 mr-15">
                    {editingLocation ? 'تعديل بيانات الموقع المحدد' : 'إضافة موقع جديد لتوسيع شبكة الفروع'}
                  </DialogDescription>
                </DialogHeader>

                <LocationForm
                  formData={formData}
                  setFormData={setFormData}
                  editingLocation={editingLocation}
                  handleSubmit={handleSubmit}
                  resetForm={resetForm}
                  handleInputChange={handleInputChange}
                  handleCoordinateChange={handleCoordinateChange}
                  handleGoogleMapsLinkChange={handleGoogleMapsLinkChange}
                  applyPickedLocation={applyPickedLocation}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {(locationsLoadError || syncError) && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive space-y-1">
            {locationsLoadError ? <p>{locationsLoadError}</p> : null}
            {syncError ? <p>{syncError}</p> : null}
          </div>
        )}
        {!locationsHydrated ? (
          <p className="mb-4 text-sm text-slate-600">جارٍ تحميل المواقع من الخادم…</p>
        ) : null}

        {/* Enhanced Mobile-Responsive Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wide">إجمالي المواقع</p>
                  <p className="text-2xl md:text-3xl font-black text-primary mt-1">{locations.length}</p>
                </div>
                <div className="p-2 md:p-3 bg-primary/20 rounded-xl">
                  <Building className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-semibold text-green-600 uppercase tracking-wide">المواقع النشطة</p>
                  <p className="text-2xl md:text-3xl font-black text-green-900 mt-1">{locations.filter(loc => loc.isActive).length}</p>
                </div>
                <div className="p-2 md:p-3 bg-green-200/50 rounded-xl">
                  <Star className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-semibold text-purple-600 uppercase tracking-wide">بالخرائط</p>
                  <p className="text-2xl md:text-3xl font-black text-purple-900 mt-1">
                    {locations.filter(loc => loc.googleMapsEmbed).length}
                  </p>
                </div>
                <div className="p-2 md:p-3 bg-purple-200/50 rounded-xl">
                  <MapPin className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-semibold text-orange-600 uppercase tracking-wide">بيانات كاملة</p>
                  <p className="text-2xl md:text-3xl font-black text-orange-900 mt-1">
                    {locations.filter(loc => loc.phone && loc.email && loc.hours).length}
                  </p>
                </div>
                <div className="p-2 md:p-3 bg-orange-200/50 rounded-xl">
                  <Navigation className="w-6 h-6 md:w-8 md:h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Mobile-Responsive Locations Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
          {locations.map((location) => (
            <Card key={location.id} className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50/50 to-primary/5 border-b border-slate-100 pb-3 md:pb-4 p-4 md:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg md:text-xl font-bold text-slate-900 mb-2">{location.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <Badge 
                        variant={location.isActive ? "default" : "secondary"}
                        className={location.isActive 
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-xs md:text-sm" 
                          : "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-700 font-semibold text-xs md:text-sm"
                        }
                      >
                        {location.isActive ? 'نشط' : 'غير نشط'}
                      </Badge>
                      {location.googleMapsEmbed && (
                        <Badge variant="outline" className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary text-xs">
                          <Globe className="w-3 h-3 mr-1" />
                          بالخرائط
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 md:gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(location)}
                      className="hover:bg-primary/5 hover:border-primary/30 transition-colors p-1.5 md:p-2"
                    >
                      <Edit className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(location.id)}
                      className="hover:bg-red-50 hover:border-red-300 transition-colors p-1.5 md:p-2"
                    >
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="bg-gradient-to-r from-slate-50 to-primary/5 rounded-xl p-3 md:p-4 flex items-start gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                    <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs md:text-sm font-semibold text-slate-700 mb-1">العنوان</h4>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-words">{location.address}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  <div className="bg-gradient-to-r from-green-50 to-green-100/30 border border-green-200/50 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">رقم الهاتف</span>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-900 break-all">{location.phone}</p>
                  </div>
                  
                  {location.hours && (
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100/30 border border-purple-200/50 rounded-xl p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 md:w-4 md:h-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">ساعات العمل</span>
                      </div>
                      <p className="text-xs md:text-sm font-medium text-slate-900">{location.hours}</p>
                    </div>
                  )}
                </div>

                {location.email && (
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100/30 border border-orange-200/50 rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">البريد الإلكتروني</span>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-900 break-all">{location.email}</p>
                  </div>
                )}

              {/* Enhanced Mobile-Responsive Google Maps Section */}
              {location.googleMapsEmbed && (
                <div className="mt-3 md:mt-4">
                  <h4 className="text-sm font-medium mb-2">الموقع على الخريطة</h4>
                  <div className="relative w-full h-40 md:h-48 rounded-lg overflow-hidden border">
                    <iframe
                      src={location.googleMapsEmbed}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`خريطة ${location.name}`}
                    />
                  </div>
                  {location.googleMapsLink && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="w-full text-xs md:text-sm"
                      >
                        <a
                          href={location.googleMapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                          فتح في خرائط جوجل
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t text-xs md:text-sm">
                <span className="text-slate-500 break-all">
                  {location.coordinates.lat}, {location.coordinates.lng}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleStatus(location.id)}
                  className={location.isActive ? 'text-red-600 text-xs md:text-sm' : 'text-green-600 text-xs md:text-sm'}
                >
                  {location.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">لا توجد مواقع</h3>
          <p className="text-slate-500">ابدأ بإضافة أول موقع للمتجر</p>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

// Ultra-Modern Location Form Component with glassmorphism effects
interface LocationFormProps {
  formData: Partial<Location>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Location>>>;
  editingLocation: Location | null;
  handleSubmit: () => void;
  resetForm: () => void;
  handleInputChange: (field: keyof Location, value: string | boolean) => void;
  handleCoordinateChange: (field: 'lat' | 'lng', value: string) => void;
  handleGoogleMapsLinkChange: (link: string) => void;
  applyPickedLocation: (lat: number, lng: number) => void;
}

const LocationForm = memo(function LocationForm({
  formData,
  setFormData,
  editingLocation,
  handleSubmit,
  resetForm,
  handleInputChange,
  handleCoordinateChange,
  handleGoogleMapsLinkChange,
  applyPickedLocation,
}: LocationFormProps) {
  return (
    <div className="space-y-6 pt-6">
      {/* Basic Information Section */}
      <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/20 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
            <Building className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            معلومات الفرع الأساسية
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              اسم الفرع *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="مثال: الفرع الرئيسي - الرياض"
              className="h-12 text-lg bg-white/80 backdrop-blur border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm transition-all duration-200 hover:shadow-md"
            />
          </div>
          <div className="space-y-3">
            <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              رقم الهاتف *
            </label>
            <Input
              value={formData.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+966 11 123 4567"
              className="h-12 text-lg bg-white/80 backdrop-blur border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm transition-all duration-200 hover:shadow-md"
            />
          </div>
        </div>

        <div className="space-y-3 mt-6">
          <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            العنوان *
          </label>
          <Textarea
            value={formData.address || ''}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="العنوان الكامل للفرع"
            rows={3}
            className="text-lg bg-white/80 backdrop-blur border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm transition-all duration-200 hover:shadow-md rounded-xl"
          />
        </div>
      </div>

      {/* Contact Details Section */}
      <div className="bg-gradient-to-r from-green-50/60 via-emerald-50/40 to-teal-50/60 backdrop-blur-sm rounded-2xl p-6 border border-green-200/30 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            تفاصيل الاتصال
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-green-600" />
              البريد الإلكتروني
            </label>
            <Input
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="branch@arabianbluebloom.com"
              className="h-12 text-lg bg-white/80 backdrop-blur border-green-200/50 focus:border-green-500 focus:ring-green-500/20 shadow-sm transition-all duration-200 hover:shadow-md"
            />
          </div>
          <div className="space-y-3">
            <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600" />
              ساعات العمل
            </label>
            <Input
              value={formData.hours || ''}
              onChange={(e) => handleInputChange('hours', e.target.value)}
              placeholder="السبت - الخميس: 9:00 ص - 10:00 م"
              className="h-12 text-lg bg-white/80 backdrop-blur border-green-200/50 focus:border-green-500 focus:ring-green-500/20 shadow-sm transition-all duration-200 hover:shadow-md"
            />
          </div>
        </div>
      </div>

      {/* Interactive map: OpenStreetMap + Leaflet; search via Photon (no API key) */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-100/40 p-4 md:p-5 shadow-inner">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">تحديد الموقع على الخريطة</h3>
            <p className="text-xs text-slate-600">
              خريطة مجانية (OpenStreetMap) — انقر، أو ابحث عن عنوان، أو استخدم موقعك. روابط الزوار لخرائط جوجل تُنشأ من
              الإحداثيات.
            </p>
          </div>
        </div>
        <StoreMapPicker
          lat={formData.coordinates?.lat}
          lng={formData.coordinates?.lng}
          onPick={applyPickedLocation}
        />
      </div>

      <Collapsible className="rounded-2xl border border-amber-200/40 bg-amber-50/30 px-4 py-2">
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-amber-900 hover:text-amber-950">
          <span className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            خيارات متقدمة (رابط يدوي أو تعديل الإحداثيات)
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pb-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-600" />
              رابط خرائط جوجل (اختياري)
            </label>
            <Input
              value={formData.googleMapsLink || ''}
              onChange={(e) => handleGoogleMapsLinkChange(e.target.value)}
              placeholder="https://maps.google.com/?q=24.7136,46.6753"
              className="h-11 bg-white border-amber-200/60"
            />
            <p className="text-xs text-amber-900/80 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              عند لصق رابط يحتوي إحداثيات، تُحدَّث الخريطة والحقول تلقائياً.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">خط العرض (Latitude)</label>
              <Input
                type="number"
                step="any"
                value={formData.coordinates?.lat === 0 ? '' : formData.coordinates?.lat ?? ''}
                onChange={(e) => handleCoordinateChange('lat', e.target.value)}
                placeholder="24.7136"
                className="font-mono h-11 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">خط الطول (Longitude)</label>
              <Input
                type="number"
                step="any"
                value={formData.coordinates?.lng === 0 ? '' : formData.coordinates?.lng ?? ''}
                onChange={(e) => handleCoordinateChange('lng', e.target.value)}
                placeholder="46.6753"
                className="font-mono h-11 bg-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600" />
              رابط تضمين مخصص (اختياري)
            </label>
            <Textarea
              value={formData.googleMapsEmbed || ''}
              onChange={(e) => handleInputChange('googleMapsEmbed', e.target.value)}
              placeholder="يُولَّد تلقائياً من الإحداثيات؛ يمكنك لصق رابط embed من جوجل إن لزم"
              rows={2}
              className="bg-white border-amber-200/60 text-sm"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Map Preview Section */}
      {formData.googleMapsEmbed && (
        <div className="bg-gradient-to-r from-slate-50/60 via-gray-50/40 to-zinc-50/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-gray-600 rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-slate-600 to-gray-600 bg-clip-text text-transparent">
              معاينة الخريطة
            </h3>
          </div>
          <div className="relative w-full h-64 rounded-2xl overflow-hidden border-2 border-slate-200/50 bg-slate-50 shadow-lg">
            <iframe
              src={formData.googleMapsEmbed}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="معاينة الخريطة"
              className="rounded-2xl"
            />
          </div>
        </div>
      )}

      <DialogFooter className="pt-6 border-t border-slate-200/50">
        <Button
          variant="outline"
          onClick={resetForm}
          className="h-12 px-6 text-lg bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300 text-slate-700 hover:from-slate-100 hover:to-slate-200 shadow-md transition-all duration-200 hover:shadow-lg"
        >
          <X className="w-4 h-4 mr-2" />
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          className="h-12 px-8 text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 shadow-xl transition-all duration-300 hover:shadow-2xl transform hover:scale-105"
        >
          <div className="flex items-center gap-3">
            {editingLocation ? (
              <>
                <Edit className="w-5 h-5" />
                تحديث الموقع
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                إضافة الموقع
              </>
            )}
          </div>
        </Button>
      </DialogFooter>
    </div>
  );
});

export default AdminLocations;
