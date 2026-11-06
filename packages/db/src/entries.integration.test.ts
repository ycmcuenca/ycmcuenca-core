// The store's behavior against a real Postgres (spec "content-store"),
// exercised as the runtime role. Every case truncates first, so they are
// independent (design D2, D3).
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AppendRevisionResult,
  CreateEntryResult,
  Entry,
  Revision,
} from "./index.ts";
import {
  appendRevision,
  countEntries,
  createEntry,
  DuplicateSlugError,
  findEntry,
  getRevision,
  listEntries,
  listEntrySummaries,
  listRevisions,
  MissingEntryError,
  updateSlug,
} from "./index.ts";
import { entryStoreFor } from "./publishing.ts";
import {
  articleInput,
  asRuntimeRole,
  truncateEntries,
} from "./test-helpers.ts";

beforeEach(truncateEntries);

// A creation that must have succeeded; narrows the result for the test body.
function creation(result: CreateEntryResult): {
  entry: Entry;
  revision: Revision;
} {
  if (!result.ok) {
    throw new Error(
      `expected creation to succeed: ${JSON.stringify(result.errors)}`,
    );
  }
  return { entry: result.entry, revision: result.revision };
}

// An append that must have succeeded; narrows the result for the test body.
function appended(result: AppendRevisionResult): Revision {
  if (!result.ok) {
    throw new Error(
      `expected append to succeed: ${JSON.stringify(result.errors)}`,
    );
  }
  return result.revision;
}

describe("entries", () => {
  it("creates an entry with a new id, its type and its first revision", async () => {
    const { entry, revision } = creation(
      await asRuntimeRole((db) => createEntry(db, articleInput())),
    );
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.type).toBe("article");
    expect(entry.slug).toBe("hello-world");
    expect(revision.number).toBe(1);
  });

  it("refuses a duplicate slug, names it, and stores nothing", async () => {
    creation(await asRuntimeRole((db) => createEntry(db, articleInput())));

    const error = await asRuntimeRole((db) =>
      createEntry(db, articleInput()),
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(DuplicateSlugError);
    expect((error as DuplicateSlugError).slug).toBe("hello-world");
    expect(await asRuntimeRole((db) => countEntries(db))).toBe(1);
  });

  it("returns validation errors and stores nothing for invalid content", async () => {
    const result = await asRuntimeRole((db) =>
      createEntry(db, articleInput({ slug: "Not A Slug" })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors["slug"]).toBeDefined();
    expect(await asRuntimeRole((db) => countEntries(db))).toBe(0);
  });

  it("finds, lists and counts entries", async () => {
    creation(
      await asRuntimeRole((db) => createEntry(db, articleInput({ slug: "a" }))),
    );
    creation(
      await asRuntimeRole((db) => createEntry(db, articleInput({ slug: "b" }))),
    );

    const found = await asRuntimeRole((db) => findEntry(db, "article", "a"));
    expect(found?.slug).toBe("a");
    expect(
      await asRuntimeRole((db) => findEntry(db, "article", "missing")),
    ).toBeUndefined();

    const listed = await asRuntimeRole((db) => listEntries(db));
    expect(listed.map((entry) => entry.slug).sort()).toEqual(["a", "b"]);
    expect(await asRuntimeRole((db) => countEntries(db))).toBe(2);
  });

  it("moves a slug, and refuses a duplicate, an invalid slug or an unknown entry", async () => {
    const { entry } = creation(
      await asRuntimeRole((db) => createEntry(db, articleInput())),
    );
    creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ slug: "taken" })),
      ),
    );

    const updated = await asRuntimeRole((db) =>
      updateSlug(db, entry.id, "moved"),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.entry.slug).toBe("moved");
    expect(
      await asRuntimeRole((db) => findEntry(db, "article", "moved")),
    ).toBeDefined();

    const refused = await asRuntimeRole((db) =>
      updateSlug(db, entry.id, "Not A Slug"),
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.errors["slug"]).toBeDefined();
    // The address did not move.
    expect(
      await asRuntimeRole((db) => findEntry(db, "article", "moved")),
    ).toBeDefined();

    await expect(
      asRuntimeRole((db) => updateSlug(db, entry.id, "taken")),
    ).rejects.toBeInstanceOf(DuplicateSlugError);
    await expect(
      asRuntimeRole((db) =>
        updateSlug(db, "00000000-0000-0000-0000-000000000000", "gone"),
      ),
    ).rejects.toBeInstanceOf(MissingEntryError);
  });
});

