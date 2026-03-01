import React, { useState, useEffect, useMemo, useRef, Fragment, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { ComprehensiveEditModal } from '@/components/admin/ComprehensiveEditModal';
import { Button } from '@/components/ui/button';
import { calculateFinalBalance, calculateNetProfit, calculateProfitPerPound, calculateShareholderDelta, calculateCompareLastMonth } from '@/lib/profitCalculations';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ToastAction } from '@/components/ui/toast';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import ModernStatCard from '@/components/admin/ModernStatCard';
import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';
import {
  Calculator,
  FileText,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Calendar as CalendarIcon,
  Download,
  Printer,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  CheckIcon,
  Clock3,
  Users,
  Wallet,
  Edit3
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


// Utility to best-effort fix mojibake Arabic text if any remain
const fixText = (s: string) => {
  try {
    // Convert from mis-decoded latin-1 to UTF-8
    // Note: unescape is deprecated but sufficient here for runtime fix
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
};

// Types
type Branch = string;
type Expense = string;
type ExpenseType = 'personal' | 'other';

type ExpenseItem = {
  name: string;
  type: ExpenseType;
};

type BranchRow = {
  name: Branch;
  values: Record<Expense, number>;
};

type CustomCashRow = {
  id: string;
  name: string;
  description?: string;
  amount: number;
};

type CashBreakdown = {
  outletExpenses: number;
  home: number;
  bank: number;
  drawer: number;
  vodafone: number;
  customRows?: CustomCashRow[];
};
type ProfitTotals = {
  totalStores: number;
  totalExpenses: number;
  totalProfits: number;
  finalBalance: number;
  netProfit: number;
  compareLastMonth: number;
  lastMonthClosing: number;
  cashManual?: number;
  cashBreakdown?: CashBreakdown;
  sumByExpense?: Record<string, number>;
  personalExpensesTotal?: number;
};

type SavedBranchRow = { name: string; values: Record<string, number> };
type ProfitReportDoc = {
  _id: string;
  title?: string;
  description?: string;
  reportName?: string;
  startDate: string | Date;
  endDate: string | Date;
  branches: string[];
  expenses: string[];
  branchRows: SavedBranchRow[];
  affectedShareholders?: string[]; // Array of shareholder IDs
  totals?: ProfitTotals;
  createdAt?: string;
};

type ProfitAggregateResponse = {
  ok: true;
  branches?: string[];
  expenses?: string[];
  map?: Record<string, Record<string, number>>;
};

// Initial data
const defaultBranches: Branch[] = ['الزهراء', 'التكية', 'القيسارية'];
const defaultExpenses: Expense[] = [
  'مخازن',
  'مصروفات وليد',
  'مصروفات المحل',
  'سداد مساهمين',
  'سداد القرض',
  'مصروفات العجوز والحجازي',
  'كاش الدرج',
  'ديون ليه',
  'ديون عليه',
  'زكاة المال',
  'أرباح',
];

// Helper function to format numbers with parentheses for negatives
function formatNumberWithParens(num: number): string {
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString();
  return num < 0 ? `(-${formatted})` : formatted;
}

function calcTotals(branchRows: BranchRow[], expenses: Expense[], cashManual: number, expenseTypes: Map<string, ExpenseType>, outletExpenses: number = 0) {
  const sumByExpense: Record<Expense, number> = Object.create(null) as Record<Expense, number>;
  for (const e of expenses) sumByExpense[e] = 0;
  for (const br of branchRows) {
    for (const e of expenses) {
      sumByExpense[e] += Number(br.values[e] || 0);
    }
  }
  const totalStores = sumByExpense['مخازن'] || 0;

  // Separate personal and other expenses
  const personalExpensesTotal = expenses
    .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
    .reduce((s, k) => s + (sumByExpense[k] || 0), 0);

  // Sum all expense items, excluding stores, cash, debts, profits
  const allExpenses = expenses
    .filter(e => !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
    .reduce((s, k) => s + (sumByExpense[k] || 0), 0);

  // Subtract outlet expenses (المصروفات من حساب المحل) from total expenses
  // This prevents double counting since outlet expenses are added to cash breakdown
  const totalExpenses = allExpenses - Number(outletExpenses || 0);

  const totalProfits = sumByExpense['أرباح'] || 0;
  // Final balance uses manual cash subtotal rather than per-branch 'كاش الدرج'
  // cashManual already includes outletExpenses (personalExpensesTotal), so no need to add it again
  const stores = sumByExpense['مخازن'] || 0;
  const cash = Number(cashManual || 0);
  const debtsToUs = sumByExpense['ديون ليه'] || 0;
  const debtsOnUs = sumByExpense['ديون عليه'] || 0;

  // ✅ Using centralized formula from profitCalculations.ts
  const finalBalance = calculateFinalBalance(stores, cash, debtsToUs, debtsOnUs);
  const netProfit = calculateNetProfit(totalProfits, totalExpenses);
  return { sumByExpense, totalStores, totalExpenses, totalProfits, finalBalance, netProfit, personalExpensesTotal };
}

export default function AdminProfit() {
  // Set page title
  usePageTitle('إدارة الأرباح');

  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, isTablet } = useDeviceDetection();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [exportAction, setExportAction] = useState<null | 'print' | 'pdf' | 'image'>(null);
  const [previewLayout, setPreviewLayout] = useState<'summary' | 'a4'>('summary');
  // Global (template) lists used when starting new reports
  const [globalBranches, setGlobalBranches] = useState<Branch[]>(defaultBranches);
  const [globalExpenses, setGlobalExpenses] = useState<Expense[]>(defaultExpenses);
  // Report-specific lists (private to the current report)
  const [branches, setBranches] = useState<Branch[]>(() => globalBranches);
  const [expenses, setExpenses] = useState<Expense[]>(() => globalExpenses);
  const [branchRows, setBranchRows] = useState<BranchRow[]>(() => branches.map(b => ({ name: b, values: Object.fromEntries(expenses.map(e => [e, 0])) })));
  // Fixed expenses that should not be editable or counted as custom items
  // Allow editing 'أرباح' (profit) explicitly in step 6 as requested
  const fixedExpenses = useMemo(() => new Set<Expense>(['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه'] as Expense[]), []);
  const editableExpenses = useMemo(() => expenses.filter(e => !fixedExpenses.has(e)), [expenses, fixedExpenses]);
  const editableExpensesCount = editableExpenses.length;

  // Dashboard counts using global state
  const globalEditableExpensesCount = useMemo(() =>
    globalExpenses.filter(e => !fixedExpenses.has(e)).length,
    [globalExpenses, fixedExpenses]
  );
  const [range, setRange] = useState<DateRange | undefined>();
  const [lastMonthClosing, setLastMonthClosing] = useState<number>(0);
  const [manualLastMonthValue, setManualLastMonthValue] = useState<boolean>(false);
  const [baseClosingValue, setBaseClosingValue] = useState<number>(6000000); // Editable base value for report source
  const [showBaseEditor, setShowBaseEditor] = useState<boolean>(false);
  const [shareholdersOverride, setShareholdersOverride] = useState<number | null>(null); // Override calculated shareholders total
  const [showShareholdersEditor, setShowShareholdersEditor] = useState<boolean>(false);
  const [showShareholdersBreakdown, setShowShareholdersBreakdown] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<ProfitReportDoc[]>([]);
  const [profitSettingsLoaded, setProfitSettingsLoaded] = useState(false);
  // Undo / delete scheduling for reports
  const [scheduledReportDeletes, setScheduledReportDeletes] = useState<Map<string, number>>(new Map());
  const [backupReports, setBackupReports] = useState<ProfitReportDoc[] | null>(null);
  // Hold backups per id to ensure reliable undo even with multiple deletes
  const reportBackupsRef = useRef<Map<string, ProfitReportDoc[]>>(new Map());
  const scheduledReportDeletesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => { scheduledReportDeletesRef.current = scheduledReportDeletes; }, [scheduledReportDeletes]);
  const [showDeleteReportId, setShowDeleteReportId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [showBranchManage, setShowBranchManage] = useState(false);
  // Scope for management modals: global template or this report only
  const [manageExpensesScope, setManageExpensesScope] = useState<'global' | 'report'>('global');
  const [manageBranchesScope, setManageBranchesScope] = useState<'global' | 'report'>('global');
  // Expense edit modal state
  const [showExpenseEdit, setShowExpenseEdit] = useState(false);
  const resultsAtRef = useRef<number | null>(null);
  const distributionAppliedRef = useRef<boolean>(false);
  const [expenseEditIndex, setExpenseEditIndex] = useState<number | null>(null);
  const [expenseEditValue, setExpenseEditValue] = useState('');
  // Expense values modal (edit values per-branch for a specific expense)
  const [showExpenseValues, setShowExpenseValues] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseType, setNewExpenseType] = useState<ExpenseType>('other');

  // Small green progress bar component for undo toast
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
  const [detailView, setDetailView] = useState<null | 'final' | 'net' | 'compare' | 'summary' | 'calculation'>(null);
  const [expenseValuesIndex, setExpenseValuesIndex] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [prevRange, setPrevRange] = useState<DateRange | undefined>();
  const [editMode, setEditMode] = useState(true);
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
  const [expenseTypes, setExpenseTypes] = useState<Map<string, ExpenseType>>(new Map());
  // Auto-update outletExpenses with personal expenses total (ALWAYS auto-calculated)
  useEffect(() => {
    const personalExpensesTotal = expenses
      .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
      .reduce((sum, expenseName) => {
        const expenseTotal = branchRows.reduce((branchSum, branch) => branchSum + Number(branch.values[expenseName] || 0), 0);
        return sum + expenseTotal;
      }, 0);

    // Always auto-update with sum of personal expenses
    setCashBreakdown(prev => {
      if (prev.outletExpenses !== personalExpensesTotal) {
        return { ...prev, outletExpenses: personalExpensesTotal };
      }
      return prev;
    });
  }, [branchRows, expenses, expenseTypes]);

  // Auto-update drawer (كاش الدرج) from الدرج والديون step (ALWAYS auto-calculated)
  useEffect(() => {
    const drawerTotal = branchRows.reduce((sum, branch) => sum + Number(branch.values['كاش الدرج'] || 0), 0);

    setCashBreakdown(prev => {
      if (prev.drawer !== drawerTotal) {
        return { ...prev, drawer: drawerTotal };
      }
      return prev;
    });
  }, [branchRows]);

  const cashManual = useMemo(() => {
    // Filter out vodafone-named custom rows from total calculation
    const customRowsTotal = (cashBreakdown.customRows || [])
      .filter(row => {
        const name = (row.name || '').toLowerCase().trim();
        return !name.includes('vodafone') && !name.includes('فودافون');
      })
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return Number(cashBreakdown.outletExpenses || 0) + Number(cashBreakdown.home || 0) + Number(cashBreakdown.bank || 0) + Number(cashBreakdown.drawer || 0) + Number(cashBreakdown.vodafone || 0) + customRowsTotal;
  }, [cashBreakdown]);
  const [showPreview, setShowPreview] = useState(false);
  const [showSimplePreview, setShowSimplePreview] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [prefillLock, setPrefillLock] = useState(false); // when true, skip aggregate prefill
  const [currentReportId, setCurrentReportId] = useState<string | undefined>(undefined);

  // Shareholders management
  type Shareholder = { id: string; name: string; amount: number; percentage: number; createdAt?: number; initialAmount?: number };
  type ShareTxn = { id: string; date: string; reportId?: string; delta: number; fromAmount: number; toAmount: number; netProfit: number; finalBalance: number; source?: 'auto' | 'manual'; active?: boolean; note?: string };
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [shareHistory, setShareHistory] = useState<Record<string, ShareTxn[]>>({});
  const wizardStepsConfig = useMemo(() => ([
    { value: 0, label: 'الفترة' },
    { value: 1, label: 'المخازن' },
    { value: 2, label: 'المصروفات' },
    { value: 3, label: 'الدرج/الديون' },
    { value: 4, label: 'الكاش' },
    { value: 5, label: 'الأرباح' },
    { value: 5.5, label: 'المساهمون' }
  ] as const), []);
  const currentStepIndex = useMemo(() => {
    const idx = wizardStepsConfig.findIndex(step => step.value === wizardStep);
    return idx === -1 ? 0 : idx;
  }, [wizardStepsConfig, wizardStep]);
  const totalWizardSteps = wizardStepsConfig.length;
  const wizardProgress = totalWizardSteps > 1 ? (currentStepIndex / (totalWizardSteps - 1)) * 100 : 0;


  // Track dashboard values
  useEffect(() => {
    // Dashboard values tracking for UI updates
  }, [globalBranches.length, globalEditableExpensesCount, shareholders.length, reports.length]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editShareId, setEditShareId] = useState<string | null>(null);
  const [shareName, setShareName] = useState('');
  const [shareAmount, setShareAmount] = useState<string>('0');
  const [sharePercent, setSharePercent] = useState<string>('0');
  const [showShareHistory, setShowShareHistory] = useState(false);
  const [historyForId, setHistoryForId] = useState<string | null>(null);
  // temp deltas for inline amount adjustments keyed by shareholder id
  const [shareDeltas, setShareDeltas] = useState<Record<string, string>>({});

  // Shareholder selection for profit distribution
  const [selectedShareholders, setSelectedShareholders] = useState<Set<string>>(new Set());
  const [shareholdersInitialized, setShareholdersInitialized] = useState(false);
  const [hasDraftInProgress, setHasDraftInProgress] = useState(false);
  const [draftStep, setDraftStep] = useState(0);
  const [reportName, setReportName] = useState('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Track reportName changes
  useEffect(() => {
    // reportName updated
  }, [reportName]);

  // Initialize selected shareholders when shareholders list changes (default: NONE selected for new reports)
  useEffect(() => {
    if (shareholders.length > 0 && !shareholdersInitialized && !isLoadingReport && !currentReportId) {
      // For NEW reports: start with NONE selected
      setSelectedShareholders(new Set());
      setShareholdersInitialized(true);
      // Auto-initialized shareholders
    }
  }, [shareholders, shareholdersInitialized, isLoadingReport, currentReportId]);

  // Shareholders and share history will be persisted to MongoDB via API calls

  // persist shareholders to server (fast debounce for MongoDB)
  useEffect(() => {
    if (!profitSettingsLoaded) return;

    // Skip initial save right after load to prevent overwriting with stale state
    if (shareholders.length === 0 && Object.keys(shareHistory).length === 0) {
      // Skipping save: initial render
      return;
    }

    const timer = setTimeout(async () => {
      // Always save to global settings
      const payload = {
        globalBranches: globalBranches as string[],
        globalExpenses: globalExpenses as string[],
        shareholders: shareholders,
        shareHistory: shareHistory,
        expenseTypes: Object.fromEntries(expenseTypes),
        cashBreakdown: cashBreakdown,
      };

      try {
        // Saving profit settings
        const resp = await apiPutJson('/api/profit-settings', payload);

        if (!resp.ok) {
          console.error('Failed to save profit settings:', 'error' in resp ? resp.error : 'Unknown error');
        } else {
          // Save acknowledged
        }
      } catch (e: unknown) {
        console.error('Error saving profit settings:', e);
      }
    }, 300); // Fast 300ms debounce
    return () => clearTimeout(timer);
  }, [shareholders, shareHistory, globalBranches, globalExpenses, expenseTypes, cashBreakdown, currentReportId, range, profitSettingsLoaded]);

  // Load global settings from MongoDB on mount (immediate loading)
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiGet<{ globalBranches?: string[]; globalExpenses?: string[]; shareholders?: Shareholder[]; shareHistory?: Record<string, ShareTxn[]>; expenseTypes?: Record<string, string>; cashBreakdown?: CashBreakdown }>('/api/profit-settings');

        if (!resp.ok) {
          console.error('Failed to load profit settings:', 'error' in resp ? resp.error : 'Unknown error');
          return;
        }

        const item = resp.item;

        if (item) {
          // Loaded profit settings

          // Validate and use loaded data, fallback to defaults if invalid
          const loadedBranches = Array.isArray(item.globalBranches) && item.globalBranches.length > 0
            ? item.globalBranches as Branch[]
            : defaultBranches;
          const loadedExpenses = Array.isArray(item.globalExpenses) && item.globalExpenses.length > 0
            ? item.globalExpenses as Expense[]
            : defaultExpenses;
          const loadedShareholders = Array.isArray(item.shareholders) ? item.shareholders : [];
          // Loaded shareholders

          const loadedShareHistory = item.shareHistory && typeof item.shareHistory === 'object'
            ? item.shareHistory
            : {};

          // ✅ MIGRATION: Set active=true for all existing transactions (backward compatibility)
          const migratedShareHistory: Record<string, ShareTxn[]> = {};
          let migrationCount = 0;
          Object.keys(loadedShareHistory).forEach(shareholderId => {
            const transactions = loadedShareHistory[shareholderId] || [];
            migratedShareHistory[shareholderId] = transactions.map(txn => {
              if (txn.active === undefined) {
                migrationCount++;
                return { ...txn, active: true }; // Default to active for existing transactions
              }
              return txn;
            });
          });
          if (migrationCount > 0) {

          }

          const loadedExpenseTypes = item.expenseTypes && typeof item.expenseTypes === 'object'
            ? new Map(Object.entries(item.expenseTypes))
            : new Map();
          const loadedCashBreakdown = item.cashBreakdown && typeof item.cashBreakdown === 'object'
            ? {
              outletExpenses: Number(item.cashBreakdown.outletExpenses || 0),
              home: Number(item.cashBreakdown.home || 0),
              bank: Number(item.cashBreakdown.bank || 0),
              drawer: Number(item.cashBreakdown.drawer || 0),
              vodafone: Number(item.cashBreakdown.vodafone || 0),
              customRows: Array.isArray(item.cashBreakdown.customRows) ? item.cashBreakdown.customRows : []
            }
            : { outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] };

          setGlobalBranches(loadedBranches);
          setGlobalExpenses(loadedExpenses);

          setShareholders(loadedShareholders);

          setShareHistory(migratedShareHistory); // Use migrated history

          setExpenseTypes(loadedExpenseTypes);

          setCashBreakdown(loadedCashBreakdown);

        } else {
          setGlobalBranches(defaultBranches);
          setGlobalExpenses(defaultExpenses);
          setShareholders([]);
          setShareHistory({});
          setExpenseTypes(new Map());
          setCashBreakdown({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
        }
      } catch (e: unknown) {
        console.error('Error loading profit settings:', e);
        // Fallback to defaults on error
        setGlobalBranches(defaultBranches);
        setGlobalExpenses(defaultExpenses);
        setShareholders([]);
        setShareHistory({});
        setExpenseTypes(new Map());
        setCashBreakdown({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
      } finally {
        setProfitSettingsLoaded(true);
      }
    })();
  }, []);

  // Global settings will be persisted to MongoDB via API calls only

  // Persist global settings to MongoDB when they change (fast debounce)
  useEffect(() => {
    if (!profitSettingsLoaded) return;

    const timer = setTimeout(async () => {
      const expenseTypesObj = Object.fromEntries(expenseTypes);

      // Don't save if we're about to overwrite existing data with empty types
      // This prevents race conditions during page load
      if (Object.keys(expenseTypesObj).length === 0 && globalExpenses.length > 0) {
        return;
      }

      const payload = {
        globalBranches: globalBranches as string[],
        globalExpenses: globalExpenses as string[],
        expenseTypes: expenseTypesObj,
      };

      try {
        // Saving template settings
        const resp = await apiPutJson('/api/profit-settings', payload);

        if (!resp.ok) {
          console.error('Failed to save global settings:', 'error' in resp ? resp.error : 'Unknown error');
        }
      } catch (e: unknown) {
        console.error('Error saving global settings:', e);
      }
    }, 300); // Fast 300ms debounce
    return () => clearTimeout(timer);
  }, [globalBranches, globalExpenses, expenseTypes, profitSettingsLoaded]);

  // When starting a new report, hydrate branches/expenses from global state and reset rows
  // Ensure global branches and expenses are never empty - force defaults if needed
  useEffect(() => {
    if (globalBranches.length === 0) {
      setGlobalBranches(defaultBranches);
    }
    if (globalExpenses.length === 0) {
      setGlobalExpenses(defaultExpenses);
    }
  }, [globalBranches.length, globalExpenses.length]);

  // Initialize branches and expenses from global defaults
  useEffect(() => {
    if (branches.length === 0 && globalBranches.length > 0) {
      setBranches(globalBranches);
    }
    if (expenses.length === 0 && globalExpenses.length > 0) {
      setExpenses(globalExpenses);
    }
  }, [globalBranches, globalExpenses, branches.length, expenses.length]);

  useEffect(() => {
    if (showWizard && wizardStep === 0 && !currentReportId) {
      const nextB = globalBranches;
      const nextE = globalExpenses;
      if (nextB !== branches) setBranches(nextB);
      if (nextE !== expenses) setExpenses(nextE);
      // reset branchRows to match the latest lists for a fresh create flow
      setBranchRows(nextB.map(b => ({ name: b, values: Object.fromEntries(nextE.map(e => [e, 0])) as Record<Expense, number> })));
    }
  }, [showWizard, wizardStep, currentReportId, globalBranches, globalExpenses, branches, expenses]);

  // Keep branchRows keys in sync with expenses list during create mode
  const prevExpensesRef = useRef<string[]>([]);
  useEffect(() => {
    if (!currentReportId) {
      // Only update if expenses list actually changed (not just reference)
      const expensesChanged =
        expenses.length !== prevExpensesRef.current.length ||
        expenses.some((e, i) => e !== prevExpensesRef.current[i]);

      if (expensesChanged) {
        prevExpensesRef.current = [...expenses];
        setBranchRows(prev => prev.map(row => {
          const values: Record<Expense, number> = { ...row.values } as Record<Expense, number>;
          // add missing expense keys
          expenses.forEach(e => { if (values[e] == null) values[e] = 0; });
          // remove extra keys no longer in expenses
          Object.keys(values).forEach((k) => {
            if (!expenses.includes(k as Expense)) {
              delete (values as Record<string, number>)[k];
            }
          });
          return { ...row, values };
        }));
      }
    }
  }, [expenses, currentReportId]);

  // placeholder; real computation moved below totals to satisfy lint ordering
  const perPoundProfit = 0;

  function openNewShare() {
    setEditShareId(null); setShareName(''); setShareAmount('0'); setSharePercent('0'); setShowShareModal(true);
  }
  function openEditShare(s: Shareholder) {
    setEditShareId(s.id);
    setShareName(s.name);
    setShareAmount(formatNumber(s.amount));
    setSharePercent(formatNumber(s.percentage));
    setShowShareModal(true);
  }
  function saveShare() {
    const name = shareName.trim();

    // Validate name
    if (!name) {
      toast({ title: 'الاسم مطلوب', description: 'يرجى إدخال اسم المساهم', variant: 'destructive' });
      return;
    }
    if (!validateTextInput(name)) {
      toast({ title: 'اسم غير صحيح', description: 'يرجى استخدام أحرف عربية وإنجليزية وأرقام فقط', variant: 'destructive' });
      return;
    }

    // Validate and parse amount
    const amount = sanitizeNumericValue(shareAmount);
    if (amount < 0) {
      toast({ title: 'الرصيد غير صحيح', description: 'يرجى إدخال رصيد صحيح (0 أو أكثر)', variant: 'destructive' });
      return;
    }

    // Validate and parse percentage
    const percentage = sanitizeNumericValue(sharePercent);
    if (percentage < 0 || percentage > 100) {
      toast({ title: 'النسبة غير صحيحة', description: 'أدخل نسبة بين 0 و 100', variant: 'destructive' });
      return;
    }

    // Check for duplicate names (except when editing the same shareholder)
    const duplicateName = shareholders.find(s =>
      s.name.trim().toLowerCase() === name.toLowerCase() && s.id !== editShareId
    );
    if (duplicateName) {
      toast({ title: 'اسم مكرر', description: 'يوجد مساهم بنفس الاسم بالفعل', variant: 'destructive' });
      return;
    }

    if (editShareId) {
      setShareholders(prev => prev.map(s => s.id === editShareId ? { ...s, name, amount, percentage } : s));
      toast({ title: 'تم التحديث', description: `تم تحديث بيانات ${name}` });
    } else {
      const id = crypto.randomUUID();
      const initialAmount = amount;
      setShareholders(prev => [...prev, { id, name, amount, percentage, createdAt: Date.now(), initialAmount }]);
      toast({ title: 'تم الإضافة', description: `تم إضافة المساهم ${name}` });
    }

    // Reset form
    setEditShareId(null);
    setShareName('');
    setShareAmount('0');
    setSharePercent('0');
    setShowShareModal(false);
  }
  function deleteShare(id: string) {
    setShareholders(prev => prev.filter(s => s.id !== id));
  }

  function applyManualDelta(s: Shareholder, sign: 1 | -1) {
    const raw = shareDeltas[s.id] || '0';
    const deltaAbs = sanitizeNumericValue(raw);
    if (!deltaAbs || deltaAbs <= 0) { toast({ title: 'أدخل قيمة صحيحة', variant: 'destructive' }); return; }
    const delta = sign * deltaAbs;
    const from = Number(s.amount);
    const to = from + delta;

    // ✅ Using centralized formula from profitCalculations.ts
    const stores = totals.sumByExpense?.['مخازن'] || 0;
    const cash = Number(cashManual || 0);
    const debtsToUs = totals.sumByExpense?.['ديون ليه'] || 0;
    const debtsOnUs = totals.sumByExpense?.['ديون عليه'] || 0;
    const fb = calculateFinalBalance(stores, cash, debtsToUs, debtsOnUs);
    const np = Number(totals.netProfit || 0);
    const rec: ShareTxn = {
      id: Math.random().toString(36).slice(2),
      date: new Date().toISOString(),
      delta,
      fromAmount: from,
      toAmount: to,
      netProfit: np,
      finalBalance: fb,
      source: 'manual',
      note: `${sign > 0 ? 'زيادة' : 'نقصان'} يدوية: تعديل مباشر = Δ (من ${Number(from).toLocaleString()} إلى ${Number(to).toLocaleString()}) ${Number(delta).toLocaleString()}${delta >= 0 ? '+' : ''}`
    };
    setShareHistory(h => ({ ...h, [s.id]: [...(h[s.id] || []), rec] }));
    setShareholders(prev => prev.map(x => x.id === s.id ? { ...x, amount: to } : x));
    setShareDeltas(m => ({ ...m, [s.id]: '' }));
  }


  function applyShareholderDistribution(reportId?: string, selectedIds?: Set<string>) {
    if (!showResults) return;
    const ppp = perPoundProfitComputed; // per pound profit
    if (ppp === 0) return;

    // ✅ Using centralized formula from profitCalculations.ts
    const stores = totals.sumByExpense?.['مخازن'] || 0;
    const cash = Number(cashManual || 0);
    const debtsToUs = totals.sumByExpense?.['ديون ليه'] || 0;
    const debtsOnUs = totals.sumByExpense?.['ديون عليه'] || 0;
    const fb = calculateFinalBalance(stores, cash, debtsToUs, debtsOnUs);
    // ✅ FIXED: Store compareLastMonth (الفرق) instead of netProfit (صافي الربح)
    // The shareholder calculation uses: الفرق ÷ مخازن نهائي × نسبة المساهم
    const np = Number(compareLastMonth || 0);  // This is الفرق from مقارنة بالشهر الماضي
    const resultsAt = resultsAtRef.current || Date.now();
    const idsToUse = selectedIds || selectedShareholders;

    // Clean reportId by removing any suffixes (_edit_, _profit_, etc.)
    const cleanReportId = reportId?.split('_')[0];

    // Ensure we have a valid reportId - create a temporary one for new reports
    const effectiveReportId = cleanReportId || `temp_report_${Date.now()}`;

    // Applying distribution to shareholders

    // ✅ NEW: Create transactions for ALL shareholders (not just selected)
    setShareholders(prev => {
      return prev.map(s => {
        const existingHistory = (shareHistory && shareHistory[s.id]) || [];
        const isSelected = idsToUse.has(s.id);

        // Find existing transaction for this report
        const existingTxn = existingHistory.find(txn =>
          txn.reportId === effectiveReportId ||
          txn.reportId?.startsWith(`${effectiveReportId}_`)
        );



        // Get balance before this report
        const lastNonReportTxn = existingHistory
          .filter(txn =>
            txn.reportId !== effectiveReportId &&
            !txn.reportId?.startsWith(`${effectiveReportId}_`)
          )
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const balanceBeforeReport = lastNonReportTxn ? lastNonReportTxn.toAmount : (s.initialAmount || s.amount);

        // ✅ ALWAYS create/update transaction (whether selected or not)
        // If not selected: active=false, delta=0
        if (!isSelected) {
          const inactiveTxn: ShareTxn = {
            id: existingTxn?.id || crypto.randomUUID(),
            date: new Date().toISOString(),
            reportId: effectiveReportId,
            delta: 0, // ✅ No change when inactive
            fromAmount: balanceBeforeReport,
            toAmount: balanceBeforeReport, // ✅ Balance stays same
            netProfit: np,
            finalBalance: fb,
            source: 'auto',
            active: false, // ✅ Mark as inactive
            note: `غير مشمول في هذا التقرير`
          };

          // Update or create transaction
          setShareHistory(h => {
            if (existingTxn) {
              // Update existing
              return { ...h, [s.id]: existingHistory.map(t => t.id === existingTxn.id ? inactiveTxn : t) };
            } else {
              // Create new
              return { ...h, [s.id]: [...existingHistory, inactiveTxn] };
            }
          });

          return { ...s, amount: balanceBeforeReport }; // No change to balance
        }

        // Processing selected shareholder

        // Skip if shareholder created after this report's results time
        if (s.createdAt && s.createdAt > resultsAt) {
          const rec: ShareTxn = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            reportId: effectiveReportId, // Use clean reportId
            delta: 0,
            fromAmount: Number(s.amount),
            toAmount: Number(s.amount),
            netProfit: np,
            finalBalance: fb,
            source: 'auto',
            note: `لم يحدث تغيير: المساهم أضيف بعد تاريخ التقرير (${s.createdAt ? new Date(s.createdAt).toLocaleString('ar-EG') : '—'} > ${new Date(resultsAt).toLocaleString('ar-EG')})`
          };
          // Always add new transaction (never update existing ones)
          setShareHistory(h => {
            return { ...h, [s.id]: [...(h[s.id] || []), rec] };
          });
          return s;
        }

        const pct = Number(s.percentage || 0);
        const delta = balanceBeforeReport * ppp * (pct / 100);
        const targetBalance = balanceBeforeReport + delta;

        // ✅ Create ACTIVE transaction for selected shareholder
        const activeTxn: ShareTxn = {
          id: existingTxn?.id || crypto.randomUUID(),
          date: new Date().toISOString(),
          reportId: effectiveReportId,
          delta,
          fromAmount: balanceBeforeReport,
          toAmount: targetBalance,
          netProfit: np,
          finalBalance: fb,
          source: 'auto',
          active: true, // ✅ Mark as active
          note: `توزيع أرباح: ${ppp.toFixed(4)} × ${pct}% = ${Number(delta).toLocaleString()}`
        };

        // Update or create transaction
        setShareHistory(h => {
          if (existingTxn) {
            // Update existing
            return { ...h, [s.id]: existingHistory.map(t => t.id === existingTxn.id ? activeTxn : t) };
          } else {
            // Create new
            return { ...h, [s.id]: [...existingHistory, activeTxn] };
          }
        });

        return { ...s, amount: targetBalance };
      });
    });
  }

  // Apply shareholder distribution for existing reports (when editing)
  function applyShareholderDistributionForExistingReport(
    reportId: string,
    selectedIds: Set<string>,
    reportData: { netProfit: number; finalBalance: number; profitPerPound: number }
  ) {
    const { netProfit, finalBalance, profitPerPound } = reportData;

    console.log('📊 Applying distribution:', { reportId, selectedCount: selectedIds.size, profitPerPound: profitPerPound.toFixed(6) });

    // ✅ NEW: Use active/inactive system for editing
    setShareholders(prev => {
      return prev.map(s => {
        const existingHistory = (shareHistory && shareHistory[s.id]) || [];
        const isSelected = selectedIds.has(s.id);

        // Find existing transaction for this report
        const existingTxn = existingHistory.find(txn =>
          txn.reportId === reportId ||
          txn.reportId?.startsWith(`${reportId}_`)
        );

        // Get balance before this report
        const lastNonReportTxn = existingHistory
          .filter(txn =>
            txn.reportId !== reportId &&
            !txn.reportId?.startsWith(`${reportId}_`)
          )
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const balanceBeforeReport = lastNonReportTxn ? lastNonReportTxn.toAmount : (s.initialAmount || s.amount);

        // ✅ If not selected: set active=false, delta=0
        if (!isSelected) {
          const inactiveTxn: ShareTxn = {
            id: existingTxn?.id || crypto.randomUUID(),
            date: new Date().toISOString(),
            reportId: reportId,
            delta: 0, // ✅ No change when inactive
            fromAmount: balanceBeforeReport,
            toAmount: balanceBeforeReport, // ✅ Balance stays same
            netProfit,
            finalBalance,
            source: 'auto',
            active: false, // ✅ Mark as inactive
            note: `غير مشمول في هذا التقرير`
          };

          // Update or create transaction
          setShareHistory(h => {
            if (existingTxn) {
              return { ...h, [s.id]: existingHistory.map(t => t.id === existingTxn.id ? inactiveTxn : t) };
            } else {
              return { ...h, [s.id]: [...existingHistory, inactiveTxn] };
            }
          });

          return { ...s, amount: balanceBeforeReport }; // No change to balance
        }

        // ✅ Shareholder is selected: set active=true, calculate delta
        const pct = Number(s.percentage || 0);
        const delta = calculateShareholderDelta(balanceBeforeReport, profitPerPound, pct);
        const targetBalance = balanceBeforeReport + delta;

        const activeTxn: ShareTxn = {
          id: existingTxn?.id || crypto.randomUUID(),
          date: new Date().toISOString(),
          reportId: reportId,
          delta,
          fromAmount: balanceBeforeReport,
          toAmount: targetBalance,
          netProfit,
          finalBalance,
          source: 'auto',
          active: true, // ✅ Mark as active
          note: `توزيع أرباح: ${profitPerPound.toFixed(4)} × ${pct}% = ${Number(delta).toLocaleString()}`
        };

        // Update or create transaction
        setShareHistory(h => {
          if (existingTxn) {
            return { ...h, [s.id]: existingHistory.map(t => t.id === existingTxn.id ? activeTxn : t) };
          } else {
            return { ...h, [s.id]: [...existingHistory, activeTxn] };
          }
        });

        return { ...s, amount: targetBalance };
      });
    });
  }

  const [cashExtras, setCashExtras] = useState<{ id: string; name: string; value: number }[]>([]);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [explainType, setExplainType] = useState<null | 'final' | 'net' | 'compare' | 'diff' | 'expenses-details' | 'profit' | 'final-result'>(null);
  const [showExpensesDetails, setShowExpensesDetails] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // prevent duplicate auto-saves when reaching final results
  const autoSavedRef = useRef(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [source, setSource] = useState<'manual' | 'report'>('manual');
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [quickEditReport, setQuickEditReport] = useState<ProfitReportDoc | null>(null);

  // Quick edit save handler
  const handleQuickEditSave = async (updatedReport: Partial<ProfitReportDoc>) => {
    if (!updatedReport._id) return;

    const resp = await apiPutJson(`/api/profit-reports/${updatedReport._id}`, updatedReport);
    if (resp.ok) {
      // Update local reports list
      setReports(prev => prev.map(r =>
        r._id === updatedReport._id ? { ...r, ...updatedReport } : r
      ));

      // Update quickEditReport state if it's the same report being edited
      if (quickEditReport && quickEditReport._id === updatedReport._id) {
        setQuickEditReport(prev => prev ? { ...prev, ...updatedReport } : null);
      }



      // Apply distribution for any edited report
      if (updatedReport.affectedShareholders !== undefined) {
        const newSelectedIds = new Set(updatedReport.affectedShareholders);

        // ✅ Calculate profit per pound using centralized formula from profitCalculations.ts
        const reportCompareLastMonth = updatedReport.totals?.compareLastMonth || 0;
        const reportNetProfit = updatedReport.totals?.netProfit || 0;
        const reportFinalBalance = updatedReport.totals?.finalBalance || 0;
        const calculatedProfitPerPound = calculateProfitPerPound(reportCompareLastMonth, reportFinalBalance);

        console.log('💰 Profit calculation:', {
          compareLastMonth: reportCompareLastMonth,
          finalBalance: reportFinalBalance,
          profitPerPound: calculatedProfitPerPound.toFixed(6)
        });

        if (calculatedProfitPerPound > 0 || newSelectedIds.size === 0) {
          // Apply distribution (including reversions for deselected shareholders)
          applyShareholderDistributionForExistingReport(updatedReport._id, newSelectedIds, {
            netProfit: reportNetProfit,
            finalBalance: reportFinalBalance,
            profitPerPound: calculatedProfitPerPound
          });
        }
      }

      // If editing current report, update current state too
      if (currentReportId === updatedReport._id) {
        if (updatedReport.reportName) setReportName(updatedReport.reportName);
        if (updatedReport.title) setTitle(updatedReport.title);
        if (updatedReport.description) setDescription(updatedReport.description);
        if (updatedReport.branches) setBranches(updatedReport.branches);
        if (updatedReport.expenses) setExpenses(updatedReport.expenses);
        if (updatedReport.branchRows) setBranchRows(updatedReport.branchRows);
        if (updatedReport.totals?.cashBreakdown) setCashBreakdown(updatedReport.totals.cashBreakdown);
        if (updatedReport.affectedShareholders !== undefined) {
          setSelectedShareholders(new Set(updatedReport.affectedShareholders));
        }
      }
    } else {
      throw new Error((resp as { ok: false; error: string }).error || 'فشل في الحفظ');
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6); // 6 items per page to maintain clean grid layout

  useEffect(() => {
    (async () => {
      try {
        const j = await apiGet<ProfitReportDoc>('/api/profit-reports');
        if (j.ok) setReports((j.items || []) as ProfitReportDoc[]);
      } catch (error) {
        console.warn('Failed to load profit reports:', error);
        // Continue with empty reports array - the component will work with local data
      }
    })();
  }, []);

  // Handle edit and view parameters from URL (when navigating from shareholders page)
  useEffect(() => {
    const editReportId = searchParams.get('edit');
    const viewReportId = searchParams.get('view');
    const isModal = searchParams.get('modal') === 'true';

    if (editReportId && reports.length > 0) {
      const reportToEdit = reports.find(r => r._id === editReportId);
      if (reportToEdit) {
        // Load the report for editing
        const loadReport = async () => {
          setIsLoadingReport(true);
          try {
            const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${editReportId}`);
            if (resp.ok && resp.item) {
              const doc = resp.item;
              setTitle(doc.title || '');
              setDescription(doc.description || '');
              setReportName(doc.reportName || '');

              setLastMonthClosing(Number(doc?.totals?.lastMonthClosing || 0));
              setManualLastMonthValue(false);

              // Migrate old "ديون له" to "ديون ليه"
              const migratedExpenses = (doc.expenses || []).map((e: string) => e === 'ديون له' ? 'ديون ليه' : e);
              setBranches(doc.branches || []);
              setExpenses(migratedExpenses);
              setBranchRows((doc.branchRows || []).map((br: SavedBranchRow) => ({
                name: br.name,
                values: br.values || {}
              })));
              setRange({ from: new Date(doc.startDate), to: new Date(doc.endDate) });
              setCurrentReportId(doc._id);

              const tb: ProfitTotals = (doc?.totals || {}) as ProfitTotals;
              // Handle cash breakdown with smart merge
              const reportCustomRows = tb.cashBreakdown?.customRows || [];
              const globalCustomRows = cashBreakdown.customRows || [];
              const mergedCustomRows = reportCustomRows.length > 0 ? reportCustomRows : globalCustomRows;

              const reportCashBreakdown = {
                outletExpenses: Number(tb.cashBreakdown?.outletExpenses || 0),
                home: Number(tb.cashBreakdown?.home || 0),
                bank: Number(tb.cashBreakdown?.bank || 0),
                drawer: Number(tb.cashBreakdown?.drawer || 0),
                vodafone: Number(tb.cashBreakdown?.vodafone || 0),
                customRows: mergedCustomRows
              };
              setCashBreakdown(reportCashBreakdown);

              // Restore selected shareholders from saved report
              if (doc.affectedShareholders && Array.isArray(doc.affectedShareholders)) {
                setSelectedShareholders(new Set(doc.affectedShareholders));

              } else {
                // No fallback - keep empty selection if none was saved
                setSelectedShareholders(new Set());

              }

              // Preserve report name (set again after other effects might clear it)
              setTimeout(() => {
                if (doc.reportName && doc.reportName.trim()) {
                  setReportName(doc.reportName);

                }
              }, 100);

              // Enter edit mode and open the wizard steps
              setPrefillLock(true);
              setEditMode(true);
              setShowPreview(false);
              setWizardStep(0);
              setShowWizard(true);

              toast({
                title: 'جاهز للتعديل',
                description: `تم فتح تقرير "${doc.title}" للتعديل`,
                variant: 'default'
              });

              // Clear the URL parameter
              navigate('/admin/profit', { replace: true });
            }
          } catch (e) {
            toast({
              title: 'خطأ في التحميل',
              description: (e as Error).message,
              variant: 'destructive'
            });
          } finally {
            setIsLoadingReport(false);
          }
        };

        loadReport();
      }
    } else if (viewReportId && reports.length > 0) {
      const reportToView = reports.find(r => r._id === viewReportId);
      if (reportToView) {
        // Load the report for viewing
        const loadReportForView = async () => {
          setIsLoadingReport(true);
          try {
            const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${viewReportId}`);
            if (resp.ok && resp.item) {
              const doc = resp.item;
              setTitle(doc.title || '');
              setDescription(doc.description || '');
              setReportName(doc.reportName || '');

              setLastMonthClosing(Number(doc?.totals?.lastMonthClosing || 0));
              setManualLastMonthValue(false);

              // Migrate old "ديون له" to "ديون ليه"
              const migratedExpenses = (doc.expenses || []).map((e: string) => e === 'ديون له' ? 'ديون ليه' : e);
              setBranches(doc.branches || []);
              setExpenses(migratedExpenses);
              setBranchRows((doc.branchRows || []).map((br: SavedBranchRow) => ({
                name: br.name,
                values: br.values || {}
              })));
              setRange({ from: new Date(doc.startDate), to: new Date(doc.endDate) });
              setCurrentReportId(doc._id);

              const tb: ProfitTotals = (doc?.totals || {}) as ProfitTotals;
              // Handle cash breakdown with smart merge
              const reportCustomRows = tb.cashBreakdown?.customRows || [];
              const globalCustomRows = cashBreakdown.customRows || [];
              const mergedCustomRows = reportCustomRows.length > 0 ? reportCustomRows : globalCustomRows;

              const reportCashBreakdown = {
                outletExpenses: Number(tb.cashBreakdown?.outletExpenses || 0),
                home: Number(tb.cashBreakdown?.home || 0),
                bank: Number(tb.cashBreakdown?.bank || 0),
                drawer: Number(tb.cashBreakdown?.drawer || 0),
                vodafone: Number(tb.cashBreakdown?.vodafone || 0),
                customRows: mergedCustomRows
              };
              setCashBreakdown(reportCashBreakdown);

              // Restore selected shareholders from saved report (for view mode)
              if (doc.affectedShareholders && Array.isArray(doc.affectedShareholders)) {
                setSelectedShareholders(new Set(doc.affectedShareholders));

              }

              // Preserve report name for view mode
              setTimeout(() => {
                if (doc.reportName && doc.reportName.trim()) {
                  setReportName(doc.reportName);

                }
              }, 100);

              // Enter view mode (show preview)
              setPrefillLock(true);
              setEditMode(false);
              setShowWizard(false);
              setPreviewLayout('a4');
              setShowPreview(true);

              toast({
                title: 'تم فتح التقرير',
                description: `تم فتح تقرير "${doc.title}" للعرض`,
                variant: 'default'
              });

              // Clear the URL parameter
              navigate('/admin/profit', { replace: true });
            }
          } catch (e) {
            toast({
              title: 'خطأ في التحميل',
              description: (e as Error).message,
              variant: 'destructive'
            });
          } finally {
            setIsLoadingReport(false);
          }
        };

        loadReportForView();
      }
    }
  }, [searchParams, reports, navigate, toast, cashBreakdown.customRows]);

  // When preview is open and an exportAction is set, capture and process
  useEffect(() => {
    (async () => {
      if (!showPreview || !exportAction) return;
      try {
        const node = exportRef.current;
        if (!node) return;
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        if (exportAction === 'pdf') {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF('l', 'pt', 'a4');
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
          const imgW = canvas.width * ratio; const imgH = canvas.height * ratio;
          const x = (pageW - imgW) / 2; const y = (pageH - imgH) / 2;
          pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
          pdf.save(`profit-${Date.now()}.pdf`);
        } else if (exportAction === 'image') {
          const a = document.createElement('a');
          a.href = imgData;
          a.download = `profit-${Date.now()}.png`;
          a.click();
        } else if (exportAction === 'print') {
          // Print via hidden iframe (no new tab)
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(`<html dir="rtl"><head><title>${fixText('طباعة التقرير')}</title></head><body style="margin:0"><img id="printImg" src="${imgData}" style="width:100%"/></body></html>`);
            doc.close();
            const imgEl = (doc.getElementById('printImg') as HTMLImageElement | null);
            const doPrint = () => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
              } catch (err) { console.error(err); }
              // Cleanup iframe after a short delay
              setTimeout(() => { try { document.body.removeChild(iframe); } catch (err) { console.log('Iframe cleanup error:', err); } }, 1000);
            };
            if (imgEl) {
              if (imgEl.complete) doPrint();
              else imgEl.addEventListener('load', doPrint, { once: true });
            } else {
              setTimeout(doPrint, 500);
            }
          } else {
            toast({ title: fixText('فشل الطباعة'), description: fixText('تعذر إنشاء معاينة الطباعة'), variant: 'destructive' });
          }
        }
      } catch (e) {
        toast({ title: fixText('فشل التصدير'), description: fixText('تعذر إنشاء الملف، حاول مجددا'), variant: 'destructive' });
      } finally {
        setExportAction(null);
      }
    })();
  }, [showPreview, exportAction, toast]);



  // Export to Excel (XLSX)
  const exportToExcel = async () => {
    try {
      const xlsx = await import('xlsx');
      // Sheet 1: Table (Branches x Expenses)
      const header = ['الفرع \\\u0020بند', ...expenses];
      const rows = branches.map(b => {
        const vals = branchRows.find(r => r.name === b)?.values as Record<string, number> | undefined;
        return [b, ...expenses.map(e => Number(vals?.[e] || 0))];
      });
      const totalsRow = ['الإجمالي', ...expenses.map(e => Number(totals.sumByExpense?.[e] || 0))];
      const aoa = [header, ...rows, totalsRow];
      const ws1 = xlsx.utils.aoa_to_sheet(aoa);

      // Sheet 2: Summary
      const summary = [
        ['اسم التقرير', reportName || '—'],
        ['العنوان', title || '—'],
        ['الفترة', range?.from ? new Date(range.from).toLocaleDateString('ar-EG') : '—', range?.to ? new Date(range.to).toLocaleDateString('ar-EG') : '—'],
        ['مخازن نهائي (الشهر الحالي)', Number(correctFinalBalance)],
        ['صافي الربح', Number(totals.netProfit || 0)],
        ['فرق المخازن', Number(compareLastMonth || 0)],
        ['صافي الربح - فرق المخازن', Math.abs(Number(totals.netProfit || 0) - Number(compareLastMonth || 0))],
        [],
        ['الكاش - المحل', Number(cashBreakdown.outletExpenses || 0)],
        ['الكاش - بيت', Number(cashBreakdown.home || 0)],
        ['الكاش - بنك', Number(cashBreakdown.bank || 0)],
        ['الكاش - درج', Number(totals.sumByExpense?.['كاش الدرج'] || 0)],
      ];
      const ws2 = xlsx.utils.aoa_to_sheet(summary);

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws1, 'جدول');
      xlsx.utils.book_append_sheet(wb, ws2, 'ملخص');
      xlsx.writeFile(wb, `profit-${Date.now()}.xlsx`);
      toast({ title: fixText('تم التنزيل'), description: fixText('تم تنزيل ملف Excel'), variant: 'default' });
    } catch (e: unknown) {
      toast({ title: fixText('فشل التصدير'), description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Prefill from aggregate endpoint when date range changes
  const lastFetchedRangeRef = useRef<string>('');
  useEffect(() => {
    const from = range?.from ? new Date(range.from) : null;
    const to = range?.to ? new Date(range.to) : null;
    if (!from || !to) return;
    if (prefillLock) return; // do not override loaded snapshot values

    // Create a unique key for this date range to prevent duplicate fetches
    const rangeKey = `${from.toISOString()}_${to.toISOString()}`;
    if (lastFetchedRangeRef.current === rangeKey) return; // Already fetched this range

    lastFetchedRangeRef.current = rangeKey;
    const url = `/api/profit-aggregate?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    apiGet(url)
      .then(j => {
        if (!j?.ok) return;
        const response = j as ProfitAggregateResponse;
        const aggBranches: Branch[] = (response.branches || []) as Branch[];
        const aggExpenses: Expense[] = (response.expenses || []) as Expense[];
        const map: Record<string, Record<string, number>> = response.map || {};
        // Merge with existing lists to preserve manually added
        const mergedBranches = Array.from(new Set([...branches, ...aggBranches]));
        const mergedExpenses = Array.from(new Set([...expenses, ...aggExpenses]));
        setBranches(mergedBranches);
        setExpenses(mergedExpenses);
        setBranchRows(mergedBranches.map(b => {
          const entries = mergedExpenses.map((e) => [e, Number(map?.[b]?.[e] || 0)] as const);
          const vals = Object.fromEntries(entries) as Record<Expense, number>;
          return { name: b, values: vals };
        }));
      })
      .catch(() => { });
  }, [range?.from, range?.to, prefillLock, branches, expenses]);

  // Keep rows in sync when adding branches/expenses
  const prevBranchesRef = useRef<string[]>([]);
  const prevExpensesForSyncRef = useRef<string[]>([]);
  useEffect(() => {
    // Only sync if branches or expenses actually changed (not just reference)
    const branchesChanged =
      branches.length !== prevBranchesRef.current.length ||
      branches.some((b, i) => b !== prevBranchesRef.current[i]);
    const expensesChanged =
      expenses.length !== prevExpensesForSyncRef.current.length ||
      expenses.some((e, i) => e !== prevExpensesForSyncRef.current[i]);

    if (branchesChanged || expensesChanged) {
      prevBranchesRef.current = [...branches];
      prevExpensesForSyncRef.current = [...expenses];

      setBranchRows(prev => {
        // ensure each branch has a row
        const map = new Map(prev.map(r => [r.name, r] as const));
        const out: BranchRow[] = branches.map(b => {
          const base = map.get(b) || { name: b, values: {} as Record<Expense, number> };
          const filtered: Record<Expense, number> = Object.create(null) as Record<Expense, number>;
          for (const e of expenses) {
            const current = (base.values as Record<string, number>)[e];
            filtered[e] = Number(current ?? 0);
          }
          return { name: b, values: filtered };
        });
        return out;
      });
    }
  }, [branches, expenses]);

  const totals = useMemo(() => calcTotals(branchRows, expenses, cashManual, expenseTypes, cashBreakdown.outletExpenses), [branchRows, expenses, cashManual, expenseTypes, cashBreakdown.outletExpenses]);

  // Correct final balance calculation (مخازن نهائي) - reusable across the component
  const correctFinalBalance = useMemo(() => {
    return (totals.sumByExpense?.['مخازن'] || 0) + Number(cashManual || 0) + (totals.sumByExpense?.['ديون ليه'] || 0) - (totals.sumByExpense?.['ديون عليه'] || 0);
  }, [totals.sumByExpense, cashManual]);

  // ✅ Using centralized formulas from profitCalculations.ts
  const compareLastMonth = useMemo(() => {
    return calculateCompareLastMonth(correctFinalBalance, Number(lastMonthClosing || 0));
  }, [correctFinalBalance, lastMonthClosing]);

  const perPoundProfitComputed = useMemo(() => {
    return calculateProfitPerPound(Number(compareLastMonth || 0), correctFinalBalance);
  }, [correctFinalBalance, compareLastMonth]);

  // Pagination calculations
  const totalPages = Math.ceil(reports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReports = reports.slice(startIndex, endIndex);

  // Reset to first page when reports change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [reports.length, totalPages, currentPage]);

  // Reset results panel when navigating steps
  useEffect(() => {
    if (wizardStep !== 5) {
      setShowResults(false);
      autoSavedRef.current = false;
    }
  }, [wizardStep]);

  // Auto-apply shareholder profit distribution when final results are shown
  useEffect(() => {
    if (showResults) {
      // Lock the moment when results are shown for createdAt comparisons
      if (!resultsAtRef.current) resultsAtRef.current = Date.now();
      if (!distributionAppliedRef.current) {
        applyShareholderDistribution(currentReportId, selectedShareholders);
        distributionAppliedRef.current = true;
      }
    } else {
      // Reset guard for next results session; keep timestamp if needed for history
      distributionAppliedRef.current = false;
    }
  }, [showResults, currentReportId]);

  // Re-apply distribution when shareholder selection changes while results are shown
  useEffect(() => {
    if (showResults && distributionAppliedRef.current) {
      // Re-apply distribution with new selection
      applyShareholderDistribution(currentReportId, selectedShareholders);

    }
  }, [selectedShareholders, showResults, currentReportId]);

  // Refresh reports helper
  const refreshReports = async () => {
    try {
      const j = await apiGet<ProfitReportDoc>('/api/profit-reports');
      if (j.ok) setReports((j.items || []) as ProfitReportDoc[]);
    } catch (error) {
      console.warn('Failed to refresh profit reports:', error);
    }
  };

  // Auto-populate drawer field in step 4 with total from كاش الدرج in step 3
  const totalCashDrawer = useMemo(() => {
    return branches.reduce((sum, b) => sum + Number(branchRows.find(r => r.name === b)?.values['كاش الدرج'] || 0), 0);
  }, [branches, branchRows]);

  useEffect(() => {
    // Auto-update drawer value when كاش الدرج total changes
    setCashBreakdown(prev => ({
      ...prev,
      drawer: totalCashDrawer
    }));
  }, [totalCashDrawer]);

  const addBranch = () => {
    const name = prompt('اسم الفرع الجديد:');
    if (!name) return;
    const trimmedName = name.trim();
    if (!trimmedName || !validateTextInput(trimmedName)) {
      toast({ title: fixText('خطأ'), description: fixText('اسم الفرع غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
      return;
    }
    if (branches.includes(trimmedName)) {
      toast({ title: fixText('تنبيه'), description: fixText('هذا الفرع موجود بالفعل.') });
      return;
    }
    setBranches([...branches, trimmedName]);
  };

  const addExpense = () => {
    setShowAddExpenseDialog(true);
  };

  const handleAddExpense = () => {
    const trimmedName = newExpenseName.trim();
    if (!trimmedName || !validateTextInput(trimmedName)) {
      toast({ title: fixText('خطأ'), description: fixText('اسم المصروف غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
      return;
    }
    if (expenses.includes(trimmedName)) {
      toast({ title: fixText('تنبيه'), description: fixText('هذا المصروف موجود بالفعل.') });
      return;
    }

    setExpenses([...expenses, trimmedName]);
    setExpenseTypes(prev => {
      const newMap = new Map(prev).set(trimmedName, newExpenseType);
      return newMap;
    });
    toast({ title: fixText('تم'), description: fixText(`تم إضافة المصروف "${trimmedName}" كنوع ${newExpenseType === 'personal' ? 'شخصي' : 'عادي'}.`) });

    // Reset form
    setNewExpenseName('');
    setNewExpenseType('other');
    setShowAddExpenseDialog(false);
  };

  const addCustomCashRow = () => {
    const description = prompt('وصف البند:');
    if (!description) return;
    const trimmedDescription = description.trim();
    if (!trimmedDescription || !validateTextInput(trimmedDescription)) {
      toast({ title: fixText('خطأ'), description: fixText('وصف البند غير صحيح.'), variant: 'destructive' });
      return;
    }

    const newRow: CustomCashRow = {
      id: crypto.randomUUID(),
      name: trimmedDescription,
      description: trimmedDescription,
      amount: 0
    };

    setCashBreakdown(prev => {
      const updated = {
        ...prev,
        customRows: [...(prev.customRows || []), newRow]
      };
      toast({
        title: 'تم إضافة البند',
        description: `تم إضافة "${trimmedDescription}" - سيتم الحفظ خلال ثوانٍ`
      });
      return updated;
    });
  };

  const updateCustomCashRow = (id: string, amount: number) => {
    setCashBreakdown(prev => {
      const updated = {
        ...prev,
        customRows: (prev.customRows || []).map(row =>
          row.id === id ? { ...row, amount } : row
        )
      };
      return updated;
    });
  };

  const removeCustomCashRow = (id: string) => {
    setCashBreakdown(prev => ({
      ...prev,
      customRows: (prev.customRows || []).filter(row => row.id !== id)
    }));
  };

  const formatNumber = (value: number | string, allowZero: boolean = false): string => {
    if (value === '' || value === null || value === undefined) return '';
    if (!allowZero && (value === 0 || value === '0')) return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US');
  };

  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/,/g, '');
    if (cleaned === '-' || cleaned === '') return 0;
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Input validation functions
  const validateNumericInput = (value: string): boolean => {
    // Allow empty string, numbers, commas, and decimal points
    const numericRegex = /^[0-9,]*\.?[0-9]*$/;
    return numericRegex.test(value);
  };

  const validateNumericInputWithNegative = (value: string): boolean => {
    // Allow empty string, negative sign, numbers, commas, and decimal points
    const numericRegex = /^-?[0-9,]*\.?[0-9]*$/;
    const isValid = numericRegex.test(value);

    return isValid;
  };

  const validateTextInput = (value: string): boolean => {
    // Prevent extremely long strings and invalid characters
    if (value.length > 100) return false;
    // Allow Arabic, English, numbers, spaces, and common punctuation
    const textRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDCF\uFDF0-\uFDFF\uFE70-\uFEFF\u0020-\u007E\s]*$/;
    return textRegex.test(value);
  };

  const sanitizeNumericValue = (value: string): number => {
    const parsed = parseNumber(value);
    // Prevent extremely large numbers that could cause issues
    const maxValue = 999999999999; // 12 digits max
    return Math.min(Math.max(0, parsed), maxValue);
  };

  const updateValue = (b: Branch, e: Expense, val: number) => {
    setBranchRows(prev => prev.map(r => r.name === b ? { ...r, values: { ...r.values, [e]: val } } : r));
  };

  // Pagination functions
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // Export all reports to JSON
  const exportAllReports = () => {
    try {
      const exportData = {
        reports,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `profit-reports-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'تم التصدير',
        description: `تم تصدير ${reports.length} تقرير بنجاح`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'خطأ في التصدير',
        description: 'فشل في تصدير التقارير',
        variant: 'destructive'
      });
    }
  };

  // Import reports from JSON
  const handleImportReports = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        if (!importData.reports || !Array.isArray(importData.reports)) {
          throw new Error('Invalid file format');
        }

        // Import each report
        let successCount = 0;
        for (const reportData of importData.reports) {
          try {
            const resp = await apiPostJson('/api/profit-reports', reportData);
            if (resp.ok) {
              successCount++;
            }
          } catch (error) {
            console.warn('Failed to import report:', reportData.title, error);
          }
        }

        // Refresh reports list
        await refreshReports();

        toast({
          title: 'تم الاستيراد',
          description: `تم استيراد ${successCount} من ${importData.reports.length} تقرير`,
          variant: 'default'
        });
      } catch (error) {
        toast({
          title: 'خطأ في الاستيراد',
          description: 'فشل في قراءة الملف. تأكد من صحة تنسيق الملف',
          variant: 'destructive'
        });
      }
    };

    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const saveSnapshot = useCallback(async () => {
    if (!range?.from || !range?.to) {
      return toast({ title: fixText('حدد الفترة'), description: fixText('اختر تاريخ البداية والنهاية'), variant: 'destructive' });
    }

    // Validate report name
    const trimmedReportName = reportName.trim();
    if (!trimmedReportName) {
      return toast({ title: fixText('اسم التقرير مطلوب'), description: fixText('يرجى إدخال اسم للتقرير'), variant: 'destructive' });
    }
    if (!validateTextInput(trimmedReportName)) {
      return toast({ title: fixText('خطأ'), description: fixText('اسم التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
    }

    // Validate title and description
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle && !validateTextInput(trimmedTitle)) {
      return toast({ title: fixText('خطأ'), description: fixText('عنوان التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
    }

    if (trimmedDescription && !validateTextInput(trimmedDescription)) {
      return toast({ title: fixText('خطأ'), description: fixText('وصف التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
    }

    setSaving(true);

    // Debug logging for shareholder selection

    console.log('💾 Converted to array:', Array.from(selectedShareholders));

    const payload = {
      title: trimmedTitle || trimmedReportName, // Use report name as title if no title provided
      description: trimmedDescription,
      reportName: trimmedReportName, // Add report name field
      startDate: range.from,
      endDate: range.to,
      branches,
      expenses,
      branchRows: branchRows.map(r => ({ name: r.name, values: r.values })),
      affectedShareholders: Array.from(selectedShareholders), // Store selected shareholders
      totals: {
        totalStores: totals.totalStores,
        totalExpenses: totals.totalExpenses,
        totalProfits: totals.totalProfits,
        finalBalance: correctFinalBalance,
        netProfit: totals.netProfit,
        compareLastMonth,
        lastMonthClosing,
        cashManual,
        cashBreakdown,
        sumByExpense: totals.sumByExpense,
      },
    };
    try {
      const url = currentReportId ? `/api/profit-reports/${currentReportId}` : '/api/profit-reports';
      const resp = currentReportId
        ? await apiPutJson<ProfitReportDoc, typeof payload>(url, payload)
        : await apiPostJson<ProfitReportDoc, typeof payload>(url, payload);
      if (resp.ok) {
        toast({ title: fixText('تم الحفظ'), description: fixText('تم حفظ الملف بنجاح.'), variant: 'default' });
        const item = (resp as { ok: true; item: ProfitReportDoc }).item;
        if (currentReportId) setReports(prev => prev.map(x => x._id === currentReportId ? item : x));
        else { setReports(prev => [item, ...prev]); setCurrentReportId(item?._id); }
        // Keep edit mode enabled after save for further edits
      } else {
        const err = (resp as { ok: false; error: string }).error || fixText('تعذر الحفظ');
        toast({ title: fixText('خطأ'), description: err, variant: 'destructive' });
      }
    } finally { setSaving(false); }
  }, [range?.from, range?.to, title, description, reportName, toast, branches, expenses, branchRows, totals, correctFinalBalance, compareLastMonth, lastMonthClosing, cashManual, cashBreakdown, currentReportId, selectedShareholders]);

  // Auto-save when reaching final results (step 6)
  useEffect(() => {
    if (!showWizard) { autoSavedRef.current = false; return; }
    if (wizardStep === 5 && showResults && !autoSavedRef.current && !saving) {
      setHasDraftInProgress(false); // Clear draft when reaching final results
      (async () => {
        try {
          await saveSnapshot();
          autoSavedRef.current = true;
          toast({ title: fixText('تم الحفظ تلقائيًا'), description: fixText('تم حفظ تقرير الأرباح عند الوصول إلى النتيجة النهائية.'), variant: 'default' });
        } catch (e) {
          // already handled
        }
      })();
    }
  }, [showWizard, wizardStep, showResults, saving, saveSnapshot, toast]);

  return (
    <AdminLayout>
      <div className="space-y-8 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 min-h-screen p-6 -m-6">
        {/* Modern Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {fixText('حساب الأرباح')}
            </h1>
            <p className="text-lg text-slate-600 font-medium">{fixText('نظام متطور لحساب وتتبع الأرباح والخسائر')}</p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Activity className="w-4 h-4 text-green-500" />
                <span>{fixText('النظام يعمل بكفاءة')}</span>
              </div>
            </div>

            {/* Wizard Helper Card: connect guidance text to the actual wizard */}

            <Badge variant="secondary" className="bg-primary/10 text-primary">{fixText('تجريبي')}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const resetPayload = {
                    globalBranches: defaultBranches,
                    globalExpenses: defaultExpenses,
                    shareholders: [],
                    shareHistory: {},
                    expenseTypes: {},
                    cashBreakdown: { outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] }
                  };
                  const resp = await apiPutJson('/api/profit-settings', resetPayload);

                  if (resp.ok) {
                    // Update local state immediately
                    setGlobalBranches(defaultBranches);
                    setGlobalExpenses(defaultExpenses);
                    setShareholders([]);
                    setShareHistory({});
                    setExpenseTypes(new Map());
                    setCashBreakdown({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
                    toast({ title: 'تم', description: 'تم إعادة تعيين البيانات إلى القيم الافتراضية' });
                  }
                } catch (e) {
                  console.error('Reset error:', e);
                  toast({ title: 'خطأ', description: 'فشل في إعادة التعيين', variant: 'destructive' });
                }
              }}
            >
              🔄 إعادة تعيين
            </Button>
            {hasDraftInProgress && (
              <Button
                onClick={() => {
                  setWizardStep(draftStep);
                  setShowWizard(true);
                  setHasDraftInProgress(false);
                }}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                استكمال المسودة (الخطوة {draftStep + 1})
              </Button>
            )}
            <Button
              onClick={() => {
                // Start a brand-new report
                setCurrentReportId(undefined);
                setTitle('');
                setDescription('');
                setReportName('');
                setRange(undefined);
                setLastMonthClosing(0); setManualLastMonthValue(false);
                setCashBreakdown({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
                setShowResults(false);
                setEditMode(true);
                setPrefillLock(false);
                autoSavedRef.current = false;
                setWizardStep(0);
                setShareholdersInitialized(false); // Reset to allow re-initialization
                setHasDraftInProgress(false); // Clear draft
                setShowWizard(true);
                // Hydrate report lists from globals
                setBranches(globalBranches);
                setExpenses(globalExpenses);
                setBranchRows(globalBranches.map(b => ({ name: b, values: Object.fromEntries(globalExpenses.map(e => [e, 0])) as Record<Expense, number> })));
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
            >
              <Calculator className="w-4 h-4 mr-2" />
              {fixText('بدء تقرير أرباح')}
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Dashboard */}
        <div className="space-y-8">
          {/* Modern Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <ModernStatCard
              title="عدد الفروع"
              value={globalBranches.length}
              subtitle="الفروع المسجلة في النظام"
              icon={<BarChart3 className="w-7 h-7" />}
              iconColor="text-primary"
              backgroundColor="bg-primary/5"
              gradient="from-primary/5 via-secondary/5 to-primary/10"
              buttonText="إدارة الفروع"
              onButtonClick={() => { setManageBranchesScope('global'); setShowBranchManage(true); }}
            />

            <ModernStatCard
              title="بنود المصروفات"
              value={globalEditableExpensesCount}
              subtitle="أنواع المصروفات المختلفة"
              icon={<PieChart className="w-7 h-7" />}
              iconColor="text-primary"
              backgroundColor="bg-primary/5"
              gradient="from-purple-50 via-violet-50 to-fuchsia-50"
              buttonText="إدارة المصروفات"
              onButtonClick={() => { setManageExpensesScope('global'); setShowManage(true); }}
            />
            <ModernStatCard
              title="إدارة المساهمين"
              value={shareholders.length}
              subtitle="عدد المساهمين"
              icon={<Users className="w-7 h-7" />}
              iconColor="text-emerald-600"
              backgroundColor="bg-emerald-50"
              gradient="from-emerald-50 via-green-50 to-teal-50"
              buttonText="فتح الإدارة"
              onButtonClick={() => navigate('/admin/shareholders')}
            />

            <ModernStatCard
              title="تحليلات الأرباح"
              value={reports.length}
              subtitle="رسوم بيانية وتقارير تفصيلية"
              icon={<TrendingUp className="w-7 h-7" />}
              iconColor="text-emerald-600"
              backgroundColor="bg-emerald-50"
              gradient="from-emerald-50 via-green-50 to-teal-50"
              buttonText="فتح صفحة التحليلات"
              onButtonClick={() => navigate('/admin/profit-analytics')}
            />
          </div>
        </div>


        {/* Enhanced Saved Reports Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">التقارير المحفوظة</h2>
              <Badge variant="secondary" className="bg-green-100 text-green-800">{reports.length} تقرير</Badge>
            </div>

            {/* Export/Import Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAllReports()}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-1" />
                تصدير الكل
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('import-file')?.click()}
                className="border-green-300 text-green-600 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                استيراد
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportReports}
              />
            </div>

            {/* Pagination Info */}
            {reports.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>عرض {startIndex + 1}-{Math.min(endIndex, reports.length)} من {reports.length}</span>
                <div className="w-1 h-1 bg-slate-400 rounded-full" />
                <span>صفحة {currentPage} من {totalPages}</span>
              </div>
            )}
          </div>

          {reports.length === 0 ? (
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">لا توجد تقارير محفوظة</h3>
                <p className="text-slate-500 text-center max-w-md">ابدأ بإنشاء تقرير أرباح جديد لرؤية تقاريرك هنا</p>
                <Button
                  onClick={() => {
                    setCurrentReportId(undefined);
                    setTitle('');
                    setDescription('');
                    setRange(undefined);
                    setLastMonthClosing(0); setManualLastMonthValue(false);
                    setCashBreakdown({ outletExpenses: 0, home: 0, bank: 0, drawer: 0, vodafone: 0, customRows: [] });
                    setShowResults(false);
                    setEditMode(true);
                    setPrefillLock(false);
                    autoSavedRef.current = false;
                    setWizardStep(0);
                    setShowWizard(true);
                  }}
                  className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  بدء تقرير أرباح
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentReports.map((r) => (
                  <Card key={r._id} className="group bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-green-600 transition-colors">
                            {r.reportName || r.title || 'ملخص محفوظ'}
                          </CardTitle>
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{r.description}</p>
                        </div>
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        <span>{new Date(r.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Date Range and Final Balance */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                          <div className="text-xs text-blue-600 font-semibold mb-1">الشهر الماضي</div>
                          <div className="text-sm font-bold text-blue-800">{Number(r.totals?.lastMonthClosing || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                          <div className="text-xs text-emerald-600 font-semibold">مخازن نهائي</div>
                          <div className="text-sm font-bold text-emerald-800">{Number(r.totals?.finalBalance || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Net Profit and Storage Difference */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg p-3 border border-primary/20">
                          <div className="text-xs text-primary font-semibold">صافي الربح</div>
                          <div className="text-sm font-bold text-primary">{Number(r.totals?.netProfit || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-r from-secondary/5 to-secondary/10 rounded-lg p-3 border border-secondary/20">
                          <div className="text-xs text-secondary font-semibold">فرق المخازن</div>
                          <div className="text-sm font-bold text-secondary">{Number((r.totals?.finalBalance || 0) - (r.totals?.lastMonthClosing || 0)).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Calculation Result */}
                      <div className="rounded-lg p-3 border bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                        <div className="text-xs font-semibold text-primary">صافي الربح - فرق المخازن</div>
                        <div className="text-sm font-bold text-primary">{Math.abs(Number(r.totals?.netProfit || 0) - ((r.totals?.finalBalance || 0) - (r.totals?.lastMonthClosing || 0))).toLocaleString()}</div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2 items-center">
                        {/* Open: show final results wizard view */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              toast({ title: 'جارٍ الفتح', description: 'يتم تحميل المعاينة المبسطة...', variant: 'default' });
                              // Unsaved changes guard
                              if (currentReportId && editMode) {
                                const confirmed = confirm('لديك تعديلات غير محفوظة على التقرير الحالي. هل تريد المتابعة وفقدان التعديلات؟');
                                if (!confirmed) return;
                              }
                              const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${r._id}`);
                              const doc = resp.ok ? (resp as { ok: true; item: ProfitReportDoc }).item : r;
                              setTitle(doc.title || ''); setDescription(doc.description || '');
                              setLastMonthClosing(Number(doc?.totals?.lastMonthClosing || 0)); setManualLastMonthValue(false);
                              // Migrate old "ديون له" to "ديون ليه"
                              const migratedExpenses = (doc.expenses || []).map((e: string) => e === 'ديون له' ? 'ديون ليه' : e);
                              setBranches(doc.branches || []); setExpenses(migratedExpenses);
                              setBranchRows((doc.branchRows || []).map((br: SavedBranchRow) => {
                                const values = { ...(br.values || {}) } as Record<string, number>;
                                if (values['ديون له'] !== undefined) {
                                  values['ديون ليه'] = values['ديون له'];
                                  delete values['ديون له'];
                                }
                                return { name: br.name, values: values as Record<Expense, number> };
                              }));
                              setRange({ from: new Date(doc.startDate), to: new Date(doc.endDate) }); setCurrentReportId(doc._id);
                              const tb: ProfitTotals = (doc?.totals || {}) as ProfitTotals;
                              setCashBreakdown({ outletExpenses: Number(tb.cashBreakdown?.outletExpenses || 0), home: Number(tb.cashBreakdown?.home || 0), bank: Number(tb.cashBreakdown?.bank || 0), drawer: Number(tb.cashBreakdown?.drawer || 0), vodafone: Number(tb.cashBreakdown?.vodafone || 0), customRows: tb.cashBreakdown?.customRows || [] });
                              setPrefillLock(true);
                              // Ensure only simple preview opens
                              setShowWizard(false);
                              setShowPreview(false);
                              setShowResults(false);
                              setWizardStep(0);
                              setEditMode(false);
                              setTimeout(() => {
                                setShowSimplePreview(true);
                              }, 50);
                              toast({ title: 'تم الفتح', description: 'تم فتح المعاينة المبسطة.', variant: 'default' });
                            } catch (e) {
                              toast({ title: 'فشل الفتح', description: (e as Error).message, variant: 'destructive' });
                            }
                          }}
                          className="w-9 h-9 p-0 bg-white/80 hover:bg-white border-green-200 text-green-700 hover:text-green-800"
                        >
                          <Eye className="w-4 h-4" aria-label="فتح" />
                        </Button>

                        {/* View Report (A4 layout) */}
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-600 text-white"
                          onClick={async () => {
                            try {
                              toast({ title: 'فتح تقرير A4', description: 'جاري التحميل...', variant: 'default' });
                              if (currentReportId !== r._id) {
                                const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${r._id}`);
                                if (!resp.ok) {
                                  toast({ title: 'تعذر التحميل', description: (resp as { ok: false; error: string }).error || '', variant: 'destructive' });
                                  setTitle(r.title || ''); setDescription(r.description || '');
                                  setLastMonthClosing(Number(r?.totals?.lastMonthClosing || 0)); setManualLastMonthValue(false);
                                  // Migrate old "ديون له" to "ديون ليه" in expenses array
                                  const migratedExpenses = (r.expenses || []).map((e: string) => e === 'ديون له' ? 'ديون ليه' : e);
                                  setBranches(r.branches || []); setExpenses(migratedExpenses);
                                  // Migrate old "ديون له" to "ديون ليه" in branch values
                                  setBranchRows((r.branchRows || []).map((br: SavedBranchRow) => {
                                    const values = { ...(br.values || {}) } as Record<string, number>;
                                    if (values['ديون له'] !== undefined) {
                                      values['ديون ليه'] = values['ديون له'];
                                      delete values['ديون له'];
                                    }
                                    return { name: br.name, values: values as Record<Expense, number> };
                                  }));
                                  setRange({ from: new Date(r.startDate), to: new Date(r.endDate) }); setCurrentReportId(r._id);
                                  const tb: ProfitTotals = (r?.totals || {}) as ProfitTotals;
                                  // 🎯 SMART MERGE: If report has no custom rows, preserve global custom rows
                                  const reportCustomRows = tb.cashBreakdown?.customRows || [];
                                  const globalCustomRows = cashBreakdown.customRows || [];
                                  const mergedCustomRows = reportCustomRows.length > 0 ? reportCustomRows : globalCustomRows;

                                  const reportCashBreakdown = {
                                    outletExpenses: Number(tb.cashBreakdown?.outletExpenses || 0),
                                    home: Number(tb.cashBreakdown?.home || 0),
                                    bank: Number(tb.cashBreakdown?.bank || 0),
                                    drawer: Number(tb.cashBreakdown?.drawer || 0),
                                    vodafone: Number(tb.cashBreakdown?.vodafone || 0),
                                    customRows: mergedCustomRows
                                  };
                                  setCashBreakdown(reportCashBreakdown);
                                  setPrefillLock(true);
                                } else {
                                  const doc = (resp as { ok: true; item: ProfitReportDoc }).item;
                                  setTitle(doc.title || ''); setDescription(doc.description || '');
                                  setLastMonthClosing(Number(doc?.totals?.lastMonthClosing || 0)); setManualLastMonthValue(false);
                                  // Migrate old "ديون له" to "ديون ليه"
                                  const migratedExpenses = (doc.expenses || []).map((e: string) => e === 'ديون له' ? 'ديون ليه' : e);
                                  setBranches(doc.branches || []); setExpenses(migratedExpenses);
                                  setBranchRows((doc.branchRows || []).map((br: SavedBranchRow) => {
                                    const values = { ...(br.values || {}) } as Record<string, number>;
                                    if (values['ديون له'] !== undefined) {
                                      values['ديون ليه'] = values['ديون له'];
                                      delete values['ديون له'];
                                    }
                                    return { name: br.name, values: values as Record<Expense, number> };
                                  }));
                                  setRange({ from: new Date(doc.startDate), to: new Date(doc.endDate) }); setCurrentReportId(doc._id);
                                  const tb: ProfitTotals = (doc?.totals || {}) as ProfitTotals;
                                  // 🎯 SMART MERGE: If report has no custom rows, preserve global custom rows
                                  const reportCustomRows2 = tb.cashBreakdown?.customRows || [];
                                  const globalCustomRows2 = cashBreakdown.customRows || [];
                                  const mergedCustomRows2 = reportCustomRows2.length > 0 ? reportCustomRows2 : globalCustomRows2;

                                  const reportCashBreakdown2 = {
                                    outletExpenses: Number(tb.cashBreakdown?.outletExpenses || 0),
                                    home: Number(tb.cashBreakdown?.home || 0),
                                    bank: Number(tb.cashBreakdown?.bank || 0),
                                    drawer: Number(tb.cashBreakdown?.drawer || 0),
                                    vodafone: Number(tb.cashBreakdown?.vodafone || 0),
                                    customRows: mergedCustomRows2
                                  };
                                  setCashBreakdown(reportCashBreakdown2);
                                  setPrefillLock(true);
                                }
                              }
                              setEditMode(false);
                              setPreviewLayout('a4');
                              setShowPreview(true);
                              toast({ title: 'تم الفتح', description: 'تم فتح عرض A4.', variant: 'default' });
                            } catch (e) {
                              toast({ title: 'فشل الفتح', description: (e as Error).message, variant: 'destructive' });
                            }
                          }}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {'عرض تقرير'}
                        </Button>

                        {/* Edit (open multi-step wizard like create flow) */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            // Unsaved changes guard
                            if (currentReportId && editMode) {
                              const confirmed = confirm('لديك تعديلات غير محفوظة على التقرير الحالي. هل تريد المتابعة وفقدان التعديلات؟');
                              if (!confirmed) return;
                            }

                            // Open comprehensive edit modal instead of wizard
                            const localReport = reports.find(report => report._id === r._id);
                            if (localReport) {
                              setQuickEditReport(localReport);
                              setShowQuickEditModal(true);
                            } else {

                              const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${r._id}`);
                              if (resp.ok) {
                                setQuickEditReport((resp as { ok: true; item: ProfitReportDoc }).item);
                                setShowQuickEditModal(true);
                              }
                            }
                          }}
                          className="w-9 h-9 p-0 bg-white/80 hover:bg-white border-emerald-200 text-emerald-700 hover:text-emerald-800"
                        >
                          <Edit className="w-4 h-4" aria-label="تعديل" />
                        </Button>

                        {/* Delete (confirm then schedule with undo) */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowDeleteReportId(r._id)}
                          className="w-9 h-9 p-0"
                        >
                          <Trash2 className="w-4 h-4" aria-label="حذف" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {/* First Page Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="w-9 h-9 p-0 border-slate-300 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>

                {/* Previous Page Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="w-9 h-9 p-0 border-slate-300 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className={`w-9 h-9 p-0 transition-all duration-200 ${currentPage === pageNum
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-600 text-white shadow-md hover:from-green-700 hover:to-emerald-700'
                          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                {/* Next Page Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 p-0 border-slate-300 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                {/* Last Page Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 p-0 border-slate-300 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>

            </>
          )}
        </div>



        {/* Enhanced Management Modal */}
        <Dialog open={showManage} onOpenChange={setShowManage}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
            <DialogHeader className="pb-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
                  <Settings className="w-7 h-7 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    إدارة المصروفات
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 mt-1 flex items-center gap-2">
                    <span>أضف أو احذف المصروفات.</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${manageExpensesScope === 'global' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      النطاق: {manageExpensesScope === 'global' ? 'عام (قالب)' : 'هذا التقرير فقط'}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-6">
              {/* Expenses Section */}
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20/50 shadow-lg rounded-xl mb-6">
                <CardHeader className="pb-4 border-b border-primary/20">
                  <CardTitle className="flex items-center gap-3 text-lg font-bold text-primary">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <PieChart className="w-5 h-5 text-primary" />
                    </div>
                    <span>
                      المصروفات ({(manageExpensesScope === 'global' ? globalExpenses : expenses).filter(e => !new Set(['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح']).has(e)).length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto pt-4">
                  {(manageExpensesScope === 'global' ? globalExpenses : expenses).filter(e => !new Set(['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح']).has(e)).map((eName) => {
                    const i = (manageExpensesScope === 'global' ? globalExpenses : expenses).indexOf(eName);
                    const currentType = expenseTypes.get(eName) || 'other';
                    return (
                      <div key={i} className="flex gap-3 items-center p-3 bg-white rounded-lg border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 flex items-center gap-2">
                          <Input value={eName} readOnly className="flex-1 bg-white" />
                          <Badge
                            variant={currentType === 'personal' ? 'default' : 'secondary'}
                            className={currentType === 'personal' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600'}
                          >
                            {currentType === 'personal' ? 'شخصي' : 'عادي'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newType = currentType === 'personal' ? 'other' : 'personal';
                            setExpenseTypes(prev => {
                              const newMap = new Map(prev).set(eName, newType);
                              return newMap;
                            });
                            toast({
                              title: fixText('تم التحديث'),
                              description: fixText(`تم تغيير نوع "${eName}" إلى ${newType === 'personal' ? 'شخصي' : 'عادي'}`)
                            });
                          }}
                          className="border-blue-300 hover:border-blue-500 text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {manageExpensesScope === 'report' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setExpenseValuesIndex(i); setShowExpenseValues(true); }}
                            className="border-purple-300 hover:border-purple-500"
                          >
                            قيم
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const list = (manageExpensesScope === 'global' ? globalExpenses : expenses);
                            const expenseName = list[i];
                            if (manageExpensesScope === 'report') {
                              const hasValues = branchRows.some(branch => Number((branch.values as Record<string, number>)[expenseName]) > 0);
                              if (hasValues) {
                                const confirmed = confirm(`تحذير: المصروف "${expenseName}" يحتوي على قيم محفوظة في بعض الفروع. هل أنت متأكد من حذفه؟`);
                                if (!confirmed) return;
                              }
                              setExpenses(prev => prev.filter((_, idx) => idx !== i));
                            } else {
                              setGlobalExpenses(prev => prev.filter((_, idx) => idx !== i));
                            }
                            // Remove from expense types as well
                            setExpenseTypes(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(expenseName);
                              return newMap;
                            });
                          }}
                          className="bg-red-500 hover:bg-red-600 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (manageExpensesScope === 'global') {
                        const name = prompt('اسم المصروف الجديد:');
                        if (!name) return;
                        const trimmedName = name.trim();
                        if (!trimmedName || !validateTextInput(trimmedName)) {
                          toast({ title: fixText('خطأ'), description: fixText('اسم المصروف غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
                          return;
                        }
                        if (globalExpenses.includes(trimmedName)) {
                          toast({ title: fixText('تنبيه'), description: fixText('هذا المصروف موجود بالفعل.') });
                          return;
                        }
                        // Ask for expense type
                        const typeChoice = confirm('هل هذا مصروف شخصي؟\n\nاضغط "موافق" للمصروف الشخصي (يضاف للكاش)\nاضغط "إلغاء" للمصروف العادي (يخصم من الأرباح)');
                        const expenseType: ExpenseType = typeChoice ? 'personal' : 'other';

                        setGlobalExpenses(prev => [...prev, trimmedName]);
                        setExpenseTypes(prev => {
                          const newMap = new Map(prev).set(trimmedName, expenseType);
                          return newMap;
                        });
                        toast({
                          title: fixText('تم'),
                          description: fixText(`تم إضافة المصروف "${trimmedName}" كنوع ${expenseType === 'personal' ? 'شخصي' : 'عادي'}.`)
                        });
                      } else {
                        addExpense();
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white border-0 shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {manageExpensesScope === 'global' ? 'إضافة مصروف (عام)' : 'إضافة مصروف (للتقرير)'}
                  </Button>
                </CardContent>
              </Card>
              {/* Removed Analytics Section per request */}
            </div>

            <DialogFooter className="pt-6 border-t border-slate-200">
              <Button
                onClick={() => setShowManage(false)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                تم الحفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expenses Details Modal */}
        <Dialog open={showExpensesDetails} onOpenChange={setShowExpensesDetails}>
          <DialogContent className="max-w-3xl bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20/50 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-primary/20">
              <DialogTitle className="text-xl font-bold text-primary">تفاصيل المصروفات</DialogTitle>
              <DialogDescription className="text-primary">مصادر المصروفات حسب البند والفروع</DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[60vh] bg-white rounded-xl border border-primary/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/5">
                    <th className="p-2 border border-primary/20 text-right">البند</th>
                    <th className="p-2 border border-primary/20 text-center">الإجمالي</th>
                    {branches.map(b => (
                      <th key={`ex-b-${b}`} className="p-2 border border-primary/20 text-center">{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter(e => !fixedExpenses.has(e)).map(e => (
                    <tr key={`ex-row-${e}`} className="odd:bg-white even:bg-primary/5/40">
                      <td className="p-2 border border-primary/20 text-right font-medium">{e}</td>
                      <td className="p-2 border border-primary/20 text-center font-semibold">{Number(totals.sumByExpense?.[e] || 0).toLocaleString('en-US')}</td>
                      {branches.map(b => (
                        <td key={`ex-cell-${e}-${b}`} className="p-2 border border-primary/20 text-center">{Number(branchRows.find(r => r.name === b)?.values[e] || 0).toLocaleString('en-US')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="pt-4 border-t border-primary/20">
              <Button variant="outline" onClick={() => setShowExpensesDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shareholders Manage Modal */}
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-6 border-b border-emerald-200">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-emerald-900">إدارة المساهمين</DialogTitle>
                  <DialogDescription className="text-emerald-800 mt-1">أضف/عدّل المساهمين وإطلع على السجل.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="flex flex-wrap gap-3 items-end bg-white border border-emerald-200 p-4 rounded-xl">
                <div className="flex-1 min-w-[200px]">
                  <Label>الاسم *</Label>
                  <Input
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    placeholder="اسم المساهم"
                    className="bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label>الرصيد الابتدائي *</Label>
                  <Input
                    value={shareAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || validateNumericInput(v)) {
                        setShareAmount(v);
                      }
                    }}
                    placeholder="0"
                    className="bg-white text-center"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label>النسبة % من ربح الجنيه *</Label>
                  <Input
                    value={sharePercent}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || validateNumericInput(v)) {
                        setSharePercent(v);
                      }
                    }}
                    placeholder="0-100"
                    className="bg-white text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={saveShare} className="bg-emerald-600 hover:bg-emerald-700 text-white">{editShareId ? 'تحديث' : 'إضافة'}</Button>
                  {editShareId && <Button variant="outline" onClick={() => { setEditShareId(null); setShareName(''); setShareAmount('0'); setSharePercent('0'); }}>إلغاء التعديل</Button>}
                </div>
                <div className="text-xs text-emerald-800 ml-auto">ربح الجنيه الحالي: <b>{perPoundProfitComputed.toFixed(4)}</b></div>
              </div>

              <div className="overflow-auto bg-white rounded-xl border border-emerald-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-50">
                      <th className="p-2 text-right border border-emerald-200">الاسم</th>
                      <th className="p-2 text-center border border-emerald-200">الرصيد</th>
                      <th className="p-2 text-center border border-emerald-200">النسبة %</th>
                      <th className="p-2 text-center border border-emerald-200">تعديل يدوي للرصد</th>
                      <th className="p-2 text-center border border-emerald-200">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholders.map(s => (
                      <tr key={s.id} className="odd:bg-white even:bg-emerald-50/40">
                        <td className="p-2 border border-emerald-200 text-right font-medium">
                          <Input
                            value={s.name}
                            onChange={(e) => setShareholders(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                            className="bg-white"
                          />
                        </td>
                        <td className="p-2 border border-emerald-200 text-center">{Number(s.amount || 0).toLocaleString()}</td>
                        <td className="p-2 border border-emerald-200 text-center">
                          <Input
                            value={formatNumber(sanitizeNumericValue(String(s.percentage)))}
                            onChange={(e) => {
                              const v = e.target.value; if (!validateNumericInput(v)) return;
                              const num = sanitizeNumericValue(v);
                              setShareholders(prev => prev.map(x => x.id === s.id ? { ...x, percentage: num } : x));
                            }}
                            className="bg-white text-center max-w-[120px] mx-auto"
                          />
                        </td>
                        <td className="p-2 border border-emerald-200 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              placeholder="0"
                              value={formatNumber(sanitizeNumericValue(shareDeltas[s.id] || ''))}
                              onChange={(e) => { const v = e.target.value; if (!validateNumericInput(v)) return; setShareDeltas(m => ({ ...m, [s.id]: v })); }}
                              className="bg-white text-center max-w-[120px]"
                            />
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => applyManualDelta(s, 1)}>زيادة</Button>
                            <Button size="sm" variant="destructive" onClick={() => applyManualDelta(s, -1)}>نقصان</Button>
                          </div>
                        </td>
                        <td className="p-2 border border-emerald-200 text-center">
                          <Button size="sm" variant="secondary" className="mr-2" onClick={() => { setHistoryForId(s.id); setShowShareHistory(true); }}>السجل</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteShare(s.id)}>حذف</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="pt-6 border-t border-emerald-200">
              <Button onClick={() => setShowShareModal(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white">إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shareholder History Modal */}
        <Dialog open={showShareHistory} onOpenChange={setShowShareHistory}>
          <DialogContent className="max-w-3xl bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-200">
              <DialogTitle className="text-xl font-bold text-slate-800">سجل التغييرات</DialogTitle>
              <DialogDescription className="text-slate-600">عرض تأثير أرباح كل فترة على هذا المساهم.</DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-2 border">التاريخ</th>
                    <th className="p-2 border">اسم التقرير</th>
                    <th className="p-2 border">قبل</th>
                    <th className="p-2 border">التغيير</th>
                    <th className="p-2 border">بعد</th>
                    <th className="p-2 border">مخازن نهائي</th>
                    <th className="p-2 border">صافي الربح</th>
                    <th className="p-2 border">المصدر</th>
                    <th className="p-2 border">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const hist = historyForId ? (shareHistory[historyForId] || []) : [] as ShareTxn[];
                    return hist.slice().reverse().map(h => (
                      <tr key={h.id} className="odd:bg-white even:bg-slate-50">
                        <td className="p-2 border">{new Date(h.date).toLocaleString('ar-EG')}</td>
                        <td className="p-2 border text-center text-blue-600 font-medium">
                          {h.reportId ? (() => {
                            const report = reports.find(r => r._id === h.reportId);
                            return report?.reportName || report?.title || '—';
                          })() : '—'}
                        </td>
                        <td className="p-2 border text-center">{Number(h.fromAmount).toLocaleString()}</td>
                        <td className="p-2 border text-center text-emerald-700">+{Number(h.delta).toLocaleString()}</td>
                        <td className="p-2 border text-center font-semibold">{Number(h.toAmount).toLocaleString()}</td>
                        <td className="p-2 border text-center">{Number(h.finalBalance).toLocaleString()}</td>
                        <td className="p-2 border text-center">{Number(h.netProfit).toLocaleString()}</td>
                        <td className="p-2 border text-center">{h.source === 'auto' ? 'تلقائي' : 'يدوي'}</td>
                        <td className="p-2 border text-right">{h.note || ''}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <DialogFooter className="pt-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => setShowShareHistory(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expense Edit Modal */}
        <Dialog open={showExpenseEdit} onOpenChange={(o) => { setShowExpenseEdit(o); if (!o) { setExpenseEditIndex(null); setExpenseEditValue(''); } }}>
          <DialogContent className="max-w-md bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-200">
              <DialogTitle className="text-xl font-bold text-slate-800">تحرير المصروف</DialogTitle>
              <DialogDescription className="text-slate-600">عدّل اسم المصروف. لا يمكن اختيار أسماء البنود الثابتة أو المكررة.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم المصروف</Label>
                <Input
                  value={expenseEditValue}
                  onChange={(e) => {
                    const v = e.target.value; if (!validateTextInput(v)) return; setExpenseEditValue(v);
                  }}
                  className="bg-white"
                />
                <p className="text-xs text-slate-500">مسموح أحرف عربية/إنجليزية/أرقام ومسافات فقط.</p>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => { setShowExpenseEdit(false); setExpenseEditIndex(null); setExpenseEditValue(''); }}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (expenseEditIndex == null) return;
                  const trimmed = expenseEditValue.trim();
                  const fixedSet = new Set(['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح']);
                  if (!trimmed || !validateTextInput(trimmed)) { toast({ title: 'خطأ', description: 'اسم غير صالح', variant: 'destructive' }); return; }
                  if (fixedSet.has(trimmed)) { toast({ title: 'غير مسموح', description: 'لا يمكن تغيير اسم المصروف إلى بند ثابت', variant: 'destructive' }); return; }
                  // Prevent duplicate names
                  if (expenses.some((x, idx) => idx !== expenseEditIndex && x === trimmed)) { toast({ title: 'مكرر', description: 'يوجد مصروف بنفس الاسم', variant: 'destructive' }); return; }
                  const oldName = expenses[expenseEditIndex];
                  const newName = trimmed;
                  // Update expenses array
                  setExpenses(prev => prev.map((x, idx) => idx === expenseEditIndex ? newName : x));
                  // Update branchRows value keys (rename key)
                  setBranchRows(prev => prev.map(row => {
                    const val = (row.values as Record<string, number>)[oldName];
                    const { [oldName]: _, ...rest } = row.values as Record<string, number>;
                    const merged: Record<string, number> = { ...rest, [newName]: Number(val || 0) };
                    return { ...row, values: merged as Record<Expense, number> } as BranchRow;
                  }));
                  setShowExpenseEdit(false);
                  setExpenseEditIndex(null);
                  setExpenseEditValue('');
                  toast({ title: 'تم الحفظ', description: 'تم تحديث اسم المصروف', variant: 'default' });
                }}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expense Values Modal (edit this expense per-branch) */}
        <Dialog open={showExpenseValues} onOpenChange={(o) => { setShowExpenseValues(o); if (!o) setExpenseValuesIndex(null); }}>
          <DialogContent className="max-w-3xl bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-emerald-200">
              <DialogTitle className="text-xl font-extrabold text-emerald-800">
                تعديل قيم المصروف: {typeof expenseValuesIndex === 'number' ? expenses[expenseValuesIndex] : ''}
              </DialogTitle>
              <DialogDescription className="text-emerald-700">
                حرّر قيمة هذا المصروف لكل فرع في جدول واحد. يظهر الإجمالي أسفل الجدول.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="overflow-auto bg-white rounded-xl border border-emerald-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-50">
                      <th className="p-2 text-right border border-emerald-200">الفرع</th>
                      <th className="p-2 text-center border border-emerald-200">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeof expenseValuesIndex === 'number' && branches.map((b) => {
                      const eName = expenses[expenseValuesIndex] as Expense;
                      const current = Number(branchRows.find(r => r.name === b)?.values[eName] || 0);
                      return (
                        <tr key={`ev-${eName}-${b}`} className="odd:bg-white even:bg-emerald-50/40">
                          <td className="p-2 border border-emerald-200 font-medium text-right">{b}</td>
                          <td className="p-2 border border-emerald-200 text-center">
                            <Input
                              value={formatNumber(current)}
                              onChange={(ev) => {
                                const raw = ev.target.value; if (!validateNumericInput(raw)) return; const num = sanitizeNumericValue(raw);
                                setBranchRows(prev => prev.map(row => row.name === b ? { ...row, values: { ...row.values, [eName]: num } } : row));
                              }}
                              className="max-w-[220px] mx-auto text-center"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {typeof expenseValuesIndex === 'number' && (
                    <tfoot>
                      <tr>
                        <td className="p-2 border border-emerald-200 text-right font-semibold">الإجمالي</td>
                        <td className="p-2 border border-emerald-200 text-center font-bold text-emerald-800">
                          {branches.reduce((s, b) => s + Number(branchRows.find(r => r.name === b)?.values[expenses[expenseValuesIndex] as Expense] || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-emerald-200">
              <Button variant="outline" onClick={() => { setShowExpenseValues(false); setExpenseValuesIndex(null); }} className="border-emerald-300">إغلاق</Button>
              <Button onClick={() => { setShowExpenseValues(false); setExpenseValuesIndex(null); }} className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white">تم</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shareholders Impact Details Modal */}
        <Dialog open={showImpactModal} onOpenChange={setShowImpactModal}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-emerald-200">
              <DialogTitle className="text-xl font-extrabold text-emerald-800">تفاصيل تأثير التقرير على المساهمين</DialogTitle>
              <DialogDescription className="text-emerald-700">
                ربح الجنيه الحالي = صافي الربح ÷ مخازن نهائي = {Number(totals.netProfit || 0).toLocaleString('en-US')} ÷ {Number(correctFinalBalance).toLocaleString('en-US')} = <b>{perPoundProfitComputed.toFixed(4)}</b>
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh] bg-white rounded-xl border border-emerald-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-50">
                    <th className="p-2 border border-emerald-200 text-right">المساهم</th>
                    <th className="p-2 border border-emerald-200 text-center">قبل</th>
                    <th className="p-2 border border-emerald-200 text-center">النسبة %</th>
                    <th className="p-2 border border-emerald-200 text-center">التغيير</th>
                    <th className="p-2 border border-emerald-200 text-center">بعد</th>
                    <th className="p-2 border border-emerald-200 text-center">المصدر</th>
                    <th className="p-2 border border-emerald-200 text-right">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map(s => {
                    const hist = (shareHistory && shareHistory[s.id]) || [];
                    const last = hist[hist.length - 1] as ShareTxn | undefined;
                    if (!last || last.source !== 'auto') return null;
                    return (
                      <tr key={`impd-${s.id}`} className="odd:bg-white even:bg-emerald-50/40">
                        <td className="p-2 border border-emerald-200 text-right font-medium">{s.name}</td>
                        <td className="p-2 border border-emerald-200 text-center">{Number(last.fromAmount).toLocaleString('en-US')}</td>
                        <td className="p-2 border border-emerald-200 text-center">{Number(s.percentage || 0).toLocaleString('en-US')}%</td>
                        <td className="p-2 border border-emerald-200 text-center text-emerald-700">+{Number(last.delta).toLocaleString('en-US')}</td>
                        <td className="p-2 border border-emerald-200 text-center font-semibold">{Number(last.toAmount).toLocaleString('en-US')}</td>
                        <td className="p-2 border border-emerald-200 text-center">{last.source === 'auto' ? 'تلقائي' : 'يدوي'}</td>
                        <td className="p-2 border border-emerald-200 text-right">{last.note || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50">
                    <td className="p-2 border border-emerald-200 text-right font-semibold">الإجمالي</td>
                    <td className="p-2 border border-emerald-200"></td>
                    <td className="p-2 border border-emerald-200"></td>
                    <td className="p-2 border border-emerald-200 text-center font-bold text-emerald-800">
                      {shareholders.reduce((sum, s) => {
                        const hist = (shareHistory && shareHistory[s.id]) || [];
                        const last = hist[hist.length - 1] as ShareTxn | undefined;
                        return sum + (last && last.source === 'auto' ? Number(last.delta || 0) : 0);
                      }, 0).toLocaleString('en-US')}
                    </td>
                    <td className="p-2 border border-emerald-200 text-center font-bold text-emerald-800">
                      {shareholders.reduce((sum, s) => {
                        const hist = (shareHistory && shareHistory[s.id]) || [];
                        const last = hist[hist.length - 1] as ShareTxn | undefined;
                        return sum + (last && last.source === 'auto' ? Number(last.toAmount || 0) : 0);
                      }, 0).toLocaleString('en-US')}
                    </td>
                    <td className="p-2 border border-emerald-200"></td>
                    <td className="p-2 border border-emerald-200"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <DialogFooter className="pt-4 border-t border-emerald-200">
              <Button variant="outline" onClick={() => setShowImpactModal(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Metrics Explanation Modal */}
        <Dialog open={showExplain} onOpenChange={setShowExplain}>
          <DialogContent className="max-w-xl bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-200">
              <DialogTitle className="text-xl font-bold text-slate-800">
                {explainType === 'final' && 'شرح: مخازن نهائي (الشهر الحالي)'}
                {explainType === 'net' && 'شرح: صافي الربح'}
                {explainType === 'compare' && 'شرح: فرق المخازن'}
                {explainType === 'diff' && 'شرح: فرق المخازن'}
                {explainType === 'profit' && 'شرح: الأرباح'}
                {explainType === 'final-result' && 'شرح: النتيجة النهائية'}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                تفاصيل الحساب بالأرقام الحالية
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {explainType === 'final' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
                  <div className="font-semibold text-primary">مخازن نهائي = مخازن + الكاش + ديون ليه - ديون عليه</div>
                  <div className="font-mono text-sm p-3 bg-white rounded border">
                    {Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()} + {(Number(cashBreakdown.outletExpenses || 0) + Number(cashBreakdown.home || 0) + Number(cashBreakdown.bank || 0) + Number(totals.sumByExpense?.['كاش الدرج'] || 0)).toLocaleString()} + {(Number(totals.sumByExpense?.['ديون له'] || 0) + Number(totals.sumByExpense?.['ديون ليه'] || 0)).toLocaleString()} - {Number(totals.sumByExpense?.['ديون عليه'] || 0).toLocaleString()} = <b className="text-primary">{Number(correctFinalBalance).toLocaleString()}</b>
                  </div>
                </div>
              )}
              {explainType === 'net' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
                  <div className="font-semibold text-primary">صافي الربح = إجمالي الأرباح - إجمالي المصروفات</div>
                  <div className="font-mono text-sm p-3 bg-white rounded border">
                    {Number(totals.totalProfits || 0).toLocaleString()} - {Number(totals.totalExpenses || 0).toLocaleString()} = <b className="text-primary">{Number(totals.netProfit || 0).toLocaleString()}</b>
                  </div>
                </div>
              )}
              {explainType === 'compare' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-secondary/5 to-secondary/10 rounded-lg border border-secondary/20">
                  <div className="font-semibold text-secondary">فرق المخازن = الشهر الحالي (مخازن نهائي) - الشهر الماضي</div>
                  <div className="font-mono text-sm p-3 bg-white rounded border">
                    {Number(correctFinalBalance).toLocaleString()} - {Number(lastMonthClosing || 0).toLocaleString()} = <b className="text-secondary">{Number(compareLastMonth || 0).toLocaleString()}</b>
                  </div>
                </div>
              )}
              {explainType === 'diff' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                  <div className="font-semibold text-primary">فرق المخازن = الشهر الحالي (مخازن نهائي) - الشهر الماضي</div>
                  <div className="font-mono text-sm p-3 bg-white rounded border">
                    {Number(correctFinalBalance).toLocaleString()} - {Number(lastMonthClosing || 0).toLocaleString()} = {formatNumberWithParens(Number(compareLastMonth || 0))}
                  </div>
                </div>
              )}
              {explainType === 'profit' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="font-semibold text-green-800">الأرباح</div>
                  <div className="space-y-2">
                    <div className="font-mono text-sm p-3 bg-white rounded border">
                      <div className="font-semibold text-green-700">إجمالي الأرباح (قبل المصروفات):</div>
                      <div className="text-lg">{Number(totals.totalProfits || 0).toLocaleString()}</div>
                    </div>
                    <div className="font-mono text-sm p-3 bg-white rounded border">
                      <div className="font-semibold text-green-800">صافي الربح = إجمالي الأرباح - المصروفات</div>
                      <div className="text-lg">{Number(totals.totalProfits || 0).toLocaleString()} - {Number(totals.totalExpenses || 0).toLocaleString()} = {Number(totals.netProfit || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
              {explainType === 'final-result' && (
                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                  <div className="font-semibold text-primary">صافي الربح - فرق المخازن (الفرق المطلق)</div>
                  <div className="font-mono text-sm p-3 bg-white rounded border">
                    |{Number(totals.netProfit || 0).toLocaleString()} - {Number(compareLastMonth || 0).toLocaleString()}| = <b className="text-green-600">{Math.abs(Number(totals.netProfit || 0) - Number(compareLastMonth || 0)).toLocaleString()}</b>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setShowExplain(false)}
                className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Modal (A4 or Summary) */}
        <Dialog open={showPreview} onOpenChange={(o) => setShowPreview(o)}>
          <DialogContent className="max-w-6xl bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
            <DialogHeader className="pb-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-black text-slate-900 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    ملخص الأرباح
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    عرض للطباعة أو التنزيل
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setExportAction('print')}
                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary shadow-md"
                  >
                    <Printer className="w-4 h-4 mr-1" />طباعة
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (currentReportId) {
                        // Open comprehensive edit modal instead of wizard
                        const localReport = reports.find(report => report._id === currentReportId);
                        if (localReport) {


                          setQuickEditReport(localReport);
                          setShowQuickEditModal(true);
                        } else {

                          const resp = await apiGet<ProfitReportDoc>(`/api/profit-reports/${currentReportId}`);
                          if (resp.ok) {
                            setQuickEditReport((resp as { ok: true; item: ProfitReportDoc }).item);
                            setShowQuickEditModal(true);
                          }
                        }
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  >
                    <Edit className="w-4 h-4 mr-1" />تعديل شامل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportToExcel}
                    className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4 mr-1" />تنزيل Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExportAction('image')}
                    className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  >
                    <ImageIcon className="w-4 h-4 mr-1" />تنزيل صورة
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="overflow-auto border-0 rounded-xl bg-gradient-to-br from-white to-slate-50/30 p-1 shadow-inner">
              <div
                ref={exportRef}
                className="p-8 bg-white rounded-lg shadow-sm"
                style={{ width: '794px', margin: '0 auto' }}
              >
                <style>{`
                  @media print {
                    .break-inside-avoid {
                      break-inside: avoid;
                      page-break-inside: avoid;
                    }
                    .space-y-6 > * + * {
                      margin-top: 1.5rem;
                    }
                    .page-break-before {
                      page-break-before: always;
                    }
                    .table-container {
                      break-inside: avoid;
                      page-break-inside: avoid;
                      margin-bottom: 1.5rem;
                      margin-top: 1rem;
                    }
                    /* Remove thick dark headers in print */
                    .print-header {
                      background-color: #f8fafc !important;
                      color: #1e293b !important;
                      border: 1px solid #cbd5e1 !important;
                      font-weight: 600 !important;
                      padding: 8px 12px !important;
                    }
                    /* Ensure clean page breaks */
                    .page-break-before {
                      page-break-before: auto;
                    }
                    /* Better table spacing */
                    table {
                      margin: 0 !important;
                    }
                    /* Remove any potential thick borders */
                    .border-slate-300 {
                      border-color: #cbd5e1 !important;
                    }
                  }
                `}</style>
                {/* ══════════════ REPORT HEADER ══════════════ */}
                <div className="mb-6">
                  {/* Top accent bar */}
                  <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500 rounded-full mb-5" />

                  {/* Title + Date */}
                  <div className="text-center mb-5">
                    <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                      {reportName || title || 'تقرير الأرباح'}
                    </div>
                    {range?.from && range?.to && (
                      <div className="inline-flex items-center gap-2 bg-slate-50 text-slate-600 text-xs font-semibold px-4 py-1.5 rounded-full border border-slate-200 mt-1">
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>{new Date(range.from).toLocaleDateString('ar-EG')}</span>
                        <span className="text-slate-300">|</span>
                        <span>{new Date(range.to).toLocaleDateString('ar-EG')}</span>
                      </div>
                    )}
                  </div>

                  {/* ─── Hero KPI Summary Strip ─── */}
                  <div className="grid grid-cols-3 gap-3 mb-1">
                    {/* KPI 1: Final Balance */}
                    <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200/80 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-200/40 to-transparent rounded-bl-[40px]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 tracking-tight">مخازن نهائي</span>
                        </div>
                        <div className="text-lg font-black text-emerald-900 tabular-nums tracking-tight" dir="ltr">
                          {Number(correctFinalBalance).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* KPI 2: Net Profit */}
                    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200/80 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-200/40 to-transparent rounded-bl-[40px]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 tracking-tight">صافي الربح</span>
                        </div>
                        <div className={`text-lg font-black tabular-nums tracking-tight ${Number(totals.netProfit || 0) >= 0 ? 'text-blue-900' : 'text-red-600'}`} dir="ltr">
                          {formatNumberWithParens(Number(totals.netProfit || 0))}
                        </div>
                      </div>
                    </div>

                    {/* KPI 3: Growth Rate */}
                    <div className="relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-3 border border-violet-200/80 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-violet-200/40 to-transparent rounded-bl-[40px]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-5 h-5 rounded-md bg-violet-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                          </div>
                          <span className="text-[10px] font-bold text-violet-700 tracking-tight">نسبة النمو</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <div className={`text-lg font-black tabular-nums tracking-tight ${Number(compareLastMonth || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
                            {Number(lastMonthClosing || 0) > 0
                              ? `${((Number(compareLastMonth || 0) / Number(lastMonthClosing || 1)) * 100).toFixed(1)}%`
                              : '—'}
                          </div>
                          {Number(compareLastMonth || 0) >= 0 ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* ══════════════ SECTION 1: EXPENSES TABLE ══════════════ */}
                  <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden table-container shadow-md ring-1 ring-slate-100">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-white border-b-2 border-emerald-400">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">1</div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-tight">الفترة الزمنية</div>
                          <div className="text-[10px] text-slate-500 font-medium">تفاصيل البنود حسب الفرع</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{branches.length} فرع</div>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/80">
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 text-xs">البند</th>
                          {branches.map((branch, idx) => (
                            <th key={idx} className="border border-slate-200 p-2 text-center font-bold text-slate-700 text-xs">{branch}</th>
                          ))}
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 bg-slate-100/80 text-xs">المجموع</th>
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 bg-emerald-50/60 text-xs w-[60px]">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* مخازن - highlighted row */}
                        {(() => {
                          const storageTotal = Number(totals.sumByExpense?.['مخازن'] || 0);
                          const grandTotal = Number(correctFinalBalance || 1);
                          const pct = grandTotal > 0 ? ((storageTotal / grandTotal) * 100).toFixed(1) : '0';
                          return (
                            <tr className="bg-emerald-50/50">
                              <td className="border border-slate-200 p-2 text-center font-semibold text-emerald-800" style={{ borderRight: '3px solid #10b981' }}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                  مخازن
                                </div>
                              </td>
                              {branches.map((branch, idx) => (
                                <td key={idx} className="border border-slate-200 p-2 text-center tabular-nums">
                                  {Number(branchRows.find(br => br.name === branch)?.values['مخازن'] || 0).toLocaleString()}
                                </td>
                              ))}
                              <td className="border border-slate-200 p-2 text-center font-bold bg-emerald-50 tabular-nums">
                                {storageTotal.toLocaleString()}
                              </td>
                              <td className="border border-slate-200 p-1 text-center">
                                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-emerald-400 to-emerald-300 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                                  <span className="relative text-[9px] font-bold text-slate-700 leading-4">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })()}

                        {/* Personal Expenses */}
                        {expenses
                          .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                          .filter(expense => {
                            const total = Number(totals.sumByExpense?.[expense] || 0);
                            return total > 0;
                          })
                          .map((expense, idx) => {
                            const expTotal = Number(totals.sumByExpense?.[expense] || 0);
                            const grandTotal = Number(correctFinalBalance || 1);
                            const pct = grandTotal > 0 ? ((expTotal / grandTotal) * 100).toFixed(1) : '0';
                            return (
                              <tr key={expense} className={idx % 2 === 0 ? "bg-amber-50/30" : "bg-white"}>
                                <td className="border border-slate-200 p-2 text-center font-medium text-amber-800" style={{ borderRight: '3px solid #f59e0b' }}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    {expense}
                                  </div>
                                </td>
                                {branches.map((branch, branchIdx) => (
                                  <td key={branchIdx} className="border border-slate-200 p-2 text-center tabular-nums">
                                    {Number(branchRows.find(br => br.name === branch)?.values[expense] || 0).toLocaleString()}
                                  </td>
                                ))}
                                <td className="border border-slate-200 p-2 text-center font-bold bg-slate-50/50 tabular-nums">
                                  {expTotal.toLocaleString()}
                                </td>
                                <td className="border border-slate-200 p-1 text-center">
                                  <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-400 to-amber-300 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                                    <span className="relative text-[9px] font-bold text-slate-700 leading-4">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {/* Other Expenses */}
                        {expenses
                          .filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                          .filter(expense => {
                            const total = Number(totals.sumByExpense?.[expense] || 0);
                            return total > 0;
                          })
                          .map((expense, idx) => {
                            const expTotal = Number(totals.sumByExpense?.[expense] || 0);
                            const grandTotal = Number(correctFinalBalance || 1);
                            const pct = grandTotal > 0 ? ((expTotal / grandTotal) * 100).toFixed(1) : '0';
                            return (
                              <tr key={expense} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                                <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: '3px solid #94a3b8' }}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    {expense}
                                  </div>
                                </td>
                                {branches.map((branch, branchIdx) => (
                                  <td key={branchIdx} className="border border-slate-200 p-2 text-center tabular-nums">
                                    {Number(branchRows.find(br => br.name === branch)?.values[expense] || 0).toLocaleString()}
                                  </td>
                                ))}
                                <td className="border border-slate-200 p-2 text-center font-bold bg-slate-50/50 tabular-nums">
                                  {expTotal.toLocaleString()}
                                </td>
                                <td className="border border-slate-200 p-1 text-center">
                                  <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-slate-400 to-slate-300 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                                    <span className="relative text-[9px] font-bold text-slate-700 leading-4">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {/* Cash, Debts, Profits - special rows */}
                        {[
                          { key: 'كاش الدرج', color: '#0d9488', dotColor: 'bg-teal-400', bgClass: 'bg-teal-50/30' },
                          { key: 'ديون ليه', color: '#3b82f6', dotColor: 'bg-blue-400', bgClass: 'bg-blue-50/30' },
                          { key: 'ديون عليه', color: '#ef4444', dotColor: 'bg-red-400', bgClass: 'bg-red-50/30' },
                          { key: 'أرباح', color: '#8b5cf6', dotColor: 'bg-violet-400', bgClass: 'bg-violet-50/30' },
                        ].map((item, idx) => {
                          const itemTotal = Number(totals.sumByExpense?.[item.key] || 0);
                          const grandTotal = Number(correctFinalBalance || 1);
                          const pct = grandTotal > 0 ? ((Math.abs(itemTotal) / grandTotal) * 100).toFixed(1) : '0';
                          return (
                            <tr key={item.key} className={idx % 2 === 0 ? item.bgClass : 'bg-white'}>
                              <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: `3px solid ${item.color}` }}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                                  {item.key}
                                </div>
                              </td>
                              {branches.map((branch, branchIdx) => (
                                <td key={branchIdx} className="border border-slate-200 p-2 text-center tabular-nums">
                                  {Number(branchRows.find(br => br.name === branch)?.values[item.key] || 0).toLocaleString()}
                                </td>
                              ))}
                              <td className="border border-slate-200 p-2 text-center font-bold bg-slate-50/50 tabular-nums">
                                {itemTotal.toLocaleString()}
                              </td>
                              <td className="border border-slate-200 p-1 text-center">
                                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="absolute inset-y-0 right-0 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%`, background: `linear-gradient(to left, ${item.color}, ${item.color}88)` }} />
                                  <span className="relative text-[9px] font-bold text-slate-700 leading-4">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ══════════════ SECTION 2: CASH DETAILS ══════════════ */}
                  <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden table-container page-break-before shadow-md ring-1 ring-slate-100">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-teal-50 to-white border-b-2 border-teal-400">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">2</div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-tight">الكاش</div>
                          <div className="text-[10px] text-slate-500 font-medium">توزيع السيولة النقدية</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 tabular-nums" dir="ltr">
                        Σ {Number(cashManual || 0).toLocaleString()}
                      </div>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/80">
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 text-xs">البند</th>
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 text-xs">المبلغ</th>
                          <th className="border border-slate-200 p-2 text-center font-bold text-slate-700 bg-teal-50/60 text-xs w-[80px]">النسبة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const cashTotal = Number(cashManual || 1);
                          const cashItems = [
                            { name: 'المصروفات من حساب المحل', value: Number(cashBreakdown.outletExpenses || 0), icon: '🏪' },
                            { name: 'بيت', value: Number(cashBreakdown.home || 0), icon: '🏠' },
                            { name: 'بنك', value: Number(cashBreakdown.bank || 0), icon: '🏦' },
                            { name: 'درج', value: Number(cashBreakdown.drawer || 0), icon: '📦' },
                          ];
                          if (Number(cashBreakdown.vodafone || 0) > 0) {
                            cashItems.push({ name: 'فودافون', value: Number(cashBreakdown.vodafone || 0), icon: '📱' });
                          }
                          (cashBreakdown.customRows || [])
                            .filter(row => {
                              const name = (row.name || '').toLowerCase().trim();
                              const isVodafone = name.includes('vodafone') || name.includes('فودافون') || name === 'فودافون';
                              return !isVodafone && Number(row.amount || 0) > 0;
                            })
                            .forEach(row => {
                              cashItems.push({ name: row.name, value: Number(row.amount || 0), icon: '💰' });
                            });
                          return cashItems.map((item, idx) => {
                            const pct = cashTotal > 0 ? ((item.value / cashTotal) * 100).toFixed(1) : '0';
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}>
                                <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: '3px solid #14b8a6' }}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-xs">{item.icon}</span>
                                    {item.name}
                                  </div>
                                </td>
                                <td className="border border-slate-200 p-2 text-center tabular-nums font-semibold">{item.value.toLocaleString()}</td>
                                <td className="border border-slate-200 p-1 text-center">
                                  <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-teal-400 to-teal-300 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                                    <span className="relative text-[9px] font-bold text-slate-700 leading-4">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        <tr className="bg-gradient-to-r from-teal-50 to-emerald-50">
                          <td className="border border-slate-200 p-2 text-center font-black text-teal-800" style={{ borderRight: '3px solid #0d9488' }}>
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs">✅</span>
                              المجموع
                            </div>
                          </td>
                          <td className="border border-slate-200 p-2 text-center font-black text-teal-800 tabular-nums text-base">
                            {Number(cashManual || 0).toLocaleString()}
                          </td>
                          <td className="border border-slate-200 p-1 text-center">
                            <div className="bg-teal-500 text-white text-[9px] font-black rounded-full px-2 py-0.5 inline-block">100%</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ══════════════ SECTION 3: FINAL BALANCE ══════════════ */}
                  <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden table-container page-break-before shadow-md ring-1 ring-slate-100">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-white border-b-2 border-amber-400">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">3</div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-tight">مخازن نهائي</div>
                          <div className="text-[10px] text-slate-500 font-medium">حساب الرصيد النهائي</div>
                        </div>
                      </div>
                    </div>
                    {/* Premium Visual Equation */}
                    <div className="p-5 bg-gradient-to-br from-slate-50/50 to-white">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* مخازن */}
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-2.5 rounded-xl border border-emerald-200 text-center min-w-[100px] shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <div className="text-[10px] font-bold text-emerald-600">مخازن</div>
                          </div>
                          <div className="text-base font-black text-emerald-800 tabular-nums" dir="ltr">{Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}</div>
                          {Number(correctFinalBalance || 0) > 0 && (
                            <div className="text-[8px] text-emerald-500 font-semibold mt-0.5" dir="ltr">
                              {((Number(totals.sumByExpense?.['مخازن'] || 0) / Number(correctFinalBalance || 1)) * 100).toFixed(0)}% من الإجمالي
                            </div>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white font-black text-sm">+</span>
                        </div>
                        {/* الكاش */}
                        <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 px-4 py-2.5 rounded-xl border border-teal-200 text-center min-w-[100px] shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-teal-400" />
                            <div className="text-[10px] font-bold text-teal-600">الكاش</div>
                          </div>
                          <div className="text-base font-black text-teal-800 tabular-nums" dir="ltr">{Number(cashManual || 0).toLocaleString()}</div>
                          {Number(correctFinalBalance || 0) > 0 && (
                            <div className="text-[8px] text-teal-500 font-semibold mt-0.5" dir="ltr">
                              {((Number(cashManual || 0) / Number(correctFinalBalance || 1)) * 100).toFixed(0)}% من الإجمالي
                            </div>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white font-black text-sm">+</span>
                        </div>
                        {/* ديون ليه */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 px-4 py-2.5 rounded-xl border border-blue-200 text-center min-w-[100px] shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <div className="text-[10px] font-bold text-blue-600">ديون ليه</div>
                          </div>
                          <div className="text-base font-black text-blue-800 tabular-nums" dir="ltr">{Number(totals.sumByExpense?.['ديون ليه'] || 0).toLocaleString()}</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white font-black text-sm">−</span>
                        </div>
                        {/* ديون عليه */}
                        <div className="bg-gradient-to-br from-red-50 to-red-100/50 px-4 py-2.5 rounded-xl border border-red-200 text-center min-w-[100px] shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-red-400" />
                            <div className="text-[10px] font-bold text-red-500">ديون عليه</div>
                          </div>
                          <div className="text-base font-black text-red-700 tabular-nums" dir="ltr">{Math.abs(Number(totals.sumByExpense?.['ديون عليه'] || 0)).toLocaleString()}</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white font-black text-sm">=</span>
                        </div>
                        {/* مخازن نهائي - THE RESULT */}
                        <div className="relative bg-gradient-to-br from-emerald-100 via-green-100 to-teal-100 px-5 py-3 rounded-2xl border-2 border-emerald-400 text-center min-w-[130px] shadow-md overflow-hidden">
                          <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-emerald-300/30 to-transparent rounded-br-[30px]" />
                          <div className="relative">
                            <div className="text-[10px] font-black text-emerald-700 mb-0.5 tracking-wide">مخازن نهائي</div>
                            <div className="text-xl font-black text-emerald-900 tabular-nums tracking-tight" dir="ltr">{Number(correctFinalBalance).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══════════════ SECTION 4 & 5: COMPARISON + NET PROFIT ══════════════ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 break-inside-avoid">
                    {/* Previous Month Comparison */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden break-inside-avoid shadow-md ring-1 ring-slate-100">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-white border-b-2 border-blue-400">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">4</div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm leading-tight">مقارنة بالشهر الماضي</div>
                            <div className="text-[10px] text-slate-500 font-medium">تحليل التغيّر الشهري</div>
                          </div>
                        </div>
                        {/* Growth badge */}
                        <div className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${Number(compareLastMonth || 0) >= 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
                          {Number(compareLastMonth || 0) >= 0 ? '↑' : '↓'}
                          {Number(lastMonthClosing || 0) > 0
                            ? `${Math.abs((Number(compareLastMonth || 0) / Number(lastMonthClosing || 1)) * 100).toFixed(1)}%`
                            : '—'}
                        </div>
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          <tr className="bg-blue-50/30">
                            <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: '3px solid #3b82f6' }}>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-300" />
                                الشهر الماضي
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 text-center tabular-nums font-semibold">
                              {Number(lastMonthClosing || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-white">
                            <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: '3px solid #3b82f6' }}>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                الشهر الحالي
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 text-center tabular-nums font-semibold">
                              {Number(correctFinalBalance).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-gradient-to-r from-emerald-50 to-green-50">
                            <td className="border border-slate-200 p-2 text-center font-bold text-emerald-800" style={{ borderRight: '3px solid #10b981' }}>
                              <div className="flex items-center justify-center gap-1.5">
                                {Number(compareLastMonth || 0) >= 0 ? (
                                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                )}
                                الفرق
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 text-center font-black text-emerald-800 tabular-nums">
                              {formatNumberWithParens(Number(compareLastMonth || 0))}
                            </td>
                          </tr>
                          <tr className="bg-blue-50/30">
                            <td className="border border-slate-200 p-2 text-center font-medium text-slate-700" style={{ borderRight: '3px solid #3b82f6' }}>
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-xs">🏪</span>
                                المصروفات من حساب المحل
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 text-center tabular-nums font-semibold">
                              {Number(cashBreakdown.outletExpenses || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-gradient-to-r from-emerald-100/80 to-green-100/80">
                            <td className="border border-slate-200 p-2 text-center font-black text-emerald-900" style={{ borderRight: '3px solid #059669' }}>
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-xs">💎</span>
                                الباقي
                              </div>
                            </td>
                            <td className="border border-slate-200 p-2 text-center font-black text-emerald-900 tabular-nums text-base">
                              {formatNumberWithParens(Number(compareLastMonth || 0) - Number(cashBreakdown.outletExpenses || 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Net Profit — Hero Card */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-md ring-1 ring-slate-100 flex flex-col">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-green-50 to-white border-b-2 border-green-500">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">5</div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm leading-tight">صافي الربح</div>
                            <div className="text-[10px] text-slate-500 font-medium">النتيجة النهائية</div>
                          </div>
                        </div>
                      </div>
                      {/* Hero net profit display */}
                      <div className="flex-1 flex flex-col items-center justify-center p-5 bg-gradient-to-br from-slate-50/50 to-white">
                        {/* Expense vs Profit chips */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 text-center">
                            <div className="text-[9px] font-bold text-red-500 mb-0.5">مصروفات</div>
                            <div className="text-sm font-black text-red-700 tabular-nums" dir="ltr">{Number(totals.totalExpenses || 0).toLocaleString()}</div>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center">
                            <span className="text-white font-black text-[10px]">−</span>
                          </div>
                          <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 text-center">
                            <div className="text-[9px] font-bold text-green-500 mb-0.5">أرباح</div>
                            <div className="text-sm font-black text-green-700 tabular-nums" dir="ltr">{Number(totals.totalProfits || 0).toLocaleString()}</div>
                          </div>
                        </div>
                        {/* Big result */}
                        <div className={`relative px-6 py-3 rounded-2xl border-2 shadow-md text-center ${Number(totals.netProfit || 0) >= 0
                          ? 'bg-gradient-to-br from-emerald-100 via-green-100 to-teal-50 border-emerald-400'
                          : 'bg-gradient-to-br from-red-100 via-red-50 to-orange-50 border-red-400'}`}>
                          <div className="absolute top-0 left-0 w-10 h-10 bg-gradient-to-br from-white/40 to-transparent rounded-br-[20px]" />
                          <div className="relative">
                            <div className={`text-[10px] font-black mb-0.5 ${Number(totals.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {Number(totals.netProfit || 0) >= 0 ? '📈 ربح صافي' : '📉 خسارة'}
                            </div>
                            <div className={`text-2xl font-black tabular-nums tracking-tight ${Number(totals.netProfit || 0) >= 0 ? 'text-emerald-900' : 'text-red-700'}`} dir="ltr">
                              {formatNumberWithParens(Number(totals.netProfit || 0))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ══════════════ SECTION 6: SHAREHOLDERS IMPACT ══════════════ */}
                <div className="mt-8 bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-md ring-1 ring-slate-100">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-white border-b-2 border-violet-400">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">6</div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm leading-tight">تأثير التقرير على أرصدة المساهمين</div>
                        <div className="text-[10px] text-slate-500 font-medium">تفاصيل حسابات كل مساهم</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                      {shareholders.filter(s => {
                        const hist = (shareHistory && shareHistory[s.id]) || [];
                        const reportTxn = hist.find(txn =>
                          txn.reportId === currentReportId ||
                          txn.reportId?.startsWith(`${currentReportId}_profit_`) ||
                          txn.reportId?.startsWith(`${currentReportId}_edit_`) ||
                          txn.reportId?.startsWith(`${currentReportId}_reversal_`) ||
                          txn.reportId?.startsWith(`${currentReportId}_skip_`)
                        );
                        return reportTxn && reportTxn.source === 'auto';
                      }).length} مساهم
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    {shareholders.map((s, sIdx) => {
                      const hist = (shareHistory && shareHistory[s.id]) || [];
                      const reportTxn = hist.find(txn =>
                        txn.reportId === currentReportId ||
                        txn.reportId?.startsWith(`${currentReportId}_profit_`) ||
                        txn.reportId?.startsWith(`${currentReportId}_edit_`) ||
                        txn.reportId?.startsWith(`${currentReportId}_reversal_`) ||
                        txn.reportId?.startsWith(`${currentReportId}_skip_`)
                      ) as ShareTxn | undefined;
                      if (!reportTxn || reportTxn.source !== 'auto') return null;

                      const currentDifference = compareLastMonth || 0;
                      const currentFinalBalance = correctFinalBalance || 0;
                      const profitPerPound = calculateProfitPerPound(currentDifference, currentFinalBalance);
                      const shareholderPercentage = s.percentage;
                      const calculatedDelta = calculateShareholderDelta(Number(reportTxn.fromAmount), profitPerPound, shareholderPercentage);
                      const calculatedNewBalance = Number(reportTxn.fromAmount) + calculatedDelta;
                      const growthPct = Number(reportTxn.fromAmount) > 0 ? ((calculatedDelta / Number(reportTxn.fromAmount)) * 100).toFixed(2) : '0';

                      const avatarColors = [
                        'from-violet-500 to-purple-600',
                        'from-blue-500 to-indigo-600',
                        'from-emerald-500 to-teal-600',
                        'from-amber-500 to-orange-600',
                        'from-rose-500 to-pink-600',
                      ];
                      const avatarColor = avatarColors[sIdx % avatarColors.length];

                      return (
                        <div key={`sh-imp-${s.id}`} className="rounded-xl border-2 border-slate-200 overflow-hidden shadow-md ring-1 ring-slate-100 bg-white">
                          {/* ── Shareholder Header ── */}
                          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} text-white flex items-center justify-center text-sm font-black shadow-sm`}>
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm leading-tight">{s.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">نسبة {s.percentage}%</span>
                                </div>
                              </div>
                            </div>
                            {/* Growth indicator */}
                            <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${calculatedDelta >= 0
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : 'text-red-600 bg-red-50 border border-red-200'}`}>
                              {calculatedDelta >= 0 ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                              )}
                              <span className="tabular-nums">{calculatedDelta >= 0 ? '+' : ''}{growthPct}%</span>
                            </div>
                          </div>

                          {/* ── Before → Delta → After Strip ── */}
                          <div className="px-4 py-3 bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-100">
                            <div className="flex items-center justify-center gap-3">
                              {/* Before */}
                              <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-center min-w-[110px] shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">قبل</div>
                                <div className="text-base font-black text-slate-800 tabular-nums" dir="ltr">{Number(reportTxn.fromAmount).toLocaleString()}</div>
                              </div>
                              {/* Delta Arrow */}
                              <div className="flex flex-col items-center gap-1">
                                <div className={`px-3 py-1 rounded-full text-xs font-black tabular-nums shadow-sm ${calculatedDelta >= 0
                                  ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-300'
                                  : 'bg-gradient-to-r from-red-100 to-orange-100 text-red-600 border border-red-300'}`}>
                                  {calculatedDelta >= 0 ? '+' : ''}{Number(calculatedDelta).toLocaleString()}
                                </div>
                                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              </div>
                              {/* After */}
                              <div className={`px-4 py-2.5 rounded-xl border-2 text-center min-w-[110px] shadow-md ${calculatedDelta >= 0
                                ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-400'
                                : 'bg-gradient-to-br from-red-50 via-red-50 to-orange-50 border-red-400'}`}>
                                <div className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${calculatedDelta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>بعد</div>
                                <div className={`text-base font-black tabular-nums ${calculatedDelta >= 0 ? 'text-emerald-900' : 'text-red-700'}`} dir="ltr">{Number(calculatedNewBalance).toLocaleString()}</div>
                              </div>
                            </div>
                          </div>

                          {/* ── Detailed Calculation Steps ── */}
                          <div className="px-4 py-3 space-y-3">
                            {/* Step 1: Profit per pound */}
                            <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-3.5 rounded-xl border border-blue-200">
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[9px] font-black flex-shrink-0 shadow-sm">1</div>
                                <span className="text-xs font-bold text-blue-800">حساب ربح الجنيه</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm text-center min-w-[70px]">
                                  <div className="text-[9px] text-blue-500 font-semibold mb-0.5">الفرق</div>
                                  <div className="text-sm font-black text-slate-900 tabular-nums">{Number(currentDifference).toLocaleString()}</div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <span className="text-white font-black text-xs">÷</span>
                                </div>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm text-center min-w-[70px]">
                                  <div className="text-[9px] text-blue-500 font-semibold mb-0.5">مخازن نهائي</div>
                                  <div className="text-sm font-black text-slate-900 tabular-nums">{Number(currentFinalBalance).toLocaleString()}</div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <span className="text-white font-black text-xs">×</span>
                                </div>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm text-center min-w-[60px]">
                                  <div className="text-[9px] text-purple-500 font-semibold mb-0.5">نسبة {s.name}</div>
                                  <div className="text-sm font-black text-slate-900 tabular-nums">{s.percentage}%</div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <span className="text-white font-black text-xs">=</span>
                                </div>
                                <div className="bg-gradient-to-br from-blue-200 to-indigo-200 px-3 py-1.5 rounded-lg border-2 border-blue-400 shadow-md text-center min-w-[80px]">
                                  <div className="text-[9px] text-blue-700 font-bold mb-0.5">ربح الجنيه</div>
                                  <div className="text-sm font-black text-blue-900 tabular-nums">{(profitPerPound * shareholderPercentage / 100).toFixed(6)}</div>
                                </div>
                              </div>
                            </div>

                            {/* Step 2: Shareholder delta */}
                            <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/40 p-3.5 rounded-xl border border-emerald-200">
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-[9px] font-black flex-shrink-0 shadow-sm">2</div>
                                <span className="text-xs font-bold text-emerald-800">حساب نصيب {s.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm text-center min-w-[70px]">
                                  <div className="text-[9px] text-emerald-500 font-semibold mb-0.5">رصيد {s.name}</div>
                                  <div className="text-sm font-black text-slate-900 tabular-nums">{Number(reportTxn.fromAmount).toLocaleString()}</div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <span className="text-white font-black text-xs">×</span>
                                </div>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm text-center min-w-[70px]">
                                  <div className="text-[9px] text-emerald-500 font-semibold mb-0.5">ربح الجنيه</div>
                                  <div className="text-sm font-black text-slate-900 tabular-nums">{(profitPerPound * shareholderPercentage / 100).toFixed(6)}</div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <span className="text-white font-black text-xs">=</span>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-200 to-green-200 px-3 py-1.5 rounded-lg border-2 border-emerald-400 shadow-md text-center min-w-[80px]">
                                  <div className="text-[9px] text-emerald-700 font-bold mb-0.5">التغيير</div>
                                  <div className="text-sm font-black text-emerald-900 tabular-nums">{(() => {
                                    const formatted = calculatedDelta.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                    return (calculatedDelta >= 0 ? '+' : '') + formatted;
                                  })()}</div>
                                </div>
                              </div>
                            </div>

                            {/* Step 3: Final balance */}
                            <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-3.5 rounded-xl border border-green-200">
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-[9px] font-black flex-shrink-0 shadow-sm">3</div>
                                <span className="text-xs font-bold text-green-800">الرصيد النهائي</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                {(() => {
                                  const newBalance = calculatedNewBalance;
                                  return (
                                    <>
                                      <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm text-center min-w-[70px]">
                                        <div className="text-[9px] text-emerald-500 font-semibold mb-0.5">الرصيد السابق</div>
                                        <div className="text-sm font-black text-slate-900 tabular-nums">{Number(reportTxn.fromAmount).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                                      </div>
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                        <span className="text-white font-black text-xs">{calculatedDelta >= 0 ? '+' : '-'}</span>
                                      </div>
                                      <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm text-center min-w-[70px]">
                                        <div className="text-[9px] text-emerald-500 font-semibold mb-0.5">التغيير</div>
                                        <div className="text-sm font-black text-slate-900 tabular-nums">{Math.abs(calculatedDelta).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                                      </div>
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm flex-shrink-0">
                                        <span className="text-white font-black text-xs">=</span>
                                      </div>
                                      <div className="bg-gradient-to-br from-green-300 to-emerald-300 px-3.5 py-2 rounded-xl border-2 border-green-500 shadow-md text-center min-w-[90px]">
                                        <div className="text-[9px] text-green-800 font-bold mb-0.5">الرصيد الجديد</div>
                                        <div className="text-base font-black text-green-900 tabular-nums">{newBalance.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-6 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
                className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Branch Management Modal */}
        <Dialog open={showBranchManage} onOpenChange={setShowBranchManage}>
          <DialogContent className="max-w-2xl bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
            <DialogHeader className="pb-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <DialogTitle className="text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  إدارة الفروع
                </DialogTitle>
                <DialogDescription className="text-slate-600 mt-1 flex items-center gap-2">
                  <span>أضف أو احذف الفروع.</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${manageBranchesScope === 'global' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    النطاق: {manageBranchesScope === 'global' ? 'عام (قالب)' : 'هذا التقرير فقط'}
                  </span>
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="py-6">
              {/* Branches Section Only */}
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 shadow-lg rounded-xl">
                <CardHeader className="pb-4 border-b border-primary/20">
                  <CardTitle className="flex items-center gap-3 text-lg font-bold text-primary">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    <span>{manageBranchesScope === 'global' ? `الفروع (${globalBranches.length})` : `الفروع (${branches.length})`}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {(manageBranchesScope === 'global' ? globalBranches : branches).map((b, i) => (
                    <div key={i} className="flex gap-3 items-center p-3 bg-white rounded-lg border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                      <Input
                        value={b}
                        onChange={e => {
                          const inputValue = e.target.value;
                          if (validateTextInput(inputValue)) {
                            if (manageBranchesScope === 'global') {
                              setGlobalBranches(prev => prev.map((x, idx) => idx === i ? inputValue : x));
                            } else {
                              setBranches(prev => prev.map((x, idx) => idx === i ? inputValue : x));
                            }
                          }
                        }}
                        onBlur={e => {
                          // Remove extra spaces and ensure not empty
                          const trimmedValue = e.target.value.trim();
                          if (trimmedValue.length === 0) {
                            if (manageBranchesScope === 'global') {
                              setGlobalBranches(prev => prev.map((x, idx) => idx === i ? 'فرع جديد' : x));
                            } else {
                              setBranches(prev => prev.map((x, idx) => idx === i ? 'فرع جديد' : x));
                            }
                          } else {
                            if (manageBranchesScope === 'global') {
                              setGlobalBranches(prev => prev.map((x, idx) => idx === i ? trimmedValue : x));
                            } else {
                              setBranches(prev => prev.map((x, idx) => idx === i ? trimmedValue : x));
                            }
                          }
                        }}
                        className="flex-1 bg-white border-primary/30 focus:border-primary focus:ring-primary/20"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          // Check if branch has any values before deletion
                          const branchData = branchRows.find(row => row.name === b);
                          const hasValues = branchData && Object.values(branchData.values).some(val => Number(val) > 0);

                          if (hasValues && manageBranchesScope === 'report') {
                            const confirmed = confirm(`تحذير: الفرع "${b}" يحتوي على قيم محفوظة. هل أنت متأكد من حذفه؟`);
                            if (!confirmed) return;
                          }

                          if (manageBranchesScope === 'global') {
                            setGlobalBranches(prev => prev.filter((_, idx) => idx !== i));
                          } else {
                            setBranches(prev => prev.filter((_, idx) => idx !== i));
                          }
                        }}
                        className="bg-red-500 hover:bg-red-600 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (manageBranchesScope === 'global') {
                        const name = prompt('اسم الفرع الجديد:');
                        if (!name) return;
                        const trimmedName = name.trim();
                        if (!trimmedName || !validateTextInput(trimmedName)) {
                          toast({ title: fixText('خطأ'), description: fixText('اسم الفرع غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.'), variant: 'destructive' });
                          return;
                        }
                        if (globalBranches.includes(trimmedName)) {
                          toast({ title: fixText('تنبيه'), description: fixText('هذا الفرع موجود بالفعل.') });
                          return;
                        }
                        setGlobalBranches(prev => [...prev, trimmedName]);
                      } else {
                        addBranch();
                      }
                    }}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white border-0 shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    إضافة فرع
                  </Button>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="pt-6 border-t border-slate-200">
              <Button
                onClick={() => setShowBranchManage(false)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                تم الحفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Profit Wizard Modal */}
        <Dialog open={showWizard} onOpenChange={(o) => {
          setShowWizard(o);
          if (!o) {
            // Save draft state when closing
            if (wizardStep > 0 && !showResults) {
              setHasDraftInProgress(true);
              setDraftStep(wizardStep);
            }
          }
        }}>
          <DialogContent className="max-w-7xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              {wizardStep === 5 && showResults ? (
                <>
                  <DialogTitle>النتيجة النهائية</DialogTitle>
                  <DialogDescription>تم توليد الملخص. يمكنك تعديل القيم أو عرض التقرير.</DialogDescription>
                </>
              ) : (
                <>
                  <DialogTitle>إنشاء تقرير أرباح</DialogTitle>
                  <DialogDescription>اتبع الخطوات لإدخال البيانات وسيتم توليد الملخص تلقائيًا.</DialogDescription>
                </>
              )}
            </DialogHeader>

            {/* Stepper */}
            {!(wizardStep === 5 && showResults) && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-800">خطوات إنشاء التقرير</h3>
                  <div className="text-sm font-medium text-slate-600">
                    الخطوة {currentStepIndex + 1} من {totalWizardSteps}
                  </div>
                </div>
                <div className="relative" dir="rtl">
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
                  <div
                    className="absolute top-1/2 right-0 h-1 bg-gradient-to-l from-green-500 to-emerald-500 -translate-y-1/2 z-10 transition-all duration-500 ease-in-out"
                    style={{ width: `${wizardProgress}%` }}
                  ></div>
                  <div className="flex justify-between relative z-20">
                    {wizardStepsConfig.map((step, index) => {
                      const isActive = index === currentStepIndex;
                      const isCompleted = index < currentStepIndex;
                      const isClickable = index <= currentStepIndex;
                      return (
                        <div key={step.value} className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => { if (isClickable) setWizardStep(step.value); }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isActive
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg transform scale-110'
                              : isCompleted
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg hover:scale-105'
                                : 'bg-white border-2 border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500'
                              } ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            title={isClickable ? 'الانتقال إلى هذه الخطوة' : 'أكمل الخطوات السابقة أولاً'}
                            disabled={!isClickable}
                          >
                            {isCompleted ? (
                              <CheckIcon className="w-5 h-5" />
                            ) : (
                              <span className="font-bold">{index + 1}</span>
                            )}
                          </button>
                          <div className="mt-2 text-xs text-center max-w-[100px] font-medium text-primary">
                            {step.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Steps Content */}
            <div className="space-y-6">
              {/* Step 1: period + last month source + manage lists */}
              {wizardStep === 0 && (
                <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-2xl">
                  <CardHeader className="pb-4 border-b border-slate-200">
                    <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                        <CalendarIcon className="w-4 h-4 text-white" />
                      </div>
                      تحديد الفترة الزمنية
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      اختر تاريخ بداية ونهاية الفترة التي تريد تحليل أرباحها
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Report Name Input */}
                    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <Label className="text-sm font-bold text-blue-900 mb-2 block">اسم التقرير *</Label>
                      <div className="relative">
                        <Input
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                          placeholder="مثال: تقرير أرباح يناير 2025"
                          className="bg-white text-lg pr-12"
                        />
                        {range?.from && range?.to && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-blue-100"
                            onClick={() => {
                              const monthNames = [
                                'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                                'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                              ];
                              const month = range.from.getMonth();
                              const year = range.from.getFullYear();
                              const suggestedName = `تقرير أرباح ${monthNames[month]} ${year}`;
                              setReportName(suggestedName);
                            }}
                            title="تسمية تلقائية حسب الفترة المحددة"
                          >
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        سيظهر هذا الاسم في جميع الصفحات والتقارير
                        {range?.from && range?.to && (
                          <span className="block mt-1">💡 اضغط على الأيقونة للتسمية التلقائية حسب الفترة</span>
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Period Selection */}
                      <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-5 border border-primary/20">
                        <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5" />
                          تحديد الفترة
                        </h3>
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setShowFromPicker(true)}
                              className="bg-white hover:bg-slate-50 border-slate-300"
                            >
                              اختر تاريخ البداية
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowToPicker(true)}
                              className="bg-white hover:bg-slate-50 border-slate-300"
                            >
                              اختر تاريخ النهاية
                            </Button>
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-300 px-3 py-2">
                              <CalendarIcon className="w-4 h-4 text-slate-500" />
                              <select
                                className="bg-transparent border-none outline-none text-sm"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [year, month] = e.target.value.split('-');
                                    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
                                    const lastDay = new Date(parseInt(year), parseInt(month), 0);
                                    setRange({ from: firstDay, to: lastDay });

                                    // Auto-suggest report name
                                    const monthNames = [
                                      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                                    ];
                                    const suggestedName = `تقرير أرباح ${monthNames[parseInt(month) - 1]} ${year}`;
                                    if (!reportName.trim()) {
                                      setReportName(suggestedName);
                                    }
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">اختر شهر</option>
                                {Array.from({ length: 12 }, (_, i) => {
                                  const currentYear = new Date().getFullYear();
                                  const month = i + 1;
                                  const monthNames = [
                                    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                                  ];
                                  return (
                                    <option key={month} value={`${currentYear}-${month.toString().padStart(2, '0')}`}>
                                      {monthNames[i]} {currentYear}
                                    </option>
                                  );
                                })}
                                {/* Previous year months */}
                                {Array.from({ length: 12 }, (_, i) => {
                                  const previousYear = new Date().getFullYear() - 1;
                                  const month = i + 1;
                                  const monthNames = [
                                    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                                  ];
                                  return (
                                    <option key={`${previousYear}-${month}`} value={`${previousYear}-${month.toString().padStart(2, '0')}`}>
                                      {monthNames[i]} {previousYear}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                          <div className="text-sm text-primary p-3 bg-white rounded-lg border border-slate-200">
                            <div className="font-medium mb-1">الفترة المحددة:</div>
                            <div>
                              {range?.from ? `من: ${new Date(range.from).toLocaleDateString('ar-EG')}` : 'من: —'}
                              <br />
                              {range?.to ? `إلى: ${new Date(range.to).toLocaleDateString('ar-EG')}` : 'إلى: —'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Last Month Source (replaces quick selection) */}
                      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200">
                        <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          مصدر مخازن الشهر الماضي
                        </h3>
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <Button
                              variant={source === 'manual' ? 'default' : 'outline'}
                              onClick={() => { setSource('manual'); setManualLastMonthValue(true); }}
                              className={source === 'manual' ? 'bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white' : ''}
                            >
                              قيمة ثابتة (الشهر الماضي)
                            </Button>
                            <Button
                              variant={source === 'report' ? 'default' : 'outline'}
                              onClick={() => { setSource('report'); setManualLastMonthValue(false); }}
                              className={source === 'report' ? 'bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white' : ''}
                            >
                              من تقرير محفوظ
                            </Button>
                          </div>
                          {source === 'manual' && (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-200">
                              <Label className="min-w-32">الرصيد النهائي (الشهر الماضي)</Label>
                              <Input
                                type="text"
                                value={formatNumber(lastMonthClosing)}
                                onChange={(e) => {
                                  const v = e.target.value; if (!validateNumericInput(v)) return; const n = sanitizeNumericValue(v);
                                  setManualLastMonthValue(true);
                                  setLastMonthClosing(n);
                                }}
                                placeholder="0"
                                className="max-w-[180px] text-center"
                              />
                            </div>
                          )}
                          {source === 'report' && (
                            <div className="space-y-3">
                              {/* Base Value + Shareholders Total Cards */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Editable Base Value Card */}
                                <div className="group relative bg-gradient-to-br from-teal-50/80 via-emerald-50/60 to-cyan-50/40 rounded-2xl p-4 border border-teal-200/80 hover:border-teal-300 hover:shadow-xl transition-all duration-300 flex flex-col">
                                  {/* Decorative corner accent */}
                                  <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-teal-200/30 to-transparent rounded-tl-2xl rounded-br-[48px] pointer-events-none" />

                                  <div className="relative flex items-center gap-2.5 mb-2.5">
                                    <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
                                      <Wallet className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-teal-800 tracking-tight">القيمة الأساسية</div>
                                      <div className="text-[10px] text-teal-600/80 font-medium">رأس المال الثابت</div>
                                    </div>
                                  </div>

                                  <div className="flex-1 flex flex-col justify-center">
                                    {showBaseEditor ? (
                                      <div className="flex items-center gap-2.5">
                                        <Input
                                          type="text"
                                          value={formatNumber(baseClosingValue)}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (!validateNumericInput(v)) return;
                                            const n = sanitizeNumericValue(v);
                                            setBaseClosingValue(n);
                                            const shareholdersTotal = shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0);
                                            setLastMonthClosing(n + shareholdersTotal);
                                          }}
                                          className="text-center font-bold text-lg bg-white/90 border-teal-300 focus:border-teal-500 focus:ring-teal-200 rounded-xl h-10"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => setShowBaseEditor(false)}
                                          className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 w-10 p-0 shadow-md"
                                        >
                                          <Check className="w-5 h-5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="text-2xl font-black text-teal-900 tabular-nums tracking-tight" dir="ltr">
                                        {Number(baseClosingValue || 0).toLocaleString()}
                                      </div>
                                    )}
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowBaseEditor(!showBaseEditor)}
                                    className="mt-2.5 text-teal-700 border-teal-300/80 hover:bg-teal-100/60 hover:border-teal-400 text-xs h-8 w-full rounded-xl font-semibold transition-all duration-200"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 ml-1.5" />
                                    {showBaseEditor ? 'إغلاق' : 'تعديل القيمة'}
                                  </Button>
                                </div>

                                {/* Shareholders Total Card */}
                                <div className="group relative bg-gradient-to-br from-violet-50/80 via-purple-50/60 to-fuchsia-50/40 rounded-2xl p-4 border border-violet-200/80 hover:border-violet-300 hover:shadow-xl transition-all duration-300 flex flex-col">
                                  {/* Decorative corner accent */}
                                  <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-violet-200/30 to-transparent rounded-tl-2xl rounded-br-[48px] pointer-events-none" />

                                  <div className="relative flex items-center gap-2.5 mb-2.5">
                                    <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
                                      <Users className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-violet-800 tracking-tight">أرصدة الشركاء</div>
                                      <div className="text-[10px] text-violet-600/80 font-medium">إجمالي {shareholders.length} شريك</div>
                                    </div>
                                  </div>

                                  <div className="flex-1 flex flex-col justify-center">
                                    {showShareholdersEditor ? (
                                      <div className="flex items-center gap-2.5">
                                        <Input
                                          type="text"
                                          value={formatNumber(shareholdersOverride ?? shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0))}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (!validateNumericInput(v)) return;
                                            const n = sanitizeNumericValue(v);
                                            setShareholdersOverride(n);
                                            setLastMonthClosing(baseClosingValue + n);
                                          }}
                                          className="text-center font-bold text-lg bg-white/90 border-violet-300 focus:border-violet-500 focus:ring-violet-200 rounded-xl h-10"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => setShowShareholdersEditor(false)}
                                          className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 w-10 p-0 shadow-md"
                                        >
                                          <Check className="w-5 h-5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="text-2xl font-black text-violet-900 tabular-nums tracking-tight" dir="ltr">
                                        {Number(shareholdersOverride ?? shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0)).toLocaleString()}
                                        {shareholdersOverride !== null && (
                                          <span className="text-xs font-semibold text-amber-600 mr-2 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">(معدّل)</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-2.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setShowShareholdersBreakdown(!showShareholdersBreakdown)}
                                      className="text-violet-700 border-violet-300/80 hover:bg-violet-100/60 hover:border-violet-400 text-xs h-8 flex-1 rounded-xl font-semibold transition-all duration-200"
                                    >
                                      <Eye className="w-3.5 h-3.5 ml-1.5" />
                                      {showShareholdersBreakdown ? 'إخفاء' : 'التفاصيل'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setShowShareholdersEditor(!showShareholdersEditor)}
                                      className="text-violet-700 border-violet-300/80 hover:bg-violet-100/60 hover:border-violet-400 text-xs h-8 flex-1 rounded-xl font-semibold transition-all duration-200"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 ml-1.5" />
                                      تعديل القيمة
                                    </Button>
                                  </div>

                                  {/* Shareholders Breakdown */}
                                  {showShareholdersBreakdown && (
                                    <div className="mt-4 pt-4 border-t border-violet-200/80 space-y-2 animate-fade-in">
                                      <div className="text-xs font-bold text-violet-700 mb-2.5 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                        تفاصيل أرصدة الشركاء
                                      </div>
                                      {shareholders.length === 0 ? (
                                        <div className="text-xs text-slate-500 text-center py-3">لا يوجد شركاء</div>
                                      ) : (
                                        shareholders.map((sh, idx) => (
                                          <div key={sh.id} className="flex items-center justify-between bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-2.5 text-sm border border-violet-100/60 hover:border-violet-200 transition-colors">
                                            <span className="font-semibold text-violet-800">{sh.name}</span>
                                            <span className="font-bold text-violet-700 tabular-nums" dir="ltr">{Number(sh.amount || 0).toLocaleString()}</span>
                                          </div>
                                        ))
                                      )}
                                      <div className="flex items-center justify-between bg-violet-100/80 rounded-xl px-3.5 py-2.5 text-sm font-bold border border-violet-300/60">
                                        <span className="text-violet-800">المجموع المحسوب</span>
                                        <span className="text-violet-900 tabular-nums" dir="ltr">{Number(shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0)).toLocaleString()}</span>
                                      </div>
                                      {shareholdersOverride !== null && (
                                        <div className="flex items-center justify-between bg-amber-50/80 rounded-xl px-3.5 py-2.5 text-sm border border-amber-200/60">
                                          <span className="text-amber-800 font-semibold">القيمة المعدّلة يدوياً</span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-amber-900 tabular-nums" dir="ltr">{Number(shareholdersOverride).toLocaleString()}</span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => {
                                                setShareholdersOverride(null);
                                                const calculated = shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0);
                                                setLastMonthClosing(baseClosingValue + calculated);
                                              }}
                                              className="h-7 px-2.5 text-xs text-amber-700 hover:bg-amber-200/60 rounded-lg font-semibold"
                                            >
                                              إلغاء التعديل
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Final Calculation Summary */}
                              <div className="relative bg-gradient-to-br from-emerald-50/80 via-green-50/60 to-teal-50/40 rounded-2xl p-3.5 border border-emerald-200/80 overflow-hidden">
                                {/* Decorative background pattern */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                                <div className="relative flex items-center gap-2 mb-2.5">
                                  <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-green-600 rounded-md flex items-center justify-center shadow-sm">
                                    <Calculator className="w-3.5 h-3.5 text-white" />
                                  </div>
                                  <span className="text-xs font-bold text-emerald-800">الإجمالي (الشهر الماضي)</span>
                                </div>

                                <div className="relative flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
                                  {/* Base Value Chip */}
                                  <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-teal-200/80 shadow-sm text-center min-w-[120px] hover:shadow-md transition-shadow duration-200">
                                    <div className="text-[10px] font-semibold text-teal-600 mb-0.5">القيمة الأساسية</div>
                                    <div className="text-base font-black text-teal-800 tabular-nums" dir="ltr">{Number(baseClosingValue || 0).toLocaleString()}</div>
                                  </div>

                                  {/* Plus Operator */}
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white font-black text-sm leading-none">+</span>
                                  </div>

                                  {/* Shareholders Chip */}
                                  <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-violet-200/80 shadow-sm text-center min-w-[120px] hover:shadow-md transition-shadow duration-200">
                                    <div className="text-[10px] font-semibold text-violet-600 mb-0.5">
                                      أرصدة الشركاء
                                      {shareholdersOverride !== null && <span className="text-amber-500 mr-1">(معدّل)</span>}
                                    </div>
                                    <div className="text-base font-black text-violet-800 tabular-nums" dir="ltr">{Number(shareholdersOverride ?? shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0)).toLocaleString()}</div>
                                  </div>

                                  {/* Equals Operator */}
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white font-black text-sm leading-none">=</span>
                                  </div>

                                  {/* Total Chip (Accented) */}
                                  <div className="bg-gradient-to-br from-emerald-100 to-green-100 px-5 py-2 rounded-xl border-2 border-emerald-400/80 shadow-lg text-center min-w-[140px] relative">
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                                    <div className="text-[10px] font-bold text-emerald-700 mb-0.5">الإجمالي</div>
                                    <div className="text-lg font-black text-emerald-900 tabular-nums" dir="ltr">{Number(baseClosingValue + (shareholdersOverride ?? shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0))).toLocaleString()}</div>
                                  </div>
                                </div>

                                {/* Auto-update lastMonthClosing when values change */}
                                {(() => {
                                  const shareholdersTotal = shareholdersOverride ?? shareholders.reduce((sum, sh) => sum + Number(sh.amount || 0), 0);
                                  const total = baseClosingValue + shareholdersTotal;
                                  if (lastMonthClosing !== total && !manualLastMonthValue) {
                                    setTimeout(() => setLastMonthClosing(total), 0);
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manage Lists Shortcuts */}
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setManageBranchesScope('report'); setShowBranchManage(true); }}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-primary flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                إدارة الفروع
                              </div>
                              <div className="text-xs text-primary mt-1">تحرير قائمة الفروع لهذا التقرير</div>
                            </div>
                            <Button size="sm" variant="outline">تحرير</Button>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setManageExpensesScope('report'); setShowManage(true); }}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-primary flex items-center gap-2">
                                <PieChart className="w-4 h-4" />
                                إدارة المصروفات
                              </div>
                              <div className="text-xs text-primary mt-1">تحرير قائمة المصروفات لهذا التقرير</div>
                            </div>
                            <Button size="sm" variant="outline">تحرير</Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation Buttons (only for step 0) */}
              {wizardStep === 0 && (
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowWizard(false)}
                    className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  >
                    إلغاء
                  </Button>
                  <div className="flex gap-2">
                    <Button onClick={() => setWizardStep(1)} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                      الخطوة التالية
                      <ChevronLeft className="w-4 h-4 mr-2" />
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <Fragment>
                  <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-2xl">
                    <CardHeader className="pb-4 border-b border-slate-200">
                      <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        المخازن
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        أدخل مخزن كل فرع في بداية الفترة
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-right font-bold text-primary">الفرع</th>
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">المخازن</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branches.map((b, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="border p-3 font-semibold text-right">{b}</td>
                                <td className="border p-3 text-center">
                                  <Input
                                    type="text"
                                    value={formatNumber(Number(branchRows[i]?.values['مخازن'] || 0))}
                                    onChange={e => {
                                      const inputValue = e.target.value; if (!validateNumericInput(inputValue)) return;
                                      const n = parseNumber(inputValue);
                                      setBranchRows(prev => prev.map((x, idx) => idx === i ? { ...x, values: { ...x.values, ['مخازن']: n } } : x));
                                    }}
                                    className="bg-white border-slate-300 focus:border-primary focus:ring-primary/20 text-center"
                                  />
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gradient-to-r from-primary/5 to-secondary/5">
                              <td className="border p-3 font-bold text-right text-primary">الإجمالي</td>
                              <td className="border p-3 text-center font-bold text-primary">
                                {Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-2 justify-end mt-4">
                    <Button
                      onClick={() => setWizardStep(0)}
                      variant="outline"
                    >
                      الخطوة السابقة
                    </Button>
                    <Button
                      onClick={() => setWizardStep(2)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      الخطوة التالية
                    </Button>
                  </div>
                </Fragment>
              )}

              {wizardStep === 2 && (
                <Fragment>
                  <div className="space-y-6">
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
                                    {branches.map((branch, branchIdx) => (
                                      <td key={`${expenseIdx}-${branchIdx}`} className="border border-blue-200 p-3 text-center">
                                        <Input
                                          type="text"
                                          value={formatNumber(Number(branchRows[branchIdx]?.values[expense] || 0))}
                                          onChange={ev => {
                                            const inputValue = ev.target.value; if (!validateNumericInput(inputValue)) return;
                                            const n = parseNumber(inputValue);
                                            setBranchRows(prev => prev.map((x, idx) => idx === branchIdx ? { ...x, values: { ...x.values, [expense]: n } } : x));
                                          }}
                                          className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500/20 text-center w-full"
                                        />
                                      </td>
                                    ))}
                                    <td className="border border-blue-200 p-3 text-center font-bold text-blue-800">
                                      {branches.reduce((sum, branch, branchIdx) => sum + Number(branchRows[branchIdx]?.values[expense] || 0), 0).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                                  <td className="border border-blue-300 p-3 font-bold text-right text-blue-800">الإجمالي</td>
                                  {branches.map((branch, branchIdx) => (
                                    <td key={branchIdx} className="border border-blue-300 p-3 text-center font-bold text-blue-800">
                                      {expenses
                                        .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                                        .reduce((sum, expense) => sum + Number(branchRows[branchIdx]?.values[expense] || 0), 0)
                                        .toLocaleString()}
                                    </td>
                                  ))}
                                  <td className="border border-blue-300 p-3 text-center font-bold text-blue-800">
                                    {expenses
                                      .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                                      .reduce((sum, expense) => sum + branches.reduce((branchSum, branch, branchIdx) => branchSum + Number(branchRows[branchIdx]?.values[expense] || 0), 0), 0)
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
                                    {branches.map((branch, branchIdx) => (
                                      <td key={`${expenseIdx}-${branchIdx}`} className="border p-3 text-center">
                                        <Input
                                          type="text"
                                          value={formatNumber(Number(branchRows[branchIdx]?.values[expense] || 0))}
                                          onChange={ev => {
                                            const inputValue = ev.target.value; if (!validateNumericInput(inputValue)) return;
                                            const n = parseNumber(inputValue);
                                            setBranchRows(prev => prev.map((x, idx) => idx === branchIdx ? { ...x, values: { ...x.values, [expense]: n } } : x));
                                          }}
                                          className="bg-white border-primary/30 focus:border-primary focus:ring-primary/20 text-center w-full"
                                        />
                                      </td>
                                    ))}
                                    <td className="border p-3 text-center font-bold text-primary">
                                      {branches.reduce((sum, branch, branchIdx) => sum + Number(branchRows[branchIdx]?.values[expense] || 0), 0).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-gradient-to-r from-primary/5 to-secondary/5">
                                  <td className="border p-3 font-bold text-right text-primary">الإجمالي</td>
                                  {branches.map((branch, branchIdx) => (
                                    <td key={branchIdx} className="border p-3 text-center font-bold text-primary">
                                      {expenses
                                        .filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                                        .reduce((sum, expense) => sum + Number(branchRows[branchIdx]?.values[expense] || 0), 0)
                                        .toLocaleString()}
                                    </td>
                                  ))}
                                  <td className="border p-3 text-center font-bold text-primary">
                                    {totals.totalExpenses.toLocaleString()}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  </div>

                  <div className="flex items-center gap-2 justify-end mt-4">
                    <Button
                      onClick={() => setWizardStep(1)}
                      variant="outline"
                    >
                      الخطوة السابقة
                    </Button>
                    <Button
                      onClick={() => setWizardStep(3)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      الخطوة التالية
                    </Button>
                  </div>
                </Fragment>
              )}

              {wizardStep === 3 && (
                <Fragment>
                  <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-2xl">
                    <CardHeader className="pb-4 border-b border-slate-200">
                      <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-white" />
                        </div>
                        الدرج والديون
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        أدخل الدرج والديون لكل فرع
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-right font-bold text-primary">البند \ الفرع</th>
                              {branches.map((branch, idx) => (
                                <th key={idx} className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">{branch}</th>
                              ))}
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* الدرج Row */}
                            <tr className="bg-white">
                              <td className="border p-3 font-semibold text-right">الدرج</td>
                              {branches.map((branch, branchIdx) => (
                                <td key={branchIdx} className="border p-3 text-center">
                                  <input
                                    type="text"
                                    defaultValue={Number(branchRows[branchIdx]?.values['كاش الدرج'] || 0) === 0 ? '' : Number(branchRows[branchIdx]?.values['كاش الدرج'] || 0).toLocaleString('en-US')}
                                    key={`drawer-${branchIdx}`}
                                    onChange={e => {
                                      const inputValue = e.target.value;
                                      if (!validateNumericInputWithNegative(inputValue)) return;
                                      const n = parseNumber(inputValue);
                                      setBranchRows(prev => prev.map((x, idx) => idx === branchIdx ? { ...x, values: { ...x.values, ['كاش الدرج']: n } } : x));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center"
                                  />
                                </td>
                              ))}
                              <td className="border p-3 text-center font-bold text-primary">
                                {branches.reduce((sum, b, i) => sum + Number(branchRows[i]?.values['كاش الدرج'] || 0), 0).toLocaleString()}
                              </td>
                            </tr>

                            {/* ديون ليه Row */}
                            <tr className="bg-slate-50">
                              <td className="border p-3 font-semibold text-right">ديون ليه</td>
                              {branches.map((branch, branchIdx) => (
                                <td key={branchIdx} className="border p-3 text-center">
                                  <input
                                    type="text"
                                    defaultValue={Number(branchRows[branchIdx]?.values['ديون ليه'] || 0) === 0 ? '' : Number(branchRows[branchIdx]?.values['ديون ليه'] || 0).toLocaleString('en-US')}
                                    key={`debt-for-${branchIdx}`}
                                    onChange={e => {
                                      const inputValue = e.target.value;
                                      if (!validateNumericInputWithNegative(inputValue)) return;
                                      const n = parseNumber(inputValue);
                                      setBranchRows(prev => prev.map((x, idx) => idx === branchIdx ? { ...x, values: { ...x.values, ['ديون ليه']: n } } : x));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center"
                                  />
                                </td>
                              ))}
                              <td className="border p-3 text-center font-bold text-primary">
                                {branches.reduce((sum, b, i) => sum + Number(branchRows[i]?.values['ديون ليه'] || 0), 0).toLocaleString()}
                              </td>
                            </tr>

                            {/* ديون عليه Row */}
                            <tr className="bg-white">
                              <td className="border p-3 font-semibold text-right">ديون عليه</td>
                              {branches.map((branch, branchIdx) => (
                                <td key={branchIdx} className="border p-3 text-center">
                                  <input
                                    type="text"
                                    defaultValue={Number(branchRows[branchIdx]?.values['ديون عليه'] || 0) === 0 ? '' : Number(branchRows[branchIdx]?.values['ديون عليه'] || 0).toLocaleString('en-US')}
                                    key={`debt-against-${branchIdx}`}
                                    onChange={e => {
                                      const inputValue = e.target.value;
                                      if (!validateNumericInputWithNegative(inputValue)) return;
                                      const n = parseNumber(inputValue);
                                      setBranchRows(prev => prev.map((x, idx) => idx === branchIdx ? { ...x, values: { ...x.values, ['ديون عليه']: n } } : x));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-primary/30 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-center"
                                  />
                                </td>
                              ))}
                              <td className="border p-3 text-center font-bold text-primary">
                                {branches.reduce((sum, b, i) => sum + Number(branchRows[i]?.values['ديون عليه'] || 0), 0).toLocaleString()}
                              </td>
                            </tr>

                            {/* Total Row */}
                            <tr className="bg-gradient-to-r from-green-50 to-emerald-50">
                              <td className="border p-3 font-bold text-right text-green-800">الإجمالي</td>
                              {branches.map((branch, branchIdx) => {
                                const drawer = Number(branchRows[branchIdx]?.values['كاش الدرج'] || 0);
                                const debtsFor = Number(branchRows[branchIdx]?.values['ديون ليه'] || 0);
                                const debtsAgainst = Number(branchRows[branchIdx]?.values['ديون عليه'] || 0);
                                const total = drawer + debtsFor - debtsAgainst;
                                return (
                                  <td key={branchIdx} className="border p-3 text-center font-bold text-green-800">
                                    {total.toLocaleString()}
                                  </td>
                                );
                              })}
                              <td className="border p-3 text-center font-bold text-green-800">
                                {branches.reduce((sum, b, i) => {
                                  const drawer = Number(branchRows[i]?.values['كاش الدرج'] || 0);
                                  const debtsFor = Number(branchRows[i]?.values['ديون ليه'] || 0);
                                  const debtsAgainst = Number(branchRows[i]?.values['ديون عليه'] || 0);
                                  return sum + drawer + debtsFor - debtsAgainst;
                                }, 0).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-2 justify-end mt-4">
                    <Button
                      onClick={() => setWizardStep(2)}
                      variant="outline"
                    >
                      الخطوة السابقة
                    </Button>
                    <Button
                      onClick={() => setWizardStep(4)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 to-emerald-700 text-white"
                    >
                      الخطوة التالية
                    </Button>
                  </div>
                </Fragment>
              )}

              {wizardStep === 4 && (
                <Fragment>
                  <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/50 shadow-lg rounded-2xl">
                    <CardHeader className="pb-4 border-b border-slate-200">
                      <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-white" />
                        </div>
                        الكاش
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        أدخل كاش كل فرع
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-right font-bold text-primary">البند</th>
                              <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">القيمة</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-blue-50">
                              <td className="border p-3 font-semibold text-right">
                                المصروفات من حساب المحل
                                <span className="text-xs text-blue-600 block mt-1">(محسوب تلقائياً من المصروفات الشخصية)</span>
                              </td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(Number(cashBreakdown.outletExpenses || 0))}
                                  readOnly
                                  disabled
                                  className="bg-blue-100 border-blue-300 text-center cursor-not-allowed"
                                />
                              </td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border p-3 font-semibold text-right">المنزل</td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(Number(cashBreakdown.home || 0))}
                                  onChange={e => { const v = e.target.value; if (!validateNumericInput(v)) return; setCashBreakdown(prev => ({ ...prev, home: parseNumber(v) })); }}
                                  className="bg-white border-primary/30 focus:border-primary focus:ring-primary/20 text-center"
                                />
                              </td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border p-3 font-semibold text-right">البنك</td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(Number(cashBreakdown.bank || 0))}
                                  onChange={e => { const v = e.target.value; if (!validateNumericInput(v)) return; setCashBreakdown(prev => ({ ...prev, bank: parseNumber(v) })); }}
                                  className="bg-white border-primary/30 focus:border-primary focus:ring-primary/20 text-center"
                                />
                              </td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border p-3 font-semibold text-right">
                                الدرج
                                <span className="text-xs text-blue-600 block mt-1">(محسوب تلقائياً من الدرج والديون)</span>
                              </td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(Number(cashBreakdown.drawer || 0))}
                                  readOnly
                                  disabled
                                  className="bg-blue-100 cursor-not-allowed text-center"
                                />
                              </td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border p-3 font-semibold text-right">فودافون</td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(Number(cashBreakdown.vodafone || 0))}
                                  onChange={e => { const v = e.target.value; if (!validateNumericInput(v)) return; setCashBreakdown(prev => ({ ...prev, vodafone: parseNumber(v) })); }}
                                  className="bg-white border-primary/30 focus:border-primary focus:ring-primary/20 text-center"
                                />
                              </td>
                            </tr>
                            {/* Custom Cash Rows */}
                            {(cashBreakdown.customRows || []).map((row, index) => (
                              <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="border p-3 font-semibold text-right">
                                  <div className="flex items-center justify-between">
                                    <span>{row.description}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeCustomCashRow(row.id)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                                <td className="border p-3 text-center">
                                  <Input
                                    type="text"
                                    value={formatNumber(Number(row.amount || 0))}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (!validateNumericInput(v)) return;
                                      updateCustomCashRow(row.id, parseNumber(v));
                                    }}
                                    className="bg-white border-primary/30 focus:border-primary focus:ring-primary/20 text-center"
                                  />
                                </td>
                              </tr>
                            ))}
                            {/* Add Custom Row Button */}
                            <tr className="bg-yellow-50">
                              <td colSpan={2} className="border p-3 text-center">
                                <Button
                                  variant="outline"
                                  onClick={addCustomCashRow}
                                  className="border-dashed border-primary/50 hover:border-primary text-primary hover:bg-primary/5"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  إضافة بند جديد
                                </Button>
                              </td>
                            </tr>
                            <tr className="bg-gradient-to-r from-green-50 to-emerald-50">
                              <td className="border p-3 font-bold text-right text-green-800">الإجمالي</td>
                              <td className="border p-3 text-center font-bold text-green-800">
                                {cashManual.toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-2 justify-end mt-4">
                    <Button
                      onClick={() => setWizardStep(3)}
                      variant="outline"
                    >
                      الخطوة السابقة
                    </Button>
                    <Button
                      onClick={() => {
                        setWizardStep((s) => {
                          const next = Math.min(5, s + 1);
                          // Do not auto-open final results; keep consistent next-step behavior
                          setShowResults(false);
                          return next;
                        });
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      الخطوة التالية
                    </Button>
                  </div>
                </Fragment>
              )}

              {wizardStep === 5 && !showResults && (
                <Fragment>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">أدخل أرباح كل فرع (قبل المصروفات)</h3>
                    <p className="text-sm text-slate-500">أدخل ربح كل فرع قبل طرح المصروفات. سيتم خصم المصروفات لاحقًا لحساب صافي الربح.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-right font-bold text-primary">الفرع</th>
                          <th className="border bg-gradient-to-r from-primary/10 to-secondary/10 p-3 text-center font-bold text-primary">أرباح قبل المصروفات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((b) => {
                          const row = branchRows.find(r => r.name === b);
                          const val = (row?.values['أرباح'] as number) || 0;
                          return (
                            <tr key={b} className="bg-white">
                              <td className="border p-3 font-semibold text-right">{b}</td>
                              <td className="border p-3 text-center">
                                <Input
                                  type="text"
                                  value={formatNumber(val)}
                                  onChange={(e) => { const v = e.target.value; if (!validateNumericInput(v)) return; updateValue(b, 'أرباح' as Expense, parseNumber(v)); }}
                                  className="w-full text-center bg-white border-primary/30 focus:border-primary focus:ring-primary/20"
                                />
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-gradient-to-r from-primary/10 to-secondary/10">
                          <td className="border p-3 font-bold text-right text-primary">الإجمالي</td>
                          <td className="border p-3 text-center font-bold text-primary">{Number(totals.totalProfits || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 text-xs text-slate-600">إجمالي أرباح الفروع: <span className="font-semibold text-primary">{Number(totals.totalProfits || 0).toLocaleString()}</span> — صافي الربح الحالي: <span className="font-semibold text-secondary">{Number(totals.netProfit || 0).toLocaleString()}</span></div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setWizardStep(4)}
                      className="border-slate-300 hover:border-slate-400"
                    >
                      الخطوة السابقة
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (shareholders.length > 0) {
                            setWizardStep(5.5); // Go to shareholder selection
                          } else {
                            setShowResults(true); // Skip if no shareholders
                          }
                        }}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      >
                        {shareholders.length > 0 ? 'التالي: اختيار المساهمين' : 'عرض النتيجة النهائية'}
                      </Button>
                    </div>
                  </div>
                </Fragment>
              )}

              {/* Step 5.5: Shareholder Selection */}
              {wizardStep === 5.5 && (
                <Fragment>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">اختر المساهمين المشمولين في هذا التقرير</h3>
                    <p className="text-sm text-slate-500">حدد المساهمين الذين سيتم توزيع الأرباح عليهم في هذا التقرير. {currentReportId ? 'تم تحميل الاختيارات المحفوظة' : 'الافتراضي: لا أحد محدد'}</p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedShareholders(new Set(shareholders.map(s => s.id)))}
                          className="border-emerald-300 hover:bg-emerald-50"
                        >
                          <Users className="w-4 h-4 ml-1" />
                          تحديد الكل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedShareholders(new Set())}
                          className="border-rose-300 hover:bg-rose-50"
                        >
                          إلغاء الكل
                        </Button>
                      </div>
                      <div className="text-sm text-slate-600">
                        المحدد: <span className="font-bold text-primary">{selectedShareholders.size}</span> من {shareholders.length}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {shareholders.map(shareholder => {
                        const history = shareHistory[shareholder.id] || [];
                        const startingBalance = shareholder.initialAmount ?? (history.length > 0 ? history[0].fromAmount : Number(shareholder.amount));
                        const currentBalance = Number(shareholder.amount);

                        // Calculate new balance after profit distribution
                        const pct = Number(shareholder.percentage || 0);
                        const profitDelta = selectedShareholders.has(shareholder.id)
                          ? currentBalance * perPoundProfitComputed * (pct / 100)
                          : 0;
                        const newBalance = currentBalance + profitDelta;

                        return (
                          <div
                            key={shareholder.id}
                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer ${selectedShareholders.has(shareholder.id)
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            onClick={() => {
                              const newSet = new Set(selectedShareholders);
                              if (newSet.has(shareholder.id)) {
                                newSet.delete(shareholder.id);
                              } else {
                                newSet.add(shareholder.id);
                              }
                              setSelectedShareholders(newSet);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedShareholders.has(shareholder.id)}
                                onChange={() => { }}
                                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-800">{shareholder.name}</div>
                                <div className="text-xs text-slate-500">
                                  الرصيد الحالي: {formatNumber(currentBalance)} | النسبة: {formatNumber(shareholder.percentage)}%
                                </div>
                                {selectedShareholders.has(shareholder.id) && profitDelta > 0 && (
                                  <div className="text-xs text-emerald-600 font-semibold mt-1">
                                    الرصيد الجديد: {formatNumber(newBalance)} (+{formatNumber(profitDelta)})
                                  </div>
                                )}
                              </div>
                            </div>
                            {selectedShareholders.has(shareholder.id) && (
                              <Badge className="bg-emerald-500">محدد</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {selectedShareholders.size === 0 ? (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                        ℹ️ لم يتم اختيار أي مساهم - سيتم إنشاء التقرير بدون توزيع أرباح
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="text-sm font-semibold text-emerald-800 mb-2">ملخص التوزيع المتوقع:</div>
                        <div className="text-xs text-emerald-700 space-y-1">
                          {shareholders
                            .filter(s => selectedShareholders.has(s.id))
                            .map(s => {
                              const currentBalance = Number(s.amount);
                              const pct = Number(s.percentage || 0);
                              const profitDelta = currentBalance * perPoundProfitComputed * (pct / 100);
                              return (
                                <div key={s.id} className="flex justify-between">
                                  <span>{s.name}:</span>
                                  <span className="font-semibold">+{formatNumber(profitDelta)}</span>
                                </div>
                              );
                            })}
                          <div className="border-t border-emerald-300 pt-1 mt-2 flex justify-between font-bold">
                            <span>إجمالي التوزيع:</span>
                            <span>
                              +{formatNumber(
                                shareholders
                                  .filter(s => selectedShareholders.has(s.id))
                                  .reduce((total, s) => {
                                    const currentBalance = Number(s.amount);
                                    const pct = Number(s.percentage || 0);
                                    return total + (currentBalance * perPoundProfitComputed * (pct / 100));
                                  }, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setWizardStep(5)}
                      className="border-slate-300 hover:border-slate-400"
                    >
                      الخطوة السابقة
                    </Button>
                    <Button
                      onClick={() => {
                        setWizardStep(5);
                        setShowResults(true);
                      }}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      عرض النتيجة النهائية
                    </Button>
                  </div>
                </Fragment>
              )}

              {wizardStep === 5 && showResults && (
                <Fragment>
                  {/* Report Header */}
                  <div className="text-center mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <h1 className="text-3xl font-bold text-green-800 mb-2">
                      {reportName || title || 'تقرير الأرباح'}
                    </h1>
                    {title && title !== reportName && (
                      <h2 className="text-xl text-green-600 mb-2">{title}</h2>
                    )}
                    {range?.from && range?.to && (
                      <div className="text-green-700 font-medium">
                        {new Date(range.from).toLocaleDateString('ar-EG')} - {new Date(range.to).toLocaleDateString('ar-EG')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {/* Main Expenses Table */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="bg-slate-600 text-white p-3 text-center font-bold">
                        الفترة الزمنية
                      </div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-300 p-2 text-center font-bold">البند</th>
                            {branches.map((branch, idx) => (
                              <th key={idx} className="border border-slate-300 p-2 text-center font-bold border-r-0">{branch}</th>
                            ))}
                            <th className="border border-slate-300 p-2 text-center font-bold border-r-0">المجموع</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-yellow-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-yellow-200">مخازن</td>
                            {branches.map((branch, idx) => (
                              <td key={idx} className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(branchRows.find(br => br.name === branch)?.values['مخازن'] || 0).toLocaleString()}
                              </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}
                            </td>
                          </tr>

                          {/* Personal Expenses */}
                          {expenses
                            .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                            .filter(expense => {
                              // Hide row if all values are zero
                              const total = Number(totals.sumByExpense?.[expense] || 0);
                              return total > 0;
                            })
                            .map((expense, idx) => (
                              <tr key={expense} className="bg-yellow-50">
                                <td className="border border-slate-300 p-2 text-center bg-yellow-100">{expense}</td>
                                {branches.map((branch, branchIdx) => (
                                  <td key={branchIdx} className="border border-slate-300 p-2 text-center border-r-0">
                                    {Number(branchRows.find(br => br.name === branch)?.values[expense] || 0).toLocaleString()}
                                  </td>
                                ))}
                                <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                                  {Number(totals.sumByExpense?.[expense] || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}

                          {/* Other Expenses */}
                          {expenses
                            .filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                            .filter(expense => {
                              // Hide row if all values are zero
                              const total = Number(totals.sumByExpense?.[expense] || 0);
                              return total > 0;
                            })
                            .map((expense, idx) => (
                              <tr key={expense} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="border border-slate-300 p-2 text-center bg-yellow-100">{expense}</td>
                                {branches.map((branch, branchIdx) => (
                                  <td key={branchIdx} className="border border-slate-300 p-2 text-center border-r-0">
                                    {Number(branchRows.find(br => br.name === branch)?.values[expense] || 0).toLocaleString()}
                                  </td>
                                ))}
                                <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                                  {Number(totals.sumByExpense?.[expense] || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}

                          {/* Cash, Debts, Profits */}
                          <tr className="bg-white">
                            <td className="border border-slate-300 p-2 text-center bg-yellow-100">كاش الدرج</td>
                            {branches.map((branch, idx) => (
                              <td key={idx} className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(branchRows.find(br => br.name === branch)?.values['كاش الدرج'] || 0).toLocaleString()}
                              </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(totals.sumByExpense?.['كاش الدرج'] || 0).toLocaleString()}
                            </td>
                          </tr>

                          <tr className="bg-slate-50">
                            <td className="border border-slate-300 p-2 text-center bg-yellow-100">ديون ليه</td>
                            {branches.map((branch, idx) => (
                              <td key={idx} className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(branchRows.find(br => br.name === branch)?.values['ديون ليه'] || 0).toLocaleString()}
                              </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(totals.sumByExpense?.['ديون ليه'] || 0).toLocaleString()}
                            </td>
                          </tr>

                          <tr className="bg-white">
                            <td className="border border-slate-300 p-2 text-center bg-yellow-100">ديون عليه</td>
                            {branches.map((branch, idx) => (
                              <td key={idx} className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(branchRows.find(br => br.name === branch)?.values['ديون عليه'] || 0).toLocaleString()}
                              </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(totals.sumByExpense?.['ديون عليه'] || 0).toLocaleString()}
                            </td>
                          </tr>

                          <tr className="bg-slate-50">
                            <td className="border border-slate-300 p-2 text-center bg-yellow-100">أرباح</td>
                            {branches.map((branch, idx) => (
                              <td key={idx} className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(branchRows.find(br => br.name === branch)?.values['أرباح'] || 0).toLocaleString()}
                              </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(totals.sumByExpense?.['أرباح'] || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Cash Breakdown Table */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="bg-orange-400 text-white p-3 text-center font-bold">
                        مخازن نهائي
                      </div>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="bg-orange-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-orange-200">مخازن</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-orange-50">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-orange-200">الكاش</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(cashManual || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-orange-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-orange-200">ديون ليه</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(totals.sumByExpense?.['ديون ليه'] || 0).toLocaleString()}
                            </td>
                          </tr>
                          {/* Subtotal before deducting ديون عليه */}
                          <tr className="bg-slate-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-slate-200">المجموع</td>
                            <td className="border border-slate-300 p-2 text-center font-semibold border-r-0">
                              {Number((totals.sumByExpense?.['مخازن'] || 0) + Number(cashManual || 0) + (totals.sumByExpense?.['ديون ليه'] || 0)).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-blue-50">
                            <td className="border border-slate-300 p-2 text-center font-semibold bg-blue-200">ديون عليه</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0 text-red-600">
                              -{Math.abs(Number(totals.sumByExpense?.['ديون عليه'] || 0)).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-green-200">
                            <td className="border border-slate-300 p-2 text-center font-bold">مخازن نهائي</td>
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(correctFinalBalance).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Cash Details Table */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="bg-gray-500 text-white p-3 text-center font-bold">
                        الكاش
                      </div>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="bg-gray-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold">المصروفات من حساب المحل</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(cashBreakdown.outletExpenses || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="border border-slate-300 p-2 text-center font-semibold">بيت</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(cashBreakdown.home || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-gray-100">
                            <td className="border border-slate-300 p-2 text-center font-semibold">بنك</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(cashBreakdown.bank || 0).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="border border-slate-300 p-2 text-center font-semibold">درج</td>
                            <td className="border border-slate-300 p-2 text-center border-r-0">
                              {Number(cashBreakdown.drawer || 0).toLocaleString()}
                            </td>
                          </tr>
                          {/* Explicit Vodafone Row - only show if value > 0 */}
                          {Number(cashBreakdown.vodafone || 0) > 0 && (
                            <tr className="bg-gray-100">
                              <td className="border border-slate-300 p-2 text-center font-semibold">فودافون</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(cashBreakdown.vodafone || 0).toLocaleString()}
                              </td>
                            </tr>
                          )}
                          {/* Custom Cash Rows - filter out any vodafone-related rows */}
                          {(cashBreakdown.customRows || [])
                            .filter(row => {
                              const name = (row.name || '').toLowerCase().trim();
                              const isVodafone = name.includes('vodafone') || name.includes('فودافون') || name === 'فودافون';
                              return !isVodafone && Number(row.amount || 0) > 0;
                            })
                            .map((row, idx) => (
                              <tr key={row.id} className={idx % 2 === 0 ? "bg-gray-100" : "bg-gray-50"}>
                                <td className="border border-slate-300 p-2 text-center font-semibold">{row.name}</td>
                                <td className="border border-slate-300 p-2 text-center border-r-0">
                                  {Number(row.amount || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          <tr className="bg-green-200">
                            <td className="border border-slate-300 p-2 text-center font-bold">المجموع</td>
                            <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                              {Number(cashManual || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Profit Comparison Tables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Previous Month Comparison */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="bg-blue-500 text-white p-3 text-center font-bold">
                          مقارنة بالشهر الماضي
                        </div>
                        <table className="w-full border-collapse">
                          <tbody>
                            <tr className="bg-blue-100">
                              <td className="border border-slate-300 p-2 text-center font-semibold">الشهر الماضي</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(lastMonthClosing || 0).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="bg-blue-50">
                              <td className="border border-slate-300 p-2 text-center font-semibold">الشهر الحالي</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(correctFinalBalance).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="bg-green-200">
                              <td className="border border-slate-300 p-2 text-center font-bold">الفرق</td>
                              <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                                {formatNumberWithParens(Number(compareLastMonth || 0))}
                              </td>
                            </tr>
                            <tr className="bg-blue-100">
                              <td className="border border-slate-300 p-2 text-center font-semibold">المصروفات من حساب المحل</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(cashBreakdown.outletExpenses || 0).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="bg-green-300">
                              <td className="border border-slate-300 p-2 text-center font-bold">الباقي</td>
                              <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                                {formatNumberWithParens(Number(compareLastMonth || 0) - Number(cashBreakdown.outletExpenses || 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Net Profit */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="bg-green-600 text-white p-3 text-center font-bold">
                          صافي الربح (النتيجة)
                        </div>
                        <table className="w-full border-collapse">
                          <tbody>
                            <tr className="bg-green-100">
                              <td className="border border-slate-300 p-2 text-center font-semibold">مصروفات</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(totals.totalExpenses || 0).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="bg-green-50">
                              <td className="border border-slate-300 p-2 text-center font-semibold">أرباح</td>
                              <td className="border border-slate-300 p-2 text-center border-r-0">
                                {Number(totals.totalProfits || 0).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="bg-green-200">
                              <td className="border border-slate-300 p-2 text-center font-bold">صافي الربح</td>
                              <td className="border border-slate-300 p-2 text-center font-bold border-r-0">
                                {formatNumberWithParens(Number(totals.netProfit || 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>


                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setShowResults(false); setWizardStep(0); }}
                    >
                      تعديل من البداية (الخطوة 1)
                    </Button>
                    <Button
                      onClick={() => { setShowWizard(false); setPreviewLayout('a4'); setShowPreview(true); }}
                      className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white"
                    >
                      عرض التقرير
                    </Button>
                    <Button
                      onClick={() => setShowWizard(false)}
                      className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white"
                    >
                      خروج
                    </Button>
                  </div>
                </Fragment>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Delete Report Confirmation Dialog */}
        <Dialog open={!!showDeleteReportId} onOpenChange={(o) => { if (!o) setShowDeleteReportId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>تأكيد حذف التقرير</DialogTitle>
              <DialogDescription>سيتم حذف التقرير نهائيًا بعد 6 ثوانٍ ما لم تتراجع. هل تريد المتابعة؟</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteReportId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => {
                const id = showDeleteReportId; if (!id) return; setShowDeleteReportId(null);
                try {
                  // optimistic UI: remove and schedule
                  setBackupReports(prev => prev ?? reports);
                  reportBackupsRef.current.set(id, reports);
                  setReports(prev => prev.filter(x => x._id !== id));
                  const t = window.setTimeout(async () => {
                    try {
                      const resp = await apiDelete(`/api/profit-reports/${id}`);
                      if (!resp.ok) {
                        const backup = reportBackupsRef.current.get(id) || backupReports || [];
                        setReports(backup);
                        toast({ title: 'فشل الحذف', variant: 'destructive' });
                      } else {
                        toast({ title: 'تم الحذف', description: 'تم حذف التقرير بنجاح.' });
                        refreshReports();
                      }
                    } catch (e) {
                      const backup = reportBackupsRef.current.get(id) || backupReports || [];
                      setReports(backup);
                      toast({ title: 'فشل الحذف', description: (e as Error).message, variant: 'destructive' });
                    } finally {
                      setScheduledReportDeletes(map => { const m = new Map(map); m.delete(id); return m; });
                      reportBackupsRef.current.delete(id);
                      setBackupReports(null);
                    }
                  }, 6000);
                  setScheduledReportDeletes(map => new Map(map).set(id, t));
                  toast({
                    title: 'تم جدولة الحذف',
                    description: (
                      <div>
                        سيتم حذف التقرير خلال 6 ثوانٍ — يمكنك التراجع الآن
                        <DeleteCountdownBar />
                      </div>
                    ),
                    action: (
                      <ToastAction altText="تراجع" onClick={() => {
                        const timer = scheduledReportDeletesRef.current.get(id);
                        if (timer) {
                          window.clearTimeout(timer);
                          setScheduledReportDeletes(map => { const m = new Map(map); m.delete(id); return m; });
                          // undo UI from per-id backup (fallback to global backup)
                          const backup = reportBackupsRef.current.get(id) || backupReports || [];
                          setReports(backup);
                          reportBackupsRef.current.delete(id);
                          setBackupReports(null);
                          toast({ title: 'تم التراجع عن الحذف' });
                        }
                      }}>تراجع</ToastAction>
                    ),
                  });
                } catch (e) {
                  toast({ title: 'تعذر جدولة الحذف', description: (e as Error).message, variant: 'destructive' });
                }
              }}>حذف</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* From Date Picker */}
        <Dialog open={showFromPicker} onOpenChange={setShowFromPicker}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>اختر تاريخ البداية</DialogTitle>
              <DialogDescription>اضغط على اليوم لتحديد بداية الفترة</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={range?.from}
                onSelect={(d) => {
                  if (!d) return;
                  setRange((prev) => {
                    const to = prev?.to && prev.to < d ? d : (prev?.to || d);
                    return { from: d, to } as DateRange;
                  });
                  setShowFromPicker(false);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFromPicker(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* To Date Picker */}
        <Dialog open={showToPicker} onOpenChange={setShowToPicker}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>اختر تاريخ النهاية</DialogTitle>
              <DialogDescription>اضغط على اليوم لتحديد نهاية الفترة</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={range?.to}
                onSelect={(d) => {
                  if (!d) return;
                  setRange((prev) => {
                    const from = prev?.from && d < prev.from ? d : (prev?.from || d);
                    return { from, to: d } as DateRange;
                  });
                  setShowToPicker(false);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowToPicker(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Expense Dialog */}
        <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-primary">إضافة مصروف جديد</DialogTitle>
              <DialogDescription>أدخل اسم المصروف ونوعه</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="expense-name">اسم المصروف</Label>
                <Input
                  id="expense-name"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  placeholder="أدخل اسم المصروف"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>نوع المصروف</Label>
                <RadioGroup value={newExpenseType} onValueChange={(value) => setNewExpenseType(value as ExpenseType)} className="mt-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="cursor-pointer">عادي (يؤثر على الربح)</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="personal" id="personal" />
                    <Label htmlFor="personal" className="cursor-pointer">شخصي (يضاف للكاش)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>إلغاء</Button>
              <Button onClick={handleAddExpense} className="bg-primary hover:bg-primary/90">إضافة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Simple Preview Modal (Old Blocks View) */}
        <Dialog open={showSimplePreview} onOpenChange={setShowSimplePreview}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-slate-900 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {title || 'ملخص الأرباح'}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                عرض مبسط للنتائج
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary Cards - Old Blocks Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div
                  className={`bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 border shadow-sm cursor-pointer hover:shadow-md transition-all relative ${expandedBlock === 'expenses'
                    ? 'border-primary/50 ring-2 ring-primary/20 bg-primary/10'
                    : 'border-primary/20'
                    }`}
                  onClick={() => setExpandedBlock(expandedBlock === 'expenses' ? null : 'expenses')}
                >
                  <div className="text-primary font-semibold mb-1">مصروفات</div>
                  <div className="text-2xl font-bold text-primary">{Number(totals.totalExpenses || 0).toLocaleString('en-US')}</div>
                  <div className="text-xs text-primary mt-1">إجمالي المصروفات</div>
                  {expandedBlock === 'expenses' && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  )}
                  <div className="absolute bottom-2 left-2 text-xs text-primary/60">
                    {expandedBlock === 'expenses' ? '👆 انقر للإغلاق' : '👆 انقر للتفاصيل'}
                  </div>
                </div>

                <div
                  className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedBlock(expandedBlock === 'profits' ? null : 'profits')}
                >
                  <div className="text-green-600 font-semibold mb-1">أرباح</div>
                  <div className="text-lg font-bold text-green-800">إجمالي: {Number(totals.totalProfits || 0).toLocaleString('en-US')}</div>
                  <div className="text-lg font-bold text-green-900 mt-1">صافي: {Number(totals.netProfit || 0).toLocaleString('en-US')}</div>
                  {expandedBlock === 'profits' && (
                    <div className="mt-4 p-4 bg-white/80 rounded-lg border border-green-300 shadow-sm">
                      <div className="font-bold text-sm text-green-700 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        حساب الأرباح
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                          <span className="font-medium text-green-700">إجمالي الأرباح</span>
                          <span className="font-mono font-bold text-green-800">{Number(totals.totalProfits || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded">
                          <span className="font-medium text-red-700">إجمالي المصروفات</span>
                          <span className="font-mono font-bold text-red-800">-{Number(totals.totalExpenses || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-green-200 pt-3">
                          <div className="flex justify-between items-center py-2 px-3 bg-green-100 rounded font-bold">
                            <span className="text-green-800">صافي الربح:</span>
                            <span className="font-mono text-lg text-green-900">{Number(totals.netProfit || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="bg-gradient-to-r from-secondary/5 to-secondary/10 rounded-xl p-4 border border-secondary/20 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedBlock(expandedBlock === 'final' ? null : 'final')}
                >
                  <div className="text-secondary font-semibold mb-1">رصيد نهائي</div>
                  <div className="text-2xl font-bold text-secondary">{Number((totals.sumByExpense?.['مخازن'] || 0) + Number(cashManual || 0) + (totals.sumByExpense?.['ديون ليه'] || 0) - (totals.sumByExpense?.['ديون عليه'] || 0)).toLocaleString('en-US')}</div>
                  {expandedBlock === 'final' && (
                    <div className="mt-4 p-4 bg-white/80 rounded-lg border border-secondary/30 shadow-sm">
                      <div className="font-bold text-sm text-secondary mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-secondary rounded-full"></div>
                        حساب الرصيد النهائي
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded">
                          <span className="font-medium text-blue-700">مخازن</span>
                          <span className="font-mono font-bold text-blue-800">{Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                          <span className="font-medium text-green-700">الكاش</span>
                          <span className="font-mono font-bold text-green-800">{Number(cashManual || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded">
                          <span className="font-medium text-emerald-700">ديون ليه</span>
                          <span className="font-mono font-bold text-emerald-800">{Number(totals.sumByExpense?.['ديون ليه'] || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded">
                          <span className="font-medium text-red-700">ديون عليه</span>
                          <span className="font-mono font-bold text-red-800">-{Number(totals.sumByExpense?.['ديون عليه'] || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-secondary/20 pt-3">
                          <div className="flex justify-between items-center py-2 px-3 bg-secondary/10 rounded font-bold">
                            <span className="text-secondary">الرصيد النهائي:</span>
                            <span className="font-mono text-lg text-secondary">{Number((totals.sumByExpense?.['مخازن'] || 0) + Number(cashManual || 0) + (totals.sumByExpense?.['ديون ليه'] || 0) - (totals.sumByExpense?.['ديون عليه'] || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedBlock(expandedBlock === 'difference' ? null : 'difference')}
                >
                  <div className="text-primary font-semibold mb-1">فرق المخازن</div>
                  <div className="text-2xl font-bold text-primary">{formatNumberWithParens(Number(compareLastMonth || 0))}</div>
                  {expandedBlock === 'difference' && (
                    <div className="mt-4 p-4 bg-white/80 rounded-lg border border-primary/30 shadow-sm">
                      <div className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        حساب فرق المخازن
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded">
                          <span className="font-medium text-blue-700">الشهر الحالي</span>
                          <span className="font-mono font-bold text-blue-800">{Number(correctFinalBalance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                          <span className="font-medium text-gray-700">الشهر الماضي</span>
                          <span className="font-mono font-bold text-gray-800">-{Number(lastMonthClosing || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-primary/20 pt-3">
                          <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded font-bold">
                            <span className="text-primary">فرق المخازن:</span>
                            <span className="font-mono text-lg text-primary">{formatNumberWithParens(Number(compareLastMonth || 0))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedBlock(expandedBlock === 'result' ? null : 'result')}
                >
                  <div className="text-primary font-semibold mb-1 text-sm">صافي الربح - فرق المخازن</div>
                  <div className="text-xl font-bold text-primary">{Math.abs(Number(totals.netProfit || 0) - Number(compareLastMonth || 0)).toLocaleString()}</div>
                  <div className="text-xs text-primary/70 mt-1">النتيجة النهائية</div>
                  {expandedBlock === 'result' && (
                    <div className="mt-3 p-3 bg-white/90 rounded-lg border border-primary/30 shadow-sm">
                      <div className="font-semibold text-xs text-primary mb-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        حساب النتيجة النهائية
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-1.5 px-2 bg-green-50 rounded text-sm">
                          <span className="text-green-700">صافي الربح</span>
                          <span className="font-mono font-bold text-green-800 text-xs">{Number(totals.netProfit || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 px-2 bg-blue-50 rounded text-sm">
                          <span className="text-blue-700">فرق المخازن</span>
                          <span className="font-mono font-bold text-blue-800 text-xs">-{formatNumberWithParens(Number(compareLastMonth || 0))}</span>
                        </div>
                        <div className="border-t border-primary/20 pt-2">
                          <div className="flex justify-between items-center py-1.5 px-2 bg-gradient-to-r from-primary/10 to-secondary/10 rounded font-bold text-sm">
                            <span className="text-primary">النتيجة:</span>
                            <span className="font-mono text-primary text-xs">{Math.abs(Number(totals.netProfit || 0) - Number(compareLastMonth || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cash Breakdown */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 shadow-sm">
                <div className="text-blue-800 font-semibold mb-3">تفاصيل الكاش</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="text-xs text-blue-600">المصروفات من حساب المحل</div>
                    <div className="text-lg font-bold text-blue-800">{Number(cashBreakdown.outletExpenses || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">المنزل</div>
                    <div className="text-lg font-bold text-blue-800">{Number(cashBreakdown.home || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">البنك</div>
                    <div className="text-lg font-bold text-blue-800">{Number(cashBreakdown.bank || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">الدرج</div>
                    <div className="text-lg font-bold text-blue-800">{Number(cashBreakdown.drawer || 0).toLocaleString()}</div>
                  </div>
                </div>
                {(cashBreakdown.customRows || []).filter(row => Number(row.amount || 0) > 0).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-xs text-blue-600 mb-2">بنود إضافية:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(cashBreakdown.customRows || []).filter(row => Number(row.amount || 0) > 0).map((row) => (
                        <div key={row.id} className="text-center">
                          <div className="text-xs text-blue-600">{row.description}</div>
                          <div className="text-sm font-bold text-blue-800">{Number(row.amount || 0).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-blue-200 text-center">
                  <div className="text-xs text-blue-600">إجمالي الكاش</div>
                  <div className="text-xl font-bold text-blue-800">{Number(cashManual || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Shareholders Info Block */}
              {shareholders.length > 0 && (() => {
                // Filter shareholders based on selection
                const affectedShareholders = shareholders.filter(sh => selectedShareholders.has(sh.id));
                const excludedShareholders = shareholders.filter(sh => !selectedShareholders.has(sh.id));

                return (
                  <div
                    className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setExpandedBlock(expandedBlock === 'shareholders' ? null : 'shareholders')}
                  >
                    <div className="text-purple-800 font-semibold mb-3 flex items-center justify-between">
                      <span>معلومات الشركاء</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm bg-purple-100 px-2 py-1 rounded-full">{affectedShareholders.length} مشمول</span>
                        {excludedShareholders.length > 0 && (
                          <span className="text-sm bg-slate-200 px-2 py-1 rounded-full text-slate-600">{excludedShareholders.length} مستبعد</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {affectedShareholders.slice(0, 3).map((sh, idx) => (
                        <div key={sh.id} className="text-center">
                          <div className="text-xs text-purple-600">{sh.name}</div>
                          <div className="text-sm font-bold text-purple-800">{sh.percentage.toFixed(1)}%</div>
                        </div>
                      ))}
                      {shareholders.length > 3 && (
                        <div className="text-center">
                          <div className="text-xs text-purple-600">وآخرون</div>
                          <div className="text-sm font-bold text-purple-800">+{shareholders.length - 3}</div>
                        </div>
                      )}
                    </div>
                    {expandedBlock === 'shareholders' && (
                      <div className="mt-4 p-4 bg-white/80 rounded-lg border border-purple-300 shadow-sm">
                        <div className="font-bold text-sm text-purple-700 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                          تفاصيل الشركاء
                        </div>
                        <div className="space-y-2">
                          {/* Affected Shareholders */}
                          {affectedShareholders.map((sh) => {
                            // Use correct formula: balance × profitPerPound × percentage
                            const shareAmount = Number(sh.amount || 0) * perPoundProfitComputed * (sh.percentage / 100);
                            return (
                              <div key={sh.id} className="flex justify-between items-center py-2 px-3 bg-purple-50 rounded">
                                <div className="flex flex-col">
                                  <span className="font-medium text-purple-700">{sh.name}</span>
                                  <span className="text-xs text-purple-600">{sh.percentage.toFixed(1)}% × رصيد {Number(sh.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="text-left">
                                  <div className="font-mono font-bold text-purple-800">{shareAmount.toLocaleString()}</div>
                                  <div className="text-xs text-purple-600">نصيب الشريك</div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Excluded Shareholders */}
                          {excludedShareholders.length > 0 && (
                            <>
                              <div className="border-t border-slate-300 pt-3 mt-3">
                                <div className="text-xs font-semibold text-slate-600 mb-2">مستبعدون من هذا التقرير:</div>
                              </div>
                              {excludedShareholders.map((sh) => (
                                <div key={sh.id} className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded opacity-60">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-600">{sh.name}</span>
                                    <span className="text-xs text-slate-500">{sh.percentage.toFixed(1)}% (غير مشمول)</span>
                                  </div>
                                  <div className="text-left">
                                    <Badge variant="secondary" className="text-xs">مستبعد</Badge>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          <div className="border-t border-purple-200 pt-3">
                            <div className="flex justify-between items-center py-2 px-3 bg-purple-100 rounded font-bold">
                              <span className="text-purple-800">إجمالي الأنصبة ({affectedShareholders.length} مشمول):</span>
                              <span className="font-mono text-lg text-purple-900">
                                {affectedShareholders.reduce((sum, sh) => sum + (Number(sh.amount || 0) * perPoundProfitComputed * (sh.percentage / 100)), 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Enhanced Expanded Block Section */}
            {expandedBlock && (
              <div className="mt-8 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-primary flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                      {expandedBlock === 'expenses' && 'تفاصيل المصروفات'}
                      {expandedBlock === 'profits' && 'تفاصيل الأرباح'}
                      {expandedBlock === 'final' && 'تفاصيل الرصيد النهائي'}
                      {expandedBlock === 'difference' && 'تفاصيل فرق المخازن'}
                      {expandedBlock === 'result' && 'تفاصيل النتيجة النهائية'}
                      {expandedBlock === 'shareholders' && 'تفاصيل المساهمين'}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedBlock(null)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Expenses Details */}
                  {expandedBlock === 'expenses' && (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-2">📊 شرح حساب المصروفات</h4>
                        <p className="text-blue-700 text-sm leading-relaxed">
                          يتم حساب إجمالي المصروفات من خلال جمع جميع المصروفات العادية (غير الشخصية) من جميع الفروع.
                          المصروفات الشخصية لا تدخل في هذا الحساب لأنها تضاف إلى الكاش ولا تؤثر على الربح.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-bold text-slate-800 mb-3">المصروفات العادية</h4>
                          <div className="space-y-2">
                            {expenses.filter(e => expenseTypes.get(e) !== 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
                              .map(e => (
                                <div key={e} className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded">
                                  <span className="font-medium">{e}</span>
                                  <span className="font-mono font-bold text-primary">{Number(totals.sumByExpense?.[e] || 0).toLocaleString()}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-800 mb-3">المصروفات الشخصية (مستبعدة)</h4>
                          <div className="space-y-2">
                            {expenses.filter(e => expenseTypes.get(e) === 'personal')
                              .map(e => (
                                <div key={e} className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded opacity-60">
                                  <span className="font-medium text-blue-700">{e}</span>
                                  <span className="font-mono font-bold text-blue-600">{Number(totals.sumByExpense?.[e] || 0).toLocaleString()}</span>
                                </div>
                              ))}
                            <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-100 rounded">
                              💡 هذه المصروفات تضاف للكاش ولا تؤثر على حساب الربح
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">إجمالي المصروفات العادية:</span>
                          <span className="font-mono font-bold text-2xl text-primary">{Number(totals.totalExpenses || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profits Details */}
                  {expandedBlock === 'profits' && (
                    <div className="space-y-6">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-bold text-green-800 mb-2">💰 شرح حساب الأرباح</h4>
                        <p className="text-green-700 text-sm leading-relaxed">
                          صافي الربح = إجمالي الأرباح - إجمالي المصروفات العادية.
                          هذا هو الربح الحقيقي بعد خصم جميع المصروفات التشغيلية.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-green-100 p-4 rounded-lg text-center">
                          <div className="text-green-600 font-semibold mb-1">إجمالي الأرباح</div>
                          <div className="text-2xl font-bold text-green-800">{Number(totals.totalProfits || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-red-100 p-4 rounded-lg text-center">
                          <div className="text-red-600 font-semibold mb-1">إجمالي المصروفات</div>
                          <div className="text-2xl font-bold text-red-800">-{Number(totals.totalExpenses || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-primary/10 p-4 rounded-lg text-center">
                          <div className="text-primary font-semibold mb-1">صافي الربح</div>
                          <div className="text-2xl font-bold text-primary">{Number(totals.netProfit || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <h4 className="font-bold text-yellow-800 mb-2">📈 ربح الجنيه الواحد</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-yellow-700">كل جنيه في المخازن يحقق ربح قدره:</span>
                          <span className="font-mono font-bold text-xl text-yellow-800">{perPoundProfitComputed.toFixed(4)} جنيه</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Final Balance Details */}
                  {expandedBlock === 'final' && (
                    <div className="space-y-6">
                      <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/20">
                        <h4 className="font-bold text-secondary mb-2">🏦 شرح الرصيد النهائي</h4>
                        <p className="text-secondary text-sm leading-relaxed">
                          الرصيد النهائي = المخازن + الكاش + الديون لنا - الديون علينا.
                          هذا هو إجمالي ما تملكه الشركة من أصول سائلة.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="font-bold text-slate-800">الأصول (+)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                              <span className="font-medium">المخازن</span>
                              <span className="font-mono font-bold text-green-600">+{Number(totals.sumByExpense?.['مخازن'] || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                              <span className="font-medium">الكاش الإجمالي</span>
                              <span className="font-mono font-bold text-green-600">+{Number(cashManual || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                              <span className="font-medium">ديون لنا</span>
                              <span className="font-mono font-bold text-green-600">+{Number(totals.sumByExpense?.['ديون ليه'] || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="font-bold text-slate-800">الخصوم (-)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded">
                              <span className="font-medium">ديون علينا</span>
                              <span className="font-mono font-bold text-red-600">-{Number(totals.sumByExpense?.['ديون عليه'] || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-secondary/5 p-4 rounded-lg border border-secondary/20">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">الرصيد النهائي:</span>
                          <span className="font-mono font-bold text-2xl text-secondary">{Number(correctFinalBalance).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Other expanded blocks would go here... */}
                  {expandedBlock === 'difference' && (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4">🔄</div>
                      <h3 className="text-xl font-bold text-slate-600 mb-2">تفاصيل فرق المخازن</h3>
                      <p className="text-slate-500">سيتم إضافة التفاصيل قريباً...</p>
                    </div>
                  )}

                  {expandedBlock === 'result' && (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4">📊</div>
                      <h3 className="text-xl font-bold text-slate-600 mb-2">تفاصيل النتيجة النهائية</h3>
                      <p className="text-slate-500">سيتم إضافة التفاصيل قريباً...</p>
                    </div>
                  )}

                  {expandedBlock === 'shareholders' && (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4">👥</div>
                      <h3 className="text-xl font-bold text-slate-600 mb-2">تفاصيل المساهمين</h3>
                      <p className="text-slate-500">سيتم إضافة التفاصيل قريباً...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSimplePreview(false)}>إغلاق</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSimplePreview(false);
                  // Open comprehensive edit modal instead of wizard
                  if (currentReportId) {
                    const localReport = reports.find(report => report._id === currentReportId);
                    if (localReport) {
                      setQuickEditReport(localReport);
                      setShowQuickEditModal(true);
                    }
                  }
                }}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <Edit className="w-4 h-4 mr-1" />
                تعديل شامل
              </Button>
              <Button
                onClick={() => {
                  setShowSimplePreview(false);
                  setPreviewLayout('a4');
                  setShowPreview(true);
                }}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white"
              >
                عرض تقرير
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comprehensive Edit Report Modal */}
        <ComprehensiveEditModal
          open={showQuickEditModal}
          onOpenChange={setShowQuickEditModal}
          report={quickEditReport}
          shareholders={shareholders}
          shareHistory={shareHistory}
          onSave={handleQuickEditSave}
        />
      </div>
    </AdminLayout>
  );
}
