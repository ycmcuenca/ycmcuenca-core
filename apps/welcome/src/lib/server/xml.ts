// The two fixed XML shapes the public site serves (design D3): a sitemap and
// an Atom feed. They are built as strings because the shapes are fixed, and
// every interpolated value goes through `escapeXml`; no XML library is needed.

/** The five characters an XML text node or attribute value must escape. */
const entities: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escapes the characters that would otherwise be markup (design D3). */
export function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character,
  );
}

/** One article in the sitemap (design D3). */
export interface SitemapArticle {
  /** The article's absolute URL. */
  readonly url: string;
  /**
   * The last date the index carries for the article, ISO 8601. The index is
   * built from first-publish times (design D3), so that is the date shown
   * until the index also carries the last-publish time.
   */
  readonly lastModified: string;
}

/**
 * The XML sitemap (sitemaps.org 0.9, design D3): the home page and every
 * published article, each article with its available last update date.
 */
export function sitemapXml(
  homeUrl: string,
  articles: readonly SitemapArticle[],
): string {
  const urls = [
    `<url><loc>${escapeXml(homeUrl)}</loc></url>`,
    ...articles.map(
      (article) =>
        `<url><loc>${escapeXml(article.url)}</loc><lastmod>${escapeXml(article.lastModified)}</lastmod></url>`,
    ),
  ];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

/** One entry in the Atom feed (design D3). */
export interface FeedEntry {
  readonly title: string;
  /** The entry's absolute URL, used as both its link and its id. */
  readonly url: string;
  readonly summary: string;
  /** The entry's first-publish time, ISO 8601. */
  readonly publishedAt: string;
}

/** The feed's own identity and links (design D3). */
export interface FeedChannel {
  readonly title: string;
  readonly homeUrl: string;
  readonly feedUrl: string;
  readonly author: string;
}

/** The `updated` time of an empty feed (design D3). */
const epoch = "1970-01-01T00:00:00.000Z";

/**
 * The Atom feed (design D3): newest first, each entry with its title, its
 * absolute URL as link and id, its summary and its first-publish time.
 */
export function atomFeed(
  channel: FeedChannel,
  entries: readonly FeedEntry[],
): string {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `<title>${escapeXml(channel.title)}</title>`,
    `<id>${escapeXml(channel.homeUrl)}</id>`,
    `<updated>${newestPublishedAt(entries)}</updated>`,
    `<link rel="self" href="${escapeXml(channel.feedUrl)}"/>`,
    `<link rel="alternate" href="${escapeXml(channel.homeUrl)}"/>`,
    `<author><name>${escapeXml(channel.author)}</name></author>`,
    ...entries.map(entryXml),
    `</feed>`,
    ``,
  ];
  return lines.join("\n");
}

// One feed entry. Atom requires an `updated` time, so the first-publish time
// stands in for it: a snapshot keeps no per-entry change beyond that (D3).
function entryXml(entry: FeedEntry): string {
  return [
    `<entry>`,
    `<title>${escapeXml(entry.title)}</title>`,
    `<id>${escapeXml(entry.url)}</id>`,
    `<link rel="alternate" href="${escapeXml(entry.url)}"/>`,
    `<published>${escapeXml(entry.publishedAt)}</published>`,
    `<updated>${escapeXml(entry.publishedAt)}</updated>`,
    `<summary>${escapeXml(entry.summary)}</summary>`,
    `</entry>`,
  ].join("");
}

// The newest entry's first-publish time, or the epoch when none is published.
// The caller passes the index's newest-first order, and the comparison keeps
// the answer right even if that order ever changes.
function newestPublishedAt(entries: readonly FeedEntry[]): string {
  return entries.reduce(
    (newest, entry) =>
      entry.publishedAt > newest ? entry.publishedAt : newest,
    epoch,
  );
}
