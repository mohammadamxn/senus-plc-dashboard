import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  commentaryOutputSchema,
  validateCommentary,
  type CommentaryOutput,
} from "@/modules/ai/validate";
import {
  assemblePackCommentaryContext,
  type PackCommentaryContext,
} from "@/modules/ai/context";
import { persistInsight, findInsightBySection } from "@/modules/ai/persist";
import { CATEGORY_IDS, type CategoryId } from "@/config/metric-categories";
import {
  COMMENTARY_SYSTEM,
  buildPackCommentaryUserPrompt,
} from "../../../content/prompts/section-commentary";

const packCommentarySchema = z.object({
  growth: commentaryOutputSchema,
  profitability: commentaryOutputSchema,
  liquidity: commentaryOutputSchema,
  solvency: commentaryOutputSchema,
  returns: commentaryOutputSchema,
});

export type PackCommentaryResult = {
  model: string;
  sections: Partial<Record<CategoryId, { insightId: string; output: CommentaryOutput }>>;
  errors: string[];
  /** True when generation was skipped because nothing changed since the last run. */
  skipped?: boolean;
};

function anthropicModel() {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY (or ANTHROPIC_API_KEY) is not set");
  const modelId = process.env.AI_MODEL;
  if (!modelId) throw new Error("AI_MODEL is not set");
  const anthropic = createAnthropic({ apiKey });
  return { model: anthropic(modelId), modelId };
}

/**
 * Single Claude call: generate commentary for all five report sections.
 */
export async function generatePackCommentary(
  ctx: PackCommentaryContext,
): Promise<{ pack: z.infer<typeof packCommentarySchema>; model: string }> {
  const { model, modelId } = anthropicModel();

  const result = await generateObject({
    model,
    schema: packCommentarySchema,
    system: COMMENTARY_SYSTEM,
    prompt: buildPackCommentaryUserPrompt({
      periodId: ctx.periodId,
      metricsBySectionJson: JSON.stringify(ctx.metricsBySection, null, 2),
      reportFactsJson: JSON.stringify(ctx.reportFacts, null, 2),
      pagesJson: JSON.stringify(ctx.pages, null, 2),
      anomalyHints: ctx.anomalyHints,
    }),
  });

  console.log(
    "[insights] Claude pack commentary return",
    JSON.stringify(
      {
        model: modelId,
        periodId: ctx.periodId,
        pack: result.object,
      },
      null,
      2,
    ),
  );

  return { pack: result.object, model: modelId };
}

/** True when every section already has a persisted, non-stale insight matching this dataHash. */
async function alreadyUpToDate(periodId: string, dataHash: string): Promise<boolean> {
  for (const section of CATEGORY_IDS) {
    const existing = await findInsightBySection(periodId, section);
    if (!existing || existing.status === "stale" || existing.dataHash !== dataHash) {
      return false;
    }
  }
  return true;
}

/**
 * Assemble context → one LLM call → validate each section → persist shared insights.
 * Skips the Claude call entirely if every section already matches the current dataHash
 * (protects against accidental double-generation, e.g. a double-click or the admin
 * panel's auto-trigger firing twice).
 */
export async function generateAndPersistPackInsights(
  periodId: string,
): Promise<PackCommentaryResult> {
  const ctx = await assemblePackCommentaryContext(periodId);
  const hasAnyMetrics = CATEGORY_IDS.some((s) => ctx.metricsBySection[s].length > 0);
  if (!hasAnyMetrics) {
    throw new Error("No metrics available — approve the financial pack first.");
  }

  if (await alreadyUpToDate(periodId, ctx.dataHash)) {
    console.log("[insights] skipped Claude call — dataHash unchanged", {
      periodId,
      dataHash: ctx.dataHash,
    });
    const sections: PackCommentaryResult["sections"] = {};
    for (const section of CATEGORY_IDS) {
      const existing = await findInsightBySection(periodId, section);
      if (existing) {
        sections[section] = {
          insightId: existing.id,
          output: {
            body: existing.body,
            metricCitationIds: [],
            pageCitations: [],
          },
        };
      }
    }
    return { model: "skipped", sections, errors: [], skipped: true };
  }

  const { pack, model } = await generatePackCommentary(ctx);
  const sections: PackCommentaryResult["sections"] = {};
  const errors: string[] = [];
  const allPackMetrics = CATEGORY_IDS.flatMap((s) => ctx.metricsBySection[s]);

  for (const section of CATEGORY_IDS) {
    const output = pack[section];
    const metrics = ctx.metricsBySection[section];
    const validated = validateCommentary({
      output,
      metrics,
      pages: ctx.pages,
      numberAllowMetrics: allPackMetrics,
      numberAllowFacts: ctx.reportFacts,
    });

    if (!validated.ok) {
      errors.push(`${section}: ${validated.errors.join("; ")}`);
      console.log(`[insights] validation failed for ${section}`, validated.errors);
      continue;
    }

    try {
      const insightId = await persistInsight({
        periodId,
        section,
        body: validated.output.body,
        output: validated.output,
        metrics,
        dataHash: ctx.dataHash,
        promptVersion: ctx.promptVersion,
        model,
        status: "generated",
      });
      sections[section] = { insightId, output: validated.output };
    } catch (persistErr) {
      errors.push(
        `${section}: persist failed: ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
      );
    }
  }

  console.log(
    "[insights] persist summary",
    JSON.stringify(
      {
        periodId,
        model,
        persisted: Object.keys(sections),
        errors,
      },
      null,
      2,
    ),
  );

  if (Object.keys(sections).length === 0) {
    throw new Error(
      errors.length > 0
        ? `Commentary validation failed: ${errors.join(" | ")}`
        : "No commentary persisted",
    );
  }

  return { model, sections, errors };
}
