/**
 * Utility Functions for Profit Management System
 * 
 * This file contains helper functions used across the Profit module.
 * Centralized utilities ensure consistency and reusability.
 * 
 * @module Profit/utils
 */

import { BranchRow, Expense, ExpenseType, CashBreakdown } from './types';
import { calculateFinalBalance, calculateNetProfit } from '@/lib/profitCalculations';

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format number with parentheses for negative values
 * 
 * @param num - Number to format
 * @returns Formatted string (e.g., "1,234" or "(-1,234)")
 * 
 * @example
 * ```typescript
 * formatNumberWithParens(1234);   // "1,234"
 * formatNumberWithParens(-1234);  // "(-1,234)"
 * ```
 */
export function formatNumberWithParens(num: number): string {
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString();
  return num < 0 ? `(-${formatted})` : formatted;
}

/**
 * Format a number with thousand separators
 * 
 * @param value - Number or string to format
 * @param allowZero - Whether to show zero values (default: false)
 * @returns Formatted string or empty string
 */
export function formatNumber(value: number | string, allowZero: boolean = false): string {
  if (value === '' || value === null || value === undefined) return '';
  if (!allowZero && (value === 0 || value === '0')) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US');
}

/**
 * Parse a formatted number string to number
 * 
 * @param value - String with commas
 * @returns Parsed number
 */
