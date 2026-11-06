import { describe, expect, it } from "vitest";
import type {
  Clock,
  EntryRecord,
  EntryStore,
  PublishedEntry,
  RevisionRecord,
  SlugChange,
  SnapshotStore,
} from "./ports";
import {
  changeSlug,
  publishRevision,
  retryProjection,
  rollBack,
  unpublish,
} from "./publishing";
import type { PublishingDependencies, ProjectionLogger } from "./publishing";
import { entryKey, indexKey } from "./snapshot-keys";
import type { EntrySnapshot, IndexSnapshot } from "./snapshot";
import { readStoredContent } from "./stored-content";

interface RevisionContent {
  readonly title: string;
  readonly summary: string;
  readonly markdown: string;
}

class MemoryEntryStore implements EntryStore {
  private readonly records = new Map<string, EntryRecord>();
  private readonly storedRevisions = new Map<string, RevisionRecord>();
  private nextEntry = 1;
  private nextRevision = 1;

  createEntry(slug: string, type = "article"): EntryRecord {
    const id = `entry-${this.nextEntry++}`;
    const entry: EntryRecord = {
      id,
      type,
      slug,
      publishedRevisionId: null,
      firstPublishedAt: null,
      lastPublishedAt: null,
      projectionState: "clean",
    };
    this.records.set(id, entry);
    return entry;
  }

  createRevision(entryId: string, content: RevisionContent): RevisionRecord {
    const id = `revision-${this.nextRevision++}`;
    const revision: RevisionRecord = {
      id,
      entryId,
      number: this.nextNumberFor(entryId),
      stored: {
        schema_v: 1,
        content: {
          title: content.title,
          summary: content.summary,
          body: [{ type: "markdown", source: content.markdown }],
        },
      },
    };
    this.storedRevisions.set(id, revision);
    return revision;
  }

  entry(entryId: string): EntryRecord {
    const entry = this.records.get(entryId);
    if (entry === undefined) {
      throw new Error(`No entry has the id ${entryId}.`);
    }
    return entry;
  }

  revisions(): readonly RevisionRecord[] {
    return [...this.storedRevisions.values()];
  }

  async findEntry(entryId: string): Promise<EntryRecord | undefined> {
    return this.records.get(entryId);
  }

  async getRevision(revisionId: string): Promise<RevisionRecord | undefined> {
    return this.storedRevisions.get(revisionId);
  }

  async markPublished(
    entryId: string,
    revisionId: string,
    at: Date,
  ): Promise<void> {
    const entry = this.entry(entryId);
    this.records.set(entryId, {
      ...entry,
      publishedRevisionId: revisionId,
      firstPublishedAt: entry.firstPublishedAt ?? at,
      lastPublishedAt: at,
      projectionState: "dirty",
    });
  }

  async markUnpublished(entryId: string): Promise<void> {
    const entry = this.entry(entryId);
    this.records.set(entryId, {
      ...entry,
      publishedRevisionId: null,
      projectionState: "dirty",
    });
  }

  async markProjected(
    entryId: string,
    revisionId: string | null,
  ): Promise<void> {
    const entry = this.entry(entryId);
    if (entry.publishedRevisionId !== revisionId) {
      return;
    }
    this.records.set(entryId, { ...entry, projectionState: "clean" });
  }

  async listPublished(type: string): Promise<PublishedEntry[]> {
    const published: PublishedEntry[] = [];
    for (const entry of this.records.values()) {
      if (
        entry.type !== type ||
        entry.publishedRevisionId === null ||
        entry.firstPublishedAt === null
      ) {
        continue;
      }
      const revision = this.storedRevisions.get(entry.publishedRevisionId);
      if (revision === undefined) {
        throw new Error(`No revision has the id ${entry.publishedRevisionId}.`);
      }
      const content = readStoredContent(revision.stored).content;
      published.push({
        slug: entry.slug,
        title: content.title,
        summary: content.summary,
        firstPublishedAt: entry.firstPublishedAt,
      });
    }
    return published;
  }

  async updateSlug(entryId: string, slug: string): Promise<SlugChange> {
    const entry = this.entry(entryId);
    for (const other of this.records.values()) {
      if (
        other.id !== entryId &&
        other.type === entry.type &&
        other.slug === slug
      ) {
        return {
          ok: false,
          reason: `An article already uses the slug "${slug}".`,
        };
      }
    }
    this.records.set(entryId, { ...entry, slug });
    return { ok: true };
  }

