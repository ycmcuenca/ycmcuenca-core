// How the site uses Cloudflare's edge cache: which requests it serves, what
// headers they carry, and how a publish purges them (design D2, D3 and D4 in
// openspec/changes/edge-cache/design.md).
import type { PurgeOutcome } from "@ycmcuenca/cms-core";
import type { Handle } from "@sveltejs/kit/hooks";

/** The edge may keep a page for a minute, then refresh it in the background. */
const edgeLifetime = "max-age=60, stale-while-revalidate=300";

/** Browsers revalidate every time, so only the edge keeps the page (D3). */
const browserLifetime = "public, max-age=0";

/** Every response that must never be cached (spec, "Other responses…"). */
const noStore = "no-store";

/** The longest tag Cloudflare's cache accepts (design D4). */
const maxTagLength = 1024;

// `Cache-Tag` accepts printable ASCII only (design D3): 0x20 to 0x7e.
const printableAscii = /^[\x20-\x7e]+$/;

/** Whether a tag may be sent to the cache (design D4). */
function isValidTag(tag: string): boolean {
  return tag.length <= maxTagLength && printableAscii.test(tag);
}

/**
 * Serves only production `GET` and `HEAD` requests through the cache (design
 * D2). A preview or version URL has another host, so it runs SvelteKit
 * directly and no unreleased HTML fills a cache whose key ignores the host.
 */
export function isCacheable(
  request: Request,
  env: { readonly SITE_ORIGIN: string },
): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  return new URL(request.url).host === new URL(env.SITE_ORIGIN).host;
}

/**
 * Purges tags from the cache: the body of `Site.purge` (design D4). A refusal
 * is a result, not an error, because the publish it follows already succeeded
 * (spec, "A failed purge does not fail the publish").
 */
export async function purgeTags(
  cache: CacheContext | undefined,
  tags: string[],
): Promise<PurgeOutcome> {
  if (!tags.every(isValidTag)) {
    return { purged: false, reason: "invalid tag" };
  }
  // The runtime marks `cache` optional: local `wrangler dev` has no cache
  // (design D4, D7, assumption A1).
  if (cache === undefined) {
    return { purged: false, reason: "cache unavailable" };
  }
  const result = await cache.purge({ tags });
  return result.success
    ? { purged: true }
    : { purged: false, reason: describePurgeFailure(result.errors) };
}

/** What a failed purge says: its messages, or a fallback when it names none. */
function describePurgeFailure(errors: readonly CachePurgeError[]): string {
  const messages = errors.map((error) => error.message);
  return messages.length === 0 ? "purge failed" : messages.join("; ");
}

/**
 * The cache headers a response carries (design D3): a tagged 200 is cached at
 * the edge, while every other response, including each 404 and error, is
 * never cached.
 */
export const cachePolicy: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  const tags = event.locals.cacheTags;
  return withHeaders(
    response,
    tags !== undefined && response.status === 200
      ? {
          "Cloudflare-CDN-Cache-Control": edgeLifetime,
          "Cache-Control": browserLifetime,
          "Cache-Tag": tags.join(","),
        }
      : { "Cache-Control": noStore },
  );
};

/**
 * Sets headers, cloning a response whose own headers are immutable (the same
 * guard `securityHeaders` uses in `@ycmcuenca/edge`).
 */
function withHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  try {
    setHeaders(response, headers);
    return response;
  } catch {
    const clone = new Response(response.body, response);
    setHeaders(clone, headers);
    return clone;
  }
}

function setHeaders(response: Response, headers: Record<string, string>): void {
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
}
