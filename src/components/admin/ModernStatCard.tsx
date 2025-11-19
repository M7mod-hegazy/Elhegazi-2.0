import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

interface ModernStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconColor?: string;
  backgroundColor?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  isLoading?: boolean;
  gradient?: string;
}

const ModernStatCard = ({
  title,
  value,
  subtitle,
  icon,
  iconColor = "text-blue-600",
  backgroundColor = "bg-blue-50",
  buttonText,
  onButtonClick,
  trend,
  isLoading = false,
  gradient = "from-blue-50 to-indigo-50"
}: ModernStatCardProps) => {
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80`}></div>
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 w-40 bg-slate-100 rounded animate-pulse"></div>
            </div>
            <div className={`w-12 h-12 ${backgroundColor} rounded-xl animate-pulse`}></div>
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80 group-hover:opacity-90 transition-opacity duration-500`}></div>
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full transform translate-x-16 -translate-y-16 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full transform -translate-x-12 translate-y-12 group-hover:scale-110 transition-transform duration-700"></div>
      </div>

      <CardContent className="relative p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">{title}</p>
            <h3 className="text-3xl font-black text-slate-900 leading-none">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </h3>
            {subtitle && (
              <p className="text-sm text-slate-500 leading-relaxed">{subtitle}</p>
            )}
          </div>
          
          <div className={`w-14 h-14 ${backgroundColor} rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <div className={iconColor}>
              {icon}
            </div>
          </div>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              trend.isPositive 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
            <span className="text-xs text-slate-500">{trend.label}</span>
          </div>
        )}

        {/* Action button */}
        {buttonText && onButtonClick && (
          <Button
            onClick={onButtonClick}
            variant="ghost"
            size="sm"
            className="w-full justify-between bg-white/50 hover:bg-white/80 text-slate-700 hover:text-slate-900 border border-white/70 backdrop-blur-sm transition-all duration-300"
          >
            <span className="font-medium">{buttonText}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ModernStatCard;
