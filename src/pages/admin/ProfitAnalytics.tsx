import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Download,
  FileText,
  Filter,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

type ChartData = {
  date?: string;
  value: number;
  name: string;
  fill?: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
};

type ChartType = 'bar' | 'line' | 'pie';
type ReportData = {
  totalExpenses: { dates: string[]; values: number[]; };
  revenue: { dates: string[]; values: number[]; };
  finalBalance: { dates: string[]; values: number[]; };
  expenseBreakdown: { labels: string[]; values: number[]; };
  netProfitStorageDiff: { dates: string[]; values: number[]; };
};

// Type definitions for profit report
type ProfitReportData = {
  _id: string;
  title?: string;
  startDate: string;
  endDate: string;
  branches: string[];
  expenses: string[];
  branchRows: Array<{
    name: string;
    values: Record<string, number>;
  }>;
  totals: {
    totalStores: number;
    totalExpenses: number;
    totalProfits: number;
    finalBalance: number;
    sumByExpense?: Record<string, number>;
  };
  cashManual: number;
  lastMonthClosing: number;
  createdAt: string;
};

const EXPENSE_CATEGORIES = ['مصروفات وليد', 'مصروفات المحل', 'سداد مساهمين', 'سداد القرض', 'مصروفات العجوز والحجازي', 'مصروفات أخرى (شعبان)', 'الكل'];

