// The publish path across both apps (design D5 in
// openspec/changes/public-rendering/design.md): seed an entry, publish it
// through `admin`'s real form action, read the article on `welcome`'s built
// worker, then unpublish it and watch it disappear. Both `wrangler dev`
// processes serve the same local KV state, so this proves what a deploy leaves
// behind for a visitor, not what a fake would.
import { createEntry } from "@ycmcuenca/db";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signedAccessToken } from "./access-token";
import { truncateEntries, withTestDatabase } from "./database";
import { welcomeOrigin } from "./environment";

const slug = "publish-path-e2e";
const title = "The published article";
const body = "The published body applies.";
const articleUrl = `${welcomeOrigin}/en/articles/${slug}`;

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

test("a published article appears on welcome and disappears when unpublished", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/entries/${entryId}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();

  // `welcome` is a separate process reading the same store, so give the write
  // the time the design allows (D5) before asserting the page.
  await expect
    .poll(async () => (await page.request.get(articleUrl)).status())
    .toBe(200);
  await page.goto(articleUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText(body)).toBeVisible();

  await page.goto(welcomeOrigin);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.goto(`/entries/${entryId}`);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Not published")).toBeVisible();

  await expect
    .poll(async () => (await page.request.get(articleUrl)).status())
    .toBe(404);
  await page.goto(welcomeOrigin);
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});

// Seeds the entry and its only revision through @ycmcuenca/db, so publishing
// reaches the same shape the app writes.
async function seedEntry(): Promise<string> {
  return withTestDatabase(async (database) => {
    const created = await createEntry(database, {
      slug,
      title,
      summary: "The published summary.",
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
