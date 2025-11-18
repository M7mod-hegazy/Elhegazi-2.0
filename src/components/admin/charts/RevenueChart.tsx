import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, LineChart as LineChartIcon } from 'lucide-react';

interface RevenueData {
  date: string;
  current: number;
  previous: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  isLoading?: boolean;
  dateRange: string;
  comparisonEnabled: boolean;
}

const RevenueChart = ({ data, isLoading = false, dateRange, comparisonEnabled }: RevenueChartProps) => {
  const [chartType, setChartType] = useState<'line' | 'area'>('area');

  const totalRevenue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.current, 0);
  }, [data]);

  const previousTotal = useMemo(() => {
    return data.reduce((sum, item) => sum + item.previous, 0);
  }, [data]);

  const growth = useMemo(() => {
    if (previousTotal === 0) return 0;
    return ((totalRevenue - previousTotal) / previousTotal) * 100;
  }, [totalRevenue, previousTotal]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-48 bg-slate-100 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-20 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-slate-50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-white to-blue-50/30 border-blue-100/50 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              الإيرادات
            </CardTitle>
            <CardDescription className="text-slate-600 mt-1">
              إجمالي المبيعات خلال {dateRange}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
              className="h-8"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
              className="h-8"
            >
              <LineChartIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          {comparisonEnabled && (
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">الفترة السابقة</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(previousTotal)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          )}
          
          {comparisonEnabled && (
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">النمو</p>
                  <p className={`text-2xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  growth >= 0 ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {growth >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="currentRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                  {comparisonEnabled && (
                    <linearGradient id="previousRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0.05}/>
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  className="text-sm"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  className="text-sm"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#currentRevenue)"
                  name="الفترة الحالية"
                />
                {comparisonEnabled && (
                  <Area
                    type="monotone"
                    dataKey="previous"
                    stroke="#64748b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#previousRevenue)"
                    name="الفترة السابقة"
                  />
                )}
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  className="text-sm"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  className="text-sm"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#3b82f6' }}
                  name="الفترة الحالية"
                />
                {comparisonEnabled && (
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="#64748b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#64748b', strokeWidth: 2, r: 3 }}
                    name="الفترة السابقة"
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;