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
import { appendRevision, connectDatabase, createEntry } from "@ycmcuenca/db";
import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { signedAccessToken } from "./access-token";

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

// Seeds the entry and its second revision through @ycmcuenca/db (design D7),
// the same functions the app and the integration tests use.
async function seedEntry(): Promise<string> {
  let createdId = "";
  await connectDatabase(databaseUrl(), async (database) => {
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
    createdId = created.entry.id;
  });
  return createdId;
}

async function truncateEntries(): Promise<void> {
  await connectDatabase(databaseUrl(), (database) =>
    database.execute(sql`TRUNCATE revisions, entries CASCADE`),
  );
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL is not set; turbo.jsonc passes it through to test:e2e.",
    );
  }
  return url;
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

// Reads a key from the local KV `wrangler dev` serves (design D7). Both
// commands default to `apps/admin/.wrangler/state`, so the CLI sees the
// server's writes without a shared `--persist-to` (task 4.2).
function kvValue(key: string): unknown {
  const result = spawnSync(
    "bunx",
    ["wrangler", "kv", "key", "get", "--local", "--binding", "SNAPSHOTS", key],
    { cwd: adminDirectory, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Reading ${key} failed: ${result.stderr}`);
  }
  const value = result.stdout.trim();
  return value === "Value not found" ? undefined : JSON.parse(value);
}
