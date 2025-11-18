import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Plus } from 'lucide-react';

const Addresses = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">عناوين الشحن</h1>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة عنوان جديد
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              عناويني المحفوظة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-500">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg mb-2">لا توجد عناوين محفوظة</p>
              <p className="text-sm">أضف عنوان شحن جديد للبدء</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Addresses;
