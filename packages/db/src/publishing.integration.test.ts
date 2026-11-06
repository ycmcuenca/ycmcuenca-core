// The EntryStore adapter against a real Postgres, exercised as the runtime
// role (design D1, D2 and D4 in `revisions-publishing`). The cases check what
// only the database can prove: the pointer, both publish times and the dirty
// mark move in one write, the index joins the published revision, and the
// slug guard refuses a published entry.
import { beforeEach, describe, expect, it } from "vitest";
import {
  appendRevision,
  createEntry,
  MissingEntryError,
  PublishedSlugError,
  updateSlug,
} from "./index.ts";
import { entryStoreFor } from "./publishing.ts";
import {
  articleInput,
  asRuntimeRole,
  truncateEntries,
} from "./test-helpers.ts";

beforeEach(truncateEntries);

const firstPublish = new Date("2026-11-01T10:00:00.000Z");
const secondPublish = new Date("2026-11-05T10:00:00.000Z");

/** Creates an article and returns its entry and first revision ids. */
async function createArticle(
  slug: string,
  title: string,
): Promise<{ entryId: string; revisionId: string }> {
  const created = await asRuntimeRole((db) =>
    createEntry(db, articleInput({ slug, title })),
  );
  if (!created.ok) {
    throw new Error(`expected creation to succeed: ${JSON.stringify(created)}`);
  }
  return { entryId: created.entry.id, revisionId: created.revision.id };
}

/** Appends a revision and returns its id. */
async function appendArticle(
  entryId: string,
  title: string,
  summary: string,
): Promise<string> {
  const appended = await asRuntimeRole((db) =>
    appendRevision(db, entryId, articleInput({ title, summary })),
  );
  if (!appended.ok) {
    throw new Error(
      `expected the append to succeed: ${JSON.stringify(appended)}`,
    );
  }
  return appended.revision.id;
}