  private nextNumberFor(entryId: string): number {
    let highest = 0;
    for (const revision of this.storedRevisions.values()) {
      if (revision.entryId === entryId && revision.number > highest) {
        highest = revision.number;
      }
    }
    return highest + 1;
  }
}

class MemorySnapshotStore implements SnapshotStore {
  readonly entrySnapshots = new Map<string, EntrySnapshot>();
  readonly indexes = new Map<string, IndexSnapshot>();
  failPutEntry = false;
  failDeleteEntry = false;
  failPutIndex = false;

  entryFor(type: string, slug: string): EntrySnapshot | undefined {
    return this.entrySnapshots.get(entryKey(type, slug));
  }

  indexFor(type: string, locale: string): IndexSnapshot | undefined {
    return this.indexes.get(indexKey(type, locale));
  }

  async putEntry(
    type: string,
    slug: string,
    snapshot: EntrySnapshot,
  ): Promise<void> {
    if (this.failPutEntry) {
      throw new Error("The snapshot store is unavailable.");
    }
    this.entrySnapshots.set(entryKey(type, slug), snapshot);
  }

  async deleteEntry(type: string, slug: string): Promise<void> {
    if (this.failDeleteEntry) {
      throw new Error("The snapshot store is unavailable.");
    }
    this.entrySnapshots.delete(entryKey(type, slug));
  }

  async putIndex(
    type: string,
    locale: string,
    index: IndexSnapshot,
  ): Promise<void> {
    if (this.failPutIndex) {
      throw new Error("The snapshot store is unavailable.");
    }
    this.indexes.set(indexKey(type, locale), index);
  }
}

// Holds a step to run just before the next entry snapshot lands, so a test
// can land another publish in the middle of a projection.
class InterleavingSnapshotStore implements SnapshotStore {
  private readonly inner: MemorySnapshotStore;
  private readonly steps: Array<() => Promise<void>> = [];

  constructor(inner: MemorySnapshotStore) {
    this.inner = inner;
  }

  beforePutEntry(step: () => Promise<void>): void {
    this.steps.push(step);
  }

  async putEntry(
    type: string,
    slug: string,
    snapshot: EntrySnapshot,
  ): Promise<void> {
    await this.steps.shift()?.();
    await this.inner.putEntry(type, slug, snapshot);
  }

  deleteEntry(type: string, slug: string): Promise<void> {
    return this.inner.deleteEntry(type, slug);
  }

  putIndex(type: string, locale: string, index: IndexSnapshot): Promise<void> {
    return this.inner.putIndex(type, locale, index);
  }
}

class FixedClock implements Clock {
  private time: Date;

  constructor(time: Date) {
    this.time = time;
  }

  now(): Date {
    return this.time;
  }

  set(time: Date): void {
    this.time = time;
  }
}

interface LogLine {
  readonly level: "error";
  readonly message: string;
  readonly fields: Record<string, unknown> | undefined;
}

class MemoryLogger implements ProjectionLogger {
  readonly lines: LogLine[] = [];

  error(message: string, fields?: Record<string, unknown>): void {
    this.lines.push({ level: "error", message, fields });
  }
}

interface Fixture {
  readonly dependencies: PublishingDependencies;
  readonly entries: MemoryEntryStore;
  readonly snapshots: MemorySnapshotStore;
  readonly clock: FixedClock;
  readonly log: MemoryLogger;
}

function setup(): Fixture {
  const entries = new MemoryEntryStore();
  const snapshots = new MemorySnapshotStore();
  const clock = new FixedClock(new Date("2026-11-01T09:00:00.000Z"));
  const log = new MemoryLogger();
  return {
    dependencies: { entries, snapshots, clock, log },
    entries,
    snapshots,
    clock,
    log,
  };
}

const content = (title: string, markdown = `# ${title}`): RevisionContent => ({
  title,
  summary: `${title} summary.`,
  markdown,
});

