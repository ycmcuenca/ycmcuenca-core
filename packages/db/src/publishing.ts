// The database adapter for the publishing port (design D1, D2 and D4 in
// `revisions-publishing`): `entryStoreFor` turns a database handle into the
// `EntryStore` the cms-core use cases depend on. The pointer move, the first
// and last publish times and the dirty mark are one `UPDATE`, so a crash can
// never separate them.
import { readStoredContent } from "@ycmcuenca/cms-core";
import type {
  EntryRecord,
  EntryStore,
  PublishedEntry,
  RevisionRecord,
  SlugChange,
} from "@ycmcuenca/cms-core";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import {
  DuplicateSlugError,
  MissingEntryError,
  PublishedSlugError,
  toProjectionState,
  updateSlug as moveSlug,
} from "./entries.ts";
import { entries, revisions } from "./schema.ts";

/** The `EntryStore` port on Drizzle (design D1). */
export function entryStoreFor(database: Database): EntryStore {
  return {
    findEntry: (entryId) => findEntry(database, entryId),
    getRevision: (revisionId) => getRevision(database, revisionId),
    markPublished: (entryId, revisionId, at) =>
      markPublished(database, entryId, revisionId, at),
    markUnpublished: (entryId) => markUnpublished(database, entryId),
    markProjected: (entryId, revisionId) =>
      markProjected(database, entryId, revisionId),
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
// written (design D2). It names the revision that was projected, so a publish
// or rollback that landed in between leaves the mark dirty: that projection
// owns the snapshot now, and Retry or W1 reprojects this entry from the
// database of record.
async function markProjected(
  database: Database,
  entryId: string,
  revisionId: string | null,
): Promise<void> {
  const projectedPointer =
    revisionId === null
      ? isNull(entries.publishedRevisionId)
      : eq(entries.publishedRevisionId, revisionId);
  await database
    .update(entries)
    .set({ projectionState: "clean" })
    .where(and(eq(entries.id, entryId), projectedPointer));
}

// The index's source of truth (design D4): every entry with a published
// revision, joined to that revision for its title and summary, with both
// publish times so the index can carry its last-update date. An unreadable
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
      lastPublishedAt: entries.lastPublishedAt,
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
    if (row.lastPublishedAt === null) {
      throw new Error(`Published entry ${row.id} has no last publish time.`);
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
      lastPublishedAt: row.lastPublishedAt,
    };
  });
}

// The port returns a refusal instead of throwing, so the use case can answer
// a form submission without a 500 (design D2).
async function moveEntrySlug(
  database: Database,
  entryId: string,
  slug: string,
): Promise<SlugChange> {
  try {
    const result = await moveSlug(database, entryId, slug);
    if (result.ok) {
      return { ok: true };
    }
    const messages = Object.values(result.errors).filter(
      (message): message is string => message !== undefined,
    );
    return { ok: false, reason: messages.join(" ") || "The slug was refused." };
  } catch (error) {
    // The database is the second guard: a publish that races the use case's
    // check is refused here (design D2).
    if (error instanceof PublishedSlugError) {
      return { ok: false, reason: "Published slugs cannot change." };
    }
    if (
      error instanceof DuplicateSlugError ||
      error instanceof MissingEntryError
    ) {
      return { ok: false, reason: error.message };
    }
    throw error;
  }
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
