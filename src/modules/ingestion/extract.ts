import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";
import {
  extractionPayloadSchema,
  type ExtractionPayload,
  PROMPT_VERSION,
} from "@/modules/ingestion/schema";

const CHART_CODES = JSON.parse(
  readFileSync(path.join(process.cwd(), "content", "seed", "chart-of-accounts.json"), "utf8"),
) as { code: string; label: string; statement: string }[];

function chartHint(): string {
  return CHART_CODES.map((c) => `${c.code} (${c.statement}): ${c.label}`).join("\n");
}

/**
 * Claude tool-use structured extraction. Returns Zod-validated facts only —
 * never margins, runway, or other derived metrics.
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

  const toolName = "submit_financial_extraction";
  const system = `You extract financial statement line amounts and operating KPIs from Senus PLC investor documents.
Rules:
- Map each figure to the chart-of-accounts code list provided. Use only those codes.
- For P&L losses shown as positive in the PDF (e.g. "Group operating loss 483,753"), store the magnitude as a positive number matching how the source table presents it when the chart uses debit convention for losses — follow the same numeric magnitudes as the statement tables.
- Extract BOTH current period and prior comparative columns when present.
- Do NOT compute ratios, margins, growth percentages, cash runway, DSCR, ROCE, or any derived metric — only raw line amounts and explicit narrative KPIs stated in the document.
- periodId must be "${args.periodId}"; comparativePeriodId must be ${args.comparativePeriodId ? `"${args.comparativePeriodId}"` : "null"}.
- basis for HY interim statutory tables is usually "unaudited"; chairman outlook KPIs use "management".`;

  const user = `Source kind: ${args.sourceKind}
Target periodId: ${args.periodId}
Comparative periodId: ${args.comparativePeriodId ?? "none"}

Chart of accounts codes (use these exact codes):
${chartHint()}

Document text:
${args.text.slice(0, 120_000)}`;

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system,
    tools: [
      {
        name: toolName,
        description: "Submit the extracted statement lines and operating KPIs.",
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

  // Force period ids from the job, not the model
  const payload: ExtractionPayload = {
    ...parsed.data,
    periodId: args.periodId,
    comparativePeriodId: args.comparativePeriodId,
  };

  return { payload, model };
}

export { PROMPT_VERSION };