describe("the entry store", () => {
  it("finds nothing for an unknown entry or revision", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    const found = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      return {
        entry: await store.findEntry(missing),
        revision: await store.getRevision(missing),
      };
    });
    expect(found.entry).toBeUndefined();
    expect(found.revision).toBeUndefined();
  });

  it("moves the pointer, both publish times and the dirty mark in one write", async () => {
    const { entryId, revisionId } = await createArticle(
      "hello-world",
      "Hello world",
    );
    const newerRevisionId = await appendArticle(
      entryId,
      "Hello again",
      "A newer summary.",
    );

    const states = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      await store.markPublished(entryId, newerRevisionId, firstPublish);
      const afterFirst = await store.findEntry(entryId);
      await store.markPublished(entryId, revisionId, secondPublish);
      const afterSecond = await store.findEntry(entryId);
      return { afterFirst, afterSecond };
    });

    // One call moved the pointer and the mark together; nothing was left
    // clean while the pointer had moved.
    expect(states.afterFirst).toMatchObject({
      publishedRevisionId: newerRevisionId,
      firstPublishedAt: firstPublish,
      lastPublishedAt: firstPublish,
      projectionState: "dirty",
    });
    // A second publish keeps the first publish time and moves the last one.
    expect(states.afterSecond).toMatchObject({
      publishedRevisionId: revisionId,
      firstPublishedAt: firstPublish,
      lastPublishedAt: secondPublish,
      projectionState: "dirty",
    });
  });

  it("clears the dirty mark only after a projection", async () => {
    const { entryId, revisionId } = await createArticle(
      "hello-world",
      "Hello world",
    );

    const states = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      await store.markPublished(entryId, revisionId, firstPublish);
      const dirty = await store.findEntry(entryId);
      await store.markProjected(entryId, revisionId);
      const clean = await store.findEntry(entryId);
      return { dirty, clean };
    });

    expect(states.dirty?.projectionState).toBe("dirty");
    expect(states.clean).toMatchObject({
      publishedRevisionId: revisionId,
      projectionState: "clean",
    });
  });

  it("keeps the dirty mark when the pointer moved to another revision", async () => {
    const { entryId, revisionId } = await createArticle(
      "hello-world",
      "Hello world",
    );
    const newerRevisionId = await appendArticle(
      entryId,
      "Hello again",
      "A newer summary.",
    );

    const states = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      await store.markPublished(entryId, revisionId, firstPublish);
      await store.markPublished(entryId, newerRevisionId, secondPublish);
      // A slower projection of `revisionId` finishes after the pointer moved,
      // so it must not mark the entry clean.
      await store.markProjected(entryId, revisionId);
      const afterStale = await store.findEntry(entryId);
      await store.markProjected(entryId, newerRevisionId);
      const afterCurrent = await store.findEntry(entryId);
      return { afterStale, afterCurrent };
    });

    expect(states.afterStale).toMatchObject({
      publishedRevisionId: newerRevisionId,
      projectionState: "dirty",
    });
    expect(states.afterCurrent).toMatchObject({
      publishedRevisionId: newerRevisionId,
      projectionState: "clean",
    });
  });

  it("unpublishes in one write, keeping both publish times", async () => {
    const { entryId, revisionId } = await createArticle(
      "hello-world",
      "Hello world",
    );

    const entry = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      await store.markPublished(entryId, revisionId, firstPublish);
      await store.markPublished(entryId, revisionId, secondPublish);
      await store.markProjected(entryId, revisionId);
      await store.markUnpublished(entryId);
      return store.findEntry(entryId);
    });

    expect(entry).toMatchObject({
      publishedRevisionId: null,
      firstPublishedAt: firstPublish,
      lastPublishedAt: secondPublish,
      projectionState: "dirty",
    });
  });

  it("refuses a write that names no entry", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    const error = await asRuntimeRole(async (db) =>
      entryStoreFor(db).markPublished(
        missing,
        "00000000-0000-0000-0000-000000000001",
        firstPublish,
      ),
    ).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(MissingEntryError);
  });

  it("lists published entries with their published revision's title and summary", async () => {
    const older = await createArticle("a", "A first version");
    await appendArticle(older.entryId, "A newer version", "Not published.");
    const newer = await createArticle("b", "B published");
    // `c` is created but never published, so it stays out of the index.
    await createArticle("c", "C unpublished");

    const listed = await asRuntimeRole(async (db) => {
      const store = entryStoreFor(db);
      // Publish revision 1 of `a`, not the newer revision 2.
      await store.markPublished(older.entryId, older.revisionId, firstPublish);
      await store.markPublished(newer.entryId, newer.revisionId, secondPublish);
      return store.listPublished("article");
    });

    expect(listed).toEqual([
      {
        slug: "b",
        title: "B published",
        summary: "A short summary.",
        firstPublishedAt: secondPublish,
      },
      {
        slug: "a",
        title: "A first version",
        summary: "A short summary.",
        firstPublishedAt: firstPublish,
      },
    ]);
  });
});

describe("the slug guard", () => {
  it("moves a slug before the first publish", async () => {
    const { entryId } = await createArticle("hello-world", "Hello world");

    const result = await asRuntimeRole((db) =>
      updateSlug(db, entryId, "still-draft"),
    );

    expect(result.ok).toBe(true);
  });

  it("refuses a slug move after a publish, through the repository and the port", async () => {
    const { entryId, revisionId } = await createArticle(
      "hello-world",
      "Hello world",
    );
    await asRuntimeRole(async (db) => {
      await entryStoreFor(db).markPublished(entryId, revisionId, firstPublish);
    });

    const repositoryError = await asRuntimeRole((db) =>
      updateSlug(db, entryId, "published-address"),
    ).catch((reason: unknown) => reason);
    expect(repositoryError).toBeInstanceOf(PublishedSlugError);

    const portRefusal = await asRuntimeRole((db) =>
      entryStoreFor(db).updateSlug(entryId, "published-address"),
    );
    expect(portRefusal).toEqual({
      ok: false,
      reason: "Published slugs cannot change.",
    });

    // The address did not move.
    const entry = await asRuntimeRole((db) =>
      entryStoreFor(db).findEntry(entryId),
    );
    expect(entry?.slug).toBe("hello-world");
  });
});
