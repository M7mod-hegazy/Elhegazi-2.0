import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, FileText, DollarSign, Users, Save, X, BarChart3, PieChart, Calculator, Banknote, TrendingUp, Settings, Plus, Trash2, CalendarIcon, RefreshCw, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api';

type Shareholder = { id: string; name: string; amount: number; percentage: number; initialAmount?: number };
type ShareTxn = {
  id: string;
  date: string;
  delta: number;
  fromAmount: number;
  toAmount: number;
  netProfit: number;
  finalBalance: number;
  source?: 'manual' | 'auto';
  active?: boolean;
  note?: string;
};
type BranchRow = { name: string; values: Record<string, number> };
type cashBreakdown = {
  outletExpenses: number;
  home: number;
  bank: number;
  drawer: number;
  vodafone: number;
  customRows?: Array<{ id: string; name: string; amount: number }>;
};

type ProfitReportDoc = {
  _id: string;
  title?: string;
  description?: string;
  reportName?: string;
  startDate: string | Date;
  endDate: string | Date;
  branches: string[];
  expenses: string[];
  branchRows?: BranchRow[];
  affectedShareholders?: string[];
  totals?: {
    netProfit?: number;
    finalBalance?: number;
    lastMonthClosing?: number;
    totalProfits?: number;
    totalExpenses?: number;
    sumByExpense?: Record<string, number>;
    cashBreakdown?: CashBreakdown;
  };
};

interface ComprehensiveEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ProfitReportDoc | null;
  shareholders: Shareholder[];
  shareHistory: Record<string, ShareTxn[]>;
  onSave: (updatedReport: Partial<ProfitReportDoc>) => Promise<void>;
}

