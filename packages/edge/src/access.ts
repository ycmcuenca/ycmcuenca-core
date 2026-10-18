// In-worker Cloudflare Access verification (design D6; the access-control
// spec; decision A2). The guard fails closed: anything it cannot verify is a
// 403, and every refusal is one warning line naming the reason, never the
// token.
import type {} from "./ambient";
import type { Handle } from "@sveltejs/kit/hooks";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import type { Logger } from "./logging.ts";

/** Why a request was refused (design D6), used in the warning log line. */
export type AccessRefusalReason =
  | "config"
  | "missing"
  | "signature"
  | "issuer"
  | "audience"
  | "expired"
  | "keys";

export interface AccessGuardOptions {
  /** The team's Access origin, for example `https://<team>.cloudflareaccess.com`. */
  teamDomain: string;
  /** The Access application's audience tag. */
  audience: string;
  /** A logger for the request being handled (design D9). */
  log: (request: Request) => Logger;
  /**
   * Replaces the team's remote key set. Tests sign tokens with their own
   * keys and inject the matching public set (task 2.4).
   */
  keySet?: JWTVerifyGetKey;
}

/** The key set for one team domain, created once per isolate (design D6). */
const keySets = new Map<string, JWTVerifyGetKey>();

/** The remote key set of a team domain, or nothing when the domain is not a URL origin. */
function keySetFor(teamDomain: string): JWTVerifyGetKey | undefined {
  const cached = keySets.get(teamDomain);
  if (cached) {
    return cached;
  }
  let keySet: JWTVerifyGetKey;
  try {
    keySet = tagKeySetFailures(
      createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain)),
    );
  } catch {
    return undefined;
  }
  keySets.set(teamDomain, keySet);
  return keySet;
}

/**
 * Marks an error thrown while fetching the key set, so the refusal reason can
 * tell "the keys are unavailable" apart from "the token does not match".
 */
class KeySetUnavailable extends Error {
  constructor(cause: unknown) {
    super("the team's key set could not be fetched", { cause });
  }
}

function tagKeySetFailures(keySet: JWTVerifyGetKey): JWTVerifyGetKey {
  return async (protectedHeader, token) => {
    try {
      return await keySet(protectedHeader, token);
    } catch (error) {
      if (error instanceof errors.JWKSNoMatchingKey) {
        // The key set answered; no key in it matches this token (D6: `signature`).
        throw error;
      }
      throw new KeySetUnavailable(error);
    }
  };
}

function refusalReason(error: unknown): AccessRefusalReason {
  if (error instanceof KeySetUnavailable) {
    return "keys";
  }
  if (error instanceof errors.JWTExpired) {
    return "expired";
  }
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === "iss") {
      return "issuer";
    }
    if (error.claim === "aud") {
      return "audience";
    }
  }
  return "signature";
}

/**
 * The `handle` hook that verifies the `Cf-Access-Jwt-Assertion` header of
 * every request against the team's public keys, the configured issuer and the
 * application audience, and sets `locals.accessEmail` on success (design D6).
 */
export function accessGuard(options: AccessGuardOptions): Handle {
  const { teamDomain, audience, log } = options;
  const injectedKeySet = options.keySet && tagKeySetFailures(options.keySet);
  return async ({ event, resolve }) => {
    const requestLog = log(event.request);
    const refuse = (reason: AccessRefusalReason): Response => {
      requestLog.warn("access refused", { reason });
      return new Response("Forbidden", { status: 403 });
    };

    if (!teamDomain || !audience) {
      return refuse("config");
    }
    const token = event.request.headers.get("cf-access-jwt-assertion");
    if (!token) {
      return refuse("missing");
    }
    const keySet = injectedKeySet ?? keySetFor(teamDomain);
    if (!keySet) {
      return refuse("config");
    }

    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: teamDomain,
        audience,
        algorithms: ["RS256"],
      });
      event.locals.accessEmail =
        typeof payload.email === "string" ? payload.email : undefined;
    } catch (error) {
      return refuse(refusalReason(error));
    }
    return resolve(event);
  };
}

/**
 * The handle a production build cannot contain: local development skips the
 * check through a build-time constant (design D6, D7).
 */
export const passThrough: Handle = ({ event, resolve }) => resolve(event);
