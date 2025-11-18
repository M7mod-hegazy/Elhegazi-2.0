import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import HeroSection from '@/components/ui/HeroSection';
import { Ruler, Move3D, Palette, Save, Lightbulb, Settings, User, Share } from 'lucide-react';

const RoomPlannerWelcome = () => {
  const [roomName, setRoomName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      // Save room name to localStorage
      localStorage.setItem('currentRoomName', roomName);
      // Mark as a fresh project and navigate to the planner with new=1 to force Start Choice modal
      try { sessionStorage.setItem('planner_new_project', '1'); } catch {}
      navigate('/room-planner/design?new=1');
    }
  };

  const features = [
    {
      icon: Move3D,
      title: 'تصميم ثلاثي الأبعاد واقعي',
      description: 'شاهد كيف ستبدو منتجاتنا في غرفتك الفعلية مع أدوات التصميم المتقدمة'
    },
    {
      icon: Ruler,
      title: 'قياسات دقيقة',
      description: 'احسب الكميات المطلوبة بدقة باستخدام أبعاد حقيقية للمنتجات'
    },
    {
      icon: Palette,
      title: 'تخصيص كامل',
      description: 'أضف جدرانًا وأعمدة ورفوفًا بمواصفاتك المحددة'
    },
    {
      icon: Save,
      title: 'حفظ ومشاركة',
      description: 'احفظ تصاميمك وشاركها مع الآخرين عبر روابط مخصصة'
    }
  ];

  const steps = [
    {
      icon: Lightbulb,
      number: '1',
      title: 'أنشئ غرفة جديدة',
      description: 'ابدأ بتصميم غرفة جديدة أو استخدم قالب جاهز من مجموعتنا'
    },
    {
      icon: Settings,
      number: '2',
      title: 'خصص الأبعاد',
      description: 'اضبط عرض وارتفاع وعمق الجدران والمنتجات بدقة'
    },
    {
      icon: User,
      number: '3',
      title: 'أضف المنتجات',
      description: 'ضع الرفوف والأعمدة والأثاث في المواقع المحددة'
    },
    {
      icon: Share,
      number: '4',
      title: 'احفظ وشارك',
      description: 'احفظ تصميمك وشاركه مع فريقك أو عميلك'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <HeroSection
        title="مخطط الغرفة ثلاثي الأبعاد"
        subtitle="صمم مساحتك الحلم"
        description="صمم غرفتك الحلم باستخدام أدواتنا ثلاثية الأبعاد المتقدمة. صور كيف ستبدو الرفوف والأثاث في مساحتك الفعلية."
        variant="image"
        backgroundImage="https://images.unsplash.com/photo-1618544976420-1f213fcf2052?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB0ZWFtJTIwbW9kZXJuJTIwcHJvZmVzc2lvbmFsJTIwd29ya3NwYWNlfGVufDB8MHx8Ymx1ZXwxNzU1NzA3ODUwfDA&ixlib=rb-4.1.0&q=85"
        backgroundImageAlt="modern office space with blue lighting, professional team working, contemporary interior design"
        size="lg"
      >
      </HeroSection>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="heading-2 mb-4">ميزات المخطط</h2>
            <p className="body-large">ما الذي يجعل مخططنا فريدًا ومفيدًا لك</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-elegant text-center space-y-4 hover:shadow-lg transition-shadow duration-300">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
                  <feature.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="heading-3">{feature.title}</h3>
                <p className="body-text text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="heading-2 mb-4">كيف تبدأ</h2>
            <p className="body-large">خطوات بسيطة لتصميم مساحتك المثالية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="card-elegant text-center space-y-4 hover:shadow-lg transition-shadow duration-300">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto relative">
                    <step.icon className="w-8 h-8 text-primary-foreground" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">{step.number}</span>
                    </div>
                  </div>
                </div>
                <h3 className="heading-3">{step.title}</h3>
                <p className="body-text text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create Room Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-2 mb-4">ابدأ التصميم الآن</h2>
            <p className="body-large mb-8">
              أنشئ غرفة جديدة لتصميم مساحتك ورؤية كيف ستبدو منتجاتنا في بيئتك الفعلية
            </p>

            {!showCreateForm ? (
              <div className="space-y-4">
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  size="lg"
                  className="bg-gradient-primary hover:opacity-90 text-primary-foreground px-8 py-4 text-xl rounded-lg"
                >
                  إنشاء غرفة جديدة
                </Button>
                <p className="text-muted-foreground text-sm mt-4">
                  تحتاج إلى تسجيل الدخول لحفظ تصاميمك
                </p>
              </div>
            ) : (
              <Card className="card-elegant max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-center">إنشاء غرفة جديدة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">اسم الغرفة</Label>
                    <Input
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="مثلاً: غرفة المعيشة، مكتبي، إلخ"
                      className="py-3 px-4 text-lg"
                    />
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button
                      onClick={handleCreateRoom}
                      disabled={!roomName.trim()}
                      className="flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ابدأ التصميم
                    </Button>
                    <Button
                      onClick={() => setShowCreateForm(false)}
                      variant="outline"
                      className="flex-1 py-3 text-lg"
                    >
                      إلغاء
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-sm text-center mt-4">
                    ملاحظة: ستحتاج إلى تسجيل الدخول لحفظ هذا التصميم
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RoomPlannerWelcome;