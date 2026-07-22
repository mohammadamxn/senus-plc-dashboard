import type { BridgeStep } from "@/modules/metrics/engine";
import { formatEur } from "@/lib/money";
import { cn } from "@/lib/utils";

function impactLabel(step: BridgeStep): string {
  const { id, amount } = step;
  if (id === "ebitda") return amount < 0 ? "Base loss" : "Base earnings";
  if (id === "wc") {
    if (amount > 0) return "Cash inflow (release)";
    if (amount < 0) return "Cash outflow (absorption)";
    return "Neutral";
  }
  if (id === "other_ops") {
    if (amount === 0) return "Neutral";
    return amount > 0 ? "Cash inflow" : "Outflow";
  }
  if (id === "interest" || id === "capex") {
    if (amount === 0) return "Neutral";
    return amount < 0 ? "Outflow" : "Inflow";
  }
  if (id === "net_op") return "Subtotal";
  if (id === "fcf") return amount < 0 ? "Net cash burn" : "Net cash generation";
  return "—";
}

function formatBridgeAmount(amount: number): string {
  const formatted = formatEur(amount);
  if (amount > 0) return `+${formatted}`;
  return formatted;
}

export function CashBridge({
  steps,
  periodLabel,
}: {
  steps: BridgeStep[];
  periodLabel: string;
}) {
  let lineNo = 0;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl text-foreground">
        EBITDA → Free cash flow bridge ({periodLabel})
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Built from published cash-flow lines. EBITDA approximated as operating loss reversed plus
        depreciation.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2.5 pr-4 font-medium">Line item</th>
              <th className="py-2.5 pr-4 text-right font-medium tabular-nums">Amount (€)</th>
              <th className="py-2.5 font-medium">Impact / type</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const isTotal = step.kind === "total" || step.kind === "subtotal";
              const prefix = isTotal ? "=" : `${++lineNo}.`;
              return (
                <tr
                  key={step.id}
                  className={cn(
                    "border-b border-border/70",
                    step.kind === "subtotal" && "border-t border-border",
                    step.kind === "total" && "border-t-2 border-border",
                  )}
                >
                  <td
                    className={cn(
                      "py-3 pr-4",
                      isTotal ? "font-medium text-foreground" : "text-foreground/90",
                    )}
                  >
                    <span className="tabular-nums text-muted-foreground">{prefix}</span>{" "}
                    {step.label}
                  </td>
                  <td
                    className={cn(
                      "py-3 pr-4 text-right font-mono tabular-nums",
                      isTotal && "font-medium",
                      step.amount < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatBridgeAmount(step.amount)}
                  </td>
                  <td
                    className={cn(
                      "py-3",
                      isTotal ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {impactLabel(step)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
