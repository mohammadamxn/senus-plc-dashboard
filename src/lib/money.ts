import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function pctChange(current: Decimal.Value, prior: Decimal.Value): Decimal | null {
  const p = d(prior);
  if (p.isZero()) return null;
  return d(current).minus(p).div(p).times(100);
}

export function margin(numerator: Decimal.Value, denominator: Decimal.Value): Decimal | null {
  const den = d(denominator);
  if (den.isZero()) return null;
  return d(numerator).div(den).times(100);
}

export function formatEur(value: Decimal.Value, digits = 0): string {
  const n = d(value).toNumber();
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function formatPct(value: Decimal.Value, digits = 1): string {
  return `${d(value).toFixed(digits)}%`;
}

export function formatPp(value: Decimal.Value, digits = 1): string {
  const n = d(value);
  const sign = n.gte(0) ? "+" : "";
  return `${sign}${n.toFixed(digits)}pp`;
}
