import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  backgroundColor?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  backgroundColor = 'bg-blue-50',
  buttonText,
  onButtonClick,
  trend
}: StatCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        <div className={`w-10 h-10 rounded-lg ${backgroundColor} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 mb-1">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mb-3">
            {subtitle}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mb-3">
            <span className={`text-xs font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-slate-500">{trend.label}</span>
          </div>
        )}
        {buttonText && onButtonClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onButtonClick}
            className="w-full text-xs"
          >
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
