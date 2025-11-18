/**
 * Type Definitions for Profit Management System
 * 
 * This file contains all TypeScript types and interfaces used in the Profit module.
 * Centralized types ensure consistency across all components.
 * 
 * @module Profit/types
 */

// ============================================================================
// Basic Types
// ============================================================================

/**
 * Branch name (e.g., "الزهراء", "التكية")
 */
export type Branch = string;

/**
 * Expense name (e.g., "مخازن", "مصروفات وليد")
 */
export type Expense = string;

/**
 * Type of expense for categorization
 */
export type ExpenseType = 'personal' | 'other';

// ============================================================================
// Expense & Branch Types
// ============================================================================

/**
 * Expense item with name and type
 */
export interface ExpenseItem {
  name: string;
  type: ExpenseType;
}

/**
 * Row of data for a specific branch
 * Contains values for each expense
 */
export interface BranchRow {
  name: Branch;
  values: Record<Expense, number>;
}

/**
 * Saved branch row format (for API)
 */
export interface SavedBranchRow {
  name: string;
  values: Record<string, number>;
}

// ============================================================================
// Cash Breakdown Types
// ============================================================================

/**
 * Custom cash row (user-defined cash category)
 */
export interface CustomCashRow {
  id: string;
  name: string;
  description?: string;
  amount: number;
}

/**
 * Cash breakdown structure
 * Contains all cash-related values
 */
export interface CashBreakdown {
  outletExpenses: number;
  home: number;
  bank: number;
  drawer: number;
  customRows?: CustomCashRow[];
}

// ============================================================================
// Totals & Calculations
// ============================================================================

/**
 * Calculated totals for a profit report
 */
export interface ProfitTotals {
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
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Complete profit report document
 * Stored in MongoDB
 */
export interface ProfitReportDoc {
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
  updatedAt?: string;
}

/**
 * Response from profit aggregate API
 */
export interface ProfitAggregateResponse {
  ok: true;
  branches?: string[];
  expenses?: string[];
  map?: Record<string, Record<string, number>>;
}

// ============================================================================
// Shareholder Types
// ============================================================================

/**
 * Shareholder information
 */
export interface Shareholder {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  createdAt?: number;
  initialAmount?: number;
}

/**
 * Shareholder transaction record
 */
export interface ShareTxn {
  id: string;
  date: string;
  reportId?: string;
  delta: number;
  fromAmount: number;
  toAmount: number;
  netProfit: number;
  finalBalance: number;
  source?: 'auto' | 'manual';
  note?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Export action type
 */
export type ExportAction = 'print' | 'pdf' | 'image' | null;

/**
 * Preview layout type
 */
export type PreviewLayout = 'summary' | 'a4';

/**
 * Wizard step value
 */
export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 5.5;

/**
 * Management scope (global template or current report)
 */
export type ManagementScope = 'global' | 'report';

/**
 * Detail view type
 */
export type DetailView = 'final' | 'net' | 'compare' | 'summary' | 'calculation' | null;

/**
 * Expanded block type
 */
export type ExpandedBlock = 'expenses' | 'profits' | 'final' | 'difference' | 'result' | 'shareholders' | null;

// ============================================================================
// Profit Settings (MongoDB)
// ============================================================================

/**
 * Profit settings stored in MongoDB
 */
export interface ProfitSettings {
  globalBranches: string[];
  globalExpenses: string[];
  shareholders: Shareholder[];
  shareHistory: Record<string, ShareTxn[]>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default branches
 */
export const DEFAULT_BRANCHES: Branch[] = ['الزهراء', 'التكية', 'القيسارية'];

/**
 * Default expenses
 */
export const DEFAULT_EXPENSES: Expense[] = [
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

/**
 * Fixed expenses that should not be editable
 */
export const FIXED_EXPENSES: Set<Expense> = new Set(['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه']);

/**
 * Wizard steps configuration
 */
export const WIZARD_STEPS = [
  { value: 0 as WizardStep, label: 'الفترة' },
  { value: 1 as WizardStep, label: 'المخازن' },
  { value: 2 as WizardStep, label: 'المصروفات' },
  { value: 3 as WizardStep, label: 'الكاش' },
  { value: 4 as WizardStep, label: 'الأرباح' },
  { value: 5 as WizardStep, label: 'الأرباح' },
  { value: 5.5 as WizardStep, label: 'المساهمون' },
] as const;
