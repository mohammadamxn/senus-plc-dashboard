"use client";

export type InsightPanelProps = {
  section: string;
  initial?: {
    id: string;
    body: string;
    status: string;
  } | null;
};

export function InsightPanel({ section, initial }: InsightPanelProps) {
  if (!initial?.body) return null;
  if (initial.status === "stale") return null;

  const { body, status } = initial;

  return (
    <aside className="mt-4 rounded-lg border border-border/70 bg-card/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          AI commentary · {section}
        </h3>
        {status === "generated" ? (
          <span className="text-xs text-amber-800">Preview</span>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{body}</p>
    </aside>
  );
}
