// The repository functions for entries and their append-only revisions
// (design D2, D4). Every write validates with the content model and stores
// through its versioned contract; every read goes through the versioned
// reader, so nothing half-understood reaches a caller.
import {
  readStoredContent,
  schemaVersion,
  storedContent,
  validateArticle,
} from "@ycmcuenca/cms-core";
import type {
  ArticleErrors,
  ProjectionState,
  StoredContent,
} from "@ycmcuenca/cms-core";
import { article, articleSchema } from "@ycmcuenca/cms-core";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { entries, revisions } from "./schema.ts";

/** A stored entry: its address and when it was created. */
export interface Entry {
  readonly id: string;
  readonly type: string;
  readonly slug: string;
  readonly createdAt: Date;
}

/**
 * One entry as the list shows it (design D5): its address, the title of its
 * latest save and when that save happened, plus its publishing state.
 */
export interface EntrySummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  /** When the entry's latest revision was saved. */
  readonly lastSavedAt: Date;
  readonly publishedRevisionId: string | null;
  readonly projectionState: ProjectionState;
}

/** A stored revision: its position, and its content through the reader. */
export interface Revision {
  readonly id: string;
  readonly entryId: string;
  readonly number: number;
  readonly createdAt: Date;
  readonly stored: StoredContent;
}

/** What a write returns when the content model refused the input. */
export interface StoreFailure {
  readonly ok: false;
  readonly errors: ArticleErrors;
}

/** The result of creating an entry and its first revision. */
export type CreateEntryResult =
  | { readonly ok: true; readonly entry: Entry; readonly revision: Revision }
  | StoreFailure;

/** The result of appending a revision. */
export type AppendRevisionResult =
  { readonly ok: true; readonly revision: Revision } | StoreFailure;

/** Creating an entry failed because its slug is already used by its type. */
export class DuplicateSlugError extends Error {
  /** The slug that was already taken. */
  readonly slug: string;

  constructor(slug: string) {
    super(`An ${article.name} already uses the slug "${slug}".`);
    this.name = "DuplicateSlugError";
    this.slug = slug;
  }
}

/**
 * Two saves raced to add the same revision number. The unique constraint
 * caught it; with one owner this should never happen (design D2).
 */
export class ConcurrentRevisionError extends Error {
  /** The entry the racing save touched. */
  readonly entryId: string;

  constructor(entryId: string) {
    super(
      `Another save added a revision to entry ${entryId} at the same time; retry.`,
    );
    this.name = "ConcurrentRevisionError";
    this.entryId = entryId;
  }
}

/** A slug move was refused because the entry has been published (spec). */
export class PublishedSlugError extends Error {
  /** The entry whose address may no longer change. */
  readonly entryId: string;

  constructor(entryId: string) {
    super(
      `Entry ${entryId} has been published, so its slug cannot change (design D2).`,
    );
    this.name = "PublishedSlugError";
    this.entryId = entryId;
  }
}

/** An operation named an entry that is not stored. */
export class MissingEntryError extends Error {
  /** The entry id that matched no row. */
  readonly entryId: string;

  constructor(entryId: string) {
    super(`No entry has the id ${entryId}.`);
    this.name = "MissingEntryError";
    this.entryId = entryId;
  }
}

/**
 * Creates an entry and its first revision in one transaction (design D2), so
 * both exist or neither does. Validation errors are returned; a taken slug
 * throws.
 */
