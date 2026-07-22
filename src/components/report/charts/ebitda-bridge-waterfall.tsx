"use client";

import { CashWalkChart } from "@/components/report/charts/cash-walk-chart";
import type { BridgeStep, CashWalkStep } from "@/modules/metrics/engine";

/**
 * Map EBITDA→FCF bridge rows into a cash-walk-shaped waterfall:
 * start at EBITDA, apply WC/other/interest/capex flows, end at FCF proxy.
 */
export function bridgeToWalkSteps(steps: BridgeStep[]): CashWalkStep[] {
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
  const ebitda = byId.ebitda?.amount ?? 0;
  const fcf = byId.fcf?.amount ?? 0;
  return [
    { id: "ebitda", label: byId.ebitda?.label ?? "EBITDA", amount: ebitda, kind: "start" },
    {
      id: "wc",
      label: byId.wc?.label ?? "Working capital",
      amount: byId.wc?.amount ?? 0,
      kind: "flow",
    },
    {
      id: "other_ops",
      label: byId.other_ops?.label ?? "Other operating",
      amount: byId.other_ops?.amount ?? 0,
      kind: "flow",
    },
    {
      id: "interest",
      label: byId.interest?.label ?? "Interest paid",
      amount: byId.interest?.amount ?? 0,
      kind: "flow",
    },
    {
      id: "capex",
      label: byId.capex?.label ?? "Capex",
      amount: byId.capex?.amount ?? 0,
      kind: "flow",
    },
    { id: "fcf", label: byId.fcf?.label ?? "FCF proxy", amount: fcf, kind: "end" },
  ];
}

export function EbitdaBridgeWaterfall({ steps }: { steps: BridgeStep[] }) {
  return <CashWalkChart steps={bridgeToWalkSteps(steps)} />;
}
