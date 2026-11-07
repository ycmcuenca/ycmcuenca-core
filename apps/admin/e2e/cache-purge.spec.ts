// The purge that follows a publish (design D7 in
// openspec/changes/edge-cache/design.md): seed an entry, publish it through
// `admin`'s real form action, read the article on `welcome`'s built worker,
// then read `admin`'s own console output. The purge cannot succeed locally
// (design D7), so the one warning it logs proves the purger ran and the
// publish still succeeded; the real purge belongs to the owner's production
// check. Both `wrangler dev` processes serve the same local KV state, as in the
// publish-path test.
import { entryTag, indexTag } from "@ycmcuenca/cms-core";
import { createEntry } from "@ycmcuenca/db";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, statSync } from "node:fs";
import { signedAccessToken } from "./access-token";
import { truncateEntries, withTestDatabase } from "./database";
import { adminOutputLog, welcomeOrigin } from "./environment";

const entryType = "article";
const slug = "cache-purge-e2e";
const title = "The purged article";
const body = "The purged body applies.";
const articleUrl = `${welcomeOrigin}/en/articles/${slug}`;

/** The fields of the one warning a failed purge writes (design D4). */
interface PurgeWarning {
  readonly msg: string;
  readonly tags: readonly string[];
  readonly reason: string;
}

let entryId = "";

// The database and the local KV are shared with the other specs, which expect
// both empty where they say so: every attempt starts clean and ends clean
// (playwright.config.ts sets `workers: 1`).
test.beforeEach(async () => {
  await truncateEntries();
  entryId = await seedEntry();
});

test.afterAll(async () => {
  await truncateEntries();
});

test("a published article is live and logs one cache purge warning", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/entries/${entryId}`);

  // Only the output written after this point belongs to this publish.
  const outputStart = outputSize();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();

  // `welcome` is a separate process reading the same store, so give the write
  // the time the design allows (design D5 in
  // openspec/changes/public-rendering/design.md) before asserting the page.
  await expect
    .poll(async () => (await page.request.get(articleUrl)).status())
    .toBe(200);
  await page.goto(articleUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText(body)).toBeVisible();

  // `wrangler dev` forwards the worker's console through a pipe, so the line
  // can arrive just after the publish's response.
  await expect
    .poll(() => purgeWarningsSince(outputStart).length, {
      message: "admin logs one cache purge warning per publish",
    })
    .toBe(1);
  const warnings = purgeWarningsSince(outputStart);
  expect(warnings).toHaveLength(1);
  const [warning] = warnings;
  expect(warning?.tags).toEqual([
    entryTag(entryType, slug),
    indexTag(entryType, "en"),
  ]);
  // The reason belongs to Wrangler (design D7): only its presence is asserted.
  expect(warning?.reason.trim()).not.toBe("");
});

// Seeds the entry and its only revision through @ycmcuenca/db, so publishing
// reaches the same shape the app writes.
async function seedEntry(): Promise<string> {
  return withTestDatabase(async (database) => {
    const created = await createEntry(database, {
      slug,
      title,
      summary: "The purged summary.",
      body: [{ type: "markdown" as const, source: body }],
    });
    if (!created.ok) {
      throw new Error(`Seeding failed: ${JSON.stringify(created.errors)}`);
    }
    return created.entry.id;
  });
}

// The guard verifies a token the fixture's key signs (design D7).
async function signIn(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    "cf-access-jwt-assertion": await signedAccessToken(),
  });
}

// The size of admin's output before the publish, in bytes: reads start here,
// so a reused server's earlier lines cannot answer for this publish.
function outputSize(): number {
  try {
    return statSync(adminOutputLog).size;
  } catch {
    return 0;
  }
}

// The purge warnings admin wrote since `start` (design D7). Each is the JSON
// line `@ycmcuenca/edge`'s logger writes (design D9); a line that names the
// warning but is not JSON fails the read, never the assertion silently.
function purgeWarningsSince(start: number): PurgeWarning[] {
  return outputSince(start)
    .split("\n")
    .filter((line) => line.includes("cache purge failed"))
    .map((line) => JSON.parse(line.slice(line.indexOf("{"))) as PurgeWarning);
}

function outputSince(start: number): string {
  try {
    return readFileSync(adminOutputLog).subarray(start).toString("utf8");
  } catch (error) {
    throw new Error(
      `admin's output is unreadable at ${adminOutputLog}; ` +
        "playwright.config.ts sends it there with `tee`.",
      { cause: error },
    );
  }
}
