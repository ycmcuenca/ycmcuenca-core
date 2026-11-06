// The two tables the CMS stores content in (design D2). `entries` is the
// addressable thing (a type and a slug, unique together); `revisions` is its
// append-only history, numbered per entry. `gen_random_uuid()` is built into
// Postgres 13 and later, so no extension is needed.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * An addressable piece of content: a type and a slug, unique together. The
 * publishing columns are the database of record (design D4 in
 * `revisions-publishing`): the published revision, the two publish times, and
 * whether the projection to KV is still pending.
 */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // `AnyPgColumn` breaks the type cycle: `revisions` references `entries`
    // and the published pointer references `revisions` (design D4).
    publishedRevisionId: uuid("published_revision_id").references(
      (): AnyPgColumn => revisions.id,
    ),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    projectionState: text("projection_state").notNull().default("clean"),
  },
  (table) => [
    unique("entries_type_slug_unique").on(table.type, table.slug),
    check(
      "entries_projection_state_check",
      sql`${table.projectionState} in ('clean', 'dirty')`,
    ),
  ],
);

/**
 * One immutable save of an entry's content, numbered per entry (design D2).
 * The app may only insert and read these rows; the runtime role has no
 * `UPDATE` or `DELETE` right (design D3).
 */
export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id),
    number: integer("number").notNull(),
    schemaV: integer("schema_v").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("revisions_entry_number_unique").on(table.entryId, table.number),
  ],
);
