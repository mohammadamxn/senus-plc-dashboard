/** Shared chart-of-accounts row shape (DB `line_item_defs` / seed JSON). */
export type ChartRow = {
  code: string;
  label: string;
  statement: string;
  sortOrder: number;
};
