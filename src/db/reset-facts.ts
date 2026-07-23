import { config } from "dotenv";
import { getDb } from "./client";
import {
  insightCitations,
  insights,
  insightJobs,
  metricValues,
  statementLines,
  operatingKpis,
  sourceDocuments,
  extractionDrafts,
  extractionJobs,
  documentSections,
} from "./schema";

config({ path: ".env.local" });

/**
 * Clears financial fact data so an admin can test PDF upload from empty.
 * Keeps auth (profiles), companies, fiscal_periods, line_item_defs, metric_defs.
 */
async function main() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");

  console.log("Resetting financial facts (keeping auth + reference data)…");

  await db.delete(insightJobs);
  await db.delete(insightCitations);
  await db.delete(insights);
  await db.delete(metricValues);
  await db.delete(statementLines);
  await db.delete(operatingKpis);
  await db.delete(sourceDocuments);
  await db.delete(documentSections);
  await db.delete(extractionDrafts);
  await db.delete(extractionJobs);

  console.log("Done. Visit /admin/ingest to upload a PDF.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
