// The tags each cacheable page names (design D3 in
// openspec/changes/edge-cache/design.md). The type and locale are the same
// pair `@ycmcuenca/cms-render` reads from KV, so a tag always names a snapshot
// the page actually shows.
import {
  article,
  entryTag,
  indexTag,
  localeTag,
  typeTag,
} from "@ycmcuenca/cms-core";

/** The one locale the site publishes (design D3). */
const articleLocale = "en";

/** The tags of a page that lists articles: the home page, sitemap and feed. */
export function articleIndexTags(): string[] {
  return [
    indexTag(article.name, articleLocale),
    typeTag(article.name),
    localeTag(articleLocale),
  ];
}

/** The tags of one published article's page (design D3). */
export function articlePageTags(slug: string): string[] {
  return [
    entryTag(article.name, slug),
    typeTag(article.name),
    localeTag(articleLocale),
  ];
}
