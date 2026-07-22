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

const config = {
  turnover: { label: "Turnover", color: "var(--chart-1)" },
  grossProfit: { label: "Gross profit", color: "var(--chart-4)" },
} satisfies ChartConfig;

const compact = (v: number) =>
  new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function RevenueBarChart({
  data,
}: {
  data: { label: string; turnover: number; grossProfit: number }[];
}) {
  return (
    <ChartContainer config={config} className="aspect-[4/3] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="turnover" fill="var(--color-turnover)" radius={4} />
        <Bar dataKey="grossProfit" fill="var(--color-grossProfit)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
