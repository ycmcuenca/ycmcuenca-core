// The snapshots the `welcome` e2e seeds into local KV (design D5). The global
// setup writes these values and the tests assert against the same objects, so
// the fixture and the expectation cannot drift apart.
import { renderMarkdown } from "@ycmcuenca/cms-core";
import type { EntrySnapshot, IndexSnapshot } from "@ycmcuenca/cms-core";

/** The Markdown a publish of the aligned-table article renders. */
const tableSource = [
  "| Left | Center | Right |",
  "| :--- | :----: | ----: |",
  "| a    | b      | c     |",
].join("\n");

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

/**
 * An article whose body holds an aligned table. The fixture renders its body
 * through cms-core, as publishing does, so the stored HTML is what the
 * renderer produces: classes under the strict CSP, never inline styles
 * (design D8).
 */
export const tableArticle: EntrySnapshot = {
  snapshot_v: 1,
  type: "article",
  slug: "aligned-table",
  title: "An aligned table",
  summary: "A body with an aligned table.",
  blocks: [{ type: "markdown", html: renderMarkdown(tableSource) }],
  publishedAt: "2026-10-30T09:00:00.000Z",
  updatedAt: "2026-10-30T09:00:00.000Z",
};

/** The readable articles, in the order the home page lists them. */
export const publishedArticles: readonly EntrySnapshot[] = [
  newerArticle,
  updatedArticle,
  tableArticle,
];

/** The index the projector writes for both articles (design D3). */
export const articleIndex: IndexSnapshot = {
  snapshot_v: 1,
  type: "article",
  locale: "en",
  items: publishedArticles.map(
    ({ slug, title, summary, publishedAt, updatedAt }) => ({
      slug,
      title,
      summary,
      publishedAt,
      updatedAt,
    }),
  ),
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
