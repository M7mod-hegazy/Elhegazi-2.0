import { useEffect, useState } from 'react';
import { MapPin, Clock, Phone, Navigation, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import HeroSection from '@/components/ui/HeroSection';
import HeroStats from '@/components/ui/HeroStats';
import HeroCTA from '@/components/ui/HeroCTA';
import { useSettings } from '@/hooks/useSettings';

const Locations = () => {
  const [selectedLocation, setSelectedLocation] = useState(0);
  const { workHours } = useSettings();
  const [now, setNow] = useState<Date>(new Date());

  const locations = [
    {
      id: 1,
      name: 'فرع الرياض الرئيسي',
      address: 'طريق الملك عبدالعزيز، حي الملز، الرياض 12345',
      phone: '+966 11 123 4567',
      hours: {
        weekdays: 'السبت - الخميس: 9:00 ص - 10:00 م',
        weekend: 'الجمعة: 2:00 م - 10:00 م'
      },
      services: ['تسوق مباشر', 'استلام الطلبات', 'الإرجاع والاستبدال'],
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600',
      rating: 4.8,
      reviews: 156,
      isMain: true,
      coordinates: { lat: 24.7136, lng: 46.6753 }
    },
    {
      id: 2,
      name: 'فرع جدة',
      address: 'شارع التحلية، حي الروضة، جدة 21452',
      phone: '+966 12 234 5678',
      hours: {
        weekdays: 'السبت - الخميس: 10:00 ص - 11:00 م',
        weekend: 'الجمعة: 3:00 م - 11:00 م'
      },
      services: ['تسوق مباشر', 'استلام الطلبات'],
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600',
      rating: 4.6,
      reviews: 89,
      isMain: false,
      coordinates: { lat: 21.5810, lng: 39.1653 }
    },
    {
      id: 3,
      name: 'فرع الدمام',
      address: 'طريق الأمير محمد بن فهد، حي الفيصلية، الدمام 32241',
      phone: '+966 13 345 6789',
      hours: {
        weekdays: 'السبت - الخميس: 9:30 ص - 10:30 م',
        weekend: 'الجمعة: 2:30 م - 10:30 م'
      },
      services: ['تسوق مباشر', 'استلام الطلبات', 'الصيانة'],
      image: 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600',
      rating: 4.7,
      reviews: 72,
      isMain: false,
      coordinates: { lat: 26.4207, lng: 50.0888 }
    },
    {
      id: 4,
      name: 'مركز التوزيع الرياض',
      address: 'المدينة الصناعية الثانية، الرياض 11564',
      phone: '+966 11 456 7890',
      hours: {
        weekdays: 'السبت - الخميس: 8:00 ص - 6:00 م',
        weekend: 'مغلق'
      },
      services: ['استلام الطلبات', 'المخزون'],
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600',
      rating: 4.5,
      reviews: 34,
      isMain: false,
      isWarehouse: true,
      coordinates: { lat: 24.6408, lng: 46.7728 }
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-warning fill-warning'
            : 'text-muted-foreground'
        }`}
      />
    ));
  };

  // Parse Arabic time like "9:00 ص" or "10:30 م" into minutes since midnight
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
      if (isPM && h < 12) h += 12; // 1-11 PM -> 13-23
      if (isAM && h === 12) h = 0;  // 12 AM -> 0
      return h * 60 + m;
    } catch {
      return null;
    }
  };

  // Parse range like "9:00 ص - 10:00 م" into [start,end] minutes
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
    const day = now.getDay(); // 0 Sun ... 5 Fri, 6 Sat
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    // Choose the appropriate range from settings
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Modern Compact Style */}
      <section className="relative py-12 bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-b border-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              <MapPin className="w-4 h-4" />
              اكتشف أقرب فرع إليك
            </div>
            
            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
              فروعنا ومواقعنا
            </h1>
            
            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              زورنا في أي من فروعنا المنتشرة في جميع أنحاء المملكة أو استلم طلبك من أقرب مركز توزيع
            </p>
            
            {/* Status & Hours */}
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

      {/* Map Section */}
      <section id="locations-map" className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Map */}
            <div className="lg:col-span-2">
              <div className="card-elegant h-96 lg:h-[600px] overflow-hidden">
                <div className="w-full h-full relative">
                  {/* Live status overlay */}
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
                  
                  {/* Location name overlay */}
                  <div className="absolute bottom-4 left-4 right-4 z-10">
                    <div className="bg-primary/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-primary-foreground/20">
                      <p className="text-sm font-semibold text-primary-foreground">
                        {locations[selectedLocation].name}
                      </p>
                      <p className="text-xs text-primary-foreground/70 mt-1">
                        {locations[selectedLocation].address}
                      </p>
                    </div>
                  </div>
                  
                  {/* Google Maps iframe */}
                  <iframe
                    title={`خريطة ${locations[selectedLocation].name}`}
                    src={`https://www.google.com/maps?q=${locations[selectedLocation].coordinates.lat},${locations[selectedLocation].coordinates.lng}&hl=ar&z=15&output=embed`}
                    className="w-full h-full rounded-button border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            {/* Locations List */}
            <div className="space-y-4">
              <h2 className="heading-2 mb-6">اختر الفرع</h2>
              {locations.map((location, index) => (
                <button
                  key={location.id}
                  onClick={() => setSelectedLocation(index)}
                  className={`w-full text-right p-4 rounded-card border-2 transition-all duration-300 ease-out ${
                    selectedLocation === index
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      {location.isMain && (
                        <Badge className="bg-primary text-primary-foreground">
                          الفرع الرئيسي
                        </Badge>
                      )}
                      {location.isWarehouse && (
                        <Badge variant="secondary">
                          مركز توزيع
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        getCurrentStatus() === 'مفتوح الآن'
                          ? 'bg-success/20 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {getCurrentStatus()}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1">{location.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{location.address}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 space-x-reverse">
                      {renderStars(location.rating)}
                      <span className="text-sm text-muted-foreground mr-2">
                        ({location.reviews})
                      </span>
                    </div>
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

      {/* Selected Location Details */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="card-elegant">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Location Image */}
                <div>
                  <img
                    src={locations[selectedLocation].image}
                    alt={locations[selectedLocation].name}
                    className="w-full aspect-video object-cover rounded-button"
                  />
                </div>

                {/* Location Details */}
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-2">
                      <h2 className="heading-2">{locations[selectedLocation].name}</h2>
                      {locations[selectedLocation].isMain && (
                        <Badge className="bg-primary text-primary-foreground">
                          الفرع الرئيسي
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 space-x-reverse mb-4">
                      {renderStars(locations[selectedLocation].rating)}
                      <span className="font-medium mr-2">{locations[selectedLocation].rating}</span>
                      <span className="text-muted-foreground">
                        ({locations[selectedLocation].reviews} تقييم)
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 space-x-reverse">
                      <MapPin className="w-5 h-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium mb-1">العنوان</p>
                        <p className="text-muted-foreground">{locations[selectedLocation].address}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 space-x-reverse">
                      <Phone className="w-5 h-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium mb-1">الهاتف</p>
                        <p className="text-muted-foreground">{locations[selectedLocation].phone}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 space-x-reverse">
                      <Clock className="w-5 h-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium mb-1">ساعات العمل</p>
                        <div className="text-muted-foreground space-y-1">
                          <p>السبت - الخميس: {workHours.weekdays}</p>
                          <p>الجمعة: {workHours.friday}</p>
                          <p className={`text-xs ${getCurrentStatus() === 'مفتوح الآن' ? 'text-success' : 'text-muted-foreground'}`}>
                            الحالة: {getCurrentStatus()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  <div>
                    <h3 className="font-semibold mb-3">الخدمات المتاحة</h3>
                    <div className="flex flex-wrap gap-2">
                      {locations[selectedLocation].services.map((service, index) => (
                        <Badge key={index} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button className="flex-1 btn-primary">
                      <Navigation className="w-4 h-4 ml-2" />
                      احصل على الاتجاهات
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Phone className="w-4 h-4 ml-2" />
                      اتصل بالفرع
                    </Button>
                  </div>
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