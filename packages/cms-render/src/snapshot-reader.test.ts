import { entryKey, indexKey } from "@ycmcuenca/cms-core";
import { describe, expect, it } from "vitest";
import { readArticle, readArticleIndex } from "./snapshot-reader.ts";
import type {
  SnapshotKeyValueStore,
  SnapshotLogger,
} from "./snapshot-reader.ts";

const article = {
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
  ],
};

/** A KV stand-in, so the reader is tested without Cloudflare (design D2). */
class MemoryStore implements SnapshotKeyValueStore {
  private readonly values = new Map<string, unknown>();

  put(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }
}

/** One entry per error line, so a test can count and inspect them. */
class CapturingLogger implements SnapshotLogger {
  readonly lines: { message: string; fields?: Record<string, unknown> }[] = [];

  error(message: string, fields?: Record<string, unknown>): void {
    this.lines.push({ message, fields });
  }
}

describe("readArticle", () => {
  it("reads a valid snapshot back", async () => {
    const store = new MemoryStore();
    store.put(entryKey("article", "hello-world"), article);
    const log = new CapturingLogger();

    await expect(readArticle(store, "hello-world", log)).resolves.toEqual(
      article,
    );
    expect(log.lines).toEqual([]);
  });

  it("stays silent when the key is missing", async () => {
    const log = new CapturingLogger();

    await expect(
      readArticle(new MemoryStore(), "does-not-exist", log),
    ).resolves.toBeUndefined();
    expect(log.lines).toEqual([]);
  });

  it("returns undefined and logs once for snapshot version 2", async () => {
    const store = new MemoryStore();
    store.put(entryKey("article", "hello-world"), {
      ...article,
      snapshot_v: 2,
    });
    const log = new CapturingLogger();

    await expect(
      readArticle(store, "hello-world", log),
    ).resolves.toBeUndefined();

    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]?.message).toBe("unreadable snapshot");
    expect(log.lines[0]?.fields?.key).toBe(entryKey("article", "hello-world"));
    expect(log.lines[0]?.fields?.problem).toContain("version: 2");
  });

  it("returns undefined and logs once for a snapshot without a title", async () => {
    const withoutTitle: Record<string, unknown> = { ...article };
    delete withoutTitle.title;
    const store = new MemoryStore();
    store.put(entryKey("article", "hello-world"), withoutTitle);
    const log = new CapturingLogger();

    await expect(
      readArticle(store, "hello-world", log),
    ).resolves.toBeUndefined();

    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]?.fields?.key).toBe(entryKey("article", "hello-world"));
    expect(log.lines[0]?.fields?.problem).toMatch(/title/);
  });

  it("lets an unavailable store fail loudly", async () => {
    const store: SnapshotKeyValueStore = {
      get: async () => {
        throw new Error("KV unavailable");
      },
    };

    await expect(
      readArticle(store, "hello-world", new CapturingLogger()),
    ).rejects.toThrow("KV unavailable");
  });
});

describe("readArticleIndex", () => {
  it("reads a valid index back", async () => {
    const store = new MemoryStore();
    store.put(indexKey("article", "en"), index);
    const log = new CapturingLogger();

    await expect(readArticleIndex(store, log)).resolves.toEqual(index);
    expect(log.lines).toEqual([]);
  });

  it("stays silent when the index is missing", async () => {
    const log = new CapturingLogger();

    await expect(
      readArticleIndex(new MemoryStore(), log),
    ).resolves.toBeUndefined();
    expect(log.lines).toEqual([]);
  });

  it("returns undefined and logs once for a broken index", async () => {
    const store = new MemoryStore();
    store.put(indexKey("article", "en"), { ...index, items: "not a list" });
    const log = new CapturingLogger();

    await expect(readArticleIndex(store, log)).resolves.toBeUndefined();

    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]?.message).toBe("unreadable snapshot");
    expect(log.lines[0]?.fields?.key).toBe(indexKey("article", "en"));
    expect(log.lines[0]?.fields?.problem).toMatch(/items/);
  });
});
