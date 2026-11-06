// The database adapter for the publishing port (design D1, D2 and D4 in
// `revisions-publishing`): `entryStoreFor` turns a database handle into the
// `EntryStore` the cms-core use cases depend on. The pointer move, the first
// and last publish times and the dirty mark are one `UPDATE`, so a crash can
// never separate them.
import { readStoredContent } from "@ycmcuenca/cms-core";
import type {
  EntryRecord,
  EntryStore,
  ProjectionState,
  PublishedEntry,
  RevisionRecord,
} from "@ycmcuenca/cms-core";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { MissingEntryError, updateSlug as moveSlug } from "./entries.ts";
import { entries, revisions } from "./schema.ts";

/** The `EntryStore` port on Drizzle (design D1). */
export function entryStoreFor(database: Database): EntryStore {
  return {
    findEntry: (entryId) => findEntry(database, entryId),
    getRevision: (revisionId) => getRevision(database, revisionId),
    markPublished: (entryId, revisionId, at) =>
      markPublished(database, entryId, revisionId, at),
    markUnpublished: (entryId) => markUnpublished(database, entryId),
    markProjected: (entryId) => markProjected(database, entryId),
    listPublished: (type) => listPublished(database, type),
    updateSlug: (entryId, slug) => moveEntrySlug(database, entryId, slug),
  };
}

async function findEntry(
  database: Database,
  entryId: string,
): Promise<EntryRecord | undefined> {
  const rows = await database
    .select()
    .from(entries)
    .where(eq(entries.id, entryId));
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    publishedRevisionId: row.publishedRevisionId,
    firstPublishedAt: row.firstPublishedAt,
    lastPublishedAt: row.lastPublishedAt,
    projectionState: toProjectionState(row.projectionState),
  };
}

async function getRevision(
  database: Database,
  revisionId: string,
): Promise<RevisionRecord | undefined> {
  const rows = await database
    .select()
    .from(revisions)
    .where(eq(revisions.id, revisionId));
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }
  return {
    id: row.id,
    entryId: row.entryId,
    number: row.number,
    // The store keeps the versioned shape; the projector reads it through
    // `readStoredContent`, so an unsupported version fails there (D3).
    stored: { schema_v: row.schemaV, content: row.content },
  };
}

// One UPDATE: the pointer, both publish times and the dirty mark move
// together (design D2). `coalesce` keeps the first publish time once set.
async function markPublished(
  database: Database,
  entryId: string,
  revisionId: string,
  at: Date,
): Promise<void> {
  const rows = await database
    .update(entries)
    .set({
      publishedRevisionId: revisionId,
      firstPublishedAt: sql`coalesce(first_published_at, ${at})`,
      lastPublishedAt: at,
      projectionState: "dirty",
    })
    .where(eq(entries.id, entryId))
    .returning({ id: entries.id });
  requireRow(rows, entryId);
}

// One UPDATE clears the pointer and marks the entry dirty, so the projection
// removes its snapshot (design D2). The publish times stay.
async function markUnpublished(
  database: Database,
  entryId: string,
): Promise<void> {
  const rows = await database
    .update(entries)
    .set({ publishedRevisionId: null, projectionState: "dirty" })
    .where(eq(entries.id, entryId))
    .returning({ id: entries.id });
  requireRow(rows, entryId);
}

// One UPDATE clears the mark after the entry snapshot and the index are both
// written (design D2).
async function markProjected(
  database: Database,
  entryId: string,
): Promise<void> {
  const rows = await database
    .update(entries)
    .set({ projectionState: "clean" })
    .where(eq(entries.id, entryId))
    .returning({ id: entries.id });
  requireRow(rows, entryId);
}

// The index's source of truth (design D4): every entry with a published
// revision, joined to that revision for its title and summary. An unreadable
// content version throws, so the whole projection fails loudly instead of
// dropping the entry silently.
async function listPublished(
  database: Database,
  type: string,
): Promise<PublishedEntry[]> {
  const rows = await database
    .select({
      id: entries.id,
      slug: entries.slug,
      firstPublishedAt: entries.firstPublishedAt,
      schemaV: revisions.schemaV,
      content: revisions.content,
    })
    .from(entries)
    .innerJoin(revisions, eq(entries.publishedRevisionId, revisions.id))
    .where(eq(entries.type, type))
    .orderBy(desc(entries.firstPublishedAt), asc(entries.slug));
  return rows.map((row) => {
    if (row.firstPublishedAt === null) {
      throw new Error(`Published entry ${row.id} has no first publish time.`);
    }
    const content = readStoredContent({
      schema_v: row.schemaV,
      content: row.content,
    }).content;
    return {
      slug: row.slug,
      title: content.title,
      summary: content.summary,
      firstPublishedAt: row.firstPublishedAt,
    };
  });
}

// The port reports a refusal by throwing; the repository returns validation
// errors for a form, so the adapter turns them into that failure.
async function moveEntrySlug(
  database: Database,
  entryId: string,
  slug: string,
): Promise<void> {
  const result = await moveSlug(database, entryId, slug);
  if (!result.ok) {
    const messages = Object.values(result.errors).filter(
      (message): message is string => message !== undefined,
    );
    throw new Error(messages.join(" ") || "The slug was refused.");
  }
}

function toProjectionState(value: string): ProjectionState {
  if (value === "clean" || value === "dirty") {
    return value;
  }
  throw new Error(`Unknown projection state "${value}".`);
}

// A write that names an entry must have changed one row.
function requireRow(
  rows: readonly { readonly id: string }[],
  entryId: string,
): void {
  if (rows.length === 0) {
    throw new MissingEntryError(entryId);
  }
}
