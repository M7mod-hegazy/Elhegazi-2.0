import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Users, Eye } from 'lucide-react';

interface OrderData {
  date: string;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface OrdersChartProps {
  data: OrderData[];
  isLoading?: boolean;
}

interface CategoryDistributionProps {
  data: CategoryData[];
  isLoading?: boolean;
}

const OrdersChart = ({ data, isLoading = false }: OrdersChartProps) => {
  const totalOrders = useMemo(() => {
    return data.reduce((sum, item) => sum + item.pending + item.confirmed + item.delivered + item.cancelled, 0);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} طلب
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
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-slate-50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-white to-purple-50/30 border-purple-100/50 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-purple-600" />
          تحليل الطلبات
        </CardTitle>
        <CardDescription>
          توزيع حالات الطلبات - إجمالي {totalOrders} طلب
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="قيد التجهيز" radius={[0, 0, 0, 0]} />
              <Bar dataKey="confirmed" stackId="a" fill="#3b82f6" name="مؤكد" radius={[0, 0, 0, 0]} />
              <Bar dataKey="delivered" stackId="a" fill="#10b981" name="مُسلم" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="ملغي" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const CategoryDistribution = ({ data, isLoading = false }: CategoryDistributionProps) => {
  const RADIAN = Math.PI / 180;
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-slate-50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-white to-green-50/30 border-green-100/50 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-green-600" />
          توزيع الفئات
        </CardTitle>
        <CardDescription>
          أكثر الفئات مبيعاً هذا الشهر
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 flex items-center">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} منتج`, 'المبيعات']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 pr-4">
            <div className="space-y-3">
              {data.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/70 rounded-lg border border-white/50">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{item.value}</div>
                    <div className="text-xs text-slate-500">منتج</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { OrdersChart, CategoryDistribution };