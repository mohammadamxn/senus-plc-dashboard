"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatementTable } from "@/components/report/statement-table";
import type { StatementRow } from "@/modules/reporting/load-report";

export function StatementTabs({
  plRows,
  bsRows,
  cfRows,
  currentLabel,
  priorLabel,
}: {
  plRows: StatementRow[];
  bsRows: StatementRow[];
  cfRows: StatementRow[];
  currentLabel: string;
  priorLabel: string;
}) {
  return (
    <Tabs defaultValue="pl">
      <TabsList>
        <TabsTrigger value="pl">Profit &amp; loss</TabsTrigger>
        <TabsTrigger value="bs">Balance sheet</TabsTrigger>
        <TabsTrigger value="cf">Cash flow</TabsTrigger>
      </TabsList>
      <TabsContent value="pl">
        <StatementTable title="Consolidated profit and loss" rows={plRows} currentLabel={currentLabel} priorLabel={priorLabel} />
      </TabsContent>
      <TabsContent value="bs">
        <StatementTable title="Consolidated balance sheet" rows={bsRows} currentLabel={currentLabel} priorLabel={priorLabel} />
      </TabsContent>
      <TabsContent value="cf">
        <StatementTable title="Consolidated cash flow" rows={cfRows} currentLabel={currentLabel} priorLabel={priorLabel} />
      </TabsContent>
    </Tabs>
  );
}