describe("revisions", () => {
  it("numbers each save one higher and never changes an earlier revision", async () => {
    const { entry, revision } = creation(
      await asRuntimeRole((db) => createEntry(db, articleInput())),
    );
    expect(revision.stored.content.body[0]?.source).toBe("Hello there.");

    await asRuntimeRole((db) =>
      appendRevision(db, entry.id, articleInput({ source: "Second." })),
    );
    await asRuntimeRole((db) =>
      appendRevision(db, entry.id, articleInput({ source: "Third." })),
    );

    const revisions = await asRuntimeRole((db) => listRevisions(db, entry.id));
    expect(revisions.map((stored) => stored.number)).toEqual([1, 2, 3]);
    // The first revision still holds what it was written with.
    expect(revisions[0]?.stored.content.body[0]?.source).toBe("Hello there.");
    expect(revisions[2]?.stored.content.body[0]?.source).toBe("Third.");
  });

  it("reads content back through the versioned reader", async () => {
    const { entry } = creation(
      await asRuntimeRole((db) => createEntry(db, articleInput())),
    );

    const revision = await asRuntimeRole((db) => getRevision(db, entry.id, 1));
    expect(revision?.stored.schema_v).toBe(1);
    expect(revision?.stored.content).toEqual({
      title: "Hello world",
      summary: "A short summary.",
      body: [{ type: "markdown", source: "Hello there." }],
    });
    expect(
      await asRuntimeRole((db) => getRevision(db, entry.id, 2)),
    ).toBeUndefined();
  });

  it("refuses a revision for an entry that is not stored", async () => {
    await expect(
      asRuntimeRole((db) =>
        appendRevision(
          db,
          "00000000-0000-0000-0000-000000000000",
          articleInput(),
        ),
      ),
    ).rejects.toBeInstanceOf(MissingEntryError);
  });

  it("returns validation errors and appends nothing for invalid content", async () => {
    const { entry } = creation(
      await asRuntimeRole((db) => createEntry(db, articleInput())),
    );

    const result = await asRuntimeRole((db) =>
      appendRevision(db, entry.id, { ...articleInput(), title: "" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors["title"]).toBeDefined();
    expect(
      await asRuntimeRole((db) => listRevisions(db, entry.id)),
    ).toHaveLength(1);
  });
});

describe("entry summaries", () => {
  it("returns nothing when there are no entries", async () => {
    expect(await asRuntimeRole((db) => listEntrySummaries(db))).toEqual([]);
  });

  it("shows the title and save time of the latest revision", async () => {
    const { entry } = creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ title: "First title" })),
      ),
    );
    await asRuntimeRole((db) =>
      appendRevision(db, entry.id, articleInput({ title: "Second title" })),
    );
    const third = appended(
      await asRuntimeRole((db) =>
        appendRevision(db, entry.id, articleInput({ title: "Third title" })),
      ),
    );

    const summaries = await asRuntimeRole((db) => listEntrySummaries(db));

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.title).toBe("Third title");
    expect(summaries[0]?.lastSavedAt).toEqual(third.createdAt);
  });

  it("carries the published pointer and the projection state of each entry", async () => {
    const live = creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ slug: "published" })),
      ),
    );
    creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ slug: "unpublished" })),
      ),
    );
    await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      await store.markPublished(
        live.entry.id,
        live.revision.id,
        new Date("2026-11-05T10:00:00.000Z"),
      );
      await store.markProjected(live.entry.id, live.revision.id);
    });

    const summaries = await asRuntimeRole((db) => listEntrySummaries(db));
    const bySlug = new Map(summaries.map((summary) => [summary.slug, summary]));

    expect(bySlug.get("published")?.publishedRevisionId).toBe(live.revision.id);
    expect(bySlug.get("published")?.projectionState).toBe("clean");
    expect(bySlug.get("unpublished")?.publishedRevisionId).toBeNull();
    expect(bySlug.get("unpublished")?.projectionState).toBe("clean");
  });

  it("orders entries by their latest save, newest first", async () => {
    const older = creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ slug: "older" })),
      ),
    );
    creation(
      await asRuntimeRole((db) =>
        createEntry(db, articleInput({ slug: "newer" })),
      ),
    );
    // Saving the first entry again makes it the newest save.
    await asRuntimeRole((db) =>
      appendRevision(
        db,
        older.entry.id,
        articleInput({ title: "Saved later" }),
      ),
    );

    const summaries = await asRuntimeRole((db) => listEntrySummaries(db));

    expect(summaries.map((summary) => summary.slug)).toEqual([
      "older",
      "newer",
    ]);
  });
});
