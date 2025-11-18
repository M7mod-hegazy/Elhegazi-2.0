import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AddressAutocomplete from '@/components/checkout/AddressAutocomplete';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
}

interface User {
  id: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
  };
}

interface CustomerInfoStepProps {
  isGuestCheckout: boolean;
  onGuestCheckoutChange: (isGuest: boolean) => void;
  customerInfo: CustomerInfo;
  onCustomerInfoChange: (field: keyof CustomerInfo, value: string) => void;
  user?: User;
  errors: Record<string, string>;
}

const CustomerInfoStep: React.FC<CustomerInfoStepProps> = ({
  isGuestCheckout,
  onGuestCheckoutChange,
  customerInfo,
  onCustomerInfoChange,
  user,
  errors
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Guest Checkout Toggle */}
      <motion.div variants={itemVariants}>
        <Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>معلومات العميل</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">الطلب كضيف</span>
                <Toggle
                  pressed={isGuestCheckout}
                  onPressedChange={onGuestCheckoutChange}
                  className="data-[state=on]:bg-primary"
                >
                  {isGuestCheckout ? 'مفعل' : 'معطل'}
                </Toggle>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: isGuestCheckout ? 'auto' : 'auto',
                opacity: 1 
              }}
              transition={{ duration: 0.3 }}
            >
              {isGuestCheckout ? (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    يمكنك متابعة الطلب بدون إنشاء حساب. سيتم إرسال تفاصيل الطلب إلى بريدك الإلكتروني.
                  </AlertDescription>
                </Alert>
              ) : user ? (
                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">البريد:</span> 
                        <span className="text-gray-700 mr-2">{user.email}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">الهاتف:</span> 
                        <span className="text-gray-700 mr-2">{user.phone || 'غير محدد'}</span>
                      </span>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">العنوان:</span> 
                        <span className="text-gray-700 mr-2">
                          {user?.address ? `${user.address.street}, ${user.address.city}` : 'غير محدد'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert className="border-primary/20 bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    يرجى تسجيل الدخول أو تفعيل الطلب كضيف للمتابعة.
                  </AlertDescription>
                </Alert>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Guest Information Form */}
      {isGuestCheckout && (
        <motion.div variants={itemVariants}>
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                بيانات الاتصال
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                    <User className="w-4 h-4 text-gray-500" />
                    الاسم الكامل *
                  </Label>
                  <Input
                    id="name"
                    placeholder="أدخل اسمك الكامل"
                    value={customerInfo.name}
                    onChange={(e) => onCustomerInfoChange('name', e.target.value)}
                    className={`transition-all duration-200 ${
                      errors.name ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                    }`}
                  />
                  {errors.name && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="w-4 h-4 text-gray-500" />
                    البريد الإلكتروني *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@example.com"
                    value={customerInfo.email}
                    onChange={(e) => onCustomerInfoChange('email', e.target.value)}
                    className={`transition-all duration-200 ${
                      errors.email ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                    }`}
                  />
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="w-4 h-4 text-gray-500" />
                    رقم الهاتف *
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+966 123 456 7890"
                    value={customerInfo.phone}
                    onChange={(e) => onCustomerInfoChange('phone', e.target.value)}
                    className={`transition-all duration-200 ${
                      errors.phone ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                    }`}
                  />
                  {errors.phone && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.phone}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="country" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    الدولة
                  </Label>
                  <Select
                    value={customerInfo.country}
                    onValueChange={(value) => onCustomerInfoChange('country', value)}
                  >
                    <SelectTrigger className="focus:border-primary">
                      <SelectValue placeholder="حدد الدولة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sa">المملكة العربية السعودية</SelectItem>
                      <SelectItem value="ae">الإمارات العربية المتحدة</SelectItem>
                      <SelectItem value="eg">مصر</SelectItem>
                      <SelectItem value="kw">الكويت</SelectItem>
                      <SelectItem value="qa">قطر</SelectItem>
                      <SelectItem value="bh">البحرين</SelectItem>
                      <SelectItem value="om">عمان</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div variants={itemVariants} className="md:col-span-2 space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    العنوان التفصيلي *
                  </Label>
                  <AddressAutocomplete
                    value={customerInfo.address}
                    onChange={(value) => onCustomerInfoChange('address', value)}
                    placeholder="ابحث عن العنوان أو أدخله يدويًا"
                    className={`transition-all duration-200 ${
                      errors.address ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                    }`}
                  />
                  {errors.address && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.address}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">المدينة</Label>
                  <Input
                    id="city"
                    placeholder="أدخل المدينة"
                    value={customerInfo.city}
                    onChange={(e) => onCustomerInfoChange('city', e.target.value)}
                    className="focus:border-primary"
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="postalCode" className="text-sm font-medium">الرمز البريدي</Label>
                  <Input
                    id="postalCode"
                    placeholder="12345"
                    value={customerInfo.postalCode}
                    onChange={(e) => onCustomerInfoChange('postalCode', e.target.value)}
                    className="focus:border-primary"
                  />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default CustomerInfoStep;