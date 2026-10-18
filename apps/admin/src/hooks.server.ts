// The `admin` app's server hooks: the baseline security headers plus
// `X-Robots-Tag` on every response (design D8), the in-worker Access guard
// (design D6, decision A2) and structured error handling with a request id
// (design D9, decision I9).
import { createLogger, handleErrorFor, securityHeaders } from "@ycmcuenca/edge";
import { accessGuard, passThrough } from "@ycmcuenca/edge/access";
import { dev } from "$app/env";
import { sequence } from "@sveltejs/kit/hooks";
import { env } from "cloudflare:workers";

// `dev` is a build-time constant, so a production build contains only the
// guarded branch; no runtime setting can skip the check (design D6, D7).
export const handle = sequence(
  securityHeaders({ "X-Robots-Tag": "noindex, nofollow" }),
  dev
    ? passThrough
    : accessGuard({
        teamDomain: env.ACCESS_TEAM_DOMAIN,
        audience: env.ACCESS_AUD,
        log: (request) => createLogger("admin", request),
      }),
);

export const handleError = handleErrorFor("admin");
