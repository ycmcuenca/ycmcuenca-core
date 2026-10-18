import type { Handle } from "@sveltejs/kit/hooks";
import { describe, expect, it } from "vitest";
import {
  baselineSecurityHeaders,
  cspDirectives,
  securityHeaders,
} from "./headers";
import { eventFor } from "./test-helpers";

async function passThrough(
  handle: Handle,
  response: Response,
): Promise<Response> {
  return handle({
    event: eventFor("https://example.com/"),
    resolve: async () => response,
  });
}

describe("securityHeaders", () => {
  it("sets the four baseline headers on a mutable response", async () => {
    const original = new Response("ok");

    const response = await passThrough(securityHeaders(), original);

    expect(response).toBe(original);
    for (const [name, value] of Object.entries(baselineSecurityHeaders)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("clones a response whose headers are immutable", async () => {
    const redirect = Response.redirect("https://example.com/");

    const response = await passThrough(securityHeaders(), redirect);

    expect(response).not.toBe(redirect);
    expect(response.status).toBe(302);
    for (const [name, value] of Object.entries(baselineSecurityHeaders)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("merges app-specific headers over the baseline", async () => {
    const response = await passThrough(
      securityHeaders({ "X-Robots-Tag": "noindex, nofollow" }),
      new Response("ok"),
    );

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("cspDirectives", () => {
  it("matches the directive list of design D8, with no nonce", () => {
    expect(cspDirectives).toEqual({
      "default-src": ["self"],
      "script-src": ["self"],
      "style-src": ["self"],
      "style-src-attr": [
        "unsafe-hashes",
        "sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=",
      ],
      "font-src": ["self"],
      "connect-src": ["self"],
      "img-src": ["self", "data:"],
      "object-src": ["none"],
      "base-uri": ["self"],
      "form-action": ["self"],
      "frame-ancestors": ["none"],
    });
    expect(JSON.stringify(cspDirectives)).not.toContain("nonce");
  });

  it("allows SvelteKit's announcer style by its hash alone (D8)", async () => {
    // The exact value of the `style` attribute SvelteKit's root component
    // puts on `#svelte-announcer` (sveltejs/kit#11993). If a SvelteKit
    // upgrade changes it, the e2e violation check fails and both this copy
    // and the one in `cspDirectives` are refreshed from the hash the browser
    // asks for.
    const announcerStyle =
      "position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); " +
      "clip-path: inset(50%); overflow: hidden; white-space: nowrap; " +
      "width: 1px; height: 1px";

    expect(await sha256(announcerStyle)).toBe(
      "sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=",
    );
    expect(cspDirectives["style-src-attr"]).toEqual([
      "unsafe-hashes",
      await sha256(announcerStyle),
    ]);
  });
});

/** Hashes a string the way CSP hashes an inline style attribute. */
async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
}
