"use client";

import { useRouter } from "next/navigation";
import type { AvailableReportPeriod } from "@/modules/ingestion/actions";
import { priorPeriodId } from "@/modules/periods/generate";

function pairLabel(periodId: string, label: string): string {
  const priorId = priorPeriodId(periodId);
  if (!priorId) return label;
  return `${label} vs ${priorId.toUpperCase()}`;
}

export function PeriodSwitcher({
  periods,
  currentPeriodId,
}: {
  periods: AvailableReportPeriod[];
  currentPeriodId: string;
}) {
  const router = useRouter();

  if (periods.length === 0) return null;

  const hasCurrent = periods.some((p) => p.id === currentPeriodId);
  const options = hasCurrent
    ? periods
    : [
        {
          id: currentPeriodId,
          label: currentPeriodId.toUpperCase(),
          basis: "no data",
          periodType: currentPeriodId.startsWith("fy") ? "FY" : "HY",
        },
        ...periods,
      ];

  return (
    <div className="inline-flex w-fit flex-col gap-1">
      <label
        htmlFor="report-period"
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Comparing
      </label>
      <select
        id="report-period"
        value={currentPeriodId}
        onChange={(e) => router.push(`/reports/${e.target.value}`)}
        className="h-9 w-fit max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        title="Compares this half-year to the same half last year (YoY)."
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {pairLabel(p.id, p.label)}
          </option>
        ))}
      </select>
    </div>
  );
}
