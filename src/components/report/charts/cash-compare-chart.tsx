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

const compact = (v: number) =>
  new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function CashCompareChart({
  data,
}: {
  data: { label: string; cash: number; netCash: number }[];
}) {
  const config = {
    cash: { label: "Cash", color: "var(--chart-1)" },
    netCash: { label: "Net cash", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-[4/3] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="cash" fill="var(--color-cash)" radius={4} />
        <Bar dataKey="netCash" fill="var(--color-netCash)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
