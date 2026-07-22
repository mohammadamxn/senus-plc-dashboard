"use client";

import { cn } from "@/lib/utils";

export type IngestReviewTab = "financials" | "insights";

const TABS: { id: IngestReviewTab; label: string }[] = [
  { id: "financials", label: "Financials" },
  { id: "insights", label: "Insights" },
];

export function IngestReviewToggle({
  value,
  onChange,
  insightsLocked,
}: {
  value: IngestReviewTab;
  onChange: (tab: IngestReviewTab) => void;
  insightsLocked?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Review sections"
      className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {TABS.map((tab) => {
        const locked = tab.id === "insights" && insightsLocked;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              value === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              locked && value !== tab.id && "opacity-70",
            )}
          >
            {tab.label}
            {locked ? <span className="ml-1 text-xs font-normal">(locked)</span> : null}
          </button>
        );
      })}
    </div>
  );
}
