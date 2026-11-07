// The `welcome` app's server hooks: the baseline security headers on every
// response (design D8, decision I10), the edge cache policy (design D3 in
// openspec/changes/edge-cache/design.md) and structured error handling with a
// request id (design D9, decision I9).
import { handleErrorFor, securityHeaders } from "@ycmcuenca/edge";
import { sequence } from "@sveltejs/kit/hooks";
import { cachePolicy } from "#lib/server/cache.js";

export const handle = sequence(securityHeaders(), cachePolicy);

export const handleError = handleErrorFor("welcome");