export async function createEntry(
  database: Database,
  input: unknown,
): Promise<CreateEntryResult> {
  const validated = validateArticle(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }
  const stored = storedContent.parse({
    schema_v: schemaVersion,
    content: validated.content,
  });
  const slug = validated.content.slug;
  try {
    return await database.transaction(async (transaction) => {
      const entry = only(
        await transaction
          .insert(entries)
          .values({ type: article.name, slug })
          .returning(),
      );
      const revision = only(
        await transaction
          .insert(revisions)
          .values({
            entryId: entry.id,
            number: 1,
            schemaV: stored.schema_v,
            content: stored.content,
          })
          .returning(),
      );
      return {
        ok: true,
        entry: toEntry(entry),
        revision: toRevision(revision),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error, "entries_type_slug_unique")) {
      throw new DuplicateSlugError(slug);
    }
    throw error;
  }
}

/**
 * Appends a revision numbered one higher than the entry's latest (design D2).
 * The number is computed and inserted in one transaction; the unique
 * constraint turns a concurrent duplicate into an error, never an overwrite.
 * Throws `MissingEntryError` when no entry has that id.
 */
export async function appendRevision(
  database: Database,
  entryId: string,
  input: unknown,
): Promise<AppendRevisionResult> {
  const validated = validateArticle(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }
  const stored = storedContent.parse({
    schema_v: schemaVersion,
    content: validated.content,
  });
  try {
    return await database.transaction(async (transaction) => {
      const next = await transaction
        .select({
          value: sql<number>`coalesce(max(${revisions.number}), 0) + 1`,
        })
        .from(revisions)
        .where(eq(revisions.entryId, entryId));
      const revision = only(
        await transaction
          .insert(revisions)
          .values({
            entryId,
            number: next[0]?.value ?? 1,
            schemaV: stored.schema_v,
            content: stored.content,
          })
          .returning(),
      );
      return { ok: true, revision: toRevision(revision) };
    });
  } catch (error) {
    if (isUniqueViolation(error, "revisions_entry_number_unique")) {
      throw new ConcurrentRevisionError(entryId);
    }
    if (isMissingEntryViolation(error)) {
      throw new MissingEntryError(entryId);
    }
    throw error;
  }
}

/** Finds an entry by its type and slug, or `undefined` when none exists. */
export async function findEntry(
  database: Database,
  type: string,
  slug: string,
): Promise<Entry | undefined> {
  const rows = await database
    .select()
    .from(entries)
    .where(and(eq(entries.type, type), eq(entries.slug, slug)));
  return rows[0] ? toEntry(rows[0]) : undefined;
}

/** Lists every entry, oldest first. */
export async function listEntries(database: Database): Promise<Entry[]> {
  const rows = await database
    .select()
    .from(entries)
    .orderBy(asc(entries.createdAt), asc(entries.slug));
  return rows.map(toEntry);
}

/**
 * Lists every entry with the title of its latest revision and that revision's
 * save time, newest save first (design D5). One query joins each entry to its
 * highest-numbered revision; an unreadable content version throws, like
 * `listPublished`, so a bad row never reaches the list silently.
 */
export async function listEntrySummaries(
  database: Database,
): Promise<EntrySummary[]> {
  // The highest revision number per entry, as a correlated subquery: the join
  // then names exactly one revision per entry, without a second round trip.
  const latestNumber = sql`(
    select max(${revisions.number})
    from ${revisions}
    where ${revisions.entryId} = ${entries.id}
  )`;
  const rows = await database
    .select({
      id: entries.id,
      slug: entries.slug,
      schemaV: revisions.schemaV,
      content: revisions.content,
      lastSavedAt: revisions.createdAt,
      publishedRevisionId: entries.publishedRevisionId,
      projectionState: entries.projectionState,
    })
    .from(entries)
    .innerJoin(
      revisions,
      and(
        eq(revisions.entryId, entries.id),
        eq(revisions.number, latestNumber),
      ),
    )
    .orderBy(desc(revisions.createdAt), asc(entries.slug));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: readStoredContent({
      schema_v: row.schemaV,
      content: row.content,
    }).content.title,
    lastSavedAt: row.lastSavedAt,
    publishedRevisionId: row.publishedRevisionId,
    projectionState: toProjectionState(row.projectionState),
  }));
}

/** Counts every entry: the proof the binding and the role work (design D11). */
export async function countEntries(database: Database): Promise<number> {
  const rows = await database.select({ value: count() }).from(entries);
  return Number(rows[0]?.value ?? 0);
}

/** Lists an entry's revisions, lowest number first. */
export async function listRevisions(
  database: Database,
  entryId: string,
): Promise<Revision[]> {
  const rows = await database
    .select()
    .from(revisions)
    .where(eq(revisions.entryId, entryId))
    .orderBy(asc(revisions.number));
  return rows.map(toRevision);
}

