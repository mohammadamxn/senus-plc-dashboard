import { config } from "dotenv";
config({ path: ".env.local" });

import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { metricDefs, operatingKpis } from "@/db/schema";
import { buildMetricAudienceTags, LIQUIDITY_OPERATING_KPI_KEYS, CATEGORY_AUDIENCES } from "@/config/metric-categories";

const db = getDb();

// This is the concrete "the two layers can't drift apart" check described
// in the plan: metric_defs.audience_tags is seeded from
// buildMetricAudienceTags() (src/db/seed.ts), so a mismatch here means the
// DB was seeded against a stale version of the TypeScript policy — re-run
// `npm run db:seed`. Skipped (not failed) when there's no DB configured,
// same convention as the rest of this test suite's DB-dependent specs.
describe.skipIf(!db)("metric_defs.audience_tags stays in sync with buildMetricAudienceTags()", () => {
  it("every seeded metric_defs row matches the TypeScript policy exactly", async () => {
    const expected = buildMetricAudienceTags();
    const rows = await db!.select({ id: metricDefs.id, audienceTags: metricDefs.audienceTags }).from(metricDefs);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const expectedTags = expected[row.id] ?? null;
      if (expectedTags === null) {
        expect(row.audienceTags).toBeNull();
      } else {
        expect(new Set(row.audienceTags ?? [])).toEqual(new Set(expectedTags));
      }
    }
  });

  it("the three liquidity-sensitive operating_kpis rows carry the liquidity category's audiences", async () => {
    const rows = await db!
      .select({ key: operatingKpis.key, audienceTags: operatingKpis.audienceTags })
      .from(operatingKpis);
    // Empty after `db:reset-facts` — nothing to assert until seed or approve.
    if (rows.length === 0) return;

    for (const row of rows) {
      if (LIQUIDITY_OPERATING_KPI_KEYS.has(row.key)) {
        expect(new Set(row.audienceTags ?? [])).toEqual(new Set(CATEGORY_AUDIENCES.liquidity));
      } else {
        expect(row.audienceTags).toBeNull();
      }
    }
  });
});
