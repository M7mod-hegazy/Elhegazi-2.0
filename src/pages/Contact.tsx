import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingButton } from '@/components/ui/loading';
import { useSettings } from '@/hooks/useSettings';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Contact = () => {
  // Set page title
  usePageTitle('اتصل بنا');
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const contactInfo = [
    {
      icon: Phone,
      title: 'اتصل بنا',
      details: ['+966 11 123 4567', '+966 11 123 4568'],
      description: 'اتصل بنا خلال ساعات العمل'
    },
    {
      icon: Mail,
      title: 'راسلنا',
      details: ['info@bluestore.com', 'support@bluestore.com'],
      description: 'نرد على جميع الرسائل خلال 24 ساعة'
    },
    {
      icon: MapPin,
      title: 'زورنا',
      details: ['الرياض، حي الملز', 'طريق الملك عبدالعزيز'],
      description: 'مفتوح من السبت إلى الخميس'
    },
    {
      icon: Clock,
      title: 'ساعات العمل',
      details: ['السبت - الخميس: 9:00 - 22:00', 'الجمعة: 14:00 - 22:00'],
      description: 'نخدمك خلال ساعات العمل'
    }
  ];

  const subjects = [
    'استفسار عام',
    'مشكلة في الطلب',
    'إرجاع أو استبدال',
    'مشكلة فنية',
    'اقتراح أو شكوى',
    'شراكة تجارية',
    'أخرى'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      subject: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "تم الإرسال بنجاح",
        description: "شكراً لتواصلك معنا. سنرد عليك في أقرب وقت ممكن.",
        variant: "default"
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });

    } catch (error) {
      toast({
        title: "خطأ في الإرسال",
        description: "حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h1 className="heading-1 mb-6">لمعرفة السعر</h1>
          <p className="body-large max-w-2xl mx-auto">
            نحن هنا لمساعدتك. لمعرفة السعر في أي وقت وسنكون سعداء للرد على استفساراتك
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactInfo.map((info, index) => (
              <div key={index} className="card-elegant text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
                  <info.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="heading-3">{info.title}</h3>
                <div className="space-y-1">
                  {info.details.map((detail, i) => (
                    <p key={i} className="body-text font-medium">{detail}</p>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{info.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="card-elegant">
              <div className="flex items-center space-x-3 space-x-reverse mb-6">
                <MessageCircle className="w-6 h-6 text-primary" />
                <h2 className="heading-2">أرسل لنا رسالة</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <Label htmlFor="name" className="form-label">
                    الاسم الكامل *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="أدخل اسمك الكامل"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="form-label">
                    البريد الإلكتروني *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="البريد الإلكتروني"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone" className="form-label">
                    رقم الهاتف
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="رقم الهاتف (اختياري)"
                  />
                </div>

                {/* Subject */}
                <div>
                  <Label className="form-label">
                    موضوع الرسالة
                  </Label>
                  <Select value={formData.subject} onValueChange={handleSelectChange}>
                    <SelectTrigger className="input-field">
                      <SelectValue placeholder="اختر موضوع الرسالة" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div>
                  <Label htmlFor="message" className="form-label">
                    الرسالة *
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="input-field min-h-32"
                    placeholder="اكتب رسالتك هنا..."
                    required
                  />
                </div>

                {/* Submit Button */}
                <LoadingButton
                  type="submit"
                  isLoading={loading}
                  className="w-full btn-primary"
                >
                  <Send className="w-4 h-4 ml-2" />
                  إرسال الرسالة
                </LoadingButton>
              </form>
            </div>

            {/* Map & Additional Info */}
            <div className="space-y-8">
              {/* Map Placeholder */}
              <div className="card-elegant">
                <h3 className="heading-3 mb-4">موقعنا</h3>
                <div className="aspect-video bg-muted rounded-button flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="body-text">خريطة الموقع</p>
                    <p className="text-sm text-muted-foreground">
                      الرياض، المملكة العربية السعودية
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ Quick Links */}
              <div className="card-elegant">
                <h3 className="heading-3 mb-4">أسئلة شائعة</h3>
                <div className="space-y-3">
                  <div className="border-b border-border pb-2">
                    <h4 className="font-medium mb-1">كيف يمكنني تتبع طلبي؟</h4>
                    <p className="text-sm text-muted-foreground">
                      يمكنك تتبع طلبك من خلال رقم التتبع المرسل إليك
                    </p>
                  </div>
                  <div className="border-b border-border pb-2">
                    <h4 className="font-medium mb-1">ما هي سياسة الإرجاع؟</h4>
                    <p className="text-sm text-muted-foreground">
                      يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الاستلام
                    </p>
                  </div>
                  
                </div>
              </div>

              {/* Quick Contact */}
              <div className="card-elegant bg-gradient-primary text-primary-foreground">
                <h3 className="text-xl font-semibold mb-4">تحتاج مساعدة فورية؟</h3>
                <p className="text-primary-foreground/90 mb-4">
                  تواصل مع فريق المساعدة مباشرة
                </p>
                <div className="space-y-2">
                  <Button 
                    className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  >
                    <Phone className="w-4 h-4 ml-2" />
                    اتصل الآن: 4567 123 11 966+
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                  >
                    <MessageCircle className="w-4 h-4 ml-2" />
                    دردشة مباشرة
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;