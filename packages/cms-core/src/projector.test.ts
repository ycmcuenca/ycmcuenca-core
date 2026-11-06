import { describe, expect, it } from "vitest";
import { buildEntrySnapshot, buildIndexSnapshot } from "./projector";
import type { EntryRecord, PublishedEntry, RevisionRecord } from "./ports";
import { readEntrySnapshot, readIndexSnapshot } from "./snapshot";

const firstPublished = new Date("2026-11-01T12:34:56.789Z");
const lastPublished = new Date("2026-11-05T08:00:00.000Z");

function entry(overrides: Partial<EntryRecord> = {}): EntryRecord {
  return {
    id: "entry-1",
    type: "article",
    slug: "hello-world",
    publishedRevisionId: "revision-1",
    firstPublishedAt: firstPublished,
    lastPublishedAt: lastPublished,
    projectionState: "clean",
    ...overrides,
  };
}

function storedContent(
  title = "Hello",
  summary = "A short summary.",
  source = "# Hello\n\nWorld.",
): unknown {
  return {
    schema_v: 1,
    content: {
      title,
      summary,
      body: [{ type: "markdown", source }],
    },
  };
}

function revision(stored: unknown = storedContent()): RevisionRecord {
  return {
    id: "revision-1",
    entryId: "entry-1",
    number: 1,
    stored,
  };
}

function published(
  slug: string,
  title: string,
  firstPublishedAt: Date,
  lastPublishedAt: Date = firstPublishedAt,
): PublishedEntry {
  return {
    slug,
    title,
    summary: `${title} summary.`,
    firstPublishedAt,
    lastPublishedAt,
  };
}

describe("buildEntrySnapshot", () => {
  it("renders every Markdown block to the HTML the snapshot stores", () => {
    const snapshot = buildEntrySnapshot(entry(), revision());

    expect(snapshot.blocks).toEqual([
      { type: "markdown", html: "<h1>Hello</h1>\n<p>World.</p>\n" },
    ]);
    expect(snapshot.title).toBe("Hello");
    expect(snapshot.summary).toBe("A short summary.");
  });

  it("writes the publish times as ISO 8601 UTC strings", () => {
    const snapshot = buildEntrySnapshot(entry(), revision());

    expect(snapshot.publishedAt).toBe("2026-11-01T12:34:56.789Z");
    expect(snapshot.updatedAt).toBe("2026-11-05T08:00:00.000Z");
  });

  it("returns a snapshot the reader accepts", () => {
    const snapshot = buildEntrySnapshot(entry(), revision());

    expect(readEntrySnapshot(snapshot)).toEqual(snapshot);
  });

  it("refuses stored content of a version this code does not read", () => {
    const unsupported = {
      schema_v: 2,
      content: { title: "Hello", summary: "A summary.", body: [] },
    };

    expect(() => buildEntrySnapshot(entry(), revision(unsupported))).toThrow(
      "Unsupported schema version: 2.",
    );
  });

  it("throws when the built snapshot does not match the schema", () => {
    const invalid = { ...entry(), slug: undefined } as unknown as EntryRecord;

    expect(() => buildEntrySnapshot(invalid, revision())).toThrow();
  });
});

describe("buildIndexSnapshot", () => {
  it("lists the newest first publish first", () => {
    const index = buildIndexSnapshot("article", [
      published("older", "Older", new Date("2026-11-01T09:00:00.000Z")),
      published("newer", "Newer", new Date("2026-11-02T09:00:00.000Z")),
    ]);

    expect(index.items.map((item) => item.slug)).toEqual(["newer", "older"]);
    expect(index.items[0]?.publishedAt).toBe("2026-11-02T09:00:00.000Z");
  });

  it("carries each entry's last-update date", () => {
    const index = buildIndexSnapshot("article", [
      published(
        "hello-world",
        "Hello",
        new Date("2026-11-01T09:00:00.000Z"),
        new Date("2026-11-05T09:00:00.000Z"),
      ),
    ]);

    expect(index.items[0]?.updatedAt).toBe("2026-11-05T09:00:00.000Z");
  });

  it("orders entries that share a first-publish time by slug", () => {
    const sameTime = new Date("2026-11-01T09:00:00.000Z");
    const index = buildIndexSnapshot("article", [
      published("beta", "Beta", sameTime),
      published("alpha", "Alpha", sameTime),
    ]);

    expect(index.items.map((item) => item.slug)).toEqual(["alpha", "beta"]);
  });

  it("returns an index the reader accepts", () => {
    const index = buildIndexSnapshot("article", [
      published("hello-world", "Hello", firstPublished),
    ]);

    expect(readIndexSnapshot(index)).toEqual(index);
  });

  it("throws when the built index does not match the schema", () => {
    const invalid = [
      {
        slug: "hello-world",
        title: undefined,
        summary: "A summary.",
        firstPublishedAt: firstPublished,
      },
    ] as unknown as PublishedEntry[];

    expect(() => buildIndexSnapshot("article", invalid)).toThrow();
  });
});
