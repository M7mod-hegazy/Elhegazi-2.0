import ScrollAnimation from '@/components/ui/scroll-animation';
import CategoriesDesktop from './CategoriesDesktop';
import CategoriesMobile from './CategoriesMobile';

interface CreativeCategoriesSliderProps {
  selectedSlugs?: string[];
}

const CreativeCategoriesSlider = ({ selectedSlugs }: CreativeCategoriesSliderProps) => {
  return (
    <section className="relative py-12 md:py-16 bg-gradient-to-br from-slate-50 via-primary/5 to-secondary/5 overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgb(0 0 0) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }}></div>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        {/* Premium Modern Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              {/* Animated accent bar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-1 h-12 bg-gradient-to-b from-primary via-secondary to-primary rounded-full"></div>
                  <div className="absolute inset-0 w-1 h-12 bg-gradient-to-b from-primary to-secondary rounded-full blur-sm opacity-50"></div>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    استكشف الفئات
                  </h2>
                  <div className="h-1 w-20 bg-gradient-to-r from-primary to-transparent rounded-full mt-1"></div>
                </div>
              </div>
              <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
                اكتشف مجموعتنا المتنوعة من الفئات المختارة بعناية لتلبية جميع احتياجاتك
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="hidden md:block">
            <CategoriesDesktop selectedSlugs={selectedSlugs} />
          </div>
          <div className="md:hidden">
            <CategoriesMobile selectedSlugs={selectedSlugs} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreativeCategoriesSlider;
