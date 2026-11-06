// The projector (design D3; decisions C4, C8 and C9): it turns the database
// of record into the two versioned snapshots KV holds. Rendering happens
// here, at publish, and the result is parsed with the same schema welcome
// reads, so a projector bug fails in admin instead of reaching a visitor.
import type { EntryRecord, PublishedEntry, RevisionRecord } from "./ports.ts";
import { renderMarkdown } from "./render-markdown.ts";
import { entrySnapshot, indexSnapshot, snapshotVersion } from "./snapshot.ts";
import type { EntrySnapshot, IndexSnapshot } from "./snapshot.ts";
import { readStoredContent } from "./stored-content.ts";

/**
 * Builds the snapshot of a published entry (design D3): the revision's title,
 * summary and rendered blocks, with the entry's first and last publish times
 * as ISO 8601 UTC strings.
 */
export function buildEntrySnapshot(
  entry: EntryRecord,
  revision: RevisionRecord,
): EntrySnapshot {
  const content = readStoredContent(revision.stored).content;
  return entrySnapshot.parse({
    snapshot_v: snapshotVersion,
    type: entry.type,
    slug: entry.slug,
    title: content.title,
    summary: content.summary,
    blocks: content.body.map((block) => ({
      type: "markdown",
      html: renderMarkdown(block.source),
    })),
    publishedAt: isoUtc(entry.firstPublishedAt, "first publish time"),
    updatedAt: isoUtc(entry.lastPublishedAt, "last publish time"),
  });
}

/**
 * Builds the index of one type (design D3): every published entry, newest
 * first publish first, and by slug when two share a first-publish time, so
 * the order is stable.
 */
export function buildIndexSnapshot(
  type: string,
  published: readonly PublishedEntry[],
): IndexSnapshot {
  const items = [...published].sort(comparePublished).map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    summary: entry.summary,
    publishedAt: entry.firstPublishedAt.toISOString(),
  }));
  return indexSnapshot.parse({
    snapshot_v: snapshotVersion,
    type,
    locale: "en",
    items,
  });
}

// Newest first publish first; equal times fall back to the slug, ascending.
function comparePublished(a: PublishedEntry, b: PublishedEntry): number {
  const byFirstPublish =
    b.firstPublishedAt.getTime() - a.firstPublishedAt.getTime();
  if (byFirstPublish !== 0) {
    return byFirstPublish;
  }
  if (a.slug < b.slug) {
    return -1;
  }
  return a.slug > b.slug ? 1 : 0;
}

// A publish time as the snapshot schema requires it. A missing time means the
// entry was never properly published, so it fails loudly here (D3).
function isoUtc(value: Date | null, name: string): string {
  if (value === null) {
    throw new Error(`The entry has no ${name}.`);
  }
  return value.toISOString();
}
