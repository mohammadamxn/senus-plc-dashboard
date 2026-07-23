import {
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const periodTypeEnum = pgEnum("period_type", ["FY", "HY", "Q", "M"]);
export const basisEnum = pgEnum("basis", ["audited", "unaudited", "management"]);
export const statementEnum = pgEnum("statement_type", ["PL", "BS", "CF"]);
export const meaningfulnessEnum = pgEnum("meaningfulness", [
  "ok",
  "not_meaningful",
  "degenerate",
]);
export const insightStatusEnum = pgEnum("insight_status", [
  "pending",
  "generated",
  "approved",
  "stale",
]);
export const audienceEnum = pgEnum("audience", ["management", "board", "equity", "credit"]);

// Populated only by the auth.users trigger (see migration 0003), which reads
// audience/is_admin from the invite metadata an admin set at invite time —
// RLS on this table grants no INSERT/UPDATE to the "authenticated" role, so
// a signed-in user has no path to change their own audience or is_admin.
// audience is nullable as a defensive fallback (e.g. an invite sent without
// metadata) even though the invite flow always sets it; NULL means no
// report access at all, never "full access".
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  audience: audienceEnum("audience"),
  isAdmin: boolean("is_admin").notNull().default(false),
  fullName: text("full_name"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
});

// Append-only audit trail for privileged admin actions (invites sent, role/
// admin changes) — this is app-level governance data Supabase's own auth
// logs don't capture, important for a confidential board-report platform.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetUserId: uuid("target_user_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: varchar("id", { length: 64 }).primaryKey(),
  legalName: text("legal_name").notNull(),
  functionalCurrency: char("functional_currency", { length: 3 }).notNull().default("EUR"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    companyId: varchar("company_id", { length: 64 })
      .notNull()
      .references(() => companies.id),
    periodType: periodTypeEnum("period_type").notNull(),
    label: text("label").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    basis: basisEnum("basis").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("fiscal_periods_company_type_start").on(t.companyId, t.periodType, t.startDate)],
);

export const lineItemDefs = pgTable("line_item_defs", {
  code: varchar("code", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  statement: statementEnum("statement").notNull(),
  parentCode: varchar("parent_code", { length: 64 }),
  sortOrder: integer("sort_order").notNull(),
  signConvention: varchar("sign_convention", { length: 16 }).notNull(),
  isSubtotal: boolean("is_subtotal").notNull().default(false),
});

export const statementLines = pgTable(
  "statement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: varchar("period_id", { length: 64 })
      .notNull()
      .references(() => fiscalPeriods.id),
    lineItemCode: varchar("line_item_code", { length: 64 })
      .notNull()
      .references(() => lineItemDefs.code),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
  },
  (t) => [uniqueIndex("statement_lines_period_item").on(t.periodId, t.lineItemCode)],
);

export const metricDefs = pgTable("metric_defs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  formulaKey: varchar("formula_key", { length: 64 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  audienceTags: text("audience_tags").array(),
});

export const metricValues = pgTable(
  "metric_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    metricDefId: varchar("metric_def_id", { length: 64 })
      .notNull()
      .references(() => metricDefs.id),
    periodId: varchar("period_id", { length: 64 })
      .notNull()
      .references(() => fiscalPeriods.id),
    value: numeric("value", { precision: 18, scale: 6 }),
    meaningfulness: meaningfulnessEnum("meaningfulness").notNull().default("ok"),
    inputsJson: text("inputs_json"),
  },
  (t) => [uniqueIndex("metric_values_def_period").on(t.metricDefId, t.periodId)],
);

