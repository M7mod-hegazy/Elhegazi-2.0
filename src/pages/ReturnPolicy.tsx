import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Clock, 
  CreditCard, 
  Truck,
  Shield,
  ArrowLeft
} from 'lucide-react';

const ReturnPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">سياسة الإرجاع</h1>
            <p className="text-slate-600">تعرف على سياسة الإرجاع والاستبدال لدينا</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/support">
              <ArrowLeft className="w-4 h-4 ml-2" />
              العودة إلى الدعم
            </Link>
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              سياسة الإرجاع والاستبدال
            </CardTitle>
            <CardDescription>
              تعرف على الشروط والأحكام الخاصة بإرجاع المنتجات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold text-slate-900 mb-4">الشروط العامة للإرجاع</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>يمكن إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>يجب أن يكون المنتج في حالته الأصلية مع جميع الملحقات</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>لا يمكن إرجاع المنتجات المخصصة أو المصنوعة حسب الطلب</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>يجب إرفاق الفاتورة الأصلية مع المنتج المرتجع</span>
                </li>
              </ul>

              <h2 className="text-xl font-bold text-slate-900 mb-4">المنتجات غير القابلة للإرجاع</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>المنتجات المفتوحة أو المستخدمة</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>المنتجات ذات طبيعة خاصة (منتجات العناية الشخصية، الطعام، إلخ)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>المنتجات المخصصة أو المطبوعة حسب الطلب</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>البطاقات الإلكترونية والرموز الرقمية</span>
                </li>
              </ul>

              <h2 className="text-xl font-bold text-slate-900 mb-4">إجراءات الإرجاع</h2>
              <ol className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">1.</span>
                  <span>قم بتسجيل الدخول إلى حسابك وانتقل إلى صفحة "طلباتي"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">2.</span>
                  <span>اختر الطلب الذي ترغب في إرجاعه واضغط على "طلب إرجاع"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">3.</span>
                  <span>حدد المنتجات المراد إرجاعها وسبب الإرجاع</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">4.</span>
                  <span>اختر طريقة الاسترداد (استرداد نقدي أو رصيد في المتجر)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">5.</span>
                  <span>قم بتعبئة نموذج الإرجاع وطباعته</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">6.</span>
                  <span>قم بإعادة المنتج مع النموذج إلى العنوان المحدد</span>
                </li>
              </ol>

              <h2 className="text-xl font-bold text-slate-900 mb-4">أوقات الاسترداد</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>الاسترداد النقدي: 5-7 أيام عمل بعد استلام المنتج</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>الرصيد في المتجر: فوري بعد الموافقة على الإرجاع</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>البطاقات البنكية: قد تستغرق حتى 14 يوم عمل</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">فترة الإرجاع</h3>
              <p className="text-gray-600">14 يوماً من تاريخ الاستلام</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">طرق الاسترداد</h3>
              <p className="text-gray-600">نقدي أو رصيد في المتجر</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">الضمان</h3>
              <p className="text-gray-600">استرداد كامل أو استبدال</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              شروط الشحن والإرجاع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <h3 className="font-bold text-slate-900 mb-3">تكاليف الشحن</h3>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>العميل يتحمل تكلفة الشحن في حالة الإرجاع لسبب غير متعلق بالمنتج</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">•</span>
                  <span>الشركة تتحمل تكلفة الشحن في حالة المنتجات التالفة أو غير المطابقة</span>
                </li>
              </ul>

              <h3 className="font-bold text-slate-900 mb-3">عناوين الإرجاع</h3>
              <p className="mb-4">
                يجب إرسال المنتجات المرتجعة إلى العنوان التالي:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-medium">شركة الحجازي لتجهيز المحلات</p>
                <p>قسم الإرجاعات</p>
                <p>شارع الملك فهد، الرياض، المملكة العربية السعودية</p>
                <p>الرمز البريدي: 12345</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild>
                  <Link to="/contact">اتصل بنا</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/support">الدعم الفني</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReturnPolicy;
