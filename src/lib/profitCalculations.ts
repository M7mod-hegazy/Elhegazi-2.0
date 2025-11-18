/**
 * Centralized Profit Calculation Formulas
 * 
 * This file contains all mathematical formulas used in the Profit and Shareholders system.
 * All formulas are extracted here to ensure:
 * - Single source of truth
 * - Easy testing
 * - Consistent calculations across the application
 * - Easy maintenance
 * 
 * @module profitCalculations
 */

/**
 * Cash Breakdown structure
 */
export interface CashBreakdown {
  outletExpenses: number;
  home: number;
  bank: number;
  drawer: number;
  customRows?: Array<{ amount: number }>;
}

/**
 * Calculate the total cash amount from cash breakdown
 * 
 * Formula: outletExpenses + home + bank + drawer + sum(customRows)
 * 
 * @param cashBreakdown - The cash breakdown object
 * @returns Total cash amount
 * 
 * @example
 * ```typescript
 * const total = calculateCashTotal({
 *   outletExpenses: 1000,
 *   home: 500,
 *   bank: 2000,
 *   drawer: 300,
 *   customRows: [{ amount: 100 }, { amount: 200 }]
 * });
 * // Returns: 4100
 * ```
 */
export const calculateCashTotal = (cashBreakdown: CashBreakdown): number => {
  const customRowsTotal = (cashBreakdown.customRows || [])
    .reduce((sum, row) => sum + (row.amount || 0), 0);
  
  return (
    (cashBreakdown.outletExpenses || 0) +
    (cashBreakdown.home || 0) +
    (cashBreakdown.bank || 0) +
    (cashBreakdown.drawer || 0) +
    customRowsTotal
  );
};

/**
 * Calculate the final balance (total assets)
 * 
 * Formula: stores + cash + debtsToUs - debtsOnUs
 * 
 * This represents the total value of assets the business has:
 * - Stores (inventory)
 * - Cash (all cash holdings)
 * - Debts owed to us (receivables)
 * - Minus debts we owe (payables)
 * 
 * @param stores - Total inventory value (مخازن)
 * @param cash - Total cash amount (كاش)
 * @param debtsToUs - Money owed to us (ديون ليه)
 * @param debtsOnUs - Money we owe (ديون عليه)
 * @returns Final balance
 * 
 * @example
 * ```typescript
 * const finalBalance = calculateFinalBalance(
 *   5000000,  // stores
 *   100000,   // cash
 *   50000,    // debts to us
 *   20000     // debts on us
 * );
 * // Returns: 5130000
 * ```
 */
export const calculateFinalBalance = (
  stores: number,
  cash: number,
  debtsToUs: number,
  debtsOnUs: number
): number => {
  return stores + cash + debtsToUs - debtsOnUs;
};

/**
 * Calculate net profit
 * 
 * Formula: totalProfits - totalExpenses
 * 
 * This is the bottom line: how much profit was made after all expenses.
 * 
 * @param totalProfits - Total profits (أرباح)
 * @param totalExpenses - Total expenses (مصروفات)
 * @returns Net profit (صافي الربح)
 * 
 * @example
 * ```typescript
 * const netProfit = calculateNetProfit(500000, 300000);
 * // Returns: 200000
 * ```
 */
export const calculateNetProfit = (
  totalProfits: number,
  totalExpenses: number
): number => {
  return totalProfits - totalExpenses;
};

/**
 * Calculate the difference compared to last month
 * 
 * Formula: finalBalance - lastMonthClosing
 * 
 * This shows how much the business grew (or shrank) compared to last month.
 * This is the value used for shareholder profit distribution (الفرق).
 * 
 * @param finalBalance - Current month's final balance
 * @param lastMonthClosing - Previous month's final balance
 * @returns Difference (الفرق)
 * 
 * @example
 * ```typescript
 * const difference = calculateCompareLastMonth(5130000, 5000000);
 * // Returns: 130000 (growth of 130,000)
 * ```
 */
export const calculateCompareLastMonth = (
  finalBalance: number,
  lastMonthClosing: number
): number => {
  return finalBalance - lastMonthClosing;
};

/**
 * Calculate profit per pound (ربح الجنيه)
 * 
 * Formula: compareLastMonth / finalBalance
 * 
 * This is the KEY metric for shareholder distribution.
 * It represents how much profit was generated per unit of final balance.
 * 
 * IMPORTANT: This uses compareLastMonth (الفرق), NOT netProfit!
 * 
 * @param compareLastMonth - The difference from last month (الفرق)
 * @param finalBalance - Current final balance
 * @returns Profit per pound (0 if finalBalance is 0)
 * 
 * @example
 * ```typescript
 * const profitPerPound = calculateProfitPerPound(130000, 5130000);
 * // Returns: 0.025341 (2.53% profit per pound)
 * ```
 */
