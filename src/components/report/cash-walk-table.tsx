import type { CashWalkStep } from "@/modules/metrics/engine";
import { formatEur } from "@/lib/money";
import { cn } from "@/lib/utils";

function impactLabel(step: CashWalkStep): string {
  if (step.kind === "start") return "Opening position";
  if (step.kind === "end") return "Closing position";
  if (step.amount > 0) return "Inflow";
  if (step.amount < 0) return "Outflow";
  return "Neutral";
}

function formatWalkAmount(amount: number, kind: CashWalkStep["kind"]): string {
  const formatted = formatEur(amount);
  // Opening/closing are stock levels — no forced +; flows show direction.
  if (kind === "flow" && amount > 0) return `+${formatted}`;
  return formatted;
}

export function CashWalkTable({
  steps,
  periodLabel,
}: {
  steps: CashWalkStep[];
  periodLabel: string;
}) {
  let lineNo = 0;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl text-foreground">Cash movement walk ({periodLabel})</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Opening → operating → investing → financing → closing from the published cash-flow
        statement.
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
              const isEnd = step.kind === "end";
              const prefix = isEnd ? "=" : `${++lineNo}.`;
              return (
                <tr
                  key={step.id}
                  className={cn(
                    "border-b border-border/70",
                    isEnd && "border-t-2 border-border",
                  )}
                >
                  <td
                    className={cn(
                      "py-3 pr-4",
                      isEnd || step.kind === "start"
                        ? "font-medium text-foreground"
                        : "text-foreground/90",
                    )}
                  >
                    <span className="tabular-nums text-muted-foreground">{prefix}</span>{" "}
                    {step.label}
                  </td>
                  <td
                    className={cn(
                      "py-3 pr-4 text-right font-mono tabular-nums",
                      (isEnd || step.kind === "start") && "font-medium",
                      step.kind === "flow" && step.amount < 0
                        ? "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    {formatWalkAmount(step.amount, step.kind)}
                  </td>
                  <td
                    className={cn(
                      "py-3",
                      isEnd || step.kind === "start"
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
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
