"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  approveAllInsightsAction,
  clearInsightAction,
  loadAdminInsights,
  regeneratePackInsights,
  updateInsightAction,
} from "@/modules/ai/actions";
import { CATEGORY_IDS } from "@/config/metric-categories";

type InsightCitation = {
  metricLabel: string | null;
  pageRef: string | null;
  quote: string | null;
};

type InsightRow = {
  id: string;
  section: string;
  body: string;
  status: string;
  citations: InsightCitation[];
};

export function IngestInsightsPanel({
  periodId,
  packApproved,
}: {
  periodId: string;
  packApproved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const autoTriggered = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await loadAdminInsights(periodId);
    setInsights(
      rows.map((r) => ({
        id: r.id,
        section: r.section,
        body: r.body,
        status: r.status,
        citations: r.citations.map((c) => ({
          metricLabel: c.metricLabel,
          pageRef: c.pageRef,
          quote: c.quote,
        })),
      })),
    );
    return rows;
  }, [periodId]);

  const regenerate = useCallback(() => {
    setGenerating(true);
    startTransition(async () => {
      setMessage("Generating commentary…");
      const result = await regeneratePackInsights(periodId);
      if ("error" in result) {
        setMessage(result.error);
      } else {
        const warn =
          result.warnings && result.warnings.length > 0
            ? ` Warnings: ${result.warnings.join("; ")}`
            : "";
        setMessage(`${result.success}${warn}`);
      }
      await refresh();
      setDrafts({});
      setGenerating(false);
    });
  }, [periodId, refresh]);

  useEffect(() => {
    if (!packApproved) return;
    void (async () => {
      const rows = await refresh();
      const needsGeneration =
        rows.length === 0 || rows.every((r) => r.status === "stale");
      if (needsGeneration && autoTriggered.current !== periodId) {
        autoTriggered.current = periodId;
        regenerate();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packApproved, periodId]);

  function onApproveAll() {
    startTransition(async () => {
      const result = await approveAllInsightsAction(periodId);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      // Board report is the dashboard — send the admin there so approved
      // commentary is visible under each section.
      window.location.href = `/reports/${periodId}`;
    });
  }

  function onSaveBody(insightId: string, body: string) {
    startTransition(async () => {
      const result = await updateInsightAction(insightId, body);
      if ("error" in result) {
        setMessage(result.error);
      } else {
        setJustSaved((prev) => ({ ...prev, [insightId]: true }));
        setTimeout(() => {
          setJustSaved((prev) => ({ ...prev, [insightId]: false }));
        }, 4000);
      }
      void refresh();
    });
  }

  function onClearInsight(insightId: string) {
    if (!confirm("Clear this section’s commentary? It will not appear on the board report.")) {
      return;
    }
    startTransition(async () => {
      const result = await clearInsightAction(insightId);
      if ("error" in result) {
        setMessage(result.error);
      } else {
        setDrafts((prev) => ({ ...prev, [insightId]: "" }));
        setMessage(result.success);
      }
      void refresh();
    });
  }

  if (!packApproved) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Approve financials and qualitative sections first. Commentary is then generated automatically.
      </div>
    );
  }

  const allApproved =
    insights.length > 0 && insights.every((r) => r.status === "approved");

  if (allApproved && !generating) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-serif text-xl">Insights</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review generated commentary, then approve to publish on the board report.
      </p>
      <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onApproveAll} disabled={pending || generating}>
          {pending && !generating ? "Approving…" : "Approve all generated"}
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="space-y-4">
        {CATEGORY_IDS.map((section) => {
          const row = insights.find((i) => i.section === section);
          const draftValue = drafts[row?.id ?? ""] ?? row?.body ?? "";
          const dirty = row != null && drafts[row.id] != null && drafts[row.id] !== row.body;
          const showSaved = row != null && justSaved[row.id] === true;
          return (
            <div key={section} className="rounded-lg border border-border/80 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif text-lg capitalize">{section}</h3>
                <span className="text-xs uppercase text-muted-foreground">
                  {row?.status ?? "none"}
                </span>
              </div>

              {row ? (
                <textarea
                  className="mt-2 min-h-[6rem] w-full resize-y rounded-md border border-input bg-transparent p-2 text-sm text-foreground/90 leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                  value={draftValue}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  onBlur={() => {
                    if (dirty) onSaveBody(row.id, draftValue);
                  }}
                  disabled={generating}
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {generating ? "Generating…" : "Not generated yet."}
                </p>
              )}
              {row ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {draftValue.trim().length === 0
                    ? "No commentary — this section will be blank on the board."
                    : dirty
                      ? "Unsaved edits — click away to save."
                      : showSaved
                        ? "Saved."
                        : "\u00A0"}
                </p>
              ) : null}

              {row ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={pending || generating || draftValue.trim().length === 0}
                    onClick={() => onClearInsight(row.id)}
                  >
                    Clear insight
                  </Button>
                </div>
              ) : null}

              {row && row.citations.some((c) => c.pageRef || c.quote) ? (
                <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Verify sources
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                    {row.citations
                      .filter((c) => c.pageRef || c.quote)
                      .map((c, i) => (
                        <li key={i}>
                          {c.pageRef ? (
                            <span className="font-medium text-foreground/80">PDF {c.pageRef}</span>
                          ) : null}
                          {c.quote ? (
                            <span className="mt-0.5 block italic text-muted-foreground/90">
                              “{c.quote}”
                            </span>
                          ) : null}
                        </li>
                      ))}
                  </ol>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
