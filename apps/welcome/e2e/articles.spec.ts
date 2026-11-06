// The public site end to end (design D5): the built worker runs under
// `wrangler dev` in workerd, reading the snapshots the global setup seeded
// into the same local KV, so these tests prove what a deploy would serve.
import {
  collectedViolations,
  cspWithoutHashes,
  expectedCsp,
  trackViolations,
} from "@ycmcuenca/edge/testing";
import { expect, test } from "@playwright/test";
import { dateOnly } from "../src/lib/dates";
import { siteOrigin } from "./environment";
import {
  futureArticle,
  newerArticle,
  publishedArticles,
  updatedArticle,
} from "./fixtures";

test("the home page lists the published articles newest first", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome");

  const links = page.getByRole("listitem").getByRole("link");
  await expect(links).toHaveText(
    publishedArticles.map((article) => article.title),
  );
  for (const [position, article] of publishedArticles.entries()) {
    await expect(links.nth(position)).toHaveAttribute(
      "href",
      `/en/articles/${article.slug}`,
    );
  }

  const dates = page.getByRole("listitem").locator("time");
  await expect(dates).toHaveText(
    publishedArticles.map((article) => dateOnly(article.publishedAt)),
  );
  const summaries = page.getByRole("listitem").locator("p");
  await expect(summaries).toHaveText(
    publishedArticles.map((article) => article.summary),
  );
});

test("an article page shows its title, both dates and its body in order", async ({
  page,
}) => {
  await page.goto(`/en/articles/${updatedArticle.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    updatedArticle.title,
  );

  const dates = page.locator("time");
  await expect(dates).toHaveText([
    dateOnly(updatedArticle.publishedAt),
    dateOnly(updatedArticle.updatedAt),
  ]);
  await expect(dates.nth(0)).toHaveAttribute(
    "datetime",
    dateOnly(updatedArticle.publishedAt),
  );
  await expect(dates.nth(1)).toHaveAttribute(
    "datetime",
    dateOnly(updatedArticle.updatedAt),
  );

  const blocks = page.locator(".block-markdown");
  await expect(blocks).toHaveText(["First paragraph.", "Second paragraph."]);
});

test("an unknown slug is a 404", async ({ page }) => {
  const response = await page.goto("/en/articles/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
});

test("a snapshot of an unsupported version is not shown", async ({ page }) => {
  const response = await page.goto(`/en/articles/${futureArticle.slug}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  // Not one part of the refused snapshot may reach the page (spec).
  await expect(page.getByText(futureArticle.title)).toHaveCount(0);
  await expect(page.locator(".block-markdown")).toHaveCount(0);
});

test("the article page carries the canonical, the alternates and its summary", async ({
  page,
}) => {
  await page.goto(`/en/articles/${updatedArticle.slug}`);
  const canonical = `${siteOrigin}/en/articles/${updatedArticle.slug}`;
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    canonical,
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", canonical);
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", canonical);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    updatedArticle.summary,
  );
});

test("the sitemap lists the home page and every article", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/xml");

  const body = await response.text();
  expect(body).toContain(`<loc>${siteOrigin}/</loc>`);
  for (const article of publishedArticles) {
    const loc = `<loc>${siteOrigin}/en/articles/${article.slug}</loc>`;
    expect(body).toContain(loc);
    // Each article shows its last-update date (spec: Sitemap). For the
    // updated article that date differs from its first publish.
    expect(body).toContain(`${loc}<lastmod>${article.updatedAt}</lastmod>`);
  }
});

test("the feed lists every article newest first", async ({ request }) => {
  const response = await request.get("/en/feed.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/atom+xml");

  const body = await response.text();
  const newest = body.indexOf(`${siteOrigin}/en/articles/${newerArticle.slug}`);
  const older = body.indexOf(
    `${siteOrigin}/en/articles/${updatedArticle.slug}`,
  );
  expect(newest).toBeGreaterThanOrEqual(0);
  expect(older).toBeGreaterThan(newest);
});

test("the article page leaves no Content Security Policy violation", async ({
  page,
}) => {
  await trackViolations(page);
  const response = await page.goto(`/en/articles/${updatedArticle.slug}`);
  expect(response?.status()).toBe(200);
  // The announcer mounts only after hydration, so by now every violation the
  // page causes has been reported (design D7).
  await expect(page.locator("#svelte-announcer")).toBeAttached();
  expect(await collectedViolations(page)).toEqual([]);
  expect(cspWithoutHashes(response)).toEqual(expectedCsp);
});
