import "server-only";
import { getDb } from "@/db/client";
import { fiscalPeriods } from "@/db/schema";
import { COMPANY_ID, periodsFrom, type GeneratedPeriod } from "@/modules/periods/generate";

/**
 * Idempotently upsert auto-generated periods into fiscal_periods.
 * Existing notes/basis are preserved on conflict (only label/dates/sort refreshed).
 */
export async function syncFiscalPeriods(asOf: Date = new Date()): Promise<GeneratedPeriod[]> {
  const generated = periodsFrom(asOf);
  const db = getDb();
  if (!db) return generated;

  for (const p of generated) {
    await db
      .insert(fiscalPeriods)
      .values({
        id: p.id,
        companyId: COMPANY_ID,
        periodType: p.periodType,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        basis: p.basisDefault,
        sortOrder: p.sortOrder,
      })
      .onConflictDoUpdate({
        target: fiscalPeriods.id,
        set: {
          label: p.label,
          startDate: p.startDate,
          endDate: p.endDate,
          sortOrder: p.sortOrder,
        },
      });
  }

  return generated;
}
