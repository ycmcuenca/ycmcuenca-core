// The editing flow end to end (design D2, D3, D5): create an article, edit it,
// preview the unsaved body and move its slug while it has never been published.
// Every test also proves that the page it loads stays inside the existing
// Content Security Policy, including the preview (assumption A2).
//
// The tests write entries through @ycmcuenca/db, the functions the app itself
// uses, and drive the built worker through `wrangler dev` (design D7), so they
// prove what a deploy would do, not what a fake would.
import {
  appendRevision,
  countEntries,
  createEntry,
  entryStoreFor,
  listRevisions,
} from "@ycmcuenca/db";
import type { Revision } from "@ycmcuenca/db";
import { collectedViolations, trackViolations } from "@ycmcuenca/edge/testing";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { signedAccessToken } from "./access-token";
import { truncateEntries, withTestDatabase } from "./database";

/** An article as this spec writes it: the body is the form's one block. */
interface Article {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

/** The port `playwright.config.ts` serves admin on (A4). */
const adminOrigin = "http://127.0.0.1:8788";

const firstRevision: Article = {
  slug: "first-post",
  title: "First title",
  summary: "The first summary.",
  body: "First body.",
};
const secondRevision: Article = {
  slug: "first-post",
  title: "Second title",
  summary: "The second summary.",
  body: "Second body.",
};

/** The signed Access header every request sends (design D7). */
let accessHeaders: Record<string, string> = {};

// The database and the local KV are shared with the other specs, which expect
// both empty where they say so: every attempt starts clean and ends clean
// (playwright.config.ts sets `workers: 1`). Violation tracking starts before
// the test's first navigation.
test.beforeEach(async ({ page }) => {
  await trackViolations(page);
  await truncateEntries();
  accessHeaders = { "cf-access-jwt-assertion": await signedAccessToken() };
});

test.afterAll(async () => {
  await truncateEntries();
});

test("create stores revision 1 and opens the entry page", async ({ page }) => {
  await open(page, "/entries/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "New article",
  );

  await fillForm(page, firstRevision);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/entries\/[0-9a-f-]{36}$/);
  const entryId = entryIdFrom(page.url());

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    firstRevision.slug,
  );
  await expect(page.getByText("Not published")).toBeVisible();
  await expect(page.getByText("Revision 1: First title")).toBeVisible();

  const revisions = await revisionsOf(entryId);
  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.stored.content).toMatchObject({
    title: firstRevision.title,
    summary: firstRevision.summary,
    body: [{ type: "markdown", source: firstRevision.body }],
  });

  await expectNoViolations(page);
});

test("a taken slug on create keeps the form and refuses the write", async ({
  page,
}) => {
  await seedArticle([firstRevision]);
  await open(page, "/entries/new");

  await fillForm(page, { ...firstRevision, title: "Another title" });
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/entries\/new$/);
  await expect(page.locator("#slug-error")).toContainText(
    `already uses the slug "${firstRevision.slug}"`,
  );
  await expect(page.getByLabel("Slug")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Slug")).toHaveValue(firstRevision.slug);
  await expect(page.getByLabel("Title")).toHaveValue("Another title");
  expect(await entryCount()).toBe(1);

  await expectNoViolations(page);
});

test("save appends revision 3 and leaves revisions 1 and 2 unchanged", async ({
  page,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Summary").fill("The third summary.");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Revision 3: Second title")).toBeVisible();
  await expect(page.getByText("Revision 1: First title")).toBeVisible();
  await expect(page.getByText("Revision 2: Second title")).toBeVisible();

  const revisions = await revisionsOf(entryId);
  expect(revisions).toHaveLength(3);
  expect(revisions[2]?.stored.content.summary).toBe("The third summary.");
  expect(revisions[0]?.stored.content).toMatchObject({
    title: firstRevision.title,
    summary: firstRevision.summary,
  });
  expect(revisions[1]?.stored.content).toMatchObject({
    title: secondRevision.title,
    summary: secondRevision.summary,
  });

  await expectNoViolations(page);
});