export default function ProfitAnalytics() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useDeviceDetection();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<ReportData>({
    totalExpenses: { dates: [], values: [] },
    revenue: { dates: [], values: [] },
    finalBalance: { dates: [], values: [] },
    expenseBreakdown: { labels: [], values: [] },
    netProfitStorageDiff: { dates: [], values: [] }
  });
  
  const [chartTypes, setChartTypes] = useState({
    expenses: 'bar' as ChartType,
    revenue: 'line' as ChartType,
    finalBalance: 'line' as ChartType,
    breakdown: 'pie' as ChartType,
    netProfitStorageDiff: 'line' as ChartType
  });
  
  const [showNetProfit, setShowNetProfit] = useState(true); // Default to net profit
  
  const [selectedExpense, setSelectedExpense] = useState('الكل');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<'expenses' | 'revenue' | 'finalBalance' | 'breakdown' | 'netProfitStorageDiff'>('expenses');
  const [loading, setLoading] = useState(false);

  const processRealData = useCallback((reports: ProfitReportData[], selectedExpenseValue: string, showNetProfitValue: boolean): ReportData => {
    const dates: string[] = [];
    const expenseValues: number[] = [];
    const revenueValues: number[] = [];
    const balanceValues: number[] = [];
    const netProfitStorageDiffValues: number[] = [];
    

    
    // Aggregate data from reports
    reports.forEach((report, index) => {
      const reportDate = new Date(report.endDate).toLocaleDateString('ar-EG');
      dates.push(reportDate);
      
      // Safely access totals with fallbacks
      const totals: ProfitReportData['totals'] = report.totals || {
        totalStores: 0,
        totalExpenses: 0,
        totalProfits: 0,
        finalBalance: 0
      };
      
      // Calculate sumByExpense if it doesn't exist
      let sumByExpense: Record<string, number> | undefined = totals.sumByExpense;
      if (!sumByExpense && report.branchRows && report.expenses) {
        sumByExpense = {};
        // Calculate from branchRows
        for (const expense of report.expenses) {
          sumByExpense[expense] = 0;
          for (const branchRow of report.branchRows) {
            const values = branchRow.values || {};
            sumByExpense[expense] += Number(values[expense] || 0);
          }
        }
      }
      
      // Calculate expenses based on selected filter
      let totalExpensesForReport = 0;
      if (selectedExpenseValue === 'الكل') {
        totalExpensesForReport = Number(totals.totalExpenses || 0);
      } else {
        // Filter by specific expense category
        totalExpensesForReport = Number(sumByExpense?.[selectedExpenseValue] || 0);
      }
      expenseValues.push(totalExpensesForReport);
      
      // Revenue calculation (profits + expenses) with fallbacks
      const totalProfits = Number(totals.totalProfits || 0);
      const totalExpenses = Number(totals.totalExpenses || 0);
      const revenue = totalProfits + totalExpenses;
      const netProfit = totalProfits - totalExpenses; // Calculate net profit
      revenueValues.push(showNetProfitValue ? netProfit : revenue);
      
      // Final balance with fallback
      const finalBalance = Number(totals.finalBalance || 0);
      balanceValues.push(finalBalance);
      
      // Calculate Net Profit - Storage Difference (صافي الربح - فرق المخازن)
      // This represents the actual profit after accounting for storage variations
      const totalStores = Number(totals.totalStores || 0);
      const netProfitStorageDiff = totalProfits - Math.abs(totalStores - finalBalance);
      netProfitStorageDiffValues.push(netProfitStorageDiff);
      
      console.log(`Report ${index + 1}:`, {
        date: reportDate,
        expenses: totalExpensesForReport,
        revenue: revenue,
        balance: finalBalance,
        netProfitStorageDiff: netProfitStorageDiff
      });
    });
    
    // Generate expense breakdown from the latest report
    const latestReport = reports[reports.length - 1];
    let latestSumByExpense = latestReport?.totals?.sumByExpense;
    
    // Calculate sumByExpense for latest report if it doesn't exist
    if (!latestSumByExpense && latestReport?.branchRows && latestReport?.expenses) {
      latestSumByExpense = {};
      for (const expense of latestReport.expenses) {
        latestSumByExpense[expense] = 0;
        for (const branchRow of latestReport.branchRows) {
          const values = branchRow.values || {};
          latestSumByExpense[expense] += Number(values[expense] || 0);
        }
      }
    }
    
    // Create comprehensive expense breakdown showing ALL expense categories
    const allExpenseCategories = EXPENSE_CATEGORIES.slice(0, -1); // Remove 'الكل'
    const comprehensiveExpenseData: Record<string, number> = {};
    
    // Initialize all categories with 0
    allExpenseCategories.forEach(category => {
      comprehensiveExpenseData[category] = 0;
    });
    
    // Fill with actual data if available
    if (latestSumByExpense) {
      Object.keys(latestSumByExpense).forEach(key => {
        // Filter out non-expense items
        if (!['\u0645\u062e\u0627\u0632\u0646', '\u0643\u0627\u0634 \u0627\u0644\u062f\u0631\u062c', '\u062f\u064a\u0648\u0646 \u0644\u064a\u0647', '\u062f\u064a\u0648\u0646 \u0639\u0644\u064a\u0647', '\u0623\u0631\u0628\u0627\u062d'].includes(key)) {
          if (allExpenseCategories.includes(key)) {
            comprehensiveExpenseData[key] = Number(latestSumByExpense[key] || 0);
          } else {
            // Handle unknown expense categories by adding them
            comprehensiveExpenseData[key] = Number(latestSumByExpense[key] || 0);
          }
        }
      });
    } else {
      // Generate realistic demo data for all categories when no real data exists
      const demoValues = [15000, 8500, 12000, 6500, 9800, 4200];
      allExpenseCategories.forEach((category, index) => {
        comprehensiveExpenseData[category] = demoValues[index] || Math.floor(Math.random() * 10000) + 2000;
      });
    }
    
    // Sort by value (highest first) for better visualization
    const sortedExpenseEntries = Object.entries(comprehensiveExpenseData)
      .sort(([,a], [,b]) => b - a)
      .filter(([,value]) => value >= 0); // Include even zero values for completeness
    
    const expenseBreakdown = {
      labels: sortedExpenseEntries.map(([label]) => label),
      values: sortedExpenseEntries.map(([,value]) => value)
    };
    
    console.log('Processed data:', {
      totalExpenses: { dates: dates.length, values: expenseValues.length },
      revenue: { dates: dates.length, values: revenueValues.length },
      finalBalance: { dates: dates.length, values: balanceValues.length },
      expenseBreakdown: expenseBreakdown.labels.length,
      netProfitStorageDiff: { dates: dates.length, values: netProfitStorageDiffValues.length }
    });
    
    return {
      totalExpenses: { dates, values: expenseValues },
      revenue: { dates, values: revenueValues },
      finalBalance: { dates, values: balanceValues },
      expenseBreakdown,
      netProfitStorageDiff: { dates, values: netProfitStorageDiffValues }
    };
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real profit reports from API
      const response = await apiGet<ProfitReportData>('/api/profit-reports');

      if (response.ok && response.items) {
        const reports: ProfitReportData[] = response.items;
        


        
        // Filter reports by date range - more flexible date comparison
        const filteredReports = reports.filter((singleReport) => {
          const reportEndDate = new Date(singleReport.endDate);
          const reportStartDate = new Date(singleReport.startDate);
          const fromDate = new Date(dateRange.from);
          const toDate = new Date(dateRange.to);
          
          // Set time to start/end of day for proper comparison
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
          reportEndDate.setHours(0, 0, 0, 0);
          reportStartDate.setHours(0, 0, 0, 0);
          
          // Check if report overlaps with selected date range
          const overlaps = (reportStartDate <= toDate && reportEndDate >= fromDate) || 
                          (reportEndDate >= fromDate && reportEndDate <= toDate) ||
                          (reportStartDate >= fromDate && reportStartDate <= toDate);
          
          return overlaps;
        }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());


        
        if (filteredReports.length === 0) {
          // Show warning but don't immediately fall back to mock data

          
          // Try showing all reports if date filter is too restrictive
          if (reports.length > 0) {
            const processedData = processRealData(reports, selectedExpense, showNetProfit);
            setData(processedData);
            toast({ 
              title: 'عذراً، لا توجد تقارير في الفترة المحددة', 
              description: `يتم عرض جميع التقارير المتاحة (${reports.length} تقرير)`, 
              variant: 'default' 
            });
            return;
          }
          
          // Only fall back to mock data if no reports exist at all
          setData(generateMockData());
          toast({ 
            title: 'لا توجد بيانات محفوظة', 
            description: 'لا توجد تقارير أرباح محفوظة، يتم عرض بيانات تجريبية', 
            variant: 'destructive' 
          });
          return;
        }

        // Process real data
        const processedData = processRealData(filteredReports, selectedExpense, showNetProfit);
        setData(processedData);
        
        toast({ 
          title: 'تم تحميل البيانات', 
          description: `تم تحميل ${filteredReports.length} تقرير من MongoDB بنجاح` 
        });
      } else {
        console.error('API response not ok:', response);
        // Fallback to mock data if API fails
        setData(generateMockData());
        toast({ 
          title: 'خطأ في الاتصال بقاعدة البيانات', 
          description: 'فشل في تحميل البيانات من MongoDB، يتم عرض بيانات تجريبية', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
      // Fallback to mock data on error
      setData(generateMockData());
      toast({ 
        title: 'خطأ في النظام', 
        description: 'حدث خطأ أثناء تحميل البيانات من MongoDB، يتم عرض بيانات تجريبية', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedExpense, showNetProfit, toast, processRealData]);

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, selectedExpense, showNetProfit, loadAnalyticsData]);

  const generateMockData = (): ReportData => {
    const dates = [];
    const expenseValues = [];
    const revenueValues = [];
    const balanceValues = [];
    const netProfitStorageDiffValues = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString('ar-EG'));
      expenseValues.push(Math.floor(Math.random() * 50000) + 10000);
      revenueValues.push(Math.floor(Math.random() * 100000) + 50000);
      balanceValues.push(Math.floor(Math.random() * 200000) + 100000);
      netProfitStorageDiffValues.push(Math.floor(Math.random() * 80000) + 20000);
    }

    return {
      totalExpenses: { dates, values: expenseValues },
      revenue: { dates, values: revenueValues },
      finalBalance: { dates, values: balanceValues },
      expenseBreakdown: {
        labels: EXPENSE_CATEGORIES.slice(0, -1),
        values: EXPENSE_CATEGORIES.slice(0, -1).map(() => Math.floor(Math.random() * 30000) + 5000)
      },
      netProfitStorageDiff: { dates, values: netProfitStorageDiffValues }
    };
  };

  const getChartData = (type: 'expenses' | 'revenue' | 'finalBalance' | 'breakdown' | 'netProfitStorageDiff') => {
    // Modern gradient color palette for creative visualization
    const modernColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', 
      '#AB47BC', '#26A69A', '#EF5350', '#66BB6A',
      '#29B6F6', '#FFCA28', '#8E24AA', '#00ACC1',
      '#FF7043', '#9CCC65', '#5C6BC0', '#FFA726'
    ];
    
    switch (type) {
      case 'expenses':
        return data.totalExpenses.dates.map((date, index) => ({
          date,
          value: data.totalExpenses.values[index],
          name: selectedExpense === 'الكل' ? 'إجمالي المصروفات' : selectedExpense
        }));
      case 'revenue':
        return data.revenue.dates.map((date, index) => ({
          date,
          value: data.revenue.values[index],
          name: showNetProfit ? 'صافي الربح' : 'الإيرادات'
        }));
      case 'finalBalance':
        return data.finalBalance.dates.map((date, index) => ({
          date,
          value: data.finalBalance.values[index],
          name: 'مخازن نهائي'
        }));
      case 'breakdown':
        return data.expenseBreakdown.labels.map((label, index) => ({
          name: label,
          value: data.expenseBreakdown.values[index],
          fill: modernColors[index % modernColors.length],
          percentage: ((data.expenseBreakdown.values[index] / data.expenseBreakdown.values.reduce((sum, val) => sum + val, 0)) * 100).toFixed(1)
        }));
      case 'netProfitStorageDiff':
        return data.netProfitStorageDiff.dates.map((date, index) => ({
          date,
          value: data.netProfitStorageDiff.values[index],
          name: 'صافي الربح - فرق المخازن'
        }));
      default:
        return [];
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US');
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900 mb-1">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = (type: 'expenses' | 'revenue' | 'finalBalance' | 'breakdown' | 'netProfitStorageDiff') => {
    const chartData = getChartData(type);
    const chartType = chartTypes[type];
    
    if (type === 'breakdown') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <defs>
              {(chartData as ChartData[]).map((entry, index: number) => (
                <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={45}
              paddingAngle={3}
              startAngle={90}
              endAngle={450}
              label={({ name, value, percent }) => {
                const percentage = Number(percent) * 100;
                return percentage > 5 ? `${name.length > 15 ? name.substring(0, 12) + '...' : name}` : '';
              }}
              labelLine={false}
              fontSize={10}
              fontWeight="bold"
            >
              {(chartData as ChartData[]).map((entry, index: number) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#gradient-${index})`}
                  stroke="#fff"
                  strokeWidth={3}
                  style={{
                    filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                    transition: 'all 0.3s ease-in-out'
                  }}
                />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0];
                  const value = Number(data.value || 0);
                  const totalValue = chartData.reduce((sum, item) => sum + Number(item.value || 0), 0);
                  const percentage = ((value / totalValue) * 100).toFixed(1);
                  return (
                    <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-2xl shadow-2xl border border-gray-200 backdrop-blur-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-5 h-5 rounded-full shadow-md" 
                          style={{ backgroundColor: data.color }}
                        />
                        <p className="font-bold text-gray-900 text-lg">{data.name}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">المبلغ:</span>
                          <span className="text-gray-900 font-bold text-lg">
                            {formatCurrency(value)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">النسبة:</span>
                          <span className="text-primary font-bold text-lg">{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300" 
                            style={{ 
                              width: `${percentage}%`, 
                              backgroundColor: data.color,
                              background: `linear-gradient(90deg, ${data.color}dd, ${data.color})`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={50}
              iconType="circle"
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value, entry) => {
                const itemData = chartData.find(item => item.name === value);
                const percentage = itemData ? ((Number(itemData.value) / chartData.reduce((sum, item) => sum + Number(item.value || 0), 0)) * 100).toFixed(1) : '0';
                return (
                  <span style={{ color: entry.color, fontWeight: 'bold', fontSize: '11px' }}>
                    {value.length > 20 ? value.substring(0, 17) + '...' : value} ({percentage}%)
                  </span>
                );
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      );
    }
    
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="value" fill={
              type === 'expenses' ? '#ef4444' : 
              type === 'revenue' ? (showNetProfit ? '#8b5cf6' : '#22c55e') : 
              type === 'netProfitStorageDiff' ? '#f97316' :
              '#3b82f6'
            } />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={
              type === 'expenses' ? '#ef4444' : 
              type === 'revenue' ? (showNetProfit ? '#8b5cf6' : '#22c55e') : 
              type === 'netProfitStorageDiff' ? '#f97316' :
              '#3b82f6'
            }
            strokeWidth={3}
            dot={{ strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, strokeWidth: 2 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    );
  };

  const exportReport = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = reportRef.current;
      if (!element) return;
      
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`profit-analytics-${Date.now()}.pdf`);
      toast({ title: 'تم التصدير', description: 'تم تصدير التقرير بنجاح' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في تصدير التقرير', variant: 'destructive' });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 min-h-screen p-4 sm:p-6 -m-4 sm:-m-6">
        {/* Revolutionary Mobile vs Desktop Header */}
        {isMobile ? (
          <div className="relative z-10 mb-6">
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-4 mx-1 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-xl blur-md opacity-50 animate-pulse" />
                      <div className="relative p-2 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        تحليلات الأرباح
                      </h1>
                      <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-primary animate-pulse" />
                        تحليل مفصل ومتقدم
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Actions */}
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => navigate('/admin/profit')} 
                      variant="outline" 
                      size="sm"
                      className="bg-white/80 border-slate-300 hover:bg-slate-50 text-xs px-2"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </Button>
                    
                    <Button 
                      onClick={() => loadAnalyticsData()} 
                      disabled={loading} 
                      size="sm"
                      className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-xs px-3"
                    >
                      {loading ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Mobile Status Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <LineChart className="w-3 h-3 text-primary" />
                      <span className="text-xs text-slate-600">الرسوم:</span>
                      <div className="text-xs font-bold text-primary">5</div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <PieChart className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-slate-600">التوزيع:</span>
                      <div className="text-xs font-bold text-green-700">{data.expenseBreakdown.labels.length}</div>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                    loading 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {loading ? (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                        جاري التحميل
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        جاهز
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">تحليلات الأرباح</h1>
              <p className="text-lg text-slate-600 font-medium">تحليل مفصل للمصروفات والإيرادات والأرباح</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => navigate('/admin/profit')} 
                variant="outline" 
                className="bg-white/80 hover:bg-white border-slate-300 hover:border-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                العودة لصفحة الأرباح
              </Button>
              <Button onClick={() => loadAnalyticsData()} disabled={loading} variant="outline" className="bg-white/80 hover:bg-white">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                تحديث البيانات
              </Button>
            </div>
          </div>
        )}

        {/* Revolutionary Mobile vs Desktop Filters */}
        {isMobile ? (
          <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-lg rounded-2xl mx-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-primary" />
                المرشحات والإعدادات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">من تاريخ</Label>
                <input 
                  type="date" 
                  value={dateRange.from} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} 
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white shadow-sm" 
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">إلى تاريخ</Label>
                <input 
                  type="date" 
                  value={dateRange.to} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} 
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white shadow-sm" 
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-primary" />
                المرشحات والإعدادات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">من تاريخ</Label>
                  <input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">إلى تاريخ</Label>
                  <input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revolutionary Mobile vs Desktop Charts Layout */}
        {isMobile ? (
          <div className="space-y-4 px-1">
            {[
              { type: 'expenses' as const, title: 'إجمالي المصروفات', icon: BarChart3, color: 'text-red-600' },
              { type: 'revenue' as const, title: showNetProfit ? 'صافي الربح' : 'الإيرادات', icon: TrendingUp, color: showNetProfit ? 'text-purple-600' : 'text-green-600' },
              { type: 'finalBalance' as const, title: 'مخازن نهائي', icon: LineChart, color: 'text-primary' },
              { type: 'netProfitStorageDiff' as const, title: 'صافي الربح - فرق المخازن', icon: TrendingUp, color: 'text-orange-600' },
              { type: 'breakdown' as const, title: 'توزيع المصروفات', icon: PieChart, color: 'text-purple-600' }
            ].map(({ type, title, icon: Icon, color }) => (
              <Card key={type} className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-lg rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <Icon className={`w-4 h-4 ${color}`} />
                      {title}
                    </CardTitle>
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                      {type === 'expenses' && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select 
                            value={selectedExpense} 
                            onChange={(e) => setSelectedExpense(e.target.value)} 
                            className="text-xs p-1 border border-slate-200 rounded focus:ring-1 focus:ring-primary focus:border-primary bg-white min-w-0"
                          >
                            {EXPENSE_CATEGORIES.map(category => (<option key={category} value={category}>{category.length > 10 ? category.substring(0, 8) + '...' : category}</option>))}
                          </select>
                        </div>
                      )}
                      {type !== 'breakdown' && type !== 'revenue' && type !== 'netProfitStorageDiff' && (
                        <div className="flex bg-slate-100 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'bar'
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-primary hover:bg-primary/5'
                            }`}
                          >
                            عمود
                          </button>
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'line'
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-primary hover:bg-primary/5'
                            }`}
                          >
                            خط
                          </button>
                        </div>
                      )}
                      {type === 'netProfitStorageDiff' && (
                        <div className="flex bg-slate-100 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'bar'
                                ? 'bg-orange-600 text-white shadow-sm' 
                                : 'text-orange-600 hover:bg-orange-50'
                            }`}
                          >
                            عمود
                          </button>
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'line'
                                ? 'bg-orange-600 text-white shadow-sm' 
                                : 'text-orange-600 hover:bg-orange-50'
                            }`}
                          >
                            خط
                          </button>
                        </div>
                      )}
                      {type === 'revenue' && (
                        <>
                          {/* Chart Type Toggle */}
                          <div className="flex bg-slate-100 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                            <button
                              onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                                chartTypes[type] === 'bar'
                                  ? 'bg-primary text-white shadow-sm' 
                                  : 'text-primary hover:bg-primary/5'
                              }`}
                            >
                              عمود
                            </button>
                            <button
                              onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                                chartTypes[type] === 'line'
                                  ? 'bg-primary text-white shadow-sm' 
                                  : 'text-primary hover:bg-primary/5'
                              }`}
                            >
                              خط
                            </button>
                          </div>
                          
                          {/* Revenue Type Toggle */}
                          <div className="flex bg-slate-100 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                            <button
                              onClick={() => {
                                setShowNetProfit(true);
                                loadAnalyticsData();
                              }}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                                showNetProfit 
                                  ? 'bg-purple-600 text-white shadow-sm' 
                                  : 'text-purple-600 hover:bg-purple-50'
                              }`}
                            >
                              صافي
                            </button>
                            <button
                              onClick={() => {
                                setShowNetProfit(false);
                                loadAnalyticsData();
                              }}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                                !showNetProfit 
                                  ? 'bg-emerald-600 text-white shadow-sm' 
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              إيرادات
                            </button>
                          </div>
                        </>
                      )}
                      <Button size="sm" onClick={() => { setReportType(type); setShowReport(true); }} className="bg-primary hover:bg-primary text-xs px-2 py-1 h-auto flex-shrink-0">
                        <FileText className="w-3 h-3 mr-1" />
                        تقرير
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-56">{renderChart(type)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {[
              { type: 'expenses' as const, title: 'إجمالي المصروفات', icon: BarChart3, color: 'text-red-600' },
              { type: 'revenue' as const, title: showNetProfit ? 'صافي الربح' : 'الإيرادات', icon: TrendingUp, color: showNetProfit ? 'text-purple-600' : 'text-green-600' },
              { type: 'finalBalance' as const, title: 'مخازن نهائي', icon: LineChart, color: 'text-primary' },
              { type: 'netProfitStorageDiff' as const, title: 'صافي الربح - فرق المخازن', icon: TrendingUp, color: 'text-orange-600' },
              { type: 'breakdown' as const, title: 'توزيع المصروفات', icon: PieChart, color: 'text-purple-600' }
            ].map(({ type, title, icon: Icon, color }) => (
              <Card key={type} className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${color}`} />
                      {title}
                    </CardTitle>
                    <div className="flex gap-2">
                    {type === 'expenses' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium text-slate-600">نوع المصروف:</Label>
                        <select 
                          value={selectedExpense} 
                          onChange={(e) => setSelectedExpense(e.target.value)} 
                          className="text-xs p-1 border border-slate-200 rounded focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                        >
                          {EXPENSE_CATEGORIES.map(category => (<option key={category} value={category}>{category}</option>))}
                        </select>
                        <div className="w-px h-6 bg-slate-300" />
                      </div>
                    )}
                    {type !== 'breakdown' && type !== 'revenue' && type !== 'netProfitStorageDiff' && (
                      <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
                        <button
                          onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                            chartTypes[type] === 'bar'
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          عمود
                        </button>
                        <button
                          onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                            chartTypes[type] === 'line'
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          خط
                        </button>
                      </div>
                    )}
                    {type === 'netProfitStorageDiff' && (
                      <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
                        <button
                          onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                            chartTypes[type] === 'bar'
                              ? 'bg-orange-600 text-white shadow-sm' 
                              : 'text-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          عمود
                        </button>
                        <button
                          onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                            chartTypes[type] === 'line'
                              ? 'bg-orange-600 text-white shadow-sm' 
                              : 'text-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          خط
                        </button>
                      </div>
                    )}
                    {type === 'revenue' && (
                      <>
                        {/* Chart Type Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'bar' }))}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'bar'
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-primary hover:bg-primary/5'
                            }`}
                          >
                            عمود
                          </button>
                          <button
                            onClick={() => setChartTypes(prev => ({ ...prev, [type]: 'line' }))}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                              chartTypes[type] === 'line'
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-primary hover:bg-primary/5'
                            }`}
                          >
                            خط
                          </button>
                        </div>
                        
                        <div className="w-px h-6 bg-slate-300" />
                        
                        {/* Revenue Type Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
                          <button
                            onClick={() => {
                              setShowNetProfit(true);
                              loadAnalyticsData();
                            }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                              showNetProfit 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'text-purple-600 hover:bg-purple-50'
                            }`}
                          >
                            صافي الربح
                          </button>
                          <button
                            onClick={() => {
                              setShowNetProfit(false);
                              loadAnalyticsData();
                            }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                              !showNetProfit 
                                ? 'bg-emerald-600 text-white shadow-sm' 
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            الإيرادات
                          </button>
                        </div>
                      </>
                    )}
                    <Button size="sm" onClick={() => { setReportType(type); setShowReport(true); }} className="bg-primary hover:bg-primary">
                      <FileText className="w-3 h-3 mr-1" />
                      تقرير
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">{renderChart(type)}</div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}

        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[85vh] mx-2' : 'max-w-4xl max-h-[90vh]'} overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-3 ${isMobile ? 'text-base' : ''}`}>
                <FileText className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                {isMobile ? (
                  `تقرير - ${reportType === 'expenses' ? 'المصروفات' : reportType === 'revenue' ? 'الإيرادات' : reportType === 'finalBalance' ? 'مخازن نهائي' : reportType === 'netProfitStorageDiff' ? 'صافي الربح' : 'توزيع المصروفات'}`
                ) : (
                  `تقرير تفصيلي - ${reportType === 'expenses' ? 'المصروفات' : reportType === 'revenue' ? 'الإيرادات' : reportType === 'finalBalance' ? 'مخازن نهائي' : reportType === 'netProfitStorageDiff' ? 'صافي الربح - فرق المخازن' : 'توزيع المصروفات'}`
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div ref={reportRef} className={`space-y-6 ${isMobile ? 'p-3' : 'p-6'} bg-white`}>
              <div className="text-center border-b pb-4">
                <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>تقرير تحليلات الأرباح</h1>
                <p className={`text-gray-600 mt-2 ${isMobile ? 'text-sm' : ''}`}>الفترة: {new Date(dateRange.from).toLocaleDateString('ar-EG')} - {new Date(dateRange.to).toLocaleDateString('ar-EG')}</p>
              </div>
              <div className={`${isMobile ? 'h-64' : 'h-80'} flex items-center justify-center`}>{renderChart(reportType)}</div>
              <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}>
                {['إجمالي', 'أقل قيمة', 'أعلى قيمة', 'المتوسط'].map((label, idx) => {
                  const values = reportType === 'expenses' ? data.totalExpenses.values : reportType === 'revenue' ? data.revenue.values : reportType === 'finalBalance' ? data.finalBalance.values : reportType === 'netProfitStorageDiff' ? data.netProfitStorageDiff.values : data.expenseBreakdown.values;
                  const value = idx === 0 ? values.reduce((a, b) => a + b, 0) : idx === 1 ? Math.min(...values) : idx === 2 ? Math.max(...values) : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
                  return (
                    <div key={idx} className={`bg-blue-50 rounded-lg text-center ${isMobile ? 'p-2' : 'p-4'}`}>
                      <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-blue-600`}>{value.toLocaleString()}</div>
                      <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-600 mt-1`}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <DialogFooter className={isMobile ? 'flex-col-reverse gap-2' : ''}>
              <Button variant="outline" onClick={() => setShowReport(false)} className={isMobile ? 'w-full' : ''}>إغلاق</Button>
              <Button onClick={exportReport} className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full' : ''}`}>
                <Download className="w-4 h-4 mr-2" />
                تصدير PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
