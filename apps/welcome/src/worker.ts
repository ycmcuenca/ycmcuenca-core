// The Worker entry around SvelteKit's build (design D1, D2 and D4 in
// openspec/changes/edge-cache/design.md). `Site` is the entrypoint that owns
// the Workers Cache: it has the context a purge needs, which SvelteKit's
// default handler does not receive.
import { WorkerEntrypoint } from "cloudflare:workers";
import type { PurgeOutcome } from "@ycmcuenca/cms-core";
import sveltekit from "../.svelte-kit/cloudflare/_worker.js";

/** The longest tag Cloudflare's cache accepts (design D4). */
const maxTagLength = 1024;

// `Cache-Tag` accepts printable ASCII only (design D3): 0x20 to 0x7e.
const printableAscii = /^[\x20-\x7e]+$/;

/** Whether a tag may be sent to the cache (design D4). */
function isValidTag(tag: string): boolean {
  return tag.length <= maxTagLength && printableAscii.test(tag);
}

/**
 * The site's own entrypoint (design D1, D4). A request routed here runs
 * SvelteKit with the full context; `purge` is reachable only over a service
 * binding, so no public URL can remove a cached page (spec, "Only admin can
 * purge").
 */
export class Site extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> {
    return sveltekit.fetch(request, this.env, this.ctx);
  }

  async purge(tags: string[]): Promise<PurgeOutcome> {
    if (!tags.every(isValidTag)) {
      return { purged: false, reason: "invalid tag" };
    }
    // The context marks `cache` optional: local `wrangler dev` may not have it
    // (design D4, D7, assumption A1).
    if (this.ctx.cache === undefined) {
      return { purged: false, reason: "cache unavailable" };
    }
    const result = await this.ctx.cache.purge({ tags });
    return result.success
      ? { purged: true }
      : { purged: false, reason: describePurgeFailure(result.errors) };
  }
}

/**
 * Only production `GET` and `HEAD` requests go through the cached entrypoint
 * (design D2). A preview or version URL has another host, so it runs
 * SvelteKit directly and no unreleased HTML can enter the cache whose key
 * ignores the host.
 */
function isCacheable(request: Request, env: Env): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  return new URL(request.url).host === new URL(env.SITE_ORIGIN).host;
}

/** What a failed purge says: its messages, or a fallback when it names none. */
function describePurgeFailure(errors: readonly CachePurgeError[]): string {
  const messages = errors.map((error) => error.message);
  return messages.length === 0 ? "purge failed" : messages.join("; ");
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return isCacheable(request, env)
      ? ctx.exports.Site.fetch(request)
      : sveltekit.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
