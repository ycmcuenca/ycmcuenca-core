import { baselineSecurityHeaders } from "@ycmcuenca/edge";
import {
  collectedViolations,
  cspWithoutHashes,
  expectedCsp,
  headerOf,
  trackViolations,
} from "@ycmcuenca/edge/testing";
import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";

// The home page must load from a production build in a real Chromium browser,
// carry the design D8 headers and the enforced Content Security Policy, and
// leave no `securitypolicyviolation` event behind (design D7).
// `playwright.config.ts` runs `wrangler dev`, so workerd serves the built
// worker exactly as production does.

function expectDesignHeaders(response: Response | null): void {
  for (const [name, value] of Object.entries(baselineSecurityHeaders)) {
    expect(headerOf(response, name)).toBe(value);
  }
  // The policy is enforced, never a report-only copy (design D8).
  expect(
    headerOf(response, "Content-Security-Policy-Report-Only"),
  ).toBeUndefined();
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
