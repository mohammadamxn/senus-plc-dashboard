import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  extractionPayloadSchema,
  type ExtractionPayload,
  PROMPT_VERSION,
  QUALITATIVE_SECTION_KEYS,
} from "@/modules/ingestion/schema";
import { formatChartHint, loadChartOfAccounts } from "@/modules/ingestion/chart";
import { normalizeExtractionPayload } from "@/modules/ingestion/normalize-lines";

/**
 * Claude tool-use structured extraction. Returns Zod-validated facts only —
 * never margins, runway, or other derived metrics. Also copies verbatim
 * qualitative section bodies under known / mapped headings.
 */
export async function extractStructuredFromText(args: {
  text: string;
  periodId: string;
  comparativePeriodId: string | null;
  sourceKind: "hy_interim" | "fy_chairman";
}): Promise<{ payload: ExtractionPayload; model: string }> {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY (or ANTHROPIC_API_KEY) is not set");
  }

  const model = process.env.AI_MODEL;
  if (!model) {
    throw new Error("AI_MODEL is not set");
  }
  const client = new Anthropic({ apiKey });

  if (args.text.length > 500_000) {
    console.warn("[extract] unusually long PDF text", { chars: args.text.length });
  }

  const chart = await loadChartOfAccounts();
  const toolName = "submit_financial_extraction";
  const system = `You extract financial statement line amounts, operating KPIs, and qualitative section text from Senus PLC investor documents.
Rules for financials:
- Map each figure to the chart-of-accounts code list provided. Use only those codes.
- The statementLines[].code field must be the snake_case id (e.g. "interest_payable", "cf_interest_addback"), NEVER the human label. Labels like "Interest payable and similar expenses" appear on both P&L and cash flow — use interest_payable for the P&L line and cf_interest_addback for the cash-flow add-back.
- For P&L losses shown as positive in the PDF (e.g. "Group operating loss 483,753"), store the magnitude as a positive number matching how the source table presents it when the chart uses debit convention for losses — follow the same numeric magnitudes as the statement tables.
- Extract BOTH current period and prior comparative columns when present.
- Do NOT compute ratios, margins, growth percentages, cash runway, DSCR, ROCE, or any derived metric — only raw line amounts and explicit narrative KPIs stated in the document.
- periodId must be "${args.periodId}"; comparativePeriodId must be ${args.comparativePeriodId ? `"${args.comparativePeriodId}"` : "null"}.
- basis for HY interim statutory tables is usually "unaudited"; chairman outlook KPIs use "management".

Rules for qualitativeSections (verbatim section bodies — do NOT summarise or invent):
- Return one object per key: ${QUALITATIVE_SECTION_KEYS.join(", ")}.
- chairman_statement: body under heading "Chairman's Statement" (or close spelling).
- commercial_progress: body under "Commercial Progress".
- pipeline_outlook: body under "Pipeline & Outlook".
- acquisitions: body under the acquisition / M&A / technology-integration section — the PDF heading may vary (e.g. "Loamin Acquisition & Technology Integration"). Put the exact PDF heading in sourceHeading; use key "acquisitions".
- strategic_outlook: body under the strategic roadmap / long-term outlook section — the PDF heading may vary (e.g. "Senus 2030"). Put the exact PDF heading in sourceHeading; use key "strategic_outlook".
- Copy the body text from that heading until the next major heading. Preserve wording; only normalise whitespace. Empty body and empty sourceHeading if the section is absent.
- Do not put P&L table rows into qualitativeSections.`;

  const user = `Source kind: ${args.sourceKind}
Target periodId: ${args.periodId}
Comparative periodId: ${args.comparativePeriodId ?? "none"}

Chart of accounts codes (use these exact codes):
${formatChartHint(chart)}

Document text:
${args.text}`;

  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    system,
    tools: [
      {
        name: toolName,
        description:
          "Submit extracted statement lines, operating KPIs, and verbatim qualitative section bodies.",
        input_schema: {
          type: "object",
          properties: {
            periodId: { type: "string" },
            comparativePeriodId: { type: ["string", "null"] },
            documentTitle: { type: "string" },
            basis: { type: "string", enum: ["audited", "unaudited", "management"] },
            statementLines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  current: { type: "number" },
                  prior: { type: "number" },
                },
                required: ["code", "current", "prior"],
              },
            },
            operatingKpis: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  periodId: { type: "string" },
                  key: { type: "string" },
                  label: { type: "string" },
                  value: { type: "number" },
                  unit: { type: "string" },
                  basis: { type: "string", enum: ["audited", "unaudited", "management"] },
                  sourceRef: { type: "string" },
                },
                required: ["periodId", "key", "label", "value", "unit", "basis"],
              },
            },
            qualitativeSections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: {
                    type: "string",
                    enum: [...QUALITATIVE_SECTION_KEYS],
                  },
                  sourceHeading: { type: "string" },
                  body: { type: "string" },
                },
                required: ["key", "body"],
              },
            },
          },
          required: ["periodId", "documentTitle", "basis", "statementLines"],
        },
      },
    ],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: user }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Model did not return a structured extraction tool call");
  }

  const parsed = extractionPayloadSchema.safeParse(toolBlock.input as Record<string, unknown>);
  if (!parsed.success) {
    throw new Error(`Extraction failed Zod validation: ${parsed.error.message}`);
  }

  // Force period ids from the job; coerce labels → chart codes
  const payload: ExtractionPayload = normalizeExtractionPayload(
    {
      ...parsed.data,
      periodId: args.periodId,
      comparativePeriodId: args.comparativePeriodId,
    },
    chart,
  );

  return { payload, model };
}

export { PROMPT_VERSION };
