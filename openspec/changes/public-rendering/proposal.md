# Proposal

## Why

`revisions-publishing` writes article snapshots and an index to KV, but visitors still see a placeholder. Sprint 2's goal is that `welcome` serves a published English entry from its snapshot, with no database binding (C5). This change builds that read side, the shared block renderer that C1 asks for (`@ycmcuenca/cms-render`), and the SEO basics of Q4. With it the walking skeleton is complete end to end, apart from caching (`edge-cache`).

## What Changes

- **New package `@ycmcuenca/cms-render`** (C1, P11): Svelte components that render a snapshot's blocks through a block registry (`markdown` in S2), plus the KV snapshot reader that `welcome` uses. `admin-editor`'s preview uses the same components, so the preview looks the same as the site.
- **`welcome` reads KV only.** `welcome` gains a read-only use of the `SNAPSHOTS` KV binding, the same namespace `admin` writes. It still has no database binding (C5, developer-workspace).
- **Article pages at `/en/articles/{slug}`** (L4, owner decision: the final URL shape from day one). Each page shows the title, the first-publish date, the last-update date when it differs, and the rendered body. An unknown slug gets a 404.
- **The home page lists articles** (owner decision): the existing `Welcome` heading and intro, then each published article's title (linked), date and summary, newest first, read from the index snapshot. It shows "No articles yet." when the index is empty or missing.
- **Tolerant reading (C8).** A snapshot with an unsupported version, or one that fails validation, is logged as an error and answered with 404, never half-rendered.
- **SEO basics (Q4)**:
  - a canonical URL and `hreflang="en"` plus `x-default` alternates on every page, built from a committed `SITE_ORIGIN` variable;
  - a meta description from the summary;
  - `/sitemap.xml` listing the home page and every published article;
  - an Atom feed at `/en/feed.xml`, with an autodiscovery link;
  - a `Sitemap:` line in `robots.txt`.
- **The exit criterion, tested locally.** A new two-worker end-to-end test runs `admin` and `welcome` under `wrangler dev`, sharing one local KV state. It publishes in `admin`, sees the article on `welcome`, unpublishes, and sees a 404 (owner decision).

Out of scope:

- Workers Cache, cache tags and purging (`edge-cache`).
- Locales other than `en`, locale negotiation and Paraglide (S4).
- Visual design and fonts (S5); pages stay plain HTML.
- Images, open-graph images and structured data.
- An article archive page separate from the home page.

## Capabilities

### New Capabilities

- `public-site`: what visitors can read on `welcome` (the article list and the article pages), what happens for unknown or unreadable content, and the search-engine and feed metadata the site publishes.

### Modified Capabilities

- `developer-workspace`: a new requirement for the end-to-end test of the publish path across both apps.

## Impact

- **New files**: `packages/cms-render/` (manifest, configs, components, registry, reader and tests); `apps/welcome/src/routes/+page.server.ts`, `en/articles/[slug]/+page.server.ts` and `+page.svelte`, `sitemap.xml/+server.ts`, `en/feed.xml/+server.ts`; `apps/welcome/src/lib/server/seo.ts`; `apps/welcome/e2e/articles.spec.ts` and a KV seeding setup; `apps/admin/e2e/publish-path.spec.ts`; `apps/admin/turbo.json`.
- **Changed files**: `apps/welcome/wrangler.jsonc` (the `SNAPSHOTS` binding and `SITE_ORIGIN`) and its regenerated types, `apps/welcome/package.json`, `apps/welcome/src/routes/+page.svelte` and `+layout.svelte`, `apps/welcome/static/robots.txt`, `apps/admin/playwright.config.ts` (a second worker), `README.md`, `bun.lock`.
- **Releases**: `feat(welcome)` releases `welcome`; `admin` is unchanged apart from tests.
- **Decisions**: builds on C1, C5, C6, C8, L4, P11 and Q4. The cache half of the roadmap's `public-rendering` line (C10) moves to the new `edge-cache` change (owner decision). At archive, DECISIONS.md records `SITE_ORIGIN` as the single source of absolute URLs until the custom-domain cutover.
