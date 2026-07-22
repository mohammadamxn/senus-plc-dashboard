"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CostComponent } from "@/modules/metrics/engine";

const compact = (v: number) =>
  new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const SHORT_LABELS: Record<string, string> = {
  cost_of_sales: "Cost of sales",
  administrative_expenses: "Admin",
  distribution_costs: "Distribution",
  cf_depreciation: "Depreciation",
  total: "Total",
};

export function CostBreakdownChart({
  data,
  priorLabel = "Prior",
  currentLabel = "Current",
}: {
  data: CostComponent[];
  priorLabel?: string;
  currentLabel?: string;
}) {
  const rows = data.map((c) => ({
    label: SHORT_LABELS[c.id] ?? c.label,
    prior: c.prior ?? 0,
    current: c.amount,
  }));

  const chartConfig = {
    prior: { label: priorLabel, color: "var(--chart-1)" },
    current: { label: currentLabel, color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="aspect-[4/3] w-full">
      <BarChart data={rows} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="prior" fill="var(--color-prior)" radius={4} />
        <Bar dataKey="current" fill="var(--color-current)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
