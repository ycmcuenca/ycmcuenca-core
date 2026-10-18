import { baselineSecurityHeaders, cspDirectives } from "@ycmcuenca/edge";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";

// The home page must load from a production build in a real Chromium browser,
// carry the design D8 headers and the enforced Content Security Policy, and
// leave no `securitypolicyviolation` event behind (design D7).
// `playwright.config.ts` runs `wrangler dev`, so workerd serves the built
// worker exactly as production does.

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
  for (const [name, value] of Object.entries(baselineSecurityHeaders)) {
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

test("home page shows the app heading, the D8 headers and no CSP violation", async ({
  page,
}) => {
  await trackViolations(page);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome");
  // The announcer element only mounts once SvelteKit's client has hydrated,
  // and the template that carries its inline style is parsed before that, so
  // by now every violation the page causes has been reported.
  await expect(page.locator("#svelte-announcer")).toBeAttached();
  expect(await collectedViolations(page)).toEqual([]);
  expectDesignHeaders(response);
  expect(cspWithoutHashes(response)).toEqual(expectedCsp);
});