test("save without changes says so and adds no revision", async ({ page }) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  await open(page, `/entries/${entryId}`);

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("No changes to save.")).toBeVisible();
  expect(await revisionsOf(entryId)).toHaveLength(2);

  await expectNoViolations(page);
});

test("two saves at once add one revision and refuse the other", async ({
  page,
  request,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  // Warm the guard's key-set cache and the page's scripts first, so both
  // submissions reach the database together instead of one behind the other.
  await open(page, `/entries/${entryId}`);
  const raced = {
    title: "Raced title",
    slug: secondRevision.slug,
    summary: "The raced summary.",
    body: "The raced body.",
  };

  const [first, second] = await Promise.all([
    postSave(request, entryId, raced),
    postSave(request, entryId, raced),
  ]);
  const statuses = [first.status(), second.status()].sort(
    (left, right) => left - right,
  );
  expect(statuses).toEqual([200, 409]);

  const refused = first.status() === 409 ? first : second;
  expect(await refused.text()).toContain(
    "Another save came first. Reload and try again.",
  );

  const revisions = await revisionsOf(entryId);
  expect(revisions).toHaveLength(3);
  expect(revisions[2]?.stored.content.title).toBe("Raced title");

  // The entry page still loads: the refused save was a 409, not a server error.
  await open(page, `/entries/${entryId}`);
  await expect(page.getByText("Revision 3: Raced title")).toBeVisible();

  await expectNoViolations(page);
});

test("two invalid fields keep their messages and every entered value", async ({
  page,
}) => {
  await open(page, "/entries/new");

  await page.getByLabel("Slug").fill("Bad Slug");
  await page.getByLabel("Summary").fill("The kept summary.");
  await page.getByLabel("Body").fill("The kept body.");
  await allowInvalidSubmission(page);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("#title-error")).toHaveText("Enter the title.");
  await expect(page.locator("#slug-error")).toHaveText(
    "Use lowercase letters, digits and single hyphens, with no hyphen at either end.",
  );
  await expect(page.getByLabel("Title")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Title")).toHaveAttribute(
    "aria-describedby",
    "title-error",
  );
  await expect(page.getByLabel("Slug")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Slug")).toHaveAttribute(
    "aria-describedby",
    "slug-error",
  );
  await expect(page.getByLabel("Slug")).toHaveValue("Bad Slug");
  await expect(page.getByLabel("Summary")).toHaveValue("The kept summary.");
  await expect(page.getByLabel("Body")).toHaveValue("The kept body.");
  expect(await entryCount()).toBe(0);

  await expectNoViolations(page);
});

