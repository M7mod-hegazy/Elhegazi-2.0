import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiPatchJson } from '@/lib/api';
import { User } from '@/types';
import type { DeliveryPreferences as DeliveryPreferencesType } from '@/types';

interface DeliveryPreferencesProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const DeliveryPreferences: React.FC<DeliveryPreferencesProps> = ({ user, onUpdate }) => {
  const [preferences, setPreferences] = useState<DeliveryPreferencesType>({
    preferredDeliveryTime: user.deliveryPreferences?.preferredDeliveryTime || 'anytime',
    deliveryInstructions: user.deliveryPreferences?.deliveryInstructions || '',
    preferredContactMethod: user.deliveryPreferences?.preferredContactMethod || 'phone',
    allowLeaveAtDoor: user.deliveryPreferences?.allowLeaveAtDoor || false,
    requireSignature: user.deliveryPreferences?.requireSignature || false,
    specialHandling: user.deliveryPreferences?.specialHandling || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiPatchJson<User, Partial<User>>('/api/users/profile', {
        deliveryPreferences: preferences
      });
      
      if (res.ok && res.item) {
        onUpdate(res.item);
        toast({
          title: 'تم حفظ التفضيلات',
          description: 'تم حفظ تفضيلات التوصيل بنجاح',
        });
      } else {
        throw new Error('فشل في حفظ التفضيلات');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ التفضيلات',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = <T extends keyof DeliveryPreferencesType>(field: T, value: DeliveryPreferencesType[T]) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>تفضيلات التوصيل</CardTitle>
        <CardDescription>حدد تفضيلاتك لتوصيل الطلبات</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">الوقت المفضل للتوصيل</label>
            <Select 
              value={preferences.preferredDeliveryTime || 'anytime'} 
              onValueChange={(value) => handleChange('preferredDeliveryTime', value as DeliveryPreferencesType['preferredDeliveryTime'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">الصباح (8 ص - 12 م)</SelectItem>
                <SelectItem value="afternoon">بعد الظهر (12 م - 5 م)</SelectItem>
                <SelectItem value="evening">المساء (5 م - 9 م)</SelectItem>
                <SelectItem value="anytime">أي وقت</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">طريقة التواصل المفضلة</label>
            <Select 
              value={preferences.preferredContactMethod || 'phone'} 
              onValueChange={(value) => handleChange('preferredContactMethod', value as DeliveryPreferencesType['preferredContactMethod'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">الهاتف</SelectItem>
                <SelectItem value="email">البريد الإلكتروني</SelectItem>
                <SelectItem value="sms">الرسائل النصية</SelectItem>
                <SelectItem value="none">لا شيء</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">تعليمات التوصيل</label>
          <Textarea
            value={preferences.deliveryInstructions || ''}
            onChange={(e) => handleChange('deliveryInstructions', e.target.value)}
            placeholder="مثلاً: الرنين مرتين، الباب الأزرق، إلخ"
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">معالجة خاصة</label>
          <Textarea
            value={preferences.specialHandling || ''}
            onChange={(e) => handleChange('specialHandling', e.target.value)}
            placeholder="مثلاً: عناية خاصة للأدوات الزجاجية، إلخ"
            className="min-h-[100px]"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="allowLeaveAtDoor"
              checked={preferences.allowLeaveAtDoor || false}
              onChange={(e) => handleChange('allowLeaveAtDoor', e.target.checked)}
              className="h-4 w-4 text-primary rounded focus:ring-primary"
            />
            <label htmlFor="allowLeaveAtDoor" className="text-sm font-medium text-slate-700">
              يُسمح بترك الطلب عند الباب
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requireSignature"
              checked={preferences.requireSignature || false}
              onChange={(e) => handleChange('requireSignature', e.target.checked)}
              className="h-4 w-4 text-primary rounded focus:ring-primary"
            />
            <label htmlFor="requireSignature" className="text-sm font-medium text-slate-700">
              يتطلب توقيع عند الاستلام
            </label>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التفضيلات'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryPreferences;
