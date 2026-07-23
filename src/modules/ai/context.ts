import "server-only";
import { createHash } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  documentSections,
  lineItemDefs,
  metricDefs,
  metricValues,
  operatingKpis,
  statementLines,
} from "@/db/schema";
import {
  CATEGORY_IDS,
  CATEGORY_METRIC_IDS,
  type CategoryId,
} from "@/config/metric-categories";
import { priorPeriodId } from "@/modules/periods/generate";
import { COMMENTARY_PROMPT_VERSION } from "@/modules/ai/validate";
import type { MetricContextItem, ReportFactItem } from "@/modules/ai/validate";
import {
  QUALITATIVE_SECTION_LABELS,
  type QualitativeSection,
  type QualitativeSectionKey,
} from "@/modules/ingestion/schema";

export type PackCommentaryContext = {
  periodId: string;
  metricsBySection: Record<CategoryId, MetricContextItem[]>;
  /** Approved statement lines + operating KPIs (report financials). */
  reportFacts: ReportFactItem[];
  /** Approved verbatim qualitative section bodies. */
  qualitativeSections: QualitativeSection[];
  anomalyHints: string[];
  dataHash: string;
  promptVersion: string;
};

function fmt(n: string | null | undefined): string | null {
  if (n == null) return null;
  return n;
}

function anomalyHintsFor(section: CategoryId, metrics: MetricContextItem[]): string[] {
  const byDef = new Map(metrics.map((m) => [m.metricDefId, m]));
  const hints: string[] = [];

  if (section === "growth") {
    const rev = byDef.get("revenue_growth_yoy") ?? byDef.get("revenue");
    const admin = byDef.get("admin_growth") ?? byDef.get("admin_expenses");
    const revPct = rev?.deltaPct != null ? Number(rev.deltaPct) : null;
    const adminPct = admin?.deltaPct != null ? Number(admin.deltaPct) : null;
    if (revPct != null && adminPct != null && adminPct > revPct + 5) {
      hints.push(
        "Admin expense growth appears to outpace revenue growth — explain using the cited metrics, statement lines, and qualitative sections only.",
      );
    }
  }

  if (section === "liquidity") {
    const runway = byDef.get("cash_runway_months");
    if (runway?.value != null && Number(runway.value) < 12) {
      hints.push(
        "Cash runway is under 12 months — note the figure with a citation; do not invent remedies.",
      );
    }
  }

  return hints;
}

async function loadMetricsForSection(
  periodId: string,
  section: CategoryId,
): Promise<MetricContextItem[]> {
  const db = getDb();
  if (!db) return [];

  const metricIds = CATEGORY_METRIC_IDS[section];
  const priorId = priorPeriodId(periodId);

  const rows = await db
    .select({
      metricValueId: metricValues.id,
      metricDefId: metricValues.metricDefId,
      label: metricDefs.label,
      value: metricValues.value,
      unit: metricDefs.unit,
    })
    .from(metricValues)
    .innerJoin(metricDefs, eq(metricDefs.id, metricValues.metricDefId))
    .where(
      and(eq(metricValues.periodId, periodId), inArray(metricValues.metricDefId, metricIds)),
    );

  const priorRows =
    priorId != null
      ? await db
          .select({
            metricDefId: metricValues.metricDefId,
            value: metricValues.value,
          })
          .from(metricValues)
          .where(
            and(eq(metricValues.periodId, priorId), inArray(metricValues.metricDefId, metricIds)),
          )
      : [];
  const priorByDef = new Map(priorRows.map((r) => [r.metricDefId, r.value]));

  return rows.map((r) => {
    const prior = priorByDef.get(r.metricDefId) ?? null;
    let deltaAbs: string | null = null;
    let deltaPct: string | null = null;
    if (r.value != null && prior != null) {
      const cur = Number(r.value);
      const prv = Number(prior);
      if (Number.isFinite(cur) && Number.isFinite(prv)) {
        deltaAbs = (cur - prv).toString();
        if (Math.abs(prv) > 1e-9) {
          deltaPct = (((cur - prv) / Math.abs(prv)) * 100).toFixed(2);
        }
      }
    }
    return {
      metricValueId: r.metricValueId,
      metricDefId: r.metricDefId,
      label: r.label,
      value: fmt(r.value),
      unit: r.unit,
      priorValue: fmt(prior),
      deltaAbs,
      deltaPct,
    };
  });
}

