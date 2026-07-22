"use client";

import { Bar, BarChart, Cell, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CashWalkStep } from "@/modules/metrics/engine";

const config = {
  value: { label: "Cash", color: "var(--chart-1)" },
} satisfies ChartConfig;

const compact = (v: number) =>
  new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(v);

type Bar = { label: string; base: number; value: number; fill: string; signed: number };

/** Transform an ordered cash-movement walk into stacked-bar waterfall data. */
function toWaterfall(steps: CashWalkStep[]): Bar[] {
  let running = 0;
  return steps.map((s) => {
    if (s.kind === "start") {
      running = s.amount;
      return { label: s.label, base: 0, value: s.amount, fill: "var(--chart-3)", signed: s.amount };
    }
    if (s.kind === "end") {
      return { label: s.label, base: 0, value: s.amount, fill: "var(--chart-3)", signed: s.amount };
    }
    const before = running;
    const after = running + s.amount;
    running = after;
    return {
      label: s.label,
      base: Math.min(before, after),
      value: Math.abs(s.amount),
      fill: s.amount >= 0 ? "var(--chart-4)" : "var(--chart-5)",
      signed: s.amount,
    };
  });
}

export function CashWalkChart({ steps }: { steps: CashWalkStep[] }) {
  const data = toWaterfall(steps);
  return (
    <ChartContainer config={config} className="aspect-[16/9] w-full">
      <BarChart data={data} margin={{ top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(_v, _n, item) => (
                <span className="font-mono tabular-nums">{compact((item.payload as Bar).signed)}</span>
              )}
            />
          }
        />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="value" stackId="w" radius={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
