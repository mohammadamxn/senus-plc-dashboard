"use server";

import "server-only";
import { getCurrentProfile } from "@/modules/auth/session";
import { generateAndPersistPackInsights } from "@/modules/ai/generate";
import { updateInsightBody } from "@/modules/ai/persist";
import {
  approveAllGeneratedInsights,
  approveInsight,
  listInsightsAdmin,
} from "@/modules/ai/load-insights";
import { periodHasApprovedPack } from "@/modules/ai/context";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/db/schema";
import { getDb } from "@/db/client";

export type InsightActionResult =
  | { error: string }
  | { success: string; sectionCount?: number; warnings?: string[] };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isAdmin) throw new Error("Forbidden");
  return profile;
}

/** Single API call: generate commentary for all five sections. */
export async function regeneratePackInsights(periodId: string): Promise<InsightActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  if (!(await periodHasApprovedPack(periodId))) {
    return { error: "Approve financials first." };
  }

  try {
    const result = await generateAndPersistPackInsights(periodId);
    const db = getDb();
    if (db) {
      await db.insert(auditLog).values({
        actorUserId: admin.userId,
        action: "insights.pack_generate",
        metadata: {
          periodId,
          sections: Object.keys(result.sections),
          warnings: result.errors,
        },
      });
    }
    revalidatePath("/admin/ingest");
    revalidatePath(`/reports/${periodId}`);
    const n = Object.keys(result.sections).length;
    return {
      success: `Generated commentary for ${n} section${n === 1 ? "" : "s"}.`,
      sectionCount: n,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed" };
  }
}

export async function approveInsightAction(insightId: string): Promise<InsightActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  try {
    await approveInsight(insightId);
    const db = getDb();
    if (db) {
      await db.insert(auditLog).values({
        actorUserId: admin.userId,
        action: "insights.approve",
        metadata: { insightId },
      });
    }
    revalidatePath("/admin/ingest");
    revalidatePath("/reports");
    return { success: "Insight approved for the board report." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Approve failed" };
  }
}

export async function updateInsightAction(
  insightId: string,
  body: string,
): Promise<InsightActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const trimmed = body.trim();
  if (trimmed.length < 40) {
    return { error: "Commentary must be at least 40 characters." };
  }

  try {
    await updateInsightBody(insightId, trimmed);
    const db = getDb();
    if (db) {
      await db.insert(auditLog).values({
        actorUserId: admin.userId,
        action: "insights.edit",
        metadata: { insightId },
      });
    }
    revalidatePath("/admin/ingest");
    revalidatePath("/reports");
    return { success: "Saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function approveAllInsightsAction(periodId: string): Promise<InsightActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }
  try {
    const n = await approveAllGeneratedInsights(periodId);
    revalidatePath("/admin/ingest");
    revalidatePath(`/reports/${periodId}`);
    return { success: `Approved ${n} insight${n === 1 ? "" : "s"}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Approve failed" };
  }
}

export async function loadAdminInsights(periodId: string) {
  try {
    await requireAdmin();
  } catch {
    return [];
  }
  return listInsightsAdmin(periodId);
}
