import { Shield, Lock, ArrowRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface UnauthorizedAccessProps {
  resource?: string;
  message?: string;
}

const UnauthorizedAccess = ({ resource, message }: UnauthorizedAccessProps) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
        <CardContent className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-red-500 to-orange-600 rounded-full p-6 shadow-xl">
                <Lock className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black text-center mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            غير مصرح بالوصول
          </h2>

          {/* Message */}
          <div className="text-center space-y-4 mb-8">
            <p className="text-lg text-slate-700 font-medium">
              {message || 'ليس لديك صلاحية للوصول إلى هذه الصفحة'}
            </p>
            
            {resource && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full">
                <Shield className="w-4 h-4 text-red-600" />
                <span className="text-sm font-bold text-red-700">
                  المورد المطلوب: {resource}
                </span>
              </div>
            )}

            <p className="text-sm text-slate-600">
              يرجى الاتصال بالمسؤول الرئيسي (SuperAdmin) للحصول على الصلاحيات المطلوبة
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              variant="default"
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
            >
              <Link to="/admin/dashboard" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                العودة للوحة التحكم
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-2 border-slate-300 hover:bg-slate-100"
            >
              <Link to="/" className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                الصفحة الرئيسية
              </Link>
            </Button>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-primary/5 border-2 border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-700">
                <p className="font-bold text-primary mb-1">نظام الصلاحيات:</p>
                <ul className="space-y-1 text-slate-600">
                  <li>• <strong>SuperAdmin</strong>: صلاحيات كاملة لجميع الموارد</li>
                  <li>• <strong>Admin</strong>: صلاحيات محددة يتحكم بها SuperAdmin</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedAccess;
