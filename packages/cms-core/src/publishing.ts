// The publishing use cases (design D2; decisions C3 and C4). Each one moves
// the pointer and the dirty mark in the database of record, then projects the
// current published state into the snapshot store. A projection failure
// leaves the mark set, logs one line without the entry's content (D6), and
// still reports that the pointer moved.
import type { Clock, EntryRecord, EntryStore, SnapshotStore } from "./ports.ts";
import { buildEntrySnapshot, buildIndexSnapshot } from "./projector.ts";

/** The part of the request logger the use cases use (design D6). */
export interface ProjectionLogger {
  error(message: string, fields?: Record<string, unknown>): void;
}

/** What every use case needs (design D2): the three ports and the logger. */
export interface PublishingDependencies {
  readonly entries: EntryStore;
  readonly snapshots: SnapshotStore;
  readonly clock: Clock;
  readonly log: ProjectionLogger;
}

/**
 * What a use case returns (design D2). `live` says whether the snapshot store
 * now matches the database; a projection failure still returns `ok: true`
 * with `live: false`, because the pointer move itself succeeded.
 */
export type PublishingResult =
  | { readonly ok: true; readonly live: boolean }
  | { readonly ok: false; readonly reason: string };

/** The step that failed, as the log line names it (design D6). */
type ProjectionStep = "entry-snapshot" | "entry-removal" | "index";

/**
 * Makes one revision the entry's published revision and projects it (design
 * D2). A revision that belongs to a different entry is refused before
 * anything changes.
 */
export async function publishRevision(
  dependencies: PublishingDependencies,
  entryId: string,
  revisionId: string,
): Promise<PublishingResult> {
  const entry = await dependencies.entries.findEntry(entryId);
  if (entry === undefined) {
    return refuse(missingEntry(entryId));
  }
  const revision = await dependencies.entries.getRevision(revisionId);
  if (revision === undefined) {
    return refuse(missingRevision(revisionId));
  }
  if (revision.entryId !== entry.id) {
    return refuse("The revision belongs to a different entry.");
  }
  await dependencies.entries.markPublished(
    entry.id,
    revision.id,
    dependencies.clock.now(),
  );
  return project(dependencies, entry.id);
}

/**
 * Publishes an earlier revision of the same entry (design D2). It is its own
 * function so admin's action and the logs can name the owner's intent.
 */
export function rollBack(
  dependencies: PublishingDependencies,
  entryId: string,
  revisionId: string,
): Promise<PublishingResult> {
  return publishRevision(dependencies, entryId, revisionId);
}

/**
 * Clears the published pointer, removes the entry's snapshot and rebuilds the
 * index (design D2). The entry's revisions remain.
 */
export async function unpublish(
  dependencies: PublishingDependencies,
  entryId: string,
): Promise<PublishingResult> {
  const entry = await dependencies.entries.findEntry(entryId);
  if (entry === undefined) {
    return refuse(missingEntry(entryId));
  }
  await dependencies.entries.markUnpublished(entry.id);
  return project(dependencies, entry.id);
}

/**
 * Repeats the projection of the entry's current published state (design D2).
 * It is idempotent: a retry after a partial or failed projection rewrites the
 * same entry snapshot and index from the database of record.
 */
export async function retryProjection(
  dependencies: PublishingDependencies,
  entryId: string,
): Promise<PublishingResult> {
  const entry = await dependencies.entries.findEntry(entryId);
  if (entry === undefined) {
    return refuse(missingEntry(entryId));
  }
  return project(dependencies, entry.id);
}

/**
 * Changes a slug while the entry has never been published (design D2; spec
 * "Slug fixed after first publish"). Once the first publish time is set, the
 * old address may already be public, so the change is refused.
 */
export async function changeSlug(
  dependencies: PublishingDependencies,
  entryId: string,
  slug: string,
): Promise<PublishingResult> {
  const entry = await dependencies.entries.findEntry(entryId);
  if (entry === undefined) {
    return refuse(missingEntry(entryId));
  }
  if (entry.firstPublishedAt !== null) {
    return refuse("Published slugs cannot change.");
  }
  await dependencies.entries.updateSlug(entry.id, slug);
  return { ok: true, live: entry.publishedRevisionId !== null };
}

// The shared projection (design D2): read the entry again, which is the
// source of truth, then write the entry snapshot or remove it, rebuild the
// index from every published entry of the type, and only then clear the mark.
async function project(
  dependencies: PublishingDependencies,
  entryId: string,
): Promise<PublishingResult> {
  const entry = await dependencies.entries.findEntry(entryId);
  if (entry === undefined) {
    return refuse(missingEntry(entryId));
  }
  const entryOutcome =
    entry.publishedRevisionId === null
      ? await removeEntrySnapshot(dependencies, entry)
      : await writeEntrySnapshot(
          dependencies,
          entry,
          entry.publishedRevisionId,
        );
  if (!entryOutcome) {
    return { ok: true, live: false };
  }
  if (!(await writeIndex(dependencies, entry))) {
    return { ok: true, live: false };
  }
  await dependencies.entries.markProjected(entry.id);
  return { ok: true, live: true };
}

// The entry half of the projection. A false result means the step failed and
// was logged; the dirty mark stays set (design D2).
async function writeEntrySnapshot(
  dependencies: PublishingDependencies,
  entry: EntryRecord,
  revisionId: string,
): Promise<boolean> {
  try {
    const revision = await dependencies.entries.getRevision(revisionId);
    if (revision === undefined) {
      throw new Error(missingRevision(revisionId));
    }
    const snapshot = buildEntrySnapshot(entry, revision);
    await dependencies.snapshots.putEntry(entry.type, entry.slug, snapshot);
    return true;
  } catch (error) {
    logProjectionFailure(dependencies, entry.id, "entry-snapshot", error);
    return false;
  }
}

// Removing an unpublished entry's snapshot is the other half of the entry
// step; a retry repeats it safely (design D2).
async function removeEntrySnapshot(
  dependencies: PublishingDependencies,
  entry: EntryRecord,
): Promise<boolean> {
  try {
    await dependencies.snapshots.deleteEntry(entry.type, entry.slug);
    return true;
  } catch (error) {
    logProjectionFailure(dependencies, entry.id, "entry-removal", error);
    return false;
  }
}

// Rebuilding the whole index from the database of record (design D3) is the
// second step; it runs on every publish, rollback, unpublish and retry.
async function writeIndex(
  dependencies: PublishingDependencies,
  entry: { readonly id: string; readonly type: string },
): Promise<boolean> {
  try {
    const published = await dependencies.entries.listPublished(entry.type);
    const index = buildIndexSnapshot(entry.type, published);
    await dependencies.snapshots.putIndex(entry.type, "en", index);
    return true;
  } catch (error) {
    logProjectionFailure(dependencies, entry.id, "index", error);
    return false;
  }
}

// One error line per failed projection, naming the entry and the step, and
// never the title, summary or body (design D6; observability delta).
function logProjectionFailure(
  dependencies: PublishingDependencies,
  entryId: string,
  step: ProjectionStep,
  error: unknown,
): void {
  dependencies.log.error("projection failed", {
    entryId,
    step,
    error: error instanceof Error ? error.message : String(error),
  });
}

function missingEntry(entryId: string): string {
  return `No entry has the id ${entryId}.`;
}

function missingRevision(revisionId: string): string {
  return `No revision has the id ${revisionId}.`;
}

function refuse(reason: string): PublishingResult {
  return { ok: false, reason };
}
