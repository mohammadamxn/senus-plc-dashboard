import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

export function AdminShell({
  children,
  title,
  description,
  currentPath,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  currentPath: string;
}) {
  // Overview → report; nested admin pages → hub (cards are the nav).
  const backHref =
    currentPath === "/admin"
      ? `/reports/${siteConfig.defaultPeriodId}`
      : "/admin";
  const backLabel = currentPath === "/admin" ? "Back to report" : "Back to admin";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
      <Button variant="outline" size="icon-lg" asChild className="self-start">
        <Link href={backHref} aria-label={backLabel}>
          <ArrowLeft className="size-5" />
        </Link>
      </Button>
      <h1 className="mt-6 font-serif text-2xl tracking-tight text-stone-900">{title}</h1>
      {description && <p className="mt-2 text-sm text-stone-600">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
