"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type View = "table" | "chart";

export function SectionViewToggle({
  table,
  chart,
  defaultView = "table",
}: {
  table: React.ReactNode;
  chart: React.ReactNode;
  defaultView?: View;
}) {
  const [view, setView] = useState<View>(defaultView);

  return (
    <div>
      <div
        className="mb-4 inline-flex rounded-md border border-border bg-background p-0.5"
        role="group"
        aria-label="Section view"
      >
        <Button
          type="button"
          size="sm"
          variant={view === "table" ? "default" : "ghost"}
          aria-pressed={view === "table"}
          className={cn("h-7 rounded-[6px] px-3", view !== "table" && "text-muted-foreground")}
          onClick={() => setView("table")}
        >
          Table
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "chart" ? "default" : "ghost"}
          aria-pressed={view === "chart"}
          className={cn("h-7 rounded-[6px] px-3", view !== "chart" && "text-muted-foreground")}
          onClick={() => setView("chart")}
        >
          Chart
        </Button>
      </div>
      <div>{view === "table" ? table : chart}</div>
    </div>
  );
}
