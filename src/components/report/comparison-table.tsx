import { formatEur, formatPct, formatPp } from "@/lib/money";
import type { ComparisonMetric, ComparisonUnit } from "@/modules/metrics/compare";
import { deltaSentiment } from "@/modules/metrics/delta-sentiment";
import { cn } from "@/lib/utils";

function formatValue(
  unit: ComparisonUnit,
  value: number | null,
  meaningfulness: ComparisonMetric["meaningfulness"],
): string {
  if (value === null) {
    return meaningfulness === "degenerate" || meaningfulness === "not_meaningful" ? "n/m" : "—";
  }
  switch (unit) {
    case "EUR":
      return formatEur(value);
    case "percent":
      return formatPct(value);
    case "pp":
      return formatPp(value);
    case "months":
      return `${value.toFixed(1)} mo`;
    case "ratio":
      return `${value.toFixed(2)}x`;
    default:
      return String(value);
  }
}

function formatDelta(unit: ComparisonUnit, value: number | null): string {
  if (value === null) return "—";
  if (unit === "pp") return formatPp(value);
  if (unit === "percent") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${formatPct(value)}`;
  }
  if (unit === "EUR") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${formatEur(value)}`;
  }
  if (unit === "months") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)} mo`;
  }
  if (unit === "ratio") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}x`;
  }
  return String(value);
}

export function ComparisonTable({
  metrics,
  priorLabel,
  currentLabel,
}: {
  metrics: ComparisonMetric[];
  priorLabel: string;
  currentLabel: string;
}) {
  if (metrics.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2.5 pr-4 font-medium">Metric</th>
            <th className="py-2.5 pr-4 font-medium tabular-nums">{priorLabel}</th>
            <th className="py-2.5 pr-4 font-medium tabular-nums">{currentLabel}</th>
            <th className="py-2.5 font-medium tabular-nums">YoY Change</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const levelsMuted =
              m.meaningfulness === "degenerate" || m.meaningfulness === "not_meaningful";
            // Only DSCR-style degenerate rows suppress YoY; not_meaningful still shows direction.
            const showDelta = m.delta != null && m.meaningfulness !== "degenerate";
            const up = showDelta && m.delta! > 0;
            const down = showDelta && m.delta! < 0;
            const sentiment = showDelta ? deltaSentiment(m) : "neutral";
            return (
              <tr key={m.id} className="border-b border-border/70 align-top">
                <td className="py-3 pr-4 text-foreground/90">
                  <div>{m.label}</div>
                </td>
                <td
                  className={cn(
                    "py-3 pr-4 font-mono tabular-nums",
                    levelsMuted ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {formatValue(m.unit, m.prior, m.meaningfulness)}
                </td>
                <td
                  className={cn(
                    "py-3 pr-4 font-mono tabular-nums",
                    levelsMuted ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {formatValue(m.unit, m.current, m.meaningfulness)}
                </td>
                <td
                  className={cn(
                    "py-3 font-mono tabular-nums",
                    !showDelta && "text-muted-foreground",
                    sentiment === "good" && "text-emerald-800",
                    sentiment === "bad" && "text-destructive",
                  )}
                >
                  {showDelta ? (
                    <>
                      {formatDelta(m.deltaUnit, m.delta)}
                      {up && <span aria-hidden="true"> ▲</span>}
                      {down && <span aria-hidden="true"> ▼</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
