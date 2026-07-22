export const siteConfig = {
  name: "Senus Board Report",
  companyLegalName: "Senus PLC",
  description:
    "AI-native board pack for Management, the Board, equity investors and credit providers.",
  audiences: [
    { id: "management", label: "Management" },
    { id: "board", label: "Board" },
    { id: "equity", label: "Equity Investors" },
    { id: "credit", label: "Credit Providers" },
  ] as const,
  defaultPeriodId: "hy2026",
  currency: "EUR",
} as const;

export type AudienceId = (typeof siteConfig.audiences)[number]["id"];
