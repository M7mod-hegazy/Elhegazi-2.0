import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Edit, History, Info, Plus, Save, Trash2, Users, FileText, TrendingUp, TrendingDown, Calendar, Eye, ExternalLink, Filter } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { apiGet, apiPutJson } from '@/lib/api';
import { calculateProfitPerPound, calculateShareholderDelta, calculateCompareLastMonth } from '@/lib/profitCalculations';

// Keep the same storage format used in Profit.tsx
export type Shareholder = { id: string; name: string; amount: number; percentage: number; createdAt?: number; initialAmount?: number };
export type ShareTxn = { id: string; date: string; reportId?: string; delta: number; fromAmount: number; toAmount: number; netProfit: number; finalBalance: number; source?: 'auto' | 'manual'; active?: boolean; note?: string };

// Profit report types
type ProfitReport = {
  _id: string;
  title: string;
  reportName?: string;
  description?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  branches?: string[];
  expenses?: string[];
  affectedShareholders?: string[];
  branchRows?: Array<{
    name: string;
    values: Record<string, number>;
  }>;
  totals?: {
    netProfit?: number;
    finalBalance?: number;
    totalProfits?: number;
    totalExpenses?: number;
    sumByExpense?: Record<string, number>;
    compareLastMonth?: number;
  };
  cashBreakdown?: {
    outletExpenses?: number;
    home?: number;
    bank?: number;
    drawer?: number;
    lastMonthClosing?: number;
  };
};

const validateNumericInput = (v: string) => /^[0-9,.]*$/.test(v);
const sanitizeNumericValue = (v: string) => Number(String(v || '0').replace(/,/g, '')) || 0;
const formatNumber = (n: number | string) => {
  const num = typeof n === 'string' ? sanitizeNumericValue(n) : Number(n || 0);
  return num.toLocaleString('en-US'); // 3-digit grouping with comma
};
// Format input as user types: keep only digits and one dot, then add commas to integer part
const formatInputWithCommas = (s: string) => {
  if (!s) return '';
  // keep digits and dots, drop others (commas are re-added)
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const intPart = parts[0].replace(/^0+(\d)/, '$1');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 1) return `${withCommas}.${parts.slice(1).join('')}`;
  return withCommas;
};