describe("publishRevision", () => {
  it("publishes the first revision and writes its snapshot and index", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));

    const result = await publishRevision(dependencies, entry.id, revision.id);

    expect(result).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id)).toMatchObject({
      publishedRevisionId: revision.id,
      projectionState: "clean",
    });
    expect(snapshots.entryFor("article", "hello-world")).toMatchObject({
      title: "Hello world",
      summary: "Hello world summary.",
      blocks: [{ type: "markdown", html: "<h1>Hello world</h1>\n" }],
    });
    expect(snapshots.indexFor("article", "en")?.items).toEqual([
      {
        slug: "hello-world",
        title: "Hello world",
        summary: "Hello world summary.",
        publishedAt: "2026-11-01T09:00:00.000Z",
      },
    ]);
  });

  it("publishes a newer revision without touching the stored revisions", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const first = entries.createRevision(entry.id, content("First"));
    const second = entries.createRevision(entry.id, content("Second"));
    const third = entries.createRevision(entry.id, content("Third"));
    const revisionsBefore = entries.revisions();

    await publishRevision(dependencies, entry.id, second.id);
    const result = await publishRevision(dependencies, entry.id, third.id);

    expect(result).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id).publishedRevisionId).toBe(third.id);
    expect(snapshots.entryFor("article", "hello-world")?.title).toBe("Third");
    expect(entries.revisions()).toEqual(revisionsBefore);
    expect(entries.revisions().map((revision) => revision.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });

  it("keeps the mark dirty when another publish moves the pointer mid-projection", async () => {
    const fixture = setup();
    const { entries, snapshots, clock } = fixture;
    const interleaved = new InterleavingSnapshotStore(snapshots);
    const dependencies = { ...fixture.dependencies, snapshots: interleaved };
    const entry = entries.createEntry("hello-world");
    const first = entries.createRevision(entry.id, content("First"));
    const second = entries.createRevision(entry.id, content("Second"));

    // The pointer stays put, so the projection clears the mark as before.
    await publishRevision(dependencies, entry.id, first.id);
    expect(entries.entry(entry.id).projectionState).toBe("clean");

    // Another tab publishes `second` while this one writes `first`'s
    // snapshot, so this projection finishes with a pointer that moved on.
    interleaved.beforePutEntry(() =>
      entries.markPublished(entry.id, second.id, clock.now()),
    );
    await publishRevision(dependencies, entry.id, first.id);

    expect(entries.entry(entry.id)).toMatchObject({
      publishedRevisionId: second.id,
      projectionState: "dirty",
    });

    // Retry reprojects what the pointer now names and clears the mark.
    const repaired = await retryProjection(dependencies, entry.id);

    expect(repaired).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id).projectionState).toBe("clean");
    expect(snapshots.entryFor("article", "hello-world")?.title).toBe("Second");
  });

  it("refuses a revision that belongs to another entry", async () => {
    const { dependencies, entries, snapshots } = setup();
    const first = entries.createEntry("first");
    entries.createRevision(first.id, content("First"));
    const second = entries.createEntry("second");
    const otherRevision = entries.createRevision(second.id, content("Second"));

    const result = await publishRevision(
      dependencies,
      first.id,
      otherRevision.id,
    );

    expect(result).toEqual({
      ok: false,
      reason: "The revision belongs to a different entry.",
    });
    expect(entries.entry(first.id).publishedRevisionId).toBeNull();
    expect(entries.entry(second.id).publishedRevisionId).toBeNull();
    expect(snapshots.entrySnapshots.size).toBe(0);
    expect(snapshots.indexes.size).toBe(0);
  });

  it("refuses a revision that is not stored", async () => {
    const { dependencies, entries } = setup();
    const entry = entries.createEntry("hello-world");
    entries.createRevision(entry.id, content("Hello world"));

    const result = await publishRevision(
      dependencies,
      entry.id,
      "missing-revision",
    );

    expect(result).toEqual({
      ok: false,
      reason: "No revision has the id missing-revision.",
    });
    expect(entries.entry(entry.id).publishedRevisionId).toBeNull();
  });
});

describe("rollBack", () => {
  it("publishes an earlier revision exactly as publishing it would", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const first = entries.createRevision(entry.id, content("First"));
    entries.createRevision(entry.id, content("Second"));
    const third = entries.createRevision(entry.id, content("Third"));
    await publishRevision(dependencies, entry.id, third.id);

    const result = await rollBack(dependencies, entry.id, first.id);

    expect(result).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id).publishedRevisionId).toBe(first.id);
    expect(snapshots.entryFor("article", "hello-world")?.title).toBe("First");
  });
});

