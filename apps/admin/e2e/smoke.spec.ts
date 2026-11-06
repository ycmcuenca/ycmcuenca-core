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
import { signedAccessToken } from "./access-token";

// The production artifact, exercised like a visitor uses it (design D7): the
// app runs under `wrangler dev` with its trust settings pointed at the
// key-set fixture through `--var`, so the guard verifies a token this test
// signs with the fixture's key. A signed request must open the page without
// leaving a Content Security Policy violation behind and must carry the
// design D8 headers; a request without a token must be refused with none of
// the app's content.

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

test("signed-in request shows the app heading, the D8 headers and no CSP violation", async ({
  page,
}) => {
  await trackViolations(page);
  await page.setExtraHTTPHeaders({
    "cf-access-jwt-assertion": await signedAccessToken(),
  });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
  // The prepared database is empty, so the home page says so (design D11).
  await expect(page.getByText("0 entries")).toBeVisible();
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
