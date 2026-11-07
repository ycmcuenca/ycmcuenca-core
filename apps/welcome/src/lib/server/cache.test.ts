// The edge cache policy (design D2, D3 and D4 in
// openspec/changes/edge-cache/design.md), tested without a Worker: the
// functions take the request or the cache the Worker would hand them.
import { describe, expect, it } from "vitest";
import { cachePolicy, isCacheable, purgeTags } from "./cache";

const origin = "https://welcome.ycmcuenca.workers.dev";

/** A production request, so only its method can make it uncacheable. */
function productionRequest(method = "GET"): Request {
  return new Request(`${origin}/en/articles/hello-world`, { method });
}

/** The environment shape `isCacheable` reads. */
const env = { SITE_ORIGIN: origin };

/** What a fake cache's `purge` received, so a test can assert the tags. */
interface PurgeCall {
  tags: string[] | undefined;
}

/** A cache whose purge answers `result`, recording the tags it received. */
function fakeCache(result: CachePurgeResult, calls: PurgeCall[]): CacheContext {
  return {
    purge: async ({ tags }: CachePurgeOptions) => {
      calls.push({ tags });
      return result;
    },
  } as unknown as CacheContext;
}

describe("isCacheable (design D2)", () => {
  it("serves a production GET through the cache", () => {
    expect(isCacheable(productionRequest("GET"), env)).toBe(true);
  });

  it("serves a production HEAD through the cache", () => {
    expect(isCacheable(productionRequest("HEAD"), env)).toBe(true);
  });

  it("does not serve a preview host through the cache", () => {
    const preview = new Request(
      "https://abc-welcome.ycmcuenca.workers.dev/en/articles/hello-world",
    );
    expect(isCacheable(preview, env)).toBe(false);
  });

  it("does not serve a POST through the cache", () => {
    expect(isCacheable(productionRequest("POST"), env)).toBe(false);
  });

  it("does not serve a DELETE through the cache", () => {
    expect(isCacheable(productionRequest("DELETE"), env)).toBe(false);
  });
});

describe("Site.purge (design D4)", () => {
  it("refuses a tag that is not printable ASCII", async () => {
    const calls: PurgeCall[] = [];
    const outcome = await purgeTags(
      fakeCache({ success: true, errors: [] }, calls),
      ["bad\ntag"],
    );
    expect(outcome).toEqual({ purged: false, reason: "invalid tag" });
    expect(calls).toEqual([]);
  });

  it("refuses a tag longer than 1,024 characters", async () => {
    const calls: PurgeCall[] = [];
    const outcome = await purgeTags(
      fakeCache({ success: true, errors: [] }, calls),
      ["x".repeat(1025)],
    );
    expect(outcome).toEqual({ purged: false, reason: "invalid tag" });
    expect(calls).toEqual([]);
  });

  it("reports a missing cache", async () => {
    const outcome = await purgeTags(undefined, ["entry:article:hello-world"]);
    expect(outcome).toEqual({ purged: false, reason: "cache unavailable" });
  });

  it("reports a successful purge and sends the tags", async () => {
    const calls: PurgeCall[] = [];
    const outcome = await purgeTags(
      fakeCache({ success: true, errors: [] }, calls),
      ["entry:article:hello-world", "index:article:en"],
    );
    expect(outcome).toEqual({ purged: true });
    expect(calls).toEqual([
      { tags: ["entry:article:hello-world", "index:article:en"] },
    ]);
  });

  it("reports the failure's messages", async () => {
    const calls: PurgeCall[] = [];
    const outcome = await purgeTags(
      fakeCache(
        {
          success: false,
          errors: [
            { code: 1, message: "first failure" },
            { code: 2, message: "second failure" },
          ],
        },
        calls,
      ),
      ["entry:article:hello-world"],
    );
    expect(outcome).toEqual({
      purged: false,
      reason: "first failure; second failure",
    });
  });

  it("falls back when a failure names no error", async () => {
    const calls: PurgeCall[] = [];
    const outcome = await purgeTags(
      fakeCache({ success: false, errors: [] }, calls),
      ["entry:article:hello-world"],
    );
    expect(outcome).toEqual({ purged: false, reason: "purge failed" });
  });
});

/** The response `cachePolicy` produces for a status and optional tags. */
async function policyResponse(
  status: number,
  cacheTags?: string[],
): Promise<Response> {
  const handle = cachePolicy as unknown as (input: {
    event: { locals: { cacheTags?: string[] } };
    resolve: () => Promise<Response>;
  }) => Promise<Response>;
  return handle({
    event: { locals: cacheTags === undefined ? {} : { cacheTags } },
    resolve: async () => new Response(null, { status }),
  });
}

describe("cachePolicy (design D3)", () => {
  it("caches a tagged 200 at the edge and in no browser", async () => {
    const response = await policyResponse(200, [
      "entry:article:hello-world",
      "type:article",
      "locale:en",
    ]);
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "max-age=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=0");
    expect(response.headers.get("cache-tag")).toBe(
      "entry:article:hello-world,type:article,locale:en",
    );
  });

  it("does not cache an untagged 200", async () => {
    const response = await policyResponse(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cache-tag")).toBeNull();
  });

  it("does not cache a 404", async () => {
    const response = await policyResponse(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cache-tag")).toBeNull();
  });

  it("does not cache a tagged 404", async () => {
    const response = await policyResponse(404, ["entry:article:hello-world"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cache-tag")).toBeNull();
  });
});
