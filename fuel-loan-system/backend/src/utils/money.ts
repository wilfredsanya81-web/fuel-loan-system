/**
 * Consistent 2-decimal rounding for all monetary values (UGX).
 * Avoids floating-point errors in financial calculations.
 */
const DECIMALS = 2;
const FACTOR = 10 ** DECIMALS;

export function roundMoney(amount: number): string {
  const n = Math.round(amount * FACTOR) / FACTOR;
  return n.toFixed(DECIMALS);
}

export function roundMoneyNum(amount: number): number {
  return Math.round(amount * FACTOR) / FACTOR;
}

/** Compare two monetary values with tolerance for rounding (0.005 = half cent). */
export function moneyEqual(a: number, b: number, tolerance = 0.005): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Return true if amount is valid (finite, non-NaN, >= 0). */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && !Number.isNaN(amount) && amount >= 0;
}
