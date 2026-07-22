import { redirect } from "next/navigation";
import Link from "next/link";
import { ReportShell } from "@/components/layout/report-shell";
import { ComparisonTable } from "@/components/report/comparison-table";
import { ChartCard } from "@/components/report/chart-card";
import { SectionViewToggle } from "@/components/report/section-view-toggle";
import { MetricYoYChartGrid } from "@/components/report/metric-yoy-chart-grid";
import { CashBridge } from "@/components/report/cash-bridge";
import { CashWalkTable } from "@/components/report/cash-walk-table";
import { ReportSection } from "@/components/report/report-section";
import { StatementTabs } from "@/components/report/statement-tabs";
import { CashWalkChart } from "@/components/report/charts/cash-walk-chart";
import { EbitdaBridgeWaterfall } from "@/components/report/charts/ebitda-bridge-waterfall";
import { loadReport, type ReportBundle } from "@/modules/reporting/load-report";
import type { ComparisonMetric } from "@/modules/metrics/compare";
import { getCurrentProfile } from "@/modules/auth/session";
import type { AudienceId } from "@/config/site";
import {
  visibleCategoriesFor,
  isMetricVisibleFor,
  REPORT_COMPARE_METRIC_IDS,
} from "@/config/metric-categories";
import { Button } from "@/components/ui/button";
import { countStatementLines, listAvailableReportPeriods } from "@/modules/ingestion/actions";
import { InsightPanel } from "@/components/report/insight-panel";
import { loadInsightsForPeriod } from "@/modules/ai/load-insights";
import type { CategoryId } from "@/config/metric-categories";

function pickComparisonMetrics(
  metrics: ComparisonMetric[],
  ids: string[],
  audience: AudienceId,
): ComparisonMetric[] {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  return ids
    .filter((id) => isMetricVisibleFor(audience, id))
    .map((id) => byId.get(id))
    .filter((m): m is ComparisonMetric => Boolean(m));
}

function provenanceLine(report: ReportBundle, kind: "statutory" | "outlook"): string {
  if (kind === "outlook") {
    return `${report.period.label} · ${report.period.basis} (chairman / management KPIs)`;
  }
  const prior = report.comparativeLabel;
  if (prior) {
    return `${prior} vs ${report.period.label} · ${report.period.basis} · same-period YoY (HY)`;
  }
  return `${report.period.label} · ${report.period.basis}`;
}

