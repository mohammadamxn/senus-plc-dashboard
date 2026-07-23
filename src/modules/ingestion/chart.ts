import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { lineItemDefs } from "@/db/schema";
import type { ChartRow } from "@/modules/ingestion/chart-types";

export type { ChartRow };

/**
 * Runtime chart of accounts — always from `line_item_defs` (seeded from
 * content/seed/chart-of-accounts.json via `npm run db:seed`). Call sites
 * must not read that JSON file directly.
 */
export async function loadChartOfAccounts(): Promise<ChartRow[]> {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not set — cannot load chart of accounts from the database.");
  }

  const rows = await db
    .select({
      code: lineItemDefs.code,
      label: lineItemDefs.label,
      statement: lineItemDefs.statement,
      sortOrder: lineItemDefs.sortOrder,
    })
    .from(lineItemDefs)
    .orderBy(asc(lineItemDefs.sortOrder));

  if (rows.length === 0) {
    throw new Error(
      "line_item_defs is empty — run `npm run db:seed` (or seed chart rows) before extraction.",
    );
  }

  return rows;
}

export function formatChartHint(chart: ChartRow[]): string {
  return chart.map((c) => `${c.code} (${c.statement}): ${c.label}`).join("\n");
}
