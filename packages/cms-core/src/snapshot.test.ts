import { describe, expect, it } from "vitest";
import {
  entrySnapshot,
  indexSnapshot,
  readEntrySnapshot,
  readIndexSnapshot,
  snapshotVersion,
  UnsupportedSnapshotVersionError,
} from "./snapshot";

const entry = {
  snapshot_v: 1,
  type: "article",
  slug: "hello-world",
  title: "Hello world",
  summary: "A short summary.",
  blocks: [{ type: "markdown", html: "<p>Hi</p>\n" }],
  publishedAt: "2026-10-19T09:00:00.000Z",
  updatedAt: "2026-10-19T10:00:00.000Z",
};

const index = {
  snapshot_v: 1,
  type: "article",
  locale: "en",
  items: [
    {
      slug: "hello-world",
      title: "Hello world",
      summary: "A short summary.",
      publishedAt: "2026-10-19T09:00:00.000Z",
    },
    {
      slug: "second-entry",
      title: "Second entry",
      summary: "Another summary.",
      publishedAt: "2026-10-19T10:00:00.000Z",
    },
  ],
};

// What a snapshot looks like after a write to KV and a read back out of it.
function storedInKv(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe("snapshotVersion", () => {
  it("is the version the spec states", () => {
    expect(snapshotVersion).toBe(1);
  });
});

describe("readEntrySnapshot", () => {
  it("reads back an entry snapshot that travelled through KV", () => {
    expect(entrySnapshot.safeParse(entry).success).toBe(true);
    expect(readEntrySnapshot(storedInKv(entry))).toEqual(entry);
  });

  it("ignores a field it does not know", () => {
    expect(readEntrySnapshot({ ...entry, reading_time: 3 })).toEqual(entry);
  });

  it("refuses snapshot version 2, naming it", () => {
    const read = () => readEntrySnapshot({ ...entry, snapshot_v: 2 });

    expect(read).toThrow(UnsupportedSnapshotVersionError);
    expect(read).toThrow("Unsupported snapshot version: 2.");
  });

  it("refuses a value with no snapshot version, naming it missing", () => {
    const stored = storedInKv(entry);
    delete stored.snapshot_v;

    expect(() => readEntrySnapshot(stored)).toThrow(
      "Unsupported snapshot version: missing.",
    );
  });

  it("refuses a stored snapshot with no title, naming the title", () => {
    const stored = storedInKv(entry);
    delete stored.title;

    expect(() => readEntrySnapshot(stored)).toThrow(/title/);
  });
});

describe("readIndexSnapshot", () => {
  it("reads back an index snapshot with both items in order", () => {
    expect(indexSnapshot.safeParse(index).success).toBe(true);
    expect(readIndexSnapshot(storedInKv(index))).toEqual(index);
  });

  it("refuses snapshot version 2, naming it", () => {
    expect(() => readIndexSnapshot({ ...index, snapshot_v: 2 })).toThrow(
      "Unsupported snapshot version: 2.",
    );
  });
});