// Transaction Row Component
function TransactionRow({
  txn,
  idx,
  selectedId,
  profitReports,
  navigate,
  deleteTransaction,
  shareholders,
  globalCashBreakdown,
  onShowDetails
}: {
  txn: ShareTxn;
  idx: number;
  selectedId: string;
  profitReports: ProfitReport[];
  navigate: NavigateFunction;
  deleteTransaction: (id: string, txnId: string) => void;
  shareholders: Shareholder[];
  globalCashBreakdown: { outletExpenses?: number };
  onShowDetails: (txn: ShareTxn) => void;
}) {
  // Check if this is the creation transaction (non-deletable)
  const isCreationTxn = txn.note?.includes('إنشاء مساهم جديد') || txn.fromAmount === 0;

  // Recalculate correct values for display
  const relatedReport = profitReports.find(r =>
    r._id === txn.reportId || txn.reportId?.startsWith(r._id + '_')
  );

  let displayDelta = txn.delta;
  let displayToAmount = txn.toAmount;

  if (txn.source === 'auto' && relatedReport?.totals) {
    const shareholder = shareholders.find(s => s.id === selectedId);
    if (shareholder) {
      const lastMonthClosing = relatedReport.cashBreakdown?.lastMonthClosing;
      const finalBalance = relatedReport.totals.finalBalance;

      if (lastMonthClosing !== undefined && finalBalance !== undefined) {
        // ✅ Using centralized formulas from profitCalculations.ts
        const currentDifference = calculateCompareLastMonth(finalBalance, lastMonthClosing);
        const profitPerPound = calculateProfitPerPound(currentDifference, finalBalance);

        displayDelta = calculateShareholderDelta(txn.fromAmount, profitPerPound, shareholder.percentage);
        displayToAmount = txn.fromAmount + displayDelta;
      }
    }
  }

  return (
    <tr
      className={`border-b border-slate-200/50 hover:bg-gradient-to-r hover:from-emerald-50/20 hover:to-primary/5 transition-all duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
        } ${isCreationTxn ? 'bg-amber-50/30' : ''}`}
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          {isCreationTxn && (
            <div className="w-4 h-4 flex items-center justify-center" title="العملية الأولى">
              🔒
            </div>
          )}
          <span>{new Date(txn.date).toLocaleString('ar-EG')}</span>
        </div>
      </td>
      <td className="p-3 text-center text-slate-600">{formatNumber(txn.fromAmount)}</td>
      <td className="p-3 text-center">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${displayDelta >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {displayDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {displayDelta >= 0 ? '+' : ''}{formatNumber(displayDelta)}
        </span>
      </td>
      <td className="p-3 text-center font-semibold text-slate-800">{formatNumber(displayToAmount)}</td>
      <td className="p-3 text-center">{Number(txn.finalBalance) > 0 ? (Number(txn.netProfit || 0) / Number(txn.finalBalance || 0)).toFixed(4) : '0.0000'}</td>
      <td className="p-3 text-center">{formatNumber(txn.netProfit)}</td>
      <td className="p-3 text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border cursor-help ${txn.source === 'auto' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {txn.source === 'auto' ? 'تلقائي' : 'يدوي'}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs text-sm">
              {txn.source === 'auto'
                ? 'تُسجل تلقائيًا عند إنشاء نتيجة الأرباح في صفحة الأرباح، ويتم حساب الزيادة بناءً على ربح الجنيه × نسبة المساهم.'
                : 'عملية تمت يدويًا من هذه الصفحة لتعديل الرصيد (زيادة أو نقصان) مع تسجيل التفاصيل.'}
            </div>
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="p-3 text-center">
        {txn.reportId && txn.source === 'auto' ? (
          (() => {
            // Handle reportIds with suffixes like _edit_, _profit_, etc.
            const relatedReport = profitReports.find(report =>
              report._id === txn.reportId || txn.reportId?.startsWith(report._id + '_')
            );

            if (relatedReport) {
              // Extract month and year from report dates
              const startDate = new Date(relatedReport.startDate);
              const endDate = new Date(relatedReport.endDate);
              const monthName = endDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

              return (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-300 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-xs px-2 py-1 h-auto"
                  onClick={() => {
                    navigate(`/admin/profit?view=${relatedReport._id}`);
                  }}
                  title={relatedReport.title || relatedReport.reportName}
                >
                  <Calendar className="w-3 h-3 ml-1" />
                  {monthName}
                </Button>
              );
            } else {
              // Report not found - show report ID for debugging
              console.error('❌ Report not found! Transaction reportId:', txn.reportId);
              console.error('❌ This reportId does not match any loaded report');
              return (
                <div className="text-xs">
                  <div className="text-slate-400">تقرير محذوف</div>
                  <div className="text-slate-300 text-[10px]">ID: {txn.reportId.substring(0, 8)}...</div>
                </div>
              );
            }
          })()
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )}
      </td>
      <td className="p-3 text-right align-top max-w-md">
        <div className={`rounded-xl border-2 overflow-hidden ${Number(txn.delta) === 0
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
          : txn.source === 'auto'
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300'
          }`}>
          {/* Header Badge */}
          <div className={`px-3 py-1.5 flex items-center justify-between ${Number(txn.delta) === 0
            ? 'bg-amber-100/80'
            : txn.source === 'auto'
              ? 'bg-emerald-100/80'
              : 'bg-blue-100/80'
            }`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-3.5 h-3.5 ${Number(txn.delta) === 0
                ? 'text-amber-700'
                : txn.source === 'auto'
                  ? 'text-emerald-700'
                  : 'text-blue-700'
                }`} />
              <span className={`text-xs font-bold ${Number(txn.delta) === 0
                ? 'text-amber-800'
                : txn.source === 'auto'
                  ? 'text-emerald-800'
                  : 'text-blue-800'
                }`}>
                {txn.source === 'auto' ? '🤖 عملية تلقائية' : '✋ عملية يدوية'}
              </span>
            </div>
            {Number(txn.delta) === 0 && (
              <Badge variant="outline" className="text-xs bg-white/50 border-amber-400 text-amber-700">
                بدون تغيير
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="p-3 space-y-2">
            {/* Main Info */}
            <div className="flex items-start gap-2">
              <div className={`w-1 h-full rounded-full ${Number(txn.delta) === 0
                ? 'bg-amber-400'
                : txn.source === 'auto'
                  ? 'bg-emerald-400'
                  : 'bg-blue-400'
                }`}></div>
              <div className="flex-1 space-y-1.5">
                {txn.source === 'auto' ? (
                  <>
                    {/* Compact summary with details button */}
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/20 text-primary border-0">
                        🤖 عملية آلية من تقرير الأرباح
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">الفرق:</span>
                      <code className="px-2 py-0.5 bg-white/80 rounded text-xs font-mono text-slate-700 border border-slate-200">
                        {displayDelta >= 0 ? '+' : ''}{formatNumber(displayDelta)}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); onShowDetails(txn); }}
                      className="mt-2 border-primary/30 hover:bg-primary/10 text-primary text-xs"
                    >
                      <Eye className="w-3 h-3 ml-1" />
                      تفاصيل العملية
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className={`${txn.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {txn.delta >= 0 ? '⬆️ زيادة' : '⬇️ نقصان'}
                      </Badge>
                      <span className="text-sm font-bold text-slate-800">
                        {formatNumber(Math.abs(Number(txn.delta) || 0))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">من</span>
                      <code className="px-2 py-0.5 bg-white/80 rounded text-xs font-mono text-slate-700 border border-slate-200">
                        {formatNumber(txn.fromAmount)}
                      </code>
                      <span className="text-xs text-slate-600">إلى</span>
                      <code className="px-2 py-0.5 bg-white/80 rounded text-xs font-mono text-slate-700 border border-slate-200">
                        {formatNumber(txn.toAmount)}
                      </code>
                    </div>

                    {/* Custom Note for manual transactions */}
                    {txn.note && (
                      <div className="mt-2 p-2 bg-white/60 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-slate-700">💬</span>
                          <p className="text-xs text-slate-700 leading-relaxed">{txn.note}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
      <td className="p-3 text-center">
        {isCreationTxn ? (
          <Button
            size="sm"
            variant="outline"
            disabled
            className="border-slate-300 text-slate-400 cursor-not-allowed opacity-50"
            title="لا يمكن حذف العملية الأولى"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteTransaction(selectedId, txn.id)}
            className="border-rose-300 hover:bg-rose-50 hover:border-rose-400 text-rose-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function AdminShareholders() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load from MongoDB (same as Profit.tsx)
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [shareHistory, setShareHistory] = useState<Record<string, ShareTxn[]>>({});
  const [loading, setLoading] = useState(true);

  // Profit reports state
  const [profitReports, setProfitReports] = useState<ProfitReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [globalCashBreakdown, setGlobalCashBreakdown] = useState<{ outletExpenses?: number }>({});

  // Transaction management state
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [addTxnShareholderId, setAddTxnShareholderId] = useState<string | null>(null);
  const [txnDelta, setTxnDelta] = useState<string>('');
  const [txnNote, setTxnNote] = useState('');
  const [txnDate, setTxnDate] = useState<Date>(new Date());
  const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null);

  // Transaction details modal state
  const [detailsTxn, setDetailsTxn] = useState<ShareTxn | null>(null);

  // Collapsible sections state
  const [expandedSection, setExpandedSection] = useState<'guide' | 'filter' | null>(null);

  // Load shareholders from MongoDB on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiGet<{ shareholders?: Shareholder[]; shareHistory?: Record<string, ShareTxn[]> }>('/api/profit-settings');
        // Loaded shareholders from API

        if (resp.ok && resp.item) {
          const loadedShareholders = Array.isArray(resp.item.shareholders) ? resp.item.shareholders : [];
          const loadedShareHistory = resp.item.shareHistory && typeof resp.item.shareHistory === 'object'
            ? resp.item.shareHistory
            : {};
          const loadedCashBreakdown = (resp.item as Record<string, unknown>).cashBreakdown as { outletExpenses?: number } || {};

          // Loaded shareholders, shareHistory, and cashBreakdown

          setShareholders(loadedShareholders);
          setShareHistory(loadedShareHistory);
          setGlobalCashBreakdown(loadedCashBreakdown);
        }
      } catch (e) {
        console.error('💥 Error loading shareholders:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load profit reports from MongoDB
  useEffect(() => {
    (async () => {
      setLoadingReports(true);
      try {
        const resp = await apiGet<ProfitReport[]>('/api/profit-reports');
        if (resp.ok && Array.isArray(resp.item)) {
          setProfitReports(resp.item);
        } else if (resp.ok && Array.isArray(resp.items)) {
          setProfitReports(resp.items as unknown as ProfitReport[]);
        }
      } catch (e) {
        console.error('Error loading profit reports:', e);
      } finally {
        setLoadingReports(false);
      }
    })();
  }, []);

  // Get related profit reports for a shareholder based on their transaction history
  const getRelatedReports = (shareholderId: string): ProfitReport[] => {
    const history = shareHistory[shareholderId] || [];
    const reportIds = [...new Set(history.map(h => h.reportId).filter(Boolean))];
    return profitReports.filter(report => reportIds.includes(report._id));
  };

  // Recalculate all transaction balances for a shareholder
  const recalculateHistory = (shareholderId: string, history: ShareTxn[]) => {
    const shareholder = shareholders.find(s => s.id === shareholderId);
    if (!shareholder) return;

    // Check for affected reports
    const affectedReportIds = new Set(history.filter(t => t.reportId).map(t => t.reportId));
    const affectedReportsCount = affectedReportIds.size;

    // IMPORTANT: Always start from initialAmount, NOT current amount
    // Using current amount would double the balance when recalculating
    let runningBalance = shareholder.initialAmount || 0;

    // Sort by date to ensure chronological order
    const sorted = [...history].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recalculated = sorted.map((txn) => {
      const fromAmount = runningBalance;
      const toAmount = fromAmount + txn.delta;
      runningBalance = toAmount;

      return {
        ...txn,
        fromAmount,
        toAmount
      };
    });

    // Update state
    setShareHistory(prev => ({ ...prev, [shareholderId]: recalculated }));

    // Update shareholder's current balance
    setShareholders(prev => prev.map(s =>
      s.id === shareholderId ? { ...s, amount: runningBalance } : s
    ));

    // Show warning if reports are affected
    if (affectedReportsCount > 0) {
      console.warn(`⚠️ ${affectedReportsCount} تقرير(تقارير) متأثرة بهذا التغيير`);
      toast({
        title: 'تنبيه: تقارير متأثرة',
        description: `هذا التغيير يؤثر على ${affectedReportsCount} تقرير أرباح. قد تحتاج إلى مراجعة التقارير المتأثرة.`,
        variant: 'default',
        duration: 5000,
      });
    }
  };

  // Add manual transaction
  const addManualTransaction = () => {
    if (!addTxnShareholderId) return;

    const delta = sanitizeNumericValue(txnDelta);
    if (delta === 0) {
      toast({ title: 'خطأ', description: 'يجب إدخال قيمة التغيير', variant: 'destructive' });
      return;
    }

    const shareholder = shareholders.find(s => s.id === addTxnShareholderId);
    if (!shareholder) return;

    const history = shareHistory[addTxnShareholderId] || [];

    // Calculate fromAmount based on current balance
    const lastTxn = history.length > 0 ? history[history.length - 1] : null;
    const fromAmount = lastTxn ? lastTxn.toAmount : (shareholder.initialAmount || shareholder.amount);
    const toAmount = fromAmount + delta;

    // Check for negative balance
    if (toAmount < 0) {
      toast({
        title: 'خطأ',
        description: 'لا يمكن أن يكون الرصيد سالباً',
        variant: 'destructive'
      });
      return;
    }

    const newTxn: ShareTxn = {
      id: crypto.randomUUID(),
      date: txnDate.toISOString(),
      delta,
      fromAmount,
      toAmount,
      netProfit: 0,
      finalBalance: 0,
      source: 'manual',
      note: txnNote || `${delta >= 0 ? 'زيادة' : 'نقصان'} يدوية`
    };

    // Insert at correct chronological position
    const updatedHistory = [...history, newTxn].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Recalculate all subsequent transactions
    recalculateHistory(addTxnShareholderId, updatedHistory);

    // Reset form and close dialog
    setTxnDelta('');
    setTxnNote('');
    setTxnDate(new Date());
    setShowAddTransaction(false);
    setAddTxnShareholderId(null);

    toast({
      title: 'تم الإضافة',
      description: 'تم إضافة العملية بنجاح وإعادة حساب الأرصدة',
      variant: 'default'
    });
  };

  // Delete transaction
  const deleteTransaction = (shareholderId: string, txnId: string) => {
    const history = shareHistory[shareholderId] || [];
    const txn = history.find(t => t.id === txnId);

    if (!txn) return;

    // Prevent deletion of creation transaction (first transaction with fromAmount = 0)
    if (txn.note?.includes('إنشاء مساهم جديد') || txn.fromAmount === 0) {
      toast({
        title: '🚫 غير مسموح',
        description: 'لا يمكن حذف العملية الأولى (إنشاء المساهم). هذه العملية أساسية ولا يمكن إزالتها.',
        variant: 'destructive',
      });
      return;
    }

    // Check if linked to profit report
    if (txn.reportId && txn.source === 'auto') {
      const relatedReport = profitReports.find(r => r._id === txn.reportId);
      const reportTitle = relatedReport?.title || 'غير معروف';

      toast({
        title: 'تحذير',
        description: `هذه العملية مرتبطة بتقرير "${reportTitle}". هل تريد حذفها؟`,
        action: (
          <ToastAction
            altText="تأكيد الحذف"
            onClick={() => performDelete(shareholderId, txnId)}
          >
            تأكيد الحذف
          </ToastAction>
        ),
      });
    } else {
      performDelete(shareholderId, txnId);
    }
  };

  const performDelete = async (shareholderId: string, txnId: string) => {
    const history = shareHistory[shareholderId] || [];
    const txn = history.find(t => t.id === txnId);
    const updatedHistory = history.filter(t => t.id !== txnId);

    // If this transaction is linked to a profit report, update the report
    if (txn?.reportId && txn.source === 'auto') {
      try {
        // Find the base reportId (remove any suffixes)
        const baseReportId = txn.reportId.split('_')[0];
        const relatedReport = profitReports.find(r => r._id === baseReportId);

        if (relatedReport) {
          // Get current affectedShareholders and remove this shareholder
          const currentAffected = relatedReport.affectedShareholders || [];
          const updatedAffected = currentAffected.filter(id => id !== shareholderId);

          // Update the report
          const response = await apiPutJson(`/api/profit-reports/${baseReportId}`, {
            affectedShareholders: updatedAffected
          });

          if (response.ok) {

            // Refresh reports to show updated data
            const reportsResp = await apiGet<ProfitReport>('/api/profit-reports');
            if (reportsResp.ok) {
              setProfitReports((reportsResp.items || []) as ProfitReport[]);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error updating profit report:', error);
        toast({
          title: 'تحذير',
          description: 'تم حذف العملية ولكن فشل تحديث تقرير الأرباح',
          variant: 'destructive'
        });
      }
    }

    // Recalculate all subsequent transactions
    recalculateHistory(shareholderId, updatedHistory);

    toast({
      title: 'تم الحذف',
      description: 'تم حذف العملية وإعادة حساب الأرصدة',
      variant: 'default'
    });
  };


  // Save shareholders to MongoDB when they change (with debounce)
  useEffect(() => {
    if (loading) return; // Don't save during initial load

    // Skip save if both shareholders and history are empty (prevents overwriting on initial load)
    if (shareholders.length === 0 && Object.keys(shareHistory).length === 0) {
      console.debug('⏭️ [Shareholders] Skipping save: no data yet (initial state)');
      return;
    }

    // Saving shareholders to MongoDB

    const timer = setTimeout(async () => {
      try {
        const resp = await apiPutJson('/api/profit-settings', {
          shareholders: shareholders,
          shareHistory: shareHistory,
        });
        // Saved successfully

        if (resp.ok) {
          // Save completed
        }
      } catch (e) {
        console.error('💥 Error saving shareholders:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [shareholders, shareHistory, loading]);

  // Ensure new shareholders have proper metadata
  const ensureShareholderMetadata = (shareholder: Shareholder): Shareholder => {
    const now = Date.now();
    return {
      ...shareholder,
      createdAt: shareholder.createdAt || now,
      initialAmount: shareholder.initialAmount ?? shareholder.amount
    };
  };

  // Selection to show history chunk
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedHistory: ShareTxn[] = useMemo(() => selectedId ? (shareHistory[selectedId] || []) : [], [selectedId, shareHistory]);
  // Filters for history
  const [filterFrom, setFilterFrom] = useState<string>(''); // yyyy-mm-dd
  const [filterTo, setFilterTo] = useState<string>('');
  type FilterType = 'all' | 'auto' | 'manual';
  const [filterType, setFilterType] = useState<FilterType>('all');
  const filteredHistory: ShareTxn[] = useMemo(() => {
    const fromMs = filterFrom ? new Date(filterFrom + 'T00:00:00').getTime() : -Infinity;
    const toMs = filterTo ? new Date(filterTo + 'T23:59:59').getTime() : Infinity;
    return selectedHistory.filter(h => {
      const t = new Date(h.date).getTime();
      if (t < fromMs || t > toMs) return false;
      if (filterType !== 'all' && (h.source || 'manual') !== filterType) return false;
      return true;
    });
  }, [selectedHistory, filterFrom, filterTo, filterType]);
  // Per-pound impact preview from most recent entry with usable values
  const perPound = useMemo(() => {
    const last = [...selectedHistory].reverse().find(h => Number(h.finalBalance) > 0);
    if (!last) return 0;
    const np = Number(last.netProfit || 0);
    const fb = Number(last.finalBalance || 0);
    return fb > 0 ? (np / fb) : 0;
  }, [selectedHistory]);

  // Pagination for main shareholders table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(shareholders.length / itemsPerPage));
  useEffect(() => {
    // keep current page in range if list size changes
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [shareholders.length, totalPages, currentPage]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageShareholders = useMemo(() => shareholders.slice(startIndex, endIndex), [shareholders, startIndex, endIndex]);

  // Add/Edit form (chunk, not modal)
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');

  function resetForm() { setEditId(null); setName(''); setAmount(''); setPercent(''); }
  const [showModal, setShowModal] = useState(false);

  function startEdit(sh: Shareholder) {
    setEditId(sh.id); setName(sh.name); setAmount(formatNumber(sh.amount)); setPercent(formatNumber(sh.percentage)); setShowModal(true);
  }

  function saveShareholder() {
    const nm = name.trim();
    const amt = sanitizeNumericValue(amount);
    const pct = sanitizeNumericValue(percent);
    if (!nm) return;
    if (pct < 0 || pct > 100) return;
    if (editId) {
      setShareholders(prev => prev.map(s => s.id === editId ? { ...s, name: nm, amount: amt, percentage: pct } : s));
    } else {
      const id = crypto.randomUUID();
      const newShareholder = ensureShareholderMetadata({
        id,
        name: nm,
        amount: amt,
        percentage: pct
      });
      setShareholders(prev => [...prev, newShareholder]);
      // Add history entry explaining the creation
      const rec: ShareTxn = {
        id: crypto.randomUUID(),
        date: new Date(newShareholder.createdAt!).toISOString(),
        delta: amt,
        fromAmount: 0,
        toAmount: amt,
        netProfit: 0,
        finalBalance: 0,
        source: 'manual',
        note: `إنشاء مساهم جديد برصيد ابتدائي ${formatNumber(amt)} ونسبة ${pct}%`
      };
      setShareHistory(h => ({ ...h, [id]: [...(h[id] || []), rec] }));
    }
    resetForm(); setShowModal(false);
  }

  function deleteShareholder(id: string) {
    setShareholders(prev => prev.filter(s => s.id !== id));
    setShareHistory(h => { const c = { ...h }; delete c[id]; return c; });
    if (selectedId === id) setSelectedId(null);
  }

  // Inline manual delta per row ("تعديل يدوي للرصد")
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  const [scheduledDeletes, setScheduledDeletes] = useState<Map<string, number>>(new Map());
  // hold backups per id to support multiple scheduled deletes concurrently
  const backupsRef = useRef<Map<string, { shareholders: Shareholder[]; history: Record<string, ShareTxn[]> }>>(new Map());
  const scheduledDeletesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => { scheduledDeletesRef.current = scheduledDeletes; }, [scheduledDeletes]);

  // Small green progress bar component (client-side animation)
  const DeleteCountdownBar = ({ durationMs = 6000 }: { durationMs?: number }) => {
    const barRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const el = barRef.current; if (!el) return;
      requestAnimationFrame(() => { el.style.width = '0%'; });
    }, []);
    return (
      <div className="mt-2 h-1 w-full bg-emerald-100 rounded">
        <div ref={barRef} className="h-1 bg-emerald-500 rounded" style={{ width: '100%', transition: `width ${durationMs}ms linear` }} />
      </div>
    );
  };
  function applyManualDelta(sh: Shareholder, sign: 1 | -1) {
    const raw = deltas[sh.id] || '';
    const deltaAbs = sanitizeNumericValue(raw);
    if (!deltaAbs) return;
    const delta = sign * deltaAbs;
    const from = Number(sh.amount);
    const to = from + delta;
    const rec: ShareTxn = {
      id: Math.random().toString(36).slice(2),
      date: new Date().toISOString(),
      delta,
      fromAmount: from,
      toAmount: to,
      netProfit: 0,
      finalBalance: 0,
      source: 'manual',
      note: `${sign > 0 ? 'زيادة' : 'نقصان'} يدوية بقيمة ${formatNumber(deltaAbs)} (من ${formatNumber(from)} إلى ${formatNumber(to)})`
    };
    setShareHistory(h => ({ ...h, [sh.id]: [...(h[sh.id] || []), rec] }));
    setShareholders(prev => prev.map(s => s.id === sh.id ? { ...s, amount: to } : s));
    setDeltas(m => ({ ...m, [sh.id]: '' }));
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-slate-600">جاري تحميل بيانات المساهمين من MongoDB...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 -m-6 p-6">
        {/* Modern Header with Stats - Mobile Responsive */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col gap-4 mb-4 md:mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-center md:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-gradient-to-r from-red-600 to-red-400 bg-clip-text">
                  إدارة المساهمين
                </h1>
                <p className="text-slate-600 text-sm md:text-lg">إدارة شاملة للمساهمين وتتبع أرصدتهم ومعاملاتهم</p>
              </div>
              <div className="flex justify-center md:justify-end">
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/profit')}
                  className="border-slate-200 bg-white text-slate-700 font-semibold flex items-center gap-2 shadow-sm hover:bg-slate-50"
                >
                  <span>العودة لصفحة الأرباح</span>
                  <ArrowLeft className="w-4 h-4 text-primary" />
                </Button>
              </div>
            </div>
            <Button
              onClick={() => { resetForm(); setShowModal(true); }}
              size="lg"
              className="w-full md:w-auto bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-xl hover:shadow-2xl transition-all duration-300 text-base md:text-lg px-6 md:px-8 py-6 md:py-4"
            >
              <Plus className="w-5 h-5 ml-2" />إضافة مساهم جديد
            </Button>
          </div>

          {/* Stats Cards - Theme-Based Design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-1">إجمالي المساهمين</p>
                  <p className="text-3xl font-bold text-foreground">{shareholders.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-1">إجمالي الأرصدة</p>
                  <p className="text-3xl font-bold text-foreground">{formatNumber(shareholders.reduce((sum, s) => sum + s.amount, 0))}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-1">إجمالي العمليات</p>
                  <p className="text-3xl font-bold text-foreground">{Object.values(shareHistory).reduce((sum, h) => sum + h.length, 0)}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <History className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-1">المساهم المحدد</p>
                  <p className="text-xl font-bold text-foreground truncate">{selectedId ? shareholders.find(s => s.id === selectedId)?.name || '-' : 'لا يوجد'}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <ArrowRight className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Shareholders List */}
          <Card className="bg-white/80 backdrop-blur-sm shadow-2xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b border-primary/20 pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  قائمة المساهمين
                </CardTitle>
                <Badge className="bg-primary/20 text-primary border-0 px-4 py-1 text-sm">
                  {shareholders.length} مساهم
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile View - Cards */}
              <div className="block lg:hidden">
                {pageShareholders.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`p-4 border-b border-slate-200 cursor-pointer transition-all ${selectedId === s.id
                      ? 'bg-gradient-to-r from-primary/10 to-secondary/10'
                      : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${selectedId === s.id ? 'bg-gradient-to-br from-primary to-secondary' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                        }`}>
                        {s.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-lg truncate">{s.name}</div>
                        <div className="text-xs text-slate-500">معرف: {s.id.slice(0, 8)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">رصيد ابتدائي</div>
                        <div className="font-mono font-bold text-slate-700">{formatNumber(s.initialAmount ?? s.amount)}</div>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-3">
                        <div className="text-xs text-primary mb-1">رصيد حالي</div>
                        <div className="font-mono font-bold text-primary text-lg">{formatNumber(s.amount)}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative w-12 h-12">
                          <svg className="transform -rotate-90 w-12 h-12">
                            <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              stroke="url(#gradient-mobile)"
                              strokeWidth="3"
                              fill="none"
                              strokeDasharray={`${(s.percentage / 100) * 126} 126`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{formatNumber(s.percentage)}%</span>
                          </div>
                        </div>
                        <span className="text-sm text-slate-600">النسبة</span>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEdit(s); }}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-600" onClick={(e) => { e.stopPropagation(); setShowDeleteId(s.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted text-right border-b border-border">
                      <th className="p-4 font-semibold text-slate-700">الاسم</th>
                      <th className="p-4 text-center font-semibold text-slate-700">الرصيد الابتدائي</th>
                      <th className="p-4 text-center font-semibold text-slate-700">الرصيد الحالي</th>
                      <th className="p-4 text-center font-semibold text-slate-700">
                        <div className="inline-flex items-center gap-1">
                          النسبة %
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center align-middle cursor-help hover:text-primary transition-colors"
                                tabIndex={0}
                                title="تعني نسبة توزيع أرباح هذا المساهم من صافي الربح (تُستخدم مع ربح الجنيه لحساب الزيادة التلقائية)."
                              >
                                <Info className="w-4 h-4 text-slate-500" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-xs text-sm">تعني نسبة توزيع أرباح هذا المساهم من صافي الربح (تُستخدم مع ربح الجنيه لحساب الزيادة التلقائية).</div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </th>
                      <th className="p-4 text-center font-semibold text-slate-700">تاريخ الإنشاء</th>
                      <th className="p-4 text-center font-semibold text-slate-700">تعديل يدوي للرصد</th>
                      <th className="p-4 text-center font-semibold text-slate-700">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageShareholders.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={`border-b border-slate-200/50 hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 cursor-pointer group ${selectedId === s.id
                          ? 'bg-gradient-to-r from-primary/10 to-secondary/10 shadow-inner'
                          : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${selectedId === s.id ? 'bg-gradient-to-br from-primary to-secondary' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                              }`}>
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 group-hover:text-primary transition-colors">{s.name}</div>
                              <div className="text-xs text-slate-500">معرف: {s.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-slate-600 font-mono">{formatNumber(s.initialAmount ?? s.amount)}</div>
                          <div className="text-xs text-slate-400">رصيد ابتدائي</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-emerald-700 text-lg font-mono">{formatNumber(s.amount)}</div>
                          <div className="text-xs text-emerald-600">رصيد حالي</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <div className="relative w-16 h-16">
                              <svg className="transform -rotate-90 w-16 h-16">
                                <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="url(#gradient)"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={`${(s.percentage / 100) * 176} 176`}
                                  strokeLinecap="round"
                                />
                                <defs>
                                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" className="text-primary" stopColor="currentColor" />
                                    <stop offset="100%" className="text-secondary" stopColor="currentColor" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-bold text-primary">{formatNumber(s.percentage)}%</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-600 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleString('ar-EG') : '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              placeholder="0"
                              value={deltas[s.id] || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') { setDeltas(m => ({ ...m, [s.id]: '' })); return; }
                                setDeltas(m => ({ ...m, [s.id]: formatInputWithCommas(v) }));
                              }}
                              className="bg-white text-center max-w-[140px] border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                            />
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => applyManualDelta(s, +1)}>زيادة</Button>
                            <Button size="sm" variant="outline" className="border-rose-300 hover:bg-rose-50" onClick={() => applyManualDelta(s, -1)}>نقصان</Button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" className="border-primary/30 hover:bg-primary/5" onClick={() => startEdit(s)}><Edit className="w-4 h-4 ml-1" />تعديل</Button>
                            <Button size="sm" variant="destructive" onClick={() => setShowDeleteId(s.id)}><Trash2 className="w-4 h-4 ml-1" />حذف</Button>
                            <Button size="sm" className="bg-slate-600 hover:bg-slate-700" onClick={() => setSelectedId(s.id)}><History className="w-4 h-4 ml-1" />السجل</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
                <div className="text-sm text-slate-600">الصفحة {currentPage} من {totalPages}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>السابق</Button>
                  <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>التالي</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History Section - Only show when shareholder is selected */}
        {selectedId && (
          <Card className="bg-white/80 backdrop-blur-sm shadow-2xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary via-secondary to-primary text-white pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <History className="w-6 h-6" />
                    </div>
                    سجل التغييرات والمعاملات
                  </CardTitle>
                  <p className="text-white/90 text-sm sm:text-base">
                    المساهم: <span className="font-bold">{shareholders.find(x => x.id === selectedId)?.name || ''}</span>
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => {
                    setAddTxnShareholderId(selectedId);
                    setShowAddTransaction(true);
                  }}
                  className="w-full sm:w-auto bg-white text-purple-600 hover:bg-white/90 shadow-lg font-bold"
                >
                  <Plus className="w-5 h-5 ml-2" />
                  إضافة عملية جديدة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto p-4 md:p-6">
              <>
                {/* Collapsible Sections - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {/* Quick Guide - Collapsible */}
                  <div className={`rounded-xl overflow-hidden shadow-lg transition-all ${expandedSection === 'guide' ? 'md:col-span-2' : ''}`}>
                    <div
                      onClick={() => setExpandedSection(expandedSection === 'guide' ? null : 'guide')}
                      className="bg-gradient-to-r from-primary to-secondary p-4 text-white cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="w-5 h-5" />
                          <span className="font-bold text-lg">دليل سريع</span>
                        </div>
                        <div className={`transform transition-transform ${expandedSection === 'guide' ? 'rotate-180' : ''}`}>
                          ▼
                        </div>
                      </div>
                    </div>
                    {expandedSection === 'guide' && (
                      <div className="bg-white p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="bg-primary/10 backdrop-blur-sm rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">🤖</span>
                              <span className="font-bold text-primary">تلقائي</span>
                            </div>
                            <p className="text-xs text-slate-600">من تقارير الأرباح</p>
                          </div>
                          <div className="bg-secondary/10 backdrop-blur-sm rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">✋</span>
                              <span className="font-bold text-secondary">يدوي</span>
                            </div>
                            <p className="text-xs text-slate-600">تعديل يدوي للرصيد</p>
                          </div>
                          <div className="bg-primary/10 backdrop-blur-sm rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">⋮⋮</span>
                              <span className="font-bold text-primary">إعادة ترتيب</span>
                            </div>
                            <p className="text-xs text-slate-600">اسحب لتغيير الترتيب</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-xs text-slate-700 flex items-center gap-2">
                            <span className="text-base">⚠️</span>
                            <span>التغييرات تؤثر على التقارير وتُعيد حساب الأرصدة تلقائيًا</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filters - Collapsible */}
                  <div className={`rounded-xl overflow-hidden shadow-lg transition-all ${expandedSection === 'filter' ? 'md:col-span-2' : ''}`}>
                    <div
                      onClick={() => setExpandedSection(expandedSection === 'filter' ? null : 'filter')}
                      className="bg-gradient-to-r from-primary to-secondary p-4 text-white cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Filter className="w-5 h-5" />
                          <span className="font-bold text-lg">تصفية السجلات</span>
                        </div>
                        <div className={`transform transition-transform ${expandedSection === 'filter' ? 'rotate-180' : ''}`}>
                          ▼
                        </div>
                      </div>
                    </div>
                    {expandedSection === 'filter' && (
                      <div className="bg-white p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="flex flex-col">
                            <Label className="text-xs mb-1.5 text-slate-600 font-semibold">📅 من تاريخ</Label>
                            <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="bg-white border-slate-300 shadow-sm" />
                          </div>
                          <div className="flex flex-col">
                            <Label className="text-xs mb-1.5 text-slate-600 font-semibold">📅 إلى تاريخ</Label>
                            <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="bg-white border-slate-300 shadow-sm" />
                          </div>
                          <div className="flex flex-col">
                            <Label className="text-xs mb-1.5 text-slate-600 font-semibold">🔍 نوع العملية</Label>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)} className="border border-slate-300 rounded-md px-3 py-2 bg-white text-sm h-10 shadow-sm">
                              <option value="all">📋 الكل</option>
                              <option value="auto">🤖 تلقائي</option>
                              <option value="manual">✋ يدوي</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="outline"
                              onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterType('all'); }}
                              className="w-full border-slate-300 hover:bg-slate-100 shadow-sm"
                            >
                              <ArrowRight className="w-4 h-4 ml-1" />
                              إعادة تعيين
                            </Button>
                          </div>
                        </div>
                        {filteredHistory.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">النتائج:</span>
                              <Badge className="bg-primary">{filteredHistory.length} عملية</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-pound preview */}
                <div className="p-4 rounded-2xl border bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300 shadow-sm mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <div className="text-emerald-700 font-bold">معاينة ربح الجنيه</div>
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-800">{perPound.toFixed(4)}</div>
                  <div className="text-xs text-slate-600 mt-1">(من أحدث سجل بصافي ربح ومخازن نهائي)</div>
                </div>

                {/* Mobile View - Transaction Cards */}
                <div className="block lg:hidden space-y-3">
                  {filteredHistory.slice().reverse().map((h, idx) => (
                    <div key={h.id} className="bg-white rounded-xl border-2 border-slate-200 shadow-md overflow-hidden">
                      {/* Card Header */}
                      <div className={`p-3 flex items-center justify-between ${h.source === 'auto' ? 'bg-emerald-50' : 'bg-blue-50'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{h.source === 'auto' ? '🤖' : '✋'}</span>
                          <span className="text-xs font-bold text-slate-700">
                            {new Date(h.date).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        <Badge className={h.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}>
                          {h.delta >= 0 ? '+' : ''}{formatNumber(h.delta)}
                        </Badge>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-xs text-slate-500">قبل</div>
                            <div className="font-mono font-bold text-slate-700">{formatNumber(h.fromAmount)}</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2">
                            <div className="text-xs text-emerald-600">بعد</div>
                            <div className="font-mono font-bold text-emerald-700">{formatNumber(h.toAmount)}</div>
                          </div>
                        </div>

                        {h.note && (
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-xs font-semibold text-blue-700 mb-1">💬 ملاحظة</div>
                            <p className="text-xs text-slate-700">{h.note}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {h.reportId && h.source === 'auto' && (() => {
                            const relatedReport = profitReports.find(report => report._id === h.reportId);
                            return relatedReport ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => navigate(`/admin/profit?view=${relatedReport._id}`)}
                              >
                                <Calendar className="w-3 h-3 ml-1" />
                                عرض التقرير
                              </Button>
                            ) : null;
                          })()}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteTransaction(selectedId!, h.id)}
                            className="border-rose-300 text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View - Table */}
                <div className="hidden lg:block rounded-xl border-2 border-slate-200 overflow-hidden shadow-md">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-primary to-secondary text-white text-right">
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 text-center font-bold">قبل</th>
                        <th className="p-3 text-center font-bold">التغيير</th>
                        <th className="p-3 text-center font-bold">بعد</th>
                        <th className="p-3 text-center font-bold">ربح الجنيه</th>
                        <th className="p-3 text-center font-bold">صافي الربح</th>
                        <th className="p-3 text-center font-bold">نوع العملية</th>
                        <th className="p-3 text-center font-bold">تقرير الأرباح المرتبط</th>
                        <th className="p-3 text-right font-bold">ملاحظة</th>
                        <th className="p-3 text-center font-bold">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.slice().reverse().map((h, idx) => (
                        <TransactionRow
                          key={h.id}
                          txn={h}
                          idx={idx}
                          selectedId={selectedId!}
                          profitReports={profitReports}
                          navigate={navigate}
                          deleteTransaction={deleteTransaction}
                          shareholders={shareholders}
                          globalCashBreakdown={globalCashBreakdown}
                          onShowDetails={setDetailsTxn}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Shareholder Modal - Mobile Responsive */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg bg-white w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editId ? 'تعديل مساهم' : 'إضافة مساهم جديد'}</DialogTitle>
            <DialogDescription className="text-sm">أدخل بيانات المساهم ثم اضغط حفظ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المساهم" className="bg-white" />
            </div>
            <div>
              <Label>الرصيد</Label>
              <Input
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') { setAmount(''); return; }
                  setAmount(formatInputWithCommas(v));
                }}
                placeholder="0"
                className="bg-white text-center"
              />
            </div>
            <div>
              <Label>النسبة %</Label>
              <Input
                value={percent}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') { setPercent(''); return; }
                  setPercent(formatInputWithCommas(v));
                }}
                placeholder="0"
                className="bg-white text-center"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowModal(false); }}>إلغاء</Button>
            <Button onClick={saveShareholder}><Save className="w-4 h-4 ml-1" />حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!showDeleteId} onOpenChange={(o) => { if (!o) setShowDeleteId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>سيتم حذف المساهم وسجلّه بالكامل. هل أنت متأكد؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => {
              const id = showDeleteId; if (!id) return; setShowDeleteId(null);
              // optimistic remove with undo window
              backupsRef.current.set(id, { shareholders, history: shareHistory });
              setShareholders(prev => prev.filter(s => s.id !== id));
              setShareHistory(h => { const c = { ...h }; delete c[id]; return c; });
              if (selectedId === id) setSelectedId(null);
              const t = window.setTimeout(() => {
                // finalize: clear scheduled marker and backups
                setScheduledDeletes(map => { const m = new Map(map); m.delete(id); return m; });
                backupsRef.current.delete(id);
              }, 6000);
              setScheduledDeletes(map => new Map(map).set(id, t));
              toast({
                title: 'تم جدولة الحذف',
                description: (
                  <div>
                    سيتم حذف المساهم نهائيًا خلال 6 ثوانٍ — يمكنك التراجع الآن
                    <DeleteCountdownBar />
                  </div>
                ),
                action: (
                  <ToastAction altText="تراجع" onClick={() => {
                    const timer = scheduledDeletesRef.current.get(id);
                    if (timer) {
                      window.clearTimeout(timer);
                      setScheduledDeletes(map => { const m = new Map(map); m.delete(id); return m; });
                      const backup = backupsRef.current.get(id);
                      if (backup) {
                        setShareholders(backup.shareholders);
                        setShareHistory(backup.history);
                        backupsRef.current.delete(id);
                      }
                      toast({ title: 'تم التراجع عن الحذف' });
                    }
                  }}>تراجع</ToastAction>
                ),
              });
            }}><Trash2 className="w-4 h-4 ml-1" />حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog - Mobile Responsive */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Plus className="w-5 h-5 text-emerald-600" />
              إضافة عملية يدوية
            </DialogTitle>
            <DialogDescription className="text-sm">
              أضف تغيير يدوي على رصيد المساهم {addTxnShareholderId && shareholders.find(s => s.id === addTxnShareholderId)?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="txnDelta">قيمة التغيير (موجب للزيادة، سالب للنقصان)</Label>
              <Input
                id="txnDelta"
                type="text"
                value={txnDelta}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || v === '-') {
                    setTxnDelta(v);
                    return;
                  }
                  if (validateNumericInput(v.replace('-', ''))) {
                    setTxnDelta(formatInputWithCommas(v));
                  }
                }}
                placeholder="مثال: 5000 أو -3000"
                className="text-center"
              />
              <p className="text-xs text-slate-500 mt-1">
                الرصيد الحالي: {addTxnShareholderId && formatNumber(shareholders.find(s => s.id === addTxnShareholderId)?.amount || 0)}
              </p>
            </div>

            <div>
              <Label htmlFor="txnDate">التاريخ</Label>
              <Input
                id="txnDate"
                type="datetime-local"
                value={txnDate.toISOString().slice(0, 16)}
                onChange={(e) => setTxnDate(new Date(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="txnNote">ملاحظة (اختياري)</Label>
              <textarea
                id="txnNote"
                value={txnNote}
                onChange={(e) => setTxnNote(e.target.value)}
                placeholder="أضف ملاحظة توضيحية للعملية..."
                className="w-full min-h-[80px] p-2 border rounded-md resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddTransaction(false);
              setTxnDelta('');
              setTxnNote('');
              setTxnDate(new Date());
            }}>
              إلغاء
            </Button>
            <Button
              onClick={addManualTransaction}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!txnDelta || sanitizeNumericValue(txnDelta) === 0}
            >
              <Save className="w-4 h-4 ml-1" />
              حفظ العملية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Modal - Beautiful Design */}
      <Dialog open={!!detailsTxn} onOpenChange={(open) => !open && setDetailsTxn(null)}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              تفاصيل العملية
            </DialogTitle>
            <DialogDescription className="text-sm">
              {detailsTxn && new Date(detailsTxn.date).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}
            </DialogDescription>
          </DialogHeader>

          {detailsTxn && (() => {
            // Get related report
            const relatedReport = profitReports.find(r =>
              r._id === detailsTxn.reportId || detailsTxn.reportId?.startsWith(r._id + '_')
            );
            const shareholder = shareholders.find(s => s.id === selectedId);
            
            // Calculate الفرق from related report
            let currentDifference = detailsTxn.netProfit;
            let currentFinalBalance = detailsTxn.finalBalance;
            
            const lastMonthClosing = relatedReport?.cashBreakdown?.lastMonthClosing;
            if (lastMonthClosing !== undefined && relatedReport?.totals?.finalBalance !== undefined) {
              currentFinalBalance = relatedReport.totals.finalBalance;
              currentDifference = calculateCompareLastMonth(currentFinalBalance, lastMonthClosing);
            } else if (relatedReport?.totals?.compareLastMonth !== undefined) {
              currentDifference = relatedReport.totals.compareLastMonth;
              currentFinalBalance = relatedReport.totals.finalBalance || detailsTxn.finalBalance;
            }
            
            const baseProfitPerPound = calculateProfitPerPound(Number(currentDifference || 0), Number(currentFinalBalance || 0));
            const percentage = shareholder?.percentage || 100;
            const profitPerPoundWithPercentage = baseProfitPerPound * percentage / 100;
            const calculatedDelta = Number(detailsTxn.fromAmount) * profitPerPoundWithPercentage;
            const newBalance = Number(detailsTxn.fromAmount) + calculatedDelta;
            
            return (
              <div className="space-y-4 pt-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">النوع</div>
                    <Badge className={detailsTxn.source === 'auto' ? 'bg-primary' : 'bg-secondary'}>
                      {detailsTxn.source === 'auto' ? '🤖 تلقائي' : '✋ يدوي'}
                    </Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">التقرير المرتبط</div>
                    {relatedReport ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-auto py-1 text-xs"
                        onClick={() => {
                          navigate(`/admin/profit?view=${relatedReport._id}`);
                          setDetailsTxn(null);
                        }}
                      >
                        <Calendar className="w-3 h-3 ml-1" />
                        {new Date(relatedReport.endDate).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                
                {/* Balance Change Summary */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
                  <div className="text-sm font-bold text-foreground mb-2">تغيير الرصيد</div>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">قبل</div>
                      <div className="text-lg font-bold text-foreground">{formatNumber(detailsTxn.fromAmount)}</div>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold ${calculatedDelta >= 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      {calculatedDelta >= 0 ? '+' : ''}{formatNumber(calculatedDelta.toFixed(3))}
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">بعد</div>
                      <div className="text-lg font-bold text-foreground">{formatNumber(newBalance.toFixed(3))}</div>
                    </div>
                  </div>
                </div>
                
                {/* Calculation Breakdown - Only for auto transactions */}
                {detailsTxn.source === 'auto' && (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-foreground">تفاصيل الحساب</div>
                    
                    {/* Step 1: Profit per pound */}
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                      <div className="text-xs font-bold text-primary mb-2">١. حساب ربح الجنيه</div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
                        <span className="bg-white px-2 py-1 rounded border">{formatNumber(currentDifference)}</span>
                        <span className="text-primary font-bold">÷</span>
                        <span className="bg-white px-2 py-1 rounded border">{formatNumber(currentFinalBalance)}</span>
                        <span className="text-primary font-bold">×</span>
                        <span className="bg-primary/10 px-2 py-1 rounded border border-primary/30">{percentage}%</span>
                        <span className="text-primary font-bold">=</span>
                        <span className="bg-primary/10 px-2 py-1 rounded border border-primary/30 font-bold">{profitPerPoundWithPercentage.toFixed(6)}</span>
                      </div>
                    </div>
                    
                    {/* Step 2: Share calculation */}
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                      <div className="text-xs font-bold text-primary mb-2">٢. نصيب {shareholder?.name || 'المساهم'}</div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
                        <span className="bg-white px-2 py-1 rounded border">{formatNumber(detailsTxn.fromAmount)}</span>
                        <span className="text-primary font-bold">×</span>
                        <span className="bg-white px-2 py-1 rounded border">{profitPerPoundWithPercentage.toFixed(6)}</span>
                        <span className="text-primary font-bold">=</span>
                        <span className="bg-primary/10 px-2 py-1 rounded border border-primary/30 font-bold">
                          {calculatedDelta >= 0 ? '+' : ''}{formatNumber(calculatedDelta.toFixed(3))}
                        </span>
                      </div>
                    </div>
                    
                    {/* Step 3: Final balance */}
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                      <div className="text-xs font-bold text-primary mb-2">٣. الرصيد النهائي</div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
                        <span className="bg-white px-2 py-1 rounded border">{formatNumber(detailsTxn.fromAmount)}</span>
                        <span className="text-primary font-bold">{calculatedDelta >= 0 ? '+' : '-'}</span>
                        <span className="bg-white px-2 py-1 rounded border">{formatNumber(Math.abs(calculatedDelta).toFixed(3))}</span>
                        <span className="text-primary font-bold">=</span>
                        <span className="bg-primary px-2 py-1 rounded border text-primary-foreground font-bold">{formatNumber(newBalance.toFixed(3))}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Note */}
                {detailsTxn.note && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">💬 ملاحظة</div>
                    <p className="text-sm">{detailsTxn.note}</p>
                  </div>
                )}
              </div>
            );
          })()}
          
          <DialogFooter className="pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setDetailsTxn(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
