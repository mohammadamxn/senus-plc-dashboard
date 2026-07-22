import { siteConfig, type AudienceId } from "@/config/site";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PeriodSwitcher } from "@/components/report/period-switcher";
import { AccountMenu } from "@/components/layout/account-menu";
import type { AvailableReportPeriod } from "@/modules/ingestion/actions";

const AUDIENCE_LABELS: Record<AudienceId, string> = Object.fromEntries(
  siteConfig.audiences.map((a) => [a.id, a.label]),
) as Record<AudienceId, string>;

export function ReportShell({
  children,
  audience,
  email,
  isAdmin,
  periodId,
  availablePeriods,
}: {
  children: React.ReactNode;
  audience: AudienceId;
  email: string | null;
  isAdmin: boolean;
  periodId?: string;
  availablePeriods?: AvailableReportPeriod[];
}) {
  const showPeriodSwitcher = Boolean(periodId && availablePeriods && availablePeriods.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{siteConfig.companyLegalName}</h1>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="text-foreground">{email ?? "unknown"}</span>
              {isAdmin && (
                <>
                  {" "}
                  ·{" "}
                  <span className="uppercase tracking-wide text-foreground">Admin</span>
                </>
              )}
              {!isAdmin && audience ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="uppercase tracking-wide text-foreground">
                    {AUDIENCE_LABELS[audience]}
                  </span>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="xs" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <AccountMenu email={email} />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 pt-6">
        {showPeriodSwitcher && (
          <PeriodSwitcher periods={availablePeriods!} currentPeriodId={periodId!} />
        )}
      </div>
      <main className={`mx-auto max-w-5xl px-6 ${showPeriodSwitcher ? "pb-10 pt-6" : "py-10"}`}>
        {children}
      </main>
    </div>
  );
}
