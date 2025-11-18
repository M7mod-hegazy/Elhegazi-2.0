import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/context/ThemeContext';
import { apiPostJson } from '@/lib/api';
import { Sparkles, Store, Phone, Briefcase, ChevronRight, ArrowRight } from 'lucide-react';

const SHOP_FIELDS = [
  { id: 'furniture', label: 'أثاث', labelEn: 'Furniture' },
  { id: 'electronics', label: 'إلكترونيات', labelEn: 'Electronics' },
  { id: 'fashion', label: 'ملابس وأزياء', labelEn: 'Fashion' },
  { id: 'food', label: 'غذائيات', labelEn: 'Food & Beverages' },
  { id: 'beauty', label: 'جمال وعناية', labelEn: 'Beauty & Care' },
  { id: 'home', label: 'ديكور المنزل', labelEn: 'Home Decor' },
  { id: 'sports', label: 'رياضة واللياقة', labelEn: 'Sports & Fitness' },
  { id: 'books', label: 'كتب ومجلات', labelEn: 'Books & Magazines' },
  { id: 'other', label: 'أخرى', labelEn: 'Other' },
];

export default function ShopSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryColor, secondaryColor } = useTheme();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    shopName: '',
    phone: '',
    field: '',
    customField: '',
  });

  const handleFieldChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      field: value,
      customField: value === 'other' ? prev.customField : '',
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.ownerName.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال اسمك', variant: 'destructive' });
      return;
    }
    if (!formData.shopName.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال اسم المتجر', variant: 'destructive' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال رقم الهاتف', variant: 'destructive' });
      return;
    }
    if (!formData.field) {
      toast({ title: 'خطأ', description: 'الرجاء اختيار مجال المتجر', variant: 'destructive' });
      return;
    }
    if (formData.field === 'other' && !formData.customField.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال مجال المتجر المخصص', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ownerName: formData.ownerName.trim(),
        shopName: formData.shopName.trim(),
        phone: formData.phone.trim(),
        field: formData.field === 'other' ? formData.customField.trim() : formData.field,
        isCustomField: formData.field === 'other',
        customField: formData.field === 'other' ? formData.customField.trim() : '',
      };

      const resp = await apiPostJson('/api/shop-setup', payload);
      if (resp.ok) {
        toast({ title: 'نجح', description: 'تم حفظ بيانات المتجر بنجاح' });
        window.dispatchEvent(new Event('shop-setup-updated'));
        setTimeout(() => navigate('/shop-builder'), 500);
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ البيانات', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحفظ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}15 100%)` }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8" style={{ color: primaryColor }} />
            <h1 className="text-4xl md:text-5xl font-bold">إنشاء متجرك</h1>
          </div>
          <p className="text-slate-600 text-lg">ابدأ رحلتك في عالم التجارة الإلكترونية</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-slate-200">
            <div 
              className="h-full transition-all duration-500" 
              style={{ width: `${(step / 4) * 100}%`, backgroundColor: primaryColor }}
            />
          </div>

          <div className="p-8 md:p-12">
            {/* Step 1: Owner Name */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl font-bold mb-2">ما اسمك؟</h2>
                  <p className="text-slate-600">سنستخدم هذا الاسم لتعريفك</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerName" className="text-base">اسمك الكامل</Label>
                  <Input
                    id="ownerName"
                    placeholder="أدخل اسمك الكامل"
                    value={formData.ownerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                    className="h-12 text-base"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Shop Name */}
            {step === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl font-bold mb-2">اسم متجرك</h2>
                  <p className="text-slate-600">اختر اسماً فريداً وجذاباً لمتجرك</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shopName" className="text-base flex items-center gap-2">
                    <Store className="h-5 w-5" style={{ color: primaryColor }} />
                    اسم المتجر
                  </Label>
                  <Input
                    id="shopName"
                    placeholder="أدخل اسم متجرك"
                    value={formData.shopName}
                    onChange={(e) => setFormData(prev => ({ ...prev, shopName: e.target.value }))}
                    className="h-12 text-base"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Phone */}
            {step === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl font-bold mb-2">رقم الهاتف</h2>
                  <p className="text-slate-600">سنستخدمه للتواصل معك</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base flex items-center gap-2">
                    <Phone className="h-5 w-5" style={{ color: primaryColor }} />
                    رقم الهاتف
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+966 50 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-12 text-base"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Field */}
            {step === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl font-bold mb-2">مجال متجرك</h2>
                  <p className="text-slate-600">اختر المجال الذي يناسب متجرك</p>
                </div>
                <div className="space-y-3">
                  <Label className="text-base flex items-center gap-2">
                    <Briefcase className="h-5 w-5" style={{ color: primaryColor }} />
                    نوع المتجر
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SHOP_FIELDS.map(field => (
                      <button
                        key={field.id}
                        onClick={() => handleFieldChange(field.id)}
                        className={`p-4 rounded-lg border-2 transition-all text-right ${
                          formData.field === field.id
                            ? 'border-2'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        style={{
                          borderColor: formData.field === field.id ? primaryColor : undefined,
                          backgroundColor: formData.field === field.id ? `${primaryColor}10` : undefined,
                        }}
                      >
                        <p className="font-semibold text-slate-900">{field.label}</p>
                        <p className="text-sm text-slate-600">{field.labelEn}</p>
                      </button>
                    ))}
                  </div>

                  {/* Custom Field Input */}
                  {formData.field === 'other' && (
                    <div className="space-y-2 mt-4 p-4 rounded-lg" style={{ backgroundColor: `${primaryColor}10` }}>
                      <Label htmlFor="customField" className="text-base">حدد مجالك الخاص</Label>
                      <Input
                        id="customField"
                        placeholder="أدخل مجال متجرك"
                        value={formData.customField}
                        onChange={(e) => setFormData(prev => ({ ...prev, customField: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-12">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 h-12"
                >
                  السابق
                </Button>
              )}
              {step < 4 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  className="flex-1 h-12 gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  التالي
                  <ChevronRight className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 h-12 gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {loading ? 'جاري الحفظ...' : 'ابدأ الآن'}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Step Indicator */}
            <div className="flex justify-center gap-2 mt-8">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: step === s ? '24px' : '8px',
                    backgroundColor: step >= s ? primaryColor : '#e2e8f0',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 mt-8">
          بيانات آمنة وسهلة التعديل في أي وقت
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
