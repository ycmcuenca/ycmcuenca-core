import { describe, expect, it } from "vitest";
import { atomFeed, escapeXml, sitemapXml } from "./xml.js";
import type { FeedChannel, FeedEntry } from "./xml.js";

// The two XML shapes the public site serves (design D3, D5): escaping, and
// each shape with nothing and with two items.

const channel: FeedChannel = {
  title: "Welcome",
  homeUrl: "https://example.test/",
  feedUrl: "https://example.test/en/feed.xml",
  author: "Yosef Christian Mercene Cuenca",
};

function feedEntry(slug: string, publishedAt: string): FeedEntry {
  return {
    title: `Article ${slug}`,
    url: `https://example.test/en/articles/${slug}`,
    summary: `Summary of ${slug}`,
    publishedAt,
  };
}

describe("escapeXml", () => {
  it("escapes the five XML markup characters", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
  });
});

describe("sitemapXml", () => {
  it("lists only the home page when nothing is published", () => {
    const xml = sitemapXml("https://example.test/", []);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain("<loc>https://example.test/</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("lists the home page and two articles, each with its date", () => {
    const xml = sitemapXml("https://example.test/", [
      {
        url: "https://example.test/en/articles/b",
        lastModified: "2026-11-02T00:00:00.000Z",
      },
      {
        url: "https://example.test/en/articles/a",
        lastModified: "2026-11-01T00:00:00.000Z",
      },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).toContain("<loc>https://example.test/en/articles/b</loc>");
    expect(xml).toContain("<lastmod>2026-11-02T00:00:00.000Z</lastmod>");
  });
});

describe("atomFeed", () => {
  it("is valid and dates the epoch when nothing is published", () => {
    const xml = atomFeed(channel, []);
    expect(xml).toContain("<updated>1970-01-01T00:00:00.000Z</updated>");
    expect(xml).not.toContain("<entry>");
  });

  it("lists two entries newest first and escapes their text", () => {
    const xml = atomFeed(channel, [
      {
        ...feedEntry("b", "2026-11-02T00:00:00.000Z"),
        title: "B & friends",
      },
      feedEntry("a", "2026-11-01T00:00:00.000Z"),
    ]);
    expect(xml.match(/<entry>/g)).toHaveLength(2);
    expect(xml).toContain("<title>B &amp; friends</title>");
    expect(xml).toContain("<updated>2026-11-02T00:00:00.000Z</updated>");
    expect(xml.indexOf("https://example.test/en/articles/b")).toBeLessThan(
      xml.indexOf("https://example.test/en/articles/a"),
    );
  });
});
