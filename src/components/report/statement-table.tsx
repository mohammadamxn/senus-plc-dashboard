import { formatEur } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  code: string;
  label: string;
  current: number;
  prior: number;
  isSubtotal?: boolean;
};

/** Absolute loss lines stored positive in seed — show as parentheses when label implies loss. */
function cell(amount: number, code: string) {
  const lossCodes = new Set([
    "operating_loss",
    "loss_before_tax",
    "loss_for_period",
    "cost_of_sales",
    "administrative_expenses",
    "interest_payable",
  ]);
  if (lossCodes.has(code) && amount > 0) {
    return `(${formatEur(amount).replace("€", "")})`;
  }
  if (amount < 0) {
    return `(${formatEur(Math.abs(amount)).replace("€", "")})`;
  }
  return formatEur(amount).replace("€", "");
}

export function StatementTable({
  title,
  rows,
  currentLabel,
  priorLabel,
}: {
  title: string;
  rows: Row[];
  currentLabel: string;
  priorLabel: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      <div className="mt-4 min-w-[28rem]">
        <Table>
          <TableHeader>
            <TableRow className="border-foreground hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground"> </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                {currentLabel}
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                {priorLabel}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.code}
                className={cn("hover:bg-transparent", row.isSubtotal && "border-foreground/40")}
              >
                <TableCell
                  className={cn(
                    "whitespace-normal text-foreground/80",
                    row.isSubtotal && "font-semibold text-foreground",
                  )}
                >
                  {row.label}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums text-foreground/90",
                    row.isSubtotal && "font-semibold",
                  )}
                >
                  {cell(row.current, row.code)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {cell(row.prior, row.code)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
