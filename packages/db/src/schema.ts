// The two tables the CMS stores content in (design D2). `entries` is the
// addressable thing (a type and a slug, unique together); `revisions` is its
// append-only history, numbered per entry. `gen_random_uuid()` is built into
// Postgres 13 and later, so no extension is needed.
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** An addressable piece of content: a type and a slug, unique together. */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("entries_type_slug_unique").on(table.type, table.slug)],
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