// Helper functions for number input
const parseNumber = (value: string): number => {
  const cleaned = value.replace(/,/g, '');
  if (cleaned === '-' || cleaned === '') return 0;
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const validateNumericInputWithNegative = (value: string): boolean => {
  const numericRegex = /^-?[0-9,]*\.?[0-9]*$/;
  return numericRegex.test(value);
};

export function ComprehensiveEditModal({ 
  open, 
  onOpenChange, 
  report, 
  shareholders,
  shareHistory,
  onSave 
}: ComprehensiveEditModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Helper function to get shareholder balance before this report
  const getBalanceBeforeReport = (shareholderId: string): number => {
    const shareholder = shareholders.find(s => s.id === shareholderId);
    
    if (!report?._id) {
      console.log(`📊 No report ID, using current amount for ${shareholder?.name}:`, shareholder?.amount);
      return shareholder?.amount || 0;
    }
    
    const history = shareHistory[shareholderId] || [];
    const reportId = report._id;
    const currentReportStartDate = report.startDate ? new Date(report.startDate).getTime() : 0;
    
    
    // Find the MOST RECENT transaction from a report that started BEFORE this report
    // OR from manual transactions (reportId=undefined)
    const filteredTransactions = history.filter(txn => {
      const isRelatedToThisReport = txn.reportId === reportId || 
        txn.reportId?.startsWith(`${reportId}_profit_`) ||
        txn.reportId?.startsWith(`${reportId}_edit_`) ||
        txn.reportId?.startsWith(`${reportId}_reversal_`) ||
        txn.reportId?.startsWith(`${reportId}_skip_`);
      
      
      // Include if: NOT related to this report
      return !isRelatedToThisReport;
    });
    
    
    // Sort by transaction date (most recent first)
    const lastNonReportTxn = filteredTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    const balanceBeforeReport = lastNonReportTxn ? lastNonReportTxn.toAmount : (shareholder?.initialAmount || shareholder?.amount || 0);
    
    return balanceBeforeReport;
  };
  
  // Form state
  const [reportName, setReportName] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<string[]>([]);
  const [branchRows, setBranchRows] = useState<BranchRow[]>([]);
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({
    outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: []
  });
  const [selectedShareholders, setSelectedShareholders] = useState<Set<string>>(new Set());
  const [lastMonthClosing, setLastMonthClosing] = useState('0');
  const [newBranch, setNewBranch] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [expenseTypes, setExpenseTypes] = useState<Map<string, 'personal' | 'other'>>(new Map());

  // Load global expense types from API FIRST
  useEffect(() => {
    const loadGlobalExpenseTypes = async () => {
      try {
        const data = await apiGet('/api/profit-settings');
        if (data.ok && data.item?.expenseTypes) {
          const loadedTypes = new Map<string, 'personal' | 'other'>(
            Object.entries(data.item.expenseTypes).map(([key, value]) => [key, value as 'personal' | 'other'])
          );
          setExpenseTypes(loadedTypes);
        } else {
          console.warn('⚠️ No expenseTypes in API response');
        }
      } catch (error) {
        console.error('❌ Failed to load expense types:', error);
      }
    };
    
    if (open) {
      loadGlobalExpenseTypes();
    }
  }, [open]);

  // Auto-calculate outletExpenses from personal expenses
  useEffect(() => {
    const personalExpensesTotal = expenses
      .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
      .reduce((sum, expenseName) => {
        const expenseTotal = branchRows.reduce((branchSum, branch) => branchSum + Number(branch.values[expenseName] || 0), 0);
        return sum + expenseTotal;
      }, 0);
    
    setCashBreakdown(prev => {
      if (prev.outletExpenses !== personalExpensesTotal) {
        return { ...prev, outletExpenses: personalExpensesTotal };
      }
      return prev;
    });
  }, [branchRows, expenses, expenseTypes]);

  // Auto-calculate drawer (كاش الدرج) from الدرج والديون step
  useEffect(() => {
    const drawerTotal = branchRows.reduce((sum, branch) => sum + Number(branch.values['كاش الدرج'] || 0), 0);
    
    setCashBreakdown(prev => {
      if (prev.drawer !== drawerTotal) {
        return { ...prev, drawer: drawerTotal };
      }
      return prev;
    });
  }, [branchRows]);

  // Load data
  useEffect(() => {
    if (report && open) {
      setReportName(report.reportName || '');
      setTitle(report.title || report.reportName || ''); // Use reportName as fallback for title
      setStartDate(new Date(report.startDate));
      setEndDate(new Date(report.endDate));
      setBranches(report.branches || []);
      setExpenses(report.expenses || []);
      setBranchRows(report.branchRows || []);
      const loadedCashBreakdown = report.totals?.cashBreakdown || { outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] };
      // Ensure custom rows have IDs
      if (loadedCashBreakdown.customRows) {
        loadedCashBreakdown.customRows = loadedCashBreakdown.customRows.map(row => ({
          ...row,
          id: row.id || crypto.randomUUID() // Add ID if missing
        }));
      }
      setCashBreakdown(loadedCashBreakdown);
      
      // Load affected shareholders - if none saved, don't default to all
      const savedSelection = report.affectedShareholders || [];
      setSelectedShareholders(new Set(savedSelection));
      
      setLastMonthClosing(String(report.totals?.lastMonthClosing || 0));
    }
  }, [report, open, shareholders]);

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      // Recalculate totals based on updated data
      const sumByExpense: Record<string, number> = {};
      
      // Initialize all expenses to 0
      expenses.forEach(e => sumByExpense[e] = 0);
      
      // Sum up values from branchRows
      branchRows.forEach(br => {
        expenses.forEach(e => {
          sumByExpense[e] += Number(br.values[e] || 0);
        });
      });
      
      // Calculate totals
      const totalStores = sumByExpense['مخازن'] || 0;
      const totalProfits = sumByExpense['أرباح'] || 0;
      const debtsToUs = sumByExpense['ديون ليه'] || 0;
      const debtsOnUs = sumByExpense['ديون عليه'] || 0;
      
      // Calculate cash total (including custom rows)
      const cashTotal = (cashBreakdown.outletExpenses || 0) + 
                       (cashBreakdown.home || 0) + 
                       (cashBreakdown.bank || 0) + 
                       (cashBreakdown.drawer || 0) +
                       (cashBreakdown.customRows?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0);
      
      // Calculate expenses (excluding fixed items)
      const totalExpenses = expenses
        .filter(e => !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
        .reduce((sum, e) => sum + (sumByExpense[e] || 0), 0);
      
      // Final calculations
      const finalBalance = totalStores + cashTotal + debtsToUs - debtsOnUs;
      const netProfit = totalProfits - totalExpenses;
      
      const updatedTotals = {
        ...report.totals,
        lastMonthClosing: Number(lastMonthClosing),
        cashBreakdown,
        sumByExpense,
        totalStores,
        totalExpenses,
        totalProfits,
        finalBalance,
        netProfit
      };
      
      const saveData = {
        _id: report._id,
        reportName, title, 
        startDate: startDate?.toISOString() || report.startDate,
        endDate: endDate?.toISOString() || report.endDate,
        branches, expenses, branchRows,
        affectedShareholders: Array.from(selectedShareholders),
        totals: updatedTotals
      };
      
      console.log('💾 Saving:', saveData.reportName || saveData.title);
      console.log('📊 Totals:', { finalBalance, netProfit, totalProfits, totalExpenses });
      
      await onSave(saveData);
      toast({ title: 'تم الحفظ', description: 'تم تحديث التقرير بنجاح' });
      onOpenChange(false);
    } catch (error) {
      console.error('❌ Save error:', error);
      toast({ title: 'خطأ', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            تعديل شامل للتقرير - {report.reportName || 'بدون اسم'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="step0" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="step0" className="flex items-center gap-1 text-xs">
              <FileText className="w-3 h-3" />
              المعلومات
            </TabsTrigger>
            <TabsTrigger value="step1" className="flex items-center gap-1 text-xs">
              <BarChart3 className="w-3 h-3" />
              المخازن
            </TabsTrigger>
            <TabsTrigger value="step2" className="flex items-center gap-1 text-xs">
              <Calculator className="w-3 h-3" />
              المصروفات
            </TabsTrigger>
            <TabsTrigger value="step3" className="flex items-center gap-1 text-xs">
              <DollarSign className="w-3 h-3" />
              الدرج والديون
            </TabsTrigger>
            <TabsTrigger value="step4" className="flex items-center gap-1 text-xs">
              <Banknote className="w-3 h-3" />
              الكاش
            </TabsTrigger>
            <TabsTrigger value="step5" className="flex items-center gap-1 text-xs">
              <Users className="w-3 h-3" />
              المساهمون
            </TabsTrigger>
          </TabsList>

          <TabsContent value="step0" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  تحديد الفترة الزمنية والإعدادات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Period Selection */}
                <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 border border-primary/20">
                  <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    تحديد الفترة
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">من تاريخ</Label>
                      <Input 
                        type="date" 
                        value={startDate ? startDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const newStartDate = new Date(e.target.value);
                          setStartDate(newStartDate);
                          // Auto-generate report name
                          if (endDate) {
                            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                            const month = newStartDate.getMonth();
                            const year = newStartDate.getFullYear();
                            const suggestedName = `تقرير أرباح ${monthNames[month]} ${year}`;
                            setReportName(suggestedName);
                            setTitle(suggestedName);
                          }
                        }}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">إلى تاريخ</Label>
                      <Input 
                        type="date" 
                        value={endDate ? endDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const newEndDate = new Date(e.target.value);
                          setEndDate(newEndDate);
                          // Auto-generate report name
                          if (startDate) {
                            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                            const month = startDate.getMonth();
                            const year = startDate.getFullYear();
                            const suggestedName = `تقرير أرباح ${monthNames[month]} ${year}`;
                            setReportName(suggestedName);
                            setTitle(suggestedName);
                          }
                        }}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  
                  {/* Month Selection Dropdown */}
                  <div className="mt-4">
                    <Label className="text-sm font-semibold text-slate-700">أو اختر شهر محدد</Label>
                    <select 
                      className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [year, month] = e.target.value.split('-').map(Number);
                          const start = new Date(year, month - 1, 1);
                          const end = new Date(year, month, 0);
                          setStartDate(start);
                          setEndDate(end);
                          
                          const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                          const suggestedName = `تقرير أرباح ${monthNames[month - 1]} ${year}`;
                          setReportName(suggestedName);
                          setTitle(suggestedName);
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">اختر شهر...</option>
                      {Array.from({length: 12}, (_, i) => {
                        const currentYear = new Date().getFullYear();
                        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return (
                          <option key={i} value={`${currentYear}-${i + 1}`}>
                            {monthNames[i]} {currentYear}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Report Name (Auto-generated) */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <Label className="text-sm font-bold text-blue-900 mb-2 block">اسم التقرير (يتم توليده تلقائياً)</Label>
                  <Input
                    value={reportName}
                    onChange={(e) => {
                      setReportName(e.target.value);
                      setTitle(e.target.value); // Keep title in sync
                    }}
                    placeholder="مثال: تقرير أرباح يناير 2025"
                    className="bg-white text-lg font-semibold"
                  />
                  <p className="text-xs text-blue-700 mt-2">
                    يتم توليد الاسم تلقائياً عند اختيار الفترة، ويمكنك تعديله حسب الحاجة
                  </p>
                </div>

                {/* Last Month Final Storage */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <Label className="text-sm font-bold text-green-900 mb-2 block">مخازن الشهر الماضي النهائية</Label>
                  <Input
                    type="text"
                    value={Number(lastMonthClosing).toLocaleString()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '');
                      if (/^\d*$/.test(value)) {
                        setLastMonthClosing(value);
                      }
                    }}
                    placeholder="0"
                    className="bg-white text-lg font-semibold text-center"
                  />
                  <p className="text-xs text-green-700 mt-2">
                    أدخل قيمة مخازن الشهر الماضي النهائية لحساب الفرق بدقة
                  </p>
                </div>

                {/* Branches Management */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                  <Label className="text-sm font-bold text-orange-900 mb-2 block flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    الفروع في هذا التقرير
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {branches.map((branch, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-orange-100 text-orange-800 flex items-center gap-1">
                        {branch}
                        <button
                          onClick={() => {
                            setBranches(prev => prev.filter((_, i) => i !== idx));
                            setBranchRows(prev => prev.filter(r => r.name !== branch));
                          }}
                          className="ml-1 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      placeholder="أضف فرع جديد..."
                      className="bg-white"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newBranch.trim()) {
                          if (!branches.includes(newBranch.trim())) {
                            setBranches(prev => [...prev, newBranch.trim()]);
                            setBranchRows(prev => [...prev, { name: newBranch.trim(), values: {} }]);
                          }
                          setNewBranch('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (newBranch.trim() && !branches.includes(newBranch.trim())) {
                          setBranches(prev => [...prev, newBranch.trim()]);
                          setBranchRows(prev => [...prev, { name: newBranch.trim(), values: {} }]);
                          setNewBranch('');
                        }
                      }}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expenses Management */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                  <Label className="text-sm font-bold text-purple-900 mb-3 block flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    المصروفات في هذا التقرير
                  </Label>
                  
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {expenses.map((eName, idx) => {
                      const currentType = expenseTypes.get(eName) || 'other';
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-purple-200">
                          <span className="font-medium text-sm">{eName}</span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={currentType === 'personal' ? 'default' : 'secondary'}
                              className={currentType === 'personal' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600'}
                            >
                              {currentType === 'personal' ? 'شخصي' : 'عادي'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newType = currentType === 'personal' ? 'other' : 'personal';
                                setExpenseTypes(prev => {
                                  const newMap = new Map(prev).set(eName, newType);
                                  return newMap;
                                });
                              }}
                              className="border-blue-300 hover:border-blue-500 text-blue-600 hover:text-blue-700 h-7 px-2"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setExpenses(prev => prev.filter((_, i) => i !== idx));
                                setExpenseTypes(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(eName);
                                  return newMap;
                                });
                                // Remove from branchRows
                                setBranchRows(prev => prev.map(row => {
                                  const newValues = { ...row.values };
                                  delete newValues[eName];
                                  return { ...row, values: newValues };
                                }));
                              }}
                              className="h-7 px-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newExpense}
                      onChange={(e) => setNewExpense(e.target.value)}
                      placeholder="أضف مصروف جديد..."
                      className="bg-white"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newExpense.trim()) {
                          if (!expenses.includes(newExpense.trim())) {
                            const typeChoice = confirm('هل هذا مصروف شخصي؟\n\nاضغط "موافق" للمصروف الشخصي (يضاف للكاش)\nاضغط "إلغاء" للمصروف العادي (يخصم من الأرباح)');
                            const expenseType = typeChoice ? 'personal' : 'other';
                            setExpenses(prev => [...prev, newExpense.trim()]);
                            setExpenseTypes(prev => new Map(prev).set(newExpense.trim(), expenseType));
                          }
                          setNewExpense('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (newExpense.trim() && !expenses.includes(newExpense.trim())) {
                          const typeChoice = confirm('هل هذا مصروف شخصي؟\n\nاضغط "موافق" للمصروف الشخصي (يضاف للكاش)\nاضغط "إلغاء" للمصروف العادي (يخصم من الأرباح)');
                          const expenseType = typeChoice ? 'personal' : 'other';
                          setExpenses(prev => [...prev, newExpense.trim()]);
                          setExpenseTypes(prev => new Map(prev).set(newExpense.trim(), expenseType));
                          setNewExpense('');
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step1" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>المخازن - أدخل مخزن كل فرع في بداية الفترة</CardTitle>
              </CardHeader>
              <CardContent>
                {branches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-3 text-right font-bold">الفرع</th>
                          <th className="border border-slate-300 p-3 text-center font-bold">المخازن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((branch, i) => {
                          const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                          const inventoryValue = row.values['مخازن'] || 0;
                          return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="border border-slate-300 p-3 font-semibold text-right">{branch}</td>
                              <td className="border border-slate-300 p-3 text-center">
                                <Input
                                  type="text"
                                  value={inventoryValue.toLocaleString()}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                                    setBranchRows(prev => {
                                      const updated = [...prev];
                                      const rowIndex = updated.findIndex(r => r.name === branch);
                                      if (rowIndex >= 0) {
                                        updated[rowIndex] = {
                                          ...updated[rowIndex],
                                          values: { ...updated[rowIndex].values, 'مخازن': value }
                                        };
                                      } else {
                                        updated.push({
                                          name: branch,
                                          values: { 'مخازن': value }
                                        });
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="text-center font-mono"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>لا توجد فروع محددة في التقرير</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step2" className="space-y-6">
            {/* Personal Expenses Table */}
            {expenses.filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e)).length > 0 && (
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg rounded-2xl">
                <CardHeader className="pb-4 border-b border-blue-200">
                  <CardTitle className="text-xl font-bold text-blue-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    المصروفات الشخصية
                    <Badge className="bg-blue-500 text-white">تضاف للكاش</Badge>
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    هذه المصروفات لا تؤثر على الربح وتضاف إلى حساب المحل
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-blue-300 bg-gradient-to-r from-blue-100 to-indigo-100 p-3 text-right font-bold text-blue-800">المصروف \ الفرع</th>
                          {branches.map((branch, branchIdx) => (
                            <th key={branchIdx} className="border border-blue-300 bg-gradient-to-r from-blue-100 to-indigo-100 p-3 text-center font-bold text-blue-800">{branch}</th>
                          ))}
                          <th className="border border-blue-300 bg-gradient-to-r from-blue-100 to-indigo-100 p-3 text-center font-bold text-blue-800">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e)).map((expense, expenseIdx) => (
                          <tr key={expenseIdx} className={expenseIdx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            <td className="border border-blue-200 p-3 font-semibold text-right">{expense}</td>
                            {branches.map((branch, branchIdx) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              return (
                                <td key={`${expenseIdx}-${branchIdx}`} className="border border-blue-200 p-3 text-center">
                                  <input
                                    type="text"
                                    defaultValue={Number(row.values[expense] || 0) === 0 ? '' : Number(row.values[expense] || 0).toLocaleString('en-US')}
                                    key={`personal-${expenseIdx}-${branchIdx}-${row.values[expense]}`}
                                    onChange={(e) => {
                                      const inputValue = e.target.value;
                                      console.log('🔢 Input value:', inputValue);
                                      const isValid = validateNumericInputWithNegative(inputValue);
                                      console.log('✅ Is valid?', isValid);
                                      if (!isValid) {
                                        console.log('❌ Validation failed, returning');
                                        return;
                                      }
                                      const value = parseNumber(inputValue);
                                      console.log('💰 Parsed value:', value);
                                      {
                                        setBranchRows(prev => {
                                          const updated = [...prev];
                                          const rowIndex = updated.findIndex(r => r.name === branch);
                                          if (rowIndex >= 0) {
                                            updated[rowIndex] = {
                                              ...updated[rowIndex],
                                              values: { ...updated[rowIndex].values, [expense]: value }
                                            };
                                          } else {
                                            updated.push({
                                              name: branch,
                                              values: { [expense]: value }
                                            });
                                          }
                                          return updated;
                                        });
                                      }
                                    }}
                                    className="flex h-9 w-full rounded-md border border-blue-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-center"
                                  />
                                </td>
                              );
                            })}
                            <td className="border border-blue-200 p-3 text-center font-bold text-blue-800">
                              {branches.reduce((sum, branch) => {
                                const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                return sum + (row.values[expense] || 0);
                              }, 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                          <td className="border border-blue-300 p-3 font-bold text-right text-blue-800">الإجمالي</td>
                          {branches.map((branch, branchIdx) => (
                            <td key={branchIdx} className="border border-blue-300 p-3 text-center font-bold text-blue-800">
                              {expenses
                                .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                                .reduce((sum, expense) => {
                                  const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                  return sum + (row.values[expense] || 0);
                                }, 0)
                                .toLocaleString()}
                            </td>
                          ))}
                          <td className="border border-blue-300 p-3 text-center font-bold text-blue-800">
                            {expenses
                              .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                              .reduce((sum, expense) => sum + branches.reduce((branchSum, branch) => {
                                const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                return branchSum + (row.values[expense] || 0);
                              }, 0), 0)
                              .toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Other Expenses Table */}
            {expenses.filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e)).length > 0 && (
              <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-2xl">
                <CardHeader className="pb-4 border-b border-slate-200">
                  <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-violet-500 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    المصروفات العادية
                    <Badge variant="secondary">تؤثر على الربح</Badge>
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    هذه المصروفات تخصم من الأرباح
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-right font-bold text-primary">المصروف \ الفرع</th>
                          {branches.map((branch, branchIdx) => (
                            <th key={branchIdx} className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">{branch}</th>
                          ))}
                          <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e)).map((expense, expenseIdx) => (
                          <tr key={expenseIdx} className={expenseIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="border p-3 font-semibold text-right">{expense}</td>
                            {branches.map((branch, branchIdx) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              return (
                                <td key={`${expenseIdx}-${branchIdx}`} className="border p-3 text-center">
                                  <input
                                    type="text"
                                    defaultValue={Number(row.values[expense] || 0) === 0 ? '' : Number(row.values[expense] || 0).toLocaleString('en-US')}
                                    key={`other-${expenseIdx}-${branchIdx}-${row.values[expense]}`}
                                    onChange={(e) => {
                                      const inputValue = e.target.value;
                                      const isValid = validateNumericInputWithNegative(inputValue);
                                      if (!isValid) return;
                                      const value = parseNumber(inputValue);
                                      {
                                        setBranchRows(prev => {
                                          const updated = [...prev];
                                          const rowIndex = updated.findIndex(r => r.name === branch);
                                          if (rowIndex >= 0) {
                                            updated[rowIndex] = {
                                              ...updated[rowIndex],
                                              values: { ...updated[rowIndex].values, [expense]: value }
                                            };
                                          } else {
                                            updated.push({
                                              name: branch,
                                              values: { [expense]: value }
                                            });
                                          }
                                          return updated;
                                        });
                                      }
                                    }}
                                    className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center"
                                  />
                                </td>
                              );
                            })}
                            <td className="border p-3 text-center font-bold text-primary">
                              {branches.reduce((sum, branch) => {
                                const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                return sum + (row.values[expense] || 0);
                              }, 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gradient-to-r from-primary/5 to-secondary/5">
                          <td className="border p-3 font-bold text-right text-primary">الإجمالي</td>
                          {branches.map((branch, branchIdx) => (
                            <td key={branchIdx} className="border p-3 text-center font-bold text-primary">
                              {expenses
                                .filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                                .reduce((sum, expense) => {
                                  const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                  return sum + (row.values[expense] || 0);
                                }, 0)
                                .toLocaleString()}
                            </td>
                          ))}
                          <td className="border p-3 text-center font-bold text-primary">
                            {expenses
                              .filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                              .reduce((sum, expense) => sum + branches.reduce((branchSum, branch) => {
                                const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                                return branchSum + (row.values[expense] || 0);
                              }, 0), 0)
                              .toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="step3" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الدرج والديون - أدخل الدرج والديون لكل فرع</CardTitle>
              </CardHeader>
              <CardContent>
                {branches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-3 text-right font-bold sticky right-0 bg-slate-100">البند</th>
                          {branches.map((branch, i) => (
                            <th key={i} className="border border-slate-300 p-3 text-center font-bold min-w-[150px]">
                              {branch}
                            </th>
                          ))}
                          <th className="border border-slate-300 p-3 text-center font-bold bg-blue-100 min-w-[150px]">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* الدرج Row */}
                        <tr className="bg-white">
                          <td className="border border-slate-300 p-3 font-semibold text-right sticky right-0 bg-white">الدرج</td>
                          {branches.map((branch, i) => {
                            const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                            return (
                              <td key={i} className="border border-slate-300 p-1">
                                <input
                                  type="text"
                                  defaultValue={Number(row.values['كاش الدرج'] || 0) === 0 ? '' : Number(row.values['كاش الدرج'] || 0).toLocaleString('en-US')}
                                  key={`drawer-${i}-${row.values['كاش الدرج']}`}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (!validateNumericInputWithNegative(inputValue)) return;
                                    const value = parseNumber(inputValue);
                                    setBranchRows(prev => {
                                      const updated = [...prev];
                                      const rowIndex = updated.findIndex(r => r.name === branch);
                                      if (rowIndex >= 0) {
                                        updated[rowIndex] = {
                                          ...updated[rowIndex],
                                          values: { ...updated[rowIndex].values, 'كاش الدرج': value }
                                        };
                                      } else {
                                        updated.push({
                                          name: branch,
                                          values: { 'كاش الدرج': value }
                                        });
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center font-mono"
                                />
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-3 text-center font-bold text-primary bg-blue-50">
                            {branches.reduce((sum, branch) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              return sum + Number(row.values['كاش الدرج'] || 0);
                            }, 0).toLocaleString()}
                          </td>
                        </tr>
                        
                        {/* ديون ليه Row */}
                        <tr className="bg-slate-50">
                          <td className="border border-slate-300 p-3 font-semibold text-right sticky right-0 bg-slate-50">ديون ليه</td>
                          {branches.map((branch, i) => {
                            const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                            return (
                              <td key={i} className="border border-slate-300 p-1">
                                <input
                                  type="text"
                                  defaultValue={Number(row.values['ديون ليه'] || 0) === 0 ? '' : Number(row.values['ديون ليه'] || 0).toLocaleString('en-US')}
                                  key={`debts-to-${i}-${row.values['ديون ليه']}`}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (!validateNumericInputWithNegative(inputValue)) return;
                                    const value = parseNumber(inputValue);
                                    setBranchRows(prev => {
                                      const updated = [...prev];
                                      const rowIndex = updated.findIndex(r => r.name === branch);
                                      if (rowIndex >= 0) {
                                        updated[rowIndex] = {
                                          ...updated[rowIndex],
                                          values: { ...updated[rowIndex].values, 'ديون ليه': value }
                                        };
                                      } else {
                                        updated.push({
                                          name: branch,
                                          values: { 'ديون ليه': value }
                                        });
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center font-mono"
                                />
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-3 text-center font-bold text-green-600 bg-green-50">
                            {branches.reduce((sum, branch) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              return sum + Number(row.values['ديون ليه'] || 0);
                            }, 0).toLocaleString()}
                          </td>
                        </tr>
                        
                        {/* ديون عليه Row */}
                        <tr className="bg-white">
                          <td className="border border-slate-300 p-3 font-semibold text-right sticky right-0 bg-white">ديون عليه</td>
                          {branches.map((branch, i) => {
                            const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                            return (
                              <td key={i} className="border border-slate-300 p-1">
                                <input
                                  type="text"
                                  defaultValue={Number(row.values['ديون عليه'] || 0) === 0 ? '' : Number(row.values['ديون عليه'] || 0).toLocaleString('en-US')}
                                  key={`debts-on-${i}-${row.values['ديون عليه']}`}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (!validateNumericInputWithNegative(inputValue)) return;
                                    const value = parseNumber(inputValue);
                                    setBranchRows(prev => {
                                      const updated = [...prev];
                                      const rowIndex = updated.findIndex(r => r.name === branch);
                                      if (rowIndex >= 0) {
                                        updated[rowIndex] = {
                                          ...updated[rowIndex],
                                          values: { ...updated[rowIndex].values, 'ديون عليه': value }
                                        };
                                      } else {
                                        updated.push({
                                          name: branch,
                                          values: { 'ديون عليه': value }
                                        });
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center font-mono"
                                />
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-3 text-center font-bold text-red-600 bg-red-50">
                            {branches.reduce((sum, branch) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              return sum + Number(row.values['ديون عليه'] || 0);
                            }, 0).toLocaleString()}
                          </td>
                        </tr>
                        
                        {/* Totals Row */}
                        <tr className="bg-gradient-to-r from-primary/10 to-secondary/10 font-bold">
                          <td className="border border-slate-300 p-3 text-right sticky right-0 bg-gradient-to-r from-primary/10 to-secondary/10">الإجمالي الكلي</td>
                          {branches.map((branch, i) => {
                            const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                            const drawerVal = Number(row.values['كاش الدرج'] || 0);
                            const debtsToVal = Number(row.values['ديون ليه'] || 0);
                            const debtsOnVal = Number(row.values['ديون عليه'] || 0);
                            const total = drawerVal + debtsToVal - debtsOnVal;
                            return (
                              <td key={i} className="border border-slate-300 p-3 text-center text-primary">
                                {total.toLocaleString()}
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-3 text-center text-lg text-primary bg-blue-100">
                            {branches.reduce((sum, branch) => {
                              const row = branchRows.find(r => r.name === branch) || { name: branch, values: {} };
                              const drawerVal = Number(row.values['كاش الدرج'] || 0);
                              const debtsToVal = Number(row.values['ديون ليه'] || 0);
                              const debtsOnVal = Number(row.values['ديون عليه'] || 0);
                              return sum + (drawerVal + debtsToVal - debtsOnVal);
                            }, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>لا توجد فروع محددة في التقرير</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step4" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>تفاصيل الكاش</span>
                  <Badge variant="secondary" className="text-lg px-4 py-2 bg-green-100 text-green-800">
                    الإجمالي: {(
                      cashBreakdown.outletExpenses +
                      cashBreakdown.home +
                      cashBreakdown.bank +
                      cashBreakdown.drawer +
                      (cashBreakdown.vodafone || 0) +
                      (cashBreakdown.customRows?.reduce((sum, row) => sum + row.amount, 0) || 0)
                    ).toLocaleString()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Main Cash Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                        <th className="border border-slate-300 p-3 text-right font-bold text-blue-900">البند</th>
                        <th className="border border-slate-300 p-3 text-center font-bold text-blue-900">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* المصروفات من حساب المحل */}
                      <tr className="bg-blue-50">
                        <td className="border border-slate-300 p-3 text-right font-semibold">
                          المصروفات من حساب المحل
                          <span className="text-xs text-blue-600 block mt-1">(محسوب تلقائياً)</span>
                        </td>
                        <td className="border border-slate-300 p-2">
                          <Input
                            type="text"
                            value={cashBreakdown.outletExpenses.toLocaleString()}
                            readOnly
                            disabled
                            className="text-center font-mono bg-blue-100 cursor-not-allowed border-0"
                          />
                        </td>
                      </tr>
                      
                      {/* المنزل */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 p-3 text-right font-semibold">المنزل</td>
                        <td className="border border-slate-300 p-2">
                          <Input
                            type="text"
                            value={cashBreakdown.home.toLocaleString()}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/,/g, '');
                              const value = cleaned === '' || cleaned === '-' ? 0 : parseFloat(cleaned);
                              if (!isNaN(value)) setCashBreakdown(prev => ({ ...prev, home: value }));
                            }}
                            className="text-center font-mono border-0"
                          />
                        </td>
                      </tr>
                      
                      {/* كاش الدرج */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 p-3 text-right font-semibold">
                          كاش الدرج
                          <span className="text-xs text-blue-600 block mt-1">(محسوب تلقائياً من الدرج والديون)</span>
                        </td>
                        <td className="border border-slate-300 p-2">
                          <Input
                            type="text"
                            value={cashBreakdown.drawer.toLocaleString()}
                            readOnly
                            disabled
                            className="text-center font-mono bg-blue-100 cursor-not-allowed border-0"
                          />
                        </td>
                      </tr>
                      
                      {/* البنك */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 p-3 text-right font-semibold">البنك</td>
                        <td className="border border-slate-300 p-2">
                          <Input
                            type="text"
                            value={cashBreakdown.bank.toLocaleString()}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/,/g, '');
                              const value = cleaned === '' || cleaned === '-' ? 0 : parseFloat(cleaned);
                              if (!isNaN(value)) setCashBreakdown(prev => ({ ...prev, bank: value }));
                            }}
                            className="text-center font-mono border-0"
                          />
                        </td>
                      </tr>
                      
                      {/* فودافون */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 p-3 text-right font-semibold">فودافون</td>
                        <td className="border border-slate-300 p-2">
                          <Input
                            type="text"
                            value={(cashBreakdown.vodafone || 0).toLocaleString()}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/,/g, '');
                              const value = cleaned === '' || cleaned === '-' ? 0 : parseFloat(cleaned);
                              if (!isNaN(value)) setCashBreakdown(prev => ({ ...prev, vodafone: value }));
                            }}
                            className="text-center font-mono border-0"
                          />
                        </td>
                      </tr>
                      
                      {/* Subtotal Row */}
                      <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold">
                        <td className="border border-slate-300 p-3 text-right text-blue-900">إجمالي الحسابات الأساسية</td>
                        <td className="border border-slate-300 p-3 text-center text-lg text-primary">
                          {(
                            cashBreakdown.outletExpenses +
                            cashBreakdown.home +
                            cashBreakdown.bank +
                            cashBreakdown.drawer +
                            (cashBreakdown.vodafone || 0)
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Custom Cash Rows */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">
                      صفوف كاش مخصصة ({cashBreakdown.customRows?.length || 0})
                    </Label>
                    <Button
                      size="sm"
                      onClick={() => {
                        const newRow = {
                          id: crypto.randomUUID(),
                          name: `صف مخصص ${(cashBreakdown.customRows?.length || 0) + 1}`,
                          amount: 0
                        };
                        setCashBreakdown(prev => ({
                          ...prev,
                          customRows: [...(prev.customRows || []), newRow]
                        }));
                      }}
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      إضافة صف
                    </Button>
                  </div>
                  
                  {(!cashBreakdown.customRows || cashBreakdown.customRows.length === 0) && (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      لا توجد صفوف كاش مخصصة في هذا التقرير
                    </div>
                  )}
                  
                  {cashBreakdown.customRows?.map((row, index) => (
                    <div key={row.id} className="flex gap-2 mb-2">
                      <Input
                        placeholder="اسم الصف"
                        value={row.name}
                        onChange={(e) => {
                          setCashBreakdown(prev => ({
                            ...prev,
                            customRows: prev.customRows?.map(r => 
                              r.id === row.id ? { ...r, name: e.target.value } : r
                            )
                          }));
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="text"
                        placeholder="المبلغ"
                        value={row.amount.toLocaleString()}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/,/g, '');
                          const value = cleaned === '' || cleaned === '-' ? 0 : parseFloat(cleaned);
                          if (!isNaN(value)) {
                            setCashBreakdown(prev => ({
                              ...prev,
                              customRows: prev.customRows?.map(r => 
                                r.id === row.id ? { ...r, amount: value } : r
                              )
                            }));
                          }
                        }}
                        className="w-32 text-center font-mono"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setCashBreakdown(prev => ({
                            ...prev,
                            customRows: prev.customRows?.filter(r => r.id !== row.id)
                          }));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {/* Subtotal for Custom Rows */}
                  {cashBreakdown.customRows && cashBreakdown.customRows.length > 0 && (
                    <div className="bg-purple-100 rounded-lg p-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-purple-900">إجمالي الصفوف المخصصة:</span>
                        <span className="text-xl font-bold text-purple-700">
                          {(cashBreakdown.customRows?.reduce((sum, row) => sum + row.amount, 0) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Grand Total */}
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 border-2 border-green-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-green-900">الإجمالي النهائي للكاش:</span>
                    <span className="text-2xl font-bold text-green-700">
                      {(
                        cashBreakdown.outletExpenses +
                        cashBreakdown.home +
                        cashBreakdown.bank +
                        cashBreakdown.drawer +
                        (cashBreakdown.vodafone || 0) +
                        (cashBreakdown.customRows?.reduce((sum, row) => sum + row.amount, 0) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step5" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>اختيار المساهمين المشمولين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button onClick={() => setSelectedShareholders(new Set(shareholders.map(s => s.id)))}>
                    تحديد الكل
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedShareholders(new Set())}>
                    إلغاء الكل
                  </Button>
                  <span className="text-sm text-slate-600 ml-auto">
                    المحدد: {selectedShareholders.size} من {shareholders.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {shareholders.map(shareholder => {
                    const balanceBeforeReport = getBalanceBeforeReport(shareholder.id);
                    return (
                    <div
                      key={shareholder.id}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedShareholders.has(shareholder.id)
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => {
                        const newSet = new Set(selectedShareholders);
                        const wasSelected = newSet.has(shareholder.id);
                        const originallySelected = report?.affectedShareholders?.includes(shareholder.id) || false;
                        
                        if (wasSelected) {
                          // Deselecting - check if they were originally selected
                          if (originallySelected) {
                            const confirmed = confirm(
                              `تحذير: إلغاء تحديد ${shareholder.name} سيؤدي إلى:\n\n` +
                              `• إلغاء التغييرات السابقة على رصيده\n` +
                              `• إنشاء سجل جديد في "سجل التغييرات والمعاملات"\n` +
                              `• إعادة رصيده إلى القيمة الأصلية قبل هذا التقرير\n\n` +
                              `هل تريد المتابعة؟`
                            );
                            if (!confirmed) return;
                          }
                          newSet.delete(shareholder.id);
                        } else {
                          // Selecting
                          newSet.add(shareholder.id);
                        }
                        setSelectedShareholders(newSet);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{shareholder.name}</div>
                          <div className="text-sm text-slate-600">
                            رصيد: {Math.round(getBalanceBeforeReport(shareholder.id)).toLocaleString()} | نسبة: {shareholder.percentage}%
                          </div>
                        </div>
                        {selectedShareholders.has(shareholder.id) && (
                          <Badge className="bg-emerald-500">محدد</Badge>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="w-4 h-4 ml-1" />
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 ml-1" />
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
