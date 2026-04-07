const fs = require('fs');
const file = 'c:/Users/M7mod Hegazy/Desktop/asd/django/arabian-blue-bloom-main/src/pages/admin/HomeConfig.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const layout = `  return (
    <AdminLayout>
      <div className="bg-background min-h-screen text-foreground pb-32 transition-colors duration-300">
        
        {/* Universal Header */}
        <div className="bg-card border-b border-border p-6 md:p-8 rounded-b-3xl shadow-sm mb-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
                <Home className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground">إعداد الصفحة الرئيسية</h1>
                <p className="text-muted-foreground text-sm font-medium mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  تخصيص ترتيب ومحتوى واجهة المتجر
                </p>
              </div>
            </div>
            
            <div className="flex w-full md:w-auto items-center gap-3">
              <div className={\`hidden lg:flex px-4 py-2 rounded-xl text-sm font-bold border shadow-sm \${isValid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}\`}>
                {isValid ? 'جاهز للنشر' : 'مطلوب مراجعة'}
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.open('/', '_blank')}
                className="flex-1 md:flex-none border-border hover:bg-muted text-foreground"
              >
                <Eye className="w-4 h-4 ml-2" /> معاينة
              </Button>
              <Button 
                onClick={() => save(false)} 
                disabled={saving || !isValid}
                className="flex-1 md:flex-none bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
                ) : (
                  <Save className="w-4 h-4 ml-2" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </div>

        {/* Concept A: Settings Vertical Blocks */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-6">
          
          {/* Main Hero Group */}
          <section className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">القسم الرئيسي (Hero)</h2>
              </div>
              <Switch checked={cfg.heroEnabled} onCheckedChange={(val) => setCfg({ ...cfg, heroEnabled: val })} />
            </div>

            <div className="p-2 space-y-2">
              <div 
                onClick={() => setHeroSlidesOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">إدارة الشرائح والصور</h3>
                  <p className="text-sm text-muted-foreground">{cfg.slides.length} شريحة حالية معروضة</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                  <Edit className="w-5 h-5" />
                </div>
              </div>

              <div className="w-[calc(100%-2rem)] mx-auto h-px bg-border/50" />

              <div 
                onClick={() => setHeroDesignOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">تصميم الإطارات والشكل</h3>
                  <p className="text-sm text-muted-foreground">تعديل الارتفاع ونمط العرض والألوان الخلفية</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                  <Palette className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

          {/* Promotion Group */}
          <section className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-secondary" />
                <h2 className="text-lg font-bold">العروض والمبيعات (SEO)</h2>
              </div>
            </div>

            <div className="p-2 space-y-2">
              <div 
                onClick={() => setPromoSeoOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">الشريط الترويجي ولصقات البحث (SEO)</h3>
                  <p className="text-sm text-muted-foreground">{cfg.promoEnabled ? 'مفعل' : 'معطل'} | عنوان دال ومعبر للمحركات</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-secondary/5 flex items-center justify-center text-secondary">
                  <Megaphone className="w-5 h-5" />
                </div>
              </div>

              <div className="w-[calc(100%-2rem)] mx-auto h-px bg-border/50" />

              <div 
                onClick={() => setProductsManagementOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">المنتجات المعروضة</h3>
                  <p className="text-sm text-muted-foreground">اختيار منتجات التخفيضات والأكثر مبيعاً</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-secondary/5 flex items-center justify-center text-secondary">
                  <Package className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

          {/* Categories and Sections Group */}
          <section className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-foreground" />
                <h2 className="text-lg font-bold">نمط وواجهة العرض</h2>
              </div>
            </div>

            <div className="p-2 space-y-2">
              <div 
                onClick={() => setSectionsManagementOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">ترتيب الأقسام والفئات</h3>
                  <p className="text-sm text-muted-foreground">تحديد أماكن عرض (الفئات، العروض، أحدث المنتجات) عبر المتجر</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground">
                  <List className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

          {/* About Us */}
          <section className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
             <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-foreground" />
                <h2 className="text-lg font-bold">تخصيص "من نحن"</h2>
              </div>
            </div>

            <div className="p-2">
              <div 
                onClick={() => setAboutContentOpen(true)}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-foreground">محتوى تعريف المتجر</h3>
                  <p className="text-sm text-muted-foreground">{cfg?.aboutUsContent?.title || 'تعديل المحتوى التعريفي للشركة والإحصائيات المهمة'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground">
                  <Edit className="w-5 h-5" />
                </div>
              </div>
            </div>
          </section>

        </div>`;

const newLines = [...lines.slice(0, 505), layout, ...lines.slice(1401)];
fs.writeFileSync(file, newLines.join('\n'));
console.log('Successfully replaced lines!');
