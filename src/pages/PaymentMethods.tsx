import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus } from 'lucide-react';

const PaymentMethods = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">طرق الدفع</h1>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة بطاقة جديدة
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              بطاقاتي المحفوظة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-500">
              <CreditCard className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg mb-2">لا توجد بطاقات محفوظة</p>
              <p className="text-sm">أضف بطاقة دفع للدفع السريع</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentMethods;
