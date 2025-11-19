import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DayPicker } from 'react-day-picker';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

interface DateRangeSelectorProps {
  onDateRangeChange: (dateRange: DateRange, comparisonRange?: DateRange) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const DateRangeSelector = ({ onDateRangeChange, isLoading = false, onRefresh }: DateRangeSelectorProps) => {
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);
    return {
      from: sevenDaysAgo,
      to: today,
      label: 'آخر 7 أيام'
    };
  });
  
  const [comparisonEnabled, setComparisonEnabled] = useState(true);
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  // Type conversion for DayPicker compatibility
  const dayPickerSelected = customRange.from && customRange.to 
    ? { from: customRange.from, to: customRange.to } 
    : undefined;

  const predefinedRanges = [
    {
      label: 'اليوم',
      getValue: () => {
        const today = new Date();
        return { from: today, to: today };
      }
    },
    {
      label: 'أمس',
      getValue: () => {
        const yesterday = subDays(new Date(), 1);
        return { from: yesterday, to: yesterday };
      }
    },
    {
      label: 'آخر 7 أيام',
      getValue: () => {
        const today = new Date();
        return { from: subDays(today, 7), to: today };
      }
    },
    {
      label: 'آخر 30 يوم',
      getValue: () => {
        const today = new Date();
        return { from: subDays(today, 30), to: today };
      }
    },
    {
      label: 'هذا الأسبوع',
      getValue: () => {
        const today = new Date();
        return { from: startOfWeek(today, { weekStartsOn: 6 }), to: endOfWeek(today, { weekStartsOn: 6 }) };
      }
    },
    {
      label: 'الأسبوع الماضي',
      getValue: () => {
        const lastWeek = subDays(new Date(), 7);
        return { from: startOfWeek(lastWeek, { weekStartsOn: 6 }), to: endOfWeek(lastWeek, { weekStartsOn: 6 }) };
      }
    },
    {
      label: 'هذا الشهر',
      getValue: () => {
        const today = new Date();
        return { from: startOfMonth(today), to: endOfMonth(today) };
      }
    },
    {
      label: 'الشهر الماضي',
      getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      }
    }
  ];

  const calculateComparisonRange = (range: DateRange): DateRange => {
    const daysDiff = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24));
    const comparisonTo = subDays(range.from, 1);
    const comparisonFrom = subDays(comparisonTo, daysDiff);
    
    return {
      from: comparisonFrom,
      to: comparisonTo,
      label: `الفترة المقارنة (${daysDiff + 1} أيام)`
    };
  };

  const handleRangeSelect = (label: string, range: { from: Date; to: Date }) => {
    const newRange: DateRange = { ...range, label };
    setSelectedRange(newRange);
    
    const comparisonRange = comparisonEnabled ? calculateComparisonRange(newRange) : undefined;
    onDateRangeChange(newRange, comparisonRange);
  };

  const handleCustomRangeSelect = () => {
    if (customRange.from && customRange.to) {
      const newRange: DateRange = {
        from: customRange.from,
        to: customRange.to,
        label: 'فترة مخصصة'
      };
      setSelectedRange(newRange);
      setShowCustomCalendar(false);
      
      const comparisonRange = comparisonEnabled ? calculateComparisonRange(newRange) : undefined;
      onDateRangeChange(newRange, comparisonRange);
    }
  };

  const handleComparisonToggle = (enabled: boolean) => {
    setComparisonEnabled(enabled);
    const comparisonRange = enabled ? calculateComparisonRange(selectedRange) : undefined;
    onDateRangeChange(selectedRange, comparisonRange);
  };

  // Initialize with default range
  useEffect(() => {
    const comparisonRange = comparisonEnabled ? calculateComparisonRange(selectedRange) : undefined;
    onDateRangeChange(selectedRange, comparisonRange);
  }, [comparisonEnabled, selectedRange, onDateRangeChange]); // Include all dependencies

  const formatDateRange = (range: DateRange) => {
    if (range.from.toDateString() === range.to.toDateString()) {
      return format(range.from, 'dd MMMM yyyy', { locale: ar });
    }
    return `${format(range.from, 'dd MMM', { locale: ar })} - ${format(range.to, 'dd MMM yyyy', { locale: ar })}`;
  };

  return (
    <Card className="w-full bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="font-semibold text-slate-900">فترة التحليل:</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[200px] justify-between bg-white/80 hover:bg-white border-primary/20">
                  <span>{selectedRange.label}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {predefinedRanges.map((range) => (
                  <DropdownMenuItem
                    key={range.label}
                    onClick={() => handleRangeSelect(range.label, range.getValue())}
                    className="cursor-pointer"
                  >
                    {range.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowCustomCalendar(true)}
                  className="cursor-pointer"
                >
                  فترة مخصصة...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-primary/20">
              <p className="text-sm text-slate-600">{formatDateRange(selectedRange)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="comparison"
                checked={comparisonEnabled}
                onCheckedChange={handleComparisonToggle}
                className="data-[state=checked]:bg-primary"
              />
              <Label htmlFor="comparison" className="text-sm font-medium text-slate-700 cursor-pointer">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                مقارنة مع الفترة السابقة
              </Label>
            </div>

            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="bg-white/80 hover:bg-white border-primary/20"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'جارِ التحديث...' : 'تحديث'}
              </Button>
            )}
          </div>
        </div>

        {/* Custom Calendar Modal */}
        {showCustomCalendar && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomCalendar(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">اختر فترة مخصصة</h3>
              <DayPicker
                mode="range"
                selected={dayPickerSelected}
                onSelect={setCustomRange}
                locale={ar}
                className="mx-auto"
                showOutsideDays
                classNames={{
                  day_selected: "bg-primary text-white hover:bg-primary",
                  day_today: "bg-primary/10 text-primary font-semibold",
                  day_range_middle: "bg-primary/10"
                }}
              />
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleCustomRangeSelect}
                  disabled={!customRange.from || !customRange.to}
                  className="flex-1"
                >
                  تطبيق
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomCalendar(false)}
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DateRangeSelector;
