import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { getDb } from "./client";
import {
  companies,
  fiscalPeriods,
  lineItemDefs,
  statementLines,
  metricDefs,
  metricValues,
  operatingKpis,
  sourceDocuments,
} from "./schema";
import { computeMetrics, type StatementAmounts } from "@/modules/metrics/engine";
import {
  buildMetricAudienceTags,
  CATEGORY_AUDIENCES,
  LIQUIDITY_OPERATING_KPI_KEYS,
} from "@/config/metric-categories";

config({ path: ".env.local" });

function seedPath(...parts: string[]) {
  return path.join(process.cwd(), "content", "seed", ...parts);
}

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(seedPath(...parts), "utf8")) as T;
}

type Company = {
  id: string;
  legalName: string;
  functionalCurrency?: string;
};

type Period = {
  id: string;
  companyId: string;
  periodType: "FY" | "HY" | "Q" | "M";
  label: string;
  startDate: string;
  endDate: string;
  basis: "audited" | "unaudited" | "management";
  sortOrder: number;
  notes?: string;
};

type ChartLine = {
  code: string;
  label: string;
  statement: "PL" | "BS" | "CF";
  parentCode: string | null;
  sortOrder: number;
  signConvention: string;
  isSubtotal?: boolean;
};

type OperatingKpi = {
  periodId: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  basis: "audited" | "unaudited" | "management";
  sourceRef?: string;
  tolerance?: number;
};

type Document = {
  id: string;
  periodId: string;
  title: string;
  basis: "audited" | "unaudited" | "management";
};

async function main() {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not set (check .env.local) — nothing to seed.");
  }

  const company = readJson<Company>("company.json");
  const periods = readJson<Period[]>("periods.json");
  const chart = readJson<ChartLine[]>("chart-of-accounts.json");
  const kpis = readJson<OperatingKpi[]>("operating-kpis.json");
  const documents = readJson<Document[]>("documents", "corpus.json");
  const statement = readJson<{
    periodId: string;
    comparativePeriodId: string;
    lines: StatementAmounts;
  }>("statements", "hy2026.json");

  console.log(`Seeding ${company.legalName}…`);

  await db
    .insert(companies)
    .values({
      id: company.id,
      legalName: company.legalName,
      functionalCurrency: company.functionalCurrency ?? "EUR",
    })
    .onConflictDoUpdate({
      target: companies.id,
      set: { legalName: company.legalName },
    });

  for (const p of periods) {
    await db
      .insert(fiscalPeriods)
      .values({
        id: p.id,
        companyId: p.companyId,
        periodType: p.periodType,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        basis: p.basis,
        sortOrder: p.sortOrder,
        notes: p.notes,
      })
      .onConflictDoUpdate({
        target: fiscalPeriods.id,
        set: { label: p.label, basis: p.basis, notes: p.notes, sortOrder: p.sortOrder },
      });
  }
  console.log(`  fiscal_periods: ${periods.length}`);

  for (const c of chart) {
    await db
      .insert(lineItemDefs)
      .values({
        code: c.code,
        label: c.label,
        statement: c.statement,
        parentCode: c.parentCode,
        sortOrder: c.sortOrder,
        signConvention: c.signConvention,
        isSubtotal: c.isSubtotal ?? false,
      })
      .onConflictDoUpdate({
        target: lineItemDefs.code,
        set: { label: c.label, sortOrder: c.sortOrder, isSubtotal: c.isSubtotal ?? false },
      });
  }
  console.log(`  line_item_defs: ${chart.length}`);

  let lineCount = 0;
  for (const [code, amounts] of Object.entries(statement.lines)) {
    for (const [periodId, amount] of [
      [statement.periodId, amounts.current],
      [statement.comparativePeriodId, amounts.prior],
    ] as const) {
      await db
        .insert(statementLines)
        .values({
          periodId,
          lineItemCode: code,
          amount: amount.toFixed(2),
          currency: "EUR",
        })
        .onConflictDoUpdate({
          target: [statementLines.periodId, statementLines.lineItemCode],
          set: { amount: amount.toFixed(2) },
        });
      lineCount++;
    }
  }
  console.log(`  statement_lines: ${lineCount}`);

  // operating_kpis has no natural unique key — re-mirror the JSON on every run.
  await db.delete(operatingKpis);
  for (const k of kpis) {
    await db.insert(operatingKpis).values({
      periodId: k.periodId,
      key: k.key,
      label: k.label,
      value: k.value.toFixed(4),
      unit: k.unit,
      basis: k.basis,
      sourceRef: k.sourceRef,
      tolerance: k.tolerance != null ? k.tolerance.toFixed(4) : null,
      audienceTags: LIQUIDITY_OPERATING_KPI_KEYS.has(k.key) ? CATEGORY_AUDIENCES.liquidity : null,
    });
  }
  console.log(`  operating_kpis: ${kpis.length}`);

  for (const doc of documents) {
    await db
      .insert(sourceDocuments)
      .values({ id: doc.id, periodId: doc.periodId, title: doc.title, basis: doc.basis })
      .onConflictDoUpdate({
        target: sourceDocuments.id,
        set: { title: doc.title, basis: doc.basis },
      });
  }
  console.log(`  source_documents: ${documents.length}`);

  // Deterministic metrics engine output, persisted so AI insight citations (Step 3)
  // can FK to a specific metric_value row rather than a recomputed-on-the-fly number.
  // audienceTags mirrors CATEGORY_AUDIENCES (src/config/metric-categories.ts) so the
  // TypeScript policy (app-layer hiding) and the DB RLS policy can't drift apart —
  // a test asserts these two stay in sync.
  const audienceTagsByMetric = buildMetricAudienceTags();
  const metrics = computeMetrics(statement.lines);
  for (const m of metrics) {
    const audienceTags = audienceTagsByMetric[m.id] ?? null;
    await db
      .insert(metricDefs)
      .values({ id: m.id, label: m.label, formulaKey: m.id, unit: m.unit, audienceTags })
      .onConflictDoUpdate({ target: metricDefs.id, set: { label: m.label, unit: m.unit, audienceTags } });

    await db
      .insert(metricValues)
      .values({
        metricDefId: m.id,
        periodId: statement.periodId,
        value: m.value != null ? m.value.toString() : null,
        meaningfulness: m.meaningfulness,
        inputsJson: JSON.stringify(m.inputs),
      })
      .onConflictDoUpdate({
        target: [metricValues.metricDefId, metricValues.periodId],
        set: {
          value: m.value != null ? m.value.toString() : null,
          meaningfulness: m.meaningfulness,
          inputsJson: JSON.stringify(m.inputs),
        },
      });
  }
  console.log(`  metric_defs / metric_values: ${metrics.length}`);

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
