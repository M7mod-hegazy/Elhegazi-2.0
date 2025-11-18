import { useState, useEffect } from 'react';
import { useDualAuth } from '@/hooks/useDualAuth';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPatchJson } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  User, 
  MapPin, 
  CreditCard, 
  Clock,
  Bell,
  Truck
} from 'lucide-react';

const Profile = () => {
  const { user, isAuthenticated, updateProfile } = useDualAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    deliveryPreferences: '',
    notificationPreferences: {
      email: true,
      sms: false
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        deliveryPreferences: user.deliveryPreferences || '',
        notificationPreferences: {
          email: user.notificationPreferences?.email ?? true,
          sms: user.notificationPreferences?.sms ?? false
        }
      });
    }
  }, [isAuthenticated, user]);

  const handleSave = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const res = await apiPatchJson(`/api/users/${user.id}`, formData);
      if (res.ok && res.item) {
        updateProfile(res.item);
        setEditing(false);
        toast({
          title: 'نجاح',
          description: 'تم تحديث الملف الشخصي بنجاح',
        });
      } else {
        throw new Error((res as any).error || 'فشل في تحديث الملف الشخصي');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث الملف الشخصي',
        variant: 'destructive'
      });
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="heading-1 text-center mb-8">الملف الشخصي</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>معلومات الحساب</CardTitle>
                <CardDescription>إدارة معلوماتك الشخصية وتفضيلاتك</CardDescription>
              </div>
              {!editing ? (
                <Button onClick={() => setEditing(true)}>تعديل</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? 'جاري الحفظ...' : 'حفظ'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">الاسم الأول</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">اسم العائلة</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deliveryPreferences">تفضيلات التوصيل</Label>
                  <Textarea
                    id="deliveryPreferences"
                    value={formData.deliveryPreferences}
                    onChange={(e) => setFormData({...formData, deliveryPreferences: e.target.value})}
                    placeholder="مثلاً: توصيل في المساء، أو عند شخص معين..."
                    rows={3}
                  />
                </div>
                
                <div className="space-y-4">
                  <Label>تفضيلات الإشعارات</Label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        checked={formData.notificationPreferences.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          notificationPreferences: {
                            ...formData.notificationPreferences,
                            email: e.target.checked
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="emailNotifications" className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        البريد الإلكتروني
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smsNotifications"
                        checked={formData.notificationPreferences.sms}
                        onChange={(e) => setFormData({
                          ...formData,
                          notificationPreferences: {
                            ...formData.notificationPreferences,
                            sms: e.target.checked
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="smsNotifications" className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        الرسائل النصية
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">الاسم الأول</p>
                    <p className="font-medium">{user.firstName || 'غير محدد'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">اسم العائلة</p>
                    <p className="font-medium">{user.lastName || 'غير محدد'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                  <p className="font-medium">{user.phone || 'غير محدد'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">تفضيلات التوصيل</p>
                  <p className="font-medium">{user.deliveryPreferences || 'غير محدد'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">تفضيلات الإشعارات</p>
                  <div className="flex gap-4 mt-1">
                    {user.notificationPreferences?.email && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        <Bell className="w-3 h-3" />
                        البريد الإلكتروني
                      </span>
                    )}
                    {user.notificationPreferences?.sms && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                        <Bell className="w-3 h-3" />
                        الرسائل النصية
                      </span>
                    )}
                    {!user.notificationPreferences?.email && !user.notificationPreferences?.sms && (
                      <span className="text-muted-foreground">لا توجد تفضيلات</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">نوع الحساب</p>
                  <p className="font-medium">{user.role === 'admin' ? 'مدير' : 'عميل'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center gap-2">
            <Link to="/order-history">
              <Package className="w-6 h-6" />
              <span>سجل الطلبات</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center gap-2">
            <Link to="/orders">
              <Truck className="w-6 h-6" />
              <span>طلباتي</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center gap-2">
            <Link to="/profile/address">
              <MapPin className="w-6 h-6" />
              <span>عناوين الشحن</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex flex-col items-center justify-center gap-2">
            <Link to="/profile/payment">
              <CreditCard className="w-6 h-6" />
              <span>طرق الدفع</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;