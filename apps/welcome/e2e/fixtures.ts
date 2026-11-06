// The snapshots the `welcome` e2e seeds into local KV (design D5). The global
// setup writes these values and the tests assert against the same objects, so
// the fixture and the expectation cannot drift apart.
import type { EntrySnapshot, IndexSnapshot } from "@ycmcuenca/cms-core";

/** The article whose first and last publish days differ (spec: updated article). */
export const updatedArticle: EntrySnapshot = {
  snapshot_v: 1,
  type: "article",
  slug: "hello-world",
  title: "Hello, world",
  summary: "The first article.",
  blocks: [
    { type: "markdown", html: "<p>First paragraph.</p>" },
    { type: "markdown", html: "<p>Second paragraph.</p>" },
  ],
  publishedAt: "2026-11-01T09:00:00.000Z",
  updatedAt: "2026-11-05T10:30:00.000Z",
};

/** The later article, so the home page lists it before the older one. */
export const newerArticle: EntrySnapshot = {
  snapshot_v: 1,
  type: "article",
  slug: "second-post",
  title: "A second article",
  summary: "The second article.",
  blocks: [{ type: "markdown", html: "<p>The second body.</p>" }],
  publishedAt: "2026-11-03T12:00:00.000Z",
  updatedAt: "2026-11-03T12:00:00.000Z",
};

/** The readable articles, in the order the home page lists them. */
export const publishedArticles: readonly EntrySnapshot[] = [
  newerArticle,
  updatedArticle,
];

/** The index the projector writes for both articles (design D3). */
export const articleIndex: IndexSnapshot = {
  snapshot_v: 1,
  type: "article",
  locale: "en",
  items: publishedArticles.map(({ slug, title, summary, publishedAt }) => ({
    slug,
    title,
    summary,
    publishedAt,
  })),
};

/**
 * A snapshot a later version wrote (spec: future snapshot version). The reader
 * must refuse it whole, so neither its title nor its body may reach a page.
 */
export const futureArticle = {
  snapshot_v: 2,
  type: "article",
  slug: "future-post",
  title: "A future article",
  summary: "Written by a later snapshot version.",
  blocks: [{ type: "markdown", html: "<p>Future body.</p>" }],
  publishedAt: "2026-12-01T00:00:00.000Z",
  updatedAt: "2026-12-01T00:00:00.000Z",
};
