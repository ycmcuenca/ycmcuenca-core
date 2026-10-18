import { baselineSecurityHeaders, cspDirectives } from "@ycmcuenca/edge";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import { SignJWT, importJWK } from "jose";
import type { JWK } from "jose";
import { readFileSync } from "node:fs";

// The production artifact, exercised like a visitor uses it (design D7): the
// app runs under `wrangler dev` with its trust settings pointed at the
// key-set fixture through `--var`, so the guard verifies a token this test
// signs with the fixture's key. A signed request must open the page without
// leaving a Content Security Policy violation behind and must carry the
// design D8 headers; a request without a token must be refused with none of
// the app's content.

const fixtureOrigin = "http://127.0.0.1:8799";
const audience = "e2e-audience";
const privateKeyFile = new URL(
  "../.access-fixture/private-key.json",
  import.meta.url,
);

/** Signs the short-lived Access token the fixture's key verifies. */
async function signedToken(): Promise<string> {
  const privateJwk = JSON.parse(readFileSync(privateKeyFile, "utf8")) as JWK;
  const key = await importJWK(privateJwk, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "e2e" })
    .setIssuer(fixtureOrigin)
    .setAudience([audience])
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

type Violation = { directive: string; blockedURI: string };

declare global {
  interface Window {
    cspViolations: Violation[];
  }
}

/** Starts collecting policy violations before the page's own scripts run. */
async function trackViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: Violation[] = [];
    window.cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
}

function collectedViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => window.cspViolations);
}

function headerOf(response: Response | null, name: string): string | undefined {
  return response?.headers()[name.toLowerCase()];
}

function expectDesignHeaders(response: Response | null): void {
  for (const [name, value] of Object.entries({
    ...baselineSecurityHeaders,
    "X-Robots-Tag": "noindex, nofollow",
  })) {
    expect(headerOf(response, name)).toBe(value);
  }
  // The policy is enforced, never a report-only copy (design D8).
  expect(
    headerOf(response, "Content-Security-Policy-Report-Only"),
  ).toBeUndefined();
}

// The directive sources as the header carries them (`self` is written
// `'self'`). Hashes are dropped from both sides: SvelteKit appends them for
// the inline scripts and styles it generates, the unit test pins the app's
// own, and the violation check below proves every hash the browser needs is
// present.
function withoutHashes(sources: string[]): string[] {
  return sources.filter((source) => !/^'?sha(?:256|384|512)-/.test(source));
}

const expectedCsp: Record<string, string[]> = Object.fromEntries(
  Object.entries(cspDirectives).map(([directive, sources]) => [
    directive,
    withoutHashes(
      sources.map((source) => (source === "data:" ? "data:" : `'${source}'`)),
    ),
  ]),
);

function cspWithoutHashes(response: Response | null): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of (
    headerOf(response, "Content-Security-Policy") ?? ""
  ).split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name !== undefined && name !== "") {
      directives[name] = withoutHashes(sources);
    }
  }
  return directives;
}

test("signed-in request shows the app heading, the D8 headers and no CSP violation", async ({
  page,
}) => {
  await trackViolations(page);
  await page.setExtraHTTPHeaders({
    "cf-access-jwt-assertion": await signedToken(),
  });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
  // The announcer element only mounts once SvelteKit's client has hydrated,
  // and the template that carries its inline style is parsed before that, so
  // by now every violation the page causes has been reported.
  await expect(page.locator("#svelte-announcer")).toBeAttached();
  expect(await collectedViolations(page)).toEqual([]);
  expectDesignHeaders(response);
  expect(cspWithoutHashes(response)).toEqual(expectedCsp);
});

test("request without a token is refused", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(403);
  expect(await response.text()).not.toContain("<h1");
});