describe("unpublish", () => {
  it("removes the entry snapshot and its index item, keeping the revisions", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    await publishRevision(dependencies, entry.id, revision.id);

    const result = await unpublish(dependencies, entry.id);

    expect(result).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id)).toMatchObject({
      publishedRevisionId: null,
      projectionState: "clean",
    });
    expect(snapshots.entryFor("article", "hello-world")).toBeUndefined();
    expect(snapshots.indexFor("article", "en")?.items).toEqual([]);
    expect(entries.revisions()).toHaveLength(1);
  });
});

describe("the type index", () => {
  it("lists every published entry, newest first publish first", async () => {
    const { dependencies, entries, snapshots, clock } = setup();
    const older = entries.createEntry("older");
    const olderRevision = entries.createRevision(older.id, content("Older"));
    const newer = entries.createEntry("newer");
    const newerRevision = entries.createRevision(newer.id, content("Newer"));

    clock.set(new Date("2026-11-01T09:00:00.000Z"));
    await publishRevision(dependencies, older.id, olderRevision.id);
    clock.set(new Date("2026-11-02T09:00:00.000Z"));
    await publishRevision(dependencies, newer.id, newerRevision.id);

    expect(snapshots.indexFor("article", "en")?.items).toEqual([
      {
        slug: "newer",
        title: "Newer",
        summary: "Newer summary.",
        publishedAt: "2026-11-02T09:00:00.000Z",
      },
      {
        slug: "older",
        title: "Older",
        summary: "Older summary.",
        publishedAt: "2026-11-01T09:00:00.000Z",
      },
    ]);
  });

  it("lists only the entries that stay published", async () => {
    const { dependencies, entries, snapshots } = setup();
    const first = entries.createEntry("first");
    const firstRevision = entries.createRevision(first.id, content("First"));
    const second = entries.createEntry("second");
    const secondRevision = entries.createRevision(second.id, content("Second"));
    await publishRevision(dependencies, first.id, firstRevision.id);
    await publishRevision(dependencies, second.id, secondRevision.id);

    await unpublish(dependencies, first.id);

    expect(
      snapshots.indexFor("article", "en")?.items.map((item) => item.slug),
    ).toEqual(["second"]);
  });
});

describe("publish times", () => {
  it("keeps the first-publish time across an unpublish and republish", async () => {
    const { dependencies, entries, snapshots, clock } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    const firstPublish = new Date("2026-11-01T09:00:00.000Z");
    const secondPublish = new Date("2026-11-05T09:00:00.000Z");

    clock.set(firstPublish);
    await publishRevision(dependencies, entry.id, revision.id);
    const firstSnapshot = snapshots.entryFor("article", "hello-world");

    clock.set(secondPublish);
    await unpublish(dependencies, entry.id);
    await publishRevision(dependencies, entry.id, revision.id);

    const secondSnapshot = snapshots.entryFor("article", "hello-world");
    expect(secondSnapshot?.publishedAt).toBe(firstSnapshot?.publishedAt);
    expect(secondSnapshot?.publishedAt).toBe("2026-11-01T09:00:00.000Z");
    expect(secondSnapshot?.updatedAt).toBe("2026-11-05T09:00:00.000Z");
    expect(entries.entry(entry.id).firstPublishedAt).toEqual(firstPublish);
    expect(entries.entry(entry.id).lastPublishedAt).toEqual(secondPublish);
  });
});

describe("a failed projection", () => {
  it("moves the pointer, keeps the entry dirty and logs once without content", async () => {
    const { dependencies, entries, snapshots, log } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(
      entry.id,
      content("Hello world", "# Hello world secret body"),
    );
    snapshots.failPutEntry = true;

    const result = await publishRevision(dependencies, entry.id, revision.id);

    expect(result).toEqual({ ok: true, live: false });
    expect(entries.entry(entry.id)).toMatchObject({
      publishedRevisionId: revision.id,
      projectionState: "dirty",
    });
    expect(snapshots.entryFor("article", "hello-world")).toBeUndefined();
    expect(log.lines).toEqual([
      {
        level: "error",
        message: "projection failed",
        fields: {
          entryId: entry.id,
          step: "entry-snapshot",
          error: "The snapshot store is unavailable.",
        },
      },
    ]);
    const logged = JSON.stringify(log.lines);
    expect(logged).not.toContain("Hello world");
    expect(logged).not.toContain("Hello world summary.");
    expect(logged).not.toContain("secret body");
  });

  it("leaves the entry dirty when the index write fails", async () => {
    const { dependencies, entries, snapshots, log } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    snapshots.failPutIndex = true;

    const result = await publishRevision(dependencies, entry.id, revision.id);

    expect(result).toEqual({ ok: true, live: false });
    expect(entries.entry(entry.id).projectionState).toBe("dirty");
    expect(snapshots.entryFor("article", "hello-world")).toBeDefined();
    expect(log.lines[0]?.fields).toEqual({
      entryId: entry.id,
      step: "index",
      error: "The snapshot store is unavailable.",
    });
  });
});

