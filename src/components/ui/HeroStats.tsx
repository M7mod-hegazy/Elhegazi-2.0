import { LucideIcon } from 'lucide-react';

interface StatItem {
  icon: LucideIcon;
  number: string;
  label: string;
}

interface HeroStatsProps {
  stats: StatItem[];
  variant?: 'default' | 'floating';
}

const HeroStats = ({ stats, variant = 'default' }: HeroStatsProps) => {
  const containerClasses = variant === 'floating' 
    ? 'absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30'
    : 'mt-12';

  const cardClasses = variant === 'floating'
    ? 'bg-background/95 backdrop-blur-lg border border-border/50 shadow-2xl'
    : 'bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20';

  return (
    <div className={containerClasses}>
      <div className={`${cardClasses} rounded-2xl p-6`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="text-center space-y-2 animate-fade-in"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
            >
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                variant === 'floating' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-primary-foreground/20 text-primary-foreground'
              }`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`text-2xl font-bold ${
                variant === 'floating' ? 'text-primary' : 'text-primary-foreground'
              }`}>
                {stat.number}
              </div>
              <p className={`text-sm font-medium ${
                variant === 'floating' ? 'text-muted-foreground' : 'text-primary-foreground/80'
              }`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroStats;