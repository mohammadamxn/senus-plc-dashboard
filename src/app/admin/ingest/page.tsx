import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/modules/auth/session";
import {
  countStatementLines,
  getLatestExtractionJob,
  getExtractionJobWithDraft,
  listRemovableReportPeriods,
} from "@/modules/ingestion/actions";
import { IngestPanel } from "@/components/admin/ingest-panel";
import { AdminShell } from "@/components/admin/admin-shell";
import type { ExtractionPayload } from "@/modules/ingestion/schema";
import { syncFiscalPeriods } from "@/modules/periods/sync";
import { priorPeriodId } from "@/modules/periods/generate";
import chartOfAccounts from "@/../content/seed/chart-of-accounts.json";

export default async function AdminIngestPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isAdmin) redirect("/reports/hy2026");

  const periods = await syncFiscalPeriods(new Date());

  const sp = await searchParams;
  const [lineCount, loadedPeriods] = await Promise.all([
    countStatementLines(),
    listRemovableReportPeriods(),
  ]);
  const jobView = sp.job
    ? await getExtractionJobWithDraft(sp.job)
    : await getLatestExtractionJob();

  const draftPayload = (jobView?.draft?.payload ?? null) as ExtractionPayload | null;
  const periodId = jobView?.job.periodId ?? "hy2026";
  const comparativePeriodId =
    jobView?.job.comparativePeriodId ??
    draftPayload?.comparativePeriodId ??
    priorPeriodId(periodId);

  const lineItemOptions = chartOfAccounts.map((c) => ({ code: c.code, label: c.label }));

  return (
    <AdminShell
      currentPath="/admin/ingest"
      title="Ingest financial PDF"
      description="AI extracts statement lines and KPIs; you review and can edit or add lines before approve. Then code calculates board metrics. Nothing goes live without approve. Half-year periods run from HY2018 through the latest half-year that has ended."
    >
      <IngestPanel
        isEmpty={lineCount === 0}
        periods={periods}
        loadedPeriods={loadedPeriods}
        lineItemOptions={lineItemOptions}
        latestJob={
          jobView
            ? {
                id: jobView.job.id,
                status: jobView.job.status,
                sourceFilename: jobView.job.sourceFilename,
                error: jobView.job.error,
                periodId,
                comparativePeriodId,
                draft: draftPayload,
              }
            : null
        }
      />
    </AdminShell>
  );
}
