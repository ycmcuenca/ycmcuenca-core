// The publishing flow end to end (design D7): seed an entry with two
// revisions, publish, roll back and unpublish through the entry page, and
// read the resulting snapshots from the same local KV `wrangler dev` uses.
// The test writes the database through `DATABASE_URL` and reads KV through
// the Wrangler CLI, so it proves what a deploy would leave behind, not what a
// fake or an in-process call would.
import {
  entryKey,
  indexKey,
  readEntrySnapshot,
  readIndexSnapshot,
} from "@ycmcuenca/cms-core";
import type { EntrySnapshot, IndexSnapshot } from "@ycmcuenca/cms-core";
import { appendRevision, createEntry } from "@ycmcuenca/db";
import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { signedAccessToken } from "./access-token";
import { truncateEntries, withTestDatabase } from "./database";
import { stateDirectory } from "./environment";

const entryType = "article";
const locale = "en";
const slug = "publishing-e2e";
const adminDirectory = fileURLToPath(new URL("..", import.meta.url));

const firstRevision = {
  slug,
  title: "First title",
  summary: "The first summary.",
  body: [{ type: "markdown" as const, source: "First body." }],
};
const secondRevision = {
  slug,
  title: "Second title",
  summary: "The second summary.",
  body: [{ type: "markdown" as const, source: "Second body." }],
};

let entryId = "";

// The database and KV are shared with the smoke test, which expects empty
// tables: every attempt starts from a clean database and the run ends clean
// (playwright.config.ts sets `workers: 1`).
test.beforeEach(async () => {
  await truncateEntries();
  entryId = await seedEntry();
});

test.afterAll(async () => {
  await truncateEntries();
});

test("publish writes the snapshot, rollback replaces it, unpublish removes it", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "cf-access-jwt-assertion": await signedAccessToken(),
  });
  await page.goto(`/entries/${entryId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(slug);
  await expect(page.getByText("Not published")).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 2")).toBeVisible();
  expect(readEntry()).toMatchObject({
    slug,
    title: secondRevision.title,
    summary: secondRevision.summary,
  });
  expect(readIndex()).toMatchObject({
    items: [
      { slug, title: secondRevision.title, summary: secondRevision.summary },
    ],
  });

  await page.getByRole("button", { name: "Roll back to this" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();
  expect(readEntry()).toMatchObject({
    slug,
    title: firstRevision.title,
    summary: firstRevision.summary,
  });
  expect(readIndex()).toMatchObject({
    items: [
      { slug, title: firstRevision.title, summary: firstRevision.summary },
    ],
  });

  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Not published")).toBeVisible();
  expect(kvValue(entryKey(entryType, slug))).toBeUndefined();
  expect(readIndex()?.items).toEqual([]);
});

test("a dirty entry shows published, not live, and retry makes it live", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "cf-access-jwt-assertion": await signedAccessToken(),
  });
  await page.goto(`/entries/${entryId}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 2")).toBeVisible();

  await markDirty(entryId);
  await page.reload();
  await expect(page.getByText("Published, not live")).toBeVisible();
  expect(readEntry()).toMatchObject({ title: secondRevision.title });

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Live: revision 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
});

// Seeds the entry and its second revision through @ycmcuenca/db (design D7),
// the same functions the app and the integration tests use.
async function seedEntry(): Promise<string> {
  return withTestDatabase(async (database) => {
    const created = await createEntry(database, firstRevision);
    if (!created.ok) {
      throw new Error(`Seeding failed: ${JSON.stringify(created.errors)}`);
    }
    const appended = await appendRevision(
      database,
      created.entry.id,
      secondRevision,
    );
    if (!appended.ok) {
      throw new Error(`Appending failed: ${JSON.stringify(appended.errors)}`);
    }
    return created.entry.id;
  });
}

// Sets the mark a failed projection leaves behind (design D2). The e2e writes
// it directly, because the local KV accepts every write and the scenario needs
// the state, not a broken store.
async function markDirty(entryId: string): Promise<void> {
  await withTestDatabase((database) =>
    database.execute(
      sql`UPDATE entries SET projection_state = 'dirty' WHERE id = ${entryId}`,
    ),
  );
}

function readEntry(): EntrySnapshot | undefined {
  return readSnapshot(entryKey(entryType, slug), readEntrySnapshot);
}

function readIndex(): IndexSnapshot | undefined {
  return readSnapshot(indexKey(entryType, locale), readIndexSnapshot);
}

function readSnapshot<T>(
  key: string,
  read: (value: unknown) => T,
): T | undefined {
  const value = kvValue(key);
  return value === undefined ? undefined : read(value);
}

// Reads a key from the local KV `wrangler dev` serves (design D7). Both the
// command and the server use the e2e state directory (design D5 in
// openspec/changes/public-rendering/design.md), so the CLI sees the server's
// writes and the `welcome` server of the publish-path test reads the same keys.
function kvValue(key: string): unknown {
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "kv",
      "key",
      "get",
      "--local",
      "--persist-to",
      stateDirectory,
      "--binding",
      "SNAPSHOTS",
      key,
    ],
    { cwd: adminDirectory, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Reading ${key} failed: ${result.stderr}`);
  }
  const value = result.stdout.trim();
  return value === "Value not found" ? undefined : JSON.parse(value);
}