test("preview renders the unsaved body and adds no revision", async ({
  page,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  const previewBody = "# Hello\n\n- one\n- two";
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Body").fill(previewBody);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(
    page.getByRole("heading", { name: "Hello", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("one", { exact: true })).toBeVisible();
  await expect(page.getByText("two", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Body")).toHaveValue(previewBody);
  await expect(page.getByText(/^Revision 3:/)).toHaveCount(0);
  expect(await revisionsOf(entryId)).toHaveLength(2);

  await expectNoViolations(page);
});

test("preview shows a script escaped and runs nothing", async ({ page }) => {
  const entryId = await seedArticle([firstRevision]);
  let openedDialog = false;
  page.on("dialog", async (dialog) => {
    openedDialog = true;
    await dialog.dismiss();
  });
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Body").fill("<script>alert(1)</script>");
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(
    page.getByText("<script>alert(1)</script>", { exact: true }),
  ).toBeVisible();
  expect(openedDialog).toBe(false);

  await expectNoViolations(page);
});

test("a previewed table keeps its alignment classes", async ({ page }) => {
  const entryId = await seedArticle([firstRevision]);
  const table = [
    "| Left | Center | Right |",
    "| :--- | :----: | ----: |",
    "| a    | b      | c     |",
  ].join("\n");
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Body").fill(table);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.locator("table th.align-left")).toHaveCount(1);
  await expect(page.locator("table th.align-center")).toHaveCount(1);
  await expect(page.locator("table th.align-right")).toHaveCount(1);
  await expect(page.locator("table td.align-left")).toHaveCount(1);
  await expect(page.locator("table td.align-center")).toHaveCount(1);
  await expect(page.locator("table td.align-right")).toHaveCount(1);

  await expectNoViolations(page);
});

test("a never-published entry's slug is editable and saves", async ({
  page,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  await open(page, `/entries/${entryId}`);

  await expect(page.getByLabel("Slug")).toBeEditable();
  await expect(page.getByText("Published slugs cannot change.")).toHaveCount(0);
  await page.getByLabel("Slug").fill("renamed-post");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "renamed-post",
  );
  expect((await entryOf(entryId))?.slug).toBe("renamed-post");

  await expectNoViolations(page);
});

test("a slug-only change adds no revision and is not 'no changes'", async ({
  page,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Slug").fill("only-the-slug");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "only-the-slug",
  );
  await expect(page.getByText("No changes to save.")).toHaveCount(0);
  await expect(page.getByText("Revision 1: First title")).toBeVisible();
  await expect(page.getByText("Revision 2: Second title")).toBeVisible();
  expect(await revisionsOf(entryId)).toHaveLength(2);

  await expectNoViolations(page);
});

test("changing a slug to a taken one keeps the stored slug", async ({
  page,
}) => {
  const entryId = await seedArticle([firstRevision, secondRevision]);
  await seedArticle([
    { ...firstRevision, slug: "taken-post", title: "The other article" },
  ]);
  await open(page, `/entries/${entryId}`);

  await page.getByLabel("Slug").fill("taken-post");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.locator("#slug-error")).toContainText(
    `already uses the slug "taken-post"`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    firstRevision.slug,
  );
  expect((await entryOf(entryId))?.slug).toBe(firstRevision.slug);
  expect(await revisionsOf(entryId)).toHaveLength(2);

  await expectNoViolations(page);
});

test("a published entry's slug is read-only and a submitted slug is ignored", async ({
  page,
  request,
}) => {
  const entryId = await seedArticle([firstRevision]);
  await open(page, `/entries/${entryId}`);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();
  await expect(page.getByLabel("Slug")).not.toBeEditable();
  await expect(page.getByText("Published slugs cannot change.")).toBeVisible();

  const saved = await postSave(request, entryId, {
    title: firstRevision.title,
    slug: "ignored-slug",
    summary: "The summary after publish.",
    body: firstRevision.body,
  });
  expect(saved.status()).toBe(200);

  expect((await entryOf(entryId))?.slug).toBe(firstRevision.slug);
  const revisions = await revisionsOf(entryId);
  expect(revisions).toHaveLength(2);
  expect(revisions[1]?.stored.content.summary).toBe(
    "The summary after publish.",
  );

  await expectNoViolations(page);
});

test("the list shows live, not published and published, not live", async ({
  page,
}) => {
  const liveId = await seedArticle([
    { ...firstRevision, slug: "live-article", title: "The live article" },
  ]);
  const unpublishedId = await seedArticle([
    {
      ...firstRevision,
      slug: "unpublished-article",
      title: "The unpublished article",
    },
  ]);
  const dirtyId = await seedArticle([
    { ...firstRevision, slug: "dirty-article", title: "The dirty article" },
  ]);

  await open(page, `/entries/${liveId}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();

  await open(page, `/entries/${dirtyId}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live: revision 1")).toBeVisible();
  await markDirty(dirtyId);

  await open(page, "/");
  await expect(page.getByText("3 entries")).toBeVisible();
  await expect(
    rowFor(page, "The live article").getByText("Live", { exact: true }),
  ).toBeVisible();
  await expect(
    rowFor(page, "The unpublished article").getByText("Not published", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    rowFor(page, "The dirty article").getByText("Published, not live", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "The live article" }),
  ).toHaveAttribute("href", `/entries/${liveId}`);
  await expect(
    page.getByRole("link", { name: "The unpublished article" }),
  ).toHaveAttribute("href", `/entries/${unpublishedId}`);

  await expectNoViolations(page);
});

// Opens a page as the signed-in owner and waits for hydration, after which
// every policy violation the page causes has been reported.
async function open(page: Page, path: string): Promise<void> {
  await page.setExtraHTTPHeaders(accessHeaders);
  await page.goto(path);
  await expect(page.locator("#svelte-announcer")).toBeAttached();
}

// The announcer element only mounts once SvelteKit's client has hydrated, so
// by the time it is attached the page has parsed its scripts and styles.
async function expectNoViolations(page: Page): Promise<void> {
  await expect(page.locator("#svelte-announcer")).toBeAttached();
  expect(await collectedViolations(page)).toEqual([]);
}

async function fillForm(page: Page, article: Article): Promise<void> {
  await page.getByLabel("Title").fill(article.title);
  await page.getByLabel("Slug").fill(article.slug);
  await page.getByLabel("Summary").fill(article.summary);
  await page.getByLabel("Body").fill(article.body);
}

// The browser would otherwise stop an empty required field before it reaches
// the server; this scenario is about the server's messages at their fields.
async function allowInvalidSubmission(page: Page): Promise<void> {
  await page
    .locator("form")
    .evaluate((form) => form.setAttribute("novalidate", ""));
}

// Posts a save the way a plain browser form does: form-encoded, asking for the
// page, and with the same origin the browser sends (SvelteKit refuses a
// cross-site form submission). The answer is therefore the page the owner
// would see, with its message.
function postSave(
  request: APIRequestContext,
  entryId: string,
  fields: Record<string, string>,
) {
  return request.post(`/entries/${entryId}?/save`, {
    headers: {
      ...accessHeaders,
      accept: "text/html",
      origin: adminOrigin,
    },
    form: fields,
  });
}

// Seeds an entry and its revisions through @ycmcuenca/db, the functions the
// app and the integration tests use, so the tests start from a stored article.
async function seedArticle(revisions: readonly Article[]): Promise<string> {
  return withTestDatabase(async (database) => {
    const [first, ...rest] = revisions;
    if (first === undefined) {
      throw new Error("Seed at least one revision.");
    }
    const created = await createEntry(database, toInput(first));
    if (!created.ok) {
      throw new Error(`Seeding failed: ${JSON.stringify(created.errors)}`);
    }
    for (const revision of rest) {
      const appended = await appendRevision(
        database,
        created.entry.id,
        toInput(revision),
      );
      if (!appended.ok) {
        throw new Error(`Appending failed: ${JSON.stringify(appended.errors)}`);
      }
    }
    return created.entry.id;
  });
}

function toInput(article: Article): {
  slug: string;
  title: string;
  summary: string;
  body: { type: "markdown"; source: string }[];
} {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    body: [{ type: "markdown", source: article.body }],
  };
}

function revisionsOf(entryId: string): Promise<Revision[]> {
  return withTestDatabase((database) => listRevisions(database, entryId));
}

function entryOf(entryId: string) {
  return withTestDatabase((database) =>
    entryStoreFor(database).findEntry(entryId),
  );
}

function entryCount(): Promise<number> {
  return withTestDatabase((database) => countEntries(database));
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

function rowFor(page: Page, title: string) {
  return page.getByRole("listitem").filter({ hasText: title });
}

function entryIdFrom(pageUrl: string): string {
  const match =
    /\/entries\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      new URL(pageUrl).pathname,
    );
  const entryId = match?.[1];
  if (entryId === undefined) {
    throw new Error(`No entry id in ${pageUrl}.`);
  }
  return entryId;
}
