import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Sparkles, Mail, Lock } from 'lucide-react';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useLogo } from '@/hooks/useLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButton } from '@/components/ui/loading';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';

const LoginNew = () => {
  // Set page title
  usePageTitle('تسجيل الدخول');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loading, error, clearError, isAuthenticated } = useDualAuth();
  const { toast } = useToast();
  const { logo, isLoading: logoLoading } = useLogo();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Clear errors when form changes
  useEffect(() => {
    if (error) clearError();
    setFormErrors({});
  }, [formData, error, clearError]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'البريد الإلكتروني غير صحيح';
    }

    if (!formData.password) {
      errors.password = 'كلمة المرور مطلوبة';
    } else if (formData.password.length < 6) {
      errors.password = 'كلمة المرور يجب أن تكون على الأقل 6 أحرف';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const result = await login(formData);

      if (result.success) {
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: `مرحباً ${result.user?.firstName} ${result.user?.lastName}`,
          variant: "default"
        });

        window.location.href = location.state?.from?.pathname || '/';
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-br from-purple-400/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-br from-pink-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/10 to-indigo-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glass Card */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8 space-y-8 transform hover:scale-[1.02] transition-all duration-500">
          
          {/* Header with Logo */}
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl p-4 shadow-xl">
                {!logoLoading && (
                  <img 
                    src={logo.url} 
                    alt={logo.altText}
                    className="h-16 w-16 object-contain"
                  />
                )}
                {logoLoading && (
                  <Sparkles className="h-10 w-10 text-white animate-pulse" />
                )}
              </div>
            </div>
            
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                مرحباً بك
              </h1>
              <p className="text-slate-600 font-medium">
                سجل دخولك للمتابعة
              </p>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 border-2 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
            disabled={loading}
            onClick={async () => {
              const res = await loginWithGoogle();
              if (res.success) {
                toast({ title: 'تم تسجيل الدخول عبر Google', variant: 'default' });
                window.location.href = location.state?.from?.pathname || '/';
              } else {
                toast({ title: 'فشل تسجيل الدخول عبر Google', description: res.error ?? 'حاول مرة أخرى', variant: 'destructive' });
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 ml-2 group-hover:scale-110 transition-transform">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.748 32.91 29.277 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.999 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.297 16.246 18.787 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.999 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.217 0 9.86-1.995 13.409-5.243l-6.191-5.238C29.121 35.672 26.671 36.6 24 36c-5.258 0-9.716-3.068-11.589-7.447l-6.552 5.046C9.182 39.556 16.055 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.076 3.157-3.211 5.61-5.894 7.003l.001-.001 6.191 5.238C38.37 37.386 40 31.999 40 26c0-1.341-.138-2.651-.389-3.917z"/>
            </svg>
            <span className="font-semibold">تسجيل الدخول بواسطة Google</span>
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 text-slate-500 font-medium">أو</span>
            </div>
          </div>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Global Error */}
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50/80 backdrop-blur-sm animate-in slide-in-from-top-2">
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                البريد الإلكتروني
              </Label>
              <div className={`relative transition-all duration-300 ${isEmailFocused ? 'scale-[1.02]' : ''}`}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  className={`h-12 bg-white/50 backdrop-blur-sm border-2 transition-all duration-300 ${
                    isEmailFocused 
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' 
                      : 'border-slate-200 hover:border-indigo-300'
                  } ${formErrors.email ? 'border-red-400' : ''}`}
                  placeholder="example@email.com"
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-red-600 font-medium animate-in slide-in-from-top-1">{formErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                كلمة المرور
              </Label>
              <div className={`relative transition-all duration-300 ${isPasswordFocused ? 'scale-[1.02]' : ''}`}>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  className={`h-12 pl-12 bg-white/50 backdrop-blur-sm border-2 transition-all duration-300 ${
                    isPasswordFocused 
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' 
                      : 'border-slate-200 hover:border-indigo-300'
                  } ${formErrors.password ? 'border-red-400' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg hover:bg-primary/10 transition-all duration-300 group"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors" />
                  )}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-xs text-red-600 font-medium animate-in slide-in-from-top-1">{formErrors.password ?? ''}</p>
              )}
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                />
                <span className="text-slate-600 group-hover:text-slate-900 transition-colors">تذكرني</span>
              </label>
              
              <Link
                to="/forgot-password"
                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            {/* Submit Button */}
            <LoadingButton
              type="submit"
              isLoading={loading}
              className="w-full h-12 bg-gradient-to-r from-primary via-secondary to-primary hover:from-primary hover:via-secondary hover:to-primary shadow-lg hover:shadow-xl hover:shadow-primary/50 font-bold text-base rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              <LogIn className="w-5 h-5 ml-2" />
              تسجيل الدخول
            </LoadingButton>

            {/* Sign Up Link */}
            <div className="text-center pt-4 border-t border-slate-200">
              <span className="text-sm text-slate-600">
                ليس لديك حساب؟{' '}
                <Link
                  to="/register"
                  className="font-bold text-primary hover:text-primary hover:underline transition-all"
                >
                  إنشاء حساب جديد
                </Link>
              </span>
            </div>
          </form>
        </div>

        {/* Footer Text */}
        <p className="text-center mt-6 text-sm text-slate-600">
          بتسجيل الدخول، أنت توافق على{' '}
          <Link to="/terms" className="text-indigo-600 hover:underline font-medium">
            الشروط والأحكام
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginNew;
