import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/modules/auth/session";
import { generateAndPersistPackInsights } from "@/modules/ai/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Optional HTTP kick for pack commentary (same as regeneratePackInsights server action).
 */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { periodId?: string };
  if (!body.periodId) {
    return NextResponse.json({ error: "periodId required" }, { status: 400 });
  }

  try {
    const result = await generateAndPersistPackInsights(body.periodId);
    return NextResponse.json({
      ok: true,
      sections: Object.keys(result.sections),
      warnings: result.errors,
      model: result.model,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
