// The ports the publishing use cases depend on (design D1; decision C1).
// cms-core owns the rules and sees only these interfaces; @ycmcuenca/db
// implements EntryStore and admin implements SnapshotStore on KV, so the
// rules run in unit tests against fakes and never against a real service.
import type { EntrySnapshot, IndexSnapshot } from "./snapshot.ts";

/** Whether an entry's published state has reached the snapshot store (D1). */
export type ProjectionState = "clean" | "dirty";

/**
 * One entry as the publishing use cases read it (design D1): its address, the
 * revision it points at, its publish times and whether it still needs
 * projecting.
 */
export interface EntryRecord {
  readonly id: string;
  readonly type: string;
  readonly slug: string;
  /** The published revision, or nothing while the entry is unpublished. */
  readonly publishedRevisionId: string | null;
  /** When the entry was first published; it never moves once set (spec). */
  readonly firstPublishedAt: Date | null;
  /** When the entry was most recently published or rolled back (spec). */
  readonly lastPublishedAt: Date | null;
  readonly projectionState: ProjectionState;
}

/**
 * One stored revision as the use cases read it (design D1). `stored` is the
 * value the store holds; the projector reads it through `readStoredContent`,
 * so a version this code cannot read fails the projection loudly (D3).
 */
export interface RevisionRecord {
  readonly id: string;
  readonly entryId: string;
  readonly number: number;
  readonly stored: unknown;
}

/**
 * One published entry as its type's index lists it (design D1). The content
 * comes from the entry's published revision, read from the database of record.
 */
export interface PublishedEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly firstPublishedAt: Date;
}

/**
 * The entries and revisions of record, owned by @ycmcuenca/db (design D1).
 * The two mark methods move the published pointer and set the dirty mark in
 * one write, so a crash can never separate them (D2).
 */
export interface EntryStore {
  findEntry(entryId: string): Promise<EntryRecord | undefined>;
  getRevision(revisionId: string): Promise<RevisionRecord | undefined>;
  markPublished(entryId: string, revisionId: string, at: Date): Promise<void>;
  markUnpublished(entryId: string): Promise<void>;
  markProjected(entryId: string): Promise<void>;
  listPublished(type: string): Promise<PublishedEntry[]>;
  /**
   * Moves an entry's slug (design D2). The database adds "only while never
   * published" as a second guard, so a raced publish cannot slip past the
   * use case's check.
   */
  updateSlug(entryId: string, slug: string): Promise<void>;
}

/**
 * The published snapshot store, owned by admin and backed by KV (design D1).
 * Every method replaces a whole value: the index is rebuilt from the database
 * of record, never read-modify-written in KV (D3).
 */
export interface SnapshotStore {
  putEntry(type: string, slug: string, snapshot: EntrySnapshot): Promise<void>;
  deleteEntry(type: string, slug: string): Promise<void>;
  putIndex(type: string, locale: string, index: IndexSnapshot): Promise<void>;
}

/** The time source the use cases use, so a test can move time (design D1). */
export interface Clock {
  now(): Date;
}
