"use client";

import { useMemo, useState, useTransition } from "react";
import {
  runPdfExtraction,
  approveExtractionJob,
  rejectExtractionJob,
  clearPeriodData,
  updateExtractionDraft,
  type IngestActionResult,
  type AvailableReportPeriod,
} from "@/modules/ingestion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findPeriod,
  optionLabel,
  priorPeriodId,
  type GeneratedPeriod,
} from "@/modules/periods/generate";
import {
  IngestReviewToggle,
  type IngestReviewTab,
} from "@/components/admin/ingest-review-toggle";
import { IngestInsightsPanel } from "@/components/admin/ingest-insights-panel";

type DraftLine = { code: string; current: number; prior: number };
type DraftKpi = {
  periodId: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  basis: "audited" | "unaudited" | "management";
  sourceRef?: string;
};
type DraftPayload = {
  periodId?: string;
  comparativePeriodId?: string | null;
  documentTitle?: string;
  basis?: "audited" | "unaudited" | "management";
  statementLines?: DraftLine[];
  operatingKpis?: DraftKpi[];
  storagePath?: string;
};

export type LineItemOption = { code: string; label: string };

function packLabel(periodId: string, label: string): string {
  const priorId = priorPeriodId(periodId);
  if (!priorId) return label;
  return `${priorId.toUpperCase()} - ${label}`;
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function IngestPanel({
  isEmpty,
  periods,
  loadedPeriods,
  lineItemOptions,
  latestJob,
}: {
  isEmpty: boolean;
  periods: GeneratedPeriod[];
  loadedPeriods: AvailableReportPeriod[];
  lineItemOptions: LineItemOption[];
  latestJob: {
    id: string;
    status: string;
    sourceFilename: string | null;
    error: string | null;
    periodId: string;
    comparativePeriodId: string | null;
    draft: DraftPayload | null;
  } | null;
}) {
  const hyPeriods = useMemo(
    () => periods.filter((p) => p.periodType === "HY"),
    [periods],
  );

  const removablePeriods = useMemo(
    () => loadedPeriods.filter((p) => p.periodType === "HY"),
    [loadedPeriods],
  );

  const defaultPeriodId =
    hyPeriods.find((p) => p.id === "hy2026")?.id ??
    hyPeriods[hyPeriods.length - 1]?.id ??
    "hy2026";

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<IngestActionResult | null>(null);
  const [jobId, setJobId] = useState(latestJob?.id ?? null);
  const [draft, setDraft] = useState<DraftPayload | null>(latestJob?.draft ?? null);
  const [status, setStatus] = useState(latestJob?.status ?? null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(() => {
    const initial = latestJob?.periodId ?? defaultPeriodId;
    return hyPeriods.some((p) => p.id === initial) ? initial : defaultPeriodId;
  });
  const [clearPeriodId, setClearPeriodId] = useState(
    () => removablePeriods[0]?.id ?? defaultPeriodId,
  );
  const [addCode, setAddCode] = useState("");
  const [reviewTab, setReviewTab] = useState<IngestReviewTab>("financials");

  const options = useMemo(() => {
    return [...hyPeriods].reverse().map((p) => {
      const priorId = priorPeriodId(p.id);
      const prior = priorId
        ? findPeriod(priorId) ?? hyPeriods.find((x) => x.id === priorId) ?? null
        : null;
      return { period: p, label: optionLabel(p, prior) };
    });
  }, [hyPeriods]);

  const draftPrimaryId = draft?.periodId ?? latestJob?.periodId ?? selectedPeriodId;
  const draftPriorId =
    draft?.comparativePeriodId ?? latestJob?.comparativePeriodId ?? priorPeriodId(draftPrimaryId);
  const draftPrimaryLabel =
    findPeriod(draftPrimaryId)?.label ??
    periods.find((p) => p.id === draftPrimaryId)?.label ??
    draftPrimaryId.toUpperCase();
  const draftPriorLabel = draftPriorId
    ? findPeriod(draftPriorId)?.label ??
      periods.find((p) => p.id === draftPriorId)?.label ??
      draftPriorId.toUpperCase()
    : "—";

  const lines = draft?.statementLines ?? [];
  const usedCodes = useMemo(() => new Set(lines.map((l) => l.code)), [lines]);
  const availableToAdd = useMemo(
    () => lineItemOptions.filter((o) => !usedCodes.has(o.code)),
    [lineItemOptions, usedCodes],
  );

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setDraft((prev) => {
      if (!prev?.statementLines) return prev;
      const next = prev.statementLines.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...prev, statementLines: next };
    });
  }

  function removeLine(index: number) {
    setDraft((prev) => {
      if (!prev?.statementLines) return prev;
      return {
        ...prev,
        statementLines: prev.statementLines.filter((_, i) => i !== index),
      };
    });
  }

  function addLine() {
    const code = addCode || availableToAdd[0]?.code;
    if (!code || !draft) return;
    setDraft({
      ...draft,
      statementLines: [...(draft.statementLines ?? []), { code, current: 0, prior: 0 }],
    });
    setAddCode("");
  }

  function buildPayloadForSave(): DraftPayload | null {
    if (!draft?.periodId || !draft.documentTitle || !draft.basis) return null;
    if (!draft.statementLines?.length) return null;
    return {
      periodId: draft.periodId,
      comparativePeriodId: draft.comparativePeriodId ?? null,
      documentTitle: draft.documentTitle,
      basis: draft.basis,
      statementLines: draft.statementLines,
      operatingKpis: draft.operatingKpis ?? [],
      ...(draft.storagePath ? { storagePath: draft.storagePath } : {}),
    };
  }

  function onExtract(formData: FormData) {
    startTransition(async () => {
      const result = await runPdfExtraction(formData);
      setMessage(result);
      if ("jobId" in result && result.jobId) {
        setJobId(result.jobId);
        window.location.href = `/admin/ingest?job=${result.jobId}`;
      }
    });
  }

  function onApprove() {
    if (!jobId) return;
    const payload = buildPayloadForSave();
    if (!payload) {
      setMessage({ error: "Draft needs a title, basis, and at least one statement line." });
      return;
    }
    startTransition(async () => {
      const saved = await updateExtractionDraft(jobId, payload);
      if ("error" in saved) {
        setMessage(saved);
        return;
      }
      const result = await approveExtractionJob(jobId);
      setMessage(result);
      if ("success" in result) {
        setStatus("approved");
        setReviewTab("insights");
      }
    });
  }

  function onReject() {
    if (!jobId) return;
    startTransition(async () => {
      const result = await rejectExtractionJob(jobId);
      setMessage(result);
      if ("success" in result) setStatus("rejected");
    });
  }

  function onClearPack() {
    if (!clearPeriodId) return;
    const label = packLabel(
      clearPeriodId,
      removablePeriods.find((p) => p.id === clearPeriodId)?.label ?? clearPeriodId.toUpperCase(),
    );
    if (!window.confirm(`Remove all uploaded data for ${label}? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await clearPeriodData(clearPeriodId);
      setMessage(result);
      if ("success" in result) {
        window.location.href = "/admin/ingest";
      }
    });
  }

  return (
    <div className="space-y-8">
      {isEmpty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-5">
          <p className="font-medium text-amber-950">No financial pack loaded</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Upload a half-year results PDF to extract statement lines. After you review and approve,
            the metrics engine will calculate Growth &amp; Revenue, Profitability, Cash &amp;
            Liquidity, Solvency &amp; Leverage, and Returns into the database.
          </p>
        </div>
      )}

      <form action={onExtract} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Primary period
          </label>
          <select
            name="periodId"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {options.map(({ period, label }) => (
              <option key={period.id} value={period.id}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Comparison is always the previous half-year (HY→prior HY). The list grows automatically
            as new half-years end.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            PDF file
          </label>
          <Input name="pdf" type="file" accept="application/pdf,.pdf" className="mt-1" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Extracting…" : isEmpty ? "Upload & extract" : "Re-extract from PDF"}
        </Button>
      </form>

      {removablePeriods.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="font-serif text-xl">Remove pack</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Delete live statement lines, KPIs, metrics, and extraction jobs for a loaded period.
              Comparative prior columns are removed only if that prior was never loaded as its own
              pack.
            </p>
          </div>
          <div>
            <label
              htmlFor="clear-period"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Period to remove
            </label>
            <select
              id="clear-period"
              value={
                removablePeriods.some((p) => p.id === clearPeriodId)
                  ? clearPeriodId
                  : removablePeriods[0]!.id
              }
              onChange={(e) => setClearPeriodId(e.target.value)}
              className="mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {removablePeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {packLabel(p.id, p.label)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="destructive" onClick={onClearPack} disabled={pending}>
            {pending ? "Removing…" : "Remove pack"}
          </Button>
        </div>
      )}

      {message && (
        <p className={`text-sm ${"error" in message ? "text-destructive" : "text-emerald-800"}`}>
          {"error" in message ? message.error : message.success}
        </p>
      )}

      {status && (
        <p className="text-xs text-muted-foreground">
          Latest job: <span className="font-mono">{jobId}</span> · status{" "}
          <span className="uppercase">{status}</span>
          {latestJob?.sourceFilename ? ` · ${latestJob.sourceFilename}` : null}
        </p>
      )}

      {(status === "extracted" || status === "approved") && draft && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl">Review pack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Extracted for <strong>{draftPrimaryLabel}</strong>
            {draftPriorId ? (
              <>
                {" "}
                · compared to <strong>{draftPriorLabel}</strong>
              </>
            ) : null}
            . Review financials, then Approve. Commentary generates automatically with PDF page
            citations for review under Insights.
          </p>

          <div className="mt-4">
            <IngestReviewToggle
              value={reviewTab}
              onChange={setReviewTab}
              insightsLocked={status !== "approved"}
            />
          </div>

          <div className="mt-6">
            {reviewTab === "financials" && (
              <>
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-2">Line item</th>
                        <th className="py-2 pr-2 tabular-nums">{draftPrimaryLabel}</th>
                        <th className="py-2 pr-2 tabular-nums">{draftPriorLabel}</th>
                        <th className="py-2 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-sm text-muted-foreground">
                            No statement lines yet — add an entry below.
                          </td>
                        </tr>
                      ) : (
                        lines.map((l, index) => (
                          <tr key={`${l.code}-${index}`} className="border-b border-border/60">
                            <td className="py-1.5 pr-2">
                              <select
                                className="flex h-8 w-full min-w-[10rem] rounded-md border border-input bg-transparent px-2 font-mono text-xs"
                                value={l.code}
                                disabled={status === "approved"}
                                onChange={(e) => updateLine(index, { code: e.target.value })}
                              >
                                {!lineItemOptions.some((o) => o.code === l.code) && (
                                  <option value={l.code}>{l.code}</option>
                                )}
                                {lineItemOptions.map((o) => (
                                  <option
                                    key={o.code}
                                    value={o.code}
                                    disabled={usedCodes.has(o.code) && o.code !== l.code}
                                  >
                                    {o.code} — {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <Input
                                className="h-8 tabular-nums"
                                inputMode="decimal"
                                disabled={status === "approved"}
                                value={String(l.current)}
                                onChange={(e) =>
                                  updateLine(index, { current: parseAmount(e.target.value) })
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <Input
                                className="h-8 tabular-nums"
                                inputMode="decimal"
                                disabled={status === "approved"}
                                value={String(l.prior)}
                                onChange={(e) =>
                                  updateLine(index, { prior: parseAmount(e.target.value) })
                                }
                              />
                            </td>
                            <td className="py-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => removeLine(index)}
                                disabled={status === "approved" || lines.length <= 1}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {status === "extracted" && availableToAdd.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Add line item
                      </label>
                      <select
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={addCode || availableToAdd[0]!.code}
                        onChange={(e) => setAddCode(e.target.value)}
                      >
                        {availableToAdd.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.code} — {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="button" variant="outline" onClick={addLine} disabled={pending}>
                      Add entry
                    </Button>
                  </div>
                )}
              </>
            )}

            {reviewTab === "insights" && (
              <IngestInsightsPanel
                periodId={draftPrimaryId}
                packApproved={
                  status === "approved" ||
                  removablePeriods.some((p) => p.id === draftPrimaryId)
                }
              />
            )}
          </div>

          {status === "extracted" && reviewTab === "financials" ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" onClick={onApprove} disabled={pending || lines.length === 0}>
                Approve &amp; calculate metrics
              </Button>
              <Button type="button" variant="outline" onClick={onReject} disabled={pending}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
