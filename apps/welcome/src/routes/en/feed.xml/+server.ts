// The English Atom feed (design D3): every published article, newest first,
// read from the index snapshot. An unreadable index yields a valid empty feed.
import { readArticleIndex } from "@ycmcuenca/cms-render";
import { createLogger } from "@ycmcuenca/edge";
import { env } from "cloudflare:workers";
import { appName } from "#lib/app-meta.js";
import { absoluteUrl } from "#lib/server/seo.js";
import { atomFeed } from "#lib/server/xml.js";
import { articleIndexTags } from "#lib/server/tags.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, request }) => {
  const index = await readArticleIndex(
    env.SNAPSHOTS,
    createLogger("welcome", request),
  );
  const entries = (index?.items ?? []).map((item) => ({
    title: item.title,
    url: absoluteUrl(`/en/articles/${item.slug}`),
    summary: item.summary,
    publishedAt: item.publishedAt,
  }));
  const feed = atomFeed(
    {
      title: appName,
      homeUrl: absoluteUrl("/"),
      feedUrl: absoluteUrl("/en/feed.xml"),
      author: "Yosef Christian Mercene Cuenca",
    },
    entries,
  );
  // The feed lists the article index, so a publish purges it (design D3).
  locals.cacheTags = articleIndexTags();
  return new Response(feed, {
    headers: { "content-type": "application/atom+xml" },
  });
};
