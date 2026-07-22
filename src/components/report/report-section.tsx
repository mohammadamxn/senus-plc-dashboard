"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function storageKey(id: string) {
  return `senus-report-section:${id}`;
}

export function ReportSection({
  id,
  eyebrow,
  title,
  description,
  defaultOpen = true,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Restore the user's last choice for this section, if any — runs once on
  // mount so the server-rendered (defaultOpen) markup matches on hydration.
  useEffect(() => {
    if (!id) return;
    const stored = window.localStorage.getItem(storageKey(id));
    if (stored !== null) setOpen(stored === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (id) window.localStorage.setItem(storageKey(id), next ? "1" : "0");
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      id={id}
      className="mt-14 scroll-mt-24 first:mt-8"
    >
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-4 text-left">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-serif text-2xl tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <Separator className="mt-4" />
      <CollapsibleContent className="mt-6 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