export const operatingKpis = pgTable("operating_kpis", {
  id: uuid("id").defaultRandom().primaryKey(),
  periodId: varchar("period_id", { length: 64 })
    .notNull()
    .references(() => fiscalPeriods.id),
  key: varchar("key", { length: 64 }).notNull(),
  label: text("label").notNull(),
  value: numeric("value", { precision: 18, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  basis: basisEnum("basis").notNull(),
  sourceRef: text("source_ref"),
  tolerance: numeric("tolerance", { precision: 18, scale: 4 }),
  // NULL = generic commercial highlight, visible to every authenticated
  // audience; set only for KPIs that belong to a restricted category (e.g.
  // the liquidity/fundraise figures) — mirrors metric_defs.audience_tags,
  // seeded from the same CATEGORY_AUDIENCES policy for the RLS on this table.
  audienceTags: text("audience_tags").array(),
});

export const sourceDocuments = pgTable("source_documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  periodId: varchar("period_id", { length: 64 }).references(() => fiscalPeriods.id),
  title: text("title").notNull(),
  basis: basisEnum("basis").notNull(),
  storagePath: text("storage_path"),
});

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: varchar("period_id", { length: 64 })
      .notNull()
      .references(() => fiscalPeriods.id),
    section: varchar("section", { length: 64 }).notNull(),
    /** Shared pack commentary — always null (one insight per section). */
    audience: varchar("audience", { length: 32 }),
    body: text("body").notNull(),
    status: insightStatusEnum("status").notNull().default("generated"),
    model: text("model"),
    promptVersion: varchar("prompt_version", { length: 32 }),
    dataHash: varchar("data_hash", { length: 64 }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("insights_period_section").on(t.periodId, t.section)],
);

export const insightCitations = pgTable("insight_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  insightId: uuid("insight_id")
    .notNull()
    .references(() => insights.id),
  metricValueId: uuid("metric_value_id").references(() => metricValues.id),
  /** Page reference (e.g. "p.12") for a citation grounded in the source PDF text. */
  pageRef: text("page_ref"),
  /** Verbatim short quote from that page, validated as a real substring at generation time. */
  quote: text("quote"),
});

export const extractionSourceKindEnum = pgEnum("extraction_source_kind", [
  "hy_interim",
  "fy_chairman",
]);
export const extractionStatusEnum = pgEnum("extraction_status", [
  "pending",
  "extracted",
  "financials_approved",
  "approved",
  "rejected",
  "failed",
]);

export const extractionJobs = pgTable("extraction_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  periodId: varchar("period_id", { length: 64 })
    .notNull()
    .references(() => fiscalPeriods.id),
  comparativePeriodId: varchar("comparative_period_id", { length: 64 }).references(
    () => fiscalPeriods.id,
  ),
  sourceKind: extractionSourceKindEnum("source_kind").notNull(),
  status: extractionStatusEnum("status").notNull().default("pending"),
  sourceFilename: text("source_filename"),
  rawText: text("raw_text"),
  error: text("error"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const extractionDrafts = pgTable("extraction_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => extractionJobs.id),
  payload: jsonb("payload").notNull(),
  model: text("model"),
  promptVersion: varchar("prompt_version", { length: 32 }).notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Approved verbatim qualitative section bodies (after financials approve). */
export const documentSections = pgTable(
  "document_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: varchar("period_id", { length: 64 })
      .notNull()
      .references(() => fiscalPeriods.id),
    key: varchar("key", { length: 64 }).notNull(),
    sourceHeading: text("source_heading").notNull().default(""),
    body: text("body").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("document_sections_period_key_uidx").on(t.periodId, t.key)],
);

export const insightJobStatusEnum = pgEnum("insight_job_status", [
  "queued",
  "running",
  "validating",
  "succeeded",
  "failed",
]);

export const insightJobs = pgTable("insight_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  periodId: varchar("period_id", { length: 64 })
    .notNull()
    .references(() => fiscalPeriods.id),
  section: varchar("section", { length: 64 }).notNull(),
  audience: varchar("audience", { length: 32 }).notNull(),
  status: insightJobStatusEnum("status").notNull().default("queued"),
  insightId: uuid("insight_id").references(() => insights.id),
  error: text("error"),
  model: text("model"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
