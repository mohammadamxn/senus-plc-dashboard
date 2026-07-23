import { formatEur, formatPct, formatPp } from "@/lib/money";
import type { ComparisonMetric, ComparisonUnit } from "@/modules/metrics/compare";
import { deltaSentiment } from "@/modules/metrics/delta-sentiment";
import { Card, CardContent } from "@/components/ui/card";
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

export function ComparisonKpiCard({
  metric,
  priorLabel,
  currentLabel,
}: {
  metric: ComparisonMetric;
  priorLabel: string;
  currentLabel: string;
}) {
  const muted =
    metric.meaningfulness === "not_meaningful" || metric.meaningfulness === "degenerate";
  const showDelta = metric.delta != null && metric.meaningfulness !== "degenerate";
  const up = showDelta && metric.delta! > 0;
  const down = showDelta && metric.delta! < 0;
  const sentiment = showDelta ? deltaSentiment(metric) : "neutral";

  return (
    <Card
      size="sm"
      className="rounded-none border-0 border-b border-border bg-transparent shadow-none ring-0"
    >
      <CardContent className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{priorLabel}</p>
            <p className={cn("mt-0.5 font-serif text-xl tabular-nums", muted && "text-muted-foreground")}>
              {formatValue(metric.unit, metric.prior, metric.meaningfulness)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{currentLabel}</p>
            <p className={cn("mt-0.5 font-serif text-xl tabular-nums", muted && "text-muted-foreground")}>
              {formatValue(metric.unit, metric.current, metric.meaningfulness)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">YoY</p>
            <p
              className={cn(
                "mt-0.5 font-serif text-xl tabular-nums",
                sentiment === "good" && "text-emerald-800",
                sentiment === "bad" && "text-destructive",
                !showDelta && "text-muted-foreground",
              )}
            >
              {showDelta ? (
                <>
                  {up && <span aria-hidden="true">▲ </span>}
                  {down && <span aria-hidden="true">▼ </span>}
                  {formatDelta(metric.deltaUnit, metric.delta)}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