/** Reads one revision by its entry and number, or `undefined`. */
export async function getRevision(
  database: Database,
  entryId: string,
  number: number,
): Promise<Revision | undefined> {
  const rows = await database
    .select()
    .from(revisions)
    .where(and(eq(revisions.entryId, entryId), eq(revisions.number, number)));
  return rows[0] ? toRevision(rows[0]) : undefined;
}

/**
 * Moves an entry's slug (design D2: the slug lives on the entry so it can be
 * unique per type). An invalid slug is returned as the same failure a write
 * returns, because the slug becomes the entry's public address; a taken slug
 * throws `DuplicateSlugError`, an entry published at least once throws
 * `PublishedSlugError` (design D2: the database is the second guard), and an
 * unknown id throws `MissingEntryError`.
 */
export async function updateSlug(
  database: Database,
  entryId: string,
  slug: string,
): Promise<{ readonly ok: true; readonly entry: Entry } | StoreFailure> {
  // Entries are articles (the only type in Sprint 2), so the article's slug
  // field is the rule their address must meet. The same rule runs in
  // `createEntry`, so the two cannot disagree.
  const checked = articleSchema.shape.slug.safeParse(slug);
  if (!checked.success) {
    return { ok: false, errors: slugErrors(checked.error) };
  }
  try {
    const rows = await database
      .update(entries)
      .set({ slug })
      // A publish that races the use case's check cannot slip past: the
      // address only moves while the entry has never been published (D2).
      .where(and(eq(entries.id, entryId), isNull(entries.firstPublishedAt)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw await refusalForMissingRow(database, entryId);
    }
    return { ok: true, entry: toEntry(row) };
  } catch (error) {
    if (isUniqueViolation(error, "entries_type_slug_unique")) {
      throw new DuplicateSlugError(slug);
    }
    throw error;
  }
}

/** The shape Drizzle returns for an `entries` row. */
type EntryRow = typeof entries.$inferSelect;
/** The shape Drizzle returns for a `revisions` row. */
type RevisionRow = typeof revisions.$inferSelect;

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    createdAt: row.createdAt,
  };
}

function toRevision(row: RevisionRow): Revision {
  return {
    id: row.id,
    entryId: row.entryId,
    number: row.number,
    createdAt: row.createdAt,
    stored: readStoredContent({ schema_v: row.schemaV, content: row.content }),
  };
}

/** Reads a `projection_state` column as the port's union (design D4). */
export function toProjectionState(value: string): ProjectionState {
  if (value === "clean" || value === "dirty") {
    return value;
  }
  throw new Error(`Unknown projection state "${value}".`);
}

// A slug move changed no row for one of two reasons: the entry is missing, or
// it has been published and the guard refused it (design D2).
async function refusalForMissingRow(
  database: Database,
  entryId: string,
): Promise<Error> {
  const rows = await database
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.id, entryId));
  return rows.length === 0
    ? new MissingEntryError(entryId)
    : new PublishedSlugError(entryId);
}

// The one row a `returning()` insert must produce.
function only<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error("The database returned no row for a single-row write.");
  }
  return row;
}

// A Postgres unique-violation (SQLSTATE 23505) on the named constraint.
function isUniqueViolation(error: unknown, constraint: string): boolean {
  return isPostgresViolation(error, "23505", constraint);
}

// A Postgres foreign-key violation (SQLSTATE 23503) on the revision's entry
// reference: the entry id names no row. It is how `appendRevision` learns of
// an unknown entry, since the insert is the first statement that checks it.
function isMissingEntryViolation(error: unknown): boolean {
  return isPostgresViolation(
    error,
    "23503",
    "revisions_entry_id_entries_id_fk",
  );
}

// A Postgres error with the given SQLSTATE and constraint. Drizzle wraps the
// driver's error, so the walk follows `cause` to the pg error that carries the
// code and constraint.
function isPostgresViolation(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current !== null && typeof current === "object";
    depth += 1
  ) {
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (candidate.code === code && candidate.constraint === constraint) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

// The refusal a form shows for an invalid slug: the first message the content
// model gave, keyed by the field name the form looks up (design D3).
function slugErrors(error: {
  readonly issues: readonly { readonly message: string }[];
}): ArticleErrors {
  const errors: ArticleErrors = {};
  for (const issue of error.issues) {
    errors["slug"] ??= issue.message;
  }
  return errors;
}