export function parseNumber(value: string): number {
  const cleaned = value.replace(/,/g, '');
  if (cleaned === '-' || cleaned === '') return 0;
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Validate numeric input (allows digits, commas, decimal points)
 * 
 * @param value - Input string to validate
 * @returns True if valid
 */
export function validateNumericInput(value: string): boolean {
  const numericRegex = /^[0-9,]*\.?[0-9]*$/;
  return numericRegex.test(value);
}

/**
 * Sanitize numeric value from string
 * 
 * @param value - String value
 * @returns Sanitized number
 */
export function sanitizeNumericValue(value: string): number {
  return Number(String(value || '0').replace(/,/g, '')) || 0;
}

/**
 * Validate text input (Arabic, English, numbers, spaces)
 * 
 * @param value - Text to validate
 * @returns True if valid
 */
export function validateTextInput(value: string): boolean {
  // Allow Arabic, English, numbers, spaces, and common punctuation
  const textRegex = /^[\u0600-\u06FFa-zA-Z0-9\s\-_.,()]+$/;
  return textRegex.test(value);
}

// ============================================================================
// Calculation Helpers
// ============================================================================

/**
 * Calculate totals from branch rows
 * 
 * @param branchRows - Array of branch data
 * @param expenses - List of expense names
 * @param cashManual - Manual cash total
 * @param expenseTypes - Map of expense types
 * @param outletExpenses - Outlet expenses amount
 * @returns Calculated totals
 */
export function calcTotals(
  branchRows: BranchRow[],
  expenses: Expense[],
  cashManual: number,
  expenseTypes: Map<string, ExpenseType>,
  outletExpenses: number = 0
) {
  // Initialize sum by expense
  const sumByExpense: Record<Expense, number> = Object.create(null) as Record<Expense, number>;
  for (const e of expenses) sumByExpense[e] = 0;
  
  // Sum all branch values
  for (const br of branchRows) {
    for (const e of expenses) {
      sumByExpense[e] += Number(br.values[e] || 0);
    }
  }
  
  const totalStores = sumByExpense['مخازن'] || 0;
  
  // Calculate personal expenses total
  const personalExpensesTotal = expenses
    .filter(e => expenseTypes.get(e) === 'personal' && !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
    .reduce((s, k) => s + (sumByExpense[k] || 0), 0);
  
  // Calculate all expenses (excluding fixed items)
  const allExpenses = expenses
    .filter(e => !['مخازن', 'كاش الدرج', 'ديون ليه', 'ديون عليه', 'أرباح'].includes(e))
    .reduce((s, k) => s + (sumByExpense[k] || 0), 0);
  
  // Subtract outlet expenses to prevent double counting
  const totalExpenses = allExpenses - Number(outletExpenses || 0);
  
  const totalProfits = sumByExpense['أرباح'] || 0;
  
  // Calculate final balance using centralized formula
  const stores = sumByExpense['مخازن'] || 0;
  const cash = Number(cashManual || 0);
  const debtsToUs = sumByExpense['ديون ليه'] || 0;
  const debtsOnUs = sumByExpense['ديون عليه'] || 0;
  
  const finalBalance = calculateFinalBalance(stores, cash, debtsToUs, debtsOnUs);
  const netProfit = calculateNetProfit(totalProfits, totalExpenses);
  
  return {
    sumByExpense,
    totalStores,
    totalExpenses,
    totalProfits,
    finalBalance,
    netProfit,
    personalExpensesTotal
  };
}

/**
 * Calculate cash manual total from cash breakdown
 * 
 * @param cashBreakdown - Cash breakdown object
 * @returns Total cash amount
 */
export function calculateCashManual(cashBreakdown: CashBreakdown): number {
  const customRowsTotal = (cashBreakdown.customRows || [])
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  
  return (
    Number(cashBreakdown.outletExpenses || 0) +
    Number(cashBreakdown.home || 0) +
    Number(cashBreakdown.bank || 0) +
    Number(cashBreakdown.drawer || 0) +
    customRowsTotal
  );
}

// ============================================================================
// Text Utilities
// ============================================================================

/**
 * Fix mojibake Arabic text (best-effort)
 * 
 * @param s - String to fix
 * @returns Fixed string
 */
export function fixText(s: string): string {
  try {
    // Convert from mis-decoded latin-1 to UTF-8
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format date range for display
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('ar-EG')} - ${end.toLocaleDateString('ar-EG')}`;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Move an item in an array from one index to another
 * 
 * @param array - Source array
 * @param fromIndex - Current index
 * @param toIndex - Target index
 * @returns New array with item moved
 */
export function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, removed);
  return newArray;
}

// ============================================================================
// Report ID Utilities
// ============================================================================

/**
 * Clean report ID by removing suffixes
 * 
 * @param reportId - Report ID (may have _edit_, _profit_, etc.)
 * @returns Clean report ID
 */
export function cleanReportId(reportId?: string): string | undefined {
  return reportId?.split('_')[0];
}

/**
 * Check if a transaction is related to a specific report
 * 
 * @param txnReportId - Transaction's report ID
 * @param reportId - Report ID to check against
 * @returns True if related
 */
export function isTransactionRelatedToReport(txnReportId: string | undefined, reportId: string): boolean {
  if (!txnReportId) return false;
  
  return (
    txnReportId === reportId ||
    txnReportId.startsWith(`${reportId}_profit_`) ||
    txnReportId.startsWith(`${reportId}_edit_`) ||
    txnReportId.startsWith(`${reportId}_reversal_`) ||
    txnReportId.startsWith(`${reportId}_skip_`)
  );
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate report data before saving
 * 
 * @param reportName - Report name
 * @param title - Report title
 * @param description - Report description
 * @returns Error message or null if valid
 */
export function validateReportData(
  reportName: string,
  title?: string,
  description?: string
): string | null {
  const trimmedReportName = reportName.trim();
  
  if (!trimmedReportName) {
    return 'اسم التقرير مطلوب';
  }
  
  if (!validateTextInput(trimmedReportName)) {
    return 'اسم التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.';
  }
  
  if (title && !validateTextInput(title.trim())) {
    return 'عنوان التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.';
  }
  
  if (description && !validateTextInput(description.trim())) {
    return 'وصف التقرير غير صحيح. يرجى استخدام أحرف عربية وإنجليزية وارقام وفراغات فقط.';
  }
  
  return null;
}

// ============================================================================
// Export Utilities
// ============================================================================

/**
 * Generate unique ID
 * 
 * @returns Random unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate timestamp-based ID
 * 
 * @returns Timestamp-based ID
 */
export function generateTimestampId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
