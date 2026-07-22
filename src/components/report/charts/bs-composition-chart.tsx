"use client";

import { Bar, BarChart, XAxis, YAxis, LabelList } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  amount: { label: "Amount", color: "var(--chart-2)" },
} satisfies ChartConfig;

const compact = (v: unknown) =>
  new Intl.NumberFormat("en-IE", { notation: "compact", maximumFractionDigits: 1 }).format(Number(v) || 0);

export function BsCompositionChart({ data }: { data: { id: string; label: string; amount: number }[] }) {
  const rows = [...data].sort((a, b) => b.amount - a.amount);
  return (
    <ChartContainer config={config} className="aspect-[4/3] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 40 }} accessibilityLayer>
        <XAxis type="number" dataKey="amount" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={4}>
          <LabelList dataKey="amount" position="right" formatter={compact} className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