export const calculateProfitPerPound = (
  compareLastMonth: number,
  finalBalance: number
): number => {
  if (finalBalance <= 0) return 0;
  return compareLastMonth / finalBalance;
};

/**
 * Calculate a shareholder's profit delta (change in balance)
 * 
 * Formula: balanceBeforeReport × profitPerPound × (percentage / 100)
 * 
 * This calculates how much a shareholder's balance should change based on:
 * - Their balance before this report
 * - The profit per pound for this period
 * - Their ownership percentage
 * 
 * @param balanceBeforeReport - Shareholder's balance before this report
 * @param profitPerPound - Calculated profit per pound
 * @param percentage - Shareholder's ownership percentage (e.g., 50 for 50%)
 * @returns Delta (change in balance)
 * 
 * @example
 * ```typescript
 * const delta = calculateShareholderDelta(
 *   50000,      // shareholder had 50,000
 *   0.025341,   // profit per pound is 2.53%
 *   50          // they own 50%
 * );
 * // Returns: 633.525 (their balance increases by 633.525)
 * ```
 */
export const calculateShareholderDelta = (
  balanceBeforeReport: number,
  profitPerPound: number,
  percentage: number
): number => {
  return balanceBeforeReport * profitPerPound * (percentage / 100);
};

/**
 * Calculate a shareholder's new balance after profit distribution
 * 
 * Formula: balanceBeforeReport + delta
 * 
 * @param balanceBeforeReport - Shareholder's balance before this report
 * @param delta - Calculated change in balance
 * @returns New balance
 * 
 * @example
 * ```typescript
 * const newBalance = calculateShareholderNewBalance(50000, 633.525);
 * // Returns: 50633.525
 * ```
 */
export const calculateShareholderNewBalance = (
  balanceBeforeReport: number,
  delta: number
): number => {
  return balanceBeforeReport + delta;
};

/**
 * Calculate total expenses from expense breakdown
 * 
 * This sums all expenses EXCEPT the fixed items:
 * - مخازن (stores)
 * - كاش الدرج (drawer cash)
 * - ديون ليه (debts to us)
 * - ديون عليه (debts on us)
 * - أرباح (profits)
 * 
 * @param sumByExpense - Object with expense names as keys and amounts as values
 * @param fixedExpenses - Set of expense names to exclude
 * @returns Total expenses
 * 
 * @example
 * ```typescript
 * const totalExpenses = calculateTotalExpenses(
 *   {
 *     'مخازن': 5000000,
 *     'مصروفات وليد': 50000,
 *     'مصروفات المحل': 30000,
 *     'أرباح': 500000
 *   },
 *   new Set(['مخازن', 'أرباح'])
 * );
 * // Returns: 80000 (only counts the two expense items)
 * ```
 */
export const calculateTotalExpenses = (
  sumByExpense: Record<string, number>,
  fixedExpenses: Set<string>
): number => {
  return Object.entries(sumByExpense)
    .filter(([expenseName]) => !fixedExpenses.has(expenseName))
    .reduce((sum, [, amount]) => sum + amount, 0);
};

/**
 * Validate that a number is positive
 * 
 * @param value - Number to validate
 * @param fieldName - Name of the field (for error messages)
 * @throws Error if value is negative
 */
export const validatePositiveNumber = (value: number, fieldName: string): void => {
  if (value < 0) {
    throw new Error(`${fieldName} cannot be negative: ${value}`);
  }
};

/**
 * Validate profit calculation inputs
 * 
 * @param finalBalance - Final balance
 * @param compareLastMonth - Compare last month value
 * @throws Error if inputs are invalid
 */
export const validateProfitCalculation = (
  finalBalance: number,
  compareLastMonth: number
): void => {
  validatePositiveNumber(finalBalance, 'Final Balance');
  
  if (finalBalance === 0 && compareLastMonth !== 0) {
    throw new Error('Cannot have profit/loss with zero final balance');
  }
};

/**
 * Validate shareholder distribution inputs
 * 
 * @param balanceBeforeReport - Balance before report
 * @param profitPerPound - Profit per pound
 * @param percentage - Ownership percentage
 * @throws Error if inputs are invalid
 */
export const validateShareholderDistribution = (
  balanceBeforeReport: number,
  profitPerPound: number,
  percentage: number
): void => {
  validatePositiveNumber(balanceBeforeReport, 'Balance Before Report');
  
  if (percentage < 0 || percentage > 100) {
    throw new Error(`Invalid percentage: ${percentage}. Must be between 0 and 100.`);
  }
};

/**
 * Format a number with thousand separators
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 * 
 * @example
 * ```typescript
 * formatNumber(1234567.89);
 * // Returns: "1,234,567.89"
 * ```
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Round to specified decimal places
 * 
 * @param value - Number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 * 
 * @example
 * ```typescript
 * roundToDecimals(1234.5678, 2);
 * // Returns: 1234.57
 * ```
 */
export const roundToDecimals = (value: number, decimals: number = 2): number => {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
};
