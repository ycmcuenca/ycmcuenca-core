import type { EntrySnapshot, IndexSnapshot } from "@ycmcuenca/cms-core";
import { describe, expect, it } from "vitest";
import { snapshotStoreFor } from "./snapshot-store";
import type { SnapshotKeyValueStore } from "./snapshot-store";

// A `Map` stands in for KV so the test sees the exact key and value of every
// write and delete (design D5).
class MapKeyValueStore implements SnapshotKeyValueStore {
  readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

const entry: EntrySnapshot = {
  snapshot_v: 1,
  type: "article",
  slug: "hello-world",
  title: "Hello, world",
  summary: "The first article.",
  blocks: [{ type: "markdown", html: "<p>Hello.</p>" }],
  publishedAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

const index: IndexSnapshot = {
  snapshot_v: 1,
  type: "article",
  locale: "en",
  items: [
    {
      slug: "hello-world",
      title: "Hello, world",
      summary: "The first article.",
      publishedAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    },
  ],
};

// Reads back a value the store wrote; a missing key fails the test loudly.
async function valueAt(kv: MapKeyValueStore, key: string): Promise<string> {
  const value = await kv.get(key);
  if (value === null) {
    throw new Error(`No value is stored at ${key}.`);
  }
  return value;
}

describe("snapshotStoreFor", () => {
  it("writes an entry snapshot as JSON under entry:<type>:<slug>", async () => {
    const kv = new MapKeyValueStore();

    await snapshotStoreFor(kv).putEntry("article", "hello-world", entry);

    expect([...kv.values.keys()]).toEqual(["entry:article:hello-world"]);
    expect(await valueAt(kv, "entry:article:hello-world")).toBe(
      JSON.stringify(entry),
    );
    expect(JSON.parse(await valueAt(kv, "entry:article:hello-world"))).toEqual(
      entry,
    );
  });

  it("deletes the entry snapshot key", async () => {
    const kv = new MapKeyValueStore();
    const store = snapshotStoreFor(kv);
    await store.putEntry("article", "hello-world", entry);

    await store.deleteEntry("article", "hello-world");

    expect(kv.values.has("entry:article:hello-world")).toBe(false);
    expect(kv.values.size).toBe(0);
  });

  it("writes an index as JSON under index:<type>:<locale>", async () => {
    const kv = new MapKeyValueStore();

    await snapshotStoreFor(kv).putIndex("article", "en", index);

    expect([...kv.values.keys()]).toEqual(["index:article:en"]);
    expect(await valueAt(kv, "index:article:en")).toBe(JSON.stringify(index));
    expect(JSON.parse(await valueAt(kv, "index:article:en"))).toEqual(index);
  });
});
