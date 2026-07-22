import type { ComparisonMetric } from "@/modules/metrics/compare";

export type DeltaSentiment = "good" | "bad" | "neutral";

/**
 * Colour YoY by business impact, not raw arithmetic sign.
 * Uses level change (current − prior) so negative-base % moves
 * (e.g. more-negative EBITDA) still colour correctly.
 */
export function deltaSentiment(metric: ComparisonMetric): DeltaSentiment {
  const { prior, current, delta, higherIsBetter } = metric;

  if (prior != null && current != null) {
    const levelChange = current - prior;
    if (Math.abs(levelChange) < 1e-9) return "neutral";
    const improved = higherIsBetter ? levelChange > 0 : levelChange < 0;
    return improved ? "good" : "bad";
  }

  if (delta == null || Math.abs(delta) < 1e-9) return "neutral";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "good" : "bad";
}