/** Load approved statement lines (current + prior) and operating KPIs for the pack. */
async function loadReportFacts(periodId: string): Promise<ReportFactItem[]> {
  const db = getDb();
  if (!db) return [];

  const priorId = priorPeriodId(periodId);
  const facts: ReportFactItem[] = [];

  const currentLines = await db
    .select({
      code: statementLines.lineItemCode,
      label: lineItemDefs.label,
      amount: statementLines.amount,
    })
    .from(statementLines)
    .innerJoin(lineItemDefs, eq(lineItemDefs.code, statementLines.lineItemCode))
    .where(eq(statementLines.periodId, periodId));

  const priorByCode = new Map<string, string>();
  if (priorId) {
    const priorLines = await db
      .select({
        code: statementLines.lineItemCode,
        amount: statementLines.amount,
      })
      .from(statementLines)
      .where(eq(statementLines.periodId, priorId));
    for (const row of priorLines) {
      priorByCode.set(row.code, row.amount);
    }
  }

  for (const row of currentLines) {
    facts.push({
      code: row.code,
      label: row.label,
      value: fmt(row.amount),
      priorValue: fmt(priorByCode.get(row.code) ?? null),
      unit: "EUR",
      source: "statement_line",
    });
  }

  const kpis = await db
    .select({
      key: operatingKpis.key,
      label: operatingKpis.label,
      value: operatingKpis.value,
      unit: operatingKpis.unit,
    })
    .from(operatingKpis)
    .where(eq(operatingKpis.periodId, periodId));

  for (const k of kpis) {
    facts.push({
      code: k.key,
      label: k.label,
      value: fmt(k.value),
      unit: k.unit,
      source: "operating_kpi",
    });
  }

  return facts;
}

async function loadQualitativeSections(periodId: string): Promise<QualitativeSection[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({
      key: documentSections.key,
      sourceHeading: documentSections.sourceHeading,
      body: documentSections.body,
    })
    .from(documentSections)
    .where(eq(documentSections.periodId, periodId));

  return rows.map((r) => ({
    key: r.key as QualitativeSectionKey,
    sourceHeading: r.sourceHeading || QUALITATIVE_SECTION_LABELS[r.key as QualitativeSectionKey] || r.key,
    body: r.body,
  }));
}

/**
 * Full-pack context for a single commentary API call
 * (metrics + statement lines / KPIs + approved qualitative sections).
 */
export async function assemblePackCommentaryContext(
  periodId: string,
): Promise<PackCommentaryContext> {
  const metricsBySection = {} as Record<CategoryId, MetricContextItem[]>;
  const anomalyHints: string[] = [];

  for (const section of CATEGORY_IDS) {
    const metrics = await loadMetricsForSection(periodId, section);
    metricsBySection[section] = metrics;
    for (const h of anomalyHintsFor(section, metrics)) {
      anomalyHints.push(`[${section}] ${h}`);
    }
  }

  const [qualitativeSections, reportFacts] = await Promise.all([
    loadQualitativeSections(periodId),
    loadReportFacts(periodId),
  ]);

  if (qualitativeSections.length === 0) {
    throw new Error(
      "Qualitative sections are not approved yet — approve qualitative text before generating insights.",
    );
  }

  const hashInput = JSON.stringify({
    metrics: Object.fromEntries(
      CATEGORY_IDS.map((s) => [
        s,
        metricsBySection[s].map((m) => [m.metricDefId, m.value, m.priorValue]),
      ]),
    ),
    reportFacts: reportFacts.map((f) => [f.code, f.value, f.priorValue]),
    qualitativeSections: qualitativeSections.map((s) => [s.key, s.sourceHeading, s.body]),
    promptVersion: COMMENTARY_PROMPT_VERSION,
  });
  const dataHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 32);

  return {
    periodId,
    metricsBySection,
    reportFacts,
    qualitativeSections,
    anomalyHints,
    dataHash,
    promptVersion: COMMENTARY_PROMPT_VERSION,
  };
}

/** True when the period has live statement lines (financials approved). */
export async function periodHasApprovedPack(periodId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: statementLines.id })
    .from(statementLines)
    .where(eq(statementLines.periodId, periodId))
    .limit(1);
  return Boolean(row);
}

/** True when qualitative sections have been approved for the period. */
export async function periodHasApprovedQualitative(periodId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: documentSections.id })
    .from(documentSections)
    .where(eq(documentSections.periodId, periodId))
    .limit(1);
  return Boolean(row);
}