export default async function ReportPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.audience) {
    redirect("/login?error=no_role");
  }
  const audience = profile.audience;

  const statementPeriodId = period === "fy2026" ? "hy2026" : period;
  const [lineCount, availablePeriods] = await Promise.all([
    countStatementLines(statementPeriodId),
    listAvailableReportPeriods(),
  ]);

  const kpiOnlyAvailable = availablePeriods.some((p) => p.id === period);
  const hasPack = lineCount > 0 || (period.startsWith("fy") && kpiOnlyAvailable);

  if (!hasPack) {
    return (
      <ReportShell
        audience={audience}
        email={profile.email}
        isAdmin={profile.isAdmin}
        periodId={period}
        availablePeriods={availablePeriods}
      >
        <div className="rounded-lg border border-border bg-card/60 p-8 text-center">
          <h2 className="font-serif text-2xl">Report not available yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No approved financial pack is loaded for this period.
            {availablePeriods.length > 0
              ? " Use the period menu below the header to open a pack that has data."
              : null}
          </p>
          {profile.isAdmin && (
            <Button asChild className="mt-6">
              <Link href="/admin/ingest">Upload a PDF to extract data</Link>
            </Button>
          )}
        </div>
      </ReportShell>
    );
  }

  const report: ReportBundle = await loadReport(period, audience);
  const insightRows = await loadInsightsForPeriod(period, {
    includeStatuses:
      audience === "management" || audience === "board" || profile.isAdmin
        ? ["pending", "generated", "approved"]
        : ["approved"],
  });
  const insightBySection = new Map<string, (typeof insightRows)[number]>();
  for (const row of insightRows) {
    insightBySection.set(row.section, row);
  }
  function insightFor(section: CategoryId) {
    const row = insightBySection.get(section);
    if (!row) return null;
    return {
      id: row.id,
      body: row.body,
      status: row.status,
    };
  }

  const isOutlook = period === "fy2026";
  const visibleCategories = visibleCategoriesFor(audience);
  const canSeeStatements = (audience === "management" || audience === "board") && !isOutlook;

  const currentHyLabel = report.period.label;
  const priorHyLabel = report.comparativeLabel ?? "Prior";
  const currentLabel = `${currentHyLabel} \u20ac`;
  const priorLabel = `${priorHyLabel} \u20ac`;

  const SECTION_ORDER = ["growth", "profitability", "liquidity", "solvency", "returns", "statements"] as const;
  const sectionVisible: Record<(typeof SECTION_ORDER)[number], boolean> = {
    growth: visibleCategories.has("growth") && !isOutlook,
    profitability: visibleCategories.has("profitability") && !isOutlook,
    liquidity: visibleCategories.has("liquidity"),
    solvency: visibleCategories.has("solvency") && !isOutlook,
    returns: visibleCategories.has("returns") && !isOutlook,
    statements: canSeeStatements,
  };
  if (isOutlook) {
    sectionVisible.growth = false;
    sectionVisible.profitability = false;
    sectionVisible.solvency = false;
    sectionVisible.returns = false;
    sectionVisible.statements = false;
    sectionVisible.liquidity = visibleCategories.has("liquidity");
  }

  const sectionNumber: Record<(typeof SECTION_ORDER)[number], string> = {
    growth: "",
    profitability: "",
    liquidity: "",
    solvency: "",
    returns: "",
    statements: "",
  };
  let visibleSectionCount = 0;
  for (const id of SECTION_ORDER) {
    if (sectionVisible[id]) {
      visibleSectionCount += 1;
      sectionNumber[id] = String(visibleSectionCount).padStart(2, "0");
    }
  }

  const statutoryProv = provenanceLine(report, "statutory");
  const outlookProv = provenanceLine(report, "outlook");
  const compareIds = REPORT_COMPARE_METRIC_IDS;

  const growthMetrics = pickComparisonMetrics(report.comparisonMetrics, compareIds.growth, audience);
  const profitabilityMetrics = pickComparisonMetrics(
    report.comparisonMetrics,
    compareIds.profitability,
    audience,
  );
  const liquidityMetrics = pickComparisonMetrics(
    report.comparisonMetrics,
    compareIds.liquidity,
    audience,
  );
  const solvencyMetrics = pickComparisonMetrics(report.comparisonMetrics, compareIds.solvency, audience);
  const returnsMetrics = pickComparisonMetrics(report.comparisonMetrics, compareIds.returns, audience);

  return (
    <ReportShell
      audience={audience}
      email={profile.email}
      isAdmin={profile.isAdmin}
      periodId={period}
      availablePeriods={availablePeriods}
    >
      {sectionVisible.growth && (
        <ReportSection
          id="growth"
          eyebrow={sectionNumber.growth}
          title="Growth & Revenue"
          description={`${statutoryProv}. Every figure compared to the same half last year.`}
        >
          <SectionViewToggle
            table={
              <ComparisonTable
                metrics={growthMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
            chart={
              <MetricYoYChartGrid
                metrics={growthMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
          />
          <InsightPanel section="growth" initial={insightFor("growth")} />
        </ReportSection>
      )}

      {sectionVisible.profitability && (
        <ReportSection
          id="profitability"
          eyebrow={sectionNumber.profitability}
          title="Profitability"
          description={`${statutoryProv}. Margins and costs vs the same half last year.`}
        >
          <SectionViewToggle
            table={
              <ComparisonTable
                metrics={profitabilityMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
            chart={
              <MetricYoYChartGrid
                metrics={profitabilityMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
          />
          <InsightPanel section="profitability" initial={insightFor("profitability")} />
        </ReportSection>
      )}

      {sectionVisible.liquidity && (
        <ReportSection
          id="liquidity"
          eyebrow={sectionNumber.liquidity}
          title="Cash & Liquidity"
          description={
            isOutlook
              ? `${outlookProv}. HY statutory cash vs FYE management cash and intended fundraise.`
              : `${statutoryProv}. Cash and runway vs the same half last year.`
          }
        >
          {isOutlook ? (
            <p className="text-sm text-muted-foreground">
              Outlook pack — statutory HY cash and fundraise context appear when KPIs are loaded.
            </p>
          ) : (
            <SectionViewToggle
              table={
                <>
                  <ComparisonTable
                    metrics={liquidityMetrics}
                    priorLabel={priorHyLabel}
                    currentLabel={currentHyLabel}
                  />
                  <CashWalkTable steps={report.cashWalk} periodLabel={currentHyLabel} />
                  <CashBridge steps={report.bridge} periodLabel={currentHyLabel} />
                </>
              }
              chart={
                <>
                  <MetricYoYChartGrid
                    metrics={liquidityMetrics}
                    priorLabel={priorHyLabel}
                    currentLabel={currentHyLabel}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <ChartCard title={`Cash movement walk (${currentHyLabel})`}>
                      <CashWalkChart steps={report.cashWalk} />
                    </ChartCard>
                    <ChartCard title={`EBITDA → FCF bridge (${currentHyLabel})`}>
                      <EbitdaBridgeWaterfall steps={report.bridge} />
                    </ChartCard>
                  </div>
                </>
              }
            />
          )}
          <InsightPanel section="liquidity" initial={insightFor("liquidity")} />
        </ReportSection>
      )}

      {sectionVisible.solvency && (
        <ReportSection
          id="solvency"
          eyebrow={sectionNumber.solvency}
          title="Solvency & Leverage"
          description={`${statutoryProv}. Ratios and equity vs the same half last year.`}
        >
          <SectionViewToggle
            table={
              <>
                <ComparisonTable
                  metrics={solvencyMetrics}
                  priorLabel={priorHyLabel}
                  currentLabel={currentHyLabel}
                />
                {report.integrityIssues.length === 0 ? (
                  <p className="mt-6 text-xs text-emerald-800">
                    Statement integrity checks passed (fixed assets roll-up, cash BS↔CF tie, equity
                    tie).
                  </p>
                ) : (
                  <ul className="mt-6 text-xs text-destructive">
                    {report.integrityIssues.map((i) => (
                      <li key={i.code}>{i.message}</li>
                    ))}
                  </ul>
                )}
              </>
            }
            chart={
              <MetricYoYChartGrid
                metrics={solvencyMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
          />
          <InsightPanel section="solvency" initial={insightFor("solvency")} />
        </ReportSection>
      )}

      {sectionVisible.returns && (
        <ReportSection
          id="returns"
          eyebrow={sectionNumber.returns}
          title="Returns"
          description={`${statutoryProv}. Half-year ROCE/ROE vs the same half last year.`}
        >
          <SectionViewToggle
            table={
              <ComparisonTable
                metrics={returnsMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
            chart={
              <MetricYoYChartGrid
                metrics={returnsMetrics}
                priorLabel={priorHyLabel}
                currentLabel={currentHyLabel}
              />
            }
          />
          <InsightPanel section="returns" initial={insightFor("returns")} />
        </ReportSection>
      )}

      {sectionVisible.statements && (
        <ReportSection
          id="statements"
          eyebrow={sectionNumber.statements}
          title="Financial statements"
          description={`${statutoryProv}. Full FRS 102 layout.`}
        >
          <StatementTabs
            plRows={report.plRows}
            bsRows={report.bsRows}
            cfRows={report.cfRows}
            currentLabel={currentLabel}
            priorLabel={priorLabel}
          />
        </ReportSection>
      )}
    </ReportShell>
  );
}