describe("retryProjection", () => {
  it("clears the mark and writes the snapshot once the store is available", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    snapshots.failPutEntry = true;
    await publishRevision(dependencies, entry.id, revision.id);
    snapshots.failPutEntry = false;

    const result = await retryProjection(dependencies, entry.id);

    expect(result).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id).projectionState).toBe("clean");
    expect(snapshots.entryFor("article", "hello-world")?.title).toBe(
      "Hello world",
    );
    expect(snapshots.indexFor("article", "en")?.items).toHaveLength(1);
  });

  it("is idempotent when it runs twice", async () => {
    const { dependencies, entries, snapshots } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    await publishRevision(dependencies, entry.id, revision.id);
    const originalEntry = snapshots.entryFor("article", "hello-world");
    const originalIndex = snapshots.indexFor("article", "en");

    const firstRetry = await retryProjection(dependencies, entry.id);
    const firstEntry = snapshots.entryFor("article", "hello-world");
    const firstIndex = snapshots.indexFor("article", "en");
    const secondRetry = await retryProjection(dependencies, entry.id);

    expect(firstRetry).toEqual({ ok: true, live: true });
    expect(secondRetry).toEqual({ ok: true, live: true });
    expect(firstEntry).toEqual(originalEntry);
    expect(firstIndex).toEqual(originalIndex);
    expect(snapshots.entryFor("article", "hello-world")).toEqual(firstEntry);
    expect(snapshots.indexFor("article", "en")).toEqual(firstIndex);
  });

  it("finishes an unpublish that failed to remove the snapshot", async () => {
    const { dependencies, entries, snapshots, log } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    await publishRevision(dependencies, entry.id, revision.id);
    snapshots.failDeleteEntry = true;
    const failed = await unpublish(dependencies, entry.id);

    expect(failed).toEqual({ ok: true, live: false });
    expect(entries.entry(entry.id)).toMatchObject({
      publishedRevisionId: null,
      projectionState: "dirty",
    });
    expect(snapshots.entryFor("article", "hello-world")).toBeDefined();
    expect(log.lines[0]?.fields).toEqual({
      entryId: entry.id,
      step: "entry-removal",
      error: "The snapshot store is unavailable.",
    });

    snapshots.failDeleteEntry = false;
    const retried = await retryProjection(dependencies, entry.id);

    expect(retried).toEqual({ ok: true, live: true });
    expect(entries.entry(entry.id).projectionState).toBe("clean");
    expect(snapshots.entryFor("article", "hello-world")).toBeUndefined();
    expect(snapshots.indexFor("article", "en")?.items).toEqual([]);
  });
});

describe("changeSlug", () => {
  it("changes the slug of an entry that was never published", async () => {
    const { dependencies, entries } = setup();
    const entry = entries.createEntry("old-slug");

    const result = await changeSlug(dependencies, entry.id, "new-slug");

    expect(result).toEqual({ ok: true, live: false });
    expect(entries.entry(entry.id).slug).toBe("new-slug");
  });

  it("refuses to change the slug of an entry published at least once", async () => {
    const { dependencies, entries } = setup();
    const entry = entries.createEntry("hello-world");
    const revision = entries.createRevision(entry.id, content("Hello world"));
    await publishRevision(dependencies, entry.id, revision.id);

    const result = await changeSlug(dependencies, entry.id, "other-slug");

    expect(result).toEqual({
      ok: false,
      reason: "Published slugs cannot change.",
    });
    expect(entries.entry(entry.id).slug).toBe("hello-world");
  });

  it("returns the store's refusal when another entry uses the slug", async () => {
    const { dependencies, entries } = setup();
    entries.createEntry("taken");
    const entry = entries.createEntry("free");

    const result = await changeSlug(dependencies, entry.id, "taken");

    expect(result).toEqual({
      ok: false,
      reason: 'An article already uses the slug "taken".',
    });
    expect(entries.entry(entry.id).slug).toBe("free");
  });
});
