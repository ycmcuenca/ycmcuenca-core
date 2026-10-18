// Security headers and the Content Security Policy every response carries
// (design D8; the security-headers spec; decisions I10, assumptions A1-A3).
import type { Handle } from "@sveltejs/kit/hooks";

/**
 * The headers both apps send on every response: HSTS for two years without
 * `preload` (a `workers.dev` subdomain cannot be submitted to the preload
 * list), no MIME-type sniffing, cross-origin referrer information only, and
 * the camera, microphone and geolocation features disabled (A1, A2).
 */
export const baselineSecurityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** A directive value both apps allow (A3). */
export type CspSource =
  "self" | "none" | "data:" | "unsafe-hashes" | `sha256-${string}`;

/**
 * The SHA-256 hash of the inline `style` SvelteKit's own root component puts
 * on its `svelte-announcer` element (sveltejs/kit#11993). Only this one
 * attribute value passes the policy; see `cspDirectives`.
 */
const svelteAnnouncerStyleHash =
  "sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=";

/**
 * The enforced Content Security Policy (design D8). SvelteKit adds a hash
 * for every inline script and style it generates, so the policy never
 * carries a per-response value and a cached page stays valid for every
 * visitor.
 *
 * `style-src-attr` is the one hole SvelteKit cannot fill itself: the
 * `svelte-announcer` element arrives with a hardcoded inline style that
 * SvelteKit never hashes (sveltejs/kit#11993). `'unsafe-hashes'` is what
 * CSP3 requires before a hash applies to a style attribute at all
 * (Chrome 69+, Firefox 109+, Safari 15.4+); the single hash in the list
 * then allows exactly that one value and nothing else.
 */
export const cspDirectives: Record<string, CspSource[]> = {
  "default-src": ["self"],
  "script-src": ["self"],
  "style-src": ["self"],
  "style-src-attr": ["unsafe-hashes", svelteAnnouncerStyleHash],
  "font-src": ["self"],
  "connect-src": ["self"],
  "img-src": ["self", "data:"],
  "object-src": ["none"],
  "base-uri": ["self"],
  "form-action": ["self"],
  "frame-ancestors": ["none"],
};

/**
 * A `handle` hook that sets the baseline headers, plus any app-specific ones
 * the caller passes, on every response. A response whose headers are
 * immutable (a redirect, for example) is cloned first, because its headers
 * cannot be changed in place (design D8).
 */
export function securityHeaders(extra: Record<string, string> = {}): Handle {
  const headers = { ...baselineSecurityHeaders, ...extra };
  return async ({ event, resolve }) =>
    withHeaders(await resolve(event), headers);
}

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
