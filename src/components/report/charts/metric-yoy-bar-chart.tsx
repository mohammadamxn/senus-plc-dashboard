"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ComparisonMetric, ComparisonUnit } from "@/modules/metrics/compare";

function formatTick(unit: ComparisonUnit, v: number): string {
  if (unit === "EUR") {
    return new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  if (unit === "percent" || unit === "pp") return `${v.toFixed(0)}%`;
  if (unit === "months") return `${v.toFixed(0)}`;
  if (unit === "ratio") return v.toFixed(1);
  return String(v);
}

type Row = {
  label: string;
  /** Transparent stack segment from 0 down to negative values (0 for positives). */
  base: number;
  /** Absolute bar length so the coloured segment always meets the 0 baseline. */
  extent: number;
  /** Signed level used for tooltips / domain. */
  signed: number;
  fill: string;
};

/** Encode a signed level so bars always grow from an explicit 0 baseline. */
function toZeroAnchored(label: string, value: number, fill: string): Row {
  return {
    label,
    base: Math.min(0, value),
    extent: Math.abs(value),
    signed: value,
    fill,
  };
}

export function MetricYoYBarChart({
  metric,
  priorLabel,
  currentLabel,
}: {
  metric: ComparisonMetric;
  priorLabel: string;
  currentLabel: string;
}) {
  const suppressed =
    metric.meaningfulness === "degenerate" || metric.meaningfulness === "not_meaningful";
  const bothMissing = metric.prior == null && metric.current == null;

  if (suppressed && bothMissing) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-2 text-center">
        <p className="font-mono text-2xl tabular-nums text-muted-foreground">n/m</p>
      </div>
    );
  }

  const chartConfig = {
    extent: { label: metric.label, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const rows: Row[] = [];
  if (metric.prior != null) {
    rows.push(toZeroAnchored(priorLabel, metric.prior, "var(--chart-1)"));
  }
  if (metric.current != null) {
    rows.push(toZeroAnchored(currentLabel, metric.current, "var(--chart-4)"));
  }

  if (rows.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center">
        <p className="font-mono text-2xl tabular-nums text-muted-foreground">n/m</p>
      </div>
    );
  }

  const signed = rows.map((r) => r.signed);
  const yDomain: [number, number] = [Math.min(0, ...signed), Math.max(0, ...signed)];
  const hasNegative = signed.some((v) => v < 0);
  // Round only the outer tip of positive bars; keep negatives flush with the 0 line.
  const barRadius = hasNegative ? 0 : ([3, 3, 0, 0] as [number, number, number, number]);

  return (
    <ChartContainer config={chartConfig} className="aspect-[4/3] w-full">
      <BarChart data={rows} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          type="number"
          domain={yDomain}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatTick(metric.unit, Number(v))}
          width={48}
        />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_v, _n, item) => (
                <span className="font-mono tabular-nums">
                  {formatTick(metric.unit, (item.payload as Row).signed)}
                </span>
              )}
            />
          }
        />
        {/* Transparent pedestal + absolute extent: negatives drop from 0, positives rise from 0. */}
        <Bar dataKey="base" stackId="level" fill="transparent" legendType="none" isAnimationActive={false} />
        <Bar dataKey="extent" stackId="level" radius={barRadius}>
          {rows.map((r) => (
            <Cell key={r.label} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
