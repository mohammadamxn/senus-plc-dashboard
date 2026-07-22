import { ChartCard } from "@/components/report/chart-card";
import { MetricYoYBarChart } from "@/components/report/charts/metric-yoy-bar-chart";
import type { ComparisonMetric } from "@/modules/metrics/compare";

export function MetricYoYChartGrid({
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => (
        <ChartCard key={m.id} title={m.label}>
          <MetricYoYBarChart metric={m} priorLabel={priorLabel} currentLabel={currentLabel} />
        </ChartCard>
      ))}
    </div>
  );
}
