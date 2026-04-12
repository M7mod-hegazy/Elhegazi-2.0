import { useEffect, useMemo, useState } from 'react';
import { MapPin, Clock, Phone, Navigation, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings, type LocationData, type WorkHours } from '@/hooks/useSettings';
import { applyHeroImageFallback } from '@/lib/images';
import { getLocationPhoneList, getLocationPrimaryPhone } from '@/lib/locationPhones';

const BRANCH_IMAGES = [
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600',
  'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600',
];

const DEFAULT_SERVICES = ['تسوق مباشر', 'استلام الطلبات'];

function buildHourLines(hours: string | undefined, workHours: WorkHours): string[] {
  const custom = hours?.trim();
  if (custom) {
    return custom.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  return [`السبت - الخميس: ${workHours.weekdays}`, `الجمعة: ${workHours.friday}`];
}

function buildMapEmbedSrc(loc: LocationData): string {
  const emb = loc.googleMapsEmbed?.trim();
  if (emb) return emb;
  const lat = loc.coordinates?.lat;
  const lng = loc.coordinates?.lng;
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0)
  ) {
    return `https://www.google.com/maps?q=${lat},${lng}&hl=ar&z=15&output=embed`;
  }
  return '';
}

function buildDirectionsUrl(loc: LocationData): string {
  const link = loc.googleMapsLink?.trim();
  if (link) return link;
  const lat = loc.coordinates?.lat;
  const lng = loc.coordinates?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name || 'store')}`;
}

function phoneHref(phone: string): string {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '#';
}

type DisplayLoc = LocationData & {
  isMain: boolean;
  image: string;
  mapEmbedSrc: string;
  directionsUrl: string;
};

const Locations = () => {
  const [selectedLocation, setSelectedLocation] = useState(0);
  const { workHours, locations: settingsLocations, loading } = useSettings();
  const [now, setNow] = useState<Date>(new Date());

  const displayLocations: DisplayLoc[] = useMemo(() => {
    const active = settingsLocations.filter((l) => l.isActive);
    return active.map((loc, idx) => ({
      ...loc,
      isMain: idx === 0,
      image:
        loc.imageUrl?.trim() ||
        BRANCH_IMAGES[idx % BRANCH_IMAGES.length],
      mapEmbedSrc: buildMapEmbedSrc(loc),
      directionsUrl: buildDirectionsUrl(loc),
    }));
  }, [settingsLocations]);

  useEffect(() => {
    setSelectedLocation((i) => {
      if (displayLocations.length === 0) return 0;
      return i >= displayLocations.length ? 0 : i;
    });
  }, [displayLocations.length]);

  const parseArabicTimeToMinutes = (t: string): number | null => {
    try {
      const trimmed = t.trim();
      const isPM = /م/i.test(trimmed);
      const isAM = /ص/i.test(trimmed);
      const timePart = trimmed.replace(/[^0-9:\s]/g, '').trim();
      const [hStr, mStr = '0'] = timePart.split(':');
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10) || 0;
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    } catch {
      return null;
    }
  };

  const parseRange = (range: string): [number, number] | null => {
    if (!range) return null;
    const parts = range.split('-');
    if (parts.length !== 2) return null;
    const start = parseArabicTimeToMinutes(parts[0]);
    const end = parseArabicTimeToMinutes(parts[1]);
    if (start == null || end == null) return null;
    return [start, end];
  };

  const getCurrentStatus = (): 'مفتوح الآن' | 'مغلق' => {
    const day = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const rangeStr = day === 5 ? workHours.friday : workHours.weekdays;
    if (!rangeStr || /مغلق/i.test(rangeStr)) return 'مغلق';
    const range = parseRange(rangeStr);
    if (!range) return 'مغلق';
    const [start, end] = range;
    return nowMinutes >= start && nowMinutes < end ? 'مفتوح الآن' : 'مغلق';
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (loading && displayLocations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-muted-foreground">جارٍ تحميل المواقع…</p>
      </div>
    );
  }

  if (displayLocations.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <section className="relative py-16 bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-b border-primary/10">
          <div className="container mx-auto px-4 text-center max-w-xl">
            <MapPin className="w-10 h-10 mx-auto text-primary mb-4" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">فروعنا ومواقعنا</h1>
            <p className="text-muted-foreground">
              لا توجد فروع مفعّلة حالياً. أضف مواقع من لوحة الإدارة ← المواقع، ثم فعّلها لتظهر هنا وفي الصفحة الرئيسية.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const current = displayLocations[selectedLocation];
  if (!current) return null;

  const currentPhones = getLocationPhoneList(current);
  const primaryPhone = getLocationPrimaryPhone(current);
  const hourLines = buildHourLines(current.hours, workHours);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative py-12 bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-b border-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              <MapPin className="w-4 h-4" />
              اكتشف أقرب فرع إليك
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
              فروعنا ومواقعنا
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              زورنا في فروعنا أو تواصل للاستفسار والدعم
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <span
                className={`inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full shadow-sm ${
                  getCurrentStatus() === 'مفتوح الآن'
                    ? 'bg-success/20 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                الحالة الآن: {getCurrentStatus()}
              </span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                السبت - الخميس: {workHours.weekdays}
              </span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                الجمعة: {workHours.friday}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="locations-map" className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="card-elegant h-96 lg:h-[600px] overflow-hidden">
                <div className="w-full h-full relative">
                  <div className="absolute top-4 left-4 z-10">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full shadow-lg backdrop-blur-sm ${
                        getCurrentStatus() === 'مفتوح الآن'
                          ? 'bg-success/90 text-white'
                          : 'bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      الحالة الآن: {getCurrentStatus()}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 z-10">
                    <div className="bg-primary/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-primary-foreground/20">
                      <p className="text-sm font-semibold text-primary-foreground">{current.name}</p>
                      <p className="text-xs text-primary-foreground/70 mt-1">{current.address}</p>
                    </div>
                  </div>

                  {current.mapEmbedSrc ? (
                    <iframe
                      title={`خريطة ${current.name}`}
                      src={current.mapEmbedSrc}
                      className="w-full h-full rounded-button border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/40 p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-4">لا تتوفر خريطة مضمّنة لهذا الفرع.</p>
                      <Button asChild variant="secondary">
                        <a href={current.directionsUrl} target="_blank" rel="noopener noreferrer">
                          افتح في الخرائط
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="heading-2 mb-6">اختر الفرع</h2>
              {displayLocations.map((location, index) => (
                <button
                  key={String(location.id)}
                  type="button"
                  onClick={() => setSelectedLocation(index)}
                  className={`w-full text-right p-4 rounded-card border-2 transition-all duration-300 ease-out ${
                    selectedLocation === index
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      {location.isMain ? (
                        <Badge className="bg-primary text-primary-foreground">الفرع الرئيسي</Badge>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          getCurrentStatus() === 'مفتوح الآن'
                            ? 'bg-success/20 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {getCurrentStatus()}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-1">{location.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{location.address}</p>

                  <div className="flex items-center justify-end">
                    <div className="text-xs text-primary">
                      <Navigation className="w-3 h-3 inline ml-1" />
                      اعرض على الخريطة
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="card-elegant">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <img
                    src={current.image}
                    alt={current.name}
                    className="w-full aspect-video object-cover rounded-button"
                    onError={applyHeroImageFallback}
                  />
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-2">
                      <h2 className="heading-2">{current.name}</h2>
                      {current.isMain ? (
                        <Badge className="bg-primary text-primary-foreground">الفرع الرئيسي</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 space-x-reverse">
                      <MapPin className="w-5 h-5 text-primary mt-1 shrink-0" />
                      <div>
                        <p className="font-medium mb-1">العنوان</p>
                        <p className="text-muted-foreground">{current.address}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 space-x-reverse">
                      <Phone className="w-5 h-5 text-primary mt-1 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium mb-1">الهاتف</p>
                        {currentPhones.length ? (
                          <ul className="text-muted-foreground space-y-1 list-none m-0 p-0">
                            {currentPhones.map((num, pi) => (
                              <li key={`${pi}-${num}`}>
                                <a
                                  href={phoneHref(num)}
                                  className="hover:text-primary underline-offset-2 hover:underline break-all inline-block text-start"
                                  dir="ltr"
                                >
                                  {num}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>

                    {current.email ? (
                      <div className="flex items-start space-x-3 space-x-reverse">
                        <Mail className="w-5 h-5 text-primary mt-1 shrink-0" aria-hidden />
                        <div>
                          <p className="font-medium mb-1">البريد</p>
                          <p className="text-muted-foreground break-all">{current.email}</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start space-x-3 space-x-reverse">
                      <Clock className="w-5 h-5 text-primary mt-1 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium mb-2">ساعات العمل</p>
                        <ul className="text-muted-foreground text-sm space-y-2 list-none m-0 p-0">
                          {hourLines.map((line, lineIdx) => (
                            <li key={`${lineIdx}-${line.slice(0, 24)}`} className="flex gap-2 items-baseline text-right">
                              <span className="text-primary shrink-0" aria-hidden>
                                •
                              </span>
                              <span className="flex-1 min-w-0 leading-relaxed">{line}</span>
                            </li>
                          ))}
                        </ul>
                        <p
                          className={`text-xs mt-3 ${getCurrentStatus() === 'مفتوح الآن' ? 'text-success' : 'text-muted-foreground'}`}
                        >
                          الحالة العامة: {getCurrentStatus()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">الخدمات المتاحة</h3>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_SERVICES.map((service) => (
                        <Badge key={service} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button className="flex-1 btn-primary" asChild>
                      <a href={current.directionsUrl} target="_blank" rel="noopener noreferrer">
                        <Navigation className="w-4 h-4 ml-2" />
                        احصل على الاتجاهات
                      </a>
                    </Button>
                    {primaryPhone ? (
                      <Button variant="outline" className="flex-1" asChild>
                        <a href={phoneHref(primaryPhone)}>
                          <Phone className="w-4 h-4 ml-2" />
                          اتصل بالفرع
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {currentPhones.length > 1 ? (
                    <p className="text-xs text-muted-foreground text-center sm:text-right">
                      أرقام إضافية:{' '}
                      {currentPhones.slice(1).map((num, i) => (
                        <span key={num}>
                          {i > 0 ? ' · ' : null}
                          <a href={phoneHref(num)} className="text-primary hover:underline" dir="ltr">
                            {num}
                          </a>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Locations;
