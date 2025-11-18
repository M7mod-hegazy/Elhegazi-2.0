import ScrollAnimation from '@/components/ui/scroll-animation';
import CategoriesDesktop from './CategoriesDesktop';
import CategoriesMobile from './CategoriesMobile';

interface CreativeCategoriesSliderProps {
  selectedSlugs?: string[];
}

const CreativeCategoriesSlider = ({ selectedSlugs }: CreativeCategoriesSliderProps) => {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto px-4">
        <ScrollAnimation animation="fadeIn" className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              استكشف الفئات
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            اكتشف مجموعتنا المتنوعة من الفئات المختارة بعناية لتلبية جميع احتياجاتك
          </p>
        </ScrollAnimation>

        <ScrollAnimation animation="slideUp" delay={200}>
          <div className="hidden md:block">
            <CategoriesDesktop selectedSlugs={selectedSlugs} />
          </div>
          <div className="md:hidden">
            <CategoriesMobile selectedSlugs={selectedSlugs} />
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
};

export default CreativeCategoriesSlider;
