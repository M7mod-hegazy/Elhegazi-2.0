import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, User, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin, error, isAdminAuthenticated } = useDualAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (isAdminAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdminAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Attempting admin login
      const result = await adminLogin({ email, password });
      // Login result received

      if (result.success && result.isAdmin) {
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك في لوحة التحكم الإدارية",
        });
        // Login successful, redirecting

        // Use setTimeout to allow state to update, then navigate
        setTimeout(() => {
          // Navigating to dashboard
          navigate('/admin/dashboard', { replace: true });
        }, 200);
      } else if (result.success && !result.isAdmin) {
        toast({
          title: "خطأ في الصلاحيات",
          description: "هذا الحساب ليس له صلاحيات إدارية",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Login failed:', err);
      toast({
        title: "خطأ في تسجيل الدخول",
        description: err instanceof Error ? err.message : "يرجى التحقق من البيانات المدخلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Morphing Background Shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-10 -left-20 w-80 h-80 bg-primary/25 mix-blend-multiply filter blur-2xl opacity-90"
          style={{ 
            animation: 'blob-1 8s infinite ease-in-out',
            animationDelay: '0s'
          }}
        ></div>
        <div 
          className="absolute top-0 -right-20 w-96 h-96 bg-secondary/25 mix-blend-multiply filter blur-2xl opacity-90"
          style={{ 
            animation: 'blob-2 10s infinite ease-in-out',
            animationDelay: '2s'
          }}
        ></div>
        <div 
          className="absolute -bottom-20 left-10 w-72 h-72 bg-accent/25 mix-blend-multiply filter blur-2xl opacity-90"
          style={{ 
            animation: 'blob-3 12s infinite ease-in-out',
            animationDelay: '4s'
          }}
        ></div>
        <div 
          className="absolute bottom-20 right-10 w-64 h-64 bg-primary/15 mix-blend-multiply filter blur-xl opacity-70"
          style={{ 
            animation: 'blob-1 15s infinite ease-in-out reverse',
            animationDelay: '6s'
          }}
        ></div>
      </div>

      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <Card className="w-full max-w-md bg-white border-0 shadow-2xl relative z-10">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              لوحة التحكم الإدارية
            </CardTitle>
            <CardDescription className="text-slate-600 mt-2">
              تسجيل الدخول للمسؤولين فقط
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10 h-12 border-slate-200 focus:border-primary focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-12 border-slate-200 focus:border-primary focus:ring-primary"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-medium shadow-lg transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  جاري التحقق...
                </div>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>
          </form>

          <div className="text-center pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              للمساعدة اتصل بمدير النظام
            </p>
            <div className="mt-2 text-xs text-primary font-medium">
              demo: admin@superuser.com / SuperAdmin2024!
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;