/**
 * Senus fiscal calendar: year ends 30 June.
 * FY2026 = 1 Jul 2025 – 30 Jun 2026
 * HY2026 = first half of that FY = 1 Jul 2025 – 31 Dec 2025
 *
 * Periods auto-extend: only periods whose end date is on or before `asOf`
 * are included, so the list grows as calendar time advances.
 */

export type GeneratedPeriod = {
  id: string;
  label: string;
  periodType: "HY" | "FY";
  startDate: string; // YYYY-MM-DD
  endDate: string;
  basisDefault: "audited" | "unaudited" | "management";
  sortOrder: number;
};

/** First FY label year (FY2018 starts Jul 2017 — company founded 2017). */
export const FIRST_FY_YEAR = 2018;

export const COMPANY_ID = "senus-plc";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Build HY + FY slots from FIRST_FY_YEAR through the latest period that has
 * ended as of `asOf` (defaults to today).
 */
export function periodsFrom(asOf: Date = new Date()): GeneratedPeriod[] {
  const cutoff = endOfDay(asOf);
  const out: GeneratedPeriod[] = [];
  let sortOrder = 0;

  const maxFyYear = cutoff.getFullYear() + 1;

  for (let fyYear = FIRST_FY_YEAR; fyYear <= maxFyYear; fyYear++) {
    const startY = fyYear - 1;
    const hy: GeneratedPeriod = {
      id: `hy${fyYear}`,
      label: `HY${fyYear}`,
      periodType: "HY",
      startDate: iso(startY, 7, 1),
      endDate: iso(startY, 12, 31),
      basisDefault: "unaudited",
      sortOrder: ++sortOrder,
    };
    if (parseIso(hy.endDate) <= cutoff) out.push(hy);

    const fy: GeneratedPeriod = {
      id: `fy${fyYear}`,
      label: `FY${fyYear}`,
      periodType: "FY",
      startDate: iso(startY, 7, 1),
      endDate: iso(fyYear, 6, 30),
      basisDefault: fyYear >= 2026 ? "management" : "audited",
      sortOrder: ++sortOrder,
    };
    if (parseIso(fy.endDate) <= cutoff) out.push(fy);
  }

  return out;
}

/** Adjacent prior same-type period (HY2026 → hy2025, FY2026 → fy2025). */
export function priorPeriodId(periodId: string): string | null {
  const m = /^(hy|fy)(\d{4})$/i.exec(periodId);
  if (!m) return null;
  const year = Number(m[2]) - 1;
  if (year < FIRST_FY_YEAR) return null;
  return `${m[1].toLowerCase()}${year}`;
}

export function findPeriod(periodId: string, asOf: Date = new Date()): GeneratedPeriod | undefined {
  return periodsFrom(asOf).find((p) => p.id === periodId);
}

export function optionLabel(period: GeneratedPeriod, comparative: GeneratedPeriod | null): string {
  const range = `${period.startDate} → ${period.endDate}`;
  if (!comparative) return `${period.label} (${range})`;
  return `${period.label} (${range}) · vs ${comparative.label}`;
}
